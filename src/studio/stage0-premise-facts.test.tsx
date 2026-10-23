// feature-009 · 前提卡分色与不可篡改水印测试（契约 §5）
// 两组：① 纯函数 selectPremiseConfirmation 真值表（AC1）；② Stage0View 集成（AC2-AC4，
// installViewApi = fileRead 路由 + capture 两桥内存 mock，stage0-chain.test.tsx L166-176 同模式）。
// 既有测试零 diff 依据：008 T5 已埋 capture 空 facts 桩 → PublishedBody 订阅空 facts → 五键全 none → 断言全兼容。
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasNode, CaptureFile, CapturedFact, ProjectBrief, StepId } from '@shared/types'
import Stage0View from './Stage0View'
import { selectPremiseConfirmation } from './stage0/premise-facts'
import { _setStyleCatalogSnapshotForTest } from './style-catalog-store'

/* ── 选择器（组件凭据为 data-stage0-*，非 data-testid）── */

const byStage0 = (name: string) => document.querySelector(`[data-stage0-${name}]`)
const row = (key: string) => document.querySelector(`[data-stage0-premise-row="${key}"]`)
const rowConf = (key: string) => row(key)?.getAttribute('data-stage0-premise-confirmation')
const PREMISE_KEYS = ['leads', 'time', 'place', 'coreEvent', 'seasonBoundary'] as const

async function findStage0(name: string) {
  await waitFor(() => expect(byStage0(name)).not.toBeNull())
  return byStage0(name)!
}

/* ── 夹具 ── */

function fact(id: string, topic: string, over: Partial<CapturedFact> = {}): CapturedFact {
  return {
    id,
    topic,
    value: `${topic}值`,
    source: 'infer',
    status: 'pending',
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...over,
  }
}

function node(partial: Partial<CanvasNode> & { id: string }): CanvasNode {
  return {
    step: '0' as StepId,
    kind: 'brief',
    title: partial.id,
    status: 'active',
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...partial,
  }
}

function canvas(over: Partial<Canvas> = {}): Canvas {
  return {
    schemaVersion: 2,
    projectId: 'p1',
    title: '测试项目',
    nodes: [],
    edges: [],
    gates: [],
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...over,
  }
}

const BRIEF_PATH = '立项单.v1.json'
const BG_PATH = '故事背景档案.md'

function brief(over: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    schemaVersion: 2,
    version: 1,
    kind: 'commercial',
    fiveElements: {
      genre: '都市甜宠',
      platforms: ['抖音', '红果'],
      episodeDuration: '90 秒',
      episodeCount: '80 集',
      tone: '轻松治愈',
      aspectRatio: '竖屏 9:16',
    },
    premise: {
      leads: '林夏与顾屿',
      time: '2026 年夏',
      place: '杭州',
      coreEvent: '雨夜共撑一伞',
      seasonBoundary: '第一季只讲相识',
    },
    style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
    approve: { at: '2026-10-15T08:00:00.000Z', by: 'gate' },
    changesFromPrevious: [],
    publishedAt: '2026-10-15T08:00:00.000Z',
    ...over,
  }
}

const doneBriefNode = () => node({
  id: 'step-0-brief',
  status: 'done',
  title: '立项单',
  ref: { path: BRIEF_PATH, format: 'json' },
  meta: { version: 'v1' },
})

/* ── window.api 桩 ── */

type ReadResult =
  | { ok: true; content: string; format: 'json' | 'md' }
  | { ok: false; error: { code: string; message: string } }

const okJson = (b: ProjectBrief): ReadResult => ({ ok: true, content: JSON.stringify(b), format: 'json' })
const okMd = (content: string): ReadResult => ({ ok: true, content, format: 'md' })
const fail = (code: string): ReadResult => ({ ok: false, error: { code, message: code } })

/** fileRead 路由 + capture 两桥内存 mock（stage0-chain.test.tsx installViewApi 同模式 + emit 广播） */
function installViewApi(router: (path: string) => ReadResult, initialFacts: CapturedFact[] = []) {
  const listeners = new Set<(file: CaptureFile) => void>()
  window.api = {
    fileRead: vi.fn(async ({ path }: { path: string }) => router(path)),
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: initialFacts })),
    onCaptureChanged: (cb: (file: CaptureFile) => void) => {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
  } as unknown as Window['api']
  return {
    emit(next: CapturedFact[]) {
      listeners.forEach(cb => cb({ schemaVersion: 1, facts: next }))
    },
  }
}

