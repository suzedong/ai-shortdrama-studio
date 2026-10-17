// 对话气泡 Markdown 渲染（2026-10-15，K9 批准 react-markdown + remark-gfm，仅 Agent 侧）
// 断言：Agent 气泡渲染粗体/行内代码/GFM 列表/链接 target=_blank；用户气泡保持纯文本不解析。
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ChatComposer, { parseChatLabel, parseChatOptions, type ChatItem } from './ChatComposer'
import { STYLE_CATALOG_VERSION } from './VisualCatalog'

function renderComposer(items: ChatItem[], props: { onSend?: (text: string) => void; sending?: boolean } = {}) {
  return render(
    <ChatComposer
      items={items}
      stream={null}
      pendingGate={null}
      deciding={false}
      sending={props.sending ?? false}
      error={null}
      onSend={props.onSend ?? vi.fn()}
      onDecide={vi.fn()}
    />,
  )
}

describe('对话气泡 Markdown（仅 Agent 侧）', () => {
  it('Agent 气泡：粗体、行内代码、GFM 无序列表被渲染', () => {
    const { container } = renderComposer([
      {
        id: 'a1',
        role: 'agent',
        text: '被系统以 **BRIEF_GATE_PENDING** 拒绝，错误码是 `BRIEF_GATE_PENDING`。\n\n- 第一点\n- 第二点',
      },
    ])
    const strong = container.querySelector('.md-bubble strong')
    expect(strong?.textContent).toBe('BRIEF_GATE_PENDING')
    const codes = Array.from(container.querySelectorAll('.md-bubble code')).map(el => el.textContent)
    expect(codes).toContain('BRIEF_GATE_PENDING')
    const lis = Array.from(container.querySelectorAll('.md-bubble ul > li')).map(el => el.textContent)
    expect(lis).toEqual(['第一点', '第二点'])
  })

  it('Agent 气泡：链接带 target=_blank rel 安全属性，原始 HTML 不渲染为节点', () => {
    const { container } = renderComposer([
      { id: 'a2', role: 'agent', text: '见 [规范](https://example.com/spec)\n<div data-x>不应出现</div>' },
    ])
    const link = container.querySelector('.md-bubble a')
    expect(link?.getAttribute('href')).toBe('https://example.com/spec')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
    expect(container.querySelector('[data-x]')).toBeNull()
  })

  it('用户气泡：markdown 原样显示，不渲染为 strong', () => {
    const { container } = renderComposer([
      { id: 'u1', role: 'user', text: '**不要渲染我** 和 `代码`' },
    ])
    expect(screen.getByText('**不要渲染我** 和 `代码`')).toBeInTheDocument()
    expect(container.querySelector('strong')).toBeNull()
    expect(container.querySelector('code')).toBeNull()
  })
})

describe('气泡标签（B-34 前缀约定）', () => {
  it('parseChatLabel：闭合前缀剥离为标签，正文保留', () => {
    expect(parseChatLabel('【AI 提取】已落库 3 个事实。')).toEqual({
      label: { text: 'AI 提取', tone: 'ai' },
      rest: '已落库 3 个事实。',
    })
    expect(parseChatLabel('【AI 提取】\n正文')).toEqual({
      label: { text: 'AI 提取', tone: 'ai' },
      rest: '正文',
    })
  })

  it('parseChatLabel：含「待确认」落 infer 琥珀色', () => {
    expect(parseChatLabel('【AI 推断 · 待确认】画幅按 9:16？').label).toEqual({
      text: 'AI 推断 · 待确认',
      tone: 'infer',
    })
  })

  it('parseChatLabel：失配降级——无前缀 / 中途【】原样，未闭合前缀作 pending', () => {
    expect(parseChatLabel('普通消息')).toEqual({ rest: '普通消息' })
    expect(parseChatLabel('正文【不是标签】')).toEqual({ rest: '正文【不是标签】' })
    expect(parseChatLabel('【AI 提')).toEqual({ rest: '', pending: true })
  })

  it('Agent 气泡：前缀渲染为浮动标签，正文不含【】', () => {
    const { container } = renderComposer([
      { id: 'a3', role: 'agent', text: '【AI 反问】主角是重生前还是重生后？' },
    ])
    const tag = container.querySelector('[data-chat-label="ai"]')
    expect(tag?.textContent).toBe('AI 反问')
    expect(container.querySelector('.md-bubble')?.textContent).not.toContain('【')
  })

  it('用户气泡：固定落「用户」标签', () => {
    const { container } = renderComposer([{ id: 'u2', role: 'user', text: '做一部校园短剧' }])
    const tag = container.querySelector('[data-chat-label="user"]')
    expect(tag?.textContent).toBe('用户')
  })

  it('无前缀消息：不渲染标签', () => {
    const { container } = renderComposer([{ id: 'a4', role: 'agent', text: '普通汇报。' }])
    expect(container.querySelector('[data-chat-label]')).toBeNull()
  })

  it('B-36：超短消息下标签不折行（whitespace-nowrap），含 agent 短气泡', () => {
    const { container } = renderComposer([
      { id: 'u9', role: 'user', text: '1' },
      { id: 'a9', role: 'agent', text: '【AI 反问】好' },
    ])
    const userTag = container.querySelector('[data-chat-label="user"]')
    expect(userTag?.textContent).toBe('用户')
    expect(userTag?.className).toContain('whitespace-nowrap')
    const aiTag = container.querySelector('[data-chat-label="ai"]')
    expect(aiTag?.className).toContain('whitespace-nowrap')
  })
})

