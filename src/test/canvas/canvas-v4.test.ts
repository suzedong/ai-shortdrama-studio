import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => holder.userData } }))

import { CanvasStore } from '../../../electron/canvas/store'
import { writeSessionState } from '../../../electron/project/library'
import type { Canvas, CanvasNode, CanvasTarget } from '@shared/types'
import { activeDocument } from '../canvas-fixtures'

let tmpRoot = ''
let projDir = ''

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-canvas-v4-'))
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

function node(id: string): CanvasNode {
  return { id, step: '1', kind: 'outline', title: id, status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function file(root = projDir): string {
  return path.join(root, 'canvas.json')
}

async function targetOf(canvas: Canvas): Promise<CanvasTarget> {
  return {
    projectId: canvas.projectId,
    pageId: canvas.activePageId,
    canvasId: canvas.pages.find(page => page.id === canvas.activePageId)!.activeCanvasId,
  }
}

async function seededStore(): Promise<{ store: CanvasStore; canvas: Canvas; target: CanvasTarget }> {
  const store = new CanvasStore()
  const canvas = await store.update({ nodes: [node('n1')] })
  return { store, canvas, target: await targetOf(canvas) }
}

describe('feature-823 · Canvas v4 迁移与结构命令', () => {
  it('v3 只在内存懒迁移，首次成功写才替换为 v4 并保留 revision/receipts', async () => {
    const receipt = {
      commandId: 'legacy-command',
      type: 'assets.bind',
      requestHash: 'a'.repeat(64),
      revision: 2,
      appliedAt: '2026-01-01T00:00:00.000Z',
    }
    const legacy = {
      schemaVersion: 3,
      projectId: path.basename(projDir),
      title: '旧项目',
      nodes: [{ ...node('legacy'), position: { x: -120, y: 80 } }],
      edges: [],
      gates: [],
      revision: 2,
      receipts: [receipt],
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const raw = JSON.stringify(legacy)
    await fsp.writeFile(file(), raw, 'utf-8')
    const store = new CanvasStore()

    const loaded = await store.get()
    expect(loaded.schemaVersion).toBe(4)
    expect(loaded).not.toHaveProperty('nodes')
    expect(loaded.activePageId).toBe('legacy-page')
    expect(activeDocument(loaded).viewport).toBeNull()
    expect(loaded.revision).toBe(2)
    expect(loaded.receipts).toEqual([receipt])
    expect(await fsp.readFile(file(), 'utf-8')).toBe(raw)

    const moved = await store.command({
      ...(await targetOf(loaded)),
      commandId: 'move-after-migration',
      expectedRevision: 2,
      type: 'node.move',
      nodeId: 'legacy',
      position: { x: -300, y: 160 },
    })
    expect(moved.canvas.revision).toBe(3)
    expect(moved.canvas.receipts[0]).toEqual(receipt)
    expect(activeDocument(moved.canvas).nodes[0]?.position).toEqual({ x: -300, y: 160 })
    const disk = JSON.parse(await fsp.readFile(file(), 'utf-8')) as Canvas
    expect(disk.schemaVersion).toBe(4)
    expect(disk).not.toHaveProperty('nodes')
  })

  it('页/画布创建、重命名、切换与最低结构保护', async () => {
    const store = new CanvasStore()
    const empty = await store.get()
    const firstTarget = await targetOf(empty)
    await expect(store.command({
      ...firstTarget,
      commandId: 'last-page', expectedRevision: 0, type: 'page.delete',
    })).rejects.toMatchObject({ code: 'CANVAS_LAST_PAGE' })
    await expect(store.command({
      ...firstTarget,
      commandId: 'last-canvas', expectedRevision: 0, type: 'canvas.delete',
    })).rejects.toMatchObject({ code: 'CANVAS_LAST_CANVAS' })

    const page = await store.command({
      projectId: empty.projectId,
      commandId: 'page-create', expectedRevision: 0, type: 'page.create', title: '  第二页  ',
    })
    expect(page.canvas.activePageId).toBe(page.target.pageId)
    expect(page.canvas.activeView).toBe('canvas')
    expect(page.canvas.pages.find(item => item.id === page.target.pageId)?.title).toBe('第二页')

    const secondCanvas = await store.command({
      ...page.target,
      commandId: 'canvas-create', expectedRevision: page.revision, type: 'canvas.create', title: '分镜草图',
    })
    expect(secondCanvas.target.canvasId).not.toBe(page.target.canvasId)
    expect(secondCanvas.canvas.activeView).toBe('canvas')

    const renamed = await store.command({
      ...secondCanvas.target,
      commandId: 'canvas-rename', expectedRevision: secondCanvas.revision,
      type: 'canvas.rename', title: '分镜定稿',
    })
    expect(activeDocument(renamed.canvas).title).toBe('分镜定稿')
    const renamedPage = await store.command({
      ...renamed.target,
      commandId: 'page-rename', expectedRevision: renamed.revision,
      type: 'page.rename', title: '主创作页',
    })
    expect(renamedPage.canvas.pages.find(item => item.id === renamedPage.target.pageId)?.title).toBe('主创作页')

    const switched = await store.viewState({
      type: 'active.set', projectId: empty.projectId,
      pageId: firstTarget.pageId, canvasId: firstTarget.canvasId,
    })
    expect(switched.canvas.activePageId).toBe(firstTarget.pageId)
    expect(activeDocument(switched.canvas).id).toBe(firstTarget.canvasId)
    expect(switched.canvas.revision).toBe(renamedPage.revision)

    await expect(store.command({
      ...renamedPage.target,
      commandId: 'page-delete-confirm', expectedRevision: renamedPage.revision,
      type: 'page.delete',
    })).rejects.toMatchObject({ code: 'CANVAS_CONFIRM_REQUIRED' })
    const deleted = await store.command({
      ...renamedPage.target,
      commandId: 'page-delete-confirmed', expectedRevision: renamedPage.revision,
      type: 'page.delete', confirmNonEmpty: true,
    })
    expect(deleted.canvas.pages).toHaveLength(1)
    expect(deleted.canvas.activePageId).toBe(firstTarget.pageId)
  })

  it('非空删除必须主进程确认，且只删除 JSON 结构', async () => {
    const { store, canvas, target } = await seededStore()
    const artifact = path.join(projDir, '故事背景档案.md')
    await fsp.writeFile(artifact, '不得删除', 'utf-8')

    await expect(store.command({
      ...target,
      commandId: 'delete-needs-confirm', expectedRevision: canvas.revision,
      type: 'canvas.delete',
    })).rejects.toMatchObject({ code: 'CANVAS_LAST_CANVAS' })

    const extra = await store.command({
      ...target,
      commandId: 'extra-canvas', expectedRevision: canvas.revision,
      type: 'canvas.create', title: '空画布',
    })
    const nonemptyTarget = { ...target, canvasId: target.canvasId }
    await expect(store.command({
      ...nonemptyTarget,
      commandId: 'delete-canvas-confirm', expectedRevision: extra.revision,
      type: 'canvas.delete',
    })).rejects.toMatchObject({ code: 'CANVAS_CONFIRM_REQUIRED' })
    const deleted = await store.command({
      ...nonemptyTarget,
      commandId: 'delete-canvas-confirmed', expectedRevision: extra.revision,
      type: 'canvas.delete', confirmNonEmpty: true,
    })
    expect(activeDocument(deleted.canvas).id).not.toBe(nonemptyTarget.canvasId)
    expect(await fsp.readFile(artifact, 'utf-8')).toBe('不得删除')
  })
})

describe('feature-823 · 命令重放与 ViewState', () => {
  it('重放先于 revision 检查，异 payload 抛 CANVAS_COMMAND_REPLAY', async () => {
    const { store, canvas, target } = await seededStore()
    const request = {
      ...target,
      commandId: 'stable-move', expectedRevision: canvas.revision,
      type: 'node.move' as const, nodeId: 'n1', position: { x: -50, y: 90 },
    }
    const first = await store.command(request)
    const listener = vi.fn()
    store.subscribe(listener)
    const rename = vi.spyOn(fsp, 'rename')
    const replay = await store.command(request)
    expect(replay.receipt).toEqual(first.receipt)
    expect(replay.canvas).toEqual(first.canvas)
    expect(rename).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()

    await expect(store.command({ ...request, position: { x: 10, y: 20 } }))
      .rejects.toMatchObject({ code: 'CANVAS_COMMAND_REPLAY' })
    expect((await store.get()).revision).toBe(first.revision)
  })

  it('viewport 独立保存且不增 revision/receipts，相同值零写盘', async () => {
    const { store, canvas, target } = await seededStore()
    const receipts = canvas.receipts
    const changed = await store.viewState({
      type: 'viewport.set', ...target,
      viewport: { x: -400, y: 250, zoom: 1.25 },
    })
    expect(activeDocument(changed.canvas).viewport).toEqual({ x: -400, y: 250, zoom: 1.25 })
    expect(changed.canvas.revision).toBe(canvas.revision)
    expect(changed.canvas.receipts).toEqual(receipts)

    const rename = vi.spyOn(fsp, 'rename')
    const same = await store.viewState({
      type: 'viewport.set', ...target,
      viewport: { x: -400, y: 250, zoom: 1.25 },
    })
    expect(same.canvas).toEqual(changed.canvas)
    expect(rename).not.toHaveBeenCalled()
    await expect(store.viewState({
      type: 'viewport.set', ...target,
      viewport: { x: 0, y: 0, zoom: 2 },
    })).rejects.toMatchObject({ code: 'CANVAS_INVALID_VIEWPORT' })
  })

  it('原子写失败返回命令错误并保留旧文件、缓存、revision 与广播', async () => {
    const { store, canvas, target } = await seededStore()
    const before = await fsp.readFile(file(), 'utf-8')
    const listener = vi.fn()
    store.subscribe(listener)
    vi.spyOn(fsp, 'rename').mockRejectedValueOnce(new Error('injected v4 rename'))

    await expect(store.command({
      ...target,
      commandId: 'failed-move', expectedRevision: canvas.revision,
      type: 'node.move', nodeId: 'n1', position: { x: 200, y: 200 },
    })).rejects.toMatchObject({ code: 'CANVAS_COMMAND_MUTATION' })
    expect(await fsp.readFile(file(), 'utf-8')).toBe(before)
    expect(await store.get()).toEqual(canvas)
    expect(listener).not.toHaveBeenCalled()
    expect((await fsp.readdir(projDir)).filter(name => name.includes('.tmp'))).toEqual([])
  })
})

describe('feature-823 · 固定项目上下文', () => {
  it('A 写盘排队期间切到 B，两个命令仍各写原项目', async () => {
    const projA = projDir
    const store = new CanvasStore()
    const canvasA = await store.update({ nodes: [node('shared-node')] })
    const targetA = await targetOf(canvasA)
    const projB = await fsp.mkdtemp(path.join(tmpRoot, 'project-'))
    writeSessionState({ currentDir: projB })
    const canvasB = await store.update({ nodes: [node('shared-node')] })
    const targetB = await targetOf(canvasB)
    writeSessionState({ currentDir: projA })

    let release!: () => void
    let entered!: () => void
    const hold = new Promise<void>(resolve => { release = resolve })
    const reachedA = new Promise<void>(resolve => { entered = resolve })
    const originalRename = fsp.rename
    let held = false
    vi.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
      const source = String(from)
      if (!held && source.startsWith(projA) && source.includes('.canvas.')) {
        held = true
        entered()
        await hold
      }
      return originalRename(from, to)
    })

    const commandA = store.command({
      ...targetA,
      commandId: 'project-a-move', expectedRevision: canvasA.revision,
      type: 'node.move', nodeId: 'shared-node', position: { x: -100, y: 10 },
    })
    await reachedA
    writeSessionState({ currentDir: projB })
    const commandB = store.command({
      ...targetB,
      commandId: 'project-b-move', expectedRevision: canvasB.revision,
      type: 'node.move', nodeId: 'shared-node', position: { x: 300, y: 20 },
    })
    release()
    await Promise.all([commandA, commandB])

    const diskA = JSON.parse(await fsp.readFile(file(projA), 'utf-8')) as Canvas
    const diskB = JSON.parse(await fsp.readFile(file(projB), 'utf-8')) as Canvas
    expect(activeDocument(diskA).nodes[0]?.position).toEqual({ x: -100, y: 10 })
    expect(activeDocument(diskB).nodes[0]?.position).toEqual({ x: 300, y: 20 })
    expect((await store.get()).projectId).toBe(path.basename(projB))
    expect(activeDocument(await store.get()).nodes[0]?.position).toEqual({ x: 300, y: 20 })
  })
})
