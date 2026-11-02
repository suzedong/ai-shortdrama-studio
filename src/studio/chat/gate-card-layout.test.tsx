// q5 · 门问题排版：question 拆「短标题 + Markdown 正文」，避免整张定案卡挤在标题行
// 三态：Markdown 多行卡 → 标题 + 正文区（小标题/列表被渲染）；短单行 → 仅标题；超长单行密文 → 按句读切开。
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CanvasGate } from '@shared/types'
import GateCardView from './GateCardView'

function pendingGate(question: string): CanvasGate {
  return { gateId: '0-final', status: 'pending', question, options: ['发布', '再改改'] }
}

const bodyOf = (): HTMLElement | null => document.querySelector('[data-gate-question-body]')

describe('q5 · GateCardView 门问题排版', () => {
  it('Markdown 卡：首行作标题（剥离 # 标记），区块小标题与键值行渲染进正文区', () => {
    render(
      <GateCardView
        gate={pendingGate('# 立项定案卡 · 第1版\n## 六要素\n- 题材赛道：都市复仇\n- 集数：60\n## 视觉风格\n- 主风格：A7 @ v1.46')}
        deciding={false}
        onDecide={vi.fn()}
      />,
    )
    expect(screen.getByText('立项定案卡 · 第1版')).toBeInTheDocument()
    const body = bodyOf()
    expect(body).not.toBeNull()
    expect(within(body!).getByText('六要素')).toBeInTheDocument()
    expect(within(body!).getByText('视觉风格')).toBeInTheDocument()
    const items = Array.from(body!.querySelectorAll('.md-bubble li')).map(el => el.textContent)
    expect(items).toEqual(['题材赛道：都市复仇', '集数：60', '主风格：A7 @ v1.46'])
  })

  it('短单行问题：只渲染标题，不出现正文区', () => {
    render(<GateCardView gate={pendingGate('是否批准立项？')} deciding={false} onDecide={vi.fn()} />)
    expect(screen.getByText('是否批准立项？')).toBeInTheDocument()
    expect(bodyOf()).toBeNull()
  })

  it('超长单行密文：按首个句读切出标题，其余进正文区（不再挤成一坨）', () => {
    const dense =
      '立项定案卡。六要素题材赛道都市复仇、目标平台抖音、单集时长90秒、集数60、风格基调冷峻、画幅竖屏9:16；故事前提人物林晚与顾时序、时间2002年、地点滨海市。'
    render(<GateCardView gate={pendingGate(dense)} deciding={false} onDecide={vi.fn()} />)
    expect(screen.getByText('立项定案卡。')).toBeInTheDocument()
    const body = bodyOf()
    expect(body?.textContent).toContain('六要素题材赛道都市复仇')
  })
})
