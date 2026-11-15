import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactElement } from 'react'
import type { StreamingTurn } from '../../lib/chat-runtime'
import ChatComposer, { parseChatOptions, type ChatItem } from './ChatComposer'

afterEach(cleanup)

function Harness({ onSend, onStop, ...props }: {
  items?: ChatItem[]
  stream?: StreamingTurn | null
  busy?: boolean
  onSend: (text: string) => void
  onStop?: () => void
}) {
  return (
    <ChatComposer
      items={props.items ?? []}
      stream={props.stream ?? null}
      pendingGate={null}
      deciding={false}
      sending={props.busy ?? false}
      error={null}
      modelOptions={[{ providerID: 'ark', modelID: 'test-model' }]}
      selectedModel={{ providerID: 'ark', modelID: 'test-model' }}
      onModelChange={vi.fn()}
      onSend={onSend}
      onDecide={vi.fn()}
      onStop={onStop ?? vi.fn()}
    />
  )
}

const ITEM: ChatItem & { text: string } = {
  id: 'a1', role: 'agent',
  text: '想以哪一种题材创作？\n【选项】\n步骤：1/3\n1. 都市逆袭【推荐】\n2. 都市甜宠\n3. 悬疑推理\n【/选项】',
}

function renderWith(ui: ReactElement) {
  return render(ui)
}

describe('feature-817 · MiniMax 选项协议', () => {
  it('步骤与推荐元数据只在纯文本选项块生效，并从正文剥离', () => {
    const parsed = parseChatOptions(ITEM.text)
    expect(parsed.step).toEqual({ current: 1, total: 3 })
    expect(parsed.options?.[0]).toEqual({ num: '1', text: '都市逆袭', recommended: true })
    expect(parsed.options?.[1]).toEqual({ num: '2', text: '都市甜宠' })
    expect(parsed.options?.some(o => o.text.includes('【推荐】'))).toBe(false)

    const noMeta = parseChatOptions('【AI反问】项目性质？\n【选项】\n1. 商业短剧\n2. 个人纪念\n【/选项】')
    expect(noMeta.step).toBeUndefined()
    expect(noMeta.options?.every(o => !o.recommended)).toBe(true)

    const style = parseChatOptions('【风格选项】\n1. A7【推荐】\n2. C1\n【/风格选项】')
    expect(style.step).toBeUndefined()
    expect(style.options?.[0].recommended).toBeUndefined()
  })

  it.each(['步骤：0/3', '步骤：4/3', '步骤：1/0', '步骤：a/3'])('非法步骤 %s 整块回退原文', step => {
    const text = `问题\n【选项】\n${step}\n1. 一\n2. 二\n【/选项】`
    const parsed = parseChatOptions(text)
    expect(parsed.options).toBeUndefined()
    expect(parsed.rest).toBe(text)
  })
})

