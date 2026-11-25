// feature-020 C5 · CanvasBoard 多步分组渲染测试（契约 §3，OD §2/§5，需求 AC-7/AC-9）
// 断言：按 step 动态分组、STAGE 列标题动态、跨组贝塞尔横边、无单步硬编码、空态步骤无关。
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasNode, CanvasViewStateRequest } from '@shared/types'
import CanvasBoard, { snapNode } from './CanvasBoard'
import StageNavPanel from './StageNavPanel'
import { activeDocument, canvasV4, withActiveDocument } from '../../test/canvas-fixtures'

function emptyCanvas(): Canvas {
  return canvasV4({
    projectId: 'p1', title: '测试项目', nodes: [], edges: [], gates: [],
    revision: 0, receipts: [], updatedAt: new Date().toISOString(),
  })
}

function node(partial: Partial<CanvasNode> & Pick<CanvasNode, 'id' | 'step' | 'kind' | 'title' | 'status'>): CanvasNode {
  return {
    ref: { path: `${partial.id}.json`, format: 'json' },
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

describe('C5 · CanvasBoard 多步分组', () => {
  it('无节点：步骤无关空态，不出现任何分组', () => {
    render(<CanvasBoard canvas={emptyCanvas()} />)
    expect(screen.getByText(/还没有任何产物/)).toBeInTheDocument()
    expect(screen.queryByText(/STAGE 0/)).not.toBeInTheDocument()
    expect(screen.queryByText(/STAGE 1/)).not.toBeInTheDocument()
  })

  it('仅第 0 步数据：只有立项组，不出现空的第 1 步组', () => {
    const c = emptyCanvas()
    activeDocument(c).nodes = [
      node({ id: 'step-0-diagnosis', step: '0', kind: 'diagnosis', title: '选题诊断', status: 'done' }),
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
    ]
    activeDocument(c).edges = [{ id: 'e-diag-brief', from: 'step-0-diagnosis', to: 'step-0-brief', auto: true }]
    render(<CanvasBoard canvas={c} />)

    expect(screen.getByText('STAGE 0 · 立项')).toBeInTheDocument()
    expect(screen.queryByText('STAGE 1 · 故事')).not.toBeInTheDocument()
  })

  it('第 0、1 步数据：横向两列 + 动态列标题 + outline/profiles 中文标签', () => {
    const c = emptyCanvas()
    activeDocument(c).nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
      node({ id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'done' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'active' }),
    ]
    activeDocument(c).edges = [
      { id: 'e-step-0-brief--step-1-outline', from: 'step-0-brief', to: 'step-1-outline', auto: true },
      { id: 'e-step-1-outline--step-1-profiles', from: 'step-1-outline', to: 'step-1-profiles', auto: true },
    ]
    const { container } = render(<CanvasBoard canvas={c} />)

    expect(screen.getByText('STAGE 0 · 立项')).toBeInTheDocument()
    expect(screen.getByText('STAGE 1 · 故事')).toBeInTheDocument()
    expect(screen.getAllByText('故事大纲').length).toBeGreaterThan(0)
    expect(screen.getAllByText('人物小传').length).toBeGreaterThan(0)
    // 跨步骤 auto 边以横向贝塞尔 path 呈现（既有边，仅展示）
    expect(container.querySelector('path[data-edge="e-step-0-brief--step-1-outline"]')).toBeTruthy()
    expect(container.querySelector('path[data-edge="e-step-1-outline--step-1-profiles"]')).toBeTruthy()
  })

  it('状态数据驱动：active 节点显示进行中，done 显示已完成', () => {
    const c = emptyCanvas()
    activeDocument(c).nodes = [
      node({ id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'active' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'pending' }),
    ]
    render(<CanvasBoard canvas={c} />)
    expect(screen.getByText('进行中')).toBeInTheDocument()
    expect(screen.getByText('待生成')).toBeInTheDocument()
  })

  it('仅第 0、1 步数据：不出现空的第 2 步组', () => {
    const c = emptyCanvas()
    activeDocument(c).nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'done' }),
    ]
    render(<CanvasBoard canvas={c} />)
    expect(screen.queryByText('STAGE 2 · 剧本分场')).not.toBeInTheDocument()
  })

  it('第 0、1、2 步数据：横向三列 + 标题「STAGE 2 · 剧本分场」+ scenes/dialogue 中文标签', () => {
    const c = emptyCanvas()
    activeDocument(c).nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'done' }),
      node({ id: 'step-2-scenes', step: '2', kind: 'scenes', title: '第一集分场', status: 'done' }),
      node({ id: 'step-2-dialogue', step: '2', kind: 'dialogue', title: '第一集台词', status: 'active' }),
    ]
    activeDocument(c).edges = [
      { id: 'e-step-1-profiles--step-2-scenes', from: 'step-1-profiles', to: 'step-2-scenes', auto: true },
      { id: 'e-step-2-scenes--step-2-dialogue', from: 'step-2-scenes', to: 'step-2-dialogue', auto: true },
    ]
    const { container } = render(<CanvasBoard canvas={c} />)

    expect(screen.getByText('STAGE 2 · 剧本分场')).toBeInTheDocument()
    expect(screen.getAllByText('第一集分场').length).toBeGreaterThan(0)
    expect(screen.getAllByText('第一集台词').length).toBeGreaterThan(0)
    // 1→2 跨步骤 auto 边以横向贝塞尔 path 呈现
    expect(container.querySelector('path[data-edge="e-step-1-profiles--step-2-scenes"]')).toBeTruthy()
    expect(container.querySelector('path[data-edge="e-step-2-scenes--step-2-dialogue"]')).toBeTruthy()
  })
})

