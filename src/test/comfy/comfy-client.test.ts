import { describe, it, expect, vi } from 'vitest'
import { HttpComfyClient } from '../../../electron/comfy/client.js'

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

describe('HttpComfyClient', () => {
  it('测试真实 system_stats 并规范化设备信息', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      system: { comfyui_version: '0.3.0' }, devices: [{ name: 'GPU 0' }],
    }))
    const client = new HttpComfyClient({ fetch: fetchMock as typeof fetch })
    await expect(client.test('http://127.0.0.1:8188/')).resolves.toEqual({
      ok: true, comfyuiVersion: '0.3.0', deviceCount: 1,
    })
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8188/system_stats')
  })

  it('POST /prompt 只提交受控 graph 与 requestId', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ prompt_id: 'prompt-1' }))
    const client = new HttpComfyClient({ fetch: fetchMock as typeof fetch })
    const workflow = { '1': { class_type: 'Test', inputs: { prompt: 'hello' } } }
    await expect(client.submit('http://gpu-box:8188', workflow, 'request-1')).resolves.toEqual({ promptId: 'prompt-1' })
    expect(fetchMock.mock.calls[0][0]).toBe('http://gpu-box:8188/prompt')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ prompt: workflow, client_id: 'request-1' })
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('manual')
  })

  it('history 无终态时通过 queue 区分排队与运行，完成后提取图片', async () => {
    const responses = [
      jsonResponse({}), jsonResponse({ queue_running: [], queue_pending: [[0, 'p1']] }),
      jsonResponse({}), jsonResponse({ queue_running: [[0, 'p1']], queue_pending: [] }),
      jsonResponse({
        p1: {
          status: { status_str: 'success', completed: true, messages: [] },
          outputs: { '9': { images: [{ filename: 'result.png', subfolder: '', type: 'output' }] } },
        },
      }),
    ]
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => responses.shift() ?? jsonResponse({}))
    const client = new HttpComfyClient({ fetch: fetchMock as typeof fetch })
    await expect(client.poll('http://127.0.0.1', 'p1')).resolves.toEqual({ state: 'queued' })
    await expect(client.poll('http://127.0.0.1', 'p1')).resolves.toEqual({ state: 'running' })
    await expect(client.poll('http://127.0.0.1', 'p1')).resolves.toEqual({
      state: 'completed',
      images: [{ nodeId: '9', filename: 'result.png', subfolder: '', type: 'output' }],
    })
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1/queue')
    expect(fetchMock.mock.calls[3][0]).toBe('http://127.0.0.1/queue')
    expect(fetchMock.mock.calls[4][0]).toBe('http://127.0.0.1/history/p1')
  })

  it('识别远端 execution_error', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      p1: {
        status: { status_str: 'error', completed: false, messages: [['execution_error', { exception_message: '显存不足' }]] },
        outputs: {},
      },
    }))
    const client = new HttpComfyClient({ fetch: fetchMock as typeof fetch })
    await expect(client.poll('http://127.0.0.1', 'p1')).resolves.toEqual({ state: 'error', message: '显存不足' })
  })

  it('通过 /view 下载图片并检查 content-type', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(png, { headers: { 'content-type': 'image/png' } }))
    const client = new HttpComfyClient({ fetch: fetchMock as typeof fetch })
    const result = await client.download('http://127.0.0.1', {
      nodeId: '9', filename: 'a b.png', subfolder: 'sub', type: 'output',
    })
    expect(Array.from(result.data)).toEqual(Array.from(png))
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/view')
    expect(url.searchParams.get('filename')).toBe('a b.png')
    expect(url.searchParams.get('subfolder')).toBe('sub')
  })

  it('下载超过流式上限时终止读取', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(Uint8Array.from([1, 2, 3, 4, 5]), {
      headers: { 'content-type': 'image/png' },
    }))
    const client = new HttpComfyClient({ fetch: fetchMock as typeof fetch, maxDownloadBytes: 4 })
    await expect(client.download('http://127.0.0.1', {
      nodeId: '9', filename: 'large.png', subfolder: '', type: 'output',
    })).rejects.toMatchObject({ code: 'COMFY_OUTPUT_TOO_LARGE' })
  })

  it('请求超时映射为稳定错误', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    const client = new HttpComfyClient({ fetch: fetchMock as typeof fetch, timeoutMs: 5 })
    await expect(client.test('http://127.0.0.1')).rejects.toMatchObject({ code: 'COMFY_TIMEOUT' })
  })
})
