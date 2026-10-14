// feature-017 · CanvasStore：内存投影 + canvas.json 落盘 + upsert + 订阅广播
import path from 'node:path'
import fsp from 'node:fs/promises'
import type { Canvas, CanvasEdge, CanvasGate } from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { archiveExisting } from '../fs/archive.js'
import { getActiveProjectDir } from '../project/current.js'
import { deriveAutoEdges, type CanvasUpsertNode } from './edges.js'

export interface CanvasUpdatePatch {
  nodes?: CanvasUpsertNode[]
  /** 直接 upsert 边（手动 / 自动均可），按 from/to 去重 */
  edges?: { from: string; to: string; auto?: boolean }[]
  mode?: 'merge'
}

export interface CanvasChangeListener {
  (canvas: Canvas): void
}

function emptyCanvas(root: string): Canvas {
  return {
    schemaVersion: 2,
    projectId: path.basename(root),
    title: '新项目',
    nodes: [],
    edges: [],
    gates: [],
    updatedAt: new Date().toISOString(),
  }
}

export class CanvasStore {
  private cache: Canvas | null = null
  private listeners = new Set<CanvasChangeListener>()

  private file(): string {
    return path.join(getActiveProjectDir(), 'canvas.json')
  }

  /** 懒加载：首次访问读 canvas.json；缺失则初始化空图并落盘 */
  async get(): Promise<Canvas> {
    if (this.cache) return this.cache
    const file = this.file()
    try {
      this.cache = JSON.parse(await fsp.readFile(file, 'utf-8')) as Canvas
    } catch {
      const init = emptyCanvas(path.dirname(file))
      await fsp.writeFile(file, JSON.stringify(init, null, 2), 'utf-8')
      this.cache = init
    }
    return this.cache
  }

  /** 门按 gateId upsert（仅 gate 链路使用）；写盘后广播 */
  async upsertGate(gate: CanvasGate): Promise<Canvas> {
    return this.persist(canvas => {
      const idx = canvas.gates.findIndex(g => g.gateId === gate.gateId)
      if (idx >= 0) canvas.gates[idx] = gate
      else canvas.gates.push(gate)
    })
  }

  /** 幂等 upsert 节点 / 边（merge） */
  async update(patch: CanvasUpdatePatch): Promise<Canvas> {
    return this.persist(canvas => {
      const upserts = patch.nodes ?? []
      for (const n of upserts) {
        const { linksTo: _linksTo, ...node } = n
        node.updatedAt = new Date().toISOString()
        const idx = canvas.nodes.findIndex(x => x.id === node.id)
        if (idx >= 0) {
          // feature-002 契约 §4.4：整体替换下保留血缘/脏态——
          // canvas.update 无 dirty 入口（zod 剥离），故恒沿用旧 dirty；
          // parentReference 未显式传入时沿用旧值，显式传入（定稿）则覆盖。
          const old = canvas.nodes[idx]!
          node.dirty = old.dirty
          if (node.parentReference === undefined) {
            node.parentReference = old.parentReference
          }
          canvas.nodes[idx] = node
        } else {
          canvas.nodes.push(node)
        }
      }
      if (upserts.length > 0) {
        canvas.edges = deriveAutoEdges(canvas.edges, upserts)
      }
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
    })
  }

  /**
   * feature-002：在同一次写盘内对画布做任意读-改-写（commit 多节点挂脏 +
   * brief 节点 upsert 合并，避免多份 canvas.json 归档）。自开写队列。
   */
  async withCanvas(mutate: (canvas: Canvas) => void): Promise<Canvas> {
    return this.persist(mutate)
  }

  /**
   * feature-002：同 persist 但**不再入队**——调用方必须已处于 enqueue 任务内，
   * 使 commit 的立项双写/影响清单/manifest/画布严格同队列（前序校验失败时零写盘）。
   */
  async persistInQueue(mutate: (canvas: Canvas) => void): Promise<Canvas> {
    const canvas = await this.get()
    const next: Canvas = JSON.parse(JSON.stringify(canvas)) as Canvas
    mutate(next)
    next.updatedAt = new Date().toISOString()
    const file = this.file()
    await archiveExisting(file, new Date())
    await fsp.writeFile(file, JSON.stringify(next, null, 2), 'utf-8')
    this.cache = next
    for (const fn of this.listeners) fn(next)
    return next
  }

  private persist(mutate: (canvas: Canvas) => void): Promise<Canvas> {
    return enqueue(() => this.persistInQueue(mutate))
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
