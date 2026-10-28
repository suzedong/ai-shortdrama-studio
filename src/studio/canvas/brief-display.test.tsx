// feature-013 · STAGE 0 立项显示派生 + 左栏 hover 版本历史卡（契约 §3.2 / §5.4-5）
// 口径单一事实源：deriveBriefDisplay / stage0Tooltip 供左栏徽标与顶栏 tooltip 共用，杜绝两套口径漂移。
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CanvasNode, StepId } from '@shared/types'
import StageNavPanel from './StageNavPanel'
import { deriveBriefDisplay, stage0Tooltip } from './brief-display'

function node(partial: Partial<CanvasNode> & Pick<CanvasNode, 'id' | 'kind' | 'title' | 'status'>): CanvasNode {
  return {
    step: '0' as StepId,
    ref: { path: `${partial.id}.json`, format: 'json' },
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...partial,
  }
}

const briefNode = (version: string) => node({
  id: 'step-0-brief', kind: 'brief', title: `立项单 ${version}`, status: 'done', meta: { version },
})

const dirtyRef = (since: number, latest: number, fields: string[]) => ({
  dirty: {
    sinceBriefVersion: since, latestBriefVersion: latest, fields,
    severity: 'medium' as const, impactReport: `影响清单.v${since}-v${latest}.json`,
  },
})

describe('feature-013 · deriveBriefDisplay 派生口径', () => {
  it('空画布：未发布、零脏、零对齐', () => {
    expect(deriveBriefDisplay([])).toEqual({
      version: null, published: false, dirtyCount: 0, alignedCount: 0,
    })
  })

  it('版本取 brief 节点 meta.version 与 dirty.latestBriefVersion 的较大值', () => {
    const d = deriveBriefDisplay([
      briefNode('v3'),
      node({
        id: 'step-1-outline', step: '1' as StepId, kind: 'outline', title: '大纲', status: 'done',
        parentReference: { briefVersion: 1, fields: ['premise.leads'] },
        ...dirtyRef(1, 5, ['premise.leads']),
      }),
    ])
    expect(d.version).toBe(5)
    expect(d.dirtyCount).toBe(1)
    expect(d.alignedCount).toBe(0) // 脏节点不计入已对齐
  })

  it('已对齐产物 = done + 带 parentReference + 非 dirty + 非 brief 节点', () => {
    const d = deriveBriefDisplay([
      briefNode('v2'),
      node({
        id: 'step-1-outline', step: '1' as StepId, kind: 'outline', title: '大纲', status: 'done',
        parentReference: { briefVersion: 2, fields: ['premise.leads'] },
      }),
      node({
        id: 'step-2-scenes', step: '2' as StepId, kind: 'scenes', title: '分场', status: 'done',
        parentReference: { briefVersion: 2, fields: ['fiveElements.episodeCount'] },
        ...dirtyRef(1, 2, ['fiveElements.episodeCount']),
      }),
      // 无 parentReference 的 done 节点不计入
      node({ id: 'step-3-profiles', step: '3' as StepId, kind: 'profiles', title: '定妆', status: 'done' }),
      // 非 done（active）不计入
      node({
        id: 'step-4-storyboard', step: '4' as StepId, kind: 'storyboard', title: '分镜', status: 'active',
        parentReference: { briefVersion: 2, fields: ['premise.place'] },
      }),
    ])
    expect(d.alignedCount).toBe(1)
    expect(d.dirtyCount).toBe(1)
    expect(d.published).toBe(true)
  })
})

describe('feature-013 · stage0Tooltip 文案', () => {
  it('未发布 → null（顶栏保持现状 STAGE 0 文案）', () => {
    expect(stage0Tooltip({ version: null, published: false, dirtyCount: 0, alignedCount: 0 })).toBeNull()
  })

  it('Y=0 → 全对齐变体', () => {
    expect(stage0Tooltip({ version: 3, published: true, dirtyCount: 0, alignedCount: 4 }))
      .toBe('立项 v3 · 全对齐')
  })

  it('有脏 → 立项 vN · X 产物已对齐 · Y 待处理（X/Y 与画布同源）', () => {
    expect(stage0Tooltip({ version: 3, published: true, dirtyCount: 2, alignedCount: 1 }))
      .toBe('立项 v3 · 1 产物已对齐 · 2 待处理')
  })
})

