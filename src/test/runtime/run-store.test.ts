import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentRunStore } from '../../../electron/runtime/run-store'
import type { AgentRunRecord, RuntimePromptRequest } from '../../../electron/runtime/types'

const roots: string[] = []
const request: RuntimePromptRequest = { sessionId: 'ses-1', text: '继续制作', agent: 'showrunner' }

async function root(): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-run-store-'))
  roots.push(dir)
  return dir
}

async function seed(dir: string, runs: AgentRunRecord[]): Promise<void> {
  await fsp.writeFile(path.join(dir, '.agent-runs.json'), JSON.stringify(runs), 'utf-8')
}

function run(status: AgentRunRecord['status'], id = 'msg-1'): AgentRunRecord {
  return {
    id,
    sessionId: 'ses-1',
    request,
    status,
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(dir => fsp.rm(dir, { recursive: true, force: true })))
})

describe('AgentRunStore', () => {
  it('发送前持久化真实 messageID 与请求', async () => {
    const store = new AgentRunStore(await root())
    await store.start('msg-real', request)
    const records = await store.list()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ id: 'msg-real', sessionId: 'ses-1', status: 'running', request })
    expect(JSON.parse(await fsp.readFile(path.join(store.dir, '.agent-runs.json'), 'utf-8'))[0].id).toBe('msg-real')
  })

  it('重开账本保留 RuntimeModelRef 请求用于人工重试', async () => {
    const store = new AgentRunStore(await root())
    const withModel: RuntimePromptRequest = {
      ...request,
      model: { providerID: 'mock', modelID: 'mock-1' },
    }
    await store.start('msg-model', withModel)
    await expect(new AgentRunStore(store.dir).list()).resolves.toEqual([
      expect.objectContaining({ id: 'msg-model', status: 'interrupted', request: withModel }),
    ])
  })

  it('拒绝同会话活跃并发，但允许其他会话', async () => {
    const store = new AgentRunStore(await root())
    await store.start('msg-1', request)
    await expect(store.start('msg-2', request)).rejects.toThrow('当前会话仍有活跃运行')
    await expect(store.start('msg-2', { ...request, sessionId: 'ses-2' })).resolves.toMatchObject({ id: 'msg-2' })
  })

  it('完成和停止只迁移一次，迟到事件不改写终态', async () => {
    const store = new AgentRunStore(await root())
    await store.start('msg-1', request)
    await store.transition('msg-1', 'completed')
    const completed = await store.transition('msg-1', 'failed', 'late')
    expect(completed).toMatchObject({ id: 'msg-1', status: 'completed', endedAt: expect.any(String) })
    expect(completed?.error).toBeUndefined()

    await store.start('msg-2', { ...request, sessionId: 'ses-2' })
    await store.transition('msg-2', 'stopping')
    await expect(store.transition('msg-2', 'completed')).rejects.toThrow('非法运行状态迁移')
    await store.transition('msg-2', 'stopped')
    expect((await store.get('msg-2'))?.status).toBe('stopped')
  })

  it('首次加载把磁盘活跃运行对账为 interrupted 且保持幂等', async () => {
    const dir = await root()
    await seed(dir, [run('running'), { ...run('completed', 'msg-2'), endedAt: '2026-11-26T00:00:01.000Z' }])
    const store = new AgentRunStore(dir)
    const first = await store.list()
    expect(first.map(item => item.status)).toEqual(['interrupted', 'completed'])
    const updatedAt = first[0].updatedAt
    await store.transition('msg-1', 'completed')
    expect((await new AgentRunStore(dir).list())[0]).toMatchObject({ status: 'interrupted', updatedAt })
  })

  it('停止与异常退出只影响活跃运行', async () => {
    const store = new AgentRunStore(await root())
    await store.start('msg-1', request)
    await store.start('msg-2', { ...request, sessionId: 'ses-2' })
    await store.stopActive('ses-1')
    expect((await store.get('msg-1'))?.status).toBe('stopping')
    expect((await store.get('msg-2'))?.status).toBe('running')
    await store.interruptActive()
    expect((await store.get('msg-1'))?.status).toBe('interrupted')
    expect((await store.get('msg-2'))?.status).toBe('interrupted')
  })

  it('重试运行保留血缘且旧运行保持 interrupted', async () => {
    const store = new AgentRunStore(await root())
    await store.start('msg-old', request)
    await store.transition('msg-old', 'interrupted')
    await store.start('msg-new', request, 'msg-old')
    expect(await store.get('msg-old')).toMatchObject({ id: 'msg-old', status: 'interrupted' })
    expect(await store.get('msg-new')).toMatchObject({ id: 'msg-new', status: 'running', retryOfMessageId: 'msg-old' })
  })

  it('正常停止先 stopping、进程收尾后 stopped，冷启动不误判 interrupted', async () => {
    const store = new AgentRunStore(await root())
    await store.start('msg-stop-final', request)
    await store.stopActive(undefined, 'stopping')
    const stopping = await store.get('msg-stop-final')
    expect(stopping).toMatchObject({ status: 'stopping' })
    expect(stopping?.endedAt).toBeUndefined()

    await store.stopActive(undefined, 'stopped')
    const stopped = await store.get('msg-stop-final')
    expect(stopped).toMatchObject({ status: 'stopped' })
    expect(stopped?.endedAt).toEqual(expect.any(String))
    await expect(store.stopActive(undefined, 'stopped')).resolves.toEqual([stopped])

    const reopened = new AgentRunStore(store.dir)
    expect(await reopened.get('msg-stop-final')).toMatchObject({ status: 'stopped' })
    const raw = JSON.parse(await fsp.readFile(path.join(store.dir, '.agent-runs.json'), 'utf-8'))
    expect(raw[0].status).toBe('stopped')
  })

  it('损坏账本不得被静默重置或覆盖', async () => {
    const dir = await root()
    const file = path.join(dir, '.agent-runs.json')
    await fsp.writeFile(file, '{broken', 'utf-8')
    const store = new AgentRunStore(dir)
    await expect(store.list()).rejects.toMatchObject({ name: 'RUN_STORE_CORRUPT' })
    await expect(store.start('msg-new', request)).rejects.toMatchObject({ name: 'RUN_STORE_CORRUPT' })
    expect(await fsp.readFile(file, 'utf-8')).toBe('{broken')
  })
})
