// feature-019 · 渲染期异常兜底（契约 §4-3）
// feature-022：去除 onBackLegacy（旧壳已下线），仅保留重试。
// 最小类组件：任何渲染期异常显示可展示文案，不整窗白屏；不暴露凭证 / 堆栈细节。
import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    // 仅本地诊断日志，不向用户展示堆栈 / 凭证。
    console.error('studio render error:', error)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false })
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-center shadow-card">
          <div className="text-base font-medium text-ink">工作台出现异常</div>
          <p className="mt-2 text-sm leading-6 text-muted">
            页面渲染被中断，你的项目数据未受影响。请点击重试。
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg bg-violet px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }
}

