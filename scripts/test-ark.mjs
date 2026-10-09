// 快速验证火山方舟 API 连通性 —— 不回显密钥
import 'dotenv/config'

const key = process.env.ARK_API_KEY
const model = process.env.ARK_MODEL
const base = process.env.ARK_BASE_URL

console.log('API Key:', key ? key.slice(0, 8) + '••••' + key.slice(-4) : '(未配置)')
console.log('Model:', model)
console.log('Base URL:', base)
console.log('--- 发起调用 ---')

try {
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: '用一句话回答：1+1等于几？' }],
      temperature: 0.3,
    }),
  })
  const text = await res.text()
  console.log('HTTP', res.status)
  if (!res.ok) { console.error('错误响应:', text.slice(0, 500)); process.exit(1) }
  const data = JSON.parse(text)
  console.log('模型回复:', data.choices?.[0]?.message?.content)
  console.log('✅ 连通性验证通过')
} catch (e) {
  console.error('❌ 调用失败:', e.message)
  process.exit(1)
}
