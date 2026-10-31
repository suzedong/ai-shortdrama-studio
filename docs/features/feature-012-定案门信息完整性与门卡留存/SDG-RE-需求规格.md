# SDG-RE-需求规格 · feature-012 定案门信息完整性与门卡留存

> **包号**：feature-012（0xx STAGE 0 立项段）
> **业务名**：定案门信息完整性与门卡留存——①再版定案门「拍板前展示影响产物清单」（修正现状顺序倒置）；②approved 门卡 findings 留存真机挂载（806 翻案项）
> **性质**：**K1 条件触发**——仅当留存挂载裁决方案 A（canvas.json gate 快照入 ChatMessage）时触 shared/types.ts；推荐方案 B（Stage0View 放行 approved 门卡）零 K1，门 payload 增键不触 K1（`CanvasGate.payload?: unknown`，[types.ts](../../../shared/types.ts) L393-399）；**K8 目标零触发**——零新工具为零 diff 红线（impact.assess 为 002 既有工具），如实施发现确需新工具立即停手呈报；**K9 零触发**（零新依赖）；零新 IPC
> **事实源**：《短剧Agent平台设计.md》§2.6.5 L252-256（定案卡信息构成：跨版本改动提示 + 影响产物清单拍板前可见）、§2.6.7 L310-366（影响评估机制 / 影响清单留底 / Harness 校验补充）、§0.1 原则 6（D-016 系统优先）
> **前置**：feature-001（0-final 单定案门）、feature-002（影响评估 assess/commit + 三选一）、feature-806（harness 拦截链 + 门卡 findings 组件）、feature-807（口头拍板约束 + 门态防护 guard）、feature-010（GateHint 拍板提示）、feature-808（会话回放）
> **溯源标签**：[Design 原有]（§2.6.5 设计内功能补全：拍板前门卡同列改动+影响清单；approved 门卡信息面回看）
> **翻案登记**：806 [SDG-AI-变更记录.md](../feature-806-Harness基础校验与确认门全链路/SDG-AI-变更记录.md) X 节 2026-10-28「approved 门卡 findings 上屏真机无挂载点……登记偏差继续」条目，本包 §2 正式翻案呈报
> **日期**：2026-10-28

## 1. 背景

设计书 §2.6.5（L255）明文：定案卡中**显式列出「相对上一版本的改动」与「影响产物清单」**（见 §2.6.7），让用户在**拍板前**就看到下游代价；§2.6.7 L329-348 给出影响评估面板形态（改动字段 + 影响产物清单 + 三选一）。806 批一落地了 harness 校验与门卡 findings 上屏组件，但真机走查暴露两个设计内缺口，2026-10-28 用户拍板分包方案，本包为其一。

代码实证（2026-10-28 复核）：

- **问题一 · 再版顺序倒置**：[showrunner.md](../../../resources/opencode/agents/showrunner.md) L132 定案门 payload 仅 `version / pendingMarks / changesFromPrevious` 三键、**无影响产物清单**；L153-155 再版六步 = 第 3 步用户拍板（门/口头取得发布授权）→ 第 4 步才调 `brief.impact.assess` 呈报影响产物 → 第 5 步三选一 commit。即**拍板在前、影响呈报在后**，与 §2.6.5「拍板前看到下游代价」顺序倒置；门卡信息面缺「影响产物清单」一区。
- **问题二 · approved 门卡留存无挂载点**：[GateCardView.tsx](../../../src/studio/chat/GateCardView.tsx) L71-108 已有 approved 态渲染（含 806 落地的 harness findings 块 L86-105，`data-gate-harness-findings`），但全仓唯一挂载点 [ChatComposer.tsx](../../../src/studio/chat/ChatComposer.tsx) L725-728 / L743-748 仅渲染 `pendingGate`；[StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx) L84 `pendingGate = canvas.gates.find(status==='pending')`，L367-378 handleDecide 批准后经画布订阅重算、门离开 pending 即卸卡；[Stage0View.tsx](../../../src/studio/stage0/Stage0View.tsx) L193 / L485 两处 `status !== 'approved'` 显式排除 approved 门；[types.ts](../../../shared/types.ts) L291-301 ChatMessage 无 gate 快照字段、src 全仓无 `kind:'gate'` 消息生产者；[history-replay.ts](../../../src/lib/history-replay.ts) 仅映射 text parts，808 会话回放不渲染门卡。结果：806 交付的 approved 态 findings 展示面在真机**悬空**（无挂载点），拍板后用户无法回看门卡信息面。
- **翻案登记在案**：806 变更记录 X 节 2026-10-28 条目已登记用户拍板「登记偏差继续（暂不新增挂载点）」及候选改进（canvas.json gate 快照入 ChatMessage、Stage0View 放行 approved 门卡）——本包 §2 正式翻案。
- **计数基线（2026-10-28 实测）**：MCP 28 工具（`server.tool(` 计 28 处，806 后含 harness 族）；showrunner 白名单 23（showrunner.md L16-38）；全量 vitest **66 文件 761 passed / 0 failed / 1 skipped**；`npx tsc --noEmit` **恰 3 条**（canvas-zoom.test.tsx 2 + runtime-client.test.ts 1——构成与 806 T1 记录不同，以本实测为准）。

