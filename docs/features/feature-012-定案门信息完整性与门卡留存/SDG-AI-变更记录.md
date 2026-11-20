> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# SDG-AI-变更记录 — feature-012 定案门信息完整性与门卡留存

> 变更记录三分类（通用指令 §2）：**D 决策**（建包/翻案/放行等用户拍板）、**T 实施**（任务清单工序回填）、**X 修订**（规格自身修订注）。本包当前仅完成建包登记，T/X 节留占位待实施期回填。

## D 节 · 决策登记

| 日期 | 决策 | 依据 / 说明 |
| :-- | :-- | :-- |
| 2026-10-28 | **建包登记**：新建任务包 feature-012「定案门信息完整性与门卡留存」，溯源 **[Design 原有]**（事实源：短剧Agent平台设计.md §2.6.5 L252-256 拍板前同列可见 + §2.6.7 影响清单留底 L363-366） | 用户于 2026-10-28 拍板三包分包方案，本包为其中一包；业务 = ①再版定案门「拍板前展示影响产物清单」（修正现状顺序倒置：showrunner.md L153-155 第 3 步拍板先于第 4 步 assess 呈报）＋ ②approved 门卡 findings 留存真机挂载（翻案项，呈报见需求规格 §2，翻案对象 = 806 本文件 X 节 2026-10-28 条目） |
| 2026-10-28 | **规格待批准（历史，已由下一行「实施放行」取代）**：本包五文件（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录）已建立；契约按推荐方案撰写（D-a=A1 门 payload 增键 / D-b=B1 assess 前置 / D-c=B Stage0View 放行） | 铁律 1（No Spec, No Code）：用户批准本规格并在本节补登「实施放行」前，任务清单 T1-T9 一律不得动手；若裁决偏离推荐方案，须先修订契约与本记录再实施 |
| 2026-10-28 | **实施放行**：用户批准本包规格，决策点按推荐方案裁决——D-a=A1（门 payload 增 `impactSummary` 键，不触 K1）/ D-b=B1（`impact.assess` 前置到发门前）/ D-c=B（Stage0View 放行 approved 门卡，零 K1，806 翻案成立）/ D-d=全系统直做；T1 起可动代码 | 用户原话「好的，按推荐方案开始实施 011、012、013 的三包范围」；三项决策落地值同批登记决策台账 **D-020** |
| 2026-10-31 | **D-e 0-final 版本化重开（真机 AC6 缺陷修复放行）**：真机 PK-012-02 暴露 `0-final` 门 approved 后无法为下一版重开（bridge.ts 对所有 approved 门一律 INVALID_ARGUMENT），阻塞再版全链路。用户批准方案 E1：仅 `0-final` 且新 `payload.version` 严格大于旧门版本时，允许同一 gateId 覆盖重开为 pending；同版本 / 新版本不更高 / 版本不可解析 / 非 0-final 门仍拒绝。零 K1（复用 guard.ts gateVersion，不改 shared）/ 零 K8（零新工具 IPC） | 真机首跑实证缺陷后呈报，用户拍板「批准版本化重开（推荐）」；落地见 T10 |

## T 节 · 实施回填

