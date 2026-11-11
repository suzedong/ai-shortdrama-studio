# feature-814 画布命令底座与资产关联 · 任务清单

> 批准日期：2026-11-10。K1/K8 已随实施计划显式批准；K9 零新增依赖，不触发。

## T1 命令事务与共享模型

- [x] shared/types.ts 落 Canvas v3、revision/receipts、assetIds、sourceSession、命令 DTO。
- [x] CanvasStore 统一命令核心，完成重放、commandId 冲突、expectedRevision、100 条回执截断。
- [x] v2 旧档迁移、ENOENT 初始化、CANVAS_CORRUPT 坏档保护。
- [x] 同目录 temp+fsync、复制归档、rename 原子替换，成功后 cache/广播。
- [x] 既有 update/withCanvas/persistInQueue/upsertGate 全接入且保留旧返回语义。

## T2 MCP / IPC / 三端镜像

- [x] canvas.update 增加可选 commandId/expectedRevision 和附加成功字段，工具数不变。
- [x] asset.register 增加 sourceJobId，工具数不变。
- [x] 新增恰 1 个 canvas:command IPC，仅 assets.bind/assets.unbind。
- [x] preload、global.d.ts、dev-mock 同步；canvas:get 不再吞 CANVAS_CORRUPT。

## T3 资产关联与可信来源

- [x] 节点 assetIds 保留、绑定去重、解绑和资产/节点校验。
- [x] 资产重复登记仅更新显式字段，坏索引不得按空档覆盖。
- [x] 主进程从 tool.call 完成事件提取 assetId，补写 sourceJobId + 会话三元组。
- [x] 兼容直接 JSON/MCP content text；补写失败只记录日志，不阻断事件。

## T4 绑定 UI

- [x] CanvasBoard 选择回调、节点选择保持、关联数展示。
- [x] AssetsPanel 四类资产统一选择、绑定、解绑、忙碌与错误展示。
- [x] StudioApp 持有选中节点、提交命令、revision 冲突刷新，不自动覆盖。

## T5 回归验证

- [x] store 命令/迁移/原子故障/坏档测试。
- [x] MCP、IPC、preload/dev-mock 契约测试。
- [x] 资产保留式登记与来源解析/补写测试。
- [x] 绑定 UI、选择保持、冲突与错误测试。
- [x] 聚焦测试和全量 vitest；node/preload tsc、typecheck、build、diff check（项目未配置 lint script，未执行 lint）。

## T6 治理收尾

- [x] 回填变更记录与任务实测结果。
- [x] 更新 features/README、设计现状与偏差清单的实际状态和剩余边界。
- [x] 根版本记录新增 feature-814 条目。
- [x] 确认 package.json 零依赖 diff，不提交 Git（除非用户另行要求）。

## 实施回填（2026-11-10）

- T1–T6 全部完成；K1/K8 按批准范围实施，K9 零触发，未提交 Git。
- 最终全量：83 个测试文件，1054 passed / 1 skipped；其中 feature-814 UI 专项 6 项（CanvasBoard 1 项 + StudioApp 5 项），四类资产绑定/解绑均覆盖。
- `npm run build:electron` 与 `npx vite build` 通过；`git diff --check` 通过。
- `npm run typecheck` 仅保留包前基线三项：`canvas-zoom.test.tsx` 的 StepId 与未使用 viewport、`runtime-client.test.ts` 的 mock 缺 messages；本包无新增类型错误。
- 两条 brief 原子补偿旧测试已迁移到临时文件/rename 故障点：rename 失败保留旧正档与已复制归档，不再移走正档后恢复。
- 本包不含真机验收项；重生成、采用版迁移、历史会话跳转、undo/redo、React Flow/Dagre 均保持非目标。
