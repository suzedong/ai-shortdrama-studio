# SDG-RE 契约 · feature-016 架构重建总纲（MiniMax Design 形态对齐）

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 本文件锁定目标架构的分层、Agent 边界、纯工具集、数据模型、IPC 与错误契约。
> 后续 feature-017+ 的实现必须严格匹配本契约；字段 / 签名变更即 K8，须重新评审。
> 沿用不重议的既锁决策：opencode `1.18.34`、仅 127.0.0.1、随机 Basic 口令仅内存（feature-008 D-006/D-008）、媒体通道终局（D-010）。

---

## 1. 分层架构与依赖方向

### 1.1 五层（单向依赖，禁止反向 / 跨层直连）

```
┌─────────────────────────────────────────────────────────────┐
│ L5 Renderer（React）                                        │
│   ChatStream · CanvasView(节点+自动边渲染) · GateCard ·      │
│   ProductViewer · AssetLibrary · SkillPanel                 │
│   只做：渲染主进程投影 + 收集用户输入；不含流程编排           │
└───────────────▲─────────────────────────────────────────────┘
                │ IPC（contextBridge 白名单；无任何网络直连）
┌───────────────┴─────────────────────────────────────────────┐
│ L4 Main IPC 适配层（electron/main.ts + preload.ts）          │
│   参数边界校验 · 会话/画布/资产/设置 IPC · 事件订阅广播        │
└───────▲───────────────────────────▲──────────────────────────┘
        │                           │
┌───────┴──────────────┐  ┌─────────┴─────────────────────────┐
│ L3 Agent 运行时       │  │ L2 引擎/媒体服务                  │
│  标准 opencode serve  │  │  ComfyUI 客户端（本地/局域网，     │
│  Agent profiles 摄制组│  │  地址可配、多实例）· 资产索引      │
│  自身推理产出文本      │  │  媒体提交/工作流/状态轮询          │
└───────▲──────────────┘  └─────────▲─────────────────────────┘
        │ tools/call（唯一接触面）    │ 主进程内部调用
┌───────┴────────────────────────────┴─────────────────────────┐
│ L1 MCP 纯工具层（electron/mcp，Streamable HTTP 单端点）       │
│   file.* · canvas.* · gate.* · asset.* · comfyui.*           │
│   纯执行原语：零 LLM、零 prompt、零模型 SDK                   │
└──────────────────────────────────────────────────────────────┘
        │ 仅主进程单写队列访问
┌───────▽─────────────────────────────────────────────────────┐
│ L0 持久化：纯 JSON / MD 文件（项目目录 + 版本归档），无数据库  │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 依赖方向铁律

1. **Renderer 不 import 任何 opencode / ark / comfyui / mcp 模块**，只经 `window.api`。
2. **Agent（L3）只能通过 MCP tools 接触文件 / 画布 / 媒体**；不直连文件系统以外的业务状态。
3. **MCP 工具（L1）禁止反向调用 Agent / LLM**；工具入参出参都是纯数据。
4. **媒体调用收敛在主进程 L2**；Renderer 与 Agent 都不直连 ComfyUI（Agent 经 `comfyui.*` 工具）。
5. opencode 运行时基建（manager / projection / SSE 传输）**保留沿用**；重写的是 profile 内容、工具集、renderer、数据模型。

## 2. Agent 摄制组（profile 集合）

对标 Design 的 router/planner/executor/media-agent/comfyui-agent，按八步闭环收敛为 **1 主 + 3 专**（最小够用，不预建冗余角色）。

| Agent（name） | mode | 职责 | 模型 | 可用工具（白名单） |
|---|---|---|---|---|
| `showrunner`（主创/主控，取代 director） | primary | 理解意图、立项诊断、拆解八步任务、在关键节点发确认门、分派专职 agent、自身产出立项/故事/剧本类文本 | `ark/<ARK_MODEL>` | `file.read` `file.list` `file.write` `canvas.get` `canvas.update` `gate.request` `task`（仅可调用下列专职 agent） |
| `writer`（编剧） | subagent | 故事大纲、人物小传、分场、台词的文本推理与落盘 | `ark/<ARK_MODEL>` | `file.read` `file.list` `file.write` `canvas.get` `canvas.update` |
| `media-director`（媒体导演） | subagent | 资产（3 步）、分镜/镜头（4/5 步）的结构化文本与镜头设计；提交媒体任务 | `ark/<ARK_MODEL>` | `file.*` `canvas.*` `asset.*` `comfyui.queue` `comfyui.status` |
| `comfyui-operator`（引擎操作员） | subagent | 选择/参数化 ComfyUI 工作流、轮询产出、回写资产与画布；不做创意文本 | `ark/<ARK_MODEL>`（轻量/低 temperature） | `comfyui.*` `asset.*` `canvas.update` `file.*` |

契约：

1. **所有文本产物由 Agent 自身推理产出**，经 `file.write` / `canvas.update` 落盘；不存在"调用工具生成内容"。
2. profile frontmatter 用 `mode/model/temperature/tools/permission`；modelID 仍以启动时 `__ARK_MODEL_ID__` 占位注入（沿用 feature-008 provider 机制），ARK_MODEL 缺失返回 `UPSTREAM_AUTH_MISSING`，不静默回退。
3. 专职 agent 只能被 `showrunner` 经 `task` 调用；renderer 无法指定 agent（对外仅暴露主控对话）。
4. **禁止任何 agent 切换非 ark 文本模型**；媒体模型由 ComfyUI 权重决定，不在 agent model 字段出现。
5. 后期（6）/发布（7）阶段本总纲预留 agent 扩展位（如 `post-operator`），不提前实现，立项时再走 K6。

## 3. MCP 纯工具集（全部零 LLM）

服务壳 [server.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/server.ts) 保留（Streamable HTTP、单 `/mcp`、Bearer、sessionIdGenerator）。重写 [tools.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/tools.ts)：删除全部 8 个业务生成工具、ark.ts/prompts.ts 耦合与 mock 生成，替换为下列纯原语。

| 工具 | 入参 | 出参 | 纯职责（无推理） |
|---|---|---|---|
| `file.read` | `{path}` | `{ok, text?}` / error | 读项目目录内文本文件（路径越界拒绝） |
| `file.list` | `{dir?}` | `{ok, entries[]}` | 列目录（名称/类型/时间） |
| `file.write` | `{path, content}` | `{ok, path, archived?}` | 经单写队列写文件，写前自动版本归档 |
| `canvas.get` | `{}` | `{ok, canvas}` | 读当前项目画布图（节点+边+门） |
| `canvas.update` | `{nodes[]?, edges[]?, mode?}` | `{ok, canvas}` | 幂等 upsert 节点/边/状态；返回更新后整图 |
| `gate.request` | `{gateId, title, question, options[], payload?}` | **阻塞**→`{decision, note?}` | 在画布挂确认门并经主进程向 renderer 推 `gate`；挂起等待用户裁决（见 §6） |
| `asset.register` | `{kind, path, meta?}` | `{ok, assetId}` | 把文件登记为资产（图/视频/音乐/工作流） |
| `asset.list` | `{kind?}` | `{ok, assets[]}` | 列资产索引 |
| `comfyui.instances` | `{}` | `{ok, instances[]}` | 读已配置的本地/局域网实例（地址/状态） |
| `comfyui.queue` | `{instanceId, workflow, inputs}` | `{ok, jobId}` | 向指定实例提交工作流（纯转发，不生成内容） |
| `comfyui.status` | `{instanceId, jobId}` | `{ok, state, outputs?}` | 查询作业状态与产出路径 |

契约：

1. 工具内**严禁**出现任何模型调用 / prompt 拼装 / 内容生成；现 `prompts.ts`、`ark.chat()` 在 tools 层彻底移除。
2. 所有文件工具的路径限定在当前项目目录与资产目录内，`..` 越界 / 绝对路径逃逸 → `INVALID_ARGUMENT`。
3. `file.write` / `canvas.update` 一律走主进程单写队列（沿用 session.ts enqueue），写前归档（版本/ 目录）。
4. 工具结果不再用"业务信封 kind+product"。统一为 **`{ok:true, ...data}` / `{ok:false, error:{code,message}}`**；MCP content 承载其 JSON 文本。`ToolResultEnvelope` 删除。
5. ComfyUI 实例地址来自设置（本地/局域网、多实例），不写死、不强制 127.0.0.1 引擎本体（仅 MCP/控制面保持 loopback）。

## 4. 数据模型（以画布图为单一工作态）

### 4.1 目标模型（新增于共享层，走 K1）

```ts
// shared/types.ts 新增（既有产物结构类型尽量保留复用，见 4.3）

