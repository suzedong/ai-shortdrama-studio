// 资产索引：<项目>/资产/asset-index.json
import path from 'node:path'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import type { AssetIndexItem, AssetSourceSession } from '../../shared/types.js'
import type {
  RuntimeAssetKind,
  RuntimeEvent,
  RuntimePromptAssetRef,
  RuntimeResolvedAsset,
} from '../runtime/types.js'
import { getActiveProjectDir } from '../project/current.js'
import { enqueue } from '../fs/write-queue.js'
import { copyExistingToArchive } from '../fs/archive.js'
import { resolveInside } from '../fs/sandbox.js'

export type AssetKind = AssetIndexItem['kind']

function indexFile(projectDir = getActiveProjectDir()): string {
  return path.join(projectDir, '资产', 'asset-index.json')
}

function errorWithCode(code: string, message: string, cause?: unknown): Error {
  return Object.assign(new Error(message), { name: code, code, cause })
}

async function readIndex(projectDir = getActiveProjectDir()): Promise<AssetIndexItem[]> {
  let raw: string
  try {
    raw = await fsp.readFile(indexFile(projectDir), 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) throw new Error('asset index is not an array')
    return parsed as AssetIndexItem[]
  } catch (error) {
    throw errorWithCode('ASSET_INDEX_CORRUPT', '资产索引 JSON 损坏', error)
  }
}

