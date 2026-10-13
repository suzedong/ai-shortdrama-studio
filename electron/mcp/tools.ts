// feature-017 / feature-001 · MCP 纯工具注册（主进程）
// 14 个零 LLM 工具：文件 / 画布 / 裁决门 / 资产 / ComfyUI 实例 / 立项单（brief.plan/publish/list）。
// 纪律：只 import zod、MCP SDK、shared types 与 fs/project/canvas/gate/asset/comfy/brief 模块。
import path from 'node:path'
import fsp from 'node:fs/promises'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  AssetIndexItem, BriefDraft, Canvas, ComfyInstance, ProjectBrief,
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
import { diffBrief } from '../brief/diff.js'
import { evaluateDraft, listBriefVersions } from '../brief/plan.js'
import { renderBriefMd } from '../brief/render-md.js'

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

  // ── feature-001 立项单（12–14；零 LLM）──────────────────────

  const kindSchema = z.enum(['commercial', 'memorial'])
  const fiveElementsSchema = z.object({
    genre: z.string(),
    platforms: z.array(z.string()),
    episodeDuration: z.string(),
    episodeCount: z.string(),
    tone: z.string(),
    aspectRatio: z.string(),
  })
  const premiseSchema = z.object({
    leads: z.string(),
    time: z.string(),
    place: z.string(),
    coreEvent: z.string(),
    seasonBoundary: z.string(),
  })
  const styleSchema = z.object({
    mainStyleId: z.string(),
    catalogVersion: z.string(),
    auxiliaryStyleId: z.string().optional(),
  })

  // 12. brief.plan（只读：就绪校验 + 相对最新版 diff）
  server.tool(
    'brief.plan',
    '立项草案就绪检查（不写盘、不建门）：返回缺失项、待定点、下一版号与相对最新版改动。',
    {
      kind: kindSchema.nullable().optional(),
      fiveElements: fiveElementsSchema.partial().optional(),
      premise: premiseSchema.partial().optional(),
      style: styleSchema.partial().optional(),
      diagnosisSummary: z.string().optional(),
    },
    async (args) => {
      try {
        const projectDir = getActiveProjectDir()
        const draft: BriefDraft = {
          kind: args.kind ?? null,
          fiveElements: args.fiveElements ?? {},
          premise: args.premise ?? {},
          style: args.style ?? {},
          diagnosisSummary: args.diagnosisSummary,
        }
        const { missing, pendingMarks } = evaluateDraft(draft)
        const listing = await listBriefVersions(projectDir)
        const latestEntry = listing.versions[listing.versions.length - 1]
        const prev = latestEntry
          ? JSON.parse(await fsp.readFile(path.join(projectDir, latestEntry.path), 'utf-8')) as ProjectBrief
          : null
        return respond({
          ok: true as const,
          plan: {
            ready: missing.length === 0,
            missing,
            pendingMarks,
            nextVersion: listing.latestVersion === null ? 1 : listing.latestVersion + 1,
            changesFromPrevious: diffBrief(prev, draft),
            latestVersion: listing.latestVersion,
          },
        })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 13. brief.publish（版本化双写 + upsert step-0-brief 节点）
  server.tool(
    'brief.publish',
    '发布立项单：版本号按磁盘实况分配，双写 立项单.vN.json/md（永不覆盖、不归档），并 upsert 画布 step-0-brief 节点。',
    {
      kind: kindSchema,
      fiveElements: fiveElementsSchema,
      premise: premiseSchema,
      style: styleSchema,
      diagnosisSummary: z.string().optional(),
      approve: z.object({
        by: z.enum(['gate', 'verbal']),
        verbal: z.object({ quote: z.string() }).optional(),
        note: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const projectDir = getActiveProjectDir()
        const draft: BriefDraft = {
          kind: args.kind,
          fiveElements: args.fiveElements,
          premise: args.premise,
          style: args.style,
          diagnosisSummary: args.diagnosisSummary,
        }

        const { missing } = evaluateDraft(draft)
        if (missing.length > 0) {
          return respond(fail('BRIEF_NOT_READY', `立项草案未就绪：${missing.map(m => m.message).join('；')}`))
        }
        if (args.approve.by === 'verbal' && !args.approve.verbal?.quote?.trim()) {
          return respond(fail('INVALID_ARGUMENT', '口头拍板必须记录用户原话'))
        }

        // 版本号分配与双写在单写队列内串行，防并发撞号
        const written = await enqueue(async () => {
          const listing = await listBriefVersions(projectDir)
          const version = listing.latestVersion === null ? 1 : listing.latestVersion + 1
          const jsonName = `立项单.v${version}.json`
          const mdName = `立项单.v${version}.md`
          const jsonAbs = resolveInside(projectDir, jsonName)
          const mdAbs = resolveInside(projectDir, mdName)

          // 理论上不可能（版本号磁盘扫描分配）；命中即拒，绝不覆盖
          const [jsonExists, mdExists] = await Promise.all([
            fsp.access(jsonAbs).then(() => true, () => false),
            fsp.access(mdAbs).then(() => true, () => false),
          ])
          if (jsonExists || mdExists) {
            throw Object.assign(new Error(`${jsonExists ? jsonName : mdName} 已存在`), { code: 'BRIEF_VERSION_EXISTS' })
          }

          const prevEntry = listing.versions[listing.versions.length - 1]
          const prev = prevEntry
            ? JSON.parse(await fsp.readFile(path.join(projectDir, prevEntry.path), 'utf-8')) as ProjectBrief
            : null
          const now = new Date().toISOString()
          const brief: ProjectBrief = {
            schemaVersion: 2,
            version,
            kind: args.kind,
            fiveElements: args.fiveElements,
            premise: args.premise,
            style: args.style,
            approve: {
              at: now,
              by: args.approve.by,
              ...(args.approve.verbal ? { verbal: args.approve.verbal } : {}),
              ...(args.approve.note ? { note: args.approve.note } : {}),
            },
            changesFromPrevious: diffBrief(prev, draft),
            publishedAt: now,
            ...(args.diagnosisSummary?.trim() ? { diagnosisSummary: args.diagnosisSummary } : {}),
          }

          await fsp.writeFile(jsonAbs, JSON.stringify(brief, null, 2), 'utf-8')
          await fsp.writeFile(mdAbs, renderBriefMd(brief), 'utf-8')
          return { version, jsonName, mdName, changesFromPrevious: brief.changesFromPrevious }
        })

        // 画布节点 upsert（canvasStore.update 内部经同一全局 enqueue 串行，排在双写之后）
        const canvas = await canvasStore.update({
          nodes: [{
            id: 'step-0-brief',
            step: '0',
            kind: 'brief',
            title: `立项单 v${written.version}`,
            status: 'done',
            ref: { path: written.jsonName, format: 'json' as const },
            meta: { version: `v${written.version}` },
            updatedAt: new Date().toISOString(),
            linksTo: [],
          }],
        })

        return respond({
          ok: true as const,
          version: written.version,
          jsonPath: written.jsonName,
          mdPath: written.mdName,
          changesFromPrevious: written.changesFromPrevious,
          canvas,
        })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 14. brief.list（只读：列全部已发布版本）
  server.tool(
    'brief.list',
    '列出当前项目根全部已发布立项单（立项单.vN.json），按版本升序；损坏文件跳过并在 warnings 注明。',
    {},
    async () => {
      try {
        const r = await listBriefVersions(getActiveProjectDir())
        return respond({ ok: true as const, ...r })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )
}
