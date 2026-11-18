# feature-822 · 变更记录

## 2026-11-17 · 独立建包与卡口裁决

- 分类：结构性接口契约（已批准，尚未实施）。
- 建立标准 5 文件任务包；按最大现有编号 +1 登记为 `feature-822`，对应 P1 切片 D 与 Parity 影响矩阵 §2.2 / §2.3 的资产引用行。
- 现状证据：输入区「资产」按钮无行为；`runtime.promptAsync` 只构造 text part；`runtime:session:messages` 当前丢弃 file parts。只复制路径文本不满足 Parity，不采用零契约的伪引用方案。
- **K1 裁决：零触发**。结构化类型仅写 main / renderer 镜像文件，不修改 `shared/types.ts`、资产索引或其他共享持久化格式。
- **K8 裁决：用户已批准最小扩展**。仅扩展 `runtime:prompt` 输入与 `runtime:session:messages` 回放 DTO，0 条新增 IPC 路由；main / preload / `global.d.ts` / dev-mock 同步。
- **K9 裁决：零触发**。不新增依赖，不修改 package/lockfile。
- 安全边界：renderer 只提交资产 ID；main 在当前活动项目索引和沙箱内解析真实文件并构造原生 file parts；回放仅返回安全元数据，不透传绝对路径、文件 URL 或媒体内容。
- 本轮仅建包、裁决与文档登记，**未修改产品代码、未运行实施验收、未创建 Git commit**。后续实现仍须按任务清单逐项留证，不得提前宣称切片 D、切片 E 或 P1 通过。

## 文档登记

- 已登记 Feature 总表，现行 37 包；本包状态为已建包 / 最小 K8 已批 / 待实施 / 未验收。
- 已更新 Parity 影响矩阵 v1.6 的 §2.2「`@`、`/`、附件与结果引用」及 §2.3「对话 / 画布显式引用资产」行，均未标通过。
- 已在 P1 调查记录追加 §9 建包与卡口补记，并同步总体规划 v0.8 与文档地图；切片 D 和 P1 继续保持未闭环。

## 2026-11-17 · 实施与切片 D 验收

- 分类：结构性接口契约的已批准实施 + 逻辑实现；K1/K9 零触发，K8 未新增路由。
- 完成 T1—T8：renderer 仅提交 `assetId`，main 从当前项目索引复核并构造原生 file parts；资产选择/chip、缺失降级、项目与会话竞态、失败脱敏、dev-mock 和安全回放均已落地。
- 空 `assetRefs` 完全复用旧纯文本路径；未修改 `shared/types.ts`、资产索引、依赖或 lockfile，未自动绑定画布。
- 根据真实 SQLite 证据最小修正回放：opencode 1.18.34 将图片转为 data URL 并插入 synthetic Read；严格配对后恢复 chip，辅助 Read 不透传，旧 file URL 回放不变。
- 验证：切片 D 专项 `7 files / 122 tests`、真实 opencode 集成 `8 tests`、旧功能回归 `4 files / 62 tests` 全通过；typecheck 与 Renderer/Electron 构建通过。
- 全量 Vitest：`84/94 files` 通过，`1170 passed / 75 failed / 1 skipped`；10 个失败文件、75 项失败均属既有 B-70，无本切片新增失败。
- 隔离 Electron 已完成真实 IPC → opencode serve → SQLite native parts → 完整退出重启 chip 回放，机器证据：[p1-after-822-electron.json](../../verification/p1-2026-11-15/p1-after-822-electron.json)。
- 只声明切片 D 验收通过；生产模型媒体语义、切片 E 与整个 P1 不在本次通过结论内。未创建 Git commit。
