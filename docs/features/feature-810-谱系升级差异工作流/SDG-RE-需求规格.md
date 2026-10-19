# SDG-RE-需求规格 · feature-810 谱系升级差异工作流

> **包号**：feature-810（8xx 跨阶段平台基础段，谱系同 feature-802 域）
> **业务名**：谱系升级差异工作流（项目引用版本 vs 当前谱系版本检测 + 差异提示真实数据驱动 + 人决定采纳/忽略）
> **性质**：主进程差异检测 + renderer 谱系面板局部真实化（演示面板替换）+ `brief:update` 白名单扩键；**K1 零触发**（差异 DTO 仅主进程/renderer 两端消费，定义于 `electron/style/types.ts` + `global.d.ts` 镜像，不进 shared）；**K8 触发**（+2 IPC：`style:catalog`、`style:upgrade-diff`；`brief:update` style 白名单 +1 键 `catalogVersion`）；**K9 零触发**（零新依赖）
> **事实源**：《短剧Agent平台设计.md》§2.6.4（风格选定 = 风格 ID + 谱系版本成对引用）、§8.3（版本跟踪「平台记录注册版本，谱系升级后提示差异，由人决定是否采纳」；维护单回路；项目引用「风格 ID + 谱系版本」）
> **前置**：feature-802（谱系装载五文件：loader 从 md 读 version、STYLE_REGISTRY 交叉核对）、feature-001/004（立项单版本化、`BriefStyle.catalogVersion` 成对引用）、D-017（`brief:update` 系统直改恒 mark 通道）、B-35（VisualCatalog 升级差异**演示**面板——硬编码假数据 v1.46→v1.47）
> **溯源标签**：[Design 原有]（§8.3 明示的平台机制，形态对齐）
> **偏差登记**：B-40（新建→立项链路盘点缺口 #2：谱系升级差异工作流零落地，仅硬编码演示面板）
> **日期**：2026-10-19

## 1. 背景

设计书两处明示、至今零落地：

- §2.6.4：项目风格引用 = 「风格 ID + 谱系版本」成对——`BriefStyle { mainStyleId, catalogVersion, auxiliaryStyleId? }` 已在数据模型（feature-001）；
- §8.3 版本跟踪：「**平台记录注册版本，谱系升级后提示差异，由人决定是否采纳**」；维护单回路末环：「平台对已引用旧版本的项目提示差异 → 人决定采纳」。

代码实证（2026-10-19 盘点）：装载层已备（[loader.ts](../../../electron/style/loader.ts) 从谱系 md J.0 读出当前 version、`STYLE_VERSION_MISMATCH` 已在 `style.validate` 就绪校验）；但**差异工作流链路零落地**——[VisualCatalog.tsx](../../../src/studio/VisualCatalog.tsx) L185-217 为 B-35 所加**演示面板**：版本号 v1.46→v1.47、差异条目（A7 备→主 / C6 锚点词新增）全硬编码，「采纳」「忽略」按钮仅 `setDiffOpen(false)` 无任何逻辑；头部徽章 `STYLE_CATALOG_VERSION = 'v1.46'` 硬编码常量；renderer 无任何 style catalog IPC（[global.d.ts](../../../src/global.d.ts) 无声明）。

**工程现实（差异内容的来源问题）**：谱系升级只改 md + 自版本号递增（谱系 J.0 维护规则），旧版 md 被覆盖——平台无法逐字段 diff 两版谱系。差异内容因此双来源：①**引用条目现况比对**（项目引用的风格 ID 在当前谱系中的存在性/主备/明细当前值，loader 可算）；②**谱系 md 变更日志**（本包为谱系文件增设 J.3「谱系变更记录」段格式约定，平台解析版本区间内条目——§8.3 维护单回路的格式延伸）。

