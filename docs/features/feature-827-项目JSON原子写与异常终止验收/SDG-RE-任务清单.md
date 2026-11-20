# feature-827 · 项目 JSON 原子写与异常终止验收 — 任务清单

> 版本：v1.0（2026-11-18）｜顺序：T0 → T1 → T2 → T3 → T4 → T5

- [x] T0 只读盘点三类项目 JSON 全部写点、通用 file.write 绕过、现有队列/归档/画布原子写和 receipt 语义；确认 K2 新模块需求。
- [x] T1 获得 K2 批准并建立五文件包，冻结 AC-827-1—5、文件写权和真实 SIGKILL 矩阵。
- [x] T2 实现异步/同步原子写并收敛全部授权写点；通用 file.write 改复制归档，不改公开契约。
- [x] T3 新增/适配故障测试，完成定向回归、全量 Vitest、typecheck 和 build，记录真实结果。
- [x] T4 以仓外父进程执行 6 组真实 SIGKILL，验证真实 Electron PID 消失、kill 后即时磁盘旧/新完整档、重启恢复和 canvas receipt 幂等，保存证据。
- [x] T5 更新任务包与 feature 索引，复核 K1/K7/K8/K9 零触发、禁止路径和并行修改，不提交 Git。

完成定义：AC-827-1—5 均有可复核证据；真实 SIGKILL 未跑完不得把 T4 或本包标为闭环。

## D-037 文档归并 Change：接收 feature-825 写安全约束（2026-11-19，✅ 文档完成）

- [x] 将 `openProject` 写队列内 `beforeCommit` guard、目标 session/currentDir 提交顺序迁入需求、契约、设计。
- [x] 将 `INVALID_PROJECT_DIR` → `PROJECT_NOT_FOUND` → guard 原始错误的优先级写成自包含契约。
- [x] 明确 Canvas 预检归 feature-823、完整打开提交顺序归 feature-828；不重复承接。
- [x] 保证范围仍限单文件原子写、单项目队列和既有真实 SIGKILL 矩阵；未运行产品测试，未修改代码或既有验收数字。

**文档 AC**：无需回查 feature-825 即可理解本包 guard/session 与错误语义；未把队列扩写为跨文件/跨项目事务，未新增断电、目录 `fsync` 或任意后置 I/O 通过声明。
