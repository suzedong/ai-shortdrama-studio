// feature-006 · T4：公开数据检索纯函数契约（契约 §2.2/§5）
// 零外网：fetchImpl 依赖注入 mock；纯函数零项目上下文（不依赖激活项目）。
import { describe, expect, it, vi } from 'vitest'
import {
  WEB_FETCH_MAX_CHARS,
  decodeHtmlEntities,
  htmlToText,
  parseDdgResults,
  webFetchText,
  webSearch,
} from '../../../electron/mcp/tools'

function mockFetchWithHtml(html: string) {
  return vi.fn(async () => ({ ok: true, status: 200, text: async () => html })) as unknown as typeof fetch
}

const DDG_HTML = `
<div class="result results_links">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdrama&amp;rut=abc123">逆袭短剧 &amp; 甜宠 复盘</a>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdrama">2024 年逆袭题材数据 &middot; 钩子模式分析</a>
</div>
<div class="result results_links">
  <a class="result__a" href="https://direct.example.org/article">直链标题</a>
  <div class="result__snippet">第二段摘要 &#8212; 平台打法</div>
</div>
<a class="result__a" href="/local/relative-path">不可解码条目应剔除</a>
`

describe('T4 · parseDdgResults 解析契约', () => {
  it('uddg 重定向解码 + 实体解码 + 同区块 snippet 配对 + 不可解码条目剔除', () => {
    const items = parseDdgResults(DDG_HTML)
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: '逆袭短剧 & 甜宠 复盘',
      url: 'https://example.com/drama',
      snippet: '2024 年逆袭题材数据 · 钩子模式分析',
    })
    expect(items[1]).toEqual({
      title: '直链标题',
      url: 'https://direct.example.org/article',
      snippet: '第二段摘要 — 平台打法',
    })
  })

  it('maxResults 截断：上限 1 条时只回第 1 条', () => {
    expect(parseDdgResults(DDG_HTML, 1)).toHaveLength(1)
  })

  it('无 snippet 区块时 snippet 为空串', () => {
    const html = `<a class="result__a" href="https://a.example.com/">仅标题</a>`
    expect(parseDdgResults(html)).toEqual([{ title: '仅标题', url: 'https://a.example.com/', snippet: '' }])
  })
})

describe('T4 · 文本工具函数', () => {
  it('decodeHtmlEntities：命名 + 十/十六进制数字实体', () => {
    expect(decodeHtmlEntities('a &amp; b &#8212; c &#x2014; &quot;d&quot;')).toBe('a & b — c — "d"')
  })

  it('htmlToText：去脚本/样式/注释/标签并折叠空白', () => {
    const html = `<style>.x{color:red}</style><script>var a=1</script><!-- c --><h1>标题</h1><p>正文  多   空白</p>`
    expect(htmlToText(html)).toBe('标题 正文 多 空白')
  })
})

describe('T4 · webSearch 形状与错误信封', () => {
  it('正常路径：请求 DDG html 端点（query 编码）并回结果列表', async () => {
    const fetchImpl = mockFetchWithHtml(DDG_HTML)
    const results = await webSearch('逆袭 短剧', fetchImpl)
    expect(results).toHaveLength(2)
    const calledUrl = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    expect(calledUrl).toContain('html.duckduckgo.com')
    expect(calledUrl).toContain(`q=${encodeURIComponent('逆袭 短剧')}`)
  })

  it('空检索词 → INVALID_ARGUMENT（不发请求）', async () => {
    const fetchImpl = mockFetchWithHtml(DDG_HTML)
    await expect(webSearch('   ', fetchImpl)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('网络异常 → WEB_SEARCH_FAILED 信封', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('socket hang up') }) as unknown as typeof fetch
    await expect(webSearch('x', fetchImpl)).rejects.toMatchObject({ code: 'WEB_SEARCH_FAILED' })
  })

  it('非 2xx → WEB_SEARCH_FAILED 信封', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, text: async () => '' })) as unknown as typeof fetch
    await expect(webSearch('x', fetchImpl)).rejects.toMatchObject({ code: 'WEB_SEARCH_FAILED' })
  })
})

describe('T4 · webFetchText 形状与错误信封', () => {
  it('正常路径：HTML → 正文文本', async () => {
    const fetchImpl = mockFetchWithHtml(`<html><body><script>bad()</script><article>正文内容</article></body></html>`)
    await expect(webFetchText('https://a.example.com/p', fetchImpl)).resolves.toBe('正文内容')
  })

  it('超 maxChars 截断（含默认上限常量语义）', async () => {
    const fetchImpl = mockFetchWithHtml(`<p>${'a'.repeat(100)}</p>`)
    const text = await webFetchText('https://a.example.com/', fetchImpl, 50)
    expect(text).toHaveLength(50)
    expect(WEB_FETCH_MAX_CHARS).toBe(20_000)
  })

  it('非 http/https → INVALID_ARGUMENT（不发请求）', async () => {
    const fetchImpl = mockFetchWithHtml('<p>x</p>')
    await expect(webFetchText('file:///etc/passwd', fetchImpl)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('网络异常 → WEB_FETCH_FAILED 信封', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch
    await expect(webFetchText('https://a.example.com/', fetchImpl)).rejects.toMatchObject({ code: 'WEB_FETCH_FAILED' })
  })

  it('非 2xx → WEB_FETCH_FAILED 信封', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })) as unknown as typeof fetch
    await expect(webFetchText('https://a.example.com/', fetchImpl)).rejects.toMatchObject({ code: 'WEB_FETCH_FAILED' })
  })
})
