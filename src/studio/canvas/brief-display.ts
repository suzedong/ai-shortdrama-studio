// feature-013 · STAGE 0 立项显示派生（纯函数层 · 左栏徽标与 titlebar tooltip 单一事实源）
// 左栏 StageNavPanel 徽标（✓ vN / vN ⚠k）与顶栏 stage-track tooltip「立项 vN · X 产物已对齐 · Y 待处理」
// 共用本派生，杜绝两套口径漂移；只消费 canvas 节点投影，禁止 fs / window.api / Date / 随机。
import type { CanvasNode } from '@shared/types'

export interface BriefDisplay {
  /** 最新立项版本号（brief 节点 meta.version 与全画布 dirty.latestBriefVersion 取大）；null = 未发布 */
  version: number | null
  /** 已发布立项（version 非空） */
  published: boolean
  /** 全画布脏节点数（= 左栏 ⚠k 同数） */
  dirtyCount: number
  /** 已对齐产物数（done + 带 parentReference + 非 dirty + 非 brief 节点） */
  alignedCount: number
}

function parseV(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = /^v(\d+)$/i.exec(v)
  return m ? Number(m[1]) : null
}

/** 从画布节点派生 STAGE 0 立项显示态（零副作用） */
export function deriveBriefDisplay(nodes: CanvasNode[]): BriefDisplay {
  const briefNode = nodes.find(n => n.kind === 'brief')
  const dirtyNodes = nodes.filter(n => n.dirty)
  const briefMetaV = parseV(briefNode?.meta?.version)
  const latestFromDirty = dirtyNodes.reduce((m, n) => Math.max(m, n.dirty!.latestBriefVersion), 0)
  const candidates = [briefMetaV, latestFromDirty > 0 ? latestFromDirty : null]
    .filter((v): v is number => v !== null)
  const version = candidates.length > 0 ? Math.max(...candidates) : null
  const alignedCount = nodes.filter(
    n => n.kind !== 'brief' && n.status === 'done' && !!n.parentReference && !n.dirty,
  ).length
  return {
    version,
    published: version !== null,
    dirtyCount: dirtyNodes.length,
    alignedCount,
  }
}

/** 顶栏 STAGE 0 tooltip 文案（未发布降级为现状文案；Y=0 显全对齐变体） */
export function stage0Tooltip(display: BriefDisplay): string | null {
  if (!display.published) return null
  const v = display.version!
  if (display.dirtyCount === 0) return `立项 v${v} · 全对齐`
  return `立项 v${v} · ${display.alignedCount} 产物已对齐 · ${display.dirtyCount} 待处理`
}
