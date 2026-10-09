// feature-022 · 项目库（自 electron/session.ts 解耦迁移，行为逐行不变）
// 保留：session-state 读写、project:list/create/open；旧壳会话/消息/档案/工作流持久化已随旧壳删除。
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { NodeStatus, ProjectSession, SessionStateFile, Stage } from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'

function stateFilePath(): string {
  return path.join(app.getPath('userData'), 'session-state.json')
}

function sessionInfoFile(dir: string): string {
  return path.join(dir, '.session.json')
}

// 读取 session-state.json；文件不存在或损坏返回 { currentDir: null }
export function readSessionState(): SessionStateFile {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as SessionStateFile
    return { currentDir: typeof parsed.currentDir === 'string' ? parsed.currentDir : null }
  } catch {
    return { currentDir: null }
  }
}

export function writeSessionState(state: SessionStateFile): void {
  fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true })
  fs.writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf-8')
}

// 平台工作区根目录（与 runtime cwd 同源）
function workspaceRoot(): string {
  return path.join(app.getPath('documents'), 'ai-shortdrama-studio')
}

export interface ProjectSummary {
  dir: string
  name: string
  createdAt?: string
  updatedAt: string
}

// project:list：扫描工作区下 project-* 目录，读 manifest/.session.json；损坏单项跳过
export async function listProjects(): Promise<ProjectSummary[]> {
  const root = workspaceRoot()
  let entries: fs.Dirent[]
  try {
    entries = await fsp.readdir(root, { withFileTypes: true })
  } catch {
    return [] // 工作区尚未创建
  }
  const out: ProjectSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('project-')) continue
    const dir = path.join(root, entry.name)
    try {
      const st = await fsp.stat(dir)
      let name = '新项目'
      let createdAt: string | undefined
      try {
        const manifest = JSON.parse(
          await fsp.readFile(path.join(dir, 'manifest.json'), 'utf-8'),
        ) as Record<string, unknown>
        if (typeof manifest.createdAt === 'string') createdAt = manifest.createdAt
      } catch {
        // manifest 缺失/损坏：不致命，继续用 .session.json
      }
      try {
        const info = JSON.parse(
          await fsp.readFile(sessionInfoFile(dir), 'utf-8'),
        ) as Partial<ProjectSession>
        if (info.title) name = info.title
        if (!createdAt && typeof info.createdAt === 'string') createdAt = info.createdAt
      } catch {
        // .session.json 缺失：用默认名
      }
      out.push({ dir, name, ...(createdAt ? { createdAt } : {}), updatedAt: st.mtime.toISOString() })
    } catch {
      // stat 失败等：跳过该目录
    }
  }
  // 最近修改在前
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

// 立项初始节点（历史 manifest 骨架字段，沿用原样）
function initialNodes(): Record<Stage, NodeStatus> {
  return {
    idea: 'active',
    diagnosis: 'pending', brief: 'pending', background: 'pending',
    story: 'pending', outline: 'pending', profiles: 'pending',
    scenes: 'pending', dialogue: 'pending', storyboard: 'pending',
  }
}

// project:create：真实初始化会话目录 + manifest 骨架 + .session.json，并切换为当前会话
export async function createProject(name?: string): Promise<{ dir: string }> {
  return enqueue(async () => {
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6)}`
    const dir = path.join(workspaceRoot(), `project-${stamp}`)
    await fsp.mkdir(dir, { recursive: true })

    const title = typeof name === 'string' && name.trim() ? name.trim() : '新项目'
    const manifest = {
      status: 'initiating',
      createdAt: now.toISOString(),
      workflowVersion: 1 as const,
      phase: 'initiating' as const,
      nodes: initialNodes(),
      pendingGate: null,
      redoGate: null,
      storyRedo: null,
      scriptRedo: null,
      activeUnlock: null,
      activeDraft: null,
      feOverride: null,
      preflight: null,
      saved: false,
    }
    await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
    const session: ProjectSession = {
      dir,
      title,
      createdAt: now.toISOString(),
      lastOpenedAt: now.toISOString(),
    }
    await fsp.writeFile(sessionInfoFile(dir), JSON.stringify(session, null, 2), 'utf-8')
    writeSessionState({ currentDir: dir })
    return { dir }
  })
}

// project:open：切换当前会话；同时更新 .session.json 的 lastOpenedAt
export async function openProject(dir: string): Promise<{ ok: true }> {
  const root = workspaceRoot()
  const resolved = path.resolve(dir)
  // 路径硬边界：只允许打开工作区内的 project-* 目录
  if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith('project-')) {
    const err = new Error('非法的项目目录') as Error & { code: string }
    err.code = 'INVALID_PROJECT_DIR'
    throw err
  }
  try {
    await fsp.access(path.join(resolved, 'manifest.json'))
  } catch {
    const err = new Error('项目目录已损坏或不存在') as Error & { code: string }
    err.code = 'PROJECT_NOT_FOUND'
    throw err
  }
  return enqueue(async () => {
    const nowIso = new Date().toISOString()
    let info: Partial<ProjectSession> = {}
    try {
      info = JSON.parse(await fsp.readFile(sessionInfoFile(resolved), 'utf-8')) as Partial<ProjectSession>
    } catch {
      // 无 .session.json：补建
    }
    const session: ProjectSession = {
      dir: resolved,
      title: info.title || '新项目',
      createdAt: info.createdAt || nowIso,
      lastOpenedAt: nowIso,
    }
    await fsp.writeFile(sessionInfoFile(resolved), JSON.stringify(session, null, 2), 'utf-8')
    writeSessionState({ currentDir: resolved })
    return { ok: true as const }
  })
}
