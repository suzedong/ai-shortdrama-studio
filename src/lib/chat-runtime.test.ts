import { describe, expect, it } from 'vitest'

import {
  reduceRuntimeEvent,
  turnReasoning,
  turnText,
  turnToChatMessage,
  type StreamingTurn,
  type ToolView,
} from './chat-runtime'
import type { RuntimeEvent } from './runtime-types'
import type { ChatMessage } from '@shared/types'

const TS = '2026-10-05T01:00:00.000Z'

const connected = (): RuntimeEvent => ({ type: 'runtime.connected', ts: TS, version: '1.18.34' })
const delta = (
  messageId: string,
  text: string,
  track: 'text' | 'reasoning' = 'text',
): RuntimeEvent => ({
  type: 'message.delta', ts: TS, sessionId: 's', messageId, track, delta: text,
})
const part = (
  messageId: string,
  partId: string,
  kind: 'text' | 'reasoning',
  text: string,
): RuntimeEvent => ({
  type: 'message.part', ts: TS, sessionId: 's', messageId, partId, part: { kind, text },
})
const toolCall = (
  messageId: string,
  fields: {
    callId: string
    tool: string
    status: ToolView['status']
    args?: unknown
    result?: unknown
    errorText?: string
    startedAt?: number
    endedAt?: number
  },
): RuntimeEvent => ({
  type: 'tool.call',
  ts: TS,
  sessionId: 's',
  messageId,
  callId: fields.callId,
  tool: fields.tool,
  status: fields.status,
  argsPreview: '',
  args: fields.args ?? {},
  ...(fields.result !== undefined ? { result: fields.result } : {}),
  ...(fields.errorText !== undefined ? { errorText: fields.errorText } : {}),
  ...(fields.startedAt !== undefined ? { startedAt: fields.startedAt } : {}),
  ...(fields.endedAt !== undefined ? { endedAt: fields.endedAt } : {}),
})
const idle = (): RuntimeEvent => ({ type: 'session.idle', ts: TS, sessionId: 's' })
const errorEvt = (code = 'PROMPT_FAILED'): RuntimeEvent => ({
  type: 'runtime.error',
  ts: TS,
  sessionId: 's',
  error: { code: code as never, message: '失败' },
})

const reduceAll = (events: RuntimeEvent[], initial: StreamingTurn | null = null) =>
  events.reduce<StreamingTurn | null>(
    (turn, e) => reduceRuntimeEvent(turn, e),
    initial,
  )

describe('reduceRuntimeEvent · 惰性建轮', () => {
  it('connected / idle / error 在 turn=null 时不建轮', () => {
    expect(reduceRuntimeEvent(null, connected())).toBeNull()
    expect(reduceRuntimeEvent(null, idle())).toBeNull()
    expect(reduceRuntimeEvent(null, errorEvt())).toBeNull()
  })

  it('delta / part / tool 事件在 turn=null 时惰性建轮', () => {
    expect(reduceRuntimeEvent(null, delta('m1', 'a'))).toMatchObject({
      messageId: 'm1', status: 'running',
    })
    expect(reduceRuntimeEvent(null, part('m1', 'p1', 'reasoning', '思考'))).toMatchObject({
      messageId: 'm1',
    })
    expect(
      reduceRuntimeEvent(null, toolCall('m1', { callId: 'c1', tool: 'shortdrama_diagnose', status: 'running' })),
    ).toMatchObject({ messageId: 'm1' })
  })
})

