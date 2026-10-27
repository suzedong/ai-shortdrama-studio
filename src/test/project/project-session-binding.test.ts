// feature-808 · 项目-会话绑定持久化（契约 §5.3/§6.2）
// tmpdir 真文件：library 的 openProject/readActiveSession/setActiveSession 与路径硬边界。
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ documents: '', userData: '' }))
vi.mock('electron', () => ({
  app: {
    getPath: (kind: string) => (kind === 'documents' ? holder.documents : holder.userData),
  },
}))

import {
  openProject,
  readActiveSession,
  readProjectTitle,
  setActiveSession,
} from '../../../electron/project/library'

let wsRoot: string
const dirs: string[] = []

async function makeProject(name: string): Promise<string> {
  const dir = path.join(wsRoot, name)
  await fsp.mkdir(dir, { recursive: true })
  await fsp.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ status: 'initiating', createdAt: '2026-01-01T00:00:00.000Z' }),
    'utf-8',
  )
  dirs.push(dir)
  return dir
}

beforeAll(async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-binding-'))
  holder.documents = tmp
  holder.userData = path.join(tmp, 'userdata')
  wsRoot = path.join(tmp, 'ai-shortdrama-studio')
  await fsp.mkdir(wsRoot, { recursive: true })
})

afterAll(async () => {
  await fsp.rm(holder.documents, { recursive: true, force: true })
})

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('feature-808 · 项目-会话绑定（契约 §6.2）', () => {
  it('openProject：旧四字段 .session.json → 返回 activeSessionId:null 且落盘定型五字段', async () => {
    const dir = await makeProject('project-legacy')
    await fsp.writeFile(
      path.join(dir, '.session.json'),
      JSON.stringify({
        dir,
        title: '旧项目',
        createdAt: '2026-01-02T00:00:00.000Z',
        lastOpenedAt: '2026-01-03T00:00:00.000Z',
      }),
      'utf-8',
    )
    const r = await openProject(dir)
    expect(r).toEqual({ ok: true, activeSessionId: null })

    const onDisk = JSON.parse(await fsp.readFile(path.join(dir, '.session.json'), 'utf-8'))
    expect(onDisk).toMatchObject({
      dir,
      title: '旧项目',
      createdAt: '2026-01-02T00:00:00.000Z',
      activeSessionId: null,
    })
    // openProject 刷新 lastOpenedAt
    expect(typeof onDisk.lastOpenedAt).toBe('string')
    expect(onDisk.lastOpenedAt).not.toBe('2026-01-03T00:00:00.000Z')
    expect(Object.keys(onDisk).sort()).toEqual(
      ['activeSessionId', 'createdAt', 'dir', 'lastOpenedAt', 'title'].sort(),
    )
  })

  it('openProject：绑定字符串原样保留', async () => {
    const dir = await makeProject('project-bound')
    await fsp.writeFile(
      path.join(dir, '.session.json'),
      JSON.stringify({
        dir, title: '已绑项目', createdAt: '2026-02-01T00:00:00.000Z',
        lastOpenedAt: '2026-02-02T00:00:00.000Z', activeSessionId: 'ses_abc',
      }),
      'utf-8',
    )
    const r = await openProject(dir)
    expect(r).toEqual({ ok: true, activeSessionId: 'ses_abc' })
  })

  it('readActiveSession：读回绑定；无文件/损坏 JSON → { sessionId: null }', async () => {
    const bound = path.join(wsRoot, 'project-bound')
    expect(await readActiveSession(bound)).toEqual({ sessionId: 'ses_abc' })

    const fresh = await makeProject('project-nosession')
    expect(await readActiveSession(fresh)).toEqual({ sessionId: null })

    await fsp.writeFile(path.join(fresh, '.session.json'), '{坏 json', 'utf-8')
    expect(await readActiveSession(fresh)).toEqual({ sessionId: null })
  })

  it('setActiveSession：写入并读回；保留 title/createdAt/lastOpenedAt（不刷打开时间）', async () => {
    const dir = path.join(wsRoot, 'project-keep')
    await makeProject('project-keep')
    await fsp.writeFile(
      path.join(dir, '.session.json'),
      JSON.stringify({
        dir, title: '留档项目', createdAt: '2026-03-01T00:00:00.000Z',
        lastOpenedAt: '2026-03-02T00:00:00.000Z', activeSessionId: null,
      }),
      'utf-8',
    )

    const w = await setActiveSession(dir, 'ses_new')
    expect(w).toEqual({ sessionId: 'ses_new' })
    expect(await readActiveSession(dir)).toEqual({ sessionId: 'ses_new' })

    const onDisk = JSON.parse(await fsp.readFile(path.join(dir, '.session.json'), 'utf-8'))
    expect(onDisk).toEqual({
      dir,
      title: '留档项目',
      createdAt: '2026-03-01T00:00:00.000Z',
      lastOpenedAt: '2026-03-02T00:00:00.000Z',
      activeSessionId: 'ses_new',
    })

    // null 清空
    expect(await setActiveSession(dir, null)).toEqual({ sessionId: null })
    expect(await readActiveSession(dir)).toEqual({ sessionId: null })
  })

  it('setActiveSession：无 .session.json 时补建（lastOpenedAt 缺省取当前时间）', async () => {
    const dir = await makeProject('project-createinfo')
    const w = await setActiveSession(dir, 'ses_x')
    expect(w).toEqual({ sessionId: 'ses_x' })
    const onDisk = JSON.parse(await fsp.readFile(path.join(dir, '.session.json'), 'utf-8'))
    expect(onDisk).toMatchObject({
      dir, title: '新项目', activeSessionId: 'ses_x',
    })
    expect(typeof onDisk.createdAt).toBe('string')
    expect(typeof onDisk.lastOpenedAt).toBe('string')
  })

  it('enqueue 串行：并发交错写入最终值为最后入队调用，且中间文件始终为五字段', async () => {
    const dir = await makeProject('project-race')
    const results = await Promise.all([
      setActiveSession(dir, 'ses_1'),
      sleep(2).then(() => setActiveSession(dir, 'ses_2')),
      setActiveSession(dir, 'ses_3'),
    ])
    expect(results).toEqual([{ sessionId: 'ses_1' }, { sessionId: 'ses_2' }, { sessionId: 'ses_3' }])
    // 入队顺序 ses_1 → ses_3 → ses_2（ses_2 延迟 2ms 才入队）；最终值为最后入队的 ses_2
    expect(await readActiveSession(dir)).toEqual({ sessionId: 'ses_2' })
    const onDisk = JSON.parse(await fsp.readFile(path.join(dir, '.session.json'), 'utf-8'))
    expect(Object.keys(onDisk).sort()).toEqual(
      ['activeSessionId', 'createdAt', 'dir', 'lastOpenedAt', 'title'].sort(),
    )
  })

  it('assertProjectDir 硬边界：工作区外 / 非 project-* 目录 → INVALID_PROJECT_DIR', async () => {
    const outside = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-out-'))
    await expect(readActiveSession(outside)).rejects.toMatchObject({
      code: 'INVALID_PROJECT_DIR',
    })
    await expect(setActiveSession(outside, 'x')).rejects.toMatchObject({
      code: 'INVALID_PROJECT_DIR',
    })
    const wrongName = path.join(wsRoot, 'other-dir')
    await fsp.mkdir(wrongName, { recursive: true })
    await expect(readActiveSession(wrongName)).rejects.toMatchObject({
      code: 'INVALID_PROJECT_DIR',
    })
    await fsp.rm(wrongName, { recursive: true, force: true })
    await fsp.rm(outside, { recursive: true, force: true })
  })
})

