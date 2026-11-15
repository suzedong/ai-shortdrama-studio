// feature-803 · 主进程统一引擎接口 + ComfyUI HTTP 客户端
import { normalizeComfyBaseUrl } from './url.js'

export type ComfyJobState = 'queued' | 'running' | 'downloading' | 'completed' | 'error'

export interface ComfyJobOutput {
  path: string
  kind: 'image'
  assetId: string
}

export interface ComfyTestResult {
  ok: true
  comfyuiVersion: string | null
  deviceCount: number
}

export interface ComfyStatusResult {
  jobId: string
  promptId: string | null
  state: ComfyJobState
  outputs: ComfyJobOutput[]
  error: { code: string; message: string } | null
}

/** MCP 使用的受控高层接口；唯一生产实现是 ComfyEngine。 */
export interface ComfyClient {
  testConnection(req: { baseUrl: string }): Promise<ComfyTestResult>
  queue(req: {
    instanceId: string
    workflowId: string
    inputs?: Record<string, unknown>
    requestId: string
  }): Promise<{ jobId: string; promptId: string }>
  status(req: { instanceId: string; jobId: string }): Promise<ComfyStatusResult>
}

let holder: ComfyClient | null = null

export function setComfyClient(client: ComfyClient | null): void {
  holder = client
}

export function getComfyClient(): ComfyClient | null {
  return holder
}

export interface ComfyRemoteImage {
  nodeId: string
  filename: string
  subfolder: string
  type: string
}

export type ComfyRemoteStatus =
  | { state: 'queued' | 'running' }
  | { state: 'completed'; images: ComfyRemoteImage[] }
  | { state: 'error'; message: string }

/** HTTP 协议层，便于引擎测试注入确定性 transport。 */
export interface ComfyTransport {
  test(baseUrl: string): Promise<ComfyTestResult>
  submit(baseUrl: string, workflow: Record<string, unknown>, requestId: string): Promise<{ promptId: string }>
  poll(baseUrl: string, promptId: string): Promise<ComfyRemoteStatus>
  download(baseUrl: string, image: ComfyRemoteImage): Promise<{ data: Uint8Array; contentType: string }>
}

interface HttpOptions {
  fetch?: typeof fetch
  timeoutMs?: number
  maxDownloadBytes?: number
}

function fail(code: string, message: string, cause?: unknown): never {
  throw Object.assign(new Error(message), { code, ...(cause === undefined ? {} : { cause }) })
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('COMFY_INVALID_RESPONSE', `${label} 必须为 JSON 对象`)
  }
  return value as Record<string, unknown>
}

async function limitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    fail('COMFY_OUTPUT_TOO_LARGE', `图片超过 ${maxBytes} 字节限制`)
  }
  if (!response.body) {
    const data = new Uint8Array(await response.arrayBuffer())
    if (data.byteLength > maxBytes) fail('COMFY_OUTPUT_TOO_LARGE', `图片超过 ${maxBytes} 字节限制`)
    return data
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      fail('COMFY_OUTPUT_TOO_LARGE', `图片超过 ${maxBytes} 字节限制`)
    }
    chunks.push(value)
  }
  const data = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  return data
}

export class HttpComfyClient implements ComfyTransport {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly maxDownloadBytes: number