describe('reduceRuntimeEvent · delta 预览与分轨', () => {
  it('无快照时 delta 逐字累加成预览 → idle 定稿', () => {
    const turn = reduceAll([delta('m1', '你'), delta('m1', '好'), delta('m1', '，世界'), idle()])
    expect(turn).not.toBeNull()
    expect(turn!.deltaPreview.text).toBe('你好，世界')
    expect(turn!.deltaPreview.reasoning).toBe('')
    expect(turnText(turn!)).toBe('你好，世界')
    expect(turn!.status).toBe('done')
  })

  it('reasoning track 的 delta 落推理轨，绝不混入正文', () => {
    const turn = reduceAll([
      delta('m1', '内心推导', 'reasoning'),
      delta('m1', '真实回答', 'text'),
    ])!
    expect(turn.deltaPreview.reasoning).toBe('内心推导')
    expect(turn.deltaPreview.text).toBe('真实回答')
    expect(turnReasoning(turn)).toBe('内心推导')
    expect(turnText(turn)).toBe('真实回答')
  })

  it('多 step：不同 messageId 的 delta / part / tool 聚合进同一轮（turn id 保留首个）', () => {
    // 真机序：首个 assistant step 只有 reasoning 无 text，后续 step 才有正文
    const turn = reduceAll([
      part('m1', 'r1', 'reasoning', '思考中'),
      delta('m2', '正文前'),
      part('m2', 't1', 'text', '第一段'),
      toolCall('m3', { callId: 'c', tool: 'read', status: 'running' }),
      part('m4', 't2', 'text', '第二段'),
    ])!
    expect(turn.messageId).toBe('m1')
    // 存在 text 快照后 delta 预览被取代：正文只取各快照按序拼接
    expect(turnText(turn)).toBe('第一段第二段')
    expect(Object.keys(turn.tools)).toEqual(['c'])
  })

  it('多 step 真机序：首 step 无 text，末 step 汇报文本不被丢弃 → idle 定稿有正文', () => {
    const turn = reduceAll([
      part('m1', 'r1', 'reasoning', 'Done. Report to user.'),
      part('m2', 't1', 'text', '可进入第 3 步「资产」，我不会自动执行。'),
      idle(),
    ])!
    expect(turn.status).toBe('done')
    expect(turnText(turn)).toBe('可进入第 3 步「资产」，我不会自动执行。')
  })
})

describe('reduceRuntimeEvent · part 快照 replace（D-008）', () => {
  it('同一 partId 多次快照整体 replace，绝不追加', () => {
    const turn = reduceAll([
      part('m1', 'p1', 'text', '角'),
      part('m1', 'p1', 'text', '角色'),
      part('m1', 'p1', 'text', '角色修复'),
    ])!
    expect(Object.keys(turn.parts)).toEqual(['p1'])
    expect(turn.parts.p1!.text).toBe('角色修复')
    expect(turnText(turn)).toBe('角色修复')
  })

  it('不同 partId 按首次出现顺序拼接；delta 预览在有快照后被忽略', () => {
    const turn = reduceAll([
      delta('m1', '与快照重复的预览'),
      part('m1', 'pa', 'text', '第一段'),
      part('m1', 'pb', 'text', '第二段'),
    ])!
    expect(Object.keys(turn.parts)).toEqual(['pa', 'pb'])
    expect(turnText(turn)).toBe('第一段第二段')
  })

  it('text / reasoning 快照分轨；turnReasoning 同理优先快照', () => {
    const turn = reduceAll([
      part('m1', 'pr', 'reasoning', '先思考'),
      delta('m1', '推理预览', 'reasoning'),
      part('m1', 'pt', 'text', '再回答'),
    ])!
    expect(turnReasoning(turn)).toBe('先思考')
    expect(turnText(turn)).toBe('再回答')
  })
})

