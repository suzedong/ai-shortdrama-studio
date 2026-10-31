// feature-808 D-011 · 工具动作短语映射与聚合摘要（纯函数层）
// 覆盖：物理 ID 双形态归一（点号 / 下划线）、裸名回退、未知工具不臆造、摘要去重计数与顺序。
import { describe, expect, it } from 'vitest'

import { summarizeToolActions, toolActionPhrase, toolArgPreview } from './tool-labels'

describe('feature-808 D-011 · tool-labels', () => {
  it('点号形式物理 ID → 中文短语（profile / 白名单形式）', () => {
    expect(toolActionPhrase('shortdrama_canvas_get')).toBe('读取画布')
    expect(toolActionPhrase('shortdrama_brief.plan')).toBe('检查立项草案')
    expect(toolActionPhrase('shortdrama_brief.impact.assess')).toBe('评估变更影响')
    expect(toolActionPhrase('shortdrama_capture.upsert')).toBe('写入已捕获口径')
    expect(toolActionPhrase('shortdrama_web.search')).toBe('检索公开网页')
    expect(toolActionPhrase('shortdrama_harness.validate')).toBe('运行基础校验')
  })

  it('下划线形式物理 ID → 中文短语（opencode 存储形式）', () => {
    expect(toolActionPhrase('shortdrama_brief_plan')).toBe('检查立项草案')
    expect(toolActionPhrase('shortdrama_brief_impact_assess')).toBe('评估变更影响')
    expect(toolActionPhrase('shortdrama_brief_impact_commit')).toBe('提交立项再版')
    expect(toolActionPhrase('shortdrama_canvas_update')).toBe('更新画布')
    expect(toolActionPhrase('shortdrama_capture_upsert')).toBe('写入已捕获口径')
    expect(toolActionPhrase('shortdrama_manifest_advance')).toBe('推进阶段状态')
    expect(toolActionPhrase('shortdrama_style_catalog')).toBe('读取风格谱系')
  })

  it('全部 28 个 MCP 工具族均有中文短语', () => {
    const ids = [
      'file.read', 'file.list', 'file.write',
      'canvas.get', 'canvas.update', 'canvas.align',
      'gate.request',
      'asset.register', 'asset.list',
      'comfyui.instances', 'comfyui.queue', 'comfyui.status',
      'brief.plan', 'brief.publish', 'brief.list',
      'brief.impact.assess', 'brief.impact.commit',
      'manifest.get', 'manifest.advance',
      'style.catalog', 'style.get', 'style.validate',
      'capture.list', 'capture.upsert', 'capture.remove',
      'web.search', 'web.fetch',
      'harness.validate',
    ]
    for (const id of ids) {
      const phrase = toolActionPhrase(`shortdrama_${id}`)
      expect(phrase, id).not.toBe(`shortdrama_${id}`)
      expect(phrase, id).not.toContain('_')
    }
  })

  it('裸名（去前缀）同样可查', () => {
    expect(toolActionPhrase('canvas.get')).toBe('读取画布')
    expect(toolActionPhrase('brief.plan')).toBe('检查立项草案')
  })

  it('未知工具回退去前缀原 ID，不臆造名称', () => {
    expect(toolActionPhrase('shortdrama_unknown.tool')).toBe('unknown.tool')
    expect(toolActionPhrase('task')).toBe('task')
    expect(toolActionPhrase('')).toBe('')
  })

  it('摘要：去重 + 计数 + 首次出现顺序；计数为 1 省略 ×1', () => {
    expect(summarizeToolActions(['shortdrama_canvas_get'])).toBe('读取画布')
    expect(
      summarizeToolActions([
        'shortdrama_canvas_get',
        'shortdrama_capture_upsert',
        'shortdrama_canvas_get',
      ]),
    ).toBe('读取画布 ×2 · 写入已捕获口径')
  })

  it('摘要：空输入 → 空串；混未知工具也参与聚合', () => {
    expect(summarizeToolActions([])).toBe('')
    expect(summarizeToolActions(['shortdrama_canvas_get', 'task'])).toBe('读取画布 · task')
  })
})

describe('feature-808 D-012 · toolArgPreview（白名单关键参数摘要）', () => {
  it('白名单工具取关键参数；点号 / 下划线 / 去前缀形态一致', () => {
    expect(toolArgPreview('shortdrama_capture_upsert', { topic: '题材赛道', id: 'cap-1' })).toBe('题材赛道')
    expect(toolArgPreview('shortdrama_capture.upsert', { topic: '题材赛道' })).toBe('题材赛道')
    expect(toolArgPreview('capture_upsert', { topic: '题材赛道' })).toBe('题材赛道')
    expect(toolArgPreview('shortdrama_web_search', { query: '短剧 市场规模' })).toBe('短剧 市场规模')
    expect(toolArgPreview('shortdrama_file_write', { path: 'brief/立项单.v3.json', content: 'x' })).toBe('brief/立项单.v3.json')
  })

  it('候选键按优先级取首个非空字符串；非字符串 / 空白串跳过', () => {
    // topic 缺省 → 退到 id
    expect(toolArgPreview('shortdrama_capture_upsert', { id: 'cap-1' })).toBe('cap-1')
    // topic 非字符串 → 跳过取 id
    expect(toolArgPreview('shortdrama_capture_upsert', { topic: 42, id: 'cap-1' })).toBe('cap-1')
    // topic 空白串 → 跳过取 id
    expect(toolArgPreview('shortdrama_capture_upsert', { topic: '  ', id: 'cap-1' })).toBe('cap-1')
    // 候选键全部落空 → ''
    expect(toolArgPreview('shortdrama_capture_upsert', { value: 'v' })).toBe('')
  })

  it('无白名单工具 / 未知工具 / 非法入参 → 空串', () => {
    expect(toolArgPreview('shortdrama_canvas_get', {})).toBe('')
    expect(toolArgPreview('shortdrama_brief_plan', { briefId: 'b1' })).toBe('')
    expect(toolArgPreview('shortdrama_unknown_tool', { path: 'a' })).toBe('')
    expect(toolArgPreview('shortdrama_file_read', null)).toBe('')
    expect(toolArgPreview('shortdrama_file_read', 'path')).toBe('')
    expect(toolArgPreview('', { path: 'a' })).toBe('')
  })

  it('超长值截断至 80 字符并加省略号', () => {
    const long = 'a'.repeat(100)
    const out = toolArgPreview('shortdrama_web_fetch', { url: long })
    expect(out).toBe(`${'a'.repeat(80)}…`)
    expect(toolArgPreview('shortdrama_web_fetch', { url: 'a'.repeat(80) })).toBe('a'.repeat(80))
  })
})
