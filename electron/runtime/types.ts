// feature-008 · Agent 运行时 DTO（主进程侧）
// 严格匹配《SDG-RE-契约.md》§4 / §5；renderer 侧同构镜像见 src/lib/runtime-types.ts
// 共享层（shared/）只读，主 / renderer 两侧 DTO 镜像重复是 feature-008 契约既定做法。

export type RuntimeState = 'stopped' | 'starting' | 'running' | 'error'

export type RuntimeErrorCode =
  | 'INVALID_ARGUMENT'
  | 'RUNTIME_NOT_READY'
  | 'RUNTIME_START_FAILED'
  | 'RUNTIME_HEALTH_FAILED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_CREATE_FAILED'
  | 'PROMPT_FAILED'
  | 'PROMPT_ABORTED'
  | 'STRUCTURED_OUTPUT_FAILED'
  | 'UPSTREAM_AUTH_MISSING'
  | 'RUNTIME_UPSTREAM_ERROR'
  | 'PATH_ESCAPE_DENIED'
  | 'GATE_TIMEOUT'
  | 'INTERNAL'

export interface RuntimeErrorBody {
  code: RuntimeErrorCode
  message: string
}

export interface RuntimeStatus {
  state: RuntimeState
  /** 动态端口（4096 起探测）；仅供显示，不构成凭证；未运行时为 null */
  port: number | null
  version: string | null
  healthy: boolean
  /** ISO 8601 */
  startedAt: string | null
  error: RuntimeErrorBody | null
}

export interface RuntimeSession {
  id: string
  title: string | null
  /** ISO 8601 */
  createdAt: string
}

export interface RuntimeModelRef {
  providerID: string
  modelID: string
}

export interface RuntimeStructuredFormat {
  type: 'json_schema'
  schema: Record<string, unknown>
  retryCount?: number
}

export interface RuntimePromptRequest {
  sessionId: string
  text: string
  /** 默认 director */
  agent?: string
  /** 不传则用 profile 默认模型 */
  model?: RuntimeModelRef
  format?: RuntimeStructuredFormat
  /** 白名单覆盖：只能取所选用 profile 已声明工具集合的子集 */
  tools?: string[]
}

export interface RuntimePromptResult {
  messageId: string
  text: string
  structured: unknown | null
  /** 业务失败（如结构化校验失败）经此返回，不 reject */
  error: RuntimeErrorBody | null
}

export interface RuntimeAgent {
  name: string
  description: string
  model: RuntimeModelRef | null
  tools: string[]
}

/** 封闭联合：renderer 只认这六类，未识别 opencode 事件一律忽略不透传 */
export type RuntimeEvent =
  | { type: 'runtime.connected'; ts: string; version: string }
  | {
      type: 'message.delta'
      ts: string
      sessionId: string
      messageId: string
      /** 流轨：text=正文；reasoning=推理增量（来自 opencode delta 的 field 前缀） */
      track: 'text' | 'reasoning'
      delta: string
    }
  | {
      type: 'message.part'
      ts: string
      sessionId: string
      messageId: string
      /** opencode Part.id：同一 part 的多次快照共享，归约按此 replace（D-008） */
      partId: string
      part: {
        kind: 'text' | 'reasoning' | 'tool' | 'structured'
        text?: string
        tool?: string
        status?: 'running' | 'completed' | 'error'
      }
    }
  | {
      type: 'tool.call'
      ts: string
      sessionId: string
      messageId: string
      /** ToolPart.callID；关联同一调用的多次更新（缺失时回退 part.id） */
      callId: string
      tool: string
      status: 'running' | 'completed' | 'error'
      argsPreview: string
      resultPreview?: string
      /** 完整入参原对象（不截断；投递前经凭证打码） */
      args: unknown
      /**
       * completed：output 解析后的 ToolResultEnvelope 对象，无法识别时为原始字符串；
       * error：state.error 为可识别 ToolResultEnvelope（对象含 kind）时同样挂信封对象，否则不挂
       */
      result?: unknown
      /** error：完整错误文本（不截断）；与 result 可同时存在（结构化信封 + 同一错误原文串） */
      errorText?: string
      /** state.time.start（ms） */
      startedAt?: number
      /** state.time.end（ms） */
      endedAt?: number
    }
  | { type: 'session.idle'; ts: string; sessionId: string }
  | { type: 'runtime.error'; ts: string; sessionId?: string; error: RuntimeErrorBody }