**原则对齐（D-016 系统优先）**：影响清单生成 = 002 既有 `brief.impact.assess` 确定性追溯算法（规则可枚举 = 系统侧既有工具）；门卡渲染与 approved 留存均为系统直做 UI 挂载；本包零新 LLM 判定，Agent 仅按改写后的再版纪律在拍板前调既有工具取数。

## 2. 翻案呈报（806 X 节「登记偏差继续」）

| 项 | 内容 |
|---|---|
| 原拍板 | 2026-10-28（806 T8 真机目验期）：「approved 门卡 findings 上屏」真机无挂载点，经呈报用户拍板**「登记偏差继续」**——以组件单测三态 + 拦截回流截图 + 门 payload 实证组合留证，806 不新增挂载点；候选改进（未采纳）：① canvas.json gate 快照入 ChatMessage；② Stage0View 放行 approved 门卡 |
| 翻案理由 | ①本包问题一要求**拍板前**门卡同列改动+影响清单——门卡信息面变重后，approved 后无法回看的代价同步放大（拍板依据事后不可追溯，与 §2.6.5 历史回溯意图、002 影响清单留底同向）；②806 已交付的 approved 态 findings 渲染面持续悬空，组件代码存在而真机不可见，属设计内展示面缺口；③两候选改进当时已登记、均有现成落点，翻案成本低 |
| 新方案 | 正式立项本包，按 §6 决策点 D-c 三选一呈报挂载方案（推荐方案 B：Stage0View 放行 approved 门卡）；**用户批准本包规格即视为完成翻案**，806 X 节条目于本包实施收尾时加修订注闭环（指向本包） |
| 翻案落地（2026-10-28） | 用户批准按方案 B 实施，**翻案已完成**：`Stage0View` 新增 `GateRetentionCard` 分流（approved → 既有 `GateCardView` 留存卡，pending/rejected → 原镜像条），两挂载点（EmptyStage0 / PublishedBody）放行；806 变更记录 X 节已追加翻案修订注（指向本包 T4/T8），原「登记偏差继续」状态改判为「已由 012 关闭」 |

## 3. 目标

1. 再版定案门恢复设计顺序：`impact.assess` 前置 → 门卡**同列** `changesFromPrevious`（相对上版改动）+ 影响产物清单（节点/命中字段/severity/defaultAction 摘要）→ 用户拍板 → commit/publish 落盘；
2. 口头拍板两前提（807）同步升级：「完整定案卡已展示」的定义扩为**含影响清单**，其余约束（quote 逐字、版本绑定、信封码）零回归；
3. approved 门卡（含 findings 与影响清单信息面）在真机有可回看挂载点，806 展示面悬空闭环；
4. 零新 MCP 工具、零新 IPC、零新依赖；806/807/002 既有链路零回归。

## 4. 范围与排除项

### 4.1 做

1. showrunner.md 再版流程纪律改写：影响评估前置到发门之前，门 payload 增影响摘要键，口头拍板两前提同步（改写范围以契约 §4 白名单为限）；
2. GateCardView 门卡信息架构扩展：再版门卡呈现「改动区 + 影响清单区」（与 806 findings 区并存），走既有 gate 通道 payload（`unknown` 形状内增键，不动 shared）；
3. approved 门卡留存挂载（按 §6 D-c 裁决方案实施，推荐方案 B：Stage0View 放行 approved 门卡渲染）；
4. 测试：门卡信息架构组件单测 + 留存挂载组件单测 + 807/806/002 回归组 + 全量回归 + 真机目验；
5. 治理收尾：变更记录 T/X 回填、features/README 012 行、806 X 节翻案修订注、版本记录增行。

### 4.2 不做（显式排除）

- 影响评估面板全量 UI（§2.6.7 面板草图，002 既定排除项，不翻案——本包只做门卡信息面，不做独立面板）；
- 首版（v1）门流程零行为变化（首版无基线、无影响产物，`BRIEF_NO_BASELINE` 语义不变）；
- 门序扩展（1-a/1-b、2-a~2-c、3-7 门，806 批二起另批呈报）；§9 知识库与多轮深度校验不做；
- 既有 28 个 MCP 工具实现零行为变化目标；writer / media-director / comfyui-operator 白名单不动；showrunner 白名单 23 不动（零新工具）；
- 808 回放渲染门卡**维持现状不扩**（留存挂载不等于回放复现；方案 A 的完整回放语义若用户裁决，则仅按裁决范围实施并另行评估回放面）；
- 零新 IPC、零新推送、零新依赖；ComfyUI 媒体链（803）不触碰。

