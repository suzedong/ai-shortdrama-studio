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

import { updateBriefFields } from '../../electron/brief/update'
import { writeSessionState } from '../../electron/project/library'
import { canvasStore } from '../../electron/canvas/store'
import { MANIFEST_FILE } from '../../electron/project/manifest'
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

    // 画布：scenes 挂脏五字段、status 仍 done；brief 节点指向 v2
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
})
