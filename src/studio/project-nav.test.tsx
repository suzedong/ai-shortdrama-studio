// B-18 修复 · ProjectNav 选中态跨平台路径兼容
// activeProjectId 是项目目录 basename；Windows 真实路径为反斜杠（path.join 产物），
// mock/旧夹具为正斜杠——两种分隔符下当前项目都必须呈现选中态。
// B-19 · 改名（行内输入）/ 删除（二次确认、当前项禁删）悬停菜单。
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ProjectNav from './ProjectNav'

const now = new Date().toISOString()

const CN_NUM = ['一', '二', '三']

function mount(activeId: string, dirs: string[], api?: Partial<Window['api']>): void {
  window.api = {
    listProjects: vi.fn(async () =>
      dirs.map((dir, i) => ({
        dir,
        name: `项目${CN_NUM[i]}`,
        updatedAt: now,
      })),
    ),
    ...api,
  } as unknown as Window['api']
  render(<ProjectNav activeProjectId={activeId} />)
}

describe('ProjectNav · 当前项目选中态（B-18）', () => {
  it('POSIX 正斜杠路径：当前项目高亮并禁用', async () => {
    mount('project-p1', ['/ws/project-p1', '/ws/project-p2'])
    const active = await screen.findByRole('button', { name: /项目一/ })
    await waitFor(() => expect(active).toBeDisabled())
    expect(active.className).toContain('bg-violet-soft')
    expect(screen.getByText(/编辑中/)).toBeInTheDocument()

    const other = screen.getByRole('button', { name: /项目二/ })
    expect(other).toBeEnabled()
    expect(other.className).not.toContain('bg-violet-soft')
  })

  it('Windows 反斜杠路径：当前项目同样高亮（修复前恒不选中）', async () => {
    mount('project-win', ['D:\\Code\\workspace\\project-win', 'D:\\Code\\workspace\\project-other'])
    const active = await screen.findByRole('button', { name: /项目一/ })
    await waitFor(() => expect(active).toBeDisabled())
    expect(active.className).toContain('bg-violet-soft')
    expect(screen.getByText(/编辑中/)).toBeInTheDocument()

    const other = screen.getByRole('button', { name: /项目二/ })
    expect(other).toBeEnabled()
  })

  it('activeProjectId 不匹配任何项目时：无选中项、无「编辑中」', async () => {
    mount('project-gone', ['/ws/project-p1'])
    const item = await screen.findByRole('button', { name: /项目一/ })
    expect(item).toBeEnabled()
    expect(item.className).not.toContain('bg-violet-soft')
    expect(screen.queryByText(/编辑中/)).not.toBeInTheDocument()
  })
})

describe('ProjectNav · 改名与删除（B-19）', () => {
  it('改名：菜单 → 改名 → 行内输入 Enter，调用 renameProject 并收起输入框', async () => {
    const renameProject = vi.fn(async (_dir: string, title: string) => ({ ok: true as const, title }))
    mount('project-p1', ['/ws/project-p1', '/ws/project-p2'], { renameProject })
    await screen.findByRole('button', { name: /项目二/ })

    fireEvent.click(screen.getAllByLabelText('更多操作')[1]) // 项目二 行
    fireEvent.click(await screen.findByRole('menuitem', { name: '改名' }))
    const input = (await screen.findByPlaceholderText('项目名（Enter 确认）')) as HTMLInputElement
    expect(input.value).toBe('项目二')

    fireEvent.change(input, { target: { value: '  新名字  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(renameProject).toHaveBeenCalledWith('/ws/project-p2', '新名字'))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('项目名（Enter 确认）')).not.toBeInTheDocument(),
    )
  })

  it('删除非当前项目：确认条 → 确认删除，调用 deleteProject 并收起确认条', async () => {
    const deleteProject = vi.fn(async (_dir: string) => ({ ok: true as const }))
    mount('project-p1', ['/ws/project-p1', '/ws/project-p2'], { deleteProject })
    await screen.findByRole('button', { name: /项目二/ })

    fireEvent.click(screen.getAllByLabelText('更多操作')[1])
    fireEvent.click(await screen.findByRole('menuitem', { name: '删除' }))
    expect(await screen.findByText(/删除「项目二」/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith('/ws/project-p2'))
    await waitFor(() => expect(screen.queryByText(/删除「项目二」/)).not.toBeInTheDocument())
  })

  it('当前项目：删除入口禁用并提示先切换', async () => {
    mount('project-p1', ['/ws/project-p1', '/ws/project-p2'])
    await screen.findByRole('button', { name: /项目一/ })

    fireEvent.click(screen.getAllByLabelText('更多操作')[0]) // 项目一 为当前项
    const del = await screen.findByRole('menuitem', { name: '删除' })
    expect(del).toBeDisabled()
    expect(del.title).toContain('先切换')
  })

  it('取消删除：不打 deleteProject，确认条消失', async () => {
    const deleteProject = vi.fn(async (_dir: string) => ({ ok: true as const }))
    mount('project-active', ['/ws/project-p1'], { deleteProject }) // 无当前项匹配
    await screen.findByRole('button', { name: /项目一/ })

    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(await screen.findByRole('menuitem', { name: '删除' }))
    expect(await screen.findByText(/将移入回收站/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(deleteProject).not.toHaveBeenCalled()
    expect(screen.queryByText(/将移入回收站/)).not.toBeInTheDocument()
  })
})
