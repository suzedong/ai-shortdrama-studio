// feature-004 · 立项单历史与回滚组件回归（契约 §5：组件测试先例 studio-viewer.test.tsx）
// AC6：StudioViewer brief 视图「查看历史」入口 → 版本列表新版置顶 + 默认选中次新版 + 两栏 diff 高亮 + 差异摘要条。
// AC7：回滚二次确认流——取消零 IPC；确认发新版 → notice + 列表刷新 + 选中新版；失败 → 错误条不关视图。
// 三桥 briefHistory / briefVersionRead / briefRollback 内存 mock（类型镜像 src/global.d.ts），fileRead 供 StudioViewer 外壳。
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BriefChange, CanvasNode, ProjectBrief, StepId } from '@shared/types'
import BriefHistoryView from './BriefHistoryView'
import StudioViewer from './StudioViewer'

/* ── 夹具：三版立项单（v3 = 当前最新） ── */

function makeBrief(version: number): ProjectBrief {
  const base: ProjectBrief = {
    schemaVersion: 2,
    version,
    kind: 'commercial',
    fiveElements: {
      genre: '都市甜宠',
      platforms: ['抖音', '红果'],
      episodeDuration: '90 秒',
      episodeCount: '第一季 12 集',
      tone: '轻松治愈',
      aspectRatio: '竖屏 9:16',
    },
    premise: {
      leads: '林夏与顾屿',
      time: '2026 年夏',
      place: '杭州',
      coreEvent: '雨夜共撑一伞',
      seasonBoundary: '',
    },
    style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
    diagnosisSummary: '选题方向明确，平台适配度高。',
    approve: { at: '2026-10-10T08:00:00.000Z', by: 'gate', note: '初版立项' },
    changesFromPrevious: [],
    publishedAt: '2026-10-10T08:00:00.000Z',
  }
  if (version === 2) {
    base.premise = { ...base.premise, seasonBoundary: '第一季只讲相识' }
    base.approve = { at: '2026-10-12T08:00:00.000Z', by: 'verbal', verbal: { quote: '边界先定到相识，其他不变。' } }
    base.changesFromPrevious = [{ field: 'premise.seasonBoundary', from: '', to: '第一季只讲相识' }]
    base.publishedAt = '2026-10-12T08:00:00.000Z'
  }
  if (version === 3) {
    base.fiveElements = { ...base.fiveElements, episodeCount: '第一季 8 集（先做 E01）' }
    base.premise = { ...base.premise, seasonBoundary: '第一季只讲相识到确认心意' }
    base.approve = { at: '2026-10-14T08:00:00.000Z', by: 'ui', note: '面板直改' }
    base.changesFromPrevious = [
      { field: 'fiveElements.episodeCount', from: '第一季 12 集', to: '第一季 8 集（先做 E01）' },
      { field: 'premise.seasonBoundary', from: '第一季只讲相识', to: '第一季只讲相识到确认心意' },
    ]
    base.publishedAt = '2026-10-14T08:00:00.000Z'
  }
  return base
}

/** v2 → 最新 v3 的静态 diffToLatest（字段顺序同 diffBrief：fiveElements 先于 premise） */
const DIFF: BriefChange[] = [
  { field: 'fiveElements.episodeCount', from: '第一季 12 集', to: '第一季 8 集（先做 E01）' },
  { field: 'premise.seasonBoundary', from: '第一季只讲相识', to: '第一季只讲相识到确认心意' },
]

function briefNode(version = 'v3'): CanvasNode {
  return {
    id: 'step-0-brief',
    step: '0' as StepId,
    kind: 'brief',
    title: '立项单',
    status: 'done',
    updatedAt: '2026-10-14T08:00:00.000Z',
    ref: { path: `立项单.${version}.json`, format: 'json' },
    meta: { version },
  }
}

