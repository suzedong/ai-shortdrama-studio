// feature-011 · 影响评估面板单测（契约 §5 T-①~T-⑤ + 降级态）
// 纯函数层（归一 / 分组 / 默认勾选 / 计数 / 批量模板）+ 组件交互（三动作 / N=0 禁用）。
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { BriefChange } from '@shared/types'
import ImpactPanel from './ImpactPanel'
import {
  buildBatchRealignPrompt,
  defaultSelection,
  fromReportFile,
  fromUpdateResult,
  groupImpactItems,
  selectedNodeIds,
  type ImpactViewItem,
} from './impact-select'

/* ── 夹具 ── */

const CHANGES: BriefChange[] = [
  { field: 'premise.leads', from: '林夏与顾屿', to: '苏念与顾屿' },
  { field: 'fiveElements.episodeCount', from: '80 集', to: '60 集' },
  { field: 'diagnosisSummary', from: '旧摘要', to: '新摘要' },
]

const ITEMS: ImpactViewItem[] = [
  {
    nodeId: 'step-1-profiles', step: '1', title: '人物小传', severity: 'high',
    fields: ['premise.leads'], defaultAction: 'regenerate',
  },
  {
    nodeId: 'step-2-scenes', step: '2', title: '首集分场稿', severity: 'medium',
    fields: ['fiveElements.episodeCount'], defaultAction: 'mark',
  },
  {
    nodeId: 'step-2-dialogue', step: '2', title: '首集台词', severity: 'medium',
    fields: ['fiveElements.episodeCount'], defaultAction: 'mark',
  },
]

const view = fromUpdateResult({ version: 5, changes: CHANGES, items: ITEMS })

function renderPanel(over: Partial<ComponentProps<typeof ImpactPanel>> = {}) {
  const props = {
    data: view,
    onBatchRealign: vi.fn(),
    onMarkOnly: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  }
  render(<ImpactPanel {...props} />)
  return {
    batch: screen.getByRole('button', { name: /一键重生成选中/ }),
    mark: screen.getByRole('button', { name: '仅标记脏' }),
    cancel: screen.getByRole('button', { name: '取消' }),
    ...props,
  }
}

/* ── T-① 两入口归一 ── */

describe('feature-011 · T-① 两入口归一为同构视图模型', () => {
  it('updateBrief 返回值：版本对 = 新版本 - 1 → 新版本', () => {
    expect(view.fromVersion).toBe(4)
    expect(view.toVersion).toBe(5)
    expect(view.changes).toEqual(CHANGES)
    expect(view.items.map(i => i.nodeId)).toEqual([
      'step-1-profiles', 'step-2-scenes', 'step-2-dialogue',
    ])
  })

  it('影响清单文件：版本对与 decision 留痕原样带入，其余结构同构', () => {
    const report = fromReportFile({
      fromVersion: 4,
      toVersion: 5,
      changes: CHANGES,
      items: ITEMS.map(i => ({ ...i, decision: 'mark' as const })),
    })
    expect(report.fromVersion).toBe(4)
    expect(report.toVersion).toBe(5)
    expect(report.changes).toEqual(view.changes)
    expect(report.items).toEqual(view.items.map(i => ({ ...i, decision: 'mark' })))
  })
})

/* ── T-② 分组 ── */

describe('feature-011 · T-② 分组：high 在前 / 组内原序 / 无额外分组', () => {
  it('两组且顺序为 high → medium，组内保持原序', () => {
    const groups = groupImpactItems(ITEMS)
    expect(groups.map(g => g.severity)).toEqual(['high', 'medium'])
    expect(groups[0].items.map(i => i.nodeId)).toEqual(['step-1-profiles'])
    expect(groups[1].items.map(i => i.nodeId)).toEqual(['step-2-scenes', 'step-2-dialogue'])
  })

  it('空组不出现（仅 medium 时只有一组）', () => {
    const groups = groupImpactItems(ITEMS.filter(i => i.severity === 'medium'))
    expect(groups.map(g => g.severity)).toEqual(['medium'])
  })

  it('面板渲染：两个分组区块，锚点与条数对应', () => {
    renderPanel()
    expect(screen.getByText('高优先级 · 必重生成')).toBeInTheDocument()
    expect(screen.getByText('中优先级 · 可按需重生成')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-impact-panel-group="high"] [data-impact-panel-item]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-impact-panel-group="medium"] [data-impact-panel-item]')).toHaveLength(2)
  })
})

/* ── T-③ 默认勾选与计数 ── */

