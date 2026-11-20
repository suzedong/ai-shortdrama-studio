> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# feature-010 变更记录：对话内缺口追问 chip 与发卡拍板提示（qh）

> **治理**：三段留痕制——D（决策）/ T（任务实测）/ X（修复）；格式对齐 feature-009 包

---

## D 节 · 决策留痕

### D-001 建包登记（2026-10-23）

- **事项**：「新建→立项」链路盘点缺口 #7 = B-35 遗留切片「对话内缺口追问快捷答复 chip + 发卡卡内拍板提示（qh）」；候选 A/B/C 三案呈报后，用户拍板「**按候选 B 执行，先核对 Stage0View 卡①的实现程度**」。
- **用户拍板**（需求规格 §2 四项）：
  1. 路径 = 候选 B（chip + qh 优先；候选 C 卡①折叠/内嵌直改仅备案不动）；
  2. chip 协议与形态 = 新增专用块【追问选项】+ 横向胶囊渲染（与 .opt 竖排卡片双形态并存）；
  3. chip 点击语义 = 代发 chip 文字原文（所见即所发，与手打同路径）；
  4. qh 触发 = 系统直做自动追加（渲染层识别 pendingGate.gateId==='0-final' 挂固定文案琥珀条，零指令负担，合 D-016）。
- **卡①核对结论（备案）**：Stage0View published 只读态（L475-515）五区块全展开无折叠、六要素只读（可改须走 BriefEditPanel 修改立项流程，D-017 产物）——与设计书 §2.6.8 L378「可折叠/内嵌可改」差异属实；本包不处理，待用户另行指示。
- **建包前取证（全部只读零改动）**：
  - ChatComposer.tsx 全链路精读（L1-260 / L298-390 / L428-680）：parseChatOptions 三分支扩展点（L148/L174/L187）、OptionCard 样式真值、pickOption 本体即 onSend（L549-554）、GateCardView 两挂载点（L651-653 / L668-675）、demoChatItems 结构（L298-368）；
  - showrunner.md L78-138：纪律 9 词表已含【缺口追问】【就绪 · 发卡】；纪律 10 首句已枚举「缺口追问快答」；剧本 7 唯一定案门 gateId='0-final'；纪律 8/剧本 8 口头拍板真实口令「行，就按这版发布」；
  - 原型 L766-772 / L1806-1823 / L2285-2288：.cr .chip / .qh 样式与交互逐值取证；
  - 偏差清单下一可用编号 **B-45**；
  - **禁用串零碰撞验证 ✅**：`拍板提示|追问选项|data-chat-chip|data-chat-gate-hint|ChipRow|GateHint` 全 src 零匹配。
- **偏差登记**：qh 文案 [改编]（原型「行，开始讲故事吧」→ 纪律 8 真实口令「行，就按这版发布」，需求规格 §5.1 呈报）；chip picked 态区分 [改编]（原型仅演示全置灰，本包 picked 紫底白字 + 同组禁用，设计说明 D5）。
- **卡口预判**：K1 / K8 / K9 全不触发（设计说明自查表）；测试文件净增恰 1（60→61）为包内登记事项。
- **状态**：五文件齐备，**待用户批准**。

### D-002 卡①备案切片闭环（2026-10-27）

- **事项**：D-001「卡①核对结论（备案）」遗留两项差异，用户另行指示已到——拍板「**直接修 + 登记偏差**」（循 B-35/B-36 先例，不建包）。
- **用户拍板**（两项）：
  1. **五区块折叠 = 做**：`DiagnosisSections` 节题行点击开合（Stage0View.tsx，三消费点同源：只读卡 / BriefEditPanel 编辑卡 / StudioViewer 立项单），默认仅「结论」节展开、其余长文节收起，无题节（兜底/前置段）恒展开；
  2. **「内嵌六要素可改」= 已满足不改**：用户认定 D-017 BriefEditPanel 卡①原位切换编辑态即设计书 §2.6.8「字段直接可改，不再设独立 tab 审批页」之本意落地。
