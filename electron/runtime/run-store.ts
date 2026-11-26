import fsp from 'node:fs/promises'
import path from 'node:path'
import { writeTextAtomic } from '../fs/atomic.js'
import { enqueue } from '../fs/write-queue.js'
import type { AgentRunRecord, AgentRunStatus, RuntimePromptRequest } from './types.js'

const ACTIVE_STATUSES = new Set<AgentRunStatus>(['running', 'stopping'])
const STATUSES = new Set<AgentRunStatus>([
  'running',
  'stopping',
  'completed',
  'failed',
  'stopped',
  'interrupted',
])

function clone<T>(value: T): T {
  return structuredClone(value)
}

function corrupt(dir: string, cause?: unknown): Error {
  return Object.assign(new Error(`运行账本损坏：${path.join(dir, '.agent-runs.json')}`), {
    name: 'RUN_STORE_CORRUPT',
    cause,
  })
}

function validateRequest(value: unknown, sessionId: string): RuntimePromptRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid request')
  const request = value as Partial<RuntimePromptRequest>
  if (request.sessionId !== sessionId || typeof request.text !== 'string') throw new Error('invalid request')
  if (request.agent !== undefined && typeof request.agent !== 'string') throw new Error('invalid request')
  if (request.model !== undefined && (
    typeof request.model !== 'object' || request.model === null || Array.isArray(request.model)
    || typeof request.model.providerID !== 'string' || typeof request.model.modelID !== 'string'
  )) throw new Error('invalid request')
  return clone(request as RuntimePromptRequest)
}

function validateRecords(value: unknown, dir: string): AgentRunRecord[] {
  if (!Array.isArray(value)) throw corrupt(dir)
  try {
    return value.map((raw): AgentRunRecord => {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('invalid run')
      const run = raw as Partial<AgentRunRecord>
      if (
        typeof run.id !== 'string' || run.id.length === 0
        || typeof run.sessionId !== 'string' || run.sessionId.length === 0
        || typeof run.status !== 'string' || !STATUSES.has(run.status as AgentRunStatus)
        || typeof run.createdAt !== 'string' || typeof run.updatedAt !== 'string'
        || (run.endedAt !== undefined && typeof run.endedAt !== 'string')
        || (run.error !== undefined && typeof run.error !== 'string')
        || (run.retryOfMessageId !== undefined && typeof run.retryOfMessageId !== 'string')
      ) throw new Error('invalid run')
      return {
        id: run.id,
        sessionId: run.sessionId,
        request: validateRequest(run.request, run.sessionId),
        status: run.status as AgentRunStatus,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        ...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
        ...(run.error !== undefined ? { error: run.error } : {}),
        ...(run.retryOfMessageId !== undefined ? { retryOfMessageId: run.retryOfMessageId } : {}),
      }
    })
  } catch (e) {
    throw corrupt(dir, e)
  }
}

export class AgentRunStore {
  private records: AgentRunRecord[] | null = null

  constructor(readonly dir: string) {}

  private get file(): string {
    return path.join(this.dir, '.agent-runs.json')
  }

  private async write(records: AgentRunRecord[]): Promise<void> {
    await writeTextAtomic(this.file, JSON.stringify(records, null, 2))
  }

  private async load(): Promise<AgentRunRecord[]> {
    if (this.records) return this.records
    return enqueue(async () => {
      if (this.records) return this.records
      let parsed: unknown = []
      let exists = false
      try {
        parsed = JSON.parse(await fsp.readFile(this.file, 'utf-8'))
        exists = true
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw corrupt(this.dir, e)
      }
      const records = validateRecords(parsed, this.dir)
      const now = new Date().toISOString()
      let reconciled = false
      for (const run of records) {
        if (ACTIVE_STATUSES.has(run.status)) {
          run.status = 'interrupted'
          run.updatedAt = now
          run.endedAt = now
          reconciled = true
        }
      }
      if (exists && reconciled) await this.write(records)
      this.records = records
      return records
    })
  }

  async list(): Promise<AgentRunRecord[]> {
    return clone(await this.load())
  }

  async get(messageId: string): Promise<AgentRunRecord | null> {
    return (await this.list()).find(run => run.id === messageId) ?? null
  }

  async active(sessionId?: string): Promise<AgentRunRecord | null> {
    return (await this.list()).find(run =>
      ACTIVE_STATUSES.has(run.status) && (!sessionId || run.sessionId === sessionId),
    ) ?? null
  }

  async start(
    messageId: string,
    request: RuntimePromptRequest,
    retryOfMessageId?: string,
  ): Promise<AgentRunRecord> {
    const records = await this.load()
    return enqueue(async () => {
      if (records.some(run => run.id === messageId)) {
        throw Object.assign(new Error('运行 messageID 已存在'), { name: 'INTERNAL' })
      }
      if (records.some(run => run.sessionId === request.sessionId && ACTIVE_STATUSES.has(run.status))) {
        throw Object.assign(new Error('当前会话仍有活跃运行'), { name: 'INTERNAL' })
      }
      const now = new Date().toISOString()
      const run: AgentRunRecord = {
        id: messageId,
        sessionId: request.sessionId,
        request: clone(request),
        status: 'running',
        createdAt: now,
        updatedAt: now,
        ...(retryOfMessageId ? { retryOfMessageId } : {}),
      }
      records.push(run)
      try {
        await this.write(records)
      } catch (e) {
        records.pop()
        throw e
      }
      return clone(run)
    })
  }

  async transition(
    messageId: string,
    status: AgentRunStatus,
    error?: string,
  ): Promise<AgentRunRecord | null> {
    const records = await this.load()
    return enqueue(async () => {
      const run = records.find(item => item.id === messageId)
      if (!run) return null
      if (!ACTIVE_STATUSES.has(run.status)) return clone(run)
      if (status === 'running' || (run.status === 'stopping' && (status === 'stopping' || status === 'completed'))) {
        throw Object.assign(new Error(`非法运行状态迁移：${run.status} → ${status}`), { name: 'INTERNAL' })
      }
      const now = new Date().toISOString()
      const next: AgentRunRecord = {
        ...run,
        status,
        updatedAt: now,
        ...(status === 'stopping' ? {} : { endedAt: now }),
        ...(error ? { error } : {}),
      }
      const index = records.indexOf(run)
      records[index] = next
      try {
        await this.write(records)
      } catch (e) {
        records[index] = run
        throw e
      }
      return clone(next)
    })
  }

  async interruptActive(): Promise<AgentRunRecord[]> {
    const records = await this.load()
    const active = records.filter(run => ACTIVE_STATUSES.has(run.status))
    for (const run of active) await this.transition(run.id, 'interrupted')
    return this.list()
  }

  async stopActive(
    sessionId?: string,
    status: 'stopping' | 'stopped' = 'stopping',
  ): Promise<AgentRunRecord[]> {
    const records = await this.load()
    const active = records.filter(run =>
      ACTIVE_STATUSES.has(run.status) && (!sessionId || run.sessionId === sessionId),
    )
    for (const run of active) await this.transition(run.id, status)
    return this.list()
  }
}
