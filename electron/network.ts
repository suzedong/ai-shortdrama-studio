// feature-006 · 主进程网络出口：公网遵循操作系统代理，本地/局域网强制直连。
// Electron 仅在真实公网请求/代理解析时动态加载，纯策略与注入式测试可在 Node 环境运行。
import { isIP } from 'node:net'

export interface RuntimeProxyEnv {
  HTTP_PROXY?: string
  HTTPS_PROXY?: string
  NO_PROXY: string
}

export interface NetworkDeps {
  netFetch?: typeof fetch
  directFetch?: typeof fetch
  resolveProxy?: (url: string) => Promise<string>
  notify?: (message: string) => void | Promise<void>
}

const NO_PROXY_BASE = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '.local',
]

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
}

/** loopback、私网/链路本地、.local 与单标签主机名始终绕过系统代理。 */
export function shouldDirectFetch(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
    if (!host.includes('.') && !host.includes(':')) return true
    const ipVersion = isIP(host)
    if (ipVersion === 4) return isPrivateIpv4(host)
    if (ipVersion === 6) {
      return host === '::1' || host.startsWith('fe8') || host.startsWith('fe9')
        || host.startsWith('fea') || host.startsWith('feb')
        || host.startsWith('fc') || host.startsWith('fd')
    }
    return false
  } catch {
    return false
  }
}

/** 将 Chromium resolveProxy 的首个可用代理转成标准代理 URL；DIRECT/空值返回 null。 */
export function proxyUrlFromResolve(raw: string): string | null {
  for (const entry of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const match = /^(PROXY|HTTPS|SOCKS4|SOCKS5|SOCKS)\s+(.+)$/i.exec(entry)
    if (!match) continue
    const scheme = match[1].toUpperCase() === 'PROXY'
      ? 'http'
      : match[1].toUpperCase() === 'HTTPS'
        ? 'https'
        : match[1].toUpperCase() === 'SOCKS4'
          ? 'socks4'
          : 'socks5'
    return `${scheme}://${match[2]}`
  }
  return null
}

export function buildNoProxy(...urls: Array<string | undefined>): string {
  const hosts = new Set(NO_PROXY_BASE)
  for (const value of urls) {
    if (!value) continue
    try {
      const host = new URL(value).hostname.replace(/^\[|\]$/g, '')
      if (shouldDirectFetch(value)) hosts.add(host)
    } catch {
      // 无效配置由原有配置校验/请求路径报告，不在代理环境构造时扩写错误。
    }
  }
  return [...hosts].join(',')
}

/** 启动 opencode 前固化当前 provider 的系统代理判定；本地 provider 不查系统代理。 */
export async function resolveRuntimeProxyEnv(
  providerUrl: string,
  resolveProxy?: (url: string) => Promise<string>,
): Promise<RuntimeProxyEnv> {
  const noProxy = buildNoProxy(providerUrl)
  if (shouldDirectFetch(providerUrl)) return { NO_PROXY: noProxy }
  let resolver = resolveProxy
  if (!resolver) {
    const { session } = await import('electron')
    resolver = (url: string) => session.defaultSession.resolveProxy(url)
  }
  const proxy = proxyUrlFromResolve(await resolver(providerUrl))
  return proxy
    ? { HTTP_PROXY: proxy, HTTPS_PROXY: proxy, NO_PROXY: noProxy }
    : { NO_PROXY: noProxy }
}

function isKnownOverseasService(url: URL): boolean {
  return /(^|\.)(duckduckgo|google|googleapis|gstatic|youtube|openai|github|githubusercontent|twitter|facebook|instagram|huggingface)\.[a-z.]+$/i.test(url.hostname)
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
    .replace(/(api[_-]?key|token|password|authorization)\s*[=:]\s*\S+/gi, '$1=***')
}

/** 只报告实际错误与代理解析状态，不对任意 URL 推断物理国家。 */
export function networkFailureMessage(urlValue: string, error: unknown, proxyResolve: string): string {
  let origin = urlValue
  let overseas = false
  try {
    const url = new URL(urlValue)
    origin = url.origin
    overseas = isKnownOverseasService(url)
  } catch {
    // 保留调用方原始地址；请求层会继续抛出原错误。
  }
  const proxy = proxyUrlFromResolve(proxyResolve)
  const lines = [
    `无法连接 ${origin}`,
    `网络错误：${safeErrorMessage(error)}`,
    `系统代理：${proxy ? `已启用（${proxy}）` : '未启用（DIRECT）'}`,
  ]
  if (proxy) {
    lines.push('系统代理已启用但仍连接失败，请检查代理节点、端口及操作系统绕过规则后重试。')
  } else if (overseas) {
    lines.push('该境外服务通常需要代理，请在操作系统中启用并配置可用代理后重试。')
  } else {
    lines.push('请检查网络连接；如该服务需要代理，请在操作系统中启用代理后重试。')
  }
  return lines.join('\n')
}

/**
 * 公网使用 Electron net.fetch（系统代理/PAC/绕过规则）；私网使用 Node fetch 直连。
 * 仅连接异常触发原生提示，HTTP 非 2xx 仍由调用方按既有错误信封处理。
 */
export async function publicFetch(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
  deps: NetworkDeps = {},
): Promise<Response> {
  const url = requestUrl(input)
  if (shouldDirectFetch(url)) return (deps.directFetch ?? fetch)(input, init)

  const netFetch = deps.netFetch ?? ((await import('electron')).net.fetch as typeof fetch)
  try {
    return await netFetch(input, init)
  } catch (error) {
    let proxyResolve = 'DIRECT'
    try {
      if (deps.resolveProxy) {
        proxyResolve = await deps.resolveProxy(url)
      } else {
        const { session } = await import('electron')
        proxyResolve = await session.defaultSession.resolveProxy(url)
      }
    } catch {
      // 代理解析失败时保守按 DIRECT 提示，原网络错误不变。
    }
    const notify = deps.notify ?? (async (message: string) => {
      const { dialog } = await import('electron')
      void dialog.showMessageBox({
        type: 'error',
        title: '网络连接失败',
        message: '公网服务连接失败',
        detail: message,
        buttons: ['知道了'],
      })
    })
    try {
      await notify(networkFailureMessage(url, error, proxyResolve))
    } catch {
      // 通知失败不遮蔽原网络错误。
    }
    throw error
  }
}
