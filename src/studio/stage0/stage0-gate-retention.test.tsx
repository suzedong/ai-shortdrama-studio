// feature-012 · Stage0View approved 门卡留存挂载（契约 §3.2 / §5.b）
// 806 翻案 · 方案 B：两处挂载点（空态 / published 主体）放行 approved 门卡，
// pending/rejected 维持 GatePendingStrip 镜像条，无门零渲染。
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasGate, CanvasNode, ProjectBrief, StepId } from '@shared/types'
import Stage0View from './Stage0View'
import { _setStyleCatalogSnapshotForTest } from '../style/style-catalog-store'

const BRIEF_PATH = '立项单.v3.json'
const BG_PATH = '故事背景档案.md'

const IMPACT = {
  assessedAt: '2026-10-28T09:00:00.000Z',
  counts: { high: 1, medium: 0 },
  items: [
    { nodeId: 'step-1-outline', fields: ['premise.seasonBoundary'], severity: 'high' as const, defaultAction: 'regenerate' as const },
  ],
}
const FINDING_BLOCKER = {
  gateId: '0-final',
  category: 'structure',
  checkId: 'STRUCT_REQUIRED_KEYS',
  severity: 'blocker',
  message: '缺少必填键 kind（项目性质），请补齐后重试',
}

function brief(over: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    schemaVersion: 2,
    version: 3,
    kind: 'commercial',
    fiveElements: {
      genre: '都市甜宠',
      platforms: ['抖音'],
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
    approve: { at: '2026-10-28T08:00:00.000Z', by: 'gate' },
    changesFromPrevious: [],
    publishedAt: '2026-10-28T08:00:00.000Z',
    ...over,
  }
}

function briefNode(): CanvasNode {
  return {
    id: 'step-0-brief', step: '0' as StepId, kind: 'brief', title: '立项单', status: 'done',
    ref: { path: BRIEF_PATH, format: 'json' }, meta: { version: 'v3' },
    updatedAt: '2026-10-28T08:00:00.000Z',
  }
}

function gate(status: CanvasGate['status'], payload?: unknown): CanvasGate {
  return { gateId: '0-final', status, question: '是否发布立项 v3？', options: ['发布', '再改改'], payload }
}

function canvas(over: Partial<Canvas> = {}): Canvas {
  return {
    schemaVersion: 2, projectId: 'p1', title: '测试项目',
    nodes: [], edges: [], gates: [], updatedAt: '2026-10-28T08:00:00.000Z',
    ...over,
  }
}

function installApi() {
  window.api = {
    fileRead: vi.fn(async ({ path }: { path: string }) =>
      path === BG_PATH
        ? { ok: false as const, error: { code: 'NOT_FOUND', message: 'NOT_FOUND' } }
        : { ok: true as const, content: JSON.stringify(brief()), format: 'json' as const }),
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
  } as unknown as Window['api']
}

function renderView(c: Canvas) {
  return render(<Stage0View canvas={c} projectTitle="安妮的夏天" onBackToDag={vi.fn()} />)
}

const retained = (): HTMLElement | null => document.querySelector('[data-stage0-gate-retained]')
const pendingStrip = (): Element | null => document.querySelector('[data-stage0-gate-pending]')
const harnessBlock = (): HTMLElement | null => document.querySelector('[data-gate-harness-findings]')
const impactBlock = (): HTMLElement | null => document.querySelector('[data-gate-impact-summary]')

beforeEach(() => {
  vi.restoreAllMocks()
  installApi()
  _setStyleCatalogSnapshotForTest({ status: 'ok', version: 'v1.46', entries: [] })
})

describe('feature-012 · Stage0View approved 门卡留存挂载（契约 §3.2）', () => {
  it('published + approved（含影响清单与 findings）：留存卡上屏三区、无裁决按钮', async () => {
    renderView(canvas({
      nodes: [briefNode()],
      gates: [gate('approved', {
        version: 3,
        impactSummary: IMPACT,
        harnessValidation: { checkedAt: '2026-10-28T09:00:00.000Z', findings: [FINDING_BLOCKER] },
      })],
    }))
    await waitFor(() => expect(retained()).not.toBeNull())

    expect(screen.getByText('已确认 · 下游 Agent 已接管')).toBeInTheDocument()
    expect(impactBlock()).not.toBeNull()
    expect(harnessBlock()).not.toBeNull()
    expect(screen.getByText(FINDING_BLOCKER.message)).toBeInTheDocument()
    // 留存卡零交互：无确认放行 / 否决按钮
    expect(screen.queryByRole('button', { name: '确认放行' })).toBeNull()
    expect(screen.queryByRole('button', { name: '否决 / 重做' })).toBeNull()
    expect(pendingStrip()).toBeNull()
  })

  it('published + approved 无 payload：留存卡仅成功态，影响区与 findings 区均不渲染', async () => {
    renderView(canvas({ nodes: [briefNode()], gates: [gate('approved', { version: 3 })] }))
    await waitFor(() => expect(retained()).not.toBeNull())

    expect(screen.getByText('已确认 · 下游 Agent 已接管')).toBeInTheDocument()
    expect(impactBlock()).toBeNull()
    expect(harnessBlock()).toBeNull()
  })

  it('published + pending：镜像条既有行为不变，留存卡零渲染', async () => {
    renderView(canvas({ nodes: [briefNode()], gates: [gate('pending', { version: 3 })] }))
    await waitFor(() => expect(pendingStrip()).not.toBeNull())

    expect(screen.getByText(/立项定案门待你在右栏定案/)).toBeInTheDocument()
    expect(retained()).toBeNull()
  })

  it('published + rejected：镜像条驳回文案既有行为不变，留存卡零渲染', async () => {
    renderView(canvas({ nodes: [briefNode()], gates: [gate('rejected', { version: 3 })] }))
    await waitFor(() => expect(pendingStrip()).not.toBeNull())

    expect(screen.getByText(/立项定案门被驳回/)).toBeInTheDocument()
    expect(retained()).toBeNull()
  })

  it('空态 + approved：空态挂载点同样放行留存卡', () => {
    renderView(canvas({ gates: [gate('approved', { version: 3, impactSummary: IMPACT })] }))
    expect(retained()).not.toBeNull()
    expect(screen.getByText('已确认 · 下游 Agent 已接管')).toBeInTheDocument()
    expect(impactBlock()).not.toBeNull()
  })

  it('无门：留存卡与镜像条均零渲染', () => {
    renderView(canvas())
    expect(retained()).toBeNull()
    expect(pendingStrip()).toBeNull()
  })
})
