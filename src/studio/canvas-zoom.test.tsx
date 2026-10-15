// 2026-10-15 · 画布缩放 / 鸟瞰缺陷修复回归（口头授权，无任务包）
// ① StrictMode（开发态双调用 updater）下滚轮缩放必须钉住鼠标锚点，纵轴不得漂移；
// ② activeStep 联动居中只在切换 STAGE 时发生，缩放不得抢占水平 pan。
import { fireEvent, render } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { Canvas, CanvasNode } from '@shared/types'
import CanvasBoard from './CanvasBoard'

function canvasWithNodes(): Canvas {
  const n = (id: string, step: string, title: string, status: CanvasNode['status']): CanvasNode => ({
    id, step, kind: step === '0' ? 'brief' : 'outline', title, status,
    ref: { path: `${id}.json`, format: 'json' },
    updatedAt: new Date().toISOString(),
  })
  return {
    schemaVersion: 2, projectId: 'p1', title: '缩放测试',
    nodes: [
      n('step-0-brief', '0', '立项单', 'done'),
      n('step-1-outline', '1', '故事大纲', 'active'),
    ],
    edges: [{ id: 'e1', from: 'step-0-brief', to: 'step-1-outline', auto: true }],
    gates: [],
    updatedAt: new Date().toISOString(),
  }
}

// 从世界层 transform 解析 pan/zoom：translate(xpx, ypx) scale(z)
function readTransform(world: Element) {
  const m = (world as HTMLElement).style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/)
  if (!m) throw new Error(`意外的 transform：${(world as HTMLElement).style.transform}`)
  return { x: +m[1], y: +m[2], z: +m[3] }
}

// 视口固定 800×600，原点 (0,0)；返回世界层与读取器
function setup(activeStep: string | null = null) {
  const utils = render(
    <React.StrictMode>
      <CanvasBoard canvas={canvasWithNodes()} activeStep={activeStep} />
    </React.StrictMode>,
  )
  const viewport = utils.container.querySelector('[data-canvas-bg]') as HTMLElement
  const world = utils.container.querySelectorAll('[data-canvas-bg]')[1] as HTMLElement
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600,
    toJSON: () => ({}),
  } as DOMRect)
  return { viewport, world, rerender: utils.rerender }
}

// 屏幕点 (sx,sy) 对应的世界坐标；缩放前后该值不变即「锚点钉住」
function worldAt(t: { x: number; y: number; z: number }, sx: number, sy: number) {
  return { wx: (sx - t.x) / t.z, wy: (sy - t.y) / t.z }
}

describe('CanvasBoard · 滚轮缩放锚点（StrictMode 开发态）', () => {
  it('连续放大：鼠标点对应的世界坐标始终不变（纵轴不漂移、横轴不被 STAGE 居中抢占）', () => {
    const { viewport, world } = setup('0')
    const SX = 120
    const SY = 200
    const before = readTransform(world)
    const anchor0 = worldAt(before, SX, SY)

    for (let i = 0; i < 3; i++) {
      fireEvent.wheel(viewport, { deltaY: -100, clientX: SX, clientY: SY })
      const t = readTransform(world)
      const a = worldAt(t, SX, SY)
      expect(a.wx).toBeCloseTo(anchor0.wx, 6)
      expect(a.wy).toBeCloseTo(anchor0.wy, 6)
    }

    const after = readTransform(world)
    expect(after.z).toBeGreaterThan(before.z)
  })

  it('缩小同样钉住锚点', () => {
    const { viewport, world } = setup(null)
    const SX = 500
    const SY = 300
    const anchor0 = worldAt(readTransform(world), SX, SY)

    fireEvent.wheel(viewport, { deltaY: 100, clientX: SX, clientY: SY })
    const a = worldAt(readTransform(world), SX, SY)
    expect(a.wx).toBeCloseTo(anchor0.wx, 6)
    expect(a.wy).toBeCloseTo(anchor0.wy, 6)
  })

  it('activeStep 切换后再缩放：水平 pan 只随锚点公式变化，不被重新居中', () => {
    const { viewport, world, rerender } = setup('0')
    // 切到 STAGE 1（允许 effect 居中一次）
    rerender(
      <React.StrictMode>
        <CanvasBoard canvas={canvasWithNodes()} activeStep="1" />
      </React.StrictMode>,
    )
    const viewport2 = world.parentElement as HTMLElement
    const SX = 300
    const SY = 260
    const anchor0 = worldAt(readTransform(world), SX, SY)

    fireEvent.wheel(viewport2, { deltaY: -100, clientX: SX, clientY: SY })
    const a = worldAt(readTransform(world), SX, SY)
    expect(a.wx).toBeCloseTo(anchor0.wx, 6)
  })
})
