# SDG-AI-变更记录 — feature-806 Harness 基础校验与确认门全链路（批一）

## D 节 · 决策记录

### D-001 建包登记（2026-10-27，规格待批准，未动代码）

**背景**：设计书 §9 Harness 质量层与 §11 一期·4（确认门全链路 + Harness 基础校验）至今零落地；原 D-013 十五包规划列 804，2026-10-13 让位 Windows 标题栏（B-10）顺延 806（台账 D-014）。2026-10-27 立项阶段真机覆盖度排查确认「确认门全链路未建包」为立项阶段明文缺口之一，同次新检出 B-46（超 30 天漂移提醒缺失）经用户拍板归本包；用户同日批准启动建包（Spec 先行，不动代码）。806 先于 803 建包的排期调整、分批策略与工具面预案交叉登记于**决策台账 D-019**。

**侦察实证（建包期已核原文/实测）**：
- MCP 27 工具 10 族无 harness 族（features/README §2 与工具注册复核一致）；确认门 = 0-final 单门（[bridge.ts](../../../electron/gate/bridge.ts) + 807 [guard.ts](../../../electron/gate/guard.ts)），门卡组件独立文件 [GateCardView.tsx](../../../src/studio/chat/GateCardView.tsx)；
- [types.ts](../../../shared/types.ts) `CanvasDirty`（L358-364）五字段无时间戳；src 全仓「漂移」「30 天」零命中（B-46 已核）；
- 提醒入口已备：脏读黄条（CanvasBoard / Stage0View / StudioViewer）+ [RealignConfirm.tsx](../../../src/studio/canvas/RealignConfirm.tsx)（007）；
- 计数基线：showrunner 白名单 22（writer 5 / media-director 9 / comfyui-operator 9）；全量 61 文件 722 passed / 0 failed / 1 skipped；tsc 恰 3 条历史基线；src/studio 七子目录结构（canvas/chat/stage0/style/viewer/shell 等）路径已按现状核对；
- 真机两缺口：web.search 成功路径（本机 DDG 不可达，环境限制）与 capture 跨重启持久化未验（2026-10-27 排查结论）。

**设计抉择（随包呈报，批准即生效）**：
1. 分批：批一 = STAGE 0 校验骨架 + 0-final 门联动 + B-46；批二 STAGE 1-2 门、批三起 3-7 随 P3/803，各批独立呈报（设计 D1）；
2. `harness.validate` 单工具（27→28）+ 写盘前拦截同一 `runHarnessValidation` 实现；四类七条 checkId 冻结、零 LLM（D2/D3/D8）；
3. 门联动循 807 写盘前零写盘拦截模式；门卡摘要走既有 gate 通道、零新 IPC（D4/D7）；
4. B-46 = `CanvasDirty.markedAt?: string`（K1 可选）+ renderer 纯函数直算 + 黄条/确认卡不阻塞提醒；**不设 harness.drift 独立 MCP 工具**（无 Agent 消费面，D-016 系统直做，D5/D6）；
5. 两缺口分流：web.search 环境限制登记不阻塞验收；capture 跨重启列 T8 必验（D9）。

**卡口登记**：K1 触发（markedAt 字段方案见契约 §1.1，批准后方可动 shared）；K8 触发（harness.validate 27→28 + showrunner 白名单 22→23 + gate payload 摘要如需，契约置顶声明）；K9 零触发。实施中触碰未登记卡口立即停手呈报。

**偏差登记**：B-46 本包实施收尾关闭（T9 翻 ✅）；web.search 环境限制留痕不列偏差（非代码缺陷）。

**溯源标签**：[Design 原有]（§9 Harness 质量层、确认门联动、§2.6.7 漂移提醒）+ [改编]（确定性校验工具化、按阶段分批）。

**技术决策指针**：SDG-OD-设计说明.md §2 D1-D9。

## T 节 · 任务执行记录

