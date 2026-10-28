// feature-806 Harness 基础校验 · 结果结构（契约 §1.2 逐字；主进程类型，不进 shared、不 re-export）

export type HarnessCategory = 'structure' | 'content' | 'spec' | 'consistency'
export type HarnessSeverity = 'blocker' | 'warning'

/** 批一 checkId 枚举（契约 §1.3 冻结；后续批次只增不改不删） */
export type HarnessCheckId =
  | 'STRUCT_REQUIRED_KEYS'
  | 'STRUCT_VERSION_CHAIN'
  | 'CONTENT_KEY_TEXT_EMPTY'
  | 'SPEC_FIELD_ENUM'
  | 'SPEC_STYLE_REF_UNKNOWN'
  | 'CONSIST_GATE_PAYLOAD_VERSION'
  | 'CONSIST_MANIFEST_STAGE'

export interface HarnessFinding {
  gateId: string // 批一恒 '0-final'
  category: HarnessCategory
  checkId: string // 见契约 §1.3 枚举
  severity: HarnessSeverity
  message: string // 中文、可执行修复指向
}

export interface HarnessReport {
  gateId: string
  briefVersion: number
  passed: boolean // 无 blocker 即 true（warning 不拦截）
  findings: HarnessFinding[]
  checkedAt: string // ISO
}
