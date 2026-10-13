// feature-020 · 多步画布（契约 §3、设计说明 §2）
// DAG 形态（对齐原型 #viewDag）：CanvasNode 无坐标，只有 step；
// renderer 按 step 分列自动布局，列内纵向排布，SVG 贝塞尔边按源节点状态三态着色；
// 支持缩放/平移与右下角小地图。renderer 不推导业务状态，状态一律取自 canvas 数据。
// feature-022 · 有 ref.path 的节点可点击打开只读查看器（契约 §3）
// feature-023 · 流程导航 STAGE 高亮（命中 step 的列染色 + 列标签加粗 + 节点描边）
// feature-026 · 节点卡底部操作行（hover/selected 可见）：查看 / 重新生成 / 复制 / 标记失效
// feature-027 · 节点可拖拽改位（自由位置 / 跨 step 自动改 step）
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Canvas, CanvasEdge, CanvasNode, StepId } from '@shared/types'

export type NodeAction = 'view' | 'regen' | 'copy' | 'invalidate'

interface NodeOverride { step: StepId; x: number; y: number }

// ── 布局常量（世界坐标 px） ────────────────────────────────
const NODE_W = 168
const NODE_H = 118
const COL_GAP = 56 // 列间距（边的走向空间）
const ROW_GAP = 26 // 同列节点纵向间距
const PAD_X = 28
const PAD_Y = 28

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
  brief: '创意简报',
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
  '3': '资产 / 分镜',
  '4': '镜头',
  '5': '后期',
  '6': '发布',
}

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind
}

function stepLabel(step: string): string {
  return STEP_LABEL[step] ?? `步骤 ${step}`
}

