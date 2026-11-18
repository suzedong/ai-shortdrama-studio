// feature-020 C5 / feature-823 · Canvas v4 多创作页、自由画布与既有节点交互
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'

import type {
  Canvas,
  CanvasCommandRequest,
  CanvasNode,
  CanvasPosition,
  StepId,
} from '@shared/types'

import { activeCanvasDocument, activeCanvasPage } from './document'
import { driftDays, driftReminderLabel } from './dirty-drift'

const STAGE: Array<{ id: StepId; title: string; color: string }> = [
  { id: '0', title: '立项', color: '#6C5CE7' },
  { id: '1', title: '故事', color: '#8B7CF6' },
  { id: '2', title: '剧本分场', color: '#5B8DEF' },
  { id: '3', title: '资产', color: '#2BAE9E' },
  { id: '4', title: '分镜', color: '#E5A63D' },
  { id: '5', title: '镜头', color: '#E56D5A' },
  { id: '6', title: '后期', color: '#C66BB3' },
  { id: '7', title: '发布', color: '#7C8A9A' },
]
const STEP_LABELS = Object.fromEntries(STAGE.map(stage => [stage.id, stage.title])) as Record<StepId, string>

interface IconProps { size?: number; className?: string }
function Icon({ name, size = 14, className }: IconProps & { name: string }) {
  const paths: Record<string, ReactNode> = {
    preview: <><path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    realign: <><path d="M20 6v5h-5" /><path d="M20 11a8 8 0 1 0 1 5" /></>,
    page: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 10v6M9 13h6" /></>,
    rename: <><path d="m4 20 4-1 11-11-3-3L5 16Z" /><path d="m14 7 3 3" /></>,
    delete: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    fit: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /><rect x="8" y="8" width="8" height="8" rx="1" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
  }
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
const ArrowUpRight = (props: IconProps) => <Icon {...props} name="preview" />
const Copy = (props: IconProps) => <Icon {...props} name="copy" />
const RotateCcw = (props: IconProps) => <Icon {...props} name="realign" />
const FolderPlus = (props: IconProps) => <Icon {...props} name="page" />
const Pencil = (props: IconProps) => <Icon {...props} name="rename" />
const Trash2 = (props: IconProps) => <Icon {...props} name="delete" />
const Plus = (props: IconProps) => <Icon {...props} name="plus" />
const Minus = (props: IconProps) => <Icon {...props} name="minus" />
const Fit = (props: IconProps) => <Icon {...props} name="fit" />
const MapIcon = (props: IconProps) => <Icon {...props} name="map" />

const NODE_W = 168
const NODE_H = 118
const COL_GAP = 56
const PAD_X = 28
const PAD_TOP = 56
const ROW_H = NODE_H + 42
const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.6
const DEFAULT_VIEWPORT: BoardViewport = { pan: { x: 0, y: 0 }, zoom: 0.9 }

export type NodeAction = 'view' | 'regen' | 'copy' | 'invalidate'
type BoardNodeAction = 'preview' | 'realign' | 'ctx-preview' | 'ctx-copy' | 'ctx-ref' | 'invalidate'

export function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    brief: '立项单', diagnosis: '选题诊断', outline: '故事大纲', profiles: '人物小传',
    scenes: '分场表', dialogue: '台词稿', character: '角色', location: '场景',
    style: '风格', prop: '道具', storyboard: '分镜', shot: '镜头',
    audio: '音频', subtitle: '字幕', final: '成片', manifest: '发布清单',
    package: '发布包', metrics: '回收指标', report: '复盘报告', traces: '镜头溯源', decisions: '决策记录',
  }
  return map[kind] ?? kind
}

export function dirtyFieldLabel(path: string): string {
  const map: Record<string, string> = {
    'fiveElements.genre': '题材', 'fiveElements.platforms': '平台',
    'fiveElements.episodeDuration': '单集时长', 'fiveElements.episodeCount': '集数',
    'fiveElements.tone': '基调', 'fiveElements.aspectRatio': '画幅比例',
    'premise.leads': '人物', 'premise.time': '时间', 'premise.place': '地点',
    'premise.coreEvent': '核心事件', 'premise.seasonBoundary': '季边界',
  }
  return map[path] ?? path
}

export function snapNode(
  x: number,
  y: number,
  others: Array<{ x: number; y: number }>,
  threshold = 6,
): {
  x: number
  y: number
  guides: Array<{ axis: 'v' | 'h' | 'ev' | 'eh'; pos: number; posB?: number; label: string }>
  snapped: boolean
} {
  type Guide = { axis: 'v' | 'h' | 'ev' | 'eh'; pos: number; posB?: number; label: string }
  const guides: Guide[] = []
  let nx = x
  let ny = y
  let snapped = false
  let bx = threshold
  let by = threshold
  let gx: Guide | null = null
  let gy: Guide | null = null
  for (const other of others) {
    const center = other.x + NODE_W / 2
    const right = other.x + NODE_W
    const xCandidates = [
      { d: Math.abs(x - other.x), v: other.x, pos: other.x, label: '左对齐' },
      { d: Math.abs(x - center), v: center, pos: center, label: '中线对齐' },
      { d: Math.abs(x - right), v: right, pos: right, label: '右对齐' },
    ]
    for (const candidate of xCandidates) {
      if (candidate.d < bx) {
        bx = candidate.d
        nx = candidate.v
        gx = { axis: 'v', pos: candidate.pos, label: candidate.label }
      }
    }
    const middle = other.y + NODE_H / 2
    const bottom = other.y + NODE_H
    const yCandidates = [
      { d: Math.abs(y - other.y), v: other.y, pos: other.y, label: '上对齐' },
      { d: Math.abs(y - middle), v: middle, pos: middle, label: '中线对齐' },
      { d: Math.abs(y - bottom), v: bottom, pos: bottom, label: '下对齐' },
    ]
    for (const candidate of yCandidates) {
      if (candidate.d < by) {
        by = candidate.d
        ny = candidate.v
        gy = { axis: 'h', pos: candidate.pos, label: candidate.label }
      }
    }
  }
  const equalSpace = (
    dir: 'ev' | 'eh',
    rawAlong: number,
    rawCross: number,
  ): { pos: number; guide: Guide } | null => {
    const size = dir === 'ev' ? NODE_H : NODE_W
    const crossNear = dir === 'ev' ? COL_GAP : NODE_H
    const near = others.filter(other => {
      const crossA = dir === 'ev' ? other.x + NODE_W / 2 : other.y + NODE_H / 2
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
        const p1 = dir === 'ev' ? near[i]!.y : near[i]!.x
        const p2 = dir === 'ev' ? near[j]!.y : near[j]!.x
        const a = Math.min(p1, p2)
        const b = Math.max(p1, p2)
        const d = b - a
        if (d < size) continue
        const candidates = [
          { c: a - d, gap: d - size },
          { c: b + d, gap: d - size },
        ]
        if (d >= 2 * size) candidates.push({ c: a + d / 2, gap: d / 2 - size })
        for (const { c, gap } of candidates) {
          const distance = Math.abs(c - rawAlong)
          if (distance < best && distance <= threshold * 2.6) {
            best = distance
            ideal = c
            bestA = a
            bestB = b
            bestGap = gap
          }
        }
      }
    }
    if (best > threshold * 2.6) return null
    const sorted = [ideal, bestA, bestB].sort((u, v) => u - v)
    const pos = (sorted[0]! + size + sorted[1]!) / 2
    const posB = (sorted[1]! + size + sorted[2]!) / 2
    return {
      pos: ideal,
      guide: {
        axis: dir,
        pos,
        posB,
        label: `${dir === 'ev' ? '垂直' : '水平'}等距 ${Math.round(bestGap)}px`,
      },
    }
  }
  const ev = equalSpace('ev', ny, nx)
  const eh = ev ? null : equalSpace('eh', nx, ny)
  if (ev) {
    ny = ev.pos
    gy = ev.guide
  }
  if (eh) {
    nx = eh.pos
    gx = eh.guide
  }
  if (gx) {
    guides.push(gx)
    snapped = true
  }
  if (gy) {
    guides.push(gy)
    snapped = true
  }
  return { x: nx, y: ny, guides, snapped }
}

