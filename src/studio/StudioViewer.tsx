// feature-022 · 只读产物查看器（契约 §3 / OD §4）
// 经 file:read 按 node.ref.path 读落盘产物：JSON 美化 / MD 纯文本等宽；无编辑、无保存。
import { useEffect, useState } from 'react'
import type { CanvasNode } from '@shared/types'

type State =
  | { phase: 'loading' }
  | { phase: 'ok'; content: string; format: 'json' | 'md' }
  | { phase: 'error'; message: string }

interface Props {
  node: CanvasNode
  kindLabel: string
  onClose: () => void
}

export default function StudioViewer({ node, kindLabel, onClose }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const refPath = node.ref?.path

  useEffect(() => {
    let alive = true
    if (!refPath) {
      setState({ phase: 'error', message: '该节点尚未落盘产物文件。' })
      return
    }
    setState({ phase: 'loading' })
    window.api.fileRead({ path: refPath })
      .then(res => {
        if (!alive) return
        if (!res.ok) {
          setState({ phase: 'error', message: res.error.message })
          return
        }
        let content = res.content
        if (res.format === 'json') {
          try {
            content = JSON.stringify(JSON.parse(res.content), null, 2)
          } catch {
            // 非合法 JSON 时按原文呈现
          }
        }
        setState({ phase: 'ok', content, format: res.format })
      })
      .catch(e => {
        if (alive) setState({ phase: 'error', message: e instanceof Error ? e.message : '读取失败' })
      })
    return () => { alive = false }
  }, [node.id, refPath])

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs font-medium text-violet">{kindLabel}</span>
          <span className="truncate text-sm font-medium text-ink">{node.title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
        >
          关闭
        </button>
      </div>
      {refPath && (
        <div className="flex items-center gap-2 border-b border-line px-5 py-2">
          <span className="truncate text-[11px] text-muted" title={refPath}>{refPath}</span>
          {state.phase === 'ok' && (
            <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[10px] uppercase text-muted">
              {state.format}
            </span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {state.phase === 'loading' && <p className="text-sm text-muted">读取中…</p>}
        {state.phase === 'error' && <p className="text-sm text-bad">{state.message}</p>}
        {state.phase === 'ok' && (
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-ink">
            {state.content}
          </pre>
        )}
      </div>
    </div>
  )
}
