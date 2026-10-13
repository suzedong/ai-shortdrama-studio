// feature-024 · 视觉风格谱系抽屉（原型 L720-750 .catalog-drawer / L1564-1595 / L2444-2465）
// 形态：右侧 430px 抽屉滑入，5 tabs（全部 18 / A 6 / B 1 / C 5 / D 5），cat-item 缩略图卡
// 升级差异面板（v1.46 → v1.47 演示）默认折叠
// 数据源自 resources/H3-Style/AI短剧制作视觉风格谱系.md v1.46
import { useEffect, useState } from 'react'

interface StyleEntry {
  id: string
  fam: 'A' | 'B' | 'C' | 'D' | 'E'
  name: string
  st: '主' | '备'
  feat: '●高' | '●中' | '●低'
  /** 缩略图占位：family 决定基础渐变色调 */
  family: string
  anchor: string
}

const FAMILIES: Record<string, string> = {
  A: '写实影像·仿真人',
  B: '青春治愈·跨形态氛围',
  C: '动画插画·2D 漫',
  D: '类型氛围·跨形态氛围',
  E: '材质工艺·3D 漫',
}

const STYLES: StyleEntry[] = [
  // A · 写实影像系 6（3 主 3 备）
  { id: 'A1', fam: 'A', name: '数字电影写实',         st: '主', feat: '●高', family: FAMILIES.A, anchor: 'cinematic still, anamorphic' },
  { id: 'A2', fam: 'A', name: '胶片电影感',           st: '主', feat: '●高', family: FAMILIES.A, anchor: 'Kodak Gold, film grain' },
  { id: 'A7', fam: 'A', name: '拟真人·仿真人动漫',     st: '主', feat: '●高', family: FAMILIES.A, anchor: 'realistic human-like anime' },
  { id: 'A3', fam: 'A', name: '年代胶片（千禧·90s·80s）', st: '备', feat: '●高', family: FAMILIES.A, anchor: '2000s film still, faded' },
  { id: 'A4', fam: 'A', name: 'DV·CCD 数码复古',      st: '备', feat: '●高', family: FAMILIES.A, anchor: 'old DV camcorder, CCD' },
  { id: 'A5', fam: 'A', name: '黑白电影',             st: '备', feat: '●高', family: FAMILIES.A, anchor: 'black and white, film noir' },
  // B · 青春治愈系 1
  { id: 'B1', fam: 'B', name: '清新生活流', st: '主', feat: '●高', family: FAMILIES.B, anchor: 'bright, low saturation, airy' },
  // C · 动画插画系 5（3 主 2 备）
  { id: 'C1', fam: 'C', name: '日式动漫',         st: '主', feat: '●高', family: FAMILIES.C, anchor: 'anime, cel shading' },
  { id: 'C2', fam: 'C', name: '国漫·新中式插画', st: '主', feat: '●高', family: FAMILIES.C, anchor: 'Chinese animation, ink-wash' },
  { id: 'C7', fam: 'C', name: '韩漫·精致美型',   st: '主', feat: '●高', family: FAMILIES.C, anchor: 'Korean manhwa, webtoon' },
  { id: 'C5', fam: 'C', name: '美式卡通',         st: '备', feat: '●高', family: FAMILIES.C, anchor: 'American cartoon, bold line' },
  { id: 'C6', fam: 'C', name: '扁平矢量·低多边形', st: '备', feat: '●高', family: FAMILIES.C, anchor: 'flat vector, geometric' },
  // D · 类型氛围系 5（3 主 2 备）
  { id: 'D1', fam: 'D', name: '冷调悬疑',  st: '主', feat: '●高', family: FAMILIES.D, anchor: 'cold blue tone, thriller' },
  { id: 'D2', fam: 'D', name: '赛博·科幻', st: '主', feat: '●高', family: FAMILIES.D, anchor: 'cyberpunk, neon' },
  { id: 'D5', fam: 'D', name: '神话国风',  st: '主', feat: '●高', family: FAMILIES.D, anchor: 'Chinese mythology, oriental' },
  { id: 'D3', fam: 'D', name: '奇幻童话',  st: '备', feat: '●高', family: FAMILIES.D, anchor: 'fantasy, fairytale' },
  { id: 'D4', fam: 'D', name: '暗黑·哥特', st: '备', feat: '●高', family: FAMILIES.D, anchor: 'gothic, dark chiaroscuro' },
  // E · 材质工艺系 1
  { id: 'E1', fam: 'E', name: '3D CG', st: '主', feat: '●中', family: FAMILIES.E, anchor: '3D render, Pixar style' },
]

