# feature-101 故事创作链 · 任务清单 [反向补录]

> 执行依据：[需求规格](./SDG-RE-需求规格.md) + [契约](./SDG-RE-契约.md)。
>
> **本包为[反向补录]**：所有任务在补录前**已由既有代码 / 提示词 / 测试落地**，按下表逐项核对磁盘实况后勾选，并标 [已完成·反向补录]；不虚构未实现的功能（《指令》§7 ④）。补录基线锚点 `c1ee4e9`（2026-10-14）。
>
> **卡口：本包无 K1/K8**——不改 `shared/types.ts`、不新增 MCP 工具/IPC。旧实现期编号（feature-018 故事类型+writer、feature-020 STAGE1 编排）仅作血缘注释保留在 types.ts/showrunner.md，本包不回改编号。

## 0. 上下文加载清单（工作围栏）

- [x] `AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`（§7 六步法）
- [x] [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §4.1（L428–442）、§7.1（L552–599）
- [x] 本包需求规格 / 契约
- [x] [shared/types.ts](../../../shared/types.ts) L156–182、L239、L16–22（只读核对，未改动）
- [x] [resources/opencode/agents/writer.md](../../../resources/opencode/agents/writer.md) 全文
- [x] [resources/opencode/agents/showrunner.md](../../../resources/opencode/agents/showrunner.md) L119–155
- [x] [electron/fs/archive.ts](../../../electron/fs/archive.ts)、[electron/project/manifest.ts](../../../electron/project/manifest.ts) L24–50、[electron/mcp/tools.ts](../../../electron/mcp/tools.ts)（file/canvas/gate/manifest 工具）
- [x] [src/studio/story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts) 全文（6 it）
- [x] [src/studio/StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) OutlineView / ProfilesView

围栏外文件本包零改动（electron 业务模块、preload、main、writer.md/showrunner.md 正文均不改）。

## 1. 原子任务（全部[已完成·反向补录]）

### T1 · 共享类型形状核对 —— [已完成·反向补录]
- 核对（不改）[shared/types.ts](../../../shared/types.ts)：`StoryOutline` L157–168（logline/seasonArc/themes/conflicts/episodes，至少 E01）、`CharacterProfile` L171–182（10 字段、`age:string`、`id` 稳定主键）、产物为 `CharacterProfile[]` 裸数组。
- 结论：与契约 §1 逐字段一致；无需修正代码（六步法③「以文档为准」未触发差异）。

### T2 · writer 提示词落盘纪律核对 —— [已完成·反向补录]
- 核对 [writer.md](../../../resources/opencode/agents/writer.md)：工具白名单恰 5 个（L14–31）；StoryOutline 字段「恰好如下不多不少」+ 禁包裹/禁平行结构（L48–54）；CharacterProfile[] ≥2 角色 + id 主键（L55–59）；MD 镜像不加新事实（L79）；不发门、不派 task（L41）。
- 结论：与契约 §1/§2/§3 一致。

### T3 · showrunner STAGE 1 编排核对 —— [已完成·反向补录]
- 核对 [showrunner.md](../../../resources/opencode/agents/showrunner.md) L141–155：brief.list→file.read 前置校验（缺立项不启动，L146）；1-a 大纲交接物 + `linksTo:['step-0-brief']`（L147）；1-b 小传交接物（input 含大纲）+ ≥2 角色 + id 不重生 + `linksTo:['step-1-outline']`（L148）；两门 payload 摘要（L147–148）；门序固定、rejected 同 id 重开（L153）；目录固定「故事/」、零媒体（L154–155）。
- 结论：与需求 R1–R8、契约 §4 一致。

### T4 · 门 / manifest / 血缘核对 —— [已完成·反向补录]
- 核对：`GateId` 含 `'1-a'|'1-b'`（[types.ts L239](../../../shared/types.ts#L239)）；manifest 事件 `outline-approved`/`profiles-approved` 跃迁（[types.ts L18–19](../../../shared/types.ts#L18-L19)、[manifest.ts L29–30](../../../electron/project/manifest.ts#L29-L30)）；approved 收尾先 done（带 parentReference，fields 取 L125–126 血缘表）再 advance（showrunner.md L148–149）。
- 结论：与契约 S10–S12 一致。

### T5 · 落盘与版本归档核对 —— [已完成·反向补录]
- 核对：双写为两次 `file.write`（非原子，prompt 契约）；覆盖前归档由 [archive.ts](../../../electron/fs/archive.ts) 执行，移入同目录 `版本/<base>.<YYYYMMDD-HHmmss><ext>`，归档失败抛错阻断；区别于立项单 `立项单.vN.json` 版本化。
- 结论：与契约 S6–S8 一致。

### T6 · 契约测试核对 —— [已完成·反向补录]
- 核对 [story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts) 6 it：门序/委派/路径、rejected 重开、linksTo、零媒体、缺 brief 不启动、恢复续跑；全量基线 35 文件 369 passed / 0 failed / 1 skipped。
- 缺口（如实登记，不在本包补）：fake showrunner 未模拟 done 的 parentReference、未断言 manifest.advance（已写入契约 §6 与变更记录）。

### T7 · 渲染端核对（零改动）—— [已完成·反向补录]
- 核对 [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx)：`OutlineView`（约 L143–185）渲染 StoryOutline，`ProfilesView`（约 L305–317）渲染 CharacterProfile[]；CanvasBoard KIND_LABEL 含 outline/profiles（L172–173）。
- 结论：既有渲染满足查看需求，本包不做 UI 改动（设计说明 §1）。

### T8 · 治理文档收尾 —— [已完成·反向补录]
- [features/README.md](../../README.md) 1xx 行状态由「⬜ 待反向补录」改为已补录并加本包链接。
- [设计现状与偏差清单.md](../../设计现状与偏差清单.md) §3 P1 行勾选；B-12 / B-13 在本包补录中登记（见变更记录 R-101-1，偏差清单 §2 追加行）。
- [版本记录.md](../../../版本记录.md) 追加 101/201 反向补录条目。

## 2. 产出物清单

| 产出 | 位置 | 状态 |
|---|---|---|
| 需求规格 / 契约 / 任务清单 / 设计说明 / 变更记录 | 本包 5 文件 | ✅ 本次新建（反向补录） |
| 共享类型 StoryOutline / CharacterProfile | [shared/types.ts](../../../shared/types.ts) L156–182 | ✅ 既有（本包零改动） |
| 编剧提示词 | [writer.md](../../../resources/opencode/agents/writer.md) | ✅ 既有（零改动） |
| 主控 STAGE 1 编排 | [showrunner.md](../../../resources/opencode/agents/showrunner.md) L141–155 | ✅ 既有（零改动） |
| 编排契约测试 | [story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts) 6 it | ✅ 既有（零改动） |
| 渲染 | StudioViewer OutlineView/ProfilesView、CanvasBoard 标签 | ✅ 既有（零改动） |

## 3. 不做（防止越界）

- 不改任何生产代码、提示词、共享类型、测试；不新增 electron 模块 / MCP 工具 / IPC。
- 不补 parentReference / manifest.advance 的 STAGE 1 测试断言（属测试增强，超出反向补录范围；如需要另开包）。
- ~~不回改设计书 §7.1 L554 门模型表述（B-12 仅登记）~~ B-12/B-13 均已于 2026-10-15 修复（偏差清单 §2），修复不在本补录包范围内。
- 不实现分场 / 台词 / 分镜（feature-201）。
