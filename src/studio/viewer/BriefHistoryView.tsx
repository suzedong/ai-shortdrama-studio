// feature-004 · 立项单历史与回滚视图（契约 §3.1/§3.3）
// 左版本列表（新版置顶）+ 右两栏 diff（选中版 vK vs 当前最新）+ 差异摘要条 + 回滚二次确认流。
// 数据自拉 window.api 三桥（briefHistory / briefVersionRead / briefRollback）；
// 列历史 / 读版本 / 字段 diff / 回滚发新版均为规则可枚举的确定性操作，系统直做不经 AI（D-016）。
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BriefChange, ProjectBrief } from '@shared/types'

import { dirtyFieldLabel } from './CanvasBoard'
import { formatAt } from './Stage0View'

type HistoryResult = Awaited<ReturnType<typeof window.api.briefHistory>>
type HistoryItem = HistoryResult['versions'][number]
type VersionRead = Awaited<ReturnType<typeof window.api.briefVersionRead>>

const APPROVE_BY_LABEL: Record<HistoryItem['approveBy'], string> = {
  gate: '门内拍板',
  verbal: '口头拍板',
  ui: '面板直改',
}

// ── 精简视觉件（与 StudioViewer brief 视图同构精简版，规格 §3.2）──

function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-[12px] font-extrabold text-ink">{title}</h4>
        {extra}
      </div>
      {children}
    </section>
  )
}

/** 字段行；hit（命中 diffToLatest 字段路径）时挂差异高亮 testid */
function Row({ k, v, hit }: { k: string; v: ReactNode; hit?: boolean }) {
  return (
    <div
      data-testid={hit ? 'brief-history-diff-field' : undefined}
      className={`flex gap-3 border-b border-line/60 px-3 py-[7px] text-[11.5px] last:border-b-0 ${hit ? 'bg-[#FFF3D6]' : 'odd:bg-canvas/60'}`}
    >
      <span className="w-[64px] shrink-0 text-muted">{k}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-5 text-ink">{v}</span>
    </div>
  )
}

/** 单版立项单全文分节（diffBrief 全部字段路径均有对应行，命中即高亮） */
function BriefColumn({ brief, hits, badge }: { brief: ProjectBrief; hits: Set<string>; badge: string }) {
  const fe = brief.fiveElements
  const p = brief.premise
  const s = brief.style
  const approveLabel =
    brief.approve.by === 'verbal'
      ? `口头拍板${brief.approve.verbal?.quote ? `：“${brief.approve.verbal.quote}”` : ''}`
      : brief.approve.by === 'ui'
        ? '面板直改'
        : '门内拍板'
  const h = (f: string) => hits.has(f)
  return (
    <div className="flex flex-col gap-3">
      <Section
        title="项目性质"
        extra={<span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10px] font-bold text-violet">{badge}</span>}
      >
        <div className="rounded-lg border border-line">
          <Row k="性质" hit={h('kind')} v={brief.kind === 'commercial' ? '商业短剧' : '个人纪念'} />
          <Row k="发布时间" v={brief.publishedAt} />
          <Row k="拍板方式" v={approveLabel} />
          <Row k="拍板时间" v={formatAt(brief.approve.at)} />
          {brief.approve.note && <Row k="裁决备注" v={brief.approve.note} />}
        </div>
      </Section>
      <Section title="立项六要素">
        <div className="rounded-lg border border-line">
          <Row k="题材赛道" hit={h('fiveElements.genre')} v={fe.genre} />
          <Row k="目标平台" hit={h('fiveElements.platforms')} v={fe.platforms.join('、')} />
          <Row k="单集时长" hit={h('fiveElements.episodeDuration')} v={fe.episodeDuration} />
          <Row k="集数" hit={h('fiveElements.episodeCount')} v={fe.episodeCount} />
          <Row k="风格基调" hit={h('fiveElements.tone')} v={fe.tone} />
          <Row k="画幅" hit={h('fiveElements.aspectRatio')} v={fe.aspectRatio} />
        </div>
      </Section>
      <Section title="故事前提">
        <div className="rounded-lg border border-line">
          <Row k="人物" hit={h('premise.leads')} v={p.leads} />
          <Row k="时间" hit={h('premise.time')} v={p.time} />
          <Row k="地点" hit={h('premise.place')} v={p.place} />
          <Row k="核心事件" hit={h('premise.coreEvent')} v={p.coreEvent} />
          <Row k="本季边界" hit={h('premise.seasonBoundary')} v={p.seasonBoundary} />
        </div>
      </Section>
      <Section title="视觉风格">
        <div className="rounded-lg border border-line">
          <Row
            k="主风格"
            hit={h('style.mainStyleId') || h('style.catalogVersion')}
            v={`${s.mainStyleId} @ ${s.catalogVersion}`}
          />
          <Row k="辅助气氛" hit={h('style.auxiliaryStyleId')} v={s.auxiliaryStyleId ?? '无'} />
        </div>
      </Section>
      <Section title="选题诊断">
        <div className="rounded-lg border border-line">
          <Row k="诊断摘要" hit={h('diagnosisSummary')} v={brief.diagnosisSummary || '（无）'} />
          <Row k="诊断明细" hit={h('diagnosisDetail')} v={brief.diagnosisDetail || '（无）'} />
        </div>
      </Section>
    </div>
  )
}

