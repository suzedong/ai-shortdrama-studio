// feature-008 · opencode 生成态配置生成
// 严格匹配《SDG-RE-契约.md》§7 / §8：
// - 生成态写入 app.getPath('userData')/opencode/，每次启动按模板重生成，不做用户态合并；
// - 仅 ark + mock 两个 provider，enabled_providers 白名单抑制 opencode 30+ 内置 provider；
// - ark 的 Key 永不落盘：json 只声明 env:["ARK_API_KEY"]，真实值由 manager 经子进程环境变量注入；
// - 本期仅 director profile，model 为 ark/<ARK_MODEL>，modelID 启动时注入，不硬编码入库；
// - ARK_MODEL 缺失时 director 不安装（不静默回退 mock），运行时本身仍可经 mock 启动（契约 §6/§7.4）。
import path from 'node:path'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import type { RuntimeErrorCode } from './types.js'

// -- 常量 ---------------------------------------------------------------------

export const ARK_BASE_URL_DEFAULT = 'https://ark.cn-beijing.volces.com/api/v3'
export const MOCK_BASE_URL_DEFAULT = 'http://127.0.0.1:4099/v1'
/** 本地 OpenAI 兼容桩的占位值，非真实密钥；仅用于让 openai-compatible 通道不报缺 key */
export const MOCK_API_KEY = 'mock-no-key'
export const MOCK_PROVIDER_ID = 'mock'
export const MOCK_MODEL_ID = 'mock-1'
export const ARK_PROVIDER_ID = 'ark'
export const DIRECTOR_AGENT = 'director'
/** 白名单：仅这两个 provider 可被 opencode 加载（契约 §7.3） */
export const ENABLED_PROVIDERS = [ARK_PROVIDER_ID, MOCK_PROVIDER_ID] as const
/**
 * director profile 已声明的只读工具（feature-008 最小集，契约 §7.4）。
 * 另有 MCP 业务工具以 `shortdrama_` 前缀整体放行（feature-010，契约 §3/§6.3）；
 * 判定统一走 isDirectorDeclaredTool，越界即 INVALID_ARGUMENT（client 层校验）。
 */
export const DIRECTOR_DECLARED_TOOLS = ['read', 'glob', 'grep'] as const

/** MCP 业务服务器在 opencode config 中的注册名（工具 ID = shortdrama_<tool>） */
export const SHORTDRAMA_MCP_NAME = 'shortdrama'

/** MCP 远程工具调用超时（ms，契约 §6.3 D-012）：工具内部走 ark 整段生成（20–60s），10s 会误超时 */
export const SHORTDRAMA_MCP_TIMEOUT_MS = 180_000

/** director 工具放行判定：只读三件 + shortdrama_ 前缀的 MCP 业务工具 */
export function isDirectorDeclaredTool(tool: string): boolean {
  return (
    (DIRECTOR_DECLARED_TOOLS as readonly string[]).includes(tool) ||
    tool.startsWith(`${SHORTDRAMA_MCP_NAME}_`)
  )
}

// -- feature-018 · 摄制组 profiles -------------------------------------------

export const SHOWRUNNER_AGENT = 'showrunner'

/**
 * showrunner 请求级工具白名单（6 个纯工具物理 ID）。
 * `task` 由 profile 常驻（permission.task 白名单），不随请求 tools 传递。
 */
export const SHOWRUNNER_DECLARED_TOOLS = [
  'shortdrama_file_read',
  'shortdrama_file_list',
  'shortdrama_file_write',
  'shortdrama_canvas_get',
  'shortdrama_canvas_update',
  'shortdrama_gate_request',
] as const

/** showrunner 工具放行判定：仅白名单 6 个物理 ID */
export function isShowrunnerDeclaredTool(tool: string): boolean {
  return (SHOWRUNNER_DECLARED_TOOLS as readonly string[]).includes(tool)
}

const CONFIG_DIR_NAME = 'opencode'
const CONFIG_FILE_NAME = 'opencode.json'
const AGENTS_DIR_NAME = 'agents'
const DIRECTOR_FILE_NAME = 'director.md'
/** 模板内 modelID 占位符：启动时替换为 ARK_MODEL，模板与仓库中不写死任何 modelID */
const MODEL_PLACEHOLDER = '__ARK_MODEL_ID__'

