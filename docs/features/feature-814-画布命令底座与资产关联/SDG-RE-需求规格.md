# feature-814 画布命令底座与资产关联 · 需求规格

> 状态：✅ 已实施（2026-11-10；全量 83 文件 1054 passed / 1 skipped；renderer typecheck 仅余包前三条基线错误）
> 批准依据：[feature-814 实施计划](../../../.trae/documents/feature-814-画布命令底座与资产关联.md)
> 参考事实源：[MiniMax Design功能与架构参考](../../research/MiniMax%20Design功能与架构参考.md) §2.2、§2.5；[短剧Agent平台设计](../../../短剧Agent平台设计.md) §0.1。
> 本文及同包契约是当前实现范围的硬约束；MiniMax 的 SQLite/React Flow/Dagre 方案不在本批采用。

## 1. 背景与问题

当前画布已经具备 DOM 节点、SVG 连线、自动布局、视口交互和小地图，但所有写入共用无版本条件的读—改—写；`canvas.json` 先移走正档再直接写新档，坏 JSON 又可能被当成空画布。资产页虽已读取真实 `asset-index.json`，资产与画布节点之间仍没有强类型关系，资产生成来源也不能可靠回溯到历史会话。

本批吸收 MiniMax 的命令一致性、回执、正文/资产分离和来源追溯纪律，增强现有 `CanvasStore` 与 JSON 文件链路，不迁移技术栈。

## 2. 用户已拍板的产品范围

1. **含绑定 UI**：资产面板直接对当前选中的画布节点绑定/解绑资产，属于系统直改，不经 Agent 对话。
2. **记录完整来源**：资产保留 `sourceJobId + sessionId/messageId/callId`；本批不做历史会话跳转。
3. **只绑定当前资产**：本批不做资产生成、删除、重生成、采用版迁移，也不做 dirty 自动传播。

## 3. 功能需求

### R1 画布命令与 revision

- `Canvas.schemaVersion` 升级为 3，增加单调递增 `revision` 和最多 100 条 `receipts`。
- 所有现有及新增画布修改统一进入既有写队列与 `CanvasStore` 持久化、订阅广播链路；每次成功的新命令 revision 恰好 +1，并写入一条回执。
- 新系统命令必须携带 `commandId + expectedRevision`。同一 commandId、同一请求摘要直接返回原回执，零写盘、零广播；同一 commandId、不同请求摘要报命令复用冲突。
- 新命令的 expectedRevision 与当前不一致时失败，零业务副作用、零写盘、零广播。
- 旧 MCP `canvas.update` 可省略命令字段；主进程自动生成 commandId，保持旧调用兼容。返回 `{ok:true, canvas, commandId, revision, replayed}`，保留原 `canvas` 字段并附加命令信息。
- 版本归档是命令 before，当前 `canvas.json` 是 after；本批不实现 undo/redo。

### R2 原子 JSON 与坏档保护

- 每次画布持久化按“序列化 → 同目录临时文件写入并 fsync → 复制旧正档到既有 `版本/` 目录 → rename 原子替换”执行。
- 任一步失败保留旧正档并清理临时文件；只有 rename 成功后才推进内存缓存并广播。
- 仅 `ENOENT` 允许初始化空画布。已存在但无法解析或不符合受支持版本的画布必须抛 `CANVAS_CORRUPT`，不得由读取、命令或 `canvas:get` 吞错后覆盖为空图。
- 既有 `archiveExisting` 的移动语义继续供其他模块使用，本包不全局改变它。

### R3 节点—资产关联

- `CanvasNode.assetIds?: string[]` 是强类型关联；不把核心关系藏入 `meta`。
- 新增恰 1 个 `canvas:command` IPC，本批只开放 `assets.bind`、`assets.unbind`。
- 绑定前校验节点和全部资产 ID 存在；绑定去重，解绑只移除目标 ID。旧 `canvas.update` 未显式携带 assetIds 时保留原关联。
- 资产登记保持同 path+kind 幂等；重复登记只更新调用中显式提供的字段，省略的 `sourceJobId/meta/sourceSession` 必须保留。
- 资产索引已存在但损坏时不得按空索引继续写入。

### R4 可信任务/会话来源

- `asset.register` 新增可选 `sourceJobId`，成功返回仍为 `{ok:true, assetId}`。
- `AssetIndexItem` 增加 `sourceSession?: {sessionId; messageId; callId}`。
- 主进程从现有真实 `tool.call` 完成事件中提取物理工具 `shortdrama_asset_register`（MCP 逻辑名 `asset.register`）的成功结果 assetId，并用事件自带的会话三元组异步补写来源；不得接受 Agent 自报三元组，也不得用 `activeSessionId` 反推历史来源。
- 同时兼容直接 JSON 与 MCP `content[].text` 包装的 resultPreview。畸形结果、资产不存在或补写失败仅记录日志，不回滚资产、不阻断 SSE，允许最终一致。

### R5 绑定 UI

- CanvasBoard 向 StudioApp 报告当前选中节点；节点卡显示关联资产数量。
- AssetsPanel 对 image/video/music/workflow 四类资产提供一致的选择、绑定、解绑、忙碌与错误反馈；显示当前节点及已绑定状态。
- nodes 更新时，若当前选中节点仍存在则保持选择，不再强制跳到 active 节点。
- revision 冲突时提示并刷新画布，不自动覆盖他人的更新。

## 4. 验收标准

1. schema v2 旧档首次成功写入后迁移为 v3，revision/receipts 完整；v3 重读不重复迁移。
2. 相同命令重复提交可验证地返回同一 receipt，`replayed:true`，文件与广播次数不变；commandId 复用和 revision 冲突均零副作用。
3. 故障注入覆盖临时写入、fsync、复制归档、rename：旧 canvas.json 内容保持，缓存和广播不推进，临时文件清理。
4. 坏 JSON 经 get、IPC、MCP 均报 `CANVAS_CORRUPT`，磁盘原文不变；只有文件缺失才初始化。
5. 四类资产均可绑定/解绑，节点关联数正确；重复登记保留省略字段，来源补写使用事件三元组。
6. 绑定后当前节点选择不跳变；无节点、无资产、非法 ID、忙碌和冲突状态均有确定反馈。
7. 既有工具总数不增加，既有 MCP 返回字段不减少；Electron、preload、global.d.ts、dev-mock 契约一致。
8. 回归测试通过，node/preload TypeScript 通过；renderer typecheck 不新增错误。

## 5. 明确不做

React Flow、Dagre、SQLite、自由画布、undo/redo、视口持久化、资产生成/删除/换版、资产删除联动、dirty 自动传播、历史会话跳转、新 MCP 工具、新依赖。
