# SDG-RE-任务清单 · 多创作页与自由画布持久化

> 日期：2026-11-17 ｜ 上游：[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)
> 状态：T0—T7 已完成；产品实施、自动化、真实 Electron 专项验收与文档闭环均已完成。仅声明 P1 切片 E / feature-823 闭环。

## 任务总览

| ID | 任务 | 前置 | 状态 | 主要产物 / 验证 |
| --- | --- | --- | --- | --- |
| T0 | 用户审定五文件任务包与契约 | 已批准实施计划 | ✅ 已完成 | 明确批准记录写入变更记录 |
| T1 | Canvas v4 共享类型与既有消费点类型适配 | T0、K1 | ✅ 已完成 | `shared/types.ts`；typecheck 通过，v3 fixture 已迁移 |
| T2 | Store 懒迁移、CRUD、node.move、viewState 与项目隔离 | T1、K8 | ✅ 已完成 | Store 专项、重放/冲突/故障/切项目测试通过 |
| T3 | main / preload / global / dev-mock / MCP 与 Gate 消费适配 | T2 | ✅ 已完成 | 恰一个新增 IPC；MCP merge 与根 Gate 回归通过 |
| T4 | 页/画布管理条、自由拖动、视口与活动视图恢复 | T3 | ✅ 已完成 | CanvasBoard / StudioApp；交互与竞态测试通过 |
| T5 | 专项、旧功能、切片 D、构建与全量回归 | T1—T4 | ✅ 已验证 | 1196 passed；B-70 75 项既有失败单列 |
| T6 | 隔离真实 Electron 完整退出/重启验收 | T4、相关专项通过 | ✅ 已验收 | `p1-after-823-*` JSON/日志与四张截图；两次完整重启通过 |
| T7 | 任务包与阶段文档闭环 | T5/T6 证据 | ✅ 已闭环 | Feature 索引、P1 §11、Parity、总体规划、docs 索引与链接检查完成 |

## T1 · Canvas v4 与类型适配

- [x] 增加 Position/Viewport/Document/Page/Target/ViewState 类型。
- [x] Canvas 升 v4，根级移除 nodes/edges，保留项目级 gates；增加 activePageId/activeView。
- [x] CanvasNode 增加可选 position；命令改为完整目标判别联合。
- [x] 不改 GateDecisionRequest、会话、资产或 ComfyUI 类型。
- [x] 既有 v3 fixture 改为一页一画布 v4，不增加根级兼容别名。

## T2 · Store 与持久化

- [x] cache 按项目根 Map 隔离；所有公开入口捕获 projectDir，提交不再读取全局活动项目。
- [x] update/withCanvas 入队前固定 page/canvas 目标；listAssets 使用相同项目根。
- [x] v2/v3 固定 legacy id 懒迁移且 get 零写盘；v4 严格校验，坏档拒绝覆盖。
- [x] 页/画布 CRUD、标题规则、非空确认、最后项保护及确定性活动回退。
- [x] node.move 支持跨 STAGE 与负坐标；资产命令使用完整目标。
- [x] viewState 同队列原子写且不增 revision/receipts；相同值无变化不写。
- [x] 保留 commandId+hash 重放、expectedRevision、100 条回执、归档和原子写。
- [x] `canvas.update` 缺省 position 保留，不改其他页/画布、活动状态、viewport 或 gates。

## T3 · IPC 与既有消费点

- [x] main 注册 `canvas:view-state`，入口捕获项目并校验身份。
- [x] preload/global.d.ts 暴露安全 DTO；renderer 不传绝对项目路径。
- [x] dev-mock 实现内存 v4、全部命令、viewState、revision/replay，不访问真实磁盘。
- [x] `canvas.update` 保持工具名和 merge 形态，不新增 `canvas.write`。
- [x] brief/impact、Stage0、项目标题与对齐等消费点使用活动文档；GateBridge DTO 不变。
- [x] 读取/评估目标贯穿后续写，切页后不得改投。

## T4 · Renderer

