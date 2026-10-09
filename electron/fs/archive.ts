// feature-017 · 版本归档（自 session.ts 等价抽取，行为不变）
import path from 'node:path'
import fsp from 'node:fs/promises'

// 归档时间戳：YYYYMMDD-HHmmss（本地时间）
function archiveStamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// 写前归档：旧文件移到同目录 版本/<base>.<stamp><ext>；同秒冲突追加 .N 序号。
// 文件不存在（首次写入）返回 []；同次落盘的多个文件传同一 now 保证同批时间戳一致；
// 归档失败抛错阻断本次写入（避免无备份覆盖）。
export async function archiveExisting(filePath: string, now: Date): Promise<string[]> {
  try {
    await fsp.access(filePath)
  } catch {
    return []
  }
  const ext = path.extname(filePath)
  const base = path.basename(filePath, ext)
  const archiveDir = path.join(path.dirname(filePath), '版本')
  await fsp.mkdir(archiveDir, { recursive: true })
  const stamp = archiveStamp(now)
  let target = path.join(archiveDir, `${base}.${stamp}${ext}`)
  for (let seq = 1; ; seq += 1) {
    try {
      await fsp.access(target)
      target = path.join(archiveDir, `${base}.${stamp}.${seq}${ext}`)
    } catch {
      break
    }
  }
  await fsp.rename(filePath, target)
  return [target]
}
