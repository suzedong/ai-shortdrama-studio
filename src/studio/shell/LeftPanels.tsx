// 左栏资源库面板：Skill 广场 / 资产中心 / 专业插件（图标轨切换）
// - Skills / Plugins：本地目录静态数据（后续接 Skill 市场 / 插件注册 IPC 再替换）
// - Assets：接 window.api.asset.list（kind 维度见 shared/types.ts AssetIndexItem）
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssetIndexItem, CanvasNode } from '@shared/types'
import { ipcErrorMessage } from './ipc-error'

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
    catStyle: 'bg-warn/10 text-warn', portable: true,
    desc: '特写递进 + 光影升级，情绪爆发模板',
    iconBg: '#FFF0E6', iconColor: '#E8744F',
    icon: <><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /></>,
  },
  {
    id: 'SKL_03', name: '校园恋爱开场', version: 'v0.9.1', cat: '场景',
    catStyle: 'bg-violet-soft text-violet',
    desc: '前三秒钩子 + 女主出场的标准开场',
    iconBg: '#E6F7F0', iconColor: '#1E9E66',
    icon: <><path d="M3 12h4l3-9 4 18 3-9h4" /></>,
  },
  {
    id: 'SKL_04', name: '批量出镜', version: 'v0.1.16', cat: '批量',
    catStyle: 'bg-bad/10 text-bad',
    desc: '分镜表 → 多实例池逐镜批量生成',
    iconBg: '#EAF1FE', iconColor: '#4A7DD8',
    icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></>,
  },
]

const SKILL_CATS = ['全部', ...Array.from(new Set(SKILLS.map(s => s.cat)))]

