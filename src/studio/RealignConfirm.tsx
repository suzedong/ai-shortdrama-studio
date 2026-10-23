// feature-007 · 产物重开对齐二次确认（契约 §1.1/§3.1/§3.2）
// 画布节点带脏标记被点开时，StudioApp 单点拦截弹此三选一确认：
//   ① 按最新立项重新对齐 → 组装固定模板文案经 handleSend 既有链路送 Agent 重生成；
//   ② 保持现状查看 → 关闭确认、照常打开 StudioViewer（黄条仍在）；
//   ③ 取消 → 关闭确认、不开查看器。
// buildRealignPrompt 为纯函数零副作用；组件无 Esc / 背景点击关闭（防误触，契约 §3.2）。
import type { CanvasNode } from '@shared/types'

import { dirtyFieldLabel, kindLabel } from './CanvasBoard'

export interface RealignPromptInput {
  nodeId: string
  title: string
  sinceBriefVersion: number
  latestBriefVersion: number
  fields: string[]
}

/** 对齐委派固定模板（契约 §1.1，测试断言基准；fields 经 dirtyFieldLabel 中文化、顿号分隔、未收录回退原文） */
export function buildRealignPrompt(input: RealignPromptInput): string {
  const fields = input.fields.map(dirtyFieldLabel).join('、')
  return `【产物重新对齐】产物「${input.title}」（节点 ${input.nodeId}）当前基于立项 v${input.sinceBriefVersion}，与最新立项 v${input.latestBriefVersion} 不一致，命中字段：${fields}。请按最新立项单 v${input.latestBriefVersion} 重新生成该产物：按再版剧本第 6 步纪律串行委派专职 agent（交接物写明旧产物基于 v${input.sinceBriefVersion}、命中字段），重生成定稿后调 shortdrama_canvas.align({ nodeId: '${input.nodeId}' }) 清脏并推进血缘。`
}

export interface RealignConfirmProps {
  node: CanvasNode
  onRealign: () => void
  onKeepView: () => void
  onCancel: () => void
}

/** 三选一确认卡片：role="dialog" 居中卡片 + 遮罩（契约 §3.1 字段映射口径） */
export default function RealignConfirm({ node, onRealign, onKeepView, onCancel }: RealignConfirmProps) {
  const dirty = node.dirty
  if (!dirty) return null
  const fieldsText = dirty.fields.map(dirtyFieldLabel).join('、')
  const severityText =
    dirty.severity === 'high' ? '影响等级：高 · 建议重新生成' : '影响等级：中 · 可按需对齐'
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/30 p-6">
      <div
        role="dialog"
        aria-label="产物重新对齐"
        className="w-[440px] rounded-xl border border-line bg-white p-5 shadow-card"
      >
        <h3 className="text-[13px] font-extrabold text-ink">产物重新对齐</h3>
        <p className="mt-2.5 text-[11.5px] leading-[1.7] text-[#4A4F68]">
          {kindLabel(node.kind)} · {node.title}
        </p>
        <p className="mt-1 text-[11.5px] leading-[1.7] text-[#4A4F68]">
          当前基于立项 v{dirty.sinceBriefVersion} · 最新立项 v{dirty.latestBriefVersion}
        </p>
        <p className="mt-1 text-[11.5px] leading-[1.7] text-[#4A4F68]">命中字段：{fieldsText}</p>
        <p className="mt-2 text-[11.5px] font-bold leading-[1.7] text-[#C0841D]">{severityText}</p>
        {dirty.impactReport && (
          <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-[1.7] text-muted">
            影响清单：{dirty.impactReport}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onKeepView}
            className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
          >
            保持现状查看
          </button>
          <button
            type="button"
            onClick={onRealign}
            className="rounded-lg border border-violet bg-violet px-3 py-1 text-xs font-bold text-white hover:opacity-90"
          >
            按 v{dirty.latestBriefVersion} 重新对齐
          </button>
        </div>
      </div>
    </div>
  )
}