- **落地**：纯 renderer 单组件改造（▸/▾ 开合 + `data-diagnosis-section-toggle` 凭据 + aria-expanded），shared/electron/package 零 diff，**K1/K8/K9 零触发**；stage0-view.test.tsx 新增 1 例（默认态/开合/结论可收），studio-viewer.test.tsx B-32 例改折叠语义。
- **验证**：全量 **61 文件 722 passed / 0 failed / 1 skipped**（721+1 净增），typecheck 恰 3 条历史基线零新增；过程中发现 runtime-integration 环境性失败（pnpm 拦截 opencode-ai postinstall → spawn ENOEXEC，与本改无关），按官方指引 `node postinstall.mjs` 修复后全绿。
- **偏差登记**：同步更新 [设计现状与偏差清单.md](../../设计现状与偏差清单.md) B-45 行尾。

### D-003 单 turn 多段思维链分段显示（2026-11-01，B-48）

- **事项**：真机上报——一个 turn 内 reasoning → tool.call → tool.result → 再 reasoning 多段交替时，第一段推理正常显示，工具结果返回后的第二段及以后推理界面不出现。根因：[chat-runtime.ts](../../../src/lib/chat-runtime.ts) 仅有 `turnReasoning`（joinParts 把全部 reasoning part 拼为单串），[ChatComposer.tsx](../../../src/studio/chat/ChatComposer.tsx) 单块 `ReasoningDetails` 无分段概念。
- **用户拍板**：「修思维链分段显示 + 登记偏差」（循 B-18~B-47 不建包直接修先例）。
- **落地**：
  1. [chat-runtime.ts](../../../src/lib/chat-runtime.ts) 新增 `turnReasoningBlocks(turn)`——按 reasoning part 首次出现顺序逐段返回，parts 无 reasoning 时回退单段 deltaPreview.reasoning；
  2. [ChatComposer.tsx](../../../src/studio/chat/ChatComposer.tsx) 新增 `ReasoningBlocks`：每段独立折叠块，多段标签「推理过程 n/总数」、单段「推理过程」，流式态最后一段默认展开；AgentTurn（流式）与历史气泡（`item.reasoningBlocks`）同源消费；
  3. [StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx) 定稿转 item 时携带 `reasoningBlocks`。
- **卡口**：纯 renderer/lib，**K1/K8/K9 零触发**（shared/electron/package 零 diff）。
- **验证**：[chat-runtime.test.ts](../../../src/lib/chat-runtime.test.ts) +3 纯函数用例、[chat-liveness.test.tsx](../../../src/studio/chat/chat-liveness.test.tsx) +4 组件用例；全量 **76 文件 935 passed / 0 failed / 1 skipped**（T8 首次受遗留 mock 桩占 4099 影响，清理后单跑 8 passed 全绿），typecheck 恰 3 条历史基线零新增。
- **偏差登记**：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) B-48。

---

### D-004 OptionCard 交互契约移交 feature-817（2026-11-15）

- **原因**：用户拍板按 MiniMax Design 真实形态对齐，编号选项需要选择暂存、下一步、自定义回答和可选步骤/推荐。
- **变更**：本包 D-001 的 OptionCard 零 diff 约束自此废止，由 feature-817 契约接管。
- **不变**：追问 ChipRow 单击直发、用户原文 quote/capture、确认门和会话回放；feature-001 首问不改。

## T 节 · 任务实测留痕

### T1 基线冻结（2026-10-23）

- 全量测试 `npm run test:run`：**60 文件 704 passed / 0 failed / 1 skipped**（705 total）✅
- `npm run typecheck`：恰 3 条历史基线（canvas-zoom.test.tsx TS2322 L13 + TS6133 L90、runtime-client.test.ts TS2741 L45，exit code 2 预期）✅
- 禁用串 `拍板提示|追问选项|data-chat-chip|data-chat-gate-hint|ChipRow|GateHint` 全 src 零匹配 ✅

### T2 parseChatOptions 扩展（ChatComposer.tsx，5 笔编辑）

- 区段注释追加【追问选项】块说明一行；签名加 `chips?: string[]`；闭标签正则加 `追问选项`；块体分支（`closeM[1]==='追问选项'` → 逐非空行 trim 收 chips，<2 行整块不识别，不经 OPT_LINE）；开标签正则同步；tail 半截判定加 `'【追问选项】'.startsWith(tail[1])`。
- 留痕：契约 §5 称 parseChatOptions「未导出」与磁盘实况（`export function`，chat-markdown.test.tsx L6 本就 import）不符——笔误，不影响实现与测试策略，T9 勘误契约该行。

### T3 ChipRow 组件 + 两挂载（ChatComposer.tsx，3 笔编辑）

