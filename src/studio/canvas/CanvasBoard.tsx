// feature-020 · 多步画布（契约 §3、设计说明 §2）
// DAG 形态（对齐原型 #viewDag）：CanvasNode 无坐标，只有 step；
// renderer 按 step 分列自动布局，列内纵向排布，SVG 贝塞尔边按源节点状态三态着色；
// 支持缩放/平移与右下角小地图。renderer 不推导业务状态，状态一律取自 canvas 数据。
// 有 ref.path 的节点可点击打开只读查看器
// feature-023 · 流程导航 STAGE 高亮（命中 step 的列染色 + 列标签加粗 + 节点描边）
// feature-026 · 节点卡底部操作行（hover/selected 可见）：查看 / 重新生成 / 复制 / 标记失效
// feature-027 · 节点可拖拽改位（仅本列内会话态摆位，不写盘；越界警告并回弹）
// feature-027 补 · 右键上下文菜单（节点：查看/重新生成/复制路径/标记失效；空白：适应画布）
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Canvas, CanvasEdge, CanvasNode, StepId } from '@shared/types'

import { driftDays, driftReminderLabel } from './dirty-drift'

export type NodeAction = 'view' | 'regen' | 'copy' | 'invalidate'

// 节点只能在所属 step 列内会话态摆位，override 不携带 step（业务禁止跨步骤）
interface NodeOverride { x: number; y: number }

// ── 布局常量（世界坐标 px） ────────────────────────────────
const NODE_W = 168
const NODE_H = 118
const COL_GAP = 56 // 列间距（边的走向空间）
const ROW_GAP = 26 // 同列节点纵向间距
const PAD_X = 28
const PAD_Y = 28

// feature-027 补 · 对齐参考线 + 自动吸附（对齐原型 rx-card ③ [改编]）
// axis：v/h 为竖向/横向对齐线（pos 为线的世界坐标）；
// ev/eh 为垂直/水平等距分布参考（两条间隙线 posA/posB + 跨距 spanA/spanB）
interface SnapGuide {
  axis: 'v' | 'h' | 'ev' | 'eh'
  pos: number
  label: string
  posB?: number
  spanA?: number
  spanB?: number
}
interface SnapResult { x: number; y: number; guides: SnapGuide[]; snapped: boolean }

const ALIGN_THRESHOLD = 8 // 对齐吸附阈值
const SPACE_THRESHOLD = 16 // 等距吸附阈值（原型 rx-card：垂直等距 16px）

// 候选线：其他节点的 左/中/右（x 轴）与 上/中/下（y 轴），逐轴取最近且在阈值内的一条
export function snapNode(
  x: number, y: number, others: { x: number; y: number }[],
  threshold = ALIGN_THRESHOLD,
): SnapResult {
  const guides: SnapGuide[] = []
  const tryAxis = (axis: 'v' | 'h', raw: number): number => {
    let best = Infinity
    let bestPos = raw
    let bestLine = raw
    let bestLabel = ''
    for (const o of others) {
      const cand = axis === 'v'
        ? [
            { p: o.x, l: '左对齐' },
            { p: o.x + NODE_W / 2, l: '中线对齐' },
            { p: o.x + NODE_W, l: '右对齐' },
          ]
        : [
            { p: o.y, l: '上对齐' },
            { p: o.y + NODE_H / 2, l: '中线对齐' },
            { p: o.y + NODE_H, l: '下对齐' },
          ]
      const dragC = axis === 'v'
        ? [{ p: raw, off: 0 }, { p: raw + NODE_W / 2, off: -NODE_W / 2 }, { p: raw + NODE_W, off: -NODE_W }]
        : [{ p: raw, off: 0 }, { p: raw + NODE_H / 2, off: -NODE_H / 2 }, { p: raw + NODE_H, off: -NODE_H }]
      for (const c of cand) {
        for (const d of dragC) {
          const dist = Math.abs(d.p - c.p)
          if (dist < best && dist <= threshold) {
            best = dist
            bestPos = c.p + d.off
            bestLine = c.p
            bestLabel = c.l
          }
        }
      }
    }
    if (best <= threshold) {
      guides.push({ axis, pos: bestLine, label: bestLabel })
      return bestPos
    }
    return raw
  }
  const sx = tryAxis('v', x)
  const sy = tryAxis('h', y)
  // 等距分布（三节点）：被拖节点 + 两个同走向参考节点，拖到两间隙相等时吸附
  const ev = equalSpace('ev', sy, sx, others)
  const eh = ev ? null : equalSpace('eh', sx, sy, others)
  const fx = eh ? eh.pos : sx
  const fy = ev ? ev.pos : sy
  if (ev) guides.push(ev.guide)
  if (eh) guides.push(eh.guide)
  return { x: fx, y: fy, guides, snapped: guides.length > 0 }
}

