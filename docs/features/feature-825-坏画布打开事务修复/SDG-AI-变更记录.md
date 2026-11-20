> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

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

## D-037 归档与迁移覆盖（2026-11-19）

**类型：文档归属治理（无产品实现变更）**

本包转为历史快照。现行能力按下表分别由 feature-823、827、828 负责；feature-823 的 Canvas 只读预检已实际迁入需求 §9、契约 §9、设计 §9，并由任务 T9 与对应变更记录登记，上表相应条目已标为“已迁入”。AC-825-1—6、B-71 闭环、B-70 失败及 feature-824 原始总体 FAIL / F10 FAIL 均不改写。

| 历史章节 / 内容 | 当前负责包与精确目标章节 | 覆盖状态 | 历史边界 / 冲突处理 |
|---|---|---|---|
| 需求 §1「问题与根因」：先提交 session/currentDir、后读 canvas 导致状态分裂；未修红测与异常来源 | feature-828 需求、契约、设计的「D-037 现行归并约束：项目打开提交事务」；feature-827 的「D-037 现行归并约束：openProject 提交守卫与单项目写队列」 | 已迁入 | 原根因、红测位置和调查结论保留历史；现行修复语义按接收包执行 |
| 需求 §2「目标」：目标画布提交前只读守卫及失败零副作用 | Canvas 只读预检本体 → feature-823 需求 §9.1—§9.3、契约 §9.1—§9.4、设计 §9.1—§9.4；guard/session 提交顺序 → feature-827 D-037 章节；完整打开提交及提交后顺序 → feature-828 D-037 章节 | 823 已迁入；827/828 已迁入 | 预检不写盘、不建 session、不清门、不广播、不填缓存；不扩写为通用回滚框架 |
| 需求 §3 AC-825-1：坏 JSON、非法结构、projectId mismatch fail closed，原项目 session/currentDir/canvas 不变 | 校验与错误语义 → feature-823 需求 §9.1—§9.2、契约 §9.1—§9.3、设计 §9.1—§9.3；guard 失败时 session/currentDir 零写入 → feature-827 D-037 章节；项目打开一致性 → feature-828 D-037 章节 | 823 已迁入；827/828 已迁入 | 原 AC 与通过结论保留历史，不倒写 feature-824 原始 FAIL |
| 需求 §3 AC-825-2：失败前无门清理、恢复、reset、标题同步或目标广播 | feature-827 D-037 章节负责提交点前 guard/session 零写入；feature-828 D-037 章节负责完整打开编排及提交后副作用顺序 | 已迁入 | 仅保证预检失败发生在提交点前；不承诺任意后置 I/O 故障或跨文件事务 |
| 需求 §3 AC-825-3：正常打开、缺失 canvas、正式加载创建、会话绑定与广播 | 缺失 canvas 可读及正式加载语义 → feature-823 需求 §9.1—§9.2、契约 §9.1—§9.3、设计 §9.2—§9.3；正常打开 DTO、session/currentDir 提交与 clearLive/reset/recover/title/broadcast 顺序 → feature-828 D-037 章节；guard 成功后才提交 → feature-827 D-037 章节 | 823 已迁入；827/828 已迁入 | 原正常打开验收保留历史；本次未新增真机验收 |
| 需求 §3 AC-825-4：`INVALID_PROJECT_DIR` → `PROJECT_NOT_FOUND` → guard 原始错误的优先级 | feature-827 需求、契约、设计的 D-037 章节；完整打开行为同时见 feature-828 D-037 章节 | 已迁入 | 保留 `CANVAS_CORRUPT` / `CANVAS_PROJECT_MISMATCH` 等 guard 原始错误，不由预检抢先改变路径/manifest 错误 |
| 需求 §3 AC-825-5：真实 Electron A → 坏 G → 正常 B 闭环 | 保留历史 | 保留历史 | 隔离根、`runCompleted=true`、`ok=true`、Renderer exception=0、截图及哈希证据不改写；归档不代表新增复验 |
| 需求 §3 AC-825-6、任务 T3/T5：定向测试、typecheck、build 与既有失败单列 | 保留历史；后续通用验证门禁由 feature-830 负责 | 保留历史；830 已有通用门禁 | 定向 5 文件 / 42 项通过，全量 86/96 文件、1,201/1,277 项通过、1 项跳过，B-70 恰为 10 文件 / 75 项失败，均不改成全量绿 |
| 需求 §4「非目标」：不顺修 B-70、不新增通用回滚、不改共享/通道/依赖 | feature-827 / 828 D-037 章节继承保证边界；其余保留历史 | 已迁入 + 保留历史 | 不扩为跨文件事务、目录 fsync、任意后置 I/O、第三方并发替换、断电或系统崩溃全保证 |
| 契约 §1「外部契约」：`project:open` 入参、`{ ok, activeSessionId }`、既有错误及零新增 IPC/DTO | feature-828 D-037 契约章节；guard 内部边界见 feature-827 D-037 契约章节 | 已迁入 | 历史零新增通道结论保留，不构成对后续其他 Feature 的永久禁令 |
| 契约 §2「内部提交守卫」：`CanvasStore.assertReadable/readFromDisk` 与 `openProject beforeCommit` | Canvas 预检及共用解析/校验 → feature-823 需求 §9、契约 §9、设计 §9；beforeCommit 与同一单项目写队列 → feature-827 D-037 章节 | 823 已迁入；827 已迁入 | guard reject 原样上抛且后续队列可继续；目标 session/currentDir 零写入 |
| 契约 §3「成功路径顺序」 | feature-828 D-037 章节；session/currentDir 提交子序列见 feature-827 D-037 章节 | 已迁入 | 标题同步非致命语义及广播不并入 CanvasStore 预检的历史说明保留 |
| 契约 §4「文件与写权」、§5「决策卡口预判」 | 保留历史 | 保留历史 | 仅描述本包当次实施授权，不作为现行跨包写权；shared/preload/dev-mock/MCP/依赖零 diff 结论不改 |
| 设计 §1「不变式」、§3「提交点与错误顺序」 | feature-827 D-037 设计章节；完整提交后顺序由 feature-828 D-037 设计章节负责 | 已迁入 | guard 位于 openProject 写队列内部；失败无需事后恢复 currentDir，后续队列可继续 |
| 设计 §2「共用解析路径」 | feature-823 需求 §9.1—§9.2、契约 §9.1—§9.3、设计 §9.1—§9.3 | 823 已迁入 | 文件不存在返回可打开；坏 JSON、非法结构、projectId mismatch 与正式加载采用同一判据；预检绕过缓存且无写副作用 |
| 设计 §4「测试设计」、§5「风险与回滚」 | 保留历史 | 保留历史 | mock、临时工作区、spy、广播捕获及回滚步骤均为当次实施记录；不回写或删除既有失败事实 |
| 任务 T0—T5、完成定义、2026-11-18 验收结论 | 保留历史；现行维护分别见 feature-823 / 827 / 828 | 保留历史 | 所有勾选状态、AC-825-1—6 通过、定向 42 项、B-70 75 项失败和真机证据路径永久保留 |
| 变更记录 v1.0「规格冻结 / 未修红测证据」 | 保留历史 | 保留历史 | A 类授权、写权、1 项红测、currentDir=G 及 recoverPending 异常来源不改写 |
| 变更记录 v1.1「产品代码差异」 | 实现维护按本表拆分至 feature-823 / 827 / 828 | 已迁入 + 保留历史 | 三处产品代码及新增测试的当次差异说明原样保留；本次归并未修改产品代码或测试 |
| 变更记录 v1.1「自动化结果 / 真实 Electron / 闭环与负面清单」 | 保留历史 | 保留历史 | build/typecheck 过程、全部测试计数、两项 SHA-256、隔离根、截图、环境日志、B-71 闭环及 B-70/P1/Parity 未通过边界均保留 |

跨组接收补齐（2026-11-19）：feature-823 已实际新增需求 §9、契约 §9、设计 §9、任务 T9 与对应变更记录，上表相应 823 状态据此由待接收改为“已迁入”，并不再指向旧登记中不存在的预检 AC 编号。上方“仅指明精确去向”为原归档时状态，保留作历史说明；本次仅补齐文档归属，未改历史任务、AC、测试计数或 PASS/FAIL，未运行产品测试，**自审 + 无第二人复核**。

本次归档为自审，无第二人复核；未运行产品测试，未新增接口、产品能力或真机验收结论。
