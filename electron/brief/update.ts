// D-017 · 修改立项面板直写（原则六 · 系统优先：确定性字段编辑不经 AI 对话）
// 与 brief.impact.commit 分工：commit=Agent 对话通道（draft/decisions 由 Agent 传入并校验恰好覆盖）；
// 本主体=系统直改通道（draft 由最新立项 + 面板 patch 合并，approve.by 恒 'ui'，decisions 恒全 'mark'）。
// 流程骨架（就绪闸 → 复算 → 双写 → 影响清单 → manifest → 画布挂脏单次队列写）与 commit 对齐；
// 有意不共抽函数：两通道校验职责与演进方向不同（§2.6.7 三选一面板属 feature-006 未建范围）。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type { BriefDraft, ProjectBrief, ProjectKind } from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { resolveInside } from '../fs/sandbox.js'
import { MANIFEST_FILE, parseManifest, applyBriefVersion } from '../project/manifest.js'
import { canvasStore } from '../canvas/store.js'
import { loadStyleCatalog } from '../style/loader.js'
import { diffBrief } from './diff.js'
import { evaluateDraft, listBriefVersions } from './plan.js'
import { assessImpact, type ImpactItem, type ImpactReportFile } from './impact.js'
import { publishBriefFiles, type ReadyBriefDraft } from './publish.js'

/** 修改立项面板可直改的字段（D-017 六控件 + feature-810 谱系升级 catalogVersion；feature-013 全字段直改 + L0 标签/备注） */
export interface BriefUpdatePatch {
  kind?: ProjectKind
  fiveElements?: {
    episodeDuration?: string
    episodeCount?: string
    aspectRatio?: string
    genre?: string          // feature-013：题材赛道
    tone?: string           // feature-013：风格基调
    platforms?: string[]    // feature-013：目标平台
  }
  premise?: {              // feature-013：故事前提五子项
    leads?: string
    time?: string
    place?: string
    coreEvent?: string
    seasonBoundary?: string
  }
  style?: {
    mainStyleId?: string
    auxiliaryStyleId?: string // 空串 = 清除辅助风格
    catalogVersion?: string   // feature-810：谱系升级采纳仅升版本号（K8 已批扩键）
  }
  diagnosisSummary?: string // feature-013：选题诊断结论（诊断明细保持只读，决策点 2 拍板 b）
  l0?: {                    // feature-013：L0 元数据（决策点 1 拍板 A 入模）
    tags?: string[]
    notes?: string
  }
}

export interface BriefUpdateResult {
  version: number
  jsonPath: string
  mdPath: string
  impactReportPath: string
  changes: ProjectBrief['changesFromPrevious']
  items: ImpactItem[]
  markedDirty: string[]
}

/**
 * 系统直改再版（v2+）：最新立项 + patch 合并 → 就绪闸 → 单次写队列内复算影响
 * （decisions 恒 'mark' 仅挂脏，不自动重生成）→ 立项单 / 影响清单 / manifest / 画布一次落齐。
 */
