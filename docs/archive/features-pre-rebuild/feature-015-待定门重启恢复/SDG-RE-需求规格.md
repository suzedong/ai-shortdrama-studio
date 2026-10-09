# SDG-RE · 需求规格 · feature-015 待定门重启恢复

> 版本：v1.0（待用户签字）
> 日期：2026-10-07
> 来源标签：[自研新增]（恢复路径健壮性修复）
> 上游：feature-007（数据治理 · 恢复分层契约）、feature-011（立项补齐 · partial 语义）
> 直接触发：feature-013/014 手动回归实证——0-c 门「改部分」后重启应用，聊天历史恢复但门按钮（确认拍板/改部分/否决重做）不再出现，且 manifest 中 `pendingGate` 被覆写为 `null`。
> 用户拍板（2026-10-07 讨论确认）：采用 **方案 A（restore 对 pendingGate 以 replay 兜底重建）**；不做方案 B（生成时落中间产物文件）、方案 C（候选产物平铺进 manifest）。

---

## 1. 背景与问题

feature-007 确立恢复分层：业务产物以独立定稿文件为唯一事实源，运行态以 manifest 工作流快照为准，`replayMessages` 仅在存量迁移路径调用（feature-007 契约 §1/§7.2）。该分层在「门已 confirm、产物已落盘」时工作正常，但遗漏了一个时间窗：**AI 产物已生成、门已打开、尚未 confirm** —— 此时产物文件尚未落盘（产物文件唯一写入点是各门 confirm 处理器），产物只存在于消息流中。

根因链（以 0-c 为例，已逐行核实）：

