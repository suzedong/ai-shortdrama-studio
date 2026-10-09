// feature-008 T8 · 端到端集成测试
// 真二进制 opencode serve（1.18.34）+ 本机最小 OpenAI 兼容桩（127.0.0.1:4099，mock provider）
// 链路：manager（生命周期）→ client（会话/prompt）→ projection（SSE 六类事件）。
// IPC（main.ts）是上述三层的薄封装，逻辑均在此覆盖；通道经 tsc 与 T9 真机验证。
//
// 真机 ark 链路默认 skip：RUNTIME_E2E_ARK=1 且具备 ARK_API_KEY/ARK_MODEL 时才运行（契约 §9）。
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  OpencodeRuntimeManager,
  resolveOpencodeBinaryPath,
} from '../../electron/runtime/manager'
import { OpencodeRuntimeClient } from '../../electron/runtime/client'
import { subscribeEvents, type EventStreamHandle } from '../../electron/runtime/projection'
import {
  MOCK_API_KEY,
  MOCK_MODEL_ID,
} from '../../electron/runtime/provider'
import type { RuntimeEvent } from '../../electron/runtime/types'

// -- 最小 OpenAI 兼容桩（固定 4099，与 provider.ts MOCK_BASE_URL_DEFAULT 对齐） -

interface StubRequest {
  url: string
  method: string
  auth: string
  body: unknown
}

const MOCK_REPLY = '你好，世界'

