import { describe, expect, it, vi, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'
import net from 'node:net'
import fs from 'node:fs'
import type { ChildProcess } from 'node:child_process'

import {
  OpencodeRuntimeManager,
  findFreePort,
  buildChildEnv,
  resolveOpencodeBinaryPath,
  PORT_RANGE_START,
  PORT_RANGE_ATTEMPTS,
} from '../../electron/runtime/manager'
import type { RuntimeStatus } from '../../electron/runtime/types'

// -- 假子进程 / 假 spawn -------------------------------------------------------

class FakeChild extends EventEmitter {
  pid = 4242
  readonly signals: NodeJS.Signals[] = []
  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.signals.push(signal)
    return true
  }
  // 仅供测试触发
  emitExit(code: number | null, signal: NodeJS.Signals | null = null) {
    this.emit('exit', code, signal)
  }
  emitSpawnError(message: string) {
    this.emit('error', new Error(message))
  }
}

interface SpawnRec {
  cmd: string
  args: string[]
  opts: { cwd?: string; env?: NodeJS.ProcessEnv }
  child: FakeChild
}

interface FakeMcpHandle {
  port: number
  token: string
  url: string
  close: ReturnType<typeof vi.fn>
}

function makeMcpStarter() {
  const handles: FakeMcpHandle[] = []
  const starter = vi.fn(async () => {
    const handle: FakeMcpHandle = {
      port: 4100 + handles.length,
      token: `mcp-token-${handles.length}`,
      url: `http://127.0.0.1:${4100 + handles.length}/mcp`,
      close: vi.fn(async () => {}),
    }
    handles.push(handle)
    return handle
  })
  return { starter, handles }
}

function makeHarness(fetchImpl?: typeof fetch) {
  const records: SpawnRec[] = []
  const spawn = vi.fn((cmd: string, args: string[], opts: any) => {
    const child = new FakeChild()
    records.push({ cmd, args, opts, child })
    return child as unknown as ChildProcess
  })
  const mcp = makeMcpStarter()
  const manager = new OpencodeRuntimeManager({
    spawn: spawn as unknown as typeof import('node:child_process').spawn,
    fetchImpl,
    mcpServerStarter: mcp.starter,
    healthIntervalMs: 5,
    healthTimeoutMs: 80,
    forceKillAfterMs: 30,
    sigkillGraceMs: 20,
  })
  return { manager, spawn, records, mcp }
}

function healthyFetch(): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ healthy: true, version: '1.18.34' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
}

async function tmpUserData() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-runtime-mgr-'))
  return { userDataDir: path.join(dir, 'userdata'), cwd: dir }
}

const ARK_KEY_SENTINEL = 'ark-key-sentinel-1234'
const HOST_PASSWORD = 'host-password-must-not-inherit'

afterEach(() => {
  vi.restoreAllMocks()
})

// -- 纯函数 -------------------------------------------------------------------

describe('resolveOpencodeBinaryPath / findFreePort / buildChildEnv', () => {
  it('二进制解析到 opencode-ai/bin/opencode.exe 且文件存在', () => {
    const p = resolveOpencodeBinaryPath()
    expect(p.endsWith(path.join('bin', 'opencode.exe'))).toBe(true)
    expect(fs.existsSync(p)).toBe(true)
  })

  it('findFreePort：从 4096 起探测，被占用端口自动跳过，返回端口可绑定', async () => {
    // 从 PORT_RANGE_START 起动态抢占一个端口作为 blocker：
    // 全量并行跑时 4096/4097 可能已被其他测试（真实 serve）占用，不能硬编码。
    let blocked = PORT_RANGE_START
    const blocker = await new Promise<net.Server>((resolve, reject) => {
      let candidate = PORT_RANGE_START
      const tryOccupy = (): void => {
        const srv = net.createServer()
        srv.once('listening', () => resolve(srv))
        srv.once('error', () => {
          candidate += 1
          if (candidate >= PORT_RANGE_START + PORT_RANGE_ATTEMPTS) {
            reject(new Error('测试端口均被占用'))
          } else {
            tryOccupy()
          }
        })
        srv.listen(candidate, '127.0.0.1')
      }
      blocked = candidate
      tryOccupy()
    })
    // blocker 实际占用的端口需回传（listening 前 candidate 可能已递增）
    blocked = (blocker.address() as net.AddressInfo).port

    const port = await findFreePort()
    expect(port).toBeGreaterThanOrEqual(PORT_RANGE_START)
    expect(port).not.toBe(blocked)
    await new Promise<void>((resolve, reject) => {
      const probe = net.createServer()
      probe.once('error', reject)
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolve()))
    })
    blocker.close()
  })

  it('buildChildEnv：XDG/口令/ARK 注入；宿主污染变量被清除', () => {
    process.env.OPENCODE_CONFIG = '/etc/host-opencode.json'
    process.env.OPENCODE_SERVER_PASSWORD = HOST_PASSWORD
    const mcpArg = { url: 'http://127.0.0.1:4100/mcp', token: 'mcp-token-1' }
    const env = buildChildEnv(
      { arkApiKey: ARK_KEY_SENTINEL, arkModel: 'ep-x', arkBaseUrl: 'https://ark/v3' },
      '/tmp/userdata',
      'child-pass',
      mcpArg,
    )
    expect(env.XDG_CONFIG_HOME).toBe('/tmp/userdata')
    expect(env.XDG_DATA_HOME).toBe(path.join('/tmp/userdata', 'opencode-data'))
    expect(env.OPENCODE_SERVER_PASSWORD).toBe('child-pass')
    expect(env.OPENCODE_CONFIG).toBeUndefined()
    expect(env.OPENCODE_MCP_URL).toBe(mcpArg.url)
    expect(env.OPENCODE_MCP_TOKEN).toBe(mcpArg.token)
    expect(env.ARK_API_KEY).toBe(ARK_KEY_SENTINEL)
    expect(env.ARK_MODEL).toBe('ep-x')
    expect(env.ARK_BASE_URL).toBe('https://ark/v3')

    // 未显式传入 ark：删除继承自宿主的 ARK 变量
    const env2 = buildChildEnv({}, '/tmp/userdata', 'child-pass', mcpArg)
    expect(env2.ARK_API_KEY).toBeUndefined()
    expect(env2.ARK_MODEL).toBeUndefined()
    expect(env2.OPENCODE_SERVER_PASSWORD).toBe('child-pass')

    // MCP url/token 为空：拒绝构造
    expect(() => buildChildEnv({}, '/tmp/userdata', 'child-pass', { url: '', token: 'x' })).toThrow()
    delete process.env.OPENCODE_CONFIG
    delete process.env.OPENCODE_SERVER_PASSWORD
  })
})

