// feature-001 立项模型重建 · 立项就绪校验 + 版本扫描（契约 §2 / §3.1 / §3.3 / §8）
// 纯校验逻辑（evaluateDraft）与磁盘 IO（项目根一层 立项单.vN.json）分离，便于单测。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type {
  BriefDraft, BriefMissing, BriefPlan, ProjectBrief, ProjectKind,
} from '../../shared/types.js'
import { diffBrief } from './diff.js'
import type { LoadedStyleCatalog, StyleIssue } from '../style/types.js'
import { validateStyleRefs } from '../style/validate.js'

const PENDING = '待定'

const ELEMENT_LABELS: ReadonlyArray<{ key: keyof ProjectBrief['fiveElements']; label: string; array?: boolean }> = [
  { key: 'genre', label: '题材赛道' },
  { key: 'platforms', label: '目标平台', array: true },
  { key: 'episodeDuration', label: '单集时长' },
  { key: 'episodeCount', label: '集数' },
  { key: 'tone', label: '风格基调' },
  { key: 'aspectRatio', label: '画幅' },
]

const PREMISE_LABELS: ReadonlyArray<{ key: keyof ProjectBrief['premise']; label: string }> = [
  { key: 'leads', label: '人物' },
  { key: 'time', label: '时间' },
  { key: 'place', label: '地点' },
  { key: 'coreEvent', label: '核心事件' },
  { key: 'seasonBoundary', label: '本季边界' },
]

function isEmpty(value: unknown, array: boolean): boolean {
  if (array) return !Array.isArray(value) || value.length === 0
  return typeof value !== 'string' || value.trim() === ''
}

/**
 * 就绪校验（不读磁盘）：
 * - 空串 / 空数组记缺失；字符串「待定」合法但进 pendingMarks。
 * - style 非空由 MAIN_STYLE_MISSING 负责；注入谱系 catalog（feature-802）时追加 styleIssues
 *   （ID 闭集 / 版本一致 / 辅助候选封闭域），不注入则恒为 []，行为与旧版逐字一致。
 */
export function evaluateDraft(
  draft: BriefDraft,
  catalog?: LoadedStyleCatalog,
): { missing: BriefMissing[]; pendingMarks: string[]; styleIssues: StyleIssue[] } {
  const missing: BriefMissing[] = []
  const pendingMarks: string[] = []

  if (!draft.kind) {
    missing.push({ code: 'KIND_MISSING', field: 'kind', message: '尚未确认项目性质（商业短剧 / 个人纪念）' })
  }

  for (const { key, label, array } of ELEMENT_LABELS) {
    const field = `fiveElements.${key}`
    const value = draft.fiveElements[key]
    if (isEmpty(value, !!array)) {
      missing.push({ code: 'ELEMENT_MISSING', field, message: `立项六要素缺少「${label}」` })
    } else if (!array && (value as string).trim() === PENDING) {
      pendingMarks.push(field)
    }
  }

  for (const { key, label } of PREMISE_LABELS) {
    const field = `premise.${key}`
    const value = draft.premise[key]
    if (isEmpty(value, false)) {
      missing.push({ code: 'PREMISE_MISSING', field, message: `故事前提缺少「${label}」` })
    } else if ((value as string).trim() === PENDING) {
      pendingMarks.push(field)
    }
  }

  if (!draft.style.mainStyleId?.trim() || !draft.style.catalogVersion?.trim()) {
    missing.push({ code: 'MAIN_STYLE_MISSING', field: 'style.mainStyleId', message: '缺少主视觉风格 ID 或谱系版本' })
  }

  const styleIssues = catalog ? validateStyleRefs(draft.style ?? {}, catalog) : []

  return { missing, pendingMarks, styleIssues }
}

/** 扫描项目根一层 立项单.vN.json；损坏文件跳过并在 warnings 注明，按 N 升序返回 */
export async function listBriefVersions(projectDir: string): Promise<{
  versions: { version: number; path: string; publishedAt: string; kind: ProjectKind; approveBy: 'gate' | 'verbal' }[]
  latestVersion: number | null
  warnings: string[]
}> {
  const warnings: string[] = []
  let names: string[]
  try {
    names = await fsp.readdir(projectDir)
  } catch {
    return { versions: [], latestVersion: null, warnings }
  }

  const found: { version: number; path: string; publishedAt: string; kind: ProjectKind; approveBy: 'gate' | 'verbal' }[] = []
  for (const name of names) {
    const m = /^立项单\.v(\d+)\.json$/.exec(name)
    if (!m) continue
    const version = Number(m[1])
    try {
      const obj = JSON.parse(await fsp.readFile(path.join(projectDir, name), 'utf-8')) as ProjectBrief
      found.push({
        version,
        path: name,
        publishedAt: obj.publishedAt,
        kind: obj.kind,
        approveBy: obj.approve.by,
      })
    } catch (e) {
      warnings.push(`${name} 解析失败已跳过：${(e as Error).message}`)
    }
  }
  found.sort((a, b) => a.version - b.version)
  return { versions: found, latestVersion: found.length ? found[found.length - 1]!.version : null, warnings }
}

/** 读取最新版立项单；无历史返回 null；损坏文件抛错 */
export async function readLatestBrief(projectDir: string): Promise<ProjectBrief | null> {
  const { versions } = await listBriefVersions(projectDir)
  const latest = versions[versions.length - 1]
  if (!latest) return null
  return JSON.parse(await fsp.readFile(path.join(projectDir, latest.path), 'utf-8')) as ProjectBrief
}

/** 下一版号：磁盘 max(N)+1；无历史为 1 */
export async function nextBriefVersion(projectDir: string): Promise<number> {
  const { latestVersion } = await listBriefVersions(projectDir)
  return latestVersion === null ? 1 : latestVersion + 1
}

/** brief.plan 全流程（只读）：校验 + diff 磁盘最新版 */
export async function planBrief(projectDir: string, draft: BriefDraft): Promise<BriefPlan> {
  const { missing, pendingMarks } = evaluateDraft(draft)
  const listing = await listBriefVersions(projectDir)
  const latest = listing.versions[listing.versions.length - 1]
  const prev = latest
    ? JSON.parse(await fsp.readFile(path.join(projectDir, latest.path), 'utf-8')) as ProjectBrief
    : null
  return {
    ready: missing.length === 0,
    missing,
    pendingMarks,
    nextVersion: listing.latestVersion === null ? 1 : listing.latestVersion + 1,
    changesFromPrevious: diffBrief(prev, draft),
    latestVersion: listing.latestVersion,
  }
}