async function writeIndex(items: AssetIndexItem[], projectDir = getActiveProjectDir()): Promise<void> {
  const file = indexFile(projectDir)
  await fsp.mkdir(path.dirname(file), { recursive: true })
  const temp = path.join(
    path.dirname(file),
    `.asset-index.${process.pid}.${crypto.randomUUID()}.tmp`,
  )
  try {
    const handle = await fsp.open(temp, 'wx')
    try {
      await handle.writeFile(JSON.stringify(items, null, 2), 'utf-8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await copyExistingToArchive(file, new Date())
    await fsp.rename(temp, file)
  } catch (error) {
    await fsp.rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

export async function listAssets(kind?: AssetKind, projectDir = getActiveProjectDir()): Promise<AssetIndexItem[]> {
  const items = await readIndex(projectDir)
  return kind ? items.filter(item => item.kind === kind) : items
}

const PROMPT_ASSET_MIME: Record<RuntimeAssetKind, Record<string, string>> = {
  image: { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' },
  video: { '.mp4': 'video/mp4' },
  music: { '.mp3': 'audio/mpeg', '.wav': 'audio/wav' },
  workflow: { '.json': 'application/json' },
}

function isRuntimeAssetKind(kind: AssetKind): kind is RuntimeAssetKind {
  return kind === 'image' || kind === 'video' || kind === 'music' || kind === 'workflow'
}

function makeAssetRefError(code: string, message: string): Error {
  return errorWithCode(code, message)
}

/**
 * feature-822：renderer 只给 ID；main 从指定活动项目重取元数据并复核真实文件。
 * 空引用必须在调用方短路，保证旧纯文本请求不读索引、不增加任何 part。
 */
export async function resolvePromptAssetRefs(
  refs: RuntimePromptAssetRef[],
  projectDir: string,
): Promise<RuntimeResolvedAsset[]> {
  if (!Array.isArray(refs)) {
    throw makeAssetRefError('ASSET_REF_INVALID', '资产引用格式不正确')
  }
  const ids: string[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    if (
      !ref || typeof ref !== 'object' || Array.isArray(ref) ||
      Object.keys(ref).some(key => key !== 'assetId') ||
      typeof ref.assetId !== 'string' || ref.assetId.trim().length === 0 ||
      ref.assetId !== ref.assetId.trim() || ref.assetId.length > 256
    ) {
      throw makeAssetRefError('ASSET_REF_INVALID', '资产引用仅允许有效的资产 ID')
    }
    if (!seen.has(ref.assetId)) {
      seen.add(ref.assetId)
      ids.push(ref.assetId)
    }
  }
  if (ids.length === 0) return []

  const items = await listAssets(undefined, projectDir)
  const resolved: RuntimeResolvedAsset[] = []
  for (const assetId of ids) {
    const item = items.find(candidate => candidate.id === assetId)
    if (!item) throw makeAssetRefError('ASSET_REF_NOT_FOUND', '当前项目中不存在所选资产')
    if (!isRuntimeAssetKind(item.kind)) {
      throw makeAssetRefError('ASSET_REF_UNSUPPORTED', '该资产类型不支持对话引用')
    }
    const mime = PROMPT_ASSET_MIME[item.kind][path.extname(item.path).toLowerCase()]
    if (!mime) throw makeAssetRefError('ASSET_REF_UNSUPPORTED', '该资产文件格式不支持对话引用')

    const requested = path.resolve(projectDir, item.path)
    const lexicalRelative = path.relative(projectDir, requested)
    if (lexicalRelative === '..' || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
      throw makeAssetRefError('PATH_ESCAPE_DENIED', '资产路径超出当前项目范围')
    }
    let stat
    try {
      stat = await fsp.lstat(requested)
    } catch {
      throw makeAssetRefError('ASSET_REF_NOT_REGULAR_FILE', '所选资产文件已缺失或不可用')
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw makeAssetRefError('ASSET_REF_NOT_REGULAR_FILE', '所选资产必须是项目内的普通文件，不能是目录或符号链接')
    }

    let absolutePath: string
    try {
      resolveInside(projectDir, item.path)
      absolutePath = await fsp.realpath(requested)
      const rootReal = await fsp.realpath(projectDir)
      const relativeReal = path.relative(rootReal, absolutePath)
      if (relativeReal === '..' || relativeReal.startsWith(`..${path.sep}`) || path.isAbsolute(relativeReal)) {
        throw new Error('real path escaped project')
      }
    } catch {
      throw makeAssetRefError('PATH_ESCAPE_DENIED', '资产真实路径超出当前项目范围')
    }

    const originalName = item.meta?.originalName
    const name = typeof originalName === 'string' && originalName.trim().length > 0 &&
      originalName.length <= 255 && path.basename(originalName) === originalName &&
      !originalName.includes('/') && !originalName.includes('\\')
      ? originalName
      : path.basename(item.path)
    resolved.push({ assetId: item.id, kind: item.kind, path: item.path, name, absolutePath, mime })
  }
  return resolved
}

/** 登记资产（幂等：同 path+kind 复用 id）；省略的可选字段保留。 */
export async function registerAsset(input: {
  kind: AssetIndexItem['kind']
  path: string
  sourceJobId?: string
  meta?: Record<string, unknown>
}, projectDir = getActiveProjectDir()): Promise<{ assetId: string }> {
  return enqueue(async () => {
    resolveInside(projectDir, input.path)
    const items = await readIndex(projectDir)
    const id = `a-${input.kind}-${crypto.createHash('sha1').update(input.path).digest('hex').slice(0, 8)}`
    const existing = items.find(item => item.id === id)
    const item: AssetIndexItem = existing
      ? { ...existing }
      : {
          id,
          kind: input.kind,
          path: input.path,
          createdAt: new Date().toISOString(),
        }
    if (input.sourceJobId !== undefined) item.sourceJobId = input.sourceJobId
    if (input.meta !== undefined) item.meta = input.meta
    const next = [...items.filter(item => item.id !== id), item]
    await writeIndex(next, projectDir)
    return { assetId: id }
  })
}

/** 只补写已登记资产的可信来源，不创建缺失条目。 */
export async function updateAssetSource(
  assetId: string,
  source: { sourceJobId?: string; sourceSession: AssetSourceSession },
): Promise<void> {
  return enqueue(async () => {
    const items = await readIndex()
    const existing = items.find(item => item.id === assetId)
    if (!existing) throw errorWithCode('ASSET_NOT_FOUND', `资产不存在：${assetId}`)
    const item: AssetIndexItem = {
      ...existing,
      sourceSession: source.sourceSession,
    }
    if (source.sourceJobId !== undefined) item.sourceJobId = source.sourceJobId
    await writeIndex(items.map(candidate => candidate.id === assetId ? item : candidate))
  })
}

function assetIdFromParsed(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as {
    ok?: unknown
    assetId?: unknown
    content?: unknown
  }
  if (candidate.ok === true && typeof candidate.assetId === 'string' && candidate.assetId.length > 0) {
    return candidate.assetId
  }
  if (!Array.isArray(candidate.content)) return null
  for (const entry of candidate.content) {
    if (typeof entry !== 'object' || entry === null) continue
    const text = (entry as { text?: unknown }).text
    if (typeof text !== 'string') continue
    try {
      const assetId = assetIdFromParsed(JSON.parse(text) as unknown)
      if (assetId) return assetId
    } catch {
      // 非 JSON 的 content text 与当前工具无关，继续扫描其他片段。
    }
  }
  return null
}

/** feature-814：观察真实 tool.call 完成事件，异步补写资产来源。 */
export async function captureAssetSource(event: RuntimeEvent): Promise<void> {
  if (
    event.type !== 'tool.call'
    || event.status !== 'completed'
    || event.tool !== 'shortdrama_asset_register'
    || typeof event.resultPreview !== 'string'
  ) return
  let assetId: string | null
  try {
    assetId = assetIdFromParsed(JSON.parse(event.resultPreview) as unknown)
  } catch {
    return
  }
  if (!assetId) return
  const args = typeof event.args === 'object' && event.args !== null
    ? event.args as Record<string, unknown>
    : {}
  const sourceJobId = typeof args.sourceJobId === 'string' && args.sourceJobId.length > 0
    ? args.sourceJobId
    : undefined
  await updateAssetSource(assetId, {
    sourceJobId,
    sourceSession: {
      sessionId: event.sessionId,
      messageId: event.messageId,
      callId: event.callId,
    },
  })
}
