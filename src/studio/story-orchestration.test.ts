// feature-020 C4 · 第 1 步编排契约测试（契约 §2~§6，需求 AC-1~AC-6/AC-8）
// 编排由 showrunner 经 prompt 驱动（仓库内无可执行编排代码），故以脚本化 fake
// showrunner + 纯工具调用记录，固定断言契约要求：
// - 大纲 / 小传的写作均经 task 委派 writer（showrunner 不自行撰写）；
// - 两门 gateId 恰为 1-a、1-b 且按序（1-a approved 前不发 1-b）；
// - rejected 后以同一 gateId 重开（不新增 / 跳 / 并门）；
// - 产物落「故事/」目录，节点 upsert 带 linksTo 派生跨步骤 auto 边；
// - 全程不触媒体（comfyui/asset）；缺 brief 不启动；
// - pending 门恢复：重挂同一 gateId，不重做已完成产物。
import { describe, expect, it, vi } from 'vitest'

type GateId = '1-a' | '1-b'

interface CallRecord {
  tool: string
  args: Record<string, unknown>
}

interface FakeTools {
  fileWrite: ReturnType<typeof vi.fn>
  fileRead: ReturnType<typeof vi.fn>
  gateRequest: ReturnType<typeof vi.fn>
  canvasUpdate: ReturnType<typeof vi.fn>
  canvasGet: ReturnType<typeof vi.fn>
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
    fileRead: track('shortdrama_file_read'),
    gateRequest: track('shortdrama_gate_request'),
    canvasUpdate: track('shortdrama_canvas_update'),
    canvasGet: track('shortdrama_canvas_get'),
    comfyui: track('shortdrama_comfyui_queue'),
    asset: track('shortdrama_asset_register'),
    task: track('task'),
    calls,
  }
}

/**
 * 脚本化 fake showrunner：严格复刻 showrunner.md「第 1 步故事剧本」。
 * decisions 按 gateId 顺序提供裁决；同一 gateId 的第 n 次请求取第 n 个裁决。
 * hasBrief=false 时模拟缺 brief：不启动第 1 步。
 */
function runStep1(
  t: FakeTools,
  decisions: Partial<Record<GateId, ('approved' | 'rejected')[]>>,
  hasBrief = true,
): void {
  t.canvasGet()
  if (!hasBrief) return // 缺 brief：明确告知，不臆造输入、不启动

  // 1-a：task 委派 writer 写大纲（writer 负责落盘 + upsert 节点）
  t.task({
    agent: 'writer',
    input: '立项/brief.json',
    output: '故事/故事大纲.json',
    mirror: '故事/故事大纲.md',
    nodeId: 'step-1-outline',
    schema: 'StoryOutline',
  })
  t.fileWrite({ path: '故事/故事大纲.json', format: 'json' })
  t.fileWrite({ path: '故事/故事大纲.md', format: 'md' })
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{
      id: 'step-1-outline', step: '1', kind: 'outline', status: 'active',
      linksTo: ['step-0-brief'],
    }],
  })

  askGate(t, '1-a', decisions['1-a'] ?? ['approved'])
  // approved 后大纲置 done
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{ id: 'step-1-outline', step: '1', kind: 'outline', status: 'done' }],
  })

  // 1-b：task 委派 writer 写小传
  t.task({
    agent: 'writer',
    input: ['立项/brief.json', '故事/故事大纲.json'],
    output: '故事/人物小传.json',
    mirror: '故事/人物小传.md',
    nodeId: 'step-1-profiles',
    schema: 'CharacterProfile[]',
  })
  t.fileWrite({ path: '故事/人物小传.json', format: 'json' })
  t.fileWrite({ path: '故事/人物小传.md', format: 'md' })
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{
      id: 'step-1-profiles', step: '1', kind: 'profiles', status: 'active',
      linksTo: ['step-1-outline'],
    }],
  })

  askGate(t, '1-b', decisions['1-b'] ?? ['approved'])
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{ id: 'step-1-profiles', step: '1', kind: 'profiles', status: 'done' }],
  })
}

function askGate(t: FakeTools, gate: GateId, seq: ('approved' | 'rejected')[]): void {
  for (let i = 0; ; i++) {
    t.gateRequest({ gateId: gate })
    if (seq[Math.min(i, seq.length - 1)] === 'approved') break
    // rejected：task 委派 writer 重做，同一 gateId 重开
    t.task({ agent: 'writer', redo: gate })
  }
}

