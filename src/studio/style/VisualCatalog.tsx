// feature-024 · 视觉风格谱系抽屉（原型 L720-750 .catalog-drawer / L1564-1595 / L2444-2465）
// 形态：右侧 430px 抽屉滑入，tabs（全部 + 五家族，计数自 style:catalog entries 实算），cat-item 缩略图卡
// feature-810：头部徽章 + 升级差异面板真实化（style:catalog / style:upgrade-diff）
// feature-811（B-41 收尾）：TABS 计数 / 18 条目卡片 / 弹层明细全量数据驱动——数据源 = style:catalog 实时谱系
// （renderer 单点缓存 ./style-catalog-store）；STYLES / FAMILIES / STYLE_CATALOG_VERSION / styleNameOf 硬编码三件套已退役
import { useEffect, useMemo, useRef, useState } from 'react'
import { ensureStyleCatalog, getStyleName, useStyleCatalog } from './style-catalog-store'

// 缩略图占位：每 family 独立渐变（图片缺失时兜底）
// B-35：导出供对话内风格选项卡缺图兜底复用（仅加 export，本体零改动）
export const FAMILY_GRAD: Record<string, string> = {
  A: 'linear-gradient(135deg,#3A3F57 0%,#1E2233 100%)',
  B: 'linear-gradient(135deg,#A8DFC6 0%,#3E9E86 100%)',
  C: 'linear-gradient(135deg,#FFC6A0 0%,#E8744F 100%)',
  D: 'linear-gradient(135deg,#A8C4FF 0%,#4A7DD8 100%)',
  E: 'linear-gradient(135deg,#B8AFFF 0%,#6C5CE7 100%)',
}

// 真实画风预览图：resources/H3-Style/_style_preview/<家族目录>/<ID>_<名称>.png（共 18 张）
// Vite glob：dev 直接服务源文件；build 时打包为带 hash 的静态资源（Electron 生产环境同源可加载）
// B-53：glob 相对当前文件（src/studio/style/），到项目根 resources 需 ../../../（原 ../../ 误指向 src/resources）
const PREVIEW_MODULES = import.meta.glob<string>(
  '../../../resources/H3-Style/_style_preview/**/*.png',
  { eager: true, query: '?url', import: 'default' },
)
// id（A1/A2/.../E1）→ 图片 URL
// B-35：导出供对话内风格选项卡缩略图复用（仅加 export，本体零改动）
export const PREVIEW_URL: Record<string, string> = {}
for (const [p, url] of Object.entries(PREVIEW_MODULES)) {
  const m = /([A-E]\d)_/.exec(p.replace(/\\/g, '/'))
  if (m) PREVIEW_URL[m[1]] = url
}

// 三档实测视频（仅 11 主画风有，共 33 个）：<ID>_<名称>_标准20步|turbo8步|FastH3.mp4
// 对齐原型 VID_FILES：std 成片基准 / turbo 打样最快 / fast 快速出片；备画风无视频
type VidTier = 'std' | 'turbo' | 'fast'
const VIDEO_MODULES = import.meta.glob<string>(
  '../../../resources/H3-Style/_style_preview/**/*.mp4',
  { eager: true, query: '?url', import: 'default' },
)
const VIDEO_URL: Record<string, Partial<Record<VidTier, string>>> = {}
{
  const tierOf = (name: string): VidTier | null => {
    if (name.includes('标准20步')) return 'std'
    if (name.includes('turbo8步')) return 'turbo'
    if (name.includes('FastH3')) return 'fast'
    return null
  }
  for (const [p, url] of Object.entries(VIDEO_MODULES)) {
    const norm = p.replace(/\\/g, '/')
    const idM = /([A-E]\d)_/.exec(norm)
    const tier = tierOf(norm)
    if (idM && tier) {
      ;(VIDEO_URL[idM[1]] ??= {})[tier] = url
    }
  }
}
const VID_TABS: { key: VidTier; label: string }[] = [
  { key: 'std', label: '▶ 标准 20 步（成片基准）' },
  { key: 'turbo', label: '▶ turbo 8 步（打样最快）' },
  { key: 'fast', label: '▶ FastH3 8 步（快速出片）' },
]