type LayoutPoint = { x: number; y: number }
type BoardViewport = { pan: LayoutPoint; zoom: number }
type StoredViewport = { x: number; y: number; zoom: number }
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }
type Target = { projectId: string; pageId: string; canvasId: string }
type RenameTarget = { kind: 'page' | 'canvas'; title: string }
type DeleteConfirmation = { kind: 'page' | 'canvas' }
type BoardCommand =
  | { type: 'page.create' }
  | { type: 'page.rename'; title: string }
  | { type: 'page.delete'; confirmNonEmpty?: boolean }
  | { type: 'canvas.create' }
  | { type: 'canvas.rename'; title: string }
  | { type: 'canvas.delete'; confirmNonEmpty?: boolean }
  | { type: 'node.move'; nodeId: string; position: CanvasPosition }

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const finitePosition = (value: CanvasPosition | null | undefined): CanvasPosition | null =>
  value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null
const targetKeyOf = (target: Target): string => JSON.stringify([target.projectId, target.pageId, target.canvasId])
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)

function fallbackPosition(nodes: CanvasNode[], node: CanvasNode): CanvasPosition {
  const column = STAGE.findIndex(stage => stage.id === node.step)
  const row = nodes.filter(item => item.step === node.step).findIndex(item => item.id === node.id)
  return { x: PAD_X + Math.max(0, column) * (NODE_W + COL_GAP), y: PAD_TOP + Math.max(0, row) * ROW_H }
}

function nodePosition(nodes: CanvasNode[], node: CanvasNode): CanvasPosition {
  return finitePosition(node.position) ?? fallbackPosition(nodes, node)
}

function boundsOf(points: LayoutPoint[]): Bounds | null {
  if (points.length === 0) return null
  const minX = Math.min(...points.map(point => point.x))
  const minY = Math.min(...points.map(point => point.y))
  const maxX = Math.max(...points.map(point => point.x + NODE_W))
  const maxY = Math.max(...points.map(point => point.y + NODE_H))
  return { minX, minY, maxX, maxY, width: Math.max(NODE_W, maxX - minX), height: Math.max(NODE_H, maxY - minY) }
}

function normalizeViewport(value: BoardViewport | StoredViewport | null | undefined): BoardViewport | null {
  if (!value || !Number.isFinite(value.zoom)) return null
  const pan = 'pan' in value ? value.pan : value
  if (!Number.isFinite(pan.x) || !Number.isFinite(pan.y)) return null
  return { pan: { x: pan.x, y: pan.y }, zoom: clamp(value.zoom, MIN_ZOOM, MAX_ZOOM) }
}

function deriveDirtyBanner(nodes: CanvasNode[]): { count: number } | null {
  const count = nodes.filter(node => node.dirty).length
  return count > 0 ? { count } : null
}

function driftReminder(nodes: CanvasNode[]): string | null {
  const days = nodes.map(node => driftDays(node.dirty?.markedAt)).filter((value): value is number => value !== null)
  return driftReminderLabel(days.length > 0 ? Math.max(...days) : null)
}

function dirtyTitle(node: CanvasNode): string {
  const dirty = node.dirty
  if (!dirty) return ''
  const fields = dirty.fields.map(dirtyFieldLabel).join('、')
  return `基于 v${dirty.sinceBriefVersion}，与最新 v${dirty.latestBriefVersion} 不一致：${fields}`
}

function latestBriefVersion(nodes: CanvasNode[]): string {
  for (const node of nodes) {
    const version = node.meta?.version
    if (node.kind === 'brief' && typeof version === 'string' && /^v\d+$/.test(version)) return version
  }
  const dirty = nodes.find(node => node.dirty)?.dirty
  return dirty ? `v${dirty.latestBriefVersion}` : 'v1'
}

function canvasAtTarget(canvas: Canvas, target: Target): Canvas {
  const page = canvas.pages.find(item => item.id === target.pageId)
  if (!page || !page.canvases.some(item => item.id === target.canvasId)) return canvas
  if (canvas.activePageId === target.pageId && page.activeCanvasId === target.canvasId && canvas.activeView === 'canvas') return canvas
  return {
    ...canvas,
    activePageId: target.pageId,
    activeView: 'canvas',
    pages: canvas.pages.map(item => item.id === target.pageId ? { ...item, activeCanvasId: target.canvasId } : item),
  }
}

