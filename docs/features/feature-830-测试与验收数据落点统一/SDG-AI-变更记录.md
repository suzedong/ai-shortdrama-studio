# feature-830 · 变更记录

> 状态：✅ 已落地（2026-11-19）。T1—T8 已完成，验证结论见下；本行仅修正页首状态，历史证据不回写。

## 一、决策登记

| 编号 | 内容 | 拍板 |
| --- | --- | --- |
| D-830-1 | 真机验收采用「真实工作区 + 隔离配置」档位（工作区 `~/Documents/ai-shortdrama-studio/`，userData 由 `ASD_USER_DATA` 隔离） | 用户 2026-11-19 拍板（AskUserQuestion 选项 A） |
| D-830-2 | Vitest 临时目录换到仓库内 `.test-tmp/`，`ASD_TEST_TMP` 可覆盖 | 用户 2026-11-19 拍板（AskUserQuestion 选项 B） |
| D-830-3 | 验收安全前置：备份真实工作区、夹具 `project-accept-*` 前缀、不触碰现有真项目、验收脚本进仓库 | 用户 2026-11-19 拍板（含于选项 A 描述） |

卡口登记：**K1 / K7 / K8 / K9 全零触发**（依据契约 §4）；不改 `shared/types.ts`、不新增 IPC / MCP / 依赖、不改 AGENTS.md 核心规则、不翻案 D-035 / D-036 / P1 §11.2。

## 二、变更三分类

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

## 三、验证结论（2026-11-19 回填）

- [x] T1–T8 完成。
- [x] **`npx tsc --noEmit`：零错误**（exit 0；工作区现行基线为 0 条错误）。
- [x] **全量 `npx vitest run`：102 文件 1315 passed / 1 skipped / 0 failed（EXIT=0）**，按契约 §1.3 以 `ASD_TEST_TMP=<系统临时目录>/ai-shortdrama-studio/tests` 覆盖执行。
- [x] 新契约测试 7/7 通过（修复其中 1 条脆弱断言后复跑）；`fs-sandbox.test.ts` 5/5；`ASD_TEST_TMP` 覆盖验证 2/2 且覆盖目录确实生成。
- [x] `git diff --check` 通过；`git check-ignore -v .test-tmp/probe` 命中 `.gitignore:13`；`node scripts/acceptance-env.cjs --check` 只读通过（真实工作区仅 1 个真项目）。
- [x] 白名单佐证：`shared/types.ts` / `preload.ts` / `global.d.ts` / `dev-mock-api.ts` 的现有 diff 不含任何本包关键词（属本轮之前其他会话的未提交改动，本包零触碰）；`package.json` / lockfile 零 diff。

### X-001：默认落点在 WorkBuddy 沙箱内跑全量会失败（外部守卫，非产品缺陷）

首次以**默认配置**（仓库内 `.test-tmp/`）跑全量：`22 文件 failed | 80 passed (102)`、`138 failed | 1177 passed | 1 skipped (1316)`。逐条核对：84 次 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`（threshold 50 / turn），全部发生在各套件 `afterAll` 的 `fsp.rm(tmpRoot, {recursive:true})`；目录未清理连锁污染后续套件，产生 `AssertionError: expected [Array(1)] to deeply equal []` 等次生失败。根因是 WorkBuddy 沙箱注入的 `node-safe-delete-shim` 对**工作区内**递归删除计数拦截，临时根在系统临时目录时（改包前历史基线）从未触发。

处置：不改产品逻辑，按既有 `ASD_TEST_TMP` 覆盖能力复跑同一批 1316 个用例 → 1315 passed / 1 skipped / **0 failed**（138 个失败全部转为通过，用例总数一致，证明失败仅来自清理被拦）。约束已写入契约 §1.3、需求 AC7、根设计 §7.2；普通终端无 shim 注入，默认配置不受影响。若用户希望把默认落点改为系统临时目录统一子目录以避免该约束，须另行拍板。

### X-002：新测试一条断言过严（已修）

`acceptance-env.test.ts` 原断言 `result.ASD_TEST_TMP === undefined`，但 `buildElectronEnv` 本就继承 `process.env`，覆盖运行时该变量会被带入 → 覆盖跑唯一失败（1/1316）。改为 `expect(result.ASD_TEST_TMP).toBe(process.env.ASD_TEST_TMP)`（表达"继承且不篡改"），修复后复跑 0 failed。

## D-037 接收 feature-818 / 826 通用测试约束（2026-11-19）

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
