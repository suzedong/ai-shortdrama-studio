# feature-803 · ComfyUI 统一媒体引擎 — 契约

> **版本**：v1.1（2026-11-27）｜**状态**：实施中；现行生产通道按 D-033 / feature-816 归一
> 本文为本包实现唯一契约。feature-017 的 queue/status 占位语义由本文替换。

## 1. 数据与存储

### 1.1 实例 DTO

```ts
interface ComfyInstanceConfig extends ComfyInstance {
  gpus?: string[]
  vramGB?: number
}
```

- `id`：`c-` + 主进程生成随机后缀；upsert 可指定既有 id。
- `name`：trim 后 1–80 字。
- `baseUrl`：规范化 HTTP(S) URL，无凭据/query/hash，结尾 `/` 移除。
- `enabled`：boolean，缺省 true；`addedAt`：ISO 时间，更新时保留。
- `gpus`：去空白后的非空 GPU 标识数组；`vramGB`：大于 0 的有限数。
- 文件：`{ schemaVersion: 1, instances: ComfyInstanceConfig[], updatedAt: string }`。
- 路径：`{userData}/comfyui/instances.json`。仅该文件为事实源。

### 1.2 作业 DTO 与文件

```ts
type ComfyJobState = 'queued' | 'running' | 'downloading' | 'completed' | 'error'

interface ComfyJobOutput {
  path: string
  kind: 'image'
  assetId: string
}

interface ComfyJob {
  jobId: string
  requestId: string
  instanceId: string
  instanceBaseUrl: string
  workflowId: string
  workflowVersion: string
  inputs: Record<string, unknown>
  promptId: string | null
  state: ComfyJobState
  outputs: ComfyJobOutput[]
  error: { code: string; message: string } | null
  createdAt: string
  updatedAt: string
}
```

- 文件：`{当前项目}/comfy-jobs.json`，形状 `{ schemaVersion: 1, jobs: ComfyJob[] }`。
- requestId 在单项目内唯一；相同 requestId 必须匹配 instanceId/workflowId/inputs 才允许重放。
- 实例启停或删除不影响已有 `instanceBaseUrl` 快照续查；queue 时必须实时要求实例存在且启用。

## 2. IPC 契约

既有 `settings:comfy:list/upsert/remove` 保持， upsert 使用 `Partial<ComfyInstanceConfig>`。

### 2.1 settings:comfy:test（K8 新增）

- 入参：`{ baseUrl: string }`，可来自未保存编辑器。
- 返回：

```ts
interface ComfyTestResult {
  ok: true
  comfyuiVersion: string | null
  deviceCount: number
}
```

- 失败 reject，错误含 `code/message`；不写入实例配置，不要求打开项目。
- preload：`window.api.settings.comfy.test(arg)`。

### 2.2 dev mock

- CRUD 为模块内确定性内存数据；upsert 返回完整 `baseUrl/addedAt`。
- 地址先做同一基础校验；`http://127.0.0.1:65535` 固定 reject `COMFY_UNREACHABLE`，其余合法地址固定成功，不执行 fetch。

## 3. MCP 契约

### 3.1 comfyui.instances

保持无参，返回 `{ ok: true, instances: ComfyInstanceConfig[] }`。

### 3.2 comfyui.queue（收紧替换占位）

```ts
// 入参
{
  instanceId: string       // min 1
  workflowId: string       // min 1
  inputs?: Record<string, unknown> // 仅工作流清单声明键
  requestId: string        // min 1, max 128
}
// 成功
{ ok: true, jobId: string, promptId: string }
```

- 不再接受 `workflow` 对象；Zod 先校验，随后实例、工作流和输入校验。
- 同 requestId 重放返回相同 jobId/promptId；冲突返回 `REQUEST_ID_CONFLICT`。

### 3.3 comfyui.status（实装替换占位）

```ts
// 入参
{ instanceId: string; jobId: string }
// 成功
{
  ok: true
  jobId: string
  promptId: string | null
  state: ComfyJobState
  outputs: ComfyJobOutput[]
  error: { code: string; message: string } | null
}
```

- instanceId 必须与作业一致，否则 `INVALID_ARGUMENT`。
- completed 为本地终态，直接返回持久化结果，不再访问远端。
- 其他工具零行为变化，仍统一 `{ ok }` 或 `{ ok:false,error }` result。

## 4. ComfyUI HTTP 契约

