// feature-802 视觉风格谱系接入 · 谱系 md 解析（契约 §3）
// 纯函数：只解析 J.0 版本行与 J.2 五张明细表；不读 J.1/J.4、html、预览目录。
import type { ParsedStyleEntry, StyleFamilyCode, StyleFeasibility, StyleRole } from './types.js'

export const STYLE_CATALOG_PARSE_ERROR = 'STYLE_CATALOG_PARSE_ERROR'

const VERSION_RE = /本文版本：谱系\s*(v\d+\.\d+)/

/** 家族粗体表头前缀（逐字匹配 md J.2） */
const FAMILY_HEADERS: ReadonlyArray<{ prefix: string; code: StyleFamilyCode; rowCount: number }> = [
  { prefix: '**A 写实影像系', code: 'A', rowCount: 6 },
  { prefix: '**B 青春治愈系', code: 'B', rowCount: 1 },
  { prefix: '**C 动画插画系', code: 'C', rowCount: 5 },
  { prefix: '**D 类型氛围系', code: 'D', rowCount: 5 },
  { prefix: '**E 材质工艺系', code: 'E', rowCount: 1 },
]

function parseError(message: string): Error {
  return Object.assign(new Error(message), { code: STYLE_CATALOG_PARSE_ERROR })
}

const FEASIBILITY_MAP: Record<string, StyleFeasibility> = {
  '●高': 'high',
  '●中': 'medium',
  '●低': 'low',
}

/** 切一行 markdown 表格：首尾空栏不计，须恰为 5 个非空单元；返回 null 表示非数据行（表头/分隔行） */
function splitDataRow(line: string, family: StyleFamilyCode, lineNo: number): string[] | null {
  const raw = line.split('|')
  // | a | b | … 切分后首尾为空串
  const cells = raw.slice(1, -1).map((c) => c.trim())
  if (cells.length === 0 || cells.some((c) => c === '')) {
    // 空行（非表行）忽略；但以 | 开头却列数异常/含空单元的行视为坏行
    if (line.trim().startsWith('|')) {
      throw parseError(`J.2 ${family} 系表第 ${lineNo} 行列数或空单元非法（须 5 个非空单元）`)
    }
    return null
  }
  if (cells.length !== 5) {
    throw parseError(`J.2 ${family} 系表第 ${lineNo} 行列数为 ${cells.length}（须恰为 5 列）`)
  }
  // 表头行
  if (cells[0] === '风格') return null
  // 分隔行（---、:--、--:）
  if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return null
  return cells
}

/** 解析单个家族表区段（表头之后到下一家族表头之前的文本） */
function parseFamily(
  section: string,
  family: StyleFamilyCode,
  expectedRows: number,
): ParsedStyleEntry[] {
  const lines = section.split(/\r?\n/)
  const rows: ParsedStyleEntry[] = []
  for (const [idx, line] of lines.entries()) {
    if (!line.trim().startsWith('|')) continue
    const cells = splitDataRow(line, family, idx + 1)
    if (!cells) continue

    // 第 1 列：名称 + 「主」/「备」尾标（兼容无空格写法，如 L45）
    const first = cells[0]!
    let role: StyleRole
    if (first.endsWith('「主」')) role = 'main'
    else if (first.endsWith('「备」')) role = 'backup'
    else throw parseError(`J.2 ${family} 系表第 ${idx + 1} 行名称缺少「主」/「备」标注：${first}`)
    const name = first.slice(0, -3).trim()

    // 第 5 列：可行度
    const feasibility = FEASIBILITY_MAP[cells[4]!]
    if (!feasibility) {
      throw parseError(`J.2 ${family} 系表第 ${idx + 1} 行可行度标记无法识别：${cells[4]}`)
    }

    rows.push({
      name,
      familyCode: family,
      role,
      visualTraits: cells[1]!,
      anchorWords: cells[2]!,
      textureRecipe: cells[3]!,
      feasibility,
    })
  }
  if (rows.length !== expectedRows) {
    throw parseError(`J.2 ${family} 系表数据行数为 ${rows.length}（须 ${expectedRows}）`)
  }
  return rows
}

/**
 * 解析谱系 md 全文。
 * @returns version（如 'v1.46'）与 J.2 五表共 18 条（A→E、表行序）
 */
export function parseStyleCatalogMd(text: string): { version: string; entries: ParsedStyleEntry[] } {
  const versionMatch = VERSION_RE.exec(text)
  if (!versionMatch) {
    throw parseError('谱系 md 缺少版本行（未匹配「本文版本：谱系 vX.YY」）')
  }
  const version = versionMatch[1]!

  const j2Start = text.indexOf('## J.2')
  const j3Start = text.indexOf('## J.3')
  if (j2Start < 0 || j3Start < 0 || j3Start < j2Start) {
    throw parseError('谱系 md 缺少 J.2 明细区段（## J.2 / ## J.3 定位失败）')
  }
  const j2 = text.slice(j2Start, j3Start)

  // 定位五张家族表表头位置
  const located = FAMILY_HEADERS.map((f) => {
    const pos = j2.indexOf(f.prefix)
    if (pos < 0) throw parseError(`J.2 缺少家族表头：${f.prefix}`)
    return { ...f, pos }
  }).sort((a, b) => a.pos - b.pos)

  const entries: ParsedStyleEntry[] = []
  for (const [i, f] of located.entries()) {
    const sectionEnd = i + 1 < located.length ? located[i + 1]!.pos : j2.length
    const section = j2.slice(f.pos, sectionEnd)
    entries.push(...parseFamily(section, f.code, f.rowCount))
  }

  const total = FAMILY_HEADERS.reduce((sum, f) => sum + f.rowCount, 0)
  if (entries.length !== total) {
    throw parseError(`J.2 五表合计 ${entries.length} 条（须 ${total}）`)
  }
  return { version, entries }
}
