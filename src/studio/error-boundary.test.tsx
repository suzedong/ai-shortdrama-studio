// feature-019 C7 · ErrorBoundary（契约 §4-1~4-3）
// feature-022：旧壳下线，onBackLegacy/RootSwitch 用例一并移除。
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ErrorBoundary from './ErrorBoundary'

function Boom(): JSX.Element {
  throw new Error('render boom')
}

describe('ErrorBoundary', () => {
  it('渲染期异常显示可展示文案而非白屏', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('工作台出现异常')).toBeInTheDocument()
    expect(screen.queryByText('render boom')).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it('重试按钮重置错误状态（子组件持续异常时仍兜底，不白屏）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    await userEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(screen.getByText('工作台出现异常')).toBeInTheDocument()
  })

  it('不再有返回旧版入口', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.queryByRole('button', { name: '返回旧版' })).not.toBeInTheDocument()
  })
})
