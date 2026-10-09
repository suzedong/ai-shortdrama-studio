// feature-020 · 多步画布（契约 §3、设计说明 §2）
// 数据驱动：节点按 canvas.nodes 的 step 去重分组（不写死步骤），
// 组内沿用横向节点卡 + 右箭头，跨组 auto 边以竖箭头呈现；
// renderer 不推导节点状态、不手画业务连线。
import type { Canvas, CanvasNode } from '@shared/types'

const STATUS_META: Record<CanvasNode['status'], { label: string; cls: string; dot: string }> = {
  pending: { label: '待生成', cls: 'border-line bg-white text-muted', dot: 'bg-muted' },
  active: { label: '进行中', cls: 'border-violet bg-violet-soft text-violet', dot: 'bg-violet pulse' },
  done: { label: '已完成', cls: 'border-line bg-white text-ok', dot: 'bg-ok' },
  invalidated: { label: '已失效', cls: 'border-line bg-white text-bad', dot: 'bg-bad' },
}

const KIND_LABEL: Record<string, string> = {
  diagnosis: '选题诊断',
  'visual-style': '视觉风格',
  brief: '立项单',
  outline: '故事大纲',
  profiles: '人物小传',
  scenes: '第一集分场',
  dialogue: '第一集台词',
}

// 步骤名映射（集中维护，后续步骤接入时扩展）
const STEP_LABEL: Record<string, string> = {
  '0': '立项',
  '1': '故事',
  '2': '剧本分场',
}

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind
}

export { kindLabel }

function stepLabel(step: string): string {
  return STEP_LABEL[step] ?? `步骤 ${step}`
}

interface Props {
  canvas: Canvas
  // feature-022：有 ref.path 的节点可点击打开只读查看器（契约 §3）
  onOpenNode?: (node: CanvasNode) => void
}

export default function CanvasBoard({ canvas, onOpenNode }: Props) {
  const { nodes, edges } = canvas

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center">
        <p className="text-sm leading-6 text-muted">
          还没有任何产物。
          <br />
          在下方输入你的想法，showrunner 会按当前阶段依次产出产物并请你裁决确认门。
        </p>
      </div>
    )
  }

  // 按节点首次出现顺序去重得到步骤分组（不写死步骤）
  const steps: string[] = []
  for (const n of nodes) {
    if (!steps.includes(n.step)) steps.push(n.step)
  }
  const stepOf = new Map(nodes.map(n => [n.id, n.step]))
  const groups = steps.map(step => ({
    step,
    nodes: nodes.filter(n => n.step === step),
  }))

  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink">创作画布</div>
        <div className="text-xs text-muted">{nodes.length} 个产物 · {edges.length} 条连线</div>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-2">
        {groups.map((group, gi) => {
          const groupNodeIds = new Set(group.nodes.map(n => n.id))
          const innerEdges = edges.filter(e => groupNodeIds.has(e.from) && groupNodeIds.has(e.to))
          const crossEdges = gi > 0
            ? edges.filter(e => stepOf.get(e.from) === steps[gi - 1] && stepOf.get(e.to) === group.step)
            : []
          return (
            <div key={group.step}>
              {gi > 0 && (
                <div className="flex items-center gap-2 py-1 pl-6 text-muted">
                  <svg width="16" height="28" viewBox="0 0 16 28" fill="none" aria-hidden="true">
                    <path d="M8 0 V24 M3 20 L8 25 L13 20" stroke="#B9BED6" strokeWidth="1.5" />
                  </svg>
                  {crossEdges.length > 0 && (
                    <span className="text-[11px]">
                      auto：{crossEdges.map(e => `${e.from} → ${e.to}`).join('，')}
                    </span>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-line bg-canvas/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-medium text-ink">第 {group.step} 步 · {stepLabel(group.step)}</div>
                  <div className="text-[11px] text-muted">{group.nodes.length} 个产物 · {innerEdges.length} 条连线</div>
                </div>
                <div className="flex items-stretch gap-3 overflow-x-auto">
                  {group.nodes.map((node, i) => {
                    const meta = STATUS_META[node.status]
                    const openable = Boolean(node.ref?.path) && Boolean(onOpenNode)
                    return (
                      <div key={node.id} className="flex items-center gap-3">
                        {i > 0 && (
                          <svg width="28" height="16" viewBox="0 0 28 16" fill="none" aria-hidden="true">
                            <path d="M0 8 H24 M20 3 L25 8 L20 13" stroke="#B9BED6" strokeWidth="1.5" />
                          </svg>
                        )}
                        <div
                          className={`node-in w-44 shrink-0 rounded-xl border p-4 ${meta.cls} ${
                            openable ? 'cursor-pointer hover:border-violet' : ''
                          }`}
                          role={openable ? 'button' : undefined}
                          tabIndex={openable ? 0 : undefined}
                          onClick={openable ? () => onOpenNode!(node) : undefined}
                          onKeyDown={openable ? e => { if (e.key === 'Enter') onOpenNode!(node) } : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                            <span className="text-xs font-medium">{kindLabel(node.kind)}</span>
                          </div>
                          <div className="mt-2 text-sm font-medium text-ink">{node.title}</div>
                          <div className="mt-1 text-xs">{meta.label}</div>
                          {node.ref?.path && (
                            <div className="mt-3 truncate rounded bg-canvas px-2 py-1 text-[11px] text-muted" title={node.ref.path}>
                              {node.ref.path}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