// 等距分布吸附。dir='ev' 求被拖节点的理想 y（间隙沿纵向，要求 x 同列相近）；
// dir='eh' 求理想 x（间隙沿横向，要求 y 相近）。仅在 SPACE_THRESHOLD 内吸附。
// 设两个参考节点顶边为 a < b、同走向尺寸 size，节距 d = b - a。
// 被拖节点延续节距 d 位于参考对 外侧（上 a-d / 下 b+d）时等间隙 gap = d - size；
// 位于两参考之间（a + d/2）时两半各留间隙 gap = d/2 - size。
function equalSpace(
  dir: 'ev' | 'eh',
  rawAlong: number,
  rawCross: number,
  others: { x: number; y: number }[],
): { pos: number; guide: SnapGuide } | null {
  const size = dir === 'ev' ? NODE_H : NODE_W
  // 垂直等距仅在同列节点间触发（x 中线间距 ≤ COL_GAP），水平等距放宽到行高
  const crossNear = dir === 'ev' ? COL_GAP : NODE_H
  const near = others.filter(o => {
    const crossA = dir === 'ev' ? o.x + NODE_W / 2 : o.y + NODE_H / 2
    const crossD = dir === 'ev' ? rawCross + NODE_W / 2 : rawCross + NODE_H / 2
    return Math.abs(crossA - crossD) <= crossNear
  })
  let best = Infinity
  let ideal = rawAlong
  let bestA = 0
  let bestB = 0
  let bestGap = 0
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const p1 = dir === 'ev' ? near[i].y : near[i].x
      const p2 = dir === 'ev' ? near[j].y : near[j].x
      const a = Math.min(p1, p2)
      const b = Math.max(p1, p2)
      const d = b - a
      if (d < size) continue // 参考对重叠，不构成等距
      // 被拖节点位于参考对 上方 / 下方（延续节距 d）/ 中间（节距 d/2）
      const cands: { c: number; gap: number }[] = [
        { c: a - d, gap: d - size },
        { c: b + d, gap: d - size },
      ]
      if (d >= 2 * size) cands.push({ c: a + d / 2, gap: d / 2 - size })
      for (const { c, gap } of cands) {
        const dist = Math.abs(c - rawAlong)
        if (dist < best && dist <= SPACE_THRESHOLD) {
          best = dist
          ideal = c
          bestA = a
          bestB = b
          bestGap = gap
        }
      }
    }
  }
  if (best > SPACE_THRESHOLD) return null
  // 三节点等距，参考线画在两条间隙的中点（pos/posB）
  const sorted = [ideal, bestA, bestB].sort((u, v) => u - v)
  const mid1 = (sorted[0] + size + sorted[1]) / 2
  const mid2 = (sorted[1] + size + sorted[2]) / 2
  const gap = Math.round(bestGap)
  const guide: SnapGuide = dir === 'ev'
    ? { axis: 'ev', pos: mid1, posB: mid2, spanA: NODE_W, label: `垂直等距 ${gap}px` }
    : { axis: 'eh', pos: mid1, posB: mid2, spanA: NODE_H, label: `水平等距 ${gap}px` }
  return { pos: ideal, guide }
}

// ── 视觉元数据 ────────────────────────────────────────────
const STATUS_META: Record<CanvasNode['status'], { label: string; dot: string }> = {
  pending: { label: '待生成', dot: 'bg-[#C9CCDA]' },
  active: { label: '进行中', dot: 'bg-violet pulse' },
  done: { label: '已完成', dot: 'bg-ok' },
  invalidated: { label: '已失效', dot: 'bg-bad' },
}

const KIND_LABEL: Record<string, string> = {
  diagnosis: '选题诊断',
  'visual-style': '视觉风格',
  brief: '立项单',
  outline: '故事大纲',
  profiles: '人物小传',
  scenes: '第一集分场',
  dialogue: '第一集台词',
  storyboard: '分镜表',
  shot: '镜头',
  timeline: '粗剪时间线',
  final: '成片交付',
}

const STEP_LABEL: Record<string, string> = {
  '0': '立项',
  '1': '故事',
  '2': '剧本分场',
  '3': '资产',
  '4': '分镜',
  '5': '镜头',
  '6': '后期',
  '7': '发布',
}

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind
}

function stepLabel(step: string): string {
  return STEP_LABEL[step] ?? `步骤 ${step}`
}

export { kindLabel }

// feature-002 · dirty 命中字段 → 中文名（措辞与契约 §2.1/§6 同源）
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
  diagnosisDetail: '诊断明细', // D-018
  'premise.leads': '人物',
  'premise.time': '时间',
  'premise.place': '地点',
  'premise.coreEvent': '核心事件',
  'premise.seasonBoundary': '季边界',
}

// feature-004：加 export 供 BriefHistoryView 差异摘要条复用（契约 §1 复用表；本体零改动）
export function dirtyFieldLabel(f: string): string {
  return DIRTY_FIELD_LABELS[f] ?? f
}

function dirtyTitle(d: NonNullable<CanvasNode['dirty']>): string {
  return `基于 v${d.sinceBriefVersion}，与最新 v${d.latestBriefVersion} 不一致：${d.fields.map(dirtyFieldLabel).join('、')}`
}

interface Positioned {
  node: CanvasNode
  x: number
  y: number
}

interface LaidOut {
  items: Positioned[]
  byId: Map<string, Positioned>
  cols: { step: StepId; x: number; top: number; height: number; count: number }[]
  width: number
  height: number
}

