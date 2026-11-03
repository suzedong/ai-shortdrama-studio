// feature-019 · 对话驱动区（契约 §3.3 / §4）
// 多 Agent 结构化对话：用户气泡 + Agent 气泡（文本 / 立项单卡 / 工具轨迹卡）+ 内嵌 GateCard。
// 视觉对齐原型 #rightChat：28px 头像、#F4F5FA 气泡、brief-card / trace / gate 卡。
import { useEffect, useRef, useState } from 'react'

import {
  turnSegments,
  turnText,
  type StreamingTurn,
  type ToolView,
  type TurnSegment,
} from '../../lib/chat-runtime'
import { summarizeToolActions, toolActionPhrase, toolArgPreview } from '../../lib/tool-labels'
import type { CanvasGate } from '@shared/types'
import GateCardView from './GateCardView'
import MarkdownText from './ChatMarkdown'
import { FAMILY_GRAD, PREVIEW_URL } from '../style/VisualCatalog'
import { getStyleEntry, useStyleCatalog } from '../style/style-catalog-store'
import { formatChatModelLabel } from '../shell/AiServicePanel'

// ── 多 Agent 身份（与原型 chat-head 五叠圈一致） ──
export type AgentId = 'showrunner' | 'writer' | 'art' | 'shot' | 'sound' | 'engine'

const AGENT_META: Record<AgentId, { glyph: string; name: string }> = {
  showrunner: { glyph: '主', name: '主控 Agent' },
  writer: { glyph: '编', name: '编剧 Agent' },
  art: { glyph: '美', name: '美术 Agent' },
  shot: { glyph: '镜', name: '镜头 Agent' },
  sound: { glyph: '声', name: '声音 Agent' },
  engine: { glyph: '引', name: '引擎 Agent' },
}

const HEAD_AGENTS: AgentId[] = ['showrunner', 'writer', 'art', 'shot', 'sound']
const HEAD_COLORS = ['#6C5CE7', '#2BB673', '#E8A93C', '#E05A52', '#5B8DEF']

export interface BriefRow {
  k: string
  v: string
}

export interface TraceData {
  agent: AgentId
  tag: string
  tool: string
  status: string
  body?: string
  progress?: number // 0-100，出现时渲染进度条
}

export interface ChatItem {
  id: string
  role: 'user' | 'agent'
  text?: string
  reasoning?: string // Agent 本轮推理（单段，向后兼容）；与 reasoningBlocks 二选一
  reasoningBlocks?: string[] // 一个 turn 内多段思维链（推理→工具→再推理…），按发生顺序逐段折叠
  /**
   * B-56：推理 / 正文 / 工具按事件到达顺序交错的有序分段（推理→工具→推理→工具…）；
   * 存在时优先于 reasoning/reasoningBlocks/tools 平铺字段，定稿与历史回放统一由此渲染。
   */
  segments?: TurnSegment[]
  tools?: ToolView[] // Agent 当轮工具快照；正文定稿与历史回放均保留（segments 缺省时的旧路径）
  agent?: AgentId // agent 消息的发言身份，默认 showrunner
  brief?: BriefRow[] // 立项单卡（kv）
  trace?: TraceData // 工具轨迹卡
  label?: ChatLabel // 显式气泡标签；缺省时 agent 消息按前缀约定解析、用户消息固定「用户」
  /**
   * 该条消息实际使用的模型（定稿时由当前选择器快照写入）；
   * 历史消息不持久化模型，气泡层缺省回退当前 selectedModel。
   */
  model?: ChatModelOption
}

// ── 气泡标签（B-34 / 原型 .cmsg .src 三色：AI 紫 · 用户白底紫边 · 待确认琥珀） ──
export interface ChatLabel {
  text: string
  tone: 'ai' | 'user' | 'infer'
}

// 前缀约定（showrunner 职责纪律 9）：Agent 协议消息以 `【标签】` 开头，渲染层剥离为气泡上沿浮动标签；
// 标签含「待确认」按 infer 琥珀色；流式未闭合的 `【…` 暂作 pending（正文先不显示，等下一片闭合）。
export function parseChatLabel(text: string): { label?: ChatLabel; rest: string; pending?: boolean } {
  const m = /^【([^】\n]{1,16})】[ \t]*\n?/.exec(text)
  if (m) {
    const labelText = m[1].trim()
    return { label: { text: labelText, tone: /待确认/.test(labelText) ? 'infer' : 'ai' }, rest: text.slice(m[0].length) }
  }
  if (/^【[^】\n]*$/.test(text)) return { rest: '', pending: true }
  return { rest: text }
}

function LabelTag({ label, side }: { label: ChatLabel; side: 'left' | 'right' }) {
  const toneCls =
    label.tone === 'infer'
      ? 'border-[#F6E6C4] bg-[#FFF4DE] text-[#C0841D]'
      : label.tone === 'user'
        ? 'border-violet bg-white text-[#5A4BC4]'
        : 'border-[#D9D3FB] bg-violet-soft text-[#5A4BC4]'
  return (
    <span
      data-chat-label={label.tone}
      className={`absolute -top-2 ${side === 'left' ? 'left-2' : 'right-2'} whitespace-nowrap rounded-[5px] border px-1.5 py-px text-[8.5px] font-extrabold tracking-[0.3px] ${toneCls}`}
    >
      {label.text}
    </span>
  )
}

/**
 * AI 气泡默认身份标签：协议标签（【…】）缺省时兜底显示发言身份名，
 * 保证实时流式 / 历史回放 / 旧路径所有 AI 气泡都有标签（用户诉求 q2）。
 */
function defaultAgentLabel(agent: AgentId | undefined): ChatLabel {
  return { text: AGENT_META[agent ?? 'showrunner'].name, tone: 'ai' }
}

