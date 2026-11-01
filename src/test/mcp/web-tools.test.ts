// feature-006 · Bing 国内搜索与公开网页抓取契约（契约 §2.2/§5）
// 零外网：fetchImpl 依赖注入 mock；纯函数零项目上下文。
import { describe, expect, it, vi } from 'vitest'
import {
  WEB_FETCH_MAX_CHARS,
  decodeHtmlEntities,
  htmlToText,
  parseBingResults,
  webFetchText,
  webSearch,
} from '../../../electron/mcp/tools'

function mockFetchWithHtml(html: string) {
  return vi.fn(async () => ({ ok: true, status: 200, text: async () => html })) as unknown as typeof fetch
}

const BING_HTML = `
<ol id="b_results">
  <li class="b_algo">
    <h2><a href="https://example.com/drama?a=1&amp;b=2">逆袭短剧 &amp; 甜宠 复盘</a></h2>
    <div class="b_caption"><p>2024 年逆袭题材数据 &middot; 钩子模式分析</p></div>
  </li>
  <li class='b_algo'>
    <h2><a href='https://direct.example.org/article'>直链标题</a></h2>
    <p>第二段摘要 &#8212; 平台打法</p>
  </li>
  <li class="b_algo"><h2><a href="javascript:void(0)">无效条目应剔除</a></h2></li>
</ol>`

describe('parseBingResults 解析契约', () => {
  it('标题/直链/摘要配对，实体解码并剔除无效链接', () => {
    const items = parseBingResults(BING_HTML)
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: '逆袭短剧 & 甜宠 复盘',
      url: 'https://example.com/drama?a=1&b=2',
      snippet: '2024 年逆袭题材数据 · 钩子模式分析',
    })
    expect(items[1]).toEqual({
      title: '直链标题',
      url: 'https://direct.example.org/article',
      snippet: '第二段摘要 — 平台打法',
    })
  })

  it('maxResults 截断且默认最多 8 条', () => {
    const ten = Array.from({ length: 10 }, (_, i) =>
      `<li class="b_algo"><h2><a href="https://example.com/${i}">标题 ${i}</a></h2><p>摘要 ${i}</p></li>`,
    ).join('')
    expect(parseBingResults(BING_HTML, 1)).toHaveLength(1)
    expect(parseBingResults(ten)).toHaveLength(8)
  })

  it('无摘要区块时 snippet 为空串，正常无结果页返回空数组', () => {
    const html = `<li class="b_algo"><h2><a href="https://a.example.com/">仅标题</a></h2></li>`
    expect(parseBingResults(html)).toEqual([{ title: '仅标题', url: 'https://a.example.com/', snippet: '' }])
    expect(parseBingResults('<ol id="b_results"><li class="b_no">没有结果</li></ol>')).toEqual([])
  })
})

describe('文本工具函数', () => {
  it('decodeHtmlEntities：命名 + 十/十六进制数字实体', () => {
    expect(decodeHtmlEntities('a &amp; b &#8212; c &#x2014; &quot;d&quot;')).toBe('a & b — c — "d"')
  })

  it('htmlToText：去脚本/样式/注释/标签并折叠空白', () => {
    const html = `<style>.x{color:red}</style><script>var a=1</script><!-- c --><h1>标题</h1><p>正文  多   空白</p>`
    expect(htmlToText(html)).toBe('标题 正文 多 空白')
  })
})

describe('webSearch 形状与错误信封', () => {
  it('正常路径：请求 Bing 国内站（query 编码）并回结果列表', async () => {
    const fetchImpl = mockFetchWithHtml(BING_HTML)
    const results = await webSearch('逆袭 短剧', fetchImpl)
    expect(results).toHaveLength(2)
    const calledUrl = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    expect(calledUrl).toBe(`https://cn.bing.com/search?q=${encodeURIComponent('逆袭 短剧')}`)
  })

  it('空检索词 → INVALID_ARGUMENT（不发请求）', async () => {
    const fetchImpl = mockFetchWithHtml(BING_HTML)
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

  it('人机验证页 → WEB_SEARCH_FAILED；正常无结果页允许空数组', async () => {
    await expect(webSearch('x', mockFetchWithHtml('<div id="b_captcha">请输入验证码</div>')))
      .rejects.toMatchObject({ code: 'WEB_SEARCH_FAILED' })
    await expect(webSearch('x', mockFetchWithHtml('<ol id="b_results"></ol>'))).resolves.toEqual([])
  })
})

describe('webFetchText 形状与错误信封', () => {
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