// 按 step 首次出现顺序分列，列内节点纵向排布，列相对于最高列垂直居中
// feature-027 · overrides 仅覆盖本列内摆位（会话态，不改变 step；越界由拖拽层判非法）
function layout(nodes: CanvasNode[], overrides: Map<string, NodeOverride>): LaidOut {
  // 收集所有出现过的 step（按首次出现顺序）
  const steps: StepId[] = []
  for (const n of nodes) {
    if (!steps.includes(n.step)) steps.push(n.step)
  }
  const colHeights = steps.map(s => {
    const count = nodes.filter(n => n.step === s && !overrides.has(n.id)).length
    return { step: s, count, height: count * NODE_H + (count - 1) * ROW_GAP }
  })
  const maxHeight = Math.max(0, ...colHeights.map(c => c.height))
  const width = PAD_X * 2 + steps.length * NODE_W + (steps.length - 1) * COL_GAP
  const height = PAD_Y * 2 + maxHeight

  const items: Positioned[] = []
  const cols = colHeights.map((c, i) => {
    const x = PAD_X + i * (NODE_W + COL_GAP)
    const top = PAD_Y + (maxHeight - c.height) / 2
    nodes.filter(n => n.step === c.step && !overrides.has(n.id)).forEach((node, j) => {
      items.push({ node, x, y: top + j * (NODE_H + ROW_GAP) })
    })
    return { step: c.step, x, top, height: c.height, count: c.count }
  })
  // 应用 overrides
  for (const n of nodes) {
    const ov = overrides.get(n.id)
    if (!ov) continue
    items.push({ node: n, x: ov.x, y: ov.y })
  }
  return { items, byId: new Map(items.map(p => [p.node.id, p])), cols, width, height }
}

// 边的视觉态取自源节点（done 绿实 / active 紫虚流动 / 其余 灰）
type EdgeVisual = 'done' | 'active' | 'idle'

function edgeVisual(edge: CanvasEdge, byId: Map<string, Positioned>): EdgeVisual {
  const from = byId.get(edge.from)?.node.status
  if (from === 'done') return 'done'
  if (from === 'active') return 'active'
  return 'idle'
}

