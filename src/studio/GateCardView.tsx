// feature-019 · 门裁决卡（契约 §4-4）
// 标题 / 校验行 / 按钮全部渲染自 CanvasGate；renderer 不硬编码业务合格判定。
// 结构化校验行走 gate.payload.checks（{label,result,level}），无则回退 gate.options。
import { useState } from 'react'
import type { CanvasGate } from '@shared/types'

export interface GateCheck {
  label: string
  result: string
  level: 'pass' | 'warn'
}

interface Props {
  gate: CanvasGate
  deciding: boolean
  onDecide: (decision: 'approved' | 'rejected', note?: string) => void
}

function checksOf(gate: CanvasGate): GateCheck[] {
  const payload = gate.payload as { checks?: GateCheck[] } | undefined
  if (payload?.checks && payload.checks.length > 0) return payload.checks
  return gate.options.map(o => ({ label: o, result: '', level: 'pass' as const }))
}

function stageOf(gate: CanvasGate): string | null {
  const payload = gate.payload as { stage?: string } | undefined
  return payload?.stage ?? null
}

function PassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" className="h-2 w-2 text-white">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="h-2 w-2 text-white">
      <path d="M12 8v5M12 16.5v.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export default function GateCardView({ gate, deciding, onDecide }: Props) {
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')

  const submitReject = (): void => {
    onDecide('rejected', note.trim() ? note.trim() : undefined)
  }

  // 已放行：成功态（剪辑/下游 Agent 接管）
  if (gate.status === 'approved') {
    return (
      <div className="mt-2 overflow-hidden rounded-[11px] border-[1.5px] border-[#BFE6D2] bg-gradient-to-b from-[#F4FCF8] to-white">
        <div className="px-[11px] pb-3.5 pt-3.5 text-center">
          <div className="mx-auto mb-2 grid h-[38px] w-[38px] place-items-center rounded-full bg-ok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px] text-white">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div className="text-[12.5px] font-extrabold text-ink">已确认 · 下游 Agent 已接管</div>
          <div className="mt-[3px] text-[10px] text-muted">后续产物完成后通知你</div>
        </div>
      </div>
    )
  }

  const rejected = gate.status === 'rejected'
  const stage = stageOf(gate)

  return (
    <div
      className={`mt-2 overflow-hidden rounded-[11px] border-[1.5px] bg-gradient-to-b from-[#FBFAFF] to-white ${
        rejected ? 'border-bad/50' : 'border-[#D9D3FB]'
      }`}
    >
      <div className="flex items-center gap-[7px] border-b border-[#EFEBFD] px-[11px] py-[9px]">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-violet">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" className="h-[11px] w-[11px] text-white">
            <path d="m9 11 3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </span>
        <span className="text-[11.5px] font-extrabold text-ink">{gate.question}</span>
        {stage && <span className="ml-auto text-[9px] text-muted">{stage}</span>}
      </div>

      <div className="flex flex-col gap-1.5 px-[11px] py-[9px]">
        {checksOf(gate).map((c, i) => (
          <div key={`${gate.gateId}-check-${i}`} className="flex items-center gap-[7px] text-[10.5px]">
            <span
              className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full ${
                c.level === 'pass' ? 'bg-ok' : 'bg-[#E8A93C]'
              }`}
            >
              {c.level === 'pass' ? <PassIcon /> : <WarnIcon />}
            </span>
            <span className="font-semibold text-ink">{c.label}</span>
            {c.result && <span className="ml-auto text-[9.5px] text-muted">{c.result}</span>}
          </div>
        ))}
      </div>

      {rejected && (
        <div className="mx-[11px] mb-[9px] rounded-[7px] bg-[#F7F8FC] px-[9px] py-1.5 text-[9.5px] leading-4 text-bad">
          已否决 · 反馈已回流给对应 Agent，等待重做
        </div>
      )}

      {!rejected && (
        <>
          {showReject && (
            <div className="mx-[11px] mb-[9px] rounded-[7px] bg-[#F7F8FC] px-[9px] py-1.5 text-[9.5px] leading-4 text-muted">
              请描述：保留什么 · 修改什么 · 为什么 · 期望结果。反馈将回流给对应 Agent。
            </div>
          )}
          {!showReject ? (
            <div className="flex gap-[7px] px-[11px] pb-[11px]">
              <button
                type="button"
                disabled={deciding}
                onClick={() => setShowReject(true)}
                className="flex-1 rounded-lg bg-[#F1F2F8] py-2 text-[11px] font-bold text-[#6A708A] transition hover:bg-[#E6E8F2] disabled:opacity-50"
              >
                否决 / 重做
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => onDecide('approved')}
                className="flex-1 rounded-lg bg-violet py-2 text-[11px] font-bold text-white transition hover:bg-[#5B4BD6] disabled:opacity-50"
              >
                确认放行
              </button>
            </div>
          ) : (
            <div className="px-[11px] pb-[11px]">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="填写修改意见（将作为重做依据）"
                rows={2}
                className="w-full resize-none rounded-lg border border-line bg-white p-2 text-[11px] leading-4 text-ink outline-none focus:border-violet"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={deciding}
                  onClick={submitReject}
                  className="flex-1 rounded-lg bg-bad py-2 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  提交否决
                </button>
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => setShowReject(false)}
                  className="rounded-lg px-3 py-2 text-[11px] text-muted hover:text-ink"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