export interface AgentProfileSpec {
  name: string
  file: string
}

/**
 * 启动时安装的全部 profile（旧 director 并存至 feature-022）。
 * 物理文件名与进程内 agent name 一致（见 feature-018 契约 §1/§2）。
 */
export const AGENT_PROFILES: readonly AgentProfileSpec[] = [
  { name: DIRECTOR_AGENT, file: DIRECTOR_FILE_NAME },
  { name: SHOWRUNNER_AGENT, file: 'showrunner.md' },
  { name: 'writer', file: 'writer.md' },
  { name: 'media-director', file: 'media-director.md' },
  { name: 'comfyui-operator', file: 'comfyui-operator.md' },
]

// -- 类型 ---------------------------------------------------------------------

export interface GenerateRuntimeConfigOptions {
  /** app.getPath('userData') */
  userDataDir: string
  /** 来自 ARK_MODEL；缺失时 ark provider models 为空（不激活），运行时仍可经 mock 启动 */
  arkModel?: string
  arkBaseUrl?: string
  mockBaseUrl?: string
}

export interface GeneratedRuntimeConfig {
  /** <userData>/opencode */
  configDir: string
  /** <userData>/opencode/opencode.json */
  configPath: string
  /** ark 是否注入了 model（ARK_MODEL 存在） */
  arkActive: boolean
}

export interface InstallDirectorOptions {
  userDataDir: string
  /** ARK_MODEL；缺失 / 非字符串 / 空白即抛 UPSTREAM_AUTH_MISSING，不静默回退 mock */
  arkModel: string
  /** 测试注入：resources/opencode/agents/director.md 的绝对路径 */
  templatePath?: string
}

export interface RuntimeFilesResult {
  config: GeneratedRuntimeConfig
  /** 安装成功时为生成态 director.md 路径；ARK_MODEL 缺失时为 null */
  directorPath: string | null
  /** feature-018：全部已安装 profile（缺 model 时为空数组） */
  profiles: InstalledAgentProfile[]
  /** director 不可用原因（供状态展示 / 结构化错误），可用时为 null */
  directorError: RuntimeErrorBodyShape | null
}

interface RuntimeErrorBodyShape {
  code: RuntimeErrorCode
  message: string
}

// -- 路径解析 -----------------------------------------------------------------

/**
 * 解析仓库 / 打包资源中的 director.md 模板。
 * - 打包后：process.resourcesPath/opencode/agents/director.md（I-001 extraResources 方案）；
 * - 开发态：electron/runtime/（vitest 直跑 ts）或 dist-electron/electron/runtime/（编译产物）向上定位仓库根。
 *
 * 环境判定必须用 app.isPackaged：Electron 开发态下 process.resourcesPath 同样存在（指向
 * node_modules/electron/dist/Electron.app/Contents/Resources），不能用作打包态判据（2026-10-05 I-003）。
 */
export async function resolveAgentTemplatePath(file: string): Promise<string> {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      CONFIG_DIR_NAME,
      AGENTS_DIR_NAME,
      file,
    )
  }
  const here = path.dirname(fileURLToPath(import.meta.url))
  const devRoot = path.resolve(here, '..', '..') // <root>/electron/runtime → <root>
  const builtRoot = path.resolve(here, '..', '..', '..') // <root>/dist-electron/electron/runtime → <root>
  const candidates = [devRoot, builtRoot].map((root) =>
    path.join(root, 'resources', CONFIG_DIR_NAME, AGENTS_DIR_NAME, file),
  )
  for (const candidate of candidates) {
    try {
      await fsp.access(candidate)
      return candidate
    } catch {
      // 试下一个候选
    }
  }
  return candidates[0]! // 让后续读取抛出明确的 ENOENT
}

export async function resolveDefaultDirectorTemplatePath(): Promise<string> {
  return resolveAgentTemplatePath(DIRECTOR_FILE_NAME)
}

