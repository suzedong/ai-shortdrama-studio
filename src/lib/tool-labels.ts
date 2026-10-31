// feature-808 D-011 · 工具动作短语映射与聚合摘要（纯展示层；零 LLM、零契约变更）
// feature-808 D-012 · 白名单关键参数摘要（toolArgPreview）：流式侧从 ToolView.args 现算，
//   历史侧由主进程 client.ts 按同源键表提取进 DTO argsPreview（两侧键表须同步修改）。
//
// 背景：opencode 的物理工具 ID 形如 shortdrama_canvas_get，业务方无法从中读出「Agent 干了什么」。
// MCP 注册时每个工具已带中文描述（electron/mcp/tools.ts），但描述不进 RuntimeEvent/DTO，
// 故本模块在 renderer 侧自持一份「物理 ID → 动作短语」枚举表：
//   - 短语取自 MCP 注册描述的首个动宾短语（如 canvas.get「获取当前项目画布」→ 读取画布）
//   - 枚举而非 AI 生成：符合 D-016「能写成枚举规则 → 系统直做」
//   - 纯函数、无副作用、不依赖时间/网络
//
// ID 双形态：opencode 把 MCP 工具名的点号换成下划线（brief.plan → shortdrama_brief_plan），
// 而 profile / 白名单仍写点号形式（shortdrama_brief.plan）。两种都在表内登记。

/** 归一后的逻辑工具键 → 中文动作短语（枚举；与 MCP 注册描述同源） */
const ACTION_PHRASES: Record<string, string> = {
  // 文件
  'file.read': '读取文件',
  'file.list': '列出文件',
  'file.write': '写入文件',
  // 画布
  'canvas.get': '读取画布',
  'canvas.update': '更新画布',
  'canvas.align': '对齐画布',
  // 裁决门
  'gate.request': '发起裁决门',
  // 资产
  'asset.register': '登记资产',
  'asset.list': '列出资产',
  // 引擎
  'comfyui.instances': '列出引擎实例',
  'comfyui.queue': '提交生成任务',
  'comfyui.status': '查询生成状态',
  // 立项单
  'brief.plan': '检查立项草案',
  'brief.publish': '发布立项单',
  'brief.list': '查建立项版本',
  'brief.impact.assess': '评估变更影响',
  'brief.impact.commit': '提交立项再版',
  // 流程状态机
  'manifest.get': '读取阶段状态',
  'manifest.advance': '推进阶段状态',
  // 视觉风格谱系
  'style.catalog': '读取风格谱系',
  'style.get': '查询风格明细',
  'style.validate': '校验风格引用',
  // 已捕获口径
  'capture.list': '读取已捕获口径',
  'capture.upsert': '写入已捕获口径',
  'capture.remove': '删除已捕获口径',
  // 公开检索
  'web.search': '检索公开网页',
  'web.fetch': '抓取网页正文',
  // 基础校验
  'harness.validate': '运行基础校验',
}

const PHYSICAL_PREFIX = 'shortdrama_'

/**
 * 物理 ID → 短语查找表：同时登记「点号形式」（shortdrama_brief.plan）与
 * 「下划线形式」（shortdrama_brief_plan），另登记去前缀的裸名（canvas.get / canvas_get）。
 */
const PHRASE_BY_ID: Record<string, string> = (() => {
  const table: Record<string, string> = {}
  for (const [key, phrase] of Object.entries(ACTION_PHRASES)) {
    const underscored = key.replace(/\./g, '_')
    table[key] = phrase
    table[underscored] = phrase
    table[`${PHYSICAL_PREFIX}${key}`] = phrase
    table[`${PHYSICAL_PREFIX}${underscored}`] = phrase
  }
  return table
})()

/**
 * 物理工具 ID → 中文动作短语。
 * 未知工具（未收录枚举 / opencode 内置工具如 task）回退为去前缀后的原 ID，不臆造名称。
 */
export function toolActionPhrase(physical: string): string {
  if (!physical) return ''
  const hit = PHRASE_BY_ID[physical]
  if (hit) return hit
  return physical.startsWith(PHYSICAL_PREFIX) ? physical.slice(PHYSICAL_PREFIX.length) : physical
}

/**
 * 一组工具调用 → 动作摘要短语（去重 + 计数 + 首次出现顺序）。
 * 例：['读取画布','读取画布','检索公开网页'] → '读取画布 ×2 · 检索公开网页'
 * 计数为 1 时省略「×1」。
 */
export function summarizeToolActions(physicalTools: readonly string[]): string {
  const counts = new Map<string, number>()
  for (const physical of physicalTools) {
    const phrase = toolActionPhrase(physical)
    if (!phrase) continue
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([phrase, n]) => (n > 1 ? `${phrase} ×${n}` : phrase))
    .join(' · ')
}

/**
 * D-012 白名单关键参数键表（归一化逻辑名：去 shortdrama_ 前缀、点号转下划线 → 候选参数键，按优先级取首个非空字符串）。
 * 只收录「读了/写了什么」的关键字段（路径、口径 topic、检索词、URL 等），不收录大对象与敏感字段。
 * ⚠ 与 electron/runtime/client.ts 的 ARG_PREVIEW_KEYS 同源镜像：改任一侧必须同步另一侧。
 */
const ARG_PREVIEW_KEYS: Record<string, readonly string[]> = {
  file_read: ['path'],
  file_list: ['dir'],
  file_write: ['path'],
  capture_upsert: ['topic', 'id'],
  capture_remove: ['id'],
  web_search: ['query'],
  web_fetch: ['url'],
  gate_request: ['title', 'gateId'],
  asset_register: ['path'],
  comfyui_queue: ['instanceId'],
  comfyui_status: ['jobId'],
  style_get: ['id'],
  manifest_advance: ['event'],
}

const ARG_PREVIEW_LIMIT = 80

/**
 * 工具物理 ID + 入参 → 白名单关键参数摘要（如「题材赛道」「brief/立项单.v3.json」）。
 * 未知工具 / 无白名单 / 候选键均非非空字符串 → ''。超长截断 80 字符。
 */
export function toolArgPreview(physical: string, args: unknown): string {
  if (!physical || typeof args !== 'object' || args === null) return ''
  const bare = physical.startsWith(PHYSICAL_PREFIX) ? physical.slice(PHYSICAL_PREFIX.length) : physical
  const keys = ARG_PREVIEW_KEYS[bare.replace(/\./g, '_')]
  if (!keys) return ''
  const record = args as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.length > ARG_PREVIEW_LIMIT ? `${value.slice(0, ARG_PREVIEW_LIMIT)}…` : value
    }
  }
  return ''
}
