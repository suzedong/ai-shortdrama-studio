// T3：installAgentProfiles / setupRuntimeFiles 安装契约
import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'
import os from 'node:os'

const electronMock = vi.hoisted(() => ({ isPackaged: false }))
vi.mock('electron', () => ({
  app: { get isPackaged() { return electronMock.isPackaged } },
}))

import {
  AGENT_PROFILES,
  installAgentProfiles,
  setupRuntimeFiles,
  runtimeConfigDir,
} from '../../../electron/runtime/provider'

let tmpRoot: string
let userDataDir: string

beforeAll(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-agent-install-'))
})

beforeEach(async () => {
  userDataDir = await fsp.mkdtemp(path.join(tmpRoot, 'userdata-'))
  electronMock.isPackaged = false
})

const ARK_MODEL = 'ep-2026-test-model'

describe('T3 · Agent profile 安装', () => {
  it('ARK_MODEL 存在：4 个 profile 全部落盘，model 已替换、占位符不残留（director 已退役）', async () => {
    const installed = await installAgentProfiles({ userDataDir, modelRef: `ark/${ARK_MODEL}` })
    expect(installed.map(p => p.name)).toEqual(AGENT_PROFILES.map(p => p.name))

    const agentsDir = path.join(runtimeConfigDir(userDataDir), 'agents')
    const files = await fsp.readdir(agentsDir)
    expect(files.sort()).toEqual(
      AGENT_PROFILES.map(p => p.file).sort(),
    )

    for (const profile of installed) {
      expect(profile.path).toBe(path.join(agentsDir, AGENT_PROFILES.find(p => p.name === profile.name)!.file))
      const md = await fsp.readFile(profile.path, 'utf-8')
      expect(md).toContain(`model: ark/${ARK_MODEL}`)
      expect(md).not.toContain('__MODEL_REF__')
    }
  })

  it('真实安装产物保留 showrunner 独占委派与三个 subagent 禁止嵌套委派', async () => {
    const installed = await installAgentProfiles({ userDataDir, modelRef: `ark/${ARK_MODEL}` })
    const docs = new Map<string, string>()
    for (const profile of installed) {
      docs.set(profile.name, await fsp.readFile(profile.path, 'utf-8'))
    }

    const showrunner = docs.get('showrunner')!
    expect(showrunner).toContain('\n  task: true\n')
    const taskRules = showrunner.match(/permission:\n  task:\n([\s\S]*?)(?=\n  read:)/)?.[1] ?? ''
    expect(taskRules).toContain('    "*": deny')
    expect(Array.from(taskRules.matchAll(/^    ([\w-]+): allow$/gm), m => m[1])).toEqual([
      'writer', 'media-director', 'comfyui-operator',
    ])

    for (const name of ['writer', 'media-director', 'comfyui-operator']) {
      const md = docs.get(name)!
      expect(md).toContain('\n  task: false\n')
      expect(md).toContain('\npermission:\n  task: deny\n')
    }
  })

  it('ARK_MODEL 缺失 / 空白：抛 UPSTREAM_AUTH_MISSING，无 profile 写出', async () => {
    await expect(installAgentProfiles({ userDataDir, modelRef: '' })).rejects.toMatchObject({
      name: 'UPSTREAM_AUTH_MISSING',
    })
    await expect(installAgentProfiles({ userDataDir, modelRef: '   ' })).rejects.toMatchObject({
      name: 'UPSTREAM_AUTH_MISSING',
    })
    const agentsDir = path.join(runtimeConfigDir(userDataDir), 'agents')
    await expect(fsp.readdir(agentsDir)).rejects.toThrow()
  })

  it('setupRuntimeFiles：有 model 时 profiles 为 4 项；缺 model 时为空数组 + UPSTREAM_AUTH_MISSING', async () => {
    const ok = await setupRuntimeFiles({ userDataDir, arkModel: ARK_MODEL })
    expect(ok.profiles).toHaveLength(4)
    expect(ok.profiles.some(p => p.name === 'director')).toBe(false)
    expect(ok.profileError).toBeNull()

    const other = await fsp.mkdtemp(path.join(tmpRoot, 'userdata-nomodel-'))
    const missing = await setupRuntimeFiles({ userDataDir: other })
    expect(missing.profiles).toEqual([])
    expect(missing.profileError?.code).toBe('UPSTREAM_AUTH_MISSING')
  })
})
