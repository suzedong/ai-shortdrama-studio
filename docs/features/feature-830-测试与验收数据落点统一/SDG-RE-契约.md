# feature-830 · 契约

> 本包契约只描述新增的环境变量、路径判定与护栏；共享字段形状仍以 `shared/types.ts` 为准。

## §1 单测临时目录（Vitest）

### 1.1 唯一判定式

```
testTmpRoot = ASD_TEST_TMP 存在 ? path.resolve(ASD_TEST_TMP)
                                : path.resolve(process.cwd(), '.test-tmp')
process.env.TMPDIR = testTmpRoot
fs.mkdirSync(testTmpRoot, { recursive: true })
```

- 实现位置：`src/test/setup.ts` 顶部（vitest `setupFiles`，先于所有测试模块求值）。
- 机制：Node `os.tmpdir()` 在 POSIX 下**每次调用读取** `process.env.TMPDIR || TEMP || TMP || '/tmp'`；覆盖 `TMPDIR` 即可让全部 `os.tmpdir()` 调用重定向，**无需 mock `node:os`、无需修改任何 `*.test.ts`**。
- 已核实：39 个用 `mkdtemp` / `os.tmpdir()` 的测试文件（含 `fs-sandbox.test.ts` 固定根、`asset-index.test.ts` 越界符号链接、`project-transfer.test.ts` 隔离 HOME）全部基于 `os.tmpdir()` 拼路径，**无硬编码 `/var/folders` 或 `/tmp`**，亦无「路径必须位于系统临时目录」的断言。
- 子进程继承 `TMPDIR`：runtime 集成测试 spawn 的 opencode 等也落到同一根下，便于定位。

### 1.2 约束

| # | 要求 |
| --- | --- |
| C1 | `ASD_TEST_TMP` 为绝对路径；相对路径按 `path.resolve()` 相对 cwd 解析 |
| C2 | `mkdirSync(..., { recursive: true })` 幂等；目录已存在不报错 |
| C3 | 不自动删除 `testTmpRoot`：各套件 `afterAll` 仍按既有逻辑清理自己的 `mkdtemp` 子目录；残留统一留在 `.test-tmp/` 便于人工查看与清理 |
| C4 | `.gitignore` 增加 `.test-tmp/` 一行 |

### 1.3 验证环境说明（WorkBuddy 沙箱删除守卫）

把临时根放进**工作区**后，各套件 `afterAll` 的 `fsp.rm(tmpRoot, { recursive: true, force: true })` 会被 WorkBuddy 沙箱注入的 `node-safe-delete-shim` 批量删除守卫拦截：`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":83,"threshold":50,"scope":"turn"}`。在 WorkBuddy 内以默认配置代跑全量时，这些 `afterAll` 失败会连锁污染后续套件（目录未清理导致断言读到残留）。**这是外部工具守卫，不是产品代码缺陷**：临时根在系统临时目录时（工作区外）守卫不统计，改包前的历史全量基线亦从未触发；普通终端直接 `npx vitest run` 无 shim 注入，默认配置不受影响。

在 WorkBuddy 沙箱内验证全量时，用 `ASD_TEST_TMP` 显式覆盖到系统临时目录：

```bash
ASD_TEST_TMP="$(node -e "process.stdout.write(require('os').tmpdir())")/ai-shortdrama-studio/tests" npx vitest run
```

`ASD_TEST_TMP` 优先于默认值；两种落点的测试语义完全一致（所有路径均由 `os.tmpdir()` 派生，无硬编码）。若需坚持默认落点跑全量，须由用户在守卫弹窗逐项确认删除，或改由普通终端执行。

## §2 真机验收环境（Electron 主进程）

### 2.1 唯一新增钩子

```ts
// electron/main.ts，import 之后、任何 app.getPath('userData') 求值之前
if (process.env.ASD_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.ASD_USER_DATA))
}
```

- 已核实：`electron/**` 内 10 处 `app.getPath` **全部位于函数体内**，无模块顶层求值，故 `app.setPath` 早于首次读取生效。
- 未设置 `ASD_USER_DATA` 时零行为变化（AC1）。
- `documents` 不受影响 → `defaultWorkspaceRoot()` 仍为 `~/Documents/ai-shortdrama-studio`（真实工作区）。
- `changeDir` 硬约束不变：`R1.startsWith(R0 + sep)` 抛 `INVALID_ARGUMENT`，因此**不得**把工作区根切成真实根的子目录；验收夹具直接放在真实根下并用前缀区分。

### 2.2 验收夹具护栏

```
fixtureName 必须匹配 /^project-accept-/
```

