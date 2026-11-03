// feature-813 · 工作区根目录设置 store（应用级：<userData>/workspace.json）
// 契约：docs/features/feature-813-工作目录更换/SDG-RE-契约.md §1/§2
// - 单一全局根：resolveWorkspaceRoot() = 落盘 rootDir ?? 默认根（~/Documents/ai-shortdrama-studio）；
// - changeDir 十步流程（契约 §2.3）：校验 → 冲突预检（零写盘）→ 逐项 rename + 失败回滚
//   → session-state 重映射 → store 落盘（先重映射后落盘，保证失败可重试修复）；
// - 跨磁盘（EXDEV）不在本期支持，固定文案；非 project-* 文件一律不搬；
// - session-state 读写本地实现（形状 = shared/types.ts SessionStateFile { currentDir: string | null }），
//   避免与 project/library.ts 循环依赖（调用期使用，形状稳定）；
// - 写路径仿 feature-014：enqueue 写队列串行 + archiveExisting 覆盖前归档。
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { app, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { enqueue } from '../fs/write-queue.js'
import { archiveExisting } from '../fs/archive.js'

// -- 形状（契约 §1.1 / §2.1 / §2.3） ------------------------------------------------

export interface WorkspaceFile {
  version: 1
  rootDir?: string
  updatedAt: string
}

export interface WorkspaceSettingsView {
  root: string
  defaultRoot: string
  source: 'store' | 'default'
  updatedAt?: string
}

export interface WorkspaceChangeResult {
  ok: true
  root: string
  moved: string[]
  movedCount: number
}

// -- 默认根与 store（契约 §1） -------------------------------------------------------

export function defaultWorkspaceRoot(): string {
  return path.join(app.getPath('documents'), 'ai-shortdrama-studio')
}

let cache: WorkspaceFile | null = null

function storeFile(): string {
  return path.join(app.getPath('userData'), 'workspace.json')
}

function load(): WorkspaceFile {
  if (!cache) cache = readFromDisk()
  return cache
}

function readFromDisk(): WorkspaceFile {
  const now = new Date().toISOString()
  try {
    const data = JSON.parse(fs.readFileSync(storeFile(), 'utf-8')) as Partial<WorkspaceFile>
    const rootDir =
      typeof data.rootDir === 'string' && data.rootDir.trim() !== '' ? data.rootDir.trim() : undefined
    return {
      version: 1,
      ...(rootDir ? { rootDir } : {}),
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : now,
    }
  } catch {
    return { version: 1, updatedAt: now }
  }
}

/** 仅测试用：清空内存副本，下次访问重新读盘 */
export function __resetWorkspaceCacheForTests(): void {
  cache = null
}

// -- 解析（契约 §1.2） ---------------------------------------------------------------

function validRootDir(f: WorkspaceFile): string | undefined {
  const v = f.rootDir
  return v && path.isAbsolute(v) ? v : undefined
}

export function resolveWorkspaceRoot(): string {
  return validRootDir(load()) ?? defaultWorkspaceRoot()
}

export function getSettingsView(): WorkspaceSettingsView {
  const f = load()
  const defaultRoot = defaultWorkspaceRoot()
  const stored = validRootDir(f)
  if (stored) {
    return { root: stored, defaultRoot, source: 'store', updatedAt: f.updatedAt }
  }
  return { root: defaultRoot, defaultRoot, source: 'default' }
}

// -- 错误 -----------------------------------------------------------------------------

function makeError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

// -- 目录选择（契约 §2.2） --------------------------------------------------------------

export async function pickDir(window: BrowserWindow): Promise<{ dir: string | null }> {
  const res = await dialog.showOpenDialog(window, {
    title: '选择工作区根目录',
    properties: ['openDirectory'],
  })
  if (res.canceled || res.filePaths.length === 0) return { dir: null }
  return { dir: res.filePaths[0] }
}

// -- session-state 重映射（契约 §2.3-9；形状同 project/library.ts 的 session-state） --

function sessionStateFile(): string {
  return path.join(app.getPath('userData'), 'session-state.json')
}

function readSessionCurrentDir(): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionStateFile(), 'utf-8')) as { currentDir?: unknown }
    return typeof parsed.currentDir === 'string' ? parsed.currentDir : null
  } catch {
    return null
  }
}

function writeSessionCurrentDir(dir: string): void {
  fs.mkdirSync(path.dirname(sessionStateFile()), { recursive: true })
  fs.writeFileSync(sessionStateFile(), JSON.stringify({ currentDir: dir }, null, 2), 'utf-8')
}

