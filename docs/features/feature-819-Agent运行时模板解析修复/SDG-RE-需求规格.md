> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# SDG-RE-需求规格 · feature-819 Agent 运行时模板解析修复

> 档案类型：3 文件精简档（同时满足：改动 ≤3 文件、无接口/契约变更、不触发 K 卡口、工作量 ≤3 人日）
> 溯源标签：**[自研新增]**
> 上游证据：[P1 调查记录](../../verification/p1-2026-11-15/P1调查记录.md) §3-⑤、[MiniMax Design全面复刻开发计划](../../research/MiniMax%20Design全面复刻开发计划.md) §0「当前唯一优先动作」

## 1. 背景与问题

真实 Electron 环境中，AI 运行时启动失败，P1「真实对话」整条验收被阻塞。主进程原文：

```
runtime:start → INTERNAL: showrunner.md 模板缺少 __MODEL_REF__ 占位符：
D:\Code\ai-shortdrama-studio\node_modules\electron\dist\resources\opencode\agents\showrunner.md
```

- 仓库模板 `resources/opencode/agents/showrunner.md`（2026-11-15）第 4 行为 `model: __MODEL_REF__`；
- 实际被读取的是 `node_modules/electron/dist/resources/opencode/agents/showrunner.md`（2026-10-28），`model: ark/__ARK_MODEL_ID__`，不含占位符。

## 2. 根因（已实测，非推测）

`electron/runtime/provider.ts` 以 `app.isPackaged` 作为「打包态 / 开发态」判据（2026-10-05 I-003 结论）。
本机 Electron 33.4.11 实测（隔离探针，不改产品代码）：

```json
{"isPackaged": true, "defaultApp": true,
 "resourcesPath": "D:\\Code\\ai-shortdrama-studio\\node_modules\\electron\\dist\\resources",
 "argv": ["...\\electron.exe", "<appdir>"]}
```

即：**以 `electron <appdir>` 方式启动时 `app.isPackaged` 仍返回 `true`**，与 I-003 的前提相反。于是开发态也走打包分支，读取 `process.resourcesPath`（Electron 包内残留的旧副本），命中缺占位符的过期模板。

## 3. 目标

1. 开发态（`electron .`）解析 agent 模板时，必须命中**仓库** `resources/opencode/agents/<file>`。
2. 真打包态仍解析 `process.resourcesPath/opencode/agents/<file>`。
3. 运行时可正常启动，真实会话可用；模板占位符缺失时仍保留现有明确报错，不得静默降级。
4. 不改变 `shared/types.ts`、IPC/MCP 契约、依赖。

## 4. 简化契约段（接口 / 字段 / 异常）

| 项 | 约定 |
| --- | --- |
| 函数签名 | `resolveAgentTemplatePath(file: string): Promise<string>` 不变 |
| 环境判据 | 打包态 = `app.isPackaged && !process.defaultApp`；`process.defaultApp` 为真时一律按开发态解析 |
| 返回路径（开发态） | 仓库 `<root>/resources/opencode/agents/<file>` |
| 返回路径（打包态） | `process.resourcesPath/opencode/agents/<file>` |
| 异常 | 模板不存在 → 沿用现有 ENOENT；占位符缺失 → 沿用现有 `INTERNAL` 文案，不新增错误码 |
| UI / IPC | 无新增或变更 |

## 5. 非目标

- 不清理 `node_modules/electron/dist/resources` 下的历史副本（属生成物，不在源码治理面）。
- 不改写 I-003 当时的历史记录，仅在代码注释中登记 2026-11-15 的新实测结论。
- 不做运行时其他启动链改造；SSE / 停止 / 工具轨迹在本包仅做回归验证，不改实现。

## 6. 验收口径

见 [SDG-RE-任务清单.md](./SDG-RE-任务清单.md) AC-1—AC-5。