/** 恢复续跑：pending 门重挂同一 gateId，不重做已 done 产物。 */
function runResume(t: FakeTools, pendingGate: GateId): void {
  t.canvasGet()
  t.gateRequest({ gateId: pendingGate })
}

describe('C4 · showrunner 第 1 步编排契约', () => {
  it('两门按序 1-a→1-b；大纲/小传均 task 委派 writer；产物落「故事/」', () => {
    const t = makeTools()
    runStep1(t, {})

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['1-a', '1-b'])

    const tasks = t.calls.filter(c => c.tool === 'task')
    expect(tasks.length).toBeGreaterThanOrEqual(2)
    expect(tasks.slice(0, 2).every(c => c.args.agent === 'writer')).toBe(true)

    const writes = t.calls.filter(c => c.tool === 'shortdrama_file_write').map(c => c.args.path)
    expect(writes).toContain('故事/故事大纲.json')
    expect(writes).toContain('故事/故事大纲.md')
    expect(writes).toContain('故事/人物小传.json')
    expect(writes).toContain('故事/人物小传.md')
    // 不写旧「剧本/」路径
    expect(writes.some(p => typeof p === 'string' && p.startsWith('剧本/'))).toBe(false)

    // 1-a 门必须在大纲写作之后、小传写作之前
    const gate1a = t.calls.findIndex(c => c.args.gateId === '1-a')
    const outlineTask = t.calls.findIndex(c => c.tool === 'task' && c.args.output === '故事/故事大纲.json')
    const profilesTask = t.calls.findIndex(c => c.tool === 'task' && c.args.output === '故事/人物小传.json')
    expect(outlineTask).toBeLessThan(gate1a)
    expect(gate1a).toBeLessThan(profilesTask)
  })

  it('1-a rejected：同一 gateId 重开，不新增 / 跳 / 并门；1-b 仍在 approved 之后', () => {
    const t = makeTools()
    runStep1(t, { '1-a': ['rejected', 'approved'] })

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['1-a', '1-a', '1-b'])
    expect([...new Set(gateSeq)].sort()).toEqual(['1-a', '1-b'])
  })

  it('节点 upsert 带 linksTo：outline→brief、profiles→outline 表达跨步骤 auto 边', () => {
    const t = makeTools()
    runStep1(t, {})

    const updates = t.calls.filter(c => c.tool === 'shortdrama_canvas_update')
    const allNodes = updates.flatMap(u => (u.args.nodes as { id: string; status?: string; linksTo?: string[] }[]))
    expect(allNodes.find(n => n.id === 'step-1-outline')?.linksTo).toEqual(['step-0-brief'])
    expect(allNodes.find(n => n.id === 'step-1-profiles')?.linksTo).toEqual(['step-1-outline'])

    // 两门 approved 后两节点均有 done 终态 upsert
    expect(allNodes.filter(n => n.id === 'step-1-outline' && !n.linksTo).map(n => n.status)).toContain('done')
    expect(allNodes.filter(n => n.id === 'step-1-profiles' && !n.linksTo).map(n => n.status)).toContain('done')
  })

  it('第 1 步不触媒体：无 comfyui / asset 调用', () => {
    const t = makeTools()
    runStep1(t, { '1-b': ['rejected', 'approved'] })
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_comfyui'))).toBe(false)
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_asset'))).toBe(false)
    expect(t.comfyui).not.toHaveBeenCalled()
    expect(t.asset).not.toHaveBeenCalled()
  })

  it('缺 brief 不启动：无 task / 门 / 落盘，仅 canvas_get 后告知', () => {
    const t = makeTools()
    runStep1(t, {}, false)
    expect(t.task).not.toHaveBeenCalled()
    expect(t.gateRequest).not.toHaveBeenCalled()
    expect(t.fileWrite).not.toHaveBeenCalled()
    expect(t.canvasGet).toHaveBeenCalledTimes(1)
  })

  it('恢复续跑：pending 门重挂同一 gateId，不重做产物', () => {
    const t = makeTools()
    runResume(t, '1-a')
    expect(
      t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId),
    ).toEqual(['1-a'])
    expect(t.calls.some(c => c.tool === 'shortdrama_file_write')).toBe(false)
    expect(t.task).not.toHaveBeenCalled()
  })
})
