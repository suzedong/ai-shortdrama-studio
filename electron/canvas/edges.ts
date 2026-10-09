// feature-017 · 自动边推导（纯函数）
import type { CanvasEdge, CanvasNode } from '../../shared/types.js'

/** 节点 upsert 入参：linksTo 仅用于本次更新推导自动边，不写进节点本体 */
export interface CanvasUpsertNode extends CanvasNode {
  linksTo?: string[]
}

/** 确定性边 id：重复调用幂等 */
export function edgeId(from: string, to: string): string {
  return `e-${from}--${to}`
}

/** 返回 existing + 新增自动边（按 from/to 去重、补 id）；不修改入参数组 */
export function deriveAutoEdges(
  existing: CanvasEdge[],
  nodeUpserts: CanvasUpsertNode[],
): CanvasEdge[] {
  const result = [...existing]
  const has = (from: string, to: string): boolean =>
    result.some(e => e.from === from && e.to === to)
  for (const n of nodeUpserts) {
    for (const to of n.linksTo ?? []) {
      if (!has(n.id, to)) {
        result.push({ id: edgeId(n.id, to), from: n.id, to, auto: true })
      }
    }
  }
  return result
}
