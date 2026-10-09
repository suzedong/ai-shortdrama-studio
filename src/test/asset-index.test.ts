import { describe, expect, it, vi, beforeAll } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const holder = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => holder.userData },
}))

import { registerAsset, listAssets } from '../../electron/asset/index'
import { writeSessionState } from '../../electron/project/library'

let projDir = ''

beforeAll(async () => {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-asset-'))
  holder.userData = path.join(tmpRoot, 'userdata')
  projDir = path.join(tmpRoot, 'project-1')
  await fsp.mkdir(projDir, { recursive: true })
  writeSessionState({ currentDir: projDir })
})

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
})
