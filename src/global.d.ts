// 渲染进程全局类型声明 —— 对应 electron/preload.ts 暴露的 API
import type {
  Canvas, CanvasGate, ComfyInstance, AssetIndexItem,
} from '../shared/types'
import type {
  RuntimeAgent,
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimePromptResult,
  RuntimeSession,
  RuntimeStatus,
} from './lib/runtime-types'

declare global {
  interface Window {
    api: {
      // 项目库（feature-011 F13）
      listProjects: () => Promise<{
        dir: string; name: string; createdAt?: string; updatedAt: string
      }[]>
      createProject: (name?: string) => Promise<{ dir: string }>
      openProject: (dir: string) => Promise<{ ok: true }>
      configStatus: () => Promise<{ arkConfigured: boolean }>
      // feature-022：旧壳 IPC 已全部下线
      // feature-008 · Agent 运行时（契约 §3.3）
      runtime: {
        start(): Promise<RuntimeStatus>
        stop(): Promise<RuntimeStatus>
        status(): Promise<RuntimeStatus>
        createSession(title?: string): Promise<RuntimeSession>
        listSessions(): Promise<RuntimeSession[]>
        abortSession(sessionId: string): Promise<{ ok: true }>
        deleteSession(sessionId: string): Promise<{ ok: true }>
        prompt(req: RuntimePromptRequest): Promise<RuntimePromptResult>
        promptAsync(req: RuntimePromptRequest): Promise<{ accepted: true; messageId: string }>
        subscribe(sessionId?: string): Promise<{ ok: true }>
        unsubscribe(): Promise<{ ok: true }>
        listAgents(): Promise<RuntimeAgent[]>
        onEvent(cb: (event: RuntimeEvent) => void): () => void
        onStatusChange(cb: (status: RuntimeStatus) => void): () => void
      }
      // feature-017 · 画布 / 裁决门 / 资产 / ComfyUI 设置
      canvas: {
        get(): Promise<Canvas>
        subscribe(): Promise<{ ok: true }>
        unsubscribe(): Promise<{ ok: true }>
        onChange(cb: (canvas: Canvas) => void): () => void
      }
      gate: {
        decide(req: {
          gateId: string
          decision: 'approved' | 'rejected'
          note?: string
        }): Promise<{ ok: true }>
        onChanged(cb: (e: { gate: CanvasGate; title?: string }) => void): () => void
      }
      asset: {
        list(kind?: AssetIndexItem['kind']): Promise<AssetIndexItem[]>
      }
      // feature-022 · 只读产物查看（契约 §2）
      fileRead(arg: { path: string }): Promise<
        | { ok: true; content: string; format: 'json' | 'md' }
        | { ok: false; error: { code: string; message: string } }
      >
      settings: {
        comfy: {
          list(): Promise<ComfyInstance[]>
          upsert(instance: Partial<ComfyInstance>): Promise<ComfyInstance>
          remove(id: string): Promise<{ ok: true }>
        }
      }
    }
  }
}

// Electron 无边框窗口（titleBarStyle: hiddenInset）拖拽区 CSS 属性
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

export {}