// feature-002 · 脏读标识（契约 §6）：dirty 节点黄 ⚠ 角标 + 顶部黄条；不灰显、status 保持 done
describe('feature-002 · CanvasBoard 脏读标识', () => {
  it('dirty 节点：meta.version 旁黄 ⚠ 角标，hover 文案含中文字段；无 dirty 不渲染', () => {
    const c = emptyCanvas()
    activeDocument(c).nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单 v2', status: 'done', meta: { version: 'v2' } }),
      node({
        id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'done',
        meta: { version: 'v1' },
        parentReference: { briefVersion: 1, fields: ['fiveElements.episodeCount', 'premise.leads'] },
        dirty: {
          sinceBriefVersion: 1, latestBriefVersion: 2,
          fields: ['fiveElements.episodeCount', 'premise.leads'],
          severity: 'high', impactReport: '影响清单.v1-v2.json',
        },
      }),
    ]
    const { container } = render(<CanvasBoard canvas={c} />)

    const badge = container.querySelector('[data-dirty-badge="step-1-outline"]')
    expect(badge).toBeTruthy()
    expect(badge?.getAttribute('title')).toContain('基于 v1，与最新 v2 不一致：集数、人物')
    expect(badge?.textContent).toContain('⚠')
    // brief 节点自身不挂脏
    expect(container.querySelector('[data-dirty-badge="step-0-brief"]')).toBeNull()
  })

  it('有任一 dirty 节点：顶部黄条给出计数与最新版；无 dirty 时黄条不渲染', () => {
    const dirtyCanvas = emptyCanvas()
    activeDocument(dirtyCanvas).nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单 v3', status: 'done', meta: { version: 'v3' } }),
      node({
        id: 'step-2-scenes', step: '2', kind: 'scenes', title: '第一集分场', status: 'done',
        parentReference: { briefVersion: 1, fields: ['fiveElements.episodeCount'] },
        dirty: {
          sinceBriefVersion: 1, latestBriefVersion: 3, fields: ['fiveElements.episodeCount'],
          severity: 'medium', impactReport: '影响清单.v1-v3.json',
        },
      }),
    ]
    const { container, unmount } = render(<CanvasBoard canvas={dirtyCanvas} />)
    const banner = container.querySelector('[data-dirty-banner]')
    expect(banner?.textContent).toBe('有 1 个产物基于旧版立项（最新 v3），内容可能与最新立项不一致。')

    unmount()
    const clean = emptyCanvas()
    activeDocument(clean).nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单 v1', status: 'done', meta: { version: 'v1' } }),
      node({ id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'done' }),
    ]
    const r2 = render(<CanvasBoard canvas={clean} />)
    expect(r2.container.querySelector('[data-dirty-banner]')).toBeNull()
    expect(r2.container.querySelector('[data-dirty-badge]')).toBeNull()
  })
})

// feature-027 补 · 对齐参考线 + 自动吸附纯函数（对齐原型 rx-card ③）
describe('snapNode · 拖拽吸附', () => {
  const W = 168
  const H = 118

  it('x 左对齐：阈值内吸附到对方左边缘，参考线位置即对方 x', () => {
    const r = snapNode(103, 999, [{ x: 100, y: 400 }])
    expect(r.x).toBe(100)
    const g = r.guides.find(x => x.axis === 'v')
    expect(g?.pos).toBe(100)
    expect(g?.label).toBe('左对齐')
  })

  it('x 中线对齐：左边缘跨边贴近对方中线，参考线画在对方中线', () => {
    const r = snapNode(186, 999, [{ x: 100, y: 400 }]) // 左边 186 vs 中线 184
    expect(r.x).toBe(100 + W / 2)
    const g = r.guides.find(x => x.axis === 'v')
    expect(g?.pos).toBe(100 + W / 2)
    expect(g?.label).toBe('中线对齐')
  })

  it('x 右对齐：左边缘贴近对方右边（右参考线）', () => {
    const r = snapNode(269, 999, [{ x: 100, y: 400 }]) // 左边 269 vs 右边 268
    expect(r.x).toBe(100 + W)
    const g = r.guides.find(x => x.axis === 'v')
    expect(g?.pos).toBe(100 + W)
    expect(g?.label).toBe('右对齐')
  })

  it('y 上对齐与中线对齐', () => {
    const top = snapNode(999, 203, [{ x: 0, y: 200 }])
    expect(top.y).toBe(200)
    expect(top.guides.find(x => x.axis === 'h')?.label).toBe('上对齐')

    const mid = snapNode(999, 259 + 2, [{ x: 0, y: 200 }]) // 上边贴近对方中线 259
    expect(mid.y).toBe(200 + H / 2)
    const g = mid.guides.find(x => x.axis === 'h')
    expect(g?.pos).toBe(200 + H / 2)
    expect(g?.label).toBe('中线对齐')
  })

  it('阈值外不吸附，无参考线', () => {
    const r = snapNode(300, 300, [{ x: 100, y: 100 }], 8)
    expect(r.x).toBe(300)
    expect(r.y).toBe(300)
    expect(r.guides).toHaveLength(0)
    expect(r.snapped).toBe(false)
  })

  it('双轴同时命中：两条参考线（v + h）', () => {
    const r = snapNode(102, 202, [{ x: 100, y: 200 }])
    expect(r.x).toBe(100)
    expect(r.y).toBe(200)
    expect(r.guides.map(g => g.axis).sort()).toEqual(['h', 'v'])
    expect(r.snapped).toBe(true)
  })

  it('无其他节点：原样返回', () => {
    const r = snapNode(50, 60, [])
    expect({ x: r.x, y: r.y }).toEqual({ x: 50, y: 60 })
    expect(r.guides).toHaveLength(0)
  })

  // feature-027 补 · 三节点等距分布（对齐原型 rx-card ③：垂直等距 16px）
  it('垂直等距：被拖节点拖到两参考节点下方等距位时吸附 y，产出 ev 参考', () => {
    // 同列两参考节点节距 160；理想第三节顶边 28+320=348，间隙 42px
    const others = [{ x: 28, y: 28 }, { x: 28, y: 188 }]
    const r = snapNode(28, 350, others) // 350 距理想 348 = 2px ≤ 16
    expect(r.y).toBe(348)
    const g = r.guides.find(x => x.axis === 'ev')
    expect(g).toBeTruthy()
    expect(g?.label).toBe('垂直等距 42px')
    // 两条间隙参考线：28+118→188 间隙中点 167；188+118→348 间隙中点 327
    expect(g?.pos).toBe(167)
    expect(g?.posB).toBe(327)
  })

  it('垂直等距：被拖节点夹在两参考节点中间时吸附', () => {
    const others = [{ x: 28, y: 28 }, { x: 28, y: 348 }]
    // 中间理想顶边 = a + p = 28 + 160 = 188
    const r = snapNode(28, 190, others)
    expect(r.y).toBe(188)
    expect(r.guides.find(x => x.axis === 'ev')?.label).toBe('垂直等距 42px')
  })

  it('垂直等距：离理想位超过 16px 不吸附', () => {
    const others = [{ x: 28, y: 28 }, { x: 28, y: 188 }]
    const r = snapNode(28, 400, others) // 理想 348，差 52
    expect(r.y).toBe(400)
    expect(r.guides.find(x => x.axis === 'ev')).toBeFalsy()
  })

  it('垂直等距：参考节点不在同列（x 中线相距过远）不触发', () => {
    // 邻列 x=252，与被拖节点 x=28 中线相距 224 > COL_GAP(56)，不构成等距
    const others = [{ x: 252, y: 28 }, { x: 252, y: 188 }]
    const r = snapNode(28, 350, others)
    expect(r.y).toBe(350)
    expect(r.guides.find(x => x.axis === 'ev')).toBeFalsy()
  })

  it('水平等距：被拖节点拖到两参考节点右侧等距位时吸附 x，产出 eh 参考', () => {
    // 同行两参考节点 x=28 与 x=252（节距 224）；理想第三列左边 28+448=476
    const others = [{ x: 28, y: 100 }, { x: 252, y: 100 }]
    const r = snapNode(470, 100, others) // 距理想 476 = 6
    expect(r.x).toBe(476)
    const g = r.guides.find(x => x.axis === 'eh')
    expect(g).toBeTruthy()
    expect(g?.label).toBe('水平等距 56px')
  })
})

