# SDG-AI-变更记录 — feature-810 谱系升级差异工作流

> 本文件按通用规则 §2 记录本任务包全部变更，三类分节：**D（决策）/ T（任务执行）/ X（修复）**。

---

## D（决策）

### D-001 建包与 K8 卡口登记（2026-10-19）

**背景**：新建→立项链路盘点（2026-10-18/19，版本记录已留痕）缺口 #2——设计书 §2.6.4（风格引用 = 风格 ID + 谱系版本成对）+ §8.3（版本跟踪「平台记录注册版本，谱系升级后提示差异，由人决定是否采纳」）明示的差异工作流**链路零落地**：装载层已备（loader 从 md 读 version、STYLE_VERSION_MISMATCH 已在 style.validate），但 VisualCatalog L185-217 仅 B-35 所加演示面板（v1.46→v1.47、A7 备→主、C6 锚点词全硬编码假数据，采纳/忽略按钮无任何逻辑），头部徽章 `STYLE_CATALOG_VERSION` 硬编码，renderer 无任何 style catalog IPC。登记偏差 **B-40**。

**设计抉择（用户指令「#1、#2」推进建包，抉择项以推荐默认值随本登记呈报，批准即生效）**：

1. **采纳语义 = 仅升版本号**：采纳 = `brief:update` 系统直写 `style.catalogVersion` 升至当前谱系版本（恒 mark 追溯，D-017）；「改风格 → 全链路提示词重出」属改风格流程另域，不在采纳动作内（§8.3 字面语义）。
2. **真实化范围 = 全链路（局部面板）**：主进程差异检测（`electron/style/upgrade.ts` 新）+ 2 新 IPC + VisualCatalog 头部徽章与差异面板真实数据驱动（B-35 演示硬编码全替换）；TABS 六家族计数与 18 条目卡片真实化排除，登记 **B-41** 另立包。
3. **差异内容双来源**：①引用条目现况比对（loader 可算：存在性/主备/明细当前值）；②谱系 md 增设 J.3「谱系变更记录」段（本包落 v1.46 空段骨架 + 格式约定，§8.3 维护单回路格式延伸；演示假数据不写入真实谱系）。旧版谱系内容不可得（升级覆盖旧 md），不做逐字段 diff。
4. **忽略 = 关闭不持久化**：零新状态文件；版本差客观存在则提示恒在（§8.3 持续提示语义）。

**K1 卡口**：零触发——`StyleUpgradeDiff` 等 DTO 仅主进程/renderer 两端消费，定义于 `electron/style/types.ts` + `global.d.ts` 镜像（feature-005 D5「三端消费才进 shared」反向适用）。

**K8 卡口登记**：+2 IPC（`style:catalog` / `style:upgrade-diff`，契约 §2.1/§2.2）+ `brief:update` style 白名单 +1 键 `catalogVersion`（契约 §2.3，既有 IPC 入参扩展）。零新 MCP 工具、零新推送。

**K9 卡口**：零触发，无新依赖。

**偏差登记**：B-40（谱系升级差异工作流缺失，盘点缺口 #2，本包登记）；B-41（VisualCatalog 面板全量真实化——TABS/条目卡片数据驱动，另立包登记）。均于 T8 落入偏差清单。

**溯源标签**：[Design 原有]（§8.3 明示的平台机制形态对齐）。

**技术决策指针**：SDG-OD-设计说明.md D1-D8（双来源 / J.3 骨架 / 仅升版本号复用 brief:update / 忽略不持久化 / 采纳前置校验 / blocking 衔接 style.validate / 面板打开检测 / TABS 排除登记 B-41）。

---

## T（任务执行）

### T1 基线冻结（2026-10-20，与 feature-006 共用）

- typecheck：恰 3 条历史基线错误（canvas-zoom.test.tsx ×2、runtime-client.test.ts ×1），零新增。
- 全量测试（feature-006 收尾态复测冻结）：**54 文件 600 passed / 0 failed / 1 skipped**——本包回归红线以此为准（passed 不减、skip 不增、测试文件净增恰 2）。

