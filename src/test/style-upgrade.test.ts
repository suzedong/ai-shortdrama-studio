// feature-810 · 谱系升级差异工作流主进程单测（契约 §1 DTO / §2 通道 / §3 J.3 格式 / §6 测试契约）
// AC1–AC4：parseStyleChangelog 纯函数 + computeStyleUpgradeDiff（空态 / 引用现况比对 / changelog 区间与降级）
// + style:catalog DTO 形状 + style.catalogVersion 采纳闭环（契约 §2.3：采纳 = 仅升版本号，复用 updateBriefFields 直改通道）
// 夹具同 brief-update.test.ts（mkdtemp 项目 + writeSessionState + canvasStore.reset）；谱系用真实 md + readFile spy 分流
import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => holder.userData },
}))

import { loadStyleCatalog, clearStyleCatalogCache, STYLE_CATALOG_MISSING } from '../../electron/style/loader'
import { computeStyleUpgradeDiff, parseStyleChangelog } from '../../electron/style/upgrade'
import { updateBriefFields } from '../../electron/brief/update'
import { writeSessionState } from '../../electron/project/library'
import { canvasStore } from '../../electron/canvas/store'
import { MANIFEST_FILE } from '../../electron/project/manifest'
import type { Canvas, ProjectBrief, ProjectManifest } from '@shared/types'

const REAL_MD = path.join(process.cwd(), 'resources', 'H3-Style', 'AI短剧制作视觉风格谱系.md')

let realText = ''
/** 谱系 v1.47 模拟：真实 md 升版本行 + J.3 段内追写 v1.47 节（J.2 表不动 → DRIFT 交叉核对不触发） */
let mockV147 = ''
let projDir = ''

// readFile spy 分流：仅谱系 md 走 mock，其余路径（立项单/canvas/manifest）透传真实读盘
const origReadFile = fsp.readFile.bind(fsp)
function mockCatalogText(text: string): void {
  vi.spyOn(fsp, 'readFile').mockImplementation(((
    p: unknown, ...rest: unknown[]
  ) => (p === REAL_MD
    ? Promise.resolve(text)
    : (origReadFile as (...a: unknown[]) => Promise<unknown>)(p, ...rest))
  ) as unknown as typeof fsp.readFile)
}

function briefV1(style: ProjectBrief['style']): ProjectBrief {
  return {
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
    style,
    diagnosisDetail: '诊断明细基线',
    approve: { at: '2026-10-16T08:00:00.000Z', by: 'gate' },
    changesFromPrevious: [],
    publishedAt: '2026-10-16T08:00:00.000Z',
  }
}

