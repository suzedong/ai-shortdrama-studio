import { useEffect, useRef, useState } from 'react'
import type { NodeStatus, Stage } from '@shared/types'

export type EntryAction = 'edit' | 'chat' | 'view'

export const ENTRY_ICONS: Record<EntryAction, string> = {
  edit: '✎',
  chat: '💬',
  view: '👁',
}

interface CanvasNode {
  id: Stage
  title: string
  subtitle: string
  status: NodeStatus
  detail?: React.ReactNode
}

export interface CanvasGroup {
  id: string
  label: string
  nodes: CanvasNode[]
}

interface Props {
  groups: CanvasGroup[]
  // hover 入口按钮（D1 入口表，App 按门控计算后传入）
  entries?: Partial<Record<Stage, EntryAction[]>>
  // 门控：loading/gate/activeUnlock/activeDraft 时普通入口隐藏（背景查看例外保留）
  gated?: boolean
  // 门控期间保留的只读查看入口（background 查看/编辑例外）
  viewEntries?: Partial<Record<Stage, boolean>>
  // 可手动起跑的失效节点（isRunnable 通过）
  regenStages?: Stage[]
  // 失效但不可起跑的节点（disabled + tooltip）
  invalidatedStages?: Stage[]
  regenHint?: string | ((stage: Stage) => string)
  onEntry?: (stage: Stage, action: EntryAction) => void
  onRegenerate?: (stage: Stage) => void
  // 整卡点击 / 👁：打开只读查看（feature-006）
  onOpenViewer?: (stage: Stage) => void
}

const NODE_W = 224
const LINK_W = 32

function rowWidth(count: number): number {
  return count * NODE_W + Math.max(0, count - 1) * LINK_W
}

// 连线颜色（口径：以连接左侧节点状态为准；F17/OD §4.6）
function linkColor(status: NodeStatus, invalidated: boolean): string {
  if (invalidated) return 'rgba(225,86,63,0.5)' // bad/50
  if (status === 'done') return 'rgba(38,166,91,0.4)' // ok/40
  if (status === 'active') return 'rgba(124,58,237,0.5)' // violet/50
  return 'rgba(223,226,231,1)' // line
}

// 32px 宽槽内的水平连线：中点直线 + 两端小圆；
// 垂直位置对齐原设计（距卡片顶约 36px，即节点头部区）
function LinkSvg({ color }: { color: string }) {
  return (
    <svg
      width={LINK_W}
      height={44}
      viewBox="0 0 32 44"
      className="shrink-0"
      preserveAspectRatio="none"
      data-testid="canvas-link"
    >
      <line x1="2" y1="36" x2="30" y2="36" stroke={color} strokeWidth="2" />
      <circle cx="2" cy="36" r="2" fill={color} />
      <circle cx="30" cy="36" r="2" fill={color} />
    </svg>
  )
}

export default function StageCanvas({
  groups, entries, gated, viewEntries, regenStages, invalidatedStages, regenHint, onEntry, onRegenerate, onOpenViewer,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const maxRowW = groups.reduce((m, g) => Math.max(m, rowWidth(g.nodes.length)), 0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const availW = el.clientWidth - 64
      setScale(Math.min(1, availW / maxRowW))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxRowW])

  const regenSet = new Set(regenStages)
  const invalidatedSet = new Set(invalidatedStages)

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden p-8"
      style={{
        // 点阵背景：size 随 scale 换算（OD §4.6）
        backgroundImage: 'radial-gradient(circle, #dfe2e7 1px, transparent 1px)',
        backgroundSize: `${16 * scale}px ${16 * scale}px`,
      }}
      data-testid="canvas-dots"
    >
      <div
        className="w-max origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        <div className="space-y-10">
          {groups.map(group => (
            <div key={group.id}>
              <div className="text-xs text-muted uppercase tracking-wide mb-3">{group.label}</div>
              <div className="flex items-start">
                {group.nodes.map((n, i) => {
                  const isInvalidated = invalidatedSet.has(n.id)
                  const isRunnable = regenSet.has(n.id)
                  const nodeEntries = (isInvalidated || gated) ? [] : (entries?.[n.id] ?? [])
                  const canView = viewEntries?.[n.id] === true
                  const showEntries = nodeEntries.length > 0 || canView
                  return (
                    <div key={n.id} className="flex items-start group/node">
                      <div
                        onClick={canView ? () => onOpenViewer?.(n.id) : undefined}
                        className={`w-56 rounded-xl border bg-white shadow-card transition-all ${canView ? 'cursor-pointer' : ''} ${
                          isInvalidated
                            ? 'border-warn border-dashed'
                            : n.status === 'active' ? 'border-violet ring-2 ring-violet-soft pulse'
                            : n.status === 'done' ? 'border-ok/40' : 'border-line opacity-60'
                        }`}
                        style={{ animationDelay: `${i * 0.08}s` }}
                      >
                        <div className="px-3.5 py-2.5 border-b border-line flex items-center gap-2">
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[11px] ${
                            isInvalidated ? 'bg-warn text-white' :
                            n.status === 'done' ? 'bg-ok text-white' :
                            n.status === 'active' ? 'bg-violet text-white' : 'bg-muted/20 text-muted'
                          }`}>
                            {isInvalidated ? '●' : n.status === 'done' ? '✓' : i + 1}
                          </span>
                          <span className="text-sm font-semibold">{n.title}</span>
                          {showEntries && (
                            <span className="ml-auto flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
                              {canView && (
                                <button
                                  title="查看"
                                  data-testid={`entry-${n.id}-view`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (onOpenViewer) onOpenViewer(n.id)
                                    else onEntry?.(n.id, 'view')
                                  }}
                                  className="w-6 h-6 flex items-center justify-center text-xs text-muted hover:text-violet"
                                >👁</button>
                              )}
                              {nodeEntries.map(a => (
                                <button
                                  key={a}
                                  title={a === 'edit' ? '编辑' : '对话修改'}
                                  data-testid={`entry-${n.id}-${a}`}
                                  onClick={(e) => { e.stopPropagation(); onEntry?.(n.id, a) }}
                                  className="w-6 h-6 flex items-center justify-center text-xs text-muted hover:text-violet"
                                >{ENTRY_ICONS[a]}</button>
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="p-3.5 text-xs min-h-[60px]">
                          {n.detail ? (
                            <div className="text-fg">{n.detail}</div>
                          ) : (
                            <span className="text-muted">{n.subtitle}</span>
                          )}
                          {isInvalidated && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (isRunnable) onRegenerate?.(n.id) }}
                              disabled={!isRunnable}
                              title={isRunnable ? '重新生成' : (typeof regenHint === 'function' ? regenHint(n.id) : regenHint) || '请先完成上游节点'}
                              data-testid={`regen-${n.id}`}
                              className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium ${
                                isRunnable
                                  ? 'bg-violet text-white hover:opacity-90'
                                  : 'bg-muted/20 text-muted cursor-not-allowed'
                              }`}
                            >
                              重新生成
                            </button>
                          )}
                        </div>
                      </div>
                      {i < group.nodes.length - 1 && (
                        <LinkSvg color={linkColor(n.status, isInvalidated)} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
