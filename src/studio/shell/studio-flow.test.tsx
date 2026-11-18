// feature-019 C7 · renderer 驱动测试（契约 §4，需求 AC-2/AC-3/AC-4）
// 发送（agent:'showrunner'）→ 流式文本 → GateCard 挂载 → 裁决推进 → 画布更新。
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetIndexItem, Canvas, CanvasCommandRequest, CanvasGate, CanvasViewStateRequest } from '@shared/types'
import type { RuntimeEvent } from '../../lib/runtime-types'
import StudioApp from './StudioApp'
import { activeDocument, canvasV4, withActiveDocument } from '../../test/canvas-fixtures'

interface Harness {
  emitRuntime: (e: RuntimeEvent) => void
  emitCanvas: (c: Canvas) => void
  emitGate: (g: CanvasGate) => void
  promptAsync: ReturnType<typeof vi.fn>
  decide: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  command: ReturnType<typeof vi.fn>
  viewState: ReturnType<typeof vi.fn>
  assetList: ReturnType<typeof vi.fn>
  assetImport: ReturnType<typeof vi.fn>
  assetThumbnail: ReturnType<typeof vi.fn>
}

function emptyCanvas(title = ''): Canvas {
  return canvasV4({
    projectId: 'p1', title, nodes: [], edges: [], gates: [], activeView: 'stage0',
    revision: 0, receipts: [], updatedAt: new Date().toISOString(),
  })
}

function installApi(initial: Canvas): Harness {
  const runtimeCbs = new Set<(e: RuntimeEvent) => void>()
  const canvasCbs = new Set<(c: Canvas) => void>()
  const gateCbs = new Set<(e: { gate: CanvasGate }) => void>()

  const promptAsync = vi.fn(async () => ({ accepted: true as const, messageId: 'msg-1' }))
  const decide = vi.fn(async () => ({ ok: true as const }))
  const get = vi.fn(async () => initial)
  const command = vi.fn(async (request: CanvasCommandRequest) => ({
    commandId: request.commandId,
    revision: initial.revision,
    canvas: initial,
  }))
  const viewState = vi.fn(async (request: CanvasViewStateRequest) => {
    const canvas = request.type === 'active.set' && request.activeView
      ? { ...initial, activeView: request.activeView }
      : initial
    return {
      ok: true as const,
      target: {
        projectId: canvas.projectId,
        pageId: canvas.activePageId,
        canvasId: activeDocument(canvas).id,
      },
      canvas,
    }
  })
  const assetList = vi.fn(async (_kind: AssetIndexItem['kind']): Promise<AssetIndexItem[]> => [
    { id: 'asset-1', kind: 'image', path: '资产/女主.png', createdAt: '2026-11-10T00:00:00.000Z' },
    { id: 'asset-2', kind: 'image', path: '资产/男主.png', createdAt: '2026-11-10T00:00:00.000Z' },
  ])
  const assetImport = vi.fn(async (): Promise<
    | { status: 'imported'; asset: AssetIndexItem }
    | { status: 'cancelled' }
  > => ({ status: 'cancelled' }))
  const assetThumbnail = vi.fn(async (_assetId: string): Promise<{ dataUrl: string | null }> => ({ dataUrl: null }))

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
      get,
      command,
      viewState,
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      onChange: vi.fn(cb => { canvasCbs.add(cb); return () => canvasCbs.delete(cb) }),
    },
    asset: { list: assetList, import: assetImport, thumbnail: assetThumbnail },
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
          ark: {
            model: 'doubao-pro-32k', baseUrl: 'https://ark.example.com/api/v3', keyConfigured: true,
            sources: { apiKey: 'store' as const, baseUrl: 'store' as const, model: 'store' as const },
          },
          lmstudio: {
            model: 'local-model', baseUrl: 'http://127.0.0.1:1234/v1',
            sources: { baseUrl: 'store' as const, model: 'store' as const },
          },
          runtime: { portRangeStart: 40100, healthTimeoutMs: 20000, mockBaseUrl: '' },
          updatedAt: new Date().toISOString(),
        })),
        update: vi.fn(),
      },
      // feature-820：底栏只陈述配置数量；默认 1 个已启用实例
      comfy: {
        list: vi.fn(async () => [
          { id: 'comfy-1', name: '本机', baseUrl: 'http://127.0.0.1:8188', enabled: true, addedAt: '2026-11-10T00:00:00.000Z' },
        ]),
      },
    },
    fileRead: vi.fn(async () => ({ ok: true as const, content: '{"a":1}', format: 'json' as const })), 
    // feature-005：CaptureBar 挂载桥（空库 + 无推送；本套件不操作口径条）
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
  } as unknown as Window['api']

  return {
    promptAsync, decide, get, command, viewState, assetList, assetImport, assetThumbnail,
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

function canvasWithDiagnosis(activeView: Canvas['activeView'] = 'canvas'): Canvas {
  const c = emptyCanvas('测试项目')
  c.activeView = activeView
  activeDocument(c).nodes = [{
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
    await screen.findAllByText(/未命名项目/)

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
    await screen.findAllByText(/未命名项目/)

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
    await screen.findAllByText(/未命名项目/)

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
    await screen.findAllByText(/未命名项目/)
    h.emitCanvas(canvasWithDiagnosis())
    await user.click(await screen.findByText('重生复仇：选题诊断'))
    expect(await screen.findByText('产物文件不存在')).toBeInTheDocument()
  })

  it('切项目（projectId 变化）时关闭查看器；常规推送不关', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await screen.findAllByText(/未命名项目/)
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
    h.get.mockResolvedValue(other)
    h.emitCanvas(other)
    await waitFor(() => expect(screen.queryByText('立项/diagnosis.json')).not.toBeInTheDocument())
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()
  })
})