- 准备器 `assertAcceptFixture(name)` 对非前缀名抛错，禁止任何写操作。
- 准备器只读枚举真实工作区现有项目并打印清单；不修改、不删除、不重命名。
- 备份：`fs.cpSync(workspaceRoot, backupDir, { recursive: true })`，备份目录默认 `<os.tmpdir()>/ai-shortdrama-accept-backup-<YYYYMMDD-HHmmss>/`，可由 `ASD_ACCEPT_BACKUP` 覆盖；备份前后打印路径与文件数。
- **零删除**：准备器不提供自动清理；清理清单由人工确认后另行执行。

## §3 环境变量清单

| 变量 | 作用域 | 默认 | 说明 |
| --- | --- | --- | --- |
| `ASD_TEST_TMP` | Vitest | `<repo>/.test-tmp/` | 单测临时根，覆盖 `TMPDIR` |
| `ASD_USER_DATA` | Electron 主进程 | 未设置（= 系统默认 userData） | 验收时隔离配置 / 会话 / ComfyUI 实例 |
| `ASD_ACCEPT_BACKUP` | 验收准备器 | `<os.tmpdir()>/ai-shortdrama-accept-backup-<ts>/` | 真实工作区备份目标 |

三者互不耦合；`ASD_TEST_TMP` 不进生产包，`ASD_USER_DATA` 仅显式设置时生效。

## §4 卡口与影响面

| 卡口 | 判定 |
| --- | --- |
| K1 | 零触发：`shared/types.ts` 零 diff |
| K8 | 零触发：无新增 IPC、无 DTO / 函数签名变更、`preload.ts` / `global.d.ts` / `dev-mock-api.ts` 零 diff |
| K9 | 零触发：`package.json` / lockfile 零 diff，全部使用 Node / Electron 内置能力 |
| K7 | 零触发：不改 AGENTS.md 核心规则、不改卡口清单；本包为新增能力，**不翻案 D-035 / D-036 / P1 §11.2 历史结论** |

允许改动白名单：`src/test/setup.ts`、`.gitignore`、`electron/main.ts`、`scripts/acceptance-env.cjs`（新）、`src/test/acceptance-env.test.ts`（新）、本包 5 文件、根设计 §7.2、README 落点说明、版本记录。

## §5 文档同步

- 根设计 §7.2 表格：「P1/P2 真机验收」行改为**真实工作区 + `ASD_USER_DATA` 隔离**，并保留 `/tmp/ai-shortdrama-*` 作为历史取证方式说明。
- README「安全与隐私」补一句单测 / 验收落点指引。
- 不升根设计版本号（无设计决策变更）；版本记录按纯实施条目登记。

## D-037 现行归并约束：测试门禁与夹具契约（2026-11-19）

### 1. 通用门禁

| 顺序 | 契约 | 证据 |
| --- | --- | --- |
| 1 | 复现目标失败/错误，冻结测试意图与最小修复范围 | 原始命令、退出码、真实错误；历史失败不得倒写 |
| 2 | 运行与变更直接相关的定向测试 | 实际文件/用例统计 |
| 3 | 运行全量 `npx vitest run` | 实际 passed/failed/skipped；新增失败必须定位 |
| 4 | 运行 `npm run typecheck` | 退出码与实际错误 |
| 5 | Renderer 类型/构建受影响时运行 `npm run build:renderer` | 完整构建结果；警告与失败分开记录 |

负责 Feature 可叠加真机、SIGKILL、路径或媒体门禁，但不能用 mock、构建或单测之一替代其他适用验证。本包只规定通用基线，不重判历史 Feature 是否通过。

### 2. 测试数据契约

| 数据类型 | 使用原则 |
| --- | --- |
| 当前事实源 | 读取当前正式资源/真实结构；不得硬编码过期版本冒充当前 |
| 历史/升级/回滚 | 使用独立、最小、可解释的合成夹具，保留原版本区间和测试目的 |
| 负向输入 | 故意错误版本、未知 ID、非法结构继续触发失败与既定错误语义 |
| 临时文件 | 默认 `.test-tmp/`，可由 `ASD_TEST_TMP` 覆盖；测试自行清理其子目录 |
| 真实工作区验收 | 备份、隔离 userData、`project-accept-*` 前缀、零自动删除；不得写非夹具真项目 |
| dev-mock / 演示数据 | 仅验证其明确模拟的 UI/逻辑，不作为真实 IPC、持久化或真机证据 |

### 3. 归属与边界

feature-826 的当前/历史/合成谱系业务语义由 feature-802 登记；本包只接收可复用的门禁和测试数据原则。feature-818 的具体三条类型错误、29/29 等证据，feature-826 的专项/全量数字，以及本包 X-001/X-002 全部保留在原历史章节。本次未运行测试或修改产品代码。

## 文档治理机检契约（2026-11-20）

### 1. 命令与边界

```bash
npm run check:docs
# 等价于
node scripts/check-governance-docs.cjs
```

