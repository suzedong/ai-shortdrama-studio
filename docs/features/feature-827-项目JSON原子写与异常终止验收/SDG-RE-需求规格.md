# feature-827 · 项目 JSON 原子写与异常终止验收 — 需求规格

> 版本：v1.0（2026-11-18 冻结）｜溯源：[自研新增·平台可靠性]
> 上游：P1 退出门「revision 冲突、原子写失败和异常退出不破坏项目 JSON」、feature-825 打开事务修复。
> 授权：用户「没完成的继续完成」；K2 于 2026-11-18 批准新增 `electron/fs/atomic.ts`。

## 1. 问题

画布已有 temp→fsync→rename 原子替换，但 `manifest.json`、项目 `.session.json`、`userData/session-state.json` 仍存在直接覆盖写；通用 `file.write` 还可绕过项目封装，并先把旧档 rename 到归档再写正档。进程在覆盖或归档与正档之间死亡时，可能留下截断 JSON 或缺失正档。

## 2. 目标

1. 新增主进程共用异步/同步原子写模块：同目录唯一 temp、`wx` 独占创建、写完后文件 fsync、close、原子 rename；失败清理 temp，rename 前失败保留完整旧档。
2. 三类项目 JSON 的所有写点收敛到该模块；保留现有进程内写队列、字段、时间戳、归档和公开返回契约。
3. 通用 `file.write` 使用复制归档＋原子替换，不得先把唯一旧正档移走；项目系统文件不能经该工具退回直接覆盖。
4. 用故障单测和真实 Electron SIGKILL 证明：kill 于 rename 前得到完整旧档，kill 于 rename 后得到完整新档；重启可打开项目、恢复 currentDir/session，固定 canvas 命令重放保持 receipt 幂等。

## 3. 验收标准

### AC-827-1 · 共用原子写

异步与同步 API 均满足同目录 temp、独占创建、write/fsync/close/rename 顺序和异常清理；不宣称已完成目录 fsync 或断电级持久化。既有调用方可继续使用同步 `writeSessionState`，不扩散 async API 改动。

### AC-827-2 · 写点完整收敛

建项、打开、改名、门后置、立项发布/直改/回滚、manifest 补偿、工作目录切换及通用 `file.write` 不再直接覆盖三类目标 JSON。归档复制失败或 temp 写/fsync/rename 失败时返回原错误链路，不伪造成功。

### AC-827-3 · 故障与既有语义回归

新增原子写故障测试，覆盖旧档保留、新档完整、rename 失败清理及同步路径；调整既有 mock 以拦截当前 temp/rename 点，但不删除 manifest 补偿、workspace 重试、归档和零写盘断言。定向测试、全量 Vitest、typecheck、build 通过。

### AC-827-4 · 真实 SIGKILL 矩阵

仓外 Node 父进程直接启动 Electron 包内可执行二进制（不是 CLI 包装进程），通过浏览器 CDP 执行真实 IPC；主进程 inspector 对异步 `fs.promises.rename` 装载仓外 require hook，对同步 `fs.renameSync` 在编译后 `atomic.js` 的真实提交行设置条件断点（当前 Electron 拒绝 `NODE_OPTIONS --require`，且本环境下 CJS hook 未命中 ESM 同步调用）。通过真实 `gate.decide` 触发 manifest 提交、通过真实 `project.open` 分别触发项目 session 与全局 session-state 提交，执行 rename 前/后共 6 组 SIGKILL，并验证真实二进制退出信号与 PID 消失。每轮在重启及恢复 IPC 之前直接检查 kill 后目标 JSON 和 temp，再由新进程验证 JSON 可解析且只能为完整旧值或完整新值、currentDir/session 可恢复；最后以既有 canvas IPC 重放同一 `commandId + expectedRevision + requestHash`，确认 receipt 相同且 revision 只推进一次。

### AC-827-5 · 证据与边界

真实进程退出信号、目标文件、kill 点、旧/新判定、重启恢复和 receipt 结果写入 `docs/verification/p1-2026-11-15/p1-after-827-*`。不得以 reload、`app.quit`、mock kill 或测试专用 IPC 替代；未实际完成的矩阵不得预写通过。

## 4. 非目标

- 不实现跨文件事务、跨进程锁、目录 fsync、掉电一致性或门后置动作自动续跑。
- 不改 shared 类型、IPC/preload/dev-mock、MCP 工具数量/名称、依赖或 A 类阶段状态。
- 不推进 feature-828—834，不提交、不推送、不发布，不覆盖工作树其他修改。

## D-037 现行归并约束：打开守卫、同项目队列与错误优先级（2026-11-19）

本节自包含接收 feature-825 中与项目 session/currentDir 写安全直接相关的约束；Canvas 只读预检归 feature-823，完整打开提交顺序归 feature-828。

1. `openProject` 的路径与 manifest 校验之后、任何目标 `.session.json` 或全局 `currentDir` 写入之前，必须在**同一单项目写队列任务内**等待主进程内部 `beforeCommit` guard。新 session 不得在 guard 成功前构造或提交为权威活动 session。
2. guard reject 必须原样上抛，不得写目标 session/currentDir、吞错或改返回成功；队列失败后仍须可继续处理后续请求。该队列只保证单项目顺序，不扩展为跨项目或跨文件事务。
3. 既有错误优先级保持为：工作区外或非 `project-*` 路径 → `INVALID_PROJECT_DIR`；manifest 缺失/不可访问 → `PROJECT_NOT_FOUND`；随后才执行 guard，并保留 `CANVAS_CORRUPT` / `CANVAS_PROJECT_MISMATCH` 等原始错误。Canvas 校验本体归 feature-823，本节只约束 guard 不得抢先改变前两级错误。
4. 与原子写合并后的保证仅为：**单文件原子替换、同项目串行队列、上述 guard/session 顺序与错误优先级，以及真实 SIGKILL 矩阵已覆盖的范围**。不承诺跨 `manifest.json` / `.session.json` / `canvas.json` / 媒体文件事务，不承诺目录 `fsync`，也不承诺断电、内核崩溃或存储介质故障下零丢失。
5. 本次仅归并文档，不新增接口或扩大验收范围；既有 6 组真实 SIGKILL 证据保持原结论，不因文档归并改写成其他场景也已通过。
