import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import type {
  Canvas,
  CanvasCommandReceipt,
  CanvasCommandRequest,
  CanvasCommandResult,
  CanvasDocument,
  CanvasEdge,
  CanvasGate,
  CanvasNode,
  CanvasPage,
  CanvasPosition,
  CanvasTarget,
  CanvasViewStateRequest,
  CanvasViewStateResult,
  CanvasViewport,
} from '../../shared/types.js'
import { getActiveProjectDir } from '../project/current.js'
import { deriveAutoEdges, type CanvasUpsertNode } from './edges.js'
import { enqueue } from '../fs/write-queue.js'
import { copyExistingToArchive } from '../fs/archive.js'
import { listAssets } from '../asset/index.js'

export interface CanvasUpdatePatch {
  nodes?: CanvasUpsertNode[]
  /** 直接 upsert 边（手动 / 自动均可），按 from/to 去重。 */
  edges?: { from: string; to: string; auto?: boolean }[]
  mode?: 'merge'
}

export interface CanvasCommandOptions {
  commandId?: string
  expectedRevision?: number
}

export interface CanvasTransactionResult extends CanvasCommandResult {
  replayed: boolean
}

export interface CanvasContext {
  projectDir: string
  target: CanvasTarget
  canvas: Canvas
}

type CanvasListener = (canvas: Canvas) => void
type CanvasMutator = (canvas: Canvas, document: CanvasDocument) => void | Promise<void>

const LEGACY_PAGE_ID = 'legacy-page'
const LEGACY_CANVAS_ID = 'legacy-canvas'
const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.6

function errorWithCode(code: string, message: string, cause?: unknown): Error {
  return Object.assign(new Error(message), { name: code, code, cause })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function validPosition(value: unknown): value is CanvasPosition {
  return isRecord(value)
    && typeof value.x === 'number' && Number.isFinite(value.x)
    && typeof value.y === 'number' && Number.isFinite(value.y)
}

function validViewport(value: unknown): value is CanvasViewport {
  return isRecord(value)
    && typeof value.x === 'number' && Number.isFinite(value.x)
    && typeof value.y === 'number' && Number.isFinite(value.y)
    && typeof value.zoom === 'number' && Number.isFinite(value.zoom)
    && value.zoom >= MIN_ZOOM && value.zoom <= MAX_ZOOM
}

function validTitle(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 80
}

function validateReceipts(value: unknown, revision: number): asserts value is CanvasCommandReceipt[] {
  if (!Array.isArray(value)) throw errorWithCode('CANVAS_CORRUPT', '画布 receipts 结构损坏')
  const ids = new Set<string>()
  for (const receipt of value) {
    if (
      !isRecord(receipt)
      || typeof receipt.commandId !== 'string' || receipt.commandId.length === 0
      || typeof receipt.type !== 'string' || receipt.type.length === 0
      || typeof receipt.requestHash !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.requestHash)
      || !validRevision(receipt.revision) || receipt.revision > revision
      || typeof receipt.appliedAt !== 'string'
      || ids.has(receipt.commandId)
    ) {
      throw errorWithCode('CANVAS_CORRUPT', '画布命令回执无效')
    }
    ids.add(receipt.commandId)
  }
}

function validateDocument(document: unknown): asserts document is CanvasDocument {
  if (
    !isRecord(document)
    || typeof document.id !== 'string' || document.id.length === 0
    || !validTitle(document.title) || document.title !== document.title.trim()
    || !Array.isArray(document.nodes)
    || !Array.isArray(document.edges)
    || !(document.viewport === null || validViewport(document.viewport))
  ) {
    throw errorWithCode('CANVAS_CORRUPT', '画布文档结构或 viewport 无效')
  }
  const nodeIds = new Set<string>()
  for (const node of document.nodes) {
    if (
      !isRecord(node)
      || typeof node.id !== 'string' || node.id.length === 0
      || nodeIds.has(node.id)
      || (node.position !== undefined && !validPosition(node.position))
      || typeof node.updatedAt !== 'string'
    ) {
      throw errorWithCode('CANVAS_CORRUPT', '画布节点、重复 ID 或 position 无效')
    }
    nodeIds.add(node.id)
  }
  const edgeIds = new Set<string>()
  for (const edge of document.edges) {
    if (
      !isRecord(edge)
      || typeof edge.id !== 'string' || edge.id.length === 0
      || typeof edge.from !== 'string' || typeof edge.to !== 'string'
      || edgeIds.has(edge.id)
    ) {
      throw errorWithCode('CANVAS_CORRUPT', '画布边或重复 ID 无效')
    }
    edgeIds.add(edge.id)
  }
}

