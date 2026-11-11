// feature-015 · 裁决后置动作执行器（契约 §3 / §4）
// 门裁决是确定性状态推进，由系统直做（D-016），不经 AI 对话：
//   0-final  → 用随门落盘的结构化草案直接 brief.publish（双写 + 节点 + 首版 manifest）
//   1-a~2-b  → 只推进 manifest（产物正文与画布节点仍由 Agent 落盘）
// 失败分类（契约 §4.2）：草案问题回退 pending；执行故障保持 approved。
import type { CanvasGate, ManifestEvent } from '../../shared/types.js'
import type { BriefDraft } from '../../shared/types.js'
import { getActiveProjectDir } from '../project/current.js'
import { canvasStore } from '../canvas/store.js'
import { advanceManifest } from '../project/manifest.js'
import { evaluateDraft, listBriefVersions } from '../brief/plan.js'
import { publishV1InQueue, type ReadyBriefDraft } from '../brief/publish.js'
import { loadStyleCatalog } from '../style/loader.js'
import { runHarnessValidation } from '../harness/validate.js'
import type { HarnessReport } from '../harness/types.js'

export type GateExecution =
  | { ok: true; summary: string }
  | { ok: false; code: string; message: string; revertToPending?: boolean }

/** 门 → manifest 定稿事件（0-final 的首版推进在 publishFromGate 内处理，不在此表） */
export const GATE_MANIFEST_EVENTS: Readonly<Record<string, ManifestEvent>> = {
  '1-a': 'outline-approved',
  '1-b': 'profiles-approved',
  '2-a': 'scenes-approved',
  '2-b': 'dialogue-approved',
  '2-c': 'storyboard-finalized',
}

export const BRIEF_GATE_ID = '0-final'

/** 0-final 门 payload 中结构化草案的键名（契约 §2） */
export const GATE_DRAFT_KEY = 'draft'

function payloadOf(gate: CanvasGate): Record<string, unknown> {
  return typeof gate.payload === 'object' && gate.payload !== null
    ? gate.payload as Record<string, unknown>
    : {}
}

/** 读随门落盘的结构化草案；无则 null（历史门 / 未按新纪律发门） */
export function gateDraft(gate: CanvasGate): BriefDraft | null {
  const d = payloadOf(gate)[GATE_DRAFT_KEY]
  return typeof d === 'object' && d !== null ? d as BriefDraft : null
}

export function gatePayloadVersion(gate: CanvasGate): number | null {
  const v = payloadOf(gate).version
  return typeof v === 'number' ? v : null
}

function fail(code: string, message: string, revertToPending = false): GateExecution {
  return { ok: false, code, message, ...(revertToPending ? { revertToPending: true } : {}) }
}

function projectStillActive(projectDir: string): boolean {
  try {
    return getActiveProjectDir() === projectDir
  } catch {
    return false
  }
}

function projectChanged(): GateExecution {
  return fail('PROJECT_CHANGED', '裁决执行期间项目已切换，已停止后置动作。请回到原项目检查现场后重试。')
}

/** 与 feature-806 同形：门卡只展示 blocker，warning 保留在摘要中供追溯。 */
async function writeHarnessSummary(gate: CanvasGate, report: HarnessReport): Promise<void> {
  gate.payload = {
    ...payloadOf(gate),
    harnessValidation: { checkedAt: report.checkedAt, findings: report.findings },
  }
  await canvasStore.upsertGate(gate)
}

async function clearHarnessSummary(gate: CanvasGate): Promise<void> {
  const payload = payloadOf(gate)
  if (!('harnessValidation' in payload)) return
  const { harnessValidation: _stale, ...rest } = payload
  gate.payload = rest
  await canvasStore.upsertGate(gate)
}

