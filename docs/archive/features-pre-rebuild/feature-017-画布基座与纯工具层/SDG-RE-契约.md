# SDG-RE 契约 · feature-017 画布基座与纯工具层

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 上游（更高优先级）：[feature-016 SDG-RE-契约](../feature-016-架构重建总纲/SDG-RE-契约.md) §1/§3/§4/§5/§6/§7。
> 本文件把总纲在"地基层"细化为可直接实现的模块布局、函数签名、时序与测试要求。字段 / 签名与本契约不符即 K8。

---

## 1. 模块布局（新增 / 改动）

```
electron/
├── fs/
│   ├── write-queue.ts   # 【新】单写队列单例 enqueue（自 session.ts 抽出，行为不变）
│   ├── archive.ts       # 【新】archiveExisting + archiveStamp（自 session.ts 抽出，行为不变）
│   └── sandbox.ts       # 【新】路径沙箱：resolveInside / 越界判定
├── project/
│   └── current.ts       # 【新】getActiveProjectDir()：读 session-state，供新模块定位当前项目
├── canvas/
│   ├── store.ts         # 【新】CanvasStore：内存投影 + canvas.json 落盘 + upsert + 订阅广播
│   └── edges.ts         # 【新】纯函数：自动边推导 / 边去重
├── gate/
│   └── bridge.ts        # 【新】GateBridge：pending 门注册表，request 挂起 / decide 解除 / close 清算
├── asset/
│   └── index.ts         # 【新】AssetIndex：资产/asset-index.json 读 / register
├── comfy/
│   ├── settings.ts      # 【新】ComfyInstance CRUD（持久化于项目 project.json）
│   └── client.ts        # 【新】ComfyClient 接口 + 占位 holder（023 注入真实实现）
├── mcp/
│   └── tools.ts         # 【重写】11 个零 LLM 纯工具（server.ts 壳不动）
├── session.ts           # 【改】改为从 fs/ 引入 enqueue/archive，删除其内部私有实现；对外导出不变
├── main.ts              # 【改】注册 canvas/gate/asset/settings 新 IPC（旧 handle 一律保留）
└── preload.ts           # 【改】暴露 canvas/gate/asset/settings 命名空间
shared/types.ts          # 【改·K1】新增 7 类型（旧类型处置见 §6）
src/global.d.ts          # 【改】window.api 类型补 4 命名空间
```

纪律：

1. 新模块均为**主进程内部模块**；Renderer 与 Agent 均不可见，只能分别经 IPC / MCP tools 接触。
2. `mcp/tools.ts` **只允许** import：`zod`、`@modelcontextprotocol/sdk`、`../../shared/types.js`（仅 type）以及上述 `fs/project/canvas/gate/asset/comfy` 主进程模块；**禁止** import `ark.js`、`prompts.js`、`style-catalog.js`、`session.js`。
3. session.ts 的重构是**纯抽取**：`enqueue` 改为 fs/write-queue 单例（即新旧写入共用同一队列，满足总纲"单写队列"），`archiveExisting` 改为从 fs/archive re-export；所有既有函数签名与行为不变。

## 2. 当前项目定位

```ts
// electron/project/current.ts
/** 当前活跃项目目录绝对路径；无项目时抛 INVALID_ARGUMENT（name=code） */
export function getActiveProjectDir(): string
```

- 实现：复用 [readSessionState](../../)（session.ts 已导出）读 `userData/session-state.json` 的 `currentDir`；为空 / 目录不存在 → 抛 code=`INVALID_ARGUMENT`、message「当前没有打开的项目」。
- CanvasStore / AssetIndex / Comfy settings 一律经本函数取根，不自行维护全局目录。

## 3. 路径沙箱

```ts
// electron/fs/sandbox.ts
/**
 * 把相对路径解析到 root 内绝对路径。
 * 拒绝：绝对路径入参、解析后逃逸 root（含 '..'）、路径含空字节。
 * 失败：throw Object.assign(new Error(msg), { code: 'PATH_ESCAPE_DENIED' })
 */
export function resolveInside(root: string, rel: string): string
```

规则：

