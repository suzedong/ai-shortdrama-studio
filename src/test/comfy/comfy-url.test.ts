import { describe, expect, it } from 'vitest'
import { isLocalComfyHostname, normalizeComfyBaseUrl } from '../../../electron/comfy/url.js'

describe('ComfyUI URL 白名单', () => {
  it.each([
    '127.0.0.1', '10.0.0.8', '172.16.2.3', '192.168.1.20', '169.254.1.2',
    'localhost', 'gpu-box', 'worker.local', 'comfy.localhost', '::1', 'fd00::1', 'fe80::1',
  ])('允许本机或私网主机 %s', host => {
    expect(isLocalComfyHostname(host)).toBe(true)
  })

  it.each(['8.8.8.8', '172.32.0.1', 'example.com', 'sub.example.localhost.evil.com', '2001:4860::1'])(
    '拒绝公网主机 %s',
    host => expect(isLocalComfyHostname(host)).toBe(false),
  )

  it('规范化 base URL 并保留子路径', () => {
    expect(normalizeComfyBaseUrl(' http://192.168.1.20:8188/comfy/ ')).toBe('http://192.168.1.20:8188/comfy')
    expect(normalizeComfyBaseUrl('http://[fd00::1]:8188/')).toBe('http://[fd00::1]:8188')
  })

  it.each([
    'https://example.com', 'ftp://127.0.0.1', 'http://user:pass@127.0.0.1',
    'http://127.0.0.1/?x=1', 'http://127.0.0.1/#fragment', '',
  ])('拒绝不安全或含糊地址 %s', input => {
    expect(() => normalizeComfyBaseUrl(input)).toThrowError(expect.objectContaining({ code: 'INVALID_ARGUMENT' }))
  })
})
