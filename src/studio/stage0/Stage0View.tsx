// feature-003 · STAGE 0 立项视图（真实只读投影，替换 feature-025 静态原型壳）
// 四态：empty / loading / brief-error / published；门 pending 与脏读为叠加态。
// 数据全部来自既有通道：canvas props + window.api.fileRead；审批单点在右栏 GateCardView。
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { Canvas, ProjectBrief, ProjectKind } from '../../../shared/types'
import {
  dirtyFieldLabel,
  FIVE_ELEMENT_FIELDS,
  parseBriefJson,
  PREMISE_FIELDS,
  selectStage0State,
} from './select'
import { getStyleName, useStyleCatalog } from '../style/style-catalog-store'
import Stage0Chain, { useCaptureFacts } from './Stage0Chain'
import { selectPremiseConfirmation } from './premise-facts'
import { driftDays, driftReminderLabel } from '../canvas/dirty-drift'

/** 谱系风格引用：ID · 名称；未知/未来版本 ID 或空值原样返回（外层 || '—' 兜底） */
function styleRefLabel(id: string): string {
  const name = getStyleName(id)
  return name ? `${id} · ${name}` : id
}

interface Stage0ViewProps {
  canvas: Canvas
  projectTitle: string
  onBackToDag: () => void
  /** 入口动作 · 用户原话（会话首条用户消息，StudioApp 传入；空串不显示） */
  entryQuote?: string
}

/** 背景档案固定产物名（showrunner 第 0 步写项目根） */
// B-33 起导出：StudioViewer 立项单背景档案折叠块共用同一路径常量
export const BACKGROUND_PATH = '故事背景档案.md'

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

/** approve.at 本地格式；无效字符串原样显示（B-32 起导出：StudioViewer 拍板时间共用） */
export function formatAt(at: unknown): string {
  const s = text(at)
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString()
}

/* ── 入口动作 · 用户原话（对齐原型 s0-entry：渐变底 + 图钉 + tag + 引文）── */
// B-33 起导出：StudioViewer 立项单查看器顶部共用本卡
export function EntryQuoteCard({ quote }: { quote: string }) {
  if (!quote.trim()) return null
  return (
    <div
      className="flex items-center gap-3 rounded-[13px] border border-[#DED9FB] bg-gradient-to-br from-[#F8F6FF] to-[#F0EEFF] px-[17px] py-[14px] shadow-[0_8px_22px_rgba(108,92,231,0.08)]"
      data-stage0-entry-quote
    >
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#B8AFFF] to-[#6C5CE7] text-white shadow-[0_5px_12px_rgba(108,92,231,0.3)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-[14px] w-[14px]">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <span className="rounded-[5px] bg-violet-soft px-[7px] py-px text-[9.5px] font-extrabold tracking-[0.3px] text-[#5A4FD8]">入口动作 · 用户原话</span>
        <div className="mt-[5px] whitespace-pre-wrap text-[12.5px] font-bold leading-[1.5] text-ink">「{quote.trim()}」</div>
      </div>
    </div>
  )
}

/* ── 选题诊断明细分节排版：按「【标题】正文」切节，节题加粗带色条，正文保留软换行 ── */
function parseDiagnosisSections(detail: string): Array<{ title: string; body: string }> {
  const parts = detail.split(/【([^】]+)】/)
  const out: Array<{ title: string; body: string }> = []
  const pre = (parts[0] ?? '').trim()
  if (pre) out.push({ title: '', body: pre })
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const body = (parts[i + 1] ?? '').trim()
    if (body) out.push({ title: parts[i].trim(), body })
  }
  return out.length > 0 ? out : [{ title: '', body: detail }]
}

// B-32 起导出：StudioViewer 立项单「选题诊断明细」共用本分节排版
// B-35 遗留切片（2026-10-27 闭环，设计书 §2.6.8「可折叠」）：节题行点击开合——
// 默认仅「结论」节展开、其余长文节收起；无题节（兜底/前置段）无节题可点，恒展开。
export function DiagnosisSections({ detail }: { detail: string }) {
  const sections = useMemo(() => parseDiagnosisSections(detail), [detail])
  const [toggled, setToggled] = useState<Record<number, boolean>>({})
  const defaultOpen = (title: string) => /结论/.test(title)
  const isOpen = (i: number, title: string) => toggled[i] ?? defaultOpen(title)
  return (
    <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
      {sections.map((s, i) => {
        const open = !s.title || isOpen(i, s.title)
        return (
          <div key={i}>
            {s.title && (
              <button
                type="button"
                onClick={() => setToggled(prev => ({ ...prev, [i]: !isOpen(i, s.title) }))}
                className="mb-0.5 flex w-full items-center gap-1.5 text-left text-[10px] font-extrabold text-[#4A4F68] transition-colors hover:text-violet"
                data-diagnosis-section-toggle={s.title}
                aria-expanded={open}
              >
                <span className="w-2.5 shrink-0 text-center text-[8px] text-[#9AA0B5]">{open ? '▾' : '▸'}</span>
                <span className="h-2.5 w-[3px] rounded-full bg-violet/70" />
                {s.title}
              </button>
            )}
            {open && <div className="whitespace-pre-wrap pl-[9px]">{s.body}</div>}
          </div>
        )
      })}
    </div>
  )
}

