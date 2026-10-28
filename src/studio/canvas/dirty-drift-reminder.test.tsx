// feature-806 · B-46 漂移提醒显隐三态（契约 §5.5：超期显 / 未超期不显 / 无 markedAt 不显）
// 覆盖四消费点：CanvasBoard 聚合黄条、Stage0View DirtyBar、StudioViewer 单节点黄条、RealignConfirm 确认卡；
// 提醒不新增弹窗、不阻断任何既有按钮与流程（各用例顺带断言既有按钮/文案零影响）。
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasDirty, CanvasNode, ProjectBrief, StepId } from '@shared/types'
import CanvasBoard from './CanvasBoard'
import RealignConfirm from './RealignConfirm'
import StudioViewer from '../viewer/StudioViewer'
import Stage0View from '../stage0/Stage0View'
import { _setStyleCatalogSnapshotForTest } from '../style/style-catalog-store'

/* ── 夹具 ── */

const DAY = 86400000
const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

const OLD_MARK = isoDaysAgo(45) // 超期（>30 天）
const FRESH_MARK = isoDaysAgo(10) // 未超期（≤30 天）

const DIRTY_BASE: CanvasDirty = {
  sinceBriefVersion: 1,
  latestBriefVersion: 2,
  fields: ['fiveElements.genre'],
  severity: 'high',
  impactReport: '影响清单.v1-v2.json',
}
const dirtyOf = (over: Partial<CanvasDirty> = {}): CanvasDirty => ({
  ...DIRTY_BASE,
  fields: [...DIRTY_BASE.fields],
  ...over,
})

function node(partial: Partial<CanvasNode> & { id: string }): CanvasNode {
  return {
    step: '1' as StepId,
    kind: 'outline',
    title: partial.id,
    status: 'done',
    ref: { path: '故事/故事大纲.json', format: 'json' },
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...partial,
  }
}

function canvasOf(nodes: CanvasNode[]): Canvas {
  return {
    schemaVersion: 2, projectId: 'p1', title: '测试项目',
    nodes, edges: [], gates: [],
    updatedAt: '2026-10-15T00:00:00.000Z',
  }
}

const briefNodeV2 = () => node({
  id: 'step-0-brief', step: '0', kind: 'brief', title: '立项单',
  ref: { path: '立项单.v2.json', format: 'json' },
  meta: { version: 'v2' },
})

const OUTLINE_JSON = JSON.stringify({
  logline: '测试 logline', seasonArc: '测试主线', themes: [], conflicts: [], episodes: [],
})

beforeEach(() => {
  vi.restoreAllMocks()
  _setStyleCatalogSnapshotForTest({
    status: 'ok', version: 'v1.46',
    entries: [{
      id: 'A7', name: '拟真人·仿真人动漫', familyCode: 'A', familyLabel: '写实影像系', role: 'main',
      feasibility: 'high', auxiliaryCandidate: false, visualTraits: '', anchorWords: '', textureRecipe: '',
    }],
  })
})

afterEach(() => {
  act(() => { _setStyleCatalogSnapshotForTest(null) })
})

/* ── ① CanvasBoard 聚合黄条 ── */

describe('feature-806 · CanvasBoard 聚合黄条漂移提醒', () => {
  const boardCanvas = (dirty: CanvasDirty) =>
    canvasOf([briefNodeV2(), node({ id: 'step-1-outline', title: '故事大纲', dirty })])

  it('超期（45 天）→ 黄条追加提醒一行', () => {
    const { container } = render(<CanvasBoard canvas={boardCanvas(dirtyOf({ markedAt: OLD_MARK }))} />)
    const banner = container.querySelector('[data-dirty-banner]')
    expect(banner?.textContent).toContain('有 1 个产物基于旧版立项（最新 v2），内容可能与最新立项不一致。')
    expect(banner?.textContent).toContain('立项基线已漂移 45 天（不阻塞）')
  })

  it('未超期（10 天）→ 无提醒行', () => {
    const { container } = render(<CanvasBoard canvas={boardCanvas(dirtyOf({ markedAt: FRESH_MARK }))} />)
    const banner = container.querySelector('[data-dirty-banner]')
    expect(banner).not.toBeNull()
    expect(banner?.textContent).not.toContain('立项基线已漂移')
  })

  it('无 markedAt（存量）→ 无提醒行，黄条文案与既有全等', () => {
    const { container } = render(<CanvasBoard canvas={boardCanvas(dirtyOf())} />)
    const banner = container.querySelector('[data-dirty-banner]')
    expect(banner?.textContent).toBe('有 1 个产物基于旧版立项（最新 v2），内容可能与最新立项不一致。')
  })
})

/* ── ② RealignConfirm 确认卡 ── */

