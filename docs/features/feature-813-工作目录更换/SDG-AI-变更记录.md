# feature-813 工作目录更换 · 变更记录

## 一、决策记录（永久保留）

- 2026-11-03 · **用户范围裁决（AskUserQuestion 三项，已确认）**：
  1. **单一全局工作区根目录**：不做多根并存、不做按项目目录；默认根维持 `~/Documents/ai-shortdrama-studio`；
  2. **存量项目整体物理搬移**：旧根 `project-*` 目录随更换整体迁移到新根，失败整体回滚，不允许半搬态；
  3. **UI 入口在设置面板**：与 feature-014「AI 服务设置」并列的系统菜单项 + 模态面板；系统直做（D-016），不经 AI 对话。
- 2026-11-03 · **K8 卡口（增量契约）——用户已批准**：新增 3 条 IPC 通道（`settings:workspace:get` / `pick` / `change`）+ `window.api` 新增 `settings.workspace` 3 键，全部为纯增量，不改既有通道、DTO 与签名；DTO 在 `src/global.d.ts` 镜像主进程（feature-014 先例），**不改 `shared/types.ts`，K1 零触发**。批准时间 2026-11-03（AskUserQuestion「批准，按 T1–T7 实现」）。
- 2026-11-03 · **边界裁决**：跨磁盘卷（EXDEV）搬移不在本期范围，`changeDir` 对其返回固定文案的 `WORKSPACE_MOVE_FAILED`；非 `project-*` 文件一律不搬。

## 二、实施记录

- 2026-11-03（**T1–T7 落地**）：K8 经用户批准后按任务清单执行完毕——
  - T1 [workspace.ts](../../../electron/settings/workspace.ts)（新）：store 读取容错 + `getSettingsView` / `resolveWorkspaceRoot` + `changeDir` 十步流程（校验 → 冲突预检零写盘 → 逐项 rename + 失败回滚 + EXDEV 固定文案 → session-state 重映射 → store 落盘，失败可重试修复）+ `pickDir`；
  - T2 [library.ts](../../../electron/project/library.ts) `workspaceRoot()` 与 [main.ts](../../../electron/main.ts) `ensureRuntime()` cwd 两处硬编码收敛到 `resolveWorkspaceRoot()`（全仓字面量仅剩 workspace 模块内部与测试夹具）；
  - T3 三条 IPC（settings:workspace:get/pick/change）+ [preload.ts](../../../electron/preload.ts) `settings.workspace` 3 键 + [global.d.ts](../../../src/global.d.ts) DTO 镜像（K1 零触发）；
  - T4 [dev-mock-api.ts](../../../src/dev-mock-api.ts) `settings.workspace` 三键（get 静态 / pick 恒 null / change 恒 reject）；
  - T5 [WorkspacePanel.tsx](../../../src/studio/shell/WorkspacePanel.tsx)（新）+ [StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx) 系统菜单「工作目录」入口与面板挂载；
  - T6 文档同步：根设计 §7.1 + v1.18 版本记录、README、设计现状与偏差清单、features/README、B 类 HTML 现状标注（架构模块关系图 / 设计 HTML），历史快照未改写。
  - T6 补全（2026-11-03，用户质询「相关 html 文档都更新了吗」后全量审计）：四份 B 类 HTML 的**当前口径指针**全部收敛到 v1.18 / 28 现行包 / 82 文件 1029 passed / 47 IPC——设计 HTML（标题、v1.18 版本时间线条目、IPC 47、测试基线、页脚）、架构模块关系图（设计基准 chip、当前基线 chip、口径指针、来源卡、页脚）、平台全景图（设计 chip、统计卡、时间线新增 2026-11-03「现在」条目并降级 11-02 条目、IPC 47、页脚）、进度看板（新包 chip、新增 11-03 再核快照、统计卡、新增「实测·11-03」卡并将 11-02 卡降为历史、来源卡、命令行基线卡、页脚）。带日期的历史快照（如「截至 2026-11-02 共有 27 个现行包」「磁盘实况 2026-11-02 · 42 IPC」）按规则保留不改写；原型 HTML 的「v1.17 规则」为规则定稿版本引用，语义仍有效，未改。
- 2026-11-03（**T7 实测**）：
  - 新增/增补测试 28 例：[workspace-store.test.ts](../../../src/test/settings/workspace-store.test.ts) 19 例（store 读取 4 + 校验分支 6 + 搬移/回滚/EXDEV/提交阶段 7 + 换回旧根 1 + 空旧根 1）+ [workspace-panel.test.tsx](../../../src/studio/shell/workspace-panel.test.tsx) 6 例 + dev-mock 三键 3 例；
  - `npm run test:run` 全量 **82 个测试文件通过，1029 passed / 1 skipped（共 1030）**（上一基线 80 文件 1001 passed，净增 28 例，failed 零扩大，唯一 skip 为需 ARK Key 的既有真机用例）；
  - 类型检查：`tsc -p tsconfig.node.json` / `tsc -p tsconfig.preload.json` 零错误（经 `npm run build:electron`）；renderer `tsc --noEmit` 恰为 3 条现存基线错误（canvas-zoom ×2、runtime-client ×1），本轮新增/修改文件零错误；
  - `git diff --check` 通过；`dist/`、`dist-electron/` 无残留（renderer 类型检查依赖的临时声明产物已清理）；
  - 未提交、未推送；红线遵守：零新依赖、shared/types.ts 零改动、不碰 brief/canvas/gate/runtime manager 逻辑。

## 三、修订记录

- （无）
