// @vitest-environment node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false } }))

import { MetadataParseError, parseStylePreviewMetadata } from '../../../electron/style/metadata-parser'
import { readStylePreviewMetadata, type StylePreviewMetadataDto } from '../../../electron/style/preview-metadata'
import { STYLE_REGISTRY } from '../../../electron/style/catalog'

const PREVIEW_ROOT = path.join(process.cwd(), 'resources', 'H3-Style', '_style_preview', 'A_写实影像')
const IMAGE_POSITIVE = '一位20岁左右的年轻中国女性，齐肩黑发，米色针织开衫，坐在街角咖啡馆落地窗边，双手捧着白色陶瓷咖啡杯，望向窗外，午后柔和自然光，中景半身，电影感构图，细节丰富，高清，现代院线片质感，干净锐利，浅景深，cinematic still, anamorphic, shallow depth of field'
const IMAGE_NEGATIVE = 'blurry, low quality, deformed face, extra limbs, watermark, text, logo, number, letter, signature'
const VIDEO_PROMPT = '镜头缓慢推近，她轻轻转头望向窗外，眨了一下眼，双手捧杯微微送到唇边，咖啡馆午后光线洒在脸上，发丝轻微飘动，氛围安静，电影感'

function paramsOf(dto: StylePreviewMetadataDto): Record<string, string | number> {
  return Object.fromEntries(dto.params.map(param => [param.key, param.value]))
}

function u32(value: number): Buffer {
  const result = Buffer.alloc(4)
  result.writeUInt32BE(value)
  return result
}

function box(type: string | Buffer, ...payload: Buffer[]): Buffer {
  const typeBuffer = typeof type === 'string' ? Buffer.from(type, 'ascii') : type
  return Buffer.concat([u32(8 + typeBuffer.length + payload.reduce((sum, item) => sum + item.length, 0) - 4), typeBuffer, ...payload])
}

function box64(type: string, ...payload: Buffer[]): Buffer {
  const size = 16 + payload.reduce((sum, item) => sum + item.length, 0)
  const sizeBuffer = Buffer.alloc(8)
  sizeBuffer.writeBigUInt64BE(BigInt(size))
  return Buffer.concat([u32(1), Buffer.from(type, 'ascii'), sizeBuffer, ...payload])
}

function pngChunk(type: string, data: Buffer): Buffer {
  return Buffer.concat([u32(data.length), Buffer.from(type, 'ascii'), data, u32(0)])
}

function pngWithPrompt(prompt?: string): Buffer {
  const chunks = [pngChunk('IHDR', Buffer.alloc(13))]
  if (prompt !== undefined) chunks.push(pngChunk('tEXt', Buffer.concat([Buffer.from('prompt\0', 'ascii'), Buffer.from(prompt, 'utf8')])))
  chunks.push(pngChunk('IEND', Buffer.alloc(0)))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks])
}

const MINIMAL_IMAGE_GRAPH = JSON.stringify({
  p: { class_type: 'CLIPTextEncode', inputs: { text: '完整 positive prompt' } },
  s: { class_type: 'KSampler', inputs: { positive: ['p', 0], seed: 42 } },
})

function mp4WithPrompt(prompt: string, options: { keyIndex?: 1 | 2; largeFtyp?: boolean } = {}): Buffer {
  const keyIndex = options.keyIndex ?? 1
  const keyEntry = (key: string) => {
    const [namespace, name] = key.split('.')
    const body = Buffer.concat([Buffer.from(namespace, 'utf8'), Buffer.from(name, 'utf8')])
    return Buffer.concat([u32(4 + body.length), body])
  }
  const keys = box('keys', u32(0), u32(2), keyEntry(keyIndex === 1 ? 'mdta.prompt' : 'mdta.encoder'), keyEntry(keyIndex === 2 ? 'mdta.prompt' : 'mdta.encoder'))
  const item = (index: number, text: string) => box(u32(index), box('data', u32(1), u32(0), Buffer.from(text, 'utf8')))
  const ilst = box('ilst', item(1, keyIndex === 1 ? prompt : 'Lavf'), item(2, keyIndex === 2 ? prompt : 'Lavf'))
  const meta = box('meta', u32(0), keys, ilst)
  const ftypPayload = Buffer.from('isom\0\0\0\0isom', 'ascii')
  const ftyp = options.largeFtyp ? box64('ftyp', ftypPayload) : box('ftyp', ftypPayload)
  return Buffer.concat([ftyp, box('moov', box('udta', meta))])
}

