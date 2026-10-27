// feature-008 · 立项过程链式呈现测试（契约 §5）
// 四组：① 纯函数词表与进度（AC1）；② 纯函数节点状态与 payload 守卫（AC2）；
// ③ Stage0Chain 组件订阅与摘要交互（AC3-AC4，capture 两桥内存 mock，capture-bar.test.tsx L60-63 同模式）；
// ④ Stage0View 集成（AC5，三布局恒显 + 双卡凭据零回归）。
// 组件凭据为 data-stage0-chain*（非 data-testid），统一用容器选择器。
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasGate, CanvasNode, CaptureFile, CapturedFact, ProjectBrief, StepId } from '@shared/types'
import Stage0Chain from './Stage0Chain'
import Stage0View from './Stage0View'
import {
  gatePayloadVersion,
  matchChainTopic,
  selectChainNodes,
  selectChainProgress,
} from './stage0/chain'
import type { Stage0State } from './stage0/select'
import { _setStyleCatalogSnapshotForTest } from './style-catalog-store'

/* ── 选择器（querySelector 取首个匹配，兼容 brief-error 嵌套双链态条）── */

const byStage0 = (name: string) => document.querySelector(`[data-stage0-${name}]`)
// 无值 data-stage0-chain 属性（容器）与带值（diag/premise）并存；文档序首匹配即容器
const byChainRoot = () => document.querySelector('[data-stage0-chain]')
const byChain = (cred: 'diag' | 'premise') => document.querySelector(`[data-stage0-chain="${cred}"]`)
const byChainGate = () => document.querySelector('[data-stage0-chain-gate]')
const byChainSummary = () => document.querySelector('[data-stage0-chain-gate-summary]')
const byChainError = () => document.querySelector('[data-stage0-chain-error]')

