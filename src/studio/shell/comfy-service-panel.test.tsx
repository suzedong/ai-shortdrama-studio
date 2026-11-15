import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComfyServicePanel from './ComfyServicePanel'

const savedInstance: ComfyInstanceConfig = {
  id: 'c1', name: '主力 GPU', baseUrl: 'http://192.168.1.20:8188', enabled: true,
  addedAt: '2026-01-01T00:00:00.000Z', gpus: ['GPU 0'], vramGB: 24,
}

function install(initial: ComfyInstanceConfig[] = [savedInstance]) {
  const list = vi.fn(async () => initial.map(item => ({ ...item })))
  const upsert = vi.fn(async (input: Partial<ComfyInstanceConfig>) => ({
    ...savedInstance, ...input, id: input.id ?? 'c-new', addedAt: input.addedAt ?? savedInstance.addedAt,
  })) as (input: Partial<ComfyInstanceConfig>) => Promise<ComfyInstanceConfig>
  const remove = vi.fn(async () => ({ ok: true as const }))
  const test = vi.fn(async () => ({ ok: true as const, comfyuiVersion: '0.3.0', deviceCount: 2 }))
  window.api = { settings: { comfy: { list, upsert, remove, test } } } as unknown as Window['api']
  const onClose = vi.fn()
  render(<ComfyServicePanel onClose={onClose} />)
  return { list, upsert: vi.mocked(upsert), remove, test, onClose }
}

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  vi.clearAllMocks()
  user = userEvent.setup()
})

describe('ComfyServicePanel', () => {
  it('加载应用级实例并通过 IPC 启停', async () => {
    const harness = install()
    expect(await screen.findByTestId('comfy-instance-c1')).toHaveTextContent('GPU GPU 0 · 24 GB')
    const checkbox = screen.getByRole('checkbox', { name: '启用 主力 GPU' })
    await user.click(checkbox)
    await waitFor(() => expect(harness.upsert).toHaveBeenCalledWith({ ...savedInstance, enabled: false }))
    expect(checkbox).not.toBeChecked()
    expect(harness.list).toHaveBeenCalledTimes(1)
  })

  it('测试编辑器未保存地址，再保存完整实例字段', async () => {
    const harness = install([])
    expect(await screen.findByText('尚未配置 ComfyUI 实例')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '新增实例' }))
    await user.type(screen.getByLabelText('实例名称'), '第二工作站')
    const url = screen.getByLabelText('ComfyUI Base URL')
    await user.clear(url)
    await user.type(url, 'http://192.168.1.30:8188')
    await user.type(screen.getByLabelText('GPU 标识'), 'GPU 0, GPU 1')
    await user.type(screen.getByLabelText('显存（GB）'), '48')

    await user.click(screen.getByRole('button', { name: '测试未保存地址' }))
    expect(harness.test).toHaveBeenCalledWith({ baseUrl: 'http://192.168.1.30:8188' })
    expect(await screen.findByTestId('comfy-test-result')).toHaveTextContent('ComfyUI 0.3.0，2 个计算设备')

    await user.click(screen.getByRole('button', { name: '保存实例' }))
    await waitFor(() => expect(harness.upsert).toHaveBeenCalledWith({
      name: '第二工作站', baseUrl: 'http://192.168.1.30:8188', enabled: true,
      gpus: ['GPU 0', 'GPU 1'], vramGB: 48,
    }))
    expect(await screen.findByTestId('comfy-instance-c-new')).toHaveTextContent('第二工作站')
    expect(screen.queryByTestId('comfy-editor')).not.toBeInTheDocument()
  })

  it('连接失败剥出主进程错误且不影响列表', async () => {
    const harness = install()
    harness.test.mockRejectedValueOnce(new Error("Error invoking remote method 'settings:comfy:test': Error: COMFY_UNREACHABLE: 无法连接"))
    await screen.findByTestId('comfy-instance-c1')
    await user.click(screen.getByRole('button', { name: '测试 主力 GPU' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('连接失败：COMFY_UNREACHABLE: 无法连接')
    expect(screen.getByTestId('comfy-instance-c1')).toBeInTheDocument()
  })

  it('删除必须行内二次确认', async () => {
    const harness = install()
    await screen.findByTestId('comfy-instance-c1')
    await user.click(screen.getByRole('button', { name: '删除 主力 GPU' }))
    expect(harness.remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(harness.remove).toHaveBeenCalledWith('c1'))
    expect(screen.queryByTestId('comfy-instance-c1')).not.toBeInTheDocument()
    expect(screen.getByTestId('comfy-test-result')).toHaveTextContent('已删除')
  })

  it('非法显存不发保存请求，关闭按钮交还父面板', async () => {
    const harness = install([])
    await screen.findByText('尚未配置 ComfyUI 实例')
    await user.click(screen.getByRole('button', { name: '新增实例' }))
    await user.type(screen.getByLabelText('显存（GB）'), '0')
    await user.click(screen.getByRole('button', { name: '保存实例' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('显存必须为大于 0 的数字')
    expect(harness.upsert).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '关闭' }))
    expect(harness.onClose).toHaveBeenCalledTimes(1)
  })
})
