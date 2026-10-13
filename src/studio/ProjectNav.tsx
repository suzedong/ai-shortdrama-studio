// feature-022 · 左栏项目导航（契约 §3 / OD §2）
// 最小职责：列表（project:list）/ 新建（project:create）/ 打开（project:open）；
// 不持有业务状态——打开后主进程重挂项目上下文，画布经 canvas:changed 推送刷新。
// 视觉：无外壳纯内容（外壳由 StudioApp 左栏提供），新建表单由底部按钮经 ref 触发。
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'

interface ProjectItem {
  dir: string
  name: string
  createdAt?: string
  updatedAt: string
}

interface Props {
  /** 当前项目标识（canvas.projectId = 项目目录 basename），用于高亮 */
  activeProjectId: string
  /** 左栏搜索关键字（按项目名过滤） */
  query?: string
}

export interface ProjectNavHandle {
  /** 由左栏底部「新建项目」按钮调用，展开内联新建表单 */
  startCreate: () => void
}

const THUMB_GRADIENTS = [
  'linear-gradient(135deg,#B8AFFF,#6C5CE7)',
  'linear-gradient(135deg,#9FD8C4,#3E9E86)',
  'linear-gradient(135deg,#FFC6A0,#E8744F)',
  'linear-gradient(135deg,#A8C4FF,#4A7DD8)',
]

function relativeTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return new Date(t).toLocaleDateString('zh-CN')
}

const ProjectNav = forwardRef<ProjectNavHandle, Props>(function ProjectNav({ activeProjectId, query = '' }, ref) {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setProjects(await window.api.listProjects())
    } catch (e) {
      setError(e instanceof Error ? e.message : '项目列表加载失败')
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useImperativeHandle(ref, () => ({
    startCreate: () => {
      setError(null)
      setCreating(true)
    },
  }), [])

  const open = async (dir: string): Promise<void> => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await window.api.openProject(dir)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '打开项目失败')
    } finally {
      setBusy(false)
    }
  }

  const create = async (): Promise<void> => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const { dir } = await window.api.createProject(name.trim() || undefined)
      await window.api.openProject(dir)
      setName('')
      setCreating(false)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '新建项目失败')
    } finally {
      setBusy(false)
    }
  }

  const visible = query.trim()
    ? projects.filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : projects

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="mb-2 rounded-lg border border-bad/40 bg-bad/10 px-2 py-1.5 text-[11px] leading-4 text-bad">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-1 pt-2 text-[11px] leading-5 text-muted">
            {projects.length === 0 ? '还没有项目，点击下方「新建项目」开始。' : '没有匹配的项目。'}
          </p>
        ) : (
          visible.map((p, i) => {
            const active = p.dir.endsWith(`/${activeProjectId}`) || p.dir === activeProjectId
            return (
              <button
                key={p.dir}
                type="button"
                disabled={busy || active}
                onClick={() => void open(p.dir)}
                title={p.dir}
                className={`mb-[3px] flex w-full items-center gap-2.5 rounded-[10px] border p-2 text-left transition disabled:opacity-100 ${
                  active
                    ? 'border-[#DED9FB] bg-violet-soft'
                    : 'border-transparent hover:bg-[#F5F6FB]'
                }`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-white"
                  style={{ background: THUMB_GRADIENTS[i % THUMB_GRADIENTS.length] }}
                >
                  {(p.name || '未').trim().charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12.5px] font-bold leading-tight ${active ? 'text-violet' : 'text-ink'}`}>
                    {p.name || '未命名项目'}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-[#9AA0B5]">
                    {relativeTime(p.updatedAt)}
                    {active ? ' · 编辑中' : ''}
                  </span>
                </span>
                <span className={`ml-auto h-[7px] w-[7px] shrink-0 rounded-full ${active ? 'bg-ok' : 'bg-[#C9CCDA]'}`} />
              </button>
            )
          })
        )}
      </div>

      {creating && (
        <div className="mt-2 space-y-2 rounded-xl border border-line bg-white p-2.5">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void create(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="项目名（可空，Enter 确认）"
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-violet"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy}
              className="flex-1 rounded-lg bg-violet px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              确认新建
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setName('') }}
              disabled={busy}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-muted hover:text-ink"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

export default ProjectNav
