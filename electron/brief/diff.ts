// feature-001 立项模型重建 · 立项单字段级 diff（契约 §5，纯函数）
// 比较范围：kind / fiveElements.*（platforms 排序后顿号串）/ premise.* /
//          style.mainStyleId、catalogVersion、auxiliaryStyleId / diagnosisSummary / diagnosisDetail（D-018）。
// 叶子统一转字符串比较；无上一版（prev===null）返回 []。
import type {
  BriefChange, BriefDraft, ProjectBrief,
} from '../../shared/types.js'

// 参与比较的叶子字段路径（顺序即 diff 输出顺序）
const ELEMENT_FIELDS = ['genre', 'episodeDuration', 'episodeCount', 'tone', 'aspectRatio'] as const
const PREMISE_FIELDS = ['leads', 'time', 'place', 'coreEvent', 'seasonBoundary'] as const
const STYLE_FIELDS = ['mainStyleId', 'catalogVersion', 'auxiliaryStyleId'] as const

/** 叶子值序列化为字符串（undefined / null → ''；数组排序后顿号连接） */
function leaf(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return [...value].map(v => String(v ?? '')).sort().join('、')
  return String(value)
}

/** 计算草案相对上一版立项单的字段改动；prev 为 null（首版）时返回 [] */
export function diffBrief(prev: ProjectBrief | null, draft: BriefDraft): BriefChange[] {
  if (!prev) return []
  const changes: BriefChange[] = []
  const push = (field: string, from: unknown, to: unknown): void => {
    const f = leaf(from)
    const t = leaf(to)
    if (f !== t) changes.push({ field, from: f, to: t })
  }

  push('kind', prev.kind, draft.kind)

  for (const f of ELEMENT_FIELDS) {
    push(`fiveElements.${f}`, prev.fiveElements[f], draft.fiveElements[f])
  }
  push('fiveElements.platforms', prev.fiveElements.platforms, draft.fiveElements.platforms)

  for (const f of PREMISE_FIELDS) {
    push(`premise.${f}`, prev.premise[f], draft.premise[f])
  }

  for (const f of STYLE_FIELDS) {
    push(`style.${f}`, prev.style[f], draft.style[f])
  }

  push('diagnosisSummary', prev.diagnosisSummary ?? '', draft.diagnosisSummary)
  push('diagnosisDetail', prev.diagnosisDetail ?? '', draft.diagnosisDetail)

  // feature-013：L0 元数据命名空间（tags 数组按整体值比对，口径同 fiveElements.platforms）
  // draft.l0 缺省 = 未提交（沿用上一版），不参与比较；显式给出（含清空后的空对象）才比对
  if (draft.l0 !== undefined) {
    push('l0.tags', prev.l0?.tags ?? [], draft.l0.tags)
    push('l0.notes', prev.l0?.notes ?? '', draft.l0.notes)
  }

  return changes
}
