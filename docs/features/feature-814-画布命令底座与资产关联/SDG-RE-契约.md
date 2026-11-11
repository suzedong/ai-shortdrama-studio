# feature-814 画布命令底座与资产关联 · 接口与数据契约

> **K1**：§1 修改 [shared/types.ts](../../../shared/types.ts)。**K8**：§3 新增 1 个 IPC 并扩展既有 MCP DTO，同步 preload/global.d.ts/dev-mock；MCP 工具数不变。**K9**：零新增依赖，不触发。

## 1. K1：共享类型

```ts
export interface CanvasCommandReceipt {
  commandId: string
  type: string
  requestHash: string
  revision: number
  appliedAt: string
}

export interface Canvas {
  schemaVersion: 3
  projectId: string
  title: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  gates: CanvasGate[]
  revision: number
  receipts: CanvasCommandReceipt[]
  updatedAt: string
}

export interface CanvasNode {
  // 既有字段不变
  assetIds?: string[]
}

export interface AssetSourceSession {
  sessionId: string
  messageId: string
  callId: string
}

export interface AssetIndexItem {
  // 既有字段不变
  sourceSession?: AssetSourceSession
}

export type CanvasCommandType = 'assets.bind' | 'assets.unbind'

export interface CanvasCommandRequest {
  commandId: string
  expectedRevision: number
  type: CanvasCommandType
  nodeId: string
  assetIds: string[]
}

export interface CanvasCommandResult {
  canvas: Canvas
  receipt: CanvasCommandReceipt
  replayed: boolean
}
```

- `assetIds` 缺省表示未建立关联；存在时不得含重复项。canvas.update 未显式提供时继承旧值，显式提供时按数组替换并去重。
- 旧 v2 档读入时补 `schemaVersion:3`、`revision:0`、`receipts:[]`；节点/边/门和既有字段原样保留。内存迁移本身不写盘，首次成功命令统一落 v3。

## 2. 命令、回执与错误语义

### 2.1 请求摘要

- `requestHash = sha256(stableStringify({type, payload}))`，stableStringify 递归排序对象键，数组默认保序。
- assets.bind/assets.unbind 的 payload 为 `{nodeId, assetIds}`，assetIds 先排序去重，符合集合语义。
- canvas.update 的 payload 为实际 nodes/edges/mode 输入；commandId、expectedRevision 不参与摘要。
- 内部既有写路径生成唯一 commandId，type 使用实际操作名，摘要覆盖该操作实际变更输入。

### 2.2 判定顺序

1. 读取并迁移当前画布。
2. 在 receipts 中查 commandId：摘要相同则返回 `{canvas:当前画布, receipt:原回执, replayed:true}`，不检查 expectedRevision、零写盘零广播；摘要不同抛 `CANVAS_COMMAND_CONFLICT`。
3. 对要求 expectedRevision 的命令，不匹配则抛 `CANVAS_REVISION_CONFLICT`，错误消息包含 expected/current。
4. 校验业务输入并执行一次变更；成功 revision+1，receipt.revision 等于新 revision，追加到末尾并只保留最近 100 条。
5. 原子写成功后返回 `{canvas, receipt, replayed:false}`，由既有 listener 统一广播。

- 新系统 IPC 的 commandId 必须非空，expectedRevision 必须为不小于 0 的整数，nodeId 非空，assetIds 至少 1 项且各项非空。
- 相同集合内容的新 commandId 即使未改变关联，也视为一条成功的新命令，revision 正常 +1。
- 失败码：`CANVAS_COMMAND_CONFLICT`、`CANVAS_REVISION_CONFLICT`、`CANVAS_NODE_NOT_FOUND`、`ASSET_NOT_FOUND`、`CANVAS_CORRUPT`、`INVALID_ARGUMENT`。主进程 Error 带 `code`；MCP 沿用 `{ok:false,error:{code,message}}` + `isError:true`。

## 3. K8：MCP 与系统 IPC

### 3.1 既有 `canvas.update`（工具总数不变）

新增可选入参：

