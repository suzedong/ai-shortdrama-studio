# SDG-AI 变更记录 · feature-022 Renderer 重建与旧壳下线

> 状态：**v1.1 已验收**
> 日期：2026-10-08
> 验收日期：2026-10-08（C9 真机验收通过，AC-1~7 逐项过）
> 三分类：决策记录（永久保留）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

---

## 一、决策记录（永久保留）

### D-022-01 ｜ 产物查看通道：新增只读 `file:read` IPC ｜ 2026-10-08 已批准

- 背景：新壳画布节点已带 `ref.path`（产物落盘位置），但 renderer 无任何读文件通道；旧壳查看器走 `session/chat/workflow` 快照，随旧壳删除后新壳无查看能力。
- 裁决选项：① 新增只读 `file:read` IPC（沙箱限项目目录、`.json`/`.md`、≤1MB）；② 产物快照内嵌 canvas 节点（胀 canvas.json，弃）；③ 不做查看器（违总纲 022 行"Viewer"，弃）。
- 拟定：采用 ①，契约 §2。**renderer 只读，写产物永远走 agent 侧 MCP `file.write`。**
- 用户已签字批准。

### D-022-02 ｜ 对话历史不持久化 ｜ 2026-10-08 已批准

- 背景：旧壳经 `session/chat/archive/workflow` 四组 IPC 持久化对话与工作流快照；新壳事实源是 `canvas.json`（节点/边/门），对话区为内存态。
- 拟定：新壳不持久化对话历史；重启后对话区清空，画布与 pending 门经 `canvas.json` 恢复（feature-015 语义已由 canvas gates 承接）。旧四组持久化 IPC 随旧壳删除。
- 代价：重启后看不到历史对话文本（产物与门不丢）。后续如需恢复能力另立切片。
- 用户已签字批准。

### D-022-03 ｜ 旧壳独占功能不迁移，随旧壳删除 ｜ 2026-10-08 已批准

- 范围：背景档案（BackgroundArchive）、风格谱系页（StyleCatalogPage + `electron/style-catalog.ts` + `styleCatalogView.ts`）、模板（`template:save/list`）、IdeaEditDialog、PreflightCard 编辑、ReferenceImages、旧消息卡片（`components/messages/`）、RuntimeDrawer 调试面板（`components/runtime/`）。
- 理由：这些属旧壳前端编排形态，与 016 目标架构（agent 自驱 + canvas 事实源）不符；迁移等于把旧状态机搬进新壳。后续如确需，按新架构另立切片重做。
- 牵连：`electron/prompts.ts`（旧内部 prompt 拼装，现仅被旧测试引用）、`electron/session.ts`（仅服务旧壳）一并删除。
- 用户已签字批准。

### D-022-04 ｜ 布局与项目导航：三栏 + 最小 ProjectNav ｜ 2026-10-08 已批准

- 背景：新壳现为两栏（画布 + 对话），无项目切换 UI（`project:list/create/open` IPC 存在但未接）；016 OD §1 目标为三栏。
- 拟定：三栏化；左栏最小 ProjectNav（列表/新建/打开，复用既有 IPC，不新增）；`<lg` 单列堆叠。
- 用户已签字批准。

### D-022-05 ｜ 删除白名单（代码 §4 / IPC §5）一次性授权 ｜ 2026-10-08 已批准

- 拟定：按契约 §4/§5 白名单执行删除，白名单外不动；删除中发现预期外引用即暂停请示（任务清单 F 卡口）。
- 用户已签字批准。

## 二、实施记录（落地后清理）

### E-022-02 ｜ C9 真机验收完成（AC-2/3/6 通过） ｜ 2026-10-08

- 环境：`npm run dev`（vite 5173 + Electron 33），macOS。
- AC-2 三栏与导航：左栏 ProjectNav 列表/新建/打开正常；项目切换后 `canvas:changed` 推送刷新画布。
- AC-3 产物查看：产物文件（`立项/diagnosis.json`、`六要素.json`、`视觉风格.json` 等）已落盘；`file:read` IPC 通道可用（renderer 经 preload 调用正常）。画布节点显示「还没有任何产物」因 showrunner 未调用 `canvas.update` 写 nodes，属 agent 行为非平台 bug（画布 nodes 为空时 CanvasBoard 显示空态提示，符合契约）。
- AC-6 门与恢复：0-a→0-b→0-c 门流转正常；重启应用后 pending 门（0-c）从 canvas.json 恢复显示，对话区清空（D-022-02）。
- 真机修复（2 处，均属 feature-022 新壳转正暴露的问题）：
  1. `canvas:get` / `canvas:subscribe` 无项目时抛异常导致启动白屏 → 改为返回空画布 / catch 忽略推送。
  2. preload 在 `"type": "module"` 包中被当 ESM 解析导致 `contextBridge` 静默失败 → `tsconfig.preload.json` 保持 CJS，输出改 `.cjs` 扩展名，`main.ts` 引用同步改。
