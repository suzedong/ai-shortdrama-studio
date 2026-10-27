// 谱系单点缓存 store（feature-811 B-41 收尾）
// 数据面：style:catalog IPC（feature-810 既有通道，返回 { version, count, entries } 十键全返），本模块为 renderer 唯一消费点。
// 规则：ensure 幂等单 flight 去重；status==='ok'/'unavailable' 下非 force 为 no-op（防止挂载懒 ensure 覆盖测试 prime 的快照）；
// window.api?.styleCatalog 缺失（jsdom / 浏览器外）→ status='unavailable' 不抛异常；
// getStyleEntry/getStyleName 为快照同步读、不触发拉取（保 Stage0View/StudioViewer 纯函数语义）。

import { useSyncExternalStore } from 'react'

export interface StyleCatalogState {
  status: 'idle' | 'loading' | 'ok' | 'failed' | 'unavailable'
  version: string | null
  entries: StyleCatalogEntryDto[]
}

const IDLE: StyleCatalogState = { status: 'idle', version: null, entries: [] }

let snapshot: StyleCatalogState = IDLE
const listeners = new Set<() => void>()

function setSnapshot(next: StyleCatalogState): void {
  snapshot = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) ensureStyleCatalog() // 首订阅懒 ensure（ok/unavailable 态 no-op）
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): StyleCatalogState {
  return snapshot
}

export function ensureStyleCatalog(force = false): void {
  if (snapshot.status === 'loading') return
  if (!force && (snapshot.status === 'ok' || snapshot.status === 'unavailable')) return
  const api = typeof window !== 'undefined' ? window.api : undefined
  if (!api?.styleCatalog) {
    setSnapshot({ status: 'unavailable', version: null, entries: [] })
    return
  }
  setSnapshot({ ...snapshot, status: 'loading' })
  api.styleCatalog()
    .then((r) => {
      setSnapshot({ status: 'ok', version: r.version, entries: r.entries })
    })
    .catch(() => {
      setSnapshot({ status: 'failed', version: null, entries: [] })
    })
}

export function useStyleCatalog(): StyleCatalogState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function getStyleEntry(id: string): StyleCatalogEntryDto | null {
  return snapshot.entries.find((e) => e.id === id) ?? null
}

/** 未收录 / 快照缺席 → null（调用方回退只显 ID，兼容 styleNameOf 既有语义） */
export function getStyleName(id: string): string | null {
  return getStyleEntry(id)?.name ?? null
}

/** 测试专用：注入快照（partial 合并 idle 基座）；传 null 复位 idle */
export function _setStyleCatalogSnapshotForTest(s: Partial<StyleCatalogState> | null): void {
  setSnapshot(s === null ? IDLE : { ...IDLE, ...s })
}
