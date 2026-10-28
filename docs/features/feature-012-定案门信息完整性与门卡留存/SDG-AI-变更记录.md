# SDG-AI-变更记录 — feature-012 定案门信息完整性与门卡留存

> 变更记录三分类（通用指令 §2）：**D 决策**（建包/翻案/放行等用户拍板）、**T 实施**（任务清单工序回填）、**X 修订**（规格自身修订注）。本包当前仅完成建包登记，T/X 节留占位待实施期回填。

## D 节 · 决策登记

| 日期 | 决策 | 依据 / 说明 |
| :-- | :-- | :-- |
| 2026-10-28 | **建包登记**：新建任务包 feature-012「定案门信息完整性与门卡留存」，溯源 **[Design 原有]**（事实源：短剧Agent平台设计.md §2.6.5 L252-256 拍板前同列可见 + §2.6.7 影响清单留底 L363-366） | 用户于 2026-10-28 拍板三包分包方案，本包为其中一包；业务 = ①再版定案门「拍板前展示影响产物清单」（修正现状顺序倒置：showrunner.md L153-155 第 3 步拍板先于第 4 步 assess 呈报）＋ ②approved 门卡 findings 留存真机挂载（翻案项，呈报见需求规格 §2，翻案对象 = 806 本文件 X 节 2026-10-28 条目） |
| 2026-10-28 | **规格待批准（历史，已由下一行「实施放行」取代）**：本包五文件（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录）已建立；契约按推荐方案撰写（D-a=A1 门 payload 增键 / D-b=B1 assess 前置 / D-c=B Stage0View 放行） | 铁律 1（No Spec, No Code）：用户批准本规格并在本节补登「实施放行」前，任务清单 T1-T9 一律不得动手；若裁决偏离推荐方案，须先修订契约与本记录再实施 |
| 2026-10-28 | **实施放行**：用户批准本包规格，决策点按推荐方案裁决——D-a=A1（门 payload 增 `impactSummary` 键，不触 K1）/ D-b=B1（`impact.assess` 前置到发门前）/ D-c=B（Stage0View 放行 approved 门卡，零 K1，806 翻案成立）/ D-d=全系统直做；T1 起可动代码 | 用户原话「好的，按推荐方案开始实施 011、012、013 的三包范围」；三项决策落地值同批登记决策台账 **D-020** |

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

## X 节 · 规格修订

| 日期 | 修订条目 | 原因 | 新去向 |
| :-- | :-- | :-- | :-- |
| 2026-10-28 | 任务清单 T5 所写测试路径 `src/studio/chat/__tests__/` 与 `src/studio/stage0/__tests__/` | 仓库既有惯例为测试与实现同目录共置（`gate-card-harness.test.tsx` 先例），`__tests__/` 子目录无先例 | 实际落 `src/studio/chat/gate-impact-summary.test.tsx`、`src/studio/stage0/stage0-gate-retention.test.tsx`；功能验收口径不变 |
| 2026-10-28 | 任务清单 T4 引用挂载点 L193 / L485 | 代码演进后行号漂移 | 实况为 `Stage0View.tsx` L196（EmptyStage0）/ L623（PublishedBody），以实况为准 |
| 2026-10-28 | 契约 §3.1.b 末注「global.d.ts / dev-mock-api.ts 按需同步」中的 dev-mock 部分 | dev-mock 演示画布节点 id 为 `n-brief`（Stage0View 不识别）、`gates: []`；新增门演示桩会造成「空态 + 已批门」语义矛盾 | dev-mock **零 diff**（不增门演示桩）；目验走 Electron 沙箱 |
| 2026-10-28 | 门 payload 新键类型放置 | `CanvasGate.payload` 为 `unknown` 自由载体，增键不触 K1；镜像类型循 806 `HarnessFindingDto` 先例 | 类型落 `src/global.d.ts`，`shared/types.ts` 零 diff |

## 版本记录

| 版本 | 日期 | 事项 |
| :-- | :-- | :-- |
| v1.7.1-draft | 2026-10-28 | feature-012 五文件规格建立（建包登记，待批准） |
| v1.7.1 | 2026-10-28 | 实施放行并落地：showrunner 再版纪律四处改写 + GateCardView 影响清单区 + Stage0View approved 留存挂载；新增 2 测试文件 12 例；全量 70 文件 821 passed / tsc 恰 3；806 翻案注与 README 同步 |
