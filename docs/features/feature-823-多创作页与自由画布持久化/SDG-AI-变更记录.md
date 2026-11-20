# SDG-AI-变更记录 · 多创作页与自由画布持久化

> 日期：2026-11-17 ｜ 当前状态：**T0—T7 已完成，P1 切片 E / feature-823 专项闭环**；B-70 与 P1 其余缺口未关闭，不宣称 P1 或完整 Parity 通过。

## 2026-11-17 · 现状调查与实施计划批准

- 分类：新增功能 + 结构性接口契约 + 局部持久化加固。
- 只读调查确认：单 `canvas.json` v3、无页/画布集合、无节点坐标和视口持久化；拖动仅为 renderer 内存 overrides；Store 提交时读取全局活动项目存在串项目风险。
- 用户批准切片 E 实施计划，目标为多创作页、页内多画布、自由坐标、逐画布视口和活动状态完整重启恢复。
- 设计边界：根级 gates 继续属于项目共享会话；不建立按页会话，不新增 MCP `canvas.write`，不新增手动连线编辑、undo/redo、页历史或跨页正式引用。

## 2026-11-17 · K1 / K8 / 删除策略用户裁决

### K1：明确批准

- 允许修改 `shared/types.ts`，Canvas 从 v3 升为单文件 v4。
- 采用创作页一对多画布、节点可选 position、逐画布 viewport、活动页/活动画布持久化。
- v2/v3 读取时包装为一页一画布，首次成功变更才写 v4；`canvas.update` 缺省 position 保留。
- 已批准计划进一步明确根级 activeView 也由 viewState 持久化，不使用 localStorage 第二份项目状态。

### K8：明确批准

- 允许页/画布新建、重命名、删除、node.move 命令扩展及 `canvas.viewState` IPC。
- 结构、移动和资产绑定进入 revision/receipts；活动状态与 viewport 同队列原子落盘但不进入 revision/receipts。
- 不新增 MCP `canvas.write`，只适配既有 `canvas.update`。

### 删除：明确批准

- 非空对象二次确认后仅删结构，不删除产物或资产文件。
- 至少保留一页一画布；活动对象删除后按下一项/上一项确定性切换。

### K9：零触发

- 复用既有 DOM/SVG 画布、写队列、Electron IPC 和 sharp 等现有依赖。
- 不修改 `package.json` 或 lockfile，不引入 React Flow、新数据库或多文件事务。

## 2026-11-17 · 标准五文件建包（待契约审定）

- 创建需求规格、契约、任务清单、设计说明和本变更记录。
- 契约冻结 Canvas v4 单一数据树、完整目标命令、ViewState、稳定 legacy id、项目上下文捕获、删除边界、错误码和验收映射。
- UI 设计依据为 Parity §1.4 的真实参考行为与现行 CanvasBoard/ComfyServicePanel/ProjectNav 设计系统，无独立视觉稿、无参考外新风格。
- 本轮仅新增本任务包文档；未修改 `shared/types.ts`、主进程、preload、renderer、测试、依赖或阶段验收状态。
- 建包后校验五文件齐全、15 个内部链接全部有效，并修正设计说明中 ComfyServicePanel/ProjectNav 的两处源码目录；类型、命令、迁移与 T0—T7 编号一致。
- **下一闸口**：用户明确审定 [SDG-RE-契约](./SDG-RE-契约.md) 后才允许 T1—T6 产品实施与验证；不创建 Git commit。

## 2026-11-17 · T0 契约审定通过

- 用户明确选择“批准契约，开始实施”，审定五文件任务包与当前契约，授权按 T1—T7 推进实施与验证。
- K1/K8 按已审定契约执行，K9 继续零触发；范围、删除策略和阶段验收边界不变。
- 后续产品改动、自动化证据与真实 Electron 结果按任务进度持续登记；不创建 Git commit。

## 2026-11-17 · 实施记录：T1—T4 产品落地

