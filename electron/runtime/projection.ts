// feature-008 · opencode SSE 事件 → 本平台封闭 RuntimeEvent 投影
// 严格匹配《SDG-RE-契约.md》§4.1/§5/§9：
// - renderer 只认六类 RuntimeEvent；未识别 opencode 事件一律忽略并计数（计数仅日志，不进 IPC）；
// - argsPreview/resultPreview 截断 500 字符；
// - 事件中任何字符串里的 key/token/authorization（大小写不敏感）等凭证片段投递前打码 ***；
// - 事件按 SSE 到达顺序投递，不做跨事件聚合。
//
// 事件源（运行实例 /doc OpenAPI 3.1，1.18.34；SDK d.ts 缺 message.part.delta，以 /doc 为准）：
//   server.connected               properties:{}                    → runtime.connected（version 取运行时上下文）
//   message.part.delta  {sessionID,messageID,partID,field,delta} → message.delta（按 partID
//                       对应 part 类型分轨：text 正文 / reasoning 推理，D-009；field 恒为 text 不可用）
//   message.part.updated           {sessionID,part:Part}            → message.part（text/reasoning）
//                                                                     或 tool.call（tool part 状态机）
//                     text/reasoning 须带 time（仅 assistant 产出；用户 text part 无 time → 忽略）
//   session.idle                   {sessionID}                      → session.idle
//   session.error                  {sessionID,error:{name,data}}    → runtime.error
//   message.updated(info.error)    AssistantMessage.error           → runtime.error
//   其余（session.next.* / lsp.* / pty.* / permission.* …）         → 忽略计数
import type { RuntimeErrorBody, RuntimeEvent } from './types.js'
import type { RuntimeConnection } from './manager.js'

const PREVIEW_LIMIT = 500

// -- SSE 帧解析（帧格式：data: <json>\n\n） ------------------------------------

/**
 * 流式 SSE 解析器：可按任意 chunk 边界喂入，按 SSE 规范切帧。
 * 多 data 行以 \n 拼接；注释行（:）与 event/id 等字段忽略。
 */
export class SseFrameParser {
  private buffer = ''

  push(chunk: string): string[] {
    this.buffer += chunk
    const frames: string[] = []
    let sep: number
    // 兼容 \r\n 与 \n：以空行分帧
    while ((sep = findFrameBoundary(this.buffer)) >= 0) {
      const rawFrame = this.buffer.slice(0, sep)
      this.buffer = this.buffer.slice(sep).replace(/^\r?\n/, '')
      const dataLines: string[] = []
      for (const line of rawFrame.split(/\r?\n/)) {
        if (!line || line.startsWith(':')) continue
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''))
        }
        // event:/id:/retry: 等字段本平台不需要
      }
      const payload = dataLines.join('\n')
      if (payload.length > 0) frames.push(payload)
    }
    return frames
  }
}

function findFrameBoundary(text: string): number {
  const lf = text.indexOf('\n\n')
  const crlf = text.indexOf('\r\n\r\n')
  if (lf < 0) return crlf
  if (crlf < 0) return lf
  return Math.min(lf, crlf)
}

// -- 投影器 -------------------------------------------------------------------

export interface ProjectContext {
  /** 运行时版本（server.connected 的 properties 为空，version 由 manager 状态提供） */
  version?: string | null
  now?: () => Date
}

interface OcErrorShape {
  name?: string
  data?: { message?: string; providerID?: string }
}

/**
 * message.part.delta 分轨（D-009）：opencode 1.18.34 对所有 delta 一律下发
 * field:"text"，field 不可用；真正依据是 delta 的 partID 对应的 part 类型
 * （part 顺序：step-start → reasoning → text）。
 */
function deltaTrackFromPart(partId: unknown, kinds: Map<string, 'text' | 'reasoning'>): 'text' | 'reasoning' {
  return typeof partId === 'string' && kinds.get(partId) === 'reasoning' ? 'reasoning' : 'text'
}

/**
 * text/reasoning part 是否带 time.start——区分 assistant 与用户消息 part：
 * opencode 1.18.34 实测用户 text part 无 time，assistant 必有 time:{start,end}。
 */
function hasPartTime(part: Record<string, unknown>): boolean {
  const time = isObject(part.time) ? part.time : null
  return !!time && typeof time.start === 'number'
}

export class EventProjector {
  private ignoredTotal = 0
  private readonly ignoredByType = new Map<string, number>()
  /** partID → kind（D-009）：供 delta 按 partID 分轨 */
  private readonly partKinds = new Map<string, 'text' | 'reasoning'>()

  /** 未识别事件计数（仅日志 / 调试，不进 IPC） */
  getIgnoredCount(): number {
    return this.ignoredTotal
  }

  getIgnoredByType(): Record<string, number> {
    return Object.fromEntries(this.ignoredByType)
  }