describe('feature-806 · RealignConfirm 卡内漂移提醒', () => {
  const noop = () => {}
  const renderConfirm = (dirty: CanvasDirty) =>
    render(<RealignConfirm node={node({ id: 'step-1-outline', title: '都市女频大纲', dirty })} onRealign={noop} onKeepView={noop} onCancel={noop} />)

  it('超期 → 提醒行显；既有文案与三按钮零影响（不阻断）', () => {
    renderConfirm(dirtyOf({ markedAt: OLD_MARK }))
    const dialog = screen.getByRole('dialog', { name: '产物重新对齐' })
    expect(within(dialog).getByText('立项基线已漂移 45 天（不阻塞）')).toBeInTheDocument()
    expect(within(dialog).getByText('影响等级：高 · 建议重新生成')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '按 v2 重新对齐' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '保持现状查看' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeInTheDocument()
  })

  it('未超期 → 不显', () => {
    renderConfirm(dirtyOf({ markedAt: FRESH_MARK }))
    const dialog = screen.getByRole('dialog', { name: '产物重新对齐' })
    expect(within(dialog).queryByText(/立项基线已漂移/)).not.toBeInTheDocument()
  })

  it('无 markedAt（存量）→ 不显', () => {
    renderConfirm(dirtyOf())
    const dialog = screen.getByRole('dialog', { name: '产物重新对齐' })
    expect(within(dialog).queryByText(/立项基线已漂移/)).not.toBeInTheDocument()
  })
})

/* ── ③ StudioViewer 单节点黄条 ── */

describe('feature-806 · StudioViewer 单节点黄条漂移提醒', () => {
  function installViewerApi() {
    window.api = {
      fileRead: vi.fn(async () => ({ ok: true as const, content: OUTLINE_JSON, format: 'json' as const })),
    } as unknown as Window['api']
  }
  const renderViewer = (dirty: CanvasDirty, onRequestAlign?: () => void) =>
    render(<StudioViewer node={node({ id: 'step-1-outline', title: '都市女频大纲', dirty })} kindLabel="故事大纲" onClose={() => {}} onRequestAlign={onRequestAlign} />)

  it('超期 → 黄条内追加提醒行；一键对齐钮仍在（不阻断）', async () => {
    installViewerApi()
    renderViewer(dirtyOf({ markedAt: OLD_MARK }), vi.fn())
    expect(await screen.findByText('当前基于 v1 立项，与最新 v2 不一致：题材')).toBeInTheDocument()
    expect(screen.getByText('立项基线已漂移 45 天（不阻塞）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一键对齐' })).toBeInTheDocument()
  })

  it('未超期 → 不显', async () => {
    installViewerApi()
    renderViewer(dirtyOf({ markedAt: FRESH_MARK }))
    expect(await screen.findByText('当前基于 v1 立项，与最新 v2 不一致：题材')).toBeInTheDocument()
    expect(screen.queryByText(/立项基线已漂移/)).not.toBeInTheDocument()
  })

  it('无 markedAt（存量）→ 不显', async () => {
    installViewerApi()
    renderViewer(dirtyOf())
    expect(await screen.findByText('当前基于 v1 立项，与最新 v2 不一致：题材')).toBeInTheDocument()
    expect(screen.queryByText(/立项基线已漂移/)).not.toBeInTheDocument()
  })
})

/* ── ④ Stage0View DirtyBar ── */

describe('feature-806 · Stage0View DirtyBar 漂移提醒', () => {
  const BG_PATH = '故事背景档案.md'

  function brief(): ProjectBrief {
    return {
      schemaVersion: 2,
      version: 2,
      kind: 'commercial',
      fiveElements: {
        genre: '都市甜宠', platforms: ['抖音'], episodeDuration: '90 秒',
        episodeCount: '80 集', tone: '轻松治愈', aspectRatio: '竖屏 9:16',
      },
      premise: {
        leads: '林夏与顾屿', time: '2026 年夏', place: '杭州',
        coreEvent: '雨夜共撑一伞', seasonBoundary: '第一季只讲相识',
      },
      style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
      approve: { at: '2026-10-15T08:00:00.000Z', by: 'gate' },
      changesFromPrevious: [],
      publishedAt: '2026-10-15T08:00:00.000Z',
    }
  }

  function installStage0Api() {
    window.api = {
      fileRead: vi.fn(async ({ path }: { path: string }) =>
        path === BG_PATH
          ? { ok: false as const, error: { code: 'NOT_FOUND', message: 'NOT_FOUND' } }
          : { ok: true as const, content: JSON.stringify(brief()), format: 'json' as const }),
    } as unknown as Window['api']
    ;(window.api as unknown as { captureList: unknown }).captureList =
      vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] }))
    ;(window.api as unknown as { onCaptureChanged: unknown }).onCaptureChanged =
      vi.fn(() => () => undefined)
  }

  const stage0Canvas = (dirty: CanvasDirty) =>
    canvasOf([briefNodeV2(), node({ id: 'step-1-outline', title: '故事大纲', dirty })])

  async function findDirtyBar(): Promise<HTMLElement> {
    let el: Element | null = null
    await waitFor(() => {
      el = document.querySelector('[data-stage0-dirty-bar]')
      expect(el).not.toBeNull()
    })
    return el as unknown as HTMLElement
  }

  it('超期 → DirtyBar 追加提醒一行', async () => {
    installStage0Api()
    render(<Stage0View canvas={stage0Canvas(dirtyOf({ markedAt: OLD_MARK }))} projectTitle="测试项目" onBackToDag={() => {}} />)
    const bar = await findDirtyBar()
    expect(bar.textContent).toContain('有 1 个产物基于旧版立项')
    expect(bar.textContent).toContain('立项基线已漂移 45 天（不阻塞）')
  })

  it('未超期 → 不显', async () => {
    installStage0Api()
    render(<Stage0View canvas={stage0Canvas(dirtyOf({ markedAt: FRESH_MARK }))} projectTitle="测试项目" onBackToDag={() => {}} />)
    const bar = await findDirtyBar()
    expect(bar.textContent).toContain('有 1 个产物基于旧版立项')
    expect(bar.textContent).not.toContain('立项基线已漂移')
  })

  it('无 markedAt（存量）→ 不显', async () => {
    installStage0Api()
    render(<Stage0View canvas={stage0Canvas(dirtyOf())} projectTitle="测试项目" onBackToDag={() => {}} />)
    const bar = await findDirtyBar()
    expect(bar.textContent).toContain('有 1 个产物基于旧版立项')
    expect(bar.textContent).not.toContain('立项基线已漂移')
  })
})
