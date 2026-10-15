# feature-807 确认门口头拍板约束与门态防护 · 设计说明

> 事实源：[需求规格](./SDG-RE-需求规格.md)（B-14/B-15 背景与验收）、[契约](./SDG-RE-契约.md)（函数 / 行为 / 错误码契约）。
>
> 本文件只记实现期设计取舍与卡口呈报项；需求与契约是裁决依据，本文件不重写它们。

## 1. 落点总览（最小改动面）

| 层 | 文件 | 改动 | 卡口 |
|---|---|---|---|
| 纯函数 | `electron/gate/guard.ts`（新建，约 60-90 行） | `findBriefGate` / `gateVersion` / `assertBriefPublishable` | 无（新增内部模块） |
| 工具 | [electron/mcp/tools.ts](../../../electron/mcp/tools.ts) brief.publish handler（L377-416） | 写盘前插一道门态检查；import guard | 既有工具契约收紧（契约 §3），用户批准 |
| 错误码 | 工具信封层 | 新增 4 码（或 1 码 + reason，见 §2） | 随契约报批 |
| 提示词 | [resources/opencode/agents/showrunner.md](../../../resources/opencode/agents/showrunner.md) L80/L91/L100/L103/L115 | 口头两前提、超时纪律、再版针对、字段回溯 | 无 K 卡口（非 shared 层），规格批准即改 |
| 测试 | `src/test/gate-guard.test.ts`（新建）+ brief 工具 e2e 既有文件追加 case | 判定矩阵 + 零写盘 + 无门 verbal 回归 | — |
| 文档 | 偏差清单 / 版本记录 / features README | 状态与索引同步 | — |

**不触碰**：`shared/types.ts`、bridge.ts、renderer、IPC、commit handler（默认）、2-c、feature-803。

## 2. 卡口呈报项

### 2.1 错误码粒度（默认：4 个语义码）

- 默认采纳契约 §2 的 4 码：`BRIEF_GATE_PENDING` / `BRIEF_GATE_REJECTED` / `BRIEF_GATE_VERSION_MISMATCH` / `BRIEF_GATE_APPROVED_USE_GATE`。
- 理由：Agent 与日志可直接据 code 决定下一步（重挂 vs 改稿 vs 重发门 vs 换 by:gate），无需解析中文 message；与既有 `BRIEF_NOT_READY` / `BRIEF_NO_BASELINE` / `IMPACT_DECISION_MISMATCH` 的「一个语义一个码」风格一致。
- 备选：单码 `BRIEF_GATE_BLOCKED` + `reason` 枚举。仅当评审认为错误码膨胀时采用；本包默认 4 码。
- **请用户在此项确认**（不确认则按默认 4 码实施）。

### 2.2 approved 同版本 + verbal 是否拒绝（默认：拒绝）

- 默认对「门已 approved 同版本，但用 verbal 调 publish」返回 `BRIEF_GATE_APPROVED_USE_GATE`，要求改用 by:'gate'。
- 理由：门已产生正式裁决凭证，再允许 verbal 等于一版两凭证、绕过门 note 留痕。
- 成本：showrunner 门后路径本就是 by:'gate'（L102），改动只堵异常路径，不影响正常流。
- 备选：放行（approved 同版本任何 by 都可）。若担心过度严格影响 Agent 续跑，可放宽；但会留下「门批了却用口头语发布」的审计歧义。**默认拒绝，请确认。**

### 2.3 commit 是否加门态防护（默认：不加）

- 默认不给 `brief.impact.commit` 加门态硬拦截，理由见契约 §5（再版可不发门、三选一即裁决点、硬拦截误伤合法无门再版）。
- B-14 的根因发生在**首版 publish**；再版通道已有 plan/assess/三选一三重确认。本次 v2 补救的合法性也依赖 commit 在无门下可执行。
- **默认不加，仅提示词收口；请确认。**

### 2.4 rejected 旧门残留（默认：方案 A，零结构改动）

- 采纳规格 §3.4 方案 A：commit 不清门、不改门；需要门的再版由 showrunner 以同 gateId 重发（bridge 已支持 rejected→重开 pending 覆盖内容）；无门再版后旧 rejected 门凭 payload.version=旧版自然与新版隔离，不作为新版凭证。
- 走查项目 `project-20261015-083049-xho7` 的旧 rejected 门属历史现场，不回改。
- 备选 B（commit 标记/归档旧门）需动 CanvasGate 结构或加工具，涉 K1/K8，本包明确不做。

## 3. 实现细节

### 3.1 取"当前门"的多条处理

- bridge `initializeEntry` 对 rejected 是「同 gateId 重开覆盖」、pending 恢复沿用、approved 终态拒绝重开；故 canvas.gates 中同一 gateId 常态至多一条有效记录。
- guard 防御性处理：`findBriefGate` 过滤 gateId==='0-final' 后，若多于一条，取数组**末位**（CanvasGate 无 updatedAt 字段，存储顺序即追加顺序；编码时 grep 确认 store 写门为追加/覆盖，若是覆盖则至多一条，末位逻辑仍安全）。不为本包给 CanvasGate 加时间字段（避免 K1）。

