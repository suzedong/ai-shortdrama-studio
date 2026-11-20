# feature-827 · 项目 JSON 原子写与异常终止验收 — 契约

> 版本：v1.0（2026-11-18 冻结）｜需求：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)

## 1. 模块契约

`electron/fs/atomic.ts` 新增：

- `writeTextAtomic(filePath, text): Promise<void>`。
- `writeTextAtomicSync(filePath, text): void`。

两者只负责单文件原子替换，不隐式建目录、不归档、不串行化；目录准备、归档与队列仍由调用方负责。temp 与目标同目录，使用 `open/openSync('wx')`、完整 UTF-8 写入、文件 fsync、close 后 rename；未提交时尽力关闭句柄并删除 temp，原异常继续抛出。

`project/manifest.ts` 增加内部共享的显式目录写函数，供既有多文件流程复用；其公开 manifest 字段和 `writeManifest` 门后置行为不变。通用 `file.write` 改用复制归档，保持原返回 `{ok:true,archived}`。

## 2. 文件与写权

| 文件 | 允许修改 |
|---|---|
| `electron/fs/atomic.ts` | 新增共用异步/同步原子写 |
| `electron/project/manifest.ts` | 显式目录原子写与既有入口复用 |
| `electron/project/library.ts` | manifest、`.session.json`、全局 session-state 写点接入 |
| `electron/settings/workspace.ts` | session-state 同步原子写；workspace.json 行为不变 |
| `electron/brief/publish.ts` | manifest 显式目录写接入，其他发布文件流程不变 |
| `electron/brief/update.ts` | manifest 正写与补偿写接入，其他补偿不变 |
| `electron/brief/rollback.ts` | manifest 写接入，rollback 数据与归档不变 |
| `electron/mcp/tools.ts` | file.write 复制归档＋原子写；直接 manifest 写接入 |
| `src/test/fs/atomic-write.test.ts` | 新增共用模块故障与顺序测试 |
| `src/test/fs/fs-archive.test.ts` | 如需补复制归档语义，仅追加相关用例 |
| `src/test/project/project-library-mutation.test.ts` | 三类项目文件故障与改名/删除回归 |
| `src/test/project/project-open-main.test.ts` | 打开预检与原子写兼容回归 |
| `src/test/settings/workspace-store.test.ts` | 同步 temp/rename 故障 mock 对齐，保留重试语义 |
| `src/test/brief/brief-update.test.ts` | manifest 原子写故障 mock 对齐，保留补偿矩阵 |
| `src/test/brief/brief-rollback.test.ts` | 回滚 manifest 写兼容 |
| `src/test/gate/gate-execute.test.ts` | 门后置 manifest 写兼容 |
| `src/test/mcp/mcp-pure-tools.test.ts` | file.write 与直接 manifest 原子写/归档测试 |
| `src/test/mcp/mcp-brief-tools.test.ts`、`mcp-brief-impact-tools.test.ts`、`mcp-brief-harness-gate.test.ts` | 既有发布 mock 兼容，不断言实现以外行为 |
| `src/test/style/style-upgrade.test.ts` | 仅在既有 manifest mock 因原子写失效时对齐 |
| 本包五文件 | 规格、实施、验证和变更记录 |
| `docs/features/README.md` | 完成后新增本包索引，保留并行修改 |
| `docs/verification/p1-2026-11-15/p1-after-827-*` | 真实 SIGKILL JSON/log 证据 |

仓外 `/tmp` 仅允许临时 hook/父进程脚本与隔离运行目录，不作为交付源码。禁止修改 shared、preload、公开 IPC/DTO、依赖、A 类总计划/Parity 矩阵及其他未列文件；必要扩权先更新契约并记录原因。

## 3. 验证契约

1. 定向 Vitest：fs/project/settings/brief/gate/mcp/canvas 相关测试。
2. 全量 `npx vitest run`、`npm run typecheck`、`npm run build`。
3. 仓外 Node 父进程直接启动真实 Electron 可执行二进制，以环境变量指定唯一目标与 kill 点；主进程 inspector 对异步 rename 装载仓外 require hook，对同步 rename 设置真实提交行条件断点（当前 Electron 拒绝 `NODE_OPTIONS --require`，且 CJS hook 未命中本环境的 ESM 同步调用）。每轮独立隔离目录，记录装载标记、真实 SIGKILL 退出与 PID 消失，不用 CLI 包装进程退出或应用内退出代替。
4. 新进程通过文件直读和既有 IPC 双重核验；固定 canvas 命令先发一次、再以完全相同请求重放，比较 revision 与 receipt。

## 4. 决策卡口

- K2：**已批准**新增 `electron/fs/atomic.ts`，批准时间 2026-11-18。
- K1/K8/K9：零触发；无 shared、公开 IPC/MCP DTO 或依赖变化。
- K7：零触发；A 类阶段状态不改。

若真实崩溃矩阵暴露跨文件一致性问题，本包只记录边界，不擅自扩大为跨文件事务或门恢复重设计。

## D-037 现行归并约束：feature-825 打开提交守卫契约（2026-11-19）

### 1. 既有 openProject 守卫与队列

- `openProject` 在 `assertProjectDir` 与 manifest access 后进入既有单项目写队列；`beforeCommit` guard 必须在队列任务内、目标 `.session.json` 构造/写入和全局 `currentDir` 提交之前完成。
- guard reject 原样上抛，目标 session/currentDir 零写入；`enqueue` 须保证失败后后续队列仍可继续。该约束不增加 `project:open` 通道、参数或 DTO。
- 完整成功路径和提交后的门/缓存/广播顺序归 feature-828；`canvasStore.assertReadable` 的读取、迁移和校验语义归 feature-823。

### 2. 错误判定顺序

| 顺序 | 条件 | 错误码/行为 |
| --- | --- | --- |
| 1 | 工作区外或非 `project-*` 路径 | `INVALID_PROJECT_DIR` |
| 2 | manifest 缺失或不可访问 | `PROJECT_NOT_FOUND` |
| 3 | 前两级通过后 guard reject | 原样保留 `CANVAS_CORRUPT` / `CANVAS_PROJECT_MISMATCH` 等错误 |

guard 不得绕过路径硬边界或抢在 manifest 校验前改变优先级；本契约不把 Canvas 错误改写成通用项目 JSON 错误。

### 3. 保证上限

本契约与原子写共同只覆盖单文件原子替换、单项目队列、上述 session/currentDir 提交守卫及既有真实 SIGKILL 矩阵；不包含跨文件事务、目录 `fsync`、预检成功后的任意并发文件替换保证或断电/系统崩溃全保证。
