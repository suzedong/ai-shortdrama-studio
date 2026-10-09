import { describe, expect, it, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'
import { archiveExisting } from '../../electron/fs/archive'

let tmpRoot = ''

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-fs-archive-'))
})

const NOW = new Date(2026, 9, 3, 12, 0, 5)
const STAMP = '20261003-120005'

describe('T2 fs/archive', () => {
  it('首次写无归档：文件不存在返回 []', async () => {
    expect(await archiveExisting(path.join(tmpRoot, 'a.json'), NOW)).toEqual([])
  })

  it('再次写：旧文件移入 版本/', async () => {
    const dir = path.join(tmpRoot, 'case1')
    await fsp.mkdir(dir, { recursive: true })
    const p = path.join(dir, 'a.json')
    await fsp.writeFile(p, 'old', 'utf-8')
    const r = await archiveExisting(p, NOW)
    expect(r).toEqual([path.join(dir, '版本', `a.${STAMP}.json`)])
    expect(await fsp.readFile(r[0]!, 'utf-8')).toBe('old')
  })

  it('同秒冲突追加序号', async () => {
    const dir = path.join(tmpRoot, 'case2')
    await fsp.mkdir(dir, { recursive: true })
    const p = path.join(dir, 'a.json')
    await fsp.writeFile(p, 'v1', 'utf-8')
    const r1 = await archiveExisting(p, NOW)
    await fsp.writeFile(p, 'v2', 'utf-8')
    const r2 = await archiveExisting(p, NOW)
    expect(path.basename(r1[0]!)).toBe(`a.${STAMP}.json`)
    expect(path.basename(r2[0]!)).toBe(`a.${STAMP}.1.json`)
  })

  it('归档失败抛错阻断（版本 路径被文件占用时）', async () => {
    const dir = path.join(tmpRoot, 'case3')
    await fsp.mkdir(dir, { recursive: true })
    // 以普通文件占用 版本 名称 → 归档时 mkdir 失败
    await fsp.writeFile(path.join(dir, '版本'), 'block', 'utf-8')
    const p = path.join(dir, 'a.json')
    await fsp.writeFile(p, 'old', 'utf-8')
    await expect(archiveExisting(p, NOW)).rejects.toThrow()
    // 原文件仍在（未被无备份覆盖）
    expect(await fsp.readFile(p, 'utf-8')).toBe('old')
  })
})
