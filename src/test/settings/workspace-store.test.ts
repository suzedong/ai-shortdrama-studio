// feature-813 · workspace store 与 changeDir 单测（契约 §5.1 全分支）
import { describe, expect, it, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import type { WriteFileOptions } from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ documents: '', userData: '' }))
vi.mock('electron', () => ({
  app: {
    getPath: (kind: string) => (kind === 'documents' ? holder.documents : holder.userData),
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] as string[] }),
  },
}))

import {
  getSettingsView,
  resolveWorkspaceRoot,
  changeDir,
  __resetWorkspaceCacheForTests,
} from '../../../electron/settings/workspace'

const originalRename = fsp.rename.bind(fsp)
const originalWriteFileSync = fs.writeFileSync.bind(fs)
const originalFspWriteFile = fsp.writeFile.bind(fsp)

function defaultRoot(): string {
  return path.join(holder.documents, 'ai-shortdrama-studio')
}
function storePath(): string {
  return path.join(holder.userData, 'workspace.json')
}
function statePath(): string {
  return path.join(holder.userData, 'session-state.json')
}

async function makeProjects(root: string, names: string[], extraFile?: string): Promise<void> {
  await fsp.mkdir(root, { recursive: true })
  for (const n of names) {
    await fsp.mkdir(path.join(root, n), { recursive: true })
    await fsp.writeFile(path.join(root, n, 'manifest.json'), '{"status":"initiating"}', 'utf-8')
  }
  if (extraFile) {
    await fsp.writeFile(path.join(root, extraFile), 'notes', 'utf-8')
  }
}

async function resetAll(tmpBase: string): Promise<void> {
  await fsp.rm(holder.documents, { recursive: true, force: true })
  await fsp.rm(holder.userData, { recursive: true, force: true })
  holder.documents = await fsp.mkdtemp(path.join(tmpBase, 'docs-'))
  holder.userData = await fsp.mkdtemp(path.join(tmpBase, 'user-'))
  __resetWorkspaceCacheForTests()
}

let tmpBase: string

beforeAll(async () => {
  tmpBase = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-workspace-'))
  holder.documents = await fsp.mkdtemp(path.join(tmpBase, 'docs-'))
  holder.userData = await fsp.mkdtemp(path.join(tmpBase, 'user-'))
})

afterAll(async () => {
  await fsp.rm(tmpBase, { recursive: true, force: true })
})

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('workspace store 读取（契约 §5.1-1）', () => {
  it('文件缺失 → 默认根 + source=default，updatedAt 缺席', async () => {
    const v = getSettingsView()
    expect(v.root).toBe(defaultRoot())
    expect(v.defaultRoot).toBe(defaultRoot())
    expect(v.source).toBe('default')
    expect(v.updatedAt).toBeUndefined()
    expect(resolveWorkspaceRoot()).toBe(defaultRoot())
  })

  it('损坏文件 → 回退默认根', async () => {
    await fsp.mkdir(holder.userData, { recursive: true })
    await fsp.writeFile(storePath(), '{"not json', 'utf-8')
    __resetWorkspaceCacheForTests()
    expect(getSettingsView().source).toBe('default')
    expect(resolveWorkspaceRoot()).toBe(defaultRoot())
  })

  it('rootDir 空串 → 回退默认根', async () => {
    await fsp.mkdir(holder.userData, { recursive: true })
    await fsp.writeFile(storePath(), JSON.stringify({ version: 1, rootDir: '  ' }), 'utf-8')
    __resetWorkspaceCacheForTests()
    expect(getSettingsView().source).toBe('default')
  })

  it('有效 rootDir → source=store 且 root 正确、updatedAt 保留', async () => {
    const target = path.join(holder.documents, 'custom-root')
    await fsp.mkdir(target, { recursive: true })
    const updatedAt = '2026-11-03T00:00:00.000Z'
    await fsp.mkdir(holder.userData, { recursive: true })
    await fsp.writeFile(
      storePath(),
      JSON.stringify({ version: 1, rootDir: target, updatedAt }),
      'utf-8',
    )
    __resetWorkspaceCacheForTests()
    const v = getSettingsView()
    expect(v).toEqual({ root: target, defaultRoot: defaultRoot(), source: 'store', updatedAt })
    expect(resolveWorkspaceRoot()).toBe(target)
  })

  it('缓存复位后重读盘（模拟重启）', async () => {
    __resetWorkspaceCacheForTests()
    expect(resolveWorkspaceRoot()).toBe(path.join(holder.documents, 'custom-root'))
  })
})

