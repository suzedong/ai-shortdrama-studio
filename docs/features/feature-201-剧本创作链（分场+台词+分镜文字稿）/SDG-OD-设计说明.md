# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 设计说明 [反向补录]

> 本包为[反向补录]，**无新增设计、无 UI 改动、无新建视觉稿**。本文记录 STAGE 2 既有实现（2-a/2-b）的运行形态与渲染面，并标注 2-c 的预留状态，作为需求/契约的实现侧注释。

## 1. 运行形态（提示词驱动，非代码模块）

STAGE 2 与 STAGE 1 同构：没有 `electron/script/*` 业务模块，也没有专用 MCP 工具。能力分布：

| 层 | 载体 | 承担 |
|---|---|---|
| 主控编排 | [showrunner.md](../../../resources/opencode/agents/showrunner.md) 第 2 步段（L158–181，提示词内编号 feature-021） | 前置校验、`task` 委派 writer、读回结构校验、发 2-a/2-b 门、approved 后置 done、建正确方向边、manifest.advance、恢复续跑 |
| 文本生产 | [writer.md](../../../resources/opencode/agents/writer.md)（frontmatter feature-018），5 工具白名单 | 分场/台词推理、JSON+MD 双写、节点 active upsert（不带 linksTo） |
| 复用平台能力 | `file.*`、`canvas.*`、`gate.request`、`manifest.*`、`brief.*`（feature-001/002/801 已落地） | 落盘/归档、画布、门桥、状态机、立项读取 |

关键事实：

- **结构校验是 prompt 纪律，不是运行时校验**。showrunner 在发门前 `file.read` 回 JSON，按 L172–175 清单人工（Agent）逐项核对：裸数组、字段恰好、枚举、场号覆盖、id 血缘；不合格打回 writer。`file.write` 的 zod schema 只约束 `{path, content}`，不解析 JSON 内容。
- **两阶段节点状态 + 建边铁律**：writer 落盘只 upsert `status:'active'`（不带 linksTo、不置 done）；门 approved 后 showrunner 一次性 `canvas.update` 置 done（带 parentReference）并建 from=上游/to=本步 的 auto 边。第 2 步禁用 writer linksTo（会产反向边），与第 1 步相反——这是 STAGE 2 特有的编排约束，script-orchestration.test.ts L314 有防回归锚点。
- **2-c 当前是预留空壳**：共享类型（Shot/ShotList）、GateId `'2-c'`、事件 `storyboard-finalized` 均已存在，但 showrunner.md L170 明示「当前版本不产分镜文字稿、不发 2-c 门、不调此事件」，writer.md 无分镜段，生产链路零写入。

## 2. UI 改动面（零改动，仅记录）

| 位置 | 既有形态 | 本包动作 |
|---|---|---|
| [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) `ScenesView`（L191 起） | 渲染 Scene[]：slug / 内外·日夜 / 地点 / 角色 / beats / estSeconds | 不改 |
| [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) `DialogueView`（L229 起） | 渲染 DialogueScene[]：按场归组、speakerName/speakerId、kind、台词、动作 | 不改 |
| [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) `StoryboardView`（L257–292） | 渲染 Shot[]：镜号 / 景别 / 场号 / 运镜 / 时长 / dialogue 空守卫（L280 `{sh.dialogue && ...}`） | 不改；**当前仅 dev-mock 演示有数据**，2-c 落地前生产项目无 shotlist 可渲染 |
| [CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx) KIND_LABEL L174–176 | scenes「分场」、dialogue「台词」、storyboard「分镜表」 | 不改 |
| GateCardView（不改代码） | 2-a/2-b 门卡由 gate payload（ref+摘要）驱动 | 不改 |

> 注：[StageNavPanel.tsx](../../../src/studio/StageNavPanel.tsx) L20–29 把 kind `storyboard` 归在 STAGE 4（分镜）导航；而 shotlist 按裁决①由 STAGE 2（2-c）产文字稿、feature-401 在同文件升级。同名 kind 跨 STAGE 2 产物与 STAGE 4 生产化语境，导航归类以生产阶段为准，本包不改；画布步骤标签的另一处矛盾见 B-13。

## 3. 不新增视觉资产

- 无新图标 / 配色 / 弹窗：门卡复用 GateCardView，分场/台词详情复用 StudioViewer 既有卡片排版；2-c 落地时也优先复用 StoryboardView，不预设新视觉。

## 4. 视觉/契约回归基线

- 编排契约：[script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts) 11 例保持通过（含「不写分镜路径」的 2-c 未启用反向锁定）。
- 全量基线：35 文件 369 passed / 0 failed / 1 skipped（2026-10-14）。
- 本包纯文档，不触碰任何代码，基线不受影响。
