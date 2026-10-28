# SDG-AI-变更记录 ｜ feature-011 影响评估面板与批量重生成

> 三分类生命周期：**D 节 = 决策（永久保留）** ｜ **T 节 = 实施记录（过渡性，验收后可精简）** ｜ **X 节 = 修订记录（记录决策级修正）**

---

## D 节 · 决策记录

### D-001 建包登记（2026-10-28）

**背景**：设计书 §2.6.7 承诺的影响评估面板（L331-349 ASCII 草图：改动字段区 + 分组勾选列表 + 一键重生成选中 / 仅标记脏 / 取消三按钮）自始未建包（设计书 L312 明示「现状为对话态呈报 + 系统直改恒 mark」）。该缺口经两次明示排除留待：feature-002 需求规格 §4.2 L82（面板 UI 留待通道包）与 L85（不内置编排器）；feature-007 契约 L78 / L115（黄条「查看影响评估」钮与批量对齐维持排除不翻案）。

**建包依据**：**2026-10-28 用户拍板分包方案**（本包为该方案三包之一），上述两项排除经拍板正式**翻案**，登记于此。

**侦察实证（2026-10-28，全部读码核实，行号以实测为准）**：

1. 数据底座已就绪：impact.ts L9/L18/L27（ImpactItem / ImpactAssessment / ImpactReportFile 已含 severity 分组、defaultAction 预勾选、decision 留痕位全部字段）；update.ts L34（BriefUpdateResult 携 changes/items）/ L127（decisions 恒 'mark'）；影响清单落项目根 `影响清单.vN-vM.json`（tools.ts L760），文件名挂 `CanvasDirty.impactReport`（tools.ts L802）。
2. 执行链路已就绪：007 单产物重对齐链路（RealignConfirm L21 buildRealignPrompt → StudioApp L387-400 → handleSend L318 → showrunner R-008 → canvas.align 清脏，tools.ts L833-835）。
3. 缺口实锤：Stage0View L349-372 updateBrief 返回值被丢弃未消费；StudioViewer L620 注释「无 [查看影响评估] 钮」；全仓无分组勾选 / 批量重生成实现。
4. 零新 IPC 可行性实证：global.d.ts 既有通道全覆盖——L76-96 updateBrief 返回值（自动弹窗数据源）/ L177 fileRead（黄条回读清单）/ L159-163 canvas.get/onChange（脏态刷新消退）。
5. 基线实测：MCP **11 族 28 工具**；showrunner 白名单 **23**；`npx tsc --noEmit` 恰 **3 条**（canvas-zoom.test.tsx 2 + runtime-client.test.ts 1——⚠️ 与 806 变更记录所载文件不同，Stage3AssetHub 已不存在，以实测为准）；`npm run test:run` **66 文件 761 passed / 0 failed / 1 skipped**。

**设计抉择（呈报待拍板，见需求规格 §6）**：

| # | 决策点 | 推荐 |
| :-- | :-- | :-- |
| D1 | 批量重生成编排通道 | A：复用 007 既有链路（K8 零触），不新增批量工具（维持 002 §4.2 L85「不内置编排器」） |
| D2 | 面板触发时机 | C：保存后自动弹出（items>0）+ 查看器黄条「查看影响评估」手动入口，两者兼有 |
| D3 | 一键重生成选中执行语义 | 勾选即决策 + 逐产物走既有流程；子项推荐：单条聚合消息 + 会话流留痕（decision 不回写，K8 零触） |
| D4 | D-016 边界 | 面板渲染 / 勾选 / 分组 / 编排发起全系统直做零 AI；AI 仅承担产物内容重生成本身 |
| D5 | 与 806 漂移黄条共存 | A：漂移提醒 + 一键对齐 + 查看影响评估三者并置，806 逻辑零 diff；画布顶栏 banner 维持非阻断纯提醒不加钮 |

**卡口登记**：K8 默认零触发（推荐方案；拍板 D1-B / D3 留痕-B 则条件触发，先呈报后实施）；K9 零新增；K1 默认零触发（勾选态 renderer 内存化，shared/types.ts 零 diff）；零新 IPC 基线已实证。实施中触碰未登记卡口 → 停手呈报四步。

**偏差与留痕**：

1. **翻案登记**：002 §4.2 L82 / 007 契约 L115 两项明示排除，经 2026-10-28 用户拍板翻案建包（本条即翻案凭据）。
2. **文档漂移发现**（本包不代修，仅留痕）：① docs/features/README.md §2「10 族共 27 个」过时（实测 11 族 28 个），治理收尾 T10 同步修正；② 806 变更记录 T6 所载 dirty-drift 落点（`shared/dirty-drift.ts` / 三处消费点）与代码实况（`src/studio/canvas/dirty-drift.ts` / 四处消费点）不符，以代码实况为准；③ update.ts L5 注释「三选一面板属 feature-006 未建范围」为旧编号体系残留引用，实施时如触碰该文件注释可顺带更正（不触碰则不动）。
3. **规格状态**：五文件已建（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录）；**2026-10-28 用户批准并按推荐方案裁决（D1-A / D2-C / D3 单条聚合 + 会话流留痕 / D4 全系统直做 / D5-A），T1-T10 已实施并回填。**

