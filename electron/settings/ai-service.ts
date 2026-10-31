// feature-014 · AI 服务配置 store（应用级：<userData>/ai-service.json）
// 契约：docs/features/feature-014-AI服务配置管理/SDG-RE-契约.md §1/§2
// - Key 唯一落盘形态：safeStorage.encryptString → base64（ark.apiKeyEnc）；明文不出主进程内存；
// - safeStorage.isEncryptionAvailable()=false 且 patch 含非空 Key → INVALID_ARGUMENT 零写盘（D-021，禁明文回退）；
// - 生效值三级合并：store → process.env → 内置默认，逐字段来源标记供面板显示；
// - 写路径仿 feature-017：enqueue 写队列串行 + archiveExisting 归档旧版后覆写；
// - 模块持内存副本：首次访问同步读盘一次（小文件），update 成功同步刷新，
//   ark.ts / main.ts（含 allowedArkModel getter）消费读内存零磁盘 IO。
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { app, safeStorage } from 'electron'
import { enqueue } from '../fs/write-queue.js'
import { archiveExisting } from '../fs/archive.js'

// -- 内置默认（契约 §1.2） ----------------------------------------------------

export const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
export const DEFAULT_LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1'
export const DEFAULT_PORT_RANGE_START = 4096
export const DEFAULT_HEALTH_TIMEOUT_MS = 10_000
export const DEFAULT_MOCK_BASE_URL = 'http://127.0.0.1:4099/v1'

// -- 形状（契约 §1.1 / §2.1） --------------------------------------------------

export type AiFieldSource = 'store' | 'env' | 'default'
export type AiProviderId = 'ark' | 'lmstudio'

export interface AiServiceFile {
  version: 1
  activeProvider?: AiProviderId
  ark?: {
    apiKeyEnc?: string
    baseUrl?: string
    model?: string
  }
  lmstudio?: {
    baseUrl?: string
    model?: string
  }
  runtime?: {
    portRangeStart?: number
    healthTimeoutMs?: number
    mockBaseUrl?: string
  }
  updatedAt: string
}

export interface AiServiceUpdatePatch {
  activeProvider?: AiProviderId
  ark?: {
    apiKey?: string
    baseUrl?: string
    model?: string
  }
  lmstudio?: {
    baseUrl?: string
    model?: string
  }
  runtime?: {
    portRangeStart?: number | null
    healthTimeoutMs?: number | null
    mockBaseUrl?: string | null
  }
}

/** 脱敏视图（契约 §2.1）：永不包含明文 Key */
export interface AiServiceSettingsView {
  activeProvider: AiProviderId
  ark: {
    baseUrl: string
    model: string
    keyConfigured: boolean
    apiKeyMasked?: string
    sources: { apiKey: AiFieldSource; baseUrl: AiFieldSource; model: AiFieldSource }
  }
  lmstudio: {
    baseUrl: string
    model: string
    sources: { baseUrl: AiFieldSource; model: AiFieldSource }
  }
  runtime: {
    portRangeStart: number
    healthTimeoutMs: number
    mockBaseUrl: string
    sources: { portRangeStart: AiFieldSource; healthTimeoutMs: AiFieldSource; mockBaseUrl: AiFieldSource }
  }
  updatedAt: string
}

// -- 存储与内存副本 ------------------------------------------------------------

let cache: AiServiceFile | null = null

function storeFile(): string {
  return path.join(app.getPath('userData'), 'ai-service.json')
}

/** 同步惰性读盘（仅首次）；读侧同步是契约 §2.3 allowedArkModel getter 的前置 */
function load(): AiServiceFile {
  if (!cache) cache = readFromDisk()
  return cache
}

function readFromDisk(): AiServiceFile {
  try {
    const data = JSON.parse(fs.readFileSync(storeFile(), 'utf-8')) as Partial<AiServiceFile>
    const ark = data.ark && typeof data.ark === 'object' ? data.ark : undefined
    const lmstudio = data.lmstudio && typeof data.lmstudio === 'object' ? data.lmstudio : undefined
    const runtime = data.runtime && typeof data.runtime === 'object' ? data.runtime : undefined
    const activeProvider = data.activeProvider === 'lmstudio' ? 'lmstudio' : 'ark'
    return {
      version: 1,
      ...(data.activeProvider ? { activeProvider } : {}),
      ...(ark ? { ark } : {}),
      ...(lmstudio ? { lmstudio } : {}),
      ...(runtime ? { runtime } : {}),
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    }
  } catch {
    return { version: 1, updatedAt: new Date().toISOString() }
  }
}

/** 仅测试用：清空内存副本，下次访问重新读盘 */
export function __resetAiServiceCacheForTests(): void {
  cache = null
}

// -- 工具 ----------------------------------------------------------------------

function invalid(message: string): never {
  throw Object.assign(new Error(message), { code: 'INVALID_ARGUMENT' })
}

function envValue(name: string): string | undefined {
  const v = process.env[name]
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
}

function decryptKey(file: AiServiceFile): string | undefined {
  const enc = file.ark?.apiKeyEnc
  if (!enc) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return undefined
  }
}

