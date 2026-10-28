// feature-012 · GateCardView 影响清单区（契约 §3.1 / §5.a）
// pending 与 approved 两态同布局渲染；有键渲染分级标签 / 命中字段 / 默认动作；
// 无键、非法形状、空清单均整区不渲染（首版零回归）；806 findings 区零行为变化。
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CanvasGate } from '@shared/types'
import GateCardView from './GateCardView'

const IMPACT = {
  assessedAt: '2026-10-28T09:00:00.000Z',
  counts: { high: 2, medium: 1 },
  items: [
    { nodeId: 'step-1-outline', fields: ['premise.seasonBoundary', 'fiveElements.episodeCount'], severity: 'high' as const, defaultAction: 'regenerate' as const },
    { nodeId: 'step-2-scenes', fields: ['fiveElements.episodeCount'], severity: 'high' as const, defaultAction: 'regenerate' as const },
    { nodeId: 'step-2-dialogue', fields: ['premise.leads'], severity: 'medium' as const, defaultAction: 'mark' as const },
  ],
}

const FINDING_BLOCKER = {
  gateId: '0-final',
  category: 'structure',
  checkId: 'STRUCT_REQUIRED_KEYS',
  severity: 'blocker',
  message: '缺少必填键 kind（项目性质），请补齐后重试',
}

function gate(status: CanvasGate['status'], payload?: unknown): CanvasGate {
  return { gateId: '0-final', status, question: '是否发布立项 v3？', options: ['发布', '再改改'], payload }
}

const impactBlock = (): HTMLElement | null => document.querySelector('[data-gate-impact-summary]')
const harnessBlock = (): HTMLElement | null => document.querySelector('[data-gate-harness-findings]')

describe('feature-012 · GateCardView 影响清单区（契约 §3.1）', () => {
  it('pending 门携 impactSummary：影响区上屏——标题/分级计数/逐项节点/命中字段中文/severity 标签/默认动作', () => {
    render(<GateCardView gate={gate('pending', { version: 3, changesFromPrevious: [], impactSummary: IMPACT })} deciding={false} onDecide={vi.fn()} />)

    const block = impactBlock()
    expect(block).not.toBeNull()
    expect(within(block!).getByText(/影响产物清单 · 3 项/)).toBeInTheDocument()
    expect(block!.querySelector('[data-gate-impact-counts]')?.textContent).toContain('高 2 · 中 1')

    const rows = block!.querySelectorAll('[data-gate-impact-item]')
    expect(rows).toHaveLength(3)
    expect(rows[0].getAttribute('data-node-id')).toBe('step-1-outline')
    expect(rows[0].getAttribute('data-severity')).toBe('high')
    expect(rows[0].getAttribute('data-default-action')).toBe('regenerate')
    expect(rows[0].textContent).toContain('高 · 必重生成')
    expect(rows[0].textContent).toContain('季边界、集数')
    expect(rows[2].getAttribute('data-default-action')).toBe('mark')
    expect(rows[2].textContent).toContain('中 · 可按需重生成')
    expect(rows[2].textContent).toContain('人物')
    expect(block!.querySelector('[data-gate-impact-source]')?.textContent).toContain('2026-10-28T09:00:00.000Z')
    // 改动区（门 question）与裁决按钮零回归
    expect(screen.getByText('是否发布立项 v3？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认放行' })).toBeInTheDocument()
  })

  it('pending 门无 impactSummary：整区不渲染，首版形态零变化', () => {
    render(<GateCardView gate={gate('pending', { version: 1, changesFromPrevious: [], pendingMarks: [] })} deciding={false} onDecide={vi.fn()} />)
    expect(impactBlock()).toBeNull()
    expect(screen.getByText('发布')).toBeInTheDocument()
  })

  it('非法形状（item 缺 severity/defaultAction）：整区不渲染、零报错', () => {
    const bad = {
      assessedAt: '2026-10-28T09:00:00.000Z',
      counts: { high: 1, medium: 0 },
      items: [{ nodeId: 'step-1-outline', fields: ['premise.leads'] }],
    }
    render(<GateCardView gate={gate('pending', { version: 3, impactSummary: bad })} deciding={false} onDecide={vi.fn()} />)
    expect(impactBlock()).toBeNull()
    expect(screen.getByText('是否发布立项 v3？')).toBeInTheDocument()
  })

  it('空清单（items: []）：整区不渲染', () => {
    render(<GateCardView gate={gate('pending', { version: 3, impactSummary: { assessedAt: 'x', counts: { high: 0, medium: 0 }, items: [] } })} deciding={false} onDecide={vi.fn()} />)
    expect(impactBlock()).toBeNull()
  })

  it('approved 门同携 impactSummary + harnessValidation：留存卡三区并存（成功卡 | 影响区 | findings 区）', () => {
    render(<GateCardView gate={gate('approved', {
      version: 3,
      impactSummary: IMPACT,
      harnessValidation: { checkedAt: '2026-10-28T09:00:00.000Z', findings: [FINDING_BLOCKER] },
    })} deciding={false} onDecide={vi.fn()} />)

    expect(screen.getByText('已确认 · 下游 Agent 已接管')).toBeInTheDocument()
    expect(impactBlock()).not.toBeNull()
    expect(harnessBlock()).not.toBeNull()
    expect(screen.getByText(FINDING_BLOCKER.message)).toBeInTheDocument()
  })

  it('approved 门仅 findings（806 既有形态）：findings 区零回归、影响区不渲染', () => {
    render(<GateCardView gate={gate('approved', {
      version: 3,
      harnessValidation: { checkedAt: '2026-10-28T09:00:00.000Z', findings: [FINDING_BLOCKER] },
    })} deciding={false} onDecide={vi.fn()} />)

    expect(harnessBlock()).not.toBeNull()
    expect(impactBlock()).toBeNull()
  })
})
