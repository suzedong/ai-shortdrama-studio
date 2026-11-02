// feature-015 · 非阻塞确认门编排契约（契约 §3/§6）
// 仓库内编排由 showrunner prompt 驱动，这里以脚本化 fake showrunner + 工具调用记录锁定职责：
// - gate.request 只返回 pending；发门即回合收尾，不在同一轮等待裁决或继续调用工具。
// - 首版按钮路径由系统发布并推进；再版按钮路径仅确认，Agent 下一轮三选一后 impact.commit。
// - 1-a~2-b 由系统推进 manifest，Agent 只负责正文、done 节点与依赖边。
// - 口头拍板与历史无草案首版门兜底仍走 brief.publish，并自行推进首版 manifest。
import { describe, expect, it, vi } from 'vitest'

interface CallRecord {
  tool: string
  args: Record<string, unknown>
}

interface FakeTools {
  briefPlan: ReturnType<typeof vi.fn>
  briefPublish: ReturnType<typeof vi.fn>
  briefImpactAssess: ReturnType<typeof vi.fn>
  briefImpactCommit: ReturnType<typeof vi.fn>
  manifestGet: ReturnType<typeof vi.fn>
  manifestAdvance: ReturnType<typeof vi.fn>
  canvasGet: ReturnType<typeof vi.fn>
  fileWrite: ReturnType<typeof vi.fn>
  gateRequest: ReturnType<typeof vi.fn>
  canvasUpdate: ReturnType<typeof vi.fn>
  comfyui: ReturnType<typeof vi.fn>
  asset: ReturnType<typeof vi.fn>
  task: ReturnType<typeof vi.fn>
  calls: CallRecord[]
}

function makeTools(): FakeTools {
  const calls: CallRecord[] = []
  const track = (tool: string) => vi.fn((args: Record<string, unknown> = {}) => {
    calls.push({ tool, args })
    return { ok: true }
  })
  return {
    briefPlan: track('shortdrama_brief.plan'),
    briefPublish: track('shortdrama_brief.publish'),
    briefImpactAssess: track('shortdrama_brief.impact.assess'),
    briefImpactCommit: track('shortdrama_brief.impact.commit'),
    manifestGet: track('shortdrama_manifest.get'),
    manifestAdvance: track('shortdrama_manifest.advance'),
    canvasGet: track('shortdrama_canvas_get'),
    fileWrite: track('shortdrama_file_write'),
    gateRequest: track('shortdrama_gate_request'),
    canvasUpdate: track('shortdrama_canvas_update'),
    comfyui: track('shortdrama_comfyui_queue'),
    asset: track('shortdrama_asset_register'),
    task: track('task'),
    calls,
  }
}

const DRAFT = {
  kind: 'commercial',
  fiveElements: {
    genre: '校园恋爱', platforms: ['抖音'], episodeDuration: '90 秒',
    episodeCount: '8 集', tone: '清新治愈', aspectRatio: '竖屏 9:16',
  },
  premise: {
    leads: '安妮 18 / 林屿 19', time: '今夏', place: '海边小城',
    coreEvent: '自行车撞翻相机', seasonBoundary: '第一季只讲相识',
  },
  style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
}

type GateScene = 'pending' | 'approved' | 'rejected'

function readScene(t: FakeTools): void {
  t.canvasGet()
  t.manifestGet()
}

function requestBriefGate(t: FakeTools, version: number): void {
  if (version > 1) t.briefImpactAssess({ draft: DRAFT })
  t.gateRequest({
    gateId: '0-final',
    options: [`发布立项 v${version}`, '再改改'],
    payload: {
      version,
      pendingMarks: [],
      changesFromPrevious: [],
      ...(version > 1 ? { impactSummary: { counts: { high: 1, medium: 0 }, items: [{}] } } : {}),
      draft: DRAFT,
    },
  })
  // 工具只返回 pending；此处本轮立即收尾，不发布、不推进、不等待人工结果。
}

/** 第 0 步首/再版按钮路径；resume 模拟用户下一轮发「继续」后读到的门态。 */
function runStep0(
  t: FakeTools,
  opts: { ready: boolean; verbal?: string; version?: number; resume?: GateScene },
): void {
  t.briefPlan(DRAFT)
  if (!opts.ready) return
  const version = opts.version ?? 1

  if (opts.verbal !== undefined) {
    t.briefPublish({ ...DRAFT, approve: { by: 'verbal', verbal: { quote: opts.verbal } } })
    if (version === 1) t.manifestAdvance({ event: 'brief-published' })
    return
  }

  requestBriefGate(t, version)
  if (!opts.resume) return

  readScene(t)
  if (opts.resume === 'pending') return
  if (opts.resume === 'rejected') {
    // 读取 note 改草案，重新自检后以同一 gateId 重开；本轮同样在发门后结束。
    t.briefPlan(DRAFT)
    requestBriefGate(t, version)
    return
  }

  if (version === 1) {
    // 系统已发布 v1、upsert 节点并推进 manifest；Agent 只读现场汇报。
    return
  }

  // 再版 approved 后先向用户呈报取消 / 仅标记 / 重生成三选一；以下为选择后的唯一发布调用。
  t.briefImpactCommit({
    draft: DRAFT,
    approve: { by: 'gate' },
    decisions: [{ nodeId: 'step-1-outline', decision: 'regenerate' }],
  })
}