- ChipRow 组件（OptionCard 之后）：横向 `flex flex-wrap` 胶囊，picked=紫底白字三元分支优先（不挂 opacity-40，与 OptionCard 同构），disabled=opacity-40；凭据 data-chat-chips / data-chat-chip / data-picked。
- items 渲染消费点：`pickedChip = next?.role === 'user' ? next.text?.trim() : undefined`；OptionCard 块后挂 `<ChipRow chips={opt.chips} disabled={consumed} pickedChip={pickedChip} onPick={pickOption} />`；流式气泡挂 `disabled` 只展版。

### T4 GateHint 组件 + 两挂载（ChatComposer.tsx，3 笔编辑）

- GateHint 零 props 固定文案琥珀条（💡 拍板提示 / 「行，就按这版发布」= 按钮拍板……），凭据 data-chat-gate-hint。
- 两挂载：`pendingGate?.gateId === '0-final' && <GateHint />`（流式气泡内 GateCardView 之后 + 流式结束后独立 GateCardView 块之后）。

### T5 指令层增补 + demo d9（showrunner.md + ChatComposer.tsx，2 笔编辑）

- showrunner.md 纪律 10 增补「缺口追问快答 →【追问选项】块」一行（块协议 + 点击代发原文即 quote 天然满足纪律 11 + 开放式追问不用选项块）；纪律 9 词表零改。
- demoChatItems d9：【缺口追问】+【追问选项】三条候选（核心冲突类），末条可点演示。

### T6 新建 chat-chips.test.tsx（17 例）

- `npx vitest run src/studio/chat-chips.test.tsx`：**17/17 一次全绿**（1.39s）。组① 解析渲染 7 例 + 组② 集成 10 例；测法对齐 chat-markdown.test.tsx 双轨。
- 遗漏：CanvasGate 未导入（误判为全局 ambient 类型）——T7 捕获，见 X-001。

### T7 全量回归 + 静态验证

- 全量测试：**61 文件 721 passed / 0 failed / 1 skipped**（722 total = 恰 704+17）✅
- typecheck：首跑 5 条（3 基线 + 2 新增 TS2552）→ X-001 修复后复跑 **恰 3 条历史基线零新增** ✅
- K1/K8 复核：`git status --porcelain -- shared/types.ts package.json electron/ src/lib/ipc*` 输出为空（零 diff）✅
- 禁用串复查（排除测试文件自身）：仅 ChatComposer.tsx 契约允许位 11 行命中（L291/303/310/328/330/333/336/697/721/728/748）✅

### T8 dev-mock 目验（2026-10-23，Playwright MCP，localhost:5173 复用既有 vite dev server 经 HMR 同步最新代码）

- **d9 chips 上屏 ✅**：【缺口追问】气泡内三胶囊（家族反对，门第差距 / 前任回归，旧情未了 / 身份秘密，真相将揭）flex-wrap 两行呈现，初始全可点（disabled=false）无 picked；DOM 凭据 data-chat-chips / data-chat-chip 齐。截图 t8-chips-onscreen / t8-chips-closeup（Downloads）。
- **点击代发 ✅**：点击「家族反对，门第差距」→ 用户气泡逐字原文上屏（== chip 文字）；该 chip data-picked=true 紫底白字（text-white、无 opacity-40 不压暗），同组另两条 disabled=true + bg-violet-soft + opacity-40 压暗。截图 t8-chips-picked。
- **hover 态 ✅**：刷新页面后 hover「前任回归，旧情未了」→ `matches(':hover')`=true，计算样式 bg=rgb(108,92,231) 白字（hover:bg-violet hover:text-white 生效），其余两条维持浅紫。截图 t8-chips-hover。
- **disabled 态 ✅**：点击后全组 consumed 置灰禁点（上条同证）。
- **qh 目验豁免**：dev-mock 无真实 0-final 门（任务清单 T8 预期内），由单测 2-6 / 2-7 / 2-8 覆盖三态。
- **附带观察**：点击代发后底部现「运行时启动失败，请稍后重试」红条——dev-mock 浏览器环境无真实 agent runtime 的预期现象，与本包无关（代发动作本身已完成，用户消息已上屏）。

### T9 治理收尾（2026-10-23）

