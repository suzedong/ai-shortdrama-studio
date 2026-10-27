import type { ChatItem } from '../studio/chat/ChatComposer'

/** IPC runtime:session:messages 的单条记录（runtime-types 镜像，主进程从 SDK {info,parts} 映射） */
export interface ReplayMessageRecord {
  info: {
    id: string
    role: 'user' | 'assistant'
  }
  parts: ReplayPart[]
}

/** 回放仅消费文本 part；其余 part 类型不进 DTO（主进程侧丢弃，见契约 §5.2） */
export interface ReplayPart {
  type: 'text'
  text: string
  /** assistant 文本 part 的起始时间（ms）；用户文本 part 无此值 */
  startedAt?: number
  ignored?: boolean
  synthetic?: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * feature-808：把会话历史记录投影为右栏文本气泡（契约 §3，规则 H1–H8）。
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
    for (const part of parts) {
      if (!isRecord(part)) continue
      if (part.type !== 'text') continue
      if (part.ignored === true || part.synthetic === true) continue
      // H3：assistant 仅聚合带 startedAt(number) 的文本 part；H2 用户不认 startedAt
      if (role === 'assistant' && typeof part.startedAt !== 'number') continue
      if (typeof part.text !== 'string') continue
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
      // H6：仅 id/role/text/agent，绝不带 brief/trace
      items.push({ id, role: 'agent', text, agent: 'showrunner' })
    }
  }
  // H1：按入参正序输出，不重排
  return items
}
