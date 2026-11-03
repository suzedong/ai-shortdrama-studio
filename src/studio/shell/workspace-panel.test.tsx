// feature-813 · 工作目录面板组件测试（契约 §5.2）
// 覆盖：当前根与来源展示、pick 取消无动作、确认区含项目数提示、
// 成功条（新根 + 移动数 + 运行时提示）、错误条原样上屏且面板保持打开。
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WorkspacePanel from './WorkspacePanel'

/** Electron invoke 抛错的包装形态（renderer 侧剥壳前的原始 message） */
function ipcReject(channel: string, msg: string): Error {
  return new Error(`Error invoking remote method '${channel}': Error: ${msg}`)
}

interface PanelHarness {
  get: ReturnType<typeof vi.fn>
  pick: ReturnType<typeof vi.fn>
  change: ReturnType<typeof vi.fn>
  listProjects: ReturnType<typeof vi.fn>
  unmount: () => void
}

function installPanel(opts?: {
  source?: 'store' | 'default'
  root?: string
  pickDir?: string | null
  projects?: unknown[]
  changeResult?: unknown
  changeError?: Error
}): PanelHarness {
  const view: WorkspaceSettingsView = {
    root: opts?.root ?? '/docs/ai-shortdrama-studio',
    defaultRoot: '/docs/ai-shortdrama-studio',
    source: opts?.source ?? 'default',
    updatedAt: new Date().toISOString(),
  }
  const get = vi.fn(async () => view)
  const pick = vi.fn(async () => ({ dir: opts?.pickDir ?? null }))
  const listProjects = vi.fn(async () => opts?.projects ?? [{ dir: '/p/project-a' }])
  const change = opts?.changeError
    ? vi.fn(async () => { throw opts.changeError })
    : vi.fn(async () => opts?.changeResult ?? {
        ok: true,
        root: '/docs/new-root',
        moved: ['project-a', 'project-b'],
        movedCount: 2,
      })
  window.api = {
    settings: { workspace: { get, pick, change } },
    listProjects,
  } as unknown as Window['api']
  const r = render(<WorkspacePanel onClose={() => undefined} />)
  return { get, pick, change, listProjects, unmount: r.unmount }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('workspace panel', () => {
  it('展示当前根目录与来源徽章（默认）', async () => {
    installPanel({ source: 'default', root: '/docs/ai-shortdrama-studio' })
    expect(await screen.findByText('当前根目录')).toBeTruthy()
    expect(screen.getByText('默认')).toBeTruthy()
    expect(screen.getByText('/docs/ai-shortdrama-studio')).toBeTruthy()
    expect(screen.getByText('更换目录')).toBeTruthy()
  })

  it('source=store 时来源徽章显示「自定义」', async () => {
    installPanel({ source: 'store', root: '/custom/root' })
    await screen.findByText('当前根目录')
    expect(screen.getByText('自定义')).toBeTruthy()
    expect(screen.getByText('/custom/root')).toBeTruthy()
  })

  it('pick 取消（dir=null）无动作：不进入确认区', async () => {
    const h = installPanel({ pickDir: null })
    await screen.findByText('当前根目录')
    const user = userEvent.setup()
    await user.click(screen.getByText('更换目录'))
    await waitFor(() => expect(h.pick).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('确认更换')).toBeNull()
    expect(screen.queryByText('将整体移动 1 个项目目录')).toBeNull()
  })

  it('选目录后进入确认区：目标路径 + 项目数提示（N 取 listProjects）', async () => {
    const h = installPanel({ pickDir: '/docs/new-root', projects: [{ dir: 'a' }, { dir: 'b' }] })
    await screen.findByText('当前根目录')
    const user = userEvent.setup()
    await user.click(screen.getByText('更换目录'))
    await screen.findByText('目标目录')
    expect(screen.getByText('/docs/new-root')).toBeTruthy()
    expect(screen.getByText('将整体移动 2 个项目目录')).toBeTruthy()
    expect(screen.getByText('确认更换')).toBeTruthy()
    expect(screen.getByText('取消')).toBeTruthy()
    expect(h.listProjects).toHaveBeenCalledTimes(1)
  })

  it('确认成功后：成功条含新根与移动数 + 运行时提示 + 当前根刷新', async () => {
    const h = installPanel({
      pickDir: '/docs/new-root',
      projects: [{ dir: 'a' }, { dir: 'b' }],
      changeResult: { ok: true, root: '/docs/new-root', moved: ['project-a', 'project-b'], movedCount: 2 },
    })
    await screen.findByText('当前根目录')
    const user = userEvent.setup()
    await user.click(screen.getByText('更换目录'))
    await user.click(await screen.findByText('确认更换'))
    await waitFor(() => expect(h.change).toHaveBeenCalledWith('/docs/new-root'))
    expect(screen.getByText('已更换到 /docs/new-root（移动 2 个项目）')).toBeTruthy()
    expect(screen.getByText('运行时已驻留时，需手动重连运行时后新根目录生效')).toBeTruthy()
    // 当前根目录行刷新为新根
    await waitFor(() =>
      expect(document.querySelector('[data-workspace-root]')?.textContent).toBe('/docs/new-root'))
    // 更换区复位到初始态
    expect(screen.queryByText('确认更换')).toBeNull()
  })

  it('更换失败：主进程 message 原样上屏，面板保持打开且已选目标可重试', async () => {
    installPanel({
      pickDir: '/docs/new-root',
      changeError: ipcReject('settings:workspace:change', '目标根目录已存在同名项目：project-a'),
    })
    await screen.findByText('当前根目录')
    const user = userEvent.setup()
    await user.click(screen.getByText('更换目录'))
    await user.click(await screen.findByText('确认更换'))
    await waitFor(() =>
      expect(screen.getByText('目标根目录已存在同名项目：project-a')).toBeTruthy())
    // 错误条存在（role=alert）
    expect(screen.getByRole('alert')).toBeTruthy()
    // 面板保持打开且确认区保留已选目标（可重试）
    expect(screen.getByText('/docs/new-root')).toBeTruthy()
    expect(screen.getByText('确认更换')).toBeTruthy()
  })
})
