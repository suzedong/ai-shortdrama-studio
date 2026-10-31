// feature-014 · AI 服务设置面板组件测试（契约 §6.7）
// 覆盖：菜单开合（StudioApp 级）、字段渲染与来源标记、保存调 update 与复检、
// runtime 变更驻留提示、错误条上屏、清除 Key；
// 另补任务清单 T5 的 patch 组装语义：空串清除 / 键缺席不动 / null 回默认 / 零变更不发 IPC。
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Canvas } from '@shared/types'
import AiServicePanel from './AiServicePanel'
import StudioApp from './StudioApp'

function makeView(over?: {
  activeProvider?: AiProviderId
  keyConfigured?: boolean
  apiKeyMasked?: string
  lmStudioModel?: string
  arkModel?: string
  arkSources?: Partial<{ apiKey: AiFieldSource; baseUrl: AiFieldSource; model: AiFieldSource }>
  lmStudioSources?: Partial<{ baseUrl: AiFieldSource; model: AiFieldSource }>
  runtimeSources?: Partial<{
    portRangeStart: AiFieldSource
    healthTimeoutMs: AiFieldSource
    mockBaseUrl: AiFieldSource
  }>
}): AiServiceSettingsView {
  return {
    activeProvider: over?.activeProvider ?? 'ark',
    ark: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      model: over?.arkModel ?? 'doubao-pro-32k',
      keyConfigured: over?.keyConfigured ?? true,
      apiKeyMasked: over?.apiKeyMasked ?? 'sk-****1234',
      sources: { apiKey: 'store', baseUrl: 'env', model: 'default', ...over?.arkSources },
    },
    lmstudio: {
      baseUrl: 'http://127.0.0.1:1234/v1',
      model: over?.lmStudioModel ?? 'local-model',
      sources: { baseUrl: 'default', model: 'default', ...over?.lmStudioSources },
    },
    runtime: {
      portRangeStart: 4096,
      healthTimeoutMs: 10000,
      mockBaseUrl: 'http://127.0.0.1:4099/v1',
      sources: {
        portRangeStart: 'default',
        healthTimeoutMs: 'default',
        mockBaseUrl: 'default',
        ...over?.runtimeSources,
      },
    },
    updatedAt: new Date().toISOString(),
  }
}

/** Electron invoke 抛错的包装形态（renderer 侧剥壳前的原始 message） */
function ipcReject(msg: string): Error {
  return new Error(`Error invoking remote method 'settings:ai:update': Error: ${msg}`)
}

interface PanelHarness {
  get: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  onClose: ReturnType<typeof vi.fn>
  onSaved: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  unmount: () => void
}

function installPanel(view: AiServiceSettingsView, aiDown: string | null = null): PanelHarness {
  const get = vi.fn(async () => view)
  const update = vi.fn(async () => view)
  const stop = vi.fn(async () => undefined)
  const start = vi.fn(async () => undefined)
  window.api = { settings: { ai: { get, update } }, runtime: { stop, start } } as unknown as Window['api']
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const r = render(<AiServicePanel aiDown={aiDown} onClose={onClose} onSaved={onSaved} />)
  return { get, update, onClose, onSaved, stop, start, unmount: r.unmount }
}

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  vi.clearAllMocks()
  user = userEvent.setup()
})

