import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// RTL 在非 globals 显式引入的 vitest 下不自动卸载组件；统一 cleanup，
// 避免跨用例残留实例继续订阅 window.api 事件而互相干扰。
afterEach(() => {
  cleanup()
})

// electron 在 vitest 下导出的是可执行路径字符串，app 为 undefined；主进程模块
// （provider/manager 等）会读 app.isPackaged，统一 stub 为开发态。
vi.mock('electron', () => ({
  app: { isPackaged: false },
}))

// jsdom 未实现 scrollIntoView
Element.prototype.scrollIntoView = function scrollIntoView() {}

// jsdom 未实现 ResizeObserver
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
