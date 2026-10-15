# feature-807 确认门口头拍板约束与门态防护 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后补）/ 修订记录（决策稳定后清理）。

## 一、决策记录（卡口，永久保留）

### D-807-0 · 修复路径拍板：登记偏差 + 任务包修复，先规格后代码（2026-10-15 用户已裁决）

- 触发：2026-10-15 STAGE 0 真机走查（项目 `project-20261015-083049-xho7`）暴露 B-14（陈旧口头授权绕过未决门发布并 advance）/ B-15（platforms、diagnosisSummary 凭空扩写「快手」）。
- 用户裁决（AskUserQuestion）：
  - 数据补救＝**再版 v2 去快手**（已按 feature-002 六步经应用内对话完成并逐文件核验，v1 保留不覆盖、status 未跳格）。
  - 机制修复＝**登记偏差并走任务包修复**：先登记 B-14/B-15，再建本包收紧 showrunner.md L103 口头条款 + gate 超时纪律，并评估 brief.publish 工具层防护；按 No Spec No Code 走。
- 状态：数据补救 ✅ 完成；偏差登记 ✅ 完成（偏差清单 §2/§3、版本记录 2026-10-15 条目）；本任务包规格已建，**待用户批准后进入实施**。

### D-807-1 · 卡口性质：无 K1、无工具数量 K8；仅既有工具契约收紧（待批准）

- 本包不改 `shared/types.ts`（CanvasGate/Canvas/Manifest 形状零改动，门版本直接读既有 `gate.payload.version`）。
- 不新增 / 不删除 MCP 工具：工具总数保持 22、showrunner 白名单保持 17；仅给既有 `brief.publish`（编号 13）增加写盘前的门态拒绝分支，zod 入参与成功返回形状不变。
- 唯一须用户批准项＝该既有工具的拒绝行为契约（[契约](./SDG-RE-契约.md) §3）+ 新增错误码（D-807-2）。批准本包 5 文件即视为对该契约收紧的显式批准；批准前不触碰代码 / 提示词。

### D-807-2 · 错误码粒度：默认 4 个语义码（待批准，备选单码 + reason）

- 默认：`BRIEF_GATE_PENDING` / `BRIEF_GATE_REJECTED` / `BRIEF_GATE_VERSION_MISMATCH` / `BRIEF_GATE_APPROVED_USE_GATE`。
- 风格对齐既有 `BRIEF_NOT_READY` / `BRIEF_NO_BASELINE` / `IMPACT_DECISION_MISMATCH`（一语义一码，Agent 可直接据码决策，不解析中文 message）。
- 备选：单码 `BRIEF_GATE_BLOCKED` + `reason` 枚举（见设计 §2.1）。未另决则按默认 4 码实施。
- 归属：MCP 纯工具业务错误信封层，**不进** runtime/types.ts 的 14 个 runtime 通道错误码（两套体系）。

### D-807-3 · approved 同版本 + verbal 默认拒绝（待批准）

- 门已 approved（同版本）时要求必须 `approve.by:'gate'`；verbal 调 publish 返回 `BRIEF_GATE_APPROVED_USE_GATE`。
- 理由：避免一版两凭证、保留门 note 留痕；正常门后路径（showrunner.md L102）本就 by:'gate'，只堵异常路径。
- 备选：approved 同版本任何 by 都放行（放宽，见设计 §2.2）。

### D-807-4 · brief.impact.commit 默认不加门态硬拦截（待批准）

- 再版 v2+ 走 feature-002 独立流程，plan→assess→**用户三选一**→commit，三选一即用户裁决点；再版可以不发门（对话承载）。给 commit 加门态硬校验会误伤合法无门再版（本次 v2 补救正属此场景）。
- 故默认：commit handler 不改；仅在 showrunner.md 提示词层要求再版 verbal 针对再版定案卡 + 经三选一、禁止复用首版 / 旧门口头语。
- 备选：为 commit 加同版本 pending/rejected 门拦截（需先定义再版门协议，超出 B-14 修复范围，本包不做）。

### D-807-5 · rejected 旧门残留：方案 A 零结构改动（待批准）

- commit 不清 / 不改旧 rejected 门；需要门的再版由 showrunner 以同一 gateId 重发——bridge 现状已支持 rejected（无 live entry）→ 同 gateId 重开 pending 并覆盖 question/options/payload（bridge.ts initializeEntry L55-103）。
- 无门再版后，旧 rejected 门因 payload 绑定旧版本，被版本匹配规则自然隔离，不能充当新版凭证；其在画布的展示残留属 renderer 通道包，不在本包。
- 走查项目 `project-20261015-083049-xho7` 的旧 rejected 门（v1 含快手卡）作为历史现场保留，不回改、不清理。
- 备选 B（commit 标记 / 归档旧门）需改 CanvasGate 结构或加工具（K1/K8），明确不做。

### D-807-6 · B-15 平台忠实度：提示词来源回溯，不做平台闭集（待批准）

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
