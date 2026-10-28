// feature-806 Harness 基础校验 · 纯函数规则集（契约 §1.3 七条 checkId，冻结只增不改不删）
// 只读零写盘、零 LLM、零出网；MCP harness.validate 与 0-final 门写盘前拦截共用本实现（契约 §2.1/§2.2），禁止两套口径。
import path from 'node:path'
import fsp from 'node:fs/promises'
import type { BriefDraft, CanvasGate, ProjectManifest } from '../../shared/types.js'
import { readLatestBrief } from '../brief/plan.js'
import { MANIFEST_FILE, parseManifest } from '../project/manifest.js'
import { BRIEF_FINAL_GATE_ID, findBriefGate, gateVersion } from '../gate/guard.js'
import { loadStyleCatalog } from '../style/loader.js'
import { validateStyleRefs } from '../style/validate.js'
import type { HarnessCategory, HarnessCheckId, HarnessFinding, HarnessReport, HarnessSeverity } from './types.js'

/**
 * 校验输入（契约 §2）：
 * - 工具层 harness.validate：subject=磁盘最新立项单、candidateVersion=最新版号（发布前自查口径）；
 * - 0-final 门联动：subject=待发布草案、candidateVersion=将发布版本号（写盘前拦截口径）。
 */
export interface HarnessValidationInput {
  projectDir: string
  gateId: string
  subject: BriefDraft
  candidateVersion: number
}

// D-023 画幅闭集；项目性质闭集（shared/types.ts ProjectKind）
const ASPECT_RATIOS = ['竖屏 9:16', '横屏 16:9'] as const
const PROJECT_KINDS = ['commercial', 'memorial'] as const

// 必填键标签表：plan.ts 同名表未导出且该文件不在本任务包白名单（契约 §4），此处自建，口径与 evaluateDraft 一致
const ELEMENT_KEYS = [
  { key: 'genre', label: '题材赛道' },
  { key: 'platforms', label: '目标平台', array: true },
  { key: 'episodeDuration', label: '单集时长' },
  { key: 'episodeCount', label: '集数' },
  { key: 'tone', label: '风格基调' },
  { key: 'aspectRatio', label: '画幅' },
] as const

const PREMISE_KEYS = [
  { key: 'leads', label: '人物' },
  { key: 'time', label: '时间' },
  { key: 'place', label: '地点' },
  { key: 'coreEvent', label: '核心事件' },
  { key: 'seasonBoundary', label: '本季边界' },
] as const

const STYLE_KEYS = [
  { key: 'mainStyleId', label: '主风格谱系 ID' },
  { key: 'catalogVersion', label: '谱系版本' },
] as const

/** manifest 容错读取：ENOENT / 损坏 JSON 回退默认（initiating + briefVersion null），与 manifest.ts 读路径同语义 */
async function readManifestTolerant(projectDir: string): Promise<ProjectManifest> {
  let raw: unknown = {}
  try {
    raw = JSON.parse(await fsp.readFile(path.join(projectDir, MANIFEST_FILE), 'utf-8'))
  } catch {
    // 缺失或损坏：按空对象容错（七条冻结枚举无对应 checkId，不臆造报告项）
  }
  return parseManifest(raw, new Date().toISOString())
}

/** canvas.json 门上下文容错读取：缺失/损坏/非数组均视为无门 */
async function readGatesTolerant(projectDir: string): Promise<CanvasGate[]> {
  try {
    const raw = JSON.parse(await fsp.readFile(path.join(projectDir, 'canvas.json'), 'utf-8')) as { gates?: unknown }
    return Array.isArray(raw.gates) ? (raw.gates as CanvasGate[]) : []
  } catch {
    return []
  }
}

