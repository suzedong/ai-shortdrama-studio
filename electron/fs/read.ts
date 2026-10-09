// feature-022 · 只读产物文件读取（契约 §2，D-022-01）
// renderer 查看器唯一读通道：沙箱限项目目录内、仅 .json/.md、≤1MB；写产物永远走 agent 侧 MCP file.write。
import path from 'node:path'
import fsp from 'node:fs/promises'
import { resolveInside } from './sandbox.js'

export type FileReadResult =
  | { ok: true; content: string; format: 'json' | 'md' }
  | { ok: false; error: { code: string; message: string } }

const MAX_BYTES = 1024 * 1024

function reject(code: string, message: string): FileReadResult {
  return { ok: false, error: { code, message } }
}

export async function readProjectFile(rootDir: string, relPath: string): Promise<FileReadResult> {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    return reject('INVALID_ARGUMENT', 'path 必须为非空字符串')
  }
  const ext = path.extname(relPath).toLowerCase()
  const format: 'json' | 'md' | null = ext === '.json' ? 'json' : ext === '.md' ? 'md' : null
  if (!format) {
    return reject('FORBIDDEN_FORMAT', '仅允许读取 .json / .md 产物文件')
  }
  let abs: string
  try {
    abs = resolveInside(rootDir, relPath)
  } catch (e) {
    return reject('PATH_ESCAPE', e instanceof Error ? e.message : '路径越出项目目录')
  }
  try {
    const stat = await fsp.stat(abs)
    if (!stat.isFile()) return reject('NOT_FOUND', '产物文件不存在')
    if (stat.size > MAX_BYTES) return reject('TOO_LARGE', '产物文件超过 1MB 上限')
    const content = await fsp.readFile(abs, 'utf-8')
    return { ok: true, content, format }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return reject('NOT_FOUND', '产物文件不存在')
    throw e
  }
}
