# feature-829 · 创作页历史与跨页正式引用 — 契约

> 版本：v1.0（2026-11-19 冻结）｜对应：[需求规格](./SDG-RE-需求规格.md)

## 1. K1 · shared/types.ts 精确差异

新增：

```ts
export interface CanvasArtifactReference {
  artifactId: string
  version: string
  source: CanvasTarget
  latestVersion?: string
  markedAt?: string
}
```

`CanvasNode` 新增可选字段：

```ts
reference?: CanvasArtifactReference
```

不修改既有节点 ID、ref、meta、dirty、parentReference、revision、receipt 或页/画布字段。`artifactId` 是源节点 ID；`source` 消除不同页/画布中相同节点 ID 的歧义。`version` 来自源节点非空 `meta.version`，不使用文件路径或 `updatedAt` 冒充版本。

## 2. K8 · 既有 canvas:command DTO 扩展

`CanvasPageCanvasCommand` 联合新增：

```ts
| {
    type: 'reference.create'
    target: CanvasTarget
    source: { target: CanvasTarget; nodeId: string }
    nodeId: string
    position: CanvasPosition
  }
```

`target` 是引用节点的目标画布；`source.target` 是源节点所在画布。两者 projectId 必须等于当前项目，pageId 必须不同。`nodeId` 是待创建引用节点的独立 ID，由 renderer 生成并随 commandId 固定，保证重放不会生成重复节点。

成功返回沿用 `CanvasCommandResult`，其中 `target` 和 receipt payload target 均为引用目标画布，`canvas` 为提交后的完整 v4。失败沿既有 IPC 错误结构返回真实 code/message。

不新增 IPC 通道，不改变 preload/global 的函数签名，不新增 MCP 工具；K8 仅因共享命令联合及既有 `canvas:command` 请求形态扩展而触发。

### 创建规则

1. 源、目标页/画布均存在；源节点存在且不是引用节点。
2. 源节点 `ref.path` 与非空 `meta.version` 必须存在。
3. `position.x/y` 必须有限；目标文档不得已有 `nodeId`。
4. 新节点复制源节点 `kind/step/title/status/ref/meta`，使用请求 `position/nodeId` 和提交时间 `updatedAt`；不复制 `dirty/parentReference/assetIds`。
5. 新节点 `reference` 固定为 `{ artifactId: 源节点 id, version: 源 meta.version, source: source.target }`，初始不写 latestVersion/markedAt。
6. 源节点自身不被修改；一次命令只增加目标引用节点，revision 仅增加 1。

错误码使用：`CANVAS_TARGET_NOT_FOUND`、`CANVAS_NODE_NOT_FOUND`、`CANVAS_REFERENCE_INVALID`（同页、引用链、缺 ref/version）、`CANVAS_NODE_EXISTS`、`CANVAS_INVALID_POSITION`、`PROJECT_MISMATCH`，以及既有冲突/重放错误。

## 3. canvas.update 再版与引用状态保护

1. 源版本变化仅在既有固定目标文档中识别：同一节点 ID 的旧、新 `meta.version` 均为非空字符串且不同，构成一次再版；旧无版本、新有版本只视为补齐元数据，不向旧引用挂脏。
2. 对每个再版源，以 `{ source: 当前固定 target, artifactId: 节点 id }` 精确匹配所有页/画布中的引用节点。
3. 匹配节点写 `reference.latestVersion = 新版本`。若 `reference.version !== latestVersion`，同时写 `markedAt = 本次提交时间`；若二者相同，删除 markedAt。未匹配节点不变。
4. 同版本更新、仅 position/status/assets/dirty/updatedAt 改变不再版。源节点自身不使用 reference 脏态。
5. `applyUpdate` 忽略传入节点的 `reference` 字段并保留旧值；新建普通节点不得经 MCP merge 携带 reference。正式引用只能由 `reference.create` 创建，latestVersion/markedAt 只能由主进程再版扫描维护。
6. dev-mock 对齐创建、版本变化和状态保护语义，不伪造独立成功路径。

## 4. 页历史契约

历史项仅为 `CanvasTarget`，不进入 Canvas JSON，不写 shared 持久字段。初始栈只含当前活动 target。

- 新导航成功后才记录：`stack = stack[..currentIndex] + target`，index 指向末尾；同目标不重复。
- back/forward 只改变栈索引并调用既有 `canvas:view-state { type:'active.set', pageId, canvasId, activeView:'canvas' }`；成功后才提交索引，失败保持原索引。
- 回退途中遇到已不存在的页/画布，跳过该项并继续同方向查找；最终无有效项时保持当前目标与禁用态。
- 删除当前目标后，以主进程返回的完整 target 校验并导航；不得通过历史恢复已删除目标。
- 新建页/画布属于新导航；改名不属于导航；视口、节点移动、资产绑定和引用创建不新增历史项。
- 完整重启不恢复栈；活动目标恢复仍遵循 feature-823。

## 5. Renderer 行为

- 按钮可访问名称为“后退一页”“前进一页”，暴露禁用态和稳定测试锚点。
- 源节点菜单新增“复制正式引用”；无版本或引用节点不显示该动作。复制只保存内存 draft，不写盘。
- 有 draft 时，目标页空白菜单显示“粘贴正式引用”；点击后按菜单位置换算有限世界坐标并发送一次命令。成功清除 draft，失败保留 draft 并显示错误。
- 引用节点菜单新增“打开源产物”；先校验源 target/node 仍存在，导航成功后调用既有 onOpenNode。失败不打开伪查看器。
- 引用固定版本与 latestVersion 不同时显示脏徽标和黄条；不使用 `CanvasNode.dirty`。

## 6. 持久化、恢复与安全边界

引用字段随现有整份 Canvas v4 原子写与懒迁移保留；v2/v3 无引用时行为不变。重启后 source、固定 version、latestVersion、markedAt 原样恢复。路径仍由既有节点读取链路校验，本包不开放任意文件系统读写。

回滚实现不得删除既有页、节点或引用；数据回滚需保留 Canvas JSON 副本并按整档恢复。无自动迁移重复节点 ID、无跨项目引用、无引用快照。