1. 入参必须为 string 且 trim 非空，否则先按 `INVALID_ARGUMENT` 拒绝。
2. `path.resolve(root, rel)` 后必须仍以 `root + path.sep` 为前缀（或恰等于 root）；否则 `PATH_ESCAPE_DENIED`。
3. 不做 Unicode 归一化；符号链接逃逸本包不处理（一期项目目录内不引入外链）。
4. 文件工具的 root 统一为 `getActiveProjectDir()`；资产目录是其子目录 `资产/`，因此单一 root 即覆盖总纲 §3 契约 2 的"项目 + 资产目录"。
5. 归档目录 `版本/` 不可被 `file.write` 特殊豁免——允许写但写前归档同样生效（保持原语一致）。

## 4. MCP 纯工具（11 个）

### 4.1 统一结果

```ts
type ToolOk<T>      = { ok: true } & T
type ToolErr        = { ok: false; error: { code: string; message: string } }
type ToolResult<T>  = ToolOk<T> | ToolErr
```

- MCP `content` 只承载 `JSON.stringify(result)`；`isError = result.ok === false`。
- 工具内部 catch 所有异常：已知 code（`PATH_ESCAPE_DENIED` / `INVALID_ARGUMENT` / `GATE_TIMEOUT` 等）原样透传，未知异常归一为 `INTERNAL`；message 不含路径之外的敏感信息（不含 token / key）。
- **删除** `ToolResultEnvelope` 与 `BusinessToolName`（types.ts 中其定义随之移除，见 §6）。

### 4.2 工具签名（入参 zod 校验）

| 工具 | 入参 schema | 成功出参 |
|---|---|---|
| `file.read` | `{ path: string }` | `{ ok:true, text:string }` |
| `file.list` | `{ dir?: string }`（缺省=项目根） | `{ ok:true, entries:{ name:string; type:'file'\|'dir'; mtime:string }[] }` |
| `file.write` | `{ path:string; content:string }` | `{ ok:true, path:string; archived:string[] }` |
| `canvas.get` | `{}` | `{ ok:true, canvas: Canvas }` |
| `canvas.update` | 见 §5.3 | `{ ok:true, canvas: Canvas }` |
| `gate.request` | 见 §7.1 | 见 §7.1（阻塞） |
| `asset.register` | `{ kind:'image'\|'video'\|'music'\|'workflow'; path:string; meta?:Record<string,unknown> }` | `{ ok:true, assetId:string }` |
| `asset.list` | `{ kind?: 'image'\|'video'\|'music'\|'workflow' }` | `{ ok:true, assets: AssetIndexItem[] }` |
| `comfyui.instances` | `{}` | `{ ok:true, instances: ComfyInstance[] }` |
| `comfyui.queue` | `{ instanceId:string; workflow: Record<string,unknown>; inputs?: Record<string,unknown> }` | `{ ok:true, jobId:string }` |
| `comfyui.status` | `{ instanceId:string; jobId:string }` | `{ ok:true, state:string; outputs?: { path:string; kind:string }[] }` |

行为细则：

1. **file.read**：`resolveInside` 后以 utf-8 读取；目标是目录 / 不存在 → `INVALID_ARGUMENT`。
2. **file.list**：列目录一层（不递归）；忽略返回中的 `版本` 目录与否由实现自定，但 `type` 必须正确；按 name 排序。
3. **file.write**：经 `enqueue` 串行；写前 `archiveExisting(abs, new Date())`；自动 `mkdir -p path.dirname`；返回归档路径数组。
4. **asset.register**：`path` 经沙箱解析但**不要求文件当前存在**（媒体任务可先登记后产出）；`assetId` 生成规则 `a-<kind>-<sha1(path)前8位>`，同 path+kind 重复登记为幂等 upsert（返回同一 id）。
5. **comfyui.\*** 三个工具本包为**转发占位**，见 §8。

### 4.3 注册形态

沿用现有 `server.tool(name, description, zodShape, handler)`；`registerBusinessTools` 更名为 **`registerPureTools(server: McpServer): void`**，[server.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/server.ts) 的调用点同步改名。server.ts 其余（鉴权 / 端口探测 / sessionId / 单 /mcp）零改动。

## 5. CanvasStore

### 5.1 形态

```ts
// electron/canvas/store.ts
export interface CanvasChangeListener { (canvas: Canvas): void }

export class CanvasStore {
  /** 懒加载：首次访问读 <root>/canvas.json；缺失则初始化空图并落盘 */
  get(): Promise<Canvas>
  /** 幂等 upsert，见 5.3 */
  update(patch: CanvasUpdatePatch): Promise<Canvas>
  /** 订阅变更（每次成功 update / 门状态变更后回调）；返回退订函数 */
  subscribe(fn: CanvasChangeListener): () => void
  /** 丢弃内存投影（项目切换时调用） */
  reset(): void
}
export const canvasStore: CanvasStore
```

