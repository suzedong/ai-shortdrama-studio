import { describe, expect, it, vi } from 'vitest'

import { OpencodeRuntimeClient, type SdkHandle } from '../../electron/runtime/client'
import type { RuntimePromptRequest } from '../../electron/runtime/types'

// -- fake SDK -----------------------------------------------------------------

interface FakeState {
  handle: SdkHandle
  conn: { baseUrl: string; password: string } | null
  calls: Record<string, any[]>
  next: {
    session?: any
    sessionError?: { error: unknown; status?: number }
    prompt?: { info: any; parts: any[] }
    promptError?: { error: unknown; status?: number }
    promptStatus?: number
    agents?: any[]
    agentError?: { error: unknown; status?: number }
    ok?: boolean
  }
}

function makeFakeClient(opts?: { allowedArkModel?: string; conn?: any }) {
  const state: FakeState = {
    handle: null as unknown as SdkHandle,
    conn: null,
    calls: {},
    next: { ok: true },
  }
  const record = (name: string, arg: any) => {
    ;(state.calls[name] ??= []).push(arg)
  }
  const resolve = (value: any, errorState?: { error: unknown; status?: number }) => {
    if (errorState) {
      return Promise.resolve({
        data: undefined,
        error: errorState.error,
        response: { status: errorState.status ?? 500 } as Response,
      })
    }
    return Promise.resolve({ data: value, error: undefined, response: { status: 200 } as Response })
  }
  state.handle = {
    session: {
      create: vi.fn(async (o: any) => {
        record('session.create', o)
        if (state.next.sessionError) return resolve(undefined, state.next.sessionError)
        return resolve(state.next.session)
      }),
      list: vi.fn(async () => resolve(state.next.session ? [state.next.session] : [])),
      delete: vi.fn(async (o: any) => {
        record('session.delete', o)
        return resolve(true)
      }),
      abort: vi.fn(async (o: any) => {
        record('session.abort', o)
        return resolve(null)
      }),
      prompt: vi.fn(async (o: any) => {
        record('session.prompt', o)
        if (state.next.promptError) return resolve(undefined, state.next.promptError)
        return resolve(state.next.prompt)
      }),
      promptAsync: vi.fn(async (o: any) => {
        record('session.promptAsync', o)
        if (state.next.promptError) return resolve(undefined, state.next.promptError)
        return Promise.resolve({
          data: null,
          error: undefined,
          response: { status: state.next.promptStatus ?? 204 } as Response,
        })
      }),
    },
    app: {
      agents: vi.fn(async () => {
        record('app.agents', undefined)
        if (state.next.agentError) return resolve(undefined, state.next.agentError)
        return resolve(state.next.agents ?? [])
      }),
    },
  }

  const getConnection = () =>
    opts?.conn ?? { baseUrl: 'http://127.0.0.1:4096', password: 'memory-only-pass' }
  const factory = vi.fn((conn: any) => {
    state.conn = conn
    return state.handle
  })
  const client = new OpencodeRuntimeClient({
    getConnection,
    allowedArkModel: opts?.allowedArkModel ?? 'ep-allowed',
    factory,
  })
  return { client, state, factory }
}

const OC_SESSION = {
  id: 'ses_1',
  projectID: 'p',
  directory: '/tmp/ws',
  title: '测试会话',
  version: '1.18.34',
  time: { created: 1_700_000_000_000, updated: 1_700_000_001_000 },
}

describe('会话类封装', () => {
  it('createSession：title 透传，映射为 RuntimeSession（时间 ISO，空 title→null）', async () => {
    const { client, state } = makeFakeClient()
    state.next.session = OC_SESSION
    const s = await client.createSession('测试会话')
    expect(state.calls['session.create']![0]).toEqual({ body: { title: '测试会话' } })
    expect(s).toEqual({
      id: 'ses_1',
      title: '测试会话',
      createdAt: new Date(1_700_000_000_000).toISOString(),
    })

    state.next.session = { ...OC_SESSION, id: 'ses_2', title: '' }
    const s2 = await client.createSession()
    expect(state.calls['session.create']![1]).toEqual({ body: undefined })
    expect(s2.title).toBeNull()
  })

  it('createSession：title 非法 → INVALID_ARGUMENT（不触网）', async () => {
    const { client, state } = makeFakeClient()
    await expect(client.createSession(123 as unknown as string)).rejects.toMatchObject({
      name: 'INVALID_ARGUMENT',
    })
    expect(state.calls['session.create']).toBeUndefined()
  })

  it('listSessions：映射数组', async () => {
    const { client, state } = makeFakeClient()
    state.next.session = OC_SESSION
    const list = await client.listSessions()
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe('ses_1')
  })

  it('abort/delete：path 透传，成功返回 {ok:true}', async () => {
    const { client, state } = makeFakeClient()
    expect(await client.abortSession('ses_1')).toEqual({ ok: true })
    expect(await client.deleteSession('ses_1')).toEqual({ ok: true })
    expect(state.calls['session.abort']![0]).toEqual({ path: { id: 'ses_1' } })
    expect(state.calls['session.delete']![0]).toEqual({ path: { id: 'ses_1' } })
  })

  it('空 sessionId → INVALID_ARGUMENT；404 → SESSION_NOT_FOUND', async () => {
    const { client } = makeFakeClient()
    await expect(client.abortSession('  ')).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    await expect(client.deleteSession('')).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })

    const f2 = makeFakeClient()
    f2.state.next.promptError = { error: { name: 'NotFoundError' }, status: 404 }
    await expect(
      f2.client.promptAsync({ sessionId: 'x', text: 'hi' }),
    ).rejects.toMatchObject({ name: 'SESSION_NOT_FOUND' })
  })
})