**原则对齐（D-016 系统优先）**：版本比对、引用条目现况、变更日志解析、采纳落盘（升版本号）均为规则可枚举的确定性操作——系统直做不经 AI；谱系升级本身（改 md）仍走 §8.3 对话驱动单回路，不在本包。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 打开视觉风格面板，项目引用的谱系版本已旧 | 面板显升级提示：「项目引用 vX（旧）→ 当前 vY」+ 引用条目在新版中的现况 + 谱系变更记录（版本区间内）；头部徽章显真实当前版本 |
| R2 | 创作者 | 查看差异后点「采纳」 | 系统直写：立项单 `style.catalogVersion` 升到当前版本（`brief:update` 通道，恒 mark 追溯，立项单版本 +1）；面板刷新为「当前已是最新」 |
| R3 | 创作者 | 查看差异后点「忽略」 | 面板关闭、不写入任何状态；版本差客观存在，下次打开面板仍提示（持续提示语义，§8.3） |
| R4 | 创作者 | 项目引用的风格 ID 在新版谱系中已被移除 | 差异面板标「条目已移除」为阻塞项，「采纳」禁用并提示须先经立项流程重选风格（与 `style.validate` 的 `STYLE_ID_UNKNOWN` 衔接） |
| R5 | 创作者 | 谱系已最新 / 项目未立项 | 已最新：无升级提示（或入口显「当前已是最新」）；未立项：提示「立项后可采纳」，采纳钮禁用 |
| R6 | 谱系维护者 | 谱系升级到新版 | 按 J.3 段格式约定在谱系 md 追写该版变更记录（版本号/日期/变更条目），平台面板即可展示明细——§8.3 单回路「AI 只改 md」的格式延伸 |

## 3. 核心机制

### 3.1 差异检测（主进程，系统直做）

`electron/style/upgrade.ts`（新）：输入 = 当前项目最新立项单 style（mainStyleId/auxiliaryStyleId/catalogVersion）+ `loadStyleCatalog()` 当前谱系；输出 = `StyleUpgradeDiff`（契约 §1）。版本逐字一致 → `hasUpgrade:false`；不一致 → 计算三件套：版本对、引用条目现况（存在性/role/auxiliaryCandidate/feasibility/锚点词等明细当前值）、J.3 变更日志（版本区间 `(registered, current]` 内条目；谱系无 J.3 段 → `changelogUnavailable:true`，面板明示「谱系未提供变更明细」）。引用 ID 不在当前谱系 → 该条目 `removed:true`，整体 `blocking:true`。

### 3.2 谱系 J.3「谱系变更记录」段（格式约定 + 落地骨架）

谱系 md（[AI短剧制作视觉风格谱系.md](../../../resources/H3-Style/AI短剧制作视觉风格谱系.md)）增设 J.3 段：每版本一节（版本号 / 日期 / 变更条目列表，条目 = 自由中文简述，一行一条）。本包落地：为当前 v1.46 补建 J.3 空段骨架（不含 B-35 演示假数据——A7 备→主、C6 锚点词新增均为虚构，不写入真实谱系）；后续谱系升级由 §8.3 单回路维护者按约定追写。loader 解析零侵入：J.3 解析独立于 `parse-md` 既有谱系条目解析，不触碰交叉核对（DRIFT）语义。

### 3.3 采纳 / 忽略（系统直写，D-016）

- **采纳**：renderer 调既有 `updateBrief({ style: { catalogVersion: <当前版本> } })`——`brief:update` style 白名单现仅受理 `mainStyleId`/`auxiliaryStyleId`（[main.ts](../../../electron/main.ts) L248），本包 **+1 键 `catalogVersion`**（K8 登记）；`updateBriefFields` 恒 mark 追溯（D-017），立项单版本 +1，diff 记 `style.catalogVersion` 字段变化。采纳**仅升版本号**——「改风格 → 全链路提示词重出」属改风格流程（另行触发），不在采纳动作内（§8.3 字面语义）。采纳前置校验：目标版本 = 当前谱系版本（防竞态：面板打开后谱系又升级，则拒绝并提示刷新）。
- **忽略**：关闭面板、零写入、零持久化；版本差客观存在则提示恒在。

### 3.4 renderer 真实化范围（局部）

