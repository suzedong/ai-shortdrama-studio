// feature-802 视觉风格谱系接入 · 引用校验纯函数（契约 §5.1）
// 只校验已给且非空白的字段；空/缺省不产 issue（非空由既有 MAIN_STYLE_MISSING 负责）。
import type { LoadedStyleCatalog, StyleIssue } from './types.js'
import { isAuxiliaryCandidate, isKnownStyleId } from './catalog.js'

export interface StyleRefInput {
  mainStyleId?: string
  catalogVersion?: string
  auxiliaryStyleId?: string
}

export function validateStyleRefs(ids: StyleRefInput, catalog: LoadedStyleCatalog): StyleIssue[] {
  const issues: StyleIssue[] = []
  const version = catalog.version
  const total = catalog.entries.length
  const mainId = ids.mainStyleId?.trim()
  const auxId = ids.auxiliaryStyleId?.trim()
  const refVersion = ids.catalogVersion?.trim()

  if (mainId && !isKnownStyleId(mainId)) {
    issues.push({
      code: 'STYLE_ID_UNKNOWN',
      field: 'style.mainStyleId',
      message: `主视觉风格 ID「${mainId}」不在谱系（当前 ${version}，${total} 项），请先用 style.catalog 选型`,
    })
  }

  if (refVersion && refVersion !== version) {
    issues.push({
      code: 'STYLE_VERSION_MISMATCH',
      field: 'style.catalogVersion',
      message: `引用谱系版本「${refVersion}」与注册版本「${version}」不一致，请按当前版本确认`,
    })
  }

  if (auxId) {
    if (!isKnownStyleId(auxId)) {
      issues.push({
        code: 'STYLE_ID_UNKNOWN',
        field: 'style.auxiliaryStyleId',
        message: `辅助风格 ID「${auxId}」不在谱系（当前 ${version}，${total} 项）`,
      })
    } else if (!isAuxiliaryCandidate(auxId)) {
      issues.push({
        code: 'STYLE_AUX_NOT_CANDIDATE',
        field: 'style.auxiliaryStyleId',
        message: `辅助风格「${auxId}」不在封闭候选域（仅 B1 清新生活流与 D1–D5 类型氛围系 6 项）`,
      })
    }
  }

  return issues
}
