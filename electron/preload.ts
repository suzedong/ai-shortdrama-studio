import { contextBridge, ipcRenderer } from 'electron'
import type {
  RuntimeAgent,
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimePromptResult,
  RuntimeSession,
  RuntimeSessionMessageRecord,
  RuntimeStatus,
} from '../src/lib/runtime-types'

contextBridge.exposeInMainWorld('api', {
  // feature-011 F13：项目库真实化
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (name?: string) => ipcRenderer.invoke('project:create', name === undefined ? undefined : { name }),
  openProject: (dir: string) => ipcRenderer.invoke('project:open', dir),
  // B-19：项目改名/删除（K8 已批）
  renameProject: (dir: string, title: string) => ipcRenderer.invoke('project:rename', { dir, title }),
  deleteProject: (dir: string) => ipcRenderer.invoke('project:delete', dir),
  // D-017：修改立项面板直写（K8 已批；feature-013 扩键：全字段 + L0）
  updateBrief: (patch: {
    kind?: 'commercial' | 'memorial'
    fiveElements?: {
      episodeDuration?: string
      episodeCount?: string
      aspectRatio?: string
      genre?: string
      tone?: string
      platforms?: string[]
    }
    premise?: {
      leads?: string
      time?: string
      place?: string
      coreEvent?: string
      seasonBoundary?: string
    }
    style?: { mainStyleId?: string; auxiliaryStyleId?: string; catalogVersion?: string }
    diagnosisSummary?: string
    l0?: { tags?: string[]; notes?: string }
  }) => ipcRenderer.invoke('brief:update', patch),
  // feature-004：立项单历史与回滚（K8 已批，3 桥；D-016 系统直做）
  briefHistory: () => ipcRenderer.invoke('brief:history'),
  briefVersionRead: (version: number) => ipcRenderer.invoke('brief:version-read', { version }),
  briefRollback: (version: number) => ipcRenderer.invoke('brief:rollback', { version }),
  // feature-005：「已捕获口径」（K8 已批，3 桥 + 1 订阅；与 MCP capture.* 同库同追溯）
  captureList: () => ipcRenderer.invoke('capture:list'),
  captureUpsert: (input: unknown) => ipcRenderer.invoke('capture:upsert', input),
  captureRemove: (id: string) => ipcRenderer.invoke('capture:remove', { id }),
  onCaptureChanged: (cb: (file: unknown) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown) => cb(payload)
    ipcRenderer.on('capture:changed', listener)
    return () => ipcRenderer.removeListener('capture:changed', listener)
  },
  // feature-810：谱系升级差异工作流（K8 已批，2 桥；零推送，面板打开时主动拉取）
  styleCatalog: () => ipcRenderer.invoke('style:catalog'),
  styleUpgradeDiff: () => ipcRenderer.invoke('style:upgrade-diff'),
  // feature-808：项目绑定会话读（无参）/写（{ sessionId } 或 { sessionId: null }）双态（D-005 顶层暴露）
  activeSession: (sessionId?: string | null): Promise<{ sessionId: string | null }> =>
    ipcRenderer.invoke(
      'project:active-session',
      sessionId === undefined ? undefined : { sessionId },
    ),
  configStatus: (): Promise<{ arkConfigured: boolean }> => ipcRenderer.invoke('app:config-status'),
  // 旧壳 IPC（saveProject/template/session/chat/archive/workflow）已全部下线

  // feature-008 · Agent 运行时（opencode 基座）；契约 §3.3，12 invoke + 2 推送
  runtime: {
    start: (): Promise<RuntimeStatus> => ipcRenderer.invoke('runtime:start'),
    stop: (): Promise<RuntimeStatus> => ipcRenderer.invoke('runtime:stop'),
    status: (): Promise<RuntimeStatus> => ipcRenderer.invoke('runtime:status'),
    createSession: (title?: string): Promise<RuntimeSession> =>
      ipcRenderer.invoke('runtime:session:create', title === undefined ? undefined : { title }),
    listSessions: (): Promise<RuntimeSession[]> => ipcRenderer.invoke('runtime:session:list'),
    // feature-808：会话历史回放（文本 DTO）
    sessionMessages: (sessionId: string): Promise<RuntimeSessionMessageRecord[]> =>
      ipcRenderer.invoke('runtime:session:messages', { sessionId }),
    abortSession: (sessionId: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke('runtime:session:abort', sessionId),
    deleteSession: (sessionId: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke('runtime:session:delete', sessionId),
    prompt: (req: RuntimePromptRequest): Promise<RuntimePromptResult> =>
      ipcRenderer.invoke('runtime:prompt', req),
    promptAsync: (req: RuntimePromptRequest): Promise<{ accepted: true; messageId: string }> =>
      ipcRenderer.invoke('runtime:prompt:async', req),
    subscribe: (sessionId?: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke('runtime:event:subscribe', sessionId === undefined ? undefined : { sessionId }),
    unsubscribe: (): Promise<{ ok: true }> => ipcRenderer.invoke('runtime:event:unsubscribe'),
    listAgents: (): Promise<RuntimeAgent[]> => ipcRenderer.invoke('runtime:agent:list'),
    onEvent: (cb: (event: RuntimeEvent) => void): (() => void) => {
      const listener = (_event: unknown, payload: RuntimeEvent) => cb(payload)
      ipcRenderer.on('runtime:event', listener)
      return () => ipcRenderer.removeListener('runtime:event', listener)
    },
    onStatusChange: (cb: (status: RuntimeStatus) => void): (() => void) => {
      const listener = (_event: unknown, payload: RuntimeStatus) => cb(payload)
      ipcRenderer.on('runtime:status-changed', listener)
      return () => ipcRenderer.removeListener('runtime:status-changed', listener)
    },
  },

  // feature-017 · 画布 / 裁决门 / 资产 / ComfyUI 设置
  canvas: {
    get: () => ipcRenderer.invoke('canvas:get'),
    subscribe: () => ipcRenderer.invoke('canvas:subscribe'),
    unsubscribe: () => ipcRenderer.invoke('canvas:unsubscribe'),
    onChange: (cb: (canvas: unknown) => void): (() => void) => {
      const listener = (_event: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on('canvas:changed', listener)
      return () => ipcRenderer.removeListener('canvas:changed', listener)
    },
  },
  gate: {
    decide: (req: unknown) => ipcRenderer.invoke('gate:decide', req),
    onChanged: (cb: (e: unknown) => void): (() => void) => {
      const listener = (_event: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on('gate:changed', listener)
      return () => ipcRenderer.removeListener('gate:changed', listener)
    },
  },
  asset: {
    list: (kind?: string) =>
      ipcRenderer.invoke('asset:list', kind === undefined ? undefined : { kind }),
  },
  // 只读产物查看
  fileRead: (arg: { path: string }) => ipcRenderer.invoke('file:read', arg),
  settings: {
    comfy: {
      list: () => ipcRenderer.invoke('settings:comfy:list'),
      upsert: (instance: unknown) => ipcRenderer.invoke('settings:comfy:upsert', instance),
      remove: (id: string) => ipcRenderer.invoke('settings:comfy:remove', { id }),
    },
  },

  // feature-804 · Windows 窗口标题栏（契约 §3）
  // platform 为 Node 上下文同步常量（非 invoke），首渲染即定形态，无闪烁。
  window: {
    platform: process.platform as 'darwin' | 'win32' | 'linux',
    minimize: (): Promise<{ ok: true }> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<{ ok: true; maximized: boolean }> =>
      ipcRenderer.invoke('window:toggle-maximize'),
    isMaximized: (): Promise<{ ok: true; maximized: boolean }> =>
      ipcRenderer.invoke('window:is-maximized'),
    close: (): Promise<{ ok: true }> => ipcRenderer.invoke('window:close'),
    onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
      const listener = (_event: unknown, payload: { maximized: boolean }) => cb(payload.maximized)
      ipcRenderer.on('window:maximize-changed', listener)
      return () => ipcRenderer.removeListener('window:maximize-changed', listener)
    },
  },
})
