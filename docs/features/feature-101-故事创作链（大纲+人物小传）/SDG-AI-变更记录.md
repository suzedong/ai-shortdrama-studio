# feature-101 故事创作链 · 变更记录 [反向补录]

> 本包为[反向补录]：无先行开发决策，代码/提示词先落地、任务包后补。以下记录六步法第 ⑤ 步要求的补录基线、血缘与差异审查结论。

## 一、决策记录

- **D-101-1（反向补录基线，2026-10-15）**：按《AI-SDG-AI工具执行指令.md》§7 对已落地的 STAGE 1 故事创作链反向补录任务包 5 文件；补录时点 git HEAD = `c1ee4e9`（「test: 修复跨平台测试与类型错误，全量测试基线清零」，2026-10-14）。批准方式：用户拍板「下一步做 101/201 反向补录」。批准范围：仅固化既有实现，不改任何生产代码/提示词/共享类型/测试（**无 K1、无 K8**）。
- **溯源**：[改编]。设计依据《短剧Agent平台设计.md》§4.1 编剧 Agent（L435）、§7.1 数据血缘与状态机（L556–590）。
- **旧编号血缘（仅注释留痕，不回改）**：实现期提示词/类型注释使用的 `feature-018`（故事类型 + writer profile）、`feature-020`（showrunner 第 1 步编排）是旧 22 包体系编号（旧包已于 2026-10-08 作废，见 [features/README.md](../../README.md) §5）；同一实现现统一归入本包 feature-101。`shared/types.ts` StoryOutline/CharacterProfile 无旧包号注释。

## 二、实施记录

- **2026-10-15（反向补录）**：通读真实代码与提示词（六步法①禁凭印象）后建立本包 5 文件：
  - 需求规格记录「代码实现了什么」（R1–R8、AC1–AC6）；
  - 契约逐字段核对 `StoryOutline`/`CharacterProfile[]`（types.ts L156–182）、落盘路径、双写/归档、门序、manifest 事件、parentReference fields；
  - 任务清单 T1–T8 全部标 [已完成·反向补录]，未虚构未实现项。
- **差异审查（六步法⑥）**：字段/路径/门/事件与文档一致，**未触发「以文档为准修正代码」**；`tsc`/测试基线不受影响（纯文档包）。
- **如实登记的覆盖缺口（不作为本包任务）**：[story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts) 的脚本化 fake showrunner 未模拟 done upsert 的 `parentReference`、未断言 `manifest.advance`；该两项由 showrunner.md 文本与 feature-002/801 测试侧守护。若需补齐 STAGE 1 专属断言，另开测试增强包。

## 三、修订记录

- **R-101-1**：登记两个文档/代码偏差（随本包补录首次入册，详见 [设计现状与偏差清单.md](../../设计现状与偏差清单.md)）：
  - **B-12（L1 文档↔代码）**：设计书 §7.1 L554 称「旧 8 确认门（0-a~0-d / 1-a~1-b / 2-a~2-c）模型已作废，不再作为设计依据」，但 STAGE 1/2 实际依赖 `1-a/1-b/2-a/2-b/2-c`（types.ts L239、showrunner.md、两编排测试）。以磁盘实况为终态（D-012），**建议设计书改口**（0-a~0-d 确随 feature-001 退役；1-a/1-b、2-a~2-c 仍现行），本包不改设计书。
  - **B-13（L2 代码↔代码）**：[CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx) STEP_LABEL（L182–191）将 `'3'` 标「资产 / 分镜」、`'4'` 标「镜头」、`'6'/'7'` 均「发布」；与 [StudioApp.tsx](../../../src/studio/StudioApp.tsx) STEP_LABELS（L279–281，3=资产、4=分镜、5=镜头）、[StageNavPanel.tsx](../../../src/studio/StageNavPanel.tsx) STAGES（L20–29）矛盾。影响画布拖拽提示文案，建议以八步闭环为准修正 CanvasBoard STEP_LABEL（属代码小修，不属本反向补录包）。
- **R-101-2**：与 feature-201 的交叉指针——STAGE 2 分场 `Scene.characterIds[]` 与台词 `DialogueLine.speakerId` 引用本包诞生的 `CharacterProfile.id`；见 feature-201 变更记录。
