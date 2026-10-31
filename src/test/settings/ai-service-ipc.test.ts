// feature-014 · settings:ai:* IPC 委托契约测试（契约 §6.4 挂点层）
// main.ts L861-864 两个 handler 为 ai-service 的直通委托；本测试锚定委托形状：
// 错误码原样透传（不包装）、get 返回体递归无明文 Key、空/缺席 patch → INVALID_ARGUMENT。
import { describe, expect, it, beforeEach, afterEach, afterAll, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8').slice(4),
  },
}))

import {
  getSettingsView,
  updateSettings,
  __resetAiServiceCacheForTests,
  type AiServiceUpdatePatch,
} from '../../../electron/settings/ai-service'

// 与 electron/main.ts settings:ai:get / settings:ai:update 同形委托
const handleGet = () => getSettingsView()
const handleUpdate = (patch: unknown) => updateSettings((patch ?? {}) as AiServiceUpdatePatch)

const KEY = 'sk-ipc-test-1234567890'
const savedEnv = { ...process.env }

beforeEach(async () => {
  holder.userData = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-ai-ipc-'))
  __resetAiServiceCacheForTests()
  delete process.env.ARK_API_KEY
  delete process.env.ARK_BASE_URL
  delete process.env.ARK_MODEL
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(() => {
  process.env = { ...savedEnv }
})

function* walkStrings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const item of v) yield* walkStrings(item)
  else if (v && typeof v === 'object') for (const val of Object.values(v)) yield* walkStrings(val)
}

/** 递归断言：除 sources 节点（来源标记键名合法含 apiKey）外，任何对象不得持 apiKey 键 */
function assertNoPlaintextKeyShape(v: unknown, insideSources = false): void {
  if (!v || typeof v !== 'object') return
  for (const [k, val] of Object.entries(v)) {
    if (!insideSources) expect(k).not.toBe('apiKey')
    assertNoPlaintextKeyShape(val, k === 'sources')
  }
}

describe('settings:ai IPC 委托', () => {
  it('get：返回脱敏视图，递归无明文 Key、无 apiKey 字段', async () => {
    await handleUpdate({ ark: { apiKey: KEY, model: 'm-ipc' } })
    const view = await handleGet()
    for (const s of walkStrings(view)) {
      expect(s).not.toContain(KEY)
    }
    expect(JSON.stringify(view)).not.toContain(KEY)
    assertNoPlaintextKeyShape(view)
    expect(view.ark.keyConfigured).toBe(true)
    expect(view.ark.apiKeyMasked).toBe('sk-ipc••••7890')
  })

  it('update：校验失败错误码 INVALID_ARGUMENT 原样透传（不包装、零写盘）', async () => {
    const file = path.join(holder.userData, 'ai-service.json')
    await expect(handleUpdate({ runtime: { portRangeStart: 80 } })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    })
    await expect(fsp.access(file)).rejects.toThrow()
  })

  it('update：patch 缺席（undefined）→ 空 patch → INVALID_ARGUMENT', async () => {
    await expect(handleUpdate(undefined)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('update：合法 patch 返回更新后脱敏视图（来源 store）', async () => {
    const view = await handleUpdate({ ark: { apiKey: KEY, baseUrl: 'https://ipc.example.com/v3', model: 'm1' } })
    expect(view.ark.keyConfigured).toBe(true)
    expect(view.ark.apiKeyMasked).toBe('sk-ipc••••7890')
    expect(view.ark.baseUrl).toBe('https://ipc.example.com/v3')
    expect(view.ark.sources).toEqual({ apiKey: 'store', baseUrl: 'store', model: 'store' })
    // 清除 Key（空串）→ keyConfigured=false
    const cleared = await handleUpdate({ ark: { apiKey: '' } })
    expect(cleared.ark.keyConfigured).toBe(false)
    expect(cleared.ark.apiKeyMasked).toBeUndefined()
  })
})
