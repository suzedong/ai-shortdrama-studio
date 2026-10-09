// feature-022 · 左栏项目导航（契约 §3 / OD §2）
// 最小职责：列表（project:list）/ 新建（project:create）/ 打开（project:open）；
// 不持有业务状态——打开后主进程重挂项目上下文，画布经 canvas:changed 推送刷新。
import { useCallback, useEffect, useState } from 'react'

interface ProjectItem {
  dir: string
  name: string
  createdAt?: string
  updatedAt: string
}

interface Props {
  /** 当前项目标识（canvas.projectId = 项目目录 basename），用于高亮 */
  activeProjectId: string
}

export default function ProjectNav({ activeProjectId }: Props) {
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

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 text-sm font-medium text-ink">项目</div>

      {error && (
        <div className="mb-2 rounded-lg border border-bad/40 bg-bad/10 px-2 py-1.5 text-[11px] leading-4 text-bad">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="text-xs leading-5 text-muted">
            还没有项目。
            <br />
            点击下方「新建项目」开始。
          </p>
        ) : (
          <ul className="space-y-1">
            {projects.map(p => {
              const active = p.dir.endsWith(`/${activeProjectId}`) || p.dir === activeProjectId
              return (
                <li key={p.dir}>
                  <button
                    type="button"
                    disabled={busy || active}
                    onClick={() => void open(p.dir)}
                    title={p.dir}
                    className={`w-full truncate rounded-lg border px-3 py-2 text-left text-xs ${
                      active
                        ? 'border-violet bg-violet-soft font-medium text-violet'
                        : 'border-line bg-white text-ink hover:border-violet'
                    } disabled:opacity-60`}
                  >
                    {p.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        {creating ? (
          <div className="space-y-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void create() }}
              placeholder="项目名（可空）"
              className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-violet"
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
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-muted hover:text-ink"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full rounded-lg border border-dashed border-line bg-white px-2 py-1.5 text-xs text-muted hover:border-violet hover:text-violet"
          >
            + 新建项目
          </button>
        )}
      </div>
    </div>
  )
}
