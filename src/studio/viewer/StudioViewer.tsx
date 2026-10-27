// 只读产物查看器
// 经 file:read 按 node.ref.path 读落盘产物，按 node.kind 结构化呈现：
// brief / outline / scenes / dialogue / storyboard / profiles / visual-style / shot 媒体；
// 未知 JSON / MD 回退美化原文。无编辑、无保存。
import { useEffect, useState, type ReactNode } from 'react'
import type {
  CanvasNode,
  CharacterProfile,
  ProjectBrief,
  Scene,
  Shot,
  StoryOutline,
  VisualStyle,
} from '@shared/types'

import { getStyleName } from './style-catalog-store'
import { dirtyFieldLabel } from './CanvasBoard'
import { BACKGROUND_PATH, BackgroundMd, DiagnosisSections, EntryQuoteCard, formatAt } from './Stage0View'
import BriefHistoryView from './BriefHistoryView'

/** 谱系风格引用：ID · 名称；未知/未来版本 ID 回退只显 ID */
function styleRefLabel(id: string): string {
  const name = getStyleName(id)
  return name ? `${id} · ${name}` : id
}

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; content: string; format: 'json' | 'md' }
  | { phase: 'error'; message: string }

interface Props {
  node: CanvasNode
  kindLabel: string
  onClose: () => void
  /** B-33：入口动作 · 用户原话（会话首条 user 消息，由 StudioApp 传入；仅 brief 视图显示） */
  entryQuote?: string
  /** feature-007：脏读黄条「一键对齐」回调（未传 → 黄条无钮） */
  onRequestAlign?: () => void
}

// ── 通用视觉件 ──────────────────────────────────────────────

