# feature-101 故事创作链 · 设计说明 [反向补录]

> 本包为[反向补录]，**无新增设计、无 UI 改动、无新建视觉稿**。本文记录 STAGE 1 既有实现的运行形态与渲染面，作为需求/契约的实现侧注释。

## 1. 运行形态（提示词驱动，非代码模块）

STAGE 1 没有 `electron/story/*` 之类的业务模块，也没有专用 MCP 工具。能力分布在两层：

| 层 | 载体 | 承担 |
|---|---|---|
| 主控编排 | [showrunner.md](../../../resources/opencode/agents/showrunner.md) 第 1 步段（L141–155，提示词内编号 feature-020） | 前置校验、`task` 委派 writer、发 1-a/1-b 门、approved 后置 done、建边、manifest.advance、恢复续跑 |
| 文本生产 | [writer.md](../../../resources/opencode/agents/writer.md)（frontmatter 标 feature-018），5 工具白名单 | 大纲/小传推理、JSON+MD 双写、节点 active upsert |
| 复用平台能力 | `file.*`、`canvas.*`、`gate.request`、`manifest.*`、`brief.*`（feature-001/002/801 已落地） | 落盘/归档、画布、门桥、状态机、立项读取 |

关键事实：内容结构（字段恰好、裸数组、≥2 角色、id 主键等）是 **writer/showrunner 的 prompt 纪律**，不是 zod/TypeScript 的运行时校验。`file.write` 的 zod schema 只约束 `{path, content}`（[tools.ts 约 L103–122](../../../electron/mcp/tools.ts)），写入的 JSON 字符串内容不被解析校验。

## 2. UI 改动面（零改动，仅记录）

| 位置 | 既有形态 | 本包动作 |
|---|---|---|
| [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) `OutlineView`（约 L143–185） | 渲染 StoryOutline：logline / seasonArc / themes / conflicts / episodes | 不改 |
| [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) `ProfilesView`（约 L305–317） | 渲染 CharacterProfile[] 角色卡（id/name/age/role 等） | 不改 |
| [CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx) KIND_LABEL L172–173 | `outline`「故事大纲」、`profiles`「人物小传」 | 不改 |
| GateCardView（喂入内容，不改代码） | 1-a/1-b 门卡由 gate payload（ref+摘要）驱动 | 不改 |

> 注：`profiles` 这一 kind 在 [StageNavPanel.tsx](../../../src/studio/StageNavPanel.tsx) L24 被归入 STAGE 3 资产的 kinds（dev-mock 角色定妆演示沿用），与人物小传节点 kind 同名但属不同演示语境；本包不改该映射，相关步骤标签矛盾统一记入 B-13。

## 3. 不新增视觉资产

- 无新图标 / 配色 / 弹窗：门卡复用 GateCardView，产物详情复用 StudioViewer 既有卡片排版。

## 4. 视觉/契约回归基线

- 编排契约：[story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts) 6 例保持通过。
- 全量基线：35 文件 369 passed / 0 failed / 1 skipped（2026-10-14）。
- 本包纯文档，不触碰任何代码，基线不受影响。
