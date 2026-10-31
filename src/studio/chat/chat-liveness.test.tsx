// feature-809 · 对话流式活跃指示（契约 §6 测试契约）
// 断言：纯函数 6 例（toolDurationLabel D1/D2/D3、showStreamCursor C1/C2×2）+ 组件 11 例（AC1–AC8 全覆盖，
// 其中 AC7 活跃不变式为 running 五状态参数化遍历；A4 条件含 X-001 修订：!text && running）。
import { fireEvent, render, screen } from '@testing-library/react'
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

function renderWithStream(
  stream: StreamingTurn | null,
  props: { generating?: boolean; aiDown?: string | null; onAiRetry?: () => void } = {},
) {
  return render(
    <ChatComposer
      items={[]}
      stream={stream}
      pendingGate={null}
      deciding={false}
      sending={false}
      generating={props.generating ?? false}
      error={null}
      aiDown={props.aiDown ?? null}
      onAiRetry={props.onAiRetry}
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
    // D-011：显示中文动作短语，物理 ID 留在 title 供追溯
    expect(row.textContent).toContain('写入文件')
    expect(row).toHaveAttribute('title', 'file.write')
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
    expect(rows[0].textContent).toContain('发布立项单')
    expect(rows[0].textContent).toContain('1.2s')
    expect(rows[1].textContent).toContain('读取文件')
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
    expect(rows[0].textContent).toContain('更新画布')
    expect(rows[0].textContent).toContain('磁盘不可写')
    expect(rows[0].querySelector('[title="磁盘不可写"]')).not.toBeNull()
    expect(rows[1].textContent).toContain('执行失败')
  })

  it('D-012：流式从 args 现算白名单摘要；argsPreview（历史回放）优先于现算；无白名单不显示', () => {
    renderWithStream(
      makeTurn({
        tools: {
          c1: makeTool({ callId: 'c1', tool: 'shortdrama_file_write', status: 'running', args: { path: 'story/第1集.md', content: '正文' } }),
          c2: makeTool({ callId: 'c2', tool: 'shortdrama_capture_upsert', status: 'completed', startedAt: 0, endedAt: 100, args: { topic: '题材赛道', value: '都市逆袭' } }),
          c3: makeTool({ callId: 'c3', tool: 'shortdrama_file_write', status: 'completed', startedAt: 0, endedAt: 100, argsPreview: 'brief/立项单.v3.json', args: { path: '应被忽略.md' } }),
          c4: makeTool({ callId: 'c4', tool: 'shortdrama_canvas_get', status: 'completed', startedAt: 0, endedAt: 100, args: {} }),
        },
      }),
    )
    const rows = screen.getAllByTestId('chat-tool-row')
    expect(rows[0].textContent).toContain('· story/第1集.md')
    expect(rows[1].textContent).toContain('· 题材赛道')
    expect(rows[2].textContent).toContain('· brief/立项单.v3.json')
    expect(rows[2].textContent).not.toContain('应被忽略')
    expect(rows[3].textContent).not.toContain('·')
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
    expect(rows[0].textContent).toContain('更新画布')
    expect(rows[1].textContent).toContain('写入文件')
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

describe('D-013 · AI 服务不可用横幅与输入禁用', () => {
  it('aiDown 非空 → 常驻横幅（role=alert）+ 重新检测按钮；aiDown=null 不渲染', () => {
    const { unmount } = renderWithStream(null, { aiDown: 'AI 服务不可用：运行时未能启动', onAiRetry: vi.fn() })
    const banner = screen.getByTestId('chat-ai-down')
    expect(banner).toHaveAttribute('role', 'alert')
    expect(banner.textContent).toContain('AI 服务不可用：运行时未能启动')
    expect(screen.getByTestId('chat-ai-retry')).toBeInTheDocument()
    unmount()
    renderWithStream(null)
    expect(screen.queryByTestId('chat-ai-down')).toBeNull()
  })

  it('aiDown 时禁用输入框与发送钮，placeholder 切换为不可用提示', () => {
    renderWithStream(null, { aiDown: 'AI 服务调用失败：方舟余额不足' })
    const textarea = screen.getByPlaceholderText('AI 服务不可用，恢复后可继续对话')
    expect(textarea).toBeDisabled()
    expect(screen.getByTestId('chat-send')).toBeDisabled()
  })

  it('点击「重新检测」调用 onAiRetry；aiDown 时 submit 守卫拦截发送', () => {
    const onAiRetry = vi.fn()
    const onSend = vi.fn()
    const { container } = render(
      <ChatComposer
        items={[]}
        stream={null}
        pendingGate={null}
        deciding={false}
        sending={false}
        generating={false}
        error={null}
        aiDown="AI 服务不可用"
        onAiRetry={onAiRetry}
        onSend={onSend}
        onDecide={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('chat-ai-retry'))
    expect(onAiRetry).toHaveBeenCalledTimes(1)
    // 输入框禁用 → 无法输入；直接触发表单提交守卫也被拦截
    const textarea = container.querySelector('textarea')!
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
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
