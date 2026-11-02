// feature-015 · GateBridge 非阻塞协议（契约 §1/§3/§4）
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
const executeMock = vi.hoisted(() => ({ applyGateDecision: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))
vi.mock('../../../electron/gate/execute', () => ({
  applyGateDecision: executeMock.applyGateDecision,
}))

import { gateBridge, type GatePushEvent } from '../../../electron/gate/bridge'
import { canvasStore } from '../../../electron/canvas/store'
import { writeSessionState } from '../../../electron/project/library'
import type { CanvasGate } from '../../../shared/types'

let tmpRoot = ''
let projectSeq = 0

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-gate-bridge-'))
  holder.userData = path.join(tmpRoot, 'userdata')
})

beforeEach(async () => {
  const projDir = path.join(tmpRoot, `project-${projectSeq++}`)
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
  canvasStore.reset()
  gateBridge.clearLive()
  gateBridge.setGateListener(null)
  executeMock.applyGateDecision.mockReset()
  executeMock.applyGateDecision.mockResolvedValue({ ok: true, summary: '后置动作已完成' })
})

function request(gateId = 'g1') {
  return gateBridge.request({ gateId, title: '标题', question: '是否通过？', options: ['通过', '打回'] })
}

async function seedGate(gate: CanvasGate): Promise<void> {
  await canvasStore.upsertGate(gate)
}

describe('feature-015 · GateBridge request 非阻塞与重开', () => {
  it('request 无人工操作即返回 pending，落盘后不执行后置动作', async () => {
    const result = await request()

    expect(result).toMatchObject({ gateId: 'g1', status: 'pending' })
    expect(Date.parse(result.requestedAt)).not.toBeNaN()
    const gate = (await canvasStore.get()).gates.find(g => g.gateId === 'g1')
    expect(gate).toMatchObject({ status: 'pending', question: '是否通过？' })
    expect(executeMock.applyGateDecision).not.toHaveBeenCalled()
  })

  it('重复 gateId 覆盖重开，推送 reopened，画布仍只一条门', async () => {
    await seedGate({
      gateId: 'g-reopen', status: 'approved', question: '旧问题', options: ['旧选项'],
    })
    const events: GatePushEvent[] = []
    gateBridge.setGateListener(e => events.push(e))

    const result = await gateBridge.request({
      gateId: 'g-reopen', title: '再版', question: '新问题', options: ['通过', '打回'], payload: { version: 2 },
    })

    expect(result).toMatchObject({ gateId: 'g-reopen', status: 'pending', payload: { version: 2 } })
    const gates = (await canvasStore.get()).gates.filter(g => g.gateId === 'g-reopen')
    expect(gates).toHaveLength(1)
    expect(gates[0]).toMatchObject({ status: 'pending', question: '新问题', options: ['通过', '打回'] })
    expect(events.at(-1)).toMatchObject({ reopened: true, gate: { gateId: 'g-reopen', status: 'pending' } })
    expect(executeMock.applyGateDecision).not.toHaveBeenCalled()
  })
})

