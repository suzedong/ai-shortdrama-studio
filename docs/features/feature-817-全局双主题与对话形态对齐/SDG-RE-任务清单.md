# feature-817 任务清单

> **版本**：v1.0（2026-11-15）

| # | 任务 | 预期实测 | 状态 |
| :-- | :-- | :-- | :-- |
| T1 | 冻结基线与五文件、根设计、feature-010 C1 | 基线 typecheck 3 条；测试 91 文件/1177 例中既有 2 文件 10 失败 | ✅ |
| T2 | 全局主题首绘、顶栏开关、持久化与语义令牌 | AC1–AC3：主题 3 项自动化通过；Electron 浅色 / 深色 / 最大化截图存在；无共享类型 / IPC / 依赖改动 | ✅ |
| T3 | 真实任务详情、等待回答与回合状态 | AC4–AC5；真实 running/completed、折叠、spinner 与回放已观察，动画语义由自动化补足 | ✅（真实 Provider） |
| T4 | 分步 OptionCard、自定义、关闭/下一步、可选元数据 | AC6–AC10 真实现场通过；AC7 同 DOM 卡失败重试与 AC9 实际协议元数据见 T11 | ✅（真实 Provider） |
| T5 | showrunner 目标复述与协议纪律 | AC11 真实目标复述、原首问及不臆造步骤/推荐通过 | ✅（真实 Provider） |
| T6 | 新测试与受影响旧测试更新 | 本包历史记录 `chat-minimax.test.tsx` 18 项、`studio-theme.test.tsx` 3 项通过；2026-11-15 P0 复跑为 chat 12 项、theme 3 项通过，全量仍为 2 文件 10 例既有失败 | ✅ |
| T7 | typecheck、全量测试、renderer/electron 构建 | 已执行：仅既有 3 条 typecheck 与 10 条 profile 失败；`build:electron`、独立 `vite build` 通过，`build:renderer` 被同 3 条类型错误阻断 | ⚠️ 已执行，未全绿 |
| T8 | 双主题真实界面目验与治理收尾 | 2026-11-26 真实 Ark 主链、Gate 返修发布、双主题与回放已补验；AC7/AC9 定向补验通过，现行 typecheck/build/全量测试通过。X-001 其余偏差确认不因本轮自动关闭 | 进行中（X-001 其余偏差确认） |

## D-037 文档归并 Change（2026-11-19）

### C-D037-01 · 对话活跃、滚动与视觉形态归并（纯文档）

- [x] 将 809 需求 §3、契约 §1–§5、设计 §1–§4 及变更记录 T7–T12 / X-001 的活跃指示、48px→120px 滚动演变与交错内容约束写入需求 §4、契约 §7、设计 D8；320ms / 40ms / reduced-motion 采用本包现行展示规则。
- [x] 将 010 需求 §3.1 / §4、契约 §3、设计 D1 / D4–D6 的 QH-C6 芯片视觉写入相同目标章节；点击与立项视图行为仍归 013，业务数据归 001。
- [x] 明确与 808 的数据 / 视觉边界；保留 T8 进行中及真实 AI runtime、OptionCard、任务详情、Gate 现场未闭环状态。

**文档 AC**：

1. 现行规格自包含说明绿色 thinking、紫色 tool、非活跃 .45、120px 上限、上滚 >2px 接管、320ms / 40ms / 4 项交错和 reduced-motion。
2. QH-C6 视觉状态与双主题令牌有归属，未改变 ChipRow 单击直发、OptionCard 或 GateCard 行为；无新接口。
3. 809 的 48px 历史值与 120px 现行值冲突已显式处理，历史任务、AC、测试计数和 FAIL/PASS 未回改。
4. 本项只完成文档归并，**自审 + 无第二人复核**；不宣称真实 AI runtime、OptionCard、任务详情或 Gate 现场验收完成。

## T9 · 中断展示与真实证据校准（2026-11-26）

- [x] 需求 §5、契约 §8 登记中断展示、人工重试和 AC13–AC16；接口唯一归 feature-808。
- [x] 运行既有 AC 定向测试并校准证据分级；真实输入、OptionCard、任务详情、Gate、协议元数据的真实 Provider 现场未执行，原 AC4–AC12/T8 开放状态不变。
- [x] 实现 interrupted 工具展示投影、孤儿恢复卡与确认重试，不改原始 ToolView/历史 DTO。
- [x] 验证 OptionCard 零自动选择、pending Gate 零自动裁决和重试阻断/单击一次。
- [ ] 真实 Provider 可用时完成真实 Electron 补验；本次受控 mock 故障注入 16/16 通过，但不能替代真实 Provider 验收。

