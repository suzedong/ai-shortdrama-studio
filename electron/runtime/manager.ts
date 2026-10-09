// feature-008 · opencode 运行时生命周期管理器
// 严格匹配《SDG-RE-契约.md》§1/§5/§6/§8：
// - spawn 参数固定 `serve --hostname 127.0.0.1 --port <port>`，禁 mdns/cors，仅 loopback；
// - 4096 起顺序探测空闲端口；随机 Basic 口令仅存内存，经 OPENCODE_SERVER_PASSWORD 注入，不落盘；
// - 状态机 stopped/starting/running/error，每次迁移回调；单例幂等；异常退出置 error 不自动重启；
// - before-quit：beforeStop hooks（abort 会话 / 关 SSE）→ SIGTERM → 超时 SIGKILL；
// - 本模块不依赖 electron（userDataDir / cwd 由 main 注入），spawn/fetch 可替换以便全 mock 单测。
import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import crypto from 'node:crypto'
import { setupRuntimeFiles } from './provider.js'
import { startMcpToolServer, type McpToolServerHandle } from '../mcp/server.js'
import type { RuntimeErrorBody, RuntimeErrorCode, RuntimeStatus } from './types.js'

// -- 常量（契约 §1 / §6） ------------------------------------------------------

export const PORT_RANGE_START = 4096
export const PORT_RANGE_ATTEMPTS = 25
export const HEALTH_TIMEOUT_MS = 10_000
export const HEALTH_INTERVAL_MS = 300
export const FORCE_KILL_AFTER_MS = 3_000
const SERVE_HOST = '127.0.0.1'
const SERVER_USER = 'opencode'
const BINARY_RELATIVE_PATH = path.join('bin', 'opencode.exe')

// -- 二进制解析（T1-2：单一解析函数） ------------------------------------------

/**
 * 经 opencode-ai 包定位平台真二进制 launcher（postinstall 硬链到同版本平台包）。
 * 打包期 extraResources + asarUnpack 分发方案见变更记录 I-001（本期不配 builder）。
 */
export function resolveOpencodeBinaryPath(): string {
  const localRequire = createRequire(import.meta.url)
  const pkgJsonPath = localRequire.resolve('opencode-ai/package.json')
  return path.join(path.dirname(pkgJsonPath), BINARY_RELATIVE_PATH)
}

/** 随机 Basic 口令：32 字节 URL-safe，仅存主进程内存（契约 §1/§8.1） */
export function generateServerPassword(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/** 4096 起顺序探测 loopback 空闲端口（契约 §1）；耗尽抛 RUNTIME_START_FAILED */
export function findFreePort(
  start = PORT_RANGE_START,
  host = SERVE_HOST,
  attempts = PORT_RANGE_ATTEMPTS,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempt = 0
    const tryPort = (port: number) => {
      const server = net.createServer()
      server.once('error', () => {
        attempt += 1
        if (attempt >= attempts) {
          reject(
            makeError(
              'RUNTIME_START_FAILED',
              `未找到空闲端口：${start}..${start + attempts - 1} 均被占用`,
            ),
          )
        } else {
          tryPort(start + attempt)
        }
      })
      server.listen(port, host, () => {
        server.close(() => resolve(port))
      })
    }
    tryPort(start)
  })
}

// -- 类型 ---------------------------------------------------------------------

export interface StartRuntimeOptions {
  /** app.getPath('userData') */
  userDataDir: string
  /** serve 工作目录：固定平台工作区根目录（契约 §1，本期不按项目切换） */
  cwd: string
  arkApiKey?: string
  arkModel?: string
  arkBaseUrl?: string
  mockBaseUrl?: string
}

export interface RuntimeConnection {
  baseUrl: string
  password: string
}

export interface ManagerDeps {
  /** 测试注入：替换 child_process.spawn */
  spawn?: typeof spawn
  /** 测试注入：替换健康检查 fetch */
  fetchImpl?: typeof fetch
  /** 测试注入：替换 MCP 业务工具服务启动 */
  mcpServerStarter?: typeof startMcpToolServer
  healthTimeoutMs?: number
  healthIntervalMs?: number
  forceKillAfterMs?: number
  /** SIGKILL 后等待 exit 的宽限（默认 1000ms），超时也放行退出 */
  sigkillGraceMs?: number
}

type StatusListener = (status: RuntimeStatus) => void
type BeforeStopHook = () => Promise<void> | void

// -- 管理器 -------------------------------------------------------------------

export class OpencodeRuntimeManager {
  private state: RuntimeStatus['state'] = 'stopped'
  private port: number | null = null
  private version: string | null = null
  private startedAt: string | null = null
  private error: RuntimeErrorBody | null = null

