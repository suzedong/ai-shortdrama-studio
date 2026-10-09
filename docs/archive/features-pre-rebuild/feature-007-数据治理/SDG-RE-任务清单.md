# SDG-RE 任务清单 · feature-007 数据治理

> 版本：v1.0（2026-10-04）
> 前置：feature-006 通用产物查看已定稿（readFinalized 能力可复用）。
> 卡口预判：**K3**（改造 replay/hydrate 既有职责）、**K4**（manifest 承载工作流快照）、**K6**（本新任务包）、**K8**（新增 4 条 IPC + 扩展 readFinalized）。均需用户签字后实施。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`
- [x] `短剧Agent平台设计.md`（§7、§7.1：events.log 原设计与一期落地真相）
- [x] `shared/types.ts`（只读；Stage/NodeStatus/GateId/RevisionSource/UnlockData/产物类型）
- [x] `electron/session.ts`（readFinalized / 各 save / enqueue / manifest 读写）
- [x] `electron/main.ts`（IPC 注册）
- [x] `electron/preload.ts`（api 暴露）
- [x] `src/lib/replay.ts`（replayMessages 现状）
- [x] `src/lib/revision.ts`（DOWNSTREAM/STAGE_GATE/CHAIN_ORDER/isRunnable）
- [x] `src/lib/viewer.ts`（resolveViewer 来源标签与回退）
- [x] `src/App.tsx`（hydrate 编排、push/patchMessage、各状态变化点）
- [x] `src/components/ChatPanel.tsx`（面板头部，清空入口）
- [x] feature-006 任务包（需求/契约/D-007 硬边界）

> 禁止读取与修改清单以外文件，除非任务执行明确需要（如对应测试文件）。

## 1. 原子任务

### T1 · DTO 与纯函数（renderer + electron 镜像）
- [x] T1-1 electron：`electron/session.ts` 增 `WorkflowState` 接口（契约 §2）
- [x] T1-2 renderer：新增 `src/lib/workflow.ts`，镜像 `WorkflowState`，并实现 `replayToWorkflow(r: ReplayResult): WorkflowState`（workflowVersion:1，映射契约 §7.2-4 各字段）
- [x] T1-3 单测 `src/lib/workflow.test.ts`：映射字段正确、workflowVersion=1、默认值（无 pendingGate/redos → null、saved）

### T2 · manifest 工作流读写（electron）
- [x] T2-1 `saveWorkflow(state)`：单写队列，读 manifest → 平铺写 WorkflowState（保留 status/createdAt）
- [x] T2-2 `loadWorkflow()`：读 manifest；workflowVersion=1 返回完整态；缺失/损坏返回 null
- [x] T2-3 单测：读-改-写保留既有字段、缺版本返回 null、损坏返回 null、无会话 NO_SESSION

### T3 · idea / diagnosis 持久化（electron）
- [x] T3-1 `saveIdea(text)`：归档旧 idea.json → 写 `{text}`
- [x] T3-2 `saveDiagnosis(data)`：归档旧 diagnosis.json → 写 TopicDiagnosis
- [x] T3-3 单测：首次写无归档、再次写归档到 版本/、内容正确、无会话 NO_SESSION

### T4 · chat:clear（electron）
- [x] T4-1 `clearChat()`：耐久前置校验 → 覆盖 `[]` → manifest 重置交互态保留链态 → 返回 cleared
- [x] T4-2 单测：正常清空返回条数且产物文件不动；有 pendingGate/redo/activeDraft → CHAT_CLEAR_BLOCKED；无会话 NO_SESSION；activeUnlock/invalidated 保留

### T5 · readFinalized 扩展（electron，K8）
- [x] T5-1 FinalizedSnapshot 增 `idea` / `diagnosis`；readFinalized 读 idea.json / diagnosis.json 填充（容错跳过）
- [x] T5-2 electron 侧 FinalizedSnapshot 类型同步扩字段
- [x] T5-3 更新既有 readFinalized 测试：idea/diagnosis 齐全纳入、损坏跳过；diagnosis 优先文件而非 brief 兜底

### T6 · IPC 注册与 preload
- [x] T6-1 main.ts 注册 `workflow:save/load`、`idea:save`、`diagnosis:save`、`chat:clear`
- [x] T6-2 preload.ts 暴露 `saveWorkflow/loadWorkflow/saveIdea/saveDiagnosis/clearChat`
- [x] T6-3 全局 window.api 类型声明（global.d.ts 镜像约定）补方法签名

### T7 · App hydrate 分层重构
- [x] T7-1 正常路径：`Promise.all([loadWorkflow(), readFinalized()])`，按契约 §7.1 分层装配
- [x] T7-2 迁移路径：loadWorkflow=null → replayMessages → saveIdea/saveDiagnosis → 装配 → saveWorkflow（§7.2）
- [x] T7-3 showArchive 改纯派生 `nodes.background==='active'`（§7.3），移除 replay 中的 showArchive 依赖装配
- [x] T7-4 各状态变化点（gate-action/unlock/revision/阶段进入/0-a、0-c 通过）追加 `saveWorkflow`；idea 提交追加 saveIdea、0-a 通过追加 saveDiagnosis

### T8 · 清空对话入口 UI
- [x] T8-1 ChatPanel 头部增「清空对话」按钮（props 增 onClear / canClear），testid 与禁用态（契约 §7.4、设计 §4）
- [x] T8-2 App 接 onClear：前置拦截 → 二次确认 → clearChat → setMessages([]) 并按 §7.1 重新装配；CHAT_CLEAR_BLOCKED 提示
- [x] T8-3 viewer 来源标签：清空后产物来源为独立定稿文件（复用既有 resolveViewer，验证不回归）
- [x] T8-4 组件测试：按钮可点/禁用、确认弹窗、清空成功装配

### T9 · 收尾与验证
- [x] T9-1 单元测试补齐并全绿
- [x] T9-2 双端 tsc：`npx tsc -p tsconfig.node.json` 重建 electron 声明，再 renderer tsc
- [x] T9-3 全量 vitest 无回归
- [x] T9-4 `npm run build` 通过
- [x] T9-5 feature-006 变更记录加 ⛔ 反转块（D-007 两硬边界）；本包 SDG-AI-变更记录追加 K3/K4/K6/K8 永久决策
- [x] T9-6 AC 逐项自检
- [x] T9-7 真机验证：新项目/旧项目/清空对话三条路径（人工执行）

## 2. 验收标准（AC）

- **AC-1** 新会话 hydrate 不调用 replayMessages；业务产物全部来自定稿文件，首屏与旧 replay 结果等价。
- **AC-2** idea.json 在创意提交、idea unlock 通过时写入；diagnosis.json 在 0-a 通过、重诊通过时写入，字段与消息流原产物一致。
- **AC-3** WorkflowState 随门动作/unlock/revision/阶段进入写回 manifest；loadWorkflow 能完整还原。
- **AC-4** viewer 任意时点（与对话是否清空无关）均以独立定稿文件取数，sourceFiles 始终标独立定稿文件；「清空对话」后消息为空，产物仍在、可查看、可继续生产。
- **AC-5** 清空在有未确认门/生成中/修改会话/重做等待时被阻止（renderer 禁用 + electron CHAT_CLEAR_BLOCKED 双保险）。
- **AC-6** 旧会话首次打开自动迁移，幂等；迁移后 idea/diagnosis 文件与 WorkflowState 齐备，二次打开走正常路径。
- **AC-7** unlock 变更链、invalidated 节点在清空后语义保留；节点 detail 显示定稿/旧版内容。
- **AC-8** 全量 vitest 通过；双端 tsc 零错误；build 成功；无回归。
- **AC-9** K3/K4/K6/K8 卡口经用户签字，决策记录永久落账；feature-006 D-007 反转块到位。
- **AC-10** 真机三路径（新项目走查 / 旧项目迁移 / 清空对话）验证通过。