describe('feature-011 · T-③ 默认勾选 / 改勾计数 / N=0 禁用', () => {
  it('defaultAction=regenerate 预勾、mark 不勾', () => {
    const selection = defaultSelection(ITEMS)
    expect(selection).toEqual({
      'step-1-profiles': true,
      'step-2-scenes': false,
      'step-2-dialogue': false,
    })
    expect(selectedNodeIds(ITEMS, selection)).toEqual(['step-1-profiles'])
  })

  it('改勾后按钮计数同步', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(screen.getByRole('button', { name: '一键重生成选中 (1)' })).toBeInTheDocument()

    const scenes = document.querySelector('[data-node-id="step-2-scenes"] input') as HTMLInputElement
    await user.click(scenes)
    expect(screen.getByRole('button', { name: '一键重生成选中 (2)' })).toBeInTheDocument()

    const profiles = document.querySelector('[data-node-id="step-1-profiles"] input') as HTMLInputElement
    await user.click(profiles)
    expect(screen.getByRole('button', { name: '一键重生成选中 (1)' })).toBeInTheDocument()
  })

  it('全部不勾（N=0）→ 批量按钮禁用', () => {
    renderPanel({ data: { ...view, items: ITEMS.filter(i => i.defaultAction === 'mark') } })
    expect(screen.getByRole('button', { name: '一键重生成选中 (0)' })).toBeDisabled()
  })
})

/* ── T-④ 一键重生成选中 ── */

describe('feature-011 · T-④ 一键重生成选中：一次提交 + 消息内容', () => {
  it('默认勾选（1 项）点击 → 恰好一次回调，消息含前缀 / 版本对 / nodeId / title / 字段', async () => {
    const user = userEvent.setup()
    const { batch, onBatchRealign, onMarkOnly, onCancel } = renderPanel()
    await user.click(batch)

    expect(onBatchRealign).toHaveBeenCalledTimes(1)
    expect(onMarkOnly).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()

    const message = vi.mocked(onBatchRealign).mock.calls[0][0] as string
    expect(message).toContain('【产物重新对齐】')
    expect(message).toContain('v4')
    expect(message).toContain('v5')
    expect(message).toContain('step-1-profiles')
    expect(message).toContain('人物小传')
    expect(message).toContain('人物') // premise.leads → 人物（dirtyFieldLabel）
    // 未勾选产物不入消息
    expect(message).not.toContain('step-2-scenes')
    expect(message).not.toContain('step-2-dialogue')
  })

  it('勾选多项 → 消息逐项列出（顺序与 items 一致）', () => {
    const message = buildBatchRealignPrompt(view, ['step-1-profiles', 'step-2-dialogue'])
    expect(message.split('\n').filter(l => /^\d+\. /.test(l))).toHaveLength(2)
    expect(message).toContain('1. 产物「人物小传」')
    expect(message).toContain('2. 产物「首集台词」')
    expect(message).toContain('集数') // fiveElements.episodeCount
  })

  it('空选集 → 空串（按钮 N=0 已禁用，防御）', () => {
    expect(buildBatchRealignPrompt(view, [])).toBe('')
  })
})

/* ── T-⑤ 仅标记脏 / 取消 ── */

describe('feature-011 · T-⑤ 仅标记脏 / 取消：零批量回调 + 关闭回调', () => {
  it('仅标记脏 → onMarkOnly 一次，批量零调用', async () => {
    const user = userEvent.setup()
    const { mark, onBatchRealign, onMarkOnly } = renderPanel()
    await user.click(mark)
    expect(onMarkOnly).toHaveBeenCalledTimes(1)
    expect(onBatchRealign).not.toHaveBeenCalled()
  })

  it('取消 → onCancel 一次，批量零调用', async () => {
    const user = userEvent.setup()
    const { cancel, onBatchRealign, onCancel } = renderPanel()
    await user.click(cancel)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onBatchRealign).not.toHaveBeenCalled()
  })
})

/* ── 降级 / 空清单 ── */

describe('feature-011 · 降级态与空清单', () => {
  it('data=null + degrade → 面板内提示，无批量按钮', () => {
    render(
      <ImpactPanel
        data={null}
        degrade="影响清单读取失败（NOT_FOUND）"
        onBatchRealign={vi.fn()}
        onMarkOnly={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(document.querySelector('[data-impact-panel-degrade]')?.textContent).toContain('影响清单读取失败')
    expect(screen.queryByRole('button', { name: /一键重生成选中/ })).toBeNull()
  })

  it('items 为空 → 空清单提示，无分组区块，批量按钮 N=0 禁用', () => {
    renderPanel({ data: { ...view, items: [] } })
    expect(document.querySelector('[data-impact-panel-empty]')).not.toBeNull()
    expect(document.querySelector('[data-impact-panel-group]')).toBeNull()
    expect(screen.getByRole('button', { name: '一键重生成选中 (0)' })).toBeDisabled()
  })

  it('摘要区逐条渲染改动字段与旧值 → 新值', () => {
    renderPanel()
    const rows = document.querySelectorAll('[data-impact-panel-change]')
    expect(rows).toHaveLength(3)
    expect(rows[0].getAttribute('data-field')).toBe('premise.leads')
    expect(rows[0].getAttribute('data-level')).toBe('high')
    expect(rows[0].textContent).toContain('林夏与顾屿 → 苏念与顾屿')
    // 诊断摘要 = medium（与 impact.ts 分级表同源）
    expect(rows[2].getAttribute('data-level')).toBe('medium')
  })
})
