// feature-003 · Stage0View 接线测试（契约 §6）
// 纯函数 select/parse 用例 + 组件四态/叠加态用例；window.api 桩 fileRead / updateBrief（D-017）。
// 组件凭据为 data-stage0-*（非 data-testid），统一用容器选择器。
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasGate, CanvasNode, ProjectBrief, StepId } from '@shared/types'
import Stage0View from './Stage0View'
import {
  dirtyFieldLabel,
  parseBriefJson,
  selectStage0State,
} from './stage0/select'
import { _setStyleCatalogSnapshotForTest } from './style-catalog-store'

// feature-811：风格显示名/编辑面板选项消费 style:catalog 快照——prime 全 18 条（编辑面板 select 须含 C1 option），懒 ensure no-op
const primeEntry = (
  id: string, name: string,
  familyCode: StyleCatalogEntryDto['familyCode'], familyLabel: string,
  role: StyleCatalogEntryDto['role'],
): StyleCatalogEntryDto => ({
  id, name, familyCode, familyLabel, role,
  feasibility: 'high', auxiliaryCandidate: false,
  visualTraits: '', anchorWords: '', textureRecipe: '',
})
const PRIME_ENTRIES: StyleCatalogEntryDto[] = [
  primeEntry('A1', '数字电影写实', 'A', '写实影像系', 'main'),
  primeEntry('A2', '胶片电影感', 'A', '写实影像系', 'main'),
  primeEntry('A3', '年代胶片（千禧·90s·80s）', 'A', '写实影像系', 'backup'),
  primeEntry('A4', 'DV·CCD 数码复古', 'A', '写实影像系', 'backup'),
  primeEntry('A5', '黑白电影', 'A', '写实影像系', 'backup'),
  primeEntry('A7', '拟真人·仿真人动漫', 'A', '写实影像系', 'main'),
  primeEntry('B1', '清新生活流', 'B', '青春治愈系', 'main'),
  primeEntry('C1', '日式动漫', 'C', '动画插画系', 'main'),
  primeEntry('C2', '国漫·新中式插画', 'C', '动画插画系', 'main'),
  primeEntry('C5', '美式卡通', 'C', '动画插画系', 'backup'),
  primeEntry('C6', '扁平矢量·低多边形', 'C', '动画插画系', 'backup'),
  primeEntry('C7', '韩漫·精致美型', 'C', '动画插画系', 'main'),
  primeEntry('D1', '冷调悬疑', 'D', '类型氛围系', 'main'),
  primeEntry('D2', '赛博·科幻', 'D', '类型氛围系', 'main'),
  primeEntry('D3', '奇幻童话', 'D', '类型氛围系', 'backup'),
  primeEntry('D4', '暗黑·哥特', 'D', '类型氛围系', 'backup'),
  primeEntry('D5', '神话国风', 'D', '类型氛围系', 'main'),
  primeEntry('E1', '3D CG', 'E', '材质工艺系', 'main'),
]

const BRIEF_PATH = '立项单.v1.json'
const BG_PATH = '故事背景档案.md'

/* ── 凭据选择器（data-stage0-*）── */
const byStage0 = (name: string) => document.querySelector(`[data-stage0-${name}]`)

async function findStage0(name: string): Promise<Element> {
  let el: Element | null = null
  await waitFor(() => {
    el = byStage0(name)
    expect(el).not.toBeNull()
  })
  return el as unknown as Element
}

/* ── 夹具 ── */

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

type ReadResult =
  | { ok: true; content: string; format: 'json' | 'md' }
  | { ok: false; error: { code: string; message: string } }

/** 按路径分派的 fileRead 桩 */
function installFileRead(router: (path: string) => ReadResult | Promise<ReadResult>) {
  const spy = vi.fn(async ({ path }: { path: string }) => router(path))
  window.api = { fileRead: spy } as unknown as Window['api']
  // feature-008：capture 空 facts 桩（链态条订阅兼容；同 installUpdateBrief 叠加模式）
  ;(window.api as unknown as { captureList: unknown }).captureList = vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] }))
  ;(window.api as unknown as { onCaptureChanged: unknown }).onCaptureChanged = vi.fn(() => () => undefined)
  return spy
}

