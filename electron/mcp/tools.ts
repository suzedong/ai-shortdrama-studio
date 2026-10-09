// feature-017 · MCP 纯工具注册（主进程）
// 11 个零 LLM 工具：文件 / 画布 / 裁决门 / 资产 / ComfyUI 实例。
// 纪律：只 import zod、MCP SDK、shared types 与 fs/project/canvas/gate/asset/comfy 模块。
import path from 'node:path'
import fsp from 'node:fs/promises'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  AssetIndexItem, Canvas, ComfyInstance,
} from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { archiveExisting } from '../fs/archive.js'
import { resolveInside } from '../fs/sandbox.js'
import { getActiveProjectDir } from '../project/current.js'
import { canvasStore } from '../canvas/store.js'
import { gateBridge } from '../gate/bridge.js'
import { registerAsset, listAssets } from '../asset/index.js'
import { getComfyClient } from '../comfy/client.js'
import { listInstances, requireInstance } from '../comfy/settings.js'

type ToolErr = { ok: false; error: { code: string; message: string } }
type ToolResult<T> = ({ ok: true } & T) | ToolErr

function fail(code: string, message: string): ToolErr {
  return { ok: false, error: { code, message } }
}

function normalize(e: unknown): ToolErr {
  const code = (e as { code?: string }).code
  return fail(code ?? 'INTERNAL', (e as Error).message || '内部错误')
}

interface McpReturn {
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

function respond<T>(result: ToolResult<T>): McpReturn {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    isError: result.ok === false,
  }
}

