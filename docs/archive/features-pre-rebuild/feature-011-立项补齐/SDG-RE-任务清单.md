# SDG-RE 任务清单 · feature-011 立项补齐

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 前置：feature-001/005/006/010 已闭环；`PreflightCheck` / `ProjectBrief.preflight` 类型已在 shared 中存在（仅启用）。本 Feature **不新增 npm 依赖**。
> 卡口状态：触发 **K1**（shared 三处加性变更）、**K3**（handleArchiveSave 旁路删除）、**K6**（新增 `src/lib/preflight.ts`、`src/components/PreflightCard.tsx` 等模块）、**K8**（gate partial、4 个新 IPC、preload/global.d.ts）。用户对本任务包签字即视为授权；实施时在变更记录逐条追加永久决策。不触发 K9（零新依赖）。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`、`docs/governance/AI-SDG-AI工具执行指令.md`
- [x] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`、`SDG-OD-设计说明.md`
- [x] `shared/types.ts`（K1：仅契约 §1 三处）
- [x] `短剧Agent平台设计.md` §2.6（L116–255）
- [x] `docs/research/MiniMax Design功能与架构参考.md`（画布连线/对齐、Skill 沉淀）
- [x] `src/App.tsx`（handleSend 产物分支、handleConfirm/handleReject/handleArchiveSave、底栏、状态声明）
- [x] `src/lib/gates.tsx`、`src/lib/gates` 相关测试
- [x] `src/lib/messages.ts`（makeBrief/makeGateAction/新增 makePreflight）
- [x] `src/lib/revision.ts`、`src/lib/replay.ts`、`src/lib/workflow.ts`、`src/lib/candidates.ts`
- [x] `src/lib/viewer.ts`（DTO、extra、版本/预检透出）
- [x] `src/lib/deriveFiveElements.ts`（画幅口径）
- [x] `src/components/GateCard.tsx`、`ProductViewer.tsx`、`StageCanvas.tsx`、`ChatPanel.tsx`
- [x] `src/components/ProjectSidebar.tsx`、`BackgroundArchive.tsx`、`IdeaEditDialog.tsx`
- [x] `electron/session.ts`（WORKFLOW_FIELDS、readFinalized、归档）
- [x] `electron/mcp/tools.ts`（mockDiagnosis、envelope meta.source）
- [x] `electron/main.ts`、`electron/preload.ts`、`src/global.d.ts`（IPC 新增点）
- [x] 既有测试：gates-script/gates-story/viewer/workflow/replay/candidates/revision/superseded/deriveFiveElements/messages/chat-runtime
- [x] `tailwind.config.js`、`package.json`（零依赖确认）

> 禁止读取与修改清单以外文件，除非实施中明确需要（如测试夹具）。

## 1. 签字前置

- [x] P1 用户对需求规格 v1.0 / 契约 v1.0 / OD v1.0 / 任务清单 v1.0 逐项签字（NotifyUser 审批）
- [x] P2 用户确认 K1 / K3 / K6 / K8 卡口授权（本文件头部已列明，签字即确认）
- [x] P3 K3 删除项（handleArchiveSave 旁路）随包确认，不另设二次签字（影响面仅 App 内单函数，已在契约 §4/§12 固化）

## 2. 原子任务

### T1 · K1 共享层三处加性变更

- [x] T1-1 `GateId` 加 `'0-d'`；`RevisionSource` 加 `'0-d'`；`GateCard.harness` 项加 `critical?: boolean`
- [x] T1-2 不动其他任何字段；变更记录登记 K1 决策 D-011-1

### T2 · Preflight 纯函数（K6）

- [x] T2-1 新建 `src/lib/preflight.ts`：常量（id3/id5 文案）、`buildInitialPreflight`、`evaluatePreflight`（complete/aspectAligned/dualRecipe，判据按契约 §3）
- [x] T2-2 新建 `src/test/preflight.test.ts`：6 项构造、缺项/画幅不一致/双档缺失三类 ✗、token 提取不到 = false

### T3 · gates 真实化（P0-7 / P1-4 actions）

- [x] T3-1 buildGate0b 改 `(fe, d?)`，三项真实判据（六要素 critical）
- [x] T3-2 buildGate0c：形态匹配改真实 4 选 1（critical）；actions 加 partial
- [x] T3-3 新增 buildGate0d（契约 §2.3）
- [x] T3-4 buildGate1a/1b 消除硬编码（契约 §2.4，入参增 background / outline）
- [x] T3-5 更新/新增 gates 测试：0b 缺 d ✗、0c 形态外 ✗、0d 三规则、1a/1b 数据不可得 ✗

### T4 · GateCard 交互（P0-8 / P1-4 / P2-18）

- [x] T4-1 Props 加 onPartial / onRejectFeedback；按 gate.actions 渲染三按钮
- [x] T4-2 critical 两步强制放行（forceArmed、红字、gate.id key 复位）
- [x] T4-3 否决四要素内联反馈区（可跳过）
- [x] T4-4 组件测试：critical 首次拦截/二次放行、非 critical 一次放行、partial 回调、否决反馈拼接

### T5 · 0-d 编排接入 App（P0-1 / P1-12）

