#!/usr/bin/env node
/**
 * feature-830 · 真机验收环境准备器（契约 §2.2）
 *
 * 目的：让 P1/P2 真机验收使用真实工作区 ~/Documents/ai-shortdrama-studio/，
 * 同时把应用级配置（userData）隔离到单独目录，避免污染 AI 服务配置 / opencode 会话 /
 * ComfyUI 实例。主进程通过 ASD_USER_DATA 环境变量识别隔离目录（见 electron/main.ts）。
 *
 * 硬护栏（个人目录安全）：
 *   - 只做「只读枚举 + 复制备份」，绝不修改、移动或删除真实工作区里的任何文件；
 *   - 验收夹具名必须是 project-accept-* 且不含路径分隔符；
 *   - 备份目标已存在时拒绝覆盖；
 *   - 不提供任何自动清理函数，夹具清理须人工逐项确认后另行执行。
 *
 * 用法：
 *   node scripts/acceptance-env.cjs --check     # 只读：打印真实工作区与现有项目清单，不写盘
 *   node scripts/acceptance-env.cjs --prepare  # 备份真实工作区 + 生成隔离 userData，打印清单
 *
 * 可被验收 harness require 后调用导出函数；本脚本不启动 Electron。
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const ACCEPT_PREFIX = 'project-accept-'
const ACCEPT_RE = /^project-accept-[A-Za-z0-9_-]+$/

/** 夹具名护栏：非 project-accept-* 一律拒绝，含路径分隔符也拒绝（防越界）。 */
function assertAcceptFixture(name) {
  if (typeof name !== 'string' || !ACCEPT_RE.test(name)) {
    throw new Error(
      `ACCEPT_FIXTURE_REJECTED: 验收夹具名必须以 ${ACCEPT_PREFIX} 开头且只含字母/数字/下划线/连字符；收到 ${JSON.stringify(name)}`,
    )
  }
  return name
}

/** 真实工作区默认根（与 electron/settings/workspace.ts defaultWorkspaceRoot 同口径）。 */
function defaultWorkspaceRoot(home = os.homedir()) {
  return path.join(home, 'Documents', 'ai-shortdrama-studio')
}

/** 只读枚举工作区内的项目目录；不递归、不写盘。 */
function listProjects(workspaceRoot) {
  if (!fs.existsSync(workspaceRoot)) return []
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('project-'))
    .map(entry => entry.name)
    .sort()
}

function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function defaultBackupDir() {
  return path.join(os.tmpdir(), `ai-shortdrama-accept-backup-${stamp()}`)
}

function defaultUserDataDir() {
  return path.join(os.tmpdir(), `ai-shortdrama-accept-userdata-${stamp()}`)
}

/** 复制备份：源零改动，目标已存在则拒绝覆盖，跟随符号链接关闭。 */
function createBackup(workspaceRoot, backupDir) {
  const source = path.resolve(workspaceRoot)
  const target = path.resolve(backupDir || defaultBackupDir())
  if (!fs.existsSync(source)) {
    throw new Error(`WORKSPACE_NOT_FOUND: 工作区不存在：${source}`)
  }
  if (fs.existsSync(target)) {
    throw new Error(`BACKUP_EXISTS: 备份目标已存在，拒绝覆盖：${target}`)
  }
  fs.cpSync(source, target, { recursive: true, dereference: false, errorOnExist: true })
  return target
}

/**
 * 生成 Electron 启动 env。HOME 默认保持真实（documents 即真实用户目录 → 工作区真实），
 * 只把 ASD_USER_DATA 指向隔离目录；不覆写 TMPDIR、不动 workspace.json。
 */
function buildElectronEnv(options = {}) {
  if (!options.userData) {
    throw new Error('ASD_USER_DATA_REQUIRED: 必须提供隔离 userData 目录')
  }
  const env = { ...process.env }
  env.ASD_USER_DATA = path.resolve(options.userData)
  if (options.home) env.HOME = path.resolve(options.home)
  return env
}

/** 一键准备：枚举 + 备份 + 建隔离 userData + 生成 env。仍不删除任何东西。 */
function prepare(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || defaultWorkspaceRoot())
  const existingProjects = listProjects(workspaceRoot)
  const backup = createBackup(workspaceRoot, options.backupDir)
  const userData = path.resolve(options.userData || defaultUserDataDir())
  fs.mkdirSync(userData, { recursive: true })
  const env = buildElectronEnv({ userData, home: options.home })
  return {
    workspaceRoot,
    existingProjects,
    backup,
    userData,
    env,
    note: '夹具须用 project-accept-* 前缀；本工具零删除，清理须人工确认。',
  }
}

function printCheck(root) {
  const projects = listProjects(root)
  console.log('[acceptance-env] --check（只读，未写盘）')
  console.log(`  真实工作区 : ${root}`)
  console.log(`  目录存在   : ${fs.existsSync(root)}`)
  console.log(`  现有项目   : ${projects.length} 个`)
  for (const name of projects) console.log(`    - ${name}`)
  console.log(`  夹具前缀   : ${ACCEPT_PREFIX}*（非该前缀一律拒绝写入）`)
  console.log('  提示：现有项目均非验收夹具，禁止在验收中修改/删除。')
}

function printPrepare(result) {
  console.log('[acceptance-env] --prepare（已备份，未删除任何文件）')
  console.log(`  真实工作区 : ${result.workspaceRoot}`)
  console.log(`  备份位置   : ${result.backup}`)
  console.log(`  隔离 userData : ${result.userData}`)
  console.log(`  ASD_USER_DATA : ${result.env.ASD_USER_DATA}`)
  console.log(`  HOME（documents 来源）: ${result.env.HOME || '(继承进程)'}`)
  console.log(`  现有项目   : ${result.existingProjects.join(', ') || '(无)'}`)
  console.log(`  ${result.note}`)
}

if (require.main === module) {
  const mode = process.argv[2] || '--check'
  const workspaceRoot = path.resolve(
    process.env.ASD_ACCEPT_WORKSPACE || defaultWorkspaceRoot(),
  )
  try {
    if (mode === '--check') {
      printCheck(workspaceRoot)
    } else if (mode === '--prepare') {
      printPrepare(
        prepare({
          workspaceRoot,
          backupDir: process.env.ASD_ACCEPT_BACKUP || undefined,
          userData: process.env.ASD_ACCEPT_USER_DATA || undefined,
        }),
      )
    } else {
      console.error('用法: node scripts/acceptance-env.cjs --check | --prepare')
      process.exitCode = 2
    }
  } catch (err) {
    console.error(`[acceptance-env] ${err && err.message ? err.message : err}`)
    process.exitCode = 1
  }
}

module.exports = {
  ACCEPT_PREFIX,
  assertAcceptFixture,
  defaultWorkspaceRoot,
  listProjects,
  createBackup,
  buildElectronEnv,
  prepare,
}
