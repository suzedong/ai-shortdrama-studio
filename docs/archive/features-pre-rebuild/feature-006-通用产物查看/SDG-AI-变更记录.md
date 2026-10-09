# SDG-AI 变更记录 · feature-006 通用产物查看

> 三分类：决策记录（永久）/ 实施记录（落地清理）/ 修订记录（闭环清理）。

## 一、决策记录（永久保留）

### D-001 · K6 新增业务包 feature-006「通用产物查看」

- 日期：2026-10-04
- 卡口：**K6（新增业务包/顶层目录）**
- 触发：用户提出「不管立项还是其他阶段，查看功能都很重要；只有查看了才能知道问题、采取修改」。
- 决策：新建任务包 `docs/features/feature-006-通用产物查看/`，把「查看」从背景档案特例升级为覆盖全部 9 个画布节点、贯穿立项/故事/剧本三阶段的一等只读入口。
- 用户签字：**已批准（2026-10-04，AskUserQuestion）**。
- 范围边界：
  - 复用现有产物富卡片与消息流，不新增 IPC、不引依赖（不触发 K9）；
  - 不改 `shared/types.ts`（`EntryAction` 已含 `'view'`，不触发 K1）；
  - 不做多版本列表、内联编辑、导出/批注（见需求规格 §5 非目标）。

### D-002 · 查看入口形态：整卡可点（借鉴 MiniMax Design）

- 日期：2026-10-04
- 卡口：无（交互设计决策，记永久以锚定范式）
- 决策：done/invalidated 节点**点击卡片本体即打开只读查看**（对齐《短剧Agent平台设计.md》「点击节点 → 查看/定位」与原型 `.node{cursor:pointer}`）；hover 动作区保留 👁/✎/💬 作为快捷入口。
- 理由：用户反馈查看按钮 hover 才浮现、难以发现；整卡是最大且最直觉的目标。
- 状态规则：pending/active 无内容节点不可点；查看不受门控/失效/加载清空，始终只读可用。

### D-003 · 失效节点可查看上一版旧内容

- 日期：2026-10-04
- 卡口：无
- 决策：invalidated 节点保留查看能力，展示旧世代最后一版产物，并以「⚠ 已失效·旧版本」徽标明确区分，避免误当当前结论。
- 用户签字：**已确认「定稿+失效都可查看」（2026-10-04）**。

### D-004 · 修订立项单查看为「创意简报 + 视觉风格」复合内容

- 日期：2026-10-04
- 卡口：无（规格缺陷修正，Reverse Sync：先改文档后改代码）
- 触发：真机查看发现「立项单」画布卡片摘要是创意简报五要素（题材/平台/时长/画幅/风格），点开却显示 0-c 视觉风格方案（形态/主画风/L2锚词…），点开前后内容错位。
- 根因：v1.0 契约误把 brief 节点的查看 kind 映射为 `visual-style`；实际画布 brief 摘要与选题诊断底部简报同源（诊断时产出的 `brief` 消息）。
- 决策：
  1. brief 查看 kind 改为 `brief`，返回复合内容：上半 BriefCard 创意简报（与画布摘要、选题诊断底部一致），下半 VisualStyleView 视觉风格；视觉风格未生成时显示「视觉风格尚未生成」；
  2. 选题诊断底部创意简报保留；
  3. 不新增 kind 字面量、不改 shared/types.ts（复用现有 `'brief'` kind，复合数据经 `ViewerContent.extra` 传递）。
- 用户签字：**已确认两项决策（2026-10-04，AskUserQuestion）**。
- 影响文档：需求规格 §功能范围内容来源表；契约 v1.1 §3/§4/§9；设计说明 v1.1 §4.1。

### D-005 · 立项单聚合「选题诊断结论」摘要

- 日期：2026-10-04
- 卡口：无（Reverse Sync：先改文档后改代码）
- 触发：用户提供《安妮的夏天》真实工作流参考（`~/Documents/Dufs/AI短剧工作流/安妮的夏天/主页.html`、立项单 v3），指出立项阶段展示可借鉴。
- 事实：参考工作流的立项单是聚合文档——立项五要素、视觉风格设定、对标案例摘要、立项结论、确认记录；我们此前立项单只有简报 + 视觉风格，诊断结论与对标案例必须跳转「选题诊断」节点才能看到。
- 决策：立项单末尾新增「选题诊断结论」段：`diagnosis.conclusion` 原文 + 对标案例精简表（名称/平台·成绩/一句启示），数据复用最后一条正式 diagnosis 消息；diagnosis 不存在时整段省略；用户洞察/钩子模式/合规风险等完整内容仍只在「选题诊断」节点，不重复。
- 用户签字：**已确认「加诊断结论摘要段」（2026-10-04，AskUserQuestion）**。
- 影响文档：需求规格内容来源表（brief ③）；契约 v1.2 §3/§4/§9；设计说明 v1.2 §4.1。