const briefOnlyRouter = (p: string) => (p === BRIEF_PATH ? okJson(brief()) : fail('NOT_FOUND'))

function renderView(c: Canvas) {
  return render(
    <React.StrictMode>
      <Stage0View canvas={c} projectTitle="安妮的夏天" onBackToDag={vi.fn()} />
    </React.StrictMode>,
  )
}

/* ── 全局钩子（风格目录 prime/复位，stage0-chain.test.tsx 同模式：单条 A7）── */

beforeEach(() => {
  vi.restoreAllMocks()
  _setStyleCatalogSnapshotForTest({
    status: 'ok',
    version: 'v1.46',
    entries: [{
      id: 'A7', name: '拟真人·仿真人动漫', familyCode: 'A', familyLabel: '写实影像系', role: 'main',
      feasibility: 'high', auxiliaryCandidate: false, visualTraits: '', anchorWords: '', textureRecipe: '',
    }],
  })
})

afterEach(() => {
  act(() => { _setStyleCatalogSnapshotForTest(null) })
})

/* ── ① 纯函数 selectPremiseConfirmation 真值表（AC1）── */

describe('selectPremiseConfirmation（AC1）', () => {
  it('空 facts → 五键全 none 且键全覆盖（PREMISE_FIELDS 表序）', () => {
    const m = selectPremiseConfirmation([])
    expect(m).toEqual({ leads: 'none', time: 'none', place: 'none', coreEvent: 'none', seasonBoundary: 'none' })
    expect(Object.keys(m)).toEqual([...PREMISE_KEYS])
  })

  it("source='user'（confirmed）→ 对应键 human", () => {
    const m = selectPremiseConfirmation([fact('f1', 'leads', { source: 'user', status: 'confirmed' })])
    expect(m.leads).toBe('human')
    expect(m.time).toBe('none')
  })

  it("source='infer' + status='confirmed' → human（「人提供（或确认）」）", () => {
    const m = selectPremiseConfirmation([fact('f1', 'time', { status: 'confirmed' })])
    expect(m.time).toBe('human')
  })

  it("source='infer' + status='pending' → ai", () => {
    const m = selectPremiseConfirmation([fact('f1', 'coreEvent')])
    expect(m.coreEvent).toBe('ai')
    expect(m.leads).toBe('none')
  })

  it('同键 confirmed + pending 混合 → human（confirmed 优先）', () => {
    const m = selectPremiseConfirmation([
      fact('f1', 'place'),
      fact('f2', '地点', { source: 'user', status: 'confirmed' }),
    ])
    expect(m.place).toBe('human')
  })

  it('中文别名（人物 / 本季边界 / 季边界）→ 命中对应键', () => {
    const m = selectPremiseConfirmation([
      fact('f1', '人物', { source: 'user', status: 'confirmed' }),
      fact('f2', '本季边界'),
      fact('f3', '季边界', { source: 'user', status: 'confirmed' }),
    ])
    expect(m.leads).toBe('human')
    expect(m.seasonBoundary).toBe('human')
  })

  it("trim + 大小写（' Leads '）→ 命中 leads", () => {
    const m = selectPremiseConfirmation([fact('f1', ' Leads ', { source: 'user', status: 'confirmed' })])
    expect(m.leads).toBe('human')
  })

  it('六要素 topic（题材 / 集数）→ 五键全 none 不打扰', () => {
    const m = selectPremiseConfirmation([
      fact('f1', '题材', { source: 'user', status: 'confirmed' }),
      fact('f2', '集数', { source: 'user', status: 'confirmed' }),
    ])
    expect(m).toEqual({ leads: 'none', time: 'none', place: 'none', coreEvent: 'none', seasonBoundary: 'none' })
  })

  it('未命中 topic → 五键全 none 不打扰', () => {
    const m = selectPremiseConfirmation([fact('f1', '预算', { source: 'user', status: 'confirmed' })])
    expect(Object.values(m).every(v => v === 'none')).toBe(true)
  })
})

/* ── ② Stage0View 集成（AC2-AC4）── */

