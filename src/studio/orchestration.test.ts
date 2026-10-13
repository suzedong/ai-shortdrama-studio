// feature-001 · STAGE 0 新立项模型编排契约测试（设计书 §2.6 / 契约 §7，需求 AC-1/AC-3/AC-4/AC-7）
// 编排本身由 showrunner 经 prompt 驱动（仓库内无可执行编排代码），故以脚本化 fake
// showrunner + 纯工具调用记录，固定断言契约要求：
// - 入口反问 / 选题诊断 / 故事前提阶段不建任何门（旧 0-a/0-b/0-c/0-d 四门作废）；
// - brief.plan 返回 ready:false 时继续追问，绝不发门；
// - ready:true 时只发唯一定案门 gateId='0-final'；
// - approved → brief.publish（by:'gate'），而非 file.write 立项单；
// - 口头拍板 → brief.publish（by:'verbal' + verbal.quote），等价、可不发门；
// - publish 由工具 upsert step-0-brief 节点（done + meta.version），Agent 不手拼节点、不连边；
// - 第 0 步全程不触媒体（comfyui/asset/task）；
// - pending 门恢复：recover 后重挂同一 gateId 并可继续裁决。
import { describe, expect, it, vi } from 'vitest'

interface CallRecord {
  tool: string
  args: Record<string, unknown>
}

interface FakeTools {
  briefPlan: ReturnType<typeof vi.fn>
  briefPublish: ReturnType<typeof vi.fn>
  briefList: ReturnType<typeof vi.fn>
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
    briefList: track('shortdrama_brief.list'),
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
    episodeCount: '8 集', tone: '清新治愈', aspectRatio: '9:16',
  },
  premise: {
    leads: '安妮 18 / 林屿 19', time: '今夏', place: '海边小城',
    coreEvent: '自行车撞翻相机', seasonBoundary: '第一季只讲相识',
  },
  style: { mainStyleId: 'A7', catalogVersion: 'v1.46' },
}

/**
 * 脚本化 fake showrunner：严格复刻 showrunner.md「第 0 步立项剧本」。
 * ①入口反问 → ②选题诊断/六要素草案（纯对话态）→ ③故事前提收敛 → brief.plan 自检
 * → ready 则发唯一 0-final 门 → approved/rejected 后 brief.publish。
 * decisions 提供 0-final 每次请求的裁决序列。
 */
function runStep0(
  t: FakeTools,
  opts: { ready: boolean; decisions?: ('approved' | 'rejected')[]; verbal?: string },
): void {
  // brief.plan 自检：未就绪 → 追问，绝不发门（本脚本直接结束推进）
  t.briefPlan(DRAFT)
  if (!opts.ready) return

  if (opts.verbal !== undefined) {
    // 口头拍板：不发门，直接 publish 并携带用户原话
    t.briefPublish({ ...DRAFT, approve: { by: 'verbal', verbal: { quote: opts.verbal } } })
    return
  }

  const decisions = opts.decisions ?? ['approved']
  let attempt = 0
  let decision: 'approved' | 'rejected' = 'rejected'
  for (;;) {
    t.gateRequest({
      gateId: '0-final',
      options: ['发布立项 v1', '再改改'],
      payload: { version: 1, pendingMarks: [], changesFromPrevious: [] },
    })
    decision = decisions[Math.min(attempt, decisions.length - 1)]
    attempt += 1
    if (decision === 'approved') break
    // rejected：改完以同一 gateId 重开，不新增 / 跳 / 并门
  }

  t.briefPublish({ ...DRAFT, approve: { by: 'gate' } })
}

/** 恢复续跑：存在 pending 0-final 门时，用同一 gateId 重新 gate.request（不重做产物）。 */
function runResume(t: FakeTools, decision: 'approved' | 'rejected'): void {
  t.gateRequest({ gateId: '0-final' })
  if (decision === 'rejected') t.gateRequest({ gateId: '0-final' })
  if (decision === 'approved') t.briefPublish({ ...DRAFT, approve: { by: 'gate' } })
}

