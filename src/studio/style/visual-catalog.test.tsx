// feature-810 T5 · AC5：VisualCatalog 谱系升级差异工作流 renderer 单测
// 契约：docs/features/feature-810-谱系升级差异工作流/SDG-RE-契约.md §4（V1–V6 渲染 + 采纳/忽略闭环）
// 通道 mock：组件仅经 window.api 四桥（styleCatalog / styleUpgradeDiff / stylePreviewMetadata / updateBrief）——本文件全量 mock，不触主进程
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VisualCatalog, { PREVIEW_URL } from './VisualCatalog'

type Diff = Awaited<ReturnType<Window['api']['styleUpgradeDiff']>>

// 引用条目现况夹具：A7 主风格（不可作辅助）+ B1 辅助风格（谱系中 role=main、可作辅助）
const REF_MAIN = {
  id: 'A7',
  role: 'main' as const,
  removed: false,
  current: {
    role: 'main' as const,
    auxiliaryCandidate: false,
    feasibility: 'high' as const,
    anchorWords: ['realistic human-like anime', 'lifelike expression'],
  },
}
const REF_AUX = {
  id: 'B1',
  role: 'auxiliary' as const,
  removed: false,
  current: {
    role: 'main' as const,
    auxiliaryCandidate: true,
    feasibility: 'high' as const,
    anchorWords: ['bright', 'low saturation', 'soft light', 'airy'],
  },
}

// 有升级基线：注册 v1.45 → 现谱系 v1.46
const diffOf = (over: Partial<Diff> = {}): Diff => ({
  hasUpgrade: true,
  registeredVersion: 'v1.45',
  currentVersion: 'v1.46',
  referenced: [REF_MAIN, REF_AUX],
  blocking: false,
  changelog: [{ version: 'v1.46', date: '2026-10-08', items: ['（本版起设立变更记录段；此前版本无记录）'] }],
  changelogUnavailable: false,
  ...over,
})

// 已最新：hasUpgrade:false，主进程此时不出 registeredVersion 键
const diffLatest = (over: Partial<Diff> = {}): Diff => {
  const { registeredVersion: _drop, ...rest } = diffOf()
  return { ...rest, hasUpgrade: false, ...over }
}

// feature-811：十键谱系夹具（18 条；A7 带 textureRecipe 以验弹层条件块，其余空串）
const e = (id: string, name: string, familyCode: 'A' | 'B' | 'C' | 'D' | 'E', familyLabel: string, role: 'main' | 'backup', over: Partial<StyleCatalogEntryDto> = {}): StyleCatalogEntryDto => ({
  id, name, familyCode, familyLabel, role,
  feasibility: 'high', auxiliaryCandidate: false,
  visualTraits: '', anchorWords: `${id} anchor words`, textureRecipe: '',
  ...over,
})
const STYLE_FIXTURE: StyleCatalogEntryDto[] = [
  e('A1', '数字电影写实', 'A', '写实影像系', 'main'),
  e('A2', '胶片电影感', 'A', '写实影像系', 'main'),
  e('A3', '年代胶片（千禧·90s·80s）', 'A', '写实影像系', 'backup'),
  e('A4', 'DV·CCD 数码复古', 'A', '写实影像系', 'backup'),
  e('A5', '黑白电影', 'A', '写实影像系', 'backup'),
  e('A7', '拟真人·仿真人动漫', 'A', '写实影像系', 'main', { anchorWords: 'realistic human-like anime, lifelike expression', textureRecipe: '测试质感配方文' }),
  e('B1', '清新生活流', 'B', '青春治愈系', 'main'),
  e('C1', '日式动漫', 'C', '动画插画系', 'main'),
  e('C2', '国漫·新中式插画', 'C', '动画插画系', 'main'),
  e('C5', '美式卡通', 'C', '动画插画系', 'backup'),
  e('C6', '扁平矢量·低多边形', 'C', '动画插画系', 'backup'),
  e('C7', '韩漫·精致美型', 'C', '动画插画系', 'main'),
  e('D1', '冷调悬疑', 'D', '类型氛围系', 'main'),
  e('D2', '赛博·科幻', 'D', '类型氛围系', 'main'),
  e('D3', '奇幻童话', 'D', '类型氛围系', 'backup'),
  e('D4', '暗黑·哥特', 'D', '类型氛围系', 'backup'),
  e('D5', '神话国风', 'D', '类型氛围系', 'main'),
  e('E1', '3D CG', 'E', '材质工艺系', 'main', { feasibility: 'medium' }),
]

