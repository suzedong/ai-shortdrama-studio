'use strict'

const fs = require('node:fs')
const path = require('node:path')

const FEATURE_INDEX = 'docs/features/README.md'
const FEATURE_FILES = {
  requirements: 'SDG-RE-需求规格.md',
  tasks: 'SDG-RE-任务清单.md',
  changelog: 'SDG-AI-变更记录.md',
}
const USAGE = '用法：npm run docs:context -- <feature-id|feature-directory>'

function readRequired(root, relative) {
  try {
    return fs.readFileSync(path.join(root, relative), 'utf8')
  } catch (error) {
    throw new Error(`无法读取 ${relative}：${error.message}`)
  }
}

function resolveFeature(root, input) {
  const value = typeof input === 'string' ? input.trim() : ''
  const idMatch = value.match(/^(?:feature-)?(\d{3})$/)
  const directoryMatch = value.match(/^feature-(\d{3})-[^/\\]+$/)
  if (!idMatch && !directoryMatch) throw new Error(`非法 Feature 参数：${value || '(空)'}`)

  const featuresRoot = path.join(root, 'docs/features')
  let directories
  try {
    directories = fs.readdirSync(featuresRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^feature-\d{3}-/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    throw new Error(`无法读取 docs/features：${error.message}`)
  }

  const id = (idMatch || directoryMatch)[1]
  const matches = directoryMatch
    ? directories.filter((directory) => directory === value)
    : directories.filter((directory) => directory.startsWith(`feature-${id}-`))
  if (!matches.length) throw new Error(`未找到 Feature：${value}`)
  if (matches.length > 1) throw new Error(`Feature 编号匹配到多个目录：${matches.join('、')}`)
  return { id, directory: matches[0] }
}

function tableCells(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim())
}

function indexEntry(indexText, directory) {
  const currentSection = indexText.split(/^##\s+2\./m)[0]
  for (const line of currentSection.split('\n')) {
    const cells = tableCells(line)
    if (!cells || !cells.some((cell) => cell.includes(`](./${directory}/)`))) continue
    return {
      title: cells[1].match(/^\[([^\]]+)\]/)?.[1] || directory,
      status: cells[3] || '',
    }
  }
  return null
}

