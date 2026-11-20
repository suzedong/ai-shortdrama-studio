# feature-801 manifest 状态机推进 · 需求规格

> 任务包性质：**新规格落地 + 历史骨架清退**（非反向补录）。实现设计书 v1.11 §7.1 已写明、代码零落地的 `manifest.json.status` 7 态状态机，并清退历史 10 节点 `Stage` 线性模型骨架。
>
> 事实源：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §7.1（L546–596），状态机原文 L578–583、manifest 定位 L554、永不归档 L589；字段契约以 [shared/types.ts](../../../shared/types.ts) 为准。
>
> 解决偏差：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) **B-04**（manifest.status 7 态推进零实现 + 历史 10 态 Stage 骨架残留）。
>
> 溯源标签：**[自研新增]**（设计书已定状态机，平台侧从零落地）。

## 1. 背景

设计书 §7.1 L578 已最终定稿：

```
initiating → story-outline → story-profiles
  → script-scenes → script-dialogue → script-storyboard → storyboard-done
```

「每次定稿读-改-写推进一格；当前实现覆盖 STAGE 0-2 产物链，STAGE 3-7 沿同一机制随 feature 包扩展」。

磁盘/代码实况（2026-10-13 盘点）：

- **零类型**：7 态在 `shared/types.ts` 中无任何联合类型；`manifest.json` 12+ 字段无 `ProjectManifest` 接口，[library.ts](../../../electron/project/library.ts) `createProject` 写的是匿名对象字面量。
- **零推进**：全仓唯一落库值是 createProject 写入的 `status:'initiating'`；没有任何函数读-改-写 `manifest.status`；[brief.publish](../../../electron/mcp/tools.ts) 按 feature-001 契约显式不推进状态。
- **零消费**：UI 阶段轨道（StudioApp stageTrack）、画布全部以独立的 `canvas.json`（CanvasNode.step/kind/status）为事实源，不读 manifest；manifest 的 `status/phase/nodes/pendingGate/redoGate/storyRedo/scriptRedo/activeUnlock/activeDraft/feOverride/preflight/saved` 除 createProject 写入、listProjects 读 `createdAt` 外，**生产代码与测试零读取**。
- **历史骨架**：`Stage` 10 态联合仅剩两个类型内消费点——[library.ts](../../../electron/project/library.ts) 私有的 `initialNodes()`（产出 `manifest.nodes`）与 [types.ts](../../../shared/types.ts) `UnlockData.downstream: Stage[]`（该接口除类型定义外全仓零消费）；另有孤立死组件 [StageCanvas.tsx](../../../src/components/StageCanvas.tsx)（无任何文件 import）。
- **定稿点实况**：showrunner 当前有 4 道产物门（1-a 大纲 / 1-b 小传 / 2-a 分场 / 2-b 台词）+ brief.publish 立项定稿；`2-c` 门 id 已在 `GateId`/`RevisionSource` 类型中保留但 showrunner 无此门（分镜文字稿定稿随 feature-201 反向补录补齐）。
- **事件基础设施**（本包不直接使用，记录备选）：opencode SSE → `EventProjector`、`canvasStore.subscribe`、`gateBridge.setGateListener` 三个回调点当前都只向 renderer 广播、无 manifest 副作用。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 要做什么 | 达成效果 |
|---|---|---|---|---|
| R1 | 主控 Agent（showrunner） | 立项定稿（brief.publish 成功）后 | 调一次显式推进工具，把 `manifest.status` 从 `initiating` 推到 `story-outline` | 状态机第一格由真实定稿动作驱动，不靠时间/对话猜测 |
| R2 | 主控 Agent | 1-a 大纲门 approved、1-b 小传门 approved、2-a 分场门 approved、2-b 台词门 approved 之后 | 各调一次推进工具，状态沿链前进一格（共 4 格） | 状态与已定稿产物严格一致；门未 approved 不推进 |
| R3 | 主控 Agent | feature-201 补齐分镜文字稿定稿（2-c 门 approved）后 | 调同一推进工具完成最后一格 `script-storyboard → storyboard-done` | 机制本包建好，第 6 格触发随 201 落地；STAGE 3-7 后续沿同一机制扩展 |
| R4 | 主控 Agent | 回合开始 / 中断恢复 | 只读查询当前 `manifest.status` 与推进历史，判断从何处继续 | replay/续跑有权威阶段指针，不依赖 UI 状态 |
| R5 | 系统（持久化层） | 每次推进 | 读-改-写 `manifest.json`（串行写队列），保留既有字段，`manifest.json` 永不归档 | 与设计书 L554/L589 一致；并发/重入安全 |
| R6 | 系统 | 推进事件与当前态不匹配（跳格/乱序/重复定稿非幂等情形） | 显式拒绝并返回错误码，不错写状态 | 状态机只进一格、不跳态、不可回退 |
| R7 | 用户 | 打开历史项目（旧 12 字段骨架 manifest） | 读时容错：缺字段补默认、状态值非法回退 `initiating`，项目可正常打开 | 不做离线迁移、不阻断历史项目；旧字段磁盘留存 |
| R8 | 系统 | 新项目创建 | 写入**有类型**的精简 manifest（status/createdAt/workflowVersion/updatedAt/statusHistory），不再写历史 10 态 `nodes` 等骨架字段 | 新文件即新 schema；`Stage` 类型可整体删除 |

