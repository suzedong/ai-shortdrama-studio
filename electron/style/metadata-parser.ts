import { TextDecoder } from 'node:util'
import type {
  StylePreviewMediaKind,
  StylePreviewParameter,
  StylePreviewPrompt,
} from './types.js'

export interface ParsedStylePreviewMetadata {
  status: 'ok' | 'no-metadata'
  prompts: StylePreviewPrompt[]
  params: StylePreviewParameter[]
}

const MAX_METADATA_BYTES = 8 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true })

export class MetadataParseError extends Error {
  constructor(readonly status: 'invalid' | 'unsupported') {
    super(status)
  }
}

interface ApiNode {
  id: string
  classType: string
  inputs: Record<string, unknown>
}

type ApiGraph = Map<string, ApiNode>
interface Box {
  type: string
  typeOffset: number
  dataStart: number
  end: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(): never {
  throw new MetadataParseError('invalid')
}

function decodeUtf8(buffer: Buffer): string {
  if (buffer.byteLength > MAX_METADATA_BYTES) invalid()
  try {
    return UTF8_STRICT.decode(buffer)
  } catch {
    return invalid()
  }
}

function readPngPrompt(buffer: Buffer): string | null {
  if (buffer.byteLength < PNG_SIGNATURE.byteLength || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) invalid()
  let offset = 8
  let prompt: string | null = null
  let ended = false
  while (offset < buffer.byteLength) {
    if (offset + 12 > buffer.byteLength) invalid()
    const length = buffer.readUInt32BE(offset)
    const end = offset + 12 + length
    if (!Number.isSafeInteger(end) || end > buffer.byteLength) invalid()
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (type === 'tEXt' && prompt === null) {
      const separator = buffer.indexOf(0, dataStart)
      if (separator < 0 || separator >= dataEnd) invalid()
      const keyword = buffer.toString('ascii', dataStart, separator)
      if (keyword === 'prompt') {
        prompt = decodeUtf8(buffer.subarray(separator + 1, dataEnd))
      }
    }
    offset = end
    if (type === 'IEND') {
      if (length !== 0) invalid()
      ended = true
      break
    }
  }
  if (!ended) invalid()
  return prompt
}

function readBox(buffer: Buffer, start: number, parentEnd: number): { box: Box; next: number } {
  if (start + 8 > parentEnd) invalid()
  const smallSize = buffer.readUInt32BE(start)
  const typeOffset = start + 4
  const type = buffer.toString('ascii', typeOffset, typeOffset + 4)
  let headerSize = 8
  let size = smallSize
  if (smallSize === 1) {
    if (start + 16 > parentEnd) invalid()
    const largeSize = buffer.readBigUInt64BE(start + 8)
    if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) invalid()
    size = Number(largeSize)
    headerSize = 16
  }
  const end = smallSize === 0 ? parentEnd : start + size
  if ((smallSize !== 0 && size < headerSize) || !Number.isSafeInteger(end) || end > parentEnd) invalid()
  return { box: { type, typeOffset, dataStart: start + headerSize, end }, next: end }
}

function children(buffer: Buffer, start: number, end: number): Box[] {
  const result: Box[] = []
  let offset = start
  while (offset < end) {
    const { box, next } = readBox(buffer, offset, end)
    if (next <= offset) invalid()
    result.push(box)
    offset = next
  }
  if (offset !== end) invalid()
  return result
}

