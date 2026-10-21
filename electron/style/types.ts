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

// ---- feature-810 谱系升级差异工作流（契约 §1）----
// DTO 仅主进程 / renderer 两端消费（K1 零触发）：此处定义 + src/global.d.ts 镜像，不进 shared。

/** 项目引用条目在当前谱系中的现况 */
export interface StyleUpgradeRefEntry {
  /** 项目引用的风格 ID（mainStyleId / auxiliaryStyleId） */
  id: string
  /** 引用角色：主风格 / 辅助风格 */
  role: 'main' | 'auxiliary'
  /** 该 ID 是否已不在当前谱系 */
  removed: boolean
  /** removed=false 时存在：当前谱系中的现况 */
  current?: {
    role: StyleRole
    auxiliaryCandidate: boolean
    feasibility: StyleFeasibility
    /** 锚点词明细当前值（J.2 原文按逗号/顿号切分，面板展示用） */
    anchorWords: string[]
  }
}

/** J.3「谱系变更记录」单版本节 */
export interface StyleChangelogEntry {
  /** 'v1.47' */
  version: string
  /** 'YYYY-MM-DD'（节内可缺省） */
  date?: string
  /** 变更条目，一行一条自由中文简述 */
  items: string[]
}

/** 谱系升级差异（style:upgrade-diff IPC 返回） */
export interface StyleUpgradeDiff {
  /** catalogVersion ≠ 当前谱系 version（逐字比较，同 STYLE_VERSION_MISMATCH 语义） */
  hasUpgrade: boolean
  /** 项目引用版本（hasUpgrade=true 时存在） */
  registeredVersion?: string
  /** 当前谱系版本 */
  currentVersion: string
  /** 引用条目现况（主 + 辅，无辅则仅主） */
  referenced: StyleUpgradeRefEntry[]
  /** 任一引用条目 removed=true → 采纳禁用 */
  blocking: boolean
  /** 版本区间 (registered, current] 内条目 */
  changelog: StyleChangelogEntry[]
  /** 谱系无 J.3 段 / 解析失败 → true，面板明示「谱系未提供变更明细」 */
  changelogUnavailable: boolean
  /** 未立项 / 无 style 字段空态 → true（面板禁用采纳并提示「立项后可采纳」） */
  noBrief?: boolean
}