async function findStage0(name: string) {
  await waitFor(() => expect(byStage0(name)).not.toBeNull())
  return byStage0(name)
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

function state(over: Partial<Stage0State> = {}): Stage0State {
  return {
    phase: 'empty',
    briefNode: null,
    gate0: null,
    gatePending: false,
    dirtyCount: 0,
    dirtyFields: [],
    version: null,
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

function gate(partial: Partial<CanvasGate> & { status: CanvasGate['status'] }): CanvasGate {
  return { gateId: '0-final', question: '是否批准立项？', options: ['批准', '驳回'], ...partial }
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

const doneBriefNode = (version = 'v1') => node({
  id: 'step-0-brief',
  status: 'done',
  title: '立项单',
  ref: { path: version === 'v1' ? BRIEF_PATH : `立项单.${version}.json`, format: 'json' },
  meta: { version },
})

/* ── window.api 桩 ── */

/** capture 两桥内存 mock（capture-bar.test.tsx L60-63 同模式：listeners Set + emit 全量广播） */
function installCapture(initial: CapturedFact[]) {
  const listeners = new Set<(file: CaptureFile) => void>()
  const listSpy = vi.fn(async () => ({ schemaVersion: 1 as const, facts: initial }))
  window.api = {
    captureList: listSpy,
    onCaptureChanged: (cb: (file: CaptureFile) => void) => {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
  } as unknown as Window['api']
  return {
    listSpy,
    emit(next: CapturedFact[]) {
      listeners.forEach(cb => cb({ schemaVersion: 1, facts: next }))
    },
  }
}

function installCaptureReject() {
  window.api = {
    captureList: vi.fn(async () => { throw new Error('capture down') }),
    onCaptureChanged: vi.fn(() => () => undefined),
  } as unknown as Window['api']
}

type ReadResult =
  | { ok: true; content: string; format: 'json' | 'md' }
  | { ok: false; error: { code: string; message: string } }

const okJson = (b: ProjectBrief): ReadResult => ({ ok: true, content: JSON.stringify(b), format: 'json' })
const fail = (code: string): ReadResult => ({ ok: false, error: { code, message: code } })

/** Stage0View 集成桩：fileRead 路由 + capture 两桥（stage0-view.test.tsx installFileRead 同形） */
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
}

function renderView(c: Canvas) {
  const onBackToDag = vi.fn()
  const utils = render(
    <React.StrictMode>
      <Stage0View canvas={c} projectTitle="安妮的夏天" onBackToDag={onBackToDag} />
    </React.StrictMode>,
  )
  return { onBackToDag, ...utils }
}

/* ── 全局钩子（风格目录 prime/复位，stage0-view.test.tsx L168-175 同模式）── */

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

/* ── ① 纯函数：词表与进度（AC1）── */

describe('matchChainTopic / selectChainProgress（AC1）', () => {
  it('六要素英文推荐词全命中 six 组', () => {
    const cases: [string, string][] = [
      ['genre', 'genre'],
      ['platforms', 'platforms'],
      ['episodeDuration', 'episodeDuration'],
      ['episodeCount', 'episodeCount'],
      ['tone', 'tone'],
      ['aspectRatio', 'aspectRatio'],
    ]
    for (const [topic, key] of cases) {
      expect(matchChainTopic(topic)).toEqual({ group: 'six', key })
    }
  })

  it('前提英文推荐词全命中 premise 组', () => {
    const cases: [string, string][] = [
      ['leads', 'leads'],
      ['time', 'time'],
      ['place', 'place'],
      ['coreEvent', 'coreEvent'],
      ['seasonBoundary', 'seasonBoundary'],
    ]
    for (const [topic, key] of cases) {
      expect(matchChainTopic(topic)).toEqual({ group: 'premise', key })
    }
  })

  it('中文别名逐条命中 canonical', () => {
    expect(matchChainTopic('题材')).toEqual({ group: 'six', key: 'genre' })
    expect(matchChainTopic('题材赛道')).toEqual({ group: 'six', key: 'genre' })
    expect(matchChainTopic('平台')).toEqual({ group: 'six', key: 'platforms' })
    expect(matchChainTopic('目标平台')).toEqual({ group: 'six', key: 'platforms' })
    expect(matchChainTopic('单集时长')).toEqual({ group: 'six', key: 'episodeDuration' })
    expect(matchChainTopic('时长')).toEqual({ group: 'six', key: 'episodeDuration' })
    expect(matchChainTopic('集数')).toEqual({ group: 'six', key: 'episodeCount' })
    expect(matchChainTopic('风格基调')).toEqual({ group: 'six', key: 'tone' })
    expect(matchChainTopic('基调')).toEqual({ group: 'six', key: 'tone' })
    expect(matchChainTopic('画幅')).toEqual({ group: 'six', key: 'aspectRatio' })
    expect(matchChainTopic('人物')).toEqual({ group: 'premise', key: 'leads' })
    expect(matchChainTopic('时间')).toEqual({ group: 'premise', key: 'time' })
    expect(matchChainTopic('地点')).toEqual({ group: 'premise', key: 'place' })
    expect(matchChainTopic('核心事件')).toEqual({ group: 'premise', key: 'coreEvent' })
    expect(matchChainTopic('本季边界')).toEqual({ group: 'premise', key: 'seasonBoundary' })
    expect(matchChainTopic('季边界')).toEqual({ group: 'premise', key: 'seasonBoundary' })
  })

  it('trim + 英文大小写不敏感', () => {
    expect(matchChainTopic('  Genre ')).toEqual({ group: 'six', key: 'genre' })
    expect(matchChainTopic('EPISODEDURATION')).toEqual({ group: 'six', key: 'episodeDuration' })
    expect(matchChainTopic(' SeasonBoundary\n')).toEqual({ group: 'premise', key: 'seasonBoundary' })
  })

  it('未命中 / 空串 / 纯空白 → null', () => {
    expect(matchChainTopic('预算')).toBeNull()
    expect(matchChainTopic('')).toBeNull()
    expect(matchChainTopic('   ')).toBeNull()
  })

  it('同 canonical 去重计 1；未命中计总数不计进度；按表序输出', () => {
    const p = selectChainProgress([
      fact('f1', 'Genre'),
      fact('f2', '题材'), // 与 f1 同 canonical → 去重
      fact('f3', '平台'),
      fact('f4', '核心事件'),
      fact('f5', '预算'), // 未命中
    ])
    expect(p.sixCovered).toEqual(['genre', 'platforms'])
    expect(p.premiseCovered).toEqual(['coreEvent'])
    expect(p.unmatchedCount).toBe(1)
    expect(p.totalFacts).toBe(5)
  })

  it('跨组不误配（six 词不进 premise 组，反之亦然）', () => {
    const p = selectChainProgress([fact('f1', '题材'), fact('f2', '人物')])
    expect(p.sixCovered).toEqual(['genre'])
    expect(p.premiseCovered).toEqual(['leads'])
  })
})

/* ── ② 纯函数：节点状态与 payload 守卫（AC2）── */

describe('selectChainNodes / gatePayloadVersion（AC2）', () => {
  it('empty 无 facts → 三节点 idle', () => {
    const n = selectChainNodes(state(), [])
    expect(n.diag).toEqual({ status: 'idle', covered: 0, total: 6 })
    expect(n.premise).toEqual({ status: 'idle', covered: 0, total: 5 })
    expect(n.gate).toEqual({ status: 'idle', version: null })
  })

  it('有 facts → collecting x/6、x/5', () => {
    const n = selectChainNodes(state(), [
      fact('f1', 'genre'),
      fact('f2', 'tone'),
      fact('f3', '人物'),
    ])
    expect(n.diag).toEqual({ status: 'collecting', covered: 2, total: 6 })
    expect(n.premise).toEqual({ status: 'collecting', covered: 1, total: 5 })
  })

  it('published → 双步骤 final + 已发布 vN', () => {
    const n = selectChainNodes(
      state({ phase: 'published', briefNode: doneBriefNode('v3'), version: 3 }),
      [fact('f1', 'genre')],
    )
    expect(n.diag.status).toBe('final')
    expect(n.premise.status).toBe('final')
    expect(n.gate).toEqual({ status: 'published', version: 3 })
  })

  it('published 但版本不可解析 → final + version null', () => {
    const n = selectChainNodes(
      state({ phase: 'published', briefNode: doneBriefNode('x'), version: null }),
      [],
    )
    expect(n.diag.status).toBe('final')
    expect(n.gate).toEqual({ status: 'published', version: null })
  })

  it('pending（未发布）→ 步骤仍 collecting + 待拍板 vN', () => {
    const n = selectChainNodes(
      state({ gate0: gate({ status: 'pending', payload: { version: 5 } }), gatePending: true }),
      [fact('f1', 'genre')],
    )
    expect(n.diag.status).toBe('collecting')
    expect(n.gate).toEqual({ status: 'pending', version: 5 })
  })

  it('pending payload 非法形状 → version null', () => {
    const badPayloads: unknown[] = [{ version: '5' }, { version: 0 }, { version: 2.5 }, {}, null, 'v5']
    for (const payload of badPayloads) {
      const n = selectChainNodes(
        state({ gate0: gate({ status: 'pending', payload }), gatePending: true }),
        [],
      )
      expect(n.gate).toEqual({ status: 'pending', version: null })
    }
  })

  it('rejected（未发布）→ 被驳回', () => {
    const n = selectChainNodes(state({ gate0: gate({ status: 'rejected' }) }), [])
    expect(n.gate).toEqual({ status: 'rejected', version: null })
  })

  it('门优先级：published > pending > rejected > idle', () => {
    const published = selectChainNodes(
      state({
        phase: 'published',
        briefNode: doneBriefNode('v1'),
        version: 1,
        gate0: gate({ status: 'pending', payload: { version: 9 } }),
        gatePending: true,
      }),
      [],
    )
    expect(published.gate).toEqual({ status: 'published', version: 1 })

    const pending = selectChainNodes(
      state({ gate0: gate({ status: 'pending', payload: { version: 2 } }), gatePending: true }),
      [],
    )
    expect(pending.gate.status).toBe('pending')

    const rejected = selectChainNodes(state({ gate0: gate({ status: 'rejected' }) }), [])
    expect(rejected.gate.status).toBe('rejected')
  })

  it('gatePayloadVersion 最小形状守卫', () => {
    expect(gatePayloadVersion({ version: 1 })).toBe(1)
    expect(gatePayloadVersion({ version: 12 })).toBe(12)
    expect(gatePayloadVersion({ version: 0 })).toBeNull()
    expect(gatePayloadVersion({ version: -1 })).toBeNull()
    expect(gatePayloadVersion({ version: 1.5 })).toBeNull()
    expect(gatePayloadVersion({ version: '3' })).toBeNull()
    expect(gatePayloadVersion({})).toBeNull()
    expect(gatePayloadVersion(null)).toBeNull()
    expect(gatePayloadVersion(undefined)).toBeNull()
    expect(gatePayloadVersion('v3')).toBeNull()
  })
})

/* ── ③ Stage0Chain 组件（AC3-AC4）── */

describe('Stage0Chain 组件（AC3-AC4）', () => {
  it('三节点 + 左标「立项过程」+ 凭据齐全', async () => {
    installCapture([])
    render(<Stage0Chain state={state()} />)
    await act(async () => { await Promise.resolve() })
    expect(byChainRoot()?.textContent).toContain('立项过程')
    expect(byChain('diag')?.textContent).toContain('选题诊断')
    expect(byChain('diag')?.textContent).toContain('未开始')
    expect(byChain('premise')?.textContent).toContain('故事前提')
    expect(byChain('premise')?.textContent).toContain('未开始')
    expect(byChainGate()?.textContent).toContain('定案卡')
    expect(byChainGate()?.textContent).toContain('未就绪')
  })

  it('capture 首拉驱动精确进度（4/6、1/5）', async () => {
    installCapture([
      fact('f1', 'genre'),
      fact('f2', 'platforms'),
      fact('f3', 'episodeCount'),
      fact('f4', 'tone'),
      fact('f5', 'seasonBoundary'),
    ])
    render(<Stage0Chain state={state()} />)
    await waitFor(() => expect(byChain('diag')?.textContent).toContain('收敛中 4/6'))
    expect(byChain('premise')?.textContent).toContain('收敛中 1/5')
    expect(byChainGate()?.textContent).toContain('未就绪')
  })

  it('onCaptureChanged 推送联动更新进度', async () => {
    const { emit } = installCapture([])
    render(<Stage0Chain state={state()} />)
    await waitFor(() => expect(byChain('diag')?.textContent).toContain('未开始'))
    act(() => { emit([fact('f1', '题材'), fact('f2', '集数')]) })
    await waitFor(() => expect(byChain('diag')?.textContent).toContain('收敛中 2/6'))
  })

  it('captureList 首拉失败 → 空进度 + 口径读取失败小字', async () => {
    installCaptureReject()
    render(<Stage0Chain state={state()} />)
    await waitFor(() => expect(byChainError()?.textContent).toContain('口径读取失败'))
    expect(byChain('diag')?.textContent).toContain('未开始')
    expect(byChain('premise')?.textContent).toContain('未开始')
  })

  it('pending：点击展开只读摘要（question 全文 + 提示行 + 零按钮），再点收起', async () => {
    installCapture([])
    const question = '是否批准立项？\n题材：都市爱情\n平台：抖音'
    render(
      <Stage0Chain
        state={state({ gate0: gate({ status: 'pending', question, payload: { version: 2 } }), gatePending: true })}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(byChainGate()?.textContent).toContain('待拍板 v2')
    expect(byChainSummary()).toBeNull()

    fireEvent.click(byChainGate()!)
    const summary = byChainSummary()
    expect(summary?.textContent).toContain('立项定案卡 · 待拍板 v2')
    expect(summary?.textContent).toContain('是否批准立项？')
    expect(summary?.textContent).toContain('题材：都市爱情')
    expect(summary?.textContent).toContain('平台：抖音')
    expect(summary?.textContent).toContain('批准 / 驳回在右栏门卡操作')
    expect(summary?.querySelector('button')).toBeNull()

    fireEvent.click(byChainGate()!)
    expect(byChainSummary()).toBeNull()
  })

  it('pending payload 版本不可得 → 徽标与摘要标题无版本号', async () => {
    installCapture([])
    render(
      <Stage0Chain
        state={state({ gate0: gate({ status: 'pending', payload: { version: '2' } }), gatePending: true })}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(byChainGate()?.textContent).toContain('待拍板')
    expect(byChainGate()?.textContent).not.toContain('待拍板 v')
    fireEvent.click(byChainGate()!)
    expect(byChainSummary()?.textContent).toContain('立项定案卡 · 待拍板')
  })

  it('非 pending 态（idle / rejected / published）门 chip 不可点、无浮层', async () => {
    installCapture([])
    const cases: [Stage0State, string][] = [
      [state(), '未就绪'],
      [state({ gate0: gate({ status: 'rejected' }) }), '被驳回'],
      [state({ phase: 'published', briefNode: doneBriefNode('v1'), version: 1 }), '已发布 v1'],
    ]
    for (const [s, badge] of cases) {
      const { unmount } = render(<Stage0Chain state={s} />)
      await act(async () => { await Promise.resolve() })
      const gateEl = byChainGate()!
      expect(gateEl.tagName).toBe('SPAN')
      expect(gateEl.textContent).toContain(badge)
      fireEvent.click(gateEl)
      expect(byChainSummary()).toBeNull()
      unmount()
    }
  })
})

/* ── ④ Stage0View 集成（AC5）── */

describe('Stage0View 集成（AC5）', () => {
  it('empty 态：链态条恒显，三节点「未开始 / 未开始 / 未就绪」', async () => {
    installViewApi(() => fail('NOT_FOUND'))
    renderView(canvas())
    await findStage0('empty')
    await waitFor(() => expect(byChainRoot()).not.toBeNull())
    expect(byChainRoot()?.textContent).toContain('立项过程')
    expect(byChain('diag')?.textContent).toContain('未开始')
    expect(byChain('premise')?.textContent).toContain('未开始')
    expect(byChainGate()?.textContent).toContain('未就绪')
  })

  it('empty 态 + pending 门：「待拍板 v2」+ 点击展开摘要', async () => {
    installViewApi(() => fail('NOT_FOUND'))
    renderView(canvas({ gates: [gate({ status: 'pending', payload: { version: 2 } })] }))
    await findStage0('empty')
    await waitFor(() => expect(byChainGate()?.textContent).toContain('待拍板 v2'))
    fireEvent.click(byChainGate()!)
    expect(byChainSummary()?.textContent).toContain('是否批准立项？')
    expect(byChainSummary()?.textContent).toContain('批准 / 驳回在右栏门卡操作')
  })

  it('published 态：「已定稿 / 已定稿 / 已发布 v1」+ 双卡凭据零回归', async () => {
    installViewApi(p => (p === BRIEF_PATH ? okJson(brief()) : fail('NOT_FOUND')))
    renderView(canvas({ nodes: [doneBriefNode('v1')] }))
    await findStage0('brief')
    await waitFor(() => expect(byChain('diag')?.textContent).toContain('已定稿'))
    expect(byChain('premise')?.textContent).toContain('已定稿')
    expect(byChainGate()?.textContent).toContain('已发布 v1')
    // 双卡主体零回归（feature-003 既有凭据）
    expect(byStage0('card-diagnosis')).not.toBeNull()
    expect(byStage0('card-premise')).not.toBeNull()
  })

  it('brief-error 态：链态条恒显（嵌套结构首匹配即外层恒显条）', async () => {
    installViewApi(p => (p === BRIEF_PATH ? fail('NOT_JSON') : fail('NOT_FOUND')))
    renderView(canvas({ nodes: [doneBriefNode('v1')] }))
    await findStage0('brief-error')
    expect(byChainRoot()).not.toBeNull()
    expect(byChain('diag')).not.toBeNull()
    expect(byChainGate()).not.toBeNull()
  })
})
