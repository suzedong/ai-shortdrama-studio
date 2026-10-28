// feature-806 · B-46 漂移提醒纯函数（契约 §3.2；系统直算、零日期库、不阻塞）
// 漂移计时锚点 = 最近一次「仅标记脏」决策时间（CanvasDirty.markedAt，设计说明 D-005）。

const DAY_MS = 86400000

/**
 * 漂移天数：无 markedAt / 非法时间 → null；未来时间戳按 0；其余返回 floor 整天数。
 * now 可注入（测试与主进程复用同一算法，不另写第二份）。
 */
export function driftDays(markedAt?: string, now: number = Date.now()): number | null {
  if (!markedAt) return null
  const ts = Date.parse(markedAt)
  if (Number.isNaN(ts)) return null
  const diff = now - ts
  if (diff <= 0) return 0
  return Math.floor(diff / DAY_MS)
}

/** 提醒文案：仅漂移超 30 天返回「立项基线已漂移 N 天（不阻塞）」；其余（含 null）→ null */
export function driftReminderLabel(days: number | null): string | null {
  if (days === null || days <= 30) return null
  return `立项基线已漂移 ${days} 天（不阻塞）`
}
