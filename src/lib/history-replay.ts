import type { ChatItem } from '../studio/chat/ChatComposer'
import type { ToolView, TurnSegment } from './chat-runtime'

/** IPC runtime:session:messages 的单条记录（runtime-types 镜像，主进程从 SDK {info,parts} 映射） */
export interface ReplayMessageRecord {
  info: {
    id: string
    role: 'user' | 'assistant'
  }
  parts: ReplayPart[]
}

/** 回放消费正文、推理与工具状态；其余 part 类型不进 DTO（主进程侧丢弃，见契约 §5.2） */
export interface ReplayPart {
  type: 'text' | 'reasoning' | 'tool'
  text: string
  /** assistant part 的起始时间（ms）；用户文本无，pending tool 缺省时为 0 */
  startedAt?: number
  ignored?: boolean
  synthetic?: boolean
  callId?: string
  tool?: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  /** D-012：白名单关键参数摘要（主进程已截断；非白名单工具缺省） */
  argsPreview?: string
  endedAt?: number
  error?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * feature-808：把会话历史记录投影为右栏正文气泡、可选推理与工具状态（契约 §3，规则 H1–H8）。
 * B-56 起单遍扫描：按 parts 在消息内的原始顺序直接产出交错 segments
 * （推理 → 工具/结果 → 推理 → 工具/结果），不再先拆三类数组导致顺序丢失。
 * 纯函数：无副作用、不依赖时间/网络、不 mutate 入参；坏数据按无文本丢弃，不抛错。
 */
export function replayMessages(records: ReplayMessageRecord[]): ChatItem[] {
  // H8：非数组 → []
  if (!Array.isArray(records)) return []

  const items: ChatItem[] = []
  for (const raw of records) {
    // H8：坏记录不抛错，整体跳过
    if (!isRecord(raw) || !isRecord(raw.info)) continue
    const role = raw.info.role
    if (role !== 'user' && role !== 'assistant') continue
    const id = typeof raw.info.id === 'string' ? raw.info.id : ''
    const parts = Array.isArray(raw.parts) ? raw.parts : []

    // 单遍有序收集：texts 保留正文全文（气泡级选项/标签解析仍用全文），
    // segments 保留推理 / 正文 / 工具的交错顺序。
    const texts: string[] = []
    const segments: TurnSegment[] = []
    const toolIndexes = new Map<string, number>()
    let reasoningCount = 0

    for (const part of parts) {
      if (!isRecord(part)) continue
      if (part.ignored === true || part.synthetic === true) continue

      if (part.type === 'tool') {
        if (role !== 'assistant') continue
        const { callId, tool, status } = part
        if (typeof callId !== 'string' || callId.length === 0) continue
        if (typeof tool !== 'string' || tool.length === 0) continue
        if (status !== 'pending' && status !== 'running' && status !== 'completed' && status !== 'error') continue
        const snapshot: ToolView = {
          callId,
          tool,
          status,
          args: {},
          startedAt: typeof part.startedAt === 'number' ? part.startedAt : 0,
          ...(typeof part.endedAt === 'number' ? { endedAt: part.endedAt } : {}),
          ...(typeof part.error === 'string' ? { errorText: part.error } : {}),
          // D-012：白名单关键参数摘要透传（空串视同缺省）
          ...(typeof part.argsPreview === 'string' && part.argsPreview.length > 0
            ? { argsPreview: part.argsPreview }
            : {}),
        }
        const existing = toolIndexes.get(callId)
        if (existing === undefined) {
          toolIndexes.set(callId, segments.length)
          segments.push({ kind: 'tool', key: callId, tool: snapshot })
        } else {
          // 同 callId 多次快照：原地替换（顺序锚点不变）
          const old = segments[existing]
          if (old.kind === 'tool') segments[existing] = { ...old, tool: snapshot }
        }
        continue
      }

      if (typeof part.text !== 'string') continue
      if (part.type === 'reasoning') {
        // H：assistant 非空推理按出现位置落段
        if (role === 'assistant' && part.text.length > 0) {
          segments.push({ kind: 'reasoning', key: `r-${reasoningCount++}`, text: part.text })
        }
        continue
      }

      if (part.type !== 'text') continue
      // H3：assistant 仅聚合带 startedAt(number) 的文本 part；H2 用户不认 startedAt
      if (role === 'assistant' && typeof part.startedAt !== 'number') continue
      texts.push(part.text)
      if (part.text.length > 0) {
        segments.push({ kind: 'text', key: `t-${texts.length - 1}`, text: part.text })
      }
    }

    const text = texts.join('')
    if (role === 'user') {
      // H5：用户空文本丢弃
      if (text.length === 0) continue
      items.push({ id, role: 'user', text })
    } else {
      const hasContent = segments.some(s => s.kind !== 'text' || s.text.trim().length > 0)
      // H4（修订）：正文、reasoning、tools 三者全空才丢弃
      if (text.trim().length === 0 && !hasContent) continue
      // H6：segments 中工具仅含白名单 argsPreview，绝不带 brief/trace 或工具结果
      items.push({
        id,
        role: 'agent',
        ...(text ? { text } : {}),
        agent: 'showrunner',
        segments,
      })
    }
  }
  // H1：按入参正序输出，不重排
  return items
}
