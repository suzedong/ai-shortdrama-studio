import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(TEST_DIR, '../..')
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/docs-context.cjs')
const { buildContext } = createRequire(import.meta.url)(SCRIPT_PATH) as {
  buildContext: (root: string, input: string) => string
}

const temporaryRoots: string[] = []

function write(root: string, relative: string, content: string) {
  const target = path.join(root, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-context-'))
  temporaryRoots.push(root)
  write(root, 'docs/features/README.md', [
    '# 任务包索引',
    '## 1. 现行负责包（1）',
    '| 模块 | 当前负责包 | 历史来源 | 当前状态 / 开放边界 | 路径 |',
    '| --- | --- | --- | --- | --- |',
    '| 示例 | [feature-001 · 示例包](./feature-001-示例/) | — | 🚧 实施中；真机待验收 | `src/` |',
    '## 2. 历史归档目录（0）',
    '',
  ].join('\n'))
  write(root, 'docs/features/feature-001-示例/SDG-RE-需求规格.md', [
    '# feature-001 · 需求规格',
    '> 状态：🚧 实施中',
    '> 上游：合成夹具',
    '## 1. 目标',
    '这段背景不应进入验收或排除摘录。',
    '## 2. 验收标准',
    '| 编号 | 标准 |',
    '| --- | --- |',
    '| AC1 | 保留原始验收表 |',
    '### 验收条件细节',
    '嵌套验收只输出一次。',
    '## 3. 非目标',
    '- 不生成新的摘要事实源。',
    '## 4. 风险',
    '风险正文不属于排除章节。',
    '',
  ].join('\n'))
  write(root, 'docs/features/feature-001-示例/SDG-RE-任务清单.md', [
    '# feature-001 · 任务清单',
    '> **状态**：🚧 T2 待实施',
    '- [x] T1 已完成任务',
    '- [ ] T2 保留未完成任务原文',
    '```md',
    '- [ ] 代码块中的任务不得提取',
    '```',
    '## 后续验收',
    '- **验收**：完成后登记遗留项，不表示当前开放。',
    '- **遗留项**：真实窗口仍待具备服务后验收。',
    '',
  ].join('\n'))
  write(root, 'docs/features/feature-001-示例/SDG-AI-变更记录.md', [
    '# feature-001 · 变更记录',
    '## 一、决策记录',
    '保留决策。',
    '## 二、实施记录',
    '保留实施。',
    '## 三、修订记录',
    '### X-001 · 真机补验',
    '- **开放状态**：真实窗口仍待用户验收。',
    '- 已修复的问题不得进入开放项。',
    '',
  ].join('\n'))
  return root
}

afterEach(() => {
  while (temporaryRoots.length) {
    const root = temporaryRoots.pop()!
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('docs:context · 合成仓库', () => {
  it('提取状态、验收、未完成任务、开放项和排除项并保留来源', () => {
    const output = buildContext(makeFixture(), '001')
    expect(output).toContain('# docs:context · feature-001 · 示例包')
    expect(output).toContain('- Feature 索引：🚧 实施中；真机待验收')
    expect(output).toContain('SDG-RE-需求规格.md：状态：🚧 实施中')
    expect(output).toContain('SDG-RE-任务清单.md：**状态**：🚧 T2 待实施')
    expect(output).toContain('| AC1 | 保留原始验收表 |')
    expect(output).toContain('**来源：SDG-RE-需求规格.md › 2. 验收标准**')
    expect(output.split('嵌套验收只输出一次。')).toHaveLength(2)
    expect(output).toContain('- [ ] T2 保留未完成任务原文')
    expect(output).not.toContain('- [x] T1 已完成任务')
    expect(output).not.toContain('代码块中的任务不得提取')
    expect(output).toContain('- **遗留项**：真实窗口仍待具备服务后验收。')
    expect(output).toContain('**来源：SDG-AI-变更记录.md › X-001 · 真机补验**')
    expect(output).toContain('- **开放状态**：真实窗口仍待用户验收。')
    expect(output).not.toContain('完成后登记遗留项，不表示当前开放')
    expect(output).toContain('- 不生成新的摘要事实源。')
    expect(output).not.toContain('风险正文不属于排除章节')
  })

  it('三种输入形式结果一致且执行前后事实源不变', () => {
    const root = makeFixture()
    const packageRoot = path.join(root, 'docs/features/feature-001-示例')
    const files = [
      path.join(root, 'docs/features/README.md'),
      ...['SDG-RE-需求规格.md', 'SDG-RE-任务清单.md', 'SDG-AI-变更记录.md'].map((file) => path.join(packageRoot, file)),
    ]
    const before = files.map((file) => fs.readFileSync(file, 'utf8'))
    const entriesBefore = fs.readdirSync(packageRoot)
    const expected = buildContext(root, '001')
    expect(buildContext(root, 'feature-001')).toBe(expected)
    expect(buildContext(root, 'feature-001-示例')).toBe(expected)
    expect(buildContext(root, '001')).toBe(expected)
    expect(files.map((file) => fs.readFileSync(file, 'utf8'))).toEqual(before)
    expect(fs.readdirSync(packageRoot)).toEqual(entriesBefore)
  })

  it('缺失章节和空任务分别降级，不推断验收通过', () => {
    const root = makeFixture()
    write(root, 'docs/features/feature-001-示例/SDG-RE-需求规格.md', '# 需求\n> 状态：记录中\n')
    write(root, 'docs/features/feature-001-示例/SDG-RE-任务清单.md', '# 任务\n- [x] 已全部勾选\n')
    write(root, 'docs/features/feature-001-示例/SDG-AI-变更记录.md', '# 变更\n## 三、修订记录\n- 已关闭。\n')
    const output = buildContext(root, '001')
    expect(output).toContain('未找到标题含“验收标准 / 验收条件”的章节。')
    expect(output).toContain('无显式未勾选任务，不代表验收通过。')
    expect(output).toContain('未检测到带显式开放标记的列表项，不代表验收通过。')
    expect(output).toContain('未找到标题含“非目标 / 排除 / 范围外”的章节。')
  })

  it('拒绝无匹配、非法参数和必需文件读取失败', () => {
    const root = makeFixture()
    expect(() => buildContext(root, '999')).toThrow('未找到 Feature：999')
    expect(() => buildContext(root, '1')).toThrow('非法 Feature 参数')
    expect(() => buildContext(root, '../feature-001-示例')).toThrow('非法 Feature 参数')
    fs.rmSync(path.join(root, 'docs/features/feature-001-示例/SDG-RE-任务清单.md'))
    expect(() => buildContext(root, '001')).toThrow('无法读取 docs/features/feature-001-示例/SDG-RE-任务清单.md')
  })

  it('同编号多匹配失败，完整目录名仍可精确解析', () => {
    const root = makeFixture()
    fs.cpSync(
      path.join(root, 'docs/features/feature-001-示例'),
      path.join(root, 'docs/features/feature-001-另一包'),
      { recursive: true },
    )
    expect(() => buildContext(root, '001')).toThrow('Feature 编号匹配到多个目录')
    expect(buildContext(root, 'feature-001-另一包')).toContain('docs/features/feature-001-另一包/')
  })
})

describe('docs:context · 真实仓库与 CLI', () => {
  it('真实 feature-829 从其他 cwd 提取 T2—T5', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, '829'], { cwd: os.tmpdir(), encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    for (const task of ['T2', 'T3', 'T4', 'T5']) expect(result.stdout).toContain(`- [ ] ${task}`)
    expect(result.stdout).not.toContain('- [ ] T1')
    expect(result.stdout).toContain('## 非目标／排除项')
  })

  it('真实 feature-830 成功执行且不新增包内文件', () => {
    const packageRoot = path.join(REPO_ROOT, 'docs/features/feature-830-测试与验收数据落点统一')
    const before = fs.readdirSync(packageRoot)
    const result = spawnSync(process.execPath, [SCRIPT_PATH, 'feature-830'], { cwd: os.tmpdir(), encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('CONTEXT-AC5')
    expect(fs.readdirSync(packageRoot)).toEqual(before)
  })

  it('CLI 对缺少参数和无匹配退出 1 并输出用法', () => {
    for (const args of [[], ['999']]) {
      const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], { cwd: os.tmpdir(), encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('DOC_CONTEXT_FAILED')
      expect(result.stderr).toContain('用法：npm run docs:context --')
    }
  })
})
