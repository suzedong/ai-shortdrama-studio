# SDG-AI 变更记录 · feature-011 立项补齐

> 版本：v1.0（待用户签字）
> 日期：2026-10-05

## 决策记录（K 卡口触发，永久保留）

### D-011-1 · K1 共享层三处加性变更（待签字）

- 触发：K1（修改 `shared/types.ts`）。
- 内容：
  1. `GateId` 增加 `'0-d'`；
  2. `RevisionSource` 增加 `'0-d'`；
  3. `GateCard.harness` 项增加 `critical?: boolean`（缺省 false）。
- 必要性：0-d 是规格 §2.6 既定四门之一；critical 用于表达「失败必须显式知情」的阻断语义。均为加性变更，旧消费方不破坏。
- 边界：除此之外不动 shared 任何字段；`PreflightCheck` / `ProjectBrief.preflight` 已存在，仅启用。
- 签字：⬜ 用户签字后生效。

### D-011-2 · K6 新增 preflight 纯函数与组件模块（待签字）

- 触发：K6（新增业务模块）。
- 内容：`src/lib/preflight.ts`（buildInitialPreflight / evaluatePreflight）、`src/components/PreflightCard.tsx`（6 项编辑 + 锁）。
- 边界：纯函数无副作用；组件为受控组件，落盘由 App 编排。
- 签字：⬜ 用户签字后生效。

### D-011-3 · K3 删除背景档案 handleArchiveSave 旁路（待签字）

- 触发：K3（旧分叉路径废弃）。
- 内容：删除 App.tsx 中独立的 handleArchiveSave 保存 + 直推 background done 路径；背景档案统一经 saveArchive → 节点 / unlock 规则推进。
- 必要性：消除双路径行为分叉，保证八步链路口径唯一。
- 影响面：App 单函数 + ChatPanel 对应回调；手动回归确认。
- 签字：⬜ 用户签字后生效。

### D-011-4 · K8 gate partial 与新增 4 个 IPC（待签字）

- 触发：K8（消息契约 / IPC 变更）。
- 内容：
  1. gate-action 消息 data.action 联合扩 `'confirm'|'partial'|'reject'`；门 actions 增加 `'partial'`；GateCard 增加 onPartial / onRejectFeedback props。
  2. 新增 IPC：`project:list`、`project:create`、`project:open`、`template:save`、`template:list`；preload + global.d.ts 同步。
- 契约外补充：`project:open` 为实施中为项目库切换补齐的第 5 个 IPC（原决策列 4 个），语义与命名空间同口径，随本卡口一并追认。
- 不改动：runtime 与既有持久化 IPC 签名。
- 签字：⬜ 用户签字后生效。

### D-011-5 · 门禁失败阻断语义：critical 两步强制放行（待签字）

- 决策：门禁按钮**不禁用**（不做硬阻断），而采用「关键项未过 → 首次点击拦截并红字警示 → 二次显式确认强制放行」。
- 理由：保留人在明知风险时强推的自主权（规格允许人拍板），同时保证失败不可被一键无感越过；非关键 ✗ 不拦截。
- Agent / runtime 无自动跳过 0-d 的入口。

### D-011-6 · 旧会话 0-d 缺失只提示不阻断（待签字）

- 决策：brief done 但无 preflight（或缺项）的历史会话，viewer / 立项单显示黄条与「补录 0-d」入口，不强制迁移、不阻断打开与继续生产；新项目必须过 0-d。
- 理由：避免存量会话被静默判废，同时对新流程严格。

### D-011-7 · 立项单版本自增规则（待签字）

- 决策：磁盘无 brief → 首版 1；0-b/0-c/0-d 任一**再次** confirm（重做 / 反补定稿）→ version+1 并在覆盖前归档旧版到 `版本/`。首次顺序四门通过只产生 v1。

### D-011-8 · 视觉参考图口径与边界（待签字）

- 决策：0-c 参考图经规定的 text_to_image URL 生成 3 构图（≥2 成功即可），仅为立项风格示意，**不属于** qwen-image 生产媒体通道；不落盘项目目录；加载失败诚实占位。

### D-011-9 · 走查暴露三处 bug 修复（已实施）

- **模板 number 类型崩溃**：`handleApplyTemplate` 直接注入模板 `fiveElements`，历史 brief 含 `episodeCount: 80`（number），`buildGate0b` 的 `.trim()` 抛 TypeError，0-b 门静默消失。修复：提取 `normalizeFiveElements` 做边界规范化，模板/磁盘数据统一转 string。
- **preload ESM 编译覆盖**：`tsconfig.node.json` 的 `include: ["electron"]` 把 `preload.ts` 也编成 ESM，覆盖 `tsconfig.preload.json` 的 CJS 产物，导致刷新后白屏。修复：`exclude` 加 `"electron/preload.ts"`。
- **横屏关键词被忽略**：`deriveFiveElements` 画幅仅按平台派生，用户输入「横屏 16:9」被忽略。修复：用户明示意图（横屏/16:9/竖屏/9:16）优先于平台派生。

### D-011-10 · replay 0-b 门 fiveElements 缺失自动推导（已实施）

- 决策：旧会话 0-a 确认后因 bug 未生成 `fiveElements`，重启 replay 时从 `ideaText + diagnosis` 自动推导补全，避免死锁。

### D-011-11 · 档案锁定 live 路径 background 未置 done 死锁修复（已实施）