/** 已立项项目：立项单.v1.json + manifest（briefVersion:1）+ canvas.json（step-1-scenes 血缘消费 style.catalogVersion） */
async function seedProject(style: ProjectBrief['style']): Promise<void> {
  const now = new Date().toISOString()
  await fsp.writeFile(path.join(projDir, '立项单.v1.json'), JSON.stringify(briefV1(style), null, 2), 'utf-8')
  const manifest: ProjectManifest = {
    status: 'initiating',
    createdAt: now,
    workflowVersion: 1,
    updatedAt: now,
    statusHistory: [],
    briefVersion: 1,
  }
  await fsp.writeFile(path.join(projDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf-8')
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
        parentReference: { briefVersion: 1, fields: ['style.catalogVersion'] },
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
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-style-upgrade-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project')
  realText = await fsp.readFile(REAL_MD, 'utf-8')
  // 版本行升 v1.47 + 在「## J.3 立项选择规则」前插入 v1.47 变更节（^ 行首锚定，不依赖行尾 → CRLF/LF 均安全）
  mockV147 = realText
    .replace(/本文版本：谱系\s*v1\.46/, '本文版本：谱系 v1.47')
    .replace(
      /^## J\.3 立项选择规则/m,
      '### v1.47（2026-10-19）\n\n- 新增风格两条\n- 锚点词微调\n\n## J.3 立项选择规则',
    )
})

beforeEach(async () => {
  vi.restoreAllMocks()
  clearStyleCatalogCache()
  await fsp.rm(projDir, { recursive: true, force: true })
  await fsp.mkdir(projDir, { recursive: true })
})

describe('feature-810 parseStyleChangelog（契约 §3，AC3）', () => {
  it('真实谱系 md：解析出 v1.46 单节（重号段「J.3 立项选择规则」不误入）', () => {
    expect(parseStyleChangelog(realText)).toEqual([
      { version: 'v1.46', date: '2026-10-08', items: ['（本版起设立变更记录段；此前版本无记录）'] },
    ])
  })

  it('合成多版本：全/半角括号 + 无日期节 + 空条目/前导空白条目 + NEXT_SECTION 截止', () => {
    const text = [
      '# 头部',
      '',
      '## J.3 谱系变更记录',
      '',
      '<!-- 注释行不入 -->',
      '### v1.47（2026-10-19）',
      '- 新增风格两条',
      '  - 条目乙（前导空白容忍）',
      '- ',
      '',
      '### v1.45 (2026-09-01)',
      '- 半角括号容忍',
      '',
      '### v1.44',
      '- 无日期节',
      '',
      '## J.3 立项选择规则（权威在规范）',
      '### v9.9（2099-01-01）',
      '- 段外不入',
    ].join('\n')
    expect(parseStyleChangelog(text)).toEqual([
      { version: 'v1.47', date: '2026-10-19', items: ['新增风格两条', '条目乙（前导空白容忍）'] },
      { version: 'v1.45', date: '2026-09-01', items: ['半角括号容忍'] },
      { version: 'v1.44', items: ['无日期节'] },
    ])
  })

  it('J.3 段缺失 → null', () => {
    expect(parseStyleChangelog('# 无变更记录段\n### v1.0\n- x\n')).toBeNull()
  })

  it('J.3 空段（零版本节）→ null', () => {
    expect(parseStyleChangelog('## J.3 谱系变更记录\n\n- 无版本节\n')).toBeNull()
  })

  it('「## J.3 谱系变更记录（旧）」全标题锚定：前缀不命中 → null', () => {
    expect(parseStyleChangelog('## J.3 谱系变更记录（旧）\n### v1.0\n- x\n')).toBeNull()
  })
})

describe('feature-810 空态（契约 §1 规则表，AC1）', () => {
  const NO_BRIEF = {
    hasUpgrade: false,
    currentVersion: 'v1.46',
    referenced: [],
    blocking: false,
    changelog: [],
    changelogUnavailable: false,
    noBrief: true,
  }

  it('projectDir=null → noBrief 空态', async () => {
    expect(await computeStyleUpgradeDiff(null)).toEqual(NO_BRIEF)
  })

  it('项目无立项单 → noBrief 空态', async () => {
    expect(await computeStyleUpgradeDiff(projDir)).toEqual(NO_BRIEF)
  })

  it('立项单坏 JSON → noBrief 空态（读取失败按空态，不抛错）', async () => {
    await fsp.writeFile(path.join(projDir, '立项单.v1.json'), '{broken', 'utf-8')
    expect(await computeStyleUpgradeDiff(projDir)).toEqual(NO_BRIEF)
  })

  it('立项单缺 mainStyleId → noBrief 空态', async () => {
    const brief = {
      ...briefV1({ mainStyleId: 'A7', catalogVersion: 'v1.45' }),
      style: { catalogVersion: 'v1.45' },
    }
    await fsp.writeFile(path.join(projDir, '立项单.v1.json'), JSON.stringify(brief, null, 2), 'utf-8')
    expect(await computeStyleUpgradeDiff(projDir)).toEqual(NO_BRIEF)
  })
})

describe('feature-810 引用条目现况比对（契约 §1，AC2）', () => {
  it('版本一致（主 A7 + 辅 B1）→ 无升级，referenced 两条完整现况', async () => {
    await seedProject({ mainStyleId: 'A7', auxiliaryStyleId: 'B1', catalogVersion: 'v1.46' })
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff).toEqual({
      hasUpgrade: false,
      currentVersion: 'v1.46',
      referenced: [
        {
          id: 'A7', role: 'main', removed: false,
          current: {
            role: 'main', auxiliaryCandidate: false, feasibility: 'high',
            anchorWords: ['realistic human-like anime', 'lifelike expression', 'cinematic（中文直译：仿真人动漫 / 拟真人）'],
          },
        },
        {
          id: 'B1', role: 'auxiliary', removed: false,
          current: {
            role: 'main', auxiliaryCandidate: true, feasibility: 'high',
            anchorWords: ['bright', 'low saturation', 'soft light', 'airy'],
          },
        },
      ],
      blocking: false,
      changelog: [],
      changelogUnavailable: false,
    })
    expect(diff.registeredVersion).toBeUndefined()
    expect(diff.noBrief).toBeUndefined()
  })

  it('无辅助风格 → referenced 仅主一条', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.46' })
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.referenced).toHaveLength(1)
    expect(diff.referenced[0]).toMatchObject({ id: 'A7', role: 'main', removed: false })
  })

  it('引用版本落后（v1.45 < v1.46）→ hasUpgrade + registeredVersion + 区间 changelog 含 v1.46 节', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.45' })
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.hasUpgrade).toBe(true)
    expect(diff.registeredVersion).toBe('v1.45')
    expect(diff.currentVersion).toBe('v1.46')
    expect(diff.blocking).toBe(false)
    expect(diff.changelog).toEqual([
      { version: 'v1.46', date: '2026-10-08', items: ['（本版起设立变更记录段；此前版本无记录）'] },
    ])
    expect(diff.changelogUnavailable).toBe(false)
  })

  it('引用 ID 已移除（主 ZZ + 辅 YY）→ removed 双条（无 current 键）+ blocking', async () => {
    await seedProject({ mainStyleId: 'ZZ', auxiliaryStyleId: 'YY', catalogVersion: 'v1.45' })
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.referenced).toEqual([
      { id: 'ZZ', role: 'main', removed: true },
      { id: 'YY', role: 'auxiliary', removed: true },
    ])
    expect(diff.blocking).toBe(true)
    expect(diff.changelog.map(e => e.version)).toEqual(['v1.46'])
  })
})

