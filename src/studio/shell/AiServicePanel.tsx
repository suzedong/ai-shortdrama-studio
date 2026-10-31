// feature-014 · AI 服务设置面板（契约 §4 / SDG-OD 设计说明 §2 冻结形态）
// - 明文 Key 永不回显：password 框初始为空，占位符仅显脱敏值（apiKeyMasked）或「未配置」；
// - 保存 patch 语义（契约 §2.1/§2.2）：键缺席=不动；ark 字段空串=清除；runtime 字段空=null 回默认；
//   所有校验在主进程，IPC INVALID_ARGUMENT 文案原样上屏，出错时面板保持打开；
// - 保存成功必调 onSaved（StudioApp 传 checkAiHealth，feature-808 D-013 复检链路）；
//   patch 含 runtime 项 → 驻留并提示「运行时参数已保存，需手动重连运行时后生效」。
import { useEffect, useState } from 'react'

const SOURCE_LABEL: Record<AiFieldSource, string> = {
  store: '自定义',
  env: '环境变量',
  default: '默认',
}

/** 服务商 DTO 与显示文案集中在 C7 豁免面板，其余对话组件只传脱敏模型引用。 */
export function getChatModelOptions(
  view: AiServiceSettingsView,
): Array<{ providerID: AiProviderId; modelID: string }> {
  const options: Array<{ providerID: AiProviderId; modelID: string }> = []
  const arkModel = view.ark.model.trim()
  const lmStudioModel = view.lmstudio.model.trim()
  if (arkModel) options.push({ providerID: 'ark', modelID: arkModel })
  if (lmStudioModel) options.push({ providerID: 'lmstudio', modelID: lmStudioModel })
  return options
}

export function formatChatModelLabel(providerID: AiProviderId, modelID: string): string {
  return `${providerID === 'ark' ? '火山方舟' : 'LM Studio'} · ${modelID}`
}

/** Electron invoke 抛错会被包一层 'Error invoking remote method …'，剥壳取主进程原文 */
function ipcErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const m = /^Error invoking remote method '[^']+': Error: ([\s\S]*)$/.exec(msg)
  return m ? m[1] : msg
}

export interface AiServicePanelProps {
  /** 对话区横幅同一数据源（D-013）：null=可用/未知，非空=连接失败 */
  aiDown: string | null
  onClose: () => void
  /** 保存成功后复检（StudioApp 传 checkAiHealth） */
  onSaved: () => void
}

