// feature-812：无项目态首屏——中栏唯一入口（新建 / 打开最近）
// 挂载条件：canvas.projectId === ''（契约 §2）。不读磁盘、不新增 IPC，只消费既有三桥：
// listProjects / createProject / openProject。画布刷新由主进程 project:open 主动广播完成。
import { useCallback, useEffect, useState } from 'react'

import { relativeTime } from './ProjectNav'

interface Props {
  /** 主 CTA：StudioApp 实现为 createProject(undefined) → openProject(dir) */
  onCreate: () => void | Promise<void>
  /** 列表项：StudioApp 实现为 openProject(dir) */
  onOpen: (dir: string) => void | Promise<void>
}

interface ProjectEntry {
  dir: string
  name: string
  updatedAt: string
}

/** 首屏只负责"可点"，完整项目库在左栏；超出部分提示去左栏 */
const MAX_RECENT = 5
const THUMB_COLORS = ['#6C5CE7', '#0F9F6E', '#E8833A', '#3D7BD9', '#C4487A']

export default function WelcomeView({ onCreate, onOpen }: Props) {
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [busy, setBusy] = useState<{ kind: 'create' | 'open'; dir?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.api.listProjects()
      .then(list => { if (alive) setProjects(list) })
      .catch((e: unknown) => {
        if (alive) setListError(e instanceof Error ? e.message : '项目列表加载失败')
      })
    return () => { alive = false }
  }, [])

  // 契约 §2.3：按 updatedAt 降序取前 5（不可变排序，不改 state 原数组）
  const recent = [...projects]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_RECENT)

  const run = useCallback(
    async (kind: 'create' | 'open', fn: () => void | Promise<void>, dir?: string) => {
      if (busy) return
      setError(null)
      setBusy({ kind, dir })
      try {
        await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : kind === 'create' ? '新建项目失败' : '打开项目失败')
      } finally {
        setBusy(null)
      }
    },
    [busy],
  )

  const creating = busy?.kind === 'create'

  return (
    <div
      className="flex h-full w-full items-start justify-center overflow-y-auto px-[26px] py-[26px]"
      data-view="welcome"
    >
      <div className="w-full max-w-[560px] rounded-[14px] border border-line bg-white p-7 shadow-[0_10px_30px_rgba(40,42,80,0.06)]">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-soft text-xl text-violet">0</span>
        <h1 className="mt-3 text-[15px] font-extrabold text-ink">开始一部短剧</h1>
        <p className="mt-2 text-[11.5px] leading-[1.8] text-muted">
          一句话说清题材，主控 Agent 会带编剧、美术、镜头三个专职 Agent 依次产出立项单、故事、分场、资产、分镜，直到成片。
        </p>

        {error && (
          <div
            className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-2 py-1.5 text-[11px] leading-4 text-bad"
            data-welcome-error
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void run('create', onCreate)}
          disabled={busy !== null}
          className="mt-4 w-full rounded-[10px] bg-[#1E2233] py-2 text-[12.5px] font-semibold text-white transition hover:-translate-y-px hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-[#1E2233]"
          data-welcome-create
        >
          {creating ? '创建中…' : '＋ 新建项目'}
        </button>

        <div className="my-5 flex items-center gap-3 text-[10.5px] text-[#9AA0B5]">
          <span className="h-px flex-1 bg-line" />
          或打开已有项目
          <span className="h-px flex-1 bg-line" />
        </div>

        {listError ? (
          <p className="text-[11px] leading-5 text-bad" data-welcome-list-error>{listError}</p>
        ) : recent.length === 0 ? (
          <p className="text-[11px] leading-5 text-muted" data-welcome-empty>还没有项目，点上方「新建项目」开始。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((p, i) => (
              <li key={p.dir}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run('open', () => onOpen(p.dir), p.dir)}
                  title={p.dir}
                  className="flex w-full items-center gap-2.5 rounded-[10px] border border-transparent p-2 text-left transition hover:bg-[#F5F6FB] disabled:cursor-not-allowed disabled:opacity-50"
                  data-welcome-open={p.dir}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold text-white"
                    style={{ background: THUMB_COLORS[i % THUMB_COLORS.length] }}
                  >
                    {(p.name || '未').trim().charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-ink">{p.name || '未命名项目'}</span>
                    <span className="mt-0.5 block text-[10px] text-[#9AA0B5]">{relativeTime(p.updatedAt)}</span>
                  </span>
                  <span className="shrink-0 text-[10.5px] font-bold text-violet">
                    {busy?.kind === 'open' && busy.dir === p.dir ? '打开中…' : '打开'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 border-t border-line pt-3 text-[10px] text-[#9AA0B5]">
          0 立项 → 1 故事 → 2 分场 → 3 资产 → 4 分镜 → 5 镜头 → 6 后期 → 7 发布
        </p>
      </div>
    </div>
  )
}
