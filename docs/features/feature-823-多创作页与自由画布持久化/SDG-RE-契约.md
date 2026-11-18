# SDG-RE-契约 · 多创作页与自由画布持久化

> 日期：2026-11-17 ｜ 状态：用户已审定，允许实施 ｜ 上游：[需求规格](./SDG-RE-需求规格.md)、[已批准实施计划](../../../.trae/documents/切片E-多创作页与自由画布持久化实施计划.md)
> 写权前提：用户已批准 K1/K8，并于任务包校验后明确审定本契约、授权 T1—T7 实施与验证。K9 零触发。

## 1. 持久化契约

文件仍为当前项目根目录的 `canvas.json`，不新增第二份项目状态文件。

### 1.1 共享类型

```ts
export interface CanvasPosition {
  x: number
  y: number
}

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasDocument {
  id: string
  title: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: CanvasViewport | null
}

export interface CanvasPage {
  id: string
  title: string
  activeCanvasId: string
  canvases: CanvasDocument[]
}

export interface Canvas {
  schemaVersion: 4
  projectId: string
  title: string
  activePageId: string
  activeView: 'canvas' | 'stage0'
  pages: CanvasPage[]
  gates: CanvasGate[]
  revision: number
  receipts: CanvasCommandReceipt[]
  updatedAt: string
}
```

`CanvasNode` 仅增加：

```ts
position?: CanvasPosition
```

既有 CanvasEdge、CanvasGate、CanvasCommandReceipt 及其余共享业务类型不变。根级不再声明 nodes/edges；gates 保留项目级，不新增根级活动画布数据副本。

### 1.2 不变量

- pages 至少一项且 id 唯一；每页 canvases 至少一项且页内 id 唯一。
- activePageId 必须存在；activeCanvasId 必须属于所属页；nodes/edges 仅属于具体画布。
- position.x/y 必须 `Number.isFinite`，允许负值；省略表示确定性布局。
- viewport 为 null 或合法对象；x/y 必须有限，zoom 必须有限且位于 0.25–1.6。
- revision 为不小于 0 的整数；receipts 为数组，成功新命令后仅保留最近 100 条。
- 所有字符串标题 trim 后长度为 1–80；默认标题为 `创作页 N` / `画布 N`，N 取当前范围最小未占用正整数。
- 新实体 id 由主进程以 `page-` / `canvas-` 前缀加随机 UUID 生成，renderer 不指定正式实体 id。

### 1.3 初始化与迁移

新项目：一页 `创作页 1`、一画布 `画布 1`、nodes/edges 为空、viewport 为 null、activeView 为 `stage0`、revision 为 0、receipts 为空。

v2/v3 读取：

- 固定包装为 `legacy-page` / `legacy-canvas`，保证重复只读时 id 稳定。
- 原根级 nodes/edges 进入 legacy 画布，原 gates 保留根级，viewport 为 null。
- 原 nodes 非空时 activeView 为 `canvas`，否则为 `stage0`。
- v2 设置 revision=0、receipts=[]；v3 保留合法 revision/receipts。
- `get()` 只更新内存投影，不写旧档；首次实际成功变更才原子写 v4。无文件的新项目允许直接初始化 v4。
- 无实际变化的 viewState 请求可直接返回当前投影，不为了“迁移”单独写盘。

v4 读取必须校验全部结构、活动引用、重复 id、viewport、revision/receipts。非对象、未知 schemaVersion、缺字段或损坏均抛 `CANVAS_CORRUPT`，不得按空项目覆盖。

## 2. 命令契约

### 2.1 类型

```ts
export interface CanvasTarget {
  projectId: string
  pageId: string
  canvasId: string
}

export type CanvasCommandType =
  | 'page.create'
  | 'page.rename'
  | 'page.delete'
  | 'canvas.create'
  | 'canvas.rename'
  | 'canvas.delete'
  | 'node.move'
  | 'assets.bind'
  | 'assets.unbind'

interface CanvasCommandBase {
  commandId: string
  expectedRevision: number
  projectId: string
}

export type CanvasCommandRequest =
  | (CanvasCommandBase & { type: 'page.create'; title?: string })
  | (CanvasCommandBase & { type: 'page.rename'; pageId: string; title: string })
  | (CanvasCommandBase & { type: 'page.delete'; pageId: string; confirmNonEmpty?: boolean })
  | (CanvasCommandBase & { type: 'canvas.create'; pageId: string; title?: string })
  | (CanvasCommandBase & { type: 'canvas.rename'; pageId: string; canvasId: string; title: string })
  | (CanvasCommandBase & { type: 'canvas.delete'; pageId: string; canvasId: string; confirmNonEmpty?: boolean })
  | (CanvasCommandBase & {
      type: 'node.move'
      pageId: string
      canvasId: string
      nodeId: string
      position: CanvasPosition
    })
  | (CanvasCommandBase & {
      type: 'assets.bind' | 'assets.unbind'
      pageId: string
      canvasId: string
      nodeId: string
      assetIds: string[]
    })

export interface CanvasCommandResult {
  ok: true
  commandId: string
  revision: number
  receipt: CanvasCommandReceipt
  target: CanvasTarget
  canvas: Canvas
}
```

