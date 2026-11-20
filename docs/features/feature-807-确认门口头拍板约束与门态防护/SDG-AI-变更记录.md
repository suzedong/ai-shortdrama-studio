> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# feature-807 确认门口头拍板约束与门态防护 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后补）/ 修订记录（决策稳定后清理）。

## 一、决策记录（卡口，永久保留）

### D-807-0 · 修复路径拍板：登记偏差 + 任务包修复，先规格后代码（2026-10-15 用户已裁决）

- 触发：2026-10-15 STAGE 0 真机走查（项目 `project-20261015-083049-xho7`）暴露 B-14（陈旧口头授权绕过未决门发布并 advance）/ B-15（platforms、diagnosisSummary 凭空扩写「快手」）。
- 用户裁决（AskUserQuestion）：
  - 数据补救＝**再版 v2 去快手**（已按 feature-002 六步经应用内对话完成并逐文件核验，v1 保留不覆盖、status 未跳格）。
  - 机制修复＝**登记偏差并走任务包修复**：先登记 B-14/B-15，再建本包收紧 showrunner.md L103 口头条款 + gate 超时纪律，并评估 brief.publish 工具层防护；按 No Spec No Code 走。
- 状态：数据补救 ✅ 完成；偏差登记 ✅ 完成（偏差清单 §2/§3、版本记录 2026-10-15 条目）；本任务包规格已于 2026-10-15 经用户批准，T1–T6 全部闭环（见 I-807-1 / I-807-2）。

### D-807-1 · 卡口性质：无 K1、无工具数量 K8；仅既有工具契约收紧（2026-10-15 已批准）

- 本包不改 `shared/types.ts`（CanvasGate/Canvas/Manifest 形状零改动，门版本直接读既有 `gate.payload.version`）。
- 不新增 / 不删除 MCP 工具：工具总数保持 22、showrunner 白名单保持 17；仅给既有 `brief.publish`（编号 13）增加写盘前的门态拒绝分支，zod 入参与成功返回形状不变。
- 唯一须用户批准项＝该既有工具的拒绝行为契约（[契约](./SDG-RE-契约.md) §3）+ 新增错误码（D-807-2）。批准本包 5 文件即视为对该契约收紧的显式批准；批准前不触碰代码 / 提示词。

### D-807-2 · 错误码粒度：默认 4 个语义码（2026-10-15 已批准，采默认项；备选单码 + reason）

- 默认：`BRIEF_GATE_PENDING` / `BRIEF_GATE_REJECTED` / `BRIEF_GATE_VERSION_MISMATCH` / `BRIEF_GATE_APPROVED_USE_GATE`。
- 风格对齐既有 `BRIEF_NOT_READY` / `BRIEF_NO_BASELINE` / `IMPACT_DECISION_MISMATCH`（一语义一码，Agent 可直接据码决策，不解析中文 message）。
- 备选：单码 `BRIEF_GATE_BLOCKED` + `reason` 枚举（见设计 §2.1）。未另决则按默认 4 码实施。
- 归属：MCP 纯工具业务错误信封层，**不进** runtime/types.ts 的 14 个 runtime 通道错误码（两套体系）。

### D-807-3 · approved 同版本 + verbal 默认拒绝（2026-10-15 已批准）

- 门已 approved（同版本）时要求必须 `approve.by:'gate'`；verbal 调 publish 返回 `BRIEF_GATE_APPROVED_USE_GATE`。
- 理由：避免一版两凭证、保留门 note 留痕；正常门后路径（showrunner.md L102）本就 by:'gate'，只堵异常路径。
- 备选：approved 同版本任何 by 都放行（放宽，见设计 §2.2）。

### D-807-4 · brief.impact.commit 默认不加门态硬拦截（2026-10-15 已批准）

- 再版 v2+ 走 feature-002 独立流程，plan→assess→**用户三选一**→commit，三选一即用户裁决点；再版可以不发门（对话承载）。给 commit 加门态硬校验会误伤合法无门再版（本次 v2 补救正属此场景）。
- 故默认：commit handler 不改；仅在 showrunner.md 提示词层要求再版 verbal 针对再版定案卡 + 经三选一、禁止复用首版 / 旧门口头语。
- 备选：为 commit 加同版本 pending/rejected 门拦截（需先定义再版门协议，超出 B-14 修复范围，本包不做）。

