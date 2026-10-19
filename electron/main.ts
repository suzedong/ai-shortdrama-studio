import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { WebContents } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  listProjects,
  createProject,
  openProject,
  readActiveSession,
  readProjectTitle,
  setActiveSession,
  renameProject,
  deleteProject,
} from './project/library.js'
import { isConfigured } from './ark.js'
import { canvasStore } from './canvas/store.js'
import { gateBridge } from './gate/bridge.js'
import { listAssets } from './asset/index.js'
import { readProjectFile } from './fs/read.js'
import { getActiveProjectDir } from './project/current.js'
import { updateBriefFields, type BriefUpdatePatch } from './brief/update.js'
import { readBriefHistory, readBriefVersion } from './brief/history.js'
import { rollbackBriefToVersion } from './brief/rollback.js'
import { captureStore, type CaptureUpsertInput } from './capture/store.js'
import { listInstances, upsertInstance, removeInstance } from './comfy/settings.js'
import type {
  Canvas, CanvasGate, ComfyInstance, AssetIndexItem, CaptureFile,
} from '../shared/types.js'
import { runtimeManager } from './runtime/manager.js'
import { OpencodeRuntimeClient } from './runtime/client.js'
import { subscribeEvents, type EventStreamHandle } from './runtime/projection.js'
import type { RuntimeEvent, RuntimeStatus } from './runtime/types.js'
import { windowChromeOptions, type WindowPlatform } from './window/chrome.js'

/** process.platform 收窄到三分支：非 darwin/win32 的类 Unix 一律按 linux 自绘外壳处理 */
const windowPlatform: WindowPlatform =
  process.platform === 'darwin' ? 'darwin'
    : process.platform === 'win32' ? 'win32'
      : 'linux'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    ...windowChromeOptions(windowPlatform),
    backgroundColor: '#FAFAFE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // feature-804：最大化/还原状态推送（双击标题栏、Win+↑、Aero Snap 等多入口状态同步）
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-changed', { maximized: true })
    }
  })
  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-changed', { maximized: false })
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // Markdown 气泡（及渲染层任何 target=_blank）外链：禁止应用内开新窗，http(s) 转系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// feature-804 · 窗口控制 IPC（契约 §2，K8 登记：window:* 四 invoke + 一推送）
// 单窗口应用：只操作模块内 mainWindow 单例；窗口销毁竞态返回 WINDOW_UNAVAILABLE，不抛未捕获异常。
ipcMain.handle('window:minimize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: { code: 'WINDOW_UNAVAILABLE' } }
  }
  mainWindow.minimize()
  return { ok: true }
})

ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: { code: 'WINDOW_UNAVAILABLE' } }
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
  return { ok: true, maximized: mainWindow.isMaximized() }
})

ipcMain.handle('window:is-maximized', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: true, maximized: false }
  }
  return { ok: true, maximized: mainWindow.isMaximized() }
})

ipcMain.handle('window:close', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: { code: 'WINDOW_UNAVAILABLE' } }
  }
  mainWindow.close()
  return { ok: true }
})

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
    // 真机修复：切项目后主动推送新画布（persist 才会广播，reset 不会）
    try {
      // B-23：项目名双源归一——以 .session.json 为准同步 canvas.title
      // （emptyCanvas 写死「新项目」；create 场景由 ProjectNav 串联 open 一并覆盖；
      // 同步失败不致命，renderer 退化为显示画布旧 title）
      const title = await readProjectTitle(dir)
      const canvas = await canvasStore.get()
      if (title !== null && canvas.title !== title) {
        await canvasStore.withCanvas(c => {
          c.title = title
        })
      }
      const fresh = await canvasStore.get()
      for (const wc of canvasSubscribers) {
        if (!wc.isDestroyed()) wc.send('canvas:changed', fresh)
      }
    } catch {
      // 新项目目录异常时忽略，renderer 保持当前态
    }
    return res
  })
})

