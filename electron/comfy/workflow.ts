// feature-816 · 受控 MiniMax H3 Image API Format 清单加载与参数映射
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

interface InputRule {
  node: string
  field: string
  type: 'string' | 'integer' | 'number' | 'boolean'
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  values?: Record<string, string>
}

interface WorkflowEntry {
  id: string
  kind: 'image'
  model: 'MiniMax-H3'
  version: string
  file: string
  inputs: Record<string, InputRule>
}

export interface MappedWorkflow {
  workflow: Record<string, unknown>
  version: string
}

function fail(code: string, message: string, cause?: unknown): never {
  throw Object.assign(new Error(message), { code, ...(cause === undefined ? {} : { cause }) })
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function defaultWorkflowDirectory(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(moduleDir, '../../resources/comfyui/workflows'),
    path.resolve(moduleDir, '../../../resources/comfyui/workflows'),
    path.resolve(process.cwd(), 'resources/comfyui/workflows'),
  ]
  return candidates.find(candidate => fs.existsSync(path.join(candidate, 'manifest.json'))) ?? candidates[2]
}

function parseManifest(raw: unknown): WorkflowEntry[] {
  if (!object(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.workflows)) {
    fail('WORKFLOW_INVALID', '工作流清单形状无效')
  }
  const ids = new Set<string>()
  return raw.workflows.map(rawEntry => {
    if (!object(rawEntry) || !text(rawEntry.id) || rawEntry.kind !== 'image' || rawEntry.model !== 'MiniMax-H3'
      || !text(rawEntry.version) || !text(rawEntry.file) || !object(rawEntry.inputs)) {
      fail('WORKFLOW_INVALID', '清单项必须为受控 MiniMax H3 Image 工作流')
    }
    if (ids.has(rawEntry.id)) fail('WORKFLOW_INVALID', `工作流 id 重复：${rawEntry.id}`)
    ids.add(rawEntry.id)
    const inputs: Record<string, InputRule> = {}
    for (const [key, rawRule] of Object.entries(rawEntry.inputs)) {
      if (!text(key) || !object(rawRule) || !text(rawRule.node) || !text(rawRule.field)
        || !['string', 'integer', 'number', 'boolean'].includes(String(rawRule.type))) {
        fail('WORKFLOW_INVALID', `工作流 ${rawEntry.id} 的输入规则无效：${key}`)
      }
      for (const limit of ['min', 'max', 'minLength', 'maxLength'] as const) {
        if (rawRule[limit] !== undefined && (typeof rawRule[limit] !== 'number' || !Number.isFinite(rawRule[limit]))) {
          fail('WORKFLOW_INVALID', `输入 ${key} 的 ${limit} 必须为有限数`)
        }
      }
      if (rawRule.required !== undefined && typeof rawRule.required !== 'boolean') {
        fail('WORKFLOW_INVALID', `输入 ${key} 的 required 必须为 boolean`)
      }
      if (rawRule.values !== undefined) {
        const values = rawRule.values
        if (rawRule.type !== 'string' || !object(values)
          || Object.entries(values).some(([stableValue, nodeValue]) => !text(stableValue) || !text(nodeValue))) {
          fail('WORKFLOW_INVALID', `输入 ${key} 的 values 必须为字符串映射`)
        }
      }
      inputs[key] = rawRule as unknown as InputRule
    }
    return {
      id: rawEntry.id,
      kind: 'image',
      model: 'MiniMax-H3',
      version: rawEntry.version,
      file: rawEntry.file,
      inputs,
    }
  })
}

function validateInput(key: string, value: unknown, rule: InputRule): void {
  if (rule.type === 'string' && typeof value !== 'string') fail('INVALID_ARGUMENT', `输入 ${key} 必须为字符串`)
  if (rule.type === 'boolean' && typeof value !== 'boolean') fail('INVALID_ARGUMENT', `输入 ${key} 必须为 boolean`)
  if (rule.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
    fail('INVALID_ARGUMENT', `输入 ${key} 必须为整数`)
  }
  if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    fail('INVALID_ARGUMENT', `输入 ${key} 必须为有限数`)
  }
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) fail('INVALID_ARGUMENT', `输入 ${key} 小于最小值 ${rule.min}`)
    if (rule.max !== undefined && value > rule.max) fail('INVALID_ARGUMENT', `输入 ${key} 大于最大值 ${rule.max}`)
  }
  if (typeof value === 'string') {
    const length = value.trim().length
    if (rule.minLength !== undefined && length < rule.minLength) fail('INVALID_ARGUMENT', `输入 ${key} 长度不足`)
    if (rule.maxLength !== undefined && length > rule.maxLength) fail('INVALID_ARGUMENT', `输入 ${key} 超出长度限制`)
  }
}

