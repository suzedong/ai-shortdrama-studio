# feature-807 确认门口头拍板约束与门态防护 · 任务清单

> 前置：本规格 5 文件（需求 / 契约 / 设计 / 本清单 / 变更记录）经用户批准。本包**无 K1**（不改 shared/types.ts）、**无工具数量 K8**（工具总数保持 22）；唯一须报批的是既有 `brief.publish` 的拒绝分支契约收紧（契约 §3）与错误码新增（设计 §2.1）。**未批准不执行 T2。**
>
> 顺序约束：T1 先行（纯函数 + 测试，可独立验证）；T2 依赖 T1；T3（提示词）可与 T1/T2 并行但同批验收；T4 回归收尾；T5 文档同步最后。

## 0. 上下文加载清单（工作围栏）

- 事实源：[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)、[设计说明](./SDG-OD-设计说明.md)；偏差 B-14/B-15（[偏差清单](../../设计现状与偏差清单.md) §2）；走查事实（[版本记录](../../../版本记录.md) 2026-10-15 STAGE 0 走查条目）。
- 改动面白名单：
  - `electron/gate/guard.ts`（**新建**，纯函数；可与 bridge.ts 同目录但不依赖其运行时状态）
  - `electron/mcp/tools.ts`（**仅** brief.publish handler L377-416：加 import + 写盘前一道检查；其余工具零改）
  - `electron/brief/publish.ts` 或 `electron/brief/plan.ts`（**只读 / 导出复用**版本号计算；如已可从 listBriefVersions 推出则零改）
  - 错误码静态登记点（编码时 grep `BRIEF_NOT_READY` 定位，仅追加登记，不改枚举体系）
  - `resources/opencode/agents/showrunner.md`（L80/L91/L100/L103/L115 四处纪律段）
  - 测试：`src/test/gate-guard.test.ts`（**新建**）；既有 brief.publish e2e 测试文件（grep `brief.publish` / `BRIEF_NOT_READY` 定位）追加用例；如存在 showrunner 纪律静态断言文件则追加。
  - 文档：偏差清单、版本记录、features/README.md。
- 红线（不碰）：
  - `shared/types.ts`（无 K1）；`electron/gate/bridge.ts`（超时模型不动）；
  - `brief.impact.commit` handler（默认不加门态拦截，仅提示词收口）；
  - renderer / preload / IPC；工具总数与白名单（22 / showrunner 17）；
  - 1-a/1-b/2-a~2-c 及 STAGE 3+ 门（属 feature-806）；2-c、feature-803；
  - 走查项目 `project-20261015-083049-xho7` 历史数据（v1/v2/旧 rejected 门一律不回改）；
  - writer.md / media-director.md / comfyui-operator.md。

## 1. 原子任务

### T1 · 门态判定纯函数（electron/gate/guard.ts，新建）

- 实现契约 §2：`findBriefGate(gates)`（过滤 0-final，多条取末位）、`gateVersion(gate)`（读 `payload.version`，无则 null）、`assertBriefPublishable(gate, approve, publishVersion)`（返回 `GateGuardViolation | null`）。
- message 文案按契约 §2.2（含版本号插值）。
- 新建 `src/test/gate-guard.test.ts`：
  - 契约 §2.1 可解析版本真值表全部行（无门 2 + pending 3 + rejected 2 + approved 4 等约 11 例）；
  - 不可解析版本保守表 4 例关键组合；
  - findBriefGate：空数组 / 多条取末位 / 非 0-final 被忽略；
  - 纯函数零 fs / electron import。
- 完成标准：新套件全绿；`tsc -b` 不新增错误。

### T2 · brief.publish 接入门态防护（electron/mcp/tools.ts，前置：用户批准契约 §3）

- import guard；在 handler 内、`publishV1InQueue` 与任何 `canvasStore.update` **之前**插入：
  - `listBriefVersions(projectDir)` → `publishVersion=(latestVersion??0)+1`（核对与 publish.ts 实际分配同源，避免两次读盘中间态；必要时只读一次）；
  - `canvasStore.get()` → `findBriefGate(gates)` → `assertBriefPublishable(...)`；违例 `respond(fail(code,message))` 直接返回。
- 成功路径形状、入参 zod、版本双写 / 节点 upsert 行为逐字不变。
- 同步错误码静态登记点（grep `BRIEF_NOT_READY`，按既有方式登记新码）。
- e2e 用例（临时项目夹具）：
  - pending+verbal → BRIEF_GATE_PENDING 且**零写盘**（无立项单文件、canvas gates 未变、manifest 未变）；
  - rejected+verbal → BRIEF_GATE_REJECTED 且零写盘；
  - 无门+verbal(quote 非空) → v1 成功（现状回归）；
  - approved 同版本+gate → 成功（门路径回归）；
  - approved v1 门+发 v2 → BRIEF_GATE_VERSION_MISMATCH 且零写盘；
  - approved 同版本+verbal → BRIEF_GATE_APPROVED_USE_GATE（对应设计 §2.2 默认）；
  - 历史门无 payload.version：pending/rejected 保守拦截、approved+gate 放行。
- 完成标准：新用例全绿；既有 brief / impact / mcp-pure-tools / agent-profiles / runtime 测试零回归；工具总数静态断言仍为 22（不加工具，断言不改）。