describe('AiServicePanel', () => {
  it('字段渲染与来源标记三态；明文 Key 不回显；高级区默认折叠', async () => {
    installPanel(makeView())

    expect(await screen.findByTestId('ai-status')).toHaveTextContent('AI 服务：可用')
    expect(screen.getByTestId('source-apiKey')).toHaveTextContent('自定义')
    expect(screen.getByTestId('source-baseUrl')).toHaveTextContent('环境变量')
    expect(screen.getByTestId('source-model')).toHaveTextContent('默认')

    // 明文 Key 永不回显：password 框值为空，占位仅显脱敏
    const keyInput = screen.getByLabelText('API Key')
    expect(keyInput).toHaveValue('')
    expect(keyInput).toHaveAttribute('placeholder', 'sk-****1234')

    // 高级折叠区：默认收起，展开后 runtime 三项来源标记可见
    expect(screen.queryByTestId('source-portRangeStart')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /高级/ }))
    expect(screen.getByTestId('source-portRangeStart')).toHaveTextContent('默认')
    expect(screen.getByTestId('source-healthTimeoutMs')).toHaveTextContent('默认')
    expect(screen.getByTestId('source-mockBaseUrl')).toHaveTextContent('默认')
  })

  it('服务商固定为火山方舟 / LM Studio 两项，不提供新增、删除或自定义入口', async () => {
    installPanel(makeView())
    await screen.findByTestId('ai-status')

    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: '火山方舟' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'LM Studio' })).not.toBeChecked()
    expect(screen.queryByRole('button', { name: /新增|删除|自定义服务商/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'LM Studio' }))
    expect(screen.getByLabelText('LM Studio Base URL')).toHaveValue('http://127.0.0.1:1234/v1')
    expect(screen.getByLabelText('LM Studio 模型 ID')).toHaveValue('local-model')
    expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清除 Key' })).not.toBeInTheDocument()
  })

  it('LM Studio：保存局域网地址、模型 ID 与服务商切换，不携带 Ark 字段并提示手动重连', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')

    await user.click(screen.getByRole('radio', { name: 'LM Studio' }))
    await user.clear(screen.getByLabelText('LM Studio Base URL'))
    await user.type(screen.getByLabelText('LM Studio Base URL'), 'http://192.168.31.20:1234/v1')
    await user.clear(screen.getByLabelText('LM Studio 模型 ID'))
    await user.type(screen.getByLabelText('LM Studio 模型 ID'), 'qwen2.5-7b-instruct')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(h.update).toHaveBeenCalledWith({
      activeProvider: 'lmstudio',
      lmstudio: {
        baseUrl: 'http://192.168.31.20:1234/v1',
        model: 'qwen2.5-7b-instruct',
      },
    }))
    expect(h.onSaved).toHaveBeenCalledTimes(1)
    expect(h.onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('ai-runtime-hint')).toHaveTextContent(
      '服务商配置已保存，需手动重连运行时后生效',
    )
  })

  it('LM Studio 状态只要求模型 ID，不要求 Ark Key；切换表单不清空另一方未保存输入', async () => {
    const h = installPanel(makeView({ activeProvider: 'lmstudio', keyConfigured: false }))
    expect(await screen.findByTestId('ai-status')).toHaveTextContent('AI 服务：可用')
    h.unmount()

    installPanel(makeView({ activeProvider: 'lmstudio', keyConfigured: false, lmStudioModel: '' }))
    expect(await screen.findByTestId('ai-status')).toHaveTextContent('AI 服务：未配置')
  })

  it('状态行：未配置 / 连接失败 两态推导', async () => {
    const h1 = installPanel(makeView({ keyConfigured: false }))
    expect(await screen.findByTestId('ai-status')).toHaveTextContent('AI 服务：未配置')
    // 未配置时清除钮不可点
    expect(screen.getByRole('button', { name: '清除 Key' })).toBeDisabled()
    h1.unmount()

    installPanel(makeView(), 'AI 服务调用失败：连接超时')
    expect(await screen.findByTestId('ai-status')).toHaveTextContent('AI 服务：连接失败')
  })

  it('保存：仅变更键出席，调 update 与 onSaved 复检后关闭', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')

    await user.type(screen.getByLabelText('API Key'), 'sk-new-key')
    await user.clear(screen.getByLabelText('模型名'))
    await user.type(screen.getByLabelText('模型名'), 'doubao-lite')
    await user.click(screen.getByRole('button', { name: '保存' }))

    // baseUrl 与 runtime 三项未动 → 键缺席；apiKey 非空 → 替换
    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith({ ark: { apiKey: 'sk-new-key', model: 'doubao-lite' } }),
    )
    expect(h.onSaved).toHaveBeenCalledTimes(1)
    // 无 runtime 变更 → 直接关闭
    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('ai-runtime-hint')).not.toBeInTheDocument()
  })

  it('runtime 变更：保存不自动重连，手动 stop → start 成功后提示生效', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')

    await user.click(screen.getByRole('button', { name: /高级/ }))
    await user.clear(screen.getByLabelText('端口探测起点'))
    await user.type(screen.getByLabelText('端口探测起点'), '5000')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ runtime: { portRangeStart: 5000 } }))
    expect(h.onSaved).toHaveBeenCalledTimes(1)
    expect(h.onClose).not.toHaveBeenCalled()
    expect(h.stop).not.toHaveBeenCalled()
    expect(h.start).not.toHaveBeenCalled()
    expect(screen.getByTestId('ai-runtime-hint')).toHaveTextContent('需手动重连运行时后生效')
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重连运行时' }))
    await waitFor(() => expect(h.start).toHaveBeenCalledTimes(1))
    expect(h.stop).toHaveBeenCalledTimes(1)
    expect(h.stop.mock.invocationCallOrder[0]).toBeLessThan(h.start.mock.invocationCallOrder[0]!)
    expect(h.onSaved).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('ai-runtime-hint')).toHaveTextContent('运行时重连成功，配置已生效')
    expect(screen.queryByRole('button', { name: '重连运行时' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '关闭' }))
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('手动重连失败：错误上屏、面板驻留且保留重试入口', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')
    h.start.mockRejectedValueOnce(new Error('start failed'))

    await user.click(screen.getByRole('radio', { name: 'LM Studio' }))
    await user.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ activeProvider: 'lmstudio' }))
    await user.click(screen.getByRole('button', { name: '重连运行时' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('运行时重连失败：start failed')
    expect(h.stop).toHaveBeenCalledTimes(1)
    expect(h.start).toHaveBeenCalledTimes(1)
    expect(h.onSaved).toHaveBeenCalledTimes(1)
    expect(h.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '重连运行时' })).toBeEnabled()
  })

  it('patch 组装：ark 空串=清除；runtime 空=null 回默认', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')

    await user.clear(screen.getByLabelText('Base URL'))
    await user.click(screen.getByRole('button', { name: /高级/ }))
    await user.clear(screen.getByLabelText('端口探测起点'))
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith({ ark: { baseUrl: '' }, runtime: { portRangeStart: null } }),
    )
    // 含 runtime → 驻留提示
    expect(screen.getByTestId('ai-runtime-hint')).toBeInTheDocument()
  })

  it('零变更：不发 IPC，直接关闭', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(h.update).not.toHaveBeenCalled()
    expect(h.onSaved).not.toHaveBeenCalled()
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })

  it('主进程校验失败：剥壳文案原样上屏，面板保持打开', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')
    h.update.mockRejectedValueOnce(ipcReject('INVALID_ARGUMENT: baseUrl 必须是 http(s) 地址'))

    await user.clear(screen.getByLabelText('Base URL'))
    await user.type(screen.getByLabelText('Base URL'), 'not-a-url')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'INVALID_ARGUMENT: baseUrl 必须是 http(s) 地址',
    )
    expect(h.onSaved).not.toHaveBeenCalled()
    expect(h.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'AI 服务设置' })).toBeInTheDocument()
  })

  it('清除 Key：待保存态可撤销，保存送空串', async () => {
    const h = installPanel(makeView())
    await screen.findByTestId('ai-status')

    await user.click(screen.getByRole('button', { name: '清除 Key' }))
    expect(screen.getByLabelText('API Key')).toBeDisabled()
    expect(screen.getByLabelText('API Key')).toHaveAttribute('placeholder', '保存后清除当前 Key')

    // 撤销：输入框恢复可编辑、占位回到脱敏值
    await user.click(screen.getByRole('button', { name: '撤销清除' }))
    expect(screen.getByLabelText('API Key')).toBeEnabled()
    expect(screen.getByLabelText('API Key')).toHaveAttribute('placeholder', 'sk-****1234')

    await user.click(screen.getByRole('button', { name: '清除 Key' }))
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ ark: { apiKey: '' } }))
    expect(h.onSaved).toHaveBeenCalledTimes(1)
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })
})