### T2 主进程（2026-10-20）

- `electron/style/types.ts`：+StyleUpgradeRefEntry / StyleChangelogEntry / StyleUpgradeDiff 三 DTO（契约 §1；K1 零触发，两端消费不进 shared；`noBrief?` 按 §1 规则表空态行纳入）。
- `electron/style/upgrade.ts`（新建）：`parseStyleChangelog`（J.3 全标题匹配 → 段切片至下一 `## ` → `### vX.Y（date）` 分节（全/半角括号容忍）→ `- ` 条目；段缺失/零版本节 → null）+ `computeStyleUpgradeDiff`（projectDir=null/立项单读取失败/无 style 字段 → noBrief 空态不抛错；谱系装载三码不降级直接抛；hasUpgrade 逐字比较同 STYLE_VERSION_MISMATCH 语义；引用条目现况主+辅、anchorWords 按逗号/顿号切分；blocking=任一 removed；J.3 独立 try 仅 hasUpgrade 时解析，区间 (registered, current] 数值元组过滤，端点不可解析放行全部）。
- `electron/brief/update.ts`：`BriefUpdatePatch.style` +`catalogVersion?: string`；合并行 `patch.style?.catalogVersion ?? prev.style.catalogVersion`（恒 mark/版本推进/影响清单/画布挂脏机制零改动）+ 2 处注释修正为真。
- `electron/main.ts`：+`style:catalog`（`{version,count,entries}` 与 MCP style.catalog 同形状、同经 loadStyleCatalog）+`style:upgrade-diff`（getActiveProjectDir 捕获转空态）2 handle；`brief:update` style 白名单 +`catalogVersion`（typeof string 校验同既有键）。
- `electron/preload.ts`：+`styleCatalog()`/`styleUpgradeDiff()` 2 桥（零推送）；updateBrief patch 类型同步 +`catalogVersion`。
- `src/global.d.ts`：DTO 三件套 + StyleCatalogEntryDto 镜像 + 2 桥签名声明；updateBrief patch 类型同步。
- 验证：typecheck 恰 3 条历史基线零新增；既有 brief-update(6) + style-catalog(21) 测试 27/27 通过。

**L1 自决留痕一（J.3 段名冲突）**：契约 §3 新段名「## J.3 谱系变更记录」与谱系 md 既有「## J.3 立项选择规则（权威在规范）」重号；parse-md.ts 早已以 `## J.3` 前缀作 J.2 切片终止符。处置：新段插 J.2 之后（立项选择规则之前），J.2 切片内容逐字不变、parse-md 零行为变化；upgrade.ts 解析器锚定全标题 `## J.3 谱系变更记录` 防歧义。重号整理（立项选择规则改 J.4）越出本包白名单，不在本包做。

**L1 自决留痕二（update.ts 文件清单漏登）**：契约 §5 修改清单与零 diff 红线（`electron/brief/*`）未列 `electron/brief/update.ts`，但 §2.3 K8 登记明示「`BriefUpdatePatch['style']` 类型同步 +1 可选键」且 AC4 要求「合法字符串写盘且恒 mark 立项单版本 +1」——不改 update.ts 合并行则采纳恒报「无字段变更」。处置：详规（K8 登记 + AC4）优于总表，最小 2 处 diff（类型 +1 键、合并行消费 patch）+ 2 处注释修正；updateBriefFields 机制（恒 mark / 版本推进 / 影响清单 / 画布挂脏）零改动。

### T3 谱系文件（2026-10-20）

- `resources/H3-Style/AI短剧制作视觉风格谱系.md`：E 系表末行与「## J.3 立项选择规则」之间插入契约 §3 字面骨架（`## J.3 谱系变更记录` + 格式约定注释 + `### v1.46（2026-10-08）` 一节；B-35 演示假数据未写入）。
- 安全性验证：parse-md 以 `## J.3` 前缀作 J.2 终止符，命中新段后 J.2 切片内容逐字不变（新段位于五张家族表之后）；style-catalog 21/21 通过，loader 交叉核对零漂移。

