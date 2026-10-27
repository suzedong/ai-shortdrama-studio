// feature-008 · 立项过程链式呈现：STAGE 0 顶部恒显链态条（契约 §3）
// 三节点「① 选题诊断 → ② 故事前提 → 🚪 定案卡」+ 状态徽标 + x/6、x/5 精确进度；
// 纯订阅零写入（captureList 首拉 + onCaptureChanged 全量替换，CaptureBar L33-41 同模式）；
// 🚪 镜像不审批：待拍板点击展开只读摘要，批准 / 驳回单点在右栏门卡（D4）。
// feature-009：useCaptureFacts 导出供 Stage0View PublishedBody 复用（前提卡分色订阅）
import { useEffect, useState } from 'react'
import type { CapturedFact } from '../../../shared/types'
import { selectChainNodes, type ChainGateNode, type ChainStepNode } from './chain'
import type { Stage0State } from './select'

export interface Stage0ChainProps {
  state: Stage0State
}

/** capture 桥订阅（CaptureBar L33-41 同模式：alive 标志 + 卸载退订；首拉失败降级空进度 + 错误小字，不自动重试刷屏） */
export function useCaptureFacts(): { facts: CapturedFact[]; loadError: string | null } {
  const [facts, setFacts] = useState<CapturedFact[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    window.api.captureList()
      .then(f => { if (alive) { setFacts(f.facts); setLoadError(null) } })
      .catch(e => { if (alive) setLoadError(e instanceof Error ? e.message : String(e)) })
    const off = window.api.onCaptureChanged(f => { setFacts(f.facts); setLoadError(null) })
    return () => { alive = false; off() }
  }, [])
  return { facts, loadError }
}

const PILL = 'rounded-full border px-2 py-px text-[10px] font-bold'
const CHIP = 'flex items-center gap-1.5 text-[11.5px] font-bold text-ink'

function stepBadge(node: ChainStepNode): { text: string; cls: string } {
  if (node.status === 'final') return { text: '已定稿', cls: `${PILL} border-[#B9E8D2] bg-[#E7F8F0] text-[#1E9E66]` }
  if (node.status === 'collecting') return { text: `收敛中 ${node.covered}/${node.total}`, cls: `${PILL} border-[#DED9FB] bg-violet-soft text-[#5A4FD8]` }
  return { text: '未开始', cls: `${PILL} border-line bg-white text-[#9AA0B5]` }
}

function gateBadge(node: ChainGateNode): { text: string; cls: string } {
  if (node.status === 'published') {
    return { text: node.version !== null ? `已发布 v${node.version}` : '已发布', cls: `${PILL} border-[#B9E8D2] bg-[#E7F8F0] text-[#1E9E66]` }
  }
  if (node.status === 'pending') {
    return { text: node.version !== null ? `待拍板 v${node.version}` : '待拍板', cls: `${PILL} border-[#DED9FB] bg-violet-soft text-[#5A4FD8]` }
  }
  if (node.status === 'rejected') return { text: '被驳回', cls: `${PILL} border-[#F0CFCF] bg-white text-[#C0453B]` }
  return { text: '未就绪', cls: `${PILL} border-line bg-white text-[#9AA0B5]` }
}

function StepChip({ icon, label, node, cred }: { icon: string; label: string; node: ChainStepNode; cred: string }) {
  const badge = stepBadge(node)
  return (
    <span className={CHIP} data-stage0-chain={cred}>
      <span className="text-[12px] text-[#9AA0B5]">{icon}</span>
      <span>{label}</span>
      <span className={badge.cls}>{badge.text}</span>
    </span>
  )
}

const ARROW = <span className="text-[11px] text-[#C3C7D8]">→</span>

export default function Stage0Chain({ state }: Stage0ChainProps) {
  const { facts, loadError } = useCaptureFacts()
  const [summaryOpen, setSummaryOpen] = useState(false)
  const nodes = selectChainNodes(state, facts)
  // 门态非 pending 时浮层恒收起（态切换不残留；点击切换，无悬停 / 外点 / Esc，D4）
  const gateOpen = summaryOpen && nodes.gate.status === 'pending'
  const gate = gateBadge(nodes.gate)

  return (
    <div
      className="absolute inset-x-0 top-[38px] z-10 flex h-[46px] items-center gap-2 border-b border-line bg-white/85 px-[18px] backdrop-blur"
      data-stage0-chain
    >
      <span className="text-[10.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">立项过程</span>
      <StepChip icon="①" label="选题诊断" node={nodes.diag} cred="diag" />
      {ARROW}
      <StepChip icon="②" label="故事前提" node={nodes.premise} cred="premise" />
      {ARROW}
      {nodes.gate.status === 'pending' ? (
        <button
          type="button"
          className={`${CHIP} cursor-pointer rounded-md px-1 py-0.5 hover:bg-[#F1F2F8]`}
          onClick={() => setSummaryOpen(o => !o)}
          data-stage0-chain-gate
        >
          <span className="text-[12px] text-[#9AA0B5]">🚪</span>
          <span>定案卡</span>
          <span className={gate.cls}>{gate.text}</span>
          <span className="text-[9px] text-[#9AA0B5]">{gateOpen ? '▴' : '▾'}</span>
        </button>
      ) : (
        <span className={CHIP} data-stage0-chain-gate>
          <span className="text-[12px] text-[#9AA0B5]">🚪</span>
          <span>定案卡</span>
          <span className={gate.cls}>{gate.text}</span>
        </span>
      )}
      <div className="flex-1" />
      {loadError !== null && (
        <span className="text-[10px] text-[#C0453B]" data-stage0-chain-error>口径读取失败</span>
      )}
      {gateOpen && (
        <div
          className="absolute right-[18px] top-[44px] z-20 w-[480px] max-w-[90vw] rounded-[12px] border border-line bg-white p-4 shadow-[0_12px_32px_rgba(40,42,80,0.14)]"
          data-stage0-chain-gate-summary
        >
          <div className="text-[12px] font-extrabold text-ink">
            {nodes.gate.version !== null ? `立项定案卡 · 待拍板 v${nodes.gate.version}` : '立项定案卡 · 待拍板'}
          </div>
          <div className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink">
            {state.gate0?.question ?? ''}
          </div>
          <div className="mt-3 border-t border-line pt-2 text-[10.5px] text-muted">批准 / 驳回在右栏门卡操作</div>
        </div>
      )}
    </div>
  )
}
