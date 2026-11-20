> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

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

---

## D-037 归档与迁移覆盖

> 状态含义：**已存在**＝目标包已有同义现行约束；**迁入**＝本次在 808 补写自包含章节；**保留历史**＝原任务、AC、测试计数、探针与真机证据仅在本包追溯；**被后续条款取代**＝历史口径仅作演变记录，不再作为当前入口。本包仅现存需求、任务清单、变更记录三份标准文件；缺契约、设计文件是历史档案形态，本次不补造。

| 原文件 / 章节 | 当前负责包与目标 | 状态 | 覆盖与冲突处理 |
| :-- | :-- | :-- | :-- |
| 需求 §1 背景与失败现场 | **808** 需求 §6 R37-01 / R37-02、变更 R-002 | 保留历史 + 迁入 | 原 INTERNAL 文案、错误路径、旧模板日期和 P1 阻塞事实不改；当前负责入口转为 808 的 runtime 启动与模板解析约束。 |
| 需求 §2 根因与 Electron 探针 | **808** 需求 §6 R37-01、设计 §10.1 | 迁入 + 被后续条款取代 | `app.isPackaged` 单判据已由实测后的 `app.isPackaged && !process.defaultApp` 取代；Electron 33.4.11 同时出现两个 true 的探针原文保留。 |
| 需求 §3 目标 | **808** 需求 §6 R37-01 / R37-02 | 迁入 | 开发态仓库路径、真打包 resourcesPath、模板 / 占位符显式失败及零共享 / IPC / MCP / 依赖变更均自包含登记。 |
| 需求 §4 简化契约段 | **808** 契约 §9.1 | 迁入 + 已存在 | `resolveAgentTemplatePath(file)` 签名不变；开发 / 打包路径、ENOENT / INTERNAL 与无 UI / IPC 变更成为 808 现行契约，不新增错误码或接口。 |
| 需求 §5 非目标 | **808** 设计 §10.1、需求 §6 R37-02 | 已存在 + 保留历史 | 不清理 Electron 生成物旧副本、不改写 I-003、不扩 SSE / 停止 / 工具轨迹改造的历史边界保留；旧副本不得成为开发态兜底。 |
| 需求 §6 验收入口；任务 §2 T1–T7、§3 AC-1–AC-5 | **808** 任务 C-D037-01；证据留本包 | 保留历史 + 去向登记 | T1–T7 全勾及 AC 通过状态不改；19/19、106 passed / 10 failed / 1 skipped、typecheck 与真实 Electron 结果均为当时证据，不写成 D-037 新验证。 |
| 任务 §1 改动清单与卡口核对 | **808** 契约 §9.1、变更 R-002 | 保留历史 + 已存在 | provider / 测试 / 索引三项历史改动留痕；本次纯文档归并不再修改这些文件，K1/K8/K9/K7 零触发口径不变。 |
| 变更 §1 摘要与根因 | **808** 需求 §6、设计 §10.1、变更 R-002 | 迁入 + 保留历史 | 真实 runtime 从模板错误恢复为 running / healthy 的事实保留；单判据问题按现行双条件判据登记，不回改历史叙述。 |
| 变更 §2 文件变更、§3 卡口核对 | **808** 契约 §9.1 | 保留历史 + 已存在 | 三文件变更和零卡口证据只作历史；808 承接行为约束，不借归档扩大为会话 DTO、视觉或共享类型变更。 |
| 变更 §4 验证证据 | 证据留本包；现行责任归 **808** | 保留历史 | 单测、目录级既有 10 条 frontmatter FAIL、构建、CDP 复验、23 个工具、27 条会话及证据文件路径全部保留，不归一化计数或改写 PASS/FAIL。 |
| 变更 §5 未覆盖与遗留 | **808** 需求 §6 R37-02 / R37-06；相关验收仍按原入口 | 保留历史 + 已存在 | 真实对话 prompt → SSE → 停止 → 工具轨迹仍未在本包执行，不能写成闭环；旧副本未清理及 10 条 frontmatter 基线失败继续保留。 |
| 缺失的《SDG-RE-契约.md》《SDG-OD-设计说明.md》 | **808** 契约 §9.1、设计 §10.1 | 迁入 + 保留历史 | 819 原本就是 3 文件精简档；只在 808 维护现行契约与设计，不在归档包补造缺失文件或虚构历史章节。 |

自审：已逐项覆盖 819 三份现存文件的全部章节与开放状态；模板路径修复归 808，真实 Electron 探针和验证证据保留，真实对话往返未覆盖、frontmatter 历史失败及旧副本未清理均未改写。本次仅文档归并，未运行产品测试；**自审 + 无第二人复核**。