### D-006 · 查看器标题区显示数据来源文件

- 日期：2026-10-04
- 卡口：无（Reverse Sync：先改文档后改代码）
- 触发：用户上传截图圈红框（标题右侧空白区），要求「在红框区域显示数据来源于那个文件」——打开查看器即知内容对应会话目录的哪个磁盘文件。
- 事实（来源映射，核对 [electron/session.ts]）：
  - idea / diagnosis / brief / outline / profiles / scenes / dialogue / storyboard 共 8 个节点的正式产物均存于 `chat.messages.json`（消息流为事实源；ideaText 由 replay 从用户消息派生）；
  - background 节点内容存于 `故事背景档案.md`，但档案走独立模态，不经 ProductViewer，不加来源标注。
- 决策：
  1. `ViewerContent` 新增必填字段 `sourceFiles: string[]`（相对会话目录文件名；复合产物按出现顺序去重）；当前 resolveViewer 全部返回 `['chat.messages.json']`；
  2. ProductViewer 头部在标题与徽标之间渲染 `来源：{sourceFiles.join('、')}`（12px 灰色，`data-testid="viewer-source"`）；数组为空时不渲染。
- 用户签字：需求由用户截图直接指定（2026-10-04）。
- 影响文档：需求规格 US-3b + 节点来源文件表；契约 v1.3 §3/§4/§9；设计说明 v1.3。

### D-007 · K8 新增只读 IPC session:read-finalized + FinalizedSnapshot 双端镜像

- 日期：2026-10-04
- 卡口：**K8（新增 IPC 通道 / DTO）**
- 触发：用户质疑「立项信息都存到 chat.messages.json 合适吗，以后清空对话记录，立项信息不都没有了」。
- 事实（核对代码）：消息流 `chat.messages.json` 之外本就存在下游实际读取的独立定稿文件——`brief.json`、`剧本/{故事大纲,人物小传,分场,台词}.json`、`分镜/shotlist.json`；清空对话丢失的是消息流，定稿文件仍在。
- 决策：
  1. 新增无入参只读 IPC `session:read-finalized`，主进程 `readFinalized()` 汇总上述 6 类定稿文件为 `FinalizedSnapshot`；任一文件缺失/损坏只跳过该字段，纯零写入，无会话抛 `NO_SESSION`；
  2. `resolveViewer` ctx 增可选 `finalized`，仅当消息流无正式产物（`lastFormal` 为 undefined）时回退，回退产物 `status='done'`、sourceFiles 标定稿文件；消息流有产物时一律以消息流为准（杜绝双源歧义）；
  3. 硬边界：idea（创意原文无独立文件）、完整 diagnosis（仅 conclusion 落 brief.json）不可回退；回退 brief 的诊断段只渲染 conclusion 原文、无对标案例表；
  4. hydrate 额外读 snapshot：节点状态 replay 优先、snapshot 仅补 done（idea/diagnosis 不补），产物 state 空时兜底；phase/gate/activeUnlock/activeDraft 不从 snapshot 恢复。
- 类型归属：**FinalizedSnapshot 在 `electron/session.ts` 与 `src/lib/viewer.ts` 各定义一份结构相同的类型**。理由：共享层 `shared/types.ts` 只读（K1 不改），且 renderer tsconfig（include src/shared）与 electron tsconfig.node.json（include electron/mcp/shared）交集仅 shared/，无共同可放位置；沿用项目既有 `global.d.ts` 镜像 api 返回类型的约定。
- 用户签字：**已批准 K8 及 v1.4 四份规格（2026-10-04，NotifyUser）**。
- 影响文档：需求规格 v1.4 US-8；契约 v1.4 §10；设计说明 v1.4 §7；任务清单 v1.4 T6/T7、AC-10。

### ⛔ 反转 · D-007 第 3 条硬边界被 feature-007 反转

- 反转日期：2026-10-04
- 反转包：feature-007「数据治理（消息流瘦身与业务事实源分离）」D-004。
- 被反转内容：D-007 第 3 条「idea（创意原文无独立文件）、完整 diagnosis（仅 conclusion 落 brief.json）不可回退」。
- 反转原因：feature-007 新增 `idea:save` / `diagnosis:save`，idea.json 与 diagnosis.json 成为独立定稿文件，FinalizedSnapshot 同步扩 idea / diagnosis 两字段；消息流清空后 viewer 可正常回退这两个节点，来源标签显示 idea.json / diagnosis.json。
- 用户签字：**已批准 feature-007 四份规格（2026-10-04，NotifyUser）**。
- 保留内容：D-007 其余条款（read-finalized IPC、消息流有产物时优先、双端镜像、hydrate 规则）仍有效；本条原文字不删除，仅以本反转块标注。

## 二、实施记录

（编码阶段追加；纯实施落地后以 📝 修订注清理）

## 三、修订记录

（修正/反转/闭环旧条目时追加）