type StepId = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'

interface CanvasNode {
  id: string                         // 稳定节点 id（如 step-1-outline）
  step: StepId
  kind: string                       // 产物类型：brief/outline/profiles/scenes/dialogue/storyboard/asset-image/...
  title: string
  status: 'pending' | 'active' | 'done' | 'invalidated'
  ref?: { path: string; format: 'json' | 'md' }  // 产物落盘位置（节点不内联大产物）
  meta?: Record<string, unknown>
  updatedAt: string
}

interface CanvasEdge {
  id: string
  from: string                       // 源节点 id
  to: string                         // 目标节点 id
  auto: boolean                      // true = 系统按依赖自动连线
}

interface CanvasGate {
  gateId: string                     // 沿用 0-a/0-b/... 语义编号
  status: 'pending' | 'approved' | 'rejected'
  question: string
  options: string[]
  payload?: unknown                  // 待裁决的候选产物引用
}

interface Canvas {
  schemaVersion: 2
  projectId: string
  title: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  gates: CanvasGate[]
  updatedAt: string
}

interface ComfyInstance {
  id: string
  name: string
  baseUrl: string                    // 本地/局域网可配，如 http://192.168.x.x:8188
  enabled: boolean
  addedAt: string
}

interface AssetIndexItem {
  id: string
  kind: 'image' | 'video' | 'music' | 'workflow'
  path: string
  sourceJobId?: string
  meta?: Record<string, unknown>
  createdAt: string
}
```

### 4.2 持久化布局（项目目录内）

```
项目目录 project-<stamp>/
├── canvas.json                 # 单一工作态（Canvas）
├── project.json                # 项目元信息 + ComfyInstance 配置引用
├── 立项/  (brief.json/diagnosis.json/...)
├── 故事/  (故事大纲.json+.md, 人物小传.json+.md)
├── 剧本/  (分场.json+.md, 台词.json+.md)
├── 分镜/  (shotlist.json+.md)
├── 资产/  (图/视频/音乐产物 + asset-index.json)
└── 版本/  (写前归档，沿用既有 archiveExisting 规则)
```

### 4.3 共享层变更范围（K1，一次性、最小化）

- **新增**：StepId / CanvasNode / CanvasEdge / CanvasGate / Canvas / ComfyInstance / AssetIndexItem。
- **保留复用**：FiveElements / VisualStyle / PreflightCheck / TopicDiagnosis / ProjectBrief / StoryOutline / CharacterProfile / Scene(breakdown) / Dialogue* / Shot* 作为节点 `ref` 所指产物的结构（产物 schema 不重写，降低迁移风险）。
- **删除（经 K3 弃用）**：WorkflowState（旧三阶段状态机）、ToolResultEnvelope、旧 FinalizedSnapshot 平铺模型、NodeStatus 十节点枚举（由 CanvasNode/StepId 取代）、MessageKind 中为旧状态机定制的 unlock/revision-draft 等变体（对话消息收敛，见 §5）。
- ChatMessage 保留为对话记录模型，但其 kind 收敛为 `text | gate | gate-result | error | product-ref`（产物以 ref 引用，不内联）。

## 5. IPC 面规划

### 5.1 保留 / 收敛（runtime 基建不动）

`runtime:start|stop|status`、`runtime:session:*`、`runtime:prompt(:async)`、`runtime:event:(un)subscribe`、`runtime:agent:list` 及 `runtime:event` / `runtime:status-changed` 推送全部沿用（feature-008 契约）。`agent:list` 对外仍只返回主控（showrunner）。

### 5.2 新增

| 通道 | 方向 | 载荷 |
|---|---|---|
| `canvas:get` | renderer→main | → `Canvas` |
| `canvas:subscribe` / `canvas:unsubscribe` | renderer→main | 订阅后推送 |
| `canvas:changed` | main→renderer | `Canvas`（每次 canvas.update / 门变更） |
| `gate:changed` | main→renderer | `CanvasGate`（Agent 发起门时推，驱动 GateCard） |
| `gate:decide` | renderer→main | `{gateId, decision, note?}` → 解除 gate.request 阻塞 |
| `asset:list` | renderer→main | `{kind?}` → `AssetIndexItem[]` |
| `settings:comfy:*` | renderer→main | 实例 CRUD（list/upsert/remove/test） |

### 5.3 删除（经 K8 破坏契约，用户预批）

旧业务 IPC 全部由"Agent + 纯工具 + canvas"取代：`project:*` `session:*` `chat:*` `archive:*` `story:*` `script:*` 约 27 个 handle 及 preload 对应键。删除时机：新链路对应垂直切片验收通过后，按包删除（见任务清单），不在总纲一次清空。

## 6. 确认门（gate）阻塞契约

1. Agent 调 `gate.request` → 工具在画布写入 pending 门 → 主进程经 `gate:changed` 推 renderer → **工具 Promise 挂起**（不返回 opencode），opencode 该轮自然停在等待态。
2. 用户在 GateCard 裁决 → `gate:decide` → 主进程更新门状态（canvas 更新并广播）→ 解除对应 `gate.request` 的挂起 Promise，回 `{decision, note?}` → Agent 据裁决继续。
3. 门超时 / 关闭应用时的恢复：pending 门随 canvas 落盘，重启后 Agent 会话恢复时仍能读到 pending 门并重新挂起等待（沿用 feature-015 待定门恢复思路，重做于主进程侧）。
4. 门编号沿用八步确认语义（0-a/0-b/0-c/0-d、1-a/1-b、2-a/2-b/2-c 及媒体阶段新增门），确认点不减少。

## 7. 错误契约

在 feature-008 RuntimeErrorCode 基础上收敛：保留 `INVALID_ARGUMENT / RUNTIME_NOT_READY / RUNTIME_START_FAILED / RUNTIME_HEALTH_FAILED / SESSION_NOT_FOUND / PROMPT_FAILED / PROMPT_ABORTED / UPSTREAM_AUTH_MISSING / INTERNAL`；**移除** `STRUCTURED_OUTPUT_FAILED`（不再以 json_schema 强制业务产物，产物由 Agent 写文件）、`SESSION_CREATE_FAILED`（并入 PROMPT_FAILED/INTERNAL）。新增 `PATH_ESCAPE_DENIED`（文件路径越界）、`GATE_TIMEOUT`（门等待异常）。

规则沿用：handle 边界校验、`Error.name=code`、message 不含凭证、`runtime:status` 永不抛错。

## 8. 安全契约（硬边界，沿用并补强）

1. Renderer 无 opencode/comfy URL、口令、ARK_API_KEY；不直连二者。
2. MCP 控制面仅 loopback + Bearer；**ComfyUI 引擎目标地址允许本地/局域网可配**（这是能力点，非控制面暴露）。
3. 文件工具路径沙箱化（项目 + 资产目录）。
4. 媒体零公网：三类媒体全部经本地/局域网 ComfyUI 权重；出公网仅文本 ark。
5. 单写队列 + 写前归档，保证可回滚；版本/ 目录不被工具覆盖。

## 9. 测试契约

| 层 | 要求 |
|---|---|
| 工具单测 | 每个纯工具：断言无 LLM 依赖、路径沙箱、写前归档、ok/error 结构 |
| 数据模型 | Canvas 节点/边/门 upsert 幂等、自动连线、schemaVersion 兼容 |
| 门集成 | gate.request 挂起 → gate:decide 解除 → Agent 续跑；重启后 pending 门恢复 |
| 架构断言 | 静态扫描 mcp/tools 层不含 ark/prompts/chat 依赖；renderer 不含运行时/引擎 import |
| 切片回归 | 每交付一个垂直切片，该切片 AC 全绿后才删除对应旧 IPC/旧文件 |

真机 ComfyUI / 真机 ark 链路以环境变量显式开启，不进默认必过集（沿用 feature-008）。
