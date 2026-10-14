// feature-802 视觉风格谱系接入 · 装载层（契约 §4）
// 路径解析（仿 runtime/provider.ts resolveAgentTemplatePath）+ 读盘 + 注册表/md 交叉核对 + 模块级缓存。
import path from 'node:path'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import type { LoadedStyleCatalog, ParsedStyleEntry, StyleFamilyCode, StyleRole, StyleFeasibility } from './types.js'
import { STYLE_REGISTRY } from './catalog.js'
import { parseStyleCatalogMd, STYLE_CATALOG_PARSE_ERROR } from './parse-md.js'

export const STYLE_DIR_NAME = 'H3-Style'
export const STYLE_FILE_NAME = 'AI短剧制作视觉风格谱系.md'

export const STYLE_CATALOG_MISSING = 'STYLE_CATALOG_MISSING'
export const STYLE_CATALOG_DRIFT = 'STYLE_CATALOG_DRIFT'

const FAMILY_CODES: readonly StyleFamilyCode[] = ['A', 'B', 'C', 'D', 'E']

let cached: LoadedStyleCatalog | null = null

function styleError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

/**
 * 解析谱系 md 路径。
 * - 打包态：process.resourcesPath/H3-Style/<file>；
 * - 开发态双候选：electron/style/（vitest 直跑 ts）与 dist-electron/electron/style/（编译产物）上溯的仓库根。
 * 环境判据必须用 app.isPackaged（开发态 process.resourcesPath 同样存在）。
 */
export async function resolveStyleCatalogPath(): Promise<string> {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, STYLE_DIR_NAME, STYLE_FILE_NAME)
  }
  const here = path.dirname(fileURLToPath(import.meta.url))
  const devRoot = path.resolve(here, '..', '..') // <root>/electron/style → <root>
  const builtRoot = path.resolve(here, '..', '..', '..') // <root>/dist-electron/electron/style → <root>
  const candidates = [devRoot, builtRoot].map((root) =>
    path.join(root, 'resources', STYLE_DIR_NAME, STYLE_FILE_NAME),
  )
  for (const candidate of candidates) {
    try {
      await fsp.access(candidate)
      return candidate
    } catch {
      // 试下一个候选
    }
  }
  return candidates[0]! // 让读盘抛出带候选路径的 ENOENT
}

interface Diff {
  missing: string[]
  extra: string[]
  roleMismatch: string[]
  feasibilityMismatch: string[]
}

/** 注册表与 md 解析结果交叉核对：按家族名称集合 + role + feasibility */
function crossCheck(parsed: ParsedStyleEntry[]): Diff {
  const diff: Diff = { missing: [], extra: [], roleMismatch: [], feasibilityMismatch: [] }
  const parsedByFamily = new Map<StyleFamilyCode, ParsedStyleEntry[]>()
  for (const e of parsed) {
    const list = parsedByFamily.get(e.familyCode) ?? []
    list.push(e)
    parsedByFamily.set(e.familyCode, list)
  }

  for (const family of FAMILY_CODES) {
    const regEntries = STYLE_REGISTRY.filter((e) => e.familyCode === family)
    const mdEntries = parsedByFamily.get(family) ?? []
    const regByName = new Map(regEntries.map((e) => [e.name, e]))
    const mdByName = new Map(mdEntries.map((e) => [e.name, e]))

    for (const name of regByName.keys()) {
      if (!mdByName.has(name)) diff.missing.push(`${family} ${name}`)
    }
    for (const name of mdByName.keys()) {
      if (!regByName.has(name)) diff.extra.push(`${family} ${name}`)
    }
    for (const [name, md] of mdByName) {
      const reg = regByName.get(name)
      if (!reg) continue
      if (reg.role !== (md.role as StyleRole)) {
        diff.roleMismatch.push(`${reg.id} ${name}（注册表 ${reg.role} / md ${md.role}）`)
      }
      if (reg.feasibility !== (md.feasibility as StyleFeasibility)) {
        diff.feasibilityMismatch.push(`${reg.id} ${name}（注册表 ${reg.feasibility} / md ${md.feasibility}）`)
      }
    }
  }
  return diff
}

/** 装载谱系 md 并交叉核对；成功结果缓存，失败不缓存。force/clearStyleCatalogCache 强制重读 */
export async function loadStyleCatalog(force = false): Promise<LoadedStyleCatalog> {
  if (!force && cached) return cached

  const sourcePath = await resolveStyleCatalogPath()
  let text: string
  try {
    text = await fsp.readFile(sourcePath, 'utf-8')
  } catch (e) {
    throw styleError(
      STYLE_CATALOG_MISSING,
      `视觉风格谱系 md 读取失败（${sourcePath}）：${(e as Error).message}`,
    )
  }

  // parse-md 自身抛 STYLE_CATALOG_PARSE_ERROR，直接透传
  const { version, entries: parsed } = parseStyleCatalogMd(text)

  const diff = crossCheck(parsed)
  const problems: string[] = []
  if (diff.missing.length) problems.push(`注册表缺失: ${diff.missing.join('、')}`)
  if (diff.extra.length) problems.push(`md 多余: ${diff.extra.join('、')}`)
  if (diff.roleMismatch.length) problems.push(`主备不符: ${diff.roleMismatch.join('、')}`)
  if (diff.feasibilityMismatch.length) problems.push(`可行度不符: ${diff.feasibilityMismatch.join('、')}`)
  if (problems.length) {
    throw styleError(STYLE_CATALOG_DRIFT, `视觉风格谱系与代码注册表漂移：${problems.join('；')}`)
  }

  // 以注册表为骨架，按 familyCode + name 关联 md 明细
  const mdKey = new Map(parsed.map((e) => [`${e.familyCode}::${e.name}`, e]))
  const entries = STYLE_REGISTRY.map((reg) => {
    const md = mdKey.get(`${reg.familyCode}::${reg.name}`)
    if (!md) {
      // crossCheck 已保证可达，此处理论不可达
      throw styleError(STYLE_CATALOG_DRIFT, `视觉风格谱系合并失败：${reg.id} ${reg.name}`)
    }
    return {
      ...reg,
      visualTraits: md.visualTraits,
      anchorWords: md.anchorWords,
      textureRecipe: md.textureRecipe,
    }
  })

  const loaded: LoadedStyleCatalog = { version, sourcePath, entries }
  cached = loaded
  return loaded
}

export function clearStyleCatalogCache(): void {
  cached = null
}

// 供测试/工具层引用解析错误码（re-export，单一来源仍在 parse-md.ts）
export { STYLE_CATALOG_PARSE_ERROR }