/** D-017：立项直改桩（在 installFileRead 之后叠加到 window.api） */
function installUpdateBrief(impl?: (patch: unknown) => Promise<unknown>) {
  const spy = vi.fn(async (patch: unknown) => impl ? impl(patch) : {
    ok: true, version: 2,
    jsonPath: '立项单.v2.json', mdPath: '立项单.v2.md',
    impactReportPath: '影响清单.v1-v2.json',
    changes: [] as unknown[], items: [] as unknown[], markedDirty: [] as string[],
  })
  ;(window.api as unknown as { updateBrief: unknown }).updateBrief = spy
  return spy
}

const okJson = (b: ProjectBrief): ReadResult => ({ ok: true, content: JSON.stringify(b), format: 'json' })
const okMd = (content: string): ReadResult => ({ ok: true, content, format: 'md' })
const fail = (code: string): ReadResult => ({ ok: false, error: { code, message: code } })

function renderView(c: Canvas) {
  const onBackToDag = vi.fn()
  const utils = render(
    <React.StrictMode>
      <Stage0View canvas={c} projectTitle="安妮的夏天" onBackToDag={onBackToDag} />
    </React.StrictMode>,
  )
  return { onBackToDag, ...utils }
}

beforeEach(() => {
  vi.restoreAllMocks()
  _setStyleCatalogSnapshotForTest({ status: 'ok', version: 'v1.46', entries: PRIME_ENTRIES })
})

afterEach(() => {
  act(() => { _setStyleCatalogSnapshotForTest(null) })
})

/* ── §6.1 selectStage0State ── */

describe('selectStage0State', () => {
  it('无任何节点 → empty / null / 零脏', () => {
    const s = selectStage0State(canvas())
    expect(s.phase).toBe('empty')
    expect(s.briefNode).toBeNull()
    expect(s.gate0).toBeNull()
    expect(s.gatePending).toBe(false)
    expect(s.dirtyCount).toBe(0)
    expect(s.version).toBeNull()
  })

  it('step-0-brief 仅 active（非 done）→ empty', () => {
    const s = selectStage0State(canvas({ nodes: [node({ id: 'step-0-brief', status: 'active' })] }))
    expect(s.phase).toBe('empty')
    expect(s.briefNode).toBeNull()
  })

  it('done 的 n-brief（dev 夹具 id）不被认作 briefNode', () => {
    const s = selectStage0State(canvas({ nodes: [node({ id: 'n-brief', status: 'done', meta: { version: 'v3' } })] }))
    expect(s.phase).toBe('empty')
    expect(s.briefNode).toBeNull()
    expect(s.version).toBeNull()
  })

  it('done 的 step-0-brief → published + 版本解析', () => {
    const s = selectStage0State(canvas({ nodes: [doneBriefNode('v3')] }))
    expect(s.phase).toBe('published')
    expect(s.briefNode?.id).toBe('step-0-brief')
    expect(s.version).toBe(3)
  })

  it('meta.version 非法 → version:null', () => {
    const s = selectStage0State(canvas({ nodes: [doneBriefNode('x')] }))
    expect(s.version).toBeNull()
  })

  it('多个 0-final 门 → 取最后一个', () => {
    const s = selectStage0State(canvas({
      nodes: [doneBriefNode()],
      gates: [
        gate({ status: 'rejected', question: '第一次' }),
        gate({ status: 'pending', question: '第二次' }),
      ],
    }))
    expect(s.gate0?.question).toBe('第二次')
    expect(s.gatePending).toBe(true)
  })

  it('门三态：pending / approved / rejected', () => {
    for (const status of ['pending', 'approved', 'rejected'] as const) {
      const s = selectStage0State(canvas({ nodes: [doneBriefNode()], gates: [gate({ status })] }))
      expect(s.gate0?.status).toBe(status)
      expect(s.gatePending).toBe(status === 'pending')
    }
  })

  it('dirty：计数 + 字段并集去重保序 + 中文标签回退', () => {
    const c = canvas({
      nodes: [
        doneBriefNode(),
        node({
          id: 'step-1-outline', step: '1' as StepId, kind: 'outline', status: 'done',
          dirty: { sinceBriefVersion: 1, latestBriefVersion: 2, fields: ['fiveElements.genre', 'premise.place'], severity: 'high', impactReport: '影响清单.v1-v2.json' },
        }),
        node({
          id: 'step-4-storyboard', step: '4' as StepId, kind: 'storyboard', status: 'done',
          dirty: { sinceBriefVersion: 1, latestBriefVersion: 2, fields: ['premise.place', 'unknown.field'], severity: 'medium', impactReport: '影响清单.v1-v2.json' },
        }),
      ],
    })
    const s = selectStage0State(c)
    expect(s.dirtyCount).toBe(2)
    expect(s.dirtyFields).toEqual(['fiveElements.genre', 'premise.place', 'unknown.field'])
    expect(s.dirtyFields.map(dirtyFieldLabel)).toEqual(['题材', '地点', 'unknown.field'])
  })
})