| 工序 | 日期 | 实施与测试 | 验收 |
| :-- | :-- | :-- | :-- |
| T1 | 2026-10-28 | 基线冻结：66 文件 **761 passed / 0 failed / 1 skipped**；tsc 恰 **3 条**（canvas-zoom.test.tsx 2 + runtime-client.test.ts 1）；`server.tool(` **28**；showrunner 白名单 **23**；需求规格 §1.2 行号证据逐条命中 | 四项基线一致，无漂移 |
| T2 | 2026-10-28 | `resources/opencode/agents/showrunner.md` 四处改写：① L107 新增「挂门即停」（再版同样适用）；② L133 payload 说明增第 4 键 `impactSummary`（键定义以契约为准）；③ L137 口头拍板前提①扩为「六要素 + 前提 5 项 + 风格 ID@版本 + 待定点 + 相对上版改动；再版另须含影响产物清单」；④ L153-155 再版六步重排为「③预评估取数 → ④发再版定案门（改动区与影响清单同列、挂门即停）→ ⑤用户三选一 + commit」；白名单 23 零 diff | `grep` 白名单仍 23；步骤顺序与契约 §3.3.c 一致 |
| T3 | 2026-10-28 | `src/studio/chat/GateCardView.tsx` +72 行：新增 `impactSummaryOf` 安全解析（缺键/非法形状/空清单一律 null）与 `ImpactSummaryBlock`（`data-gate-impact-summary` / `data-gate-impact-counts` / `data-gate-impact-item` / `data-gate-impact-source`），approved / pending / rejected 三态插入；`src/global.d.ts` 增 `ImpactSummaryItemDto` / `ImpactSummaryDto` 镜像类型（K1 零触发，`shared/types.ts` 零 diff） | tsc 零新增；带/不带键渲染分流 |
| T4 | 2026-10-28 | `src/studio/stage0/Stage0View.tsx`：新增 `GateRetentionCard` 分流——approved → 既有 `GateCardView`（`deciding=false`、`onDecide` 空操作）留存卡，pending/rejected → 原镜像条；`EmptyStage0` 与 `PublishedBody` 两挂载点统一放行（实况 L196 / L623）；不改 ChatComposer / StudioApp pendingGate 派生 / handleDecide | approved 门卡含影响区 + 806 findings 区同屏；pending 交互不受影响 |
| T5 | 2026-10-28 | 新建 `src/studio/chat/gate-impact-summary.test.tsx`（6 例）与 `src/studio/stage0/stage0-gate-retention.test.tsx`（6 例），覆盖契约 §5 组 a/b 全用例；回归组五套件 **78 passed**（gate-guard 23 / mcp-brief-harness-gate 4 / brief-impact 24 / history-replay 9 / chat-runtime 18） | 新增 12 例全绿；回归组通过数与基线一致 |
| T6 | 2026-10-28 | 全量 `npx vitest run`：**70 文件 821 passed / 0 failed / 1 skipped**；`npx tsc --noEmit` 恰 3 条（构成不变） | 净增 2 文件 / 12 例，零破坏 |
| T7 | 2026-10-28 | 真机目验**受限降级**：本包验收面（再版门 payload 注入 + approved 留存卡）需 Electron 沙箱项目与 Agent 运行时，本环境未执行，不臆造通过；以组件三态单测 + payload 安全解析用例 + 代码走读替代留证。Electron 沙箱目验列入遗留项，与 011 / 013 一并待用户真机验收 | AC1-AC6 自动化覆盖达成；AC1/AC3/AC6 真机项遗留 |
| T8 | 2026-10-28 | 治理收尾：`docs/features/README.md` 012 行翻态（格式对齐 806/807/808）；806 变更记录 X 节追加翻案修订注（原条目日期 2026-10-28 / 原因 = 012 方案 B 放行 approved 门卡 / 新去向 = Stage0View 留存上屏）；需求规格 §2 翻案指针注明「已落地」 | 806 X 注三要素齐全；README 行格式一致 |
| T9 | 2026-10-28 | 版本记录补 v1.7.1 实施行；包内五文件交叉引用复核（包号 012、决策落地值 D-a~D-d、基线数字）；收尾自检 | 五文件零矛盾；T 节 9 行齐全 |
| T10 | 2026-10-31 | **真机 AC6 闭环 + D-e 修复**：① PK-012-01（未过门拒下游）真机通过；② PK-012-02 首跑暴露 approved `0-final` 不可重开缺陷→按 D-e E1 修订 `bridge.ts` initializeEntry（approved 分支加 0-final 版本化重开例外，复用 guard.gateVersion）+ 需求规格 §6 D-e / 契约 §1.3 反向同步 + `gate-bridge.test.ts` 新增 4 例（放行 / 同版本拒 / 低版本拒 / 无 version 拒）；③ 同沙箱复测 PK-012-02 全链路通过：assess→0-final v3 重开→批准→三选一 mark→commit（立项单.v3 双写、影响清单.v2-v3、manifest.briefVersion=3、两下游节点挂 dirty）；④ showrunner.md CRLF→LF 行尾归一化（修复 agent-profiles.test.ts frontmatter 解析失败，非本包逻辑改动）。全量 70 文件 825 passed / 1 skipped / 0 failed；tsc 恰 3 条基线 | AC1–AC6 真机全过；桥 approved 终态防护在版本化重开例外外零回归 |

