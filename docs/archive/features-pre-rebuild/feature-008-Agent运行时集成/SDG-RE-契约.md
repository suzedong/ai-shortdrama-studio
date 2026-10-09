# SDG-RE 契约 · feature-008 Agent 运行时集成（opencode 基座）

> 状态：**v1.2 已批准（2026-10-04；媒体通道终局按 D-010 更新：三类媒体全部经本地/局域网 ComfyUI 权重推理，媒体零公网）**
> 日期：2026-10-04
> 实现必须严格匹配本契约；字段 / 通道签名变更即 K8，须重新评审。
> 版本与安全决策已锁定：见变更记录 D-006（版本/二进制/modelID）、D-008（端口/口令/mock）、D-010（媒体通道终局：qwen-image/H3/Music3 权重全部经本地 ComfyUI，出公网仅文本 ark）。

---

## 1. 外部依赖边界

| 项 | 契约 |
|---|---|
| opencode 版本 | npm 包 `opencode-ai` **精确锁定 `1.18.34`**（D-006，K9），禁止 `latest` / `^` / `~` 等任何浮动；平台真二进制经其同版本 optionalDependencies（opencode-darwin/windows/linux-*）下发，不自行下载 |
| 启动方式 | 主进程 spawn 可执行文件，参数固定：`serve --hostname 127.0.0.1 --port <port>`；禁用 `--mdns`；不传 `--cors` |
| 端口 | 动态空闲端口，从 `4096` 起顺序探测；仅绑定 loopback |
| 认证 | 启动前生成随机口令注入 `OPENCODE_SERVER_PASSWORD`（用户名默认 `opencode`）；口令仅存主进程内存 |
| 连接方式 | 主进程使用 `@opencode-ai/sdk` 的 **client-only**（`createOpencodeClient`）连接，**禁止** `createOpencode()` 自启动 server |
| SDK 版本 | `@opencode-ai/sdk` **精确锁定 `1.18.34`**（D-006，K9），ESM client-only 使用 |
| serve 工作目录（cwd） | 固定为平台工作区根目录（现 `~/Documents/ai-shortdrama-studio`）；本期不按项目切换 cwd |

opencode HTTP 事实（2026-10-04 核实自官方文档）：健康检查 `GET /global/health` → `{ healthy, version }`；事件流 `GET /event`（首事件 `server.connected`）；会话 `POST /session`、消息 `POST /session/:id/message`（异步 `…/prompt_async`）、中止 `POST /session/:id/abort`；结构化输出经 body `format: { type: 'json_schema', schema, retryCount? }`。**实现时以运行实例 `/doc` 的 OpenAPI 3.1 为最终核对源**，如与本契约矛盾按 L1 修正实现，若属文档缺口按 L2 暂停。

## 2. 文件布局（新增，均在既有顶层目录内）

```
electron/runtime/
├── types.ts          # 主进程侧 Runtime* DTO（本契约 §4）
├── manager.ts        # 进程生命周期：探测端口/spawn/健康检查/关闭
├── client.ts         # opencode client 封装：会话/prompt/abort
├── projection.ts     # opencode SSE 事件 → RuntimeEvent 投影
└── provider.ts       # opencode.json 与 provider/director 配置生成
resources/opencode/agents/director.md   # 主控 Agent profile（随仓库管理，启动时复制到 userData）
src/lib/runtime-types.ts                # renderer 侧 Runtime* DTO 镜像（结构与 types.ts 逐字段一致）
```

约束：

- 不修改 `shared/`（K1）。主 / renderer 两侧 DTO 镜像重复是当前共享层只读约束下的既定做法，不构成共享层修改。
- 生成态配置写入 `app.getPath('userData')/opencode/`（`opencode.json` + `agents/`），**不写入项目数据目录**；每次启动按模板重生成，不做用户态合并。

## 3. IPC 通道

通道命名空间统一为 `runtime:*`，与现有 `agent:*` `session:*` `chat:*` 完全隔离；现有通道签名一律不动。

### 3.1 invoke / handle（renderer → main）

| 通道 | 请求参数 | 成功返回 |
|---|---|---|
| `runtime:start` | 无 | `RuntimeStatus` |
| `runtime:stop` | 无 | `RuntimeStatus` |
| `runtime:status` | 无 | `RuntimeStatus` |
| `runtime:session:create` | `{ title?: string }` | `RuntimeSession` |
| `runtime:session:list` | 无 | `RuntimeSession[]` |
| `runtime:session:abort` | `sessionId: string` | `{ ok: true }` |
| `runtime:session:delete` | `sessionId: string` | `{ ok: true }` |
| `runtime:prompt` | `RuntimePromptRequest` | `RuntimePromptResult`（等待完成） |
| `runtime:prompt:async` | `RuntimePromptRequest` | `{ accepted: true; messageId: string }` |
| `runtime:event:subscribe` | `{ sessionId?: string }` | `{ ok: true }` |
| `runtime:event:unsubscribe` | 无 | `{ ok: true }` |
| `runtime:agent:list` | 无 | `RuntimeAgent[]` |

