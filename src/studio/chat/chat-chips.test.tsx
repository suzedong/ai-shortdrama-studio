// feature-010：对话内缺口追问 chip（【追问选项】块 → ChipRow 胶囊）+ 发卡拍板提示（GateHint / qh）
// 契约 §5：组① 解析与渲染 7 例 + 组② 集成 10 例；测法对齐 chat-markdown.test.tsx（纯函数直调 + 渲染层凭据双轨）。
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasGate } from '@shared/types'
import type { StreamingTurn } from '../lib/chat-runtime'
import ChatComposer, { parseChatOptions, type ChatItem } from './ChatComposer'
import { _setStyleCatalogSnapshotForTest } from './style-catalog-store'

// 与 chat-markdown.test.tsx 同款 prime：OptionCard 订阅 style:catalog 快照（2-10 回归例触达）
const PRIME_ENTRIES: StyleCatalogEntryDto[] = [
  {
    id: 'A7', name: '拟真人·仿真人动漫', familyCode: 'A', familyLabel: '写实影像系',
    role: 'main', feasibility: 'high', auxiliaryCandidate: false,
    visualTraits: '', anchorWords: 'realistic human-like anime, lifelike expression', textureRecipe: '',
  },
]

beforeEach(() => {
  _setStyleCatalogSnapshotForTest({ status: 'ok', version: 'v9.99-test', entries: PRIME_ENTRIES })
})

afterEach(() => {
  act(() => { _setStyleCatalogSnapshotForTest(null) })
})

function renderComposer(
  items: ChatItem[],
  props: {
    onSend?: (text: string) => void
    sending?: boolean
    stream?: StreamingTurn | null
    pendingGate?: CanvasGate | null
  } = {},
) {
  return render(
    <ChatComposer
      items={items}
      stream={props.stream ?? null}
      pendingGate={props.pendingGate ?? null}
      deciding={false}
      sending={props.sending ?? false}
      error={null}
      onSend={props.onSend ?? vi.fn()}
      onDecide={vi.fn()}
    />,
  )
}

function makeStreamTurn(text: string): StreamingTurn {
  return {
    messageId: 'm1',
    parts: {},
    deltaPreview: { text, reasoning: '' },
    tools: {},
    status: 'running',
  }
}

function makeGate(gateId: string): CanvasGate {
  return { gateId, status: 'pending', question: '是否批准立项？', options: ['发布立项 v1', '再改改'] }
}

const CHIPS_TEXT =
  '核心冲突是什么？\n【追问选项】\n家族反对，门第差距\n前任回归，旧情未了\n身份秘密，真相将揭\n【/追问选项】'

describe('【追问选项】块解析（组①）', () => {
  it('1-1 完整块：渲染横向胶囊组，气泡正文不含块原文与标签', () => {
    const { container } = renderComposer([{ id: 'a1', role: 'agent', text: CHIPS_TEXT }])
    expect(container.querySelector('[data-chat-chips]')).not.toBeNull()
    const chips = Array.from(container.querySelectorAll('[data-chat-chip]'))
    expect(chips.map(el => el.getAttribute('data-chat-chip'))).toEqual([
      '家族反对，门第差距',
      '前任回归，旧情未了',
      '身份秘密，真相将揭',
    ])
    const bubble = container.querySelector('.md-bubble')?.textContent ?? ''
    expect(bubble).toContain('核心冲突是什么？')
    expect(bubble).not.toContain('【')
    expect(bubble).not.toContain('家族反对')
  })

  it('1-2 负例：仅 1 行 → 整块不识别，原文原样', () => {
    const r = parseChatOptions('问题\n【追问选项】\n只有一条\n【/追问选项】')
    expect(r.chips).toBeUndefined()
    expect(r.rest).toBe('问题\n【追问选项】\n只有一条\n【/追问选项】')
  })

  it('1-3 行内含编号字样照原文收录（不经 OPT_LINE 编号解析）', () => {
    const r = parseChatOptions('问题\n【追问选项】\n1. 家族反对\n2. 前任回归\n【/追问选项】')
    expect(r.chips).toEqual(['1. 家族反对', '2. 前任回归'])
    expect(r.options).toBeUndefined()
    expect(r.rest).toBe('问题')
  })

  it('1-4 负例：块后还有非空正文 → 整块不识别，原文原样', () => {
    const text = '问题\n【追问选项】\n甲\n乙\n【/追问选项】\n后面还有话'
    const r = parseChatOptions(text)
    expect(r.chips).toBeUndefined()
    expect(r.rest).toBe(text)
  })

  it('1-5 流式 pending：有开标签无闭标签 → 正文截至开标签前', () => {
    expect(parseChatOptions('问题如下\n【追问选项】\n家族反对\n前任')).toEqual({
      rest: '问题如下',
      pending: true,
    })
  })

  it('1-6 流式 pending：尾缀半截开标签（【追问）→ pending', () => {
    expect(parseChatOptions('问题如下\n【追问')).toEqual({ rest: '问题如下', pending: true })
    expect(parseChatOptions('问题如下\n【追问选')).toEqual({ rest: '问题如下', pending: true })
  })

  it('1-7 与【缺口追问】气泡标签同条：标签剥离渲染，chips 同时正常', () => {
    const { container } = renderComposer([
      { id: 'a1', role: 'agent', text: '【缺口追问】\n还缺核心冲突：\n【追问选项】\n甲\n乙\n【/追问选项】' },
    ])
    const tag = container.querySelector('[data-chat-label="ai"]')
    expect(tag?.textContent).toBe('缺口追问')
    const chips = Array.from(container.querySelectorAll('[data-chat-chip]'))
    expect(chips.map(el => el.getAttribute('data-chat-chip'))).toEqual(['甲', '乙'])
  })
})

