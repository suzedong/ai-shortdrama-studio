import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import {
  captureAssetSource, listAssets, registerAsset, resolvePromptAssetRefs, updateAssetSource,
} from '../../../electron/asset/index'
import { writeSessionState } from '../../../electron/project/library'
import type { RuntimeEvent, RuntimePromptAssetRef } from '../../../electron/runtime/types'
import type { AssetIndexItem } from '../../../shared/types'

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

  it('原子替换失败保留旧正档并清理临时文件', async () => {
    const file = path.join(projDir, '资产', 'asset-index.json')
    const before = await fsp.readFile(file, 'utf-8')
    const rename = vi.spyOn(fsp, 'rename').mockRejectedValueOnce(new Error('injected rename failure'))
    try {
      await expect(registerAsset({ kind: 'image', path: '资产/atomic-failure.png' }))
        .rejects.toThrow('injected rename failure')
    } finally {
      rename.mockRestore()
    }
    await expect(fsp.readFile(file, 'utf-8')).resolves.toBe(before)
    expect((await listAssets()).some(item => item.path === '资产/atomic-failure.png')).toBe(false)
    const names = await fsp.readdir(path.dirname(file))
    expect(names.filter(name => name.startsWith('.asset-index.'))).toEqual([])
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

describe('feature-822 · 当前项目对话资产复核', () => {
  function item(id: string, kind: AssetIndexItem['kind'], assetPath: string): AssetIndexItem {
    return { id, kind, path: assetPath, createdAt: '2026-11-17T00:00:00.000Z' }
  }

  async function makeProject(items: AssetIndexItem[]): Promise<string> {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-prompt-assets-'))
    await writeItems(dir, items)
    return dir
  }

  async function writeItems(dir: string, items: AssetIndexItem[]): Promise<void> {
    const indexDir = path.join(dir, '资产')
    await fsp.mkdir(indexDir, { recursive: true })
    await fsp.writeFile(path.join(indexDir, 'asset-index.json'), JSON.stringify(items), 'utf-8')
  }

  async function makeFile(dir: string, relative: string): Promise<void> {
    const file = path.join(dir, relative)
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await fsp.writeFile(file, 'fixture')
  }

  it('空引用不读索引；非数组、空白 ID、额外键和超长 ID 均拒绝', async () => {
    const missing = path.join(os.tmpdir(), 'asd-prompt-assets-missing-index')
    await expect(resolvePromptAssetRefs([], missing)).resolves.toEqual([])
    const dir = await makeProject([])
    const invalid = [
      null,
      {},
      [{ assetId: '' }],
      [{ assetId: ' a1' }],
      [{ assetId: 'a'.repeat(257) }],
      [{ assetId: 'a1', path: '/secret' }],
    ]
    for (const refs of invalid) {
      await expect(resolvePromptAssetRefs(refs as RuntimePromptAssetRef[], dir))
        .rejects.toMatchObject({ code: 'ASSET_REF_INVALID' })
    }
  })

  it('四类及全部白名单扩展名映射正确 MIME，并生成安全显示名与 main 内部绝对路径', async () => {
    const cases = [
      ['png', 'image', '资产/a.png', 'image/png'],
      ['jpg', 'image', '资产/a.jpg', 'image/jpeg'],
      ['jpeg', 'image', '资产/a.jpeg', 'image/jpeg'],
      ['webp', 'image', '资产/a.webp', 'image/webp'],
      ['mp4', 'video', '资产/a.mp4', 'video/mp4'],
      ['mp3', 'music', '资产/a.mp3', 'audio/mpeg'],
      ['wav', 'music', '资产/a.wav', 'audio/wav'],
      ['json', 'workflow', '资产/a.json', 'application/json'],
    ] as const
    const items = cases.map(([id, kind, assetPath]) => item(id, kind, assetPath))
    items[0]!.meta = { originalName: '安妮.png' }
    const dir = await makeProject(items)
    await Promise.all(cases.map(([, , assetPath]) => makeFile(dir, assetPath)))
    const resolved = await resolvePromptAssetRefs(cases.map(([assetId]) => ({ assetId })), dir)
    expect(resolved.map(asset => asset.mime)).toEqual(cases.map(([, , , mime]) => mime))
    expect(resolved[0]).toMatchObject({ assetId: 'png', name: '安妮.png', path: '资产/a.png' })
    expect(resolved.every(asset => path.isAbsolute(asset.absolutePath))).toBe(true)
    expect(resolved.every(asset => !('url' in asset))).toBe(true)
  })

  it('重复 ID 保持首次顺序去重；其他项目 ID 不在当前项目命中', async () => {
    const items = [item('a', 'image', '资产/a.png'), item('b', 'image', '资产/b.png')]
    const dir = await makeProject(items)
    await makeFile(dir, '资产/a.png')
    await makeFile(dir, '资产/b.png')
    const otherDir = await makeProject([item('other', 'image', '资产/other.png')])
    await makeFile(otherDir, '资产/other.png')
    const resolved = await resolvePromptAssetRefs([
      { assetId: 'b' }, { assetId: 'a' }, { assetId: 'b' },
    ], dir)
    expect(resolved.map(asset => asset.assetId)).toEqual(['b', 'a'])
    await expect(resolvePromptAssetRefs([{ assetId: 'other' }], dir))
      .rejects.toMatchObject({ code: 'ASSET_REF_NOT_FOUND' })
  })

  it('不支持的扩展名、缺失文件和目录不进入 file parts', async () => {
    const dir = await makeProject([item('gif', 'image', '资产/a.gif')])
    await makeFile(dir, '资产/a.gif')
    await expect(resolvePromptAssetRefs([{ assetId: 'gif' }], dir))
      .rejects.toMatchObject({ code: 'ASSET_REF_UNSUPPORTED' })
    await writeItems(dir, [item('missing', 'image', '资产/missing.png')])
    await expect(resolvePromptAssetRefs([{ assetId: 'missing' }], dir))
      .rejects.toMatchObject({ code: 'ASSET_REF_NOT_REGULAR_FILE' })
    await writeItems(dir, [item('directory', 'image', '资产/directory.png')])
    await fsp.mkdir(path.join(dir, '资产/directory.png'))
    await expect(resolvePromptAssetRefs([{ assetId: 'directory' }], dir))
      .rejects.toMatchObject({ code: 'ASSET_REF_NOT_REGULAR_FILE' })
  })

  it('最终符号链接拒绝；中间目录符号链接的真实路径逃逸也拒绝', async () => {
    const outside = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-prompt-outside-'))
    await fsp.writeFile(path.join(outside, 'secret.png'), 'secret')
    const finalDir = await makeProject([item('final', 'image', '资产/final.png')])
    await fsp.symlink(path.join(outside, 'secret.png'), path.join(finalDir, '资产/final.png'))
    await expect(resolvePromptAssetRefs([{ assetId: 'final' }], finalDir))
      .rejects.toMatchObject({ code: 'ASSET_REF_NOT_REGULAR_FILE' })

    const intermediateDir = await makeProject([item('middle', 'image', '资产/link/secret.png')])
    await fsp.symlink(outside, path.join(intermediateDir, '资产/link'), 'dir')
    await expect(resolvePromptAssetRefs([{ assetId: 'middle' }], intermediateDir))
      .rejects.toMatchObject({ code: 'PATH_ESCAPE_DENIED' })
  })

  it('词法 .. 与绝对路径即使指向项目内文件也拒绝；非法显示名回退 basename', async () => {
    const dir = await makeProject([item('escape', 'image', '../outside.png')])
    await expect(resolvePromptAssetRefs([{ assetId: 'escape' }], dir))
      .rejects.toMatchObject({ code: 'PATH_ESCAPE_DENIED' })

    const absolute = path.join(dir, '资产/absolute.png')
    await makeFile(dir, '资产/absolute.png')
    await writeItems(dir, [item('absolute', 'image', absolute)])
    await expect(resolvePromptAssetRefs([{ assetId: 'absolute' }], dir))
      .rejects.toMatchObject({ code: 'PATH_ESCAPE_DENIED' })

    await writeItems(dir, [{ ...item('safe', 'image', '资产/safe.png'), meta: { originalName: '../secret.png' } }])
    await makeFile(dir, '资产/safe.png')
    await expect(resolvePromptAssetRefs([{ assetId: 'safe' }], dir))
      .resolves.toMatchObject([{ name: 'safe.png' }])
  })
})
