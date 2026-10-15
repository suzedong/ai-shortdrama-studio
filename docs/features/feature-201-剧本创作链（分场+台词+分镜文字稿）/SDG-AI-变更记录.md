# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 变更记录 [反向补录]

> 本包为[反向补录]，且**部分落地**：2-a 分场、2-b 台词代码/提示词先落地、任务包后补；2-c 分镜文字稿尚未实现，仅登记待实施任务。以下记录六步法第 ⑤ 步要求的补录基线、血缘与差异审查结论。

## 一、决策记录

- **D-201-1（反向补录基线与范围，2026-10-15）**：按《AI-SDG-AI工具执行指令.md》§7 对已落地的 STAGE 2 剧本创作链反向补录任务包 5 文件；补录时点 git HEAD = `c1ee4e9`（「test: 修复跨平台测试与类型错误，全量测试基线清零」，2026-10-14）。批准方式：用户拍板「下一步做 101/201 反向补录」，并对范围拍板「**补录分场+台词，2-c 列为待实施**」。批准范围：仅固化 2-a/2-b 既有实现、登记 2-c 待办，不改任何生产代码/提示词/共享类型/测试（**无 K1、无 K8**）。
- **D-201-2（2-c 边界，引自既有裁决）**：2-c 启用时产 `分镜/shotlist.json` **文字稿**（ShotList；一期 `dialogue:null`、`refs:[]`、不排镜），feature-401 在**同一文件**内升级生产分镜——裁决①（D-013），出处 [features/README.md](../../README.md) §3 与决策台账，非设计书正文。
- **溯源**：[改编]。设计依据《短剧Agent平台设计.md》§4.1 编剧 Agent（L435 职责含「分镜文字稿」）、§7.1 数据血缘与 7 态状态机（L581–588）。
- **旧编号血缘（仅注释留痕，不回改）**：实现期编号 `feature-004`（[shared/types.ts](../../../shared/types.ts) L184/L200/L216 分场/台词/分镜类型注释）、`feature-018`（writer profile）、`feature-021`（[showrunner.md](../../../resources/opencode/agents/showrunner.md) L158 第 2 步编排标题）属旧 22 包体系（2026-10-08 作废，见 [features/README.md](../../README.md) §5）；同一实现现统一归入本包 feature-201。

## 二、实施记录

- **2026-10-15（反向补录）**：通读真实代码与提示词（六步法①禁凭印象）后建立本包 5 文件：
  - 需求规格：2-a/2-b 记「代码实现了什么」（R1–R9、AC1–AC6），2-c 单列为待实施（R10、AC7，不勾选）；
  - 契约逐字段核对 `Scene/SceneBreakdown`（types.ts L184–198）、`Dialogue*`（L200–214）、预留的 `Shot/ShotList`（L216–236），落盘/归档、门序、scenes-approved/dialogue-approved 事件、parentReference fields（血缘表 L127–128）、建边铁律；
  - 任务清单 T1–T8 中 2-a/2-b 各项标 [已完成·反向补录]，T-2c-1~4 保留未勾选。
- **差异审查（六步法⑥）**：字段/路径/门/事件/血缘 fields 与文档逐字核对一致（含 dialogue 行「去 episodeDuration、加 platforms」），**未触发「以文档为准修正代码」**；纯文档包，`tsc`/测试基线不受影响。
- **如实登记的覆盖缺口（不作为本包任务）**：[script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts) 的脚本化 fake showrunner 未模拟 done upsert 的 `parentReference`、未断言 `manifest.advance`；由 showrunner.md 文本与 feature-002/801 测试侧守护。2-c 启用时须补 STAGE 2 分镜编排测试（T-2c-3）。

## 三、修订记录

- **R-201-1（2-c 缺口登记）**：补录取证确认 2-c 分镜文字稿整体缺位——showrunner.md L170「当前版本不产分镜文字稿、不发 2-c 门、不调此事件」；writer.md 无 Shot/shotlist 段；生产链路对 ShotList 零写入、零专属测试（11 it 中「不写分镜路径」反向锁定该状态）；StoryboardView 仅 dev-mock 有数据。按用户拍板列为待实施（T-2c-*、AC7），不虚构已完成。
- **R-201-2（偏差互参）**：B-12（门模型 L1 冲突）、B-13（画布步骤标签矛盾）随 101/201 补录首次入册，完整描述与建议动作见 feature-101 变更记录 R-101-1 及 [设计现状与偏差清单.md](../../设计现状与偏差清单.md) §2；本包不修正。
- **R-201-3（交叉指针）**：
  - 与 feature-101：`Scene.characterIds[]`、`DialogueLine.speakerId` 引用 101 诞生的 `CharacterProfile.id`；scenes/dialogue 的 parentReference fields 消费小传全集（血缘表 L127–128）。见 feature-101 变更记录 R-101-2。
  - 与 feature-401（未建包）：2-c 所产 `分镜/shotlist.json` 文字稿是 401 的同文件升级起点（D-013 裁决①）；401 建包时须以本包契约 S8/S13 为前置事实，禁止另设第二产物文件。
