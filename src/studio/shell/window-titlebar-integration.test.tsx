// feature-804 · StudioApp 顶栏平台门禁集成（契约 §8.3）
// win32：三按钮可见、header 为 pl-3；darwin：无窗口控制、header 保持 pl-20。
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasNode } from '@shared/types'
import StudioApp from './StudioApp'

function emptyCanvas(): Canvas {
  return {
    schemaVersion: 2, projectId: 'p1', title: '', nodes: [], edges: [], gates: [],
    updatedAt: new Date().toISOString(),
  }
}

function canvasNode(partial: Partial<CanvasNode> & Pick<CanvasNode, 'id' | 'step' | 'kind' | 'title' | 'status'>): CanvasNode {
  return { ref: { path: `${partial.id}.json`, format: 'json' }, updatedAt: new Date().toISOString(), ...partial }
}

function installApi(platform: 'darwin' | 'win32' | 'linux', canvas: Canvas = emptyCanvas()) {
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
      get: vi.fn(async () => canvas),
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
    // feature-005：CaptureBar 挂载桥（空库 + 无推送；本套件不操作口径条）
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
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

// feature-013 · 顶栏 STAGE 0 tooltip 统计口径（与左栏徽标同源派生；零新 IPC）
describe('feature-013 · StudioApp STAGE 0 tooltip', () => {
  afterEach(() => { vi.restoreAllMocks() })

  async function findStage0Button(container: HTMLElement): Promise<HTMLElement> {
    return waitFor(() => {
      const el = container.querySelector('[data-stp="0"]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
  }

  it('已发布 + 有脏：立项 vN · X 产物已对齐 · Y 待处理（vN 取 brief 与 dirty 较大值）', async () => {
    const c = emptyCanvas()
    c.nodes = [
      canvasNode({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done', meta: { version: 'v3' } }),
      canvasNode({
        id: 'step-1-outline', step: '1', kind: 'outline', title: '大纲', status: 'done',
        parentReference: { briefVersion: 3, fields: ['premise.leads'] },
      }),
      canvasNode({
        id: 'step-2-scenes', step: '2', kind: 'scenes', title: '分场', status: 'done',
        parentReference: { briefVersion: 2, fields: ['fiveElements.episodeCount'] },
        dirty: {
          sinceBriefVersion: 2, latestBriefVersion: 4, fields: ['fiveElements.episodeCount'],
          severity: 'medium', impactReport: '影响清单.v2-v4.json',
        },
      }),
    ]
    installApi('darwin', c)
    const { container } = render(<StudioApp />)
    const btn = await findStage0Button(container)
    expect(btn.getAttribute('title')).toBe('立项 v4 · 1 产物已对齐 · 1 待处理')
    await act(async () => undefined)
  })

  it('未发布：tooltip 保持现状 STAGE 0 · 立项 文案', async () => {
    installApi('darwin')
    const { container } = render(<StudioApp />)
    const btn = await findStage0Button(container)
    expect(btn.getAttribute('title')).toBe('STAGE 0 · 立项')
    await act(async () => undefined)
  })
})
