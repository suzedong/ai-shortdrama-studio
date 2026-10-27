// 左栏项目导航
// 最小职责：列表（project:list）/ 新建（project:create）/ 打开（project:open）；
// B-19 增补：悬停「···」菜单——改名（行内输入）/ 删除（回收站、当前项禁删）。
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
  // B-19：菜单/改名/删除三态（同一行同一时刻只处其一）
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ dir: string; value: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

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

  // B-19：改名提交（空名视为取消，不打 IPC）；当前项改名后主进程顺带同步 canvas.title
  const doRename = async (): Promise<void> => {
    if (busy || !renaming) return
    const title = renaming.value.trim()
    if (!title) {
      setRenaming(null)
      return
    }
    setError(null)
    setBusy(true)
    try {
      await window.api.renameProject(renaming.dir, title)
      setRenaming(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '改名失败')
    } finally {
      setBusy(false)
    }
  }

  // B-19：删除提交（主进程移入回收站；当前项已在主进程拒删，UI 侧入口同步禁用）
  const doDelete = async (dir: string): Promise<void> => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await window.api.deleteProject(dir)
      setConfirmDelete(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setConfirmDelete(null)
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

      {/* B-19：菜单打开时的全屏透明罩，点击任意处关闭 */}
      {menuFor && <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-1 pt-2 text-[11px] leading-5 text-muted">
            {projects.length === 0 ? '还没有项目，点击下方「新建项目」开始。' : '没有匹配的项目。'}
          </p>
        ) : (
          visible.map((p, i) => {
            // activeProjectId 为项目目录 basename（canvas.projectId）；真实 Windows 下
            // p.dir 是 path.join 的反斜杠路径，mock/测试为正斜杠——取末段通吃两种分隔符
            const active = p.dir.split(/[\\/]/).pop() === activeProjectId
            // B-19：改名态——整行替换为行内输入（Enter 确认 / Esc 取消）
            if (renaming?.dir === p.dir) {
              return (
                <div key={p.dir} className="mb-[3px] flex items-center gap-2 rounded-[10px] border border-violet/60 bg-white p-2">
                  <input
                    autoFocus
                    value={renaming.value}
                    onChange={e => setRenaming({ dir: p.dir, value: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') void doRename(); if (e.key === 'Escape') setRenaming(null) }}
                    placeholder="项目名（Enter 确认）"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink outline-none focus:border-violet"
                  />
                  <button
                    type="button"
                    onClick={() => void doRename()}
                    disabled={busy}
                    className="shrink-0 rounded-lg bg-violet px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    确定
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(null)}
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-line bg-white px-2 py-1 text-[11px] text-muted hover:text-ink"
                  >
                    取消
                  </button>
                </div>
              )
            }
            // B-19：删除确认态——整行替换为确认条
            if (confirmDelete === p.dir) {
              return (
                <div key={p.dir} className="mb-[3px] rounded-[10px] border border-bad/40 bg-bad/10 p-2">
                  <p className="text-[11px] leading-4 text-ink">
                    删除「{p.name || '未命名项目'}」？将移入回收站。
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void doDelete(p.dir)}
                      disabled={busy}
                      className="rounded-lg bg-bad px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      disabled={busy}
                      className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] text-muted hover:text-ink"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )
            }
            return (
              // B-19：容器 div + 兄弟「···」按钮（按钮不可嵌套按钮）
              <div key={p.dir} className="group relative">
                <button
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
                  <span className={`ml-auto h-[7px] w-[7px] shrink-0 rounded-full transition ${menuFor === p.dir ? 'opacity-0' : 'group-hover:opacity-0'} ${active ? 'bg-ok' : 'bg-[#C9CCDA]'}`} />
                </button>
                <button
                  type="button"
                  aria-label="更多操作"
                  disabled={busy}
                  onClick={() => setMenuFor(menuFor === p.dir ? null : p.dir)}
                  className={`absolute right-2 top-1/2 z-[1] -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[13px] font-bold leading-none tracking-wider text-[#9AA0B5] hover:bg-white hover:text-ink disabled:opacity-50 ${
                    menuFor === p.dir ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  ···
                </button>
                {menuFor === p.dir && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-0.5 w-28 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuFor(null); setConfirmDelete(null); setRenaming({ dir: p.dir, value: p.name }) }}
                      className="block w-full px-3 py-1.5 text-left text-[12px] text-ink hover:bg-[#F5F6FB]"
                    >
                      改名
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={active}
                      title={active ? '当前项目正在编辑，请先切换到其他项目' : '移入回收站'}
                      onClick={() => { setMenuFor(null); setRenaming(null); setConfirmDelete(p.dir) }}
                      className="block w-full px-3 py-1.5 text-left text-[12px] text-bad hover:bg-bad/10 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
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