  /** 投影单个 opencode 事件信封；未识别 / 载荷畸形返回 null（折叠计数） */
  project(envelope: unknown, ctx: ProjectContext = {}): RuntimeEvent | null {
    if (!isObject(envelope) || typeof envelope.type !== 'string') {
      this.ignore('<malformed>')
      return null
    }
    const type = envelope.type
    const props = isObject(envelope.properties) ? envelope.properties : {}
    const nowIso = () => (ctx.now ? ctx.now() : new Date()).toISOString()

    let event: RuntimeEvent | null = null

    switch (type) {
      case 'server.connected':
        event = { type: 'runtime.connected', ts: nowIso(), version: ctx.version ?? '' }
        break

      case 'message.part.delta': {
        if (
          typeof props.sessionID === 'string' &&
          typeof props.messageID === 'string' &&
          typeof props.delta === 'string'
        ) {
          event = {
            type: 'message.delta',
            ts: nowIso(),
            sessionId: props.sessionID,
            messageId: props.messageID,
            track: deltaTrackFromPart(props.partID, this.partKinds),
            delta: props.delta,
          }
        }
        break
      }

      case 'message.part.updated': {
        event = this.projectPart(props, nowIso)
        break
      }

      case 'session.idle': {
        if (typeof props.sessionID === 'string') {
          event = { type: 'session.idle', ts: nowIso(), sessionId: props.sessionID }
        }
        break
      }

      case 'session.error': {
        if (isObject(props.error)) {
          event = {
            type: 'runtime.error',
            ts: nowIso(),
            ...(typeof props.sessionID === 'string' ? { sessionId: props.sessionID } : {}),
            error: mapOcError(props.error as OcErrorShape),
          }
        }
        break
      }

      case 'message.updated': {
        const info = isObject(props.info) ? props.info : null
        if (info && isObject(info.error) && typeof info.sessionID === 'string') {
          event = {
            type: 'runtime.error',
            ts: nowIso(),
            sessionId: info.sessionID as string,
            error: mapOcError(info.error as OcErrorShape),
          }
        }
        break
      }

      default:
        break
    }

    if (!event) {
      this.ignore(type)
      return null
    }
    return redactEvent(event)
  }

  private ignore(type: string) {
    this.ignoredTotal += 1
    this.ignoredByType.set(type, (this.ignoredByType.get(type) ?? 0) + 1)
    if (process.env.NODE_ENV !== 'test') {
      // 计数经日志暴露（不进 IPC）；生产侧 debug 级
      console.debug(`[runtime] ignored opencode event: ${type}`)
    }
  }

  private projectPart(props: Record<string, unknown>, nowIso: () => string): RuntimeEvent | null {
    const part = isObject(props.part) ? props.part : null
    const sessionId = typeof props.sessionID === 'string' ? props.sessionID : part?.sessionID
    const messageId = part && typeof part.messageID === 'string' ? part.messageID : undefined
    const partId = part && typeof part.id === 'string' ? part.id : undefined
    if (!part || typeof sessionId !== 'string' || typeof messageId !== 'string' || !partId) return null

    const partType = part.type
    if (partType === 'text' || partType === 'reasoning') {
      // role 过滤（契约 §4.2 / D-007）：用户消息的 text part 无 time，
      // assistant 的 text/reasoning 必有 time；缺 time 即非 agent 产出，忽略。
      if (!hasPartTime(part)) return null
      const text = typeof part.text === 'string' ? part.text : ''
      this.partKinds.set(partId, partType)
      return {
        type: 'message.part',
        ts: nowIso(),
        sessionId,
        messageId,
        partId,
        part: { kind: partType, text },
      }
    }

    if (partType === 'tool') {
      const tool = typeof part.tool === 'string' ? part.tool : 'unknown'
      const callId =
        typeof part.callID === 'string' ? part.callID : typeof part.id === 'string' ? part.id : ''
      const state = isObject(part.state) ? part.state : {}
      const rawStatus = typeof state.status === 'string' ? state.status : 'pending'
      const status = rawStatus === 'pending' ? 'running' : rawStatus
      if (status !== 'running' && status !== 'completed' && status !== 'error') return null

      const args = isObject(state.input) ? state.input : {}
      const argsPreview = truncatePreview(safeStringify(args))
      const time = isObject(state.time) ? state.time : {}
      const startedAt = typeof time.start === 'number' ? time.start : undefined
      const endedAt = typeof time.end === 'number' ? time.end : undefined

      let result: unknown
      let resultPreview: string | undefined
      if (status === 'completed') {
        const rawOutput = typeof state.output === 'string' ? state.output : safeStringify(state.output)
        result = parseToolEnvelope(rawOutput)
        resultPreview = truncatePreview(rawOutput)
      }

      let errorText: string | undefined
      if (status === 'error') {
        const rawError = typeof state.error === 'string' ? state.error : safeStringify(state.error)
        errorText = rawError
        // 业务工具 failed() 信封：isError 时 state.error 即信封 JSON 原文串，
        // 解析出结构化信封（对象含 kind）时挂 result，使定稿层可消费（契约 §2.2）
        const parsed = parseToolEnvelope(rawError)
        if (isObject(parsed)) result = parsed
        resultPreview = truncatePreview(rawError)
      }

      return {
        type: 'tool.call',
        ts: nowIso(),
        sessionId,
        messageId,
        callId,
        tool,
        status,
        argsPreview,
        args,
        ...(result !== undefined ? { result } : {}),
        ...(resultPreview !== undefined ? { resultPreview } : {}),
        ...(errorText !== undefined ? { errorText } : {}),
        ...(startedAt !== undefined ? { startedAt } : {}),
        ...(endedAt !== undefined ? { endedAt } : {}),
      }
    }

    // file / step-start / step-finish / snapshot / patch / agent 等 part 不属于封闭六类
    return null
  }
}

