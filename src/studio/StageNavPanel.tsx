// feature-023 · 左栏流程导航面板（STAGE 0→7 八步）
// - 节点筛选不依赖 node.step（dev-mock step 编号 0~6 不齐八步），改用 kind 聚合
// - 状态徽章：全部完成 → ✓ N / 进行中 → 当前节点版本 / 待对齐 → 节点数 + ⚠
// - 点击切换 activeStep；再次点击同一行清空选择
import type { CanvasNode, StepId } from '@shared/types'

interface Props {
  nodes: CanvasNode[]
  activeStep: StepId | null
  onSelect: (step: StepId | null) => void
}

interface StageDef {
  step: StepId
  title: string
  desc: string
  kinds: string[]
}

const STAGES: StageDef[] = [
  { step: '0', title: '立项',     desc: '创意简报 + 视觉风格',           kinds: ['brief'] },
  { step: '1', title: '故事',     desc: '三幕结构 + 钩子工程',           kinds: ['outline'] },
  { step: '2', title: '剧本分场', desc: '分场 + 台词',                   kinds: ['scenes', 'dialogue'] },
  { step: '3', title: '资产',     desc: '角色定妆 + 场景概念',           kinds: ['profiles', 'visual-style'] },
  { step: '4', title: '分镜',     desc: '一集分镜条目',                   kinds: ['storyboard'] },
  { step: '5', title: '镜头',     desc: '出片 · 走 ComfyUI',             kinds: ['shot'] },
  { step: '6', title: '后期',     desc: '配乐 + 字幕 + 剪辑',             kinds: ['timeline'] },
  { step: '7', title: '发布',     desc: '导出 + 多平台投放',             kinds: ['final'] },
]

function badge(n: CanvasNode): string {
  const v = n.meta?.version
  return typeof v === 'string' ? v : '—'
}

export default function StageNavPanel({ nodes, activeStep, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-0.5 pb-2">
      {STAGES.map(s => {
        const matched = nodes.filter(n => s.kinds.includes(n.kind))
        const doneCount = matched.filter(n => n.status === 'done').length
        const activeNode = matched.find(n => n.status === 'active')
        const pendingCount = matched.filter(n => n.status === 'pending' || n.status === 'invalidated').length
        const allDone = matched.length > 0 && doneCount === matched.length
        const isCurrent = activeStep === s.step
        const isIdle = matched.length === 0
        const isActive = !isIdle && !allDone && Boolean(activeNode)
        return (
          <button
            key={s.step}
            type="button"
            onClick={() => onSelect(isCurrent ? null : s.step)}
            className={`group flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition ${
              isCurrent ? 'bg-violet-soft' : 'hover:bg-[#F5F6FB]'
            }`}
            data-stage={s.step}
            title={s.title}
          >
            <span
              className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] text-[10.5px] font-extrabold transition ${
                allDone
                  ? 'bg-ok text-white'
                  : isActive
                    ? 'bg-violet text-white shadow-[0_4px_10px_rgba(108,92,231,0.32)]'
                    : 'bg-[#F1F2F8] text-[#AEB4C8]'
              }`}
            >
              {allDone ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M9 12.5 11.5 15 16 9.5" />
                </svg>
              ) : (
                s.step
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-[11.5px] font-bold leading-tight ${isCurrent || allDone || isActive ? 'text-ink' : 'text-[#A6ABC0]'}`}>
                {s.title} · STAGE {s.step}
              </div>
              <div className="mt-0.5 truncate text-[9.5px] text-[#B7BCD0]">
                {matched.length > 0 ? `${matched.length} 节点 · ${doneCount} 已完成` : s.desc}
              </div>
            </div>
            <span
              className={`ml-auto shrink-0 self-center rounded px-1.5 py-px text-[8.5px] font-extrabold ${
                isIdle
                  ? 'bg-[#F2F3F9] text-[#9AA0B5]'
                  : allDone
                    ? 'bg-[#E7F8F0] text-[#1E9E66]'
                    : isActive
                      ? 'bg-violet text-white'
                      : pendingCount > 0
                        ? 'bg-[#FFF4DE] text-[#C0841D]'
                        : 'bg-[#F2F3F9] text-[#9AA0B5]'
              }`}
              title={activeNode ? `当前进行中：${activeNode.title} (${badge(activeNode)})` : ''}
            >
              {isIdle
                ? '空'
                : allDone
                  ? `✓ ${matched.length}`
                  : isActive
                    ? badge(activeNode!)
                    : `${matched.length} 节点`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { STAGES }