// AI 气泡底部模型小字：让用户一眼确认本轮实际调用的模型（用户诉求 q1）。
// 历史消息无模型快照时回退当前选择器；选择器也为空则不渲染该行。
function BubbleModelLine({ model }: { model: ChatModelOption | null | undefined }) {
  if (!model) return null
  return (
    <div
      data-chat-model={chatModelKey(model)}
      className="mt-1 flex items-center justify-end gap-1 border-t border-line/60 pt-1 text-[9.5px] leading-none text-muted"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[9px] w-[9px]">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
      </svg>
      {chatModelLabel(model)}
    </div>
  )
}

// ── 对话内选项卡（B-35 / showrunner 职责纪律 10 / 原型 .cmsg .opts） ──
// 约定：Agent 消息末尾输出 `【选项】…【/选项】`（纯文本行）或 `【风格选项】…【/风格选项】`（裸风格 ID 行），
// 渲染层剥离为可点按钮；点击 = 代发该选项编号（与手打「1」同一路径，quote 组装分流照旧）。
// `【追问选项】…【/追问选项】`（纯文本候选答复行、无编号，feature-010）渲染为横向胶囊 chips，点击代发该行原文。
export interface ChatOption {
  num: string // 编号（"1"…"99" / "A"…"Z"），点击时代发
  text: string // 纯文本选项文字；风格选项为原始行内容
  styleId?: string // 【风格选项】块中命中谱系的 ID（未知 ID 降级纯文本选项）
}

const OPT_LINE = /^\s*(\d{1,2}|[A-Za-z])[.、．]\s*(\S.*)$/

// 开/闭标签只在行首识别（正文中途提及约定文字不误判）；已闭合块可位于消息任意位置，
// 块前 / 块后正文保留在 rest（B-59：旧规则要求整块必须在末尾，块后补一句即整块降级）。
export function parseChatOptions(text: string): {
  rest: string
  options?: ChatOption[]
  style?: boolean
  chips?: string[] // 【追问选项】块：逐非空行 trim 后的候选答复原文（≥2 条）
  pending?: boolean
} {
  const trimmed = text.replace(/\s+$/, '')
  // ① 已闭合：开标签位于行首、闭标签已出现（不再要求整块在消息末尾——块后可有补充说明）
  const closedRe = /(^|\n)【(风格选项|选项|追问选项)】([\s\S]*?)【\/\2】/
  const closedM = closedRe.exec(trimmed)
  if (closedM) {
    const kind = closedM[2]
    const openTag = `【${kind}】`
    const closeTag = `【/${kind}】`
    const blockStart = closedM.index + closedM[1].length
    const body = closedM[3]
    // 块前正文（开标签必须在行首，已由正则保证）
    const before = trimmed.slice(0, blockStart).replace(/\s+$/, '')
    // 块后剩余（若还有别的闭合块，此处只处理首个，其余保留在 rest 中）
    const after = trimmed.slice(blockStart + openTag.length + body.length + closeTag.length).replace(/^\s+/, '')

    // 【追问选项】：每非空行 trim 整体即一条 chip 原文（不经 OPT_LINE 编号解析）；<2 行整块不识别
    if (kind === '追问选项') {
      const chips = body.split('\n').map((l) => l.trim()).filter(Boolean)
      if (chips.length < 2) return { rest: text }
      return { rest: [before, after].filter(Boolean).join('\n'), chips }
    }
    const options: ChatOption[] = []
    for (const line of body.split('\n')) {
      if (!line.trim()) continue
      const m = OPT_LINE.exec(line)
      if (!m) return { rest: text } // 任一行失配：整块不识别、原样显示（暴露格式错误）
      options.push({ num: m[1], text: m[2].trim() })
    }
    if (options.length < 2) return { rest: text }
    const style = kind === '风格选项'
    if (style) {
      for (const o of options) {
        const idM = /^([A-E]\d{1,2})$/.exec(o.text)
        if (idM && getStyleEntry(idM[1])) o.styleId = idM[1]
      }
    }
    return { rest: [before, after].filter(Boolean).join('\n'), options, style }
  }
  // ② 流式未闭合：最后一个行首开标签之后没有对应闭标签 → pending（块内容暂不显示，等闭合）
  const openRe = /(^|\n)(【(风格选项|选项|追问选项)】)/g
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = openRe.exec(text))) last = m
  if (last) {
    const tagStart = last.index + last[1].length
    const after = text.slice(tagStart + last[2].length)
    if (!after.includes(`【/${last[3]}】`)) {
      return { rest: text.slice(0, tagStart).replace(/\s+$/, ''), pending: true }
    }
  }
  // ③ 流式正在键入开标签（末尾是「【选」「【风格选」等前缀）→ pending
  const tail = /(?:^|\n)(【[^】\n]*)$/.exec(text)
  if (tail && ('【选项】'.startsWith(tail[1]) || '【风格选项】'.startsWith(tail[1]) || '【追问选项】'.startsWith(tail[1]))) {
    return { rest: text.slice(0, text.length - tail[1].length).replace(/\s+$/, ''), pending: true }
  }
  return { rest: text }
}

// 用户短回复 → 选项编号（「1」「选 2」「A」）；非编号类自由文本返回 undefined
function pickNumOf(text?: string): string | undefined {
  const t = (text ?? '').trim().replace(/^选\s*/, '')
  return /^(\d{1,2}|[A-Za-z])$/.test(t) ? t : undefined
}