/* ── 故事背景档案 Markdown 预览（2026-10-17 用户拍板；组件规则与 ChatComposer MarkdownText 同源，小字号定制） ── */
// B-33 起导出：StudioViewer 立项单背景档案折叠块共用本渲染
export function BackgroundMd({ content }: { content: string }) {
  return (
    <div
      className="md-bubble max-h-[260px] overflow-y-auto border-t border-[#F2F3F8] px-2.5 py-2 text-[10.5px] leading-[1.7] text-[#4A4F68]"
      data-stage0-background-md
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" className="text-violet underline underline-offset-2">{children}</a>
          ),
          h1: ({ children }) => <h1 className="mb-1 mt-2 text-[12px] font-extrabold text-ink first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1 mt-2 text-[11.5px] font-extrabold text-ink first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-0.5 mt-1.5 text-[11px] font-bold text-ink first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="my-0.5 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-0.5 ml-[16px] list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-0.5 ml-[16px] list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 marker:text-[#9AA0B5]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-[#DED9FB] pl-2 text-[#7A8098]">{children}</blockquote>
          ),
          hr: () => <hr className="my-2 border-line" />,
          table: ({ children }) => (
            <div className="my-1.5 overflow-x-auto">
              <table className="border-collapse text-[10px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-line px-1.5 py-0.5 font-bold">{children}</th>,
          td: ({ children }) => <td className="border border-line px-1.5 py-0.5">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/* ── 空态 ── */
function EmptyStage0({ state, projectTitle, onBackToDag, entryQuote = '' }: {
  state: ReturnType<typeof selectStage0State>
  projectTitle: string
  onBackToDag: () => void
  entryQuote?: string
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FAFBFE]" data-view="stage0">
      <Header projectTitle={projectTitle} onBackToDag={onBackToDag} />
      <Stage0Chain state={state} />
      <div className="absolute inset-0 top-[84px] overflow-y-auto px-[26px] py-[26px]">
        <div className="mx-auto flex max-w-[680px] flex-col gap-4 pt-[9vh]">
          <EntryQuoteCard quote={entryQuote} />
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
function DirtyBar({ state, driftLabel }: { state: ReturnType<typeof selectStage0State>; driftLabel: string | null }) {
  if (state.dirtyCount === 0) return null
  return (
    <div
      className="rounded-[10px] border border-[#F6E6C4] bg-[#FFF4DE] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#7A5C1D]"
      data-stage0-dirty-bar
    >
      <b className="text-[#C0841D]">有 {state.dirtyCount} 个产物基于旧版立项</b>
      <span className="ml-1.5">命中字段：{state.dirtyFields.map(dirtyFieldLabel).join('、')}</span>
      {driftLabel && <div className="mt-0.5 font-semibold text-[#C0841D]">{driftLabel}</div>}
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

/* ── B-24/D-017 · 卡①行内直改：六字段控件原位替换只读行 → 系统再版落盘 + 影响追溯（原则六 · 不经 AI 对话；右侧对话为大白话兜底入口）── */
const ASPECT_OPTIONS = ['竖屏 9:16', '横屏 16:9']

/** 只读字段行（卡①行内编辑态中与可改行混排，样式与只读卡一致） */
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#F6F7FB] px-2.5 py-1.5 text-[11px] last:border-b-0">
      <span className="w-[58px] shrink-0 text-[10px] font-semibold text-[#9AA0B5]">{label}</span>
      {children}
    </div>
  )
}

function EditRow({ label, field, bare, children }: { label: string; field: string; bare?: boolean; children: ReactNode }) {
  return (
    <label
      className={`flex items-center gap-2 text-[11px] ${bare ? 'px-0 py-0.5' : 'border-b border-[#F6F7FB] px-2.5 py-1.5 last:border-b-0'}`}
      data-stage0-edit-field={field}
    >
      <span className="w-[58px] shrink-0 text-[10px] font-semibold text-[#9AA0B5]">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink outline-none focus:border-violet'

const textareaCls =
  'w-full resize-y rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold leading-[1.6] text-ink outline-none focus:border-violet'

/** 多值 chip 编辑器（feature-013：目标平台 / 项目标签）；回车或失焦追加，点击 × 删除 */
function ChipEditor({ value, onChange, placeholder, testid }: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  testid?: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    setDraft('')
    if (!t || value.includes(t)) return
    onChange([...value, t])
  }
  return (
    <div className="flex flex-wrap items-center gap-1" data-stage0-edit-field={testid}>
      {value.map(v => (
        <span
          key={v}
          className="flex items-center gap-1 rounded-md bg-violet-soft px-1.5 py-[2px] text-[10.5px] font-bold text-[#5A4FD8]"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter(x => x !== v))}
            className="text-[#8A80E8] hover:text-[#5A4FD8]"
            aria-label={`移除 ${v}`}
          >×</button>
        </span>
      ))}
      <input
        className="min-w-[90px] flex-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink outline-none focus:border-violet"
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        onBlur={add}
      />
    </div>
  )
}

function BriefEditPanel({ brief, onClose, premiseDraft }: {
  brief: ProjectBrief
  onClose: () => void
  /** 故事前提草稿（编辑态在卡②就地编辑，与本面板共享同一次提交） */
  premiseDraft: Record<keyof ProjectBrief['premise'], string>
}) {
  const old = {
    kind: brief.kind,
    episodeDuration: text(brief.fiveElements.episodeDuration),
    episodeCount: text(brief.fiveElements.episodeCount),
    aspectRatio: text(brief.fiveElements.aspectRatio),
    genre: text(brief.fiveElements.genre),
    tone: text(brief.fiveElements.tone),
    platforms: Array.isArray(brief.fiveElements.platforms) ? brief.fiveElements.platforms : [],
    mainStyleId: text(brief.style.mainStyleId),
    auxiliaryStyleId: text(brief.style.auxiliaryStyleId),
    diagnosisSummary: text(brief.diagnosisSummary),
    l0Tags: brief.l0?.tags ?? [],
    l0Notes: text(brief.l0?.notes),
  }
  const [kind, setKind] = useState<ProjectKind>(old.kind)
  const [episodeDuration, setEpisodeDuration] = useState(old.episodeDuration)
  const [episodeCount, setEpisodeCount] = useState(old.episodeCount)
  const [aspectRatio, setAspectRatio] = useState(old.aspectRatio)
  const [genre, setGenre] = useState(old.genre)
  const [tone, setTone] = useState(old.tone)
  const [platforms, setPlatforms] = useState<string[]>(old.platforms)
  const [mainStyleId, setMainStyleId] = useState(old.mainStyleId)
  const [auxiliaryStyleId, setAuxiliaryStyleId] = useState(old.auxiliaryStyleId)
  const [diagnosisSummary, setDiagnosisSummary] = useState(old.diagnosisSummary)
  const [l0Tags, setL0Tags] = useState<string[]>(old.l0Tags)
  const [l0Notes, setL0Notes] = useState(old.l0Notes)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 画幅/风格选项：谱系 + D-023 画幅为唯一数据源；当前值不在集合内（历史/未来值）时前置兜底项保留
  const aspectOptions = old.aspectRatio && !ASPECT_OPTIONS.includes(old.aspectRatio)
    ? [old.aspectRatio, ...ASPECT_OPTIONS]
    : ASPECT_OPTIONS
  // feature-811：风格选项 = style:catalog 快照 entries（订阅懒加载；快照未到位时仅 extra 兜底项）
  const styleCatalog = useStyleCatalog()
  const styleOptions = useMemo(() => {
    const ids = styleCatalog.entries.map(e => e.id)
    const known = new Set(ids)
    const extra: string[] = []
    for (const cur of [old.mainStyleId, old.auxiliaryStyleId]) {
      if (cur && !known.has(cur) && !extra.includes(cur)) extra.push(cur)
    }
    return [...extra, ...ids]
  }, [styleCatalog.entries, old.mainStyleId, old.auxiliaryStyleId])

  const fmtStyle = (id: string) => (id ? styleRefLabel(id) : '无')
  const fmtKind = (k: ProjectKind) => (k === 'commercial' ? '商业短剧' : '个人纪念')
  const diffs: string[] = []
  if (kind !== old.kind)
    diffs.push(`- 项目性质（kind）：「${fmtKind(kind)}」（原「${fmtKind(old.kind)}」）`)
  if (episodeDuration.trim() !== old.episodeDuration)
    diffs.push(`- 单集时长（fiveElements.episodeDuration）：「${episodeDuration.trim()}」（原「${old.episodeDuration}」）`)
  if (episodeCount.trim() !== old.episodeCount)
    diffs.push(`- 集数（fiveElements.episodeCount）：「${episodeCount.trim()}」（原「${old.episodeCount}」）`)
  if (aspectRatio !== old.aspectRatio)
    diffs.push(`- 画幅（fiveElements.aspectRatio）：「${aspectRatio}」（原「${old.aspectRatio}」）`)
  if (genre.trim() !== old.genre)
    diffs.push(`- 题材赛道（fiveElements.genre）：「${genre.trim()}」（原「${old.genre}」）`)
  if (tone.trim() !== old.tone)
    diffs.push(`- 风格基调（fiveElements.tone）：「${tone.trim()}」（原「${old.tone}」）`)
  if (platforms.join('、') !== old.platforms.join('、'))
    diffs.push(`- 目标平台（fiveElements.platforms）：「${platforms.join('、')}」（原「${old.platforms.join('、')}」）`)
  if (mainStyleId !== old.mainStyleId)
    diffs.push(`- 主视觉风格（style.mainStyleId）：「${fmtStyle(mainStyleId)}」（原「${fmtStyle(old.mainStyleId)}」）`)
  if (auxiliaryStyleId !== old.auxiliaryStyleId)
    diffs.push(`- 辅助视觉风格（style.auxiliaryStyleId）：「${fmtStyle(auxiliaryStyleId)}」（原「${fmtStyle(old.auxiliaryStyleId)}」）`)
  if (diagnosisSummary.trim() !== old.diagnosisSummary)
    diffs.push(`- 选题诊断结论（diagnosisSummary）：「${diagnosisSummary.trim()}」（原「${old.diagnosisSummary}」）`)
  for (const { key, label } of PREMISE_FIELDS) {
    const cur = premiseDraft[key]
    const prev = text(brief.premise[key])
    if (cur.trim() !== prev) diffs.push(`- ${label}（premise.${key}）：「${cur.trim()}」（原「${prev}」）`)
  }
  if (l0Tags.join('、') !== old.l0Tags.join('、'))
    diffs.push(`- 项目标签（l0.tags）：「${l0Tags.join('、')}」（原「${old.l0Tags.join('、')}」）`)
  if (l0Notes.trim() !== old.l0Notes)
    diffs.push(`- 项目备注（l0.notes）：「${l0Notes.trim()}」（原「${old.l0Notes}」）`)

  // 就绪判定红线（evaluateDraft 既有口径）：主风格非空（MAIN_STYLE_MISSING）；六要素 / 故事前提非空串
  const invalid =
    !episodeDuration.trim() || !episodeCount.trim() || !aspectRatio || !mainStyleId ||
    !genre.trim() || !tone.trim() || platforms.filter(p => p.trim() !== '').length === 0 ||
    PREMISE_FIELDS.some(({ key }) => premiseDraft[key].trim() === '')

  // D-017：系统直改——patch 只携带变更字段；approve.by 恒 'ui'、受影响节点全仅挂脏（主进程语义）
  const submit = async () => {
    const patch: Parameters<typeof window.api.updateBrief>[0] = {}
    if (kind !== old.kind) patch.kind = kind
    const fe: {
      episodeDuration?: string; episodeCount?: string; aspectRatio?: string
      genre?: string; tone?: string; platforms?: string[]
    } = {}
    if (episodeDuration.trim() !== old.episodeDuration) fe.episodeDuration = episodeDuration.trim()
    if (episodeCount.trim() !== old.episodeCount) fe.episodeCount = episodeCount.trim()
    if (aspectRatio !== old.aspectRatio) fe.aspectRatio = aspectRatio
    if (genre.trim() !== old.genre) fe.genre = genre.trim()
    if (tone.trim() !== old.tone) fe.tone = tone.trim()
    if (platforms.join('、') !== old.platforms.join('、')) fe.platforms = platforms
    if (Object.keys(fe).length > 0) patch.fiveElements = fe
    const pr: Record<string, string> = {}
    for (const { key } of PREMISE_FIELDS) {
      if (premiseDraft[key].trim() !== text(brief.premise[key])) pr[key] = premiseDraft[key].trim()
    }
    if (Object.keys(pr).length > 0) patch.premise = pr
    const st: { mainStyleId?: string; auxiliaryStyleId?: string } = {}
    if (mainStyleId !== old.mainStyleId) st.mainStyleId = mainStyleId
    if (auxiliaryStyleId !== old.auxiliaryStyleId) st.auxiliaryStyleId = auxiliaryStyleId
    if (Object.keys(st).length > 0) patch.style = st
    if (diagnosisSummary.trim() !== old.diagnosisSummary) patch.diagnosisSummary = diagnosisSummary.trim()
    const l0: { tags?: string[]; notes?: string } = {}
    if (l0Tags.join('、') !== old.l0Tags.join('、')) l0.tags = l0Tags
    if (l0Notes.trim() !== old.l0Notes) l0.notes = l0Notes.trim()
    if (Object.keys(l0).length > 0) patch.l0 = l0
    setSubmitting(true)
    setError(null)
    try {
      await window.api.updateBrief(patch)
      // 再版成功：canvas:changed 广播 → brief 节点 ref 指向 v(N+1) → useBriefDocuments 自动重读新版
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  // 卡①行内编辑态：全字段原位替换只读行（feature-013：L0 标签/备注 + 六要素 + 风格 + 诊断结论）
  return (
    <section className="flex flex-col overflow-hidden rounded-[12px] border border-violet bg-white" data-stage0-edit-panel>
      <div className="flex items-center gap-2 border-b border-[#F2F3F8] px-3.5 py-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-soft text-[11px] font-extrabold text-violet">1</span>
        <span className="text-[12px] font-extrabold text-ink">选题诊断</span>
        <span className="rounded-full bg-violet-soft px-2 py-px text-[9px] font-bold text-[#5A4FD8]">修改中</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md border border-line bg-white px-2.5 py-1 text-[10.5px] text-[#7A8098] hover:bg-[#F1F2F8]"
          data-stage0-edit-cancel
        >取消</button>
      </div>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        {/* feature-013：L0 区（项目标签 / 项目备注）——仅元数据，入模随再版留痕 */}
        <div className="flex flex-col gap-1 rounded-md border border-line px-2.5 py-2">
          <div className="text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">项目标签与备注（L0）</div>
          <EditRow label="项目标签" field="l0.tags" bare>
            <ChipEditor value={l0Tags} onChange={setL0Tags} placeholder="输入标签后回车" testid="l0.tags" />
          </EditRow>
          <EditRow label="项目备注" field="l0.notes" bare>
            <textarea
              className={textareaCls}
              rows={2}
              value={l0Notes}
              onChange={e => setL0Notes(e.target.value)}
              placeholder="项目备注（仅元数据，不入影响清单）"
            />
          </EditRow>
        </div>
        <div className="rounded-md border border-line">
          <EditRow label="项目性质" field="kind">
            <select className={inputCls} value={kind} onChange={e => setKind(e.target.value as ProjectKind)}>
              <option value="commercial">商业短剧</option>
              <option value="memorial">个人纪念</option>
            </select>
          </EditRow>
          <EditRow label="题材赛道" field="genre">
            <input className={inputCls} value={genre} onChange={e => setGenre(e.target.value)} placeholder="如：甜宠 / 悬疑" />
          </EditRow>
          <EditRow label="目标平台" field="platforms">
            <ChipEditor value={platforms} onChange={setPlatforms} placeholder="输入平台后回车" testid="platforms" />
          </EditRow>
          <EditRow label="单集时长" field="episodeDuration">
            <input className={inputCls} value={episodeDuration} onChange={e => setEpisodeDuration(e.target.value)} placeholder="如：60 秒" />
          </EditRow>
          <EditRow label="集数" field="episodeCount">
            <input className={inputCls} value={episodeCount} onChange={e => setEpisodeCount(e.target.value)} placeholder="如：12 集" />
          </EditRow>
          <EditRow label="风格基调" field="tone">
            <input className={inputCls} value={tone} onChange={e => setTone(e.target.value)} placeholder="如：高甜 / 悬疑冷调" />
          </EditRow>
          <EditRow label="画幅" field="aspectRatio">
            <select className={inputCls} value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
              {aspectOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </EditRow>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-violet bg-violet-soft px-2.5 py-2">
          <EditRow label="主风格" field="mainStyleId" bare>
            <select className={inputCls} value={mainStyleId} onChange={e => setMainStyleId(e.target.value)}>
              {styleOptions.map(id => <option key={id} value={id}>{styleRefLabel(id)}</option>)}
            </select>
          </EditRow>
          <EditRow label="辅助风格" field="auxiliaryStyleId" bare>
            <select className={inputCls} value={auxiliaryStyleId} onChange={e => setAuxiliaryStyleId(e.target.value)}>
              <option value="">无</option>
              {styleOptions.map(id => <option key={id} value={id}>{styleRefLabel(id)}</option>)}
            </select>
          </EditRow>
        </div>
        {/* feature-013：诊断结论直改（诊断明细恒只读，D-018 语义不变） */}
        <div className="rounded-md border border-line px-2.5 py-2">
          <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">选题诊断结论</div>
          <textarea
            className={textareaCls}
            rows={3}
            value={diagnosisSummary}
            onChange={e => setDiagnosisSummary(e.target.value)}
            data-stage0-edit-field="diagnosisSummary"
          />
        </div>
        {/* 诊断明细（D-018）：分节排版 + 长文限高滚动，恒只读 */}
        {text(brief.diagnosisDetail) && (
          <div className="rounded-md bg-[#F7F8FC] px-2.5 py-2 text-[10.5px] leading-[1.7] text-[#6A708A]" data-stage0-diagnosis-detail>
            <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">选题诊断明细</div>
            <DiagnosisSections detail={text(brief.diagnosisDetail)} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={invalid || diffs.length === 0 || submitting}
              onClick={() => { void submit() }}
              className="rounded-lg bg-violet px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#4A3FD0] disabled:cursor-not-allowed disabled:opacity-40"
              data-stage0-edit-submit
            >{submitting ? '再版中…' : '确认再版'}</button>
            <span className="text-[10px] text-[#A6ABC0]">
              {diffs.length === 0 ? '尚未修改任何字段' : `共 ${diffs.length} 处变更`}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-[1.6] text-[#A6ABC0]">
            提交后系统直接再版为 v{brief.version + 1} 并完成影响追溯（不经 AI 对话）；右侧对话保留为开放式修改的补充入口
          </p>
          {error && (
            <p className="mt-2 rounded-md border border-[#F0C5CB] bg-[#FDF3F4] px-2.5 py-1.5 text-[10.5px] leading-[1.6] text-[#C23D4D]" data-stage0-edit-error>
              再版失败：{error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/* ── published 主体：双卡 + 定案/版本区 ── */
function PublishedBody({ brief, state, bg, entryQuote = '', driftLabel }: {
  brief: ProjectBrief
  state: ReturnType<typeof selectStage0State>
  bg: BgDocState
  entryQuote?: string
  driftLabel: string | null
}) {
  const [bgOpen, setBgOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  // feature-013：故事前提五子项直改（编辑态与卡①编辑面板共享同一份草稿，一次提交一次再版）
  const [premiseDraft, setPremiseDraft] = useState<Record<keyof ProjectBrief['premise'], string>>(() => ({
    leads: text(brief.premise.leads),
    time: text(brief.premise.time),
    place: text(brief.premise.place),
    coreEvent: text(brief.premise.coreEvent),
    seasonBoundary: text(brief.premise.seasonBoundary),
  }))
  // feature-013：本人直改过的前提键 → 显示为 human 语义（009 数据流零 diff，仅展示层叠加）
  const [editedPremise, setEditedPremise] = useState<string[]>([])
  const { facts } = useCaptureFacts()
  const confirmMap = useMemo(() => selectPremiseConfirmation(facts), [facts])
  const kindLabel = brief.kind === 'commercial' ? '商业短剧' : '个人纪念'
  const platforms = Array.isArray(brief.fiveElements.platforms) ? brief.fiveElements.platforms.join(' · ') : ''
  const isV1 = brief.version === 1
  const l0Tags = brief.l0?.tags ?? []
  const l0Notes = text(brief.l0?.notes)

  return (
    <div className="flex flex-col gap-3.5">
      <EntryQuoteCard quote={entryQuote} />
      {state.gate0 && state.gate0.status !== 'approved' && <GatePendingStrip gate0={state.gate0} />}
      <DirtyBar state={state} driftLabel={driftLabel} />

      <div className="grid grid-cols-2 gap-[14px]">
        {/* 卡① 选题诊断 + 六要素；修改立项时原位切换为行内编辑态（D-017） */}
        {editing ? (
          <BriefEditPanel
            brief={brief}
            onClose={() => setEditing(false)}
            premiseDraft={premiseDraft}
          />
        ) : (
        <section className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-white" data-stage0-card-diagnosis>
          <div className="flex items-center gap-2 border-b border-[#F2F3F8] px-3.5 py-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-soft text-[11px] font-extrabold text-violet">1</span>
            <span className="text-[12px] font-extrabold text-ink">选题诊断</span>
            <span className="ml-auto rounded-full bg-[#F2F3F9] px-2 py-px text-[9px] font-bold text-[#7A8098]">{kindLabel}</span>
          </div>
          <div className="flex flex-col gap-3 px-3.5 py-3">
            <div className="rounded-md border border-line">
              {FIVE_ELEMENT_FIELDS.map(({ key, label }) => (
                <FieldRow key={key} label={label}>
                  {key === 'platforms'
                    ? <LeafValue value={platforms} />
                    : <LeafValue value={brief.fiveElements[key]} />}
                </FieldRow>
              ))}
            </div>
            {/* 风格引用：ID · 谱系名称（未知 ID 回退只显 ID）+ 谱系版本 */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-violet bg-violet-soft px-2.5 py-2 text-[10.5px]">
              <span className="text-[9.5px] font-extrabold text-[#5A4FD8]">视觉风格</span>
              <span className="font-extrabold text-ink" data-stage0-style>
                主风格 {styleRefLabel(text(brief.style.mainStyleId)) || '—'} · 谱系 {text(brief.style.catalogVersion) || '—'}
              </span>
              {text(brief.style.auxiliaryStyleId) && (
                <span className="rounded bg-white/70 px-1.5 py-px text-[10px] font-bold text-[#5A4FD8]">辅助 {styleRefLabel(text(brief.style.auxiliaryStyleId))}</span>
              )}
            </div>
            {/* feature-013：L0 标签与备注（仅元数据，低级不入影响清单） */}
            {(l0Tags.length > 0 || l0Notes !== '') && (
              <div className="rounded-md border border-line px-2.5 py-2 text-[10.5px] leading-[1.7] text-[#6A708A]" data-stage0-l0>
                <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">项目标签与备注</div>
                {l0Tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1" data-stage0-l0-tags>
                    {l0Tags.map(t => (
                      <span key={t} className="rounded bg-violet-soft px-1.5 py-px text-[10px] font-bold text-[#5A4FD8]">{t}</span>
                    ))}
                  </div>
                )}
                {l0Notes !== '' && <div className="mt-1 whitespace-pre-wrap" data-stage0-l0-notes>{l0Notes}</div>}
              </div>
            )}
            {text(brief.diagnosisSummary) && (
              <div className="rounded-md bg-[#F7F8FC] px-2.5 py-2 text-[10.5px] leading-[1.7] text-[#6A708A]">
                <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">选题诊断结论</div>
                {brief.diagnosisSummary}
              </div>
            )}
            {/* 诊断明细（D-018）：分节排版 + 长文限高滚动，恒只读 */}
            {text(brief.diagnosisDetail) && (
              <div className="rounded-md bg-[#F7F8FC] px-2.5 py-2 text-[10.5px] leading-[1.7] text-[#6A708A]" data-stage0-diagnosis-detail>
                <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">选题诊断明细</div>
                <DiagnosisSections detail={text(brief.diagnosisDetail)} />
              </div>
            )}
          </div>
        </section>
        )}

        {/* 卡② 故事前提 + 背景档案折叠 */}
        <section className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-white" data-stage0-card-premise>
          <div className="flex items-center gap-2 border-b border-[#F2F3F8] px-3.5 py-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-soft text-[11px] font-extrabold text-violet">2</span>
            <span className="text-[12px] font-extrabold text-ink">故事前提</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 px-3.5 py-3">
            <div className="overflow-hidden rounded-md border border-line">
              {PREMISE_FIELDS.map(({ key, label }) => {
                // feature-013：本人直改过的键按 human 语义展示（009 数据流零 diff，仅展示层叠加）
                const conf = editedPremise.includes(key) ? 'human' : confirmMap[key]
                return (
                <div
                  key={key}
                  className={`flex items-start gap-2 border-b border-[#F6F7FB] px-2.5 py-1.5 text-[11px] last:border-b-0${conf === 'human' ? ' bg-[#F2FBF6]' : conf === 'ai' ? ' bg-[#FDF8EE]' : ''}`}
                  data-stage0-premise-row={key}
                  data-stage0-premise-confirmation={conf}
                >
                  <span className="mt-px w-[58px] shrink-0 text-[10px] font-semibold text-[#9AA0B5]">{label}</span>
                  {editing ? (
                    <input
                      className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink outline-none focus:border-violet"
                      value={premiseDraft[key]}
                      data-stage0-premise-edit={key}
                      onChange={e => {
                        const v = e.target.value
                        setPremiseDraft(prev => ({ ...prev, [key]: v }))
                        setEditedPremise(prev => (prev.includes(key) ? prev : [...prev, key]))
                      }}
                    />
                  ) : (
                    <LeafValue value={brief.premise[key]} />
                  )}
                  {conf !== 'none' && (
                    <span
                      className={conf === 'human'
                        ? 'ml-auto shrink-0 rounded-full border border-[#B9E8D2] bg-[#E7F8F0] px-1.5 py-px text-[9.5px] font-bold text-[#1E9E66]'
                        : 'ml-auto shrink-0 rounded-full border border-[#F0E2C0] bg-[#FBF3E2] px-1.5 py-px text-[9.5px] font-bold text-[#B07E2A]'}
                      data-stage0-premise-seal
                    >{conf === 'human' ? '不可篡改' : 'AI 拟稿'}</span>
                  )}
                </div>
                )
              })}
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
                  <span
                    className="ml-auto shrink-0 rounded-full border border-[#B9E8D2] bg-[#E7F8F0] px-1.5 py-px text-[9.5px] font-bold text-[#1E9E66]"
                    data-stage0-background-seal
                  >不可篡改</span>
                </button>
                {bgOpen && (
                  bg.phase === 'ok'
                    ? <BackgroundMd content={bg.content} />
                    : <div className="border-t border-[#F2F3F8] px-2.5 py-2 text-[10px] text-[#B8BDCE]">背景档案读取失败，已跳过。</div>
                )}
              </div>
            )}
            <p className="mt-auto text-[10px] leading-[1.6] text-[#A6ABC0]">故事前提可直接在卡②行内改；也可点下方「修改立项…」一次改完再版（不经 AI 对话）。</p>
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
          {!editing && (
            <button
              type="button"
              onClick={() => {
                // feature-013：进入编辑态即以当前立项单为基线重置故事前提草稿
                setPremiseDraft({
                  leads: text(brief.premise.leads),
                  time: text(brief.premise.time),
                  place: text(brief.premise.place),
                  coreEvent: text(brief.premise.coreEvent),
                  seasonBoundary: text(brief.premise.seasonBoundary),
                })
                setEditedPremise([])
                setEditing(true)
              }}
              className="ml-auto rounded-lg border border-violet bg-violet-soft px-3 py-1.5 text-[11px] font-bold text-[#5A4FD8] hover:bg-[#DED9FB]"
              data-stage0-edit-toggle
            >修改立项…</button>
          )}
        </div>
        {/* 入口动作（D-018 恒显）：verbal=用户原话；gate=门批准入一键拍板；ui=修改立项系统直改 */}
        <div className="mt-2.5" data-stage0-entry-action>
          <p className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">
            入口动作 · {brief.approve.by === 'verbal' ? '用户原话' : brief.approve.by === 'gate' ? '门批准入' : '系统直改'}
          </p>
          {brief.approve.by === 'verbal' && text(brief.approve.verbal?.quote) ? (
            <blockquote className="rounded-md rounded-l-none border-l-[3px] border-violet bg-[#F7F8FC] px-3 py-2 text-[11px] leading-[1.7] text-[#4A4F68]" data-stage0-verbal-quote>
              「{brief.approve.verbal?.quote}」
            </blockquote>
          ) : (
            <p className="rounded-md bg-[#F7F8FC] px-3 py-2 text-[11px] leading-[1.7] text-[#4A4F68]">
              {brief.approve.by === 'gate'
                ? '门批准入 · 一键拍板'
                : brief.approve.by === 'ui'
                  ? '修改立项面板 · 系统直改再版'
                  : '（原话缺失）'}
            </p>
          )}
        </div>
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

function BriefError({ projectTitle, onBackToDag, doc, state }: {
  projectTitle: string
  onBackToDag: () => void
  doc: Extract<BriefDocState, { phase: 'error' }>
  state: ReturnType<typeof selectStage0State>
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
      <Stage0Chain state={state} />
      <div className="absolute inset-0 top-[84px] overflow-y-auto px-[26px] py-[26px]">
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

export default function Stage0View({ canvas, projectTitle, onBackToDag, entryQuote = '' }: Stage0ViewProps) {
  const state = useMemo(() => selectStage0State(canvas), [canvas])
  // feature-806 · B-46 漂移提醒：聚合态取各脏节点漂移天数 max（无 markedAt 按 0），超 30 天 DirtyBar 追加一行（不阻塞）
  const dirtyDriftLabel = driftReminderLabel(
    canvas.nodes.reduce((m, n) => Math.max(m, n.dirty ? (driftDays(n.dirty.markedAt) ?? 0) : 0), 0),
  )

  if (state.phase === 'empty' || !state.briefNode) {
    return <EmptyStage0 state={state} projectTitle={projectTitle} onBackToDag={onBackToDag} entryQuote={entryQuote} />
  }

  const refPath = state.briefNode.ref?.format === 'json' ? state.briefNode.ref.path : ''

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FAFBFE]" data-view="stage0">
      <Header projectTitle={projectTitle} onBackToDag={onBackToDag} />
      <Stage0Chain state={state} />
      <div className="absolute inset-0 top-[84px] overflow-y-auto px-[26px] py-[22px]">
        <div className="mx-auto flex max-w-[920px] flex-col gap-[18px]" data-stage0-brief>
          <PublishedLoaded state={state} refPath={refPath} projectTitle={projectTitle} onBackToDag={onBackToDag} entryQuote={entryQuote} driftLabel={dirtyDriftLabel} />
        </div>
      </div>
    </div>
  )
}

/** 隔离读取 hook（保证 hooks 调用顺序不随主态切换变化） */
function PublishedLoaded({ state, refPath, projectTitle, onBackToDag, entryQuote = '', driftLabel }: {
  state: ReturnType<typeof selectStage0State>
  refPath: string
  projectTitle: string
  onBackToDag: () => void
  entryQuote?: string
  driftLabel: string | null
}) {
  const { brief, bg } = useBriefDocuments(refPath)

  if (!refPath) {
    return <BriefError projectTitle={projectTitle} onBackToDag={onBackToDag} doc={{ phase: 'error', reason: 'MISSING_REF', path: state.briefNode?.id ?? 'step-0-brief' }} state={state} />
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
    return <BriefError projectTitle={projectTitle} onBackToDag={onBackToDag} doc={brief} state={state} />
  }

  // 展示版本以文件内 brief.version 为准（D-004）
  return (
    <>
      <div className="-mb-1 flex items-center gap-2">
        <span className="rounded-full bg-[#E7F8F0] px-2 py-px text-[10px] font-bold text-[#1E9E66]" data-stage0-version={brief.brief.version}>立项单 v{brief.brief.version}</span>
        <span className="text-[10px] text-[#A6ABC0]">来源：{brief.path}</span>
      </div>
      <PublishedBody brief={brief.brief} state={state} bg={bg} entryQuote={entryQuote} driftLabel={driftLabel} />
    </>
  )
}