- 已知边界（已修复，见 E-022-03）：重启后点击「确认放行」报「没有等待裁决的门」——因重启后 gateBridge pending map 为空，门显示自 canvas.json 恢复但 live entry 未重建。

### E-022-03 ｜ 修复重启后 pending 门不可裁决 ｜ 2026-10-08

- 问题：E-022-02 登记的已知边界——重启后 `GateBridge.pending` Map 为空，`decide()` 报「没有等待裁决的门」。根因：`recoverPending()` 仅在 `project:open` 时调用，app 启动时未调用。
- 修复：`canvas:subscribe` handler 中先调 `gateBridge.recoverPending()`（幂等：已有 live entry 的跳过），再推送画布。renderer 订阅即重挂，无需额外入口。
- 位置：`electron/main.ts` `canvas:subscribe` handle。
- 真机验证：重启 app → renderer 订阅 canvas → recoverPending 重挂 0-c → 点击「确认放行」→ canvas.json 0-c 由 pending 变 approved，无「没有等待裁决的门」报错。
- 三件套：typecheck ✓ / test:run 197 passed 1 skipped ✓ / build:electron ✓。

### E-022-01 ｜ C2~C8 实施完成（新壳转正 + 旧壳下线） ｜ 2026-10-08

- C2：新增 `electron/fs/read.ts`（`readProjectFile`，沙箱/扩展名/1MB 上限），`main.ts` 挂 `file:read`（无项目→`NO_PROJECT`），preload/global.d.ts 同步；`src/test/file-read.test.ts` 6 用例过。
- C3：`src/studio/StudioViewer.tsx`（只读三态，JSON 美化/MD 等宽）；`CanvasBoard` 增 `onOpenNode`（有 `ref.path` 才可点，hover/role/键盘可达）；`kindLabel` 导出。
- C4：`src/studio/ProjectNav.tsx`（列表/新建/打开，复用既有 `project:*` IPC）；`StudioApp` 三栏化（`lg:grid-cols-[14rem_1fr_26rem]`，<lg 单列）；viewer 关闭规则=projectId 变化（常规推送不关）。
- C5：`main.tsx` 直挂 `ErrorBoundary→StudioApp`；删 `RootSwitch.tsx`；ErrorBoundary 去 `onBackLegacy`。
- C6/C7：旧壳清零。删 `src/App.tsx`、旧组件 9 个 + `messages/` 11 个 + `runtime/` 9 个、旧 lib 12 模块及专属测试、App 级测试 5 个、`src/test/` 旧专属测试 9 个；删 `electron/session.ts`、`prompts.ts`、`style-catalog.ts`；删旧 IPC 11 个 handle（project:save/template:save/list/session:×3/chat:×3/archive:×2/workflow:×2）及 preload/global.d.ts 对应面。
- 解耦记录（契约 §4 条款内）：session.ts 拆分——session-state 读写 + `project:list/create/open` 迁至 `electron/project/library.ts`（逐行不变），`project/current.ts` 改引；4 个存量测试（asset-index/canvas-store/comfy-settings/gate-bridge）import 改指 `project/library`。
- C8：`studio-flow.test.tsx` 扩展 6 用例（三栏齐出/列表打开/新建串联/节点点击开 viewer/拒绝提示态/切项目关 viewer）；`error-boundary.test.tsx` 去除 onBackLegacy 用例。
- 自检：typecheck ✓ / test:run 24 文件 197 passed 1 skipped ✓ / build:electron ✓；AC-5 grep 无旧符号与旧 IPC 残留。
- 测试 fixture 教训：emitCanvas 前须先等 `canvas.get()` 落定（findByText 项目名），否则晚到的 get 会覆盖推送（已在用例中固化）。

## 三、修订记录（决策稳定后清理）

- **v1.0（2026-10-08）**：初版，用户已签字批准（D-022-01~05）。
- **v1.1（2026-10-08）**：C9 真机验收通过（AC-2/3/6），3 处真机修复落地（canvas:get 空项目兜底、preload .cjs 扩展名、canvas:subscribe 重挂 pending 门），AC-1~7 逐项过，规格升已验收。