- 脚本以自身位置确定仓库根，不依赖调用方 cwd；只读取 Markdown、目录和 `package.json`，不写文件、不自动修复。
- 成功时输出各类检查数量并退出 0；失败时输出 `DOC_GOVERNANCE_CHECK_FAILED` 与逐条路径／原因并退出 1。
- 新增 `test:run = npm run check:docs && vitest run`；不新增依赖、不改产品 IPC／DTO／共享类型。原 §4 的 K9“零 diff”仅描述验收环境历史 Change，不约束本次脚本入口新增。

### 2. 确定性检查

| 编号 | 检查契约 |
| --- | --- |
| C-DOC1 | 版本总索引与年度分卷的条目数、日期顺序一致；显式 Markdown 锚点可解析到对应标题 |
| C-DOC2 | 决策总索引与年度分卷的 D 编号、日期、顺序一致，编号无重复；显式锚点有效 |
| C-DOC3 | Feature 轻索引 §1 与磁盘现行目录集合精确一致，Feature 编号唯一；每包至少存在需求规格、任务清单、变更记录 |
| C-DOC4 | 变更记录具备决策／实施／修订三分类；仅有脚本内点名的旧结构基线可豁免 |
| C-DOC5 | 年度编年与现行包内变更记录不得共享 ≥80 字符的归一化整段；索引行、标题和短模板不参与 |
| C-DOC6 | 2026-11-20 起，只引用一个 Feature 的编年条目正文不得超过 1200 字符，且必须链接该负责包；跨 Feature／治理事件不受此限 |
| C-DOC7 | `AGENTS.md` 保持“默认只读 §0、按任务加载、负责包定位”边界，不得重新内嵌通用铁律章节 |

### 3. 非目标

- 不做语义相似度判断，不自动删除重复文本，不重排历史编号。
- 不用固定总数冒充长期规则；条目、目录与决策数量均从当前事实源动态读取。
- 冻结编年旧条目只读受检；新增长度约束不追溯要求改写历史。

## 按需上下文提取契约（2026-11-21）

### 1. 命令、输入与退出码

```bash
npm run docs:context -- 830
# 等价于
node scripts/docs-context.cjs 830
```

- 仅接收一个参数：`830`、`feature-830` 或磁盘上的完整目录名 `feature-830-测试与验收数据落点统一`。编号只匹配同编号目录，完整目录名只做全等匹配；不做模糊搜索。
- 无匹配或多匹配均失败；缺少参数、多余参数、非法格式和必需文件读取失败同样失败。失败向 stderr 输出 `DOC_CONTEXT_FAILED`、原因和用法，退出 1；成功只向 stdout 输出 Markdown，退出 0。
- 仓库根固定为 `path.resolve(__dirname, '..')`，与调用方 cwd 无关；仅使用 `node:fs` / `node:path`，不得写文件。

### 2. 事实源与确定性提取

| 输出 | 事实源 | 提取规则 |
| --- | --- | --- |
| 当前状态 | `docs/features/README.md` §1 | 精确目录链接所在表格行的“当前状态 / 开放边界”列；另附需求、任务页首个连续引用块内含“状态”的行 |
| 验收标准 | 需求规格、任务清单 | 标题含“验收标准”或“验收条件”的完整章节，保留正文至同级或更高级标题前 |
| 未完成任务 | 任务清单 | 代码块外的 Markdown `- [ ]` 列表项；不按任务表格或历史测试数字推测完成度 |
| 显式开放项 | 任务清单、变更记录 | 代码块外、未勾选项之外的列表项：粗体标签以“遗留项 / 开放项 / 开放状态 / 开放边界”开头，或原文含“仍待 / 待验收 / 待真机 / 未闭环” |
| 非目标／排除项 | 需求规格、任务清单 | 标题含“非目标”“排除”或“范围外”的完整章节 |

- 每条摘录附来源文件和最近的父章节；正文与列表项保留原文。标题扫描忽略 fenced code block，嵌套匹配章节不重复输出。
- 某类无结果时输出该类固定降级提示；未完成任务和开放项的空态均必须附“不代表验收通过”。索引缺少对应行只影响状态栏，不代替磁盘目录解析。
- 输出不含生成时间、随机数或动态统计，同一工作区事实源重复执行结果一致。

### 3. 非目标

- 不生成 `context.md`、缓存、索引副本或跨 Feature 摘要，不自动修订任何事实源。
- 不做语义相似度、完成度评分、验收判定或开放项去重推断；不同来源的相同原文可分别保留。
- 不新增依赖，不改 `test:run` 前置链，不修改产品代码、共享类型、IPC／DTO 或冻结历史。原 §4 的 K9 零 diff 仍仅约束验收环境历史 Change。
