// feature-004 · 立项单历史列表读 + 单版全文与 diffToLatest（契约 §2.1 brief:history / §2.2 brief:version-read）
// 复用零 diff：扫描底座 listBriefVersions（plan.ts）、字段级 diffBrief（diff.ts），本文件只做逐版全文提取与组装。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type { BriefChange, ProjectBrief, ProjectKind } from '../../shared/types.js'
import { diffBrief } from './diff.js'
import { listBriefVersions } from './plan.js'

export interface BriefHistoryItem {
  version: number
  path: string // 立项单.vN.json（项目根相对）
  publishedAt: string
  kind: ProjectKind
  approveBy: 'gate' | 'verbal' | 'ui'
  changeCount: number // changesFromPrevious.length，首版 0
  note?: string // approve.note（回滚版含「回滚自 vK」）
}

export interface BriefHistoryResult {
  versions: BriefHistoryItem[] // 按 version 升序
  latestVersion: number | null
  warnings: string[] // 损坏文件跳过说明
}

/** brief:history 主体：扫描定位 + 逐版读全文取全部字段（F1：listing 仅文件元数据，内容字段此处自取；OD D5：历史页打开频率低，IO 可接受）；无历史返回空集不报错 */
export async function readBriefHistory(projectDir: string): Promise<BriefHistoryResult> {
  const listing = await listBriefVersions(projectDir)
  const versions: BriefHistoryItem[] = []
  const warnings = [...listing.warnings]
  for (const v of listing.versions) {
    try {
      const brief = JSON.parse(
        await fsp.readFile(path.join(projectDir, v.path), 'utf-8'),
      ) as ProjectBrief
      versions.push({
        version: v.version,
        path: v.path,
        publishedAt: brief.publishedAt,
        kind: brief.kind,
        approveBy: brief.approve.by,
        changeCount: brief.changesFromPrevious.length,
        ...(brief.approve.note ? { note: brief.approve.note } : {}),
      })
    } catch (e) {
      warnings.push(`${v.path} 解析失败已跳过：${(e as Error).message}`)
    }
  }
  // latestVersion 只认成功解析版本：高号损坏文件不抬高最新版（与 F1 前行为一致）
  const latestVersion = versions.length ? versions[versions.length - 1]!.version : null
  return { versions, latestVersion, warnings }
}

/** brief:version-read 主体：vK 全文 + diffToLatest（from=vK 值，to=最新值）；vK=最新 → [] */
export async function readBriefVersion(
  projectDir: string,
  version: number,
): Promise<{ brief: ProjectBrief; diffToLatest: BriefChange[] }> {
  const listing = await listBriefVersions(projectDir)
  const entry = listing.versions.find(v => v.version === version)
  if (!entry) {
    throw Object.assign(new Error(`立项单 v${version} 不存在`), { code: 'BRIEF_VERSION_NOT_FOUND' })
  }
  const brief = JSON.parse(
    await fsp.readFile(path.join(projectDir, entry.path), 'utf-8'),
  ) as ProjectBrief
  const latestEntry = listing.versions[listing.versions.length - 1]
  if (!latestEntry || latestEntry.version === version) {
    return { brief, diffToLatest: [] }
  }
  const latest = JSON.parse(
    await fsp.readFile(path.join(projectDir, latestEntry.path), 'utf-8'),
  ) as ProjectBrief
  // ProjectBrief 结构兼容 BriefDraft（字段子集），整版直接传入（契约 §1 复用表）
  return { brief, diffToLatest: diffBrief(brief, latest) }
}
