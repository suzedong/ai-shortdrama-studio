// D-017 · updateBriefFields 系统直改通道测试（原则六 · 系统优先：确定性字段编辑不经 AI 对话）
// 与 brief.impact.commit（Agent 通道）分工：approve.by 恒 'ui'、decisions 恒全 'mark'、无三选一面板。
// 夹具同 mcp-brief-impact-tools：mkdtemp 项目 + writeSessionState + canvasStore.reset。
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { updateBriefFields } from '../../../electron/brief/update'
import { writeSessionState } from '../../../electron/project/library'
import { canvasStore } from '../../../electron/canvas/store'
import { MANIFEST_FILE } from '../../../electron/project/manifest'
import type { Canvas, ProjectBrief, ProjectManifest } from '@shared/types'

const baseBrief: ProjectBrief = {
  schemaVersion: 2,
  version: 1,
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
  diagnosisDetail: '诊断明细基线', // D-018：面板不动明细，验证原样沿用
  approve: { at: '2026-10-16T08:00:00.000Z', by: 'gate' },
  changesFromPrevious: [],
  publishedAt: '2026-10-16T08:00:00.000Z',
}

let projDir = ''

/**
 * 重置项目目录：manifest（briefVersion 按有无基线）+ 可选 v1 立项单 + canvas.json
 * （step-0-brief done 节点 + step-1-scenes 血缘节点，消费集数/题材）。
 */
