import { useEffect, useMemo, useState } from 'react'
import { replayMessages } from '../../lib/history-replay'

interface Props {
  dir: string
  onClose: () => void
  onNotice?: (message: string) => void
}

function formatTime(value: string): string {
  const time = Date.parse(value)
  return Number.isNaN(time) ? value : new Date(time).toLocaleString('zh-CN')
}

export default function ProjectDetailPanel({ dir, onClose, onNotice }: Props) {
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [snapshotIndex, setSnapshotIndex] = useState(0)

  useEffect(() => {
    let alive = true
    setDetail(null)
    setError(null)
    setNotice(null)
    setSnapshotIndex(0)
    window.api.projectDetail(dir)
      .then(value => { if (alive) setDetail(value) })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : '项目详情加载失败')
      })
    return () => { alive = false }
  }, [dir])

  const snapshot = detail?.snapshots[snapshotIndex] || null
  const messages = useMemo(() => replayMessages(snapshot?.messages || []), [snapshot])

  const reveal = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.projectReveal(dir)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Finder 定位失败')
    } finally {
      setBusy(false)
    }
  }

  const exportProject = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.projectExport(dir)
      if (!result.canceled) {
        const message = `已导出：${result.exportDir}`
        setNotice(message)
        onNotice?.(message)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/25 p-5" role="dialog" aria-modal="true" aria-label="项目详情">
      <button type="button" aria-label="关闭项目详情" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet">项目详情</p>
            <h2 className="mt-1 truncate text-lg font-extrabold text-ink">{detail?.title || '加载中…'}</h2>
            <p className="mt-1 break-all text-[10.5px] leading-4 text-muted">{dir}</p>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose} className="rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-canvas hover:text-ink">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p role="alert" className="mb-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</p>}
          {notice && <p role="status" className="mb-3 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-xs text-ok">{notice}</p>}
          {detail && (
            <>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-xl border border-line bg-canvas/60 p-4 text-xs">
                <div><dt className="text-muted">项目 ID</dt><dd className="mt-1 break-all font-medium text-ink">{detail.projectId}</dd></div>
                <div><dt className="text-muted">当前状态</dt><dd className="mt-1 font-medium text-ink">{detail.status}{detail.current ? ' · 编辑中' : ''}</dd></div>
                <div><dt className="text-muted">创建时间</dt><dd className="mt-1 text-ink">{formatTime(detail.createdAt)}</dd></div>
                <div><dt className="text-muted">最近打开</dt><dd className="mt-1 text-ink">{formatTime(detail.lastOpenedAt)}</dd></div>
                <div className="col-span-2"><dt className="text-muted">产物更新时间</dt><dd className="mt-1 text-ink">{formatTime(detail.updatedAt)}</dd></div>
              </dl>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-bold text-ink">正式会话快照</h3>
                  <span className="text-[10px] text-muted">{detail.snapshots.length} 份 · 只读</span>
                </div>
                {detail.snapshots.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-line px-4 py-5 text-center text-[11px] text-muted">没有导入或导出的会话快照。</p>
                ) : (
                  <div className="mt-2 overflow-hidden rounded-xl border border-line" data-session-snapshot="readonly">
                    {detail.snapshots.length > 1 && (
                      <div className="flex gap-1 overflow-x-auto border-b border-line bg-canvas/60 p-2">
                        {detail.snapshots.map((item, index) => (
                          <button
                            key={item.sourceSessionId}
                            type="button"
                            onClick={() => setSnapshotIndex(index)}
                            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] ${index === snapshotIndex ? 'bg-violet text-white' : 'text-muted hover:text-ink'}`}
                          >
                            快照 {index + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    {snapshot && (
                      <div className="border-b border-line px-3 py-2 text-[10px] leading-4 text-muted">
                        来源：{snapshot.sourceProjectId} / {snapshot.sourceSessionId}<br />导出：{formatTime(snapshot.exportedAt)}。在项目对话中续聊会新建本地会话并记录来源。
                      </div>
                    )}
                    <div className="max-h-[320px] space-y-3 overflow-y-auto bg-canvas/30 p-3">
                      {messages.length === 0 ? <p className="py-4 text-center text-[11px] text-muted">该快照没有可显示的消息。</p> : messages.map(message => (
                        <article key={message.id} className="rounded-xl border border-line bg-surface p-3">
                          <header className="mb-2 flex items-center justify-between gap-3 text-[10px] text-muted">
                            <span className={`font-bold ${message.role === 'user' ? 'text-violet' : 'text-ink'}`}>{message.role === 'user' ? '用户' : 'Agent'}</span>
                            <span className="truncate font-mono">{message.id}</span>
                          </header>
                          {message.role === 'user' ? (
                            <p className="whitespace-pre-wrap break-words text-[11.5px] leading-5 text-ink">{message.text}</p>
                          ) : (
                            <div className="space-y-2">
                              {(message.segments || []).map(segment => segment.kind === 'tool' ? (
                                <div key={segment.key} className="rounded-lg bg-canvas px-2.5 py-2 text-[10.5px] text-muted">
                                  <span className="font-mono text-ink">{segment.tool.tool}</span> · {segment.tool.status}
                                  {segment.tool.argsPreview && <p className="mt-1 break-all">{segment.tool.argsPreview}</p>}
                                  {segment.tool.errorText && <p className="mt-1 text-bad">{segment.tool.errorText}</p>}
                                </div>
                              ) : (
                                <p key={segment.key} className={`whitespace-pre-wrap break-words text-[11.5px] leading-5 ${segment.kind === 'reasoning' ? 'text-muted' : 'text-ink'}`}>
                                  {segment.text}
                                </p>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" disabled={busy || !detail} onClick={() => void reveal()} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50">在 Finder 中显示</button>
          <button type="button" disabled={busy || !detail} onClick={() => void exportProject()} className="rounded-lg bg-violet px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">{busy ? '处理中…' : '导出静态项目包'}</button>
        </footer>
      </section>
    </div>
  )
}
