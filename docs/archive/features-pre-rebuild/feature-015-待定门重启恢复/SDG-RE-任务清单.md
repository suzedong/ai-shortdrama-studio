# SDG-RE 任务清单 · feature-015 待定门重启恢复

> 版本：v1.1（已实施，Feature 收尾）
> 日期：2026-10-07
> 前置：feature-007/011/013/014 已落地；用户已拍板范围 = **方案 A（restore replay 兜底）**（不做 B/C）。本 Feature **不新增 npm 依赖、不新增文件**（测试加在既有 `src/App.restore.test.tsx` 内）。
> 卡口状态：触发 **K3**（改造既有 hydrate/replay 职责：正常路径 `pendingGate` 非空时引入 `replayMessages` 兜底）。**不触发 K1/K4/K6/K8/K9**。用户对本任务包签字即视为授权；实施时在变更记录逐条追加永久决策。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`、`docs/governance/AI-SDG-AI工具执行指令.md`
- [x] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`
- [x] `src/App.tsx`（恢复 effect L1319-1501、门重建守卫 L1448-1493、持久化 effect L1504-1525、产物装配 L1374-1406）
- [x] `src/lib/replay.ts`（全文：产物折叠逻辑，candidate 语义，partial/reject 对 pendingGate 的处理）
- [x] `src/lib/workflow.ts`（replayToWorkflow 映射）
- [x] `src/lib/messages.ts`（makeVisualStyle / makeStoryOutline / makeCharacterProfiles / makeScenes / makeDialogue / makeStoryboard 的 candidate 标记规则）
- [x] `src/App.restore.test.tsx`（既有用例，全部保留）
- [x] `electron/session.ts`（saveWorkflow / loadWorkflow / saveBriefSnapshot / saveToCurrent / readFinalized 契约行为）
- [x] `docs/features/feature-007-数据治理/SDG-RE-契约.md` L16/L151（反向同步对象）
- [x] `docs/features/feature-011-立项补齐/SDG-RE-契约.md`（partial 语义与门不关闭确认）
- [x] `package.json`（零依赖确认）

> 禁止读取与修改清单以外文件，除非实施中明确需要。

## 1. 签字前置

- [x] T0-1 用户对需求规格 v1.0 / 契约 v1.0 / 任务清单 v1.0 逐项签字（K3 随签字授权）
- [x] T0-2 用户确认 K3 卡口授权（本文件头部已列明，签字即确认）
- [x] T0-3 确认范围边界：不做 B/C；不动持久化结构/共享类型；零依赖

## 2. 原子任务

### T1 · restore effect 变更（契约 §1–§2，唯一改动点）

- [x] T1-1 在 `else { state = wf }` 分支追加：`if (state.pendingGate !== null) { r0 = replayMessages(msgs) }`
- [x] T1-2 六个 AI 产物装配沿用既有 `r0 ? (r0.X ?? snapX) : snapX` 表达式（零改动，r0 按需非空即生效），其余字段装配不变
- [x] T1-3 恢复 effect 头部注释更新：replay 调用点由「迁移路径唯一」改为「迁移路径 + 正常路径 pendingGate 兜底两处」
- [x] T1-4 验证：恢复后既有门重建守卫（`pg === X && 对应产物非空`）自然使门按钮出现，不再出现 symptoms

### T2 · 反向同步与回归

- [x] T2-1 feature-007 契约 L16/L151 加修订标注指向本 Feature（措辞见契约 §4）
- [x] T2-2 `npm run typecheck` 通过
- [x] T2-3 `npm run test` 全绿（42 文件 473 passed / 1 skipped，只增不减）
- [x] T2-4 `npm run build` 通过
- [x] T2-5 手动回归（2026-10-07，dev 5173 真实运行时，CDP 驱动 Electron 渲染层）：构造 0-c「改部分」挂起工程 → 重启 → 门三按钮恢复、门摘要取消息流候选、manifest `pendingGate` 保持 `'0-c'`；现场再点「改部分」仍保持 `'0-c'`
- [x] T2-6 变更记录升版收尾（实施记录 + 证据）

### T3 · 测试（只增不减）

- [x] T3-1 `App.restore.test.tsx` 新增：mock 正常路径（wf.pendingGate='0-c'、readFinalized 无 brief、消息流含正式 visual-style），断言门三按钮出现
- [x] T3-2 `App.restore.test.tsx` 新增：mock 正常路径（wf.pendingGate='1-a'、readFinalized 无 outline、消息流含 story-outline），断言门按钮出现
- [x] T3-3 `App.restore.test.tsx` 新增：mock 正常路径 pendingGate='0-c' + snap 有旧版 brief + 消息流含新正式 visual-style，断言门摘要取新候选（`配方：柔光`），旧版不出现（`配方：旧配方` 为 null）
- [x] T3-4 `App.restore.test.tsx` 新增：同 T3-1 场景断言恢复完成后末次 `saveWorkflow` payload `pendingGate === '0-c'`（不被冲 null）
- [x] T3-5 既有测试全部保留通过（迁移路径/无会话/0-a 恢复等 20 用例不变）

## 3. AC 自检表

| AC | 自检方式 | 任务 | 状态 |
| :-- | :-- | :-- | :-- |
| AC-1 0-c 首审待定重启恢复 | T3-1 单测（门按钮出现 + saveWorkflow 不被冲 null） | T1/T3 | ✅ |
| AC-2 同机制覆盖其余五门 | T3-2 单测（1-a 门恢复） | T1/T3 | ✅ |
| AC-3 链上 0-c 防陈旧 | T3-3 单测（snap 旧版 + 消息流新版 → 产物态为新） | T1/T3 | ✅ |
| AC-4 零回归 | T2-3 typecheck/test/build 全绿；既有测试不删不改 | T2/T3 | ✅ |
| AC-5 手动回归 | T2-5 CDP 驱动真实运行时 | T2 | ✅ |
