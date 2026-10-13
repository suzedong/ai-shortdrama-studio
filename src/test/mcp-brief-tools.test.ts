import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { registerPureTools } from '../../electron/mcp/tools'
import { writeSessionState } from '../../electron/project/library'
import { canvasStore } from '../../electron/canvas/store'
import type { BriefDraft, ProjectBrief } from '@shared/types'

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

let projDir = ''
let handlers: Map<string, Handler>

async function call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T & { ok: boolean; error?: { code: string; message: string } }> {
  const r = await handlers.get(name)!(args)
  return JSON.parse(r.content[0]!.text)
}

const draft: BriefDraft = {
  kind: 'commercial',
  fiveElements: {
    genre: '甜宠', platforms: ['抖音'], episodeDuration: '90 秒',
    episodeCount: '80 集', tone: '高甜', aspectRatio: '竖屏 9:16',
  },
  premise: {
    leads: '28 岁女白领 / 30 岁男医生', time: '2024 年', place: '上海',
    coreEvent: '医院重逢', seasonBoundary: '第一季只讲相识',
  },
  style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
  diagnosisSummary: '赛道可行',
}

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-brief-tools-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project-1')
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
  canvasStore.reset()
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
})

describe('feature-001 brief MCP 工具（契约 §3）', () => {
  it('brief.plan 空项目：ready=false、nextVersion=1、latestVersion=null，且不写盘', async () => {
    const r = await call<{ plan: { ready: boolean; nextVersion: number; latestVersion: number | null; missing: unknown[] } }>(
      'brief.plan',
      { kind: null },
    )
    expect(r.ok).toBe(true)
    expect(r.plan.ready).toBe(false)
    expect(r.plan.nextVersion).toBe(1)
    expect(r.plan.latestVersion).toBeNull()
    expect(r.plan.missing.length).toBeGreaterThan(0)
    await expect(fsp.readdir(projDir)).resolves.toEqual([])
  })

  it('未就绪 publish → BRIEF_NOT_READY，不落盘不建节点', async () => {
    const r = await call('brief.publish', { ...draft, fiveElements: { ...draft.fiveElements, genre: '' } })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('BRIEF_NOT_READY')
    expect(await fsp.readdir(projDir)).toEqual([])
    expect((await canvasStore.get()).nodes).toEqual([])
  })

  it('口头拍板无 quote → INVALID_ARGUMENT', async () => {
    const r = await call('brief.publish', { ...draft, approve: { by: 'verbal' } })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('INVALID_ARGUMENT')
  })

  it('v1 双写 json+md、节点 step-0-brief upsert 指向 v1', async () => {
    const r = await call<{ version: number; jsonPath: string; mdPath: string; changesFromPrevious: unknown[] }>(
      'brief.publish',
      { ...draft, approve: { by: 'gate' } },
    )
    expect(r.ok).toBe(true)
    expect(r.version).toBe(1)
    expect(r.jsonPath).toBe('立项单.v1.json')
    expect(r.mdPath).toBe('立项单.v1.md')
    expect(r.changesFromPrevious).toEqual([])

    const brief = JSON.parse(await fsp.readFile(path.join(projDir, r.jsonPath), 'utf-8')) as ProjectBrief
    expect(brief.schemaVersion).toBe(2)
    expect(brief.version).toBe(1)
    expect(brief.approve).toMatchObject({ by: 'gate' })
    expect(brief.publishedAt).toBeTruthy()

    const md = await fsp.readFile(path.join(projDir, r.mdPath), 'utf-8')
    expect(md).toContain('# 立项单 v1')
    expect(md).toContain('首版立项')

    const canvas = await canvasStore.get()
    const node = canvas.nodes.find(n => n.id === 'step-0-brief')
    expect(node).toMatchObject({
      step: '0', kind: 'brief', status: 'done',
      title: '立项单 v1',
      ref: { path: '立项单.v1.json', format: 'json' },
      meta: { version: 'v1' },
    })
    // STAGE 0 不自动连边
    expect(canvas.edges).toEqual([])
  })

  it('v2 不覆盖 v1：新文件双写、diff 有内容、节点同 id 更新指向 v2', async () => {
    const r = await call<{ version: number; changesFromPrevious: { field: string; from: string; to: string }[] }>(
      'brief.publish',
      {
        ...draft,
        fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
        approve: { by: 'verbal', verbal: { quote: '行，就这样' } },
      },
    )
    expect(r.ok).toBe(true)
    expect(r.version).toBe(2)
    expect(r.changesFromPrevious).toContainEqual({ field: 'fiveElements.episodeCount', from: '80 集', to: '100 集' })

    const files = await fsp.readdir(projDir)
    expect(files.filter(f => /^立项单\.v\d+\.(json|md)$/.test(f)).sort()).toEqual(
      ['立项单.v1.json', '立项单.v1.md', '立项单.v2.json', '立项单.v2.md'],
    )
    const brief2 = JSON.parse(await fsp.readFile(path.join(projDir, '立项单.v2.json'), 'utf-8')) as ProjectBrief
    expect(brief2.approve).toMatchObject({ by: 'verbal', verbal: { quote: '行，就这样' } })

    const canvas = await canvasStore.get()
    expect(canvas.nodes).toHaveLength(1)
    expect(canvas.nodes[0]).toMatchObject({
      id: 'step-0-brief', title: '立项单 v2',
      ref: { path: '立项单.v2.json' }, meta: { version: 'v2' },
    })
  })

  it('重复 publish 幂等 upsert，版本号继续单调递增（v3）', async () => {
    const r = await call<{ version: number }>('brief.publish', {
      ...draft,
      fiveElements: { ...draft.fiveElements, episodeCount: '100 集' },
      approve: { by: 'gate', note: '再发一次' },
    })
    expect(r.version).toBe(3)
    const canvas = await canvasStore.get()
    expect(canvas.nodes).toHaveLength(1)
  })

  it('brief.list 返回 v1..v3 升序、latestVersion=3', async () => {
    const r = await call<{
      versions: { version: number; kind: string; approveBy: string }[]
      latestVersion: number
      warnings: string[]
    }>('brief.list')
    expect(r.ok).toBe(true)
    expect(r.versions.map(v => v.version)).toEqual([1, 2, 3])
    expect(r.versions[1]).toMatchObject({ kind: 'commercial', approveBy: 'verbal' })
    expect(r.latestVersion).toBe(3)
    expect(r.warnings).toEqual([])
  })

  it('brief.plan 就绪草案：ready=true、nextVersion=4、diff 相对 v3', async () => {
    const r = await call<{ plan: { ready: boolean; nextVersion: number; changesFromPrevious: unknown[] } }>(
      'brief.plan',
      draft,
    )
    expect(r.plan.ready).toBe(true)
    expect(r.plan.nextVersion).toBe(4)
    expect(r.plan.changesFromPrevious).toContainEqual(
      expect.objectContaining({ field: 'fiveElements.episodeCount' }),
    )
  })
})
