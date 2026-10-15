# feature-807 确认门口头拍板约束与门态防护 · 需求规格

> 任务包性质：**真机走查暴露的机制缺陷修复包（先登记后修复，No Spec No Code）**。
>
> 解决偏差：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) **B-14**（陈旧口头授权绕过未决定案门＝门抢跑）、**B-15**（立项单平台字段凭空扩写＝内容忠实度）。
>
> 事件来源：2026-10-15 STAGE 0 真机走查（项目 `project-20261015-083049-xho7`）。完整事实时间线与取证见 [版本记录.md](../../../版本记录.md)「2026-10-15 · STAGE 0 真机走查」条目。
>
> 溯源标签：**[自研新增]**（缺陷修复，不对应设计书新功能章节；是对 §2.6 唯一门 + 口头拍板语义的工程加固）。
>
> 用户裁决（2026-10-15 AskUserQuestion）：数据已按 feature-002 再版 v2 补救完成；机制层「登记偏差并走任务包修复」。**本规格已于 2026-10-15 经用户批准并实施完毕（见变更记录 I-807-1 / I-807-2）。**

## 1. 背景

### 1.1 缺陷现场（B-14）

STAGE 0 唯一定案门 `0-final` 发出后，主控 Agent（showrunner）侧两次 `shortdrama_gate_request` 调用在 opencode / MCP 工具调用层超时（回合限制）。取证确认：