function readMp4Prompt(buffer: Buffer): string | null {
  if (buffer.byteLength < 8) invalid()
  const top = children(buffer, 0, buffer.byteLength)
  if (!top.some(box => box.type === 'ftyp')) invalid()
  const moov = top.find(box => box.type === 'moov')
  if (!moov) return null
  const udta = children(buffer, moov.dataStart, moov.end).find(box => box.type === 'udta')
  if (!udta) return null
  const meta = children(buffer, udta.dataStart, udta.end).find(box => box.type === 'meta')
  if (!meta || meta.dataStart + 4 > meta.end) return null
  const metaChildren = children(buffer, meta.dataStart + 4, meta.end)
  const keys = metaChildren.find(box => box.type === 'keys')
  const ilst = metaChildren.find(box => box.type === 'ilst')
  if (!keys || !ilst) return null
  if (keys.dataStart + 8 > keys.end) invalid()

  const keyCount = buffer.readUInt32BE(keys.dataStart + 4)
  if (keyCount > 4096) invalid()
  let keyOffset = keys.dataStart + 8
  let promptIndex: number | null = null
  for (let index = 1; index <= keyCount; index += 1) {
    if (keyOffset + 8 > keys.end) invalid()
    const entrySize = buffer.readUInt32BE(keyOffset)
    const entryEnd = keyOffset + entrySize
    if (entrySize < 8 || !Number.isSafeInteger(entryEnd) || entryEnd > keys.end) invalid()
    const namespace = buffer.toString('utf8', keyOffset + 4, keyOffset + 8)
    const key = buffer.toString('utf8', keyOffset + 8, entryEnd)
    if (`${namespace}.${key}` === 'mdta.prompt') promptIndex = index
    keyOffset = entryEnd
  }
  if (keyOffset !== keys.end) invalid()
  if (promptIndex === null) return null

  const item = children(buffer, ilst.dataStart, ilst.end).find(
    box => buffer.readUInt32BE(box.typeOffset) === promptIndex,
  )
  if (!item) return null
  for (const data of children(buffer, item.dataStart, item.end)) {
    if (data.type !== 'data') continue
    if (data.dataStart + 8 > data.end) invalid()
    if (buffer.readUInt32BE(data.dataStart) !== 1) continue
    return decodeUtf8(buffer.subarray(data.dataStart + 8, data.end))
  }
  return null
}

function parseGraph(text: string): ApiGraph {
  if (Buffer.byteLength(text) > MAX_METADATA_BYTES) invalid()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return invalid()
  }
  if (!isRecord(raw) || Array.isArray(raw.nodes) || Array.isArray(raw.links)) {
    throw new MetadataParseError('unsupported')
  }
  const graph: ApiGraph = new Map()
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.class_type !== 'string' || !isRecord(value.inputs)) {
      throw new MetadataParseError('unsupported')
    }
    graph.set(id, { id, classType: value.class_type, inputs: value.inputs })
  }
  if (graph.size === 0) throw new MetadataParseError('unsupported')
  return graph
}

function linkedNode(graph: ApiGraph, value: unknown): ApiNode | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const [id, slot] = value
  if ((typeof id !== 'string' && typeof id !== 'number') || typeof slot !== 'number' || !Number.isInteger(slot)) {
    return undefined
  }
  return graph.get(String(id))
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function fileBase(value: unknown): string | undefined {
  const text = nonEmptyString(value)?.replace(/\0/g, '')
  if (!text) return undefined
  const base = text.replace(/\\/g, '/').split('/').filter(Boolean).pop()
  return base || undefined
}

function addNumber(params: StylePreviewParameter[], key: string, label: string, value: unknown): void {
  const number = finiteNumber(value)
  if (number !== undefined) params.push({ key, label, value: number })
}

function addText(params: StylePreviewParameter[], key: string, label: string, value: unknown): void {
  const text = nonEmptyString(value)
  if (text !== undefined) params.push({ key, label, value: text })
}

function addFile(params: StylePreviewParameter[], key: string, label: string, value: unknown): void {
  const name = fileBase(value)
  if (name !== undefined) params.push({ key, label, value: name })
}

function encodedText(graph: ApiGraph, value: unknown): string | undefined {
  const direct = nonEmptyString(value)
  if (direct !== undefined) return direct
  const source = linkedNode(graph, value)
  if (!source) return undefined
  return nonEmptyString(source.inputs.text) ?? nonEmptyString(source.inputs.prompt)
}

function findNode(graph: ApiGraph, classType: string): ApiNode | undefined {
  return [...graph.values()].find(node => node.classType === classType)
}

function extractImage(graph: ApiGraph): Pick<ParsedStylePreviewMetadata, 'prompts' | 'params'> {
  const sampler = findNode(graph, 'KSampler')
  if (!sampler) throw new MetadataParseError('unsupported')
  const prompts: StylePreviewPrompt[] = []
  const positive = encodedText(graph, sampler.inputs.positive)
  const negative = encodedText(graph, sampler.inputs.negative)
  if (positive !== undefined) prompts.push({ key: 'positive', label: '正向提示词', text: positive })
  if (negative !== undefined) prompts.push({ key: 'negative', label: '负向提示词', text: negative })

  const params: StylePreviewParameter[] = []
  addNumber(params, 'seed', 'Seed', sampler.inputs.seed)
  addNumber(params, 'steps', 'Steps', sampler.inputs.steps)
  addNumber(params, 'cfg', 'CFG', sampler.inputs.cfg)
  addText(params, 'sampler', '采样器', sampler.inputs.sampler_name)
  addText(params, 'scheduler', '调度器', sampler.inputs.scheduler)
  addNumber(params, 'denoise', 'Denoise', sampler.inputs.denoise)
  const latent = linkedNode(graph, sampler.inputs.latent_image)
    ?? [...graph.values()].find(node => node.classType.includes('LatentImage'))
  addNumber(params, 'width', '宽度', latent?.inputs.width)
  addNumber(params, 'height', '高度', latent?.inputs.height)
  params.push(...extractModels(graph))
  return { prompts, params }
}

