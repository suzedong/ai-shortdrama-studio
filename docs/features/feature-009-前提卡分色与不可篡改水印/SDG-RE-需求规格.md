# feature-009 · 前提卡分色 + 不可篡改水印 · 需求规格

> 版本：v1.0（2026-10-21）
> 来源：「新建→立项」链路盘点缺口 #5；feature-008 需求规格 §4.2 明示「另案登记」，本包即另案
> 治理：AI-SDG（AGENTS.md + docs/governance/AI-SDG-AI工具执行指令.md）；铁律 1「No Spec, No Code」

## 1. 背景与问题

设计书 §2.6.8 L379：

> **故事前提卡**：对话驱动的结构化呈现（非空白富文本模板）；AI 先编的「假版本」与人确认的事实**分色显示**，事实带**「不可篡改」水印**。

§2.6.3 L184/L188：背景档案 = 人提供（或确认）的原始事实，是后续编剧的**不可篡改依据**；Agent 先编「假的」前提版本引真人真事。

现状（2026-10-21 磁盘实况）：

- published 卡②（Stage0View.tsx L515-549）：premise 五键经 LeafValue 单色渲染——无「AI 假版本 vs 人确认」分色、无「不可篡改」水印；
- 背景档案折叠区（L530-546）：BackgroundMd 纯 markdown 渲染——无「不可篡改」标识；
- 分色所需数据源已具备：feature-005 已捕获口径（CapturedFact.source='user'|'infer' × status='pending'|'confirmed'）天然对应「人提供（或确认） vs AI 推断」；feature-008 chain.ts 词表（matchChainTopic / PREMISE_GLOSSARY）已完成「topic → premise 五键」精确匹配。

## 2. 用户拍板（2026-10-21，三项全推荐项）

| # | 方案点 | 拍板 |
|---|---|---|
| 1 | 分色数据判定 | **已捕获口径词表匹配**：topic 命中前提键的 fact 中 status='confirmed' 存在 → 人确认；仅 infer+pending → AI 假版本；无命中 → 中性。K1 零触发、纯 renderer 呈现 |
| 2 | 水印形态 | **行内徽标 + 行底色分色**：人确认行尾挂「不可篡改」徽标 + 淡绿底；AI 假版本挂「AI 拟稿」徽标 + 淡琥珀底；中性行零改动 |
| 3 | 覆盖范围 | **卡②五键分色 + 背景档案折叠区标题行整体「不可篡改」徽标**（档案整体即人确认事实集，§2.6.3） |

## 3. 范围

### 3.1 做

1. 新建 `src/studio/stage0/premise-facts.ts` 纯函数层：`selectPremiseConfirmation(facts)` 五键 → 'human'|'ai'|'none'（import 复用 008 matchChainTopic 词表，chain.ts 零 diff；禁 fs / window.api / Date / 随机，零 import 副作用）；
2. `src/studio/Stage0View.tsx` PublishedBody：useCaptureFacts 订阅 + 卡②五键行分色与行尾徽标 + 背景档案标题行徽标 + 行容器 overflow-hidden（底色圆角正确性）；
3. `src/studio/Stage0Chain.tsx`：useCaptureFacts 加 export（一词 diff，008 文件复用留痕，hook 本体零改动）；
4. 测试：`src/studio/stage0-premise-facts.test.tsx` 新建（**净增恰 1**；既有测试全零 diff——008 T5 已埋 capture 空桩，空 facts → 全 none → 视觉零变化，断言全兼容）；
5. 治理收尾：README 总表增 009 行、偏差清单 B-44 登记并关闭、变更记录回填。

### 3.2 不做（显式排除）

- **缺口 #6 中栏定案卡「查看历史」不做**（同 feature-008 §4.2 口径：feature-004 已在 StudioViewer 落地 brief 查看历史）；
- 卡①六要素不分色（设计书 L379 分色仅及「故事前提卡」；六要素为商业口径，非「人确认事实」语义）；
- 编辑态 BriefEditPanel 零 diff（分色是定稿只读呈现语义；编辑中人正在改，无「不可篡改」语境）；
- 背景档案 md 正文内逐段分色不做（需档案结构化标记、依赖 Agent 写档格式，重；整体徽标已足 §2.6.3 语义）；
- 事实来源 quote 悬停回溯不做（B-15 来源回溯由 CaptureBar 区承载；卡②不加新交互）；
- 链态条（Stage0Chain）呈现零 diff；CaptureBar 零 diff；画布 DAG 零 diff；empty/loading/brief-error 三态零 diff；
- dev-mock 零 diff（published 态卡②在 dev-mock 不可达——select.ts BRIEF_NODE_ID 判定致 empty 态，stage0-view.test.tsx L197 用例同口径；分色目验全走单测，T7 仅零回归目验）；
- Agent 指令层（showrunner.md）零 diff；`shared/types.ts` / `electron/**` / preload / `global.d.ts` / `package.json` / 配置文件零 diff——**K1/K8/K9 全零触发**。

## 4. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | selectPremiseConfirmation 真值表：confirmed 存在 → human；仅 infer+pending → ai；无命中 → none；返回五键全覆盖；中文别名命中；六要素/未命中 topic 不打扰 | 单测组① |
| AC2 | published 卡② human 行：淡绿底 + 行尾「不可篡改」徽标 + data-stage0-premise-confirmation="human"；ai 行：淡琥珀底 + 「AI 拟稿」徽标 + "ai"；none 行：无徽标无底色 + "none" | 单测组② |
| AC3 | 背景档案折叠区标题行挂「不可篡改」徽标（data-stage0-background-seal）；既有折叠交互（点击展开正文 / NOT_FOUND 静默 / TOO_LARGE 弱化）零回归 | 单测组② + 既有用例全绿 |
| AC4 | capture emit 联动：新增 confirmed fact → 对应行 ai/none → human 翻转（同广播源） | 单测组② |
| AC5 | 既有测试全零 diff 且全绿：全量 59 文件 → 60 文件（净增恰 1）、passed 净增恰新例数、0 failed、1 skipped；typecheck 恰 3 条历史基线零新增 | T6 全量回归 |
| AC6 | 新文案「不可篡改」「AI 拟稿」与凭据族全 src 零碰撞（建包前已 Grep 验证零匹配） | T6 静态验证 |
| AC7 | dev-mock 零 diff 零回归目验：empty 态链态条 / CaptureBar 呈现不变 | T7 |
