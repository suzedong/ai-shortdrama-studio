import { app, BrowserWindow, ipcMain } from 'electron'
import type { WebContents } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { listProjects, createProject, openProject } from './project/library.js'
import { isConfigured } from './ark.js'
import { canvasStore } from './canvas/store.js'
import { gateBridge } from './gate/bridge.js'
import { listAssets } from './asset/index.js'
import { readProjectFile } from './fs/read.js'
import { getActiveProjectDir } from './project/current.js'
import { listInstances, upsertInstance, removeInstance } from './comfy/settings.js'
import type { Canvas, CanvasGate, ComfyInstance, AssetIndexItem } from '../shared/types.js'
import { runtimeManager } from './runtime/manager.js'
import { OpencodeRuntimeClient } from './runtime/client.js'
import { subscribeEvents, type EventStreamHandle } from './runtime/projection.js'
import type { RuntimeEvent, RuntimeStatus } from './runtime/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FAFAFE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// feature-011 F13：项目库真实化（原 project:create 假实现已移除）
ipcMain.handle('project:list', () => listProjects())
ipcMain.handle('project:create', (_e, arg?: unknown) => {
  // 兼容两种入参：{ name?: string }（契约）或裸字符串（旧调用）
  if (arg === undefined) return createProject()
  if (typeof arg === 'string') return createProject(arg)
  if (typeof arg === 'object' && arg !== null && 'name' in arg) {
    const name = (arg as { name?: unknown }).name
    return createProject(typeof name === 'string' ? name : undefined)
  }
  return createProject()
})
// 切换会话（契约 §7 之外最小增补，K8 登记）
ipcMain.handle('project:open', (_e, dir: unknown) => {
  if (typeof dir !== 'string') {
    const err = new Error('参数必须为项目目录字符串')
    err.name = 'INVALID_ARGUMENT'
    throw err
  }
  return openProject(dir).then(async res => {
    // feature-017/018：清算旧门 → 丢弃画布投影 → 重挂新项目的 pending 门（顺序固定）
    gateBridge.settleAll()
    canvasStore.reset()
    await gateBridge.recoverPending()
    // feature-022 真机修复：切项目后主动推送新画布（persist 才会广播，reset 不会）
    try {
      const canvas = await canvasStore.get()
      for (const wc of canvasSubscribers) {
        if (!wc.isDestroyed()) wc.send('canvas:changed', canvas)
      }
    } catch {
      // 新项目目录异常时忽略，renderer 保持当前态
    }
    return res
  })
})

// feature-011：只读查询文本侧配置状态（供底栏诚实显示：未配置/已配置）
ipcMain.handle('app:config-status', () => ({ arkConfigured: isConfigured() }))

// ============================================================================
// feature-008 · Agent 运行时（opencode 基座）IPC —— 严格匹配契约 §3/§5/§6/§8
// 命名空间 runtime:* 与既有通道完全隔离。
// feature-022：旧壳 IPC（project:save/template/session/chat/archive/workflow）已全部下线。
// ============================================================================

const runtimeClient = new OpencodeRuntimeClient({
  getConnection: () => runtimeManager.getConnection(),
  // 启动时从 env 读取（dotenv 经 ark.js 已加载）；ARK_MODEL 运行期不变
  allowedArkModel: process.env.ARK_MODEL,
})

/** 订阅窗口：webContents.id → 窗口引用 + 可选 sessionId 过滤（契约 §3.2 规则①） */
const runtimeSubscribers = new Map<number, { wc: WebContents; filter: string | undefined }>()
/** 已挂 destroyed 清理的窗口 id */
const runtimeArmedWindows = new Set<number>()
/** 全应用共享一条 SSE 流（主进程是 opencode 唯一客户端） */
let runtimeEventStream: { handle: EventStreamHandle } | null = null
/** 是否经历过显式 runtime:stop（区分首次惰性自启与用户主动停止，契约 §6.4） */
let runtimeStoppedExplicitly = false

const RUNTIME_ERROR_NAMES: ReadonlySet<string> = new Set([
  'INVALID_ARGUMENT',
  'RUNTIME_NOT_READY',
  'RUNTIME_START_FAILED',
  'RUNTIME_HEALTH_FAILED',
  'SESSION_NOT_FOUND',
  'SESSION_CREATE_FAILED',
  'PROMPT_FAILED',
  'PROMPT_ABORTED',
  'STRUCTURED_OUTPUT_FAILED',
  'UPSTREAM_AUTH_MISSING',
  'INTERNAL',
])