### T4 renderer（2026-10-20）

- `src/studio/VisualCatalog.tsx`（V1–V6 全落地）：
  - V1 头部徽章：删 `{STYLE_CATALOG_VERSION} · 2026-10-08` 硬编码 → 抽屉打开时 `style:catalog` 拉取显真实版本，失败显「谱系不可用」降级态（新凭据 `style-catalog-version`）；
  - V2 四态入口（取契约「置灰显当前已是最新」一支，凭据 `style-upgrade-entry`）：diff 加载中/失败不显；`hasUpgrade:true` 显可点提示钮（含版本对文案）；`false` 置灰「谱系当前已是最新」；`noBrief` 置灰「…（立项后可采纳升级）」；
  - V3 差异面板（凭据 `style-upgrade-panel`/`versions`/`ref`(带 data-style-id)/`changelog`/`changelog-empty`）：版本对 + 口径文案「差异 = 引用条目现况 + 谱系变更记录，非逐字段 diff」+ blocking 警示条 + 引用条目现况行（removed 标「已移除」；current 显主/备 · 可作辅助 · 可行度 · 锚点词现况，名称经 styleNameOf 回退 ID）+ J.3 变更记录（`changelogUnavailable` →「谱系未提供变更明细」）；
  - V4 采纳（凭据 `style-upgrade-adopt`）：blocking/noBrief/adopting 禁用 + title 原因提示；可用 → §2.3 前置校验（`style:catalog` 重取版本 ≠ 面板 currentVersion → 拒调并提示「谱系已再升级，请刷新差异」）→ `updateBrief({style:{catalogVersion: currentVersion}})` → 刷新 diff 转已最新；
  - V5 忽略（凭据 `style-upgrade-ignore`）：仅关闭面板，零调用零写入；
  - V6：TABS/18 条目卡片维持硬编码零 diff；演示硬编码与旧 `data-catalog-upg/adopt/ignore` 凭据全删（Grep 实证旧凭据零外部引用，与 §4.2 风险表一致）。
- `src/dev-mock-api.ts`：+`styleCatalog`/`styleUpgradeDiff` mock——mock 谱系假装已升 v1.47、demo 立项单引用 v1.46 演示升级面板（演示变更条目标「浏览器演示数据」，不写入真实谱系，契 D2）；`updateBrief` 桩特判 `style.catalogVersion` 同步内存立项单，采纳后 diff 刷新转「已是最新」，浏览器预览闭环可演；entries 复用 STYLES 硬编码同源（V6 排除项本体）。
- 验证：typecheck 恰 3 条历史基线零新增；brief-update(6) + style-catalog(21) + chat-markdown(18) 45/45 通过。

**L1 自决留痕三（V1「删常量」vs §5/§3 白名单与零 diff 红线冲突）**：契约 §4.1 V1 字面「删硬编码 `STYLE_CATALOG_VERSION` 常量」，但该常量被 `ChatComposer.tsx`（L11 import、L245 对话内风格选项卡显版本）与 `chat-markdown.test.tsx`（L7/L190 断言）引用——前者不在 §5 修改清单（≤7）与 §3 文件白名单（≤8）内，后者属「其余既有测试文件」零 diff 红线；物理删常量将破两处红线。处置：V1 核心诉求 = 头部徽章真实化（已达成，VisualCatalog 本体不再消费该常量）；常量物理保留并改写注释标明「对话内选项卡专用遗留」，其真实化与退役一并写入 B-41 另立包范围（T8 登记）。ChatComposer 与 chat-markdown.test 零 diff。

### T5 单测（2026-10-20）