interface Props {
  open: boolean
  onClose: () => void
  /** 点击"采用为主风格"时回调（让上层弹 toast 反馈；不传则只关抽屉） */
  onAdopt?: (style: { id: string; name: string; family: string }) => void
}

const TABS: { key: 'all' | 'A' | 'B' | 'C' | 'D' | 'E'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'A', label: 'A 写实影像' },
  { key: 'B', label: 'B 青春治愈' },
  { key: 'C', label: 'C 动画插画' },
  { key: 'D', label: 'D 类型氛围' },
  { key: 'E', label: 'E 材质工艺' },
]

// feature-811：可行度浮标（谱系 feasibility 枚举 → 原型 ●高/●中/●低 文案）
const FEAT_LABEL: Record<StyleCatalogEntryDto['feasibility'], string> = {
  high: '●高',
  medium: '●中',
  low: '●低',
}

type PreviewMetadataProps = {
  styleId: string
  sourceLabel: string
} & (
  | { mediaKind: 'image' }
  | { mediaKind: 'video'; tier: VidTier }
)

function previewRequestKey(request: StylePreviewMetadataRequest): string {
  return request.mediaKind === 'image'
    ? `${request.styleId}:image`
    : `${request.styleId}:video:${request.tier}`
}

/** 图片 / 视频各自读取当前文件的内嵌 ComfyUI 信息；旧请求不得覆盖新档。 */
function PreviewMetadata(props: PreviewMetadataProps) {
  const { styleId, mediaKind, sourceLabel } = props
  const tier = props.mediaKind === 'video' ? props.tier : undefined
  const sequence = useRef(0)
  const [loading, setLoading] = useState(true)
  const [metadata, setMetadata] = useState<StylePreviewMetadataDto | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const request: StylePreviewMetadataRequest = mediaKind === 'image'
      ? { styleId, mediaKind }
      : { styleId, mediaKind, tier: tier as VidTier }
    const identity = previewRequestKey(request)
    const current = ++sequence.current
    let active = true
    setLoading(true)
    setMetadata(null)
    setCopied(null)

    const load = async () => {
      try {
        const result = await window.api.stylePreviewMetadata(request)
        if (!active || current !== sequence.current) return
        if (previewRequestKey(result.request) !== identity) return
        setMetadata(result)
        setLoading(false)
      } catch {
        if (!active || current !== sequence.current) return
        setMetadata({
          request,
          status: 'invalid',
          prompts: [],
          params: [],
          message: '媒体元数据读取失败',
        })
        setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [styleId, mediaKind, tier])

  const copyPrompt = async (key: string, text: string) => {
    if (!navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div
      className="border-t border-line bg-surface px-3 py-3"
      data-testid={`preview-metadata-${mediaKind}`}
      data-status={loading ? 'loading' : metadata?.status ?? 'invalid'}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-extrabold text-ink">媒体内嵌信息</h4>
        <span className="rounded bg-violet-soft px-1.5 py-0.5 text-[9px] font-bold text-[#6C5CE7]">ComfyUI</span>
      </div>
      <p className="mb-2 text-[9.5px] leading-[1.5] text-muted">{sourceLabel}</p>
      {loading ? (
        <p className="py-3 text-center text-[10.5px] text-muted">正在读取文件内嵌信息…</p>
      ) : metadata?.status === 'ok' ? (
        <>
          {metadata.prompts.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9.5px] font-extrabold tracking-[0.4px] text-muted">提示词</div>
              {metadata.prompts.map(prompt => (
                <div key={prompt.key} className="rounded-md border border-line bg-surface p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold text-ink">{prompt.label}</span>
                    <button
                      type="button"
                      onClick={() => { void copyPrompt(prompt.key, prompt.text) }}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-[#6C5CE7] hover:bg-violet-soft"
                      aria-label={`复制${prompt.label}`}
                    >{copied === prompt.key ? '✓ 已复制' : '复制'}</button>
                  </div>
                  <p
                    className="whitespace-pre-wrap break-words text-[10.5px] leading-[1.55] text-ink"
                    data-testid={`preview-prompt-${mediaKind}-${prompt.key}`}
                  >{prompt.text}</p>
                </div>
              ))}
            </div>
          )}
          {metadata.params.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[9.5px] font-extrabold tracking-[0.4px] text-muted">实际生成参数</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-line bg-surface p-2">
                {metadata.params.map(param => (
                  <div key={param.key} className="min-w-0 text-[10px] leading-[1.45]">
                    <dt className="inline text-muted">{param.label}：</dt>
                    <dd className="inline break-words font-bold text-ink">{param.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p className="mt-2 text-[9px] leading-[1.5] text-muted">仅展示文件实际记录；未列出的字段表示文件未记录。</p>
        </>
      ) : (
        <p className="rounded-md border border-warn/30 bg-warn/10 px-2 py-2 text-[10.5px] leading-[1.5] text-warn">
          {metadata?.message ?? '媒体元数据不可用'}
        </p>
      )}
    </div>
  )
}

export default function VisualCatalog({ open, onClose, onAdopt }: Props) {
  const [tab, setTab] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'E'>('all')
  const [diffOpen, setDiffOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [vidTier, setVidTier] = useState<VidTier>('std')
  // feature-811：谱系版本/条目同源——单点 store（徽章与卡片一次拉取；810 差异工作流直连保留）
  const catalog = useStyleCatalog()
  const [diff, setDiff] = useState<StyleUpgradeDiff | null>(null)
  const [adopting, setAdopting] = useState(false)
  const [adoptError, setAdoptError] = useState<string | null>(null)

  // 切换预览画风时重置档位
  useEffect(() => { setVidTier('std') }, [previewId])

  useEffect(() => {
    if (!open) {
      setPreviewId(null)
      return
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { previewId ? setPreviewId(null) : onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, previewId])

  // feature-810/811：抽屉打开时拉取升级差异 + force 刷新谱系快照（与 810 拉取时机统一；零新推送，契约 §2.4）
  useEffect(() => {
    if (!open) {
      setDiff(null)
      setDiffOpen(false)
      setAdoptError(null)
      return
    }
    ensureStyleCatalog(true)
    let alive = true
    window.api.styleUpgradeDiff()
      .then(d => { if (alive) setDiff(d) })
      .catch(() => { if (alive) setDiff(null) })
    return () => { alive = false }
  }, [open])

  // feature-810 V4：采纳 = 仅升版本号（契约 §2.3 前置校验：采纳时谱系未再升级才写）
  const adoptUpgrade = async () => {
    if (!diff?.hasUpgrade || diff.blocking || diff.noBrief || adopting) return
    setAdopting(true)
    setAdoptError(null)
    try {
      const cat = await window.api.styleCatalog()
      if (cat.version !== diff.currentVersion) {
        setAdoptError('谱系已再升级，请刷新差异')
        return
      }
      await window.api.updateBrief({ style: { catalogVersion: diff.currentVersion } })
      setDiff(await window.api.styleUpgradeDiff())
      setDiffOpen(false)
    } catch (e) {
      setAdoptError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdopting(false)
    }
  }

  const { entries } = catalog
  // TABS 计数实算（快照未到位/不可用 → 不显计数）
  const counts = useMemo(() => {
    if (catalog.status !== 'ok') return null
    const c: Record<string, number> = { all: entries.length, A: 0, B: 0, C: 0, D: 0, E: 0 }
    for (const e of entries) c[e.familyCode] += 1
    return c
  }, [catalog.status, entries])

  const visible = entries.filter(e => tab === 'all' || e.familyCode === tab)
  const previewItem = previewId ? entries.find(e => e.id === previewId) ?? null : null
  const previewImg = previewItem ? PREVIEW_URL[previewItem.id] : undefined
  const previewVids = previewItem ? VIDEO_URL[previewItem.id] : undefined
  // 缺档回退时，媒体 URL 与元数据请求必须共同使用实际档位。
  const activeVidTier: VidTier = previewVids?.[vidTier]
    ? vidTier
    : previewVids?.std
      ? 'std'
      : previewVids?.turbo
        ? 'turbo'
        : 'fast'
  const previewVidSrc = previewVids?.[activeVidTier]

  return (
    <>
      {/* 半透明遮罩（仅视觉强调，非点击关闭——按原型抽屉不靠遮罩关闭） */}
      {open && !previewItem && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(30,34,51,0.18)] transition-opacity"
          aria-hidden
        />
      )}
      {/* 抽屉（原型 .catalog-drawer：右 430px · 滑入） */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(430px,92%)] flex-col border-l border-line bg-surface shadow-[-14px_0_40px_rgba(40,42,80,0.16)] transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-[105%]'
        }`}
        data-catalog-drawer
        data-open={open}
        aria-label="视觉风格谱系"
      >
        {/* cat-head */}
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3.5">
          <span className="text-[15px]">🎨</span>
          <span className="flex-1 text-[14px] font-extrabold text-ink">视觉风格谱系</span>
          {/* feature-810 V1 / feature-811：徽章读单点 store（与条目同源；失败/不可用显「谱系不可用」降级态） */}
          <span data-testid="style-catalog-version" className="rounded-full border border-violet/30 bg-violet-soft px-2 py-0.5 text-[10.5px] font-extrabold text-[#5A4FD8]">
            {catalog.status === 'failed' || catalog.status === 'unavailable' ? '谱系不可用' : (catalog.version ?? '…')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-[26px] w-[26px] place-items-center rounded-full bg-canvas text-[14px] leading-none text-ink hover:bg-win"
            title="关闭（Esc）"
            data-catalog-close
          >×</button>
        </div>

        {/* cat-actions：feature-810 谱系升级差异工作流（真实数据：V2 四态入口 + V3 差异面板；旧演示硬编码已替换） */}
        <div className="border-b border-line px-3.5 pb-0 pt-2.5">
          {diff && (
            <button
              type="button"
              disabled={!diff.hasUpgrade}
              onClick={() => diff.hasUpgrade && setDiffOpen(v => !v)}
              className={`mb-2 w-full rounded-[9px] border px-2.5 py-1.5 text-left text-[11px] font-bold ${
                diff.hasUpgrade
                  ? 'border-warn/30 bg-warn/10 text-warn hover:bg-warn/20'
                  : 'cursor-default border-line bg-canvas text-muted'
              }`}
              data-testid="style-upgrade-entry"
            >
              {diff.hasUpgrade
                ? `🔔 谱系有升级（${diff.registeredVersion} → ${diff.currentVersion}），点击查看差异`
                : diff.noBrief
                  ? '谱系当前已是最新（立项后可采纳升级）'
                  : '谱系当前已是最新'}
            </button>
          )}
          {diffOpen && diff?.hasUpgrade && (
            <div
              className="mt-2 mb-2 rounded-[10px] border-[1.5px] border-warn/30 bg-warn/10 px-2.5 py-2 text-[11px] leading-[1.6] text-warn"
              data-testid="style-upgrade-panel"
            >
              <div className="mb-1 text-[11px] font-extrabold text-warn">
                谱系升级差异 · 版本 <span data-testid="style-upgrade-versions">{diff.registeredVersion} → {diff.currentVersion}</span>（人决定是否采纳）
              </div>
              <div className="mb-1 text-[10px] text-warn">差异 = 引用条目现况 + 谱系变更记录，非逐字段 diff</div>
              {diff.blocking && (
                <div className="mb-1 rounded-md bg-bad/10 px-2 py-1 text-[10.5px] font-bold text-bad">
                  ⚠ 引用风格已被谱系移除，请先在立项中重选风格后再采纳
                </div>
              )}
              {diff.referenced.map(r => (
                <div key={r.id} className="py-0.5" data-testid="style-upgrade-ref" data-style-id={r.id}>
                  {r.role === 'main' ? '主风格' : '辅助风格'} {r.id}{getStyleName(r.id) ? ` ${getStyleName(r.id)}` : ''}：
                  {r.removed || !r.current ? (
                    <b className="text-bad">已移除</b>
                  ) : (
                    <>
                      {r.current.role === 'main' ? '主' : '备'}
                      {r.current.auxiliaryCandidate ? ' · 可作辅助' : ''}
                      {' · 可行度'}{r.current.feasibility === 'high' ? '高' : r.current.feasibility === 'medium' ? '中' : '低'}
                      {r.current.anchorWords.length > 0 && (
                        <span className="block text-[10px] text-warn">锚点词现况：{r.current.anchorWords.join('、')}</span>
                      )}
                    </>
                  )}
                </div>
              ))}
              {diff.changelogUnavailable ? (
                <div className="py-0.5 text-[10.5px] text-warn" data-testid="style-upgrade-changelog-empty">
                  谱系未提供变更明细
                </div>
              ) : (
                <div className="py-0.5" data-testid="style-upgrade-changelog">
                  {diff.changelog.map(entry => (
                    <div key={entry.version} className="py-0.5">
                      <div className="font-extrabold">{entry.version}{entry.date ? `（${entry.date}）` : ''}</div>
                      {entry.items.map((item, i) => (
                        <div key={i} className="pl-3">· {item}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {adoptError && (
                <div className="mt-1 rounded-md bg-bad/10 px-2 py-1 text-[10.5px] font-bold text-bad">{adoptError}</div>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  disabled={diff.blocking || !!diff.noBrief || adopting}
                  onClick={adoptUpgrade}
                  title={diff.blocking ? '引用风格已被谱系移除，请先重选风格' : diff.noBrief ? '立项后可采纳' : undefined}
                  className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold text-white ${
                    diff.blocking || diff.noBrief || adopting ? 'cursor-not-allowed bg-muted' : 'bg-ok hover:opacity-90'
                  }`}
                  data-testid="style-upgrade-adopt"
                >{adopting ? '采纳中…' : `采纳（项目引用升 ${diff.currentVersion}）`}</button>
                <button
                  type="button"
                  onClick={() => setDiffOpen(false)}
                  className="rounded-md bg-canvas px-2.5 py-1 text-[10.5px] font-bold text-muted hover:bg-win"
                  data-testid="style-upgrade-ignore"
                >忽略（保持 {diff.registeredVersion}）</button>
              </div>
            </div>
          )}
        </div>

        {/* cat-tabs */}
        <div className="flex flex-wrap gap-1 px-3.5 pt-2.5">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                tab === t.key
                  ? 'border-violet bg-violet text-white'
                  : 'border-line bg-canvas text-muted hover:text-violet'
              }`}
              data-cat-tab={t.key}
            >
              {t.label}{counts ? ` ${counts[t.key]}` : ''}
            </button>
          ))}
        </div>

        {/* cat-body：2 列 cat-grid，每张卡 3:4 缩略图 + 名称 + chip + 可行度 + 采用按钮（feature-811：entries 数据驱动） */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3 pt-2.5">
          {catalog.status !== 'ok' ? (
            <div className="px-2 py-8 text-center text-[11px] text-muted" data-catalog-empty>
              {catalog.status === 'loading' || catalog.status === 'idle' ? '谱系加载中…' : '谱系不可用'}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-2">
            {visible.map(s => (
              <div
                key={s.id}
                className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface transition hover:border-violet hover:shadow-[0_4px_12px_rgba(108,92,231,0.12)]"
                data-cat-item={s.id}
              >
                {/* 3:4 缩略图（真实预览 PNG，缺失时 family 渐变兜底） */}
                <div
                  className="relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden"
                  style={PREVIEW_URL[s.id] ? undefined : { background: FAMILY_GRAD[s.familyCode] }}
                  onClick={() => setPreviewId(s.id)}
                  title="点击查看预览"
                >
                  {PREVIEW_URL[s.id] ? (
                    <img
                      src={PREVIEW_URL[s.id]}
                      alt={`${s.id} ${s.name}`}
                      loading="lazy"
                      draggable={false}
                      data-cat-thumb={s.id}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[26px] font-extrabold text-white/80">
                      {s.id}
                    </span>
                  )}
                  {/* 可行度浮标 */}
                  <span className="absolute right-1 top-1 rounded bg-black/35 px-1.5 py-px text-[9.5px] font-extrabold text-white">{FEAT_LABEL[s.feasibility]}</span>
                </div>
                <div className="px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1 text-[10.5px] font-extrabold text-ink">
                    <span className="min-w-0 truncate">{s.name}</span>
                    <span className={`shrink-0 rounded px-1 py-px text-[8.5px] font-extrabold ${
                      s.role === 'main' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'
                    }`}>{s.role === 'main' ? '主·已验证' : '备·风险自担'}</span>
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted">{s.id} · {s.familyLabel}</div>
                  <button
                    type="button"
                    onClick={() => {
                      onAdopt?.({ id: s.id, name: s.name, family: s.familyLabel })
                      onClose()
                    }}
                    className="mt-1.5 w-full rounded-md border border-violet/30 bg-violet-soft px-1 py-1 text-[10px] font-bold text-[#5A4FD8] transition hover:bg-violet hover:text-white"
                    data-cat-adopt={s.id}
                  >采用为主风格</button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* cat-foot */}
        <div className="border-t border-line bg-surface px-4 py-2.5 text-[10px] leading-[1.6] text-muted">
          数据源：<b className="text-muted">md 唯一源</b>（AI 通道读结构化）/ <b className="text-muted">html 派生镜像</b>（人读预览墙）· 平台只消费不私改 · 改源走对话（AI 改 md → 同步 html → 升版 → 提示差异）
        </div>
      </aside>

      {/* feature-815：图片与当前档视频同屏；两类媒体分别展示自身内嵌提示词与参数。 */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(30,34,51,0.5)] p-6 backdrop-blur-[3px]"
          onClick={() => setPreviewId(null)}
          data-catalog-preview
        >
          <div
            className="relative flex max-h-[90vh] w-[min(1180px,100%)] flex-col overflow-hidden rounded-[14px] bg-surface shadow-[0_20px_50px_rgba(40,42,80,0.25)]"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${previewItem.name} 风格预览`}
          >
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-canvas text-[16px] leading-none text-ink hover:bg-win"
              title="关闭（Esc）"
              data-preview-close
            >×</button>
            <div className="border-b border-line px-5 pb-4 pr-12 pt-5">
              <div className="flex flex-wrap items-center gap-1.5 text-[16px] font-extrabold text-ink">
                {previewItem.name}
                <span className={`rounded px-1.5 py-px text-[10px] ${
                  previewItem.role === 'main' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'
                }`}>{previewItem.role === 'main' ? '主·已验证' : '备·风险自担'}</span>
                <span className="rounded bg-ok/10 px-1.5 py-px text-[10px] font-extrabold text-ok">可行度 {FEAT_LABEL[previewItem.feasibility]}</span>
              </div>
              <div className="mt-1 text-[10.5px] text-muted">{previewItem.id} · {previewItem.familyLabel}</div>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <section className="overflow-hidden rounded-[10px] border border-line bg-surface" aria-label="参考图片与生成信息">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                    <h3 className="text-[12px] font-extrabold text-ink">参考图片</h3>
                    <span className="text-[9.5px] font-bold text-muted">PNG · 固定参考</span>
                  </div>
                  {previewImg ? (
                    <div className="grid h-[280px] place-items-center overflow-hidden bg-[#15161D]">
                      <img
                        src={previewImg}
                        alt={`${previewItem.id} ${previewItem.name} 参考图片`}
                        draggable={false}
                        data-preview-img={previewItem.id}
                        className="h-full min-h-0 w-full min-w-0 object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="grid h-[280px] place-items-center"
                      style={{ background: FAMILY_GRAD[previewItem.familyCode] }}
                      data-preview-img-missing
                    >
                      <span className="text-[44px] font-extrabold text-white/80">{previewItem.id}</span>
                    </div>
                  )}
                  <PreviewMetadata
                    styleId={previewItem.id}
                    mediaKind="image"
                    sourceLabel="来源：当前 PNG 内嵌 ComfyUI 元数据"
                  />
                </section>

                <section className="overflow-hidden rounded-[10px] border border-line bg-surface" aria-label="当前档视频与生成信息">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                    <h3 className="text-[12px] font-extrabold text-ink">当前档视频</h3>
                    <span className="text-[9.5px] font-bold text-muted">MP4 · 三档仅切换视频</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 border-b border-line bg-surface px-3 py-2" data-preview-vids={previewItem.id}>
                    {VID_TABS.map(t => {
                      const url = previewVids?.[t.key]
                      const on = url && activeVidTier === t.key
                      return (
                        <button
                          key={t.key}
                          type="button"
                          disabled={!url}
                          onClick={() => url && setVidTier(t.key)}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                            on
                              ? 'border-violet bg-violet text-white'
                              : url
                                ? 'border-violet/30 bg-violet-soft text-[#5A4FD8] hover:bg-violet hover:text-white'
                                : 'cursor-not-allowed border-line bg-canvas text-muted'
                          }`}
                          data-vid={t.key}
                        >{t.label}</button>
                      )
                    })}
                  </div>
                  {previewVidSrc ? (
                    <div className="grid h-[280px] place-items-center overflow-hidden bg-[#15161D]">
                      <video
                        key={previewVidSrc}
                        src={previewVidSrc}
                        poster={previewImg}
                        controls
                        muted
                        playsInline
                        autoPlay
                        data-preview-vid={previewItem.id}
                        aria-label={`${previewItem.name} ${activeVidTier} 档视频`}
                        className="h-full min-h-0 w-full min-w-0 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="grid h-[280px] place-items-center bg-[#15161D] px-4 text-center text-[11px] text-white/70">
                      当前风格无实测视频文件
                    </div>
                  )}
                  {!previewVidSrc && (
                    <div className="border-t border-warn/30 bg-warn/10 px-3 py-2 text-[10px] leading-[1.5] text-warn" data-preview-vid-hint>
                      ⚠ 备画风未入预览墙或视频缺失，仅参考图 · 选作主风格风险自担
                    </div>
                  )}
                  <PreviewMetadata
                    styleId={previewItem.id}
                    mediaKind="video"
                    tier={activeVidTier}
                    sourceLabel="来源：当前档位 MP4 内嵌 ComfyUI 元数据"
                  />
                </section>
              </div>

              <section className="mt-5 rounded-[10px] border border-line bg-surface p-4" aria-label="谱系信息">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="text-[12px] font-extrabold text-ink">谱系信息</h3>
                  <span className="rounded bg-canvas px-1.5 py-0.5 text-[9px] text-muted">独立来源 · 非媒体生成参数</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-muted">视觉特征</div>
                    <div className="rounded-md border border-line bg-surface p-2 text-[10.5px] leading-[1.5] text-ink">{previewItem.visualTraits}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-muted">锚点词示例</div>
                    <div className="rounded-md border border-line bg-surface p-2 text-[10.5px] leading-[1.5] text-ink">{previewItem.anchorWords}</div>
                  </div>
                  {previewItem.textureRecipe && (
                    <div>
                      <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-muted">质感配方</div>
                      <div className="rounded-md border border-line bg-surface p-2 text-[10.5px] leading-[1.5] text-ink">{previewItem.textureRecipe}</div>
                    </div>
                  )}
                </div>
              </section>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onAdopt?.({ id: previewItem.id, name: previewItem.name, family: previewItem.familyLabel })
                    setPreviewId(null)
                    onClose()
                  }}
                  className="flex-1 rounded-md border border-violet/30 bg-violet py-2 text-[12px] font-extrabold text-white transition hover:bg-[#5A4FD8]"
                  data-preview-adopt={previewItem.id}
                >采用为主风格</button>
                <button
                  type="button"
                  onClick={() => setPreviewId(null)}
                  className="rounded-md border border-line bg-surface px-4 py-2 text-[12px] font-bold text-muted hover:bg-canvas"
                >返回目录</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