const metadataOf = (
  request: StylePreviewMetadataRequest,
  over: Partial<StylePreviewMetadataDto> = {},
): StylePreviewMetadataDto => ({
  request,
  status: 'ok',
  prompts: request.mediaKind === 'image'
    ? [
        { key: 'positive', label: '正向提示词', text: '图片专属正向提示词：午后咖啡馆，浅景深' },
        { key: 'negative', label: '负向提示词', text: '图片专属负向提示词：模糊，水印' },
      ]
    : [{ key: 'motion', label: '运动提示词', text: `视频 ${request.tier} 运动提示词：镜头缓慢推近` }],
  params: request.mediaKind === 'image'
    ? [
        { key: 'seed', label: 'Seed', value: 947870040 },
        { key: 'steps', label: 'Steps', value: 20 },
        { key: 'width', label: '宽度', value: 768 },
      ]
    : [
        { key: 'seed', label: 'Seed', value: 1789724923 },
        { key: 'steps', label: 'Steps', value: request.tier === 'std' ? 20 : 8 },
        { key: 'fps', label: 'FPS', value: 24 },
      ],
  ...over,
})

const installApi = () => {
  const catalogSpy = vi.fn().mockResolvedValue({ version: 'v1.46', count: 18, entries: STYLE_FIXTURE })
  const diffSpy = vi.fn().mockResolvedValue(diffOf())
  const updateSpy = vi.fn().mockResolvedValue({ ok: true, version: 2, jsonPath: '立项单.v2.json', mdPath: '立项单.v2.md' })
  const metadataSpy = vi.fn(async (request: StylePreviewMetadataRequest) => metadataOf(request))
  window.api = {
    styleCatalog: catalogSpy,
    styleUpgradeDiff: diffSpy,
    updateBrief: updateSpy,
    stylePreviewMetadata: metadataSpy,
  } as unknown as Window['api']
  return { catalogSpy, diffSpy, updateSpy, metadataSpy }
}

const renderCatalog = () => render(<VisualCatalog open onClose={() => {}} />)

