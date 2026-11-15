import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const context = vi.hoisted(() => ({ userData: '', projectDir: null as string | null }))

vi.mock('electron', () => ({ app: { getPath: () => context.userData } }))
vi.mock('../../../electron/project/current.js', () => ({
  getActiveProjectDir: () => {
    if (!context.projectDir) throw Object.assign(new Error('无打开项目'), { code: 'INVALID_ARGUMENT' })
    return context.projectDir
  },
}))

import {
  listInstances, upsertInstance, removeInstance, requireInstance,
} from '../../../electron/comfy/settings.js'

let root: string
const roots: string[] = []

function globalFile(): string {
  return path.join(context.userData, 'comfyui', 'instances.json')
}

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'comfy-app-settings-'))
  roots.push(root)
  context.userData = path.join(root, 'user-data')
  context.projectDir = null
  await fsp.mkdir(context.userData, { recursive: true })
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map(dir => fsp.rm(dir, { recursive: true, force: true })))
})

describe('应用级 ComfyUI 实例配置', () => {
  it('没有打开项目时也可初始化空配置', async () => {
    await expect(listInstances()).resolves.toEqual([])
    const saved = JSON.parse(await fsp.readFile(globalFile(), 'utf-8'))
    expect(saved).toMatchObject({ schemaVersion: 1, instances: [] })
  })

  it('首次读取迁移当前项目旧配置，随后以全局文件为准且不改写旧字段', async () => {
    const project = path.join(root, 'project')
    context.projectDir = project
    await fsp.mkdir(project, { recursive: true })
    const legacy = [{
      id: 'legacy', name: '旧 GPU', baseUrl: 'http://192.168.1.30:8188/', enabled: false,
      addedAt: '2026-01-01T00:00:00.000Z', gpus: ['GPU 0'], vramGB: 24,
    }]
    const projectFile = path.join(project, 'project.json')
    await fsp.writeFile(projectFile, JSON.stringify({ name: '演示', comfyInstances: legacy }), 'utf-8')

    await expect(listInstances()).resolves.toEqual([{ ...legacy[0], baseUrl: 'http://192.168.1.30:8188' }])
    expect(JSON.parse(await fsp.readFile(projectFile, 'utf-8')).comfyInstances).toEqual(legacy)

    await fsp.writeFile(projectFile, JSON.stringify({ name: '演示', comfyInstances: [] }), 'utf-8')
    await expect(listInstances()).resolves.toHaveLength(1)
    expect(JSON.parse(await fsp.readFile(globalFile(), 'utf-8')).instances[0].id).toBe('legacy')
  })

  it('CRUD 保留 addedAt，支持启停、GPU 元数据与显式清除', async () => {
    const created = await upsertInstance({
      id: 'c1', name: '  主力 GPU  ', baseUrl: 'http://gpu-box:8188/', enabled: true,
      addedAt: '2026-01-01T00:00:00.000Z', gpus: ['GPU 0', 'GPU 0', ' GPU 1 '], vramGB: 48,
    })
    expect(created).toMatchObject({
      id: 'c1', name: '主力 GPU', baseUrl: 'http://gpu-box:8188', enabled: true,
      addedAt: '2026-01-01T00:00:00.000Z', gpus: ['GPU 0', 'GPU 1'], vramGB: 48,
    })

    const disabled = await upsertInstance({ id: 'c1', enabled: false })
    expect(disabled).toMatchObject({ enabled: false, addedAt: created.addedAt, gpus: ['GPU 0', 'GPU 1'], vramGB: 48 })
    const cleared = await upsertInstance({ id: 'c1', gpus: undefined, vramGB: undefined })
    expect(cleared).not.toHaveProperty('gpus')
    expect(cleared).not.toHaveProperty('vramGB')

    await expect(removeInstance('c1')).resolves.toEqual({ ok: true })
    await expect(requireInstance('c1')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('无 id 新增时生成唯一应用级实例', async () => {
    const created = await upsertInstance({ name: '本机', baseUrl: 'http://127.0.0.1:8188', enabled: true })
    expect(created.id).toMatch(/^c-[0-9a-f]{8}$/)
    expect(created.addedAt).toEqual(expect.any(String))
    await expect(requireInstance(created.id)).resolves.toEqual(created)
  })

  it('拒绝公网地址与非法 GPU 参数', async () => {
    await expect(upsertInstance({ id: 'bad', baseUrl: 'https://example.com' }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(upsertInstance({ id: 'bad', baseUrl: 'http://127.0.0.1', gpus: [''] }))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(fsp.access(globalFile())).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('全局配置损坏时显式报错且不以空配置覆盖', async () => {
    await fsp.mkdir(path.dirname(globalFile()), { recursive: true })
    await fsp.writeFile(globalFile(), '{broken', 'utf-8')
    await expect(listInstances()).rejects.toMatchObject({ code: 'COMFY_SETTINGS_CORRUPT' })
    expect(await fsp.readFile(globalFile(), 'utf-8')).toBe('{broken')
  })
})