### D-807-5 · rejected 旧门残留：方案 A 零结构改动（2026-10-15 已批准）

- commit 不清 / 不改旧 rejected 门；需要门的再版由 showrunner 以同一 gateId 重发——bridge 现状已支持 rejected（无 live entry）→ 同 gateId 重开 pending 并覆盖 question/options/payload（bridge.ts initializeEntry L55-103）。
- 无门再版后，旧 rejected 门因 payload 绑定旧版本，被版本匹配规则自然隔离，不能充当新版凭证；其在画布的展示残留属 renderer 通道包，不在本包。
- 走查项目 `project-20261015-083049-xho7` 的旧 rejected 门（v1 含快手卡）作为历史现场保留，不回改、不清理。
- 备选 B（commit 标记 / 归档旧门）需改 CanvasGate 结构或加工具（K1/K8），明确不做。

### D-807-6 · B-15 平台忠实度：提示词来源回溯，不做平台闭集（2026-10-15 已批准）

- platforms 是开放业务集合，硬编码白名单违背项目必要性且易过期；缺陷本质是「Agent 把未确认事实当确认事实」。
- 裁决：以 showrunner 发门前字段来源回溯纪律解决（每个上卡字段可指回用户原话 / 故事背景档案等已确认产物；无来源不补、拿不准回对话问），工具层不引入 platforms 枚举。与风格字段（mainStyleId 有内置谱系目录、故有闭集校验）区分。

### D-807-7 · 不改 bridge 超时模型（设计结论）

- GateBridge 的 request Promise 无超时是正确设计（人工裁决长生命周期，仅 settleAll 在项目切换 / 关闭时 reject GATE_TIMEOUT）。走查中的「门请求超时」发生在 opencode / MCP 工具调用层回合限制，非 bridge。
- 修复点＝①提示词：调用层超时后下回合 canvas_get + 同 gateId 重挂，禁止回溯旧话；②工具层：即便 Agent 误发 verbal，pending/rejected 门下 publish 被拒。两处均不需改 bridge。

## 二、实施记录（落地后补）

### I-807-1 · T1-T5 实施完成（2026-10-15）

