// feature-808 · 会话续聊组件集成（契约 §4/§6.3：R1–R7 + 订阅生命周期）
// 项目绑定会话 → 历史回放 / 惰性建会话 / 同会话复用 / 停止 / 跨会话过滤与竞态 / 404 降级。
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas } from '@shared/types'
import type { ReplayMessageRecord } from '../../lib/history-replay'
import type { RuntimeEvent } from '../../lib/runtime-types'
import StudioApp from './StudioApp'

function canvasOf(projectId: string, title = ''): Canvas {
  return {
    schemaVersion: 2, projectId, title, nodes: [], edges: [], gates: [],
    updatedAt: new Date().toISOString(),
  }
}

const RUNNING = {
  state: 'running' as const, port: 0, version: '1.18.34', healthy: true,
  startedAt: null, error: null,
}

interface Deferred<T> { promise: Promise<T>; resolve: (v: T) => void }
function defer<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

interface Harness {
  binding: { sessionId: string | null }
  records: Map<string, ReplayMessageRecord[]>
  pending: Map<string, Deferred<ReplayMessageRecord[]>>
  reject: Map<string, unknown>
  activeSession: ReturnType<typeof vi.fn>
  sessionMessages: ReturnType<typeof vi.fn>
  createSession: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  abortSession: ReturnType<typeof vi.fn>
  promptAsync: ReturnType<typeof vi.fn>
  emitRuntime: (e: RuntimeEvent) => void
  emitCanvas: (c: Canvas) => void
}

function installApi(initial: Canvas): Harness {
  const runtimeCbs = new Set<(e: RuntimeEvent) => void>()
  const canvasCbs = new Set<(c: Canvas) => void>()

  const h: Harness = {
    binding: { sessionId: null },
    records: new Map(),
    pending: new Map(),
    reject: new Map(),
    activeSession: vi.fn(async (sessionId?: string | null) => {
      // 写态（带参，含 null）只记录调用；读态永远返回当前绑定
      if (sessionId !== undefined) h.binding.sessionId = sessionId
      return { sessionId: h.binding.sessionId }
    }),
    sessionMessages: vi.fn((id: string) => {
      const d = h.pending.get(id)
      if (d) return d.promise
      const err = h.reject.get(id)
      if (err) return Promise.reject(err)
      return Promise.resolve(h.records.get(id) ?? [])
    }),
    createSession: vi.fn(async () => ({
      id: 'sess-fresh', title: null, createdAt: new Date().toISOString(),
    })),
    subscribe: vi.fn(async () => ({ ok: true as const })),
    unsubscribe: vi.fn(async () => ({ ok: true as const })),
    abortSession: vi.fn(async () => ({ ok: true as const })),
    promptAsync: vi.fn(async () => ({ accepted: true as const, messageId: 'msg-1' })),
    emitRuntime: e => act(() => runtimeCbs.forEach(cb => cb(e))),
    emitCanvas: c => act(() => canvasCbs.forEach(cb => cb(c))),
  }

  window.api = {
    runtime: {
      status: vi.fn(async () => RUNNING),
      start: vi.fn(async () => RUNNING),
      createSession: h.createSession,
      subscribe: h.subscribe,
      unsubscribe: h.unsubscribe,
      abortSession: h.abortSession,
      sessionMessages: h.sessionMessages,
      promptAsync: h.promptAsync,
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
    activeSession: h.activeSession,
    fileRead: vi.fn(async () => ({ ok: false as const, error: { code: 'X', message: 'x' } })),
    // 省略 window 块：WindowControls 走 api.window 缺省防御分支（同 studio-flow 套件）
    // feature-005：CaptureBar 挂载桥（空库 + 无推送；本套件不操作口径条）
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
  } as unknown as Window['api']

  return h
}

const recordsA: ReplayMessageRecord[] = [
  { info: { id: 'u-a', role: 'user' }, parts: [{ type: 'text', text: 'A 历史提问' }] },
  {
    info: { id: 'a-a', role: 'assistant' },
    parts: [{ type: 'text', text: 'A 历史回复', startedAt: 1 }],
  },
]
const recordsB: ReplayMessageRecord[] = [
  { info: { id: 'u-b', role: 'user' }, parts: [{ type: 'text', text: 'B 历史提问' }] },
  {
    info: { id: 'a-b', role: 'assistant' },
    parts: [{ type: 'text', text: 'B 历史回复', startedAt: 2 }],
  },
]

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  user = userEvent.setup()
})

