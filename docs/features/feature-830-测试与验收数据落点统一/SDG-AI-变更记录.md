# feature-830 · 变更记录

> 状态：✅ 已落地（2026-11-19）。T1—T8 已完成，验证结论见下；本行仅修正页首状态，历史证据不回写。

## 一、决策记录

| 编号 | 内容 | 拍板 |
| --- | --- | --- |
| D-830-1 | 真机验收采用「真实工作区 + 隔离配置」档位（工作区 `~/Documents/ai-shortdrama-studio/`，userData 由 `ASD_USER_DATA` 隔离） | 用户 2026-11-19 拍板（AskUserQuestion 选项 A） |
| D-830-2 | Vitest 临时目录换到仓库内 `.test-tmp/`，`ASD_TEST_TMP` 可覆盖 | 用户 2026-11-19 拍板（AskUserQuestion 选项 B） |
| D-830-3 | 验收安全前置：备份真实工作区、夹具 `project-accept-*` 前缀、不触碰现有真项目、验收脚本进仓库 | 用户 2026-11-19 拍板（含于选项 A 描述） |

卡口登记：**K1 / K7 / K8 / K9 全零触发**（依据契约 §4）；不改 `shared/types.ts`、不新增 IPC / MCP / 依赖、不改 AGENTS.md 核心规则、不翻案 D-035 / D-036 / P1 §11.2。

## 二、实施记录

### 新增
- `scripts/acceptance-env.cjs`：验收环境准备器（只读枚举 / 前缀护栏 / 备份 / env 生成 / CLI）。
- `src/test/acceptance-env.test.ts`、`src/test/setup-tmpdir.test.ts`：新契约测试。
- 本任务包 5 文件。

### 修改
- `src/test/setup.ts`：`TMPDIR` 重定向到 `.test-tmp/`。
- `.gitignore`：新增 `.test-tmp/`。
- `electron/main.ts`：`ASD_USER_DATA` → `app.setPath('userData', …)` 钩子。
- 根设计 §7.2、README、版本记录。

### 零 diff 保护
`shared/types.ts` / `electron/preload.ts` / `src/global.d.ts` / `src/dev-mock-api.ts` / `package.json` / `package-lock.json` / 全部既有 `*.test.ts`。

### 验证结论（2026-11-19 回填）

- [x] T1–T8 完成。
- [x] **`npx tsc --noEmit`：零错误**（exit 0；工作区现行基线为 0 条错误）。
- [x] **全量 `npx vitest run`：102 文件 1315 passed / 1 skipped / 0 failed（EXIT=0）**，按契约 §1.3 以 `ASD_TEST_TMP=<系统临时目录>/ai-shortdrama-studio/tests` 覆盖执行。
- [x] 新契约测试 7/7 通过（修复其中 1 条脆弱断言后复跑）；`fs-sandbox.test.ts` 5/5；`ASD_TEST_TMP` 覆盖验证 2/2 且覆盖目录确实生成。
- [x] `git diff --check` 通过；`git check-ignore -v .test-tmp/probe` 命中 `.gitignore:13`；`node scripts/acceptance-env.cjs --check` 只读通过（真实工作区仅 1 个真项目）。
- [x] 白名单佐证：`shared/types.ts` / `preload.ts` / `global.d.ts` / `dev-mock-api.ts` 的现有 diff 不含任何本包关键词（属本轮之前其他会话的未提交改动，本包零触碰）；`package.json` / lockfile 零 diff。

## 三、修订记录

### X-001：默认落点在 WorkBuddy 沙箱内跑全量会失败（外部守卫，非产品缺陷）

