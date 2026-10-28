// feature-023 · 左栏流程导航面板（STAGE 0→7 八步）
// - 节点筛选不依赖 node.step（dev-mock step 编号 0~6 不齐八步），改用 kind 聚合
// - 状态徽章：全部完成 → ✓ N / 进行中 → 当前节点版本 / 待对齐 → 节点数 + ⚠
// - 点击切换 activeStep；再次点击同一行清空选择
// feature-013：STAGE 0 徽标 hover 渲染立项版本历史卡（懒加载 brief:history，零新 IPC）
import { useEffect, useState } from 'react'
import type { CanvasNode, StepId } from '@shared/types'

import { deriveBriefDisplay } from './brief-display'

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
  { step: '0', title: '立项',     desc: '立项单 + 视觉风格',             kinds: ['brief'] },
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

/* ── feature-013：hover 版本历史卡（数据源 = feature-004 brief:history，懒加载 + 会话内缓存）── */

type HistoryItem = Awaited<ReturnType<typeof window.api.briefHistory>>['versions'][number]

const APPROVE_BY_LABEL: Record<HistoryItem['approveBy'], string> = {
  gate: '门拍板',
  verbal: '口头拍板',
  ui: '面板直改',
}

/** 发布时间本地化短格式（非法串原样回退） */
function shortTime(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 会话内缓存：同一缓存键只拉一次 brief:history（切项目/版本变化自然失效） */
let historyCache: { key: string; items: HistoryItem[] } | null = null

/** 懒加载 hook：hover 时触发拉取；失败降级为 null（不渲染卡、不报错、不阻塞） */
function useBriefHistory(cacheKey: string, enabled: boolean): HistoryItem[] | null {
  const [items, setItems] = useState<HistoryItem[] | null>(
    () => (historyCache && historyCache.key === cacheKey ? historyCache.items : null),
  )
  useEffect(() => {
    if (!enabled) return
    if (historyCache && historyCache.key === cacheKey) { setItems(historyCache.items); return }
    let alive = true
    window.api.briefHistory()
      .then(res => {
        historyCache = { key: cacheKey, items: res.versions }
        if (alive) setItems(res.versions)
      })
      .catch(() => { /* 拉取失败降级：不渲染卡 */ })
    return () => { alive = false }
  }, [enabled, cacheKey])
  return items
}

export default function StageNavPanel({ nodes, activeStep, onSelect }: Props) {
  // feature-002 · STAGE 0 立项版本：renderer 无 manifest 数据源（不新增 IPC），
  // N 取 brief 节点 meta.version 与全画布 dirty.latestBriefVersion 的最大值；k = 全画布 dirty 节点数。
  // feature-013：口径迁入 deriveBriefDisplay 纯函数，与顶栏 tooltip 单一事实源。
  const display = deriveBriefDisplay(nodes)
  const briefVersion = display.version
  const dirtyNodes = display.dirtyCount
  // feature-013：hover 历史卡（仅已发布立项渲染；缓存键 = 立项版本 + 节点数，跨项目自然失效）
  const [hoverHistory, setHoverHistory] = useState(false)
  const historyKey = `${briefVersion ?? 0}-${nodes.length}`
  const history = useBriefHistory(historyKey, hoverHistory && briefVersion !== null)

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
        // feature-002 · STAGE 0 已发布立项：无 dirty 显 ✓ vN（绿），有 dirty 显 vN ⚠k（黄）；未发布沿用现状
        const stage0Brief = s.step === '0' && briefVersion !== null
        const stage0Dirty = stage0Brief && dirtyNodes > 0
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
              data-stage-badge={s.step}
              className={`relative ml-auto shrink-0 self-center rounded px-1.5 py-px text-[8.5px] font-extrabold ${
                stage0Dirty
                  ? 'bg-[#FFF4DE] text-[#C0841D]'
                  : isIdle
                    ? 'bg-[#F2F3F9] text-[#9AA0B5]'
                    : allDone
                      ? 'bg-[#E7F8F0] text-[#1E9E66]'
                      : isActive
                        ? 'bg-violet text-white'
                        : pendingCount > 0
                          ? 'bg-[#FFF4DE] text-[#C0841D]'
                          : 'bg-[#F2F3F9] text-[#9AA0B5]'
              }`}
              title={stage0Dirty
                ? `${dirtyNodes} 个产物基于旧版立项，与最新 v${briefVersion} 不一致`
                : activeNode ? `当前进行中：${activeNode.title} (${badge(activeNode)})` : ''}
              onMouseEnter={() => { if (stage0Brief) setHoverHistory(true) }}
              onMouseLeave={() => setHoverHistory(false)}
            >
              {stage0Brief
                ? stage0Dirty
                  ? `v${briefVersion} ⚠${dirtyNodes}`
                  : `✓ v${briefVersion}`
                : isIdle
                  ? '空'
                  : allDone
                    ? `✓ ${matched.length}`
                    : isActive
                      ? badge(activeNode!)
                      : `${matched.length} 节点`}
              {/* feature-013：hover 版本历史卡（未发布不渲染；失败降级不渲染） */}
              {stage0Brief && hoverHistory && history && history.length > 0 && (
                <span
                  className="absolute left-0 top-[26px] z-50 w-[240px] rounded-[10px] border border-line bg-white p-2.5 text-left shadow-[0_10px_30px_rgba(40,42,80,0.16)]"
                  data-stage0-history-card
                >
                  <span className="mb-1.5 block text-[10px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">立项版本历史</span>
                  {history.map(h => (
                    <span key={h.version} className="flex items-center gap-2 py-[3px] text-[10.5px] text-[#4A4F68]">
                      <span className="font-extrabold text-ink">v{h.version}</span>
                      <span className="text-[#A6ABC0]">{shortTime(h.publishedAt)}</span>
                      <span className="text-[#A6ABC0]">+{h.changeCount} 改动</span>
                      <span className="ml-auto text-[#A6ABC0]">{APPROVE_BY_LABEL[h.approveBy]}</span>
                    </span>
                  ))}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { STAGES }
