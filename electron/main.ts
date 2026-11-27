import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { WebContents } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
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
import {
  getProjectDetail,
  importProject,
  exportProject,
  recordSessionSource,
  assertWorkspaceProject,
} from './project/transfer.js'
import { isConfigured } from './ark.js'
import {
  getActiveProvider,
  getArkConfig,
  getLmStudioConfig,
  getRuntimePrefs,
  getSettingsView,
  updateSettings,
  type AiServiceUpdatePatch,
} from './settings/ai-service.js'
// feature-813 · 工作区根目录（单一全局根，可更换；K8 已批，契约见 feature-813 任务包）
import {
  changeDir,
  getSettingsView as getWorkspaceSettingsView,
  pickDir,
  resolveWorkspaceRoot,
} from './settings/workspace.js'
import { canvasStore } from './canvas/store.js'
import { gateBridge } from './gate/bridge.js'
import {
  listAssets,
  captureAssetSource,
  resolvePromptAssetRefs,
} from './asset/index.js'
import { importImageFromPath, readAssetThumbnail } from './asset/image.js'
import { readProjectFile } from './fs/read.js'
import { getActiveProjectDir } from './project/current.js'
import { updateBriefFields, type BriefUpdatePatch } from './brief/update.js'
import { loadStyleCatalog } from './style/loader.js'
import { readStylePreviewMetadata } from './style/preview-metadata.js'
import { computeStyleUpgradeDiff } from './style/upgrade.js'
import { readBriefHistory, readBriefVersion } from './brief/history.js'
import { rollbackBriefToVersion } from './brief/rollback.js'
import { captureStore, type CaptureUpsertInput } from './capture/store.js'
import {
  listInstances, upsertInstance, removeInstance, type ComfyInstanceConfig,
} from './comfy/settings.js'
import { ComfyEngine } from './comfy/engine.js'
import { setComfyClient } from './comfy/client.js'
import type {
  Canvas, AssetIndexItem, CaptureFile,
} from '../shared/types.js'
import { runtimeManager } from './runtime/manager.js'
import { resolveRuntimeProxyEnv } from './network.js'
import { OpencodeRuntimeClient } from './runtime/client.js'
import { AgentRunStore } from './runtime/run-store.js'
import { subscribeEvents, type EventStreamHandle } from './runtime/projection.js'
import type {
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimeResolvedAsset,
  RuntimeStatus,
} from './runtime/types.js'
import { windowChromeOptions, type WindowPlatform } from './window/chrome.js'

// feature-830（契约 §2.1）：验收环境隔离 userData 的可选钩子。未设置 ASD_USER_DATA 时
// 行为与生产完全一致；设置时 documents 仍为真实用户目录，故工作区根仍是
// ~/Documents/ai-shortdrama-studio，配置 / 会话 / ComfyUI 实例则落到隔离目录。
// 必须早于首次 app.getPath('userData')（本文件下方及 settings/* 内均为函数体调用）。
if (process.env.ASD_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.ASD_USER_DATA))
}

/** process.platform 收窄到三分支：非 darwin/win32 的类 Unix 一律按 linux 自绘外壳处理 */
const windowPlatform: WindowPlatform =
  process.platform === 'darwin' ? 'darwin'
    : process.platform === 'win32' ? 'win32'
      : 'linux'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 主进程唯一媒体引擎；renderer 不持有 ComfyUI 网络客户端。
const comfyEngine = new ComfyEngine()
setComfyClient(comfyEngine)

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
  return openProject(dir, resolved => canvasStore.assertReadable(resolved)).then(async res => {
    // feature-017/018：清算旧门 → 丢弃画布投影 → 重挂新项目的 pending 门（顺序固定）
    gateBridge.clearLive()
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
ipcMain.handle('project:detail', (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.dir !== 'string') {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { dir: string }')
  }
  return getProjectDetail(arg.dir)
})
ipcMain.handle('project:reveal', async (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.dir !== 'string') {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { dir: string }')
  }
  await assertWorkspaceProject(arg.dir)
  shell.showItemInFolder(path.resolve(arg.dir))
  return { ok: true as const }
})
ipcMain.handle('project:import', async () => {
  const picked = await dialog.showOpenDialog({
    title: '导入静态项目包',
    buttonLabel: '导入',
    properties: ['openDirectory'],
  })
  if (picked.canceled || picked.filePaths.length === 0) return { canceled: true as const }
  const result = await importProject(picked.filePaths[0])
  return { canceled: false as const, dir: result.dir }
})
ipcMain.handle('project:export', async (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.dir !== 'string') {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { dir: string }')
  }
  const dir = arg.dir
  await assertWorkspaceProject(dir)
  const picked = await dialog.showSaveDialog({
    title: '导出静态项目包',
    buttonLabel: '导出',
    defaultPath: path.join(app.getPath('documents'), `${path.basename(dir)}-导出`),
    properties: ['createDirectory'],
  })
  if (picked.canceled || !picked.filePath) return { canceled: true as const }
  const result = await exportProject(dir, picked.filePath, (sessionId) =>
    withRuntime(() => runtimeClient.getSessionMessages(sessionId)),
  )
  return { canceled: false as const, ...result }
})

