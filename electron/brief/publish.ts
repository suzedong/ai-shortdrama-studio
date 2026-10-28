// feature-002 · 立项单发布主体（自 feature-001 brief.publish handler 等价抽离，契约 §3.3）
// publishBriefFiles 不自开写队列：v1 handler 与 brief.impact.commit 各自负责 enqueue 包裹，
// 使 commit 能把双写、影响清单、manifest 指针、画布挂脏收进同一次串行写（OD §5.2，防嵌套队列）。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type {
  BriefDraft, BriefStyle, CanvasNode, FiveElements,
  ProjectBrief, ProjectKind, StoryPremise,
} from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { resolveInside } from '../fs/sandbox.js'
import { MANIFEST_FILE, parseManifest, applyBriefVersion } from '../project/manifest.js'
import { diffBrief } from './diff.js'
import { listBriefVersions } from './plan.js'
import { renderBriefMd } from './render-md.js'

/** 已过就绪闸门的完整草案（publish / commit 调用前由 evaluateDraft + zod 保证） */
export type ReadyBriefDraft = BriefDraft & {
  kind: ProjectKind
  fiveElements: FiveElements
  premise: StoryPremise
  style: BriefStyle
}

export interface BriefApproveInput {
  by: 'gate' | 'verbal' | 'ui' // 'ui' 仅系统直改通道（D-017）；MCP 入参 schema 仍只放 gate/verbal
  verbal?: { quote: string }
  note?: string
}

export interface PublishedBrief {
  version: number
  jsonName: string
  mdName: string
  brief: ProjectBrief
  changesFromPrevious: ProjectBrief['changesFromPrevious']
  /** step-0-brief 画布节点 upsert 体（linksTo 不由本主体声明） */
  briefNode: CanvasNode & { linksTo: string[] }
}

/** 版本号分配 + 防覆盖 + 立项单双写。必须在调用方的 enqueue 内执行（不自行入队）。 */
export async function publishBriefFiles(
  projectDir: string,
  draft: ReadyBriefDraft,
  approve: BriefApproveInput,
): Promise<PublishedBrief> {
  const listing = await listBriefVersions(projectDir)
  const version = listing.latestVersion === null ? 1 : listing.latestVersion + 1
  const jsonName = `立项单.v${version}.json`
  const mdName = `立项单.v${version}.md`
  const jsonAbs = resolveInside(projectDir, jsonName)
  const mdAbs = resolveInside(projectDir, mdName)

  // 理论上不可能（版本号磁盘扫描分配）；命中即拒，绝不覆盖
  const [jsonExists, mdExists] = await Promise.all([
    fsp.access(jsonAbs).then(() => true, () => false),
    fsp.access(mdAbs).then(() => true, () => false),
  ])
  if (jsonExists || mdExists) {
    throw Object.assign(new Error(`${jsonExists ? jsonName : mdName} 已存在`), { code: 'BRIEF_VERSION_EXISTS' })
  }

  const prevEntry = listing.versions[listing.versions.length - 1]
  const prev = prevEntry
    ? JSON.parse(await fsp.readFile(path.join(projectDir, prevEntry.path), 'utf-8')) as ProjectBrief
    : null
  const now = new Date().toISOString()
  // feature-013：L0 元数据随再版落盘（draft 缺省时沿用上一版，避免 Agent 侧再版丢用户标签/备注；
  // 空数组/空串等价未设置 → 不落 l0 键）
  const l0Raw = draft.l0 ?? prev?.l0
  const l0Tags = l0Raw?.tags?.filter(t => t.trim() !== '') ?? []
  const l0Notes = l0Raw?.notes?.trim() ?? ''
  const l0 = l0Tags.length > 0 || l0Notes !== ''
    ? { ...(l0Tags.length > 0 ? { tags: l0Tags } : {}), ...(l0Notes !== '' ? { notes: l0Notes } : {}) }
    : undefined
  const brief: ProjectBrief = {
    schemaVersion: 2,
    version,
    kind: draft.kind,
    fiveElements: draft.fiveElements,
    premise: draft.premise,
    style: draft.style,
    ...(l0 ? { l0 } : {}),
    approve: {
      at: now,
      by: approve.by,
      ...(approve.verbal ? { verbal: approve.verbal } : {}),
      ...(approve.note ? { note: approve.note } : {}),
    },
    changesFromPrevious: diffBrief(prev, draft),
    publishedAt: now,
    ...(draft.diagnosisSummary?.trim() ? { diagnosisSummary: draft.diagnosisSummary } : {}),
    // D-018：诊断完整明细随立项单落盘（可选）
    ...(draft.diagnosisDetail?.trim() ? { diagnosisDetail: draft.diagnosisDetail } : {}),
  }

  await fsp.writeFile(jsonAbs, JSON.stringify(brief, null, 2), 'utf-8')
  await fsp.writeFile(mdAbs, renderBriefMd(brief), 'utf-8')

  const briefNode = {
    id: 'step-0-brief',
    step: '0' as const,
    kind: 'brief',
    title: `立项单 v${version}`,
    status: 'done' as const,
    ref: { path: jsonName, format: 'json' as const },
    meta: { version: `v${version}` },
    updatedAt: new Date().toISOString(),
    linksTo: [] as string[],
  }

  return { version, jsonName, mdName, brief, changesFromPrevious: brief.changesFromPrevious, briefNode }
}

/**
 * v1 发布：单次写队列内完成双写 + manifest.briefVersion=1 指针（feature-002 契约 §3.2）。
 * 画布节点 upsert 由调用方在返回后经 canvasStore.update 执行（保持 feature-001 行为顺序）。
 */
export async function publishV1InQueue(
  projectDir: string,
  draft: ReadyBriefDraft,
  approve: BriefApproveInput,
): Promise<PublishedBrief> {
  return enqueue(async () => {
    const written = await publishBriefFiles(projectDir, draft, approve)
    if (written.version === 1) {
      const manifestAbs = path.join(projectDir, MANIFEST_FILE)
      let text: string
      try {
        text = await fsp.readFile(manifestAbs, 'utf-8')
      } catch (e) {
        // 容错：无 manifest.json 的裸目录（历史项目 / 旧测试夹具）无法写指针则跳过；
        // 正式项目由 createProject 保证 manifest 存在（feature-002 契约 §3.2/§9.2）。
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return written
        throw e
      }
      const manifest = parseManifest(JSON.parse(text), new Date().toISOString())
      const next = applyBriefVersion(manifest, 1, new Date().toISOString())
      await fsp.writeFile(manifestAbs, JSON.stringify(next, null, 2), 'utf-8')
    }
    return written
  })
}
