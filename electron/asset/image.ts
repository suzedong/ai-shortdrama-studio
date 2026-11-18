// feature-821 · 图片上传与派生缩略图（仅主进程内部接收源路径）
import path from 'node:path'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import sharp from 'sharp'
import type { AssetIndexItem } from '../../shared/types.js'
import { resolveInside } from '../fs/sandbox.js'
import { listAssets, registerAsset } from './index.js'

const MAX_IMAGE_BYTES = 64 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_THUMBNAIL_BYTES = 4 * 1024 * 1024
const THUMBNAIL_EDGE = 320

const FORMATS = {
  png: { extension: 'png', mime: 'image/png' },
  jpeg: { extension: 'jpg', mime: 'image/jpeg' },
  webp: { extension: 'webp', mime: 'image/webp' },
} as const

type SupportedFormat = keyof typeof FORMATS

type CodedError = Error & { code?: string }

function errorWithCode(code: string, message: string): CodedError {
  return Object.assign(new Error(message), { code })
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as CodedError).code)
    : undefined
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR'
}

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
}

function isCanonicalRelativeTo(relativePath: string, directory: string): boolean {
  return !relativePath.includes('\\')
    && !path.posix.isAbsolute(relativePath)
    && path.posix.normalize(relativePath) === relativePath
    && relativePath.startsWith(`${directory}/`)
}

async function ensureSecureDirectory(projectRoot: string, relativeDirectory: string): Promise<string> {
  resolveInside(projectRoot, relativeDirectory)
  const rootReal = await fsp.realpath(projectRoot)
  let current = rootReal
  for (const segment of relativeDirectory.split('/')) {
    current = path.join(current, segment)
    try {
      const stat = await fsp.lstat(current)
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw errorWithCode('PATH_ESCAPE_DENIED', '资产目录包含不安全路径')
      }
    } catch (error) {
      if (!isMissing(error)) throw error
      await fsp.mkdir(current)
    }
  }
  const real = await fsp.realpath(current)
  if (!isInside(rootReal, real)) {
    throw errorWithCode('PATH_ESCAPE_DENIED', '资产目录超出项目边界')
  }
  return real
}

