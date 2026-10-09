// feature-010 · renderer 侧 RuntimeEvent → 流式轮次归约（纯函数层）
// 严格匹配《SDG-RE-契约.md》§7.2：
// - 轮次边界 = session.idle：一次用户 prompt 在 showrunner 等多步 agent 下会产生
//   多个不同 messageId 的 assistant 消息（每个 LLM step 一条），running 期间这些
//   消息一律聚合进同一 turn，绝不按 messageId 互相丢弃（turn.messageId 保留首个）；
// - message.part 按 partId 快照 upsert（同 partId 整体 replace，绝不追加）；
// - message.delta 分轨累加进 deltaPreview，仅在该 track 尚无快照 part 时作预览；
// - tool.call 按 callId upsert（三态 + 入参 / 结果 / 错误 / 耗时）；
// - session.idle 定稿 done；runtime.error 定稿 error；
// - 不做副作用、不跨轮聚合；turn 为 null 时由 delta / part / tool 事件惰性建轮。
import type { ChatMessage } from '@shared/types'

import type { RuntimeEvent } from './runtime-types'

export interface ToolView {
  callId: string
  tool: string
  status: 'running' | 'completed' | 'error'
  args: unknown
  result?: unknown
  errorText?: string
  startedAt?: number
  endedAt?: number
}

export interface SnapshotPart {
  partId: string
  kind: 'text' | 'reasoning'
  /** 累积全量快照（同 partId 多次更新即覆盖到此值） */
  text: string
}

export interface StreamingTurn {
  messageId: string
  /** partId → 快照 part（插入顺序即首次出现顺序） */
  parts: Record<string, SnapshotPart>
  /** delta 预览：仅在该 track 尚无快照 part 时展示 */
  deltaPreview: { text: string; reasoning: string }
  tools: Record<string, ToolView>
  status: 'running' | 'done' | 'error'
}

function emptyTurn(messageId: string): StreamingTurn {
  return {
    messageId,
    parts: {},
    deltaPreview: { text: '', reasoning: '' },
    tools: {},
    status: 'running',
  }
}

function pickDefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T]
  }
  return out
}

/** 按 part 插入顺序取某一 kind 的快照全文拼接 */
function joinParts(turn: StreamingTurn, kind: 'text' | 'reasoning'): string {
  return Object.values(turn.parts)
    .filter(p => p.kind === kind)
    .map(p => p.text)
    .join('')
}

/**
 * 归约单个 RuntimeEvent 到当前轮次；返回新的不可变轮次对象。
 * turn=null 且事件尚不足以建轮（connected / idle / error）时返回 null。
 */
export function reduceRuntimeEvent(
  turn: StreamingTurn | null,
  event: RuntimeEvent,
): StreamingTurn | null {
  // 终态锁定（D-010）：done/error 后任何事件原样返回，不再翻转 / 更新。
  if (turn && turn.status !== 'running') return turn

  switch (event.type) {
    case 'runtime.connected':
      return turn

    case 'message.delta': {
      // 跨 messageId 聚合：running 期间所有 assistant step 的 delta 同归一轮
      const next = turn ?? emptyTurn(event.messageId)
      const key = event.track === 'reasoning' ? 'reasoning' : 'text'
      return {
        ...next,
        deltaPreview: { ...next.deltaPreview, [key]: next.deltaPreview[key] + event.delta },
      }
    }

    case 'message.part': {
      const next = turn ?? emptyTurn(event.messageId)
      if (event.part.kind !== 'text' && event.part.kind !== 'reasoning') return next
      // 快照 replace：同 partId 覆盖，绝不追加（D-008）
      const snapshot: SnapshotPart = {
        partId: event.partId,
        kind: event.part.kind,
        text: event.part.text ?? '',
      }
      return { ...next, parts: { ...next.parts, [event.partId]: snapshot } }
    }

    case 'tool.call': {
      const next = turn ?? emptyTurn(event.messageId)
      const prev = next.tools[event.callId]
      const view: ToolView = {
        callId: event.callId,
        tool: event.tool,
        status: event.status,
        args: event.args ?? prev?.args ?? {},
        ...pickDefined({
          result: event.result ?? prev?.result,
          errorText: event.errorText ?? prev?.errorText,
          startedAt: event.startedAt ?? prev?.startedAt,
          endedAt: event.endedAt ?? prev?.endedAt,
        }),
      }
      return { ...next, tools: { ...next.tools, [event.callId]: view } }
    }

    case 'session.idle':
      return turn ? { ...turn, status: 'done' } : null

    case 'runtime.error':
      return turn ? { ...turn, status: 'error' } : null
  }
}

/**
 * 轮次正文（流式展示 / 定稿共用）：
 * 有 text 快照 → 按插入顺序拼接快照；否则回退 deltaPreview.text。
 */
export function turnText(turn: StreamingTurn): string {
  const fromParts = joinParts(turn, 'text')
  return fromParts || turn.deltaPreview.text
}

/** 推理文本同理：有 reasoning 快照用快照，否则回退 deltaPreview.reasoning。 */
export function turnReasoning(turn: StreamingTurn): string {
  const fromParts = joinParts(turn, 'reasoning')
  return fromParts || turn.deltaPreview.reasoning
}

/**
 * 定稿轮次 → 共享层 ChatMessage 形态（id 用 messageId；正文按快照/预览优先级）。
 * 结构化工具产物不在此造正文：产物卡由 App 按 completed tool 的 envelope.product 经消息工厂另落。
 */
export function turnToChatMessage(turn: StreamingTurn): ChatMessage {
  return {
    id: turn.messageId,
    role: 'agent',
    kind: 'text',
    content: turnText(turn),
    ts: Date.now(),
  }
}
