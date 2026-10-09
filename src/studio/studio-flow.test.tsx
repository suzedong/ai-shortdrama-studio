// feature-019 C7 · renderer 驱动测试（契约 §4，需求 AC-2/AC-3/AC-4）
// 发送（agent:'showrunner'）→ 流式文本 → GateCard 挂载 → 裁决推进 → 画布更新。
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasGate } from '@shared/types'
import type { RuntimeEvent } from '../lib/runtime-types'
import StudioApp from './StudioApp'

interface Harness {
  emitRuntime: (e: RuntimeEvent) => void
  emitCanvas: (c: Canvas) => void
  emitGate: (g: CanvasGate) => void
  promptAsync: ReturnType<typeof vi.fn>
  decide: ReturnType<typeof vi.fn>
}

function emptyCanvas(title = ''): Canvas {
  return {
    schemaVersion: 2, projectId: 'p1', title, nodes: [], edges: [], gates: [],
    updatedAt: new Date().toISOString(),
  }
}

function installApi(initial: Canvas): Harness {
  const runtimeCbs = new Set<(e: RuntimeEvent) => void>()
  const canvasCbs = new Set<(c: Canvas) => void>()
  const gateCbs = new Set<(e: { gate: CanvasGate }) => void>()

  const promptAsync = vi.fn(async () => ({ accepted: true as const, messageId: 'msg-1' }))
  const decide = vi.fn(async () => ({ ok: true as const }))

  window.api = {
    runtime: {
      status: vi.fn(async () => ({ state: 'running', port: 0, version: '1.18.34', healthy: true, startedAt: null, error: null })),
      start: vi.fn(async () => ({ state: 'running', port: 0, version: '1.18.34', healthy: true, startedAt: null, error: null })),
      createSession: vi.fn(async () => ({ id: 'sess-1', title: null, createdAt: new Date().toISOString() })),
      subscribe: vi.fn(async () => ({ ok: true as const })),
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
      decide,
      onChanged: vi.fn(cb => { gateCbs.add(cb); return () => gateCbs.delete(cb) }),
    },
    // feature-022：项目导航 + 只读产物查看
    listProjects: vi.fn(async () => [
      { dir: '/ws/project-p1', name: '项目一', updatedAt: new Date().toISOString() },
    ]),
    createProject: vi.fn(async () => ({ dir: '/ws/project-p2' })),
    openProject: vi.fn(async () => ({ ok: true as const })),
    fileRead: vi.fn(async () => ({ ok: true as const, content: '{"a":1}', format: 'json' as const })),
  } as unknown as Window['api']

  return {
    promptAsync, decide,
    emitRuntime: e => act(() => runtimeCbs.forEach(cb => cb(e))),
    emitCanvas: c => act(() => canvasCbs.forEach(cb => cb(c))),
    emitGate: g => act(() => gateCbs.forEach(cb => cb({ gate: g }))),
  }
}

function gate0a(status: CanvasGate['status'] = 'pending'): CanvasGate {
  return {
    gateId: '0-a', status,
    question: '是否认可这份选题诊断？',
    options: ['结论与对标合理', '钩子模式成立'],
  }
}

function canvasWithDiagnosis(): Canvas {
  const c = emptyCanvas('测试项目')
  c.nodes = [{
    id: 'step-0-diagnosis', step: '0', kind: 'diagnosis', title: '重生复仇：选题诊断', status: 'done',
    ref: { path: '立项/diagnosis.json', format: 'json' }, updatedAt: new Date().toISOString(),
  }]
  return c
}

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  vi.clearAllMocks()
  user = userEvent.setup()
})

