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
      { info: { role: 'user' }, parts: [t('无 id 记录')] },
    ] as unknown as ReplayMessageRecord[]
    const out = replayMessages(bad)
    expect(out).toEqual([
      { id: 'good', role: 'user', text: '有效' },
      { id: '', role: 'user', text: '无 id 记录' },
    ])
  })

  it('不改入参（快照）：返回新数组，入参对象图不被修改', () => {
    const input: ReplayMessageRecord[] = [
      rec('u1', 'user', [t('你好')]),
      rec('a1', 'assistant', [t('在的', { startedAt: 1 })]),
    ]
    const snapshot = structuredClone(input)
    replayMessages(input)
    expect(input).toEqual(snapshot)
  })
})