describe('VisualCatalog 谱系升级差异工作流（feature-810 AC5）', () => {
  describe('版本徽章', () => {
    it('谱系装载成功 → 徽章显示真实版本号 v1.46', async () => {
      installApi()
      renderCatalog()
      await waitFor(() => expect(screen.getByTestId('style-catalog-version')).toHaveTextContent('v1.46'))
    })

    it('谱系装载失败 → 徽章显示「谱系不可用」', async () => {
      const { catalogSpy } = installApi()
      catalogSpy.mockRejectedValueOnce(new Error('ENOENT'))
      renderCatalog()
      await waitFor(() => expect(screen.getByTestId('style-catalog-version')).toHaveTextContent('谱系不可用'))
    })
  })

  describe('升级入口', () => {
    it('diff 加载失败（diff=null）→ 不渲染入口按钮', async () => {
      const { diffSpy } = installApi()
      diffSpy.mockRejectedValueOnce(new Error('io'))
      renderCatalog()
      await waitFor(() => expect(screen.getByTestId('style-catalog-version')).toHaveTextContent('v1.46'))
      await waitFor(() => expect(diffSpy).toHaveBeenCalled())
      expect(screen.queryByText(/谱系有升级/)).toBeNull()
      expect(screen.queryByText(/谱系当前已是最新/)).toBeNull()
    })

    it('hasUpgrade → 🔔 升级文案，可点击', async () => {
      installApi()
      renderCatalog()
      const entry = await screen.findByText(/谱系有升级/)
      expect(entry).toHaveTextContent('谱系有升级（v1.45 → v1.46），点击查看差异')
      expect(entry).not.toBeDisabled()
    })

    it('已最新（无 noBrief）→ 「谱系当前已是最新」disabled，无立项提示', async () => {
      const { diffSpy } = installApi()
      diffSpy.mockResolvedValueOnce(diffLatest())
      renderCatalog()
      const entry = await screen.findByText(/谱系当前已是最新/)
      expect(entry.textContent).not.toContain('立项后可采纳升级')
      expect(entry).toBeDisabled()
    })

    it('已最新 + noBrief → 附「（立项后可采纳升级）」，disabled', async () => {
      const { diffSpy } = installApi()
      diffSpy.mockResolvedValueOnce(diffLatest({ noBrief: true }))
      renderCatalog()
      const entry = await screen.findByText(/立项后可采纳升级/)
      expect(entry).toHaveTextContent('谱系当前已是最新（立项后可采纳升级）')
      expect(entry).toBeDisabled()
    })
  })

  describe('差异面板', () => {
    it('完整渲染：版本线 / 口径文案 / 引用条目现况 / changelog / 双按钮', async () => {
      installApi()
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      expect(screen.getByTestId('style-upgrade-versions')).toHaveTextContent('v1.45 → v1.46')
      expect(screen.getByText(/差异 = 引用条目现况/)).toBeTruthy()
      const refs = screen.getAllByTestId('style-upgrade-ref')
      expect(refs).toHaveLength(2)
      expect(refs[0]!.textContent).toContain('主风格 A7 拟真人·仿真人动漫：')
      expect(refs[0]!.textContent).toContain('主 · 可行度高')
      expect(refs[0]!.textContent).not.toContain('可作辅助')
      expect(refs[0]!.textContent).toContain('锚点词现况：realistic human-like anime、lifelike expression')
      expect(refs[1]!.textContent).toContain('辅助风格 B1 清新生活流：')
      expect(refs[1]!.textContent).toContain('主 · 可作辅助 · 可行度高')
      expect(refs[1]!.textContent).toContain('锚点词现况：bright、low saturation、soft light、airy')
      const cl = screen.getByTestId('style-upgrade-changelog')
      expect(cl.textContent).toContain('v1.46（2026-10-08）')
      expect(cl.textContent).toContain('· （本版起设立变更记录段；此前版本无记录）')
      expect(screen.getByTestId('style-upgrade-adopt')).toHaveTextContent('采纳（项目引用升 v1.46）')
      expect(screen.getByTestId('style-upgrade-ignore')).toHaveTextContent('忽略（保持 v1.45）')
    })

    it('blocking（引用风格已移除）→ 警示 + 「已移除」+ 采纳 disabled（title 提示重选）', async () => {
      const { diffSpy } = installApi()
      diffSpy.mockResolvedValueOnce(diffOf({ referenced: [{ id: 'ZZ', role: 'main', removed: true }], blocking: true }))
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      expect(screen.getByText(/引用风格已被谱系移除，请先在立项中重选风格后再采纳/)).toBeTruthy()
      const refs = screen.getAllByTestId('style-upgrade-ref')
      expect(refs[0]!.textContent).toContain('主风格 ZZ')
      expect(refs[0]!.textContent).toContain('已移除')
      const adopt = screen.getByTestId('style-upgrade-adopt')
      expect(adopt).toBeDisabled()
      expect(adopt).toHaveAttribute('title', '引用风格已被谱系移除，请先重选风格')
    })

    it('changelogUnavailable → 「谱系未提供变更明细」，不出 changelog 列表', async () => {
      const { diffSpy } = installApi()
      diffSpy.mockResolvedValueOnce(diffOf({ changelog: [], changelogUnavailable: true }))
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      expect(screen.getByTestId('style-upgrade-changelog-empty')).toHaveTextContent('谱系未提供变更明细')
      expect(screen.queryByTestId('style-upgrade-changelog')).toBeNull()
    })

    it('noBrief（有升级但未立项）→ 采纳 disabled（title「立项后可采纳」）', async () => {
      const { diffSpy } = installApi()
      diffSpy.mockResolvedValueOnce(diffOf({ noBrief: true }))
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      const adopt = screen.getByTestId('style-upgrade-adopt')
      expect(adopt).toBeDisabled()
      expect(adopt).toHaveAttribute('title', '立项后可采纳')
    })
  })

  describe('采纳闭环', () => {
    it('采纳成功：updateBrief 写 v1.46 → 面板关闭 → 入口转「已最新」；catalog/diff 各 2 次', async () => {
      const { catalogSpy, diffSpy, updateSpy } = installApi()
      diffSpy.mockResolvedValueOnce(diffOf()).mockResolvedValueOnce(diffLatest())
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      fireEvent.click(screen.getByTestId('style-upgrade-adopt'))
      await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ style: { catalogVersion: 'v1.46' } }))
      await waitFor(() => expect(screen.queryByTestId('style-upgrade-panel')).toBeNull())
      const entry = await screen.findByText(/谱系当前已是最新/)
      expect(entry).toBeDisabled()
      expect(catalogSpy).toHaveBeenCalledTimes(2)
      expect(diffSpy).toHaveBeenCalledTimes(2)
    })

    it('前置校验失败（谱系已 v1.47）→ 错误提示，updateBrief 零调用', async () => {
      const { catalogSpy, updateSpy } = installApi()
      catalogSpy
        .mockResolvedValueOnce({ version: 'v1.46', count: 18, entries: [] })
        .mockResolvedValueOnce({ version: 'v1.47', count: 19, entries: [] })
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      fireEvent.click(screen.getByTestId('style-upgrade-adopt'))
      expect(await screen.findByText('谱系已再升级，请刷新差异')).toBeTruthy()
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('updateBrief 失败 → 错误透传（BRIEF_NOT_READY）', async () => {
      const { updateSpy } = installApi()
      updateSpy.mockRejectedValueOnce(new Error('BRIEF_NOT_READY: 风格校验未过'))
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      fireEvent.click(screen.getByTestId('style-upgrade-adopt'))
      expect(await screen.findByText(/BRIEF_NOT_READY/)).toBeTruthy()
    })
  })

  describe('忽略', () => {
    it('忽略 → 面板关闭、updateBrief 零调用、入口仍提示有升级', async () => {
      const { updateSpy } = installApi()
      renderCatalog()
      fireEvent.click(await screen.findByText(/谱系有升级/))
      await screen.findByTestId('style-upgrade-panel')
      fireEvent.click(screen.getByTestId('style-upgrade-ignore'))
      await waitFor(() => expect(screen.queryByTestId('style-upgrade-panel')).toBeNull())
      expect(updateSpy).not.toHaveBeenCalled()
      expect(await screen.findByText(/谱系有升级/)).toBeTruthy()
    })
  })
})

