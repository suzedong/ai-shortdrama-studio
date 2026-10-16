// B-18 修复 · ProjectNav 选中态跨平台路径兼容
// activeProjectId 是项目目录 basename；Windows 真实路径为反斜杠（path.join 产物），
// mock/旧夹具为正斜杠——两种分隔符下当前项目都必须呈现选中态。
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ProjectNav from './ProjectNav'

const now = new Date().toISOString()

const CN_NUM = ['一', '二', '三']

function mount(activeId: string, dirs: string[]): void {
  window.api = {
    listProjects: vi.fn(async () =>
      dirs.map((dir, i) => ({
        dir,
        name: `项目${CN_NUM[i]}`,
        updatedAt: now,
      })),
    ),
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
