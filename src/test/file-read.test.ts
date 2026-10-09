// feature-022 · file:read 安全单测（契约 §2 / AC-4）
// 覆盖六类拒绝中的五类（FORBIDDEN_FORMAT/PATH_ESCAPE/TOO_LARGE/NOT_FOUND/INVALID_ARGUMENT）；
// NO_PROJECT 由 main.ts 包装层（getActiveProjectDir 捕获）承担，真机验收覆盖。
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readProjectFile } from '../../electron/fs/read'

let root: string

beforeAll(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'f022-fileread-'))
  await fsp.mkdir(path.join(root, '剧本'), { recursive: true })
  await fsp.writeFile(path.join(root, '剧本', '分场.json'), JSON.stringify({ scenes: [1, 2] }), 'utf-8')
  await fsp.writeFile(path.join(root, '剧本', '分场.md'), '# 分场\n', 'utf-8')
  await fsp.writeFile(path.join(root, '剧本', 'big.json'), ' '.repeat(1024 * 1024 + 1), 'utf-8')
  await fsp.writeFile(path.join(root, '剧本', 'x.png'), 'png', 'utf-8')
})

afterAll(async () => {
  await fsp.rm(root, { recursive: true, force: true })
})

describe('file:read · readProjectFile', () => {
  it('正常读取 json / md', async () => {
    const j = await readProjectFile(root, '剧本/分场.json')
    expect(j).toEqual({ ok: true, content: JSON.stringify({ scenes: [1, 2] }), format: 'json' })
    const m = await readProjectFile(root, '剧本/分场.md')
    expect(m.ok && m.format).toBe('md')
  })

  it('拒绝非法扩展名 FORBIDDEN_FORMAT', async () => {
    const r = await readProjectFile(root, '剧本/x.png')
    expect(r).toEqual({ ok: false, error: { code: 'FORBIDDEN_FORMAT', message: expect.any(String) } })
  })

  it('拒绝路径逃逸 PATH_ESCAPE（../ 与绝对路径）', async () => {
    const r1 = await readProjectFile(root, '../outside.json')
    expect(!r1.ok && r1.error.code).toBe('PATH_ESCAPE')
    const r2 = await readProjectFile(root, path.join(root, '剧本', '分场.json'))
    expect(!r2.ok && r2.error.code).toBe('PATH_ESCAPE')
  })

  it('拒绝超限 TOO_LARGE（>1MB）', async () => {
    const r = await readProjectFile(root, '剧本/big.json')
    expect(!r.ok && r.error.code).toBe('TOO_LARGE')
  })

  it('拒绝不存在 NOT_FOUND', async () => {
    const r = await readProjectFile(root, '剧本/不存在.json')
    expect(!r.ok && r.error.code).toBe('NOT_FOUND')
  })

  it('拒绝空/非法入参 INVALID_ARGUMENT', async () => {
    const r = await readProjectFile(root, '')
    expect(!r.ok && r.error.code).toBe('INVALID_ARGUMENT')
  })
})
