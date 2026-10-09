// feature-020 C5 · CanvasBoard 多步分组渲染测试（契约 §3，OD §2/§5，需求 AC-7/AC-9）
// 断言：按 step 动态分组、组标题动态、跨组竖箭头、无单步硬编码、空态步骤无关。
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Canvas, CanvasNode } from '@shared/types'
import CanvasBoard from './CanvasBoard'

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
    expect(screen.queryByText(/第 0 步/)).not.toBeInTheDocument()
    expect(screen.queryByText(/第 1 步/)).not.toBeInTheDocument()
  })

  it('仅第 0 步数据：只有立项组，不出现空的第 1 步组', () => {
    const c = emptyCanvas()
    c.nodes = [
      node({ id: 'step-0-diagnosis', step: '0', kind: 'diagnosis', title: '选题诊断', status: 'done' }),
      node({ id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单', status: 'done' }),
    ]
    c.edges = [{ id: 'e-diag-brief', from: 'step-0-diagnosis', to: 'step-0-brief', auto: true }]
    render(<CanvasBoard canvas={c} />)

    expect(screen.getByText('第 0 步 · 立项')).toBeInTheDocument()
    expect(screen.queryByText('第 1 步 · 故事')).not.toBeInTheDocument()
  })

  it('第 0、1 步数据：纵向两组 + 动态组标题 + outline/profiles 中文标签', () => {
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

    expect(screen.getByText('第 0 步 · 立项')).toBeInTheDocument()
    expect(screen.getByText('第 1 步 · 故事')).toBeInTheDocument()
    expect(screen.getAllByText('故事大纲').length).toBeGreaterThan(0)
    expect(screen.getAllByText('人物小传').length).toBeGreaterThan(0)
    // 跨步骤 auto 边以竖箭头区呈现（既有边，仅展示）
    expect(screen.getByText(/auto：step-0-brief → step-1-outline/)).toBeInTheDocument()
    // 竖箭头 svg（height=28）存在
    expect(container.querySelector('svg[viewBox="0 0 16 28"]')).toBeTruthy()
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
    expect(screen.queryByText('第 2 步 · 剧本分场')).not.toBeInTheDocument()
  })

  it('第 0、1、2 步数据：纵向三组 + 标题「第 2 步 · 剧本分场」+ scenes/dialogue 中文标签', () => {
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

    expect(screen.getByText('第 2 步 · 剧本分场')).toBeInTheDocument()
    expect(screen.getAllByText('第一集分场').length).toBeGreaterThan(0)
    expect(screen.getAllByText('第一集台词').length).toBeGreaterThan(0)
    // 1→2 跨步骤 auto 边竖箭头区
    expect(screen.getByText(/auto：step-1-profiles → step-2-scenes/)).toBeInTheDocument()
    expect(container.querySelector('svg[viewBox="0 0 16 28"]')).toBeTruthy()
  })
})
