// feature-803 · ComfyUI 本机/局域网地址校验与规范化
import { isIP } from 'node:net'

function invalid(message: string): never {
  throw Object.assign(new Error(message), { code: 'INVALID_ARGUMENT' })
}

function privateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  return a === 127 || a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
}

function localIpv6(host: string): boolean {
  const normalized = host.toLowerCase()
  if (normalized === '::1') return true
  if (/^f[cd]/.test(normalized)) return true
  return /^fe[89ab]/.test(normalized)
}

function localHostname(host: string): boolean {
  const hostname = host.replace(/\.$/, '').toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true
  // 单标签主机名用于常见局域网 NetBIOS/DNS；带点公网域名一律拒绝。
  return !hostname.includes('.') && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname)
}

export function isLocalComfyHostname(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/g, '')
  const family = isIP(host)
  if (family === 4) return privateIpv4(host)
  if (family === 6) return localIpv6(host)
  return localHostname(host)
}

/** 仅允许无凭据的本机/私网 HTTP(S) 地址，返回不带结尾斜杠的 base URL。 */
export function normalizeComfyBaseUrl(input: string): string {
  if (typeof input !== 'string' || input.trim() === '') invalid('ComfyUI 地址不能为空')
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    invalid('ComfyUI 地址格式无效')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') invalid('ComfyUI 地址仅支持 HTTP(S)')
  if (url.username || url.password) invalid('ComfyUI 地址不得包含用户名或密码')
  if (url.search || url.hash) invalid('ComfyUI 地址不得包含 query 或 hash')
  if (!isLocalComfyHostname(url.hostname)) invalid('ComfyUI 地址仅允许本机或局域网目标')
  const pathname = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${pathname === '/' ? '' : pathname}`
}