### 3.2 主动推送（main → renderer，`webContents.send`）

| 通道 | 载荷 |
|---|---|
| `runtime:event` | `RuntimeEvent` |
| `runtime:status-changed` | `RuntimeStatus` |

推送规则：① 仅在 renderer 显式 `runtime:event:subscribe` 后推送，unsubscribe 或订阅方窗口销毁即停；② 事件按 SSE 到达顺序投递，不做跨事件聚合；③ 状态迁移（starting/running/error/stopped）必推一次 `runtime:status-changed`。

### 3.3 preload 暴露

在现有 preload 上**新增** `runtime` 命名空间（不改动既有键）：

```ts
runtime: {
  start(): Promise<RuntimeStatus>
  stop(): Promise<RuntimeStatus>
  status(): Promise<RuntimeStatus>
  createSession(title?: string): Promise<RuntimeSession>
  listSessions(): Promise<RuntimeSession[]>
  abortSession(sessionId: string): Promise<{ ok: true }>
  deleteSession(sessionId: string): Promise<{ ok: true }>
  prompt(req: RuntimePromptRequest): Promise<RuntimePromptResult>
  promptAsync(req: RuntimePromptRequest): Promise<{ accepted: true; messageId: string }>
  subscribe(sessionId?: string): Promise<{ ok: true }>
  unsubscribe(): Promise<{ ok: true }>
  listAgents(): Promise<RuntimeAgent[]>
  onEvent(cb: (e: RuntimeEvent) => void): () => void
  onStatusChange(cb: (s: RuntimeStatus) => void): () => void
}
```

`onEvent` / `onStatusChange` 返回取消订阅函数。

## 4. DTO 定义

```ts
// 所有时间字段为 ISO 8601 字符串

interface RuntimeStatus {
  state: 'stopped' | 'starting' | 'running' | 'error'
  port: number | null          // 允许 renderer 知道端口号用于"显示"，但不返回 baseURL 凭证；端口不构成口令
  version: string | null
  healthy: boolean
  startedAt: string | null
  error: RuntimeErrorBody | null
}

interface RuntimeErrorBody {
  code: RuntimeErrorCode
  message: string
}

interface RuntimeSession {
  id: string
  title: string | null
  createdAt: string
}

interface RuntimePromptRequest {
  sessionId: string
  text: string
  agent?: string                                       // 默认 director
  model?: { providerID: string; modelID: string }      // 不传则用 profile 默认
  format?: { type: 'json_schema'; schema: Record<string, unknown>; retryCount?: number }
  tools?: string[]                                     // 白名单覆盖；不传用 profile 默认
}

interface RuntimePromptResult {
  messageId: string
  text: string
  structured: unknown | null    // format 存在且校验通过时返回
  error: RuntimeErrorBody | null
}

interface RuntimeAgent {
  name: string
  description: string
  model: { providerID: string; modelID: string } | null
  tools: string[]
}
```

### 4.1 RuntimeEvent（封闭联合，renderer 只认这六类）

```ts
type RuntimeEvent =
  | { type: 'runtime.connected'; ts: string; version: string }
  | { type: 'message.delta'; ts: string; sessionId: string; messageId: string; delta: string }
  // ⛝ 2026-10-05 起被 feature-010 决策 D-006 超集取代：新增必填 track: 'text'|'reasoning'，
  //    以 feature-010《SDG-RE-契约.md》§4.2 为准（本字段语义未删，仅加分轨）。
  | { type: 'message.part'; ts: string; sessionId: string; messageId: string;
      part: { kind: 'text' | 'reasoning' | 'tool' | 'structured'; text?: string;
              tool?: string; status?: 'running' | 'completed' | 'error' } }
  | { type: 'tool.call'; ts: string; sessionId: string; messageId: string;
      tool: string; argsPreview: string; status: 'running' | 'completed' | 'error'; resultPreview?: string }
  | { type: 'session.idle'; ts: string; sessionId: string }
  | { type: 'runtime.error'; ts: string; sessionId?: string; error: RuntimeErrorBody }
```

投影规则（`projection.ts`）：

1. 未识别的 opencode 原始事件**不得透传**，折叠为忽略并计数（计数经日志暴露，不进 IPC）。
2. `argsPreview` / `resultPreview` 截断至 500 字符，防止大对象打爆 IPC。
3. 事件中的密钥类字段（key/token/authorization，大小写不敏感）一律以 `"***"` 替换后再投递。

## 5. 错误契约

```ts
type RuntimeErrorCode =
  | 'INVALID_ARGUMENT'        // 边界参数校验失败
  | 'RUNTIME_NOT_READY'       // 未运行时调用会话/prompt 类通道
  | 'RUNTIME_START_FAILED'    // spawn 失败 / 端口占用耗尽
  | 'RUNTIME_HEALTH_FAILED'   // 进程在但健康检查失败
  | 'SESSION_NOT_FOUND'
  | 'SESSION_CREATE_FAILED'
  | 'PROMPT_FAILED'
  | 'PROMPT_ABORTED'
  | 'STRUCTURED_OUTPUT_FAILED'
  | 'UPSTREAM_AUTH_MISSING'   // 如 ARK_API_KEY 缺失且未使用 mock
  | 'INTERNAL'
```

