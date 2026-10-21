/// <reference types="vite/client" />
// 渲染进程全局类型声明 —— 对应 electron/preload.ts 暴露的 API
import type {
  Canvas, CanvasGate, ComfyInstance, AssetIndexItem, BriefChange, ProjectBrief, ProjectKind,
  CaptureFile, CapturedFact,
} from '../shared/types'
import type {
  RuntimeAgent,
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimePromptResult,
  RuntimeSession,
  RuntimeSessionMessageRecord,
  RuntimeStatus,
} from './lib/runtime-types'

declare global {
  // feature-804 · 平台标识（与主进程 WindowPlatform 同形三字符串，两端各自声明、不跨层 import）
  type StudioPlatform = 'darwin' | 'win32' | 'linux'
  // feature-810 · 谱系升级差异工作流 DTO（镜像 electron/style/types.ts，不进 shared；K1 零触发）
  type StyleUpgradeRefEntry = {
    id: string
    role: 'main' | 'auxiliary'
    removed: boolean
    current?: {
      role: 'main' | 'backup'
      auxiliaryCandidate: boolean
      feasibility: 'high' | 'medium' | 'low'
      anchorWords: string[]
    }
  }
  type StyleChangelogEntry = { version: string; date?: string; items: string[] }
  type StyleUpgradeDiff = {
    hasUpgrade: boolean
    registeredVersion?: string
    currentVersion: string
    referenced: StyleUpgradeRefEntry[]
    blocking: boolean
    changelog: StyleChangelogEntry[]
    changelogUnavailable: boolean
    noBrief?: boolean
  }
  type StyleCatalogEntryDto = {
    id: string
    name: string
    familyCode: 'A' | 'B' | 'C' | 'D' | 'E'
    familyLabel: string
    role: 'main' | 'backup'
    feasibility: 'high' | 'medium' | 'low'
    auxiliaryCandidate: boolean
    visualTraits: string
    anchorWords: string
    textureRecipe: string
  }
  interface Window {
    api: {
      // 项目库（feature-011 F13）
      listProjects: () => Promise<{
        dir: string; name: string; createdAt?: string; updatedAt: string
      }[]>
      createProject: (name?: string) => Promise<{ dir: string }>
      openProject: (dir: string) => Promise<{ ok: true; activeSessionId: string | null }>
      // B-19：项目改名/删除（K8 已批）
      renameProject: (dir: string, title: string) => Promise<{ ok: true; title: string }>
      deleteProject: (dir: string) => Promise<{ ok: true }>
      // D-017：修改立项面板直写（K8 已批；approve.by 恒 'ui'，受影响节点全仅挂脏）
      updateBrief(patch: {
        kind?: 'commercial' | 'memorial'
        fiveElements?: { episodeDuration?: string; episodeCount?: string; aspectRatio?: string }
        style?: { mainStyleId?: string; auxiliaryStyleId?: string; catalogVersion?: string }
      }): Promise<{
        ok: true
        version: number
        jsonPath: string
        mdPath: string
        impactReportPath: string
        changes: BriefChange[]
        items: {
          nodeId: string
          step: string
          title: string
          severity: 'high' | 'medium'
          fields: string[]
          defaultAction: 'regenerate' | 'mark'
        }[]
        markedDirty: string[]
      }>
      // feature-004：立项单历史与回滚（K8 已批；DTO 镜像 electron/brief/history.ts、rollback.ts，不进 shared）
      briefHistory(): Promise<{
        versions: {
          version: number
          path: string
          publishedAt: string
          kind: ProjectKind
          approveBy: 'gate' | 'verbal' | 'ui'
          changeCount: number
          note?: string
        }[]
        latestVersion: number | null
        warnings: string[]
      }>
      briefVersionRead(version: number): Promise<{
        brief: ProjectBrief
        diffToLatest: BriefChange[]
      }>
      briefRollback(version: number): Promise<{
        ok: true
        version: number
        rolledBackFrom: number
        changesFromPrevious: BriefChange[]
      }>
      // feature-005：「已捕获口径」（K8 已批；DTO 镜像 shared/types.ts Capture*，与 MCP capture.* 同库同追溯）
      captureList(): Promise<CaptureFile>
      captureUpsert(input: {
        id?: string
        topic?: string
        value?: string
        source?: 'user' | 'infer'
        status?: 'pending' | 'confirmed'
        quote?: string
      }): Promise<CapturedFact>
      captureRemove(id: string): Promise<{ removed: true }>
      onCaptureChanged(cb: (file: CaptureFile) => void): () => void
      // feature-810：谱系升级差异工作流（K8 已批，2 桥；零推送，面板打开时主动拉取）
      styleCatalog(): Promise<{ version: string; count: number; entries: StyleCatalogEntryDto[] }>
      styleUpgradeDiff(): Promise<StyleUpgradeDiff>
      // feature-808：项目绑定会话读（无参）/写（string 绑定 / null 清空）双态
      activeSession(sessionId?: string | null): Promise<{ sessionId: string | null }>
      configStatus: () => Promise<{ arkConfigured: boolean }>
      // 旧壳 IPC 已全部下线
      // feature-008 · Agent 运行时（契约 §3.3）
      runtime: {
        start(): Promise<RuntimeStatus>
        stop(): Promise<RuntimeStatus>
        status(): Promise<RuntimeStatus>
        createSession(title?: string): Promise<RuntimeSession>
        listSessions(): Promise<RuntimeSession[]>
        sessionMessages(sessionId: string): Promise<RuntimeSessionMessageRecord[]>
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
      // 只读产物查看
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
      // feature-804 · Windows 窗口标题栏（契约 §4）
      window: {
        readonly platform: StudioPlatform
        minimize(): Promise<{ ok: true }>
        toggleMaximize(): Promise<{ ok: true; maximized: boolean }>
        isMaximized(): Promise<{ ok: true; maximized: boolean }>
        close(): Promise<{ ok: true }>
        onMaximizeChange(cb: (maximized: boolean) => void): () => void
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