describe('对话内选项卡（B-35 选项块约定）', () => {
  it('parseChatOptions：纯文本块剥离为选项，正文保留', () => {
    const r = parseChatOptions('请确认：\n【选项】\n1. 确认发布 v4\n2. 取消（流程终止）\n【/选项】')
    expect(r.rest).toBe('请确认：')
    expect(r.style).toBe(false)
    expect(r.options).toEqual([
      { num: '1', text: '确认发布 v4' },
      { num: '2', text: '取消（流程终止）' },
    ])
  })

  it('parseChatOptions：风格块命中谱系出 styleId，未收录 ID 降级纯文本', () => {
    const r = parseChatOptions('选一个：\n【风格选项】\n1. A7\n2. E99\n【/风格选项】')
    expect(r.style).toBe(true)
    expect(r.options?.[0]).toEqual({ num: '1', text: 'A7', styleId: 'A7' })
    expect(r.options?.[1]).toEqual({ num: '2', text: 'E99' }) // 编号格式在档但谱系未收录 → 无 styleId
  })

  it('parseChatOptions：失配降级——块不在末尾 / 行失配 / 仅一条 / 普通消息均原文保留', () => {
    expect(parseChatOptions('【选项】\n1. 甲\n2. 乙\n【/选项】\n后面还有话').options).toBeUndefined()
    expect(parseChatOptions('【选项】\n1. 甲\n这不是选项行\n【/选项】').options).toBeUndefined()
    expect(parseChatOptions('【选项】\n1. 只有一条\n【/选项】').options).toBeUndefined()
    expect(parseChatOptions('普通消息')).toEqual({ rest: '普通消息' })
  })

  it('parseChatOptions：流式未闭合块与键入中标签作 pending（块内容暂不显示）', () => {
    expect(parseChatOptions('问题如下\n【选项】\n1. 确认发布 v4\n2. ')).toEqual({
      rest: '问题如下',
      pending: true,
    })
    expect(parseChatOptions('问题如下\n【风格选')).toEqual({ rest: '问题如下', pending: true })
  })

  it('末条 Agent 消息的选项可点，点击代发编号', () => {
    const onSend = vi.fn()
    const { container } = renderComposer(
      [{ id: 'a1', role: 'agent', text: '请确认：\n【选项】\n1. 确认发布 v4\n2. 取消（流程终止）\n【/选项】' }],
      { onSend },
    )
    const opts = container.querySelectorAll('[data-chat-option]')
    expect(Array.from(opts).map(el => el.getAttribute('data-chat-option'))).toEqual(['1', '2'])
    fireEvent.click(opts[1])
    expect(onSend).toHaveBeenCalledWith('2')
  })

  it('紧随用户编号回复：对应选项 picked、全部禁用', () => {
    const onSend = vi.fn()
    const { container } = renderComposer(
      [
        { id: 'a1', role: 'agent', text: '请确认：\n【选项】\n1. 确认发布 v4\n2. 取消（流程终止）\n【/选项】' },
        { id: 'u1', role: 'user', text: '1' },
      ],
      { onSend },
    )
    const o1 = container.querySelector('[data-chat-option="1"]') as HTMLButtonElement
    const o2 = container.querySelector('[data-chat-option="2"]') as HTMLButtonElement
    expect(o1.getAttribute('data-picked')).toBe('true')
    expect(o1.disabled).toBe(true)
    expect(o2.getAttribute('data-picked')).toBeNull()
    expect(o2.disabled).toBe(true)
    fireEvent.click(o2)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('风格选项：谱系名称/版本/徽章渲染，未收录 ID 回退纯文本', () => {
    const { container } = renderComposer([
      { id: 'a1', role: 'agent', text: '选风格：\n【风格选项】\n1. A7\n2. E99\n【/风格选项】' },
    ])
    const rich = container.querySelector('[data-chat-option="1"]')
    expect(rich?.textContent).toContain('拟真人·仿真人动漫')
    expect(rich?.textContent).toContain(`A7 @ ${STYLE_CATALOG_VERSION}`)
    expect(rich?.textContent).toContain('主·已验证')
    const plain = container.querySelector('[data-chat-option="2"]')
    expect(plain?.textContent).toContain('E99')
    expect(plain?.textContent).not.toContain('已验证')
  })

  it('忙态（sending 中）选项禁用不代发', () => {
    const onSend = vi.fn()
    const { container } = renderComposer(
      [{ id: 'a1', role: 'agent', text: '请确认：\n【选项】\n1. 确认发布 v4\n2. 取消（流程终止）\n【/选项】' }],
      { onSend, sending: true },
    )
    const o1 = container.querySelector('[data-chat-option="1"]') as HTMLButtonElement
    expect(o1.disabled).toBe(true)
    fireEvent.click(o1)
    expect(onSend).not.toHaveBeenCalled()
  })
})
