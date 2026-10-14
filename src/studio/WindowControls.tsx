// feature-804 · Windows 窗口标题栏
// 自绘最小化 / 最大化(还原) / 关闭三按钮（契约 §6）。
// 平台门禁在 StudioApp：组件仅在非 darwin 时挂载，内部不判平台。
// 只 import react；图标全部内联 SVG；只经 window.api.window 触达主进程。
import { useEffect, useState } from 'react'

// 统一 10×10 视图盒，stroke 走 currentColor（hover 关闭钮变红底白图标）。
const ICON_PROPS = {
  width: 10,
  height: 10,
  viewBox: '0 0 10 10',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  'aria-hidden': true,
  focusable: false,
} as const

function MinimizeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="0.5" y1="5" x2="9.5" y2="5" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="0.8" y="0.8" width="8.4" height="8.4" />
    </svg>
  )
}

// 还原图标：两叠加方框，前框 8×8 白底遮挡后框压边，形成 Windows 还原双框（设计说明 §3）。
function RestoreIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden focusable={false}>
      <rect x="2.2" y="0.8" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="0.8" y="2.2" width="7" height="7" fill="#FFFFFF" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="0.8" y1="0.8" x2="9.2" y2="9.2" />
      <line x1="9.2" y1="0.8" x2="0.8" y2="9.2" />
    </svg>
  )
}

export default function WindowControls() {
  const win = window.api.window
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!win) return
    // 主进程为权威：初态取 is-maximized；失败静默按非最大化渲染。
    void win.isMaximized()
      .then(res => { if (res.ok) setMaximized(res.maximized) })
      .catch(() => undefined)
    const unsubscribe = win.onMaximizeChange(setMaximized)
    return unsubscribe
  }, [win])

  const handleMinimize = () => { void win?.minimize().catch(() => undefined) }
  const handleToggleMaximize = () => {
    void win?.toggleMaximize()
      .then(res => { if (res.ok) setMaximized(res.maximized) })
      .catch(() => undefined)
  }
  const handleClose = () => { void win?.close().catch(() => undefined) }

  const baseBtn =
    'grid h-8 w-[46px] place-items-center text-[#3A3D4A] transition-colors rounded-md'

  return (
    <div
      className="flex h-full items-stretch"
      style={{ WebkitAppRegion: 'no-drag' }}
      data-app-region="no-drag"
      aria-label="窗口控制"
      role="group"
    >
      <button
        type="button"
        className={`${baseBtn} hover:bg-[#E6E6E9]`}
        aria-label="最小化"
        title="最小化"
        data-win="minimize"
        onClick={handleMinimize}
      >
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className={`${baseBtn} hover:bg-[#E6E6E9]`}
        aria-label={maximized ? '还原' : '最大化'}
        title={maximized ? '还原' : '最大化'}
        data-win="maximize"
        data-maximized={maximized}
        onClick={handleToggleMaximize}
      >
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        className={`${baseBtn} hover:bg-[#C42B1C] hover:text-white`}
        aria-label="关闭"
        title="关闭"
        data-win="close"
        onClick={handleClose}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