async function locateProjectFile(
  projectRoot: string,
  relativePath: string,
  directory: string,
): Promise<string | null> {
  if (!isCanonicalRelativeTo(relativePath, directory)) return null
  const candidate = resolveInside(projectRoot, relativePath)
  try {
    const baseReal = await fsp.realpath(path.join(projectRoot, directory))
    const stat = await fsp.lstat(candidate)
    if (stat.isSymbolicLink() || !stat.isFile()) return null
    const real = await fsp.realpath(candidate)
    return isInside(baseReal, real) ? real : null
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

function thumbnailRelativePath(assetPath: string): string {
  const digest = crypto.createHash('sha256').update(assetPath).digest('hex')
  return `资产/缩略图/${digest}.webp`
}

function sharpInput(input: Buffer) {
  return sharp(input, {
    failOn: 'truncated',
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
  })
}

async function createThumbnail(input: Buffer): Promise<{
  buffer: Buffer
  format: SupportedFormat
  mime: typeof FORMATS[SupportedFormat]['mime']
}> {
  try {
    const metadata = await sharpInput(input).metadata()
    const format = metadata.format as SupportedFormat
    if (!(format in FORMATS)) {
      throw errorWithCode('IMAGE_UNSUPPORTED', '仅支持 PNG、JPEG 或 WebP 图片')
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
      throw errorWithCode('IMAGE_TOO_MANY_PIXELS', '图片尺寸无效或超过 4000 万像素')
    }
    const buffer = await sharpInput(input)
      .rotate()
      .resize(THUMBNAIL_EDGE, THUMBNAIL_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    return { buffer, format, mime: FORMATS[format].mime }
  } catch (error) {
    if (errorCode(error) === 'IMAGE_UNSUPPORTED' || errorCode(error) === 'IMAGE_TOO_MANY_PIXELS') {
      throw error
    }
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw errorWithCode('IMAGE_TOO_MANY_PIXELS', '图片超过 4000 万像素')
    }
    throw errorWithCode('IMAGE_UNSUPPORTED', '图片为空、损坏、被截断或格式不受支持')
  }
}

/** 返回是否为本次新建；同内容复用，派生缩略图允许原子替换旧版本。 */
async function writeBinaryAtomically(file: string, data: Buffer, replace: boolean): Promise<boolean> {
  let existing: Buffer | null = null
  try {
    const stat = await fsp.lstat(file)
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw errorWithCode('PATH_ESCAPE_DENIED', '资产目标不是安全普通文件')
    }
    existing = await fsp.readFile(file)
  } catch (error) {
    if (!isMissing(error)) throw error
  }
  if (existing?.equals(data)) return false
  if (existing !== null && !replace) {
    throw errorWithCode('ASSET_IMPORT_FAILED', '资产内容冲突，未覆盖已有文件')
  }

  const temp = path.join(path.dirname(file), `.asset-${process.pid}-${crypto.randomUUID()}.tmp`)
  try {
    const handle = await fsp.open(temp, 'wx')
    try {
      await handle.writeFile(data)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await fsp.rename(temp, file)
    return existing === null
  } catch (error) {
    await fsp.rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

async function readSource(sourcePath: string): Promise<{ buffer: Buffer; originalName: string }> {
  let stat
  try {
    stat = await fsp.lstat(sourcePath)
  } catch (error) {
    if (isMissing(error)) throw errorWithCode('SOURCE_NOT_REGULAR_FILE', '所选图片不存在')
    throw error
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw errorWithCode('SOURCE_NOT_REGULAR_FILE', '请选择普通图片文件，不支持目录或符号链接')
  }
  if (stat.size > MAX_IMAGE_BYTES) {
    throw errorWithCode('IMAGE_TOO_LARGE', '图片超过 64 MiB 上限')
  }
  const handle = await fsp.open(sourcePath, 'r')
  try {
    const current = await handle.stat()
    if (!current.isFile()) throw errorWithCode('SOURCE_NOT_REGULAR_FILE', '所选图片不是普通文件')
    if (current.size > MAX_IMAGE_BYTES) throw errorWithCode('IMAGE_TOO_LARGE', '图片超过 64 MiB 上限')
    const buffer = await handle.readFile()
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw errorWithCode('IMAGE_TOO_LARGE', '图片超过 64 MiB 上限')
    }
    return { buffer, originalName: path.basename(sourcePath) }
  } finally {
    await handle.close()
  }
}

export async function importImageFromPath(input: {
  projectRoot: string
  sourcePath: string
}): Promise<AssetIndexItem> {
  const createdFiles: string[] = []
  let registered = false
  try {
    // 先读索引：坏索引必须在任何媒体写入前失败。
    await listAssets(undefined, input.projectRoot)
    const { buffer, originalName } = await readSource(input.sourcePath)
    const thumbnail = await createThumbnail(buffer)
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
    const relativeOriginal = `资产/上传/${sha256}.${FORMATS[thumbnail.format].extension}`
    const relativeThumbnail = thumbnailRelativePath(relativeOriginal)

    const uploadDirectory = await ensureSecureDirectory(input.projectRoot, '资产/上传')
    const thumbnailDirectory = await ensureSecureDirectory(input.projectRoot, '资产/缩略图')
    const originalFile = path.join(uploadDirectory, path.posix.basename(relativeOriginal))
    const thumbnailFile = path.join(thumbnailDirectory, path.posix.basename(relativeThumbnail))
    if (await writeBinaryAtomically(originalFile, buffer, false)) createdFiles.push(originalFile)
    if (await writeBinaryAtomically(thumbnailFile, thumbnail.buffer, true)) createdFiles.push(thumbnailFile)

    const { assetId } = await registerAsset({
      kind: 'image',
      path: relativeOriginal,
      meta: {
        origin: 'upload',
        originalName,
        mime: thumbnail.mime,
        sizeBytes: buffer.byteLength,
        sha256,
      },
    }, input.projectRoot)
    registered = true
    const asset = (await listAssets(undefined, input.projectRoot)).find(item => item.id === assetId)
    if (!asset) throw errorWithCode('ASSET_IMPORT_FAILED', '图片已登记但读取资产索引失败')
    return asset
  } catch (error) {
    if (!registered) {
      await Promise.all(createdFiles.map(file => fsp.rm(file, { force: true }).catch(() => {})))
    }
    const code = errorCode(error)
    if (code && [
      'PATH_ESCAPE_DENIED', 'ASSET_INDEX_CORRUPT', 'SOURCE_NOT_REGULAR_FILE',
      'IMAGE_TOO_LARGE', 'IMAGE_UNSUPPORTED', 'IMAGE_TOO_MANY_PIXELS', 'ASSET_IMPORT_FAILED',
    ].includes(code)) throw error
    throw errorWithCode('ASSET_IMPORT_FAILED', '图片导入失败，请检查文件和磁盘状态')
  }
}

export async function readAssetThumbnail(input: {
  projectRoot: string
  assetId: string
}): Promise<{ dataUrl: string | null }> {
  if (typeof input.assetId !== 'string' || input.assetId.length === 0 || input.assetId.length > 256) {
    throw errorWithCode('INVALID_ARGUMENT', '资产 ID 无效')
  }
  try {
    const asset = (await listAssets(undefined, input.projectRoot)).find(item => item.id === input.assetId)
    if (!asset || asset.kind !== 'image' || !isCanonicalRelativeTo(asset.path, '资产')) {
      return { dataUrl: null }
    }
    const relativeThumbnail = thumbnailRelativePath(asset.path)
    const cachedFile = await locateProjectFile(input.projectRoot, relativeThumbnail, '资产/缩略图')
    if (cachedFile) {
      const cached = await fsp.readFile(cachedFile)
      if (cached.byteLength > 0 && cached.byteLength <= MAX_THUMBNAIL_BYTES) {
        return { dataUrl: `data:image/webp;base64,${cached.toString('base64')}` }
      }
    }

    const originalFile = await locateProjectFile(input.projectRoot, asset.path, '资产')
    if (!originalFile) return { dataUrl: null }
    const stat = await fsp.stat(originalFile)
    if (stat.size > MAX_IMAGE_BYTES) return { dataUrl: null }
    const original = await fsp.readFile(originalFile)
    let thumbnail: Buffer
    try {
      thumbnail = (await createThumbnail(original)).buffer
    } catch (error) {
      if (errorCode(error) === 'IMAGE_UNSUPPORTED' || errorCode(error) === 'IMAGE_TOO_MANY_PIXELS') {
        return { dataUrl: null }
      }
      throw error
    }
    const directory = await ensureSecureDirectory(input.projectRoot, '资产/缩略图')
    const file = path.join(directory, path.posix.basename(relativeThumbnail))
    await writeBinaryAtomically(file, thumbnail, true)
    return { dataUrl: `data:image/webp;base64,${thumbnail.toString('base64')}` }
  } catch (error) {
    if (errorCode(error) === 'PATH_ESCAPE_DENIED') return { dataUrl: null }
    if (errorCode(error) === 'ASSET_INDEX_CORRUPT' || errorCode(error) === 'ASSET_THUMBNAIL_FAILED') {
      throw error
    }
    throw errorWithCode('ASSET_THUMBNAIL_FAILED', '缩略图读取或生成失败')
  }
}
