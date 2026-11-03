// feature-813 · 工作目录面板（设计说明 §2/§3 冻结形态与文案）
// - 形态沿用 AiServicePanel：标题 + 错误条/成功条 + 主体 + 底部「关闭」；
// - pick 取消（dir=null）无动作；选目录后进入确认态（项目数 = listProjects().length，进入确认态时取一次）；
// - change 成功：成功条 + 当前根刷新 + 更换区复位；失败：message 原样上屏、面板保持打开、已选目标可重试。
import { useEffect, useState } from 'react'

/** Electron invoke 抛错会被包一层 'Error invoking remote method …'，剥壳取主进程原文 */
function ipcErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const m = /^Error invoking remote method '[^']+': Error: ([\s\S]*)$/.exec(msg)
  return m ? m[1] : msg
}

export interface WorkspacePanelProps {
  onClose: () => void
}

export default function WorkspacePanel({ onClose }: WorkspacePanelProps) {
  const [view, setView] = useState<WorkspaceSettingsView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ root: string; movedCount: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [projectCount, setProjectCount] = useState(0)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    window.api.settings.workspace.get()
      .then(v => {
        if (alive) setView(v)
      })
      .catch(e => {
        if (alive) setError(ipcErrorMessage(e))
      })
    return () => {
      alive = false
    }
  }, [])

  async function onPick() {
    if (picking || busy) return
    setPicking(true)
    setError(null)
    setSuccess(null)
    try {
      const [{ dir }, list] = await Promise.all([
        window.api.settings.workspace.pick(),
        window.api.listProjects(),
      ])
      if (dir !== null) {
        setSelected(dir)
        setProjectCount(list.length)
      }
    } catch (e) {
      setError(ipcErrorMessage(e))
    } finally {
      setPicking(false)
    }
  }

  async function onConfirm() {
    if (!selected || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await window.api.settings.workspace.change(selected)
      setSuccess({ root: res.root, movedCount: res.movedCount })
      setView(v => (v
        ? { ...v, root: res.root, source: 'store' as const, updatedAt: new Date().toISOString() }
        : v))
      setSelected(null)
    } catch (e) {
      setError(ipcErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/30 p-6">
      <div
        role="dialog"
        aria-label="工作目录"
        className="w-[520px] rounded-xl border border-line bg-white p-5 shadow-card"
      >
        <h3 className="text-[13px] font-extrabold text-ink">工作目录</h3>

        {error && (
          <div
            role="alert"
            data-workspace-error
            className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-[11.5px] leading-5 text-bad"
          >
            {error}
          </div>
        )}

        {success && (
          <div className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-[11.5px] leading-5">
            <p className="font-bold text-ok">已更换到 {success.root}（移动 {success.movedCount} 个项目）</p>
            <p className="mt-1 text-[#C0841D]">运行时已驻留时，需手动重连运行时后新根目录生效</p>
          </div>
        )}

        {!view ? (
          <p className="mt-4 text-[11.5px] text-muted">{error ? '设置读取失败，请关闭后重试。' : '读取中…'}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {/* 当前根目录 + 来源徽章（自定义 / 默认） */}
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-bold text-ink">当前根目录</span>
                <span className="text-[10.5px] text-muted">{view.source === 'store' ? '自定义' : '默认'}</span>
              </div>
              <p
                data-workspace-root
                className="mt-1 break-all rounded-md border border-line bg-canvas px-2.5 py-1.5 font-mono text-[11.5px] text-ink"
              >
                {view.root}
              </p>
            </div>

            {!selected ? (
              <button
                type="button"
                data-workspace-change
                onClick={() => { void onPick() }}
                disabled={picking || busy}
                className="rounded-lg bg-violet px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                {picking ? '选择中…' : '更换目录'}
              </button>
            ) : (
              <div className="rounded-lg border border-line bg-canvas px-3 py-2.5">
                <p className="text-[11px] text-muted">目标目录</p>
                <p className="mt-0.5 break-all font-mono text-[11.5px] text-ink">{selected}</p>
                <p className="mt-1.5 text-[11px] font-semibold text-[#C0841D]">
                  将整体移动 {projectCount} 个项目目录
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    data-workspace-confirm
                    onClick={() => { void onConfirm() }}
                    disabled={busy}
                    className="rounded-lg bg-violet px-3.5 py-1 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {busy ? '更换中…' : '确认更换'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    disabled={busy}
                    className="rounded-lg border border-line bg-white px-3.5 py-1 text-xs text-muted hover:text-ink disabled:opacity-40"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-white px-4 py-1.5 text-xs text-muted hover:text-ink"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
