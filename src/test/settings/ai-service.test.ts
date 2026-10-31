// feature-014 · ai-service store 单测（契约 §6.1/§6.2/§6.3）
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '', encAvailable: true }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
  safeStorage: {
    isEncryptionAvailable: () => holder.encAvailable,
    encryptString: (s: string) => Buffer.from(`enc:${s}`, 'utf-8'),
    decryptString: (b: Buffer) => {
      const s = b.toString('utf-8')
      if (!s.startsWith('enc:')) throw new Error('decrypt failed')
      return s.slice(4)
    },
  },
}))

import {
  getSettingsView,
  updateSettings,
  getActiveProvider,
  getArkConfig,
  getLmStudioConfig,
  getRuntimePrefs,
  maskKeyString,
  __resetAiServiceCacheForTests,
} from '../../../electron/settings/ai-service'

const KEY = 'sk-test1234567890abcd'
const savedEnv = { ...process.env }

function storePath(): string {
  return path.join(holder.userData, 'ai-service.json')
}

async function readDisk(): Promise<string> {
  return fsp.readFile(storePath(), 'utf-8')
}

beforeAll(async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-ai-svc-'))
  holder.userData = tmp
  delete process.env.ARK_API_KEY
  delete process.env.ARK_BASE_URL
  delete process.env.ARK_MODEL
  delete process.env.LMSTUDIO_BASE_URL
  delete process.env.LMSTUDIO_MODEL
})

afterAll(() => {
  process.env = { ...savedEnv }
})