// feature-002 · STAGE 0 立项版本徽标三态（契约 §6.2，无新 IPC：N 取自画布）
describe('feature-002 · StageNavPanel STAGE 0 徽标', () => {
  function renderStage0(nodes: CanvasNode[]) {
    const { container } = render(<StageNavPanel nodes={nodes} activeStep={null} onSelect={() => {}} />)
    return container.querySelector('[data-stage-badge="0"]')
  }

  it('未发布（无 brief 版本、无 dirty）：沿用现状「空」', () => {
    const badge = renderStage0([])
    expect(badge?.textContent).toBe('空')
  })

  it('已发布且无 dirty：绿态 ✓ vN（取 brief 节点 meta.version）', () => {
    const badge = renderStage0([
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单 v2', status: 'done', meta: { version: 'v2' } }),
      node({ id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'done' }),
    ])
    expect(badge?.textContent).toBe('✓ v2')
    expect(badge?.className).toContain('bg-ok/10')
  })

  it('已发布且画布有 dirty：黄态 vN ⚠k，k 为全画布 dirty 数，N 取 dirty.latestBriefVersion', () => {
    const badge = renderStage0([
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单 v3', status: 'done', meta: { version: 'v3' } }),
      node({
        id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'done',
        parentReference: { briefVersion: 1, fields: ['premise.leads'] },
        dirty: {
          sinceBriefVersion: 1, latestBriefVersion: 3, fields: ['premise.leads'],
          severity: 'high', impactReport: '影响清单.v1-v3.json',
        },
      }),
      node({
        id: 'step-2-scenes', step: '2', kind: 'scenes', title: '第一集分场', status: 'done',
        parentReference: { briefVersion: 2, fields: ['fiveElements.episodeCount'] },
        dirty: {
          sinceBriefVersion: 2, latestBriefVersion: 3, fields: ['fiveElements.episodeCount'],
          severity: 'medium', impactReport: '影响清单.v2-v3.json',
        },
      }),
    ])
    expect(badge?.textContent).toBe('v3 ⚠2')
    expect(badge?.className).toContain('bg-warn/10')
  })
})

describe('feature-814 · 节点选择与资产关联展示', () => {
  it('广播刷新保留选中节点，并展示关联资产数量', () => {
    const outline = node({
      id: 'outline', step: '1', kind: 'outline', title: '故事大纲', status: 'active',
    })
    const profiles = node({
      id: 'profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'done',
      assetIds: ['asset-1', 'asset-2'],
    })
    const initial = withActiveDocument(emptyCanvas(), { nodes: [outline, profiles] })
    const onSelectNode = vi.fn()
    const { container, rerender } = render(
      <CanvasBoard canvas={initial} onSelectNode={onSelectNode} />,
    )

    fireEvent.click(container.querySelector('[data-node-id="profiles"]')!)
    expect(onSelectNode).toHaveBeenLastCalledWith('profiles')
    expect(screen.getByLabelText('关联资产 2 项')).toHaveTextContent('资产 2')

    rerender(
      <CanvasBoard
        canvas={withActiveDocument({ ...initial, revision: 1 }, {
          nodes: [{ ...outline }, { ...profiles }],
        })}
        onSelectNode={onSelectNode}
      />,
    )
    expect(container.querySelector('[data-node-id="profiles"]')?.className).toContain('border-violet')
    expect(container.querySelector('[data-node-id="outline"]')?.className).not.toContain('border-violet')
    expect(onSelectNode).toHaveBeenLastCalledWith('profiles')
  })
})

