// feature-008 · opencode client 封装（client-only）
// 严格匹配《SDG-RE-契约.md》§3.1/§4/§5/§7：
// - 仅使用 @opencode-ai/sdk/client 的 createOpencodeClient 连接已启动的 serve；禁止 createOpencode() 自启；
// - 主进程是 opencode 唯一客户端，口令只在 Authorization 头中，不进任何 DTO / 错误消息；
// - 边界参数校验（不信任 renderer）：sessionId/text 非空，agent 仅 showrunner，
//   model 只能取已配置模型（ark 当前模型 / mock-1），tools 只能取 showrunner 已声明集合子集；
// - 业务失败（assistant message error / 结构化解析失败）走 RuntimePromptResult.error，不 reject；
//   通道级 / 运行时级错误才抛 Error（name=RuntimeErrorCode）。
//
// 运行实例 /doc OpenAPI 3.1 核对（2026-10-04，1.18.34）：
// - POST /session body 仅 {parentID?,title?}；agent/model 随 prompt 传；
// - POST /session/{id}/prompt_async 返回 204（无 body）→ messageID 由本方生成（正则 ^msg）随 body 传入；
// - prompt body.tools 为对象 map（{name:boolean}），非数组（契约按实测实现）；
// - prompt body 支持 format:{type:'json_schema',schema,retryCount?}（SDK 1.18.34 TS 类型缺该字段，运行时支持）；
// - GET /agent 在 SDK 运行时挂在 app.agents()（sdk.gen.d.ts：App.agents，T8 真机核实）。
import crypto from 'node:crypto'
import { createOpencodeClient } from '@opencode-ai/sdk/client'
import type { Agent, AssistantMessage, Message, Part, Session } from '@opencode-ai/sdk/client'
import {
  SHOWRUNNER_AGENT,
  SHOWRUNNER_DECLARED_TOOLS,
  isShowrunnerDeclaredTool,
  MOCK_MODEL_ID,
  MOCK_PROVIDER_ID,
  ARK_PROVIDER_ID,
  LMSTUDIO_PROVIDER_ID,
} from './provider.js'
import type { RuntimeConnection } from './manager.js'
import type {
  RuntimeAgent,
  RuntimeErrorCode,
  RuntimeModelRef,
  RuntimePromptRequest,
  RuntimePromptResult,
  RuntimeSession,
  RuntimeSessionMessageRecord,
  RuntimeStructuredFormat,
} from './types.js'

// -- SDK 结构类型（最小声明，按实际使用裁剪） ----------------------------------

interface SdkResult<T> {
  data: T | undefined
  error?: unknown
  response?: Response
}

interface PromptBody {
  messageID?: string
  parts: Array<{ type: 'text'; text: string }>
  agent?: string
  model?: RuntimeModelRef
  tools?: Record<string, boolean>
  format?: RuntimeStructuredFormat
  system?: string
}

export interface SdkHandle {
  session: {
    create(o: { body?: { title?: string } }): Promise<SdkResult<Session>>
    list(o?: unknown): Promise<SdkResult<Session[]>>
    delete(o: { path: { id: string } }): Promise<SdkResult<boolean>>
    abort(o: { path: { id: string } }): Promise<SdkResult<unknown>>
    prompt(o: { path: { id: string }; body: PromptBody }): Promise<
      SdkResult<{ info: AssistantMessage; parts: Part[] }>
    >
    promptAsync(o: { path: { id: string }; body: PromptBody }): Promise<SdkResult<null>>
    messages(o: { path: { id: string } }): Promise<
      SdkResult<Array<{ info: Message; parts: Part[] }>>
    >
  }
  app: {
    // SDK d.ts 声明见 gen/sdk.gen.d.ts App.agents → GET /agent
    agents(o?: unknown): Promise<SdkResult<Agent[]>>
  }
}

export type SdkClientFactory = (conn: RuntimeConnection) => SdkHandle

/** 默认工厂：createOpencodeClient（client-only），Basic 认证头 */
export const defaultSdkClientFactory: SdkClientFactory = (conn) => {
  const token = Buffer.from(`opencode:${conn.password}`).toString('base64')
  const sdk = createOpencodeClient({
    baseUrl: conn.baseUrl,
    headers: { Authorization: `Basic ${token}` },
  })
  return sdk as unknown as SdkHandle
}

