// B-20 · StudioViewer 立项单「相对上一版改动」回归（偏差登记 docs/设计现状与偏差清单.md §2）
// 缺陷根因：changes 分支复用 KV（键列 w-[64px] 定宽），英文点路径必然折行与值穿插成叠字。
// 修复（方案 A）：该分支每项改纵向两行块——字段路径独立一行完整显示，from → to 在下一行。
// KV 组件本体与其他区块（六要素/故事前提/视觉风格）零改动。
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasNode, ProjectBrief, StepId } from '@shared/types'
import StudioViewer from './StudioViewer'
import { _setStyleCatalogSnapshotForTest } from '../style/style-catalog-store'

// feature-811：风格显示名消费 style:catalog 快照——prime ok 态后首订阅懒 ensure no-op（store 契约）
const PRIME_ENTRIES: StyleCatalogEntryDto[] = [
  {
    id: 'A7', name: '拟真人·仿真人动漫', familyCode: 'A', familyLabel: '写实影像系',
    role: 'main', feasibility: 'high', auxiliaryCandidate: false,
    visualTraits: '', anchorWords: '', textureRecipe: '',
  },
  {
    id: 'D1', name: '冷调悬疑', familyCode: 'D', familyLabel: '类型氛围系',
    role: 'main', feasibility: 'high', auxiliaryCandidate: true,
    visualTraits: '', anchorWords: '', textureRecipe: '',
  },
]

/* ── 夹具 ── */

function brief(over: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    schemaVersion: 2,
    version: 2,
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
    diagnosisSummary: '选题方向明确，平台适配度高。',
    approve: { at: '2026-10-15T08:00:00.000Z', by: 'gate' },
    changesFromPrevious: [],
    publishedAt: '2026-10-15T08:00:00.000Z',
    ...over,
  }
}

function briefNode(version = 'v2'): CanvasNode {
  return {
    id: 'step-0-brief',
    step: '0' as StepId,
    kind: 'brief',
    title: '立项单',
    status: 'done',
    updatedAt: '2026-10-16T00:00:00.000Z',
    ref: { path: `立项单.${version}.json`, format: 'json' },
    meta: { version },
  }
}

function installFileRead(data: ProjectBrief, bg: string | null = null) {
  const spy = vi.fn(async ({ path }: { path: string }) => {
    // B-33：按 path 路由——背景档案默认 NOT_FOUND（不显折叠块），传 bg 则按 md 返回
    if (path === '故事背景档案.md') {
      return bg === null
        ? { ok: false as const, error: { code: 'NOT_FOUND', message: '不存在' } }
        : { ok: true as const, content: bg, format: 'md' as const }
    }
    return { ok: true as const, content: JSON.stringify(data), format: 'json' as const }
  })
  window.api = { fileRead: spy } as unknown as Window['api']
  return spy
}

function renderViewer(data: ProjectBrief, opts: { bg?: string | null; entryQuote?: string } = {}) {
  installFileRead(data, opts.bg ?? null)
  return render(<StudioViewer node={briefNode()} kindLabel="立项单" onClose={() => {}} entryQuote={opts.entryQuote} />)
}

beforeEach(() => {
  vi.restoreAllMocks()
  _setStyleCatalogSnapshotForTest({ status: 'ok', version: 'v1.46', entries: PRIME_ENTRIES })
})

afterEach(() => {
  act(() => { _setStyleCatalogSnapshotForTest(null) })
})

/* ── B-20 相对上一版改动 ── */

