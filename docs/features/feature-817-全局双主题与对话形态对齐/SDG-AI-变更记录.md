# feature-817 变更记录

## D 节 · 决策留痕

### D-001 范围与建包（2026-11-15）

- 用户要求按 MiniMax Design 截图设计对话界面，拍板“真实形态对齐”，不使用静态演示业务数据。
- 保留 feature-001 的“商业短剧/个人纪念”首问；截图中的题材问题不是本项目首问。
- 深色是主题之一，切换范围为整个工作台；默认浅色并持久化。
- 任务状态只来自流、ToolView、未消费选项与 pendingGate；不虚构需求分析/项目规划/1-3。
- 新包编号 817；K2 留痕。预计 K1/K8/K9 不触发：零共享类型、零 IPC、零运行时事件与依赖变更。

## T 节 · 任务实测

### T1 基线与规格（2026-11-15）

- `npm run typecheck`：exit 2，恰 3 条既有错误——`canvas-zoom.test.tsx` TS2322 L13、TS6133 L90；`runtime-client.test.ts` TS2741 L45。
- `npm run test:run`：91 文件，89 passed / 2 failed；1177 例，1166 passed / 10 failed / 1 skipped。失败仅 `agent-profile-install.test.ts` 1 例与 `agent-profiles.test.ts` 9 例，均为既有 frontmatter/CRLF 校验。
- 已冻结需求、OD、契约、任务清单；根设计与 feature-010 C1 同步见实际 diff。

## T 节 · 实现、自动化、真机证据与 P0 校准（2026-11-15）

- **实现范围**：全局浅色 / 深色主题、主题首绘与持久化、MiniMax 真实任务详情、分步选项卡与自定义回答实现均已落地；本轮 P0 只回填任务清单、变更记录和总索引，未再修改产品代码。
- **本包自动化**：本包早期记录 `chat-minimax.test.tsx` **18/18**、`studio-theme.test.tsx` **3/3** 通过；2026-11-15 P0 复跑原始日志为 chat **12/12**、theme **3/3** 通过，早期数量作为历史记录保留，当前以复跑日志为准。全量为 **91/93 文件通过，1181 passed / 10 failed / 1 skipped**；失败仍仅为 `agent-profile-install.test.ts` 1 例与 `agent-profiles.test.ts` 9 例，未新增本包失败。原始证据：`../../verification/p0-2026-11-15/test-run.log`；旧报告与本次日志的细节差异见同目录 P0 基线报告。
- **类型与构建**：`npm run typecheck` 恰有 3 条既有测试类型错误，位于 `canvas-zoom.test.tsx` 2 条与 `runtime-client.test.ts` 1 条；`npm run build:renderer` 因同一类型检查前置步骤退出 1，不能写成完整 Renderer 构建通过。`npm run build:electron` 退出 0，独立 `npx vite build` 退出 0，Vite 保留主包大于 500 kB 警告。证据见同目录 `typecheck.log`、`build-renderer.log`、`build-electron.log`、`vite-build.log`。
- **Electron 现场**：浅色 `evidence/electron-light-1440x900.jpg`、深色 `evidence/electron-dark-1440x900.jpg`、浅色最大化 `evidence/electron-light-maximized.jpg` 均已存在，支持 AC3 双主题视觉验收；截图不证明真实 AI 对话全链通过。
- **未通过项**：真实 AI runtime 未连接，输入、OptionCard 选择 / 自定义发送、真实任务详情与 Gate 的现场交互仍无通过证据；AC4—AC11 与 AC12 保持未勾，T8 保持进行中。不得借用 feature-815 的 `__MODEL_REF__` 根因替代本包诊断。
- **边界**：未修改 `shared/types.ts`、IPC、依赖或 package/lockfile，未自动批准 K1/K8/K9，未创建 Git commit；既有类型与 Agent profile 基线问题未越权修复。

## X 节 · 修复留痕

既有 profile 与 typecheck 基线不在本包修复；其余问题按实际修复追加，未发生的事项不预写。

## R 节 · 修订留痕

### R-001 · D-037 对话活跃、滚动与视觉形态归并（2026-11-19，纯文档）

- **来源 → 目标章节**：809 需求 §3、契约 §1–§5、设计 §1–§4 与变更记录 T7–T12 / X-001 → 本包需求 §4、契约 §7、设计 D8；010 需求 §3.1 / §4、契约 §3、设计 D1 / D4–D6 的 QH-C6 芯片视觉 → 同上。010 的芯片业务数据归 001、点击及立项视图行为归 013，reasoning / 回放数据归 808，均不迁入本包。
- **归并内容**：thinking / tool 分色活跃、非活跃透明度、任务详情折叠时标题活跃、120px 跟随与 >2px 用户接管、320ms 外壳与最多 4 项 / 40ms 交错、reduced-motion，以及 QH-C6 默认 / 选中 / 禁用 / 焦点视觉。
- **冲突处理**：809 历史 48px 被后续 120px 方案取代；817 spinner 与 809 阶段动画并存但均须来自真实状态。归档原文、历史 AC 与测试证据不改。
- **开放状态**：双主题现场通过保留；真实 AI runtime、OptionCard、真实任务详情与 Gate 现场未全闭环，T8 仍进行中。本次未补任何真机证据。
- **变更性质与验证**：无新接口、无代码 / 测试 / 依赖 / 真实项目数据改动；完成来源、目标、冲突与开放状态自审，**自审 + 无第二人复核**。