| 方法 | 路径 | 用途 |
| :-- | :-- | :-- |
| GET | `/system_stats` | 连接测试，读取 `system.comfyui_version` 与 `devices` |
| POST | `/prompt` | body `{ prompt: API工作流, client_id: requestId }`，读取 `prompt_id` |
| GET | `/history/{promptId}` | 读取状态、错误和 outputs.images |
| GET | `/queue` | history 尚无记录时区分 queue_running / queue_pending |
| GET | `/view?filename&subfolder&type` | 仅下载 `type=output` 图片 |

- 基础 URL 可带本地反向代理 path；endpoint 拼接保留该 path。
- 默认请求超时 10000ms，构造时可注入；下载单文件最大 25MiB，单作业最多 16 张。
- 支持 PNG/JPEG/GIF/WEBP，content-type 必须为对应 `image/*`，并校验文件签名。
- 远端输出仅接受 `type=output`；本地名净化为安全 basename，冲突时追加序号。

## 5. 工作流清单契约

默认目录：`resources/comfyui/workflows/`；生产入口由该目录 `manifest.json` 显式注册，文件名只能引用同目录内 `.json`。当前唯一生产条目、H3 Image 四项公开输入、固定 graph 与历史兼容规则以 [feature-816 契约](../feature-816-H3图像通道迁移/SDG-RE-契约.md) §1—§4 为单点事实源。

```ts
interface WorkflowManifest {
  schemaVersion: 1
  workflows: Array<{
    id: string
    kind: 'image' // 当前 loader 仅启用图像；视频/音乐须另行登记契约
    model: 'MiniMax-H3'
    version: string
    file: string
    inputs: Record<string, {
      node: string
      field: string
      type: 'string' | 'integer' | 'number' | 'boolean'
      required?: boolean
      min?: number
      max?: number
      minLength?: number
      maxLength?: number
      values?: Record<string, string> // 稳定公开值 → 受控节点值
    }>
  }>
}
```

- API Format 顶层必须是 `{ [nodeId]: { class_type: string, inputs: Record<string, unknown> } }`；含 UI `nodes` 数组或缺 inputs 时拒绝。
- 深拷贝后仅写 `workflow[node].inputs[field]`；inputs 中未知键返回 `INVALID_ARGUMENT`。声明 `values` 时只接受表内稳定键，并写入其映射值。
- 清单缺 id、重复 id、非 `MiniMax-H3`、路径逃逸、目标节点缺失均返回 `WORKFLOW_INVALID`；无匹配 id 或旧工作流新投返回 `WORKFLOW_NOT_AVAILABLE`。
- 803 只定义通用 loader 与作业边界，不复制 816 的生产 ID、字段默认值、枚举表或节点 ID。两者不一致时先停下核对，不得自行选择一份实现。
- 历史作业只按既有实例与 promptId 快照续查、下载和登记；不得重新加载已退出生产的工作流或静默改投。

## 6. 错误码

- 参数/配置：`INVALID_ARGUMENT`、`COMFY_SETTINGS_CORRUPT`、`INSTANCE_DISABLED`、`REQUEST_ID_CONFLICT`。
- 工作流：`WORKFLOW_NOT_AVAILABLE`、`WORKFLOW_INVALID`。
- 网络/协议：`COMFY_TIMEOUT`、`COMFY_UNREACHABLE`、`COMFY_HTTP_ERROR`、`COMFY_INVALID_RESPONSE`、`COMFY_JOB_NOT_FOUND`。
- 产物：`COMFY_OUTPUT_INVALID`、`COMFY_OUTPUT_TOO_LARGE`、`COMFY_OUTPUT_TOO_MANY`、`COMFY_DOWNLOAD_FAILED`。
- 引擎未注入：`INTERNAL`。

## 7. 文件写权与安全

- 设置写权：主进程 settings 模块；作业写权：主进程引擎；资产索引写权：复用 `registerAsset`。
- renderer 仅可调用设置 IPC；Agent 仅可调用受控 MCP 工具，均不得提供任意 URL fetch 或任意 API 工作流。
- 所有配置与作业写入同目录临时文件并原子替换；旧配置/作业按现有归档机制保留。
- 产物目标必须经项目目录 `resolveInside` 校验；禁止绝对路径、`..` 段和路径逃逸。

## 8. 变更履历

- **v1.1（2026-11-27）**：按 D-033 / feature-816 将生产清单模型从历史值改为 `MiniMax-H3`，补充现行受控映射 `values?` 的可选结构，生产条目和输入改为引用 816，历史作业仅续查。既有 IPC／preload／MCP 路径、函数签名和通用 Job 结构不变；破坏性通道迁移已由 D-033 / feature-816 批准，本次不新增 K1 / K7 / K8。自审 + 无第二人复核。
- **v1.0（2026-11-14）**：建立统一 ComfyUI 设置、作业、工作流与错误边界；历史模型内容仅作追溯。