function validateCanvas(canvas: Canvas): void {
  if (
    canvas.schemaVersion !== 4
    || typeof canvas.projectId !== 'string' || canvas.projectId.length === 0
    || typeof canvas.title !== 'string'
    || (canvas.activeView !== 'canvas' && canvas.activeView !== 'stage0')
    || !Array.isArray(canvas.pages) || canvas.pages.length === 0
    || !Array.isArray(canvas.gates)
    || !validRevision(canvas.revision)
    || typeof canvas.updatedAt !== 'string'
  ) {
    throw errorWithCode('CANVAS_CORRUPT', '画布 v4 根结构无效')
  }
  validateReceipts(canvas.receipts, canvas.revision)
  const pageIds = new Set<string>()
  let activePage: CanvasPage | undefined
  for (const page of canvas.pages) {
    if (
      !isRecord(page)
      || typeof page.id !== 'string' || page.id.length === 0 || pageIds.has(page.id)
      || !validTitle(page.title) || page.title !== page.title.trim()
      || !Array.isArray(page.canvases) || page.canvases.length === 0
    ) {
      throw errorWithCode('CANVAS_CORRUPT', '创作页结构或重复 ID 无效')
    }
    pageIds.add(page.id)
    if (page.id === canvas.activePageId) activePage = page
    const canvasIds = new Set<string>()
    let activeFound = false
    for (const document of page.canvases) {
      validateDocument(document)
      if (canvasIds.has(document.id)) throw errorWithCode('CANVAS_CORRUPT', '同一创作页存在重复画布 ID')
      canvasIds.add(document.id)
      if (document.id === page.activeCanvasId) activeFound = true
    }
    if (!activeFound) throw errorWithCode('CANVAS_CORRUPT', '创作页 activeCanvasId 失配')
  }
  if (!activePage) throw errorWithCode('CANVAS_CORRUPT', 'activePageId 失配')
}

function emptyCanvas(projectId: string): Canvas {
  const canvasId = `canvas-${crypto.randomUUID()}`
  const pageId = `page-${crypto.randomUUID()}`
  return {
    schemaVersion: 4,
    projectId,
    title: '新项目',
    activePageId: pageId,
    activeView: 'stage0',
    pages: [{
      id: pageId,
      title: '创作页 1',
      activeCanvasId: canvasId,
      canvases: [{ id: canvasId, title: '画布 1', nodes: [], edges: [], viewport: null }],
    }],
    gates: [],
    revision: 0,
    receipts: [],
    updatedAt: new Date().toISOString(),
  }
}

function migrateLegacy(raw: Record<string, unknown>): Canvas {
  const version = raw.schemaVersion
  if (
    (version !== 2 && version !== 3)
    || typeof raw.projectId !== 'string'
    || typeof raw.title !== 'string'
    || !Array.isArray(raw.nodes)
    || !Array.isArray(raw.edges)
    || !Array.isArray(raw.gates)
    || typeof raw.updatedAt !== 'string'
  ) {
    throw errorWithCode('CANVAS_CORRUPT', '旧画布文件结构或 schemaVersion 不受支持')
  }
  const revision = version === 3 ? raw.revision : 0
  const receipts = version === 3 ? raw.receipts : []
  if (!validRevision(revision)) throw errorWithCode('CANVAS_CORRUPT', '旧画布 revision 无效')
  validateReceipts(receipts, revision)
  const nodes = clone(raw.nodes) as CanvasNode[]
  for (const node of nodes) {
    if (node.position !== undefined && !validPosition(node.position)) {
      throw errorWithCode('CANVAS_CORRUPT', '旧画布节点 position 无效')
    }
  }
  return {
    schemaVersion: 4,
    projectId: raw.projectId,
    title: raw.title,
    activePageId: LEGACY_PAGE_ID,
    activeView: nodes.length > 0 ? 'canvas' : 'stage0',
    pages: [{
      id: LEGACY_PAGE_ID,
      title: '创作页 1',
      activeCanvasId: LEGACY_CANVAS_ID,
      canvases: [{
        id: LEGACY_CANVAS_ID,
        title: '画布 1',
        nodes,
        edges: clone(raw.edges) as CanvasEdge[],
        viewport: null,
      }],
    }],
    gates: clone(raw.gates) as CanvasGate[],
    revision,
    receipts: clone(receipts),
    updatedAt: raw.updatedAt,
  }
}

function migrateCanvas(raw: unknown): Canvas {
  if (!isRecord(raw)) throw errorWithCode('CANVAS_CORRUPT', '画布文件不是 JSON 对象')
  if (raw.schemaVersion === 2 || raw.schemaVersion === 3) return migrateLegacy(raw)
  if (raw.schemaVersion !== 4) throw errorWithCode('CANVAS_CORRUPT', '画布 schemaVersion 不受支持')
  const canvas = clone(raw) as unknown as Canvas
  validateCanvas(canvas)
  return canvas
}

