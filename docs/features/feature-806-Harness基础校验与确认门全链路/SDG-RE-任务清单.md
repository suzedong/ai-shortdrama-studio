# SDG-RE-任务清单 · feature-806 Harness 基础校验与确认门全链路（批一）

> **状态：批一已于 2026-10-28 经用户批准并实施完毕（T1-T9 全绿，真机目验拦截/放行双腿实证，详见变更记录 T/X 节）。批二起另批呈报。**
> 基线参照（2026-10-27 实测）：全量 61 文件 722 passed / 0 failed / 1 skipped；`npx tsc --noEmit` 恰 3 条历史基线；MCP 27 工具 10 族；showrunner 白名单 22。

- [x] **T1 基线冻结**：全量 vitest + typecheck 实测复核上述基线并记录为本包红线；Grep 复核 `harness` 工具面零注册、`CanvasDirty` 五字段现状、「漂移」零命中；登记测试文件净增计划（契约 §5）。
- [x] **T2 K1 字段落地（批准后首动 shared）**：`shared/types.ts` `CanvasDirty` 增 `markedAt?: string`（契约 §1.1）；`electron/brief/impact.ts` 仅标记脏写盘点写入、重复标记刷新；align 清脏随脏对象清除；存量无字段兼容用例先行。
- [x] **T3 harness 校验骨架**：新建 `electron/harness/`（types.ts + validate.ts）——`runHarnessValidation` 纯函数 + 契约 §1.3 七条 checkId 规则（结构/内容/规格/一致性），styleRef 复用 802 style.validate、谱系不可装载降级 warning；只读零写盘、零 LLM 零出网；单测覆盖各规则命中/通过。
- [x] **T4 K8 工具注册**：`electron/mcp/tools.ts` 注册 `harness.validate`（27→28，入参 schema + 只读调用同一 `runHarnessValidation`）；showrunner.md 白名单 22→23 + 校验纪律（发卡前自查、拦截后按 findings 修复重发、不得口头绕过）；其余三 Agent 白名单零 diff。
- [x] **T5 0-final 门联动**：brief.publish / 门批准写盘前前置校验——blocker 拒绝 + 零写盘 + `HARNESS_VALIDATION_FAILED` 携 findings；全过走既有 807 路径；拦截不改门态不产生新版本；GateCardView 校验摘要经既有 gate 通道呈现（`data-gate-harness-findings`，global.d.ts 镜像同步，零新 IPC）；门联动单测循 807 断言模式。
- [x] **T6 B-46 漂移提醒**：新建 `src/studio/canvas/dirty-drift.ts` 纯函数（driftDays / driftReminderLabel，>30 天、null 与未来时间戳口径见契约 §3.2）；脏读黄条三处（CanvasBoard / Stage0View / StudioViewer）+ RealignConfirm 追加不阻塞提醒；组件单测三态显隐。
- [x] **T7 全量回归**：vitest 全量 + typecheck——passed 不减少、skip 不增、failed=0、tsc 恰 3 条零新增；Grep 静态验证工具面恰 28、白名单恰 23、零新 IPC/依赖。
- [x] **T8 真机目验（Electron 实机 + computer-use UIA/CDP）**：①0-final 校验拦截（构造 blocker）与全过放行各走一遍，门卡 findings 上屏；②独立沙箱项目构造 markedAt 旧时间戳（>30 天）→ 黄条与二次确认卡「立项基线已漂移 N 天（不阻塞）」上屏且操作不阻断，目验后沙箱清理、真实项目零污染；③**capture 跨重启持久化补验**：capture.upsert 捕获事实 → 重启应用 → CaptureBar 条数与链态 x/6·x/5 进度保持；逐步截图留证。web.search 成功路径按环境限制登记、不阻塞本项。
- [x] **T9 治理收尾**：变更记录 T/X 节回填；features/README 806 行翻 ✅（批一）；偏差清单 B-46 翻 ✅ 已解决、§3 路线表同步；版本记录增行；设计书/html 镜像如需同步按「md 事实源」规则处理；呈报用户验收。
