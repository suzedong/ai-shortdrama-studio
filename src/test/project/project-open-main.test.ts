import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({
  userData: '',
  documents: '',
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => key === 'documents' ? holder.documents : holder.userData,
    whenReady: () => new Promise(() => {}),
    on: vi.fn(),
  },
  BrowserWindow: class {},
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      holder.handlers.set(channel, listener)
    },
  },
  dialog: {},
  shell: { openExternal: vi.fn() },
}))

import '../../../electron/main'
import { canvasStore } from '../../../electron/canvas/store'
import { gateBridge } from '../../../electron/gate/bridge'
import { readSessionState, writeSessionState } from '../../../electron/project/library'
import { canvasV4 } from '../canvas-fixtures'

let tmpRoot = ''
let workspace = ''
const subscribed: Array<{ isDestroyed: () => boolean; send: ReturnType<typeof vi.fn> }> = []

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-project-open-main-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  holder.documents = path.join(tmpRoot, 'documents')
  workspace = path.join(holder.documents, 'ai-shortdrama-studio')
  await fsp.mkdir(holder.userData, { recursive: true })
  await fsp.mkdir(workspace, { recursive: true })
})

afterEach(async () => {
  vi.restoreAllMocks()
  for (const sender of subscribed.splice(0)) {
    const unsubscribe = holder.handlers.get('canvas:unsubscribe')
    await unsubscribe?.({ sender })
  }
  writeSessionState({ currentDir: null })
})

afterAll(async () => {
  await fsp.rm(tmpRoot, { recursive: true, force: true })
})

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = holder.handlers.get(channel)
  if (!handler) throw new Error(`未注册 IPC handler: ${channel}`)
  return await handler({}, ...args)
}

async function createProjectFixture(
  name: string,
  title: string,
  canvas?: string,
): Promise<string> {
  const dir = path.join(workspace, `project-${name}`)
  await fsp.mkdir(dir, { recursive: true })
  const now = '2026-11-18T00:00:00.000Z'
  await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({
    id: `manifest-${name}`,
    title,
    kind: 'commercial',
    createdAt: now,
    updatedAt: now,
    progress: { '0': 'active' },
  }), 'utf-8')
  await fsp.writeFile(path.join(dir, '.session.json'), JSON.stringify({
    dir,
    title,
    createdAt: now,
    lastOpenedAt: now,
    activeSessionId: `session-${name}`,
  }, null, 2), 'utf-8')
  if (canvas !== undefined) {
    await fsp.writeFile(path.join(dir, 'canvas.json'), canvas, 'utf-8')
  }
  return dir
}

async function snapshot(dir: string) {
  return {
    session: await fsp.readFile(path.join(dir, '.session.json'), 'utf-8'),
    canvas: await fsp.readFile(path.join(dir, 'canvas.json'), 'utf-8'),
  }
}