**实测**：新增组件测试与受控真实 Electron 证据通过；最终全量 105 文件、1357 passed / 1 skipped，typecheck/build 通过。证据分类与开放项见 [2026-11-26 证据索引](../../verification/p1-2026-11-26/证据索引.md)。

## T10 · 真实 Provider 补验与同批次双击修复（2026-11-26）

- [x] 使用隔离 HOME/userData/workspace、合成项目、真实 Electron + 真实 opencode + 火山方舟 `ark-code-latest`；正式设置 IPC 加密凭据在重启后可解密，未归档密钥或 userData。
- [x] 完成真实输入、OptionCard 自定义/编号/关闭重开、Chip 直发、工具状态、Markdown、Gate 否决与返修、双主题及最终回放；AC4–AC6、AC8、AC10–AC12 通过，AC16 证据分级保持清晰。
- [x] 修复真实同批次原生双击的同步重入窗口，新增回归后 `chat-minimax.test.tsx` 17/17；修复前后真实失败/通过证据分别保存。
- [x] 保留 Gate 画幅枚举导致的 `HARNESS_VALIDATION_FAILED`，经正常对话反馈、Agent 修正和人工再批准后只发布一个 v1；重复批准被忽略。
- [ ] **AC7 开放**：真实 OptionCard 发送失败→解锁→同卡成功重试未观察；不得用自动化或 Gate 执行失败替代。
- [ ] **AC9 开放**：真实 Agent 未发出 `步骤：N/M` / `【推荐】` 协议包；只确认无元数据不臆造，元数据正向/非法值由自动化覆盖。
- [x] 校准原始驱动结果：`resume` 功能断言通过但截图超时，原始 stage 保留 failed，顶层 passed 不作为完整 AC 通过声明；真实 Ark 生成中强退本轮未复测。
- [x] 最终 `npm run test:run` 退出 0（文档检查通过，105 文件通过，1357 passed / 1 skipped / 0 failed），typecheck/build 退出 0。

**证据**：[真实 Provider 证据索引](../../verification/feature-817-real-provider-2026-11-26/证据索引.md) · [机器可读校准](../../verification/feature-817-real-provider-2026-11-26/data/acceptance-result-calibrated.json)。本项不宣称 P1 全阶段或 Feature 全量验收通过。

## T11 · AC7 / AC9 真实 Provider 定向补验（2026-11-26）

- [x] 使用隔离 HOME/userData/workspace、合成项目、克隆加密配置和真实 Electron + opencode + 火山方舟 `ark-code-latest`；未归档密钥、userData 或完整消息库。
- [x] **AC7 通过**：占用 `4096..4120` 制造真实 runtime 启动同步失败；失败前后消息均 4、runs 均 1。释放端口并点击“重新检测”后，同一 DOM OptionCard 重试新增一条用户“1”，新 run 最终 `completed`；最终消息 6、runs 2。
- [x] **AC9 通过**：真实 Agent 实际输出 `步骤：第 1/2 步` 与 `【推荐】`，步骤元数据和 1 个推荐徽标在场渲染。
- [x] 最终现场 15 项检查通过；`resume` 未收到 idle 与自动驱动等待未约定文本分别记为采集限制，不改判产品失败，也不伪造通过截图。
- [x] 本轮未修改产品代码；历史真实 Provider 与 controlled-mock 证据索引不改写。
- [x] 最终 `npm run test:run` 退出 0（文档门禁通过，105 文件通过，1358 passed / 1 skipped / 0 failed），typecheck/build 退出 0。

**边界**：本轮只关闭 AC7 / AC9；未重验 AC1 / AC4 / AC5 / AC8 / AC11，不扩大为 X-001 全部偏差确认完成。

**证据**：[817 / 808 定向补验证据索引](../../verification/feature-817-808-real-provider-recheck-2026-11-26/证据索引.md) · [脱敏结构化摘要](../../verification/feature-817-808-real-provider-recheck-2026-11-26/data/recheck-summary.json)。