// -- client -------------------------------------------------------------------

export interface OpencodeRuntimeClientDeps {
  getConnection: () => RuntimeConnection | null
  /** 当前配置的 ark modelID（ARK_MODEL），用于 model 覆盖白名单校验 */
  allowedArkModel?: string
  /** 当前配置的 LM Studio modelID（LMSTUDIO_MODEL） */
  allowedLmStudioModel?: string
  factory?: SdkClientFactory
}

export class OpencodeRuntimeClient {
  private cached: { key: string; handle: SdkHandle } | null = null

  constructor(private readonly deps: OpencodeRuntimeClientDeps) {}

  // -- 会话 ------------------------------------------------------------------

  async createSession(title?: string): Promise<RuntimeSession> {
    if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
      throw makeError('INVALID_ARGUMENT', 'title 必须为不超过 200 字符的字符串')
    }
    const sdk = this.ensureReady()
    const result = await sdk.session.create({ body: title ? { title } : undefined })
    if (result.error || !result.data) {
      throw mapHttpError(result, 'SESSION_CREATE_FAILED')
    }
    return toRuntimeSession(result.data)
  }

  async listSessions(): Promise<RuntimeSession[]> {
    const sdk = this.ensureReady()
    const result = await sdk.session.list()
    if (result.error || result.data === undefined) {
      throw mapHttpError(result, 'INTERNAL')
    }
    return result.data.map(toRuntimeSession)
  }

  async abortSession(sessionId: string): Promise<{ ok: true }> {
    const id = requireSessionId(sessionId)
    const sdk = this.ensureReady()
    const result = await sdk.session.abort({ path: { id } })
    if (result.error) throw mapHttpError(result, 'PROMPT_ABORTED')
    return { ok: true }
  }

  async deleteSession(sessionId: string): Promise<{ ok: true }> {
    const id = requireSessionId(sessionId)
    const sdk = this.ensureReady()
    const result = await sdk.session.delete({ path: { id } })
    if (result.error) throw mapHttpError(result, 'INTERNAL')
    return { ok: true }
  }

  /** feature-808：历史回放，裁剪为正文 + 推理 DTO（契约 §5.1/§5.2） */
  async getSessionMessages(sessionId: string): Promise<RuntimeSessionMessageRecord[]> {
    const id = requireSessionId(sessionId)
    const sdk = this.ensureReady()
    const result = await sdk.session.messages({ path: { id } })
    if (result.error || !result.data) throw mapHttpError(result, 'SESSION_NOT_FOUND')
    return result.data.map(toMessageRecord)
  }

  // -- prompt ----------------------------------------------------------------

  /** 异步：立即返回 {accepted,messageId}；流式过程经 SSE 事件观察 */
  async promptAsync(req: RuntimePromptRequest): Promise<{ accepted: true; messageId: string }> {
    const body = this.buildPromptBody(req)
    const sdk = this.ensureReady()
    const result = await sdk.session.promptAsync({ path: { id: body.sessionId }, body: body.body })
    if (result.error) throw mapHttpError(result, 'PROMPT_FAILED')
    const status = result.response?.status
    if (status !== undefined && status !== 204 && status !== 200 && status !== 202) {
      throw makeError('PROMPT_FAILED', `prompt_async 被拒绝（HTTP ${status}）`)
    }
    return { accepted: true as const, messageId: body.body.messageID! }
  }

  /** 同步等待完成：业务失败经 result.error 返回，不 reject */
  async prompt(req: RuntimePromptRequest): Promise<RuntimePromptResult> {
    const built = this.buildPromptBody(req)
    const sdk = this.ensureReady()
    const result = await sdk.session.prompt({ path: { id: built.sessionId }, body: built.body })

    if (result.error || !result.data) {
      // 404 / 连接层等通道级错误 → reject
      throw mapHttpError(result, 'PROMPT_FAILED')
    }
    const { info, parts } = result.data
    const text = parts
      .filter((p): p is Extract<Part, { type: 'text' }> => p.type === 'text' && !p.ignored)
      .map((p) => p.text)
      .join('')

    const base: RuntimePromptResult = { messageId: info.id, text, structured: null, error: null }

    // assistant message 自带错误（业务失败）→ result.error，不 reject
    if (info.error) {
      base.error = mapAssistantError(info.error)
      return base
    }

    if (built.body.format) {
      const parsed = tryParseStructured(text)
      if (parsed.ok) {
        base.structured = parsed.value
      } else {
        base.error = {
          code: 'STRUCTURED_OUTPUT_FAILED',
          message: '模型输出未通过 json_schema 结构化解析',
        }
      }
    }
    return base
  }

  // -- agent -----------------------------------------------------------------

  /** 仅暴露唯一 primary（showrunner）；subagent 与内置 agent 不向 renderer 开放 */
  async listAgents(): Promise<RuntimeAgent[]> {
    const sdk = this.ensureReady()
    const result = await sdk.app.agents()
    if (result.error || !result.data) throw mapHttpError(result, 'INTERNAL')

    return result.data
      .filter((a) => a.name === SHOWRUNNER_AGENT)
      .map((a) => {
        const enabledTools = Object.entries(a.tools ?? {})
          .filter(([, v]) => v === true)
          .map(([k]) => k)
        return {
          name: a.name,
          description: a.description ?? '',
          model: a.model ? { providerID: a.model.providerID, modelID: a.model.modelID } : null,
          // REST 在工具由 frontmatter 全量推导为 permission 时可能省略 tools map：
          // showrunner primary 以声明常量兜底（T8 真机回归）
          tools: enabledTools.length === 0 ? [...SHOWRUNNER_DECLARED_TOOLS] : enabledTools,
        } satisfies RuntimeAgent
      })
  }

  // -- 内部 ------------------------------------------------------------------

  private ensureReady(): SdkHandle {
    const conn = this.deps.getConnection()
    if (!conn) throw makeError('RUNTIME_NOT_READY', 'opencode 运行时未启动')
    const key = `${conn.baseUrl}|${conn.password}`
    if (!this.cached || this.cached.key !== key) {
      const factory = this.deps.factory ?? defaultSdkClientFactory
      this.cached = { key, handle: factory(conn) }
    }
    return this.cached.handle
  }

  /** 测试 / 重启后丢弃缓存句柄 */
  reset(): void {
    this.cached = null
  }

  private buildPromptBody(req: RuntimePromptRequest): {
    sessionId: string
    body: PromptBody
  } {
    if (!req || typeof req !== 'object') {
      throw makeError('INVALID_ARGUMENT', 'prompt 请求体缺失')
    }
    const sessionId = requireSessionId(req.sessionId)
    if (typeof req.text !== 'string' || req.text.trim().length === 0) {
      throw makeError('INVALID_ARGUMENT', 'text 必须为非空字符串')
    }

    // agent：唯一 primary 为 showrunner。
    // 三个 subagent 只能由 showrunner 经 task 调度，renderer 不可直连。
    let agent = SHOWRUNNER_AGENT
    if (req.agent !== undefined) {
      if (typeof req.agent !== 'string' || req.agent !== SHOWRUNNER_AGENT) {
        throw makeError(
          'INVALID_ARGUMENT',
          `agent 仅允许使用 ${SHOWRUNNER_AGENT}（subagent 不可直连）`,
        )
      }
      agent = req.agent
    }

    // model 覆盖：只能取已配置模型（ark 当前 ARK_MODEL 或测试用 mock-1）
    let model: RuntimeModelRef | undefined
    if (req.model !== undefined) {
      const m = req.model
      if (
        !m ||
        typeof m.providerID !== 'string' ||
        typeof m.modelID !== 'string' ||
        !m.providerID.trim() ||
        !m.modelID.trim()
      ) {
        throw makeError('INVALID_ARGUMENT', 'model 必须包含非空 providerID/modelID')
      }
      if (m.providerID === ARK_PROVIDER_ID) {
        if (!this.deps.allowedArkModel || m.modelID !== this.deps.allowedArkModel) {
          throw makeError('INVALID_ARGUMENT', 'model 只能指定当前已配置的 ark 模型')
        }
      } else if (m.providerID === LMSTUDIO_PROVIDER_ID) {
        if (!this.deps.allowedLmStudioModel || m.modelID !== this.deps.allowedLmStudioModel) {
          throw makeError('INVALID_ARGUMENT', 'model 只能指定当前已配置的 LM Studio 模型')
        }
      } else if (m.providerID === MOCK_PROVIDER_ID) {
        if (m.modelID !== MOCK_MODEL_ID) {
          throw makeError('INVALID_ARGUMENT', `mock 仅允许模型 ${MOCK_MODEL_ID}`)
        }
      } else {
        throw makeError('INVALID_ARGUMENT', 'provider 仅允许 ark、lmstudio 或 mock')
      }
      model = { providerID: m.providerID, modelID: m.modelID }
    }

    // tools：只能取 showrunner 已声明集合的子集
    let tools: Record<string, boolean> | undefined
    if (req.tools !== undefined) {
      if (!Array.isArray(req.tools) || req.tools.some((t) => typeof t !== 'string')) {
        throw makeError('INVALID_ARGUMENT', 'tools 必须为字符串数组')
      }
      const unique = new Set<string>()
      for (const t of req.tools) {
        // showrunner → 仅白名单内物理 ID（不含 task）
        if (!isShowrunnerDeclaredTool(t)) {
          throw makeError(
            'INVALID_ARGUMENT',
            `工具 ${t} 不在 ${agent} profile 已声明集合内`,
          )
        }
        unique.add(t)
      }
      tools = Object.fromEntries(Array.from(unique).map((t) => [t, true]))
    }

    // format：仅 json_schema
    let format: RuntimeStructuredFormat | undefined
    if (req.format !== undefined) {
      const f = req.format
      if (
        !f ||
        f.type !== 'json_schema' ||
        typeof f.schema !== 'object' ||
        f.schema === null
      ) {
        throw makeError('INVALID_ARGUMENT', 'format 必须为 { type:"json_schema", schema:object }')
      }
      if (
        f.retryCount !== undefined &&
        (typeof f.retryCount !== 'number' || f.retryCount < 0 || !Number.isFinite(f.retryCount))
      ) {
        throw makeError('INVALID_ARGUMENT', 'format.retryCount 必须为非负有限数')
      }
      format = { type: 'json_schema', schema: f.schema, ...(f.retryCount !== undefined ? { retryCount: f.retryCount } : {}) }
    }

    return {
      sessionId,
      body: {
        messageID: `msg_${crypto.randomUUID()}`,
        parts: [{ type: 'text', text: req.text }],
        agent,
        ...(model ? { model } : {}),
        ...(tools ? { tools } : {}),
        ...(format ? { format } : {}),
      },
    }
  }
}

