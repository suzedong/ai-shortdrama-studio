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
  it('按原序保留 text/reasoning/tool，丢弃 file；role 归一 assistant/否则 user；id 缺省空串', () => {
    const r = toMessageRecord({
      info: { id: 'm1', role: 'assistant' },
      parts: [
        { type: 'reasoning', text: '思考', time: { start: 50 } },
        {
          type: 'tool', callID: 'call-1', tool: 'write_file',
          state: { status: 'completed', input: { secret: true }, output: '不回放', time: { start: 60, end: 80 } },
        },
        { type: 'text', text: '正文', time: { start: 100 } },
        { type: 'file', filename: 'a.txt' },
      ],
    } as never)
    expect(r).toEqual({
      info: { id: 'm1', role: 'assistant' },
      parts: [
        { type: 'reasoning', text: '思考', startedAt: 50 },
        {
          type: 'tool', text: '', callId: 'call-1', tool: 'write_file',
          status: 'completed', startedAt: 60, endedAt: 80,
        },
        { type: 'text', text: '正文', startedAt: 100 },
      ],
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

  it('tool 映射 pending/running/error 状态；缺少时间以 0 占位，不透传参数、结果与附件', () => {
    const r = toMessageRecord({
      info: { id: 'm-tools', role: 'assistant' },
      parts: [
        {
          type: 'tool', callID: 'pending', tool: 'read_file',
          state: { status: 'pending', input: { path: 'a' }, raw: 'raw' },
        },
        {
          type: 'tool', callID: 'running', tool: 'write_file',
          state: { status: 'running', input: { path: 'b' }, time: { start: 10 }, metadata: { secret: true } },
        },
        {
          type: 'tool', callID: 'error', tool: 'edit_file',
          state: {
            status: 'error', input: { path: 'c' }, error: '失败', time: { start: 20, end: 30 },
            metadata: { secret: true }, attachments: [{ url: 'file:///secret' }],
          },
        },
      ],
    } as never)
    expect(r.parts).toEqual([
      { type: 'tool', text: '', callId: 'pending', tool: 'read_file', status: 'pending', startedAt: 0 },
      { type: 'tool', text: '', callId: 'running', tool: 'write_file', status: 'running', startedAt: 10 },
      {
        type: 'tool', text: '', callId: 'error', tool: 'edit_file', status: 'error',
        startedAt: 20, endedAt: 30, error: '失败',
      },
    ])
  })

  it('D-012：白名单工具从 state.input 提取关键参数为 argsPreview；非白名单 / 空摘要不落 DTO', () => {
    const r = toMessageRecord({
      info: { id: 'm-args', role: 'assistant' },
      parts: [
        {
          type: 'tool', callID: 'c1', tool: 'shortdrama_capture_upsert',
          state: { status: 'completed', input: { topic: '题材赛道', value: '都市逆袭' }, time: { start: 1, end: 2 } },
        },
        {
          type: 'tool', callID: 'c2', tool: 'shortdrama_web.search',
          state: { status: 'completed', input: { query: '短剧 市场规模' }, time: { start: 3 } },
        },
        {
          type: 'tool', callID: 'c3', tool: 'shortdrama_canvas_get',
          state: { status: 'completed', input: {}, time: { start: 4 } },
        },
        {
          type: 'tool', callID: 'c4', tool: 'shortdrama_file_write',
          state: { status: 'running', input: { path: 'story/第1集.md', content: '正文…' }, time: { start: 5 } },
        },
      ],
    } as never)
    expect(r.parts).toEqual([
      {
        type: 'tool', text: '', callId: 'c1', tool: 'shortdrama_capture_upsert', status: 'completed',
        startedAt: 1, endedAt: 2, argsPreview: '题材赛道',
      },
      {
        type: 'tool', text: '', callId: 'c2', tool: 'shortdrama_web.search', status: 'completed',
        startedAt: 3, argsPreview: '短剧 市场规模',
      },
      { type: 'tool', text: '', callId: 'c3', tool: 'shortdrama_canvas_get', status: 'completed', startedAt: 4 },
      {
        type: 'tool', text: '', callId: 'c4', tool: 'shortdrama_file_write', status: 'running',
        startedAt: 5, argsPreview: 'story/第1集.md',
      },
    ])
  })

  it('text/reasoning 非字符串 → 空串；time.start 非 number 不挂 startedAt', () => {
    const r = toMessageRecord({
      info: { id: 'm3', role: 'assistant' },
      parts: [
        { type: 'text', text: 123 },
        { type: 'reasoning', text: null },
        { type: 'text', text: '无时间' },
        { type: 'text', text: '有时间', time: { start: '99' } },
      ],
    } as never)
    expect(r.parts).toEqual([
      { type: 'text', text: '' },
      { type: 'reasoning', text: '' },
      { type: 'text', text: '无时间' },
      { type: 'text', text: '有时间' },
    ])
  })

  it('ignored/synthetic 仅文本分支在 ===true 时透传，reasoning 不携带这两个标志', () => {
    const r = toMessageRecord({
      info: { id: 'm4', role: 'assistant' },
      parts: [
        { type: 'text', text: 'a', ignored: true },
        { type: 'text', text: 'b', synthetic: true },
        { type: 'text', text: 'c', ignored: false, synthetic: 1 },
        { type: 'reasoning', text: 'd', ignored: true, synthetic: true, time: { start: 9 } },
      ],
    } as never)
    expect(r.parts).toEqual([
      { type: 'text', text: 'a', ignored: true },
      { type: 'text', text: 'b', synthetic: true },
      { type: 'text', text: 'c' },
      { type: 'reasoning', text: 'd', startedAt: 9 },
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
            {
              type: 'tool', callID: 'call-success', tool: 'read_file',
              state: { status: 'completed', input: { path: 'a' }, output: '内容', time: { start: 5, end: 6 } },
            },
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
        parts: [
          { type: 'reasoning', text: '内部' },
          {
            type: 'tool', text: '', callId: 'call-success', tool: 'read_file',
            status: 'completed', startedAt: 5, endedAt: 6,
          },
          { type: 'text', text: '在的', startedAt: 7 },
        ],
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
