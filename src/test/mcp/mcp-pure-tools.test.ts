import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const toolsSrc = fs.readFileSync(path.join(here, '../../../electron/mcp/tools.ts'), 'utf-8')

describe('T8 mcp/tools.ts 静态护栏', () => {
  it('不含 ark / prompts / style-catalog / session 依赖与对话调用', () => {
    // \b 词边界：pendingMarks 等合法标识符不应误伤（feature-001）
    expect(toolsSrc).not.toMatch(/\bark\b/)
    expect(toolsSrc).not.toMatch(/prompts/)
    expect(toolsSrc).not.toMatch(/style-catalog/)
    expect(toolsSrc).not.toMatch(/chat\(/)
  })

  it('注册 28 个工具（含 brief 三件套、manifest 两件套、feature-802 style 三件套、feature-002 再版三件套、feature-005 capture 三件套、feature-006 web 两件套、feature-806 harness 一件套）', () => {
    const names = [
      'file.read', 'file.list', 'file.write',
      'canvas.get', 'canvas.update',
      'gate.request',
      'asset.register', 'asset.list',
      'comfyui.instances', 'comfyui.queue', 'comfyui.status',
      'brief.plan', 'brief.publish', 'brief.list',
      'manifest.get', 'manifest.advance',
      'style.catalog', 'style.get', 'style.validate',
      // feature-002：立项再版评估/提交 + 节点对齐（契约 §9.4）
      'brief.impact.assess', 'brief.impact.commit', 'canvas.align',
      // feature-005：已捕获口径三件套（契约 §2，K8 登记 22→25）
      'capture.list', 'capture.upsert', 'capture.remove',
      // feature-006：公开数据检索两件套（契约 §2.2 补登，K8 登记 25→27）
      'web.search', 'web.fetch',
      // feature-806：STAGE 0 harness 基础校验（K8 登记 27→28，与 0-final 门写盘前拦截同一实现）
      'harness.validate',
    ]
    for (const n of names) {
      expect(toolsSrc).toContain(`'${n}'`)
    }
    expect((toolsSrc.match(/server\.tool\(/g) ?? []).length).toBe(28)
  })

  it('统一 { ok } 结构：无旧信封字段', () => {
    expect(toolsSrc).not.toMatch(/ToolResultEnvelope|BusinessToolName|registerBusinessTools/)
  })
})
