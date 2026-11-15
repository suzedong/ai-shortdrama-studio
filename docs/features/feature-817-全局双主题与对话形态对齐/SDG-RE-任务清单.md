# feature-817 任务清单

> **版本**：v1.0（2026-11-15）

| # | 任务 | 预期实测 | 状态 |
| :-- | :-- | :-- | :-- |
| T1 | 冻结基线与五文件、根设计、feature-010 C1 | 基线 typecheck 3 条；测试 91 文件/1177 例中既有 2 文件 10 失败 | ✅ |
| T2 | 全局主题首绘、顶栏开关、持久化与语义令牌 | AC1–AC3：主题 3 项自动化通过；Electron 浅色 / 深色 / 最大化截图存在；无共享类型 / IPC / 依赖改动 | ✅ |
| T3 | 真实任务详情、等待回答与回合状态 | AC4–AC5；事件顺序与流式动画保持 | 实现完成，现场验收待 |
| T4 | 分步 OptionCard、自定义、关闭/下一步、可选元数据 | AC6–AC10；chips 与门卡回归 | 实现完成，现场验收待 |
| T5 | showrunner 目标复述与协议纪律 | AC11；首问不变 | 实现完成，现场验收待 |
| T6 | 新测试与受影响旧测试更新 | 本包历史记录 `chat-minimax.test.tsx` 18 项、`studio-theme.test.tsx` 3 项通过；2026-11-15 P0 复跑为 chat 12 项、theme 3 项通过，全量仍为 2 文件 10 例既有失败 | ✅ |
| T7 | typecheck、全量测试、renderer/electron 构建 | 已执行：仅既有 3 条 typecheck 与 10 条 profile 失败；`build:electron`、独立 `vite build` 通过，`build:renderer` 被同 3 条类型错误阻断 | ⚠️ 已执行，未全绿 |
| T8 | 双主题真实界面目验与治理收尾 | AC3 双主题 Electron 现场通过；AC12 完整构建未通过。真实 AI runtime 未连接，输入、OptionCard、真实任务详情与 Gate 现场仍无通过证据；变更记录与索引已回填 | 进行中（AI runtime 受阻） |
