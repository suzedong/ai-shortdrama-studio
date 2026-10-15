// feature-807 · 立项发布门态防护（纯函数，不碰文件系统 / electron 运行时）
// 依据：docs/features/feature-807-确认门口头拍板约束与门态防护/SDG-RE-契约.md §2
import type { CanvasGate } from '../../shared/types.js'

export type GateGuardCode =
  | 'BRIEF_GATE_PENDING'
  | 'BRIEF_GATE_REJECTED'
  | 'BRIEF_GATE_VERSION_MISMATCH'
  | 'BRIEF_GATE_APPROVED_USE_GATE'

export interface GateGuardViolation {
  code: GateGuardCode
  message: string
}

/** 立项唯一门 id（STAGE 0） */
export const BRIEF_FINAL_GATE_ID = '0-final'

/** 取当前生效的 0-final 门；无则 null。多条时取数组末位（存储为追加顺序，末位即最新） */
export function findBriefGate(gates: CanvasGate[]): CanvasGate | null {
  const matches = gates.filter(g => g.gateId === BRIEF_FINAL_GATE_ID)
  return matches.length === 0 ? null : matches[matches.length - 1]
}

/** 读门绑定版本；历史门无 payload.version 返回 null */
export function gateVersion(gate: CanvasGate): number | null {
  const v = (gate.payload as { version?: number } | undefined)?.version
  return typeof v === 'number' ? v : null
}

/**
 * 立项发布门态判定。
 * @returns null 表示放行；否则返回违例（工具层据此 fail，零写盘）
 */
export function assertBriefPublishable(
  gate: CanvasGate | null,
  approve: { by: 'gate' | 'verbal'; verbal?: { quote: string } },
  publishVersion: number,
): GateGuardViolation | null {
  if (!gate) return null

  const gv = gateVersion(gate)
  const versionLabel = gv === null ? '未绑定版本' : `v${gv}`

  // 门版本不可解析（历史门）：保守表，不做版本比对
  if (gv === null) {
    if (gate.status === 'pending') {
      return {
        code: 'BRIEF_GATE_PENDING',
        message: `定案门 0-final 仍在等待用户裁决（${versionLabel}）。禁止用口头拍板绕过：请用同一 gateId 重新调 gate.request 等待按钮结果；若工具调用超时，下回合 canvas_get 后重挂同一门。`,
      }
    }
    if (gate.status === 'rejected') {
      return {
        code: 'BRIEF_GATE_REJECTED',
        message: `定案门 0-final（${versionLabel}）已被用户打回。请按打回意见修改草案、重跑 brief.plan 后用同一 gateId 重发门，不得用旧口头语发布。`,
      }
    }
    // approved
    if (approve.by === 'verbal') {
      return {
        code: 'BRIEF_GATE_APPROVED_USE_GATE',
        message: `定案门 0-final（${versionLabel}）已 approved，请以 approve.by='gate' 发布（带门 note），不要对已批准的门再用 verbal 凭证。`,
      }
    }
    return null
  }

  // 门版本可解析
  // pending 门 + verbal：无论版本是否一致，一律按「绕过未决门」处理（契约真值表「任意版本」）
  if (gate.status === 'pending' && approve.by === 'verbal') {
    return {
      code: 'BRIEF_GATE_PENDING',
      message: `定案门 0-final 仍在等待用户裁决（v${gv}）。禁止用口头拍板绕过：请用同一 gateId 重新调 gate.request 等待按钮结果；若工具调用超时，下回合 canvas_get 后重挂同一门。`,
    }
  }

  if (gv !== publishVersion) {
    return {
      code: 'BRIEF_GATE_VERSION_MISMATCH',
      message: `存在绑定 v${gv} 的 0-final 门，与本次将发布的 v${publishVersion} 不一致；一张门只授权一版内容，请针对当前版本重新发门。`,
    }
  }

  // gv === publishVersion
  if (gate.status === 'pending') {
    return {
      code: 'BRIEF_GATE_PENDING',
      message: `定案门 0-final 仍在等待用户裁决（v${gv}）。禁止用口头拍板绕过：请用同一 gateId 重新调 gate.request 等待按钮结果；若工具调用超时，下回合 canvas_get 后重挂同一门。`,
    }
  }
  if (gate.status === 'rejected') {
    return {
      code: 'BRIEF_GATE_REJECTED',
      message: `定案门 0-final（v${gv}）已被用户打回。请按打回意见修改草案、重跑 brief.plan 后用同一 gateId 重发门，不得用旧口头语发布。`,
    }
  }
  // approved
  if (approve.by === 'verbal') {
    return {
      code: 'BRIEF_GATE_APPROVED_USE_GATE',
      message: `v${gv} 的 0-final 门已 approved，请以 approve.by='gate' 发布（带门 note），不要对已批准的门再用 verbal 凭证。`,
    }
  }
  return null
}