describe('feature-015 · GateBridge decide 幂等、并发与执行结果', () => {
  it('approved 执行后置并推送 execution；重复 decide 忽略且不重复执行', async () => {
    await request('g-approved')
    const events: GatePushEvent[] = []
    gateBridge.setGateListener(e => events.push(e))

    const result = await gateBridge.decide('g-approved', { decision: 'approved', note: '可以' })
    expect(result).toEqual({ ok: true, execution: { ok: true, summary: '后置动作已完成' } })
    expect(executeMock.applyGateDecision).toHaveBeenCalledTimes(1)
    expect(executeMock.applyGateDecision).toHaveBeenCalledWith(
      expect.objectContaining({ gateId: 'g-approved', status: 'approved', note: '可以' }),
      '可以',
    )
    expect((await canvasStore.get()).gates[0]!.status).toBe('approved')
    expect(events.at(-1)).toMatchObject({
      gate: { gateId: 'g-approved', status: 'approved' },
      execution: { ok: true, summary: '后置动作已完成' },
    })

    const repeated = await gateBridge.decide('g-approved', { decision: 'approved' })
    expect(repeated).toEqual({ ok: true, ignored: true })
    expect(executeMock.applyGateDecision).toHaveBeenCalledTimes(1)
  })

  it('rejected 不执行后置；重复 rejected / approved 均幂等忽略', async () => {
    await request('g-rejected')
    const result = await gateBridge.decide('g-rejected', { decision: 'rejected', note: '重写' })
    expect(result).toEqual({ ok: true })
    expect(executeMock.applyGateDecision).not.toHaveBeenCalled()
    expect((await canvasStore.get()).gates[0]).toMatchObject({ status: 'rejected', note: '重写' })

    expect(await gateBridge.decide('g-rejected', { decision: 'approved' })).toEqual({ ok: true, ignored: true })
    expect(executeMock.applyGateDecision).not.toHaveBeenCalled()
  })

  it('草案类失败回退 pending，并随最终门卡推送失败原因', async () => {
    executeMock.applyGateDecision.mockResolvedValue({
      ok: false, code: 'BRIEF_NOT_READY', message: '草案未就绪', revertToPending: true,
    })
    await request('g-revert')
    const events: GatePushEvent[] = []
    gateBridge.setGateListener(e => events.push(e))

    const result = await gateBridge.decide('g-revert', { decision: 'approved' })
    expect(result).toMatchObject({ ok: true, execution: { code: 'BRIEF_NOT_READY' } })
    expect((await canvasStore.get()).gates[0]!.status).toBe('pending')
    expect(events.at(-1)).toMatchObject({
      gate: { status: 'pending' },
      execution: { ok: false, code: 'BRIEF_NOT_READY', revertToPending: true },
    })
  })

  it('执行故障保持 approved，并推送失败 execution', async () => {
    executeMock.applyGateDecision.mockResolvedValue({
      ok: false, code: 'HARNESS_VALIDATION_FAILED', message: '基础校验未通过',
    })
    await request('g-execution-failed')
    const result = await gateBridge.decide('g-execution-failed', { decision: 'approved' })
    expect(result).toMatchObject({ ok: true, execution: { code: 'HARNESS_VALIDATION_FAILED' } })
    expect((await canvasStore.get()).gates[0]!.status).toBe('approved')
  })

  it('并发 decide 只执行一次后置动作，后到的调用返回 ignored', async () => {
    let release!: (value: { ok: true; summary: string }) => void
    executeMock.applyGateDecision.mockImplementation(() => new Promise(resolve => { release = resolve }))
    await request('g-concurrent')

    const first = gateBridge.decide('g-concurrent', { decision: 'approved' })
    await vi.waitFor(() => expect(executeMock.applyGateDecision).toHaveBeenCalledTimes(1))
    const second = await gateBridge.decide('g-concurrent', { decision: 'approved' })
    expect(second).toEqual({ ok: true, ignored: true })

    release({ ok: true, summary: '只执行一次' })
    expect(await first).toEqual({ ok: true, execution: { ok: true, summary: '只执行一次' } })
    expect(executeMock.applyGateDecision).toHaveBeenCalledTimes(1)
  })
})

describe('feature-015 · 清态与磁盘恢复', () => {
  it('clearLive 只清内存：不改门态、不执行后置；recoverPending 后可裁决', async () => {
    await request('g-recover')
    gateBridge.clearLive()
    expect(executeMock.applyGateDecision).not.toHaveBeenCalled()
    expect((await canvasStore.get()).gates[0]!.status).toBe('pending')

    const events: GatePushEvent[] = []
    gateBridge.setGateListener(e => events.push(e))
    await gateBridge.recoverPending()
    expect(events.map(e => e.gate.gateId)).toContain('g-recover')
    expect(executeMock.applyGateDecision).not.toHaveBeenCalled()

    await gateBridge.decide('g-recover', { decision: 'approved' })
    expect(executeMock.applyGateDecision).toHaveBeenCalledTimes(1)
    expect((await canvasStore.get()).gates[0]!.status).toBe('approved')
  })

  it('decide 不存在的门抛 INVALID_ARGUMENT，不执行后置', async () => {
    await expect(gateBridge.decide('missing', { decision: 'approved' })).rejects.toMatchObject({
      name: 'INVALID_ARGUMENT',
    })
    expect(executeMock.applyGateDecision).not.toHaveBeenCalled()
  })
})
