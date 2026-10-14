// feature-804 · 窗口外壳平台分支纯函数（契约 §8.1）
import { describe, expect, it } from 'vitest'
import { windowChromeOptions, type WindowPlatform } from '../../electron/window/chrome'

describe('feature-804 windowChromeOptions 平台分支（契约 §1.1）', () => {
  it("darwin → { titleBarStyle: 'hiddenInset' }，不含 frame 键", () => {
    const opts = windowChromeOptions('darwin')
    expect(opts).toEqual({ titleBarStyle: 'hiddenInset' })
    expect(opts).not.toHaveProperty('frame')
  })

  it.each(['win32', 'linux'] as WindowPlatform[])('%s → { frame: false }，不含 titleBarStyle 键', (platform) => {
    const opts = windowChromeOptions(platform)
    expect(opts).toEqual({ frame: false })
    expect(opts).not.toHaveProperty('titleBarStyle')
  })

  it('三平台穷尽（WindowPlatform 仅三取值）', () => {
    const all: WindowPlatform[] = ['darwin', 'win32', 'linux']
    expect(all).toHaveLength(3)
    all.forEach(p => expect(windowChromeOptions(p)).toBeDefined())
  })
})
