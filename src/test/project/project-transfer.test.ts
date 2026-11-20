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
    await fsp.mkdir(path.join(source, '资产', '缩略图'), { recursive: true })
    await fsp.mkdir(path.join(source, 'node_modules', 'secret'), { recursive: true })
    await fsp.writeFile(path.join(source, '资产', '角色.json'), '{"id":"role-1"}')
    await fsp.writeFile(path.join(source, '资产', '缩略图', 'cache.png'), 'cache')
    await fsp.writeFile(path.join(source, 'node_modules', 'secret', 'index.js'), 'secret')
    await fsp.writeFile(path.join(source, '.env'), 'TOKEN=secret')
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
    await expect(fsp.access(path.join(destination, '.env'))).rejects.toThrow()
    await expect(fsp.access(path.join(destination, 'node_modules'))).rejects.toThrow()
    await expect(fsp.access(path.join(destination, '资产', '缩略图'))).rejects.toThrow()
    await expect(fsp.readFile(path.join(destination, '资产', '角色.json'), 'utf-8')).resolves.toContain('role-1')

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
    })
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
