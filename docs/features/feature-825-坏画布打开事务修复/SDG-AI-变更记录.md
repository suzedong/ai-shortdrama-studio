# feature-825 · 坏画布打开事务修复 — AI 变更记录

## v1.0 · 2026-11-18 · 规格冻结

**类型：设计决策（A 类授权下创建 B 类修复包）**

用户明确授权开始修复 F824-01。本包承接 feature-824 AC-F10 / B-71，不把产品修复并入已结束矩阵执行的补验包。

已确认当前磁盘链路：`project:open → openProject 写 session/currentDir → clearLive/reset/recoverPending → canvasStore.get`；后置画布异常还有被空 `catch` 吞掉的分支。修复采用写队列内只读预检，不通过事后恢复 currentDir 掩盖分裂。

冻结写权：`electron/main.ts`、`electron/project/library.ts`、`electron/canvas/store.ts`、主进程/必要 Renderer 回归测试、本包五文件及既有索引/调查/偏差/证据。预判 K1/K8/K9 零触发；shared、preload、dev-mock、MCP、依赖零 diff。A 类总计划/Parity 文档未获本包 K7 批准，不修改。

基线约束：保留工作树全部既有未提交修改；不顺手处理 B-70；不提交、不推送；真实 Electron 使用独立工作区，不破坏 feature-824 原始现场。

### 未修红测证据

`npx vitest run src/test/project/project-open-main.test.ts --reporter=verbose`：1 个测试文件 / 1 项失败。真实 handler 对坏 G 的调用以 `CANVAS_CORRUPT` reject，但随后断言发现 currentDir=G（预期 A）；失败位置为测试第 127 行。异常实际由 `recoverPending` 抛出，证明失败前已经发生门清理/reset 与项目提交。

后续实施与验收结果须在本文件追加，不得预写通过结论。

## v1.1 · 2026-11-18 · 最小修复与真机闭环

**类型：规格内功能修复 + 验证通过（B 类）**

### 产品代码差异

1. `electron/canvas/store.ts`：抽出共用只读 `readFromDisk`，新增显式根目录 `assertReadable`；预检绕过缓存且不创建缺失画布，正式 `getForRoot` 的创建、缓存和校验语义保持不变。
2. `electron/project/library.ts`：`openProject` 增加内部 `beforeCommit` guard，在路径与 manifest 校验后、写队列内任何 session/currentDir 写入前执行。
3. `electron/main.ts`：`project:open` 将目标根目录的 `canvasStore.assertReadable` 接入 guard；IPC 入参、返回和成功路径顺序不变。
4. 新增 `src/test/project/project-open-main.test.ts` 4 项真实 handler 回归；`src/studio/shell/project-nav.test.tsx` 增加失败可见且原选中态不变的组件回归。

### 自动化结果

- 未修基线：1 项红测复现 currentDir=G。
- 定向：5 文件 / 42 测试全部通过。
- `npm run build`：通过，主进程声明与生产 Renderer 均重新生成。
- 构建后 `npm run typecheck`：通过。构建前一次检查因 project reference 的旧 `dist-electron` 声明未含 `assertReadable` 报 2 个 TS2339；重新编译声明后消失，未通过放宽类型绕过。
- 全量 Vitest：86/96 文件、1,201/1,277 测试通过，1 项跳过；仍恰为 B-70 的 10 文件 / 75 项失败，与修复前口径一致，无新增失败。

### 真实 Electron

证据：[p1-after-825-electron.json](../../verification/p1-2026-11-15/p1-after-825-electron.json)、[坏画布失败截图](../../verification/p1-2026-11-15/p1-after-825-bad-canvas.png)、[正常打开截图](../../verification/p1-2026-11-15/p1-after-825-normal-open.png)。隔离根：`/tmp/ai-shortdrama-f825.JVwJyu`；最终 `runCompleted=true`、`ok=true`，五项真机检查全过、Renderer exception=0。

- A → 坏 G：错误可见；currentDir、A/G session、A/G canvas、顶栏、Stage 0、选中项均保持 A；目标广播数 0；坏 G 的 SHA-256 在打开前后均为 `9c3c068e3103c2ff78f125549f81908249bd435c434c153e41a9aba59509c9`。
- 缺 manifest、工作区外路径、projectId 失配分别保持 `PROJECT_NOT_FOUND`、`INVALID_PROJECT_DIR`、`CANVAS_PROJECT_MISMATCH`，且仍保持 A。
- 正常 B：currentDir/canvas/DOM 全部切到 B，`activeSessionId=session-f825-b` 保留，`lastOpenedAt` 更新。
- G 已在取证后恢复为备份，恢复哈希 `6ccca52b861066ad5358bb1e92c9ff6f48b9506d672f7db523939854232a8d68`；CDP/Vite 端口已释放。
- 现有项目切换流程自动恢复历史会话，日志有 2 次 `SESSION_NOT_FOUND`，另有隔离环境缺 `resources/H3-Style` 的 1 次既有错误；本 harness 未发送 prompt、生成或媒体请求，未把这些环境日志伪报为本缺陷失败。

### 闭环与负面清单

AC-825-1—6 通过，B-71 从未闭环偏差表移除；feature-824 的历史矩阵结论不改写。B-70、P1 退出门和完整 Parity 未因本包通过。未修改 A 类总开发计划或 Parity 矩阵；未新增 shared/preload/dev-mock/MCP/依赖改动（这些路径中工作树原有修改保持原样）；未提交、未推送、未发布，未清理既有工作树。
