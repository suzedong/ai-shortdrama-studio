# feature-825 · 坏画布打开事务修复 — 设计说明

> 版本：v1.0（2026-11-18）｜对应：[契约](./SDG-RE-契约.md)

## 1. 不变式

目标项目画布尚未证明可读前，以下提交与副作用均不得发生：

1. 目标 `.session.json` 写入与全局 `currentDir` 切换。
2. 原项目门索引清理、目标项目 pending 门恢复。
3. 当前/目标画布缓存 reset、标题写回与任何 Renderer 广播。

只读预检本身也不得产生可观察写副作用。

## 2. 共用解析路径

将 `CanvasStore.getForRoot` 中“读取既有文件 → JSON.parse → migrate/validate → projectId 对目录校验”抽为私有只读步骤：

- 返回磁盘上的有效 Canvas；文件不存在返回 `null`。
- `assertReadable(root)` 只调用该步骤并丢弃结果。
- `getForRoot(root)` 仍先读缓存；未命中时调用同一步骤，`null` 才创建 emptyCanvas 并原子写，之后填缓存。

这样预检与正式加载不会出现两套不同的坏档判据，且预检不会被旧缓存掩盖。

## 3. 提交点与错误顺序

`openProject` 在既有 `assertProjectDir` 和 manifest access 之后进入写队列，并在构造/写入 session 前等待内部 guard。主进程传入目标根目录的 `assertReadable`。

guard 位于 `openProject` 内部而不是 main 提前调用，原因是保留路径硬边界及 `PROJECT_NOT_FOUND` 优先级，并确保 guard 与 session 提交处于同一写队列任务。guard 失败时 `enqueue` 已保证后续队列可继续，不需要额外清理。

## 4. 测试设计

主进程测试通过 Electron mock 捕获真实 `ipcMain.handle('project:open')` 回调，使用临时工作区和真文件，不复制一份打开编排：

- 先真实打开 A，再注入 G 坏 canvas；记录双 session、双 canvas 和 currentDir。
- spy 门清理/恢复、缓存 reset；注册伪 WebContents 捕获广播。
- 未修基线已表现为 IPC reject `CANVAS_CORRUPT`、currentDir=G；异常由 `recoverPending` 抛出。修复后断言同样的明确错误，但所有快照不变、门/reset/广播零副作用。
- 正常 B 用例验证绑定、标题、广播与 canvas 归属；缺失 canvas 验证预检不创建；失配 canvas 验证错误码。

Renderer 一致性由真实 Electron 同时读取 DOM 与主进程状态验收；如现有壳层测试适合补充，则增加 reject 后选中项/标题不变的组件断言，不另造状态管理抽象。

## 5. 风险与回滚

- 风险：共用解析抽取改变正常加载。缓解：运行既有 canvas-command、多画布与项目 session 测试。
- 风险：测试导入 main 触发窗口/运行时。缓解：Electron mock 令 `whenReady` 保持未决，仅捕获 IPC；不启动真实窗口或 Agent。
- 回滚：仅撤回本包三处产品代码与新增测试，不触碰其他未提交修改；证据保留失败事实。
