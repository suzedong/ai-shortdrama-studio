import { describe, expect, it } from 'vitest'
import type { CanvasEdge } from '@shared/types'
import { deriveAutoEdges, type CanvasUpsertNode } from '../../electron/canvas/edges'

function node(id: string, linksTo?: string[]): CanvasUpsertNode {
  return {
    id, step: '1', kind: 'outline', title: id, status: 'active', updatedAt: 't', linksTo,
  }
}

describe('T4 deriveAutoEdges', () => {
  it('linksTo 生成 auto 边并补确定性 id', () => {
    const edges = deriveAutoEdges([], [node('a', ['b'])])
    expect(edges).toEqual([{ id: 'e-a--b', from: 'a', to: 'b', auto: true }])
  })

  it('(from,to) 去重：已存在则不新增', () => {
    const existing: CanvasEdge[] = [{ id: 'e-a--b', from: 'a', to: 'b', auto: true }]
    expect(deriveAutoEdges(existing, [node('a', ['b'])])).toEqual(existing)
  })

  it('边 id 确定性，重复调用结果不变（幂等）', () => {
    const once = deriveAutoEdges([], [node('a', ['b', 'c'])])
    const twice = deriveAutoEdges(once, [node('a', ['b', 'c'])])
    expect(twice).toEqual(once)
    expect(twice).toHaveLength(2)
  })

  it('无 linksTo 不产生边', () => {
    expect(deriveAutoEdges([], [node('a')])).toEqual([])
  })
})
