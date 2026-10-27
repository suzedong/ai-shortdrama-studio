import { describe, expect, it } from 'vitest'
import type { CanvasGate } from '../../../shared/types'
import {
  assertBriefPublishable,
  findBriefGate,
  gateVersion,
} from '../../../electron/gate/guard'

function gate(
  status: CanvasGate['status'],
  version?: number,
  gateId = '0-final',
): CanvasGate {
  return {
    gateId,
    status,
    question: '是否定稿？',
    options: ['通过', '打回'],
    payload: version === undefined ? undefined : { version },
  }
}

const verbal = { by: 'verbal' as const, verbal: { quote: '行，定稿' } }
const byGate = { by: 'gate' as const }

describe('feature-807 gate guard · findBriefGate', () => {
  it('空数组返回 null', () => {
    expect(findBriefGate([])).toBeNull()
  })

  it('只有非 0-final 门时返回 null', () => {
    expect(findBriefGate([gate('pending', 1, 'other-gate')])).toBeNull()
  })

  it('单条 0-final 直接返回', () => {
    const g = gate('pending', 1)
    expect(findBriefGate([g])).toBe(g)
  })

  it('多条 0-final 时取数组末位（最新），忽略其他 gateId', () => {
    const older = gate('rejected', 1)
    const other = gate('approved', 9, 'other-gate')
    const latest = gate('pending', 2)
    expect(findBriefGate([older, other, latest])).toBe(latest)
  })
})

describe('feature-807 gate guard · gateVersion', () => {
  it('读 payload.version', () => {
    expect(gateVersion(gate('pending', 3))).toBe(3)
  })

  it('无 payload 或无 version 返回 null（历史门）', () => {
    expect(gateVersion(gate('pending'))).toBeNull()
    expect(gateVersion({ ...gate('pending'), payload: {} })).toBeNull()
  })
})

describe('feature-807 gate guard · 可解析版本真值表（pv=1）', () => {
  const pv = 1

  it('无门 × verbal：放行', () => {
    expect(assertBriefPublishable(null, verbal, pv)).toBeNull()
  })

  it('无门 × gate：放行', () => {
    expect(assertBriefPublishable(null, byGate, pv)).toBeNull()
  })

  it('pending × verbal × 同版本：BRIEF_GATE_PENDING', () => {
    expect(assertBriefPublishable(gate('pending', 1), verbal, pv)?.code).toBe(
      'BRIEF_GATE_PENDING',
    )
  })

  it('pending × verbal × 异版本：仍报 PENDING（verbal 绕过优先）', () => {
    expect(assertBriefPublishable(gate('pending', 2), verbal, pv)?.code).toBe(
      'BRIEF_GATE_PENDING',
    )
  })

  it('pending × gate × 同版本：PENDING', () => {
    expect(assertBriefPublishable(gate('pending', 1), byGate, pv)?.code).toBe(
      'BRIEF_GATE_PENDING',
    )
  })

  it('pending × gate × 异版本：VERSION_MISMATCH（版本优先）', () => {
    expect(assertBriefPublishable(gate('pending', 2), byGate, pv)?.code).toBe(
      'BRIEF_GATE_VERSION_MISMATCH',
    )
  })

  it('rejected × 同版本 × gate/verbal：REJECTED', () => {
    expect(assertBriefPublishable(gate('rejected', 1), byGate, pv)?.code).toBe(
      'BRIEF_GATE_REJECTED',
    )
    expect(assertBriefPublishable(gate('rejected', 1), verbal, pv)?.code).toBe(
      'BRIEF_GATE_REJECTED',
    )
  })

  it('rejected × 异版本 × gate/verbal：VERSION_MISMATCH', () => {
    expect(assertBriefPublishable(gate('rejected', 2), byGate, pv)?.code).toBe(
      'BRIEF_GATE_VERSION_MISMATCH',
    )
    expect(assertBriefPublishable(gate('rejected', 2), verbal, pv)?.code).toBe(
      'BRIEF_GATE_VERSION_MISMATCH',
    )
  })

  it('approved × 同版本 × gate：放行', () => {
    expect(assertBriefPublishable(gate('approved', 1), byGate, pv)).toBeNull()
  })

  it('approved × 同版本 × verbal：APPROVED_USE_GATE', () => {
    expect(
      assertBriefPublishable(gate('approved', 1), verbal, pv)?.code,
    ).toBe('BRIEF_GATE_APPROVED_USE_GATE')
  })

  it('approved × 异版本 × gate/verbal：VERSION_MISMATCH', () => {
    expect(
      assertBriefPublishable(gate('approved', 2), byGate, pv)?.code,
    ).toBe('BRIEF_GATE_VERSION_MISMATCH')
    expect(
      assertBriefPublishable(gate('approved', 2), verbal, pv)?.code,
    ).toBe('BRIEF_GATE_VERSION_MISMATCH')
  })
})

describe('feature-807 gate guard · 历史门保守表（gv=null）', () => {
  it('pending × gate/verbal：PENDING', () => {
    expect(assertBriefPublishable(gate('pending'), byGate, 1)?.code).toBe(
      'BRIEF_GATE_PENDING',
    )
    expect(assertBriefPublishable(gate('pending'), verbal, 1)?.code).toBe(
      'BRIEF_GATE_PENDING',
    )
  })

  it('rejected × gate/verbal：REJECTED', () => {
    expect(assertBriefPublishable(gate('rejected'), byGate, 1)?.code).toBe(
      'BRIEF_GATE_REJECTED',
    )
    expect(assertBriefPublishable(gate('rejected'), verbal, 1)?.code).toBe(
      'BRIEF_GATE_REJECTED',
    )
  })

  it('approved × gate：放行（不锁死存量续跑）', () => {
    expect(assertBriefPublishable(gate('approved'), byGate, 1)).toBeNull()
  })

  it('approved × verbal：APPROVED_USE_GATE', () => {
    expect(assertBriefPublishable(gate('approved'), verbal, 1)?.code).toBe(
      'BRIEF_GATE_APPROVED_USE_GATE',
    )
  })
})

describe('feature-807 gate guard · message 版本插值', () => {
  it('VERSION_MISMATCH 文案含门版本与将发布版本', () => {
    const v = assertBriefPublishable(gate('approved', 1), byGate, 2)
    expect(v?.message).toContain('v1')
    expect(v?.message).toContain('v2')
  })

  it('历史门文案标注未绑定版本', () => {
    const v = assertBriefPublishable(gate('pending'), verbal, 1)
    expect(v?.message).toContain('未绑定版本')
  })
})