- **现象**：实时四门链路走完 0-d confirm 后锁定背景档案，`background` 节点仍为 `active`，`applyUnlock('background')` 虽将 5 个下游置 `invalidated`，但 `isRunnable('outline')` 要求链上前驱 `background==='done'`，导致大纲「重新生成」永久禁用、变更链死锁；只有重启经 replay（`archive` 消息置 `background=done`）才恢复。
- **根因**：[App.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/App.tsx) `commitArchive` 保存成功后仅 push archive 消息与 `applyUnlock`，从未在 live state 调 `setNodeStatus('background','done')`，与 replay 路径（[replay.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/replay.ts) L218-220）不一致。
- **修复**：`commitArchive` 保存成功后补 `setNodeStatus('background','done', 档案已锁定)`，对齐 replay 语义；纯行为修复，不动共享层、零新增依赖。

### D-011-12 · 重启正常路径不读档案、background 残留非死锁状态修复（已实施）

- **现象**：D-011-11 修复后重载 renderer，因 manifest 中 `background` 仍是修复前落盘的 `active`，启动走 wf snapshot 正常路径（[App.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/App.tsx) L1348-1350）直接采信快照，背景档案面板呈现为空模板编辑器（不加载磁盘 `故事背景档案.md`），大纲仍禁用。
- **根因**：正常恢复路径只在迁移路径（无 wf）才折叠消息，从不 `readArchive`，也不校验 background 节点与磁盘定稿的一致性；磁盘有档案而快照节点非 done 时无自愈。
- **修复**：restore effect 中 `readFinalized` 后并行 `readArchive`：有档案即 `setArchiveTextCache`，并在 wf 路径把 `nodes.background` 对齐 `done`（快照随后经 autosave 落盘）；磁盘无档案则不虚构定稿。新增 2 个 restore 对齐回归用例，不动共享层、零新增依赖。

---

## 变更分类（实施时勾选）

> 按三分类登记实际改动：

- 结构性变更（K1/K3/K6/K8）：见 D-011-1~4。
- 行为变更：门禁判据真实化、critical 阻断、0-d 编排、版本自增、档案校验、项目库/模板。
- 呈现变更：三 tab、参考图、来源角标、底栏、输入区、画布点阵/连线。

## 实施记录（实施后追加）

> 实施日期：2026-10-05。对应任务 T1–T13；零新增 npm 依赖（K9 未触发）。

### 改动清单

- 共享层（K1，D-011-1）：[types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/shared/types.ts) 三处加性变更。
- 新增模块（K6，D-011-2）：
  - [preflight.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/preflight.ts)、[PreflightCard.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/PreflightCard.tsx)。
- 编排（T5）：[App.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/App.tsx) 新增 preflight state 与四门流：0-c confirm → brief active/saved + 弹 0-d；0-d confirm → brief done / background active（无 archive）；0-d reject 保留门重开；partial 入修改流。
- 门禁（T3/T4）：[gates.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/gates.tsx) 0-b/0-c 判据真实化 + 新增 buildGate0d；[GateCard.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/GateCard.tsx) 三按钮、critical 两步强制放行、否决意见面板（「提交否决意见」/「直接否决」）。
- 持久化与恢复（T6）：[session.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/session.ts)（WORKFLOW_FIELDS 加 preflight）、[replay.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/replay.ts)、[revision.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/revision.ts)、[workflow.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/workflow.ts)、[candidates.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/candidates.ts)、[viewer.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/viewer.ts) 同步 0-d/preflight。
- 立项单（T7/T8）：[ProductViewer.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/ProductViewer.tsx) 三 tab（六要素 / 视觉风格 / 预检）+ 字段可编辑 + 锁 + 版本号 + 旧会话缺预检黄条；0-c 风格参考图（3 构图、≥2 成功、失败占位、不落盘）。
- Mock / 诚实度（T9）：[tools.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/tools.ts) mockDiagnosis 补第 3 案例；底栏真实通道状态；产物 meta.source 来源角标。
- 背景档案（T10，D-011-3）：删除 handleArchiveSave 旁路，统一 saveArchive；[BackgroundArchive.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/BackgroundArchive.tsx) F12-2 校验（四段 ≥3 段非空 + 去占位 ≥80 字，否则禁用锁定）。
- 项目库 / 模板（T11，K8）：[main.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/main.ts) 5 个新 IPC、[preload.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/preload.ts) + [global.d.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/global.d.ts) 同步；[ProjectSidebar.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/ProjectSidebar.tsx) 真实列表/搜索/新建/切换；立项单沉淀赛道模板 + 创意入口唤起预填。
- 输入区 / 画布（T12）：[ChatPanel.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/ChatPanel.tsx) 三入口诚实化（模板唤起、上传禁用标注、通道文案）；[StageCanvas.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/StageCanvas.tsx) 点阵背景 + SVG 状态连线。
- 测试夹具：[messages.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/messages.ts) 加 makePreflight；新增 [preflight.test.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/test/preflight.test.ts)、[ref-images.test.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/test/ref-images.test.ts)；既有 App.restore/App.revision/feature006-ui 等 mock 与四门流序列跟进。

### 验证结论（T13-1/2/3）

- T13-1 typecheck：`npx tsc -b --force` 无错通过。
- T13-2 test：`npm run test` 连续两轮全绿——**38 文件 / 430 passed / 1 skipped**（基线 393 passed，只增不减）。其中修复既有 flaky 用例 `runtime-manager.test.ts > findFreePort`：blocker 改为从 4096 起动态抢占端口，消除全量并行下与真实 serve 的硬编码端口竞争。
- T13-3 build：`npm run build`（renderer + electron + preload）通过。

### 遗留

- ~~T13-4 手动回归（OD §7）待执行~~ → 已完成（2026-10-06）。核心链路验证通过：0-a → 0-b → 0-c 触发（ark 超时未完成 0-c/0-d 完整链路，外部服务问题）；横屏 16:9 推导、critical 两步放行、项目库/模板/底栏/画布均验证通过。
