import { constants as fsConstants } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { getRegisteredEntry, isKnownStyleId } from './catalog.js'
import { loadStyleCatalog } from './loader.js'
import { MetadataParseError, parseStylePreviewMetadata } from './metadata-parser.js'
import type {
  StylePreviewMediaKind,
  StylePreviewMetadataDto,
  StylePreviewMetadataRequest,
  StylePreviewMetadataStatus,
  StylePreviewParameter,
  StylePreviewPrompt,
  StylePreviewVideoTier,
} from './types.js'

export type {
  StylePreviewMediaKind,
  StylePreviewMetadataDto,
  StylePreviewParameter,
  StylePreviewPrompt,
} from './types.js'

// 与 VisualCatalog 的 Vite glob 文件名映射保持一致；renderer 不能提交文件名。
const MEDIA_STEM: Record<string, string> = {
  A3: 'A3_年代胶片',
  A4: 'A4_DV_CCD数码复古',
  A7: 'A7_拟真人仿真人动漫',
  C2: 'C2_国漫新中式插画',
  C6: 'C6_扁平矢量低多边形',
  C7: 'C7_韩漫精致美型',
  D2: 'D2_赛博科幻',
  D4: 'D4_暗黑哥特',
  E1: 'E1_3DCG',
}
const VIDEO_SUFFIX: Record<StylePreviewVideoTier, string> = {
  std: '标准20步',
  turbo: 'turbo8步',
  fast: 'FastH3',
}
const FAMILY_DIRECTORY: Record<string, string> = {
  A: 'A_写实影像',
  B: 'B_青春治愈',
  C: 'C_动画插画',
  D: 'D_类型氛围',
  E: 'E_材质工艺',
}
const MAX_FILE_BYTES: Record<StylePreviewMediaKind, number> = {
  image: 64 * 1024 * 1024,
  video: 256 * 1024 * 1024,
}
const STATUS_MESSAGE: Record<Exclude<StylePreviewMetadataStatus, 'ok'>, string> = {
  missing: '预览文件缺失',
  'no-metadata': '文件未内嵌 ComfyUI 提示词元数据',
  unsupported: '文件内嵌格式暂不支持',
  invalid: '预览元数据无效或不可读取',
}

class PreviewResourceError extends Error {
  constructor(readonly status: 'missing' | 'invalid') {
    super(status)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateRequest(input: unknown): StylePreviewMetadataRequest {
  if (!isRecord(input) || typeof input.styleId !== 'string' || !isKnownStyleId(input.styleId)) {
    throw new Error('INVALID_REQUEST')
  }
  const keys = Object.keys(input).sort()
  if (input.mediaKind === 'image') {
    if (keys.join(',') !== 'mediaKind,styleId') throw new Error('INVALID_REQUEST')
    return { styleId: input.styleId, mediaKind: 'image' }
  }
  if (
    input.mediaKind === 'video'
    && (input.tier === 'std' || input.tier === 'turbo' || input.tier === 'fast')
    && keys.join(',') === 'mediaKind,styleId,tier'
  ) {
    return { styleId: input.styleId, mediaKind: 'video', tier: input.tier }
  }
  throw new Error('INVALID_REQUEST')
}

function fileNameFor(request: StylePreviewMetadataRequest): string {
  const entry = getRegisteredEntry(request.styleId)
  if (!entry) throw new Error('INVALID_REQUEST')
  const stem = MEDIA_STEM[request.styleId] ?? `${entry.id}_${entry.name}`
  if (request.mediaKind === 'image') return `${stem}.png`
  return `${stem}_${VIDEO_SUFFIX[request.tier]}.mp4`
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

function isMissingFsError(error: unknown): boolean {
  return isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

async function locateFile(request: StylePreviewMetadataRequest): Promise<string> {
  const fileName = fileNameFor(request)
  if (basename(fileName) !== fileName) throw new PreviewResourceError('invalid')
  const catalog = await loadStyleCatalog()
  const entry = getRegisteredEntry(request.styleId)
  const familyDirectory = entry ? FAMILY_DIRECTORY[entry.familyCode] : undefined
  if (!familyDirectory) throw new PreviewResourceError('invalid')
  const root = resolve(dirname(catalog.sourcePath), '_style_preview')
  const candidate = resolve(root, familyDirectory, fileName)
  if (!isInside(root, candidate)) throw new PreviewResourceError('invalid')

  let rootReal: string
  let candidateStat
  try {
    rootReal = await realpath(root)
    candidateStat = await lstat(candidate)
  } catch (error) {
    if (isMissingFsError(error)) throw new PreviewResourceError('missing')
    throw new PreviewResourceError('invalid')
  }
  if (candidateStat.isSymbolicLink() || !candidateStat.isFile()) {
    throw new PreviewResourceError('invalid')
  }

  let real: string
  try {
    real = await realpath(candidate)
  } catch (error) {
    if (isMissingFsError(error)) throw new PreviewResourceError('missing')
    throw new PreviewResourceError('invalid')
  }
  if (!isInside(rootReal, real) || extname(real).toLowerCase() !== (request.mediaKind === 'image' ? '.png' : '.mp4')) {
    throw new PreviewResourceError('invalid')
  }
  return real
}

async function readFileLimited(path: string, kind: StylePreviewMediaKind): Promise<Buffer> {
  const handle = await open(path, fsConstants.O_RDONLY)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES[kind]) throw new PreviewResourceError('invalid')
    return await handle.readFile()
  } finally {
    await handle.close()
  }
}

function result(
  request: StylePreviewMetadataRequest,
  status: StylePreviewMetadataStatus,
  prompts: StylePreviewPrompt[] = [],
  params: StylePreviewParameter[] = [],
): StylePreviewMetadataDto {
  return {
    request,
    status,
    prompts,
    params,
    ...(status === 'ok' ? {} : { message: STATUS_MESSAGE[status] }),
  }
}

export async function readStylePreviewMetadata(input: unknown): Promise<StylePreviewMetadataDto> {
  const request = validateRequest(input)
  try {
    const path = await locateFile(request)
    const buffer = await readFileLimited(path, request.mediaKind)
    const parsed = parseStylePreviewMetadata(buffer, request.mediaKind)
    return result(request, parsed.status, parsed.prompts, parsed.params)
  } catch (error) {
    if (error instanceof PreviewResourceError) return result(request, error.status)
    if (error instanceof MetadataParseError) return result(request, error.status)
    if (isMissingFsError(error)) return result(request, 'missing')
    return result(request, 'invalid')
  }
}
