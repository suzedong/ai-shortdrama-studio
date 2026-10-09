// feature-019 · 对话驱动区（契约 §3.3 / §4）
// 用户气泡 + showrunner 流式文本（turnText）+ 内嵌 GateCard；发送指定 agent:'showrunner'。
import { useEffect, useRef, useState } from 'react'

import { turnReasoning, turnText, type StreamingTurn } from '../lib/chat-runtime'
import type { CanvasGate } from '@shared/types'
import GateCardView from './GateCardView'

export interface ChatItem {
  id: string
  role: 'user' | 'agent'
  text: string
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
      {text && <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{text}</p>}
      {!text && !reasoning && turn.status === 'running' && (
        <span className="text-xs text-muted">showrunner 正在思考…</span>
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
    <div className="flex h-full flex-col rounded-2xl border border-line bg-white shadow-card">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {items.length === 0 && !stream && (
          <div className="text-xs leading-6 text-muted">
            输入一句灵感（如「重生复仇都市女频」），showrunner 会理解拆解，并按当前阶段依次请你裁决确认门。
          </div>
        )}

        {items.map(item =>
          item.role === 'user' ? (
            <div key={item.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-violet px-3 py-2 text-sm leading-6 text-white">
                {item.text}
              </div>
            </div>
          ) : (
            <div key={item.id} className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-line bg-canvas px-3 py-2">
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{item.text}</p>
              </div>
            </div>
          ),
        )}

        {stream && (
          <div className="flex justify-start">
            <div className="max-w-[88%] space-y-2 rounded-2xl rounded-bl-sm border border-line bg-canvas px-3 py-2">
              <AgentTurn turn={stream} />
              {pendingGate && (
                <GateCardView gate={pendingGate} deciding={deciding} onDecide={onDecide} />
              )}
            </div>
          </div>
        )}

        {!stream && pendingGate && (
          <div className="flex justify-start">
            <div className="max-w-[88%]">
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

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
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
            placeholder="描述你的短剧灵感…（Enter 发送，Shift+Enter 换行）"
            className="max-h-28 flex-1 resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending || !draft.trim()}
            className="rounded-lg bg-violet px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {sending ? '发送中' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