// -- 状态机 -------------------------------------------------------------------

describe('OpencodeRuntimeManager 启动 / 健康检查', () => {
  it('happy path：starting→running，spawn 参数固定，Basic 认证头正确，状态不含口令', async () => {
    const seenAuth: string[] = []
    const fetchImpl = (async (_input: any, init?: any) => {
      seenAuth.push(init?.headers?.Authorization ?? '')
      return new Response(JSON.stringify({ healthy: true, version: '1.18.34' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    const h = makeHarness(fetchImpl)
    const dirs = await tmpUserData()
    const states: RuntimeStatus['state'][] = []
    h.manager.onStatusChange((s) => states.push(s.state))

    const status = await h.manager.start({ ...dirs, arkApiKey: ARK_KEY_SENTINEL, arkModel: 'ep-x' })

    expect(status.state).toBe('running')
    expect(status.healthy).toBe(true)
    expect(status.port).toBeGreaterThanOrEqual(PORT_RANGE_START)
    expect(status.version).toBe('1.18.34')
    expect(status.startedAt).not.toBeNull()
    expect(status.error).toBeNull()
    expect(states).toEqual(['starting', 'running'])

    // spawn 参数契约：serve --hostname 127.0.0.1 --port <port>；无 mdns/cors
    expect(h.records).toHaveLength(1)
    const rec = h.records[0]!
    expect(rec.cmd).toBe(resolveOpencodeBinaryPath())
    expect(rec.args).toEqual(['serve', '--hostname', '127.0.0.1', '--port', String(status.port)])
    expect(rec.args.some((a) => a.includes('mdns') || a.includes('cors'))).toBe(false)
    expect(rec.opts.cwd).toBe(dirs.cwd)
    expect(rec.opts.env?.ARK_API_KEY).toBe(ARK_KEY_SENTINEL)

    // MCP：spawn 前启动，url/token 经 env 注入
    expect(h.mcp.starter).toHaveBeenCalledOnce()
    const mcpHandle = h.mcp.handles[0]!
    expect(rec.opts.env?.OPENCODE_MCP_URL).toBe(mcpHandle.url)
    expect(rec.opts.env?.OPENCODE_MCP_TOKEN).toBe(mcpHandle.token)

    // Basic 头：opencode:<password>
    expect(seenAuth.length).toBeGreaterThan(0)
    const decoded = Buffer.from(seenAuth[0]!.slice('Basic '.length), 'base64').toString()
    expect(decoded.startsWith('opencode:')).toBe(true)

    // 连接信息仅主进程可取；状态快照不含口令
    const conn = h.manager.getConnection()
    expect(conn?.password).toBeTruthy()
    expect(decoded).toBe(`opencode:${conn!.password}`)
    expect(JSON.stringify(status)).not.toContain(conn!.password)
  })

  it('单例幂等：并发两次 start 只 spawn 一次，均返回 running', async () => {
    const h = makeHarness(healthyFetch())
    const dirs = await tmpUserData()
    const [s1, s2] = await Promise.all([h.manager.start(dirs), h.manager.start(dirs)])
    expect(s1.state).toBe('running')
    expect(s2.state).toBe('running')
    expect(h.spawn).toHaveBeenCalledTimes(1)
    expect(h.mcp.starter).toHaveBeenCalledTimes(1)
  })

  it('健康检查超时：reject RUNTIME_HEALTH_FAILED，状态 error，子进程被 SIGKILL', async () => {
    const hangingFetch = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch
    const h = makeHarness(hangingFetch)
    const dirs = await tmpUserData()
    await expect(h.manager.start(dirs)).rejects.toMatchObject({ name: 'RUNTIME_HEALTH_FAILED' })
    const status = h.manager.getStatus()
    expect(status.state).toBe('error')
    expect(status.error?.code).toBe('RUNTIME_HEALTH_FAILED')
    expect(h.records[0]!.child.signals).toContain('SIGKILL')
    // 启动失败：MCP server 一并关闭
    expect(h.mcp.handles[0]!.close).toHaveBeenCalledOnce()
  })

  it('MCP server 启动失败：RUNTIME_START_FAILED，不起 opencode', async () => {
    const h = makeHarness(healthyFetch())
    h.mcp.starter.mockRejectedValueOnce(new Error('mcp boom'))
    const dirs = await tmpUserData()
    await expect(h.manager.start(dirs)).rejects.toMatchObject({ name: 'RUNTIME_START_FAILED' })
    expect(h.spawn).not.toHaveBeenCalled()
  })

  it('spawn 抛错：RUNTIME_START_FAILED，错误信息中口令被打码', async () => {
    const secretPass = 'super-secret-pass-xyz'
    const h = makeHarness(healthyFetch())
    h.spawn.mockImplementation(() => {
      throw new Error(`spawn failed password=${secretPass}`)
    })
    const dirs = await tmpUserData()
    await expect(h.manager.start(dirs)).rejects.toMatchObject({ name: 'RUNTIME_START_FAILED' })
    expect(h.manager.getStatus().error?.message).not.toContain(secretPass)
  })

  it('启动期 exit code≠0：RUNTIME_START_FAILED 且不自动重启（spawn 仅一次）', async () => {
    const neverFetch = (() => new Promise(() => {})) as unknown as typeof fetch
    const h = makeHarness(neverFetch)
    const dirs = await tmpUserData()
    const p = h.manager.start(dirs)
    await new Promise((r) => setTimeout(r, 20))
    h.records[0]!.child.emitExit(1)
    await expect(p).rejects.toMatchObject({ name: 'RUNTIME_START_FAILED' })
    expect(h.manager.getStatus().state).toBe('error')
    expect(h.spawn).toHaveBeenCalledTimes(1)
  })
})

describe('OpencodeRuntimeManager 运行期异常与停止', () => {
  async function startManager() {
    const h = makeHarness(healthyFetch())
    const dirs = await tmpUserData()
    const status = await h.manager.start(dirs)
    return { h, dirs, status }
  }

  it('运行期异常退出（code=1）：置 INTERNAL/error，不自动重启；MCP 关闭；显式 start 可再拉起', async () => {
    const { h } = await startManager()
    h.records[0]!.child.emitExit(1)
    expect(h.manager.getStatus().state).toBe('error')
    expect(h.manager.getStatus().error?.code).toBe('INTERNAL')
    expect(h.manager.getConnection()).toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    expect(h.spawn).toHaveBeenCalledTimes(1)
    expect(h.mcp.handles[0]!.close).toHaveBeenCalledOnce()

    const status2 = await h.manager.start((await tmpUserData()))
    expect(status2.state).toBe('running')
    expect(h.spawn).toHaveBeenCalledTimes(2)
    expect(h.mcp.starter).toHaveBeenCalledTimes(2)
  })

  it('运行期正常退出（code=0）：置 stopped，MCP 关闭', async () => {
    const { h } = await startManager()
    h.records[0]!.child.emitExit(0)
    expect(h.manager.getStatus().state).toBe('stopped')
    expect(h.manager.getStatus().error).toBeNull()
    expect(h.mcp.handles[0]!.close).toHaveBeenCalledOnce()
  })

  it('stop：先跑 beforeStop hook，再 SIGTERM；exit 后置 stopped、连接清空', async () => {
    const { h } = await startManager()
    const hook = vi.fn(async () => {})
    h.manager.addBeforeStopHook(hook)
    const stopP = h.manager.stop()
    await new Promise((r) => setTimeout(r, 10))
    expect(h.records[0]!.child.signals).toEqual(['SIGTERM'])
    h.records[0]!.child.emitExit(0)
    const status = await stopP
    expect(hook).toHaveBeenCalledOnce()
    expect(status.state).toBe('stopped')
    expect(status.port).toBeNull()
    expect(h.manager.getConnection()).toBeNull()
    expect(h.mcp.handles[0]!.close).toHaveBeenCalledOnce()
  })

  it('SIGTERM 超时不退：升级 SIGKILL 后 stop 仍正常完成', async () => {
    const { h } = await startManager()
    const t0 = Date.now()
    const status = await h.manager.stop() // 假进程不 emit exit
    expect(Date.now() - t0).toBeLessThan(2_000)
    expect(h.records[0]!.child.signals).toEqual(['SIGTERM', 'SIGKILL'])
    expect(status.state).toBe('stopped')
    expect(h.mcp.handles[0]!.close).toHaveBeenCalledOnce()
  })

  it('stopped 状态下 stop 幂等不报错', async () => {
    const h = makeHarness(healthyFetch())
    const s = await h.manager.stop()
    expect(s.state).toBe('stopped')
  })
})