function validateApiWorkflow(raw: unknown): Record<string, unknown> {
  if (!object(raw) || Array.isArray(raw.nodes)) fail('WORKFLOW_INVALID', '仅支持 ComfyUI Save API Format JSON')
  const clone = structuredClone(raw)
  for (const [nodeId, rawNode] of Object.entries(clone)) {
    if (!object(rawNode) || !text(rawNode.class_type) || !object(rawNode.inputs)) {
      fail('WORKFLOW_INVALID', `API 工作流节点 ${nodeId} 缺少 class_type/inputs`)
    }
  }
  return clone
}

/** 只映射清单声明的公开输入，未声明节点与字段保持逐值不变。 */
export async function loadAndMapWorkflow(
  workflowId: string,
  inputs: Record<string, unknown> = {},
  directory = defaultWorkflowDirectory(),
): Promise<MappedWorkflow> {
  let manifestRaw: string
  try {
    manifestRaw = await fsp.readFile(path.join(directory, 'manifest.json'), 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fail('WORKFLOW_NOT_AVAILABLE', '尚未安装 MiniMax H3 Image API Format 工作流清单')
    }
    throw error
  }
  let entries: WorkflowEntry[]
  try {
    entries = parseManifest(JSON.parse(manifestRaw))
  } catch (error) {
    if (typeof (error as { code?: unknown })?.code === 'string') throw error
    fail('WORKFLOW_INVALID', '工作流清单不是有效 JSON', error)
  }
  const entry = entries.find(candidate => candidate.id === workflowId)
  if (!entry) fail('WORKFLOW_NOT_AVAILABLE', `MiniMax H3 Image 工作流不可用：${workflowId}`)
  if (path.extname(entry.file).toLowerCase() !== '.json' || path.isAbsolute(entry.file)) {
    fail('WORKFLOW_INVALID', `工作流 ${workflowId} 文件必须为目录内相对 .json`)
  }
  const workflowFile = path.resolve(directory, entry.file)
  const root = path.resolve(directory)
  if (workflowFile !== root && !workflowFile.startsWith(`${root}${path.sep}`)) {
    fail('WORKFLOW_INVALID', `工作流 ${workflowId} 文件路径逃逸`)
  }
  if (!object(inputs)) fail('INVALID_ARGUMENT', 'inputs 必须为对象')
  for (const key of Object.keys(inputs)) {
    if (!entry.inputs[key]) fail('INVALID_ARGUMENT', `工作流 ${workflowId} 未声明输入 ${key}`)
  }
  for (const [key, rule] of Object.entries(entry.inputs)) {
    if (rule.required && inputs[key] === undefined) fail('INVALID_ARGUMENT', `缺少必填输入 ${key}`)
    if (inputs[key] !== undefined) validateInput(key, inputs[key], rule)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await fsp.readFile(workflowFile, 'utf-8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fail('WORKFLOW_NOT_AVAILABLE', `工作流文件不存在：${entry.file}`)
    }
    if (error instanceof SyntaxError) fail('WORKFLOW_INVALID', `工作流 ${entry.file} 不是有效 JSON`, error)
    throw error
  }
  const workflow = validateApiWorkflow(parsed)
  for (const [key, value] of Object.entries(inputs)) {
    const rule = entry.inputs[key]
    let mappedValue = value
    if (rule.values) {
      if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(rule.values, value)) {
        fail('INVALID_ARGUMENT', `输入 ${key} 不是受控枚举值`)
      }
      mappedValue = rule.values[value]
    }
    const node = workflow[rule.node] as Record<string, unknown>
    if (!node) fail('WORKFLOW_INVALID', `工作流 ${workflowId} 缺少映射节点 ${rule.node}`)
    ;(node.inputs as Record<string, unknown>)[rule.field] = mappedValue
  }
  // 映射目标必须真实存在；即使公开输入为空，也检查全部声明节点，避免安装无效清单。
  for (const rule of Object.values(entry.inputs)) {
    if (!workflow[rule.node]) fail('WORKFLOW_INVALID', `工作流 ${workflowId} 缺少映射节点 ${rule.node}`)
  }
  return { workflow, version: entry.version }
}