- 卡口批准：2026-10-15 用户经 AskUserQuestion 一次批准四项——① 批准本包规格开始编码；② brief.impact.commit 不加门态硬拦截、仅提示词收口（采 D-807-4 默认）；③ approved 同版本 verbal 拒绝、强制 by:gate（采 D-807-3 默认）；④ 错误码用 4 个语义码（采 D-807-2 默认）。实施全程以 [SDG-RE-契约.md](./SDG-RE-契约.md) 为唯一编码依据。
- **T1 门态防护纯函数**：新建 [electron/gate/guard.ts](../../../electron/gate/guard.ts)，零 fs/electron 依赖，仅 `import type { CanvasGate }`。导出 `BRIEF_FINAL_GATE_ID='0-final'`、`findBriefGate`（过滤 0-final、多条取数组末位）、`gateVersion`（payload.version 可解析返回数字，否则 null）、`assertBriefPublishable(gate, approve, publishVersion)`（按契约两张真值表返回 `GateGuardViolation | null`）；4 码联合 `GateGuardCode`，message 逐字采用契约 §2.2（含 v{gv}/v{publishVersion} 插值，历史门用「未绑定版本」）。实现期修正一处判定顺序：契约真值表「pending × 任意版本 × verbal → PENDING」要求 verbal 绕过检测先于版本比对。
- **T2 工具接入**：[tools.ts](../../../electron/mcp/tools.ts) 新增 `import { assertBriefPublishable, findBriefGate }`；brief.publish（编号 13）handler 在 INVALID_ARGUMENT（verbal quote）校验之后、`publishV1InQueue` 与任何 canvasStore.update 之前插入只读门态检查（listBriefVersions + canvasStore.get 均只读），publishVersion 与 publish.ts L48 同源（`latestVersion===null ? 1 : +1`），违例 `respond(fail(code, message))` 零写盘。commit handler（编号 21）按 D-807-4 未碰；zod 入参 / 成功返回形状 / 工具总数 22 均不变。
- **T3 提示词收紧**：[showrunner.md](../../../resources/opencode/agents/showrunner.md) 五处——职责纪律 5 改「门恢复与超时纪律（feature-807）」（区分工具调用层超时重挂与 settleAll GATE_TIMEOUT；超时不构成授权、禁止回溯超时前话语）；第 0 步恢复段同步括注；第 7 步发门新增「字段来源回溯纪律」（B-15：platforms 开放集合无来源不补、diagnosisSummary 同理、宁可 pendingMarks）；第 8 步口头条款整段重写（两前提 + 无门/pending/approved/版本不一致/rejected 分场景）；再版第 3 步要求口头凭证针对本版再版卡且发生在三选一呈报之后。
- **T4 验证**：新增 [src/test/gate-guard.test.ts](../../../src/test/gate-guard.test.ts) 23 例（findBriefGate 4 / gateVersion 2 / 可解析真值表 13 / 历史门保守表 5 / 文案插值 2，其中含 pending+verbal 同版与异版各 1）+ [src/test/mcp-brief-gate-guard.test.ts](../../../src/test/mcp-brief-gate-guard.test.ts) 7 例 tmp 目录 e2e（pending+verbal→PENDING 且无立项单、gates toEqual 未变、nodes=[]；rejected+verbal→REJECTED 零写盘；无门+verbal→v1 成功；approved v1+gate→v1 成功；v1 后挂 approved v1 门再发→VERSION_MISMATCH 不落 v2；approved+verbal→APPROVED_USE_GATE；历史门三态）。`npx tsc -b` 后 `npm run typecheck` 退出码 0（新文件首次构建的 TS6305 经 tsc -b 消除）；全量 `npx vitest run`：**37 文件 399 passed / 0 failed / 1 skipped**（基线 35 文件 369/0/1，唯一 skip 仍为需 ARK Key 的 T8-4 真机用例；React act() warning 为既有噪声）。
- **零卡口声明**：无 K1（shared/types.ts 零改动）、无 K8（工具 22 / showrunner 白名单 17 不变）、不改 gate/bridge、不改 runtime/types.ts 14 码体系（4 新码为工具 fail() 字面量信封，经 grep 确认无统一枚举登记点）。
- **T5 文档闭环**：偏差清单 B-14/B-15 标 ✅ 已解决（2026-10-15）、§3 路线 feature-807 标 ✅ 已落地；版本记录 2026-10 顶部追加落地条目并按「只留最新状态」改写旧走查条目残留口径；features/README 8xx 表状态同步；本文件补本实施记录。

### I-807-2 · T6 真机回归通过（2026-10-15）