// -- changeDir（契约 §2.3） --------------------------------------------------------------

function scanProjectDirs(root: string): Promise<string[]> {
  return fsp
    .readdir(root, { withFileTypes: true })
    .then(entries =>
      entries.filter(e => e.isDirectory() && e.name.startsWith('project-')).map(e => e.name),
    )
}

export async function changeDir(dir: string): Promise<WorkspaceChangeResult> {
  // 步骤 1：参数校验（零写盘）
  if (typeof dir !== 'string' || dir.trim() === '') {
    throw makeError('INVALID_ARGUMENT', '缺少目标目录：dir 须为非空字符串')
  }
  if (!path.isAbsolute(dir.trim())) {
    throw makeError('INVALID_ARGUMENT', '目标目录须为绝对路径')
  }
  const R1 = path.resolve(dir.trim())
  const R0 = resolveWorkspaceRoot()
  // 步骤 3/4
  if (R1 === R0) throw makeError('INVALID_ARGUMENT', '与当前根目录相同，无需更换')
  if (R1.startsWith(R0 + path.sep)) {
    throw makeError('INVALID_ARGUMENT', '新根目录不能位于当前根目录内')
  }

  return enqueue(async () => {
    // 步骤 5：目标目录存在且为目录
    let st: fs.Stats
    try {
      st = await fsp.stat(R1)
    } catch {
      throw makeError('WORKSPACE_NOT_FOUND', '目标目录不存在或不是目录')
    }
    if (!st.isDirectory()) {
      throw makeError('WORKSPACE_NOT_FOUND', '目标目录不存在或不是目录')
    }

    // 步骤 6：扫描旧根（不存在 / 不可读按 0 项）
    let projects: string[] = []
    try {
      projects = await scanProjectDirs(R0)
    } catch {
      projects = []
    }

    // 步骤 7：冲突预检（零写盘）
    const conflicts: string[] = []
    for (const p of projects) {
      try {
        await fsp.access(path.join(R1, p))
        conflicts.push(p)
      } catch {
        // 不存在
      }
    }
    if (conflicts.length > 0) {
      throw makeError('WORKSPACE_TARGET_EXISTS', `目标根目录已存在同名项目：${conflicts.join('、')}`)
    }

    // 步骤 8：逐项搬移；失败回滚已搬移项
    const moved: string[] = []
    try {
      for (const p of projects) {
        await fsp.rename(path.join(R0, p), path.join(R1, p))
        moved.push(p)
      }
    } catch (e) {
      const rollbackErrors: unknown[] = []
      for (let i = moved.length - 1; i >= 0; i -= 1) {
        try {
          await fsp.rename(path.join(R1, moved[i]), path.join(R0, moved[i]))
        } catch (rb) {
          rollbackErrors.push(rb)
        }
      }
      const original = e instanceof Error ? e : new Error(String(e))
      const exdev = (original as NodeJS.ErrnoException).code === 'EXDEV'
      const err = makeError(
        'WORKSPACE_MOVE_FAILED',
        exdev
          ? '不支持跨磁盘搬移，请选择与当前根目录同磁盘的目标目录'
          : `搬移失败：${original.message}`,
      )
      if (rollbackErrors.length > 0) {
        ;(err as unknown as Error & { rollbackErrors: unknown[] }).rollbackErrors = rollbackErrors
      }
      throw err
    }

    // 步骤 9：提交阶段（先 session-state 重映射，后 store 落盘）
    try {
      const cur = readSessionCurrentDir()
      if (cur !== null && path.dirname(cur) === R0) {
        writeSessionCurrentDir(path.join(R1, path.basename(cur)))
      }
      const next: WorkspaceFile = {
        version: 1,
        rootDir: R1,
        updatedAt: new Date().toISOString(),
      }
      const file = storeFile()
      await fsp.mkdir(path.dirname(file), { recursive: true })
      await archiveExisting(file, new Date())
      await fsp.writeFile(file, JSON.stringify(next, null, 2), 'utf-8')
      cache = next
    } catch (e) {
      throw makeError(
        'WORKSPACE_PERSIST_FAILED',
        `工作区设置落盘失败：${e instanceof Error ? e.message : String(e)}（项目已移至新目录，重新执行同一次更换即可修复设置）`,
      )
    }

    // 步骤 10
    return { ok: true as const, root: R1, moved, movedCount: moved.length }
  })
}