- 分类：已批准结构性接口契约的实施 + 逻辑实现；K1/K8 严格按本包契约执行，K9 零触发。
- Canvas 升级为单一 v4 数据树：根级 `pages / activePageId / activeView / gates`，页内多画布，画布内 `nodes / edges / viewport`，节点支持可选 `position`；不保留根级 nodes/edges 双份事实。
- Store 完成 v2/v3 懒迁移、v4 严格校验、页/画布 CRUD、非空确认与最后项保护、跨 STAGE/负坐标 `node.move`、完整目标资产命令及 `active.set` / `viewport.set`；get 旧档零写，viewState 不增 revision/receipts。
- 所有公开入口在调用时捕获项目根，写前固定 page/canvas 目标，cache 按项目根隔离；保留 commandId+hash 重放、expectedRevision、100 条回执、归档和原子写。
- 恰新增 `canvas:view-state` IPC，并同步 main / preload / `global.d.ts` / dev-mock；既有 MCP `canvas.update` 保持工具名和 merge 形态，缺省 position 保留，未新增 `canvas.write`。
- Renderer 完成创作页 tabs、画布选择、新建、inline 改名和确认删除；拖动帧零 IPC、pointer-up 单命令；自由/负坐标下边、吸附、fit 和小地图可用；逐画布视口与活动视图跨完整重启恢复，切页不重置项目会话或资产附件。
- 未修改 Gate 决策 DTO、会话、ComfyUI、媒体通道、`package.json` 或 lockfile；未引入新依赖。

## 2026-11-17 · 实施记录：T5/T6 验证与证据

- 自动化：切片 D 专项 `7 files / 122 tests` 全通过；旧资产/画布回归 `4 files / 67 tests` 全通过；Canvas v4、Store、命令、Board、zoom、迁移、事务与项目隔离专项通过。
- `npm run typecheck`、`npm run build`、`npm run build:electron`、`git diff --check` 通过。
- 全量 Vitest 为 `1196 passed / 75 failed`；75 项失败均属既有 B-70，未修复、未掩饰为全绿，也无本切片新增失败。
- 隔离真实 Electron 验收使用独立 userData/临时工作区，dev-mock 关闭；v3 get 后磁盘未变，首次变更后写 v4。两创作页、第二页两画布与 inline 改名、跨 STAGE 负坐标拖动、原生 PNG 导入与真实资产绑定、独立 zoom/pan、fit、小地图均通过。
- 项目隔离压力路径共 92 条固定 A 目标排队命令全部成功，其中 12 条响应晚于打开 B；A 写完整保留，B 状态独立。第一次完整进程退出/重启恢复 stage0 与精确 viewport，第二次恢复 canvas、活动页/画布与精确 viewport；renderer exceptions 为空。
- 非空页/画布经 inline 确认删除且资产文件仍存在。其非空容器是在进程停止时注入 fixture，机器证据已标 `fixtureInjectedWhileStopped=true`；该取证前提不作为真实用户项目数据或异常退出通过证据。
- 机器证据：[p1-after-823-electron.json](../../verification/p1-2026-11-15/p1-after-823-electron.json)、[运行日志](../../verification/p1-2026-11-15/p1-after-823-electron.log)；截图：[重启前](../../verification/p1-2026-11-15/p1-after-823-before-restart.png)、[stage0 重启前](../../verification/p1-2026-11-15/p1-after-823-stage0-before-restart.png)、[stage0 重启后](../../verification/p1-2026-11-15/p1-after-823-stage0-after-restart.png)、[canvas 重启后](../../verification/p1-2026-11-15/p1-after-823-canvas-after-restart.png)。
- 只声明 P1 切片 E / feature-823 专项闭环；B-70、异常终止故障注入、页历史、跨页正式引用、undo/redo、手动连线编辑及其他 P1 缺口不在通过范围，P1 与完整 Parity 仍未整体通过。未创建 Git commit。

## 2026-11-17 · 文档变更：T7 阶段闭环