export function activeCanvasDocument(canvas: Canvas): CanvasDocument {
  const page = canvas.pages.find(item => item.id === canvas.activePageId)
  const document = page?.canvases.find(item => item.id === page.activeCanvasId)
  if (!page || !document) throw errorWithCode('CANVAS_CORRUPT', '活动创作页或画布引用失配')
  return document
}

function documentAt(canvas: Canvas, target: CanvasTarget): CanvasDocument {
  const page = canvas.pages.find(item => item.id === target.pageId)
  const document = page?.canvases.find(item => item.id === target.canvasId)
  if (!page || !document) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标创作页或画布不存在')
  return document
}

function targetOf(canvas: Canvas): CanvasTarget {
  const page = canvas.pages.find(item => item.id === canvas.activePageId)
  if (!page) throw errorWithCode('CANVAS_CORRUPT', 'activePageId 失配')
  return { projectId: canvas.projectId, pageId: page.id, canvasId: page.activeCanvasId }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function sortedAssetIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b))
}

function nodeVersion(node: CanvasNode | undefined): string | null {
  const version = node?.meta?.version
  return typeof version === 'string' && version.trim().length > 0 ? version : null
}

function scanRepublishedReferences(
  canvas: Canvas,
  source: CanvasTarget,
  artifactId: string,
  latestVersion: string,
  markedAt: string,
): void {
  for (const page of canvas.pages) {
    for (const document of page.canvases) {
      for (const node of document.nodes) {
        const reference = node.reference
        if (
          !reference || reference.artifactId !== artifactId
          || reference.source.projectId !== source.projectId
          || reference.source.pageId !== source.pageId
          || reference.source.canvasId !== source.canvasId
        ) continue
        reference.latestVersion = latestVersion
        if (reference.version === latestVersion) delete reference.markedAt
        else reference.markedAt = markedAt
      }
    }
  }
}

function commandPayload(request: CanvasCommandRequest): Record<string, unknown> {
  const { commandId: _commandId, expectedRevision: _expectedRevision, ...payload } = request
  if (request.type === 'assets.bind' || request.type === 'assets.unbind') {
    return { ...payload, assetIds: sortedAssetIds(request.assetIds) }
  }
  return payload
}

function requestHash(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex')
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

function transactionHash(type: string, payload: unknown): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stableValue({ type, payload })))
    .digest('hex')
}

function legacyAssetHash(request: Extract<CanvasCommandRequest, { type: 'assets.bind' | 'assets.unbind' }>): string {
  return transactionHash(request.type, {
    nodeId: request.nodeId,
    assetIds: [...new Set(request.assetIds)].sort(),
  })
}

function receiptTarget(receipt: CanvasCommandReceipt): CanvasTarget | null {
  if (!isRecord(receipt.payload) || !isRecord(receipt.payload.target)) return null
  const target = receipt.payload.target
  if (
    typeof target.projectId !== 'string'
    || typeof target.pageId !== 'string'
    || typeof target.canvasId !== 'string'
  ) return null
  return { projectId: target.projectId, pageId: target.pageId, canvasId: target.canvasId }
}

function requestTarget(
  canvas: Canvas,
  request: CanvasCommandRequest,
  preparedTarget: CanvasTarget | null,
): CanvasTarget {
  if (preparedTarget) return preparedTarget
  const projectId = canvas.projectId
  if (request.type === 'page.rename' || request.type === 'page.delete') {
    const page = canvas.pages.find(item => item.id === request.pageId)
    if (!page) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标创作页不存在')
    return { projectId, pageId: page.id, canvasId: page.activeCanvasId }
  }
  if (request.type === 'page.create' || request.type === 'canvas.create') {
    throw errorWithCode('CANVAS_COMMAND_MUTATION', '新建命令回执缺少目标')
  }
  if (request.type === 'reference.create') return clone(request.target)
  return { projectId, pageId: request.pageId, canvasId: request.canvasId }
}

function assertProject(request: { projectId: string }, projectDir: string): void {
  if (request.projectId !== path.basename(projectDir)) {
    throw errorWithCode('CANVAS_PROJECT_MISMATCH', '命令项目与当前项目不一致')
  }
}

function normalizeTitle(title: string | undefined, existing: string[], prefix: string): string {
  if (title !== undefined) {
    if (!validTitle(title)) throw errorWithCode('CANVAS_INVALID_TITLE', '标题 trim 后须为 1–80 个字符')
    return title.trim()
  }
  const used = new Set(existing)
  for (let index = 1; ; index++) {
    const candidate = `${prefix} ${index}`
    if (!used.has(candidate)) return candidate
  }
}