- `src/test/style-upgrade.test.ts`（新建，22 用例，AC1–AC4 + §2.3 采纳闭环端到端）：parseStyleChangelog 5（真实谱系 v1.46 节逐字 / 合成多版本（全半角括号 · 无日期 · 空条目滤除 · 前导空白容忍 · NEXT_SECTION 截止 · 段外节不入）/ 段缺失 · 空段 · 标题全行锚定各 null）；空态 4（projectDir null / 无立项 / 坏 JSON / 缺 mainStyleId → 同形 noBrief）；现况比对 4（版本一致全字段 toEqual（A7 锚点词 3 条 · B1 4 条逐字）/ 无辅单条 / 落后 v1.45 → hasUpgrade + 完整 changelog / removed 双条 blocking）；区间降级 6（左开 (v1.46,v1.47] / 端点不可解析放行（文档序）/ 段缺失 · 空段 · 读盘异常 → changelogUnavailable / 装载失败抛 STYLE_CATALOG_MISSING）；style:catalog 形状 1（与 main.ts handle 同形映射，version/count/entries 十键）；采纳闭环 2（v1.45→v1.46 写盘全链路（changes/items/manifest/影响清单 decision 恒 mark）→ diff 转已最新；非法版本 v1.99 → BRIEF_NOT_READY 零写盘）。
- `src/studio/visual-catalog.test.tsx`（新建，14 用例，AC5）：徽章 2 / 入口 4 / 差异面板 4 / 采纳闭环 3 / 忽略 1；三桥（styleCatalog/styleUpgradeDiff/updateBrief）全量 mock，断言逐字对齐 T4 凭据与文案（含 disabled/title 提示、双钮文案、调用次数、前置校验拒调）。
- `src/test/brief-update.test.ts`：尾部追加 describe「feature-810 style.catalogVersion 键」2 用例（直改通道语义：by=ui / 影响清单 decision 恒 mark / severity high·defaultAction regenerate / 未改字段原样继承 / manifest briefVersion+1；同值 INVALID_ARGUMENT 零写盘），既有 6 用例零 diff。
- 验证：三文件 44/44 通过（22 + 14 + 8）；typecheck 恰 3 条历史基线零新增。

**L1 自决留痕四（T5 首跑 typecheck 7 条假新增）**：首跑 `tsc --noEmit` 报 7 条新增（TS6305 upgrade.d.ts 未构建 + TS2353×4「catalogVersion 不在 patch 类型」+ TS7006×2 级联隐式 any）——根因：composite 项目引用按 `dist-electron/*.d.ts` 解析，产物停在 T2 前旧版（update.d.ts 无 catalogVersion 键、upgrade.d.ts 缺失），非源码问题（update.ts L30 已含该键，T2 实证）。处置：跑 `npm run build:electron` 刷新产物后 7 条全消，仍恰 3 条历史基线；未改任何源码。另留痕：测试断言以 impact.ts L113 实现为准（severity high → `defaultAction:'regenerate'`；恒 'mark' 者为落盘影响清单 decision），测试初稿两处误写 'mark' 已修正（实现已过 T4 验证，测试为验证方）。

### T6 全量回归（2026-10-20）

- `npx vitest run` 全量：56 文件 passed（54→56，净增恰 2：style-upgrade.test.ts + visual-catalog.test.tsx）；638 passed / 0 failed / 1 skipped（基线 600→638，+38 = 22 + 14 + 2，passed 不减、skip 不增）。
- `npx tsc --noEmit`：恰 3 条历史基线（canvas-zoom×2 + runtime-client×1）零新增。
- AC6 达标，回归红线（T1 冻结基线）守住。

### T7 真机目验（2026-10-20，AC7 全达成）

**沙箱建制（保护真实数据）**：复制真实项目 `project-20261017-105242-eai6`（立项单 v5，A7 + catalogVersion v1.46）为独立沙箱 `project-20261020-999999-t7ac`；`session-state.json` currentDir 临时指向沙箱（原值 `project-20261020-090349-tjru` 已记录，目验后恢复）；沙箱立项单 v5 `style.catalogVersion` v1.46 → **v1.45** 模拟旧注册版本。

**目验七步（逐步截图存证）**：