/** 每用例调用：独立内存版本库 + 四桥 mock（回滚成功会 push 新版进库，闭环与主进程语义一致） */
function installApi() {
  const lib: ProjectBrief[] = [makeBrief(1), makeBrief(2), makeBrief(3)]
  const historySpy = vi.fn(async () => ({
    versions: lib.map(b => ({
      version: b.version,
      path: `立项单.v${b.version}.json`,
      publishedAt: b.publishedAt,
      kind: b.kind,
      approveBy: b.approve.by,
      changeCount: b.changesFromPrevious.length,
      ...(b.approve.note ? { note: b.approve.note } : {}),
    })),
    latestVersion: lib.length ? lib[lib.length - 1].version : null,
    warnings: [] as string[],
  }))
  const readSpy = vi.fn(async (version: number) => {
    const brief = lib.find(b => b.version === version)
    if (!brief) throw new Error(`BRIEF_VERSION_NOT_FOUND：立项单 v${version} 不存在`)
    const latest = lib[lib.length - 1]
    return { brief: structuredClone(brief), diffToLatest: version === latest.version ? [] : DIFF }
  })
  const rollbackSpy = vi.fn(async (version: number) => {
    const brief = lib.find(b => b.version === version)
    if (!brief) throw new Error(`BRIEF_VERSION_NOT_FOUND：立项单 v${version} 不存在`)
    const latest = lib[lib.length - 1]
    if (version === latest.version) throw new Error('BRIEF_ROLLBACK_LATEST：该版本即当前最新，无需回滚')
    const now = '2026-10-18T02:00:00.000Z'
    const next: ProjectBrief = {
      ...structuredClone(brief),
      version: latest.version + 1,
      approve: { at: now, by: 'ui', note: `回滚自 v${version}` },
      changesFromPrevious: DIFF.map(c => ({ field: c.field, from: c.to, to: c.from })),
      publishedAt: now,
    }
    lib.push(next)
    return { ok: true as const, version: next.version, rolledBackFrom: version, changesFromPrevious: next.changesFromPrevious }
  })
  const fileReadSpy = vi.fn(async ({ path }: { path: string }) => {
    const m = /立项单\.v(\d+)\.json$/.exec(path)
    const brief = m ? lib.find(b => b.version === Number(m[1])) : undefined
    return brief
      ? { ok: true as const, content: JSON.stringify(brief), format: 'json' as const }
      : { ok: false as const, error: { code: 'NOT_FOUND', message: '不存在' } }
  })
  window.api = {
    briefHistory: historySpy,
    briefVersionRead: readSpy,
    briefRollback: rollbackSpy,
    fileRead: fileReadSpy,
  } as unknown as Window['api']
  return { historySpy, readSpy, rollbackSpy, fileReadSpy, lib }
}

/** 差异摘要条标题行（多文本节点拼接，按整元素 textContent 全等匹配） */
const diffTitle = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'DIV' && el.textContent === text

beforeEach(() => {
  vi.restoreAllMocks()
})

/* ── AC6 查看历史入口 + 列表 + 两栏 diff ── */