describe('changeDir 校验分支（零写盘，契约 §5.1-2）', () => {
  it('空串 / 非字符串 → INVALID_ARGUMENT', async () => {
    await resetAll(tmpBase)
    await expect(changeDir('')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(changeDir(123 as unknown as string)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    })
  })

  it('相对路径 → INVALID_ARGUMENT', async () => {
    await resetAll(tmpBase)
    await expect(changeDir('relative/dir')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('与当前根相同 → INVALID_ARGUMENT「与当前根目录相同」', async () => {
    await resetAll(tmpBase)
    const target = path.join(holder.documents, 'root-a')
    await makeProjects(target, [])
    await fsp.mkdir(holder.userData, { recursive: true })
    await fsp.writeFile(
      storePath(),
      JSON.stringify({ version: 1, rootDir: target, updatedAt: 'now' }),
      'utf-8',
    )
    __resetWorkspaceCacheForTests()
    await expect(changeDir(target)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: '与当前根目录相同，无需更换',
    })
  })

  it('新根在旧根内 → INVALID_ARGUMENT「不能位于当前根目录内」', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const inner = path.join(R0, 'inner')
    await expect(changeDir(inner)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: '新根目录不能位于当前根目录内',
    })
  })

  it('目标目录不存在 → WORKSPACE_NOT_FOUND', async () => {
    await resetAll(tmpBase)
    await expect(changeDir(path.join(holder.documents, 'no-such-dir')))
      .rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' })
  })

  it('目标是文件不是目录 → WORKSPACE_NOT_FOUND', async () => {
    await resetAll(tmpBase)
    const file = path.join(holder.documents, 'a-file.txt')
    await fsp.mkdir(holder.documents, { recursive: true })
    await fsp.writeFile(file, 'x', 'utf-8')
    await expect(changeDir(file)).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' })
  })
})