## 3. 状态机与定稿事件（一一对应）

| 事件（工具入参） | 含义 | from（仅允许） | to | 触发时机 |
|---|---|---|---|---|
| `brief-published` | 立项单首版定稿 | `initiating` | `story-outline` | brief.publish 成功且 `version===1` 之后 |
| `outline-approved` | 故事大纲定稿 | `story-outline` | `story-profiles` | 1-a 门 approved 之后 |
| `profiles-approved` | 人物小传定稿 | `story-profiles` | `script-scenes` | 1-b 门 approved 之后 |
| `scenes-approved` | 分场定稿 | `script-scenes` | `script-dialogue` | 2-a 门 approved 之后 |
| `dialogue-approved` | 台词定稿 | `script-dialogue` | `script-storyboard` | 2-b 门 approved 之后 |
| `storyboard-finalized` | 分镜文字稿定稿 | `script-storyboard` | `storyboard-done` | **2-c 门 approved 之后（随 feature-201 落地，本包只建机制 + 提示词预留位）** |

语义约定：

1. `initiating` 覆盖整个 STAGE 0 立项对话期；立项后再发 v2/v3（feature-002 立项后变更）**不**再推进——状态机第一格只认「首版立项定稿」。重复调 `brief-published` 幂等返回当前态（见契约 §3）。
2. 状态机只前进一格、不可回退；立项后变更导致下游失效（feature-002 的脏读/重走）不回退 `status`，由 canvas 节点 `invalidated` 与影响清单表达。
3. 状态推进与确认门机制**解耦**：平台工具不读 gateBridge 状态、不校验门是否真 approved（避免双机制生命周期耦合）；「approved 后才调 advance」由 showrunner 提示词纪律 + 编排测试保证（沿用 feature-001「publish 不检查门状态」同款边界）。
4. 到达 `storyboard-done` 后再收到任何推进事件 → 终态错误，不新增态。

## 4. 范围

### 4.1 本包做

- `shared/types.ts`（**K1**）：新增 `ManifestStatus`（7 态）、`ManifestEvent`（6 事件）、`ManifestTick`、`ProjectManifest`；删除历史 `Stage` 10 态；改 `UnlockData.downstream`（Stage 零消费）；删除死组件 StageCanvas。
- 新增 `electron/project/manifest.ts`：manifest 读（容错）/写（串行）/推进纯函数 `nextManifestStatus()` 与有状态 `advanceManifest()`。
- MCP 新增两个零 LLM 工具：`manifest.get`（只读）、`manifest.advance`（读-改-写推进一格）；工具总数 14 → 16，同步 runtime provider 白名单（showrunner 物理工具 ID 9 → 11）。
- [library.ts](../../../electron/project/library.ts) `createProject` 改写有类型精简 manifest，删除 `initialNodes()`。
- [showrunner.md](../../../resources/opencode/agents/showrunner.md)：立项 publish 后与 1-a/1-b/2-a/2-b 门 approved 收尾处加入「调 manifest.advance」定稿动作纪律；2-c 预留位（feature-201 激活）；回合恢复增加 manifest.get。
- 单元测试（状态机纯函数全跃迁/乱序/幂等/容错）+ 工具测试（落盘形状、串行、旧 manifest 兼容）+ 编排测试（定稿→推进顺序断言）。

