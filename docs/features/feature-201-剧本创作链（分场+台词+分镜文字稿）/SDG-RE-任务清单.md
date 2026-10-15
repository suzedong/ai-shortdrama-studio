# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 任务清单 [反向补录]

> 执行依据：[需求规格](./SDG-RE-需求规格.md) + [契约](./SDG-RE-契约.md)。
>
> **本包为[反向补录]，但仅部分落地**：2-a 分场、2-b 台词任务在补录前**已由既有提示词/测试落地**，逐项核对磁盘实况后勾选并标 [已完成·反向补录]；**2-c 分镜文字稿尚未实现（showrunner.md L170 明示当前不执行），其任务保留未勾选**，不虚构（《指令》§7 ④；用户 2026-10-15 拍板）。补录基线锚点 `c1ee4e9`（2026-10-14）。
>
> **卡口：本包无 K1/K8**——不改 `shared/types.ts`（Shot/ShotList/2-c/storyboard-finalized 均已预留）、不新增 MCP 工具/IPC。旧实现期编号（feature-004 分场/台词类型注释、feature-018 writer、feature-021 STAGE2 编排）仅作血缘注释保留，本包不回改编号。

## 0. 上下文加载清单（工作围栏）

- [x] `AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`（§7 六步法）
- [x] [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §4.1（L435 编剧含分镜文字稿）、§7.1（L552–599）
- [x] 本包需求规格 / 契约
- [x] [shared/types.ts](../../../shared/types.ts) L184–239、L16–22（只读核对，未改动）
- [x] [resources/opencode/agents/writer.md](../../../resources/opencode/agents/writer.md) L60–80
- [x] [resources/opencode/agents/showrunner.md](../../../resources/opencode/agents/showrunner.md) L121–129（血缘表）、L158–181（第 2 步）
- [x] [electron/fs/archive.ts](../../../electron/fs/archive.ts)、[electron/project/manifest.ts](../../../electron/project/manifest.ts) L24–50、[electron/mcp/tools.ts](../../../electron/mcp/tools.ts)
- [x] [src/studio/script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts) 全文（11 it）
- [x] [src/studio/StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) ScenesView L191 / DialogueView L229 / StoryboardView L257

围栏外文件本包零改动（electron 业务模块、preload、main、writer.md/showrunner.md 正文均不改）。

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

### 1B. 2-c 分镜文字稿（待实施，本包不实现、不勾选）

> 触发本组任务即进入实施：届时按《指令》§2 走完整任务包流程（AC7 守护），且须遵守裁决①（D-013）：201 只产文字稿，生产化归 feature-401 同文件演进。

- [ ] **T-2c-1 · writer.md 补分镜文字稿段**：新增 ShotList 文字稿纪律——写 `分镜/shotlist.json/.md`，一期空镜 `dialogue:null`、`refs:[]`、不排资产不排生产镜；active upsert 2-c 节点、不带 linksTo。
- [ ] **T-2c-2 · showrunner.md L170 激活**：由「预留不执行」改为执行剧本——交接物、读回结构校验、`gate.request({gateId:'2-c'})`、approved 后 done（parentReference fields=血缘表 storyboard 行 L129：scenes 全集+aspectRatio）+ 建边 + `manifest.advance({event:'storyboard-finalized'})` 到 storyboard-done。
- [ ] **T-2c-3 · 编排测试**：script-orchestration.test.ts 新增 2-c 用例（产 `分镜/shotlist.json` 文字稿、门序 2-c 在 2-b 后、终态 storyboard-done、不触媒体）；移除/改写「不写分镜路径」反向锁定中与 2-c 冲突的断言表述。
- [ ] **T-2c-4 · 自验**：全量测试通过；`分镜/` 仅在 2-b approved 后出现；shotlist 与 feature-401 共用一个文件路径（不设第二产物）。

### 1C. 治理收尾

#### T8 · 治理文档收尾 —— [已完成·反向补录]
- [features/README.md](../../README.md) 2xx 行状态更新为「🟡 部分落地（2-a/2-b 已补录，2-c 待实施）」并加本包链接；P1 行勾选 101/201（注明 201 2-c 待实施）。
- [设计现状与偏差清单.md](../../设计现状与偏差清单.md) §3 P1 行同步；B-12 / B-13 已随 101/201 补录登记（见两包变更记录）。
- [版本记录.md](../../../版本记录.md) 追加 101/201 反向补录条目。

## 2. 产出物清单

| 产出 | 位置 | 状态 |
|---|---|---|
| 需求规格 / 契约 / 任务清单 / 设计说明 / 变更记录 | 本包 5 文件 | ✅ 本次新建（反向补录） |
| 共享类型 Scene/Dialogue* | [shared/types.ts](../../../shared/types.ts) L184–214 | ✅ 既有（零改动） |
| 共享类型 Shot/ShotList、GateId '2-c'、事件 storyboard-finalized | types.ts L216–236 / L239 / L16–22 | 🟡 已预留，生产链路未启用（2-c） |
| writer 分场/台词纪律 | [writer.md](../../../resources/opencode/agents/writer.md) L60–79 | ✅ 既有（零改动）；无分镜段（2-c 待补） |
| showrunner 第 2 步编排 | [showrunner.md](../../../resources/opencode/agents/showrunner.md) L158–181 | ✅ 2-a/2-b 既有（零改动）；L170 2-c 预留 |
| 编排契约测试 | [script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts) 11 it | ✅ 既有（零改动）；2-c 用例待补 |
| 渲染 | StudioViewer ScenesView/DialogueView | ✅ 既有（零改动）；StoryboardView 仅 dev-mock 演示 |

## 3. 不做（防止越界）

- 本包不改任何生产代码、提示词、共享类型、测试；不新增 electron 模块 / MCP 工具 / IPC。
- **不实现 2-c**（T-2c-* 仅登记待实施）；不产 `分镜/shotlist.*`、不发 2-c 门、不调 storyboard-finalized。
- 不做 feature-401 生产分镜（refs/景别/运镜升级、dialogue 回填）；不做 STAGE 3+ 资产与任何媒体生成。
- 不补 parentReference / manifest.advance 的 STAGE 2 测试断言（测试增强另开包）。
- ~~不回改设计书 §7.1 L554（B-12）；不修 CanvasBoard STEP_LABEL（B-13）~~ 两者均已于 2026-10-15 修复（偏差清单 §2：设计书改口 + STEP_LABEL 对齐八步），修复不在本补录包范围内。
