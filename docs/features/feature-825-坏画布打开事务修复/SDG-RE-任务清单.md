> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# feature-825 · 坏画布打开事务修复 — 任务清单

> 版本：v1.0（2026-11-18）｜执行顺序：T0 → T1 → T2 → T3 → T4 → T5

- [x] T0 核对 F824-01 与当前 `project:open` / `openProject` / `CanvasStore` 顺序，确认当前源码存在吞错分支；建立五文件包并冻结 AC-825-1—6。
- [x] T1 新增主进程真实 handler 回归：A → 坏 G 必须 reject，双项目 session/currentDir 不变，门/reset/广播零副作用；先在未修代码上取得失败证据。
- [x] T2 实现显式根目录只读画布预检与 `openProject` 提交前 guard，主进程接入；保持路径/manifest 校验优先级和正常打开顺序。
- [x] T3 补正常 B、缺失 canvas、projectId 失配及必要 Renderer 回归；运行定向测试、相关套件、typecheck 与 build，单列既有失败。
- [x] T4 重新编译主进程，在独立 feature-825 工作区执行真实 Electron：A → 坏 G 失败保持 A，错误可见且哈希不变；再打开 B 验证标题、会话、canvas 与 DOM 一致，保存机器证据和截图。
- [x] T5 证据哈希复核，勾选验收项；闭环 B-71 与既有索引/调查记录，核对 shared/preload/dev-mock/MCP/依赖零 diff，复核工作树且不提交 Git。

完成定义：AC-825-1—6 均有对应自动化或真机证据；未执行项目不得写通过。B-70 保持独立，feature-824 历史失败证据不改写。

## 验收结论（2026-11-18）

AC-825-1—6 全部通过。定向 5 文件 / 42 项、typecheck、生产 build 通过；全量仍仅 B-70 的 10 文件 / 75 项失败。真实 Electron 最终 `runCompleted=true`、`ok=true`，证据为 `docs/verification/p1-2026-11-15/p1-after-825-electron.json` 及同目录两张 F825 截图。B-71 已闭环，feature-824 历史结论、P1 退出门和完整 Parity 状态不改写。