### 4.2 本包不做（显式排除）

- **STAGE 3-7 的状态扩展**：7 态链之外不新增任何状态；3xx–7xx 包按同一机制自行扩展（设计书 L578）。
- **feature-201 分镜文字稿产出与 2-c 门**：本包不实现 `分镜/shotlist.json` 生产链，showrunner 不新增 2-c 门动作；只在提示词与机制中预留 `storyboard-finalized` 事件。
- **feature-002 立项后变更**：不写 `manifest.briefVersion`、不做 `parentReference`/影响清单/脏读；再版立项不推进状态机（见 §3 约定 1）。
- **事件自动投影**：不把推进挂到 EventProjector / gateBridge / canvasStore 订阅器上（推进采用显式工具方案，见变更记录 D-002）；不新增任何订阅副作用。
- **renderer/UI 改动**：不新增阶段状态 UI、不加 IPC、StudioApp 阶段轨道继续以 canvas 节点推导（manifest.status 当前无 UI 消费面；manifest.get 仅供 Agent/测试）。
- **manifest 其余历史字段的语义复活**：phase/nodes/pendingGate/redoGate/storyRedo/scriptRedo/activeUnlock/activeDraft/feOverride/preflight/saved 不重建、不消费，新项目不再写。
- 根目录 [mcp/server.ts](../../../mcp/server.ts) 占位 mock（未接线）中的 `project.manifest` 不在本包清理。

## 5. 验收（业务层）

- AC1：`createProject` 后的 `manifest.json` 为有类型精简形状——`status:'initiating'`、含 `createdAt/workflowVersion:1/updatedAt/statusHistory:[]`，**不含** nodes/phase/pendingGate 等历史字段。
- AC2：一条完整 STAGE 0→2 链路上，showrunner 依次完成「brief.publish v1 → 1-a approved → 1-b approved → 2-a approved → 2-b approved」后，`manifest.status` 依次为 `story-outline → story-profiles → script-scenes → script-dialogue → script-storyboard`，`statusHistory` 记录 5 条 tick（事件/from/to/at）。
- AC3：门未 approved（pending/rejected）时 showrunner 不调 advance；编排测试中断言「定稿产物落盘 + 门 approved」先于对应 advance 调用。
- AC4：乱序/跳格事件（如 `initiating` 态直接收 `scenes-approved`）返回 `ok:false, error.code='MANIFEST_BAD_TRANSITION'`，manifest 文件内容不变。
- AC5：重复幂等——当前态已是该事件的目标态时再次调用同一事件（如立项 v2 后又调 `brief-published`），返回 `{ok:true, status, advanced:false}`，不追加 tick、不重写文件。
- AC6：终态保护——`storyboard-done` 下收任何事件返回 `MANIFEST_TERMINAL`，文件不变。
- AC7：旧项目 manifest（含 12 字段骨架、`nodes` 10 态、`status:'initiating'`）可被 manifest.get 正常读出（旧字段原样保留在磁盘、读返回不丢失未知字段），非法/缺失 `status` 容错为 `initiating`；openProject 不报错。
- AC8：生产代码与测试中不再 import 或出现 `Stage` 类型与 `StageCanvas`；`npm run typecheck`、`npx tsc -b tsconfig.node.json` 与本包相关测试全绿（不扩大当时 HEAD 既有 11 失败基线；该存量失败已于 2026-10-14 清零）。
- AC9：showrunner.md 中 5 个已定稿点（publish 后 + 4 门后）均有 manifest.advance 动作与正确事件名；2-c 仅以「feature-201 预留」语境出现。

## 6. D-037 现行归并约束（2026-11-19）

本节自包含承接 feature-807、feature-015 以及 feature-010 / feature-012 中的**通用确认门与状态推进约束**，是当前负责入口；归档包只保留历史快照。此次仅归并规格，不新增产品能力。