**溯源标签**：[Design 原有]（§2.6.7 设计内功能补全）
**技术决策指针**：需求规格 §3 / §6；设计说明 §2 决策表 OD-1~OD-9；契约 §4 白名单 / §6 卡口基线。

---

## T 节 · 实施记录

> 实施放行：2026-10-28 用户批准本包规格并按推荐方案裁决（D1-A / D2-C / D3 单条聚合消息 + 会话流留痕 / D4 全系统直做 / D5-A 三黄条并置）。

| # | 日期 | 实测与结果 |
| :-- | :-- | :-- |
| T1 | 2026-10-28 | 基线冻结：66 文件 **761 passed / 0 failed / 1 skipped**；`npx tsc --noEmit` 恰 **3 条**（canvas-zoom.test.tsx 2 + runtime-client.test.ts 1）；MCP **28** 工具、showrunner 白名单 **23** 复核一致；契约 §4 白名单外文件零改动。 |
| T2 | 2026-10-28 | 新建 `src/studio/impact/impact-select.ts`：两入口（updateBrief 返回值 / `影响清单.vN-vM.json`）归一为视图模型、高/中分组、默认勾选、计数、批量模板消息构建；纯函数零副作用。tsc 零新增。 |
| T3 | 2026-10-28 | 新建 `src/studio/impact/ImpactPanel.tsx`：改动字段摘要区 + 高/中分组勾选列表 + 三动作行（N 计数 / N=0 禁用）+ 空清单与读取失败降级；形态对齐设计书 §2.6.7 L331-349。 |
| T4 | 2026-10-28 | 新建 `src/studio/impact/impact-panel.test.tsx`，**16 例全绿**（契约 T-①~⑤：归一/分组/默认勾选/计数/消息模板/降级）。 |
| T5 | 2026-10-28 | `src/studio/shell/StudioApp.tsx` +59 行：impactPanel state + 打开/关闭/确认三回调 + 勾选集 → 批量模板消息经既有 handleSend 注入（单条聚合、会话流留痕、decision 不回写）+ 面板与 RealignConfirm 同级挂载；零新 IPC/工具。 |
| T6 | 2026-10-28 | `src/studio/stage0/Stage0View.tsx`：消费 updateBrief 返回值、仅 items>0 上报（onBriefUpdated 逐层穿透）；`src/studio/viewer/StudioViewer.tsx`：脏读黄条追加「查看影响评估」钮 + fileRead 回读重开 + 降级，L620 旧注释同步改写。`stage0-view.test.tsx`（T-⑥）与 `studio-viewer.test.tsx`（T-⑦⑧）全绿。 |
| T7 | 2026-10-28 | `src/dev-mock-api.ts` +45 行：`DEMO_IMPACT_*` 演示数据 + updateBrief 演示返回 + 影响清单读回桩；既有演示路径零回归。 |
| T8 | 2026-10-28 | 全量回归：**68 文件 809 passed / 0 failed / 1 skipped**（较 T1 净增 2 文件 / 48 例）；tsc 恰 3 条；工具 28 / 白名单 23 / `shared/types.ts` 与 `package.json` 零 diff。 |
| T9 | 2026-10-28 | 真机目验**受限降级**：dev-mock 浏览器路径两次尝试（风格谱系浮层遮挡、画布节点点击被右栏拦截）未走通交互链路，不臆造通过；改以组件测试（黄条新钮 / 面板 / 批量消息断言）+ dev-mock 数据走读替代留证。Electron 沙箱真机目验列入遗留项，待用户真机验收（同 012 / 013 一并）。 |
| T10 | 2026-10-28 | 治理收尾：本记录 T/X 回填；`docs/features/README.md` 011 行翻 ✅ 并修正 §2「10 族共 27 个」→「11 族 28 个」；`docs/设计现状与偏差清单.md` 登记 011 行；三包合并登记决策台账 D-020。 |

---

## X 节 · 修订记录

- 2026-10-28：【结构复制登记】`impact-select.ts` 的高/中着色与字段中文标签镜像自 `src/studio/canvas/RealignConfirm.tsx` 与 `src/studio/stage0/select.ts` 既有词表（renderer 内纯函数，避免跨模块耦合与重复依赖）；如后续抽公共主题 token，另行建包，不在本包扩面。
- 2026-10-28：【文档漂移修正】README §2「MCP 纯工具族 10 族共 27 个」在 feature-806 落地 harness 族后未同步，实测应为 **11 族 28 个**；本包 T10 顺带修正（非本包功能偏差）。
- 2026-10-28：【目验受限】T9 降级为组件测试 + 数据走读，原因见 T9 行；不列功能偏差，遗留项随三包统一真机验收关闭。
- 2026-10-28：【提交归属留痕】本包 renderer 改动（impact 三文件、StudioApp / StudioViewer / Stage0View 增量、dev-mock 增量、测试增量）全部处于未提交工作区；提交粒度由用户统一决定，本记录不预设 commit 边界。
