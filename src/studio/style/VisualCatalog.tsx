// feature-024 · 视觉风格谱系抽屉（原型 L720-750 .catalog-drawer / L1564-1595 / L2444-2465）
// 形态：右侧 430px 抽屉滑入，tabs（全部 + 五家族，计数自 style:catalog entries 实算），cat-item 缩略图卡
// feature-810：头部徽章 + 升级差异面板真实化（style:catalog / style:upgrade-diff）
// feature-811（B-41 收尾）：TABS 计数 / 18 条目卡片 / 弹层明细全量数据驱动——数据源 = style:catalog 实时谱系
// （renderer 单点缓存 ./style-catalog-store）；STYLES / FAMILIES / STYLE_CATALOG_VERSION / styleNameOf 硬编码三件套已退役
import { useEffect, useMemo, useState } from 'react'
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
const PREVIEW_MODULES = import.meta.glob<string>(
  '../../resources/H3-Style/_style_preview/**/*.png',
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
  '../../resources/H3-Style/_style_preview/**/*.mp4',
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
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(430px,92%)] flex-col border-l border-line bg-[#FCFCFE] shadow-[-14px_0_40px_rgba(40,42,80,0.16)] transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-[105%]'
        }`}
        data-catalog-drawer
        data-open={open}
        aria-label="视觉风格谱系"
      >
        {/* cat-head */}
        <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-3.5">
          <span className="text-[15px]">🎨</span>
          <span className="flex-1 text-[14px] font-extrabold text-ink">视觉风格谱系</span>
          {/* feature-810 V1 / feature-811：徽章读单点 store（与条目同源；失败/不可用显「谱系不可用」降级态） */}
          <span data-testid="style-catalog-version" className="rounded-full border border-[#DED9FB] bg-violet-soft px-2 py-0.5 text-[10.5px] font-extrabold text-[#5A4FD8]">
            {catalog.status === 'failed' || catalog.status === 'unavailable' ? '谱系不可用' : (catalog.version ?? '…')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[#F1F2F8] text-[14px] leading-none text-[#555B74] hover:bg-[#E5E7F2]"
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
                  ? 'border-[#F5E0B8] bg-[#FFF7E8] text-[#B26A00] hover:bg-[#FFF0D4]'
                  : 'cursor-default border-[#E6E8F1] bg-[#F7F8FB] text-[#9AA0B5]'
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
              className="mt-2 mb-2 rounded-[10px] border-[1.5px] border-[#F5E0B8] bg-[#FFFDF5] px-2.5 py-2 text-[11px] leading-[1.6] text-[#7A5C1D]"
              data-testid="style-upgrade-panel"
            >
              <div className="mb-1 text-[11px] font-extrabold text-[#B26A00]">
                谱系升级差异 · 版本 <span data-testid="style-upgrade-versions">{diff.registeredVersion} → {diff.currentVersion}</span>（人决定是否采纳）
              </div>
              <div className="mb-1 text-[10px] text-[#A6873B]">差异 = 引用条目现况 + 谱系变更记录，非逐字段 diff</div>
              {diff.blocking && (
                <div className="mb-1 rounded-md bg-[#FDECEC] px-2 py-1 text-[10.5px] font-bold text-[#C0392B]">
                  ⚠ 引用风格已被谱系移除，请先在立项中重选风格后再采纳
                </div>
              )}
              {diff.referenced.map(r => (
                <div key={r.id} className="py-0.5" data-testid="style-upgrade-ref" data-style-id={r.id}>
                  {r.role === 'main' ? '主风格' : '辅助风格'} {r.id}{getStyleName(r.id) ? ` ${getStyleName(r.id)}` : ''}：
                  {r.removed || !r.current ? (
                    <b className="text-[#C0392B]">已移除</b>
                  ) : (
                    <>
                      {r.current.role === 'main' ? '主' : '备'}
                      {r.current.auxiliaryCandidate ? ' · 可作辅助' : ''}
                      {' · 可行度'}{r.current.feasibility === 'high' ? '高' : r.current.feasibility === 'medium' ? '中' : '低'}
                      {r.current.anchorWords.length > 0 && (
                        <span className="block text-[10px] text-[#A6873B]">锚点词现况：{r.current.anchorWords.join('、')}</span>
                      )}
                    </>
                  )}
                </div>
              ))}
              {diff.changelogUnavailable ? (
                <div className="py-0.5 text-[10.5px] text-[#A6873B]" data-testid="style-upgrade-changelog-empty">
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
                <div className="mt-1 rounded-md bg-[#FDECEC] px-2 py-1 text-[10.5px] font-bold text-[#C0392B]">{adoptError}</div>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  disabled={diff.blocking || !!diff.noBrief || adopting}
                  onClick={adoptUpgrade}
                  title={diff.blocking ? '引用风格已被谱系移除，请先重选风格' : diff.noBrief ? '立项后可采纳' : undefined}
                  className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold text-white ${
                    diff.blocking || diff.noBrief || adopting ? 'cursor-not-allowed bg-[#C9CEDD]' : 'bg-ok hover:opacity-90'
                  }`}
                  data-testid="style-upgrade-adopt"
                >{adopting ? '采纳中…' : `采纳（项目引用升 ${diff.currentVersion}）`}</button>
                <button
                  type="button"
                  onClick={() => setDiffOpen(false)}
                  className="rounded-md bg-[#F1F2F8] px-2.5 py-1 text-[10.5px] font-bold text-[#7A8098] hover:bg-[#E5E7F2]"
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
                  : 'border-[#E6E8F1] bg-[#F3F4F9] text-[#7A8098] hover:text-violet'
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
            <div className="px-2 py-8 text-center text-[11px] text-[#9AA0B5]" data-catalog-empty>
              {catalog.status === 'loading' || catalog.status === 'idle' ? '谱系加载中…' : '谱系不可用'}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-2">
            {visible.map(s => (
              <div
                key={s.id}
                className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-white transition hover:border-violet hover:shadow-[0_4px_12px_rgba(108,92,231,0.12)]"
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
                      s.role === 'main' ? 'bg-[#E7F8F0] text-[#1E9E66]' : 'bg-[#FFF4DE] text-[#C0841D]'
                    }`}>{s.role === 'main' ? '主·已验证' : '备·风险自担'}</span>
                  </div>
                  <div className="mt-0.5 text-[9px] text-[#A6ABC0]">{s.id} · {s.familyLabel}</div>
                  <button
                    type="button"
                    onClick={() => {
                      onAdopt?.({ id: s.id, name: s.name, family: s.familyLabel })
                      onClose()
                    }}
                    className="mt-1.5 w-full rounded-md border border-[#DED9FB] bg-violet-soft px-1 py-1 text-[10px] font-bold text-[#5A4FD8] transition hover:bg-violet hover:text-white"
                    data-cat-adopt={s.id}
                  >采用为主风格</button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* cat-foot */}
        <div className="border-t border-line bg-white px-4 py-2.5 text-[10px] leading-[1.6] text-[#9AA0B5]">
          数据源：<b className="text-[#7A8098]">md 唯一源</b>（AI 通道读结构化）/ <b className="text-[#7A8098]">html 派生镜像</b>（人读预览墙）· 平台只消费不私改 · 改源走对话（AI 改 md → 同步 html → 升版 → 提示差异）
        </div>
      </aside>

      {/* 风格预览弹层（原型 .preview-overlay / L1597-1615） */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(30,34,51,0.5)] backdrop-blur-[3px]"
          onClick={() => setPreviewId(null)}
          data-catalog-preview
        >
          <div
            className="relative flex w-[min(560px,90%)] max-h-[88%] flex-col gap-3 overflow-auto rounded-[14px] bg-white p-4 shadow-[0_20px_50px_rgba(40,42,80,0.25)]"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-[#F1F2F8] text-[16px] leading-none text-[#555B74] hover:bg-[#E5E7F2]"
              title="关闭（Esc）"
              data-preview-close
            >×</button>
            {/* 预览舞台（对齐原型：视频优先 · 主画风三档实测；备画风仅图） */}
            {(() => {
              const vids = VIDEO_URL[previewItem.id]
              const hasVid = vids && (vids.std || vids.turbo || vids.fast)
              const img = PREVIEW_URL[previewItem.id]
              if (hasVid) {
                const src = vids![vidTier] ?? vids!.std ?? Object.values(vids!)[0]
                return (
                  <div className="overflow-hidden rounded-[10px] bg-[#15161D]">
                    <video
                      key={src}
                      src={src}
                      poster={img}
                      controls
                      muted
                      playsInline
                      autoPlay
                      data-preview-vid={previewItem.id}
                      className="mx-auto block max-h-[380px] w-auto max-w-full bg-[#15161D] object-contain"
                    />
                  </div>
                )
              }
              if (img) {
                return (
                  <img
                    src={img}
                    alt={`${previewItem.id} ${previewItem.name}`}
                    draggable={false}
                    data-preview-img={previewItem.id}
                    className="mx-auto block max-h-[380px] w-auto max-w-full rounded-[10px] bg-[#15161D] object-contain"
                  />
                )
              }
              return (
                <div
                  className="grid min-h-[200px] place-items-center overflow-hidden rounded-[10px]"
                  style={{ background: `${FAMILY_GRAD[previewItem.familyCode]} padding-box, #15161D` }}
                >
                  <span className="text-[44px] font-extrabold text-white/80">{previewItem.id}</span>
                </div>
              )
            })()}
            <div className="flex flex-wrap items-center gap-1.5 text-[14px] font-extrabold text-ink">
              {previewItem.name}
              <span className={`rounded px-1.5 py-px text-[10px] ${
                previewItem.role === 'main' ? 'bg-[#E7F8F0] text-[#1E9E66]' : 'bg-[#FFF4DE] text-[#C0841D]'
              }`}>{previewItem.role === 'main' ? '主·已验证' : '备·风险自担'}</span>
              <span className="rounded bg-[#E7F8F0] px-1.5 py-px text-[10px] font-extrabold text-[#1E9E66]">可行度 {FEAT_LABEL[previewItem.feasibility]}</span>
            </div>
            <div className="text-[10.5px] text-[#A6ABC0]">{previewItem.id} · {previewItem.familyLabel}</div>
            <div>
              <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">锚点词示例</div>
              <div className="rounded-md border border-line bg-[#F8F9FC] p-2 text-[10.5px] leading-[1.5] text-[#4A4F68]">
                {previewItem.anchorWords}
              </div>
            </div>
            {/* feature-811：质感配方 = 谱系 J.2 textureRecipe 原文（空串 → 该块不显） */}
            {previewItem.textureRecipe && (
              <div>
                <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">质感配方</div>
                <div className="rounded-md border border-line bg-[#F8F9FC] p-2 text-[10.5px] leading-[1.5] text-[#4A4F68]">
                  {previewItem.textureRecipe}
                </div>
              </div>
            )}
            {/* 三档实测视频（仅主画风）；备画风禁用并提示 */}
            <div className="flex flex-wrap gap-1.5" data-preview-vids={previewItem.id}>
              {VID_TABS.map(t => {
                const url = VIDEO_URL[previewItem.id]?.[t.key]
                const on = url && vidTier === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    disabled={!url}
                    onClick={() => url && setVidTier(t.key)}
                    className={`rounded-lg border px-2 py-1 text-[10.5px] font-bold transition ${
                      on
                        ? 'border-violet bg-violet text-white'
                        : url
                          ? 'border-[#DED9FB] bg-violet-soft text-[#5A4FD8] hover:bg-violet hover:text-white'
                          : 'cursor-not-allowed border-[#E6E8F1] bg-[#F1F2F8] text-[#9AA0B5]'
                    }`}
                    data-vid={t.key}
                  >{t.label}</button>
                )
              })}
              {!VIDEO_URL[previewItem.id] && (
                <div className="w-full text-[10px] text-[#C0841D]" data-preview-vid-hint>
                  ⚠ 备画风未入预览墙（无实测视频），仅参考图 · 选作主风格风险自担
                </div>
              )}
            </div>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onAdopt?.({ id: previewItem.id, name: previewItem.name, family: previewItem.familyLabel })
                  setPreviewId(null)
                  onClose()
                }}
                className="flex-1 rounded-md border border-[#DED9FB] bg-violet py-1.5 text-[12px] font-extrabold text-white transition hover:bg-[#5A4FD8]"
                data-preview-adopt={previewItem.id}
              >采用为主风格</button>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-[#7A8098] hover:bg-[#F1F2F8]"
              >返回目录</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
