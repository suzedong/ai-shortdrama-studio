// feature-008 · Agent 运行时 DTO（renderer 侧同构镜像）
// 与 electron/runtime/types.ts 逐字段一致（共享层只读约束下的镜像，契约 §2）；
// 改此文件必须同步主进程侧，字段 / 通道签名变更即 K8。

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
  | 'INTERNAL'

export interface RuntimeErrorBody {
  code: RuntimeErrorCode
  message: string
}

export interface RuntimeStatus {
  state: RuntimeState
  port: number | null
  version: string | null
  healthy: boolean
  startedAt: string | null
  error: RuntimeErrorBody | null
}

export interface RuntimeSession {
  id: string
  title: string | null
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
  agent?: string
  model?: RuntimeModelRef
  format?: RuntimeStructuredFormat
  tools?: string[]
}

export interface RuntimePromptResult {
  messageId: string
  text: string
  structured: unknown | null
  error: RuntimeErrorBody | null
}

export interface RuntimeAgent {
  name: string
  description: string
  model: RuntimeModelRef | null
  tools: string[]
}

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
      /** completed：output 解析后的 ToolResultEnvelope 对象，无法识别时为原始字符串 */
      result?: unknown
      /** error：完整错误文本（不截断） */
      errorText?: string
      /** state.time.start（ms） */
      startedAt?: number
      /** state.time.end（ms） */
      endedAt?: number
    }
  | { type: 'session.idle'; ts: string; sessionId: string }
  | { type: 'runtime.error'; ts: string; sessionId?: string; error: RuntimeErrorBody }
