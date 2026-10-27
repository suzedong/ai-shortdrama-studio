// feature-007 · 产物重开对齐二次确认（契约 §5 四组断言）
// ① buildRealignPrompt 固定模板逐字；② RealignConfirm 三选一组件；
// ③ StudioViewer 脏读黄条；④ StudioApp 集成七例（拦截 / 三路径 / 直通 / 复位）。
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasNode, StepId } from '@shared/types'
import type { RuntimeEvent } from '../lib/runtime-types'
import RealignConfirm, { buildRealignPrompt } from './RealignConfirm'
import StudioViewer from './StudioViewer'
import StudioApp from './StudioApp'

/* ── 夹具 ── */

const DIRTY = {
  sinceBriefVersion: 2,
  latestBriefVersion: 3,
  fields: ['premise.seasonBoundary', 'fiveElements.episodeCount'],
  severity: 'high' as const,
  impactReport: '影响清单.v2-v3.json',
}

function dirtyOutlineNode(): CanvasNode {
  return {
    id: 'step-1-outline', step: '1' as StepId, kind: 'outline', title: '都市女频大纲', status: 'done',
    ref: { path: '故事/故事大纲.json', format: 'json' },
    updatedAt: '2026-10-21T00:00:00.000Z',
    dirty: { ...DIRTY, fields: [...DIRTY.fields] },
  }
}

function cleanScenesNode(): CanvasNode {
  return {
    id: 'step-2-scenes', step: '2' as StepId, kind: 'scenes', title: '首集分场稿', status: 'done',
    ref: { path: '分场/scenes.json', format: 'json' },
    updatedAt: '2026-10-21T00:00:00.000Z',
  }
}

const PROMPT_INPUT = {
  nodeId: 'step-1-outline',
  title: '都市女频大纲',
  sinceBriefVersion: 2,
  latestBriefVersion: 3,
  fields: ['premise.seasonBoundary', 'fiveElements.episodeCount'],
}

// StudioViewer 按 kind 路由专属结构化视图：fileRead 假数据必须匹配 schema
// （outline → StoryOutline 需 themes/conflicts/episodes 数组；scenes → Scene[] 数组）
const OUTLINE_JSON = JSON.stringify({
  logline: '测试 logline', seasonArc: '测试主线', themes: [], conflicts: [], episodes: [],
})
const SCENES_JSON = '[]'

function fileReadResult(path: string) {
  const content = path === '故事/故事大纲.json' ? OUTLINE_JSON : SCENES_JSON
  return { ok: true as const, content, format: 'json' as const }
}

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  user = userEvent.setup()
})

/* ── ① buildRealignPrompt 固定模板 ── */

describe('feature-007 · buildRealignPrompt（契约 §1.1）', () => {
  it('输出 = 固定模板逐字：版本插值 + 字段中文化顿号分隔 + align 指令字面值', () => {
    expect(buildRealignPrompt(PROMPT_INPUT)).toBe(
      `【产物重新对齐】产物「都市女频大纲」（节点 step-1-outline）当前基于立项 v2，与最新立项 v3 不一致，命中字段：季边界、集数。请按最新立项单 v3 重新生成该产物：按再版剧本第 6 步纪律串行委派专职 agent（交接物写明旧产物基于 v2、命中字段），重生成定稿后调 shortdrama_canvas.align({ nodeId: 'step-1-outline' }) 清脏并推进血缘。`,
    )
  })

  it('未收录字段点路径回退原文；单字段无顿号', () => {
    const out = buildRealignPrompt({ ...PROMPT_INPUT, fields: ['premise.place', 'unknown.field'] })
    expect(out).toContain('命中字段：地点、unknown.field。')
    const single = buildRealignPrompt({ ...PROMPT_INPUT, fields: ['fiveElements.genre'] })
    expect(single).toContain('命中字段：题材。')
  })
})

/* ── ② RealignConfirm 三选一组件 ── */

