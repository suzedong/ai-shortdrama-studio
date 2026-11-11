# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 设计说明 [反向补录]

> 本包始于[反向补录]，本次扩展为 2-c 实施包；**无 UI 改动、无新建视觉稿**。本文记录 STAGE 2 提示词编排与 2-c 系统门后置设计，作为需求/契约的实现侧注释。

## 1. 运行形态（提示词驱动，非代码模块）

STAGE 2 与 STAGE 1 同构：没有 `electron/script/*` 业务模块，也没有专用 MCP 工具。能力分布：

| 层 | 载体 | 承担 |
|---|---|---|
| 主控编排 | [showrunner.md](../../../resources/opencode/agents/showrunner.md) 第 2 步段 | 前置校验、`task` 委派 writer、读回结构校验、发 2-a/2-b/2-c 门、approved 后置 done、建正确方向边、恢复续跑 |
| 文本生产 | [writer.md](../../../resources/opencode/agents/writer.md)，5 工具白名单 | 分场/台词/分镜文字草案、JSON+MD 双写、节点 active upsert（不带 linksTo） |
| 系统后置 | [execute.ts](../../../electron/gate/execute.ts) `GATE_MANIFEST_EVENTS` | 2-c approved 映射 `storyboard-finalized`，确定性推进终态；复用 feature-015 幂等与失败分类 |
| 复用平台能力 | `file.*`、`canvas.*`、`gate.request`、`manifest.*`、`brief.*` | 落盘/归档、画布、门桥、状态机、立项读取 |

关键事实：

- **结构校验是 prompt 纪律，不是运行时校验**。showrunner 在发门前 `file.read` 回 JSON，按 L172–175 清单人工（Agent）逐项核对：裸数组、字段恰好、枚举、场号覆盖、id 血缘；不合格打回 writer。`file.write` 的 zod schema 只约束 `{path, content}`，不解析 JSON 内容。
- **两阶段节点状态 + 建边铁律**：writer 落盘只 upsert `status:'active'`（不带 linksTo、不置 done）；门 approved 后 showrunner 一次性 `canvas.update` 置 done（带 parentReference）并建 from=上游/to=本步 的 auto 边。第 2 步禁用 writer linksTo（会产反向边），与第 1 步相反——这是 STAGE 2 特有的编排约束，script-orchestration.test.ts L314 有防回归锚点。
- **2-c 文字草案**：复用既有 ShotList 全部必填字段，不触发 K1。景别、运镜、时长在 2-c 是供确认的文本草案，refs 恒 []、空镜 dialogue=null；feature-401 后续在同一文件生产化，不建立第二产物。分镜内容校验仍是 showrunner prompt 纪律，不新增 zod 业务模块。
- **系统推进唯一化**：2-c 的 `storyboard-finalized` 登记在 feature-015 既有 `GATE_MANIFEST_EVENTS`，与 1-a～2-b 同路径；showrunner 只负责正文、节点与边，不手工 advance。

## 2. UI 改动面（零改动，仅记录）

| 位置 | 既有形态 | 本包动作 |
|---|---|---|
| [StudioViewer.tsx](../../../src/studio/viewer/StudioViewer.tsx) `ScenesView` | 渲染 Scene[]：slug / 内外·日夜 / 地点 / 角色 / beats / estSeconds | 不改 |
| [StudioViewer.tsx](../../../src/studio/viewer/StudioViewer.tsx) `DialogueView` | 渲染 DialogueScene[]：按场归组、speakerName/speakerId、kind、台词、动作 | 不改 |
| [StudioViewer.tsx](../../../src/studio/viewer/StudioViewer.tsx) `StoryboardView` | 渲染 Shot[]：镜号 / 景别 / 场号 / 运镜 / 时长 / dialogue 空守卫 | 不改；2-c 直接复用，草案字段按普通 Shot 展示 |
| [CanvasBoard.tsx](../../../src/studio/canvas/CanvasBoard.tsx) KIND_LABEL | scenes「分场」、dialogue「台词」、storyboard「分镜表」 | 不改 |
| GateCardView（不改代码） | 2-a/2-b/2-c 门卡由 gate payload（ref+摘要）驱动 | 不改 |

> 注：[StageNavPanel.tsx](../../../src/studio/canvas/StageNavPanel.tsx) 把 kind `storyboard` 归在 STAGE 4（分镜）导航；而 shotlist 按裁决①由 STAGE 2（2-c）产文字稿、feature-401 在同文件升级。同名 kind 跨 STAGE 2 产物与 STAGE 4 生产化语境，导航归类以生产阶段为准，本包不改；画布步骤标签的另一处矛盾见 B-13。

## 3. 不新增视觉资产

- 无新图标 / 配色 / 弹窗：门卡复用 GateCardView，分场/台词详情复用 StudioViewer 既有卡片排版；2-c 已复用 StoryboardView，未新增视觉。

## 4. 视觉/契约回归基线

- 实施前基线（2026-11-11）：83 文件 1054 passed / 0 failed / 1 skipped；node/preload 构建通过。
- renderer `typecheck/build` 同受三条既有错误阻断：canvas-zoom.test.tsx 两条、runtime-client.test.ts 一条；不属于本包，不顺手修复。
- 2026-11-11 实施结果：聚焦 2 文件 27 项通过；全量 83 文件 1058 项通过（1 跳过）；node/preload 构建通过；typecheck 与 renderer 构建仍仅上述 3 条历史错误，本包零新增。
- `git diff --check` 通过；shared、IPC、preload、UI、媒体路径零改动。未做真机人工验收。
