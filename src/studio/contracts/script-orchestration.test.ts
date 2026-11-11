// 第 2 步编排契约测试（契约 §2~§6，需求 AC-1~AC-6/AC-8）
// 编排由 showrunner 经 prompt 驱动（仓库内无可执行编排代码），故以脚本化 fake
// showrunner + 纯工具调用记录，固定断言契约要求：
// - 分场 / 台词的写作均经 task 委派 writer（showrunner 不自行撰写）；
// - 三门 gateId 恰为 2-a、2-b、2-c 且按序（前一门 approved 前不发后一门）；
// - rejected 后以同一 gateId 重开（不新增 / 跳 / 并门）；
// - 分场/台词落「剧本/」、分镜落「分镜/shotlist.*」（ep=1）；writer 只 upsert active、不带 linksTo；
// - showrunner 发门前 file_read 做结构校验，不合格打回 writer、不发门；
// - 门 approved 后 showrunner 才置节点 done 并用 patch.edges 建正确方向 auto 边；
// - 角色 id 引用小传、台词场号引用分场；全程不触媒体（comfyui/asset）；
// - 缺故事产物不启动；pending 门恢复不重挂、不重做已完成产物。
import { describe, expect, it, vi } from 'vitest'
import { deriveAutoEdges, edgeId } from '../../../electron/canvas/edges.js'