function scanMarkdown(text) {
  const lines = text.split('\n')
  const headings = []
  const fenced = new Array(lines.length).fill(false)
  let fence = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      fenced[index] = true
      if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fenceMatch) {
      fenced[index] = true
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length }
      continue
    }
    const heading = line.match(/^(#{1,6})[\t ]+(.+?)\s*$/)
    if (heading) {
      headings.push({
        line: index,
        level: heading[1].length,
        title: heading[2].replace(/\s+#+\s*$/, ''),
      })
    }
  }
  return { lines, headings, fenced }
}

function headingAt(scan, line) {
  for (let index = scan.headings.length - 1; index >= 0; index -= 1) {
    if (scan.headings[index].line < line) return scan.headings[index].title
  }
  return '文档开头'
}

function pageStatusLines(scan) {
  const firstSection = scan.headings.find((heading) => heading.level >= 2)?.line ?? scan.lines.length
  const result = []
  let started = false
  for (let index = 0; index < firstSection; index += 1) {
    const line = scan.lines[index]
    if (!scan.fenced[index] && /^\s*>/.test(line)) {
      started = true
      if (line.includes('状态')) result.push(line.trim().replace(/^>\s?/, ''))
    } else if (started) {
      break
    }
  }
  return result
}

function extractSections(scan, file, pattern) {
  const sections = []
  let coveredUntil = -1
  for (let index = 0; index < scan.headings.length; index += 1) {
    const heading = scan.headings[index]
    if (heading.line < coveredUntil || !pattern.test(heading.title)) continue
    let end = scan.lines.length
    for (let next = index + 1; next < scan.headings.length; next += 1) {
      if (scan.headings[next].level <= heading.level) {
        end = scan.headings[next].line
        break
      }
    }
    coveredUntil = end
    sections.push({
      file,
      heading: heading.title,
      text: scan.lines.slice(heading.line + 1, end).join('\n').trim() || '（空章节）',
    })
  }
  return sections
}

function extractUnchecked(scan, file) {
  const items = []
  for (let index = 0; index < scan.lines.length; index += 1) {
    const line = scan.lines[index]
    if (!scan.fenced[index] && /^\s*[-*+]\s+\[ \]\s+/.test(line)) {
      items.push({ file, heading: headingAt(scan, index), text: line.trim() })
    }
  }
  return items
}

function extractOpenItems(scan, file) {
  const items = []
  for (let index = 0; index < scan.lines.length; index += 1) {
    const line = scan.lines[index]
    if (scan.fenced[index] || !/^\s*[-*+]\s+/.test(line) || /^\s*[-*+]\s+\[[ xX]\]/.test(line)) continue
    const label = line.match(/^\s*[-*+]\s+\*\*([^*]+)\*\*/)?.[1].trim()
    const explicitLabel = label && /^(?:遗留项|开放项|开放状态|开放边界)/.test(label)
    if (explicitLabel || /仍待|待验收|待真机|未闭环/.test(line)) {
      items.push({ file, heading: headingAt(scan, index), text: line.trim() })
    }
  }
  return items
}

function renderSections(sections, emptyMessage) {
  if (!sections.length) return emptyMessage
  return sections.map((section) => `**来源：${section.file} › ${section.heading}**\n\n${section.text}`).join('\n\n')
}

function renderItems(items, emptyMessage) {
  if (!items.length) return emptyMessage
  const output = []
  let previousKey = ''
  for (const item of items) {
    const key = `${item.file}\0${item.heading}`
    if (key !== previousKey) output.push(`**来源：${item.file} › ${item.heading}**`, '')
    output.push(item.text, '')
    previousKey = key
  }
  return output.join('\n').trim()
}

function buildContext(root, input) {
  const rootPath = path.resolve(root)
  const feature = resolveFeature(rootPath, input)
  const packageRoot = `docs/features/${feature.directory}`
  const indexText = readRequired(rootPath, FEATURE_INDEX)
  const documents = Object.entries(FEATURE_FILES).map(([kind, file]) => {
    const text = readRequired(rootPath, `${packageRoot}/${file}`)
    return { kind, file, scan: scanMarkdown(text) }
  })
  const byKind = Object.fromEntries(documents.map((document) => [document.kind, document]))
  const indexed = indexEntry(indexText, feature.directory)

  const statuses = []
  if (indexed?.status) statuses.push(`- Feature 索引：${indexed.status}`)
  for (const document of [byKind.requirements, byKind.tasks]) {
    for (const line of pageStatusLines(document.scan)) statuses.push(`- ${document.file}：${line}`)
  }

  const acceptance = [byKind.requirements, byKind.tasks]
    .flatMap((document) => extractSections(document.scan, document.file, /验收标准|验收条件/))
  const unchecked = extractUnchecked(byKind.tasks.scan, byKind.tasks.file)
  const openItems = [byKind.tasks, byKind.changelog]
    .flatMap((document) => extractOpenItems(document.scan, document.file))
  const exclusions = [byKind.requirements, byKind.tasks]
    .flatMap((document) => extractSections(document.scan, document.file, /非目标|排除|范围外/))

  return [
    `# docs:context · ${indexed?.title || feature.directory}`,
    '',
    `- 目录：\`${packageRoot}/\``,
    '- 视图性质：现有事实源的只读摘录，不替代原规格。',
    '',
    '## 当前状态',
    '',
    statuses.join('\n') || '未找到显式状态，不代表验收通过。',
    '',
    '## 验收标准',
    '',
    renderSections(acceptance, '未找到标题含“验收标准 / 验收条件”的章节。'),
    '',
    '## 未完成任务',
    '',
    renderItems(unchecked, '无显式未勾选任务，不代表验收通过。'),
    '',
    '## 显式开放项',
    '',
    renderItems(openItems, '未检测到带显式开放标记的列表项，不代表验收通过。'),
    '',
    '## 非目标／排除项',
    '',
    renderSections(exclusions, '未找到标题含“非目标 / 排除 / 范围外”的章节。'),
    '',
  ].join('\n')
}

function main(args = process.argv.slice(2)) {
  try {
    if (args.length !== 1) throw new Error(`需要且仅接收 1 个参数，当前为 ${args.length} 个`)
    const root = path.resolve(__dirname, '..')
    process.stdout.write(buildContext(root, args[0]))
  } catch (error) {
    console.error('DOC_CONTEXT_FAILED')
    console.error(error.message)
    console.error(USAGE)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = { buildContext, resolveFeature }
