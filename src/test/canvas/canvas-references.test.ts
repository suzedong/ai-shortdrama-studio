import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => holder.userData } }))

import { CanvasStore, canvasStore } from '../../../electron/canvas/store'
import { updateBriefFields } from '../../../electron/brief/update'
import { writeSessionState } from '../../../electron/project/library'
import { installDevMockApi } from '../../dev-mock-api'
import type { Canvas, CanvasCommandRequest, CanvasNode, CanvasTarget, ProjectManifest } from '@shared/types'

let tmpRoot = ''
let projectDir = ''

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-canvas-references-'))
  holder.userData = path.join(tmpRoot, 'userdata')
})

beforeEach(async () => {
  projectDir = await fsp.mkdtemp(path.join(tmpRoot, 'project-'))
  writeSessionState({ currentDir: projectDir })
})

afterAll(async () => {
  await fsp.rm(tmpRoot, { recursive: true, force: true })
})

type ReferenceCommand = Extract<CanvasCommandRequest, { type: 'reference.create' }>

function artifactNode(id: string, version = 'v1'): CanvasNode {
  return {
    id,
    step: '1',
    kind: 'outline',
    title: `源节点 ${id}`,
    status: 'done',
    position: { x: 12, y: -24 },
    ref: { path: `outline/${id}.json`, format: 'json' },
    meta: { version, retained: true },
    assetIds: ['asset-source'],
    parentReference: { briefVersion: 1, fields: ['premise.leads'] },
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function plainNode(id: string): CanvasNode {
  return {
    id,
    step: '2',
    kind: 'scenes',
    title: id,
    status: 'active',
    position: { x: 0, y: 0 },
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function documentAt(canvas: Canvas, target: CanvasTarget) {
  const page = canvas.pages.find(item => item.id === target.pageId)
  const document = page?.canvases.find(item => item.id === target.canvasId)
  if (!document) throw new Error('测试缺少目标画布')
  return document
}

function nodeAt(canvas: Canvas, target: CanvasTarget, nodeId: string): CanvasNode {
  const node = documentAt(canvas, target).nodes.find(item => item.id === nodeId)
  if (!node) throw new Error(`测试缺少节点 ${nodeId}`)
  return node
}

async function seededStore(extraSourceNodes: CanvasNode[] = []) {
  const store = new CanvasStore()
  const initial = await store.get()
  const source: CanvasTarget = {
    projectId: initial.projectId,
    pageId: initial.activePageId,
    canvasId: initial.pages.find(page => page.id === initial.activePageId)!.activeCanvasId,
  }
  const seeded = await store.updateWithCommand(
    { nodes: [artifactNode('source'), ...extraSourceNodes] },
    { commandId: 'seed-source', expectedRevision: initial.revision },
  )
  const page = await store.command({
    type: 'page.create',
    projectId: initial.projectId,
    title: '引用目标页',
    commandId: 'create-target-page',
    expectedRevision: seeded.revision,
  })
  return { store, source, target: page.target, revision: page.revision }
}

function referenceCommand(
  source: CanvasTarget,
  target: CanvasTarget,
  expectedRevision: number,
  commandId = 'reference-create',
): ReferenceCommand {
  return {
    type: 'reference.create',
    projectId: source.projectId,
    commandId,
    expectedRevision,
    target,
    source: { target: source, nodeId: 'source' },
    nodeId: 'reference-1',
    position: { x: -120, y: 80 },
  }
}

describe('feature-829 · 主进程跨页正式引用', () => {
  it('创建时复制源字段并持久化；同请求幂等，同 commandId 改请求拒绝', async () => {
    const { store, source, target, revision } = await seededStore()
    const sourceBefore = nodeAt(await store.get(), source, 'source')
    const request = referenceCommand(source, target, revision)

    const created = await store.command(request)
    const reference = nodeAt(created.canvas, target, request.nodeId)
    expect(created.revision).toBe(revision + 1)
    expect(created.target).toEqual(target)
    expect(reference).toMatchObject({
      id: 'reference-1',
      step: sourceBefore.step,
      kind: sourceBefore.kind,
      title: sourceBefore.title,
      status: sourceBefore.status,
      position: request.position,
      ref: sourceBefore.ref,
      meta: sourceBefore.meta,
      reference: { artifactId: 'source', version: 'v1', source },
    })
    expect(reference).not.toHaveProperty('assetIds')
    expect(reference).not.toHaveProperty('parentReference')
    expect(reference).not.toHaveProperty('dirty')
    expect(nodeAt(created.canvas, source, 'source')).toEqual(sourceBefore)
    expect(created.receipt.requestHash).toMatch(/^[a-f0-9]{64}$/)
    expect(created.receipt.payload).toMatchObject({ target })

    const replay = await store.command({ ...request, expectedRevision: 0 })
    expect(replay.receipt).toEqual(created.receipt)
    expect(replay.revision).toBe(created.revision)
    expect(documentAt(replay.canvas, target).nodes).toHaveLength(1)
    await expect(store.command({
      ...request,
      expectedRevision: 0,
      nodeId: 'changed-request',
    })).rejects.toMatchObject({ code: 'CANVAS_COMMAND_REPLAY' })

    const restarted = new CanvasStore()
    const persisted = await restarted.get()
    expect(nodeAt(persisted, target, request.nodeId).reference).toEqual(reference.reference)
    expect(persisted.receipts.at(-1)).toEqual(created.receipt)
  })

  it('拒绝目标/来源异常、同页、未发布来源、ID 冲突、非有限坐标和跨项目', async () => {
    const invalidSources: CanvasNode[] = [
      { ...artifactNode('no-ref'), ref: undefined },
      { ...artifactNode('empty-path'), ref: { path: ' ', format: 'json' } },
      { ...artifactNode('no-version'), meta: {} },
      { ...artifactNode('blank-version'), meta: { version: ' ' } },
    ]
    const { store, source, target, revision } = await seededStore(invalidSources)
    const targetSeed = await store.updateWithCommand(
      { nodes: [plainNode('occupied')] },
      { commandId: 'seed-target', expectedRevision: revision },
    )
    const base = referenceCommand(source, target, targetSeed.revision)
    const cases: { request: ReferenceCommand; code: string }[] = [
      {
        request: { ...base, commandId: 'missing-target', target: { ...target, pageId: 'missing' } },
        code: 'CANVAS_TARGET_NOT_FOUND',
      },
      {
        request: { ...base, commandId: 'missing-source-target', source: { target: { ...source, canvasId: 'missing' }, nodeId: 'source' } },
        code: 'CANVAS_TARGET_NOT_FOUND',
      },
      {
        request: { ...base, commandId: 'missing-source', source: { target: source, nodeId: 'missing' } },
        code: 'CANVAS_NODE_NOT_FOUND',
      },
      { request: { ...base, commandId: 'same-page', target: source }, code: 'CANVAS_REFERENCE_INVALID' },
      { request: { ...base, commandId: 'no-ref', source: { target: source, nodeId: 'no-ref' } }, code: 'CANVAS_REFERENCE_INVALID' },
      { request: { ...base, commandId: 'empty-path', source: { target: source, nodeId: 'empty-path' } }, code: 'CANVAS_REFERENCE_INVALID' },
      { request: { ...base, commandId: 'no-version', source: { target: source, nodeId: 'no-version' } }, code: 'CANVAS_REFERENCE_INVALID' },
      { request: { ...base, commandId: 'blank-version', source: { target: source, nodeId: 'blank-version' } }, code: 'CANVAS_REFERENCE_INVALID' },
      { request: { ...base, commandId: 'empty-node-id', nodeId: '' }, code: 'CANVAS_REFERENCE_INVALID' },
      { request: { ...base, commandId: 'id-conflict', nodeId: 'occupied' }, code: 'CANVAS_NODE_EXISTS' },
      { request: { ...base, commandId: 'nan-position', position: { x: Number.NaN, y: 0 } }, code: 'CANVAS_INVALID_POSITION' },
      { request: { ...base, commandId: 'infinite-position', position: { x: 0, y: Number.POSITIVE_INFINITY } }, code: 'CANVAS_INVALID_POSITION' },
      { request: { ...base, commandId: 'command-project', projectId: 'other' }, code: 'PROJECT_MISMATCH' },
      { request: { ...base, commandId: 'target-project', target: { ...target, projectId: 'other' } }, code: 'PROJECT_MISMATCH' },
      {
        request: { ...base, commandId: 'source-project', source: { target: { ...source, projectId: 'other' }, nodeId: 'source' } },
        code: 'PROJECT_MISMATCH',
      },
    ]

    for (const item of cases) {
      await expect(store.command(item.request)).rejects.toMatchObject({ code: item.code })
    }
    const unchanged = await store.get()
    expect(unchanged.revision).toBe(targetSeed.revision)
    expect(documentAt(unchanged, target).nodes).toHaveLength(1)
    expect(nodeAt(unchanged, target, 'occupied')).toMatchObject({
      ...plainNode('occupied'),
      updatedAt: expect.any(String),
    })
  })

  it('拒绝以已有正式引用作为来源，且不改变 revision', async () => {
    const { store, source, target, revision } = await seededStore()
    const created = await store.command(referenceCommand(source, target, revision))
    const chain: ReferenceCommand = {
      ...referenceCommand(target, source, created.revision, 'reference-chain'),
      source: { target, nodeId: 'reference-1' },
      nodeId: 'reference-chain-node',
    }
    await expect(store.command(chain)).rejects.toMatchObject({ code: 'CANVAS_REFERENCE_INVALID' })
    expect((await store.get()).revision).toBe(created.revision)
  })

  it('再版只精确更新 source target + artifactId；同版本更新不写脏', async () => {
    const projectId = path.basename(projectDir)
    const source: CanvasTarget = { projectId, pageId: 'page-source', canvasId: 'canvas-source' }
    const otherCanvas: CanvasTarget = { projectId, pageId: 'page-source', canvasId: 'canvas-other' }
    const target: CanvasTarget = { projectId, pageId: 'page-target', canvasId: 'canvas-target' }
    const referenceNode = (id: string, reference: CanvasNode['reference']): CanvasNode => ({
      ...plainNode(id),
      reference,
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const canvas: Canvas = {
      schemaVersion: 4,
      projectId,
      title: '精确再版',
      activePageId: source.pageId,
      activeView: 'stage0',
      pages: [
        {
          id: source.pageId,
          title: '来源页',
          activeCanvasId: source.canvasId,
          canvases: [
            { id: source.canvasId, title: '来源画布', nodes: [artifactNode('source')], edges: [], viewport: null },
            { id: otherCanvas.canvasId, title: '其他画布', nodes: [artifactNode('source', 'v7')], edges: [], viewport: null },
          ],
        },
        {
          id: target.pageId,
          title: '引用页',
          activeCanvasId: target.canvasId,
          canvases: [{
            id: target.canvasId,
            title: '引用画布',
            nodes: [
              referenceNode('stale', { artifactId: 'source', version: 'v1', source }),
              referenceNode('current', { artifactId: 'source', version: 'v2', source, latestVersion: 'v3', markedAt: '2026-01-02T00:00:00.000Z' }),
              referenceNode('other-canvas', { artifactId: 'source', version: 'v7', source: otherCanvas, markedAt: '2026-01-02T00:00:00.000Z' }),
              referenceNode('other-artifact', { artifactId: 'other', version: 'v1', source }),
              referenceNode('other-project', { artifactId: 'source', version: 'v1', source: { ...source, projectId: 'other' } }),
              plainNode('unrelated'),
            ],
            edges: [],
            viewport: { x: 20, y: 30, zoom: 1.1 },
          }],
        },
      ],
      gates: [],
      revision: 0,
      receipts: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    await fsp.writeFile(path.join(projectDir, 'canvas.json'), JSON.stringify(canvas), 'utf-8')
    const store = new CanvasStore()
    const before = await store.get()

    const republished = await store.updateWithCommand({
      mode: 'merge',
      nodes: [{ ...artifactNode('source', 'v2'), title: '源节点再版' }],
    }, { commandId: 'republish-source', expectedRevision: 0 })
    const stale = nodeAt(republished.canvas, target, 'stale')
    expect(stale.reference).toMatchObject({ version: 'v1', latestVersion: 'v2' })
    expect(Number.isFinite(Date.parse(stale.reference?.markedAt ?? ''))).toBe(true)
    expect(nodeAt(republished.canvas, target, 'current').reference).toEqual({
      artifactId: 'source', version: 'v2', source, latestVersion: 'v2',
    })
    for (const id of ['other-canvas', 'other-artifact', 'other-project', 'unrelated']) {
      expect(nodeAt(republished.canvas, target, id)).toEqual(nodeAt(before, target, id))
    }
    expect(nodeAt(republished.canvas, otherCanvas, 'source').meta?.version).toBe('v7')

    const sameVersion = await store.updateWithCommand({
      mode: 'merge',
      nodes: [{ ...artifactNode('source', 'v2'), meta: { version: 'v2', retained: true, sameVersionWrite: true } }],
    }, { commandId: 'same-source-version', expectedRevision: republished.revision })
    expect(documentAt(sameVersion.canvas, target).nodes).toEqual(documentAt(republished.canvas, target).nodes)
  })

  it('系统直改立项再版同样只挂脏真实引用者', async () => {
    const store = new CanvasStore()
    const initial = await store.get()
    const source: CanvasTarget = {
      projectId: initial.projectId,
      pageId: initial.activePageId,
      canvasId: initial.pages.find(page => page.id === initial.activePageId)!.activeCanvasId,
    }
    const briefNode: CanvasNode = {
      ...artifactNode('step-0-brief'), step: '0', kind: 'brief', title: '立项单 v1',
      ref: { path: '立项单.v1.json', format: 'json' }, meta: { version: 'v1' },
    }
    const seeded = await store.updateWithCommand(
      { nodes: [briefNode] }, { commandId: 'seed-brief-source', expectedRevision: initial.revision },
    )
    const page = await store.command({
      type: 'page.create', projectId: initial.projectId, title: '引用目标页',
      commandId: 'create-brief-target-page', expectedRevision: seeded.revision,
    })
    await store.command({
      ...referenceCommand(source, page.target, page.revision),
      source: { target: source, nodeId: 'step-0-brief' },
    })
    await store.viewState({ type: 'active.set', ...source })
    const now = new Date().toISOString()
    const manifest: ProjectManifest = {
      status: 'initiating', createdAt: now, workflowVersion: 1, updatedAt: now,
      statusHistory: [], briefVersion: 1,
    }
    await fsp.writeFile(path.join(projectDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    await fsp.writeFile(path.join(projectDir, '立项单.v1.json'), JSON.stringify({
      schemaVersion: 2, version: 1, kind: 'commercial',
      fiveElements: {
        genre: '甜宠', platforms: ['抖音'], episodeDuration: '90 秒',
        episodeCount: '80 集', tone: '高甜', aspectRatio: '竖屏 9:16',
      },
      premise: {
        leads: '28 岁女白领 / 30 岁男医生', time: '2024 年', place: '上海',
        coreEvent: '医院重逢', seasonBoundary: '第一季只讲相识',
      },
      style: { mainStyleId: 'A7', catalogVersion: 'v1.47' },
      approve: { at: now, by: 'gate' }, changesFromPrevious: [], publishedAt: now,
    }, null, 2))

    canvasStore.reset()
    const result = await updateBriefFields(projectDir, { fiveElements: { episodeCount: '100 集' } })
    expect(result.version).toBe(2)
    store.reset()
    const canvas = await store.get()
    expect(nodeAt(canvas, source, 'step-0-brief').meta?.version).toBe('v2')
    expect(nodeAt(canvas, page.target, 'reference-1').reference).toMatchObject({
      version: 'v1', latestVersion: 'v2', markedAt: expect.any(String),
    })
  })

  it('MCP merge 剥离伪造 reference、保留旧引用并保护页/画布/view 状态', async () => {
    const { store, source, target, revision } = await seededStore()
    const created = await store.command(referenceCommand(source, target, revision))
    const viewport = await store.viewState({
      type: 'viewport.set', projectId: source.projectId, pageId: target.pageId, canvasId: target.canvasId,
      viewport: { x: 15, y: -25, zoom: 1.25 },
    })
    const viewed = await store.viewState({ type: 'active.set', projectId: source.projectId, activeView: 'stage0' })
    const before = viewed.canvas
    const originalReference = nodeAt(before, target, 'reference-1').reference
    const forged = { artifactId: 'forged', version: 'v999', source: { ...source, canvasId: 'forged-canvas' } }

    const merged = await store.updateWithCommand({
      mode: 'merge',
      nodes: [
        { ...nodeAt(before, target, 'reference-1'), title: 'merge 更新标题', reference: forged },
        { ...plainNode('forged-new'), reference: forged },
      ],
    }, { commandId: 'mcp-merge', expectedRevision: created.revision })

    expect(nodeAt(merged.canvas, target, 'reference-1').reference).toEqual(originalReference)
    expect(nodeAt(merged.canvas, target, 'reference-1').title).toBe('merge 更新标题')
    expect(nodeAt(merged.canvas, target, 'forged-new')).not.toHaveProperty('reference')
    expect(merged.canvas.activePageId).toBe(before.activePageId)
    expect(merged.canvas.activeView).toBe('stage0')
    expect(merged.canvas.pages.map(page => page.id)).toEqual(before.pages.map(page => page.id))
    expect(merged.canvas.pages.find(page => page.id === source.pageId)).toEqual(before.pages.find(page => page.id === source.pageId))
    expect(documentAt(merged.canvas, target).viewport).toEqual(viewport.canvas.pages.find(page => page.id === target.pageId)?.canvases[0]?.viewport)
    expect(merged.revision).toBe(created.revision + 1)
  })
})

describe('feature-829 · dev-mock 对齐', () => {
  it('跨页创建引用，并在 brief 再版后仅更新正式引用状态', async () => {
    const previousApi = window.api
    try {
      ;(window as unknown as { api?: Window['api'] }).api = undefined
      installDevMockApi()
      const api = window.api
      const initialResult = await api.canvas.get()
      if (!initialResult) throw new Error('dev-mock 缺少演示画布')
      const initial: Canvas = initialResult
      const source: CanvasTarget = {
        projectId: initial.projectId,
        pageId: initial.activePageId,
        canvasId: initial.pages.find(page => page.id === initial.activePageId)!.activeCanvasId,
      }
      const page = await api.canvas.command({
        type: 'page.create', projectId: initial.projectId, title: '演示引用页',
        commandId: 'demo-reference-page', expectedRevision: initial.revision,
      })
      await expect(api.canvas.command({
        ...referenceCommand(source, page.target, page.revision, 'demo-reference-empty-node'),
        source: { target: source, nodeId: 'n-brief' },
        nodeId: '',
      })).rejects.toMatchObject({ code: 'CANVAS_REFERENCE_INVALID' })
      const created = await api.canvas.command({
        ...referenceCommand(source, page.target, page.revision, 'demo-reference-create'),
        source: { target: source, nodeId: 'n-brief' },
      })
      const reference = nodeAt(created.canvas, page.target, 'reference-1')
      expect(reference.reference).toEqual({ artifactId: 'n-brief', version: 'v3', source })

      await api.updateBrief({ premise: { leads: 'dev-mock 再版主角' } })
      const republishedResult = await api.canvas.get()
      if (!republishedResult) throw new Error('dev-mock 缺少再版画布')
      const republished: Canvas = republishedResult
      expect(nodeAt(republished, source, 'n-brief').meta?.version).toBe('v4')
      const latest = nodeAt(republished, page.target, 'reference-1').reference
      expect(latest).toMatchObject({ artifactId: 'n-brief', version: 'v3', latestVersion: 'v4', source })
      expect(Number.isFinite(Date.parse(latest?.markedAt ?? ''))).toBe(true)
    } finally {
      window.api = previousApi
    }
  })
})