export function runtimeConfigDir(userDataDir: string): string {
  return path.join(userDataDir, CONFIG_DIR_NAME)
}

// -- opencode.json ------------------------------------------------------------

/**
 * 在 <userData>/opencode/ 重生成 opencode.json（契约 §7.1-§7.3 / §8.4）。
 * 本函数不接收 ARK_API_KEY：结构上保证 Key 不可能落盘。
 */
export async function generateRuntimeConfig(
  opts: GenerateRuntimeConfigOptions,
): Promise<GeneratedRuntimeConfig> {
  const userDataDir = opts.userDataDir
  if (!userDataDir || typeof userDataDir !== 'string') {
    throw makeError('INVALID_ARGUMENT', 'userDataDir 缺失，无法生成运行时配置')
  }
  const arkModel = opts.arkModel?.trim()
  const arkBaseUrl = opts.arkBaseUrl?.trim() || ARK_BASE_URL_DEFAULT
  const mockBaseUrl = opts.mockBaseUrl?.trim() || MOCK_BASE_URL_DEFAULT

  const configDir = runtimeConfigDir(userDataDir)
  const agentsDir = path.join(configDir, AGENTS_DIR_NAME)
  await fsp.mkdir(agentsDir, { recursive: true })

  // 2026-10-04 opencode 1.18.34 实测蓝本（/tmp/oc-probe，GET /provider 验证）：
  // enabled_providers 白名单下仅 ark + mock 加载；ark models 为空时该 provider 不激活、serve 仍健康。
  const config = {
    $schema: 'https://opencode.ai/config.json',
    enabled_providers: [...ENABLED_PROVIDERS],
    // MCP 业务工具：只写 {env:…} 占位符（契约 §1/§6.3；opencode 插值仅识别该语法）。
    // 真实 url/token 不经本函数参数传入，结构上保证不被序列化落盘。
    mcp: {
      [SHORTDRAMA_MCP_NAME]: {
        type: 'remote',
        url: '{env:OPENCODE_MCP_URL}',
        headers: { Authorization: 'Bearer {env:OPENCODE_MCP_TOKEN}' },
        timeout: SHORTDRAMA_MCP_TIMEOUT_MS,
      },
    },
    provider: {
      [ARK_PROVIDER_ID]: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Volcano Ark (OpenAI-compatible)',
        env: ['ARK_API_KEY'],
        options: {
          baseURL: arkBaseUrl,
        },
        models: arkModel
          ? { [arkModel]: { name: 'Doubao (Volcano Ark)' } }
          : {},
      },
      [MOCK_PROVIDER_ID]: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Mock Stub (test only)',
        options: {
          baseURL: mockBaseUrl,
          // 显式标注测试用途（契约 §7.2）；profile 默认不选用 mock
          apiKey: MOCK_API_KEY,
        },
        models: {
          [MOCK_MODEL_ID]: { name: 'Mock Model (test only)' },
        },
      },
    },
  }

  const configPath = path.join(configDir, CONFIG_FILE_NAME)
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  return { configDir, configPath, arkActive: !!arkModel }
}

// -- Agent profiles 安装 ------------------------------------------------------

/** 单个 profile 的模板渲染（不落盘）：校验占位符并替换 modelID */
async function renderAgentFile(
  userDataDir: string,
  spec: AgentProfileSpec,
  arkModel: string,
  templatePath?: string,
): Promise<{ targetPath: string; rendered: string }> {
  const tplPath = templatePath ?? await resolveAgentTemplatePath(spec.file)
  const template = await fsp.readFile(tplPath, 'utf-8')
  if (!template.includes(MODEL_PLACEHOLDER)) {
    throw makeError('INTERNAL', `${spec.file} 模板缺少 ${MODEL_PLACEHOLDER} 占位符：${tplPath}`)
  }
  const rendered = template.split(MODEL_PLACEHOLDER).join(arkModel)
  if (rendered.includes(MODEL_PLACEHOLDER)) {
    throw makeError('INTERNAL', `${spec.file} 模板 modelID 替换失败`)
  }
  const targetPath = path.join(runtimeConfigDir(userDataDir), AGENTS_DIR_NAME, spec.file)
  return { targetPath, rendered }
}

