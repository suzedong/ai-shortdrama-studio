# feature-814 · 画布命令底座与资产关联实施计划

## Context

MiniMax Design 画布调研表明，当前项目最需要吸收的不是 React Flow 或 SQLite，而是统一命令、revision 一致性、命令回执和节点—资产—来源追溯。当前画布所有写入虽最终经过 `electron/canvas/store.ts`，但缺少 revision、幂等与冲突检查；资产索引已有稳定 ID 和 `sourceJobId`，节点却没有强类型资产关联，系统也没有直改绑定入口。

本批目标是在**纯 JSON、零新增依赖**下交付可用的命令底座和资产绑定闭环，并为后续撤销重做提供基础；本批不实现撤销重做、自由画布、资产生成/删除/换版或历史会话跳转。

## 已确认的产品决策

1. **含绑定 UI**：系统直改绑定/解绑，资产项展示关联状态，节点卡展示关联数量。
2. **记录完整来源**：资产保存 `sourceJobId` 与 `sessionId/messageId/callId`；主进程从真实 `asset.register` 工具完成事件补写可信会话来源，不允许 Agent 自报会话三元组。
3. **只绑定当前资产**：节点保存 `AssetIndexItem.id`；同路径同 ID、换路径新 ID。本批不处理重生成、采用版迁移、资产删除及 dirty 传播。
4. **兼容旧调用**：保留 `canvas.update` 的原有用法；旧调用可省略命令字段，新系统 IPC 必须显式携带 `commandId + expectedRevision`。

## 决策卡口与规格先行

- 新建 `docs/features/feature-814-画布命令底座与资产关联/` 五文件：需求、契约、设计说明、任务清单、变更记录。
- 本计划审批同时作为建包、技术路线及以下卡口的显式决策；获批后先落五文件和决策台账，再改代码。
- **K1**：`Canvas` 升 schemaVersion 3，增加 `revision/receipts`；`CanvasNode` 增加可选 `assetIds`；`AssetIndexItem` 增加可选 `sourceSession`；新增共享命令 DTO。
- **K8**：新增恰 1 个 `canvas:command` IPC，同步 preload、`src/global.d.ts`、dev-mock；`canvas.update` 增加可选命令参数与附加返回字段；`asset.register` 增加可选 `sourceJobId`。不新增 MCP 工具。
- **K9**：零新增依赖，不引入 React Flow、Dagre 或 SQLite。

## 实施步骤

### T1 · 契约、迁移与命令事务

关键文件：`shared/types.ts`、`electron/canvas/store.ts`、`electron/canvas/edges.ts`。

- `Canvas` 增加 `revision: number` 和有界 `receipts`；新画布 revision=0。读取 v2 旧档时仅在内存补 `revision=0、receipts=[]`，节点缺省 `assetIds` 按空数组处理；首次成功提交才落 v3，只读打开不改档。
- 回执保存 `commandId/type/requestHash/revision/appliedAt`，按提交顺序保留最近 100 条。版本归档是 before、当前正档是 after，不额外持久化大段 before/after，也不伪装支持 undo。
- 在现有 `CanvasStore.update/withCanvas/persistInQueue` 上增强唯一事务入口，复用 `write-queue.ts`，禁止嵌套入队或另建事件系统。
- 命令在串行临界区内依次执行：读取回执 → 校验请求摘要 → 校验 expectedRevision → 执行现有变更 → revision+1 → 追加回执 → 单次落盘/缓存推进/广播。
- 相同 commandId、相同操作摘要返回原回执，零写盘、零广播；相同 ID 不同操作报命令复用冲突；revision 过期报冲突；失败不推进业务状态。
- 旧 `canvas.update` 缺省 commandId 时由主进程生成，缺省 expectedRevision 时保持旧行为；节点整体 upsert 时继承旧 `assetIds`，避免无意清除绑定。
- `canvas.align`、立项发布等现有 `withCanvas` 写路径同样经过 revision 事务，保持原业务返回语义。

### T2 · 原子 JSON 与坏档保护

关键文件：`electron/canvas/store.ts`、`electron/fs/archive.ts`、`electron/main.ts`。

- 正档写入顺序：序列化完整新档 → 同目录临时文件写入并 fsync → 复制旧正档到既有 `版本/` 命名规则 → `rename` 原子替换正档 → 推进缓存并通知。
- 不改变其他模块对 `archiveExisting` 的现有语义；画布使用复制归档，任何归档/写入/替换失败都保留旧正档并清理临时文件。
- 仅 `ENOENT` 初始化空画布；现存 JSON 损坏抛 `CANVAS_CORRUPT`，禁止当成空图覆盖。
- `canvas:get` 保留无项目空态，但不再吞掉 `CANVAS_CORRUPT`；订阅兜底空画布同步补 v3 字段。