  private child: ChildProcess | null = null
  private password: string | null = null
  private mcpServer: McpToolServerHandle | null = null
  private startPromise: Promise<RuntimeStatus> | null = null
  private stopping = false

  private readonly listeners = new Set<StatusListener>()
  private readonly beforeStopHooks = new Set<BeforeStopHook>()

  private readonly deps: Required<ManagerDeps>

  constructor(deps: ManagerDeps = {}) {
    this.deps = {
      spawn: deps.spawn ?? spawn,
      fetchImpl: deps.fetchImpl ?? fetch,
      mcpServerStarter: deps.mcpServerStarter ?? startMcpToolServer,
      healthTimeoutMs: deps.healthTimeoutMs ?? HEALTH_TIMEOUT_MS,
      healthIntervalMs: deps.healthIntervalMs ?? HEALTH_INTERVAL_MS,
      forceKillAfterMs: deps.forceKillAfterMs ?? FORCE_KILL_AFTER_MS,
      sigkillGraceMs: deps.sigkillGraceMs ?? 1_000,
    }
  }

  // -- 订阅 ------------------------------------------------------------------

  onStatusChange(cb: StatusListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** T7 注册：stop 前先 abort 活跃会话、关闭 SSE（契约 §6.3） */
  addBeforeStopHook(hook: BeforeStopHook): () => void {
    this.beforeStopHooks.add(hook)
    return () => this.beforeStopHooks.delete(hook)
  }

  // -- 状态 ------------------------------------------------------------------

  getStatus(): RuntimeStatus {
    return {
      state: this.state,
      port: this.port,
      version: this.version,
      healthy: this.state === 'running',
      startedAt: this.startedAt,
      // 错误体副本，绝不含口令 / Key（message 构造处已保证）
      error: this.error ? { ...this.error } : null,
    }
  }

  /** client 层（T5）取连接信息；仅 running 时可用，禁止 renderer 接触 */
  getConnection(): RuntimeConnection | null {
    if (this.state !== 'running' || !this.password || !this.port) return null
    return { baseUrl: `http://${SERVE_HOST}:${this.port}`, password: this.password }
  }

  isRunning(): boolean {
    return this.state === 'running'
  }

  // -- 生命周期 --------------------------------------------------------------

  async start(opts: StartRuntimeOptions): Promise<RuntimeStatus> {
    if (this.state === 'running') return this.getStatus()
    if (this.state === 'starting' && this.startPromise) return this.startPromise

    this.stopping = false
    this.error = null
    this.port = null
    this.version = null
    this.startedAt = null
    this.setState('starting')

    this.startPromise = this.boot(opts).finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  private async boot(opts: StartRuntimeOptions): Promise<RuntimeStatus> {
    let child: ChildProcess
    try {
      // ① 重生成配置（每次启动按模板重生成；ARK_MODEL 缺失不阻断 mock 启动）
      await setupRuntimeFiles({
        userDataDir: opts.userDataDir,
        arkModel: opts.arkModel,
        arkBaseUrl: opts.arkBaseUrl,
        mockBaseUrl: opts.mockBaseUrl,
      })

      // ② 启动 MCP 业务工具服务（spawn 前；url/token 随后注入子进程 env）
      const mcpServer = await this.deps.mcpServerStarter()
      this.mcpServer = mcpServer
      if (!mcpServer.url || !mcpServer.token) {
        throw makeError('RUNTIME_START_FAILED', 'MCP 工具服务返回的 url/token 为空，拒绝启动 opencode')
      }

      // ③ 端口 + 口令
      const port = await findFreePort()
      const password = generateServerPassword()
      const binaryPath = resolveOpencodeBinaryPath()

      // ④ spawn（固定参数，仅 loopback；禁 mdns/cors）
      child = this.deps.spawn(
        binaryPath,
        ['serve', '--hostname', SERVE_HOST, '--port', String(port)],
        {
          cwd: opts.cwd,
          env: buildChildEnv(opts, opts.userDataDir, password, mcpServer),
          windowsHide: true,
          stdio: 'ignore',
        },
      )
      this.child = child
      this.port = port
      this.password = password
      child.on('exit', (code, signal) => this.handleExit(code, signal))
      child.on('error', (err) => this.handleSpawnError(err))

      // ⑤ 健康检查轮询（~10s 上限）；进程提前退出 / spawn error 会抢先 reject
      const version = await this.waitHealthy(child)
      this.version = version
      this.startedAt = new Date().toISOString()
      this.setState('running')
      return this.getStatus()
    } catch (e) {
      this.killChildQuietly('SIGKILL')
      await this.closeMcpServerQuietly()
      const rawName = e instanceof Error ? e.name : ''
      const code = isRuntimeErrorCode(rawName) ? rawName : 'RUNTIME_START_FAILED'
      const message = sanitize(e instanceof Error ? e.message : String(e))
      this.failWith(code, message)
      throw makeError(this.error?.code ?? 'RUNTIME_START_FAILED', this.error?.message ?? '运行时启动失败')
    }
  }

  async stop(): Promise<RuntimeStatus> {
    if (!this.child || this.state === 'stopped') {
      this.setState('stopped')
      return this.getStatus()
    }
    this.stopping = true

    // ① abort 活跃会话 / 关 SSE（T7 注入；每个 hook 限时，避免阻塞退出）
    await Promise.allSettled(
      Array.from(this.beforeStopHooks).map((hook) =>
        withTimeout(hook(), 2_000, 'beforeStop hook 超时'),
      ),
    )

    const child = this.child
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))

    // ② SIGTERM
    child.kill('SIGTERM')
    let forceKilled = false
    const forceKillTimer = setTimeout(() => {
      // ③ 超时 SIGKILL
      if (this.child === child) {
        child.kill('SIGKILL')
        forceKilled = true
      }
    }, this.deps.forceKillAfterMs)

    // SIGKILL 后再给一段宽限等 exit；宽限后仍无 exit（极端僵尸 / 假进程）也放行退出，
    // 不允许子进程回收无限阻塞 app 退出（契约 §6.3）
    await Promise.race([
      exited,
      new Promise<void>((resolve) =>
        setTimeout(resolve, this.deps.forceKillAfterMs + (this.deps.sigkillGraceMs ?? 1_000)),
      ),
    ])
    clearTimeout(forceKillTimer)
    void forceKilled
    // handleExit 在 stopping 期间不改状态；这里统一收尾
    this.child = null
    this.password = null
    this.port = null
    this.version = null
    this.startedAt = null
    await this.closeMcpServerQuietly()
    this.stopping = false
    this.setState('stopped')
    return this.getStatus()
  }