首次以**默认配置**（仓库内 `.test-tmp/`）跑全量：`22 文件 failed | 80 passed (102)`、`138 failed | 1177 passed | 1 skipped (1316)`。逐条核对：84 次 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`（threshold 50 / turn），全部发生在各套件 `afterAll` 的 `fsp.rm(tmpRoot, {recursive:true})`；目录未清理连锁污染后续套件，产生 `AssertionError: expected [Array(1)] to deeply equal []` 等次生失败。根因是 WorkBuddy 沙箱注入的 `node-safe-delete-shim` 对**工作区内**递归删除计数拦截，临时根在系统临时目录时（改包前历史基线）从未触发。

处置：不改产品逻辑，按既有 `ASD_TEST_TMP` 覆盖能力复跑同一批 1316 个用例 → 1315 passed / 1 skipped / **0 failed**（138 个失败全部转为通过，用例总数一致，证明失败仅来自清理被拦）。约束已写入契约 §1.3、需求 AC7、根设计 §7.2；普通终端无 shim 注入，默认配置不受影响。若用户希望把默认落点改为系统临时目录统一子目录以避免该约束，须另行拍板。

### X-002：新测试一条断言过严（已修）

`acceptance-env.test.ts` 原断言 `result.ASD_TEST_TMP === undefined`，但 `buildElectronEnv` 本就继承 `process.env`，覆盖运行时该变量会被带入 → 覆盖跑唯一失败（1/1316）。改为 `expect(result.ASD_TEST_TMP).toBe(process.env.ASD_TEST_TMP)`（表达"继承且不篡改"），修复后复跑 0 failed。

### D-037 接收 feature-818 / 826 通用测试约束（2026-11-19）

| 来源 | 目标章节 | 处理 |
| --- | --- | --- |
| feature-818 设计「验证策略」、任务 T3、变更记录验证段 | 本包需求/契约/设计「D-037 现行归并」 | 迁入定向测试、typecheck、完整 Renderer build 的适用门禁；三条类型错误与 29/29 留原包 |
| feature-826 契约 §3 验证门禁、设计 §1/§4、任务 T3 | 本包需求/契约/设计「D-037 现行归并」 | 迁入复现、定向+全量+typecheck、真实统计和新增失败定位原则 |
| feature-826 契约 §1、设计 §1—§3 的测试数据分流 | 本包契约「测试数据契约」 | 迁入当前事实源/历史合成/负向夹具原则，不迁具体谱系业务归属 |
| feature-826 谱系版本、changelog、采纳与升级语义 | feature-802 需求 §7、契约 §15、设计 §10、任务 T11、变更 R-004 | 已迁入；本包及归档表均不把通用门禁迁往 feature-802 |

- **页首状态**：仅将原「实施中/待 T8」改为已落地；T1—T8 回填、X-001/X-002、102 文件与 1315/1316 等历史数字未改。
- **冲突处理**：当前事实源与独立历史/合成夹具分开，禁止机械全局替换；历史 PASS/FAIL 只能作为当时证据。
- **执行边界**：纯文档，未运行产品测试，未新增接口或产品能力，未宣称本次真机验收通过。
- **复核状态**：自审 + 无第二人复核。

### DOC-GOV-001：文档治理清理与机检（2026-11-20）

- 用户批准本次归 feature-830，不新建 Feature；未修改产品代码、`shared/types.ts`、IPC／DTO、`AGENTS.md` 或依赖。
- 001、005、006、014、808 五份记录合计新增 47 行、删除 457 行；已落地流水改为修订注，永久决策、真实缺陷、验收偏差及开放真机项保持可定位。
- 新增 `scripts/check-governance-docs.cjs` 与 `src/test/governance-docs.test.ts`；`package.json` 新增 `check:docs`，并将 `test:run` 前置到该机检。脚本以自身位置定位仓库根，只读且可从其他 cwd 执行。
- 旧结构豁免逐包限定于 803、816、820、821、822、823、827、828、829；本包记录已归一为决策／实施／修订三分类，未批量改写上述历史包。
- 定向验证：`npx vitest run src/test/governance-docs.test.ts` 为 1 文件 12 passed / 0 failed。最终 `npm run check:docs` 退出 0，动态读取 105 条版本、40 条决策、24 个现行负责包、408 个编年长段落及 1 个受长度约束的单 Feature 新条目。
- 全量验证：按契约 §1.3 覆盖 `ASD_TEST_TMP` 后运行 `npm run test:run`，文档前置机检及 Vitest 均退出 0；实际为 **103 文件、1327 passed / 1 skipped / 0 failed（共 1328）**。原有 React `act(...)` stderr 警告未作为失败或新增问题隐藏。
- 类型门禁：`npm run typecheck` **退出 2**，唯一错误为 `src/test/setup-tmpdir.test.ts(20,35) TS2345`（`process.env.TMPDIR` 为 `string | undefined`）。该文件本次零 diff，错误不归因于新机检文件；本 Change 不借全量 Vitest 通过宣称 typecheck 通过，也不越权改写既有测试。
- 差异门禁：`git diff --check` 通过；`AGENTS.md`、`shared/types.ts`、preload、全局 DTO、dev-mock、lockfile 及上述存量类型错误文件均零 diff。未运行 Renderer 构建（未改 Renderer 源码或构建配置），未执行真机验收，未提交 Git。

### DOC-GOV-002 · 按需上下文提取（2026-11-21）

- **问题**：Feature 状态、验收、未完成任务和开放项分散在现行事实源中，重复摘录会持续增加文档并拖慢读取。
- **修订**：新增 `scripts/docs-context.cjs`、`src/test/docs-context.test.ts` 与 `docs:context` 入口；按精确目录只读提取五类 stdout Markdown 视图，缺失章节固定降级，不创建摘要或缓存文件。
- **验收**：定向 2 文件 20/20 passed；真实 `npm run docs:context -- 829` 和 `-- 830` 均退出 0，829 输出 T2—T5；`check:docs` 通过；全量 `test:run` 为 104 文件 1335 passed / 1 skipped / 0 failed；`git diff --check` 通过。
- **复核修正**：完成任务勾选后曾复现真实 830 用例 1 failed；根因是测试误依赖未完成任务来源章节，删除该不稳定断言并保留 CONTEXT-AC5 校验，定向与全量复跑恢复 0 failed。
- **类型基线**：`npm run typecheck` 退出 2，唯一错误仍为未改动文件 `src/test/setup-tmpdir.test.ts(20,35)` 的 TS2345；本次没有把它写成类型通过。Renderer 未受影响，未运行 `build:renderer`。
- **边界与复核**：依赖、lockfile、产品代码、共享类型、IPC／DTO、`AGENTS.md` 零新增修改；本次为脚本与文档自审，无第二人复核，不提交 Git。

### DOC-GOV-003 · 本地计划草稿清理（2026-11-25）

- 按用户批准方案，清理切片 C、E、F 和 P1 完整收口四份被 Git 忽略且未跟踪的本地计划。C／F 的现行职责与验收证据仍归 821、828 和 P1 调查记录；E 的批准事实由 823 包内记录承接；过期完整收口计划不再作为执行入口。
- 四份文件已移至系统回收站，未复制全文、未新增归档副本或编年长文。目录无剩余 Markdown，全库检索仅有 `.gitignore` 的目录规则；823 两处引用已改为包内链接。
- `check:docs` 通过（24 features／24 change_logs），`git diff --check` 通过。未修改产品代码、共享类型、IPC、测试、依赖、历史验收证据或 P1 状态；**自审 + 无第二人复核**，不提交 Git。
