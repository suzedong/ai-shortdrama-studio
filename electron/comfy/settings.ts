// feature-803 · ComfyInstance 应用级 CRUD（userData 全局唯一事实源）
import path from 'node:path'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import { app } from 'electron'
import type { ComfyInstance } from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { copyExistingToArchive } from '../fs/archive.js'
import { getActiveProjectDir } from '../project/current.js'
import { normalizeComfyBaseUrl } from './url.js'

export interface ComfyInstanceConfig extends ComfyInstance {
  gpus?: string[]
  vramGB?: number
}

interface SettingsFile {
  schemaVersion: 1
  instances: ComfyInstanceConfig[]
  updatedAt: string
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code })
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'comfyui', 'instances.json')
}

function validId(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 128) {
    fail('INVALID_ARGUMENT', '实例 id 无效')
  }
  return value
}

function validAddedAt(value: unknown): string {
  if (value === undefined) return new Date().toISOString()
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    fail('INVALID_ARGUMENT', '实例 addedAt 必须为 ISO 时间')
  }
  return value
}

function validGpus(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) fail('INVALID_ARGUMENT', 'gpus 必须为字符串数组')
  const result = value.map(item => {
    if (typeof item !== 'string' || item.trim() === '') fail('INVALID_ARGUMENT', 'GPU 标识不能为空')
    return item.trim()
  })
  return [...new Set(result)]
}

function validVram(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail('INVALID_ARGUMENT', 'vramGB 必须为大于 0 的有限数')
  }
  return value
}

function normalizeInstance(input: Partial<ComfyInstanceConfig>, existing?: ComfyInstanceConfig): ComfyInstanceConfig {
  const name = input.name ?? existing?.name ?? '未命名实例'
  if (typeof name !== 'string' || name.trim() === '' || name.trim().length > 80) {
    fail('INVALID_ARGUMENT', '实例名称必须为 1–80 字')
  }
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    fail('INVALID_ARGUMENT', '实例 enabled 必须为 boolean')
  }
  const gpusInput = Object.prototype.hasOwnProperty.call(input, 'gpus') ? input.gpus : existing?.gpus
  const vramInput = Object.prototype.hasOwnProperty.call(input, 'vramGB') ? input.vramGB : existing?.vramGB
  const gpus = validGpus(gpusInput)
  const vramGB = validVram(vramInput)
  return {
    id: validId(input.id ?? existing?.id),
    name: name.trim(),
    baseUrl: normalizeComfyBaseUrl(input.baseUrl ?? existing?.baseUrl ?? 'http://127.0.0.1:8188'),
    enabled: input.enabled ?? existing?.enabled ?? true,
    addedAt: existing?.addedAt ?? validAddedAt(input.addedAt),
    ...(gpus !== undefined ? { gpus } : {}),
    ...(vramGB !== undefined ? { vramGB } : {}),
  }
}

async function readGlobal(): Promise<SettingsFile | null> {
  let raw: string
  try {
    raw = await fsp.readFile(settingsFile(), 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  try {
    const data = JSON.parse(raw) as Partial<SettingsFile>
    if (data.schemaVersion !== 1 || !Array.isArray(data.instances)) throw new Error('形状不符')
    return {
      schemaVersion: 1,
      instances: data.instances.map(item => normalizeInstance(item)),
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    }
  } catch (error) {
    throw Object.assign(new Error(`ComfyUI 实例配置损坏：${(error as Error).message}`), {
      code: 'COMFY_SETTINGS_CORRUPT',
    })
  }
}

async function readLegacyInstances(): Promise<ComfyInstanceConfig[]> {
  let root: string
  try {
    root = getActiveProjectDir()
  } catch {
    return []
  }
  try {
    const data = JSON.parse(await fsp.readFile(path.join(root, 'project.json'), 'utf-8')) as {
      comfyInstances?: unknown
    }
    if (!Array.isArray(data.comfyInstances)) return []
    const migrated: ComfyInstanceConfig[] = []
    for (const item of data.comfyInstances) {
      try {
        migrated.push(normalizeInstance(item as Partial<ComfyInstanceConfig>))
      } catch (error) {
        console.warn('[comfy] 跳过非法旧实例配置', (error as Error).message)
      }
    }
    return migrated
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    if (error instanceof SyntaxError) fail('COMFY_SETTINGS_CORRUPT', '旧 project.json 无法解析，未创建全局实例配置')
    throw error
  }
}

async function writeGlobal(config: SettingsFile): Promise<void> {
  const file = settingsFile()
  await fsp.mkdir(path.dirname(file), { recursive: true })
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  )
  try {
    const handle = await fsp.open(temp, 'wx', 0o600)
    try {
      await handle.writeFile(JSON.stringify({ ...config, updatedAt: new Date().toISOString() }, null, 2), 'utf-8')
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

async function ensureGlobal(): Promise<SettingsFile> {
  const existing = await readGlobal()
  if (existing) return existing
  return enqueue(async () => {
    const raced = await readGlobal()
    if (raced) return raced
    const migrated: SettingsFile = {
      schemaVersion: 1,
      instances: await readLegacyInstances(),
      updatedAt: new Date().toISOString(),
    }
    await writeGlobal(migrated)
    return migrated
  })
}

/** 列出应用级实例；首次调用迁移当前项目旧配置，无打开项目也可用。 */
export async function listInstances(): Promise<ComfyInstanceConfig[]> {
  return (await ensureGlobal()).instances
}

/** 按 id upsert；始终校验合并后的新值，并在写队列内读取最新配置。 */
export async function upsertInstance(instance: Partial<ComfyInstanceConfig>): Promise<ComfyInstanceConfig> {
  return enqueue(async () => {
    const config = (await readGlobal()) ?? {
      schemaVersion: 1 as const,
      instances: await readLegacyInstances(),
      updatedAt: new Date().toISOString(),
    }
    const id = instance.id ?? `c-${crypto.randomBytes(4).toString('hex')}`
    const index = config.instances.findIndex(item => item.id === id)
    const next = normalizeInstance({ ...instance, id }, index >= 0 ? config.instances[index] : undefined)
    if (index >= 0) config.instances[index] = next
    else config.instances.push(next)
    await writeGlobal(config)
    return next
  })
}

/** 按 id 移除；不存在抛 INVALID_ARGUMENT。 */
export async function removeInstance(id: string): Promise<{ ok: true }> {
  validId(id)
  return enqueue(async () => {
    const config = (await readGlobal()) ?? {
      schemaVersion: 1 as const,
      instances: await readLegacyInstances(),
      updatedAt: new Date().toISOString(),
    }
    const next = config.instances.filter(item => item.id !== id)
    if (next.length === config.instances.length) fail('INVALID_ARGUMENT', `实例 ${id} 不存在`)
    config.instances = next
    await writeGlobal(config)
    return { ok: true }
  })
}

/** 取实例配置；不存在抛 INVALID_ARGUMENT。 */
export async function requireInstance(id: string): Promise<ComfyInstanceConfig> {
  const found = (await listInstances()).find(item => item.id === id)
  if (!found) fail('INVALID_ARGUMENT', `实例 ${id} 未配置`)
  return found
}
