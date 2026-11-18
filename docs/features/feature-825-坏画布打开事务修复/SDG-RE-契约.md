# feature-825 · 坏画布打开事务修复 — 契约

> 版本：v1.0（2026-11-18 冻结）｜需求：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)

## 1. 外部契约

`project:open` 的通道名、字符串入参、成功返回 `{ ok:true, activeSessionId:string|null }`、既有错误码和 Renderer API 均不变。本包只恢复 feature-824 AC-F10 已要求的失败一致性，不新增 IPC、推送或 DTO 字段。

## 2. 内部提交守卫

- `CanvasStore` 增加按显式项目根目录执行的只读 `assertReadable(projectDir)` 能力：复用正式加载相同的 JSON 解析、迁移/结构校验和 `projectId` 校验；不读当前 `session-state`，不信任既有缓存，不写盘、不广播、不填缓存。
- 目标 canvas 不存在视为可打开；正式切换后的既有 `get()` 才负责创建空画布。
- `openProject` 增加仅主进程内部使用的提交前异步 guard。顺序固定为：路径校验 → manifest 可访问校验 → 写队列内 guard → 写目标 `.session.json` → 写全局 currentDir。
- `project:open` 将 `canvasStore.assertReadable` 作为 guard 传入。guard reject 原样上抛，不吞错、不改写为成功。

## 3. 成功路径顺序

预检成功后才允许继续既有顺序：`openProject` 提交 → `gateBridge.clearLive()` → `canvasStore.reset()` → `gateBridge.recoverPending()` → 读取项目标题/画布 → 必要时同步标题 → 获取最终画布 → 广播 `canvas:changed` → 返回打开结果。

本包不改变既有标题同步的非致命语义，也不把广播并入 CanvasStore 预检。

## 4. 文件与写权

| 文件 | 允许修改 |
|---|---|
| `electron/canvas/store.ts` | 抽取共用只读解析/校验，新增显式根目录预检；其余命令事务保持不变 |
| `electron/project/library.ts` | 增加内部提交前 guard，并置于任何 session/currentDir 写入之前 |
| `electron/main.ts` | 仅把目标画布预检接入 `project:open`；保留既有成功路径 |
| `src/test/project/project-open-main.test.ts` | 新增主进程真实 handler 回归测试 |
| 相关既有 Renderer/项目/画布测试 | 仅在需要补回归断言时最小编辑 |
| 本包五文件及既有索引/调查/偏差/证据 | 记录实施与验收事实 |

禁止修改：`shared/types.ts`、preload、`global.d.ts`、dev-mock、MCP 工具、依赖与锁文件、生产资源、feature-824 历史证据、B-70 相关测试基线。未经 K7 批准不修改总开发计划或 Parity 矩阵等 A 类文档。

## 5. 决策卡口预判

- K1：零触发；shared 零 diff。
- K8：零触发；无新增/变更外部通道或 DTO，仅修复既有 AC-F10 行为。
- K9：零触发；零新依赖。
- K7：建包及 B/C 文档按既有授权推进；A 类文档不在本包默认写权内。

若实施需要超出上述范围，先暂停并呈报。