`target` 是命令实际影响目标：页命令带该页及其当前/新建活动画布；删除页命令带被删除页及其删除前活动画布；其他命令带明确 page/canvas。删除后的活动目标从返回 canvas 根级读取。

### 2.2 命令行为

| 命令 | 行为 | 活动状态 |
| --- | --- | --- |
| page.create | 新建一页一空画布，标题缺省自动分配 | 切至新页/新画布，activeView=canvas |
| page.rename | 修改页标题 | 不变 |
| page.delete | 删除页及全部画布、节点、边；不删任何文件资产 | 若删活动页，按下一项/上一项回退 |
| canvas.create | 在指定页新建空画布 | 切至新画布，activeView=canvas |
| canvas.rename | 修改指定画布标题 | 不变 |
| canvas.delete | 删除指定画布及其节点、边 | 若删活动画布，页内按下一项/上一项回退 |
| node.move | 更新指定节点 position 与节点 updatedAt | 不变 |
| assets.bind/unbind | 保持既有索引复核、去重、排序、绑定与解绑语义 | 不变 |

删除规则：

- 最后一页抛 `CANVAS_LAST_PAGE`；页内最后一画布抛 `CANVAS_LAST_CANVAS`。
- 画布含节点/边即为非空；页含多个画布或任一非空画布即为非空。
- 非空且 `confirmNonEmpty !== true` 抛 `CANVAS_CONFIRM_REQUIRED`；空对象允许直接删除。
- UI 确认不是主进程校验的替代品；仅删除 JSON 结构，不删除节点 ref、产物、资产或媒体文件。

### 2.3 事务与重放

- 所有结构/移动/资产命令使用同一全局串行写队列。
- 入队前捕获固定 projectDir；命令 projectId 必须等于该项目根 basename，否则 `CANVAS_PROJECT_MISMATCH`。
- 页/画布/node 目标必须存在且属于同一层级，否则 `CANVAS_TARGET_NOT_FOUND`。
- requestHash 包含 type、完整目标和 payload；同 commandId 同 hash 返回原 receipt，不再次 mutate/write。
- 同 commandId 不同 hash 抛 `CANVAS_COMMAND_REPLAY`；expectedRevision 不等于当前 revision 抛 `CANVAS_REVISION_CONFLICT`。
- 重放检查先于 revision 检查；成功新命令 revision+1，receipt.payload 记录请求，target 与 Canvas 同事务落盘。
- 原子写失败抛 `CANVAS_COMMAND_MUTATION`，旧文件、cache 与 revision 保持不变；写前归档语义不变。

## 3. ViewState 契约

### 3.1 类型与 IPC

```ts
export type CanvasViewStateRequest =
  | {
      type: 'active.set'
      projectId: string
      pageId?: string
      canvasId?: string
      activeView?: 'canvas' | 'stage0'
    }
  | {
      type: 'viewport.set'
      projectId: string
      pageId: string
      canvasId: string
      viewport: CanvasViewport
    }

export interface CanvasViewStateResult {
  ok: true
  target: CanvasTarget
  canvas: Canvas
}
```

新增恰一个 IPC 通道：`canvas:view-state`。preload 暴露：

```ts
canvas.viewState(request: CanvasViewStateRequest): Promise<CanvasViewStateResult>
```

- `active.set` 的 target 为写入后的活动页/活动画布。
- `viewport.set` 的 target 为实际写入的画布，可以不是当前活动画布；返回 canvas 根级活动状态不被该写改变。
- active.set 指定 page 未指定 canvas 时采用该页 activeCanvasId；指定 canvas 时必须同时指定所属 page；缺省两者时保留当前目标。
- viewport.set 仅替换目标画布 viewport；active.set 仅修改活动目标/activeView。
- 两者均使用固定 projectDir、同一串行写队列和原子替换；不增加 revision、不写 receipts，updatedAt 随实际成功落盘更新并广播。
- 相同值请求视为无实际变化，可返回当前 Canvas 而不写盘。

### 3.2 Renderer 频率

- 节点 pointer move、pan pointer move 不发 IPC。
- 节点 pointer-up 一条 node.move；pan pointer-up 一条 viewport.set。
- wheel 缩放结束短防抖后一条 viewport.set；连续滚轮只保存最终值。
- 用户点击 fit 后保存一次；首次自动 fit 不保存。
- 卸载、切项目、切页、切画布取消旧 timer；迟到响应按请求序号与 project/page/canvas key 丢弃。