规则：

1. handle 内部捕获后统一 `throw new Error(message)`，并在 `Error.name` 放 code；message 只含可展示信息，禁含口令 / Key。
2. 参数校验只在主进程边界做（IPC 入参），不信任 renderer。
3. 运行时处于 `error/stopped` 时，会话与 prompt 类通道返回 `RUNTIME_NOT_READY`；`runtime:status` 永不抛错。
4. `runtime:prompt` 的业务失败（结构化校验失败等）经 `RuntimePromptResult.error` 正常返回，不用 reject；仅通道级 / 运行时级错误才 reject。

## 6. 生命周期契约

1. 应用 `ready` 后**惰性自启**：首次访问任一 `runtime:*` 业务通道或 `runtime:start` 时启动；不在启动阶段阻塞窗口。
2. 启动序列：探测端口 → 生成口令与配置 → spawn → 轮询 `/global/health`（最多约 10s）→ 置 running 并推 `runtime:status-changed`；超时置 error。
3. 退出清理：`before-quit` 时先 abort 活跃会话、关闭 SSE 连接，再 kill 子进程（SIGTERM，超时 SIGKILL）；确认无残留后放行退出。
4. 子进程异常退出：主进程监听 `exit`，置 `stopped`（异常码≠0 时置 `error` 并带原因），推送状态；不自动无限重启（允许显式 `runtime:start` 再拉起）。
5. 单例：全应用仅一个 serve 子进程；重复 start 幂等返回当前状态。

## 7. provider 与主控 profile 契约

`opencode.json`（生成态）必须满足：

1. provider `ark`：OpenAI 兼容自定义 provider，baseURL 取火山方舟 OpenAI 兼容端点；Key 只从子进程环境变量 `ARK_API_KEY` 读取（主进程从 `.env` 加载后透传，不写进生成的 json）。
2. provider `mock`：仅返回脚本化响应，供无 Key 与测试使用；**生产构建中保留但显式标注测试用途**，profile 默认不选用。
3. 不配置 ark / mock 以外的任何 provider（Design 云端多模型矩阵不沿用）。
4. 本期 profile 仅 `director`（主控），其 frontmatter 固定：
   - `model` 指向 ark 的文本模型（`ark/<modelID>`）；**modelID 不硬编码入库，启动时从 `ARK_MODEL` 环境变量读取并写入生成态 frontmatter**（沿用 electron/ark.ts 既有约定，D-006）；ARK_MODEL 缺失时 director 不可用并返回结构化错误，不静默回退 mock；
   - `tools` 最小集（仅 opencode 内置只读 / 结构化所需工具，本期不含任何媒体 / 引擎 / 删除类工具）；
   - 描述内写明八步闭环职责边界（只做理解 / 简报 / 任务地图，不声称具备媒体生成能力）。
5. profile 不接受 renderer 传入的任意 system / 工具扩张；`RuntimePromptRequest.tools` 只能从 profile 已声明集合中取子集，越界即 `INVALID_ARGUMENT`。

## 8. 安全契约（硬边界）

1. renderer 进程拿不到 baseURL 口令、完整凭证 URL、`ARK_API_KEY`；DevTools / preload 中无任何相关暴露。
2. 仅 127.0.0.1 监听；禁止 0.0.0.0、禁止 mDNS、禁止 CORS 浏览器来源。
3. 主进程是 opencode 的唯一客户端；renderer 与 opencode 之间无任何直连网络路径。
4. 生成配置目录（userData/opencode）权限收敛，不由项目数据导入覆盖。
5. 本契约不涉及媒体工具；后续媒体调用终局（D-010）：**图像 qwen-image、视频 H3、音乐 Music3 三类媒体全部以权重 / 工作流经本地 / 局域网 ComfyUI 执行（纯局域网、媒体生成零公网、无媒体云端 Key）**，由 MCP/主进程引擎工具访问可配置的本地/局域网实例；平台出公网仅余文本 ark。renderer 不得直连 ComfyUI。

## 9. 测试契约

| 层 | 要求 |
|---|---|
| 单元 | manager 端口探测 / 状态迁移、projection 事件映射（含未识别事件忽略、密钥打码、截断）、provider 配置生成（不含 Key 落盘断言） |
| 集成 | 以 `mock` provider 跑通 `create session → prompt:async → 收到 message.delta / session.idle → abort` 全链路（经 IPC） |
| 安全断言 | 单测中断言生成的 opencode.json / RuntimeStatus / RuntimeEvent 中不出现 `ARK_API_KEY` 值与 server 口令 |
| 回归 | `npm run test:run` 全绿；现有 feature-001~007 测试与通道零改动 |

真机 opencode（非 mock）链路允许以「环境变量显式开启 + 具备 ARK_API_KEY」为条件，不进入默认测试与 CI 必过集。
