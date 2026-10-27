import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { registerPureTools } from '../../electron/mcp/tools'
import { writeSessionState } from '../../electron/project/library'
import { canvasStore } from '../../electron/canvas/store'
import type { BriefDraft, CanvasGate } from '@shared/types'

type Handler = (args: Record<string, unknown>) => Promise<{
  content: { text: string }[]
  isError?: boolean
}>

function buildFakeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    tool: (name: string, ...rest: unknown[]) => {
      handlers.set(name, rest[rest.length - 1] as Handler)
    },
  }
  return { server: server as never, handlers }
}

let tmpRoot = ''
let handlers: Map<string, Handler>

async function call<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T & { ok: boolean; error?: { code: string; message: string } }> {
  const r = await handlers.get(name)!(args)
  return JSON.parse(r.content[0]!.text)
}

const draft: BriefDraft = {
  kind: 'commercial',
  fiveElements: {
    genre: '甜宠', platforms: ['抖音'], episodeDuration: '90 秒',
    episodeCount: '80 集', tone: '高甜', aspectRatio: '竖屏 9:16',
  },
  premise: {
    leads: '28 岁女白领 / 30 岁男医生', time: '2024 年', place: '上海',
    coreEvent: '医院重逢', seasonBoundary: '第一季只讲相识',
  },
  style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
  diagnosisSummary: '赛道可行',
}

async function freshProject(name: string): Promise<string> {
  const dir = path.join(tmpRoot, name)
  await fsp.mkdir(dir, { recursive: true })
  writeSessionState({ currentDir: dir })
  canvasStore.reset()
  return dir
}

async function seedGate(gate: Omit<CanvasGate, 'question' | 'options'>): Promise<CanvasGate> {
  const full: CanvasGate = { question: '是否定稿？', options: ['通过', '打回'], ...gate }
  await canvasStore.upsertGate(full)
  return full
}

async function briefFiles(dir: string): Promise<string[]> {
  const files = await fsp.readdir(dir)
  return files.filter(f => /^立项单\.v\d+\.(json|md)$/.test(f))
}

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-brief-gate-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
})

describe('feature-807 brief.publish 门态防护（契约 §3，违例零写盘）', () => {
  it('pending 门 + verbal → BRIEF_GATE_PENDING：无立项单、门仍 pending、无节点', async () => {
    const dir = await freshProject('p-pending-verbal')
    const gate = await seedGate({ gateId: '0-final', status: 'pending', payload: { version: 1 } })

    const r = await call('brief.publish', {
      ...draft,
      approve: { by: 'verbal', verbal: { quote: '行，定稿' } },
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('BRIEF_GATE_PENDING')

    expect(await briefFiles(dir)).toEqual([])
    const after = await canvasStore.get()
    expect(after.gates).toHaveLength(1)
    expect(after.gates[0]).toEqual(gate)
    expect(after.nodes).toEqual([])
  })

  it('rejected 门 + verbal → BRIEF_GATE_REJECTED：零写盘', async () => {
    const dir = await freshProject('p-rejected-verbal')
    await seedGate({ gateId: '0-final', status: 'rejected', payload: { version: 1 } })

    const r = await call('brief.publish', {
      ...draft,
      approve: { by: 'verbal', verbal: { quote: '就这样吧' } },
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('BRIEF_GATE_REJECTED')
    expect(await briefFiles(dir)).toEqual([])
    expect((await canvasStore.get()).nodes).toEqual([])
  })

  it('无门 + verbal(quote) → 成功 v1（现状回归）', async () => {
    const dir = await freshProject('p-no-gate-verbal')
    const r = await call('brief.publish', {
      ...draft,
      approve: { by: 'verbal', verbal: { quote: '行，开始讲故事' } },
    })
    expect(r.ok).toBe(true)
    expect(r.version).toBe(1)
    expect(await briefFiles(dir)).toEqual(['立项单.v1.json', '立项单.v1.md'])
  })

  it('approved 同版本门 + by:gate → 成功 v1（门路径回归）', async () => {
    const dir = await freshProject('p-approved-gate')
    await seedGate({ gateId: '0-final', status: 'approved', payload: { version: 1 } })

    const r = await call('brief.publish', {
      ...draft,
      approve: { by: 'gate', note: '用户已点通过' },
    })
    expect(r.ok).toBe(true)
    expect(r.version).toBe(1)
    expect((await briefFiles(dir)).sort()).toEqual(['立项单.v1.json', '立项单.v1.md'])
  })

  it('approved v1 门 + 发 v2 → BRIEF_GATE_VERSION_MISMATCH：不落 v2', async () => {
    const dir = await freshProject('p-version-mismatch')
    // 先无门发布 v1 形成磁盘实况
    const v1 = await call('brief.publish', { ...draft, approve: { by: 'gate' } })
    expect(v1.ok).toBe(true)
    // 再挂一张只授权 v1 的 approved 门
    await seedGate({ gateId: '0-final', status: 'approved', payload: { version: 1 } })

    const r = await call('brief.publish', {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
      approve: { by: 'gate' },
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('BRIEF_GATE_VERSION_MISMATCH')
    expect((await briefFiles(dir)).sort()).toEqual(['立项单.v1.json', '立项单.v1.md'])
  })

  it('approved 同版本门 + verbal → BRIEF_GATE_APPROVED_USE_GATE：零写盘', async () => {
    const dir = await freshProject('p-approved-verbal')
    await seedGate({ gateId: '0-final', status: 'approved', payload: { version: 1 } })

    const r = await call('brief.publish', {
      ...draft,
      approve: { by: 'verbal', verbal: { quote: '通过' } },
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('BRIEF_GATE_APPROVED_USE_GATE')
    expect(await briefFiles(dir)).toEqual([])
    expect((await canvasStore.get()).nodes).toEqual([])
  })

  it('历史门无 payload.version：pending → PENDING；rejected → REJECTED；approved+gate 放行（兼容）', async () => {
    const dirP = await freshProject('p-legacy-pending')
    await seedGate({ gateId: '0-final', status: 'pending' })
    const rp = await call('brief.publish', { ...draft, approve: { by: 'gate' } })
    expect(rp.ok).toBe(false)
    expect(rp.error?.code).toBe('BRIEF_GATE_PENDING')
    expect(await briefFiles(dirP)).toEqual([])

    const dirR = await freshProject('p-legacy-rejected')
    await seedGate({ gateId: '0-final', status: 'rejected' })
    const rr = await call('brief.publish', { ...draft, approve: { by: 'verbal', verbal: { quote: 'x' } } })
    expect(rr.ok).toBe(false)
    expect(rr.error?.code).toBe('BRIEF_GATE_REJECTED')
    expect(await briefFiles(dirR)).toEqual([])

    const dirA = await freshProject('p-legacy-approved')
    await seedGate({ gateId: '0-final', status: 'approved' })
    const ra = await call('brief.publish', { ...draft, approve: { by: 'gate' } })
    expect(ra.ok).toBe(true)
    expect(ra.version).toBe(1)
    expect((await briefFiles(dirA)).sort()).toEqual(['立项单.v1.json', '立项单.v1.md'])
  })
})