## 5. 功能点

| # | 功能点 | 说明 |
|---|---|---|
| F1 | 再版影响评估前置 | showrunner 再版剧本改为：改草案 → 就绪自检 → **impact.assess 预评估** → 发门（payload 携 changesFromPrevious + 影响摘要）→ 拍板 → commit；commit 既有「工具复算影响清单、decisions 与复算 items 恰一致」（IMPACT_DECISION_MISMATCH）语义不变——前置呈报是取数展示，复算兜底不动 |
| F2 | 门卡影响清单区 | 再版门卡在改动区之外新增影响产物清单区（severity 分级标签 + 默认动作摘要）；数据来源 = 门 payload 既有通道增键（806 harnessValidation 同通道先例），renderer 不自拉数据 |
| F3 | 口头拍板前提升级 | 807 两前提中「完整定案卡」定义扩为含影响清单；信封码组（BRIEF_GATE_PENDING / REJECTED / APPROVED_USE_GATE / VERSION_MISMATCH）与版本绑定零回归 |
| F4 | approved 门卡留存挂载 | 按 D-c 裁决：推荐 Stage0View 两处 `!== 'approved'` 排除改为放行 approved 门卡（复用 GateCardView approved 态既有渲染）；806 findings 块随留存卡真机可见 |
| F5 | 回归红线 | 807 信封码组 + 806 HARNESS_VALIDATION_FAILED 拦截链 + 002 impact 三码零回归；全量基线不恶化 |

## 6. 决策点（候选 + 推荐，批准规格即裁决）

### D-a 影响产物清单入门方式

| 候选 | 内容 | 评估 |
|---|---|---|
| **A1（推荐）** | showrunner 发门前调既有 `brief.impact.assess` 取数，摘要经**既有 gate payload 增键**（如 `impactSummary`）随门卡上屏 | `CanvasGate.payload?: unknown`（types.ts L398），payload 内容增键**不改 shared 形状、不触 K1**；循 806 `harnessValidation` 键同通道先例；零新 IPC、零新工具 |
| A2 | 门卡渲染时 renderer 实时拉取 impact.assess 结果（系统直做） | renderer 不直连 MCP 工具（renderer 不直连引擎红线同构），须新 IPC → 违零新 IPC 红线；且门卡数据应 = 拍板时快照，实时拉取会随后续改动漂移、拍板依据失真。**不推荐** |

> 兼容核查：807 `assertBriefPublishable`（[guard.ts](../../../electron/gate/guard.ts) L35+）只读门 status 与 `payload.version` 比对，payload 增键不影响判定；806 拦截链（[tools.ts](../../../electron/mcp/tools.ts) L435-470）只读写 `harnessValidation` 键、`CONSIST_GATE_PAYLOAD_VERSION` 只比版本——增键与两链路兼容，须以回归组实证。

### D-b 再版流程新顺序

| 候选 | 内容 | 评估 |
|---|---|---|
| **B1（推荐）** | impact.assess 前置到发门之前 → 门卡同列改动+影响清单 → 拍板 → commit（复算兜底不变）；807 口头拍板「完整定案卡」定义同步扩为含影响清单 | 恢复 §2.6.5 设计顺序；纯提示词纪律改写 + 门卡渲染扩展，主进程工具零行为变化；执行顺序关系：harness 校验仍在 commit/publish 写盘前（806 拦截不变），门态防护不变 |
| B2 | 维持现状顺序，仅门卡补影响区 | 拍板在前、呈报在后的倒置未修正，补卡面不能让用户拍板前看到清单——不满足 §2.6.5。**不可行** |

showrunner.md 纪律改写范围（B1 下）：再版六步第 3/4/5 步顺序与表述、第 0 步 L132 payload 键说明（增影响摘要键口径）、口头拍板两前提段（L136）「完整定案卡」定义；其余纪律零 diff。

### D-c approved 门卡留存挂载（806 翻案三选一）

| 候选 | 内容 | K 卡口 | 评估 |
|---|---|---|---|
| A | canvas.json gate 快照入 ChatMessage 消息流（回放可复现） | **触 K1**（ChatMessage/MessageKind 改动，标红呈报）+ 808 回放链路改造 | 语义最全（回放可复现），但面最大：shared 类型 + 消息生产者 + 回放映射三处改动；留存诉求 ≠ 必须进消息流 |
| **B（推荐）** | Stage0View 放行 approved 门卡渲染（L193/L485 两处排除改放行，复用 GateCardView approved 态） | 零 K1 / 零 K8 | 最小 diff；approved 门本就持久化在 canvas.json `gates[]`（bridge.ts 不删门），数据面零改动；806 findings 展示面直接闭环；代价：808 回放仍不渲染门卡（维持现状登记） |
| C | 独立门历史面板 | 零 K1，但新 UI 面 | 新面板违背最小 diff；008 链态条已有 🚪 状态镜像入口，另起面板重复造面。**不推荐**（可作后续演进） |

