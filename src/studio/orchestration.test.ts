// feature-019 C6 · 第 0 步编排契约测试（契约 §2 / §3，需求 AC-1/AC-3/AC-4）
// 编排本身由 showrunner 经 prompt 驱动（仓库内无可执行编排代码），故以脚本化 fake
// showrunner + 纯工具调用记录，固定断言契约要求：
// - 四门 gateId 恰为 0-a/0-b/0-c/0-d 且按序；
// - rejected 后以同一 gateId 重试（不新增 / 跳 / 并门）；
// - 0-c 阶段不触发任何媒体（comfyui/asset）工具、全程无 task；
// - 0-d approved 后 brief.json/brief.md 落盘，brief 节点 done + auto 边；
// - pending 门恢复：recover 后重挂同一 gateId 并可继续裁决。
import { describe, expect, it, vi } from 'vitest'

type GateId = '0-a' | '0-b' | '0-c' | '0-d'

interface CallRecord {
  tool: string
  args: Record<string, unknown>
}

interface FakeTools {
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
    fileWrite: track('shortdrama_file_write'),
    gateRequest: track('shortdrama_gate_request'),
    canvasUpdate: track('shortdrama_canvas_update'),
    comfyui: track('shortdrama_comfyui_queue'),
    asset: track('shortdrama_asset_register'),
    task: track('task'),
    calls,
  }
}

/**
 * 脚本化 fake showrunner：严格复刻 showrunner.md「第 0 步立项剧本」的状态推进。
 * decisions 按 gateId 顺序提供裁决；同一 gateId 的第 n 次请求取第 n 个裁决。
 */
function runStep0(t: FakeTools, decisions: Partial<Record<GateId, ('approved' | 'rejected')[]>>): void {
  const stages: GateId[] = ['0-a', '0-b', '0-c', '0-d']
  const attempts: Record<GateId, number> = { '0-a': 0, '0-b': 0, '0-c': 0, '0-d': 0 }

  for (const gate of stages) {
    if (gate === '0-a') t.fileWrite({ path: '立项/diagnosis.json' })
    if (gate === '0-c') t.fileWrite({ path: '立项/视觉风格.json' })

    let decision: 'approved' | 'rejected' = 'approved'
    for (;;) {
      t.gateRequest({ gateId: gate })
      const seq = decisions[gate] ?? ['approved']
      decision = seq[Math.min(attempts[gate], seq.length - 1)]
      attempts[gate] += 1
      if (decision === 'approved') break
      // rejected：重做本门，同一 gateId 再次请求（不新增 / 跳 / 并门）
    }
  }

  // 0-d approved → 定稿落盘 + 挂节点
  t.fileWrite({ path: '立项/brief.json' })
  t.fileWrite({ path: '立项/brief.md' })
  t.canvasUpdate({
    mode: 'merge',
    nodes: [
      { id: 'step-0-diagnosis', step: '0', kind: 'diagnosis', status: 'done' },
      { id: 'step-0-visual-style', step: '0', kind: 'visual-style', status: 'done' },
      { id: 'step-0-brief', step: '0', kind: 'brief', status: 'done' },
    ],
    edges: [
      { id: 'e-diag-vs', from: 'step-0-diagnosis', to: 'step-0-visual-style', auto: true },
      { id: 'e-vs-brief', from: 'step-0-visual-style', to: 'step-0-brief', auto: true },
    ],
  })
}

/** 恢复续跑：存在 pending 门时，用同一 gateId 重新 gate.request（不重做产物）。 */
function runResume(t: FakeTools, pendingGate: GateId, decision: 'approved' | 'rejected'): void {
  t.gateRequest({ gateId: pendingGate })
  if (decision === 'approved') return
  t.gateRequest({ gateId: pendingGate })
}

describe('C6 · showrunner 第 0 步编排契约', () => {
  it('四门按序且 gateId 恰为 0-a~0-d；0-d 后 brief 落盘 + 节点 done + auto 边', () => {
    const t = makeTools()
    runStep0(t, {})

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['0-a', '0-b', '0-c', '0-d'])

    const writes = t.calls.filter(c => c.tool === 'shortdrama_file_write').map(c => c.args.path)
    expect(writes).toContain('立项/diagnosis.json')
    expect(writes).toContain('立项/视觉风格.json')
    expect(writes).toContain('立项/brief.json')
    expect(writes).toContain('立项/brief.md')
    // brief 必须在所有门之后才落盘
    const lastGate = t.calls.map(c => c.tool).lastIndexOf('shortdrama_gate_request')
    const briefIdx = t.calls.findIndex(c => c.args.path === '立项/brief.json')
    expect(briefIdx).toBeGreaterThan(lastGate)

    const update = t.calls.filter(c => c.tool === 'shortdrama_canvas_update')
    expect(update).toHaveLength(1)
    const args = update[0].args as {
      nodes: { id: string; status: string }[]
      edges: { auto: boolean }[]
    }
    expect(args.nodes.every(n => n.status === 'done')).toBe(true)
    expect(args.nodes.find(n => n.id === 'step-0-brief')).toBeTruthy()
    expect(args.edges.every(e => e.auto === true)).toBe(true)
  })

  it('rejected：以同一 gateId 重试，不新增 / 跳 / 并门', () => {
    const t = makeTools()
    runStep0(t, { '0-b': ['rejected', 'approved'] })

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['0-a', '0-b', '0-b', '0-c', '0-d'])
    const unique = new Set(gateSeq)
    expect([...unique].sort()).toEqual(['0-a', '0-b', '0-c', '0-d'])
  })

  it('第 0 步不触媒体：无 comfyui / asset / task 调用', () => {
    const t = makeTools()
    runStep0(t, { '0-c': ['rejected', 'approved'] })
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_comfyui'))).toBe(false)
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_asset'))).toBe(false)
    expect(t.calls.some(c => c.tool === 'task')).toBe(false)
    expect(t.comfyui).not.toHaveBeenCalled()
    expect(t.asset).not.toHaveBeenCalled()
    expect(t.task).not.toHaveBeenCalled()
  })

  it('恢复续跑：pending 门重挂同一 gateId，可继续裁决', () => {
    const t = makeTools()
    runResume(t, '0-c', 'approved')
    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['0-c'])
    // 恢复时不重做已挂起产物
    expect(t.calls.some(c => c.tool === 'shortdrama_file_write')).toBe(false)

    const t2 = makeTools()
    runResume(t2, '0-c', 'rejected')
    expect(
      t2.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId),
    ).toEqual(['0-c', '0-c'])
  })
})
