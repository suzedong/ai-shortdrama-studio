import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { registerPureTools } from '../../../electron/mcp/tools'
import { createProject, writeSessionState } from '../../../electron/project/library'
import type { ProjectManifest } from '@shared/types'

type Handler = (args: Record<string, unknown>) => Promise<{
  content: { text: string }[]
  isError?: boolean
}>

function buildFakeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    tool: (name: string, ...rest: unknown[]) => {
      handlers.set(name, rest[rest.length - 1] as Handler)
    },
  }
  return { server: server as never, handlers }
}

let handlers: Map<string, Handler>
let projDir = ''

async function call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T & { ok: boolean; error?: { code: string; message: string } }> {
  const r = await handlers.get(name)!(args)
  return JSON.parse(r.content[0]!.text)
}

async function readManifestFile(): Promise<ProjectManifest & Record<string, unknown>> {
  return JSON.parse(await fsp.readFile(path.join(projDir, 'manifest.json'), 'utf-8'))
}

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-manifest-tools-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
  // createProject 既建 manifest 新形状，也切换激活项目
  const created = await createProject()
  projDir = created.dir
})

describe('feature-801 manifest MCP 工具（契约 §3）', () => {
  it('createProject 产出新形状 manifest：无 phase/nodes 等 11 个骨架字段', async () => {
    const m = await readManifestFile()
    expect(m.status).toBe('initiating')
    expect(m.workflowVersion).toBe(1)
    expect(m.statusHistory).toEqual([])
    expect(m.updatedAt).toBe(m.createdAt)
    for (const k of ['phase', 'nodes', 'pendingGate', 'redoGate', 'storyRedo', 'scriptRedo', 'activeUnlock', 'activeDraft', 'feOverride', 'preflight', 'saved']) {
      expect(k in m).toBe(false)
    }
  })

  it('manifest.get 返回当前 manifest', async () => {
    const r = await call<{ manifest: ProjectManifest }>('manifest.get')
    expect(r.ok).toBe(true)
    expect(r.manifest.status).toBe('initiating')
    expect(r.manifest.statusHistory).toEqual([])
  })

  it('advance 五事件落盘推进：status/tick/updatedAt/statusHistory 长度，全程不归档', async () => {
    const events = ['outline-approved', 'profiles-approved', 'scenes-approved', 'dialogue-approved']
    const statuses = ['story-profiles', 'script-scenes', 'script-dialogue', 'script-storyboard']
    // 首格由 brief-published 触发
    const first = await call<{ status: string }>('manifest.advance', { event: 'brief-published' })
    expect(first.ok).toBe(true)
    expect(first.status).toBe('story-outline')

    for (let i = 0; i < events.length; i++) {
      const r = await call<{ advanced: boolean; status: string }>('manifest.advance', { event: events[i] })
      expect(r.ok).toBe(true)
      expect(r.advanced).toBe(true)
      expect(r.status).toBe(statuses[i])
    }

    const onDisk = await readManifestFile()
    expect(onDisk.status).toBe('script-storyboard')
    expect(onDisk.statusHistory).toHaveLength(5)
    expect(onDisk.statusHistory[0]).toMatchObject({ event: 'brief-published', from: 'initiating', to: 'story-outline' })
    expect(onDisk.statusHistory[4]).toMatchObject({ event: 'dialogue-approved', from: 'script-dialogue', to: 'script-storyboard' })
    expect(typeof onDisk.updatedAt).toBe('string')
    // 永不归档：项目根无 版本/ 目录、无 manifest 归档副本
    const files = await fsp.readdir(projDir)
    expect(files).toContain('manifest.json')
    expect(files.some(f => f.includes('版本'))).toBe(false)
  })

  it('幂等：同事件在 to 态重复 → advanced:false/already-there，不追加 tick、不重写', async () => {
    const before = await readManifestFile()
    const r = await call<{ advanced: boolean; reason?: string; status: string }>(
      'manifest.advance',
      { event: 'dialogue-approved' },
    )
    expect(r.ok).toBe(true)
    expect(r.advanced).toBe(false)
    expect(r.reason).toBe('already-there')
    expect(r.status).toBe('script-storyboard')
    const after = await readManifestFile()
    expect(after.statusHistory).toHaveLength(5)
    expect(after.updatedAt).toBe(before.updatedAt)
  })

  it('乱序：跳格事件 → MANIFEST_BAD_TRANSITION 且文件不变', async () => {
    const before = await readManifestFile()
    const r = await call('manifest.advance', { event: 'brief-published' })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('MANIFEST_BAD_TRANSITION')
    const after = await readManifestFile()
    expect(after.statusHistory).toHaveLength(5)
    expect(after.updatedAt).toBe(before.updatedAt)
  })

  it('终态：末格推进到 storyboard-done 后，其他事件 → MANIFEST_TERMINAL', async () => {
    const fin = await call<{ advanced: boolean; status: string }>(
      'manifest.advance',
      { event: 'storyboard-finalized' },
    )
    expect(fin.ok).toBe(true)
    expect(fin.status).toBe('storyboard-done')

    const r = await call('manifest.advance', { event: 'outline-approved' })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('MANIFEST_TERMINAL')

    // 末事件本身在终态上幂等
    const idem = await call<{ advanced: boolean; reason?: string }>(
      'manifest.advance',
      { event: 'storyboard-finalized' },
    )
    expect(idem.advanced).toBe(false)
    expect(idem.reason).toBe('already-there')
  })

  it('无激活项目 → NO_ACTIVE_PROJECT', async () => {
    writeSessionState({ currentDir: null })
    const r = await call('manifest.get')
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('NO_ACTIVE_PROJECT')
    const a = await call('manifest.advance', { event: 'brief-published' })
    expect(a.ok).toBe(false)
    expect(a.error?.code).toBe('NO_ACTIVE_PROJECT')
  })

  it('旧骨架 manifest 容错：status 合法时补 statusHistory:[]，advance 后未知字段原样保留', async () => {
    const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-manifest-legacy-'))
    const legacyDir = path.join(tmpRoot, 'project-legacy')
    await fsp.mkdir(legacyDir, { recursive: true })
    await fsp.writeFile(path.join(legacyDir, 'manifest.json'), JSON.stringify({
      status: 'initiating',
      createdAt: '2026-01-01T00:00:00.000Z',
      workflowVersion: 1,
      phase: 'initiating',
      nodes: { idea: 'active' },
      pendingGate: null, saved: false,
    }), 'utf-8')
    writeSessionState({ currentDir: legacyDir })

    const got = await call<{ manifest: ProjectManifest & Record<string, unknown> }>('manifest.get')
    expect(got.manifest.status).toBe('initiating')
    expect(got.manifest.statusHistory).toEqual([])
    expect(got.manifest.phase).toBe('initiating')

    const r = await call<{ advanced: boolean; status: string }>('manifest.advance', { event: 'brief-published' })
    expect(r.ok).toBe(true)
    expect(r.status).toBe('story-outline')

    const onDisk = JSON.parse(await fsp.readFile(path.join(legacyDir, 'manifest.json'), 'utf-8')) as Record<string, unknown>
    expect(onDisk.status).toBe('story-outline')
    expect((onDisk.statusHistory as unknown[]).length).toBe(1)
    // 旧字段不迁移、不丢弃
    expect(onDisk.phase).toBe('initiating')
    expect(onDisk.nodes).toEqual({ idea: 'active' })
    expect(onDisk.saved).toBe(false)
  })
})
