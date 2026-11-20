import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fsp from 'node:fs/promises'
import type { ProjectManifest, ProjectSession } from '../../shared/types.js'
import { canvasStore } from '../canvas/store.js'
import { writeTextAtomic } from '../fs/atomic.js'
import { enqueue } from '../fs/write-queue.js'
import { resolveWorkspaceRoot } from '../settings/workspace.js'
import {
  allocateDir,
  readActiveSession,
  readSessionState,
} from './library.js'
import { parseManifest } from './manifest.js'

const PACKAGE_FILE = 'project-package.json'
const SNAPSHOTS_FILE = 'session-snapshots.json'
const SOURCES_FILE = 'session-sources.json'
const SESSION_FILE = '.session.json'

export interface SessionSnapshotMessage {
  info: { id: string; role: 'user' | 'assistant' }
  parts: unknown[]
}

export interface SessionSnapshot {
  sourceProjectId: string
  sourceSessionId: string
  exportedAt: string
  messages: SessionSnapshotMessage[]
}

export interface ProjectDetail {
  dir: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  status: string
  current: boolean
  snapshots: SessionSnapshot[]
}

interface PackageMetadata {
  schemaVersion: 1
  sourceProjectId: string
  exportedAt: string
}

function fail(code: string, message: string): never {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  throw error
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.lstat(target)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function assertRealDirectory(dir: string, code: string): Promise<void> {
  let stat
  try {
    stat = await fsp.lstat(dir)
  } catch {
    return fail(code, '项目目录不存在')
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    return fail(code, '项目路径必须是真实目录，不能是符号链接')
  }
}

export async function assertWorkspaceProject(dir: string): Promise<ProjectManifest> {
  const resolved = path.resolve(dir)
  const root = path.resolve(resolveWorkspaceRoot())
  if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith('project-')) {
    return fail('INVALID_PROJECT_DIR', '非法的项目目录')
  }
  await assertRealDirectory(resolved, 'PROJECT_NOT_FOUND')
  const manifest = await readProjectManifest(resolved)
  await canvasStore.assertReadable(resolved)
  return manifest
}

async function readJson(file: string, code: string): Promise<unknown> {
  let raw: string
  try {
    raw = await fsp.readFile(file, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    const wrapped = new Error(`JSON 文件损坏：${path.basename(file)}`) as Error & { code: string }
    wrapped.code = code
    throw wrapped
  }
}

function validateSnapshot(value: unknown): SessionSnapshot {
  if (!isRecord(value)
    || typeof value.sourceProjectId !== 'string'
    || !value.sourceProjectId
    || typeof value.sourceSessionId !== 'string'
    || !value.sourceSessionId
    || typeof value.exportedAt !== 'string'
    || !Array.isArray(value.messages)) {
    return fail('SESSION_SNAPSHOT_INVALID', '会话快照结构无效')
  }
  for (const message of value.messages) {
    if (!isRecord(message)
      || !isRecord(message.info)
      || typeof message.info.id !== 'string'
      || (message.info.role !== 'user' && message.info.role !== 'assistant')
      || !Array.isArray(message.parts)) {
      return fail('SESSION_SNAPSHOT_INVALID', '会话快照消息结构无效')
    }
  }
  return value as unknown as SessionSnapshot
}

async function readSnapshots(dir: string): Promise<SessionSnapshot[]> {
  const value = await readJson(path.join(dir, SNAPSHOTS_FILE), 'SESSION_SNAPSHOT_INVALID')
  if (value === null) return []
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.sessions)) {
    return fail('SESSION_SNAPSHOT_INVALID', '会话快照文件结构无效')
  }
  return value.sessions.map(validateSnapshot)
}

async function writeSnapshots(dir: string, sessions: SessionSnapshot[]): Promise<void> {
  await writeTextAtomic(
    path.join(dir, SNAPSHOTS_FILE),
    JSON.stringify({ schemaVersion: 1, sessions }, null, 2),
  )
}

async function readPackageMetadata(dir: string): Promise<PackageMetadata | null> {
  const value = await readJson(path.join(dir, PACKAGE_FILE), 'PROJECT_PACKAGE_INVALID')
  if (value === null) return null
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.sourceProjectId !== 'string'
    || !value.sourceProjectId
    || typeof value.exportedAt !== 'string') {
    return fail('PROJECT_PACKAGE_INVALID', '项目包元数据无效')
  }
  return value as unknown as PackageMetadata
}

async function readSession(dir: string): Promise<Partial<ProjectSession>> {
  const value = await readJson(path.join(dir, SESSION_FILE), 'PROJECT_SESSION_INVALID')
  if (value === null) return {}
  if (!isRecord(value)) return fail('PROJECT_SESSION_INVALID', '项目会话文件结构无效')
  return value as Partial<ProjectSession>
}

async function readProjectManifest(dir: string): Promise<ProjectManifest> {
  const value = await readJson(path.join(dir, 'manifest.json'), 'PROJECT_MANIFEST_INVALID')
  if (value === null) return fail('PROJECT_NOT_FOUND', 'manifest.json 不存在')
  return parseManifest(value, new Date().toISOString())
}