describe('C7 · StudioApp 立项驱动', () => {
  it('发送指定 showrunner 且不传 tools；用户气泡上屏', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)

    await user.type(screen.getByPlaceholderText(/描述你的短剧灵感/), '重生复仇都市女频')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(h.promptAsync).toHaveBeenCalledWith({
      sessionId: 'sess-1', text: '重生复仇都市女频', agent: 'showrunner',
    })
    const req = h.promptAsync.mock.calls[0][0] as { tools?: unknown }
    expect(req.tools).toBeUndefined()
    expect(screen.getByText('重生复仇都市女频')).toBeInTheDocument()
  })

  it('流式文本 → GateCard 挂载 → approved 裁决 → 画布节点更新', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText('未命名项目')

    h.emitRuntime({
      type: 'message.part', ts: '', sessionId: 'sess-1', messageId: 'msg-1', partId: 'p1',
      part: { kind: 'text', text: '我已完成选题诊断。' },
    })
    expect(screen.getByText('我已完成选题诊断。')).toBeInTheDocument()

    h.emitGate(gate0a('pending'))
    expect(screen.getByText('是否认可这份选题诊断？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认放行' }))
    expect(h.decide).toHaveBeenCalledWith({ gateId: '0-a', decision: 'approved' })

    h.emitCanvas(canvasWithDiagnosis())
    expect(screen.getByText('重生复仇：选题诊断')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()

    h.emitRuntime({ type: 'session.idle', ts: '', sessionId: 'sess-1' })
    expect(screen.getByText('我已完成选题诊断。')).toBeInTheDocument()
  })

  it('rejected：带 note 提交否决', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText('未命名项目')

    h.emitGate(gate0a('pending'))
    await user.click(screen.getByRole('button', { name: '否决 / 重做' }))
    await user.type(screen.getByPlaceholderText(/填写修改意见/), '对标案例不够贴近女频')
    await user.click(screen.getByRole('button', { name: '提交否决' }))

    expect(h.decide).toHaveBeenCalledWith({
      gateId: '0-a', decision: 'rejected', note: '对标案例不够贴近女频',
    })
  })

  it('runtime 未运行时惰性启动；启动失败展示可展示文案', async () => {
    const initial = emptyCanvas()
    installApi(initial)
    const failedStatus = {
      state: 'error' as const, port: null, version: null, healthy: false, startedAt: null,
      error: { code: 'RUNTIME_START_FAILED' as const, message: '启动失败' },
    }
    window.api.runtime.status = vi.fn(async () => failedStatus)
    window.api.runtime.start = vi.fn(async () => failedStatus)
    render(<StudioApp />)

    await user.type(screen.getByPlaceholderText(/描述你的短剧灵感/), '测试')
    await user.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('启动失败')).toBeInTheDocument()
  })
})

// feature-022 · 三栏布局 / 项目导航 / 只读产物查看（AC-2/AC-3）
describe('feature-022 · 三栏与产物查看', () => {
  it('三栏齐出：项目导航 + 画布 + 对话区', async () => {
    installApi(emptyCanvas())
    render(<StudioApp />)
    expect(screen.getByText('项目')).toBeInTheDocument()
    expect(screen.getByText(/还没有任何产物/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/描述你的短剧灵感/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '返回旧版' })).not.toBeInTheDocument()
  })

  it('项目列表渲染；点击调用 openProject', async () => {
    installApi(emptyCanvas())
    render(<StudioApp />)
    const item = await screen.findByRole('button', { name: '项目一' })
    await user.click(item)
    expect(window.api.openProject).toHaveBeenCalledWith('/ws/project-p1')
  })

  it('新建项目：createProject → openProject 串联', async () => {
    installApi(emptyCanvas())
    render(<StudioApp />)
    await user.click(screen.getByRole('button', { name: '+ 新建项目' }))
    await user.type(screen.getByPlaceholderText(/项目名/), '我的新剧')
    await user.click(screen.getByRole('button', { name: '确认新建' }))
    expect(window.api.createProject).toHaveBeenCalledWith('我的新剧')
    expect(window.api.openProject).toHaveBeenCalledWith('/ws/project-p2')
  })

  it('点击有 ref.path 的节点 → fileRead 打开只读查看器；关闭后消失', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText('未命名项目')

    h.emitCanvas(canvasWithDiagnosis())
    const node = await screen.findByText('重生复仇：选题诊断')
    await user.click(node)

    expect(window.api.fileRead).toHaveBeenCalledWith({ path: '立项/diagnosis.json' })
    // JSON 美化后包含换行展开
    expect(await screen.findByText(/"a": 1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByText(/"a": 1/)).not.toBeInTheDocument()
  })

  it('fileRead 拒绝时查看器呈现错误提示态', async () => {
    const h = installApi(emptyCanvas())
    window.api.fileRead = vi.fn(async () => ({
      ok: false as const, error: { code: 'NOT_FOUND', message: '产物文件不存在' },
    }))
    render(<StudioApp />)
    await screen.findByText('未命名项目')
    h.emitCanvas(canvasWithDiagnosis())
    await user.click(await screen.findByText('重生复仇：选题诊断'))
    expect(await screen.findByText('产物文件不存在')).toBeInTheDocument()
  })

  it('切项目（projectId 变化）时关闭查看器；常规推送不关', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText('未命名项目')
    h.emitCanvas(canvasWithDiagnosis())
    await user.click(await screen.findByText('重生复仇：选题诊断'))
    expect(await screen.findByText(/"a": 1/)).toBeInTheDocument()

    // 同 projectId 的常规推送：viewer 保持
    const same = canvasWithDiagnosis()
    h.emitCanvas(same)
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument()

    // projectId 变化：viewer 关闭
    const other = emptyCanvas('另一个项目')
    other.projectId = 'p2'
    h.emitCanvas(other)
    expect(screen.queryByText(/"a": 1/)).not.toBeInTheDocument()
    expect(await screen.findByText('另一个项目')).toBeInTheDocument()
  })
})
