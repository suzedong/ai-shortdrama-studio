import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ComfyEngine } from '../../../electron/comfy/engine.js'
import type {
  ComfyRemoteImage, ComfyRemoteStatus, ComfyTestResult, ComfyTransport,
} from '../../../electron/comfy/client.js'

const instance = vi.hoisted(() => ({
  current: {
    id: 'c1', name: '局域网 GPU', baseUrl: 'http://192.168.1.20:8188', enabled: true, addedAt: '2026-01-01T00:00:00.000Z',
  },
}))

vi.mock('../../../electron/comfy/settings.js', () => ({
  requireInstance: vi.fn(async (id: string) => {
    if (id !== instance.current.id) throw Object.assign(new Error('实例不存在'), { code: 'NOT_FOUND' })
    return { ...instance.current }
  }),
}))

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z6XcAAAAASUVORK5CYII=', 'base64')

class FakeTransport implements ComfyTransport {
  remote: ComfyRemoteStatus = {
    state: 'completed',
    images: [{ nodeId: '9', filename: 'result.png', subfolder: '', type: 'output' }],
  }
  downloadData: Uint8Array = png
  downloadContentType = 'image/png'
  pollError: Error | null = null
  submitCalls: Array<{ baseUrl: string; workflow: Record<string, unknown>; requestId: string }> = []
  pollCalls: Array<{ baseUrl: string; promptId: string }> = []
  downloadCalls: Array<{ baseUrl: string; image: ComfyRemoteImage }> = []

  async test(): Promise<ComfyTestResult> {
    return { ok: true, comfyuiVersion: 'test', deviceCount: 1 }
  }

  async submit(baseUrl: string, workflow: Record<string, unknown>, requestId: string): Promise<{ promptId: string }> {
    this.submitCalls.push({ baseUrl, workflow, requestId })
    return { promptId: `prompt-${this.submitCalls.length}` }
  }

  async poll(baseUrl: string, promptId: string): Promise<ComfyRemoteStatus> {
    this.pollCalls.push({ baseUrl, promptId })
    if (this.pollError) throw this.pollError
    return this.remote
  }

  async download(baseUrl: string, image: ComfyRemoteImage): Promise<{ data: Uint8Array; contentType: string }> {
    this.downloadCalls.push({ baseUrl, image })
    return { data: this.downloadData, contentType: this.downloadContentType }
  }
}

let root: string
let workflowDirectory: string
const roots: string[] = []

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'comfy-engine-'))
  roots.push(root)
  workflowDirectory = path.join(root, 'workflows')
  await fsp.mkdir(workflowDirectory, { recursive: true })
  await fsp.writeFile(path.join(workflowDirectory, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    workflows: [{
      id: 'minimax-h3-image-t2i', kind: 'image', model: 'MiniMax-H3', version: 'fixture-v1', file: 'h3.json',
      inputs: {
        prompt: { node: '6', field: 'text', type: 'string', required: true },
        seed: { node: '3', field: 'seed', type: 'integer', min: 0 },
      },
    }],
  }), 'utf-8')
  await fsp.writeFile(path.join(workflowDirectory, 'h3.json'), JSON.stringify({
    '6': { class_type: 'CLIPTextEncode', inputs: { text: '' } },
    '3': { class_type: 'KSampler', inputs: { seed: 0, steps: 20 } },
  }), 'utf-8')
  instance.current.enabled = true
  instance.current.baseUrl = 'http://192.168.1.20:8188'
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map(dir => fsp.rm(dir, { recursive: true, force: true })))
})

function engine(transport: FakeTransport, limits: { maxOutputs?: number; maxOutputBytes?: number } = {}): ComfyEngine {
  return new ComfyEngine({
    transport, workflowDirectory, getProjectDir: () => root, ...limits,
  })
}

function request(requestId = 'request-1'): {
  instanceId: string; workflowId: string; inputs: Record<string, unknown>; requestId: string
} {
  return { instanceId: 'c1', workflowId: 'minimax-h3-image-t2i', inputs: { prompt: '雨夜重逢', seed: 42 }, requestId }
}

async function jobs(): Promise<Array<Record<string, any>>> {
  return (JSON.parse(await fsp.readFile(path.join(root, 'comfy-jobs.json'), 'utf-8')) as { jobs: Array<Record<string, any>> }).jobs
}

