// feature-827 · 单文件原子替换：同目录 temp → fsync → close → rename。
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { FileHandle } from 'node:fs/promises'

function tempPath(filePath: string): string {
  return path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  )
}

export async function writeTextAtomic(filePath: string, text: string): Promise<void> {
  const temp = tempPath(filePath)
  let handle: FileHandle | undefined
  let committed = false
  try {
    handle = await fsp.open(temp, 'wx')
    await handle.writeFile(text, 'utf-8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await fsp.rename(temp, filePath)
    committed = true
  } finally {
    if (handle) await handle.close().catch(() => {})
    if (!committed) await fsp.unlink(temp).catch(() => {})
  }
}

export function writeTextAtomicSync(filePath: string, text: string): void {
  const temp = tempPath(filePath)
  let fd: number | undefined
  let committed = false
  try {
    fd = fs.openSync(temp, 'wx')
    fs.writeFileSync(fd, text, 'utf-8')
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = undefined
    fs.renameSync(temp, filePath)
    committed = true
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd) } catch { /* 保留原异常 */ }
    }
    if (!committed) {
      try { fs.unlinkSync(temp) } catch { /* temp 可能尚未创建 */ }
    }
  }
}
