// 火山方舟（豆包）OpenAI 兼容接口封装
import 'dotenv/config'

const BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
const API_KEY = process.env.ARK_API_KEY
const MODEL = process.env.ARK_MODEL

interface ArkMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chat(messages: ArkMessage[], temperature = 0.7): Promise<string> {
  if (!API_KEY || !MODEL) {
    throw new Error('ARK_API_KEY 或 ARK_MODEL 未配置，请在 .env 中设置')
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`火山方舟 API 错误 ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// 脱敏：仅用于日志，不输出完整密钥
export function maskKey(): string {
  if (!API_KEY) return '(未配置)'
  return API_KEY.slice(0, 6) + '••••' + API_KEY.slice(-4)
}

export function isConfigured(): boolean {
  return !!(API_KEY && MODEL)
}
