// feature-803 · ComfyUI 统一生成引擎：持久作业、续查、收片与资产登记
import path from 'node:path'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import { copyExistingToArchive } from '../fs/archive.js'
import { resolveInside } from '../fs/sandbox.js'
import { getActiveProjectDir } from '../project/current.js'
import { registerAsset } from '../asset/index.js'
import { requireInstance } from './settings.js'
import { loadAndMapWorkflow } from './workflow.js'
import {
  HttpComfyClient,
  type ComfyClient,
  type ComfyJobOutput,
  type ComfyRemoteImage,
  type ComfyStatusResult,
  type ComfyTestResult,
  type ComfyTransport,
} from './client.js'

interface ComfyJobRecord {
  jobId: string
  requestId: string
  instanceId: string
  instanceBaseUrl: string
  workflowId: string
  workflowVersion: string
  inputs: Record<string, unknown>
  promptId: string | null
  state: ComfyStatusResult['state']
  outputs: ComfyJobOutput[]
  error: { code: string; message: string } | null
  createdAt: string
  updatedAt: string
}

interface ComfyJobsFile {
  schemaVersion: 1
  jobs: ComfyJobRecord[]
  updatedAt: string
}

export interface ComfyEngineOptions {
  transport?: ComfyTransport
  workflowDirectory?: string
  getProjectDir?: () => string
  maxOutputs?: number
  maxOutputBytes?: number
}

