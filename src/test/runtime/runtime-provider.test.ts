import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

// electron 在 vitest 下导出的是可执行路径字符串，app 为 undefined；显式 mock 并令
// isPackaged 可控，以复现「Electron 开发态 + process.resourcesPath 存在」的真机场景（I-003）。
const electronMock = vi.hoisted(() => ({ isPackaged: false }))
vi.mock('electron', () => ({
  app: { get isPackaged() { return electronMock.isPackaged } },
}))

import {
  ARK_BASE_URL_DEFAULT,
  MOCK_BASE_URL_DEFAULT,
  MOCK_API_KEY,
  ENABLED_PROVIDERS,
  AGENT_PROFILES,
  SHOWRUNNER_AGENT,
  generateRuntimeConfig,
  installAgentProfiles,
  setupRuntimeFiles,
  resolveAgentTemplatePath,
  runtimeConfigDir,
} from '../../../electron/runtime/provider'

let tmpRoot: string
let userDataDir: string

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-runtime-provider-'))
})

beforeEach(async () => {
  userDataDir = await fsp.mkdtemp(path.join(tmpRoot, 'userdata-'))
  electronMock.isPackaged = false
})

const ARK_MODEL = 'ep-2026-test-model'
// 哨兵密钥：任何生成态文件中都不允许出现它的值（契约 §8/§9 安全断言）
const ARK_KEY_SENTINEL = 'ark-secret-sentinel-value-8899'
const SERVER_PASSWORD_SENTINEL = 'server-pass-sentinel-7788'

async function readGeneratedConfig(userData: string) {
  const p = path.join(runtimeConfigDir(userData), 'opencode.json')
  return JSON.parse(await fsp.readFile(p, 'utf-8')) as Record<string, any>
}

