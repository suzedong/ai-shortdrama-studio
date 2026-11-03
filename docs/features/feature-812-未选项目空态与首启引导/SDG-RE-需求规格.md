# feature-812 未选项目空态与首启引导 · 需求规格

> 任务包 ID：feature-812 ｜ 类型：变更 — 应用壳空项目态（**K1 / K8 / K9 全零**：零新增类型、IPC、依赖）
> 依赖：feature-004（`listProjects` / `openProject` / `createProject`）、feature-005（`CaptureBar` 已按 `projectId` 挂载）、feature-808（项目会话绑定）、feature-809（对话活跃指示）
> 用户拍板：2026-11-02 —— **A** 无项目时右栏保留但禁用输入（不整块替换）；**B** 首启**不**自动创建「我的第一支短剧」；**C** 底栏只做「无项目时隐藏」，真实化不做。

## 1. 背景与问题

> 本节为**建包前问题快照**；为便于回看，`StudioApp.tsx` 引用按现行源码中的对应符号重新定位。「链路 / 现状」描述的是修复前行为，不代表本包落地后的当前实现。

首启与「关闭全部项目」的默认态即**无项目态**：`readSessionState().currentDir` 为 `null` → `getActiveProjectDir()` 抛 `INVALID_ARGUMENT` → `canvas:get` 兜底返回空画布（`projectId: ''`，`main.ts` L790-805）。界面因此**不白屏**，但整块工作台仍按「有项目」的形态渲染，产生一条真 bug 与六处显示失真。

### 1.1 真 bug：无项目仍可发送，产生孤儿会话并烧 token

| # | 链路 | 证据 |
|---|---|---|
| 1 | `handleSend` 只校验 `selectedModel`，不校验 `projectId` | `StudioApp.tsx` `handleSend` L441-491（建包前快照） |
| 2 | `runtime.createSession()` 成功——建会话不需要项目 | 同上 `createSession` L467-469 |
| 3 | `activeSession(session.id)` 写态在主进程走 `getActiveProjectDir()` 抛 `INVALID_ARGUMENT`，被 `catch` 吞掉只打日志 | `StudioApp.tsx` `activeSession` L472-475 + `main.ts` L433 |
| 4 | `promptAsync` 照常发出，showrunner 启动 | `StudioApp.tsx` `promptAsync` L477-482 |
| 5 | Agent 随后调用的每个 MCP 工具都经 `getActiveProjectDir()`，全部抛错 | `mcp/tools.ts` L95 / L113 / L137 / L370 / L426 等 |

后果：**留下一条未绑定任何项目的 opencode 会话**（项目侧不可见，重开不复用），Agent 空跑一轮全失败工具，消耗一次真实 token 且对话区出现无法解释的报错。

### 1.2 显示失真（界面在给出错误结论）

| # | 位置 | 现状 | 问题 |
|---|---|---|---|
| D1 | 底栏状态条（`StudioApp.tsx` L1052-1084） | 火山方舟绿点、`10.203.3.52:8000 / :8001 / :8002`、镜头批量 12/18、「✓ Harness 校验 30 项」、「2 分钟前自动保存」**全为硬编码** | 无项目、未配 Key、无 ComfyUI 时照显"一切就绪"，是六处中最具误导性的一处 |
| D2 | 顶栏标题（`projectTitle` 定义 L636-637、渲染 L700-704） | `短剧 Agent · 未命名项目` | 无项目却称"未命名项目"，语义应为"未打开项目" |
| D3 | 顶栏 stage-track（`stageTrack` / `defaultCur` 聚合 L663-685、渲染 L705-745） | `defaultCur` 兜底 `'0'` → STAGE 0 恒为 cur 紫 pill + 脉冲白点 | 无产物却显示"正在立项" |
| D4 | 中栏空态（`CanvasBoard.tsx` L569-581） | 「还没有任何产物。在下方输入你的想法…」 | 把用户引向对话，而该路径在无项目时**必然失败**（1.1） |
| D5 | STAGE 0 空态（`Stage0View.tsx` L282-298） | 「立项尚未定案…在右侧对话中回答主控 Agent 的反问」 | 同上；且 `useCaptureFacts` 的 `loadError` 被 `EmptyStage0` 丢弃，失败静默 |
| D6 | 顶栏谱系徽章（按钮块 L749-760，硬编码值 L759） | 硬编码 `v1.46` | feature-811 已建 `style-catalog-store` 可读真实版本 |

### 1.3 已正确防护、本包不重复处理

`canvas:get` 兜底不白屏；`CaptureBar` 按 `projectId` 不渲染；`ProjectNav` 空库文案（L161-164）；`style:upgrade-diff` 无项目返回 `noBrief` 空态（`main.ts` L411-419）；`project:active-session` 读态返回 `{sessionId:null}`（L436-442）。

## 2. 目标

