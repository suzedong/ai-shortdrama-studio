'use strict'

const fs = require('node:fs')
const path = require('node:path')

const FILES = {
  versionIndex: '版本记录.md',
  versionAnnual: '版本记录-2026.md',
  decisionIndex: 'docs/governance/SDG-AI-决策台账.md',
  decisionAnnual: 'docs/governance/SDG-AI-决策台账-2026.md',
  featureIndex: 'docs/features/README.md',
  agents: 'AGENTS.md',
}

const REQUIRED_FEATURE_FILES = [
  'SDG-RE-需求规格.md',
  'SDG-RE-任务清单.md',
  'SDG-AI-变更记录.md',
]

// 仅允许在此逐包登记有明确理由的旧结构，不在清理中批量改写历史。
const LEGACY_CHANGELOG_BASELINES = new Map([
  'feature-803-ComfyUI统一媒体引擎',
  'feature-816-H3图像通道迁移',
  'feature-820-一级入口与伪造状态收口',
  'feature-821-资产上传与真实缩略图',
  'feature-822-对话侧资产引用',
  'feature-823-多创作页与自由画布持久化',
  'feature-827-项目JSON原子写与异常终止验收',
  'feature-828-项目库P1能力补齐',
  'feature-829-创作页历史与跨页正式引用',
].map((directory) => [
  `docs/features/${directory}/SDG-AI-变更记录.md`,
  '2026-11-20 历史“变更三分类”结构基线；后续实质变更时归一',
]))

function lineAt(text, index) {
  return text.slice(0, Math.max(0, index)).split('\n').length
}

function stripMarkdown(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function githubSlug(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

function tableCells(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim())
}

function readRequired(root, relative, rule, errors) {
  try {
    return fs.readFileSync(path.join(root, relative), 'utf8')
  } catch (error) {
    errors.push({ rule, path: relative, line: 1, message: `无法读取：${error.message}` })
    return null
  }
}

function compareSequences(indexEntries, annualEntries, relativeIndex, relativeAnnual, rule, errors, fields) {
  if (indexEntries.length !== annualEntries.length) {
    errors.push({
      rule,
      path: relativeIndex,
      line: 1,
      message: `索引 ${indexEntries.length} 条，年卷 ${annualEntries.length} 条，数量不一致`,
    })
  }
  const count = Math.min(indexEntries.length, annualEntries.length)
  for (let index = 0; index < count; index += 1) {
    const expected = indexEntries[index]
    const actual = annualEntries[index]
    for (const field of fields) {
      if (expected[field] !== actual[field]) {
        errors.push({
          rule,
          path: relativeAnnual,
          line: actual.line,
          message: `第 ${index + 1} 条 ${field} 与索引不一致：年卷“${actual[field] || '缺失'}”，索引“${expected[field] || '缺失'}”`,
        })
      }
    }
  }
}

function checkDateOrder(entries, relative, rule, errors, direction) {
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1].date
    const current = entries[index].date
    const invalid = direction === 'desc' ? previous < current : previous > current
    if (invalid) {
      errors.push({
        rule,
        path: relative,
        line: entries[index].line,
        message: `日期顺序错误：${previous} 后出现 ${current}`,
      })
    }
  }
}

function parseVersionIndex(text) {
  const entries = []
  let offset = 0
  for (const line of text.split('\n')) {
    const cells = tableCells(line)
    if (cells && cells.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(cells[0]) && /\]\([^)]*版本记录-\d{4}\.md\)/.test(cells[2])) {
      entries.push({ date: cells[0], title: stripMarkdown(cells[1]), line: lineAt(text, offset) })
    }
    offset += line.length + 1
  }
  return entries
}