describe('feature-007 · RealignConfirm 组件（契约 §3.1）', () => {
  it('全字段口径上屏；三按钮分触三回调各一次', async () => {
    const onRealign = vi.fn()
    const onKeepView = vi.fn()
    const onCancel = vi.fn()
    render(<RealignConfirm node={dirtyOutlineNode()} onRealign={onRealign} onKeepView={onKeepView} onCancel={onCancel} />)

    const dialog = screen.getByRole('dialog', { name: '产物重新对齐' })
    expect(within(dialog).getByText('故事大纲 · 都市女频大纲')).toBeInTheDocument()
    expect(within(dialog).getByText('当前基于立项 v2 · 最新立项 v3')).toBeInTheDocument()
    expect(within(dialog).getByText('命中字段：季边界、集数')).toBeInTheDocument()
    expect(within(dialog).getByText('影响等级：高 · 建议重新生成')).toBeInTheDocument()
    expect(within(dialog).getByText('影响清单：影响清单.v2-v3.json')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '按 v3 重新对齐' }))
    await user.click(within(dialog).getByRole('button', { name: '保持现状查看' }))
    await user.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(onRealign).toHaveBeenCalledTimes(1)
    expect(onKeepView).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('medium severity 提示「可按需对齐」；无 impactReport 不渲染影响清单行', () => {
    const node = dirtyOutlineNode()
    node.dirty = { ...node.dirty!, severity: 'medium', impactReport: '' }
    render(<RealignConfirm node={node} onRealign={() => {}} onKeepView={() => {}} onCancel={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: '产物重新对齐' })
    expect(within(dialog).getByText('影响等级：中 · 可按需对齐')).toBeInTheDocument()
    expect(within(dialog).queryByText(/影响清单：/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '按 v3 重新对齐' })).toBeInTheDocument()
  })

  it('无 dirty 节点：组件渲染为空（契约 dirty 非空前提守卫）', () => {
    const { container } = render(
      <RealignConfirm node={cleanScenesNode()} onRealign={() => {}} onKeepView={() => {}} onCancel={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

/* ── ③ StudioViewer 脏读黄条 ── */

describe('feature-007 · StudioViewer 脏读黄条（契约 §3.4）', () => {
  function installViewerApi() {
    window.api = {
      fileRead: vi.fn(async ({ path }: { path: string }) => fileReadResult(path)),
    } as unknown as Window['api']
  }

  it('dirty 节点：黄条简版文案上屏；一键对齐钮调 onRequestAlign 一次', async () => {
    installViewerApi()
    const onRequestAlign = vi.fn()
    render(<StudioViewer node={dirtyOutlineNode()} kindLabel="故事大纲" onClose={() => {}} onRequestAlign={onRequestAlign} />)

    expect(await screen.findByText('当前基于 v2 立项，与最新 v3 不一致：季边界、集数')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '一键对齐' }))
    expect(onRequestAlign).toHaveBeenCalledTimes(1)
  })

  it('无 dirty 节点：无黄条无一键对齐钮', async () => {
    installViewerApi()
    render(<StudioViewer node={cleanScenesNode()} kindLabel="第一集分场" onClose={() => {}} onRequestAlign={() => {}} />)
    expect(await screen.findByText('分场/scenes.json')).toBeInTheDocument()
    expect(screen.queryByText(/当前基于 v\d+ 立项，与最新 v\d+ 不一致/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '一键对齐' })).not.toBeInTheDocument()
  })

  it('未传 onRequestAlign：黄条在但无钮', async () => {
    installViewerApi()
    render(<StudioViewer node={dirtyOutlineNode()} kindLabel="故事大纲" onClose={() => {}} />)
    expect(await screen.findByText('当前基于 v2 立项，与最新 v3 不一致：季边界、集数')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '一键对齐' })).not.toBeInTheDocument()
  })
})

/* ── ④ StudioApp 集成七例 ── */

interface AppHarness {
  emitCanvas: (c: Canvas) => void
  promptAsync: ReturnType<typeof vi.fn>
  fileRead: ReturnType<typeof vi.fn>
}

function installAppApi(initial: Canvas): AppHarness {
  const runtimeCbs = new Set<(e: RuntimeEvent) => void>()
  const canvasCbs = new Set<(c: Canvas) => void>()
  const promptAsync = vi.fn(async () => ({ accepted: true as const, messageId: 'msg-1' }))
  const fileRead = vi.fn(async ({ path }: { path: string }) => fileReadResult(path))

  window.api = {
    runtime: {
      status: vi.fn(async () => ({ state: 'running', port: 0, version: '1.18.34', healthy: true, startedAt: null, error: null })),
      start: vi.fn(async () => ({ state: 'running', port: 0, version: '1.18.34', healthy: true, startedAt: null, error: null })),
      createSession: vi.fn(async () => ({ id: 'sess-1', title: null, createdAt: new Date().toISOString() })),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      abortSession: vi.fn(async () => ({ ok: true as const })),
      sessionMessages: vi.fn(async () => []),
      promptAsync,
      onEvent: vi.fn(cb => { runtimeCbs.add(cb); return () => runtimeCbs.delete(cb) }),
    },
    canvas: {
      get: vi.fn(async () => initial),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      onChange: vi.fn(cb => { canvasCbs.add(cb); return () => canvasCbs.delete(cb) }),
    },
    gate: {
      decide: vi.fn(async () => ({ ok: true as const })),
      onChanged: vi.fn(() => () => undefined),
    },
    listProjects: vi.fn(async () => []),
    createProject: vi.fn(async () => ({ dir: '/ws/project-p2' })),
    openProject: vi.fn(async () => ({ ok: true as const, activeSessionId: null as string | null })),
    activeSession: vi.fn(async () => ({ sessionId: null as string | null })),
    fileRead,
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
  } as unknown as Window['api']

  return {
    promptAsync,
    fileRead,
    emitCanvas: c => act(() => {
      for (const cb of canvasCbs) cb(c)
    }),
  }
}

function appCanvas(projectId = 'p1'): Canvas {
  return {
    schemaVersion: 2, projectId, title: '测试项目',
    nodes: [dirtyOutlineNode(), cleanScenesNode()], edges: [], gates: [],
    updatedAt: new Date().toISOString(),
  }
}

