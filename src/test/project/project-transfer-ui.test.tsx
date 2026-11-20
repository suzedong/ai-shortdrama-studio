import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectNav from '../../studio/shell/ProjectNav'
import WelcomeView from '../../studio/shell/WelcomeView'
import type { RuntimeSessionMessageRecord } from '../../lib/runtime-types'

const project = {
  dir: '/workspace/project-old',
  name: '旧项目',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  lastOpenedAt: '2026-01-02T00:00:00.000Z',
}

const recentProject = {
  ...project,
  dir: '/workspace/project-recent',
  name: '最近打开项目',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastOpenedAt: '2026-11-12T00:00:00.000Z',
}

const snapshotMessages = [
  {
    info: { id: 'user-1', role: 'user' },
    parts: [{ id: 'text-1', type: 'text', text: '请保留这条正式会话' }],
  },
  {
    info: { id: 'agent-1', role: 'assistant' },
    parts: [
      { id: 'reasoning-1', type: 'reasoning', text: '先检查项目' },
      { id: 'text-2', type: 'text', text: '项目已写入', startedAt: 1 },
      {
        id: 'tool-1',
        type: 'tool',
        tool: 'write',
        callId: 'call-1',
        status: 'completed',
        argsPreview: '{"path":"canvas.json"}',
        startedAt: 1,
        endedAt: 2,
      },
    ],
  },
] as unknown as RuntimeSessionMessageRecord[]

const detail: ProjectDetailDto = {
  dir: project.dir,
  projectId: 'project-old',
  title: project.name,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  lastOpenedAt: project.lastOpenedAt,
  status: 'draft',
  current: false,
  snapshots: [{
    sourceProjectId: 'project-source',
    sourceSessionId: 'source-session',
    exportedAt: '2026-11-12T01:00:00.000Z',
    messages: snapshotMessages,
  }],
}

const api = {
  listProjects: vi.fn(),
  createProject: vi.fn(),
  openProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  projectDetail: vi.fn(),
  projectReveal: vi.fn(),
  projectImport: vi.fn(),
  projectExport: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listProjects.mockResolvedValue([project, recentProject])
  api.createProject.mockResolvedValue({ dir: '/workspace/project-created' })
  api.openProject.mockResolvedValue({ ok: true, activeSessionId: null })
  api.projectDetail.mockResolvedValue(detail)
  api.projectReveal.mockResolvedValue({ ok: true })
  api.projectImport.mockResolvedValue({ canceled: true })
  api.projectExport.mockResolvedValue({
    canceled: false,
    exportDir: '/exports/project-old',
    sessionSnapshotExported: true,
  })
  window.api = api as unknown as Window['api']
})

describe('feature-828 · ProjectNav', () => {
  it('取消导入不打开项目；成功导入打开新项目并刷新列表', async () => {
    const onNotice = vi.fn()
    render(<ProjectNav activeProjectId="" onNotice={onNotice} />)
    await screen.findByText('最近打开项目')

    fireEvent.click(screen.getByRole('button', { name: '导入静态项目包' }))
    await waitFor(() => expect(api.projectImport).toHaveBeenCalledTimes(1))
    expect(api.openProject).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: '导入静态项目包' })).toBeEnabled())

    api.projectImport.mockResolvedValueOnce({ canceled: false, dir: '/workspace/project-imported' })
    fireEvent.click(screen.getByRole('button', { name: '导入静态项目包' }))
    await waitFor(() => expect(api.openProject).toHaveBeenCalledWith('/workspace/project-imported'))
    await waitFor(() => expect(api.listProjects).toHaveBeenCalledTimes(2))
    expect(onNotice).toHaveBeenCalledWith('项目已导入并打开')
  })

  it('详情只读回放用户、Agent、思考与工具；Finder 和导出调用真实桥', async () => {
    const onNotice = vi.fn()
    const { container } = render(<ProjectNav activeProjectId="" onNotice={onNotice} />)
    await screen.findByText('旧项目')
    const moreButtons = screen.getAllByRole('button', { name: '更多操作' })
    fireEvent.click(moreButtons[0])
    const detailButton = container.querySelector(`[data-project-detail="${project.dir}"]`)
    expect(detailButton).not.toBeNull()
    fireEvent.click(detailButton as Element)

    const dialog = await screen.findByRole('dialog', { name: '项目详情' })
    expect(await within(dialog).findByText('请保留这条正式会话')).toBeInTheDocument()
    expect(within(dialog).getByText('先检查项目')).toBeInTheDocument()
    expect(within(dialog).getByText('项目已写入')).toBeInTheDocument()
    expect(within(dialog).getByText('write')).toBeInTheDocument()
    expect(within(dialog).getByText(/canvas\.json/)).toBeInTheDocument()
    expect(within(dialog).getByText(/source-session/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).getByText('正式会话快照').parentElement?.parentElement?.querySelector('[data-session-snapshot="readonly"]')).not.toBeNull()

    fireEvent.click(within(dialog).getByRole('button', { name: '在 Finder 中显示' }))
    await waitFor(() => expect(api.projectReveal).toHaveBeenCalledWith(project.dir))
    fireEvent.click(within(dialog).getByRole('button', { name: '导出静态项目包' }))
    await waitFor(() => expect(api.projectExport).toHaveBeenCalledWith(project.dir))
    expect(onNotice).toHaveBeenCalledWith('已导出：/exports/project-old')
    expect(await within(dialog).findByRole('status')).toHaveTextContent('/exports/project-old')
  })
})

describe('feature-828 · WelcomeView', () => {
  it('按最近打开排序，支持导入、详情与导出', async () => {
    const onOpen = vi.fn(async () => {})
    const onNotice = vi.fn()
    const { container } = render(
      <WelcomeView onCreate={vi.fn()} onOpen={onOpen} onNotice={onNotice} />,
    )
    await screen.findByText('最近打开项目')
    const openButtons = container.querySelectorAll('[data-welcome-open]')
    expect(openButtons[0].getAttribute('data-welcome-open')).toBe(recentProject.dir)
    expect(openButtons[1].getAttribute('data-welcome-open')).toBe(project.dir)

    api.projectImport.mockResolvedValueOnce({ canceled: false, dir: '/workspace/project-imported' })
    fireEvent.click(screen.getByRole('button', { name: '导入静态项目包' }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('/workspace/project-imported'))
    expect(onNotice).toHaveBeenCalledWith('项目已导入并打开')

    const detailButton = container.querySelector(`[data-welcome-detail="${recentProject.dir}"]`)
    expect(detailButton).not.toBeNull()
    fireEvent.click(detailButton as Element)
    const dialog = await screen.findByRole('dialog', { name: '项目详情' })
    fireEvent.click(within(dialog).getByRole('button', { name: '导出静态项目包' }))
    await waitFor(() => expect(api.projectExport).toHaveBeenCalledWith(recentProject.dir))
  })
})