/* ── feature-811 B-41：谱系面板全量数据驱动（entries 消费 / STYLES 硬编码表退役） ── */

describe('谱系面板数据驱动（feature-811）', () => {
  it('TABS 计数实算 + 家族过滤：全部 18 / A 6 / B 1 / C 5 / D 5 / E 1', async () => {
    installApi()
    const { container } = renderCatalog()
    await waitFor(() => expect(screen.getByTestId('style-catalog-version')).toHaveTextContent('v1.46'))
    const tabText = (k: string) => container.querySelector(`[data-cat-tab="${k}"]`)?.textContent
    expect(tabText('all')).toBe('全部 18')
    expect(tabText('A')).toBe('A 写实影像 6')
    expect(tabText('B')).toBe('B 青春治愈 1')
    expect(tabText('C')).toBe('C 动画插画 5')
    expect(tabText('D')).toBe('D 类型氛围 5')
    expect(tabText('E')).toBe('E 材质工艺 1')
    // 默认 all → 全量 18 张条目卡
    expect(container.querySelectorAll('[data-cat-item]')).toHaveLength(18)
    // 点 A tab → 仅 A 系 6 条（谱系序）
    fireEvent.click(container.querySelector('[data-cat-tab="A"]')!)
    const ids = Array.from(container.querySelectorAll('[data-cat-item]')).map(el => el.getAttribute('data-cat-item'))
    expect(ids).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A7'])
  })

  it('条目卡片：名称 / 主备徽章 / ID·家族 / 可行度浮标全部来自 entries', async () => {
    installApi()
    const { container } = renderCatalog()
    await waitFor(() => expect(screen.getByTestId('style-catalog-version')).toHaveTextContent('v1.46'))
    const a7 = container.querySelector('[data-cat-item="A7"]') as HTMLElement
    expect(a7.textContent).toContain('拟真人·仿真人动漫')
    expect(a7.textContent).toContain('主·已验证')
    expect(a7.textContent).toContain('A7 · 写实影像系')
    expect(a7.textContent).toContain('●高')
    expect((container.querySelector('[data-cat-item="A3"]') as HTMLElement).textContent).toContain('备·风险自担')
    // E1 feasibility='medium' → ●中（唯一非 high 条目）
    expect((container.querySelector('[data-cat-item="E1"]') as HTMLElement).textContent).toContain('●中')
  })

  it('预览弹层：anchorWords 原文直显；质感配方块按 textureRecipe 条件渲染', async () => {
    installApi()
    const { container } = renderCatalog()
    await waitFor(() => expect(screen.getByTestId('style-catalog-version')).toHaveTextContent('v1.46'))
    // A7 带 textureRecipe → 锚点词原文 + 质感配方块
    fireEvent.click(container.querySelector('[data-cat-item="A7"] > div')!)
    const overlay = container.querySelector('[data-catalog-preview]') as HTMLElement
    expect(overlay).not.toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('preview-metadata-image')).toHaveAttribute('data-status', 'ok')
      expect(screen.getByTestId('preview-metadata-video')).toHaveAttribute('data-status', 'ok')
    })
    expect(overlay.textContent).toContain('realistic human-like anime, lifelike expression')
    expect(overlay.textContent).toContain('质感配方')
    expect(overlay.textContent).toContain('测试质感配方文')
    fireEvent.click(overlay.querySelector('[data-preview-close]')!)
    // A3 textureRecipe 空串 → 锚点词在、质感配方块不显
    fireEvent.click(container.querySelector('[data-cat-item="A3"] > div')!)
    const overlay2 = container.querySelector('[data-catalog-preview]') as HTMLElement
    await waitFor(() => {
      expect(screen.getByTestId('preview-metadata-image')).toHaveAttribute('data-status', 'ok')
      expect(screen.getByTestId('preview-metadata-video')).toHaveAttribute('data-status', 'ok')
    })
    expect(overlay2.textContent).toContain('A3 anchor words')
    expect(overlay2.textContent).not.toContain('质感配方')
  })

  it('谱系拉取失败 → data-catalog-empty 显「谱系不可用」，TABS 无计数、零条目卡', async () => {
    const { catalogSpy } = installApi()
    catalogSpy.mockReset()
    catalogSpy.mockRejectedValue(new Error('ENOENT'))
    const { container } = renderCatalog()
    await waitFor(() => expect(container.querySelector('[data-catalog-empty]')?.textContent).toContain('谱系不可用'))
    expect(container.querySelector('[data-cat-tab="all"]')?.textContent).toBe('全部')
    expect(container.querySelector('[data-cat-item]')).toBeNull()
  })
})

