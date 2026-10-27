// 左栏资源库面板：Skill 广场 / 资产中心 / 专业插件（图标轨切换）
// - Skills / Plugins：本地目录静态数据（后续接 Skill 市场 / 插件注册 IPC 再替换）
// - Assets：接 window.api.asset.list（kind 维度见 shared/types.ts AssetIndexItem）
import { useCallback, useEffect, useState } from 'react'
import type { AssetIndexItem } from '@shared/types'

interface PanelProps {
  query?: string
}

/* ───────────────────────── Skill 广场 ───────────────────────── */

interface SkillDef {
  id: string
  name: string
  desc: string
  version: string
  cat: string
  catStyle: string
  portable?: boolean
  iconBg: string
  iconColor: string
  icon: JSX.Element
}

const SKILLS: SkillDef[] = [
  {
    id: 'SKL_01', name: '日漫定妆流', version: 'v1.2.0', cat: '角色',
    catStyle: 'bg-violet-soft text-violet',
    desc: '角色概念 → 定妆，一致性配方自动生成',
    iconBg: '#EEECFB', iconColor: '#6C5CE7',
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  },
  {
    id: 'SKL_02', name: '强情绪三连镜', version: 'v0.4.3', cat: '情绪',
    catStyle: 'bg-[#FFF4DE] text-[#C0841D]', portable: true,
    desc: '特写递进 + 光影升级，情绪爆发模板',
    iconBg: '#FFF0E6', iconColor: '#E8744F',
    icon: <><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /></>,
  },
  {
    id: 'SKL_03', name: '校园恋爱开场', version: 'v0.9.1', cat: '场景',
    catStyle: 'bg-[#E6EEFE] text-[#3F6FCB]',
    desc: '前三秒钩子 + 女主出场的标准开场',
    iconBg: '#E6F7F0', iconColor: '#1E9E66',
    icon: <><path d="M3 12h4l3-9 4 18 3-9h4" /></>,
  },
  {
    id: 'SKL_04', name: '批量出镜', version: 'v0.1.16', cat: '批量',
    catStyle: 'bg-[#FCE6E5] text-[#B23B33]',
    desc: '分镜表 → 多实例池逐镜批量生成',
    iconBg: '#EAF1FE', iconColor: '#4A7DD8',
    icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></>,
  },
]

const SKILL_CATS = ['全部', '短剧', '情绪', '校园']

