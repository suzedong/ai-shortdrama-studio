# SDG-AI-变更记录 · feature-002-对话消息动态化

> 三分类管理：决策记录（永久）/ 实施记录（落地清理）/ 修订记录（闭环清理）。

## 一、决策记录（永久保留）

---

> #D-005 · 2026-10-03 · 卡口 K1 · 用户已确认
>
> **扩展共享层 `shared/types.ts`**：
>
> - `ChatMessage` 新增 `kind: MessageKind`（必填）、`status?: MessageStatus`、`data?: unknown`；role 增加 `'system'`
> - 新增类型：`MessageKind`、`MessageStatus`、`ProjectSession`、`SessionStateFile`
>
> 理由：消息流需承载简报/诊断/进度/错误/确认动作等结构化内容；会话需要独立类型。规格 v1.0 审批生效。

---

> #D-006 · 2026-10-03 · 卡口 K8 · 用户已确认
>
> **变更 `project:save` 契约并新增会话/消息 IPC**：
>
> - `project:save` 由"新建 `project-{ts}` 目录"改为"更新当前会话目录"，无会话时以 `NO_SESSION` reject
> - 新增 `session:start`、`session:current`、`chat:append`、`chat:load`
>
> 理由：修正 feature-001 重复确认产生多个项目目录的问题；支撑消息实时落盘与会话恢复。该通道仅 App 调用，同步更新无外部影响。

---

> #D-007 · 2026-10-03 · 卡口 K9 · 用户已确认
>
> **新增测试相关 dev 依赖**：`vitest@^3.2`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`jsdom`；新增 `npm test` / `npm run test:run` 脚本。
>
> 版本说明：vitest 固定 3.x——安装时实测 vitest 5.0.3 的 peer 要求 vite ≥6，与本项目 vite 5 冲突（ERESOLVE），3.2.7 兼容 vite 5。
>
> 理由：AGENTS.md 安全纪律第 6 条要求同步单元测试；本平台测试框架首次落地，后续 Feature 沿用。

---

> #D-008 · 2026-10-03 · 卡口 K8 · 用户已确认（v1.1）
>
> **新增通道并给两个 Agent 通道增加可选入参**：
>
> - 新增 `archive:save(text)`：把背景档案全文写入当前会话 `故事背景档案.md`（修复事实丢失）。
> - `agent:diagnose` 增可选 `instruction`；`agent:visual-style` 增可选 `instruction`：非空时在 prompt 追加「用户修改要求」（支撑否决后按意见重做）。
>
> 均为向后兼容的增量：不改既有返回、不改其他通道签名；无会话时复用 `NO_SESSION` reject。规格 v1.1 审批生效。

## 二、实施记录

> #I-001 · 2026-10-03 · 纯实施
>
> **`chat:append` 语义由 append 精化为 upsert**：进度消息需要原地 pending→done 更新，纯追加会在文件中留下过期记录。实现改为按 id 查找替换、无则追加；契约 §2.1、§4.1 已反向同步。
>
> 落地后可清理：本条内容去向 = [契约 §2.1 chat:append 行] + [electron/session.ts appendMessage]。

> #I-002 · 2026-10-03 · 纯实施
>
> **测试环境兼容补充**：jsdom 缺 `scrollIntoView` 与 `ResizeObserver`，在 [src/test/setup.ts](../../../src/test/setup.ts) 提供 mock；无业务语义影响。

> #I-003 · 2026-10-03 · 纯实施
>
> **模块抽取**：`deriveFiveElements` 从 App.tsx 移至 src/lib/deriveFiveElements.ts（逻辑零变更）；门卡片构造移至 src/lib/gates.tsx；App 启动恢复期间显示「正在加载会话…」占位。

> #I-004 · 2026-10-03 · 纯实施
>
> **修复 preload 模块格式缺陷（运行时证据确认）**：项目根 package.json 为 `type: module`，tsconfig.node 输出 ESM，导致 preload.js 含 `import` 语法；Electron preload 始终经 CommonJS 沙箱加载器（sandbox_bundle）执行，报 `SyntaxError: Cannot use import statement outside a module`，preload 整体未执行 → `window.api` 缺失 → 对话无 IPC 后续。
> 修复：新增 [tsconfig.preload.json](../../../tsconfig.preload.json)（module=CommonJS，仅编译 electron/preload.ts），构建顺序 tsc node → tsc preload，用 CJS 产物覆盖 dist-electron/electron/preload.js；主进程保持 ESM。dev / build:electron 脚本已追加第二步。
> 长期约定：**preload 必须 CJS，主进程可 ESM，双 tsconfig 分别编译**。

## 三、修订记录

> #R-001 · 2026-10-03 · v1.0 交付缺陷反向修复（已闭环）
>
> 经静态核查 + 用户确认，v1.0 存在三个缺陷：A 否决无重做路径（FR-3 L1）、B 档案事实丢失（违背架构 §2.6）、C 落盘并发覆盖。
>
> 已先反向同步文档（需求/契约/任务清单升 v1.1，新增 K8 决策 D-008），再改代码：单写队列、redoGate 路由、archive:save；新增 7 个测试（34 全过），vite + electron 构建通过。
