import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 每个用例重装模块，隔离 demoBriefLib 等模块级演示状态。
beforeEach(async () => {
  vi.resetModules()
  Reflect.deleteProperty(window, 'api')
  const { installDevMockApi } = await import('../dev-mock-api')
  installDevMockApi()
})

afterEach(() => {
  Reflect.deleteProperty(window, 'api')
})

describe('浏览器 dev-mock 直接契约', () => {
  it('辅助风格空串清除当前键，历史版本保持原值', async () => {
    await window.api.updateBrief({ style: { auxiliaryStyleId: 'D1' } })
    const withAux = await window.api.briefVersionRead(4)
    expect(withAux.brief.style.auxiliaryStyleId).toBe('D1')

    const result = await window.api.updateBrief({ style: { auxiliaryStyleId: '' } })
    expect(result.version).toBe(5)
    const cleared = await window.api.briefVersionRead(5)
    expect(cleared.brief.style.mainStyleId).toBe('A7')
    expect('auxiliaryStyleId' in cleared.brief.style).toBe(false)
    expect((await window.api.briefVersionRead(4)).brief.style.auxiliaryStyleId).toBe('D1')
  })

  it('连续再版新增 v4/v5，动态返回路径且不原地污染历史', async () => {
    const v3Before = (await window.api.briefVersionRead(3)).brief
    const v4 = await window.api.updateBrief({ fiveElements: { episodeCount: '第一季 9 集' } })
    const v5 = await window.api.updateBrief({ fiveElements: { episodeCount: '第一季 10 集' } })

    expect(v4).toMatchObject({
      version: 4,
      jsonPath: '立项单.v4.json',
      mdPath: '立项单.v4.md',
      impactReportPath: '影响清单.v3-v4.json',
    })
    expect(v5).toMatchObject({
      version: 5,
      jsonPath: '立项单.v5.json',
      mdPath: '立项单.v5.md',
      impactReportPath: '影响清单.v4-v5.json',
    })
    const history = await window.api.briefHistory()
    expect(history.latestVersion).toBe(5)
    expect(history.versions.map(v => v.path)).toEqual([
      '立项单.v1.json', '立项单.v2.json', '立项单.v3.json', '立项单.v4.json', '立项单.v5.json',
    ])
    expect((await window.api.briefVersionRead(3)).brief).toEqual(v3Before)
    expect((await window.api.briefVersionRead(4)).brief.fiveElements.episodeCount).toBe('第一季 9 集')
    expect((await window.api.briefVersionRead(5)).brief.fiveElements.episodeCount).toBe('第一季 10 集')

    const dynamicFile = await window.api.fileRead({ path: '/demo/anni/立项单.v5.json' })
    expect(dynamicFile).toMatchObject({ ok: true, format: 'json' })
    if (dynamicFile.ok) expect(JSON.parse(dynamicFile.content).version).toBe(5)
  })

  it('空 patch 拒绝再版，版本数量与路径保持不变', async () => {
    const before = await window.api.briefHistory()

    await expect(window.api.updateBrief({})).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    expect(await window.api.briefHistory()).toEqual(before)
  })

  it('同值 patch 拒绝再版，不生成新版本或影响清单路径', async () => {
    const before = await window.api.briefHistory()

    await expect(window.api.updateBrief({
      fiveElements: { episodeCount: '第一季 8 集（先做 E01）' },
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    expect(await window.api.briefHistory()).toEqual(before)
  })

  it('谱系采纳读取最新版并刷新为无升级', async () => {
    expect(await window.api.styleUpgradeDiff()).toMatchObject({
      hasUpgrade: true,
      registeredVersion: 'v1.46',
      currentVersion: 'v1.47',
    })

    const result = await window.api.updateBrief({ style: { catalogVersion: 'v1.47' } })
    expect(result.version).toBe(4)
    expect((await window.api.briefVersionRead(4)).brief.style.catalogVersion).toBe('v1.47')
    expect(await window.api.styleUpgradeDiff()).toMatchObject({
      hasUpgrade: false,
      currentVersion: 'v1.47',
      changelog: [],
    })
  })

  it('ComfyUI upsert 返回完整 baseUrl/addedAt 形状', async () => {
    const instance = await window.api.settings.comfy.upsert({
      id: 'mock', name: 'mock', baseUrl: 'http://localhost:8188', enabled: true,
    })
    expect(instance).toMatchObject({
      id: 'mock',
      name: 'mock',
      baseUrl: 'http://localhost:8188',
      enabled: true,
      addedAt: expect.any(String),
    })
    expect(Number.isNaN(Date.parse(instance.addedAt))).toBe(false)
  })

  // feature-813 · 工作目录更换三键（契约 §4：浏览器无真实文件系统与原生选择器）
  it('workspace.get 返回默认演示视图', async () => {
    await expect(window.api.settings.workspace.get()).resolves.toEqual({
      root: '/demo/workspace',
      defaultRoot: '/demo/workspace',
      source: 'default',
    })
  })

  it('workspace.pick 恒返回 dir=null（浏览器无原生选择器，视为取消）', async () => {
    await expect(window.api.settings.workspace.pick()).resolves.toEqual({ dir: null })
  })

  it('workspace.change 拒绝且错误信封含 INVALID_ARGUMENT 中文 message', async () => {
    await expect(window.api.settings.workspace.change('/demo/other'))
      .rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
        message: '浏览器开发环境不支持更换工作目录',
      })
  })
})
