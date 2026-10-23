# feature-009 · 前提卡分色 + 不可篡改水印 · 设计说明

> 版本：v1.0（2026-10-21）
> 本文记录本包的方案取舍（D1-D7）。实施细节以 [SDG-RE-契约.md](./SDG-RE-契约.md) 为唯一事实源，本文不重复契约逐字内容。

## D1 分色数据源 = 已捕获口径词表匹配（用户拍板）

- **取舍**：分色判定不新增任何持久化字段、不改 `shared/types.ts`（K1 零触发），纯 renderer 侧用 feature-005 的 `CapturedFact`（source × status）+ feature-008 的 `matchChainTopic` 词表推算。
- **依据**：§2.6.3 L184「人提供（或确认）的原始事实」语义与 CapturedFact 模型天然同构——`source='user'` 缺省推导必为 `confirmed`（types.ts L169）；`source='infer'` 被确认后 status 翻 `confirmed`，正是「AI 先编、人确认」的闭环落点。词表匹配（topic → premise 五键）在 feature-008 已完成并全绿，复用即得 K1/K8/K9 全零。
- **备选否决**：① brief.premise 增加 per-key confirmed 字段 → 触发 K1（改共享类型）+ 双写一致性负担，否决；② 以立项单版本快照比对 → 快照无语义来源信息，否决。

## D2 独立 premise-facts.ts，不并入 chain.ts

- **取舍**：新建 `src/studio/stage0/premise-facts.ts` 承载 `selectPremiseConfirmation`，chain.ts / select.ts 零 diff。
- **依据**：chain.ts 的职责是「立项过程链式呈现」（008 已闭环，27 例测试锁定）；premise 分色判定是「前提卡呈现」语义，消费方是 Stage0View 而非链态条。独立模块保持 008 产物零回归面，且 import 复用 matchChainTopic / PREMISE_FIELDS 无任何复制代码。

## D3 useCaptureFacts 一词 export 复用，不复制 hook

- **取舍**：Stage0Chain.tsx L15 `function useCaptureFacts()` → `export function useCaptureFacts()`，PublishedBody 直接订阅同一 hook。
- **依据**：hook 本体（captureList 首拉 + alive 标志 + onCaptureChanged 全量替换 + 退订）与 Stage0View 所需完全一致；复制 12 行会产生双份订阅逻辑漂移风险。一词 diff 是 008 文件上的最小触碰，留痕于文件头注释。
- **影响面**：Stage0Chain 内部调用点不变；链态条呈现零 diff；stage0-chain.test.tsx 与本包零交集。

## D4 行级底色 + 行尾徽标，不改 LeafValue 文字变色（用户拍板）

- **取舍**：分色落在**行容器**（背景色）+ **行尾圆角徽标**（不可篡改 / AI 拟稿），LeafValue 与 label span 本体零 diff。
- **依据**：① LeafValue 已有三态色语义（'待定' 中性徽标 / 空串「—」/ font-bold text-ink），再叠加文字变色会造成双套色彩语义竞争；② 行级底色与 008 链态条 stepBadge/gateBadge 的「行 = 状态载体」模式同构；③ 徽标色值直接沿用既有同族绿（#1E9E66 / #B9E8D2 / #E7F8F0，与「已定稿」「门批准入」同族），视觉一致性零新增色板。
- **备选否决**：逐值比对（同键 confirmed 值 vs 当前 brief 值逐字符匹配）→ 编辑后值漂移会误降级为 ai，与「人确认过即人确认事实」的保守口径冲突，否决（契约 §1「confirmed 优先」）。

## D5 背景档案徽标挂在折叠区标题行，不进 md 正文（用户拍板）

- **取舍**：`data-stage0-background-seal` 徽标追加在 button 内「故事背景档案.md」之后；md 正文逐段分色不做。
- **依据**：档案整体即人确认事实集（§2.6.3），标题行整体徽标已足额表达「不可篡改」；md 正文逐段分色需档案结构化标记、依赖 Agent 写档格式，重且超出缺口 #5 范围（需求规格 §3.2 显式排除）。
- **兼容**：既有断言 `getByRole('button', { name: /故事背景档案/ })` 为正则匹配，徽标文案进入 accessible name 不碰撞。

## D6 编辑态 BriefEditPanel 与卡①六要素零 diff

- **依据**：分色是**定稿只读**呈现语义（「人确认的事实不可篡改」只在定稿语境成立）；编辑中人正在改，挂「不可篡改」徽标自相矛盾。卡①六要素为商业口径（题材/集数/时长/基调/目标平台/受众），设计书 L379 分色仅及「故事前提卡」，不扩张。

## D7 既有测试全零 diff 的可行性 = 008 T5 空桩前瞻红利

- **依据**：feature-008 T5 已在 stage0-view.test.tsx 埋 captureList 空 facts + onCaptureChanged 空退订桩 → PublishedBody 新增订阅后返回空 facts → 五键全 none → 无 seal 无底色追加 → 全部既有断言天然兼容，本包既有测试文件零 diff、净增恰 1（59 → 60）。
- **dev-mock 分工**：published 态卡②在 dev-mock 不可达（select.ts L28 BRIEF_NODE_ID 判定 vs dev-mock 节点 id='n-brief'），故分色目验全走单测，T7 仅做空态零回归目验（链态条 / CaptureBar 呈现不变），dev-mock 零 diff。

## 决策卡口自查

| 卡口 | 结论 |
|---|---|
| K1 共享层 | 零触发（types.ts / electron / preload 零 diff） |
| K8 依赖/配置 | 零触发（package.json / 配置零 diff，remarkGfm 等既有依赖复用） |
| K9 测试基线 | 净增恰 1 文件；typecheck 恰 3 条历史基线零新增 |
