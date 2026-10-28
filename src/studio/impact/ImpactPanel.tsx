// feature-011 · 影响评估面板（契约 §3.2-§3.6；设计书 §2.6.7 L331-349 形态对齐）
// 非阻断弹层，与 RealignConfirm 同级挂 StudioApp；防误触关闭（仅按钮关闭，无 Esc / 背景点击）。
// 数据恒经 impact-select 归一为 ImpactView；勾选是即时决策不落盘（decision 不回写，D-017 维持）。
import { useState } from 'react'

import { dirtyFieldLabel } from '../canvas/CanvasBoard'
import {
  buildBatchRealignPrompt,
  changeLevel,
  defaultSelection,
  groupImpactItems,
  selectedNodeIds,
  type ChangeLevel,
  type ImpactSelection,
  type ImpactView,
  type ImpactViewItem,
} from './impact-select'

export interface ImpactPanelProps {
  /** 归一后的视图模型；null = 手动入口读取失败（配合 degrade 文案呈现降级态） */
  data: ImpactView | null
  /** 降级文案（读取失败 / JSON 损坏；有值时面板内提示，不阻断不崩溃） */
  degrade?: string
  /** 一键重生成选中：携带批量模板消息（含前缀与勾选产物清单） */
  onBatchRealign: (message: string) => void
  /** 仅标记脏：关闭面板，已落盘脏标记不变 */
  onMarkOnly: () => void
  /** 取消：与「仅标记脏」同效关闭（面板不撤销已落盘脏标记） */
  onCancel: () => void
}

const LEVEL_TEXT: Record<ChangeLevel, string> = {
  high: 'text-[#C0392B]',
  medium: 'text-[#C0841D]',
  neutral: 'text-muted',
}

const LEVEL_TAG: Record<ChangeLevel, string> = {
  high: '高',
  medium: '中',
  neutral: '—',
}

function ChangesSummary({ view }: { view: ImpactView }) {
  return (
    <section className="rounded-lg border border-line" data-impact-panel-changes>
      <div className="border-b border-line px-3 py-1.5 text-[10px] font-extrabold tracking-[0.3px] text-[#9AA0B5]">
        本次改动（{view.changes.length}）
      </div>
      <div className="max-h-[150px] overflow-auto px-3 py-1.5">
        {view.changes.map(c => {
          const level = changeLevel(c.field)
          return (
            <div key={c.field} className="flex items-baseline gap-2 py-0.5" data-impact-panel-change data-field={c.field} data-level={level}>
              <span className={`shrink-0 text-[10px] font-extrabold ${LEVEL_TEXT[level]}`}>{LEVEL_TAG[level]}</span>
              <span className="shrink-0 text-[10.5px] font-bold text-ink">{dirtyFieldLabel(c.field)}</span>
              <span className="shrink-0 font-mono text-[9.5px] text-[#A6ABC0]">{c.field}</span>
              <span className="min-w-0 break-words text-[10.5px] text-[#6A708A]" data-impact-panel-change-value>
                {c.from || '（空）'} → {c.to || '（空）'}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ItemRow({ item, fromVersion, toVersion, checked, onToggle }: {
  item: ImpactViewItem
  fromVersion: number
  toVersion: number
  checked: boolean
  onToggle: () => void
}) {
  const level: ChangeLevel = item.severity
  return (
    <label
      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-[#F7F8FC]"
      data-impact-panel-item
      data-node-id={item.nodeId}
      data-severity={item.severity}
    >
      <input
        type="checkbox"
        className="mt-[3px] accent-violet"
        checked={checked}
        onChange={onToggle}
        data-impact-panel-checkbox
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-[11.5px] font-bold text-ink">{item.title}</span>
          <span className="text-[10px] text-muted">第 {item.step} 步</span>
          <span className={`text-[10px] font-bold ${LEVEL_TEXT[level]}`}>{LEVEL_TAG[level]}</span>
          {item.decision && (
            <span className="rounded bg-[#F1F2F8] px-1.5 py-px text-[9.5px] text-[#7A8098]" data-impact-panel-decision>
              留痕：{item.decision === 'regenerate' ? '已重生成' : '仅标记脏'}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-[1.6] text-[#6A708A]">
          命中：{item.fields.map(dirtyFieldLabel).join('、')} · 基于 v{fromVersion} → 最新 v{toVersion}
        </span>
      </span>
    </label>
  )
}

export default function ImpactPanel({ data, degrade, onBatchRealign, onMarkOnly, onCancel }: ImpactPanelProps) {
  const [selection, setSelection] = useState<ImpactSelection>(() => defaultSelection(data?.items ?? []))

  if (!data) {
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/30 p-6">
        <div role="dialog" aria-label="影响评估" data-impact-panel className="w-[520px] rounded-xl border border-line bg-white p-5 shadow-card">
          <h3 className="text-[13px] font-extrabold text-ink">影响评估</h3>
          <p className="mt-2.5 text-[11.5px] leading-[1.7] text-[#4A4F68]" data-impact-panel-degrade>
            {degrade ?? '影响清单不可用，无法呈现本次改动的影响范围。'}
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
              data-impact-panel-cancel
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  const groups = groupImpactItems(data.items)
  const empty = data.items.length === 0
  const pickedIds = selectedNodeIds(data.items, selection)
  const count = pickedIds.length

  const toggle = (nodeId: string) => setSelection(s => ({ ...s, [nodeId]: !s[nodeId] }))

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/30 p-6">
      <div role="dialog" aria-label="影响评估" data-impact-panel className="w-[560px] rounded-xl border border-line bg-white p-5 shadow-card">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[13px] font-extrabold text-ink">影响评估</h3>
          <span className="text-[10.5px] text-muted" data-impact-panel-version>
            立项 v{data.fromVersion} → v{data.toVersion}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <ChangesSummary view={data} />

          {empty ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11px] leading-[1.7] text-muted" data-impact-panel-empty>
              本次改动没有仍在消费旧版立项的已定稿下游产物，无需重生成。
            </p>
          ) : (
            groups.map(group => (
              <section key={group.severity} className="rounded-lg border border-line" data-impact-panel-group={group.severity}>
                <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
                  <span className={`text-[10px] font-extrabold tracking-[0.3px] ${LEVEL_TEXT[group.severity]}`}>
                    {group.label}
                  </span>
                  <span className="text-[10px] text-muted">（{group.items.length}）</span>
                </div>
                <div className="flex flex-col px-1 py-1">
                  {group.items.map(item => (
                    <ItemRow
                      key={item.nodeId}
                      item={item}
                      fromVersion={data.fromVersion}
                      toVersion={data.toVersion}
                      checked={Boolean(selection[item.nodeId])}
                      onToggle={() => toggle(item.nodeId)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <p className="mt-3 text-[10px] leading-[1.6] text-[#A6ABC0]">
          「仅标记脏」与「取消」同效关闭：脏标记已在保存时落盘，不撤销；黄条与漂移提醒继续提示。
        </p>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
            data-impact-panel-cancel
          >
            取消
          </button>
          <button
            type="button"
            onClick={onMarkOnly}
            className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink"
            data-impact-panel-mark
          >
            仅标记脏
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              const message = buildBatchRealignPrompt(data, pickedIds)
              if (message) onBatchRealign(message)
            }}
            className="rounded-lg border border-violet bg-violet px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:border-line disabled:bg-[#E9EAF1] disabled:text-[#9AA0B5]"
            data-impact-panel-batch
          >
            一键重生成选中 ({count})
          </button>
        </div>
      </div>
    </div>
  )
}