```ts
{
  commandId?: string
  expectedRevision?: number
  nodes?: CanvasUpsertNode[] // 允许可选 assetIds；dirty 仍不可由该工具写入
  edges?: {from:string;to:string;auto?:boolean}[]
  mode?: 'merge'
}
```

- commandId 缺省时由主进程生成；expectedRevision 缺省时沿用旧的非条件写行为。
- 成功结果：`{ok:true, canvas, commandId, revision, replayed}`；保留原 `canvas` 字段，调用方无需另发 `canvas:get`。
- 失败沿用 MCP 错误信封；重放返回当前画布对应的命令结果但不新增回执。

### 3.2 既有 `asset.register`（工具总数不变）

- 入参新增 `sourceJobId?: string`；不接受 sourceSession。
- 成功仍为 `{ok:true, assetId}`。
- 同 path+kind upsert 时，仅显式出现的 sourceJobId/meta 才覆盖；省略字段保留。新增条目可带 sourceJobId，sourceSession 只能由 §5 的系统链路写入。

### 3.3 新 `canvas:command` IPC（唯一新增 IPC）

```ts
window.api.canvas.command(request: CanvasCommandRequest): Promise<CanvasCommandResult>
```

- preload 仅转发 `canvas:command`，global.d.ts 与 dev-mock 使用同一 DTO。
- 主进程无激活项目沿用现有项目错误；renderer 不自行广播 canvas:changed。
- dev-mock 必须实现同样的 revision、回执重放、冲突、绑定/解绑和订阅语义。

## 4. 原子文件契约

1. 完整 JSON 在内存序列化；临时文件与 canvas.json 同目录，使用独占创建，写完后 fsync、关闭。
2. 旧正档存在时，按 [archive.ts](../../../electron/fs/archive.ts) 既有版本目录和命名规则**复制**归档，不移走正档。
3. `rename(temp, canvas.json)` 是唯一的正档替换点；此前任何失败均不得改变旧正档。
4. rename 成功后立即推进 cache 并通知 listeners；失败则清理临时文件，cache/广播保持原状。
5. 初始化同样走临时文件原子写；只有读取错误码为 ENOENT 才能初始化。JSON 解析失败或不受支持 schemaVersion 抛 `CANVAS_CORRUPT`。
6. `canvas:get` 仅把“无激活项目”映射为空态；CANVAS_CORRUPT 必须继续上抛。

## 5. 可信资产来源契约

- 主进程在 runtime event 按窗口/session 过滤前观察 `tool.call` 完成事件，且只处理物理工具名 `tool === 'shortdrama_asset_register'`；MCP 逻辑名 `asset.register` 不作为可信来源判定依据。
- resultPreview 可为直接 JSON 字符串，或包含 `content:[{type:'text',text:string}]` 的 MCP 包装；递归解析 text 后只接受 `{ok:true, assetId:非空字符串}`。
- 调用内部 `updateAssetSource(assetId, sourceJobId?, sourceSession)`：只更新已存在资产，sourceJobId 仅从该工具的真实入参提取，sourceSession 完整使用事件的 sessionId/messageId/callId。
- 不创建缺失资产，不接受 args 中的会话字段，不读取 activeSessionId。
- 补写进入既有资产写队列；坏索引抛错并记录日志。所有异常被该观察器捕获，不影响原事件广播、资产登记或 SSE。

## 6. UI 契约

- CanvasBoard 新增 `onSelectNode(nodeId:string|null)`；初次及 nodes 变化时优先保留仍存在的 selectedId，否则回退 active 节点，再否则 null。
- 节点卡以 `node.assetIds?.length ?? 0` 显示关联数。
- AssetsPanel 新增当前节点、提交命令和忙碌状态所需 props；具体回调由 StudioApp 统一持有，避免面板自行构造 revision。
- 点击绑定/解绑时生成新 commandId，并以当前 canvas.revision 为 expectedRevision；成功后以返回 canvas 更新界面。`CANVAS_REVISION_CONFLICT` 时重新 get，不自动重放业务变更。