function parseVersionAnnual(text) {
  const entries = []
  const heading = /^### (\d{4}-\d{2}-\d{2}) · (.+)$/gm
  const headings = []
  for (const match of text.matchAll(heading)) {
    headings.push({
      date: match[1],
      title: stripMarkdown(match[2]),
      index: match.index,
      bodyStart: match.index + match[0].length,
      line: lineAt(text, match.index),
    })
  }
  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index]
    entries.push({
      ...current,
      body: text.slice(current.bodyStart, headings[index + 1]?.index ?? text.length),
    })
  }
  return entries
}

function parseDecisionIndex(text) {
  const entries = []
  let offset = 0
  for (const line of text.split('\n')) {
    const cells = tableCells(line)
    if (cells && cells.length >= 4) {
      const match = cells[0].match(/^\[(D-\d+)\]\(([^)]+)\)$/)
      if (match && /^\d{4}-\d{2}-\d{2}$/.test(cells[1])) {
        entries.push({
          id: match[1],
          date: cells[1],
          title: stripMarkdown(cells[3]),
          line: lineAt(text, offset),
        })
      }
    }
    offset += line.length + 1
  }
  return entries
}

function parseDecisionAnnual(text) {
  const headings = [...text.matchAll(/^## (D-\d+) ｜ (.+)$/gm)]
  return headings.map((match, index) => {
    const body = text.slice(match.index + match[0].length, headings[index + 1]?.index ?? text.length)
    return {
      id: match[1],
      title: stripMarkdown(match[2].replace(/^K\d+\s*｜\s*/, '')),
      date: body.match(/^-\s+(?:\*\*)?日期(?:\*\*)?：(\d{4}-\d{2}-\d{2})/m)?.[1] || '',
      line: lineAt(text, match.index),
    }
  })
}

function checkDuplicates(entries, key, relative, rule, errors) {
  const seen = new Map()
  for (const entry of entries) {
    const value = entry[key]
    if (seen.has(value)) {
      errors.push({
        rule,
        path: relative,
        line: entry.line,
        message: `${value} 重复，首次出现于第 ${seen.get(value)} 行`,
      })
    } else {
      seen.set(value, entry.line)
    }
  }
}

function markdownAnchors(text) {
  const anchors = new Set()
  for (const match of text.matchAll(/^(#{1,6})\s+(.+)$/gm)) anchors.add(githubSlug(match[2]))
  for (const match of text.matchAll(/<a\s+(?:name|id)=["']([^"']+)["']/gi)) anchors.add(match[1])
  return anchors
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function checkExplicitAnchors(root, documents, rule, errors) {
  const cache = new Map()
  const getText = (relative) => {
    if (!cache.has(relative)) cache.set(relative, fs.readFileSync(path.join(root, relative), 'utf8'))
    return cache.get(relative)
  }
  for (const relative of documents) {
    const text = readRequired(root, relative, rule, errors)
    if (text === null) continue
    cache.set(relative, text)
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].trim().split(/\s+["']/)[0]
      if (!target.includes('#') || /^(?:https?:|mailto:)/i.test(target)) continue
      const [filePart, fragmentPart] = target.split('#')
      if (!fragmentPart || /^L\d+(?:-L\d+)?$/.test(fragmentPart)) continue
      const decodedFile = safeDecode(filePart)
      const targetRelative = decodedFile
        ? path.relative(root, path.resolve(path.dirname(path.join(root, relative)), decodedFile))
        : relative
      if (!targetRelative.endsWith('.md')) continue
      if (!fs.existsSync(path.join(root, targetRelative))) {
        errors.push({ rule, path: relative, line: lineAt(text, match.index), message: `锚点目标文件不存在：${target}` })
        continue
      }
      const fragment = safeDecode(fragmentPart)
      if (!markdownAnchors(getText(targetRelative)).has(fragment)) {
        errors.push({ rule, path: relative, line: lineAt(text, match.index), message: `Markdown 锚点无法解析：${target}` })
      }
    }
  }
}

function checkVersions(root, errors) {
  const rule = 'C-DOC1'
  const indexText = readRequired(root, FILES.versionIndex, rule, errors)
  const annualText = readRequired(root, FILES.versionAnnual, rule, errors)
  if (indexText === null || annualText === null) return 0
  const indexEntries = parseVersionIndex(indexText)
  const annualEntries = parseVersionAnnual(annualText)
  compareSequences(indexEntries, annualEntries, FILES.versionIndex, FILES.versionAnnual, rule, errors, ['date'])
  checkDateOrder(indexEntries, FILES.versionIndex, rule, errors, 'desc')
  checkDateOrder(annualEntries, FILES.versionAnnual, rule, errors, 'desc')
  const declared = indexText.match(/^\|\s*2026\s*\|\s*(\d+)\s*\|/m)
  if (declared && Number(declared[1]) !== indexEntries.length) {
    errors.push({ rule, path: FILES.versionIndex, line: 1, message: `分卷导航声明 ${declared[1]} 条，实际索引 ${indexEntries.length} 条` })
  }
  checkExplicitAnchors(root, [FILES.versionIndex, FILES.versionAnnual], rule, errors)
  return annualEntries.length
}

function checkDecisions(root, errors) {
  const rule = 'C-DOC2'
  const indexText = readRequired(root, FILES.decisionIndex, rule, errors)
  const annualText = readRequired(root, FILES.decisionAnnual, rule, errors)
  if (indexText === null || annualText === null) return 0
  const indexEntries = parseDecisionIndex(indexText)
  const annualEntries = parseDecisionAnnual(annualText)
  checkDuplicates(indexEntries, 'id', FILES.decisionIndex, rule, errors)
  checkDuplicates(annualEntries, 'id', FILES.decisionAnnual, rule, errors)
  compareSequences(indexEntries, annualEntries, FILES.decisionIndex, FILES.decisionAnnual, rule, errors, ['id', 'date'])
  const declared = indexText.match(/^\|\s*2026\s*\|\s*(\d+)\s*\|/m)
  if (declared && Number(declared[1]) !== indexEntries.length) {
    errors.push({ rule, path: FILES.decisionIndex, line: 1, message: `分卷导航声明 ${declared[1]} 条，实际索引 ${indexEntries.length} 条` })
  }
  checkExplicitAnchors(root, [FILES.decisionIndex, FILES.decisionAnnual], rule, errors)
  return annualEntries.length
}

function featureDirectories(root) {
  const directory = path.join(root, 'docs/features')
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^feature-\d{3}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}

function indexedFeatures(text) {
  const section = text.split(/^## 2\./m)[0]
  return [...section.matchAll(/\]\(\.\/(feature-(\d{3})-[^)/]+)\/\)/g)].map((match) => ({
    directory: match[1],
    id: match[2],
    line: lineAt(text, match.index),
  }))
}

function checkFeatures(root, errors) {
  const rule = 'C-DOC3'
  const text = readRequired(root, FILES.featureIndex, rule, errors)
  if (text === null) return []
  const indexed = indexedFeatures(text)
  const disk = featureDirectories(root)
  const indexedNames = indexed.map((entry) => entry.directory).sort()
  const onlyIndex = indexedNames.filter((name) => !disk.includes(name))
  const onlyDisk = disk.filter((name) => !indexedNames.includes(name))
  for (const name of onlyIndex) errors.push({ rule, path: FILES.featureIndex, line: 1, message: `索引目录在磁盘不存在：${name}` })
  for (const name of onlyDisk) errors.push({ rule, path: `docs/features/${name}`, line: 1, message: '磁盘现行目录未进入轻索引 §1' })
  checkDuplicates(indexed, 'id', FILES.featureIndex, rule, errors)
  checkDuplicates(disk.map((directory) => ({ id: directory.match(/^feature-(\d{3})-/)[1], line: 1 })), 'id', 'docs/features', rule, errors)
  for (const directory of disk) {
    for (const file of REQUIRED_FEATURE_FILES) {
      const relative = `docs/features/${directory}/${file}`
      if (!fs.existsSync(path.join(root, relative))) {
        errors.push({ rule, path: relative, line: 1, message: '负责包缺少必需文件' })
      }
    }
  }
  return disk
}

function checkChangelogSections(root, directories, errors) {
  const rule = 'C-DOC4'
  for (const directory of directories) {
    const relative = `docs/features/${directory}/SDG-AI-变更记录.md`
    if (LEGACY_CHANGELOG_BASELINES.has(relative)) continue
    const text = readRequired(root, relative, rule, errors)
    if (text === null) continue
    const categories = [
      ['决策', /^##\s+(?:一、决策|一、D(?:\s|$)|D\s*节\s*·\s*决策|D（决策）)/m],
      ['实施', /^##\s+(?:二、实施记录|二、T(?:\s|$)|T\s*节\s*·\s*(?:实施|任务|实现)|T（任务执行）)/m],
      ['修订', /^##\s+(?:三、修订记录|三、X(?:\s|$)|X\s*节\s*·\s*(?:修订注|修复)|X（修复）)/m],
    ]
    for (const [name, pattern] of categories) {
      if (!pattern.test(text)) errors.push({ rule, path: relative, line: 1, message: `缺少${name}分类；旧结构须先在脚本中显式登记豁免` })
    }
  }
}

function paragraphs(text, initialLine = 1) {
  const result = []
  let lines = []
  let startLine = initialLine
  const flush = () => {
    if (!lines.length) return
    const raw = lines.join('\n')
    const normalized = stripMarkdown(raw.replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''))
    const linkCount = (raw.match(/\[[^\]]+\]\([^)]+\)/g) || []).length
    const withoutLinks = stripMarkdown(raw.replace(/\[[^\]]+\]\([^)]+\)/g, ''))
    const isIndexLine = linkCount > 0 && withoutLinks.length === 0
    if (normalized.length >= 80 && !isIndexLine) result.push({ normalized, line: startLine })
    lines = []
  }
  let offset = 0
  for (const line of text.split('\n')) {
    const currentLine = initialLine + offset
    offset += 1
    if (!line.trim()) {
      flush()
      continue
    }
    if (/^\s*(?:#{1,6}\s|>|_{3,}|-{3,}|\*_{3,}|\|)/.test(line)) {
      flush()
      continue
    }
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) flush()
    if (!lines.length) startLine = currentLine
    lines.push(line)
  }
  flush()
  return result
}

function checkDuplication(root, annualText, directories, errors) {
  const rule = 'C-DOC5'
  const packageParagraphs = new Map()
  for (const directory of directories) {
    const relative = `docs/features/${directory}/SDG-AI-变更记录.md`
    const text = readRequired(root, relative, rule, errors)
    if (text === null) continue
    for (const paragraph of paragraphs(text)) {
      if (!packageParagraphs.has(paragraph.normalized)) packageParagraphs.set(paragraph.normalized, { path: relative, line: paragraph.line })
    }
  }
  const annualEntries = parseVersionAnnual(annualText)
  let compared = 0
  for (const entry of annualEntries) {
    for (const paragraph of paragraphs(entry.body, entry.line + 1)) {
      compared += 1
      const duplicate = packageParagraphs.get(paragraph.normalized)
      if (duplicate) {
        errors.push({
          rule,
          path: FILES.versionAnnual,
          line: paragraph.line,
          message: `与 ${duplicate.path}:${duplicate.line} 共享 ${paragraph.normalized.length} 字符的归一化整段`,
        })
      }
    }
  }
  return compared
}

function checkChronicleLength(annualText, errors) {
  const rule = 'C-DOC6'
  let checked = 0
  for (const entry of parseVersionAnnual(annualText)) {
    if (entry.date < '2026-11-20') continue
    const references = new Set([...entry.body.matchAll(/feature-(\d{3})\b/gi)].map((match) => match[1]))
    const repositoryGovernance = /(?:历史归档|跨包|多包|全仓|全库|项目级治理|目录治理)/.test(`${entry.title}\n${entry.body}`)
    if (references.size !== 1 || repositoryGovernance) continue
    checked += 1
    const id = [...references][0]
    const length = stripMarkdown(entry.body).length
    if (length > 1200) {
      errors.push({ rule, path: FILES.versionAnnual, line: entry.line, message: `单 Feature 条目正文 ${length} 字符，超过 1200` })
    }
    const packageLink = new RegExp(`\\]\\((?:\\./)?docs/features/feature-${id}(?:-[^)/]+)?/(?:[^)]+)?\\)`)
    if (!packageLink.test(entry.body)) {
      errors.push({ rule, path: FILES.versionAnnual, line: entry.line, message: `单 Feature 条目未链接负责包 feature-${id}` })
    }
  }
  return checked
}

function checkAgents(root, errors) {
  const rule = 'C-DOC7'
  const text = readRequired(root, FILES.agents, rule, errors)
  if (text === null) return
  const requirements = [
    ['默认只读治理 §0', /默认只读[\s\S]{0,180}§0|§0[\s\S]{0,180}默认只读/],
    ['按任务加载', /按任务(?:触发条件)?加载/],
    ['负责包定位', /docs\/features\/README\.md[\s\S]{0,180}负责|负责包[\s\S]{0,180}docs\/features\/README\.md/],
  ]
  for (const [name, pattern] of requirements) {
    if (!pattern.test(text)) errors.push({ rule, path: FILES.agents, line: 1, message: `缺少边界声明：${name}` })
  }
  const forbidden = /^#{2,4}\s+(?:\d+(?:\.\d+)*[.、]?\s*)?(?:三条)?铁律|^#{2,4}\s+.*(?:No Spec, No Code|共享层保护四条死规则|K1-K10 决策卡口)/gm
  for (const match of text.matchAll(forbidden)) {
    errors.push({ rule, path: FILES.agents, line: lineAt(text, match.index), message: '不得重新内嵌通用铁律章节' })
  }
}

function runChecks(root) {
  const errors = []
  const stats = { versions: 0, decisions: 0, features: 0, paragraphs: 0, shortChronicleEntries: 0 }
  stats.versions = checkVersions(root, errors)
  stats.decisions = checkDecisions(root, errors)
  const directories = checkFeatures(root, errors)
  stats.features = directories.length
  checkChangelogSections(root, directories, errors)
  const annualText = readRequired(root, FILES.versionAnnual, 'C-DOC5', errors)
  if (annualText !== null) {
    stats.paragraphs = checkDuplication(root, annualText, directories, errors)
    stats.shortChronicleEntries = checkChronicleLength(annualText, errors)
  }
  checkAgents(root, errors)
  return { errors, stats }
}

function main() {
  const root = path.resolve(__dirname, '..')
  const { errors, stats } = runChecks(root)
  if (errors.length) {
    console.error('DOC_GOVERNANCE_CHECK_FAILED')
    for (const error of errors) console.error(`[${error.rule}] ${error.path}:${error.line} ${error.message}`)
    process.exitCode = 1
    return
  }
  console.log('DOC_GOVERNANCE_CHECK_OK')
  console.log(`C-DOC1 versions=${stats.versions}`)
  console.log(`C-DOC2 decisions=${stats.decisions}`)
  console.log(`C-DOC3 features=${stats.features}`)
  console.log(`C-DOC4 change_logs=${stats.features}`)
  console.log(`C-DOC5 annual_paragraphs=${stats.paragraphs}`)
  console.log(`C-DOC6 short_single_feature_entries=${stats.shortChronicleEntries}`)
  console.log('C-DOC7 agents_context_boundary=ok')
}

if (require.main === module) main()

module.exports = { runChecks, githubSlug, stripMarkdown }
