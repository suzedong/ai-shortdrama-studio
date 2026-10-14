// feature-804 · WindowControls 组件测试（契约 §8.2）
// 三按钮渲染 / 初态 / 点击转发 / 推送跟随 / 卸载退订 / no-drag / 缺段防御。
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import WindowControls from './WindowControls'

function installWindowStub(opts: { initiallyMaximized?: boolean; toggleResult?: boolean } = {}) {
  const callbacks = new Set<(maximized: boolean) => void>()
  const minimize = vi.fn(async () => ({ ok: true as const }))
  const close = vi.fn(async () => ({ ok: true as const }))
  const isMaximized = vi.fn(async () => ({ ok: true as const, maximized: opts.initiallyMaximized ?? false }))
  const toggleMaximize = vi.fn(async () => ({
    ok: true as const,
    maximized: opts.toggleResult ?? !(opts.initiallyMaximized ?? false),
  }))
  const unsubscribe = vi.fn(() => callbacks.clear())
  const onMaximizeChange = vi.fn(cb => {
    callbacks.add(cb)
    return unsubscribe
  })
  window.api = {
    window: { platform: 'win32', minimize, toggleMaximize, isMaximized, close, onMaximizeChange },
  } as unknown as Window['api']
  return {
    minimize, close, isMaximized, toggleMaximize, onMaximizeChange, unsubscribe,
    emitMaximized: (m: boolean) => act(() => callbacks.forEach(cb => cb(m))),
  }
}

describe('feature-804 WindowControls（契约 §6）', () => {
  let previous: Window['api'] | undefined

  beforeEach(() => {
    previous = window.api
  })
  afterEach(() => {
    if (previous !== undefined) window.api = previous
    vi.restoreAllMocks()
  })

  it('渲染三按钮，aria/title/data-win 正确；未最大化时中间按钮为「最大化」', async () => {
    installWindowStub()
    render(<WindowControls />)

    expect(screen.getByRole('group', { name: '窗口控制' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最小化' })).toHaveAttribute('data-win', 'minimize')
    expect(screen.getByRole('button', { name: '关闭' })).toHaveAttribute('data-win', 'close')
    const toggle = await screen.findByRole('button', { name: '最大化' })
    expect(toggle).toHaveAttribute('data-win', 'maximize')
    expect(toggle).toHaveAttribute('data-maximized', 'false')
  })

  it('初态 isMaximized=true 时中间按钮为「还原」且 data-maximized="true"', async () => {
    installWindowStub({ initiallyMaximized: true })
    render(<WindowControls />)
    const toggle = await screen.findByRole('button', { name: '还原' })
    expect(toggle).toHaveAttribute('data-maximized', 'true')
  })

  it('点击最小化/关闭分别转发到 api.window', async () => {
    const stub = installWindowStub()
    const user = userEvent.setup()
    render(<WindowControls />)

    await user.click(screen.getByRole('button', { name: '最小化' }))
    await user.click(screen.getByRole('button', { name: '关闭' }))
    expect(stub.minimize).toHaveBeenCalledTimes(1)
    expect(stub.close).toHaveBeenCalledTimes(1)
  })

  it('点击最大化调 toggleMaximize，并按返回 maximized 切为「还原」图标态', async () => {
    const stub = installWindowStub({ initiallyMaximized: false, toggleResult: true })
    const user = userEvent.setup()
    render(<WindowControls />)

    await user.click(await screen.findByRole('button', { name: '最大化' }))
    expect(stub.toggleMaximize).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: '还原' })).toHaveAttribute('data-maximized', 'true')
  })

  it('收到 onMaximizeChange 推送后图标态跟随（双击标题栏路径），再推 false 切回', async () => {
    const stub = installWindowStub()
    render(<WindowControls />)
    await screen.findByRole('button', { name: '最大化' })

    stub.emitMaximized(true)
    expect(screen.getByRole('button', { name: '还原' })).toHaveAttribute('data-maximized', 'true')
    stub.emitMaximized(false)
    expect(screen.getByRole('button', { name: '最大化' })).toHaveAttribute('data-maximized', 'false')
  })

  it('卸载时调用退订函数', async () => {
    const stub = installWindowStub()
    const { unmount } = render(<WindowControls />)
    await screen.findByRole('button', { name: '最大化' })
    unmount()
    expect(stub.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('容器为 no-drag 区（整组不参与窗口拖拽；jsdom 丢弃未知 CSS，以 data-app-region 校验）', async () => {
    installWindowStub()
    render(<WindowControls />)
    const group = screen.getByRole('group', { name: '窗口控制' })
    expect(group).toHaveAttribute('data-app-region', 'no-drag')
  })

  it('防御：api.window 缺省时不崩溃，仍渲染三按钮（点击静默）', async () => {
    window.api = {} as unknown as Window['api']
    render(<WindowControls />)
    expect(screen.getByRole('button', { name: '最小化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最大化' })).toHaveAttribute('data-maximized', 'false')
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '关闭' }))
  })
})
