// feature-808 · 历史回放纯函数（契约 §3 H1–H8 / §6.1）
import { describe, expect, it } from 'vitest'
import { replayMessages, type ReplayMessageRecord } from './history-replay'

function rec(
  id: string,
  role: 'user' | 'assistant',
  parts: unknown[],
): ReplayMessageRecord {
  return { info: { id, role }, parts: parts as ReplayMessageRecord['parts'] }
}

const t = (text: string, extra: Record<string, unknown> = {}) => ({
  type: 'text', text, ...extra,
})

describe('feature-808 · replayMessages（契约 §6.1）', () => {
  it('H8：空数组 / 非数组 → []', () => {
    expect(replayMessages([])).toEqual([])
    expect(replayMessages(undefined as unknown as ReplayMessageRecord[])).toEqual([])
    expect(replayMessages(null as unknown as ReplayMessageRecord[])).toEqual([])
    expect(replayMessages({} as unknown as ReplayMessageRecord[])).toEqual([])
  })

  it('H2：单条 user，单/多 text part 拼接；无 time 字段的用户 part 仍输出', () => {
    expect(replayMessages([rec('u1', 'user', [t('你好')])])).toEqual([
      { id: 'u1', role: 'user', text: '你好' },
    ])
    expect(replayMessages([rec('u2', 'user', [t('第一句，'), t('第二句')])])).toEqual([
      { id: 'u2', role: 'user', text: '第一句，第二句' },
    ])
    // 用户 part 即使带 startedAt 也按普通文本聚合（用户不认 time）
    expect(replayMessages([rec('u3', 'user', [t('嗨', { startedAt: 123 })])])).toEqual([
      { id: 'u3', role: 'user', text: '嗨' },
    ])
  })

  it('H5：user 聚合后为空文本 → 丢弃；ignored/synthetic 文本 → 丢弃', () => {
    expect(replayMessages([rec('u1', 'user', [t('')])])).toEqual([])
    expect(replayMessages([rec('u2', 'user', [t('忽略我', { ignored: true })])])).toEqual([])
    expect(replayMessages([rec('u3', 'user', [t('合成的', { synthetic: true })])])).toEqual([])
    // 全部文本被忽略 → 聚合为空 → 丢弃（注意：全空白用户文本保留，仅判空串）
    expect(replayMessages([rec('u4', 'user', [t('   ')])])).toEqual([
      { id: 'u4', role: 'user', text: '   ' },
    ])
  })

  it('H3/H6：assistant 仅聚合带 startedAt(number) 的 text；映射为 agent/showrunner 气泡', () => {
    const out = replayMessages([
      rec('a1', 'assistant', [
        t('不带时间，不进'),
        t('带时间，进', { startedAt: 1000 }),
      ]),
    ])
    expect(out).toEqual([
      { id: 'a1', role: 'agent', text: '带时间，进', agent: 'showrunner' },
    ])
    // agent 气泡无 brief/trace 字段
    expect(Object.keys(out[0]!).sort()).toEqual(['agent', 'id', 'role', 'text'])
  })

  it('assistant 正文与多个 reasoning part 按原序聚合；user reasoning 不上屏', () => {
    expect(replayMessages([
      rec('a1', 'assistant', [
        { type: 'reasoning', text: '先分析', startedAt: 1 },
        { type: 'tool', tool: 'write_file' },
        { type: 'reasoning', text: '，再作答', startedAt: 2 },
        t('正文', { startedAt: 3 }),
      ]),
      rec('u1', 'user', [
        { type: 'reasoning', text: '用户侧推理不展示' },
        t('用户正文'),
      ]),
    ])).toEqual([
      {
        id: 'a1', role: 'agent', text: '正文', agent: 'showrunner',
        reasoning: '先分析，再作答',
      },
      { id: 'u1', role: 'user', text: '用户正文' },
    ])
    expect(replayMessages([
      rec('a2', 'assistant', [
        { type: 'reasoning', text: '' },
        t('无推理字段', { startedAt: 1 }),
      ]),
    ])).toEqual([
      { id: 'a2', role: 'agent', text: '无推理字段', agent: 'showrunner' },
    ])
  })

  it('H3：正文与推理之外恢复四种工具状态、起止时间和错误，不带参数或结果', () => {
    expect(replayMessages([
      rec('a-tools', 'assistant', [
        { type: 'reasoning', text: '先调用工具', startedAt: 1 },
        {
          type: 'tool', text: '', callId: 'call-done', tool: 'write_file', status: 'completed',
          startedAt: 1000, endedAt: 1250, args: { secret: true }, result: '不回放',
        },
        { type: 'tool', text: '', callId: 'call-run', tool: 'read_file', status: 'running', startedAt: 2000 },
        {
          type: 'tool', text: '', callId: 'call-error', tool: 'edit_file', status: 'error',
          startedAt: 3000, endedAt: 3500, error: '写入失败',
        },
        { type: 'tool', text: '', callId: 'call-pending', tool: 'list_files', status: 'pending' },
        t('工具处理完成', { startedAt: 4 }),
      ]),
    ])).toEqual([
      {
        id: 'a-tools', role: 'agent', text: '工具处理完成', agent: 'showrunner', reasoning: '先调用工具',
        tools: [
          {
            callId: 'call-done', tool: 'write_file', status: 'completed', args: {},
            startedAt: 1000, endedAt: 1250,
          },
          { callId: 'call-run', tool: 'read_file', status: 'running', args: {}, startedAt: 2000 },
          {
            callId: 'call-error', tool: 'edit_file', status: 'error', args: {},
            startedAt: 3000, endedAt: 3500, errorText: '写入失败',
          },
          { callId: 'call-pending', tool: 'list_files', status: 'pending', args: {}, startedAt: 0 },
        ],
      },
    ])
  })

  it('D-012：argsPreview 白名单摘要透传到工具快照；空串 / 非字符串不落', () => {
    const out = replayMessages([
      rec('a-args', 'assistant', [
        {
          type: 'tool', text: '', callId: 'c1', tool: 'shortdrama_capture_upsert', status: 'completed',
          startedAt: 1, endedAt: 2, argsPreview: '题材赛道',
        },
        {
          type: 'tool', text: '', callId: 'c2', tool: 'shortdrama_canvas_get', status: 'completed',
          startedAt: 3, argsPreview: '',
        },
        {
          type: 'tool', text: '', callId: 'c3', tool: 'shortdrama_web_search', status: 'completed',
          startedAt: 4, argsPreview: 42,
        },
        t('完成', { startedAt: 5 }),
      ]),
    ])
    expect(out[0]?.tools).toEqual([
      {
        callId: 'c1', tool: 'shortdrama_capture_upsert', status: 'completed', args: {},
        argsPreview: '题材赛道', startedAt: 1, endedAt: 2,
      },
      { callId: 'c2', tool: 'shortdrama_canvas_get', status: 'completed', args: {}, startedAt: 3 },
      { callId: 'c3', tool: 'shortdrama_web_search', status: 'completed', args: {}, startedAt: 4 },
    ])
  })

  it('H3：同 callId 后快照替换，工具保持首次出现顺序', () => {
    const out = replayMessages([
      rec('a-snapshots', 'assistant', [
        { type: 'tool', text: '', callId: 'call-1', tool: 'write_file', status: 'running', startedAt: 10 },
        { type: 'tool', text: '', callId: 'call-2', tool: 'read_file', status: 'completed', startedAt: 20, endedAt: 30 },
        {
          type: 'tool', text: '', callId: 'call-1', tool: 'write_file', status: 'completed',
          startedAt: 10, endedAt: 40,
        },
        t('完成', { startedAt: 50 }),
      ]),
    ])
    expect(out[0]?.tools).toEqual([
      { callId: 'call-1', tool: 'write_file', status: 'completed', args: {}, startedAt: 10, endedAt: 40 },
      { callId: 'call-2', tool: 'read_file', status: 'completed', args: {}, startedAt: 20, endedAt: 30 },
    ])
  })

  it('H8：坏工具数据跳过；user 工具不上屏；合法工具缺省时间以 0 占位', () => {
    const out = replayMessages([
      rec('u-tool', 'user', [
        { type: 'tool', text: '', callId: 'user-call', tool: 'write_file', status: 'completed' },
        t('用户正文'),
      ]),
      rec('a-bad-tools', 'assistant', [
        { type: 'tool', text: '', tool: 'write_file', status: 'completed' },
        { type: 'tool', text: '', callId: '', tool: 'write_file', status: 'completed' },
        { type: 'tool', text: '', callId: 'bad-tool', status: 'completed' },
        { type: 'tool', text: '', callId: 'bad-status', tool: 'write_file', status: 'done' },
        {
          type: 'tool', text: '', callId: 'good', tool: 'write_file', status: 'error',
          startedAt: 'bad', endedAt: 'bad', error: 42,
        },
        t('保留正文', { startedAt: 1 }),
      ]),
    ])
    expect(out).toEqual([
      { id: 'u-tool', role: 'user', text: '用户正文' },
      {
        id: 'a-bad-tools', role: 'agent', text: '保留正文', agent: 'showrunner',
        tools: [{ callId: 'good', tool: 'write_file', status: 'error', args: {}, startedAt: 0 }],
      },
    ])
  })

  it('H4：assistant 无有效文本（无 startedAt / 纯空白 / 非文本 part）→ 无气泡（abort 空轮同理）', () => {
    expect(replayMessages([rec('a1', 'assistant', [t('无时间')])])).toEqual([])
    expect(replayMessages([
      rec('a2', 'assistant', [t('   ', { startedAt: 1 })]),
      ])).toEqual([])
    expect(replayMessages([
      rec('a3', 'assistant', [
        { type: 'reasoning', text: '思考过程', startedAt: 1 },
        { type: 'tool', tool: 'write_file', startedAt: 2 },
      ]),
    ])).toEqual([])
    expect(replayMessages([rec('a4', 'assistant', [])])).toEqual([])
  })

  it('assistant 的 ignored/synthetic 文本即使带 startedAt 也丢弃', () => {
    expect(replayMessages([
      rec('a1', 'assistant', [t('忽略', { startedAt: 1, ignored: true })]),
    ])).toEqual([])
    expect(replayMessages([
      rec('a2', 'assistant', [
        t('保留', { startedAt: 2 }),
        t('合成', { startedAt: 3, synthetic: true }),
      ]),
    ])).toEqual([
      { id: 'a2', role: 'agent', text: '保留', agent: 'showrunner' },
    ])
  })

  it('H1：u/a 混排按原序正序输出，id 取 info.id', () => {
    const out = replayMessages([
      rec('u-1', 'user', [t('立项')]),
      rec('a-1', 'assistant', [t('收到', { startedAt: 10 })]),
      rec('u-2', 'user', [t('继续')]),
      rec('a-2', 'assistant', [t('好的', { startedAt: 20 })]),
    ])
    expect(out.map(i => i.id)).toEqual(['u-1', 'a-1', 'u-2', 'a-2'])
    expect(out.map(i => i.role)).toEqual(['user', 'agent', 'user', 'agent'])
  })

  it('H7：坏记录（非对象 / info 缺失或非对象 / role 非法 / parts 非数组 / text 非字符串 / id 缺失）不抛错，按空处理', () => {
    // 故意构造畸形输入：整组经 unknown 中转，逐条 cast 会让数组字面量提前做联合类型检查
    const bad = [
      null,
      42,
      'x',
      {},
      { info: null },
      { info: { id: 'x', role: 'admin' }, parts: [] },
      rec('good', 'user', [
        null,
        42,
        { type: 'text' },
        { type: 'text', text: 123 },
        t('有效'),
      ]),
      rec('agent-good', 'assistant', [
        { type: 'reasoning', text: 123 },
        t('有效回复', { startedAt: 1 }),
      ]),
      { info: { role: 'user' }, parts: [t('无 id 记录')] },
    ] as unknown as ReplayMessageRecord[]
    const out = replayMessages(bad)
    expect(out).toEqual([
      { id: 'good', role: 'user', text: '有效' },
      { id: 'agent-good', role: 'agent', text: '有效回复', agent: 'showrunner' },
      { id: '', role: 'user', text: '无 id 记录' },
    ])
  })

  it('不改入参（快照）：返回新数组，入参对象图不被修改', () => {
    const input: ReplayMessageRecord[] = [
      rec('u1', 'user', [t('你好')]),
      rec('a1', 'assistant', [
        { type: 'reasoning', text: '推理快照' },
        t('在的', { startedAt: 1 }),
      ]),
    ]
    const snapshot = structuredClone(input)
    replayMessages(input)
    expect(input).toEqual(snapshot)
  })
})
