// feature-017 · CanvasStore：内存投影 + canvas.json 落盘 + upsert + 订阅广播
// feature-814 · 统一命令 revision / 回执 / 原子替换
import path from 'node:path'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import type {
  Canvas,
  CanvasCommandReceipt,
  CanvasCommandRequest,
  CanvasCommandResult,
  CanvasEdge,
  CanvasGate,
} from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { copyExistingToArchive } from '../fs/archive.js'
import { getActiveProjectDir } from '../project/current.js'
import { listAssets } from '../asset/index.js'
import { deriveAutoEdges, type CanvasUpsertNode } from './edges.js'

export interface CanvasUpdatePatch {
  nodes?: CanvasUpsertNode[]
  /** 直接 upsert 边（手动 / 自动均可），按 from/to 去重 */
  edges?: { from: string; to: string; auto?: boolean }[]
  mode?: 'merge'
}

export interface CanvasCommandOptions {
  commandId?: string
  expectedRevision?: number
}

export interface CanvasChangeListener {
  (canvas: Canvas): void
}

function errorWithCode(code: string, message: string, cause?: unknown): Error {
  return Object.assign(new Error(message), { code, cause })
}

function emptyCanvas(root: string): Canvas {
  return {
    schemaVersion: 3,
    projectId: path.basename(root),
    title: '新项目',
    nodes: [],
    edges: [],
    gates: [],
    revision: 0,
    receipts: [],
    updatedAt: new Date().toISOString(),
  }
}

function migrateCanvas(value: unknown): Canvas {
  if (typeof value !== 'object' || value === null) {
    throw errorWithCode('CANVAS_CORRUPT', '画布文件不是有效对象')
  }
  const candidate = value as Omit<Partial<Canvas>, 'schemaVersion'> & { schemaVersion?: number }
  if (
    (candidate.schemaVersion !== 2 && candidate.schemaVersion !== 3)
    || typeof candidate.projectId !== 'string'
    || typeof candidate.title !== 'string'
    || !Array.isArray(candidate.nodes)
    || !Array.isArray(candidate.edges)
    || !Array.isArray(candidate.gates)
    || typeof candidate.updatedAt !== 'string'
  ) {
    throw errorWithCode('CANVAS_CORRUPT', '画布文件结构或 schemaVersion 不受支持')
  }
  if (candidate.schemaVersion === 2) {
    return {
      ...candidate,
      schemaVersion: 3,
      revision: 0,
      receipts: [],
    } as Canvas
  }
  if (!Number.isInteger(candidate.revision) || (candidate.revision ?? -1) < 0 || !Array.isArray(candidate.receipts)) {
    throw errorWithCode('CANVAS_CORRUPT', '画布 revision 或 receipts 损坏')
  }
  return candidate as Canvas
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

function requestHash(type: string, payload: unknown): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stableValue({ type, payload })))
    .digest('hex')
}

function commandId(): string {
  return `canvas-${crypto.randomUUID()}`
}

async function writeCanvasAtomically(file: string, canvas: Canvas, now: Date): Promise<void> {
  const serialized = JSON.stringify(canvas, null, 2)
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  let handle: fsp.FileHandle | undefined
  try {
    handle = await fsp.open(temp, 'wx', 0o600)
    await handle.writeFile(serialized, 'utf-8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await copyExistingToArchive(file, now)
    await fsp.rename(temp, file)
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => undefined)
    await fsp.rm(temp, { force: true }).catch(() => undefined)
    throw error
  }
}

export class CanvasStore {
  private cache: Canvas | null = null
  private listeners = new Set<CanvasChangeListener>()

  private file(): string {
    return path.join(getActiveProjectDir(), 'canvas.json')
  }