// -- 辅助 ---------------------------------------------------------------------

function requireSessionId(sessionId: unknown): string {
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw makeError('INVALID_ARGUMENT', 'sessionId 必须为非空字符串')
  }
  return sessionId
}

function toRuntimeSession(s: Session): RuntimeSession {
  return {
    id: s.id,
    title: s.title ? s.title : null,
    createdAt: new Date(s.time.created).toISOString(),
  }
}

/**
 * D-012 白名单关键参数键表（归一化逻辑名 → 候选参数键，按优先级取首个非空字符串）。
 * ⚠ 与 src/lib/tool-labels.ts 的 ARG_PREVIEW_KEYS 同源镜像：改任一侧必须同步另一侧。
 */
const ARG_PREVIEW_KEYS: Record<string, readonly string[]> = {
  file_read: ['path'],
  file_list: ['dir'],
  file_write: ['path'],
  capture_upsert: ['topic', 'id'],
  capture_remove: ['id'],
  web_search: ['query'],
  web_fetch: ['url'],
  gate_request: ['title', 'gateId'],
  asset_register: ['path'],
  comfyui_queue: ['instanceId'],
  comfyui_status: ['jobId'],
  style_get: ['id'],
  manifest_advance: ['event'],
}

const ARG_PREVIEW_LIMIT = 80
const PHYSICAL_TOOL_PREFIX = 'shortdrama_'

