// feature-005 · 「已捕获口径」唯一读写点 captureStore 测试（契约 §5：AC1–AC4）
// 覆盖：upsert 三路径（U1 id 精确 / U2 topic 匹配 / U3 新建）+ 缺省推导 + id 递增不复用、
// remove 两态、损坏抛错不覆盖、并发同写队列串行、changed 广播载荷全量、无文件空库。
// 夹具同 brief-update.test.ts：vi.mock('electron') userData 重定向 + mkdtemp 项目 + writeSessionState。
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { captureStore, CAPTURE_FILE_NAME } from '../../electron/capture/store'
import { writeSessionState } from '../../electron/project/library'
import type { CaptureFile } from '@shared/types'

let projDir = ''
const file = (): string => path.join(projDir, CAPTURE_FILE_NAME)
const readRaw = (): Promise<string> => fsp.readFile(file(), 'utf-8')
const readJson = async (): Promise<CaptureFile> => JSON.parse(await readRaw()) as CaptureFile

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-capture-store-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project')
})

beforeEach(async () => {
  await fsp.rm(projDir, { recursive: true, force: true })
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
})

/* ── AC1 upsert：三路径 / 缺省推导 / 静态校验 ── */

describe('captureStore · upsert（AC1）', () => {
  it('无文件 → list 空库（schemaVersion 1、facts 空），零报错', async () => {
    const f = await captureStore.list()
    expect(f).toEqual({ schemaVersion: 1, facts: [] })
  })

  it("U3 新建缺省推导：infer 缺省 pending；user 带 quote 缺省 confirmed；id 自 f1 递增", async () => {
    const a = await captureStore.upsert({ topic: 'genre', value: '甜宠' })
    expect(a).toMatchObject({ id: 'f1', topic: 'genre', value: '甜宠', source: 'infer', status: 'pending' })
    expect('quote' in a).toBe(false)
    const b = await captureStore.upsert({ topic: 'platforms', value: '抖音', source: 'user', quote: '发抖音' })
    expect(b).toMatchObject({ id: 'f2', source: 'user', status: 'confirmed', quote: '发抖音' })
    const f = await readJson()
    expect(f.schemaVersion).toBe(1)
    expect(f.facts.map(x => x.id)).toEqual(['f1', 'f2'])
  })

  it("U3 来源标定：source='user' 无 quote 举证 → INVALID_ARGUMENT 零写盘", async () => {
    const before = await fsp.readdir(projDir)
    await expect(captureStore.upsert({ topic: 'genre', value: '甜宠', source: 'user' }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })

  it('U2 无 id 按 topic trim 精确匹配 → 更新既有条不新建、id 不变', async () => {
    await captureStore.upsert({ topic: 'genre', value: '甜宠' })
    const before = await readJson()
    const u = await captureStore.upsert({ topic: ' genre ', value: '都市甜宠' })
    expect(u.id).toBe('f1')
    expect(u.value).toBe('都市甜宠')
    const f = await readJson()
    expect(f.facts).toHaveLength(1)
    expect(Date.parse(f.facts[0]!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before.facts[0]!.updatedAt))
  })

  it('U1 有 id 精确更新：非 undefined 字段覆盖、未给字段原样；id 不存在 → CAPTURE_FACT_NOT_FOUND 零写盘', async () => {
    await captureStore.upsert({ topic: 'genre', value: '甜宠', source: 'user', quote: '就写甜宠' })
    const u = await captureStore.upsert({ id: 'f1', value: '校园' })
    expect(u).toMatchObject({
      id: 'f1', topic: 'genre', value: '校园',
      source: 'user', status: 'confirmed', quote: '就写甜宠',
    })
    const rawBefore = await readRaw()
    await expect(captureStore.upsert({ id: 'f9', value: 'x' }))
      .rejects.toMatchObject({ code: 'CAPTURE_FACT_NOT_FOUND' })
    expect(await readRaw()).toBe(rawBefore)
  })

  it('U4 静态校验零写盘：无 id 时 topic 必填、新建 value 必填、topic/value trim 空串 → INVALID_ARGUMENT', async () => {
    const before = await fsp.readdir(projDir)
    await expect(captureStore.upsert({ value: 'x' }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' }) // 无 id 时 topic 必填
    await expect(captureStore.upsert({ topic: 'genre' }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' }) // 新建 value 必填
    await expect(captureStore.upsert({ topic: '   ', value: 'x' }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' }) // topic trim 空串
    await expect(captureStore.upsert({ topic: 'genre', value: '  ' }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' }) // value trim 空串
    await expect(fsp.readdir(projDir)).resolves.toEqual(before)
  })
})

/* ── AC2 remove 两态 + id 递增不复用 ── */

describe('captureStore · remove 与 id 不复用（AC2）', () => {
  it('remove 成功 → removed:true、文件少一条；同 id 再删 → CAPTURE_FACT_NOT_FOUND 零写盘', async () => {
    await captureStore.upsert({ topic: 'genre', value: '甜宠' })
    await captureStore.upsert({ topic: 'tone', value: '高甜' })
    await expect(captureStore.remove('f1')).resolves.toEqual({ removed: true })
    expect((await readJson()).facts.map(x => x.id)).toEqual(['f2'])
    const rawBefore = await readRaw()
    await expect(captureStore.remove('f1'))
      .rejects.toMatchObject({ code: 'CAPTURE_FACT_NOT_FOUND' })
    expect(await readRaw()).toBe(rawBefore)
  })

  it('id 递增不复用：f1/f2 → remove f2 → 新建得 f3', async () => {
    await captureStore.upsert({ topic: 'a', value: '1' })
    await captureStore.upsert({ topic: 'b', value: '2' })
    await captureStore.remove('f2')
    const c = await captureStore.upsert({ topic: 'c', value: '3' })
    expect(c.id).toBe('f3')
    expect((await readJson()).facts.map(x => x.id)).toEqual(['f1', 'f3'])
  })
})

/* ── AC3 损坏抛错不覆盖 + 并发同写队列 ── */

describe('captureStore · 损坏与并发（AC3）', () => {
  it('JSON 解析失败 → list/upsert 抛错含路径与「损坏」，文件内容原样不覆盖', async () => {
    await fsp.writeFile(file(), '{broken json', 'utf-8')
    await expect(captureStore.list()).rejects.toThrow(/损坏/)
    await expect(captureStore.list()).rejects.toThrow(CAPTURE_FILE_NAME)
    await expect(captureStore.upsert({ topic: 'a', value: '1' })).rejects.toThrow(/损坏/)
    expect(await readRaw()).toBe('{broken json')
  })

  it('结构不符（facts 非数组）→ 抛错含路径不覆盖', async () => {
    const bad = JSON.stringify({ schemaVersion: 1, facts: 'not-array' })
    await fsp.writeFile(file(), bad, 'utf-8')
    await expect(captureStore.list()).rejects.toThrow(/结构不符/)
    expect(await readRaw()).toBe(bad)
  })

  it('并发写同一全局写队列串行（双通道同点）：Promise.all 三 upsert 全落盘不互相覆盖', async () => {
    await Promise.all([
      captureStore.upsert({ topic: 'a', value: '1' }),
      captureStore.upsert({ topic: 'b', value: '2' }),
      captureStore.upsert({ topic: 'c', value: '3' }),
    ])
    const f = await readJson()
    expect(f.facts.map(x => x.topic).sort()).toEqual(['a', 'b', 'c'])
    expect(f.facts.map(x => x.id).sort()).toEqual(['f1', 'f2', 'f3'])
  })
})

/* ── AC4 changed 广播载荷全量 ── */

describe('captureStore · changed 广播（AC4）', () => {
  it('写成功广播全量 CaptureFile：两次 upsert + 一次 remove，载荷逐次为全量', async () => {
    const seen: CaptureFile[] = []
    const off = captureStore.subscribe(f => seen.push(f))
    await captureStore.upsert({ topic: 'genre', value: '甜宠' })
    await captureStore.upsert({ topic: 'tone', value: '高甜' })
    await captureStore.remove('f1')
    off()
    expect(seen).toHaveLength(3)
    expect(seen[0]!.facts.map(x => x.id)).toEqual(['f1'])
    expect(seen[1]!.facts.map(x => x.id)).toEqual(['f1', 'f2'])
    expect(seen[2]!.facts.map(x => x.id)).toEqual(['f2'])
    expect(seen[2]!.schemaVersion).toBe(1)
  })
})