export function SkillsPanel({ query = '' }: PanelProps) {
  const [cat, setCat] = useState('全部')
  const q = query.trim().toLowerCase()
  const list = SKILLS.filter(s => !q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {SKILL_CATS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition ${
              cat === c ? 'bg-violet text-white' : 'bg-[#F2F3F9] text-[#7C8298] hover:text-violet'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="px-1 pt-2 text-[11px] text-muted">没有匹配的 Skill。</p>}
      {list.map(s => (
        <div key={s.id} className="mb-2 rounded-[11px] border border-line bg-white p-2.5 transition hover:-translate-y-px hover:border-[#C9C1F5] hover:shadow-[0_6px_16px_rgba(108,92,231,0.1)]">
          <div className="flex items-center gap-2">
            <span
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg"
              style={{ background: s.iconBg, color: s.iconColor }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                {s.icon}
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 rounded bg-[#F2F3F9] px-1.5 py-px font-mono text-[9px] tracking-wide text-muted">{s.id}</span>
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-[1.45] text-[#9AA0B5]">{s.desc}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide ${s.catStyle}`}>{s.cat}</span>
            {s.portable && <span className="rounded-full bg-[#E7F8F0] px-1.5 py-px text-[9px] font-bold text-[#1E9E66]">可移植</span>}
            <span className="ml-auto rounded-full bg-[#F6F7FB] px-1.5 py-px font-mono text-[9px] font-semibold text-muted">{s.version}</span>
          </div>
          <button type="button" className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-violet hover:underline">
            在对话中试用 →
          </button>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── 资产中心 ───────────────────────── */

type AssetKindTab = AssetIndexItem['kind']

const ASSET_TABS: { key: AssetKindTab; label: string }[] = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'music', label: '音乐' },
  { key: 'workflow', label: '工作流' },
]

const KIND_EMPTY: Record<AssetKindTab, string> = {
  image: '还没有图片资产，角色定妆 / 场景图生成后会出现在这里。',
  video: '还没有镜头视频，ComfyUI 出片后会出现在这里。',
  music: '还没有音乐资产。',
  workflow: '还没有保存的工作流配方。',
}

function basename(p: string): string {
  const seg = p.split(/[/\\]/).filter(Boolean)
  return seg[seg.length - 1] || p
}

export function AssetsPanel({ query = '' }: PanelProps) {
  const [kind, setKind] = useState<AssetKindTab>('image')
  const [assets, setAssets] = useState<AssetIndexItem[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async (k: AssetKindTab) => {
    setLoaded(false)
    try {
      setAssets(await window.api.asset.list(k))
    } catch (e) {
      console.error('asset.list failed', e)
      setAssets([])
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void load(kind) }, [kind, load])

  const q = query.trim().toLowerCase()
  const visible = q ? assets.filter(a => basename(a.path).toLowerCase().includes(q)) : assets

  return (
    <div>
      <div className="mb-2.5 flex gap-1">
        {ASSET_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setKind(t.key)}
            className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-semibold transition ${
              kind === t.key ? 'bg-violet text-white' : 'bg-[#F2F3F9] text-[#7C8298] hover:text-violet'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="px-1 pt-2 text-[11px] text-muted">加载中…</p>
      ) : visible.length === 0 ? (
        <p className="px-1 pt-2 text-[11px] leading-5 text-muted">{KIND_EMPTY[kind]}</p>
      ) : kind === 'image' ? (
        <div className="grid grid-cols-2 gap-1.5">
          {visible.map(a => {
            const name = basename(a.path)
            const active = picked === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setPicked(active ? null : a.id)}
                className={`relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-[#EEF0F6] to-[#DDE0EC] text-left ${
                  active ? 'outline outline-2 outline-violet outline-offset-[-2px]' : ''
                }`}
                title={a.path}
              >
                <span className="absolute inset-0 grid place-items-center text-[22px] font-bold text-[#A6ACC4]/60">
                  {name.charAt(0).toUpperCase()}
                </span>
                {active && (
                  <span className="absolute right-[5px] top-[5px] grid h-[15px] w-[15px] place-items-center rounded-full bg-violet">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="h-[9px] w-[9px] text-white">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/65 to-transparent px-1.5 pb-1 pt-3 text-[9.5px] font-bold text-white">
                  {name}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map(a => {
            const name = basename(a.path)
            return (
              <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-white p-2" title={a.path}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-soft text-violet">
                  {kind === 'music' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5"><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-ink">{name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── 专业插件 ───────────────────────── */

interface PluginDef {
  name: string
  desc: string
  defaultOn: boolean
  icon: JSX.Element
}

const PLUGINS: PluginDef[] = [
  {
    name: '3D 导演台', desc: '自然语言摆位、机位与姿态', defaultOn: true,
    icon: <><path d="M12 2 2 7l10 5 10-5z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></>,
  },
  {
    name: '智能剪辑台', desc: '语义化字幕、转场与拼接', defaultOn: true,
    icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M11 5v14M15 5v14" /></>,
  },
  {
    name: '批量水印 / Logo', desc: '成片批量版权信息', defaultOn: false,
    icon: <><path d="M12 3v18M3 12h18" /></>,
  },
  {
    name: '多角度机位', desc: '同一主体多视角批量出片', defaultOn: false,
    icon: <><rect x="3" y="3" width="18" height="18" rx="9" /><circle cx="12" cy="12" r="3" /></>,
  },
]

export function PluginsPanel({ query = '' }: PanelProps) {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PLUGINS.map(p => [p.name, p.defaultOn])))
  const q = query.trim().toLowerCase()
  const list = PLUGINS.filter(p => !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))

  return (
    <div>
      {list.length === 0 && <p className="px-1 pt-2 text-[11px] text-muted">没有匹配的插件。</p>}
      {list.map(p => {
        const enabled = on[p.name]
        return (
          <div key={p.name} className="mb-2 flex items-center gap-2.5 rounded-[11px] border border-line bg-white p-2.5">
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-violet-soft text-violet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                {p.icon}
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-ink">{p.name}</div>
              <div className="truncate text-[10px] text-[#9AA0B5]">{p.desc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setOn(s => ({ ...s, [p.name]: !s[p.name] }))}
              className={`relative h-[18px] w-8 shrink-0 rounded-full transition ${enabled ? 'bg-violet' : 'bg-[#D7DAE6]'}`}
            >
              <span className={`absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
