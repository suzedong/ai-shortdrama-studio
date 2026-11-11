# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 变更记录 [反向补录]

> 本包始于[反向补录]：2-a 分场、2-b 台词代码/提示词先落地、任务包后补；2-c 分镜文字稿于 2026-11-11 完成实施。以下保留补录基线、血缘、差异审查与本次验证证据。

## 一、决策记录

- **D-201-1（反向补录基线与范围，2026-10-15）**：按《AI-SDG-AI工具执行指令.md》§7 对已落地的 STAGE 2 剧本创作链反向补录任务包 5 文件；补录时点 git HEAD = `c1ee4e9`（「test: 修复跨平台测试与类型错误，全量测试基线清零」，2026-10-14）。批准方式：用户拍板「下一步做 101/201 反向补录」，并对范围拍板「**补录分场+台词，2-c 列为待实施**」。批准范围：仅固化 2-a/2-b 既有实现、登记 2-c 待办，不改任何生产代码/提示词/共享类型/测试（**无 K1、无 K8**）。
- **D-201-2（2-c 边界，引自既有裁决）**：2-c 产 `分镜/shotlist.json` **文字草案**（ShotList；无本镜台词时 `dialogue:null`、`refs:[]`），feature-401 在**同一文件**内升级生产分镜——裁决①（D-013），出处 [features/README.md](../README.md) §3 与决策台账。
- **D-201-3（2-c 实施口径，2026-11-11）**：用户批准「文字草案 + 系统推进」。2-c 写完整 Shot 字段，景别/运镜/时长为可修改草案，不做资产 refs 或生产化细化；2-c approved 由 feature-015 后置执行器映射 `storyboard-finalized`，Agent 不重复 advance。复用既有共享类型/事件/门 id 与通用工具，**无 K1/K8/K9**。实施前基线：83 文件 1054 passed / 0 failed / 1 skipped；node/preload 构建通过；renderer 三条历史类型错误（canvas-zoom ×2、runtime-client ×1）如实保留。
- **溯源**：[改编]。设计依据《短剧Agent平台设计.md》§4.1 编剧 Agent（L435 职责含「分镜文字稿」）、§7.1 数据血缘与 7 态状态机（L581–588）。
- **编号归属**：本实现统一归入 feature-201；`shared/types.ts` 分场 / 台词 / 分镜类型注释与 showrunner 第 2 步编排标题均不再携带历史编号。

## 二、实施记录

- **2026-10-15（反向补录）**：通读真实代码与提示词（六步法①禁凭印象）后建立本包 5 文件：
  - 需求规格：2-a/2-b 记「代码实现了什么」（R1–R9、AC1–AC6），2-c 单列为待实施（R10、AC7，不勾选）；
  - 契约逐字段核对 `Scene/SceneBreakdown`（types.ts L184–198）、`Dialogue*`（L200–214）、预留的 `Shot/ShotList`（L216–236），落盘/归档、门序、scenes-approved/dialogue-approved 事件、parentReference fields（血缘表 L127–128）、建边铁律；
  - 任务清单 T1–T8 中 2-a/2-b 各项标 [已完成·反向补录]，T-2c-1~4 保留未勾选。
- **差异审查（六步法⑥）**：字段/路径/门/事件/血缘 fields 与文档逐字核对一致（含 dialogue 行「去 episodeDuration、加 platforms」），**未触发「以文档为准修正代码」**；纯文档包，`tsc`/测试基线不受影响。
- **当时登记的覆盖缺口**：[script-orchestration.test.ts](../../../src/studio/contracts/script-orchestration.test.ts) 的脚本化 fake showrunner 当时未模拟 done upsert 的 `parentReference`、未断言 `manifest.advance`。该缺口已由下方 2026-11-11 实施闭合：2-a/2-b/2-c 均断言 done 血缘，门后置改由系统执行并有独立测试，Agent 不再手工 advance。

- **2026-11-11（2-c 规格冻结）**：复核 feature-015 现行契约后，将旧方案中的 Agent 手工 `manifest.advance` 改为系统门后置映射；明确 ShotList 11 字段、文字草案边界、dialogue/角色血缘、payload、parentReference、auto 边、结构校验与 AC7–AC10。规格获用户批准后进入代码实施。
- **2026-11-11（2-c 实施完成）**：writer/showrunner 补齐 ShotList 文字草案、结构校验、确认门与 done/边/血缘；`GATE_MANIFEST_EVENTS` 登记 2-c 系统后置；编排与门执行测试覆盖三门顺序、结构打回、rejected 重开、pending 恢复和 `storyboard-done`。未改 shared、IPC、preload、UI 或媒体路径。
- **验证证据**：聚焦 2 文件 27 项通过；全量 83 文件 1058 passed / 0 failed / 1 skipped；`npm run build:electron` 与 `git diff --check` 通过。`npm run typecheck`、`npm run build:renderer` 仅余基线 3 条历史错误，本包零新增；未做真机人工验收。

## 三、修订记录

- **R-201-1（2-c 缺口登记）**：补录取证确认 2-c 分镜文字稿整体缺位——showrunner.md L170「当前版本不产分镜文字稿、不发 2-c 门、不调此事件」；writer.md 无 Shot/shotlist 段；生产链路对 ShotList 零写入、零专属测试（11 it 中「不写分镜路径」反向锁定该状态）；StoryboardView 仅 dev-mock 有数据。按用户拍板列为待实施（T-2c-*、AC7），不虚构已完成。
- **R-201-2（偏差互参）**：B-12（门模型 L1 冲突）、B-13（画布步骤标签矛盾）随 101/201 补录首次入册，完整描述与建议动作见 feature-101 变更记录 R-101-1 及 [设计现状与偏差清单.md](../../设计现状与偏差清单.md) §2；本包不修正。
- **R-201-3（交叉指针）**：
  - 与 feature-101：`Scene.characterIds[]`、`DialogueLine.speakerId` 引用 101 诞生的 `CharacterProfile.id`；scenes/dialogue 的 parentReference fields 消费小传全集（血缘表 L127–128）。见 feature-101 变更记录 R-101-2。
  - 与 feature-401（未建包）：2-c 所产 `分镜/shotlist.json` 文字稿是 401 的同文件升级起点（D-013 裁决①）；401 建包时须以本包契约 S8/S13 为前置事实，禁止另设第二产物文件。
- **R-201-4（2-a / 2-b 门后推进改口，2026-11-01，feature-015 联动）**：原契约 §4 S13 要求 showrunner 在门 approved 后显式 `manifest.advance`，现改由系统在用户通过后分别直推 `scenes-approved` / `dialogue-approved`，Agent 不重复 advance；分场 / 台词正文、done 节点、依赖边与 parentReference 仍由 Agent 负责。
- **R-201-5（2-c 实施规格与落地，2026-11-11）**：激活并完成原 T-2c，增加系统后置映射与门执行测试；旧「不写分镜路径」反向锁定改为「2-c 前不写分镜路径」。仅扩展既有门映射表，不新增 IPC/DTO/共享类型，不触发 K8。storyboard 的 parentReference 最终按 feature-002 立项叶子字段口径落为「scenes 全集 + aspectRatio」，未采用无法参与立项影响评估的分场文件内部 selector。