### T3 · MCP、系统 IPC 与三端镜像

关键文件：`electron/mcp/tools.ts`、`electron/main.ts`、`electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`。

- `canvas.update` 接受可选 `commandId/expectedRevision`，成功结果在 `{ok:true}` 上附加 `commandId/revision/replayed`，不减少旧字段。
- 新增统一 `canvas:command` IPC，本批只开放 `assets.bind/assets.unbind` 两类请求；Renderer 必须提交 commandId 和 expectedRevision，返回 `{canvas,receipt,replayed}`。
- 绑定校验项目内节点和真实 AssetIndexItem，按 ID 去重；解绑只移除指定 ID。资产索引损坏不得被当成空索引并覆盖。
- IPC 不自行广播，仍由 CanvasStore 唯一通知；dev-mock 实现相同 revision、绑定/解绑和订阅语义，避免浏览器与 Electron 分叉。

### T4 · 资产来源与可信会话补写

关键文件：`electron/asset/index.ts`、`electron/mcp/tools.ts`、`electron/main.ts`、`electron/runtime/projection.ts`（只复用事件结构）。

- `AssetIndexItem.sourceSession` 保存 `{sessionId,messageId,callId}`；`asset.register` 接收可选 `sourceJobId`。
- 重复登记时仅更新显式提供的 `sourceJobId/meta`，省略字段保留旧值，修复当前省略字段会清旧值的问题。
- 在 `broadcastRuntimeEvent` 原有 `tool.call` 完成事件中，提取 `asset.register` 成功结果里的 assetId，异步补写事件携带的会话三元组；兼容 MCP content text 的 JSON 包装。
- 相同来源重复事件零写盘；畸形回执或补写失败只记录日志，不回滚资产、不阻断 SSE。该关联允许最终一致，不承诺画布与资产索引跨文件原子。
- 不根据可变化的 `activeSessionId` 反推历史来源，不做历史会话跳转。

### T5 · 绑定 UI 与选择状态

关键文件：`src/studio/canvas/CanvasBoard.tsx`、`src/studio/shell/StudioApp.tsx`、`src/studio/shell/LeftPanels.tsx`。

- CanvasBoard 将选中节点 ID 回调给 StudioApp；节点卡显示 `assetIds.length`。
- 修正当前 nodes 更新后总重置为 active 节点的行为：若已选节点仍存在则保留选择，避免绑定后跳选。
- AssetsPanel 接收当前选中节点和命令入口；各类资产均可选中，提供“绑定到节点/解除关联”，并显示已绑定状态、进行中状态和错误信息。
- 未选节点时禁用操作并给出提示；revision 冲突后刷新画布，不自动覆盖或盲目重试；成功仍经原 `canvas:changed` 订阅更新。

### T6 · 测试与文档闭环

- 先冻结当前测试和 typecheck 基线，再逐任务补充回归。
- Store：v2 迁移、revision 冲突、命令重放、同 ID 不同请求、100 条淘汰、失败零副作用、单次广播、旧 update 保留 assetIds、align/发布兼容。
- 故障注入：临时文件、归档、rename 失败保留旧正档；坏画布/坏资产索引不被空数据覆盖。
- 资产：绑定去重/解绑、节点或资产不存在、sourceJobId/meta 保留、工具回执解包、重复事件零写盘、畸形结果不影响事件流。
- UI：选择保持、关联数量、各资产类型绑定/解绑、无节点禁用、冲突提示；dev-mock 与 IPC 契约测试。
- 全量执行 `npm test -- --run`、`npx tsc -b tsconfig.node.json`、`npm run typecheck`、`npm run lint`、`npm run build`；记录真实结果和历史基线，不预设通过数。
- 真实 Electron 使用构建后的应用验收绑定/解绑、重启恢复、版本归档、revision 冲突和旧 MCP 调用。自动来源用运行时事件集成测试验证，不以付费生成作为验收前置。
- 完成 814 五文件与变更记录，同步 features README、设计现状与偏差清单、决策台账和根版本记录；不提交 Git，除非用户另行要求。

## 明确不做

- 不更换 React 18、不引入画布布局库或数据库。
- 不实现 undo/redo、自由增删节点/连线、视口持久化。
- 不实现资产生成、删除、版本迁移、dirty 自动传播或历史会话跳转。
- 不承诺画布 JSON 与资产索引 JSON 的跨文件原子事务。
