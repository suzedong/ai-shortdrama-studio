# SDG-AI-变更记录 · feature-819 Agent 运行时模板解析修复

## 1. 变更摘要

| 日期 | 变更 | 触发 | 结果 |
| --- | --- | --- | --- |
| 2026-11-15 | 修正 agent profile 模板的「打包态 / 开发态」判据 | P1 调查发现真实 AI runtime 无法启动 | 真实 Electron 下运行时 `state: running / healthy: true`，模板占位符错误消失 |

**根因**：`electron/runtime/provider.ts` 以 `app.isPackaged` 判定环境。2026-11-15 用隔离 Electron 探针实测 Electron 33.4.11：`electron <appdir>` 启动时 `isPackaged` 与 `defaultApp` 同时为 `true`，导致开发态走打包分支，读取 `node_modules/electron/dist/resources/opencode/agents/showrunner.md`（2026-10-28 旧副本，`model: ark/__ARK_MODEL_ID__`），缺少 `__MODEL_REF__`。

## 2. 文件变更（3 个）

| 文件 | 变更 |
| --- | --- |
| `electron/runtime/provider.ts` | `resolveAgentTemplatePath` 判据由 `if (app.isPackaged)` 改为 `if (app.isPackaged && !process.defaultApp)`；注释登记 2026-11-15 实测结论，保留原 I-003 历史语义 |
| `src/test/runtime/runtime-provider.test.ts` | 新增回归用例「开发态 isPackaged 误报 true（Electron 33 实测）：仍定位仓库 resources/」，断言返回仓库路径且模板含 `__MODEL_REF__` |
| `docs/features/README.md` | 8xx 表登记 feature-819 |

## 3. 卡口核对

| 卡口 | 结论 |
| --- | --- |
| K1 `shared/types.ts` | 零触发（无 diff） |
| K8 IPC/MCP | 零触发（无新增/变更 IPC 与工具） |
| K9 依赖 | 零触发（`package.json` 无 diff） |
| K7 方向性 | 不涉及 |

## 4. 验证证据

| 项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 单测（本包） | `npx vitest run src/test/runtime/runtime-provider.test.ts` | 19 passed / 0 failed |
| 单测（runtime 目录） | `npx vitest run src/test/runtime` | 106 passed / 10 failed / 1 skipped；10 条全为**既有基线失败**：`agent-profiles.test.ts`(9) 与 `agent-profile-install.test.ts`(1)，均为 `缺少 frontmatter 围栏`（Windows 换行导致的既有问题，与本包改动文件无关） |
| 类型检查 | `npm run typecheck` | exit 0 |
| 主进程构建 | `npm run build:electron` | exit 0 |
| 真实 Electron 复验 | `electron . --disable-gpu --remote-debugging-port=9222` + CDP 调 `runtime.start/status/listAgents/listSessions` | `state: running`、`healthy: true`、`version: 1.18.34`、`error: null`；showrunner 挂载 23 个工具，模型 `ark/ark-code-latest`；会话列表返回 27 条；输入框恢复可用（占位 `描述创作目标，或 / 唤起 Skill…`） |

证据文件：

- [p1-after-819-runtime.json](../../verification/p1-2026-11-15/p1-after-819-runtime.json)（运行时状态、agents、sessions 原文）
- [electron-after-819.err.log](../../verification/p1-2026-11-15/electron-after-819.err.log)（主进程日志：无 runtime 错误，仅 DevTools Autofill 噪声）

## 5. 未覆盖与遗留

- **真实对话往返（prompt → SSE → 停止 → 工具轨迹）未在本包执行**：单次真实推理会产生 Ark 调用费用并可能写入项目产物，留待 P1 对话验收单独执行并留存证据。
- `node_modules/electron/dist/resources/opencode/agents/` 下的 2026-10-28 旧副本未删除（生成物，不在源码治理面）；修复后开发态不再读取它们，打包态由 extraResources 覆盖。
- 既有 10 条 frontmatter 测试基线失败未在本包处理，仍按 P0 基线口径单列。
- 未创建 Git commit。
