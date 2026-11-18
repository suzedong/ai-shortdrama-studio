# SDG-OD-设计说明 · feature-824 项目库真机补验

> 日期：2026-11-17 ｜ 上游：[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)
> 性质：验收拓扑与取证设计，不新增产品视觉、交互或运行架构。

## 1. 现状映射

| 能力 | 既有实现 | 本包观测点 |
| --- | --- | --- |
| 项目列表/打开 | `electron/project/library.ts` 的 `listProjects/openProject` | 列表回退、打开错误、currentDir 与 Renderer 一致性 |
| 改名 | `renameProject` + `ProjectNav.tsx` 行内输入 | UI Enter/Esc、三处标题、session、物理目录不变 |
| 删除 | `deleteProject` → `shell.trashItem` | UI 确认、主进程当前项保护、真实系统废纸篓 |
| 恢复 | macOS Finder“放回原处” | 精确测试项、原路径、内容哈希、重开恢复 |
| 异常容错 | manifest/session/canvas 各自读取路径 | 不崩溃、不静默覆盖、不串项目；区分降级与恢复 |

不修改上述实现。`main.ts` 打开项目时的画布重置/推送异常分支是重点观测对象，不因代码存在预先判定通过。

## 2. 隔离拓扑

- 运行形态：production Electron + Vite preview + CDP，dev-mock 关闭。
- 独立资源：userData、HOME/Documents、workspace、tmp、Vite/CDP 端口。
- 项目：唯一 `project-f824-*` A/B/C 及按用例独立异常目录；每项带唯一内容标记。
- 备份：workspace 外的非 `project-*` 目录；保存原始文件和哈希。
- 启动复核：设置 IPC 返回 root 与实际磁盘 root 均等于隔离 workspace，否则停止。
- 完整重启：退出 Electron 进程后重新启动；renderer reload 不算。

## 3. 执行顺序

1. 定向测试、typecheck、build、全量 Vitest，建立当前工作树证据。
2. 正常项目 A/B/C：当前/非当前改名、Esc、切换与重启。
3. 删除：取消 → 当前项 UI/IPC 拒删 → C 真实删除 → Finder 精确 Put Back → 重启打开。
4. 异常按风险递增：非项目目录 → 缺 manifest → 坏 manifest → 坏 session → EACCES → 坏 canvas。
5. 坏 canvas 放最后；若出现串项目，整轮停止，不做后续写操作。

## 4. 取证设计

每个 AC 记录：fixture、操作、预期、实际、状态分类、IPC 返回/错误、currentDir、Renderer project/title/canvas、前后哈希、日志和截图。

证据 JSON 分设 `runCompleted` 与 `ok`，避免“执行完成”被误读为“全部通过”。视觉行为必须有截图或可复查的 DOM 证据；系统废纸篓恢复还必须有 Finder 现场证据，不能用文件移动脚本替代。

## 5. 缺陷分类

- **pass**：满足该 AC 的全部适用判据。
- **existing-behavior**：观察到的额外现状，例如缺 manifest 项列入列表但不可打开；需与 AC 判定分开记录。
- **defect**：出现状态错配、非预期写入/移动、数据损坏或明确契约违例。
- **inconclusive**：环境或证据不足，不能推断通过。

发现缺陷只保留最小复现、原文、哈希和日志。修复、是否允许某种降级、是否新增应用内恢复均另行走 L2/Feature 授权。

## 6. 文档边界

闭环时更新任务包、Feature 索引、P1 调查补记和必要的当前状态文档；Parity 只补直接相关证据，不改最终结论。本包不是跨 Feature 或 P1 阶段门里程碑，不更新版本编年史和 HTML 看板。
