// feature-002 立项后变更与影响评估 · 影响追溯纯函数 + electron 侧本地类型（契约 §1.3/§2）
// 同步、零 IO、零 LLM：diffBrief 的 Δ + canvas 谱系 → 分级影响清单。
import type { BriefChange, Canvas } from '../../shared/types.js'

export type ImpactSeverity = 'high' | 'medium'
export type ImpactDefaultAction = 'regenerate' | 'mark'
export type ImpactDecision = 'regenerate' | 'mark'

export interface ImpactItem {
  nodeId: string
  step: string
  title: string
  severity: ImpactSeverity
  fields: string[]                 // 命中 Δ 字段（交集）
  defaultAction: ImpactDefaultAction
}

export interface ImpactAssessment {
  fromVersion: number              // vN（最新已发布）
  toVersion: number                // v(N+1)
  changes: BriefChange[]
  items: ImpactItem[]              // 高在前、同级别按 step/id
  counts: { high: number; medium: number; total: number }
}

// commit 落盘的影响清单 JSON（契约 §3.1）
export interface ImpactReportFile {
  schemaVersion: 1
  kind: 'brief-impact-report'
  fromVersion: number
  toVersion: number
  committedAt: string              // ISO
  changes: BriefChange[]
  items: Array<ImpactItem & { decision: ImpactDecision }>
}

// 分级表（契约 §2.1）；数组顺序即命中字段输出顺序
const HIGH_FIELDS = [
  'premise.leads',
  'premise.time',
  'premise.place',
  'premise.coreEvent',
  'premise.seasonBoundary',
  'style.mainStyleId',
  'style.catalogVersion',
  'fiveElements.aspectRatio',
] as const

const MEDIUM_FIELDS = [
  'fiveElements.episodeCount',
  'fiveElements.episodeDuration',
  'fiveElements.genre',
  'fiveElements.tone',
  'fiveElements.platforms',
  'style.auxiliaryStyleId',
  'kind',
  'diagnosisSummary',
  'diagnosisDetail', // D-018：明细与摘要同缀 medium
] as const

// 全集顺序（high 表在前，medium 表在后）
const FIELD_ORDER: readonly string[] = [...HIGH_FIELDS, ...MEDIUM_FIELDS]

/** 字段分级；表外字段防御性归 low（不抛错） */
export function classifyField(field: string): ImpactSeverity | 'low' {
  if ((HIGH_FIELDS as readonly string[]).includes(field)) return 'high'
  if ((MEDIUM_FIELDS as readonly string[]).includes(field)) return 'medium'
  return 'low'
}

/** 逐字段分级；low 不入 Map */
export function classifyChanges(changes: BriefChange[]): Map<string, ImpactSeverity> {
  const level = new Map<string, ImpactSeverity>()
  for (const c of changes) {
    const sev = classifyField(c.field)
    if (sev !== 'low') level.set(c.field, sev)
  }
  return level
}

/**
 * 影响评估（契约 §2.3）：
 * 候选 = status done 且 parentReference.briefVersion===fromVersion；
 * hit = parentReference.fields ∩ Δ(level.keys)；hit 非空生成 ImpactItem。
 */
export function assessImpact(
  changes: BriefChange[],
  canvas: Canvas,
  fromVersion: number,
): ImpactAssessment {
  const level = classifyChanges(changes)
  const items: ImpactItem[] = []

  for (const n of canvas.nodes) {
    if (n.status !== 'done') continue
    const ref = n.parentReference
    if (!ref || ref.briefVersion !== fromVersion) continue

    const hit = FIELD_ORDER.filter(
      f => ref.fields.includes(f) && level.has(f),
    )
    if (hit.length === 0) continue

    const severity: ImpactSeverity = hit.some(f => level.get(f) === 'high')
      ? 'high'
      : 'medium'
    items.push({
      nodeId: n.id,
      step: n.step,
      title: n.title,
      severity,
      fields: hit,
      defaultAction: severity === 'high' ? 'regenerate' : 'mark',
    })
  }

  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    if (a.step !== b.step) return a.step < b.step ? -1 : 1
    return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0
  })

  const high = items.filter(i => i.severity === 'high').length
  const medium = items.filter(i => i.severity === 'medium').length
  return {
    fromVersion,
    toVersion: fromVersion + 1,
    changes,
    items,
    counts: { high, medium, total: items.length },
  }
}