function extractVideo(graph: ApiGraph): Pick<ParsedStylePreviewMetadata, 'prompts' | 'params'> {
  const h3 = findNode(graph, 'MiniMaxH3ImageToVideo')
  const sampler = findNode(graph, 'SamplerCustomAdvanced')
  if (!h3 || !sampler) throw new MetadataParseError('unsupported')
  const prompts: StylePreviewPrompt[] = []
  const motion = nonEmptyString(h3.inputs.prompt) ?? nonEmptyString(h3.inputs.text)
  if (motion !== undefined) prompts.push({ key: 'motion', label: '运动提示词', text: motion })

  const scheduler = linkedNode(graph, sampler.inputs.sigmas)
  const selector = linkedNode(graph, sampler.inputs.sampler)
  const noise = linkedNode(graph, sampler.inputs.noise)
  const guider = linkedNode(graph, sampler.inputs.guider)
  const createVideo = findNode(graph, 'CreateVideo')
  const firstFrame = linkedNode(graph, h3.inputs.first_frame)
  const params: StylePreviewParameter[] = []
  addNumber(params, 'seed', 'Seed', noise?.inputs.noise_seed ?? noise?.inputs.seed)
  addNumber(params, 'steps', 'Steps', scheduler?.inputs.steps)
  addNumber(params, 'cfg', 'CFG', guider?.inputs.cfg)
  addText(params, 'sampler', '采样器', selector?.inputs.sampler_name)
  addText(params, 'scheduler', '调度器', scheduler?.inputs.scheduler)
  addNumber(params, 'denoise', 'Denoise', scheduler?.inputs.denoise)
  addNumber(params, 'width', '宽度', h3.inputs.width)
  addNumber(params, 'height', '高度', h3.inputs.height)
  addNumber(params, 'frames', '帧数', h3.inputs.length ?? h3.inputs.frames)
  addNumber(params, 'fps', 'FPS', createVideo?.inputs.frame_rate ?? createVideo?.inputs.fps)
  addFile(params, 'firstFrame', '首帧文件', firstFrame?.inputs.image ?? h3.inputs.first_frame)
  params.push(...extractModels(graph))
  return { prompts, params }
}

function extractModels(graph: ApiGraph): StylePreviewParameter[] {
  const fields = [
    ['unet_name', '主模型'],
    ['clip_name', 'CLIP'],
    ['vae_name', 'VAE'],
    ['lora_name', 'LoRA'],
    ['ckpt_name', '模型'],
  ] as const
  const result: StylePreviewParameter[] = []
  const labelCounts = new Map<string, number>()
  for (const node of graph.values()) {
    if (!/(?:Loader|Lora)/i.test(node.classType)) continue
    for (const [inputKey, baseLabel] of fields) {
      const name = fileBase(node.inputs[inputKey])
      if (name === undefined) continue
      const count = (labelCounts.get(baseLabel) ?? 0) + 1
      labelCounts.set(baseLabel, count)
      result.push({
        key: `model.${inputKey}.${count}`,
        label: count > 1 ? `${baseLabel} ${count}` : baseLabel,
        value: name,
      })
    }
  }
  return result
}

export function parseStylePreviewMetadata(
  buffer: Buffer,
  kind: StylePreviewMediaKind,
): ParsedStylePreviewMetadata {
  const text = kind === 'image' ? readPngPrompt(buffer) : readMp4Prompt(buffer)
  if (text === null) return { status: 'no-metadata', prompts: [], params: [] }
  const graph = parseGraph(text)
  const extracted = kind === 'image' ? extractImage(graph) : extractVideo(graph)
  return { status: 'ok', ...extracted }
}
