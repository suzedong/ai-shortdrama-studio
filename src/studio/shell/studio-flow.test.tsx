// feature-019 C7 · renderer 驱动测试（契约 §4，需求 AC-2/AC-3/AC-4）
// 发送（agent:'showrunner'）→ 流式文本 → GateCard 挂载 → 裁决推进 → 画布更新。
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasGate } from '@shared/types'
import type { RuntimeEvent } from '../../lib/runtime-types'
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
      decide,
      onChanged: vi.fn(cb => { gateCbs.add(cb); return () => gateCbs.delete(cb) }),
    },
    // 项目导航 + 只读产物查看
    listProjects: vi.fn(async () => [
      { dir: '/ws/project-p1', name: '项目一', updatedAt: new Date().toISOString() },
    ]),
    createProject: vi.fn(async () => ({ dir: '/ws/project-p2' })),
    openProject: vi.fn(async () => ({ ok: true as const, activeSessionId: null as string | null })),
    // feature-808：项目-会话绑定（默认无绑定 → 不回放、不启 runtime）
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
    fileRead: vi.fn(async () => ({ ok: true as const, content: '{"a":1}', format: 'json' as const })), 
    // feature-005：CaptureBar 挂载桥（空库 + 无推送；本套件不操作口径条）
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
  } as unknown as Window['api']

  return {
    promptAsync, decide,
    emitRuntime: e => act(() => runtimeCbs.forEach(cb => cb(e))),
    emitCanvas: c => act(() => canvasCbs.forEach(cb => cb(c))),
    emitGate: g => act(() => gateCbs.forEach(cb => cb({ gate: g }))),
  }
}

function gate0final(status: CanvasGate['status'] = 'pending'): CanvasGate {
  return {
    gateId: '0-final', status,
    question: '立项单 v1 是否可以拍板发布？',
    options: ['发布立项 v1', '再改改'],
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

    await user.type(await screen.findByPlaceholderText(/描述创作目标/), '重生复仇都市女频')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(h.promptAsync).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      text: '重生复仇都市女频',
      agent: 'showrunner',
      model: { providerID: 'ark', modelID: 'doubao-pro-32k' },
    })
    const req = h.promptAsync.mock.calls[0][0] as { tools?: unknown }
    expect(req.tools).toBeUndefined()
    expect(screen.getByText('重生复仇都市女频')).toBeInTheDocument()
  })

  it('流式文本 → GateCard 挂载 → approved 裁决 → 画布节点更新', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText(/未命名项目/)

    // 先发送惰性建会话（绑定 sess-1）；D-007 严格归属后，流式只接受当前绑定 sid
    await user.type(screen.getByPlaceholderText(/描述创作目标/), '做一个重生复仇项目')
    await user.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(h.promptAsync).toHaveBeenCalledTimes(1))

    h.emitRuntime({
      type: 'message.part', ts: '', sessionId: 'sess-1', messageId: 'msg-1', partId: 'p1',
      part: { kind: 'text', text: '我已完成选题诊断。' },
    })
    expect(await screen.findByText('我已完成选题诊断。')).toBeInTheDocument()

    h.emitGate(gate0final('pending'))
    expect(screen.getByText('立项单 v1 是否可以拍板发布？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认放行' }))
    expect(h.decide).toHaveBeenCalledWith({ gateId: '0-final', decision: 'approved' })

    h.emitCanvas(canvasWithDiagnosis())
    expect(screen.getByText('重生复仇：选题诊断')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()

    h.emitRuntime({ type: 'session.idle', ts: '', sessionId: 'sess-1' })
    await waitFor(() =>
      expect(screen.queryByTestId('chat-stop')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('我已完成选题诊断。')).toBeInTheDocument()
  })

  it('rejected：带 note 提交否决', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText(/未命名项目/)

    h.emitGate(gate0final('pending'))
    await user.click(screen.getByRole('button', { name: '否决 / 重做' }))
    await user.type(screen.getByPlaceholderText(/填写修改意见/), '对标案例不够贴近女频')
    await user.click(screen.getByRole('button', { name: '提交否决' }))

    expect(h.decide).toHaveBeenCalledWith({
      gateId: '0-final', decision: 'rejected', note: '对标案例不够贴近女频',
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

    // D-013：进入对话区即探测——启动失败直接以常驻横幅呈现可展示文案并禁用输入，
    // 不再等到发送撞墙；「重新检测」可手动复检
    expect(await screen.findByTestId('chat-ai-down')).toHaveTextContent('启动失败')
    expect(screen.getByPlaceholderText('AI 服务不可用，恢复后可继续对话')).toBeDisabled()
  })
})

