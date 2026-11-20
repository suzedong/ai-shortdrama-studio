> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# SDG-RE-任务清单 · feature-819 Agent 运行时模板解析修复

## 1. 改动清单

| # | 文件 | 动作 | 说明 |
| --- | --- | --- | --- |
| 1 | `electron/runtime/provider.ts` | 修改 | `resolveAgentTemplatePath` 环境判据改为 `app.isPackaged && !process.defaultApp`；注释登记 2026-11-15 实测结论 |
| 2 | `src/test/runtime/runtime-provider.test.ts` | 修改 | 新增「开发态 isPackaged 误报 true」回归用例；保持既有打包态用例通过 |
| 3 | `docs/features/README.md` | 修改 | 8xx 表新增 feature-819 行 |

> 触发卡口核对：K1（`shared/types.ts`）零触发；K8（IPC/MCP）零触发；K9（依赖）零触发；K7 无。

## 2. 任务与验收

- [x] T1 读取 `provider.ts` 模板解析与 profile 安装链，确认失败点为 `renderAgentFile → resolveAgentTemplatePath`。
- [x] T2 用隔离 Electron 探针实测 `app.isPackaged` / `process.defaultApp`，确认根因。
- [x] T3 修正环境判据，保留打包态分支与既有报错。
- [x] T4 新增回归用例：`isPackaged=true` 且 `process.defaultApp=true` 时仍返回仓库模板路径。
- [x] T5 运行 `npx vitest run src/test/runtime` 与 `npm run typecheck`。
- [x] T6 真实 Electron 复验：`runtime.start` 不再报占位符错误，`runtime.status` 不再为模板错误。
- [x] T7 更新索引与 P1 调查记录的阻塞状态指向。

## 3. 验收标准（AC）

| 编号 | 判据 | 结果 |
| --- | --- | --- |
| AC-1 | 开发态 `electron .` 下 `runtime.start` 成功，或失败原因**不再是**模板占位符 | ✅ 通过：`state: running`，模板错误消失 |
| AC-2 | `runtime.status` 返回 `healthy: true`，错误体为 `null` | ✅ 通过 |
| AC-3 | 新增回归用例在修复前失败、修复后通过 | ✅ 通过（修复前 `isPackaged=true` 会返回 resourcesPath，用例断言仓库路径） |
| AC-4 | 既有 `src/test/runtime` 用例无**新增**失败；`npm run typecheck` 无错误 | ✅ 通过：`runtime-provider.test.ts` 19/19；目录级 106 passed / 10 failed（10 条为既有 frontmatter 基线失败，与本包无关）；typecheck exit 0 |
| AC-5 | `shared/types.ts`、preload、IPC/MCP、`package.json` 零 diff | ✅ 通过：`git status` 无相关文件改动 |

> 说明：AC-1/AC-2 复验见 [P1 调查记录 §3-⑤ 补记](../../verification/p1-2026-11-15/P1调查记录.md)。