// -- SSE 订阅 -----------------------------------------------------------------

export interface EventStreamHandle {
  readonly closed: Promise<void>
  close(): Promise<void>
}

export interface SubscribeEventsOptions {
  conn: RuntimeConnection
  onEvent: (event: RuntimeEvent) => void
  version?: string | null
  fetchImpl?: typeof fetch
  projector?: EventProjector
}

/**
 * 订阅 GET /event：Basic 认证 SSE；逐帧解析 + 投影后回调。
 * 不做自动重连（serve 退出由 manager 状态机负责）；close() 中断连接。
 */
export async function subscribeEvents(opts: SubscribeEventsOptions): Promise<EventStreamHandle> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const projector = opts.projector ?? new EventProjector()
  const controller = new AbortController()
  const auth = `Basic ${Buffer.from(`opencode:${opts.conn.password}`).toString('base64')}`

  const response = await fetchImpl(`${opts.conn.baseUrl}/event`, {
    headers: { Authorization: auth, Accept: 'text/event-stream' },
    signal: controller.signal,
  })
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    throw new Error(`opencode 事件流建立失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}`)
  }

  const parser = new SseFrameParser()
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let resolveClosed: () => void
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve
  })

  const pump = async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const frames = parser.push(decoder.decode(value, { stream: true }))
        for (const frame of frames) {
          let envelope: unknown
          try {
            envelope = JSON.parse(frame)
          } catch {
            continue // 畸形帧：忽略，不影响后续
          }
          const event = projector.project(envelope, { version: opts.version })
          if (event) opts.onEvent(event)
        }
      }
    } catch {
      // abort / 网络中断：正常收尾（close 或 serve 退出）
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // ignore
      }
      resolveClosed!()
    }
  }
  void pump()

  return {
    closed,
    async close() {
      controller.abort()
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      await closed
    },
  }
}

// -- 安全：截断 + 打码 ---------------------------------------------------------

export function truncatePreview(value: string, limit = PREVIEW_LIMIT): string {
  return value.length > limit ? value.slice(0, limit) : value
}

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

/**
 * completed 工具输出解析：尝试 JSON.parse；
 * 解析结果为 ToolResultEnvelope（带字符串 kind 的对象）时返回该对象，
 * 其余情况（非 JSON / 标量 / 无 kind）一律返回原始字符串（契约 §4.1）。
 */
function parseToolEnvelope(rawOutput: string): unknown {
  try {
    const parsed: unknown = JSON.parse(rawOutput)
    if (isObject(parsed) && typeof parsed.kind === 'string') return parsed
  } catch {
    // 非 JSON，落入原串
  }
  return rawOutput
}

function mapOcError(error: OcErrorShape): RuntimeErrorBody {
  switch (error.name) {
    case 'ProviderAuthError':
      return { code: 'UPSTREAM_AUTH_MISSING', message: '上游 provider 认证缺失或失效' }
    case 'MessageAbortedError':
      return { code: 'PROMPT_ABORTED', message: '消息已被中止' }
    default:
      return { code: 'PROMPT_FAILED', message: `opencode 会话错误：${error.name ?? 'UnknownError'}` }
  }
}

const JSON_PAIR_RE =
  /"(authorization|api[_-]?key|key|token|secret|password)"\s*:\s*"((?:[^"\\]|\\.)*)"/gi
const BEARER_KV_RE = /\b(authorization)\s*[:=]\s*Bearer\s+([^\s"',}&]+)/gi
const KV_PAIR_RE =
  /\b(authorization|api[_-]?key|key|token|secret|password)\s*[:=]\s*([^\s"',}&]+)/gi

function maskString(input: string): string {
  return input
    .replace(JSON_PAIR_RE, '"$1":"***"')
    .replace(BEARER_KV_RE, '$1=Bearer ***')
    .replace(KV_PAIR_RE, '$1=***')
}

/** 对最终事件的所有字符串字段做凭证打码（投影输出进入 IPC 前的最后一道） */
export function redactEvent(event: RuntimeEvent): RuntimeEvent {
  return deepMapStrings(event, maskString)
}

const SENSITIVE_KEY_RE = /^(?:authorization|api[_-]?key|key|token|secret|password)$/i

function deepMapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T
  if (Array.isArray(value)) return value.map((v) => deepMapStrings(v, fn)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      // 结构化对象中的敏感键：字符串值直接打码（逐值 fn 无法感知键名）
      out[k] = SENSITIVE_KEY_RE.test(k) && typeof v === 'string' ? '***' : deepMapStrings(v, fn)
    }
    return out as T
  }
  return value
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
