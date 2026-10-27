import React from 'react'
import ReactDOM from 'react-dom/client'
import ErrorBoundary from './studio/shell/ErrorBoundary'
import StudioApp from './studio/shell/StudioApp'
import { installDevMockApi } from './dev-mock-api'
import './index.css'

// 浏览器预览时 Electron preload 未注入 window.api，安装空态 mock 以便迭代 UI。
// 生产 Electron 环境下 preload 已存在，此调用为 no-op。
installDevMockApi()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StudioApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
