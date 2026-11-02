// feature-010 · renderer 侧 RuntimeEvent → 流式轮次归约（纯函数层）
// 严格匹配《SDG-RE-契约.md》§7.2：
// - 轮次边界 = session.idle：一次用户 prompt 在 showrunner 等多步 agent 下会产生
//   多个不同 messageId 的 assistant 消息（每个 LLM step 一条），running 期间这些
//   消息一律聚合进同一 turn，绝不按 messageId 互相丢弃（turn.messageId 保留首个）；
// - message.part 按 partId 快照 upsert（同 partId 整体 replace，绝不追加）；
// - message.delta：B-54 起按事件 partId 分 part 累加进 deltaParts（同 partId 快照
//   到达后该 part 的 delta 清除）；partId 缺失时回退单一 deltaPreview 旧路径；
// - tool.call 按 callId upsert（三态 + 入参 / 结果 / 错误 / 耗时）；
// - B-56：timeline 按事件到达顺序记录 part / tool 首次出现，渲染层据此把
//   「推理 → 工具/结果 → 推理 → 工具/结果」交错呈现，不再固定三段式；
// - session.idle 定稿 done；runtime.error 定稿 error；
// - 不做副作用、不跨轮聚合；turn 为 null 时由 delta / part / tool 事件惰性建轮。
import type { ChatMessage } from '@shared/types'

import type { RuntimeEvent } from './runtime-types'

