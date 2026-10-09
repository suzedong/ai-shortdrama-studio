// feature-022 · 新壳转正工作台（OD §1 三栏布局）
// 左栏 ProjectNav / 中栏 CanvasBoard(+StudioViewer) / 右栏 ChatComposer(+GateCardView)；
// 无 RootSwitch、无 onBackLegacy、无旧壳状态机。
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Canvas, CanvasGate, CanvasNode } from '@shared/types'
import { reduceRuntimeEvent, turnText, type StreamingTurn } from '../lib/chat-runtime'
import CanvasBoard, { kindLabel } from './CanvasBoard'
import ChatComposer, { type ChatItem } from './ChatComposer'
import ProjectNav from './ProjectNav'
import StudioViewer from './StudioViewer'

function emptyCanvas(): Canvas {
  return {
    schemaVersion: 2,
    projectId: '',
    title: '',
    nodes: [],
    edges: [],
    gates: [],
    updatedAt: new Date().toISOString(),
  }
}

function pendingFromCanvas(canvas: Canvas): CanvasGate | null {
  return canvas.gates.find(g => g.status === 'pending') ?? null
}

export default function StudioApp() {
  const [canvas, setCanvas] = useState<Canvas>(emptyCanvas)
  const [items, setItems] = useState<ChatItem[]>([])
  const [stream, setStream] = useState<StreamingTurn | null>(null)
  const [pendingGate, setPendingGate] = useState<CanvasGate | null>(null)
  const [sending, setSending] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerNode, setViewerNode] = useState<CanvasNode | null>(null)

  const streamRef = useRef<StreamingTurn | null>(null)
  streamRef.current = stream
  const projectIdRef = useRef('')

  // ---- runtime 事件 → 流式归约；轮次定稿时落为历史消息 ----
  useEffect(() => {
    const off = window.api.runtime.onEvent(ev => {
      const prev = streamRef.current
      const next = reduceRuntimeEvent(prev, ev)
      if (next !== prev) {
        streamRef.current = next
        setStream(next)
        if (prev && prev.status === 'running' && next && next.status !== 'running') {
          const text = turnText(next)
          if (text) setItems(p => [...p, { id: next.messageId, role: 'agent', text }])
          streamRef.current = null
          setStream(null)
        }
      }
    })
    return off
  }, [])

  // ---- 画布初值 + 订阅；项目切换时 canvas:changed 自动刷新 ----
  useEffect(() => {
    let alive = true
    const offChange = window.api.canvas.onChange(c => {
      setCanvas(c)
      setPendingGate(pendingFromCanvas(c))
      // 仅切项目（projectId 变化）时关闭 viewer（契约 §6.3）；常规节点/门推送不关
      if (projectIdRef.current && c.projectId !== projectIdRef.current) {
        setViewerNode(null)
      }
      projectIdRef.current = c.projectId
    })
    window.api.canvas.get()
      .then(c => {
        if (!alive) return
        setCanvas(c)
        setPendingGate(pendingFromCanvas(c))
        projectIdRef.current = c.projectId
      })
      .catch(e => {
        console.error('canvas.get failed', e)
        if (alive) setError('画布加载失败，请重试。')
      })
    window.api.canvas.subscribe().catch(e => console.error('canvas.subscribe failed', e))

    return () => {
      alive = false
      offChange()
      window.api.canvas.unsubscribe().catch(e => console.error('canvas.unsubscribe failed', e))
    }
  }, [])

  // ---- 门变更（裁决 / 重挂）----
  useEffect(() => {
    const off = window.api.gate.onChanged(({ gate }) => {
      setPendingGate(gate.status === 'pending' ? gate : null)
    })
    return off
  }, [])

  // ---- 发送一轮：惰性确保 runtime + session，指定 showrunner ----
  const handleSend = useCallback(async (text: string) => {
    setError(null)
    setSending(true)
    setItems(p => [...p, { id: `u-${Date.now()}`, role: 'user', text }])
    try {
      const st = await window.api.runtime.status()
      if (st.state !== 'running') {
        const started = await window.api.runtime.start()
        if (started.state !== 'running') {
          throw new Error(started.error?.message || '运行时启动失败，请稍后重试。')
        }
      }
      const session = await window.api.runtime.createSession()
      await window.api.runtime.subscribe(session.id)
      await window.api.runtime.promptAsync({ sessionId: session.id, text, agent: 'showrunner' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败，请重试。')
    } finally {
      setSending(false)
    }
  }, [])

  // ---- 门裁决 ----
  const handleDecide = useCallback(async (decision: 'approved' | 'rejected', note?: string) => {
    if (!pendingGate) return
    setError(null)
    setDeciding(true)
    try {
      await window.api.gate.decide({ gateId: pendingGate.gateId, decision, note })
    } catch (e) {
      setError(e instanceof Error ? e.message : '裁决提交失败，请重试。')
    } finally {
      setDeciding(false)
    }
  }, [pendingGate])

  // ---- 节点查看 ----
  const handleOpenNode = useCallback((node: CanvasNode) => setViewerNode(node), [])
  const handleCloseViewer = useCallback(() => setViewerNode(null), [])

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏：无返回旧版按钮 */}
      <div className="flex items-center px-5 py-3">
        <span className="text-sm font-semibold text-ink">短剧创作工作台</span>
        <span className="ml-2 text-xs text-muted">{canvas.title || '未命名项目'}</span>
      </div>

      {/* 三栏：lg 三栏 / 单列堆叠 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-5 pb-4 lg:grid-cols-[14rem_1fr_26rem]">
        {/* 左栏 */}
        <div className="min-h-0">
          <ProjectNav activeProjectId={canvas.projectId} />
        </div>

        {/* 中栏 */}
        <div className="relative min-h-0">
          <CanvasBoard canvas={canvas} onOpenNode={handleOpenNode} />
          {viewerNode && (
            <StudioViewer
              node={viewerNode}
              kindLabel={kindLabel(viewerNode.kind)}
              onClose={handleCloseViewer}
            />
          )}
        </div>

        {/* 右栏 */}
        <div className="min-h-0">
          <ChatComposer
            items={items}
            stream={stream}
            pendingGate={pendingGate}
            deciding={deciding}
            sending={sending}
            error={error}
            onSend={handleSend}
            onDecide={handleDecide}
          />
        </div>
      </div>
    </div>
  )
}