/* ── §6.1 parseBriefJson ── */

describe('parseBriefJson', () => {
  it('合法 v1 / v2 文本 → ok', () => {
    expect(parseBriefJson(JSON.stringify(brief({ version: 1 }))).ok).toBe(true)
    expect(parseBriefJson(JSON.stringify(brief({ version: 2 }))).ok).toBe(true)
  })

  it('非法 JSON → NOT_JSON', () => {
    const r = parseBriefJson('{坏了')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('NOT_JSON')
  })

  it('schemaVersion ≠ 2 → UNSUPPORTED_SHAPE', () => {
    const r = parseBriefJson(JSON.stringify({ ...brief(), schemaVersion: 1 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('UNSUPPORTED_SHAPE')
  })

  it('缺 premise → UNSUPPORTED_SHAPE', () => {
    const b = brief()
    delete (b as Partial<ProjectBrief>).premise
    const r = parseBriefJson(JSON.stringify(b))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('UNSUPPORTED_SHAPE')
  })

  it('缺 approve → UNSUPPORTED_SHAPE', () => {
    const b = brief()
    delete (b as Partial<ProjectBrief>).approve
    const r = parseBriefJson(JSON.stringify(b))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('UNSUPPORTED_SHAPE')
  })
})

/* ── §6.2 组件 ── */

describe('Stage0View · empty', () => {
  it('空态凭据齐全；假数据/演示控制条/立项主体零出现；不发文件读取', () => {
    const spy = installFileRead(() => fail('NO_PROJECT'))
    renderView(canvas())

    expect(byStage0('empty')).not.toBeNull()
    expect(screen.getByText('立项尚未定案')).toBeInTheDocument()
    expect(byStage0('brief')).toBeNull()
    // feature-025 原型假数据不得残留
    expect(screen.queryByText(/安妮的夏天：/)).not.toBeInTheDocument()
    expect(byStage0('gate-pending')).toBeNull()
    expect(byStage0('dirty-bar')).toBeNull()
    // 空态不触发任何文件读取
    expect(spy).not.toHaveBeenCalled()
  })

  it('门 pending 叠加空态：镜像条出现且中栏无审批按钮', () => {
    installFileRead(() => fail('NO_PROJECT'))
    renderView(canvas({ gates: [gate({ status: 'pending' })] }))

    expect(byStage0('gate-pending')).not.toBeNull()
    expect(screen.getByText('立项单已定稿待你批准')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /批准/ })).toBeNull()
  })

  it('门 rejected 叠加空态：驳回文案', () => {
    installFileRead(() => fail('NO_PROJECT'))
    renderView(canvas({ gates: [gate({ status: 'rejected' })] }))
    expect(screen.getByText(/立项定案门被驳回/)).toBeInTheDocument()
  })
})

describe('Stage0View · published v1 门批', () => {
  it('字段逐值渲染；版本以文件内 brief.version 为准；背景档案成功显折叠区', async () => {
    const b = brief()
    const spy = installFileRead(p => p === BG_PATH ? okMd('# 背景档案正文') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode('v1')], gates: [gate({ status: 'approved' })] }))

    await findStage0('brief')

    // 凭据落在主体 chip，值取文件内 version（D-004）
    await waitFor(() => expect(byStage0('version')?.getAttribute('data-stage0-version')).toBe('1'))
    expect(screen.getByText('立项单 v1')).toBeInTheDocument()
    expect(screen.getByText('来源：' + BRIEF_PATH)).toBeInTheDocument()

    // 六要素逐值
    expect(screen.getByText('都市甜宠')).toBeInTheDocument()
    expect(screen.getByText('抖音 · 红果')).toBeInTheDocument()
    expect(screen.getByText('90 秒')).toBeInTheDocument()
    expect(screen.getByText('80 集')).toBeInTheDocument()
    expect(screen.getByText('轻松治愈')).toBeInTheDocument()
    expect(screen.getByText('竖屏 9:16')).toBeInTheDocument()
    // 前提五项
    expect(screen.getByText('林夏与顾屿')).toBeInTheDocument()
    // 风格引用
    expect(byStage0('style')?.textContent).toContain('A7')
    expect(byStage0('style')?.textContent).toContain('v1.46')
    // v1 文案 + 门批
    expect(screen.getByText('首版立项')).toBeInTheDocument()
    expect(screen.getByText('门批准入')).toBeInTheDocument()
    // 无诊断时不渲染诊断结论块
    expect(screen.queryByText('选题诊断结论')).not.toBeInTheDocument()
    // 门已批 → 无待决条；无脏 → 无黄条
    expect(byStage0('gate-pending')).toBeNull()
    expect(byStage0('dirty-bar')).toBeNull()

    // 背景折叠默认收起：点击展开正文
    const bg = await findStage0('background')
    expect(bg.textContent).not.toContain('背景档案正文')
    fireEvent.click(screen.getByRole('button', { name: /故事背景档案/ }))
    await waitFor(() => expect(bg.textContent).toContain('背景档案正文'))

    // StrictMode 开发态双调用 effect：每路径各读 2 次；seq 序号防护保证
    // 双响应下状态仍一致（生产态无 StrictMode 双发时各 1 次）。
    expect(spy.mock.calls.filter(([a]) => a.path === BRIEF_PATH)).toHaveLength(2)
    expect(spy.mock.calls.filter(([a]) => a.path === BG_PATH)).toHaveLength(2)
    // 双响应未产生陈旧错乱：主体仍只渲染一份
    expect(screen.getAllByText('立项单 v1')).toHaveLength(1)
  })

  it('背景档案 NOT_FOUND → 静默无折叠区', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    await waitFor(() => expect(byStage0('background')).toBeNull())
  })

  it('背景档案其他错误（TOO_LARGE）→ 折叠区保留，展开显弱化错误文案', async () => {
    installFileRead(p => p === BG_PATH ? fail('TOO_LARGE') : okJson(brief()))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    const bg = await findStage0('background')
    fireEvent.click(screen.getByRole('button', { name: /故事背景档案/ }))
    await waitFor(() => expect(bg.textContent).toContain('背景档案读取失败'))
  })

  it('待定值显中性徽标；口头拍板原话引用出现', async () => {
    const b = brief({
      fiveElements: { ...brief().fiveElements, tone: '待定' },
      approve: { at: '2026-10-15T09:00:00.000Z', by: 'verbal', verbal: { quote: '就按这个方向做' } },
    })
    installFileRead(() => okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')

    expect(screen.getAllByText('待定').length).toBeGreaterThan(0)
    expect(screen.getByText('口头拍板')).toBeInTheDocument()
    expect(byStage0('verbal-quote')?.textContent).toContain('就按这个方向做')
  })
})

