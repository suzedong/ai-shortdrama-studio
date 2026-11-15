// feature-803 · 应用级 ComfyUI 多实例设置；仅经 IPC，不在 renderer 发起媒体网络请求
import { useCallback, useEffect, useState } from 'react'
import { ipcErrorMessage } from './ipc-error'

interface EditorState {
  id?: string
  addedAt?: string
  name: string
  baseUrl: string
  enabled: boolean
  gpus: string
  vramGB: string
}

const inputClass = 'mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-muted focus:border-violet disabled:bg-canvas'
const buttonClass = 'rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50'

export default function ComfyServicePanel({ onClose }: { onClose: () => void }) {
  const [instances, setInstances] = useState<ComfyInstanceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ComfyInstanceConfig | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setInstances(await window.api.settings.comfy.list())
    } catch (cause) {
      setError(ipcErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openNew() {
    setNotice(null)
    setError(null)
    setEditor({ name: '', baseUrl: '', enabled: true, gpus: '', vramGB: '' })
  }

  function openEdit(instance: ComfyInstanceConfig) {
    setNotice(null)
    setError(null)
    setEditor({
      id: instance.id,
      addedAt: instance.addedAt,
      name: instance.name,
      baseUrl: instance.baseUrl,
      enabled: instance.enabled,
      gpus: instance.gpus?.join(', ') ?? '',
      vramGB: instance.vramGB?.toString() ?? '',
    })
  }

  async function saveEditor() {
    if (!editor || saving) return
    const vramText = editor.vramGB.trim()
    if (vramText && (!Number.isFinite(Number(vramText)) || Number(vramText) <= 0)) {
      setError('显存必须为大于 0 的数字')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const saved = await window.api.settings.comfy.upsert({
        ...(editor.id ? { id: editor.id } : {}),
        ...(editor.addedAt ? { addedAt: editor.addedAt } : {}),
        name: editor.name,
        baseUrl: editor.baseUrl,
        enabled: editor.enabled,
        gpus: editor.gpus.split(',').map(value => value.trim()).filter(Boolean),
        vramGB: vramText ? Number(vramText) : undefined,
      })
      setInstances(current => {
        const index = current.findIndex(item => item.id === saved.id)
        return index >= 0
          ? current.map(item => item.id === saved.id ? saved : item)
          : [...current, saved]
      })
      setEditor(null)
      setNotice(`实例「${saved.name}」已保存`)
    } catch (cause) {
      setError(ipcErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function toggle(instance: ComfyInstanceConfig) {
    if (pendingId) return
    setPendingId(instance.id)
    setError(null)
    setNotice(null)
    try {
      const saved = await window.api.settings.comfy.upsert({ ...instance, enabled: !instance.enabled })
      setInstances(current => current.map(item => item.id === saved.id ? saved : item))
    } catch (cause) {
      setError(ipcErrorMessage(cause))
    } finally {
      setPendingId(null)
    }
  }

  async function remove() {
    if (!deleting || pendingId) return
    setPendingId(deleting.id)
    setError(null)
    setNotice(null)
    try {
      await window.api.settings.comfy.remove(deleting.id)
      setInstances(current => current.filter(item => item.id !== deleting.id))
      if (editor?.id === deleting.id) setEditor(null)
      setNotice(`实例「${deleting.name}」已删除`)
      setDeleting(null)
    } catch (cause) {
      setError(ipcErrorMessage(cause))
    } finally {
      setPendingId(null)
    }
  }

  async function test(baseUrl: string, key: string) {
    if (testing) return
    setTesting(key)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.settings.comfy.test({ baseUrl })
      const devices = result.deviceCount > 0 ? `，${result.deviceCount} 个计算设备` : ''
      setNotice(`连接成功${result.comfyuiVersion ? `：ComfyUI ${result.comfyuiVersion}` : ''}${devices}`)
    } catch (cause) {
      setError(`连接失败：${ipcErrorMessage(cause)}`)
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="mt-3" data-testid="comfy-service-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] leading-5 text-muted">实例保存在应用级配置中，所有项目共享；仅允许本机与局域网地址。</p>
        <button type="button" className={buttonClass} onClick={openNew} disabled={saving || !!pendingId}>新增实例</button>
      </div>

      {error && <div role="alert" className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[11.5px] leading-5 text-bad">{error}</div>}
      {notice && <div role="status" data-testid="comfy-test-result" className="mt-3 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[11.5px] leading-5 text-ok">{notice}</div>}

      {editor && (
        <div className="mt-3 rounded-lg border border-line bg-canvas/60 p-3" data-testid="comfy-editor">
          <h4 className="text-[12px] font-bold text-ink">{editor.id ? '编辑实例' : '新增实例'}</h4>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="text-[11.5px] font-semibold text-ink">
              实例名称
              <input aria-label="实例名称" className={inputClass} value={editor.name} disabled={saving} onChange={event => setEditor({ ...editor, name: event.target.value })} placeholder="如 工作站 01" />
            </label>
            <label className="text-[11.5px] font-semibold text-ink">
              显存（GB，可选）
              <input aria-label="显存（GB）" className={inputClass} value={editor.vramGB} disabled={saving} onChange={event => setEditor({ ...editor, vramGB: event.target.value })} placeholder="如 24" inputMode="decimal" />
            </label>
          </div>
          <label className="mt-3 block text-[11.5px] font-semibold text-ink">
            Base URL
            <input aria-label="ComfyUI Base URL" className={inputClass} value={editor.baseUrl} disabled={saving} onChange={event => setEditor({ ...editor, baseUrl: event.target.value })} placeholder="本机或局域网 ComfyUI 地址" />
          </label>
          <label className="mt-3 block text-[11.5px] font-semibold text-ink">
            GPU 标识（可选，逗号分隔）
            <input aria-label="GPU 标识" className={inputClass} value={editor.gpus} disabled={saving} onChange={event => setEditor({ ...editor, gpus: event.target.value })} placeholder="如 0, 1" />
          </label>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-ink">
            <input aria-label="启用此实例" type="checkbox" checked={editor.enabled} disabled={saving} onChange={event => setEditor({ ...editor, enabled: event.target.checked })} />
            启用此实例
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={buttonClass} disabled={saving || !!testing} onClick={() => setEditor(null)}>取消</button>
            <button type="button" aria-label="测试未保存地址" className={buttonClass} disabled={saving || !!testing} onClick={() => void test(editor.baseUrl, 'editor')}>
              {testing === 'editor' ? '测试中…' : '测试连接'}
            </button>
            <button type="button" className="rounded-md bg-violet px-3 py-1.5 text-[12px] font-bold text-white hover:brightness-95 disabled:opacity-50" disabled={saving || !!testing} onClick={() => void saveEditor()}>
              {saving ? '保存中…' : '保存实例'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2" data-testid="comfy-list">
        {loading ? <p className="py-4 text-center text-[11.5px] text-muted">实例读取中…</p>
          : instances.length === 0 ? <p className="rounded-lg border border-dashed border-line py-5 text-center text-[11.5px] text-muted">尚未配置 ComfyUI 实例</p>
            : instances.map(instance => (
              <div key={instance.id} className="rounded-lg border border-line px-3 py-2.5" data-testid={`comfy-instance-${instance.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-bold text-ink">{instance.name}</span>
                      <span className={`text-[10.5px] ${instance.enabled ? 'text-ok' : 'text-muted'}`}>{instance.enabled ? '已启用' : '已禁用'}</span>
                    </div>
                    <p className="mt-0.5 break-all text-[11px] text-muted">{instance.baseUrl}</p>
                    {(instance.gpus?.length || instance.vramGB) && <p className="mt-0.5 text-[10.5px] text-muted">{instance.gpus?.length ? `GPU ${instance.gpus.join(' / ')}` : ''}{instance.gpus?.length && instance.vramGB ? ' · ' : ''}{instance.vramGB ? `${instance.vramGB} GB` : ''}</p>}
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink">
                    <input aria-label={`启用 ${instance.name}`} type="checkbox" checked={instance.enabled} disabled={!!pendingId || saving} onChange={() => void toggle(instance)} />
                    启用
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <button type="button" aria-label={`测试 ${instance.name}`} className={buttonClass} disabled={!!testing || !!pendingId} onClick={() => void test(instance.baseUrl, instance.id)}>{testing === instance.id ? '测试中…' : '测试连接'}</button>
                  <button type="button" aria-label={`编辑 ${instance.name}`} className={buttonClass} disabled={!!pendingId || saving} onClick={() => openEdit(instance)}>编辑</button>
                  <button type="button" aria-label={`删除 ${instance.name}`} className={`${buttonClass} text-bad`} disabled={!!pendingId || saving} onClick={() => { setDeleting(instance); setError(null); setNotice(null) }}>删除</button>
                </div>
                {deleting?.id === instance.id && (
                  <div className="mt-2 rounded-md border border-bad/30 bg-bad/10 p-2 text-[11.5px] text-ink" role="group" aria-label={`确认删除 ${instance.name}`}>
                    <p>确认删除「{instance.name}」？进行中的作业仍可按快照续查。</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button type="button" className={buttonClass} onClick={() => setDeleting(null)}>取消</button>
                      <button type="button" className="rounded-md bg-bad px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50" disabled={pendingId === instance.id} onClick={() => void remove()}>{pendingId === instance.id ? '删除中…' : '确认删除'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
      </div>

      <div className="mt-4 flex justify-end border-t border-line pt-3">
        <button type="button" className={buttonClass} disabled={saving || !!pendingId} onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