### T3 · showrunner.md 四处纪律收紧（可与 T1/T2 并行）

- **L103 口头条款重写**：verbal 两前提（① 该版完整定案卡已在对话中向用户展示；② 用户原话明确针对**该版卡内容**表示同意）；删除「门已发亦可直接 publish」无条件表述；明示：门 pending 期间 verbal 会被工具以 `BRIEF_GATE_PENDING` 拒绝，正确动作＝同 gateId 重挂 gate.request；门 rejected 后必须按意见改稿、brief.plan、同 gateId 重发门。
- **L80 / L91 门恢复 + 超时纪律**：区分工具调用层超时（门在 canvas 仍 pending → 下回合 canvas_get 用同 gateId 重挂）与 settleAll `GATE_TIMEOUT`（仅项目切换 / 关闭 → 向用户说明、按现场决定，不自动发布）；新增硬句：**任何超时都不得回溯超时之前的用户话语作为对门卡的拍板凭证**（B-14 直接根因）。
- **L115 再版第 3 步**：再版 verbal 必须针对**再版定案卡**并经第 5 步三选一；首版 / 旧门口头语不得复用；commit 不查门态但不接受旧凭证（提示词层约束）。
- **L100 发门段新增字段来源回溯纪律（B-15）**：上卡前每个字段逐项回溯用户原话或已确认产物（故事背景档案等）；platforms 等开放字段无来源不得自行增补，拿不准则回到对话确认；上卡后向用户逐字段复读，给用户纠错机会。
- 完成标准：四处改后语义无内部矛盾；与 L83 状态机纪律一致；如仓库有 showrunner 纪律静态断言则同步更新并全绿。

### T4 · 全量回归与构建

- `npm run typecheck`、`tsc -b`（含 node / preload project references）零新增错误。
- 全量 vitest：基线 35 文件 **369 passed / 0 failed / 1 skipped**，新增 gate-guard 与 publish 用例计入后通过数只增不减；skip 数不增加。
- 白名单 / 工具数 / profile 静态契约不变（22、showrunner 17）。

### T5 · 文档与偏差闭环

- [偏差清单](../../设计现状与偏差清单.md) §2：B-14 / B-15 状态由🔴改为✅已解决（链接本包，注明修复方式＝工具层防护 + 提示词纪律）；§3 feature-807 行状态改已落地。
- [版本记录](../../../版本记录.md) 2026-10 顶部追加修复条目（事实 / 依据 / 波及面 / 验证：新增测试数、全量基线、无 K1/K8、工具数不变）。
- [features/README.md](../../features/README.md)：8xx 段收录 feature-807（名称、解决 B-14/B-15、状态）。
- 本包 [SDG-AI-变更记录](./SDG-AI-变更记录.md)：登记卡口决策（§2.1 错误码粒度、§2.2 approved+verbal、§2.3 commit 不拦截、§2.4 旧门方案 A）与实施条目。

### T6（可选，需用户另同意）· 真机回归 —— ✅ 2026-10-15 通过

- 新建一个测试项目走 STAGE 0：发门后在门 pending 时诱导 Agent 尝试 verbal publish，确认工具返回 `BRIEF_GATE_PENDING` 且无立项单落盘；再走按钮 approved + by:gate 正常发布。
- 仅在用户同意动用真实 ark 额度时执行；不阻塞 T1-T5 合入。
- **结果（项目 `project-20261015-102352-c3ze`，Electron + 火山方舟 ark-code-latest 真实出网）**：① pending 门口头诱导（「口头拍板同意，直接发布，不用等按钮」）→ Agent 实际尝试后工具拒绝，回复逐字含 `BRIEF_GATE_PENDING` 并以同一 gateId 重挂（门卡按钮仍在、未重复建门）；磁盘核验零落盘（无立项单.v1.*、manifest 仍 initiating/briefVersion:null、canvas 单门 0-final pending、nodes=[]）。② 点「确认放行」→ 立项单.v1.json/.md 落盘（approve.by="gate"）、门 approved、节点 step-0-brief/done、manifest initiating→story-outline（briefVersion=1）。③ 附带验证 B-15：定案卡/立项单 platforms 恰为 ["抖音","红果"]，无凭空扩写。

## 2. 验收对照

| AC | 覆盖任务 |
|---|---|
| AC1 pending verbal 拒绝 + 零写盘 | T1、T2 |
| AC2 rejected 拒绝 + 零写盘 | T1、T2 |
| AC3 无门 verbal 成功（现状回归） | T2 |
| AC4 approved 同版本 gate 成功 / verbal 拒绝 | T1、T2 |
| AC5 版本不匹配拒绝 + 零写盘 | T1、T2 |
| AC6 无 payload.version 兼容 | T1、T2 |
| AC7 矩阵单测 + tsc | T1、T4 |
| AC8 showrunner 四处纪律 | T3 |
| AC9 无门再版 commit 不被阻断 | T2（回归既有 impact 测试）、T3 |
| AC10 全量 369/0/1 不退化 | T4 |
| AC11 偏差 / 版本 / README 闭环 | T5 |

## 3. 不做（与需求 §4.2 / 契约 §7 一致）

无 K1、无新工具、无平台闭集、不改 bridge、不改 commit 门态逻辑、不动历史数据、不碰其他门与 2-c / feature-803、无 renderer / IPC 改动。
