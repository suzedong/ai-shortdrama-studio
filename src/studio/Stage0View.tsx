// feature-025 · STAGE 0 立项视图（原型方案 A · view-stage0）
// 静态版：4 步流程导航 + 入口 + 3 节点链（诊断 / 前提 / 定案门）+ 演示控制条
// 风格选型/辅助开关仅展示，不接业务
import { useState } from 'react'

interface Props {
  projectTitle: string
  briefVer: string
  onBackToDag: () => void
}

const BRIEF_KV: { k: string; v: string }[] = [
  { k: '题材',    v: '校园/恋爱 · 夏日' },
  { k: '平台',    v: '抖音 · 快手 · 红果' },
  { k: '时长',    v: '约 90 秒' },
  { k: '集数',    v: '第一季 8 集（先做 E01）' },
  { k: '画幅',    v: '竖屏 9:16' },
  { k: '风格基调', v: '日系动画写实 · 京阿尼柔光' },
]

const PICKED_STYLE = {
  id: 'C1',
  name: '日式动漫（赛璐璐·新海诚·吉卜力）',
  meta: 'C1 @ v1.46',
  status: '主·已验证' as const,
  feasibility: '高' as const,
  family: 'C 动画插画系',
  anchor: 'anime, cel shading, Makoto Shinkai style / Ghibli',
}

const GATE_DIFF = '集数 8→8（v3 锁定）、premise 第 1 句修订、preflight 锁定 4/5、视觉风格确认 C1'