function nodeCard(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`[data-node-id="${id}"]`)
  if (!el) throw new Error(`node card ${id} not found`)
  return el as HTMLElement
}

describe('feature-007 · StudioApp 集成（契约 §5 ④）', () => {
  it('① dirty 节点打开 → 确认出现且查看器未开（零 fileRead）', async () => {
    const h = installAppApi(appCanvas())
    const { container } = render(<StudioApp />)
    await screen.findByText('都市女频大纲')

    await user.click(nodeCard(container, 'step-1-outline'))
    expect(await screen.findByRole('dialog', { name: '产物重新对齐' })).toBeInTheDocument()
    expect(screen.getByText('当前基于立项 v2 · 最新立项 v3')).toBeInTheDocument()
    expect(h.fileRead).not.toHaveBeenCalled()
    expect(screen.queryByText('故事/故事大纲.json')).not.toBeInTheDocument()
  })

  it('② 保持现状查看 → 确认关 + 查看器开 + 黄条显', async () => {
    const h = installAppApi(appCanvas())
    const { container } = render(<StudioApp />)
    await screen.findByText('都市女频大纲')

    await user.click(nodeCard(container, 'step-1-outline'))
    await user.click(await screen.findByRole('button', { name: '保持现状查看' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.fileRead).toHaveBeenCalledWith({ path: '故事/故事大纲.json' })
    expect(await screen.findByText('当前基于 v2 立项，与最新 v3 不一致：季边界、集数')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一键对齐' })).toBeInTheDocument()
  })

  it('③④ 查看器一键对齐 → 确认再现；重新对齐 → 模板消息注入且确认与查看器均关', async () => {
    const h = installAppApi(appCanvas())
    const { container } = render(<StudioApp />)
    await screen.findByText('都市女频大纲')

    // 保持现状进查看器 → 一键对齐再唤起同一确认（查看器保持背景）
    await user.click(nodeCard(container, 'step-1-outline'))
    await user.click(await screen.findByRole('button', { name: '保持现状查看' }))
    await user.click(await screen.findByRole('button', { name: '一键对齐' }))
    expect(await screen.findByRole('dialog', { name: '产物重新对齐' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '按 v3 重新对齐' }))
    await waitFor(() => expect(h.promptAsync).toHaveBeenCalledTimes(1))
    const sent = h.promptAsync.mock.calls[0][0] as { sessionId: string; text: string; agent: string }
    expect(sent.agent).toBe('showrunner')
    expect(sent.text).toBe(buildRealignPrompt(PROMPT_INPUT))
    expect(sent.text.startsWith('【产物重新对齐】')).toBe(true)
    // 确认与查看器均关
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('故事/故事大纲.json')).not.toBeInTheDocument()
  })

  it('⑤ 取消 → 确认关、查看器未开、零消息', async () => {
    const h = installAppApi(appCanvas())
    const { container } = render(<StudioApp />)
    await screen.findByText('都市女频大纲')

    await user.click(nodeCard(container, 'step-1-outline'))
    await user.click(await screen.findByRole('button', { name: '取消' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.fileRead).not.toHaveBeenCalled()
    expect(h.promptAsync).not.toHaveBeenCalled()
    expect(screen.queryByText('故事/故事大纲.json')).not.toBeInTheDocument()
  })

  it('⑥ 无脏节点 → 直通查看器零确认', async () => {
    const h = installAppApi(appCanvas())
    const { container } = render(<StudioApp />)
    await screen.findByText('首集分场稿')

    await user.click(nodeCard(container, 'step-2-scenes'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.fileRead).toHaveBeenCalledWith({ path: '分场/scenes.json' })
    expect(await screen.findByText('分场/scenes.json')).toBeInTheDocument()
    // 无脏 → 查看器无黄条无钮
    expect(screen.queryByRole('button', { name: '一键对齐' })).not.toBeInTheDocument()
  })

  it('⑦ 切项目（projectId 变化）→ 确认与查看器同复位', async () => {
    const h = installAppApi(appCanvas())
    const { container } = render(<StudioApp />)
    await screen.findByText('都市女频大纲')

    // 确认挂起态：同项目推送不关；切项目即关
    await user.click(nodeCard(container, 'step-1-outline'))
    expect(await screen.findByRole('dialog', { name: '产物重新对齐' })).toBeInTheDocument()
    h.emitCanvas(appCanvas('p1'))
    expect(screen.getByRole('dialog', { name: '产物重新对齐' })).toBeInTheDocument()
    h.emitCanvas(appCanvas('p2'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // 查看器 + 黄条态：切项目同复位
    h.emitCanvas(appCanvas('p1'))
    await user.click(nodeCard(container, 'step-1-outline'))
    await user.click(await screen.findByRole('button', { name: '保持现状查看' }))
    expect(await screen.findByText('当前基于 v2 立项，与最新 v3 不一致：季边界、集数')).toBeInTheDocument()
    h.emitCanvas(appCanvas('p2'))
    expect(screen.queryByText('故事/故事大纲.json')).not.toBeInTheDocument()
    expect(screen.queryByText(/当前基于 v2 立项/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
