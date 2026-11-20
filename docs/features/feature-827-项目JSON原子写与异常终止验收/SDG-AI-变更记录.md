# SDG-AI-变更记录 · feature-827 项目 JSON 原子写与异常终止验收

- **类型**：Bug 修复＋可靠性补强＋验收
- **作者**：AI（Trae）＋用户 K2 决策
- **日期**：2026-11-18
- **基线**：feature-825 坏画布打开事务修复、feature-826 谱系测试基线收口之后的工作树；2026-11-15 P1 调查

## 1. 用户原话 / 决策

- 用户指令：“没完成的继续完成”。
- 批准范围：继续 P1 收口；本包只处理项目 JSON 单文件原子写与真实异常终止，不顺带实施 feature-828—834。
- K2：用户原话“批准新增模块（推荐）”，批准新增 `electron/fs/atomic.ts`。
- K1/K7/K8/K9 零触发：未修改 `shared/types.ts`、IPC/DTO、preload、dev-mock、依赖或 A 类阶段状态，未新增媒体生成请求。

## 2. 修改文件

### 产品代码

1. `electron/fs/atomic.ts`：新增异步／同步单文件原子写；同目录 UUID temp、`open/write/fsync/close/rename`，rename 为唯一提交点；不隐式建目录、不归档、不进入全局队列。
2. `electron/project/manifest.ts`：新增显式目录 `writeManifestFile`；`writeManifest`、`advanceManifest` 收敛原子写，保留原队列与门后置语义。
3. `electron/project/library.ts`：建项／打开／改名等 `.session.json` 及全局 `session-state.json` 收敛原子写；保留显式目录、双写顺序、revision／receipt 和打开前 guard。
4. `electron/settings/workspace.ts`：工作目录切换中的 session-state 同步写接入原子替换，保留既有重试与回滚流程。
5. `electron/brief/publish.ts`、`update.ts`、`rollback.ts`：首版、更新、补偿及回滚 manifest 写点收敛；补偿恢复原始字节，不重新序列化改变原文。
6. `electron/mcp/tools.ts`：`file.write` 改为先复制旧档归档、再原子替换正档，返回字段仍为 `{ok:true,archived}`；`brief.impact.commit` manifest 写点复用显式目录函数。
7. `electron/fs/archive.ts`、`canvas/store.ts` 未改变既有公开语义；复用复制归档、temp/fsync/rename 与 receipt 机制。

### 测试

8. 新增 `src/test/fs/atomic-write.test.ts`：10 项，覆盖异步／同步调用顺序、temp 创建／写入／fsync／rename 故障、旧档保留、temp 清理，以及真实注册的 `file.write` 复制归档和 rename 失败。
9. 适配 `src/test/project/project-library-mutation.test.ts`、`src/test/settings/workspace-store.test.ts`、`src/test/brief/brief-update.test.ts`、`src/test/mcp/mcp-pure-tools.test.ts`：故障注入迁移到真实 temp/rename 边界，保留原业务、补偿、重试和零写盘断言。

### 规格与证据

10. 本任务包五文件、`docs/features/README.md`。
11. `docs/verification/p1-2026-11-15/p1-after-827-sigkill.json`、`.log`：六组最终通过结果。
12. 仓外 `/private/tmp/sdg827-kill-matrix.cjs`、`/private/tmp/sdg827-kill-hook.cjs` 仅为验收驱动，不进入产品、不新增测试 IPC。

## 3. 验证结果

- 定向工程回归：10 个测试文件、130 项全部通过。
- 最终全量 Vitest：**97 个测试文件、1288 passed、1 skipped、0 failed**。
- `npm run typecheck`：exit 0。
- `npm run build`：exit 0，Renderer 与 `dist-electron` 均成功。
- 真实异常终止：`p1-after-827-sigkill.json` 状态 **PASS**，manifest／project-session／global-session × rename before/after 共 6 组全部通过。
- 每组均使用 Electron 包内真实可执行二进制，记录 `signal: SIGKILL`、`processGone: true` 和实际 PID；不是 CLI 包装进程退出、mock kill、reload 或 `app.quit`。
- 异步 rename 由主进程 inspector 装载仓外 require hook；同步 rename 使用编译后真实提交行条件断点。六组均有装载标记和 kill 点。
- 每组在重启及恢复 IPC 之前直接验证目标 JSON 和 temp；before 保留完整旧值，after 保留完整新值。重启后再次验证恢复，六组 canvas receipt 均深等且 revision 未二次推进。
- 规格回读与范围核对：**PASS**；无 IPC/DTO、shared、preload、依赖、媒体生成及 A 类阶段状态改动。本包只关闭自身 AC，不代表 P1 或完整 MiniMax Design Parity 通过。

## D-037 接收 feature-825 写安全约束（2026-11-19）

| 来源 | 目标章节 | 处理 |
| --- | --- | --- |
| feature-825 需求 §2、AC-825-1/2/4 中 guard、session/currentDir 与错误优先级 | 本包需求「D-037 现行归并约束」 | 迁入提交前守卫、零写入与错误顺序 |
| feature-825 契约 §2「内部提交守卫」 | 本包契约「D-037 现行归并约束」 | 迁入 `beforeCommit`、同一写队列和失败后续队列语义 |
| feature-825 设计 §3「提交点与错误顺序」 | 本包设计「D-037 现行归并设计」 | 迁入 guard 位置与 session/currentDir 写入顺序 |
| feature-825 测试、实现记录及真机证据 | 保留在 feature-825；本包既有证据不回写 | 不复制或改写历史结论 |

- **归属分界**：完整打开提交及提交后顺序 → feature-828；Canvas 只读预检 → feature-823；本包只承接 guard/session 写安全相关部分。
- **冲突处理**：单项目串行队列不等于跨项目或跨文件事务，原子替换不等于目录 `fsync`、任意后置 I/O 或断电全保证。
- **执行边界**：纯文档，未新增接口，未运行产品测试，未宣称新增能力或真机验收通过；既有 6 组真实 SIGKILL 结论不变。
- **复核状态**：自审 + 无第二人复核。
