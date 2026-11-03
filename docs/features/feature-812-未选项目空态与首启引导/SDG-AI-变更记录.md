# feature-812 未选项目空态与首启引导 · 变更记录

> 三分类：决策记录（K 卡口触发，永久保留）/ 实施记录（落地后可清理）/ 修订记录（决策稳定后可清理）。

## 决策记录

### D-001 · 无项目空态的处置口径（K7 · 用户拍板）

**背景**：首启默认态即无项目态（`currentDir: null`）。盘点发现 1 条真 bug（无项目仍可发送 → 孤儿会话 + 全工具失败 + 烧 token）与 6 处显示失真。2026-11-02 呈报三个分歧点，用户逐项拍板。

**拍板结果**：

| # | 分歧点 | 用户裁决 | 落地语义 |
|---|---|---|---|
| A | 无项目时右栏如何处置 | **保留但禁用输入** | 不整块替换为引导卡；`ChatComposer` 新增 `lockedReason`，锁定输入与发送，**模型选择器与 AI 服务设置不禁用**（首启配 Key 是必经步骤） |
| B | 首启是否自动创建「我的第一支短剧」并直进 STAGE 0 | **不自动创建** | 必须由用户显式点「＋ 新建项目」；避免堆积空项目、避免用户不知情产生落盘 |
| C | 底栏状态条 | **只做无项目时隐藏** | 本次不做真实化（`app:config-status` / `settings:comfy:list` / `canvas.updatedAt` 接真数据），硬编码项在有项目时原样保留 |

**卡口判定**：K1 零触发（判定式 `canvas.projectId !== ''` 只用既有字段）；K8 零触发（`listProjects` / `openProject` / `createProject` 三桥均已存在）；K9 零触发。属纯 renderer 修复，可直接实施。

**未纳入本包的发现**（登记偏差，另立包）：

- 顶栏谱系徽章硬编码 `v1.46`（`StudioApp.tsx` 谱系按钮块 L749-760，硬编码值 L759），与 feature-811 已退役 `STYLE_CATALOG_VERSION` 的收尾不一致 → **B-67**。
- 底栏状态条硬编码（地址 / 进度 / Harness 计数 / 自动保存时间）→ **B-68**。注意：C 拍板只解决"无项目时不误导"，有项目时仍为假数据。

## 实施记录

### T1–T7 · 2026-11-02 单批落地

- **T1 `WelcomeView`（新）**：标题区 / 主 CTA / 最近 5 项（`updatedAt` 降序）/ 空库 / 错误条 / 八步提示；`busy` 区分 `create` 与 `open` 并锁全列表；`relativeTime` 复用 `ProjectNav` 导出版本（仅加 `export`，零逻辑改动）。
- **T2 `StudioApp` 判定与中栏**：新增 `canvasLoaded` + `hasProject = canvasLoaded && canvas.projectId !== ''`；中栏三分支（loading / welcome / 原两态）；`handleCreateProject`（`createProject(undefined)` → `openProject(dir)`）与 `handleOpenProject` 异常向上抛，由 WelcomeView 就地显示，不升级为全局 error。
- **T3 顶栏与底栏**：`projectTitle` 兜底「未打开项目」；`stageTrack` 无项目全 `idle` + 点击早退；底栏 `{hasProject && <footer>…}`。
- **T4 `ChatComposer`**：新增 `lockedReason`，落实 L1–L6——textarea `disabled`、placeholder 取锁定原因、发送钮禁用、`submit` 首行早退、空态文案替换、模型选择器不禁用。
- **T5 发送守卫**：`handleSend` 首行 `if (!hasProject) { setError(...); return }`，`useCallback` deps 改为 `[hasProject, ensureSubscribedOnce, selectedModel]`。
- **T6 测试**：新增 [welcome-view.test.tsx](../../../src/studio/shell/welcome-view.test.tsx) 5 例；[studio-flow.test.tsx](../../../src/studio/shell/studio-flow.test.tsx) 追加「feature-812 · 无项目态」4 例（welcome 渲染 / 右栏锁定 + 四桥零调用 / Stage 0 不切换 / 新建串联）。
- **T7 验证**：全量 **79 文件 982 passed / 0 failed / 1 skipped**（基线 78/973 → +1 文件 / +9 例，skip 不变）；`npx tsc --noEmit` 恰 3 条历史基线零新增；`electron/**`、`shared/types.ts`、`package.json` 零 diff；IPC 44 / MCP 29 不变。**X-005 修复后复跑：79 文件 983 passed / 0 failed / 1 skipped**（新增 AC10 一例）。

## 修订记录

### X-001 · 契约追补 `canvasLoaded`（实施中发现，L1 自决留痕）