- 变更记录 T1-T9 全序列回填 + X-001 登记（本节即证）。
- 契约 §5「未导出」笔误勘误：parseChatOptions 实为 `export function`（chat-markdown.test.tsx L6 本就 import）；实现语义与测试策略不变（双轨照旧、导出面零 diff 照旧）。
- [设计现状与偏差清单.md](../../../设计现状与偏差清单.md) B-45 新行落表翻 ✅（2026-10-23）。
- [docs/features/README.md](../README.md) 0xx 段增 feature-010 索引行。
- 任务清单 T1-T9 checkbox 全勾。
- 向用户呈报 T1-T9 实测摘要 + 全量回归数字 + 治理文件 diff 清单，请求验收。

---

## X 节 · 修复留痕

### X-001 chat-chips.test.tsx 补 CanvasGate 导入（2026-10-23）

- **现象**：T7 typecheck 报 2 条新增 TS2552 `Cannot find name 'CanvasGate'`（chat-chips.test.tsx L33/L60）。
- **根因**：T6 遗漏 import——误判 CanvasGate 为全局 ambient 类型（类比 StyleCatalogEntryDto 可无 import 使用）；实际 CanvasGate 定义于 shared/types.ts L391，需显式导入。
- **修复**：文件头补 `import type { CanvasGate } from '@shared/types'`（对齐 ChatComposer.tsx L9 写法与 brief-impact / chat-runtime / brief-history 等 5 处既有测试先例）。
- **验证**：typecheck 复跑恰 3 条历史基线零新增 ✅；单文件复跑 17/17 全绿（1.27s）✅。

### X-002 闭合协议块仅在消息末尾才识别，块后跟补充句则整块降级纯文本（2026-11-01，B-59）

- **现象**：真机上报（test 项目立项对话）——「先定平台」的【选项】块（6 个平台候选）未渲染为可点按钮，块原文逐字显示在气泡正文；连带平台口径无法经点击选定、口径捕获停在 5 条。
- **根因**：[ChatComposer.tsx](../../../src/studio/chat/ChatComposer.tsx) 闭合块分支以 `【/(…)]】$` 锚定消息末尾；Agent 本次在块后追加「其余要素如无异议我就按上表预填……」一句，闭合标签不在末尾 → 整块不识别。三类协议块（【选项】/【风格选项】/【追问选项】）同受影响。
- **修复**：闭合块正则改为非锚定 `/(^|\n)【(风格选项|选项|追问选项)】([\s\S]*?)【\/\2】/`，块前正文与块后正文均拼回 rest；定稿 segments 与流式 segments 两处段级剥离增加 `options/chips` 分支（闭合块统一由气泡级 trailing 渲染，避免按钮 + 原文重复），剥离后空 text 段移除。
- **卡口**：纯 renderer 解析层，**K1/K8/K9 零触发**。
- **验证**：[chat-markdown.test.tsx](../../../src/studio/chat/chat-markdown.test.tsx) 失配降级断言移除「块不在末尾」负例，新增 B-59 解析 + 渲染两用例（按钮渲染、补充说明保留、块原文不残留、点击代发「1」）；[chat-chips.test.tsx](../../../src/studio/chat/chat-chips.test.tsx) 1-4 改为块后正文场景的正例。全量 **76 文件 953 passed / 0 failed / 1 skipped**（净增 2），typecheck 恰 3 条历史基线零新增。
- **遗留**：同一条 text 内出现多个闭合块时只处理首个（其余原文保留），非当前真实形态，不扩展。

### X-003 AI 气泡无兜底身份标签 + 不显示实际使用模型（2026-11-01，B-60）

- **现象**：真机上报（test 项目右栏）——①带 `【AI 反问】` 等协议前缀的气泡有标签，普通汇报 / 历史回放气泡没有标签，同屏两种形态；②所有 AI 气泡都不显示本轮使用的模型，逐消息切换模型后无从确认是否生效。
- **根因**：`ChatComposer` 的 `LabelTag` 只在解析出协议前缀时渲染（用户气泡有「用户」兜底、AI 侧无）；`ChatItem` 无模型字段，[StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx) 定稿入 items 时不写模型快照。
- **修复**：新增 `defaultAgentLabel(agent)` 兜底（缺省「主控 Agent」）与 `BubbleModelLine` 模型小字（`火山方舟 · 模型ID` / `LM Studio · 模型ID`），挂到 segments 路径、旧路径、流式气泡、发送占位气泡、纯门卡气泡五处；`ChatItem` 增可选 `model`，定稿经 `selectedModelRef` 写入实际模型（SSE 订阅 effect 仅订阅一次，用 ref 避免闭包过期值）；历史消息无快照时回退当前选择器。
- **卡口**：纯 renderer，模型快照只存内存**不持久化**（避免改 `shared/types.ts`），**K1/K8/K9 零触发**。
- **验证**：[chat-markdown.test.tsx](../../../src/studio/chat/chat-markdown.test.tsx) 原「无前缀不渲染标签」断言改为兜底断言，新增模型小字 + 快照优先 2 例。全量 **77 文件 959 passed / 0 failed / 1 skipped**，typecheck 恰 3 条历史基线零新增。