// B-50 / feature-823 · 双视图与 activeView 持久化
describe('B-50 · Stage0View / 自由画布双视图与 activeView 持久化', () => {
  it('空 nodes 从 Stage0 开始；首个节点到达后保存并切回 DAG', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()
    expect(document.querySelector('[data-stp="0"]')).toBeTruthy()

    h.emitCanvas(canvasWithDiagnosis('stage0'))
    expect(await screen.findByText('重生复仇：选题诊断')).toBeInTheDocument()
    await waitFor(() => expect(h.viewState).toHaveBeenCalledWith({
      type: 'active.set', projectId: 'p1', activeView: 'canvas',
    }))
    expect(screen.queryByText('立项尚未定案')).not.toBeInTheDocument()
  })

  it('重启恢复 stage0 + 既有 nodes：保持 Stage0View，不改写 activeView', async () => {
    const h = installApi(canvasWithDiagnosis('stage0'))
    render(<StudioApp />)
    await waitFor(() => expect(document.querySelector('[data-view="stage0"]')).toBeTruthy())
    expect(h.viewState).not.toHaveBeenCalled()
    expect(screen.queryByText(/还没有任何产物/)).not.toBeInTheDocument()
  })

  it('初始即有 nodes 且 activeView=canvas：直接 DAG，不倒播 Stage0View', async () => {
    const h = installApi(canvasWithDiagnosis())
    render(<StudioApp />)
    expect(await screen.findByText('重生复仇：选题诊断')).toBeInTheDocument()
    expect(screen.queryByText('立项尚未定案')).not.toBeInTheDocument()
    expect(h.viewState).not.toHaveBeenCalled()
  })

  it('切到已有节点的目标画布时不把 stage0 自动改成 DAG', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()

    const next = emptyCanvas()
    const second = { ...activeDocument(canvasWithDiagnosis('stage0')), id: 'canvas-2', title: '画布 2' }
    next.pages[0]!.canvases.push(second)
    next.pages[0]!.activeCanvasId = second.id
    h.emitCanvas(next)

    await waitFor(() => expect(document.querySelector('[data-view="stage0"]')).toBeTruthy())
    expect(h.viewState).not.toHaveBeenCalled()
  })

  it('用户手动选择当前 Stage0 后，首个节点到达不再自动切换', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()

    await user.click(document.querySelector('[data-stp="0"]')!)
    h.emitCanvas(canvasWithDiagnosis('stage0'))

    await waitFor(() => expect(document.querySelector('[data-view="stage0"]')).toBeTruthy())
    expect(h.viewState).not.toHaveBeenCalled()
  })

  it('手动返回画布后保持选择；切到其他项目则恢复其 stage0', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    expect(await screen.findByText('立项尚未定案')).toBeInTheDocument()

    await user.click(screen.getAllByText('← 返回画布')[0]!)
    expect(await screen.findByText(/还没有任何产物/)).toBeInTheDocument()
    await waitFor(() => expect(h.viewState).toHaveBeenCalledTimes(1))

    h.emitCanvas({ ...emptyCanvas(), activeView: 'canvas' })
    expect(await screen.findByText(/还没有任何产物/)).toBeInTheDocument()
    expect(screen.queryByText('立项尚未定案')).not.toBeInTheDocument()
    expect(h.viewState).toHaveBeenCalledTimes(1)

    const other = emptyCanvas('新项目')
    other.projectId = 'p2'
    h.get.mockResolvedValue(other)
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
    expect(document.querySelector('[data-statusbar]')).toBeNull()
    // feature-820：底栏虚构状态文案已移除，任何状态都不得出现
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

function canvasWithAssetNode(): Canvas {
  const c = emptyCanvas('资产关联项目')
  c.activeView = 'canvas'
  c.revision = 4
  activeDocument(c).nodes = [{
    id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'active',
    updatedAt: '2026-11-10T00:00:00.000Z',
  }]
  return c
}

describe('feature-814 · 资产绑定交互', () => {
  it('多选绑定与解绑共用命令入口，并以最新 revision 提交下一命令', async () => {
    const initial = canvasWithAssetNode()
    const h = installApi(initial)
    const bound = withActiveDocument({ ...initial, revision: 5 }, {
      nodes: [{ ...activeDocument(initial).nodes[0]!, assetIds: ['asset-1', 'asset-2'] }],
    })
    const unbound = withActiveDocument({ ...bound, revision: 6 }, {
      nodes: [{ ...activeDocument(bound).nodes[0]!, assetIds: ['asset-2'] }],
    })
    h.command
      .mockResolvedValueOnce({ commandId: 'cmd-bind', revision: 5, canvas: bound })
      .mockResolvedValueOnce({ commandId: 'cmd-unbind', revision: 6, canvas: unbound })
    render(<StudioApp />)

    await screen.findAllByText('人物小传')
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')
    await screen.findByText('当前节点：人物小传')
    await user.click(screen.getByTitle('资产/女主.png'))
    await user.click(screen.getByTitle('资产/男主.png'))
    await user.click(screen.getByRole('button', { name: '绑定所选' }))

    await waitFor(() => expect(h.command).toHaveBeenCalledTimes(1))
    expect(h.command.mock.calls[0]?.[0]).toEqual({
      commandId: expect.any(String),
      expectedRevision: 4,
      type: 'assets.bind',
      projectId: 'p1',
      pageId: 'page-1',
      canvasId: 'canvas-1',
      nodeId: 'step-1-profiles',
      assetIds: ['asset-1', 'asset-2'],
    })
    expect(await screen.findByLabelText('关联资产 2 项')).toBeInTheDocument()
    expect(screen.getByText('已关联 2 项 · 本类已选 0 项')).toBeInTheDocument()

    await user.click(screen.getByTitle('资产/女主.png'))
    await user.click(screen.getByRole('button', { name: '解绑所选' }))
    await waitFor(() => expect(h.command).toHaveBeenCalledTimes(2))
    expect(h.command.mock.calls[1]?.[0]).toEqual({
      commandId: expect.any(String),
      expectedRevision: 5,
      type: 'assets.unbind',
      projectId: 'p1',
      pageId: 'page-1',
      canvasId: 'canvas-1',
      nodeId: 'step-1-profiles',
      assetIds: ['asset-1'],
    })
    expect(await screen.findByLabelText('关联资产 1 项')).toBeInTheDocument()
    expect(h.assetList).toHaveBeenCalledWith('image')
  })

  it.each([
    ['video', '视频'],
    ['music', '音乐'],
    ['workflow', '工作流'],
  ] as const)('%s 类资产使用同一绑定/解绑命令链', async (kind, label) => {
    const initial = canvasWithAssetNode()
    const h = installApi(initial)
    h.assetList.mockImplementation(async (requested: AssetIndexItem['kind']) => [{
      id: `${requested}-1`, kind: requested,
      path: `资产/${requested}-sample`, createdAt: '2026-11-10T00:00:00.000Z',
    }])
    h.command
      .mockImplementationOnce(async (request: CanvasCommandRequest) => ({
        commandId: request.commandId, revision: 5,
        canvas: withActiveDocument({ ...initial, revision: 5 }, {
          nodes: [{ ...activeDocument(initial).nodes[0]!, assetIds: [`${kind}-1`] }],
        }),
      }))
      .mockImplementationOnce(async (request: CanvasCommandRequest) => ({
        commandId: request.commandId, revision: 6,
        canvas: withActiveDocument({ ...initial, revision: 6 }, {
          nodes: [{ ...activeDocument(initial).nodes[0]!, assetIds: [] }],
        }),
      }))
    render(<StudioApp />)

    await screen.findAllByText('人物小传')
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await user.click(screen.getByRole('button', { name: label }))
    const item = await screen.findByTitle(`资产/${kind}-sample`)
    await screen.findByText('当前节点：人物小传')
    await user.click(item)
    await user.click(screen.getByRole('button', { name: '绑定所选' }))
    await waitFor(() => expect(h.command).toHaveBeenCalledTimes(1))
    expect(h.command.mock.calls[0]?.[0]).toMatchObject({
      expectedRevision: 4, type: 'assets.bind', nodeId: 'step-1-profiles', assetIds: [`${kind}-1`],
    })
    expect(await screen.findByLabelText('关联资产 1 项')).toBeInTheDocument()

    await user.click(screen.getByTitle(`资产/${kind}-sample`))
    await user.click(screen.getByRole('button', { name: '解绑所选' }))
    await waitFor(() => expect(h.command).toHaveBeenCalledTimes(2))
    expect(h.command.mock.calls[1]?.[0]).toMatchObject({
      expectedRevision: 5, type: 'assets.unbind', nodeId: 'step-1-profiles', assetIds: [`${kind}-1`],
    })
    await waitFor(() => expect(screen.queryByLabelText('关联资产 1 项')).not.toBeInTheDocument())
    expect(h.assetList).toHaveBeenCalledWith(kind)
  })

  it('revision 冲突时刷新画布、提示重试并保留已选资产', async () => {
    const initial = canvasWithAssetNode()
    const refreshed = withActiveDocument({ ...initial, revision: 5 }, {
      nodes: [{ ...activeDocument(initial).nodes[0]!, assetIds: ['asset-1'] }],
    })
    const h = installApi(initial)
    h.command.mockRejectedValue(Object.assign(
      new Error('画布 revision 冲突'),
      { code: 'CANVAS_REVISION_CONFLICT' },
    ))
    ;(window.api.canvas.get as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(refreshed)
    render(<StudioApp />)

    await screen.findAllByText('人物小传')
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')
    await screen.findByText('当前节点：人物小传')
    await user.click(screen.getByTitle('资产/女主.png'))
    await user.click(screen.getByRole('button', { name: '绑定所选' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('画布已被其他操作更新，已刷新；请确认后重试。')
    expect(window.api.canvas.get).toHaveBeenCalledTimes(2)
    expect(await screen.findByLabelText('关联资产 1 项')).toBeInTheDocument()
    expect(screen.getByTitle('资产/女主.png')).toHaveAttribute('aria-pressed', 'true')
    expect(h.command).toHaveBeenCalledTimes(1)
  })
})

describe('feature-823 · Studio 画布竞态隔离', () => {
  it('异项目旧广播经 canvas.get 核实后丢弃', async () => {
    const initial = canvasWithDiagnosis()
    const h = installApi(initial)
    render(<StudioApp />)
    await screen.findByText('重生复仇：选题诊断')

    const verified = deferred<Canvas | null>()
    h.get.mockReturnValueOnce(verified.promise)
    const stale = emptyCanvas('不应切入的旧项目')
    stale.projectId = 'p2'
    h.emitCanvas(stale)
    await waitFor(() => expect(h.get).toHaveBeenCalledTimes(2))
    await act(async () => {
      verified.resolve(initial)
      await verified.promise
    })

    expect(screen.queryByText('不应切入的旧项目')).not.toBeInTheDocument()
    expect(screen.getByText('重生复仇：选题诊断')).toBeInTheDocument()
  })

  it('同项目新广播到达后，迟到的旧 canvas.get 响应被丢弃', async () => {
    const initial = emptyCanvas('过期读取')
    const staleGet = deferred<Canvas | null>()
    const h = installApi(initial)
    h.get.mockReturnValueOnce(staleGet.promise)
    render(<StudioApp />)
    await waitFor(() => expect(h.get).toHaveBeenCalledTimes(1))

    h.emitCanvas(canvasWithDiagnosis())
    expect(await screen.findByText('重生复仇：选题诊断')).toBeInTheDocument()
    await act(async () => {
      staleGet.resolve(initial)
      await staleGet.promise
    })

    expect(screen.queryByText('过期读取')).not.toBeInTheDocument()
    expect(screen.getByText('重生复仇：选题诊断')).toBeInTheDocument()
  })

  it('切换项目后，迟到的旧资产命令响应不得覆盖当前项目', async () => {
    const initial = canvasWithAssetNode()
    const pending = deferred<{ commandId: string; revision: number; canvas: Canvas }>()
    const h = installApi(initial)
    h.command.mockReturnValueOnce(pending.promise)
    render(<StudioApp />)

    await screen.findAllByText('人物小传')
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')
    await screen.findByText('当前节点：人物小传')
    await user.click(screen.getByTitle('资产/女主.png'))
    await user.click(screen.getByRole('button', { name: '绑定所选' }))
    await waitFor(() => expect(h.command).toHaveBeenCalledTimes(1))

    const other = emptyCanvas('目标项目')
    other.projectId = 'p2'
    h.get.mockResolvedValue(other)
    h.emitCanvas(other)
    expect(await screen.findByText('目标项目')).toBeInTheDocument()

    const staleResult = withActiveDocument({ ...initial, revision: 5 }, {
      nodes: [{ ...activeDocument(initial).nodes[0]!, assetIds: ['asset-1'] }],
    })
    await act(async () => {
      pending.resolve({ commandId: 'cmd-stale', revision: 5, canvas: staleResult })
      await pending.promise
    })

    expect(screen.getByText('目标项目')).toBeInTheDocument()
    expect(screen.queryByLabelText('关联资产 1 项')).not.toBeInTheDocument()
  })

  it('切换项目后，迟到的旧 ViewState 响应不得覆盖当前项目', async () => {
    const initial = canvasWithAssetNode()
    const pending = deferred<{
      ok: true
      target: { projectId: string; pageId: string; canvasId: string }
      canvas: Canvas
    }>()
    const h = installApi(initial)
    h.viewState.mockReturnValueOnce(pending.promise)
    render(<StudioApp />)
    await screen.findAllByText('人物小传')

    await user.click(document.querySelector('[data-seg="nav"]')!)
    await user.click(document.querySelector('[data-stage="0"]')!)
    await waitFor(() => expect(h.viewState).toHaveBeenCalledTimes(1))

    const other = emptyCanvas('目标项目')
    other.projectId = 'p2'
    h.get.mockResolvedValue(other)
    h.emitCanvas(other)
    expect(await screen.findByText('目标项目')).toBeInTheDocument()

    await act(async () => {
      pending.resolve({
        ok: true,
        target: { projectId: 'p1', pageId: 'page-1', canvasId: 'canvas-1' },
        canvas: { ...initial, title: '旧视图响应', activeView: 'stage0' },
      })
      await pending.promise
    })

    expect(screen.getByText('目标项目')).toBeInTheDocument()
    expect(screen.queryByText('旧视图响应')).not.toBeInTheDocument()
  })

  it('activeView 响应只更新视图，不覆盖新广播的 nodes 与 revision', async () => {
    const initial = { ...canvasWithAssetNode(), activeView: 'stage0' as const }
    const pending = deferred<{
      ok: true
      target: { projectId: string; pageId: string; canvasId: string }
      canvas: Canvas
    }>()
    const h = installApi(initial)
    h.viewState.mockReturnValueOnce(pending.promise)
    render(<StudioApp />)

    await waitFor(() => expect(document.querySelector('[data-stage0-back]')).not.toBeNull())
    await user.click(document.querySelector('[data-stage0-back]')!)
    await waitFor(() => expect(h.viewState).toHaveBeenCalledTimes(1))
    const fresh = withActiveDocument({
      ...initial,
      title: '新画布状态',
      revision: 9,
      activeView: 'stage0',
    }, {
      nodes: [{ ...activeDocument(initial).nodes[0]!, title: '最新人物小传' }],
    })
    h.emitCanvas(fresh)
    await screen.findAllByText('新画布状态')

    await act(async () => {
      pending.resolve({
        ok: true,
        target: { projectId: 'p1', pageId: 'page-1', canvasId: 'canvas-1' },
        canvas: { ...initial, activeView: 'canvas' },
      })
      await pending.promise
    })

    expect(await screen.findAllByText('最新人物小传')).not.toHaveLength(0)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')
    await screen.findByText('当前节点：最新人物小传')
    await user.click(screen.getByTitle('资产/女主.png'))
    await user.click(screen.getByRole('button', { name: '绑定所选' }))
    await waitFor(() => expect(h.command).toHaveBeenCalledTimes(1))
    expect(h.command.mock.calls[0]?.[0]).toMatchObject({
      expectedRevision: 9,
      nodeId: 'step-1-profiles',
      assetIds: ['asset-1'],
    })
  })
})

describe('feature-820 · 一级入口与伪造状态收口', () => {
  it('AC-1/AC-2/AC-4：底栏只呈现真实状态，虚构端口 / 批量 / Harness / 自动保存不出现', async () => {
    installApi(emptyCanvas('测试项目'))
    render(<StudioApp />)

    const bar = await waitFor(() => {
      const el = document.querySelector('[data-statusbar]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    const text = bar.textContent ?? ''
    expect(text).toContain('火山方舟')
    expect(text).toContain('doubao-pro-32k')
    expect(text).toContain('运行时 · 运行中')
    expect(text).toContain('ComfyUI 已配置 1/1 启用')
    expect(text).toContain('画布更新于')
    for (const stale of ['10.203.3.52:8000', ':8001', ':8002', '镜头批量', 'Harness 校验', '自动保存']) {
      expect(text).not.toContain(stale)
    }
  })

  it('AC-2：文本服务未配置 Key 时显示告警且不出现绿色在线点', async () => {
    installApi(emptyCanvas('测试项目'))
    ;(window.api.settings.ai.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      activeProvider: 'ark',
      ark: {
        model: 'doubao-pro-32k', baseUrl: '', keyConfigured: false,
        sources: { apiKey: 'default' as const, baseUrl: 'default' as const, model: 'default' as const },
      },
      lmstudio: {
        model: 'local-model', baseUrl: '',
        sources: { baseUrl: 'default' as const, model: 'default' as const },
      },
      runtime: { portRangeStart: 40100, healthTimeoutMs: 20000, mockBaseUrl: '' },
      updatedAt: new Date().toISOString(),
    })
    render(<StudioApp />)

    const slot = await waitFor(() => {
      const el = document.querySelector('[data-status="text"]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(slot.textContent).toContain('未配置 Key')
    expect(slot.querySelector('.bg-ok')).toBeNull()
  })

  it('AC-5：Skill 类目真实筛选、无死按钮；插件无假开关', async () => {
    installApi(emptyCanvas('测试项目'))
    render(<StudioApp />)
    await screen.findByPlaceholderText(/描述创作目标/)

    await user.click(document.querySelector('[data-rail="skills"]')!)
    expect(await screen.findByText('日漫定妆流')).toBeInTheDocument()
    expect(screen.getByText('强情绪三连镜')).toBeInTheDocument()
    expect(screen.queryByText(/在对话中试用/)).not.toBeInTheDocument()

    // 类目筛选生效：情绪只剩「强情绪三连镜」
    await user.click(screen.getByRole('button', { name: '情绪' }))
    await waitFor(() => expect(screen.queryByText('日漫定妆流')).not.toBeInTheDocument())
    expect(screen.getByText('强情绪三连镜')).toBeInTheDocument()

    await user.click(document.querySelector('[data-rail="plugins"]')!)
    expect(await screen.findByText('3D 导演台')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getAllByText('未开放').length).toBeGreaterThan(0)
  })

  it('AC-6：本地模型入口可见未开放说明，并可打开 AI 服务设置', async () => {
    installApi(emptyCanvas('测试项目'))
    render(<StudioApp />)
    await screen.findByPlaceholderText(/描述创作目标/)

    await user.click(document.querySelector('[data-rail="local"]')!)
    expect(await screen.findByText('本地模型管理')).toBeInTheDocument()
    expect(screen.getByText(/不提供可执行操作/)).toBeInTheDocument()

    await user.click(document.querySelector('[data-local-models-settings]')!)
    expect(await screen.findByRole('dialog', { name: 'AI 服务设置' })).toBeInTheDocument()
  })
})

function imageAsset(id: string, path: string, originalName?: string): AssetIndexItem {
  return {
    id, kind: 'image', path, createdAt: '2026-11-10T00:00:00.000Z',
    meta: originalName === undefined ? undefined : { originalName },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const WEBP_DATA_URL = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'

describe('feature-821 · 资产上传与真实缩略图', () => {
  it('上传成功仅刷新图片列表、显示 Toast 和原始文件名，不自动绑定', async () => {
    const h = installApi(canvasWithAssetNode())
    const imported = imageAsset('asset-3', '资产/上传/abc123.png', '女主定妆照.png')
    h.assetList
      .mockResolvedValueOnce([imageAsset('asset-1', '资产/女主.png'), imageAsset('asset-2', '资产/男主.png')])
      .mockResolvedValue([
        imageAsset('asset-1', '资产/女主.png'),
        imageAsset('asset-2', '资产/男主.png'),
        imported,
      ])
    h.assetImport.mockResolvedValue({ status: 'imported', asset: imported })
    render(<StudioApp />)

    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')
    await user.click(screen.getByRole('button', { name: '上传图片' }))

    expect(await screen.findByText('已上传图片：女主定妆照.png')).toBeInTheDocument()
    expect(await screen.findByText('女主定妆照.png')).toBeInTheDocument()
    expect(h.assetImport).toHaveBeenCalledTimes(1)
    expect(h.assetList).toHaveBeenCalledTimes(2)
    expect(h.assetList.mock.calls.every(([kind]) => kind === 'image')).toBe(true)
    expect(h.command).not.toHaveBeenCalled()
    expect(screen.getByTitle('资产/上传/abc123.png')).toHaveAttribute('aria-pressed', 'false')
  })

  it('取消上传保持静默且不刷新，失败提示剥壳后的安全错误', async () => {
    const h = installApi(emptyCanvas())
    render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')

    await user.click(screen.getByRole('button', { name: '上传图片' }))
    await waitFor(() => expect(h.assetImport).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: '上传图片' })).toBeEnabled())
    expect(h.assetList).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/已上传图片/)).not.toBeInTheDocument()

    h.assetImport.mockRejectedValueOnce(new Error(
      "Error invoking remote method 'asset:import': Error: 图片为空、损坏、被截断或格式不受支持",
    ))
    await user.click(screen.getByRole('button', { name: '上传图片' }))
    expect(await screen.findByText('图片为空、损坏、被截断或格式不受支持')).toBeInTheDocument()
    expect(screen.queryByText(/Error invoking remote method/)).not.toBeInTheDocument()
    expect(h.assetList).toHaveBeenCalledTimes(1)
  })

  it('上传中防重入，无项目时禁用上传且不读取资产索引', async () => {
    const h = installApi(emptyCanvas())
    const pending = deferred<{ status: 'cancelled' }>()
    h.assetImport.mockReturnValue(pending.promise)
    const mounted = render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')

    await user.click(screen.getByRole('button', { name: '上传图片' }))
    const uploading = screen.getByRole('button', { name: '上传中…' })
    expect(uploading).toBeDisabled()
    fireEvent.click(uploading)
    fireEvent.click(uploading)
    expect(h.assetImport).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve({ status: 'cancelled' })
      await pending.promise
    })
    await screen.findByRole('button', { name: '上传图片' })

    mounted.unmount()
    const noProject = installApi(canvasNoProject())
    render(<StudioApp />)
    await screen.findByText('开始一部短剧')
    await user.click(document.querySelector('[data-rail="assets"]')!)
    const disabled = await screen.findByRole('button', { name: '上传图片' })
    expect(disabled).toBeDisabled()
    fireEvent.click(disabled)
    expect(noProject.assetList).not.toHaveBeenCalled()
    expect(noProject.assetImport).not.toHaveBeenCalled()
    expect(noProject.assetThumbnail).not.toHaveBeenCalled()
  })

  it('项目切换使上传中的旧响应失效，不刷新列表也不弹旧项目 Toast', async () => {
    const h = installApi(emptyCanvas('旧项目'))
    h.assetList.mockResolvedValue([])
    const pending = deferred<
      | { status: 'imported'; asset: AssetIndexItem }
      | { status: 'cancelled' }
    >()
    h.assetImport.mockReturnValue(pending.promise)
    render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByRole('button', { name: '上传图片' })
    await user.click(screen.getByRole('button', { name: '上传图片' }))

    const other = { ...emptyCanvas('新项目'), projectId: 'p2' }
    h.get.mockResolvedValue(other)
    h.emitCanvas(other)
    await waitFor(() => expect(h.assetList).toHaveBeenCalledTimes(2))
    await act(async () => {
      pending.resolve({
        status: 'imported',
        asset: imageAsset('old-upload', '资产/上传/old.png', '旧项目图片.png'),
      })
      await pending.promise
    })

    expect(screen.queryByText(/已上传图片/)).not.toBeInTheDocument()
    expect(screen.queryByText('旧项目图片.png')).not.toBeInTheDocument()
    expect(h.assetList).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('button', { name: '上传图片' })).toBeEnabled()
  })

  it('项目切换丢弃迟到的旧列表响应', async () => {
    const h = installApi(emptyCanvas('旧项目'))
    const oldList = deferred<AssetIndexItem[]>()
    h.assetList
      .mockReturnValueOnce(oldList.promise)
      .mockResolvedValue([imageAsset('new-asset', '资产/新项目.png')])
    render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await waitFor(() => expect(h.assetList).toHaveBeenCalledTimes(1))

    const other = { ...emptyCanvas('新项目'), projectId: 'p2' }
    h.get.mockResolvedValue(other)
    h.emitCanvas(other)
    expect(await screen.findByText('新项目.png')).toBeInTheDocument()
    await act(async () => {
      oldList.resolve([imageAsset('old-asset', '资产/旧项目.png')])
      await oldList.promise
    })
    expect(screen.queryByText('旧项目.png')).not.toBeInTheDocument()
    expect(screen.getByText('新项目.png')).toBeInTheDocument()
  })

  it('显示 WebP Data URL 真缩略图，非法 meta 名称回退且搜索匹配显示名和路径', async () => {
    const h = installApi(emptyCanvas())
    h.assetList.mockResolvedValue([
      imageAsset('asset-1', '资产/上传/abc123.png', '定妆原图.png'),
      imageAsset('asset-2', '资产/场景/教室.png', '../不安全'),
    ])
    h.assetThumbnail.mockImplementation(async (id: string) => ({
      dataUrl: id === 'asset-1' ? WEBP_DATA_URL : null,
    }))
    render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)

    const image = await screen.findByRole('img', { name: '定妆原图.png' })
    expect(image).toHaveAttribute('src', WEBP_DATA_URL)
    expect(image.getAttribute('src')).not.toContain('file://')
    expect(screen.getByText('教室.png')).toBeInTheDocument()
    expect(screen.queryByText('../不安全')).not.toBeInTheDocument()

    const search = screen.getByPlaceholderText('搜索项目 / Skill / 资产')
    await user.type(search, 'abc123')
    expect(screen.getByTitle('资产/上传/abc123.png')).toBeInTheDocument()
    expect(screen.queryByTitle('资产/场景/教室.png')).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, '场景/教室')
    expect(screen.getByTitle('资产/场景/教室.png')).toBeInTheDocument()
    expect(screen.queryByTitle('资产/上传/abc123.png')).not.toBeInTheDocument()
  })

  it('缩略图 null、请求失败和图片解码失败均回退首字母', async () => {
    const h = installApi(emptyCanvas())
    h.assetList
      .mockResolvedValueOnce([imageAsset('asset-null', '资产/空图.png')])
      .mockResolvedValueOnce([imageAsset('asset-fail', '资产/坏图.png')])
      .mockResolvedValue([imageAsset('asset-decode', '资产/解码.png')])
    h.assetThumbnail
      .mockResolvedValueOnce({ dataUrl: null })
      .mockRejectedValueOnce(new Error('缩略图读取失败'))
      .mockResolvedValue({ dataUrl: WEBP_DATA_URL })
    render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/空图.png')
    await waitFor(() => expect(h.assetThumbnail).toHaveBeenCalledWith('asset-null'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('空')).toBeInTheDocument()

    h.emitRuntime({
      type: 'tool.call', ts: '', sessionId: 'sess-1', messageId: 'msg-1', callId: 'call-1',
      tool: 'shortdrama_asset_register', status: 'completed', argsPreview: '', args: {},
    })
    await screen.findByTitle('资产/坏图.png')
    await waitFor(() => expect(h.assetThumbnail).toHaveBeenCalledWith('asset-fail'))
    expect(screen.getByText('坏')).toBeInTheDocument()

    h.emitRuntime({
      type: 'tool.call', ts: '', sessionId: 'sess-1', messageId: 'msg-1', callId: 'call-2',
      tool: 'shortdrama_asset_register', status: 'completed', argsPreview: '', args: {},
    })
    const image = await screen.findByRole('img', { name: '解码.png' })
    fireEvent.error(image)
    expect(screen.queryByRole('img', { name: '解码.png' })).not.toBeInTheDocument()
    expect(screen.getByText('解')).toBeInTheDocument()
  })

  it('项目切换后旧缩略图响应不得覆盖同 ID 的新图片', async () => {
    const h = installApi(emptyCanvas('旧项目'))
    const asset = imageAsset('same-id', '资产/角色.png')
    const oldThumbnail = deferred<{ dataUrl: string | null }>()
    const newDataUrl = `${WEBP_DATA_URL.slice(0, -4)}BBBB`
    h.assetList.mockResolvedValue([asset])
    h.assetThumbnail
      .mockReturnValueOnce(oldThumbnail.promise)
      .mockResolvedValueOnce({ dataUrl: newDataUrl })
    render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await waitFor(() => expect(h.assetThumbnail).toHaveBeenCalledTimes(1))

    const other = { ...emptyCanvas('新项目'), projectId: 'p2' }
    h.get.mockResolvedValue(other)
    h.emitCanvas(other)
    const image = await screen.findByRole('img', { name: '角色.png' })
    expect(image).toHaveAttribute('src', newDataUrl)
    await act(async () => {
      oldThumbnail.resolve({ dataUrl: WEBP_DATA_URL })
      await oldThumbnail.promise
    })
    expect(screen.getByRole('img', { name: '角色.png' })).toHaveAttribute('src', newDataUrl)
  })

  it('非图片资产不请求缩略图，上传与绑定命令保持独立', async () => {
    const initial = canvasWithAssetNode()
    const h = installApi(initial)
    h.assetList.mockImplementation(async (kind: AssetIndexItem['kind']) => kind === 'video'
      ? [{ id: 'video-1', kind: 'video' as const, path: '资产/镜头.mp4', createdAt: '2026-11-10T00:00:00.000Z' }]
      : [imageAsset('asset-1', '资产/女主.png')])
    h.command.mockResolvedValue({
      commandId: 'cmd-bind', revision: 5,
      canvas: withActiveDocument({ ...initial, revision: 5 }, {
        nodes: [{ ...activeDocument(initial).nodes[0]!, assetIds: ['asset-1'] }],
      }),
    })
    render(<StudioApp />)
    await user.click(document.querySelector('[data-rail="assets"]')!)
    await screen.findByTitle('资产/女主.png')

    await user.click(screen.getByRole('button', { name: '视频' }))
    expect(await screen.findByTitle('资产/镜头.mp4')).toBeInTheDocument()
    expect(h.assetThumbnail).not.toHaveBeenCalledWith('video-1')
    expect(screen.queryByRole('button', { name: '上传图片' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '图片' }))
    await user.click(await screen.findByTitle('资产/女主.png'))
    await user.click(screen.getByRole('button', { name: '绑定所选' }))
    await waitFor(() => expect(h.command).toHaveBeenCalledTimes(1))
    expect(h.command.mock.calls[0]?.[0]).toMatchObject({ type: 'assets.bind', assetIds: ['asset-1'] })
    expect(h.assetImport).not.toHaveBeenCalled()
  })
})