function makeRuntimeError(code: string, message: string): Error {
  const err = new Error(message)
  err.name = code
  return err
}

/** 通道边界统一错误归一化：未知异常 → INTERNAL（name=code，契约 §5.1） */
function normalizeRuntimeError(e: unknown): Error {
  if (e instanceof Error && RUNTIME_ERROR_NAMES.has(e.name)) return e
  return makeRuntimeError(
    'INTERNAL',
    e instanceof Error ? e.message : '运行时内部错误',
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 惰性自启（契约 §6.1）：首次访问业务通道 / runtime:start 时拉起 */
async function ensureRuntime(): Promise<RuntimeStatus> {
  // serve cwd 固定为平台工作区根目录（契约 §1）；确保目录存在，否则 spawn ENOENT
  const workspaceRoot = path.join(app.getPath('documents'), 'ai-shortdrama-studio')
  fs.mkdirSync(workspaceRoot, { recursive: true })
  return runtimeManager.start({
    userDataDir: app.getPath('userData'),
    cwd: workspaceRoot,
    arkApiKey: process.env.ARK_API_KEY,
    arkModel: process.env.ARK_MODEL,
    arkBaseUrl: process.env.ARK_BASE_URL,
  })
}

/** 业务通道统一包装：首次访问惰性自启；error 态 / 显式 stop 后返回 RUNTIME_NOT_READY；
 *  错误统一归一化（name=code，契约 §5.3/§6.1/§6.4） */
async function withRuntime<T>(fn: () => Promise<T>): Promise<T> {
  const state = runtimeManager.getStatus().state
  if (state === 'error') {
    throw makeRuntimeError('RUNTIME_NOT_READY', '运行时处于错误状态，请显式调用 runtime:start 重新拉起')
  }
  if (state === 'stopped' && runtimeStoppedExplicitly) {
    throw makeRuntimeError('RUNTIME_NOT_READY', '运行时已停止，请显式调用 runtime:start 后再使用')
  }
  if (!runtimeManager.isRunning()) {
    try {
      await ensureRuntime()
    } catch (e) {
      throw normalizeRuntimeError(e)
    }
  }
  try {
    return await fn()
  } catch (e) {
    throw normalizeRuntimeError(e)
  }
}

function armWindow(webContents: WebContents, sessionFilter: string | undefined) {
  runtimeSubscribers.set(webContents.id, { wc: webContents, filter: sessionFilter })
  if (!runtimeArmedWindows.has(webContents.id)) {
    runtimeArmedWindows.add(webContents.id)
    webContents.once('destroyed', () => {
      runtimeArmedWindows.delete(webContents.id)
      if (runtimeSubscribers.delete(webContents.id) && runtimeSubscribers.size === 0) {
        void closeRuntimeEventStream()
      }
    })
  }
}

async function ensureRuntimeEventStream() {
  const conn = runtimeManager.getConnection()
  if (!conn) throw makeRuntimeError('RUNTIME_NOT_READY', 'opencode 运行时未启动')
  if (runtimeEventStream) return
  const status = runtimeManager.getStatus()
  let handle: EventStreamHandle
  try {
    handle = await subscribeEvents({
      conn,
      version: status.version,
      onEvent: broadcastRuntimeEvent,
    })
  } catch (e) {
    throw normalizeRuntimeError(e)
  }
  runtimeEventStream = { handle }
  void handle.closed.then(() => {
    if (runtimeEventStream?.handle === handle) runtimeEventStream = null
  })
}

async function closeRuntimeEventStream() {
  const stream = runtimeEventStream
  runtimeEventStream = null
  if (stream) {
    try {
      await stream.handle.close()
    } catch {
      // 已中断：无需处理
    }
  }
}

/** 按订阅窗口与可选 sessionId 过滤分发；事件保持 SSE 到达顺序（契约 §3.2 规则②） */
function broadcastRuntimeEvent(event: RuntimeEvent) {
  for (const [id, entry] of Array.from(runtimeSubscribers)) {
    const wc = entry.wc
    if (wc.isDestroyed()) {
      runtimeSubscribers.delete(id)
      continue
    }
    if (
      entry.filter !== undefined &&
      'sessionId' in event &&
      typeof event.sessionId === 'string' &&
      event.sessionId !== entry.filter
    ) {
      continue
    }
    wc.send('runtime:event', event)
  }
  if (runtimeSubscribers.size === 0) void closeRuntimeEventStream()
}

// 状态迁移 → 全窗口推 runtime:status-changed（契约 §3.2 规则③）
let lastRuntimeStatusKey = ''
runtimeManager.onStatusChange((status) => {
  const key = [
    status.state,
    status.port ?? '',
    status.version ?? '',
    status.startedAt ?? '',
    status.error ? `${status.error.code}:${status.error.message}` : '',
  ].join('|')
  if (key === lastRuntimeStatusKey) return
  lastRuntimeStatusKey = key
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('runtime:status-changed', status)
  }
  // opencode 子进程异常退出：SSE pump 仅静默收尾、不会投影任何事件，
  // 此处补播 runtime.error 以终结 renderer 正在进行的轮（契约 §5「子进程异常 → runtime.error」）。
  if (status.state === 'error' && status.error) {
    broadcastRuntimeEvent({ type: 'runtime.error', ts: new Date().toISOString(), error: status.error })
  }
  // 重启后仍有订阅窗口：自动重建事件流
  if (status.state === 'running' && runtimeSubscribers.size > 0 && !runtimeEventStream) {
    void ensureRuntimeEventStream().catch(() => {})
  }
})

// 退出清理钩子（契约 §6.3）：先关 SSE、abort 活跃会话，再由 manager 杀子进程
runtimeManager.addBeforeStopHook(async () => {
  await closeRuntimeEventStream()
  try {
    const sessions = await runtimeClient.listSessions()
    await Promise.allSettled(sessions.map((s) => runtimeClient.abortSession(s.id)))
  } catch {
    // 运行时未就绪 / 连接失败：无需中止
  }
})

// -- 12 个 invoke handle（契约 §3.1） -----------------------------------------

ipcMain.handle('runtime:start', async () => {
  if (!runtimeManager.isRunning()) {
    try {
      await ensureRuntime()
      runtimeStoppedExplicitly = false
    } catch (e) {
      throw normalizeRuntimeError(e)
    }
  }
  return runtimeManager.getStatus()
})

ipcMain.handle('runtime:stop', async () => {
  runtimeStoppedExplicitly = true
  try {
    await runtimeManager.stop()
  } catch (e) {
    throw normalizeRuntimeError(e)
  }
  return runtimeManager.getStatus()
})

// runtime:status 永不抛错（契约 §5.3）
ipcMain.handle('runtime:status', () => runtimeManager.getStatus())

ipcMain.handle('runtime:session:create', (_e, arg?: unknown) =>
  withRuntime(async () => {
    let title: string | undefined
    if (arg !== undefined) {
      if (!isRecord(arg) || (arg.title !== undefined && typeof arg.title !== 'string')) {
        throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { title?: string }')
      }
      title = arg.title as string | undefined
    }
    return runtimeClient.createSession(title)
  }),
)

ipcMain.handle('runtime:session:list', () => withRuntime(() => runtimeClient.listSessions()))

ipcMain.handle('runtime:session:abort', (_e, sessionId: unknown) =>
  withRuntime(async () => {
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'sessionId 必须为非空字符串')
    }
    return runtimeClient.abortSession(sessionId)
  }),
)