describe('feature-810 changelog 区间/降级（契约 §1/§3，AC3/AC4）', () => {
  it('区间过滤 (registered, current] 左开：v1.46 → v1.47 仅含 v1.47 节', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.46' })
    mockCatalogText(mockV147)
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.hasUpgrade).toBe(true)
    expect(diff.currentVersion).toBe('v1.47')
    expect(diff.registeredVersion).toBe('v1.46')
    expect(diff.changelog).toEqual([
      { version: 'v1.47', date: '2026-10-19', items: ['新增风格两条', '锚点词微调'] },
    ])
  })

  it('端点版本号不可解析 → 放行全部版本节（宁多勿缺）', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v-old' })
    mockCatalogText(mockV147)
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.hasUpgrade).toBe(true)
    expect(diff.changelog.map(e => e.version)).toEqual(['v1.46', 'v1.47'])
  })

  it('J.3 段缺失 → changelogUnavailable:true，差异主体不受影响', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.45' })
    mockCatalogText(realText.replace('## J.3 谱系变更记录', '## J.3 谱系变更旧录'))
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.hasUpgrade).toBe(true)
    expect(diff.changelog).toEqual([])
    expect(diff.changelogUnavailable).toBe(true)
    expect(diff.referenced[0]).toMatchObject({ id: 'A7', removed: false })
  })

  it('J.3 空段（版本节标题层级坏，#### 不匹配）→ changelogUnavailable:true', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.45' })
    mockCatalogText(realText.replace('### v1.46（2026-10-08）', '#### v1.46（2026-10-08）'))
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.hasUpgrade).toBe(true)
    expect(diff.changelog).toEqual([])
    expect(diff.changelogUnavailable).toBe(true)
  })

  it('changelog 读盘异常 → changelogUnavailable:true（loader 缓存命中不受影响）', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.45' })
    await loadStyleCatalog() // 先填缓存（真实文件）：loader 不再读盘，spy 仅狙 changelog 分支的 REAL_MD 读取
    vi.spyOn(fsp, 'readFile').mockImplementation(((
      p: unknown, ...rest: unknown[]
    ) => (p === REAL_MD
      ? Promise.reject(Object.assign(new Error('gone'), { code: 'EIO' }))
      : (origReadFile as (...a: unknown[]) => Promise<unknown>)(p, ...rest))
    ) as unknown as typeof fsp.readFile)
    const diff = await computeStyleUpgradeDiff(projDir)
    expect(diff.hasUpgrade).toBe(true)
    expect(diff.changelog).toEqual([])
    expect(diff.changelogUnavailable).toBe(true)
  })

  it('谱系装载失败 → 不降级直接抛 STYLE_CATALOG_MISSING', async () => {
    vi.spyOn(fsp, 'readFile').mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'ENOENT' }))
    await expect(computeStyleUpgradeDiff(projDir)).rejects.toMatchObject({ code: STYLE_CATALOG_MISSING })
  })
})

