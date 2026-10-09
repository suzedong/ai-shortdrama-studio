// feature-017 · 路径沙箱
import path from 'node:path'

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code })
}

/**
 * 把相对路径解析到 root 内绝对路径。
 * 拒绝：绝对路径入参、解析后逃逸 root（含 '..'）、路径含空字节。
 * 失败：throw { code: 'PATH_ESCAPE_DENIED' }（入参非法为 INVALID_ARGUMENT）
 */
export function resolveInside(root: string, rel: string): string {
  if (typeof rel !== 'string' || typeof root !== 'string' || rel.trim() === '') {
    fail('INVALID_ARGUMENT', '路径参数不能为空')
  }
  if (rel.includes('\0')) {
    fail('PATH_ESCAPE_DENIED', '路径包含非法字符')
  }
  if (path.isAbsolute(rel)) {
    fail('PATH_ESCAPE_DENIED', '不允许使用绝对路径')
  }
  const abs = path.resolve(root, rel)
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    fail('PATH_ESCAPE_DENIED', '路径越出项目目录')
  }
  return abs
}
