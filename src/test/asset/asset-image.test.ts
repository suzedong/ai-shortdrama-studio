import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'
import sharp from 'sharp'

vi.mock('electron', () => ({
  app: { getPath: () => path.join(os.tmpdir(), 'asd-asset-image-unused') },
}))

import { importImageFromPath, readAssetThumbnail } from '../../../electron/asset/image'
import { listAssets, registerAsset } from '../../../electron/asset/index'

let root = ''
let projectRoot = ''
let sourceRoot = ''

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-asset-image-'))
  projectRoot = path.join(root, 'project')
  sourceRoot = path.join(root, 'source')
  await Promise.all([
    fsp.mkdir(projectRoot, { recursive: true }),
    fsp.mkdir(sourceRoot, { recursive: true }),
  ])
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fsp.rm(root, { recursive: true, force: true })
})

async function makeImage(format: 'png' | 'jpeg' | 'webp', name?: string): Promise<string> {
  const file = path.join(sourceRoot, name ?? `测试 图片.${format}`)
  let image = sharp({
    create: { width: 64, height: 32, channels: 3, background: { r: 20, g: 80, b: 160 } },
  })
  if (format === 'png') image = image.png()
  if (format === 'jpeg') image = image.jpeg()
  if (format === 'webp') image = image.webp()
  await image.toFile(file)
  return file
}

async function thumbnailBuffer(assetId: string): Promise<Buffer> {
  const result = await readAssetThumbnail({ projectRoot, assetId })
  expect(result.dataUrl).toMatch(/^data:image\/webp;base64,/)
  return Buffer.from(result.dataUrl!.split(',')[1], 'base64')
}