describe('ComfyEngine 持久作业与收片', () => {
  it('同 requestId 并发只提交一次，完成后重复查询不重复下载或登记', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport)
    const [first, replay] = await Promise.all([subject.queue(request()), subject.queue(request())])
    expect(replay).toEqual(first)
    expect(transport.submitCalls).toHaveLength(1)
    expect(transport.submitCalls[0].workflow).toMatchObject({
      '6': { inputs: { text: '雨夜重逢' } },
      '3': { inputs: { seed: 42, steps: 20 } },
    })

    const completed = await subject.status({ instanceId: 'c1', jobId: first.jobId })
    expect(completed).toMatchObject({ promptId: 'prompt-1', state: 'completed', error: null })
    expect(completed.outputs).toHaveLength(1)
    const outputPath = path.join(root, ...completed.outputs[0].path.split('/'))
    expect(new Uint8Array(await fsp.readFile(outputPath))).toEqual(new Uint8Array(png))

    const assetIndex = JSON.parse(await fsp.readFile(path.join(root, '资产', 'asset-index.json'), 'utf-8'))
    expect(assetIndex).toHaveLength(1)
    expect(assetIndex[0]).toMatchObject({
      id: completed.outputs[0].assetId,
      kind: 'image', path: completed.outputs[0].path, sourceJobId: first.jobId,
      meta: {
        instanceId: 'c1', promptId: 'prompt-1', workflowId: 'minimax-h3-image-t2i',
        workflowVersion: 'fixture-v1', inputs: { prompt: '雨夜重逢', seed: 42 }, nodeId: '9',
      },
    })

    await expect(subject.status({ instanceId: 'c1', jobId: first.jobId })).resolves.toEqual(completed)
    await expect(subject.queue(request())).resolves.toEqual(first)
    expect(transport.pollCalls).toHaveLength(1)
    expect(transport.downloadCalls).toHaveLength(1)
    expect(transport.submitCalls).toHaveLength(1)
    expect(JSON.parse(await fsp.readFile(path.join(root, '资产', 'asset-index.json'), 'utf-8'))).toHaveLength(1)
  })

  it('从 downloading 恢复时不重复追加输出、下载或资产', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport)
    const queued = await subject.queue(request())
    const completed = await subject.status({ instanceId: 'c1', jobId: queued.jobId })
    const file = path.join(root, 'comfy-jobs.json')
    const data = JSON.parse(await fsp.readFile(file, 'utf-8'))
    data.jobs[0].state = 'downloading'
    await fsp.writeFile(file, JSON.stringify(data), 'utf-8')

    const recovered = await engine(transport).status({ instanceId: 'c1', jobId: queued.jobId })
    expect(recovered.state).toBe('completed')
    expect(recovered.outputs).toEqual(completed.outputs)
    expect(recovered.outputs).toHaveLength(1)
    expect(transport.pollCalls).toHaveLength(2)
    expect(transport.downloadCalls).toHaveLength(1)
    expect(JSON.parse(await fsp.readFile(path.join(root, '资产', 'asset-index.json'), 'utf-8'))).toHaveLength(1)
  })

  it('同 requestId 不同参数明确冲突', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport)
    await subject.queue(request())
    await expect(subject.queue({ ...request(), inputs: { prompt: '另一张图', seed: 42 } }))
      .rejects.toMatchObject({ code: 'COMFY_REQUEST_CONFLICT' })
    expect(transport.submitCalls).toHaveLength(1)
  })

  it('禁用实例拒绝新任务，但重启后按 URL 快照续查既有作业', async () => {
    const firstTransport = new FakeTransport()
    const first = await engine(firstTransport).queue(request())
    instance.current.enabled = false
    instance.current.baseUrl = 'http://192.168.1.99:8188'
    await expect(engine(new FakeTransport()).queue(request('request-2')))
      .rejects.toMatchObject({ code: 'COMFY_INSTANCE_DISABLED' })

    const resumedTransport = new FakeTransport()
    const status = await engine(resumedTransport).status({ instanceId: 'c1', jobId: first.jobId })
    expect(status.state).toBe('completed')
    expect(resumedTransport.pollCalls[0].baseUrl).toBe('http://192.168.1.20:8188')
    expect(resumedTransport.downloadCalls[0].baseUrl).toBe('http://192.168.1.20:8188')
    expect(resumedTransport.submitCalls).toHaveLength(0)
  })

  it('轮询传输失败保留 queued，恢复后续查而不重提', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport)
    const queued = await subject.queue(request())
    transport.pollError = Object.assign(new Error('timeout'), { code: 'COMFY_TIMEOUT' })
    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId }))
      .rejects.toMatchObject({ code: 'COMFY_TIMEOUT' })
    expect((await jobs())[0]).toMatchObject({ state: 'queued', promptId: 'prompt-1', error: null })

    transport.pollError = null
    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId }))
      .resolves.toMatchObject({ state: 'completed' })
    expect(transport.submitCalls).toHaveLength(1)
  })

  it('缺 promptId 的中断记录显式报错且不自动重提', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport)
    const queued = await subject.queue(request())
    const file = path.join(root, 'comfy-jobs.json')
    const data = JSON.parse(await fsp.readFile(file, 'utf-8'))
    data.jobs[0].promptId = null
    data.jobs[0].state = 'queued'
    await fsp.writeFile(file, JSON.stringify(data), 'utf-8')

    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId })).resolves.toMatchObject({
      state: 'error', promptId: null, error: { code: 'COMFY_SUBMISSION_UNKNOWN' },
    })
    await expect(subject.queue(request())).rejects.toMatchObject({ code: 'COMFY_SUBMISSION_UNKNOWN' })
    expect(transport.pollCalls).toHaveLength(0)
    expect(transport.submitCalls).toHaveLength(1)
  })

  it('拒绝路径穿越文件名且不发起下载', async () => {
    const transport = new FakeTransport()
    transport.remote = {
      state: 'completed',
      images: [{ nodeId: '9', filename: '../escape.png', subfolder: '', type: 'output' }],
    }
    const subject = engine(transport)
    const queued = await subject.queue(request())
    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId })).resolves.toMatchObject({
      state: 'error', error: { code: 'COMFY_OUTPUT_INVALID' },
    })
    expect(transport.downloadCalls).toHaveLength(0)
    await expect(fsp.access(path.join(root, 'escape.png'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('拒绝扩展名与真实格式不符的图片', async () => {
    const transport = new FakeTransport()
    transport.downloadData = Uint8Array.from([1, 2, 3, 4])
    const subject = engine(transport)
    const queued = await subject.queue(request())
    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId })).resolves.toMatchObject({
      state: 'error', error: { code: 'COMFY_OUTPUT_INVALID' },
    })
  })

  it('在引擎边界拒绝超限图片', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport, { maxOutputBytes: 8 })
    const queued = await subject.queue(request())
    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId })).resolves.toMatchObject({
      state: 'error', error: { code: 'COMFY_OUTPUT_TOO_LARGE' },
    })
  })

  it('拒绝超出数量上限的远端输出', async () => {
    const transport = new FakeTransport()
    transport.remote = {
      state: 'completed',
      images: [
        { nodeId: '9', filename: 'one.png', subfolder: '', type: 'output' },
        { nodeId: '9', filename: 'two.png', subfolder: '', type: 'output' },
      ],
    }
    const subject = engine(transport, { maxOutputs: 1 })
    const queued = await subject.queue(request())
    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId })).resolves.toMatchObject({
      state: 'error', error: { code: 'COMFY_OUTPUT_INVALID' },
    })
    expect(transport.downloadCalls).toHaveLength(0)
  })

  it('历史 Qwen pending 作业只按 promptId 续查收片，不重新加载或提交旧 graph', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport)
    const queued = await subject.queue(request('h3-before-history-rewrite'))
    const jobsFile = path.join(root, 'comfy-jobs.json')
    const jobsDocument = JSON.parse(await fsp.readFile(jobsFile, 'utf-8')) as { jobs: Array<Record<string, unknown>> }
    jobsDocument.jobs[0].workflowId = 'qwen-image-2512-text'
    await fsp.writeFile(jobsFile, JSON.stringify(jobsDocument), 'utf-8')
    transport.submitCalls = []

    await expect(subject.status({ instanceId: 'c1', jobId: queued.jobId })).resolves.toMatchObject({
      jobId: queued.jobId,
      promptId: queued.promptId,
      state: 'completed',
      outputs: [{ kind: 'image', assetId: expect.any(String), path: expect.stringContaining('result.png') }],
    })
    expect(transport.submitCalls).toHaveLength(0)
    expect(transport.pollCalls).toEqual([{ baseUrl: 'http://192.168.1.20:8188', promptId: 'prompt-1' }])
    const persisted = JSON.parse(await fsp.readFile(jobsFile, 'utf-8')) as { jobs: Array<Record<string, unknown>> }
    expect(persisted.jobs[0].workflowId).toBe('qwen-image-2512-text')
  })

  it('旧 Qwen workflowId 新提交在 HTTP 前被拒绝', async () => {
    const transport = new FakeTransport()
    const subject = engine(transport)
    await expect(subject.queue({ ...request('legacy-qwen-new'), workflowId: 'qwen-image-2512-text' }))
      .rejects.toMatchObject({ code: 'WORKFLOW_NOT_AVAILABLE' })
    expect(transport.submitCalls).toHaveLength(0)
    expect(transport.pollCalls).toHaveLength(0)
  })
})
