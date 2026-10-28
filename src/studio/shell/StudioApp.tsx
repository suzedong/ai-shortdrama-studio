// 新壳工作台（三栏布局 + 顶栏/底栏）
// 布局：顶栏 → [图标轨 | 左栏 · 资源库/流程导航 双视图 | 中栏画布 | 右栏对话] → 底栏状态条
// 左栏对齐原型方案 A · 图标轨 4 子面板 + lp-seg 一级 toggle + 流程导航 8 步面板
// 所有 IPC 与组件接线保持不变；仅把视觉骨架对齐高保真原型。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Canvas, CanvasGate, CanvasNode, StepId } from '@shared/types'
import { reduceRuntimeEvent, turnText, type StreamingTurn } from '../../lib/chat-runtime'
import { replayMessages } from '../../lib/history-replay'
import CanvasBoard, { kindLabel, type NodeAction } from '../canvas/CanvasBoard'
import ChatComposer, { demoChatItems, type ChatItem } from '../chat/ChatComposer'
import CaptureBar from '../stage0/CaptureBar'
import ProjectNav, { type ProjectNavHandle } from './ProjectNav'
import { AssetsPanel, PluginsPanel, SkillsPanel } from './LeftPanels'
import StageNavPanel from '../canvas/StageNavPanel'
import { deriveBriefDisplay, stage0Tooltip } from '../canvas/brief-display'
import Stage0View from '../stage0/Stage0View'
import StudioViewer from '../viewer/StudioViewer'
import RealignConfirm, { buildRealignPrompt } from '../canvas/RealignConfirm'
import ImpactPanel from '../impact/ImpactPanel'
import {
  fromReportFile,
  fromUpdateResult,
  type BriefUpdatePayload,
  type ImpactReportPayload,
  type ImpactView,
} from '../impact/impact-select'
import VisualCatalog from '../style/VisualCatalog'
import WindowControls from './WindowControls'

type CenterView = 'dag' | 'stage0'

type LeftView = 'resource' | 'nav'
type PanTab = 'projects' | 'skills' | 'assets' | 'plugins'

const PAN_TAB_META: Record<PanTab, { title: string; icon: JSX.Element }> = {
  projects: {
    title: '项目',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  skills: {
    title: 'Skill',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" />
      </svg>
    ),
  },
  assets: {
    title: '资产',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),
  },
  plugins: {
    title: '插件',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M14 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3H7a1 1 0 0 0-1 1v3H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h3v3a1 1 0 0 0 1 1h3v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3h3a1 1 0 0 0 1-1v-3h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-3V8a1 1 0 0 0-1-1z" />
      </svg>
    ),
  },
}

const PAN_TAB_TITLE: Record<PanTab, string> = {
  projects: '项目库',
  skills:   'Skill 广场',
  assets:   '资产中心',
  plugins:  '专业插件',
}

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

// 浏览器预览（dev mock）下铺演示消息；Electron 真实环境始终空态等待会话
// 惰性求值：ES 模块导入先于 main.tsx 安装 mock，模块顶层会读到 undefined
function devMockActive(): boolean {
  return Boolean((window.api as unknown as { __devMock?: boolean } | undefined)?.__devMock)
}

