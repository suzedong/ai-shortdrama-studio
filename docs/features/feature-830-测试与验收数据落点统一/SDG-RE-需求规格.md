# feature-830 · 测试与验收数据落点统一 — 需求规格

> 状态：✅ 已落地（2026-11-19 用户拍板并实施；全量 102 文件 1315 passed / 1 skipped / 0 failed）
> 上游：[D-035](../../governance/SDG-AI-决策台账-2026.md) / [D-036](../../governance/SDG-AI-决策台账-2026.md) P1 验收口径、[P1 调查记录](../../verification/p1-2026-11-15/P1调查记录.md) §11.2、根设计 [§7.2](../../../短剧Agent平台设计.md)
> 范围：**只新增环境与工具能力，不翻案既有验收结论**。旧的 `/tmp/ai-shortdrama-*` 隔离沙箱仍作为历史取证方式有效；本包新增「真实工作区验收」模式。

## 1. 背景与问题

根设计 §7.2 现行表格把数据落点分三处：真机 `~/Documents/ai-shortdrama-studio/`、Vitest `/var/folders/<hash>/T/asd-*`、P1/P2 验收 `/tmp/ai-shortdrama-<feature>.<rand>/`。用户 2026-11-19 拍板两点：

1. **真机验收也要用 `~/Documents/ai-shortdrama-studio/`** —— 隔离沙箱验证不了真实工作区路径下的读写、迁移与恢复行为。
2. **Vitest 单测临时目录换个地方** —— 不要散落在系统临时目录、难以定位与清理。

## 2. 用户拍板（2026-11-19）

| # | 决策 | 口径 |
| --- | --- | --- |
| D1 | 真机验收档位 | **真实工作区 + 隔离配置**：工作区用真实根 `~/Documents/ai-shortdrama-studio/`；userData 仍隔离，避免污染 AI 服务配置 / opencode 会话 / ComfyUI 实例。 |
| D2 | 验收安全前置 | 验收前备份真实工作区；夹具统一 `project-accept-*` 前缀；断言不触碰现有真项目（尤其 `project-20261104-092720-gv9u`）；验收脚本进仓库可复现。 |
| D3 | 单测新位置 | 仓库内 `.test-tmp/`（加入 `.gitignore`），由 `ASD_TEST_TMP` 环境变量可覆盖。 |

## 3. 验收标准（AC）

| # | 标准 | 验证方式 |
| --- | --- | --- |
| AC1 | 不设置任何环境变量时，`npm run dev` / `npm start` 的 userData 与工作区行为**与改动前完全一致** | 代码审查 + 现有全量测试 0 新增失败 |
| AC2 | Vitest 全部 `os.tmpdir()` 调用返回 `<repo>/.test-tmp/`（或 `ASD_TEST_TMP` 指定值），39 个测试文件零改动 | 新增契约测试 + 抽样跑套件后检查磁盘落点 |
| AC3 | `.test-tmp/` 被 `.gitignore` 忽略，`git status` 不出现测试残留 | `git check-ignore` |
| AC4 | 设置 `ASD_USER_DATA=/path` 启动时，主进程 `app.getPath('userData')` 返回该路径；`documents` 仍为真实用户目录，故工作区根为真实 `~/Documents/ai-shortdrama-studio/` | 主进程单测（`app.setPath` 调用断言）+ 代码审查 |
| AC5 | 验收环境准备器只备份、不删除；夹具名非 `project-accept-*` 一律拒绝；输出备份路径与隔离 userData 清单 | 准备器单测（含拒绝用例） |
| AC6 | 根设计 §7.2、README、变更记录同步新落点口径；不升根设计版本号（无设计决策变更） | 文档核对 |
| AC7 | `npx tsc --noEmit` 零新增错误；全量 vitest 0 failed（WorkBuddy 沙箱内按契约 §1.3 用 `ASD_TEST_TMP` 覆盖到系统临时目录执行，普通终端可直接用默认配置） | 命令行 |

## 4. 非目标（明确不做）

- **不**把现有 `/tmp/sdg828-*.cjs` 一次性取证 harness 全量搬迁进仓库（它们是历史证据脚本）；本包只提供可复用的环境准备器。
- **不**修改 P1 调查记录 §11.2「不触真实用户项目」的历史结论，也不推翻 D-035 / D-036 的验收判定。
- **不**默认改变真机用户的默认工作区；`changeDir` 约束（新根不得位于当前根内）不变。
- **不**自动删除任何真实工作区文件、验收夹具或备份；清理须人工逐项确认。
- **不**触碰 `shared/types.ts`、IPC 通道、preload、MCP 工具、`package.json` 依赖。

## 5. 风险与护栏

| 风险 | 护栏 |
| --- | --- |
| 验收夹具含 `bad-canvas` / `bad-manifest` / 越界 / SIGKILL，跑在真实工作区会让真实应用打不开 | 夹具统一 `project-accept-*` 前缀；准备器拒绝其他名字；断言 `currentDir` 不指向损坏档；验收前备份整个工作区 |
| 验收污染真实项目 | 准备器只读枚举现有项目并打印清单，禁止对非 `project-accept-*` 目录写入；`ASD_USER_DATA` 隔离配置与会话 |
| 重定向 `os.tmpdir()` 影响路径逃逸 / 沙箱语义断言 | 采用 `process.env.TMPDIR` 覆盖（Node `os.tmpdir()` 每次调用读取 env），不改 `os` 模块、不 mock；全量回归验证 |
| 生产包被环境变量强制改 userData | `ASD_USER_DATA` 为显式 opt-in，未设置零行为变化；文档注明仅验收 / 开发使用 |

## D-037 现行归并约束：通用测试门禁与测试数据原则（2026-11-19）

本节自包含接收 feature-818 的工程验证门槛和 feature-826 的测试基线原则；feature-826 的谱系业务语义归 feature-802，不随通用门禁迁入本包。

1. **先复现、后最小修复、再回归**：缺陷/基线修复须记录实际失败或错误，禁止通过删除用例、放宽断言、机械替换版本或把新失败统称「历史问题」来修绿。修复范围应与根因一致。
2. **通用门禁**：相关变更先跑定向测试，再跑全量 `npx vitest run` 与 `npm run typecheck`；影响 Renderer 类型/构建时还须运行完整 `npm run build:renderer`。其他构建、真机或媒体门禁由负责 Feature 明示，不能以其中一项通过替代全部适用门禁。
3. **结果据实**：记录命令、退出码和实际文件/用例统计；历史数字只证明当时基线，不是后续包必须复写的固定目标。未执行、失败或环境受阻须原样保留，不得预写通过。
4. **测试数据分流**：代表「当前真实资源」的测试读取当前事实源；历史区间、升级/diff/回滚等使用独立合成夹具，不篡改真实历史；故意错误版本、未知 ID、非法结构等负向夹具必须继续失败并验证错误语义。dev-mock/演示数据不得冒充真实 IPC、文件系统或真机证据。
5. **数据落点与安全**：单测临时数据进入 `.test-tmp/` 或 `ASD_TEST_TMP` 指定位置；真实工作区验收继续使用本包既定备份、`project-accept-*` 前缀、隔离 userData 和人工确认清理护栏。不得为测试方便改写真实项目数据。
6. 本次只归并文档，不运行产品测试，不修改 X-001/X-002、历史测试数字或任何 PASS/FAIL 结论。