describe('feature-810 style:catalog DTO 形状（契约 §2.1，AC1）', () => {
  it('main.ts handle 映射 { version, count, entries }：18 条 + 条目恰 10 键 + anchorWords 为原文 string', async () => {
    const catalog = await loadStyleCatalog()
    // 与 electron/main.ts style:catalog handle 同形映射
    const dto = { version: catalog.version, count: catalog.entries.length, entries: catalog.entries }
    expect(dto.version).toBe('v1.46')
    expect(dto.count).toBe(18)
    expect(dto.entries).toHaveLength(18)
    expect(Object.keys(dto.entries[0]!).sort()).toEqual([
      'anchorWords', 'auxiliaryCandidate', 'familyCode', 'familyLabel', 'feasibility',
      'id', 'name', 'role', 'textureRecipe', 'visualTraits',
    ])
    expect(typeof dto.entries[0]!.anchorWords).toBe('string')
  })
})

describe('feature-810 style.catalogVersion 采纳闭环（契约 §2.3，AC6）', () => {
  it('采纳：升 catalogVersion → changes 记录 + 影响 high 恒 mark → 再 diff 转无升级', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.45' })
    const before = await computeStyleUpgradeDiff(projDir)
    expect(before.hasUpgrade).toBe(true)
    expect(before.registeredVersion).toBe('v1.45')

    const r = await updateBriefFields(projDir, { style: { catalogVersion: 'v1.46' } })
    expect(r.version).toBe(2)
    expect(r.changes).toEqual([
      { field: 'style.catalogVersion', from: 'v1.45', to: 'v1.46' },
    ])
    expect(r.items).toEqual([
      expect.objectContaining({
        nodeId: 'step-1-scenes', severity: 'high', defaultAction: 'regenerate',
        fields: ['style.catalogVersion'],
      }),
    ])
    const report = JSON.parse(await fsp.readFile(path.join(projDir, '影响清单.v1-v2.json'), 'utf-8'))
    expect(report.items).toEqual([
      expect.objectContaining({ nodeId: 'step-1-scenes', decision: 'mark' }),
    ])

    const after = await computeStyleUpgradeDiff(projDir)
    expect(after.hasUpgrade).toBe(false)
    expect(after.registeredVersion).toBeUndefined()
    expect(after.changelog).toEqual([])
  })

  it('采纳非法版本号（谱系无此版）→ BRIEF_NOT_READY，零写盘', async () => {
    await seedProject({ mainStyleId: 'A7', catalogVersion: 'v1.45' })
    const before = await fsp.readdir(projDir)
    await expect(
      updateBriefFields(projDir, { style: { catalogVersion: 'v1.99' } }),
    ).rejects.toMatchObject({ code: 'BRIEF_NOT_READY' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })
})
