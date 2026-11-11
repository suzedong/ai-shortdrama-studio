// 资产索引：<项目>/资产/asset-index.json
import path from 'node:path'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import type { AssetIndexItem, AssetSourceSession } from '../../shared/types.js'
import type { RuntimeEvent } from '../runtime/types.js'
import { getActiveProjectDir } from '../project/current.js'
import { enqueue } from '../fs/write-queue.js'
import { archiveExisting } from '../fs/archive.js'
import { resolveInside } from '../fs/sandbox.js'

export type AssetKind = AssetIndexItem['kind']

function indexFile(): string {
  return path.join(getActiveProjectDir(), '资产', 'asset-index.json')
}

function errorWithCode(code: string, message: string, cause?: unknown): Error {
  return Object.assign(new Error(message), { code, cause })
}

async function readIndex(): Promise<AssetIndexItem[]> {
  let raw: string
  try {
    raw = await fsp.readFile(indexFile(), 'utf-8')
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

async function writeIndex(items: AssetIndexItem[]): Promise<void> {
  const file = indexFile()
  await archiveExisting(file, new Date())
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, JSON.stringify(items, null, 2), 'utf-8')
}

export async function listAssets(kind?: AssetKind): Promise<AssetIndexItem[]> {
  const items = await readIndex()
  return kind ? items.filter(item => item.kind === kind) : items
}

/** 登记资产（幂等：同 path+kind 复用 id）；省略的可选字段保留。 */
export async function registerAsset(input: {
  kind: AssetIndexItem['kind']
  path: string
  sourceJobId?: string
  meta?: Record<string, unknown>
}): Promise<{ assetId: string }> {
  return enqueue(async () => {
    resolveInside(getActiveProjectDir(), input.path)
    const items = await readIndex()
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
    await writeIndex(next)
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