export { kindLabel }

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
// feature-027 · overrides 优先于自动布局（拖拽后用用户指定的位置 / step）
function layout(nodes: CanvasNode[], overrides: Map<string, NodeOverride>): LaidOut {
  // 收集所有出现过的 step（按首次出现顺序）
  const effectiveStep = (n: CanvasNode): StepId => overrides.get(n.id)?.step ?? n.step
  const steps: StepId[] = []
  for (const n of nodes) {
    const s = effectiveStep(n)
    if (!steps.includes(s)) steps.push(s)
  }
  const colHeights = steps.map(s => {
    const count = nodes.filter(n => effectiveStep(n) === s && !overrides.has(n.id)).length
    return { step: s, count, height: count * NODE_H + (count - 1) * ROW_GAP }
  })
  const maxHeight = Math.max(0, ...colHeights.map(c => c.height))
  const width = PAD_X * 2 + steps.length * NODE_W + (steps.length - 1) * COL_GAP
  const height = PAD_Y * 2 + maxHeight

  const items: Positioned[] = []
  const cols = colHeights.map((c, i) => {
    const x = PAD_X + i * (NODE_W + COL_GAP)
    const top = PAD_Y + (maxHeight - c.height) / 2
    nodes.filter(n => effectiveStep(n) === c.step && !overrides.has(n.id)).forEach((node, j) => {
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
  // feature-022：有 ref.path 的节点可点击打开只读查看器（契约 §3）
  onOpenNode?: (node: CanvasNode) => void
  // feature-023：流程导航 STAGE 高亮（命中 step 的列染色 + 列标签加粗 + 节点描边）
  activeStep?: string | null
  // feature-026：节点卡底部操作行（查看/重新生成/复制/标记失效）；不传则不渲染
  onNodeAction?: (action: NodeAction, node: CanvasNode) => void
  // feature-027 补：拖拽松手回调（fromStep/toStep/changed）让上层弹 toast
  onDropped?: (info: { nodeId: string; fromStep: StepId; toStep: StepId; changed: boolean }) => void
}

export default function CanvasBoard({ canvas, onOpenNode, activeStep, onNodeAction, onDropped }: Props) {
  const { nodes, edges } = canvas
  const uid = useId().replace(/[:]/g, '')
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: PAD_X, y: PAD_Y })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [vp, setVp] = useState({ w: 0, h: 0 })
  // feature-027 · 拖拽 override（位置 / 跨 step 调整；不持久化，dev-mock 未接写回 IPC）
  const [overrides, setOverrides] = useState<Map<string, NodeOverride>>(() => new Map())
  const [dragId, setDragId] = useState<string | null>(null)
  const isDragging = dragId != null

  const laid = useMemo(() => layout(nodes, overrides), [nodes, overrides])

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

  // 流程导航 STAGE 联动：activeStep 变化时把对应列水平居中到视口
  useEffect(() => {
    if (activeStep == null) return
    const el = viewportRef.current
    if (!el) return
    const col = laid.cols.find(c => c.step === activeStep)
    if (!col) return
    const r = el.getBoundingClientRect()
    setVp({ w: r.width, h: r.height })
    const colCenterX = col.x + NODE_W / 2
    setPan(p => ({ x: r.width / 2 - colCenterX * zoom, y: p.y }))
  }, [activeStep, laid.cols, zoom])

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

  const zoomAt = useCallback((next: number, cx: number, cy: number) => {
    setZoom(z0 => {
      const z = clampZoom(next)
      setPan(p => ({ x: cx - ((cx - p.x) * z) / z0, y: cy - ((cy - p.y) * z) / z0 }))
      return z
    })
  }, [clampZoom])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const el = viewportRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    zoomAt(zoom * factor, e.clientX - r.left, e.clientY - r.top)
  }, [zoom, zoomAt])

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

  // feature-027 · 节点拖拽（位置 / 跨 step 自动改 step）
  const dragInfoRef = useRef<{ offsetX: number; offsetY: number; startStep: StepId } | null>(null)
  const onNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if (e.button !== 0) return
    const el = viewportRef.current
    if (!el) return
    const pos = laid.byId.get(node.id)
    if (!pos) return
    const r = el.getBoundingClientRect()
    const mouseWX = (e.clientX - r.left - pan.x) / zoom
    const mouseWY = (e.clientY - r.top - pan.y) / zoom
    dragInfoRef.current = {
      offsetX: mouseWX - pos.x,
      offsetY: mouseWY - pos.y,
      startStep: pos.node.step,
    }
    setDragId(node.id)
    setSelectedId(node.id)
    e.stopPropagation()
    e.preventDefault()
  }
  const onViewportMouseMove = (e: React.MouseEvent) => {
    if (!dragId || !dragInfoRef.current) return
    const el = viewportRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const mouseWX = (e.clientX - r.left - pan.x) / zoom
    const mouseWY = (e.clientY - r.top - pan.y) / zoom
    const newX = mouseWX - dragInfoRef.current.offsetX
    const newY = mouseWY - dragInfoRef.current.offsetY
    // 找最近的 step 列（按 x 中点距离）
    let bestStep: StepId = dragInfoRef.current.startStep
    let bestDist = Infinity
    for (const col of laid.cols) {
      const colCenterX = col.x + NODE_W / 2
      const d = Math.abs((newX + NODE_W / 2) - colCenterX)
      if (d < bestDist) { bestDist = d; bestStep = col.step }
    }
    setOverrides(prev => {
      const next = new Map(prev)
      next.set(dragId, { step: bestStep, x: Math.max(PAD_X, newX), y: Math.max(PAD_Y, newY) })
      return next
    })
  }
  const onViewportMouseUp = () => {
    if (dragId && dragInfoRef.current) {
      const fromStep = dragInfoRef.current.startStep
      const ov = overrides.get(dragId)
      const toStep = ov?.step ?? fromStep
      const changed = fromStep !== toStep
      onDropped?.({ nodeId: dragId, fromStep, toStep, changed })
      dragInfoRef.current = null
      setDragId(null)
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
  const mmViewX = mmOffX + (-pan.x / zoom) * mmScale
  const mmViewY = mmOffY + (-pan.y / zoom) * mmScale

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
    >
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
              role={openable ? 'button' : undefined}
              tabIndex={openable ? 0 : undefined}
              className={`group node-in absolute flex cursor-grab flex-col overflow-hidden rounded-[11px] border bg-white transition-shadow hover:shadow-[0_10px_24px_rgba(45,48,90,0.12)] ${
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
                if (dragId) return // feature-027 · 拖拽中不触发 click
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
                <span className="ml-auto font-semibold text-[#A6ABC0]">{typeof node.meta?.version === 'string' ? node.meta.version : '—'}</span>
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
        <div className="relative h-full w-full rounded-[5px] bg-[#F3F4F9]">
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

      {/* feature-027 · 拖拽期"目标 STAGE"提示气泡 */}
      {isDragging && (() => {
        const ov = overrides.get(dragId!)
        const targetStep = ov?.step
        const startStep = dragInfoRef.current?.startStep
        const stepLabel = STEP_LABEL[targetStep as StepId] ?? targetStep ?? '?'
        const stepChanged = targetStep && startStep && targetStep !== startStep
        return (
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-violet/95 px-3.5 py-1.5 text-[11.5px] font-extrabold text-white shadow-[0_8px_20px_rgba(108,92,231,0.4)] backdrop-blur"
            data-drag-hint
          >
            <span className="opacity-80">正在拖拽 ·</span>{' '}
            <span>{targetStep ? `STAGE ${targetStep} · ${stepLabel}` : '移动节点'}</span>
            {stepChanged && (
              <span className="ml-2 rounded-full bg-white/25 px-1.5 py-px text-[10px]">步骤变更</span>
            )}
          </div>
        )
      })()}
    </div>
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