### D-d D-016 判定

影响清单生成 = 002 既有 `impact.assess` 确定性追溯算法（规则可枚举 → 系统侧）；门卡渲染与留存挂载 = 系统直做 UI；本包零新 LLM 判定面，Agent 仅按改写后纪律调用既有工具——符合 D-016。

### D-e 0-final 再版门的 approved 重开规则（2026-10-31 真机 AC6 暴露缺陷后补录）

| 候选 | 内容 | 评估 |
|---|---|---|
| **E1（推荐，已批准）** | `0-final` 门 approved 后，仅当新请求 `payload.version`（候选版本）严格大于旧门 `payload.version`（已批准版本）时，允许以同一 gateId 覆盖重开为 pending；同版本 / 新版本不更高 / 版本不可解析 → 仍 `INVALID_ARGUMENT`；非 0-final 门 approved 一律不可重开 | 恢复 AC6 再版全链路；保留「一张门只授权一版」防护；复用 guard.ts `gateVersion` 解析，不改 shared 形状，零 K1/K8 |
| E2 | 每版新建一个 gateId（如 `0-final-v3`） | 破坏「STAGE 0 唯一 0-final 门」设计（feature-001），下游 guard / Stage0View / showrunner 均按固定 `0-final` 取门，扩散面大。**不推荐** |
| E3 | 再版前由 Agent 删除旧 approved 门再发新门 | approved 门是拍板留痕，删除破坏可追溯；且 Agent 无删门工具。**不可行** |

> 实现落点：[bridge.ts](../../../electron/gate/bridge.ts) `initializeEntry` approved 分支；兼容核查：guard.ts `assertBriefPublishable` 已有 `gv !== publishVersion → VERSION_MISMATCH`，重开后新门绑定新版本，commit 时版本一致即放行，零行为变化。

## 7. K 卡口识别

| 卡口 | 结论 |
|---|---|
| **K1** | 条件触发：仅 D-c 裁决方案 A 时触 shared/types.ts（ChatMessage/MessageKind）→ **标红呈报**；推荐方案 B + D-a 候选 A1 下零 K1（门 payload 增键不改 shared 形状） |
| **K8** | **目标零触发**：零新 MCP 工具（impact.assess 为 002 既有）、零新 IPC 为红线；实施中如确需新工具/新 IPC → 立即停手呈报，不得私开 |
| **K9** | 零触发（零新依赖） |
| 其他 | 不动 AGENTS.md/卡口清单（K7 零）；无新实体（K4 零）；不动术语表（K5 零）；无旧系统弃用（K3 零） |

## 8. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | 再版新顺序：showrunner.md 再版纪律为 assess 前置 → 发门携影响摘要 → 拍板 → commit；首版流程零 diff；807 两前提定义同步 | 静态评审 + 真机 |
| AC2 | 门卡信息架构：再版门卡同列 changesFromPrevious 改动区 + 影响清单区（severity 分级 + 默认动作）；806 findings 区行为不变；数据全部来自门 payload | 组件单测 |
| AC3 | 留存挂载：按 D-c 裁决方案，approved 门卡（含 findings 块）真机可回看；pending/rejected 既有行为零回归 | 组件单测 + 真机 |
| AC4 | 工具面红线：MCP 工具恰 28、showrunner 白名单恰 23、零新 IPC、零新依赖；K1 按裁决结论核验（方案 B 下 shared 零 diff） | 静态验证 |
| AC5 | 回归红线：`npx tsc --noEmit` 恰 3 条基线零新增；全量以 T1 实测基线（66 文件 761 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、failed=0；807 信封码组 + 806 HARNESS_VALIDATION_FAILED 链路 + 002 impact 三码回归组全绿 | 全量回归 |
| AC6 | 真机（Electron 实机 + computer-use UIA/CDP）：沙箱项目走一遍再版新顺序——assess 前置 → 同一 `0-final` 门为新版本覆盖重开（旧 approved 门被新版 pending 覆盖，D-e E1）→ 门卡拍板前可见改动+影响清单 → 拍板 → commit 成功（v(N+1) 双写 + 影响清单留底 + 下游挂脏）；approved 门卡留存可见、findings 块上屏；目验后沙箱清理、真实项目零污染 | 真机 |