- [bridge.ts](../../../electron/gate/bridge.ts) 的 `request()` Promise **本身无超时**；只有项目切换 / 关闭时 `settleAll()` 把在等待的门 reject 为 `GATE_TIMEOUT`（[bridge.ts L140-145](../../../electron/gate/bridge.ts#L140-L145)）。门在 canvas 中仍为 `pending`。
- Agent 在未拿到门裁决的情况下，援引用户**看见门卡内容之前**说的一句话「……可以发 0-final 定案门」（语义仅为授权"发门"，非对门卡内容拍板）作为 verbal 凭证，于 **08:44:40** 调 `brief.publish({approve:{by:'verbal'}})` 发布立项单 v1 并 `manifest.advance`。
- 用户 **09:18:07**（约 33 分钟后）的「打回改稿」才落为 `gate.status=rejected`，形成「门 rejected ＋ v1 已发布 ＋ status 已推进」的矛盾现场，违反 [showrunner.md L83](../../../resources/opencode/agents/showrunner.md#L83)「门未 approved 一律不调 manifest.advance」。

两层根因：

1. **提示词层**：[showrunner.md L103](../../../resources/opencode/agents/showrunner.md#L103) 口头拍板条款「门已发亦可直接 publish」既无「门卡内容已向用户展示、口头语必须针对该版内容」约束，也无「调用超时只许同 gateId 重挂等待按钮、禁止回溯陈旧口头语」纪律；[L115](../../../resources/opencode/agents/showrunner.md#L115) 再版第 3 步「规则同首版」同源继承缺口。
2. **工具层**：[tools.ts brief.publish L362-417](../../../electron/mcp/tools.ts#L362-L417) 除「草案就绪」「verbal quote 非空」外**完全不检查门状态**，故 verbal publish 可在 pending / rejected 门下成功，工具层对违例零拦截。

### 1.2 缺陷现场（B-15）

同一走查中，用户全程只确认「抖音 / 红果短剧」（项目内 `故事背景档案.md` 只记此两平台，可证），Agent 却在门卡 `platforms` 与 `diagnosisSummary` 投放句两处凭空加入「快手」并写入立项单 v1。平台字段是自由字符串数组（[types.ts](../../../shared/types.ts) 无平台闭集），无任何工具层来源校验。v2 再版已去除快手（`changesFromPrevious` 恰两项），v1 作为错误版本保留留痕。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 要做什么 | 达成效果 |
|---|---|---|---|---|
| R1 | 系统（brief.publish 门态防护） | 存在与本次发布同版本的 `pending` 的 0-final 门时收到 verbal publish | 拒绝，返回 `BRIEF_GATE_PENDING`，message 指引「门仍在等待用户按钮裁决，用同一 gateId 重挂 gate.request，不得口头绕过」 | Agent 无法用口头语越过一张用户尚未处理的门 |
| R2 | 系统（brief.publish 门态防护） | 存在与本次发布同版本的 `rejected` 的 0-final 门时收到 verbal publish | 拒绝，返回 `BRIEF_GATE_REJECTED`，message 指引「用户已打回该版，按意见改稿、brief.plan 后用同一 gateId 重发门」 | 打回必须改稿 + 重走门，口头语不能翻案 |
| R3 | 系统（brief.publish 门态防护） | 无 0-final 门记录，且用户在对话中对**已展示的完整定案卡内容**口头拍板 | 放行（保持既有「不发门亦可口头拍板」能力），verbal quote 非空校验不变 | 合法的纯对话拍板路径不被破坏 |
| R4 | 系统（brief.publish 门态防护） | 存在 0-final 门但 `approved`，且门 payload 绑定版本 == 本次发布版本 | by:'gate' 放行（行为不变） | 门拍板主路径零影响 |
| R5 | 系统（版本绑定） | 旧门 `approved` 但绑定版本 ≠ 本次发布版本（如拿 v1 的门发 v2） | 拒绝，返回 `BRIEF_GATE_VERSION_MISMATCH` | 一张门只授权一版内容，杜绝跨版挪用 |
| R6 | 主控 Agent（提示词纪律） | gate.request 工具调用层超时 / 回合中断后恢复 | 每个回合先 canvas_get；有相关 pending 门只用同一 gateId 重挂等待；**禁止把超时前的任何用户话语当作对门卡的拍板** | 超时只触发"重挂等待"，不触发"找旧话兜底发布" |
| R7 | 主控 Agent（口头拍板约束） | 拟用 verbal 发布 | 仅当「完整定案卡文本已在对话中向用户展示」**且**「用户原话明确针对该版卡内容表示同意」两条件同时满足才可 verbal；quote 逐字原文 | 口头拍板与点按钮真正等价（针对同一版、已看见的内容） |
| R8 | 主控 Agent（内容忠实度，B-15） | 组装定案卡 / 草案时 | 门卡每个字段逐项可回溯到用户原话或已确认产物（故事背景档案等）；无来源的值不得上卡，尤其 platforms 不得自行增补平台 | 消除凭空扩写；拿不准的值回到对话向用户确认 |
| R9 | 系统（rejected 旧门残留处置） | 再版 commit 后画布留有指向旧版本的 rejected 0-final 门（如本次 v2 后的现场） | 见 §3.4：本包提供明确的门残留处置语义，避免画布长期矛盾 | 再版后画布门态与当前版本自洽 |

## 3. 核心机制（实现口径）

### 3.1 门态判定（纯函数，可单测）

新增 `electron/gate/guard.ts`（或并入既有 gate 模块，设计说明定稿），纯函数：

```
findVersionGate(gates: CanvasGate[], gateId: '0-final', version: number): CanvasGate | null
assertPublishableByGate(gate, approve): ok | { code, message }
```

- 门版本来源：门 `payload` 内的 `version`（[showrunner.md L100](../../../resources/opencode/agents/showrunner.md#L100) 发门时已写 `payload.version=plan.nextVersion`）。历史门无 payload.version 时视为「未绑定版本」，按 §3.3 兼容规则处理。
- 判定矩阵（仅作用于 gateId=`0-final`；其他门不参与立项发布）：

| 门现状 | approve.by | 结果 |
|---|---|---|
| 无门 | verbal | 放行（quote 非空）｜gate：放行（等价无门补登，行为同现状） |
| 无门 | gate | 放行（现状行为，不新增阻断） |
| pending（任意版本） | verbal | **拒绝 BRIEF_GATE_PENDING** |
| pending（同版本） | gate | **拒绝 BRIEF_GATE_PENDING**（门尚未裁决，by:gate 也无 approved 凭证） |
| rejected（同版本） | 任意 | **拒绝 BRIEF_GATE_REJECTED** |
| approved（同版本） | gate | 放行 |
| approved（同版本） | verbal | 拒绝 `BRIEF_GATE_APPROVED_USE_GATE`（已有门裁决，必须用 by:gate，避免一版两凭证）——见设计说明 §备选，默认采纳 |
| approved / rejected（版本不匹配） | 任意 | **拒绝 BRIEF_GATE_VERSION_MISMATCH** |

> 错误码是否新增 3 个、还是收敛为 1 个 `BRIEF_GATE_BLOCKED` + 结构化 reason，在设计说明中给出选型并在卡口呈报；本规格先以语义化 3 码描述需求，不锁死。

### 3.2 verbal 的合法域（提示词层硬约束，工具层只门态）

- 工具层**只**做门态 / 版本绑定校验，**不**尝试判断 quote 内容相关性（自然语言，工具无法可靠判定）。
- 「quote 是否针对已展示的该版卡内容」由 showrunner.md 纪律 + 走查 / 评审保证（R7）；工具层保留 quote 非空硬校验作为最低凭证。
- B-15 的平台忠实度同样不引入平台闭集（平台是开放业务集合，闭集反而违背项目必要性），以 R8 提示词回溯纪律解决。

### 3.3 与首版 / 再版的关系

- **首版 v1**：走 `brief.publish`。未发门 → 对话内展示定案卡 → 用户口头拍板，verbal 合法（R3）；一旦发了门，门 pending/rejected 期间 verbal 被拦截（R1/R2），必须等按钮或改稿重发。
- **再版 v2+**：走 feature-002 的 `brief.impact.commit`（**不走 brief.publish**）。本包对 commit 的处置见设计说明：默认**不为 commit 增加门态硬拦截**（再版有独立的 plan→assess→用户三选一流程，三选一本身是用户裁决点；本次 v2 正是用打回原话在该流程内合法完成），但在提示词层要求再版 verbal 必须针对「再版定案卡」并经三选一，禁止拿首版/旧门的口头语直接 commit。是否给 commit 加版本门校验列为设计说明的显式备选与卡口项。
- **历史现场兼容**：已发布项目的旧门无 payload.version：防护对「读不出绑定版本」的门采取保守兼容——pending/rejected 且无法判版本时，按同版本处理（拦截 verbal，宁可重挂也不放行抢跑）；approved 且无法判版本时放行 by:gate，不阻断正常续跑。具体在设计说明定稿，保证不锁死存量项目。

### 3.4 rejected 门在再版后的处置（残留现场语义）

本次 v2 后旧 0-final 门仍 `rejected`、question 仍是含快手的 v1 卡。需在包内裁决一种语义（设计说明给推荐 + 备选，卡口确认）：

- **推荐 A：再版 commit 不自动改门，由 showrunner 在再版拍板时以同一 gateId 重发门**——bridge 现状已支持「rejected 无 live entry 时以同 gateId 重开为 pending（覆盖内容）」（[bridge.ts initializeEntry](../../../electron/gate/bridge.ts#L55-L103)）。即再版若要门裁决，重发即覆盖旧卡；若再版走对话三选一（无门），旧 rejected 门作为历史保留在 gates 数组（其 payload 绑定 v1，不影响 v2 的门态判定，因版本不匹配时只拦截"拿它给 v2 当凭证"，不污染展示）。
- 备选 B：commit 时把同 gateId 的旧 rejected 门标记 / 归档（需改 canvas 门结构或新增工具，可能涉 K1/K8，成本高）。
- 默认采纳 A：**零结构改动、复用 bridge 既有重开语义**；本次走查项目的旧 rejected 门属历史数据，不回改、不清理（与"历史版本永不覆盖"一致），仅在画布门展示上由后续 UI 包按需处理。

### 3.5 gate.request 调用层超时的正确恢复（提示词）

- 区分两种"超时"：① 工具调用层回合限制（门仍 pending 在 canvas）→ 下回合 canvas_get 发现 pending，用**同一 gateId** 重挂 `gate.request` 继续等结果（bridge 幂等返回同一等待 / 重挂到既有门）；② bridge `settleAll` 的 `GATE_TIMEOUT`（仅项目切换 / 关闭）→ 门已被搁置，向用户说明并按现场决定重发，不得自动 verbal 发布。
- 任何超时都**不得**回溯超时之前的用户话语作为拍板凭证。

## 4. 范围

### 4.1 本包做

1. **工具层（electron）**
   - 新增门态判定纯函数（§3.1）+ 全套单测。
   - 在 `brief.publish`（[tools.ts L377-416](../../../electron/mcp/tools.ts#L377-L416)）就绪 / quote 校验之后、`publishV1InQueue` 之前插入门态防护；读门态用既有 `canvasStore.get()`（只读，不新增 IPC / 工具）。
   - 新增错误码（数量与命名设计说明定稿），登记进相关错误码契约 / 静态测试。
   - 评估并定稿 commit 是否加防护（默认不加硬拦截，提示词层收口）。
2. **提示词层（resources/opencode/agents/showrunner.md）**
   - 收紧 L103 口头条款：两前提（已展示该版完整定案卡 + 用户原话针对该版内容）；门 pending 期间 verbal 会被工具拒绝（明示错误码与正确动作＝同 gateId 重挂）。
   - 新增强制超时纪律（§3.5），与 L80/L91「门恢复」合并表述，禁止回溯陈旧口头语。
   - 收紧 L115 再版第 3 步（再版 verbal 针对再版卡 + 三选一）。
   - 新增门卡字段来源回溯纪律（R8，B-15）：上卡前逐项对来源，platforms 等开放字段无来源不补。
3. **测试**
   - guard 纯函数：判定矩阵每格 + 无 payload.version 兼容分支。
   - brief.publish e2e（临时项目夹具）：pending verbal 拒绝、rejected verbal 拒绝、无门 verbal 放行、approved 同版本 gate 放行、版本不匹配拒绝；且拒绝时**零写盘**（无立项单、canvas 未变、manifest 未变）。
   - 提示词静态断言（沿用现有 showrunner 关键纪律的测试方式，如存在）。
   - 全量回归不扩大（基线 35 文件 369 passed / 0 failed / 1 skipped）。
4. 同步偏差清单（B-14/B-15 状态）、版本记录、features/README 索引。

### 4.2 本包不做（显式排除）

- **不改 shared/types.ts（无 K1）**：`CanvasGate` / `payload` 现状已够用；不新增门字段、不新增门归档结构（采纳 §3.4 方案 A）。
- **不新增 MCP 工具（无工具数量 K8）**：仅给既有 `brief.publish` 加拒绝分支。错误码新增属既有工具契约收紧，在本规格 / 契约内报批，用户批准即卡口通过。
- **不做平台闭集 / platforms 枚举校验**：平台为开放集合；B-15 以提示词回溯纪律解决，不硬编码平台白名单。
- **不回改本次走查项目的历史数据**：v1 错误版本、旧 rejected 门、v2 补救结果全部保留留痕。
- **不处理 1-a / 1-b / 2-a~2-c 及 STAGE 3+ 的门**：本包只针对 STAGE 0 `0-final` 与立项发布；多门通用化属 feature-806。
- **不改 bridge 的超时模型 / settleAll 语义**：bridge 无超时是现状正确设计；问题在调用层与 Agent 恢复纪律，不改 bridge。
- **不做门卡 UI 改版**：rejected 旧门的画布展示美化属 renderer 通道包。
- **不动 2-c 分镜文字稿、不碰 feature-803**。

## 5. 验收（业务层）

- AC1：项目存在 `pending` 的同版本 0-final 门时，`brief.publish` 以 verbal 调用被拒绝（`BRIEF_GATE_PENDING`），且项目目录无任何新增 / 改动（不写立项单、不改 canvas.json、manifest.json）。
- AC2：存在 `rejected` 的同版本门时，verbal / gate 均被拒绝（`BRIEF_GATE_REJECTED`），message 指引改稿后同 gateId 重发门；零写盘。
- AC3：无任何 0-final 门记录时，verbal publish（quote 非空、草案就绪）成功，行为与现状逐字一致（v1 正常双写 + upsert 节点 + briefVersion=1）。
- AC4：存在 `approved` 且 payload.version 等于发布版本的门时，by:'gate' publish 成功；by:'verbal' 被要求走门（若采纳 R5/矩阵该格）。
- AC5：存在 `approved` 门但 payload.version 与本次发布版本不一致时，publish 被拒绝（`BRIEF_GATE_VERSION_MISMATCH`），零写盘。
- AC6：历史门无 payload.version 时不抛错、不锁死存量项目（pending/rejected 保守拦截并指引重挂；approved + by:gate 放行）。
- AC7：guard 纯函数判定矩阵所有分支有单测；`tsc -b` 全绿。
- AC8：showrunner.md 明确写出：verbal 两前提、pending 门期间 verbal 会被工具拒绝及正确动作、超时只许同 gateId 重挂且禁止回溯旧话、再版 verbal 针对再版卡、门卡字段逐项来源回溯（含 platforms 不得自行增补）。
- AC9：feature-002 再版六步剧本仍可在「无门、对话三选一」场景合法 commit v2+（本包不阻断该路径，有测试或走查证据）。
- AC10：全量回归 35 文件，通过数不减少、失败数不增加（基线 369 passed / 0 failed / 1 skipped）；新增测试全绿。
- AC11：B-14/B-15 在偏差清单更新为「修复中 / 已修复」并链接本包；版本记录追加修复条目；features/README 收录 feature-807。
