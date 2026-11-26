import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fsp from 'node:fs/promises'

const HOME = path.join(os.tmpdir(), `f828-transfer-${process.pid}`)
const DOCUMENTS = path.join(HOME, 'Documents')
const USER_DATA = path.join(HOME, 'userData')
const ROOT = path.join(DOCUMENTS, 'ai-shortdrama-studio')
const EXTERNAL = path.join(HOME, 'external')

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key === 'documents') return DOCUMENTS
      if (key === 'userData') return USER_DATA
      return HOME
    },
  },
  shell: { trashItem: vi.fn(async () => {}) },
}))

import {
  createProject,
  listProjects,
  openProject,
  setActiveSession,
} from '../../../electron/project/library'
import {
  exportProject,
  getProjectDetail,
  importProject,
  recordSessionSource,
  type SessionSnapshotMessage,
} from '../../../electron/project/transfer'
import { canvasV4 } from '../canvas-fixtures'
import { canvasStore } from '../../../electron/canvas/store'
import { listAssets } from '../../../electron/asset/index'
import { readBriefHistory } from '../../../electron/brief/history'
import type { ProjectBrief } from '@shared/types'

const messages: SessionSnapshotMessage[] = [
  {
    info: { id: 'message-user', role: 'user' },
    parts: [{ id: 'part-user', type: 'text', text: '请保留这条正式会话' }],
  },
  {
    info: { id: 'message-agent', role: 'assistant' },
    parts: [{ id: 'part-agent', type: 'text', text: '已写入静态快照' }],
  },
]

function brief(version: number): ProjectBrief {
  return {
    schemaVersion: 2,
    version,
    kind: 'commercial',
    fiveElements: {
      genre: '都市逆袭', platforms: ['抖音'], episodeDuration: '90 秒',
      episodeCount: '80 集', tone: '紧凑', aspectRatio: '竖屏 9:16',
    },
    premise: {
      leads: '林夏 / 顾屿', time: '2026 年', place: '上海',
      coreEvent: version === 1 ? '雨夜重逢' : '天台重逢', seasonBoundary: '第一季只讲相识',
    },
    style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
    diagnosisSummary: '完整项目包测试',
    approve: { at: `2026-10-1${version}T10:00:00.000Z`, by: 'gate' },
    changesFromPrevious: version === 1 ? [] : [{ field: 'premise.coreEvent', from: '雨夜重逢', to: '天台重逢' }],
    publishedAt: `2026-10-1${version}T10:00:00.000Z`,
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fsp.readFile(file, 'utf-8')) as T
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fsp.writeFile(file, JSON.stringify(value, null, 2))
}

async function createSourceProject(title = '原始项目'): Promise<string> {
  const { dir } = await createProject(title)
  await writeJson(path.join(dir, 'canvas.json'), canvasV4({
    projectId: path.basename(dir),
    title,
  }))
  return dir
}

async function stagingEntries(parent: string): Promise<string[]> {
  return (await fsp.readdir(parent)).filter(name => name.startsWith('.sdg-staging-'))
}

beforeEach(async () => {
  vi.restoreAllMocks()
  await fsp.rm(HOME, { recursive: true, force: true })
  await fsp.mkdir(ROOT, { recursive: true })
  await fsp.mkdir(EXTERNAL, { recursive: true })
})

describe('feature-828 · 项目列表与详情', () => {
  it('按最近打开排序，旧项目回退 createdAt，详情读取指定项目而非当前项目', async () => {
    const older = await createSourceProject('较早打开')
    const newer = await createSourceProject('最近打开')
    const olderSessionFile = path.join(older, '.session.json')
    const newerSessionFile = path.join(newer, '.session.json')
    const olderSession = await readJson<Record<string, unknown>>(olderSessionFile)
    const newerSession = await readJson<Record<string, unknown>>(newerSessionFile)
    olderSession.lastOpenedAt = '2026-01-01T00:00:00.000Z'
    newerSession.lastOpenedAt = '2026-11-01T00:00:00.000Z'
    await writeJson(olderSessionFile, olderSession)
    await writeJson(newerSessionFile, newerSession)

    const list = await listProjects()
    expect(list.map(item => item.name)).toEqual(['最近打开', '较早打开'])
    expect(list[0].lastOpenedAt).toBe('2026-11-01T00:00:00.000Z')

    delete olderSession.lastOpenedAt
    await writeJson(olderSessionFile, olderSession)
    const detail = await getProjectDetail(older)
    expect(detail.title).toBe('较早打开')
    expect(detail.projectId).toBe(path.basename(older))
    expect(detail.lastOpenedAt).toBe(olderSession.createdAt)
    expect(detail.current).toBe(false)
  })
})