describe('generateRuntimeConfig · opencode.json 结构契约', () => {
  it('enabled_providers 白名单仅 ark+mock；provider 仅 ark+mock；ark 走 openai-compatible + env 声明', async () => {
    const r = await generateRuntimeConfig({ userDataDir, arkModel: ARK_MODEL })
    const cfg = await readGeneratedConfig(userDataDir)

    expect(r.arkActive).toBe(true)
    expect(cfg.$schema).toBe('https://opencode.ai/config.json')
    expect(cfg.enabled_providers).toEqual([...ENABLED_PROVIDERS])
    expect(cfg.enabled_providers).toEqual(['ark', 'mock'])
    expect(Object.keys(cfg.provider).sort()).toEqual(['ark', 'mock'])

    const ark = cfg.provider.ark
    expect(ark.npm).toBe('@ai-sdk/openai-compatible')
    expect(ark.env).toEqual(['ARK_API_KEY'])
    expect(ark.options.baseURL).toBe(ARK_BASE_URL_DEFAULT)
    expect(ark.models[ARK_MODEL]).toBeTruthy()
    expect(Object.keys(ark.models)).toEqual([ARK_MODEL])

    const mock = cfg.provider.mock
    expect(mock.npm).toBe('@ai-sdk/openai-compatible')
    expect(mock.options.baseURL).toBe(MOCK_BASE_URL_DEFAULT)
    expect(mock.models['mock-1']).toBeTruthy()
    expect(mock.name).toMatch(/test/i)
  })

  it('mcp.shortdrama：remote + 仅 {env:…} 占位符 + timeout 180000（D-012）；无真实值落盘', async () => {
    await generateRuntimeConfig({ userDataDir, arkModel: ARK_MODEL })
    const cfg = await readGeneratedConfig(userDataDir)
    const mcp = cfg.mcp.shortdrama
    expect(mcp.type).toBe('remote')
    expect(mcp.url).toBe('{env:OPENCODE_MCP_URL}')
    expect(mcp.headers.Authorization).toBe('Bearer {env:OPENCODE_MCP_TOKEN}')
    expect(mcp.timeout).toBe(180_000)

    const raw = await fsp.readFile(path.join(runtimeConfigDir(userDataDir), 'opencode.json'), 'utf-8')
    expect(raw).not.toMatch(/http:\/\/127\.0\.0\.1:41\d\d\/mcp/)
    expect(raw).not.toContain('mcp-token')
  })

  it('安全：json 中不出现 ARK_API_KEY 的值与 server 口令，只允许出现环境变量名声明', async () => {
    await generateRuntimeConfig({ userDataDir, arkModel: ARK_MODEL })
    const raw = await fsp.readFile(path.join(runtimeConfigDir(userDataDir), 'opencode.json'), 'utf-8')
    expect(raw).not.toContain(ARK_KEY_SENTINEL)
    expect(raw).not.toContain(SERVER_PASSWORD_SENTINEL)
    // env 声明的是变量名而非值
    expect(raw).toContain('ARK_API_KEY')
    // mock 占位值是固定常量，不得是任何真实环境值
    expect(raw).toContain(MOCK_API_KEY)
  })

  it('ARK_MODEL 缺失：ark models 为空（不激活），arkActive=false，但配置仍正常生成', async () => {
    const r = await generateRuntimeConfig({ userDataDir })
    const cfg = await readGeneratedConfig(userDataDir)
    expect(r.arkActive).toBe(false)
    expect(cfg.provider.ark.models).toEqual({})
    expect(cfg.provider.mock.models['mock-1']).toBeTruthy()
  })

  it('支持 baseURL 覆盖（测试桩 / 私有化端点）', async () => {
    await generateRuntimeConfig({
      userDataDir,
      arkModel: ARK_MODEL,
      arkBaseUrl: 'https://ark.example.internal/api/v3',
      mockBaseUrl: 'http://127.0.0.1:5099/v1',
    })
    const cfg = await readGeneratedConfig(userDataDir)
    expect(cfg.provider.ark.options.baseURL).toBe('https://ark.example.internal/api/v3')
    expect(cfg.provider.mock.options.baseURL).toBe('http://127.0.0.1:5099/v1')
  })

  it('每次启动重生成：旧文件里的用户态内容不被合并保留', async () => {
    await generateRuntimeConfig({ userDataDir, arkModel: ARK_MODEL })
    const cfgPath = path.join(runtimeConfigDir(userDataDir), 'opencode.json')
    const tampered = JSON.parse(await fsp.readFile(cfgPath, 'utf-8'))
    tampered.provider.rogue = { name: 'rogue provider' }
    await fsp.writeFile(cfgPath, JSON.stringify(tampered), 'utf-8')

    await generateRuntimeConfig({ userDataDir, arkModel: ARK_MODEL })
    const cfg = await readGeneratedConfig(userDataDir)
    expect(cfg.provider.rogue).toBeUndefined()
    expect(Object.keys(cfg.provider).sort()).toEqual(['ark', 'mock'])
  })
})

