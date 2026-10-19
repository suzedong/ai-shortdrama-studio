// feature-004 · 立项单回滚主体（契约 §2.3 brief:rollback）
// 设计 §2.6.7 原文语义：回滚 = 新发一版 立项单.v(N+1) = 立项单.vK 的内容，保留全部历史（不覆盖不删版）。
// 编排复刻 update.ts：单次 enqueue 内 publish + manifest.briefVersion 写回 + 画布 brief 节点 upsert；
// 有意不做影响清单（本包范围外，回滚造成的下游影响由 feature-002 脏读机制在读取侧自动生效）。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type { BriefChange, ProjectBrief } from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { MANIFEST_FILE, parseManifest, applyBriefVersion } from '../project/manifest.js'
import { canvasStore } from '../canvas/store.js'
import { listBriefVersions } from './plan.js'
import { publishBriefFiles, type ReadyBriefDraft } from './publish.js'

export interface BriefRollbackResult {
  version: number // 新版号 N+1
  rolledBackFrom: number // 内容来源版 K
  changesFromPrevious: BriefChange[] // = diff(旧最新 vN, vK 内容)，发布主体自动算
}

export async function rollbackBriefToVersion(
  projectDir: string,
  version: number,
): Promise<BriefRollbackResult> {
  return enqueue(async () => {
    // R1：定位 vK；不存在拒，零写盘
    const listing = await listBriefVersions(projectDir)
    const entry = listing.versions.find(v => v.version === version)
    if (!entry) {
      throw Object.assign(new Error(`立项单 v${version} 不存在`), { code: 'BRIEF_VERSION_NOT_FOUND' })
    }
    // R2：vK 即最新版拒，零写盘
    if (listing.latestVersion === version) {
      throw Object.assign(
        new Error(`v${version} 即当前最新版，无需回滚`),
        { code: 'BRIEF_ROLLBACK_LATEST' },
      )
    }
    // R3：读 vK 全文，draft 逐字段取自 vK
    const source = JSON.parse(
      await fsp.readFile(path.join(projectDir, entry.path), 'utf-8'),
    ) as ProjectBrief
    const draft = {
      kind: source.kind,
      fiveElements: source.fiveElements,
      premise: source.premise,
      style: source.style,
      ...(source.diagnosisSummary ? { diagnosisSummary: source.diagnosisSummary } : {}),
      ...(source.diagnosisDetail ? { diagnosisDetail: source.diagnosisDetail } : {}),
    }
    // R4：发新版（版本号分配/防覆盖/双写/changesFromPrevious 全复用发布主体）
    const written = await publishBriefFiles(projectDir, draft as ReadyBriefDraft, {
      by: 'ui',
      note: `回滚自 v${version}`,
    })

    // R5-a：manifest 指针推进（不追加 statusHistory）
    const manifestAbs = path.join(projectDir, MANIFEST_FILE)
    const manifest = parseManifest(
      JSON.parse(await fsp.readFile(manifestAbs, 'utf-8')),
      new Date().toISOString(),
    )
    const nextManifest = applyBriefVersion(manifest, written.version, new Date().toISOString())
    await fsp.writeFile(manifestAbs, JSON.stringify(nextManifest, null, 2), 'utf-8')

    // R5-b：画布 brief 节点 upsert（persistInQueue 自动广播 canvas:changed）
    await canvasStore.persistInQueue(c => {
      const bIdx = c.nodes.findIndex(x => x.id === written.briefNode.id)
      const { linksTo: _links, ...briefNode } = written.briefNode
      if (bIdx >= 0) c.nodes[bIdx] = briefNode
      else c.nodes.push(briefNode)
    })

    return {
      version: written.version,
      rolledBackFrom: version,
      changesFromPrevious: written.changesFromPrevious,
    }
  })
}