/**
 * 批一七条规则（判定全部确定性）：
 * - STRUCT_REQUIRED_KEYS：必填键缺失/undefined（kind、六要素、前提五键、style 双键）；
 * - STRUCT_VERSION_CHAIN：磁盘最新立项单 version 与 manifest.briefVersion 三向比对（双 null 过，任一 null 或不等拦截）；
 * - CONTENT_KEY_TEXT_EMPTY：键在而空（trim 空串 / platforms 空数组 / 诊断字段在而空）；
 * - SPEC_FIELD_ENUM：kind / aspectRatio 闭集越界、字段类型不符（platforms 无平台枚举来源，只查类型不查取值）；
 * - SPEC_STYLE_REF_UNKNOWN：复用 802 validateStyleRefs；谱系不可装载降级 warning 单条、不阻塞；
 * - CONSIST_GATE_PAYLOAD_VERSION：0-final 门 payload.version 与候选版本比对；无门 / 历史门无版本保守跳过；
 * - CONSIST_MANIFEST_STAGE：仅查「无立项却越过立项阶段」一向（briefVersion=null 且 status≠initiating）。
 *   反向（briefVersion≥1 且 status=initiating）是 publish 写指针到 manifest.advance 之间的正常瞬态，不查防误伤。
 * 判定边界：键缺失归 STRUCT、空值归 CONTENT、类型/枚举错归 SPEC，互不双报。
 */