/** 0-final：首版系统直发；再版仅确认草案，仍由 Agent 三选一后 impact.commit 唯一发布 */
async function publishFromGate(gate: CanvasGate, note?: string): Promise<GateExecution> {
  let projectDir: string
  try {
    projectDir = getActiveProjectDir()
  } catch {
    return fail('NO_PROJECT', '当前没有打开的项目，无法处理 0-final 后置动作')
  }

  // 版本一致性：一张门只授权一版内容
  const listing = await listBriefVersions(projectDir)
  const publishVersion = listing.latestVersion === null ? 1 : listing.latestVersion + 1
  const bound = gatePayloadVersion(gate)
  if (bound !== null && bound !== publishVersion) {
    return fail(
      'BRIEF_GATE_VERSION_MISMATCH',
      `门绑定 v${bound}，当前将发布 v${publishVersion}，版本不一致。请针对当前版本重新发门。`,
      true,
    )
  }

  // 2026-11-01 用户拍板：再版保留三选一与 impact.commit，系统不得抢先双写造成重复发版。
  if (publishVersion > 1) {
    return { ok: true, summary: `再版 v${publishVersion} 草案已确认；请由主控 Agent 完成三选一后调 impact.commit 发布` }
  }

  const draft = gateDraft(gate)
  if (!draft) {
    return fail(
      'GATE_DRAFT_MISSING',
      '该首版门是旧协议发出、未携带结构化草案，系统无法直接发布。请由主控 Agent 调 brief.publish（approve.by=gate）完成发布。',
    )
  }

  // 草案就绪 + 谱系校验（与 brief.publish 同一 evaluateDraft）
  const catalog = await loadStyleCatalog()
  const { missing, styleIssues } = evaluateDraft(draft, catalog)
  if (missing.length > 0 || styleIssues.length > 0) {
    const problems = [...missing.map(m => m.message), ...styleIssues.map(s => s.message)]
    return fail('BRIEF_NOT_READY', `草案未就绪：${problems.join('；')}。请修正后重新发门。`, true)
  }

  // harness 前置校验：blocker 拦截零写盘，门保持 approved（已授权内容的执行故障）
  const report = await runHarnessValidation({
    projectDir, gateId: BRIEF_GATE_ID, subject: draft, candidateVersion: publishVersion,
  })
  if (!report.passed) {
    if (!projectStillActive(projectDir)) return projectChanged()
    await writeHarnessSummary(gate, report)
    const blockers = report.findings.filter(f => f.severity === 'blocker')
    return fail(
      'HARNESS_VALIDATION_FAILED',
      `基础校验未通过（${blockers.length} 项）：${blockers.map(b => b.message).join('；')}`,
    )
  }

  if (!projectStillActive(projectDir)) return projectChanged()
  const written = await publishV1InQueue(projectDir, draft as ReadyBriefDraft, { by: 'gate', ...(note ? { note } : {}) })
  if (!projectStillActive(projectDir)) return projectChanged()
  await canvasStore.update({ nodes: [written.briefNode] })

  if (written.version === 1) {
    try {
      if (!projectStillActive(projectDir)) return projectChanged()
      // already-there 视为幂等成功；bad-transition / terminal 抛出后统一上报（产物已发布，不回滚）
      await advanceManifest('brief-published')
    } catch (e) {
      return fail(
        (e as { code?: string }).code ?? 'MANIFEST_BAD_TRANSITION',
        `立项单 v1 已发布，但 manifest 推进失败：${(e as Error).message}`,
      )
    }
  }

  if (!projectStillActive(projectDir)) return projectChanged()
  await clearHarnessSummary(gate)
  return { ok: true, summary: `已发布立项单 v${written.version}（${written.jsonName}）` }
}

/** 1-a~2-b：仅推进 manifest */
async function advanceForGate(event: ManifestEvent): Promise<GateExecution> {
  let projectDir: string
  try {
    projectDir = getActiveProjectDir()
  } catch {
    return fail('NO_PROJECT', '当前没有打开的项目，无法推进 manifest')
  }
  try {
    if (!projectStillActive(projectDir)) return projectChanged()
    const r = await advanceManifest(event)
    if (r.advanced) return { ok: true, summary: `已推进至 ${r.status}` }
    // already-there：回合重入的幂等保护，视为成功
    return { ok: true, summary: `已处于 ${r.status}（幂等，无需重复推进）` }
  } catch (e) {
    // bad-transition / terminal 由 advanceManifest 以 code 抛出
    const code = (e as { code?: string }).code ?? 'MANIFEST_BAD_TRANSITION'
    return fail(code, `manifest 推进失败：${(e as Error).message}。产物未受影响，请检查现场状态后由主控 Agent 续跑`)
  }
}

/**
 * 裁决后置动作入口。仅 approved 门调用；rejected 无后置。
 * 不抛出：一切失败以 GateExecution 返回，由 bridge 决定门态与推送。
 */
export async function applyGateDecision(gate: CanvasGate, note?: string): Promise<GateExecution> {
  try {
    if (gate.gateId === BRIEF_GATE_ID) return await publishFromGate(gate, note)
    const event = GATE_MANIFEST_EVENTS[gate.gateId]
    if (event) return await advanceForGate(event)
    return { ok: true, summary: '该门无系统后置动作' }
  } catch (e) {
    return fail('GATE_EXECUTION_FAILED', (e as Error).message || '后置动作执行失败')
  }
}
