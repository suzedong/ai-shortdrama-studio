// feature-003 · STAGE 0 立项视图（真实只读投影，替换 feature-025 静态原型壳）
// 四态：empty / loading / brief-error / published；门 pending 与脏读为叠加态。
// 数据全部来自既有通道：canvas props + window.api.fileRead；审批单点在右栏 GateCardView。
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Canvas, ProjectBrief } from '../../shared/types'
import {
  dirtyFieldLabel,
  FIVE_ELEMENT_FIELDS,
  parseBriefJson,
  PREMISE_FIELDS,
  selectStage0State,
} from './stage0/select'

interface Stage0ViewProps {
  canvas: Canvas
  projectTitle: string
  onBackToDag: () => void
}

/** 背景档案固定产物名（showrunner 第 0 步写项目根） */
const BACKGROUND_PATH = '故事背景档案.md'

type BriefDocState =
  | { phase: 'loading' }
  | { phase: 'error'; reason: 'MISSING_REF' | 'NOT_FOUND' | 'NOT_JSON' | 'UNSUPPORTED_SHAPE' | 'UNREADABLE'; path: string }
  | { phase: 'ok'; brief: ProjectBrief; path: string }

type BgDocState =
  | { phase: 'absent' }
  | { phase: 'ok'; content: string }
  | { phase: 'failed' }

