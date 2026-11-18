# SDG-AI-变更记录 · feature-824 项目库真机补验

> 日期：2026-11-17 ｜ 状态：真机矩阵执行完成；AC-F1—F9 通过，AC-F10 检出 F824-01，整体不通过
> 上游：[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)、[已批准实施计划](../../../.trae/documents/切片F-项目库真机补验实施计划.md)

## 1. 文档变更：T0 建包与授权留痕

- 用户授权执行 P1 原始调查 §5 既定切片 F，并批准实施计划及验收契约 v1.0。
- 建立标准五文件任务包，冻结 AC-F1—AC-F10、隔离 fixture、真实 Finder 恢复和证据格式。
- 基线 HEAD：`b617772f18155ac00cf9214fc2a1dd839721db79`。
- 建包前确认 feature-824 未占用；8xx 前一最大编号为 feature-823。
- 核对 D-015：当前项目禁删、删除进入系统回收站、行内改名 Enter/Esc、恰 2 个 mutation IPC；本包不新增接口。
- 工作树已有 818—823 等未提交变更，本包不 reset、checkout、clean 或覆盖。

## 2. 写权与卡口

- 产品代码零写权：未修改 `electron/`、产品 Renderer、shared、preload、dev-mock、MCP、生产资源或依赖。
- K1/K8/K9：零触发。K7 在 T7 更新 A 类文档前暂停，已列明总开发计划与 Parity 矩阵的文件路径、旧/新口径及原因，并获用户明确批准；未调整 P1—P7 目标或包边界。
- 真机发现缺陷只取证登记；修复须另行授权，不在本包顺手实施。

## 3. 实施与验证记录

- **基线**：定向 Vitest 5 文件 / 56 测试通过，typecheck 与 build 通过；全量 95 文件中 85 通过 / 10 失败，1,272 测试中 1,196 通过 / 75 失败 / 1 跳过，失败仍为 B-70。
- **AC-F1—F6 通过**：当前/非当前改名、Esc 零写盘、完整 Electron 退出/重启、删除取消与当前项双重拒删、非当前项目真实进入 macOS 废纸篓、Finder“放回原处”及重新打开、缺 manifest 容错均符合预期。
- **AC-F7 通过**：前次坏 manifest UI 等待超时发生在运行中注入后的导航刷新；按任务包停止进程注入并冷启动后，`project:list` 与 Renderer 均列出 E，可保留有效 session 标题并打开，坏 manifest 哈希不变。该脚本时序不记产品缺陷。
- **AC-F8 通过**：坏 session 列表回退“新项目”且不提前改写；打开后重建合法五字段 session。
- **AC-F9 通过**：非项目目录与 `project-*` 普通文件被过滤并拒开；EACCES 项回退列出，打开显示明确错误，当前项目保持 A；验收后权限恢复为 `drwxr-xr-x`。
- **AC-F10 / F824-01（defect）**：坏 canvas 打开时界面可见 `CANVAS_CORRUPT: 画布文件损坏，已停止加载；请修复或从归档恢复`，原 canvas 注入后 SHA-256 未变化；但主进程 `session-state.json.currentDir` 已切到 `project-f824-g-bad-canvas`，Renderer 顶栏、立项单及项目菜单选中项仍为 A，无新 `canvas.onChange` 事件，`canvas.get` 返回 `CANVAS_CORRUPT`。已按批准计划停止回切和后续真机操作，仅记录缺陷，另待授权修复。
- **证据**：[p1-after-824-electron.json](../../verification/p1-2026-11-15/p1-after-824-electron.json) 最终为 `runCompleted=true`、`ok=false`；AC-F1—F9=pass、AC-F10=defect。原始日志见 [p1-after-824-electron.log](../../verification/p1-2026-11-15/p1-after-824-electron.log)，缺陷现场见 [p1-after-824-bad-canvas.png](../../verification/p1-2026-11-15/p1-after-824-bad-canvas.png)。

## 4. 文档闭环记录

- **T7 已闭环**：已更新 [P1 调查记录 §12](../../verification/p1-2026-11-15/P1调查记录.md)、[设计现状与偏差清单 B-71](../../设计现状与偏差清单.md)、[Feature 索引](../README.md)、[文档导航](../../README.md)、[总开发计划 v0.11](../../research/MiniMax%20Design全面复刻开发计划.md) 与 [Parity 影响矩阵 v1.9](../../design/MiniMax%20Design%20Parity影响矩阵.md)。两份 A 类文档已按 K7 获得明确批准；所有入口均保持切片 F、P1 和完整 Parity 不通过。
- **证据一致性复核**：最终 JSON 可解析，`runCompleted=true`、`ok=false`，AC-F1—F9 为 pass、AC-F10 为 defect 且仅登记 F824-01；AC-F10 顶层缺陷与内嵌快照均记录 `visibleCanvasError=true` 及同一可见错误原文。G 当前 canvas SHA-256 为 `edaea98cc9a35bccec717f391e849237c6b5c1fb21783efc4396bf0a124712ec`，注入前独立备份为 `91f247a57feef16fa6e86981c44fb04ab4ab60af1cdeb78324f2bdd3b30d0bd3`，与证据一致。
- **T8 环境与链接复核**：本切片 161 条相对链接零缺失；P1 历史章节另有 6 个既有缺失日志链接，本包未改写历史。中间诊断图已从证据目录移除；验收进程为零，H 权限恢复 `drwxr-xr-x`，B 已放回原处，G 的备份与主进程指向 G 的停止现场保留，系统废纸篓未清空。
- **Git 与负面清单**：已复核 `git status --short`、本切片 scoped diff 和 `git diff --check`；工作树既有产品/资源脏改未清理、未覆盖，本切片未写产品代码、shared、IPC/preload/dev-mock/MCP、依赖或生产资源，未修 B-70，未新增应用内回收站，未创建 commit、未 push、未发布。

**最终结论**：切片 F 矩阵执行完成，但验收整体不通过。AC-F1—F9 通过；AC-F10 / F824-01（B-71）须另包授权修复，B-70 与其他 P1 / Parity 缺口继续保持未闭环。
