// feature-019 · 对话驱动区（契约 §3.3 / §4）
// 多 Agent 结构化对话：用户气泡 + Agent 气泡（文本 / 立项单卡 / 工具轨迹卡）+ 内嵌 GateCard。
// 视觉对齐原型 #rightChat：28px 头像、#F4F5FA 气泡、brief-card / trace / gate 卡。
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { turnReasoning, turnText, type StreamingTurn, type ToolView } from '../lib/chat-runtime'
import type { CanvasGate } from '@shared/types'
import GateCardView from './GateCardView'
import { FAMILY_GRAD, PREVIEW_URL } from './VisualCatalog'
import { getStyleEntry, useStyleCatalog } from './style-catalog-store'

// ── Agent 气泡 Markdown 渲染（2026-10-15，K9 批准 react-markdown + remark-gfm；仅 Agent 侧） ──
// 默认不渲染原始 HTML（XSS 面为零）；链接统一新窗打开，由主进程 setWindowOpenHandler 转交系统浏览器。
// 排版规则见 index.css `.md-bubble`；流式分片对未闭合标记天然容错（下一片到达即重解析）。
function MarkdownText({ text }: { text: string }) {
  return (
    <div className="md-bubble">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" className="text-violet underline underline-offset-2">
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="mt-2 text-[13.5px] font-extrabold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-2 text-[13px] font-bold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-1.5 text-[12.5px] font-bold first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1 ml-[18px] list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 ml-[18px] list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 marker:text-muted">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-line pl-2 text-muted">{children}</blockquote>
          ),
          hr: () => <hr className="my-2 border-line" />,
          table: ({ children }) => (
            <div className="my-1.5 overflow-x-auto">
              <table className="border-collapse text-[11px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-line px-1.5 py-0.5 font-bold">{children}</th>,
          td: ({ children }) => <td className="border border-line px-1.5 py-0.5">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

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
  agent?: AgentId // agent 消息的发言身份，默认 showrunner
  brief?: BriefRow[] // 立项单卡（kv）
  trace?: TraceData // 工具轨迹卡
  label?: ChatLabel // 显式气泡标签；缺省时 agent 消息按前缀约定解析、用户消息固定「用户」
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

// ── 对话内选项卡（B-35 / showrunner 职责纪律 10 / 原型 .cmsg .opts） ──
// 约定：Agent 消息末尾输出 `【选项】…【/选项】`（纯文本行）或 `【风格选项】…【/风格选项】`（裸风格 ID 行），
// 渲染层剥离为可点按钮；点击 = 代发该选项编号（与手打「1」同一路径，quote 组装分流照旧）。
export interface ChatOption {
  num: string // 编号（"1"…"99" / "A"…"Z"），点击时代发
  text: string // 纯文本选项文字；风格选项为原始行内容
  styleId?: string // 【风格选项】块中命中谱系的 ID（未知 ID 降级纯文本选项）
}

const OPT_LINE = /^\s*(\d{1,2}|[A-Za-z])[.、．]\s*(\S.*)$/

// 开/闭标签只在行首识别（正文中途提及约定文字不误判）；已闭合块必须位于消息末尾（允许尾部空白）。
export function parseChatOptions(text: string): {
  rest: string
  options?: ChatOption[]
  style?: boolean
  pending?: boolean
} {
  const trimmed = text.replace(/\s+$/, '')
  // ① 已闭合：消息以闭标签结尾
  const closeM = /【\/(风格选项|选项)】$/.exec(trimmed)
  if (closeM) {
    const openTag = `【${closeM[1]}】`
    const openIdx = trimmed.lastIndexOf(openTag)
    if (openIdx >= 0 && (openIdx === 0 || trimmed[openIdx - 1] === '\n')) {
      const body = trimmed.slice(openIdx + openTag.length, trimmed.length - closeM[0].length)
      const options: ChatOption[] = []
      for (const line of body.split('\n')) {
        if (!line.trim()) continue
        const m = OPT_LINE.exec(line)
        if (!m) return { rest: text } // 任一行失配：整块不识别、原样显示（暴露格式错误）
        options.push({ num: m[1], text: m[2].trim() })
      }
      if (options.length < 2) return { rest: text }
      const style = closeM[1] === '风格选项'
      if (style) {
        for (const o of options) {
          const idM = /^([A-E]\d{1,2})$/.exec(o.text)
          if (idM && getStyleEntry(idM[1])) o.styleId = idM[1]
        }
      }
      return { rest: trimmed.slice(0, openIdx).replace(/\s+$/, ''), options, style }
    }
    return { rest: text }
  }
  // ② 流式未闭合：最后一个行首开标签之后没有对应闭标签 → pending（块内容暂不显示，等闭合）
  const openRe = /(^|\n)(【(风格选项|选项)】)/g
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
  if (tail && ('【选项】'.startsWith(tail[1]) || '【风格选项】'.startsWith(tail[1]))) {
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

/** 行内工具状态行（契约 §3.2）：running=spinner+「执行中」；completed=✓+耗时；error=✗+errorText 单行省略 */
function ToolRow({ tool }: { tool: ToolView }) {
  const duration = toolDurationLabel(tool)
  return (
    <div data-testid="chat-tool-row" className="flex items-center gap-1.5 text-[11px] leading-4 text-muted">
      {tool.status === 'running' && (
        <>
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-line border-t-violet" />
          <span className="truncate">{tool.tool}</span>
          <span className="shrink-0">执行中</span>
        </>
      )}
      {tool.status === 'completed' && (
        <>
          <span className="shrink-0 text-ok">✓</span>
          <span className="truncate">{tool.tool}</span>
          {duration && <span className="shrink-0">{duration}</span>}
        </>
      )}
      {tool.status === 'error' && (
        <>
          <span className="shrink-0 text-bad">✗</span>
          <span className="truncate">{tool.tool}</span>
          <span className="truncate text-bad" title={tool.errorText || '执行失败'}>
            {tool.errorText || '执行失败'}
          </span>
        </>
      )}
    </div>
  )
}

function AgentTurn({ turn, text }: { turn: StreamingTurn; text: string }) {
  const reasoning = turnReasoning(turn)
  const tools = Object.values(turn.tools)
  return (
    <div className="space-y-2">
      {reasoning && (
        <details className="rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-muted">
          <summary className="cursor-pointer select-none">推理过程</summary>
          <p className="mt-1 whitespace-pre-wrap">{reasoning}</p>
        </details>
      )}
      {text && (
        <>
          <MarkdownText text={text} />
          {showStreamCursor(turn, text) && (
            <span data-testid="chat-stream-cursor" className="animate-cursor-blink text-violet">▍</span>
          )}
        </>
      )}
      {tools.length > 0 && (
        <div className="space-y-1">
          {tools.map(tool => (
            <ToolRow key={tool.callId} tool={tool} />
          ))}
        </div>
      )}
      {!text && turn.status === 'running' && (
        <span className="inline-flex items-center gap-2 text-muted">
          <TypingDots />
          主控 Agent 正在思考…
        </span>
      )}
    </div>
  )
}

export default function ChatComposer({
  items, stream, pendingGate, deciding, sending, generating = false, error, onSend, onDecide, onStop, historyLoading,
}: Props) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items, stream, pendingGate])

  const submit = (): void => {
    const text = draft.trim()
    if (!text || sending || generating || historyLoading) return
    setDraft('')
    onSend(text)
  }

  // B-35：选项点击 = 代发编号（与手打同路径）；忙态（发送/生成/回放/流式进行中）禁点
  const busy = sending || generating || historyLoading || !!stream
  const pickOption = (num: string): void => {
    if (busy) return
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
      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3.5">
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
          <div className="text-xs leading-6 text-muted">
            输入一句灵感（如「重生复仇都市女频」），主控 Agent 会理解拆解，并按当前阶段依次请你裁决确认门。
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
                const parsed = item.label
                  ? { label: item.label, rest: item.text ?? '' }
                  : parseChatLabel(item.text ?? '')
                const opt = parseChatOptions(parsed.rest)
                // B-35：其后出现新消息或忙态 → 选项置灰禁用；紧随的用户编号回复 → 对应选项 picked
                const consumed = busy || index < items.length - 1
                const next = items[index + 1]
                const pickedNum = next?.role === 'user' ? pickNumOf(next.text) : undefined
                return (
                  <div className="relative max-w-[85%] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
                    {parsed.label && <LabelTag label={parsed.label} side="left" />}
                    {opt.rest && <MarkdownText text={opt.rest} />}
                    {opt.options && (
                      <OptionCard options={opt.options} disabled={consumed} pickedNum={pickedNum} onPick={pickOption} />
                    )}
                    {item.brief && <BriefCard rows={item.brief} />}
                    {item.trace && <TraceCard trace={item.trace} />}
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
                const parsed = parseChatLabel(turnText(stream))
                const opt = parseChatOptions(parsed.rest)
                return (
                  <>
                    {parsed.label && <LabelTag label={parsed.label} side="left" />}
                    <AgentTurn turn={stream} text={opt.rest} />
                    {/* 流式进行中选项只展不点（busy 天然为真），回合落定入 items 后才可点 */}
                    {opt.options && <OptionCard options={opt.options} disabled onPick={pickOption} />}
                  </>
                )
              })()}
              {pendingGate && (
                <GateCardView gate={pendingGate} deciding={deciding} onDecide={onDecide} />
              )}
            </div>
          </div>
        )}

        {/* feature-809 §3.3：发送→首事件窗口占位气泡（与流式气泡同壳），与 {stream && …} 块并列、互斥 */}
        {!stream && generating && (
          <div data-testid="chat-turn-placeholder" className="flex gap-[9px]">
            <Avatar agent="showrunner" />
            <div className="relative max-w-[85%] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
              <TypingDots />
            </div>
          </div>
        )}

        {!stream && pendingGate && (
          <div className="flex gap-[9px]">
            <Avatar agent="showrunner" />
            <div className="max-w-[85%]">
              <GateCardView gate={pendingGate} deciding={deciding} onDecide={onDecide} />
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
            placeholder="描述创作目标，或 / 唤起 Skill…"
            className="h-[34px] w-full resize-none border-none bg-transparent text-[12px] text-ink outline-none placeholder:text-muted"
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
            <span className="flex items-center gap-1 rounded-full bg-violet-soft px-2 py-[3px] text-[9.5px] font-semibold text-[#5A4BC4]">
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
                disabled={sending || generating || historyLoading || !draft.trim()}
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
