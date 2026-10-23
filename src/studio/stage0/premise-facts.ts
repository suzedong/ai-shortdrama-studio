// feature-009 · 前提卡分色与不可篡改水印（纯函数层）
// 只消费 capture 事实（CapturedFact）；禁止 fs / window.api / Date / 随机；零 import 副作用（jsdom 安全）。
import type { ProjectBrief, CapturedFact } from '../../../shared/types'
import { matchChainTopic } from './chain'
import { PREMISE_FIELDS } from './select'

export type PremiseConfirmation = 'human' | 'ai' | 'none'

/** 前提五键 → 人确认/AI 拟稿/无记录（契约 §1 真值表；返回五键全覆盖，键 = PREMISE_FIELDS 表序） */
export function selectPremiseConfirmation(
  facts: CapturedFact[],
): Record<keyof ProjectBrief['premise'], PremiseConfirmation> {
  const hitKeys = new Set<string>()
  const confirmedKeys = new Set<string>()
  for (const fact of facts) {
    const m = matchChainTopic(fact.topic)
    if (!m || m.group !== 'premise') continue
    hitKeys.add(m.key)
    if (fact.status === 'confirmed') confirmedKeys.add(m.key)
  }
  const out = {} as Record<keyof ProjectBrief['premise'], PremiseConfirmation>
  for (const { key } of PREMISE_FIELDS) {
    out[key] = !hitKeys.has(key) ? 'none' : confirmedKeys.has(key) ? 'human' : 'ai'
  }
  return out
}
