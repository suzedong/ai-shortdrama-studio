# SDG-RE-契约 · feature-001-立项

> **[反向补录]** 本契约从代码逐字段提取，与 2026-10-03 代码现状一致。类型真相位于 [shared/types.ts](../../../shared/types.ts)（共享层只读）。

## 1. 数据类型（shared/types.ts）

```ts
type Stage = 'idea' | 'diagnosis' | 'brief' | 'background' | 'story'

interface FiveElements {
  genre: string            // 题材赛道
  platforms: string[]      // 目标平台
  episodeDuration: string  // 单集时长
  episodeCount: string     // 集数
  tone: string             // 风格基调
}

interface VisualStyle {
  form: string          // 形态
  mainStyle: string     // 主画风
  l2Anchor: string      // L2 视觉风格锚词表
  l1World: string       // L1 世界观锚
  qualityRecipe: string // 质感配方
  anchorWords: string   // 锚点词
}

interface PreflightCheck { id: number; name: string; value: string; locked: boolean }

interface TopicDiagnosis {
  benchmarkCases: { name: string; platform: string; score: string; play: string; insight: string }[]
  userInsight: string
  hookPatterns: string[]
  compliance: string[]
  conclusion: string
}

interface ProjectBrief {
  version: number
  fiveElements: FiveElements
  visualStyle: VisualStyle
  preflight: PreflightCheck[]
  benchmarkSummary: string
  conclusion: string
}

interface GateCard {
  id: string
  title: string
  stage: Stage
  summary: string
  harness: { label: string; pass: boolean }[]
  actions: ('confirm' | 'partial' | 'reject')[]
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  toolCall?: { name: string; args: string; result: string }
  gate?: GateCard
  ts: number
}
```

注：`PreflightCheck`、`ProjectBrief`、`ChatMessage`、`Stage='story'` 当前未被业务代码使用（仅类型定义存在）。

## 2. IPC 通道（electron/main.ts）

| 通道 | 入参 | 返回 | 行为 |
| :-- | :-- | :-- | :-- |
| `project:create` | `title: string` | `{ id: string; title: string; createdAt: string }` | id 为 `Date.now()` 字符串；前端未使用 |
| `agent:diagnose` | `idea: string` | `TopicDiagnosis` | 调火山方舟；未配置/失败降级 mock |
| `agent:visual-style` | `fe: FiveElements` | `VisualStyle & { rationale: string }` | 调火山方舟（temperature 0.6）；失败降级 mock |
| `project:save` | `{ manifest: unknown; brief: unknown }` | `{ dir: string }` | 写两个 JSON 文件（见 §4） |
| `app:ark-status` | 无 | `{ configured: boolean; keyMasked: string; model: string }` | 状态查询 |

异常约定：主进程内 Agent 调用失败不外抛，捕获后返回 mock 数据；`project:save` 失败会拒绝（无捕获）。

## 3. 渲染进程 API（preload → window.api）

```ts
window.api = {
  createProject(title: string): Promise<{ id: string; title: string; createdAt: string }>
  diagnose(idea: string): Promise<TopicDiagnosis>
  recommendVisualStyle(fe: FiveElements): Promise<VisualStyle & { rationale: string }>
  saveProject(data: { manifest: unknown; brief: unknown }): Promise<{ dir: string }>
  arkStatus(): Promise<{ configured: boolean; keyMasked: string; model: string }>
}
```

安全约束：`contextIsolation: true`、`nodeIntegration: false`；渲染进程只经 `window.api` 访问主进程能力。

## 4. 文件落盘契约（project:save）

- 目录：`{app.getPath('documents')}/ai-shortdrama-studio/project-{Date.now()}/`
- `manifest.json`：`{ fiveElements: FiveElements, visualStyle: VisualStyle, createdAt: ISOString }`，JSON.stringify 缩进 2
- `brief.json`：`{ version: 1, fiveElements, visualStyle, benchmarkSummary: diagnosis.conclusion, conclusion: diagnosis.conclusion}`
- 编码：utf-8；目录递归创建

## 5. 火山方舟通道（electron/ark.ts）

环境变量（`.env`，经 dotenv 加载）：

| 变量 | 必填 | 默认 |
| :-- | :-- | :-- |
| `ARK_API_KEY` | 是 | — |
| `ARK_MODEL` | 是 | — |
| `ARK_BASE_URL` | 否 | `https://ark.cn-beijing.volces.com/api/v3`（实际 .env 使用 `…/api/coding/v3`） |

函数签名：

```ts
chat(messages: { role: 'system'|'user'|'assistant'; content: string }[], temperature?: number): Promise<string>
// temperature 默认 0.7；POST {BASE_URL}/chat/completions，OpenAI 兼容
// 未配置 → throw；HTTP 非 2xx → throw（含响应体）；返回 choices[0].message.content

maskKey(): string    // 前6位 + •••• + 后4位；无密钥返回 '(未配置)'
isConfigured(): boolean
```

## 6. Prompt 与解析（electron/prompts.ts）

| 导出 | 签名 | 说明 |
| :-- | :-- | :-- |
| `buildDiagnosisPrompt` | `(idea: string) => { system: string; user: string }` | 选题诊断 prompt |
| `parseDiagnosis` | `(raw: string) => TopicDiagnosis` | 剥 markdown 代码块 + 取首尾花括号后 JSON.parse |
| `buildVisualStylePrompt` | `(fe: FiveElements) => { system; user }` | 视觉风格 prompt |
| `parseVisualStyle` | `(raw: string) => VisualStyle & { rationale: string }` | 同上解析规则 |

## 7. 前端状态机契约（App.tsx）

- 节点状态流转（仅由确认门确认驱动）：
  - 初始：idea=active，其余 pending
  - 诊断返回：idea=done、diagnosis=active
  - 0-a 确认：diagnosis=done、brief=active → 弹 0-b
  - 0-b 确认：异步请求视觉风格 → 弹 0-c
  - 0-c 确认：执行 project:save → brief=done、background=active → 显示 BackgroundArchive
  - 档案锁定：background=done
- 否决：关闭当前确认门（无状态回退）

## 8. MCP 网关（mcp/server.ts，非本 Feature 运行链路）

- server 名 `shortdrama-mcp` v0.1.0，stdio 传输
- 注册 6 个工具：`canvas.read`、`project.manifest`、`file.write`、`video.submit`、`harness.verify`、`skill.list`
- 所有调用返回 `{ content: [{ type: 'text', text: '[mock] tool=… args=…' }] }`
