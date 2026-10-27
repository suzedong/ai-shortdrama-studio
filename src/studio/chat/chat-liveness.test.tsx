// feature-809 · 对话流式活跃指示（契约 §6 测试契约）
// 断言：纯函数 6 例（toolDurationLabel D1/D2/D3、showStreamCursor C1/C2×2）+ 组件 11 例（AC1–AC8 全覆盖，
// 其中 AC7 活跃不变式为 running 五状态参数化遍历；A4 条件含 X-001 修订：!text && running）。
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { StreamingTurn, ToolView } from '../../lib/chat-runtime'
import ChatComposer, { showStreamCursor, toolDurationLabel } from './ChatComposer'

function makeTurn(partial: Partial<StreamingTurn> = {}): StreamingTurn {
  return {
    messageId: 'm1',
    parts: {},
    deltaPreview: { text: '', reasoning: '' },
    tools: {},
    status: 'running',
    ...partial,
  }
}

function makeTool(partial: Partial<ToolView> = {}): ToolView {
  return { callId: 'c1', tool: 'file.write', status: 'running', args: {}, ...partial }
}

function renderWithStream(stream: StreamingTurn | null, props: { generating?: boolean } = {}) {
  return render(
    <ChatComposer
      items={[]}
      stream={stream}
      pendingGate={null}
      deciding={false}
      sending={false}
      generating={props.generating ?? false}
      error={null}
      onSend={vi.fn()}
      onDecide={vi.fn()}
    />,
  )
}

describe('纯函数（契约 §2）', () => {
  it('toolDurationLabel D1：起止齐备且非负 → (差/1000).toFixed(1)+s', () => {
    expect(toolDurationLabel(makeTool({ startedAt: 1000, endedAt: 2200 }))).toBe('1.2s')
    expect(toolDurationLabel(makeTool({ startedAt: 500, endedAt: 500 }))).toBe('0.0s')
  })

  it('toolDurationLabel D2：缺任一端 → null', () => {
    expect(toolDurationLabel(makeTool({ endedAt: 2200 }))).toBeNull()
    expect(toolDurationLabel(makeTool({ startedAt: 1000 }))).toBeNull()
    expect(toolDurationLabel(makeTool())).toBeNull()
  })

  it('toolDurationLabel D3：endedAt < startedAt（异常时钟）→ null', () => {
    expect(toolDurationLabel(makeTool({ startedAt: 2200, endedAt: 1000 }))).toBeNull()
  })

  it('showStreamCursor C1：running 且有正文 → true', () => {
    expect(showStreamCursor(makeTurn({ status: 'running' }), '已流出')).toBe(true)
  })

  it('showStreamCursor C2：running 但无正文 → false', () => {
    expect(showStreamCursor(makeTurn({ status: 'running' }), '')).toBe(false)
  })

  it('showStreamCursor C2：done 有正文 → false', () => {
    expect(showStreamCursor(makeTurn({ status: 'done' }), '定稿')).toBe(false)
    expect(showStreamCursor(makeTurn({ status: 'error' }), '定稿')).toBe(false)
  })
})

describe('占位气泡与空态联动（AC1 / 契约 §3.3 §3.4）', () => {
  it('AC1：generating=true 且 stream=null → 占位气泡（含 TypingDots），空态引导文案隐藏', () => {
    renderWithStream(null, { generating: true })
    const placeholder = screen.getByTestId('chat-turn-placeholder')
    expect(placeholder).toBeInTheDocument()
    expect(screen.getByTestId('chat-typing-dots')).toBeInTheDocument()
    expect(screen.queryByText(/输入一句灵感/)).toBeNull()
  })

  it('AC1 互斥：generating=false 且首访 → 无占位气泡，空态引导文案显示', () => {
    renderWithStream(null, { generating: false })
    expect(screen.queryByTestId('chat-turn-placeholder')).toBeNull()
    expect(screen.getByText(/输入一句灵感/)).toBeInTheDocument()
  })
})

describe('流式光标与空态三点（AC2 / AC3）', () => {
  it('AC2：running 且有正文 → 正文末尾尾随 animate-cursor-blink 光标', () => {
    renderWithStream(makeTurn({ status: 'running', deltaPreview: { text: '已流出一段', reasoning: '' } }))
    const cursor = screen.getByTestId('chat-stream-cursor')
    expect(cursor.className).toContain('animate-cursor-blink')
  })

  it('AC3：running 且无正文无推理 → TypingDots +「主控 Agent 正在思考…」', () => {
    renderWithStream(makeTurn({ status: 'running' }))
    expect(screen.getByTestId('chat-typing-dots')).toBeInTheDocument()
    expect(screen.getByText('主控 Agent 正在思考…')).toBeInTheDocument()
  })
})

