// feature-004 · 立项单历史与回滚主进程测试（契约 §5：AC1-AC5）
// 夹具同 brief-update.test.ts：mkdtemp 项目 + writeSessionState + canvasStore.reset。
// 种子三版立项单（v1 门内 / v2 口头 / v3 面板直改），覆盖：
// AC1 历史元数据 + 损坏跳过；AC2 单版全文 + diffToLatest；AC3 回滚发新版语义；
// AC4 manifest/画布推进；AC5 两类违例零写盘。
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { readBriefHistory, readBriefVersion } from '../../../electron/brief/history'
import { rollbackBriefToVersion } from '../../../electron/brief/rollback'
import { writeSessionState } from '../../../electron/project/library'
import { canvasStore } from '../../../electron/canvas/store'
import { MANIFEST_FILE } from '../../../electron/project/manifest'
import type { Canvas, ProjectBrief, ProjectManifest } from '@shared/types'

const v1: ProjectBrief = {
  schemaVersion: 2,
  version: 1,
  kind: 'commercial',
  fiveElements: {
    genre: '甜宠', platforms: ['抖音'], episodeDuration: '90 秒',
    episodeCount: '80 集', tone: '高甜', aspectRatio: '竖屏 9:16',
  },
  premise: {
    leads: '林夏与顾屿', time: '2024 年', place: '上海',
    coreEvent: '医院重逢', seasonBoundary: '',
  },
  style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
  diagnosisSummary: '首版诊断',
  approve: { at: '2026-10-10T08:00:00.000Z', by: 'gate', note: '初版立项' },
  changesFromPrevious: [],
  publishedAt: '2026-10-10T08:00:00.000Z',
}