  constructor(options: HttpOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 10_000
    this.maxDownloadBytes = options.maxDownloadBytes ?? 25 * 1024 * 1024
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || this.maxDownloadBytes <= 0) {
      fail('INVALID_ARGUMENT', 'ComfyUI 客户端超时与下载限制必须大于 0')
    }
  }

  private async request<T>(
    baseUrl: string,
    route: string,
    init: RequestInit,
    read: (response: Response) => Promise<T>,
    networkErrorCode = 'COMFY_UNREACHABLE',
  ): Promise<T> {
    const base = normalizeComfyBaseUrl(baseUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    timer.unref()
    try {
      return await (async () => {
        const response = await this.fetchImpl(`${base}${route}`, {
          ...init, signal: controller.signal, redirect: 'manual',
        })
        if (!response.ok) {
          const code = networkErrorCode === 'COMFY_DOWNLOAD_FAILED' ? networkErrorCode : 'COMFY_HTTP_ERROR'
          fail(code, `ComfyUI HTTP ${response.status} ${response.statusText}`.trim())
        }
        return await read(response)
      })()
    } catch (error) {
      if (controller.signal.aborted) fail('COMFY_TIMEOUT', `ComfyUI 请求超过 ${this.timeoutMs}ms`)
      if (typeof (error as { code?: unknown })?.code === 'string') throw error
      fail(networkErrorCode, `ComfyUI 请求失败：${(error as Error).message}`, error)
    } finally {
      clearTimeout(timer)
    }
  }

  private async json(baseUrl: string, route: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    return this.request(baseUrl, route, init, async response => {
      try {
        return record(await response.json(), 'ComfyUI 响应')
      } catch (error) {
        if (typeof (error as { code?: unknown })?.code === 'string') throw error
        fail('COMFY_INVALID_RESPONSE', 'ComfyUI 返回了无效 JSON', error)
      }
    })
  }

  async test(baseUrl: string): Promise<ComfyTestResult> {
    const data = await this.json(baseUrl, '/system_stats')
    const system = record(data.system, 'system_stats.system')
    if (!Array.isArray(data.devices)) fail('COMFY_INVALID_RESPONSE', 'system_stats.devices 必须为数组')
    return {
      ok: true,
      comfyuiVersion: typeof system.comfyui_version === 'string' ? system.comfyui_version : null,
      deviceCount: data.devices.length,
    }
  }

  async submit(
    baseUrl: string,
    workflow: Record<string, unknown>,
    requestId: string,
  ): Promise<{ promptId: string }> {
    const data = await this.json(baseUrl, '/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: requestId }),
    })
    if (typeof data.prompt_id !== 'string' || data.prompt_id.length === 0) {
      fail('COMFY_INVALID_RESPONSE', 'POST /prompt 缺少 prompt_id')
    }
    return { promptId: data.prompt_id }
  }

  async poll(baseUrl: string, promptId: string): Promise<ComfyRemoteStatus> {
    const history = await this.json(baseUrl, `/history/${encodeURIComponent(promptId)}`)
    const rawEntry = history[promptId]
    if (rawEntry !== undefined) {
      const entry = record(rawEntry, 'history 条目')
      const status = record(entry.status, 'history.status')
      const messages = status.messages === undefined ? [] : status.messages
      if (!Array.isArray(messages)) fail('COMFY_INVALID_RESPONSE', 'history.status.messages 必须为数组')
      const executionError = messages.find(message => Array.isArray(message) && message[0] === 'execution_error')
      if (status.status_str === 'error' || executionError) {
        const rawDetail = executionError?.[1] as { exception_message?: unknown } | undefined
        const detail = typeof rawDetail?.exception_message === 'string'
          ? rawDetail.exception_message
          : executionError ? JSON.stringify(rawDetail).slice(0, 500) : 'ComfyUI 执行失败'
        return { state: 'error', message: detail }
      }
      if (status.completed === true || status.status_str === 'success') {
        const outputs = record(entry.outputs ?? {}, 'history.outputs')
        const images: ComfyRemoteImage[] = []
        for (const [nodeId, rawOutput] of Object.entries(outputs)) {
          const output = record(rawOutput, `history.outputs.${nodeId}`)
          if (output.images === undefined) continue
          if (!Array.isArray(output.images)) fail('COMFY_INVALID_RESPONSE', 'history images 必须为数组')
          for (const rawImage of output.images) {
            const image = record(rawImage, 'history image')
            if (typeof image.filename !== 'string' || typeof image.subfolder !== 'string' || typeof image.type !== 'string') {
              fail('COMFY_INVALID_RESPONSE', 'history image 缺少 filename/subfolder/type')
            }
            images.push({ nodeId, filename: image.filename, subfolder: image.subfolder, type: image.type })
          }
        }
        return { state: 'completed', images }
      }
      return { state: 'running' }
    }

    const queue = await this.json(baseUrl, '/queue')
    const running = queue.queue_running
    const pending = queue.queue_pending
    if (!Array.isArray(running) || !Array.isArray(pending)) {
      fail('COMFY_INVALID_RESPONSE', 'queue_running/queue_pending 必须为数组')
    }
    const contains = (entries: unknown[]) => entries.some(entry => Array.isArray(entry) && entry[1] === promptId)
    if (contains(running)) return { state: 'running' }
    if (contains(pending)) return { state: 'queued' }
    fail('COMFY_JOB_NOT_FOUND', `ComfyUI 找不到 prompt ${promptId}`)
  }

  async download(baseUrl: string, image: ComfyRemoteImage): Promise<{ data: Uint8Array; contentType: string }> {
    const query = new URLSearchParams({
      filename: image.filename,
      subfolder: image.subfolder,
      type: image.type,
    })
    return this.request(baseUrl, `/view?${query.toString()}`, {}, async response => {
      const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
      if (!contentType.startsWith('image/')) fail('COMFY_OUTPUT_INVALID', 'ComfyUI /view 未返回图片 content-type')
      const data = await limitedBody(response, this.maxDownloadBytes)
      return { data, contentType }
    }, 'COMFY_DOWNLOAD_FAILED')
  }
}