describe('Stage0View · published v2 + 叠加态', () => {
  it('v2 变更条数文案 + 脏读黄条 + 门 pending 叠加（中栏无按钮）', async () => {
    const b = brief({
      version: 2,
      changesFromPrevious: [
        { field: 'fiveElements.genre', from: '旧', to: '新' },
        { field: 'premise.place', from: '旧', to: '新' },
      ],
    })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    const dirtyNode = node({
      id: 'step-1-outline', step: '1' as StepId, kind: 'outline', status: 'done',
      dirty: { sinceBriefVersion: 1, latestBriefVersion: 2, fields: ['fiveElements.genre'], severity: 'high', impactReport: '影响清单.v1-v2.json' },
    })
    renderView(canvas({ nodes: [doneBriefNode('v2'), dirtyNode], gates: [gate({ status: 'pending' })] }))

    await findStage0('brief')
    await waitFor(() => expect(screen.getByText('相对 v1 共 2 处变更')).toBeInTheDocument())

    const bar = (await findStage0('dirty-bar')) as HTMLElement
    expect(bar.textContent).toContain('有 1 个产物基于旧版立项')
    expect(bar.textContent).toContain('题材')

    expect(byStage0('gate-pending')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /批准/ })).toBeNull()
  })

  it('canvas prop 由 pending 变 approved（rerender）→ 自动转定案态', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    const c = canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'pending' })] })
    const utils = renderView(c)
    await findStage0('gate-pending')

    const approved = { ...c, gates: [gate({ status: 'approved' })] }
    act(() => {
      utils.rerender(
        <React.StrictMode>
          <Stage0View canvas={approved} projectTitle="安妮的夏天" onBackToDag={utils.onBackToDag} />
        </React.StrictMode>,
      )
    })
    await waitFor(() => expect(byStage0('gate-pending')).toBeNull())
  })
})

