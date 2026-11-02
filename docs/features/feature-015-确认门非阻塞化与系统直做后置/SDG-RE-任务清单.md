# feature-015 确认门非阻塞化与系统直做后置 · 任务清单

> 前置：本规格 5 文件经用户批准。**K8 触发**：既有 `gate.request` 返回契约变更（阻塞→立即返回）+ `0-final` 门 payload 增 `draft` 键。**无 K1**（不改 shared/types.ts）、**无工具数量变化**（29 个不变）、**无新 IPC 通道**（复用 `gate:changed` / `gate:decide`）。
> 用户三项口径已于 2026-11-01 拍板：① 0-final 草案随门落盘；② 1-a~2-b 只推 manifest；③ 保留 verbal 通道。

## 0. 上下文加载清单（工作围栏）

- 事实源：本包需求 / 契约 / 设计；feature-001 §7、feature-012、feature-806、feature-807、feature-801。
- 改动面白名单：
  - `electron/gate/bridge.ts`（非阻塞化）
  - `electron/gate/execute.ts`（新建）
  - `electron/mcp/tools.ts`（仅 gate.request handler + 草案 schema）
  - `electron/main.ts`（仅 gate:decide handler await + execution 透传）
  - `src/global.d.ts`（renderer IPC execution DTO，不进 shared）
  - `src/studio/shell/StudioApp.tsx`（保留裁决门并透传 execution）
  - `src/studio/chat/ChatComposer.tsx`（仅 pending 门显示口头拍板提示）
  - `src/studio/chat/GateCardView.tsx`（execution 结果行）
  - `resources/opencode/agents/showrunner.md`（门纪律）
  - 测试：`src/test/gate/`（含新增 `gate-execute.test.ts`）、`src/studio/contracts/orchestration.test.ts`、`src/studio/chat/gate-card-harness.test.tsx`
  - 文档：偏差清单 B-66、feature-001/012/101/201/807 变更记录改口、features/README.md
- 红线：`shared/types.ts`；`brief/publish.ts` / `project/manifest.ts` / `harness/`（只复用不改）；`brief.publish` 与 `brief.impact.commit` 工具；其余 3 个 agent 提示词；renderer 其他模块。

## 1. 原子任务

### T1 · 裁决执行器 execute.ts + 单测
- 映射表、publishFromGate、advanceForGate、失败分类（回退 pending / 保持 approved）。
- 新建 `src/test/gate/gate-execute.test.ts` 覆盖契约 §4 全表。
- 完成标准：新套件全绿。

### T2 · bridge 非阻塞化
- request 立即返回、删 pending Promise、decide 异步 + 幂等忽略、clearLive、execution 推送。
- 改写 `gate-bridge.test.ts`。
- 依赖 T1。

### T3 · 工具层与 IPC
- `gate.request` handler 返回 pending；0-final `draft` zod schema + 缺失校验。
- `main.ts` gate:decide await + execution 透传。
- 依赖 T2。

### T4 · 门卡 execution 展示
- GateCardView 显示「已发布立项单 vN」/「已推进」/失败原因。
- 追加组件测试。

### T5 · showrunner 门纪律改口
- 纪律 4/5/8、第 0 步 7/8、1-a~2-b 门后动作、删超时与重挂条款。
- 0-final 发门 payload 增 draft 的写法说明。

### T6 · 编排测试改写 + 旧契约改口 + 全量验证
- orchestration.test.ts 改新协议形态。
- feature-001/012/101/201/807 变更记录追加改口条目；偏差清单 B-66。
- `npm run typecheck` 恰 3 条历史基线；全量 vitest 0 failed。

## 2. 验收
对照需求规格 §4 AC1–AC9 逐项核验。
