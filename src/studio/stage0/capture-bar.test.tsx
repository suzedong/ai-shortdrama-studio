// feature-005 · 「已捕获口径」常驻条组件回归（契约 §5：AC5–AC6；先例 brief-history.test.tsx）
// AC5：挂载自拉恢复渲染、收起态计数 + 琥珀待确认点、展开逐条 + 来源三色标签、确认钮仅 pending、空态引导。
// AC6：行内编辑确认（系统直写 D-016）与取消零调用、确认钮转态、删除二次确认、操作失败行底错误条、
//       list 失败错误态条、capture:changed 推送全量替换（对话纠正通道同追溯）。
// 四桥 captureList / captureUpsert / captureRemove / onCaptureChanged 内存 mock（类型镜像 src/global.d.ts）。
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CapturedFact, CaptureFile, CaptureStatus } from '@shared/types'
import CaptureBar from './CaptureBar'

/* ── 夹具：4 条口径（user+confirmed / infer+confirmed / infer+pending ×2） ── */

const NOW = '2026-10-19T02:00:00.000Z'

function fact(p: Partial<CapturedFact> & Pick<CapturedFact, 'id' | 'topic' | 'value'>): CapturedFact {
  return { source: 'infer', status: 'pending', updatedAt: NOW, ...p }
}

const F1 = fact({ id: 'f1', topic: 'genre', value: '校园 / 恋爱 / 夏日', source: 'user', status: 'confirmed', quote: '就按校园恋爱来' })
const F2 = fact({ id: 'f2', topic: 'episodeCount', value: '第一季 8 集（先做 E01）', status: 'confirmed' })
const F3 = fact({ id: 'f3', topic: 'seasonBoundary', value: '灯塔悬念留第二季' })
const F4 = fact({ id: 'f4', topic: 'tone', value: '清新治愈 · 轻喜剧节奏' })

interface UpsertInput {
  id?: string
  topic?: string
  value?: string
  status?: CaptureStatus
}