describe('feature-001 · showrunner 第 0 步编排契约（单定案门模型）', () => {
  it('反问 / 诊断 / 前提阶段不建门：未就绪只追问，无任何 gate.request', () => {
    const t = makeTools()
    runStep0(t, { ready: false })

    expect(t.calls.filter(c => c.tool === 'shortdrama_gate_request')).toHaveLength(0)
    expect(t.briefPlan).toHaveBeenCalledTimes(1)
    expect(t.briefPublish).not.toHaveBeenCalled()
  })

  it('就绪 → 唯一 0-final 门 → approved → brief.publish(by:gate)，不 file.write 立项单、节点由工具 upsert', () => {
    const t = makeTools()
    runStep0(t, { ready: true })

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['0-final'])

    expect(t.briefPublish).toHaveBeenCalledTimes(1)
    const pubArgs = t.briefPublish.mock.calls[0][0] as { approve: { by: string } }
    expect(pubArgs.approve.by).toBe('gate')

    // 不再手写立项单文件，也不手拼 canvas 节点（publish 工具内部完成 upsert）
    const writes = t.calls.filter(c => c.tool === 'shortdrama_file_write').map(c => c.args.path)
    expect(writes.some(p => typeof p === 'string' && p.includes('立项单'))).toBe(false)
    expect(t.calls.some(c => c.tool === 'shortdrama_canvas_update')).toBe(false)

    // 门必须先于 publish
    const gateIdx = t.calls.findIndex(c => c.tool === 'shortdrama_gate_request')
    const pubIdx = t.calls.findIndex(c => c.tool === 'shortdrama_brief.publish')
    expect(pubIdx).toBeGreaterThan(gateIdx)
  })

  it('口头拍板等价：不发门，直接 brief.publish(by:verbal + verbal.quote)', () => {
    const t = makeTools()
    runStep0(t, { ready: true, verbal: '行，开始讲故事吧' })

    expect(t.calls.filter(c => c.tool === 'shortdrama_gate_request')).toHaveLength(0)
    expect(t.briefPublish).toHaveBeenCalledTimes(1)
    const pubArgs = t.briefPublish.mock.calls[0][0] as {
      approve: { by: string; verbal?: { quote: string } }
    }
    expect(pubArgs.approve).toMatchObject({ by: 'verbal', verbal: { quote: '行，开始讲故事吧' } })
  })

  it('rejected：以同一 gateId 0-final 重开，不新增 / 跳 / 并门；approved 后才 publish', () => {
    const t = makeTools()
    runStep0(t, { ready: true, decisions: ['rejected', 'rejected', 'approved'] })

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['0-final', '0-final', '0-final'])
    expect(new Set(gateSeq)).toEqual(new Set(['0-final']))
    expect(t.briefPublish).toHaveBeenCalledTimes(1)
  })

  it('第 0 步不触媒体：无 comfyui / asset / task 调用', () => {
    const t = makeTools()
    runStep0(t, { ready: true, decisions: ['rejected', 'approved'] })
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_comfyui'))).toBe(false)
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_asset'))).toBe(false)
    expect(t.calls.some(c => c.tool === 'task')).toBe(false)
    expect(t.comfyui).not.toHaveBeenCalled()
    expect(t.asset).not.toHaveBeenCalled()
    expect(t.task).not.toHaveBeenCalled()
  })

  it('恢复续跑：pending 0-final 重挂同一 gateId，approved 后 publish', () => {
    const t = makeTools()
    runResume(t, 'approved')
    expect(
      t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId),
    ).toEqual(['0-final'])
    expect(t.briefPublish).toHaveBeenCalledTimes(1)
    // 恢复时不重做已挂起产物
    expect(t.calls.some(c => c.tool === 'shortdrama_file_write')).toBe(false)

    const t2 = makeTools()
    runResume(t2, 'rejected')
    expect(
      t2.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId),
    ).toEqual(['0-final', '0-final'])
    expect(t2.briefPublish).not.toHaveBeenCalled()
  })
})