describe('BriefView · 相对上一版改动（B-20）', () => {
  it('v2 含 2 项改动 → 每项纵向两行：字段路径独立完整一行，from → to 在另一行', async () => {
    renderViewer(brief({
      changesFromPrevious: [
        { field: 'fiveElements.platforms', from: '抖音、红果', to: '抖音、红果、快手' },
        { field: 'diagnosisSummary', from: '', to: '选题方向明确，平台适配度高。' },
      ],
    }))

    // 区块标题计数正确
    await screen.findByText('相对上一版改动 · 2 项')

    // ① 长字段路径完整存在于独立元素，且不再是 KV 的 64px 定宽键列
    const fieldEl = screen.getByText('fiveElements.platforms')
    expect(fieldEl.textContent).toBe('fiveElements.platforms')
    expect(fieldEl.className).toContain('break-all')
    expect(fieldEl.className).not.toContain('w-[64px]')

    // ② from → to 在另一元素，两者不叠压（结构分离）
    const valueEl = screen.getByText(
      (_, el) => el?.tagName === 'DIV' && el.textContent === '抖音、红果 → 抖音、红果、快手',
    )
    expect(valueEl).not.toBe(fieldEl)
    expect(valueEl.parentElement).toBe(fieldEl.parentElement)
    expect(fieldEl.compareDocumentPosition(valueEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // ③ from 为空字符串 → 回退「（空）」
    const emptyFromEl = screen.getByText(
      (_, el) => el?.tagName === 'DIV' && el.textContent === '（空） → 选题方向明确，平台适配度高。',
    )
    expect(emptyFromEl).toBeTruthy()
    // 第二项的字段路径同样完整独立
    const field2 = screen.getByText('diagnosisSummary')
    expect(field2.className).toContain('break-all')
    expect(field2.className).not.toContain('w-[64px]')
  })

  it('每项容器保留 KV 同款斑马纹/边框节奏', async () => {
    renderViewer(brief({
      changesFromPrevious: [
        { field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' },
      ],
    }))
    await screen.findByText('相对上一版改动 · 1 项')
    const fieldEl = screen.getByText('fiveElements.episodeCount')
    const row = fieldEl.parentElement as HTMLElement
    expect(row.className).toContain('border-b')
    expect(row.className).toContain('border-line/60')
    expect(row.className).toContain('odd:bg-canvas/60')
    expect(row.className).toContain('last:border-b-0')
  })

  it('version 1 → 仍显示「首版立项。」', async () => {
    renderViewer(brief({ version: 1 }))
    await screen.findByText('相对上一版改动 · 0 项')
    expect(screen.getByText('首版立项。')).toBeTruthy()
  })

  it('version 2 但改动列表为空 → 同样显示「首版立项。」', async () => {
    renderViewer(brief({ version: 2, changesFromPrevious: [] }))
    await screen.findByText('相对上一版改动 · 0 项')
    expect(screen.getByText('首版立项。')).toBeTruthy()
  })

  it('KV 组件本体零改动：六要素键列仍为 64px 定宽', async () => {
    renderViewer(brief({
      changesFromPrevious: [
        { field: 'fiveElements.platforms', from: '抖音、红果', to: '抖音、红果、快手' },
      ],
    }))
    await screen.findByText('相对上一版改动 · 1 项')
    // 六要素区块的 KV 键列保持原样（修复未波及）
    expect(screen.getByText('单集时长').className).toContain('w-[64px]')
    expect(screen.getByText('核心事件').className).toContain('w-[64px]')
  })
})

/* ── B-22 视觉风格名称 ── */

describe('BriefView · 视觉风格显示名称（B-22）', () => {
  it('已知谱系 ID → 主风格显「ID · 名称 @ 版本」，辅助显「ID · 名称」', async () => {
    renderViewer(brief({ style: { mainStyleId: 'A7', catalogVersion: 'v1.46', auxiliaryStyleId: 'D1' } }))
    await screen.findByText('视觉风格')
    expect(screen.getByText('A7 · 拟真人·仿真人动漫 @ v1.46')).toBeTruthy()
    expect(screen.getByText('D1 · 冷调悬疑')).toBeTruthy()
  })

  it('未知/未来版本 ID → 回退只显 ID（不丢版本号）', async () => {
    renderViewer(brief({ style: { mainStyleId: 'Z9', catalogVersion: 'v9.9', auxiliaryStyleId: 'Q3' } }))
    await screen.findByText('视觉风格')
    expect(screen.getByText('Z9 @ v9.9')).toBeTruthy()
    expect(screen.getByText('Q3')).toBeTruthy()
  })

  it('无辅助气氛 → 主风格仍显名称，辅助仍显「无」', async () => {
    renderViewer(brief({ style: { mainStyleId: 'A7', catalogVersion: 'v1.46' } }))
    await screen.findByText('视觉风格')
    expect(screen.getByText('A7 · 拟真人·仿真人动漫 @ v1.46')).toBeTruthy()
    expect(screen.getByText('无')).toBeTruthy()
  })
})

/* ── B-32 落盘字段补显（diagnosisDetail + approve.at） ── */

describe('BriefView · 落盘字段完整（B-32）', () => {
  it('diagnosisDetail 落盘 → 「选题诊断明细」小节按【标题】分节渲染', async () => {
    renderViewer(brief({
      diagnosisDetail: '【对标案例】\n案例 A 播放破亿。\n【合规提示】\n校园题材注意规避。',
    }))
    await screen.findByText('选题诊断明细')
    // 结论小节仍在
    expect(screen.getByText('选题诊断结论')).toBeTruthy()
    expect(screen.getByText('选题方向明确，平台适配度高。')).toBeTruthy()
    // 分节标题恒渲染（与 Stage0View 卡①同源 DiagnosisSections）
    expect(screen.getByText('对标案例')).toBeTruthy()
    expect(screen.getByText('合规提示')).toBeTruthy()
    // B-35 遗留切片（可折叠）：长文节默认收起，节题行点击展开、再点收起
    expect(screen.queryByText('案例 A 播放破亿。')).toBeNull()
    expect(screen.queryByText('校园题材注意规避。')).toBeNull()
    fireEvent.click(screen.getByText('对标案例'))
    expect(screen.getByText('案例 A 播放破亿。')).toBeTruthy()
    expect(screen.queryByText('校园题材注意规避。')).toBeNull()
    fireEvent.click(screen.getByText('合规提示'))
    expect(screen.getByText('校园题材注意规避。')).toBeTruthy()
  })

  it('无 diagnosisDetail → 不显明细小节，结论仍显示', async () => {
    renderViewer(brief())
    await screen.findByText('选题诊断结论')
    expect(screen.getByText('选题方向明确，平台适配度高。')).toBeTruthy()
    expect(screen.queryByText('选题诊断明细')).toBeNull()
  })

  it('approve.at 落盘 → 「拍板时间」行显本地格式化时间', async () => {
    const at = '2026-10-15T08:00:00.000Z'
    renderViewer(brief({ approve: { at, by: 'gate' } }))
    await screen.findByText('拍板时间')
    expect(screen.getByText(new Date(at).toLocaleString())).toBeTruthy()
  })
})

/* ── B-33 查看器补显：入口动作 · 用户原话 + 故事背景档案.md ── */

describe('BriefView · 入口原话与背景档案（B-33）', () => {
  it('entryQuote 传入 → 顶部「入口动作 · 用户原话」卡显引文；未传 → 卡不显', async () => {
    const { unmount } = renderViewer(brief(), { entryQuote: '拍我外婆在海边的小店，要清新治愈' })
    await screen.findByText('入口动作 · 用户原话')
    expect(screen.getByText('「拍我外婆在海边的小店，要清新治愈」')).toBeTruthy()
    unmount()

    renderViewer(brief())
    await screen.findByText('项目性质')
    expect(screen.queryByText('入口动作 · 用户原话')).toBeNull()
  })

  it('背景档案落盘 → 折叠块显「故事背景档案.md」，点击展开渲染 Markdown', async () => {
    renderViewer(brief(), { bg: '# 背景\n\n外婆的杂货店即将拆迁。' })
    const toggle = await screen.findByRole('button', { name: /故事背景档案/ })
    // 默认收起：内容未渲染
    expect(screen.queryByText('外婆的杂货店即将拆迁。')).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByText('外婆的杂货店即将拆迁。')).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('背景档案缺失（NOT_FOUND）→ 折叠块整体不显', async () => {
    renderViewer(brief())
    await screen.findByText('故事前提')
    expect(screen.queryByRole('button', { name: /故事背景档案/ })).toBeNull()
  })
})
