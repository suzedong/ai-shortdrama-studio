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
  /comfyui/i,
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

async function readSourceFiles(): Promise<{ file: string; content: string }[]> {
  const entries = await fsp.readdir(STUDIO_DIR)
  const files = entries.filter(f => /\.(ts|tsx)$/.test(f) && !/\.(test|spec)\.(ts|tsx)$/.test(f))
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