ipcMain.handle('runtime:session:delete', (_e, sessionId: unknown) =>
  withRuntime(async () => {
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'sessionId 必须为非空字符串')
    }
    return runtimeClient.deleteSession(sessionId)
  }),
)

// 业务失败（结构化校验 / ProviderAuth / abort）经 result.error 返回，不 reject（契约 §5.4）
ipcMain.handle('runtime:prompt', (_e, req: unknown) =>
  withRuntime(() => runtimeClient.prompt(req as Parameters<typeof runtimeClient.prompt>[0])),
)

ipcMain.handle('runtime:prompt:async', (_e, req: unknown) =>
  withRuntime(() => runtimeClient.promptAsync(req as Parameters<typeof runtimeClient.promptAsync>[0])),
)

ipcMain.handle('runtime:event:subscribe', (e, arg?: unknown) =>
  withRuntime(async () => {
    let sessionFilter: string | undefined
    if (arg !== undefined) {
      if (!isRecord(arg) || (arg.sessionId !== undefined && typeof arg.sessionId !== 'string')) {
        throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { sessionId?: string }')
      }
      sessionFilter = arg.sessionId as string | undefined
    }
    armWindow(e.sender, sessionFilter)
    await ensureRuntimeEventStream()
    return { ok: true as const }
  }),
)

// unsubscribe 不触发惰性自启
ipcMain.handle('runtime:event:unsubscribe', (e) => {
  const existed = runtimeSubscribers.delete(e.sender.id)
  if (existed && runtimeSubscribers.size === 0) void closeRuntimeEventStream()
  return { ok: true as const }
})

