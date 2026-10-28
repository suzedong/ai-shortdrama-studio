import { describe, expect, it, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'
import type { BriefDraft, ProjectBrief } from '@shared/types'
import { diffBrief } from '../../../electron/brief/diff'
import { evaluateDraft, listBriefVersions, planBrief } from '../../../electron/brief/plan'
import { renderBriefMd } from '../../../electron/brief/render-md'
import type { LoadedStyleCatalog } from '../../../electron/style/types'

function fullBrief(version: number, overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    schemaVersion: 2,
    version,
    kind: 'commercial',
    fiveElements: {
      genre: '甜宠',
      platforms: ['抖音', '红果'],
      episodeDuration: '90 秒',
      episodeCount: '80 集',
      tone: '高甜',
      aspectRatio: '竖屏 9:16',
    },
    premise: {
      leads: '28 岁女白领 / 30 岁男医生',
      time: '2024 年',
      place: '上海',
      coreEvent: '医院重逢',
      seasonBoundary: '第一季只讲相识',
    },
    style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
    diagnosisSummary: '赛道可行',
    approve: { at: '2026-10-13T10:00:00.000Z', by: 'gate' },
    changesFromPrevious: [],
    publishedAt: '2026-10-13T10:00:00.000Z',
    ...overrides,
  }
}

function fullDraft(overrides: Partial<BriefDraft> = {}): BriefDraft {
  const b = fullBrief(1)
  return {
    kind: b.kind,
    fiveElements: { ...b.fiveElements },
    premise: { ...b.premise },
    style: { ...b.style },
    diagnosisSummary: b.diagnosisSummary,
    ...overrides,
  }
}

