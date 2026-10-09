# SDG-AI 变更记录 · feature-007 数据治理（消息流瘦身与业务事实源分离）

> 三分类：决策记录（永久）/ 实施记录（落地清理）/ 修订记录（闭环清理）。

## 一、决策记录（永久保留）

### D-001 · K6 新增业务包 feature-007「数据治理」

- 日期：2026-10-04
- 卡口：**K6（新增业务包/顶层目录）**
- 触发：用户连续两次架构性质疑——「立项信息都存到 chat.messages.json 合适吗，以后清空对话记录，立项信息不都没有了」「为什么 chat.messages.json 要设计成业务数据源，他应该只是对话的数据源吗」。
- 事实（核对代码）：一期落地把消息流当成业务事实源——hydrate 靠 replayMessages 折叠出全部产物与工作流状态，独立定稿文件（brief.json、剧本/*.json、分镜/shotlist.json）仅作查看兜底；消息流一旦清空，门卡/重做等待/修改会话等运行态无法恢复。
- 决策：新建任务包 `docs/features/feature-007-数据治理/`，实施三层分离：
  1. 业务产物层：独立定稿文件（idea.json / diagnosis.json / brief.json / 故事背景档案.md / 剧本/*.json / 分镜/shotlist.json）为**唯一事实源**；
  2. 工作流状态层：manifest.json 平铺 WorkflowState 持久化快照；
  3. 对话展示层：chat.messages.json 回归纯展示，可清空/丢失而不损伤业务。
- 用户签字：**已批准立项「彻底分离」（2026-10-04，AskUserQuestion）；四份规格经 NotifyUser 批准**。
- 范围边界：不引新依赖（K9 不触发）；不改 `shared/types.ts`（DTO 双端镜像，K1 不触发）；replayMessages 保留，仅服务旧会话一次性迁移。

### D-002 · K4 manifest.json 承载 WorkflowState（新增顶层状态实体）

- 日期：2026-10-04
- 卡口：**K4（新增顶层业务实体 / store 持久化模型）**
- 决策：在会话 manifest.json 中平铺 11 字段工作流快照（workflowVersion / phase / nodes / pendingGate / redoGate / storyRedo / scriptRedo / activeUnlock / activeDraft / feOverride / saved）；新增 `saveWorkflow(state)` / `loadWorkflow()`，经单写队列读-改-写，保留 manifest 既有 status / createdAt。
- 语义：
  - loadWorkflow 仅在 workflowVersion=1 且 nodes 完整时返回状态；缺版本/损坏/nodes 缺失返回 null（触发迁移路径）；
  - 门动作 / unlock / revision / 阶段进入 / 0-a、0-c 通过等状态变化点均追加 saveWorkflow 写回。
- 类型归属：WorkflowState 在 `electron/session.ts` 与 `src/lib/workflow.ts` 各定义一份结构相同类型，沿用 feature-006 D-007 双端镜像约定（共享层只读，两 tsconfig 无共同可放位置）。
- 用户签字：**已批准（2026-10-04，NotifyUser）**。
- 影响文档：契约 §2 / §5.1-5.2 / §7.1。

### D-003 · K3 改造 replay/hydrate 既有职责（含 showArchive 纯派生）

- 日期：2026-10-04
- 卡口：**K3（旧系统改造/弃用/替换）**
- 决策：
  1. hydrate 拆双路径——正常路径 `Promise.all([loadWorkflow(), readFinalized()])` 分层装配，**不再调用 replayMessages**；迁移路径（loadWorkflow=null）执行 replayMessages → 补齐 idea/diagnosis 独立文件 → saveWorkflow 落快照，二次打开即走正常路径（契约 §7.1/§7.2）；
  2. replayMessages 不删除、不改语义，职责收缩为「旧会话一次性迁移」；
  3. showArchive 改为纯派生 `nodes.background === 'active'`，不再消费 replay 折叠字段（§7.3）；
  4. 迁移等价性（契约 §9.4）：迁移首屏沿用旧「r 优先、snap 兜底」装配语义，保证与旧 replay 结果逐点等价。
- 用户签字：**已批准（2026-10-04，NotifyUser）**。
- 影响文档：契约 §7、§9.4。

### D-004 · K8 新增 5 条 IPC + 扩展 readFinalized（反转 feature-006 D-007 硬边界）

- 日期：2026-10-04
- 卡口：**K8（新增 IPC 通道 / 破坏接口契约）**
- 决策：
  1. 新增 IPC：`workflow:save`、`workflow:load`、`idea:save`、`diagnosis:save`、`chat:clear`；
  2. `saveIdea(text)` / `saveDiagnosis(data)`：旧文件经 archiveExisting 归档到 `版本/` 后写入，保证历史可追溯；idea.json 在创意提交、idea unlock 通过时写；diagnosis.json 在 0-a 通过、重诊通过时写；
  3. FinalizedSnapshot 扩展 `idea` / `diagnosis` 两字段，readFinalized 读 idea.json / diagnosis.json 填充（损坏跳过），diagnosis 优先独立文件而非 brief.json 兜底；
  4. `chat:clear`：耐久前置校验（pendingGate / redoGate / storyRedo / scriptRedo / activeDraft 任一存在即抛 CHAT_CLEAR_BLOCKED）→ 消息覆盖 `[]` → manifest 重置交互态、保留 phase/nodes/activeUnlock/feOverride/saved 链态 → 返回 cleared；产物文件零触碰。
- 反转声明：feature-006 D-007 第 3 条硬边界（idea、完整 diagnosis 不可回退）自本包起**反转**——idea/diagnosis 已有独立定稿文件，清空对话后 viewer 正常回退，来源标签显示 idea.json / diagnosis.json；反转块已同步落到 feature-006 变更记录。
- 用户签字：**已批准（2026-10-04，NotifyUser）**。
- 影响文档：契约 §5、§8；feature-006 D-007。

### D-005 · 收紧查看器事实源：任意时点以独立定稿文件为准（反转 D-004 附带语义）

- 日期：2026-10-04
- 卡口：无新增（属本包三层分离原则的语义补齐，未触共享层/依赖/契约签名）
- 触发：路径 1 真机走查发现，消息未清空时 viewer 来源标签仍显示 chat.messages.json；用户指出「存取数据文件和对话清空没有关系」。
- 事实（核对代码）：resolveViewer 沿用 feature-006「消息流优先、snapshot 仅在消息流缺产物时兜底」顺序，与需求规格 §1「查看器从文件取数」、契约 §2「业务产物唯一事实源」总则不一致——独立文件既已是唯一事实源，查看器不应随消息流有无切换来源。
- 决策（Reverse Sync，先文档后代码）：
  1. 需求 US-4 / 验收 §6-4、契约 §7.1-5、任务 AC-4、设计 §5-4 的验收边界由「清空对话后」改为「**任意时点，与对话是否清空无关**」；
  2. resolveViewer 改为 snapshot 优先：snapshot 有该产物即以其装配、sourceFiles 始终标独立定稿文件；仅在 snapshot 缺字段（迁移首屏、独立文件尚未重读）时回退消息流/注入文本；
  3. diagnosis 附带的创意简报字段仍允许从消息流补充（仅附带展示，不影响数据事实源）。
- 用户确认：**已确认（2026-10-04，AskUserQuestion 自由文本指示）**。
- 验证：viewer 单测 21 项、全量 vitest 260 项通过；双端 tsc 零错误、build 成功；真机打开选题诊断来源显示 diagnosis.json。
- 影响文档：需求规格 US-4/§6、契约 §7.1、任务清单 AC-4、设计说明 §5；[viewer.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/viewer.ts)、[viewer.test.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/viewer.test.ts)。

## 二、实施记录

（纯实施通过任务清单 AC 勾选体现；以下为 T9-7 真机走查证据）

### I-20261004-1 · T9-7 路径 2「旧项目迁移」真机验证通过

- 对象：`project-1790989879665`（2026-10-03 创建，feature-007 之前；迁移前 manifest 为旧格式 fiveElements/visualStyle/status=storyboard-done，无 idea.json/diagnosis.json）。
- 首次打开（迁移路径）：自动补齐 idea.json（`{"text":"做一个校园恋爱甜宠短剧…"}`）、diagnosis.json（4 对标案例/用户洞察/钩子模式/合规/结论，与消息流原产物一致）；manifest 读-改-写保留旧字段并平铺 WorkflowState（workflowVersion=1、9 节点全 done、phase=script、各门/草稿 null、saved=true）。
- 首屏等价：对话气泡完整，9 节点 detail（创意/诊断/立项单/背景锁定/大纲/小传/分场 3 场/台词 18 句/分镜 16 镜）与旧 replay 一致；迁移项目打开选题诊断，来源显示 diagnosis.json、当前定稿。
- 二次打开（正常路径 + 幂等）：重启 dev 后 idea.json/diagnosis.json md5 与时间戳均未变（迁移未重跑），manifest 内容稳定（仅 hydrate 后工作流正常回写），内容完整恢复、无门弹窗。
- 结论：AC-6（旧会话首次自动迁移、幂等、二次走正常路径）真机验证通过。

### I-20261004-2 · T9-7 路径 3「清空对话」真机验证通过

- 对象：`project-1790989879665`（路径 2 已迁移）。
- 二次确认：空闲态点「清空对话」弹确认框，正文「将删除全部对话气泡与未落定的门/修改，已定稿的创意、诊断、立项单及各产物不受影响。此操作不可撤销。」；「取消」不删除、消息保留。
- 清空后磁盘：chat.messages.json 覆盖为 `[]`；idea/diagnosis/brief/档案/剧本/分镜等产物文件零触碰（md5/时间戳不变）；manifest 交互态重置（各门/草稿/重做 null）、链态保留（phase=script、9 节点全 done、activeUnlock/feOverride/saved）。
- 清空后界面（重点）：气泡全部消失；9 节点仍 ✓ 且 detail 完整重装配——创意原文、4 对标案例、立项单字段（平台/时长/画幅/风格）、档案已锁定、大纲、4 角色、3 场约 85s、18 句对白、16 镜；选题诊断查看器正常打开，标题旁「来源：diagnosis.json」+「当前定稿」徽标。
- 可继续生产 + 禁用态：点故事大纲「💬 对话修改」正常进入修改会话（输入框/重摇可用）；此时「清空对话」按钮置灰 disabled，help 提示「请先处理进行中的门/生成/修改」；放弃修改后恢复可点。
- 结论：AC-4（任意时点查看器取独立文件、清空后产物仍在可查看可继续生产）、AC-5（renderer 禁用 + electron CHAT_CLEAR_BLOCKED 双保险）、AC-7（链态/detail 语义保留）、AC-10（真机三路径）真机验证通过。

## 三、修订记录

（修正/反转/闭环旧条目时追加）
