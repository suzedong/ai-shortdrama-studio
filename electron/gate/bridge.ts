// 裁决门桥（feature-015 非阻塞版）——把 MCP 工具调用与 Electron IPC 裁决连接起来
// 1) Agent 调 gate.request → upsertGate 落 pending → **立即返回**（契约 §1.2，不再等待用户）。
// 2) renderer 收到门推送后显示门卡片（用户可读）；
// 3) 用户点按钮 → IPC gate:decide → decide() 写门态 + 执行系统后置动作（execute.ts）。
// 4) 项目切换 / 关窗 → clearLive() 仅清内存索引，不触发任何门态变更或后置动作。
//
// 与旧版（feature-001~014）的根本区别：不再有「调用即等待」的 Promise，
// 因此 opencode 的 MCP 调用超时（180s）不再可能打到门上；也不存在重挂与 pending 泄漏。
import type { CanvasGate } from '../../shared/types.js'
import { canvasStore } from '../canvas/store.js'
import { applyGateDecision, type GateExecution } from './execute.js'

// shared/types.ts 只读：裁决元数据以运行时扩展字段随门落盘，不改共享类型。
type GateRecord = CanvasGate & {
  requestedAt?: string
  decidedAt?: string
  note?: string
}

export interface GateRequest {
  gateId: string
  title?: string
  question: string
  options: string[]
  /** 结构化负载（版本、diff、变更说明、0-final 草案等） */
  payload?: unknown
}

export interface GateDecision {
  decision: 'approved' | 'rejected'
  note?: string
}

/** 门推送事件：除门本体外，可携带系统后置动作结果（契约 §4.1） */
export interface GatePushEvent {
  gate: CanvasGate
  title?: string
  reopened?: boolean
  execution?: GateExecution
}

/** 发门返回值：立即返回的 pending 快照（契约 §1.2） */
export interface GateRequestResult {
  gateId: string
  status: 'pending'
  requestedAt: string
  payload?: unknown
}

export interface GateDecideResult {
  ok: true
  /** 门已裁决过或正在裁决，本次忽略（幂等，不重复执行后置动作） */
  ignored?: boolean
  execution?: GateExecution
}

class GateBridge {
  /** 仅作「本项目内已发门」的内存索引，供重启/切项目后的恢复判定；不持有任何等待 Promise */
  private live = new Map<string, GateRecord>()
  private listener: ((e: GatePushEvent) => void) | null = null
  /** 裁决串行化：同一门的连点/并发 decide 不得重复执行后置动作 */
  private deciding = new Set<string>()

  setGateListener(fn: ((e: GatePushEvent) => void) | null) {
    this.listener = fn
  }

  private emit(e: GatePushEvent) {
    this.listener?.(e)
  }

  /** MCP gate.request 入口：落 pending 后立即返回，不等待用户 */
  async request(req: GateRequest): Promise<GateRequestResult> {
    const canvas = await canvasStore.get()
    const now = new Date().toISOString()
    const existing = this.live.get(req.gateId)
      ?? [...canvas.gates].reverse().find(g => g.gateId === req.gateId)
    const gate: GateRecord = {
      gateId: req.gateId,
      status: 'pending',
      question: req.question,
      options: req.options,
      payload: req.payload,
      requestedAt: now,
    }
    // upsertGate 按 gateId 覆盖（含已 approved/rejected 的历史门 → 重开为 pending）
    await canvasStore.upsertGate(gate)
    this.live.set(req.gateId, gate)
    this.emit({ gate, title: req.title ?? canvas.title, ...(existing ? { reopened: true } : {}) })
    return { gateId: gate.gateId, status: 'pending', requestedAt: now, ...(req.payload !== undefined ? { payload: req.payload } : {}) }
  }

  /**
   * IPC gate:decide 入口：写门态 → 系统后置动作。
   * 幂等：门已裁决过或正在裁决直接 ignored，不重复发布 / 推进。
   */
  async decide(gateId: string, dec: GateDecision): Promise<GateDecideResult> {
    if (this.deciding.has(gateId)) return { ok: true, ignored: true }
    this.deciding.add(gateId)
    try {
      const canvas = await canvasStore.get()
      const gate = this.live.get(gateId) ?? [...canvas.gates].reverse().find(g => g.gateId === gateId)
      if (!gate) {
        const err = new Error(`裁决门不存在: ${gateId}`)
        err.name = 'INVALID_ARGUMENT'
        throw err
      }
      // 已裁决（approved/rejected）→ 忽略；只有 pending 可裁决
      if (gate.status !== 'pending') return { ok: true, ignored: true }

      const decided: GateRecord = {
        ...gate,
        status: dec.decision,
        ...(dec.note ? { note: dec.note } : {}),
        decidedAt: new Date().toISOString(),
      }
      await canvasStore.upsertGate(decided)
      this.live.set(gateId, decided)
      this.emit({ gate: decided, title: canvas.title })

      // rejected 无后置动作
      if (dec.decision === 'rejected') return { ok: true }

      const execution = await applyGateDecision(decided, dec.note)

      // 草案类失败：门回退 pending（授权内容不完整，让用户修正后重新发门）
      if (!execution.ok && execution.revertToPending) {
        const reverted: GateRecord = { ...decided, status: 'pending', decidedAt: undefined }
        await canvasStore.upsertGate(reverted)
        this.live.set(gateId, reverted)
        this.emit({ gate: reverted, title: canvas.title, execution })
        return { ok: true, execution }
      }

      this.emit({ gate: decided, title: canvas.title, execution })
      return { ok: true, execution }
    } finally {
      this.deciding.delete(gateId)
    }
  }

  /**
   * 项目切换 / 关窗：清内存索引。
   * 不结算任何 Promise（已不存在）、不改门态、不触发后置动作。
   */
  clearLive() {
    this.live.clear()
    this.deciding.clear()
  }

  /** 从磁盘恢复 pending 门到内存索引（重启 / 切项目后调用） */
  async recoverPending() {
    const canvas = await canvasStore.get()
    for (const g of canvas.gates) {
      if (g.status === 'pending') {
        this.live.set(g.gateId, g)
        this.emit({ gate: g, title: canvas.title })
      }
    }
  }
}

export const gateBridge = new GateBridge()
