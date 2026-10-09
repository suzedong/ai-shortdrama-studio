# SDG-RE · 契约 · feature-015 待定门重启恢复

> 版本：v1.0（待用户签字）
> 日期：2026-10-07
> 卡口：本契约触发 **K3**——改造既有 hydrate/replay 职责：正常路径（`loadWorkflow()` 非 null）在 `pendingGate` 非空时引入 `replayMessages` 兜底调用，突破 feature-007 契约 §1「replayMessages 仅在存量迁移时被调用」与 §7.1「产物字段一律以 snapshot 文件为准」两条既定语义。**不触发 K1**（不改 `shared/types.ts`）、**不触发 K4**（manifest/定稿文件/DTO 结构零变化）、**不触发 K6**（不新增模块/文件，测试加在既有 `src/App.restore.test.tsx`）、**不触发 K8**（无 IPC 增删）、**不触发 K9**（零新依赖）。用户签字即视为对 K3 的授权，实施时须在变更记录追加永久决策条目。
> 兼容：`pendingGate === null` 的正常路径与迁移路径行为逐字不变；新逻辑仅在「manifest 记有待定门」时激活，属加性修复。
> 既有契约反向同步对象：feature-007 契约 §1 L16（replay 唯一调用处）、§7.1 L151（产物一律以 snapshot 为准）——两处加修订标注指向本 Feature。

---

## 1. hydrate 编排变更（src/App.tsx 恢复 effect，唯一改动点）

现状骨架（[App.tsx L1354-1367](../../../src/App.tsx)）：

```ts
let state: WorkflowState
let r0: ReturnType<typeof replayMessages> | null = null
if (!wf) {
  r0 = replayMessages(msgs)
  // …迁移路径…
} else {
  state = wf
}
```

目标形态：

```ts
let state: WorkflowState
let r0: ReturnType<typeof replayMessages> | null = null
if (!wf) {
  r0 = replayMessages(msgs)
  // …迁移路径不变…
  state = replayToWorkflow(r0)
  await window.api.saveWorkflow(state)
} else {
  state = wf
  // feature-015：待定门兜底——manifest 记有门时，产物可能只在消息流（产物文件 confirm 才落盘）
  if (state.pendingGate !== null) {
    r0 = replayMessages(msgs)
  }
}
```

约束：

- `replayMessages(msgs)` 复用已加载的 `msgs`，不重复 IPC；迁移路径的 `saveIdea/saveDiagnosis/readFinalized/saveWorkflow` 四步只在 `!wf` 分支，正常路径不执行。
- 复用既有变量 `r0`：下游装配表达式形态统一为 `r0 ? (r0.X ?? snapX) : snapX`——迁移路径语义不变（`r0` 必非空），正常路径在 `pendingGate === null` 时 `r0` 为空 → 表达式退化为现状，零行为变化。

## 2. 产物装配优先级变更（仅六个 AI 产物字段）

| 字段 | 现状（wf 非 null 且 r0 null） | 目标（wf 非 null 且 pendingGate 非 null → r0 非空） |
| :-- | :-- | :-- |
| visualStyleV | `snap.brief ? {...snap.brief.visualStyle, rationale:''} : null` | `r0.visualStyle ?? 现状表达式` |
| storyOutlineV | `snap.outline ?? null` | `r0.storyOutline ?? snap.outline ?? null` |
| characterProfilesV | `snap.profiles ?? null` | `r0.characterProfiles ?? snap.profiles ?? null` |
| scenesV | `snap.scenes ?? null` | `r0.scenes ?? snap.scenes ?? null` |
| dialogueV | `snap.dialogue ?? null` | `r0.dialogue ?? snap.dialogue ?? null` |
| storyboardV | `snap.storyboard ?? null` | `r0.storyboard ?? snap.storyboard ?? null` |

明确不变：ideaTextV / diagnosisV / fiveElementsV / preflightV / briefVersionV / setFeOverride(normalizeFiveElements(state.feOverride)) / phase / nodes / redo 三态 / activeUnlock / activeDraft / saved——装配表达式与持久化 effect 均不改。

## 3. 不变式与守护

- **不变式 I-1**：`pendingGate` 非空 ⇒ 消息流存在对应该门产物的正式（非 `candidate`）消息。依据：开门仅两条路径（非 draft 生成直推、`adoptAiCandidate`），均先 push 正式消息再开门；draft 候选期不开门；清空对话被 `CHAT_CLEAR_BLOCKED` 拦截（有门时不可清）。
- **守护 G-1**：单测固化 I-1 的恢复效果（AC-1/AC-2）——mock 消息流含正式产物消息 + wf.pendingGate 非空 + snap 缺对应文件，断言门按钮出现。
- **守护 G-2**：单测断言恢复完成后 `saveWorkflow` 末次调用 payload `pendingGate` 等于原 manifest 值（不被 effect 冲 null，症状二直接守护）。
- 门重建守卫表达式（`pg === '0-c' && visualStyleV` 等）与 `buildGate*` 签名零改动。

## 4. 既有契约与测试的反向同步（铁律 3）

| 对象 | 现有内容 | 变更 |
| :-- | :-- | :-- |
| feature-007 契约 §1 L16 | 「`replayMessages` 仅在存量迁移时被调用（§7.2）」 | 行尾加修订标注：`（2026-10-07 起经 feature-015 修订：正常路径 pendingGate 非空时亦调用一次作门重建兜底，见 feature-015 契约 §1）` |
| feature-007 契约 §7.1 L151 | 「产物字段一律以 snapshot 文件为准」 | 行尾加修订标注：`（2026-10-07 起经 feature-015 修订：pendingGate 非空时六个 AI 产物取 replay 优先兜底，见 feature-015 契约 §2）` |
| [App.tsx L1311](../../../src/App.tsx) 注释 | 「replayMessages 唯一调用处」 | 注释更新为「迁移路径 + 正常路径 pendingGate 兜底两处调用」 |
| [App.restore.test.tsx](../../../src/App.restore.test.tsx) 既有用例 | 迁移路径（loadWorkflow→null）恢复门等 | **全部保留**，新增用例只增不减 |

## 5. 异常规则汇总

1. `pendingGate` 非空但消息流无对应正式产物消息（I-1 被破坏，仅手动改数据可达）：门不重建，行为同现状，不抛错、不阻断 hydrate。
2. `replayMessages` 对损坏消息既有容错（坏 data 忽略）不变；本 Feature 不改 replay 本体。
3. 恢复后首次 `saveWorkflow` 由持久化 effect 自然触发（`hydrated` 翻正 + `setNodes` 等），无需显式调用。
4. 任何实现不得增删/改名契约导出；冲突按 L1/L2/L3 处理。

## 6. 验收映射

见任务清单 AC 表（AC-1 ~ AC-5 与需求规格 §5 对齐）。