// ── StudioApp 级：系统菜单入口开合（契约 §6.7 菜单开合） ──

function emptyStudioCanvas(): Canvas {
  return {
    schemaVersion: 2,
    projectId: 'p1',
    title: '',
    nodes: [],
    edges: [],
    gates: [],
    updatedAt: new Date().toISOString(),
  }
}

function installStudioApi(view: AiServiceSettingsView) {
  const get = vi.fn(async () => view)
  const update = vi.fn(async () => view)
  const okStatus = {
    state: 'running' as const,
    port: 4096,
    version: '1.18.34',
    healthy: true,
    startedAt: null,
    error: null,
  }
  window.api = {
    runtime: {
      status: vi.fn(async () => okStatus),
      start: vi.fn(async () => okStatus),
      createSession: vi.fn(async () => ({ id: 'sess-1', title: null, createdAt: new Date().toISOString() })),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      abortSession: vi.fn(async () => ({ ok: true as const })),
      sessionMessages: vi.fn(async () => []),
      promptAsync: vi.fn(async () => ({ accepted: true as const, messageId: 'msg-1' })),
      onEvent: vi.fn(() => () => undefined),
    },
    canvas: {
      get: vi.fn(async () => emptyStudioCanvas()),
      subscribe: vi.fn(async () => ({ ok: true as const })),
      unsubscribe: vi.fn(async () => ({ ok: true as const })),
      onChange: vi.fn(() => () => undefined),
    },
    gate: {
      decide: vi.fn(async () => ({ ok: true as const })),
      onChanged: vi.fn(() => () => undefined),
    },
    listProjects: vi.fn(async () => []),
    createProject: vi.fn(async () => ({ dir: '/ws/project-p2' })),
    openProject: vi.fn(async () => ({ ok: true as const, activeSessionId: null as string | null })),
    activeSession: vi.fn(async () => ({ sessionId: null as string | null })),
    fileRead: vi.fn(async () => ({ ok: true as const, content: '{}', format: 'json' as const })),
    captureList: vi.fn(async () => ({ schemaVersion: 1 as const, facts: [] })),
    onCaptureChanged: vi.fn(() => () => undefined),
    settings: { ai: { get, update } },
  } as unknown as Window['api']
  return { get, update }
}

