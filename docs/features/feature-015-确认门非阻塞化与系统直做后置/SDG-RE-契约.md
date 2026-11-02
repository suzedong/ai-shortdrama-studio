# feature-015 确认门非阻塞化与系统直做后置 · 契约

> 本文是门协议与裁决后置动作的唯一事实源；与旧包冲突以本文为终态（旧包条款由本包变更记录标注改口）。
> 受影响旧契约：feature-001 §7、feature-012 §1.3、feature-101 §5、feature-201 §5、feature-807 纪律 5。

## 1. `gate.request` 返回契约（K8 · 变更）

### 1.1 入参（不变 + 0-final 增键）

```
{ gateId: GateId, question: string, options: string[], payload?: object }
```

`payload` 仍是开放对象。`0-final` 门**必须**携带结构化草案（见 §2），其余门不要求。

### 1.2 返回（变更）

**旧**：阻塞至用户裁决，返回 `{ ok:true, gateId, status:'approved'|'rejected', decision, note?, decidedAt, payload? }`。

**新**：**立即返回**，永不等待用户操作。

```
{ ok:true, gateId, status:'pending', requestedAt, payload }
```

- `requestedAt`：本次发门时间（ISO）。
- `payload`：原样回传，供 Agent 自核。
- 同一 `gateId` 重复发门：覆盖重开为 pending（`reopened:true` 经 `gate:changed` 推送），返回形状相同。
- 不再有 `decision` / `decidedAt` / 终态 `status`——**裁决结果不经过 MCP 工具返回**，只能由系统后置动作与画布门态体现。

### 1.3 错误（不变）

`INVALID_ARGUMENT`（缺 gateId/question/options）／`NO_PROJECT`。

## 2. `0-final` 门草案 payload（K8 · 增键）

```jsonc
{
  "version": 1,                    // 既有：绑定版本号
  "pendingMarks": [],              // 既有
  "changesFromPrevious": [],       // 既有
  "impactSummary": {},             // 再版门既有，首版不携带
  "draft": {                       // 本包新增：结构化草案，系统直发的唯一数据源
    "kind": "commercial",
    "fiveElements": { "genre":"", "platforms":[], "episodeDuration":"", "episodeCount":"", "tone":"", "aspectRatio":"" },
    "premise": { "leads":"", "time":"", "place":"", "coreEvent":"", "seasonBoundary":"" },
    "style": { "mainStyleId":"A7", "catalogVersion":"v1.46", "auxiliaryStyleId":"B1" },
    "diagnosisSummary": "可选",
    "diagnosisDetail": "可选"
  }
}
```

- `draft` 形状 = `brief.publish` 的草案入参（`BriefDraft` 全字段），**不含 `approve`**（裁决来源由系统记 `by:'gate'`）。
- `payload.version` 必须与「按磁盘实况即将发布的版本号」一致；不一致时系统拒发（§4.2）。
- 入参 schema 校验：`0-final` 且缺 `draft` → `INVALID_ARGUMENT`（新门一律要求）；`1-a~2-b` 不校验 draft。

## 3. 裁决后置动作映射（系统直做）

| gateId | approved 时系统动作 | rejected 时 |
|---|---|---|
| `0-final`（首版 v1） | 校验草案 → harness → `publishV1InQueue` → upsert `step-0-brief` → `advanceManifest('brief-published')` | 仅写门态 + note |
| `0-final`（再版 v2+） | 仅确认草案与版本，**不发布**；Agent 下一轮经三选一后调 `impact.commit` 唯一发布 | 仅写门态 + note |
| `1-a` | `advanceManifest('outline-approved')` | 仅写门态 + note |
| `1-b` | `advanceManifest('profiles-approved')` | 仅写门态 + note |
| `2-a` | `advanceManifest('scenes-approved')` | 仅写门态 + note |
| `2-b` | `advanceManifest('dialogue-approved')` | 仅写门态 + note |
| 其他 | 无 | 无 |

约束：

- 映射表是**主进程常量**，Agent 不可指定、不可覆盖。
- `1-a~2-b` 的产物文件、画布节点 `done`、依赖边**仍由 Agent 落盘**；系统只推 manifest。
- manifest 推进返回 `already-there` 视为幂等成功；`bad-transition` / `terminal` 记为后置失败（§4.2），**不回滚门态**（门已裁决是事实），经推送告知。
- 裁决后置动作与门态写盘在同一调用内顺序执行；门态先落盘，后置失败不改门态。

## 4. 裁决执行（`GateBridge.decide` → `applyGateDecision`）

### 4.1 时序

