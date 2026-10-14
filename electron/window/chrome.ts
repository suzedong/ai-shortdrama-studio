// feature-804 · Windows 窗口标题栏
// 窗口外壳选项的平台分支（纯函数，可单测；契约 §1.1）：
// - darwin：保留 macOS 现状 hiddenInset（原生红绿灯、内容延伸到标题栏）
// - win32/linux：frame:false 全自绘无边框，窗口控制按钮由 renderer 提供
// 显式不取 titleBarStyle:'hidden' + titleBarOverlay 混合方案（包内变更记录 D-002）。

/** 平台标识：沿用 Node process.platform 三取值 */
export type WindowPlatform = 'darwin' | 'win32' | 'linux'

/** BrowserWindow 构造参数中与外壳相关的子集（其余宽高/背景色/webPreferences 由 main.ts 持有） */
export type WindowChromeOptions =
  | { titleBarStyle: 'hiddenInset' }
  | { frame: false }

export function windowChromeOptions(platform: WindowPlatform): WindowChromeOptions {
  if (platform === 'darwin') return { titleBarStyle: 'hiddenInset' }
  return { frame: false }
}
