// feature-806 · B-46 漂移提醒纯函数测试（契约 §5.4：null 分支、29/30/31 天边界、未来时间戳按 0）
import { describe, expect, it } from 'vitest'

import { driftDays, driftReminderLabel } from './dirty-drift'

const DAY = 86400000
const NOW = Date.parse('2026-10-27T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('feature-806 · driftDays（契约 §3.2）', () => {
  it('无 markedAt / 空串 / 非法时间 → null', () => {
    expect(driftDays(undefined, NOW)).toBeNull()
    expect(driftDays('', NOW)).toBeNull()
    expect(driftDays('not-a-date', NOW)).toBeNull()
  })

  it('未来时间戳按 0；不足一天按 0；整天数 floor', () => {
    expect(driftDays(new Date(NOW + DAY).toISOString(), NOW)).toBe(0)
    expect(driftDays(ago(1000), NOW)).toBe(0)
    expect(driftDays(ago(DAY - 1), NOW)).toBe(0)
    expect(driftDays(ago(30 * DAY + 1000), NOW)).toBe(30)
    expect(driftDays(ago(45 * DAY), NOW)).toBe(45)
  })

  it('now 缺省走系统时钟：当前时间戳 → 0', () => {
    expect(driftDays(new Date().toISOString())).toBe(0)
  })
})

describe('feature-806 · driftReminderLabel（>30 天才提醒，不阻塞）', () => {
  it('null / 29 / 30 天 → 不提醒', () => {
    expect(driftReminderLabel(null)).toBeNull()
    expect(driftReminderLabel(29)).toBeNull()
    expect(driftReminderLabel(30)).toBeNull()
  })

  it('31 天起 → 「立项基线已漂移 N 天（不阻塞）」', () => {
    expect(driftReminderLabel(31)).toBe('立项基线已漂移 31 天（不阻塞）')
    expect(driftReminderLabel(45)).toBe('立项基线已漂移 45 天（不阻塞）')
  })
})