  // -- 内部 ------------------------------------------------------------------

  private handleExit(code: number | null, signal: NodeJS.Signals | null) {
    this.child = null
    this.password = null
    this.port = null
    this.version = null
    this.startedAt = null

    // 显式 stop 流程中：MCP 由 stop() 收尾，不在此重复关闭
    if (this.stopping) return

    // 异常退出路径：关闭 MCP 工具服务（不等待，避免阻塞事件回调）
    void this.closeMcpServerQuietly()

    // spawn 'error' 可能先于 'exit'：已置 error 时保留更准确的原因码
    if (this.state === 'error' && this.error) return

    if (code === 0 && !signal) {
      // 正常退出：置 stopped，允许显式 runtime:start 再拉起（不自动重启）
      this.setState('stopped')
      return
    }
    this.failWith(
      this.state === 'starting' ? 'RUNTIME_START_FAILED' : 'INTERNAL',
      `opencode 子进程${this.state === 'starting' ? '启动期' : '运行期'}异常退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）`,
    )
  }

  private handleSpawnError(err: Error) {
    if (this.stopping) return
    this.failWith('RUNTIME_START_FAILED', `无法拉起 opencode 进程：${sanitize(err.message)}`)
  }

  private waitHealthy(child: ChildProcess): Promise<string> {
    const timeoutMs = this.deps.healthTimeoutMs ?? HEALTH_TIMEOUT_MS
    const intervalMs = this.deps.healthIntervalMs ?? HEALTH_INTERVAL_MS
    const deadline = Date.now() + timeoutMs

    return new Promise<string>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        clearInterval(timer)
        child.off('exit', onExit)
        child.off('error', onError)
      }
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        if (settled) return
        settled = true
        cleanup()
        reject(
          makeError(
            'RUNTIME_START_FAILED',
            `opencode 进程在健康检查前退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）`,
          ),
        )
      }
      const onError = (err: Error) => {
        if (settled) return
        settled = true
        cleanup()
        reject(makeError('RUNTIME_START_FAILED', `无法拉起 opencode 进程：${sanitize(err.message)}`))
      }
      child.once('exit', onExit)
      child.once('error', onError)

      const tick = async () => {
        if (settled) return
        if (Date.now() >= deadline) {
          settled = true
          cleanup()
          reject(makeError('RUNTIME_HEALTH_FAILED', `健康检查超时（${timeoutMs}ms）：/global/health 未就绪`))
          return
        }
        try {
          const version = await this.checkHealth()
          if (settled) return
          if (version !== null) {
            settled = true
            cleanup()
            resolve(version)
          }
        } catch {
          // 连接拒绝 / 非 200：下一轮继续
        }
      }
      const timer = setInterval(tick, intervalMs)
      void tick()
    })
  }

  private async checkHealth(): Promise<string | null> {
    if (!this.password || !this.port) return null
    const auth = basicAuth(SERVER_USER, this.password)
    const res = await this.deps.fetchImpl(`http://${SERVE_HOST}:${this.port}/global/health`, {
      headers: { Authorization: auth },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { healthy?: unknown; version?: unknown }
    return data.healthy === true && typeof data.version === 'string' ? data.version : null
  }

  private failWith(code: RuntimeErrorCode, message: string) {
    this.error = { code, message }
    this.version = null
    this.startedAt = null
    if (this.state !== 'error') this.setState('error')
  }

  private setState(state: RuntimeStatus['state']) {
    this.state = state
    const snapshot = this.getStatus()
    for (const cb of Array.from(this.listeners)) {
      try {
        cb(snapshot)
      } catch {
        // 监听器异常不影响状态机
      }
    }
  }

  private killChildQuietly(signal: NodeJS.Signals) {
    if (this.child) {
      try {
        this.child.kill(signal)
      } catch {
        // 进程可能已退出
      }
    }
  }

  /** 幂等关闭 MCP 工具服务；任何关闭异常不外抛（契约 §2.1） */
  private async closeMcpServerQuietly(): Promise<void> {
    const handle = this.mcpServer
    this.mcpServer = null
    if (!handle) return
    try {
      await handle.close()
    } catch {
      // 关闭失败不阻断退出
    }
  }
}

// -- 单例（T7 main 使用） ------------------------------------------------------

export const runtimeManager = new OpencodeRuntimeManager()

// -- 辅助 ---------------------------------------------------------------------

/**
 * 构造子进程环境：显式接管 opencode 相关变量防宿主污染；
 * ARK_API_KEY / ARK_MODEL 仅在显式传入时注入（Key 不经命令行、不进 json）。
 */
export function buildChildEnv(
  opts: Pick<StartRuntimeOptions, 'arkApiKey' | 'arkModel' | 'arkBaseUrl'>,
  userDataDir: string,
  password: string,
  mcp: Pick<McpToolServerHandle, 'url' | 'token'>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.OPENCODE_CONFIG
  delete env.OPENCODE_SERVER_PASSWORD
  delete env.OPENCODE_MCP_URL
  delete env.OPENCODE_MCP_TOKEN
  env.XDG_CONFIG_HOME = userDataDir // opencode.json 实际落在 <userDataDir>/opencode/
  env.XDG_DATA_HOME = path.join(userDataDir, 'opencode-data')
  env.OPENCODE_SERVER_PASSWORD = password
  // MCP 工具服务 url/token 仅经 env 注入（契约 §1；占位符 {env:…} 展开，缺失即空串）
  env.OPENCODE_MCP_URL = mcp.url
  env.OPENCODE_MCP_TOKEN = mcp.token
  if (!env.OPENCODE_MCP_URL || !env.OPENCODE_MCP_TOKEN) {
    throw makeError('RUNTIME_START_FAILED', 'OPENCODE_MCP_URL/TOKEN 为空，拒绝启动 opencode')
  }

  if (opts.arkApiKey) env.ARK_API_KEY = opts.arkApiKey
  else delete env.ARK_API_KEY
  if (opts.arkModel) env.ARK_MODEL = opts.arkModel
  else delete env.ARK_MODEL
  if (opts.arkBaseUrl) env.ARK_BASE_URL = opts.arkBaseUrl
  else delete env.ARK_BASE_URL
  return env
}

function basicAuth(user: string, password: string): string {
  const token = Buffer.from(`${user}:${password}`).toString('base64')
  return `Basic ${token}`
}

function withTimeout<T>(p: Promise<T> | T, ms: number, reason: string): Promise<T | void> {
  return Promise.race([
    Promise.resolve(p).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms, reason)),
  ])
}

/** 去除错误信息中可能混入的凭证片段（纵深防御：口令/Key 不进任何错误消息） */
function sanitize(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer ***')
    .replace(/(password|passwd|token|authorization|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=***')
}

function makeError(code: RuntimeErrorCode, message: string): Error {
  const err = new Error(message)
  err.name = code
  return err
}

const RUNTIME_ERROR_CODES: readonly RuntimeErrorCode[] = [
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
  'RUNTIME_UPSTREAM_ERROR',
  'INTERNAL',
]

function isRuntimeErrorCode(name: string): name is RuntimeErrorCode {
  return (RUNTIME_ERROR_CODES as readonly string[]).includes(name)
}
