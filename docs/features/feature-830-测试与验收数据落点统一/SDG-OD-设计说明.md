# feature-830 · 设计说明

## 1. 为什么用 `process.env.TMPDIR` 而不是 mock `node:os`

三个候选：

| 方案 | 改动面 | 风险 |
| --- | --- | --- |
| 逐文件替换为公共 `testTmpRoot()` helper | 39 个测试文件 | 机械改动大、易漏；`asset-index.test.ts` 等 6 处非 `mkdtemp` 的 `os.tmpdir()` 调用需逐一处理 |
| `vi.mock('node:os', importOriginal)` 全局替换 `tmpdir` | `setup.ts` 一处 | ESM 命名空间默认导出与命名导出双形态易踩坑；`importOriginal` 展开可能漏掉 getter；测试文件里已有 `vi.mock('electron')` 叠加，调试面变大 |
| **覆盖 `process.env.TMPDIR`（选定）** | `setup.ts` 一处 | Node `os.tmpdir()` 在 POSIX 每次调用读 env，天然生效；不改模块、不 mock；子进程自动继承 |

选第三方案的决定性依据是**全仓检索结果**：39 个测试文件的临时路径全部由 `os.tmpdir()` 拼出，没有任何硬编码 `/tmp` / `/var/folders`，也没有断言"必须位于系统临时目录"。因此改 env 是纯重定向，语义零损失。路径逃逸测试（`asset-image.test.ts` 的 symlink、`asset-index.test.ts` 的 `..` 引用）都是相对临时根构造，换根后仍成立。

副作用是可控的正面效应：spawn 的子进程（runtime 集成测试）也继承 `TMPDIR`，它们产生的临时文件同样聚到 `.test-tmp/`。

## 2. 为什么 `app.setPath('userData')` 而不是覆写 `HOME`

P1 旧脚本用 `HOME: <sandbox>/home` 一次性把 `documents`（工作区）和 `userData`（配置）都隔离了。用户要求工作区必须用真实 `~/Documents/ai-shortdrama-studio/`，所以不能覆写 `HOME`。

Electron 提供 `app.setPath('userData', dir)`，可在 app ready 前把配置目录单独挪走，而 `app.getPath('documents')` 仍返回真实用户目录 → `defaultWorkspaceRoot()` 自动落到真实工作区。这正是「真实工作区 + 隔离配置」的最小实现。

已核实 `electron/**` 的 10 处 `app.getPath` 全在函数体内，模块加载阶段不求值，因此把 `setPath` 放在 `main.ts` import 块之后、第一个业务语句之前即可保证早于首次 `getPath('userData')`（`main.ts:612`）。

`changeDir` 禁止"新根位于当前根内"，所以**不能**把验收工作区切成真实根下的子目录来隔离；护栏改为：夹具统一 `project-accept-*` 前缀 + 验收前备份 + 只读枚举现有项目 + 断言不碰非前缀目录。

## 3. 为什么不翻案 P1 验收口径

P1 调查记录 §11.2 明确「使用独立 userData 与临时工作区，dev-mock 关闭，不触真实用户项目」，D-035 / D-036 的验收结论基于那一批证据。本包**新增一种验收模式**（真实工作区路径 + 隔离配置），不改写历史记录、不重判既有结论。旧 `/tmp/ai-shortdrama-*` 沙箱仍可用于故障注入类用例；真实工作区模式用于验证真实路径下的迁移、恢复与权限行为。两者在 §7.2 并列说明。

## 4. 安全护栏（个人目录）

`~/Documents` 属于个人目录。准备器的行为边界：

- **只读枚举 + 复制备份**：`fs.cpSync` 到 `<os.tmpdir()>/ai-shortdrama-accept-backup-<ts>/`，源目录零改动。
- **零删除**：不提供自动清理函数；夹具清理须人工确认后另行执行。
- **前缀护栏**：任何非 `project-accept-*` 的夹具名直接抛错，避免误伤 `project-20261104-092720-gv9u`。
- 准备器默认不启动 Electron；`buildElectronEnv()` 只返回 env 对象，由调用方（验收 harness）使用。

## 5. 不做什么

- 不搬迁 `/tmp/sdg828-*.cjs` 历史取证 harness（一次性脚本、非产品代码）；本包只交付可复用的环境准备器，完整 harness 参数化留后续包。
- 不给 renderer / preload 暴露 `ASD_USER_DATA`；该变量仅主进程读取。
- 不改 `dev-mock-api.ts`：浏览器预览仍为零落盘内存 mock。
- 不升级根设计版本号：本次是实现与工具层新增，未改变设计决策。

## D-037 现行归并设计：可复用测试基线（2026-11-19）

```text
真实失败/错误复现
  → 冻结测试意图与最小修复范围
  → 定向测试
  → 全量 npx vitest run
  → npm run typecheck
  → Renderer 受影响时 npm run build:renderer
  → 负责 Feature 指定的真机/故障/媒体门禁
```

任一适用步骤未执行或失败都据实记录，不能以「历史问题」跳过定位，也不能由另一项通过抵扣。历史统计作为时间切片证据保留，后续回归记录新的实际输出。

测试数据按事实源分层：当前资源直接读取当前事实；历史与升级区间使用独立合成夹具；负向夹具继续验证错误；dev-mock 只覆盖模拟语义。文件落点继续复用本包 `.test-tmp/` / `ASD_TEST_TMP` 与真实工作区备份、前缀、隔离 userData、零自动删除护栏，不另建平行的数据规则。

本设计只接收 feature-818 的验证链和 feature-826 的通用测试原则。谱系版本/采纳语义归 feature-802；具体类型错误、测试计数、X-001/X-002 与历史 PASS/FAIL 均不改写。D-037 未执行产品测试。
