// feature-008 · 立项过程链式呈现（纯函数层）
// 只消费 canvas 投影（Stage0State）与 capture 事实（CapturedFact）；禁止 fs / window.api / Date / 随机（契约 §2）。
import type { CapturedFact } from '../../../shared/types'
import type { Stage0State } from './select'

export type ChainGroup = 'six' | 'premise'

export interface ChainTopicMatch {
  group: ChainGroup
  /** canonical 键（契约 §1 表左列，如 'genre' / 'seasonBoundary'） */
  key: string
}

// ===== 词表（契约 §1 逐字；匹配词均为 trim + 英文小写化后的精确匹配项）=====

const SIX_GLOSSARY: { key: string; words: string[] }[] = [
  { key: 'genre', words: ['genre', '题材', '题材赛道'] },
  { key: 'platforms', words: ['platforms', '平台', '目标平台'] },
  { key: 'episodeDuration', words: ['episodeduration', '单集时长', '时长'] },
  { key: 'episodeCount', words: ['episodecount', '集数'] },
  { key: 'tone', words: ['tone', '风格基调', '基调'] },
  { key: 'aspectRatio', words: ['aspectratio', '画幅'] },
]

const PREMISE_GLOSSARY: { key: string; words: string[] }[] = [
  { key: 'leads', words: ['leads', '人物'] },
  { key: 'time', words: ['time', '时间'] },
  { key: 'place', words: ['place', '地点'] },
  { key: 'coreEvent', words: ['coreevent', '核心事件'] },
  { key: 'seasonBoundary', words: ['seasonboundary', '本季边界', '季边界'] },
]

/** topic 词表匹配；未命中返回 null */
export function matchChainTopic(topic: string): ChainTopicMatch | null {
  const t = topic.trim().toLowerCase()
  if (!t) return null
  for (const entry of SIX_GLOSSARY) {
    if (entry.words.includes(t)) return { group: 'six', key: entry.key }
  }
  for (const entry of PREMISE_GLOSSARY) {
    if (entry.words.includes(t)) return { group: 'premise', key: entry.key }
  }
  return null
}

// ===== 进度统计 =====

export interface ChainProgress {
  /** ① 已覆盖 canonical 键（去重，按契约 §1.1 表序） */
  sixCovered: string[]
  /** ② 已覆盖 canonical 键（去重，按契约 §1.2 表序） */
  premiseCovered: string[]
  /** 未命中词表的条数（计总数不计进度） */
  unmatchedCount: number
  /** 输入 facts 总条数 */
  totalFacts: number
}

export function selectChainProgress(facts: CapturedFact[]): ChainProgress {
  const six = new Set<string>()
  const premise = new Set<string>()
  let unmatchedCount = 0
  for (const fact of facts) {
    const m = matchChainTopic(fact.topic)
    if (!m) {
      unmatchedCount += 1
    } else if (m.group === 'six') {
      six.add(m.key)
    } else {
      premise.add(m.key)
    }
  }
  return {
    sixCovered: SIX_GLOSSARY.map(e => e.key).filter(k => six.has(k)),
    premiseCovered: PREMISE_GLOSSARY.map(e => e.key).filter(k => premise.has(k)),
    unmatchedCount,
    totalFacts: facts.length,
  }
}

// ===== 节点状态 =====

export type ChainStepStatus = 'idle' | 'collecting' | 'final'
export type ChainGateStatus = 'idle' | 'pending' | 'rejected' | 'published'

export interface ChainStepNode {
  status: ChainStepStatus
  /** 已覆盖数 x（status==='final' 时仍为实计值，呈现层不显示） */
  covered: number
  total: number
}

export interface ChainGateNode {
  status: ChainGateStatus
  /** published → state.version；pending → payload.version 守卫解析；不可得 / 其余态 → null */
  version: number | null
}

export interface ChainNodes {
  diag: ChainStepNode & { total: 6 }
  premise: ChainStepNode & { total: 5 }
  gate: ChainGateNode
}

function stepNode(status: ChainStepStatus, covered: number, total: number): ChainStepNode {
  return { status, covered, total }
}

export function selectChainNodes(state: Stage0State, facts: CapturedFact[]): ChainNodes {
  const progress = selectChainProgress(facts)
  const published = state.phase === 'published'
  const stepStatus = (covered: number): ChainStepStatus =>
    published ? 'final' : covered === 0 ? 'idle' : 'collecting'

  let gate: ChainGateNode
  if (published) {
    gate = { status: 'published', version: state.version }
  } else if (state.gate0?.status === 'pending') {
    gate = { status: 'pending', version: gatePayloadVersion(state.gate0.payload) }
  } else if (state.gate0?.status === 'rejected') {
    gate = { status: 'rejected', version: null }
  } else {
    gate = { status: 'idle', version: null }
  }

  return {
    diag: { ...stepNode(stepStatus(progress.sixCovered.length), progress.sixCovered.length, 6), total: 6 },
    premise: { ...stepNode(stepStatus(progress.premiseCovered.length), progress.premiseCovered.length, 5), total: 5 },
    gate,
  }
}

/** payload 最小形状守卫：isObject + Number.isInteger(version) + version>=1；否则 null */
export function gatePayloadVersion(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null
  const v = (payload as Record<string, unknown>).version
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1) return v
  return null
}