async function writeAtomic(file: string, canvas: Canvas): Promise<void> {
  const temp = path.join(path.dirname(file), `.canvas.${process.pid}.${crypto.randomUUID()}.tmp`)
  try {
    const handle = await fsp.open(temp, 'wx')
    try {
      await handle.writeFile(JSON.stringify(canvas, null, 2), 'utf-8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await copyExistingToArchive(file, new Date())
    await fsp.rename(temp, file)
  } catch (error) {
    await fsp.rm(temp, { force: true }).catch(() => {})
    const detail = error instanceof Error ? error.message : String(error)
    throw errorWithCode('CANVAS_COMMAND_MUTATION', `画布原子写失败，旧档与缓存保持不变：${detail}`, error)
  }
}

export class CanvasStore {
  private cache = new Map<string, Canvas>()
  private listeners = new Set<CanvasListener>()

  subscribe(listener: CanvasListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  reset(projectDir = getActiveProjectDir()): void {
    this.cache.delete(path.resolve(projectDir))
  }

  private file(projectDir: string): string {
    return path.join(projectDir, 'canvas.json')
  }

  private async readFromDisk(root: string, expectedProjectId = path.basename(root)): Promise<Canvas | null> {
    let raw: string | null
    try {
      raw = await fsp.readFile(this.file(root), 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') raw = null
      else throw error
    }
    if (raw === null) return null
    let canvas: Canvas
    try {
      canvas = migrateCanvas(JSON.parse(raw) as unknown)
    } catch (error) {
      if ((error as { code?: string }).code === 'CANVAS_CORRUPT') throw error
      throw errorWithCode('CANVAS_CORRUPT', '画布文件损坏，已停止加载；请修复或从归档恢复', error)
    }
    if (canvas.projectId !== expectedProjectId) {
      throw errorWithCode('CANVAS_PROJECT_MISMATCH', '画布 projectId 与项目目录或包元数据不一致')
    }
    return canvas
  }

  /** 打开项目前只读预检：不创建缺失画布、不信任或填充缓存。 */
  async assertReadable(projectDir: string, expectedProjectId = path.basename(path.resolve(projectDir))): Promise<void> {
    await this.readFromDisk(path.resolve(projectDir), expectedProjectId)
  }

  private async getForRoot(projectDir: string): Promise<Canvas> {
    const root = path.resolve(projectDir)
    const cached = this.cache.get(root)
    if (cached) return clone(cached)
    const diskCanvas = await this.readFromDisk(root)
    const canvas = diskCanvas ?? emptyCanvas(path.basename(root))
    if (diskCanvas === null) await writeAtomic(this.file(root), canvas)
    this.cache.set(root, clone(canvas))
    return clone(canvas)
  }

  async capture(): Promise<CanvasContext> {
    const projectDir = path.resolve(getActiveProjectDir())
    const canvas = await this.getForRoot(projectDir)
    return { projectDir, target: targetOf(canvas), canvas }
  }

  async get(): Promise<Canvas> {
    return (await this.capture()).canvas
  }

  private async commitInQueue(
    context: CanvasContext,
    type: string,
    payload: unknown,
    options: CanvasCommandOptions,
    mutate: CanvasMutator,
  ): Promise<CanvasTransactionResult> {
    const baseline = await this.getForRoot(context.projectDir)
    const commandId = options.commandId ?? crypto.randomUUID()
    const requestHash = payload === undefined ? null : transactionHash(type, payload)
    const receipt = [...baseline.receipts].reverse().find(item => item.commandId === commandId)
    if (receipt) {
      if (
        options.expectedRevision !== undefined
        && options.expectedRevision !== receipt.revision
      ) {
        throw errorWithCode('CANVAS_REVISION_CONFLICT', '重放时 expectedRevision 须等于原命令产生的 revision')
      }
      if (requestHash !== null && receipt.requestHash !== requestHash) {
        throw errorWithCode('CANVAS_COMMAND_CONFLICT', 'commandId 已被不同 payload 使用')
      }
      return {
        ok: true,
        commandId,
        revision: baseline.revision,
        receipt: clone(receipt),
        target: context.target,
        canvas: clone(baseline),
        replayed: true,
      }
    }
    if (options.expectedRevision !== undefined && baseline.revision !== options.expectedRevision) {
      throw errorWithCode(
        'CANVAS_REVISION_CONFLICT',
        `画布版本冲突：期望 ${options.expectedRevision}，实际 ${baseline.revision}`,
      )
    }
    const previousVersions = new Map(
      documentAt(baseline, context.target).nodes.map(node => [node.id, nodeVersion(node)] as const),
    )
    const next = clone(baseline)
    const document = documentAt(next, context.target)
    await mutate(next, document)
    const sourcePage = next.pages.find(page => page.id === context.target.pageId)
    const sourceDocument = sourcePage?.canvases.find(item => item.id === context.target.canvasId)
    if (sourceDocument) {
      const markedAt = new Date().toISOString()
      for (const node of sourceDocument.nodes) {
        const previousVersion = previousVersions.get(node.id)
        const latestVersion = nodeVersion(node)
        if (previousVersion !== null && previousVersion !== undefined && latestVersion !== null && previousVersion !== latestVersion) {
          scanRepublishedReferences(next, context.target, node.id, latestVersion, markedAt)
        }
      }
    }
    const nextReceipt: CanvasCommandReceipt = {
      commandId,
      type,
      requestHash: requestHash ?? transactionHash(type, next),
      revision: next.revision + 1,
      appliedAt: new Date().toISOString(),
    }
    next.revision = nextReceipt.revision
    next.receipts = [...next.receipts, nextReceipt].slice(-100)
    next.updatedAt = new Date().toISOString()
    validateCanvas(next)
    await writeAtomic(this.file(context.projectDir), next)
    this.cache.set(context.projectDir, clone(next))
    for (const listener of this.listeners) listener(clone(next))
    return {
      ok: true,
      commandId,
      revision: next.revision,
      receipt: clone(nextReceipt),
      target: context.target,
      canvas: clone(next),
      replayed: false,
    }
  }

  /** MCP merge：只更新调用入口固定的活动文档，保留其余页/画布及根状态。 */
  async update(patch: CanvasUpdatePatch): Promise<Canvas> {
    return (await this.updateWithCommand(patch)).canvas
  }

  /** MCP 既有乐观锁/幂等事务接口；读评估与写提交可共享同一 CanvasContext。 */
  async updateWithCommand(
    patch: CanvasUpdatePatch,
    options: CanvasCommandOptions = {},
  ): Promise<CanvasTransactionResult> {
    const context = await this.capture()
    return enqueue(() => this.commitInQueue(context, 'canvas.update', patch, options, (_canvas, document) => {
      this.applyUpdate(document, patch)
    }))
  }

  /** 同一次写盘内读-改-写；第二参数为入口固定的活动文档。 */
  async withCanvas(mutate: CanvasMutator): Promise<Canvas> {
    const context = await this.capture()
    return enqueue(() => this.commitInQueue(context, 'canvas.withCanvas', undefined, {}, mutate))
      .then(result => result.canvas)
  }

  /** 调用方必须已处于 enqueue 任务内；传入 capture() 可保证评估与写入同一目标。 */
  async persistInQueue(mutate: CanvasMutator, captured?: CanvasContext): Promise<Canvas> {
    const context = captured ?? await this.capture()
    return (await this.commitInQueue(context, 'canvas.update', undefined, {}, mutate)).canvas
  }

  private applyUpdate(
    document: CanvasDocument,
    patch: CanvasUpdatePatch,
  ): void {
    const upserts = patch.nodes ?? []
    for (const input of upserts) {
      const { linksTo: _linksTo, reference: _reference, ...source } = input
      const idx = document.nodes.findIndex(item => item.id === source.id)
      const old = idx >= 0 ? document.nodes[idx] : undefined
      if (source.position !== undefined && !validPosition(source.position)) {
        throw errorWithCode('CANVAS_INVALID_POSITION', '节点 position 必须为有限世界坐标')
      }
      const node = {
        ...source,
        position: source.position === undefined ? old?.position : source.position,
        updatedAt: new Date().toISOString(),
      } as CanvasNode
      if (node.assetIds !== undefined) node.assetIds = [...new Set(node.assetIds)]
      if (old) {
        node.dirty = old.dirty
        if (old.reference !== undefined) node.reference = old.reference
        if (node.parentReference === undefined) node.parentReference = old.parentReference
        if (node.assetIds === undefined) node.assetIds = old.assetIds
        document.nodes[idx] = node
      } else {
        if (node.position === undefined) delete node.position
        document.nodes.push(node)
      }
    }
    if (upserts.length > 0) document.edges = deriveAutoEdges(document.edges, upserts)
    for (const input of patch.edges ?? []) {
      const idx = document.edges.findIndex(item => item.from === input.from && item.to === input.to)
      const edge: CanvasEdge = {
        id: `e-${input.from}--${input.to}`,
        from: input.from,
        to: input.to,
        auto: input.auto ?? false,
      }
      if (idx >= 0) document.edges[idx] = edge
      else document.edges.push(edge)
    }
  }

  /** 结构、节点移动与资产命令：revision + receipts + 原子写。 */
  async command(request: CanvasCommandRequest): Promise<CanvasCommandResult> {
    const context = await this.capture()
    if (request.type === 'reference.create') {
      const projectId = path.basename(context.projectDir)
      if (
        request.projectId !== projectId
        || request.target.projectId !== projectId
        || request.source.target.projectId !== projectId
      ) throw errorWithCode('PROJECT_MISMATCH', '引用目标、来源与命令项目必须属于当前项目')
    } else {
      assertProject(request, context.projectDir)
    }
    if (typeof request.commandId !== 'string' || request.commandId.length === 0 || !validRevision(request.expectedRevision)) {
      throw errorWithCode('CANVAS_COMMAND_MUTATION', '命令 commandId 或 expectedRevision 无效')
    }
    const payload = commandPayload(request)
    const hash = requestHash(payload)
    let preparedTarget: CanvasTarget | null = null
    if (request.type === 'page.create') {
      const pageId = `page-${crypto.randomUUID()}`
      preparedTarget = { projectId: context.canvas.projectId, pageId, canvasId: `canvas-${crypto.randomUUID()}` }
    } else if (request.type === 'canvas.create') {
      preparedTarget = { projectId: context.canvas.projectId, pageId: request.pageId, canvasId: `canvas-${crypto.randomUUID()}` }
    }

    return enqueue(async () => {
      const baseline = await this.getForRoot(context.projectDir)
      const receipt = [...baseline.receipts].reverse().find(item => item.commandId === request.commandId)
      if (receipt) {
        const legacyMatch = !receiptTarget(receipt)
          && (request.type === 'assets.bind' || request.type === 'assets.unbind')
          && request.pageId === LEGACY_PAGE_ID && request.canvasId === LEGACY_CANVAS_ID
          && receipt.requestHash === legacyAssetHash(request)
        if (receipt.requestHash !== hash && !legacyMatch) {
          throw errorWithCode('CANVAS_COMMAND_REPLAY', '同一 commandId 的请求内容已变化')
        }
        const target = receiptTarget(receipt) ?? requestTarget(baseline, request, preparedTarget)
        return {
          ok: true as const,
          commandId: request.commandId,
          revision: baseline.revision,
          receipt: clone(receipt),
          target,
          canvas: clone(baseline),
        }
      }
      if (baseline.revision !== request.expectedRevision) {
        throw errorWithCode(
          'CANVAS_REVISION_CONFLICT',
          `画布版本冲突：期望 ${request.expectedRevision}，实际 ${baseline.revision}`,
        )
      }
      const next = clone(baseline)
      const target = await this.applyCommand(next, request, preparedTarget, context.projectDir)
      const nextReceipt: CanvasCommandReceipt = {
        commandId: request.commandId,
        type: request.type,
        requestHash: hash,
        revision: next.revision + 1,
        appliedAt: new Date().toISOString(),
        payload: { request: payload, target },
      }
      next.revision = nextReceipt.revision
      next.receipts = [...next.receipts, nextReceipt].slice(-100)
      next.updatedAt = new Date().toISOString()
      validateCanvas(next)
      await writeAtomic(this.file(context.projectDir), next)
      this.cache.set(context.projectDir, clone(next))
      for (const listener of this.listeners) listener(clone(next))
      return {
        ok: true as const,
        commandId: request.commandId,
        revision: next.revision,
        receipt: clone(nextReceipt),
        target,
        canvas: clone(next),
      }
    })
  }

  private async applyCommand(
    canvas: Canvas,
    request: CanvasCommandRequest,
    preparedTarget: CanvasTarget | null,
    projectDir: string,
  ): Promise<CanvasTarget> {
    const projectId = canvas.projectId
    if (request.type === 'page.create') {
      if (!preparedTarget) throw errorWithCode('CANVAS_COMMAND_MUTATION', '缺少新创作页目标')
      const title = normalizeTitle(request.title, canvas.pages.map(page => page.title), '创作页')
      const document: CanvasDocument = {
        id: preparedTarget.canvasId,
        title: '画布 1',
        nodes: [],
        edges: [],
        viewport: null,
      }
      canvas.pages.push({ id: preparedTarget.pageId, title, activeCanvasId: document.id, canvases: [document] })
      canvas.activePageId = preparedTarget.pageId
      canvas.activeView = 'canvas'
      return preparedTarget
    }
    if (request.type === 'reference.create') {
      const targetPage = canvas.pages.find(item => item.id === request.target.pageId)
      const targetDocument = targetPage?.canvases.find(item => item.id === request.target.canvasId)
      const sourcePage = canvas.pages.find(item => item.id === request.source.target.pageId)
      const sourceDocument = sourcePage?.canvases.find(item => item.id === request.source.target.canvasId)
      if (!targetPage || !targetDocument || !sourcePage || !sourceDocument) {
        throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '引用目标或来源画布不存在')
      }
      if (request.target.pageId === request.source.target.pageId) {
        throw errorWithCode('CANVAS_REFERENCE_INVALID', '引用目标与来源必须位于不同创作页')
      }
      const sourceNode = sourceDocument.nodes.find(item => item.id === request.source.nodeId)
      if (!sourceNode) throw errorWithCode('CANVAS_NODE_NOT_FOUND', '引用来源节点不存在')
      const version = nodeVersion(sourceNode)
      if (sourceNode.reference || !sourceNode.ref?.path?.trim() || version === null) {
        throw errorWithCode('CANVAS_REFERENCE_INVALID', '引用来源必须是存在 ref.path 与非空 meta.version 的一次产物节点')
      }
      if (!validPosition(request.position)) {
        throw errorWithCode('CANVAS_INVALID_POSITION', '节点 position 必须为有限世界坐标')
      }
      if (typeof request.nodeId !== 'string' || request.nodeId.length === 0) {
        throw errorWithCode('CANVAS_REFERENCE_INVALID', '引用节点 ID 必须非空')
      }
      if (targetDocument.nodes.some(item => item.id === request.nodeId)) {
        throw errorWithCode('CANVAS_NODE_EXISTS', '引用节点 ID 已存在')
      }
      targetDocument.nodes.push({
        id: request.nodeId,
        step: sourceNode.step,
        kind: sourceNode.kind,
        title: sourceNode.title,
        status: sourceNode.status,
        position: { x: request.position.x, y: request.position.y },
        ...(sourceNode.ref ? { ref: clone(sourceNode.ref) } : {}),
        ...(sourceNode.meta ? { meta: clone(sourceNode.meta) } : {}),
        updatedAt: new Date().toISOString(),
        reference: {
          artifactId: sourceNode.id,
          version,
          source: clone(request.source.target),
        },
      })
      return clone(request.target)
    }
    if (request.type === 'page.rename') {
      const page = canvas.pages.find(item => item.id === request.pageId)
      if (!page) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标创作页不存在')
      page.title = normalizeTitle(request.title, [], '创作页')
      return { projectId, pageId: page.id, canvasId: page.activeCanvasId }
    }
    if (request.type === 'page.delete') {
      if (canvas.pages.length === 1) throw errorWithCode('CANVAS_LAST_PAGE', '至少需要保留一个创作页')
      const index = canvas.pages.findIndex(item => item.id === request.pageId)
      if (index < 0) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标创作页不存在')
      const page = canvas.pages[index]!
      const target = { projectId, pageId: page.id, canvasId: page.activeCanvasId }
      const nonEmpty = page.canvases.length > 1 || page.canvases.some(item => item.nodes.length > 0 || item.edges.length > 0)
      if (nonEmpty && request.confirmNonEmpty !== true) {
        throw errorWithCode('CANVAS_CONFIRM_REQUIRED', '删除非空创作页需要确认')
      }
      canvas.pages.splice(index, 1)
      if (canvas.activePageId === page.id) {
        canvas.activePageId = (canvas.pages[index] ?? canvas.pages[index - 1])!.id
        canvas.activeView = 'canvas'
      }
      return target
    }

    const page = canvas.pages.find(item => item.id === request.pageId)
    if (!page) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标创作页不存在')
    if (request.type === 'canvas.create') {
      if (!preparedTarget) throw errorWithCode('CANVAS_COMMAND_MUTATION', '缺少新画布目标')
      const document: CanvasDocument = {
        id: preparedTarget.canvasId,
        title: normalizeTitle(request.title, page.canvases.map(item => item.title), '画布'),
        nodes: [],
        edges: [],
        viewport: null,
      }
      page.canvases.push(document)
      page.activeCanvasId = document.id
      canvas.activePageId = page.id
      canvas.activeView = 'canvas'
      return preparedTarget
    }
    const documentIndex = page.canvases.findIndex(item => item.id === request.canvasId)
    if (documentIndex < 0) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标画布不存在')
    const document = page.canvases[documentIndex]!
    const target = { projectId, pageId: page.id, canvasId: document.id }
    if (request.type === 'canvas.rename') {
      document.title = normalizeTitle(request.title, [], '画布')
      return target
    }
    if (request.type === 'canvas.delete') {
      if (page.canvases.length === 1) throw errorWithCode('CANVAS_LAST_CANVAS', '每个创作页至少需要保留一个画布')
      if ((document.nodes.length > 0 || document.edges.length > 0) && request.confirmNonEmpty !== true) {
        throw errorWithCode('CANVAS_CONFIRM_REQUIRED', '删除非空画布需要确认')
      }
      page.canvases.splice(documentIndex, 1)
      if (page.activeCanvasId === document.id) {
        page.activeCanvasId = (page.canvases[documentIndex] ?? page.canvases[documentIndex - 1])!.id
        if (canvas.activePageId === page.id) canvas.activeView = 'canvas'
      }
      return target
    }
    if (request.type === 'node.move') {
      if (!validPosition(request.position)) {
        throw errorWithCode('CANVAS_INVALID_POSITION', '节点 position 必须为有限世界坐标')
      }
      const node = document.nodes.find(item => item.id === request.nodeId)
      if (!node) throw errorWithCode('CANVAS_NOT_FOUND', '目标节点不存在')
      node.position = { ...request.position }
      node.updatedAt = new Date().toISOString()
      return target
    }

    const node = document.nodes.find(item => item.id === request.nodeId)
    if (!node) throw errorWithCode('CANVAS_NOT_FOUND', '目标节点不存在')
    const assetIds = sortedAssetIds(request.assetIds)
    const assets = await listAssets(undefined, projectDir)
    const known = new Set(assets.map(asset => asset.id))
    const missing = assetIds.filter(id => !known.has(id))
    if (missing.length > 0) {
      throw errorWithCode('ASSET_NOT_FOUND', `资产不存在：${missing.join('、')}`)
    }
    node.assetIds = request.type === 'assets.bind'
      ? sortedAssetIds([...(node.assetIds ?? []), ...assetIds])
      : (node.assetIds ?? []).filter(id => !assetIds.includes(id))
    node.updatedAt = new Date().toISOString()
    return target
  }

  /** 活动目标与逐画布 viewport：不增加 revision，不写 receipts。 */
  async viewState(request: CanvasViewStateRequest): Promise<CanvasViewStateResult> {
    const context = await this.capture()
    assertProject(request, context.projectDir)
    if (request.type === 'viewport.set' && !validViewport(request.viewport)) {
      throw errorWithCode('CANVAS_INVALID_VIEWPORT', `viewport 必须有限且 zoom 位于 ${MIN_ZOOM}–${MAX_ZOOM}`)
    }
    if (request.type === 'active.set' && request.canvasId !== undefined && request.pageId === undefined) {
      throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '指定 canvasId 时必须同时指定 pageId')
    }
    if (request.type === 'active.set' && request.activeView !== undefined
      && request.activeView !== 'canvas' && request.activeView !== 'stage0') {
      throw errorWithCode('CANVAS_CORRUPT', 'activeView 无效')
    }

    return enqueue(async () => {
      const baseline = await this.getForRoot(context.projectDir)
      const next = clone(baseline)
      let target = targetOf(next)
      if (request.type === 'active.set') {
        const page = request.pageId === undefined
          ? next.pages.find(item => item.id === next.activePageId)
          : next.pages.find(item => item.id === request.pageId)
        if (!page) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标创作页不存在')
        if (request.canvasId !== undefined) {
          const document = page.canvases.find(item => item.id === request.canvasId)
          if (!document) throw errorWithCode('CANVAS_TARGET_NOT_FOUND', '目标画布不存在')
          page.activeCanvasId = document.id
        }
        if (request.pageId !== undefined) next.activePageId = page.id
        if (request.activeView !== undefined) next.activeView = request.activeView
        target = { projectId: next.projectId, pageId: page.id, canvasId: page.activeCanvasId }
      } else {
        target = { projectId: next.projectId, pageId: request.pageId, canvasId: request.canvasId }
        documentAt(next, target).viewport = { ...request.viewport }
      }

      if (stableStringify(next) === stableStringify(baseline)) {
        return { ok: true as const, target, canvas: clone(baseline) }
      }
      next.updatedAt = new Date().toISOString()
      validateCanvas(next)
      await writeAtomic(this.file(context.projectDir), next)
      this.cache.set(context.projectDir, clone(next))
      for (const listener of this.listeners) listener(clone(next))
      return { ok: true as const, target, canvas: clone(next) }
    })
  }

  async upsertGate(gate: CanvasGate): Promise<void> {
    const context = await this.capture()
    await enqueue(() => this.commitInQueue(context, 'gate.upsert', undefined, {}, canvas => {
      const index = canvas.gates.findIndex(item => item.gateId === gate.gateId)
      if (index >= 0) canvas.gates[index] = gate
      else canvas.gates.push(gate)
    }))
  }
}

export const canvasStore = new CanvasStore()
