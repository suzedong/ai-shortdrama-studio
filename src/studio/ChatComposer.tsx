// feature-019 · 对话驱动区（契约 §3.3 / §4）
// 多 Agent 结构化对话：用户气泡 + Agent 气泡（文本 / 创意简报卡 / 工具轨迹卡）+ 内嵌 GateCard。
// 视觉对齐原型 #rightChat：28px 头像、#F4F5FA 气泡、brief-card / trace / gate 卡。
import { useEffect, useRef, useState } from 'react'

import { turnReasoning, turnText, type StreamingTurn } from '../lib/chat-runtime'
import type { CanvasGate } from '@shared/types'
import GateCardView from './GateCardView'

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
  brief?: BriefRow[] // 创意简报卡（kv）
  trace?: TraceData // 工具轨迹卡
}

interface Props {
  items: ChatItem[]
  stream: StreamingTurn | null
  pendingGate: CanvasGate | null
  deciding: boolean
  sending: boolean
  error: string | null
  onSend: (text: string) => void
  onDecide: (decision: 'approved' | 'rejected', note?: string) => void
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
      text: '已理解你的创作目标，先给出创意简报，确认后我就拆任务开工。',
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

function AgentTurn({ turn }: { turn: StreamingTurn }) {
  const text = turnText(turn)
  const reasoning = turnReasoning(turn)
  return (
    <div className="space-y-2">
      {reasoning && (
        <details className="rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-muted">
          <summary className="cursor-pointer select-none">推理过程</summary>
          <p className="mt-1 whitespace-pre-wrap">{reasoning}</p>
        </details>
      )}
      {text && <p className="whitespace-pre-wrap">{text}</p>}
      {!text && !reasoning && turn.status === 'running' && (
        <span className="text-muted">主控 Agent 正在思考…</span>
      )}
    </div>
  )
}

export default function ChatComposer({
  items, stream, pendingGate, deciding, sending, error, onSend, onDecide,
}: Props) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items, stream, pendingGate])

  const submit = (): void => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    onSend(text)
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
        {items.length === 0 && !stream && (
          <div className="text-xs leading-6 text-muted">
            输入一句灵感（如「重生复仇都市女频」），主控 Agent 会理解拆解，并按当前阶段依次请你裁决确认门。
          </div>
        )}

        {items.map(item =>
          item.role === 'user' ? (
            <div key={item.id} className="flex flex-row-reverse gap-[9px]">
              <Avatar user />
              <div className="max-w-[280px] rounded-[12px] rounded-tr-[4px] bg-violet px-3 py-[9px] text-[12px] leading-[1.6] text-white">
                {item.text}
              </div>
            </div>
          ) : (
            <div key={item.id} className="flex gap-[9px]">
              <Avatar agent={item.agent} />
              <div className="max-w-[280px] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
                {item.text && <p className="whitespace-pre-wrap">{item.text}</p>}
                {item.brief && <BriefCard rows={item.brief} />}
                {item.trace && <TraceCard trace={item.trace} />}
              </div>
            </div>
          ),
        )}

        {stream && (
          <div className="flex gap-[9px]">
            <Avatar agent="showrunner" />
            <div className="max-w-[280px] rounded-tr-[12px] rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] bg-[#F4F5FA] px-3 py-[9px] text-[12px] leading-[1.6] text-ink">
              <AgentTurn turn={stream} />
              {pendingGate && (
                <GateCardView gate={pendingGate} deciding={deciding} onDecide={onDecide} />
              )}
            </div>
          </div>
        )}

        {!stream && pendingGate && (
          <div className="flex gap-[9px]">
            <Avatar agent="showrunner" />
            <div className="max-w-[280px]">
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
            <button
              type="button"
              title="发送"
              onClick={submit}
              disabled={sending || !draft.trim()}
              className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-violet text-white transition hover:bg-[#5B4BD6] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]">
                <path d="m22 2-7 20-4-9-9-4z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