describe('feature-013 · StageNavPanel STAGE 0 hover 版本历史卡', () => {
  afterEach(() => { vi.restoreAllMocks() })

  const history = {
    versions: [
      { version: 1, path: '立项单.v1.json', publishedAt: '2026-10-15T08:00:00.000Z', kind: 'commercial' as const, approveBy: 'gate' as const, changeCount: 0 },
      { version: 2, path: '立项单.v2.json', publishedAt: '2026-10-16T08:00:00.000Z', kind: 'commercial' as const, approveBy: 'verbal' as const, changeCount: 2 },
      { version: 3, path: '立项单.v3.json', publishedAt: '2026-10-17T08:00:00.000Z', kind: 'commercial' as const, approveBy: 'ui' as const, changeCount: 1 },
    ],
    latestVersion: 3,
    warnings: [] as string[],
  }

  function installBriefHistory(impl: () => Promise<unknown>) {
    const spy = vi.fn(impl)
    window.api = { briefHistory: spy } as unknown as Window['api']
    return spy
  }

  it('已发布：hover 拉取一次并渲染四要素（版本/时间/改动数/拍板方式），缓存命中不重复拉取', async () => {
    const spy = installBriefHistory(async () => history)
    const nodes = [
      briefNode('v3'),
      node({
        id: 'step-1-outline', step: '1' as StepId, kind: 'outline', title: '大纲', status: 'done',
        parentReference: { briefVersion: 3, fields: ['premise.leads'] },
      }),
    ]
    const { container } = render(<StageNavPanel nodes={nodes} activeStep={null} onSelect={() => {}} />)
    const badge = container.querySelector('[data-stage-badge="0"]') as HTMLElement

    // 未 hover 不拉取、不渲染
    expect(container.querySelector('[data-stage0-history-card]')).toBeNull()
    expect(spy).not.toHaveBeenCalled()

    fireEvent.mouseEnter(badge)
    await waitFor(() => expect(container.querySelector('[data-stage0-history-card]')).not.toBeNull())
    const card = container.querySelector('[data-stage0-history-card]') as HTMLElement
    expect(card.textContent).toContain('立项版本历史')
    expect(card.textContent).toContain('v1')
    expect(card.textContent).toContain('v2')
    expect(card.textContent).toContain('v3')
    expect(card.textContent).toContain('+2 改动')
    expect(card.textContent).toContain('门拍板')
    expect(card.textContent).toContain('口头拍板')
    expect(card.textContent).toContain('面板直改')
    expect(spy).toHaveBeenCalledTimes(1)

    // 移出隐藏；再次移入走会话内缓存，不重复拉取
    fireEvent.mouseLeave(badge)
    expect(container.querySelector('[data-stage0-history-card]')).toBeNull()
    fireEvent.mouseEnter(badge)
    await waitFor(() => expect(container.querySelector('[data-stage0-history-card]')).not.toBeNull())
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('未发布：hover 不渲染卡、不拉取', () => {
    const spy = installBriefHistory(async () => history)
    const { container } = render(
      <StageNavPanel
        nodes={[node({ id: 'step-1-outline', step: '1' as StepId, kind: 'outline', title: '大纲', status: 'done' })]}
        activeStep={null}
        onSelect={() => {}}
      />,
    )
    const badge = container.querySelector('[data-stage-badge="0"]') as HTMLElement
    expect(badge.textContent).toBe('空')
    fireEvent.mouseEnter(badge)
    expect(container.querySelector('[data-stage0-history-card]')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('拉取失败：降级不渲染卡、不抛错', async () => {
    const spy = installBriefHistory(() => Promise.reject(new Error('boom')))
    const { container } = render(
      <StageNavPanel nodes={[briefNode('v4')]} activeStep={null} onSelect={() => {}} />,
    )
    const badge = container.querySelector('[data-stage-badge="0"]') as HTMLElement
    fireEvent.mouseEnter(badge)
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('[data-stage0-history-card]')).toBeNull()
  })
})
