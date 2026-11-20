// feature-827 · 单文件原子替换与 file.write 归档安全
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const holder = vi.hoisted(() => ({ documents: '', userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: (kind: string) => (kind === 'documents' ? holder.documents : holder.userData) },
}))

import { writeTextAtomic, writeTextAtomicSync } from '../../../electron/fs/atomic'
import { registerPureTools } from '../../../electron/mcp/tools'
import { createProject } from '../../../electron/project/library'

const originalOpen = fsp.open.bind(fsp)
const originalRename = fsp.rename.bind(fsp)

let tmpRoot = ''
let caseDir = ''
let projDir = ''

type Handler = (args: Record<string, unknown>) => Promise<{
  content: { text: string }[]
  isError?: boolean
}>

function buildFakeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    tool: (name: string, ...rest: unknown[]) => {
      handlers.set(name, rest[rest.length - 1] as Handler)
    },
  }
  return { server: server as never, handlers }
}

let handlers: Map<string, Handler>

async function call<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown>,
): Promise<T & { ok: boolean; archived?: string[]; error?: { code: string; message: string } }> {
  const result = await handlers.get(name)!(args)
  return JSON.parse(result.content[0]!.text)
}

async function expectNoTemps(dir: string): Promise<void> {
  expect((await fsp.readdir(dir)).filter(name => name.endsWith('.tmp'))).toEqual([])
}

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-atomic-write-'))
  holder.documents = path.join(tmpRoot, 'documents')
  holder.userData = path.join(tmpRoot, 'userdata')
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
  projDir = (await createProject('原子写测试')).dir
})

beforeEach(async () => {
  caseDir = await fsp.mkdtemp(path.join(tmpRoot, 'case-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fsp.rm(caseDir, { recursive: true, force: true })
})

afterAll(async () => {
  vi.restoreAllMocks()
  await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('writeTextAtomic', () => {
  it('按 open → write → fsync → close → rename 提交，新档完整且无 temp 残留', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    const events: string[] = []
    vi.spyOn(fsp, 'open').mockImplementation(((
      file: unknown, ...rest: unknown[]
    ) => {
      events.push('open')
      return (originalOpen as (...args: unknown[]) => Promise<import('node:fs/promises').FileHandle>)(file, ...rest)
        .then(handle => {
          const write = handle.writeFile.bind(handle)
          const sync = handle.sync.bind(handle)
          const close = handle.close.bind(handle)
          vi.spyOn(handle, 'writeFile').mockImplementation(((
            ...args: unknown[]
          ) => {
            events.push('write')
            return (write as (...args: unknown[]) => Promise<unknown>)(...args)
          }) as unknown as typeof handle.writeFile)
          vi.spyOn(handle, 'sync').mockImplementation((() => {
            events.push('sync')
            return sync()
          }) as unknown as typeof handle.sync)
          vi.spyOn(handle, 'close').mockImplementation((() => {
            events.push('close')
            return close()
          }) as unknown as typeof handle.close)
          return handle
        })
    }) as unknown as typeof fsp.open)
    vi.spyOn(fsp, 'rename').mockImplementation(((
      from: unknown, to: unknown
    ) => {
      events.push('rename')
      return (originalRename as (...args: unknown[]) => Promise<void>)(from, to)
    }) as unknown as typeof fsp.rename)

    await writeTextAtomic(target, '{"version":2}')

    expect(events).toEqual(['open', 'write', 'sync', 'close', 'rename'])
    expect(await fsp.readFile(target, 'utf-8')).toBe('{"version":2}')
    await expectNoTemps(caseDir)
  })

  it('temp 创建失败保留旧档', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    vi.spyOn(fsp, 'open').mockRejectedValue(new Error('INJECT_OPEN'))

    await expect(writeTextAtomic(target, 'new')).rejects.toThrow('INJECT_OPEN')
    expect(await fsp.readFile(target, 'utf-8')).toBe('old')
    await expectNoTemps(caseDir)
  })

  it('写入失败保留旧档并清理 temp', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    vi.spyOn(fsp, 'open').mockImplementation(((
      file: unknown, ...rest: unknown[]
    ) => (originalOpen as (...args: unknown[]) => Promise<import('node:fs/promises').FileHandle>)(file, ...rest)
      .then(handle => {
        vi.spyOn(handle, 'writeFile').mockRejectedValue(new Error('INJECT_WRITE'))
        return handle
      })) as unknown as typeof fsp.open)

    await expect(writeTextAtomic(target, 'new')).rejects.toThrow('INJECT_WRITE')
    expect(await fsp.readFile(target, 'utf-8')).toBe('old')
    await expectNoTemps(caseDir)
  })

  it('fsync 失败保留旧档并清理 temp', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    vi.spyOn(fsp, 'open').mockImplementation(((
      file: unknown, ...rest: unknown[]
    ) => (originalOpen as (...args: unknown[]) => Promise<import('node:fs/promises').FileHandle>)(file, ...rest)
      .then(handle => {
        vi.spyOn(handle, 'sync').mockRejectedValue(new Error('INJECT_FSYNC'))
        return handle
      })) as unknown as typeof fsp.open)

    await expect(writeTextAtomic(target, 'new')).rejects.toThrow('INJECT_FSYNC')
    expect(await fsp.readFile(target, 'utf-8')).toBe('old')
    await expectNoTemps(caseDir)
  })

  it('rename 失败保留旧档并清理 temp', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    vi.spyOn(fsp, 'rename').mockRejectedValue(new Error('INJECT_RENAME'))

    await expect(writeTextAtomic(target, 'new')).rejects.toThrow('INJECT_RENAME')
    expect(await fsp.readFile(target, 'utf-8')).toBe('old')
    await expectNoTemps(caseDir)
  })
})