function Section({ title, extra, children }: { title?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-3.5">
      {title && (
        <div className="mb-2.5 flex items-center justify-between">
          <h4 className="text-[12px] font-extrabold text-ink">{title}</h4>
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line/60 px-3 py-[7px] text-[11.5px] last:border-b-0 odd:bg-canvas/60">
      <span className="w-[64px] shrink-0 text-muted">{k}</span>
      <span className="min-w-0 flex-1 break-words leading-5 text-ink">{v}</span>
    </div>
  )
}

function Tag({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'green' | 'blue' | 'gray' | 'amber' }) {
  const cls = {
    violet: 'bg-violet-soft text-violet',
    green: 'bg-ok/10 text-ok',
    blue: 'bg-[#EAF1FE] text-[#3E6FD0]',
    gray: 'bg-[#F1F2F8] text-[#6A708A]',
    amber: 'bg-[#FDF3E0] text-[#B26A00]',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>
}

function RecipeBox({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mt-2 rounded-lg border border-line bg-[#F8F9FC] px-2.5 py-2 text-[10.5px] leading-[1.6] text-[#4A4F68]">
      {label && <div className="mb-0.5 font-bold text-muted">{label}</div>}
      {children}
    </div>
  )
}

// ── 各 kind 视图 ────────────────────────────────────────────

/** B-33：查看器读背景档案（与 Stage0View useBriefDocuments 的 bg 分支同语义：NOT_FOUND→absent 不显块，其他失败→failed 块内提示） */
type BgDoc = { phase: 'absent' } | { phase: 'failed' } | { phase: 'ok'; content: string }
function useBackgroundDoc(): BgDoc {
  const [bg, setBg] = useState<BgDoc>({ phase: 'absent' })
  useEffect(() => {
    let alive = true
    window.api.fileRead({ path: BACKGROUND_PATH })
      .then(res => {
        if (!alive) return
        setBg(res.ok ? { phase: 'ok', content: res.content } : res.error.code === 'NOT_FOUND' ? { phase: 'absent' } : { phase: 'failed' })
      })
      .catch(() => { if (alive) setBg({ phase: 'failed' }) })
    return () => { alive = false }
  }, [])
  return bg
}

function BriefView({ data, entryQuote = '' }: { data: ProjectBrief; entryQuote?: string }) {
  const fe = data.fiveElements
  const p = data.premise
  const s = data.style
  const changes = data.changesFromPrevious
  const [bgOpen, setBgOpen] = useState(false)
  const bg = useBackgroundDoc()
  const approveLabel =
    data.approve.by === 'verbal'
      ? `口头拍板${data.approve.verbal?.quote ? `：“${data.approve.verbal.quote}”` : ''}`
      : '门内拍板'
  return (
    <div className="flex flex-col gap-3">
      <EntryQuoteCard quote={entryQuote} />
      <Section
        title="项目性质"
        extra={<Tag tone="violet">立项单 v{data.version}</Tag>}
      >
        <div className="rounded-lg border border-line">
          <KV k="性质" v={data.kind === 'commercial' ? '商业短剧' : '个人纪念'} />
          <KV k="发布时间" v={data.publishedAt} />
          <KV k="拍板方式" v={approveLabel} />
          <KV k="拍板时间" v={formatAt(data.approve.at)} />
          {data.approve.note && <KV k="裁决备注" v={data.approve.note} />}
        </div>
      </Section>
      <Section title="立项六要素">
        <div className="rounded-lg border border-line">
          <KV k="题材赛道" v={fe.genre} />
          <KV k="目标平台" v={fe.platforms.join('、')} />
          <KV k="单集时长" v={fe.episodeDuration} />
          <KV k="集数" v={fe.episodeCount} />
          <KV k="风格基调" v={fe.tone} />
          <KV k="画幅" v={fe.aspectRatio} />
        </div>
      </Section>
      <Section title="故事前提">
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-line">
            <KV k="人物" v={p.leads} />
            <KV k="时间" v={p.time} />
            <KV k="地点" v={p.place} />
            <KV k="核心事件" v={p.coreEvent} />
            <KV k="本季边界" v={p.seasonBoundary} />
          </div>
          {bg.phase !== 'absent' && (
            <div className="rounded-lg border border-line" data-viewer-background>
              <button
                type="button"
                onClick={() => setBgOpen(v => !v)}
                className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[10.5px] font-extrabold text-[#5A607A] hover:bg-[#F8F9FD]"
                aria-expanded={bgOpen}
              >
                <span className="text-[#A6ABC0]">{bgOpen ? '▾' : '▸'}</span>{BACKGROUND_PATH}
              </button>
              {bgOpen && (
                bg.phase === 'ok'
                  ? <BackgroundMd content={bg.content} />
                  : <div className="border-t border-[#F2F3F8] px-2.5 py-2 text-[10px] text-[#B8BDCE]">背景档案读取失败，已跳过。</div>
              )}
            </div>
          )}
        </div>
      </Section>
      <Section title="视觉风格">
        <div className="rounded-lg border border-line">
          <KV k="主风格" v={`${styleRefLabel(s.mainStyleId)} @ ${s.catalogVersion}`} />
          <KV k="辅助气氛" v={s.auxiliaryStyleId ? styleRefLabel(s.auxiliaryStyleId) : '无'} />
        </div>
      </Section>
      <Section title="选题诊断">
        <div className="flex flex-col gap-2">
          <div>
            <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">选题诊断结论</div>
            <p className="text-[11.5px] leading-[1.7] text-[#4A4F68]">{data.diagnosisSummary || '（无）'}</p>
          </div>
          {data.diagnosisDetail && (
            <div>
              <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">选题诊断明细</div>
              <div className="text-[11.5px] leading-[1.7] text-[#4A4F68]">
                <DiagnosisSections detail={data.diagnosisDetail} />
              </div>
            </div>
          )}
        </div>
      </Section>
      <Section title={`相对上一版改动 · ${changes.length} 项`}>
        {data.version === 1 || changes.length === 0 ? (
          <p className="text-[11.5px] leading-[1.7] text-[#4A4F68]">首版立项。</p>
        ) : (
          <div className="rounded-lg border border-line">
            {changes.map((c, i) => (
              <div
                key={`${c.field}-${i}`}
                className="border-b border-line/60 px-3 py-[7px] text-[11.5px] last:border-b-0 odd:bg-canvas/60"
              >
                <div className="break-all text-[10.5px] leading-4 text-muted">{c.field}</div>
                <div className="mt-0.5 break-words leading-5 text-ink">
                  {c.from || '（空）'} → {c.to || '（空）'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function OutlineView({ data }: { data: StoryOutline }) {
  return (
    <div className="flex flex-col gap-3">
      <Section title="一句话故事（Logline）">
        <p className="text-[12px] font-semibold leading-[1.7] text-ink">{data.logline}</p>
      </Section>
      <Section title="本季主线">
        <p className="text-[11.5px] leading-[1.7] text-[#4A4F68]">{data.seasonArc}</p>
      </Section>
      <div className="grid grid-cols-2 gap-3">
        <Section title="主题 / 情绪">
          <div className="flex flex-wrap gap-1.5">{data.themes.map(t => <Tag key={t} tone="violet">{t}</Tag>)}</div>
        </Section>
        <Section title="核心冲突 / 钩子">
          <ul className="flex flex-col gap-1">
            {data.conflicts.map((c, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-5 text-[#4A4F68]">
                <span className="text-violet">●</span>{c}
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <Section title={`分集梗概 · ${data.episodes.length} 集`}>
        <div className="flex flex-col gap-2">
          {data.episodes.map(ep => (
            <div key={ep.ep} className="rounded-lg border border-line p-2.5">
              <div className="flex items-baseline gap-2">
                <Tag tone="blue">E{String(ep.ep).padStart(2, '0')}</Tag>
                <span className="text-[12px] font-bold text-ink">{ep.title}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-[1.65] text-[#4A4F68]">{ep.synopsis}</p>
              <div className="mt-1.5 flex gap-1.5 text-[10.5px]">
                <span className="shrink-0 font-bold text-[#B26A00]">集尾钩子</span>
                <span className="leading-[1.6] text-[#8A6D3B]">{ep.hook}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

const SCENE_TAG_TONE: Record<string, 'blue' | 'amber' | 'gray'> = {
  内: 'blue', 外: 'amber', 内外: 'gray', 日: 'amber', 夜: 'gray', 晨: 'blue', 昏: 'amber',
}

function ScenesView({ data }: { data: Scene[] }) {
  const total = data.reduce((s, x) => s + x.estSeconds, 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <Tag tone="violet">{data.length} 场</Tag>
        <Tag tone="gray">预估 {total}″ ≈ {Math.round(total / 60)} 分钟</Tag>
      </div>
      {data.map(sc => (
        <Section
          key={sc.sceneNo}
          title={`第 ${sc.sceneNo} 场 · ${sc.slug}`}
          extra={<div className="flex gap-1"><Tag tone={SCENE_TAG_TONE[sc.interiorExterior] ?? 'gray'}>{sc.interiorExterior}</Tag><Tag tone={SCENE_TAG_TONE[sc.dayNight] ?? 'gray'}>{sc.dayNight}</Tag></div>}
        >
          <div className="rounded-lg border border-line">
            <KV k="地点" v={sc.location} />
            <KV k="出场角色" v={sc.characterIds.length ? sc.characterIds.join('、') : '—（空镜）'} />
            <KV k="情绪基调" v={sc.emotion} />
            <KV k="预估时长" v={`${sc.estSeconds} 秒`} />
          </div>
          <p className="mt-2 text-[11px] italic leading-[1.6] text-muted">{sc.summary}</p>
          <div className="mt-2">
            <div className="mb-1 text-[10px] font-bold text-muted">节拍</div>
            <ol className="flex flex-col gap-1">
              {sc.beats.map((b, i) => (
                <li key={i} className="flex gap-2 text-[11px] leading-[1.6] text-[#4A4F68]">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-violet-soft text-[9px] font-bold text-violet">{i + 1}</span>
                  {b}
                </li>
              ))}
            </ol>
          </div>
        </Section>
      ))}
    </div>
  )
}

function DialogueView({ data }: { data: { ep: number; sceneNo: number; lines: { speakerId?: string; speakerName?: string; kind: string; text: string; emotion?: string; action?: string }[] }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {data.map(ds => (
        <Section key={ds.sceneNo} title={`第 ${ds.sceneNo} 场台词 · ${ds.lines.length} 句`}>
          <div className="flex flex-col gap-2">
            {ds.lines.map((ln, i) => (
              <div key={i} className="rounded-lg border border-line px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-ink">{ln.speakerName || ln.speakerId || '角色'}</span>
                  <Tag tone={ln.kind === '旁白' ? 'gray' : ln.kind === '独白' ? 'amber' : 'violet'}>{ln.kind}</Tag>
                  {ln.emotion && <span className="text-[10px] text-muted">（{ln.emotion}）</span>}
                </div>
                {ln.action && <div className="mt-0.5 text-[10.5px] italic text-muted">（{ln.action}）</div>}
                <p className="mt-1 text-[11.5px] leading-[1.7] text-ink">{ln.text}</p>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

const SHOT_SIZE_TONE: Record<string, 'violet' | 'blue' | 'green' | 'amber' | 'gray'> = {
  特写: 'violet', 近景: 'blue', 中景: 'green', 全景: 'amber', 远景: 'gray',
}

function StoryboardView({ data }: { data: Shot[] }) {
  const total = data.reduce((s, x) => s + x.durationSec, 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <Tag tone="violet">{data.length} 镜</Tag>
        <Tag tone="gray">总时长 {total}″</Tag>
      </div>
      <Section>
        <div className="flex flex-col gap-1.5">
          {data.map(sh => (
            <div key={sh.shotNo} className="rounded-lg border border-line p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone="blue">V{String(sh.shotNo).padStart(3, '0')}</Tag>
                <Tag tone={SHOT_SIZE_TONE[sh.shotSize] ?? 'gray'}>{sh.shotSize}</Tag>
                <Tag tone="gray">第 {sh.sceneNo} 场</Tag>
                <span className="ml-auto text-[10.5px] font-bold text-muted">{sh.durationSec}″</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-[1.65] text-ink">{sh.action}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted">
                <span>运镜：{sh.camera}</span>
                {sh.characterIds.length > 0 && <span>· 角色：{sh.characterIds.join('、')}</span>}
              </div>
              {sh.dialogue && (
                <div className="mt-1 rounded bg-[#F8F9FC] px-2 py-1 text-[10.5px] leading-[1.6] text-[#4A4F68]">
                  <b>{sh.dialogue.speakerName || sh.dialogue.speakerId}：</b>{sh.dialogue.text}
                  {sh.dialogue.emotion && <span className="text-muted">（{sh.dialogue.emotion}）</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

const PROFILE_FIELDS: { k: string; f: (p: CharacterProfile) => string }[] = [
  { k: '年龄', f: p => p.age },
  { k: '身份', f: p => p.role },
  { k: '性格', f: p => p.personality },
  { k: '背景', f: p => p.background },
  { k: '目标欲望', f: p => p.motivation },
  { k: '人物弧光', f: p => p.arc },
  { k: '角色关系', f: p => p.relationships },
  { k: '台词风格', f: p => p.voice },
]

function ProfilesView({ data }: { data: CharacterProfile[] }) {
  return (
    <div className="flex flex-col gap-3">
      {data.map(p => (
        <Section key={p.id} title={p.name} extra={<Tag tone="violet">{p.id}</Tag>}>
          <div className="rounded-lg border border-line">
            {PROFILE_FIELDS.map(f => <KV key={f.k} k={f.k} v={f.f(p) || '—'} />)}
          </div>
        </Section>
      ))}
    </div>
  )
}

function VisualStyleView({ data }: { data: VisualStyle }) {
  return (
    <Section title="视觉风格设定">
      <div className="rounded-lg border border-line">
        <KV k="形态" v={data.form} />
        <KV k="主画风" v={data.mainStyle} />
        {data.family && <KV k="家族" v={data.family} />}
        <KV k="世界观锚" v={data.l1World} />
        <KV k="风格锚词" v={data.l2Anchor} />
        <KV k="锚点词" v={data.anchorWords} />
        {data.auxiliaryStyle && <KV k="辅助画风" v={data.auxiliaryStyle} />}
        {data.feasibility && <KV k="可行度" v={data.feasibility} />}
      </div>
      <RecipeBox label="质感配方">{data.qualityRecipe}</RecipeBox>
    </Section>
  )
}

// shot 节点：媒体成片，JSON 为生成档案（路径 / seed / 档位 / 状态）
interface ShotMediaRecord {
  video?: string
  /** dev-mock 媒体通道：可直接加载的视频 URL（真实 Electron 侧将由 media:// 协议提供） */
  videoUrl?: string
  status?: string
  model?: string
  tier?: string
  seed?: number | string
  durationSec?: number
  note?: string
}

function ShotMediaView({ data, node }: { data: ShotMediaRecord; node: CanvasNode }) {
  // videoUrl 存在 → 本地播放（dev-mock 已映射真实 H3 演示片）；否则深色舞台占位。
  // 未接通道的真实落盘路径 data.video 不直接喂给 <video>，只在下方生成档案中呈现。
  const fileName = data.video ? data.video.split('/').pop() : ''
  const generating = node.status === 'active'
  const hint = generating ? '镜头生成中…' : data.video ? '正片已生成，媒体预览通道接入后可播放' : '正片文件未就绪'
  return (
    <div className="flex flex-col gap-3">
      <Section>
        <div className="grid min-h-[220px] place-items-center overflow-hidden rounded-[10px] bg-[#15161D]">
          {data.videoUrl && !generating ? (
            <video
              src={data.videoUrl}
              controls
              playsInline
              data-shot-video
              className="max-h-[420px] w-full bg-[#15161D] object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-9 w-9 text-white/30">
                <rect x="2" y="5" width="20" height="14" rx="2" /><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
              </svg>
              <span className="text-[11px] text-white/40">{hint}</span>
              {fileName && !generating && (
                <span className="max-w-full truncate font-mono text-[10.5px] text-white/25">{fileName}</span>
              )}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[13px] font-extrabold text-ink">{node.title}</span>
          {data.tier && <Tag tone="violet">{data.tier}</Tag>}
          {typeof data.durationSec === 'number' && <Tag tone="gray">{data.durationSec}″</Tag>}
        </div>
      </Section>
      <Section title="生成档案">
        <div className="rounded-lg border border-line">
          {data.model && <KV k="模型" v={data.model} />}
          {data.status && <KV k="状态" v={data.status} />}
          {data.seed !== undefined && <KV k="seed" v={String(data.seed)} />}
          {data.video && <KV k="文件" v={data.video} />}
        </div>
        {data.note && <RecipeBox>{data.note}</RecipeBox>}
      </Section>
    </div>
  )
}

// ── 未知 JSON 通用渲染 ──────────────────────────────────────

function JsonObjectView({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object') {
    return <p className="text-[11.5px] leading-[1.7] text-[#4A4F68]">{String(data)}</p>
  }
  if (Array.isArray(data)) {
    return (
      <div className="flex flex-col gap-2">
        {data.map((item, i) => (
          <div key={i} className="rounded-lg border border-line p-2.5 text-[11px]">
            <span className="mr-2 font-bold text-violet">#{i + 1}</span>
            {typeof item === 'object' && item !== null
              ? <JsonObjectInline data={item as Record<string, unknown>} />
              : String(item)}
          </div>
        ))}
      </div>
    )
  }
  return <JsonObjectInline data={data as Record<string, unknown>} boxed />
}

function JsonObjectInline({ data, boxed }: { data: Record<string, unknown>; boxed?: boolean }) {
  const entries = Object.entries(data)
  const inner = (
    <div className={boxed ? 'rounded-lg border border-line' : ''}>
      {entries.map(([k, v]) => (
        <KV
          key={k}
          k={k}
          v={v === null || v === undefined ? '—'
            : typeof v === 'object' ? <code className="text-[10.5px]">{JSON.stringify(v)}</code>
            : String(v)}
        />
      ))}
    </div>
  )
  return inner
}

// ── kind → 视图路由 ─────────────────────────────────────────

function StructuredBody({ kind, data, node, entryQuote = '' }: { kind: string; data: unknown; node: CanvasNode; entryQuote?: string }) {
  switch (kind) {
    case 'brief':
      return <BriefView data={data as ProjectBrief} entryQuote={entryQuote} />
    case 'outline':
      return <OutlineView data={data as StoryOutline} />
    case 'scenes':
      return <ScenesView data={data as Scene[]} />
    case 'dialogue':
      return <DialogueView data={data as Parameters<typeof DialogueView>[0]['data']} />
    case 'storyboard':
      return <StoryboardView data={data as Shot[]} />
    case 'profiles':
      return <ProfilesView data={data as CharacterProfile[]} />
    case 'visual-style':
      return <VisualStyleView data={data as VisualStyle} />
    case 'shot':
      return <ShotMediaView data={(data ?? {}) as ShotMediaRecord} node={node} />
    default:
      return (
        <Section title="结构化数据（通用视图）">
          <JsonObjectView data={data} />
        </Section>
      )
  }
}

// ── 外壳 ────────────────────────────────────────────────────

export default function StudioViewer({ node, kindLabel, onClose, entryQuote = '', onRequestAlign }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  // feature-004：立项单历史与回滚覆盖层开关（契约 §3.2，仅 brief 节点可见入口）
  const [historyOpen, setHistoryOpen] = useState(false)
  const refPath = node.ref?.path

  useEffect(() => {
    let alive = true
    if (!refPath) {
      setState({ phase: 'error', message: '该节点尚未落盘产物文件。' })
      return
    }
    setState({ phase: 'loading' })
    window.api.fileRead({ path: refPath })
      .then(res => {
        if (!alive) return
        if (!res.ok) {
          setState({ phase: 'error', message: res.error.message })
          return
        }
        setState({ phase: 'ok', content: res.content, format: res.format })
      })
      .catch(e => {
        if (alive) setState({ phase: 'error', message: e instanceof Error ? e.message : '读取失败' })
      })
    return () => { alive = false }
  }, [node.id, refPath])

  let parsed: unknown = null
  let parseOk = false
  if (state.phase === 'ok' && state.format === 'json') {
    try { parsed = JSON.parse(state.content); parseOk = true } catch { parseOk = false }
  }

  const version = typeof node.meta?.version === 'string' ? node.meta.version : null

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs font-medium text-violet">{kindLabel}</span>
          <span className="truncate text-sm font-medium text-ink">{node.title}</span>
          {version && <span className="shrink-0 rounded-full bg-violet-soft px-1.5 py-px text-[10px] font-bold text-violet">{version}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {node.kind === 'brief' && (
            <button
              type="button"
              data-testid="brief-history-entry"
              onClick={() => setHistoryOpen(true)}
              className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
            >
              查看历史
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
          >
            关闭
          </button>
        </div>
      </div>
      {refPath && (
        <div className="flex items-center gap-2 border-b border-line px-5 py-2">
          <span className="truncate text-[11px] text-muted" title={refPath}>{refPath}</span>
          {state.phase === 'ok' && (
            <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[10px] uppercase text-muted">
              {state.format}
            </span>
          )}
        </div>
      )}
      {/* feature-007：脏读黄条（§2.6.7 L359 简版，无 [查看影响评估] 钮；onRequestAlign 未传则无钮） */}
      {node.dirty && (
        <div className="flex items-center gap-2 border-b border-line bg-[#FFF4DE] px-5 py-2">
          <span className="min-w-0 flex-1 break-words text-[11px] font-semibold leading-5 text-[#C0841D]">
            当前基于 v{node.dirty.sinceBriefVersion} 立项，与最新 v{node.dirty.latestBriefVersion} 不一致：
            {node.dirty.fields.map(dirtyFieldLabel).join('、')}
          </span>
          {onRequestAlign && (
            <button
              type="button"
              onClick={onRequestAlign}
              className="shrink-0 rounded-lg border border-[#C0841D]/40 bg-white/70 px-2.5 py-0.5 text-[11px] font-bold text-[#C0841D] hover:bg-white"
            >
              一键对齐
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-canvas/40 p-4">
        {state.phase === 'loading' && <p className="text-sm text-muted">读取中…</p>}
        {state.phase === 'error' && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8 text-bad/60">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" />
            </svg>
            <p className="text-sm text-bad">{state.message}</p>
          </div>
        )}
        {state.phase === 'ok' && parseOk && <StructuredBody kind={node.kind} data={parsed} node={node} entryQuote={entryQuote} />}
        {state.phase === 'ok' && !parseOk && (
          <pre className="whitespace-pre-wrap break-all rounded-xl border border-line bg-white p-4 font-mono text-xs leading-5 text-ink">
            {state.content}
          </pre>
        )}
      </div>
      {historyOpen && node.kind === 'brief' && (
        <BriefHistoryView onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  )
}
