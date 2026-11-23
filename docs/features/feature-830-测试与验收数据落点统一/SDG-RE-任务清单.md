# feature-830 · 任务清单

| # | 任务 | 文件 | 验收 |
| --- | --- | --- | --- |
| T1 | `setup.ts` 顶部按契约 §1.1 覆盖 `process.env.TMPDIR` 到 `<repo>/.test-tmp/`（支持 `ASD_TEST_TMP`），`mkdirSync` 幂等建目录 | `src/test/setup.ts` | AC2 / C1–C3 |
| T2 | `.gitignore` 增加 `.test-tmp/` | `.gitignore` | AC3 (`git check-ignore -v .test-tmp/x`) |
| T3 | 主进程在 import 后、首次 `getPath('userData')` 前按契约 §2.1 加 `ASD_USER_DATA` → `app.setPath('userData', …)` | `electron/main.ts` | AC1 / AC4 |
| T4 | 新增验收环境准备器：只读枚举真实工作区项目、`assertAcceptFixture` 前缀护栏、`createBackup` 复制备份、`buildElectronEnv` 生成 env，CLI `--prepare` / `--check` 打印清单；**零删除** | `scripts/acceptance-env.cjs`（新） | AC5 |
| T5 | 准备器单测：前缀放行/拒绝、备份确实复制文件、env 中 `HOME` 真实且 `ASD_USER_DATA` 指向隔离目录、未设置时零副作用 | `src/test/acceptance-env.test.ts`（新） | AC5 |
| T6 | 单测落点契约测试：断言 `os.tmpdir()` 等于 `.test-tmp/` 且 `process.env.TMPDIR` 被设置 | `src/test/setup-tmpdir.test.ts`（新） | AC2 |
| T7 | 文档同步：根设计 §7.2 表格与说明、README 落点一句话、本包变更记录、版本记录 2026-11-19 条目 | 文档 4 处 | AC6 |
| T8 | 验证：`npx tsc --noEmit`、`npx vitest run`（全量）、抽样套件检查磁盘落点、`git diff --check` | 命令行 | AC7 |

## 执行顺序与依赖

T1 → T6（验证重定向生效）→ T2 → T3 → T4 → T5 → T7 → T8。

## 边界复核（结束前自检）

- `shared/types.ts`、`electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`、`package.json` 必须零 diff。
- 不新增 IPC / MCP 工具 / 依赖；不修改既有 `*.test.ts` 文件（T5/T6 为新增）。
- 不执行任何删除操作，不触碰 `~/Documents/ai-shortdrama-studio/project-20261104-092720-gv9u`。
- 旧 `/tmp/ai-shortdrama-*` 沙箱与 P1 调查记录结论保持原样。

## D-037 文档归并 Change：接收 feature-818 / 826（2026-11-19，✅ 文档完成）

- [x] 需求、契约、设计补入「复现→定向→全量 Vitest→typecheck→适用 Renderer build」的通用门禁。
- [x] 补入当前事实源、历史/升级合成夹具、负向数据、dev-mock、临时目录与真实工作区验收的数据原则。
- [x] 明确 feature-826 谱系业务语义归 feature-802，本包不承接；通用测试门禁也不迁往 feature-802。
- [x] 变更记录页首由「实施中/待 T8」修正为已完成；X-001/X-002 与全部历史测试数字原样保留。
- [x] 本次未运行产品测试，未修改代码、测试、shared/types.ts、依赖或真实项目数据。

**文档 AC**：本包可独立说明通用门禁和测试数据落点；没有把历史计数写成新目标，没有宣称本次测试或真机验收通过。

## 文档治理清理与机检 Change（2026-11-20）

- [x] **DOC-T1 规格先行**：确认归 feature-830，不新建 Feature；补需求、机检契约与 AC，用户已批准清理和机检方案。
- [x] **DOC-T2 过程清理**：压缩 001、005、006、014、808 的已落地实施区，保留全部 D/K 决策和开放真机项（DOC-AC1）。
- [x] **DOC-T3 零依赖机检**：实现 C-DOC1—C-DOC7，只读、可跨 cwd 执行并输出可定位错误（DOC-AC2—DOC-AC5）。
- [x] **DOC-T4 合成测试与接入**：覆盖索引漂移、重复编号、整段复制、单 Feature 长文、上下文回退等失败分支；接入 `check:docs` / `test:run`，依赖零变化。
- [x] **DOC-T5 验证与追溯**：依次运行定向 Vitest、`check:docs`、全量 Vitest、typecheck；记录实数并补根编年短条目，不改冻结旧文（DOC-AC6）。typecheck 的 1 个未改动文件存量错误已单列，未倒写为通过。

## 按需上下文提取 Change（2026-11-21）

- [x] **DOC-CONTEXT-T1 规格先行**：确认归 feature-830，补命令、输入输出、事实源、降级和只读边界及 CONTEXT-AC1—5；用户已明确要求先实现该命令。
- [x] **DOC-CONTEXT-T2 命令实现**：新增零依赖 `scripts/docs-context.cjs` 与 `package.json` 的 `docs:context` 入口，满足精确解析、跨 cwd、stdout Markdown 和失败语义（CONTEXT-AC1—4）。
- [x] **DOC-CONTEXT-T3 测试**：新增独立测试，覆盖状态、验收章节、未勾选任务、显式开放项、排除项、缺失章节、无/多匹配、非法参数、只读及跨 cwd CLI；核对真实 829 / 830（CONTEXT-AC5）。
- [x] **DOC-CONTEXT-T4 验证与追溯**：运行命令样例、定向 Vitest、`check:docs`、全量 `test:run`、typecheck 和 `git diff --check`，在本包修订记录据实回填；不新增编年长文，不提交 Git。typecheck 仅有未改动文件的存量 TS2345，未倒写为通过。
