import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(TEST_DIR, '../..')
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-governance-docs.cjs')

type CheckError = { rule: string; path: string; line: number; message: string }
type CheckResult = { errors: CheckError[]; stats: Record<string, number> }
const { runChecks } = createRequire(import.meta.url)(SCRIPT_PATH) as {
  runChecks: (root: string) => CheckResult
}

const temporaryRoots: string[] = []

function write(root: string, relative: string, content: string) {
  const target = path.join(root, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-docs-'))
  temporaryRoots.push(root)
  write(root, 'AGENTS.md', [
    '# AGENTS',
    '默认只读治理 §0，再按任务加载相关章节。',
    '使用 docs/features/README.md 定位当前负责包。',
    '',
  ].join('\n'))
  write(root, '版本记录.md', [
    '# 版本总索引',
    '| 年份 | 条目数 | 正文 |',
    '| --- | --- | --- |',
    '| 2026 | 1 | [版本记录-2026.md](./版本记录-2026.md) |',
    '| 日期 | 标题 | 正文 |',
    '| --- | --- | --- |',
    '| 2026-11-20 | feature-001 示例实施 | [2026 年分卷](./版本记录-2026.md) |',
    '',
  ].join('\n'))
  write(root, '版本记录-2026.md', [
    '# 版本记录 · 2026',
    '## 2026-11',
    '### 2026-11-20 · feature-001 示例实施',
    '- [feature-001 负责包](docs/features/feature-001-示例/) 已完成短摘要。',
    '',
  ].join('\n'))
  write(root, 'docs/governance/SDG-AI-决策台账.md', [
    '# 决策总索引',
    '连续编号共 **1** 条。',
    '| 决策 | 日期 | 卡口 | 条目 |',
    '| --- | --- | --- | --- |',
    '| [D-001](./SDG-AI-决策台账-2026.md#d-001--k7--示例决策) | 2026-11-20 | K7 | 示例决策 |',
    '',
  ].join('\n'))
  write(root, 'docs/governance/SDG-AI-决策台账-2026.md', [
    '# 决策分卷',
    '## D-001 ｜ K7 ｜ 示例决策',
    '- **日期**：2026-11-20。',
    '- **决策**：保持示例边界。',
    '',
  ].join('\n'))
  write(root, 'docs/features/README.md', [
    '# 任务包索引',
    '## 1. 现行负责包（1）',
    '| 模块 | 当前负责包 |',
    '| --- | --- |',
    '| 示例 | [feature-001](./feature-001-示例/) |',
    '## 2. 历史归档目录（0）',
    '',
  ].join('\n'))
  write(root, 'docs/features/feature-001-示例/SDG-RE-需求规格.md', '# 需求\n')
  write(root, 'docs/features/feature-001-示例/SDG-RE-任务清单.md', '# 任务\n')
  write(root, 'docs/features/feature-001-示例/SDG-AI-变更记录.md', [
    '# 变更记录',
    '## 一、决策记录',
    '### D-001 示例决策',
    '保留永久决策。',
    '## 二、实施记录',
    '实施过程已经压缩，现行行为以需求与契约为准。',
    '## 三、修订记录',
    '暂无。',
    '',
  ].join('\n'))
  return root
}

function rules(result: CheckResult) {
  return result.errors.map((error) => error.rule)
}

afterEach(() => {
  while (temporaryRoots.length) {
    const root = temporaryRoots.pop()!
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('文档治理机检 · 合成仓库', () => {
  it('接受满足七类契约的最小仓库', () => {
    const result = runChecks(makeFixture())
    expect(result.errors).toEqual([])
    expect(result.stats).toMatchObject({ versions: 1, decisions: 1, features: 1 })
  })

  it('C-DOC1 拒绝版本索引漂移和失效锚点', () => {
    const root = makeFixture()
    write(root, '版本记录-2026.md', [
      '# 版本记录 · 2026',
      '## 2026-11',
      '### 2026-11-19 · 被改写的日期',
      '- [feature-001 负责包](docs/features/feature-001-示例/) 已完成短摘要。',
      '- [坏锚点](版本记录.md#不存在的标题)',
      '',
    ].join('\n'))
    const result = runChecks(root)
    expect(rules(result)).toContain('C-DOC1')
    expect(result.errors.some((error) => error.message.includes('第 1 条 date'))).toBe(true)
    expect(result.errors.some((error) => error.message.includes('锚点无法解析'))).toBe(true)
  })

  it('C-DOC2 拒绝决策重复编号及索引顺序漂移', () => {
    const root = makeFixture()
    const annual = fs.readFileSync(path.join(root, 'docs/governance/SDG-AI-决策台账-2026.md'), 'utf8')
    write(root, 'docs/governance/SDG-AI-决策台账-2026.md', `${annual}\n## D-001 ｜ K7 ｜ 示例决策\n- **日期**：2026-11-20。\n`)
    const result = runChecks(root)
    expect(rules(result)).toContain('C-DOC2')
    expect(result.errors.some((error) => error.message.includes('D-001 重复'))).toBe(true)
  })

  it('C-DOC3 拒绝磁盘目录未入索引及缺文件', () => {
    const root = makeFixture()
    write(root, 'docs/features/feature-002-遗漏/SDG-RE-需求规格.md', '# 需求\n')
    const result = runChecks(root)
    expect(rules(result)).toContain('C-DOC3')
    expect(result.errors.some((error) => error.message.includes('未进入轻索引'))).toBe(true)
    expect(result.errors.some((error) => error.message.includes('缺少必需文件'))).toBe(true)
  })

  it('C-DOC4 拒绝未登记豁免的旧结构', () => {
    const root = makeFixture()
    write(root, 'docs/features/feature-001-示例/SDG-AI-变更记录.md', '# 旧变更记录\n只有流水，没有三分类。\n')
    const result = runChecks(root)
    expect(rules(result)).toContain('C-DOC4')
    expect(result.errors.filter((error) => error.rule === 'C-DOC4')).toHaveLength(3)
  })

  it('C-DOC5 拒绝编年与负责包共享长整段', () => {
    const root = makeFixture()
    const duplicate = `这是一段用于验证整段复制检查的治理文本，${'重复内容'.repeat(24)}。`
    write(root, '版本记录-2026.md', [
      '# 版本记录 · 2026',
      '## 2026-11',
      '### 2026-11-20 · feature-001 示例实施',
      '- [feature-001 负责包](docs/features/feature-001-示例/) 已完成短摘要。',
      `- ${duplicate}`,
      '',
    ].join('\n'))
    write(root, 'docs/features/feature-001-示例/SDG-AI-变更记录.md', [
      '# 变更记录',
      '## 一、决策记录',
      '保留永久决策。',
      '## 二、实施记录',
      `- ${duplicate}`,
      '## 三、修订记录',
      '暂无。',
      '',
    ].join('\n'))
    const result = runChecks(root)
    expect(rules(result)).toContain('C-DOC5')
    expect(result.errors.some((error) => error.message.includes('归一化整段'))).toBe(true)
  })

  it('C-DOC6 拒绝单 Feature 长文，跨 Feature 条目豁免', () => {
    const root = makeFixture()
    write(root, '版本记录-2026.md', [
      '# 版本记录 · 2026',
      '## 2026-11',
      '### 2026-11-20 · feature-001 示例实施',
      '- [feature-001 负责包](docs/features/feature-001-示例/)',
      `- ${'长'.repeat(1201)}`,
      '',
    ].join('\n'))
    expect(rules(runChecks(root))).toContain('C-DOC6')

    write(root, '版本记录-2026.md', [
      '# 版本记录 · 2026',
      '## 2026-11',
      '### 2026-11-20 · 跨 Feature 治理',
      `- feature-001 与 feature-002：${'长'.repeat(1201)}`,
      '',
    ].join('\n'))
    expect(rules(runChecks(root))).not.toContain('C-DOC6')
  })

  it('C-DOC6 拒绝单 Feature 条目缺少负责包链接', () => {
    const root = makeFixture()
    write(root, '版本记录-2026.md', [
      '# 版本记录 · 2026',
      '## 2026-11',
      '### 2026-11-20 · feature-001 示例实施',
      '- 仅提及 feature-001，没有 Markdown 链接。',
      '',
    ].join('\n'))
    const result = runChecks(root)
    expect(result.errors.some((error) => error.rule === 'C-DOC6' && error.message.includes('未链接负责包'))).toBe(true)
  })

  it('C-DOC7 拒绝默认上下文回退和通用铁律回嵌', () => {
    const root = makeFixture()
    write(root, 'AGENTS.md', [
      '# AGENTS',
      '使用 docs/features/README.md 定位当前负责包。',
      '## 1. 三条铁律',
      'No Spec, No Code。',
      '',
    ].join('\n'))
    const result = runChecks(root)
    expect(rules(result)).toContain('C-DOC7')
    expect(result.errors.some((error) => error.message.includes('不得重新内嵌'))).toBe(true)
  })
})

describe('文档治理机检 · 真实仓库与 CLI', () => {
  it('真实仓库通过全部检查', () => {
    const result = runChecks(REPO_ROOT)
    expect(result.errors).toEqual([])
    expect(result.stats.versions).toBeGreaterThan(0)
    expect(result.stats.decisions).toBeGreaterThan(0)
    expect(result.stats.features).toBeGreaterThan(0)
  })

  it('CLI 可从其他 cwd 成功执行', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], { cwd: os.tmpdir(), encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('DOC_GOVERNANCE_CHECK_OK')
  })

  it('CLI 在合成失败仓库退出 1 并报告定位信息', () => {
    const root = makeFixture()
    write(root, 'scripts/check-governance-docs.cjs', fs.readFileSync(SCRIPT_PATH, 'utf8'))
    write(root, 'AGENTS.md', '# 已丢失全部上下文边界\n')
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-governance-docs.cjs')], {
      cwd: path.dirname(root),
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DOC_GOVERNANCE_CHECK_FAILED')
    expect(result.stderr).toContain('[C-DOC7] AGENTS.md:1')
  })
})