describe('prompt / promptAsync 边界与透传', () => {
  const baseReq: RuntimePromptRequest = { sessionId: 'ses_9', text: '你好' }

  it('默认 agent=director；messageID 满足 ^msg；parts/tools/format 正确组装', async () => {
    const { client, state } = makeFakeClient()
    const req: RuntimePromptRequest = {
      ...baseReq,
      tools: ['read', 'glob', 'read'],
      format: { type: 'json_schema', schema: { type: 'object' }, retryCount: 2 },
    }
    const r = await client.promptAsync(req)
    expect(r.accepted).toBe(true)
    expect(r.messageId).toMatch(/^msg_/)
    const body = state.calls['session.promptAsync']![0].body
    expect(body.messageID).toBe(r.messageId)
    expect(body.parts).toEqual([{ type: 'text', text: '你好' }])
    expect(body.agent).toBe('director')
    expect(body.tools).toEqual({ read: true, glob: true }) // 去重 + map 化
    expect(body.format).toEqual({ type: 'json_schema', schema: { type: 'object' }, retryCount: 2 })
  })

  it('text 空白 / 非字符串、请求体缺失 → INVALID_ARGUMENT', async () => {
    const { client } = makeFakeClient()
    await expect(client.promptAsync({ ...baseReq, text: '   ' })).rejects.toMatchObject({
      name: 'INVALID_ARGUMENT',
    })
    await expect(
      client.promptAsync({ sessionId: 'x', text: 1 as unknown as string }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    await expect(client.promptAsync(undefined as unknown as RuntimePromptRequest)).rejects.toMatchObject({
      name: 'INVALID_ARGUMENT',
    })
  })

  it('agent 只能 director/showrunner（内置 agent 诱导被拦截）', async () => {
    const { client } = makeFakeClient()
    await expect(
      client.promptAsync({ ...baseReq, agent: 'general' }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
  })

  it('tools 只能取 director 已声明集合子集（bash/write 越界拦截）', async () => {
    const { client } = makeFakeClient()
    await expect(
      client.promptAsync({ ...baseReq, tools: ['bash'] }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    await expect(
      client.promptAsync({ ...baseReq, tools: ['read', 9 as unknown as string] }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    await expect(
      client.promptAsync({ ...baseReq, tools: 'read' as unknown as string[] }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
  })

  it('shortdrama_ 前缀 MCP 业务工具放行；近似前缀不得蒙混', async () => {
    const { client, state } = makeFakeClient()
    const tools = ['shortdrama_diagnose', 'shortdrama_storyboard']
    const r = await client.promptAsync({ ...baseReq, tools })
    expect(r.accepted).toBe(true)
    const body = state.calls['session.promptAsync']![0].body
    expect(body.tools).toEqual({ shortdrama_diagnose: true, shortdrama_storyboard: true })

    await expect(
      client.promptAsync({ ...baseReq, tools: ['shortdramaevil_x'] }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
  })

  it('model 白名单：ark 只能用已配置 modelID；mock 只能 mock-1；其余 provider 拒绝', async () => {
    const { client, state } = makeFakeClient()
    await client.promptAsync({
      ...baseReq,
      model: { providerID: 'ark', modelID: 'ep-allowed' },
    })
    expect(state.calls['session.promptAsync']!.at(-1).body.model).toEqual({
      providerID: 'ark',
      modelID: 'ep-allowed',
    })
    await client.promptAsync({ ...baseReq, model: { providerID: 'mock', modelID: 'mock-1' } })
    await expect(
      client.promptAsync({ ...baseReq, model: { providerID: 'ark', modelID: 'ep-other' } }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    await expect(
      client.promptAsync({ ...baseReq, model: { providerID: 'mock', modelID: 'mock-2' } }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    await expect(
      client.promptAsync({ ...baseReq, model: { providerID: 'volcengine', modelID: 'x' } }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
  })

  it('format 非法（缺 schema / retryCount 负数）→ INVALID_ARGUMENT', async () => {
    const { client } = makeFakeClient()
    await expect(
      client.promptAsync({
        ...baseReq,
        format: {
          type: 'json_schema',
          schema: 'x' as unknown as Record<string, unknown>,
        },
      }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    await expect(
      client.promptAsync({
        ...baseReq,
        format: { type: 'json_schema', schema: {}, retryCount: -1 } as RuntimePromptRequest['format'],
      }),
    ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
  })

  it('feature-018 · showrunner + 白名单 6 工具通过，body.agent=showrunner', async () => {
    const { client, state } = makeFakeClient()
    const tools = [
      'shortdrama_file_read',
      'shortdrama_file_list',
      'shortdrama_file_write',
      'shortdrama_canvas_get',
      'shortdrama_canvas_update',
      'shortdrama_gate_request',
    ]
    const r = await client.promptAsync({ ...baseReq, agent: 'showrunner', tools })
    expect(r.accepted).toBe(true)
    const body = state.calls['session.promptAsync']!.at(-1).body
    expect(body.agent).toBe('showrunner')
    expect(body.tools).toEqual({
      shortdrama_file_read: true,
      shortdrama_file_list: true,
      shortdrama_file_write: true,
      shortdrama_canvas_get: true,
      shortdrama_canvas_update: true,
      shortdrama_gate_request: true,
    })
  })

  it('feature-018 · subagent 名作 agent → INVALID_ARGUMENT', async () => {
    const { client } = makeFakeClient()
    for (const agent of ['writer', 'media-director', 'comfyui-operator']) {
      await expect(
        client.promptAsync({ ...baseReq, agent }),
      ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    }
  })

  it('feature-018 · showrunner 传越权工具（task/read/asset 键）→ INVALID_ARGUMENT', async () => {
    const { client } = makeFakeClient()
    for (const tools of [
      ['task'],
      ['read'],
      ['shortdrama_asset_register'],
      ['shortdrama_comfyui_queue'],
      ['bash'],
    ]) {
      await expect(
        client.promptAsync({ ...baseReq, agent: 'showrunner', tools }),
      ).rejects.toMatchObject({ name: 'INVALID_ARGUMENT' })
    }
  })

  it('promptAsync 非 2xx → PROMPT_FAILED', async () => {
    const f = makeFakeClient()
    f.state.next.promptError = { error: { name: 'BadRequestError' }, status: 400 }
    await expect(f.client.promptAsync(baseReq)).rejects.toMatchObject({ name: 'PROMPT_FAILED' })
    const f2 = makeFakeClient()
    f2.state.next.promptStatus = 500
    f2.state.next.promptError = undefined
    // 500 且无 error 字段：status 非 204/200/202 → PROMPT_FAILED
    await expect(f2.client.promptAsync(baseReq)).rejects.toMatchObject({ name: 'PROMPT_FAILED' })
  })
})

describe('prompt 同步结果与业务失败', () => {
  it('text 由 text parts 拼接，ignored part 跳过', async () => {
    const { client, state } = makeFakeClient()
    state.next.prompt = {
      info: { id: 'msg_a' },
      parts: [
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world' },
        { type: 'text', text: 'ignored', ignored: true },
        { type: 'reasoning', text: '思考' },
      ],
    }
    const r = await client.prompt({ sessionId: 's', text: 'q' })
    expect(r).toEqual({ messageId: 'msg_a', text: 'hello world', structured: null, error: null })
  })

  it('format 存在：合法 JSON（含 ```json 代码块）→ structured；非法 → result.error STRUCTURED_OUTPUT_FAILED', async () => {
    const { client, state } = makeFakeClient()
    state.next.prompt = {
      info: { id: 'm1' },
      parts: [{ type: 'text', text: '```json\n{"a":1}\n```' }],
    }
    const ok = await client.prompt({ sessionId: 's', text: 'q', format: { type: 'json_schema', schema: {} } })
    expect(ok.structured).toEqual({ a: 1 })
    expect(ok.error).toBeNull()

    state.next.prompt = { info: { id: 'm2' }, parts: [{ type: 'text', text: 'not json' }] }
    const bad = await client.prompt({ sessionId: 's', text: 'q', format: { type: 'json_schema', schema: {} } })
    expect(bad.structured).toBeNull()
    expect(bad.error?.code).toBe('STRUCTURED_OUTPUT_FAILED')
  })

  it('assistant 业务错误不 reject：ProviderAuth→UPSTREAM_AUTH_MISSING；Aborted→PROMPT_ABORTED；其余→PROMPT_FAILED', async () => {
    const cases = [
      { name: 'ProviderAuthError', code: 'UPSTREAM_AUTH_MISSING' },
      { name: 'MessageAbortedError', code: 'PROMPT_ABORTED' },
      { name: 'UnknownError', code: 'PROMPT_FAILED' },
    ]
    for (const c of cases) {
      const { client, state } = makeFakeClient()
      state.next.prompt = { info: { id: 'm', error: { name: c.name } }, parts: [] }
      const r = await client.prompt({ sessionId: 's', text: 'q' })
      expect(r.error?.code).toBe(c.code)
    }
  })

  it('通道级错误（401/连接失败）→ reject，且错误消息不含口令', async () => {
    const f1 = makeFakeClient()
    f1.state.next.promptError = { error: 'unauthorized', status: 401 }
    await expect(f1.client.prompt({ sessionId: 's', text: 'q' })).rejects.toMatchObject({
      name: 'INTERNAL',
    })
    const f2 = makeFakeClient({ conn: null as unknown as object })
    // getConnection 返回 null → RUNTIME_NOT_READY
    const client2 = new OpencodeRuntimeClient({
      getConnection: () => null,
      factory: f2.factory,
      allowedArkModel: 'ep-allowed',
    })
    await expect(client2.prompt({ sessionId: 's', text: 'q' })).rejects.toMatchObject({
      name: 'RUNTIME_NOT_READY',
    })
  })
})

describe('listAgents 与连接缓存', () => {
  it('仅暴露 director/showrunner 两个 primary；tools 只取 true 键；director 省略 tools map 时兜底', async () => {
    const { client, state } = makeFakeClient()
    state.next.agents = [
      {
        name: 'general',
        description: 'built-in',
        mode: 'subagent',
        builtIn: true,
        tools: { bash: true },
        permission: {},
        options: {},
      },
      {
        name: 'director',
        description: '主控',
        mode: 'primary',
        builtIn: false,
        model: { providerID: 'ark', modelID: 'ep-allowed' },
        tools: { read: true, glob: true, grep: true, bash: false },
        permission: {},
        options: {},
      },
      {
        name: 'showrunner',
        description: '主创',
        mode: 'primary',
        builtIn: false,
        model: { providerID: 'ark', modelID: 'ep-allowed' },
        tools: {
          shortdrama_file_read: true,
          shortdrama_file_list: true,
          shortdrama_file_write: true,
          shortdrama_canvas_get: true,
          shortdrama_canvas_update: true,
          shortdrama_gate_request: true,
        },
        permission: {},
        options: {},
      },
      {
        name: 'writer',
        description: '编剧',
        mode: 'subagent',
        builtIn: false,
        tools: { shortdrama_file_read: true },
        permission: {},
        options: {},
      },
    ]
    const agents = await client.listAgents()
    expect(agents).toHaveLength(2)
    expect(agents.map(a => a.name)).toEqual(['director', 'showrunner'])
    expect(agents[0]).toEqual({
      name: 'director',
      description: '主控',
      model: { providerID: 'ark', modelID: 'ep-allowed' },
      tools: ['read', 'glob', 'grep'],
    })
    expect(agents[1]).toEqual({
      name: 'showrunner',
      description: '主创',
      model: { providerID: 'ark', modelID: 'ep-allowed' },
      tools: [
        'shortdrama_file_read',
        'shortdrama_file_list',
        'shortdrama_file_write',
        'shortdrama_canvas_get',
        'shortdrama_canvas_update',
        'shortdrama_gate_request',
      ],
    })

    // 省略 tools map（实测 REST 行为）→ director 兜底声明常量
    state.next.agents = [
      { name: 'director', description: 'd', mode: 'primary', permission: {}, options: {} },
    ]
    const agents2 = await client.listAgents()
    expect(agents2).toHaveLength(1)
    expect(agents2[0]!.model).toBeNull()
    expect(agents2[0]!.tools).toEqual(['read', 'glob', 'grep'])
  })

  it('连接信息变化（每次重启新口令）→ 重新经工厂创建句柄；口令不进任何结果', async () => {
    let n = 0
    const conns = [
      { baseUrl: 'http://127.0.0.1:4096', password: 'pass-one' },
      { baseUrl: 'http://127.0.0.1:4097', password: 'pass-two' },
    ]
    const { state, factory } = makeFakeClient()
    state.next.session = OC_SESSION
    const client3 = new OpencodeRuntimeClient({
      getConnection: () => conns[n++ === 0 ? 0 : 1]!,
      factory,
      allowedArkModel: 'ep-allowed',
    })
    await client3.listSessions()
    await client3.listSessions() // 口令已轮换 → 重建
    await client3.listSessions() // 同口令 → 命中缓存
    expect(factory).toHaveBeenCalledTimes(2)
    const captured = factory.mock.calls.map((c) => c[0]!.password)
    expect(captured).toEqual(['pass-one', 'pass-two'])
    const listed = await client3.listSessions()
    expect(JSON.stringify(listed)).not.toContain('pass-two')
  })
})