describe('feature-821 图片导入与真实缩略图', () => {
  it.each([
    ['png', 'png', 'image/png'],
    ['jpeg', 'jpg', 'image/jpeg'],
    ['webp', 'webp', 'image/webp'],
  ] as const)('导入 %s：安全落盘、登记并返回 WebP 小图', async (format, extension, mime) => {
    const source = await makeImage(format)
    const asset = await importImageFromPath({ projectRoot, sourcePath: source })
    expect(asset).toMatchObject({
      kind: 'image',
      meta: { origin: 'upload', originalName: path.basename(source), mime, sizeBytes: expect.any(Number) },
    })
    expect(asset.path).toMatch(new RegExp(`^资产/上传/[0-9a-f]{64}\\.${extension}$`))
    expect(asset.meta).not.toHaveProperty('sourcePath')
    const original = await fsp.readFile(path.join(projectRoot, asset.path))
    expect(original.equals(await fsp.readFile(source))).toBe(true)

    const thumbnail = await thumbnailBuffer(asset.id)
    const metadata = await sharp(thumbnail).metadata()
    expect(metadata.format).toBe('webp')
    expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(320)
  })

  it('同内容改名重复导入保持同 ID、同路径和首次 createdAt', async () => {
    const firstSource = await makeImage('png', '第一个名字.png')
    const secondSource = path.join(sourceRoot, '第二个名字.png')
    await fsp.copyFile(firstSource, secondSource)
    const first = await importImageFromPath({ projectRoot, sourcePath: firstSource })
    const second = await importImageFromPath({ projectRoot, sourcePath: secondSource })
    expect(second.id).toBe(first.id)
    expect(second.path).toBe(first.path)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.meta).toMatchObject({ originalName: '第二个名字.png' })
    expect(await listAssets(undefined, projectRoot)).toHaveLength(1)
  })

  it('EXIF 方向在缩略图中正确应用', async () => {
    const source = path.join(sourceRoot, 'portrait.jpg')
    await sharp({
      create: { width: 20, height: 40, channels: 3, background: { r: 200, g: 30, b: 20 } },
    }).jpeg().withMetadata({ orientation: 6 }).toFile(source)
    const asset = await importImageFromPath({ projectRoot, sourcePath: source })
    const metadata = await sharp(await thumbnailBuffer(asset.id)).metadata()
    expect(metadata.width).toBe(40)
    expect(metadata.height).toBe(20)
  })

  it('伪造格式、空文件、目录和源符号链接均拒绝且不登记', async () => {
    const fake = path.join(sourceRoot, 'fake.png')
    const empty = path.join(sourceRoot, 'empty.png')
    await fsp.writeFile(fake, 'not an image')
    await fsp.writeFile(empty, '')
    const valid = await makeImage('png', 'valid.png')
    const link = path.join(sourceRoot, 'link.png')
    await fsp.symlink(valid, link)

    for (const sourcePath of [fake, empty, sourceRoot, link]) {
      await expect(importImageFromPath({ projectRoot, sourcePath })).rejects.toMatchObject({
        code: expect.stringMatching(/^(IMAGE_UNSUPPORTED|SOURCE_NOT_REGULAR_FILE)$/),
      })
    }
    expect(await listAssets(undefined, projectRoot)).toEqual([])
  })

  it('超 64 MiB 与超 4000 万像素在登记前拒绝', async () => {
    const huge = path.join(sourceRoot, 'huge.png')
    await fsp.writeFile(huge, 'x')
    await fsp.truncate(huge, 64 * 1024 * 1024 + 1)
    await expect(importImageFromPath({ projectRoot, sourcePath: huge })).rejects.toMatchObject({
      code: 'IMAGE_TOO_LARGE',
    })

    const pixels = path.join(sourceRoot, 'pixels.png')
    await sharp({
      create: {
        width: 6400,
        height: 6400,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).png().toFile(pixels)
    await expect(importImageFromPath({ projectRoot, sourcePath: pixels })).rejects.toMatchObject({
      code: 'IMAGE_TOO_MANY_PIXELS',
    })
    expect(await listAssets(undefined, projectRoot)).toEqual([])
  })

  it('资产目录符号链接逃逸被拒绝，不在项目外创建文件', async () => {
    const source = await makeImage('png')
    const outside = path.join(root, 'outside')
    await fsp.mkdir(outside)
    await fsp.symlink(outside, path.join(projectRoot, '资产'))
    await expect(importImageFromPath({ projectRoot, sourcePath: source })).rejects.toMatchObject({
      code: 'PATH_ESCAPE_DENIED',
    })
    expect(await fsp.readdir(outside)).toEqual([])
  })

  it('索引写入失败清理本次新媒体且不留临时文件', async () => {
    const source = await makeImage('png')
    const originalRename = fsp.rename
    const rename = vi.spyOn(fsp, 'rename')
    rename.mockImplementation(async (from, to) => {
      if (String(to).endsWith('asset-index.json')) throw new Error('injected index failure')
      return originalRename(from, to)
    })
    await expect(importImageFromPath({ projectRoot, sourcePath: source })).rejects.toMatchObject({
      code: 'ASSET_IMPORT_FAILED',
    })
    expect(await listAssets(undefined, projectRoot)).toEqual([])
    for (const directory of ['资产/上传', '资产/缩略图']) {
      const names = await fsp.readdir(path.join(projectRoot, directory))
      expect(names).toEqual([])
    }
  })

  it('旧 ComfyUI 图片无需索引新字段即可按需生成并恢复缩略图', async () => {
    const source = await makeImage('png')
    const original = path.join(projectRoot, '资产', 'comfy', 'old.png')
    await fsp.mkdir(path.dirname(original), { recursive: true })
    await fsp.copyFile(source, original)
    const { assetId } = await registerAsset({ kind: 'image', path: '资产/comfy/old.png' }, projectRoot)
    const before = await fsp.readFile(path.join(projectRoot, '资产', 'asset-index.json'), 'utf-8')

    const first = await thumbnailBuffer(assetId)
    expect((await sharp(first).metadata()).format).toBe('webp')
    expect(await fsp.readFile(path.join(projectRoot, '资产', 'asset-index.json'), 'utf-8')).toBe(before)

    const thumbnails = await fsp.readdir(path.join(projectRoot, '资产', '缩略图'))
    expect(thumbnails).toHaveLength(1)
    await fsp.rm(path.join(projectRoot, '资产', '缩略图', thumbnails[0]))
    const restored = await thumbnailBuffer(assetId)
    expect(restored.equals(first)).toBe(true)
  })

  it('缩略图接口拒绝越界、符号链接、非图片和未知 ID，仅返回空', async () => {
    const outside = path.join(root, 'outside.png')
    await fsp.copyFile(await makeImage('png'), outside)
    const assetsDirectory = path.join(projectRoot, '资产')
    await fsp.mkdir(assetsDirectory, { recursive: true })
    await fsp.symlink(outside, path.join(assetsDirectory, 'link.png'))
    await fsp.writeFile(path.join(assetsDirectory, 'asset-index.json'), JSON.stringify([
      { id: 'escape', kind: 'image', path: '../outside.png', createdAt: '2026-01-01' },
      { id: 'symlink', kind: 'image', path: '资产/link.png', createdAt: '2026-01-01' },
      { id: 'video', kind: 'video', path: '资产/video.mp4', createdAt: '2026-01-01' },
    ]))
    for (const assetId of ['escape', 'symlink', 'video', 'missing']) {
      await expect(readAssetThumbnail({ projectRoot, assetId })).resolves.toEqual({ dataUrl: null })
    }
    await expect(readAssetThumbnail({ projectRoot, assetId: '' })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    })
  })

  it('坏索引不被缩略图读取覆盖', async () => {
    const file = path.join(projectRoot, '资产', 'asset-index.json')
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await fsp.writeFile(file, '{broken')
    await expect(readAssetThumbnail({ projectRoot, assetId: 'any' })).rejects.toMatchObject({
      code: 'ASSET_INDEX_CORRUPT',
    })
    await expect(fsp.readFile(file, 'utf-8')).resolves.toBe('{broken')
  })
})