- 单例；root 每次经 `getActiveProjectDir()` 现取（支持项目切换）；`reset()` 在 openProject 后由 main 调用。
- 落盘文件 `<root>/canvas.json`；所有写入经共享 `enqueue`；写前 `archiveExisting`。
- 空图初始化：

```ts
{ schemaVersion: 2, projectId: path.basename(root), title: '新项目',
  nodes: [], edges: [], gates: [], updatedAt: new Date().toISOString() }
```

- 每次成功写入刷新 `updatedAt`；广播在落盘成功之后、用磁盘上的最终图，保证订阅者看到的顺序 = 写入完成顺序。

### 5.2 节点 / 边 upsert 语义

1. 节点按 `id` upsert：存在则替换（入参未提供的字段不保留，以入参整对象为准），不存在则追加。
2. `updatedAt` 由 store 统一覆写为当前 ISO（忽略入参值）。
3. 边按 `(from,to)` 去重；upsert 节点产生的自动边以 `auto:true` 标记，重复不新增。
4. `canvas.update` 不提供节点删除语义（一期节点只追加 / 失效，删除由 `status:'invalidated'` 表达）。

### 5.3 update 入参

```ts
interface CanvasUpsertNode extends CanvasNode {
  /** 仅用于本次更新：声明该节点到目标节点的自动边；不写进节点本体 */
  linksTo?: string[]
}
interface CanvasUpdatePatch {
  nodes?: CanvasUpsertNode[]
  /** 可选：直接 upsert 边（手动 / 自动均可），同样按 from/to 去重 */
  edges?: { from: string; to: string; auto?: boolean }[]
  /**
   * 操作模式，默认 'merge'：
   *  merge = 仅 upsert 入参节点/边；
   *  门状态不允许经 canvas.update 修改（门只经 gate.* 与 gate:decide 变更）。
   */
  mode?: 'merge'
}
```

自动边推导为**纯函数**，独立可测：

```ts
// electron/canvas/edges.ts
export function deriveAutoEdges(
  existing: CanvasEdge[],
  nodeUpserts: CanvasUpsertNode[],
): CanvasEdge[]   // 返回 existing + 新增自动边（去重、补 id）
```

边 `id` 生成：`e-<from>--<to>`，确定性，保证重复调用幂等。

## 6. shared/types.ts 的 K1 处置时序

总纲 §4.3 含"新增 + 删除"两类。本包按**先增后弃、不破坏当前编译**的时序落地：

1. **本包新增**（追加到 types.ts，带 JSDoc）：`StepId`、`CanvasNode`、`CanvasEdge`、`CanvasGate`、`Canvas`、`ComfyInstance`、`AssetIndexItem`。
2. **本包删除**（仅因其唯一定义 / 使用点在被重写文件中）：`ToolResultEnvelope` 与 `BusinessToolName` 定义在 mcp/tools.ts 而非 shared，随重写直接删除，不触发 shared K1。
3. **本包保留不动**：`Stage`、`NodeStatus`、`MessageKind` 旧变体、`WorkflowState`、`FinalizedSnapshot` 相关类型、`GateCard/GateId` 等——旧 App / 旧 IPC 仍引用，删除会破坏并存期编译。它们的删除随 feature-022 旧壳下线进行（总纲 §C 已排）。
4. 因此本包对 shared 的实际 K1 变更 = **仅新增 7 类型**；不删、不改任何既有导出（`ChatMessage` 本包也不改，kind 收敛在 022）。

新增类型逐字采用总纲契约 §4.1 定义（不在此复制，避免双源漂移）。

## 7. GateBridge（单次运行内阻塞）

```ts
// electron/gate/bridge.ts
export interface GateDecision { decision: 'approved' | 'rejected'; note?: string }
export class GateBridge {
  /** 画布 upsert pending 门 + 广播 gate:changed + 返回等待裁决的 Promise */
  request(input: { gateId: string; title?: string; question: string;
                   options: string[]; payload?: unknown }): Promise<GateDecision>
  /** 门裁决：更新门状态→ canvas:changed；resolve 等待中的 request */
  decide(gateId: string, decision: GateDecision): void
  /** 清算：把所有 pending 门 reject 为 GATE_TIMEOUT（应用关闭 / store reset 时） */
  settleAll(): void
}
export const gateBridge: GateBridge
```