1. **改旧模拟** ✓——沙箱立项单 v5 catalogVersion=v1.45（谱系当前 v1.46）。
2. **面板真实差异提示** ✓——`npm run dev` 启动（白屏 → Ctrl+R 恢复，见 L1 自决留痕五）→ 顶栏打开 VisualCatalog 抽屉 → 🔔 横幅「谱系有升级（v1.45 → v1.46），点击查看差异」（凭据 style-upgrade-entry）。
3. **差异面板内容** ✓——点横幅展开：版本对 v1.45 → v1.46（人决定是否采纳）；口径文案「差异 = 引用条目现况 + 谱系变更记录，非逐字段 diff」；引用现况行「主风格 A7 拟真人·仿真人动漫：主 · 可行度高」；锚点词现况 realistic human-like anime、lifelike expression、cinematic（中文直译：仿真人动漫 / 拟真人）；J.3 变更记录「v1.46（2026-10-08）·（本版起设立变更记录段；此前版本无记录）」；采纳 / 忽略双钮（凭据 style-upgrade-panel/versions/ref/changelog/adopt/ignore 逐一在树）。
4. **采纳 → 立项单版本 +1 且版本号升、面板转已最新** ✓——点采纳（前置校验 `style:catalog` 重取版本一致通过）→ 画布立项单 **v6** + 横幅转「谱系当前已最新」。落盘三件套逐一验证：① `立项单.v6.json`——version 6、style.catalogVersion v1.46、approve `{at: 2026-10-20T03:14:09.204Z, by: 'ui'}`、changesFromPrevious `[{field:'style.catalogVersion', from:'v1.45', to:'v1.46'}]`、fiveElements/premise/diagnosisSummary 等未改字段原样继承；② `manifest.json` briefVersion 6、updatedAt 同步、status 不动；③ `影响清单.v5-v6.json`——changes 记录正确、items 空（沙箱画布血缘 fields 无 style.catalogVersion 匹配，零挂脏，语义正确）。
5. **再改旧 → 重开仍提示** ✓——立项单 v6 改回 v1.45 → 抽屉 × 关闭再开（顶栏按钮仅 `setCatalogOpen(true)` 无 toggle，抽屉开着点击无效，须先关再开方重拉 diff）→ 横幅正确再现。
6. **忽略 → 零写盘纯收起** ✓——展面板 → 点「忽略（保持 v1.45）」→ 面板收起 + 横幅仍在；Glob 验证零写盘（无 v7 立项单、无 v6-v7 影响清单），忽略语义 = 纯前端收起零 IPC（契 D4）。
7. **再开仍提示** ✓——× 关再开，横幅「谱系有升级（v1.45 → v1.46）」仍在（版本差客观存在则提示恒在，§8.3 持续提示语义）。

**目验后清理**：停 dev 进程；删沙箱整目录（`project-20261020-999999-t7ac`，含目验产生的 v5 改旧/v6 采纳落盘/影响清单，全部随沙箱移除，真实项目零污染）；`session-state.json` 恢复原值。

**L1 自决留痕五（dev 首载白屏，非源码缺陷）**：`npm run dev` 冷启动后主窗口截图全白、AX 树空。诊断链：Playwright 直连 localhost:5173 渲染正常（dev-mock-api 兜底）→ vite serve 代码无恙；dist-electron 产物 Grep 实证 style:catalog/style:upgrade-diff handler 与 preload.cjs 双桥齐全、preload 路径 `path.join(__dirname,'preload.cjs')` 与产物位置吻合；Playwright console 见一条 chunk 404。根因判定：vite 冷启动 optimizeDeps 完成前 Electron 已加载页面致 chunk 404 白屏。处置：主窗口 Ctrl+R 重载即完整渲染，后续目验全程无恙；未改任何源码（既有 dev 编排脚本不动，属开发环境时序现象，非本包引入）。

---

## X（修复）

本包实施期零修复（T1 冻结基线至 T7 真机目验全程零红灯：T5 typecheck 7 条假新增系 dist-electron 产物过时、`npm run build:electron` 刷新后全消未改源码；T7 dev 首载白屏系 vite 冷启动 optimizeDeps 时序致 chunk 404、Ctrl+R 恢复，均为环境/产物现象非源码缺陷，已作 L1 自决留痕四/五入账，无新增修复条目）。