## X 节 · 规格修订

| 日期 | 修订条目 | 原因 | 新去向 |
| :-- | :-- | :-- | :-- |
| 2026-10-28 | 任务清单 T5 所写测试路径 `src/studio/chat/__tests__/` 与 `src/studio/stage0/__tests__/` | 仓库既有惯例为测试与实现同目录共置（`gate-card-harness.test.tsx` 先例），`__tests__/` 子目录无先例 | 实际落 `src/studio/chat/gate-impact-summary.test.tsx`、`src/studio/stage0/stage0-gate-retention.test.tsx`；功能验收口径不变 |
| 2026-10-28 | 任务清单 T4 引用挂载点 L193 / L485 | 代码演进后行号漂移 | 实况为 `Stage0View.tsx` L196（EmptyStage0）/ L623（PublishedBody），以实况为准 |
| 2026-10-28 | 契约 §3.1.b 末注「global.d.ts / dev-mock-api.ts 按需同步」中的 dev-mock 部分 | dev-mock 演示画布节点 id 为 `n-brief`（Stage0View 不识别）、`gates: []`；新增门演示桩会造成「空态 + 已批门」语义矛盾 | dev-mock **零 diff**（不增门演示桩）；目验走 Electron 沙箱 |
| 2026-10-28 | 门 payload 新键类型放置 | `CanvasGate.payload` 为 `unknown` 自由载体，增键不触 K1；镜像类型循 806 `HarnessFindingDto` 先例 | 类型落 `src/global.d.ts`，`shared/types.ts` 零 diff |
| 2026-10-29 | T7 真机目验遗留项之「approved 留存卡挂载点」面 | 挂起项 HOLD-01 补验（feature-012 方案 B 落地后解除条件成立） | ✅ 真机通过（用例 HOLD-01）：造数 approved 门 → STAGE 0 留存卡三区上屏（已确认横幅 + `data-gate-impact-summary` 影响清单 2 项 + `data-gate-harness-findings` 拦截区仅列 blocker、warning 过滤），无裁决按钮、无 pending 门条；证据回填 [立项阶段整体真机测试用例.md](../../立项阶段整体真机测试用例.md) §6。T7 其余真机面（再版门 payload 注入链路）不在本用例范围，维持原遗留口径 |
| 2026-10-31 | 契约 §1.2「approved 为终态禁重开」表述 | 真机 PK-012-02 暴露：0-final 门 approved 后无法为下一版重开，与再版需复用同一 0-final 门的设计冲突 | 新增契约 §1.3「0-final approved 门的版本化重开（D-e E1）」：仅 0-final + 新版本严格大于旧版本时覆盖重开为 pending，其余 approved 仍拒绝；需求规格 §6 增 D-e 决策点。bridge.ts approved 分支同步修订（见 T10） |
| 2026-10-31 | T7「AC6 真机项遗留」口径 | T10 真机复测 PK-012-02 全链路通过，AC6 遗留解除 | ✅ AC6 真机通过（见 T10 与整体测试计划 §6 PK-012-02）；T7 原遗留口径由 T10 闭环 |
| 2026-11-01 | 契约 §1.1 门 payload 四键、§1.3 版本化重开及门后职责 | feature-015 将 `gate.request` 改为非阻塞协议，并统一系统直做可枚举后置动作 | `0-final` 新增必填 `payload.draft`；同 gateId 覆盖重开语义由 feature-015 接管。再版仍保留 `impactSummary`，点通过只确认草案，三选一后由 `impact.commit` 唯一发布；首版由系统直发。门卡新增系统 `execution` 成功 / 失败摘要，既有影响清单与 findings 留存不变 |

## 版本记录

