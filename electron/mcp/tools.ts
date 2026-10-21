// feature-017 / feature-001 / feature-801 / feature-802 / feature-002 / feature-807 / feature-005 / feature-006 · MCP 纯工具注册（主进程）
// 27 个零 LLM 工具：文件 / 画布 / 裁决门 / 资产 / ComfyUI 实例 / 立项单（brief.plan/publish/list）
//   / manifest 状态机（manifest.get/advance）/ 视觉风格谱系（17–19 style.catalog/get/validate）
//   / 立项后变更（20–22 brief.impact.assess/commit、canvas.align）
//   / 已捕获口径（23–25 capture.list/upsert/remove，feature-005）
//   / 公开数据检索（26–27 web.search/fetch，feature-006；零 Key 公开搜索源，不依赖激活项目）。
// feature-807：brief.publish 写盘前经 gate/guard 做门态防护（4 个 BRIEF_GATE_* 信封码，工具数不变）。
// 纪律：只 import zod、MCP SDK、shared types 与 fs/project/canvas/gate/asset/comfy/brief/capture 模块。
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
import { assertBriefPublishable, findBriefGate } from '../gate/guard.js'
import { registerAsset, listAssets } from '../asset/index.js'
import { getComfyClient } from '../comfy/client.js'
import { listInstances, requireInstance } from '../comfy/settings.js'
import { diffBrief } from '../brief/diff.js'
import { evaluateDraft, listBriefVersions } from '../brief/plan.js'
import { renderBriefMd } from '../brief/render-md.js'
import { publishV1InQueue, publishBriefFiles, type ReadyBriefDraft } from '../brief/publish.js'
import {
  readManifest, advanceManifest, parseManifest, applyBriefVersion, MANIFEST_FILE,
} from '../project/manifest.js'
import { assessImpact } from '../brief/impact.js'
import type { ImpactDecision, ImpactReportFile } from '../brief/impact.js'
import type { ManifestEvent } from '../../shared/types.js'
import { loadStyleCatalog } from '../style/loader.js'
import { validateStyleRefs } from '../style/validate.js'
import { captureStore } from '../capture/store.js'

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
          // feature-002 契约 §4.4：定稿血缘可经 update 写入；dirty 无入口（zod 剥离）
          parentReference: z.object({
            briefVersion: z.number().int().positive(),
            fields: z.array(z.string()),
          }).optional(),
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
      diagnosisDetail: z.string().optional(),
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
          diagnosisDetail: args.diagnosisDetail,
        }
        // feature-802：谱系装载失败直接阻断（R6），不降级为无校验旧行为
        const catalog = await loadStyleCatalog()
        const { missing, pendingMarks, styleIssues } = evaluateDraft(draft, catalog)
        const listing = await listBriefVersions(projectDir)
        const latestEntry = listing.versions[listing.versions.length - 1]
        const prev = latestEntry
          ? JSON.parse(await fsp.readFile(path.join(projectDir, latestEntry.path), 'utf-8')) as ProjectBrief
          : null
        return respond({
          ok: true as const,
          plan: {
            ready: missing.length === 0 && styleIssues.length === 0,
            missing,
            pendingMarks,
            styleIssues,
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
      diagnosisDetail: z.string().optional(),
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
          diagnosisDetail: args.diagnosisDetail,
        }

        // feature-802：谱系装载失败直接阻断（R6）；谱系问题并入 BRIEF_NOT_READY，不新增错误码
        const catalog = await loadStyleCatalog()
        const { missing, styleIssues } = evaluateDraft(draft, catalog)
        if (missing.length > 0 || styleIssues.length > 0) {
          const problems = [...missing.map(m => m.message), ...styleIssues.map(s => s.message)]
          return respond(fail('BRIEF_NOT_READY', `立项草案未就绪：${problems.join('；')}`))
        }
        if (args.approve.by === 'verbal' && !args.approve.verbal?.quote?.trim()) {
          return respond(fail('INVALID_ARGUMENT', '口头拍板必须记录用户原话'))
        }

        // feature-807：写盘前门态防护（B-14）。版本号与 publishV1InQueue 同源（publish.ts L48）
        const listing = await listBriefVersions(projectDir)
        const publishVersion = listing.latestVersion === null ? 1 : listing.latestVersion + 1
        const currentCanvas = await canvasStore.get()
        const violation = assertBriefPublishable(
          findBriefGate(currentCanvas.gates),
          args.approve,
          publishVersion,
        )
        if (violation) {
          return respond(fail(violation.code, violation.message))
        }

        // feature-002：发布主体抽 publish.ts（v1 行为逐字不变，另写 manifest.briefVersion=1）
        const written = await publishV1InQueue(projectDir, draft as ReadyBriefDraft, args.approve)

        // 画布节点 upsert（canvasStore.update 内部经同一全局 enqueue 串行，排在双写之后）
        const canvas = await canvasStore.update({ nodes: [written.briefNode] })

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

  // ── feature-801 manifest 状态机（15–16；零 LLM）──────────────────

  const manifestEventSchema = z.enum([
    'brief-published', 'outline-approved', 'profiles-approved',
    'scenes-approved', 'dialogue-approved', 'storyboard-finalized',
  ])

  // 15. manifest.get（只读：阶段状态指针）
  server.tool(
    'manifest.get',
    '读取当前项目 manifest 阶段状态（status / statusHistory）；不写文件。',
    {},
    async () => {
      try {
        const manifest = await readManifest()
        return respond({ ok: true as const, manifest })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 16. manifest.advance（读-改-写推进一格；不校验门状态、不碰 canvas、不归档）
  server.tool(
    'manifest.advance',
    '按定稿事件推进 manifest 状态机一格（initiating→…→storyboard-done）；重复事件幂等不写盘，乱序/终态报错。',
    { event: manifestEventSchema },
    async (args: { event: ManifestEvent }) => {
      try {
        const r = await advanceManifest(args.event)
        return respond({ ok: true as const, ...r })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // ── feature-802 视觉风格谱系（17–19；零 LLM、只读、不依赖激活项目）──────

  // 17. style.catalog（全量 18 条）
  server.tool(
    'style.catalog',
    '读取视觉风格谱系全表（4 形态 18 画风：ID/名称/家族/主备/可行度/辅助候选/视觉特征/锚点词/质感配方）与谱系版本。立项选型前调用。',
    {},
    async () => {
      try {
        const catalog = await loadStyleCatalog()
        return respond({
          ok: true as const,
          version: catalog.version,
          count: catalog.entries.length,
          entries: catalog.entries,
        })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 18. style.get（按 ID 查单条）
  server.tool(
    'style.get',
    '按风格 ID（如 A7、D1）查询单条谱系明细；ID 未知返 STYLE_ID_UNKNOWN。',
    { id: z.string().min(1) },
    async (args: { id: string }) => {
      try {
        const catalog = await loadStyleCatalog()
        const id = args.id.trim()
        const entry = catalog.entries.find(e => e.id === id)
        if (!entry) {
          return respond(fail(
            'STYLE_ID_UNKNOWN',
            `风格 ID「${id}」不在谱系（当前 ${catalog.version}，${catalog.entries.length} 项），请先用 style.catalog 选型`,
          ))
        }
        return respond({ ok: true as const, version: catalog.version, entry })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 19. style.validate（校验引用；业务问题不抛错）
  server.tool(
    'style.validate',
    '校验立项风格引用：主风格 ID 是否在谱系 18 项闭集、catalogVersion 是否与当前谱系逐字一致、辅助风格是否属封闭候选域（B1+D1–D5）。字段空/缺省不校验（非空由 brief.plan 的 missing 负责）；问题以 issues 返回，不抛业务错。',
    {
      mainStyleId: z.string().optional(),
      catalogVersion: z.string().optional(),
      auxiliaryStyleId: z.string().optional(),
    },
    async (args: { mainStyleId?: string; catalogVersion?: string; auxiliaryStyleId?: string }) => {
      try {
        const catalog = await loadStyleCatalog()
        const issues = validateStyleRefs(args, catalog)
        return respond({
          ok: true as const,
          valid: issues.length === 0,
          version: catalog.version,
          issues,
        })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // ── feature-002 立项后变更与影响评估（20–22；零 LLM；仅 showrunner 放行）──────

  const briefDraftSchema = z.object({
    kind: kindSchema,
    fiveElements: fiveElementsSchema,
    premise: premiseSchema,
    style: styleSchema,
    diagnosisSummary: z.string().optional(),
    diagnosisDetail: z.string().optional(),
  })
  const approveSchema = z.object({
    by: z.enum(['gate', 'verbal']),
    verbal: z.object({ quote: z.string().min(1) }).optional(),
    note: z.string().optional(),
  })

  // 20. brief.impact.assess（只读预评估：Δ → 分级影响清单；不装载谱系、不写盘）
  server.tool(
    'brief.impact.assess',
    '立项再版预评估：相对最新已发布立项单计算字段改动，追溯画布 done 节点血缘并给分级影响清单（高默认重生成、中默认仅标记）。零写盘。',
    { draft: briefDraftSchema },
    async (args: { draft: z.infer<typeof briefDraftSchema> }) => {
      try {
        const projectDir = getActiveProjectDir()
        const draft: BriefDraft = {
          kind: args.draft.kind,
          fiveElements: args.draft.fiveElements,
          premise: args.draft.premise,
          style: args.draft.style,
          diagnosisSummary: args.draft.diagnosisSummary,
          diagnosisDetail: args.draft.diagnosisDetail,
        }
        const listing = await listBriefVersions(projectDir)
        if (listing.latestVersion === null) {
          return respond(fail('BRIEF_NO_BASELINE', '尚无已发布立项，不存在再版基线；首版请走 brief.plan / brief.publish'))
        }
        const latestEntry = listing.versions[listing.versions.length - 1]!
        const prev = JSON.parse(
          await fsp.readFile(path.join(projectDir, latestEntry.path), 'utf-8'),
        ) as ProjectBrief
        const changes = diffBrief(prev, draft)
        const canvas = await canvasStore.get()
        const assessment = assessImpact(changes, canvas, listing.latestVersion)
        return respond({
          ok: true as const,
          fromVersion: assessment.fromVersion,
          toVersion: assessment.toVersion,
          changes,
          items: assessment.items,
          counts: assessment.counts,
          latestPublishedAt: prev.publishedAt,
        })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 21. brief.impact.commit（v2+ 发布：就绪闸门 → 复算影响 → decisions 恰好覆盖
  //     → 双写 + 影响清单 + manifest 指针 + 挂脏/brief 节点单次画布写）
  server.tool(
    'brief.impact.commit',
    '发布立项再版（v2+）：落盘 立项单.vN.json/md 与 影响清单.v(N-1)-vN.json，推进 manifest.briefVersion，按用户 decisions 给受影响节点挂脏；返回 regenerate 工作队列。',
    {
      draft: briefDraftSchema,
      approve: approveSchema,
      decisions: z.array(z.object({
        nodeId: z.string().min(1),
        decision: z.enum(['regenerate', 'mark']),
      })).min(0),
    },
    async (args: {
      draft: z.infer<typeof briefDraftSchema>
      approve: z.infer<typeof approveSchema>
      decisions: { nodeId: string; decision: ImpactDecision }[]
    }) => {
      try {
        const projectDir = getActiveProjectDir()
        const draft: BriefDraft = {
          kind: args.draft.kind,
          fiveElements: args.draft.fiveElements,
          premise: args.draft.premise,
          style: args.draft.style,
          diagnosisSummary: args.draft.diagnosisSummary,
          diagnosisDetail: args.draft.diagnosisDetail,
        }

        // 就绪闸门：装载谱系（802 纪律，失败三码不降级）+ evaluateDraft
        const catalog = await loadStyleCatalog()
        const { missing, styleIssues } = evaluateDraft(draft, catalog)
        if (missing.length > 0 || styleIssues.length > 0) {
          const problems = [...missing.map(m => m.message), ...styleIssues.map(s => s.message)]
          return respond(fail('BRIEF_NOT_READY', `立项草案未就绪：${problems.join('；')}`))
        }
        if (args.approve.by === 'verbal' && !args.approve.verbal?.quote?.trim()) {
          return respond(fail('INVALID_ARGUMENT', '口头拍板必须记录用户原话'))
        }

        // 全部读-改-写收进一次写队列
        const result = await enqueue(async () => {
          const listing = await listBriefVersions(projectDir)
          if (listing.latestVersion === null) {
            throw Object.assign(
              new Error('尚无已发布立项，不存在再版基线；首版请走 brief.publish'),
              { code: 'BRIEF_NO_BASELINE' },
            )
          }
          const fromVersion = listing.latestVersion
          const latestEntry = listing.versions[listing.versions.length - 1]!
          const prev = JSON.parse(
            await fsp.readFile(path.join(projectDir, latestEntry.path), 'utf-8'),
          ) as ProjectBrief

          // 复算影响（不信任 Agent 传入清单）
          const canvas0 = await canvasStore.get()
          const changes = diffBrief(prev, draft)
          const assessment = assessImpact(changes, canvas0, fromVersion)

          // decisions 必须恰好覆盖复算 items 全集
          const want = new Set(assessment.items.map(i => i.nodeId))
          const got = new Set(args.decisions.map(d => d.nodeId))
          const missingIds = [...want].filter(id => !got.has(id))
          const extraIds = [...got].filter(id => !want.has(id))
          const dup = args.decisions.length !== got.size
          if (missingIds.length > 0 || extraIds.length > 0 || dup) {
            const detail = [
              missingIds.length ? `缺少决策：${missingIds.join(', ')}` : '',
              extraIds.length ? `多余/未知节点：${extraIds.join(', ')}` : '',
              dup ? '存在重复 nodeId' : '',
            ].filter(Boolean).join('；')
            throw Object.assign(
              new Error(`决策集合与复算影响清单不一致（${detail}）`),
              { code: 'IMPACT_DECISION_MISMATCH' },
            )
          }
          const decisionByNode = new Map(args.decisions.map(d => [d.nodeId, d.decision]))

          // 立项单双写（版本防覆盖在 publishBriefFiles 内）
          const written = await publishBriefFiles(projectDir, draft as ReadyBriefDraft, args.approve)
          const toVersion = written.version
          const reportName = `影响清单.v${fromVersion}-v${toVersion}.json`
          const report: ImpactReportFile = {
            schemaVersion: 1,
            kind: 'brief-impact-report',
            fromVersion,
            toVersion,
            committedAt: new Date().toISOString(),
            changes,
            items: assessment.items.map(i => ({
              ...i,
              decision: decisionByNode.get(i.nodeId)!,
            })),
          }
          await fsp.writeFile(
            resolveInside(projectDir, reportName),
            JSON.stringify(report, null, 2),
            'utf-8',
          )

          // manifest 指针推进（不追加 statusHistory）
          const manifestAbs = path.join(projectDir, MANIFEST_FILE)
          const rawManifest = JSON.parse(await fsp.readFile(manifestAbs, 'utf-8'))
          const manifest = parseManifest(rawManifest, new Date().toISOString())
          const nextManifest = applyBriefVersion(manifest, toVersion, new Date().toISOString())
          await fsp.writeFile(manifestAbs, JSON.stringify(nextManifest, null, 2), 'utf-8')

          // 画布单次写：全部 item 挂脏（regenerate/mark 同挂）+ brief 节点 upsert
          const markedDirty = assessment.items.map(i => i.nodeId)
          const regenerate = assessment.items.filter(
            i => decisionByNode.get(i.nodeId) === 'regenerate',
          )
          const canvas = await canvasStore.persistInQueue(c => {
            for (const item of assessment.items) {
              const idx = c.nodes.findIndex(x => x.id === item.nodeId)
              if (idx < 0) continue // assess 候选来自当前画布，理论必在
              const old = c.nodes[idx]!
              c.nodes[idx] = {
                ...old,
                dirty: {
                  sinceBriefVersion: fromVersion,
                  latestBriefVersion: toVersion,
                  fields: item.fields,
                  severity: item.severity,
                  impactReport: reportName,
                },
              }
            }
            const bIdx = c.nodes.findIndex(x => x.id === written.briefNode.id)
            const { linksTo: _links, ...briefNode } = written.briefNode
            if (bIdx >= 0) c.nodes[bIdx] = briefNode
            else c.nodes.push(briefNode)
          })

          return {
            version: toVersion,
            jsonPath: written.jsonName,
            mdPath: written.mdName,
            impactReportPath: reportName,
            changes,
            items: assessment.items,
            markedDirty,
            regenerate,
            canvas,
          }
        })

        return respond({ ok: true as const, ...result })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 22. canvas.align（重生成定稿后清脏并推进血缘版本；无 dirty 幂等）
  server.tool(
    'canvas.align',
    '产物重生成定稿后对齐立项版本：清除节点 dirty、把 parentReference 推进到目标版本（默认当前 manifest.briefVersion）；节点无脏时幂等成功。',
    {
      nodeId: z.string().min(1),
      briefVersion: z.number().int().positive().optional(),
    },
    async (args: { nodeId: string; briefVersion?: number }) => {
      try {
        const manifest = await readManifest()
        const target = args.briefVersion ?? manifest.briefVersion
        if (target === null) {
          return respond(fail('BRIEF_NO_BASELINE', '当前项目尚无已发布立项，无法对齐版本'))
        }
        const result = await enqueue(async () => {
          const canvas0 = await canvasStore.get()
          const idx = canvas0.nodes.findIndex(x => x.id === args.nodeId)
          if (idx < 0) {
            throw Object.assign(
              new Error(`画布节点 ${args.nodeId} 不存在`),
              { code: 'CANVAS_NODE_NOT_FOUND' },
            )
          }
          const node = canvas0.nodes[idx]!
          if (!node.dirty) {
            return { nodeId: args.nodeId, briefVersion: target, alreadyAligned: true as const, canvas: canvas0 }
          }
          if (target <= node.dirty.sinceBriefVersion) {
            throw Object.assign(
              new Error(`目标版本 v${target} 不高于节点所基版本 v${node.dirty.sinceBriefVersion}，不允许倒退对齐`),
              { code: 'INVALID_ARGUMENT' },
            )
          }
          const fields = node.parentReference?.fields ?? node.dirty.fields
          const canvas = await canvasStore.persistInQueue(c => {
            const i = c.nodes.findIndex(x => x.id === args.nodeId)
            const old = c.nodes[i]!
            const { dirty: _dirty, ...rest } = old
            c.nodes[i] = {
              ...rest,
              parentReference: { briefVersion: target, fields },
              updatedAt: new Date().toISOString(),
            }
          })
          return { nodeId: args.nodeId, briefVersion: target, canvas }
        })
        return respond({ ok: true as const, ...result })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // ---- feature-005 · 已捕获口径（23–25；薄壳调 captureStore，与 IPC 同库同追溯）----

  // 23. capture.list
  server.tool(
    'capture.list',
    '读取当前项目「已捕获口径」全量（立项对话中持续累积的事实库；文件不存在返回空库）。',
    {},
    async () => {
      try {
        const file = await captureStore.list()
        return respond<{ file: typeof file }>({ ok: true, file })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 24. capture.upsert
  server.tool(
    'capture.upsert',
    '写入/更新一条已捕获口径：有 id 精确更新；无 id 按 topic（trim 精确匹配）更新或新建。新建缺省 source=\'infer\'（推断·待确认）；source=\'user\' 必须带 quote（用户逐字原句）。status 缺省推导 user→confirmed / infer→pending。',
    {
      id: z.string().min(1).optional(),
      topic: z.string().optional(),
      value: z.string().optional(),
      source: z.enum(['user', 'infer']).optional(),
      status: z.enum(['pending', 'confirmed']).optional(),
      quote: z.string().optional(),
    },
    async (args: {
      id?: string; topic?: string; value?: string
      source?: 'user' | 'infer'; status?: 'pending' | 'confirmed'; quote?: string
    }) => {
      try {
        const fact = await captureStore.upsert(args)
        return respond<{ fact: typeof fact }>({ ok: true, fact })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 25. capture.remove
  server.tool(
    'capture.remove',
    '按 id 删除一条已捕获口径（id 不存在报 CAPTURE_FACT_NOT_FOUND，零写盘）。',
    { id: z.string().min(1) },
    async (args: { id: string }) => {
      try {
        const result = await captureStore.remove(args.id)
        return respond<{ removed: true }>({ ok: true, ...result })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // ---- feature-006 · 公开数据检索（26–27；T0 定案 B：薄壳调下方纯函数，不依赖激活项目）----

  // 26. web.search
  server.tool(
    'web.search',
    '检索公开网页（选题诊断用；零 Key 公开搜索源，不依赖激活项目）。入参 query 检索词，返回 results（title/url/snippet 列表）；网络或搜索源失败报 WEB_SEARCH_FAILED。',
    { query: z.string().min(1) },
    async (args: { query: string }) => {
      try {
        const results = await webSearch(args.query)
        return respond<{ results: WebSearchResultItem[] }>({ ok: true, results })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )

  // 27. web.fetch
  server.tool(
    'web.fetch',
    '抓取公开网页并提取正文文本（超长截断保护；仅 http/https；不依赖激活项目）。入参 url，返回 text；抓取失败报 WEB_FETCH_FAILED。',
    { url: z.string().min(1) },
    async (args: { url: string }) => {
      try {
        const text = await webFetchText(args.url)
        return respond<{ text: string }>({ ok: true, text })
      } catch (e) {
        return respond(normalize(e))
      }
    },
  )
}

// ---- feature-006 · 公开数据检索纯函数（契约 §2.2 补登；零 Key 公开源 + 主进程原生 fetch，K9 零新依赖）----
// 导出供 src/test/web-tools.test.ts 直接单测；fetchImpl 依赖注入，单测零外网。

export const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) shortdrama-studio/1.0'
export const WEB_TIMEOUT_MS = 15_000
export const WEB_FETCH_MAX_CHARS = 20_000
const WEB_SEARCH_MAX_RESULTS = 8
const DDG_HTML_ENDPOINT = 'https://html.duckduckgo.com/html/'

type FetchImpl = typeof fetch

export interface WebSearchResultItem {
  title: string
  url: string
  snippet: string
}

/** 常见 HTML 实体解码（命名实体 + 十/十六进制数字实体；单层替换防二次展开） */
export function decodeHtmlEntities(s: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', middot: '·',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  }
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => named[name] ?? m)
}

/** HTML → 纯文本：去脚本/样式/注释/标签，实体解码，折叠空白 */
export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeHtmlEntities(stripped).replace(/\s+/g, ' ').trim()
}

/** 结果链接解码：`//duckduckgo.com/l/?uddg=<encoded>` 重定向取 uddg；仅放行 http/https 直链 */
function resolveDdgUrl(href: string): string | null {
  let u = href.trim()
  if (u.startsWith('//')) u = `https:${u}`
  try {
    const uddg = new URL(u).searchParams.get('uddg')
    if (uddg) u = uddg
  } catch {
    return null
  }
  return /^https?:\/\//i.test(u) ? u : null
}

/**
 * 解析 DuckDuckGo html 端点结果页：逐条 result__a 链接（uddg 解码）配对同区块 result__snippet 摘要。
 * 无法解码为 http/https 的条目剔除；不足 maxResults 条按实际返回。
 */
export function parseDdgResults(html: string, maxResults = WEB_SEARCH_MAX_RESULTS): WebSearchResultItem[] {
  const linkRe = /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const links = [...html.matchAll(linkRe)]
  const items: WebSearchResultItem[] = []
  for (let i = 0; i < links.length && items.length < maxResults; i++) {
    const link = links[i]
    const url = resolveDdgUrl(decodeHtmlEntities(link[1]))
    if (!url) continue
    const blockStart = (link.index ?? 0) + link[0].length
    const blockEnd = i + 1 < links.length ? (links[i + 1].index ?? html.length) : html.length
    const block = html.slice(blockStart, blockEnd)
    const snip = /<[a-z]+\b[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i.exec(block)
    items.push({ title: htmlToText(link[2]), url, snippet: snip ? htmlToText(snip[1]) : '' })
  }
  return items
}

/** 拉取页面 HTML（UA/超时/重定向统一在此；非 2xx 抛 HTTP 状态） */
async function fetchHtml(url: string, fetchImpl: FetchImpl): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { 'user-agent': WEB_UA, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** 公开网页检索：DuckDuckGo html 端点（零 Key）；网络/HTTP 失败一律报 WEB_SEARCH_FAILED */
export async function webSearch(query: string, fetchImpl: FetchImpl = fetch): Promise<WebSearchResultItem[]> {
  const q = query.trim()
  if (!q) throw Object.assign(new Error('检索词为空'), { code: 'INVALID_ARGUMENT' })
  let html: string
  try {
    html = await fetchHtml(`${DDG_HTML_ENDPOINT}?q=${encodeURIComponent(q)}`, fetchImpl)
  } catch (e) {
    throw Object.assign(new Error(`公开检索失败：${(e as Error).message}`), { code: 'WEB_SEARCH_FAILED' })
  }
  return parseDdgResults(html)
}

/** 公开网页抓取：仅 http/https，HTML→正文文本，超 maxChars 截断；失败一律报 WEB_FETCH_FAILED */
export async function webFetchText(
  url: string,
  fetchImpl: FetchImpl = fetch,
  maxChars = WEB_FETCH_MAX_CHARS,
): Promise<string> {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) throw Object.assign(new Error('仅支持 http/https 链接'), { code: 'INVALID_ARGUMENT' })
  let html: string
  try {
    html = await fetchHtml(u, fetchImpl)
  } catch (e) {
    throw Object.assign(new Error(`网页抓取失败：${(e as Error).message}`), { code: 'WEB_FETCH_FAILED' })
  }
  const text = htmlToText(html)
  return text.length > maxChars ? text.slice(0, maxChars) : text
}
