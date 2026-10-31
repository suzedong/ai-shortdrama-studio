import type { ChatItem } from '../studio/chat/ChatComposer'
import type { ToolView } from './chat-runtime'

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

    const texts: string[] = []
    const reasonings: string[] = []
    const tools: ToolView[] = []
    const toolIndexes = new Map<string, number>()
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
          toolIndexes.set(callId, tools.length)
          tools.push(snapshot)
        } else {
          tools[existing] = snapshot
        }
        continue
      }
      if (typeof part.text !== 'string') continue
      if (part.type === 'reasoning') {
        if (role === 'assistant') reasonings.push(part.text)
        continue
      }
      if (part.type !== 'text') continue
      // H3：assistant 仅聚合带 startedAt(number) 的文本 part；H2 用户不认 startedAt
      if (role === 'assistant' && typeof part.startedAt !== 'number') continue
      texts.push(part.text)
    }

    const text = texts.join('')
    if (role === 'user') {
      // H5：用户空文本丢弃
      if (text.length === 0) continue
      items.push({ id, role: 'user', text })
    } else {
      // H4：assistant trim 后为空（纯工具轮 / abort / 仅 reasoning）丢弃
      if (text.trim().length === 0) continue
      const reasoning = reasonings.join('')
      // H6：仅 id/role/text/agent 与可选 reasoning/tools，绝不带 brief/trace 或工具结果；
      // D-012 起工具参数仅放行主进程白名单摘要 argsPreview（关键字段、已截断），完整入参仍不回放
      items.push({
        id,
        role: 'agent',
        text,
        agent: 'showrunner',
        ...(reasoning ? { reasoning } : {}),
        ...(tools.length > 0 ? { tools } : {}),
      })
    }
  }
  // H1：按入参正序输出，不重排
  return items
}