type GateId = '2-a' | '2-b' | '2-c'

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
  const track = (tool: string) => vi.fn((args: Record<string,unknown> = {}) => {
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

/** 合规分场（裸数组）与合规台词（裸数组） */
const validScenes = [
  {
    ep: 1, sceneNo: 1, slug: '海城大学·主校道', interiorExterior: '外', dayNight: '日',
    location: '主校道', characterIds: ['c-linxia', 'c-guyu', 'c-suxiao'],
    beats: ['当众递奶茶表白', '被拒'], emotion: '社死', estSeconds: 35, summary: '当众表白被拒',
  },
  {
    ep: 1, sceneNo: 2, slug: '海城大学·梧桐树下', interiorExterior: '外', dayNight: '日',
    location: '梧桐树下', characterIds: ['c-linxia', 'c-suxiao'],
    beats: ['嘴硬挽尊'], emotion: '倔强', estSeconds: 15, summary: '嘴硬挽尊',
  },
  {
    ep: 1, sceneNo: 3, slug: '宿舍楼下', interiorExterior: '外', dayNight: '夜',
    location: '宿舍楼下', characterIds: ['c-linxia', 'c-suxiao'],
    beats: ['立一个月赌约'], emotion: '不服', estSeconds: 25, summary: '立追人赌约',
  },
  {
    ep: 1, sceneNo: 4, slug: '林荫道', interiorExterior: '外', dayNight: '昏',
    location: '林荫道', characterIds: ['c-linxia', 'c-guyu'],
    beats: ['顾屿听见并点破'], emotion: '被戳穿', estSeconds: 20, summary: '被顾屿点破',
  },
]

const validDialogue = [
  {
    ep: 1, sceneNo: 1,
    lines: [
      { speakerId: 'c-linxia', kind: '对白', text: '顾屿，我喜欢你！', emotion: '豁出去' },
      { speakerId: 'c-guyu', kind: '对白', text: '别把时间浪费在赌约上。', emotion: '冷淡' },
      { speakerId: '', speakerName: '围观同学', kind: '对白', text: '她被拒绝了！', emotion: '起哄' },
    ],
  },
  { ep: 1, sceneNo: 2, lines: [{ speakerId: 'c-linxia', kind: '对白', text: '我才没那么容易认输。', emotion: '嘴硬' }] },
  { ep: 1, sceneNo: 3, lines: [{ speakerId: 'c-suxiao', kind: '对白', text: '一个月，赌不赌？', emotion: '怂恿' }] },
  { ep: 1, sceneNo: 4, lines: [{ speakerId: 'c-guyu', kind: '对白', text: '赌约我听到了。', emotion: '似笑非笑' }] },
]

const validShotlist = [
  {
    ep: 1, shotNo: 1, rowOrder: 1, shotSize: '近景', sceneNo: 1,
    characterIds: ['c-linxia'], action: '林夏当众递出奶茶', durationSec: 8, camera: '缓慢推近', refs: [],
    dialogue: { speakerId: 'c-linxia', text: '顾屿，我喜欢你！', emotion: '豁出去' },
  },
  {
    ep: 1, shotNo: 2, rowOrder: 2, shotSize: '中景', sceneNo: 2,
    characterIds: ['c-linxia'], action: '林夏转身嘴硬挽尊', durationSec: 4, camera: '固定', refs: [],
    dialogue: { speakerId: 'c-linxia', text: '我才没那么容易认输。', emotion: '嘴硬' },
  },
  {
    ep: 1, shotNo: 3, rowOrder: 3, shotSize: '全景', sceneNo: 3,
    characterIds: ['c-linxia', 'c-suxiao'], action: '两人在宿舍楼下立下赌约', durationSec: 6, camera: '横移', refs: [],
    dialogue: null,
  },
  {
    ep: 1, shotNo: 4, rowOrder: 4, shotSize: '特写', sceneNo: 4,
    characterIds: ['c-guyu'], action: '顾屿停步点破赌约', durationSec: 5, camera: '固定', refs: [],
    dialogue: { speakerId: 'c-guyu', text: '赌约我听到了。', emotion: '似笑非笑' },
  },
]

/** file_read 按 path 返回对应内容；调用方可注入违规结构 */
function stubReads(
  t: FakeTools,
  opts: { scenes?: unknown; dialogue?: unknown; storyboard?: unknown } = {},
): void {
  t.fileRead.mockImplementation((args: Record<string,unknown> = {}) => {
    t.calls.push({ tool: 'shortdrama_file_read', args })
    const p = args.path
    if (p === '剧本/分场.json') return { ok: true, data: opts.scenes ?? validScenes }
    if (p === '剧本/台词.json') return { ok: true, data: opts.dialogue ?? validDialogue }
    if (p === '分镜/shotlist.json') return { ok: true, data: opts.storyboard ?? validShotlist }
    return { ok: true, data: null }
  })
}

/**
 * 脚本化 fake showrunner：严格复刻 showrunner.md「第 2 步剧本分场剧本」。
 * decisions 按 gateId 顺序提供裁决；同一 gateId 的第 n 次请求取第 n 个裁决。
 * hasStory=false 时模拟缺故事产物：不启动第 2 步。
 */
function runStep2(
  t: FakeTools,
  decisions: Partial<Record<GateId, ('approved'|'rejected')[]>>,
  hasStory = true,
): void {
  t.canvasGet()
  if (!hasStory) return // 缺大纲 / 小传：明确告知，不臆造输入、不启动

  // 2-a：task 委派 writer 写第一集分场；writer 落盘 + upsert active（不带 linksTo）
  t.task({
    agent: 'writer',
    input: ['立项单.v1.json', '故事/故事大纲.json', '故事/人物小传.json'],
    output: '剧本/分场.json', mirror: '剧本/分场.md',
    nodeId: 'step-2-scenes', schema: 'SceneBreakdown', ep: 1,
  })
  t.fileWrite({ path: '剧本/分场.json', format: 'json' })
  t.fileWrite({ path: '剧本/分场.md', format: 'md' })
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{ id: 'step-2-scenes', step: '2', kind: 'scenes', status: 'active' }],
  })

  // showrunner 结构校验（file_read），不合格打回 writer 后重校验；合格才发门
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scenes = (t.fileRead({ path: '剧本/分场.json' }) as any).data
  while (!isValidScenes(scenes)) {
    t.task({ agent: 'writer', redo: '2-a', reason: 'structure' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scenes = (t.fileRead({ path: '剧本/分场.json' }) as any).data
  }

  askGate(t, '2-a', decisions['2-a'] ?? ['approved'])
  // 2-a approved：置 done + 直接 patch.edges（profiles→scenes）
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{
      id: 'step-2-scenes', step: '2', kind: 'scenes', title: '第一集分场',
      status: 'done', ref: { path: '剧本/分场.json', format: 'json' },
      parentReference: { briefVersion: 1, fields: [
        'premise.leads', 'premise.coreEvent', 'premise.seasonBoundary',
        'fiveElements.genre', 'fiveElements.tone', 'style.mainStyleId', 'style.catalogVersion',
        'fiveElements.episodeCount', 'fiveElements.episodeDuration',
      ] },
    }],
    edges: [{ from: 'step-1-profiles', to: 'step-2-scenes', auto: true }],
  })

  // 2-b：task 委派 writer 写第一集台词
  t.task({
    agent: 'writer',
    input: ['故事/人物小传.json', '剧本/分场.json'],
    output: '剧本/台词.json', mirror: '剧本/台词.md',
    nodeId: 'step-2-dialogue', schema: 'DialogueScript', ep: 1,
  })
  t.fileWrite({ path: '剧本/台词.json', format: 'json' })
  t.fileWrite({ path: '剧本/台词.md', format: 'md' })
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{ id: 'step-2-dialogue', step: '2', kind: 'dialogue', status: 'active' }],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dialogue = (t.fileRead({ path: '剧本/台词.json' }) as any).data
  while (!isValidDialogue(dialogue)) {
    t.task({ agent: 'writer', redo: '2-b', reason: 'structure' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dialogue = (t.fileRead({ path: '剧本/台词.json' }) as any).data
  }

  askGate(t, '2-b', decisions['2-b'] ?? ['approved'])
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{
      id: 'step-2-dialogue', step: '2', kind: 'dialogue', title: '第一集台词',
      status: 'done', ref: { path: '剧本/台词.json', format: 'json' },
      parentReference: { briefVersion: 1, fields: [
        'premise.leads', 'premise.coreEvent', 'premise.seasonBoundary',
        'fiveElements.genre', 'fiveElements.tone', 'style.mainStyleId', 'style.catalogVersion',
        'fiveElements.episodeCount', 'fiveElements.platforms',
      ] },
    }],
    edges: [{ from: 'step-2-scenes', to: 'step-2-dialogue', auto: true }],
  })

  // 2-c：仅在 2-b approved 后委派 writer 写分镜文字草案
  t.task({
    agent: 'writer',
    input: ['故事/人物小传.json', '剧本/分场.json', '剧本/台词.json'],
    output: '分镜/shotlist.json', mirror: '分镜/shotlist.md',
    nodeId: 'step-2-storyboard', schema: 'ShotList', ep: 1,
  })
  t.fileWrite({ path: '分镜/shotlist.json', format: 'json' })
  t.fileWrite({ path: '分镜/shotlist.md', format: 'md' })
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{ id: 'step-2-storyboard', step: '2', kind: 'storyboard', status: 'active' }],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let storyboard = (t.fileRead({ path: '分镜/shotlist.json' }) as any).data
  while (!isValidShotlist(storyboard)) {
    t.task({ agent: 'writer', redo: '2-c', reason: 'structure' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storyboard = (t.fileRead({ path: '分镜/shotlist.json' }) as any).data
  }

  askGate(t, '2-c', decisions['2-c'] ?? ['approved'])
  t.canvasUpdate({
    mode: 'merge',
    nodes: [{
      id: 'step-2-storyboard', step: '2', kind: 'storyboard', title: '第一集分镜文字稿',
      status: 'done', ref: { path: '分镜/shotlist.json', format: 'json' },
      parentReference: { briefVersion: 1, fields: [
        'premise.leads', 'premise.coreEvent', 'premise.seasonBoundary',
        'fiveElements.genre', 'fiveElements.tone', 'style.mainStyleId', 'style.catalogVersion',
        'fiveElements.episodeCount', 'fiveElements.episodeDuration', 'fiveElements.aspectRatio',
      ] },
    }],
    edges: [{ from: 'step-2-dialogue', to: 'step-2-storyboard', auto: true }],
  })
}

/** 复刻 showrunner.md「结构校验清单」分场部分（测试断言用，非生产代码） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidScenes(data: any): boolean {
  if (!Array.isArray(data) || data.length < 3) return false
  const sceneKeys = ['ep', 'sceneNo', 'slug', 'interiorExterior', 'dayNight', 'location',
    'characterIds', 'beats', 'emotion', 'estSeconds', 'summary']
  const nos: number[] = []
  for (const s of data) {
    if (Object.keys(s).sort().join(',') !== [...sceneKeys].sort().join(',')) return false
    if (s.ep !== 1) return false
    if (!['内', '外', '内外'].includes(s.interiorExterior)) return false
    if (!['日', '夜', '晨', '昏'].includes(s.dayNight)) return false
    if (!Number.isInteger(s.estSeconds) || s.estSeconds <= 0) return false
    if (!Array.isArray(s.beats) || s.beats.length === 0) return false
    if (!Array.isArray(s.characterIds)) return false
    nos.push(s.sceneNo)
  }
  return nos.every((n, i) => n === i + 1)
}

/** 复刻结构校验清单台词部分 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidDialogue(data: any): boolean {
  if (!Array.isArray(data)) return false
  const lineKeys = ['speakerId', 'kind', 'text', 'emotion']
  for (const sc of data) {
    const sceneKeys = Object.keys(sc).filter(k => k !== 'lines').sort()
    if (sceneKeys.join(',') !== ['ep', 'sceneNo'].sort().join(',')) return false
    if (!Array.isArray(sc.lines) || sc.lines.length === 0) return false
    for (const l of sc.lines) {
      const keys = Object.keys(l).filter(k => k !== 'speakerName' && k !== 'action').sort()
      if (keys.join(',') !== [...lineKeys].sort().join(',')) return false
      if (!['对白', '旁白', '独白'].includes(l.kind)) return false
      if (l.speakerId === '' && !l.speakerName) return false
    }
  }
  return true
}

/** 复刻结构校验清单分镜部分（文字草案也必须满足完整 Shot 形状） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidShotlist(data: any): boolean {
  if (!Array.isArray(data) || data.length === 0) return false
  const shotKeys = ['ep', 'shotNo', 'rowOrder', 'shotSize', 'sceneNo', 'characterIds',
    'action', 'dialogue', 'durationSec', 'camera', 'refs']
  const dialogueKeys = ['speakerId', 'text', 'emotion']
  const sceneNos = new Set<number>()
  for (let i = 0; i < data.length; i++) {
    const shot = data[i]
    if (Object.keys(shot).sort().join(',') !== [...shotKeys].sort().join(',')) return false
    if (shot.ep !== 1 || shot.shotNo !== i + 1 || shot.rowOrder !== i + 1) return false
    const scene = validScenes.find(s => s.sceneNo === shot.sceneNo)
    if (!scene) return false
    sceneNos.add(shot.sceneNo)
    if (!['特写', '近景', '中景', '全景', '远景'].includes(shot.shotSize)) return false
    if (!Number.isInteger(shot.durationSec) || shot.durationSec <= 0) return false
    if (typeof shot.camera !== 'string' || !shot.camera || typeof shot.action !== 'string' || !shot.action) return false
    if (!Array.isArray(shot.characterIds) || !shot.characterIds.every((id: string) => scene.characterIds.includes(id))) return false
    if (!Array.isArray(shot.refs) || shot.refs.length !== 0) return false
    if (shot.dialogue !== null) {
      if (typeof shot.dialogue !== 'object' || Array.isArray(shot.dialogue)) return false
      const keys = Object.keys(shot.dialogue).filter(k => k !== 'speakerName').sort()
      if (keys.join(',') !== [...dialogueKeys].sort().join(',')) return false
      const sourceLines = validDialogue.find(s => s.sceneNo === shot.sceneNo)?.lines ?? []
      if (!sourceLines.some(line => line.speakerId === shot.dialogue.speakerId
        && line.speakerName === shot.dialogue.speakerName
        && line.text === shot.dialogue.text && line.emotion === shot.dialogue.emotion)) return false
    }
  }
  return validScenes.every(scene => sceneNos.has(scene.sceneNo))
}

function askGate(t: FakeTools, gate: GateId, seq: ('approved'|'rejected')[]): void {
  const payload: Record<GateId, Record<string, unknown>> = {
    '2-a': { ref: '剧本/分场.json', sceneCount: 4, totalSeconds: 95 },
    '2-b': { ref: '剧本/台词.json', sceneCount: 4, lineCount: 6 },
    '2-c': { ref: '分镜/shotlist.json', shotCount: 4, sceneCount: 4, totalSeconds: 23 },
  }
  for (let i = 0; ; i++) {
    t.gateRequest({ gateId: gate, payload: payload[gate] })
    if (seq[Math.min(i, seq.length - 1)] === 'approved') break
    // rejected：task 委派 writer 重做，同一 gateId 重开
    t.task({ agent: 'writer', redo: gate })
  }
}

/** 恢复续跑：提示在既有 pending 门卡拍板，不重挂门、不重做产物。 */
function runResume(t: FakeTools, pendingGate: GateId): void {
  t.canvasGet()
  void pendingGate
}

describe('C4 · showrunner 第 2 步编排契约', () => {
  it('三门按序 2-a→2-b→2-c；三类写作均委派 writer；分镜仅在 2-b 后落盘', () => {
    const t = makeTools()
    stubReads(t)
    runStep2(t, {})

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['2-a', '2-b', '2-c'])

    const tasks = t.calls.filter(c => c.tool === 'task')
    expect(tasks).toHaveLength(3)
    expect(tasks.every(c => c.args.agent === 'writer')).toBe(true)

    const writes = t.calls.filter(c => c.tool === 'shortdrama_file_write').map(c => c.args.path)
    expect(writes).toEqual([
      '剧本/分场.json', '剧本/分场.md', '剧本/台词.json', '剧本/台词.md',
      '分镜/shotlist.json', '分镜/shotlist.md',
    ])

    const gate2a = t.calls.findIndex(c => c.args.gateId === '2-a')
    const gate2b = t.calls.findIndex(c => c.args.gateId === '2-b')
    const gate2c = t.calls.findIndex(c => c.args.gateId === '2-c')
    const scenesTask = t.calls.findIndex(c => c.tool === 'task' && c.args.output === '剧本/分场.json')
    const dialogueTask = t.calls.findIndex(c => c.tool === 'task' && c.args.output === '剧本/台词.json')
    const storyboardTask = t.calls.findIndex(c => c.tool === 'task' && c.args.output === '分镜/shotlist.json')
    const storyboardWrite = t.calls.findIndex(c => c.args.path === '分镜/shotlist.json')
    expect(scenesTask).toBeLessThan(gate2a)
    expect(gate2a).toBeLessThan(dialogueTask)
    expect(gate2b).toBeLessThan(storyboardTask)
    expect(storyboardTask).toBeLessThan(storyboardWrite)
    expect(storyboardWrite).toBeLessThan(gate2c)
    expect(t.calls.filter(c => c.args.gateId === '2-c')[0]?.args.payload).toEqual({
      ref: '分镜/shotlist.json', shotCount: 4, sceneCount: 4, totalSeconds: 23,
    })
    expect(t.calls.some(c => c.tool === 'shortdrama_manifest_advance')).toBe(false)
  })

  it('2-a rejected：同一 gateId 重开，不新增 / 跳 / 并门；2-b 仍在 approved 之后', () => {
    const t = makeTools()
    stubReads(t)
    runStep2(t, { '2-a': ['rejected', 'approved'] })

    const gateSeq = t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId)
    expect(gateSeq).toEqual(['2-a', '2-a', '2-b', '2-c'])
    expect([...new Set(gateSeq)].sort()).toEqual(['2-a', '2-b', '2-c'])
  })

  it('writer 只 upsert active、不带 linksTo；门 approved 后 showrunner 才置 done', () => {
    const t = makeTools()
    stubReads(t)
    runStep2(t, {})

    const updates = t.calls.filter(c => c.tool === 'shortdrama_canvas_update')
    const activeNodes = updates
      .filter(u => !u.args.edges) // writer 的 upsert 不带 edges
      .flatMap(u => u.args.nodes as { id: string; status: string; linksTo?: string[] }[])
    // writer 的每次 upsert：active 且无 linksTo
    expect(activeNodes.every(n => n.status === 'active')).toBe(true)
    expect(activeNodes.every(n => n.linksTo === undefined)).toBe(true)

    // done 只出现在带 edges 的 approved 收尾 update 中
    const closing = updates.filter(u => u.args.edges)
    const closingNodes = closing.flatMap(u => u.args.nodes as {
      id: string; status: string; parentReference?: { briefVersion: number; fields: string[] }
    }[])
    expect(closingNodes.map(n => n.id)).toEqual(['step-2-scenes', 'step-2-dialogue', 'step-2-storyboard'])
    expect(closingNodes.every(n => n.status === 'done')).toBe(true)
    expect(closingNodes.every(n => n.parentReference?.briefVersion === 1)).toBe(true)
    expect(closingNodes.find(n => n.id === 'step-2-storyboard')?.parentReference?.fields).toEqual([
      'premise.leads', 'premise.coreEvent', 'premise.seasonBoundary',
      'fiveElements.genre', 'fiveElements.tone', 'style.mainStyleId', 'style.catalogVersion',
      'fiveElements.episodeCount', 'fiveElements.episodeDuration', 'fiveElements.aspectRatio',
    ])
  })

  it('patch.edges 方向正确：profiles→scenes→dialogue→storyboard，auto:true', () => {
    const t = makeTools()
    stubReads(t)
    runStep2(t, {})

    const edgeArgs = t.calls
      .filter(c => c.tool === 'shortdrama_canvas_update')
      .flatMap(u => (u.args.edges as { from: string; to: string; auto: boolean }[] | undefined) ?? [])

    expect(edgeArgs).toEqual([
      { from: 'step-1-profiles', to: 'step-2-scenes', auto: true },
      { from: 'step-2-scenes', to: 'step-2-dialogue', auto: true },
      { from: 'step-2-dialogue', to: 'step-2-storyboard', auto: true },
    ])

    // 用 store 的 patch.edges 落盘语义核对确定性 id（与 edges.ts 同源）
    expect(edgeId('step-1-profiles', 'step-2-scenes')).toBe('e-step-1-profiles--step-2-scenes')
    expect(edgeId('step-2-scenes', 'step-2-dialogue')).toBe('e-step-2-scenes--step-2-dialogue')
    expect(edgeId('step-2-dialogue', 'step-2-storyboard')).toBe('e-step-2-dialogue--step-2-storyboard')
  })

  it('linksTo 若误带会产出反向边（防回归锚点）：deriveAutoEdges 以本节点为 from', () => {
    const edges = deriveAutoEdges([], [
      { id: 'step-2-scenes', step: '2', kind: 'scenes', status: 'active', title: 'x',
        updatedAt: '2026-10-07T00:00:00.000Z',
        linksTo: ['step-1-profiles'] },
    ])
    expect(edges).toEqual([
      { id: 'e-step-2-scenes--step-1-profiles', from: 'step-2-scenes', to: 'step-1-profiles', auto: true },
    ])
  })

  it('结构校验：分场包裹对象 / 字段名错误时打回 writer 重做，不发门', () => {
    const t = makeTools()
    // 首次读到违规包裹对象 + 自造字段（真机 C7 偏差），第二次读到合规裸数组
    let readCount = 0
    t.fileRead.mockImplementation((args: Record<string,unknown> = {}) => {
      t.calls.push({ tool: 'shortdrama_file_read', args })
      if (args.path === '剧本/分场.json') {
        readCount += 1
        return { ok: true, data: readCount === 1
          ? { ep: 1, title: 'x', totalSeconds: 95,
            scenes: [{ heading: 'x', time: '日', interior: false, durationSec: 10, goal: 'g' }] }
          : validScenes }
      }
      if (args.path === '剧本/台词.json') return { ok: true, data: validDialogue }
      if (args.path === '分镜/shotlist.json') return { ok: true, data: validShotlist }
      return { ok: true, data: null }
    })

    runStep2(t, {})

    // 因结构不合格产生的重做 task（redo 2-a, reason structure）
    expect(t.calls.some(c => c.tool === 'task' && c.args.redo === '2-a' && c.args.reason === 'structure')).toBe(true)
    // 分场第一次违规读取发生在 2-a 门请求之前
    const firstBadRead = t.calls.findIndex(c => c.tool === 'shortdrama_file_read' && c.args.path === '剧本/分场.json')
    const gate2a = t.calls.findIndex(c => c.args.gateId === '2-a')
    expect(firstBadRead).toBeLessThan(gate2a)
    // 门序列仍是每门一次（打回不发门）
    expect(t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId))
      .toEqual(['2-a', '2-b', '2-c'])
  })

  it('结构校验：台词用 type/note 自造字段时打回 writer，不发 2-b', () => {
    const t = makeTools()
    let readCount = 0
    t.fileRead.mockImplementation((args: Record<string,unknown> = {}) => {
      t.calls.push({ tool: 'shortdrama_file_read', args })
      if (args.path === '剧本/分场.json') return { ok: true, data: validScenes }
      if (args.path === '剧本/台词.json') {
        readCount += 1
        return { ok: true, data: readCount === 1
          ? { ep: 1, scenes: [{ sceneNo: 1, lines: [{ type: 'action', note: 'x' }] }] }
          : validDialogue }
      }
      if (args.path === '分镜/shotlist.json') return { ok: true, data: validShotlist }
      return { ok: true, data: null }
    })

    runStep2(t, {})
    expect(t.calls.some(c => c.tool === 'task' && c.args.redo === '2-b' && c.args.reason === 'structure')).toBe(true)
    const firstDialogueRead = t.calls.findIndex(c => c.tool === 'shortdrama_file_read' && c.args.path === '剧本/台词.json')
    const gate2b = t.calls.findIndex(c => c.args.gateId === '2-b')
    expect(firstDialogueRead).toBeLessThan(gate2b)
  })

  it('委派交接物带 ep=1；2-c input 同时含小传、分场与台词事实源', () => {
    const t = makeTools()
    stubReads(t)
    runStep2(t, {})

    const tasks = t.calls.filter(c => c.tool === 'task')
    const scenesTask = tasks.find(c => c.args.output === '剧本/分场.json')
    const dialogueTask = tasks.find(c => c.args.output === '剧本/台词.json')
    const storyboardTask = tasks.find(c => c.args.output === '分镜/shotlist.json')
    expect(scenesTask?.args.ep).toBe(1)
    expect(dialogueTask?.args.ep).toBe(1)
    expect(storyboardTask?.args.ep).toBe(1)
    expect(scenesTask?.args.input).toContain('故事/人物小传.json')
    expect(dialogueTask?.args.input).toContain('剧本/分场.json')
    expect(storyboardTask?.args.input).toEqual(['故事/人物小传.json', '剧本/分场.json', '剧本/台词.json'])
    expect(storyboardTask?.args.schema).toBe('ShotList')
  })

  it('2-c rejected：委派 writer 重做并以同一 gateId 重开，不新增门', () => {
    const t = makeTools()
    stubReads(t)
    runStep2(t, { '2-c': ['rejected', 'approved'] })
    expect(t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId))
      .toEqual(['2-a', '2-b', '2-c', '2-c'])
    expect(t.calls.some(c => c.tool === 'task' && c.args.redo === '2-c')).toBe(true)
  })

  it('结构校验：分镜 refs/场号覆盖/dialogue 血缘违规时打回 writer，不发 2-c', () => {
    const t = makeTools()
    let readCount = 0
    t.fileRead.mockImplementation((args: Record<string,unknown> = {}) => {
      t.calls.push({ tool: 'shortdrama_file_read', args })
      if (args.path === '剧本/分场.json') return { ok: true, data: validScenes }
      if (args.path === '剧本/台词.json') return { ok: true, data: validDialogue }
      if (args.path === '分镜/shotlist.json') {
        readCount += 1
        return { ok: true, data: readCount === 1 ? [{
          ...validShotlist[0], refs: ['asset-1'],
          dialogue: { speakerId: 'c-guyu', text: '臆造台词', emotion: '冷漠' },
        }] : validShotlist }
      }
      return { ok: true, data: null }
    })

    runStep2(t, {})
    expect(t.calls.some(c => c.tool === 'task' && c.args.redo === '2-c' && c.args.reason === 'structure')).toBe(true)
    const firstStoryboardRead = t.calls.findIndex(c => c.tool === 'shortdrama_file_read' && c.args.path === '分镜/shotlist.json')
    const gate2c = t.calls.findIndex(c => c.args.gateId === '2-c')
    expect(firstStoryboardRead).toBeLessThan(gate2c)
    expect(t.calls.filter(c => c.tool === 'shortdrama_gate_request').map(c => c.args.gateId))
      .toEqual(['2-a', '2-b', '2-c'])
  })

  it('第 2 步不触媒体：无 comfyui / asset 调用', () => {
    const t = makeTools()
    stubReads(t)
    runStep2(t, { '2-b': ['rejected', 'approved'] })
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_comfyui'))).toBe(false)
    expect(t.calls.some(c => c.tool.startsWith('shortdrama_asset'))).toBe(false)
    expect(t.comfyui).not.toHaveBeenCalled()
    expect(t.asset).not.toHaveBeenCalled()
  })

  it('缺故事产物不启动：无 task / 门 / 落盘，仅 canvas_get 后告知', () => {
    const t = makeTools()
    runStep2(t, {}, false)
    expect(t.task).not.toHaveBeenCalled()
    expect(t.gateRequest).not.toHaveBeenCalled()
    expect(t.fileWrite).not.toHaveBeenCalled()
    expect(t.canvasGet).toHaveBeenCalledTimes(1)
  })

  it.each(['2-a', '2-b', '2-c'] as const)('恢复续跑：%s pending 门只提示拍板，不重挂门、不重做产物', pendingGate => {
    const t = makeTools()
    runResume(t, pendingGate)
    expect(t.gateRequest).not.toHaveBeenCalled()
    expect(t.fileWrite).not.toHaveBeenCalled()
    expect(t.task).not.toHaveBeenCalled()
    expect(t.canvasUpdate).not.toHaveBeenCalled()
    expect(t.canvasGet).toHaveBeenCalledTimes(1)
  })
})
