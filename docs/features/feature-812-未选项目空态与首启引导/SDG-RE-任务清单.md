# feature-812 未选项目空态与首启引导 · 任务清单

> 前置：本规格 5 文件经用户批准（2026-11-02 A/B/C 三项口径已拍板）。
> 卡口：**K1 / K8 / K9 全零**——不动 `shared/types.ts`、不新增 IPC 与 MCP 工具、不新增依赖。

## 0. 上下文加载清单（工作围栏）

- 事实源：本包需求 / 契约 / 设计说明；`StudioApp.tsx` 的 `handleSend`（L441-491）与首拉订阅（L381-422）；`canvas:get` 兜底（`electron/main.ts` L790-805）；`getActiveProjectDir`（`electron/project/current.ts`）。
- 改动面白名单：
  - `src/studio/shell/WelcomeView.tsx`（**新建**）
  - `src/studio/shell/StudioApp.tsx`（判定 + 中栏分支 + 顶栏两处 + 底栏条件 + `handleSend` 守卫 + `lockedReason` 传值）
  - `src/studio/chat/ChatComposer.tsx`（仅 `lockedReason` 相关六点：`submit` L823-832 / `busy` L836 / 空态 L904-910 / textarea L1114-1127 / placeholder 与 disabled L1124-1125 / 发送钮 L1185-1197，禁用条件 L1190）
  - `src/studio/shell/ProjectNav.tsx`（仅 `relativeTime` 加 `export`，一行）
  - 测试：`src/studio/shell/welcome-view.test.tsx`（**新建**）、`src/studio/shell/studio-flow.test.tsx`（追加无项目组）
  - 文档：`docs/features/README.md`、`docs/设计现状与偏差清单.md`（B-66 已占用，本包登记 B-67/68）、`版本记录.md`
- 红线：`shared/types.ts`、`package.json`、`electron/**`、`src/dev-mock-api.ts`、`Stage0View.tsx`、`CanvasBoard.tsx`、`ProjectNav.tsx` 的其它逻辑。

## 1. 原子任务

### T1 · 新建 `WelcomeView.tsx`
- 三区结构（标题 / 主 CTA / 最近项目列表）+ 空库态 + 错误条 + 底部八步提示。
- 内部 `useEffect` 拉 `listProjects`，按 `updatedAt` 降序取前 5；`busy` 态覆盖两个入口。
- `relativeTime` 复用 `ProjectNav` 导出版本。
- 完成标准：组件可独立渲染，无 IPC 依赖亦可降级。

### T2 · StudioApp 判定与中栏分支
- 求值 `hasProject`；中栏三分支改为 `!hasProject ? Welcome : centerView==='stage0' ? Stage0 : Canvas`。
- 实现 `handleCreateProject`（`createProject(undefined)` → `openProject(dir)`）与 `handleOpenProject(dir)`，失败经既有 `error` 通道上屏。
- 依赖 T1。

### T3 · 顶栏与底栏
- `projectTitle` 兜底改 `'未打开项目'`。
- `stageTrack` 无项目全 `idle`；点击 handler 首行早退。
- 底栏 `{hasProject && <footer>…</footer>}`。
- 依赖 T2。

### T4 · `ChatComposer` 锁定态
- 新增 `lockedReason?: string | null`，落实契约 §4.2 的 L1–L6。
- 确保回车、点击、选项代发三条入口都受 L4 约束。
- 依赖 T2（传值侧）。

### T5 · `handleSend` 守卫
- 首行 `if (!canvas.projectId) { setError('请先新建或打开项目，再开始对话。'); return }`，deps 加 `canvas.projectId`。
- 完成标准：AC6 断言四个 runtime 桥零调用。

### T6 · 测试
- 新建 `welcome-view.test.tsx`：AC1–AC3（渲染 / 新建串联 / 列表排序取 5 / 空库 / 失败降级）。
- `studio-flow.test.tsx` 追加「无项目态」describe：AC4–AC7（右栏锁定、底栏隐藏、发送守卫、顶栏标题与 stage-track）。
- 既有用例零改动（`emptyCanvas()` 默认 `projectId:'p1'`）。

### T7 · 验证与文档闭环
- `npm run test:run` 全绿（基线 78 文件 973 passed）；`npm run typecheck` 恰 3 条历史基线。
- features/README 增 812 行；偏差清单登记 B-67（谱系徽章硬编码 v1.46，另立包）与 B-68（底栏状态条硬编码，另立包）；`版本记录.md` 追加条目。
- 真机目验：清空 `session-state.json` 的 `currentDir` 起应用，验证欢迎页 / 新建串联 / 右栏锁定 / 底栏隐藏四条。

## 2. 验收

对照需求规格 §4 AC1–AC9 逐项核验；AC1–AC7 由测试覆盖，AC8 由既有套件回归，AC9 由命令行确认。
