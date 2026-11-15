import { describe, it, expect, afterEach, vi } from 'vitest'
import { registerPureTools } from '../../../electron/mcp/tools.js'
import { setComfyClient, type ComfyClient } from '../../../electron/comfy/client.js'

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>

function fakeServer() {
  const handlers = new Map<string, Handler>()
  const shapes = new Map<string, Record<string, unknown>>()
  const server = {
    tool: (name: string, ...rest: unknown[]) => {
      handlers.set(name, rest[rest.length - 1] as Handler)
      if (rest.length === 3) shapes.set(name, rest[1] as Record<string, unknown>)
    },
  }
  registerPureTools(server as never)
  return { handlers, shapes }
}

async function call(handler: Handler, args: Record<string, unknown>): Promise<Record<string, any>> {
  const result = await handler(args)
  return JSON.parse(result.content[0].text)
}

afterEach(() => setComfyClient(null))

describe('feature-803/816 ComfyUI MCP 契约', () => {
  it('queue 只暴露 workflowId/requestId，不再接收任意 workflow graph', async () => {
    const { handlers, shapes } = fakeServer()
    expect(Object.keys(shapes.get('comfyui.queue') ?? {})).toEqual(['instanceId', 'workflowId', 'inputs', 'requestId'])
    const queue = vi.fn(async () => ({ jobId: 'job-1', promptId: 'prompt-1' }))
    setComfyClient({ queue, status: vi.fn(), testConnection: vi.fn() } as unknown as ComfyClient)
    const args = { instanceId: 'c1', workflowId: 'minimax-h3-image-t2i', inputs: { prompt: 'test' }, requestId: 'r1' }
    await expect(call(handlers.get('comfyui.queue')!, args)).resolves.toEqual({
      ok: true, jobId: 'job-1', promptId: 'prompt-1',
    })
    expect(queue).toHaveBeenCalledWith(args)
  })

  it('status 原样返回统一状态与收片结果', async () => {
    const { handlers } = fakeServer()
    const status = vi.fn(async () => ({
      jobId: 'job-1', promptId: 'prompt-1', state: 'completed' as const,
      outputs: [{ path: '资产/生成/job-1/a.png', kind: 'image' as const, assetId: 'a1' }], error: null,
    }))
    setComfyClient({ queue: vi.fn(), status, testConnection: vi.fn() } as unknown as ComfyClient)
    const result = await call(handlers.get('comfyui.status')!, { instanceId: 'c1', jobId: 'job-1' })
    expect(result).toMatchObject({ ok: true, state: 'completed', promptId: 'prompt-1', outputs: [{ assetId: 'a1' }] })
    expect(status).toHaveBeenCalledWith({ instanceId: 'c1', jobId: 'job-1' })
  })

  it('引擎未注入时返回结构化 INTERNAL', async () => {
    const { handlers } = fakeServer()
    setComfyClient(null)
    await expect(call(handlers.get('comfyui.queue')!, {
      instanceId: 'c1', workflowId: 'minimax-h3-image-t2i', requestId: 'r1',
    })).resolves.toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
  })
})