// 三栏布局 / 项目导航 / 只读产物查看
describe('三栏与产物查看', () => {
  it('三栏齐出：项目导航 + 中间区 + 对话区（立项空项目自动呈现 Stage0View，B-50）', async () => {
    installApi(emptyCanvas())
    render(<StudioApp />)
    expect(screen.getByText('项目')).toBeInTheDocument()
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()
    expect(screen.queryByText(/还没有任何产物/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/描述创作目标/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '返回旧版' })).not.toBeInTheDocument()
  })

  it('项目列表渲染；点击调用 openProject', async () => {
    installApi(emptyCanvas())
    render(<StudioApp />)
    const item = await screen.findByRole('button', { name: /项目一/ })
    await user.click(item)
    expect(window.api.openProject).toHaveBeenCalledWith('/ws/project-p1')
  })

  it('新建项目：createProject → openProject 串联', async () => {
    installApi(emptyCanvas())
    render(<StudioApp />)
    await user.click(screen.getByRole('button', { name: /新建项目/ }))
    await user.type(screen.getByPlaceholderText(/项目名/), '我的新剧')
    await user.click(screen.getByRole('button', { name: '确认新建' }))
    expect(window.api.createProject).toHaveBeenCalledWith('我的新剧')
    expect(window.api.openProject).toHaveBeenCalledWith('/ws/project-p2')
  })

  it('点击有 ref.path 的节点 → fileRead 打开只读查看器；关闭后消失', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText(/未命名项目/)

    h.emitCanvas(canvasWithDiagnosis())
    const node = await screen.findByText('重生复仇：选题诊断')
    await user.click(node)

    expect(window.api.fileRead).toHaveBeenCalledWith({ path: '立项/diagnosis.json' })
    // diagnosis 走通用 JSON 视图（KV 分栏）：路径条与通用视图标题上屏
    expect(await screen.findByText('立项/diagnosis.json')).toBeInTheDocument()
    expect(screen.getByText('结构化数据（通用视图）')).toBeInTheDocument()

    // 顶栏 WindowControls 也有名为「关闭」的按钮，故限定在查看器根节点内查找
    // closest() 类型签名返回 Element，within() 要求 HTMLElement；运行时该容器必然存在
    const viewerRoot = screen.getByText('立项/diagnosis.json').closest('div.absolute') as HTMLElement
    await user.click(within(viewerRoot).getByRole('button', { name: '关闭' }))
    expect(screen.queryByText('立项/diagnosis.json')).not.toBeInTheDocument()
  })

  it('fileRead 拒绝时查看器呈现错误提示态', async () => {
    const h = installApi(emptyCanvas())
    window.api.fileRead = vi.fn(async () => ({
      ok: false as const, error: { code: 'NOT_FOUND', message: '产物文件不存在' },
    }))
    render(<StudioApp />)
    await screen.findByText(/未命名项目/)
    h.emitCanvas(canvasWithDiagnosis())
    await user.click(await screen.findByText('重生复仇：选题诊断'))
    expect(await screen.findByText('产物文件不存在')).toBeInTheDocument()
  })

  it('切项目（projectId 变化）时关闭查看器；常规推送不关', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findByText(/未命名项目/)
    h.emitCanvas(canvasWithDiagnosis())
    await user.click(await screen.findByText('重生复仇：选题诊断'))
    expect(await screen.findByText('立项/diagnosis.json')).toBeInTheDocument()

    // 同 projectId 的常规推送：viewer 保持
    const same = canvasWithDiagnosis()
    h.emitCanvas(same)
    expect(screen.getByText('立项/diagnosis.json')).toBeInTheDocument()

    // projectId 变化：viewer 关闭（p2 为空项目，B-50 自动进 Stage0View）
    const other = emptyCanvas('另一个项目')
    other.projectId = 'p2'
    h.emitCanvas(other)
    expect(screen.queryByText('立项/diagnosis.json')).not.toBeInTheDocument()
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()
  })
})

// B-50 · 立项期视图自动投影
describe('B-50 · 立项期自动切 Stage0View', () => {
  it('空 nodes 项目进入：中间区呈现 Stage0View；随后节点到达自动回 DAG', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()
    expect(screen.queryByText(/还没有任何产物/)).not.toBeInTheDocument()

    h.emitCanvas(canvasWithDiagnosis())
    expect(await screen.findByText('重生复仇：选题诊断')).toBeInTheDocument()
    expect(screen.queryByText('立项尚未定案')).not.toBeInTheDocument()
    expect(screen.queryByText(/还没有任何产物/)).not.toBeInTheDocument()
  })

  it('初始即有 nodes 的项目：直接停在 DAG，不进 Stage0View', async () => {
    installApi(canvasWithDiagnosis())
    render(<StudioApp />)
    expect(await screen.findByText('重生复仇：选题诊断')).toBeInTheDocument()
    expect(screen.queryByText('立项尚未定案')).not.toBeInTheDocument()
  })

  it('自动投影每项目仅一次：手动「返回画布」后不再被同项目空推送强切', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()

    await user.click(screen.getAllByText('← 返回画布')[0]!)
    expect(await screen.findByText(/还没有任何产物/)).toBeInTheDocument()

    // 同 projectId 的空 nodes 推送：不再强切
    h.emitCanvas(emptyCanvas())
    expect(screen.getByText(/还没有任何产物/)).toBeInTheDocument()
    expect(screen.queryByText('立项尚未定案')).not.toBeInTheDocument()

    // 切到另一个空项目：重新放行
    const other = emptyCanvas('新项目')
    other.projectId = 'p2'
    h.emitCanvas(other)
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()
  })
})

