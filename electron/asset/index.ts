// feature-017 · AssetIndex：资产/asset-index.json 读 / register
import path from 'node:path'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import type { AssetIndexItem } from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { archiveExisting } from '../fs/archive.js'
import { resolveInside } from '../fs/sandbox.js'
import { getActiveProjectDir } from '../project/current.js'

export type AssetKind = AssetIndexItem['kind']

function indexFile(): string {
  return path.join(getActiveProjectDir(), '资产', 'asset-index.json')
}

/** 读取全部条目（文件缺失返回 []） */
export async function listAssets(kind?: AssetKind): Promise<AssetIndexItem[]> {
  try {
    const all = JSON.parse(await fsp.readFile(indexFile(), 'utf-8')) as AssetIndexItem[]
    return kind ? all.filter(a => a.kind === kind) : all
  } catch {
    return []
  }
}

/**
 * 登记资产（幂等 upsert：同 path+kind 返回同一 id）。
 * path 经沙箱解析但不要求文件当前存在（媒体任务可先登记后产出）。
 */
export function registerAsset(input: {
  kind: AssetKind
  path: string
  sourceJobId?: string
  meta?: Record<string, unknown>
}): Promise<{ assetId: string }> {
  return enqueue(async () => {
    resolveInside(getActiveProjectDir(), input.path)
    const file = indexFile()
    let all: AssetIndexItem[] = []
    try {
      all = JSON.parse(await fsp.readFile(file, 'utf-8')) as AssetIndexItem[]
    } catch {
      // 首次登记 → 空索引
    }
    const assetId = `a-${input.kind}-${crypto.createHash('sha1').update(input.path).digest('hex').slice(0, 8)}`
    const idx = all.findIndex(a => a.id === assetId && a.kind === input.kind)
    if (idx >= 0) {
      all[idx] = { ...all[idx], sourceJobId: input.sourceJobId, meta: input.meta }
    } else {
      all.push({
        id: assetId,
        kind: input.kind,
        path: input.path,
        sourceJobId: input.sourceJobId,
        meta: input.meta,
        createdAt: new Date().toISOString(),
      })
    }
    await archiveExisting(file, new Date())
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await fsp.writeFile(file, JSON.stringify(all, null, 2), 'utf-8')
    return { assetId }
  })
}