describe('Stage0View · 读失败 / 加载 / 返回', () => {
  it('节点缺 json ref → MISSING_REF 错误态，且不发 IPC', async () => {
    const spy = installFileRead(() => okJson(brief()))
    const noRef = node({ id: 'step-0-brief', status: 'done', ref: undefined })
    renderView(canvas({ nodes: [noRef], gates: [gate({ status: 'approved' })] }))
    expect((await findStage0('brief-error')).textContent).toContain('立项产物引用缺失')
    expect(spy).not.toHaveBeenCalled()
  })

  it('立项单 NOT_FOUND → 错误凭据含路径', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : fail('NOT_FOUND'))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    const err = await findStage0('brief-error')
    expect(err.textContent).toContain('立项单文件缺失')
    expect(err.textContent).toContain(BRIEF_PATH)
  })

  it('立项单坏 JSON → 先经 loading 再显 NOT_JSON 文案', async () => {
    let resolveRead: (v: ReadResult) => void = () => {}
    const pending = new Promise<ReadResult>(res => { resolveRead = res })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : pending)
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))

    expect(await findStage0('loading')).not.toBeNull()
    act(() => resolveRead({ ok: true, content: '{坏', format: 'json' }))
    const err = await findStage0('brief-error')
    expect(err.textContent).toContain('不是合法 JSON')
  })

  it('返回按钮点击 → onBackToDag 触发一次（published 态）', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    const h = renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    const buttons = screen.getAllByRole('button', { name: '← 返回画布' })
    fireEvent.click(buttons[0])
    expect(h.onBackToDag).toHaveBeenCalledTimes(1)
  })
})

/* ── B-22 视觉风格名称 ── */

describe('Stage0View · 视觉风格显示名称（B-22）', () => {
  it('已知 ID → 主风格行与辅助徽标均显「ID · 名称」', async () => {
    const b = brief({ style: { mainStyleId: 'A7', catalogVersion: 'v1.46', auxiliaryStyleId: 'D1' } })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    expect(byStage0('style')?.textContent).toContain('A7 · 拟真人·仿真人动漫')
    expect(byStage0('style')?.textContent).toContain('v1.46')
    expect(screen.getByText('辅助 D1 · 冷调悬疑')).toBeInTheDocument()
  })

  it('未知 ID → 主风格回退只显 ID（不拼名称）', async () => {
    const b = brief({ style: { mainStyleId: 'Z9', catalogVersion: 'v9.9' } })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    const txt = byStage0('style')?.textContent ?? ''
    expect(txt).toContain('主风格 Z9 · 谱系 v9.9')
    expect(txt).not.toContain('拟真人')
  })
})

/* ── D-018 定案区入口动作恒显 + 卡①诊断明细 ── */

