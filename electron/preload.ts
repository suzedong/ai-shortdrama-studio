import { contextBridge, ipcRenderer } from 'electron'
import type {
  RuntimeAgent,
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimePromptResult,
  RuntimeSession,
  RuntimeStatus,
} from '../src/lib/runtime-types'

contextBridge.exposeInMainWorld('api', {
  // feature-011 F13：项目库真实化
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (name?: string) => ipcRenderer.invoke('project:create', name === undefined ? undefined : { name }),
  openProject: (dir: string) => ipcRenderer.invoke('project:open', dir),
  configStatus: (): Promise<{ arkConfigured: boolean }> => ipcRenderer.invoke('app:config-status'),
  // feature-022：旧壳 IPC（saveProject/template/session/chat/archive/workflow）已全部下线

  // feature-008 · Agent 运行时（opencode 基座）；契约 §3.3，12 invoke + 2 推送
  runtime: {
    start: (): Promise<RuntimeStatus> => ipcRenderer.invoke('runtime:start'),
    stop: (): Promise<RuntimeStatus> => ipcRenderer.invoke('runtime:stop'),
    status: (): Promise<RuntimeStatus> => ipcRenderer.invoke('runtime:status'),
    createSession: (title?: string): Promise<RuntimeSession> =>
      ipcRenderer.invoke('runtime:session:create', title === undefined ? undefined : { title }),
    listSessions: (): Promise<RuntimeSession[]> => ipcRenderer.invoke('runtime:session:list'),
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
  // feature-022 · 只读产物查看（契约 §2）
  fileRead: (arg: { path: string }) => ipcRenderer.invoke('file:read', arg),
  settings: {
    comfy: {
      list: () => ipcRenderer.invoke('settings:comfy:list'),
      upsert: (instance: unknown) => ipcRenderer.invoke('settings:comfy:upsert', instance),
      remove: (id: string) => ipcRenderer.invoke('settings:comfy:remove', { id }),
    },
  },
})
