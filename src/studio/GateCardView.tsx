// feature-019 · 门裁决卡（契约 §4-4）
// 标题 / 问题 / 选项 / 按钮全部渲染自 CanvasGate；renderer 不硬编码业务合格判定。
import { useState } from 'react'
import type { CanvasGate } from '@shared/types'

interface Props {
  gate: CanvasGate
  deciding: boolean
  onDecide: (decision: 'approved' | 'rejected', note?: string) => void
}

export default function GateCardView({ gate, deciding, onDecide }: Props) {
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')

  const submitReject = (): void => {
    onDecide('rejected', note.trim() ? note.trim() : undefined)
  }

  return (
    <div className="rounded-xl border border-violet/40 bg-violet-soft/50 p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-violet px-2 py-0.5 text-[11px] font-medium text-white">{gate.gateId}</span>
        <span className="text-xs text-muted">等待你裁决</span>
      </div>

      <div className="mt-2 text-sm font-medium leading-6 text-ink">{gate.question}</div>

      {gate.options.length > 0 && (
        <ul className="mt-2 space-y-1">
          {gate.options.map((opt, i) => (
            <li key={`${gate.gateId}-opt-${i}`} className="flex items-start gap-2 text-xs leading-5 text-muted">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet" />
              {opt}
            </li>
          ))}
        </ul>
      )}

      {!showReject ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={deciding}
            onClick={() => onDecide('approved')}
            className="rounded-lg bg-violet px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            确认放行
          </button>
          <button
            type="button"
            disabled={deciding}
            onClick={() => setShowReject(true)}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-50"
          >
            否决 / 重做
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="填写修改意见（将作为重做依据）"
            rows={2}
            className="w-full resize-none rounded-lg border border-line bg-white p-2 text-xs text-ink outline-none focus:border-violet"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={deciding}
              onClick={submitReject}
              className="rounded-lg bg-bad px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              提交否决
            </button>
            <button
              type="button"
              disabled={deciding}
              onClick={() => setShowReject(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
