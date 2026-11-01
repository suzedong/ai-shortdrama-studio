import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  buildNoProxy,
  networkFailureMessage,
  proxyUrlFromResolve,
  publicFetch,
  resolveRuntimeProxyEnv,
  shouldDirectFetch,
} from '../../electron/network'

const electronMock = vi.hoisted(() => {
  // 模拟 Electron 原生 Session.resolveProxy 的 this 绑定要求：脱离 Session 调用即非法
  const session: { resolveProxy: Mock<(this: unknown) => Promise<string>>; _result?: string } = {
    resolveProxy: vi.fn(async function (this: unknown) {
      if (this !== session) throw new TypeError('Illegal invocation: Function must be called on an object of type Session')
      return session._result ?? 'DIRECT'
    }),
  }
  return {
    netFetch: vi.fn(),
    session,
    showMessageBox: vi.fn(),
  }
})

vi.mock('electron', () => ({
  net: { fetch: electronMock.netFetch },
  session: { defaultSession: electronMock.session },
  dialog: { showMessageBox: electronMock.showMessageBox },
}))

beforeEach(() => {
  electronMock.netFetch.mockReset()
  // 用 clear 而非 reset：保留带 this 绑定校验的实现
  electronMock.session.resolveProxy.mockClear()
  electronMock.session._result = undefined
  electronMock.showMessageBox.mockReset()
})

describe('公网/私网通道判定', () => {
  it.each([
    'http://127.0.0.1:4096/global/health',
    'http://localhost:1234/v1',
    'http://192.168.21.100:8188',
    'http://10.0.0.8:8188',
    'http://172.16.2.3:8188',
    'http://169.254.1.2:8188',
    'http://comfyui:8188',
    'http://printer.local:8188',
    'http://[::1]:1234/v1',
  ])('%s 强制直连', (url) => {
    expect(shouldDirectFetch(url)).toBe(true)
  })

  it.each(['https://cn.bing.com/search', 'https://8.8.8.8', 'https://ark.cn-beijing.volces.com/api/v3'])(
    '%s 使用系统代理通道',
    (url) => expect(shouldDirectFetch(url)).toBe(false),
  )

  it('公网走 net.fetch，私网走原生 fetch，成功请求不额外解析代理', async () => {
    const netFetch = vi.fn(async () => new Response('public')) as unknown as typeof fetch
    const directFetch = vi.fn(async () => new Response('private')) as unknown as typeof fetch
    const resolveProxy = vi.fn(async () => 'DIRECT')
    await expect(publicFetch('https://cn.bing.com/search', undefined, { netFetch, directFetch, resolveProxy }))
      .resolves.toBeInstanceOf(Response)
    await expect(publicFetch('http://192.168.1.10:8188', undefined, { netFetch, directFetch, resolveProxy }))
      .resolves.toBeInstanceOf(Response)
    expect(netFetch).toHaveBeenCalledOnce()
    expect(directFetch).toHaveBeenCalledOnce()
    expect(resolveProxy).not.toHaveBeenCalled()
  })

  it('生产默认公网路径使用动态 Electron net.fetch', async () => {
    electronMock.netFetch.mockResolvedValue(new Response('ok'))
    await expect(publicFetch('https://cn.bing.com/search')).resolves.toBeInstanceOf(Response)
    expect(electronMock.netFetch).toHaveBeenCalledOnce()
  })
})

describe('opencode 代理环境', () => {
  it('DIRECT/PROXY/SOCKS 解析为标准代理 URL', () => {
    expect(proxyUrlFromResolve('DIRECT')).toBeNull()
    expect(proxyUrlFromResolve('PROXY 192.168.21.100:7890')).toBe('http://192.168.21.100:7890')
    expect(proxyUrlFromResolve('SOCKS5 127.0.0.1:1080; DIRECT')).toBe('socks5://127.0.0.1:1080')
  })

  it('公网 provider 注入代理与 NO_PROXY，本地 provider 不查系统代理', async () => {
    const resolver = vi.fn(async () => 'PROXY 192.168.21.100:7890; DIRECT')
    const proxied = await resolveRuntimeProxyEnv('https://ark.cn-beijing.volces.com/api/v3', resolver)
    expect(proxied.HTTP_PROXY).toBe('http://192.168.21.100:7890')
    expect(proxied.HTTPS_PROXY).toBe(proxied.HTTP_PROXY)
    expect(proxied.NO_PROXY).toContain('192.168.0.0/16')

    resolver.mockClear()
    const direct = await resolveRuntimeProxyEnv('http://192.168.21.50:1234/v1', resolver)
    expect(direct.HTTP_PROXY).toBeUndefined()
    expect(direct.NO_PROXY).toContain('192.168.21.50')
    expect(resolver).not.toHaveBeenCalled()
    expect(buildNoProxy('http://localhost:1234')).toContain('127.0.0.1')
  })

  it('公网 provider 不注入 resolver 时，默认经 defaultSession.resolveProxy 解析（不脱 this）', async () => {
    electronMock.session._result = 'PROXY 192.168.21.100:7890; DIRECT'
    const env = await resolveRuntimeProxyEnv('https://ark.cn-beijing.volces.com/api/v3')
    expect(electronMock.session.resolveProxy).toHaveBeenCalledOnce()
    expect(electronMock.session.resolveProxy).toHaveBeenCalledWith('https://ark.cn-beijing.volces.com/api/v3')
    expect(env.HTTP_PROXY).toBe('http://192.168.21.100:7890')
    expect(env.NO_PROXY).toContain('192.168.0.0/16')
  })
})

describe('公网失败提示', () => {
  it('已知境外服务 DIRECT 失败：原生提示启用代理并保留原错误', async () => {
    const failure = new Error('connect timeout')
    const netFetch = vi.fn(async () => { throw failure }) as unknown as typeof fetch
    const notify = vi.fn()
    await expect(publicFetch('https://html.duckduckgo.com/html/', undefined, {
      netFetch,
      resolveProxy: async () => 'DIRECT',
      notify,
    })).rejects.toBe(failure)
    const message = notify.mock.calls[0]![0] as string
    expect(message).toContain('未启用（DIRECT）')
    expect(message).toContain('境外服务通常需要代理')
    expect(message).toContain('connect timeout')
  })

  it('未知地址代理仍失败：提示检查节点与绕过规则，不断言国家', async () => {
    const notify = vi.fn()
    await expect(publicFetch('https://example.net/data', undefined, {
      netFetch: vi.fn(async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch,
      resolveProxy: async () => 'PROXY 192.168.21.100:7890',
      notify,
    })).rejects.toThrow('ECONNRESET')
    const message = notify.mock.calls[0]![0] as string
    expect(message).toContain('系统代理已启用')
    expect(message).toContain('代理节点')
    expect(message).not.toContain('物理国家')
  })

  it('失败文案脱敏且动态 Electron dialog 被调用', async () => {
    const message = networkFailureMessage(
      'https://example.com',
      new Error('Bearer secret-token api_key=secret-value'),
      'DIRECT',
    )
    expect(message).not.toContain('secret-token')
    expect(message).not.toContain('secret-value')

    electronMock.netFetch.mockRejectedValue(new Error('offline'))
    electronMock.session._result = 'DIRECT'
    await expect(publicFetch('https://example.com')).rejects.toThrow('offline')
    expect(electronMock.showMessageBox).toHaveBeenCalledOnce()
  })
})