const v2: ProjectBrief = {
  ...v1,
  version: 2,
  fiveElements: { ...v1.fiveElements, episodeCount: '100 集' },
  premise: { ...v1.premise, seasonBoundary: '第一季只讲相识' },
  approve: { at: '2026-10-12T08:00:00.000Z', by: 'verbal', verbal: { quote: '集数加到一百集，边界先定到相识' } },
  changesFromPrevious: [
    { field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' },
    { field: 'premise.seasonBoundary', from: '', to: '第一季只讲相识' },
  ],
  publishedAt: '2026-10-12T08:00:00.000Z',
}

const v3: ProjectBrief = {
  ...v2,
  version: 3,
  kind: 'memorial',
  fiveElements: { ...v2.fiveElements, genre: '家庭纪实' },
  diagnosisSummary: 'v3 诊断',
  approve: { at: '2026-10-14T08:00:00.000Z', by: 'ui', note: '面板直改' },
  changesFromPrevious: [
    { field: 'kind', from: 'commercial', to: 'memorial' },
    { field: 'fiveElements.genre', from: '甜宠', to: '家庭纪实' },
    { field: 'diagnosisSummary', from: '首版诊断', to: 'v3 诊断' },
  ],
  publishedAt: '2026-10-14T08:00:00.000Z',
}

let projDir = ''

/** 重置项目目录：v1/v2/v3 立项单 + manifest(briefVersion=3) + canvas（brief 节点指 v3 + 下游血缘节点） */
async function seed(): Promise<void> {
  await fsp.rm(projDir, { recursive: true, force: true })
  await fsp.mkdir(projDir, { recursive: true })
  const now = new Date().toISOString()
  const manifest: ProjectManifest = {
    status: 'initiating',
    createdAt: now,
    workflowVersion: 1,
    updatedAt: now,
    statusHistory: [],
    briefVersion: 3,
  }
  await fsp.writeFile(path.join(projDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf-8')
  for (const b of [v1, v2, v3]) {
    await fsp.writeFile(path.join(projDir, `立项单.v${b.version}.json`), JSON.stringify(b, null, 2), 'utf-8')
  }
  const canvas: Canvas = {
    schemaVersion: 2,
    projectId: 'project',
    title: '测试项目',
    nodes: [
      {
        id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单 v3', status: 'done',
        ref: { path: '立项单.v3.json', format: 'json' }, meta: { version: 'v3' },
        updatedAt: now,
      },
      {
        id: 'step-1-scenes', step: '2', kind: 'outline', title: '分场', status: 'done',
        parentReference: { briefVersion: 3, fields: ['fiveElements.episodeCount', 'fiveElements.genre'] },
        updatedAt: now,
      },
    ],
    edges: [],
    gates: [],
    updatedAt: now,
  }
  await fsp.writeFile(path.join(projDir, 'canvas.json'), JSON.stringify(canvas, null, 2), 'utf-8')
  writeSessionState({ currentDir: projDir })
  canvasStore.reset()
}

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-brief-rollback-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project')
})

beforeEach(async () => {
  await seed()
})

/* ── AC1 / AC2：历史列表与单版读取 ── */

describe('feature-004 立项单历史（readBriefHistory / readBriefVersion）', () => {
  it('AC1：返回 v1..v3 升序元数据（version/path/publishedAt/kind/approveBy/changeCount/note）', async () => {
    const h = await readBriefHistory(projDir)
    expect(h.latestVersion).toBe(3)
    expect(h.warnings).toEqual([])
    expect(h.versions).toEqual([
      {
        version: 1, path: '立项单.v1.json', publishedAt: '2026-10-10T08:00:00.000Z',
        kind: 'commercial', approveBy: 'gate', changeCount: 0, note: '初版立项',
      },
      {
        version: 2, path: '立项单.v2.json', publishedAt: '2026-10-12T08:00:00.000Z',
        kind: 'commercial', approveBy: 'verbal', changeCount: 2,
      },
      {
        version: 3, path: '立项单.v3.json', publishedAt: '2026-10-14T08:00:00.000Z',
        kind: 'memorial', approveBy: 'ui', changeCount: 3, note: '面板直改',
      },
    ])
  })

  it('AC1：损坏版本文件跳过 + warnings，不影响其余版本与 latestVersion', async () => {
    await fsp.writeFile(path.join(projDir, '立项单.v9.json'), '{ 坏掉的 json', 'utf-8')
    const h = await readBriefHistory(projDir)
    expect(h.versions.map(v => v.version)).toEqual([1, 2, 3])
    expect(h.latestVersion).toBe(3)
    expect(h.warnings).toHaveLength(1)
    expect(h.warnings[0]).toContain('立项单.v9.json')
  })

  it('AC2：version-read(v1) 返回全文 + diffToLatest（from=v1 值、to=v3 值，字段路径同 diffBrief）', async () => {
    const r = await readBriefVersion(projDir, 1)
    expect(r.brief.version).toBe(1)
    expect(r.brief.fiveElements.episodeCount).toBe('80 集')
    expect(r.diffToLatest).toEqual([
      { field: 'kind', from: 'commercial', to: 'memorial' },
      { field: 'fiveElements.genre', from: '甜宠', to: '家庭纪实' },
      { field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' },
      { field: 'premise.seasonBoundary', from: '', to: '第一季只讲相识' },
      { field: 'diagnosisSummary', from: '首版诊断', to: 'v3 诊断' },
    ])
  })

  it('AC2：version-read(最新版) → diffToLatest 为空', async () => {
    const r = await readBriefVersion(projDir, 3)
    expect(r.brief.version).toBe(3)
    expect(r.diffToLatest).toEqual([])
  })

  it('AC5：version-read(不存在) → BRIEF_VERSION_NOT_FOUND', async () => {
    await expect(readBriefVersion(projDir, 99)).rejects.toMatchObject({ code: 'BRIEF_VERSION_NOT_FOUND' })
  })
})

/* ── AC3 / AC4 / AC5：回滚 ── */

describe('feature-004 立项单回滚（rollbackBriefToVersion）', () => {
  it('AC3+AC4：rollback(v1) 发布 v4 = v1 内容，双写落盘，历史零改动，manifest/画布推进', async () => {
    const broadcasts: Canvas[] = []
    const unsubscribe = canvasStore.subscribe(c => broadcasts.push(c))
    // v1..v3 原文快照（AC3：历史版零改动校验）
    const before = new Map<string, string>()
    for (const n of [1, 2, 3]) {
      before.set(`立项单.v${n}.json`, await fsp.readFile(path.join(projDir, `立项单.v${n}.json`), 'utf-8'))
    }

    const r = await rollbackBriefToVersion(projDir, 1)
    expect(r.version).toBe(4)
    expect(r.rolledBackFrom).toBe(1)
    // changesFromPrevious = diff(旧最新 v3, v1 内容)，字段顺序同 diffBrief
    expect(r.changesFromPrevious).toEqual([
      { field: 'kind', from: 'memorial', to: 'commercial' },
      { field: 'fiveElements.genre', from: '家庭纪实', to: '甜宠' },
      { field: 'fiveElements.episodeCount', from: '100 集', to: '80 集' },
      { field: 'premise.seasonBoundary', from: '第一季只讲相识', to: '' },
      { field: 'diagnosisSummary', from: 'v3 诊断', to: '首版诊断' },
    ])

    // v4 json：业务字段逐字段 = v1；approve.by='ui' 且 note 含「回滚自 v1」
    const v4 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v4.json'), 'utf-8')) as ProjectBrief
    expect(v4.version).toBe(4)
    expect(v4.kind).toBe(v1.kind)
    expect(v4.fiveElements).toEqual(v1.fiveElements)
    expect(v4.premise).toEqual(v1.premise)
    expect(v4.style).toEqual(v1.style)
    expect(v4.diagnosisSummary).toBe(v1.diagnosisSummary)
    expect(v4.approve.by).toBe('ui')
    expect(v4.approve.note).toBe('回滚自 v1')
    expect(v4.changesFromPrevious).toEqual(r.changesFromPrevious)

    // v4 md 双写：定案行渲染「修改立项面板直改」
    const md = await fsp.readFile(path.join(projDir, '立项单.v4.md'), 'utf-8')
    expect(md).toContain('修改立项面板直改')

    // v1..v3 文件零改动（回滚 = 发新版，历史永不覆盖）
    for (const [name, text] of before) {
      await expect(fsp.readFile(path.join(projDir, name), 'utf-8')).resolves.toBe(text)
    }

    // AC4：manifest.briefVersion = 4（不追加 statusHistory）
    const manifest = JSON.parse(await fsp.readFile(path.join(projDir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
    expect(manifest.briefVersion).toBe(4)
    expect(manifest.statusHistory).toEqual([])

    // AC4：画布 brief 节点 ref 指向 v4、meta.version 更新；下游节点不挂脏（回滚不做影响评估）
    const canvas = await canvasStore.get()
    const briefNode = canvas.nodes.find(n => n.id === 'step-0-brief')!
    expect(briefNode).toMatchObject({
      status: 'done', ref: { path: '立项单.v4.json', format: 'json' }, meta: { version: 'v4' },
    })
    const scenes = canvas.nodes.find(n => n.id === 'step-1-scenes')!
    expect(scenes.dirty).toBeUndefined()
    expect(scenes.parentReference).toEqual({ briefVersion: 3, fields: ['fiveElements.episodeCount', 'fiveElements.genre'] })

    // persistInQueue → 自动广播（renderer 经 canvas:changed 重读新版）
    expect(broadcasts.length).toBeGreaterThan(0)
    expect(broadcasts[broadcasts.length - 1]!.nodes.find(n => n.id === 'step-0-brief')?.meta?.version).toBe('v4')
    unsubscribe()
  })

  it('AC5：rollback(不存在) → BRIEF_VERSION_NOT_FOUND，零写盘', async () => {
    const beforeList = await fsp.readdir(projDir)
    await expect(rollbackBriefToVersion(projDir, 99)).rejects.toMatchObject({ code: 'BRIEF_VERSION_NOT_FOUND' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(beforeList)
  })

  it('AC5：rollback(最新版) → BRIEF_ROLLBACK_LATEST，零写盘', async () => {
    const beforeList = await fsp.readdir(projDir)
    await expect(rollbackBriefToVersion(projDir, 3)).rejects.toMatchObject({ code: 'BRIEF_ROLLBACK_LATEST' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(beforeList)
  })
})