- [x] 空态/非空态均有创作页 tabs、画布选择、新建、inline 改名和确认删除。
- [x] 所有命令带 expectedRevision 与 project/page/canvas 目标；错误安全提示，不伪造成功。
- [x] 拖动中使用临时投影，pointer-up 单 node.move；移除跨 STAGE 回弹。
- [x] node.position 缺省时走确定性布局；吸附、边、小地图/fit 支持自由与负坐标。
- [x] viewport 按画布恢复；wheel 防抖、pan pointer-up、主动 fit 保存，自动 fit 不写。
- [x] 卸载/切项目/页/画布取消 timer，丢弃迟到响应；广播不抢占已恢复视口。
- [x] activeView 持久化立项/画布视图；页切换保持 activeSessionId、消息和附件。
- [x] StudioApp 的 dirty、导航徽章、广播、选择、底部时间和资产命令改用活动文档。
- [x] 保留 feature-822 的安全资产引用、草稿恢复、竞态防护与失败脱敏。

## T5 · 自动化与构建

- [x] 迁移：v2/v3 get 零写盘、首次变更 v4、坏档/重复 id/活动失配拒绝。
- [x] CRUD：非空确认、最后项保护、活动回退、标题与默认序号。
- [x] 移动：跨 STAGE/负坐标、单命令、缺省保留、冲突恢复。
- [x] 视口：逐画布恢复、防抖、fit、旧 timer 取消、activeView 恢复。
- [x] 事务：重放、hash、revision、viewState 不增 revision、原子写失败保旧档。
- [x] 隔离：同名 nodeId 不串，队列切项目、cache/广播/迟到响应不串。
- [x] MCP：只写固定目标，保留 position、其他文档、viewport 与根 gates。
- [x] UI：空态、管理条、改名/删除态、深浅主题、小地图/吸附/边/缩放锚点。
- [x] 回归：Gate、brief、Stage0、资产上传/绑定、对话 chip 与安全历史回放。

执行：

```bash
npm run typecheck
npx vitest run src/test/canvas/canvas-store.test.ts src/test/canvas/canvas-command.test.ts src/studio/canvas/canvas-board.test.tsx src/studio/canvas/canvas-zoom.test.tsx
npx vitest run src/test/canvas src/test/brief src/test/gate src/test/mcp
npm run build
npm run build:electron
git diff --check
npm run test:run
```

另跑切片 D 相关 runtime/chat/asset 测试。全量失败须与既有 B-70 基线逐项对账，不伪报全绿。

## T6 · 真实 Electron 验收

- [x] 使用隔离 userData/临时工作区及合法 v3 fixture；dev-mock 关闭，不触真实用户项目。
- [x] get 后磁盘仍 v3；进入画布，建两个创作页，至少一页两个画布并改名。
- [x] 跨 STAGE 拖动含边节点；首次变更后磁盘 v4，position 正确、边关系不变。
- [x] 两个画布设置不同 zoom/pan；导入真实小 PNG 并验证指定画布绑定、小地图、吸附、fit。
- [x] 记录重启前 DOM、preload get 与磁盘 JSON。
- [x] 完整终止并重启 Electron，不用 reload；精确恢复 AC-7 全部状态。
- [x] 两项目排队写/迟到响应不串。
- [x] 保存 `p1-after-823-*` 机器证据；无可用截图时如实标注取证限制。

## T7 · 文档闭环

- [x] 更新本包实际改动、测试、真机证据、AC 状态与偏差。
- [x] 更新 `docs/features/README.md`。
- [x] 在 P1 调查记录追加新补记，不改写历史。
- [x] 按证据更新 Parity 相关行和版本、总体规划 P1 进展及 docs 索引。
- [x] 有偏差则更新 `docs/verification/偏差清单.md`；无证据不得写通过。
- [x] 校验本轮 Markdown 链接和 `git diff --check`；不创建 Git commit。

## 验收结果与证据闭环（2026-11-17）

### 自动化与构建

