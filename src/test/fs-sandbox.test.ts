import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { resolveInside } from '../../electron/fs/sandbox'

const ROOT = path.join('/tmp', 'project-root')

describe('T1 resolveInside 路径沙箱', () => {
  it('正常相对路径解析到 root 内', () => {
    expect(resolveInside(ROOT, '剧本/a.json')).toBe(path.join(ROOT, '剧本', 'a.json'))
    expect(resolveInside(ROOT, 'a.md')).toBe(path.join(ROOT, 'a.md'))
  })

  it('空 / 非字符串入参 → INVALID_ARGUMENT', () => {
    expect(() => resolveInside(ROOT, '   ')).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    )
  })

  it("'..' 越界 → PATH_ESCAPE_DENIED", () => {
    expect(() => resolveInside(ROOT, '../outside.json')).toThrowError(
      expect.objectContaining({ code: 'PATH_ESCAPE_DENIED' }),
    )
    expect(() => resolveInside(ROOT, '剧本/../../x')).toThrowError(
      expect.objectContaining({ code: 'PATH_ESCAPE_DENIED' }),
    )
  })

  it('绝对路径入参 → PATH_ESCAPE_DENIED', () => {
    expect(() => resolveInside(ROOT, '/etc/passwd')).toThrowError(
      expect.objectContaining({ code: 'PATH_ESCAPE_DENIED' }),
    )
  })

  it('空字节 → PATH_ESCAPE_DENIED', () => {
    expect(() => resolveInside(ROOT, 'a\0b')).toThrowError(
      expect.objectContaining({ code: 'PATH_ESCAPE_DENIED' }),
    )
  })
})