describe('ai-service store', () => {
  it('初始无文件：默认视图，keyConfigured=false，来源 default', async () => {
    const v = await getSettingsView()
    expect(v.ark.keyConfigured).toBe(false)
    expect(v.ark.apiKeyMasked).toBeUndefined()
    expect(v.ark.baseUrl).toBe('https://ark.cn-beijing.volces.com/api/v3')
    expect(v.ark.model).toBe('')
    expect(v.ark.sources).toEqual({ apiKey: 'default', baseUrl: 'default', model: 'default' })
    expect(v.activeProvider).toBe('ark')
    expect(v.lmstudio).toMatchObject({ baseUrl: 'http://127.0.0.1:1234/v1', model: '' })
    expect(v.lmstudio.sources).toEqual({ baseUrl: 'default', model: 'default' })
    expect(v.runtime).toMatchObject({ portRangeStart: 4096, healthTimeoutMs: 10000, mockBaseUrl: 'http://127.0.0.1:4099/v1' })
    expect(v.runtime.sources).toEqual({ portRangeStart: 'default', healthTimeoutMs: 'default', mockBaseUrl: 'default' })
  })

  it('env 回退：store 缺席时生效值取 env 且来源标记 env', async () => {
    process.env.ARK_API_KEY = KEY
    process.env.ARK_BASE_URL = 'https://env.example.com/v1'
    process.env.ARK_MODEL = 'env-model'
    process.env.LMSTUDIO_BASE_URL = 'http://192.168.1.20:1234/v1'
    process.env.LMSTUDIO_MODEL = 'env-local-model'
    const v = await getSettingsView()
    expect(v.ark.keyConfigured).toBe(true)
    expect(v.ark.apiKeyMasked).toBe(maskKeyString(KEY))
    expect(v.ark.baseUrl).toBe('https://env.example.com/v1')
    expect(v.ark.model).toBe('env-model')
    expect(v.ark.sources).toEqual({ apiKey: 'env', baseUrl: 'env', model: 'env' })
    const cfg = await getArkConfig()
    expect(cfg.apiKey).toBe(KEY)
    expect(cfg.baseUrl).toBe('https://env.example.com/v1')
    expect(cfg.model).toBe('env-model')
    expect(v.lmstudio).toMatchObject({ baseUrl: 'http://192.168.1.20:1234/v1', model: 'env-local-model' })
    expect(v.lmstudio.sources).toEqual({ baseUrl: 'env', model: 'env' })
    expect(getLmStudioConfig()).toEqual({ baseUrl: 'http://192.168.1.20:1234/v1', model: 'env-local-model' })
  })

  it('update 保存 ark 三件套：store 优先于 env；落盘 apiKeyEnc 为 base64 密文且文件无明文', async () => {
    const v = await updateSettings({ ark: { apiKey: KEY, baseUrl: 'https://store.example.com/v3', model: 'store-model' } })
    expect(v.ark.keyConfigured).toBe(true)
    expect(v.ark.baseUrl).toBe('https://store.example.com/v3')
    expect(v.ark.model).toBe('store-model')
    expect(v.ark.sources).toEqual({ apiKey: 'store', baseUrl: 'store', model: 'store' })

    const raw = await readDisk()
    expect(raw).not.toContain(KEY)
    const onDisk = JSON.parse(raw)
    expect(onDisk.version).toBe(1)
    expect(typeof onDisk.ark.apiKeyEnc).toBe('string')
    expect(() => Buffer.from(onDisk.ark.apiKeyEnc, 'base64')).not.toThrow()
    expect(Buffer.from(onDisk.ark.apiKeyEnc, 'base64').toString('utf-8')).toBe(`enc:${KEY}`)
    // 解密往返一致
    const cfg = await getArkConfig()
    expect(cfg.apiKey).toBe(KEY)
    expect(cfg.baseUrl).toBe('https://store.example.com/v3')
    expect(cfg.model).toBe('store-model')
  })

  it('LM Studio：保存局域网地址与模型并切换服务商，方舟配置独立保留', async () => {
    delete process.env.LMSTUDIO_BASE_URL
    delete process.env.LMSTUDIO_MODEL
    const v = await updateSettings({
      activeProvider: 'lmstudio',
      lmstudio: { baseUrl: ' http://192.168.1.30:1234/v1 ', model: ' qwen-local ' },
    })
    expect(v.activeProvider).toBe('lmstudio')
    expect(v.lmstudio).toMatchObject({ baseUrl: 'http://192.168.1.30:1234/v1', model: 'qwen-local' })
    expect(v.lmstudio.sources).toEqual({ baseUrl: 'store', model: 'store' })
    expect(v.ark.baseUrl).toBe('https://store.example.com/v3')
    expect(v.ark.model).toBe('store-model')
    expect(v.ark.keyConfigured).toBe(true)
    expect(getActiveProvider()).toBe('lmstudio')
    expect(getLmStudioConfig()).toEqual({ baseUrl: 'http://192.168.1.30:1234/v1', model: 'qwen-local' })
    expect(getArkConfig().model).toBe('store-model')
  })

  it('脱敏视图无明文：序列化不含 Key 明文，ark 节点无 apiKey 字段', async () => {
    const v = await getSettingsView()
    expect(JSON.stringify(v)).not.toContain(KEY)
    expect('apiKey' in v.ark).toBe(false)
    expect(v.ark.apiKeyMasked).toBe(maskKeyString(KEY))
  })

  it('降级：isEncryptionAvailable()=false 时含 Key patch 抛 INVALID_ARGUMENT 零写盘；无 Key patch 正常', async () => {
    holder.encAvailable = false
    const before = await readDisk()
    await expect(updateSettings({ ark: { apiKey: 'sk-new-key-9876543210' } })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: '当前系统不支持安全存储，Key 未保存',
    })
    expect(await readDisk()).toBe(before)
    // 无 Key patch 照常保存
    const v = await updateSettings({ ark: { baseUrl: 'https://store2.example.com/v3' } })
    expect(v.ark.baseUrl).toBe('https://store2.example.com/v3')
    holder.encAvailable = true
  })

  it('清除 Key（空串）→ keyConfigured=false；env 亦清除后回退未配置', async () => {
    delete process.env.ARK_API_KEY
    delete process.env.ARK_BASE_URL
    delete process.env.ARK_MODEL
    const v = await updateSettings({ ark: { apiKey: '' } })
    expect(v.ark.keyConfigured).toBe(false)
    expect(v.ark.sources.apiKey).toBe('default')
    const onDisk = JSON.parse(await readDisk())
    expect('apiKeyEnc' in onDisk.ark).toBe(false)
    expect((await getArkConfig()).apiKey).toBeUndefined()
  })

  it('runtime：设置生效 store 来源；null 清除回默认', async () => {
    let v = await updateSettings({ runtime: { portRangeStart: 5000, healthTimeoutMs: 20000, mockBaseUrl: 'http://127.0.0.1:5099/v1' } })
    expect(v.runtime).toMatchObject({ portRangeStart: 5000, healthTimeoutMs: 20000, mockBaseUrl: 'http://127.0.0.1:5099/v1' })
    expect(v.runtime.sources).toEqual({ portRangeStart: 'store', healthTimeoutMs: 'store', mockBaseUrl: 'store' })
    expect((await getRuntimePrefs()).portRangeStart).toBe(5000)
    v = await updateSettings({ runtime: { portRangeStart: null, healthTimeoutMs: null, mockBaseUrl: null } })
    expect(v.runtime).toMatchObject({ portRangeStart: 4096, healthTimeoutMs: 10000, mockBaseUrl: 'http://127.0.0.1:4099/v1' })
    expect(v.runtime.sources).toEqual({ portRangeStart: 'default', healthTimeoutMs: 'default', mockBaseUrl: 'default' })
  })

  it('校验：非法值一律 INVALID_ARGUMENT 零写盘', async () => {
    const before = await readDisk()
    const cases: Parameters<typeof updateSettings>[0][] = [
      { ark: { baseUrl: 'ftp://x' } },
      { ark: { baseUrl: 123 as unknown as string } },
      { ark: { apiKey: 123 as unknown as string } },
      { activeProvider: 'other' as unknown as 'ark' },
      { lmstudio: { baseUrl: 'ftp://x' } },
      { lmstudio: { model: 123 as unknown as string } },
      { runtime: { portRangeStart: 80 } },
      { runtime: { portRangeStart: 70000 } },
      { runtime: { portRangeStart: 1.5 } },
      { runtime: { healthTimeoutMs: 500 } },
      { runtime: { healthTimeoutMs: 70000 } },
      { runtime: { mockBaseUrl: 'ftp://x' } },
    ]
    for (const c of cases) {
      await expect(updateSettings(c)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    }
    expect(await readDisk()).toBe(before)
  })

  it('空 patch → INVALID_ARGUMENT', async () => {
    await expect(updateSettings({})).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(updateSettings({ ark: {} })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(updateSettings({ lmstudio: {} })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('maskKeyString：前6+••••+后4；不足 10 位显「已配置」', () => {
    expect(maskKeyString('sk-1234567890abcd')).toBe('sk-123••••abcd')
    expect(maskKeyString('short')).toBe('已配置')
  })

  it('重复 update 经 enqueue 串行且旧版归档', async () => {
    await updateSettings({ ark: { model: 'm1' } })
    await updateSettings({ ark: { model: 'm2' } })
    const archiveDir = path.join(holder.userData, '版本')
    const archived = await fsp.readdir(archiveDir)
    expect(archived.filter(f => f.startsWith('ai-service.')).length).toBeGreaterThanOrEqual(2)
    expect((await getSettingsView()).ark.model).toBe('m2')
  })

  it('缓存复位后重读盘（模拟重启）', async () => {
    __resetAiServiceCacheForTests()
    const v = await getSettingsView()
    expect(v.ark.model).toBe('m2')
    expect(v.ark.baseUrl).toBe('https://store2.example.com/v3')
    expect(v.activeProvider).toBe('lmstudio')
    expect(v.lmstudio).toMatchObject({ baseUrl: 'http://192.168.1.30:1234/v1', model: 'qwen-local' })
  })
})