describe('Stage0View · 入口动作恒显与诊断明细（D-018）', () => {
  it('gate 拍板：入口动作显「门批准入 · 一键拍板」，无原话块', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    const entry = await findStage0('entry-action')
    expect(entry.textContent).toContain('入口动作')
    expect(entry.textContent).toContain('门批准入 · 一键拍板')
    expect(byStage0('verbal-quote')).toBeNull()
  })

  it('verbal 拍板：入口动作标「用户原话」并显引用块', async () => {
    const b = brief({
      approve: { at: '2026-10-15T09:00:00.000Z', by: 'verbal', verbal: { quote: '就按这个方向做' } },
    })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    const entry = await findStage0('entry-action')
    expect(entry.textContent).toContain('用户原话')
    expect(byStage0('verbal-quote')?.textContent).toContain('就按这个方向做')
  })

  it('ui 直改：入口动作显「修改立项面板 · 系统直改再版」', async () => {
    const b = brief({
      approve: { at: '2026-10-15T09:00:00.000Z', by: 'ui', note: '改集数' },
    })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    const entry = await findStage0('entry-action')
    expect(entry.textContent).toContain('系统直改')
    expect(entry.textContent).toContain('修改立项面板 · 系统直改再版')
    expect(byStage0('verbal-quote')).toBeNull()
  })

  it('卡①显诊断明细块（只读态与编辑态同显、恒只读无控件）', async () => {
    const b = brief({ diagnosisDetail: '赛道×钩子明细\n合规通过' })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    const detail = await findStage0('diagnosis-detail')
    expect(detail.textContent).toContain('选题诊断明细')
    expect(detail.textContent).toContain('赛道×钩子明细')
    // 编辑态：明细块仍在编辑卡内且只读（无输入控件）
    fireEvent.click(byStage0('edit-toggle') as HTMLElement)
    await findStage0('edit-panel')
    const detailInEdit = byStage0('diagnosis-detail')
    expect(detailInEdit).not.toBeNull()
    expect(detailInEdit!.querySelector('input,select,textarea')).toBeNull()
  })

  it('无 diagnosisDetail → 不渲染明细块', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    expect(byStage0('diagnosis-detail')).toBeNull()
  })

  it('卡①诊断明细分节可折叠：默认仅「结论」节展开，节题行点击开合（B-35 遗留切片）', async () => {
    const b = brief({
      diagnosisDetail: '【对标案例】\n案例 A 播放破亿。\n【爆点钩子】\n钩子库三条。\n【结论】\n可做。',
    })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    const detail = await findStage0('diagnosis-detail')
    // 默认：长文节收起、结论节展开；节题行恒渲染
    const toggle = () => detail.querySelector('[data-diagnosis-section-toggle="对标案例"]') as HTMLElement
    expect(toggle()).not.toBeNull()
    expect(detail.textContent).not.toContain('案例 A 播放破亿。')
    expect(detail.textContent).not.toContain('钩子库三条。')
    expect(detail.textContent).toContain('可做。')
    // 点击节题行展开；再点收起
    fireEvent.click(toggle())
    expect(detail.textContent).toContain('案例 A 播放破亿。')
    expect(detail.textContent).not.toContain('钩子库三条。')
    fireEvent.click(toggle())
    expect(detail.textContent).not.toContain('案例 A 播放破亿。')
    // 结论节也可手动收起
    fireEvent.click(detail.querySelector('[data-diagnosis-section-toggle="结论"]') as HTMLElement)
    expect(detail.textContent).not.toContain('可做。')
  })
})

/* ── B-24/D-017 修改立项：卡①行内六字段直改 → 系统直写再版（原则六 · 不经 AI 对话）── */

/** 编辑卡内按字段名取 input/select 控件 */
function editField(panel: Element, name: string): HTMLInputElement | HTMLSelectElement {
  const el = panel
    .querySelector(`[data-stage0-edit-field="${name}"]`)
    ?.querySelector('input,select')
  expect(el).not.toBeNull()
  return el as HTMLInputElement | HTMLSelectElement
}