- Canvas v4、Store、命令、Board、zoom、迁移、事务和项目隔离专项通过。
- 切片 D 专项 `7 files / 122 tests` 全通过；旧资产与画布回归 `4 files / 67 tests` 全通过。
- `npm run typecheck`、`npm run build`、`npm run build:electron`、`git diff --check` 通过。
- 全量 Vitest：`1196 passed / 75 failed`；10 个失败文件、75 项失败均属于既有 B-70，未修复，不伪报全绿。

### AC 对照

| AC | 状态 | 实际证据 |
| --- | --- | --- |
| AC-1 | ✅ | v3 get 零写；两创作页、第二页两画布、改名及活动目标持久化 |
| AC-2 | ✅ | 含边节点跨 STAGE 拖至约 `{x:28,y:-60}`；pointer-up 单命令、边关系保留 |
| AC-3 | ✅ | 页/画布 CRUD、非空 inline 确认、最后项保护与确定性回退；资产文件仍存在 |
| AC-4 | ✅ | expectedRevision 冲突恢复、并发目标复核与原子命令专项通过 |
| AC-5 | ✅ | v2/v3 懒迁移、稳定 legacy id、首次写 v4、坏档拒绝覆盖专项通过 |
| AC-6 | ✅ | 原生 PNG 导入并绑定指定画布，索引、节点引用与缩略图一致 |
| AC-7 | ✅ | 两次完整进程退出/重启分别恢复 stage0 与 canvas 的活动页/画布和精确状态 |
| AC-8 | ✅ | 两画布独立 zoom/pan、fit、小地图、吸附与负坐标包围盒通过 |
| AC-9 | ✅ | 重放、hash、revision、原子写失败保旧档、回执归档及队列专项通过 |
| AC-10 | ✅ | 切页保持项目 activeSessionId、消息与资产附件；清空 / 提交草稿互斥回归通过 |
| AC-11 | ✅ | viewState 防抖、同队列原子写、不增 revision/receipts、旧 timer 取消通过 |
| AC-12 | ✅ | 真实 Electron 四张截图留存，深浅主题、完整导入反馈与 renderer 零异常有证据 |
| AC-13 | ✅ | Gate、brief、Stage0、MCP merge、资产安全与既有 chip 历史回放回归通过 |
| AC-14 | ✅ | 92 条固定 A 目标排队命令全部成功；12 条响应晚于打开 B，A 写保留、B 独立 |

### 真实 Electron 证据

- 主证据：[p1-after-823-electron.json](../../verification/p1-2026-11-15/p1-after-823-electron.json)（`ok=true`、`rendererExceptions=[]`）与[运行日志](../../verification/p1-2026-11-15/p1-after-823-electron.log)。
- 截图：[重启前](../../verification/p1-2026-11-15/p1-after-823-before-restart.png)、[stage0 重启前](../../verification/p1-2026-11-15/p1-after-823-stage0-before-restart.png)、[stage0 重启后](../../verification/p1-2026-11-15/p1-after-823-stage0-after-restart.png)、[canvas 重启后](../../verification/p1-2026-11-15/p1-after-823-canvas-after-restart.png)。
- 取证限制：非空删除容器在进程停止时注入 fixture，证据已标 `fixtureInjectedWhileStopped=true`；真实 inline 确认与资产保留已验，但不据此宣称异常终止通过。

### 负面清单

1. B-70 的 75 项既有失败未修复；revision/原子写自动化通过不等于真实异常终止故障注入通过。
2. 页历史、跨页正式引用、undo/redo、手动连线编辑、自动整理、独立聚焦、左右布局快捷键与结果定位不在本切片通过范围。
3. 通知中心及 Parity 矩阵其他未通过项维持原状；本结果只封闭切片 E，不封闭 P1 或完整 Parity。
4. 本轮新增与变更的 Markdown 相对链接均有效；P1 调查记录上方历史段落原有 6 个日志链接目标已不在工作区，保留历史原文，不伪造补齐。

## 完成口径

仅当 T0—T7 均有实际证据时，声明“P1 切片 E / feature-823 闭环”。不得外推为 P1 整体验收、完整 Parity、页历史、跨页引用、undo/redo 或手动连线编辑通过。
