// feature-014 · ark 动态化单测（契约 §6.5 / T3）：
// store 更新后下一次 chat() 即用新配置（无需重启）；isConfigured/maskKey 同步；
// env 回退可用；清除 Key 后回到未配置态。
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
    decryptString: (b: Buffer) => {
      const s = b.toString('utf-8')
      if (!s.startsWith('enc:')) throw new Error('decrypt failed')
      return s.slice(4)
    },
  },
}))

import { chat, isConfigured, maskKey } from '../../electron/ark'
import { updateSettings, maskKeyString, __resetAiServiceCacheForTests } from '../../electron/settings/ai-service'

const KEY_A = 'sk-aaaa1234567890'
const KEY_B = 'sk-bbbb0987654321'
const savedEnv = { ...process.env }

function okFetch(content = 'ok') {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
}

function lastCall(fetchMock: ReturnType<typeof okFetch>): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  return { url, init }
}

beforeEach(async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-ark-'))
  holder.userData = tmp
  __resetAiServiceCacheForTests()
  delete process.env.ARK_API_KEY
  delete process.env.ARK_BASE_URL
  delete process.env.ARK_MODEL
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.ARK_API_KEY
  delete process.env.ARK_BASE_URL
  delete process.env.ARK_MODEL
})

afterAll(() => {
  process.env = { ...savedEnv }
})

describe('ark 动态化（feature-014）', () => {
  it('未配置：chat 抛指引文案；isConfigured=false；maskKey=(未配置)', async () => {
    await expect(chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      '未配置火山方舟接口，请在「AI 服务设置」中配置 API Key 与模型名（或设置 ARK_API_KEY/ARK_MODEL 环境变量）',
    )
    expect(isConfigured()).toBe(false)
    expect(maskKey()).toBe('(未配置)')
  })

  it('update 后 chat 用新配置：URL / Authorization / body.model 全部来自 store', async () => {
    await updateSettings({
      ark: { apiKey: KEY_A, baseUrl: 'https://store.example.com/v3', model: 'store-model-a' },
    })
    const fetchMock = okFetch('你好')
    vi.stubGlobal('fetch', fetchMock)

    const out = await chat([{ role: 'user', content: 'hi' }], 0.3)

    expect(out).toBe('你好')
    expect(fetchMock).toHaveBeenCalledOnce()
    const { url, init } = lastCall(fetchMock)
    expect(url).toBe('https://store.example.com/v3/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY_A}`)
    const body = JSON.parse(String(init.body)) as {
      model: string
      temperature: number
      messages: Array<{ role: string; content: string }>
    }
    expect(body.model).toBe('store-model-a')
    expect(body.temperature).toBe(0.3)
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('再次 update：下一条消息即生效（模型与 Key 切换无需重启）；isConfigured/maskKey 同步', async () => {
    await updateSettings({ ark: { apiKey: KEY_A, model: 'model-a' } })
    const fetchMock = okFetch()
    vi.stubGlobal('fetch', fetchMock)
    await chat([{ role: 'user', content: 'one' }])
    expect(
      (JSON.parse(String(lastCall(fetchMock).init.body)) as { model: string }).model,
    ).toBe('model-a')
    expect(isConfigured()).toBe(true)
    expect(maskKey()).toBe(maskKeyString(KEY_A))

    await updateSettings({ ark: { apiKey: KEY_B, model: 'model-b' } })
    await chat([{ role: 'user', content: 'two' }])
    const second = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect((JSON.parse(String(second[1].body)) as { model: string }).model).toBe('model-b')
    expect((second[1].headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY_B}`)
    expect(maskKey()).toBe(maskKeyString(KEY_B))
  })

  it('env 回退：store 缺席时 chat 取 ARK_* 环境变量', async () => {
    process.env.ARK_API_KEY = KEY_A
    process.env.ARK_BASE_URL = 'https://env.example.com/v1'
    process.env.ARK_MODEL = 'env-model'
    const fetchMock = okFetch('env-ok')
    vi.stubGlobal('fetch', fetchMock)

    const out = await chat([{ role: 'user', content: 'hi' }])
    expect(out).toBe('env-ok')
    const { url, init } = lastCall(fetchMock)
    expect(url).toBe('https://env.example.com/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY_A}`)
    expect((JSON.parse(String(init.body)) as { model: string }).model).toBe('env-model')
  })

  it('清除 Key（空串）后回到未配置态：chat 抛错、isConfigured=false', async () => {
    await updateSettings({ ark: { apiKey: KEY_A, model: 'model-a' } })
    expect(isConfigured()).toBe(true)

    await updateSettings({ ark: { apiKey: '' } })
    expect(isConfigured()).toBe(false)
    expect(maskKey()).toBe('(未配置)')
    await expect(chat([{ role: 'user', content: 'hi' }])).rejects.toThrow('未配置火山方舟接口')
  })
})