describe('Stage0View · 修改立项（B-24/D-017 卡①行内系统直改）', () => {
  it('published 态显「修改立项…」入口；点击后卡①原位变编辑卡并预填六控件；无变更时提交禁用', async () => {
    const b = brief({ style: { mainStyleId: 'A7', catalogVersion: 'v1.46', auxiliaryStyleId: 'D1' } })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')

    const toggle = byStage0('edit-toggle') as HTMLElement
    expect(toggle).not.toBeNull()
    fireEvent.click(toggle)

    const panel = await findStage0('edit-panel')
    expect(panel.textContent).toContain('再版为 v2')
    expect(panel.textContent).toContain('不经 AI 对话')
    expect(editField(panel, 'kind').value).toBe('commercial')
    expect(editField(panel, 'episodeDuration').value).toBe('90 秒')
    expect(editField(panel, 'episodeCount').value).toBe('80 集')
    expect(editField(panel, 'aspectRatio').value).toBe('竖屏 9:16')
    expect(editField(panel, 'mainStyleId').value).toBe('A7')
    expect(editField(panel, 'auxiliaryStyleId').value).toBe('D1')

    expect((byStage0('edit-submit') as HTMLButtonElement).disabled).toBe(true)
    expect(panel.textContent).toContain('尚未修改任何字段')
  })

  it('修改集数、主风格与项目性质 → 提交直调 updateBrief（patch 仅含变更字段），面板关闭', async () => {
    const b = brief({
      version: 2,
      changesFromPrevious: [{ field: 'fiveElements.genre', from: '旧', to: '新' }],
    })
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(b))
    const updateBrief = installUpdateBrief()
    renderView(canvas({ nodes: [doneBriefNode('v2')], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    fireEvent.click(byStage0('edit-toggle') as HTMLElement)
    const panel = await findStage0('edit-panel')

    fireEvent.change(editField(panel, 'episodeCount'), { target: { value: '100 集' } })
    fireEvent.change(editField(panel, 'mainStyleId'), { target: { value: 'C1' } })
    fireEvent.change(editField(panel, 'kind'), { target: { value: 'memorial' } })

    expect(panel.textContent).toContain('共 3 处变更')
    const submitBtn = byStage0('edit-submit') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
    fireEvent.click(submitBtn)

    await waitFor(() => expect(updateBrief).toHaveBeenCalledTimes(1))
    expect(updateBrief).toHaveBeenCalledWith({
      kind: 'memorial',
      fiveElements: { episodeCount: '100 集' },
      style: { mainStyleId: 'C1' },
    })

    await waitFor(() => expect(byStage0('edit-panel')).toBeNull())
    expect(byStage0('edit-toggle')).not.toBeNull()
  })

  it('取消 → 面板关闭且不调 updateBrief', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    const updateBrief = installUpdateBrief()
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    fireEvent.click(byStage0('edit-toggle') as HTMLElement)
    await findStage0('edit-panel')
    fireEvent.click(byStage0('edit-cancel') as HTMLElement)
    await waitFor(() => expect(byStage0('edit-panel')).toBeNull())
    expect(updateBrief).not.toHaveBeenCalled()
  })

  it('清空集数 → 提交禁用（ELEMENT_MISSING 红线）', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    fireEvent.click(byStage0('edit-toggle') as HTMLElement)
    const panel = await findStage0('edit-panel')

    fireEvent.change(editField(panel, 'episodeCount'), { target: { value: '  ' } })
    await waitFor(() => {
      expect((byStage0('edit-submit') as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('再版失败 → 错误条显原因，面板保持打开且按钮恢复可点', async () => {
    installFileRead(p => p === BG_PATH ? fail('NOT_FOUND') : okJson(brief()))
    installUpdateBrief(() => Promise.reject(new Error('尚无已发布立项，不存在再版基线')))
    renderView(canvas({ nodes: [doneBriefNode()], gates: [gate({ status: 'approved' })] }))
    await findStage0('brief')
    fireEvent.click(byStage0('edit-toggle') as HTMLElement)
    const panel = await findStage0('edit-panel')

    fireEvent.change(editField(panel, 'episodeCount'), { target: { value: '100 集' } })
    fireEvent.click(byStage0('edit-submit') as HTMLElement)

    const err = await findStage0('edit-error')
    expect(err.textContent).toContain('再版失败')
    expect(err.textContent).toContain('尚无已发布立项')
    expect(byStage0('edit-panel')).not.toBeNull()
    await waitFor(() => {
      expect((byStage0('edit-submit') as HTMLButtonElement).disabled).toBe(false)
    })
  })
})