describe('feature-823 · 多创作页与自由画布交互', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  function boardCanvas(): Canvas {
    const base = emptyCanvas()
    const boardNode = (title: string, x = 0, status: CanvasNode['status'] = 'pending') => node({
      id: 'shared-node', step: '1', kind: 'outline', title, status,
      position: { x, y: 0 },
    })
    return {
      ...base,
      activePageId: 'page-a',
      revision: 7,
      pages: [
        {
          id: 'page-a', title: '页 A', activeCanvasId: 'canvas-a1',
          canvases: [
            { id: 'canvas-a1', title: '画布 A1', nodes: [boardNode('A1 节点')], edges: [], viewport: { x: 40, y: 50, zoom: 1.25 } },
            { id: 'canvas-a2', title: '画布 A2', nodes: [boardNode('A2 节点', 200)], edges: [], viewport: { x: -20, y: 30, zoom: 0.5 } },
          ],
        },
        {
          id: 'page-b', title: '页 B', activeCanvasId: 'canvas-b1',
          canvases: [{ id: 'canvas-b1', title: '画布 B1', nodes: [boardNode('B1 节点', 400)], edges: [], viewport: null }],
        },
      ],
    }
  }

  function mockBoardApi() {
    const command = vi.fn()
    const viewState = vi.fn(async (_request: CanvasViewStateRequest) => ({ ok: true as const }))
    window.api = {
      canvas: { command, viewState, onChange: vi.fn(() => () => {}) },
    } as unknown as Window['api']
    return { command, viewState }
  }

  function worldOf(container: HTMLElement): HTMLElement {
    return container.querySelectorAll('[data-canvas-bg]')[1] as HTMLElement
  }

  it('新建创作页与画布时携带完整目标和当前 revision', async () => {
    let current = boardCanvas()
    const { command } = mockBoardApi()
    command.mockImplementation(async request => {
      const next = structuredClone(current)
      if (request.type === 'page.create') {
        next.pages.push({
          id: 'page-c', title: '创作页 3', activeCanvasId: 'canvas-c1',
          canvases: [{ id: 'canvas-c1', title: '画布 1', nodes: [], edges: [], viewport: null }],
        })
        next.activePageId = 'page-c'
      } else if (request.type === 'canvas.create') {
        const page = next.pages.find(item => item.id === request.pageId)!
        page.canvases.push({ id: 'canvas-c2', title: '画布 2', nodes: [], edges: [], viewport: null })
        page.activeCanvasId = 'canvas-c2'
      }
      next.revision += 1
      current = next
      return { commandId: request.commandId, revision: next.revision, canvas: next }
    })
    render(<CanvasBoard canvas={current} />)

    fireEvent.click(screen.getByRole('button', { name: '新建创作页' }))
    expect(await screen.findByText('创作页 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '新建画布' }))
    expect(await screen.findByRole('option', { name: '画布 2' })).toBeInTheDocument()

    expect(command.mock.calls[0]?.[0]).toMatchObject({
      type: 'page.create', projectId: 'p1', expectedRevision: 7,
    })
    expect(command.mock.calls[1]?.[0]).toMatchObject({
      type: 'canvas.create', projectId: 'p1', pageId: 'page-c', expectedRevision: 8,
    })
  })

  it('页与画布改名使用最新 revision 和切换后的活动目标', async () => {
    let current = boardCanvas()
    const { command } = mockBoardApi()
    command.mockImplementation(async request => {
      const next = structuredClone(current)
      if (request.type === 'page.rename') {
        next.pages.find(page => page.id === request.pageId)!.title = request.title
      } else if (request.type === 'canvas.rename') {
        const page = next.pages.find(item => item.id === request.pageId)!
        page.canvases.find(canvas => canvas.id === request.canvasId)!.title = request.title
      }
      next.revision += 1
      current = next
      return { commandId: request.commandId, revision: next.revision, canvas: next }
    })
    render(<CanvasBoard canvas={current} />)

    fireEvent.click(screen.getByRole('button', { name: '重命名创作页' }))
    fireEvent.change(screen.getByDisplayValue('页 A'), { target: { value: '页 A 改名' } })
    fireEvent.click(screen.getByRole('button', { name: '保存页名' }))
    expect(await screen.findByText('页 A 改名')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重命名画布' }))
    fireEvent.change(screen.getByDisplayValue('画布 A1'), { target: { value: '画布 A1 改名' } })
    fireEvent.click(screen.getByRole('button', { name: '保存画布名' }))
    expect(await screen.findByRole('option', { name: '画布 A1 改名' })).toBeInTheDocument()
    expect(command.mock.calls[1]?.[0]).toMatchObject({
      type: 'canvas.rename', pageId: 'page-a', canvasId: 'canvas-a1', expectedRevision: 8,
    })
  })

  it('非空画布与创作页删除均需确认并发送 confirmNonEmpty', async () => {
    let current = boardCanvas()
    const { command } = mockBoardApi()
    command.mockImplementation(async request => {
      const next = structuredClone(current)
      if (request.type === 'canvas.delete') {
        const page = next.pages.find(item => item.id === request.pageId)!
        page.canvases = page.canvases.filter(canvas => canvas.id !== request.canvasId)
        page.activeCanvasId = 'canvas-a2'
      } else if (request.type === 'page.delete') {
        next.pages = next.pages.filter(page => page.id !== request.pageId)
        next.activePageId = 'page-b'
      }
      next.revision += 1
      current = next
      return { commandId: request.commandId, revision: next.revision, canvas: next }
    })
    render(<CanvasBoard canvas={current} />)

    fireEvent.click(screen.getByRole('button', { name: '删除画布' }))
    expect(command).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: '仍删除' }))
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: '删除创作页' }))
    fireEvent.click(await screen.findByRole('button', { name: '仍删除' }))
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2))

    expect(command.mock.calls[0]?.[0]).toMatchObject({ type: 'canvas.delete', confirmNonEmpty: true })
    expect(command.mock.calls[1]?.[0]).toMatchObject({ type: 'page.delete', confirmNonEmpty: true })
  })

  it('最后页与最后画布禁用删除并说明原因', () => {
    const { command } = mockBoardApi()
    const onError = vi.fn()
    render(<CanvasBoard canvas={emptyCanvas()} onError={onError} />)

    const deletePage = screen.getByRole('button', { name: '删除创作页' })
    const deleteCanvas = screen.getByRole('button', { name: '删除画布' })
    expect(deletePage).toBeDisabled()
    expect(deletePage).toHaveAttribute('title', '每个项目至少保留一个创作页')
    expect(deleteCanvas).toBeDisabled()
    expect(deleteCanvas).toHaveAttribute('title', '每个创作页至少保留一个画布')
    fireEvent.click(deletePage)
    fireEvent.click(deleteCanvas)
    expect(command).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('active.set 切换失败时回滚到原创作页', async () => {
    const { viewState } = mockBoardApi()
    const onError = vi.fn()
    viewState.mockRejectedValueOnce(new Error('写入失败'))
    const { container } = render(<CanvasBoard canvas={boardCanvas()} onError={onError} />)

    fireEvent.click(container.querySelector('[data-page-id="page-b"]')!)
    await waitFor(() => expect(onError).toHaveBeenCalledWith('切换创作页或画布失败：写入失败'))
    expect(container.querySelector('[data-page-id="page-a"]')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('A1 节点')).not.toHaveLength(0)
    expect(viewState).toHaveBeenCalledWith({
      type: 'active.set', projectId: 'p1', pageId: 'page-b', canvasId: 'canvas-b1', activeView: 'canvas',
    })
  })

  it('快速往返切换时，旧 active.set 失败不得回滚新目标', async () => {
    const { viewState } = mockBoardApi()
    const first = deferred<{ ok: true }>()
    viewState.mockReturnValueOnce(first.promise)
    viewState.mockResolvedValue({ ok: true })
    const onError = vi.fn()
    const { container } = render(<CanvasBoard canvas={boardCanvas()} onError={onError} />)

    fireEvent.click(container.querySelector('[data-page-id="page-b"]')!)
    fireEvent.click(container.querySelector('[data-page-id="page-a"]')!)
    fireEvent.click(container.querySelector('[data-page-id="page-b"]')!)
    await act(async () => {
      first.reject(new Error('旧请求失败'))
      try { await first.promise } catch { /* 已由组件处理 */ }
    })

    expect(onError).not.toHaveBeenCalled()
    expect(container.querySelector('[data-page-id="page-b"]')).toHaveAttribute('aria-selected', 'true')
  })

  it('每个画布恢复独立 viewport，同目标广播不抢回本港缩放', async () => {
    mockBoardApi()
    const initial = boardCanvas()
    const { container, rerender } = render(<CanvasBoard canvas={initial} />)
    const world = worldOf(container)
    expect(world.style.transform).toBe('translate(40px, 50px) scale(1.25)')

    fireEvent.change(screen.getByLabelText('当前画布'), { target: { value: 'canvas-a2' } })
    await waitFor(() => expect(world.style.transform).toBe('translate(-20px, 30px) scale(0.5)'))
    const viewport = container.querySelector('[data-canvas-bg]') as HTMLElement
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600,
      toJSON: () => ({}),
    } as DOMRect)
    fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 200 })
    expect(world.style.transform).toContain('scale(0.56)')

    const broadcast = structuredClone(initial)
    broadcast.pages[0]!.activeCanvasId = 'canvas-a2'
    rerender(<CanvasBoard canvas={broadcast} />)
    expect(world.style.transform).toContain('scale(0.56)')
  })

  it('滚轮 160ms 只保存一次，卸载取消旧定时器', async () => {
    const { viewState } = mockBoardApi()
    const initial = boardCanvas()
    const { container, unmount } = render(<CanvasBoard canvas={initial} />)
    const viewport = container.querySelector('[data-canvas-bg]') as HTMLElement
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 200 })
    fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 200 })
    expect(viewState).not.toHaveBeenCalled()
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(viewState).not.toHaveBeenCalled()
    await waitFor(() => expect(viewState).toHaveBeenCalledTimes(1))

    fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 200 })
    unmount()
    await new Promise(resolve => setTimeout(resolve, 180))
    expect(viewState).toHaveBeenCalledTimes(1)
  })

  it('pan 松手与用户 fit 各保存一次视口', async () => {
    const { viewState } = mockBoardApi()
    const { container } = render(<CanvasBoard canvas={boardCanvas()} />)
    const viewport = container.querySelector('[data-canvas-bg]') as HTMLElement
    viewport.setPointerCapture = vi.fn()
    viewport.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 150, clientY: 130, buttons: 1 })
    fireEvent.pointerUp(viewport, { pointerId: 1 })
    await waitFor(() => expect(viewState).toHaveBeenCalledTimes(1))
    expect(viewState.mock.calls[0]?.[0]).toMatchObject({
      type: 'viewport.set', pageId: 'page-a', canvasId: 'canvas-a1',
      viewport: { x: 90, y: 80, zoom: 1.25 },
    })

    fireEvent.click(screen.getByRole('button', { name: '适应内容' }))
    await waitFor(() => expect(viewState).toHaveBeenCalledTimes(2))
    expect(viewState.mock.calls[1]?.[0]).toMatchObject({
      type: 'viewport.set', viewport: { x: 0, y: 0, zoom: 0.5 },
    })
  })

  it('跨 STAGE 拖为负坐标时仅在 pointer-up 发送一次 node.move', async () => {
    const initial = boardCanvas()
    initial.pages[0]!.canvases[0]!.viewport = { x: 0, y: 0, zoom: 1 }
    const completion = deferred<{ commandId: string; revision: number; canvas: Canvas }>()
    const { command } = mockBoardApi()
    command.mockReturnValue(completion.promise)
    const { container } = render(<CanvasBoard canvas={initial} />)
    const viewport = container.querySelector('[data-canvas-bg]') as HTMLElement
    const card = container.querySelector('[data-node-id="shared-node"]') as HTMLElement

    fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 40, clientY: 60, buttons: 1 })
    expect(command).not.toHaveBeenCalled()
    expect(card.style.left).toBe('-60px')
    expect(card.style.top).toBe('-40px')
    fireEvent.pointerUp(viewport, { pointerId: 1 })
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
    expect(command.mock.calls[0]?.[0]).toMatchObject({
      type: 'node.move', projectId: 'p1', pageId: 'page-a', canvasId: 'canvas-a1',
      nodeId: 'shared-node', position: { x: -60, y: -40 }, expectedRevision: 7,
    })

    const next = structuredClone(initial)
    next.pages[0]!.canvases[0]!.nodes[0]!.position = { x: -60, y: -40 }
    next.revision = 8
    await act(async () => {
      completion.resolve({ commandId: 'move-1', revision: 8, canvas: next })
      await completion.promise
    })
  })

  it('拖动命令未返回时切换画布，旧响应不得覆盖新目标', async () => {
    const initial = boardCanvas()
    initial.pages[0]!.canvases[0]!.viewport = { x: 0, y: 0, zoom: 1 }
    const completion = deferred<{ commandId: string; revision: number; canvas: Canvas }>()
    const { command } = mockBoardApi()
    command.mockReturnValue(completion.promise)
    const onCanvasChange = vi.fn()
    const { container } = render(<CanvasBoard canvas={initial} onCanvasChange={onCanvasChange} />)
    const viewport = container.querySelector('[data-canvas-bg]') as HTMLElement
    const card = container.querySelector('[data-node-id="shared-node"]') as HTMLElement

    fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 40, clientY: 60, buttons: 1 })
    fireEvent.pointerUp(viewport, { pointerId: 1 })
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('当前画布'), { target: { value: 'canvas-a2' } })
    const callsAfterSwitch = onCanvasChange.mock.calls.length

    const stale = structuredClone(initial)
    stale.pages[0]!.canvases[0]!.nodes[0]!.position = { x: -60, y: -40 }
    stale.revision = 8
    await act(async () => {
      completion.resolve({ commandId: 'move-old', revision: 8, canvas: stale })
      await completion.promise
    })
    expect(onCanvasChange).toHaveBeenCalledTimes(callsAfterSwitch)
    expect(screen.getAllByText('A2 节点')).not.toHaveLength(0)
  })

  it('feature-829 · 历史后退/前进、失败不提交索引及新导航截断前进栈', async () => {
    const { command, viewState } = mockBoardApi()
    const onError = vi.fn()
    const { container } = render(<CanvasBoard canvas={boardCanvas()} onError={onError} />)
    const back = screen.getByTestId('canvas-history-back')
    const forward = screen.getByTestId('canvas-history-forward')
    expect(back).toBeDisabled()
    expect(forward).toBeDisabled()

    fireEvent.click(container.querySelector('[data-page-id="page-b"]')!)
    await waitFor(() => expect(back).toBeEnabled())
    viewState.mockRejectedValueOnce(new Error('历史写入失败'))
    fireEvent.click(back)
    await waitFor(() => expect(onError).toHaveBeenCalledWith('切换创作页或画布失败：历史写入失败'))
    expect(container.querySelector('[data-page-id="page-b"]')).toHaveAttribute('aria-selected', 'true')
    expect(forward).toBeDisabled()

    fireEvent.click(back)
    await waitFor(() => expect(container.querySelector('[data-page-id="page-a"]')).toHaveAttribute('aria-selected', 'true'))
    expect(forward).toBeEnabled()
    fireEvent.change(screen.getByLabelText('当前画布'), { target: { value: 'canvas-a2' } })
    await waitFor(() => expect(screen.getByLabelText('当前画布')).toHaveValue('canvas-a2'))
    expect(forward).toBeDisabled()

    fireEvent.click(back)
    await waitFor(() => expect(screen.getByLabelText('当前画布')).toHaveValue('canvas-a1'))
    expect(forward).toBeEnabled()
    fireEvent.click(forward)
    await waitFor(() => expect(screen.getByLabelText('当前画布')).toHaveValue('canvas-a2'))
    expect(back).toBeEnabled()
    expect(forward).toBeDisabled()
    expect(command).not.toHaveBeenCalled()
    for (const call of viewState.mock.calls) {
      expect(call[0]).toMatchObject({ type: 'active.set', activeView: 'canvas' })
      expect(call[0]).not.toHaveProperty('expectedRevision')
    }
  })

  it('feature-829 · 历史导航跳过已删除目标且完整重建后重置栈', async () => {
    const initial = boardCanvas()
    initial.pages.push({
      id: 'page-c', title: '页 C', activeCanvasId: 'canvas-c1',
      canvases: [{ id: 'canvas-c1', title: '画布 C1', nodes: [], edges: [], viewport: null }],
    })
    mockBoardApi()
    const { container, rerender, unmount } = render(<CanvasBoard canvas={initial} />)
    fireEvent.click(container.querySelector('[data-page-id="page-b"]')!)
    await waitFor(() => expect(container.querySelector('[data-page-id="page-b"]')).toHaveAttribute('aria-selected', 'true'))
    fireEvent.click(container.querySelector('[data-page-id="page-c"]')!)
    await waitFor(() => expect(container.querySelector('[data-page-id="page-c"]')).toHaveAttribute('aria-selected', 'true'))

    const removed = structuredClone(initial)
    removed.pages = removed.pages.filter(item => item.id !== 'page-b')
    removed.activePageId = 'page-c'
    rerender(<CanvasBoard canvas={removed} />)
    fireEvent.click(screen.getByTestId('canvas-history-back'))
    await waitFor(() => expect(container.querySelector('[data-page-id="page-a"]')).toHaveAttribute('aria-selected', 'true'))
    fireEvent.click(screen.getByTestId('canvas-history-forward'))
    await waitFor(() => expect(container.querySelector('[data-page-id="page-c"]')).toHaveAttribute('aria-selected', 'true'))

    unmount()
    render(<CanvasBoard canvas={removed} />)
    expect(screen.getByTestId('canvas-history-back')).toBeDisabled()
    expect(screen.getByTestId('canvas-history-forward')).toBeDisabled()
  })

  it('feature-829 · 复制正式引用不写盘，跨页粘贴发送一次固定来源命令', async () => {
    let current = boardCanvas()
    const source = current.pages[0]!.canvases[0]!.nodes[0]!
    source.id = 'source-node'
    source.title = '源产物'
    source.status = 'done'
    source.meta = { version: 'v1' }
    current.pages[1]!.canvases[0]!.nodes = []
    current.pages[1]!.canvases[0]!.viewport = { x: 10, y: 20, zoom: 1 }
    const { command } = mockBoardApi()
    command.mockImplementation(async request => {
      const next = structuredClone(current)
      const sourceNode = next.pages[0]!.canvases[0]!.nodes[0]!
      next.pages[1]!.canvases[0]!.nodes.push({
        ...sourceNode,
        id: request.nodeId,
        position: request.position,
        reference: { artifactId: sourceNode.id, version: 'v1', source: request.source.target },
      })
      next.revision += 1
      current = next
      return { commandId: request.commandId, revision: next.revision, canvas: next, target: request.target }
    })
    const { container } = render(<CanvasBoard canvas={current} />)

    fireEvent.contextMenu(container.querySelector('[data-node-id="source-node"]')!, { clientX: 120, clientY: 100 })
    expect(container.querySelector('[data-ctx-item="copy"]')).toBeTruthy()
    expect(container.querySelector('[data-ctx-item="ref"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '复制正式引用' }))
    expect(command).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('[data-page-id="page-b"]')!)
    await waitFor(() => expect(container.querySelector('[data-page-id="page-b"]')).toHaveAttribute('aria-selected', 'true'))
    const viewport = container.querySelector('[data-viewport]') as HTMLElement
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 50, left: 100, top: 50, width: 800, height: 600, right: 900, bottom: 650,
      toJSON: () => ({}),
    } as DOMRect)
    await waitFor(() => expect(worldOf(container).style.transform).toBe('translate(10px, 20px) scale(1)'))
    fireEvent.contextMenu(viewport, { clientX: 300, clientY: 240 })
    fireEvent.click(screen.getByRole('button', { name: '粘贴正式引用' }))

    await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
    const request = command.mock.calls[0]?.[0]
    expect(request).toMatchObject({
      type: 'reference.create',
      target: { projectId: 'p1', pageId: 'page-b', canvasId: 'canvas-b1' },
      source: { target: { projectId: 'p1', pageId: 'page-a', canvasId: 'canvas-a1' }, nodeId: 'source-node' },
      position: { x: 190, y: 170 },
      expectedRevision: 7,
    })
    expect(request.nodeId).toBeTruthy()
    expect(request.nodeId).not.toBe('source-node')
    await waitFor(() => expect(container.querySelector('[data-reference-badge]')).toHaveTextContent('引用 v1 · 源产物 source-node'))
    fireEvent.contextMenu(viewport, { clientX: 320, clientY: 260 })
    expect(screen.queryByRole('button', { name: '粘贴正式引用' })).not.toBeInTheDocument()
  })

  it('feature-829 · 固定版本与再版黄条独立呈现，打开源产物先切换再查看', async () => {
    const initial = boardCanvas()
    const source = initial.pages[0]!.canvases[0]!.nodes[0]!
    source.id = 'source-node'
    source.title = '源产物 v2'
    source.meta = { version: 'v2' }
    initial.pages[1]!.canvases[0]!.nodes = [node({
      id: 'reference-node', step: '1', kind: 'outline', title: '跨页引用', status: 'done',
      meta: { version: 'v1' },
      reference: {
        artifactId: 'source-node', version: 'v1', latestVersion: 'v2', markedAt: '2026-11-19T00:00:00.000Z',
        source: { projectId: 'p1', pageId: 'page-a', canvasId: 'canvas-a1' },
      },
    })]
    initial.activePageId = 'page-b'
    const { viewState } = mockBoardApi()
    const onOpenNode = vi.fn()
    const { container } = render(<CanvasBoard canvas={initial} onOpenNode={onOpenNode} />)

    expect(container.querySelector('[data-reference-badge="reference-node"]')).toHaveTextContent('引用 v1 · 源产物 source-node')
    expect(container.querySelector('[data-reference-dirty-badge="reference-node"]')).toHaveTextContent('源已至 v2')
    expect(container.querySelector('[data-reference-dirty-banner]')).toHaveTextContent('有 1 个跨页引用基于旧版源产物')
    expect(container.querySelector('[data-dirty-badge]')).toBeNull()
    expect(container.querySelector('[data-dirty-banner]')).toBeNull()

    fireEvent.contextMenu(container.querySelector('[data-node-id="reference-node"]')!)
    fireEvent.click(screen.getByRole('button', { name: '打开源产物' }))
    await waitFor(() => expect(onOpenNode).toHaveBeenCalledTimes(1))
    expect(onOpenNode.mock.calls[0]?.[0].id).toBe('source-node')
    expect(viewState).toHaveBeenCalledWith({
      type: 'active.set', projectId: 'p1', pageId: 'page-a', canvasId: 'canvas-a1', activeView: 'canvas',
    })
    expect(container.querySelector('[data-page-id="page-a"]')).toHaveAttribute('aria-selected', 'true')
  })

  it('feature-829 · 源定位导航失败时保留位置且不打开查看器', async () => {
    const initial = boardCanvas()
    initial.pages[0]!.canvases[0]!.nodes[0]!.id = 'source-node'
    initial.pages[0]!.canvases[0]!.nodes[0]!.meta = { version: 'v2' }
    initial.pages[1]!.canvases[0]!.nodes = [node({
      id: 'reference-node', step: '1', kind: 'outline', title: '跨页引用', status: 'done',
      reference: {
        artifactId: 'source-node', version: 'v1',
        source: { projectId: 'p1', pageId: 'page-a', canvasId: 'canvas-a1' },
      },
    })]
    initial.activePageId = 'page-b'
    const { viewState } = mockBoardApi()
    viewState.mockRejectedValueOnce(new Error('活动目标写入失败'))
    const onOpenNode = vi.fn()
    const onError = vi.fn()
    const { container } = render(<CanvasBoard canvas={initial} onOpenNode={onOpenNode} onError={onError} />)

    fireEvent.contextMenu(container.querySelector('[data-node-id="reference-node"]')!)
    fireEvent.click(screen.getByRole('button', { name: '打开源产物' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('切换创作页或画布失败：活动目标写入失败'))
    expect(onOpenNode).not.toHaveBeenCalled()
    expect(container.querySelector('[data-page-id="page-b"]')).toHaveAttribute('aria-selected', 'true')
  })

  it('feature-829 · 粘贴失败保留内存草稿并显示真实错误', async () => {
    const initial = boardCanvas()
    const source = initial.pages[0]!.canvases[0]!.nodes[0]!
    source.id = 'source-node'
    source.meta = { version: 'v1' }
    initial.pages[1]!.canvases[0]!.nodes = []
    const { command } = mockBoardApi()
    command.mockRejectedValueOnce(new Error('引用写入失败'))
    const onError = vi.fn()
    const { container } = render(<CanvasBoard canvas={initial} onError={onError} />)

    fireEvent.contextMenu(container.querySelector('[data-node-id="source-node"]')!)
    fireEvent.click(screen.getByRole('button', { name: '复制正式引用' }))
    fireEvent.click(container.querySelector('[data-page-id="page-b"]')!)
    await waitFor(() => expect(container.querySelector('[data-page-id="page-b"]')).toHaveAttribute('aria-selected', 'true'))
    const viewport = container.querySelector('[data-viewport]') as HTMLElement
    fireEvent.contextMenu(viewport, { clientX: 300, clientY: 240 })
    fireEvent.click(screen.getByRole('button', { name: '粘贴正式引用' }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('引用写入失败'))
    expect(screen.getByRole('alert')).toHaveTextContent('引用写入失败')
    expect(command).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-reference-badge]')).toBeNull()
    fireEvent.contextMenu(viewport, { clientX: 320, clientY: 260 })
    expect(screen.getByRole('button', { name: '粘贴正式引用' })).toBeInTheDocument()
  })

  for (const { label, state } of [
    { label: '源节点缺失', state: 'missing' },
    { label: '源版本缺失', state: 'unversioned' },
    { label: '来源项目不匹配', state: 'cross-project' },
  ] as const) {
    it(`feature-829 · ${label}时源定位不跳转、不打开查看器`, async () => {
      const initial = boardCanvas()
      const source = initial.pages[0]!.canvases[0]!.nodes[0]!
      source.id = 'source-node'
      source.meta = state === 'unversioned' ? {} : { version: 'v2' }
      if (state === 'missing') initial.pages[0]!.canvases[0]!.nodes = []
      initial.pages[1]!.canvases[0]!.nodes = [node({
        id: 'reference-node', step: '1', kind: 'outline', title: '跨页引用', status: 'done',
        reference: {
          artifactId: 'source-node', version: 'v1',
          source: { projectId: state === 'cross-project' ? 'p2' : 'p1', pageId: 'page-a', canvasId: 'canvas-a1' },
        },
      })]
      initial.activePageId = 'page-b'
      const { viewState } = mockBoardApi()
      const onOpenNode = vi.fn()
      const onError = vi.fn()
      const { container } = render(<CanvasBoard canvas={initial} onOpenNode={onOpenNode} onError={onError} />)

      fireEvent.contextMenu(container.querySelector('[data-node-id="reference-node"]')!)
      fireEvent.click(screen.getByRole('button', { name: '打开源产物' }))
      await waitFor(() => expect(onError).toHaveBeenCalledWith('源产物不存在或缺少版本，无法定位'))
      expect(viewState).not.toHaveBeenCalled()
      expect(onOpenNode).not.toHaveBeenCalled()
      expect(container.querySelector('[data-page-id="page-b"]')).toHaveAttribute('aria-selected', 'true')
    })
  }
})