export interface ToolView {
  callId: string
  tool: string
  status: 'pending' | 'running' | 'completed' | 'error'
  args: unknown
  /** D-012：白名单关键参数摘要（历史回放由主进程供给；流式由渲染层从 args 现算，不落此字段） */
  argsPreview?: string
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

/** B-54：按 partId 累加的流式增量（快照到达前的可见态） */
export interface DeltaPart {
  kind: 'text' | 'reasoning'
  text: string
}

/** B-56：turn 内统一时间线条目；key = partId / callId */
export interface TurnTimelineEntry {
  kind: 'reasoning' | 'text' | 'tool'
  key: string
}

/** 渲染分段：timeline 解析后的有序内容（空内容条目由消费侧自行过滤） */
export type TurnSegment =
  | { kind: 'reasoning'; key: string; text: string }
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tool'; key: string; tool: ToolView }

export interface StreamingTurn {
  messageId: string
  /** partId → 快照 part（timeline 之外的存在顺序即首次出现顺序） */
  parts: Record<string, SnapshotPart>
  /** partId → delta 增量（同 partId 快照到达即清除）；partId 缺失的旧路径不进此表 */
  deltaParts: Record<string, DeltaPart>
  /** 旧路径回退：partId 缺失的 delta 仍按 track 累加于此 */
  deltaPreview: { text: string; reasoning: string }
  tools: Record<string, ToolView>
  /** B-56：part / tool 首次出现按事件到达有序记录 */
  timeline: TurnTimelineEntry[]
  status: 'running' | 'done' | 'error'
}

function emptyTurn(messageId: string): StreamingTurn {
  return {
    messageId,
    parts: {},
    deltaParts: {},
    deltaPreview: { text: '', reasoning: '' },
    tools: {},
    timeline: [],
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

/** part 当前文本：快照优先，否则取同 partId 增量 */
function partText(turn: StreamingTurn, partId: string): string {
  const snapshot = turn.parts[partId]
  if (snapshot) return snapshot.text
  return turn.deltaParts[partId]?.text ?? ''
}

/** 按 timeline 顺序取某一 kind 的全文拼接（含旧路径回退） */
function joinByTimeline(turn: StreamingTurn, kind: 'text' | 'reasoning'): string {
  const fromTimeline = turn.timeline
    .filter(e => e.kind === kind)
    .map(e => partText(turn, e.key))
    .join('')
  if (fromTimeline) return fromTimeline
  return turn.deltaPreview[kind]
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
      const kind: 'text' | 'reasoning' = event.track === 'reasoning' ? 'reasoning' : 'text'

      // B-54：有 partId → 按 part 累加并入 timeline；无 partId → 旧路径 deltaPreview
      if (event.partId) {
        const id = event.partId
        const prev = next.deltaParts[id]
        const deltaPart: DeltaPart = {
          kind,
          text: (prev?.kind === kind ? prev.text : '') + event.delta,
        }
        const timeline = next.timeline.some(e => e.key === id)
          ? next.timeline
          : [...next.timeline, { kind, key: id }]
        return { ...next, deltaParts: { ...next.deltaParts, [id]: deltaPart }, timeline }
      }

      const key = kind === 'reasoning' ? 'reasoning' : 'text'
      return {
        ...next,
        deltaPreview: { ...next.deltaPreview, [key]: next.deltaPreview[key] + event.delta },
      }
    }

    case 'message.part': {
      const next = turn ?? emptyTurn(event.messageId)
      if (event.part.kind !== 'text' && event.part.kind !== 'reasoning') return next
      const partKind: 'text' | 'reasoning' = event.part.kind
      // 快照 replace：同 partId 覆盖，绝不追加（D-008）
      const snapshot: SnapshotPart = {
        partId: event.partId,
        kind: partKind,
        text: event.part.text ?? '',
      }
      // B-54：快照已承载全量，清除同 partId 的 delta 增量（避免重复展示）
      const { [event.partId]: _removedDelta, ...restDeltas } = next.deltaParts
      // 快照类型权威：delta 先到且 track 误判时，校正同 key 条目的 kind
      const timeline = next.timeline.some(e => e.key === event.partId)
        ? next.timeline.map(e =>
            e.key === event.partId && e.kind !== partKind
              ? { ...e, kind: partKind }
              : e,
          )
        : [...next.timeline, { kind: partKind, key: event.partId }]
      return {
        ...next,
        parts: { ...next.parts, [event.partId]: snapshot },
        deltaParts: restDeltas,
        timeline,
      }
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
      const timeline = next.timeline.some(e => e.kind === 'tool' && e.key === event.callId)
        ? next.timeline
        : [...next.timeline, { kind: 'tool' as const, key: event.callId }]
      return { ...next, tools: { ...next.tools, [event.callId]: view }, timeline }
    }

    case 'session.idle':
      return turn ? { ...turn, status: 'done' } : null

    case 'runtime.error':
      return turn ? { ...turn, status: 'error' } : null
  }
}

/**
 * 轮次正文（流式展示 / 定稿共用）：
 * 按 timeline 顺序拼接 text part（快照优先、delta 兜底）；全空时回退旧路径 deltaPreview.text。
 */
export function turnText(turn: StreamingTurn): string {
  return joinByTimeline(turn, 'text')
}

/**
 * 分段推理（B-54/B-56：一个 turn 内 推理→工具→再推理 的多段思维链）：
 * 按 timeline 顺序逐段取 reasoning part 文本（快照 ?? 同 partId delta），空段过滤；
 * timeline 无 reasoning 时回退旧路径单段 deltaPreview.reasoning。
 */
export function turnReasoningBlocks(turn: StreamingTurn): string[] {
  const blocks = turn.timeline
    .filter(e => e.kind === 'reasoning')
    .map(e => partText(turn, e.key))
    .filter(text => text.length > 0)
  if (blocks.length > 0) return blocks
  return turn.deltaPreview.reasoning ? [turn.deltaPreview.reasoning] : []
}

/**
 * B-56：按 timeline 解析出有序渲染分段（reasoning / text / tool 交错）。
 * reasoning / text 空字符串条目跳过；旧路径（无 partId 的 delta）在 timeline 为空时
 * 合成单段；tool 条目始终保留（状态变化也要显示）。
 */
export function turnSegments(turn: StreamingTurn): TurnSegment[] {
  const segments: TurnSegment[] = []
  for (const entry of turn.timeline) {
    if (entry.kind === 'tool') {
      const tool = turn.tools[entry.key]
      if (tool) segments.push({ kind: 'tool', key: entry.key, tool })
    } else {
      const text = partText(turn, entry.key)
      if (text.length > 0) segments.push({ kind: entry.kind, key: entry.key, text })
    }
  }
  if (segments.length > 0) return segments
  // 旧路径回退：deltaPreview（无 partId 的运行时版本）
  if (turn.deltaPreview.reasoning) {
    segments.push({ kind: 'reasoning', key: '__legacy_reasoning', text: turn.deltaPreview.reasoning })
  }
  if (turn.deltaPreview.text) {
    segments.push({ kind: 'text', key: '__legacy_text', text: turn.deltaPreview.text })
  }
  return segments
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
