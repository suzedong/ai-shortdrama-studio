// feature-019 C7 · 架构断言（契约 §1-4 / §7，需求 AC-2）
// renderer 新代码不得 import opencode SDK / ark / ComfyUI / 引擎媒体模块；
// 不读取任何外部 URL、口令、Key。
import fsp from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const STUDIO_DIR = path.resolve(__dirname)

const FORBIDDEN_IMPORT_PATTERNS = [
  /@opencode-ai\/sdk/,
  /opencode-ai/,
  /electron\//,          // 主进程 / 引擎模块
  /electron\\/,
  // ComfyUI 作为产品名允许出现在 UI 文案；仅禁止以模块名被 import/require（C7 红线是 renderer 不直连引擎）
  /(?:from\s+|import\s*\(?\s*|require\(\s*)['"][^'"]*comfyui/i,
  /fluent-ffmpeg/,
  /sharp/,
  /\bark\b/i,
]

const FORBIDDEN_CONTENT_PATTERNS = [
  /https?:\/\//,
  /ARK_API_KEY/,
  /api[_-]?key/i,
  /password/i,
  /Bearer\s/,
]

// feature-014 合法例外（用户拍板，见 feature-014 变更记录）：AI 服务设置面板契约 §2.1 的
// DTO 命名空间即 view.ark.*，面板仅经 IPC（settings:ai:*）读写，校验/加密/落盘全在主进程，
// renderer 不直连引擎、不持有凭证发请求；「API Key」标签、type="password"、Base URL 占位符
// 均为设置表单合法文案。C7 红线意图（不直连/不持凭证）不破，其余文件扫描行为不变。
const EXEMPT_FILES = new Set(['shell/AiServicePanel.tsx'])

async function readSourceFiles(): Promise<{ file: string; content: string }[]> {
  const entries = await fsp.readdir(STUDIO_DIR, { recursive: true })
  const files = entries.filter(
    f =>
      /\.(ts|tsx)$/.test(f) &&
      !/\.(test|spec)\.(ts|tsx)$/.test(f) &&
      !EXEMPT_FILES.has(f.replace(/\\/g, '/')),
  )
  return Promise.all(files.map(async f => ({
    file: f,
    content: await fsp.readFile(path.join(STUDIO_DIR, f), 'utf8'),
  })))
}

describe('C7 · renderer 架构铁律', () => {
  it('无 opencode / ark / ComfyUI / 引擎 import', async () => {
    const sources = await readSourceFiles()
    expect(sources.length).toBeGreaterThanOrEqual(5)
    for (const { content } of sources) {
      for (const re of FORBIDDEN_IMPORT_PATTERNS) {
        expect(content).not.toMatch(re)
      }
    }
  })

  it('无外部 URL / 凭证 / 口令', async () => {
    const sources = await readSourceFiles()
    for (const { content } of sources) {
      for (const re of FORBIDDEN_CONTENT_PATTERNS) {
        expect(content).not.toMatch(re)
      }
    }
  })
})