export function SkillsPanel({ query = '' }: PanelProps) {
  const [cat, setCat] = useState('全部')
  const q = query.trim().toLowerCase()
  // feature-820：类目按钮真实筛选（此前只高亮不筛）；无执行通道，卡片标注「未开放」
  const list = SKILLS.filter(s =>
    (cat === '全部' || s.cat === cat)
    && (!q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)))

  return (
    <div>
      <p className="mb-2 px-1 text-[10px] leading-4 text-muted">Skill 市场尚未接入，以下为内置示例目录，暂不可执行。</p>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {SKILL_CATS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition ${
              cat === c ? 'bg-violet text-white' : 'bg-canvas text-muted hover:text-violet'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="px-1 pt-2 text-[11px] text-muted">没有匹配的 Skill。</p>}
      {list.map(s => (
        <div key={s.id} className="mb-2 rounded-[11px] border border-line bg-surface p-2.5 transition hover:-translate-y-px hover:border-violet/30 hover:shadow-[0_6px_16px_rgba(108,92,231,0.1)]">
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
                <span className="shrink-0 rounded bg-canvas px-1.5 py-px font-mono text-[9px] tracking-wide text-muted">{s.id}</span>
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-[1.45] text-muted">{s.desc}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide ${s.catStyle}`}>{s.cat}</span>
            {s.portable && <span className="rounded-full bg-ok/10 px-1.5 py-px text-[9px] font-bold text-ok">可移植</span>}
            <span className="rounded-full bg-canvas px-1.5 py-px text-[9px] font-bold text-muted">未开放</span>
            <span className="ml-auto rounded-full bg-canvas px-1.5 py-px font-mono text-[9px] font-semibold text-muted">{s.version}</span>
          </div>
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

function assetDisplayName(asset: AssetIndexItem): string {
  const originalName = asset.meta?.originalName
  if (typeof originalName === 'string') {
    const name = originalName.trim()
    if (name && name !== '.' && name !== '..' && !/[/\\\0]/.test(name)) return name
  }
  return basename(asset.path)
}

function AssetThumbnail({ projectId, asset, className }: {
  projectId: string
  asset: AssetIndexItem
  className: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const name = assetDisplayName(asset)

  useEffect(() => {
    let active = true
    setDataUrl(null)
    setImageFailed(false)
    if (projectId && asset.kind === 'image') {
      void window.api.asset.thumbnail(asset.id).then(result => {
        if (!active) return
        setDataUrl(result.dataUrl?.startsWith('data:image/webp;base64,') ? result.dataUrl : null)
      }).catch(() => {
        if (active) setDataUrl(null)
      })
    }
    return () => { active = false }
  }, [projectId, asset.id, asset.kind])

  return (
    <span className={className}>
      {dataUrl && !imageFailed ? (
        <img
          src={dataUrl}
          alt={name}
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : name.charAt(0).toUpperCase()}
    </span>
  )
}

interface AssetsPanelProps extends PanelProps {
  projectId: string
  selectedNode: CanvasNode | null
  notify: (tone: 'ok' | 'bad' | 'info', text: string) => void
  onBind: (assetIds: string[]) => Promise<void>
  onUnbind: (assetIds: string[]) => Promise<void>
}

export function AssetsPanel({ query = '', projectId, selectedNode, notify, onBind, onUnbind }: AssetsPanelProps) {
  const [kind, setKind] = useState<AssetKindTab>('image')
  const [assets, setAssets] = useState<AssetIndexItem[]>([])
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'bind' | 'unbind' | null>(null)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const loadSeqRef = useRef(0)
  const projectVersionRef = useRef(0)
  const uploadInFlightRef = useRef(false)

  useEffect(() => {
    const version = ++projectVersionRef.current
    uploadInFlightRef.current = false
    setUploading(false)
    setPicked(new Set())
    setCommandError(null)
    return () => {
      if (projectVersionRef.current === version) projectVersionRef.current += 1
    }
  }, [projectId])

  const load = useCallback(async (k: AssetKindTab) => {
    const request = ++loadSeqRef.current
    const version = projectVersionRef.current
    const isCurrent = () => request === loadSeqRef.current && version === projectVersionRef.current
    setLoaded(false)
    setLoadError(null)
    if (!projectId) {
      setAssets([])
      setLoaded(true)
      return
    }
    try {
      const next = await window.api.asset.list(k)
      if (isCurrent()) setAssets(next)
    } catch (e) {
      if (!isCurrent()) return
      console.error('asset.list failed', e)
      setAssets([])
      setLoadError('资产索引读取失败，请稍后重试。')
    } finally {
      if (isCurrent()) setLoaded(true)
    }
  }, [projectId])

  useEffect(() => {
    void load(kind)
    return () => { loadSeqRef.current += 1 }
  }, [kind, load])

  useEffect(() => window.api.runtime.onEvent(event => {
    if (event.type === 'tool.call' && event.status === 'completed'
      && (event.tool === 'shortdrama_asset_register' || event.tool === 'asset.register')) {
      void load(kind)
    }
  }), [kind, load])

  const upload = async () => {
    if (!projectId || uploadInFlightRef.current) return
    const version = projectVersionRef.current
    uploadInFlightRef.current = true
    setUploading(true)
    try {
      const result = await window.api.asset.import()
      if (version !== projectVersionRef.current || result.status === 'cancelled') return
      notify('ok', `已上传图片：${assetDisplayName(result.asset)}`)
      await load('image')
    } catch (error) {
      if (version === projectVersionRef.current) notify('bad', ipcErrorMessage(error))
    } finally {
      if (version === projectVersionRef.current) {
        uploadInFlightRef.current = false
        setUploading(false)
      }
    }
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? assets.filter(a => `${assetDisplayName(a)}\n${a.path}`.toLowerCase().includes(q))
    : assets
  const boundIds = new Set(selectedNode?.assetIds ?? [])
  const selectedIds = Array.from(picked)

  const toggle = (id: string) => {
    setPicked(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setCommandError(null)
  }

  const runCommand = async (action: 'bind' | 'unbind') => {
    if (!selectedNode || selectedIds.length === 0 || busy) return
    setBusy(action)
    setCommandError(null)
    try {
      await (action === 'bind' ? onBind : onUnbind)(selectedIds)
      setPicked(new Set())
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : '资产关联失败，请重试。')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div aria-busy={busy !== null || uploading}>
      <div className="mb-2.5 flex gap-1">
        {ASSET_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setKind(t.key)
              setPicked(new Set())
              setCommandError(null)
            }}
            className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-semibold transition ${
              kind === t.key ? 'bg-violet text-white' : 'bg-canvas text-muted hover:text-violet'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {kind === 'image' && (
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            disabled={!projectId || uploading}
            onClick={() => void upload()}
            title={projectId ? '选择一张 PNG、JPEG 或 WebP 图片' : '请先打开一个项目'}
            className="rounded-md border border-violet/30 bg-violet-soft px-2.5 py-1.5 text-[10.5px] font-semibold text-violet transition hover:border-violet disabled:cursor-not-allowed disabled:opacity-45"
          >
            {uploading ? '上传中…' : '上传图片'}
          </button>
          <span className="text-[9.5px] text-muted">单张 · PNG / JPEG / WebP</span>
        </div>
      )}

      <div className="mb-2 rounded-lg border border-line bg-surface px-2.5 py-2">
        <p className="truncate text-[11px] font-semibold text-ink" title={selectedNode?.title}>
          {selectedNode ? `当前节点：${selectedNode.title}` : '请先在画布中选择节点'}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">
          {selectedNode ? `已关联 ${boundIds.size} 项 · 本类已选 ${selectedIds.length} 项` : '选中后可批量绑定或解绑当前资产'}
        </p>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            disabled={!selectedNode || selectedIds.length === 0 || busy !== null}
            onClick={() => void runCommand('bind')}
            className="flex-1 rounded-md bg-violet px-2 py-1.5 text-[10.5px] font-semibold text-white transition hover:bg-violet/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy === 'bind' ? '绑定中…' : '绑定所选'}
          </button>
          <button
            type="button"
            disabled={!selectedNode || selectedIds.length === 0 || busy !== null}
            onClick={() => void runCommand('unbind')}
            className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-[10.5px] font-semibold text-muted transition hover:border-violet hover:text-violet disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy === 'unbind' ? '解绑中…' : '解绑所选'}
          </button>
        </div>
        {commandError && <p role="alert" className="mt-2 text-[10.5px] leading-4 text-bad">{commandError}</p>}
      </div>

      {!loaded ? (
        <p className="px-1 pt-2 text-[11px] text-muted">加载中…</p>
      ) : loadError ? (
        <div className="px-1 pt-2">
          <p role="alert" className="text-[11px] text-bad">{loadError}</p>
          <button type="button" onClick={() => void load(kind)} className="mt-1 text-[11px] font-semibold text-violet hover:underline">重新加载</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="px-1 pt-2 text-[11px] leading-5 text-muted">{KIND_EMPTY[kind]}</p>
      ) : kind === 'image' ? (
        <div className="grid grid-cols-2 gap-1.5">
          {visible.map(a => {
            const name = assetDisplayName(a)
            const active = picked.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(a.id)}
                className={`relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-canvas to-line text-left ${
                  active ? 'outline outline-2 outline-violet outline-offset-[-2px]' : ''
                }`}
                title={a.path}
              >
                <AssetThumbnail
                  projectId={projectId}
                  asset={a}
                  className="absolute inset-0 grid place-items-center overflow-hidden text-[22px] font-bold text-muted/60"
                />
                {boundIds.has(a.id) && <span className="absolute left-[5px] top-[5px] rounded bg-surface/90 px-1 py-px text-[9px] font-semibold text-violet">已关联</span>}
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
            const name = assetDisplayName(a)
            const active = picked.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(a.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border bg-surface p-2 text-left transition ${
                  active ? 'border-violet' : 'border-line hover:border-violet/30'
                }`}
                title={a.path}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-soft text-violet">
                  {kind === 'music' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5"><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-ink">{name}</span>
                {boundIds.has(a.id) && <span className="shrink-0 text-[9px] font-semibold text-violet">已关联</span>}
              </button>
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
  icon: JSX.Element
}

const PLUGINS: PluginDef[] = [
  {
    name: '3D 导演台', desc: '自然语言摆位、机位与姿态',
    icon: <><path d="M12 2 2 7l10 5 10-5z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></>,
  },
  {
    name: '智能剪辑台', desc: '语义化字幕、转场与拼接',
    icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M11 5v14M15 5v14" /></>,
  },
  {
    name: '批量水印 / Logo', desc: '成片批量版权信息',
    icon: <><path d="M12 3v18M3 12h18" /></>,
  },
  {
    name: '多角度机位', desc: '同一主体多视角批量出片',
    icon: <><rect x="3" y="3" width="18" height="18" rx="9" /><circle cx="12" cy="12" r="3" /></>,
  },
]

export function PluginsPanel({ query = '' }: PanelProps) {
  const q = query.trim().toLowerCase()
  const list = PLUGINS.filter(p => !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))

  return (
    <div>
      <p className="mb-2 px-1 text-[10px] leading-4 text-muted">插件能力未开放：以下为规划中的插件，当前不可启用。</p>
      {list.length === 0 && <p className="px-1 pt-2 text-[11px] text-muted">没有匹配的插件。</p>}
      {list.map(p => (
        <div key={p.name} className="mb-2 flex items-center gap-2.5 rounded-[11px] border border-line bg-surface p-2.5">
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-violet-soft text-violet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              {p.icon}
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-bold text-ink">{p.name}</div>
            <div className="truncate text-[10px] text-muted">{p.desc}</div>
          </div>
          <span className="shrink-0 rounded-full bg-canvas px-1.5 py-px text-[9px] font-bold text-muted">未开放</span>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── 本地模型 ───────────────────────── */

// feature-820：P1 调查 §3-⑨ 缺失的一级入口；本面板只陈述未开放范围与现有替代路径，不伪造可操作项
export function LocalModelPanel({ onOpenAiSettings }: { onOpenAiSettings: () => void }) {
  return (
    <div>
      <div className="mb-2 rounded-[11px] border border-line bg-surface p-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
          本地模型管理
          <span className="rounded-full bg-canvas px-1.5 py-px text-[9px] font-bold text-muted">未开放</span>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-[1.5] text-muted">
          应用内的模型下载、切换与显存管理尚未开放，本页不提供可执行操作。
        </p>
      </div>
      <div className="mb-2 rounded-[11px] border border-line bg-surface p-2.5">
        <p className="text-[11px] font-bold text-ink">当前可用路径</p>
        <ul className="mt-1.5 space-y-1 text-[10.5px] leading-[1.5] text-muted">
          <li>· 文本服务：在「AI 服务设置」中切换火山方舟 / 本地 LM Studio。</li>
          <li>· 图像 / 视频 / 音乐：经本地或局域网 ComfyUI 推理，实例在「AI 服务设置 · ComfyUI」维护。</li>
        </ul>
        <button
          type="button"
          onClick={onOpenAiSettings}
          data-local-models-settings
          className="mt-2 rounded-md border border-violet/30 bg-violet-soft px-2 py-1.5 text-[10.5px] font-semibold text-violet transition hover:bg-violet hover:text-white"
        >
          打开 AI 服务设置
        </button>
      </div>
    </div>
  )
}