export function registerPureTools(server: McpServer): void {
  // 1. file.read
  server.tool(
    'file.read',
    '读取项目目录内文本文件（utf-8）。',
    { path: z.string().min(1) },
    async (args: { path: string }) => {
      try {
        const abs = resolveInside(getActiveProjectDir(), args.path)
        const stat = await fsp.stat(abs)
        if (stat.isDirectory()) return respond(fail('INVALID_ARGUMENT', '目标是目录而非文件'))
        const text = await fsp.readFile(abs, 'utf-8')
        return respond<{ text: string }>({ ok: true, text })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 2. file.list
  server.tool(
    'file.list',
    '列出项目目录内一层（不递归），按名称排序。',
    { dir: z.string().optional() },
    async (args: { dir?: string }) => {
      try {
        const root = getActiveProjectDir()
        const dir = args.dir ? resolveInside(root, args.dir) : root
        const names = await fsp.readdir(dir)
        const entries = await Promise.all(
          names.map(async name => {
            const stat = await fsp.stat(path.join(dir, name))
            return { name, type: stat.isDirectory() ? ('dir' as const) : ('file' as const), mtime: stat.mtime.toISOString() }
          }),
        )
        entries.sort((a, b) => a.name.localeCompare(b.name))
        return respond<{ entries: typeof entries }>({ ok: true, entries })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 3. file.write
  server.tool(
    'file.write',
    '串行写入项目目录内文本文件；写前自动归档旧文件，自动建父目录。',
    { path: z.string().min(1), content: z.string() },
    async (args: { path: string; content: string }) => {
      try {
        const abs = resolveInside(getActiveProjectDir(), args.path)
        const archived = await enqueue(async () => {
          const moved = await archiveExisting(abs, new Date())
          await fsp.mkdir(path.dirname(abs), { recursive: true })
          await fsp.writeFile(abs, args.content, 'utf-8')
          return moved
        })
        return respond<{ path: string; archived: string[] }>({ ok: true, path: args.path, archived })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 4. canvas.get
  server.tool(
    'canvas.get',
    '获取当前项目画布（单一工作态）。',
    {},
    async () => {
      try {
        const canvas: Canvas = await canvasStore.get()
        return respond<{ canvas: Canvas }>({ ok: true, canvas })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 5. canvas.update
  server.tool(
    'canvas.update',
    '按 id upsert 画布节点 / 边（merge）；可经 linksTo 声明自动边。',
    {
      nodes: z
        .array(z.object({
          id: z.string().min(1),
          step: z.enum(['0', '1', '2', '3', '4', '5', '6', '7']),
          kind: z.string(),
          title: z.string(),
          status: z.enum(['pending', 'active', 'done', 'invalidated']),
          ref: z.object({ path: z.string(), format: z.enum(['json', 'md']) }).optional(),
          meta: z.record(z.string(), z.unknown()).optional(),
          updatedAt: z.string(),
          linksTo: z.array(z.string()).optional(),
        }))
        .optional(),
      edges: z.array(z.object({
        from: z.string(),
        to: z.string(),
        auto: z.boolean().optional(),
      })).optional(),
      mode: z.literal('merge').optional(),
    },
    async (args) => {
      try {
        const canvas = await canvasStore.update(args)
        return respond<{ canvas: Canvas }>({ ok: true, canvas })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 6. gate.request
  server.tool(
    'gate.request',
    '提交一个待人工裁决的门并阻塞等待结果。',
    {
      gateId: z.string().min(1),
      title: z.string().optional(),
      question: z.string().min(1),
      options: z.array(z.string()),
      payload: z.unknown().optional(),
    },
    async (args) => {
      try {
        const result = await gateBridge.request(args)
        return respond<{ decision: 'approved' | 'rejected'; note?: string }>(
          result.note ? { ok: true, decision: result.decision, note: result.note } : { ok: true, decision: result.decision },
        )
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 7. asset.register
  server.tool(
    'asset.register',
    '登记一个媒体 / 工作流资产（同 path+kind 幂等），文件可后产出。',
    {
      kind: z.enum(['image', 'video', 'music', 'workflow']),
      path: z.string().min(1),
      meta: z.record(z.string(), z.unknown()).optional(),
    },
    async (args) => {
      try {
        const { assetId } = await registerAsset({ kind: args.kind, path: args.path, meta: args.meta })
        return respond<{ assetId: string }>({ ok: true, assetId })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 8. asset.list
  server.tool(
    'asset.list',
    '列出已登记资产，可按类型过滤。',
    { kind: z.enum(['image', 'video', 'music', 'workflow']).optional() },
    async (args: { kind?: AssetIndexItem['kind'] }) => {
      try {
        const assets = await listAssets(args.kind)
        return respond<{ assets: AssetIndexItem[] }>({ ok: true, assets })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 9. comfyui.instances
  server.tool(
    'comfyui.instances',
    '列出已配置的本地 / 局域网 ComfyUI 实例。',
    async () => {
      try {
        const instances: ComfyInstance[] = await listInstances()
        return respond<{ instances: ComfyInstance[] }>({ ok: true, instances })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 10. comfyui.queue
  server.tool(
    'comfyui.queue',
    '向指定 ComfyUI 实例提交工作流任务（引擎接入前为占位）。',
    {
      instanceId: z.string().min(1),
      workflow: z.record(z.string(), z.unknown()),
      inputs: z.record(z.string(), z.unknown()).optional(),
    },
    async (args) => {
      try {
        await requireInstance(args.instanceId)
        const client = getComfyClient()
        if (!client) return respond(fail('INTERNAL', 'ComfyUI 引擎尚未接入（023）'))
        const { jobId } = await client.queue(args)
        return respond<{ jobId: string }>({ ok: true, jobId })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 11. comfyui.status
  server.tool(
    'comfyui.status',
    '查询指定 ComfyUI 任务状态与产物（引擎接入前为占位）。',
    { instanceId: z.string().min(1), jobId: z.string().min(1) },
    async (args) => {
      try {
        await requireInstance(args.instanceId)
        const client = getComfyClient()
        if (!client) return respond(fail('INTERNAL', 'ComfyUI 引擎尚未接入（023）'))
        const status = await client.status(args)
        return respond({ ok: true, ...status })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )
}
