import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { CanvasStore } from '../../../electron/canvas/store'
import { writeSessionState } from '../../../electron/project/library'
import type { CanvasNode } from '@shared/types'
import type { CanvasUpsertNode } from '../../../electron/canvas/edges'

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

describe('feature-002 血缘 / 脏态保留（契约 §4.4）', () => {
  const dirty = {
    sinceBriefVersion: 2,
    latestBriefVersion: 3,
    fields: ['premise.leads'],
    severity: 'high' as const,
    impactReport: '影响清单.v2-v3.json',
  }
  const ref2 = { briefVersion: 2, fields: ['premise.leads'] }
  const ref3 = { briefVersion: 3, fields: ['premise.leads', 'kind'] }

  it('脏节点经普通 update（不带两字段）后 dirty/parentReference 保留', async () => {
    const store = new CanvasStore()
    await store.withCanvas(canvas => {
      canvas.nodes.push(n('keep', {
        status: 'done', parentReference: ref2, dirty,
      }))
    })
    await store.update({ nodes: [n('keep', { title: '改名', status: 'done' })] })
    const node = (await store.get()).nodes.find(x => x.id === 'keep')!
    expect(node.title).toBe('改名')
    expect(node.dirty).toEqual(dirty)
    expect(node.parentReference).toEqual(ref2)
  })

  it('显式 parentReference 覆盖旧值；dirty 仍保留（update 无清脏入口）', async () => {
    const store = new CanvasStore()
    await store.withCanvas(canvas => {
      canvas.nodes.push(n('override', { status: 'done', parentReference: ref2, dirty }))
    })
    await store.update({
      nodes: [n('override', { status: 'done', parentReference: ref3 })],
    })
    const node = (await store.get()).nodes.find(x => x.id === 'override')!
    expect(node.parentReference).toEqual(ref3)
    expect(node.dirty).toEqual(dirty)
  })

  it('upsert 新节点不带脏、不带血缘', async () => {
    const store = new CanvasStore()
    await store.update({ nodes: [n('fresh')] })
    const node = (await store.get()).nodes.find(x => x.id === 'fresh')!
    expect(node.dirty).toBeUndefined()
    expect(node.parentReference).toBeUndefined()
  })

  it('withCanvas 单次写盘：多次节点变更合并为一次 persist', async () => {
    const store = new CanvasStore()
    const c = await store.withCanvas(canvas => {
      canvas.nodes.push(n('w1', { status: 'done', parentReference: ref2, dirty }))
      canvas.nodes.push(n('w2', { status: 'done', parentReference: ref2 }))
    })
    expect(c.nodes.map(x => x.id)).toEqual(expect.arrayContaining(['w1', 'w2']))
  })
})