/** 脱敏（契约 §1.2）：前6+••••+后4；不足 10 位仅显「已配置」 */
export function maskKeyString(key: string): string {
  if (key.length < 10) return '已配置'
  return key.slice(0, 6) + '••••' + key.slice(-4)
}

// -- 读取（合并 store → env → default） ----------------------------------------

/** 主进程内部专用：返回含明文 Key 的合并生效值；禁止经 IPC/日志外泄 */
export function getArkConfig(): { apiKey?: string; baseUrl: string; model?: string } {
  const f = load()
  const apiKey = decryptKey(f) ?? envValue('ARK_API_KEY')
  const baseUrl = f.ark?.baseUrl ?? envValue('ARK_BASE_URL') ?? DEFAULT_ARK_BASE_URL
  const model = f.ark?.model ?? envValue('ARK_MODEL')
  return { ...(apiKey ? { apiKey } : {}), baseUrl, ...(model ? { model } : {}) }
}

export function getActiveProvider(): AiProviderId {
  return load().activeProvider ?? 'ark'
}

/** 主进程内部专用：LM Studio 无凭证，仅合并地址与模型 ID */
export function getLmStudioConfig(): { baseUrl: string; model?: string } {
  const f = load()
  const baseUrl = f.lmstudio?.baseUrl ?? envValue('LMSTUDIO_BASE_URL') ?? DEFAULT_LMSTUDIO_BASE_URL
  const model = f.lmstudio?.model ?? envValue('LMSTUDIO_MODEL')
  return { baseUrl, ...(model ? { model } : {}) }
}

/** runtime 三项合并生效值（无 env 回退层，契约 §1.2） */
export function getRuntimePrefs(): {
  portRangeStart: number
  healthTimeoutMs: number
  mockBaseUrl: string
} {
  const f = load()
  return {
    portRangeStart: f.runtime?.portRangeStart ?? DEFAULT_PORT_RANGE_START,
    healthTimeoutMs: f.runtime?.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS,
    mockBaseUrl: f.runtime?.mockBaseUrl ?? DEFAULT_MOCK_BASE_URL,
  }
}

/** 脱敏视图：六项生效值 + 逐字段来源 + Key 状态（无明文） */
export function getSettingsView(): AiServiceSettingsView {
  const f = load()
  const storeKey = decryptKey(f)
  const envKey = envValue('ARK_API_KEY')
  const key = storeKey ?? envKey
  const envBaseUrl = envValue('ARK_BASE_URL')
  const envModel = envValue('ARK_MODEL')
  const envLmStudioBaseUrl = envValue('LMSTUDIO_BASE_URL')
  const envLmStudioModel = envValue('LMSTUDIO_MODEL')
  return {
    activeProvider: f.activeProvider ?? 'ark',
    ark: {
      baseUrl: f.ark?.baseUrl ?? envBaseUrl ?? DEFAULT_ARK_BASE_URL,
      model: f.ark?.model ?? envModel ?? '',
      keyConfigured: !!key,
      ...(key ? { apiKeyMasked: maskKeyString(key) } : {}),
      sources: {
        // apiKey/model 无内置默认：未配置时记 default（面板以 keyConfigured/空值另行呈现「未配置」）
        apiKey: storeKey ? 'store' : envKey ? 'env' : 'default',
        baseUrl: f.ark?.baseUrl ? 'store' : envBaseUrl ? 'env' : 'default',
        model: f.ark?.model ? 'store' : envModel ? 'env' : 'default',
      },
    },
    lmstudio: {
      baseUrl: f.lmstudio?.baseUrl ?? envLmStudioBaseUrl ?? DEFAULT_LMSTUDIO_BASE_URL,
      model: f.lmstudio?.model ?? envLmStudioModel ?? '',
      sources: {
        baseUrl: f.lmstudio?.baseUrl ? 'store' : envLmStudioBaseUrl ? 'env' : 'default',
        model: f.lmstudio?.model ? 'store' : envLmStudioModel ? 'env' : 'default',
      },
    },
    runtime: {
      portRangeStart: f.runtime?.portRangeStart ?? DEFAULT_PORT_RANGE_START,
      healthTimeoutMs: f.runtime?.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS,
      mockBaseUrl: f.runtime?.mockBaseUrl ?? DEFAULT_MOCK_BASE_URL,
      sources: {
        portRangeStart: f.runtime?.portRangeStart != null ? 'store' : 'default',
        healthTimeoutMs: f.runtime?.healthTimeoutMs != null ? 'store' : 'default',
        mockBaseUrl: f.runtime?.mockBaseUrl ? 'store' : 'default',
      },
    },
    updatedAt: f.updatedAt,
  }
}

// -- 更新（校验 → 加密 → enqueue 落盘 → 刷新内存副本） ---------------------------

