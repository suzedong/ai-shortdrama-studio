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

### D-002 运行中断展示与证据校准（2026-11-26）

用户批准在 808/817 落地运行中断恢复。本包只消费 808 的 K8 接口并负责 interrupted 展示投影、孤儿恢复卡和显式重试交互；不重复定义 IPC，不新增共享类型、依赖或视觉需求。既有 Shift+Enter 行为无缺陷，不虚构修复。

### T-IR 实施与验证（2026-11-26，已完成；真实 Provider 现场仍开放）

- **实现与自动化**：interrupted 工具 UI 投影、孤儿恢复卡、OptionCard/Gate 保留、Gate 阻断及人工重试已接线；组件测试和最终全量测试通过。全量为 105 文件通过，1357 passed / 1 skipped / 0 failed；typecheck/build 退出 0。
- **受控 Electron**：真实 Electron + 真实 opencode + 受控 `mock/mock-1` 定向故障注入 16/16 通过，证明重启零自动选择/裁决/重试、消息与 Gate/产物保留、人工重试新 ID/血缘和双击去重；`realProviderAcceptance=false`。
- **证据校准**：自动化、受控 Electron 与既有真实界面截图分级归档于 [证据索引](../../verification/p1-2026-11-26/证据索引.md)。真实 Provider 的输入、OptionCard、真实任务详情、Gate 与协议元数据现场仍未完成，AC4–AC12/T8 不据此勾选。

### D-003 真实 Provider 补验与 OptionCard 同步提交锁（2026-11-26）

- **真实环境**：使用隔离 HOME/userData/workspace 和合成测试项目，以真实 Electron + 真实 opencode + 火山方舟 Agent Plan（`ark-code-latest`）完成正常对话主链。凭据只经正式设置 IPC 加密保存并验证重启可解密，未进入证据归档。
- **缺陷与最小修复**：真实同批次原生双击暴露 React `submitting` 尚未来得及提交时第二个 runtime 请求进入，返回 `INTERNAL 当前会话仍有活跃运行`。`ChatComposer.tsx` 增加同步 ref 提交锁，与既有状态锁共同在 `onPick` 前阻断重入；`chat-minimax.test.tsx` 新增原生双击回归。这是既有 R4/AC7 缺陷修复，不新增 Feature、契约、IPC、共享类型或依赖。
- **真实通过范围**：自定义 trim、关闭/重开、编号暂存与下一步、Chip 单击直发、工具 running/completed 与折叠、Markdown、Gate 否决/返修、双主题和正常重启回放均有真实现场。AC4–AC6、AC8、AC10–AC12 通过；AC16 继续区分真实 Ark 回放与历史 controlled-mock SIGKILL 证据。
- **真实 Gate 失败与恢复**：首次发布被 `HARNESS_VALIDATION_FAILED / SPEC_FIELD_ENUM / fiveElements.aspectRatio` 拦截，非法值为 `9:16竖屏`，未发布版本。失败证据单独保留；经正常对话由 Agent 修正为 `竖屏 9:16` 后重挂 Gate，再由人工批准发布唯一 v1。重复批准为 `ignored=true`，不新增消息或版本。
- **开放与采集限制**：AC7 的真实发送失败→解锁→同卡成功重试未观察；AC9 的真实 `步骤：N/M` / `【推荐】` 元数据包未出现，只验证“无元数据不臆造”，正向/非法值由自动化支持。`resume` 功能断言通过但最终 CDP 截图超时，原始 stage 保留 failed，不伪造 `09-resume-response.png`。真实 Ark 生成中强退本轮未复测。
- **最终验证**：`chat-minimax.test.tsx` 17/17；`npm run test:run` 退出 0，文档检查通过，105 文件通过，1357 passed / 1 skipped / 0 failed；typecheck/build 退出 0，只有既有 chunk-size 警告。
- **证据**：独立真实 Provider 映射见 [证据索引](../../verification/feature-817-real-provider-2026-11-26/证据索引.md) 与 [校准结果](../../verification/feature-817-real-provider-2026-11-26/data/acceptance-result-calibrated.json)。历史 P1 索引未改写；归档不含密钥、真实用户项目、加密 userData 或完整原始消息库。

### D-004 AC7 / AC9 真实 Provider 定向补验（2026-11-26）

- **真实环境**：沿用隔离 HOME/userData/workspace、合成项目与克隆加密配置，运行真实 Electron + opencode + 火山方舟 `ark-code-latest`；未修改产品代码。
- **AC7 通过**：占用 `4096..4120` 使真实 runtime 启动同步失败，失败前后消息均 4、runs 均 1。释放端口、点击“重新检测”清除 `aiDown` 后，同一 DOM OptionCard 重试新增一条用户“1”；新 run 最终 `completed`，最终消息 6、runs 2。
- **AC9 通过**：真实输出实际包含 `步骤：第 1/2 步` 和 `【推荐】`，页面渲染步骤元数据及 1 个推荐徽标，不再只有“无元数据不臆造”的反向证据。
- **采集限制**：`resume` 回合未收到 idle，但独立 harness 显示 runtime `stopped`、run `completed`、`busy=false`、部分正文 6290 字符，UI 仍显示 running；自动 resume 驱动另等待了未约定的 `data` 文本。两项均记为采集限制，不改判产品失败，也不以自动断言替代人工重试证据。
- **范围**：仅关闭 AC7 / AC9；本轮未重验 AC1 / AC4 / AC5 / AC8 / AC11，不据此宣称 X-001 全部偏差确认、Feature 或 P1 全阶段验收完成。
- **最终验证**：`npm run test:run` 退出 0，文档门禁通过，105 文件通过，1358 passed / 1 skipped / 0 failed；typecheck/build 退出 0，只有既有 chunk-size 警告。并行首跑 `test:run` 曾因两套 Vitest 争用 `127.0.0.1:4099` 出现 `EADDRINUSE`，单独复跑通过，属于本轮采集端口竞争。
- **证据**：新增 [定向补验证据索引](../../verification/feature-817-808-real-provider-recheck-2026-11-26/证据索引.md) 与 [脱敏结构化摘要](../../verification/feature-817-808-real-provider-recheck-2026-11-26/data/recheck-summary.json)；历史索引不改写，归档不含密钥、userData、完整消息库或整个 `.test-tmp`。