  /** 懒加载：仅 ENOENT 初始化空图；已存在坏档必须显式报错。 */
  async get(): Promise<Canvas> {
    if (this.cache) return this.cache
    const file = this.file()
    let raw: string
    try {
      raw = await fsp.readFile(file, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const init = emptyCanvas(path.dirname(file))
      await writeCanvasAtomically(file, init, new Date())
      this.cache = init
      return init
    }
    try {
      this.cache = migrateCanvas(JSON.parse(raw) as unknown)
    } catch (error) {
      if ((error as { code?: string }).code === 'CANVAS_CORRUPT') throw error
      throw errorWithCode('CANVAS_CORRUPT', '画布文件 JSON 损坏', error)
    }
    return this.cache
  }

  /** 门按 gateId upsert（仅 gate 链路使用）；写盘后广播。 */
  async upsertGate(gate: CanvasGate): Promise<Canvas> {
    return enqueue(async () => {
      const result = await this.commitInQueue('gate.upsert', undefined, {}, canvas => {
        const idx = canvas.gates.findIndex(g => g.gateId === gate.gateId)
        if (idx >= 0) canvas.gates[idx] = gate
        else canvas.gates.push(gate)
      })
      return result.canvas
    })
  }

  /** MCP 命令入口：保留旧 update 调用，同时可取得回执。 */
  async updateWithCommand(
    patch: CanvasUpdatePatch,
    options: CanvasCommandOptions = {},
  ): Promise<CanvasCommandResult> {
    return enqueue(() => this.commitInQueue('canvas.update', patch, options, canvas => {
      this.applyUpdate(canvas, patch)
    }))
  }

  /** 幂等 upsert 节点 / 边（merge）。 */
  async update(patch: CanvasUpdatePatch): Promise<Canvas> {
    const result = await this.updateWithCommand(patch)
    return result.canvas
  }

  private applyUpdate(canvas: Canvas, patch: CanvasUpdatePatch): void {
    const upserts = patch.nodes ?? []
    for (const n of upserts) {
      const { linksTo: _linksTo, ...node } = n
      node.updatedAt = new Date().toISOString()
      if (node.assetIds !== undefined) node.assetIds = [...new Set(node.assetIds)]
      const idx = canvas.nodes.findIndex(x => x.id === node.id)
      if (idx >= 0) {
        const old = canvas.nodes[idx]!
        node.dirty = old.dirty
        if (node.parentReference === undefined) node.parentReference = old.parentReference
        if (node.assetIds === undefined) node.assetIds = old.assetIds
        canvas.nodes[idx] = node
      } else {
        canvas.nodes.push(node)
      }
    }
    if (upserts.length > 0) canvas.edges = deriveAutoEdges(canvas.edges, upserts)
    for (const e of patch.edges ?? []) {
      const idx = canvas.edges.findIndex(x => x.from === e.from && x.to === e.to)
      const edge: CanvasEdge = {
        id: `e-${e.from}--${e.to}`,
        from: e.from,
        to: e.to,
        auto: e.auto ?? false,
      }
      if (idx >= 0) canvas.edges[idx] = edge
      else canvas.edges.push(edge)
    }
  }

  /** 系统直改：本批只开放节点资产绑定与解绑。 */
  async command(request: CanvasCommandRequest): Promise<CanvasCommandResult> {
    if (
      typeof request.commandId !== 'string' || request.commandId.trim() === ''
      || !Number.isInteger(request.expectedRevision) || request.expectedRevision < 0
      || (request.type !== 'assets.bind' && request.type !== 'assets.unbind')
      || typeof request.nodeId !== 'string' || request.nodeId.trim() === ''
      || !Array.isArray(request.assetIds) || request.assetIds.length === 0
      || request.assetIds.some(id => typeof id !== 'string' || id.trim() === '')
    ) {
      throw errorWithCode('INVALID_ARGUMENT', '画布命令参数无效')
    }
    const assetIds = [...new Set(request.assetIds)].sort()
    return enqueue(() => this.commitInQueue(
      request.type,
      { nodeId: request.nodeId, assetIds },
      { commandId: request.commandId, expectedRevision: request.expectedRevision },
      async canvas => {
        const node = canvas.nodes.find(item => item.id === request.nodeId)
        if (!node) throw errorWithCode('CANVAS_NODE_NOT_FOUND', `画布节点不存在：${request.nodeId}`)
        const assets = await listAssets()
        const known = new Set(assets.map(asset => asset.id))
        const missing = assetIds.filter(id => !known.has(id))
        if (missing.length > 0) {
          throw errorWithCode('ASSET_NOT_FOUND', `资产不存在：${missing.join(', ')}`)
        }
        const current = node.assetIds ?? []
        node.assetIds = request.type === 'assets.bind'
          ? [...new Set([...current, ...assetIds])]
          : current.filter(id => !assetIds.includes(id))
      },
    ))
  }

  /** feature-002：同一次写盘内读-改-写，自开写队列。 */
  async withCanvas(mutate: (canvas: Canvas) => void): Promise<Canvas> {
    return enqueue(async () => {
      const result = await this.commitInQueue('canvas.withCanvas', undefined, {}, mutate)
      return result.canvas
    })
  }

  /** 调用方必须已处于 enqueue 任务内，禁止嵌套入队。 */
  async persistInQueue(mutate: (canvas: Canvas) => void): Promise<Canvas> {
    const result = await this.commitInQueue('canvas.withCanvas', undefined, {}, mutate)
    return result.canvas
  }

  private async commitInQueue(
    type: string,
    payload: unknown,
    options: CanvasCommandOptions,
    mutate: (canvas: Canvas) => void | Promise<void>,
  ): Promise<CanvasCommandResult> {
    const current = await this.get()
    const id = options.commandId ?? commandId()
    if (id.trim() === '') throw errorWithCode('INVALID_ARGUMENT', 'commandId 不能为空')
    if (
      options.expectedRevision !== undefined
      && (!Number.isInteger(options.expectedRevision) || options.expectedRevision < 0)
    ) {
      throw errorWithCode('INVALID_ARGUMENT', 'expectedRevision 必须是不小于 0 的整数')
    }
    const hash = payload === undefined ? null : requestHash(type, payload)
    if (hash !== null) {
      const previous = current.receipts.find(receipt => receipt.commandId === id)
      if (previous) {
        if (previous.requestHash !== hash) {
          throw errorWithCode('CANVAS_COMMAND_CONFLICT', `commandId 已用于其他请求：${id}`)
        }
        return { canvas: current, receipt: previous, replayed: true }
      }
    }
    if (options.expectedRevision !== undefined && options.expectedRevision !== current.revision) {
      throw errorWithCode(
        'CANVAS_REVISION_CONFLICT',
        `画布 revision 冲突：expected=${options.expectedRevision}, current=${current.revision}`,
      )
    }

    const next = JSON.parse(JSON.stringify(current)) as Canvas
    await mutate(next)
    const finalHash = hash ?? requestHash(type, { before: current, after: next })
    const now = new Date()
    const revision = current.revision + 1
    const receipt: CanvasCommandReceipt = {
      commandId: id,
      type,
      requestHash: finalHash,
      revision,
      appliedAt: now.toISOString(),
    }
    next.schemaVersion = 3
    next.revision = revision
    next.receipts = [...current.receipts, receipt].slice(-100)
    next.updatedAt = now.toISOString()
    await writeCanvasAtomically(this.file(), next, now)
    this.cache = next
    for (const fn of this.listeners) fn(next)
    return { canvas: next, receipt, replayed: false }
  }

  subscribe(fn: CanvasChangeListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  reset(): void {
    this.cache = null
  }
}

export const canvasStore = new CanvasStore()
