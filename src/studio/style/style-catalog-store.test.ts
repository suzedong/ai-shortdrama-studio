// feature-811 T6 · style-catalog-store 单测（renderer 谱系单点缓存）
// 断言面：懒加载单 flight / ok 后 no-op + force 重拉 / window.api 缺失 unavailable 不抛 /
// reject→failed 可 force 重试 / getStyleEntry+getStyleName 命中与回退 / prime 后懒 ensure 不覆盖。
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _setStyleCatalogSnapshotForTest,
  ensureStyleCatalog,
  getStyleEntry,
  getStyleName,
  useStyleCatalog,
} from './style-catalog-store'

const ENTRY_A7: StyleCatalogEntryDto = {
  id: 'A7',
  name: '拟真人·仿真人动漫',
  familyCode: 'A',
  familyLabel: '写实影像系',
  role: 'main',
  feasibility: 'high',
  auxiliaryCandidate: false,
  visualTraits: '',
  anchorWords: 'realistic human-like anime',
  textureRecipe: '',
}

const catalogOf = (over: Partial<{ version: string; count: number; entries: StyleCatalogEntryDto[] }> = {}) => ({
  version: 'v1.46',
  count: 1,
  entries: [ENTRY_A7],
  ...over,
})

const installApi = () => {
  const spy = vi.fn().mockResolvedValue(catalogOf())
  window.api = { styleCatalog: spy } as unknown as Window['api']
  return spy
}

beforeEach(() => {
  _setStyleCatalogSnapshotForTest(null)
})
afterEach(() => {
  _setStyleCatalogSnapshotForTest(null)
  vi.restoreAllMocks()
})

describe('style-catalog-store（feature-811）', () => {
  it('首订阅懒加载；loading 中多订阅单 flight 去重', async () => {
    const spy = installApi()
    const a = renderHook(() => useStyleCatalog())
    const b = renderHook(() => useStyleCatalog())
    await waitFor(() => expect(a.result.current.status).toBe('ok'))
    expect(b.result.current.status).toBe('ok')
    expect(a.result.current.version).toBe('v1.46')
    expect(a.result.current.entries).toHaveLength(1)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('ok 后非 force 为 no-op；force 强制重拉', async () => {
    const spy = installApi()
    const { result } = renderHook(() => useStyleCatalog())
    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(spy).toHaveBeenCalledTimes(1)
    ensureStyleCatalog()
    expect(spy).toHaveBeenCalledTimes(1)
    ensureStyleCatalog(true)
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(result.current.status).toBe('ok')
  })

  it('window.api?.styleCatalog 缺失 → unavailable 不抛异常', () => {
    window.api = undefined as unknown as Window['api']
    expect(() => ensureStyleCatalog()).not.toThrow()
    const { result } = renderHook(() => useStyleCatalog())
    expect(result.current.status).toBe('unavailable')
    expect(result.current.version).toBeNull()
    expect(getStyleName('A7')).toBeNull()
  })

  it('拉取 reject → failed；force 可重试成功', async () => {
    const spy = installApi()
    spy.mockReset()
    spy.mockRejectedValueOnce(new Error('io')).mockResolvedValue(catalogOf())
    const { result } = renderHook(() => useStyleCatalog())
    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.version).toBeNull()
    ensureStyleCatalog(true)
    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.version).toBe('v1.46')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('getStyleEntry / getStyleName：命中返回十键条目与名称，未收录回退 null', () => {
    _setStyleCatalogSnapshotForTest({ status: 'ok', version: 'v1.46', entries: [ENTRY_A7] })
    expect(getStyleEntry('A7')?.familyLabel).toBe('写实影像系')
    expect(getStyleName('A7')).toBe('拟真人·仿真人动漫')
    expect(getStyleEntry('ZZ')).toBeNull()
    expect(getStyleName('ZZ')).toBeNull()
  })

  it('prime ok 快照后，挂载懒 ensure 不覆盖（window.api 零调用）', () => {
    const spy = installApi()
    _setStyleCatalogSnapshotForTest({ status: 'ok', version: 'v-prime', entries: [ENTRY_A7] })
    const { result } = renderHook(() => useStyleCatalog())
    expect(result.current.version).toBe('v-prime')
    expect(spy).not.toHaveBeenCalled()
  })
})
