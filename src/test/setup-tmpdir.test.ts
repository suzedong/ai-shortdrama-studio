// feature-830 · 单测临时目录契约（任务清单 T6 / 需求 AC2）
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('feature-830 单测临时目录统一（契约 §1.1）', () => {
  it('process.env.TMPDIR 与 os.tmpdir() 一致，指向仓库内 .test-tmp/（或 ASD_TEST_TMP 覆盖值）', () => {
    const expected = process.env.ASD_TEST_TMP
      ? path.resolve(process.env.ASD_TEST_TMP)
      : path.resolve(process.cwd(), '.test-tmp')

    expect(process.env.TMPDIR).toBe(expected)
    expect(os.tmpdir()).toBe(expected)
    expect(fs.existsSync(expected)).toBe(true)
  })

  it('mkdtemp 产物确实落在 .test-tmp/ 下（磁盘实证）', async () => {
    const expected = path.resolve(process.env.TMPDIR)
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-loc-probe-'))
    try {
      expect(path.dirname(dir)).toBe(expected)
      expect(fs.existsSync(dir)).toBe(true)
    } finally {
      await fsp.rm(dir, { recursive: true, force: true })
    }
  })
})
