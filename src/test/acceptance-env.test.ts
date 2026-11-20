// feature-830 · 验收环境准备器契约（任务清单 T5 / 需求 AC5）
// 说明：准备器为 .cjs，用 createRequire 加载；所有临时目录均由 setup.ts 重定向到 .test-tmp/。
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'))
const env = nodeRequire('./scripts/acceptance-env.cjs') as {
  ACCEPT_PREFIX: string
  assertAcceptFixture: (name: string) => string
  defaultWorkspaceRoot: (home?: string) => string
  listProjects: (root: string) => string[]
  createBackup: (root: string, backupDir?: string) => string
  buildElectronEnv: (options: { userData: string; home?: string }) => Record<string, string | undefined>
}

describe('feature-830 验收环境准备器（契约 §2.2）', () => {
  it('夹具前缀护栏：放行 project-accept-*，拒绝真项目名、越界路径与空后缀', () => {
    expect(env.ACCEPT_PREFIX).toBe('project-accept-')
    expect(env.assertAcceptFixture('project-accept-a')).toBe('project-accept-a')
    expect(() => env.assertAcceptFixture('project-20261104-092720-gv9u')).toThrow(/ACCEPT_FIXTURE_REJECTED/)
    expect(() => env.assertAcceptFixture('project-accept-../escape')).toThrow(/ACCEPT_FIXTURE_REJECTED/)
    expect(() => env.assertAcceptFixture('project-accept-')).toThrow(/ACCEPT_FIXTURE_REJECTED/)
  })

  it('真实工作区默认根与 electron/settings/workspace.ts 同口径', () => {
    expect(env.defaultWorkspaceRoot('/Users/example')).toBe(
      path.join('/Users/example', 'Documents', 'ai-shortdrama-studio'),
    )
  })

  it('buildElectronEnv：HOME 保持真实（documents → 真实工作区），仅 ASD_USER_DATA 隔离', () => {
    const userData = path.join(os.tmpdir(), 'asd-accept-userdata-contract')
    const result = env.buildElectronEnv({ userData })
    expect(result.ASD_USER_DATA).toBe(path.resolve(userData))
    expect(result.HOME).toBe(process.env.HOME)
    // 继承调用方 env（含 ASD_TEST_TMP），不篡改、不额外注入工作区隔离变量
    expect(result.ASD_TEST_TMP).toBe(process.env.ASD_TEST_TMP)
  })

  it('buildElectronEnv：缺隔离 userData 时抛错，不生成半成品环境', () => {
    expect(() => env.buildElectronEnv({} as { userData: string })).toThrow(/ASD_USER_DATA_REQUIRED/)
  })

  it('listProjects 只读枚举；createBackup 复制且源零改动，目标已存在拒绝覆盖', async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'asd-accept-workspace-'))
    const backup = path.join(
      os.tmpdir(),
      `asd-accept-backup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    try {
      await fsp.mkdir(path.join(root, 'project-existing'))
      await fsp.mkdir(path.join(root, 'project-accept-a'))
      await fsp.writeFile(
        path.join(root, 'project-existing', 'manifest.json'),
        '{"status":"initiating"}',
        'utf-8',
      )

      expect(env.listProjects(root)).toEqual(['project-accept-a', 'project-existing'])

      const made = env.createBackup(root, backup)
      expect(made).toBe(path.resolve(backup))
      expect(fs.existsSync(path.join(backup, 'project-existing', 'manifest.json'))).toBe(true)
      expect(
        await fsp.readFile(path.join(root, 'project-existing', 'manifest.json'), 'utf-8'),
      ).toBe('{"status":"initiating"}')
      expect(() => env.createBackup(root, backup)).toThrow(/BACKUP_EXISTS/)
    } finally {
      // 仅清理本用例在 .test-tmp/ 内自建的目录，不触碰任何真实工作区
      await fsp.rm(root, { recursive: true, force: true })
      await fsp.rm(backup, { recursive: true, force: true })
    }
  })
})
