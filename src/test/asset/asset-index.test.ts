import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import {
  captureAssetSource, listAssets, registerAsset, updateAssetSource,
} from '../../../electron/asset/index'
import { writeSessionState } from '../../../electron/project/library'
import type { RuntimeEvent } from '../../../electron/runtime/types'

let projDir = ''

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-asset-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project-1')
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
})

type ToolCallEvent = Extract<RuntimeEvent, { type: 'tool.call' }>

function completedCall(resultPreview: string, tool = 'shortdrama_asset_register'): ToolCallEvent {
  return {
    type: 'tool.call', ts: '2026-11-10T00:00:00.000Z',
    sessionId: 'session-real', messageId: 'message-real', callId: 'call-real',
    tool, status: 'completed', argsPreview: '',
    args: { sourceJobId: 'job-from-event', sourceSession: { sessionId: 'spoof' } },
    resultPreview,
  }
}

describe('T6 AssetIndex', () => {
  it('register 返回稳定 id，同 path+kind 幂等', async () => {
    const r1 = await registerAsset({ kind: 'image', path: '资产/a.png' })
    const r2 = await registerAsset({ kind: 'image', path: '资产/a.png' })
    expect(r1.assetId).toBe(r2.assetId)
    expect(r1.assetId).toMatch(/^a-image-[0-9a-f]{8}$/)

    const all = await listAssets()
    expect(all).toHaveLength(1)
  })

  it('同 path 不同 kind 为不同条目', async () => {
    await registerAsset({ kind: 'workflow', path: '资产/w.json' })
    expect(await listAssets()).toHaveLength(2)
  })

  it('list 按 kind 过滤', async () => {
    const images = await listAssets('image')
    expect(images.every(a => a.kind === 'image')).toBe(true)
    expect(images.length).toBe(1)
  })

  it('path 越界拒绝（PATH_ESCAPE_DENIED）', async () => {
    await expect(registerAsset({ kind: 'image', path: '../x.png' })).rejects.toMatchObject({
      code: 'PATH_ESCAPE_DENIED',
    })
  })

  it('落盘于 资产/asset-index.json', async () => {
    const onDisk = JSON.parse(
      await fsp.readFile(path.join(projDir, '资产', 'asset-index.json'), 'utf-8'),
    )
    expect(onDisk.length).toBe(2)
  })

  it('重复登记仅覆盖显式字段，保留任务、会话来源和旧 meta', async () => {
    const { assetId } = await registerAsset({
      kind: 'image', path: '资产/source.png', sourceJobId: 'job-1', meta: { version: 1 },
    })
    const sourceSession = { sessionId: 's1', messageId: 'm1', callId: 'c1' }
    await updateAssetSource(assetId, { sourceSession })
    await registerAsset({ kind: 'image', path: '资产/source.png' })
    expect((await listAssets()).find(item => item.id === assetId)).toMatchObject({
      sourceJobId: 'job-1', sourceSession, meta: { version: 1 },
    })

    await registerAsset({
      kind: 'image', path: '资产/source.png', sourceJobId: 'job-2', meta: { version: 2 },
    })
    expect((await listAssets()).find(item => item.id === assetId)).toMatchObject({
      sourceJobId: 'job-2', sourceSession, meta: { version: 2 },
    })
  })

  it('真实 tool.call 直接结果与 MCP 包装均补写可信任务/会话来源', async () => {
    const direct = await registerAsset({ kind: 'image', path: '资产/direct.png' })
    const result = JSON.stringify({ ok: true, assetId: direct.assetId })
    await captureAssetSource(completedCall(result, 'asset.register'))
    expect((await listAssets()).find(item => item.id === direct.assetId)?.sourceSession).toBeUndefined()
    await captureAssetSource(completedCall(result))
    expect((await listAssets()).find(item => item.id === direct.assetId)).toMatchObject({
      sourceJobId: 'job-from-event',
      sourceSession: { sessionId: 'session-real', messageId: 'message-real', callId: 'call-real' },
    })

    const wrapped = await registerAsset({ kind: 'video', path: '资产/wrapped.mp4' })
    await captureAssetSource(completedCall(JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ ok: true, assetId: wrapped.assetId }) }],
    })))
    expect((await listAssets()).find(item => item.id === wrapped.assetId)).toMatchObject({
      sourceJobId: 'job-from-event',
      sourceSession: { sessionId: 'session-real', messageId: 'message-real', callId: 'call-real' },
    })
  })

  it('来源补写不创建缺失资产', async () => {
    const before = await listAssets()
    await expect(captureAssetSource(completedCall(
      JSON.stringify({ ok: true, assetId: 'a-image-missing' }),
    ))).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' })
    expect(await listAssets()).toEqual(before)
  })

  it('坏索引抛 ASSET_INDEX_CORRUPT，登记失败不改写原文件', async () => {
    const file = path.join(projDir, '资产', 'asset-index.json')
    await fsp.writeFile(file, '{broken', 'utf-8')
    await expect(listAssets()).rejects.toMatchObject({ code: 'ASSET_INDEX_CORRUPT' })
    await expect(registerAsset({ kind: 'image', path: '资产/new.png' }))
      .rejects.toMatchObject({ code: 'ASSET_INDEX_CORRUPT' })
    await expect(fsp.readFile(file, 'utf-8')).resolves.toBe('{broken')
  })
})
