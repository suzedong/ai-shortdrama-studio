// feature-015 · 裁决后置动作执行器（契约 §3/§4）
// 使用真实临时项目与发布链路，重点锁定：首版系统直发、再版只确认不双写。
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { applyGateDecision } from '../../../electron/gate/execute'
import { canvasStore } from '../../../electron/canvas/store'
import { writeSessionState } from '../../../electron/project/library'
import { MANIFEST_FILE } from '../../../electron/project/manifest'
import { publishV1InQueue } from '../../../electron/brief/publish'
import * as harness from '../../../electron/harness/validate'
import type { BriefDraft, CanvasGate, ProjectManifest } from '@shared/types'

const DRAFT: BriefDraft = {
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

let tmpRoot = ''

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-gate-execute-'))
  holder.userData = path.join(tmpRoot, 'userdata')
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function writeManifestFile(
  dir: string,
  status: ProjectManifest['status'],
  briefVersion: number | null,
): Promise<ProjectManifest> {
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
  return manifest
}

async function freshProject(
  name: string,
  status: ProjectManifest['status'] = 'initiating',
  briefVersion: number | null = null,
): Promise<string> {
  const dir = path.join(tmpRoot, name)
  await fsp.mkdir(dir, { recursive: true })
  await writeManifestFile(dir, status, briefVersion)
  writeSessionState({ currentDir: dir })
  canvasStore.reset()
  return dir
}

async function seedGate(gate: CanvasGate): Promise<CanvasGate> {
  await canvasStore.upsertGate(gate)
  return gate
}

function briefGate(payload: unknown): CanvasGate {
  return {
    gateId: '0-final',
    status: 'approved',
    question: '是否定稿？',
    options: ['通过', '打回'],
    payload,
  }
}

async function readManifestFile(dir: string): Promise<ProjectManifest> {
  return JSON.parse(await fsp.readFile(path.join(dir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
}

async function briefFiles(dir: string): Promise<string[]> {
  return (await fsp.readdir(dir)).filter(f => /^立项单\.v\d+\.(json|md)$/.test(f)).sort()
}

describe('feature-015 · 0-final 首版与再版发布边界', () => {
  it('首版 approved：系统双写 v1、upsert done 节点并推进 brief-published', async () => {
    const dir = await freshProject('p-v1')
    const gate = await seedGate(briefGate({
      version: 1,
      pendingMarks: [],
      changesFromPrevious: [],
      draft: DRAFT,
    }))

    const result = await applyGateDecision(gate, '确认发布')

    expect(result).toMatchObject({ ok: true, summary: expect.stringContaining('立项单 v1') })
    expect(await briefFiles(dir)).toEqual(['立项单.v1.json', '立项单.v1.md'])
    const brief = JSON.parse(await fsp.readFile(path.join(dir, '立项单.v1.json'), 'utf-8'))
    expect(brief).toMatchObject({
      version: 1,
      kind: 'commercial',
      approve: { by: 'gate', note: '确认发布' },
      fiveElements: DRAFT.fiveElements,
      premise: DRAFT.premise,
      style: DRAFT.style,
    })

    const canvas = await canvasStore.get()
    expect(canvas.nodes).toHaveLength(1)
    expect(canvas.nodes[0]).toMatchObject({
      id: 'step-0-brief', status: 'done', ref: { path: '立项单.v1.json' }, meta: { version: 'v1' },
    })
    const manifest = await readManifestFile(dir)
    expect(manifest.status).toBe('story-outline')
    expect(manifest.briefVersion).toBe(1)
    expect(manifest.statusHistory.at(-1)).toMatchObject({
      event: 'brief-published', from: 'initiating', to: 'story-outline',
    })
  })

  it('再版 approved：只确认草案，不产生 v2、不改 manifest、不 upsert 节点或挂脏', async () => {
    const dir = await freshProject('p-v2')
    await publishV1InQueue(dir, DRAFT as Parameters<typeof publishV1InQueue>[1], { by: 'verbal' })
    await writeManifestFile(dir, 'story-outline', 1)
    await canvasStore.update({
      nodes: [{
        id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲',
        status: 'done', updatedAt: new Date().toISOString(),
      }],
    })
    const gate = await seedGate(briefGate({
      version: 2,
      pendingMarks: [],
      changesFromPrevious: [{ field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' }],
      draft: {
        ...DRAFT,
        fiveElements: { ...DRAFT.fiveElements, episodeCount: '100 集' },
      },
    }))
    const filesBefore = await briefFiles(dir)
    const manifestBefore = await readManifestFile(dir)
    const nodesBefore = structuredClone((await canvasStore.get()).nodes)

    const result = await applyGateDecision(gate)

    expect(result).toMatchObject({ ok: true, summary: expect.stringContaining('再版 v2 草案已确认') })
    expect(await briefFiles(dir)).toEqual(filesBefore)
    expect(await briefFiles(dir)).toEqual(['立项单.v1.json', '立项单.v1.md'])
    expect(await readManifestFile(dir)).toEqual(manifestBefore)
    expect((await canvasStore.get()).nodes).toEqual(nodesBefore)
  })

  it('历史无草案首版门：保持 approved 并返回 GATE_DRAFT_MISSING，零发布', async () => {
    const dir = await freshProject('p-no-draft')
    const gate = await seedGate(briefGate({ version: 1 }))
    const result = await applyGateDecision(gate)
    expect(result).toMatchObject({ ok: false, code: 'GATE_DRAFT_MISSING' })
    expect(result).not.toMatchObject({ revertToPending: true })
    expect(gate.status).toBe('approved')
    expect(await briefFiles(dir)).toEqual([])
  })

  it('门绑定版本与下一版不符：BRIEF_GATE_VERSION_MISMATCH 且回退 pending', async () => {
    const dir = await freshProject('p-version-mismatch')
    const result = await applyGateDecision(await seedGate(briefGate({ version: 2, draft: DRAFT })))
    expect(result).toMatchObject({
      ok: false, code: 'BRIEF_GATE_VERSION_MISMATCH', revertToPending: true,
    })
    expect(await briefFiles(dir)).toEqual([])
  })

  it('草案缺字段：BRIEF_NOT_READY 且回退 pending，零发布', async () => {
    const dir = await freshProject('p-not-ready')
    const draft = { ...DRAFT, kind: null }
    const result = await applyGateDecision(await seedGate(briefGate({ version: 1, draft })))
    expect(result).toMatchObject({ ok: false, code: 'BRIEF_NOT_READY', revertToPending: true })
    expect((result as { message: string }).message).toContain('项目性质')
    expect(await briefFiles(dir)).toEqual([])
  })

  it('风格引用非法：BRIEF_NOT_READY 且回退 pending，零发布', async () => {
    const dir = await freshProject('p-bad-style')
    const draft = { ...DRAFT, style: { mainStyleId: 'ZZ9', catalogVersion: 'v1.46' } }
    const result = await applyGateDecision(await seedGate(briefGate({ version: 1, draft })))
    expect(result).toMatchObject({ ok: false, code: 'BRIEF_NOT_READY', revertToPending: true })
    expect(await briefFiles(dir)).toEqual([])
  })

  it('harness blocker：保持 approved、摘要写回门 payload、零发布', async () => {
    const dir = await freshProject('p-harness-blocker', 'story-outline', null)
    const gate = await seedGate(briefGate({ version: 1, draft: DRAFT }))
    const result = await applyGateDecision(gate)

    expect(result).toMatchObject({ ok: false, code: 'HARNESS_VALIDATION_FAILED' })
    expect(result).not.toMatchObject({ revertToPending: true })
    expect(gate.status).toBe('approved')
    expect(await briefFiles(dir)).toEqual([])
    const persisted = (await canvasStore.get()).gates[0]!
    expect(persisted.status).toBe('approved')
    const summary = (persisted.payload as {
      harnessValidation: { checkedAt: string; findings: { checkId: string }[] }
    }).harnessValidation
    expect(summary.checkedAt).toBeTruthy()
    expect(summary.findings.some(f => f.checkId === 'CONSIST_MANIFEST_STAGE')).toBe(true)
  })

  it('首版成功：剥离陈旧 harness 摘要，保留草案与版本键', async () => {
    const dir = await freshProject('p-clear-harness')
    const gate = await seedGate(briefGate({
      version: 1,
      draft: DRAFT,
      harnessValidation: {
        checkedAt: '2026-10-27T00:00:00.000Z',
        findings: [{ checkId: 'OLD', severity: 'blocker' }],
      },
    }))
    const result = await applyGateDecision(gate)
    expect(result.ok).toBe(true)
    const payload = (await canvasStore.get()).gates[0]!.payload as Record<string, unknown>
    expect(payload.version).toBe(1)
    expect(payload.draft).toEqual(DRAFT)
    expect(payload).not.toHaveProperty('harnessValidation')
    expect(await briefFiles(dir)).toEqual(['立项单.v1.json', '立项单.v1.md'])
  })

  it('执行期间切项目：PROJECT_CHANGED，原项目不发布', async () => {
    const dir = await freshProject('p-project-change')
    const other = path.join(tmpRoot, 'p-other')
    await fsp.mkdir(other, { recursive: true })
    const gate = await seedGate(briefGate({ version: 1, draft: DRAFT }))
    const validate = harness.runHarnessValidation
    vi.spyOn(harness, 'runHarnessValidation').mockImplementationOnce(async input => {
      const report = await validate(input)
      writeSessionState({ currentDir: other })
      return report
    })

    const result = await applyGateDecision(gate)
    expect(result).toMatchObject({ ok: false, code: 'PROJECT_CHANGED' })
    expect(await briefFiles(dir)).toEqual([])
    expect((await readManifestFile(dir)).status).toBe('initiating')
  })
})

describe('feature-015 · 其他门的系统后置映射', () => {
  it('1-a → 1-b → 2-a → 2-b 按固定顺序只推进 manifest', async () => {
    const dir = await freshProject('p-manifest-map', 'story-outline', 1)
    for (const [gateId, status] of [
      ['1-a', 'story-profiles'],
      ['1-b', 'script-scenes'],
      ['2-a', 'script-dialogue'],
      ['2-b', 'script-storyboard'],
    ] as const) {
      const result = await applyGateDecision({
        gateId, status: 'approved', question: '定稿？', options: ['通过'],
      })
      expect(result).toMatchObject({ ok: true, summary: `已推进至 ${status}` })
    }
    const manifest = await readManifestFile(dir)
    expect(manifest.status).toBe('script-storyboard')
    expect(manifest.statusHistory.map(t => t.event)).toEqual([
      'outline-approved', 'profiles-approved', 'scenes-approved', 'dialogue-approved',
    ])
    expect((await canvasStore.get()).nodes).toEqual([])
  })

  it('already-there 视为幂等成功，bad-transition 返回执行失败', async () => {
    const dir = await freshProject('p-manifest-idempotent', 'story-profiles', 1)
    const gate: CanvasGate = { gateId: '1-a', status: 'approved', question: '定稿？', options: ['通过'] }
    const repeated = await applyGateDecision(gate)
    expect(repeated).toMatchObject({ ok: true, summary: expect.stringContaining('幂等') })

    await writeManifestFile(dir, 'initiating', null)
    const bad = await applyGateDecision(gate)
    expect(bad).toMatchObject({ ok: false, code: 'MANIFEST_BAD_TRANSITION' })
    expect((await readManifestFile(dir)).status).toBe('initiating')
  })

  it('2-c 无系统后置动作', async () => {
    const dir = await freshProject('p-no-post-action', 'script-storyboard', 1)
    const before = await readManifestFile(dir)
    const result = await applyGateDecision({
      gateId: '2-c', status: 'approved', question: '定稿？', options: ['通过'],
    })
    expect(result).toEqual({ ok: true, summary: '该门无系统后置动作' })
    expect(await readManifestFile(dir)).toEqual(before)
  })
})