/** D-012：从工具入参提取白名单关键参数摘要；无白名单 / 无非空字符串值 → ''（不落 DTO） */
export function toolArgsPreview(tool: string, input: unknown): string {
  if (!tool || typeof input !== 'object' || input === null) return ''
  const bare = tool.startsWith(PHYSICAL_TOOL_PREFIX) ? tool.slice(PHYSICAL_TOOL_PREFIX.length) : tool
  const keys = ARG_PREVIEW_KEYS[bare.replace(/\./g, '_')]
  if (!keys) return ''
  const record = input as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.length > ARG_PREVIEW_LIMIT ? `${value.slice(0, ARG_PREVIEW_LIMIT)}…` : value
    }
  }
  return ''
}

/**
 * feature-808 · session.messages 回放映射：白名单 part（text/reasoning/tool）透传，其余丢弃。
 * D-012：tool part 附加白名单关键参数摘要 argsPreview（完整入参/结果仍不回放）。
 * 纯映射，不含 fs/网络；坏数据不抛错（契约 §5.2 规则 1–3）。
 */
export function toMessageRecord(raw: {
  info: Message
  parts: Part[]
}): RuntimeSessionMessageRecord {
  const role = raw.info.role === 'assistant' ? 'assistant' : 'user'
  const id = typeof raw.info.id === 'string' ? raw.info.id : ''
  const parts: RuntimeSessionMessageRecord['parts'] = []
  for (const p of raw.parts) {
    if (p.type === 'tool') {
      const part: RuntimeSessionMessageRecord['parts'][number] = {
        type: 'tool',
        text: '',
        callId: p.callID,
        tool: p.tool,
        status: p.state.status,
        startedAt: 'time' in p.state && typeof p.state.time.start === 'number' ? p.state.time.start : 0,
      }
      if ('time' in p.state && 'end' in p.state.time && typeof p.state.time.end === 'number') {
        part.endedAt = p.state.time.end
      }
      if (p.state.status === 'error') part.error = p.state.error
      // D-012：白名单关键参数摘要（空串不落 DTO）
      const preview = toolArgsPreview(p.tool, (p.state as { input?: unknown }).input)
      if (preview) part.argsPreview = preview
      parts.push(part)
      continue
    }
    if (p.type !== 'text' && p.type !== 'reasoning') continue
    const part: RuntimeSessionMessageRecord['parts'][number] = {
      type: p.type,
      text: typeof p.text === 'string' ? p.text : '',
    }
    if (typeof p.time?.start === 'number') part.startedAt = p.time.start
    if (p.type === 'text') {
      if (p.ignored === true) part.ignored = true
      if (p.synthetic === true) part.synthetic = true
    }
    parts.push(part)
  }
  return { info: { id, role }, parts }
}

