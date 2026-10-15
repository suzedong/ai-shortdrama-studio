// feature-003 · Stage0View 接线测试（契约 §6）
// 纯函数 select/parse 用例 + 组件四态/叠加态用例；window.api 仅桩 fileRead。
// 组件凭据为 data-stage0-*（非 data-testid），统一用容器选择器。
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasGate, CanvasNode, ProjectBrief, StepId } from '@shared/types'
import Stage0View from './Stage0View'
import {
  dirtyFieldLabel,
  parseBriefJson,
  selectStage0State,
} from './stage0/select'

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