### X-004 立项定案卡整卡挤在门卡标题行（2026-11-01，B-63）

- **现象**：真机截图中 `0-final` 门卡「立项定案卡·首版v1」的六要素 / 前提 5 项 / 风格 / 改动全部挤在标题行一坨纯文本，换行被吞，无法逐项核对。
- **根因**：[GateCardView.tsx](../../../src/studio/chat/GateCardView.tsx) 直接渲染 `gate.question` 为标题行 `<span>`，既无 Markdown 也无 `whitespace-pre-wrap`；提示词侧也未要求 question 用 Markdown 组织。
- **修复**：`splitGateQuestion` 把 question 拆「短标题 + 正文」——多行卡首行去 `#` 作标题、其余进可滚动 Markdown 正文区；旧版单行密文按首个句读（。：；！？）切开，无句读则按 24 字截断。`MarkdownText` 抽到 [ChatMarkdown.tsx](../../../src/studio/chat/ChatMarkdown.tsx) 供气泡与门卡共用（避免 ChatComposer ↔ GateCardView 循环依赖）。提示词新增「定案卡排版」条款（`# 标题` + `## 区块` + `- 字段：值`，禁止 JSON / 英文键名）。
- **卡口**：纯 renderer + 提示词，**K1/K8/K9 零触发**。
- **验证**：新增 [gate-card-layout.test.tsx](../../../src/studio/chat/gate-card-layout.test.tsx) 3 例（Markdown 卡标题 + 列表渲染、短单行无正文区、超长密文按句读切分）。

---

## D-037 归档与迁移覆盖

> 状态含义：**已存在**＝负责包已有同义现行约束；**已迁入**＝已在负责包补写自包含章节；**保留历史**＝原任务、AC、代码路径、测试计数和验证证据只在本包追溯，不作为当前负责入口。仍仅登记去向或冲突的行必须明确接收包与开放事项。
>
> **跨组目标章节**：表中 001 的追问 / 拍板落点为需求 §7.3、契约 §10.4，编号冲突与字段边界为需求 §7.6、契约 §10.7、设计 §4 第 4 / 7 项；013 的 chips / GateHint / 门卡阅读落点为需求 §6.6、契约 §7.4，编号冲突为需求 §6.8、契约 §7.6、设计 §5 第 4 / 6 项。上述标题均已实际建立。

