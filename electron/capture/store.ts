// feature-005 · 「已捕获口径」唯一读写点（契约 §2）
// 内存无缓存，读即磁盘；写经全局写队列 enqueue 串行；写成功后广播全量 CaptureFile。
// MCP 工具与 IPC handler 均为本模块薄壳——双通道同一数据模型同一追溯（用户裁决②、D-016）。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type {
  CaptureFile, CapturedFact, CaptureSource, CaptureStatus,
} from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { getActiveProjectDir } from '../project/current.js'

export const CAPTURE_FILE_NAME = '已捕获口径.json'

export interface CaptureUpsertInput {
  id?: string
  topic?: string
  value?: string
  source?: CaptureSource
  status?: CaptureStatus
  quote?: string
}

export interface CaptureChangeListener {
  (file: CaptureFile): void
}

function emptyFile(): CaptureFile {
  return { schemaVersion: 1, facts: [] }
}

function invalid(message: string): Error {
  return Object.assign(new Error(message), { code: 'INVALID_ARGUMENT' })
}

function notFound(id: string): Error {
  return Object.assign(new Error(`口径条目不存在：${id}`), { code: 'CAPTURE_FACT_NOT_FOUND' })
}

function capturePath(): string {
  return path.join(getActiveProjectDir(), CAPTURE_FILE_NAME)
}

/** 读全量；文件不存在 = 空库；损坏（解析失败 / 结构不符）抛错含路径，不静默覆盖 */
async function readFile(): Promise<CaptureFile> {
  const file = capturePath()
  let text: string
  try {
    text = await fsp.readFile(file, 'utf-8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyFile()
    throw e
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Error(`口径文件损坏（${file}）：${(e as Error).message}`)
  }
  const obj = parsed as Partial<CaptureFile> | null
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.facts)) {
    throw new Error(`口径文件结构不符（${file}）：缺少 facts 数组`)
  }
  return {
    schemaVersion: 1,
    ...(typeof obj.nextId === 'number' ? { nextId: obj.nextId } : {}),
    facts: obj.facts as CapturedFact[],
  }
}

function maxFactId(facts: CapturedFact[]): number {
  let max = 0
  for (const f of facts) {
    const m = /^f(\d+)$/.exec(f.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

class CaptureStore {
  private listeners = new Set<CaptureChangeListener>()

  /** capture.list：无入参，返回全量；空库不报错 */
  async list(): Promise<CaptureFile> {
    return readFile()
  }

  /**
   * capture.upsert（U1–U5）：
   * U1 有 id → 精确更新（不存在 → CAPTURE_FACT_NOT_FOUND 零写盘）；
   * U2 无 id → topic 必填，trim 精确匹配既有则更新，否则新建（id 取高水位 nextId，删除不复用）；
   * U3 新建缺省 source='infer'（user 须显式标且带 quote）；status 缺省推导 user→confirmed / infer→pending；
   * U4 value 新建必填、更新可缺省；trim 空串 → INVALID_ARGUMENT；
   * U5 写成功广播 capture:changed（全量）。
   */
  async upsert(input: CaptureUpsertInput): Promise<CapturedFact> {
    return enqueue(async () => {
      const file = await readFile()
      const now = new Date().toISOString()

      // 静态校验（零写盘路径）
      if (input.topic !== undefined && input.topic.trim() === '') {
        throw invalid('topic trim 后为空')
      }
      if (input.value !== undefined && input.value.trim() === '') {
        throw invalid('value trim 后为空')
      }

      let idx = -1
      if (input.id !== undefined) {
        idx = file.facts.findIndex(f => f.id === input.id)
        if (idx < 0) throw notFound(input.id)
      } else {
        if (input.topic === undefined) throw invalid('无 id 时 topic 必填')
        idx = file.facts.findIndex(f => f.topic === input.topic!.trim())
      }

      let result: CapturedFact
      if (idx >= 0) {
        // U1/U2 更新：非 undefined 字段覆盖，updatedAt 刷新
        const old = file.facts[idx]!
        const next: CapturedFact = {
          ...old,
          ...(input.topic !== undefined ? { topic: input.topic.trim() } : {}),
          ...(input.value !== undefined ? { value: input.value.trim() } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.quote !== undefined ? { quote: input.quote } : {}),
          updatedAt: now,
        }
        if (next.source === 'user' && !next.quote) {
          throw invalid("source='user' 必须带 quote 举证")
        }
        file.facts[idx] = next
        result = next
      } else {
        // U2/U3/U4 新建
        if (input.value === undefined) throw invalid('新建时 value 必填')
        const source: CaptureSource = input.source ?? 'infer'
        if (source === 'user' && !input.quote) {
          throw invalid("source='user' 必须带 quote 举证")
        }
        const status: CaptureStatus =
          input.status ?? (source === 'user' ? 'confirmed' : 'pending')
        // D-002 方案 A：id 取高水位 nextId（缺省 = 当前 facts max+1），分配后推进为 n+1 随文件持久化；
        // 高水位单调不减，删除的 id 不复用（契约 §1）
        const n = Math.max(file.nextId ?? 1, maxFactId(file.facts) + 1)
        result = {
          id: `f${n}`,
          topic: input.topic!.trim(),
          value: input.value.trim(),
          source,
          status,
          ...(input.quote !== undefined ? { quote: input.quote } : {}),
          updatedAt: now,
        }
        file.nextId = n + 1
        file.facts.push(result)
      }

      await fsp.writeFile(capturePath(), JSON.stringify(file, null, 2), 'utf-8')
      this.broadcast(file)
      return result
    })
  }

  /** capture.remove：id 不存在 → CAPTURE_FACT_NOT_FOUND 零写盘；成功广播 */
  async remove(id: string): Promise<{ removed: true }> {
    return enqueue(async () => {
      const file = await readFile()
      const idx = file.facts.findIndex(f => f.id === id)
      if (idx < 0) throw notFound(id)
      file.facts.splice(idx, 1)
      await fsp.writeFile(capturePath(), JSON.stringify(file, null, 2), 'utf-8')
      this.broadcast(file)
      return { removed: true as const }
    })
  }

  subscribe(fn: CaptureChangeListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private broadcast(file: CaptureFile): void {
    for (const fn of this.listeners) fn(file)
  }
}

export const captureStore = new CaptureStore()