- 任务清单已回填 T0—T7、AC-1—AC-14、自动化计数、真机证据、fixture 取证限制与负面清单。
- 已更新 Feature 索引、P1 调查记录 §11、Parity 影响矩阵 v1.8 对应行、总体规划 v0.10 与 docs 文档地图；未改写历史补记，未虚构后续切片编号。
- 本轮新增与变更的 Markdown 相对链接校验通过；P1 上方历史段落原有 6 个日志链接目标缺失，已如实登记且未伪造文件。`git diff --check` 通过。
- 无新增产品偏差需要另立 B 编号；B-70 继续由既有偏差清单跟踪。未创建 Git commit、未推送、未发布。

## 2026-11-19 · D-037 文档归并：接收 Canvas 命令与资产绑定

- 分类：任务包归属治理 / 文档修订；不新增接口、共享类型、依赖或验收授权。
- 来源：feature-814（Git 历史） §2—§5、§8 的 Canvas 命令底座、assetIds、原子 JSON、坏档保护和 AssetsPanel / CanvasBoard 交互。
- 目标章节：需求 §8、契约 §8、设计 §8；任务清单追加 T8 与 D-037 AC。814 §6 / §7 的可信资产来源由 821 接收，未混入本包。
- 冲突处理：814 根级 nodes/edges 的 Canvas v3 已被本包 v4 页—画布树取代，只保留历史与懒迁移输入；assets.bind / unbind 以完整 pageId / canvasId 目标收编，不恢复旧形状。revision / receipts / hash / 原子写 / 坏档保护为已存在能力，标记归并而非新开发。
- 边界：821 上传仍系统直做且不自动绑节点；822 对话资产引用独立。本包不接 Agent 自报 sourceSession，不新增 MCP canvas.write，不把来源失败或安全 chip 降级变成 SSE 阻断。
- 归档覆盖：814 变更记录「D-037 归档与迁移覆盖」逐章标明 821 / 823 / 保留历史；原任务、AC、测试计数与 PASS/FAIL 不改写。
- 验证：仅文档自审与限定路径差异 / 格式检查；**自审 + 无第二人复核**。未运行产品测试，不宣称新增能力或真机验收通过。

## 2026-11-19 · D-037 跨组文档归并：接收 Canvas 只读预检

- 分类：任务包归属治理 / 文档修订；补齐归档时只登记去向、尚未实际接收的缺口，不新增接口、共享类型、依赖或验收授权。
- 来源：feature-825（Git 历史） 需求 §2、AC-825-1、AC-825-3 的 Canvas 部分，契约 §2 的 `assertReadable` 部分，以及设计 §2 的共用只读解析路径。
- 目标章节：需求 §9（共用判据、零副作用与职责边界）、契约 §9（`readFromDisk` / `assertReadable`、错误与接缝）、设计 §9（只读步骤和两种调用路径）；任务清单追加 T9 与 D-037-AC4—AC6。
- 冲突处理：预检与正式加载必须共用解析 / 迁移 / 结构 / projectId 校验，但预检绕过缓存并丢弃结果；ENOENT 可由正式加载创建，预检本身不创建。坏 JSON、非法结构和项目失配继续按原错误 fail closed，旧档懒迁移不成为预检写盘理由。
- 职责裁决：827 接收 `openProject beforeCommit` guard、session / currentDir 和项目写队列；828 接收完整打开提交及提交后清门、reset / recover、标题和广播。823 不接管路径 / manifest 错误优先级，不扩成跨文件事务、通用回滚或任意后置 I/O 故障保证。
- 覆盖回填：825「D-037 归档与迁移覆盖」中相应 823 状态已据上述真实章节改为“已迁入”；原归档说明、历史任务、AC、测试计数、PASS/FAIL 和 827 / 828 去向不改写。
- 验证：仅文档自审与限定路径差异 / 格式检查；**自审 + 无第二人复核**。未运行产品测试，不宣称新增能力、历史测试重跑或真机验收通过。