| 版本 | 日期 | 事项 |
| :-- | :-- | :-- |
| v1.7.1-draft | 2026-10-28 | feature-012 五文件规格建立（建包登记，待批准） |
| v1.7.1 | 2026-10-28 | 实施放行并落地：showrunner 再版纪律四处改写 + GateCardView 影响清单区 + Stage0View approved 留存挂载；新增 2 测试文件 12 例；全量 70 文件 821 passed / tsc 恰 3；806 翻案注与 README 同步 |
| v1.7.2 | 2026-10-31 | 真机 AC6 闭环：D-e E1 修复 approved 0-final 版本化重开（bridge.ts + 4 例回归）；PK-012-01/02 真机全过；README/整体测试计划/本记录回填；showrunner.md CRLF 行尾归一化；全量 70 文件 825 passed / tsc 恰 3 |

---

## D-037 归档与迁移覆盖

> 状态含义：**已存在**＝负责包已有同义约束；**已迁入**＝已补入负责包现行章节；**保留历史**＝原任务、AC、真机结论与测试证据仅作追溯。仍仅登记去向的内容必须明确接收包与开放事项。
>
> **跨组目标章节**：表中 001 的定案数据落点为需求 §7.4、契约 §10.5，字段边界为需求 §7.6、契约 §10.7、设计 §4 第 5 项；013 的影响摘要与 approved 留存落点为需求 §6.7、契约 §7.5、设计 §5 第 5 项，开放验收见需求 §6.8。上述标题均已实际建立。

