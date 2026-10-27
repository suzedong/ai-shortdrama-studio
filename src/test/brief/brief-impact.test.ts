import { describe, expect, it } from 'vitest'
import type { BriefChange, Canvas, CanvasNode } from '@shared/types'
import { assessImpact, classifyChanges, classifyField } from '../../../electron/brief/impact'

function change(field: string): BriefChange {
  return { field, from: '旧', to: '新' }
}

function canvasWith(nodes: CanvasNode[]): Canvas {
  return {
    schemaVersion: 2, projectId: 'p1', title: '新项目', nodes, edges: [], gates: [],
    updatedAt: '2026-10-14T00:00:00.000Z',
  }
}

function doneNode(
  id: string,
  step: string,
  briefVersion: number | null,
  fields: string[],
): CanvasNode {
  return {
    id,
    step: step as CanvasNode['step'],
    kind: id,
    title: id,
    status: 'done',
    updatedAt: '2026-10-14T00:00:00.000Z',
    parentReference: briefVersion === null ? undefined : { briefVersion, fields },
  }
}

describe('classifyField（契约 §2.1 全表）', () => {
  const highFields = [
    'premise.leads', 'premise.time', 'premise.place',
    'premise.coreEvent', 'premise.seasonBoundary',
    'style.mainStyleId', 'style.catalogVersion', 'fiveElements.aspectRatio',
  ]
  const mediumFields = [
    'fiveElements.episodeCount', 'fiveElements.episodeDuration',
    'fiveElements.genre', 'fiveElements.tone', 'fiveElements.platforms',
    'style.auxiliaryStyleId', 'kind', 'diagnosisSummary', 'diagnosisDetail', // diagnosisDetail：D-018
  ]

  it.each(highFields)('%s → high', f => expect(classifyField(f)).toBe('high'))
  it.each(mediumFields)('%s → medium', f => expect(classifyField(f)).toBe('medium'))
  it('未知路径 → low（防御性，不抛错）', () => {
    expect(classifyField('style.unknown')).toBe('low')
    expect(classifyField('')).toBe('low')
  })
})

describe('classifyChanges', () => {
  it('low 字段不入 Map；high/medium 入', () => {
    const m = classifyChanges([
      change('fiveElements.episodeCount'),
      change('style.unknown'),
      change('premise.leads'),
    ])
    expect([...m.keys()]).toEqual(['fiveElements.episodeCount', 'premise.leads'])
    expect(m.get('fiveElements.episodeCount')).toBe('medium')
    expect(m.get('premise.leads')).toBe('high')
  })
})

describe('assessImpact（契约 §2.3）', () => {
  it('空 Δ → items=[]、counts 全 0、toVersion=fromVersion+1', () => {
    const r = assessImpact([], canvasWith([doneNode('a', '1', 2, ['premise.leads'])]), 2)
    expect(r.toVersion).toBe(3)
    expect(r.items).toEqual([])
    expect(r.counts).toEqual({ high: 0, medium: 0, total: 0 })
  })

  it('仅 medium 命中：severity=medium、defaultAction=mark', () => {
    const r = assessImpact(
      [change('fiveElements.episodeCount')],
      canvasWith([doneNode('step-2-scenes', '2', 2, ['fiveElements.episodeCount', 'premise.leads'])]),
      2,
    )
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      nodeId: 'step-2-scenes',
      severity: 'medium',
      defaultAction: 'mark',
      fields: ['fiveElements.episodeCount'],
    })
    expect(r.counts).toEqual({ high: 0, medium: 1, total: 1 })
  })

  it('含 high：severity 聚合为 high、defaultAction=regenerate', () => {
    const r = assessImpact(
      [change('fiveElements.episodeCount'), change('premise.leads')],
      canvasWith([doneNode('n', '2', 2, ['fiveElements.episodeCount', 'premise.leads'])]),
      2,
    )
    expect(r.items[0].severity).toBe('high')
    expect(r.items[0].defaultAction).toBe('regenerate')
    // hit 顺序按 §2.1 表顺序（premise.leads 在 high 表，先于 medium 表）
    expect(r.items[0].fields).toEqual(['premise.leads', 'fiveElements.episodeCount'])
    expect(r.counts).toEqual({ high: 1, medium: 0, total: 1 })
  })

  it('过滤四分支：非 done / 无 parentReference / 版本不等 / 字段不相交', () => {
    const nodes: CanvasNode[] = [
      { ...doneNode('not-done', '1', 2, ['premise.leads']), status: 'active' },
      doneNode('no-ref', '1', 2, ['premise.leads']),
    ]
    nodes[1].parentReference = undefined
    const c = canvasWith([
      ...nodes,
      doneNode('version-mismatch', '1', 1, ['premise.leads']),
      doneNode('no-null-version', '1', null, ['premise.leads']),
      doneNode('disjoint', '1', 2, ['diagnosisSummary']),
      doneNode('hit', '1', 2, ['premise.leads']),
    ])
    const r = assessImpact([change('premise.leads')], c, 2)
    expect(r.items.map(i => i.nodeId)).toEqual(['hit'])
  })

  it('排序：severity（high 先）→ step 字典序 → nodeId', () => {
    const c = canvasWith([
      doneNode('m-step2', '2', 2, ['fiveElements.episodeCount']),
      doneNode('h-step2', '2', 2, ['premise.leads']),
      doneNode('m-step1-b', '1', 2, ['fiveElements.episodeCount']),
      doneNode('m-step1-a', '1', 2, ['fiveElements.episodeCount']),
      doneNode('h-step1', '1', 2, ['premise.place']),
    ])
    const r = assessImpact(
      [change('fiveElements.episodeCount'), change('premise.leads'), change('premise.place')],
      c,
      2,
    )
    expect(r.items.map(i => i.nodeId)).toEqual([
      'h-step1', 'h-step2', 'm-step1-a', 'm-step1-b', 'm-step2',
    ])
  })
})