export async function updateSettings(patch: AiServiceUpdatePatch): Promise<AiServiceSettingsView> {
  const hasActiveProvider = patch?.activeProvider !== undefined
  const hasArk = !!patch?.ark && Object.keys(patch.ark).length > 0
  const hasLmStudio = !!patch?.lmstudio && Object.keys(patch.lmstudio).length > 0
  const hasRuntime = !!patch?.runtime && Object.keys(patch.runtime).length > 0
  if (!hasActiveProvider && !hasArk && !hasLmStudio && !hasRuntime) invalid('空配置：无可更新字段')

  // 整体入队串行，读-改-写原子化；任何校验抛错发生在写盘之前（零写盘）
  return enqueue(async () => {
    const current = load()
    const next: AiServiceFile = {
      version: 1,
      ...(current.activeProvider ? { activeProvider: current.activeProvider } : {}),
      ...(current.ark ? { ark: { ...current.ark } } : {}),
      ...(current.lmstudio ? { lmstudio: { ...current.lmstudio } } : {}),
      ...(current.runtime ? { runtime: { ...current.runtime } } : {}),
      updatedAt: new Date().toISOString(),
    }

    if (hasActiveProvider) {
      if (patch.activeProvider !== 'ark' && patch.activeProvider !== 'lmstudio') {
        invalid('activeProvider 仅允许 ark 或 lmstudio')
      }
      next.activeProvider = patch.activeProvider
    }

    if (hasArk) {
      const ark = patch.ark!
      const nextArk = next.ark ?? {}
      if ('apiKey' in ark) {
        if (typeof ark.apiKey !== 'string') invalid('apiKey 须为字符串')
        if (ark.apiKey === '') {
          delete nextArk.apiKeyEnc
        } else {
          if (!safeStorage.isEncryptionAvailable()) {
            invalid('当前系统不支持安全存储，Key 未保存')
          }
          nextArk.apiKeyEnc = safeStorage.encryptString(ark.apiKey).toString('base64')
        }
      }
      if ('baseUrl' in ark) {
        if (typeof ark.baseUrl !== 'string') invalid('baseUrl 须为字符串')
        const v = ark.baseUrl.trim()
        if (v === '') delete nextArk.baseUrl
        else {
          if (!/^https?:\/\//.test(v)) invalid('baseUrl 须以 http(s):// 开头')
          nextArk.baseUrl = v
        }
      }
      if ('model' in ark) {
        if (typeof ark.model !== 'string') invalid('model 须为字符串')
        const v = ark.model.trim()
        if (v === '') delete nextArk.model
        else nextArk.model = v
      }
      if (Object.keys(nextArk).length > 0) next.ark = nextArk
      else delete next.ark
    }

    if (hasLmStudio) {
      const lmstudio = patch.lmstudio!
      const nextLmStudio = next.lmstudio ?? {}
      if ('baseUrl' in lmstudio) {
        if (typeof lmstudio.baseUrl !== 'string') invalid('baseUrl 须为字符串')
        const v = lmstudio.baseUrl.trim()
        if (v === '') delete nextLmStudio.baseUrl
        else {
          if (!/^https?:\/\//.test(v)) invalid('baseUrl 须以 http(s):// 开头')
          nextLmStudio.baseUrl = v
        }
      }
      if ('model' in lmstudio) {
        if (typeof lmstudio.model !== 'string') invalid('model 须为字符串')
        const v = lmstudio.model.trim()
        if (v === '') delete nextLmStudio.model
        else nextLmStudio.model = v
      }
      if (Object.keys(nextLmStudio).length > 0) next.lmstudio = nextLmStudio
      else delete next.lmstudio
    }

    if (hasRuntime) {
      const rt = patch.runtime!
      const nextRt = next.runtime ?? {}
      if ('portRangeStart' in rt) {
        if (rt.portRangeStart === null) delete nextRt.portRangeStart
        else if (!Number.isInteger(rt.portRangeStart) || rt.portRangeStart! < 1024 || rt.portRangeStart! > 65535) {
          invalid('portRangeStart 须为 1024-65535 整数')
        } else nextRt.portRangeStart = rt.portRangeStart!
      }
      if ('healthTimeoutMs' in rt) {
        if (rt.healthTimeoutMs === null) delete nextRt.healthTimeoutMs
        else if (!Number.isInteger(rt.healthTimeoutMs) || rt.healthTimeoutMs! < 1000 || rt.healthTimeoutMs! > 60000) {
          invalid('healthTimeoutMs 须为 1000-60000 整数')
        } else nextRt.healthTimeoutMs = rt.healthTimeoutMs!
      }
      if ('mockBaseUrl' in rt) {
        if (rt.mockBaseUrl === null || rt.mockBaseUrl === '') delete nextRt.mockBaseUrl
        else if (typeof rt.mockBaseUrl !== 'string') invalid('mockBaseUrl 须为字符串')
        else {
          const v = rt.mockBaseUrl.trim()
          if (v === '') delete nextRt.mockBaseUrl
          else {
            if (!/^https?:\/\//.test(v)) invalid('mockBaseUrl 须以 http(s):// 开头')
            nextRt.mockBaseUrl = v
          }
        }
      }
      if (Object.keys(nextRt).length > 0) next.runtime = nextRt
      else delete next.runtime
    }

    const file = storeFile()
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await archiveExisting(file, new Date())
    await fsp.writeFile(file, JSON.stringify(next, null, 2), 'utf-8')
    cache = next
    return getSettingsView()
  })
}