function excluded(relative: string): boolean {
  const parts = relative.split(path.sep)
  const name = parts[parts.length - 1]
  if (parts.some((part) => part === '.git' || part === 'node_modules' || part.startsWith('.sdg-staging-'))) return true
  if (parts.includes('资产') && parts.includes('缩略图')) return true
  if (name === 'comfy-jobs.json' || name === '.DS_Store') return true
  if (name === 'ai-service.json' || name === 'opencode.json' || name === 'opencode.jsonc') return true
  if (name.startsWith('.env')) return true
  if (/\.(key|pem|p12|pfx)$/i.test(name)) return true
  return name.endsWith('.tmp') || name.endsWith('.part')
}

async function preflightTree(source: string, relative = ''): Promise<void> {
  const current = path.join(source, relative)
  const stat = await fsp.lstat(current)
  if (stat.isSymbolicLink()) return fail('PROJECT_PACKAGE_SYMLINK', `项目包不能包含符号链接：${relative || '.'}`)
  if (!stat.isDirectory()) return fail('PROJECT_PACKAGE_INVALID', '项目包根路径必须是目录')
  const entries = await fsp.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    const childRelative = path.join(relative, entry.name)
    if (excluded(childRelative)) continue
    const child = path.join(source, childRelative)
    const childStat = await fsp.lstat(child)
    if (childStat.isSymbolicLink()) return fail('PROJECT_PACKAGE_SYMLINK', `项目包不能包含符号链接：${childRelative}`)
    if (childStat.isDirectory()) await preflightTree(source, childRelative)
    else if (!childStat.isFile()) return fail('PROJECT_PACKAGE_INVALID', `项目包包含不支持的特殊文件：${childRelative}`)
  }
}

async function copyTree(source: string, target: string, relative = ''): Promise<void> {
  const current = path.join(source, relative)
  const stat = await fsp.lstat(current)
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    return fail('PROJECT_PACKAGE_CHANGED', '复制期间项目目录结构发生变化')
  }
  const entries = await fsp.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    const childRelative = path.join(relative, entry.name)
    if (excluded(childRelative)) continue
    const sourceChild = path.join(source, childRelative)
    const targetChild = path.join(target, childRelative)
    const childStat = await fsp.lstat(sourceChild)
    if (childStat.isSymbolicLink()) return fail('PROJECT_PACKAGE_SYMLINK', `项目包不能包含符号链接：${childRelative}`)
    if (childStat.isDirectory()) {
      await fsp.mkdir(targetChild, { recursive: false })
      await copyTree(source, target, childRelative)
    } else if (childStat.isFile()) {
      await fsp.copyFile(sourceChild, targetChild)
    } else {
      return fail('PROJECT_PACKAGE_INVALID', `项目包包含不支持的特殊文件：${childRelative}`)
    }
  }
}

async function removeStaging(staging: string): Promise<void> {
  await fsp.rm(staging, { recursive: true, force: true }).catch(() => {})
}

export async function getProjectDetail(dir: string): Promise<ProjectDetail> {
  const resolved = path.resolve(dir)
  const manifest = await assertWorkspaceProject(resolved)
  const session = await readSession(resolved)
  const createdAt = session.createdAt || manifest.createdAt
  return {
    dir: resolved,
    projectId: path.basename(resolved),
    title: session.title || '新项目',
    createdAt,
    updatedAt: manifest.updatedAt,
    lastOpenedAt: session.lastOpenedAt || createdAt,
    status: manifest.status,
    current: readSessionState().currentDir === resolved,
    snapshots: await readSnapshots(resolved),
  }
}

export async function importProject(sourceDir: string): Promise<{ dir: string }> {
  const source = path.resolve(sourceDir)
  const workspace = path.resolve(resolveWorkspaceRoot())
  if (inside(workspace, source)) return fail('PROJECT_IMPORT_INSIDE_WORKSPACE', '请选择工作区外的项目目录导入')
  await assertRealDirectory(source, 'PROJECT_NOT_FOUND')
  const manifest = await readProjectManifest(source)
  const metadata = await readPackageMetadata(source)
  const expectedProjectId = metadata?.sourceProjectId || path.basename(source)
  await canvasStore.assertReadable(source, expectedProjectId)
  await preflightTree(source)
  const finalDir = await allocateDir()
  const staging = path.join(workspace, `.sdg-staging-${randomUUID()}`)
  let committed = false
  try {
    await fsp.mkdir(staging, { recursive: false })
    await copyTree(source, staging)
    const sourceSession = await readSession(source)
    const now = new Date().toISOString()
    const title = sourceSession.title?.trim() || '新项目'
    const session: ProjectSession = {
      dir: finalDir,
      title,
      createdAt: sourceSession.createdAt || manifest.createdAt,
      lastOpenedAt: now,
      activeSessionId: null,
    }
    await writeTextAtomic(path.join(staging, SESSION_FILE), JSON.stringify(session, null, 2))
    const canvasFile = path.join(staging, 'canvas.json')
    if (await pathExists(canvasFile)) {
      const canvas = JSON.parse(await fsp.readFile(canvasFile, 'utf-8')) as { projectId: string; title: string }
      canvas.projectId = path.basename(finalDir)
      canvas.title = title
      await writeTextAtomic(canvasFile, JSON.stringify(canvas, null, 2))
    }
    const packageMetadata: PackageMetadata = {
      schemaVersion: 1,
      sourceProjectId: path.basename(finalDir),
      exportedAt: now,
    }
    await writeTextAtomic(path.join(staging, PACKAGE_FILE), JSON.stringify(packageMetadata, null, 2))
    await fsp.rename(staging, finalDir)
    committed = true
    return { dir: finalDir }
  } finally {
    if (!committed) await removeStaging(staging)
  }
}