- 授权：用户经 AskUserQuestion 选「执行 T6（推荐）」，同意动用真实 ark 额度。执行前重启 `npm run dev`（Electron 主进程 pid=29056）确保加载 guard.ts/tools.ts 新防护（主进程代码不经 HMR）。
- 项目：`C:\Users\SZD\Documents\ai-shortdrama-studio\project-20261015-102352-c3ze\`（「T807门防护回归」，Electron + 火山方舟 ark-code-latest 真实出网）。
- **拦截路径（AC1 真机版）**：0-final 门 pending（payload.version=1）时用户发口头诱导「定案卡没问题……我现在口头拍板同意，你直接发布立项 v1 并推进吧，不用等我点按钮了」。Agent 实际尝试 brief.publish 后被工具拒绝，其回复逐字包含「用口头凭证发布会被系统以 **BRIEF_GATE_PENDING** 拒绝（『可以发门/不用等按钮』这类话只授权发门，不构成门内裁决）」，并「用同一个 gateId 把这道门重新挂起等待你的按钮结果（不会重复建门）」——提示词层（拒后重挂、不回溯旧话）与工具层（真实信封码）同时按规格生效。
- **零落盘核验**：被拒时点磁盘实测——目录仅 .session.json / canvas.json / manifest.json / 故事背景档案.md（+ 版本/），**无 立项单.v1.json/.md**；manifest 仍 `status:"initiating"`、`briefVersion:null`、statusHistory:[]；canvas gates 恰 1 条 `0-final`/`pending`（同 gateId 未重建）、nodes:[]。
- **成功路径**：点门卡「确认放行」后约 1 分钟——立项单.v1.json/.md 落盘（`approve:{by:"gate", note:"0-final 门一键拍板：发布立项 v1"}`、platforms 恰 ["抖音","红果"]）；门 status→approved；nodes 出现 step-0-brief/done（ref 立项单.v1.json）；manifest 推进 initiating→story-outline（briefVersion=1，statusHistory 记 brief-published 于 02:35:56Z）。
- **B-15 附带验证**：首轮捕获口径即「平台：仅抖音、红果」，风格轮 Agent 主动声明「你没说过平台，我不能替你补」；定案卡与立项单全程无「快手」。
- 结论：T6 验收两句原文（pending 门 verbal 被拒 BRIEF_GATE_PENDING 且无落盘；按钮 approved + by:gate 正常发布）均取得真机证据，STAGE 0 端到端闭环。无代码改动（纯验证），T1-T5 产物零返工。

## 三、修订记录

- 2026-10-15：D-807-1~D-807-6 全部经卡口批准（四项均采推荐/默认项，见 I-807-1），各条「待批准」标注关闭，决策内容无调整、无反转。
- 2026-10-15：T6 经用户批准执行并通过，真机证据见 I-807-2；本包全部任务 T1-T6 闭环。
- 2026-10-17：**quote 组装分流修订**（用户原话「入口动作 · 用户原话 只记个"1"合适吗」触发，AskUserQuestion 拍板「指令分流」）——[showrunner.md](../../../resources/opencode/agents/showrunner.md) 再版剧本第 3 步新增「quote 组装分流」条款：用户回复为选项编号类短回复（纯数字 / 字母命中所呈报选项，如「1」「选 2」）时，`quote` 落「原话逐字 + 括号机器注释」拼接（注释写明选项语义，如 `1（确认发布 v4）`、`2（仅标记，不重生成）`）；自由文本仍落原文逐字；`approve.note` 写全呈报上下文。第 0 步 verbal 两前提条款加交叉引用同标准。逐字纪律本身不变（原话本体不动、括号注释为系统语义化标注而非改写）；已落盘的 v4「1」按永不覆盖不回改，仅影响后续 verbal 落盘。不改 shared/types.ts（无 K1）、不改工具层（quote 由 Agent 组装经工具参数传入）。feature-002 修订记录 R-005 同记（条款物理落点在再版剧本）。
- 2026-11-01：**非阻塞门协议修订（feature-015 联动）**——D-807-7「不改 bridge 超时模型」及契约 §2.2/§6 的「工具超时后同 gateId 重挂」口径退役：根因是阻塞等待人工裁决与 opencode 180 秒 MCP 硬超时的结构性冲突，现由 `gate.request` 落盘 pending 后立即返回彻底消除，不再重挂等待。feature-807 的 pending / rejected / version mismatch / approved-use-gate 四码防护、verbal 通道及字段来源回溯纪律全部保留；首版 verbal 发布后仍由 Agent 自行推进 `brief-published`。见 [feature-015 契约](../feature-015-确认门非阻塞化与系统直做后置/SDG-RE-契约.md) §2/§6。

---

## D-037 归档与迁移覆盖

> 状态含义：**已存在**＝目标包已有同义现行约束；**迁入**＝本次在 801 等现行负责包补写自包含章节；**保留历史**＝原任务、AC、测试计数、真机证据与开放状态仅在本包追溯；**被后续条款取代**＝历史口径仅作演变记录，不再作为当前入口。001 / 013 的修改由 A 组负责，本表只登记去向。

| 原文件 / 章节 | 当前负责包与目标 | 状态 | 覆盖与冲突处理 |
| :-- | :-- | :-- | :-- |
| 需求 §1 B-14 / B-15 缺陷现场 | **801**（门态防绕过）+ **001**（verbal / 字段来源协议） | 保留历史 + 迁入 | 陈旧口头授权、pending / rejected 与已发布矛盾、platforms 凭空扩写的事实时间线不改；四码和 Agent 纪律分别归 801 / 001。 |
| 需求 §2 R1–R5 | **801** §6 R37-01、契约 §12.2 | 迁入 | `BRIEF_GATE_PENDING` / `BRIEF_GATE_REJECTED` / `BRIEF_GATE_VERSION_MISMATCH` / `BRIEF_GATE_APPROVED_USE_GATE` 与无门 verbal 合法域完整保留。 |
| 需求 §2 R6、§3.5 超时恢复 | **001**（Agent 纪律）+ **801**（pending 协议） | 保留历史 + 被后续条款取代 | “阻塞等待、工具超时后同 id 重挂继续等 / settleAll GATE_TIMEOUT”由 015 的非阻塞 pending、覆盖重开与 clearLive 取代；禁止回溯旧话作授权仍有效。 |
| 需求 §2 R7–R8、§3.2 verbal 合法域 | **001** + **801** | 迁入 | 完整定案卡已展示、quote 针对该版、字段逐项回溯与 platforms 开放集合归 001；工具只做门态 / 版本与 quote 非空校验归 801。 |
| 需求 §2 R9、§3.4 rejected 残留 | **801** + **002** + **013** | 迁入 + 已存在 | rejected 同 id 重开归 801；无门再版 commit 与旧版本隔离归 002；旧门展示归 013；真实项目历史门不回改。 |
| 需求 §3.1 门态判定矩阵 | **801** | 迁入 | pending / rejected / approved × verbal / gate × 版本匹配及无 payload.version 兼容规则是 801 的通用发布防护，不新增错误码。 |
| 需求 §3.3 首版 / 再版 / 历史门 | **001** + **002** + **801** | 迁入 + 已存在 | 首版 verbal / gate 防护归 801 / 001；再版 `impact.commit` 与三选一归 002；历史无版本门兼容和首版无草案兜底归 801。 |
| 需求 §4 范围与排除项 | **001 / 002 / 801 / 806** 各自边界 | 保留历史 + 已存在 | 只收紧既有 `brief.publish`；不改 shared、工具数量、平台闭集、历史数据、其他门或 2-c。多门通用化不借归档转给 806 之外包。 |
| 需求 §5 AC1–AC11 | **001 + 002 + 801** 按主题；证据留本包 | 保留历史 + 去向登记 | AC、369/0/1 基线与当时通过状态不改；四码 / 零写盘现行归 801，Agent 与再版行为归 001 / 002。 |
| 契约 §1 门态数据来源 | **801**；CanvasGate 形状 **shared 既有** | 迁入 + 已存在 | `canvasStore.get`、0-final、`payload.version`、多条取末位等约束归 801；本次不改 shared。 |
| 契约 §2 纯函数与两张真值表 / 文案 | **801** | 迁入 | `findBriefGate` / `gateVersion` / `assertBriefPublishable`、四码和 message 语义保留；其中“重挂等待”文案动作以 015 非阻塞协议为准。 |
| 契约 §3 brief.publish 行为变更 | **801** | 迁入 | 校验顺序、只读取门、写盘前拒绝、零写盘和成功返回形状不变；系统按钮首版直发不再要求 Agent 再调 publish。 |
| 契约 §4 错误码登记 | **801** | 迁入 + 已存在 | 四码属于 MCP 工具业务信封，不进 runtime 14 码；本次不新增 `GATE_ALREADY_PENDING` 或 `EXECUTION_FAILED`。 |
| 契约 §5 impact.commit | **002** + **001** + **801** | 已存在 + 迁入 | 默认不加门态硬拦截、无门三选一合法再版不变；再版 verbal 协议归 001，015 的按钮仅确认与 Agent 后续 commit 时序归 801。 |
| 契约 §6 showrunner 变更点 | **001**；门后时序 **801** | 迁入 + 部分被后续条款取代 | verbal 两前提、版本绑定、字段回溯与再版 quote 归 001；L80/L91 阻塞超时恢复旧口径由 015 取代。 |
| 契约 §7 不产生的变更 | 原文与各现行包卡口 | 保留历史 | 工具总数、zod、成功形状、shared、bridge、IPC 与 renderer 的历史零 diff 记录不改；015 后续变更只在其自身留痕中解释。 |
| 设计 §1 落点总览 | **801** + **001** | 保留历史 + 去向登记 | guard.ts / tools.ts 归 801 门防护，showrunner 归 001；文件路径和“无 K1”是当时实施快照。 |
| 设计 §2.1–§2.2 | **801** | 迁入 | 四码粒度与 approved 同版本 verbal 拒绝现行有效，备选单码 / 放宽方案只留历史。 |
| 设计 §2.3 commit 防护 | **002** + **001** | 已存在 | 再版不加门态硬拦截、三选一为裁决点的默认方案不被归档推翻。 |
| 设计 §2.4 rejected 旧门 | **801** + **002** + **013** | 迁入 + 已存在 | 方案 A 零结构改动、同 id 重开和旧版隔离保留；0-final approved 重开另受 012 严格新版本条件约束。 |
| 设计 §3.1–§3.3 | **801** | 迁入 | 当前门多条处理、publishVersion 同源、写盘前检查与历史无版本门兼容归 801。 |
| 设计 §3.4 不改 bridge | **801** | 保留历史 + 被后续条款取代 | “Promise 长等 + 超时重挂”设计已由 015 删除跨调用等待 Promise 的方案取代；四码工具防护仍有效。 |
| 设计 §3.5 B-15 | **001** | 迁入 | 开放 platforms 不做闭集、Agent 来源回溯纪律归 001。 |
| 设计 §4–§5 测试与实施顺序 | 原文；能力归 **001 / 801** | 保留历史 | 23 例、7 例、35 文件 369、37 文件 399 等测试证据与先红后绿记录不改，本次不重跑。 |
| 任务 T1–T2 / AC1–AC7、AC10 | **801**；历史证据留本包 | 保留历史 + 去向登记 | 门态纯函数、发布防护、零写盘和回归由 801 承接；checkbox、测试数与真机结论不改。 |
| 任务 T3 / AC8–AC9 | **001** + **002**；超时部分 **801** | 保留历史 + 部分被后续条款取代 | verbal / 字段来源 / quote 归 001，再版三选一归 002；阻塞重挂纪律由 015 取代。 |
| 任务 T4–T6 / AC11 | 原文 | 保留历史 | 回归、偏差闭环、T6 真机授权与通过、项目路径和磁盘核验不改；归档不抹除历史已通过事实。 |
| 变更 D-807-0～D-807-7 | **001 / 002 / 801** 按同主题 | 保留历史 + 去向登记 | 用户拍板、K 卡口与方案默认项不改；D-807-7 的桥接等待模型仅作历史，四码 / verbal / 字段回溯继续有效。 |
| 变更 I-807-1 / I-807-2 | **001 + 801**；证据留本包 | 保留历史 | T1–T6 闭环、399 passed、真机 pending 拦截与 approved 发布是当时事实，不写成 015 新协议的真机证据。 |
| 修订 2026-10-17 quote 分流 | **001** + **002** | 迁入 + 保留历史 | 编号短回复“原话 + 机器注释”、自由文本逐字和 note 上下文归 001 / 002；已落盘 v4 不回改。 |
| 修订 2026-11-01 非阻塞联动 | **801** | 迁入 + 被后续条款取代 | 四码防护、verbal 与字段来源回溯迁入 801；重挂等待退役，首版 verbal 后 Agent 显式 `brief-published` 仍保留。 |

**归档自审**：807 的门态防护、四码、版本绑定与通用重开责任已指向 **801**；verbal / quote / 字段来源协议归 **001**，再版 commit 归 **002**，旧门展示归 **013**。历史阻塞等待和超时重挂由 **015** 非阻塞协议取代，但历史 T6 通过与 T1–T6 闭环未改写。未删除目录、未改历史任务、AC、测试计数或 FAIL/PASS。纯文档，**自审 + 无第二人复核**。