describe('BriefHistoryView · 入口与 diff（AC6）', () => {
  it('brief 节点「查看历史」→ 新版置顶、默认选中次新版 v2、摘要条 2 项、左右两栏高亮各 2 行', async () => {
    installApi()
    render(<StudioViewer node={briefNode('v3')} kindLabel="立项单" onClose={() => {}} />)

    fireEvent.click(screen.getByTestId('brief-history-entry'))
    await screen.findByTestId('brief-history-view')

    // 版本列表新版置顶
    const items = await screen.findAllByTestId('brief-history-item')
    expect(items.map(el => el.getAttribute('data-version'))).toEqual(['3', '2', '1'])
    // 默认选中次新版 v2（选中样式）
    const v2 = items.find(el => el.getAttribute('data-version') === '2') as HTMLElement
    expect(v2.className).toContain('border-violet')

    // 差异摘要条：标题 + 中文字段行（dirtyFieldLabel）
    await screen.findByText(diffTitle('与最新版 v3 的差异 · 2 项（左 v2 → 右 v3）'))
    expect(screen.getByText(diffTitle('集数：第一季 12 集 → 第一季 8 集（先做 E01）'))).toBeTruthy()
    expect(screen.getByText(diffTitle('季边界：第一季只讲相识 → 第一季只讲相识到确认心意'))).toBeTruthy()

    // 两栏 diff 高亮行：2 字段 × 左右两栏
    expect(screen.getAllByTestId('brief-history-diff-field')).toHaveLength(4)

    // 回滚钮可用且文案带选中版本
    const rb = screen.getByTestId('brief-history-rollback') as HTMLButtonElement
    expect(rb.disabled).toBe(false)
    expect(rb.textContent).toBe('回滚到 v2')
  })

  it('非 brief 节点 → 无「查看历史」入口', () => {
    installApi()
    const outlineNode: CanvasNode = {
      ...briefNode('v1'),
      id: 'step-1-outline',
      kind: 'outline',
      title: '故事大纲',
      ref: { path: '故事大纲.v1.json', format: 'json' },
    }
    render(<StudioViewer node={outlineNode} kindLabel="故事大纲" onClose={() => {}} />)
    expect(screen.queryByTestId('brief-history-entry')).toBeNull()
  })

  it('选中当前最新版 → 摘要条显「该版本即当前最新」、回滚钮禁用、无高亮行', async () => {
    installApi()
    render(<BriefHistoryView onClose={() => {}} />)

    const items = await screen.findAllByTestId('brief-history-item')
    fireEvent.click(items.find(el => el.getAttribute('data-version') === '3') as HTMLElement)

    await screen.findByText('该版本即当前最新')
    expect((screen.getByTestId('brief-history-rollback') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryAllByTestId('brief-history-diff-field')).toHaveLength(0)
  })
})

/* ── AC7 回滚二次确认流 ── */

describe('BriefHistoryView · 回滚（AC7）', () => {
  it('二次确认 → 取消：确认框关闭、零回滚 IPC 调用', async () => {
    const { rollbackSpy } = installApi()
    render(<BriefHistoryView onClose={() => {}} />)

    await screen.findByText(diffTitle('与最新版 v3 的差异 · 2 项（左 v2 → 右 v3）'))
    fireEvent.click(screen.getByTestId('brief-history-rollback'))

    const confirm = await screen.findByTestId('brief-history-rollback-confirm')
    expect(confirm.textContent).toContain('将以 v2 的内容发布新立项单 v4')
    expect(confirm.textContent).toContain('当前最新 v3 不会丢失')

    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByTestId('brief-history-rollback-confirm')).toBeNull()
    expect(rollbackSpy).not.toHaveBeenCalled()
  })

  it('确认回滚 → 发新版 v4：notice、列表四版置顶、选中新版即最新', async () => {
    const { rollbackSpy } = installApi()
    render(<BriefHistoryView onClose={() => {}} />)

    await screen.findByText(diffTitle('与最新版 v3 的差异 · 2 项（左 v2 → 右 v3）'))
    fireEvent.click(screen.getByTestId('brief-history-rollback'))
    await screen.findByTestId('brief-history-rollback-confirm')
    fireEvent.click(screen.getByText('确认回滚'))

    await screen.findByText('已发布 v4（内容 = v2）')
    expect(rollbackSpy).toHaveBeenCalledWith(2)

    // 重拉历史：新版置顶，v4 标记「当前」
    await waitFor(() => {
      expect(screen.getAllByTestId('brief-history-item').map(el => el.getAttribute('data-version')))
        .toEqual(['4', '3', '2', '1'])
    })
    // 选中新版 = 当前最新 → 空 diff
    await screen.findByText('该版本即当前最新')
    expect((screen.getByTestId('brief-history-rollback') as HTMLButtonElement).disabled).toBe(true)
  })

  it('回滚失败 → 错误条展示、确认框关闭、历史视图保留', async () => {
    const { rollbackSpy } = installApi()
    rollbackSpy.mockRejectedValueOnce(new Error('BRIEF_ROLLBACK_LATEST：该版本即当前最新，无需回滚'))
    render(<BriefHistoryView onClose={() => {}} />)

    await screen.findByText(diffTitle('与最新版 v3 的差异 · 2 项（左 v2 → 右 v3）'))
    fireEvent.click(screen.getByTestId('brief-history-rollback'))
    await screen.findByTestId('brief-history-rollback-confirm')
    fireEvent.click(screen.getByText('确认回滚'))

    await screen.findByText(/BRIEF_ROLLBACK_LATEST/)
    expect(screen.queryByTestId('brief-history-rollback-confirm')).toBeNull()
    expect(screen.getByTestId('brief-history-view')).toBeTruthy()
  })
})