function edgePath(edge: CanvasEdge, byId: Map<string, Positioned>): string | null {
  const a = byId.get(edge.from)
  const b = byId.get(edge.to)
  if (!a || !b) return null
  const x1 = a.x + NODE_W
  const y1 = a.y + NODE_H / 2
  const x2 = b.x
  const y2 = b.y + NODE_H / 2
  const dx = Math.max(20, (x2 - x1) / 2)
  return `M${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

const EDGE_STYLE: Record<EdgeVisual, { stroke: string; cls: string; marker: 'arr' | 'arrV' }> = {
  done: { stroke: '#A8DFC6', cls: '', marker: 'arr' },
  active: { stroke: '#6C5CE7', cls: 'dag-edge-active', marker: 'arrV' },
  idle: { stroke: '#C7CBDD', cls: '', marker: 'arr' },
}

interface Props {
  canvas: Canvas
  // 有 ref.path 的节点可点击打开只读查看器
  onOpenNode?: (node: CanvasNode) => void
  // feature-023：流程导航 STAGE 高亮（命中 step 的列染色 + 列标签加粗 + 节点描边）
  activeStep?: string | null
  // feature-026：节点卡底部操作行（查看/重新生成/复制/标记失效）；不传则不渲染
  onNodeAction?: (action: NodeAction, node: CanvasNode) => void
  // feature-027：拖拽松手回调。illegal=true 表示曾拖出本列，画布已回弹，上层补警告 toast
  onDropped?: (info: { nodeId: string; illegal: boolean }) => void
}

export default function CanvasBoard({ canvas, onOpenNode, activeStep, onNodeAction, onDropped }: Props) {
  const { nodes, edges } = canvas
  const uid = useId().replace(/[:]/g, '')
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: PAD_X, y: PAD_Y })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [vp, setVp] = useState({ w: 0, h: 0 })
  // feature-027 · 拖拽 override（仅本列内摆位，会话态不写盘；拖出本列松手即清除回弹）
  const [overrides, setOverrides] = useState<Map<string, NodeOverride>>(() => new Map())
  const [dragId, setDragId] = useState<string | null>(null)
  // feature-027 补 · 拖拽中的吸附参考线（世界坐标，最多每轴一条）
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const isDragging = dragId != null
  // feature-027 补 · 右键上下文菜单（节点菜单 / 空白菜单），坐标为视口 client
  const [menu, setMenu] = useState<{ x: number; y: number; node: CanvasNode | null } | null>(null)

  const laid = useMemo(() => layout(nodes, overrides), [nodes, overrides])
  // feature-002 · 脏读：挂 dirty 的产物节点（brief 节点自身不挂脏）
  const dirtyNodes = useMemo(() => nodes.filter(n => n.dirty), [nodes])
  const dirtyLatest = dirtyNodes.reduce((m, n) => Math.max(m, n.dirty!.latestBriefVersion), 0)
  // feature-806 · B-46 漂移提醒：聚合态取各脏节点漂移天数 max（无 markedAt 按 0），超 30 天黄条追加一行（不阻塞）
  const dirtyDriftLabel = driftReminderLabel(
    dirtyNodes.reduce((m, n) => Math.max(m, driftDays(n.dirty!.markedAt) ?? 0), 0),
  )

  // 初始：保可读缩放（0.65 下限），从 STAGE 0 左侧开始，垂直居中；超出部分可横向拖动
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el || nodes.length === 0) return
    const r = el.getBoundingClientRect()
    setVp({ w: r.width, h: r.height })
    const z = clampZoom(Math.max(0.65, Math.min((r.height - 112) / laid.height, 1)))
    setZoom(z)
    setPan({ x: 24, y: (r.height - laid.height * z) / 2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length])

  // 选中态默认落在首个进行中节点（无则不选），与原型选中态一致
  useEffect(() => {
    setSelectedId(nodes.find(n => n.status === 'active')?.id ?? null)
  }, [nodes])

  // zoom/pan 的最新值同步到 ref：供事件回调读取，避免把 zoom 放进 effect 依赖
  // 造成「滚轮缩放时 STAGE 居中 effect 抢占 pan」以及非纯 updater 的 StrictMode 双调用问题
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  zoomRef.current = zoom
  panRef.current = pan

  // 流程导航 STAGE 联动：仅 activeStep 切换时把对应列水平居中到视口（缩放/平移不触发）
  useEffect(() => {
    if (activeStep == null) return
    const el = viewportRef.current
    if (!el) return
    const col = laid.cols.find(c => c.step === activeStep)
    if (!col) return
    const r = el.getBoundingClientRect()
    setVp({ w: r.width, h: r.height })
    const colCenterX = col.x + NODE_W / 2
    setPan(p => ({ x: r.width / 2 - colCenterX * zoomRef.current, y: p.y }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep])

  // 视口尺寸（窗口缩放、侧栏面板伸缩）实时同步：鸟瞰取景框与缩放锚点依赖 vp
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const sync = () => {
      const r = el.getBoundingClientRect()
      setVp({ w: r.width, h: r.height })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [nodes.length])

  const clampZoom = useCallback((z: number) => Math.min(1.6, Math.max(0.25, Math.round(z * 100) / 100)), [])

  // fit：整幅 DAG 含边距放入视口；minZ 给下限时允许超出（配合平移），
  // 初始载入保可读性，缩放百分比按钮才真正全览
  const fitView = useCallback((minZ = 0.25) => {
    const el = viewportRef.current
    if (!el || nodes.length === 0) return
    const r = el.getBoundingClientRect()
    setVp({ w: r.width, h: r.height })
    const pad = 56
    const z = clampZoom(Math.max(minZ, Math.min((r.width - pad * 2) / laid.width, (r.height - pad * 2) / laid.height, 1)))
    setZoom(z)
    setPan({ x: (r.width - laid.width * z) / 2, y: (r.height - laid.height * z) / 2 })
  }, [clampZoom, laid.height, laid.width, nodes.length])

  // 以视口点 (cx,cy) 为锚点缩放：直接读 ref 中的当前 zoom/pan 同步计算。
  // 不得在 setZoom 的 updater 内调用 setPan（updater 必须纯函数，StrictMode
  // 开发态会双调用 updater，导致 pan 以旧锚点被套用两次而纵向漂移失锚）。
  const zoomAt = useCallback((next: number, cx: number, cy: number) => {
    const z0 = zoomRef.current
    const p = panRef.current
    const z = clampZoom(next)
    if (z === z0) return
    setZoom(z)
    setPan({ x: cx - ((cx - p.x) * z) / z0, y: cy - ((cy - p.y) * z) / z0 })
  }, [clampZoom])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const el = viewportRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    zoomAt(zoomRef.current * factor, e.clientX - r.left, e.clientY - r.top)
  }, [zoomAt])

  // 拖拽平移：仅在画布空白（viewport/world 本身）按下时发起，
  // 节点上按下不启动拖拽，保证节点 click（打开查看器）不被 pointer capture 吞掉
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (isDragging) return // feature-027 · 节点拖拽期间禁止画布 pan
    const target = e.target as HTMLElement
    if (target.dataset.canvasBg !== '1') return
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    if (isDragging) return
    setPan({ x: drag.current.px + e.clientX - drag.current.sx, y: drag.current.py + e.clientY - drag.current.sy })
  }
  const onPointerUp = () => { drag.current = null }

  // feature-027 补 · 右键菜单：节点上 → 节点菜单；画布空白（data-canvas-bg）→ 空白菜单
  const onViewportContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const nodeEl = target.closest<HTMLElement>('[data-node-id]')
    if (nodeEl) {
      const node = nodes.find(n => n.id === nodeEl.dataset.nodeId)
      if (!node) return
      setSelectedId(node.id)
      setMenu({ x: e.clientX, y: e.clientY, node })
      e.preventDefault()
      return
    }
    if (target.dataset.canvasBg === '1') {
      setMenu({ x: e.clientX, y: e.clientY, node: null })
      e.preventDefault()
    }
  }

  // Esc 关闭右键菜单
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  // feature-027 · 节点拖拽（仅本列内会话态摆位；产物归属固定步骤，禁止跨列）
  // movedRef：真拖过（>3px）才抑制随后的 click，避免松手误开查看器
  const DRAG_CLICK_THRESHOLD = 3
  const dragInfoRef = useRef<{
    offsetX: number; offsetY: number; slotX: number; startStep: StepId
    startClientX: number; startClientY: number
  } | null>(null)
  const movedRef = useRef(false)
  const illegalRef = useRef(false)
  const onNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if (e.button !== 0) return
    // 操作行按钮不发起拖拽（stopPropagation 之外双保险）
    if ((e.target as HTMLElement).closest('[data-node-actions]')) return
    // 业务约束：进行中的产物正在生成，锁定不可拖动（单击仍可选中/查看）
    if (node.status === 'active') return
    const el = viewportRef.current
    if (!el) return
    const pos = laid.byId.get(node.id)
    if (!pos) return
    const r = el.getBoundingClientRect()
    const mouseWX = (e.clientX - r.left - pan.x) / zoom
    const mouseWY = (e.clientY - r.top - pan.y) / zoom
    const col = laid.cols.find(c => c.step === pos.node.step)
    dragInfoRef.current = {
      offsetX: mouseWX - pos.x,
      offsetY: mouseWY - pos.y,
      slotX: col?.x ?? pos.x,
      startStep: pos.node.step,
      startClientX: e.clientX,
      startClientY: e.clientY,
    }
    movedRef.current = false
    illegalRef.current = false
    setMenu(null)
    setDragId(node.id)
    setSelectedId(node.id)
    e.stopPropagation()
    e.preventDefault()
  }
  const onViewportMouseMove = (e: React.MouseEvent) => {
    if (!dragId || !dragInfoRef.current) return
    const el = viewportRef.current
    if (!el) return
    if (Math.hypot(e.clientX - dragInfoRef.current.startClientX, e.clientY - dragInfoRef.current.startClientY) > DRAG_CLICK_THRESHOLD) {
      movedRef.current = true
    }
    const r = el.getBoundingClientRect()
    const mouseWX = (e.clientX - r.left - pan.x) / zoom
    const mouseWY = (e.clientY - r.top - pan.y) / zoom
    const rawX = mouseWX - dragInfoRef.current.offsetX
    const rawY = mouseWY - dragInfoRef.current.offsetY
    // 越界判定：节点中点越过本列槽位半宽（半个列距）即视为跨步骤
    const slotX = dragInfoRef.current.slotX
    const illegal = Math.abs((rawX + NODE_W / 2) - (slotX + NODE_W / 2)) > (NODE_W + COL_GAP) / 2
    illegalRef.current = illegal
    // 吸附：合法时横纵都吸附；越界时 x 不吸附（如实跟随指针），仅保留纵向对齐/等距
    const others = laid.items
      .filter(p => p.node.id !== dragId)
      .map(p => ({ x: p.x, y: p.y }))
    const snap = snapNode(rawX, rawY, others)
    setGuides(illegal ? snap.guides.filter(g => g.axis === 'h' || g.axis === 'ev') : snap.guides)
    const x = illegal ? rawX : snap.x
    setOverrides(prev => {
      const next = new Map(prev)
      next.set(dragId, { x: Math.max(PAD_X, x), y: Math.max(PAD_Y, snap.y) })
      return next
    })
  }
  const onViewportMouseUp = () => {
    if (dragId && dragInfoRef.current) {
      const nodeId = dragId
      const illegal = illegalRef.current
      setGuides([])
      dragInfoRef.current = null
      setDragId(null)
      if (illegal) {
        // 跨步骤非法：丢弃会话态摆位，节点回弹自动布局，不写盘；上层补警告 toast
        setOverrides(prev => {
          const n = new Map(prev)
          n.delete(nodeId)
          return n
        })
        onDropped?.({ nodeId, illegal: true })
      } else {
        onDropped?.({ nodeId, illegal: false })
      }
    }
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="rounded-2xl border border-dashed border-line bg-white/70 px-10 py-8">
          <p className="text-sm leading-6 text-muted">
            还没有任何产物。
            <br />
            在下方输入你的想法，showrunner 会按当前阶段依次产出产物并请你裁决确认门。
          </p>
        </div>
      </div>
    )
  }

  // ── 小地图参数 ──
  const MM_W = 128
  const MM_H = 80
  const mmPad = 8
  const mmInnerW = MM_W - mmPad * 2
  const mmInnerH = MM_H - mmPad * 2
  const mmScale = Math.min(mmInnerW / laid.width, mmInnerH / laid.height)
  // 等比缩放后的世界在 mm 容器内居中
  const mmOffX = (mmInnerW - laid.width * mmScale) / 2
  const mmOffY = (mmInnerH - laid.height * mmScale) / 2
  const mmViewW = (vp.w / zoom) * mmScale
  const mmViewH = (vp.h / zoom) * mmScale
  // 取景框按内容区（等比缩放后的世界包围盒）裁剪：视口大于世界或拖到世界外时，
  // 框仍如实反映覆盖范围，只是不溢出小地图圆角背景（内层 overflow-hidden 兜底）
  const mmContentX = mmOffX
  const mmContentY = mmOffY
  const mmContentW = laid.width * mmScale
  const mmContentH = laid.height * mmScale
  const mmViewRawX = mmOffX + (-pan.x / zoom) * mmScale
  const mmViewRawY = mmOffY + (-pan.y / zoom) * mmScale
  const mmViewX = Math.max(mmContentX, Math.min(mmViewRawX, mmContentX + mmContentW - 1.5))
  const mmViewY = Math.max(mmContentY, Math.min(mmViewRawY, mmContentY + mmContentH - 1.5))

  return (
    <div
      ref={viewportRef}
      data-canvas-bg="1"
      className={`relative h-full w-full overflow-hidden ${isDragging ? 'cursor-grabbing' : ''}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseMove={onViewportMouseMove}
      onMouseUp={onViewportMouseUp}
      onMouseLeave={onViewportMouseUp}
      onContextMenu={onViewportContextMenu}
    >
      {/* feature-002 · 脏读黄条：有任一 dirty 产物时顶部纯文本提示（无按钮、无链接、不阻断） */}
      {dirtyNodes.length > 0 && (
        <div
          data-dirty-banner
          className="pointer-events-none absolute left-3 top-3 z-20 max-w-[46%] rounded-lg bg-[#FFF4DE] px-3 py-1.5 text-[11px] font-semibold leading-snug text-[#C0841D] shadow-[0_4px_12px_rgba(192,132,29,0.18)]"
        >
          {`有 ${dirtyNodes.length} 个产物基于旧版立项（最新 v${dirtyLatest}），内容可能与最新立项不一致。`}
          {dirtyDriftLabel && <div className="mt-0.5">{dirtyDriftLabel}</div>}
        </div>
      )}

      {/* 世界 */}
      <div
        data-canvas-bg="1"
        className="absolute left-0 top-0"
        style={{ width: laid.width, height: laid.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {/* 步骤列底色（命中 activeStep 时整列染色） */}
        {laid.cols.map(col => {
          const isHit = activeStep != null && col.step === activeStep
          if (!isHit) return null
          return (
            <div
              key={`colhl-${col.step}`}
              className="pointer-events-none absolute rounded-[14px] bg-violet-soft/55"
              style={{ left: col.x - 12, top: col.top - 12, width: NODE_W + 24, height: col.height + 24 }}
            />
          )
        })}

        {/* 边 */}
        <svg className="pointer-events-none absolute inset-0" width={laid.width} height={laid.height} viewBox={`0 0 ${laid.width} ${laid.height}`}>
          <defs>
            <marker id={`arr-${uid}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0 0 L7 3.5 L0 7z" fill="#C7CBDD" />
            </marker>
            <marker id={`arrV-${uid}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0 0 L7 3.5 L0 7z" fill="#6C5CE7" />
            </marker>
          </defs>
          {edges.map(edge => {
            const d = edgePath(edge, laid.byId)
            if (!d) return null
            const vis = edgeVisual(edge, laid.byId)
            const st = EDGE_STYLE[vis]
            return (
              <path
                key={edge.id}
                data-edge={edge.id}
                d={d}
                fill="none"
                stroke={st.stroke}
                strokeWidth={1.8}
                className={st.cls}
                markerEnd={`url(#${st.marker}-${uid})`}
              />
            )
          })}
        </svg>

        {/* feature-027 补 · 对齐/等距参考线（世界层，随缩放/平移；仅拖拽中渲染） */}
        {isDragging && guides.flatMap((g, i) => {
          if (g.axis === 'ev' || g.axis === 'eh') {
            // 等距：两条间隙参考线（v 为纵向排布 → 水平线；eh 反之），线长取节点尺寸
            const line = (p: number, k: number) => (
              <div
                key={`guide-${g.axis}-${i}-${k}`}
                data-drag-guide={g.axis}
                className="pointer-events-none absolute z-[1] bg-violet/70"
                style={g.axis === 'ev'
                  ? { left: 0, top: p, width: laid.width, height: 1 }
                  : { left: p, top: 0, width: 1, height: laid.height }}
              />
            )
            return [line(g.pos, 0), line(g.posB ?? g.pos, 1)]
          }
          return [(
            <div
              key={`guide-${g.axis}-${i}`}
              data-drag-guide={g.axis}
              className="pointer-events-none absolute z-[1] bg-violet/70"
              style={g.axis === 'v'
                ? { left: g.pos, top: 0, width: 1, height: laid.height }
                : { left: 0, top: g.pos, width: laid.width, height: 1 }}
            />
          )]
        })}

        {/* 步骤列标签 */}
        {laid.cols.map(col => {
          const isHit = activeStep != null && col.step === activeStep
          return (
            <div
              key={`col-${col.step}`}
              className={`pointer-events-none absolute select-none text-center text-[11px] transition ${
                isHit ? 'font-extrabold text-violet' : 'font-medium text-[#A6ABC0]'
              }`}
              style={{ left: col.x - COL_GAP / 2, top: 4, width: NODE_W + COL_GAP }}
            >
              STAGE {col.step} · {stepLabel(col.step)}
              {isHit && <span className="ml-1 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-violet align-middle" />}
            </div>
          )
        })}

        {/* 节点 */}
        {laid.items.map(({ node, x, y }) => {
          const meta = STATUS_META[node.status]
          const selected = node.id === selectedId
          const openable = Boolean(node.ref?.path) && Boolean(onOpenNode)
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              role={openable ? 'button' : undefined}
              tabIndex={openable ? 0 : undefined}
              className={`group node-in absolute flex ${node.status === 'active' ? 'cursor-default' : 'cursor-grab'} flex-col overflow-hidden rounded-[11px] border bg-white transition-shadow hover:shadow-[0_10px_24px_rgba(45,48,90,0.12)] ${
                selected || dragId === node.id
                  ? 'z-[2] border-2 border-violet shadow-[0_12px_28px_rgba(108,92,231,0.22)]'
                  : 'border-line hover:border-[#CBCEE0]'
              } ${dragId === node.id ? 'cursor-grabbing opacity-50 shadow-[0_18px_36px_rgba(108,92,231,0.28)]' : ''} ${
                node.status === 'invalidated' ? 'opacity-60' : ''
              }`}
              style={{
                left: x,
                top: y,
                width: NODE_W,
                height: NODE_H,
                ...(selected || dragId === node.id
                  ? { boxShadow: '0 0 0 7px rgba(108,92,231,0.06), 0 12px 28px rgba(108,92,231,.22)' }
                  : {}),
              }}
              onClick={e => {
                // feature-027 · 真拖过（>3px）松手后的合成 click 不打开查看器
                if (movedRef.current) return
                e.stopPropagation()
                setSelectedId(node.id)
                if (openable) onOpenNode!(node)
              }}
              onKeyDown={openable ? e => { if (e.key === 'Enter') onOpenNode!(node) } : undefined}
              onMouseDown={e => onNodeMouseDown(e, node)}
            >
              {selected && (
                <span className="dag-selected-ring pointer-events-none absolute rounded-[14px]" style={{ inset: -7 }} />
              )}
              {/* 节点头 */}
              <div className="flex items-center gap-1.5 border-b border-[#F0F1F7] px-2 py-[7px] text-[10.5px] font-bold text-[#4A4F68]">
                <span className="grid h-[15px] w-[15px] place-items-center rounded bg-violet-soft text-[9px] text-violet">
                  <svg viewBox="0 0 24 24" className="h-[9px] w-[9px]" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                </span>
                <span className="truncate">{kindLabel(node.kind)}</span>
                {/* feature-002 · 脏读角标：基于旧版立项时黄色 ⚠（不灰显、不阻断，status 保持 done） */}
                {node.dirty && (
                  <span
                    data-dirty-badge={node.id}
                    title={dirtyTitle(node.dirty)}
                    className="ml-auto grid h-[15px] w-[15px] place-items-center rounded bg-[#FFF4DE] text-[9px] leading-none text-[#C0841D]"
                  >
                    ⚠
                  </span>
                )}
                <span className={`font-semibold text-[#A6ABC0] ${node.dirty ? '' : 'ml-auto'}`}>{typeof node.meta?.version === 'string' ? node.meta.version : '—'}</span>
              </div>
              {/* 节点体 */}
              <div className="flex flex-1 flex-col px-2.5 py-2">
                <div className="line-clamp-2 text-[11.5px] font-semibold leading-[1.5] text-ink">{node.title}</div>
                {node.ref?.path && (
                  <div className="mt-1 truncate font-mono text-[9px] text-[#A6ABC0]" title={node.ref.path}>
                    {node.ref.path.split(/[/\\]/).pop()}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-1.5 pt-1.5 text-[9.5px] text-[#8A90A6]">
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${meta.dot}`} />
                  {meta.label}
                  {edgeCount(node.id, edges) > 0 && <span className="ml-auto">{edgeCount(node.id, edges)} 条边</span>}
                </div>
              </div>
              {/* feature-026 · 节点卡底部操作行（hover/selected 可见） */}
              {onNodeAction && (
                <NodeActions
                  node={node}
                  selected={selected}
                  openable={openable}
                  onAction={(act) => {
                    if (act === 'view' && openable) onOpenNode!(node)
                    else onNodeAction(act, node)
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* 缩放控件 */}
      <div className="absolute bottom-3.5 left-3.5 z-10 flex items-center rounded-[10px] border border-line bg-white shadow-[0_4px_12px_rgba(40,42,80,0.08)]">
        <button className="h-7 w-7 text-sm text-[#6A708A] hover:text-violet" onClick={e => { e.stopPropagation(); zoomAt(zoom - 0.1, vp.w / 2, vp.h / 2) }}>−</button>
        <button
          className="h-7 w-10 border-x border-line text-[10.5px] leading-7 text-[#8A90A6] hover:text-violet"
          title="适应画布"
          onClick={e => { e.stopPropagation(); fitView() }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button className="h-7 w-7 text-sm text-[#6A708A] hover:text-violet" onClick={e => { e.stopPropagation(); zoomAt(zoom + 0.1, vp.w / 2, vp.h / 2) }}>＋</button>
      </div>

      {/* 小地图 */}
      <div className="absolute bottom-3.5 right-3.5 z-10 h-20 w-32 rounded-[10px] border border-line bg-white p-2 shadow-[0_4px_12px_rgba(40,42,80,0.08)]">
        <div className="relative h-full w-full overflow-hidden rounded-[5px] bg-[#F3F4F9]">
          {laid.items.map(({ node, x, y }) => (
            <i
              key={`mm-${node.id}`}
              className={`absolute rounded-[1.5px] ${node.status === 'active' ? 'bg-violet' : node.status === 'done' ? 'bg-[#A8DFC6]' : 'bg-[#C6BFF5]'}`}
              style={{ left: mmOffX + x * mmScale, top: mmOffY + y * mmScale, width: NODE_W * mmScale, height: NODE_H * mmScale }}
            />
          ))}
          <div
            className="absolute rounded-[3px] border-[1.5px] border-violet bg-violet/10"
            style={{ left: mmViewX, top: mmViewY, width: Math.min(mmViewW, laid.width * mmScale), height: Math.min(mmViewH, laid.height * mmScale) }}
          />
        </div>
      </div>

      {/* feature-027 · 拖拽期提示气泡：合法时显示 STAGE 与吸附态；越界转红色警告 */}
      {isDragging && (() => {
        const startStep = dragInfoRef.current?.startStep
        const stageText = startStep != null
          ? `STAGE ${startStep} · ${STEP_LABEL[startStep] ?? startStep}`
          : '移动节点'
        const illegal = illegalRef.current
        return (
          <div
            className={`pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(108,92,231,0.4)] backdrop-blur ${
              illegal ? 'bg-bad/95 shadow-[0_8px_20px_rgba(224,76,92,0.35)]' : 'bg-violet/95'
            }`}
            data-drag-hint
            data-illegal={illegal ? '1' : '0'}
          >
            {illegal ? (
              <span>产物不可跨步骤移动 · 松手回到 {stageText}</span>
            ) : (
              <>
                <span className="opacity-80">正在拖拽 ·</span> <span>{stageText}</span>
              </>
            )}
            {!illegal && guides.length > 0 && (
              <span className="ml-2 rounded-full bg-white/25 px-1.5 py-px text-[10px]" data-snap-hint>
                ● 已吸附：{guides.map(g => g.label).join(' / ')}
              </span>
            )}
          </div>
        )
      })()}

      {/* feature-027 补 · 右键上下文菜单 */}
      {menu && <ContextMenu
        menu={menu}
        openable={Boolean(menu.node?.ref?.path) && Boolean(onOpenNode)}
        onAction={(act, node) => {
          if (act === 'fit') fitView()
          else if (act === 'view' && node?.ref?.path && onOpenNode) onOpenNode(node)
          else if (node && onNodeAction) onNodeAction(act, node)
          setMenu(null)
        }}
        onClose={() => setMenu(null)}
      />}
    </div>
  )
}

// 节点右键菜单：查看（有 ref.path）/ 重新生成（非 active）/ 复制路径（有 ref.path）/ 标记失效（done）/ 适应画布
// 空白右键菜单：仅适应画布
function ContextMenu({
  menu, openable, onAction, onClose,
}: {
  menu: { x: number; y: number; node: CanvasNode | null }
  openable: boolean
  onAction: (act: NodeAction | 'fit', node: CanvasNode | null) => void
  onClose: () => void
}) {
  const node = menu.node
  // 简单视口防溢出（菜单约 168×200）
  const left = Math.min(menu.x, window.innerWidth - 184)
  const top = Math.min(menu.y, window.innerHeight - 216)
  const Item = ({ act, label, show = true }: { act: NodeAction | 'fit'; label: string; show?: boolean }) => {
    if (!show) return null
    return (
      <button
        type="button"
        data-ctx-item={act}
        onClick={() => onAction(act, node)}
        className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium text-[#4A4F68] hover:bg-violet-soft hover:text-violet"
      >
        {label}
      </button>
    )
  }
  return (
    <>
      {/* 全屏透明拦截层：点击外部 / 右键其他处关闭 */}
      <div className="fixed inset-0 z-30" data-ctx-backdrop onContextMenu={e => { e.preventDefault(); onClose() }} onClick={onClose} />
      <div
        className="fixed z-40 w-40 rounded-[10px] border border-line bg-white p-1 shadow-[0_12px_32px_rgba(40,42,80,0.18)]"
        style={{ left, top }}
        data-ctx-menu={node ? 'node' : 'canvas'}
        data-node-id={node?.id ?? undefined}
      >
        {node ? (
          <>
            <Item act="view" label="查看产物" show={openable} />
            <Item act="regen" label="重新生成" show={node.status !== 'active'} />
            <Item act="copy" label="复制路径 / 参数" show={Boolean(node.ref?.path)} />
            <Item act="invalidate" label="标记失效" show={node.status === 'done'} />
            <div className="mx-1 my-1 h-px bg-line" />
            <Item act="fit" label="适应画布" />
          </>
        ) : (
          <Item act="fit" label="适应画布" />
        )}
      </div>
    </>
  )
}

function edgeCount(id: string, edges: CanvasEdge[]): number {
  return edges.filter(e => e.from === id || e.to === id).length
}

// feature-026 · 节点卡底部操作行
// - hover/selected 可见（其他态隐藏，避免遮蔽状态行）
// - 4 按钮：查看（ref.path 存在时）/ 重新生成（非 active）/ 复制（ref.path 存在时）/ 标记失效（done）
// - 选中态常显（不再仅 hover），便于键盘可达
function NodeActions({
  node, selected, openable, onAction,
}: {
  node: CanvasNode
  selected: boolean
  openable: boolean
  onAction: (act: NodeAction) => void
}) {
  const showBar = selected
  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-[3] flex items-center justify-around border-t border-line bg-white/95 px-1 py-[3px] backdrop-blur-sm transition ${
        showBar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
      // 父级没有 group 工具类，简化：仅选中态常显；hover 走父 .node-in:hover 通过 :has 或 sibling 不便，用 selected 保证可达
      style={!showBar ? { pointerEvents: 'none' } : undefined}
      data-node-actions={node.id}
    >
      {openable && (
        <ActionBtn
          tip="查看产物"
          dataAttr="view"
          onClick={() => onAction('view')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[11px] w-[11px]">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
          </svg>
        </ActionBtn>
      )}
      {node.status !== 'active' && (
        <ActionBtn
          tip="重新生成"
          dataAttr="regen"
          onClick={() => onAction('regen')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[11px] w-[11px]">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
          </svg>
        </ActionBtn>
      )}
      {node.ref?.path && (
        <ActionBtn
          tip="复制路径 / 参数"
          dataAttr="copy"
          onClick={() => onAction('copy')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[11px] w-[11px]">
            <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        </ActionBtn>
      )}
      {node.status === 'done' && (
        <ActionBtn
          tip="标记失效"
          dataAttr="invalidate"
          tone="bad"
          onClick={() => onAction('invalidate')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-[11px] w-[11px]">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </ActionBtn>
      )}
    </div>
  )
}

function ActionBtn({
  tip, onClick, children, dataAttr, tone,
}: {
  tip: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  dataAttr: string
  tone?: 'bad'
}) {
  return (
    <button
      type="button"
      title={tip}
      onClick={e => { e.stopPropagation(); onClick(e) }}
      className={`grid h-[18px] w-[18px] place-items-center rounded transition ${
        tone === 'bad'
          ? 'text-[#A6ABC0] hover:bg-bad/10 hover:text-bad'
          : 'text-[#7A8098] hover:bg-violet-soft hover:text-violet'
      }`}
      data-action={dataAttr}
    >
      {children}
    </button>
  )
}