契约：

1. 同一 `gateId` 已有 pending request 时再次 request → 以 `INVALID_ARGUMENT` 失败（不产生第二个 Promise）。
2. request 时序：`canvasStore` 写入 `gates` 中 `{gateId,status:'pending',question,options,payload}`（门按 gateId upsert）→ 广播事件 → Promise 挂起。
3. 推 renderer 的 `gate:changed` 载荷：`{ gate: CanvasGate, title?: string }`（title 不落 Canvas，仅 UI 用）。
4. decide：门不存在 / 非 pending → `INVALID_ARGUMENT`；裁决值 `'approved'|'rejected'`。
5. decide 后：门状态写回 canvas（触发 `canvas:changed`）并 resolve 对应 Promise `{decision,note}`。
6. `settleAll()` 在 main 的 `before-quit`（运行时停止之前）与 `canvasStore.reset()` 时调用，确保无悬挂 Promise；被 reject 的 request 在 MCP 工具层归一为 `GATE_TIMEOUT` 错误结果。
7. **跨重启恢复不在本包**：不持久化等待回调；pending 门已随 canvas 落盘，恢复机制由 018 实现。

## 8. ComfyUI 占位转发（本包） / 023 注入

```ts
// electron/comfy/client.ts
export interface ComfyClient {
  queue(req: { instanceId: string; workflow: Record<string, unknown>;
               inputs?: Record<string, unknown> }): Promise<{ jobId: string }>
  status(req: { instanceId: string; jobId: string }):
    Promise<{ state: string; outputs?: { path: string; kind: string }[] }>
}
export function setComfyClient(c: ComfyClient | null): void
export function getComfyClient(): ComfyClient | null
```

- 本包 holder 初始为 `null`；`comfyui.queue/status` 工具取 client，为 `null` 时返回 `{ok:false,error:{code:'INTERNAL',message:'ComfyUI 引擎尚未接入（023）'}}`。
- `comfyui.instances` 读 `comfy/settings.ts`，不依赖 client，本包即可返回真实配置。
- 工具不校验 instanceId 是否存在之外的网络可达性；instanceId 未配置 → `INVALID_ARGUMENT`。
- 实例配置持久化：`<root>/project.json`，结构 `{ projectId:string; title:string; comfyInstances: ComfyInstance[]; updatedAt:string }`；文件缺失视为空列表；upsert（按 id）/ remove 经共享 enqueue 写盘。
- 023 负责：真实 `ComfyClient` 实现（HTTP 提交 / 轮询 / 探活）、`settings:comfy:test` 通道，不改本契约工具签名。

## 9. IPC 与 preload

### 9.1 新增 invoke handle（参数边界校验沿用 main.ts 既有 isRecord / makeRuntimeError 风格）

| channel | 入参 | 返回 |
|---|---|---|
| `canvas:get` | — | `Canvas` |
| `canvas:subscribe` | — | `{ ok:true }` |
| `canvas:unsubscribe` | — | `{ ok:true }` |
| `gate:decide` | `{ gateId:string; decision:'approved'\|'rejected'; note?:string }` | `{ ok:true }` |
| `asset:list` | `{ kind?: AssetKind }`（可缺省） | `AssetIndexItem[]` |
| `settings:comfy:list` | — | `ComfyInstance[]` |
| `settings:comfy:upsert` | `ComfyInstance`（id 缺省由主进程生成） | `ComfyInstance` |
| `settings:comfy:remove` | `{ id:string }` | `{ ok:true }` |

推送（main→renderer，只推给已订阅窗口）：

- `canvas:changed`：`Canvas`。
- `gate:changed`：`{ gate: CanvasGate; title?: string }`。

### 9.2 订阅者管理

- main 维护 `Set<WebContents>`：`canvas:subscribe` 加入并立即触发一次 `canvas:get` 等效推送（新订阅者先拿到当前图）；窗口销毁自动清理。
- `canvasStore.subscribe` 在 main 启动时注册唯一桥接 listener，把图转发给集合内所有 `webContents.send('canvas:changed', canvas)`。
- `gate:changed` 由 GateBridge 经同一桥接 listener 机制推送（GateBridge 持有一个 `onGate` 回调，main 注册后转发 webContents）。