/** 上游 assistant message 错误 → RuntimeErrorCode（业务失败，不 reject） */
function mapAssistantError(error: NonNullable<AssistantMessage['error']>): {
  code: RuntimeErrorCode
  message: string
} {
  switch (error.name) {
    case 'ProviderAuthError':
      return { code: 'UPSTREAM_AUTH_MISSING', message: '上游 provider 认证缺失或失效（ARK_API_KEY）' }
    case 'MessageAbortedError':
      return { code: 'PROMPT_ABORTED', message: '消息已被中止' }
    default:
      return { code: 'PROMPT_FAILED', message: `模型响应失败：${error.name}` }
  }
}

/**
 * 通道级错误映射。message 不含任何上游原始串（防止凭证 / 内部细节外泄）。
 */
function mapHttpError(result: SdkResult<unknown>, fallback: RuntimeErrorCode): Error {
  const status = result.response?.status
  if (!status) {
    // 无响应：连接拒绝 / 进程已退 / 网络层失败
    return makeError('RUNTIME_NOT_READY', 'opencode 连接不可用')
  }
  if (status === 401) {
    return makeError('INTERNAL', 'opencode 本地认证失败')
  }
  if (status === 404) {
    return makeError('SESSION_NOT_FOUND', '会话不存在或已删除')
  }
  if (status === 400) {
    return makeError(fallback, 'opencode 返回请求错误（400）')
  }
  return makeError(fallback, `opencode 请求失败（HTTP ${status}）`)
}

/** 容忍模型把 JSON 包在 ```json 代码块里 */
function tryParseStructured(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim()
  const candidates = [trimmed]
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  if (fence) candidates.push(fence[1]!.trim())
  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) }
    } catch {
      // 试下一个候选
    }
  }
  return { ok: false }
}

function makeError(code: RuntimeErrorCode, message: string): Error {
  const err = new Error(message)
  err.name = code
  return err
}