// 缩略图占位：每 family 独立渐变（图片缺失时兜底）
const FAMILY_GRAD: Record<string, string> = {
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
const PREVIEW_URL: Record<string, string> = {}
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

const TABS: { key: 'all' | 'A' | 'B' | 'C' | 'D' | 'E'; label: string; count: number }[] = [
  { key: 'all', label: '全部', count: 18 },
  { key: 'A', label: 'A 写实影像', count: 6 },
  { key: 'B', label: 'B 青春治愈', count: 1 },
  { key: 'C', label: 'C 动画插画', count: 5 },
  { key: 'D', label: 'D 类型氛围', count: 5 },
  { key: 'E', label: 'E 材质工艺', count: 1 },
]

export default function VisualCatalog({ open, onClose, onAdopt }: Props) {
  const [tab, setTab] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'E'>('all')
  const [diffOpen, setDiffOpen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [vidTier, setVidTier] = useState<VidTier>('std')

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

  const visible = STYLES.filter(s => tab === 'all' || s.fam === tab)
  const previewItem = previewId ? STYLES.find(s => s.id === previewId) ?? null : null

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
          <span className="rounded-full border border-[#DED9FB] bg-violet-soft px-2 py-0.5 text-[10.5px] font-extrabold text-[#5A4FD8]">v1.46 · 2026-10-08</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[#F1F2F8] text-[14px] leading-none text-[#555B74] hover:bg-[#E5E7F2]"
            title="关闭（Esc）"
            data-catalog-close
          >×</button>
        </div>

        {/* cat-actions：升级差异演示按钮（折叠面板） */}
        <div className="border-b border-line px-3.5 pb-0 pt-2.5">
          <button
            type="button"
            onClick={() => setDiffOpen(v => !v)}
            className="mb-2 w-full rounded-[9px] border border-[#F5E0B8] bg-[#FFF7E8] px-2.5 py-1.5 text-left text-[11px] font-bold text-[#B26A00] hover:bg-[#FFF0D4]"
            data-catalog-upg
          >
            🔔 查看谱系升级差异（v1.46 → v1.47 演示）
          </button>
          {diffOpen && (
            <div className="mt-2 mb-2 rounded-[10px] border-[1.5px] border-[#F5E0B8] bg-[#FFFDF5] px-2.5 py-2 text-[11px] leading-[1.6] text-[#7A5C1D]">
              <div className="mb-1 text-[11px] font-extrabold text-[#B26A00]">谱系 v1.47 · 升级差异（人决定是否采纳）</div>
              <div className="py-0.5">① A7 拟真人·仿真人动漫：<b>备 → 主</b>（已由新项目验证）</div>
              <div className="py-0.5">② C6 扁平矢量·低多边形：锚点词新增「几何」变体</div>
              <div className="py-0.5">③ 版本：v1.46 → v1.47（2026-10-11）</div>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setDiffOpen(false) }}
                  className="rounded-md bg-ok px-2.5 py-1 text-[10.5px] font-bold text-white hover:opacity-90"
                  data-catalog-adopt
                >采纳（项目引用升 v1.47）</button>
                <button
                  type="button"
                  onClick={() => { setDiffOpen(false) }}
                  className="rounded-md bg-[#F1F2F8] px-2.5 py-1 text-[10.5px] font-bold text-[#7A8098] hover:bg-[#E5E7F2]"
                  data-catalog-ignore
                >忽略（保持 v1.46）</button>
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
              {t.label} {t.count}
            </button>
          ))}
        </div>

        {/* cat-body：2 列 cat-grid，每张卡 3:4 缩略图 + 名称 + chip + 可行度 + 采用按钮 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3 pt-2.5">
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
                  style={PREVIEW_URL[s.id] ? undefined : { background: FAMILY_GRAD[s.fam] }}
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
                  <span className="absolute right-1 top-1 rounded bg-black/35 px-1.5 py-px text-[9.5px] font-extrabold text-white">{s.feat}</span>
                </div>
                <div className="px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1 text-[10.5px] font-extrabold text-ink">
                    <span className="min-w-0 truncate">{s.name}</span>
                    <span className={`shrink-0 rounded px-1 py-px text-[8.5px] font-extrabold ${
                      s.st === '主' ? 'bg-[#E7F8F0] text-[#1E9E66]' : 'bg-[#FFF4DE] text-[#C0841D]'
                    }`}>{s.st === '主' ? '主·已验证' : '备·风险自担'}</span>
                  </div>
                  <div className="mt-0.5 text-[9px] text-[#A6ABC0]">{s.id} · {s.family.split('·')[0]}</div>
                  <button
                    type="button"
                    onClick={() => {
                      onAdopt?.({ id: s.id, name: s.name, family: s.family })
                      onClose()
                    }}
                    className="mt-1.5 w-full rounded-md border border-[#DED9FB] bg-violet-soft px-1 py-1 text-[10px] font-bold text-[#5A4FD8] transition hover:bg-violet hover:text-white"
                    data-cat-adopt={s.id}
                  >采用为主风格</button>
                </div>
              </div>
            ))}
          </div>
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
                  style={{ background: `${FAMILY_GRAD[previewItem.fam]} padding-box, #15161D` }}
                >
                  <span className="text-[44px] font-extrabold text-white/80">{previewItem.id}</span>
                </div>
              )
            })()}
            <div className="flex flex-wrap items-center gap-1.5 text-[14px] font-extrabold text-ink">
              {previewItem.name}
              <span className={`rounded px-1.5 py-px text-[10px] ${
                previewItem.st === '主' ? 'bg-[#E7F8F0] text-[#1E9E66]' : 'bg-[#FFF4DE] text-[#C0841D]'
              }`}>{previewItem.st === '主' ? '主·已验证' : '备·风险自担'}</span>
              <span className="rounded bg-[#E7F8F0] px-1.5 py-px text-[10px] font-extrabold text-[#1E9E66]">可行度 {previewItem.feat}</span>
            </div>
            <div className="text-[10.5px] text-[#A6ABC0]">{previewItem.id} · {previewItem.family}</div>
            <div>
              <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">锚点词示例</div>
              <div className="rounded-md border border-line bg-[#F8F9FC] p-2 text-[10.5px] leading-[1.5] text-[#4A4F68]">
                {previewItem.anchor}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">质感配方</div>
              <div className="rounded-md border border-line bg-[#F8F9FC] p-2 text-[10.5px] leading-[1.5] text-[#4A4F68]">
                Qwen-Image 系：预览档 Lightning 4 步 / euler / normal / CFG 2.0；标准档 euler / normal / 20 步 / CFG 2.5
              </div>
            </div>
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
                  onAdopt?.({ id: previewItem.id, name: previewItem.name, family: previewItem.family })
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
