# feature-827 · 项目 JSON 原子写与异常终止验收 — 设计说明

> 版本：v1.0（2026-11-18）｜对应：[契约](./SDG-RE-契约.md)

## 1. 单文件提交点

原子写以 rename 为唯一提交点：旧正档在 rename 前保持不动；temp 写完并 fsync/close 后才替换。异常发生在 temp 阶段则清 temp 并保留旧档；异常发生在 rename 后，正档只能是完整新档。同步 API 使用等价 `openSync/writeFileSync/fsyncSync/closeSync/renameSync` 顺序，避免改动大量现有同步调用。

## 2. 写点分层

- `manifest.ts` 提供显式目录写原语；`writeManifest` 保留 activeDir＋全局队列语义。建项、发布、直改、回滚和 MCP 门后置在各自既有队列/补偿边界内调用显式目录写，不嵌套新队列。
- `library.ts` 的异步项目 session 与 manifest 使用异步原语；`writeSessionState` 保持同步并调用同步原语。
- `workspace.ts` 只替换 session-state 的提交方式；workspace.json 与项目搬移/重试顺序不变。
- `file.write` 先 `copyExistingToArchive` 保留旧正档，再原子写；这样归档与正档之间死亡也不会只剩归档。

## 3. 故障注入

单测在 `open/write/fsync/rename` 等当前真实边界注入，不继续假定正档直接 `writeFile`。异步与同步均检查 rename 前旧档不变、失败不残留本模块 temp；成功后 JSON 完整。既有测试只做必要的拦截点适配，业务断言原样保留。

## 4. 真实 SIGKILL 夹具

仓外父进程完成 build 后直接启动 Electron 包内可执行二进制（不是 CLI 包装进程），开放浏览器 CDP／主进程 inspector，通过既有 `window.api` 建两个项目并打开 A。当前 Electron 拒绝 `NODE_OPTIONS=--require=<hook>`；每轮由主进程 inspector 执行 `createRequire(...)(<hook>)` 拦截异步 rename。同步 ESM fs 调用在本环境下不被该 CJS hook 命中，故对全局 session-state 在编译后 `atomic.js` 的真实 `renameSync` 行／下一行设置带文件名条件的断点。装载标记证明注入／断点生效后才触发业务 IPC：

1. 预先经既有发布/门流程使项目达到可放行状态，再由 `gate.decide` 触发 manifest 提交，在 rename 前/后暂停，父进程发真实 SIGKILL；`project.rename` 只写 `.session.json`，不作为 manifest 触发源。
2. `project.open(B)` 触发项目 `.session.json` 与全局 session-state，分别在两文件的 rename 前/后暂停并 kill。
3. hook／条件断点只报告目标与阶段，不写业务数据；父进程读报告后 kill 真实 Electron PID，并验证 PID 消失。异步 rename 在原始调用完成后才报告 after；同步 renameSync 的 after 断点位于提交行下一行。
4. kill 后、重启及任何恢复 IPC 之前，直接读取目标 JSON 与 temp，断言 before 旧值／after 新值。随后由无 hook 新进程读取三份 JSON，按场景比较完整旧/新快照，并通过项目列表/打开与 canvas IPC 验证恢复；global-session-before 在重启后先显式重开旧 current A 再读回，以区分崩溃提交结果与后续正常业务写。固定命令重放必须返回同 receipt，revision 不二次递增。

临时脚本、隔离 HOME/userData/workspace 和 hook 均在仓外；仓内只保留最终 JSON/log 证据。kill 点之后其他文件是否已提交取决于原调用顺序，本包按每文件旧/新完整性验证，不虚构跨文件原子性。

## 5. 回滚

按契约撤回共用模块与调用点即可恢复旧写路径；删除新增测试与本包证据。不得回退 feature-826 或工作树其他并行修改。

## D-037 现行归并设计：openProject 与同项目写队列（2026-11-19）

```text
openProject
  → assertProjectDir（INVALID_PROJECT_DIR）
  → manifest access（PROJECT_NOT_FOUND）
  → 同一单项目写队列任务
       → await beforeCommit guard
       → guard 成功后才写目标 .session.json
       → 再提交全局 currentDir
```

guard reject 时两个写入均未开始，原错误直接上抛且后续队列可继续。guard 放在 `openProject` 内部而非 main 提前执行，是为了保留路径/manifest 错误优先级，并令预检与 session 提交处于同一队列任务。Canvas 预检实现由 feature-823 负责，提交后的门清理、缓存 reset、恢复和广播顺序由 feature-828 负责。

该设计与原子写组合仍只提供单文件、单项目和既有真实 SIGKILL 矩阵范围保证；不增加跨文件事务、目录 `fsync`、任意后置 I/O/并发替换或断电全保证。