export default function Stage0View({ projectTitle, briefVer, onBackToDag }: Props) {
  // 节点状态（演示用，可点 demo 按钮推进）
  const [stepIdx, setStepIdx] = useState(2) // 默认 0=入口, 1=诊断, 2=前提, 3=定案门
  const [gateOpen, setGateOpen] = useState(false)
  const cnodeState = (i: number): 'done' | 'active' | 'idle' => {
    if (i < stepIdx) return 'done'
    if (i === stepIdx) return 'active'
    return 'idle'
  }
  const fstepState = (i: number): 'done' | 'active' | 'idle' => {
    if (i < stepIdx) return 'done'
    if (i === stepIdx) return 'active'
    return 'idle'
  }
  const cnodeLabel = (i: number) => i < stepIdx ? '已完成' : i === stepIdx ? '进行中' : '待启动'
  const progress = Math.min(100, Math.max(0, (stepIdx / 3) * 100))

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FAFBFE]" data-view="stage0">
      {/* 头部 */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-[38px] items-center gap-2.5 border-b border-line bg-white/85 px-[18px] backdrop-blur">
        <span className="text-[10.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">立项视图</span>
        <span className="text-[12px] font-extrabold text-ink">{projectTitle}</span>
        <span className="rounded-full bg-[#E7F8F0] px-2 py-px text-[9.5px] font-bold text-[#1E9E66]" data-s0-ver>立项单 {briefVer}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setStepIdx(0)}
          className="rounded-md border border-line bg-white px-2.5 py-1 text-[10.5px] text-[#7A8098] hover:bg-[#F1F2F8]"
        >↺ 重置流程</button>
        <button
          type="button"
          onClick={onBackToDag}
          className="rounded-md border border-line bg-white px-2.5 py-1 text-[10.5px] text-[#7A8098] hover:bg-[#F1F2F8]"
          data-s0-back
        >← 返回 DAG</button>
      </div>
      {/* 进度条 */}
      <div className="absolute inset-x-[26px] top-[44px] z-10 h-[3px] overflow-hidden rounded-full bg-[#ECEEF5]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#8FA8F5] to-violet transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* 主体 */}
      <div className="absolute inset-0 top-[54px] overflow-y-auto px-[26px] py-[22px]">
        <div className="mx-auto flex max-w-[920px] flex-col gap-[18px]">

          {/* 4 步流程导航 */}
          <div className="flex gap-[7px]" data-s0-fnav>
            {[
              { i: 0, t: '入口 · 反问', icon: '＋' },
              { i: 1, t: '① 选题诊断', icon: '1' },
              { i: 2, t: '② 故事前提', icon: '2' },
              { i: 3, t: '立项定案门', icon: '✓' },
            ].map(s => {
              const st = fstepState(s.i)
              return (
                <div
                  key={s.i}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-[9px] border px-2.5 py-2 transition ${
                    st === 'active' ? 'border-[#D9D3FB] bg-violet-soft'
                      : st === 'done' ? 'border-[#BFE6D2] bg-[#E7F8F0]'
                      : 'border-line bg-[#F8F9FD]'
                  }`}
                >
                  <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] text-[10px] font-extrabold transition ${
                    st === 'active' ? 'bg-violet text-white shadow-[0_4px_10px_rgba(108,92,231,0.3)]'
                      : st === 'done' ? 'bg-ok text-white'
                      : 'bg-[#F1F2F8] text-[#AEB4C8]'
                  }`}>{s.icon}</span>
                  <span className={`truncate text-[11px] font-bold ${st === 'active' ? 'text-[#5A4FD8]' : st === 'done' ? 'text-[#1E9E66]' : 'text-[#A6ABC0]'}`}>{s.t}</span>
                </div>
              )
            })}
          </div>

          {/* 入口 · 用户原话 */}
          <div className="flex items-center gap-3 rounded-[13px] border border-[#DED9FB] bg-gradient-to-br from-[#F8F6FF] to-[#F0EEFF] p-[14px] shadow-[0_8px_22px_rgba(108,92,231,0.08)]">
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#B8AFFF] to-violet text-white shadow-[0_5px_12px_rgba(108,92,231,0.3)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-3.5 w-3.5">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <span className="rounded bg-violet-soft px-1.5 py-px text-[9.5px] font-extrabold tracking-[0.3px] text-[#5A4FD8]">入口动作 · 用户原话</span>
              <div className="mt-1.5 text-[12.5px] font-bold leading-[1.5] text-ink">「校园恋爱短剧，大一新生安妮在海边小城的夏天」</div>
              <div className="mt-1 flex items-center gap-1 text-[9.5px] text-muted">
                <span>⏱</span>已提取事实：时间=今年夏天 · 地点=海边小城 · 人物=安妮(18) · 核心事件=海边相识
              </div>
            </div>
          </div>

          {/* 节点链 1×3 */}
          <div className="relative">
            {/* 中线（虚线） */}
            <div className="pointer-events-none absolute left-[25%] right-[25%] top-1/2 h-[1.5px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#D9D3FB_0_6px,transparent_6px_12px)] opacity-50" />
            <div className="relative z-[1] grid grid-cols-3 gap-[14px]">

              {/* ① 选题诊断 */}
              <div className={`flex flex-col overflow-hidden rounded-[12px] border bg-white transition ${
                cnodeState(0) === 'active' ? 'border-[#D9D3FB] opacity-100 shadow-[0_10px_26px_rgba(108,92,231,0.12)] -translate-y-px'
                  : cnodeState(0) === 'done' ? 'border-[#BFE6D2] opacity-100 bg-gradient-to-b from-[#FBFFFE] to-white'
                  : 'border-line opacity-55'
              }`}>
                <div className="flex items-center gap-2 border-b border-[#F2F3F8] px-3 py-2.5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10.5px] font-extrabold ${
                    cnodeState(0) === 'done' ? 'bg-[#E7F8F0] text-ok' : 'bg-violet-soft text-violet'
                  }`}>1</span>
                  <span className="text-[12px] font-extrabold text-ink">选题诊断</span>
                  <span className={`ml-auto rounded-full px-2 py-px text-[8.5px] font-bold ${
                    cnodeState(0) === 'active' ? 'bg-violet-soft text-[#5A4FD8]' : cnodeState(0) === 'done' ? 'bg-[#E7F8F0] text-[#1E9E66]' : 'bg-[#F2F3F9] text-[#A6ABC0]'
                  }`}>{cnodeLabel(0)}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-3 py-2.5 text-[10.5px] leading-[1.6] text-[#6A708A]">
                  <div className={cnodeState(0) === 'idle' ? 'opacity-70' : ''}>
                    <div className="font-extrabold text-[#4A4F68]">📊 同赛道对标案例</div>
                    <ul className="mt-1 space-y-0.5">
                      <li className="relative pl-2.5 before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-[#C9C1F5]">校园恋爱短剧 · 红果平台主推，2026 漫剧百强榜占 38%</li>
                      <li className="relative pl-2.5 before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-[#C9C1F5]">参考其「强情绪 + 海边夏天」结构</li>
                    </ul>
                    <div className="mt-1.5 font-extrabold text-[#4A4F68]">⚠️ 合规 / 使用边界</div>
                    <ul className="mt-1 space-y-0.5">
                      <li className="relative pl-2.5 before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-[#C9C1F5]">备案分级 · AI 融像/融声授权 · 平台审核</li>
                    </ul>
                  </div>
                  {/* 六要素微表 */}
                  <div className="mt-1 rounded-md border border-line">
                    {BRIEF_KV.map((kv, i) => (
                      <div key={i} className="flex items-center border-b border-[#F6F7FB] px-2.5 py-1 text-[10.5px] last:border-b-0">
                        <span className="w-[52px] shrink-0 text-[10px] font-semibold text-[#9AA0B5]">{kv.k}</span>
                        <span className="font-bold text-ink">{kv.v}</span>
                      </div>
                    ))}
                  </div>
                  {/* 风格选型 */}
                  <div className="mt-1 text-[10px] text-[#7A8098]">🎨 Agent 按题材从《视觉风格谱系》匹配（不自创画风），可改：</div>
                  <div className="flex items-center gap-2 rounded-md border border-violet bg-violet-soft p-2" data-s0-style>
                    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#B8AFFF] to-violet font-extrabold text-white" style={{ fontSize: 10 }}>C1</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-extrabold text-ink">{PICKED_STYLE.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#A6ABC0]">
                        <span>{PICKED_STYLE.meta} · {PICKED_STYLE.family}</span>
                        <span className="rounded bg-[#E7F8F0] px-1.5 py-px text-[8.5px] font-extrabold text-[#1E9E66]">{PICKED_STYLE.status}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] text-[#B8BDCE]">ⓘ 预览</span>
                  </div>
                  {/* 辅助开关 */}
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-muted">
                    <span className="relative h-4 w-7 shrink-0 rounded-full bg-[#D7DAE6]">
                      <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow" />
                    </span>
                    <span>挂 1 个辅助气氛（可选 · 候选域封闭 = B/D）</span>
                  </div>
                  {/* 结论 */}
                  <div className="mt-1 flex items-center gap-1.5 rounded-md bg-[#E7F8F0] px-2 py-1.5 text-[10px] font-extrabold text-[#1E9E66]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                      <path d="M5 12.7l4.6 4.6L19 7.3" />
                    </svg>
                    结论：可做 · 具体要改什么直接在对话里说
                  </div>
                </div>
              </div>

              {/* ② 故事前提 */}
              <div className={`flex flex-col overflow-hidden rounded-[12px] border bg-white transition ${
                cnodeState(1) === 'active' ? 'border-[#D9D3FB] opacity-100 shadow-[0_10px_26px_rgba(108,92,231,0.12)] -translate-y-px'
                  : cnodeState(1) === 'done' ? 'border-[#BFE6D2] opacity-100 bg-gradient-to-b from-[#FBFFFE] to-white'
                  : 'border-line opacity-55'
              }`}>
                <div className="flex items-center gap-2 border-b border-[#F2F3F8] px-3 py-2.5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10.5px] font-extrabold ${
                    cnodeState(1) === 'done' ? 'bg-[#E7F8F0] text-ok' : 'bg-violet-soft text-violet'
                  }`}>2</span>
                  <span className="text-[12px] font-extrabold text-ink">故事前提</span>
                  <span className={`ml-auto rounded-full px-2 py-px text-[8.5px] font-bold ${
                    cnodeState(1) === 'active' ? 'bg-violet-soft text-[#5A4FD8]' : cnodeState(1) === 'done' ? 'bg-[#E7F8F0] text-[#1E9E66]' : 'bg-[#F2F3F9] text-[#A6ABC0]'
                  }`}>{cnodeLabel(1)}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-3 py-2.5 text-[10.5px] leading-[1.6] text-[#6A708A]">
                  <div className="flex flex-col gap-1.5">
                    {/* AI 先编（待确认） */}
                    <div className="flex gap-1.5 rounded-md border border-[#F6E6C4] bg-[#FFF8EC] px-2 py-1.5 text-[10px] leading-[1.5]">
                      <span className="shrink-0 pt-px text-[9.5px] font-extrabold text-[#C0841D]">AI 先编</span>
                      <span>大一新生安妮今夏回到海边小城外婆家，与摄影社男生林屿在灯塔下因自行车撞翻相识——<b className="font-bold text-ink">用来引出真人真事，照此纠正即可</b></span>
                    </div>
                    {/* 已确认 */}
                    <div className="flex gap-1.5 rounded-md border border-[#D3F0E2] bg-[#F2FBF7] px-2 py-1.5 text-[10px] leading-[1.5]">
                      <span className="shrink-0 pt-px text-[9.5px] font-extrabold text-ok">已确认</span>
                      <span><b className="font-bold text-ink">时间</b> 今年夏天 · <b className="font-bold text-ink">地点</b> 海边小城 · <b className="font-bold text-ink">人物</b> 安妮 18 / 林屿 19 · <b className="font-bold text-ink">核心事件</b> 灯塔下自行车撞翻相识</span>
                    </div>
                  </div>
                  {/* 缺口追问 */}
                  <div className="rounded-md border border-[#F6E6C4] bg-[#FFF9EC] p-2 text-[10px] leading-[1.5] text-[#9A7420]">
                    <div className="mb-1 text-[9.5px] font-extrabold">⏳ 缺口追问</div>
                    <b className="font-extrabold text-ink">本季边界：这一季讲到哪？</b>（必答后才能定案）
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <button type="button" className="rounded-full border border-[#DED9FB] bg-violet-soft px-2.5 py-1 text-[10px] font-bold text-[#5A4FD8] hover:bg-violet hover:text-white" data-s0-chip="edge-summer">第一季只讲夏天相识</button>
                      <button type="button" className="rounded-full border border-[#E6E8F1] bg-[#F4F5FA] px-2.5 py-1 text-[10px] font-bold text-[#7A8098] hover:bg-[#E9EBF4] hover:text-ink" data-s0-chip="edge-love">讲到确定关系</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🚪 定案门 */}
              <div className={`flex flex-col overflow-hidden rounded-[12px] border bg-white transition ${
                cnodeState(2) === 'active' ? 'border-[#D9D3FB] opacity-100 shadow-[0_10px_26px_rgba(108,92,231,0.12)] -translate-y-px'
                  : cnodeState(2) === 'done' ? 'border-[#BFE6D2] opacity-100 bg-gradient-to-b from-[#FBFFFE] to-white'
                  : 'border-line opacity-55'
              }`}>
                <div className={`flex items-center gap-2 border-b border-[#F2F3F8] px-3 py-2.5 ${
                  cnodeState(2) === 'active' ? 'bg-gradient-to-br from-[#F4F1FF] to-[#EFEDFE]' : ''
                }`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10.5px] font-extrabold ${
                    cnodeState(2) === 'done' ? 'bg-[#E7F8F0] text-ok' : 'bg-violet-soft text-violet'
                  }`}>✓</span>
                  <span className="text-[12px] font-extrabold text-ink">立项定案门</span>
                  <span className={`ml-auto rounded-full px-2 py-px text-[8.5px] font-bold ${
                    cnodeState(2) === 'active' ? 'bg-violet-soft text-[#5A4FD8]' : cnodeState(2) === 'done' ? 'bg-[#E7F8F0] text-[#1E9E66]' : 'bg-[#F2F3F9] text-[#A6ABC0]'
                  }`}>{cnodeLabel(2)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGateOpen(true)}
                  className="flex flex-1 flex-col items-center pt-2 transition hover:opacity-90"
                  data-s0-gate
                  title="点击打开定案卡"
                >
                  <span className={`grid h-[46px] w-[46px] place-items-center rounded-[13px] transition ${
                    cnodeState(2) === 'done' ? 'bg-ok text-white'
                      : cnodeState(2) === 'active' ? 'bg-violet text-white shadow-[0_8px_20px_rgba(108,92,231,0.4)] animate-[glow_1.6s_ease-in-out_infinite]'
                      : 'bg-[#F1F2F8] text-[#AEB4C8]'
                  }`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M9 12.5 11.5 15 16 9.5" /><circle cx="12" cy="12" r="9.2" />
                    </svg>
                  </span>
                  <div className={`mt-1 text-center text-[10.5px] leading-[1.6] ${
                    cnodeState(2) === 'active' ? 'text-[#4A4F68]' : 'text-[#7A8098]'
                  }`}>
                    就绪条件客观判定
                    <br />
                    <span className="text-[9.5px] text-[#A6ABC0]">六要素有值 · 前提达 5 项 · 1 主风格</span>
                  </div>
                  {cnodeState(2) === 'active' && (
                    <div className="mt-1.5 mb-2.5 rounded-md bg-[#FFF4DE] px-2 py-1.5 text-[9px] leading-[1.5] text-[#7A5C1D]">
                      <b className="text-[#C0841D]">相对 v2 改动：</b>{GATE_DIFF}
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 演示控制条 */}
          <div className="rounded-md border border-[#F6E6C4] bg-[#FFF9EC] p-2 text-[10px] leading-[1.5] text-[#9A7420]">
            <div className="mb-1.5 text-[9.5px] font-extrabold">▶️ 演示控制（顺序自由）</div>
            点选下方按钮推进状态机，每步都会自动改流程导航 + 节点状态 + 对话流：
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                { i: 0, label: 'Step 0 · 入口' },
                { i: 1, label: 'Step 1 · 诊断就绪' },
                { i: 2, label: 'Step 2 · 前提完成' },
                { i: 3, label: 'Step 3 · 就绪 · 发定案卡' },
              ].map(s => (
                <button
                  key={s.i}
                  type="button"
                  onClick={() => setStepIdx(s.i)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                    stepIdx === s.i
                      ? 'border-violet bg-violet text-white'
                      : 'border-[#DED9FB] bg-violet-soft text-[#5A4FD8] hover:bg-violet hover:text-white'
                  }`}
                  data-s0-step={s.i}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* v1.10 规则提示条 */}
          <div className="rounded-md border border-line bg-[#F4F5FA] px-3 py-2.5 text-[10.5px] leading-[1.55] text-[#5A607A]">
            <b className="text-[#5A4FD8]">v1.10 规则：</b>所有字段（含 premise / 主风格）任何阶段都可改；改后系统反向追溯 <code className="rounded bg-white px-1 font-mono text-[10px]">manifest.parentReference</code> 标记下游影响点，由用户三选一（<b>一键重生成</b> / <b>仅标记脏</b> / <b>取消</b>）。立项单 v1..vN 全量保留。
          </div>

        </div>
      </div>

      {/* 定案卡弹层（v1.10 · 发布 v(N+1)） */}
      {gateOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(30,34,51,0.45)] backdrop-blur-[3px]"
          onClick={() => setGateOpen(false)}
          data-s0-modal
        >
          <div
            className="w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_30px_70px_rgba(20,22,45,0.4)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 bg-gradient-to-br from-[#7A6BF0] to-violet px-[18px] py-3.5 text-white">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-white/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M9 12.5 11.5 15 16 9.5" /><circle cx="12" cy="12" r="9.2" />
                </svg>
              </span>
              <div>
                <div className="text-[13.5px] font-extrabold">主控 Agent · 立项定案卡</div>
                <div className="mt-0.5 text-[9.5px] opacity-80">就绪条件全部满足，可发布新版本</div>
              </div>
              <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold">立项单 {briefVer}</span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-3.5 text-[11px]">
              <div>
                <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">立项六要素</div>
                {BRIEF_KV.map((kv, i) => (
                  <div key={i} className="flex gap-2 border-b border-[#F6F7FB] py-[5px] last:border-b-0">
                    <span className="w-14 shrink-0 text-[10.5px] font-bold text-[#9AA0B5]">{kv.k}</span>
                    <span className="font-bold text-ink">{kv.v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-[9.5px] font-extrabold tracking-[0.4px] text-[#9AA0B5]">视觉风格</div>
                <div className="flex gap-2 border-b border-[#F6F7FB] py-[5px]">
                  <span className="w-14 shrink-0 text-[10.5px] font-bold text-[#9AA0B5]">主风格</span>
                  <span className="font-bold text-ink">{PICKED_STYLE.family} · {PICKED_STYLE.name}</span>
                </div>
                <div className="flex gap-2 py-[5px]">
                  <span className="w-14 shrink-0 text-[10.5px] font-bold text-[#9AA0B5]">可行度</span>
                  <span className="rounded bg-[#E7F8F0] px-1.5 py-px text-[10px] font-extrabold text-[#1E9E66]">● {PICKED_STYLE.feasibility}</span>
                </div>
              </div>
              <div className="rounded-md rounded-l-none border-l-[3px] border-[#E8A93C] bg-[#FFF4DE] px-2.5 py-1.5 text-[10px] leading-[1.5] text-[#7A5C1D]">
                <b className="text-[#C0841D]">相对 {briefVer === 'v1' ? 'v0' : 'v' + (parseInt(briefVer.slice(1)) - 1)} 改动：</b>{GATE_DIFF}
              </div>
              <div className="rounded-md rounded-l-none border-l-[3px] border-[#C9C1F5] bg-[#F7F8FC] px-2.5 py-1.5 text-[10px] leading-[1.5] text-[#6A708A]">
                <div className="mb-0.5 text-[9px] font-extrabold text-[#A6ABC0]">v1.10 · manifest.parentReference</div>
                立项单 v1..vN 全量保留；下游产物（剧本/分镜/资产/镜头）将按 parentReference 自动标记脏，由用户三选一处理。
              </div>
            </div>
            <div className="flex gap-2.5 px-[18px] pb-4">
              <button
                type="button"
                onClick={() => { setGateOpen(false); onBackToDag() }}
                className="flex-1 rounded-[10px] bg-violet py-2.5 text-[12px] font-extrabold text-white transition hover:-translate-y-px hover:bg-[#5A4FD8]"
                data-s0-publish
              >确认发布</button>
              <button
                type="button"
                onClick={() => setGateOpen(false)}
                className="flex-1 rounded-[10px] bg-[#F1F2F8] py-2.5 text-[12px] font-extrabold text-[#6A708A] transition hover:bg-[#E5E7F2]"
              >再改改</button>
              <button
                type="button"
                onClick={() => setGateOpen(false)}
                className="shrink-0 rounded-[10px] border border-[#DED9FB] bg-white py-2.5 px-3.5 text-[12px] font-extrabold text-[#5A4FD8] transition hover:bg-violet-soft"
                data-s0-history
              >历史</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
