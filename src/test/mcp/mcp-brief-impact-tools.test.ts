// feature-002 · brief.impact.assess / brief.impact.commit / canvas.align MCP 工具测试
// 契约 §9.2：临时项目 + writeSessionState + canvasStore.reset；与 mcp-brief-tools 同夹具模式，
// 但使用独立 mkdtemp 项目（该套件自身会发布 v1–v3，不可共用目录）。
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
import type { BriefDraft, ProjectManifest } from '@shared/types'

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

async function call<T = Record<string, unknown>>(
  handlers: Map<string, Handler>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T & { ok: boolean; error?: { code: string; message: string } }> {
  const r = await handlers.get(name)!(args)
  expect(r.isError).toBe(false)
  return JSON.parse(r.content[0]!.text)
}

// 错误信封用例：isError 必须跟随 ok:false
async function callFail(
  handlers: Map<string, Handler>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: false; error: { code: string; message: string } }> {
  const r = await handlers.get(name)!(args)
  expect(r.isError).toBe(true)
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

async function writeManifest(projDir: string, status: ProjectManifest['status'] = 'initiating', briefVersion: number | null = null): Promise<void> {
  const now = new Date().toISOString()
  const manifest: ProjectManifest = {
    status,
    createdAt: now,
    workflowVersion: 1,
    updatedAt: now,
    statusHistory: [],
    briefVersion,
  }
  await fsp.writeFile(path.join(projDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf-8')
}

/** 经 canvas.update 挂一个 done 血缘节点（fields 可配） */
async function addDoneNode(
  handlers: Map<string, Handler>,
  node: { id: string; step: string; title: string; fields: string[]; briefVersion?: number },
): Promise<void> {
  const r = await call(handlers, 'canvas.update', {
    nodes: [{
      id: node.id,
      step: node.step,
      kind: 'outline',
      title: node.title,
      status: 'done',
      parentReference: { briefVersion: node.briefVersion ?? 1, fields: node.fields },
      updatedAt: new Date().toISOString(),
    }],
  })
  expect(r.ok).toBe(true)
}

let projDir = ''
let legacyDir = ''
let handlers: Map<string, Handler>

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-impact-tools-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project-main')
  legacyDir = path.join(tmpRoot, 'project-legacy')
  await fsp.mkdir(projDir, { recursive: true })
  await fsp.mkdir(legacyDir, { recursive: true })
  await writeManifest(projDir)
  writeSessionState({ currentDir: projDir })
  canvasStore.reset()
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
})

describe('feature-002 立项后变更 MCP 工具（契约 §4/§9.2）', () => {
  it('assess 无已发布立项 → BRIEF_NO_BASELINE（isError），且零写盘', async () => {
    const before = await fsp.readdir(projDir)
    const r = await callFail(handlers, 'brief.impact.assess', { draft })
    expect(r.error.code).toBe('BRIEF_NO_BASELINE')
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('v1 publish 成功后 manifest.briefVersion===1（v1 回归）', async () => {
    const r = await call<{ version: number }>(handlers, 'brief.publish', {
      ...draft, approve: { by: 'gate' },
    })
    expect(r.ok).toBe(true)
    expect(r.version).toBe(1)
    const manifest = JSON.parse(await fsp.readFile(path.join(projDir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
    expect(manifest.briefVersion).toBe(1)
  })

  it('挂三个 done 节点：待命中 / 字段不相交 / 无血缘不进候选', async () => {
    await addDoneNode(handlers, {
      id: 'step-1-scenes', step: '2', title: '分场',
      fields: ['premise.leads', 'fiveElements.episodeCount', 'fiveElements.genre'],
    })
    await addDoneNode(handlers, {
      id: 'step-1-profiles', step: '1', title: '人物小传',
      fields: ['premise.leads', 'premise.coreEvent'],
    })
    // 无 parentReference 的 done 节点（v1 前流程违例产物）：不进任何影响清单
    const noRef = await call(handlers, 'canvas.update', {
      nodes: [{
        id: 'step-1-noref', step: '1', kind: 'note', title: '旧产物',
        status: 'done', updatedAt: new Date().toISOString(),
      }],
    })
    expect(noRef.ok).toBe(true)
  })

  it('assess 改集数：只命中 scenes（medium），无血缘/不相交节点被过滤，零写盘', async () => {
    const draft2: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
    }
    const before = await fsp.readdir(projDir)
    const r = await call<{
      fromVersion: number; toVersion: number
      changes: { field: string; from: string; to: string }[]
      items: { nodeId: string; severity: string; fields: string[]; defaultAction: string }[]
      counts: { high: number; medium: number; total: number }
      latestPublishedAt: string
    }>(handlers, 'brief.impact.assess', { draft: draft2 })
    expect(r.ok).toBe(true)
    expect(r.fromVersion).toBe(1)
    expect(r.toVersion).toBe(2)
    expect(r.changes).toContainEqual(
      expect.objectContaining({ field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' }),
    )
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      nodeId: 'step-1-scenes', severity: 'medium', defaultAction: 'mark',
      fields: ['fiveElements.episodeCount'],
    })
    expect(r.counts).toEqual({ high: 0, medium: 1, total: 1 })
    expect(typeof r.latestPublishedAt).toBe('string')
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
    const node = (await canvasStore.get()).nodes.find(n => n.id === 'step-1-scenes')
    expect(node?.dirty).toBeUndefined()
  })

  it('assess 改人物（high）：scenes 与 profiles 均命中，high 排序在前', async () => {
    const draft2: BriefDraft = {
      ...draft,
      premise: { ...draft.premise, leads: '28 岁女律师 / 30 岁男法医' },
    }
    const r = await call<{
      items: { nodeId: string; severity: string; defaultAction: string; fields: string[] }[]
      counts: { high: number; medium: number; total: number }
    }>(handlers, 'brief.impact.assess', { draft: draft2 })
    expect(r.ok).toBe(true)
    expect(r.items.map(i => i.nodeId)).toEqual(['step-1-profiles', 'step-1-scenes'])
    expect(r.items.every(i => i.severity === 'high' && i.defaultAction === 'regenerate')).toBe(true)
    expect(r.items.find(i => i.nodeId === 'step-1-scenes')?.fields).toEqual(['premise.leads'])
    expect(r.counts).toEqual({ high: 2, medium: 0, total: 2 })
  })

  it('commit 就绪闸门失败 → BRIEF_NOT_READY，零写盘', async () => {
    const bad: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集', genre: '' },
    }
    const before = await fsp.readdir(projDir)
    const r = await callFail(handlers, 'brief.impact.commit', {
      draft: bad, approve: { by: 'gate' }, decisions: [],
    })
    expect(r.error.code).toBe('BRIEF_NOT_READY')
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('commit verbal 无 quote → INVALID_ARGUMENT，零写盘', async () => {
    const draft2: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
    }
    const before = await fsp.readdir(projDir)
    const r = await callFail(handlers, 'brief.impact.commit', {
      draft: draft2, approve: { by: 'verbal' }, decisions: [],
    })
    expect(r.error.code).toBe('INVALID_ARGUMENT')
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('commit decisions 缺项 → IMPACT_DECISION_MISMATCH，零写盘', async () => {
    const draft2: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
    }
    const before = await fsp.readdir(projDir)
    const r = await callFail(handlers, 'brief.impact.commit', {
      draft: draft2, approve: { by: 'gate' }, decisions: [],
    })
    expect(r.error.code).toBe('IMPACT_DECISION_MISMATCH')
    expect(r.error.message).toContain('step-1-scenes')
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('commit decisions 多未知 id / 重复 id → IMPACT_DECISION_MISMATCH，零写盘', async () => {
    const draft2: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
    }
    const before = await fsp.readdir(projDir)
    const extra = await callFail(handlers, 'brief.impact.commit', {
      draft: draft2, approve: { by: 'gate' },
      decisions: [
        { nodeId: 'step-1-scenes', decision: 'mark' },
        { nodeId: 'step-9-ghost', decision: 'mark' },
      ],
    })
    expect(extra.error.code).toBe('IMPACT_DECISION_MISMATCH')
    expect(extra.error.message).toContain('step-9-ghost')
    const dup = await callFail(handlers, 'brief.impact.commit', {
      draft: draft2, approve: { by: 'gate' },
      decisions: [
        { nodeId: 'step-1-scenes', decision: 'mark' },
        { nodeId: 'step-1-scenes', decision: 'regenerate' },
      ],
    })
    expect(dup.error.code).toBe('IMPACT_DECISION_MISMATCH')
    expect(dup.error.message).toContain('重复')
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('重复 commit 同版本（预放损坏占位档）→ BRIEF_VERSION_EXISTS 且第二次调用前后文件不被破坏', async () => {
    const placeholder = path.join(projDir, '立项单.v2.json')
    await fsp.writeFile(placeholder, '损坏内容（listBriefVersions 跳过、publishBriefFiles 防覆盖拦截）', 'utf-8')
    const draft2: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
    }
    const r = await callFail(handlers, 'brief.impact.commit', {
      draft: draft2, approve: { by: 'gate' },
      decisions: [{ nodeId: 'step-1-scenes', decision: 'mark' }],
    })
    expect(r.error.code).toBe('BRIEF_VERSION_EXISTS')
    // 占位档原文未被覆盖；无影响清单 / v2 md / manifest 改动
    await expect(fsp.readFile(placeholder, 'utf-8')).resolves.toContain('损坏内容')
    const files = await fsp.readdir(projDir)
    expect(files.some(f => f.startsWith('影响清单.'))).toBe(false)
    expect(files).not.toContain('立项单.v2.md')
    const manifest = JSON.parse(await fsp.readFile(path.join(projDir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
    expect(manifest.briefVersion).toBe(1)
    await fsp.rm(placeholder)
  })

  it('commit v2 全 mark：四落盘 + 节点 dirty 五字段 + status 仍 done + regenerate=[]', async () => {
    const draft2: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
    }
    const r = await call<{
      version: number; jsonPath: string; mdPath: string; impactReportPath: string
      items: { nodeId: string }[]
      markedDirty: string[]
      regenerate: unknown[]
    }>(handlers, 'brief.impact.commit', {
      draft: draft2,
      approve: { by: 'verbal', verbal: { quote: '集数改成 100，分场先标记' } },
      decisions: [{ nodeId: 'step-1-scenes', decision: 'mark' }],
    })
    expect(r.ok).toBe(true)
    expect(r.version).toBe(2)
    expect(r.jsonPath).toBe('立项单.v2.json')
    expect(r.mdPath).toBe('立项单.v2.md')
    expect(r.impactReportPath).toBe('影响清单.v1-v2.json')
    expect(r.markedDirty).toEqual(['step-1-scenes'])
    expect(r.regenerate).toEqual([])

    // 四落盘
    const files = await fsp.readdir(projDir)
    for (const f of ['立项单.v2.json', '立项单.v2.md', '影响清单.v1-v2.json', MANIFEST_FILE]) {
      expect(files).toContain(f)
    }
    const report = JSON.parse(await fsp.readFile(path.join(projDir, r.impactReportPath), 'utf-8'))
    expect(report).toMatchObject({
      schemaVersion: 1, kind: 'brief-impact-report',
      fromVersion: 1, toVersion: 2,
    })
    expect(report.items).toEqual([
      expect.objectContaining({ nodeId: 'step-1-scenes', decision: 'mark' }),
    ])
    expect(typeof report.committedAt).toBe('string')

    // manifest 指针推进、statusHistory 不动
    const manifest = JSON.parse(await fsp.readFile(path.join(projDir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
    expect(manifest.briefVersion).toBe(2)
    expect(manifest.statusHistory).toEqual([])

    // 节点脏态五字段 + status 保持 done；未命中节点无脏
    const canvas = await canvasStore.get()
    const scenes = canvas.nodes.find(n => n.id === 'step-1-scenes')!
    expect(scenes.status).toBe('done')
    expect(scenes.dirty).toEqual({
      sinceBriefVersion: 1,
      latestBriefVersion: 2,
      fields: ['fiveElements.episodeCount'],
      severity: 'medium',
      impactReport: '影响清单.v1-v2.json',
    })
    expect(scenes.parentReference).toEqual({
      briefVersion: 1,
      fields: ['premise.leads', 'fiveElements.episodeCount', 'fiveElements.genre'],
    })
    expect(canvas.nodes.find(n => n.id === 'step-1-profiles')?.dirty).toBeUndefined()
    // brief 节点同 id 覆盖指向 v2
    const briefNode = canvas.nodes.find(n => n.id === 'step-0-brief')!
    expect(briefNode).toMatchObject({ status: 'done', meta: { version: 'v2' } })
  })

  it('align 目标版本倒退（v1）→ INVALID_ARGUMENT，脏态保留', async () => {
    const r = await callFail(handlers, 'canvas.align', { nodeId: 'step-1-scenes', briefVersion: 1 })
    expect(r.error.code).toBe('INVALID_ARGUMENT')
    const node = (await canvasStore.get()).nodes.find(n => n.id === 'step-1-scenes')
    expect(node?.dirty?.latestBriefVersion).toBe(2)
  })

  it('align 节点不存在 → CANVAS_NODE_NOT_FOUND', async () => {
    const r = await callFail(handlers, 'canvas.align', { nodeId: 'step-9-missing' })
    expect(r.error.code).toBe('CANVAS_NODE_NOT_FOUND')
  })

  it('align 清脏并推进 parentReference 到 manifest.briefVersion（默认）', async () => {
    const r = await call<{ nodeId: string; briefVersion: number }>(
      handlers, 'canvas.align', { nodeId: 'step-1-scenes' },
    )
    expect(r.ok).toBe(true)
    expect(r.briefVersion).toBe(2)
    const node = (await canvasStore.get()).nodes.find(n => n.id === 'step-1-scenes')!
    expect(node.dirty).toBeUndefined()
    expect(node.parentReference).toEqual({
      briefVersion: 2,
      fields: ['premise.leads', 'fiveElements.episodeCount', 'fiveElements.genre'],
    })
  })

  it('align 无 dirty 幂等：alreadyAligned=true，不报错', async () => {
    const r = await call<{ nodeId: string; briefVersion: number; alreadyAligned?: true }>(
      handlers, 'canvas.align', { nodeId: 'step-1-scenes' },
    )
    expect(r.ok).toBe(true)
    expect(r.alreadyAligned).toBe(true)
    expect(r.briefVersion).toBe(2)
  })

  it('commit v3 regenerate 决策：项同样挂脏且出现在返回 regenerate[]', async () => {
    // v2 后定稿的 scenes 血缘=2；profiles 血缘仍=1（v2 Δ 仅集数，未命中）
    // v3 改人物：血缘=2 的 scenes 不命中版本过滤；profiles 血缘=1≠2 也不命中——
    // 故再挂一个血缘=2、消费 leads 的新节点模拟 v2 后定稿产物
    await addDoneNode(handlers, {
      id: 'step-2-dialogue', step: '2', title: '台词',
      briefVersion: 2,
      fields: ['premise.leads', 'fiveElements.platforms'],
    })
    const draft3: BriefDraft = {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
      premise: { ...draft.premise, leads: '28 岁女律师 / 30 岁男法医' },
    }
    const r = await call<{
      version: number
      items: { nodeId: string; severity: string }[]
      markedDirty: string[]
      regenerate: { nodeId: string; severity: string }[]
      impactReportPath: string
    }>(handlers, 'brief.impact.commit', {
      draft: draft3,
      approve: { by: 'gate' },
      // scenes 已 align 到 v2 且 fields 含 leads → 同样命中（medium mark）；
      // dialogue 是 v2 后定稿产物，用户决策重生成
      decisions: [
        { nodeId: 'step-1-scenes', decision: 'mark' },
        { nodeId: 'step-2-dialogue', decision: 'regenerate' },
      ],
    })
    expect(r.ok).toBe(true)
    expect(r.version).toBe(3)
    // 两节点均命中 premise.leads（high）、step 均为 '2'，按 nodeId 字典序
    expect(r.items.map(i => i.nodeId)).toEqual(['step-1-scenes', 'step-2-dialogue'])
    expect(r.items.map(i => i.severity)).toEqual(['high', 'high'])
    expect(r.markedDirty.sort()).toEqual(['step-1-scenes', 'step-2-dialogue'])
    expect(r.regenerate).toHaveLength(1)
    expect(r.regenerate[0]).toMatchObject({ nodeId: 'step-2-dialogue', severity: 'high' })
    expect(r.impactReportPath).toBe('影响清单.v2-v3.json')
    const node = (await canvasStore.get()).nodes.find(n => n.id === 'step-2-dialogue')!
    expect(node.status).toBe('done')
    expect(node.dirty).toMatchObject({
      sinceBriefVersion: 2, latestBriefVersion: 3,
      severity: 'high', impactReport: '影响清单.v2-v3.json',
    })
    const manifest = JSON.parse(await fsp.readFile(path.join(projDir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
    expect(manifest.briefVersion).toBe(3)
    expect(manifest.statusHistory).toEqual([])
  })

  it('canvas.update zod 剥离 dirty 键：传入 dirty 结果节点无 dirty（§9.3）', async () => {
    const r = await call(handlers, 'canvas.update', {
      nodes: [{
        id: 'step-1-noref',
        step: '1', kind: 'note', title: '旧产物',
        status: 'done', updatedAt: new Date().toISOString(),
        dirty: {
          sinceBriefVersion: 1, latestBriefVersion: 3,
          fields: ['premise.leads'], severity: 'high', impactReport: '影响清单.v2-v3.json',
        },
      }],
    })
    expect(r.ok).toBe(true)
    const node = (await canvasStore.get()).nodes.find(n => n.id === 'step-1-noref')
    expect(node?.dirty).toBeUndefined()
  })

  it('旧档兼容：手工写无 briefVersion 的 manifest.json，assess 正常运行（基线由立项单扫描决定）', async () => {
    // 切换到独立旧档项目：只有 v1 立项单 + 缺 briefVersion 字段的 manifest
    writeSessionState({ currentDir: legacyDir })
    canvasStore.reset()
    const legacyNow = new Date().toISOString()
    await fsp.writeFile(
      path.join(legacyDir, MANIFEST_FILE),
      JSON.stringify({
        status: 'initiating', createdAt: legacyNow, workflowVersion: 1,
        updatedAt: legacyNow, statusHistory: [],
      }, null, 2),
      'utf-8',
    )
    // 手工造 v1 立项单（不经 brief.publish，模拟历史项目：有立项单、manifest 无指针）
    await fsp.writeFile(
      path.join(legacyDir, '立项单.v1.json'),
      JSON.stringify({
        schemaVersion: 2, version: 1,
        kind: draft.kind, fiveElements: draft.fiveElements,
        premise: draft.premise, style: draft.style,
        approve: { at: legacyNow, by: 'gate' },
        changesFromPrevious: [], publishedAt: legacyNow,
      }, null, 2),
      'utf-8',
    )
    const legacyFake = buildFakeServer()
    registerPureTools(legacyFake.server)
    const legacyHandlers = legacyFake.handlers
    // assess 不依赖 manifest 指针：改集数且无任何血缘节点 → 空影响清单但成功
    const r = await call<{ fromVersion: number; toVersion: number; items: unknown[]; counts: { total: number } }>(
      legacyHandlers,
      'brief.impact.assess',
      { draft: { ...draft, fiveElements: { ...draft.fiveElements, episodeCount: '60 集' } } },
    )
    expect(r.ok).toBe(true)
    expect(r.fromVersion).toBe(1)
    expect(r.toVersion).toBe(2)
    expect(r.items).toEqual([])
    expect(r.counts.total).toBe(0)
    // 旧档 manifest 未被 assess 改动（无该字段）
    const raw = JSON.parse(await fsp.readFile(path.join(legacyDir, MANIFEST_FILE), 'utf-8')) as Record<string, unknown>
    expect('briefVersion' in raw).toBe(false)
  })
})
