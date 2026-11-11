# feature-814 画布命令底座与资产关联 · 设计说明

> 代码只增强既有 CanvasStore、AssetIndex、runtime event 和 Studio UI，不新建平行存储、队列、事件系统或画布技术栈。

## 1. 模块影响面

```text
shared/types.ts                    K1：Canvas v3、receipt、assetIds、sourceSession、命令 DTO
electron/canvas/store.ts           统一命令事务、迁移、幂等/revision、原子写、坏档保护
electron/mcp/tools.ts              canvas.update/asset.register DTO 扩展；工具数不变
electron/main.ts                   canvas:command；tool.call 来源观察；canvas:get 坏档上抛
electron/asset/index.ts            保留式 upsert、来源补写、坏索引保护
electron/preload.ts                canvas.command 转发
src/global.d.ts                    renderer 契约镜像
src/dev-mock-api.ts                浏览器预览同语义实现
src/studio/canvas/CanvasBoard.tsx  选择保持、选中回调、关联数
src/studio/shell/LeftPanels.tsx    四类资产绑定/解绑 UI
src/studio/shell/StudioApp.tsx     当前节点、命令提交、冲突刷新
```

不改 `electron/fs/write-queue.ts` 的全局串行规则，不改 `archiveExisting` 的移动语义，不新增 package 依赖。

## 2. CanvasStore 结构

### 2.1 单一事务核心

在 store 内抽取私有命令提交函数，输入操作 type、摘要 payload、可选 commandId/expectedRevision 和 mutator，输出 CanvasCommandResult。所有写路径复用同一核心：

- 新 `command(request)`：只路由 assets.bind/assets.unbind。
- 新供 MCP 使用的 update-command 入口：返回完整命令结果。
- 旧 `update/withCanvas/persistInQueue/upsertGate`：保留原 Canvas 返回类型和调用方式，内部生成命令身份后委托核心，避免上游大面积改签名。

`persist()` 仍是唯一自开 enqueue 的私有入口；已经入队的 `persistInQueue` 不再次 enqueue。资产存在性校验若在 bind 内读取，也发生在同一队列任务中，避免校验与写之间交错。

### 2.2 节点更新兼容

现有节点按 ID 整体替换语义不变；除 dirty、parentReference 外，再保留旧 assetIds。仅当调用显式提供 assetIds 时替换，并在写前排序/去重或保持稳定去重顺序。 linksTo 派生自动边逻辑不改。

### 2.3 读取与迁移

`get()` 首先返回 cache。磁盘读取按错误分类：ENOENT → emptyCanvas(v3)；其他读取错误原样抛出；JSON.parse/schema 检查失败 → 带 cause 的 CANVAS_CORRUPT。v2 转 v3 仅规范化新增字段，v3 原样使用；revision/receipts 的缺省仅用于 v2 迁移。

reset() 继续只清缓存。切换项目后由既有 reset 流程保证不会把旧项目 revision 用于新项目。

## 3. 原子写实现

Canvas 私有原子写助手复用 archive.ts 的版本路径命名方式，但不调用会移动正档的 archiveExisting。临时文件名包含进程 ID 和随机 UUID，避免并发或崩溃残留互相覆盖。

写盘失败只清理本次临时文件；不再执行旧方案“删正档、把归档移回”的补偿，因为正档从未提前移走。rename 成功后不再做可能失败的磁盘步骤，确保 cache 与广播只对应已落盘的新 revision。

## 4. MCP / IPC / dev-mock

MCP handler 只负责 zod 校验、调用 store、映射成功/失败信封，不自行实现第二套回执。main.ts 注册唯一 `canvas:command` IPC，错误由 ipcMain.handle reject；preload 不包装业务逻辑。

dev-mock 在内存 Canvas 上复用小型纯辅助逻辑或等价实现：先查 receipt，再查 expectedRevision，随后绑定/解绑、revision+1、截断 receipts、notify。其 canvas 初始对象也升级为 v3，保证浏览器预览与 Electron DTO 一致。

## 5. 资产来源与一致性

AssetIndex 增加内部严格读取：ENOENT 才返回 []，解析错误抛 ASSET_INDEX_CORRUPT。list/register/source 更新共用该读取纪律。重复登记通过 `'field' in input` 区分“省略”与“显式传入”，不能用简单的 undefined 全覆盖。

来源观察器挂在 broadcastRuntimeEvent 的过滤前，以 `void capture...catch(log)` fire-and-forget；它只解析已完成物理工具 `shortdrama_asset_register` 的真实事件和结果，逻辑名 `asset.register` 不作为系统可信来源判定依据，不回写 runtime event，不增加 IPC。补写与 register 共用全局写队列，因而若同事件紧随登记完成到达，按队列顺序最终一致。

## 6. UI 数据流

```text
CanvasBoard.onSelectNode → StudioApp.selectedNodeId
StudioApp.canvas.revision + 新 commandId
  → AssetsPanel 绑定/解绑动作
  → window.api.canvas.command
  → 主进程 CanvasStore → 返回 canvas/receipt + 既有 canvas:changed
  → StudioApp 更新 canvas；CanvasBoard 保留当前选择
```

AssetsPanel 保留现有图片预览 picked 状态；为所有类型增加统一的关联选择状态，当前节点变化时清理不再适用的选择与错误。提交期间禁用相关动作，避免同面板重复命令。节点卡仅展示数量，不在本批内嵌资产缩略图或版本选择器。

## 7. 测试策略与基线

- 2026-11-10 包前全量基线：**82 files passed，1029 passed / 1 skipped（1030）**，命令 `npm test -- --run`。
- `npx tsc -b tsconfig.node.json` 通过；`npm run typecheck` 恰有 3 条历史测试夹具错误：canvas-zoom 的 StepId 与未使用 viewport、runtime-client mock 缺 messages。本包不修复也不新增。
- store 测试覆盖迁移、重放、冲突、100 条截断、字段保留、原子故障和坏档；MCP/IPC 测试覆盖兼容返回及三端 DTO。
- asset 测试覆盖保留式 upsert、坏索引、两类结果包装与可信三元组。
- CanvasBoard/AssetsPanel/StudioApp 测试覆盖四类绑定、解绑、选择保持、忙碌/错误和冲突刷新。
- 最终运行聚焦测试、全量 vitest、node/preload tsc、renderer typecheck、lint/build、git diff --check；按实际结果回填，不把基线错误算作本包新增。