describe('installAgentProfiles · 摄制组 profiles 安装（director 已退役）', () => {
  it('AGENT_PROFILES 为 4 项：showrunner + writer/media-director/comfyui-operator，不含 director', () => {
    expect(AGENT_PROFILES.map((p) => p.name)).toEqual([
      SHOWRUNNER_AGENT,
      'writer',
      'media-director',
      'comfyui-operator',
    ])
    expect(AGENT_PROFILES.some((p) => p.name === 'director')).toBe(false)
  })

  it('ARK_MODEL 注入全部 frontmatter：model 为 ark/<modelID>，模板占位符不入库', async () => {
    const installed = await installAgentProfiles({ userDataDir, arkModel: ARK_MODEL })
    expect(installed).toHaveLength(4)
    for (const { path: target } of installed) {
      const md = await fsp.readFile(target, 'utf-8')
      expect(md).toContain(`model: ark/${ARK_MODEL}`)
      expect(md).not.toContain('__ARK_MODEL_ID__')
      expect(md).not.toContain(ARK_KEY_SENTINEL)
    }
    // director.md 必须不存在
    await expect(
      fsp.access(path.join(runtimeConfigDir(userDataDir), 'agents', 'director.md')),
    ).rejects.toThrow()
  })

  it('ARK_MODEL 缺失 / 空白：抛 UPSTREAM_AUTH_MISSING，不静默回退 mock', async () => {
    await expect(installAgentProfiles({ userDataDir, arkModel: '' })).rejects.toMatchObject({
      name: 'UPSTREAM_AUTH_MISSING',
    })
    await expect(installAgentProfiles({ userDataDir, arkModel: '   ' })).rejects.toMatchObject({
      name: 'UPSTREAM_AUTH_MISSING',
    })
  })

  it('仓库模板可被默认解析器定位（开发态 resources/ 布局）', async () => {
    const tpl = await resolveAgentTemplatePath('showrunner.md')
    await expect(fsp.access(tpl)).resolves.toBeUndefined()
    const raw = await fsp.readFile(tpl, 'utf-8')
    expect(raw).toContain('__ARK_MODEL_ID__')
  })

  it('Electron 开发态：即使 process.resourcesPath 存在，仍定位仓库 resources/ 而非 app 包内（I-003 回归）', async () => {
    // 真机事实：Electron 开发态 resourcesPath 指向 Electron.app/Contents/Resources
    Object.defineProperty(process, 'resourcesPath', {
      value: path.join(os.tmpdir(), 'Electron.app', 'Contents', 'Resources'),
      configurable: true,
    })
    electronMock.isPackaged = false

    const tpl = await resolveAgentTemplatePath('showrunner.md')
    await expect(fsp.access(tpl)).resolves.toBeUndefined()
    expect(tpl).toBe(
      path.join(process.cwd(), 'resources', 'opencode', 'agents', 'showrunner.md'),
    )
    expect(tpl).not.toContain('Electron.app')
  })

  it('打包态：取 process.resourcesPath/opencode/agents/<file>', async () => {
    const fakeResources = await fsp.mkdtemp(path.join(tmpRoot, 'packed-resources-'))
    Object.defineProperty(process, 'resourcesPath', {
      value: fakeResources,
      configurable: true,
    })
    electronMock.isPackaged = true

    const expected = path.join(fakeResources, 'opencode', 'agents', 'showrunner.md')
    await expect(resolveAgentTemplatePath('showrunner.md')).resolves.toBe(expected)
  })
})

describe('setupRuntimeFiles · 启动编排', () => {
  it('ARK_MODEL 齐全：配置与全部 4 个 profile 均就位，profileError=null', async () => {
    const r = await setupRuntimeFiles({ userDataDir, arkModel: ARK_MODEL })
    expect(r.config.arkActive).toBe(true)
    expect(r.profiles).toHaveLength(4)
    expect(r.profileError).toBeNull()
    const showrunner = r.profiles.find((p) => p.name === SHOWRUNNER_AGENT)
    expect(showrunner).toBeDefined()
    const md = await fsp.readFile(showrunner!.path, 'utf-8')
    expect(md).toContain(`model: ark/${ARK_MODEL}`)
  })

  it('ARK_MODEL 缺失：运行时配置照常生成，profile 不安装并带结构化 UPSTREAM_AUTH_MISSING', async () => {
    const r = await setupRuntimeFiles({ userDataDir })
    expect(r.config.arkActive).toBe(false)
    expect(r.profiles).toEqual([])
    expect(r.profileError?.code).toBe('UPSTREAM_AUTH_MISSING')
    // 配置文件确实存在（mock 仍可启动）
    await expect(fsp.access(r.config.configPath)).resolves.toBeUndefined()
    // agents 目录存在但为空
    const agents = await fsp.readdir(path.join(r.config.configDir, 'agents'))
    expect(agents).toEqual([])
  })
})
