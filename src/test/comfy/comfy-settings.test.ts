import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { listInstances, upsertInstance, removeInstance } from '../../electron/comfy/settings'
import { setComfyClient } from '../../electron/comfy/client'
import { registerPureTools } from '../../electron/mcp/tools'
import { writeSessionState } from '../../electron/project/library'

type Handler = (args: Record<string, unknown>) => Promise<{
  content: { text: string }[]
  isError?: boolean
}>

function buildFakeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    tool: (name: string, ...rest: unknown[]) => {
      const handler = rest[rest.length - 1] as Handler
      handlers.set(name, handler)
    },
  }
  return { server: server as never, handlers }
}

let projDir = ''
let handlers: Map<string, Handler>

async function call(name: string, args: Record<string, unknown> = {}) {
  const r = await handlers.get(name)!(args)
  return JSON.parse(r.content[0]!.text) as { ok: boolean; error?: { code: string } }
}

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-comfy-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project-1')
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
  setComfyClient(null)
  const fake = buildFakeServer()
  registerPureTools(fake.server)
  handlers = fake.handlers
})

describe('T7 Comfy settings + 占位转发', () => {
  it('实例 upsert / list 落 project.json', async () => {
    const c = await upsertInstance({ name: '客厅主机', baseUrl: 'http://192.168.1.10:8188' })
    expect(c.id).toMatch(/^c-/)
    expect((await listInstances())).toHaveLength(1)
    const onDisk = JSON.parse(await fsp.readFile(path.join(projDir, 'project.json'), 'utf-8'))
    expect(onDisk.comfyInstances).toHaveLength(1)
  })

  it('remove 删除实例', async () => {
    const c = await listInstances()
    await removeInstance(c[0]!.id)
    expect(await listInstances()).toHaveLength(0)
  })

  it('未知 instanceId → INVALID_ARGUMENT', async () => {
    const r = await call('comfyui.queue', { instanceId: 'nope', workflow: {} })
    expect(r.ok).toBe(false)
    expect(r.error?.code).toBe('INVALID_ARGUMENT')
  })

  it('client=null 时 queue / status 返回 INTERNAL', async () => {
    const c = await upsertInstance({ name: 'h', baseUrl: 'http://127.0.0.1:8188' })
    const q = await call('comfyui.queue', { instanceId: c.id, workflow: {} })
    expect(q.ok).toBe(false)
    expect(q.error?.code).toBe('INTERNAL')

    const s = await call('comfyui.status', { instanceId: c.id, jobId: 'j1' })
    expect(s.ok).toBe(false)
    expect(s.error?.code).toBe('INTERNAL')
  })

  it('instances 工具不依赖 client，返回真实配置', async () => {
    const r = await call('comfyui.instances') as { ok: boolean; instances?: unknown[] }
    expect(r.ok).toBe(true)
    expect(r.instances).toHaveLength(1)
  })
})
