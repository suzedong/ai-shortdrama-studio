// feature-808 · runtime:session:messages（契约 §5.1/§5.2/§6.2）
// toMessageRecord 纯映射 + getSessionMessages 成功/404/空白 id。
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { OpencodeRuntimeClient, toMessageRecord, type SdkHandle } from '../../../electron/runtime/client'

function makeClient(opts: {
  messages?: unknown[]
  messagesError?: { error: unknown; status?: number }
}) {
  const calls: unknown[] = []
  const handle = {
    session: {
      messages: vi.fn(async (o: unknown) => {
        calls.push(o)
        if (opts.messagesError) {
          return {
            data: undefined,
            error: opts.messagesError.error,
            response: { status: opts.messagesError.status ?? 500 },
          }
        }
        return { data: opts.messages ?? [], error: undefined, response: { status: 200 } }
      }),
    },
  } as unknown as SdkHandle
  const factory = vi.fn(() => handle)
  const client = new OpencodeRuntimeClient({
    getConnection: () => ({ baseUrl: 'http://127.0.0.1:4096', password: 'p' }),
    allowedArkModel: 'ep-allowed',
    factory,
  })
  return { client, calls }
}

describe('feature-808 · toMessageRecord（契约 §6.2）', () => {
  it('仅保留 text part；role 归一 assistant/否则 user；id 缺省空串', () => {
    const r = toMessageRecord({
      info: { id: 'm1', role: 'assistant' },
      parts: [
        { type: 'reasoning', text: '思考' },
        { type: 'tool', tool: 'write_file' },
        { type: 'text', text: '正文', time: { start: 100 } },
      ],
    } as never)
    expect(r).toEqual({
      info: { id: 'm1', role: 'assistant' },
      parts: [{ type: 'text', text: '正文', startedAt: 100 }],
    })

    const u = toMessageRecord({
      info: { id: 42, role: 'user' },
      parts: [{ type: 'text', text: '用户句' }],
    } as never)
    expect(u.info).toEqual({ id: '', role: 'user' })

    const otherRole = toMessageRecord({
      info: { id: 'm2', role: 'system' },
      parts: [],
    } as never)
    expect(otherRole.info.role).toBe('user')
  })

  it('text 非字符串 → 空串；time.start 非 number 不挂 startedAt', () => {
    const r = toMessageRecord({
      info: { id: 'm3', role: 'assistant' },
      parts: [
        { type: 'text', text: 123 },
        { type: 'text', text: '无时间' },
        { type: 'text', text: '有时间', time: { start: '99' } },
      ],
    } as never)
    expect(r.parts).toEqual([
      { type: 'text', text: '' },
      { type: 'text', text: '无时间' },
      { type: 'text', text: '有时间' },
    ])
  })

  it('ignored/synthetic 仅在 ===true 时透传', () => {
    const r = toMessageRecord({
      info: { id: 'm4', role: 'assistant' },
      parts: [
        { type: 'text', text: 'a', ignored: true },
        { type: 'text', text: 'b', synthetic: true },
        { type: 'text', text: 'c', ignored: false, synthetic: 1 },
      ],
    } as never)
    expect(r.parts).toEqual([
      { type: 'text', text: 'a', ignored: true },
      { type: 'text', text: 'b', synthetic: true },
      { type: 'text', text: 'c' },
    ])
  })
})

describe('feature-808 · getSessionMessages（契约 §6.2）', () => {
  it('成功：path 透传，逐条映射为 DTO', async () => {
    const { client, calls } = makeClient({
      messages: [
        { info: { id: 'u1', role: 'user' }, parts: [{ type: 'text', text: '你好' }] },
        {
          info: { id: 'a1', role: 'assistant' },
          parts: [
            { type: 'reasoning', text: '内部' },
            { type: 'text', text: '在的', time: { start: 7 } },
          ],
        },
      ],
    })
    const out = await client.getSessionMessages('ses_1')
    expect(calls[0]).toEqual({ path: { id: 'ses_1' } })
    expect(out).toEqual([
      { info: { id: 'u1', role: 'user' }, parts: [{ type: 'text', text: '你好' }] },
      {
        info: { id: 'a1', role: 'assistant' },
        parts: [{ type: 'text', text: '在的', startedAt: 7 }],
      },
    ])
  })

  it('404 → SESSION_NOT_FOUND', async () => {
    const { client, calls } = makeClient({
      messagesError: { error: { name: 'NotFoundError' }, status: 404 },
    })
    await expect(client.getSessionMessages('gone')).rejects.toMatchObject({
      name: 'SESSION_NOT_FOUND',
    })
    // 已触网（区别于参数校验）
    expect(calls).toHaveLength(1)
  })

  it('空白 sessionId → INVALID_ARGUMENT，不触网', async () => {
    const { client, calls } = makeClient({})
    await expect(client.getSessionMessages('   ')).rejects.toMatchObject({
      name: 'INVALID_ARGUMENT',
    })
    expect(calls).toHaveLength(0)
  })
})