/** 每用例调用：独立内存库 + 四桥 mock（写后广播全量，闭环与主进程语义一致） */
function installApi(initial: CapturedFact[] = [F1, F2, F3, F4]) {
  let facts = initial.map(f => ({ ...f }))
  const listeners = new Set<(f: CaptureFile) => void>()
  const file = (): CaptureFile => ({ schemaVersion: 1, facts: facts.map(f => ({ ...f })) })
  const broadcast = (): void => { for (const fn of listeners) fn(file()) }
  const listSpy = vi.fn(async () => file())
  const upsertSpy = vi.fn(async (input: UpsertInput) => {
    const idx = facts.findIndex(f => f.id === input.id)
    if (idx < 0) throw new Error(`CAPTURE_FACT_NOT_FOUND：口径条目不存在：${input.id}`)
    const next: CapturedFact = {
      ...facts[idx]!,
      ...(input.topic !== undefined ? { topic: input.topic } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: NOW,
    }
    facts[idx] = next
    broadcast()
    return next
  })
  const removeSpy = vi.fn(async (id: string) => {
    if (!facts.some(f => f.id === id)) throw new Error(`CAPTURE_FACT_NOT_FOUND：口径条目不存在：${id}`)
    facts = facts.filter(f => f.id !== id)
    broadcast()
    return { removed: true as const }
  })
  window.api = {
    captureList: listSpy,
    captureUpsert: upsertSpy,
    captureRemove: removeSpy,
    onCaptureChanged: (fn: (f: CaptureFile) => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  } as unknown as Window['api']
  /** 模拟对话纠正通道：主进程写盘后推送 capture:changed 全量 */
  const emit = (next: CapturedFact[]): void => { facts = next.map(f => ({ ...f })); broadcast() }
  return { listSpy, upsertSpy, removeSpy, emit }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

/* ── AC5 收起/展开与来源标签 ── */

describe('CaptureBar · 收起/展开与来源标签（AC5）', () => {
  it('挂载自拉恢复渲染 + 收起态恒显头行：计数 4 条 + 琥珀点 2 待确认，条目不渲染', async () => {
    const { listSpy } = installApi()
    render(<CaptureBar />)

    await waitFor(() => expect(screen.getByTestId('capture-bar-count').textContent).toBe('· 4 条'))
    expect(listSpy).toHaveBeenCalledTimes(1) // 恢复渲染：挂载即自拉全量
    expect(screen.getByText('· 2 待确认')).toBeTruthy() // 琥珀待确认点
    expect(screen.getByTestId('capture-bar-toggle').textContent).toBe('展开 ▾') // 默认收起
    expect(screen.queryAllByTestId('capture-item')).toHaveLength(0) // 收起态不渲染条目
  })

  it('展开逐条：顺序=data-fact-id、来源三色文案、quote 挂 title、确认钮仅 pending 两条', async () => {
    installApi()
    render(<CaptureBar />)
    fireEvent.click(screen.getByTestId('capture-bar-toggle'))

    const items = await screen.findAllByTestId('capture-item')
    expect(items.map(el => el.getAttribute('data-fact-id'))).toEqual(['f1', 'f2', 'f3', 'f4'])
    const userTag = within(items[0]!).getByText('用户原话')
    expect(userTag.getAttribute('title')).toBe('原话：就按校园恋爱来')
    expect(within(items[1]!).getByText('推断 · 已确认')).toBeTruthy()
    expect(within(items[2]!).getByText('推断 · 待确认')).toBeTruthy()
    expect(within(items[3]!).getByText('推断 · 待确认')).toBeTruthy()
    // C5：确认钮仅 pending 条（f3 / f4）
    expect(screen.getAllByTestId('capture-item-confirm')).toHaveLength(2)
    expect(within(items[0]!).queryByTestId('capture-item-confirm')).toBeNull()
    expect(within(items[1]!).queryByTestId('capture-item-confirm')).toBeNull()
    // 再点 toggle 收起
    fireEvent.click(screen.getByTestId('capture-bar-toggle'))
    expect(screen.queryAllByTestId('capture-item')).toHaveLength(0)
  })

  it('空库 → 引导文案、计数 0 条、无待确认点', async () => {
    installApi([])
    render(<CaptureBar />)

    await screen.findByTestId('capture-empty')
    expect(screen.getByTestId('capture-bar-count').textContent).toBe('· 0 条')
    expect(screen.queryByText(/待确认/)).toBeNull()
  })

  it('切项目（projectId 变化）→ 清空旧条目并重拉当前项目口径', async () => {
    installApi([F1, F2, F3, F4])
    const { rerender } = render(<CaptureBar projectId="p1" />)
    await waitFor(() => expect(screen.getByTestId('capture-bar-count').textContent).toBe('· 4 条'))

    // 新项目口径文件为空：重拉后旧项目 4 条不得残留
    const nextList = vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] }))
    ;(window.api as unknown as { captureList: unknown }).captureList = nextList
    rerender(<CaptureBar projectId="p2" />)

    await screen.findByTestId('capture-empty')
    await waitFor(() => expect(screen.getByTestId('capture-bar-count').textContent).toBe('· 0 条'))
    expect(nextList).toHaveBeenCalledTimes(1) // 切项目即重拉
    expect(screen.queryByText(/待确认/)).toBeNull()
  })
})

/* ── AC6 面板直改操作与通道同追溯 ── */

