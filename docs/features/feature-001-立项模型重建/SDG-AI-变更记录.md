# feature-001 立项模型重建 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · K1 批准修改共享层 `shared/types.ts`（2026-10-13）

- **触发**：立项模型重建必须替换 `ProjectBrief` schema、改 `GateId` 门 id 联合类型，命中 K1（共享层修改须用户批准）。
- **批准方式**：AskUserQuestion 明确选项「P0 任务包 + 直接开始编码」，用户选定即视为对本包 K1 范围的显式批准（含同轮编码）。
- **批准范围**（以 [契约 §6](./SDG-RE-契约.md) 为准）：
  1. 新增 `ProjectKind / StoryPremise / BriefStyle / BriefApprove / BriefChange / BriefMissingCode / BriefMissing / BriefPlan`；
  2. `ProjectBrief` 旧 6 字段整体替换为 v2（schemaVersion:2）；删除 `PreflightCheck`；
  3. `GateId` 由 `0-a/0-b/0-c/0-d/1-a/1-b/2-a/2-b/2-c` 改为 `0-final/1-a/1-b/2-a/2-b/2-c`；
  4. `RevisionSource` 删除 `0-c/0-d`（不新增 `0-final`，立项后变更解锁属 B-03/P1）；
  5. 删除旧消息门模型 `GateCard` 与 `ChatMessage.gate?`（生产零消费，门渲染走 CanvasGate）。
- **不在批准范围**：`CanvasGate.gateId` 保持动态 `string`（机制层零改动）；`StepId / Canvas / CanvasNode` 不动；`Stage` 保留仅供历史 manifest.nodes 骨架，待 B-04 清退。

### D-002 · 立项定案门唯一 id 拍板为 `0-final`（2026-10-13）

- **候选**：`0-final` / `0-gate` / `stage0-final`。选定 `0-final`：与既有 `1-a/2-a` 编号风格同族，`final` 明示「一道定案门、非逐产物审批」。
- **影响**：rejected 后同 id 重开（既有 bridge 语义），不做版本后缀。

### D-003 · 立项工具族与落盘边界拍板（2026-10-13）

- 新增三个零 LLM MCP 工具：`brief.plan`（只读校验）/ `brief.publish`（版本化落盘 + 画布节点）/ `brief.list`（历史版本）。
- 立项单落**项目根目录** `立项单.vN.json/.md`（对齐设计书 §7.1 L555），**不进** `版本/` 归档区、**不调** archiveExisting；版本号只由磁盘扫描分配（max+1），不信任何入参。
- publish **不**推进 manifest.status（B-04 排除）、**不**经 gateBridge（门由 Agent 用 gate.request 发起，publish 只落定案事实）。
- 画布 STAGE 0 唯一产物节点 `step-0-brief`，由 publish 内部 upsert，Agent 不手拼。
- 口头拍板与门内拍板的等价性由 Agent 携 `approve.verbal.quote` 落痕保证；平台不做 NLP（需求 §4.2）。

## 二、实施记录（过渡）

- 2026-10-13：任务包 5 文件建立（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录），需求与契约先行，代码随后按 T1→T8 落地。

## 三、修订记录

（暂无）
