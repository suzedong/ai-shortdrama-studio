> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# feature-826 · 谱系测试基线收口 — 契约

> 版本：v1.1（2026-11-18，全量回归后增补两份同根因测试）｜需求：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)

## 1. 测试语义契约

版本号不得按字符串全局替换，必须按用例目的分类：

| 语义 | 处理 |
|---|---|
| 当前正式谱系版本、当前合法草案引用 | 对齐真实资源 v1.47 |
| 真实资源 changelog | 断言 v1.47 与 v1.46 的真实条目及顺序 |
| 历史升级/历史发布/静态历史数据 | 保留原版本区间；需要当前合法发布基线时仅调整共享起点，不改历史断言目的 |
| 合成版本升级区间 | 使用独立夹具明确版本头与 changelog，避免依赖或复制真实当前版本 |
| 故意错误版本、未知 ID、非法枚举 | 保留失配及错误码验证 |
| dev-mock 与演示数据 | 不在本包修改 |

所有原有 Harness、发布、影响评估、门态、幂等、零写盘、故障注入与补偿断言必须继续存在且有效。

## 2. 文件与写权

| 文件 | 允许修改 |
|---|---|
| `src/test/style/style-catalog.test.ts` | 当前版本、合法引用与真实 loader 断言；保留负向用例 |
| `src/test/style/style-upgrade.test.ts` | 当前空态/合法基线、真实 changelog、独立合成升级夹具与区间断言 |
| `src/test/brief/brief-update.test.ts` | 当前合法草案共享基线；历史采纳语义仅按测试目的最小调整 |
| `src/test/gate/gate-execute.test.ts` | 当前合法 `DRAFT` 基线；非法风格用例保持负向 |
| `src/test/harness/harness-validate.test.ts` | 全合规草案及有效主体基线；降级与非法版本用例不变 |
| `src/test/mcp/mcp-style-tools.test.ts` | 当前注册版本与合法引用；错误信封和 mismatch 不变 |
| `src/test/mcp/mcp-brief-harness-gate.test.ts` | 正常发布共享草案基线；门/Harness 防护不变 |
| `src/test/mcp/mcp-brief-impact-tools.test.ts` | 正常 assess/publish/commit 共享草案基线；顺序与影响语义不变 |
| `src/test/mcp/mcp-brief-gate-guard.test.ts` | 仅当前合法共享草案基线；pending/rejected/approved 门优先级与零写盘不变 |
| `src/test/mcp/mcp-brief-tools.test.ts` | 仅当前合法共享草案基线；口头拍板、版本递增、幂等与 diff 语义不变 |
| 本包五文件 | 规格、实施、验证与变更事实 |
| `docs/设计现状与偏差清单.md` | 全量恢复后仅闭环 B-70，其他偏差不重排、不复用 |
| `docs/features/README.md` | 新增 feature-826 索引并据实更新 B-70 当前状态 |

`src/test/brief/brief.test.ts`、`src/test/brief/brief-rollback.test.ts` 为专项回归只读基线，默认零 diff。禁止修改其他测试、正式谱系资源、产品代码、A 类总计划/Parity 矩阵、历史验收证据及工作树既有修改。

## 3. 验证命令契约

1. 十个目标文件一次性定向 Vitest，保留完整通过/失败统计。
2. 全量 `npx vitest run`。
3. `npm run typecheck`。

只有三步均完成且结果支持时，才能勾选 AC-826-4 并闭环 B-70。额外失败不得以“历史问题”为由跳过定位。

## 4. 决策卡口预判

- K1：零触发；`shared/types.ts` 零 diff。
- K8：零触发；无 IPC/MCP/preload/DTO 变更，仅修测试夹具。
- K9：零触发；零新依赖。
- K7：零触发；不修改 A 类阶段状态或 Parity 矩阵。

若实施必须超出上述写权，先暂停并呈报，不直接扩权。