1. 0-c 门打开（视觉风格已生成、未 confirm）时 brief.json 不存在——brief.json 唯一写入点是 0-c/0-d confirm 的 `saveBriefSnapshot` → `saveToCurrent`（[App.tsx L1004/L1042](../../../src/App.tsx)、[session.ts L441](../../../electron/session.ts#L441)）。「改部分」不关 `gateKey`、不写盘，行为本身正确。
2. 重启走正常路径（`loadWorkflow()` 非 null，不做 replay），产物装配只认 `snap.brief`（[App.tsx L1381](../../../src/App.tsx)）→ `visualStyleV = null`。
3. 门重建守卫 `pg === '0-c' && visualStyleV`（[App.tsx L1463](../../../src/App.tsx)）失败 → `setGate/setGateKey` 不执行 → **门按钮不出现**（症状一）。
4. 恢复收尾 `setNodes` 触发持久化 effect（[App.tsx L1504](../../../src/App.tsx)，`pendingGate: gateKey`，此时 `gateKey=null`）→ `saveWorkflow` 把 manifest 覆写为 `pendingGate:null` —— **门记录被二次销毁**，再无恢复可能（症状二）。

### 影响面（同一模式，不止 0-c）

产物文件仅在 confirm 时落盘的门全部中招（`saveStory/saveScript` 均只在 confirm 调用）：

| 门 | 重建所需产物 | 产物文件写入点 | 首审待定重启 |
| :-- | :-- | :-- | :-- |
| 0-a | diagnosis | 生成时即写（[App.tsx L401](../../../src/App.tsx)） | ✅ 正常 |
| 0-b | fiveElements | derive 兜底（[App.tsx L1455](../../../src/App.tsx)） | ✅ 正常 |
| **0-c** | visualStyle | 0-c confirm | ❌ **丢门** |
| 0-d | preflight + fiveElements | preflight 持久化于 manifest；0-d 打开前 brief.json 已存在 | ✅ 正常 |
| **1-a** | storyOutline | 1-a confirm | ❌ **丢门** |
| **1-b** | characterProfiles | 1-b confirm | ❌ **丢门** |
| **2-a** | scenes | 2-a confirm | ❌ **丢门** |
| **2-b** | dialogue | 2-b confirm | ❌ **丢门** |
| **2-c** | storyboard | 2-c confirm | ❌ **丢门** |

次生问题：变更链上 0-c 待定重启时 brief.json 为旧版 → 门用**陈旧**风格重建（新候选丢失）。

### 关键不变式（修复可行性的根据）

开门只有两条路径，均先 push **正式**（非 `candidate`）产物消息再开门：① 非 draft 生成直推（[App.tsx L419-490](../../../src/App.tsx)）；② 候选采用 `adoptAiCandidate`（[App.tsx L809-822](../../../src/App.tsx)）。draft 候选期间不开门。因此：**`pendingGate` 非空的任一时刻，消息流中必存在对应该门产物的正式消息**，`replayMessages` 必能折叠出重建所需数据（replay 跳过 `candidate`，正好取到门所示版本）。

---

## 2. 角色与场景

| 角色 | 场景 | 期望效果 |
| :-- | :-- | :-- |
| 创作者 | 0-c 门点「改部分」后直接重启应用 | 门按挂起时所见原样重建，三按钮可用；manifest `pendingGate` 保持 `'0-c'` |
| 创作者 | 1-a/1-b/2-a/2-b/2-c 门待定（未 confirm）时重启 | 同上，门与产物数据完整恢复 |
| 创作者 | 变更链上候选采用开门后重启 | 门展示**采用的新候选**，非 brief.json 旧版 |
| 创作者 | 无待定门的日常重启 | 行为与现状完全一致（零变化） |

---

## 3. 功能需求

### F1 · 正常路径 pendingGate 非空时 replay 兜底 `[自研新增]`

- F1-1 启动恢复中，`loadWorkflow()` 非 null（正常路径）且 `state.pendingGate !== null` 时，对已加载的 `msgs` 执行一次 `replayMessages(msgs)`，记为 `rGate`（仅此处新增调用；迁移路径既有调用不变）。
- F1-2 六个 AI 产物态（visualStyle / storyOutline / characterProfiles / scenes / dialogue / storyboard）的装配值改为 `rGate.X ?? 现有 snap 表达式`；`pendingGate === null` 时保持现有 snap 表达式，零行为变化。
- F1-3 产物态先行装配后，既有门重建守卫（`pg === X && 对应产物非空`）自然成立，门卡/门键/gateKey 恢复，持久化 effect 写回 `pendingGate: gateKey` 与 manifest 一致——null 覆写症状随数据源修复自然消解，effect 本身不改。
- F1-4 不触发 replay 的字段（ideaText / diagnosis / fiveElements / feOverride / preflight / phase / nodes / 各 redo / activeUnlock / activeDraft / saved）装配逻辑一律不变。

### F2 · 链上陈旧数据修正（同源顺带修复） `[自研新增]`

- F2-1 链上 0-c 待定（snap.brief 为旧版）时，F1-2 的 replay 优先使门与产物态取采用的新候选，confirm 落盘为新版本——与活态 confirm 语义（`saveBriefSnapshot(effectiveFe, visualStyle, …)` 读 state）一致。

---

## 4. 不做什么（边界）

1. **不改持久化结构**：manifest 字段、brief.json 等定稿文件格式、`WorkflowState` DTO 全部不变（无 K4）。
2. **不改 `shared/types.ts`**（无 K1）；不新增模块/文件，测试加在既有 `src/App.restore.test.tsx`（无 K6）；零新增依赖（无 K9）；无 IPC 增删（无 K8）。
3. **不改活态语义**：confirm / partial / reject / 候选采用 / unlock 传播零改动；`replayMessages` 本身零改动。
4. **不做防御性 manifest 保护**（重建失败时不冲 null 的额外守卫）：F1 落地后由 §1 不变式保证重建必有数据；不变式以单测锁定。
5. **不修复已被覆写为 null 的历史会话**：门记录已失，由用户经画布手动重跑对应阶段恢复（后续事项登记）。
6. 0-a / 0-b / 0-d 恢复路径不动（现状正常，见 §1 影响面表）。
7. 查看器取数不变：resolveViewer 仍以 FinalizedSnapshot 为唯一来源（feature-007 §7.1-5 不动）——replay 兜底仅用于 hydrate 首屏装配与门重建，不进查看器。

---

## 5. 验收标准（AC，任务清单 AC 表为准）

- AC-1 0-c 首审待定重启恢复：mock 正常路径（wf.pendingGate='0-c'、snap 无 brief、消息流含正式 visual-style），恢复后门三按钮出现；`saveWorkflow` 最后一次调用 payload `pendingGate === '0-c'`（不被冲 null）。
- AC-2 同机制覆盖其余五门：至少以 1-a（snap 无 outline + 消息流含 story-outline）单测验证门重建。
- AC-3 链上 0-c 防陈旧：snap.brief 为旧版 visualStyle、消息流含新正式 visual-style，恢复后产物态为新候选。
- AC-4 零回归：`pendingGate === null` 正常路径与迁移路径既有测试全部保留通过（测试只增不减）。
- AC-5 回归与手动验证：typecheck / test / build 全绿；手动回归——0-c「改部分」后重启 dev 应用，门仍在且可 confirm/partial/reject，manifest `pendingGate` 保持 `'0-c'`。

---

## 6. 上下文加载清单（围栏）

见任务清单 §上下文加载清单。

## 7. 后续事项（不在本 Feature）

- 历史受损会话（pendingGate 已被冲 null）的修复工具：如有真实用户数据再评估，当前会话可由画布重跑恢复。
- 查看器在门待定期间展示候选产物的能力（现状查看器只认快照，属 feature-007 既定语义，不动）。