/* ── B-23 · readProjectTitle：project:open 处理器同步 canvas.title 的数据源（只读直读）── */
describe('B-23 · readProjectTitle', () => {
  it('读回 .session.json 的 title（含 trim 后非空判定）', async () => {
    const dir = await makeProject('project-title')
    await fsp.writeFile(
      path.join(dir, '.session.json'),
      JSON.stringify({
        dir, title: '我的短剧', createdAt: '2026-04-01T00:00:00.000Z',
        lastOpenedAt: '2026-04-02T00:00:00.000Z', activeSessionId: null,
      }),
      'utf-8',
    )
    expect(await readProjectTitle(dir)).toBe('我的短剧')
  })

  it('.session.json 缺失 / 损坏 JSON → null', async () => {
    const dir = await makeProject('project-title-none')
    expect(await readProjectTitle(dir)).toBeNull()
    await fsp.writeFile(path.join(dir, '.session.json'), '{坏 json', 'utf-8')
    expect(await readProjectTitle(dir)).toBeNull()
  })

  it('title 空白串 / 非字符串 → null（处理器跳过同步，保留画布现值）', async () => {
    const dir = await makeProject('project-title-blank')
    const file = path.join(dir, '.session.json')
    await fsp.writeFile(
      file,
      JSON.stringify({ dir, title: '   ', createdAt: '2026-04-01T00:00:00.000Z', lastOpenedAt: '2026-04-02T00:00:00.000Z', activeSessionId: null }),
      'utf-8',
    )
    expect(await readProjectTitle(dir)).toBeNull()
    await fsp.writeFile(
      file,
      JSON.stringify({ dir, title: 123, createdAt: '2026-04-01T00:00:00.000Z', lastOpenedAt: '2026-04-02T00:00:00.000Z', activeSessionId: null }),
      'utf-8',
    )
    expect(await readProjectTitle(dir)).toBeNull()
  })

  it('工作区外目录 → INVALID_PROJECT_DIR（路径硬边界同族守卫）', async () => {
    const outside = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-out-title-'))
    await expect(readProjectTitle(outside)).rejects.toMatchObject({ code: 'INVALID_PROJECT_DIR' })
    await fsp.rm(outside, { recursive: true, force: true })
  })
})
