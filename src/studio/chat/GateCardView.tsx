// feature-019 · 门裁决卡（契约 §4-4）
// 标题 / 校验行 / 按钮全部渲染自 CanvasGate；renderer 不硬编码业务合格判定。
// 结构化校验行走 gate.payload.checks（{label,result,level}），无则回退 gate.options。
import { useState } from 'react'
import type { CanvasGate } from '@shared/types'
import { dirtyFieldLabel } from '../stage0/select'

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

// feature-806 · 0-final 门 payload.harnessValidation 摘要上屏（契约 §2.3/D7；仅列 blocker，warning 不上屏）
const HARNESS_CATEGORY_LABELS: Record<HarnessFindingDto['category'], string> = {
  structure: '结构',
  content: '内容',
  spec: '规格',
  consistency: '一致性',
}

function harnessBlockersOf(gate: CanvasGate): HarnessFindingDto[] {
  const payload = gate.payload as { harnessValidation?: HarnessGateSummary } | undefined
  const findings = payload?.harnessValidation?.findings
  if (!Array.isArray(findings)) return []
  return findings.filter(f => f.severity === 'blocker')
}

// feature-012 · 再版门 payload.impactSummary 影响产物清单区（契约 §1.1/§3.1；首版无键整区不渲染）
const IMPACT_SEVERITY_LABELS: Record<'high' | 'medium', string> = {
  high: '高 · 必重生成',
  medium: '中 · 可按需重生成',
}

/** 安全解析：非法形状 / 空清单 → null（整区不渲染，零报错） */
function impactSummaryOf(gate: CanvasGate): ImpactSummaryDto | null {
  const payload = gate.payload as { impactSummary?: ImpactSummaryDto } | undefined
  const s = payload?.impactSummary
  if (!s || typeof s.assessedAt !== 'string') return null
  if (!s.counts || typeof s.counts.high !== 'number' || typeof s.counts.medium !== 'number') return null
  if (!Array.isArray(s.items) || s.items.length === 0) return null
  const valid = s.items.every(
    it =>
      it && typeof it.nodeId === 'string' && Array.isArray(it.fields) &&
      it.fields.every(f => typeof f === 'string') &&
      (it.severity === 'high' || it.severity === 'medium') &&
      (it.defaultAction === 'regenerate' || it.defaultAction === 'mark'),
  )
  return valid ? s : null
}

function ImpactSummaryBlock({ summary }: { summary: ImpactSummaryDto }) {
  return (
    <div
      data-gate-impact-summary
      className="mx-[11px] mb-[9px] overflow-hidden rounded-[7px] border border-[#DED9FB] bg-white"
    >
      <div className="flex items-center gap-1.5 border-b border-[#EFEBFD] bg-[#F7F6FF] px-[9px] py-1.5 text-[10px] font-extrabold text-[#5A4FD8]">
        影响产物清单 · {summary.items.length} 项
        <span className="ml-auto font-bold text-[#9A90E8]" data-gate-impact-counts>
          高 {summary.counts.high} · 中 {summary.counts.medium}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-[9px] py-1.5">
        {summary.items.map(item => (
          <div
            key={item.nodeId}
            data-gate-impact-item
            data-node-id={item.nodeId}
            data-severity={item.severity}
            data-default-action={item.defaultAction}
            className="rounded-[6px] border border-[#EFEBFD] bg-white px-2 py-1"
          >
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-ink">
              <span
                className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold ${
                  item.severity === 'high' ? 'bg-[#FBE9E6] text-bad' : 'bg-[#FBF3E2] text-[#B07E2A]'
                }`}
              >{IMPACT_SEVERITY_LABELS[item.severity]}</span>
              <span className="truncate">{item.nodeId}</span>
            </div>
            <div className="mt-0.5 text-[9.5px] text-muted">
              命中字段：{item.fields.map(dirtyFieldLabel).join('、')}
            </div>
          </div>
        ))}
      </div>
      <div className="px-[9px] pb-1.5 text-[9px] text-[#A6ABC0]" data-gate-impact-source>
        摘要快照 {summary.assessedAt} · 来源 brief.impact.assess（commit 时复算）
      </div>
    </div>
  )
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

  const impact = impactSummaryOf(gate)

  // 已放行：成功态（剪辑/下游 Agent 接管）；feature-806：门 payload 挂有 harness 拦截摘要时下方列出待修复 blocker
  if (gate.status === 'approved') {
    const blockers = harnessBlockersOf(gate)
    return (
      <>
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
        {impact && <ImpactSummaryBlock summary={impact} />}
        {blockers.length > 0 && (
          <div
            data-gate-harness-findings
            className="mt-2 overflow-hidden rounded-[11px] border-[1.5px] border-bad/50 bg-gradient-to-b from-[#FDF6F5] to-white"
          >
            <div className="border-b border-bad/20 px-[11px] py-[9px] text-[11.5px] font-extrabold text-bad">
              发布被基础校验拦截 · 待修复 {blockers.length} 项
            </div>
            <div className="flex flex-col gap-1.5 px-[11px] py-[9px]">
              {blockers.map((f, i) => (
                <div key={`${gate.gateId}-harness-${i}`} className="rounded-[7px] border border-bad/50 bg-white px-[9px] py-1.5">
                  <span className="mb-1 inline-block rounded bg-[#F7E8E4] px-1.5 py-0.5 text-[9px] font-bold text-bad">
                    {HARNESS_CATEGORY_LABELS[f.category] ?? f.category}
                  </span>
                  <div className="text-[10.5px] leading-4 text-ink">{f.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
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

      {impact && <ImpactSummaryBlock summary={impact} />}

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