// B-19：项目改名/删除（原契约之外最小增补，K8 已批）
// 改名当前项目时顺带 canvasStore.withCanvas 同步 canvas.title（persist+广播，顶栏即时刷新）
ipcMain.handle('project:rename', (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.dir !== 'string' || typeof arg.title !== 'string') {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { dir: string, title: string }')
  }
  // 提取为局部 const：属性收窄不进 .then 闭包
  const dir = arg.dir
  const title = arg.title
  return renameProject(dir, title).then(async res => {
    let activeDir: string | null = null
    try {
      activeDir = getActiveProjectDir()
    } catch {
      activeDir = null // 无当前项目：不同步画布
    }
    if (activeDir !== null && activeDir === path.resolve(dir)) {
      try {
        await canvasStore.withCanvas(c => {
          c.title = res.title
        })
      } catch {
        // 画布同步失败不致命：.session.json 已改名
      }
    }
    return res
  })
})
ipcMain.handle('project:delete', (_e, dir: unknown) => {
  if (typeof dir !== 'string') {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为项目目录字符串')
  }
  return deleteProject(dir)
})

// D-017：修改立项面板直写（原则六 · 系统优先；K1 加 'ui' / K8 恰 1 IPC 已批）
// patch 仅受理六控件字段白名单（kind 枚举校验，其余逐键 typeof string）；approve.by 恒 'ui'、decisions 恒全 'mark'；
// 画布经 persistInQueue → canvasStore.subscribe 自动广播 canvas:changed，无需手动推送。
ipcMain.handle('brief:update', (_e, arg: unknown) => {
  if (!isRecord(arg)) {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { kind?, fiveElements?, style? }')
  }
  const patch: BriefUpdatePatch = {}
  if (arg.kind !== undefined) {
    if (arg.kind !== 'commercial' && arg.kind !== 'memorial') {
      throw makeRuntimeError('INVALID_ARGUMENT', "kind 必须为 'commercial' | 'memorial'")
    }
    patch.kind = arg.kind
  }
  if (arg.fiveElements !== undefined) {
    if (!isRecord(arg.fiveElements)) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'fiveElements 必须为对象')
    }
    const fe: NonNullable<BriefUpdatePatch['fiveElements']> = {}
    for (const key of ['episodeDuration', 'episodeCount', 'aspectRatio'] as const) {
      const v = arg.fiveElements[key]
      if (v !== undefined) {
        if (typeof v !== 'string') {
          throw makeRuntimeError('INVALID_ARGUMENT', `fiveElements.${key} 必须为字符串`)
        }
        fe[key] = v
      }
    }
    patch.fiveElements = fe
  }
  if (arg.style !== undefined) {
    if (!isRecord(arg.style)) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'style 必须为对象')
    }
    const st: NonNullable<BriefUpdatePatch['style']> = {}
    for (const key of ['mainStyleId', 'auxiliaryStyleId'] as const) {
      const v = arg.style[key]
      if (v !== undefined) {
        if (typeof v !== 'string') {
          throw makeRuntimeError('INVALID_ARGUMENT', `style.${key} 必须为字符串`)
        }
        st[key] = v
      }
    }
    patch.style = st
  }
  if (patch.kind === undefined && patch.fiveElements === undefined && patch.style === undefined) {
    throw makeRuntimeError('INVALID_ARGUMENT', 'patch 不能为空：至少提供 kind / fiveElements / style 一组字段')
  }
  return updateBriefFields(getActiveProjectDir(), patch).then(res => ({ ok: true as const, ...res }))
})

// feature-004：立项单历史与回滚（设计 §2.6.5 末条/§2.6.7；D-016 系统直做不经 AI；K8 恰 3 IPC 已批）
// 复用零 diff：history=逐版全文提取元数据，version-read=diffBrief(vK, 最新)，rollback=复刻 update.ts 编排发新版。
ipcMain.handle('brief:history', () => {
  return readBriefHistory(getActiveProjectDir())
})
ipcMain.handle('brief:version-read', (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.version !== 'number' || !Number.isInteger(arg.version) || arg.version < 1) {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { version: 正整数 }')
  }
  return readBriefVersion(getActiveProjectDir(), arg.version)
})
ipcMain.handle('brief:rollback', (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.version !== 'number' || !Number.isInteger(arg.version) || arg.version < 1) {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { version: 正整数 }')
  }
  return rollbackBriefToVersion(getActiveProjectDir(), arg.version).then(res => ({ ok: true as const, ...res }))
})

