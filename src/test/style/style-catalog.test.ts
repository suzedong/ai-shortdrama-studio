import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'

// loader 经 electron app.isPackaged 判环境；vitest 下显式 mock 为开发态
vi.mock('electron', () => ({ app: { isPackaged: false } }))

import {
  STYLE_REGISTRY, CATALOG_IDS, AUXILIARY_CANDIDATE_IDS,
  isKnownStyleId, isAuxiliaryCandidate, getRegisteredEntry,
} from '../../../electron/style/catalog'
import { parseStyleCatalogMd, STYLE_CATALOG_PARSE_ERROR } from '../../../electron/style/parse-md'
import {
  loadStyleCatalog, clearStyleCatalogCache, resolveStyleCatalogPath,
  STYLE_CATALOG_MISSING, STYLE_CATALOG_DRIFT,
} from '../../../electron/style/loader'
import { validateStyleRefs } from '../../../electron/style/validate'

const REAL_MD = path.join(process.cwd(), 'resources', 'H3-Style', 'AI短剧制作视觉风格谱系.md')

let realText: string

beforeAll(async () => {
  realText = await fsp.readFile(REAL_MD, 'utf-8')
})

beforeEach(() => {
  clearStyleCatalogCache()
  vi.restoreAllMocks()
})

describe('feature-802 ID 注册表（契约 §2）', () => {
  it('18 条；ID 闭集逐字相等；A6/C3/C4 不存在', () => {
    expect(STYLE_REGISTRY).toHaveLength(18)
    expect([...CATALOG_IDS]).toEqual([
      'A1', 'A2', 'A3', 'A4', 'A5', 'A7',
      'B1',
      'C1', 'C2', 'C5', 'C6', 'C7',
      'D1', 'D2', 'D3', 'D4', 'D5',
      'E1',
    ])
    for (const gone of ['A6', 'C3', 'C4']) {
      expect(isKnownStyleId(gone)).toBe(false)
    }
  })

  it('主 11 / 备 7 / 家族 5；辅助候选恰为 B1+D1–D5 共 6 项', () => {
    expect(STYLE_REGISTRY.filter(e => e.role === 'main')).toHaveLength(11)
    expect(STYLE_REGISTRY.filter(e => e.role === 'backup')).toHaveLength(7)
    expect(new Set(STYLE_REGISTRY.map(e => e.familyCode)).size).toBe(5)
    expect([...AUXILIARY_CANDIDATE_IDS]).toEqual(['B1', 'D1', 'D2', 'D3', 'D4', 'D5'])
    for (const e of STYLE_REGISTRY) {
      expect(e.auxiliaryCandidate).toBe(AUXILIARY_CANDIDATE_IDS.includes(e.id))
    }
  })

  it('E1 为 medium，其余 high；familyLabel 逐字', () => {
    expect(getRegisteredEntry('E1')!.feasibility).toBe('medium')
    expect(STYLE_REGISTRY.filter(e => e.id !== 'E1').every(e => e.feasibility === 'high')).toBe(true)
    expect(getRegisteredEntry('A7')).toMatchObject({ name: '拟真人·仿真人动漫', familyLabel: '写实影像系' })
  })

  it('isKnownStyleId / isAuxiliaryCandidate / getRegisteredEntry 正反例', () => {
    expect(isKnownStyleId('A7')).toBe(true)
    expect(isKnownStyleId('ZZ9')).toBe(false)
    expect(isAuxiliaryCandidate('D1')).toBe(true)
    expect(isAuxiliaryCandidate('A7')).toBe(false)
    expect(getRegisteredEntry('B1')!.auxiliaryCandidate).toBe(true)
    expect(getRegisteredEntry('ZZ9')).toBeUndefined()
  })
})

describe('feature-802 真实谱系 md 解析（契约 §3，AC7）', () => {
  it('版本 v1.46、18 条、家族行数 6/1/5/5/1', () => {
    const { version, entries } = parseStyleCatalogMd(realText)
    expect(version).toBe('v1.46')
    expect(entries).toHaveLength(18)
    const count = (c: string) => entries.filter(e => e.familyCode === c).length
    expect([count('A'), count('B'), count('C'), count('D'), count('E')]).toEqual([6, 1, 5, 5, 1])
  })

  it('A3 无空格尾标命中；主备与注册表一致；明细三列非空', () => {
    const { entries } = parseStyleCatalogMd(realText)
    const a3 = entries.find(e => e.familyCode === 'A' && e.name === '年代胶片（千禧·90s·80s）')!
    expect(a3.role).toBe('backup')
    for (const e of entries) {
      expect(e.visualTraits.trim()).not.toBe('')
      expect(e.anchorWords.trim()).not.toBe('')
      expect(e.textureRecipe.trim()).not.toBe('')
    }
    const byName = new Map(entries.map(e => [`${e.familyCode}::${e.name}`, e]))
    for (const reg of STYLE_REGISTRY) {
      const md = byName.get(`${reg.familyCode}::${reg.name}`)
      expect(md, `${reg.id} ${reg.name}`).toBeDefined()
      expect(md!.role).toBe(reg.role)
      expect(md!.feasibility).toBe(reg.feasibility)
    }
  })
})

