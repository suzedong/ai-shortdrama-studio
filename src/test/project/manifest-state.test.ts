import { describe, expect, it } from 'vitest'
import type { ManifestEvent, ManifestStatus } from '@shared/types'
import { MANIFEST_TRANSITIONS, advanceStatus, parseManifest } from '../../../electron/project/manifest'

const EVENTS: ManifestEvent[] = [
  'brief-published', 'outline-approved', 'profiles-approved',
  'scenes-approved', 'dialogue-approved', 'storyboard-finalized',
]

const CHAIN: ManifestStatus[] = [
  'initiating', 'story-outline', 'story-profiles',
  'script-scenes', 'script-dialogue', 'script-storyboard', 'storyboard-done',
]

const NOW = '2026-10-13T08:00:00.000Z'

describe('feature-801 advanceStatus 纯函数（契约 §2）', () => {
  it('跃迁表 6 事件均为相邻一格（index 差恒为 1）', () => {
    expect(EVENTS).toHaveLength(6)
    EVENTS.forEach((event, i) => {
      expect(MANIFEST_TRANSITIONS[event]).toEqual({ from: CHAIN[i], to: CHAIN[i + 1] })
      expect(CHAIN.indexOf(MANIFEST_TRANSITIONS[event].to))
        .toBe(CHAIN.indexOf(MANIFEST_TRANSITIONS[event].from) + 1)
    })
  })

  it.each(EVENTS)('正向：%s 在 from 态推进成功', (event) => {
    const edge = MANIFEST_TRANSITIONS[event]
    expect(advanceStatus(edge.from, event)).toEqual({ advanced: true, next: edge.to })
  })

  it.each(EVENTS)('幂等：%s 在 to 态重复调用返回 already-there 且不推进', (event) => {
    const edge = MANIFEST_TRANSITIONS[event]
    expect(advanceStatus(edge.to, event)).toEqual({ advanced: false, reason: 'already-there' })
  })

  it('乱序/跳格：每事件对既非 from 也非 to 的中间态返回 bad-transition（≥6 例）', () => {
    let count = 0
    for (const event of EVENTS) {
      for (const status of CHAIN) {
        const edge = MANIFEST_TRANSITIONS[event]
        if (status === edge.from || status === edge.to) continue
        if (status === 'storyboard-done') continue // 终态单独验
        const r = advanceStatus(status, event)
        expect(r).toEqual({ advanced: false, reason: 'bad-transition' })
        count++
      }
    }
    expect(count).toBeGreaterThanOrEqual(6)
  })

  it('终态 storyboard-done 对任意事件返回 terminal（幂等事件除外）', () => {
    expect(advanceStatus('storyboard-done', 'outline-approved')).toEqual({ advanced: false, reason: 'terminal' })
    expect(advanceStatus('storyboard-done', 'brief-published')).toEqual({ advanced: false, reason: 'terminal' })
    // 末态事件在终态上是幂等，不是 terminal
    expect(advanceStatus('storyboard-done', 'storyboard-finalized')).toEqual({ advanced: false, reason: 'already-there' })
  })

  it('全链：从 initiating 按序 6 格到达 storyboard-done', () => {
    let current: ManifestStatus = 'initiating'
    for (const event of EVENTS) {
      const r = advanceStatus(current, event)
      expect(r.advanced).toBe(true)
      if (r.advanced) current = r.next
    }
    expect(current).toBe('storyboard-done')
  })
})

describe('feature-801 parseManifest 容错（契约 §5）', () => {
  it('新形状直读：5 字段原样返回', () => {
    const m = parseManifest({
      status: 'script-scenes',
      createdAt: '2026-10-13T00:00:00.000Z',
      workflowVersion: 1,
      updatedAt: NOW,
      statusHistory: [{ event: 'scenes-approved', from: 'story-profiles', to: 'script-scenes', at: NOW }],
    }, 'fallback')
    expect(m.status).toBe('script-scenes')
    expect(m.workflowVersion).toBe(1)
    expect(m.statusHistory).toHaveLength(1)
  })

  it('旧 12 字段骨架：合法 status 采用、补 statusHistory:[]，未知字段全部透传保留', () => {
    const m = parseManifest({
      status: 'initiating',
      createdAt: NOW,
      workflowVersion: 1,
      phase: 'initiating',
      nodes: { idea: 'active', outline: 'pending' },
      pendingGate: null, redoGate: null, storyRedo: null, scriptRedo: null,
      activeUnlock: null, activeDraft: null, feOverride: null, preflight: null, saved: false,
    }, 'fallback')
    expect(m.status).toBe('initiating')
    expect(m.updatedAt).toBe(NOW) // 缺失时回退 createdAt
    expect(m.statusHistory).toEqual([])
    expect(m.phase).toBe('initiating')
    expect(m.nodes).toEqual({ idea: 'active', outline: 'pending' })
    expect(m.saved).toBe(false)
  })

  it('非法/缺失 status 回退 initiating；createdAt 缺失用 fallbackNow；workflowVersion 归一 1', () => {
    const m = parseManifest({ status: 'old-stage', workflowVersion: 9, weird: 1 }, NOW)
    expect(m.status).toBe('initiating')
    expect(m.createdAt).toBe(NOW)
    expect(m.updatedAt).toBe(NOW)
    expect(m.workflowVersion).toBe(1)
    expect(m.weird).toBe(1)
  })

  it('null / 非对象 / 损坏输入容错为初始形状', () => {
    for (const raw of [null, undefined, 'garbage', 42]) {
      const m = parseManifest(raw, NOW)
      expect(m.status).toBe('initiating')
      expect(m.createdAt).toBe(NOW)
      expect(m.statusHistory).toEqual([])
    }
  })

  it('statusHistory 脏项被过滤（缺字段/非对象），合法项保留', () => {
    const m = parseManifest({
      status: 'story-outline', createdAt: NOW,
      statusHistory: [
        { event: 'brief-published', from: 'initiating', to: 'story-outline', at: NOW },
        { event: 'x', from: 'initiating' },
        null,
        'junk',
      ],
    }, 'fallback')
    expect(m.statusHistory).toHaveLength(1)
    expect(m.statusHistory[0].event).toBe('brief-published')
  })
})