契约 §1.1 原判定式只有 `canvas.projectId !== ''`。实施后既有用例暴露两个问题：

1. 首帧模块级 `emptyCanvas` 的 `projectId` 为空，会先闪一次 WelcomeView 再跳回画布；
2. `studio-flow.test.tsx` 的「发送指定 showrunner」「新建项目串联」两条既有用例在**首帧同步查询**，分别因 placeholder 被锁定、页面同时出现两个「新建项目」按钮而失败。

处置：引入 `canvasLoaded`（首拉 `.then` / `.catch` 均置 `true`），`hasProject` 收敛为 `canvasLoaded && projectId !== ''`；中栏据此三分支。**当轮将对话锁定条件写作 `canvasLoaded && !hasProject`（加载中不锁），该取舍已被 X-005 推翻**——加载中放开对话会复现本包要堵的假可用。属对既有断言的兼容性补强，**不改变 A/B/C 口径**。

### X-002 · AC6 的验证方式（可测性偏差）

`handleSend` 守卫是 UI 之下的第二道闸：无项目时输入框已 `disabled`，测试无法从 UI 触达。AC6 以两条等价证据覆盖：① `submit` 在 `lockedReason` 下早退（`fireEvent.keyDown` 绕过 disabled，验证 L4）；② 断言 `runtime.status / start / createSession / promptAsync` 四桥零调用。守卫本身由代码审查兜底，登记为可测性偏差而非未覆盖。

### X-003 · 全量回归耗时（环境，非缺陷）

本机 `vitest run` 全量 36 分 50 秒，其中 environment 1308s、setup 446s，而 tests 仅 33.78s——耗时集中在 jsdom 环境初始化。与本包改动无关，后续回归建议按目录分批或提高并发。

### X-004 · dev-mock 未覆盖无项目态

`dev-mock-api.ts` 的 `projectId` 固定 `'anni'`，浏览器预览始终走"有项目"分支，无法用 `npm run dev:renderer` 目验欢迎页。按契约 §7 未改 mock（避免影响既有演示流程）；无项目态由组件测试覆盖，**真机目验需清空 `session-state.json` 的 `currentDir` 后执行**，待用户桌面端确认。

### X-005 · 加载中放开对话 = 假可用（用户目验发现，L3 缺陷修复）

**现象**（2026-11-02 用户目验）：未选任何项目时，右栏输入框可输入；草稿为空时发送钮禁用，**一旦输入内容发送钮即变亮**，形似可发。

**根因**：X-001 的取舍。`lockedReason` 只在 `canvasLoaded && !hasProject` 时非空，而首拉未回时 `canvasLoaded === false` → `lockedReason === null` → L1/L2/L3/L4 全不生效，输入框与发送钮退回"只看草稿是否为空"的旧判定。此时点发送虽被 §6 守卫拦下并报错（不烧 token、不建会话），但**界面已经作出"可发"的错误承诺**，与本包 AC4/AC6 的意图相悖。

**证据**：先补一条 `canvas.get` 返回 pending Promise 的用例，断言"写入草稿后发送钮仍禁用"——修复前失败（按钮 not disabled），修复后通过。

**处置**：

1. 锁定条件收敛为单一来源 `composerLock`：`!canvasLoaded` → `'正在载入项目…'`；`hasProject` → `null`；否则 `'先新建或打开项目再开始对话'`。加载中与无项目**同锁**，只有文案不同（契约 §1.1 / §4.1）。
2. 新增可选 `lockedHint`：加载中空态显示「正在读取上次打开的项目，请稍候…」，无项目仍用原文案（契约 L5）。
3. L3 明确为"锁定时恒禁用，与草稿是否为空无关"（契约 §4.2）。
4. 既有用例 `studio-flow.test.tsx`「发送指定 showrunner」首帧同步取 placeholder，加载中被锁后取不到 → 改为 `findByPlaceholderText`（等待首拉），属断言方式修正而非放宽。

**影响面**：`StudioApp` 新增 2 个派生常量 + 2 个 prop 传值；`ChatComposer` 新增 `lockedHint` 与空态分支；不新增 IPC / 类型 / 依赖，K1/K8/K9 仍全零。

### X-006 · `npm start` 读到的是旧构建（环境陷阱，非缺陷）

`electron/main.ts` L90 在无 `VITE_DEV_SERVER_URL` 时加载 `dist/index.html`。本仓 `dist/` 为 **2026-10-07** 产物，若以 `npm start` 目验，看到的仍是 feature-812 之前的界面（输入区完全可用、无欢迎页），与本包改动无关。当日已 `npx vite build` 重建 `dist/`；后续目验请用 `npm run dev`（HMR 直出源码），或先 `npm run build`。

