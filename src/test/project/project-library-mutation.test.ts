// B-19 · 项目改名/删除（library 层，tmpdir 真文件）
// renameProject：enqueue 读-改-写五字段仅换 title；空标题 INVALID_ARGUMENT 零写盘；无 manifest PROJECT_NOT_FOUND。
// deleteProject：当前打开项 PROJECT_ACTIVE 拒删（不调 trashItem）；其余 shell.trashItem 移入回收站（mock 断言）。
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({
  documents: '',
  userData: '',
  trashItem: vi.fn(async (_p: string) => {}),
}))
vi.mock('electron', () => ({
  app: {
    getPath: (kind: string) => (kind === 'documents' ? holder.documents : holder.userData),
  },
  shell: {
    trashItem: holder.trashItem,
  },
}))

import {
  deleteProject,
  renameProject,
  writeSessionState,
} from '../../../electron/project/library'

let wsRoot: string

async function makeProject(name: string): Promise<string> {
  const dir = path.join(wsRoot, name)
  await fsp.mkdir(dir, { recursive: true })
  await fsp.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ status: 'initiating', createdAt: '2026-01-01T00:00:00.000Z' }),
    'utf-8',
  )
  return dir
}

beforeAll(async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-mutation-'))
  holder.documents = tmp
  holder.userData = path.join(tmp, 'userdata')
  wsRoot = path.join(tmp, 'ai-shortdrama-studio')
  await fsp.mkdir(wsRoot, { recursive: true })
})

afterAll(async () => {
  await fsp.rm(holder.documents, { recursive: true, force: true })
})

describe('B-19 · renameProject 改名', () => {
  it('写入新 title（trim），保留 activeSessionId/createdAt/lastOpenedAt', async () => {
    const dir = await makeProject('project-rename')
    await fsp.writeFile(
      path.join(dir, '.session.json'),
      JSON.stringify({
        dir,
        title: '旧名',
        createdAt: '2026-04-01T00:00:00.000Z',
        lastOpenedAt: '2026-04-02T00:00:00.000Z',
        activeSessionId: 'ses_keep',
      }),
      'utf-8',
    )

    const r = await renameProject(dir, '  新名字  ')
    expect(r).toEqual({ ok: true, title: '新名字' })

    const onDisk = JSON.parse(await fsp.readFile(path.join(dir, '.session.json'), 'utf-8'))
    expect(onDisk).toEqual({
      dir,
      title: '新名字',
      createdAt: '2026-04-01T00:00:00.000Z',
      lastOpenedAt: '2026-04-02T00:00:00.000Z',
      activeSessionId: 'ses_keep',
    })
  })

  it('空标题 → INVALID_ARGUMENT 且零写盘', async () => {
    const dir = await makeProject('project-emptytitle')
    const sessionFile = path.join(dir, '.session.json')
    await fsp.writeFile(
      sessionFile,
      JSON.stringify({
        dir,
        title: '不动',
        createdAt: '2026-05-01T00:00:00.000Z',
        lastOpenedAt: '2026-05-02T00:00:00.000Z',
        activeSessionId: null,
      }),
      'utf-8',
    )

    await expect(renameProject(dir, '   ')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    const onDisk = JSON.parse(await fsp.readFile(sessionFile, 'utf-8'))
    expect(onDisk.title).toBe('不动')
  })

  it('无 manifest.json → PROJECT_NOT_FOUND', async () => {
    const dir = path.join(wsRoot, 'project-nomanifest')
    await fsp.mkdir(dir, { recursive: true })
    await expect(renameProject(dir, '任意')).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
  })
})

describe('B-19 · deleteProject 删除', () => {
  it('当前打开的项目 → PROJECT_ACTIVE 拒删，且不调 trashItem', async () => {
    const dir = await makeProject('project-current')
    writeSessionState({ currentDir: dir })
    holder.trashItem.mockClear()

    await expect(deleteProject(dir)).rejects.toMatchObject({ code: 'PROJECT_ACTIVE' })
    expect(holder.trashItem).not.toHaveBeenCalled()

    writeSessionState({ currentDir: null }) // 复位，避免影响后续用例
  })

  it('非当前项目 → shell.trashItem 移入回收站，返回 ok', async () => {
    const dir = await makeProject('project-trash')
    writeSessionState({ currentDir: null })
    holder.trashItem.mockClear()

    const r = await deleteProject(dir)
    expect(r).toEqual({ ok: true })
    expect(holder.trashItem).toHaveBeenCalledWith(dir)
    // trashItem 为 mock：目录真实存在未被删
    await expect(fsp.access(dir)).resolves.toBeUndefined()
  })

  it('目录不存在 → PROJECT_NOT_FOUND，且不调 trashItem', async () => {
    writeSessionState({ currentDir: null })
    holder.trashItem.mockClear()

    const gone = path.join(wsRoot, 'project-gone')
    await expect(deleteProject(gone)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    expect(holder.trashItem).not.toHaveBeenCalled()
  })
})