// feature-812 · 无项目态（canvas.projectId === ''，与主进程 canvas:get 兜底形状一致）
function canvasNoProject(): Canvas {
  const c = emptyCanvas()
  c.projectId = ''
  c.title = ''
  return c
}

describe('feature-812 · 无项目态', () => {
  it('AC1/AC5/AC7：中栏欢迎页 + 底栏隐藏 + 标题「未打开项目」', async () => {
    installApi(canvasNoProject())
    render(<StudioApp />)

    expect(await screen.findByText('开始一部短剧')).toBeInTheDocument()
    expect(document.querySelector('[data-view="welcome"]')).toBeTruthy()
    expect(screen.getByText('短剧 Agent · 未打开项目')).toBeInTheDocument()
    expect(document.querySelector('footer')).toBeNull()
    expect(screen.queryByText('火山方舟（文本）')).not.toBeInTheDocument()
    // 误导性空态不得出现
    expect(screen.queryByText(/还没有任何产物/)).not.toBeInTheDocument()
    expect(screen.queryByText('立项尚未定案')).not.toBeInTheDocument()
  })

  it('AC4/AC6：右栏锁定（输入/发送/空态文案），runtime 全桥零调用', async () => {
    installApi(canvasNoProject())
    render(<StudioApp />)

    const box = await screen.findByPlaceholderText('先新建或打开项目再开始对话')
    expect(box).toBeDisabled()
    expect(screen.getByTestId('chat-send')).toBeDisabled()
    expect(screen.getByText('还没有打开项目。先新建一个，或在左栏选择已有项目。')).toBeInTheDocument()

    // 契约 L4：即便事件绕过 disabled，submit 也早退
    fireEvent.keyDown(box, { key: 'Enter' })

    const runtime = window.api.runtime as unknown as Record<string, ReturnType<typeof vi.fn>>
    expect(runtime.status).not.toHaveBeenCalled()
    expect(runtime.start).not.toHaveBeenCalled()
    expect(runtime.createSession).not.toHaveBeenCalled()
    expect(runtime.promptAsync).not.toHaveBeenCalled()
  })

  it('AC4：首拉未回（加载中）也不得放开输入与发送——防止「有内容即可点」的假可用', async () => {
    installApi(canvasNoProject())
    // 卡住 canvas:get：此刻还不知道有没有项目，属于"加载中"而非"无项目"
    ;(window.api.canvas.get as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => undefined),
    )
    render(<StudioApp />)

    const box = screen.getByPlaceholderText('正在载入项目…')
    expect(box).toBeDisabled()
    expect(screen.getByTestId('chat-send')).toBeDisabled()
    expect(screen.getByText('正在读取上次打开的项目，请稍候…')).toBeInTheDocument()

    // 即使绕过 DOM 锁写进草稿，提交路径仍不得放开
    fireEvent.change(box, { target: { value: '重生复仇都市女频' } })
    expect(screen.getByTestId('chat-send')).toBeDisabled()
    fireEvent.keyDown(box, { key: 'Enter' })

    const runtime = window.api.runtime as unknown as Record<string, ReturnType<typeof vi.fn>>
    expect(runtime.createSession).not.toHaveBeenCalled()
    expect(runtime.promptAsync).not.toHaveBeenCalled()
  })

  it('AC7：点 STAGE 0 不切立项视图（八步进度仅展示）', async () => {
    installApi(canvasNoProject())
    render(<StudioApp />)
    await screen.findByText('开始一部短剧')

    await user.click(document.querySelector('[data-stp="0"]') as HTMLElement)
    expect(document.querySelector('[data-view="stage0"]')).toBeNull()
    expect(document.querySelector('[data-view="welcome"]')).toBeTruthy()
  })

  it('AC2：「＋ 新建项目」→ createProject → openProject 串联', async () => {
    installApi(canvasNoProject())
    render(<StudioApp />)
    await screen.findByText('开始一部短剧')

    await user.click(document.querySelector('[data-welcome-create]') as HTMLElement)

    await waitFor(() => expect(window.api.openProject).toHaveBeenCalledWith('/ws/project-p2'))
    expect(window.api.createProject).toHaveBeenCalledTimes(1)
  })
})