describe('ChipRow 交互与 GateHint（组②）', () => {
  it('2-1 点击 chip 代发该 chip 文字原文（非编号、非索引）', () => {
    const onSend = vi.fn()
    const { container } = renderComposer([{ id: 'a1', role: 'agent', text: CHIPS_TEXT }], { onSend })
    const chips = container.querySelectorAll('[data-chat-chip]')
    fireEvent.click(chips[1])
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('前任回归，旧情未了')
  })

  it('2-2 busy（sending=true）：全部 chip disabled，点击不触发', () => {
    const onSend = vi.fn()
    const { container } = renderComposer([{ id: 'a1', role: 'agent', text: CHIPS_TEXT }], {
      onSend,
      sending: true,
    })
    const first = container.querySelector('[data-chat-chip]') as HTMLButtonElement
    expect(first.disabled).toBe(true)
    expect(first.className).toContain('opacity-40')
    fireEvent.click(first)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('2-3 非末条（其后还有消息）：全部 chip disabled', () => {
    const onSend = vi.fn()
    const { container } = renderComposer(
      [
        { id: 'a1', role: 'agent', text: CHIPS_TEXT },
        { id: 'u1', role: 'user', text: '我自由发挥了别的回答' },
      ],
      { onSend },
    )
    const first = container.querySelector('[data-chat-chip]') as HTMLButtonElement
    expect(first.disabled).toBe(true)
    fireEvent.click(first)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('2-4 紧随用户回复 === chip 原文：该 chip picked 恰一处，同组全部 disabled', () => {
    const { container } = renderComposer([
      { id: 'a1', role: 'agent', text: CHIPS_TEXT },
      { id: 'u1', role: 'user', text: '前任回归，旧情未了' },
    ])
    const picked = Array.from(container.querySelectorAll('[data-picked="true"]'))
    expect(picked.length).toBe(1)
    expect(picked[0].getAttribute('data-chat-chip')).toBe('前任回归，旧情未了')
    const all = Array.from(container.querySelectorAll('[data-chat-chip]')) as HTMLButtonElement[]
    expect(all.every(b => b.disabled)).toBe(true)
  })

  it('2-5 用户回复与任何 chip 均不全等：无 data-picked', () => {
    const { container } = renderComposer([
      { id: 'a1', role: 'agent', text: CHIPS_TEXT },
      { id: 'u1', role: 'user', text: '都不是，我想自己说' },
    ])
    expect(container.querySelector('[data-picked="true"]')).toBeNull()
  })

  it('2-6 qh：pendingGate.gateId=0-final → 琥珀条挂载，文案逐字', () => {
    const { container } = renderComposer([], { pendingGate: makeGate('0-final') })
    const hint = container.querySelector('[data-chat-gate-hint]')
    expect(hint).not.toBeNull()
    expect(hint?.textContent).toContain('💡 拍板提示')
    expect(hint?.textContent).toContain('直接说「行，就按这版发布」= 按钮拍板（系统记录原话与定案卡版本）')
  })

  it('2-7 qh：pendingGate.gateId 为其他门 → 不挂载', () => {
    const { container } = renderComposer([], { pendingGate: makeGate('3-assets') })
    expect(container.querySelector('[data-chat-gate-hint]')).toBeNull()
  })

  it('2-8 qh：无 pendingGate → 不挂载', () => {
    const { container } = renderComposer([], { pendingGate: null })
    expect(container.querySelector('[data-chat-gate-hint]')).toBeNull()
  })

  it('2-9 流式气泡内 chips：完整块渲染且全部 disabled（只展不点）', () => {
    const onSend = vi.fn()
    const { container } = renderComposer([], { stream: makeStreamTurn(CHIPS_TEXT), onSend })
    const chips = Array.from(container.querySelectorAll('[data-chat-chip]')) as HTMLButtonElement[]
    expect(chips.map(el => el.getAttribute('data-chat-chip'))).toEqual([
      '家族反对，门第差距',
      '前任回归，旧情未了',
      '身份秘密，真相将揭',
    ])
    expect(chips.every(b => b.disabled)).toBe(true)
    fireEvent.click(chips[0])
    expect(onSend).not.toHaveBeenCalled()
  })

  it('2-10 既有【选项】块回归：编号卡渲染与代发不受影响，且无 chips 误判', () => {
    const onSend = vi.fn()
    const { container } = renderComposer(
      [{ id: 'a1', role: 'agent', text: '请确认：\n【选项】\n1. 确认发布 v4\n2. 取消（流程终止）\n【/选项】' }],
      { onSend },
    )
    const opts = Array.from(container.querySelectorAll('[data-chat-option]'))
    expect(opts.map(el => el.getAttribute('data-chat-option'))).toEqual(['1', '2'])
    expect(container.querySelector('[data-chat-chips]')).toBeNull()
    fireEvent.click(opts[0])
    expect(onSend).toHaveBeenCalledWith('1')
  })
})