export async function updateBriefFields(
  projectDir: string,
  patch: BriefUpdatePatch,
): Promise<BriefUpdateResult> {
  // 谱系装载（802 纪律，失败三码不降级）在队列外：与 draft 合并无关，失败直接拒
  const catalog = await loadStyleCatalog()

  return enqueue(async () => {
    const listing = await listBriefVersions(projectDir)
    if (listing.latestVersion === null) {
      throw Object.assign(
        new Error('尚无已发布立项，不存在再版基线；请先在对话中完成立项'),
        { code: 'BRIEF_NO_BASELINE' },
      )
    }
    const fromVersion = listing.latestVersion
    const latestEntry = listing.versions[listing.versions.length - 1]!
    const prev = JSON.parse(
      await fsp.readFile(path.join(projectDir, latestEntry.path), 'utf-8'),
    ) as ProjectBrief

    // 合并 patch：面板全字段（feature-013）+ catalogVersion（feature-810）；未提交字段沿用 prev
    const auxPatch = patch.style?.auxiliaryStyleId
    const premisePatch = patch.premise
    const draft: BriefDraft = {
      kind: patch.kind ?? prev.kind,
      fiveElements: {
        ...prev.fiveElements,
        ...(patch.fiveElements?.episodeDuration !== undefined
          ? { episodeDuration: patch.fiveElements.episodeDuration.trim() }
          : {}),
        ...(patch.fiveElements?.episodeCount !== undefined
          ? { episodeCount: patch.fiveElements.episodeCount.trim() }
          : {}),
        ...(patch.fiveElements?.aspectRatio !== undefined
          ? { aspectRatio: patch.fiveElements.aspectRatio }
          : {}),
        ...(patch.fiveElements?.genre !== undefined
          ? { genre: patch.fiveElements.genre.trim() }
          : {}),
        ...(patch.fiveElements?.tone !== undefined
          ? { tone: patch.fiveElements.tone.trim() }
          : {}),
        ...(patch.fiveElements?.platforms !== undefined
          ? { platforms: patch.fiveElements.platforms.map(p => p.trim()).filter(p => p !== '') }
          : {}),
      },
      premise: {
        ...prev.premise,
        ...(premisePatch?.leads !== undefined ? { leads: premisePatch.leads.trim() } : {}),
        ...(premisePatch?.time !== undefined ? { time: premisePatch.time.trim() } : {}),
        ...(premisePatch?.place !== undefined ? { place: premisePatch.place.trim() } : {}),
        ...(premisePatch?.coreEvent !== undefined ? { coreEvent: premisePatch.coreEvent.trim() } : {}),
        ...(premisePatch?.seasonBoundary !== undefined ? { seasonBoundary: premisePatch.seasonBoundary.trim() } : {}),
      },
      style: {
        mainStyleId: patch.style?.mainStyleId ?? prev.style.mainStyleId,
        catalogVersion: patch.style?.catalogVersion ?? prev.style.catalogVersion,
        ...(auxPatch !== undefined
          ? (auxPatch === '' ? {} : { auxiliaryStyleId: auxPatch })
          : (prev.style.auxiliaryStyleId ? { auxiliaryStyleId: prev.style.auxiliaryStyleId } : {})),
      },
      ...(patch.diagnosisSummary !== undefined
        ? { diagnosisSummary: patch.diagnosisSummary.trim() }
        : prev.diagnosisSummary ? { diagnosisSummary: prev.diagnosisSummary } : {}),
      // feature-013：诊断明细（diagnosisDetail）本包保持只读，原样沿用
      ...(prev.diagnosisDetail ? { diagnosisDetail: prev.diagnosisDetail } : {}),
      // feature-013：L0 标签/备注（决策点 1 拍板 A 入模；空数组等价未设置；未提交子键沿用上一版）
      ...(patch.l0 !== undefined
        ? {
            l0: {
              ...(patch.l0.tags !== undefined
                ? { tags: patch.l0.tags.map(t => t.trim()).filter(t => t !== '') }
                : prev.l0?.tags ? { tags: prev.l0.tags } : {}),
              ...(patch.l0.notes !== undefined
                ? { notes: patch.l0.notes.trim() }
                : prev.l0?.notes !== undefined ? { notes: prev.l0.notes } : {}),
            },
          }
        : prev.l0 ? { l0: prev.l0 } : {}),
    }

    const changes = diffBrief(prev, draft)
    if (changes.length === 0) {
      throw Object.assign(new Error('无字段变更，无需再版'), { code: 'INVALID_ARGUMENT' })
    }

    // 就绪闸门（与 commit 同码 BRIEF_NOT_READY）：空值 / 风格 ID 闭集 / 谱系版本一致
    const { missing, styleIssues } = evaluateDraft(draft, catalog)
    if (missing.length > 0 || styleIssues.length > 0) {
      const problems = [...missing.map(m => m.message), ...styleIssues.map(s => s.message)]
      throw Object.assign(
        new Error(`立项草案未就绪：${problems.join('；')}`),
        { code: 'BRIEF_NOT_READY' },
      )
    }

    // 复算影响（纯函数，不信任任何传入清单）→ decisions 恒全 'mark'（D-017：仅挂脏）
    const canvas0 = await canvasStore.get()
    const assessment = assessImpact(changes, canvas0, fromVersion)

    // 立项单双写（版本防覆盖在 publishBriefFiles 内；approve.by 恒 'ui'）
    const written = await publishBriefFiles(projectDir, draft as ReadyBriefDraft, { by: 'ui' })
    const toVersion = written.version
    const reportName = `影响清单.v${fromVersion}-v${toVersion}.json`
    const report: ImpactReportFile = {
      schemaVersion: 1,
      kind: 'brief-impact-report',
      fromVersion,
      toVersion,
      committedAt: new Date().toISOString(),
      changes,
      items: assessment.items.map(i => ({ ...i, decision: 'mark' as const })),
    }
    await fsp.writeFile(
      resolveInside(projectDir, reportName),
      JSON.stringify(report, null, 2),
      'utf-8',
    )

    // manifest 指针推进（不追加 statusHistory）
    const manifestAbs = path.join(projectDir, MANIFEST_FILE)
    const manifest = parseManifest(
      JSON.parse(await fsp.readFile(manifestAbs, 'utf-8')),
      new Date().toISOString(),
    )
    const nextManifest = applyBriefVersion(manifest, toVersion, new Date().toISOString())
    await fsp.writeFile(manifestAbs, JSON.stringify(nextManifest, null, 2), 'utf-8')

    // 画布单次写：全部 item 挂脏 + brief 节点 upsert（persistInQueue 自动广播 canvas:changed）
    const markedDirty = assessment.items.map(i => i.nodeId)
    // feature-806 B-46：挂脏写入 markedAt（整批同一时间戳；重复挂脏整体覆盖即刷新）
    const markedAt = new Date().toISOString()
    await canvasStore.persistInQueue(c => {
      for (const item of assessment.items) {
        const idx = c.nodes.findIndex(x => x.id === item.nodeId)
        if (idx < 0) continue // assess 候选来自当前画布，理论必在
        const old = c.nodes[idx]!
        c.nodes[idx] = {
          ...old,
          dirty: {
            sinceBriefVersion: fromVersion,
            latestBriefVersion: toVersion,
            fields: item.fields,
            severity: item.severity,
            impactReport: reportName,
            markedAt,
          },
        }
      }
      const bIdx = c.nodes.findIndex(x => x.id === written.briefNode.id)
      const { linksTo: _links, ...briefNode } = written.briefNode
      if (bIdx >= 0) c.nodes[bIdx] = briefNode
      else c.nodes.push(briefNode)
    })

    return {
      version: toVersion,
      jsonPath: written.jsonName,
      mdPath: written.mdName,
      impactReportPath: reportName,
      changes,
      items: assessment.items,
      markedDirty,
    }
  })
}
