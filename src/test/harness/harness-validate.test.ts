// feature-806 T3 · runHarnessValidation 七条 checkId 规则集测试（契约 §5：各规则命中/通过、谱系降级 warning、passed 语义、只读零写盘）
// 夹具：mkdtemp 项目目录直写 manifest.json / canvas.json / 立项单.vN.json；谱系用真实 md（loader 开发态双候选解析）。
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '', failCatalog: false }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))
// 谱系降级用例：flag 置位时 loadStyleCatalog 抛错，其余用例走真实装载
vi.mock('../../../electron/style/loader.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../electron/style/loader.js')>()
  return {
    ...mod,
    loadStyleCatalog: (force?: boolean) => holder.failCatalog
      ? Promise.reject(Object.assign(new Error('谱系文件缺失（测试模拟）'), { code: 'STYLE_CATALOG_MISSING' }))
      : mod.loadStyleCatalog(force),
  }
})

import { runHarnessValidation } from '../../../electron/harness/validate'
import type { BriefDraft, Canvas, CanvasGate, ProjectBrief, ProjectManifest } from '@shared/types'

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
  approve: { at: '2026-10-16T08:00:00.000Z', by: 'gate' },
  changesFromPrevious: [],
  publishedAt: '2026-10-16T08:00:00.000Z',
}

const validSubject: BriefDraft = {
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
}

let projDir = ''

