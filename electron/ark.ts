// 火山方舟（豆包）OpenAI 兼容接口封装
// feature-014：废模块级 const，改每次调用经 ai-service store 动态读合并生效值
// （store → env → 内置默认），「AI 服务设置」保存后下一条消息即生效，无需重启。
// dotenv 保留作 env 回退源；明文 Key 不出主进程内存（日志仅脱敏）。
import 'dotenv/config'
import { getArkConfig, maskKeyString } from './settings/ai-service.js'

interface ArkMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chat(messages: ArkMessage[], temperature = 0.7): Promise<string> {
  const { apiKey, baseUrl, model } = getArkConfig()
  if (!apiKey || !model) {
    throw new Error('未配置火山方舟接口，请在「AI 服务设置」中配置 API Key 与模型名（或设置 ARK_API_KEY/ARK_MODEL 环境变量）')
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
  const { apiKey } = getArkConfig()
  if (!apiKey) return '(未配置)'
  return maskKeyString(apiKey)
}

export function isConfigured(): boolean {
  const { apiKey, model } = getArkConfig()
  return !!(apiKey && model)
}
