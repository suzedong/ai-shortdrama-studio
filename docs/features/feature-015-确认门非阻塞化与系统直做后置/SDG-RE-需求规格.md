# feature-015 确认门非阻塞化与系统直做后置 · 需求规格

> 任务包 ID：feature-015 ｜ 类型：变更 — 裁决门协议重构（K8：既有 `gate.request` 返回契约变更 + `0-final` 门 payload 增键）
> 依赖：feature-001（门协议）、feature-002/004（发布主体）、feature-101/201（1-a~2-b 门）、feature-801（manifest）、feature-806（harness）、feature-807（门态防护）、feature-012（门卡留存）
> 用户拍板：2026-11-01 —— ① `0-final` 发门时把结构化草案随门落盘；② `1-a~2-b` 四门只由系统推进 manifest，产物正文仍由 Agent 落盘；③ 保留口头拍板（verbal）通道；④ 首版按钮由系统直发，再版保留三选一后 `impact.commit` 唯一发布，避免双写版本。

## 1. 背景与问题

`gate.request` 自 feature-001 起是「调用即等待用户点按钮」的阻塞工具：主进程把门写成 `pending` 后挂起 Promise，直到 renderer 裁决才 resolve。

而 opencode 对 MCP 工具调用有 **180 秒硬超时**（`SHORTDRAMA_MCP_TIMEOUT_MS`）。用户超过 3 分钟未点按钮，opencode 即以 JSON-RPC `-32001 Request timed out` 放弃请求——**门已落盘、等待仍在，但调用已报错**。

真机表现（2026-11-01 用户上报）：Agent 连续两次「发起裁决门 → MCP -32001 → 读画布确认 pending → 重挂」，对话流被超时噪音淹没；且每次重挂都在 `GateBridge.pending` 里多留一个永不清算的 entry（内存泄漏）。

根因是**结构性冲突**：同步「调用-响应」协议被套在「等人拍板」的长等待操作上。

## 2. 目标

1. **门请求立即返回**，不再阻塞等待用户裁决；任何时长的人工裁决都不会产生工具超时。
2. **门裁决的后置动作由系统直做**（D-016「系统优先，AI 归位」：状态推进是确定性操作，不经 AI 对话）。
3. Agent 回合在「发门」处自然终止；用户点按钮后由系统完成落盘 / 状态推进，Agent 下一轮从已推进的现场续跑。
4. 消除 `GateBridge.pending` 内存驻留与「重挂」这一整类纪律。

## 3. 范围

### 3.1 门分类与后置动作归属

| 门 | 触发产物 | 裁决后置动作 | 本包归属 |
|---|---|---|---|
| `0-final`（首版 v1） | 立项单 v1 | `brief.publish` 双写 + upsert `step-0-brief` + `manifest.advance('brief-published')` | **系统全量直做**（草案随门落盘） |
| `0-final`（再版 v2+） | 立项单 vN | 仅确认草案与版本；三选一后由 `impact.commit` 双写、写影响清单并挂脏 | **系统不抢先发布**，Agent 下一轮执行既有 commit |
| `1-a` | 故事大纲 | `manifest.advance('outline-approved')` | **系统直做状态推进**；产物正文与节点仍由 Agent 落盘 |
| `1-b` | 人物小传 | `manifest.advance('profiles-approved')` | 同上 |
| `2-a` | 分场 | `manifest.advance('scenes-approved')` | 同上 |
| `2-b` | 台词 | `manifest.advance('dialogue-approved')` | 同上 |
| `2-c` 及 STAGE 3+ 门 | 分镜文字稿 / 媒体 | 未定稿 / 未落地 | **不在本包**，沿用非阻塞返回、无后置动作 |

`1-a~2-b` 不接管产物正文的原因：正文只存在于 Agent 上下文，主进程无从获取；把数万字正文塞进门 payload 不合理。用户已拍板维持 Agent 落盘。

### 3.2 保留不变的机制

- **口头拍板（verbal）通道**：`brief.publish` 工具保留，`by:'verbal'` 照旧可用，feature-807 四条门态防护原样生效。
- **再版流程**：`brief.impact.assess / commit` 不动；再版门仍带 `impactSummary`（feature-012）。
- **harness 前置校验**：0-final 系统直发前必须过 `runHarnessValidation`，blocker 拦截零写盘。
- **门卡 UI**：`GateCardView` 的通过 / 打回按钮、note 输入、harness 摘要块全部保留。
- **门恢复**：重启后 `pending` 门仍可从画布恢复并裁决。

### 3.3 明确不做

- 不新增 / 不删除 MCP 工具（总数保持 29）。
- 不改 `shared/types.ts`（无 K1；门草案走 `CanvasGate.payload`，其类型本就是 `unknown`）。
- 不接管 `1-a~2-b` 的产物正文落盘与画布节点置 done。
- 不做「点按钮后自动唤起 Agent 续跑」的推送机制（Agent 仍由用户下一句话触发，见契约 §6 风险）。

## 4. 验收标准

| # | 标准 | 验证 |
|---|---|---|
| AC1 | `gate.request` 在无任何用户操作时 **100ms 内返回**，返回体含 `gateId` + `status:'pending'` | 单元测试 |
| AC2 | 首版 `0-final` 点「通过」后，**不经任何 Agent 调用**，项目根出现 `立项单.v1.json/md`、`step-0-brief` 节点为 done、manifest 推进到 `story-outline`；再版点「通过」只确认草案与版本，**不产生 v2+ 文件、不重复发布、不推进 manifest**，后续仅由 `impact.commit` 发布 | 单元 / 集成测试 |
| AC3 | 首版草案缺字段 / 风格非法 → **不发布**且门回退 pending；harness blocker → **不发布**且门保持 approved、摘要写回 payload；两类错误均经 `gate:changed` 推送上屏 | 单元测试 |
| AC4 | `1-a` 点「通过」后 manifest 推进到 `story-profiles`；点「打回」不推进 | 单元测试 |
| AC5 | 重复裁决同一门（连点两次通过）不产生第二次发布 / 第二次 advance | 单元测试 |
| AC6 | 项目切换 / 关窗时 `pending` 门清理后**不产生任何后置动作** | 单元测试 |
| AC7 | `GateBridge` 不再持有跨调用存活的等待 Promise | 代码审查 + 测试 |
| AC8 | `brief.publish`（verbal 通道）与 feature-807 四码防护零回归 | 既有测试套件 |
| AC9 | 既有测试全绿（除因契约变更而改写的门相关用例），`npm run typecheck` 恰 3 条历史基线 | 全量 vitest + typecheck |

## 5. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 点完按钮 Agent 不自动续跑，用户需再说一句「继续」 | 多一步人工动作 | 门卡裁决后给出明确提示文案；showrunner 纪律改为「回合开始读现场续跑」。自动唤起列为后续可选包 |
| 0-final 门 payload 携带完整草案，画布文件体积增大 | `canvas.json` 变大 | 草案仅六要素 + 前提 + 风格 + 诊断，量级 KB；诊断明细为最长字段，可接受 |
| 历史首版 pending 门（无草案 payload）在新代码下点通过 | 无法直发 | 识别为「无草案首版门」，只推进门态不发布，并提示走既有 `brief.publish(by:'gate')` / 重新发门（契约 §4.3）；再版不走该兜底 |
| 系统直发失败（草案 / harness / 磁盘）后门态处理 | 门卡死或误授权 | 草案缺字段、风格非法、版本不符回退 pending；harness blocker、磁盘或 manifest 故障保持 approved 并推送原因；失败分类见契约 §4.2 |