describe('feature-817 · 分步选项卡', () => {
  it('显示真实步骤、推荐与等待回答；无元数据时不显示步骤', () => {
    const { container, rerender } = renderWith(<Harness items={[ITEM]} onSend={vi.fn()} />)
    expect(container.querySelector('[data-chat-option-step]')?.textContent).toContain('1/3')
    expect(container.querySelector('[data-chat-option-recommended]')?.textContent).toBe('推荐')
    expect(screen.getByText('等待回答')).toBeInTheDocument()

    rerender(<Harness items={[{ ...ITEM, text: '项目性质？\n【选项】\n1. 商业短剧\n2. 个人纪念\n【/选项】' }]} onSend={vi.fn()} />)
    expect(container.querySelector('[data-chat-option-step]')).toBeNull()
    expect(container.querySelector('[data-chat-option-recommended]')).toBeNull()
  })

  it('单击只暂存，下一步才发编号；双击只发送一次', () => {
    const onSend = vi.fn()
    const { container } = renderWith(<Harness items={[ITEM]} onSend={onSend} />)
    const first = container.querySelector('[data-chat-option="1"]') as HTMLButtonElement
    fireEvent.click(first)
    expect(first.getAttribute('aria-pressed')).toBe('true')
    expect(onSend).not.toHaveBeenCalled()

    const next = screen.getByRole('button', { name: /下一步/ })
    fireEvent.click(next)
    fireEvent.click(next)
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('1')
    expect(first.disabled).toBe(true)
  })

  it('自定义回答与选项互斥，下一步发送 trim 原文', () => {
    const onSend = vi.fn()
    const { container } = renderWith(<Harness items={[ITEM]} onSend={onSend} />)
    const input = screen.getByLabelText('自定义回答') as HTMLInputElement
    const first = container.querySelector('[data-chat-option="1"]') as HTMLButtonElement

    fireEvent.change(input, { target: { value: '  我自己的方向  ' } })
    fireEvent.click(first)
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { value: '  我自己的方向  ' } })
    expect(first.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('我自己的方向')
  })

  it('关闭可重新展开并保留暂存；无答案时下一步禁用', () => {
    const onSend = vi.fn()
    const { container } = renderWith(<Harness items={[ITEM]} onSend={onSend} />)
    expect((screen.getByRole('button', { name: /下一步/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(container.querySelector('[data-chat-option="2"]')!)
    fireEvent.click(screen.getByRole('button', { name: '关闭选项' }))
    expect(container.querySelector('[data-chat-option="2"]')).toBeNull()
    fireEvent.click(container.querySelector('[data-chat-options-reopen]')!)
    expect((container.querySelector('[data-chat-option="2"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    expect(onSend).toHaveBeenCalledWith('2')
  })

  it('busy 与历史回放禁用卡；编号恢复 picked，自定义答案不伪造 picked', () => {
    const { container, rerender } = renderWith(<Harness items={[ITEM]} busy onSend={vi.fn()} />)
    expect((container.querySelector('[data-chat-option="1"]') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByLabelText('自定义回答')).toBeNull()
    expect(screen.queryByText('等待回答')).toBeNull()

    rerender(<Harness items={[ITEM, { id: 'u1', role: 'user', text: '2' }]} onSend={vi.fn()} />)
    expect((container.querySelector('[data-chat-option="2"]') as HTMLElement).dataset.picked).toBe('true')
    expect((container.querySelector('[data-chat-option="1"]') as HTMLButtonElement).disabled).toBe(true)
    expect(container.querySelector('[data-chat-option-next]')).toBeNull()

    rerender(<Harness items={[ITEM, { id: 'u2', role: 'user', text: '我自己的方向' }]} onSend={vi.fn()} />)
    expect(container.querySelector('[data-picked]')).toBeNull()
    expect((container.querySelector('[data-chat-option="1"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('父级 busy 结束后仍活跃时释放本地提交锁，允许失败重试', () => {
    const onSend = vi.fn()
    const { rerender } = renderWith(<Harness items={[ITEM]} onSend={onSend} />)
    fireEvent.click(screen.getByRole('button', { name: /都市逆袭/ }))
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    expect(onSend).toHaveBeenCalledTimes(1)

    rerender(<Harness items={[ITEM]} busy onSend={onSend} />)
    rerender(<Harness items={[ITEM]} onSend={onSend} />)
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    expect(onSend).toHaveBeenCalledTimes(2)
  })
})

describe('feature-817 · 真实任务详情', () => {
  it('运行中单个工具也有任务详情与活跃指示，定稿后为已完成', () => {
    const turn: StreamingTurn = {
      messageId: 'm817',
      parts: {},
      deltaParts: {},
      deltaPreview: { text: '', reasoning: '' },
      tools: {
        c817: { callId: 'c817', tool: 'shortdrama_brief.list', status: 'running', args: {} },
      },
      timeline: [{ kind: 'tool', key: 'c817' }],
      status: 'running',
    }
    const { rerender } = renderWith(<Harness items={[]} stream={turn} onSend={vi.fn()} />)
    const trace = screen.getByTestId('chat-tool-trace')
    expect(trace.getAttribute('data-status')).toBe('running')
    expect(trace.textContent).toContain('任务详情 · 1 项')
    expect(trace.querySelector('[data-chat-task-spinner]')).not.toBeNull()

    rerender(
      <Harness
        items={[]}
        stream={{
          ...turn,
          status: 'done',
          tools: {
            c817: { ...turn.tools.c817, status: 'completed', startedAt: 1, endedAt: 2 },
          },
        }}
        onSend={vi.fn()}
      />,
    )
    expect(screen.getByTestId('chat-tool-trace').getAttribute('data-status')).toBe('completed')
    expect(screen.getByTestId('chat-tool-trace').querySelector('[data-chat-task-spinner]')).toBeNull()

    rerender(
      <Harness
        items={[]}
        stream={{
          ...turn,
          status: 'error',
          tools: {
            c817: { ...turn.tools.c817, status: 'error', errorText: '引擎不可用', startedAt: 1, endedAt: 2 },
          },
        }}
        onSend={vi.fn()}
      />,
    )
    expect(screen.getByTestId('chat-tool-trace').getAttribute('data-status')).toBe('error')
    expect(screen.getByTestId('chat-tool-trace').textContent).toContain('执行失败')
  })
})