- 头部徽章：硬编码 `STYLE_CATALOG_VERSION` 常量 → `style:catalog` IPC 实时版本；
- 升级差异面板：B-35 演示硬编码 → `style:upgrade-diff` IPC 真实数据驱动（含 `hasUpgrade:false` / `blocking` / `changelogUnavailable` / 未立项四态）；
- **排除**：TABS 六家族计数与 18 条目卡片仍硬编码（面板全量真实化另立包，登记 B-41）。

## 4. 范围

### 4.1 做

1. 主进程：`electron/style/upgrade.ts`（新，差异检测 + J.3 解析）；`electron/style/types.ts` + `StyleUpgradeDiff` 等 DTO；`electron/main.ts` +2 handle（`style:catalog` / `style:upgrade-diff`）+ `brief:update` style 白名单 +1 键；`electron/preload.ts` +2 桥；`src/global.d.ts` DTO 镜像；
2. 谱系文件：md 增设 J.3 空段骨架（v1.46，格式约定注释）；
3. renderer：VisualCatalog 头部徽章与升级差异面板真实化（四态）；采纳走既有 `updateBrief`；`src/dev-mock-api.ts` 增补 style mock；
4. 单测：`src/test/style-upgrade.test.ts`（新）、`src/studio/visual-catalog.test.tsx`（新）——恰净增 2 测试文件；`brief-update.test.ts` 增补 `catalogVersion` 键用例（不改既有断言）；
5. 治理收尾：README 总表增 810 行、偏差清单 B-40 登记（B-41 另立包登记）、版本记录增行。

### 4.2 不做（显式排除）

- 不做「采纳即全链路提示词重出」联动（§8.3 改风格流程属另域，未建包）；
- 不做忽略持久化（零新状态文件；持续提示是 §8.3 语义本身）；
- 不做 TABS/条目卡片全量真实化（B-41 另立包）；
- 不做项目列表级批量检测 / 常驻角标（检测时机 = VisualCatalog 面板打开/项目切换）；
- 不动 loader/crossCheck/DRIFT 机制与 `parse-md` 既有解析（结构漂移是开发态错误，与内容升级正交；J.3 解析独立）；
- MCP 工具面零变更（showrunner 无改动——提示差异是平台系统行为非 Agent 行为）；
- 不改 `STYLE_REGISTRY` 与谱系条目内容（谱系升级本身走 §8.3 单回路，不在本包）；演示假数据不写入真实谱系；
- 无新依赖、无新动画 token。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | 差异检测：版本一致 → `hasUpgrade:false`；不一致 → 版本对 + 引用条目现况（存在性/role/明细当前值）+ J.3 版本区间条目；无 J.3 段 → `changelogUnavailable:true`；引用 ID 已移除 → `removed:true` 且 `blocking:true` | 单测 |
| AC2 | J.3 解析：多版本节正确切分、区间 `(registered, current]` 过滤正确、段缺失/空段两态、解析失败不拖垮 loader（独立 try） | 单测 |
| AC3 | `style:catalog` IPC 返回与 MCP `style.catalog` 同形状（version/count/entries）；`style:upgrade-diff` 未立项/无 style 字段 → 显式空态而非抛错 | 单测 |
| AC4 | `brief:update` style 白名单 +`catalogVersion` 键：合法字符串写盘且恒 mark 立项单版本 +1；非字符串拒绝 `INVALID_ARGUMENT`；采纳前置校验目标版本 ≠ 当前谱系版本 → 拒绝 | 单测 |
| AC5 | VisualCatalog：头部徽章来自 IPC 实时版本；`hasUpgrade:false` 无升级提示（或显已最新）；`hasUpgrade:true` 面板显真实版本对与差异条目；采纳调 `updateBrief` 且 blocking/未立项时禁用；忽略仅关闭零调用 | 组件单测 |
| AC6 | 回归红线：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量以 T1 实测基线（上包收尾 53 文件 586 passed / 0 failed / 1 skipped）为准，passed 不减少、skip 不增、测试文件净增恰 2 | 全量回归 |
| AC7 | 真机：立项单 `catalogVersion` 改旧模拟 → 面板差异提示（真实版本对）→ 采纳 → 立项单版本 +1 且 `catalogVersion` 升、面板转已最新 → 改旧再开 → 忽略 → 再开仍提示 | 真机 |