export interface InstallAgentProfilesOptions {
  userDataDir: string
  /** ARK_MODEL；缺失 / 空白抛 UPSTREAM_AUTH_MISSING */
  arkModel: string
  /** name → 测试注入模板路径 */
  templatePaths?: Record<string, string>
}

export interface InstalledAgentProfile {
  name: string
  path: string
}

/**
 * 按 AGENT_PROFILES 顺序渲染安装全部 profile（feature-018 契约 §2）。
 * ARK_MODEL 缺失 / 空白：抛 UPSTREAM_AUTH_MISSING，不静默回退。
 */
export async function installAgentProfiles(
  opts: InstallAgentProfilesOptions,
): Promise<InstalledAgentProfile[]> {
  const arkModel = opts.arkModel?.trim()
  if (!arkModel) {
    throw makeError(
      'UPSTREAM_AUTH_MISSING',
      'ARK_MODEL 未配置：Agent profile 不可用（不会回退 mock），请在 .env 设置 ARK_MODEL',
    )
  }
  const agentsDir = path.join(runtimeConfigDir(opts.userDataDir), AGENTS_DIR_NAME)
  await fsp.mkdir(agentsDir, { recursive: true })

  const installed: InstalledAgentProfile[] = []
  for (const spec of AGENT_PROFILES) {
    const { targetPath, rendered } = await renderAgentFile(
      opts.userDataDir, spec, arkModel, opts.templatePaths?.[spec.name],
    )
    await fsp.writeFile(targetPath, rendered, 'utf-8')
    installed.push({ name: spec.name, path: targetPath })
  }
  return installed
}

/** 兼容保留：仅安装 director 一个 profile（旧链路，feature-022 移除） */
export async function installDirectorAgent(opts: InstallDirectorOptions): Promise<string> {
  const arkModel = opts.arkModel?.trim()
  if (!arkModel) {
    throw makeError(
      'UPSTREAM_AUTH_MISSING',
      'ARK_MODEL 未配置：主控 director profile 不可用（不会回退 mock），请在 .env 设置 ARK_MODEL',
    )
  }
  const agentsDir = path.join(runtimeConfigDir(opts.userDataDir), AGENTS_DIR_NAME)
  await fsp.mkdir(agentsDir, { recursive: true })
  const { targetPath, rendered } = await renderAgentFile(
    opts.userDataDir,
    { name: DIRECTOR_AGENT, file: DIRECTOR_FILE_NAME },
    arkModel,
    opts.templatePath,
  )
  await fsp.writeFile(targetPath, rendered, 'utf-8')
  return targetPath
}

/**
 * 启动序列编排：重生成 opencode.json + 安装全部 profile。
 * ARK_MODEL 缺失不阻断运行时启动（mock 可用、serve 健康），仅令 profile 不安装并带回结构化原因。
 */
export async function setupRuntimeFiles(opts: {
  userDataDir: string
  arkModel?: string
  arkBaseUrl?: string
  mockBaseUrl?: string
  templatePath?: string
}): Promise<RuntimeFilesResult> {
  const config = await generateRuntimeConfig(opts)
  if (!opts.arkModel?.trim()) {
    return {
      config,
      directorPath: null,
      profiles: [],
      directorError: {
        code: 'UPSTREAM_AUTH_MISSING',
        message: 'ARK_MODEL 未配置：Agent profile 未安装，仅 mock provider 可用',
      },
    }
  }
  const profiles = await installAgentProfiles({
    userDataDir: opts.userDataDir,
    arkModel: opts.arkModel,
    templatePaths: opts.templatePath ? { [DIRECTOR_AGENT]: opts.templatePath } : undefined,
  })
  const director = profiles.find(p => p.name === DIRECTOR_AGENT)
  return {
    config,
    directorPath: director?.path ?? null,
    profiles,
    directorError: null,
  }
}

// -- 内部 ---------------------------------------------------------------------

function makeError(code: RuntimeErrorCode, message: string): Error {
  const err = new Error(message)
  err.name = code
  return err
}
