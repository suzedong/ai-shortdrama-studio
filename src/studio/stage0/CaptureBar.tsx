// feature-005 · 「已捕获口径」常驻条（契约 §3.1 C1–C7）
// 挂点：StudioApp 右栏 aside 内、ChatComposer 上方（用户裁决③：对话区顶部常驻条）。
// 数据自拉 captureList + 订阅 onCaptureChanged 全量替换；面板直改系统直写（D-016），
// 与对话纠正通道同落 store 单点、同 capture:changed 广播（用户裁决②）。
import { useEffect, useState } from 'react'
import type { CapturedFact } from '../../../shared/types'

// C3 来源三色（复用 B-34 LabelTag 三色语义）
function sourceTag(f: CapturedFact): { text: string; cls: string } {
  if (f.source === 'user') return { text: '用户原话', cls: 'border-violet bg-white text-[#5A4BC4]' }
  return f.status === 'pending'
    ? { text: '推断 · 待确认', cls: 'border-[#F6E6C4] bg-[#FFF4DE] text-[#C0841D]' }
    : { text: '推断 · 已确认', cls: 'border-[#D9D3FB] bg-violet-soft text-[#5A4BC4]' }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export default function CaptureBar() {
  const [facts, setFacts] = useState<CapturedFact[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  // C4 行内编辑（单行互斥）
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTopic, setEditTopic] = useState('')
  const [editValue, setEditValue] = useState('')
  // C6 删除二次确认（单行互斥）
  const [removingId, setRemovingId] = useState<string | null>(null)
  // C7 操作失败行底错误条
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  useEffect(() => {
    let alive = true
    window.api.captureList()
      .then(f => { if (alive) { setFacts(f.facts); setLoadError(null) } })
      // C7：list 失败（含损坏）显错误态条，不自动重试刷屏
      .catch(e => { if (alive) setLoadError(errMsg(e)) })
    const off = window.api.onCaptureChanged(f => { setFacts(f.facts); setLoadError(null) })
    return () => { alive = false; off() }
  }, [])

  const startEdit = (f: CapturedFact): void => {
    setEditingId(f.id)
    setEditTopic(f.topic)
    setEditValue(f.value)
    setRemovingId(null)
    setRowError(null)
  }
  const cancelEdit = (): void => {
    setEditingId(null) // 取消零调用、还原只读
    setRowError(null)
  }
  const saveEdit = async (f: CapturedFact): Promise<void> => {
    const topic = editTopic.trim()
    const value = editValue.trim()
    if (!topic || !value) {
      setRowError({ id: f.id, message: 'topic 与 value 不能为空' })
      return
    }
    try {
      await window.api.captureUpsert({ id: f.id, topic, value }) // 系统直写（D-016）
      setEditingId(null)
      setRowError(null)
    } catch (e) {
      setRowError({ id: f.id, message: errMsg(e) })
    }
  }
  const confirmFact = async (f: CapturedFact): Promise<void> => {
    try {
      await window.api.captureUpsert({ id: f.id, status: 'confirmed' })
      setRowError(null)
    } catch (e) {
      setRowError({ id: f.id, message: errMsg(e) })
    }
  }
  const removeFact = async (f: CapturedFact): Promise<void> => {
    try {
      await window.api.captureRemove(f.id)
      setRemovingId(null)
      setRowError(null)
    } catch (e) {
      setRowError({ id: f.id, message: errMsg(e) })
    }
  }

  const list = facts ?? []
  const pendingCount = list.filter(f => f.status === 'pending').length

  return (
    <div data-testid="capture-bar" className="shrink-0 border-b border-line bg-[#FCFCFE]">
      {/* C1 头行（恒显）：标题 + 计数 + 待确认琥珀点 + 展开/收起钮 */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-[11px] font-extrabold tracking-[0.3px] text-[#1E2233]">已捕获口径</span>
        <span data-testid="capture-bar-count" className="text-[10.5px] text-muted">
          · {list.length} 条
        </span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 text-[10.5px] font-bold text-[#C0841D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E8A33D]" />
            · {pendingCount} 待确认
          </span>
        )}
        <button
          type="button"
          data-testid="capture-bar-toggle"
          className="ml-auto rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-[#5A4BC4] transition-colors hover:bg-violet-soft"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? '收起 ▴' : '展开 ▾'}
        </button>
      </div>

      {/* C7 list 失败错误态条（含文件损坏；不崩面板、不重试刷屏） */}
      {loadError && (
        <div className="mx-4 mb-2 rounded-md border border-[#F3D1D1] bg-[#FDF2F2] px-2 py-1.5 text-[10.5px] leading-relaxed text-bad">
          口径读取失败：{loadError}
        </div>
      )}

      {/* C1 空库引导（§2.6.1「从第一句话起持续累积」） */}
      {!loadError && list.length === 0 && (
        <div data-testid="capture-empty" className="px-4 pb-2.5 text-[10.5px] leading-relaxed text-muted">
          从第一句话起持续累积——对话中提取的题材、平台、集数等口径会实时列在这里，可随时直改。
        </div>
      )}

      {/* C2 展开态：逐条一行（topic 粗体 + value + 来源标签 + 操作钮） */}
      {expanded && list.length > 0 && (
        <ul className="max-h-[220px] overflow-y-auto px-2 pb-2">
          {list.map(f => {
            const tag = sourceTag(f)
            const editing = editingId === f.id
            return (
              <li
                key={f.id}
                data-testid="capture-item"
                data-fact-id={f.id}
                className="rounded-lg px-2 py-1.5 transition-colors hover:bg-white"
              >
                {editing ? (
                  /* C4 行内编辑三件套 */
                  <div className="flex flex-col gap-1">
                    <input
                      value={editTopic}
                      onChange={e => setEditTopic(e.target.value)}
                      placeholder="topic（如 genre / platforms / 人物关系）"
                      className="w-full rounded-md border border-line bg-white px-2 py-1 text-[11px] font-bold text-[#1E2233] outline-none focus:border-violet"
                    />
                    <input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      placeholder="value"
                      className="w-full rounded-md border border-line bg-white px-2 py-1 text-[11px] text-[#3A3F55] outline-none focus:border-violet"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        data-testid="capture-item-edit-save"
                        className="rounded-md bg-violet px-2 py-0.5 text-[10.5px] font-bold text-white transition-opacity hover:opacity-85"
                        onClick={() => void saveEdit(f)}
                      >
                        确认
                      </button>
                      <button
                        type="button"
                        data-testid="capture-item-edit-cancel"
                        className="rounded-md border border-line bg-white px-2 py-0.5 text-[10.5px] font-bold text-muted transition-colors hover:bg-[#F4F4FA]"
                        onClick={cancelEdit}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1 leading-snug">
                      <span className="text-[11px] font-bold text-[#1E2233]">{f.topic}</span>
                      <span className="mx-1 text-[10px] text-muted">·</span>
                      <span className="break-all text-[11px] text-[#3A3F55]">{f.value}</span>
                      <span
                        title={f.quote ? `原话：${f.quote}` : undefined}
                        className={`ml-1.5 inline-block whitespace-nowrap rounded-[5px] border px-1.5 py-px align-middle text-[8.5px] font-extrabold tracking-[0.3px] ${tag.cls}`}
                      >
                        {tag.text}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        data-testid="capture-item-edit"
                        className="rounded px-1 py-0.5 text-[10px] font-bold text-[#5A4BC4] transition-colors hover:bg-violet-soft"
                        onClick={() => startEdit(f)}
                      >
                        编辑
                      </button>
                      {/* C5 确认钮仅 pending 条 */}
                      {f.status === 'pending' && (
                        <button
                          type="button"
                          data-testid="capture-item-confirm"
                          className="rounded px-1 py-0.5 text-[10px] font-bold text-[#C0841D] transition-colors hover:bg-[#FFF4DE]"
                          onClick={() => void confirmFact(f)}
                        >
                          确认
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="capture-item-remove"
                        className="rounded px-1 py-0.5 text-[10px] font-bold text-bad transition-colors hover:bg-[#FDF2F2]"
                        onClick={() => { setRemovingId(f.id); setEditingId(null); setRowError(null) }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}

                {/* C6 删除行内二次确认条 */}
                {!editing && removingId === f.id && (
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-[#F3D1D1] bg-[#FDF2F2] px-2 py-1">
                    <span className="flex-1 text-[10.5px] text-bad">确认删除该条口径？删除后 id 不复用。</span>
                    <button
                      type="button"
                      data-testid="capture-item-remove-confirm"
                      className="rounded-md bg-bad px-2 py-0.5 text-[10px] font-bold text-white transition-opacity hover:opacity-85"
                      onClick={() => void removeFact(f)}
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-line bg-white px-2 py-0.5 text-[10px] font-bold text-muted transition-colors hover:bg-[#F4F4FA]"
                      onClick={() => setRemovingId(null)} // 取消零调用
                    >
                      取消
                    </button>
                  </div>
                )}

                {/* C7 操作失败行底错误条 */}
                {rowError && rowError.id === f.id && (
                  <div className="mt-1 rounded-md border border-[#F3D1D1] bg-[#FDF2F2] px-2 py-1 text-[10.5px] leading-relaxed text-bad">
                    {rowError.message}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