async function seed(opts: { withBaseline?: boolean; aux?: string } = {}): Promise<void> {
  await fsp.rm(projDir, { recursive: true, force: true })
  await fsp.mkdir(projDir, { recursive: true })
  const now = new Date().toISOString()
  const withBaseline = opts.withBaseline !== false
  const manifest: ProjectManifest = {
    status: 'initiating',
    createdAt: now,
    workflowVersion: 1,
    updatedAt: now,
    statusHistory: [],
    briefVersion: withBaseline ? 1 : null,
  }
  await fsp.writeFile(path.join(projDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf-8')
  if (withBaseline) {
    const brief: ProjectBrief = opts.aux
      ? { ...baseBrief, style: { ...baseBrief.style, auxiliaryStyleId: opts.aux } }
      : baseBrief
    await fsp.writeFile(path.join(projDir, '立项单.v1.json'), JSON.stringify(brief, null, 2), 'utf-8')
  }
  const canvas: Canvas = {
    schemaVersion: 2,
    projectId: 'project',
    title: '测试项目',
    nodes: [
      {
        id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单 v1', status: 'done',
        ref: { path: '立项单.v1.json', format: 'json' }, meta: { version: 'v1' },
        updatedAt: now,
      },
      {
        id: 'step-1-scenes', step: '2', kind: 'outline', title: '分场', status: 'done',
        parentReference: { briefVersion: 1, fields: ['fiveElements.episodeCount', 'fiveElements.genre'] },
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
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-brief-update-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project')
})

beforeEach(async () => {
  await seed()
})

describe('D-017 修改立项面板直写（updateBriefFields）', () => {
  it('无已发布立项 → BRIEF_NO_BASELINE，零写盘', async () => {
    await seed({ withBaseline: false })
    const before = await fsp.readdir(projDir)
    await expect(
      updateBriefFields(projDir, { fiveElements: { episodeCount: '100 集' } }),
    ).rejects.toMatchObject({ code: 'BRIEF_NO_BASELINE' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('无字段变更（值同基线）→ INVALID_ARGUMENT，零写盘', async () => {
    const before = await fsp.readdir(projDir)
    await expect(
      updateBriefFields(projDir, { fiveElements: { episodeCount: ' 80 集 ' } }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('改后未就绪（集数置空）→ BRIEF_NOT_READY，零写盘', async () => {
    const before = await fsp.readdir(projDir)
    await expect(
      updateBriefFields(projDir, { fiveElements: { episodeCount: '   ' } }),
    ).rejects.toMatchObject({ code: 'BRIEF_NOT_READY' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('改集数 → v2 四落盘 + approve.by=ui + 影响清单全 mark + 挂脏 + 广播', async () => {
    const broadcasts: Canvas[] = []
    const unsubscribe = canvasStore.subscribe(c => broadcasts.push(c))

    const r = await updateBriefFields(projDir, { fiveElements: { episodeCount: '100 集' } })
    expect(r.version).toBe(2)
    expect(r.jsonPath).toBe('立项单.v2.json')
    expect(r.mdPath).toBe('立项单.v2.md')
    expect(r.impactReportPath).toBe('影响清单.v1-v2.json')
    expect(r.changes).toEqual([
      { field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' },
    ])
    expect(r.items).toEqual([
      expect.objectContaining({
        nodeId: 'step-1-scenes', severity: 'medium', defaultAction: 'mark',
        fields: ['fiveElements.episodeCount'],
      }),
    ])
    expect(r.markedDirty).toEqual(['step-1-scenes'])

    // v2 json：直改语义（by:'ui'）+ 未改字段原样继承
    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect(v2.version).toBe(2)
    expect(v2.approve.by).toBe('ui')
    expect(v2.fiveElements.episodeCount).toBe('100 集')
    expect(v2.fiveElements.genre).toBe('甜宠')
    expect(v2.style).toEqual({ mainStyleId: 'A7', catalogVersion: 'v1.46' })
    expect(v2.diagnosisDetail).toBe('诊断明细基线') // D-018：明细不经面板，原样沿用

    // v2 md：定案行渲染为「修改立项面板直改」
    const md = await fsp.readFile(path.join(projDir, '立项单.v2.md'), 'utf-8')
    expect(md).toContain('修改立项面板直改')
    expect(md).toContain('## 选题诊断明细\n诊断明细基线')

    // 影响清单：决策恒全 'mark'（无三选一面板）
    const report = JSON.parse(await fsp.readFile(path.join(projDir, '影响清单.v1-v2.json'), 'utf-8'))
    expect(report).toMatchObject({
      schemaVersion: 1, kind: 'brief-impact-report', fromVersion: 1, toVersion: 2,
    })
    expect(report.items).toEqual([
      expect.objectContaining({ nodeId: 'step-1-scenes', decision: 'mark' }),
    ])

    // manifest 指针推进
    const manifest = JSON.parse(await fsp.readFile(path.join(projDir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
    expect(manifest.briefVersion).toBe(2)

    // 画布：scenes 挂脏五字段 + markedAt（feature-806 B-46）、status 仍 done；brief 节点指向 v2
    const canvas = await canvasStore.get()
    const scenes = canvas.nodes.find(n => n.id === 'step-1-scenes')!
    expect(scenes.status).toBe('done')
    expect(scenes.dirty).toMatchObject({
      sinceBriefVersion: 1,
      latestBriefVersion: 2,
      fields: ['fiveElements.episodeCount'],
      severity: 'medium',
      impactReport: '影响清单.v1-v2.json',
    })
    expect(typeof scenes.dirty?.markedAt).toBe('string')
    expect(Number.isNaN(Date.parse(scenes.dirty!.markedAt!))).toBe(false)
    const briefNode = canvas.nodes.find(n => n.id === 'step-0-brief')!
    expect(briefNode).toMatchObject({
      status: 'done', ref: { path: '立项单.v2.json', format: 'json' }, meta: { version: 'v2' },
    })

    // persistInQueue → listeners 自动广播（renderer 经 canvas:changed 自动重读新版）
    expect(broadcasts.length).toBeGreaterThan(0)
    expect(broadcasts[broadcasts.length - 1]!.nodes.find(n => n.id === 'step-0-brief')?.meta?.version).toBe('v2')
    unsubscribe()
  })

  it('辅助风格置空串 = 清除：v2 无 auxiliaryStyleId，diff 记 from→空串，不命中无关血缘节点', async () => {
    await seed({ aux: 'D1' })
    const r = await updateBriefFields(projDir, { style: { auxiliaryStyleId: '' } })
    expect(r.version).toBe(2)
    expect(r.changes).toEqual([
      { field: 'style.auxiliaryStyleId', from: 'D1', to: '' },
    ])
    // scenes 血缘字段为集数/题材，不消费辅助风格 → 空影响
    expect(r.items).toEqual([])
    expect(r.markedDirty).toEqual([])
    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect(v2.style.mainStyleId).toBe('A7')
    expect('auxiliaryStyleId' in v2.style).toBe(false)
    const canvas = await canvasStore.get()
    expect(canvas.nodes.find(n => n.id === 'step-1-scenes')?.dirty).toBeUndefined()
  })

  it('改项目性质 → diff 记 kind（medium 分级），命中消费 kind 的血缘节点挂脏', async () => {
    // scenes 血缘加 kind 消费（seed 默认只消费集数/题材）
    const canvasPath = path.join(projDir, 'canvas.json')
    const c0 = JSON.parse(await fsp.readFile(canvasPath, 'utf-8')) as Canvas
    c0.nodes.find(n => n.id === 'step-1-scenes')!.parentReference!.fields.push('kind')
    await fsp.writeFile(canvasPath, JSON.stringify(c0, null, 2), 'utf-8')
    canvasStore.reset()

    const r = await updateBriefFields(projDir, { kind: 'memorial' })
    expect(r.changes).toEqual([{ field: 'kind', from: 'commercial', to: 'memorial' }])
    expect(r.items).toEqual([
      expect.objectContaining({ nodeId: 'step-1-scenes', severity: 'medium', fields: ['kind'] }),
    ])
    expect(r.markedDirty).toEqual(['step-1-scenes'])
    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect(v2.kind).toBe('memorial')
    expect(v2.fiveElements.episodeCount).toBe('80 集') // 未改字段原样继承
  })

  it('feature-806 B-46：同一节点重复挂脏 → markedAt 刷新为最新时间', async () => {
    await updateBriefFields(projDir, { fiveElements: { episodeCount: '100 集' } })
    const first = (await canvasStore.get()).nodes.find(n => n.id === 'step-1-scenes')!.dirty!.markedAt!
    await new Promise(r => setTimeout(r, 5))
    // 模拟 align 清脏（血缘指针跟进 v2）后再次变更 → 同一节点二次挂脏（assessImpact 候选要求 parentReference.briefVersion===fromVersion）
    const c = await canvasStore.get()
    const idx = c.nodes.findIndex(n => n.id === 'step-1-scenes')
    const node = c.nodes[idx]!
    const { dirty: _cleared, ...rest } = node
    c.nodes[idx] = { ...rest, parentReference: { briefVersion: 2, fields: node.parentReference!.fields } }
    await fsp.writeFile(path.join(projDir, 'canvas.json'), JSON.stringify(c, null, 2), 'utf-8')
    canvasStore.reset()
    await updateBriefFields(projDir, { fiveElements: { episodeCount: '120 集' } })
    const dirty = (await canvasStore.get()).nodes.find(n => n.id === 'step-1-scenes')!.dirty!
    expect(dirty.sinceBriefVersion).toBe(2)
    expect(dirty.latestBriefVersion).toBe(3)
    expect(Date.parse(dirty.markedAt!)).toBeGreaterThan(Date.parse(first))
  })
})

describe('feature-810 style.catalogVersion 键（谱系升级采纳 · 直改通道语义）', () => {
  it('采纳升级写盘：catalogVersion v1.45→v1.46，by=ui、decision 恒 mark、severity high、未改字段原样继承', async () => {
    // 立项单谱系引用回退 v1.45（模拟谱系升级待采纳）+ scenes 血缘登记消费该键
    const briefPath = path.join(projDir, '立项单.v1.json')
    const b0 = JSON.parse(await fsp.readFile(briefPath, 'utf-8')) as ProjectBrief
    b0.style = { ...b0.style, catalogVersion: 'v1.45' }
    await fsp.writeFile(briefPath, JSON.stringify(b0, null, 2), 'utf-8')
    const canvasPath = path.join(projDir, 'canvas.json')
    const c0 = JSON.parse(await fsp.readFile(canvasPath, 'utf-8')) as Canvas
    c0.nodes.find(n => n.id === 'step-1-scenes')!.parentReference!.fields.push('style.catalogVersion')
    await fsp.writeFile(canvasPath, JSON.stringify(c0, null, 2), 'utf-8')
    canvasStore.reset()

    const r = await updateBriefFields(projDir, { style: { catalogVersion: 'v1.46' } })
    expect(r.version).toBe(2)
    expect(r.changes).toEqual([
      { field: 'style.catalogVersion', from: 'v1.45', to: 'v1.46' },
    ])
    // style.catalogVersion 在 impact.ts 高优先级表 → severity high / defaultAction regenerate
    expect(r.items).toEqual([
      expect.objectContaining({
        nodeId: 'step-1-scenes', severity: 'high', defaultAction: 'regenerate', fields: ['style.catalogVersion'],
      }),
    ])
    expect(r.markedDirty).toEqual(['step-1-scenes'])
    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect(v2.approve.by).toBe('ui')
    expect(v2.style).toEqual({ mainStyleId: 'A7', catalogVersion: 'v1.46' })
    expect(v2.fiveElements.episodeCount).toBe('80 集') // 未改字段原样继承
    // 影响清单落盘：直改通道 decision 恒 'mark'（仅挂脏，不自动重生成）
    const impact = JSON.parse(await fsp.readFile(path.join(projDir, '影响清单.v1-v2.json'), 'utf-8')) as { items: Array<{ decision: string }> }
    expect(impact.items.length).toBe(1)
    expect(impact.items[0]!.decision).toBe('mark')
    const manifest = JSON.parse(await fsp.readFile(path.join(projDir, MANIFEST_FILE), 'utf-8')) as ProjectManifest
    expect(manifest.briefVersion).toBe(2)
  })

  it('catalogVersion 同基线（值同 v1.46）→ INVALID_ARGUMENT，零写盘', async () => {
    const before = await fsp.readdir(projDir)
    await expect(
      updateBriefFields(projDir, { style: { catalogVersion: 'v1.46' } }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })
})

/* feature-013 · 全字段直改 + L0 标签/备注（决策点 1 拍板 A 入模；L0 = 低级：不入影响清单、不挂脏） */

/** 给 scenes 血缘补登记消费字段（验证 L0 即便被血缘引用也不入清单） */
async function addLineageFields(...fields: string[]): Promise<void> {
  const canvasPath = path.join(projDir, 'canvas.json')
  const c = JSON.parse(await fsp.readFile(canvasPath, 'utf-8')) as Canvas
  c.nodes.find(n => n.id === 'step-1-scenes')!.parentReference!.fields.push(...fields)
  await fsp.writeFile(canvasPath, JSON.stringify(c, null, 2), 'utf-8')
  canvasStore.reset()
}

/** 给 v1 基线补 L0（模拟存量已带标签/备注的项目） */
async function setBaselineL0(l0: { tags?: string[]; notes?: string }): Promise<void> {
  const p = path.join(projDir, '立项单.v1.json')
  const b = JSON.parse(await fsp.readFile(p, 'utf-8')) as ProjectBrief
  b.l0 = l0
  await fsp.writeFile(p, JSON.stringify(b, null, 2), 'utf-8')
}

describe('feature-013 · 全字段直改（genre/tone/platforms/premise/diagnosisSummary/l0）', () => {
  it('一次提交全字段 → v2 全量落盘 + md 双写；L0 低级即便被血缘引用也不入影响清单', async () => {
    await addLineageFields('premise.leads', 'l0.tags', 'l0.notes')
    const r = await updateBriefFields(projDir, {
      fiveElements: { genre: '悬疑', tone: '冷调', platforms: ['B站', '抖音'] },
      premise: { leads: '女律师 / 男警察' },
      diagnosisSummary: '赛道可行，建议压到 80 集',
      l0: { tags: ['校园', '逆袭'], notes: '甲方要求片头 5 秒立钩' },
    })
    expect(r.version).toBe(2)
    expect(r.changes).toEqual([
      { field: 'fiveElements.genre', from: '甜宠', to: '悬疑' },
      { field: 'fiveElements.tone', from: '高甜', to: '冷调' },
      { field: 'fiveElements.platforms', from: '抖音', to: 'B站、抖音' },
      { field: 'premise.leads', from: '28 岁女白领 / 30 岁男医生', to: '女律师 / 男警察' },
      { field: 'diagnosisSummary', from: '', to: '赛道可行，建议压到 80 集' },
      { field: 'l0.tags', from: '', to: '校园、逆袭' },
      { field: 'l0.notes', from: '', to: '甲方要求片头 5 秒立钩' },
    ])
    // 命中节点仅列 high/medium 字段；l0.* 兜底归 low，永不出现在清单 fields
    expect(r.items).toEqual([
      expect.objectContaining({
        nodeId: 'step-1-scenes', severity: 'high', defaultAction: 'regenerate',
        fields: ['premise.leads', 'fiveElements.genre'],
      }),
    ])
    expect(r.items[0]!.fields).not.toContain('l0.tags')
    expect(r.markedDirty).toEqual(['step-1-scenes'])

    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect(v2.fiveElements).toMatchObject({ genre: '悬疑', tone: '冷调', platforms: ['B站', '抖音'] })
    expect(v2.premise.leads).toBe('女律师 / 男警察')
    expect(v2.premise.time).toBe('2024 年') // 未提交键沿用
    expect(v2.diagnosisSummary).toBe('赛道可行，建议压到 80 集')
    expect(v2.diagnosisDetail).toBe('诊断明细基线') // 明细恒只读沿用
    expect(v2.l0).toEqual({ tags: ['校园', '逆袭'], notes: '甲方要求片头 5 秒立钩' })
    expect(v2.approve.by).toBe('ui')

    const md = await fsp.readFile(path.join(projDir, '立项单.v2.md'), 'utf-8')
    expect(md).toContain('## 项目标签与备注')
    expect(md).toContain('- 标签：校园、逆袭')
    expect(md).toContain('- 备注：甲方要求片头 5 秒立钩')
    expect(md).toContain('- 目标平台：B站、抖音')
  })

  it('仅 L0 变更 → 照常再版，但不入影响清单、不挂脏（低级直接落盘）', async () => {
    await addLineageFields('l0.tags', 'l0.notes') // 即便血缘登记了 L0 也不得命中
    const r = await updateBriefFields(projDir, {
      l0: { tags: ['招商'], notes: '备注一' },
    })
    expect(r.version).toBe(2)
    expect(r.changes).toEqual([
      { field: 'l0.tags', from: '', to: '招商' },
      { field: 'l0.notes', from: '', to: '备注一' },
    ])
    expect(r.items).toEqual([])
    expect(r.markedDirty).toEqual([])
    const canvas = await canvasStore.get()
    expect(canvas.nodes.find(n => n.id === 'step-1-scenes')?.dirty).toBeUndefined()
  })

  it('存量无 L0 立项单：改其他字段 → 无 l0 伪 diff，v2 不落 l0 键', async () => {
    const r = await updateBriefFields(projDir, { fiveElements: { episodeCount: '100 集' } })
    expect(r.changes).toEqual([
      { field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' },
    ])
    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect('l0' in v2).toBe(false)
    const md = await fsp.readFile(path.join(projDir, '立项单.v2.md'), 'utf-8')
    expect(md).not.toContain('## 项目标签与备注')
  })

  it('已带 L0 再版且未提交 l0 → 原样沿用上一版（Agent 通道不丢 L0）', async () => {
    await setBaselineL0({ tags: ['招商'], notes: '备注一' })
    const r = await updateBriefFields(projDir, { fiveElements: { episodeCount: '100 集' } })
    expect(r.changes).toEqual([
      { field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' },
    ])
    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect(v2.l0).toEqual({ tags: ['招商'], notes: '备注一' })
    const md = await fsp.readFile(path.join(projDir, '立项单.v2.md'), 'utf-8')
    expect(md).toContain('- 标签：招商')
  })

  it('显式清空 L0（tags:[] / notes:""）→ diff 记删除，v2 不落 l0 键（空值等价未设置）', async () => {
    await setBaselineL0({ tags: ['招商'], notes: '备注一' })
    const r = await updateBriefFields(projDir, { l0: { tags: [], notes: '' } })
    expect(r.changes).toEqual([
      { field: 'l0.tags', from: '招商', to: '' },
      { field: 'l0.notes', from: '备注一', to: '' },
    ])
    const v2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect('l0' in v2).toBe(false)
  })

  it('新键组触发就绪红线：题材/基调置空、平台清空、前提置空 → BRIEF_NOT_READY 零写盘', async () => {
    const before = await fsp.readdir(projDir)
    await expect(
      updateBriefFields(projDir, { fiveElements: { genre: '  ' } }),
    ).rejects.toMatchObject({ code: 'BRIEF_NOT_READY' })
    await expect(
      updateBriefFields(projDir, { fiveElements: { tone: '' } }),
    ).rejects.toMatchObject({ code: 'BRIEF_NOT_READY' })
    await expect(
      updateBriefFields(projDir, { fiveElements: { platforms: [] } }),
    ).rejects.toMatchObject({ code: 'BRIEF_NOT_READY' })
    await expect(
      updateBriefFields(projDir, { premise: { time: '   ' } }),
    ).rejects.toMatchObject({ code: 'BRIEF_NOT_READY' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })
})
