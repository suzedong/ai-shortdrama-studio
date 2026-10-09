# SDG-AI 变更记录 · feature-012 视觉风格谱系系统资产

> 版本：v1.2（T5-4 手动回归完成，待用户签字闭环）
> 日期：2026-10-06

## 决策记录（K 卡口触发，永久保留）

### D-012-1 · K6 新增谱系查看纯函数与只读页模块（待签字）

- 触发：K6（新增业务模块）。
- 内容：`src/lib/styleCatalogView.ts`（filterCatalog / groupByFamily）、`src/components/StyleCatalogPage.tsx`（头部 + 搜索 + 家族分组卡 + 空态 + Esc 关闭）。
- 数据边界：直接 import `electron/style-catalog.ts` 的 CATALOG_VERSION / FORMS / STYLE_CATALOG，不另建谱系副本；纯函数无副作用，页面只读、不访问 window.api。
- 落地情况：按契约 §2.2 / OD §3.1-3.2 实现；新增测试 `src/test/styleCatalogView.test.ts`（9 例）、`src/components/StyleCatalogPage.test.tsx`（8 例），共 17 例全绿。
- 签字：⬜ 用户签字后生效。

### D-012-2 · K8 双入口与页面开关接线（待签字）

- 触发：K8（renderer 内部 state / props 接线，无 IPC）。
- 内容：App 新增 `catalogOpen` state 与全屏遮罩挂载；header 加「系统资产」按钮；`BriefCandProps` 加可选 `onViewCatalog` 并在视觉风格块加「查看谱系」链接。
- 边界：开关仅切换布尔值，不改 nodes / phase / gate / 消息，不入 WorkflowState、不持久化、不触发 IPC 与 autosave；候选卡未接线时不渲染链接。
- 落地情况：
  - props 透传链路 App → ChatPanel → MessageView → BriefCandidateCard 四层接通，未传 `onViewCatalog` 时链接不渲染（避免死按钮）。
  - 接线测试 `src/App.catalog.test.tsx`（3 例）：① 顶栏入口打开 → 18 卡 → Esc 关闭后 0-c 门仍在；② 候选卡「查看谱系」打开同一页 → 关闭按钮可关；③ 开关前后 `appendMessage` 零调用、`saveWorkflow` 调用次数不增。
- 签字：⬜ 用户签字后生效。

### D-012-3 · 0-c prompt 目录信息对齐（待签字）

- 触发：本 Feature 既定改造（非 K1；不改共享层、不改输出 schema）。
- 内容：`electron/prompts.ts` 目录注入由「家族｜名｜主备｜可行度」四列扩为含 visualFeatures / anchorWords / qualityRecipe 正文的多行块；选型规则文案不变。
- 测试联动：适配 `src/test/revise-text.test.ts` 旧单行正则为「18 画风名 + 锚点词全量注入 + 主备计数」等价/更强断言，不放松实质约束。
- 落地情况：
  - 常量 `CATALOG_LINES` → `CATALOG_BLOCKS`：每画风一个多行块（家族 / 名 / 主备 · 可行度 / 视觉特征 / 锚点词 / 质感配方），qualityRecipe 双档配方续行缩进两空格；目录引导语同步更新字段说明。
  - 选型规则 1–5 与输出 JSON schema、`buildVisualStylePrompt` 签名与 user 段均未改动。
  - `src/test/revise-text.test.ts` 改为遍历 STYLE_CATALOG 断言 18 画风名 + 18 锚点词原文注入、`（主 ·`×11 / `（备 ·`×7、三字段标签各 18 处、双档配方原文在目；10 例全绿。
- 签字：⬜ 用户签字后生效。

---

## 实施变更记录（编码阶段逐条追加，三分类：规格修复 / 计划外修复 / 外部问题）

### E-012-1 · 接线测试消息构造修正（规格修复）

- 现象：`App.catalog.test.tsx` 第 2/3 用例找不到 `view-catalog-link`；初版把「正式 0-c 门」与「visual-style 候选卡」拼在同一条消息流中。
- 根因：
  1. 链接仅在 BriefCandidateCard（`message.candidate === true`）内渲染，而消息工厂 `makeVisualStyle` 不带 `candidate` 标志（真实流由 App 在 activeDraft 分支补 `candidate: true`，见 App.tsx visual_style 分支）。
  2. `replayMessages` 对 candidate 产物不赋值正式 visualStyle（replay.ts 候选 continue/不赋值语义），候选卡与正式 0-c 门本就是两条流，拼在一起 restore 时门因缺 visualStyleV 建不出来。
- 修复：测试拆为两个消息场景——`pendingGateMessages()`（正式 0-c 门，visual-style 为正式消息）验顶栏入口与门状态；`candidateMessages()`（`makeRevision('start','0-c')` + 一条 candidate visual-style）验候选卡链接，符合 annotateCandidates 的 draft 上下文语义。属测试数据对齐规格，不改业务代码语义。

### E-012-2 · 全量套件一次性时序抖动（外部问题，不改码）

- 现象：首次 `npm run test` 时 `src/App.revision.test.tsx` 用例④报 `Cannot read properties of undefined (reading 'catch')`（App.tsx autosave 行 window.api.saveWorkflow 为 undefined）。
- 根因排查：该用例 mockApi 已含 saveWorkflow；单跑该用例、整文件跑均通过，连续两次全量 `npm run test` 均 454 passed / 1 skipped。判定为跨文件并发下的一次性时序抖动，非本 Feature 变更引入、不可稳定复现。
- 处理：不改码；后续如可稳定复现再另开任务排查 vitest worker 隔离。

### 回归结论

- `npm run typecheck`：通过（tsc --noEmit 无错）。
- `npm run test`：41 文件 / 454 passed / 1 skipped；本 Feature 新增 20 例（9 + 8 + 3），既有断言只增不减。
- `npm run build`：renderer（vite 73 模块）+ electron + preload 全部通过。
- T5-4 手动回归（2026-10-06 桌面端实测，OD §7）：已完成。
  1. 谱系查看页：顶栏「系统资产」打开，18 卡 / v1.45 / 5 家族分组、视觉特征·锚点词·质感配方双档齐全；搜索「水墨」正确出空态，「noir」大小写不敏感命中「黑白电影」1 项；清空 + Esc 关闭，工作台状态不变。
  2. 真实 0-c 端到端照抄核对：真实立项（校园甜宠 / 大二女生追学霸 / 90秒×8 / 竖屏），visual_style 选型「2D 漫｜韩漫·精致美型」，原始工具结果的 anchorWords、qualityRecipe（双档）、family、feasibility 与 `electron/style-catalog.ts` L84-88 逐字一致，证明 T4 prompt 目录约束端到端生效，模型未自造。
  3. 实测中发现的既有问题（非本 Feature 范围，建议另开任务）：① 0-c 门 Harness 关键项「形态与题材匹配」红叉——模型把用户输入的「大二（大学）」误写成「现代高中校园」语境，属模型题材偏差，谱系照抄本身正确；② 点「改部分」后 Agent 能理解并两次回复重调 visual_style，但两次重调的工具卡均未落库（消息停在引导语、无工具结果），最终 `pendingGate: null`、manifest 无 visualStyle 字段，重载后门消失。指向「改部分」后重发工具调用的编排/工具回路问题，属 feature-011 行为范畴。
  4. 本次实测产生的测试项目目录 `project-20261006-224340-m4h7` 已按用户决定删除。