function ContextMenu(props: {
  x: number
  y: number
  items: Array<{ key: string; label: string; danger?: boolean; onSelect: () => void }>
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50" onPointerDown={props.onClose} onContextMenu={event => event.preventDefault()}>
      <div data-ctx-backdrop className="absolute inset-0" />
      <div data-ctx-menu className="absolute min-w-[168px] rounded-lg border border-line bg-surface p-1 shadow-xl" style={{ left: props.x, top: props.y }} onPointerDown={event => event.stopPropagation()}>
        {props.items.map(item => (
          <button
            key={item.key}
            type="button"
            data-ctx-item={item.key}
            className={`block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-violet-soft ${item.danger ? 'text-danger' : 'text-ink'}`}
            onClick={() => { item.onSelect(); props.onClose() }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ActionBtn({ label, action, children, onClick, onContextMenu }: {
  label: string
  action: string
  children: ReactNode
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button type="button" title={label} aria-label={label} data-action={action} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-violet-soft hover:text-violet" onClick={onClick} onContextMenu={onContextMenu}>
      {children}
    </button>
  )
}

function NodeActions({ node, onAction }: { node: CanvasNode; onAction: (action: BoardNodeAction) => void }) {
  return (
    <div data-node-actions={node.id} className="flex items-center gap-1" onPointerDown={event => event.stopPropagation()}>
      <ActionBtn label="预览原始产物" action="preview" onClick={event => { event.stopPropagation(); onAction('preview') }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onAction('ctx-preview') }}>
        <ArrowUpRight size={13} />
      </ActionBtn>
      <ActionBtn label="复制产物引用" action="copy" onClick={event => { event.stopPropagation(); onAction('ctx-copy') }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onAction('ctx-copy') }}>
        <Copy size={13} />
      </ActionBtn>
      {node.dirty && (
        <ActionBtn label="重新对齐" action="realign" onClick={event => { event.stopPropagation(); onAction('realign') }}>
          <RotateCcw size={13} />
        </ActionBtn>
      )}
    </div>
  )
}

export default function CanvasBoard({
  canvas,
  onOpenNode,
  activeStep,
  onNodeAction,
  onDropped,
  onSelectNode,
  onCanvasChange,
  onError,
}: {
  canvas: Canvas
  onOpenNode?: (node: CanvasNode) => void
  activeStep?: string | null
  onNodeAction?: (action: NodeAction, node: CanvasNode) => void
  onDropped?: (target: 'canvas' | 'node' | 'edge' | 'menu', payload: { nodeId?: string; edgeId?: string; x: number; y: number }) => void
  onSelectNode?: (nodeId: string | null) => void
  onCanvasChange?: (canvas: Canvas) => void
  onError?: (message: string) => void
}) {
  const [localCanvas, setLocalCanvas] = useState<{ base: Canvas; value: Canvas } | null>(null)
  const currentCanvas = localCanvas?.base === canvas ? localCanvas.value : canvas
  const page = activeCanvasPage(currentCanvas)
  const document = activeCanvasDocument(currentCanvas)
  const nodes = document.nodes
  const edges = document.edges
  const target: Target = { projectId: currentCanvas.projectId, pageId: page.id, canvasId: document.id }
  const targetKey = targetKeyOf(target)

  const [view, setView] = useState<BoardViewport>(DEFAULT_VIEWPORT)
  const [viewReady, setViewReady] = useState(false)
  const [dragOverrides, setDragOverrides] = useState<Record<string, CanvasPosition>>({})
  const [guides, setGuides] = useState<Array<{ axis: 'v' | 'h' | 'ev' | 'eh'; pos: number; posB?: number; label: string }>>([])
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [pending, setPending] = useState<BoardCommand['type'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef(view)
  const nodesRef = useRef(nodes)
  const dragOverridesRef = useRef<Record<string, CanvasPosition>>({})
  const dragRef = useRef<{ nodeId: string; startClient: LayoutPoint; startPosition: CanvasPosition; targetKey: string } | null>(null)
  const panRef = useRef<{ startClient: LayoutPoint; startPan: LayoutPoint } | null>(null)
  const panMovedRef = useRef(false)
  const movedRef = useRef(false)
  const pendingRef = useRef(pending)
  const targetKeyRef = useRef(targetKey)
  const targetGenerationRef = useRef(0)
  const targetSwitchSequenceRef = useRef(0)
  const commandSequenceRef = useRef(0)
  const viewLoadSequenceRef = useRef(0)
  const viewSaveSequenceRef = useRef(0)
  const wheelTimerRef = useRef<number | null>(null)
  const restoredViewportRef = useRef(false)
  const didFitTargetRef = useRef<string | null>(null)
  const finishPointerRef = useRef<() => void>(() => {})
  const onSelectNodeRef = useRef(onSelectNode)
  const onErrorRef = useRef(onError)

  viewRef.current = view
  nodesRef.current = nodes
  pendingRef.current = pending
  targetKeyRef.current = targetKey
  onSelectNodeRef.current = onSelectNode
  onErrorRef.current = onError

  const setOverrides = useCallback((next: Record<string, CanvasPosition>) => {
    dragOverridesRef.current = next
    setDragOverrides(next)
  }, [])

  const clearDragOverride = useCallback((nodeId: string) => {
    if (!(nodeId in dragOverridesRef.current)) return
    const next = { ...dragOverridesRef.current }
    delete next[nodeId]
    setOverrides(next)
  }, [setOverrides])

  const applyView = useCallback((next: BoardViewport) => {
    const normalized = normalizeViewport(next) ?? DEFAULT_VIEWPORT
    viewRef.current = normalized
    setView(normalized)
  }, [])

  const reportError = useCallback((message: string) => {
    setError(message)
    onErrorRef.current?.(message)
  }, [])

  const publishCanvas = useCallback((next: Canvas) => {
    setLocalCanvas({ base: canvas, value: next })
    onCanvasChange?.(next)
  }, [canvas, onCanvasChange])

  const persistViewport = (viewport: BoardViewport) => {
    const api = window.api?.canvas?.viewState
    if (!api) return
    const capturedTarget = { ...target }
    const capturedKey = targetKey
    const generation = targetGenerationRef.current
    const sequence = ++viewSaveSequenceRef.current
    void api({
      type: 'viewport.set',
      ...capturedTarget,
      viewport: { x: viewport.pan.x, y: viewport.pan.y, zoom: viewport.zoom },
    }).then(() => {
      if (generation !== targetGenerationRef.current || capturedKey !== targetKeyRef.current || sequence !== viewSaveSequenceRef.current) return
    }).catch(reason => {
      if (generation !== targetGenerationRef.current || capturedKey !== targetKeyRef.current || sequence !== viewSaveSequenceRef.current) return
      reportError(errorMessage(reason))
    })
  }

  const runCommand = async (input: BoardCommand) => {
    if (pendingRef.current) return
    const api = window.api?.canvas?.command
    if (!api) {
      if (input.type === 'node.move') clearDragOverride(input.nodeId)
      reportError('画布命令接口不可用')
      return
    }
    const capturedTarget = { ...target }
    const capturedKey = targetKey
    const generation = targetGenerationRef.current
    const sequence = ++commandSequenceRef.current
    const envelope = {
      commandId: globalThis.crypto.randomUUID(),
      expectedRevision: currentCanvas.revision,
      projectId: currentCanvas.projectId,
    }
    let request: CanvasCommandRequest
    switch (input.type) {
      case 'page.create':
        request = { ...envelope, type: input.type }
        break
      case 'page.rename':
        request = { ...envelope, type: input.type, pageId: capturedTarget.pageId, title: input.title }
        break
      case 'page.delete':
        request = { ...envelope, type: input.type, pageId: capturedTarget.pageId, confirmNonEmpty: input.confirmNonEmpty }
        break
      case 'canvas.create':
        request = { ...envelope, type: input.type, pageId: capturedTarget.pageId }
        break
      case 'canvas.rename':
        request = { ...envelope, type: input.type, pageId: capturedTarget.pageId, canvasId: capturedTarget.canvasId, title: input.title }
        break
      case 'canvas.delete':
        request = { ...envelope, type: input.type, pageId: capturedTarget.pageId, canvasId: capturedTarget.canvasId, confirmNonEmpty: input.confirmNonEmpty }
        break
      case 'node.move':
        request = { ...envelope, type: input.type, pageId: capturedTarget.pageId, canvasId: capturedTarget.canvasId, nodeId: input.nodeId, position: input.position }
        break
    }
    pendingRef.current = input.type
    setPending(input.type)
    setError(null)
    const isCurrent = () => generation === targetGenerationRef.current
      && capturedKey === targetKeyRef.current
      && sequence === commandSequenceRef.current
    try {
      const result = await api(request)
      if (!isCurrent()) return
      const next = input.type === 'node.move' || input.type === 'page.rename' || input.type === 'canvas.rename'
        ? canvasAtTarget(result.canvas, capturedTarget)
        : result.canvas
      if (input.type === 'node.move') clearDragOverride(input.nodeId)
      publishCanvas(next)
      pendingRef.current = null
      setPending(null)
    } catch (reason) {
      if (!isCurrent()) return
      if (input.type === 'node.move') clearDragOverride(input.nodeId)
      pendingRef.current = null
      setPending(null)
      reportError(errorMessage(reason))
    }
  }

  const resetForTarget = useCallback(() => {
    targetGenerationRef.current += 1
    commandSequenceRef.current += 1
    viewLoadSequenceRef.current += 1
    viewSaveSequenceRef.current += 1
    if (wheelTimerRef.current !== null) {
      window.clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = null
    }
    dragRef.current = null
    panRef.current = null
    panMovedRef.current = false
    movedRef.current = false
    pendingRef.current = null
    setOverrides({})
    setGuides([])
    setMenu(null)
    setSelectedNodeId(null)
    setPending(null)
    setError(null)
    setRenameTarget(null)
    setDeleteConfirmation(null)
    setViewReady(false)
    applyView(DEFAULT_VIEWPORT)
    onSelectNodeRef.current?.(null)
  }, [applyView, setOverrides])

  useEffect(() => {
    resetForTarget()
    const generation = targetGenerationRef.current
    const capturedKey = targetKey
    const sequence = ++viewLoadSequenceRef.current
    const fallback = normalizeViewport(document.viewport)
    restoredViewportRef.current = Boolean(fallback)
    if (generation === targetGenerationRef.current && capturedKey === targetKeyRef.current && sequence === viewLoadSequenceRef.current) {
      applyView(fallback ?? DEFAULT_VIEWPORT)
      setViewReady(true)
    }
    return () => {
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current)
        wheelTimerRef.current = null
      }
    }
    // viewport 已随 Canvas v4 文档返回；挂载只读恢复，不再额外写 active.set。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])

  useEffect(() => {
    setSelectedNodeId(current => {
      if (current && nodes.some(node => node.id === current)) return current
      return nodes.find(node => node.status === 'active')?.id ?? null
    })
  }, [nodes])

  useEffect(() => {
    onSelectNodeRef.current?.(selectedNodeId)
  }, [selectedNodeId])

  const positionOf = (node: CanvasNode): CanvasPosition =>
    dragOverrides[node.id] ?? nodePosition(nodes, node)
  const positions = new Map(nodes.map(node => [node.id, positionOf(node)] as const))
  const bounds = boundsOf(nodes.map(node => positionOf(node)))
  const columns = Array.from(new Set(nodes.map(node => node.step)))
    .sort((a, b) => STAGE.findIndex(stage => stage.id === a) - STAGE.findIndex(stage => stage.id === b))
    .map((step, index) => ({
      step,
      index,
      nodes: nodes.filter(node => node.step === step),
    }))

  const fitCanvas = (save: boolean) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!bounds || !rect || rect.width <= 0 || rect.height <= 0) {
      const fallback: BoardViewport = { pan: { x: 0, y: 0 }, zoom: 0.5 }
      applyView(fallback)
      if (save) persistViewport(fallback)
      return
    }
    const zoom = clamp(Math.min(
      (rect.width - PAD_X * 2) / bounds.width,
      (rect.height - 120) / bounds.height,
    ), 0.5, 0.9)
    const next: BoardViewport = {
      pan: {
        x: (rect.width - bounds.width * zoom) / 2 - bounds.minX * zoom,
        y: (rect.height - bounds.height * zoom) / 2 - bounds.minY * zoom,
      },
      zoom,
    }
    applyView(next)
    if (save) persistViewport(next)
  }

  useEffect(() => {
    if (!viewReady || nodes.length === 0 || didFitTargetRef.current === targetKey) return
    didFitTargetRef.current = targetKey
    if (!restoredViewportRef.current) fitCanvas(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewReady, targetKey, nodes.length])

  useEffect(() => {
    if (!viewReady || activeStep == null || columns.length === 0) return
    const index = Math.max(0, columns.findIndex(column => column.step === activeStep))
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return
    const columnNodes = columns[index]?.nodes ?? []
    const top = columnNodes.length > 0 ? Math.min(...columnNodes.map(node => positionOf(node).y)) : PAD_TOP
    const zoom = viewRef.current.zoom
    applyView({
      pan: {
        x: rect.width / 2 - (PAD_X + index * (NODE_W + COL_GAP) + NODE_W / 2) * zoom,
        y: Math.max(20, 60 - top * zoom + PAD_TOP * zoom),
      },
      zoom,
    })
    // activeStep 联动居中不抢占 wheel/pan 的后续锚点。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, targetKey, viewReady, nodes.length])

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    viewLoadSequenceRef.current += 1
    setViewReady(true)
    const current = viewRef.current
    const zoom = clamp(current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_ZOOM, MAX_ZOOM)
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const worldX = (sx - current.pan.x) / current.zoom
    const worldY = (sy - current.pan.y) / current.zoom
    applyView({ pan: { x: sx - worldX * zoom, y: sy - worldY * zoom }, zoom })
    if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current)
    wheelTimerRef.current = window.setTimeout(() => {
      wheelTimerRef.current = null
      persistViewport(viewRef.current)
    }, 160)
  }

  const setZoom = (value: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    const current = viewRef.current
    const zoom = clamp(value, MIN_ZOOM, MAX_ZOOM)
    const sx = (rect?.width ?? 0) / 2
    const sy = (rect?.height ?? 0) / 2
    const worldX = (sx - current.pan.x) / current.zoom
    const worldY = (sy - current.pan.y) / current.zoom
    const next = { pan: { x: sx - worldX * zoom, y: sy - worldY * zoom }, zoom }
    applyView(next)
    persistViewport(next)
  }

  const worldPoint = (clientX: number, clientY: number): CanvasPosition => {
    const rect = viewportRef.current?.getBoundingClientRect()
    const current = viewRef.current
    return {
      x: (clientX - (rect?.left ?? 0) - current.pan.x) / current.zoom,
      y: (clientY - (rect?.top ?? 0) - current.pan.y) / current.zoom,
    }
  }

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    setMenu(null)
    setSelectedNodeId(null)
    onSelectNode?.(null)
    panRef.current = {
      startClient: { x: event.clientX, y: event.clientY },
      startPan: { ...viewRef.current.pan },
    }
    panMovedRef.current = false
    onDropped?.('canvas', worldPoint(event.clientX, event.clientY))
  }

  const handleWindowPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current
    if (drag) {
      const currentNodes = nodesRef.current
      const dx = (event.clientX - drag.startClient.x) / viewRef.current.zoom
      const dy = (event.clientY - drag.startClient.y) / viewRef.current.zoom
      if (Math.abs(event.clientX - drag.startClient.x) > 2 || Math.abs(event.clientY - drag.startClient.y) > 2) movedRef.current = true
      const raw = { x: drag.startPosition.x + dx, y: drag.startPosition.y + dy }
      const others = currentNodes.filter(node => node.id !== drag.nodeId).map(node =>
        dragOverridesRef.current[node.id] ?? nodePosition(currentNodes, node))
      const snapped = snapNode(raw.x, raw.y, others, 6 / viewRef.current.zoom)
      const position = finitePosition(snapped)
      if (!position || drag.targetKey !== targetKeyRef.current) return
      setOverrides({ ...dragOverridesRef.current, [drag.nodeId]: position })
      setGuides(snapped.guides)
      return
    }
    const pan = panRef.current
    if (pan) {
      const dx = event.clientX - pan.startClient.x
      const dy = event.clientY - pan.startClient.y
      if (dx !== 0 || dy !== 0) panMovedRef.current = true
      applyView({ pan: { x: pan.startPan.x + dx, y: pan.startPan.y + dy }, zoom: viewRef.current.zoom })
    }
  }, [applyView, setOverrides])

  const finishPointer = () => {
    const drag = dragRef.current
    if (drag) {
      dragRef.current = null
      setGuides([])
      // pointermove/pointerup 同一批次时 state 可能尚未渲染，最终位置只读同步 ref。
      const finalPosition = finitePosition(dragOverridesRef.current[drag.nodeId] ?? drag.startPosition)
      const didMove = movedRef.current
      if (didMove && finalPosition && drag.targetKey === targetKeyRef.current) {
        void runCommand({ type: 'node.move', nodeId: drag.nodeId, position: finalPosition })
        window.setTimeout(() => { movedRef.current = false }, 0)
      } else {
        clearDragOverride(drag.nodeId)
        movedRef.current = false
      }
    }
    if (panRef.current) {
      panRef.current = null
      if (panMovedRef.current) persistViewport(viewRef.current)
      panMovedRef.current = false
    }
  }
  finishPointerRef.current = finishPointer

  useEffect(() => {
    const up = () => finishPointerRef.current()
    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', up)
    }
  }, [handleWindowPointerMove])

  const startNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, node: CanvasNode) => {
    if (event.button !== 0) return
    event.stopPropagation()
    setSelectedNodeId(node.id)
    onSelectNode?.(node.id)
    if (node.status === 'active' || pendingRef.current) return
    event.preventDefault()
    setMenu(null)
    movedRef.current = false
    dragRef.current = {
      nodeId: node.id,
      startClient: { x: event.clientX, y: event.clientY },
      startPosition: positionOf(node),
      targetKey,
    }
    setGuides([])
  }

  const openNode = (node: CanvasNode) => {
    setSelectedNodeId(node.id)
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    onOpenNode?.(node)
  }

  const nodeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, node: CanvasNode) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openNode(node)
    }
  }

  const openContextMenu = (event: ReactMouseEvent, nodeId?: string) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, nodeId })
    if (nodeId) {
      setSelectedNodeId(nodeId)
      onSelectNode?.(nodeId)
    }
  }

  const dropOn = (event: React.DragEvent<HTMLDivElement>, node?: CanvasNode) => {
    event.preventDefault()
    event.stopPropagation()
    const point = worldPoint(event.clientX, event.clientY)
    onDropped?.(node ? 'node' : 'canvas', node ? { ...point, nodeId: node.id } : point)
  }

  const changeTarget = (pageId: string, canvasId: string) => {
    if (pageId === target.pageId && canvasId === target.canvasId) return
    const previous = currentCanvas
    const previousKey = targetKey
    const nextTarget: Target = { projectId: currentCanvas.projectId, pageId, canvasId }
    const nextKey = targetKeyOf(nextTarget)
    const sequence = ++targetSwitchSequenceRef.current
    targetKeyRef.current = nextKey
    publishCanvas(canvasAtTarget(currentCanvas, nextTarget))
    const api = window.api?.canvas?.viewState
    if (!api) return
    void api({ type: 'active.set', ...nextTarget }).catch(reason => {
      if (sequence !== targetSwitchSequenceRef.current || nextKey !== targetKeyRef.current) return
      targetKeyRef.current = previousKey
      publishCanvas(previous)
      reportError(`切换创作页或画布失败：${errorMessage(reason)}`)
    })
  }

  const startRename = (kind: RenameTarget['kind']) => {
    setDeleteConfirmation(null)
    setError(null)
    setRenameTarget({ kind, title: kind === 'page' ? page.title : document.title })
  }

  const saveRename = () => {
    if (!renameTarget || pendingRef.current) return
    const title = renameTarget.title.trim()
    if (!title || title.length > 80) {
      reportError('标题需为 1–80 个字符')
      return
    }
    const kind = renameTarget.kind
    if (title === (kind === 'page' ? page.title : document.title)) {
      setRenameTarget(null)
      return
    }
    setRenameTarget(null)
    void runCommand(kind === 'page'
      ? { type: 'page.rename', title }
      : { type: 'canvas.rename', title })
  }

  const requestDelete = (kind: DeleteConfirmation['kind']) => {
    const nonEmpty = kind === 'page'
      ? page.canvases.length > 1 || page.canvases.some(item => item.nodes.length > 0 || item.edges.length > 0)
      : document.nodes.length > 0 || document.edges.length > 0
    setRenameTarget(null)
    setError(null)
    if (nonEmpty) {
      setDeleteConfirmation({ kind })
      return
    }
    void runCommand(kind === 'page' ? { type: 'page.delete' } : { type: 'canvas.delete' })
  }

  const confirmDelete = () => {
    if (!deleteConfirmation || pendingRef.current) return
    const kind = deleteConfirmation.kind
    setDeleteConfirmation(null)
    void runCommand(kind === 'page'
      ? { type: 'page.delete', confirmNonEmpty: true }
      : { type: 'canvas.delete', confirmNonEmpty: true })
  }

  const emitNodeAction = (node: CanvasNode, action: BoardNodeAction) => {
    const mapped: NodeAction = action === 'realign' ? 'regen'
      : action === 'ctx-copy' || action === 'ctx-ref' ? 'copy'
        : action === 'invalidate' ? 'invalidate' : 'view'
    onNodeAction?.(mapped, node)
  }

  const dirtyBanner = deriveDirtyBanner(nodes)
  const drift = driftReminder(nodes)
  const briefVersion = latestBriefVersion(nodes)
  const menuNode = menu?.nodeId ? nodes.find(node => node.id === menu.nodeId) : undefined
  const minimapScale = bounds ? Math.min(180 / bounds.width, 80 / bounds.height) : 1
  const minimapOffset = bounds ? {
    x: (180 - bounds.width * minimapScale) / 2,
    y: (80 - bounds.height * minimapScale) / 2,
  } : { x: 0, y: 0 }

  const viewportRect = viewportRef.current?.getBoundingClientRect()
  const miniViewport = bounds && viewportRect && viewportRect.width > 0 && viewportRect.height > 0 ? {
    left: minimapOffset.x + ((-view.pan.x / view.zoom) - bounds.minX) * minimapScale,
    top: minimapOffset.y + ((-view.pan.y / view.zoom) - bounds.minY) * minimapScale,
    width: (viewportRect.width / view.zoom) * minimapScale,
    height: (viewportRect.height / view.zoom) * minimapScale,
  } : null

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-win">
      <div data-canvas-management className="shrink-0 space-y-1.5 border-b border-line bg-surface px-3 py-2" aria-busy={pending !== null}>
        <div className="flex items-center gap-1.5 overflow-x-auto" aria-label="创作页管理">
          <span className="shrink-0 text-[10px] font-semibold text-muted">创作页</span>
          <div role="tablist" aria-label="创作页" className="flex min-w-0 items-center gap-1.5">
            {currentCanvas.pages.map(item => renameTarget?.kind === 'page' && item.id === page.id ? (
              <div key={item.id} className="flex shrink-0 items-center gap-1">
                <input
                  autoFocus
                  aria-label="创作页名称"
                  data-canvas-rename="page"
                  value={renameTarget.title}
                  onChange={event => setRenameTarget({ kind: 'page', title: event.target.value })}
                  onKeyDown={event => {
                    if (event.key === 'Enter') { event.preventDefault(); saveRename() }
                    if (event.key === 'Escape') { event.preventDefault(); setRenameTarget(null) }
                  }}
                  className="w-32 rounded border border-violet bg-win px-2 py-1 text-[11px] text-ink outline-none"
                />
                <button type="button" aria-label="保存页名" className="text-[11px] text-violet" onClick={saveRename}>保存</button>
                <button type="button" className="text-[11px] text-muted" onClick={() => setRenameTarget(null)}>取消</button>
              </div>
            ) : (
              <button
                key={item.id}
                type="button"
                role="tab"
                data-page-id={item.id}
                aria-selected={item.id === page.id}
                onClick={() => changeTarget(item.id, item.activeCanvasId)}
                className={`max-w-40 shrink-0 truncate rounded-md border px-2 py-1 text-[11px] ${item.id === page.id ? 'border-violet/30 bg-violet-soft font-semibold text-violet' : 'border-transparent text-muted hover:bg-violet-soft/60'}`}
                title={item.title}
              >
                {item.title}
              </button>
            ))}
          </div>
          <button type="button" data-page-action="create" aria-label="新建创作页" title="新建创作页" disabled={pending !== null || currentCanvas.pages.length >= 6} onClick={() => void runCommand({ type: 'page.create' })} className="grid h-6 w-6 shrink-0 place-items-center rounded text-violet hover:bg-violet-soft disabled:opacity-40">
            <FolderPlus size={13} />
          </button>
          <button type="button" data-page-action="rename" aria-label="重命名创作页" title="重命名创作页" disabled={pending !== null} onClick={() => startRename('page')} className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-violet-soft hover:text-violet disabled:opacity-40">
            <Pencil size={12} />
          </button>
          <button type="button" data-page-action="delete" aria-label="删除创作页" title={currentCanvas.pages.length <= 1 ? '每个项目至少保留一个创作页' : '删除创作页'} disabled={pending !== null || currentCanvas.pages.length <= 1} onClick={() => requestDelete('page')} className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-40">
            <Trash2 size={12} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto" aria-label="画布管理">
          <span className="shrink-0 text-[10px] font-semibold text-muted">画布</span>
          {renameTarget?.kind === 'canvas' ? (
            <div className="flex shrink-0 items-center gap-1">
              <input
                autoFocus
                aria-label="画布名称"
                data-canvas-rename="canvas"
                value={renameTarget.title}
                onChange={event => setRenameTarget({ kind: 'canvas', title: event.target.value })}
                onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); saveRename() }
                  if (event.key === 'Escape') { event.preventDefault(); setRenameTarget(null) }
                }}
                className="w-32 rounded border border-violet bg-win px-2 py-1 text-[11px] text-ink outline-none"
              />
              <button type="button" aria-label="保存画布名" className="text-[11px] text-violet" onClick={saveRename}>保存</button>
              <button type="button" className="text-[11px] text-muted" onClick={() => setRenameTarget(null)}>取消</button>
            </div>
          ) : (
            <select aria-label="当前画布" value={document.id} onChange={event => changeTarget(page.id, event.target.value)} className="max-w-40 shrink-0 rounded-md border border-line bg-win px-2 py-1 text-[11px] text-ink">
              {page.canvases.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          )}
          <button type="button" data-canvas-action="create" aria-label="新建画布" title="新建画布" disabled={pending !== null} onClick={() => void runCommand({ type: 'canvas.create' })} className="grid h-6 w-6 shrink-0 place-items-center rounded text-violet hover:bg-violet-soft disabled:opacity-40">
            <Plus size={14} />
          </button>
          <button type="button" data-canvas-action="rename" aria-label="重命名画布" title="重命名画布" disabled={pending !== null} onClick={() => startRename('canvas')} className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-violet-soft hover:text-violet disabled:opacity-40">
            <Pencil size={12} />
          </button>
          <button type="button" data-canvas-action="delete" aria-label="删除画布" title={page.canvases.length <= 1 ? '每个创作页至少保留一个画布' : '删除画布'} disabled={pending !== null || page.canvases.length <= 1} onClick={() => requestDelete('canvas')} className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-40">
            <Trash2 size={12} />
          </button>
          {pending && <span className="shrink-0 text-[10px] text-muted">{pending === 'node.move' ? '正在保存节点位置…' : '正在更新画布…'}</span>}
        </div>
        {deleteConfirmation && (
          <div role="group" aria-label="删除确认" className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] dark:border-red-900 dark:bg-red-950/30">
            <span className="text-ink">仅删除结构，不删除产物或资产文件。</span>
            <button type="button" className="font-semibold text-red-500" onClick={confirmDelete}>仍删除</button>
            <button type="button" className="text-muted" onClick={() => setDeleteConfirmation(null)}>取消</button>
          </div>
        )}
        {error && <div role="alert" className="text-[11px] text-red-500">{error}</div>}
      </div>

      {dirtyBanner && (
        <div data-dirty-banner className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
          <div>有 {dirtyBanner.count} 个产物基于旧版立项（最新 {briefVersion}），内容可能与最新立项不一致。</div>
          {drift && <div className="mt-0.5">{drift}</div>}
        </div>
      )}

      <div
        ref={viewportRef}
        data-canvas-bg
        data-viewport
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-[radial-gradient(circle,rgba(108,92,231,0.14)_1px,transparent_1px)] [background-size:20px_20px] active:cursor-grabbing"
        onPointerDown={startPan}
        onWheel={handleWheel}
        onContextMenu={event => openContextMenu(event)}
        onDragOver={event => event.preventDefault()}
        onDrop={event => dropOn(event)}
      >
        <div
          data-canvas-bg
          data-world
          className="absolute left-0 top-0 min-h-full min-w-full origin-top-left"
          style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}
        >
          {columns.map(column => {
            const active = activeStep === column.step
            return (
              <div
                key={column.step}
                className={`absolute top-0 rounded-xl border transition-colors ${active ? 'border-violet/30 bg-violet/[0.055]' : 'border-line/50 bg-violet/[0.025]'}`}
                style={{ left: PAD_X + column.index * (NODE_W + COL_GAP) - 14, top: 8, width: NODE_W + 28, minHeight: Math.max(240, column.nodes.length * ROW_H + 60) }}
              >
                <div className={`px-3 pt-2 text-[11px] font-bold ${active ? 'font-extrabold text-violet' : 'text-muted'}`}>
                  STAGE {column.step} · {STEP_LABELS[column.step]}
                </div>
              </div>
            )
          })}

          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
            <defs>
              {STAGE.map(stage => (
                <marker key={stage.id} id={`arrow-${stage.id}`} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill={stage.color} />
                </marker>
              ))}
              <marker id="arrow-neutral" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#A5B4FC" />
              </marker>
            </defs>
            {edges.map(edge => {
              const from = nodes.find(node => node.id === edge.from)
              const to = nodes.find(node => node.id === edge.to)
              if (!from || !to) return null
              const a = positions.get(from.id)!
              const b = positions.get(to.id)!
              const sx = a.x + NODE_W
              const sy = a.y + NODE_H / 2
              const tx = b.x
              const ty = b.y + NODE_H / 2
              const mx = (sx + tx) / 2
              const color = STAGE.find(stage => stage.id === from.step)?.color ?? '#A5B4FC'
              const marker = STAGE.some(stage => stage.id === from.step) ? `url(#arrow-${from.step})` : 'url(#arrow-neutral)'
              return (
                <path
                  key={edge.id}
                  data-edge={edge.id}
                  d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray={edge.auto ? '4 3' : undefined}
                  fill="none"
                  markerEnd={marker}
                />
              )
            })}
          </svg>

          {nodes.map(node => {
            const position = positions.get(node.id)!
            const dirty = Boolean(node.dirty)
            const selected = selectedNodeId === node.id
            const refPath = node.ref?.path ?? '未落盘'
            const fileName = refPath.split(/[\\/]/).pop() ?? refPath
            const inbound = edges.filter(edge => edge.to === node.id).length
            const outbound = edges.filter(edge => edge.from === node.id).length
            const assetCount = node.assetIds?.length ?? 0
            return (
              <div
                key={node.id}
                data-node-id={node.id}
                data-dirty={dirty ? 'true' : undefined}
                role="button"
                tabIndex={0}
                aria-label={`${kindLabel(node.kind)}：${node.title}`}
                className={`absolute bg-surface flex flex-col rounded-lg border p-2.5 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet/40 ${selected ? 'border-violet ring-2 ring-violet/25' : dirty ? 'border-amber-400 ring-1 ring-amber-300/60' : 'border-line'} ${node.status === 'active' ? 'animate-pulse cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                style={{ left: position.x, top: position.y, width: NODE_W, height: NODE_H }}
                onPointerDown={event => startNodeDrag(event, node)}
                onClick={() => openNode(node)}
                onKeyDown={event => nodeKeyDown(event, node)}
                onContextMenu={event => openContextMenu(event, node.id)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => dropOn(event, node)}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-violet">{kindLabel(node.kind)}</span>
                  {dirty && <span data-dirty-badge={node.id} title={dirtyTitle(node)} className="shrink-0 text-xs text-amber-500">⚠</span>}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-ink">{node.title}</div>
                <div className="mt-0.5 truncate text-[9px] text-muted" title={refPath}>{fileName}</div>
                <div className="mt-auto flex items-end justify-between gap-1">
                  <div className="min-w-0 text-[9px] text-muted">
                    <div>
                      <span>{node.status === 'done' ? '已完成' : node.status === 'active' ? '进行中' : '待生成'}</span>
                      <span> · {inbound}入/{outbound}出</span>
                    </div>
                    {assetCount > 0 && <div aria-label={`关联资产 ${assetCount} 项`} data-asset-count={node.id}>资产 {assetCount}</div>}
                  </div>
                  <NodeActions node={node} onAction={action => emitNodeAction(node, action)} />
                </div>
              </div>
            )
          })}

          {guides.map((guide, index) => {
            const vertical = guide.axis === 'v' || guide.axis === 'ev'
            const horizontal = guide.axis === 'h' || guide.axis === 'eh'
            return (
              <div key={`${guide.axis}-${index}`} className="pointer-events-none absolute z-20">
                {(guide.axis === 'v' || guide.axis === 'h') && (
                  <div data-drag-guide={`${guide.axis}-${guide.pos}`} className="absolute bg-violet/70" style={vertical ? { left: guide.pos, top: -10000, width: 1, height: 20000 } : { left: -10000, top: guide.pos, width: 20000, height: 1 }} />
                )}
                {(guide.axis === 'ev' || guide.axis === 'eh') && (
                  <>
                    <div data-drag-guide={`${guide.axis}-${guide.pos}`} className="absolute bg-teal-400/70" style={guide.axis === 'ev' ? { left: -10000, top: guide.pos, width: 20000, height: 1 } : { left: guide.pos, top: -10000, width: 1, height: 20000 }} />
                    {guide.posB !== undefined && <div data-drag-guide={`${guide.axis}-${guide.posB}`} className="absolute bg-teal-400/70" style={guide.axis === 'ev' ? { left: -10000, top: guide.posB, width: 20000, height: 1 } : { left: guide.posB, top: -10000, width: 1, height: 20000 }} />}
                  </>
                )}
                <div data-snap-hint className={`absolute rounded px-1 py-0.5 text-[9px] text-white ${guide.axis === 'ev' || guide.axis === 'eh' ? 'bg-teal-500' : 'bg-violet'}`} style={{ left: vertical ? guide.pos + 4 : 8, top: horizontal ? guide.pos + 4 : 8 }}>
                  {guide.label}
                </div>
              </div>
            )
          })}
        </div>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">
            <div>
              <MapIcon className="mx-auto mb-2 opacity-50" size={26} />
              还没有任何产物，从右下角「回聊立项」开始，或在左侧直接填写立项单。
            </div>
          </div>
        )}

        {nodes.length > 0 && <div data-drag-hint className="pointer-events-none absolute bottom-3 left-3 rounded bg-surface/80 px-2 py-1 text-[9px] text-muted">拖拽卡片调整位置 · 滚轮缩放 · 空白拖拽平移 · 右键更多操作</div>}

        {bounds && (
          <div data-minimap className="absolute bottom-3 right-3 h-[86px] w-[186px] overflow-hidden rounded-md border border-line bg-surface/90 p-[3px] shadow-sm" title="小地图">
            <div className="relative h-20 w-[180px]">
              {nodes.map(node => {
                const position = positions.get(node.id)!
                return <div key={node.id} className={`absolute rounded-[1px] ${node.dirty ? 'bg-amber-400' : selectedNodeId === node.id ? 'bg-violet' : 'bg-violet/35'}`} style={{ left: minimapOffset.x + (position.x - bounds.minX) * minimapScale, top: minimapOffset.y + (position.y - bounds.minY) * minimapScale, width: Math.max(2, NODE_W * minimapScale), height: Math.max(2, NODE_H * minimapScale) }} />
              })}
              {miniViewport && <div data-minimap-viewport className="pointer-events-none absolute border border-violet/70 bg-violet/5" style={miniViewport} />}
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-line bg-surface/95 p-1 shadow-sm" onPointerDown={event => event.stopPropagation()}>
          <button type="button" aria-label="缩小" title="缩小" className="grid h-7 w-7 place-items-center rounded hover:bg-violet-soft" onClick={() => setZoom(viewRef.current.zoom / 1.12)}><Minus size={13} /></button>
          <button type="button" aria-label="当前缩放" data-zoom-level className="min-w-12 text-[10px] font-semibold text-muted" onClick={() => setZoom(0.9)}>{Math.round(view.zoom * 100)}%</button>
          <button type="button" aria-label="放大" title="放大" className="grid h-7 w-7 place-items-center rounded hover:bg-violet-soft" onClick={() => setZoom(viewRef.current.zoom * 1.12)}><Plus size={13} /></button>
          <button type="button" aria-label="适应内容" title="适应内容" className="grid h-7 w-7 place-items-center rounded hover:bg-violet-soft" onClick={() => fitCanvas(true)}><Fit size={13} /></button>
        </div>
      </div>

      {menu && (!menu.nodeId || menuNode) && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={menuNode ? [
            { key: 'preview', label: '预览原始产物', onSelect: () => emitNodeAction(menuNode, 'ctx-preview') },
            { key: 'copy', label: '复制产物引用', onSelect: () => emitNodeAction(menuNode, 'ctx-copy') },
            { key: 'ref', label: '引用到对话', onSelect: () => emitNodeAction(menuNode, 'ctx-ref') },
            { key: 'invalidate', label: '标记失效', onSelect: () => emitNodeAction(menuNode, 'invalidate') },
            ...(menuNode.dirty ? [{ key: 'realign', label: '重新对齐', onSelect: () => emitNodeAction(menuNode, 'realign') }] : []),
          ] : [
            { key: 'fit', label: '适应内容', onSelect: () => fitCanvas(true) },
            { key: 'reset-zoom', label: '重置缩放', onSelect: () => setZoom(0.9) },
          ]}
        />
      )}
    </div>
  )
}