/** 每用例独立项目目录：manifest（briefVersion 跟随有无立项单）+ canvas.json（gates 可选）+ 可选 v1 立项单 */
async function seed(opts: { withBrief?: boolean; manifest?: Partial<ProjectManifest>; gates?: CanvasGate[] } = {}): Promise<void> {
  projDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-harness-'))
  const now = new Date().toISOString()
  const withBrief = opts.withBrief !== false
  const manifest: ProjectManifest = {
    status: 'initiating',
    createdAt: now,
    workflowVersion: 1,
    updatedAt: now,
    statusHistory: [],
    briefVersion: withBrief ? 1 : null,
    ...opts.manifest,
  }
  await fsp.writeFile(path.join(projDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  if (withBrief) {
    await fsp.writeFile(path.join(projDir, '立项单.v1.json'), JSON.stringify(baseBrief, null, 2), 'utf-8')
  }
  const canvas: Canvas = {
    schemaVersion: 2, projectId: 'project', title: '测试项目',
    nodes: [], edges: [], gates: opts.gates ?? [], updatedAt: now,
  }
  await fsp.writeFile(path.join(projDir, 'canvas.json'), JSON.stringify(canvas, null, 2), 'utf-8')
}

function run(subject: BriefDraft = validSubject, candidateVersion = 1) {
  return runHarnessValidation({ projectDir: projDir, gateId: '0-final', subject, candidateVersion })
}

const byCheckId = (report: Awaited<ReturnType<typeof run>>, checkId: string) =>
  report.findings.filter(f => f.checkId === checkId)

beforeEach(async () => {
  holder.failCatalog = false
  await seed()
})

afterEach(async () => {
  await fsp.rm(projDir, { recursive: true, force: true })
})

describe('feature-806 harness 基础校验 · runHarnessValidation', () => {
  it('参数防御：gateId 非 0-final 抛 INVALID_ARGUMENT', async () => {
    await expect(runHarnessValidation({
      projectDir: projDir, gateId: '1-story', subject: validSubject, candidateVersion: 1,
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('全合规草案：passed=true 且 findings 为空（各规则通过面）', async () => {
    const report = await run()
    expect(report.passed).toBe(true)
    expect(report.findings).toEqual([])
    expect(report.gateId).toBe('0-final')
    expect(report.briefVersion).toBe(1)
    expect(typeof report.checkedAt).toBe('string')
  })

  it('STRUCT_REQUIRED_KEYS：kind / 六要素 / 前提 / style 键缺失逐条命中', async () => {
    const subject: BriefDraft = {
      kind: null,
      fiveElements: {},
      premise: { leads: '28 岁女白领', place: '上海' } as BriefDraft['premise'],
      style: {},
    }
    const report = await run(subject)
    const hits = byCheckId(report, 'STRUCT_REQUIRED_KEYS')
    expect(report.passed).toBe(false)
    expect(hits.every(f => f.severity === 'blocker' && f.category === 'structure' && f.gateId === '0-final')).toBe(true)
    const text = hits.map(f => f.message).join('\n')
    expect(text).toContain('kind')
    expect(text).toContain('fiveElements.genre')
    expect(text).toContain('fiveElements.platforms')
    expect(text).toContain('fiveElements.aspectRatio')
    expect(text).toContain('premise.time')
    expect(text).not.toContain('premise.leads') // 在而非空不命中
    expect(text).toContain('style.mainStyleId')
    expect(text).toContain('style.catalogVersion')
    // findings 五字段齐全（契约 §5）
    for (const f of hits) expect(Object.keys(f).sort()).toEqual(['category', 'checkId', 'gateId', 'message', 'severity'])
  })

  it('CONTENT_KEY_TEXT_EMPTY：空串 / 空数组 / 诊断字段在而空命中；缺键不双报', async () => {
    const subject: BriefDraft = {
      ...validSubject,
      fiveElements: { ...validSubject.fiveElements, genre: '  ', platforms: [] },
      premise: { ...validSubject.premise, coreEvent: '' },
      diagnosisSummary: '',
    }
    const report = await run(subject)
    const hits = byCheckId(report, 'CONTENT_KEY_TEXT_EMPTY')
    const text = hits.map(f => f.message).join('\n')
    expect(text).toContain('fiveElements.genre')
    expect(text).toContain('fiveElements.platforms（目标平台）为空数组')
    expect(text).toContain('premise.coreEvent')
    expect(text).toContain('diagnosisSummary')
    // 空值不重复触发 STRUCT / SPEC
    expect(byCheckId(report, 'STRUCT_REQUIRED_KEYS')).toEqual([])
    expect(byCheckId(report, 'SPEC_FIELD_ENUM').some(f => f.message.includes('genre'))).toBe(false)
    expect(report.passed).toBe(false)
  })

  it('SPEC_FIELD_ENUM：kind / aspectRatio 闭集越界、platforms 与字段类型不符命中', async () => {
    const subject = {
      ...validSubject,
      kind: 'personal',
      fiveElements: {
        ...validSubject.fiveElements,
        aspectRatio: '方屏 1:1',
        platforms: '抖音',
        episodeCount: 80,
      },
    } as unknown as BriefDraft
    const report = await run(subject)
    const hits = byCheckId(report, 'SPEC_FIELD_ENUM')
    const text = hits.map(f => f.message).join('\n')
    expect(text).toContain('kind 取值「personal」越界')
    expect(text).toContain('aspectRatio 取值「方屏 1:1」越界')
    expect(text).toContain('platforms 类型不符')
    expect(text).toContain('fiveElements.episodeCount 类型不符')
    expect(report.passed).toBe(false)
  })

  it('SPEC_FIELD_ENUM：platforms 含空串元素命中元素类型检查', async () => {
    const subject: BriefDraft = {
      ...validSubject,
      fiveElements: { ...validSubject.fiveElements, platforms: ['抖音', ''] },
    }
    const report = await run(subject)
    const text = byCheckId(report, 'SPEC_FIELD_ENUM').map(f => f.message).join('\n')
    expect(text).toContain('platforms 元素类型不符')
  })

  it('SPEC_STYLE_REF_UNKNOWN：未知风格 ID / 谱系版本不符命中（复用 802 validateStyleRefs）', async () => {
    const subject: BriefDraft = {
      ...validSubject,
      style: { mainStyleId: 'Z9', catalogVersion: 'v0.0' },
    }
    const report = await run(subject)
    const hits = byCheckId(report, 'SPEC_STYLE_REF_UNKNOWN')
    const text = hits.map(f => f.message).join('\n')
    expect(text).toContain('Z9')
    expect(text).toContain('v0.0')
    expect(hits.every(f => f.severity === 'blocker' && f.category === 'spec')).toBe(true)
    expect(report.passed).toBe(false)
  })

  it('SPEC_STYLE_REF_UNKNOWN：谱系不可装载降级 warning 单条、不阻塞（passed 语义：仅 warning 仍通过）', async () => {
    holder.failCatalog = true
    const report = await run()
    const hits = byCheckId(report, 'SPEC_STYLE_REF_UNKNOWN')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe('warning')
    expect(hits[0]!.message).toContain('谱系不可装载')
    expect(report.passed).toBe(true) // warning 不拦截
  })

  it('STRUCT_VERSION_CHAIN：磁盘最新版与 manifest.briefVersion 三向比对', async () => {
    // 不一致：磁盘 v1、manifest null
    await seed({ manifest: { briefVersion: null } })
    let report = await run()
    expect(byCheckId(report, 'STRUCT_VERSION_CHAIN')).toHaveLength(1)
    expect(report.passed).toBe(false)

    // 一致：磁盘 v1、manifest 1
    await seed()
    report = await run()
    expect(byCheckId(report, 'STRUCT_VERSION_CHAIN')).toEqual([])

    // 双 null：无立项单且 manifest null → 通过
    await seed({ withBrief: false })
    report = await run()
    expect(byCheckId(report, 'STRUCT_VERSION_CHAIN')).toEqual([])
  })

  it('CONSIST_GATE_PAYLOAD_VERSION：门版本 ≠ 候选版本命中；一致 / 无门 / 历史门跳过', async () => {
    const gate = (payload?: unknown): CanvasGate => ({
      gateId: '0-final', status: 'approved', question: '定案？', options: ['批准', '打回'], payload,
    })
    // 不一致
    await seed({ gates: [gate({ version: 2 })] })
    let report = await run(validSubject, 3)
    const hit = byCheckId(report, 'CONSIST_GATE_PAYLOAD_VERSION')
    expect(hit).toHaveLength(1)
    expect(hit[0]!.message).toContain('v2')
    expect(hit[0]!.message).toContain('v3')

    // 一致
    report = await run(validSubject, 2)
    expect(byCheckId(report, 'CONSIST_GATE_PAYLOAD_VERSION')).toEqual([])

    // 历史门无 payload.version → 保守跳过
    await seed({ gates: [gate(undefined)] })
    report = await run(validSubject, 9)
    expect(byCheckId(report, 'CONSIST_GATE_PAYLOAD_VERSION')).toEqual([])

    // 无门 → 跳过
    await seed()
    report = await run(validSubject, 9)
    expect(byCheckId(report, 'CONSIST_GATE_PAYLOAD_VERSION')).toEqual([])
  })

  it('CONSIST_MANIFEST_STAGE：无立项却越过立项阶段命中；正常瞬态不命中', async () => {
    // briefVersion=null 且 status 已推进 → 拦截
    await seed({ withBrief: false, manifest: { status: 'story-outline' } })
    let report = await run()
    const hits = byCheckId(report, 'CONSIST_MANIFEST_STAGE')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain('story-outline')

    // 正常瞬态：briefVersion=1 且 status=initiating（publish 写指针后、advance 前）→ 不查
    await seed()
    report = await run()
    expect(byCheckId(report, 'CONSIST_MANIFEST_STAGE')).toEqual([])
  })

  it('只读零写盘：校验前后 manifest / canvas / 立项单逐字不变', async () => {
    await seed({ gates: [{ gateId: '0-final', status: 'pending', question: '定案？', options: ['批准'], payload: { version: 1 } }] })
    const files = ['manifest.json', 'canvas.json', '立项单.v1.json']
    const before = await Promise.all(files.map(f => fsp.readFile(path.join(projDir, f), 'utf-8')))
    await run()
    const after = await Promise.all(files.map(f => fsp.readFile(path.join(projDir, f), 'utf-8')))
    expect(after).toEqual(before)
  })
})
