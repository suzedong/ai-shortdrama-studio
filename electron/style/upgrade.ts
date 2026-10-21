// feature-810 谱系升级差异工作流 · 差异检测 + J.3 谱系变更记录解析（契约 §1 / §3）
// 差异双来源（设计说明 D1）：①引用条目现况比对（loader 装载结果可算）；②谱系 md J.3 段解析
// （独立 try，任何失败只置 changelogUnavailable，绝不影响 loader 既有装载与 DRIFT 交叉核对）。
// 采纳语义（D3）：仅升版本号，复用 brief:update（本文件只读不写）。
import fsp from 'node:fs/promises'
import { loadStyleCatalog } from './loader.js'
import type {
  LoadedStyleCatalog,
  StyleChangelogEntry,
  StyleUpgradeDiff,
  StyleUpgradeRefEntry,
} from './types.js'
import { readLatestBrief } from '../brief/plan.js'

// J.3 段标题须全行匹配：md 既有「## J.3 立项选择规则（权威在规范）」重号段（变更记录 T2 留痕），
// 前缀匹配会误中，故锚定全标题。
const CHANGELOG_HEADING = /^## J\.3 谱系变更记录\s*$/m
const NEXT_SECTION = /^## /m
// ### vX.Y（date）；date 括号可缺省，全角/半角括号均容忍（契约 §3）
const VERSION_SUBSECTION = /^###\s+(v\d+(?:\.\d+)*)\s*(?:[（(]\s*([^）)]*?)\s*[）)])?\s*$/

/** 解析谱系 md 的 J.3「谱系变更记录」段；段缺失或零版本节（空段/格式坏）返回 null（契约 §3） */
export function parseStyleChangelog(text: string): StyleChangelogEntry[] | null {
  const heading = CHANGELOG_HEADING.exec(text)
  if (!heading) return null
  const rest = text.slice(heading.index + heading[0].length)
  const next = NEXT_SECTION.exec(rest)
  const section = next ? rest.slice(0, next.index) : rest

  const entries: StyleChangelogEntry[] = []
  let current: StyleChangelogEntry | null = null
  for (const line of section.split(/\r?\n/)) {
    const sub = VERSION_SUBSECTION.exec(line)
    if (sub) {
      current = { version: sub[1]!, items: [] }
      if (sub[2]) current.date = sub[2]
      entries.push(current)
      continue
    }
    if (current && line.trimStart().startsWith('- ')) {
      const item = line.trimStart().slice(2).trim()
      if (item) current.items.push(item)
    }
  }
  return entries.length ? entries : null
}

/** 'v1.46' → [1, 46]；不可解析返回 null */
function parseVersionTuple(version: string): number[] | null {
  const m = /^v(\d+(?:\.\d+)*)$/.exec(version.trim())
  if (!m) return null
  return m[1]!.split('.').map(Number)
}

/** 数值元组比较（短位补 0）：a<b → -1；a=b → 0；a>b → 1 */
function compareTuple(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/** 区间 (registered, current] 过滤；任一端点不可解析时放行全部（宁多勿缺） */
function filterChangelogInterval(
  entries: StyleChangelogEntry[],
  registered: string,
  current: string,
): StyleChangelogEntry[] {
  const lo = parseVersionTuple(registered)
  const hi = parseVersionTuple(current)
  if (!lo || !hi) return entries
  return entries.filter((e) => {
    const v = parseVersionTuple(e.version)
    if (!v) return false
    return compareTuple(v, lo) > 0 && compareTuple(v, hi) <= 0
  })
}

/** 引用条目现况：按 ID 查当前谱系；查无 → removed */
function buildRefEntry(
  id: string,
  role: 'main' | 'auxiliary',
  catalog: LoadedStyleCatalog,
): StyleUpgradeRefEntry {
  const found = catalog.entries.find((e) => e.id === id)
  if (!found) return { id, role, removed: true }
  return {
    id,
    role,
    removed: false,
    current: {
      role: found.role,
      auxiliaryCandidate: found.auxiliaryCandidate,
      feasibility: found.feasibility,
      // J.2 锚点词原文按逗号/顿号切分，面板展示用（契约 §1）
      anchorWords: found.anchorWords.split(/[,，、]/).map((w) => w.trim()).filter(Boolean),
    },
  }
}

/** 未立项 / 无 style 字段空态（契约 §1 规则表） */
function noBriefDiff(currentVersion: string): StyleUpgradeDiff {
  return {
    hasUpgrade: false,
    currentVersion,
    referenced: [],
    blocking: false,
    changelog: [],
    changelogUnavailable: false,
    noBrief: true,
  }
}

/**
 * 谱系升级差异（style:upgrade-diff IPC 实现，契约 §1/§2.2）。
 * - projectDir=null / 立项单读取失败 / 无 style 字段 → noBrief 空态（不抛错）；
 * - 谱系装载失败（STYLE_CATALOG_MISSING / DRIFT / PARSE_ERROR）不降级，直接抛；
 * - hasUpgrade = catalogVersion 与当前谱系 version 逐字不等（同 STYLE_VERSION_MISMATCH 语义）。
 */
export async function computeStyleUpgradeDiff(projectDir: string | null): Promise<StyleUpgradeDiff> {
  const catalog = await loadStyleCatalog()
  if (!projectDir) return noBriefDiff(catalog.version)

  const brief = await readLatestBrief(projectDir).catch(() => null) // 读取失败按空态（契约 §1）
  const style = brief?.style
  const mainStyleId = style?.mainStyleId?.trim()
  const registered = style?.catalogVersion?.trim()
  if (!mainStyleId || !registered) return noBriefDiff(catalog.version)

  const hasUpgrade = registered !== catalog.version
  const referenced: StyleUpgradeRefEntry[] = [buildRefEntry(mainStyleId, 'main', catalog)]
  const auxId = style?.auxiliaryStyleId?.trim()
  if (auxId) referenced.push(buildRefEntry(auxId, 'auxiliary', catalog))
  const blocking = referenced.some((r) => r.removed)

  let changelog: StyleChangelogEntry[] = []
  let changelogUnavailable = false
  if (hasUpgrade) {
    try {
      const text = await fsp.readFile(catalog.sourcePath, 'utf-8')
      const parsed = parseStyleChangelog(text)
      if (parsed) {
        changelog = filterChangelogInterval(parsed, registered, catalog.version)
      } else {
        changelogUnavailable = true
      }
    } catch {
      changelogUnavailable = true
    }
  }

  return {
    hasUpgrade,
    ...(hasUpgrade ? { registeredVersion: registered } : {}),
    currentVersion: catalog.version,
    referenced,
    blocking,
    changelog,
    changelogUnavailable,
  }
}
