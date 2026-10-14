// feature-802 视觉风格谱系接入 · ID 注册表（契约 §2）
// 18 条固化「ID ↔ 名称 ↔ 家族 ↔ 主备 ↔ 可行度 ↔ 辅助候选」唯一代码事实。
// 版本号不在此固化（运行时从 md 读出）。谱系升级须同时改本表与 md，漂移测试会点名。
import type { RegisteredStyleEntry, StyleFamilyCode } from './types.js'

const FAMILY_LABELS: Record<StyleFamilyCode, string> = {
  A: '写实影像系',
  B: '青春治愈系',
  C: '动画插画系',
  D: '类型氛围系',
  E: '材质工艺系',
}

function entry(
  id: string,
  name: string,
  familyCode: StyleFamilyCode,
  role: RegisteredStyleEntry['role'],
  feasibility: RegisteredStyleEntry['feasibility'],
  auxiliaryCandidate = false,
): RegisteredStyleEntry {
  return { id, name, familyCode, familyLabel: FAMILY_LABELS[familyCode], role, feasibility, auxiliaryCandidate }
}

/** 18 条，顺序按契约 §2 表（家族 A→E、家族内按 J.2 表行序） */
export const STYLE_REGISTRY: readonly RegisteredStyleEntry[] = [
  entry('A1', '数字电影写实', 'A', 'main', 'high'),
  entry('A2', '胶片电影感', 'A', 'main', 'high'),
  entry('A3', '年代胶片（千禧·90s·80s）', 'A', 'backup', 'high'),
  entry('A4', 'DV·CCD 数码复古', 'A', 'backup', 'high'),
  entry('A5', '黑白电影', 'A', 'backup', 'high'),
  entry('A7', '拟真人·仿真人动漫', 'A', 'main', 'high'),
  entry('B1', '清新生活流', 'B', 'main', 'high', true),
  entry('C1', '日式动漫', 'C', 'main', 'high'),
  entry('C2', '国漫·新中式插画', 'C', 'main', 'high'),
  entry('C5', '美式卡通', 'C', 'backup', 'high'),
  entry('C6', '扁平矢量·低多边形', 'C', 'backup', 'high'),
  entry('C7', '韩漫·精致美型', 'C', 'main', 'high'),
  entry('D1', '冷调悬疑', 'D', 'main', 'high', true),
  entry('D2', '赛博·科幻', 'D', 'main', 'high', true),
  entry('D3', '奇幻童话', 'D', 'backup', 'high', true),
  entry('D4', '暗黑·哥特', 'D', 'backup', 'high', true),
  entry('D5', '神话国风', 'D', 'main', 'high', true),
  entry('E1', '3D CG', 'E', 'main', 'medium'),
]

/** 18 个注册 ID */
export const CATALOG_IDS: readonly string[] = STYLE_REGISTRY.map((e) => e.id)

/** 辅助候选封闭域 6 个：B1 + D1/D2/D3/D4/D5 */
export const AUXILIARY_CANDIDATE_IDS: readonly string[] = STYLE_REGISTRY
  .filter((e) => e.auxiliaryCandidate)
  .map((e) => e.id)

const ENTRY_BY_ID = new Map<string, RegisteredStyleEntry>(STYLE_REGISTRY.map((e) => [e.id, e]))

export function isKnownStyleId(id: string): boolean {
  return ENTRY_BY_ID.has(id)
}

export function isAuxiliaryCandidate(id: string): boolean {
  return ENTRY_BY_ID.get(id)?.auxiliaryCandidate === true
}

export function getRegisteredEntry(id: string): RegisteredStyleEntry | undefined {
  return ENTRY_BY_ID.get(id)
}