// ---- feature-815 · 双媒体与当前文件内嵌 ComfyUI 元数据（契约 §5）----
describe('VisualCatalog 双媒体与媒体内嵌元数据（feature-815）', () => {
  const openStyle = async (id: string) => {
    const { container } = renderCatalog()
    await waitFor(() => expect(screen.getByTestId('style-catalog-version')).toHaveTextContent('v1.46'))
    fireEvent.click(container.querySelector(`[data-cat-item="${id}"] > div`)!)
    await screen.findByRole('dialog')
    return container
  }

  it('T5：A1 图片与视频同屏，提示词和参数分源且不冒用谱系锚点词', async () => {
    installApi()
    const container = await openStyle('A1')

    const image = await screen.findByRole('img', { name: 'A1 数字电影写实 参考图片' })
    const video = container.querySelector('[data-preview-vid="A1"]')
    expect(image).toBeVisible()
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('poster', image.getAttribute('src'))

    const imageMeta = screen.getByTestId('preview-metadata-image')
    const videoMeta = screen.getByTestId('preview-metadata-video')
    await waitFor(() => expect(imageMeta).toHaveAttribute('data-status', 'ok'))
    await waitFor(() => expect(videoMeta).toHaveAttribute('data-status', 'ok'))
    expect(screen.getByTestId('preview-prompt-image-positive')).toHaveTextContent('图片专属正向提示词')
    expect(screen.getByTestId('preview-prompt-video-motion')).toHaveTextContent('视频 std 运动提示词')
    expect(within(imageMeta).getByText('947870040')).toBeInTheDocument()
    expect(within(videoMeta).getByText('1789724923')).toBeInTheDocument()
    expect(screen.getByText('A1 anchor words')).toBeInTheDocument()
    expect(imageMeta).not.toHaveTextContent('A1 anchor words')
    expect(videoMeta).not.toHaveTextContent('A1 anchor words')
    expect(imageMeta).toHaveTextContent('未列出的字段表示文件未记录')
    expect(videoMeta).toHaveTextContent('未列出的字段表示文件未记录')
  })

  it('T5：标准 → turbo → FastH3 只切视频及其元数据，图片与图片请求保持不变', async () => {
    const { metadataSpy } = installApi()
    const container = await openStyle('A1')
    await screen.findByText('视频 std 运动提示词：镜头缓慢推近')
    const image = screen.getByRole('img', { name: 'A1 数字电影写实 参考图片' })
    const imageSrc = image.getAttribute('src')
    const stdVideoSrc = container.querySelector('[data-preview-vid="A1"]')?.getAttribute('src')

    fireEvent.click(container.querySelector('[data-vid="turbo"]')!)
    await screen.findByText('视频 turbo 运动提示词：镜头缓慢推近')
    expect(container.querySelector('[data-preview-vid="A1"]')?.getAttribute('src')).not.toBe(stdVideoSrc)
    expect(screen.getByRole('img', { name: 'A1 数字电影写实 参考图片' })).toBe(image)
    expect(image).toHaveAttribute('src', imageSrc)

    fireEvent.click(container.querySelector('[data-vid="fast"]')!)
    await screen.findByText('视频 fast 运动提示词：镜头缓慢推近')
    expect(screen.getByRole('img', { name: 'A1 数字电影写实 参考图片' })).toBe(image)
    expect(image).toHaveAttribute('src', imageSrc)

    const imageRequests = metadataSpy.mock.calls.filter(([request]) => request.mediaKind === 'image')
    const videoTiers = metadataSpy.mock.calls
      .map(([request]) => request)
      .filter(request => request.mediaKind === 'video')
      .map(request => request.tier)
    expect(imageRequests).toHaveLength(1)
    expect(videoTiers).toEqual(['std', 'turbo', 'fast'])
    expect(within(screen.getByTestId('preview-metadata-image')).getByText('20')).toBeInTheDocument()
    expect(within(screen.getByTestId('preview-metadata-video')).getByText('8')).toBeInTheDocument()
  })

  it('T5：一键复制完整媒体提示词并给出反馈', async () => {
    installApi()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await openStyle('A1')
    await screen.findByTestId('preview-prompt-image-positive')

    fireEvent.click(screen.getByRole('button', { name: '复制正向提示词' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('图片专属正向提示词：午后咖啡馆，浅景深'))
    expect(screen.getByRole('button', { name: '复制正向提示词' })).toHaveTextContent('已复制')
  })

  it.each([
    ['missing', '预览文件缺失'],
    ['no-metadata', '文件未内嵌 ComfyUI 元数据'],
    ['unsupported', '文件格式不支持解析'],
    ['invalid', '媒体元数据损坏，无法解析'],
  ] as const)('T5：图片 %s 独立降级，不拖垮视频媒体或参数', async (status, message) => {
    const { metadataSpy } = installApi()
    metadataSpy.mockImplementation(async request => request.mediaKind === 'image'
      ? metadataOf(request, { status, prompts: [], params: [], message })
      : metadataOf(request))
    await openStyle('A1')

    const imageMeta = screen.getByTestId('preview-metadata-image')
    await waitFor(() => expect(imageMeta).toHaveAttribute('data-status', status))
    expect(imageMeta).toHaveTextContent(message)
    expect(imageMeta).not.toHaveTextContent('图片专属正向提示词')
    expect(await screen.findByTestId('preview-prompt-video-motion')).toHaveTextContent('视频 std 运动提示词')
    expect(screen.getByRole('img', { name: 'A1 数字电影写实 参考图片' })).toBeVisible()
  })

  it('T5：快速切档时 std 旧响应晚到，不覆盖 turbo 当前响应', async () => {
    const deferred = <T,>() => {
      let resolve!: (value: T) => void
      const promise = new Promise<T>(r => { resolve = r })
      return { promise, resolve }
    }
    const std = deferred<StylePreviewMetadataDto>()
    const turbo = deferred<StylePreviewMetadataDto>()
    const { metadataSpy } = installApi()
    metadataSpy.mockImplementation(request => {
      if (request.mediaKind === 'image') return Promise.resolve(metadataOf(request))
      if (request.tier === 'std') return std.promise
      if (request.tier === 'turbo') return turbo.promise
      return Promise.resolve(metadataOf(request))
    })
    const container = await openStyle('A1')
    fireEvent.click(container.querySelector('[data-vid="turbo"]')!)
    await waitFor(() => expect(metadataSpy).toHaveBeenCalledWith({
      styleId: 'A1', mediaKind: 'video', tier: 'turbo',
    }))

    await act(async () => {
      turbo.resolve(metadataOf({ styleId: 'A1', mediaKind: 'video', tier: 'turbo' }))
      await turbo.promise
    })
    expect(await screen.findByTestId('preview-prompt-video-motion')).toHaveTextContent('视频 turbo 运动提示词')

    await act(async () => {
      std.resolve(metadataOf({ styleId: 'A1', mediaKind: 'video', tier: 'std' }))
      await std.promise
    })
    expect(screen.getByTestId('preview-prompt-video-motion')).toHaveTextContent('视频 turbo 运动提示词')
    expect(screen.queryByText('视频 std 运动提示词：镜头缓慢推近')).not.toBeInTheDocument()
  })

  it('T5：备画风无视频时保留图片与图片元数据，视频单独提示缺失', async () => {
    const { metadataSpy } = installApi()
    metadataSpy.mockImplementation(async request => request.mediaKind === 'video'
      ? metadataOf(request, { status: 'missing', prompts: [], params: [], message: '预览文件缺失' })
      : metadataOf(request))
    const container = await openStyle('A3')

    expect(await screen.findByRole('img', { name: 'A3 年代胶片（千禧·90s·80s） 参考图片' })).toBeVisible()
    expect(await screen.findByTestId('preview-prompt-image-positive')).toHaveTextContent('图片专属正向提示词')
    expect(container.querySelector('[data-preview-vid="A3"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-preview-vid-hint]')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('preview-metadata-video')).toHaveAttribute('data-status', 'missing'))
  })
})

/* ── B-53：Vite glob 路径回归——18 张真实缩略图必须全部收集进 PREVIEW_URL ── */

describe('PREVIEW_URL 缩略图收集（B-53）', () => {
  it('18 个风格 ID 全部命中真实 PNG，URL 非空', () => {
    const ids = ['A1','A2','A3','A4','A5','A7','B1','C1','C2','C5','C6','C7','D1','D2','D3','D4','D5','E1']
    expect(Object.keys(PREVIEW_URL).sort()).toEqual(ids.sort())
    for (const id of ids) {
      expect(typeof PREVIEW_URL[id]).toBe('string')
      expect(PREVIEW_URL[id]!.length).toBeGreaterThan(0)
    }
  })
})