async function readA1(kind: 'image' | 'video', tier: 'std' | 'turbo' | 'fast' = 'std') {
  return readStylePreviewMetadata(kind === 'image'
    ? { styleId: 'A1', mediaKind: 'image' }
    : { styleId: 'A1', mediaKind: 'video', tier })
}

beforeAll(async () => {
  // 确认测试使用真实媒体，而非仅测试合成容器。
  await expect(readFile(path.join(PREVIEW_ROOT, 'A1_数字电影写实.png'))).resolves.toBeInstanceOf(Buffer)
})

describe('feature-815 真实 A1 内嵌元数据', () => {
  it('PNG：完整正负提示词与采样 / 画幅 / 模型均取文件实值', async () => {
    const dto = await readA1('image')
    expect(dto.status).toBe('ok')
    expect(dto.prompts).toEqual([
      { key: 'positive', label: '正向提示词', text: IMAGE_POSITIVE },
      { key: 'negative', label: '负向提示词', text: IMAGE_NEGATIVE },
    ])
    expect(paramsOf(dto)).toMatchObject({
      seed: 947870040, steps: 20, cfg: 2.5, sampler: 'euler', scheduler: 'normal', denoise: 1,
      width: 768, height: 1344,
      'model.unet_name.1': 'qwen_image_2512_fp8_e4m3fn.safetensors',
      'model.clip_name.1': 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
      'model.vae_name.1': 'qwen_image_vae.safetensors',
    })
    expect(JSON.stringify(dto)).not.toContain(PREVIEW_ROOT)
  })

  it.each([
    ['std', 1789724923, 20, 'res_multistep', undefined, 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'],
    ['turbo', 1789730197, 8, 'res_multistep', undefined, 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'],
    ['fast', 1789713601, 8, 'euler', 1, 'fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors'],
  ] as const)('MP4 %s：档位参数不猜档名、不串图片', async (tier, seed, steps, sampler, cfg, model) => {
    const dto = await readA1('video', tier)
    expect(dto.status).toBe('ok')
    expect(dto.prompts).toEqual([{ key: 'motion', label: '运动提示词', text: VIDEO_PROMPT }])
    expect(paramsOf(dto)).toMatchObject({
      seed, steps, sampler, scheduler: 'simple', denoise: 1,
      width: 768, height: 1344, frames: 124, fps: 24,
      firstFrame: 'A1_数字电影写实.png',
      'model.unet_name.1': model,
      'model.clip_name.1': 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
      'model.vae_name.1': 'minimax_h3_video_vae_fp16.safetensors',
      'model.vae_name.2': 'minimax_h3_audio_vae_fp32.safetensors',
    })
    expect(paramsOf(dto).cfg).toBe(cfg)
    expect(dto.prompts.some(prompt => prompt.text === IMAGE_POSITIVE)).toBe(false)
    if (tier === 'turbo') {
      expect(paramsOf(dto)['model.lora_name.1']).toBe('minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors')
    }
  })

  it('现有 18 张 PNG 均可解析；主风格现有 MP4 不返回 invalid', async () => {
    for (const entry of STYLE_REGISTRY) {
      const image = await readStylePreviewMetadata({ styleId: entry.id, mediaKind: 'image' })
      expect(image.status, `${entry.id} image`).toBe('ok')
      if (entry.role !== 'main') continue
      for (const tier of ['std', 'turbo', 'fast'] as const) {
        const video = await readStylePreviewMetadata({ styleId: entry.id, mediaKind: 'video', tier })
        expect(video.status === 'ok' || video.status === 'missing', `${entry.id} ${tier}: ${video.status}`).toBe(true)
      }
    }
  }, 30000)
})

describe('feature-815 PNG / MP4 合成边界', () => {
  it('PNG prompt 正常解析；无 prompt 为 no-metadata', () => {
    const parsed = parseStylePreviewMetadata(pngWithPrompt(MINIMAL_IMAGE_GRAPH), 'image')
    expect(parsed).toMatchObject({ status: 'ok', prompts: [{ text: '完整 positive prompt' }], params: [{ key: 'seed', value: 42 }] })
    expect(parseStylePreviewMetadata(pngWithPrompt(), 'image').status).toBe('no-metadata')
  })

  it('PNG 坏 JSON / 截断 / UI Format / 超限均 closed 失败', () => {
    expect(() => parseStylePreviewMetadata(pngWithPrompt('{bad'), 'image')).toThrowError(expect.objectContaining({ status: 'invalid' }))
    const truncated = pngWithPrompt(MINIMAL_IMAGE_GRAPH).subarray(0, 20)
    expect(() => parseStylePreviewMetadata(truncated, 'image')).toThrow(MetadataParseError)
    expect(() => parseStylePreviewMetadata(pngWithPrompt(JSON.stringify({ nodes: [], links: [] })), 'image')).toThrowError(expect.objectContaining({ status: 'unsupported' }))
    expect(() => parseStylePreviewMetadata(pngWithPrompt(' '.repeat(8 * 1024 * 1024 + 1)), 'image')).toThrowError(expect.objectContaining({ status: 'invalid' }))
  })

  it('MP4 按 keys 索引取第二项 prompt，支持 64 位 box', () => {
    const buffer = mp4WithPrompt(MINIMAL_IMAGE_GRAPH, { keyIndex: 2, largeFtyp: true })
    // 用视频 graph 替换最小图片 graph 的正文，验证容器路径而非媒体提取。
    const videoGraph = JSON.stringify({
      h: { class_type: 'MiniMaxH3ImageToVideo', inputs: { prompt: 'motion', width: 768, height: 1344, length: 124 } },
      s: { class_type: 'SamplerCustomAdvanced', inputs: {} },
    })
    const parsed = parseStylePreviewMetadata(mp4WithPrompt(videoGraph, { keyIndex: 2, largeFtyp: true }), 'video')
    expect(parsed.status).toBe('ok')
    expect(parsed.prompts).toEqual([expect.objectContaining({ text: 'motion' })])
    expect(parsed.params).toEqual(expect.arrayContaining([{ key: 'frames', label: '帧数', value: 124 }]))
    expect(buffer.readUInt32BE(0)).toBe(1)
  })

  it('MP4 无 moov / 无 prompt 为 no-metadata，不全文件搜 JSON', () => {
    const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isom', 'ascii'))
    expect(parseStylePreviewMetadata(ftyp, 'video').status).toBe('no-metadata')
    const withFakeJson = Buffer.concat([ftyp, box('free', Buffer.from(JSON.stringify({ prompt: MINIMAL_IMAGE_GRAPH }), 'utf8'))])
    expect(parseStylePreviewMetadata(withFakeJson, 'video').status).toBe('no-metadata')
  })

  it('MP4 畸形 box / 坏 JSON / 非 ftyp 容器为 invalid', () => {
    expect(() => parseStylePreviewMetadata(Buffer.concat([box('ftyp', Buffer.alloc(4)), u32(4)]), 'video')).toThrowError(expect.objectContaining({ status: 'invalid' }))
    expect(() => parseStylePreviewMetadata(mp4WithPrompt('{bad'), 'video')).toThrowError(expect.objectContaining({ status: 'invalid' }))
    expect(() => parseStylePreviewMetadata(Buffer.from('not an mp4 file'), 'video')).toThrowError(expect.objectContaining({ status: 'invalid' }))
  })
})

describe('feature-815 封闭资源服务', () => {
  it.each([
    null,
    { styleId: '../A1', mediaKind: 'image' },
    { styleId: 'A1', mediaKind: 'image', tier: 'std' },
    { styleId: 'A1', mediaKind: 'video' },
    { styleId: 'A1', mediaKind: 'video', tier: 'other' },
  ])('非法请求拒绝且不返回媒体 DTO：%j', async request => {
    await expect(readStylePreviewMetadata(request)).rejects.toThrow('INVALID_REQUEST')
  })

  it('白名单内缺档返回 missing，不泄露路径', async () => {
    const dto = await readStylePreviewMetadata({ styleId: 'D4', mediaKind: 'video', tier: 'fast' })
    expect(dto).toMatchObject({ status: 'missing', prompts: [], params: [] })
    expect(JSON.stringify(dto)).not.toContain(process.cwd())
  })
})
