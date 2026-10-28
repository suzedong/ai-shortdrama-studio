# SDG-RE-任务清单 — feature-012 定案门信息完整性与门卡留存

> **状态：已批准实施并完成（2026-10-28，决策 D-a=A1 / D-b=B1 / D-c=B / D-d 全系统直做）；T1-T9 回填见包内变更记录 T 节。**
> 本清单为实施期工序表：按 T1 → T9 顺序执行，工序间不跳步；每个 T 完成即在 SDG-AI-变更记录 T 节回填一行（含实施 / 测试 / 验收）。
>
> 关联文件：需求规格.md（目标 / 决策点 / 验收标准）、契约.md（最小 diff 白名单 / 测试契约 / 卡口）、SDG-OD-设计说明.md（时序与三区信息架构）。

## T1 基线冻结

- **工序**：实施动手前原样重跑并记录基线——`pnpm vitest run`（期望 66 文件 761 passed / 0 failed / 1 skipped）、`pnpm exec tsc --noEmit`（恰 3 条，构成 = canvas-zoom.test.tsx 2 + runtime-client.test.ts 1）、`grep -c 'server.tool(' electron/mcp/tools.ts`（28）、showrunner 白名单计数（23）；复核需求规格 §1.2 全部行号证据仍成立（若代码已漂移，先回填证据再决定是否修订本包）。
- **产出**：变更记录 T 节 T1 行（基线实测值 + 证据复核结论）。
- **验收**：四项基线实测值与契约 §6 表一致；证据行号全部命中。

## T2 showrunner 再版纪律改写（业务一 · 顺序修正）

- **工序**：按契约 §3.3 四项改写 `resources/opencode/agents/showrunner.md`——① L132 门 payload 键清单补 `impactSummary`（注明"再版时必带，键定义以契约为准"）；② L136 口头拍板两前提改写为"改动摘要+影响清单已同列展示且用户已看到"；③ L153-155 再版六步重排为"改动 → `brief.impact.assess` → **定案门（改动+影响清单同列展示）→ 用户拍板 → `brief.impact.commit`**"；④ L107-108 附近补一句"挂门即停"对再版同样适用。白名单（23 项）与其他段落零改动。
- **产出**：showrunner.md diff（仅限上述四处）；变更记录 T 节 T2 行。
- **验收**：`grep` 复核白名单计数仍 23；再版步骤顺序与契约 §3.3.c 逐字一致。

## T3 GateCardView 影响清单区（业务一 · 同列展示）

- **工序**：按契约 §3.1.b 在 `src/studio/chat/GateCardView.tsx` 增影响清单区——改动区与 findings 区之间插入，从 `payload.impactSummary` 取数（经 `harnessBlockersOf` 同款安全解析新增 `impactSummaryOf` 辅助函数），根节点标 `data-gate-impact-summary`，逐条渲染 `label / action / count`；pending 与 approved 两态同布局渲染；`payload` 无该键时整区不渲染（首版零回归）。global.d.ts / dev-mock-api.ts 按契约 §3.1.b 末注按需同步。
- **产出**：GateCardView.tsx diff；变更记录 T 节 T3 行。
- **验收**：`pnpm exec tsc --noEmit` 新增 0 条错误（总数仍恰 3）；手动构造带/不带 `impactSummary` 的门 payload，渲染分别呈现/不呈现该区。

## T4 Stage0View approved 留存挂载（业务二 · 翻案落地）

- **工序**：按契约 §3.2 在 `src/studio/stage0/Stage0View.tsx` 放行 approved 门卡——L193 与 L485 两处 `gate0.status !== 'approved'` 排除条件移除/改写为放行，直接复用 `<GateCardView gate={state.gate0} />` 既有组件渲染（含影响清单区与 806 findings 区）；不改 GateCardView 内部、不改 StudioApp pendingGate 派生、不改 ChatComposer。
- **产出**：Stage0View.tsx diff（两处条件 + 挂载点）；变更记录 T 节 T4 行。
- **验收**：沙箱构造 canvas `gate0.status === 'approved'`（含 findings 与 impactSummary 的 payload）→ Stage 0 视图可见完整门卡；pending 时原确认门交互不受影响。

## T5 测试（组件单测 + 回归组零回归确认）

- **工序**：新增 `src/studio/chat/__tests__/gate-impact-summary.test.tsx` 与 `src/studio/stage0/__tests__/stage0-gate-retention.test.tsx`，覆盖契约 §5 用例组 a（6 用例）与组 b（6 用例）；随后跑契约 §5 回归组 d 五套件确认零回归（`gate-guard.test.ts` 23 例 / `tools.harness.test.ts` 806 拦截链 / `brief-impact.test.ts` 24 例 / `history-replay.test.ts` / `chat-roundtrip.test.ts`）。
- **产出**：两个新测试文件；回归组运行记录；变更记录 T 节 T5 行。
- **验收**：新增用例全绿；回归组 d 五套件通过数与基线完全一致（23 / 806 链原值 / 24 / 原值 / 原值）。

## T6 全量回归

- **工序**：`pnpm vitest run` 全量 + `pnpm exec tsc --noEmit`。
- **产出**：全量运行记录；变更记录 T 节 T6 行。
- **验收**：vitest = 基线 761 + 新增用例数 passed，0 failed，skipped 不增；tsc 恰 3 条（构成不变）。

## T7 真机目验（沙箱）

- **工序**：按需求规格 §8 验收场景在沙箱工程真机走一遍——① 再版定案门（注入 mock 门 payload 含 impactSummary）确认改动+影响清单同列、拍板后 commit 链路；② 806 拒绝路径确认 findings 出现在门卡；③ approved 后 Stage 0 留存卡可见。
- **产出**：三场景目验记录（截图或文字描述）；变更记录 T 节 T7 行。
- **验收**：AC1-AC6 逐条过，全部达成。

## T8 治理收尾（T/X 回填 + README + 806 翻案注）

- **工序**：① 变更记录 T 节补齐所有工序行；② `docs/features/README.md` 增补 012 行（索引格式对齐 806/807/808 行）；③ 在 806 变更记录 X 节追加翻案修订注（模板按通用指令 §2.2，内容：806 原定"approved 门卡 findings 不上屏、登记偏差继续"被 012 方案 B 翻案，012 实施后 findings 随 approved 门卡经 Stage0View 上屏留存）；④ 需求规格 §2 翻案登记指针注明"已落地"。
- **产出**：README diff + 806 X 节修订注 + 本包变更记录终态；变更记录 T 节 T8 行。
- **验收**：README 012 行与 806/807/808 行格式一致；806 X 节修订注含原条目日期、翻案原因、新去向三要素。

## T9 版本记录

- **工序**：变更记录尾部「版本记录」补 012 实施行（版本 v1.7.1）；确认包内五文件互相引用一致（包号、日期、决策落地值）；收尾自检（通用指令 §12）。
- **产出**：版本记录行；变更记录 T 节 T9 行。
- **验收**：五文件交叉引用零矛盾；T 节 9 行齐全、X 节占位无遗漏回填。

## 工序-验收映射

| 工序 | 需求规格验收标准 | 契约条目 |
| :-- | :-- | :-- |
| T2 | AC1 | §3.3 |
| T3 | AC2、AC4、AC5 | §1.1、§3.1、§5.a |
| T4 | AC3 | §1.2、§3.2、§5.b |
| T5 | AC4、AC5 | §5 |
| T6 | AC5 | §5.d、§6 |
| T7 | AC1-AC6 | §3 |
| T8/T9 | （治理） | §4 文档类 |