describe('changeDir 搬移与回滚（契约 §5.1-3~8）', () => {
  it('正常搬移：2 个 project-* + 非项目文件不动 + session-state 重映射 + 落盘', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const R1 = path.join(holder.documents, 'root-b')
    await makeProjects(R0, ['project-a', 'project-b'], 'notes.txt')
    await fsp.mkdir(R1, { recursive: true })
    await fsp.mkdir(holder.userData, { recursive: true })
    await fsp.writeFile(
      statePath(),
      JSON.stringify({ currentDir: path.join(R0, 'project-a') }),
      'utf-8',
    )

    const res = await changeDir(R1)
    expect(res).toEqual({ ok: true, root: R1, moved: ['project-a', 'project-b'], movedCount: 2 })

    // 新根：两个项目 + 无 notes.txt
    const entries = (await fsp.readdir(R1)).sort()
    expect(entries).toEqual(['project-a', 'project-b'])
    expect(JSON.parse(await fsp.readFile(path.join(R1, 'project-a', 'manifest.json'), 'utf-8')))
      .toEqual({ status: 'initiating' })
    // 旧根：仅剩非项目文件
    expect((await fsp.readdir(R0)).sort()).toEqual(['notes.txt'])
    // session-state 重映射到新根
    const state = JSON.parse(await fsp.readFile(statePath(), 'utf-8'))
    expect(state.currentDir).toBe(path.join(R1, 'project-a'))
    // store 落盘
    const store = JSON.parse(await fsp.readFile(storePath(), 'utf-8'))
    expect(store).toMatchObject({ version: 1, rootDir: R1 })
    expect(getSettingsView()).toMatchObject({ root: R1, source: 'store' })
  })

  it('空旧根（0 项目）→ 正常更换，movedCount=0', async () => {
    await resetAll(tmpBase)
    const R1 = path.join(holder.documents, 'root-c')
    await fsp.mkdir(R1, { recursive: true })
    const res = await changeDir(R1)
    expect(res).toEqual({ ok: true, root: R1, moved: [], movedCount: 0 })
    expect(resolveWorkspaceRoot()).toBe(R1)
  })

  it('冲突预检：目标根已存在同名项目 → WORKSPACE_TARGET_EXISTS，旧根原样', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const R1 = path.join(holder.documents, 'root-d')
    await makeProjects(R0, ['project-a'])
    await makeProjects(R1, ['project-a'])
    await expect(changeDir(R1)).rejects.toMatchObject({
      code: 'WORKSPACE_TARGET_EXISTS',
      message: expect.stringContaining('project-a'),
    })
    // 零写盘：旧根项目仍在，store 未落盘
    expect((await fsp.readdir(R0)).sort()).toEqual(['project-a'])
    await expect(fsp.access(storePath())).rejects.toThrow()
  })

  it('第 2 项 rename 失败 → 第 1 项回滚，旧根恢复原状，WORKSPACE_MOVE_FAILED', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const R1 = path.join(holder.documents, 'root-e')
    await makeProjects(R0, ['project-a', 'project-b'])
    await fsp.mkdir(R1, { recursive: true })

    vi.spyOn(fsp, 'rename').mockImplementation(async (from: unknown, to: unknown) => {
      if (String(from).endsWith('project-b')) {
        const err = new Error('EIO: i/o error') as NodeJS.ErrnoException
        err.code = 'EIO'
        throw err
      }
      return originalRename(from as string, to as string)
    })

    await expect(changeDir(R1)).rejects.toMatchObject({
      code: 'WORKSPACE_MOVE_FAILED',
      message: expect.stringContaining('搬移失败'),
    })
    // 回滚后旧根恢复原状
    expect((await fsp.readdir(R0)).sort()).toEqual(['project-a', 'project-b'])
    // 新根无项目残留
    expect(await fsp.readdir(R1)).toEqual([])
    // store 未落盘
    await expect(fsp.access(storePath())).rejects.toThrow()
  })

  it('EXDEV 注入 → 固定文案「不支持跨磁盘搬移」', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const R1 = path.join(holder.documents, 'root-f')
    await makeProjects(R0, ['project-a'])
    await fsp.mkdir(R1, { recursive: true })

    vi.spyOn(fsp, 'rename').mockImplementation(() => {
      const err = new Error('invalid cross-device link') as NodeJS.ErrnoException
      err.code = 'EXDEV'
      return Promise.reject(err)
    })

    await expect(changeDir(R1)).rejects.toMatchObject({
      code: 'WORKSPACE_MOVE_FAILED',
      message: '不支持跨磁盘搬移，请选择与当前根目录同磁盘的目标目录',
    })
    expect((await fsp.readdir(R0)).sort()).toEqual(['project-a'])
  })

  it('提交阶段：session-state 写失败 → WORKSPACE_PERSIST_FAILED（项目已在新根）', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const R1 = path.join(holder.documents, 'root-g')
    await makeProjects(R0, ['project-a'])
    await fsp.mkdir(R1, { recursive: true })
    await fsp.mkdir(holder.userData, { recursive: true })
    await fsp.writeFile(
      statePath(),
      JSON.stringify({ currentDir: path.join(R0, 'project-a') }),
      'utf-8',
    )

    vi.spyOn(fs, 'writeFileSync').mockImplementation((p: unknown, data?: unknown, options?: unknown) => {
      if (String(p).endsWith('session-state.json')) {
        throw new Error('EIO: inject session-state write failure')
      }
      return originalWriteFileSync(p as string, data as string | Buffer, options as WriteFileOptions | undefined)
    })

    await expect(changeDir(R1)).rejects.toMatchObject({ code: 'WORKSPACE_PERSIST_FAILED' })
    // 项目已搬移（提交阶段之前的动作已发生）
    expect((await fsp.readdir(R1)).sort()).toEqual(['project-a'])
    // store 未落盘 → 重新执行同一次更换即可修复（0 项目搬移 + 落盘成功）
    vi.restoreAllMocks()
    const retry = await changeDir(R1)
    expect(retry).toEqual({ ok: true, root: R1, moved: [], movedCount: 0 })
    expect(resolveWorkspaceRoot()).toBe(R1)
  })

  it('提交阶段：store 写失败 → WORKSPACE_PERSIST_FAILED 且文案含修复指引', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const R1 = path.join(holder.documents, 'root-h')
    await makeProjects(R0, ['project-a'])
    await fsp.mkdir(R1, { recursive: true })

    vi.spyOn(fsp, 'writeFile').mockImplementation(async (p: unknown, ...rest: unknown[]) => {
      if (String(p).endsWith('workspace.json')) {
        throw new Error('EIO: inject store write failure')
      }
      return originalFspWriteFile(p as string, ...(rest as [string]))
    })

    await expect(changeDir(R1)).rejects.toMatchObject({
      code: 'WORKSPACE_PERSIST_FAILED',
      message: expect.stringContaining('重新执行同一次更换即可修复'),
    })
    expect((await fsp.readdir(R1)).sort()).toEqual(['project-a'])
  })
})

describe('换回旧根（契约 §5.1-10）', () => {
  it('二次 changeDir 回旧根 → 项目迁回、列表恢复', async () => {
    await resetAll(tmpBase)
    const R0 = defaultRoot()
    const R1 = path.join(holder.documents, 'root-i')
    await makeProjects(R0, ['project-a'])
    await fsp.mkdir(R1, { recursive: true })
    await fsp.mkdir(holder.userData, { recursive: true })
    await fsp.writeFile(
      statePath(),
      JSON.stringify({ currentDir: path.join(R0, 'project-a') }),
      'utf-8',
    )

    const go = await changeDir(R1)
    expect(go.movedCount).toBe(1)
    const back = await changeDir(R0)
    expect(back).toEqual({ ok: true, root: R0, moved: ['project-a'], movedCount: 1 })
    expect((await fsp.readdir(R0)).sort()).toEqual(['project-a'])
    expect(await fsp.readdir(R1)).toEqual([])
    const state = JSON.parse(await fsp.readFile(statePath(), 'utf-8'))
    expect(state.currentDir).toBe(path.join(R0, 'project-a'))
    expect(resolveWorkspaceRoot()).toBe(R0)
  })
})