describe('feature-825 · 项目打开失败保持原项目', () => {
  it('A 已打开时坏 canvas G 拒绝切换，session、门、缓存和广播均无副作用', async () => {
    const a = await createProjectFixture('a', '项目 A', JSON.stringify(canvasV4({
      projectId: 'project-a', title: '项目 A',
    })))
    const g = await createProjectFixture('g', '项目 G', '{broken')
    await invoke('project:open', a)

    const sender = { isDestroyed: () => false, send: vi.fn() }
    subscribed.push(sender)
    const subscribe = holder.handlers.get('canvas:subscribe')
    if (!subscribe) throw new Error('未注册 canvas:subscribe')
    await subscribe({ sender })
    await vi.waitFor(() => expect(sender.send).toHaveBeenCalled())
    sender.send.mockClear()

    const beforeA = await snapshot(a)
    const beforeG = await snapshot(g)
    const beforeState = await fsp.readFile(path.join(holder.userData, 'session-state.json'), 'utf-8')
    const clearLive = vi.spyOn(gateBridge, 'clearLive')
    const recoverPending = vi.spyOn(gateBridge, 'recoverPending')
    const reset = vi.spyOn(canvasStore, 'reset')
    const withCanvas = vi.spyOn(canvasStore, 'withCanvas')

    await expect(invoke('project:open', g)).rejects.toMatchObject({ code: 'CANVAS_CORRUPT' })

    expect(readSessionState().currentDir).toBe(a)
    expect((await canvasStore.get()).projectId).toBe('project-a')
    expect(await snapshot(a)).toEqual(beforeA)
    expect(await snapshot(g)).toEqual(beforeG)
    expect(await fsp.readFile(path.join(holder.userData, 'session-state.json'), 'utf-8')).toBe(beforeState)
    expect(clearLive).not.toHaveBeenCalled()
    expect(recoverPending).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    expect(withCanvas).not.toHaveBeenCalled()
    expect(sender.send).not.toHaveBeenCalled()
  })

  it('正常 B 缺失画布时预检不创建文件，提交后按既有顺序打开并同步标题/会话', async () => {
    const a = await createProjectFixture('a-normal', '项目 A', JSON.stringify(canvasV4({
      projectId: 'project-a-normal', title: '项目 A',
    })))
    const b = await createProjectFixture('b-normal', '项目 B')
    await invoke('project:open', a)

    await canvasStore.assertReadable(b)
    expect(readSessionState().currentDir).toBe(a)
    await expect(fsp.access(path.join(b, 'canvas.json'))).rejects.toMatchObject({ code: 'ENOENT' })

    const sender = { isDestroyed: () => false, send: vi.fn() }
    subscribed.push(sender)
    const subscribe = holder.handlers.get('canvas:subscribe')
    if (!subscribe) throw new Error('未注册 canvas:subscribe')
    await subscribe({ sender })
    await vi.waitFor(() => expect(sender.send).toHaveBeenCalled())
    sender.send.mockClear()

    const clearLive = vi.spyOn(gateBridge, 'clearLive')
    const recoverPending = vi.spyOn(gateBridge, 'recoverPending')
    const reset = vi.spyOn(canvasStore, 'reset')
    const result = await invoke('project:open', b)

    expect(result).toEqual({ ok: true, activeSessionId: 'session-b-normal' })
    expect(readSessionState().currentDir).toBe(b)
    expect(clearLive).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledTimes(1)
    expect(recoverPending).toHaveBeenCalledTimes(1)
    expect(clearLive.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0]!)
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(recoverPending.mock.invocationCallOrder[0]!)
    expect(await canvasStore.get()).toMatchObject({ projectId: 'project-b-normal', title: '项目 B' })
    const session = JSON.parse(await fsp.readFile(path.join(b, '.session.json'), 'utf-8')) as {
      activeSessionId: string
      lastOpenedAt: string
    }
    expect(session.activeSessionId).toBe('session-b-normal')
    expect(session.lastOpenedAt).not.toBe('2026-11-18T00:00:00.000Z')
    expect(sender.send).toHaveBeenCalledWith('canvas:changed', expect.objectContaining({
      projectId: 'project-b-normal', title: '项目 B',
    }))
  })

  it('目标 canvas projectId 失配明确失败且不切项目', async () => {
    const a = await createProjectFixture('a-mismatch', '项目 A', JSON.stringify(canvasV4({
      projectId: 'project-a-mismatch', title: '项目 A',
    })))
    const g = await createProjectFixture('g-mismatch', '项目 G', JSON.stringify(canvasV4({
      projectId: 'project-other', title: '项目 G',
    })))
    await invoke('project:open', a)
    const beforeG = await snapshot(g)

    await expect(invoke('project:open', g)).rejects.toMatchObject({ code: 'CANVAS_PROJECT_MISMATCH' })

    expect(readSessionState().currentDir).toBe(a)
    expect((await canvasStore.get()).projectId).toBe('project-a-mismatch')
    expect(await snapshot(g)).toEqual(beforeG)
  })

  it('路径与 manifest 校验先于画布预检，错误优先级保持不变', async () => {
    const a = await createProjectFixture('a-validation', '项目 A', JSON.stringify(canvasV4({
      projectId: 'project-a-validation', title: '项目 A',
    })))
    await invoke('project:open', a)
    const outside = path.join(tmpRoot, 'project-outside')
    await fsp.mkdir(outside)
    await fsp.writeFile(path.join(outside, 'canvas.json'), '{broken', 'utf-8')
    const noManifest = path.join(workspace, 'project-no-manifest')
    await fsp.mkdir(noManifest)
    await fsp.writeFile(path.join(noManifest, 'canvas.json'), '{broken', 'utf-8')

    await expect(invoke('project:open', outside)).rejects.toMatchObject({ code: 'INVALID_PROJECT_DIR' })
    await expect(invoke('project:open', noManifest)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    expect(readSessionState().currentDir).toBe(a)
  })
})
