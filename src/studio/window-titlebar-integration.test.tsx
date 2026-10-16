// feature-804 · StudioApp 顶栏平台门禁集成（契约 §8.3）
// win32：三按钮可见、header 为 pl-3；darwin：无窗口控制、header 保持 pl-20。
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas } from '@shared/types'
import StudioApp from './StudioApp'

function emptyCanvas(): Canvas {
  return {
    schemaVersion: 2, projectId: 'p1', title: '', nodes: [], edges: [], gates: [],
    updatedAt: new Date().toISOString(),
  }
}

function installApi(platform: 'darwin' | 'win32' | 'linux') {
  const minimize = vi.fn(async () => ({ ok: true as const }))
  const close = vi.fn(async () => ({ ok: true as const }))
  const toggleMaximize = vi.fn(async () => ({ ok: true as const, maximized: true }))
  const isMaximized = vi.fn(async () => ({ ok: true as const, maximized: false }))
  const onMaximizeChange = vi.fn(() => () => undefined)

  window.api = {
    runtime: {
      status: vi.fn(async () => ({ state: 'stopped', port: null, version: null, healthy: false, startedAt: null, error: null })),
      start: vi.fn(async () => ({ state: 'stopped', port: null, version: null, healthy: false, startedAt: null, error: null })),
      createSession: vi.fn(async () => ({ id: 'sess-1', title: null, createdAt: new Date().toISOString() })),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      abortSession: vi.fn(async () => ({ ok: true as const })),
      sessionMessages: vi.fn(async () => []),
      promptAsync: vi.fn(async () => ({ accepted: true as const, messageId: 'm1' })),
      onEvent: vi.fn(() => () => undefined),
    },
    canvas: {
      get: vi.fn(async () => emptyCanvas()),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      onChange: vi.fn(() => () => undefined),
    },
    gate: {
      decide: vi.fn(async () => ({ ok: true as const })),
      onChanged: vi.fn(() => () => undefined),
    },
    listProjects: vi.fn(async () => []),
    createProject: vi.fn(async () => ({ dir: '/ws/p' })),
    openProject: vi.fn(async () => ({ ok: true as const, activeSessionId: null as string | null })),
    // feature-808：项目-会话绑定（默认无绑定 → 不回放、不启 runtime）
    activeSession: vi.fn(async () => ({ sessionId: null as string | null })),
    fileRead: vi.fn(async () => ({ ok: false as const, error: { code: 'X', message: 'x' } })),
    window: { platform, minimize, toggleMaximize, isMaximized, close, onMaximizeChange },
  } as unknown as Window['api']

  return { minimize, close, toggleMaximize }
}

let previous: Window['api'] | undefined

describe('feature-804 · StudioApp 顶栏平台门禁（契约 §7/§8.3）', () => {
  beforeEach(() => { previous = window.api })
  afterEach(() => {
    if (previous !== undefined) window.api = previous
    vi.restoreAllMocks()
  })

  it("win32：出现三按钮，header 左留白 pl-3、右 pr-0，点击转发 IPC", async () => {
    const stub = installApi('win32')
    const user = userEvent.setup()
    const { container } = render(<StudioApp />)

    const minimizeBtn = await screen.findByRole('button', { name: '最小化' })
    expect(screen.getByRole('button', { name: '最大化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()

    const header = container.querySelector('header')
    expect(header?.className).toContain('pl-3')
    expect(header?.className).toContain('pr-0')
    expect(header?.className).not.toContain('pl-20')

    await user.click(minimizeBtn)
    expect(stub.minimize).toHaveBeenCalledTimes(1)
    await act(async () => undefined)
  })

  it("darwin：不渲染窗口控制，header 保持 pl-20/pr-4", () => {
    installApi('darwin')
    const { container } = render(<StudioApp />)

    expect(screen.queryByRole('group', { name: '窗口控制' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '最小化' })).not.toBeInTheDocument()
    const header = container.querySelector('header')
    expect(header?.className).toContain('pl-20')
    expect(header?.className).toContain('pr-4')
  })

  it("linux：同 win32 渲染三按钮、pl-3", async () => {
    installApi('linux')
    const { container } = render(<StudioApp />)
    expect(await screen.findByRole('button', { name: '最小化' })).toBeInTheDocument()
    expect(container.querySelector('header')?.className).toContain('pl-3')
  })
})