function startMockStub(): { server: http.Server; requests: StubRequest[] } {
  const requests: StubRequest[] = []
  const server = http.createServer((req, res) => {
    const url = req.url ?? ''
    if (req.method === 'GET' && url === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        object: 'list',
        data: [{ id: MOCK_MODEL_ID, object: 'model', created: 0, owned_by: 'mock' }],
      }))
      return
    }
    if (req.method === 'POST' && url === '/v1/chat/completions') {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        let body: unknown = null
        try {
          body = JSON.parse(raw)
        } catch {
          body = raw
        }
        requests.push({ url, method: 'POST', auth: String(req.headers.authorization ?? ''), body })

        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        const base = {
          id: 'chatcmpl-mock',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: MOCK_MODEL_ID,
        }
        const write = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`)
        write({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' } }] })
        setTimeout(() => {
          write({ ...base, choices: [{ index: 0, delta: { content: MOCK_REPLY } }] })
        }, 60)
        setTimeout(() => {
          write({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
          res.write('data: [DONE]\n\n')
          res.end()
        }, 140)
      })
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  })
  return { server, requests }
}

async function waitForEvent(
  events: RuntimeEvent[],
  predicate: (e: RuntimeEvent) => boolean,
  timeoutMs = 45_000,
): Promise<RuntimeEvent> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = events.find(predicate)
    if (found) return found
    if (Date.now() >= deadline) {
      throw new Error(
        `等待事件超时（${timeoutMs}ms），已收到：${events.map((e) => e.type).join(', ') || '空'}`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const ALLOWED_EVENT_TYPES = new Set([
  'runtime.connected',
  'message.delta',
  'message.part',
  'tool.call',
  'session.idle',
  'runtime.error',
])

// -- 真 binary 可用性探测：缺失则整组 skip（未执行 postinstall 的环境） ---------

const binaryAvailable = fs.existsSync(resolveOpencodeBinaryPath())
const skipNoBinary = binaryAvailable ? false : 'opencode 真二进制缺失（npm postinstall 未执行）'

describe('T8-1/T8-2 · mock provider 端到端（真 opencode serve + 本机桩）', () => {
  let server: http.Server
  let requests: StubRequest[]
  let manager: OpencodeRuntimeManager
  let client: OpencodeRuntimeClient
  let stream: EventStreamHandle
  let userDataDir: string
  let workspaceDir: string
  const events: RuntimeEvent[] = []

  const savedEnv = {
    ARK_API_KEY: process.env.ARK_API_KEY,
    ARK_MODEL: process.env.ARK_MODEL,
    ARK_BASE_URL: process.env.ARK_BASE_URL,
  }

  beforeAll(async () => {
    const stub = startMockStub()
    server = stub.server
    requests = stub.requests

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(4099, '127.0.0.1', resolve)
    })

    userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdg-runtime-e2e-userdata-'))
    workspaceDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdg-runtime-e2e-ws-'))

    // 不带 ark Key（出公网链路物理不成立）；给占位 ARK_MODEL 仅为安装 director profile
    // （client 强制 agent=director；profile 安装是其可用前提），prompt 全部显式指定 mock 模型。
    delete process.env.ARK_API_KEY
    delete process.env.ARK_MODEL
    delete process.env.ARK_BASE_URL

    manager = new OpencodeRuntimeManager()
    client = new OpencodeRuntimeClient({
      getConnection: () => manager.getConnection(),
      allowedArkModel: 'e2e-placeholder-model',
    })

    await manager.start({
      userDataDir,
      cwd: workspaceDir,
      arkModel: 'e2e-placeholder-model',
    })
    const conn = manager.getConnection()
    if (!conn) throw new Error('start 后无连接信息')
    stream = await subscribeEvents({
      conn,
      version: manager.getStatus().version,
      onEvent: (e) => events.push(e),
    })
  }, 60_000)

  afterAll(async () => {
    try {
      await stream?.close()
    } catch {
      // ignore
    }
    try {
      await manager?.stop()
    } catch {
      // ignore
    }
    await new Promise<void>((resolve) => server.close(() => resolve()))
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    await fsp.rm(userDataDir, { recursive: true, force: true }).catch(() => {})
    await fsp.rm(workspaceDir, { recursive: true, force: true }).catch(() => {})
  })

  it.skipIf(skipNoBinary)('健康：running + healthy + version', () => {
    const status = manager.getStatus()
    expect(status.state).toBe('running')
    expect(status.healthy).toBe(true)
    expect(typeof status.version).toBe('string')
    expect(status.version!.length).toBeGreaterThan(0)
    expect(status.port).not.toBeNull()
    // 状态 DTO 不得含口令 / baseURL
    expect(JSON.stringify(status)).not.toContain('password')
  })

  it.skipIf(skipNoBinary)('listAgents 暴露 director/showrunner 两个 primary（并存）', async () => {
    const agents = await client.listAgents()
    expect(agents.map((a) => a.name).sort()).toEqual(['director', 'showrunner'])
    const director = agents.find(a => a.name === 'director')!
    expect(director.tools.slice().sort()).toEqual(['glob', 'grep', 'read'])
    const showrunner = agents.find(a => a.name === 'showrunner')!
    expect(showrunner.tools.slice().sort()).toEqual([
      'shortdrama_canvas_get',
      'shortdrama_canvas_update',
      'shortdrama_file_list',
      'shortdrama_file_read',
      'shortdrama_file_write',
      'shortdrama_gate_request',
    ])
  })

  it.skipIf(skipNoBinary)(
    '全链路：create → promptAsync → message.delta → session.idle → abort → delete',
    async () => {
      const session = await client.createSession('t8-e2e')
      expect(session.id).toBeTruthy()
      expect(session.title).toBe('t8-e2e')

      const accepted = await client.promptAsync({
        sessionId: session.id,
        text: '只回复四个字：你好，世界',
        agent: 'director',
        model: { providerID: 'mock', modelID: MOCK_MODEL_ID },
      })
      expect(accepted.accepted).toBe(true)
      expect(accepted.messageId).toMatch(/^msg/)

      const idle = await waitForEvent(
        events,
        (e) => e.type === 'session.idle' && (e as { sessionId?: string }).sessionId === session.id,
      )
      expect(idle.type).toBe('session.idle')

      const deltas = events
        .filter(
          (e): e is Extract<RuntimeEvent, { type: 'message.delta' }> =>
            e.type === 'message.delta' && e.sessionId === session.id,
        )
        .map((e) => e.delta)
      expect(deltas.join('')).toContain(MOCK_REPLY)

      // 所有投影响事件必须落在封闭六类内
      for (const e of events) {
        expect(ALLOWED_EVENT_TYPES.has(e.type)).toBe(true)
      }

      // abort（idle 后幂等成功）
      expect(await client.abortSession(session.id)).toEqual({ ok: true })
      // delete 后列表不再包含
      expect(await client.deleteSession(session.id)).toEqual({ ok: true })
      const list = await client.listSessions()
      expect(list.find((s) => s.id === session.id)).toBeUndefined()
    },
    60_000,
  )

  it.skipIf(skipNoBinary)('同步 prompt：业务结果正常返回（mock 文本）', async () => {
    const session = await client.createSession('t8-sync')
    const result = await client.prompt({
      sessionId: session.id,
      text: '只回复四个字：你好，世界',
      model: { providerID: 'mock', modelID: MOCK_MODEL_ID },
    })
    expect(result.error).toBeNull()
    expect(result.messageId).toMatch(/^msg/)
    expect(result.text).toContain(MOCK_REPLY)
    await client.deleteSession(session.id).catch(() => {})
  }, 60_000)

  it.skipIf(skipNoBinary)('安全：出网只打 mock 桩（Bearer mock-no-key），无 ark/口令泄漏', async () => {
    expect(requests.length).toBeGreaterThan(0)
    for (const req of requests) {
      expect(req.url).toBe('/v1/chat/completions')
      expect(req.auth).toBe(`Bearer ${MOCK_API_KEY}`)
      const body = req.body as { model?: string }
      expect(body.model).toBe(MOCK_MODEL_ID)
      // 请求体不得携带 serve 口令
      expect(JSON.stringify(req.body)).not.toContain(manager.getConnection()?.password ?? '')
    }

    // 生成态 opencode.json：无 ark Key 落盘、无 serve 口令、mock 指向本机
    const generated = await fsp.readFile(
      path.join(userDataDir, 'opencode', 'opencode.json'),
      'utf-8',
    )
    const parsedConfig = JSON.parse(generated) as {
      provider?: { ark?: Record<string, unknown> }
    }
    // ark 配置只允许 env 引用，结构上不含 apiKey 字段（Key 永不落盘，契约 §7.1/§8.1）
    expect(JSON.stringify(parsedConfig.provider?.ark ?? {})).not.toMatch(/"apiKey"\s*:/)
    expect(generated).toContain('127.0.0.1:4099')
    const password = manager.getConnection()?.password ?? ''
    expect(password.length).toBeGreaterThan(10)
    expect(generated).not.toContain(password)
    expect(JSON.stringify(events)).not.toContain(password)
    expect(JSON.stringify(manager.getStatus())).not.toContain(password)
    // 纯净环境断言：链路未携带任何 ark 凭证
    expect(JSON.stringify(requests)).not.toMatch(/ARK_API_KEY|ark\.cn-beijing/)
  })

  it.skipIf(skipNoBinary)('stop 后连接关闭、状态 stopped', async () => {
    await manager.stop()
    expect(manager.getStatus().state).toBe('stopped')
    expect(manager.getConnection()).toBeNull()
  }, 15_000)
})

// -- T8-3 故障路径（不依赖真二进制） -------------------------------------------

describe('T8-3 · 故障路径结构化错误', () => {
  it('未运行（无连接）时 client 调用 → RUNTIME_NOT_READY（name=code，消息无凭证）', async () => {
    const brokenClient = new OpencodeRuntimeClient({ getConnection: () => null })
    await expect(brokenClient.createSession('x')).rejects.toMatchObject({ name: 'RUNTIME_NOT_READY' })
    await expect(
      brokenClient.prompt({ sessionId: 'ses_x', text: 'hi' }),
    ).rejects.toMatchObject({ name: 'RUNTIME_NOT_READY' })
  })

  it('子进程启动期异常退出 → start reject RUNTIME_START_FAILED，status 结构化 error 且不重启', async () => {
    class FakeChild extends EventEmitter {
      killed = false
      kill(signal?: string): boolean {
        this.killed = true
        queueMicrotask(() => this.emit('exit', signal === 'SIGKILL' ? 137 : 1, null))
        return true
      }
    }
    const badManager = new OpencodeRuntimeManager({
      spawn: (() => {
        const child = new FakeChild()
        // 配置生成成功后、健康检查前立即异常退出
        queueMicrotask(() => child.emit('exit', 1, null))
        return child as unknown as ChildProcess
      }) as typeof import('node:child_process').spawn,
      fetchImpl: (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch,
      healthTimeoutMs: 2_000,
      healthIntervalMs: 100,
      forceKillAfterMs: 50,
      sigkillGraceMs: 20,
    })

    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdg-runtime-fail-'))
    await expect(
      badManager.start({ userDataDir: tmp, cwd: tmp }),
    ).rejects.toMatchObject({ name: 'RUNTIME_START_FAILED' })

    const status = badManager.getStatus()
    expect(status.state).toBe('error')
    expect(status.error).not.toBeNull()
    expect(status.error!.code).toBe('RUNTIME_START_FAILED')
    expect(typeof status.error!.message).toBe('string')
    // 应用不崩：status 通道仍可读；错误消息不含口令样式串
    expect(status.error!.message).not.toMatch(/Bearer\s+\S+/)
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {})
  }, 10_000)
})

// -- T8-4 真机 ark（默认 skip） ------------------------------------------------

const arkEnabled =
  process.env.RUNTIME_E2E_ARK === '1' &&
  !!process.env.ARK_API_KEY &&
  !!process.env.ARK_MODEL
const arkIt = arkEnabled ? it : it.skip

describe('T8-4 · 真机 ark 链路（RUNTIME_E2E_ARK=1 且有 ARK_API_KEY/ARK_MODEL）', () => {
  let manager: OpencodeRuntimeManager
  let dirs: string[] = []
  const events: RuntimeEvent[] = []
  let stream: EventStreamHandle

  arkIt('director 默认 ark 模型跑通一轮 prompt', async () => {
    const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdg-runtime-ark-userdata-'))
    const workspaceDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdg-runtime-ark-ws-'))
    dirs = [userDataDir, workspaceDir]

    manager = new OpencodeRuntimeManager()
    const client = new OpencodeRuntimeClient({
      getConnection: () => manager.getConnection(),
      allowedArkModel: process.env.ARK_MODEL,
    })
    await manager.start({
      userDataDir,
      cwd: workspaceDir,
      arkApiKey: process.env.ARK_API_KEY,
      arkModel: process.env.ARK_MODEL,
      arkBaseUrl: process.env.ARK_BASE_URL,
    })
    const conn = manager.getConnection()!
    stream = await subscribeEvents({
      conn,
      version: manager.getStatus().version,
      onEvent: (e) => events.push(e),
    })

    const session = await client.createSession('t8-ark')
    const result = await client.prompt({ sessionId: session.id, text: '回复两个字：收到' })
    expect(result.error).toBeNull()
    expect(result.text.length).toBeGreaterThan(0)
    const idle = await waitForEvent(
      events,
      (e) => e.type === 'session.idle',
      60_000,
    )
    expect(idle.type).toBe('session.idle')

    await client.deleteSession(session.id).catch(() => {})
    await stream.close()
    await manager.stop()
  }, 90_000)

  afterAll(async () => {
    try {
      await stream?.close()
    } catch {
      // ignore
    }
    try {
      await manager?.stop()
    } catch {
      // ignore
    }
    for (const d of dirs) await fsp.rm(d, { recursive: true, force: true }).catch(() => {})
  })
})
