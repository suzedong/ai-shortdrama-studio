# SDG-AI 变更记录 · feature-015 待定门重启恢复

> 版本：v1.1（规格已签字 K3 授权；编码 + 自动化回归 + 手动回归全部完成，Feature 收尾）
> 日期：2026-10-07

## 决策记录（K 卡口触发，永久保留）

### D-015-1 · K3 正常路径待定门 replay 兜底恢复（已签字 · 已实施）

- 触发：K3（改造既有 hydrate/replay 职责——正常路径在 `pendingGate` 非空时引入 `replayMessages` 兜底，修订 feature-007 契约 §1「replay 仅迁移调用」与 §7.1「产物一律以 snapshot 为准」两条既定语义）。不触发 K1/K4/K6/K8/K9。
- 背景：feature-013/014 手动回归实证——0-c 门「改部分」后重启，门按钮消失且 manifest `pendingGate` 被覆写为 null。根因：产物文件仅在 confirm 时落盘，正常路径恢复只认 snapshot → 产物缺 → 门重建守卫失败 → 持久化 effect 以 `gateKey=null` 冲掉 manifest 门记录。影响 0-c/1-a/1-b/2-a/2-b/2-c 六门首审待定重启；链上 0-c 另有陈旧数据次生问题。
- 用户拍板范围（2026-10-07）：**方案 A（restore 对 pendingGate 以 replay 兜底重建）**；明确不做方案 B（生成时落中间产物文件）、方案 C（候选产物平铺进 manifest）。
- 内容：
  1. `src/App.tsx` 恢复 effect：正常路径 `state.pendingGate !== null` 时执行一次 `replayMessages(msgs)`，六个 AI 产物装配走既有 `r0 ? (r0.X ?? snapX) : snapX` 表达式（表达式零改动，仅 r0 从必 null 变为按需非空）；注释更新 replay 调用点描述。
  2. 反向同步：feature-007 契约 §1 L16、§7.1 L151 加修订标注指向本 Feature。
  3. 测试：`src/App.restore.test.tsx` 新增 1 describe 3 用例（0-c 首审恢复 + manifest 不冲 null、1-a 代表恢复、链上防陈旧），既有用例全部保留。
- 边界：不改 manifest/定稿文件/DTO 结构；不改活态 confirm/partial/reject/unlock 语义；不改 replay 本体；不做防御性 manifest 保护（不变式由单测锁定）；不修复已被冲 null 的历史会话（由画布重跑恢复，登记后续事项）。
- 证据/反向同步：
  - `src/App.tsx`：restore effect else 分支追加 `if (state.pendingGate !== null) { r0 = replayMessages(msgs) }`（L1371-1373）+ 三行注释（L1368-1370）；恢复头部注释更新（L1310-1313）。
  - 反向同步：feature-007 契约 §1 L16、§7.1 L151 已加修订标注。
  - 测试：`src/App.restore.test.tsx` 新增 describe「App 待定门重启恢复（feature-015）」3 用例（0-c 首审 + saveWorkflow payload 断言 pendingGate==='0-c'；1-a 代表；链上 snap 旧版 + 消息流新版 → 门摘要取新版）。
  - 回归：`typecheck` 通过；`test` 42 文件 473 passed（470→+3）/ 1 既有 skipped，只增不减；`build` 通过。
  - 手动回归（2026-10-07，dev 5173 真实运行时 + CDP `--remote-debugging-port=9222`）：构造 0-c「改部分」后挂起的工程（manifest pendingGate='0-c' + 消息流含正式 visual-style + partial gate-action），重启应用——门三按钮（确认拍板/改部分/否决重做）恢复、门摘要取消息流候选「形态：仿真人｜画风：清新生活流｜配方：柔光胶片」；manifest 回读后 `pendingGate` 保持 `'0-c'`；现场点击「改部分」后再读回仍为 `'0-c'`。两症状均消解。
  - 实施期记录：复用既有装配表达式是刻意的——`r0 ? (r0.X ?? snapX) : snapX` 形态在迁移路径已验证等价，本 Feature 只让正常路径在 `pendingGate` 非空时也得到非空 r0；`pendingGate === null` 时 r0 保持 null，表达式逐字退化为现状，零回归面。
- 签字：✅ 用户已签字（K3 授权）；编码 + 自动化回归 + T2-5 手动回归全部完成，Feature 收尾。

---

## 实施记录（落地后可清理）

- T1-1/1-2/1-3（restore effect 变更）一次通过；无返工。
- T2-1 反向同步两处标注随编码同提交。
- T2-2/2-3/2-4 typecheck / 473 tests / build 全绿。
- T2-5 手动回归：按契约 §1 构造挂起态工程，CDP 驱动验证门恢复与 manifest 保持。

## 修订记录（决策稳定后可清理）

（无）