function fail(code: string, message: string, cause?: unknown): never {
  throw Object.assign(new Error(message), { code, ...(cause === undefined ? {} : { cause }) })
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorInfo(error: unknown): { code: string; message: string } {
  return {
    code: typeof (error as { code?: unknown })?.code === 'string'
      ? (error as { code: string }).code
      : 'INTERNAL',
    message: error instanceof Error ? error.message : String(error),
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (object(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

function sameInputs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b))
}

function jobsFile(root: string): string {
  return path.join(root, 'comfy-jobs.json')
}

function parseJob(raw: unknown): ComfyJobRecord {
  if (!object(raw)) fail('COMFY_JOBS_CORRUPT', 'ComfyUI 作业条目必须为对象')
  for (const key of ['jobId', 'requestId', 'instanceId', 'instanceBaseUrl', 'workflowId', 'workflowVersion', 'createdAt', 'updatedAt'] as const) {
    if (typeof raw[key] !== 'string' || raw[key].length === 0) {
      fail('COMFY_JOBS_CORRUPT', `ComfyUI 作业缺少 ${key}`)
    }
  }
  if (!['queued', 'running', 'downloading', 'completed', 'error'].includes(String(raw.state))
    || (raw.promptId !== null && typeof raw.promptId !== 'string')
    || !object(raw.inputs) || !Array.isArray(raw.outputs)) {
    fail('COMFY_JOBS_CORRUPT', 'ComfyUI 作业状态或输入输出形状无效')
  }
  const outputs = raw.outputs.map(output => {
    if (!object(output) || typeof output.path !== 'string' || output.kind !== 'image' || typeof output.assetId !== 'string') {
      fail('COMFY_JOBS_CORRUPT', 'ComfyUI 作业输出形状无效')
    }
    return { path: output.path, kind: 'image' as const, assetId: output.assetId }
  })
  if (raw.error !== null && (!object(raw.error) || typeof raw.error.code !== 'string' || typeof raw.error.message !== 'string')) {
    fail('COMFY_JOBS_CORRUPT', 'ComfyUI 作业错误形状无效')
  }
  return raw as unknown as ComfyJobRecord
}

async function readJobs(root: string): Promise<ComfyJobRecord[]> {
  let raw: string
  try {
    raw = await fsp.readFile(jobsFile(root), 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!object(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.jobs)) {
      fail('COMFY_JOBS_CORRUPT', 'comfy-jobs.json 形状无效')
    }
    return parsed.jobs.map(parseJob)
  } catch (error) {
    if (typeof (error as { code?: unknown })?.code === 'string') throw error
    fail('COMFY_JOBS_CORRUPT', 'comfy-jobs.json 不是有效 JSON', error)
  }
}

async function writeJobs(root: string, jobs: ComfyJobRecord[]): Promise<void> {
  const file = jobsFile(root)
  await fsp.mkdir(root, { recursive: true })
  const temp = path.join(
    root,
    `.comfy-jobs.json.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  )
  const data: ComfyJobsFile = { schemaVersion: 1, jobs, updatedAt: new Date().toISOString() }
  try {
    const handle = await fsp.open(temp, 'wx', 0o600)
    try {
      await handle.writeFile(JSON.stringify(data, null, 2), 'utf-8')
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

function safeOutputName(filename: string): string {
  if (!filename || filename === '.' || filename === '..' || filename.includes('\0')
    || path.posix.basename(filename) !== filename || path.win32.basename(filename) !== filename) {
    fail('COMFY_OUTPUT_INVALID', `远端图片文件名不安全：${filename}`)
  }
  return filename
}

function imageFormat(data: Uint8Array): 'png' | 'jpeg' | 'webp' | null {
  const has = (offset: number, values: number[]) => values.every((value, index) => data[offset + index] === value)
  if (has(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (has(0, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (has(0, [0x52, 0x49, 0x46, 0x46]) && has(8, [0x57, 0x45, 0x42, 0x50])) return 'webp'
  return null
}

function validateImage(data: Uint8Array, filename: string, contentType?: string): void {
  const extension = path.extname(filename).toLowerCase()
  const expected = extension === '.png' ? 'png'
    : extension === '.jpg' || extension === '.jpeg' ? 'jpeg'
      : extension === '.webp' ? 'webp' : null
  const actual = imageFormat(data)
  if (!expected || !actual || expected !== actual) {
    fail('COMFY_OUTPUT_INVALID', `图片扩展名与真实格式不符：${filename}`)
  }
  if (contentType !== undefined) {
    const mime = actual === 'jpeg' ? 'image/jpeg' : `image/${actual}`
    if (contentType !== mime && !(actual === 'jpeg' && contentType === 'image/jpg')) {
      fail('COMFY_OUTPUT_INVALID', `图片 content-type 与真实格式不符：${contentType}`)
    }
  }
}

function toStatus(job: ComfyJobRecord): ComfyStatusResult {
  return {
    jobId: job.jobId,
    promptId: job.promptId,
    state: job.state,
    outputs: job.outputs.map(output => ({ ...output })),
    error: job.error ? { ...job.error } : null,
  }
}

export class ComfyEngine implements ComfyClient {
  private readonly transport: ComfyTransport
  private readonly workflowDirectory?: string
  private readonly getProjectDir: () => string
  private readonly maxOutputs: number
  private readonly maxOutputBytes: number
  private readonly locks = new Map<string, Promise<void>>()

  constructor(options: ComfyEngineOptions = {}) {
    this.transport = options.transport ?? new HttpComfyClient()
    this.workflowDirectory = options.workflowDirectory
    this.getProjectDir = options.getProjectDir ?? getActiveProjectDir
    this.maxOutputs = options.maxOutputs ?? 16
    this.maxOutputBytes = options.maxOutputBytes ?? 25 * 1024 * 1024
    if (!Number.isInteger(this.maxOutputs) || this.maxOutputs <= 0
      || !Number.isFinite(this.maxOutputBytes) || this.maxOutputBytes <= 0) {
      fail('INVALID_ARGUMENT', 'ComfyUI 输出数量与大小限制必须大于 0')
    }
  }

  private async locked<T>(root: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(root) ?? Promise.resolve()
    const run = previous.then(task)
    const tail = run.then(() => undefined, () => undefined)
    this.locks.set(root, tail)
    try {
      return await run
    } finally {
      if (this.locks.get(root) === tail) this.locks.delete(root)
    }
  }

  async testConnection(req: { baseUrl: string }): Promise<ComfyTestResult> {
    if (!object(req) || typeof req.baseUrl !== 'string') fail('INVALID_ARGUMENT', '参数必须为 { baseUrl }')
    return this.transport.test(req.baseUrl)
  }

  async queue(req: {
    instanceId: string
    workflowId: string
    inputs?: Record<string, unknown>
    requestId: string
  }): Promise<{ jobId: string; promptId: string }> {
    if (!object(req) || typeof req.instanceId !== 'string' || !req.instanceId
      || typeof req.workflowId !== 'string' || !req.workflowId
      || typeof req.requestId !== 'string' || !req.requestId.trim()) {
      fail('INVALID_ARGUMENT', '参数必须为 { instanceId, workflowId, inputs?, requestId }')
    }
    const inputs = req.inputs === undefined ? {} : structuredClone(req.inputs)
    if (!object(inputs)) fail('INVALID_ARGUMENT', 'inputs 必须为对象')
    const root = this.getProjectDir()
    return this.locked(root, async () => {
      const jobs = await readJobs(root)
      const existing = jobs.find(job => job.requestId === req.requestId)
      if (existing) {
        if (existing.instanceId !== req.instanceId || existing.workflowId !== req.workflowId
          || !sameInputs(existing.inputs, inputs)) {
          fail('COMFY_REQUEST_CONFLICT', `requestId 已用于其他生成参数：${req.requestId}`)
        }
        if (!existing.promptId) {
          fail(existing.error?.code ?? 'COMFY_SUBMISSION_UNKNOWN',
            existing.error?.message ?? `提交结果未知，禁止自动重提；jobId=${existing.jobId}`)
        }
        return { jobId: existing.jobId, promptId: existing.promptId }
      }

      const instance = await requireInstance(req.instanceId)
      if (!instance.enabled) fail('COMFY_INSTANCE_DISABLED', `ComfyUI 实例已禁用：${instance.name}`)
      const mapped = await loadAndMapWorkflow(req.workflowId, inputs, this.workflowDirectory)
      const now = new Date().toISOString()
      const job: ComfyJobRecord = {
        jobId: `job-${crypto.randomUUID()}`,
        requestId: req.requestId,
        instanceId: instance.id,
        instanceBaseUrl: instance.baseUrl,
        workflowId: req.workflowId,
        workflowVersion: mapped.version,
        inputs,
        promptId: null,
        state: 'queued',
        outputs: [],
        error: null,
        createdAt: now,
        updatedAt: now,
      }
      jobs.push(job)
      await writeJobs(root, jobs)
      try {
        const submitted = await this.transport.submit(instance.baseUrl, mapped.workflow, req.requestId)
        job.promptId = submitted.promptId
        job.updatedAt = new Date().toISOString()
        await writeJobs(root, jobs)
        return { jobId: job.jobId, promptId: submitted.promptId }
      } catch (error) {
        job.state = 'error'
        job.error = errorInfo(error)
        job.updatedAt = new Date().toISOString()
        await writeJobs(root, jobs)
        throw error
      }
    })
  }

  async status(req: { instanceId: string; jobId: string }): Promise<ComfyStatusResult> {
    if (!object(req) || typeof req.instanceId !== 'string' || !req.instanceId
      || typeof req.jobId !== 'string' || !req.jobId) {
      fail('INVALID_ARGUMENT', '参数必须为 { instanceId, jobId }')
    }
    const root = this.getProjectDir()
    return this.locked(root, async () => {
      const jobs = await readJobs(root)
      const job = jobs.find(candidate => candidate.jobId === req.jobId && candidate.instanceId === req.instanceId)
      if (!job) fail('COMFY_JOB_NOT_FOUND', `当前项目找不到 ComfyUI 作业：${req.jobId}`)
      if (job.state === 'completed' || job.state === 'error') return toStatus(job)
      const promptId = job.promptId
      if (!promptId) {
        job.state = 'error'
        job.error = {
          code: 'COMFY_SUBMISSION_UNKNOWN',
          message: '提交返回前中断，缺少 promptId；请人工核查 ComfyUI，系统不会自动重提',
        }
        job.updatedAt = new Date().toISOString()
        await writeJobs(root, jobs)
        return toStatus(job)
      }

      // 查询传输失败只向上抛出，保留原状态供下次续查，不冒称远端失败或取消。
      const remote = await this.transport.poll(job.instanceBaseUrl, promptId)
      job.updatedAt = new Date().toISOString()
      if (remote.state === 'queued' || remote.state === 'running') {
        job.state = remote.state
        await writeJobs(root, jobs)
        return toStatus(job)
      }
      if (remote.state === 'error') {
        job.state = 'error'
        job.error = { code: 'COMFY_EXECUTION_FAILED', message: remote.message }
        await writeJobs(root, jobs)
        return toStatus(job)
      }
      if (remote.state !== 'completed') fail('COMFY_INVALID_RESPONSE', 'ComfyUI 返回了未知作业状态')

      job.state = 'downloading'
      job.error = null
      await writeJobs(root, jobs)
      try {
        if (remote.images.length === 0 || remote.images.length > this.maxOutputs) {
          fail('COMFY_OUTPUT_INVALID', `远端图片数量 ${remote.images.length} 超出允许范围 1–${this.maxOutputs}`)
        }
        const names = new Set<string>()
        for (const image of remote.images) {
          const name = safeOutputName(image.filename)
          if (names.has(name)) fail('COMFY_OUTPUT_INVALID', `远端图片文件名重复：${name}`)
          names.add(name)
          const output = await this.collectOutput(root, job, promptId, image)
          const recorded = job.outputs.findIndex(candidate => candidate.path === output.path)
          if (recorded >= 0) job.outputs[recorded] = output
          else job.outputs.push(output)
          job.updatedAt = new Date().toISOString()
          await writeJobs(root, jobs)
        }
        job.state = 'completed'
        job.updatedAt = new Date().toISOString()
        await writeJobs(root, jobs)
        return toStatus(job)
      } catch (error) {
        job.state = 'error'
        job.error = errorInfo(error)
        job.updatedAt = new Date().toISOString()
        await writeJobs(root, jobs)
        return toStatus(job)
      }
    })
  }

  private async collectOutput(
    root: string,
    job: ComfyJobRecord,
    promptId: string,
    image: ComfyRemoteImage,
  ): Promise<ComfyJobOutput> {
    const filename = safeOutputName(image.filename)
    const relativePath = path.posix.join('资产', '生成', job.jobId, filename)
    const absolutePath = resolveInside(root, relativePath)
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true })

    let existing = true
    try {
      await fsp.access(absolutePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      existing = false
    }
    if (existing) {
      const data = await fsp.readFile(absolutePath)
      if (data.byteLength > this.maxOutputBytes) fail('COMFY_OUTPUT_TOO_LARGE', '已有图片超过大小限制')
      validateImage(data, filename)
    } else {
      const downloaded = await this.transport.download(job.instanceBaseUrl, image)
      if (downloaded.data.byteLength > this.maxOutputBytes) {
        fail('COMFY_OUTPUT_TOO_LARGE', `图片超过 ${this.maxOutputBytes} 字节限制`)
      }
      validateImage(downloaded.data, filename, downloaded.contentType)
      const temp = path.join(
        path.dirname(absolutePath),
        `.${filename}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.part`,
      )
      try {
        const handle = await fsp.open(temp, 'wx', 0o600)
        try {
          await handle.writeFile(downloaded.data)
          await handle.sync()
        } finally {
          await handle.close()
        }
        await fsp.rename(temp, absolutePath)
      } catch (error) {
        await fsp.rm(temp, { force: true }).catch(() => {})
        throw error
      }
    }

    const { assetId } = await registerAsset({
      kind: 'image',
      path: relativePath,
      sourceJobId: job.jobId,
      meta: {
        instanceId: job.instanceId,
        promptId,
        workflowId: job.workflowId,
        workflowVersion: job.workflowVersion,
        inputs: job.inputs,
        nodeId: image.nodeId,
      },
    }, root)
    return { path: relativePath, kind: 'image', assetId }
  }
}