// R1：重开项目 → 历史文本气泡回放；加载凭据出现/消失；无演示数据
describe('feature-808 · 会话续聊（契约 §6.3）', () => {
  it('R1：绑定 sess-A 重开 → 渲染 A 历史；显示并收起 loading；不铺演示气泡', async () => {
    const h = installApi(canvasOf('pA'))
    h.binding.sessionId = 'sess-A'
    h.records.set('sess-A', recordsA)
    render(<StudioApp />)

    expect(await screen.findByText('A 历史提问')).toBeInTheDocument()
    expect(screen.getByText('A 历史回复')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('chat-history-loading')).not.toBeInTheDocument(),
    )
    expect(h.sessionMessages).toHaveBeenCalledWith('sess-A')
    // dev-mock 演示数据不得出现
    expect(screen.queryByText(/校园恋爱/)).not.toBeInTheDocument()
    // 回放阶段不启动 runtime
    expect(window.api.runtime.start).not.toHaveBeenCalled()
  })

  it('AC1：null 绑定 → 空态；不调 sessionMessages，不启动 runtime', async () => {
    const h = installApi(canvasOf('pEmpty'))
    h.binding.sessionId = null
    render(<StudioApp />)

    expect(await screen.findByText(/输入一句灵感/)).toBeInTheDocument()
    expect(h.sessionMessages).not.toHaveBeenCalled()
    expect(window.api.runtime.start).not.toHaveBeenCalled()
    expect(window.api.runtime.status).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByTestId('chat-history-loading')).not.toBeInTheDocument(),
    )
  })

  it('R2：有绑定发送 → 不建会话、不回写，promptAsync 复用同 sid 且 subscribe 一次', async () => {
    const h = installApi(canvasOf('pA'))
    h.binding.sessionId = 'sess-A'
    h.records.set('sess-A', [])
    render(<StudioApp />)
    await waitFor(() => expect(h.sessionMessages).toHaveBeenCalledWith('sess-A'))

    await user.type(screen.getByPlaceholderText(/描述创作目标/), '继续写第三场')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(h.createSession).not.toHaveBeenCalled()
    expect(h.promptAsync).toHaveBeenCalledWith({
      sessionId: 'sess-A', text: '继续写第三场', agent: 'showrunner',
    })
    // 仅 mount 时的无参读，不得出现带参写态
    expect(h.activeSession.mock.calls.every(c => c[0] === undefined)).toBe(true)
    expect(h.subscribe).toHaveBeenCalledTimes(1)
  })

  it('R3：无绑定首条 prompt → 惰性 createSession 一次并回写；idle 结束本轮后二次发送仍只订阅一次', async () => {
    const h = installApi(canvasOf('pNew'))
    render(<StudioApp />)
    await screen.findByText(/输入一句灵感/)

    await user.type(screen.getByPlaceholderText(/描述创作目标/), '第一条')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(h.createSession).toHaveBeenCalledTimes(1))
    expect(h.activeSession).toHaveBeenCalledWith('sess-fresh')
    expect(h.promptAsync).toHaveBeenCalledWith({
      sessionId: 'sess-fresh', text: '第一条', agent: 'showrunner',
    })
    expect(h.subscribe).toHaveBeenCalledTimes(1)

    // D-006：accepted 后进入 generating（停止钮可达），idle 事件复位本轮后才允许第二条
    expect(await screen.findByTestId('chat-stop')).toBeInTheDocument()
    h.emitRuntime({ type: 'session.idle', ts: '', sessionId: 'sess-fresh' })
    await waitFor(() =>
      expect(screen.queryByTestId('chat-stop')).not.toBeInTheDocument(),
    )

    await user.type(screen.getByPlaceholderText(/描述创作目标/), '第二条')
    await user.click(screen.getByRole('button', { name: '发送' }))
    expect(h.createSession).toHaveBeenCalledTimes(1)
    expect(h.promptAsync).toHaveBeenLastCalledWith({
      sessionId: 'sess-fresh', text: '第二条', agent: 'showrunner',
    })
    expect(h.subscribe).toHaveBeenCalledTimes(1)
  })

  it('R4 / D-006：promptAsync accepted 即 resolve 后停止钮持续可见；流式全程可 abort；idle 复位并定稿', async () => {
    const h = installApi(canvasOf('pA'))
    h.binding.sessionId = 'sess-A'
    h.records.set('sess-A', [])
    // promptAsync 模拟真实 HTTP：accepted 立即 resolve（流式由 SSE 异步到达）
    render(<StudioApp />)
    await waitFor(() => expect(h.sessionMessages).toHaveBeenCalledWith('sess-A'))

    await user.type(screen.getByPlaceholderText(/描述创作目标/), '继续生成')
    await user.click(screen.getByRole('button', { name: '发送' }))

    // D-006 核心回归点：请求往返早已结束（sending 复位），停止钮仍须持续可达
    await waitFor(() => expect(h.promptAsync).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('chat-stop')).toBeInTheDocument()

    // 流式分片到达（同会话事件），停止钮全程保持
    h.emitRuntime({
      type: 'message.part', ts: '', sessionId: 'sess-A', messageId: 'msg-x', partId: 'p1',
      part: { kind: 'text', text: 'A 正在生成的回复' },
    })
    expect(await screen.findByText('A 正在生成的回复')).toBeInTheDocument()
    expect(screen.getByTestId('chat-stop')).toBeInTheDocument()

    const stop = screen.getByTestId('chat-stop')
    await user.click(stop)
    expect(h.abortSession).toHaveBeenCalledWith('sess-A')
    // 不本地复位：点击停止后停止钮仍在（由事件链复位）
    expect(screen.getByTestId('chat-stop')).toBeInTheDocument()

    h.emitRuntime({ type: 'session.idle', ts: '', sessionId: 'sess-A' })
    await waitFor(() =>
      expect(screen.queryByTestId('chat-stop')).not.toBeInTheDocument(),
    )
    // idle 定稿落 agent 气泡
    expect(screen.getByText('A 正在生成的回复')).toBeInTheDocument()
  })

  it('D-007：sid=null（无绑定空项目）时他会话流式 + idle 一律丢弃，不上屏不落气泡', async () => {
    const h = installApi(canvasOf('pEmpty'))
    h.binding.sessionId = null
    render(<StudioApp />)
    await screen.findByText(/输入一句灵感/)

    // 不发送（无绑定、无建会话）；直接注入他会话事件：严格归属下全部丢弃
    h.emitRuntime({
      type: 'message.part', ts: '', sessionId: 'sess-X', messageId: 'msg-x', partId: 'p1',
      part: { kind: 'text', text: 'B 偷偷串台阿尔法鸑鷟' },
    })
    h.emitRuntime({ type: 'session.idle', ts: '', sessionId: 'sess-X' })
    await act(async () => { await Promise.resolve() })

    expect(screen.queryByText(/串台/)).not.toBeInTheDocument()
    expect(screen.queryByText(/阿尔法鸑鷟/)).not.toBeInTheDocument()
    // 未产生本会话轮次：无 agent 气泡、无停止钮；输入文字后发送钮可用（未被错误 generating 锁死）
    expect(screen.queryByTestId('chat-stop')).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/描述创作目标/), '本项目自己的提问')
    expect(screen.getByRole('button', { name: '发送' })).not.toBeDisabled()

    // runtime 级事件（无 sessionId）放行且不引发异常
    h.emitRuntime({ type: 'runtime.connected', ts: '', version: '1.18.34' })
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText(/串台/)).not.toBeInTheDocument()
  })

  it('R5：他会话事件被过滤；切项目清栏装载 B；A 迟到回放不得覆盖 B（竞态）', async () => {
    const h = installApi(canvasOf('pA'))
    h.binding.sessionId = 'sess-A'
    const pendingA = defer<ReplayMessageRecord[]>()
    h.pending.set('sess-A', pendingA)
    render(<StudioApp />)

    // A 的回放仍在途：绑定已置 sess-A
    await waitFor(() => expect(h.sessionMessages).toHaveBeenCalledWith('sess-A'))

    // 他会话（sess-B）流式事件被丢弃
    h.emitRuntime({
      type: 'message.part', ts: '', sessionId: 'sess-B', messageId: 'msg-b', partId: 'p1',
      part: { kind: 'text', text: 'B 偷偷串台' },
    })
    expect(screen.queryByText('B 偷偷串台')).not.toBeInTheDocument()
    // 本会话事件放行
    h.emitRuntime({
      type: 'message.part', ts: '', sessionId: 'sess-A', messageId: 'msg-a', partId: 'p1',
      part: { kind: 'text', text: 'A 流式回复' },
    })
    expect(screen.getByText('A 流式回复')).toBeInTheDocument()

    // 切到项目 B
    h.records.set('sess-B', recordsB)
    h.binding.sessionId = 'sess-B'
    h.emitCanvas(canvasOf('pB'))
    expect(screen.getByTestId('chat-history-loading')).toBeInTheDocument()
    expect(screen.queryByText('A 流式回复')).not.toBeInTheDocument()

    expect(await screen.findByText('B 历史提问')).toBeInTheDocument()
    expect(screen.getByText('B 历史回复')).toBeInTheDocument()

    // A 的迟到回放此时才返回：必须被序号防护丢弃
    pendingA.resolve(recordsA)
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText('A 历史提问')).not.toBeInTheDocument()
    expect(screen.getByText('B 历史提问')).toBeInTheDocument()
  })

  it('R7：回放 404 → 空态 + info toast + 清绑定；再发送惰性建新会话', async () => {
    const h = installApi(canvasOf('pGhost'))
    h.binding.sessionId = 'sess-ghost'
    h.reject.set('sess-ghost', { name: 'SESSION_NOT_FOUND' })
    render(<StudioApp />)

    expect(await screen.findByText(/输入一句灵感/)).toBeInTheDocument()
    expect(await screen.findByText('上次的会话记录已不可用，已为你开始新对话。')).toBeInTheDocument()
    await waitFor(() => expect(h.activeSession).toHaveBeenCalledWith(null))
    expect(screen.queryByText('历史对话加载失败')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('chat-history-loading')).not.toBeInTheDocument(),
    )

    await user.type(screen.getByPlaceholderText(/描述创作目标/), '重新开始')
    await user.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(h.createSession).toHaveBeenCalledTimes(1))
    expect(h.activeSession).toHaveBeenCalledWith('sess-fresh')
    expect(h.promptAsync).toHaveBeenLastCalledWith({
      sessionId: 'sess-fresh', text: '重新开始', agent: 'showrunner',
    })
  })

  it('订阅生命周期：SSE 全程 subscribe 一次；卸载即 unsubscribe', async () => {
    const h = installApi(canvasOf('pLife'))
    const { unmount } = render(<StudioApp />)
    await screen.findByText(/输入一句灵感/)
    expect(h.subscribe).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText(/描述创作目标/), '生命周期')
    await user.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(h.subscribe).toHaveBeenCalledTimes(1))

    unmount()
    expect(h.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