describe('writeTextAtomicSync', () => {
  it('同步路径按 write → fsync → close → rename 提交', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    const events: string[] = []
    const write = fs.writeFileSync.bind(fs)
    const sync = fs.fsyncSync.bind(fs)
    const close = fs.closeSync.bind(fs)
    const rename = fs.renameSync.bind(fs)
    vi.spyOn(fs, 'writeFileSync').mockImplementation(((
      ...args: unknown[]
    ) => {
      events.push('write')
      return (write as (...args: unknown[]) => void)(...args)
    }) as unknown as typeof fs.writeFileSync)
    vi.spyOn(fs, 'fsyncSync').mockImplementation((fd: number) => {
      events.push('sync')
      return sync(fd)
    })
    vi.spyOn(fs, 'closeSync').mockImplementation((fd: number) => {
      events.push('close')
      return close(fd)
    })
    vi.spyOn(fs, 'renameSync').mockImplementation(((
      from: unknown, to: unknown
    ) => {
      events.push('rename')
      return (rename as (...args: unknown[]) => void)(from, to)
    }) as unknown as typeof fs.renameSync)

    writeTextAtomicSync(target, 'new')

    expect(events).toEqual(['write', 'sync', 'close', 'rename'])
    expect(await fsp.readFile(target, 'utf-8')).toBe('new')
    await expectNoTemps(caseDir)
  })

  it('同步 fsync 失败保留旧档并清理 temp', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
      throw new Error('INJECT_SYNC_FSYNC')
    })

    expect(() => writeTextAtomicSync(target, 'new')).toThrow('INJECT_SYNC_FSYNC')
    expect(await fsp.readFile(target, 'utf-8')).toBe('old')
    await expectNoTemps(caseDir)
  })

  it('同步 rename 失败保留旧档并清理 temp', async () => {
    const target = path.join(caseDir, 'value.json')
    await fsp.writeFile(target, 'old', 'utf-8')
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('INJECT_SYNC_RENAME')
    })

    expect(() => writeTextAtomicSync(target, 'new')).toThrow('INJECT_SYNC_RENAME')
    expect(await fsp.readFile(target, 'utf-8')).toBe('old')
    await expectNoTemps(caseDir)
  })
})

describe('file.write 原子替换', () => {
  it('覆盖成功时复制旧档归档并写入完整新档', async () => {
    const target = path.join(projDir, 'story.txt')
    await fsp.writeFile(target, 'old', 'utf-8')

    const result = await call('file.write', { path: 'story.txt', content: 'new' })

    expect(result.ok).toBe(true)
    expect(result.archived).toHaveLength(1)
    expect(await fsp.readFile(target, 'utf-8')).toBe('new')
    expect(await fsp.readFile(result.archived![0]!, 'utf-8')).toBe('old')
    await expectNoTemps(projDir)
  })

  it('归档完成后 rename 失败仍保留旧正档、归档和零 temp', async () => {
    const target = path.join(projDir, 'story.txt')
    await fsp.writeFile(target, 'old', 'utf-8')
    vi.spyOn(fsp, 'rename').mockImplementation(((
      from: unknown, to: unknown
    ) => {
      if (path.resolve(String(to)) === target && String(from).endsWith('.tmp')) {
        return Promise.reject(new Error('INJECT_FILE_WRITE_RENAME'))
      }
      return (originalRename as (...args: unknown[]) => Promise<void>)(from, to)
    }) as unknown as typeof fsp.rename)

    const result = await call('file.write', { path: 'story.txt', content: 'new' })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('INJECT_FILE_WRITE_RENAME')
    expect(await fsp.readFile(target, 'utf-8')).toBe('old')
    const archives = await fsp.readdir(path.join(projDir, '版本'))
    expect(archives.some(name => name.startsWith('story.') && name.endsWith('.txt'))).toBe(true)
    await expectNoTemps(projDir)
  })
})