describe('reduceRuntimeEvent · 工具 upsert', () => {
  it('同一 callId 三态 upsert：保留 args/startedAt，completed 补 result/endedAt', () => {
    const turn = reduceAll([
      toolCall('m1', { callId: 'c1', tool: 'shortdrama_diagnose', status: 'running', args: { text: '创意' }, startedAt: 100 }),
      toolCall('m1', { callId: 'c1', tool: 'shortdrama_diagnose', status: 'running', args: { text: '创意' }, startedAt: 100 }),
      toolCall('m1', {
        callId: 'c1', tool: 'shortdrama_diagnose', status: 'completed', args: { text: '创意' },
        result: { kind: 'diagnosis', product: { conclusion: '可行' } }, startedAt: 100, endedAt: 250,
      }),
    ])!
    const view = turn.tools.c1!
    expect(view.status).toBe('completed')
    expect(view.args).toEqual({ text: '创意' })
    expect(view.result).toEqual({ kind: 'diagnosis', product: { conclusion: '可行' } })
    expect(view.startedAt).toBe(100)
    expect(view.endedAt).toBe(250)
  })

  it('多工具：按首次出现顺序保留键；非 envelope output 原串保留', () => {
    const turn = reduceAll([
      toolCall('m1', { callId: 'c1', tool: 'read', status: 'completed', result: 'file body', startedAt: 1, endedAt: 2 }),
      toolCall('m1', { callId: 'c2', tool: 'shortdrama_storyboard', status: 'running', startedAt: 3 }),
    ])!
    expect(Object.keys(turn.tools)).toEqual(['c1', 'c2'])
    expect(turn.tools.c1!.result).toBe('file body')
    expect(turn.tools.c2!.status).toBe('running')
    expect(turn.tools.c2!.endedAt).toBeUndefined()
  })

  it('error 态：补 errorText 且不带 result', () => {
    const turn = reduceRuntimeEvent(
      null,
      toolCall('m1', {
        callId: 'c1', tool: 'shortdrama_scenes', status: 'error',
        errorText: '故事上下文缺失', startedAt: 1, endedAt: 2,
      }),
    )!
    expect(turn.tools.c1!.errorText).toBe('故事上下文缺失')
    expect(turn.tools.c1!.result).toBeUndefined()
  })
})

describe('reduceRuntimeEvent · 定稿与中断', () => {
  it('runtime.error → error 定稿，已生成的快照 / 预览保留', () => {
    const turn = reduceAll([
      delta('m1', '半截预览'),
      part('m1', 'p1', 'reasoning', '思考快照'),
      errorEvt('PROMPT_ABORTED'),
    ])!
    expect(turn.status).toBe('error')
    expect(turn.deltaPreview.text).toBe('半截预览')
    expect(turnReasoning(turn)).toBe('思考快照')
  })

  it('D-010：done 后 error 不再翻转；error 后 idle 不再翻转', () => {
    const doneTurn = reduceAll([delta('m1', 'a'), idle()])
    expect(doneTurn!.status).toBe('done')
    expect(reduceRuntimeEvent(doneTurn, errorEvt())).toBe(doneTurn)

    const errorTurn = reduceAll([delta('m1', 'a'), errorEvt('PROMPT_ABORTED')])
    expect(errorTurn!.status).toBe('error')
    expect(reduceRuntimeEvent(errorTurn, idle())).toBe(errorTurn)
  })

  it('D-010 真机序：abort 后 error×2 + idle×2 成对到达，始终停在 error 且只定稿一次', () => {
    const turn = reduceAll([
      delta('m1', '已生成正文'),
      errorEvt('PROMPT_ABORTED'),
      errorEvt('PROMPT_ABORTED'),
      idle(),
      idle(),
    ])!
    expect(turn.status).toBe('error')
    expect(turnText(turn)).toBe('已生成正文')
  })
})

describe('turnToChatMessage', () => {
  it('id 用 messageId；content 取 text 快照；agent 文本消息', () => {
    const turn = reduceAll([
      delta('m1', '会被快照取代的预览'),
      part('m1', 'p1', 'text', '你好'),
      idle(),
    ])!
    const msg: ChatMessage = turnToChatMessage(turn)
    expect(msg.id).toBe('m1')
    expect(msg.role).toBe('agent')
    expect(msg.kind).toBe('text')
    expect(msg.content).toBe('你好')
    expect(typeof msg.ts).toBe('number')
  })

  it('无快照时定稿回退 deltaPreview.text', () => {
    const turn = reduceAll([delta('m2', '纯预览正文')])!
    expect(turnToChatMessage(turn).content).toBe('纯预览正文')
  })

  it('空正文（纯工具轮）→ content 为空串', () => {
    const turn: StreamingTurn = {
      messageId: 'm3',
      parts: {},
      deltaPreview: { text: '', reasoning: '' },
      status: 'done',
      tools: { c: { callId: 'c', tool: 'read', status: 'completed', args: {} } },
    }
    expect(turnToChatMessage(turn).content).toBe('')
  })
})