- [x] T5-1 新增 state `preflight`；消息工厂 `makePreflight`
- [x] T5-2 0-c confirm 改造：不置 brief done → 初始预检 → makePreflight + buildGate0d（契约 §4.1）
- [x] T5-3 handleConfirm 新增 0-d 分支（saveProject 含 preflight → brief done / background active；链上 applyUnlock('0-d')）
- [x] T5-4 0-d reject（重开保留编辑值）/ partial（记录 + 修改流）
- [x] T5-5 buildGate0b 调用点传入 diagnosis；buildGate1a/1b 调用点传入 background/outline
- [x] T5-6 版本逻辑 `nextBriefVersion`（契约 §8）+ 归档接入

### T6 · 持久化与恢复（K1 联动 / session）

- [x] T6-1 session.ts WORKFLOW_FIELDS 加 `preflight`；save/load 平铺
- [x] T6-2 readFinalized 携带 preflight（缺失 undefined，不排除旧 brief）
- [x] T6-3 revision.ts DOWNSTREAM/NODE_REVISION/STAGE_GATE/STAGE_PRODUCT_KINDS 加 0-d
- [x] T6-4 replay.ts SOURCES / pendingGate / preflight 恢复
- [x] T6-5 workflow.ts WorkflowState 加 preflight；candidates.ts KIND_SOURCE 加 preflight
- [x] T6-6 viewer.ts DTO/extra 透出 preflight 与 version；更新对应测试（viewer/workflow/replay/candidates/revision）

### T7 · 立项单三 tab + 编辑 + 锁（P1-2 / P2 提示）

- [x] T7-1 ProductViewer brief 改三 tab；六要素/视觉风格 tab 字段编辑 + 锁；预检 tab 复用 PreflightCard
- [x] T7-2 新增 `src/components/PreflightCard.tsx`（6 行编辑 + 锁、viewOnly）
- [x] T7-3 编辑回调上送 App：更新 fiveElements/feOverride/visualStyle/preflight 并落盘
- [x] T7-4 锁初始态按门状态；手动解锁走既有 unlock 链路
- [x] T7-5 旧会话预检缺失黄条 + 「去补录 0-d」（P1-15）；viewer 显示版本号

### T8 · 参考图（P1-3）

- [x] T8-1 0-c details 与视觉风格 tab 渲染 2–3 张参考图（契约 §6 URL/prompt/size）
- [x] T8-2 失败占位；不阻断、不落盘

### T9 · Mock 与诚实度（P0-9 / P2-5 / P2-10）

- [x] T9-1 mockDiagnosis 补第 3 案例
- [x] T9-2 底栏真实通道状态（ark 已配置/未连接/Mock；媒体待接入）
- [x] T9-3 产物来源角标（meta.source：Mock 演示 / Agent · 火山方舟）

### T10 · 背景档案（P2-13 / P2-14）

- [x] T10-1 删除 handleArchiveSave 旁路（K3），统一保存路径
- [x] T10-2 BackgroundArchive 最小校验：≥3 段有效、总字数 ≥80；不满足禁用 + 缺段提示

### T11 · 项目库与模板（P2-16 / P2-6）

- [x] T11-1 main.ts 新增 project:list / project:create、template:save / template:list（契约 §7）
- [x] T11-2 preload + global.d.ts 同步
- [x] T11-3 ProjectSidebar 真实列表 / 搜索 input / 新建 / 切换 / 空态
- [x] T11-4 立项单「沉淀为赛道立项模板」+ 创意入口唤起模板预填

### T12 · 输入区与画布（P2-17 / P2-19）

- [x] T12-1 ChatPanel 输入区三入口：Skill 接模板选择、上传移除/禁用标注、通道文案诚实
- [x] T12-2 StageCanvas 点阵背景 + SVG 状态连线；保持缩放/行布局

### T13 · 回归与自检

- [x] T13-1 `npm run typecheck`（tsc 无错）
- [x] T13-2 `npm run test`（全部既有测试 + 新增测试，只增不减）
- [x] T13-3 `npm run build` 通过
- [x] T13-4 手动回归脚本（OD §验收）：新项目完整四门 + 旧项目（无 preflight）打开 + mock 无 Key 走查

## 3. AC 自检表

| AC | 自检方式 | 任务 |
| :-- | :-- | :-- |
| AC-1 | 手动：0-c 后 brief 非 done，0-d 后 done | T5/T13 |
| AC-2 | preflight 单测 + 手动编辑/锁定 | T2/T7 |
| AC-3 | 检查 brief.json/manifest + 重启 | T6/T13 |
| AC-4 | GateCard 测试 | T4 |
| AC-5 | gates 测试（缺数据 ✗） | T3 |
| AC-6 | mock 走查 + 底栏断言 | T9 |
| AC-7 | 横屏用例：brief/预检画幅 | T5/T9 |
| AC-8 | ProductViewer 三 tab 手动 | T7 |
| AC-9 | 0-c 参考图（含断网占位） | T8 |
| AC-10 | partial 手动：不定稿、进入修改 | T4/T5 |
| AC-11 | 重拍板版本断言 + 归档文件 | T5/T6 |
| AC-12 | 旧会话打开黄条不阻断 | T7/T13 |
| AC-13 | 空模板禁锁；仅一条推进路径 | T10 |
| AC-14 | 项目库真实列表/搜索/新建 | T11 |
| AC-15 | 输入区无假可点击 | T12 |
| AC-16 | 沉淀 → 唤起预填闭环 | T11 |
| AC-17 | 否决四要素可见 | T4 |
| AC-18 | 画布点阵 + SVG 连线 | T12 |
| AC-19 | typecheck/test/build | T13 |
