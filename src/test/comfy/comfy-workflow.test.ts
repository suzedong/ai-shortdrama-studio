import { describe, it, expect, afterEach } from 'vitest'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAndMapWorkflow } from '../../../electron/comfy/workflow.js'

const roots: string[] = []
const productionDirectory = path.resolve(__dirname, '../../../resources/comfyui/workflows')
const productionId = 'minimax-h3-image-t2i'

async function fixture(manifest: Record<string, unknown>, apiWorkflow: Record<string, unknown>): Promise<string> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'comfy-workflow-'))
  roots.push(root)
  await fsp.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest), 'utf-8')
  await fsp.writeFile(path.join(root, 'h3.json'), JSON.stringify(apiWorkflow), 'utf-8')
  return root
}

async function validFixture(): Promise<string> {
  return fixture({
    schemaVersion: 1,
    workflows: [{
      id: 'minimax-h3-test', kind: 'image', model: 'MiniMax-H3', version: 'test-v1', file: 'h3.json',
      inputs: {
        prompt: { node: '23:5', field: 'prompt', type: 'string', required: true, minLength: 1 },
        seed: { node: '23:7', field: 'seed', type: 'integer', min: 0 },
        aspectRatio: {
          node: '14', field: 'aspect_ratio', type: 'string',
          values: { '16:9': '16:9 (Widescreen)', '9:16': '9:16 (Portrait Widescreen)' },
        },
      },
    }],
  }, {
    '23:5': { class_type: 'MiniMaxH3ImageConditioning', inputs: { prompt: 'default', clip: ['23:2', 0] } },
    '23:7': { class_type: 'KSampler', inputs: { seed: 0, steps: 6, cfg: 1 } },
    '14': { class_type: 'ResolutionSelector', inputs: { aspect_ratio: '16:9 (Widescreen)', megapixels: 4, multiple: 32 } },
  })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fsp.rm(root, { recursive: true, force: true })))
})