describe('Stage0View 前提卡分色集成（AC2-AC4）', () => {
  it('facts 全空 → 五行 confirmation="none"、无 seal、行 class 无底色追加', async () => {
    installViewApi(briefOnlyRouter)
    renderView(canvas({ nodes: [doneBriefNode()] }))
    await findStage0('brief')
    await act(async () => { await Promise.resolve() })
    for (const key of PREMISE_KEYS) {
      expect(rowConf(key)).toBe('none')
      const cls = row(key)?.getAttribute('class') ?? ''
      expect(cls).not.toContain('bg-[#F2FBF6]')
      expect(cls).not.toContain('bg-[#FDF8EE]')
    }
    expect(document.querySelector('[data-stage0-premise-seal]')).toBeNull()
  })

  it('user/confirmed facts → human 行：「不可篡改」seal + bg-[#F2FBF6] + confirmation="human"', async () => {
    installViewApi(briefOnlyRouter, [fact('f1', 'leads', { source: 'user', status: 'confirmed' })])
    renderView(canvas({ nodes: [doneBriefNode()] }))
    await findStage0('brief')
    await waitFor(() => expect(rowConf('leads')).toBe('human'))
    const el = row('leads')!
    expect(el.getAttribute('class')).toContain('bg-[#F2FBF6]')
    const seal = el.querySelector('[data-stage0-premise-seal]')
    expect(seal?.textContent).toBe('不可篡改')
    expect(seal?.getAttribute('class')).toContain('text-[#1E9E66]')
    expect(rowConf('time')).toBe('none')
  })

  it('infer+pending → ai 行：「AI 拟稿」seal + bg-[#FDF8EE] + confirmation="ai"', async () => {
    installViewApi(briefOnlyRouter, [fact('f1', 'coreEvent')])
    renderView(canvas({ nodes: [doneBriefNode()] }))
    await findStage0('brief')
    await waitFor(() => expect(rowConf('coreEvent')).toBe('ai'))
    const el = row('coreEvent')!
    expect(el.getAttribute('class')).toContain('bg-[#FDF8EE]')
    const seal = el.querySelector('[data-stage0-premise-seal]')
    expect(seal?.textContent).toBe('AI 拟稿')
    expect(seal?.getAttribute('class')).toContain('text-[#B07E2A]')
  })

  it('混合共存：human / ai / none 三态行同卡并存各归其色', async () => {
    installViewApi(briefOnlyRouter, [
      fact('f1', 'leads', { source: 'user', status: 'confirmed' }),
      fact('f2', '时间'),
    ])
    renderView(canvas({ nodes: [doneBriefNode()] }))
    await findStage0('brief')
    await waitFor(() => expect(rowConf('leads')).toBe('human'))
    expect(rowConf('time')).toBe('ai')
    expect(rowConf('place')).toBe('none')
    expect(rowConf('coreEvent')).toBe('none')
    expect(rowConf('seasonBoundary')).toBe('none')
    expect(row('leads')?.textContent).toContain('不可篡改')
    expect(row('time')?.textContent).toContain('AI 拟稿')
    expect(row('place')?.querySelector('[data-stage0-premise-seal]')).toBeNull()
    expect(document.querySelectorAll('[data-stage0-premise-seal]')).toHaveLength(2)
  })

  it('背景档案区：background-seal 上屏 + 点击展开正文零回归', async () => {
    installViewApi(p => (p === BRIEF_PATH ? okJson(brief()) : p === BG_PATH ? okMd('# 档案\n\n背景档案正文') : fail('NOT_FOUND')))
    renderView(canvas({ nodes: [doneBriefNode()] }))
    const bg = await findStage0('background')
    expect(bg.querySelector('[data-stage0-background-seal]')?.textContent).toBe('不可篡改')
    expect(bg.textContent).not.toContain('背景档案正文')
    fireEvent.click(bg.querySelector('button')!)
    await waitFor(() => expect(bg.textContent).toContain('背景档案正文'))
  })

  it('capture emit 联动：新增 confirmed fact → 对应行 ai → human 翻转（AC4）', async () => {
    const { emit } = installViewApi(briefOnlyRouter, [fact('f1', '人物')])
    renderView(canvas({ nodes: [doneBriefNode()] }))
    await findStage0('brief')
    await waitFor(() => expect(rowConf('leads')).toBe('ai'))
    expect(row('leads')?.textContent).toContain('AI 拟稿')
    act(() => { emit([fact('f1', '人物', { status: 'confirmed' })]) })
    await waitFor(() => expect(rowConf('leads')).toBe('human'))
    expect(row('leads')?.textContent).toContain('不可篡改')
    expect(row('leads')?.textContent).not.toContain('AI 拟稿')
  })
})