// D-017：修改立项面板直写（原则六 · 系统优先；K1 加 'ui' / K8 恰 1 IPC 已批）
// patch 仅受理面板字段白名单（kind 枚举校验，其余逐键 typeof string；数组逐元素非空）；approve.by 恒 'ui'、decisions 恒全 'mark'；
// 画布经 persistInQueue → canvasStore.subscribe 自动广播 canvas:changed，无需手动推送。
ipcMain.handle('brief:update', (_e, arg: unknown) => {
  if (!isRecord(arg)) {
    throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { kind?, fiveElements?, premise?, style?, diagnosisSummary?, l0? }')
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
    for (const key of ['episodeDuration', 'episodeCount', 'aspectRatio', 'genre', 'tone'] as const) {
      const v = arg.fiveElements[key]
      if (v !== undefined) {
        if (typeof v !== 'string') {
          throw makeRuntimeError('INVALID_ARGUMENT', `fiveElements.${key} 必须为字符串`)
        }
        fe[key] = v
      }
    }
    // feature-013：platforms 数组（逐元素非空字符串）
    if (arg.fiveElements.platforms !== undefined) {
      const v = arg.fiveElements.platforms
      if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || x.trim() === '')) {
        throw makeRuntimeError('INVALID_ARGUMENT', 'fiveElements.platforms 必须为非空字符串数组')
      }
      fe.platforms = v as string[]
    }
    patch.fiveElements = fe
  }
  // feature-013：premise 五子项（逐键字符串；空串由就绪闸 PREMISE_MISSING 拦截）
  if (arg.premise !== undefined) {
    if (!isRecord(arg.premise)) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'premise 必须为对象')
    }
    const pr: NonNullable<BriefUpdatePatch['premise']> = {}
    for (const key of ['leads', 'time', 'place', 'coreEvent', 'seasonBoundary'] as const) {
      const v = arg.premise[key]
      if (v !== undefined) {
        if (typeof v !== 'string') {
          throw makeRuntimeError('INVALID_ARGUMENT', `premise.${key} 必须为字符串`)
        }
        pr[key] = v
      }
    }
    patch.premise = pr
  }
  if (arg.style !== undefined) {
    if (!isRecord(arg.style)) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'style 必须为对象')
    }
    const st: NonNullable<BriefUpdatePatch['style']> = {}
    // feature-810：白名单 +catalogVersion（谱系升级采纳仅升版本号，K8 已批扩键）
    for (const key of ['mainStyleId', 'auxiliaryStyleId', 'catalogVersion'] as const) {
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
  // feature-013：诊断结论可直改（诊断明细保持只读，不在白名单）
  if (arg.diagnosisSummary !== undefined) {
    if (typeof arg.diagnosisSummary !== 'string') {
      throw makeRuntimeError('INVALID_ARGUMENT', 'diagnosisSummary 必须为字符串')
    }
    patch.diagnosisSummary = arg.diagnosisSummary
  }
  // feature-013：L0 标签/备注（决策点 1 拍板 A 入模）
  if (arg.l0 !== undefined) {
    if (!isRecord(arg.l0)) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'l0 必须为对象')
    }
    const l0: NonNullable<BriefUpdatePatch['l0']> = {}
    if (arg.l0.tags !== undefined) {
      const v = arg.l0.tags
      if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || x.trim() === '')) {
        throw makeRuntimeError('INVALID_ARGUMENT', 'l0.tags 必须为非空字符串数组')
      }
      l0.tags = v as string[]
    }
    if (arg.l0.notes !== undefined) {
      if (typeof arg.l0.notes !== 'string') {
        throw makeRuntimeError('INVALID_ARGUMENT', 'l0.notes 必须为字符串')
      }
      l0.notes = arg.l0.notes
    }
    patch.l0 = l0
  }
  if (
    patch.kind === undefined &&
    patch.fiveElements === undefined &&
    patch.premise === undefined &&
    patch.style === undefined &&
    patch.diagnosisSummary === undefined &&
    patch.l0 === undefined
  ) {
    throw makeRuntimeError('INVALID_ARGUMENT', 'patch 不能为空：至少提供 kind / fiveElements / premise / style / diagnosisSummary / l0 一组字段')
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

// feature-810：谱系升级差异工作流（设计 §2.6.4/§8.3；K8 恰 2 IPC 已批；零推送，面板打开时主动拉取）
// style:catalog 与 MCP style.catalog 同形状、同经 loadStyleCatalog()（不依赖激活项目）；
// style:upgrade-diff 无项目/无立项按契约 §1 空态返回（noBrief:true），谱系装载失败三码不降级直接抛。
ipcMain.handle('style:catalog', async () => {
  const catalog = await loadStyleCatalog()
  return { version: catalog.version, count: catalog.entries.length, entries: catalog.entries }
})
// feature-815 · 当前风格 PNG / MP4 内嵌 ComfyUI 元数据（封闭只读桥）
ipcMain.handle('style:preview-metadata', (_event, request: unknown) => readStylePreviewMetadata(request))
ipcMain.handle('style:upgrade-diff', async () => {
  let dir: string | null = null
  try {
    dir = getActiveProjectDir()
  } catch {
    dir = null // 无激活项目 → 空态（契约 §1）
  }
  return computeStyleUpgradeDiff(dir)
})

// feature-808：当前项目绑定会话的读/写双态（不经 withRuntime，绝不因读绑定拉起 opencode）
// 无参 = 读态（无项目/无绑定 → { sessionId: null }，不抛错）；
// { sessionId: string } = 绑定；{ sessionId: null } = 清空（写态无项目抛 INVALID_ARGUMENT）。
ipcMain.handle('project:active-session', async (_e, arg?: unknown) => {
  if (arg !== undefined) {
    if (
      !isRecord(arg) ||
      !(typeof arg.sessionId === 'string' || arg.sessionId === null) ||
      (typeof arg.sessionId === 'string' && arg.sessionId.trim().length === 0)
    ) {
      throw makeRuntimeError('INVALID_ARGUMENT', '参数必须为 { sessionId: string | null }')
    }
    const dir = getActiveProjectDir() // 无项目抛 INVALID_ARGUMENT，写态不吞
    const result = await setActiveSession(dir, arg.sessionId)
    if (arg.sessionId) await recordSessionSource(dir, arg.sessionId)
    return result
  }
  let dir: string
  try {
    dir = getActiveProjectDir()
  } catch {
    return { sessionId: null }
  }
  return readActiveSession(dir)
})

// feature-011：只读查询当前文本服务商配置状态（返回形状保持不变）
ipcMain.handle('app:config-status', () => ({
  arkConfigured: getActiveProvider() === 'lmstudio'
    ? !!getLmStudioConfig().model
    : isConfigured(),
}))

// ============================================================================
// feature-008 · Agent 运行时（opencode 基座）IPC —— 严格匹配契约 §3/§5/§6/§8
// 命名空间 runtime:* 与既有通道完全隔离。
// 旧壳 IPC（project:save/template/session/chat/archive/workflow）已全部下线。
// ============================================================================

const runtimeClient = new OpencodeRuntimeClient({
  getConnection: () => runtimeManager.getConnection(),
  // feature-014：改读 store→env 合并值（getter 同步读内存副本，面板改模型后下一条消息生效）
  get allowedArkModel() {
    return getArkConfig().model
  },
  get allowedLmStudioModel() {
    return getLmStudioConfig().model
  },
})

// feature-808/817 · 项目级运行账本。已加载 store 跨项目切换保留，确保旧项目迟到事件仍能找到原运行。
const runStores = new Map<string, AgentRunStore>()
const runStoreBySession = new Map<string, AgentRunStore>()
let runtimeStopInProgress = false

function getRunStore(projectDir = getActiveProjectDir()): AgentRunStore {
  const root = path.resolve(projectDir)
  let store = runStores.get(root)
  if (!store) {
    store = new AgentRunStore(root)
    runStores.set(root, store)
  }
  return store
}

function errorText(error: unknown, fallback = '运行失败'): string {
  if (error instanceof Error && error.message) return error.message
  if (isRecord(error)) {
    if (isRecord(error.data) && typeof error.data.message === 'string') return error.data.message
    if (typeof error.message === 'string') return error.message
  }
  return fallback
}

async function eachRunStore(
  action: (store: AgentRunStore) => Promise<unknown>,
): Promise<void> {
  for (const store of runStores.values()) {
    try {
      await action(store)
    } catch (error) {
      console.error('[agent-run] 运行账本状态收尾失败', error)
    }
  }
}

async function updateRunFromEvent(event: RuntimeEvent): Promise<void> {
  if (event.type !== 'session.idle' && event.type !== 'runtime.error') return
  const sessionId = event.sessionId
  if (!sessionId) return
  const store = runStoreBySession.get(sessionId)
  if (!store) return
  const active = await store.active(sessionId)
  if (!active) return

  if (event.type === 'session.idle') {
    await store.transition(active.id, active.status === 'stopping' ? 'stopped' : 'completed')
    return
  }
  const stoppedByPromptAbort = active.status === 'stopping' && event.error.code === 'PROMPT_ABORTED'
  await store.transition(
    active.id,
    stoppedByPromptAbort ? 'stopped' : 'failed',
    stoppedByPromptAbort ? undefined : event.error.message,
  )
}

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
  'NO_ACTIVE_PROJECT',
  'PROJECT_CHANGED',
  'ASSET_REF_INVALID',
  'ASSET_REF_NOT_FOUND',
  'ASSET_REF_NOT_REGULAR_FILE',
  'ASSET_REF_UNSUPPORTED',
  'ASSET_INDEX_CORRUPT',
  'ASSET_NOT_FOUND',
  'PATH_ESCAPE_DENIED',
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
  // serve cwd 取平台工作区根目录（feature-813：根目录可更换，取设置 store 生效值）；确保目录存在，否则 spawn ENOENT
  const workspaceRoot = resolveWorkspaceRoot()
  fs.mkdirSync(workspaceRoot, { recursive: true })
  // feature-014：固定双服务商与运行时参数取 store→env→default 合并值
  const activeProvider = getActiveProvider()
  const ark = getArkConfig()
  const lmStudio = getLmStudioConfig()
  const prefs = getRuntimePrefs()
  const providerUrl = activeProvider === 'lmstudio' ? lmStudio.baseUrl : ark.baseUrl
  const proxyEnv = await resolveRuntimeProxyEnv(providerUrl)
  return runtimeManager.start({
    userDataDir: app.getPath('userData'),
    cwd: workspaceRoot,
    activeProvider,
    arkApiKey: ark.apiKey,
    arkModel: ark.model,
    arkBaseUrl: ark.baseUrl,
    lmStudioModel: lmStudio.model,
    lmStudioBaseUrl: lmStudio.baseUrl,
    portRangeStart: prefs.portRangeStart,
    healthTimeoutMs: prefs.healthTimeoutMs,
    mockBaseUrl: prefs.mockBaseUrl,
    proxyEnv,
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

/** 按订阅窗口与可选 sessionId 过滤分发；生命周期落账后再分发，事件保持 SSE 到达顺序。 */
async function broadcastRuntimeEvent(event: RuntimeEvent): Promise<void> {
  try {
    await updateRunFromEvent(event)
  } catch (error) {
    console.error('[agent-run] 运行事件落账失败', error)
  }
  void captureAssetSource(event).catch(error => {
    console.error('[canvas-814] asset source capture failed', error)
  })
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
    const event = { type: 'runtime.error', ts: new Date().toISOString(), error: status.error } as const
    if (!runtimeStopInProgress) {
      void eachRunStore(store => store.interruptActive()).then(() => broadcastRuntimeEvent(event))
    } else {
      void broadcastRuntimeEvent(event)
    }
  }
  // 重启后仍有订阅窗口：自动重建事件流
  if (status.state === 'running' && runtimeSubscribers.size > 0 && !runtimeEventStream) {
    void ensureRuntimeEventStream().catch(() => {})
  }
})

// 退出清理钩子（契约 §6.3）：先关 SSE、abort 活跃会话，再由 manager 杀子进程
runtimeManager.addBeforeStopHook(async () => {
  await closeRuntimeEventStream()
  await eachRunStore(store => store.stopActive(undefined, 'stopping'))
  try {
    const sessions = await runtimeClient.listSessions()
    await Promise.allSettled(sessions.map((s) => runtimeClient.abortSession(s.id)))
  } catch {
    // 运行时未就绪 / 连接失败：无需中止
  }
})

async function resolveRuntimePromptAssets(
  req: RuntimePromptRequest,
): Promise<RuntimeResolvedAsset[]> {
  if (req.assetRefs === undefined || (Array.isArray(req.assetRefs) && req.assetRefs.length === 0)) {
    return []
  }
  if (!Array.isArray(req.assetRefs)) throw makeRuntimeError('ASSET_REF_INVALID', '资产引用格式不正确')
  const currentRoot = (): string | null => {
    try {
      return getActiveProjectDir()
    } catch {
      return null
    }
  }
  const projectRoot = currentRoot()
  if (!projectRoot) throw makeRuntimeError('NO_ACTIVE_PROJECT', '请先打开一个项目，再引用项目资产')
  const canvas = await canvasStore.get()
  if (currentRoot() !== projectRoot) {
    throw makeRuntimeError('PROJECT_CHANGED', '项目已切换，本次资产引用已取消')
  }
  const projectId = canvas.projectId
  if (!projectId) throw makeRuntimeError('NO_ACTIVE_PROJECT', '当前项目尚未初始化，无法引用资产')
  const resolved = await resolvePromptAssetRefs(req.assetRefs, projectRoot)
  if (currentRoot() !== projectRoot) {
    throw makeRuntimeError('PROJECT_CHANGED', '项目已切换，本次资产引用已取消')
  }
  const current = await canvasStore.get()
  if (currentRoot() !== projectRoot || current.projectId !== projectId) {
    throw makeRuntimeError('PROJECT_CHANGED', '项目已切换，本次资产引用已取消')
  }
  return resolved
}

async function submitPromptAsync(
  promptReq: RuntimePromptRequest,
  retryOfMessageId?: string,
): Promise<{ accepted: true; messageId: string }> {
  return withRuntime(async () => {
    if (typeof promptReq.sessionId !== 'string' || promptReq.sessionId.trim().length === 0
      || typeof promptReq.text !== 'string' || promptReq.text.trim().length === 0) {
      throw makeRuntimeError('INVALID_ARGUMENT', 'sessionId 与 text 必须为非空字符串')
    }
    const store = getRunStore()
    const messageId = `msg_${crypto.randomUUID()}`
    let started = false
    try {
      await store.start(messageId, promptReq, retryOfMessageId)
      started = true
      runStoreBySession.set(promptReq.sessionId, store)
      const resolvedAssets = await resolveRuntimePromptAssets(promptReq)
      return await runtimeClient.promptAsync(promptReq, resolvedAssets, messageId)
    } catch (error) {
      if (started) await store.transition(messageId, 'failed', errorText(error))
      throw error
    }
  })
}

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
  runtimeStopInProgress = true
  try {
    await runtimeManager.stop()
    await eachRunStore(store => store.stopActive(undefined, 'stopped'))
  } catch (e) {
    throw normalizeRuntimeError(e)
  } finally {
    runtimeStopInProgress = false
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
    const store = runStoreBySession.get(sessionId)
    const active = store ? await store.active(sessionId) : undefined
    if (store && active) await store.transition(active.id, 'stopping')
    try {
      const result = await runtimeClient.abortSession(sessionId)
      if (store && active) await store.transition(active.id, 'stopped')
      return result
    } catch (error) {
      if (store && active) {
        const stoppedByPromptAbort = error instanceof Error && error.name === 'PROMPT_ABORTED'
        await store.transition(
          active.id,
          stoppedByPromptAbort ? 'stopped' : 'failed',
          stoppedByPromptAbort ? undefined : errorText(error),
        )
      }
      throw error
    }
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
  withRuntime(async () => {
    if (!isRecord(req)) throw makeRuntimeError('INVALID_ARGUMENT', 'prompt 请求体缺失')
    const promptReq = req as unknown as RuntimePromptRequest
    const assets = await resolveRuntimePromptAssets(promptReq)
    return runtimeClient.prompt(promptReq, assets)
  }),
)

ipcMain.handle('runtime:prompt:async', (_e, req: unknown) => {
  if (!isRecord(req)) throw makeRuntimeError('INVALID_ARGUMENT', 'prompt 请求体缺失')
  return submitPromptAsync(req as unknown as RuntimePromptRequest)
})

ipcMain.handle('runtime:runs', () => getRunStore().list())

ipcMain.handle('runtime:run:retry', async (_e, messageId: unknown) => {
  if (typeof messageId !== 'string' || messageId.length === 0) {
    throw makeRuntimeError('INVALID_ARGUMENT', 'messageId 必须为非空字符串')
  }
  const projectDir = getActiveProjectDir()
  const store = getRunStore(projectDir)
  const run = await store.get(messageId)
  if (!run || run.status !== 'interrupted') {
    throw makeRuntimeError('INVALID_ARGUMENT', '仅可重试当前项目的已中断运行')
  }
  const binding = await readActiveSession(projectDir)
  if (binding.sessionId !== run.sessionId) {
    throw makeRuntimeError('INVALID_ARGUMENT', '仅可重试当前绑定会话的已中断运行')
  }
  const canvas = await canvasStore.get()
  if (canvas.gates.some(gate => gate.status === 'pending')) {
    throw makeRuntimeError('INVALID_ARGUMENT', '请先完成未决 Gate，再重试已中断运行')
  }
  if (await store.active(run.sessionId)) {
    throw makeRuntimeError('INTERNAL', '当前会话存在尚未结束的运行，不能并发重试')
  }
  return submitPromptAsync({ ...run.request, sessionId: run.sessionId }, run.id)
})

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

gateBridge.setGateListener((e) => {
  for (const wc of canvasSubscribers) {
    if (!wc.isDestroyed()) wc.send('gate:changed', e)
  }
})

// 无激活项目返回空态；已存在坏档必须上抛，禁止覆盖为空画布。
ipcMain.handle('canvas:get', async () => {
  try {
    return await canvasStore.get()
  } catch (error) {
    if ((error as { code?: string }).code === 'NO_ACTIVE_PROJECT') return null
    throw error
  }
})

// feature-814 · 系统直改命令（本批仅 assets.bind / assets.unbind）
ipcMain.handle('canvas:command', async (_e, request: unknown) => {
  return canvasStore.command(request as import('../shared/types.js').CanvasCommandRequest)
})

// feature-823 · 活动页/画布、canvas/stage0 与逐画布视口；不进入 revision/receipts。
ipcMain.handle('canvas:view-state', async (_e, request: unknown) => {
  return canvasStore.viewState(request as import('../shared/types.js').CanvasViewStateRequest)
})

ipcMain.handle('canvas:subscribe', (e) => {
  canvasSubscribers.add(e.sender)
  // 门重挂修复：renderer 订阅时重挂 pending 门，确保重启后 decide 可用
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

ipcMain.handle('gate:decide', async (_e, arg: unknown) => {
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
  return gateBridge.decide(gateId, { decision, note })
})

ipcMain.handle('asset:list', (_e, arg?: unknown) => {
  const kind = (arg as { kind?: AssetIndexItem['kind'] } | undefined)?.kind
  return listAssets(kind)
})

// feature-821 · 系统直做上传：renderer 不接触源路径，选择前后绑定同一项目上下文
ipcMain.handle('asset:import', async event => {
  let projectRoot: string
  try {
    projectRoot = getActiveProjectDir()
  } catch {
    throw Object.assign(new Error('请先打开一个项目，再上传图片。'), { code: 'NO_ACTIVE_PROJECT' })
  }
  const projectId = (await canvasStore.get()).projectId
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options = {
    title: '上传图片',
    buttonLabel: '上传',
    properties: ['openFile'] as ['openFile'],
    filters: [{ name: '图片（PNG / JPEG / WebP）', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  }
  const selected = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)
  if (selected.canceled || selected.filePaths.length === 0) return { status: 'cancelled' as const }

  try {
    const currentRoot = getActiveProjectDir()
    const currentProjectId = (await canvasStore.get()).projectId
    if (currentRoot !== projectRoot || currentProjectId !== projectId) {
      throw Object.assign(new Error('项目已切换，本次上传已取消，请重新选择图片。'), { code: 'PROJECT_CHANGED' })
    }
    const sourcePath = selected.filePaths[0]!
    const asset = await importImageFromPath({ projectRoot, sourcePath })
    return { status: 'imported' as const, asset }
  } catch (error) {
    const code = (error as { code?: unknown })?.code
    if (typeof code === 'string' && [
      'PROJECT_CHANGED', 'SOURCE_NOT_REGULAR_FILE', 'IMAGE_TOO_LARGE', 'IMAGE_UNSUPPORTED',
      'IMAGE_TOO_MANY_PIXELS', 'PATH_ESCAPE_DENIED', 'ASSET_INDEX_CORRUPT', 'ASSET_IMPORT_FAILED',
    ].includes(code)) throw error
    throw Object.assign(new Error('图片导入失败，请检查文件和项目目录后重试。'), {
      code: 'ASSET_IMPORT_FAILED', cause: error,
    })
  }
})

ipcMain.handle('asset:thumbnail', async (_event, arg: unknown) => {
  const assetId = (arg as { assetId?: unknown } | undefined)?.assetId
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    throw Object.assign(new Error('缩略图参数必须为非空资产 ID。'), { code: 'INVALID_ARGUMENT' })
  }
  let projectRoot: string
  try {
    projectRoot = getActiveProjectDir()
  } catch {
    throw Object.assign(new Error('当前没有打开的项目，无法读取缩略图。'), { code: 'NO_ACTIVE_PROJECT' })
  }
  try {
    return await readAssetThumbnail({ projectRoot, assetId })
  } catch (error) {
    const code = (error as { code?: unknown })?.code
    if (code === 'ASSET_INDEX_CORRUPT' || code === 'ASSET_THUMBNAIL_FAILED') throw error
    throw Object.assign(new Error('缩略图读取失败，请稍后重试。'), {
      code: 'ASSET_THUMBNAIL_FAILED', cause: error,
    })
  }
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
  upsertInstance(instance as Partial<ComfyInstanceConfig>))

ipcMain.handle('settings:comfy:remove', (_e, arg: unknown) => {
  const id = (arg as { id?: unknown } | undefined)?.id
  if (typeof id !== 'string') {
    const err = new Error('参数必须为 { id }')
    err.name = 'INVALID_ARGUMENT'
    throw err
  }
  return removeInstance(id)
})

ipcMain.handle('settings:comfy:test', (_e, arg: unknown) => {
  if (!isRecord(arg) || typeof arg.baseUrl !== 'string') {
    const err = new Error('参数必须为 { baseUrl }')
    err.name = 'INVALID_ARGUMENT'
    throw err
  }
  return comfyEngine.testConnection({ baseUrl: arg.baseUrl })
})

// feature-014 · AI 服务设置（恰 2 个 IPC；脱敏视图，明文 Key 不出主进程）
ipcMain.handle('settings:ai:get', () => getSettingsView())

ipcMain.handle('settings:ai:update', (_e, patch: unknown) =>
  updateSettings((patch ?? {}) as AiServiceUpdatePatch))

// feature-813 · 工作目录更换（恰 3 个 IPC；错误信封与全仓一致：Error.code + 中文 message）
ipcMain.handle('settings:workspace:get', () => getWorkspaceSettingsView())

ipcMain.handle('settings:workspace:pick', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  return win ? pickDir(win) : Promise.resolve({ dir: null })
})

ipcMain.handle('settings:workspace:change', (_e, arg: unknown) => {
  const dir = (arg as { dir?: unknown } | undefined)?.dir
  return changeDir(typeof dir === 'string' ? dir : '')
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
    gateBridge.clearLive()
    return
  }
  runtimeQuitting = true
  runtimeStopInProgress = true
  event.preventDefault()
  gateBridge.clearLive()
  void runtimeManager.stop()
    .then(() => eachRunStore(store => store.stopActive(undefined, 'stopped')))
    .finally(() => {
      runtimeStopInProgress = false
      runtimeQuitting = false
      app.quit()
    })
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