/** 历史无草案首版 approved 门的兼容兜底，不适用于再版。 */
function runLegacyApprovedV1(t: FakeTools): void {
  readScene(t)
  t.briefPublish({ ...DRAFT, approve: { by: 'gate' } })
  t.manifestAdvance({ event: 'brief-published' })
}

/** 第 1/2 步：门已通过由系统推进；Agent 仅确认/补齐 done 节点与依赖边。 */
function runStage12(
  t: FakeTools,
  opts: { gates: ('1-a' | '1-b' | '2-a' | '2-b')[]; rejectedAt?: ('1-a' | '1-b' | '2-a' | '2-b')[] },
): void {
  const rejectedAt = new Set(opts.rejectedAt ?? [])
  const completeGate = (
    gateId: '1-a' | '1-b' | '2-a' | '2-b',
    nodeId: string,
    edge?: { from: string; to: string; auto: true },
  ) => {
    t.gateRequest({ gateId })
    if (rejectedAt.has(gateId)) t.gateRequest({ gateId })
    readScene(t)
    t.canvasUpdate({ nodes: [{ id: nodeId, status: 'done' }], ...(edge ? { edges: [edge] } : {}) })
    // 不调 manifest.advance：对应事件已由系统在裁决时推进。
  }

  if (!opts.gates.includes('1-a')) return
  completeGate('1-a', 'step-1-outline')
  if (!opts.gates.includes('1-b')) return
  completeGate('1-b', 'step-1-profiles')
  if (!opts.gates.includes('2-a')) return
  completeGate('2-a', 'step-2-scenes', { from: 'step-1-profiles', to: 'step-2-scenes', auto: true })
  if (!opts.gates.includes('2-b')) return
  completeGate('2-b', 'step-2-dialogue', { from: 'step-2-scenes', to: 'step-2-dialogue', auto: true })
}

describe('feature-015 · showrunner 第 0 步非阻塞编排', () => {
  it('未就绪只追问，不发门、不发布、不推进', () => {
    const t = makeTools()
    runStep0(t, { ready: false })
    expect(t.gateRequest).not.toHaveBeenCalled()
    expect(t.briefPublish).not.toHaveBeenCalled()
    expect(t.manifestAdvance).not.toHaveBeenCalled()
  })

  it('首版按钮路径：发门即收尾，payload 携带完整 draft；Agent 不发布、不推进、不手写节点', () => {
    const t = makeTools()
    runStep0(t, { ready: true })

    expect(t.gateRequest).toHaveBeenCalledTimes(1)
    const args = t.gateRequest.mock.calls[0][0] as {
      gateId: string
      payload: { version: number; draft: Record<string, unknown> }
    }
    expect(args.gateId).toBe('0-final')
    expect(args.payload.version).toBe(1)
    expect(args.payload.draft).toEqual(DRAFT)
    expect(args.payload.draft).not.toHaveProperty('approve')
    expect(t.briefPublish).not.toHaveBeenCalled()
    expect(t.manifestAdvance).not.toHaveBeenCalled()
    expect(t.fileWrite).not.toHaveBeenCalled()
    expect(t.canvasUpdate).not.toHaveBeenCalled()
    expect(t.calls.at(-1)!.tool).toBe('shortdrama_gate_request')
  })

  it('首版下一轮读到 approved：只读现场，不重复 publish / advance', () => {
    const t = makeTools()
    runStep0(t, { ready: true, resume: 'approved' })
    expect(t.canvasGet).toHaveBeenCalledTimes(1)
    expect(t.manifestGet).toHaveBeenCalledTimes(1)
    expect(t.briefPublish).not.toHaveBeenCalled()
    expect(t.briefImpactCommit).not.toHaveBeenCalled()
    expect(t.manifestAdvance).not.toHaveBeenCalled()
  })

  it('再版按钮路径：发门后 approved 才进入三选一，由 impact.commit 唯一发布', () => {
    const t = makeTools()
    runStep0(t, { ready: true, version: 2, resume: 'approved' })
    expect(t.briefImpactAssess).toHaveBeenCalledTimes(1)
    expect(t.briefImpactCommit).toHaveBeenCalledTimes(1)
    expect(t.briefImpactCommit.mock.calls[0][0]).toMatchObject({
      draft: DRAFT,
      approve: { by: 'gate' },
      decisions: [{ nodeId: 'step-1-outline', decision: 'regenerate' }],
    })
    expect(t.briefPublish).not.toHaveBeenCalled()
    expect(t.manifestAdvance).not.toHaveBeenCalled()
    expect(t.calls.findIndex(c => c.tool === 'shortdrama_brief.impact.commit'))
      .toBeGreaterThan(t.calls.findIndex(c => c.tool === 'shortdrama_canvas_get'))
  })

  it('pending 恢复只读现场，不重发门、不重挂等待', () => {
    const t = makeTools()
    runStep0(t, { ready: true, resume: 'pending' })
    expect(t.gateRequest).toHaveBeenCalledTimes(1)
    expect(t.canvasGet).toHaveBeenCalledTimes(1)
    expect(t.briefPublish).not.toHaveBeenCalled()
    expect(t.briefImpactCommit).not.toHaveBeenCalled()
  })

  it('rejected 后改草案并以同一 0-final 重开；approved 前零发布零推进', () => {
    const t = makeTools()
    runStep0(t, { ready: true, resume: 'rejected' })
    expect(t.gateRequest.mock.calls.map(c => c[0].gateId)).toEqual(['0-final', '0-final'])
    expect(t.briefPlan).toHaveBeenCalledTimes(2)
    expect(t.briefPublish).not.toHaveBeenCalled()
    expect(t.briefImpactCommit).not.toHaveBeenCalled()
    expect(t.manifestAdvance).not.toHaveBeenCalled()
  })

  it('口头首版保留：不发门，brief.publish(by:verbal) 后自行推进 brief-published', () => {
    const t = makeTools()
    runStep0(t, { ready: true, verbal: '行，开始讲故事吧' })
    expect(t.gateRequest).not.toHaveBeenCalled()
    expect(t.briefPublish).toHaveBeenCalledTimes(1)
    expect(t.briefPublish.mock.calls[0][0].approve).toMatchObject({
      by: 'verbal', verbal: { quote: '行，开始讲故事吧' },
    })
    expect(t.manifestAdvance).toHaveBeenCalledWith({ event: 'brief-published' })
  })

  it('口头再版仍由 brief.publish 发布但不重复推进阶段事件', () => {
    const t = makeTools()
    runStep0(t, { ready: true, version: 2, verbal: '就按改后的来' })
    expect(t.briefPublish).toHaveBeenCalledTimes(1)
    expect(t.briefImpactCommit).not.toHaveBeenCalled()
    expect(t.manifestAdvance).not.toHaveBeenCalled()
  })

  it('历史无草案首版 approved 门：保留 brief.publish(by:gate) + 首版 advance 兜底', () => {
    const t = makeTools()
    runLegacyApprovedV1(t)
    expect(t.briefPublish).toHaveBeenCalledTimes(1)
    expect(t.briefPublish.mock.calls[0][0].approve.by).toBe('gate')
    expect(t.manifestAdvance).toHaveBeenCalledWith({ event: 'brief-published' })
  })

  it('第 0 步全程不触媒体', () => {
    const t = makeTools()
    runStep0(t, { ready: true, resume: 'rejected' })
    expect(t.comfyui).not.toHaveBeenCalled()
    expect(t.asset).not.toHaveBeenCalled()
    expect(t.task).not.toHaveBeenCalled()
  })
})

