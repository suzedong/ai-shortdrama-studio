// feature-020 C5 · CanvasBoard 多步分组渲染测试（契约 §3，OD §2/§5，需求 AC-7/AC-9）
// 断言：按 step 动态分组、STAGE 列标题动态、跨组贝塞尔横边、无单步硬编码、空态步骤无关。
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Canvas, CanvasNode } from '@shared/types'
import CanvasBoard, { snapNode } from './CanvasBoard'

function emptyCanvas(): Canvas {
  return {
    schemaVersion: 2, projectId: 'p1', title: '测试项目', nodes: [], edges: [], gates: [],
    updatedAt: new Date().toISOString(),
  }
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
    c.nodes = [
      node({ id: 'step-0-diagnosis', step: '0', kind: 'diagnosis', title: '选题诊断', status: 'done' }),
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
    ]
    c.edges = [{ id: 'e-diag-brief', from: 'step-0-diagnosis', to: 'step-0-brief', auto: true }]
    render(<CanvasBoard canvas={c} />)

    expect(screen.getByText('STAGE 0 · 立项')).toBeInTheDocument()
    expect(screen.queryByText('STAGE 1 · 故事')).not.toBeInTheDocument()
  })

  it('第 0、1 步数据：横向两列 + 动态列标题 + outline/profiles 中文标签', () => {
    const c = emptyCanvas()
    c.nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
      node({ id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'done' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'active' }),
    ]
    c.edges = [
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
    c.nodes = [
      node({ id: 'step-1-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'active' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'pending' }),
    ]
    render(<CanvasBoard canvas={c} />)
    expect(screen.getByText('进行中')).toBeInTheDocument()
    expect(screen.getByText('待生成')).toBeInTheDocument()
  })

  it('仅第 0、1 步数据：不出现空的第 2 步组', () => {
    const c = emptyCanvas()
    c.nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'done' }),
    ]
    render(<CanvasBoard canvas={c} />)
    expect(screen.queryByText('STAGE 2 · 剧本分场')).not.toBeInTheDocument()
  })

  it('第 0、1、2 步数据：横向三列 + 标题「STAGE 2 · 剧本分场」+ scenes/dialogue 中文标签', () => {
    const c = emptyCanvas()
    c.nodes = [
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
      node({ id: 'step-1-profiles', step: '1', kind: 'profiles', title: '人物小传', status: 'done' }),
      node({ id: 'step-2-scenes', step: '2', kind: 'scenes', title: '第一集分场', status: 'done' }),
      node({ id: 'step-2-dialogue', step: '2', kind: 'dialogue', title: '第一集台词', status: 'active' }),
    ]
    c.edges = [
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