### 3.2 publishVersion 的取得

- 复用 brief.plan 同款：`listBriefVersions(projectDir)` → `(latestVersion ?? 0) + 1`。与 `publishV1InQueue` 内实际分配版本号同源（编码时核对 publish.ts 版本分配实现，确保 guard 用的 pv 与落盘版本一致；不一致则以 publish.ts 导出的版本决策为准，必要时把版本计算前移为只读一次再传入，杜绝两次读盘中间态）。
- 门态检查与写盘在同一 async handler 顺序执行；写队列保证真正落盘串行。检查发生在任何 enqueue 之前，满足零写盘。

### 3.3 历史门兼容（无 payload.version）

按契约 §2.1 第二表：pending/rejected 保守拦截（宁可重挂不可抢跑），approved+by:gate 放行。该策略只影响「feature-807 之前发出、payload 不带 version」的门；feature-001 发门即带 payload，实际存量命中面极小，但保证不抛错。

### 3.4 为什么不改 bridge

- bridge 无 Promise 超时是正确的：门本质是长生命周期人工裁决，Promise 一直 pending 直到用户 decide 或项目关闭 settleAll，语义干净。
- Agent 日志里的「门请求超时」是 opencode / MCP 调用层回合限制，不是 bridge 行为。正确修复是「调用层超时后下回合重挂 + 禁止 verbal 兜底」（提示词）和「即便 Agent 误发 verbal 也被工具拒绝」（工具层），两处都不需要改 bridge。

### 3.5 B-15 为什么只用提示词、不做平台闭集

- platforms 是开放业务集合（短剧投放平台随业务变化：抖音 / 红果 / 快手 / 微信短剧……），硬编码闭集违背项目必要性且很快过期。
- 缺陷本质是「Agent 把未确认事实当确认事实」，正确约束是**来源回溯纪律**（每个上卡字段必须能指回用户原话或已确认产物），而非枚举。
- 工具层已有的谱系字段（mainStyleId 等）闭集校验是因为那是平台内置资产目录；platforms 不属此类。

## 4. 测试设计

### 4.1 纯函数单测（src/test/gate-guard.test.ts）

- 构造 `CanvasGate` 夹具，覆盖契约 §2.1 两张真值表全部行：
  - 无门 × by（2）
  - 可解析版本：pending × verbal/gate × 同/异版本、rejected × 同/异版本、approved × gate/verbal × 同/异版本（约 10 例）
  - 不可解析版本：pending/rejected/approved × gate/verbal（保守表 4 例关键组合）
  - findBriefGate：空数组、多条取末位、非 0-final 门被忽略
- 每例断言 code（放行断言 null）。

### 4.2 brief.publish e2e（临时项目夹具，沿用现有 brief 工具测试设施）

- `pending + verbal` → isError、code=BRIEF_GATE_PENDING、断言项目目录无 `立项单.v1.*`、canvas.json gates 未变、manifest 未变（零写盘）。
- `rejected + verbal` → BRIEF_GATE_REJECTED、零写盘。
- `无门 + verbal(quote)` → 成功 v1、双写、节点 upsert（现状回归保护）。
- `approved 同版本 + gate` → 成功（门路径回归）。
- `approved v1 门 + 发 v2`（版本不匹配）→ BRIEF_GATE_VERSION_MISMATCH、零写盘。
- 历史门（无 payload.version）三态兼容分支各 1 例。

### 4.3 提示词静态检查

- 若仓库已有对 showrunner.md 关键纪律的断言（grep 现有测试如何锁定门序 / 工具名），追加对新纪律关键句的存在性断言；若无此设施，则以人工走查 + 在本包变更记录中摘录改后条款为准，不新建脆弱的全文匹配测试。

### 4.4 回归

- 全量 35 文件，基线 369 passed / 0 failed / 1 skipped；新增用例计入后通过数只增不减。
- 重点跑 brief / impact / mcp-pure-tools / agent-profiles / runtime 相关测试，确认工具总数 22 与白名单静态契约未受影响（本包不加工具，相关断言应零改动）。

## 5. 实施顺序（规格批准后）

1. 建 guard.ts + 纯函数单测（先红后绿）。
2. brief.publish 接 guard + e2e 用例（含零写盘断言）。
3. 同步错误码静态登记点（grep BRIEF_NOT_READY）。
4. 改 showrunner.md 四处纪律（L80/L91/L100/L103/L115）。
5. 全量回归 + tsc -b。
6. 偏差清单 B-14/B-15 标「已修复」、版本记录追加、features README 收录。
7. （可选，需用户另同意）真机回归：新建项目走一遍 0-final，验证门 pending 时 verbal 被工具拒绝的真实信封。
