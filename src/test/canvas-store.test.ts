import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { CanvasStore } from '../../electron/canvas/store'
import { writeSessionState } from '../../electron/project/library'
import type { CanvasNode } from '@shared/types'
import type { CanvasUpsertNode } from '../../electron/canvas/edges'

let tmpRoot = ''
let projDir = ''

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-canvas-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project-1')
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
})

function n(id: string, overrides: Partial<CanvasUpsertNode> = {}): CanvasNode {
  return {
    id, step: '1', kind: 'outline', title: id,
    status: 'active', updatedAt: 'IGNORE', ...overrides,
  }
}

describe('T3 CanvasStore', () => {
  it('首次 get 初始化空图并落盘（schemaVersion:2）', async () => {
    const store = new CanvasStore()
    const c = await store.get()
    expect(c.schemaVersion).toBe(2)
    expect(c.nodes).toEqual([])
    expect(c.edges).toEqual([])
    expect(c.gates).toEqual([])
    expect(c.projectId).toBe(path.basename(projDir))
    const onDisk = JSON.parse(await fsp.readFile(path.join(projDir, 'canvas.json'), 'utf-8'))
    expect(onDisk.schemaVersion).toBe(2)
  })

  it('节点按 id upsert 幂等（替换而非追加）', async () => {
    const store = new CanvasStore()
    await store.update({ nodes: [n('a')] })
    await store.update({ nodes: [n('a', { title: '新标题' })] })
    const c = await store.get()
    expect(c.nodes).toHaveLength(1)
    expect(c.nodes[0]!.title).toBe('新标题')
  })

  it('updatedAt 由 store 覆写，忽略入参值', async () => {
    const store = new CanvasStore()
    await store.update({ nodes: [n('b', { updatedAt: 'IGNORE' })] })
    const c = await store.get()
    expect(c.nodes[0]!.updatedAt).not.toBe('IGNORE')
    expect(Number.isNaN(Date.parse(c.nodes[0]!.updatedAt))).toBe(false)
  })

  it('linksTo 产生 auto 边；广播顺序 = 完成顺序', async () => {
    const store = new CanvasStore()
    const seen: string[][] = []
    store.subscribe(c => seen.push(c.nodes.map(x => x.id)))
    await store.update({ nodes: [n('x')] })
    await store.update({ nodes: [n('y', { linksTo: ['x'] })] })
    const c = await store.get()
    expect(c.edges).toContainEqual({ id: 'e-y--x', from: 'y', to: 'x', auto: true })
    // 与前面用例共用同一项目目录，只校验广播末态中 x/y 的完成先后
    const last = seen[seen.length - 1]!
    expect(last[last.length - 2]).toBe('x')
    expect(last[last.length - 1]).toBe('y')
    expect(seen.length).toBeGreaterThanOrEqual(2)
  })

  it('reset 后重新懒加载磁盘图', async () => {
    const store = new CanvasStore()
    await store.update({ nodes: [n('z')] })
    store.reset()
    const c = await store.get()
    expect(c.nodes.map(x => x.id)).toContain('z')
  })
})