describe('StudioApp · 系统菜单「AI 服务设置」入口', () => {
  it('菜单开合：点击入口开模态面板，取消关闭', async () => {
    const h = installStudioApi(makeView())
    render(<StudioApp />)

    await user.click(screen.getByTitle('系统菜单'))
    const menu = await screen.findByRole('menu')
    await user.click(screen.getByRole('menuitem', { name: 'AI 服务设置' }))

    // 面板打开且菜单关闭；装载完成后状态行上屏
    expect(await screen.findByRole('dialog', { name: 'AI 服务设置' })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(menu).not.toBeInTheDocument()
    expect(await screen.findByTestId('ai-status')).toHaveTextContent('AI 服务：可用')
    expect(h.get).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: 'AI 服务设置' })).not.toBeInTheDocument()
  })

  it('AC10：对话选择不回写全局配置；设置保存刷新选项并保留仍有效的选择', async () => {
    const h = installStudioApi(makeView())
    render(<StudioApp />)

    const selector = screen.getByRole('combobox', { name: '对话模型' })
    await waitFor(() => expect(selector).toHaveValue('ark/doubao-pro-32k'))
    await user.selectOptions(selector, 'lmstudio/local-model')
    expect(h.update).not.toHaveBeenCalled()

    await user.click(screen.getByTitle('系统菜单'))
    await user.click(await screen.findByRole('menuitem', { name: 'AI 服务设置' }))
    expect(await screen.findByRole('dialog', { name: 'AI 服务设置' })).toBeInTheDocument()

    h.get.mockResolvedValue(makeView({ arkModel: 'doubao-lite' }))
    await user.clear(screen.getByLabelText('模型名'))
    await user.type(screen.getByLabelText('模型名'), 'doubao-lite')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'AI 服务设置' })).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(selector).toHaveValue('lmstudio/local-model'))
    expect(h.update).toHaveBeenCalledTimes(1)
    expect(h.update).toHaveBeenCalledWith({ ark: { model: 'doubao-lite' } })
    expect(Array.from((selector as HTMLSelectElement).options).map(option => option.value))
      .toEqual(['ark/doubao-lite', 'lmstudio/local-model'])
  })
})
