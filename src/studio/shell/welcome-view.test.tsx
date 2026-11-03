// feature-812：WelcomeView 组件测试（需求 AC1–AC3）
// 只依赖 window.api.listProjects，其余入口以 props 注入，故无需整窗 mock。
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WelcomeView from './WelcomeView'

interface Entry {
  dir: string
  name: string
  updatedAt: string
}

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

function installApi(list: Entry[] | Error): ReturnType<typeof vi.fn> {
  const listProjects = vi.fn(async () => {
    if (list instanceof Error) throw list
    return list
  })
  window.api = { listProjects } as unknown as Window['api']
  return listProjects
}

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  vi.clearAllMocks()
  user = userEvent.setup()
})

describe('feature-812 · WelcomeView', () => {
  it('AC1：标题 / 主 CTA / 八步提示齐备；空库给出新建引导', async () => {
    installApi([])
    render(<WelcomeView onCreate={vi.fn()} onOpen={vi.fn()} />)

    expect(screen.getByText('开始一部短剧')).toBeInTheDocument()
    expect(screen.getByText('＋ 新建项目')).toBeInTheDocument()
    expect(screen.getByText(/0 立项 → 1 故事/)).toBeInTheDocument()
    expect(await screen.findByText('还没有项目，点上方「新建项目」开始。')).toBeInTheDocument()
  })

  it('AC2：点「新建项目」调 onCreate 一次', async () => {
    installApi([])
    const onCreate = vi.fn()
    render(<WelcomeView onCreate={onCreate} onOpen={vi.fn()} />)

    await user.click(screen.getByText('＋ 新建项目'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('AC2：创建失败错误条原样上屏，主 CTA 仍可用', async () => {
    installApi([])
    const onCreate = vi.fn(async () => {
      throw new Error('磁盘已满')
    })
    render(<WelcomeView onCreate={onCreate} onOpen={vi.fn()} />)

    await user.click(screen.getByText('＋ 新建项目'))
    expect(await screen.findByText('磁盘已满')).toBeInTheDocument()
    expect(screen.getByText('＋ 新建项目')).toBeEnabled()
  })

  it('AC3：最近项目按 updatedAt 降序取前 5，点击调 onOpen(dir)', async () => {
    const list: Entry[] = [
      { dir: '/ws/a', name: 'A', updatedAt: minutesAgo(50) },
      { dir: '/ws/b', name: 'B', updatedAt: minutesAgo(5) },
      { dir: '/ws/c', name: 'C', updatedAt: minutesAgo(300) },
      { dir: '/ws/d', name: 'D', updatedAt: minutesAgo(1) },
      { dir: '/ws/e', name: 'E', updatedAt: minutesAgo(1200) },
      { dir: '/ws/f', name: 'F', updatedAt: minutesAgo(2) },
    ]
    installApi(list)
    const onOpen = vi.fn()
    render(<WelcomeView onCreate={vi.fn()} onOpen={onOpen} />)

    await waitFor(() => expect(document.querySelectorAll('[data-welcome-open]')).toHaveLength(5))
    const dirs = Array.from(document.querySelectorAll('[data-welcome-open]')).map(el =>
      el.getAttribute('data-welcome-open'),
    )
    // 1d → 2f → 5b → 50a → 300c；1200e 被截断
    expect(dirs).toEqual(['/ws/d', '/ws/f', '/ws/b', '/ws/a', '/ws/c'])

    await user.click(document.querySelector('[data-welcome-open="/ws/f"]') as HTMLElement)
    expect(onOpen).toHaveBeenCalledWith('/ws/f')
  })

  it('AC3：listProjects 失败降级为错误条，主 CTA 仍可用', async () => {
    installApi(new Error('项目库不可读'))
    render(<WelcomeView onCreate={vi.fn()} onOpen={vi.fn()} />)

    expect(await screen.findByText('项目库不可读')).toBeInTheDocument()
    expect(screen.getByText('＋ 新建项目')).toBeEnabled()
  })
})
