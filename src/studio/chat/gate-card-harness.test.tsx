// feature-806 · GateCardView 门卡 harness 拦截摘要上屏（契约 §2.3/D7）
// 三态：无摘要不渲染；blocker 上屏（中文分类标签 + message）、warning 不上屏；全 warning 不渲染。
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CanvasGate } from '@shared/types'
import GateCardView from './GateCardView'

function approvedGate(payload: unknown): CanvasGate {
  return {
    gateId: '0-final',
    status: 'approved',
    question: '是否定稿？',
    options: ['通过', '打回'],
    payload,
  }
}

const FINDING_BLOCKER_STRUCT = {
  gateId: '0-final',
  category: 'structure',
  checkId: 'STRUCT_REQUIRED_KEYS',
  severity: 'blocker',
  message: '缺少必填键 kind（项目性质），请补齐后重试',
}
const FINDING_BLOCKER_SPEC = {
  gateId: '0-final',
  category: 'spec',
  checkId: 'SPEC_FIELD_ENUM',
  severity: 'blocker',
  message: 'fiveElements.aspectRatio 取值「方形 1:1」越界，仅允许 竖屏 9:16 / 横屏 16:9（D-023）',
}
const FINDING_WARNING = {
  gateId: '0-final',
  category: 'spec',
  checkId: 'SPEC_STYLE_REF_UNKNOWN',
  severity: 'warning',
  message: '视觉风格谱系不可装载，本项降级为提醒',
}

const harnessBlock = (): HTMLElement | null =>
  document.querySelector('[data-gate-harness-findings]')

describe('feature-806 · GateCardView harness 拦截摘要（契约 §2.3）', () => {
  it('approved 门无摘要：成功卡照渲染、findings 块不渲染', () => {
    render(<GateCardView gate={approvedGate({ version: 1 })} deciding={false} onDecide={vi.fn()} />)
    expect(screen.getByText('已确认 · 下游 Agent 已接管')).toBeInTheDocument()
    expect(harnessBlock()).toBeNull()
  })

  it('摘要含 2 blocker + 1 warning：块在，中文分类标签与 blocker message 上屏，warning 不上屏', () => {
    const gate = approvedGate({
      version: 1,
      harnessValidation: {
        checkedAt: '2026-10-27T00:00:00.000Z',
        findings: [FINDING_BLOCKER_STRUCT, FINDING_BLOCKER_SPEC, FINDING_WARNING],
      },
    })
    render(<GateCardView gate={gate} deciding={false} onDecide={vi.fn()} />)

    const block = harnessBlock()
    expect(block).not.toBeNull()
    expect(within(block!).getByText(/发布被基础校验拦截 · 待修复 2 项/)).toBeInTheDocument()
    expect(within(block!).getByText('结构')).toBeInTheDocument()
    expect(within(block!).getByText('规格')).toBeInTheDocument()
    expect(within(block!).getByText(FINDING_BLOCKER_STRUCT.message)).toBeInTheDocument()
    expect(within(block!).getByText(FINDING_BLOCKER_SPEC.message)).toBeInTheDocument()
    expect(within(block!).queryByText(FINDING_WARNING.message)).not.toBeInTheDocument()
  })

  it('摘要全 warning：findings 块不渲染（仅 blocker 上屏）', () => {
    const gate = approvedGate({
      version: 1,
      harnessValidation: {
        checkedAt: '2026-10-27T00:00:00.000Z',
        findings: [FINDING_WARNING],
      },
    })
    render(<GateCardView gate={gate} deciding={false} onDecide={vi.fn()} />)
    expect(screen.getByText('已确认 · 下游 Agent 已接管')).toBeInTheDocument()
    expect(harnessBlock()).toBeNull()
  })
})
