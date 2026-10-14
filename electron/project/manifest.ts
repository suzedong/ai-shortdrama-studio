// feature-801 · manifest 阶段状态机（设计书 §7.1 L546–596）
// manifest.json 是「阶段状态指针」：每次定稿读-改-写推进一格；永不归档、不进 版本/。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type {
  ManifestEvent, ManifestStatus, ManifestTick, ProjectManifest,
} from '../../shared/types.js'
import { enqueue } from '../fs/write-queue.js'
import { getActiveProjectDir } from './current.js'

export const MANIFEST_FILE = 'manifest.json'

const MANIFEST_STATUSES: readonly ManifestStatus[] = [
  'initiating',
  'story-outline',
  'story-profiles',
  'script-scenes',
  'script-dialogue',
  'script-storyboard',
  'storyboard-done',
]

// 顺序即设计书 L581-582 链；index 差恒为 1
export const MANIFEST_TRANSITIONS: Record<
  ManifestEvent,
  { from: ManifestStatus; to: ManifestStatus }
> = {
  'brief-published': { from: 'initiating', to: 'story-outline' },
  'outline-approved': { from: 'story-outline', to: 'story-profiles' },
  'profiles-approved': { from: 'story-profiles', to: 'script-scenes' },
  'scenes-approved': { from: 'script-scenes', to: 'script-dialogue' },
  'dialogue-approved': { from: 'script-dialogue', to: 'script-storyboard' },
  'storyboard-finalized': { from: 'script-storyboard', to: 'storyboard-done' },
}

export type AdvanceOutcome =
  | { advanced: true; next: ManifestStatus }
  | { advanced: false; reason: 'already-there' | 'bad-transition' | 'terminal' }

// 纯函数：不触盘。成功给 next；重复给 already-there；终态给 terminal；其余乱序给 bad-transition。
export function advanceStatus(
  current: ManifestStatus,
  event: ManifestEvent,
): AdvanceOutcome {
  const edge = MANIFEST_TRANSITIONS[event]
  if (edge.from === current) return { advanced: true, next: edge.to }
  if (edge.to === current) return { advanced: false, reason: 'already-there' }
  if (current === 'storyboard-done') return { advanced: false, reason: 'terminal' }
  return { advanced: false, reason: 'bad-transition' }
}

// 磁盘形状 = 公共类型 + 读时透传的未知历史字段（phase/nodes/...；类型层不声明）
type PersistedManifest = ProjectManifest & Record<string, unknown>

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

// 容错解析（契约 §5）：非法值回退默认；未知字段 ...rest 透传保留。纯函数。
export function parseManifest(raw: unknown, fallbackNow: string): PersistedManifest {
  const obj = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const status: ManifestStatus = MANIFEST_STATUSES.includes(obj.status as ManifestStatus)
    ? (obj.status as ManifestStatus)
    : 'initiating'
  const createdAt = nonEmptyString(obj.createdAt) ? obj.createdAt : fallbackNow
  const updatedAt = nonEmptyString(obj.updatedAt) ? obj.updatedAt : createdAt
  const statusHistory = Array.isArray(obj.statusHistory)
    ? obj.statusHistory.filter((t): t is ManifestTick => {
      if (!t || typeof t !== 'object') return false
      const item = t as Record<string, unknown>
      return nonEmptyString(item.event) && nonEmptyString(item.from)
        && nonEmptyString(item.to) && nonEmptyString(item.at)
    })
    : []

  // feature-002：旧档缺字段读默认 null；仅接受 ≥1 整数
  const briefVersion = typeof obj.briefVersion === 'number'
    && Number.isInteger(obj.briefVersion) && obj.briefVersion >= 1
    ? obj.briefVersion
    : null

  const {
    status: _s, createdAt: _c, workflowVersion: _w,
    updatedAt: _u, statusHistory: _h, briefVersion: _bv, ...rest
  } = obj
  return {
    ...rest, status, createdAt, workflowVersion: 1, updatedAt, statusHistory, briefVersion,
  }
}

// feature-002 纯函数：推进立项版本指针（再版不是阶段事件，不动 status/statusHistory）。
export function applyBriefVersion(
  m: ProjectManifest,
  version: number,
  now: string,
): ProjectManifest {
  return { ...m, briefVersion: version, updatedAt: now }
}

function activeDir(): string {
  try {
    return getActiveProjectDir()
  } catch (e) {
    // current.ts 现状以 INVALID_ARGUMENT 表达「无激活项目」，对外统一为契约错误码
    if ((e as { code?: string }).code === 'INVALID_ARGUMENT') {
      throw Object.assign(new Error('当前没有打开的项目'), { code: 'NO_ACTIVE_PROJECT' })
    }
    throw e
  }
}

async function readRawManifest(): Promise<{ dir: string; manifest: PersistedManifest }> {
  const dir = activeDir()
  let text: string
  try {
    text = await fsp.readFile(path.join(dir, MANIFEST_FILE), 'utf-8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw Object.assign(new Error('manifest.json 不存在'), { code: 'PROJECT_NOT_FOUND' })
    }
    throw e
  }
  let raw: unknown = {}
  try {
    raw = JSON.parse(text)
  } catch {
    // 损坏 JSON：按空对象容错
  }
  return { dir, manifest: parseManifest(raw, new Date().toISOString()) }
}

// 只读：返回当前激活项目的 manifest（不写文件）
export async function readManifest(): Promise<ProjectManifest> {
  const { manifest } = await readRawManifest()
  return manifest
}

// 整文件写回（pretty JSON，2 空格）；不归档。调用方负责保留未知字段。
export async function writeManifest(
  obj: ProjectManifest & Record<string, unknown>,
): Promise<void> {
  const dir = activeDir()
  await enqueue(async () => {
    await fsp.writeFile(path.join(dir, MANIFEST_FILE), JSON.stringify(obj, null, 2), 'utf-8')
  })
}

export interface AdvanceManifestResult {
  advanced: boolean
  status: ManifestStatus
  manifest: ProjectManifest
  reason?: 'already-there'
}

// 读 → advanceStatus → 条件写，全程在同一串行写队列内。
// already-there 不写盘；bad-transition / terminal 以对应 code throw（由工具层包信封）。
export async function advanceManifest(event: ManifestEvent): Promise<AdvanceManifestResult> {
  return enqueue(async () => {
    const { dir, manifest } = await readRawManifest()
    const outcome = advanceStatus(manifest.status, event)
    if (!outcome.advanced) {
      if (outcome.reason === 'already-there') {
        return { advanced: false, status: manifest.status, manifest, reason: 'already-there' }
      }
      const code = outcome.reason === 'terminal' ? 'MANIFEST_TERMINAL' : 'MANIFEST_BAD_TRANSITION'
      throw Object.assign(
        new Error(`manifest 当前状态 ${manifest.status} 不接受事件 ${event}`),
        { code },
      )
    }
    const now = new Date().toISOString()
    const next: PersistedManifest = {
      ...manifest,
      status: outcome.next,
      updatedAt: now,
      statusHistory: [
        ...manifest.statusHistory,
        { event, from: manifest.status, to: outcome.next, at: now },
      ],
    }
    await fsp.writeFile(path.join(dir, MANIFEST_FILE), JSON.stringify(next, null, 2), 'utf-8')
    return { advanced: true, status: outcome.next, manifest: next }
  })
}
