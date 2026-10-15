// 对话气泡 Markdown 渲染（2026-10-15，K9 批准 react-markdown + remark-gfm，仅 Agent 侧）
// 断言：Agent 气泡渲染粗体/行内代码/GFM 列表/链接 target=_blank；用户气泡保持纯文本不解析。
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ChatComposer, { type ChatItem } from './ChatComposer'

function renderComposer(items: ChatItem[]) {
  return render(
    <ChatComposer
      items={items}
      stream={null}
      pendingGate={null}
      deciding={false}
      sending={false}
      error={null}
      onSend={vi.fn()}
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