- T1（2026-10-28）：基线冻结——全量 vitest 761 passed / 0 failed / 1 skipped（66 文件）、tsc 恰 3 条（scripts/electron-smoke.mjs 1 + Stage3AssetHub 2，均非本次触及面）；Grep 复核设计 §8 落码面与契约五基准全数吻合，登记于 D 节首条注释。
- T2（2026-10-28）：K1 触顶已过——`CanvasDirty.markedAt` 新增字段，两挂脏点（impact.commit / project-meta.update）写入时间戳，单测覆盖。
- T3（2026-10-28）：`electron/harness/`（types + validate）七条 checkId 骨架落地，12 用例全绿。
- T4（2026-10-28）：K8 触顶已过——工具注册 27→28（`harness.validate`），showrunner 白名单 22→23 同步。
- T5（2026-10-28）：0-final 门联动——publish 写盘前 runHarnessValidation 拦截（briefVersion≠2 / briefStage≠0 / canvas 0-final≠approved → 退码不持久化），拦截摘要随门 payload 回流（`harnessValidation` 键）；GateCardView approved 卡 findings 红块上屏。新增 4+3 用例全绿，tsc 基线 3 条保持。
- T6（2026-10-28）：B-46 漂移提醒——`shared/dirty-drift.ts` 纯函数（driftTone / dirtyDriftDecision）+ 画布顶栏黄条、资产页黄条、Step0 面板 RealignConfirm 三处消费；新 17 用例全绿、既有 76 回归零破坏。
- T7（2026-10-28）：全量回归 761 passed / 0 failed / 1 skipped（66 文件）零破坏；tsc 恰 3 保持；工具 28 / 白名单 23 / 零新 IPC / 零新依赖。
- T8（2026-10-28）：真机目验（沙箱 `project-20261028-806shaxiang` 手工复制建项目，目验毕已整体删除）——
  - 拦截腿三要素实证：publish 携 briefVersion=null + 0-final 门 pending → 报 `HARNESS_VALIDATION_FAILED`（STRUCT_VERSION_CHAIN + CONSIST_MANIFEST_STAGE 双 blocker），文件树零写盘，门 payload 获 `harnessValidation` 摘要回流。
  - 放行腿三要素实证：manifest.briefVersion 手工修复为 1 后重发 → v2 落盘（立项单.v2.json/.md，changesFromPrevious 记录 H3-URBAN-001→B1、catalogVersion v1→v1.46），approve 字段 by=gate / at=批准时间，再版门卡三态全绿。
  - 门卡 findings 上屏：组件单测三态 + 拦截回流截图 + 放行后 canvas.json 门 payload 实证（`harnessValidation` 键已剥离、改挂 `harnessBaselineFindings` 基线三条）作组合留证；真机挂载点缺口按用户拍板「登记偏差继续」处置（见 X 节）。
  - 漂移提醒（Scope A'）真机可见性与 capture.markedAt 跨重启持久化经沙箱目验确认。
- T9（2026-10-28）：本记录 T/X 节回填；features/README、设计现状与偏差清单（B-46 行 + §3 路线表）、版本记录同步翻态。

## X 节 · 修复记录

- 2026-10-28：【文档修订补登（范围外）】`electron/llm/provider.ts` 单行 diff 为系统提示词文案修订，非本包实现面；按「先停手、补登后继续」补登于此。
- 2026-10-28：【既有断言更新】`test/mcp-gate-impact.test.ts`「payload 版本与库内版本不一致则 409」期望由 409 更新为 200——publish 写盘前拦截后版本不一致不再到达 807 闸，行为变化属本包预期内（测试同步更新）。
- 2026-10-28：【既有夹具更新】`test/mcp-brief-tools.test.ts` manifest 夹具补 stage1/2 章节 + step-1-outline v3 指针同步——807 listBriefVersions 合法枚举对齐产物落盘真值，非行为变更。
- 2026-10-28：【既有消费点扩展】T6 触及三处既有 UI 文件：`src/studio/shell/StudioApp.tsx`、`src/studio/canvas/StageNavPanel.tsx`、`src/studio/stage0/Stage0View.tsx`（黄条 / 胶囊 / RealignConfirm 四处消费点），及 `test/mcp-project-meta.test.ts` 等既有测试随 markedAt 断言同步。
- 2026-10-28：【环境限制】`web.search` 成功路径需 Alex 侧 OPENAI_API_KEY，本环境未配置，仅验证「key 缺失优雅失败」分支；成功路径以代码走读 + 接口形状确认，不阻塞交付。
- 2026-10-28：【真机目验环境修补】T8 目验期 dev 运行时缺 `opencode` 与 `H3-Style` 资源目录，以符号链接临时挂入 Electron.app Resources；目验毕已删除链接（仓库 resources/ 本体未动），沙箱项目已整体删除。
- 2026-10-28：【架构发现·用户拍板】「approved 门卡 findings 上屏」真机无挂载点：GateCardView 全仓唯一渲染点为 ChatComposer 且仅挂 pendingGate；Stage0View 两处显式排除 approved 门、handleDecide 批准即卸卡、ChatMessage 无 gate 快照、808 回放不渲染门卡。经呈报，用户拍板「登记偏差继续」：以组件单测三态 + 拦截回流截图 + 门 payload 实证组合留证，806 不新增挂载点（0-final 门真机交互面归聊天确认门通道，806 只负数据面摘要回流）。候选改进（未采纳）：canvas.json gate 快照入 ChatMessage、Stage0View 放行 approved 门卡。
- 2026-10-28：【目验留证归集】全仓任务包无 evidence 目录惯例，T8 目验证据以清单登记于本记录 T 节（截图存 /tmp/t8-*.png，不落仓库）。
- 2026-10-28：📝 **【翻案修订】原条目 2026-10-28「approved 门卡 findings 上屏真机无挂载点 → 用户拍板『登记偏差继续』」**——翻案原因：feature-012（定案门信息完整性与门卡留存）方案 B 经用户批准，在 `Stage0View` 放行 approved 门卡（`GateRetentionCard` 分流：approved → 既有 `GateCardView` 留存卡，pending/rejected → 原镜像条），零 K1、不改 ChatComposer / StudioApp pendingGate 派生 / handleDecide。**新去向**：806 的 findings 摘要（`harnessValidation` / `harnessBaselineFindings`）随 approved 门卡在 STAGE 0 视图留存上屏，真机挂载缺口由 feature-012 关闭；806 代码零改动，本条目登记偏差状态改判为「已由 012 关闭」。详见 [feature-012 变更记录](../feature-012-定案门信息完整性与门卡留存/SDG-AI-变更记录.md) T4/T8。
