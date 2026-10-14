// feature-802 视觉风格谱系接入 · electron 侧类型（契约 §1）
// 本文件所有类型不进 shared、不 re-export；renderer / preload 不可见。

/** 家族代码（J.1 五家族） */
export type StyleFamilyCode = 'A' | 'B' | 'C' | 'D' | 'E'

/** 验证状态轴：主 = 已项目验证；备 = 已入谱未验证（均可作主风格，备风险自担） */
export type StyleRole = 'main' | 'backup'

/** 可行度（J.0 图例三档；v1.46 实际仅出现 high/medium） */
export type StyleFeasibility = 'high' | 'medium' | 'low'

/** ID 注册表条目（代码固化，catalog.ts） */
export interface RegisteredStyleEntry {
  /** 'A1' … 'E1'，18 个 */
  id: string
  /** J.2 表内名称（去掉「主」「备」标注后的逐字名称） */
  name: string
  familyCode: StyleFamilyCode
  /** 如 '写实影像系' */
  familyLabel: string
  role: StyleRole
  feasibility: StyleFeasibility
  /** 仅 B1 + D1/D2/D3/D4/D5 为 true */
  auxiliaryCandidate: boolean
}

/** md 解析条目（J.2 单行，无 ID） */
export interface ParsedStyleEntry {
  /** 去标注名称 */
  name: string
  /** 由所在五张表判定 */
  familyCode: StyleFamilyCode
  /** 「主」/「备」标注 */
  role: StyleRole
  /** J.2「视觉特征」列原文 */
  visualTraits: string
  /** J.2「锚点词示例」列原文 */
  anchorWords: string
  /** J.2「质感配方」列原文 */
  textureRecipe: string
  /** J.2「可行度」列：●高→high / ●中→medium / ●低→low */
  feasibility: StyleFeasibility
}

/** 装载成品（注册表为骨架关联 md 明细，loader 缓存对象） */
export interface LoadedStyleCatalog {
  /** 从 md J.0 读出，如 'v1.46'；不硬编码 */
  version: string
  /** 实际读取的 md 绝对路径（错误消息/调试用） */
  sourcePath: string
  entries: Array<RegisteredStyleEntry & {
    visualTraits: string
    anchorWords: string
    textureRecipe: string
  }>
}

/** 谱系类问题码（evaluateDraft.styleIssues 与 style.validate 同形） */
export type StyleIssueCode =
  /** 引用 ID 不在 18 个注册 ID 内 */
  | 'STYLE_ID_UNKNOWN'
  /** catalogVersion 与装载版本非逐字相等 */
  | 'STYLE_VERSION_MISMATCH'
  /** 辅助 ID 已知但不属 6 个封闭候选 */
  | 'STYLE_AUX_NOT_CANDIDATE'

export interface StyleIssue {
  code: StyleIssueCode
  /** 'style.mainStyleId' / 'style.catalogVersion' / 'style.auxiliaryStyleId' */
  field: string
  /** 人读可操作原因 */
  message: string
}