describe('diffBrief（契约 §5）', () => {
  it('prev 为 null（首版）返回 []', () => {
    expect(diffBrief(null, fullDraft())).toEqual([])
  })

  it('逐字段生成 from/to；未变字段不出现', () => {
    const prev = fullBrief(1)
    const draft = fullDraft({
      fiveElements: { ...fullBrief(1).fiveElements, episodeCount: '100 集' },
    })
    const changes = diffBrief(prev, draft)
    expect(changes).toEqual([{ field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' }])
  })

  it('platforms 排序后比较，顺序不同不算改动', () => {
    const prev = fullBrief(1)
    const draft = fullDraft({
      fiveElements: { ...fullBrief(1).fiveElements, platforms: ['红果', '抖音'] },
    })
    expect(diffBrief(prev, draft)).toEqual([])
  })

  it('feature-013：l0.tags / l0.notes 命名空间命中；draft 未给 l0 不参与比较（存量兼容防伪 diff）', () => {
    const prev = fullBrief(1, { l0: { tags: ['beta', 'alpha'], notes: '旧备注' } })
    // 未提交 l0（Agent 通道 / 未改字段）→ 沿用上一版，零伪 diff
    expect(diffBrief(prev, fullDraft())).toEqual([])
    // 标签数组按整体值比对（排序后顿号连接，口径同 platforms）
    expect(diffBrief(prev, fullDraft({ l0: { tags: ['alpha', 'gamma'], notes: '旧备注' } }))).toEqual([
      { field: 'l0.tags', from: 'alpha、beta', to: 'alpha、gamma' },
    ])
    expect(diffBrief(prev, fullDraft({ l0: { tags: ['beta', 'alpha'], notes: '新备注' } }))).toEqual([
      { field: 'l0.notes', from: '旧备注', to: '新备注' },
    ])
    // 显式清空（tags:[] / notes:''）→ 记删除
    expect(diffBrief(prev, fullDraft({ l0: {} })).map(c => c.field)).toEqual(['l0.tags', 'l0.notes'])
  })

  it('kind / premise / style / diagnosis 摘要与明细变更均被捕获', () => {
    const prev = fullBrief(1)
    const draft = fullDraft({
      kind: 'memorial',
      premise: { ...fullBrief(1).premise, place: '北京' },
      style: { mainStyleId: 'B2', catalogVersion: 'v1.46', auxiliaryStyleId: 'C1' },
      diagnosisSummary: '新结论',
      diagnosisDetail: '新明细', // D-018：prev 无明细 → from 空串
    })
    const fields = diffBrief(prev, draft).map(c => c.field)
    expect(fields).toEqual(
      expect.arrayContaining(['kind', 'premise.place', 'style.mainStyleId', 'style.auxiliaryStyleId', 'diagnosisSummary', 'diagnosisDetail']),
    )
    expect(fields).not.toContain('style.catalogVersion')
  })
})

describe('evaluateDraft 就绪校验（契约 §2）', () => {
  it('空草案：四类缺失码齐全，按字段逐项列出', () => {
    const { missing, pendingMarks } = evaluateDraft({
      kind: null, fiveElements: {}, premise: {}, style: {},
    })
    const codes = missing.map(m => m.code)
    expect(codes).toContain('KIND_MISSING')
    expect(codes).toContain('MAIN_STYLE_MISSING')
    expect(missing.filter(m => m.code === 'ELEMENT_MISSING')).toHaveLength(6)
    expect(missing.filter(m => m.code === 'PREMISE_MISSING')).toHaveLength(5)
    expect(pendingMarks).toEqual([])
  })

  it('完整草案就绪；platforms 空数组判缺', () => {
    expect(evaluateDraft(fullDraft()).missing).toEqual([])
    const r = evaluateDraft(fullDraft({ fiveElements: { ...fullBrief(1).fiveElements, platforms: [] } }))
    expect(r.missing).toContainEqual(expect.objectContaining({
      code: 'ELEMENT_MISSING', field: 'fiveElements.platforms',
    }))
  })

  it('「待定」合法但进 pendingMarks，不阻塞就绪', () => {
    const draft = fullDraft({
      fiveElements: { ...fullBrief(1).fiveElements, episodeCount: '待定' },
      premise: { ...fullBrief(1).premise, time: '待定' },
    })
    const { missing, pendingMarks } = evaluateDraft(draft)
    expect(missing).toEqual([])
    expect(pendingMarks).toEqual(['fiveElements.episodeCount', 'premise.time'])
  })

  it('catalogVersion 缺失 → MAIN_STYLE_MISSING', () => {
    const r = evaluateDraft(fullDraft({ style: { mainStyleId: 'A7' } }))
    expect(r.missing).toContainEqual(expect.objectContaining({ code: 'MAIN_STYLE_MISSING' }))
  })
})

describe('evaluateDraft 谱系注入 styleIssues（feature-802 契约 §5）', () => {
  // 构造 catalog：闭集 A7/B1/D1；辅助候选 D1；版本 v9.9（纯函数层构造，不经 loader）
  function makeCatalog(): LoadedStyleCatalog {
    const mk = (
      id: string, name: string, familyCode: 'A' | 'B' | 'C' | 'D' | 'E',
      role: 'main' | 'backup', auxiliaryCandidate: boolean,
    ) => ({
      id, name, familyCode, familyLabel: `${familyCode} 系`, role,
      feasibility: 'high' as const, auxiliaryCandidate,
      visualTraits: 't', anchorWords: 'a', textureRecipe: 'r',
    })
    return {
      version: 'v9.9', sourcePath: 'mem',
      entries: [mk('A7', '拟真人', 'A', 'main', false), mk('B1', '清新', 'B', 'main', true), mk('D1', '悬疑', 'D', 'backup', true)],
    }
  }

  it('无注入：返回 styleIssues 键且为空（既有行为不破坏）', () => {
    expect(evaluateDraft(fullDraft()).styleIssues).toEqual([])
  })

  it('合法 A7@v9.9 + 辅助 D1：styleIssues=[]', () => {
    const catalog = makeCatalog()
    const r = evaluateDraft(
      fullDraft({ style: { mainStyleId: 'A7', catalogVersion: 'v9.9', auxiliaryStyleId: 'D1' } }),
      catalog,
    )
    expect(r.styleIssues).toEqual([])
  })

  it('未知主 ID / 错版本 / 辅助越域产出 styleIssues，ready 判定受其阻塞', () => {
    const catalog = makeCatalog()
    const r = evaluateDraft(
      fullDraft({ style: { mainStyleId: 'ZZ9', catalogVersion: 'v1.46', auxiliaryStyleId: 'A7' } }),
      catalog,
    )
    expect(r.styleIssues.map(i => i.code)).toEqual([
      'STYLE_ID_UNKNOWN', 'STYLE_VERSION_MISMATCH', 'STYLE_AUX_NOT_CANDIDATE',
    ])
    expect(r.styleIssues.map(i => i.field)).toEqual([
      'style.mainStyleId', 'style.catalogVersion', 'style.auxiliaryStyleId',
    ])
    expect(r.missing).toEqual([])
  })
})

let tmpRoot = ''

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-brief-'))
})

describe('版本扫描与 planBrief（契约 §3.1/§3.3/§8）', () => {
  it('空目录：latestVersion=null、无 warnings；非匹配文件名忽略', async () => {
    const dir = path.join(tmpRoot, 'empty')
    await fsp.mkdir(dir, { recursive: true })
    await fsp.writeFile(path.join(dir, '故事背景档案.md'), '#')
    await fsp.writeFile(path.join(dir, 'brief.json'), '{}')
    const r = await listBriefVersions(dir)
    expect(r.versions).toEqual([])
    expect(r.latestVersion).toBeNull()
    expect(r.warnings).toEqual([])
  })

  it('按 N 升序解析；损坏文件跳过并 warning；plan 给出 nextVersion 与 diff', async () => {
    const dir = path.join(tmpRoot, 'proj-a')
    await fsp.mkdir(dir, { recursive: true })
    await fsp.writeFile(path.join(dir, '立项单.v1.json'), JSON.stringify(fullBrief(1)))
    await fsp.writeFile(path.join(dir, '立项单.v3.json'), JSON.stringify(fullBrief(3, { kind: 'memorial', approve: { at: 'x', by: 'verbal', verbal: { quote: '就这样' } } })))
    await fsp.writeFile(path.join(dir, '立项单.v2.json'), '{坏 json')

    const r = await listBriefVersions(dir)
    expect(r.versions.map(v => v.version)).toEqual([1, 3])
    expect(r.latestVersion).toBe(3)
    expect(r.versions[1]).toMatchObject({ kind: 'memorial', approveBy: 'verbal', path: '立项单.v3.json' })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('立项单.v2.json')

    const plan = await planBrief(dir, fullDraft({ kind: 'commercial' }))
    expect(plan.ready).toBe(true)
    expect(plan.nextVersion).toBe(4)
    expect(plan.latestVersion).toBe(3)
    expect(plan.changesFromPrevious).toContainEqual(
      expect.objectContaining({ field: 'kind', from: 'memorial', to: 'commercial' }),
    )
  })
})

describe('renderBriefMd（契约 §4）', () => {
  it('v1 门内拍板：区块齐全、首版立项、辅助无、顿号连接平台', () => {
    const md = renderBriefMd(fullBrief(1))
    expect(md).toContain('# 立项单 v1')
    expect(md).toContain('拍板方式：门内拍板')
    expect(md).toContain('商业短剧')
    expect(md).toContain('- 目标平台：抖音、红果')
    expect(md).toContain('- 主风格：A7 @ v1.46')
    expect(md).toContain('- 辅助气氛：无')
    expect(md).toContain('## 选题诊断结论\n赛道可行')
    // D-018：无明细时区块恒渲染、写（无）
    expect(md).toContain('## 选题诊断明细\n（无）')
    expect(md).toContain('首版立项')
  })

  it('v2 口头拍板：引用原话并列出改动', () => {
    const md = renderBriefMd(fullBrief(2, {
      approve: { at: 'x', by: 'verbal', verbal: { quote: '行，开始讲故事吧' } },
      changesFromPrevious: [{ field: 'premise.place', from: '上海', to: '北京' }],
    }))
    expect(md).toContain('拍板方式：口头拍板（“行，开始讲故事吧”）')
    expect(md).toContain('- premise.place：上海 → 北京')
    expect(md).not.toContain('首版立项')
  })

  it('无诊断摘要写（无）', () => {
    const md = renderBriefMd(fullBrief(1, { diagnosisSummary: undefined }))
    expect(md).toContain('（无）')
  })

  it('D-018：诊断明细原样渲染（多行保留）', () => {
    const md = renderBriefMd(fullBrief(1, { diagnosisDetail: '第一行\n第二行' }))
    expect(md).toContain('## 选题诊断明细\n第一行\n第二行')
  })

  it('feature-013：L0 标签/备注有值渲染头部区块（位于项目性质前），无值不渲染', () => {
    const md = renderBriefMd(fullBrief(1, { l0: { tags: ['招商', '校园'], notes: '片头 5 秒立钩' } }))
    expect(md).toContain('## 项目标签与备注')
    expect(md).toContain('- 标签：招商、校园')
    expect(md).toContain('- 备注：片头 5 秒立钩')
    expect(md.indexOf('## 项目标签与备注')).toBeLessThan(md.indexOf('## 项目性质'))
    // 仅有备注：不渲染空标签行；无 L0：整块不出现
    const onlyNotes = renderBriefMd(fullBrief(1, { l0: { notes: '只有备注' } }))
    expect(onlyNotes).toContain('- 备注：只有备注')
    expect(onlyNotes).not.toContain('- 标签：')
    expect(renderBriefMd(fullBrief(1))).not.toContain('## 项目标签与备注')
  })
})