function text(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** 叶子值展示：'待定' 显中性徽标；空串/非字符串显「—」 */
function LeafValue({ value }: { value: unknown }) {
  const s = text(value)
  if (s === '待定') return <span className="rounded bg-[#F1F2F8] px-1.5 py-px text-[10px] font-bold text-[#7A8098]">待定</span>
  if (!s) return <span className="text-[#B8BDCE]">—</span>
  return <span className="font-bold text-ink">{s}</span>
}

/** approve.at 本地格式；无效字符串原样显示 */
function formatAt(at: unknown): string {
  const s = text(at)
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString()
}

/* ── 空态 ── */
function EmptyStage0({ state, projectTitle, onBackToDag }: {
  state: ReturnType<typeof selectStage0State>
  projectTitle: string
  onBackToDag: () => void
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FAFBFE]" data-view="stage0">
      <Header projectTitle={projectTitle} onBackToDag={onBackToDag} />
      <div className="absolute inset-0 top-[38px] overflow-y-auto px-[26px] py-[26px]">
        <div className="mx-auto flex max-w-[680px] flex-col gap-4 pt-[9vh]">
          {state.gate0 && state.gate0.status !== 'approved' && <GatePendingStrip gate0={state.gate0} />}
          <div className="rounded-[14px] border border-line bg-white p-7 text-center shadow-[0_10px_30px_rgba(40,42,80,0.06)]" data-stage0-empty>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-soft text-xl text-violet">0</span>
            <div className="mt-3 text-[15px] font-extrabold text-ink">
              {state.gatePending ? '立项单已定稿待你批准' : '立项尚未定案'}
            </div>
            <p className="mx-auto mt-2 max-w-[440px] text-[11.5px] leading-[1.8] text-muted">
              {state.gatePending
                ? '立项单已定稿待你批准，在右栏完成定案。批准后本页将自动展示立项单全文，无需刷新。'
                : '立项是一段对话：在右侧对话中回答主控 Agent 的反问（商业/纪念、六要素、故事前提、风格引用），全部就绪后由定案门拍板发布立项单。'}
            </p>
            <button
              type="button"
              onClick={onBackToDag}
              className="mt-5 rounded-lg border border-line bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#7A8098] hover:bg-[#F1F2F8]"
              data-stage0-back
            >← 返回画布</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 门待决镜像条（无按钮，审批单点在右栏）── */
function GatePendingStrip({ gate0 }: { gate0: NonNullable<ReturnType<typeof selectStage0State>['gate0']> }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[10px] border border-[#DED9FB] bg-violet-soft px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#5A4FD8]"
      data-stage0-gate-pending
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet text-[10px] text-white">!</span>
      <span className="font-bold">
        {gate0.status === 'rejected' ? '立项定案门被驳回：请在右侧对话中继续调整。' : '立项定案门待你在右栏定案（批准 / 驳回在右栏门卡操作）。'}
      </span>
    </div>
  )
}

/* ── 脏读黄条（纯文本，无按钮；文案/色值与 CanvasBoard 同源）── */
function DirtyBar({ state }: { state: ReturnType<typeof selectStage0State> }) {
  if (state.dirtyCount === 0) return null
  return (
    <div
      className="rounded-[10px] border border-[#F6E6C4] bg-[#FFF4DE] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#7A5C1D]"
      data-stage0-dirty-bar
    >
      <b className="text-[#C0841D]">有 {state.dirtyCount} 个产物基于旧版立项</b>
      <span className="ml-1.5">命中字段：{state.dirtyFields.map(dirtyFieldLabel).join('、')}</span>
    </div>
  )
}

/* ── 头部（版本徽标在主体内以文件内 brief.version 显示，D-004）── */
function Header({ projectTitle, onBackToDag }: { projectTitle: string; onBackToDag: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[38px] items-center gap-2.5 border-b border-line bg-white/85 px-[18px] backdrop-blur">
      <span className="text-[10.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">立项视图</span>
      <span className="text-[12px] font-extrabold text-ink">{projectTitle}</span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onBackToDag}
        className="rounded-md border border-line bg-white px-2.5 py-1 text-[10.5px] text-[#7A8098] hover:bg-[#F1F2F8]"
        data-stage0-back
      >← 返回画布</button>
    </div>
  )
}

/* ── published 主体：双卡 + 定案/版本区 ── */
function PublishedBody({ brief, state, bg }: {
  brief: ProjectBrief
  state: ReturnType<typeof selectStage0State>
  bg: BgDocState
}) {
  const [bgOpen, setBgOpen] = useState(false)
  const kindLabel = brief.kind === 'commercial' ? '商业短剧' : '个人纪念'
  const platforms = Array.isArray(brief.fiveElements.platforms) ? brief.fiveElements.platforms.join(' · ') : ''
  const isV1 = brief.version === 1

  return (
    <div className="flex flex-col gap-3.5">
      {state.gate0 && state.gate0.status !== 'approved' && <GatePendingStrip gate0={state.gate0} />}
      <DirtyBar state={state} />

      <div className="grid grid-cols-2 gap-[14px]">
        {/* 卡① 选题诊断 + 六要素 */}
        <section className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-white" data-stage0-card-diagnosis>
          <div className="flex items-center gap-2 border-b border-[#F2F3F8] px-3.5 py-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-soft text-[11px] font-extrabold text-violet">1</span>
            <span className="text-[12px] font-extrabold text-ink">选题诊断</span>
            <span className="ml-auto rounded-full bg-[#F2F3F9] px-2 py-px text-[9px] font-bold text-[#7A8098]">{kindLabel}</span>
          </div>
          <div className="flex flex-col gap-3 px-3.5 py-3">
            <div className="rounded-md border border-line">
              {FIVE_ELEMENT_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 border-b border-[#F6F7FB] px-2.5 py-1.5 text-[11px] last:border-b-0">
                  <span className="w-[58px] shrink-0 text-[10px] font-semibold text-[#9AA0B5]">{label}</span>
                  {key === 'platforms'
                    ? <LeafValue value={platforms} />
                    : <LeafValue value={brief.fiveElements[key]} />}
                </div>
              ))}
            </div>
            {/* 风格引用：只显 ID + 谱系版本，不解析名称 */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-violet bg-violet-soft px-2.5 py-2 text-[10.5px]">
              <span className="text-[9.5px] font-extrabold text-[#5A4FD8]">视觉风格</span>
              <span className="font-extrabold text-ink" data-stage0-style>
                主风格 {text(brief.style.mainStyleId) || '—'} · 谱系 {text(brief.style.catalogVersion) || '—'}
              </span>
              {text(brief.style.auxiliaryStyleId) && (
                <span className="rounded bg-white/70 px-1.5 py-px text-[10px] font-bold text-[#5A4FD8]">辅助 {brief.style.auxiliaryStyleId}</span>
              )}
            </div>
            {text(brief.diagnosisSummary) && (
              <div className="rounded-md bg-[#F7F8FC] px-2.5 py-2 text-[10.5px] leading-[1.7] text-[#6A708A]">
                <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">选题诊断结论</div>
                {brief.diagnosisSummary}
              </div>
            )}
          </div>
        </section>

        {/* 卡② 故事前提 + 背景档案折叠 */}
        <section className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-white" data-stage0-card-premise>
          <div className="flex items-center gap-2 border-b border-[#F2F3F8] px-3.5 py-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-soft text-[11px] font-extrabold text-violet">2</span>
            <span className="text-[12px] font-extrabold text-ink">故事前提</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 px-3.5 py-3">
            <div className="rounded-md border border-line">
              {PREMISE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-start gap-2 border-b border-[#F6F7FB] px-2.5 py-1.5 text-[11px] last:border-b-0">
                  <span className="mt-px w-[58px] shrink-0 text-[10px] font-semibold text-[#9AA0B5]">{label}</span>
                  <LeafValue value={brief.premise[key]} />
                </div>
              ))}
            </div>
            {bg.phase !== 'absent' && (
              <div className="rounded-md border border-line" data-stage0-background>
                <button
                  type="button"
                  onClick={() => setBgOpen(v => !v)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[10.5px] font-extrabold text-[#5A607A] hover:bg-[#F8F9FD]"
                  aria-expanded={bgOpen}
                >
                  <span className="text-[#A6ABC0]">{bgOpen ? '▾' : '▸'}</span>故事背景档案.md
                </button>
                {bgOpen && (
                  bg.phase === 'ok'
                    ? <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap border-t border-[#F2F3F8] px-2.5 py-2 font-mono text-[10px] leading-[1.7] text-[#6A708A]">{bg.content}</pre>
                    : <div className="border-t border-[#F2F3F8] px-2.5 py-2 text-[10px] text-[#B8BDCE]">背景档案读取失败，已跳过。</div>
                )}
              </div>
            )}
            <p className="mt-auto text-[10px] leading-[1.6] text-[#A6ABC0]">字段只读；需要修改时在右侧对话中提出，由主控 Agent 再版立项。</p>
          </div>
        </section>
      </div>

      {/* 定案区 + 版本区 */}
      <section className="rounded-[12px] border border-line bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
          <div>
            <span className="text-[10px] font-semibold text-[#9AA0B5]">定案方式　</span>
            {brief.approve.by === 'gate'
              ? <span className="font-extrabold text-[#1E9E66]">门批准入</span>
              : <span className="font-extrabold text-ink">口头拍板</span>}
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#9AA0B5]">定案时间　</span>
            <span className="font-bold text-ink">{formatAt(brief.approve.at)}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#9AA0B5]">版本　</span>
            <span className="font-extrabold text-ink">
              {isV1 ? '首版立项' : `相对 v${brief.version - 1} 共 ${brief.changesFromPrevious.length} 处变更`}
            </span>
          </div>
        </div>
        {brief.approve.by === 'verbal' && text(brief.approve.verbal?.quote) && (
          <blockquote className="mt-2.5 rounded-md rounded-l-none border-l-[3px] border-violet bg-[#F7F8FC] px-3 py-2 text-[11px] leading-[1.7] text-[#4A4F68]" data-stage0-verbal-quote>
            「{brief.approve.verbal?.quote}」
          </blockquote>
        )}
        {text(brief.approve.note) && (
          <p className="mt-2 text-[10.5px] leading-[1.6] text-muted">备注：{brief.approve.note}</p>
        )}
      </section>
    </div>
  )
}

/** published 态读取立项单 + 背景档案：依赖 refPath 去重，序号防陈旧，两文件失败相互独立 */
function useBriefDocuments(refPath: string): { brief: BriefDocState; bg: BgDocState } {
  const [brief, setBrief] = useState<BriefDocState>({ phase: 'loading' })
  const [bg, setBg] = useState<BgDocState>({ phase: 'absent' })
  const seqRef = useRef(0)

  useEffect(() => {
    const seq = seqRef.current + 1
    seqRef.current = seq
    setBrief({ phase: 'loading' })
    setBg({ phase: 'absent' })

    // 空路径（节点缺 json ref）：不发 IPC，直接落 MISSING_REF
    if (!refPath) {
      setBrief({ phase: 'error', reason: 'MISSING_REF', path: '' })
      return
    }

    window.api.fileRead({ path: refPath }).then(res => {
      if (seq !== seqRef.current) return
      if (!res.ok) {
        const reason = res.error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'UNREADABLE' as const
        setBrief({ phase: 'error', reason, path: refPath })
        return
      }
      const parsed = parseBriefJson(res.content)
      if (!parsed.ok) setBrief({ phase: 'error', reason: parsed.reason, path: refPath })
      else setBrief({ phase: 'ok', brief: parsed.brief, path: refPath })
    })

    window.api.fileRead({ path: BACKGROUND_PATH }).then(res => {
      if (seq !== seqRef.current) return
      if (!res.ok) setBg(res.error.code === 'NOT_FOUND' ? { phase: 'absent' } : { phase: 'failed' })
      else setBg({ phase: 'ok', content: res.content })
    })
  }, [refPath])

  return { brief, bg }
}

function BriefError({ projectTitle, onBackToDag, doc }: {
  projectTitle: string
  onBackToDag: () => void
  doc: Extract<BriefDocState, { phase: 'error' }>
}) {
  const message =
    doc.reason === 'MISSING_REF' ? '立项产物引用缺失（画布节点未指向立项单文件）'
    : doc.reason === 'NOT_FOUND' ? `立项单文件缺失：${doc.path}`
    : doc.reason === 'NOT_JSON' ? `立项单格式不受支持（内容不是合法 JSON）：${doc.path}`
    : doc.reason === 'UNSUPPORTED_SHAPE' ? `立项单格式不受支持（schema 版本或形状不被识别）：${doc.path}`
    : `立项单读取失败：${doc.path}`
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FAFBFE]" data-view="stage0">
      <Header projectTitle={projectTitle} onBackToDag={onBackToDag} />
      <div className="absolute inset-0 top-[38px] overflow-y-auto px-[26px] py-[26px]">
        <div className="mx-auto max-w-[680px] pt-[9vh]">
          <div className="rounded-[14px] border border-[#F0CFCF] bg-white p-7 text-center" data-stage0-brief-error>
            <div className="text-[14px] font-extrabold text-[#C0453B]">立项单无法展示</div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Stage0View({ canvas, projectTitle, onBackToDag }: Stage0ViewProps) {
  const state = useMemo(() => selectStage0State(canvas), [canvas])

  if (state.phase === 'empty' || !state.briefNode) {
    return <EmptyStage0 state={state} projectTitle={projectTitle} onBackToDag={onBackToDag} />
  }

  const refPath = state.briefNode.ref?.format === 'json' ? state.briefNode.ref.path : ''

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FAFBFE]" data-view="stage0">
      <Header projectTitle={projectTitle} onBackToDag={onBackToDag} />
      <div className="absolute inset-0 top-[38px] overflow-y-auto px-[26px] py-[22px]">
        <div className="mx-auto flex max-w-[920px] flex-col gap-[18px]" data-stage0-brief>
          <PublishedLoaded state={state} refPath={refPath} projectTitle={projectTitle} onBackToDag={onBackToDag} />
        </div>
      </div>
    </div>
  )
}

/** 隔离读取 hook（保证 hooks 调用顺序不随主态切换变化） */
function PublishedLoaded({ state, refPath, projectTitle, onBackToDag }: {
  state: ReturnType<typeof selectStage0State>
  refPath: string
  projectTitle: string
  onBackToDag: () => void
}) {
  const { brief, bg } = useBriefDocuments(refPath)

  if (!refPath) {
    return <BriefError projectTitle={projectTitle} onBackToDag={onBackToDag} doc={{ phase: 'error', reason: 'MISSING_REF', path: state.briefNode?.id ?? 'step-0-brief' }} />
  }
  if (brief.phase === 'loading') {
    return (
      <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-white px-4 py-6 text-[11.5px] text-muted" data-stage0-loading>
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#DED9FB] border-t-violet" />
        正在读取立项单…
      </div>
    )
  }
  if (brief.phase === 'error') {
    return <BriefError projectTitle={projectTitle} onBackToDag={onBackToDag} doc={brief} />
  }

  // 展示版本以文件内 brief.version 为准（D-004）
  return (
    <>
      <div className="-mb-1 flex items-center gap-2">
        <span className="rounded-full bg-[#E7F8F0] px-2 py-px text-[10px] font-bold text-[#1E9E66]" data-stage0-version={brief.brief.version}>立项单 v{brief.brief.version}</span>
        <span className="text-[10px] text-[#A6ABC0]">来源：{brief.path}</span>
      </div>
      <PublishedBody brief={brief.brief} state={state} bg={bg} />
    </>
  )
}