1. **无项目态成为明确的入口态**，而不是"残缺的工作台"：中栏直接给出「新建 / 打开」两条真实可走的路。
2. **堵死无项目发送**：UI 层禁用 + `handleSend` 前置守卫双保险，不产生孤儿会话、不拉起运行时、不烧 token。
3. **无项目时不展示任何状态结论**（C 拍板：底栏整体隐藏）。
4. 全部改动收敛在 renderer，**零新增 IPC / 类型 / 依赖**。

## 3. 范围

### 3.1 做

| 面 | 改动 |
|---|---|
| 中栏 | 新增 `WelcomeView`：标题区 + 主 CTA「新建项目」+ 「最近项目」列表（≤5，点击打开）；无项目时**优先于** `centerView` 渲染 |
| 顶栏 | 标题兜底改「未打开项目」；无项目时 stage-track 全 `idle` 且点击无效 |
| 右栏 | `ChatComposer` 新增可选 `lockedReason` / `lockedHint`：输入禁用、placeholder 说明、发送禁用、空态提示替换；**加载中与无项目同样锁定**（文案不同），发送钮**不得因草稿非空而变亮**；模型选择器与 AI 服务设置**保持可用**（首启配 Key 是必经步骤） |
| 底栏 | 无项目时整块不渲染 |
| 发送链 | `handleSend` 首行 `projectId` 守卫 |

### 3.2 不做（显式排除）

- **不**做底栏真实化（`app:config-status` / `settings:comfy:list` / `canvas.updatedAt` 接真实数据）——用户 C 拍板，另立包。
- **不**在首启自动创建项目（用户 B 拍板；避免堆积空项目）。
- **不**改 `ProjectNav` 既有创建/打开流程（仅导出 `relativeTime` 供复用）。
- **不**改 `Stage0View` / `CanvasBoard` 文案——无项目后二者不可达，其文案在有项目空画布时仍成立。
- **不**处理 D6 谱系徽章硬编码 `v1.46`——登记为偏差 B-67，另立包（属 feature-811 收尾遗漏，与本包无耦合）。
- **不**新增欢迎页的"引导式建项目"（题材选择、模板）——超出空态修复范围。

## 4. 验收标准

| # | 标准 | 验证 |
|---|---|---|
| AC1 | `canvas.projectId === ''` 时中栏渲染 `WelcomeView`（`data-view="welcome"`），不渲染 `CanvasBoard` / `Stage0View` | 组件测试 |
| AC2 | 点「新建项目」→ 调 `createProject(undefined)` → `openProject(dir)` 串联；失败时错误条原样上屏且 CTA 仍可点 | 组件测试 |
| AC3 | 最近项目列表按 `updatedAt` 降序取前 5；点击某项调 `openProject(dir)`；列表为空显示空库文案；`listProjects` 失败降级为错误条 + 仅新建可用 | 组件测试 |
| AC4 | 无项目时右栏输入框 `disabled`、placeholder 为锁定原因、发送按钮禁用；**模型选择器仍可选** | 组件测试 |
| AC5 | 无项目时底栏不渲染；`projectId` 变为非空后底栏恢复 | 组件测试 |
| AC6 | 无项目时 `handleSend` 直接返回错误提示，**不调用** `runtime.createSession` / `runtime.status` / `runtime.start` / `promptAsync` | 组件测试（断言 mock 零调用） |
| AC7 | 无项目时顶栏标题为「短剧 Agent · 未打开项目」，stage-track 八格全 idle，点击任一格不切 `centerView` | 组件测试 |
| AC8 | 有项目时全部既有行为零回归（空画布仍显示 `CanvasBoard` 空态、STAGE 0 照常可进） | 既有 `studio-flow.test.tsx` 等全量套件 |
| AC9 | `npm run typecheck` 恰 3 条历史基线零新增；全量 vitest 0 failed | 命令行 |
| AC10 | **加载中**（`canvas:get` 未回）与无项目同样锁定：输入框 `disabled`、发送钮 `disabled`，且向草稿写入内容后仍 `disabled`（不得出现"有内容即可点"的假可用） | 组件测试（`canvas.get` 返回 pending Promise） |

## 5. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 无项目时"最近项目"列表与左栏项目库重复 | 看起来冗余 | WelcomeView 只取前 5 且附「在左栏查看更多」提示，职责是"首屏可点"，不替代项目库 |
| 用户无项目却想先配 Key | 若整块禁用会卡死 | 契约 §4：模型选择器与「AI 服务设置」入口**不禁用** |
| `openProject` 后画布靠 `canvas:changed` 广播刷新，存在短暂空窗 | 点击后 ~100ms 内仍显示 WelcomeView | WelcomeView 的 `onOpen` 置 loading 态（按钮禁用 + 文案「打开中…」），广播到达即卸载 |
| 既有测试以 `projectId:'p1'` 构造画布 | 改动可能误伤 | 仅新增 `projectId:''` 变体用例，不动既有 helper 默认值 |