export async function exportProject(
  dir: string,
  destinationDir: string,
  loadMessages: (sessionId: string) => Promise<SessionSnapshotMessage[]>,
): Promise<{ exportDir: string; sessionSnapshotExported: boolean }> {
  const source = path.resolve(dir)
  const destination = path.resolve(destinationDir)
  const workspace = path.resolve(resolveWorkspaceRoot())
  await assertWorkspaceProject(source)
  if (inside(workspace, destination)) return fail('PROJECT_EXPORT_IN_WORKSPACE', '导出目标必须在工作区外')
  if (inside(source, destination) || inside(destination, source)) {
    return fail('PROJECT_EXPORT_OVERLAP', '导出目标不能与源项目重叠')
  }
  if (await pathExists(destination)) return fail('PROJECT_EXPORT_EXISTS', '导出目标已存在，拒绝覆盖')
  const parent = path.dirname(destination)
  await assertRealDirectory(parent, 'PROJECT_EXPORT_PARENT_INVALID')
  await preflightTree(source)
  const staging = path.join(parent, `.sdg-staging-${randomUUID()}`)
  let committed = false
  return enqueue(async () => {
    try {
      const { sessionId } = await readActiveSession(source)
      let currentSnapshot: SessionSnapshot | null = null
      if (sessionId) {
        const messages = await loadMessages(sessionId)
        currentSnapshot = {
          sourceProjectId: path.basename(source),
          sourceSessionId: sessionId,
          exportedAt: new Date().toISOString(),
          messages,
        }
      }
      await fsp.mkdir(staging, { recursive: false })
      await copyTree(source, staging)
      const sourceSession = await readSession(source)
      const session: ProjectSession = {
        dir: '',
        title: sourceSession.title || '新项目',
        createdAt: sourceSession.createdAt || new Date().toISOString(),
        lastOpenedAt: sourceSession.lastOpenedAt || sourceSession.createdAt || new Date().toISOString(),
        activeSessionId: null,
      }
      await writeTextAtomic(path.join(staging, SESSION_FILE), JSON.stringify(session, null, 2))
      const metadata: PackageMetadata = {
        schemaVersion: 1,
        sourceProjectId: path.basename(source),
        exportedAt: new Date().toISOString(),
      }
      await writeTextAtomic(path.join(staging, PACKAGE_FILE), JSON.stringify(metadata, null, 2))
      const snapshots = await readSnapshots(staging)
      if (currentSnapshot) {
        const index = snapshots.findIndex((item) => item.sourceSessionId === currentSnapshot!.sourceSessionId)
        if (index >= 0) snapshots[index] = currentSnapshot
        else snapshots.push(currentSnapshot)
        await writeSnapshots(staging, snapshots)
      }
      await fsp.rename(staging, destination)
      committed = true
      return { exportDir: destination, sessionSnapshotExported: Boolean(currentSnapshot) }
    } finally {
      if (!committed) await removeStaging(staging)
    }
  })
}

export async function recordSessionSource(dir: string, sessionId: string): Promise<void> {
  const resolved = path.resolve(dir)
  await assertWorkspaceProject(resolved)
  const snapshots = await readSnapshots(resolved)
  if (snapshots.length === 0) return
  const sourceSessionId = snapshots[snapshots.length - 1].sourceSessionId
  await enqueue(async () => {
    const value = await readJson(path.join(resolved, SOURCES_FILE), 'SESSION_SOURCE_INVALID')
    let sources: Array<{ sessionId: string; sourceSessionId: string; createdAt: string }> = []
    if (value !== null) {
      if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.sources)) {
        return fail('SESSION_SOURCE_INVALID', '会话来源文件结构无效')
      }
      sources = value.sources.map((item) => {
        if (!isRecord(item)
          || typeof item.sessionId !== 'string'
          || typeof item.sourceSessionId !== 'string'
          || typeof item.createdAt !== 'string') {
          return fail('SESSION_SOURCE_INVALID', '会话来源记录无效')
        }
        return item as unknown as { sessionId: string; sourceSessionId: string; createdAt: string }
      })
    }
    if (sources.some((item) => item.sessionId === sessionId)) return
    sources.push({ sessionId, sourceSessionId, createdAt: new Date().toISOString() })
    await writeTextAtomic(
      path.join(resolved, SOURCES_FILE),
      JSON.stringify({ schemaVersion: 1, sources }, null, 2),
    )
  })
}
