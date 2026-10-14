import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData, isPackaged: false },
}))

import { registerPureTools } from '../../electron/mcp/tools'
import { writeSessionState } from '../../electron/project/library'
import { canvasStore } from '../../electron/canvas/store'
import { clearStyleCatalogCache, STYLE_CATALOG_MISSING } from '../../electron/style/loader'
import type { BriefDraft } from '@shared/types'

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

async function call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T & { ok: boolean; error?: { code: string; message: string } }> {
  const r = await handlers.get(name)!(args)
  return JSON.parse(r.content[0]!.text)
}

// 与 mcp-brief-tools 同形的完整就绪草案（风格 A7@v1.46）
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
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-style-tools-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  const projDir = path.join(tmpRoot, 'project-1')
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
  canvasStore.reset()
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
})

beforeEach(() => {
  clearStyleCatalogCache()
  vi.restoreAllMocks()
})

describe('feature-802 style.catalog（契约 §6.1）', () => {
  it('信封 ok/version/count/entries；条目 10 字段齐全', async () => {
    const r = await call<{ version: string; count: number; entries: Record<string, unknown>[] }>('style.catalog')
    expect(r.ok).toBe(true)
    expect(r.version).toBe('v1.46')
    expect(r.count).toBe(18)
    expect(r.entries).toHaveLength(18)
    for (const e of r.entries) {
      expect(Object.keys(e).sort()).toEqual(
        ['auxiliaryCandidate', 'familyCode', 'familyLabel', 'feasibility', 'id',
          'name', 'role', 'textureRecipe', 'visualTraits', 'anchorWords'].sort(),
      )
    }
  })

  it('谱系读盘失败 → STYLE_CATALOG_MISSING 错误信封', async () => {
    vi.spyOn(fsp, 'readFile').mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    const r = await call('style.catalog')
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe(STYLE_CATALOG_MISSING)
  })
})

describe('feature-802 style.get（契约 §6.2）', () => {
  it('A7 命中：名称逐字、auxiliaryCandidate=false；入参 trim', async () => {
    const r = await call<{ entry: Record<string, unknown> }>('style.get', { id: ' A7 ' })
    expect(r.ok).toBe(true)
    expect(r.entry).toMatchObject({
      id: 'A7', name: '拟真人·仿真人动漫', auxiliaryCandidate: false,
    })
    expect(r.entry.visualTraits).toBeTruthy()
  })

  it('ZZ9 → ok:false / STYLE_ID_UNKNOWN，消息回显 ID', async () => {
    const r = await call('style.get', { id: 'ZZ9' })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('STYLE_ID_UNKNOWN')
    expect(r.error?.message).toContain('ZZ9')
  })
})

describe('feature-802 style.validate（契约 §6.3）', () => {
  it('A7@v1.46 通过；空参 valid:true', async () => {
    const ok = await call<{ valid: boolean; issues: unknown[] }>(
      'style.validate', { mainStyleId: 'A7', catalogVersion: 'v1.46' },
    )
    expect(ok.ok).toBe(true)
    expect(ok.valid).toBe(true)
    expect(ok.issues).toEqual([])

    const empty = await call<{ valid: boolean }>('style.validate', {})
    expect(empty.valid).toBe(true)
  })

  it('错版本 → STYLE_VERSION_MISMATCH（issue，非错误信封）', async () => {
    const r = await call<{ valid: boolean; issues: { code: string; field: string }[] }>(
      'style.validate', { mainStyleId: 'A7', catalogVersion: 'v1.45' },
    )
    expect(r.ok).toBe(true)
    expect(r.valid).toBe(false)
    expect(r.issues).toEqual([{ code: 'STYLE_VERSION_MISMATCH', field: 'style.catalogVersion', message: expect.any(String) }])
  })

  it('未知主 ID → STYLE_ID_UNKNOWN', async () => {
    const r = await call<{ valid: boolean; issues: { code: string; field: string }[] }>(
      'style.validate', { mainStyleId: 'ZZ9', catalogVersion: 'v1.46' },
    )
    expect(r.valid).toBe(false)
    expect(r.issues.map(i => i.code)).toContain('STYLE_ID_UNKNOWN')
  })

  it('辅助 A1 → STYLE_AUX_NOT_CANDIDATE；辅助 D1 通过', async () => {
    const bad = await call<{ valid: boolean; issues: { code: string }[] }>(
      'style.validate', { mainStyleId: 'A7', catalogVersion: 'v1.46', auxiliaryStyleId: 'A1' },
    )
    expect(bad.valid).toBe(false)
    expect(bad.issues.map(i => i.code)).toContain('STYLE_AUX_NOT_CANDIDATE')

    const good = await call<{ valid: boolean; issues: unknown[] }>(
      'style.validate', { mainStyleId: 'A7', catalogVersion: 'v1.46', auxiliaryStyleId: 'D1' },
    )
    expect(good.valid).toBe(true)
    expect(good.issues).toEqual([])
  })
})

describe('feature-802 brief.plan 谱系注入联动（契约 §6.4）', () => {
  it('A7@v1.46 完整草案 ready:true、styleIssues=[]', async () => {
    const r = await call<{ plan: { ready: boolean; styleIssues: unknown[] } }>('brief.plan', { ...draft })
    expect(r.ok).toBe(true)
    expect(r.plan.ready).toBe(true)
    expect(r.plan.styleIssues).toEqual([])
  })

  it('ZZ9 → ready:false、styleIssues 含 STYLE_ID_UNKNOWN', async () => {
    const r = await call<{ plan: { ready: boolean; styleIssues: { code: string; field: string }[] } }>(
      'brief.plan', { ...draft, style: { mainStyleId: 'ZZ9', catalogVersion: 'v1.46' } },
    )
    expect(r.plan.ready).toBe(false)
    expect(r.plan.styleIssues.map(i => i.code)).toContain('STYLE_ID_UNKNOWN')
    expect(r.plan.styleIssues[0]).toMatchObject({ field: 'style.mainStyleId' })
  })

  it('错版本 → STYLE_VERSION_MISMATCH；辅助越域 → STYLE_AUX_NOT_CANDIDATE', async () => {
    const ver = await call<{ plan: { ready: boolean; styleIssues: { code: string }[] } }>(
      'brief.plan', { ...draft, style: { mainStyleId: 'A7', catalogVersion: 'v1.45' } },
    )
    expect(ver.plan.ready).toBe(false)
    expect(ver.plan.styleIssues.map(i => i.code)).toContain('STYLE_VERSION_MISMATCH')

    const aux = await call<{ plan: { ready: boolean; styleIssues: { code: string }[] } }>(
      'brief.plan',
      { ...draft, style: { mainStyleId: 'A7', catalogVersion: 'v1.46', auxiliaryStyleId: 'A1' } },
    )
    expect(aux.plan.ready).toBe(false)
    expect(aux.plan.styleIssues.map(i => i.code)).toContain('STYLE_AUX_NOT_CANDIDATE')
  })
})