export async function runHarnessValidation(input: HarnessValidationInput): Promise<HarnessReport> {
  if (input.gateId !== BRIEF_FINAL_GATE_ID) {
    throw Object.assign(new Error(`批一仅支持 gateId='${BRIEF_FINAL_GATE_ID}'，收到「${input.gateId}」`), {
      code: 'INVALID_ARGUMENT',
    })
  }

  const { projectDir, subject, candidateVersion } = input
  const findings: HarnessFinding[] = []
  const push = (category: HarnessCategory, checkId: HarnessCheckId, severity: HarnessSeverity, message: string): void => {
    findings.push({ gateId: input.gateId, category, checkId, severity, message })
  }

  // ---- structure · STRUCT_REQUIRED_KEYS ----
  if (subject.kind === undefined || subject.kind === null) {
    push('structure', 'STRUCT_REQUIRED_KEYS', 'blocker', '缺少必填键 kind（项目性质），请补齐后重试')
  }
  for (const { key, label } of ELEMENT_KEYS) {
    if (subject.fiveElements?.[key] === undefined) {
      push('structure', 'STRUCT_REQUIRED_KEYS', 'blocker', `缺少必填键 fiveElements.${key}（${label}），请补齐后重试`)
    }
  }
  for (const { key, label } of PREMISE_KEYS) {
    if (subject.premise?.[key] === undefined) {
      push('structure', 'STRUCT_REQUIRED_KEYS', 'blocker', `缺少必填键 premise.${key}（${label}），请补齐后重试`)
    }
  }
  for (const { key, label } of STYLE_KEYS) {
    if (subject.style?.[key] === undefined) {
      push('structure', 'STRUCT_REQUIRED_KEYS', 'blocker', `缺少必填键 style.${key}（${label}），请补齐后重试`)
    }
  }

  // ---- content · CONTENT_KEY_TEXT_EMPTY（键在而空；缺失已由 STRUCT 报告，不双报）----
  const emptyText = (field: string, label: string, value: unknown): void => {
    if (typeof value === 'string' && value.trim() === '') {
      push('content', 'CONTENT_KEY_TEXT_EMPTY', 'blocker', `${field}（${label}）内容为空，请填写后重试`)
    }
  }
  for (const { key, label } of ELEMENT_KEYS) {
    const value = subject.fiveElements?.[key]
    if (key === 'platforms') {
      if (Array.isArray(value) && value.length === 0) {
        push('content', 'CONTENT_KEY_TEXT_EMPTY', 'blocker', 'fiveElements.platforms（目标平台）为空数组，请至少填写一个平台')
      }
    } else {
      emptyText(`fiveElements.${key}`, label, value)
    }
  }
  for (const { key, label } of PREMISE_KEYS) emptyText(`premise.${key}`, label, subject.premise?.[key])
  for (const { key, label } of STYLE_KEYS) emptyText(`style.${key}`, label, subject.style?.[key])
  emptyText('diagnosisSummary', '诊断摘要', subject.diagnosisSummary)
  emptyText('diagnosisDetail', '诊断明细', subject.diagnosisDetail)

  // ---- spec · SPEC_FIELD_ENUM（闭集越界 / 字段类型不符）----
  if (subject.kind !== undefined && subject.kind !== null) {
    if (typeof subject.kind !== 'string' || !(PROJECT_KINDS as readonly string[]).includes(subject.kind)) {
      push('spec', 'SPEC_FIELD_ENUM', 'blocker', `kind 取值「${String(subject.kind)}」越界，仅允许 commercial / memorial`)
    }
  }
  const aspectRatio = subject.fiveElements?.aspectRatio
  if (typeof aspectRatio === 'string' && aspectRatio.trim() !== ''
    && !(ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) {
    push('spec', 'SPEC_FIELD_ENUM', 'blocker', `fiveElements.aspectRatio 取值「${aspectRatio}」越界，仅允许 竖屏 9:16 / 横屏 16:9（D-023）`)
  }
  const platforms = subject.fiveElements?.platforms
  if (platforms !== undefined) {
    if (!Array.isArray(platforms)) {
      push('spec', 'SPEC_FIELD_ENUM', 'blocker', 'fiveElements.platforms 类型不符：应为字符串数组')
    } else if (platforms.some(p => typeof p !== 'string' || p.trim() === '')) {
      push('spec', 'SPEC_FIELD_ENUM', 'blocker', 'fiveElements.platforms 元素类型不符：应全部为非空字符串')
    }
  }
  const stringFields: Array<[string, unknown]> = [
    ['fiveElements.genre', subject.fiveElements?.genre],
    ['fiveElements.episodeDuration', subject.fiveElements?.episodeDuration],
    ['fiveElements.episodeCount', subject.fiveElements?.episodeCount],
    ['fiveElements.tone', subject.fiveElements?.tone],
    ...PREMISE_KEYS.map(({ key }) => [`premise.${key}`, subject.premise?.[key]] as [string, unknown]),
    ...STYLE_KEYS.map(({ key }) => [`style.${key}`, subject.style?.[key]] as [string, unknown]),
    ['diagnosisSummary', subject.diagnosisSummary],
    ['diagnosisDetail', subject.diagnosisDetail],
  ]
  for (const [field, value] of stringFields) {
    if (value !== undefined && typeof value !== 'string') {
      push('spec', 'SPEC_FIELD_ENUM', 'blocker', `${field} 类型不符：应为字符串`)
    }
  }

  // ---- spec · SPEC_STYLE_REF_UNKNOWN（复用 802 validateStyleRefs；谱系不可装载降级 warning）----
  try {
    const catalog = await loadStyleCatalog()
    for (const issue of validateStyleRefs(subject.style ?? {}, catalog)) {
      push('spec', 'SPEC_STYLE_REF_UNKNOWN', 'blocker', issue.message)
    }
  } catch (e) {
    push('spec', 'SPEC_STYLE_REF_UNKNOWN', 'warning',
      `视觉风格谱系不可装载（${(e as Error).message}），本项降级为提醒：请在谱系恢复后复查 style 引用`)
  }

  // ---- consistency · 版本链 / 门 / 阶段（读盘上下文各取一次）----
  const [latestBrief, manifest, gates] = await Promise.all([
    readLatestBrief(projectDir),
    readManifestTolerant(projectDir),
    readGatesTolerant(projectDir),
  ])

  const latestVersion = latestBrief?.version ?? null
  const manifestVersion = manifest.briefVersion
  if (!(latestVersion === null && manifestVersion === null) && latestVersion !== manifestVersion) {
    push('consistency', 'STRUCT_VERSION_CHAIN', 'blocker',
      `立项单版本链断裂：磁盘最新立项单 ${latestVersion === null ? '不存在' : `v${latestVersion}`}，manifest.briefVersion=${manifestVersion === null ? 'null' : manifestVersion}；请核对立项单文件与 manifest 指针`)
  }

  const gate = findBriefGate(gates)
  if (gate) {
    const gv = gateVersion(gate)
    // 历史门无 payload.version（gv=null）：同 807 guard 保守放行，不做版本比对
    if (gv !== null && gv !== candidateVersion) {
      push('consistency', 'CONSIST_GATE_PAYLOAD_VERSION', 'blocker',
        `0-final 门绑定 v${gv}，与候选版本 v${candidateVersion} 不一致；一张门只授权一版内容，请针对当前版本重新发门`)
    }
  }

  if (manifestVersion === null && manifest.status !== 'initiating') {
    push('consistency', 'CONSIST_MANIFEST_STAGE', 'blocker',
      `manifest 状态 ${manifest.status} 已越过立项阶段，但 briefVersion=null（无立项单）；状态机与立项事实不符，请检查 manifest.json`)
  }

  return {
    gateId: input.gateId,
    briefVersion: candidateVersion,
    passed: !findings.some(f => f.severity === 'blocker'),
    findings,
    checkedAt: new Date().toISOString(),
  }
}
