> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# feature-825 · 坏画布打开事务修复 — 需求规格

> 版本：v1.0（2026-11-18 冻结）｜溯源：[自研新增·缺陷修复]
> 上游：[feature-824 AC-F10](../feature-824-项目库真机补验/SDG-RE-需求规格.md)、[F824-01 机器证据](../../verification/p1-2026-11-15/p1-after-824-electron.json)、B-71。
> 授权：用户 2026-11-18 明确指令「好的，开始修复 F824-01 缺陷」。

## 1. 问题与根因

项目 A 已打开时，目标项目 G 的 `canvas.json` 损坏，`project:open` 先把 G 写入 `.session.json` 与 `session-state.json.currentDir`，随后才读取画布。由此可能出现主进程已指向 G、Renderer 仍展示 A 的状态分裂。

当前源码红测已复现：IPC 以 `CANVAS_CORRUPT` reject，但异常来自 `clearLive/reset` 后的 `gateBridge.recoverPending()`，此时 currentDir 已切到 G；后置画布读取另有可能吞错的 `catch` 分支。因此本包不能只调整错误显示，必须把校验移到所有提交和门副作用之前。

## 2. 目标

将目标画布读取/结构校验变为项目切换提交前的只读守卫：预检失败时，目标项目的 session/currentDir 写入、门清理与恢复、缓存 reset、标题同步和画布广播均未开始，原项目继续保持完整一致。

## 3. 验收标准

### AC-825-1 · 坏画布失败且原项目不变

A 已打开，G 为合法 `project-*` 目录且 manifest 可访问，但 canvas 为坏 JSON、结构损坏或 `projectId` 失配：

- `project:open` reject，保留 `CANVAS_CORRUPT` / `CANVAS_PROJECT_MISMATCH` 及可读错误原文，不返回假成功。
- `session-state.json.currentDir` 仍为 A；`canvas.get()` 仍返回 A 的 `projectId`。
- A 与 G 的 `.session.json` 在尝试打开 G 前后逐字节不变；G 不补建 session。
- A/G 的 canvas 原文不被改写；坏 G 不会被空画布覆盖。

### AC-825-2 · 失败前无副作用、无目标广播

预检失败时不得调用 `gateBridge.clearLive()`、`gateBridge.recoverPending()`、`canvasStore.reset()` 或标题同步写入；不得发送 G 的 `canvas:changed`。原项目门内存索引与画布缓存保持可用。

### AC-825-3 · 正常打开行为不回归

正常项目 B 打开仍返回 `{ ok:true, activeSessionId }`，保留会话绑定、刷新 B 的 `lastOpenedAt`，按既有顺序清门 → reset → recover，并同步 `.session.json.title` 到 canvas 后广播 B。缺失 canvas 的正常项目仍按既有行为在正式加载时创建，只读预检本身不得创建文件或填充缓存。

### AC-825-4 · 既有校验优先级不回归

工作区外/非 `project-*` 路径仍报 `INVALID_PROJECT_DIR`；manifest 缺失仍报 `PROJECT_NOT_FOUND`。画布预检不得绕过路径硬边界，也不得抢在 manifest 校验前改变错误优先级。

### AC-825-5 · 真实 Electron 闭环

在全新隔离工作区完成 A → 坏 G 的冷启动/打开复验：错误可见，顶栏、Stage 0、项目选中项和 `canvas.projectId` 始终属于 A；主进程 currentDir 为 A；坏 canvas 哈希不变。随后打开正常 B，标题、会话绑定、DOM 与 canvas 均切换到 B。

### AC-825-6 · 工程回归

定向测试、`npm run typecheck`、`npm run build` 通过；按需运行相关项目/画布/壳层套件。既有 B-70 失败单独列示，不伪称全量绿。

## 4. 非目标

- 不顺手修复 B-70，不重开 feature-824 的验收范围。
- 不新增通用项目打开回滚框架，不承诺覆盖预检成功后的任意并发文件替换或所有后置 I/O 故障。
- 不改 shared 类型、IPC/preload/dev-mock/MCP DTO、依赖、媒体通道、ComfyUI 边界和八步业务语义。
- 不提交、不推送、不发布，不清理工作树既有修改。
