// feature-806 · brief.publish 写盘前 harness 前置拦截（契约 §2.2/§2.3）
// 断言模式逐字循 mcp-brief-gate-guard.test.ts：vi.mock electron + holder.userData、buildFakeServer/call、
// freshProject、seedGate、briefFiles。顺序 = harness 校验前置、807 门态防护语义不变。
import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { registerPureTools } from '../../../electron/mcp/tools'
import { writeSessionState } from '../../../electron/project/library'
import { canvasStore } from '../../../electron/canvas/store'
import { MANIFEST_FILE } from '../../../electron/project/manifest'
import type { BriefDraft, CanvasGate, ProjectManifest } from '@shared/types'

// 信封 findings 形状（与 electron/harness/types.ts HarnessFinding 同形；本地声明免跨层引用）
interface Finding {
  gateId: string
  category: 'structure' | 'content' | 'spec' | 'consistency'
  checkId: string
  severity: 'blocker' | 'warning'
  message: string
}

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
): Promise<T & { ok: boolean; error?: { code: string; message: string; findings?: Finding[] } }> {
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

async function writeManifest(
  dir: string,
  status: ProjectManifest['status'],
  briefVersion: number | null,
): Promise<void> {
  const now = new Date().toISOString()
  const manifest: ProjectManifest = {
    status,
    createdAt: now,
    workflowVersion: 1,
    updatedAt: now,
    statusHistory: [],
    briefVersion,
  }
  await fsp.writeFile(path.join(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf-8')
}

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-brief-harness-gate-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
})

describe('feature-806 brief.publish harness 前置拦截（契约 §2.2）', () => {
  it('approved v1 门 + 发 v2 → HARNESS_VALIDATION_FAILED：零写盘、不改门态、摘要回流门 payload', async () => {
    const dir = await freshProject('p-harness-gate-v2')
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
    expect(r.error?.code).toBe('HARNESS_VALIDATION_FAILED')
    // 裸项目无 manifest.json，同时命中 STRUCT_VERSION_CHAIN，断言用 some 不锁数量
    expect(r.error?.findings?.some(f => f.checkId === 'CONSIST_GATE_PAYLOAD_VERSION')).toBe(true)

    // 零写盘：不落 v2，v1 节点不动
    expect((await briefFiles(dir)).sort()).toEqual(['立项单.v1.json', '立项单.v1.md'])
    const after = await canvasStore.get()
    expect(after.nodes).toHaveLength(1)
    // 不改门态：status 仍 approved、version 键保留；摘要经既有 gate 通道回流（契约 §2.3/D7）
    expect(after.gates).toHaveLength(1)
    expect(after.gates[0]!.status).toBe('approved')
    const payload = after.gates[0]!.payload as {
      version: number
      harnessValidation: { checkedAt: string; findings: Finding[] }
    }
    expect(payload.version).toBe(1)
    expect(payload.harnessValidation.checkedAt).toBeTruthy()
    expect(payload.harnessValidation.findings).toEqual(r.error!.findings)
  })

  it('无门 + manifest 越过立项阶段却无立项单 → HARNESS_VALIDATION_FAILED（CONSIST_MANIFEST_STAGE）；无门故无摘要回流', async () => {
    const dir = await freshProject('p-harness-stage')
    await writeManifest(dir, 'story-outline', null)

    const r = await call('brief.publish', { ...draft, approve: { by: 'gate' } })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('HARNESS_VALIDATION_FAILED')
    expect(r.error?.findings?.some(f => f.checkId === 'CONSIST_MANIFEST_STAGE')).toBe(true)

    // 零写盘；无门 → 不产生任何 gate 记录
    expect(await briefFiles(dir)).toEqual([])
    const after = await canvasStore.get()
    expect(after.nodes).toEqual([])
    expect(after.gates).toEqual([])
  })

  it('画幅越 D-023 闭集 → HARNESS_VALIDATION_FAILED（SPEC_FIELD_ENUM，category=spec）：零写盘', async () => {
    const dir = await freshProject('p-harness-enum')

    const r = await call('brief.publish', {
      ...draft,
      fiveElements: { ...draft.fiveElements, aspectRatio: '方形 1:1' },
      approve: { by: 'gate' },
    })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('HARNESS_VALIDATION_FAILED')
    const hit = r.error?.findings?.find(f => f.checkId === 'SPEC_FIELD_ENUM')
    expect(hit?.category).toBe('spec')
    expect(hit?.severity).toBe('blocker')

    expect(await briefFiles(dir)).toEqual([])
    expect((await canvasStore.get()).nodes).toEqual([])
  })

  it('全过且门 payload 挂陈旧摘要 → 发布成功并剥离摘要，version 键原样保留', async () => {
    const dir = await freshProject('p-harness-strip')
    await seedGate({
      gateId: '0-final',
      status: 'approved',
      payload: {
        version: 1,
        harnessValidation: {
          checkedAt: '2026-10-26T00:00:00.000Z',
          findings: [{
            gateId: '0-final',
            category: 'consistency',
            checkId: 'CONSIST_GATE_PAYLOAD_VERSION',
            severity: 'blocker',
            message: '陈旧摘要：上一次拦截留痕',
          }],
        },
      },
    })

    const r = await call<{ version: number }>('brief.publish', { ...draft, approve: { by: 'gate' } })
    expect(r.ok).toBe(true)
    expect(r.version).toBe(1)
    expect((await briefFiles(dir)).sort()).toEqual(['立项单.v1.json', '立项单.v1.md'])

    // 摘要剥离、payload 其余键原样保留
    const after = await canvasStore.get()
    expect(after.gates).toHaveLength(1)
    expect(after.gates[0]!.payload).toEqual({ version: 1 })
  })
})