describe('feature-802 md 解析异常 → STYLE_CATALOG_PARSE_ERROR（契约 §3/§9）', () => {
  function expectParseError(text: string, clue: string) {
    expect(() => parseStyleCatalogMd(text), clue).toThrowError(
      expect.objectContaining({ code: STYLE_CATALOG_PARSE_ERROR }),
    )
  }

  it('缺版本行', () => {
    expectParseError(realText.replace(/本文版本：谱系\s*v\d+\.\d+/, '本文版本：（待补）'), '版本')
  })

  it('缺某家族表头', () => {
    // J.2 表头写作「**E 材质工艺系（…）**」，J.1 总览为「**E 材质工艺系**（…）」，以前者定位
    expectParseError(realText.replace('**E 材质工艺系（', '**X 未知工艺系（'), 'E 表头')
  })

  it('坏行（列数不符）', () => {
    const bad = realText.replace(
      '| 清新生活流「主」 |',
      '| 清新生活流「主」 | 只有两列 |',
    )
    expectParseError(bad, 'B 表坏行')
  })

  it('未知可行度标记', () => {
    // 仅替换 E1 行末的 ●中（J.4 不含 ●中，替换点唯一）
    const idx = realText.lastIndexOf('●中')
    const bad = `${realText.slice(0, idx)}●?${realText.slice(idx + 2)}`
    expectParseError(bad, '可行度')
  })

  it('行数 ≠18（删掉 E1 数据行）', () => {
    const bad = realText.replace(/^\| 3D CG「主」 \|.*$/m, '')
    expectParseError(bad, 'E 表 0 行')
  })

  it('名称无主备标注', () => {
    expectParseError(realText.replace('| 3D CG「主」 |', '| 3D CG |'), '尾标')
  })
})

describe('feature-802 loader 装载/缓存/异常（契约 §4）', () => {
  it('开发态路径命中真实文件，装载 18 条并带版本/路径', async () => {
    const p = await resolveStyleCatalogPath()
    expect(p).toBe(REAL_MD)
    const catalog = await loadStyleCatalog()
    expect(catalog.version).toBe('v1.46')
    expect(catalog.entries).toHaveLength(18)
    expect(catalog.sourcePath).toBe(REAL_MD)
    expect(catalog.entries.find(e => e.id === 'A7')!.anchorWords).toContain('realistic human-like anime')
  })

  it('二次调用命中缓存（readFile 只 1 次）；force/clear 后重读', async () => {
    const spy = vi.spyOn(fsp, 'readFile')
    await loadStyleCatalog()
    await loadStyleCatalog()
    expect(spy).toHaveBeenCalledTimes(1)
    await loadStyleCatalog(true)
    expect(spy).toHaveBeenCalledTimes(2)
    clearStyleCatalogCache()
    await loadStyleCatalog()
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('读盘失败 → STYLE_CATALOG_MISSING 且不缓存', async () => {
    vi.spyOn(fsp, 'readFile').mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    await expect(loadStyleCatalog(true)).rejects.toMatchObject({ code: STYLE_CATALOG_MISSING })
    // 失败不写缓存：下一次调用重新读盘（真实文件成功）
    const catalog = await loadStyleCatalog()
    expect(catalog.entries).toHaveLength(18)
  })

  it('注册表与 md 漂移 → STYLE_CATALOG_DRIFT（md 改名 E1）', async () => {
    const drifted = realText.replace('| 3D CG「主」 |', '| 捏他CG「主」 |')
    vi.spyOn(fsp, 'readFile').mockResolvedValueOnce(drifted)
    await expect(loadStyleCatalog(true)).rejects.toMatchObject({ code: STYLE_CATALOG_DRIFT })
  })

  it('主备标注漂移 → STYLE_CATALOG_DRIFT（E1 主改备）', async () => {
    const drifted = realText.replace('| 3D CG「主」 |', '| 3D CG「备」 |')
    vi.spyOn(fsp, 'readFile').mockResolvedValueOnce(drifted)
    const e = (await loadStyleCatalog(true).catch(err => err)) as Error & { code: string }
    expect(e.code).toBe(STYLE_CATALOG_DRIFT)
    expect(e.message).toContain('E1')
  })
})

describe('feature-802 validateStyleRefs（契约 §5.1）', () => {
  async function realCatalog() {
    clearStyleCatalogCache()
    return loadStyleCatalog()
  }

  it('合法 A7@v1.46 + 辅助 D1 无 issue；空参无 issue', async () => {
    const catalog = await realCatalog()
    expect(validateStyleRefs({ mainStyleId: 'A7', catalogVersion: 'v1.46', auxiliaryStyleId: 'D1' }, catalog)).toEqual([])
    expect(validateStyleRefs({}, catalog)).toEqual([])
  })

  it('未知主 ID / 错版本 / 辅助越域各产对应 issue', async () => {
    const catalog = await realCatalog()
    const issues = validateStyleRefs({ mainStyleId: 'ZZ9', catalogVersion: 'v1.45', auxiliaryStyleId: 'A1' }, catalog)
    expect(issues.map(i => i.code)).toEqual([
      'STYLE_ID_UNKNOWN', 'STYLE_VERSION_MISMATCH', 'STYLE_AUX_NOT_CANDIDATE',
    ])
    expect(issues.map(i => i.field)).toEqual([
      'style.mainStyleId', 'style.catalogVersion', 'style.auxiliaryStyleId',
    ])
  })

  it('备风格可作主风格；主辅同 ID 不额外报错', async () => {
    const catalog = await realCatalog()
    expect(validateStyleRefs({ mainStyleId: 'A5', catalogVersion: 'v1.46' }, catalog)).toEqual([])
    expect(validateStyleRefs({ mainStyleId: 'D1', catalogVersion: 'v1.46', auxiliaryStyleId: 'D1' }, catalog)).toEqual([])
  })

  it('空白字段不校验（非空归 MAIN_STYLE_MISSING）', async () => {
    const catalog = await realCatalog()
    expect(validateStyleRefs({ mainStyleId: '   ', catalogVersion: '' }, catalog)).toEqual([])
  })
})