| 编号 | 现行有效需求 |
| :-- | :-- |
| R37-01 | **门态防绕过**：`brief.publish` 的口头 / 门卡发布仍受 807 四条防护约束——pending 不得绕过、rejected 不得直接发布、approved 门不得再用 verbal 凭证、门绑定版本与将发布版本必须一致，分别沿用 `BRIEF_GATE_PENDING` / `BRIEF_GATE_REJECTED` / `BRIEF_GATE_APPROVED_USE_GATE` / `BRIEF_GATE_VERSION_MISMATCH`。不得伪造用户原话、版本或授权范围。 |
| R37-02 | **非阻塞请求**：`gate.request` 持久化 pending 门后立即返回 `{ ok:true, gateId, status:'pending', requestedAt, payload }`，不等待用户裁决，也不在返回体中伪装 approved / rejected、`decision` 或 `decidedAt`。同一 gateId 的 pending 门重复发门按 015 覆盖重开为 pending，并经既有 `gate:changed` 推送 `reopened:true`，不是新增 `GATE_ALREADY_PENDING` 拒绝分支。裁决前不得发布、推进或挂脏；项目切换 / 关窗只清 live 索引，不触发后置动作。 |
| R37-03 | **裁决后系统直做**：既有链路为 `gate.decide → 写 approved/rejected + note + decidedAt → approved 时 applyGateDecision(gate)`，执行器位于 `electron/gate/execute.ts`；不存在本次新增的 `gate.execute` 接口。后置映射由主进程固定：0-final 首版执行草案 / 版本 / Harness 校验、发布、`step-0-brief` upsert 与 `brief-published`；再版仅确认草案与版本；1-a / 1-b / 2-a / 2-b 分别推进既有精确 manifest 事件。rejected 只写门态与 note，不执行后置动作。 |
| R37-04 | **执行结果与失败分类**：execution 沿用既有 `gate:changed` 推送摘要 `{ ok:true, summary } | { ok:false, code, message }`，不另造 pending / approved / failed 三态、runId 或 `EXECUTION_FAILED`。草案缺字段、风格非法或版本不符时回退 pending；Harness blocker、磁盘异常、manifest bad-transition / terminal 时保持 approved 并推送失败摘要，不把门裁决回滚。历史无草案首版门以 `GATE_DRAFT_MISSING` 明确失败并走保留的 `brief.publish(by:'gate')` 兜底。已 approved / rejected 的门重复 decide 返回 ignored，不重复发布或推进；manifest `already-there` 视为幂等成功。 |
| R37-05 | **重开边界**：rejected 可沿用同一 gateId 携带最新草案重开为 pending。approved 仅 0-final 允许版本化重开：新旧 `payload.version` 均可解析且新版本严格大于旧版本时覆盖为 pending；同版本、较低版本、版本不可解析均拒绝，其余门的 approved 仍为终态。不得以新 gateId 规避版本与历史门态约束。 |
| R37-06 | **通用就绪提示边界**：feature-010 的“条件已齐可拍板 / 继续补”等提示只表达候选 readiness；达到条件后可携带既有事实形成门草案，但不得自动建门、自动批准或自动发布。立项数据、定案协议与门卡业务字段仍归 feature-001，本包只负责通用门态与推进。 |
| R37-07 | **首版 / 再版与 verbal 分流**：0-final 首版按钮路径由系统直接发布、upsert 并推进 `brief-published`，Agent 不得重复 publish / advance；再版 v2+ 按钮只确认草案与版本，仍由 Agent 下一轮经三选一后调 `impact.commit` 唯一发布。1-a～2-b 按钮路径由系统推 manifest，产物正文、画布节点 done 与依赖边仍由 Agent 落盘。verbal 通道保留，`brief.publish(by:'verbal')` 后仍由 Agent 显式推进 manifest。 |
| R37-08 | **职责边界**：本包与 feature-806 独立。本包负责 pending → decide / execute → execution 摘要 → reopen 及 manifest 精确事件推进；Harness 校验规则、findings、`harness.validate` 与写盘前校验拦截仍归 feature-806。本包只消费校验通过 / 失败结果，不吞并、复制或改写校验规则。 |

**旧口径冲突处理**：本节生效后，§3 语义约定第 3 条及契约 §3.2 / §7 / §8 中“门机制与推进完全解耦、Agent 在 approved 后另行调用 advance”的旧编排，仅就由系统直做的按钮路径被 015 取代；verbal 与历史无草案首版兜底仍按保留通道由 Agent 调用。`manifest.advance` 的既有事件枚举、单格推进与幂等契约保留，但按钮路径不得由 Agent 再写一次。历史 AC 与当时验证证据不回改。

**范围声明**：本 Change 无新接口、无新共享类型、无新事件，不将历史归并写成新功能实施或真机验收；既有未完成事项继续按原状态追踪。