export default function AiServicePanel({ aiDown, onClose, onSaved }: AiServicePanelProps) {
  const [view, setView] = useState<AiServiceSettingsView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // 服务商 / runtime 保存成功后的驻留态：均需手动重连，不自动中断当前会话
  const [savedRuntime, setSavedRuntime] = useState(false)
  const [savedMessage, setSavedMessage] = useState('运行时参数已保存，需手动重连运行时后生效')
  const [reconnecting, setReconnecting] = useState(false)
  const [reconnected, setReconnected] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // 两个服务商的表单状态独立保留；切换只改 activeProvider，不清空另一方
  const [activeProvider, setActiveProvider] = useState<AiProviderId>('ark')
  const [apiKey, setApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState('')
  const [lmStudioModel, setLmStudioModel] = useState('')
  const [portStart, setPortStart] = useState('')
  const [healthTimeout, setHealthTimeout] = useState('')
  const [mockBaseUrl, setMockBaseUrl] = useState('')

  useEffect(() => {
    let alive = true
    window.api.settings.ai.get()
      .then(v => {
        if (!alive) return
        setView(v)
        setActiveProvider(v.activeProvider)
        setBaseUrl(v.ark.baseUrl)
        setModel(v.ark.model)
        setLmStudioBaseUrl(v.lmstudio.baseUrl)
        setLmStudioModel(v.lmstudio.model)
        setPortStart(String(v.runtime.portRangeStart))
        setHealthTimeout(String(v.runtime.healthTimeoutMs))
        setMockBaseUrl(v.runtime.mockBaseUrl)
      })
      .catch(e => {
        if (alive) setError(`设置读取失败：${ipcErrorMessage(e)}`)
      })
    return () => {
      alive = false
    }
  }, [])

  async function onSave() {
    if (!view || saving) return
    const patch: AiServiceUpdatePatch = {}
    if (activeProvider !== view.activeProvider) patch.activeProvider = activeProvider
    const ark: NonNullable<AiServiceUpdatePatch['ark']> = {}
    if (clearKey) ark.apiKey = ''
    else if (apiKey.trim() !== '') ark.apiKey = apiKey.trim()
    const nextBaseUrl = baseUrl.trim()
    if (nextBaseUrl !== view.ark.baseUrl) ark.baseUrl = nextBaseUrl // 空串=清除
    const nextModel = model.trim()
    if (nextModel !== view.ark.model) ark.model = nextModel
    if (Object.keys(ark).length > 0) patch.ark = ark
    const lmstudio: NonNullable<AiServiceUpdatePatch['lmstudio']> = {}
    const nextLmStudioBaseUrl = lmStudioBaseUrl.trim()
    if (nextLmStudioBaseUrl !== view.lmstudio.baseUrl) lmstudio.baseUrl = nextLmStudioBaseUrl
    const nextLmStudioModel = lmStudioModel.trim()
    if (nextLmStudioModel !== view.lmstudio.model) lmstudio.model = nextLmStudioModel
    if (Object.keys(lmstudio).length > 0) patch.lmstudio = lmstudio
    const runtime: NonNullable<AiServiceUpdatePatch['runtime']> = {}
    const ps = portStart.trim()
    if (ps !== String(view.runtime.portRangeStart)) runtime.portRangeStart = ps === '' ? null : Number(ps)
    const ht = healthTimeout.trim()
    if (ht !== String(view.runtime.healthTimeoutMs)) runtime.healthTimeoutMs = ht === '' ? null : Number(ht)
    const mb = mockBaseUrl.trim()
    if (mb !== view.runtime.mockBaseUrl) runtime.mockBaseUrl = mb === '' ? null : mb
    if (Object.keys(runtime).length > 0) patch.runtime = runtime
    // 零变更：不发 IPC（主进程对空 patch 抛 INVALID_ARGUMENT），直接关闭
    if (!patch.activeProvider && !patch.ark && !patch.lmstudio && !patch.runtime) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await window.api.settings.ai.update(patch)
      onSaved()
      if (patch.runtime || patch.activeProvider || patch.lmstudio) {
        setView(next)
        setActiveProvider(next.activeProvider)
        setApiKey('')
        setClearKey(false)
        setSavedMessage(patch.activeProvider || patch.lmstudio
          ? '服务商配置已保存，需手动重连运行时后生效'
          : '运行时参数已保存，需手动重连运行时后生效')
        setSavedRuntime(true)
      } else {
        onClose()
      }
    } catch (e) {
      setError(ipcErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function onReconnect() {
    if (!savedRuntime || reconnecting || reconnected) return
    setReconnecting(true)
    setError(null)
    try {
      await window.api.runtime.stop()
      await window.api.runtime.start()
      setSavedMessage('运行时重连成功，配置已生效')
      setReconnected(true)
      onSaved()
    } catch (e) {
      setError(`运行时重连失败：${ipcErrorMessage(e)}`)
    } finally {
      setReconnecting(false)
    }
  }

  const configured = view
    ? view.activeProvider === 'lmstudio'
      ? !!view.lmstudio.model
      : view.ark.keyConfigured && !!view.ark.model
    : false
  const status = !view ? null : !configured ? '未配置' : aiDown ? '连接失败' : '可用'

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/30 p-6">
      <div
        role="dialog"
        aria-label="AI 服务设置"
        className="w-[520px] rounded-xl border border-line bg-white p-5 shadow-card"
      >
        <h3 className="text-[13px] font-extrabold text-ink">AI 服务设置</h3>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-[11.5px] leading-5 text-bad"
          >
            {error}
          </div>
        )}

        {savedRuntime && (
          <div
            data-testid="ai-runtime-hint"
            className="mt-3 rounded-lg border border-[#C0841D]/40 bg-[#FFF4DE] px-3 py-2 text-[11.5px] font-semibold leading-5 text-[#C0841D]"
          >
            {savedMessage}
          </div>
        )}

        {!view ? (
          <p className="mt-4 text-[11.5px] text-muted">{error ? '设置读取失败，请关闭后重试。' : '读取中…'}</p>
        ) : (
          <>
            {/* 状态行：与对话区横幅同一数据源 */}
            <p className="mt-3 text-[11.5px] text-muted" data-testid="ai-status">
              AI 服务：{status}
            </p>

            <div className="mt-3 space-y-3">
              {/* 固定双服务商：仅单选切换，不提供新增、删除或自定义服务商 */}
              <div>
                <span className="text-[12px] font-bold text-ink">AI 服务商</span>
                <div role="radiogroup" aria-label="AI 服务商" className="mt-1 grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-[12px] text-ink">
                    <input
                      type="radio"
                      name="ai-provider"
                      aria-label="火山方舟"
                      checked={activeProvider === 'ark'}
                      disabled={saving || savedRuntime}
                      onChange={() => setActiveProvider('ark')}
                      className="accent-violet"
                    />
                    火山方舟
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-[12px] text-ink">
                    <input
                      type="radio"
                      name="ai-provider"
                      aria-label="LM Studio"
                      checked={activeProvider === 'lmstudio'}
                      disabled={saving || savedRuntime}
                      onChange={() => setActiveProvider('lmstudio')}
                      className="accent-violet"
                    />
                    LM Studio
                  </label>
                </div>
              </div>

              {activeProvider === 'ark' ? (
                <>
                  {/* API Key：明文永不回显，占位仅显脱敏 */}
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-ink">API Key</span>
                      <span className="text-[10.5px] text-muted" data-testid="source-apiKey">
                        {SOURCE_LABEL[view.ark.sources.apiKey]}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="password"
                        aria-label="API Key"
                        value={clearKey ? '' : apiKey}
                        disabled={clearKey || saving || savedRuntime}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder={
                          clearKey
                            ? '保存后清除当前 Key'
                            : (view.ark.apiKeyMasked ?? '未配置')
                        }
                        className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                      />
                      <button
                        type="button"
                        disabled={(!view.ark.keyConfigured && !clearKey) || saving || savedRuntime}
                        onClick={() => {
                          setClearKey(v => !v)
                          setApiKey('')
                        }}
                        className="shrink-0 rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-40"
                      >
                        {clearKey ? '撤销清除' : '清除 Key'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-ink">Base URL</span>
                      <span className="text-[10.5px] text-muted" data-testid="source-baseUrl">
                        {SOURCE_LABEL[view.ark.sources.baseUrl]}
                      </span>
                    </div>
                    <input
                      aria-label="Base URL"
                      value={baseUrl}
                      disabled={saving || savedRuntime}
                      onChange={e => setBaseUrl(e.target.value)}
                      placeholder="https://ark.cn-beijing.volces.com/api/v3"
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                    />
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-ink">模型名</span>
                      <span className="text-[10.5px] text-muted" data-testid="source-model">
                        {SOURCE_LABEL[view.ark.sources.model]}
                      </span>
                    </div>
                    <input
                      aria-label="模型名"
                      value={model}
                      disabled={saving || savedRuntime}
                      onChange={e => setModel(e.target.value)}
                      placeholder="如 doubao-…"
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-ink">Base URL</span>
                      <span className="text-[10.5px] text-muted" data-testid="source-lmstudio-baseUrl">
                        {SOURCE_LABEL[view.lmstudio.sources.baseUrl]}
                      </span>
                    </div>
                    <input
                      aria-label="LM Studio Base URL"
                      value={lmStudioBaseUrl}
                      disabled={saving || savedRuntime}
                      onChange={e => setLmStudioBaseUrl(e.target.value)}
                      placeholder="http://127.0.0.1:1234/v1 或局域网地址"
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                    />
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-ink">模型 ID</span>
                      <span className="text-[10.5px] text-muted" data-testid="source-lmstudio-model">
                        {SOURCE_LABEL[view.lmstudio.sources.model]}
                      </span>
                    </div>
                    <input
                      aria-label="LM Studio 模型 ID"
                      value={lmStudioModel}
                      disabled={saving || savedRuntime}
                      onChange={e => setLmStudioModel(e.target.value)}
                      placeholder="填写 LM Studio 中已加载的模型 ID"
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                    />
                  </div>
                </>
              )}

              {/* 高级折叠区：runtime 三项，改动需手动重连运行时生效 */}
              <div className="rounded-lg border border-line">
                <button
                  type="button"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen(v => !v)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-[11px] w-[11px] text-muted transition-transform ${advancedOpen ? 'rotate-90' : ''}`}
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                  <span className="text-[12px] font-bold text-ink">高级</span>
                  <span className="ml-auto text-[10.5px] text-muted">改动需手动重连运行时生效</span>
                </button>
                {advancedOpen && (
                  <div className="space-y-3 border-t border-line px-3 py-3">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] font-bold text-ink">端口探测起点</span>
                        <span className="text-[10.5px] text-muted" data-testid="source-portRangeStart">
                          {SOURCE_LABEL[view.runtime.sources.portRangeStart]}
                        </span>
                      </div>
                      <input
                        type="number"
                        aria-label="端口探测起点"
                        value={portStart}
                        disabled={saving || savedRuntime}
                        onChange={e => setPortStart(e.target.value)}
                        placeholder="4096"
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                      />
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] font-bold text-ink">健康检查超时 ms</span>
                        <span className="text-[10.5px] text-muted" data-testid="source-healthTimeoutMs">
                          {SOURCE_LABEL[view.runtime.sources.healthTimeoutMs]}
                        </span>
                      </div>
                      <input
                        type="number"
                        aria-label="健康检查超时"
                        value={healthTimeout}
                        disabled={saving || savedRuntime}
                        onChange={e => setHealthTimeout(e.target.value)}
                        placeholder="10000"
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                      />
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] font-bold text-ink">mock 引擎地址</span>
                        <span className="text-[10.5px] text-muted" data-testid="source-mockBaseUrl">
                          {SOURCE_LABEL[view.runtime.sources.mockBaseUrl]}
                        </span>
                      </div>
                      <input
                        aria-label="mock 引擎地址"
                        value={mockBaseUrl}
                        disabled={saving || savedRuntime}
                        onChange={e => setMockBaseUrl(e.target.value)}
                        placeholder="http://127.0.0.1:4099/v1"
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-[#A0A6BC] focus:border-violet disabled:bg-canvas"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {savedRuntime ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={reconnecting}
                className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-40"
              >
                关闭
              </button>
              {!reconnected && (
                <button
                  type="button"
                  onClick={() => void onReconnect()}
                  disabled={reconnecting}
                  className="rounded-lg border border-violet bg-violet px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
                >
                  {reconnecting ? '重连中…' : '重连运行时'}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-line bg-white px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={!view || saving}
                className="rounded-lg border border-violet bg-violet px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