export default function StudioApp() {
  // feature-804：平台形态（契约 §7）；防御式访问，部分桩/缺段按 win32 渲染
  const platform = window.api.window?.platform ?? 'win32'
  const [canvas, setCanvas] = useState<Canvas>(emptyCanvas)
  const [items, setItems] = useState<ChatItem[]>(() => (devMockActive() ? demoChatItems() : []))
  const [stream, setStream] = useState<StreamingTurn | null>(null)
  const [pendingGate, setPendingGate] = useState<CanvasGate | null>(null)
  const [sending, setSending] = useState(false)
  // feature-808 D-006：生成态独立于 sending（promptAsync 仅代表 HTTP accepted，
  // 流式可能数秒后才开始）；由流式事件置位/复位，驱动停止钮持续可达
  const [generating, setGenerating] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerNode, setViewerNode] = useState<CanvasNode | null>(null)
  // feature-007：重开脏产物的三选一确认节点（非空即弹 RealignConfirm）
  const [confirmNode, setConfirmNode] = useState<CanvasNode | null>(null)
  // feature-011：影响评估面板（非阻断弹层，两入口共用；data=null 为手动入口读取失败的降级态）
  const [impactPanel, setImpactPanel] = useState<{ data: ImpactView | null; degrade?: string } | null>(null)
  const [leftView, setLeftView] = useState<LeftView>('resource')
  const [panTab, setPanTab] = useState<PanTab>('projects')
  const [leftQuery, setLeftQuery] = useState('')
  const [activeStep, setActiveStep] = useState<StepId | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  // B-31：rail 底部 AI 圆标 → 系统菜单（收纳使用指南/导出入口）
  const [sysMenuOpen, setSysMenuOpen] = useState(false)
  const [centerView, setCenterView] = useState<CenterView>('dag')
  const [toast, setToast] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null)
  const projectNavRef = useRef<ProjectNavHandle>(null)

  const streamRef = useRef<StreamingTurn | null>(null)
  streamRef.current = stream
  const projectIdRef = useRef('')
  // feature-808：当前项目绑定的会话 id（事件过滤、发送复用的事实源）
  const activeSessionIdRef = useRef<string | null>(null)
  // 防快速切项目时旧回放覆盖新右栏：每次装载递增，迟到结果按序号/ projectId 丢弃
  const projectSessionSeqRef = useRef(0)
  // SSE 全程只订阅一次（无参订阅，首发送时惰性触发）
  const subscribedRef = useRef(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  // 入口动作 · 用户原话：会话首条用户消息（Stage0View 入口卡数据源）
  const entryQuote = useMemo(() => items.find(i => i.role === 'user')?.text?.trim() ?? '', [items])

  // 右栏对话区宽度：左缘拖拽调节（300–640px），localStorage 持久化
  const CHAT_WIDTH_KEY = 'studio.chatWidth'
  const [chatWidth, setChatWidth] = useState(() => {
    const v = Number(localStorage.getItem('studio.chatWidth'))
    return Number.isFinite(v) && v >= 300 && v <= 640 ? v : 380
  })
  const chatDragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const onChatResizerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    chatDragRef.current = { startX: e.clientX, startWidth: chatWidth }
  }
  const onChatResizerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = chatDragRef.current
    if (!d) return
    setChatWidth(Math.min(640, Math.max(300, d.startWidth + (d.startX - e.clientX))))
  }
  const onChatResizerUp = () => {
    if (!chatDragRef.current) return
    chatDragRef.current = null
    localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth))
  }

  // 系统菜单：点击菜单外任意处关闭
  useEffect(() => {
    if (!sysMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-sys-menu-root]')) setSysMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [sysMenuOpen])

  // ---- runtime 事件 → 流式归约；轮次定稿时落为历史消息 ----
  // feature-808：归约前先按绑定会话严格归属（R5 / D-007）——
  // 带 sessionId 的事件必须命中当前绑定 sid，否则一律丢弃；
  // 无 sessionId 的 runtime 级事件（connected 等）放行（reducer 对其 no-op）。
  // 注意：当前项目 sid=null（无绑定空项目）时，他会话事件 evSid!==undefined 同样丢弃。
  useEffect(() => {
    const off = window.api.runtime.onEvent(ev => {
      const sid = activeSessionIdRef.current
      const evSid = 'sessionId' in ev ? ev.sessionId : undefined
      if (evSid !== undefined && evSid !== sid) return
      // D-006：归属事件中的终态无条件复位 generating（不能只挂定稿分支——
      // session.idle 在 turn=null 时 reducer 返回 null，无流式分片的空转 idle 也须复位）
      if (ev.type === 'session.idle' || ev.type === 'runtime.error') {
        setGenerating(false)
      }
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
    return () => {
      off()
      // feature-808：SSE 全程订阅一次，卸载时退订
      window.api.runtime.unsubscribe().catch(e => console.error('runtime.unsubscribe failed', e))
    }
  }, [])

  // feature-808：回放装载（§4.2）。session 序号过期一律丢弃；404 → 清绑定 + info toast 降级
  const loadReplay = useCallback(async (sessionId: string, seq: number, projectId: string) => {
    const stale = () =>
      seq !== projectSessionSeqRef.current || projectId !== projectIdRef.current
    try {
      const records = await window.api.runtime.sessionMessages(sessionId) // withRuntime 惰性自启
      if (stale()) return
      setItems(replayMessages(records))
    } catch (e) {
      if (stale()) return
      const code = (e as { name?: string; code?: string } | null)?.name
        ?? (e as { code?: string } | null)?.code
      if (code === 'SESSION_NOT_FOUND') {
        try {
          await window.api.activeSession(null)
        } catch (clearErr) {
          console.error('activeSession(null) failed', clearErr)
        }
        if (stale()) return
        activeSessionIdRef.current = null
        setItems([])
        setToast({ tone: 'info', text: '上次的会话记录已不可用，已为你开始新对话。' })
      } else {
        // 绑定保留，不锁死；用户仍可重试发送
        setError('历史对话加载失败，请稍后重试。')
      }
    } finally {
      if (!stale()) setHistoryLoading(false)
    }
  }, [])

  // feature-808：切项目会话装载（§4.1）。唯一装载信号：canvas projectId 变化
  // （覆盖启动恢复 / 左栏切换 / 新建三入口）；dev-mock 演示态不介入
  const onProjectSessionChange = useCallback((projectId: string) => {
    if (devMockActive()) return
    const seq = ++projectSessionSeqRef.current
    setItems([])
    streamRef.current = null
    setStream(null)
    setGenerating(false) // D-006：切项目清场，停止钮随当前视图复位
    activeSessionIdRef.current = null
    if (!projectId) return
    setHistoryLoading(true)
    window.api.activeSession()
      .then(bind => {
        if (seq !== projectSessionSeqRef.current || projectId !== projectIdRef.current) return
        activeSessionIdRef.current = bind.sessionId
        if (bind.sessionId) {
          void loadReplay(bind.sessionId, seq, projectId)
        } else {
          setHistoryLoading(false) // 空态：不启动 runtime（AC1）
        }
      })
      .catch(e => {
        if (seq !== projectSessionSeqRef.current || projectId !== projectIdRef.current) return
        console.error('activeSession read failed', e)
        setHistoryLoading(false)
      })
  }, [loadReplay])

  // ---- 画布初值 + 订阅；项目切换时 canvas:changed 自动刷新 ----
  useEffect(() => {
    let alive = true
    const syncProjectSession = (projectId: string) => {
      // projectId 变化（含 '' → 首次有项目）才装载；同项目重复推送不重放
      if (projectId !== projectIdRef.current) {
        projectIdRef.current = projectId
        onProjectSessionChange(projectId)
      }
    }
    const offChange = window.api.canvas.onChange(c => {
      setCanvas(c)
      setPendingGate(pendingFromCanvas(c))
      // 仅切项目（projectId 变化）时关闭 viewer（契约 §6.3）；常规节点/门推送不关
      if (projectIdRef.current && c.projectId !== projectIdRef.current) {
        setViewerNode(null)
        setConfirmNode(null)
      }
      syncProjectSession(c.projectId)
    })
    window.api.canvas.get()
      .then(c => {
        if (!alive) return
        setCanvas(c)
        setPendingGate(pendingFromCanvas(c))
        syncProjectSession(c.projectId)
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

  // feature-808：SSE 全程只订阅一次（无参订阅，首发送惰性触发；失败可重试）
  const ensureSubscribedOnce = useCallback(async () => {
    if (subscribedRef.current) return
    await window.api.runtime.subscribe()
    subscribedRef.current = true
  }, [])

  // ---- 发送一轮：复用绑定会话；无绑定才惰性建会话并回写，指定 showrunner ----
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
      await ensureSubscribedOnce()
      let sid = activeSessionIdRef.current
      if (!sid) {
        const session = await window.api.runtime.createSession()
        sid = session.id
        activeSessionIdRef.current = session.id
        // 回写绑定：崩溃只记 error，不阻断本轮发送（重开表现为未绑定空态）
        try {
          await window.api.activeSession(session.id)
        } catch (bindErr) {
          console.error('activeSession write failed', bindErr)
        }
      }
      await window.api.runtime.promptAsync({ sessionId: sid, text, agent: 'showrunner' })
      // D-006：accepted 后进入生成态，停止钮持续可达；真实环境由 session.idle /
      // runtime.error 事件复位。dev mock 不产生任何 runtime 事件，不置位以免停止钮卡死。
      if (!devMockActive()) setGenerating(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败，请重试。')
    } finally {
      setSending(false)
    }
  }, [ensureSubscribedOnce])

  // feature-808（R4 / D-006）：停止当前轮；不本地复位 generating
  // （由 session.idle / runtime.error 事件链复位；abort 被引擎接受后必发 idle）
  const handleStop = useCallback(async () => {
    const sid = activeSessionIdRef.current
    if (!sid) return // 防御：sending 中理论上必有绑定
    try {
      await window.api.runtime.abortSession(sid)
    } catch (e) {
      console.error('abortSession failed', e)
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
  // feature-007：带脏节点先弹三选一确认（查看器暂不开）；无脏直通（契约 §3.2 单点拦截）
  const handleOpenNode = useCallback((node: CanvasNode) => {
    if (node.dirty) setConfirmNode(node)
    else setViewerNode(node)
  }, [])
  const handleCloseViewer = useCallback(() => setViewerNode(null), [])
  // 确认三动作：重新对齐 = 关确认与查看器 + 模板消息经 handleSend 既有链路送 Agent（D3，UI 不直调 align）
  const handleRealign = useCallback(() => {
    if (!confirmNode?.dirty) return
    const input = {
      nodeId: confirmNode.id,
      title: confirmNode.title,
      sinceBriefVersion: confirmNode.dirty.sinceBriefVersion,
      latestBriefVersion: confirmNode.dirty.latestBriefVersion,
      fields: confirmNode.dirty.fields,
    }
    setViewerNode(null)
    setConfirmNode(null)
    void handleSend(buildRealignPrompt(input))
  }, [confirmNode, handleSend])
  // 保持现状查看 = 关确认 + 开查看器（黄条仍在，不阻断创作）
  const handleKeepView = useCallback(() => {
    if (confirmNode) setViewerNode(confirmNode)
    setConfirmNode(null)
  }, [confirmNode])
  // 取消 = 仅关确认
  const handleConfirmCancel = useCallback(() => setConfirmNode(null), [])

  // ---- feature-011：影响评估面板（两入口 + 批量重生成） ----
  // 入口 A：Stage0View 直改再版成功且 items>0 时上报 → 自动弹出
  const handleBriefUpdated = useCallback((result: BriefUpdatePayload) => {
    setImpactPanel({ data: fromUpdateResult(result) })
  }, [])
  // 入口 B：查看器黄条「查看影响评估」→ 按 dirty.impactReport 回读影响清单（失败 / 损坏 → 面板内降级）
  const handleRequestImpact = useCallback(async (node: CanvasNode) => {
    const path = node.dirty?.impactReport
    if (!path) return
    try {
      const res = await window.api.fileRead({ path })
      if (!res.ok) {
        setImpactPanel({ data: null, degrade: `影响清单读取失败（${res.error.code}）` })
        return
      }
      const parsed = JSON.parse(res.content) as Partial<ImpactReportPayload>
      if (
        typeof parsed.fromVersion !== 'number' ||
        typeof parsed.toVersion !== 'number' ||
        !Array.isArray(parsed.changes) ||
        !Array.isArray(parsed.items)
      ) {
        setImpactPanel({ data: null, degrade: '影响清单格式不可识别，无法呈现影响范围。' })
        return
      }
      setImpactPanel({ data: fromReportFile(parsed as ImpactReportPayload) })
    } catch {
      setImpactPanel({ data: null, degrade: '影响清单读取失败（解析异常）。' })
    }
  }, [])
  // 一键重生成选中：关面板 + 单条聚合模板消息经既有 handleSend 链路（D3-A，K8 零触）
  const handleImpactBatch = useCallback((message: string) => {
    setImpactPanel(null)
    void handleSend(message)
  }, [handleSend])
  const handleImpactClose = useCallback(() => setImpactPanel(null), [])

  // ---- 节点操作（feature-026 · UI 演示，dev-mock 未接 IPC）----
  // dev-mock 暂不支持变更节点状态；这里只把动作反馈到 toast 与 console
  const handleNodeAction = useCallback((action: NodeAction, node: CanvasNode) => {
    const label: Record<NodeAction, string> = {
      view: '查看产物',
      regen: '重新生成',
      copy: '复制路径 / 参数',
      invalidate: '标记失效',
    }
    const text = `${label[action]} · ${kindLabel(node.kind)} · ${node.title}`
    if (action === 'copy') {
      // 真实复制路径到剪贴板（dev-mock 也可工作）
      const payload = node.ref?.path ?? node.id
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(payload).catch(() => {})
      }
      setToast({ tone: 'ok', text: `已复制：${payload}` })
    } else if (action === 'invalidate') {
      setToast({ tone: 'bad', text: `${label.invalidate}（待接 IPC）· ${node.id}` })
    } else {
      setToast({ tone: 'info', text: `${text}（待接 IPC）` })
    }
    // eslint-disable-next-line no-console
    console.info('[node action]', action, node.id)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  // ---- 节点拖拽松手反馈（feature-027）----
  // 业务约束：产物 kind 固定归属步骤，节点只能在本列内会话态摆位，不写盘；
  // 越界松手画布自行回弹，仅在此时由上层补一条警告 toast。
  const handleDropped = useCallback((info: { nodeId: string; illegal: boolean }) => {
    if (!info.illegal) return
    const node = canvas.nodes.find(n => n.id === info.nodeId)
    const title = node?.title ?? info.nodeId
    setToast({ tone: 'bad', text: `产物不可跨步骤移动，已回到原步骤 · ${title}` })
  }, [canvas.nodes])

  const projectTitle = canvas.title || '未命名项目'
  const lpTitle = centerView === 'stage0'
    ? '立项视图'
    : leftView === 'nav' ? '项目内流程' : PAN_TAB_TITLE[panTab]

  // 流程导航 badge：所有 STAGE 中处于 pending/invalidated 节点数（≥1 即提示）
  const navBadge = (() => {
    const KIND_BY_STAGE: Record<string, string[]> = {
      '0': ['brief'], '1': ['outline'], '2': ['scenes', 'dialogue'], '3': ['profiles', 'visual-style'],
      '4': ['storyboard'], '5': ['shot'], '6': ['timeline'], '7': ['final'],
    }
    let n = 0
    for (const node of canvas.nodes) {
      const st = Object.entries(KIND_BY_STAGE).find(([, ks]) => ks.includes(node.kind))?.[0] as StepId | undefined
      if (!st) continue
      if (node.status === 'pending' || node.status === 'invalidated') n++
    }
    return n
  })()

  // 顶栏 stage-track：按节点 step 字段聚合 STAGE 0→7 状态
  // cur = 用户聚焦的 step（activeStep）→ 单点高亮（紫色 pill）
  // active = 该 step 有 active 节点但非用户聚焦 → 紫色文字（无 pill）
  // done = 全 done；idle = 无节点
  const STEP_LABELS: Record<StepId, string> = {
    '0': '立项', '1': '故事', '2': '剧本分场', '3': '资产', '4': '分镜', '5': '镜头', '6': '后期', '7': '发布',
  }
  // 默认 cur = 首个含 active 节点的 step（dev-mock 演示态：n-char-anni step '3' active）
  const defaultCur: StepId = (() => {
    const s = (['0', '1', '2', '3', '4', '5', '6', '7'] as StepId[]).find(s => canvas.nodes.some(n => n.step === s && n.status === 'active'))
    return s ?? '0'
  })()
  const curStep: StepId = activeStep ?? defaultCur
  const stageTrack: { step: StepId; state: 'done' | 'cur' | 'active' | 'idle' }[] = (['0', '1', '2', '3', '4', '5', '6', '7'] as StepId[]).map(step => {
    if (step === curStep) return { step, state: 'cur' as const }
    const matched = canvas.nodes.filter(n => n.step === step)
    if (matched.length === 0) return { step, state: 'idle' as const }
    if (matched.some(n => n.status === 'active')) return { step, state: 'active' as const }
    if (matched.every(n => n.status === 'done')) return { step, state: 'done' as const }
    return { step, state: 'active' as const }
  })

  // feature-013：顶栏 STAGE 0 tooltip「立项 vN · X 产物已对齐 · Y 待处理」（与左栏徽标同源派生；未发布降级 null）
  const stage0TooltipText = stage0Tooltip(deriveBriefDisplay(canvas.nodes))

  return (
    <div className="flex h-full flex-col overflow-hidden bg-win shadow-[0_18px_50px_rgba(40,42,80,0.18)]">
      {/* ═══ 顶栏 ═══ */}
      <header
        // feature-804：darwin 保留红绿灯留白 pl-20/pr-4；win32/linux 左 pl-3、右 pr-0 让关闭钮贴边
        className={`flex h-11 shrink-0 items-center gap-3 border-b border-line bg-white ${
          platform === 'darwin' ? 'pl-20 pr-4' : 'pl-3 pr-0'
        }`}
        style={{ WebkitAppRegion: 'drag' }}
      >
        {/* 标题（左上角红绿灯由 macOS 原生渲染，无需自绘） */}
        <div className="flex items-center gap-2">
          <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-violet text-[10px] font-extrabold text-white">剧</span>
          <span className="text-[13px] font-semibold text-ink">短剧 Agent · {projectTitle}</span>
        </div>
        {/* 顶栏 stage-track（原型 L77-84 .stage-track · L994-1010 八步进度） */}
        <div className="ml-1 flex items-center gap-0.5 rounded-full border border-line bg-white px-1.5 py-[3px]" title="八步闭环进度" style={{ WebkitAppRegion: 'no-drag' }}>
          {stageTrack.map((s, i) => (
            <span key={s.step} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (s.step === '0') {
                    setCenterView('stage0')
                    setActiveStep('0')
                  } else {
                    setCenterView('dag')
                    setLeftView('nav')
                    setActiveStep(s.step)
                  }
                }}
                className={`flex items-center gap-[3px] rounded-full px-1.5 py-[2px] text-[11px] font-bold transition ${
                  s.state === 'done' ? 'text-[#1E9E66] hover:bg-violet-soft'
                    : s.state === 'cur' ? 'bg-violet text-white shadow-[0_4px_10px_rgba(108,92,231,0.35)]'
                    : s.state === 'active' ? 'text-violet hover:bg-violet-soft'
                    : 'text-[#9AA0B5] hover:bg-violet-soft'
                }`}
                title={s.step === '0'
                  ? (stage0TooltipText ?? `STAGE ${s.step} · ${STEP_LABELS[s.step]}`)
                  : `STAGE ${s.step} · ${STEP_LABELS[s.step]}`}
                data-stp={s.step}
              >
                <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                  s.state === 'done' ? 'bg-ok'
                    : s.state === 'cur' ? 'bg-white animate-[pulse_1.4s_ease-in-out_infinite]'
                    : s.state === 'active' ? 'bg-violet'
                    : 'bg-[#C9CCDA]'
                }`} />
                {s.step}
              </button>
              {i < stageTrack.length - 1 && <span className="px-px text-[8px] text-[#D9DCEA]">·</span>}
            </span>
          ))}
        </div>
        <div className="flex-1" />
        {/* 右侧交互控件组（不参与窗口拖拽） */}
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* 视觉风格谱系入口（原型 L1012 .cat-entry） */}
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-[#DED9FB] bg-violet-soft px-2.5 py-1.5 text-[12px] font-bold text-[#5A4FD8] transition hover:bg-violet hover:text-white hover:border-violet"
          data-cat-entry
          title="打开视觉风格谱系目录（4 形态 × 18 画风）"
        >
          <span aria-hidden>🎨</span>
          视觉风格谱系
          <span className="rounded-full bg-white px-1.5 py-px font-mono text-[10px] font-extrabold text-violet">v1.46</span>
        </button>
        </div>
        {/* feature-804：自绘窗口控制（仅 win32/linux；末位贴右边） */}
        {platform !== 'darwin' && <WindowControls />}
      </header>

      {/* ═══ 主体：四栏（图标轨 ｜ 左栏双视图 ｜ 中栏 ｜ 右栏）═══ */}
      <div className="flex min-h-0 flex-1">
        {/* ── 图标轨（60px，原型 L1022-1033 .rail）── */}
        <nav className="flex w-[60px] shrink-0 flex-col items-center border-r border-line bg-white py-3" aria-label="资源库分类">
          {(Object.keys(PAN_TAB_META) as PanTab[]).map(tab => {
            const meta = PAN_TAB_META[tab]
            const active = leftView === 'resource' && panTab === tab
            const enabled = leftView === 'resource'
            return (
              <button
                key={tab}
                type="button"
                onClick={() => { setLeftView('resource'); setPanTab(tab); setLeftQuery('') }}
                className={`mb-1.5 flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[9.5px] font-semibold transition ${
                  active
                    ? 'bg-violet text-white shadow-[0_6px_14px_rgba(108,92,231,0.35)]'
                    : 'text-muted hover:bg-violet-soft hover:text-violet'
                } ${enabled ? '' : 'text-[#A0A6BC]'}`}
                data-rail={tab}
                aria-pressed={active}
                title={meta.title}
              >
                {meta.icon}
                {meta.title}
              </button>
            )
          })}
          <div className="flex-1" />
          {/* B-31：AI 圆标 → 系统菜单（使用指南/导出入口自标题栏收纳至此；功能待挂载，点击暂仅关菜单） */}
          <div className="relative" data-sys-menu-root>
            <button
              type="button"
              onClick={() => setSysMenuOpen(v => !v)}
              className="grid h-[30px] w-[30px] place-items-center rounded-full bg-gradient-to-br from-[#FFD39B] to-[#F0A04B] text-[12px] font-bold text-white"
              title="系统菜单"
              aria-haspopup="menu"
              aria-expanded={sysMenuOpen}
              data-sys-menu-trigger
            >
              AI
            </button>
            {sysMenuOpen && (
              <div role="menu" data-sys-menu className="absolute bottom-0 left-[calc(100%+15px)] z-50 w-32 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_8px_24px_rgba(40,42,80,0.14)]">
                <button type="button" role="menuitem" data-sys-menu-item="guide" onClick={() => setSysMenuOpen(false)} className="block w-full px-3 py-2 text-left text-[12.5px] text-ink hover:bg-canvas">使用指南</button>
                <button type="button" role="menuitem" data-sys-menu-item="export" onClick={() => setSysMenuOpen(false)} className="block w-full px-3 py-2 text-left text-[12.5px] text-ink hover:bg-canvas">导出</button>
              </div>
            )}
          </div>
        </nav>

        {/* ── 左栏（260px，原型 L1035-1208）── */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-line bg-[#FCFCFE]">
          <div className="px-3.5 pb-2 pt-3.5">
            <h3 className="text-[14px] font-extrabold text-ink" id="lpTitle">{lpTitle}</h3>
            {/* lp-seg 一级 toggle（原型 L1039-1049） */}
            <div className="mt-2 flex gap-0.5 rounded-[9px] bg-[#F1F2F8] p-0.5" role="tablist" aria-label="左栏视图">
              <button
                type="button"
                role="tab"
                aria-selected={leftView === 'resource'}
                onClick={() => setLeftView('resource')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-[7px] py-1.5 text-[11px] font-bold transition ${
                  leftView === 'resource' ? 'bg-white text-violet shadow-[0_2px_6px_rgba(40,42,80,0.08)]' : 'text-[#7A8098] hover:text-violet'
                }`}
                data-seg="resource"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-[11px] w-[11px]">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                资源库
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={leftView === 'nav'}
                onClick={() => setLeftView('nav')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-[7px] py-1.5 text-[11px] font-bold transition ${
                  leftView === 'nav' ? 'bg-white text-violet shadow-[0_2px_6px_rgba(40,42,80,0.08)]' : 'text-[#7A8098] hover:text-violet'
                }`}
                data-seg="nav"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-[11px] w-[11px]">
                  <path d="M3 6h18M3 12h18M3 18h12" />
                </svg>
                流程导航
                {navBadge > 0 && (
                  <span className="ml-0.5 rounded-full bg-[#C0841D] px-1.5 py-px text-[8.5px] font-extrabold text-white" title="待对齐节点数">
                    {navBadge}
                  </span>
                )}
              </button>
            </div>
            {/* 搜索框：仅资源库视图下显示（原型 L1050-1053） */}
            {leftView === 'resource' && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#F3F4F9] px-2.5 py-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3 w-3 shrink-0 text-[#A0A6BC]">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={leftQuery}
                  onChange={e => setLeftQuery(e.target.value)}
                  placeholder="搜索项目 / Skill / 资产"
                  className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-[#A0A6BC]"
                />
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3.5">
            {leftView === 'resource' ? (
              <>
                {panTab === 'projects' && <ProjectNav ref={projectNavRef} activeProjectId={canvas.projectId} query={leftQuery} />}
                {panTab === 'skills'   && <SkillsPanel   query={leftQuery} />}
                {panTab === 'assets'   && <AssetsPanel   query={leftQuery} />}
                {panTab === 'plugins'  && <PluginsPanel  query={leftQuery} />}
              </>
            ) : (
              <StageNavPanel
                nodes={canvas.nodes}
                activeStep={activeStep}
                onSelect={step => {
                  if (step === '0') {
                    setCenterView('stage0')
                    setActiveStep('0')
                  } else {
                    setCenterView('dag')
                    setActiveStep(step)
                  }
                }}
              />
            )}
          </div>

          {/* 「+ 新建项目」：仅资源库 + projects 子面板下显示（原型 L1206-1208） */}
          {leftView === 'resource' && panTab === 'projects' && (
            <div className="border-t border-line px-3.5 py-3.5">
              <button
                type="button"
                onClick={() => projectNavRef.current?.startCreate()}
                className="w-full rounded-[10px] bg-[#1E2233] py-2 text-[12.5px] font-semibold text-white transition hover:-translate-y-px hover:bg-black"
              >
                ＋ 新建项目
              </button>
            </div>
          )}
        </aside>

        {/* ── 中栏画布 ── */}
        <main className="relative min-w-0 flex-1 bg-canvas">
          {centerView === 'stage0' ? (
            <Stage0View
              canvas={canvas}
              projectTitle={projectTitle}
              onBackToDag={() => setCenterView('dag')}
              entryQuote={entryQuote}
              onBriefUpdated={handleBriefUpdated}
            />
          ) : (
            <>
              <CanvasBoard
                canvas={canvas}
                onOpenNode={handleOpenNode}
                activeStep={activeStep}
                onNodeAction={handleNodeAction}
                onDropped={handleDropped}
              />
              {viewerNode && (
                <StudioViewer
                  node={viewerNode}
                  kindLabel={kindLabel(viewerNode.kind)}
                  onClose={handleCloseViewer}
                  entryQuote={entryQuote}
                  onRequestAlign={viewerNode.dirty ? () => setConfirmNode(viewerNode) : undefined}
                  onRequestImpact={viewerNode.dirty ? () => { void handleRequestImpact(viewerNode) } : undefined}
                />
              )}
              {confirmNode && (
                <RealignConfirm
                  node={confirmNode}
                  onRealign={handleRealign}
                  onKeepView={handleKeepView}
                  onCancel={handleConfirmCancel}
                />
              )}
            </>
          )}
          {/* feature-011：影响评估面板（与 RealignConfirm 同级挂载；Stage0 与 DAG 两视图均可弹） */}
          {impactPanel && (
            <ImpactPanel
              data={impactPanel.data}
              degrade={impactPanel.degrade}
              onBatchRealign={handleImpactBatch}
              onMarkOnly={handleImpactClose}
              onCancel={handleImpactClose}
            />
          )}
        </main>

        {/* 视觉风格谱系弹层（顶栏 cat-entry 触发） */}
        <VisualCatalog
          open={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          onAdopt={style => setToast({ tone: 'ok', text: `已采用 ${style.id} · ${style.name}（${style.family.split('·')[0]}）` })}
        />

        {/* 节点操作 toast（feature-026） */}
        {toast && (
          <div
            className={`fixed bottom-12 left-1/2 z-[60] -translate-x-1/2 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold shadow-[0_8px_24px_rgba(40,42,80,0.18)] ${
              toast.tone === 'ok' ? 'bg-ok text-white'
                : toast.tone === 'bad' ? 'bg-bad text-white'
                : 'bg-[#1E2233] text-white'
            }`}
            data-toast
            role="status"
          >
            {toast.text}
          </div>
        )}

        {/* ── 右栏对话（左缘拖拽调宽 300–640px）── */}
        <aside className="relative flex shrink-0 flex-col border-l border-line bg-white" style={{ width: chatWidth }}>
          <div
            className="absolute inset-y-0 -left-[3px] z-30 w-[6px] cursor-col-resize transition-colors hover:bg-violet/40"
            onPointerDown={onChatResizerDown}
            onPointerMove={onChatResizerMove}
            onPointerUp={onChatResizerUp}
            onPointerCancel={onChatResizerUp}
            data-chat-resizer
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整对话区宽度"
            title="拖拽调整对话区宽度"
          />
          {/* feature-005：「已捕获口径」常驻条（契约 §3.2；项目未打开不渲染，与右栏同生命周期） */}
          {canvas.projectId ? <CaptureBar /> : null}
          <div className="min-h-0 flex-1">
            <ChatComposer
              items={items}
              stream={stream}
              pendingGate={pendingGate}
              deciding={deciding}
              sending={sending}
              generating={generating}
              error={error}
              historyLoading={historyLoading}
              onSend={handleSend}
              onStop={handleStop}
              onDecide={handleDecide}
            />
          </div>
        </aside>
      </div>

      {/* ═══ 底栏状态条 ═══ */}
      <footer className="flex h-9 shrink-0 items-center gap-3.5 border-t border-line bg-white px-4 text-[10.5px] text-muted">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          火山方舟（文本）
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          10.203.3.52:8000
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          :8001
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          :8002
        </div>
        <div className="mx-1 h-4 w-px bg-line" />
        <div className="flex items-center gap-2">
          <span>镜头批量</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
            <div className="h-full w-2/3 rounded-full bg-violet" />
          </div>
          <b className="text-ink">12 / 18</b>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="rounded-full bg-ok/10 px-2 py-0.5 text-ok">✓ Harness 校验 30 项</span>
          <span>2 分钟前自动保存</span>
        </div>
      </footer>
    </div>
  )
}