```
decide(gateId, {decision, note})
  ├─ 无 live 门且磁盘门 pending → 恢复（既有逻辑）
  ├─ 写门态（approved/rejected + note + decidedAt）→ 推送 gate:changed
  └─ approved → applyGateDecision(gate)
        ├─ 成功 → 推送 gate:changed（execution:{ok:true, ...摘要}）
        └─ 失败 → 推送 gate:changed（execution:{ok:false, code, message}），产物零写盘
```

`gate:changed` 事件载荷在既有 `{ gate, title? }` 上增 `execution?`（IPC 推送体，非 shared 类型，无 K1）：

```ts
execution?: { ok: true; summary: string } | { ok: false; code: string; message: string }
```

renderer 门卡据此显示「已发布 v1 / 已推进」或失败原因。

### 4.2 失败处理

| 失败 | 行为 |
|---|---|
| 草案缺字段 / 风格非法（`evaluateDraft` + 谱系） | 不发布，门**回退为 pending**，推送失败原因（用户可修正后重新发门） |
| `payload.version` 与将发布版本不符 | 同上，回退 pending |
| harness blocker | 不发布，门保持 **approved**，摘要写回 payload 供门卡上屏（与 feature-806 一致），推送失败；Agent 修复后走 verbal / 重新发门 |
| 磁盘写入异常 | 门保持 approved，推送失败，不部分回滚已写文件（沿用既有发布语义） |
| manifest `bad-transition` / `terminal` | 门保持 approved，推送失败，提示现场不一致 |

「草案问题回退 pending」与「harness/磁盘问题保持 approved」的区分：**前者是门本身授权内容不完整，后者是已授权内容的执行故障**。

### 4.3 历史无草案首版门

历史**首版** `0-final` 门 `status:'pending'` 且无 `payload.draft`（本包之前发出、重启后恢复；再版门仅确认后仍走 `impact.commit`，不适用本兜底）：

- 点「通过」→ **不直发**，门写 approved 并推送 `execution:{ok:false, code:'GATE_DRAFT_MISSING'}`；
- 提示 Agent 走既有 `brief.publish`（`by:'gate'`）完成发布——该通道保留，feature-807 防护对已 approved 门放行。

### 4.4 幂等

- 同一门已 `approved` / `rejected` 后再次 `decide`：**忽略**（不重复执行后置动作），返回 `{ok:true, ignored:true}`。
- 0-final 重复通过不会出第二版立项单；manifest 由 `already-there` 幂等兜底。

## 5. `GateBridge` 结构变更

- **删除** `pending: Map<gateId, PendingGate>` 及 `request` 的等待 Promise、`GATE_TIMEOUT` 结算语义。
- `request` → `upsertGate` 后立即返回 pending 门对象。
- `settleAll(reason)` → 改为 `clearLive()`：仅清内存索引，**不再触发任何门态变更或后置动作**（项目切换 / 关窗不产生发布）。
- `recoverPending()` 保留：把磁盘 pending 门装入内存索引，供重启后裁决。
- `decide()` 异步化（后置动作是 IO），IPC handler 相应 `await`。

## 6. Agent 侧纪律（提示词改口）

1. 发门即回合收尾：`gate.request` 返回 pending 后，向用户说一句「定案卡已挂出，请在卡上拍板」，**本轮不再调用任何工具**。
2. 不再存在「重挂等待」「工具调用层超时」概念；`GATE_TIMEOUT` 相关条款删除。
3. 用户点按钮后，**首版 0-final 的 publish 与 manifest 推进已由系统完成**——Agent 不得再调 `brief.publish`（by:'gate'）或 `manifest.advance('brief-published')`；再版 0-final 仅确认草案，Agent 下一轮仍按三选一调 `impact.commit` 唯一发布；`1-a~2-b` 的 `manifest.advance` 同样不得再调。
4. `1-a~2-b` 门通过后，Agent 下一轮仍需自行落盘产物正文 + 置节点 done（若发门前已落盘则无需重复）。
5. 回合开始先 `canvas.get` + `manifest.get` 读现场：门 approved 且产物已就位 → 续跑下游；门 approved 但 `execution` 失败 → 按推送原因处理。
6. 口头拍板（verbal）通道保留：`brief.publish({approve:{by:'verbal',...}})` 后仍需自行 `manifest.advance`（系统只在按钮路径直做）。

## 7. 兼容性

- 旧门（无 `draft`）走 §4.3，不会卡死。
- `brief.publish` / `brief.impact.commit` 工具签名与返回零改动，既有测试不受影响。
- `CanvasGate` 类型不变（payload 本为 `unknown`）。
- 门卡 UI 仅新增 execution 结果展示，既有 harness 摘要块不动。