describe('CaptureBar · 面板直改操作（AC6）', () => {
  /** 展开并取出指定 fact 行 */
  async function rowOf(id: string): Promise<HTMLElement> {
    fireEvent.click(screen.getByTestId('capture-bar-toggle'))
    const items = await screen.findAllByTestId('capture-item')
    const row = items.find(el => el.getAttribute('data-fact-id') === id)
    if (!row) throw new Error(`行不存在：${id}`)
    return row as HTMLElement
  }

  it('行内编辑确认 → captureUpsert({id, topic, value}) 系统直写 + 广播后 UI 更新、编辑态退出', async () => {
    const { upsertSpy } = installApi()
    render(<CaptureBar />)
    const row = await rowOf('f3')

    fireEvent.click(within(row).getByTestId('capture-item-edit'))
    fireEvent.change(within(row).getByPlaceholderText('value'), { target: { value: '灯塔悬念留第二季末揭晓' } })
    fireEvent.click(within(row).getByTestId('capture-item-edit-save'))

    await waitFor(() => expect(upsertSpy).toHaveBeenCalledWith({
      id: 'f3', topic: 'seasonBoundary', value: '灯塔悬念留第二季末揭晓',
    }))
    await screen.findByText('灯塔悬念留第二季末揭晓') // 广播全量替换后行更新
    expect(screen.queryByTestId('capture-item-edit-save')).toBeNull()
  })

  it('行内编辑取消 → 零 upsert 调用、还原只读', async () => {
    const { upsertSpy } = installApi()
    render(<CaptureBar />)
    const row = await rowOf('f1')

    fireEvent.click(within(row).getByTestId('capture-item-edit'))
    fireEvent.change(within(row).getByPlaceholderText('value'), { target: { value: '改成别的' } })
    fireEvent.click(within(row).getByTestId('capture-item-edit-cancel'))

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('capture-item-edit-save')).toBeNull()
    expect(within(row).getByText('校园 / 恋爱 / 夏日')).toBeTruthy()
  })

  it("待确认条确认 → captureUpsert({id, status:'confirmed'}) + 待确认点减一、标签转已确认", async () => {
    const { upsertSpy } = installApi()
    render(<CaptureBar />)
    const row = await rowOf('f3')

    fireEvent.click(within(row).getByTestId('capture-item-confirm'))
    await waitFor(() => expect(upsertSpy).toHaveBeenCalledWith({ id: 'f3', status: 'confirmed' }))

    await screen.findByText('· 1 待确认')
    expect(within(row).getByText('推断 · 已确认')).toBeTruthy()
    expect(screen.getAllByTestId('capture-item-confirm')).toHaveLength(1) // 仅 f4 余 pending
  })

  it('删除二次确认：取消零调用；确认删除调 remove、行消失、计数与待确认点同步减', async () => {
    const { removeSpy } = installApi()
    render(<CaptureBar />)
    const row = await rowOf('f4')

    // 第一次：取消零调用
    fireEvent.click(within(row).getByTestId('capture-item-remove'))
    await within(row).findByTestId('capture-item-remove-confirm')
    fireEvent.click(within(row).getByText('取消'))
    expect(within(row).queryByTestId('capture-item-remove-confirm')).toBeNull()
    expect(removeSpy).not.toHaveBeenCalled()

    // 第二次：确认删除
    fireEvent.click(within(row).getByTestId('capture-item-remove'))
    fireEvent.click(await within(row).findByTestId('capture-item-remove-confirm'))
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith('f4'))

    await waitFor(() => expect(screen.getAllByTestId('capture-item')).toHaveLength(3))
    expect(screen.queryByText('清新治愈 · 轻喜剧节奏')).toBeNull()
    expect(screen.getByTestId('capture-bar-count').textContent).toBe('· 3 条')
    expect(screen.getByText('· 1 待确认')).toBeTruthy()
  })

  it('操作失败 → 行底错误条显 message，面板不崩', async () => {
    const { upsertSpy } = installApi()
    upsertSpy.mockRejectedValueOnce(new Error('INVALID_ARGUMENT：value trim 后为空'))
    render(<CaptureBar />)
    const row = await rowOf('f3')

    fireEvent.click(within(row).getByTestId('capture-item-confirm'))
    await within(row).findByText(/INVALID_ARGUMENT/)
    expect(screen.getByTestId('capture-bar')).toBeTruthy()
  })

  it('list 失败（含损坏）→ 错误态条显原因，不崩面板、不显空态引导、不重试刷屏', async () => {
    const { listSpy } = installApi()
    listSpy.mockRejectedValueOnce(new Error('口径文件损坏（D:\\p\\已捕获口径.json）：Unexpected token'))
    render(<CaptureBar />)

    await screen.findByText(/口径读取失败/)
    expect(screen.getByText(/Unexpected token/)).toBeTruthy()
    expect(screen.queryByTestId('capture-empty')).toBeNull()
    expect(listSpy).toHaveBeenCalledTimes(1) // 不自动重试
  })

  it('capture:changed 推送（对话纠正通道写盘广播）→ 全量替换自动出现新条目', async () => {
    const { emit } = installApi()
    render(<CaptureBar />)
    await waitFor(() => expect(screen.getByTestId('capture-bar-count').textContent).toBe('· 4 条'))

    act(() => emit([F1, F2, F3, F4, fact({ id: 'f5', topic: 'platforms', value: '抖音、快手' })]))
    expect(screen.getByTestId('capture-bar-count').textContent).toBe('· 5 条')
    expect(screen.getByText('· 3 待确认')).toBeTruthy()
  })
})
