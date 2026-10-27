import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { GateBridge } from '../../electron/gate/bridge'
import { canvasStore } from '../../electron/canvas/store'
import { writeSessionState } from '../../electron/project/library'
import type { CanvasGate } from '../../shared/types'

let projDir = ''

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-gate-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project-gate')
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
})

function request(b: GateBridge, gateId: string) {
  return b.request({ gateId, title: '标题', question: '是否通过？', options: ['通过', '打回'] })
}

async function seedGate(gate: CanvasGate): Promise<void> {
  await canvasStore.upsertGate(gate)
}

const tick = () => new Promise(r => setTimeout(r, 10))

describe('T4 GateBridge', () => {
  it('request 后 Promise 挂起；decide 解除并回传 decision/note', async () => {
    const b = new GateBridge()
    let settled = false
    const p = request(b, 'g1').then(d => {
      settled = true
      return d
    })
    await tick()
    expect(settled).toBe(false)

    // pending 门已写入画布
    const canvas = await canvasStore.get()
    expect(canvas.gates.find(g => g.gateId === 'g1')?.status).toBe('pending')

    b.decide('g1', { decision: 'approved', note: 'ok' })
    await expect(p).resolves.toEqual({ decision: 'approved', note: 'ok' })

    await tick()
    const after = await canvasStore.get()
    expect(after.gates.find(g => g.gateId === 'g1')?.status).toBe('approved')
  })

  it('已有 live entry 时重复 request：幂等返回同一 Promise（不拒绝、不重建）', async () => {
    const b = new GateBridge()
    const first = request(b, 'g2')
    await tick()
    const second = request(b, 'g2')
    expect(second).toBe(first)
    b.settleAll()
    await expect(first).rejects.toMatchObject({ code: 'GATE_TIMEOUT' })
  })

  it('磁盘 pending 门无 live entry：request 重挂成功，门仍只一条', async () => {
    await seedGate({
      gateId: 'g4',
      status: 'pending',
      question: '旧问题',
      options: ['A', 'B'],
    })
    const b = new GateBridge()
    const p = request(b, 'g4')
    await tick()

    const canvas = await canvasStore.get()
    expect(canvas.gates.filter(g => g.gateId === 'g4')).toHaveLength(1)
    // 恢复路径沿用既有门内容
    expect(canvas.gates.find(g => g.gateId === 'g4')?.question).toBe('旧问题')

    b.decide('g4', { decision: 'rejected' })
    await expect(p).resolves.toEqual({ decision: 'rejected' })
  })

  it('approved 门 request → INVALID_ARGUMENT（approved 终态，禁止重开）', async () => {
    await seedGate({
      gateId: 'g5',
      status: 'approved',
      question: '已决',
      options: ['A'],
    })
    const b = new GateBridge()
    await expect(request(b, 'g5')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('rejected 门 request：同一 gateId 重开为 pending（不新增门编号），可再次裁决', async () => {
    await seedGate({
      gateId: 'g8',
      status: 'rejected',
      question: '旧问题',
      options: ['A', 'B'],
    })
    const b = new GateBridge()
    const seen: string[] = []
    b.setGateListener(e => seen.push(`${e.gate.gateId}:${e.gate.status}`))

    const p = b.request({
      gateId: 'g8',
      title: '标题',
      question: '新问题',
      options: ['通过', '打回'],
    })
    await tick()

    // 门仍只一条、状态回退 pending、内容被本次请求覆盖
    const canvas = await canvasStore.get()
    const gates = canvas.gates.filter(g => g.gateId === 'g8')
    expect(gates).toHaveLength(1)
    expect(gates[0].status).toBe('pending')
    expect(gates[0].question).toBe('新问题')
    expect(seen).toContain('g8:pending')

    b.decide('g8', { decision: 'approved' })
    await expect(p).resolves.toEqual({ decision: 'approved' })

    // approved 后即终态：同一 gateId 再请求仍被拒绝
    await expect(request(b, 'g8')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('recoverPending：重挂全部无 live entry 的 pending 门并触发监听', async () => {
    await seedGate({
      gateId: 'g6',
      status: 'pending',
      question: '待恢复',
      options: ['通过', '打回'],
    })
    const b = new GateBridge()
    const seen: string[] = []
    b.setGateListener(e => seen.push(e.gate.gateId))

    await b.recoverPending()
    expect(seen).toContain('g6')

    // 再调一次：有 live entry 的门不重复重挂
    seen.length = 0
    await b.recoverPending()
    expect(seen).not.toContain('g6')

    // 重挂的门可裁决
    b.decide('g6', { decision: 'approved' })
    await tick()
    const canvas = await canvasStore.get()
    expect(canvas.gates.find(g => g.gateId === 'g6')?.status).toBe('approved')
  })

  it('decide 不存在的门 → INVALID_ARGUMENT', () => {
    const b = new GateBridge()
    expect(() => b.decide('nope', { decision: 'approved' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    )
  })

  it('settleAll 把所有 pending 门 reject 为 GATE_TIMEOUT', async () => {
    const b = new GateBridge()
    const p = request(b, 'g7')
    await tick()
    b.settleAll()
    await expect(p).rejects.toMatchObject({ code: 'GATE_TIMEOUT' })
  })
})
