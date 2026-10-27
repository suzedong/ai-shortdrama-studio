import { describe, expect, it, vi } from 'vitest'

import {
  SseFrameParser,
  EventProjector,
  subscribeEvents,
  truncatePreview,
} from '../../electron/runtime/projection'
import type { RuntimeEvent } from '../../electron/runtime/types'

const NOW = new Date('2026-10-04T12:00:00.000Z')
const ctx = { version: '1.18.34', now: () => NOW }
const project = (envelope: unknown) => new EventProjector().project(envelope, ctx)
const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`

// -- 帧解析 -------------------------------------------------------------------

describe('SseFrameParser', () => {
  it('完整帧：两帧 + CRLF + 注释行 + 多 data 行拼接', () => {
    const parser = new SseFrameParser()
    const raw =
      ': ping comment\r\n' +
      'data: {"a":1}\r\n\r\n' +
      'data: line1\n' +
      'data: line2\n\n'
    const frames = parser.push(raw)
    expect(frames).toEqual(['{"a":1}', 'line1\nline2'])
  })

  it('跨 chunk 边界：半包到达时不产出，补齐后产出', () => {
    const parser = new SseFrameParser()
    const full = frame({ type: 'server.connected', properties: {} })
    expect(parser.push(full.slice(0, 10))).toEqual([])
    expect(parser.push(full.slice(10))).toEqual([JSON.stringify({ type: 'server.connected', properties: {} })])
  })

  it('id/event 字段被忽略，空 data 不分帧', () => {
    const parser = new SseFrameParser()
    const out = parser.push('id: evt_1\nevent: foo\n\ndata: x\n\n')
    expect(out).toEqual(['x'])
  })
})

// -- 六类映射 -----------------------------------------------------------------

describe('EventProjector 六类事件映射', () => {
  it('server.connected → runtime.connected（version 取上下文）', () => {
    expect(project({ type: 'server.connected', properties: {} })).toEqual({
      type: 'runtime.connected',
      ts: NOW.toISOString(),
      version: '1.18.34',
    })
  })

  it('message.part.delta → message.delta（驼峰转换；未登记 partID 默认 text）', () => {
    expect(
      project({
        type: 'message.part.delta',
        properties: {
          sessionID: 'ses_1',
          messageID: 'msg_1',
          partID: 'prt_1',
          field: 'text',
          delta: '你好',
        },
      }),
    ).toMatchObject({
      type: 'message.delta',
      sessionId: 'ses_1',
      messageId: 'msg_1',
      track: 'text',
      delta: '你好',
    })
  })

  it('D-009：delta 按 partID 对应 part 类型分轨，field 被忽略（恒为 text）', () => {
    // 复现真实序列：reasoning part 空快照登记 → 其 delta（field 仍为 text）落推理轨
    const projector = new EventProjector()
    const register = projector.project(
      {
        type: 'message.part.updated',
        properties: {
          sessionID: 'ses_1',
          part: {
            type: 'reasoning', sessionID: 'ses_1', messageID: 'msg_1', id: 'prt_r', text: '',
            time: { start: 10, end: 11 },
          },
        },
      },
      ctx,
    )
    expect(register).toMatchObject({ type: 'message.part', part: { kind: 'reasoning' } })

    const reasoningDelta = projector.project(
      {
        type: 'message.part.delta',
        properties: {
          sessionID: 'ses_1', messageID: 'msg_1', partID: 'prt_r', field: 'text', delta: '内心推导',
        },
      },
      ctx,
    )
    expect(reasoningDelta).toMatchObject({ type: 'message.delta', track: 'reasoning', delta: '内心推导' })

    // text part 登记后，其 delta 落正文轨
    projector.project(
      {
        type: 'message.part.updated',
        properties: {
          sessionID: 'ses_1',
          part: {
            type: 'text', sessionID: 'ses_1', messageID: 'msg_1', id: 'prt_t', text: '',
            time: { start: 12, end: 13 },
          },
        },
      },
      ctx,
    )
    const textDelta = projector.project(
      {
        type: 'message.part.delta',
        properties: {
          sessionID: 'ses_1', messageID: 'msg_1', partID: 'prt_t', field: 'text', delta: '正文',
        },
      },
      ctx,
    )
    expect(textDelta).toMatchObject({ type: 'message.delta', track: 'text', delta: '正文' })

    // 未知 partID（尚未登记）→ 默认 text
    const unknown = projector.project(
      {
        type: 'message.part.delta',
        properties: {
          sessionID: 'ses_1', messageID: 'msg_1', partID: 'prt_x', field: 'text', delta: '?',
        },
      },
      ctx,
    )
    expect(unknown).toMatchObject({ type: 'message.delta', track: 'text' })
  })

  it('message.part.updated：text/reasoning（带 time）→ message.part；无 time 的用户 part 忽略；tool part 三态 → tool.call', () => {
    const textEvt = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        time: 1,
        part: {
          type: 'text', sessionID: 'ses_1', messageID: 'msg_1', id: 'prt_1', text: '正文',
          time: { start: 10, end: 11 },
        },
      },
    })
    expect(textEvt).toMatchObject({
      type: 'message.part',
      part: { kind: 'text', text: '正文' },
    })

    // 用户消息的 text part（无 time）→ 忽略，不投影成 agent 轮（D-007）
    const userPart = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        time: 2,
        part: { type: 'text', sessionID: 'ses_1', messageID: 'msg_user', id: 'prt_u', text: '用户原文' },
      },
    })
    expect(userPart).toBeNull()

    // reasoning 带 time → 投影；time 无 start（畸形）→ 忽略
    const reasoningEvt = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'reasoning', sessionID: 'ses_1', messageID: 'msg_1', id: 'prt_r', text: '思考',
          time: { start: 9, end: 10 },
        },
      },
    })
    expect(reasoningEvt).toMatchObject({
      type: 'message.part',
      part: { kind: 'reasoning', text: '思考' },
    })

    const toolRunning = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool',
          sessionID: 'ses_1',
          messageID: 'msg_1',
          id: 'prt_2',
          callID: 'call_1',
          tool: 'grep',
          state: { status: 'running', input: { pattern: 'x' }, time: { start: 1 } },
        },
      },
    })
    expect(toolRunning).toMatchObject({
      type: 'tool.call',
      callId: 'call_1',
      tool: 'grep',
      status: 'running',
      argsPreview: '{"pattern":"x"}',
      args: { pattern: 'x' },
      startedAt: 1,
    })
    expect((toolRunning as any).resultPreview).toBeUndefined()
    expect((toolRunning as any).endedAt).toBeUndefined()

    const toolDone = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool',
          sessionID: 'ses_1',
          messageID: 'msg_1',
          id: 'prt_2',
          callID: 'call_1',
          tool: 'read',
          state: { status: 'completed', input: {}, output: 'file body', title: 'f', metadata: {}, time: { start: 1, end: 2 } },
        },
      },
    })
    expect(toolDone).toMatchObject({
      type: 'tool.call',
      tool: 'read',
      status: 'completed',
      resultPreview: 'file body',
      args: {},
      result: 'file body',
      startedAt: 1,
      endedAt: 2,
    })

    const toolErr = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool',
          sessionID: 'ses_1',
          messageID: 'msg_1',
          id: 'prt_3',
          callID: 'call_2',
          tool: 'bash',
          state: { status: 'error', input: {}, error: 'boom', time: { start: 1, end: 2 } },
        },
      },
    })
    expect(toolErr).toMatchObject({
      type: 'tool.call',
      callId: 'call_2',
      status: 'error',
      resultPreview: 'boom',
      errorText: 'boom',
      startedAt: 1,
      endedAt: 2,
    })
    expect((toolErr as any).result).toBeUndefined()

    // 业务工具 failed() 信封（isError）：error 信封解析挂 result，同时保留 errorText 原文
    const failEnvelope = {
      kind: 'visual_style',
      product: null,
      error: { code: 'RUNTIME_UPSTREAM_ERROR', message: '视觉风格不在谱系目录（v1.45）' },
    }
    const toolFailEnv = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool',
          sessionID: 'ses_1',
          messageID: 'msg_1',
          id: 'prt_5',
          callID: 'call_3',
          tool: 'shortdrama_visual_style',
          state: { status: 'error', input: {}, error: JSON.stringify(failEnvelope), time: { start: 1, end: 2 } },
        },
      },
    })
    expect(toolFailEnv).toMatchObject({
      type: 'tool.call',
      callId: 'call_3',
      tool: 'shortdrama_visual_style',
      status: 'error',
      result: failEnvelope,
      errorText: JSON.stringify(failEnvelope),
      resultPreview: JSON.stringify(failEnvelope),
      startedAt: 1,
      endedAt: 2,
    })

    // pending 归一化为 running
    const pending = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool',
          sessionID: 'ses_1',
          messageID: 'msg_1',
          id: 'prt_4',
          tool: 'glob',
          state: { status: 'pending', input: {}, raw: '' },
        },
      },
    })
    expect((pending as any)?.status).toBe('running')
    // callID 缺失时回退 part.id；pending 无 time
    expect((pending as any)?.callId).toBe('prt_4')
    expect((pending as any)?.startedAt).toBeUndefined()
  })

  it('tool.call 扩展字段：envelope 解析成功返回对象；普通 JSON / 非 JSON 保留原串', () => {
    const envelope = { kind: 'diagnosis', product: { summary: '诊断结论' }, meta: { source: 'ark' } }
    const evt = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool', sessionID: 'ses_1', messageID: 'msg_1', id: 'p', callID: 'c1',
          tool: 'shortdrama_diagnose',
          state: {
            status: 'completed', input: { text: '剧本' },
            output: JSON.stringify(envelope), title: 't', metadata: {},
            time: { start: 10, end: 20 },
          },
        },
      },
    }) as Extract<RuntimeEvent, { type: 'tool.call' }>
    expect(evt.result).toEqual(envelope)
    expect(evt.resultPreview).toBe(JSON.stringify(envelope))
    expect(evt.args).toEqual({ text: '剧本' })
    expect(evt.startedAt).toBe(10)
    expect(evt.endedAt).toBe(20)

    // 普通 JSON（无 kind）→ 保留原串
    const plainJson = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool', sessionID: 'ses_1', messageID: 'msg_1', id: 'p2', callID: 'c2',
          tool: 'read',
          state: {
            status: 'completed', input: {},
            output: '{"hello":"world"}', title: 't', metadata: {},
            time: { start: 1, end: 2 },
          },
        },
      },
    }) as Extract<RuntimeEvent, { type: 'tool.call' }>
    expect(plainJson.result).toBe('{"hello":"world"}')

    // JSON 标量（有 kind 不是对象场景的补充：纯文本）→ 原串
    const text = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 'ses_1',
        part: {
          type: 'tool', sessionID: 'ses_1', messageID: 'msg_1', id: 'p3', callID: 'c3',
          tool: 'read',
          state: {
            status: 'completed', input: {},
            output: 'plain text', title: 't', metadata: {},
            time: { start: 1, end: 2 },
          },
        },
      },
    }) as Extract<RuntimeEvent, { type: 'tool.call' }>
    expect(text.result).toBe('plain text')
  })

  it('errorText 完整不截断；attachments 不透出', () => {
    const longError = 'E'.repeat(800)
    const evt = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 's',
        part: {
          type: 'tool', sessionID: 's', messageID: 'm', id: 'p', callID: 'c',
          tool: 'shortdrama_storyboard',
          state: {
            status: 'error', input: {},
            error: longError,
            time: { start: 1, end: 2 },
          },
        },
      },
    }) as Extract<RuntimeEvent, { type: 'tool.call' }>
    expect(evt.errorText).toHaveLength(800)
    expect(evt.resultPreview).toHaveLength(500)
    expect('attachments' in evt).toBe(false)
  })

  it('结构化 args 与 envelope result 中的凭证均经打码', () => {
    const envelope = { kind: 'diagnosis', product: { raw: 'token=leaked-envelope-1' } }
    const evt = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 's',
        part: {
          type: 'tool', sessionID: 's', messageID: 'm', id: 'p', callID: 'c',
          tool: 'shortdrama_diagnose',
          state: {
            status: 'completed',
            input: { text: 'a', apiKey: 'secret-input-key' },
            output: JSON.stringify(envelope),
            title: 't', metadata: {},
            time: { start: 1, end: 2 },
          },
        },
      },
    }) as Extract<RuntimeEvent, { type: 'tool.call' }>
    expect(JSON.stringify(evt.args)).not.toContain('secret-input-key')
    expect(JSON.stringify(evt.result)).not.toContain('leaked-envelope-1')
  })

  it('session.idle / session.error / message.updated(error) 映射', () => {
    expect(project({ type: 'session.idle', properties: { sessionID: 'ses_1' } })).toEqual({
      type: 'session.idle',
      ts: NOW.toISOString(),
      sessionId: 'ses_1',
    })

    const authErr = project({
      type: 'session.error',
      properties: { sessionID: 'ses_1', error: { name: 'ProviderAuthError', data: { providerID: 'ark' } } },
    })
    expect(authErr).toMatchObject({
      type: 'runtime.error',
      sessionId: 'ses_1',
      error: { code: 'UPSTREAM_AUTH_MISSING' },
    })

    const aborted = project({
      type: 'session.error',
      properties: { error: { name: 'MessageAbortedError', data: { message: 'x' } } },
    })
    expect(aborted).toMatchObject({ type: 'runtime.error', error: { code: 'PROMPT_ABORTED' } })
    expect((aborted as any).sessionId).toBeUndefined()

    const msgUpdated = project({
      type: 'message.updated',
      properties: {
        info: {
          id: 'msg_1',
          sessionID: 'ses_2',
          role: 'assistant',
          error: { name: 'UnknownError', data: { message: 'bad' } },
        },
      },
    })
    expect(msgUpdated).toMatchObject({
      type: 'runtime.error',
      sessionId: 'ses_2',
      error: { code: 'PROMPT_FAILED' },
    })
  })

  it('未识别 / 不支持 part / 载荷畸形 → null 且计数', () => {
    const projector = new EventProjector()
    expect(projector.project({ type: 'session.status', properties: {} }, ctx)).toBeNull()
    expect(projector.project({ type: 'lsp.client.diagnostics', properties: {} }, ctx)).toBeNull()
    expect(projector.project({ type: 'session.next.tool.called', properties: {} }, ctx)).toBeNull()
    expect(
      projector.project(
        {
          type: 'message.part.updated',
          properties: { sessionID: 's', part: { type: 'step-start', sessionID: 's', messageID: 'm' } },
        },
        ctx,
      ),
    ).toBeNull()
    expect(projector.project('garbage', ctx)).toBeNull()
    expect(projector.project({ properties: {} }, ctx)).toBeNull()
    expect(projector.getIgnoredCount()).toBe(6)
    expect(projector.getIgnoredByType()['session.status']).toBe(1)
    expect(projector.getIgnoredByType()['<malformed>']).toBe(2)
  })

  it('顺序保持：按信封到达顺序投影', () => {
    const envelopes = [
      { type: 'session.idle', properties: { sessionID: 'a' } },
      { type: 'session.idle', properties: { sessionID: 'b' } },
      { type: 'server.connected', properties: {} },
    ]
    const projector = new EventProjector()
    const out = envelopes.map((e) => projector.project(e, ctx)).filter(Boolean) as RuntimeEvent[]
    expect(out.map((e) => e.type + ('sessionId' in e ? (e as any).sessionId : ''))).toEqual([
      'session.idlea',
      'session.idleb',
      'runtime.connected',
    ])
  })
})

// -- 截断与打码 ---------------------------------------------------------------

describe('安全：截断 500 与凭证打码', () => {
  it('truncatePreview 截断到 500', () => {
    expect(truncatePreview('x'.repeat(600))).toHaveLength(500)
    expect(truncatePreview('short')).toBe('short')
  })

  it('argsPreview/resultPreview 超 500 被截断', () => {
    const longInput = { data: 'y'.repeat(600) }
    const evt = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 's',
        part: {
          type: 'tool',
          sessionID: 's',
          messageID: 'm',
          id: 'p',
          tool: 'read',
          state: { status: 'completed', input: longInput, output: 'z'.repeat(700), title: 't', metadata: {}, time: { start: 1, end: 2 } },
        },
      },
    }) as Extract<RuntimeEvent, { type: 'tool.call' }>
    expect(evt.argsPreview).toHaveLength(500)
    expect(evt.resultPreview).toHaveLength(500)
  })

  it('JSON 键值对与裸 kv 形式的 key/token/authorization 均打码（大小写不敏感）', () => {
    const cases = [
      '{"authorization":"Bearer abc.def.ghi"}',
      `{"apiKey":"sk-123456"}`,
      'token=aaaa-bbbb-cccc',
      'AUTHORIZATION: Bearer zzz',
    ] as const
    for (const input of cases) {
      const evt = project({
        type: 'message.part.delta',
        properties: { sessionID: 's', messageID: 'm', partID: 'p', field: 'text', delta: input },
      }) as Extract<RuntimeEvent, { type: 'message.delta' }>
      expect(evt.delta).not.toMatch(/abc\.def|sk-123456|aaaa-bbbb|Bearer zzz/)
      expect(evt.delta).toContain('***')
    }
  })

  it('工具入参中出现密钥字段 → argsPreview 打码', () => {
    const evt = project({
      type: 'message.part.updated',
      properties: {
        sessionID: 's',
        part: {
          type: 'tool',
          sessionID: 's',
          messageID: 'm',
          id: 'p',
          tool: 'bash',
          state: { status: 'running', input: { cmd: 'curl -H "authorization: Bearer secret-xyz" x', token: 'tok-1' }, time: { start: 1 } },
        },
      },
    }) as Extract<RuntimeEvent, { type: 'tool.call' }>
    expect(evt.argsPreview).not.toContain('secret-xyz')
    expect(evt.argsPreview).not.toContain('tok-1')
    expect(evt.argsPreview).toContain('***')
  })

  it('runtime.error 消息体经过打码', () => {
    const evt = project({
      type: 'session.error',
      properties: {
        sessionID: 's',
        error: { name: 'UnknownError', data: { message: 'failed key=leaked-key-999' } },
      },
    }) as Extract<RuntimeEvent, { type: 'runtime.error' }>
    expect(evt.error.message).not.toContain('leaked-key-999')
  })
})

// -- SSE 订阅（fake fetch 流） -------------------------------------------------

describe('subscribeEvents 端到端', () => {
  const conn = { baseUrl: 'http://127.0.0.1:4096', password: 'stream-pass' }

  it('Basic 认证 + 分块 SSE → 投影事件顺序投递', async () => {
    const envelopes = [
      { type: 'server.connected', properties: {} },
      { type: 'message.part.delta', properties: { sessionID: 's1', messageID: 'm1', partID: 'p1', field: 'text', delta: 'a' } },
      { type: 'session.idle', properties: { sessionID: 's1' } },
      { type: 'session.status', properties: { sessionID: 's1', status: { type: 'busy' } } },
    ]
    const bytes = new TextEncoder().encode(envelopes.map(frame).join(''))
    // 从任意位置切成 3 段
    const cut1 = Math.floor(bytes.length / 3)
    const chunks = [bytes.slice(0, cut1), bytes.slice(cut1, cut1 * 2), bytes.slice(cut1 * 2)]

    const seenReq: { url: string; auth: string }[] = []
    const fetchImpl = vi.fn(async (input: any, init?: any) => {
      seenReq.push({ url: String(input), auth: init?.headers?.Authorization ?? '' })
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            chunks.forEach((c) => controller.enqueue(c as never))
            controller.close()
          },
        }),
        { status: 200 },
      )
    })

    const received: RuntimeEvent[] = []
    const handle = await subscribeEvents({
      conn,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      version: '1.18.34',
      onEvent: (e) => received.push(e),
    })
    await handle.closed

    expect(seenReq[0]!.url).toBe('http://127.0.0.1:4096/event')
    const decoded = Buffer.from(seenReq[0]!.auth.slice('Basic '.length), 'base64').toString()
    expect(decoded).toBe('opencode:stream-pass')
    expect(received.map((e) => e.type)).toEqual([
      'runtime.connected',
      'message.delta',
      'session.idle',
    ])
    // 口令不出现在任何事件中
    expect(JSON.stringify(received)).not.toContain('stream-pass')
  })

  it('非 200 → 抛错（错误不带口令）', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }))
    await expect(
      subscribeEvents({ conn, fetchImpl: fetchImpl as unknown as typeof fetch, onEvent: () => {} }),
    ).rejects.toThrow(/401/)
  })

  it('close() 中断读取且 closed 兑现', async () => {
    let pullBlocked = true
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (pullBlocked) return new Promise(() => {}) // 挂住，等 abort
              controller.enqueue(new TextEncoder().encode(frame({ type: 'session.idle', properties: { sessionID: 's' } })))
              controller.close()
            },
            cancel() {
              pullBlocked = false
            },
          }),
          { status: 200 },
        ),
    )
    const handle = await subscribeEvents({
      conn,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onEvent: () => {},
    })
    await handle.close()
    // 未抛错即完成
  })
})