| 原文件 / 章节 | 当前负责包与目标 | 状态 | 覆盖与冲突处理 |
| :-- | :-- | :-- | :-- |
| 需求 §1 背景与现状 | 001（缺口追问 / verbal 协议）+ 013（立项对话与 Stage0 视图）+ 817（chip / qh 视觉） | 保留历史 + 去向登记 | 原型与磁盘取证不改；卡①折叠 / 内嵌直改后来由 D-002 闭环，现行视图归 013。 |
| 需求 §2 拍板 1–2 | 001（【追问选项】块协议）+ 013（解析 / 点击交互）+ 817（ChipRow 形态） | 已迁入 | 候选 B 的协议、交互与视觉分责；不把 chip 会话内容误迁到 808。 |
| 需求 §2 拍板 3 | 001（原文 quote / capture 协议）+ 013（单击代发交互） | 已迁入 | chip 文字原文与手打同路径；视觉选中 / 禁用归 817，业务事实落盘归 001。 |
| 需求 §2 拍板 4 | 001（真实口令与 verbal 双前提）+ 013（门卡挂载）+ 817（琥珀提示视觉）+ 801（pending 门态） | 已迁入 | qh 由 pending 0-final 确定性触发，不自动批准 / 发布；固定文案与门态、展示、交互分责。 |
| 需求 §3.1 第 1–2 项 | 001（块格式与 Agent 协议）+ 013（parseChatOptions 行为） | 已迁入 + 部分被后续条款取代 | “块必须在消息末尾”的旧规则由 X-002 的非锚定闭合块解析取代；块前后正文保留、流式 pending 与 chips 数据形状继续有效。 |
| 需求 §3.1 第 3 项 | 013（点击 / picked / disabled 交互）+ 817（横向胶囊、picked 与禁用视觉） | 已迁入 | ChipRow 单击直发仍不变；817 不接管 quote / capture 或门态。 |
| 需求 §3.1 第 4 项 | 001 + 013 + 817 + 801 | 已迁入 | GateHint 文案 / verbal 归 001，两个既有挂载与门卡交互归 013，琥珀形态归 817，0-final pending 与后续执行归 801。 |
| 需求 §3.1 第 5–6 项 | 001（showrunner 纪律）+ 013 / 817（demo 交互与视觉） | 已迁入 + 保留历史 | 【追问选项】指令归 001；d9 是历史演示证据，不构成新真机完成声明。 |
| 需求 §3.1 第 7–8 项、§4 AC9–AC10 | 原文 | 保留历史 | 60→61、704→721、typecheck 恰 3 条、B-45 与 README 收尾等记录不改，本次不重跑。 |
| 需求 §3.1 C1 / 变更 D-004 | 817（OptionCard 选择暂存 / 下一步 / 自定义 / 推荐）；001 + 013（ChipRow 与 quote 不变）；801（门语义）；808（回放边界） | 已迁入 + 被后续条款取代 | 010 的 OptionCard 零 diff 旧约束由 817 废止；追问 chips、门态与历史回放没有被 OptionCard 改造吞并。 |
| 需求 §3.2 排除项 | 001 / 013 / 801 / 817 各自边界 | 保留历史 + 已迁入 | 卡①后续归 013；ghost / 双主题视觉归 817；编号块与开放式追问协议归 001；qh 仅 0-final 的门态限制归 801。 |
| 需求 §4 AC1–AC5 | 001 需求 §7.3 / §7.6 + 013 需求 §6.6 / §6.8 + 817 | 保留历史 + 已迁入 + 冲突保留 | 协议、解析 / 点击、视觉分别归口；原“非末尾不识别”已由 X-002 修订。AC4“编号混入整块不识别”与契约 R3“编号字样仍按原文收录”已在 001 / 013 同步标为**未裁决**，历史 AC 不改写。 |
| 需求 §4 AC6–AC8 | 001 需求 §7.3 + 013 需求 §6.6 + 817 + 801 | 保留历史 + 已迁入 | qh 三态、showrunner 与 demo 按主题归口；dev-mock 无真实 0-final 门的限制原样保留。 |
| 需求 §5.1 qh 文案 | 001（口令与双前提）+ 817（提示条形态）+ 801（不得绕过门态） | 已迁入 | 「行，就按这版发布」仍是既有 verbal 口令，不因 015 系统直做而伪造门已批准。 |
| 需求 §5.2 d9 文案 | 001（追问内容协议）+ 013 / 817（展示） | 已迁入 + 保留历史 | 三条短剧候选是 demo 内容，不新增立项事实或产品数据。 |
| 契约 §1.1–§1.2 块协议 | 001 + 013 | 已迁入 + 部分被后续条款取代 | 纯文本 chips、≥2 条、流式 pending 与标签叠加归 001 / 013；末尾锚定和单一块旧规则以 X-002 为准，多块只处理首个的遗留限制保留。 |
| 契约 §2 纯函数与依赖方向 | 013（解析实现）+ 001（协议来源） | 已迁入 + 被后续条款修订 | 五处正则 / 分支是当时最小 diff；X-002 已改变闭合块正则与段级剥离，不能继续把旧正则当现行唯一事实。 |
| 契约 §3.1 ChipRow | 013 + 817 | 已迁入 | Props / onSend / picked 判定与挂载归 013；胶囊、hover、picked、disabled 与双主题形态归 817。 |
| 契约 §3.2–§3.3 GateHint / 色值 | 001 + 013 + 817 + 801 | 已迁入 | 文案归 001，挂载归 013，色值 / 字体 / 间距归 817，pendingGate 与批准 / 推进归 801。 |
| 契约 §3.4–§3.5 凭据与禁用串 | 013 + 817；历史建包取证 | 保留历史 + 去向登记 | data-chat-chips / data-chat-chip / data-picked / data-chat-gate-hint 是历史断言凭据，不借归并新增接口。 |
| 契约 §4.1 ChatComposer diff | 013 + 817；OptionCard → 817 | 保留历史 + 被后续条款取代 | 文件路径与八处 diff 保留；OptionCard 零 diff 已由 817 C1 废止，chips / qh 现行责任按上表。 |
| 契约 §4.2 showrunner 指令 | 001 + 013 | 已迁入 + 部分被后续条款取代 | 【追问选项】提示词归 001；其“必须位于消息末尾”解析约束由 X-002 修订，纪律 9 标签与块命名空间仍分离。 |
| 契约 §4.3–§4.5 demo / 测试 / 治理文件 | 013 + 817；原文 | 保留历史 | d9、净增恰 1、B-45、README 行与当时 diff 清单不改写为本次写权。 |
| 契约 §5 测试契约 | 001 + 013 + 817 + 801 | 保留历史 + 部分被后续条款取代 | 17 例、60→61、typecheck 基线不改；1-4“块后正文”负例已由 X-002 改正例，不能作为当前行为依据。 |
| 设计 D1–D3 | 001 + 013；ChipRow 视觉 → 817 | 已迁入 | 独立块、原文代发、复用 pickOption 的协议 / 交互归 001 / 013；不新建第二发送通道。 |
| 设计 D4–D6 | 001 + 013 + 817 + 801 | 已迁入 | qh 确定性触发、文案与 verbal 归 001 / 801；挂载归 013；picked 与琥珀视觉归 817。 |
| 设计 D7 / 卡口自查 | 原文 | 保留历史 + 已勘误 | parseChatOptions“模块私有”已由 T2/T9 勘误为既有导出；60 文件 704 passed 等历史数字不改。 |
| 任务 T1–T9 | 001 需求 §7.3 / 契约 §10.4 + 013 需求 §6.6 / 契约 §7.4 + 817 + 801 | 保留历史 + 已迁入 | T2 解析归 013，T3/T4 交互归 013、视觉归 817，T5 prompt 归 001，T4 门态归 801；checkbox 与实测证据不改。 |
| 变更 D-001 / D-002 | 001 需求 §7.3 + 013 需求 §6.6 + 817 | 保留历史 + 已迁入 | 建包 chip / qh 按主题分责；D-002 五区块折叠与 BriefEditPanel 立项视图归 013。 |
| 变更 D-003 多段 reasoning | 808 §6 / §9.2 / §10.2（分段数据与历史回放）+ 817（ReasoningBlocks 展示） | 已迁入 | turnReasoningBlocks、part 顺序、流式 / 定稿同源归 808；多段折叠块视觉归 817。原 76 文件 935 passed 不改。 |
| 变更 T1–T9 / X-001 | 原文；能力按上表归口 | 保留历史 | 17/17、721、T8 dev-mock、qh 未真机目验与 import 修复均保留，不重跑、不改 PASS。 |
| 变更 X-002 闭合块解析 | 001（协议）+ 013（解析 / 交互） | 已迁入 + 取代旧条款 | 非锚定闭合块、块后正文保留与段级剥离是现行口径；953 passed 与多块遗留限制不改。 |
| 变更 X-003 气泡身份 / 模型 | 817（标签与模型行形态）+ 013（立项对话挂载交互） | 已迁入 + 保留历史 | 模型快照当时仅内存、不持久化；不得借 808 归并擅改为共享会话字段。959 passed 与 K1 零 diff 保留。 |
| 变更 X-004 门卡排版 | 001（定案卡 Markdown 提示词）+ 013（GateCardView 布局 / 交互）+ 817（共享对话视觉） | 已迁入 + 保留历史 | splitGateQuestion、MarkdownText 与三例测试是历史证据；现行门卡业务内容、视图和视觉分责。 |

**归档自审**：上述覆盖表逐项指向 001 / 013 / 801 / 808 / 817，或明确保留历史、被 X-002 / 015 / 817 后续条款修订，没有“全部迁移”笼统结论；AC4 与契约 R3 的编号冲突、qh 未真机目验等历史限制均保留。未删除目录、未改历史任务 / AC / 测试计数 / FAIL/PASS。纯文档，**自审 + 无第二人复核**。