describe('feature-828 · 静态项目包', () => {
  it('导出真实会话快照，过滤秘密与缓存，重复导入生成独立项目并记录来源', async () => {
    const source = await createSourceProject('可迁移项目')
    const richCanvas = canvasV4({
      projectId: path.basename(source),
      title: '可迁移项目',
      nodes: [{
        id: 'story-outline', step: '1', kind: 'outline', title: '故事大纲', status: 'done',
        position: { x: 120, y: 80 }, ref: { path: '故事/outline.json', format: 'json' },
        assetIds: ['asset-poster'], updatedAt: '2026-10-12T10:00:00.000Z',
      }],
    })
    richCanvas.pages[0]!.canvases.push({
      id: 'canvas-2', title: '分镜草稿', viewport: { x: -20, y: 30, zoom: 0.8 },
      nodes: [{
        id: 'shot-1', step: '4', kind: 'storyboard', title: '第一场分镜', status: 'active',
        position: { x: 240, y: 160 }, updatedAt: '2026-10-12T11:00:00.000Z',
      }],
      edges: [],
    })
    richCanvas.pages.push({
      id: 'page-2', title: '第二创作页', activeCanvasId: 'canvas-3',
      canvases: [{ id: 'canvas-3', title: '发布检查', nodes: [], edges: [], viewport: null }],
    })
    await writeJson(path.join(source, 'canvas.json'), richCanvas)
    await writeJson(path.join(source, '立项单.v1.json'), brief(1))
    await writeJson(path.join(source, '立项单.v2.json'), brief(2))

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    await fsp.mkdir(path.join(source, '资产', '上传'), { recursive: true })
    await fsp.mkdir(path.join(source, '资产', '缩略图'), { recursive: true })
    await fsp.mkdir(path.join(source, '故事'), { recursive: true })
    await fsp.mkdir(path.join(source, 'node_modules', 'secret'), { recursive: true })
    await fsp.mkdir(path.join(source, 'runtime'), { recursive: true })
    await fsp.mkdir(path.join(source, '.session.archive'), { recursive: true })
    await fsp.writeFile(path.join(source, '故事', 'outline.json'), '{"title":"雨夜重逢"}')
    await fsp.writeFile(path.join(source, '资产', '上传', 'poster.png'), png)
    await writeJson(path.join(source, '资产', 'asset-index.json'), [{
      id: 'asset-poster', kind: 'image', path: '资产/上传/poster.png',
      createdAt: '2026-10-12T10:00:00.000Z', meta: { originalName: 'poster.png' },
    }])
    await fsp.writeFile(path.join(source, '资产', '角色.json'), '{"id":"role-1"}')
    await fsp.writeFile(path.join(source, '资产', '缩略图', 'cache.png'), 'cache')
    await fsp.writeFile(path.join(source, 'node_modules', 'secret', 'index.js'), 'secret')
    await fsp.writeFile(path.join(source, 'runtime', 'cache.json'), '{"pid":123}')
    await fsp.writeFile(path.join(source, '.session.archive', 'old.json'), '{"activeSessionId":"old-session"}')
    await fsp.writeFile(path.join(source, '.agent-runs.json'), JSON.stringify([{
      id: 'message-user', sessionId: 'source-session',
      request: { sessionId: 'source-session', text: '请求' }, status: 'running',
      createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z',
    }]))
    await fsp.writeFile(path.join(source, '.env'), 'TOKEN=secret')
    await fsp.writeFile(path.join(source, 'opencode.json'), '{"token":"secret"}')
    await fsp.writeFile(path.join(source, 'ai-service.json'), '{"apiKey":"secret"}')
    await fsp.writeFile(path.join(source, 'comfy-jobs.json'), '{"jobs":[]}')
    await fsp.writeFile(path.join(source, 'private.key'), 'secret')
    await fsp.writeFile(path.join(source, 'draft.tmp'), 'partial')
    await setActiveSession(source, 'source-session')

    const destination = path.join(EXTERNAL, 'renamed-package')
    const exported = await exportProject(source, destination, async sessionId => {
      expect(sessionId).toBe('source-session')
      return messages
    })
    expect(exported).toEqual({ exportDir: destination, sessionSnapshotExported: true })
    expect(await readJson(path.join(destination, '.session.json'))).toMatchObject({
      dir: '',
      title: '可迁移项目',
      activeSessionId: null,
    })
    expect(await readJson(path.join(destination, 'session-snapshots.json'))).toMatchObject({
      schemaVersion: 1,
      sessions: [{ sourceProjectId: path.basename(source), sourceSessionId: 'source-session', messages }],
    })
    for (const relative of [
      '.env', 'opencode.json', 'ai-service.json', 'comfy-jobs.json', 'private.key',
      'draft.tmp', 'node_modules', 'runtime', '.session.archive', '.agent-runs.json', '资产/缩略图',
    ]) {
      await expect(fsp.access(path.join(destination, relative))).rejects.toThrow()
    }
    await expect(fsp.readFile(path.join(destination, '资产', '角色.json'), 'utf-8')).resolves.toContain('role-1')
    await expect(fsp.readFile(path.join(destination, '资产', '上传', 'poster.png'))).resolves.toEqual(png)
    await expect(fsp.readFile(path.join(destination, '故事', 'outline.json'), 'utf-8')).resolves.toContain('雨夜重逢')
    expect(await readJson(path.join(destination, 'canvas.json'))).toEqual(richCanvas)
    expect(await readJson(path.join(destination, '立项单.v1.json'))).toEqual(brief(1))
    expect(await readJson(path.join(destination, '立项单.v2.json'))).toEqual(brief(2))

    const first = (await importProject(destination)).dir
    const second = (await importProject(destination)).dir
    expect(first).not.toBe(source)
    expect(second).not.toBe(first)
    expect(path.basename(first)).toMatch(/^project-/)
    expect(path.basename(second)).toMatch(/^project-/)

    const firstSession = await readJson<Record<string, unknown>>(path.join(first, '.session.json'))
    expect(firstSession).toMatchObject({ dir: first, title: '可迁移项目', activeSessionId: null })
    expect(await readJson<Record<string, unknown>>(path.join(first, 'canvas.json'))).toMatchObject({
      projectId: path.basename(first),
      title: '可迁移项目',
      pages: [
        {
          id: 'page-1',
          canvases: [
            { id: 'canvas-1', nodes: [{ id: 'story-outline', ref: { path: '故事/outline.json' } }] },
            { id: 'canvas-2', nodes: [{ id: 'shot-1' }] },
          ],
        },
        { id: 'page-2', canvases: [{ id: 'canvas-3' }] },
      ],
    })
    await canvasStore.assertReadable(first)
    expect(await readBriefHistory(first)).toMatchObject({
      latestVersion: 2,
      versions: [{ version: 1, changeCount: 0 }, { version: 2, changeCount: 1 }],
      warnings: [],
    })
    expect(await listAssets(undefined, first)).toEqual([
      expect.objectContaining({ id: 'asset-poster', path: '资产/上传/poster.png' }),
    ])
    await expect(fsp.readFile(path.join(first, '资产', '上传', 'poster.png'))).resolves.toEqual(png)
    await expect(fsp.access(path.join(first, '.agent-runs.json'))).rejects.toThrow()
    await recordSessionSource(first, 'local-session')
    await recordSessionSource(first, 'local-session')
    expect(await readJson(path.join(first, 'session-sources.json'))).toMatchObject({
      schemaVersion: 1,
      sources: [{ sessionId: 'local-session', sourceSessionId: 'source-session' }],
    })

    const opened = await openProject(first)
    expect(opened.activeSessionId).toBeNull()
    expect((await getProjectDetail(first)).current).toBe(true)
    expect((await getProjectDetail(first)).snapshots[0].messages).toEqual(messages)
  })

  it('已有导出目录不覆盖；绑定会话读取失败时不留下目标或 staging', async () => {
    const source = await createSourceProject()
    const destination = path.join(EXTERNAL, 'existing')
    await fsp.mkdir(destination)
    await fsp.writeFile(path.join(destination, 'keep.txt'), 'keep')
    await expect(exportProject(source, destination, async () => [])).rejects.toMatchObject({
      code: 'PROJECT_EXPORT_EXISTS',
    })
    await expect(fsp.readFile(path.join(destination, 'keep.txt'), 'utf-8')).resolves.toBe('keep')

    const failedDestination = path.join(EXTERNAL, 'failed')
    await setActiveSession(source, 'broken-session')
    await expect(exportProject(source, failedDestination, async () => {
      throw new Error('runtime unavailable')
    })).rejects.toThrow('runtime unavailable')
    await expect(fsp.access(failedDestination)).rejects.toThrow()
    expect(await stagingEntries(EXTERNAL)).toEqual([])
  })

  it('源目录符号链接、损坏会话与非法画布均失败，项目列表和 staging 不受污染', async () => {
    const source = await createSourceProject()
    await fsp.writeFile(path.join(EXTERNAL, 'outside.txt'), 'outside')
    await fsp.symlink(path.join(EXTERNAL, 'outside.txt'), path.join(source, 'linked.txt'))
    const destination = path.join(EXTERNAL, 'symlink-export')
    await expect(exportProject(source, destination, async () => [])).rejects.toMatchObject({
      code: 'PROJECT_PACKAGE_SYMLINK',
    })
    await expect(fsp.access(destination)).rejects.toThrow()
    expect(await stagingEntries(EXTERNAL)).toEqual([])

    const before = (await listProjects()).map(item => item.dir)
    const invalidSource = path.join(EXTERNAL, 'invalid-package')
    await fsp.mkdir(invalidSource)
    await writeJson(path.join(invalidSource, 'manifest.json'), {
      schemaVersion: 1,
      id: path.basename(invalidSource),
      title: '损坏包',
    })
    await writeJson(path.join(invalidSource, 'canvas.json'), canvasV4({
      projectId: 'different-project',
      title: '损坏包',
    }))
    await expect(importProject(invalidSource)).rejects.toThrow()
    expect((await listProjects()).map(item => item.dir)).toEqual(before)
    expect(await stagingEntries(ROOT)).toEqual([])

    const brokenSessionSource = path.join(EXTERNAL, 'broken-session-package')
    await fsp.mkdir(brokenSessionSource)
    await writeJson(path.join(brokenSessionSource, 'manifest.json'), { schemaVersion: 1 })
    await writeJson(path.join(brokenSessionSource, 'canvas.json'), canvasV4({
      projectId: path.basename(brokenSessionSource),
      title: '损坏会话',
    }))
    await fsp.writeFile(path.join(brokenSessionSource, '.session.json'), '{broken')
    await expect(importProject(brokenSessionSource)).rejects.toMatchObject({
      code: 'PROJECT_SESSION_INVALID',
    })
    expect((await listProjects()).map(item => item.dir)).toEqual(before)
    expect(await stagingEntries(ROOT)).toEqual([])
  })

  it('无快照项目绑定本地会话时不创建来源文件', async () => {
    const source = await createSourceProject()
    await recordSessionSource(source, 'local-only')
    await expect(fsp.access(path.join(source, 'session-sources.json'))).rejects.toThrow()
  })
})
