import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installDevMockApi } from '../../dev-mock-api.js'

const originalApi = window.api

beforeEach(async () => {
  Reflect.deleteProperty(window, 'api')
  installDevMockApi()
  for (const instance of await window.api.settings.comfy.list()) {
    await window.api.settings.comfy.remove(instance.id)
  }
})

afterEach(() => {
  window.api = originalApi
})

describe('ComfyUI dev mock', () => {
  it('提供确定性 CRUD、启停和连接测试，不发起网络请求', async () => {
    const created = await window.api.settings.comfy.upsert({
      id: 'dev-c1', name: '开发 GPU', baseUrl: 'http://192.168.1.20:8188/', enabled: true,
      gpus: ['GPU 0'], vramGB: 24,
    })
    expect(created.baseUrl).toBe('http://192.168.1.20:8188')
    await expect(window.api.settings.comfy.list()).resolves.toEqual([created])

    const disabled = await window.api.settings.comfy.upsert({ id: 'dev-c1', enabled: false })
    expect(disabled).toMatchObject({ enabled: false, gpus: ['GPU 0'], vramGB: 24 })
    await expect(window.api.settings.comfy.test({ baseUrl: 'http://127.0.0.1:65535' }))
      .rejects.toMatchObject({ code: 'COMFY_UNREACHABLE' })
    await expect(window.api.settings.comfy.test({ baseUrl: created.baseUrl }))
      .resolves.toMatchObject({ ok: true, deviceCount: 1 })
    await window.api.settings.comfy.remove('dev-c1')
    await expect(window.api.settings.comfy.list()).resolves.toEqual([])
  })
})