// 选项按钮列：对齐原型 .opt（白底 1.5px 边框圆角 9px、hover 紫底右移、 picked 紫底白字）；
// 风格选项带 40px 缩略图（缺图落家族渐变兜底）+ 主·已验证 / 备·风险自担徽章 + ID@谱系版本。
function OptionCard({
  options,
  disabled,
  pickedNum,
  onPick,
}: {
  options: ChatOption[]
  disabled: boolean
  pickedNum?: string
  onPick: (num: string) => void
}) {
  // feature-811：风格选项卡数据 = style:catalog 快照（订阅到位后重渲染；版本号显快照 version）
  const catalog = useStyleCatalog()
  return (
    <div data-chat-options className="mt-[7px] flex flex-col gap-[5px]">
      {options.map(opt => {
        const picked = pickedNum === opt.num
        const entry = opt.styleId ? getStyleEntry(opt.styleId) : undefined
        return (
          <button
            key={opt.num}
            type="button"
            data-chat-option={opt.num}
            data-picked={picked || undefined}
            disabled={disabled}
            onClick={() => onPick(opt.num)}
            className={`flex items-center gap-[7px] rounded-[9px] border-[1.5px] px-[9px] py-[7px] text-left text-[10.5px] font-bold transition ${
              picked
                ? 'border-violet bg-violet text-white'
                : `border-line bg-white text-[#4A4F68] ${disabled ? 'opacity-40' : 'hover:translate-x-[2px] hover:border-violet hover:bg-violet-soft'}`
            }`}
          >
            {entry ? (
              <>
                {PREVIEW_URL[entry.id] ? (
                  <img
                    src={PREVIEW_URL[entry.id]}
                    alt={entry.id}
                    className="h-10 w-10 shrink-0 rounded-[7px] border border-line object-cover"
                  />
                ) : (
                  <i
                    className="block h-10 w-10 shrink-0 rounded-[7px] border border-line"
                    style={{ background: FAMILY_GRAD[entry.familyCode] }}
                  />
                )}
                <span className={picked ? 'text-white' : 'text-ink'}>
                  {entry.name} · {entry.id} @ {catalog.version ?? '…'}
                </span>
                <span
                  className={`shrink-0 rounded px-[5px] py-px text-[8.5px] font-extrabold ${
                    picked
                      ? 'bg-white/20 text-white'
                      : entry.role === 'main'
                        ? 'bg-[#E7F8F0] text-[#1E9E66]'
                        : 'bg-[#FFF4DE] text-[#C0841D]'
                  }`}
                >
                  {entry.role === 'main' ? '主·已验证' : '备·风险自担'}
                </span>
              </>
            ) : (
              <>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-extrabold ${
                    picked ? 'bg-white/20 text-white' : 'bg-violet-soft text-violet'
                  }`}
                >
                  {opt.num}
                </span>
                <span>{opt.text}</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

// 追问选项胶囊列（feature-010 / 契约 §3.1 / 原型 .cr .chip）：横向 flex-wrap 胶囊，点击代发 chip 原文；
// picked = 紧随用户消息与 chip 原文全等 → 紫底白字（picked 态不压暗，同 OptionCard 哲学）；disabled → opacity-40。
function ChipRow({
  chips,
  disabled,
  pickedChip,
  onPick,
}: {
  chips: string[]
  disabled: boolean
  pickedChip?: string
  onPick: (text: string) => void
}) {
  return (
    <div className="mt-[6px] flex flex-wrap gap-[5px]" data-chat-chips>
      {chips.map(chip => {
        const picked = pickedChip === chip
        return (
          <button
            key={chip}
            type="button"
            data-chat-chip={chip}
            data-picked={picked || undefined}
            disabled={disabled}
            onClick={() => onPick(chip)}
            className={
              picked
                ? 'rounded-full border border-violet bg-violet px-2 py-[3px] text-[10px] font-bold text-white transition-colors'
                : 'rounded-full border border-[#DED9FB] bg-violet-soft px-2 py-[3px] text-[10px] font-bold text-[#5A4BC4] transition-colors hover:bg-violet hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:bg-violet-soft disabled:hover:text-[#5A4BC4]'
            }
          >
            {chip}
          </button>
        )
      })}
    </div>
  )
}

// 发卡拍板提示（feature-010 / 契约 §3.2 / 原型 .qh）：零 props 固定文案琥珀条；
// 系统直做——渲染层识别 pendingGate.gateId === '0-final'（就绪·发卡定案卡）时紧随 GateCardView 自动挂载，零指令负担。
function GateHint() {
  return (
    <div
      data-chat-gate-hint
      className="mt-[6px] rounded-[8px] border border-[#F6E6C4] bg-[#FFF9EC] px-2 py-1.5 text-[10px] leading-[1.6] text-[#9A7420]"
    >
      <div className="mb-[1px] flex items-center gap-1 text-[9.5px] font-extrabold">💡 拍板提示</div>
      直接说「行，就按这版发布」= 按钮拍板（系统记录原话与定案卡版本）
    </div>
  )
}

export interface ChatModelOption {
  providerID: AiProviderId
  modelID: string
}

interface Props {
  items: ChatItem[]
  stream: StreamingTurn | null
  pendingGate: CanvasGate | null
  deciding: boolean
  sending: boolean
  /** feature-808 D-006：流式生成态（promptAsync accepted 后 → idle/error 前），驱动停止钮持续可达 */
  generating?: boolean
  error: string | null
  onSend: (text: string) => void
  onDecide: (decision: 'approved' | 'rejected', note?: string) => void
  /** feature-808（R4 / D-006）：sending 或 generating 中显示停止钮；不传则维持仅发送钮形态 */
  onStop?: () => void
  /** feature-808：历史回放加载态（默认 false）；加载中禁用发送 */
  historyLoading?: boolean
  /** D-013：AI 服务不可用原因（null=可用/未知）；非空显示常驻横幅并禁用输入与发送 */
  aiDown?: string | null
  /** D-013：横幅「重新检测」按钮回调 */
  onAiRetry?: () => void
  /** feature-014：当前可用的对话模型与逐消息选择；空列表禁止一切发送路径 */
  modelOptions: ChatModelOption[]
  selectedModel: ChatModelOption | null
  onModelChange: (model: ChatModelOption) => void
  /** feature-812：无项目等"整体不可对话"原因（null/undefined = 不锁定）；非空即以该文案禁用输入与发送 */
  lockedReason?: string | null
  /** feature-812 X-005：锁定期间的空态说明（缺省按"未打开项目"表述；加载中传"正在读取…"） */
  lockedHint?: string | null
}

function chatModelKey(model: ChatModelOption): string {
  return `${model.providerID}/${model.modelID}`
}

function chatModelLabel(model: ChatModelOption): string {
  return formatChatModelLabel(model.providerID, model.modelID)
}

// ── 浏览器预览演示消息（对齐原型 #chatBody 5 条） ──
export function demoChatItems(): ChatItem[] {
  return [
    {
      id: 'd1',
      role: 'user',
      text: '做一部校园恋爱短剧，女主大一新生，故事发生在夏天的海边小城，每集 90 秒左右，先做第一集。',
    },
    {
      id: 'd2',
      role: 'agent',
      agent: 'showrunner',
      text: '已理解你的创作目标，先把立项单要素跟你对齐，确认后我就拆任务开工。',
      brief: [
        { k: '类型', v: '校园 / 恋爱 / 夏日' },
        { k: '集数', v: '第一季 8 集（先做 E01）' },
        { k: '时长', v: '每集约 90 秒' },
        { k: '画幅', v: '9:16 竖屏 · 768P–2K' },
        { k: '风格', v: '日系动画 · 清新柔光' },
      ],
    },
    {
      id: 'd3',
      role: 'agent',
      agent: 'art',
      trace: {
        agent: 'art',
        tag: '美术 Agent',
        tool: 'image.submit',
        status: '● 完成',
        body: '角色定妆 · 安妮（女主）\nseed 88213 · 一致性配方已锁定 · v4',
      },
    },
    {
      id: 'd4',
      role: 'agent',
      agent: 'engine',
      text: '镜头批量任务已入队，3 个引擎实例并行。',
      trace: {
        agent: 'engine',
        tag: '引擎 Agent',
        tool: 'batch.run · B5',
        status: '● 12/18',
        progress: 66,
      },
    },
    {
      id: 'd5',
      role: 'agent',
      agent: 'showrunner',
      text: '整集镜头已全部生成，请过目确认。确认后剪辑 Agent 接管合流。',
    },
    // B-35 选项卡演示：d6 已答（紧随用户「1」→ 选项 1 picked、其余置灰）；d8 待答（末条 → 可点）
    {
      id: 'd6',
      role: 'agent',
      agent: 'showrunner',
      text: '【AI 反问】开干前先确认一个关键分叉——这决定选题诊断与合规口径方向：\n【选项】\n1. 商业短剧（要上平台 · 讲打法 · 走合规）\n2. 个人纪念（不以投放为目的 · 诊断弱化）\n【/选项】',
    },
    {
      id: 'd7',
      role: 'user',
      text: '1',
    },
    {
      id: 'd8',
      role: 'agent',
      agent: 'showrunner',
      text: '【风格选型】按题材从《视觉风格谱系》匹配（不自创画风），点一个作为主风格：\n【风格选项】\n1. A7\n2. A3\n3. B1\n【/风格选项】',
    },
    // d9：追问选项 chips 待答演示（末条可点；前条 picked 演示由 d6 承担，d9 本身不预置回答）
    {
      id: 'd9',
      role: 'agent',
      agent: 'showrunner',
      text: '【缺口追问】\n还缺**核心冲突**——男女主之间的主要阻力是什么？\n【追问选项】\n家族反对，门第差距\n前任回归，旧情未了\n身份秘密，真相将揭\n【/追问选项】',
    },
  ]
}

function Avatar({ agent, user }: { agent?: AgentId; user?: boolean }) {
  if (user) {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#8FA8E8] to-[#5B7FD8] text-[10px] font-extrabold text-white">
        SZ
      </div>
    )
  }
  const meta = AGENT_META[agent ?? 'showrunner']
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#B8AFFF] to-violet text-[10px] font-extrabold text-white">
      {meta.glyph}
    </div>
  )
}

function BriefCard({ rows }: { rows: BriefRow[] }) {
  return (
    <div className="mt-2 overflow-hidden rounded-[9px] border border-line">
      {rows.map((row, i) => (
        <div key={`${row.k}-${i}`} className="flex text-[10.5px] odd:bg-canvas">
          <span className="w-[52px] shrink-0 px-[9px] py-[5px] text-[#9AA0B5]">{row.k}</span>
          <span className="px-[9px] py-[5px] font-semibold text-ink">{row.v}</span>
        </div>
      ))}
    </div>
  )
}

function TraceCard({ trace }: { trace: TraceData }) {
  const engine = trace.agent === 'engine'
  return (
    <div className="mt-2 overflow-hidden rounded-[9px] border border-line text-[10.5px]">
      <div className="flex items-center gap-[7px] bg-canvas px-2.5 py-[7px]">
        <span
          className={`rounded-full px-1.5 py-px text-[8.5px] font-bold ${
            engine ? 'bg-[#EAF1FE] text-[#3E6FD0]' : 'bg-violet-soft text-[#5A4BC4]'
          }`}
        >
          {trace.tag}
        </span>
        <span className="font-bold text-ink">{trace.tool}</span>
        <span className="ml-auto flex items-center gap-[3px] text-[9.5px] text-ok">{trace.status}</span>
      </div>
      {trace.body && (
        <div className="whitespace-pre-line border-t border-[#F2F3F8] px-2.5 py-[7px] font-mono text-[10px] leading-[1.6] text-[#7A8098]">
          {trace.body}
        </div>
      )}
      {typeof trace.progress === 'number' && (
        <div className="mx-2.5 my-[7px] mb-[9px] h-1 overflow-hidden rounded-full bg-[#EEF0F6]">
          <i
            className="block h-full rounded-full bg-gradient-to-r from-[#8FA8F5] to-violet transition-all duration-1000"
            style={{ width: `${trace.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── feature-809 · 流式活跃指示（契约 §2/§3；活跃不变式：running 全程气泡内 ≥1 个 CSS 动画元素） ──
// 指示器由 turn.status 驱动、动画自持，与 token 到达频率解耦；终态（done/error）全撤。

/** 工具耗时标签：起止齐备且非负 → `(差/1000).toFixed(1)+'s'`；缺任一端或负值 → null（契约 §2.1） */
export function toolDurationLabel(tool: ToolView): string | null {
  if (tool.startedAt == null || tool.endedAt == null) return null
  const ms = tool.endedAt - tool.startedAt
  if (ms < 0) return null
  return `${(ms / 1000).toFixed(1)}s`
}

/** 流式光标：running 且已有正文 → true；其余一切组合 → false（契约 §2.2） */
export function showStreamCursor(turn: StreamingTurn, text: string): boolean {
  return turn.status === 'running' && text.length > 0
}

/** 三点打字动画（契约 §3.4）：animate-bounce + 0/150/300ms 延迟阶梯；占位气泡与空态思考行两处复用 */
function TypingDots() {
  return (
    <span data-testid="chat-typing-dots" className="inline-flex items-center gap-[3px]" role="status">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

/** 行内工具状态行：pending=○+「待执行」；running=spinner+「执行中」；completed=✓+耗时；error=✗+errorText */
function ToolRow({ tool }: { tool: ToolView }) {
  const duration = toolDurationLabel(tool)
  const phrase = toolActionPhrase(tool.tool)
  // D-012：白名单关键参数摘要——历史回放用主进程 argsPreview；流式从 args 现算
  const preview = tool.argsPreview ?? toolArgPreview(tool.tool, tool.args)
  const previewNode = preview ? (
    <span className="truncate text-muted/70" title={preview}>
      · {preview}
    </span>
  ) : null
  return (
    <div
      data-testid="chat-tool-row"
      className="flex items-center gap-1.5 text-[11px] leading-4 text-muted"
      title={tool.tool}
    >
      {tool.status === 'pending' && (
        <>
          <span className="shrink-0">○</span>
          <span className="truncate">{phrase}</span>
          {previewNode}
          <span className="shrink-0">待执行</span>
        </>
      )}
      {tool.status === 'running' && (
        <>
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-line border-t-violet" />
          <span className="truncate">{phrase}</span>
          {previewNode}
          <span className="shrink-0">执行中</span>
        </>
      )}
      {tool.status === 'completed' && (
        <>
          <span className="shrink-0 text-ok">✓</span>
          <span className="truncate">{phrase}</span>
          {previewNode}
          {duration && <span className="shrink-0">{duration}</span>}
        </>
      )}
      {tool.status === 'error' && (
        <>
          <span className="shrink-0 text-bad">✗</span>
          <span className="truncate">{phrase}</span>
          {previewNode}
          <span className="truncate text-bad" title={tool.errorText || '执行失败'}>
            {tool.errorText || '执行失败'}
          </span>
        </>
      )}
    </div>
  )
}

/**
 * 工具轨迹折叠块（D-011）：标题给「N 项」与动作摘要，展开后逐条列状态行。
 * 单个工具时不加折叠层（无折叠价值）；流式态默认展开（生成中要看进度），定稿态默认收起。
 */
function ToolTrace({
  tools,
  defaultOpen,
}: {
  tools: ToolView[]
  defaultOpen?: boolean
}) {
  if (tools.length === 0) return null
  const summary = summarizeToolActions(tools.map(t => t.tool))
  const rows = (
    <div className="mt-1 space-y-1">
      {tools.map(tool => (
        <ToolRow key={tool.callId} tool={tool} />
      ))}
    </div>
  )
  if (tools.length === 1) return <div className="mt-2">{rows}</div>
  return (
    <details
      data-testid="chat-tool-trace"
      open={defaultOpen}
      className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-muted"
    >
      <summary className="cursor-pointer select-none">
        <span className="font-medium text-ink">工具轨迹 · {tools.length} 项</span>
        {summary && <span className="text-muted"> · {summary}</span>}
      </summary>
      {rows}
    </details>
  )
}

function ReasoningDetails({ text, index, total, defaultOpen = false }: {
  text: string
  index: number
  total: number
  defaultOpen?: boolean
}) {
  const label = total > 1 ? `推理过程 ${index + 1}/${total}` : '推理过程'
  return (
    <details
      open={defaultOpen}
      data-testid="chat-reasoning"
      className="rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-muted"
    >
      <summary className="cursor-pointer select-none">{label}</summary>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </details>
  )
}

/** 多段思维链：按发生顺序逐段折叠；流式态最后一段默认展开以便看到最新推理。 */
function ReasoningBlocks({ blocks, streaming = false }: { blocks: string[]; streaming?: boolean }) {
  if (blocks.length === 0) return null
  return (
    <div className="mb-2 space-y-2">
      {blocks.map((text, i) => (
        <ReasoningDetails
          key={i}
          text={text}
          index={i}
          total={blocks.length}
          defaultOpen={streaming && i === blocks.length - 1}
        />
      ))}
    </div>
  )
}

/**
 * B-56：按 segments 交错渲染「推理 → 工具/结果 → 推理 → 工具/结果」。
 * - reasoning 逐段折叠：流式态最后一段默认展开；编号按 reasoning 段计数；
 * - 相邻 tool 段各自渲染 ToolTrace（单工具无折叠壳，多工具成组）；
 * - 相邻 text 段按顺序渲染；流式态最后一个 text 段带闪烁光标；
 * - optionsLabel/options/chips 由气泡壳从全文解析后透传，渲染在最后一个 text 段位置
 *   （为 null 表示该 text 段无选项）；
 * - streaming 且无任何内容 → 打字点空态。
 */
function InterleavedContent({
  segments,
  streaming = false,
  running = false,
  trailing,
}: {
  segments: TurnSegment[]
  streaming?: boolean
  running?: boolean
  /** 末尾追加节点（选项卡 / chips，定位在最后一个正文段之后） */
  trailing?: React.ReactNode
}) {
  if (segments.length === 0) {
    return running ? (
      <span className="inline-flex items-center gap-2 text-muted">
        <TypingDots />
        主控 Agent 正在思考…
      </span>
    ) : null
  }

  const reasoningTotal = segments.filter(s => s.kind === 'reasoning').length
  let reasoningSeen = 0
  const nodes: React.ReactNode[] = []

  // X-001 / AC7：流式中、正文尚未流出（仅推理或仅工具静默段）时，
  // 气泡尾部持续挂 spinner，保证 running 全程 ≥1 个 animate 元素且活跃可见。
  const hasText = segments.some(s => s.kind === 'text' && s.text.length > 0)
  const showThinking = streaming && running && !hasText
  const thinkingNode = showThinking ? (
    <span key="__thinking" className="mt-1 inline-flex items-center gap-2 text-muted">
      <TypingDots />
      正在思考…
    </span>
  ) : null

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    if (seg.kind === 'reasoning') {
      const idx = reasoningSeen
      reasoningSeen += 1
      nodes.push(
        <ReasoningDetails
          key={`rs-${seg.key}`}
          text={seg.text}
          index={idx}
          total={reasoningTotal}
          defaultOpen={streaming && idx === reasoningTotal - 1}
        />,
      )
      continue
    }

    if (seg.kind === 'tool') {
      // 收集相邻 tool 段为一组（保留各自到达顺序，不再合并全 turn 的工具）
      const group: ToolView[] = []
      let j = i
      for (; j < segments.length && segments[j].kind === 'tool'; j++) {
        group.push((segments[j] as Extract<TurnSegment, { kind: 'tool' }>).tool)
      }
      i = j - 1
      nodes.push(
        <div key={`tg-${seg.key}`} className={nodes.length > 0 ? 'mt-2' : ''}>
          <ToolTrace tools={group} defaultOpen={streaming} />
        </div>,
      )
      continue
    }

    // text：相邻 text 段各自渲染（保留顺序）；末尾 text 段挂 trailing 与流式光标
    const isLastText = !segments.slice(i + 1).some(s => s.kind === 'text')
    nodes.push(
      <div key={`tx-${seg.key}`} className={nodes.length > 0 ? 'mt-1' : ''}>
        <MarkdownText text={seg.text} />
        {isLastText && streaming && running && seg.text.length > 0 && (
          <span data-testid="chat-stream-cursor" className="animate-cursor-blink text-violet">▍</span>
        )}
        {isLastText && trailing}
      </div>,
    )
  }

  return <div className="space-y-2">{[...nodes, thinkingNode]}</div>
}

export default function ChatComposer({
  items, stream, pendingGate, deciding, sending, generating = false, error, onSend, onDecide, onStop,
  historyLoading, aiDown = null, onAiRetry, modelOptions, selectedModel, onModelChange,
  lockedReason = null,
  lockedHint = null,
}: Props) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  /** B-55：程序化滚动期间抑制 onScroll 回算（scrollTop 赋值本身会触发 scroll 事件） */
  const programmaticScrollRef = useRef(false)

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottomRef.current) {
      programmaticScrollRef.current = true
      el.scrollTop = el.scrollHeight
      // rAF 后解除：同帧内由赋值触发的 scroll 事件一律忽略；流式高频更新每次重入都会续期
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false
      })
    }
  }, [items, stream, pendingGate])

  const handleScroll = (): void => {
    const el = scrollRef.current
    if (!el || programmaticScrollRef.current) return
    // B-55：阈值放宽至 120px，流式高频增长 / 异步布局 / 亚像素误差下不误判为「离开底部」
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 120
  }

  const submit = (): void => {
    // feature-812（契约 L4）：锁定原因优先——回车 / 点击 / 选项代发三入口同源早退
    if (lockedReason) return
    const text = draft.trim()
    if (!text || sending || generating || historyLoading || aiDown || !selectedModel) return
    setDraft('')
    // B-55：用户主动发送 → 后续新气泡与流式增长强制贴底
    stickToBottomRef.current = true
    onSend(text)
  }

  // B-35：选项点击 = 代发编号（与手打同路径）；忙态或无可用模型禁点
  // feature-812：lockedReason 并入忙态，锁定时选项一并禁点
  const busy = sending || generating || historyLoading || !!stream || !!aiDown || !selectedModel || !!lockedReason
  const pickOption = (num: string): void => {
    if (busy) return
    // B-55：点选项等同主动发送，强制贴底跟随新一轮流式
    stickToBottomRef.current = true
    onSend(num)
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── chat-head：主控 Agent + 五 Agent 叠圈 ── */}
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-[9px]">
          <div>
            <div className="text-[13.5px] font-extrabold text-ink">主控 Agent</div>
            <div className="mt-px text-[10.5px] text-muted">导演 · 任务调度与确认门</div>
          </div>
          <div className="ml-auto flex">
            {HEAD_AGENTS.map((a, i) => (
              <i
                key={a}
                title={AGENT_META[a].name}
                className="-ml-1.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white text-[8.5px] font-bold text-white first:ml-0"
                style={{ background: HEAD_COLORS[i], zIndex: HEAD_AGENTS.length - i }}
              >
                {AGENT_META[a].glyph}
              </i>
            ))}
          </div>
        </div>
      </div>

      {/* ── chat-body ── */}
      <div
        ref={scrollRef}
        data-testid="chat-scroll-view"
        onScroll={handleScroll}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3.5"
      >
        {aiDown && (
          <div
            data-testid="chat-ai-down"
            className="flex items-center gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs leading-5 text-bad"
            role="alert"
          >
            <span className="min-w-0 flex-1">{aiDown}</span>
            {onAiRetry && (
              <button
                type="button"
                data-testid="chat-ai-retry"
                onClick={onAiRetry}
                className="shrink-0 rounded-md border border-bad/40 px-2 py-0.5 font-semibold transition hover:bg-bad/10"
              >
                重新检测
              </button>
            )}
          </div>
        )}
        {historyLoading && (
          <div
            data-testid="chat-history-loading"
            className="flex items-center gap-2 text-xs text-muted"
            role="status"
          >
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-violet" />
            正在载入历史对话…
          </div>
        )}
        {items.length === 0 && !stream && !generating && (
          <div className="text-xs leading-6 text-muted" data-chat-empty>
            {lockedReason
              ? (lockedHint ?? '还没有打开项目。先新建一个，或在左栏选择已有项目。')
              : '输入一句灵感（如「重生复仇都市女频」），主控 Agent 会理解拆解，并按当前阶段依次请你裁决确认门。'}
          </div>
        )}

        {items.map((item, index) =>
          item.role === 'user' ? (
            <div key={item.id} className="flex flex-row-reverse gap-[9px]">
              <Avatar user />
              <div className="relative max-w-[85%] rounded-[12px] rounded-tr-[4px] bg-violet px-3 py-[9px] text-[12px] leading-[1.6] text-white">
                <LabelTag label={item.label ?? { text: '用户', tone: 'user' }} side="right" />
                {item.text}
              </div>
            </div>
          ) : (
            <div key={item.id} className="flex gap-[9px]">
              <Avatar agent={item.agent} />
              {(() => {
                // B-35：其后出现新消息或忙态 → 选项置灰禁用；紧随的用户编号回复 → 对应选项 picked
                const consumed = busy || index < items.length - 1
                const next = items[index + 1]
                const pickedNum = next?.role === 'user' ? pickNumOf(next.text) : undefined
                // feature-010：紧随的用户回复与 chip 原文全等 → 该 chip picked（B-35 pickedNum 哲学的文字版）
                const pickedChip = next?.role === 'user' ? next.text?.trim() : undefined

                // B-56：有 segments → 在有序分段上剥离标签 / 选项协议块，保持交错顺序
                if (item.segments) {
                  const labelParsed = parseChatLabel(item.text ?? '')
                  const label = item.label ?? labelParsed.label
                  const opt = parseChatOptions(labelParsed.rest)

                  let labelStripped = false
                  const ordered = item.segments
                    .map(seg => {
                      if (seg.kind !== 'text') return seg
                      let text = seg.text
                      if (!labelStripped) {
                        const lp = parseChatLabel(text)
                        if (lp.label) {
                          text = lp.rest
                          labelStripped = true
                        } else if (lp.pending) {
                          text = lp.rest
                          labelStripped = true
                        }
                      }
                      return { ...seg, text }
                    })
                    .map(seg => {
                      if (seg.kind !== 'text') return seg
                      const op = parseChatOptions(seg.text)
                      // 闭合块由气泡级 trailing 统一渲染，段内剥离原文（块前/块后正文保留）；
                      // pending 块同样暂隐
                      return op.options || op.chips || op.pending ? { ...seg, text: op.rest } : seg
                    })
                    // 协议块剥离后可能出现的空 text 段移除
                    .filter(seg => seg.kind !== 'text' || seg.text.length > 0)

                  const trailing = (
                    <>
                      {opt.options && (
                        <OptionCard options={opt.options} disabled={consumed} pickedNum={pickedNum} onPick={pickOption} />
                      )}
                      {opt.chips && (
                        <ChipRow chips={opt.chips} disabled={consumed} pickedChip={pickedChip} onPick={pickOption} />
                      )}
                    </>
                  )

                  return (
                    <div className="relative max-w-[85%] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
                      <LabelTag label={label ?? defaultAgentLabel(item.agent)} side="left" />
                      <InterleavedContent
                        segments={ordered}
                        trailing={opt.options || opt.chips ? trailing : undefined}
                      />
                      {item.brief && <BriefCard rows={item.brief} />}
                      {item.trace && <TraceCard trace={item.trace} />}
                      <BubbleModelLine model={item.model ?? selectedModel} />
                    </div>
                  )
                }

                // 旧路径：无 segments 的存量消息（平铺 reasoning / tools）
                const parsed = item.label
                  ? { label: item.label, rest: item.text ?? '' }
                  : parseChatLabel(item.text ?? '')
                const opt = parseChatOptions(parsed.rest)
                return (
                  <div className="relative max-w-[85%] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
                    <LabelTag label={parsed.label ?? defaultAgentLabel(item.agent)} side="left" />
                    {item.reasoningBlocks
                      ? <ReasoningBlocks blocks={item.reasoningBlocks} />
                      : item.reasoning && <ReasoningBlocks blocks={[item.reasoning]} />}
                    {opt.rest && <MarkdownText text={opt.rest} />}
                    {opt.options && (
                      <OptionCard options={opt.options} disabled={consumed} pickedNum={pickedNum} onPick={pickOption} />
                    )}
                    {opt.chips && (
                      <ChipRow chips={opt.chips} disabled={consumed} pickedChip={pickedChip} onPick={pickOption} />
                    )}
                    {item.tools && item.tools.length > 0 && (
                      <ToolTrace tools={item.tools} />
                    )}
                    {item.brief && <BriefCard rows={item.brief} />}
                    {item.trace && <TraceCard trace={item.trace} />}
                    <BubbleModelLine model={item.model ?? selectedModel} />
                  </div>
                )
              })()}
            </div>
          ),
        )}

        {stream && (
          <div className="flex gap-[9px]">
            <Avatar agent="showrunner" />
            <div className="relative max-w-[85%] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
              {(() => {
                // B-56：从全文解析标签 / 选项（气泡级标签与末尾选项卡）；
                // 段内文本同步剥离协议块，保持「推理→工具→推理→工具」的交错顺序
                const parsed = parseChatLabel(turnText(stream))
                const opt = parseChatOptions(parsed.rest)

                const rawSegments = turnSegments(stream)
                let labelStripped = false
                const ordered = rawSegments
                  .map(seg => {
                    if (seg.kind !== 'text') return seg
                    let text = seg.text
                    if (!labelStripped) {
                      const lp = parseChatLabel(text)
                      if (lp.label || lp.pending) {
                        text = lp.rest
                        labelStripped = true
                      }
                    }
                    return { ...seg, text }
                  })
                  .map(seg => {
                    if (seg.kind !== 'text') return seg
                    const op = parseChatOptions(seg.text)
                    return op.options || op.chips || op.pending ? { ...seg, text: op.rest } : seg
                  })
                  .filter(seg => seg.kind !== 'text' || seg.text.length > 0)

                // 流式进行中选项只展不点（busy 天然为真），回合落定入 items 后才可点
                const trailing = (
                  <>
                    {opt.options && <OptionCard options={opt.options} disabled onPick={pickOption} />}
                    {opt.chips && <ChipRow chips={opt.chips} disabled onPick={pickOption} />}
                  </>
                )
                return (
                  <>
                    <LabelTag label={parsed.label ?? { text: '主控 Agent', tone: 'ai' }} side="left" />
                    <InterleavedContent
                      segments={ordered}
                      streaming
                      running={stream.status === 'running'}
                      trailing={opt.options || opt.chips ? trailing : undefined}
                    />
                    <BubbleModelLine model={selectedModel} />
                  </>
                )
              })()}
              {pendingGate && (
                <GateCardView gate={pendingGate} deciding={deciding} onDecide={onDecide} />
              )}
              {pendingGate?.gateId === '0-final' && pendingGate.status === 'pending' && <GateHint />}
            </div>
          </div>
        )}

        {/* feature-809 §3.3：发送→首事件窗口占位气泡（与流式气泡同壳），与 {stream && …} 块并列、互斥 */}
        {!stream && generating && (
          <div data-testid="chat-turn-placeholder" className="flex gap-[9px]">
            <Avatar agent="showrunner" />
            <div className="relative max-w-[85%] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
              <LabelTag label={{ text: '主控 Agent', tone: 'ai' }} side="left" />
              <TypingDots />
              <BubbleModelLine model={selectedModel} />
            </div>
          </div>
        )}

        {!stream && pendingGate && (
          <div className="flex gap-[9px]">
            <Avatar agent="showrunner" />
            <div className="relative max-w-[85%]">
              <LabelTag label={{ text: '主控 Agent', tone: 'ai' }} side="left" />
              <GateCardView gate={pendingGate} deciding={deciding} onDecide={onDecide} />
              {pendingGate.gateId === '0-final' && pendingGate.status === 'pending' && <GateHint />}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs leading-5 text-bad">
            {error}
          </div>
        )}
      </div>

      {/* ── chat-input ── */}
      <div className="border-t border-line px-3.5 pb-3.5 pt-2.5">
        <div className="rounded-xl bg-[#F4F5FA] px-[11px] py-[9px]">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            disabled={!!aiDown || !!lockedReason}
            placeholder={lockedReason ?? (aiDown ? 'AI 服务不可用，恢复后可继续对话' : '描述创作目标，或 / 唤起 Skill…')}
            className="h-[34px] w-full resize-none border-none bg-transparent text-[12px] text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              title="Skill"
              className="grid h-6 w-6 place-items-center rounded-[7px] text-muted transition hover:bg-[#E8EAF3] hover:text-violet"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5">
                <path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" />
              </svg>
            </button>
            <button
              type="button"
              title="资产"
              className="grid h-6 w-6 place-items-center rounded-[7px] text-muted transition hover:bg-[#E8EAF3] hover:text-violet"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </button>
            <select
              aria-label="对话模型"
              title={selectedModel ? chatModelLabel(selectedModel) : '请先在 AI 服务设置中配置模型'}
              value={selectedModel ? chatModelKey(selectedModel) : ''}
              disabled={modelOptions.length === 0}
              onChange={e => {
                const next = modelOptions.find(option => chatModelKey(option) === e.target.value)
                if (next) onModelChange(next)
              }}
              className="h-6 min-w-0 max-w-[160px] flex-1 truncate rounded-[7px] border border-line bg-white px-1.5 text-[10px] font-semibold text-muted outline-none transition focus:border-violet disabled:cursor-not-allowed disabled:opacity-70"
            >
              {modelOptions.length === 0 ? (
                <option value="">请先在 AI 服务设置中配置模型</option>
              ) : (
                modelOptions.map(option => (
                  <option key={chatModelKey(option)} value={chatModelKey(option)}>
                    {chatModelLabel(option)}
                  </option>
                ))
              )}
            </select>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-soft px-2 py-[3px] text-[9.5px] font-semibold text-[#5A4BC4]">
              <span className="h-[5px] w-[5px] rounded-full bg-violet" />
              H3 自动选配
            </span>
            {(sending || generating) && onStop ? (
              <button
                type="button"
                title="停止生成"
                data-testid="chat-stop"
                onClick={onStop}
                className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-bad text-white transition hover:opacity-90"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-[11px] w-[11px]">
                  <rect x="5" y="5" width="14" height="14" rx="2.5" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                title="发送"
                data-testid="chat-send"
                onClick={submit}
                disabled={sending || generating || historyLoading || !!aiDown || !!lockedReason || !draft.trim() || !selectedModel}
                className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-violet text-white transition hover:bg-[#5B4BD6] disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]">
                  <path d="m22 2-7 20-4-9-9-4z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