ipcMain.handle('runtime:agent:list', () => withRuntime(() => runtimeClient.listAgents()))

// -- feature-017：画布 / 裁决门 / 资产 / ComfyUI 设置（8 invoke + 2 推送）------

const canvasSubscribers = new Set<WebContents>()

canvasStore.subscribe((canvas: Canvas) => {
  for (const wc of canvasSubscribers) {
    if (!wc.isDestroyed()) wc.send('canvas:changed', canvas)
  }
})

gateBridge.setGateListener((e: { gate: CanvasGate; title?: string }) => {
  for (const wc of canvasSubscribers) {
    if (!wc.isDestroyed()) wc.send('gate:changed', e)
  }
})

// feature-022 真机修复：无项目时返回空画布而非抛异常，避免启动白屏
ipcMain.handle('canvas:get', async () => {
  try {
    return await canvasStore.get()
  } catch {
    return {
      schemaVersion: 2,
      projectId: '',
      title: '',
      nodes: [],
      edges: [],
      gates: [],
      updatedAt: new Date().toISOString(),
    }
  }
})

ipcMain.handle('canvas:subscribe', (e) => {
  canvasSubscribers.add(e.sender)
  // feature-018 修复：renderer 订阅时重挂 pending 门，确保重启后 decide 可用
  void (async () => {
    try { await gateBridge.recoverPending() } catch { /* 无项目时忽略 */ }
    try {
      const canvas = await canvasStore.get()
      if (!e.sender.isDestroyed()) e.sender.send('canvas:changed', canvas)
    } catch { /* 无项目时不推送 */ }
  })()
  return { ok: true as const }
})

ipcMain.handle('canvas:unsubscribe', (e) => {
  canvasSubscribers.delete(e.sender)
  return { ok: true as const }
})

ipcMain.handle('gate:decide', (_e, arg: unknown) => {
  if (
    typeof arg !== 'object' || arg === null
    || typeof (arg as { gateId?: unknown }).gateId !== 'string'
    || !['approved', 'rejected'].includes(String((arg as { decision?: unknown }).decision))
  ) {
    const err = new Error('参数必须为 { gateId, decision, note? }')
    err.name = 'INVALID_ARGUMENT'
    throw err
  }
  const { gateId, decision, note } = arg as {
    gateId: string
    decision: 'approved' | 'rejected'
    note?: string
  }
  gateBridge.decide(gateId, { decision, note })
  return { ok: true as const }
})

ipcMain.handle('asset:list', (_e, arg?: unknown) => {
  const kind = (arg as { kind?: AssetIndexItem['kind'] } | undefined)?.kind
  return listAssets(kind)
})

// feature-022 · 只读产物查看（契约 §2，D-022-01）：renderer 唯一读文件通道
ipcMain.handle('file:read', async (_e, arg: unknown) => {
  const rel = typeof arg === 'object' && arg !== null && 'path' in arg
    ? (arg as { path: unknown }).path
    : undefined
  let root: string
  try {
    root = getActiveProjectDir()
  } catch {
    return { ok: false, error: { code: 'NO_PROJECT', message: '当前没有打开的项目' } }
  }
  return readProjectFile(root, typeof rel === 'string' ? rel : '')
})

ipcMain.handle('settings:comfy:list', () => listInstances())

ipcMain.handle('settings:comfy:upsert', (_e, instance: unknown) =>
  upsertInstance(instance as Partial<ComfyInstance>))

ipcMain.handle('settings:comfy:remove', (_e, arg: unknown) => {
  const id = (arg as { id?: unknown } | undefined)?.id
  if (typeof id !== 'string') {
    const err = new Error('参数必须为 { id }')
    err.name = 'INVALID_ARGUMENT'
    throw err
  }
  return removeInstance(id)
})

app.whenReady().then(() => {
  // 开发态启用辅助功能树（供自动化验证读取 UI 语义；feature-005 T9 真机验证辅助，无业务影响）
  if (process.env.VITE_DEV_SERVER_URL) app.setAccessibilitySupportEnabled(true)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 退出清理（契约 §6.3）：beforeStopHook（关 SSE / abort 会话）→ SIGTERM → 超时 SIGKILL
let runtimeQuitting = false
app.on('before-quit', (event) => {
  if (runtimeQuitting) return
  if (runtimeManager.getStatus().state === 'stopped') {
    gateBridge.settleAll()
    return
  }
  runtimeQuitting = true
  event.preventDefault()
  gateBridge.settleAll()
  void runtimeManager.stop().finally(() => {
    runtimeQuitting = false
    app.quit()
  })
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