describe('行内工具状态行（AC4 / AC5 / AC6 / 行序）', () => {
  it('AC4：running 工具 → spinner + 工具原名 + 执行中', () => {
    const { container } = renderWithStream(
      makeTurn({ tools: { c1: makeTool({ tool: 'file.write', status: 'running' }) } }),
    )
    const row = screen.getByTestId('chat-tool-row')
    expect(row.textContent).toContain('file.write')
    expect(row.textContent).toContain('执行中')
    expect(row.querySelector('.animate-spin')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="chat-tool-row"]')).toHaveLength(1)
  })

  it('AC5：completed 工具 → ✓ + 耗时；缺 endedAt 则不显示耗时', () => {
    renderWithStream(
      makeTurn({
        tools: {
          c1: makeTool({ callId: 'c1', tool: 'brief.publish', status: 'completed', startedAt: 1000, endedAt: 2200 }),
          c2: makeTool({ callId: 'c2', tool: 'file.read', status: 'completed', startedAt: 1000 }),
        },
      }),
    )
    const rows = screen.getAllByTestId('chat-tool-row')
    expect(rows[0].textContent).toContain('✓')
    expect(rows[0].textContent).toContain('brief.publish')
    expect(rows[0].textContent).toContain('1.2s')
    expect(rows[1].textContent).toContain('file.read')
    expect(rows[1].textContent).not.toContain('s')
  })

  it('AC6：error 工具 → ✗ + errorText 摘要（title 悬停全文）；无 errorText → 执行失败', () => {
    renderWithStream(
      makeTurn({
        tools: {
          c1: makeTool({ callId: 'c1', tool: 'canvas.update', status: 'error', errorText: '磁盘不可写' }),
          c2: makeTool({ callId: 'c2', tool: 'file.write', status: 'error' }),
        },
      }),
    )
    const rows = screen.getAllByTestId('chat-tool-row')
    expect(rows[0].textContent).toContain('✗')
    expect(rows[0].textContent).toContain('磁盘不可写')
    expect(rows[0].querySelector('[title="磁盘不可写"]')).not.toBeNull()
    expect(rows[1].textContent).toContain('执行失败')
  })

  it('行序（契约 §2.3 T1）：按 Object.values 首次出现序渲染，不另行排序', () => {
    renderWithStream(
      makeTurn({
        tools: {
          c2: makeTool({ callId: 'c2', tool: 'canvas.update', status: 'running' }),
          c1: makeTool({ callId: 'c1', tool: 'file.write', status: 'completed', startedAt: 0, endedAt: 500 }),
        },
      }),
    )
    const rows = screen.getAllByTestId('chat-tool-row')
    expect(rows[0].textContent).toContain('canvas.update')
    expect(rows[1].textContent).toContain('file.write')
  })
})

describe('活跃不变式（AC7，running 五状态参数化遍历）', () => {
  const runningStates: Array<[string, StreamingTurn]> = [
    ['空转（无正文无推理无工具）', makeTurn({ status: 'running' })],
    ['仅推理（X-001：reasoning 非空、无正文）', makeTurn({ status: 'running', deltaPreview: { text: '', reasoning: '思考中…' } })],
    ['仅正文', makeTurn({ status: 'running', deltaPreview: { text: '正文中', reasoning: '' } })],
    [
      '正文 + 工具 running',
      makeTurn({
        status: 'running',
        deltaPreview: { text: '正文中', reasoning: '' },
        tools: { c1: makeTool({ status: 'running' }) },
      }),
    ],
    [
      '工具全 completed 后的静默（无正文）',
      makeTurn({
        status: 'running',
        tools: { c1: makeTool({ status: 'completed', startedAt: 0, endedAt: 100 }) },
      }),
    ],
  ]

  it.each(runningStates)('%s → 气泡内 ≥1 个 animate-* 元素', (_name, turn) => {
    const { container } = renderWithStream(turn)
    expect(container.querySelector('[class*="animate-"]')).not.toBeNull()
  })

  it('X-001 显式断言：仅推理态 TypingDots 与推理折叠块共存', () => {
    renderWithStream(makeTurn({ status: 'running', deltaPreview: { text: '', reasoning: '思考中…' } }))
    expect(screen.getByText('推理过程')).toBeInTheDocument()
    expect(screen.getByTestId('chat-typing-dots')).toBeInTheDocument()
  })
})

describe('终态清除（AC8）', () => {
  it('done：无光标、无 TypingDots、无 spinner，工具行 ✓ 定格', () => {
    const { container } = renderWithStream(
      makeTurn({
        status: 'done',
        deltaPreview: { text: '定稿正文', reasoning: '' },
        tools: { c1: makeTool({ status: 'completed', startedAt: 0, endedAt: 1200 }) },
      }),
    )
    expect(screen.queryByTestId('chat-stream-cursor')).toBeNull()
    expect(screen.queryByTestId('chat-typing-dots')).toBeNull()
    expect(container.querySelector('.animate-spin')).toBeNull()
    const row = screen.getByTestId('chat-tool-row')
    expect(row.textContent).toContain('✓')
    expect(row.textContent).toContain('1.2s')
  })

  it('error：无光标、无 TypingDots、无任何 animate-* 元素，工具行 ✗ 定格', () => {
    const { container } = renderWithStream(
      makeTurn({
        status: 'error',
        tools: { c1: makeTool({ status: 'error', errorText: '超时' }) },
      }),
    )
    expect(screen.queryByTestId('chat-stream-cursor')).toBeNull()
    expect(screen.queryByTestId('chat-typing-dots')).toBeNull()
    expect(container.querySelector('[class*="animate-"]')).toBeNull()
    expect(screen.getByTestId('chat-tool-row').textContent).toContain('✗')
  })
})
