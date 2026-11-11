import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => holder.userData } }))

import { CanvasStore } from '../../../electron/canvas/store'
import { registerAsset } from '../../../electron/asset/index'
import { writeSessionState } from '../../../electron/project/library'
import type { CanvasNode } from '@shared/types'

let tmpRoot = ''
let projDir = ''

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-canvas-command-root-'))
  holder.userData = path.join(tmpRoot, 'userdata')
})

beforeEach(async () => {
  vi.restoreAllMocks()
  projDir = await fsp.mkdtemp(path.join(tmpRoot, 'project-'))
  writeSessionState({ currentDir: projDir })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function node(id: string, title = id): CanvasNode {
  return { id, step: '1', kind: 'outline', title, status: 'active', updatedAt: 'IGNORE' }
}

function canvasFile(): string {
  return path.join(projDir, 'canvas.json')
}

describe('feature-814 · 命令 revision / 回执 / 迁移', () => {
  it('同一 commandId + 同一请求返回原回执，零写盘零广播', async () => {
    const store = new CanvasStore()
    const request = { nodes: [node('a')] }
    const first = await store.updateWithCommand(request, { commandId: 'cmd-1', expectedRevision: 0 })
    const seen: number[] = []
    store.subscribe(canvas => seen.push(canvas.revision))
    const rename = vi.spyOn(fsp, 'rename')

    const replay = await store.updateWithCommand(request, { commandId: 'cmd-1', expectedRevision: 0 })

    expect(replay.replayed).toBe(true)
    expect(replay.receipt).toEqual(first.receipt)
    expect(replay.canvas.revision).toBe(1)
    expect(rename).not.toHaveBeenCalled()
    expect(seen).toEqual([])
  })

  it('commandId 复用与 revision 冲突均保留磁盘原文且不广播', async () => {
    const store = new CanvasStore()
    await store.updateWithCommand({ nodes: [node('a')] }, { commandId: 'cmd-1' })
    const before = await fsp.readFile(canvasFile(), 'utf-8')
    const listener = vi.fn()
    store.subscribe(listener)

    await expect(store.updateWithCommand(
      { nodes: [node('b')] }, { commandId: 'cmd-1' },
    )).rejects.toMatchObject({ code: 'CANVAS_COMMAND_CONFLICT' })
    await expect(store.updateWithCommand(
      { nodes: [node('c')] }, { commandId: 'cmd-2', expectedRevision: 0 },
    )).rejects.toMatchObject({ code: 'CANVAS_REVISION_CONFLICT' })

    expect(await fsp.readFile(canvasFile(), 'utf-8')).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('v2 旧档读入迁移，首次成功命令落 v3 且保留业务字段', async () => {
    const old = {
      schemaVersion: 2,
      projectId: 'legacy',
      title: '旧项目',
      nodes: [node('legacy')],
      edges: [],
      gates: [],
      updatedAt: new Date().toISOString(),
    }
    await fsp.writeFile(canvasFile(), JSON.stringify(old), 'utf-8')
    const store = new CanvasStore()

    const loaded = await store.get()
    expect(loaded).toMatchObject({ schemaVersion: 3, revision: 0, receipts: [], title: '旧项目' })
    await store.updateWithCommand({ nodes: [node('next')] }, { commandId: 'migrate-1' })
    const disk = JSON.parse(await fsp.readFile(canvasFile(), 'utf-8'))
    expect(disk).toMatchObject({ schemaVersion: 3, revision: 1 })
    expect(disk.nodes.map((item: CanvasNode) => item.id)).toEqual(['legacy', 'next'])
  })

  it('坏 JSON 抛 CANVAS_CORRUPT，磁盘原文不被空画布覆盖', async () => {
    await fsp.writeFile(canvasFile(), '{broken', 'utf-8')
    const store = new CanvasStore()
    await expect(store.get()).rejects.toMatchObject({ code: 'CANVAS_CORRUPT' })
    await expect(store.update({ nodes: [node('x')] })).rejects.toMatchObject({ code: 'CANVAS_CORRUPT' })
    expect(await fsp.readFile(canvasFile(), 'utf-8')).toBe('{broken')
  })

  it('receipts 只保留最近 100 条且 revision 连续', async () => {
    const store = new CanvasStore()
    let canvas = await store.get()
    for (let index = 0; index < 101; index += 1) {
      const result = await store.updateWithCommand(
        { nodes: [node('a', `title-${index}`)] },
        { commandId: `cmd-${index}`, expectedRevision: canvas.revision },
      )
      canvas = result.canvas
    }
    expect(canvas.revision).toBe(101)
    expect(canvas.receipts).toHaveLength(100)
    expect(canvas.receipts[0]?.commandId).toBe('cmd-1')
    expect(canvas.receipts.at(-1)?.commandId).toBe('cmd-100')
  })
})

describe('feature-814 · 节点资产关联', () => {
  it('绑定去重、重放、解绑，普通 update 省略 assetIds 时保留', async () => {
    const store = new CanvasStore()
    await store.update({ nodes: [node('a')] })
    const { assetId } = await registerAsset({ kind: 'image', path: '资产/参考/a.png', sourceJobId: 'job-1' })
    let canvas = await store.get()

    const bound = await store.command({
      commandId: 'bind-1', expectedRevision: canvas.revision, type: 'assets.bind',
      nodeId: 'a', assetIds: [assetId, assetId],
    })
    expect(bound.canvas.nodes[0]?.assetIds).toEqual([assetId])
    const replay = await store.command({
      commandId: 'bind-1', expectedRevision: 0, type: 'assets.bind',
      nodeId: 'a', assetIds: [assetId],
    })
    expect(replay.replayed).toBe(true)

    canvas = await store.update({ nodes: [node('a', 'renamed')] })
    expect(canvas.nodes[0]).toMatchObject({ title: 'renamed', assetIds: [assetId] })
    const unbound = await store.command({
      commandId: 'unbind-1', expectedRevision: canvas.revision, type: 'assets.unbind',
      nodeId: 'a', assetIds: [assetId],
    })
    expect(unbound.canvas.nodes[0]?.assetIds).toEqual([])
  })

  it('未知节点和资产在校验阶段失败', async () => {
    const store = new CanvasStore()
    await store.update({ nodes: [node('a')] })
    await expect(store.command({
      commandId: 'bad-node', expectedRevision: 1, type: 'assets.bind', nodeId: 'missing', assetIds: ['x'],
    })).rejects.toMatchObject({ code: 'CANVAS_NODE_NOT_FOUND' })
    await expect(store.command({
      commandId: 'bad-asset', expectedRevision: 1, type: 'assets.bind', nodeId: 'a', assetIds: ['x'],
    })).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' })
    expect((await store.get()).revision).toBe(1)
  })
})

describe('feature-814 · 原子写故障保护', () => {
  const cases = ['open', 'fsync', 'copy', 'rename'] as const

  it.each(cases)('%s 失败保留旧正档、缓存与广播，且清理临时文件', async kind => {
    const store = new CanvasStore()
    await store.update({ nodes: [node('old')] })
    const before = await fsp.readFile(canvasFile(), 'utf-8')
    const cached = await store.get()
    const listener = vi.fn()
    store.subscribe(listener)

    if (kind === 'open') {
      vi.spyOn(fsp, 'open').mockRejectedValueOnce(new Error('injected open'))
    } else if (kind === 'fsync') {
      const originalOpen = fsp.open
      vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
        const handle = await originalOpen(...args)
        vi.spyOn(handle, 'sync').mockRejectedValueOnce(new Error('injected fsync'))
        return handle
      })
    } else if (kind === 'copy') {
      vi.spyOn(fsp, 'copyFile').mockRejectedValueOnce(new Error('injected copy'))
    } else {
      vi.spyOn(fsp, 'rename').mockRejectedValueOnce(new Error('injected rename'))
    }

    await expect(store.update({ nodes: [node('new')] })).rejects.toThrow(`injected ${kind}`)
    expect(await fsp.readFile(canvasFile(), 'utf-8')).toBe(before)
    expect(await store.get()).toEqual(cached)
    expect(listener).not.toHaveBeenCalled()
    const files = await fsp.readdir(projDir)
    expect(files.filter(file => file.includes('.tmp')).length).toBe(0)
  })
})