// feature-005：「已捕获口径」（设计 §2.6.1/§2.6.8；D-016 双通道同库同追溯；K8 恰 3 IPC + 1 推送已批）
// 薄壳调 captureStore（与 MCP capture.* 同一读写点）；写成功后经 subscribe 向全部窗口广播 capture:changed（全量 CaptureFile）。
captureStore.subscribe((file: CaptureFile) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('capture:changed', file)
  }
})

ipcMain.handle('capture:list', () => {
  return captureStore.list()
})
ipcMain.handle('capture:upsert', (_e, arg: unknown) => {
  if (!isRecord(arg)) {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { id?, topic?, value?, source?, status?, quote? }')
  }
  const input: CaptureUpsertInput = {}
  if (arg.id !== undefined) {
    if (typeof arg.id !== 'string') throw makeRuntimeError('INVALID_ARGUMENT', 'id 必须为字符串')
    input.id = arg.id
  }
  for (const key of ['topic', 'value', 'quote'] as const) {
    const v = arg[key]
    if (v !== undefined) {
      if (typeof v !== 'string') throw makeRuntimeError('INVALID_ARGUMENT', `${key} 必须为字符串`)
      input[key] = v
    }
  }
  if (arg.source !== undefined) {
    if (arg.source !== 'user' && arg.source !== 'infer') {
      throw makeRuntimeError('INVALID_ARGUMENT', "source 必须为 'user' | 'infer'")
    }
    input.source = arg.source
  }
  if (arg.status !== undefined) {
    if (arg.status !== 'pending' && arg.status !== 'confirmed') {
      throw makeRuntimeError('INVALID_ARGUMENT', "status 必须为 'pending' | 'confirmed'")
    }
    input.status = arg.status
  }
  return captureStore.upsert(input)
})
ipcMain.handle('capture:remove', (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.id !== 'string' || arg.id.length === 0) {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { id: 非空字符串 }')
  }
  return captureStore.remove(arg.id)
})

// feature-808：当前项目绑定会话的读/写双态（不经 withRuntime，绝不因读绑定拉起 opencode）
// 无参 = 读态（无项目/无绑定 → { sessionId: null }，不抛错）；
// { sessionId: string } = 绑定；{ sessionId: null } = 清空（写态无项目抛 INVALID_ARGUMENT）。
ipcMain.handle('project:active-session', (_e, arg?: unknown) => {
  if (arg !== undefined) {
    if (
      !isRecord(arg) ||
      !(typeof arg.sessionId === 'string' || arg.sessionId === null) ||
      (typeof arg.sessionId === 'string' && arg.sessionId.trim().length === 0)
    ) {
      throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { sessionId: string | null }')
    }
    const dir = getActiveProjectDir() // 无项目抛 INVALID_ARGUMENT，写态不吞
    return setActiveSession(dir, arg.sessionId)
  }
  let dir: string
  try {
    dir = getActiveProjectDir()
  } catch {
    return { sessionId: null }
  }
  return readActiveSession(dir)
})

// feature-011：只读查询文本侧配置状态（供底栏诚实显示：未配置/已配置）
ipcMain.handle('app:config-status', () => ({ arkConfigured: isConfigured() }))

// ============================================================================
// feature-008 · Agent 运行时（opencode 基座）IPC —— 严格匹配契约 §3/§5/§6/§8
// 命名空间 runtime:* 与既有通道完全隔离。
// 旧壳 IPC（project:save/template/session/chat/archive/workflow）已全部下线。
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

// feature-808：会话历史回放读（文本 DTO）；404 → SESSION_NOT_FOUND 由 client 归一
ipcMain.handle('runtime:session:messages', (_e, arg: unknown) =>
  withRuntime(async () => {
    let sessionId: string
    if (typeof arg === 'string') sessionId = arg
    else if (isRecord(arg) && typeof arg.sessionId === 'string') sessionId = arg.sessionId
    else throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { sessionId: string }')
    if (sessionId.trim().length === 0) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'sessionId 必须为非空字符串')
    }
    return runtimeClient.getSessionMessages(sessionId)
  }),
)

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

// 真机修复：无项目时返回空画布而非抛异常，避免启动白屏
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

// 只读产物查看：renderer 唯一读文件通道
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
