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
- 2026-10-13：T1 shared/types.ts 落地；T2/T3 `electron/brief/`（diff/plan/render-md）落地，13 单测过；T4 三 MCP 工具落地（24 测试过）。
- 2026-10-13 T5 配套（围栏外最小必要改动）：[provider.ts](../../../electron/runtime/provider.ts) `SHOWRUNNER_DECLARED_TOOLS` 由 6 扩到 9，追加 `shortdrama_brief.plan/publish/list` 三个物理 ID——否则 showrunner 调立项工具会被 [client.ts](../../../electron/runtime/client.ts) 请求级白名单拦截。任务清单 §0 围栏列举时未含 runtime/，此处按「T4 工具必须对 showrunner 可达」的契约本意补登，不改判定函数签名、不扩 director 集合；runtime-client.test.ts 同步加一条放行用例（23 测试过）。
- 2026-10-13：T5 `showrunner.md` 重写——STAGE 0 收敛为「入口反问 → 诊断+六要素对话态 → 故事前提对话收敛（落 `故事背景档案.md`）→ 风格只引用 ID@版本 → brief.plan 自检 → 唯一门 0-final → publish」，口头拍板携 verbal.quote；第 1/2 步输入改 brief.list + file.read `立项单.vN.json`；旧 `立项/diagnosis.json`、`立项/视觉风格.json`、`立项/brief.json` 仅在禁令语境保留。frontmatter tools/permission 同步声明三工具。
- 2026-10-13：T6 渲染端适配落地——StudioViewer `BriefView` 按 v2 六段重写；CanvasBoard KIND_LABEL「创意简报→立项单」并补 STEP_LABEL `'7'`；StageNavPanel / ChatComposer / Stage0View 静态文案对齐；dev-mock-api 删除旧 gates 假数组、demo brief 换 v2（节点 ref 改 `立项单.v3.json`）。grep「创意简报」生产/渲染代码零残留。
- 2026-10-13：T7 测试同步闭环——`orchestration.test.ts` 全文重写为单门 0-final 编排契约（6 用例：未就绪零门/就绪唯一门 approved→brief.publish/口头拍板等价/多次 rejected 同 id 重开/不触媒体资产任务/pending 恢复续跑）；story/script-orchestration 的 STAGE 0 输入路径改 `立项单.v1.json`（1-a/1-b、2-a 用例不动）；studio-flow 门卡挂载两例 `0-a`→`0-final`（含 gate helper 重命名、卡文与两处 decide 断言）；canvas-board 已用新 id/「立项单」核对无需改（18 测过）。
  - 本包新引入并已修复的 3 处静态契约测试：① agent-profiles 的「frontmatter 无点号工具键」旧断言与契约 §3「物理 ID 保留点号」冲突，改写为白名单断言（仅 `shortdrama_brief.plan/publish/list`、仅 showrunner），showrunner 物理工具期望由 6 升 9；② runtime-integration `listAgents` 期望工具清单补三工具（真 opencode serve 端到端验证点号键被正确解析）；③ mcp-brief-tools 入参类型修复（BriefDraft 无索引签名，调用处改对象展开 `{ ...draft }`）。
  - **全量验证结论**：`npm run test:run` 222 passed / 1 skipped / 11 failed；11 个失败全部为 HEAD 基线既有——studio-flow.test.tsx 10 例与 architecture.test.tsx「无 comfyui 字样」1 例，经 `git stash -u` 基线对照复现确认非本包引入（故障单待后续包处理），本包改动未扩大失败面。`npx tsc -b tsconfig.node.json` + `npm run typecheck` 本包零错误，仅剩 7 条基线白名单（dev-mock-api L217 glob ×1、CanvasBoard L789 null ×2、VisualCatalog ×4）。全仓 grep 确认生产代码与提示词无旧门 id 与旧路径（仅禁令/历史文档语境保留）。
- 2026-10-13：T8 治理收尾——偏差清单 B-01/B-02 标 ✅（§1.2 工具数 11→14、5 族→6 族）；docs/features/README 登记 feature-001 已落地；本包闭环。

## 三、修订记录

（暂无）
