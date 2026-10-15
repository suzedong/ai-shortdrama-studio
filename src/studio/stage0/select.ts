// feature-003 · STAGE 0 立项视图模型（纯函数层）
// 只投影 canvas 已落盘事实；禁止 fs / window.api / Date / 随机（契约 §2 规则 6）。
import type { Canvas, CanvasGate, CanvasNode, ProjectBrief } from '../../../shared/types'

export type Stage0Phase = 'empty' | 'published'

export interface Stage0State {
  /** 主态：无 done 的 brief 节点 = empty；有 = published */
  phase: Stage0Phase
  /** phase==='published' 时为 step-0-brief 节点（status 必为 done）；否则 null */
  briefNode: CanvasNode | null
  /** 0-final 门当前对象（gates 中 gateId==='0-final' 最后一个）；无则 null */
  gate0: CanvasGate | null
  /** 门是否待决（gate0?.status === 'pending'） */
  gatePending: boolean
  /** 全画布脏节点数（node.dirty 存在即计，feature-002 口径） */
  dirtyCount: number
  /** 黄条文案用：命中字段并集，去重保序 */
  dirtyFields: string[]
  /** 最新立项版本号：briefNode.meta.version 字符串解析（'v3'→3）；无法解析为 null */
  version: number | null
}

/** 真实发布链 upsert 的 brief 节点 id（dev 夹具的 n-brief 不进真实判定） */
export const BRIEF_NODE_ID = 'step-0-brief'

export function selectStage0State(canvas: Canvas): Stage0State {
  const briefNode = canvas.nodes.find(n => n.id === BRIEF_NODE_ID && n.status === 'done') ?? null

  let gate0: CanvasGate | null = null
  for (let i = canvas.gates.length - 1; i >= 0; i--) {
    if (canvas.gates[i].gateId === '0-final') {
      gate0 = canvas.gates[i]
      break
    }
  }

  const dirtyFields: string[] = []
  let dirtyCount = 0
  for (const node of canvas.nodes) {
    if (!node.dirty) continue
    dirtyCount += 1
    for (const f of node.dirty.fields) {
      if (!dirtyFields.includes(f)) dirtyFields.push(f)
    }
  }

  const rawVersion = briefNode?.meta?.version
  let version: number | null = null
  if (typeof rawVersion === 'string') {
    const m = /^v(\d+)$/i.exec(rawVersion)
    if (m) version = Number(m[1])
  }

  return {
    phase: briefNode ? 'published' : 'empty',
    briefNode,
    gate0,
    gatePending: gate0?.status === 'pending',
    dirtyCount,
    dirtyFields,
    version,
  }
}

// ===== 立项单解析（最小形状校验，不引 zod，契约 §3）=====

export type BriefParseResult =
  | { ok: true; brief: ProjectBrief }
  | { ok: false; reason: 'NOT_JSON' | 'UNSUPPORTED_SHAPE' }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function parseBriefJson(content: string): BriefParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { ok: false, reason: 'NOT_JSON' }
  }
  if (
    isObject(parsed)
    && parsed.schemaVersion === 2
    && Number.isInteger(parsed.version) && (parsed.version as number) >= 1
    && isObject(parsed.fiveElements)
    && isObject(parsed.premise)
    && isObject(parsed.style)
    && isObject(parsed.approve)
  ) {
    return { ok: true, brief: parsed as unknown as ProjectBrief }
  }
  return { ok: false, reason: 'UNSUPPORTED_SHAPE' }
}

// ===== 字段中文标签（与 CanvasBoard DIRTY_FIELD_LABELS 同源内容；该常量为模块私有，不跨文件抽公共）=====

/** 立项六要素 key 顺序 + 中文标签 */
export const FIVE_ELEMENT_FIELDS: { key: keyof ProjectBrief['fiveElements']; label: string }[] = [
  { key: 'genre', label: '题材赛道' },
  { key: 'platforms', label: '目标平台' },
  { key: 'episodeDuration', label: '单集时长' },
  { key: 'episodeCount', label: '集数' },
  { key: 'tone', label: '风格基调' },
  { key: 'aspectRatio', label: '画幅' },
]

/** 故事前提五项 key 顺序 + 中文标签 */
export const PREMISE_FIELDS: { key: keyof ProjectBrief['premise']; label: string }[] = [
  { key: 'leads', label: '人物' },
  { key: 'time', label: '时间' },
  { key: 'place', label: '地点' },
  { key: 'coreEvent', label: '核心事件' },
  { key: 'seasonBoundary', label: '本季边界' },
]

/** 脏字段路径 → 中文名（内容与 CanvasBoard DIRTY_FIELD_LABELS 保持一致） */
const DIRTY_FIELD_LABELS: Record<string, string> = {
  'fiveElements.episodeCount': '集数',
  'fiveElements.episodeDuration': '单集时长',
  'fiveElements.genre': '题材',
  'fiveElements.platforms': '平台',
  'fiveElements.tone': '基调',
  'fiveElements.aspectRatio': '画幅',
  'style.mainStyleId': '主风格',
  'style.catalogVersion': '谱系版本',
  'style.auxiliaryStyleId': '辅助风格',
  kind: '项目性质',
  diagnosisSummary: '诊断摘要',
  'premise.leads': '人物',
  'premise.time': '时间',
  'premise.place': '地点',
  'premise.coreEvent': '核心事件',
  'premise.seasonBoundary': '季边界',
}

export function dirtyFieldLabel(f: string): string {
  return DIRTY_FIELD_LABELS[f] ?? f
}
