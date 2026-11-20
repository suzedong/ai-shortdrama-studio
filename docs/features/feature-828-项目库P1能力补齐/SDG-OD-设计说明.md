# feature-828 · 项目库 P1 能力补齐 — 设计说明

> 版本：v1.0（2026-11-18）｜对应：[契约](./SDG-RE-契约.md)

## 1. 分层

`transfer.ts` 负责纯主进程文件能力：详情读取、静态包预检、递归普通文件复制、快照读写、staging 提交和来源映射。`main.ts` 只处理原生对话框、Finder 和 runtime SDK 调用，使文件算法可在无 Electron UI 的 Vitest 中直接验证。Renderer 不接收文件系统写权限，只发显式 IPC。

## 2. 项目身份与副本

当前平台以项目目录 basename 作为 canvas.projectId。原生导入以源目录名预检；本包导出以 `project-package.sourceProjectId` 保留身份，使导出目录改名后仍可验证。导入通过共用 `allocateDir` 分配不存在的 `project-<时间戳>-<随机串>`，随后只重写 `.session.dir` 和 canvas 根 `projectId/title`。页、画布、节点、Gate、资产 ID 与相对路径保持不变，避免破坏引用。

## 3. 静态复制与提交

复制前递归 lstat 预检并拒绝符号链接。复制阶段再次检查每个条目，防止预检后替换；仅创建目标 staging 内目录和普通文件。排除项按相对路径判定，不把包内路径当作宿主目标路径。写入 package/session/snapshot 元数据后 rename 到最终目录。导入在工作区内完成 rename 后才进入列表；导出目标必须不存在，系统 rename 拒绝覆盖。

 staging 名称使用同目录隐藏随机后缀。正常错误尽力 `rm -rf` staging；真实进程强杀后可能遗留隐藏 staging，但它不作为项目出现，也不替代正档。本设计不等同目录 fsync 或跨文件事务。

## 4. 会话快照

opencode 私有数据根位于 userData，不能靠复制项目目录获得正式会话。导出时 main 从 `.session.activeSessionId` 取得绑定 ID，经 `withRuntime` 和 `runtimeClient.getSessionMessages` 读取真实记录，再传给 transfer 写入快照。runtime 不可用或读取失败使导出失败；无绑定 ID 则明确不新增快照。

导入只保留快照文件，活跃指针为空，详情面板通过 `replayMessages` 和现有消息组件渲染，不向原 sessionId 发送 prompt。用户发送消息时，既有空绑定分支创建新会话；main 在绑定成功后记录最新快照来源。后续导出把当前本地会话作为新快照追加，并保留导入链上的历史快照。

## 5. UI 复用

Welcome 直接消费项目列表的 lastOpenedAt，移除目录 mtime 读取。ProjectNav 复用现有查询和列表，新增详情/导出/定位菜单动作及导入入口；Welcome 提供导入与详情入口。`ProjectDetailPanel` 同时服务两处，不另建路由或状态库。布局沿用既有设计 token 和本地 overlay。

## 6. 验证策略

文件测试使用隔离临时工作区与真实 JSON，故障注入落在 copyFile/rename/快照读取等真实边界；同时验证列表不可见和 staging 清理。组件测试覆盖历史排序、详情、快照只读和动作入口。真实 Electron 通过原生 IPC/CDP 操作，文件对话框由仓外驱动使用测试选择的实际目录；不以 dev-mock 成功代替真机结果。

## D-037 现行归并设计：入口、项目库与打开状态机（2026-11-19）

### 1. 无项目入口

```text
无活动项目 / 最近项目失效
  → 项目库或首启选择态
  → 新建 / 打开既有项目 / 重开最近项目
  → 打开事务提交成功后才进入工作区
```

项目库不使用演示项目填空；读取失败与无记录是不同状态。feature-820 的 Stage 0 只承担已打开项目内部导航，不再承接真正无项目入口。

### 2. F1—F10 结构

项目列表（F1）提供打开（F2）、新建（F3）、关闭（F4）、重命名（F5）、复制（F6）、删除（F7）、导入（F8）、导出（F9）及保存状态（F10）入口，全部复用既有项目服务。复制生成新 ID；导入预检失败不污染列表，重复项目分配新目录并重写身份；导出以真实静态目录产物完成为准；删除需既有确认；F10 沿用 D-025 四态、1 秒尾随自动保存和关闭前冲刷。本设计不把这些既有入口重新宣称为 D-037 新增能力。

### 3. 打开提交与零副作用失败

打开先通过路径/manifest 校验，再在同一单项目队列内执行 `beforeCommit` guard。guard 使用 feature-823 的 Canvas `assertReadable`：缺失可打开，坏 JSON、非法结构和 projectId mismatch fail closed，且预检不写盘、不建 session、不清门、不广播。只有 guard 成功后才写目标 `.session.json` 和 `currentDir`，随后按 clearLive、缓存 reset、初始化设置、恢复会话/工作区、标题同步和广播的既有顺序完成打开。

guard reject 前提交点尚未到达，因此原项目 session/currentDir、保存状态、门和广播保持，而不是事后用默认空项目覆盖或伪称通用回滚。缺失 canvas 只在提交后创建，普通打开 DTO 与 `lastOpenedAt` 不变。错误优先级和队列由 feature-827 负责；本设计不增加媒体探测、任意后置 I/O、第三方并发替换、跨文件事务、目录 `fsync` 或断电全保证。

### 4. 历史冲突

feature-824 原始总体 FAIL、F10 FAIL 永久冻结；后续修复只能形成独立新证据，不能倒写原验收。本次纯文档归并未运行产品或真机测试。
