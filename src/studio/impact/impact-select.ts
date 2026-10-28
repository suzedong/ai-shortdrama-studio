// feature-011 · 影响评估面板纯函数层（契约 §1.2 / §5 T-①~T-④）
// 职责：两入口归一（updateBrief 返回值 / 影响清单文件）→ 同一视图模型；
//       分组（high / medium 保持原序）、默认勾选（defaultAction）、计数、批量模板消息。
// 架构铁律 C7：renderer 不得引用主进程目录（electron 侧），故类型在本文件结构本地定义（与主进程 impact.ts 同构）。
import type { BriefChange } from '@shared/types'

import { dirtyFieldLabel } from '../canvas/CanvasBoard'

export type ImpactSeverity = 'high' | 'medium'
export type ImpactDefaultAction = 'regenerate' | 'mark'
export type ImpactDecision = 'regenerate' | 'mark'

/** 面板消费的产物行（结构本地类型；decision 仅手动入口留痕展示，不参与勾选） */
export interface ImpactViewItem {
  nodeId: string
  step: string
  title: string
  severity: ImpactSeverity
  fields: string[]
  defaultAction: ImpactDefaultAction
  decision?: ImpactDecision
}

/** 两入口归一后的面板视图模型 */
export interface ImpactView {
  fromVersion: number
  toVersion: number
  changes: BriefChange[]
  items: ImpactViewItem[]
}

/** updateBrief 返回值中面板消费的子集（BriefUpdateResult 结构子集） */
export interface BriefUpdatePayload {
  version: number
  changes: BriefChange[]
  items: ImpactViewItem[]
}

/** 影响清单文件（ImpactReportFile）中面板消费的子集 */
export interface ImpactReportPayload {
  fromVersion: number
  toVersion: number
  changes: BriefChange[]
  items: ImpactViewItem[]
}

/** 自动弹出入口：再版返回值 → 视图模型（fromVersion = 新版本 - 1） */
export function fromUpdateResult(result: BriefUpdatePayload): ImpactView {
  const toVersion = result.version
  return {
    fromVersion: Math.max(1, toVersion - 1),
    toVersion,
    changes: result.changes,
    items: result.items.map(i => ({ ...i })),
  }
}

/** 黄条手动入口：影响清单文件 → 视图模型（版本对取自文件） */
export function fromReportFile(file: ImpactReportPayload): ImpactView {
  return {
    fromVersion: file.fromVersion,
    toVersion: file.toVersion,
    changes: file.changes,
    items: file.items.map(i => ({ ...i })),
  }
}

export interface ImpactGroup {
  severity: ImpactSeverity
  label: string
  items: ImpactViewItem[]
}

const GROUP_LABEL: Record<ImpactSeverity, string> = {
  high: '高优先级 · 必重生成',
  medium: '中优先级 · 可按需重生成',
}

/** 分组：high 在前、medium 在后，组内保持 items 原序；空组不出现 */
export function groupImpactItems(items: ImpactViewItem[]): ImpactGroup[] {
  const groups: ImpactGroup[] = []
  for (const severity of ['high', 'medium'] as const) {
    const inGroup = items.filter(i => i.severity === severity)
    if (inGroup.length > 0) {
      groups.push({ severity, label: GROUP_LABEL[severity], items: inGroup })
    }
  }
  return groups
}

/** 勾选态：nodeId → 布尔（初值 = defaultAction 映射：regenerate 预勾 / mark 不勾） */
export type ImpactSelection = Record<string, boolean>

export function defaultSelection(items: ImpactViewItem[]): ImpactSelection {
  const selection: ImpactSelection = {}
  for (const item of items) selection[item.nodeId] = item.defaultAction === 'regenerate'
  return selection
}

/** 当前勾选的 nodeId（按 items 原序） */
export function selectedNodeIds(items: ImpactViewItem[], selection: ImpactSelection): string[] {
  return items.filter(i => selection[i.nodeId]).map(i => i.nodeId)
}

// 摘要区着色词表：与主进程影响评估的 HIGH_FIELDS / MEDIUM_FIELDS 同源。
// renderer 不得引用主进程目录（feature-019 C7 架构铁律），故此处结构复制；
// 仅用于改动字段摘要的级别着色，不参与分组 / 默认勾选 / 计数等任何决策（决策唯一事实源 = defaultAction）。
const HIGH_CHANGE_FIELDS = new Set([
  'premise.leads',
  'premise.time',
  'premise.place',
  'premise.coreEvent',
  'premise.seasonBoundary',
  'style.mainStyleId',
  'style.catalogVersion',
  'fiveElements.aspectRatio',
])

const MEDIUM_CHANGE_FIELDS = new Set([
  'fiveElements.episodeCount',
  'fiveElements.episodeDuration',
  'fiveElements.genre',
  'fiveElements.tone',
  'fiveElements.platforms',
  'style.auxiliaryStyleId',
  'kind',
  'diagnosisSummary',
  'diagnosisDetail',
])

/** 改动字段级别（high / medium / neutral=表外低级，不入影响清单） */
export type ChangeLevel = 'high' | 'medium' | 'neutral'

export function changeLevel(field: string): ChangeLevel {
  if (HIGH_CHANGE_FIELDS.has(field)) return 'high'
  if (MEDIUM_CHANGE_FIELDS.has(field)) return 'medium'
  return 'neutral'
}

/**
 * 批量重生成模板消息（契约 T-④）：单条聚合，【产物重新对齐】前缀沿用 showrunner R-008 纪律；
 * 逐项携带 nodeId / title / 版本对 / 命中字段（中文名）。空选集返回空串（按钮在 N=0 时禁用）。
 */
export function buildBatchRealignPrompt(view: ImpactView, nodeIds: string[]): string {
  const picked = view.items.filter(i => nodeIds.includes(i.nodeId))
  if (picked.length === 0) return ''
  const lines = picked.map((item, idx) => {
    const fields = item.fields.map(dirtyFieldLabel).join('、')
    return `${idx + 1}. 产物「${item.title}」（节点 ${item.nodeId}，第 ${item.step} 步）当前基于立项 v${view.fromVersion}，与最新立项 v${view.toVersion} 不一致，命中字段：${fields}`
  })
  return [
    `【产物重新对齐】以下 ${picked.length} 个产物需按最新立项单 v${view.toVersion} 重新对齐（均基于 v${view.fromVersion}）：`,
    ...lines,
    `请按再版剧本第 6 步纪律串行委派专职 agent 逐产物重新生成（交接物写明旧产物基于 v${view.fromVersion}、命中字段），每个产物重生成定稿后调 shortdrama_canvas.align 清脏并推进血缘（nodeId 见上）。`,
  ].join('\n')
}
