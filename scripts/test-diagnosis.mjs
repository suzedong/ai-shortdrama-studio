// 内联测试：直接调用火山方舟 + 解析选题诊断
import 'dotenv/config'

const key = process.env.ARK_API_KEY
const model = process.env.ARK_MODEL
const base = process.env.ARK_BASE_URL

async function chat(messages, temperature = 0.7) {
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

const SYSTEM = `你是短剧行业分析师。根据用户的一句话创意，输出结构化选题诊断。
必须严格输出 JSON，格式如下：
{
  "benchmarkCases": [{"name":"案例名","platform":"平台","score":"成绩","play":"核心打法","insight":"对本项目启示"}],
  "userInsight": "赛道用户迁移方向一句话",
  "hookPatterns": ["模式A 先婚后爱","模式B 明撩暗撩","模式C 日常治愈","模式D 双向救赎"],
  "compliance": ["合规要点1","合规要点2"],
  "conclusion": "赛道判定（可做/不可做/需调整）+ 打法建议"
}
要求：
1. 对标案例 3-5 个，必须是真实存在的短剧/影视案例，含平台和成绩
2. hookPatterns 给出 4 种爆点模式及适用说明
3. compliance 必须包含：广电备案要求、AI 融像/融声授权红线
4. 只输出 JSON，不要任何其他文字`

const idea = '做一部校园恋爱短剧，女主大一新生，故事发生在夏天的海边小城，每集90秒，先做第一集'
console.log('创意:', idea)

const raw = await chat([
  { role: 'system', content: SYSTEM },
  { role: 'user', content: `用户创意：${idea}\n\n请输出选题诊断 JSON。` },
], 0.7)

console.log('--- 原始回复 ---')
console.log(raw.slice(0, 800))
console.log('...\n')

let text = raw.trim()
const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
if (m) text = m[1].trim()
const s = text.indexOf('{'), e = text.lastIndexOf('}')
if (s >= 0 && e > s) text = text.slice(s, e + 1)

try {
  const d = JSON.parse(text)
  console.log('✅ 解析成功')
  console.log('对标案例:', d.benchmarkCases?.length, '个')
  d.benchmarkCases?.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}（${c.platform} ${c.score}）`))
  console.log('用户洞察:', d.userInsight)
  console.log('钩子:', d.hookPatterns?.join(' / '))
  console.log('合规:', d.compliance?.join('；'))
  console.log('结论:', d.conclusion)
} catch (err) {
  console.error('❌ 解析失败:', err.message)
}
