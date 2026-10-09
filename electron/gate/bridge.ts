// feature-018 · GateBridge：pending 门注册表（单次阻塞 + 跨重启重挂恢复）
import type { CanvasGate } from '../../shared/types.js'
import { canvasStore } from '../canvas/store.js'

export interface GateDecision {
  decision: 'approved' | 'rejected'
  note?: string
}

interface PendingEntry {
  promise: Promise<GateDecision>
  resolve: (d: GateDecision) => void
  reject: (e: Error) => void
  title?: string
}

function error(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

export class GateBridge {
  private pending = new Map<string, PendingEntry>()
  private onGate: ((e: { gate: CanvasGate; title?: string }) => void) | null = null

  /** main 注册：把门事件转发给已订阅窗口 */
  setGateListener(fn: (e: { gate: CanvasGate; title?: string }) => void): void {
    this.onGate = fn
  }

  /**
   * 请求门并等待裁决（feature-018 契约 §5.1；rejected 重开按 feature-019 契约 §2.4 修订）：
   * - 已有 live entry → 幂等返回同一 Promise；
   * - canvas 中无此门 → 新建 pending 门落盘、广播；
   * - canvas 中为 pending 但无 live entry（重启恢复）→ 重挂等待，不重复建门；
   * - canvas 中为 rejected 且无 live entry → 以同一 gateId 重开（状态回退 pending、
   *   用本次请求内容覆盖），不新增门编号；
   * - canvas 中为 approved → INVALID_ARGUMENT（approved 为终态，禁止重开）。
   */
  request(input: {
    gateId: string
    title?: string
    question: string
    options: string[]
    payload?: unknown
  }): Promise<GateDecision> {
    const live = this.pending.get(input.gateId)
    if (live) return live.promise
    // 先 arm：无 live entry 时也返回 entry.promise 本身，保证重复请求同一性
    const entry = this.arm(input.gateId, input.title)
    void this.initializeEntry(entry, input)
    return entry.promise
  }

  /** 无 live entry 时的异步初始化：按 canvas 状态新建或重挂（feature-018 契约 §5.1） */
  private async initializeEntry(
    entry: PendingEntry,
    input: {
      gateId: string
      title?: string
      question: string
      options: string[]
      payload?: unknown
    },
  ): Promise<void> {
    try {
      const canvas = await canvasStore.get()
      const found = canvas.gates.find(g => g.gateId === input.gateId)
      if (found && found.status === 'approved') {
        throw error('INVALID_ARGUMENT', `门 ${input.gateId} 已 approved，不可重开`)
      }

      let gate: CanvasGate
      if (!found) {
        gate = {
          gateId: input.gateId,
          status: 'pending',
          question: input.question,
          options: input.options,
          payload: input.payload,
        }
        await canvasStore.upsertGate(gate)
      } else if (found.status === 'rejected') {
        // feature-019 §2.4：rejected 后以同一 gateId 重开（重做产物后再次请裁决），
        // 不新增门编号；用本次请求内容覆盖旧问题。
        gate = {
          gateId: input.gateId,
          status: 'pending',
          question: input.question,
          options: input.options,
          payload: input.payload,
        }
        await canvasStore.upsertGate(gate)
      } else {
        // pending 恢复路径：沿用 canvas 上的既有门内容，不重写
        gate = found
      }

      this.onGate?.({ gate, title: input.title })
    } catch (e) {
      this.pending.delete(input.gateId)
      entry.reject(e as Error)
    }
  }

  /** 门裁决：更新门状态 → canvas:changed；resolve 等待中的 request */
  decide(gateId: string, decision: GateDecision): void {
    const entry = this.pending.get(gateId)
    if (!entry) throw error('INVALID_ARGUMENT', `没有等待裁决的门 ${gateId}`)
    void (async () => {
      const canvas = await canvasStore.get()
      const found = canvas.gates.find(g => g.gateId === gateId)
      if (!found || found.status !== 'pending') {
        throw error('INVALID_ARGUMENT', `门 ${gateId} 状态不可裁决`)
      }
      found.status = decision.decision
      await canvasStore.upsertGate(found)
      this.pending.delete(gateId)
      entry.resolve({ decision: decision.decision, note: decision.note })
    })().catch(e => {
      this.pending.delete(gateId)
      entry.reject(e as Error)
    })
  }

  /**
   * 跨重启恢复（feature-018 契约 §5.1-2）：
   * canvas 中每个无 live entry 的 pending 门重新挂起并通知，不重复建门。
   */
  async recoverPending(): Promise<void> {
    const canvas = await canvasStore.get()
    for (const gate of canvas.gates) {
      if (gate.status !== 'pending') continue
      if (this.pending.has(gate.gateId)) continue
      const entry = this.arm(gate.gateId)
      this.onGate?.({ gate, title: entry.title })
    }
  }

  /** 清算：所有 pending 门 reject 为 GATE_TIMEOUT（项目切换 / 应用关闭时） */
  settleAll(): void {
    for (const [gateId, entry] of this.pending) {
      entry.reject(error('GATE_TIMEOUT', `门 ${gateId} 因运行结束未获裁决`))
    }
    this.pending.clear()
  }

  /** 创建挂起 entry（不触碰 canvas） */
  private arm(gateId: string, title?: string): PendingEntry {
    const partial: Partial<PendingEntry> = { title }
    partial.promise = new Promise<GateDecision>((resolve, reject) => {
      partial.resolve = resolve
      partial.reject = reject
    })
    const entry = partial as PendingEntry
    this.pending.set(gateId, entry)
    return entry
  }
}

export const gateBridge = new GateBridge()
