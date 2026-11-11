# feature-814 画布命令底座与资产关联 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（feature 级，永久保留）

### D-001 · K1 + K8：画布命令底座、资产关联与绑定 UI（2026-11-10 已批准）

- **依据**：用户批准 [.trae/documents/feature-814-画布命令底座与资产关联.md](../../../.trae/documents/feature-814-画布命令底座与资产关联.md)，同轮拍板“含绑定 UI / 记录完整来源 / 只绑定当前资产”。
- **K1 范围**：shared/types.ts 的 Canvas v3、revision/receipts、CanvasNode.assetIds、AssetIndexItem.sourceSession、系统命令 DTO；不改其他共享类型形状。
- **K8 范围**：恰 1 个 canvas:command IPC；扩展既有 canvas.update、asset.register DTO；同步 preload/global.d.ts/dev-mock；不增加 MCP 工具数。
- **K9**：零新增依赖，不触发。明确不引入 React Flow、Dagre、SQLite。
- **批准的技术边界**：增强现有 CanvasStore 和全局写队列；回执与 revision 同事务落 canvas.json；版本归档为 before、当前正档为 after；系统绑定与 Agent 更新落同一模型；可信来源只取真实 tool.call 事件。
- **不在批准范围**：自由画布、undo/redo、视口持久化、资产生成/删除/换版、dirty 自动传播、历史会话跳转。
- **状态**：✅ 已批准，可执行 T1–T6。按治理 §4.1，本决策记录于 feature 包，不新增全局架构决策编号。

## 二、实施记录（过渡）

- 2026-11-10：完成 MiniMax Design 4.0.8 静态解包与运行时调研，确认只吸收命令、revision、回执、资产分层和追溯纪律，不复制其依赖或 SQLite。
- 2026-11-10：完成当前代码勘察与计划评审；确认 canvas:get 会吞坏档、archiveExisting 会先移走正档、CanvasBoard 在 nodes 更新时重置选择、资产索引重复登记会清掉省略字段，均纳入本包修复。
- 2026-11-10：建立任务包五文件，T1–T6 获授权，尚未修改生产代码。
- 2026-11-10：冻结包前验证基线——`npm test -- --run`：**82 个测试文件通过，1029 passed / 1 skipped（共 1030）**；`npx tsc -b tsconfig.node.json` 通过；`npm run typecheck` 为 3 条历史测试夹具错误（canvas-zoom ×2、runtime-client ×1），本包不以修旧错误扩张范围。
- **T1 类型与迁移**：`shared/types.ts` 升 Canvas v3，新增 revision、最多 100 条命令回执、系统绑定/解绑 DTO、节点 assetIds 和资产完整来源；v2 首读原位迁移，非 Canvas 的 v2 文档保持原语义。
- **T2 命令与原子 JSON**：`electron/canvas/store.ts` 以单一事务实现重放优先、requestHash 冲突、revision 冲突、归一化绑定/解绑和归一化更新；`archive.ts` 新增复制归档，正档改为同目录临时文件 + fsync + copy + rename，rename 后才推进 cache/广播，失败清理临时文件并保留旧正档。坏档/不支持版本抛 `CANVAS_CORRUPT`，仅 ENOENT 初始化。
- **T3 三端契约**：新增且仅新增 `canvas:command`；旧 `canvas.update` 保持原 canvas 字段并附加 commandId/revision/replayed，自动补 commandId；preload、global.d.ts 和 dev-mock 同步。dev-mock 使用与主进程一致的稳定递归序列化 + SHA-256，MCP 工具总数仍为 29。
- **T4 资产与来源**：`asset.register` 支持 sourceJobId，重复登记仅覆盖显式字段；系统绑定只校验当前资产索引。可信来源观察器仅接受真实完成事件中的物理工具 `shortdrama_asset_register`，从 resultPreview 直接 JSON 或 MCP content[].text 提取 assetId，以事件 sessionId/messageId/callId 补写；逻辑名事件、Agent 自报三元组和 activeSessionId 推断均不采信。补写失败仅记日志，不回滚资产或阻断 SSE。
- **T5 绑定 UI**：CanvasBoard 上报并保持节点选择、展示关联数；AssetsPanel 对图片/视频/音频/工作流提供多选绑定/解绑、忙碌、内联错误和登记完成刷新；StudioApp 统一生成 commandId、提交 expectedRevision，冲突后刷新画布且不自动覆盖，失败保留已选资产。
- **兼容修复**：资产登记恢复路径沙箱、写前归档、kind 过滤和原 `{assetId}` 返回形状；`canvas:get` 只把无活动项目映射为 null。两条 brief 旧故障测试由“移走正档后恢复”迁移到原子临时文件/rename 故障点，继续验证旧磁盘、cache、manifest 与广播补偿。
- **最终实测（2026-11-10）**：`npm run test:run` 为 **83 文件，1054 passed / 1 skipped**；`npm run build:electron`、`npx vite build` 通过；`npm run typecheck` 仍仅上述三条包前基线，无新增错误；package.json/package-lock.json 零依赖 diff，未提交 Git。

## 三、修订记录

（暂无）