## 4. Store 与既有工具契约

### 4.1 项目上下文

- cache 以解析后的项目根目录为 key；file、read、commit、broadcast 不共享单份活动项目 cache。
- get/update/withCanvas/command/viewState/upsertGate 在公开入口捕获 projectDir。
- update/withCanvas 在入队前读取并固定 page/canvas 目标；内部可传 CanvasTarget，队列任务内不得重新读取活动目标。
- `listAssets(kind?, projectRoot?)` 的第二个参数仅供主进程内部传捕获项目根；缺省保持现行为，preload 不暴露任意路径参数。
- reset 只失效指定项目缓存；不得清空、覆盖或广播其他项目状态。

### 4.2 既有 `canvas.update`

保留工具名、merge 输入形态、commandId/expectedRevision 事务，不新增 `canvas.write`。

- 在读取时固定活动 page/canvas，后续 upsert 仅作用于该文档。
- nodes/edges patch 不得替换根 pages、gates、activePageId、activeView、revision、receipts 或其他画布。
- merge 节点缺省 position 时保留原值；显式 position 时校验有限坐标并更新。
- 缺省 parentReference、assetIds、dirty 的既有保留行为不得回退。
- brief 影响评估、画布对齐与 canvas.update 在同一读取目标上继续后续写，切页后不得改投新活动画布。

### 4.3 Gate 与 Stage0

- `GateDecisionRequest`、`gate:decide` 与 GateBridge 不变。
- 根级 gates 继续服务当前项目共享会话；Stage0 与 StudioApp 的节点来自活动画布，Gate 来自根级。
- 页/画布切换不修改 activeSessionId、消息、草稿或附件。

## 5. IPC 与模块写权

| 模块 | 本包允许改动 |
| --- | --- |
| shared | 仅 `shared/types.ts` 本契约所列 Canvas 类型 |
| main/store | `electron/canvas/store.ts`；`electron/asset/index.ts` 的可选项目根参数 |
| main 消费点 | `electron/main.ts`、`electron/mcp/tools.ts`、`electron/brief/impact.ts` 及既有 withCanvas 调用适配 |
| bridge | `electron/preload.ts`、`src/global.d.ts` |
| renderer | `CanvasBoard.tsx`、`StudioApp.tsx`、`stage0/select.ts`、必要既有测试 fixture |
| mock | `src/dev-mock-api.ts` 的内存 v4 与新增 viewState |
| 文档/证据 | 本任务包、Feature 索引、P1 记录、Parity、总体规划及实际偏差 |

禁止修改 package.json、lockfile、共享会话/Gate DTO、ComfyUI 协议或切片 D 安全资产 DTO。

## 6. 错误与安全边界

| 错误码 | 含义 |
| --- | --- |
| CANVAS_CORRUPT | 文件结构、版本、活动引用、viewport 或 revision/receipts 损坏 |
| CANVAS_PROJECT_MISMATCH | 请求 projectId 与捕获项目不一致 |
| CANVAS_TARGET_NOT_FOUND | 页/画布/节点不存在或层级不匹配 |
| CANVAS_INVALID_TITLE | 标题 trim 后为空或超过 80 字符 |
| CANVAS_INVALID_POSITION | position 缺失或非有限坐标 |
| CANVAS_INVALID_VIEWPORT | viewport/zoom 非法 |
| CANVAS_CONFIRM_REQUIRED | 非空删除未明确确认 |
| CANVAS_LAST_PAGE / CANVAS_LAST_CANVAS | 删除会破坏最低结构不变量 |
| CANVAS_NOT_FOUND / ASSET_NOT_FOUND | 既有节点或资产目标缺失 |
| CANVAS_REVISION_CONFLICT | expectedRevision 已过期 |
| CANVAS_COMMAND_REPLAY | 同 commandId 不同 payload |
| CANVAS_COMMAND_MUTATION | 命令或原子写失败，旧档保持 |

renderer 不提交项目绝对路径；projectId 仅作当前项目身份校验。所有文件路径由主进程从已捕获项目根派生。

## 7. 契约验收映射

- 需求 AC-1：§1.3 + Store 迁移测试。
- AC-2/3：§2.2 + CRUD/删除测试与真实 Electron。
- AC-4/5/6/7：§1.2、§3 + CanvasBoard/StudioApp 测试与完整重启。
- AC-8/9：§2.3、§3.1、§4.1 + 重放/冲突/故障/项目隔离测试。
- AC-10：§4.2 + MCP merge 测试。
- AC-11：§2、§4.3 + 资产与切片 D 回归。
- AC-12：设计说明的视觉验收 + DOM/可用截图证据。
- AC-13/14：任务清单验证项、变更记录及阶段文档边界。
