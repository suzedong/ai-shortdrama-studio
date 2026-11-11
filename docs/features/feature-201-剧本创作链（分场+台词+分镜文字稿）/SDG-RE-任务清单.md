# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 任务清单 [反向补录]

> 执行依据：[需求规格](./SDG-RE-需求规格.md) + [契约](./SDG-RE-契约.md)。
>
> **本包始于[反向补录]**：2-a 分场、2-b 台词已核对为 [已完成·反向补录]；2-c 分镜文字稿于 2026-11-11 按用户批准口径完成实施。补录基线锚点 `c1ee4e9`（2026-10-14）；本次实施前基线为 83 文件 1054 passed / 0 failed / 1 skipped。
>
> **卡口：本次无 K1/K8/K9**——不改 `shared/types.ts`（Shot/ShotList/2-c/storyboard-finalized 均已预留）、不新增 MCP 工具/IPC、不引入媒体；仅在既有门后置映射表增加 `2-c` 项，不改对外工具或 DTO。

## 0. 上下文加载清单（工作围栏）

- [x] `AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`（§7 六步法）
- [x] [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §4.1（L435 编剧含分镜文字稿）、§7.1（L552–599）
- [x] 本包需求规格 / 契约
- [x] [shared/types.ts](../../../shared/types.ts) L184–239、L16–22（只读核对，未改动）
- [x] [resources/opencode/agents/writer.md](../../../resources/opencode/agents/writer.md) L60–80
- [x] [resources/opencode/agents/showrunner.md](../../../resources/opencode/agents/showrunner.md) L121–129（血缘表）、L158–181（第 2 步）
- [x] [electron/fs/archive.ts](../../../electron/fs/archive.ts)、[electron/project/manifest.ts](../../../electron/project/manifest.ts) L24–50、[electron/mcp/tools.ts](../../../electron/mcp/tools.ts)
- [x] [script-orchestration.test.ts](../../../src/studio/contracts/script-orchestration.test.ts) 全文（实施前 11 it）
- [x] [StudioViewer.tsx](../../../src/studio/viewer/StudioViewer.tsx) ScenesView / DialogueView / StoryboardView
- [x] [feature-015 契约](../feature-015-确认门非阻塞化与系统直做后置/SDG-RE-契约.md)、[execute.ts](../../../electron/gate/execute.ts)、[gate-execute.test.ts](../../../src/test/gate/gate-execute.test.ts)

本次围栏内改动仅：writer.md、showrunner.md、execute.ts、上述两组测试与本包/索引文档。shared、preload、IPC、UI 与其他 STAGE 均不改。

## 1. 原子任务

### 1A. 2-a 分场 / 2-b 台词（全部[已完成·反向补录]）

#### T1 · 共享类型形状核对 —— [已完成·反向补录]
- 核对（不改）[shared/types.ts](../../../shared/types.ts)：`Scene` L185–197（11 字段、枚举、ep 恒 1）、`SceneBreakdown=Scene[]` L198；`DialogueLine` L201–208（speakerId 兜底、kind 三值）、`DialogueScene` L209–213、`DialogueScript` L214。
- 结论：与契约 §1.1/§1.2 逐字段一致；无需修正代码。

#### T2 · writer 分场/台词落盘纪律核对 —— [已完成·反向补录]
- 核对 [writer.md](../../../resources/opencode/agents/writer.md)：SceneBreakdown ≥3 场、字段「恰好如下」、characterIds 取自小传、beats 非空（L60–69）；DialogueScript 按场组织、sceneNo 覆盖分场、行字段恰好、speakerId `''`+speakerName 兜底、禁 type/note（L70–78）；MD 不加新事实（L79）；第 2 步只 upsert active、不带 linksTo、不置 done（L42）。
- 结论：与契约 S1–S7、S15 一致。

#### T3 · showrunner STAGE 2 编排核对 —— [已完成·反向补录]
- 核对 [showrunner.md](../../../resources/opencode/agents/showrunner.md) L158–181：必需输入（立项单+大纲+小传，背景档案可选，L160）；建边铁律（L162）；恢复续跑（L164）；缺故事不启动（L165）；2-a 交接物/active/读回结构校验/门 payload（L166）；2-a approved 收尾 done+边+scenes-approved（L167）；2-b 交接物/校验/门 payload/门序（L168）；2-b approved 收尾+dialogue-approved+不自动进第 3 步（L169）；结构校验清单（L172–175）；rejected 同 id、目录固定、零媒体（L179–181）。
- 结论：与需求 R1–R9、契约 §3/§4 一致。

#### T4 · 门 / manifest / 血缘核对 —— [已完成·反向补录]
- 核对：`GateId` 含 `'2-a'|'2-b'|'2-c'`（[types.ts L239](../../../shared/types.ts#L239)）；事件跃迁 scenes-approved L31 / dialogue-approved L32（[manifest.ts](../../../electron/project/manifest.ts)）；done 必带 parentReference，fields 取血缘表 scenes L127 / dialogue L128（含 episodeDuration/platforms 差异）。
- 结论：与契约 S12–S14 一致。

#### T5 · 落盘与版本归档核对 —— [已完成·反向补录]
- 核对：分场/台词双写两次 `file.write`（非原子）；覆盖前 [archive.ts](../../../electron/fs/archive.ts) 移入「剧本/版本/<base>.<时间戳><ext>」，归档失败阻断；2-a/2-b 不写「分镜/」。
- 结论：与契约 S9–S11 一致。

#### T6 · 契约测试核对 —— [已完成·反向补录]
- 核对 [script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts) 11 it（L240–410）：门序/委派/路径、rejected 重开、active 无 linksTo、edges 方向、反向边防回归、分场/台词结构校验打回、ep=1 与 input 血缘、零媒体、缺故事不启动、恢复续跑；全量基线 35 文件 369 passed / 0 failed / 1 skipped。
- 缺口（如实登记，不在本包补）：fake showrunner 未模拟 done 的 parentReference、未断言 manifest.advance（契约 §6）。

#### T7 · 渲染端核对（零改动）—— [已完成·反向补录]
- 核对 [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx)：`ScenesView`（L191 起）渲染 Scene[]、`DialogueView`（L229 起）渲染 DialogueScene[]；CanvasBoard KIND_LABEL 含 scenes/dialogue（L174–175）。
- 结论：既有渲染满足查看需求，本包不做 UI 改动（设计说明 §2）。

### 1B. 2-c 分镜文字稿（已完成）

> 2026-11-11 用户拍板「文字草案 + 系统推进」：完整 Shot 字段均落盘，景别/运镜/时长为草案；refs 恒 []，生产化归 feature-401 同文件演进。验收对应 AC7–AC10。

- [x] **T-2c-1 · writer.md 补分镜文字稿段**：写 `分镜/shotlist.json/.md`；逐镜满足 S8/S16/S17；空镜 `dialogue:null`、`refs:[]`；active upsert `step-2-storyboard`，不带 linksTo、不置 done。
- [x] **T-2c-2 · showrunner.md 激活 2-c**：2-b approved 后才可启动；交接小传+分场+台词；读回结构校验；发 2-c 门；approved 后 done（storyboard 血缘 fields）+ dialogue→storyboard auto 边；不手工 advance。
- [x] **T-2c-3 · 系统后置映射**：execute.ts 登记 `2-c → storyboard-finalized`，复用 feature-015 的 approved 执行、幂等与失败分类，不新增 IPC/DTO。
- [x] **T-2c-4 · 编排与门测试**：覆盖三门顺序、ShotList 双写与结构、active/done/边/parentReference、rejected 同 id、2-c 前不写分镜、系统推进 storyboard-done、零媒体零资产。
- [x] **T-2c-5 · 自验**：聚焦 2 文件 27 项、全量 83 文件 1058 项通过（1 跳过）；node/preload 构建通过；typecheck 与 renderer 构建仅余基线 3 条历史错误；diff 检查无 shared/IPC/UI/媒体改动。未做真机人工验收。

### 1C. 治理收尾

#### T8 · 治理文档收尾 —— [已完成·反向补录；2-c 已同步]
- [features/README.md](../README.md) 2xx 行更新为 2-a/2-b/2-c 已实施；§3 与 P1 行同步文字草案边界。
- 设计书 §0.1 / §7.1 与同名 HTML 镜像同步 2-c 现行状态；偏差清单不新增已闭合条目。
- [版本记录.md](../../../版本记录.md) 追加 2-c 实施与验证证据；根 README、docs/README 同步现状。

## 2. 产出物清单

| 产出 | 位置 | 状态 |
|---|---|---|
| 需求规格 / 契约 / 任务清单 / 设计说明 / 变更记录 | 本包 5 文件 | ✅ 已同步 2-c 实施结果 |
| 共享类型 Scene/Dialogue*/Shot*、GateId、事件 | [shared/types.ts](../../../shared/types.ts) | ✅ 复用既有，零改动 |
| writer 文本纪律 | [writer.md](../../../resources/opencode/agents/writer.md) | ✅ 分场/台词/分镜文字稿 |
| showrunner 第 2 步编排 | [showrunner.md](../../../resources/opencode/agents/showrunner.md) | ✅ 2-a/2-b/2-c 完整闭环 |
| 系统门后置 | [execute.ts](../../../electron/gate/execute.ts) | ✅ 登记 2-c → storyboard-finalized |
| 编排契约测试 | [script-orchestration.test.ts](../../../src/studio/contracts/script-orchestration.test.ts) | ✅ 三门、结构、恢复、done/边/血缘 |
| 门后置测试 | [gate-execute.test.ts](../../../src/test/gate/gate-execute.test.ts) | ✅ STAGE 2 终态与未登记门分支 |
| 渲染 | [StudioViewer.tsx](../../../src/studio/viewer/StudioViewer.tsx) | ✅ 复用 ScenesView/DialogueView/StoryboardView，零改动 |

## 3. 不做（防止越界）

- 不改共享类型、preload、IPC、UI 或其他 STAGE；不新增 MCP 工具。
- 不做 feature-401 生产分镜（refs 资产绑定、景别/运镜/生产时长细化、生产 dialogue 回填）；不做 STAGE 3+ 与任何媒体生成。
- 不做 React Flow / Dagre / undo-redo；不顺手修复实施前已有的三条 renderer 类型错误。
- 不把系统门后置重新交回 Agent，不新增第二套 manifest 推进路径。
- ~~不回改设计书 §7.1 L554（B-12）；不修 CanvasBoard STEP_LABEL（B-13）~~ 两者均已于 2026-10-15 修复（偏差清单 §2：设计书改口 + STEP_LABEL 对齐八步），修复不在本补录包范围内。
