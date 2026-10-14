// feature-022 · 新壳工作台（OD §1 三栏布局 + §3.1 顶栏/底栏）
// 布局：顶栏 → [图标轨 | 左栏 · 资源库/流程导航 双视图 | 中栏画布 | 右栏对话] → 底栏状态条
// 左栏对齐原型方案 A · 图标轨 4 子面板 + lp-seg 一级 toggle + 流程导航 8 步面板
// 所有 IPC 与组件接线保持不变；仅把视觉骨架对齐高保真原型。
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Canvas, CanvasGate, CanvasNode, StepId } from '@shared/types'
import { reduceRuntimeEvent, turnText, type StreamingTurn } from '../lib/chat-runtime'
import CanvasBoard, { kindLabel, type NodeAction } from './CanvasBoard'
import ChatComposer, { demoChatItems, type ChatItem } from './ChatComposer'
import ProjectNav, { type ProjectNavHandle } from './ProjectNav'
import { AssetsPanel, PluginsPanel, SkillsPanel } from './LeftPanels'
import StageNavPanel from './StageNavPanel'
import Stage0View from './Stage0View'
import StudioViewer from './StudioViewer'
import VisualCatalog from './VisualCatalog'
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
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerNode, setViewerNode] = useState<CanvasNode | null>(null)
  const [leftView, setLeftView] = useState<LeftView>('resource')
  const [panTab, setPanTab] = useState<PanTab>('projects')
  const [leftQuery, setLeftQuery] = useState('')
  const [activeStep, setActiveStep] = useState<StepId | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [centerView, setCenterView] = useState<CenterView>('dag')
  const [toast, setToast] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null)
  const projectNavRef = useRef<ProjectNavHandle>(null)

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
                title={`STAGE ${s.step} · ${STEP_LABELS[s.step]}`}
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
        {/* 模型芯片 */}
        <button className="flex items-center gap-1.5 rounded-full border border-[#DED9FB] bg-violet-soft px-2.5 py-1 text-[12px] font-semibold text-violet">
          <span className="rounded-full bg-violet px-1.5 py-px text-[10px] text-white">自动</span>
          MiniMax H3 · 768P–2K
        </button>
        <button className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted hover:bg-canvas">使用指南</button>
        <button className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted hover:bg-canvas">导出</button>
        <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-gradient-to-br from-[#B8AFFF] to-violet text-[11px] font-bold text-white">SZ</div>
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
          <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-gradient-to-br from-[#FFD39B] to-[#F0A04B] text-[12px] font-bold text-white">AI</div>
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
              projectTitle={projectTitle}
              briefVer={typeof canvas.nodes.find(n => n.id === 'n-brief')?.meta?.version === 'string' ? (canvas.nodes.find(n => n.id === 'n-brief')?.meta?.version as string) : 'v1'}
              onBackToDag={() => setCenterView('dag')}
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
                />
              )}
            </>
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

        {/* ── 右栏对话 ── */}
        <aside className="w-[380px] shrink-0 border-l border-line bg-white">
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