### 9.3 preload 暴露（追加，不动既有键）

```ts
canvas: {
  get(): Promise<Canvas>
  subscribe(): Promise<{ ok: true }>
  unsubscribe(): Promise<{ ok: true }>
  onChange(cb: (c: Canvas) => void): () => void
}
gate: {
  decide(req: { gateId: string; decision: 'approved'|'rejected'; note?: string }):
    Promise<{ ok: true }>
  onChanged(cb: (e: { gate: CanvasGate; title?: string }) => void): () => void
}
asset: {
  list(kind?: AssetKind): Promise<AssetIndexItem[]>
}
settings: {
  comfy: {
    list(): Promise<ComfyInstance[]>
    upsert(instance: ComfyInstance): Promise<ComfyInstance>
    remove(id: string): Promise<{ ok: true }>
  }
}
```

[src/global.d.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/global.d.ts) 同步补类型（从 shared/types 引入新类型）。

### 9.4 不删除

旧业务 handle（project/session/chat/archive/story/script/idea/diagnosis/workflow 等）与 preload 旧键本包**全部保留**；runtime 12 handle 零改动。

## 10. 错误契约

1. 本包新增错误码 `PATH_ESCAPE_DENIED`、`GATE_TIMEOUT`：加入 [electron/runtime/types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/runtime/types.ts) 的 `RuntimeErrorCode` 联合（仅追加）。
2. 总纲 §7 所列 `STRUCTURED_OUTPUT_FAILED / SESSION_CREATE_FAILED` 的移除本包**不做**（旧链路仍引用），随 022 删除。
3. 沿用：`Object.assign(new Error(msg), { code })`；`runtime:status` 等既有规则不变；错误 message 不含凭证。

## 11. 测试契约（vitest，测试文件置于 src/test/ 与就近 *.test.ts）

| # | 测试文件（建议） | 断言要点 |
|---|---|---|
| T1 | `src/test/fs-sandbox.test.ts` | `..` 越界 / 绝对路径 / 空字节 → PATH_ESCAPE_DENIED；正常相对路径解析正确 |
| T2 | `src/test/fs-archive.test.ts` | 首次写无归档；再次写旧文件入 `版本/`；同秒冲突序号；归档失败阻断写 |
| T3 | `src/test/canvas-store.test.ts` | 空图初始化含 schemaVersion:2；节点按 id upsert 幂等；updatedAt 被覆写；写盘顺序与广播顺序一致 |
| T4 | `src/test/canvas-edges.test.ts` | linksTo 生成 auto 边；(from,to) 去重；边 id 确定性；重复调用结果不变 |
| T5 | `src/test/gate-bridge.test.ts` | request 后 Promise 挂起；decide 解除并回传 decision/note；同 gateId 重复 request 拒绝；settleAll 全 reject 为 GATE_TIMEOUT |
| T6 | `src/test/asset-index.test.ts` | register 幂等（同 path+kind 同 id）；list 按 kind 过滤；path 越界拒绝 |
| T7 | `src/test/comfy-settings.test.ts` | 实例 upsert/remove 落 project.json；client=null 时 queue/status 返回 INTERNAL；未知 instanceId → INVALID_ARGUMENT |
| T8 | `src/test/mcp-pure-tools.test.ts` | **静态断言**：读取 electron/mcp/tools.ts 源码，不含 `ark`/`prompts`/`chat(` 字样；11 工具结果均为 {ok} 结构 |

现有全部测试与 `npm run typecheck` 必须保持全绿（并存期无回归）。真机 Comfy / ark 不进默认集（沿用总纲 §9）。

## 12. 验收（契约层 DoD）

1. §1 模块全部到位；tools.ts 通过 T8 静态断言。
2. 11 工具行为与 §4 表一致；路径沙箱、{ok} 结构无例外。
3. CanvasStore / GateBridge / AssetIndex / Comfy settings 满足 §5/§7/§4/§8 签名与时序。
4. 8 个新 IPC + 2 推送经 preload 可用，旧 handle / 旧 UI 无回归。
5. shared 仅新增 7 类型；无其他既有导出被改。
6. T1–T8 全绿、`npm run typecheck` 全绿、`npm run test:run` 全绿。