describe('feature-015 · STAGE 1-2 系统推进与 Agent 产物职责', () => {
  it('首版按钮 + 四门全链：Agent 零 manifest.advance，只发门并维护节点/边', () => {
    const t = makeTools()
    runStep0(t, { ready: true, resume: 'approved' })
    runStage12(t, { gates: ['1-a', '1-b', '2-a', '2-b'] })

    expect(t.manifestAdvance).not.toHaveBeenCalled()
    expect(t.gateRequest.mock.calls.map(c => c[0].gateId)).toEqual(['0-final', '1-a', '1-b', '2-a', '2-b'])
    expect(t.canvasUpdate).toHaveBeenCalledTimes(4)
    expect(t.canvasUpdate).toHaveBeenCalledWith(expect.objectContaining({
      edges: [{ from: 'step-1-profiles', to: 'step-2-scenes', auto: true }],
    }))
    expect(t.canvasUpdate).toHaveBeenCalledWith(expect.objectContaining({
      edges: [{ from: 'step-2-scenes', to: 'step-2-dialogue', auto: true }],
    }))
  })

  it('rejected 重开不产生 Agent 推进；四门 approved 后仍由系统各推一次', () => {
    const t = makeTools()
    runStage12(t, { gates: ['1-a', '1-b', '2-a', '2-b'], rejectedAt: ['1-a', '2-b'] })
    expect(t.manifestAdvance).not.toHaveBeenCalled()
    expect(t.gateRequest.mock.calls.map(c => c[0].gateId)).toEqual([
      '1-a', '1-a', '1-b', '2-a', '2-b', '2-b',
    ])
  })

  it('口头首版 + 四门：Agent 仅推进一次 brief-published，不重复推进四门事件', () => {
    const t = makeTools()
    runStep0(t, { ready: true, verbal: '开始' })
    runStage12(t, { gates: ['1-a', '1-b'] })
    expect(t.manifestAdvance.mock.calls.map(c => c[0].event)).toEqual(['brief-published'])
    expect(t.manifestAdvance).not.toHaveBeenCalledWith({ event: 'outline-approved' })
    expect(t.manifestAdvance).not.toHaveBeenCalledWith({ event: 'profiles-approved' })
    expect(t.manifestAdvance).not.toHaveBeenCalledWith({ event: 'storyboard-finalized' })
  })
})
