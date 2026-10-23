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

---

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