describe('受控 MiniMax H3 Image 工作流', () => {
  it('只映射清单声明字段、转换受控枚举并保留其余节点与源文件', async () => {
    const root = await validFixture()
    const sourceFile = path.join(root, 'h3.json')
    const source = await fsp.readFile(sourceFile, 'utf-8')
    const mapped = await loadAndMapWorkflow('minimax-h3-test', {
      prompt: '雨夜重逢', seed: 42, aspectRatio: '9:16',
    }, root)

    expect(mapped.version).toBe('test-v1')
    expect(mapped.workflow).toEqual({
      '23:5': { class_type: 'MiniMaxH3ImageConditioning', inputs: { prompt: '雨夜重逢', clip: ['23:2', 0] } },
      '23:7': { class_type: 'KSampler', inputs: { seed: 42, steps: 6, cfg: 1 } },
      '14': { class_type: 'ResolutionSelector', inputs: { aspect_ratio: '9:16 (Portrait Widescreen)', megapixels: 4, multiple: 32 } },
    })
    expect(await fsp.readFile(sourceFile, 'utf-8')).toBe(source)
  })

  it('缺生产工作流时返回明确不可用错误', async () => {
    const root = await fixture({ schemaVersion: 1, workflows: [] }, {})
    await expect(loadAndMapWorkflow('minimax-h3-test', {}, root)).rejects.toMatchObject({ code: 'WORKFLOW_NOT_AVAILABLE' })
  })

  it('拒绝未声明输入、越界参数和未经映射的实例标签', async () => {
    const root = await validFixture()
    await expect(loadAndMapWorkflow('minimax-h3-test', { prompt: 'ok', steps: 100 }, root))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(loadAndMapWorkflow('minimax-h3-test', { prompt: 'ok', seed: -1 }, root))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(loadAndMapWorkflow('minimax-h3-test', { prompt: 'ok', aspectRatio: '9:16 (Portrait Widescreen)' }, root))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(loadAndMapWorkflow('minimax-h3-test', { prompt: '   ' }, root))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('拒绝 UI Format 与 Qwen 模型白名单回退', async () => {
    const uiRoot = await fixture({
      schemaVersion: 1,
      workflows: [{ id: 'minimax-h3-test', kind: 'image', model: 'MiniMax-H3', version: 'v1', file: 'h3.json', inputs: {} }],
    }, { nodes: [] })
    await expect(loadAndMapWorkflow('minimax-h3-test', {}, uiRoot)).rejects.toMatchObject({ code: 'WORKFLOW_INVALID' })

    const modelRoot = await fixture({
      schemaVersion: 1,
      workflows: [{ id: 'qwen-image-2512-text', kind: 'image', model: 'qwen-image', version: 'v1', file: 'h3.json', inputs: {} }],
    }, {})
    await expect(loadAndMapWorkflow('qwen-image-2512-text', {}, modelRoot)).rejects.toMatchObject({ code: 'WORKFLOW_INVALID' })
  })

  it('拒绝工作流目录逃逸与缺失映射节点', async () => {
    const escapeRoot = await fixture({
      schemaVersion: 1,
      workflows: [{ id: 'escape', kind: 'image', model: 'MiniMax-H3', version: 'v1', file: '../outside.json', inputs: {} }],
    }, {})
    await expect(loadAndMapWorkflow('escape', {}, escapeRoot)).rejects.toMatchObject({ code: 'WORKFLOW_INVALID' })

    const missingRoot = await fixture({
      schemaVersion: 1,
      workflows: [{
        id: 'missing', kind: 'image', model: 'MiniMax-H3', version: 'v1', file: 'h3.json',
        inputs: { prompt: { node: 'absent', field: 'prompt', type: 'string', required: true } },
      }],
    }, {})
    await expect(loadAndMapWorkflow('missing', { prompt: 'ok' }, missingRoot)).rejects.toMatchObject({ code: 'WORKFLOW_INVALID' })
  })

  it('拒绝非字符串 values 映射与非字符串输入规则', async () => {
    const root = await fixture({
      schemaVersion: 1,
      workflows: [{
        id: 'invalid-values', kind: 'image', model: 'MiniMax-H3', version: 'v1', file: 'h3.json',
        inputs: { seed: { node: '23:7', field: 'seed', type: 'integer', values: { fixed: 1 } } },
      }],
    }, {})
    await expect(loadAndMapWorkflow('invalid-values', {}, root)).rejects.toMatchObject({ code: 'WORKFLOW_INVALID' })
  })
})

describe('生产 MiniMax H3 Image 文生图工作流', () => {
  it('精确映射四项输入并保留固定采样、权重和输出拓扑', async () => {
    const { workflow, version } = await loadAndMapWorkflow(productionId, {
      prompt: '雨夜老城巷口，女主撑透明雨伞回头，电影感，竖屏短剧剧照',
      seed: 20261114,
      aspectRatio: '9:16',
      megapixels: 4,
    }, productionDirectory)

    expect(version).toBe('h3-image-local-compat-v1.0')
    expect(Object.keys(workflow).sort()).toEqual(['9', '14', '23:1', '23:2', '23:3', '23:5', '23:6', '23:7', '23:8'].sort())
    expect(workflow).toMatchObject({
      '23:1': { class_type: 'UNETLoader', inputs: { unet_name: 'minimax_h3_image_pruned_int8_convrot.safetensors', weight_dtype: 'default' } },
      '23:2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_32b_minimax_h3_int8_convrot.safetensors', type: 'minimax', device: 'default' } },
      '23:3': { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_image_vae_fp16.safetensors' } },
      '14': { class_type: 'ResolutionSelector', inputs: { aspect_ratio: '9:16 (Portrait Widescreen)', megapixels: 4, multiple: 32 } },
      '23:5': { class_type: 'MiniMaxH3ImageConditioning', inputs: { prompt: '雨夜老城巷口，女主撑透明雨伞回头，电影感，竖屏短剧剧照', width: ['14', 0], height: ['14', 1], clip: ['23:2', 0], vae: ['23:3', 0] } },
      '23:6': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['23:5', 0] } },
      '23:7': { class_type: 'KSampler', inputs: { seed: 20261114, steps: 6, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1, model: ['23:1', 0], positive: ['23:5', 0], negative: ['23:6', 0], latent_image: ['23:5', 1] } },
      '23:8': { class_type: 'VAEDecode', inputs: { samples: ['23:7', 0], vae: ['23:3', 0] } },
      '9': { class_type: 'SaveImage', inputs: { images: ['23:8', 0] } },
    })
  })

  it('保留 seed 0、16:9、4 MP、multiple 32、6 步与 CFG 1 默认值', async () => {
    const { workflow } = await loadAndMapWorkflow(productionId, { prompt: '默认参数测试' }, productionDirectory)
    expect(workflow).toMatchObject({
      '14': { inputs: { aspect_ratio: '16:9 (Widescreen)', megapixels: 4, multiple: 32 } },
      '23:7': { inputs: { seed: 0, steps: 6, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
    })
  })

  const ratios = {
    '1:1': '1:1 (Square)',
    '2:3': '2:3 (Portrait Photo)',
    '3:2': '3:2 (Photo)',
    '3:4': '3:4 (Portrait Standard)',
    '4:3': '4:3 (Standard)',
    '9:16': '9:16 (Portrait Widescreen)',
    '16:9': '16:9 (Widescreen)',
    '21:9': '21:9 (Ultrawide)',
  }

  it.each(Object.entries(ratios))('映射稳定画幅 %s', async (aspectRatio, nodeValue) => {
    const { workflow } = await loadAndMapWorkflow(productionId, { prompt: '画幅测试', aspectRatio }, productionDirectory)
    expect(workflow).toMatchObject({ '14': { inputs: { aspect_ratio: nodeValue } } })
  })

  const invalidInputs: Array<Record<string, unknown>> = [
    {},
    { prompt: '' },
    { prompt: ' \n ' },
    { prompt: 'x'.repeat(8001) },
    { prompt: 'ok', seed: -1 },
    { prompt: 'ok', seed: 1.5 },
    { prompt: 'ok', seed: 9007199254740992 },
    { prompt: 'ok', seed: '1' },
    { prompt: 'ok', aspectRatio: '5:4' },
    { prompt: 'ok', aspectRatio: '16:9 (Widescreen)' },
    { prompt: 'ok', aspectRatio: 16 },
    { prompt: 'ok', megapixels: 0 },
    { prompt: 'ok', megapixels: 16.1 },
    { prompt: 'ok', megapixels: Number.NaN },
    { prompt: 'ok', megapixels: Number.POSITIVE_INFINITY },
    { prompt: 'ok', megapixels: '4' },
  ]

  it.each(invalidInputs)('拒绝非法或越界输入 %#', async inputs => {
    await expect(loadAndMapWorkflow(productionId, inputs, productionDirectory))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it.each(['width', 'height', 'negativePrompt', 'lightning4Steps', 'steps', 'nodePath'])('拒绝旧字段与未知字段 %s', async field => {
    await expect(loadAndMapWorkflow(productionId, { prompt: 'ok', [field]: 'forbidden' }, productionDirectory))
      .rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('旧 Qwen workflowId 不得新提交或自动改投', async () => {
    await expect(loadAndMapWorkflow('qwen-image-2512-text', { prompt: '不得执行' }, productionDirectory))
      .rejects.toMatchObject({ code: 'WORKFLOW_NOT_AVAILABLE' })
  })

  it('不含云节点、提示词扩写支路、视频权重或 Qwen-Image 生成权重', async () => {
    const { workflow } = await loadAndMapWorkflow(productionId, { prompt: '安全边界测试' }, productionDirectory)
    const serialized = JSON.stringify(workflow)
    const classTypes = Object.values(workflow).map(node => (node as { class_type: string }).class_type)
    expect(classTypes).not.toContain('MinimaxH3ImageNode')
    expect(classTypes).not.toContain('TextGenerateV2')
    expect(classTypes).not.toContain('LoraLoaderModelOnly')
    for (const forbidden of ['qwen_image_2512', 'Qwen-Image-2512', 'minimax_h3_fl2va', 'minimax_h3_video_vae']) {
      expect(serialized).not.toContain(forbidden)
    }
  })
})