// ── 主视图 ──────────────────────────────────────────────────

export default function BriefHistoryView({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<HistoryResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [selData, setSelData] = useState<VersionRead | null>(null)
  const [latestBrief, setLatestBrief] = useState<ProjectBrief | null>(null)
  const [selLoading, setSelLoading] = useState(false)
  const [selError, setSelError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const latestVersion = history?.latestVersion ?? null

  // V1：打开拉历史；≥2 版默认选中次新版 v(N-1)，1 版选中 v1
  useEffect(() => {
    let alive = true
    window.api.briefHistory()
      .then(h => {
        if (!alive) return
        setHistory(h)
        if (h.latestVersion !== null) setSelected(h.latestVersion >= 2 ? h.latestVersion - 1 : 1)
      })
      .catch(err => { if (alive) setLoadError(err instanceof Error ? err.message : String(err)) })
    return () => { alive = false }
  }, [])

  // V2：选中 vK 拉全文；vK≠最新时再拉最新版全文供右栏
  useEffect(() => {
    if (selected === null || latestVersion === null) return
    let alive = true
    setSelLoading(true)
    setSelError(null)
    Promise.all([
      window.api.briefVersionRead(selected),
      selected === latestVersion ? Promise.resolve(null) : window.api.briefVersionRead(latestVersion),
    ])
      .then(([sel, lat]) => {
        if (!alive) return
        setSelData(sel)
        setLatestBrief(lat ? lat.brief : sel.brief)
        setSelLoading(false)
      })
      .catch(err => {
        if (!alive) return
        setSelData(null)
        setLatestBrief(null)
        setSelError(err instanceof Error ? err.message : String(err))
        setSelLoading(false)
      })
    return () => { alive = false }
  }, [selected, latestVersion])

  const hits = useMemo(() => new Set((selData?.diffToLatest ?? []).map((c: BriefChange) => c.field)), [selData])

  // V5：确认回滚 → 成功提示 + 重拉 history（新版置顶选中）；失败错误条展示，不关闭视图
  const doRollback = async () => {
    if (selected === null) return
    setRolling(true)
    setActionError(null)
    setNotice(null)
    try {
      const res = await window.api.briefRollback(selected)
      setConfirmOpen(false)
      setNotice(`已发布 v${res.version}（内容 = v${res.rolledBackFrom}）`)
      const h = await window.api.briefHistory()
      setHistory(h)
      setSelected(res.version)
    } catch (err) {
      setConfirmOpen(false)
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setRolling(false)
    }
  }

  const versionsDesc = [...(history?.versions ?? [])].reverse()
  const rollbackable = selected !== null && latestVersion !== null && selected !== latestVersion

  return (
    <div data-testid="brief-history-view" className="absolute inset-0 z-20 flex flex-col rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs font-medium text-violet">立项单</span>
          <span className="truncate text-sm font-medium text-ink">历史版本与回滚</span>
          {history && history.versions.length > 0 && (
            <span className="shrink-0 rounded-full bg-violet-soft px-1.5 py-px text-[10px] font-bold text-violet">共 {history.versions.length} 版</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-testid="brief-history-rollback"
            disabled={!rollbackable || rolling}
            onClick={() => { setActionError(null); setConfirmOpen(true) }}
            className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected !== null ? `回滚到 v${selected}` : '回滚'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
          >
            关闭
          </button>
        </div>
      </div>

      {history && history.warnings.length > 0 && (
        <div className="border-b border-line bg-[#FDF3E0] px-5 py-2 text-[11px] leading-5 text-[#8A6D3B]">
          {history.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
      {notice && (
        <div className="border-b border-line bg-ok/10 px-5 py-2 text-[11px] font-bold leading-5 text-ok">{notice}</div>
      )}
      {actionError && (
        <div className="border-b border-line bg-bad/10 px-5 py-2 text-[11px] leading-5 text-bad">{actionError}</div>
      )}

      {/* V3：差异摘要条（dirtyFieldLabel 中文名：旧值 → 新值） */}
      {selData && (
        <div className="max-h-[132px] overflow-auto border-b border-line bg-canvas/60 px-5 py-2">
          {selData.diffToLatest.length === 0 ? (
            <p className="text-[11px] font-bold text-muted">该版本即当前最新</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <div className="text-[10px] font-extrabold tracking-[0.3px] text-muted">
                与最新版 v{latestVersion} 的差异 · {selData.diffToLatest.length} 项（左 v{selected} → 右 v{latestVersion}）
              </div>
              {selData.diffToLatest.map((c: BriefChange) => (
                <div key={c.field} className="break-words text-[11px] leading-5 text-ink">
                  <span className="font-bold">{dirtyFieldLabel(c.field)}</span>
                  <span className="text-muted">：{c.from || '（空）'} → {c.to || '（空）'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* 左 rail：版本列表（新版置顶） */}
        <div className="w-[168px] shrink-0 overflow-auto border-r border-line bg-canvas/40 p-2">
          {loadError && <p className="px-2 py-4 text-[11px] text-bad">{loadError}</p>}
          {!history && !loadError && <p className="px-2 py-4 text-[11px] text-muted">读取中…</p>}
          {history && versionsDesc.length === 0 && <p className="px-2 py-4 text-[11px] text-muted">尚未立项，无历史版本。</p>}
          {versionsDesc.map(v => (
            <button
              key={v.version}
              type="button"
              data-testid="brief-history-item"
              data-version={v.version}
              onClick={() => { setSelected(v.version); setNotice(null) }}
              className={`mb-1.5 flex w-full flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left ${selected === v.version ? 'border-violet bg-violet-soft/60' : 'border-line bg-white hover:border-violet/50'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-extrabold text-ink">v{v.version}</span>
                {v.version === latestVersion && (
                  <span className="rounded-full bg-violet px-1.5 py-px text-[9px] font-bold text-white">当前</span>
                )}
              </div>
              <span className="text-[10px] text-muted">{formatAt(v.publishedAt)}</span>
              <span className="text-[10px] text-muted">{APPROVE_BY_LABEL[v.approveBy]} · 变更 {v.changeCount} 项</span>
              {v.note && <span className="break-words text-[10px] leading-4 text-[#8A6D3B]">{v.note}</span>}
            </button>
          ))}
        </div>

        {/* 右：两栏 diff（左选中版 / 右当前最新） */}
        <div className="min-w-0 flex-1 overflow-auto bg-canvas/40 p-4">
          {selLoading && <p className="text-sm text-muted">读取版本内容…</p>}
          {selError && <p className="text-sm text-bad">{selError}</p>}
          {!selLoading && !selError && selData && latestBrief && (
            <div className="grid grid-cols-2 items-start gap-4">
              <div>
                <div className="mb-2 text-[11px] font-extrabold text-muted">选中版本 v{selected}</div>
                <BriefColumn brief={selData.brief} hits={hits} badge={`v${selected}`} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-extrabold text-muted">当前最新 v{latestVersion}</div>
                <BriefColumn brief={latestBrief} hits={hits} badge={`v${latestVersion} · 最新`} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* V4/V6：回滚二次确认框；取消零 IPC 调用 */}
      {confirmOpen && selected !== null && latestVersion !== null && (
        <div className="absolute inset-0 z-30 grid place-items-center rounded-2xl bg-ink/30 p-6">
          <div data-testid="brief-history-rollback-confirm" className="w-[420px] rounded-xl border border-line bg-white p-5 shadow-card">
            <h3 className="text-[13px] font-extrabold text-ink">确认回滚到 v{selected}？</h3>
            <p className="mt-2 text-[11.5px] leading-[1.7] text-[#4A4F68]">
              将以 v{selected} 的内容发布新立项单 v{latestVersion + 1}，当前最新 v{latestVersion} 不会丢失。基于旧版的下游产物将按既有机制提示脏读。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={rolling}
                className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void doRollback()}
                disabled={rolling}
                className="rounded-lg border border-violet bg-violet px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
              >
                {rolling ? '回滚中…' : '确认回滚'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