| 原文件 / 章节 | 当前负责包与目标 | 状态 | 覆盖与冲突处理 |
| :-- | :-- | :-- | :-- |
| 需求 §1 背景、§2 范围 | 001（影响摘要业务数据）+ 013（再版门影响区 / approved 留存） | 已迁入 + 保留历史 | 三项原始痛点与排除项不改；现行能力按数据与视图拆责，不虚构链态 / 分色章节。 |
| 需求 §3 D-a（A1） | 001 + 013；806 findings 仍归 806 | 已迁入 + 已存在 | 摘要生产与快照语义归 001，改动 / 影响 / findings 三区展示归 013；806 校验规则不动。 |
| 需求 §3 D-b（B1） | 013（Stage0View 本卡 approved 留存） | 已迁入 | renderer 读取既有画布门数据；聊天输入区仍只显示 pending 门。 |
| 需求 §3 D-c（B） | 001 + 013；002 assess 算法与工具已存在 | 已迁入 + 已存在 | 001 承接 payload 业务数据与 Agent 协议，013 承接展示；002 工具责任不变。 |
| 需求 §3 D-d | 001（showrunner 定案 / 再版协议） | 已迁入 | 再版六步、quote、完整定案卡与影响产物清单归 001。 |
| 需求 §3 D-e、§6 补录 | 801 §6 / 契约 §12 / 设计 §5 | 已迁入 | 仅 0-final 在新旧 version 均可解析且新版本严格大于旧版本时覆盖为 pending；其他 approved 门终态。 |
| 需求 §4 通道约束 | 001 + 013 + 801 | 已存在 | 沿用 assess、gate、canvas 与门裁决既有通道；本次归并同样零新 MCP / IPC / 推送。 |
| 需求 §5 验收点 | 001 + 013 + 801 + 806 | 已迁入 + 保留历史 | 001 数据 / 协议、013 展示、801 门态与推进、806 Harness；原 AC 与通过证据不改。 |
| 需求 §7 未决项 | 801（D-e 后续补录）；原文 | 保留历史 + 已迁入 | 不把历史“待批”改写成当时已闭环；E1 的现行重开规则由 801 承接。 |
| 契约 §1.1 `payload.impactSummary` | 001 + 013 | 已迁入 | 001 负责数据生产、可选键与首版 / 再版语义，013 负责有键展示 / 无键降级；002 assess 与 806 findings 保持既有责任。 |
| 契约 §1.2 留存挂载数据面 | 013 | 已迁入 | 推荐方案 B 纯 renderer 读取 canvas `gates[]`；方案 A 的 ChatMessage / K1 备选仅留历史，不新增字段。 |
| 契约 §1.3 0-final 版本化重开 | 801 §12.1 | 已迁入 | 与 015 同 id 覆盖重开合并：pending / rejected 可重开；approved 仅 0-final 严格新版本放行，其余 approved 终态。 |
| 契约 §2 通道与错误码零回归 | 001 + 013 + 801 + 806；002 既有 | 已存在 + 已迁入 | 807 四码及门态防护现归 801；806 与 002 的码值、触发条件和写盘语义仍归原包。 |
| 契约 §3.1 GateCardView 再版三区 | 013 + 806 | 已迁入 + 已存在 | 影响清单区与门卡展示归 013；findings 区及既有断言所有权仍归 806。 |
| 契约 §3.2 approved 留存挂载 | 013 + 808 | 已迁入 + 已存在 | Stage0View 留存与 ChatComposer 单点裁决归 013；808 继续维持历史回放不渲染门卡的边界。 |
| 契约 §3.3 showrunner.md 纪律 | 001；门后时序同时受 801 约束 | 已迁入 + 被后续条款取代 | 定案协议归 001；门 approve 后 Agent 再手动推进的旧顺序由 015 / 801 系统后置执行取代。 |
| 契约 §4 最小 diff | 原文；现行能力归 001 + 013 + 801 | 保留历史 | 路径与 diff 是 2026-10-28 实施快照，不改写为本次归并清单，也不据此改代码。 |
| 契约 §5 测试契约 | 001 + 013 + 801 + 806 | 保留历史 + 去向登记 | 23 例 / 24 例、66 文件 761 等计数、PASS/FAIL 和截图口径原样保留；本次不重跑产品测试。 |
| 契约 §6 卡口与越界处置 | 各现行负责包既有卡口 | 已存在 + 保留历史 | 新工具、IPC、shared、依赖或白名单变更仍须另行呈报；历史默认方案不被归档表推翻。 |
| 设计 D0 现状核对 | 001 + 013 + 801 + 806 | 保留历史 + 已存在 | 取证路径不改；当前责任按数据、视图、门态、Harness 分包。 |
| 设计 D1 三区数据流 | 001 + 013 | 已迁入 | `impactSummary` 快照与 showrunner 生产归 001，三区布局与降级归 013。 |
| 设计 D2 approved 留存 | 013 | 已迁入 | 纯展示复用 GateCardView，approved 态无裁决按钮，不扩展交互。 |
| 设计 D3 兼容与降级 | 001 + 013 + 801 | 已迁入 | 首版无键 / 再版有键归 001 / 013；门版本与批准 / commit 时序归 801。 |
| 设计 D4 再版六步 | 001 + 801 | 已迁入 + 被后续条款取代 | assess 前置与完整定案卡归 001；Agent 门后另调 advance / publish 的旧编排以 015 / 801 为准。 |
| 设计 D5 测试树 | 001 + 013 + 801 + 806 | 保留历史 | 仅映射责任，不重跑、不更新原测试结论。 |
| 设计 D6 视觉参数 | 013 | 已迁入 + 保留历史 | 视觉责任归 013；原路径与只读取证结论不改。 |
| 任务 T1–T8a / T8b | 001 需求 §7.4 / 契约 §10.5 + 013 需求 §6.7 / 契约 §7.5 + 801 + 806 | 保留历史 + 已迁入 | 所有 checkbox、AC、测试计数与真机结论不改；T8b 补行继续是历史实施记录。 |
| 变更 D-001 / D-002 | 001 + 013 + 801 | 保留历史 + 已迁入 | D-a～D-d 按 001 / 013 承接，D-e 归 801；批准时间、冻结记录与门禁不改。 |
| 变更 X-001 | 原文 | 保留历史 | B-60 mock 与 import 修复无功能迁移，不修改 21/21、23/23 等证据。 |
| 变更 2026-11-01 修订行 | 013 + 801 + 808 | 已迁入 + 被后续条款取代 | 留存视觉归 013，execution 成功 / 失败摘要归 801，808 回放不渲染门卡维持；早期 Agent 门后手动推进和“再版 commit 同版本门”旧表述以 015 为准。 |

**归档自审**：覆盖表没有把 012 笼统并入单一包；立项视图、影响面板 / 影响区、留存卡与相关交互明确到 013（本包正文没有链态 / 分色章节，未虚构来源），立项数据 / 定案 / Agent 协议明确到 001，pending / decide / execution / reopen 明确到 801。未删除目录、未改历史任务、AC、测试计数或 FAIL/PASS。纯文档，**自审 + 无第二人复核**。
