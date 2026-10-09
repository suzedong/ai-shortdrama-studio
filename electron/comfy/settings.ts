// feature-017 · ComfyInstance CRUD（持久化于项目 project.json）
import path from 'node:path'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import type { ComfyInstance } from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { archiveExisting } from '../fs/archive.js'
import { getActiveProjectDir } from '../project/current.js'

interface ProjectFile {
  projectId: string
  title: string
  comfyInstances: ComfyInstance[]
  updatedAt: string
}

function projectFile(): string {
  return path.join(getActiveProjectDir(), 'project.json')
}

async function readProject(): Promise<ProjectFile> {
  const root = getActiveProjectDir()
  try {
    const data = JSON.parse(await fsp.readFile(projectFile(), 'utf-8')) as Partial<ProjectFile>
    return {
      projectId: data.projectId ?? path.basename(root),
      title: data.title ?? '新项目',
      comfyInstances: Array.isArray(data.comfyInstances) ? data.comfyInstances : [],
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return { projectId: path.basename(root), title: '新项目', comfyInstances: [], updatedAt: new Date().toISOString() }
  }
}

function writeProject(p: ProjectFile): Promise<void> {
  return enqueue(async () => {
    const file = projectFile()
    p.updatedAt = new Date().toISOString()
    await archiveExisting(file, new Date())
    await fsp.writeFile(file, JSON.stringify(p, null, 2), 'utf-8')
  })
}

/** 列出实例（文件缺失返回 []） */
export async function listInstances(): Promise<ComfyInstance[]> {
  return (await readProject()).comfyInstances
}

/** 按 id upsert；id 缺省由主进程生成 */
export async function upsertInstance(instance: Partial<ComfyInstance>): Promise<ComfyInstance> {
  const p = await readProject()
  const id = instance.id ?? `c-${crypto.randomBytes(4).toString('hex')}`
  const next: ComfyInstance = {
    id,
    name: instance.name ?? '未命名实例',
    baseUrl: instance.baseUrl ?? 'http://127.0.0.1:8188',
    enabled: instance.enabled ?? true,
    addedAt: instance.addedAt ?? new Date().toISOString(),
  }
  const idx = p.comfyInstances.findIndex(c => c.id === id)
  if (idx >= 0) p.comfyInstances[idx] = next
  else p.comfyInstances.push(next)
  await writeProject(p)
  return next
}

/** 按 id 移除；不存在抛 INVALID_ARGUMENT */
export async function removeInstance(id: string): Promise<{ ok: true }> {
  const p = await readProject()
  const next = p.comfyInstances.filter(c => c.id !== id)
  if (next.length === p.comfyInstances.length) {
    throw Object.assign(new Error(`实例 ${id} 不存在`), { code: 'INVALID_ARGUMENT' })
  }
  p.comfyInstances = next
  await writeProject(p)
  return { ok: true }
}

/** 取实例配置；不存在抛 INVALID_ARGUMENT */
export async function requireInstance(id: string): Promise<ComfyInstance> {
  const found = (await listInstances()).find(c => c.id === id)
  if (!found) throw Object.assign(new Error(`实例 ${id} 未配置`), { code: 'INVALID_ARGUMENT' })
  return found
}
