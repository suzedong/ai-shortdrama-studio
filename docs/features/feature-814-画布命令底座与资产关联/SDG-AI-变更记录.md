> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：`feature-821-资产上传与真实缩略图`（可信资产来源）；`feature-823-多创作页与自由画布持久化`（Canvas 命令与资产绑定）。
> **迁移覆盖**：见 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md)「D-037 归档与迁移覆盖」。
> **历史边界**：本包仅保留历史规格、实施与验收证据；现行职责以负责包为准，根级 Canvas v3 不恢复为现行形状。

# feature-814 画布命令底座与资产关联 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（feature 级，永久保留）

### D-001 · K1 + K8：画布命令底座、资产关联与绑定 UI（2026-11-10 已批准）

- **依据**：用户于 2026-11-10 批准本任务包实施范围（批准结论见[任务清单](./SDG-RE-任务清单.md)），同轮拍板“含绑定 UI / 记录完整来源 / 只绑定当前资产”。
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

## D-037 归档与迁移覆盖（2026-11-19）

现行职责拆分给 [feature-821](../feature-821-资产上传与真实缩略图/SDG-AI-变更记录.md)（可信资产来源）与 [feature-823](../feature-823-多创作页与自由画布持久化/SDG-AI-变更记录.md)（Canvas v4 命令与资产绑定）。“已存在”表示接收包原有 v4 契约已经覆盖，“迁入”表示本次补入自包含 D-037 章节，“保留历史”表示不转成现行形状。

| 原文件 / 章节 | 现行归属与目标章节 | 处理 |
|---|---|---|
| 需求 §1 背景与目标 | 823 需求 §8、设计 §8 | 迁入命令语义；根级 v3 背景保留历史 |
| 需求 §2 命令事务 | 823 契约 §8.2（v4 已有 revision / receipts / hash） | 已存在 + 迁入说明 |
| 需求 §3 文件 / 并发 / 兼容 | 823 契约 §8.2—§8.3、设计 §8.1 | 已存在 + 迁入；坏档保护不放宽 |
| 需求 §4 资产关联 | 823 契约 §8.1 | 迁入 |
| 需求 §5 绑定 UI | 823 需求 §8、契约 §8.4、设计 §8.2 | 迁入 |
| 需求 §6 可信资产来源 | 821 需求 §5、契约 §6、设计 §7 | 迁入 |
| 需求 §7 非目标 | 821 需求 §5；823 需求 §8 | 迁入；同步改 Agent 任务状态仍待后续仲裁，保留历史 |
| 需求 §8 验收 | 原 AC1—AC13 与证据 | 保留历史 |
| 需求 §9 K 卡口决策 | 原批准依据；本次不新增授权 | 保留历史 |
| 契约 §1 单命令事务 | 823 契约 §8.2—§8.3 | 已存在 + 迁入 |
| 契约 §2.1 文件 / 事件顺序（v3） | 823 v4 页—画布树与懒迁移 | 保留历史，被 823 §2 后续条款取代 |
| 契约 §2.2 事件包装 | 823 契约 §8.2 | 迁入 |
| 契约 §2.3 应用与失败路径 | 823 契约 §8.2—§8.3 | 迁入；canonicalApply 的 v3 输入形状保留历史 |
| 契约 §3 关联绑定 | 823 契约 §8.1 | 迁入 |
| 契约 §4 错误码 | 823 契约 §8.1—§8.3 | 已存在 + 迁入 |
| 契约 §5 资产与作业来源 | 821 契约 §6.1 | 迁入 |
| 契约 §6 asset.register sourceJobId | 821 契约 §6.1 | 迁入 |
| 契约 §7 运行时 sourceSession | 821 契约 §6.1—§6.2 | 迁入 |
| 契约 §8 命令请求 / 响应 | 823 契约 §8.1—§8.2 | 迁入 |
| 契约 §9 Renderer 绑定流程 | 823 契约 §8.4、设计 §8.2 | 迁入 |
| 契约 §10 测试契约 | 原 8 组测试与 42 专项断言 | 保留历史 |
| 设计 §1 架构 / 关键路径 | 823 设计 §8.1 | 迁入；v3 路径被 v4 取代 |
| 设计 §2 事务算法 | 823 设计 §8.1、契约 §8.2 | 已存在 + 迁入 |
| 设计 §3 文件 / 队列 / 重试 | 823 契约 §8.3、设计 §8.1 | 已存在 + 迁入 |
| 设计 §4 选择状态与竞态 | 823 设计 §8.2 | 迁入 |
| 设计 §5 可信来源与校验失败 | 821 设计 §7 | 迁入 |
| 设计 §6 UI / 资产页设计 | 823 需求 §8、设计 §8.2 | 迁入 |
| 任务 T0—T9 / 验证项 / 验证记录 | 821 T9 与 823 T8 仅登记文档归并 | 保留历史 |
| 变更记录一—三 / 修订记录 | 821 / 823 D-037 记录只加现行归属指针 | 保留历史 |

冲突处理：814 根级 nodes/edges 的 Canvas v3 已由 823 v4 取代，绝不能因迁移命令语义而恢复；可信来源只信真实物理工具完成事件，不接 Agent 自报 sourceSession、不用 activeSessionId 反推。重复登记省略来源字段不覆盖，补写失败仅日志且不回滚资产、不阻断 SSE。

本次仅文档归并，**自审 + 无第二人复核**，未运行产品测试，未修改历史任务、AC、测试计数或 PASS/FAIL。
