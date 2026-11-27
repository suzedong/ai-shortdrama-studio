// @vitest-environment node
// feature-808 T11.1 · 人工停止与 runtime.error 的主进程竞争回归。
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const holder = vi.hoisted(() => ({
  userData: '',
  onEvent: null as null | ((event: import('../../../electron/runtime/types').RuntimeEvent) => unknown),
}))

vi.mock('electron', () => {
  const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>()
  const appEvents = new Map<string, (...args: unknown[]) => unknown>()
  const emptyWindow = () => ({ isDestroyed: () => true, webContents: { send: vi.fn() } })
  return {
    __handlers: ipcHandlers,
    app: {
      isPackaged: false,
      getPath: (key: string) => key === 'userData' ? holder.userData : path.join(holder.userData, key),
      setPath: vi.fn(),
      whenReady: () => new Promise<void>(() => {}),
      on: (name: string, cb: (...args: unknown[]) => unknown) => appEvents.set(name, cb),
      setAccessibilitySupportEnabled: vi.fn(),
      quit: vi.fn(),
    },
    ipcMain: {
      handle: (channel: string, fn: (...args: unknown[]) => unknown) => ipcHandlers.set(channel, fn),
      on: vi.fn(),
      removeHandler: (channel: string) => ipcHandlers.delete(channel),
    },
    BrowserWindow: Object.assign(vi.fn(), {
      getAllWindows: () => [emptyWindow()],
      fromWebContents: () => null,
    }),
    dialog: {
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined })),
    },
    shell: { openExternal: vi.fn(), showItemInFolder: vi.fn() },
  }
})

vi.mock('../../../electron/runtime/projection', () => ({
  subscribeEvents: vi.fn(async ({ onEvent }: {
    onEvent: (event: import('../../../electron/runtime/types').RuntimeEvent) => unknown
  }) => {
    holder.onEvent = onEvent
    return { closed: new Promise<void>(() => {}), close: vi.fn(async () => {}) }
  }),
}))

import * as electron from 'electron'
import '../../../electron/main'
import { writeSessionState } from '../../../electron/project/library'
import { OpencodeRuntimeClient } from '../../../electron/runtime/client'
import { runtimeManager } from '../../../electron/runtime/manager'
import type { RuntimeEvent } from '../../../electron/runtime/types'

type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = (electron as unknown as { __handlers: Map<string, Handler> }).__handlers
const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
  Promise.resolve(handlers.get(channel)!({}, ...args))

interface RunRecord {
  id: string
  status: string
  updatedAt: string
  endedAt?: string
  error?: string
}

let fixtureRoot = ''
let activeDir = ''
let sessionId = ''
let messageSeq = 0
const subscribedSenders: Array<{ id: number }> = []

async function readRun(messageId: string): Promise<RunRecord> {
  const runs = await invoke('runtime:runs') as RunRecord[]
  const run = runs.find(item => item.id === messageId)
  expect(run).toBeDefined()
  return run!
}

async function waitForRun(messageId: string, status: string): Promise<RunRecord> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const run = await readRun(messageId)
    if (run.status === status) return run
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`等待 ${messageId} → ${status} 超时；当前=${(await readRun(messageId)).status}`)
}

async function startRun(): Promise<string> {
  writeSessionState({ currentDir: activeDir })
  messageSeq++
  vi.spyOn(OpencodeRuntimeClient.prototype, 'promptAsync').mockImplementation(
    async (_request, _assets, messageId) => {
      if (!messageId) throw new Error('测试要求主进程显式生成 messageId')
      return { accepted: true as const, messageId }
    },
  )
  const accepted = await invoke('runtime:prompt:async', { sessionId, text: '停止竞争回归' }) as {
    accepted: true
    messageId: string
  }
  expect(accepted.accepted).toBe(true)
  return accepted.messageId
}

async function subscribeRuntimeEvents(): Promise<void> {
  const sender = {
    id: 1000 + messageSeq,
    once: vi.fn(),
    isDestroyed: () => false,
    send: vi.fn(),
  }
  subscribedSenders.push(sender)
  expect(await handlers.get('runtime:event:subscribe')!({ sender })).toEqual({ ok: true })
  expect(holder.onEvent).not.toBeNull()
}

async function emit(event: RuntimeEvent): Promise<void> {
  await holder.onEvent!(event)
}

