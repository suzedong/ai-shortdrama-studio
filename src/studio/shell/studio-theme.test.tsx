import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas } from '@shared/types'
import StudioApp from './StudioApp'

function emptyCanvas(): Canvas {
  return {
    schemaVersion: 3,
    projectId: 'p1',
    title: '主题测试',
    nodes: [],
    edges: [],
    gates: [],
    revision: 0,
    receipts: [],
    updatedAt: new Date().toISOString(),
  }
}

function installApi() {
  const canvas = emptyCanvas()
  window.api = {
    runtime: {
      status: vi.fn(async () => ({ state: 'stopped', port: null, version: null, healthy: false, startedAt: null, error: null })),
      start: vi.fn(async () => ({ state: 'stopped', port: null, version: null, healthy: false, startedAt: null, error: null })),
      createSession: vi.fn(async () => ({ id: 'sess-theme', title: null, createdAt: new Date().toISOString() })),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      abortSession: vi.fn(async () => ({ ok: true as const })),
      sessionMessages: vi.fn(async () => []),
      promptAsync: vi.fn(async () => ({ accepted: true as const, messageId: 'm1' })),
      onEvent: vi.fn(() => () => undefined),
    },
    canvas: {
      get: vi.fn(async () => canvas),
      command: vi.fn(),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      onChange: vi.fn(() => () => undefined),
    },
    asset: { list: vi.fn(async () => []) },
    gate: {
      decide: vi.fn(async () => ({ ok: true as const })),
      onChanged: vi.fn(() => () => undefined),
    },
    listProjects: vi.fn(async () => []),
    createProject: vi.fn(async () => ({ dir: '/ws/p' })),
    openProject: vi.fn(async () => ({ ok: true as const, activeSessionId: null as string | null })),
    activeSession: vi.fn(async () => ({ sessionId: null as string | null })),
    settings: {
      ai: {
        get: vi.fn(async () => ({
          activeProvider: 'ark',
          ark: { model: 'doubao-pro-32k' },
          lmstudio: { model: 'local-model' },
        })),
        update: vi.fn(),
      },
    },
    fileRead: vi.fn(async () => ({ ok: false as const, error: { code: 'X', message: 'x' } })),
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
  } as unknown as Window['api']
}

let previousApi: Window['api'] | undefined

beforeEach(() => {
  previousApi = window.api
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
  installApi()
})

afterEach(() => {
  if (previousApi !== undefined) window.api = previousApi
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
  vi.restoreAllMocks()
})

describe('feature-817 · 全工作台双主题', () => {
  it('无存储与非法值都落回浅色，不跟随系统主题', async () => {
    const first = render(<StudioApp />)
    expect(await screen.findByRole('button', { name: '切换到深色主题' })).toHaveAttribute('data-theme-toggle', 'light')
    expect(document.documentElement).not.toHaveClass('dark')
    await waitFor(() => expect(window.localStorage.getItem('studio.theme')).toBe('light'))
    first.unmount()

    window.localStorage.setItem('studio.theme', 'sepia')
    render(<StudioApp />)
    expect(await screen.findByRole('button', { name: '切换到深色主题' })).toHaveAttribute('data-theme-toggle', 'light')
    expect(document.documentElement).not.toHaveClass('dark')
    await waitFor(() => expect(window.localStorage.getItem('studio.theme')).toBe('light'))
  })

  it('切换同步 html.dark 与 localStorage，重挂载恢复深色', async () => {
    const first = render(<StudioApp />)
    fireEvent.click(await screen.findByRole('button', { name: '切换到深色主题' }))

    expect(screen.getByRole('button', { name: '切换到浅色主题' })).toHaveAttribute('data-theme-toggle', 'dark')
    expect(document.documentElement).toHaveClass('dark')
    await waitFor(() => expect(window.localStorage.getItem('studio.theme')).toBe('dark'))
    first.unmount()

    render(<StudioApp />)
    expect(await screen.findByRole('button', { name: '切换到浅色主题' })).toHaveAttribute('data-theme-toggle', 'dark')
    expect(document.documentElement).toHaveClass('dark')

    fireEvent.click(screen.getByRole('button', { name: '切换到浅色主题' }))
    expect(document.documentElement).not.toHaveClass('dark')
    await waitFor(() => expect(window.localStorage.getItem('studio.theme')).toBe('light'))
  })

  it('localStorage 不可用时仍可在当前会话切换', async () => {
    const getItem = Storage.prototype.getItem
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'studio.theme') throw new Error('blocked')
      return getItem.call(this, key)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'studio.theme') throw new Error('blocked')
      return setItem.call(this, key, value)
    })

    render(<StudioApp />)
    const toggle = await screen.findByRole('button', { name: '切换到深色主题' })
    expect(document.documentElement).not.toHaveClass('dark')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: '切换到浅色主题' })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
  })
})