function runtimeError(code: 'PROMPT_ABORTED' | 'PROMPT_FAILED'): RuntimeEvent {
  return {
    type: 'runtime.error',
    ts: new Date().toISOString(),
    sessionId,
    error: { code, message: code === 'PROMPT_ABORTED' ? '消息已被中止' : '真实 Provider 故障' },
  }
}

beforeEach(async () => {
  fixtureRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdg-stop-main-'))
  activeDir = path.join(fixtureRoot, 'project-stop')
  sessionId = `ses-stop-${messageSeq + 1}`
  await fsp.mkdir(activeDir, { recursive: true })
  vi.spyOn(runtimeManager, 'isRunning').mockReturnValue(true)
  vi.spyOn(runtimeManager, 'getStatus').mockReturnValue({
    state: 'running', port: 4096, version: 'test', healthy: true, startedAt: null, error: null,
  })
  vi.spyOn(runtimeManager, 'getConnection').mockReturnValue({ baseUrl: 'http://127.0.0.1:4096', password: 'test' })
})

afterEach(async () => {
  for (const sender of subscribedSenders.splice(0)) {
    await handlers.get('runtime:event:unsubscribe')!({ sender })
  }
  holder.onEvent = null
  writeSessionState({ currentDir: null })
  vi.restoreAllMocks()
  if (fixtureRoot && fs.existsSync(fixtureRoot)) await fsp.rm(fixtureRoot, { recursive: true, force: true })
})

describe('feature-808 T11.1 · 人工停止终态', () => {
  it('stopping 后 PROMPT_ABORTED 收敛 stopped，迟到事件与 IPC 成功不改写终态', async () => {
    const messageId = await startRun()
    await subscribeRuntimeEvents()
    let finishAbort!: (value: { ok: true }) => void
    const abortPending = new Promise<{ ok: true }>(resolve => { finishAbort = resolve })
    vi.spyOn(OpencodeRuntimeClient.prototype, 'abortSession').mockReturnValue(abortPending)

    const abortResult = invoke('runtime:session:abort', sessionId)
    await waitForRun(messageId, 'stopping')
    await emit(runtimeError('PROMPT_ABORTED'))
    const stopped = await waitForRun(messageId, 'stopped')
    expect(stopped.error).toBeUndefined()
    expect(stopped.endedAt).toBeTruthy()

    await emit(runtimeError('PROMPT_FAILED'))
    finishAbort({ ok: true })
    await expect(abortResult).resolves.toEqual({ ok: true })
    expect(await readRun(messageId)).toEqual(stopped)
    expect(await invoke('runtime:runs')).toMatchObject([{ id: messageId }])
  })

  it('abortSession 以 PROMPT_ABORTED 拒绝时仍收敛 stopped，不落取消错误', async () => {
    const messageId = await startRun()
    let rejectAbort!: (error: Error) => void
    const abortPending = new Promise<{ ok: true }>((_resolve, reject) => { rejectAbort = reject })
    vi.spyOn(OpencodeRuntimeClient.prototype, 'abortSession').mockReturnValue(abortPending)

    const abortResult = invoke('runtime:session:abort', sessionId)
    await waitForRun(messageId, 'stopping')
    rejectAbort(Object.assign(new Error('消息已被中止'), { name: 'PROMPT_ABORTED' }))
    await expect(abortResult).rejects.toMatchObject({ name: 'PROMPT_ABORTED' })

    const stopped = await waitForRun(messageId, 'stopped')
    expect(stopped.error).toBeUndefined()
  })

  it('stopping 中真实 PROMPT_FAILED 仍落 failed，后续停止成功不覆盖', async () => {
    const messageId = await startRun()
    await subscribeRuntimeEvents()
    let finishAbort!: (value: { ok: true }) => void
    const abortPending = new Promise<{ ok: true }>(resolve => { finishAbort = resolve })
    vi.spyOn(OpencodeRuntimeClient.prototype, 'abortSession').mockReturnValue(abortPending)

    const abortResult = invoke('runtime:session:abort', sessionId)
    await waitForRun(messageId, 'stopping')
    await emit(runtimeError('PROMPT_FAILED'))
    const failed = await waitForRun(messageId, 'failed')
    expect(failed.error).toContain('真实 Provider 故障')

    finishAbort({ ok: true })
    await expect(abortResult).resolves.toEqual({ ok: true })
    expect(await readRun(messageId)).toEqual(failed)
  })
})
