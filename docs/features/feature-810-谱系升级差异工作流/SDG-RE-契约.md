# SDG-RE-契约 · feature-810 谱系升级差异工作流

> **卡口声明（置顶）**：本包 **K1 零触发**（`StyleUpgradeDiff` 等 DTO 仅主进程/renderer 两端消费，定义于 `electron/style/types.ts` + `src/global.d.ts` 镜像，不进 `shared/types.ts`——同 feature-005 D5 反向适用：三端消费才进 shared）、**K8 触发**（§2：+2 IPC `style:catalog` / `style:upgrade-diff`；`brief:update` style 白名单 +1 键 `catalogVersion`）、**K9 零触发**（零新依赖）。实施中一旦发现必须越界，**立即停手**、回写变更记录并呈报用户裁决。

## 1. 数据面契约（DTO，非 K1）

```ts
// electron/style/types.ts 新增（global.d.ts 镜像）
export interface StyleUpgradeRefEntry {
  id: string                    // 项目引用的风格 ID（mainStyleId / auxiliaryStyleId）
  role: 'main' | 'auxiliary'    // 引用角色
  removed: boolean              // 该 ID 是否已不在当前谱系
  current?: {                   // removed=false 时存在：当前谱系中的现况
    role: 'main' | 'backup'
    auxiliaryCandidate: boolean
    feasibility: 'high' | 'medium' | 'low'
    anchorWords: string[]       // 明细当前值（面板展示用）
  }
}
export interface StyleChangelogEntry {
  version: string               // 'v1.47'
  date?: string                 // 'YYYY-MM-DD'（J.3 节内可缺省）
  items: string[]               // 变更条目，一行一条自由中文简述
}
export interface StyleUpgradeDiff {
  hasUpgrade: boolean           // catalogVersion ≠ 当前谱系 version
  registeredVersion?: string    // 项目引用版本（hasUpgrade=true 时存在）
  currentVersion: string        // 当前谱系版本
  referenced: StyleUpgradeRefEntry[]   // 引用条目现况（主 + 辅，无辅则仅主）
  blocking: boolean             // 任一引用条目 removed=true → 采纳禁用
  changelog: StyleChangelogEntry[]     // 版本区间 (registered, current] 内条目
  changelogUnavailable: boolean        // 谱系无 J.3 段 / 解析失败 → true，面板明示
}
```

| 规则 | 语义 |
|---|---|
| 版本比较 | 逐字字符串相等（与 `style.validate` 的 `STYLE_VERSION_MISMATCH` 同语义），不做语义化版本解析 |
| 旧版内容不可得 | 差异不含「旧值 → 新值」逐字段 diff（旧版 md 已被覆盖）；展示 = 引用条目**现况** + J.3 **变更记录**，面板文案明示此口径 |
| 未立项 / 无 style 字段 | `style:upgrade-diff` 返回 `{ hasUpgrade:false, currentVersion, referenced:[], blocking:false, changelog:[], changelogUnavailable:false, noBrief:true }` 空态（`noBrief` 面板用于禁用采纳并提示「立项后可采纳」），不抛错 |
| J.3 解析独立性 | J.3 解析失败（格式坏）只置 `changelogUnavailable:true`，绝不影响 loader 既有谱系装载与 DRIFT 交叉核对 |

## 2. 通道契约（K8 登记：+2 IPC + 1 白名单扩键；零新 MCP、零新推送）

### 2.1 `style:catalog`（IPC，新）

无入参。返回 `{ version, count, entries }`——与 MCP `style.catalog` 同形状、同经 `loadStyleCatalog()`（不依赖激活项目）。用途：VisualCatalog 头部徽章真实化（后续 B-41 全量面板真实化复用同一通道）。

### 2.2 `style:upgrade-diff`（IPC，新）

无入参（当前激活项目）。返回 `StyleUpgradeDiff`（§1）。内部：读当前项目最新立项单 style → `loadStyleCatalog()` → 版本比对 + 引用条目现况 + J.3 解析。立项单读取失败（无项目/无立项单）按 §1 空态返回。

### 2.3 `brief:update` style 白名单 +1 键 `catalogVersion`（既有 IPC 入参扩展）

[main.ts](../../../electron/main.ts) L248 键枚举 `['mainStyleId','auxiliaryStyleId']` → `['mainStyleId','auxiliaryStyleId','catalogVersion']`；校验同既有键（`typeof string`）；`BriefUpdatePatch['style']` 类型同步 +1 可选键。采纳语义：**仅升版本号**——`updateBriefFields` 恒 mark 追溯、立项单版本 +1、diff 记 `style.catalogVersion` 变化（D-017 机制零改动）。
**采纳前置校验**（renderer 侧）：面板持有的 `currentVersion` 与采纳时 `style:catalog` 重取版本不一致 → 不调 updateBrief，提示「谱系已再升级，请刷新差异」。

### 2.4 preload / global.d.ts

preload +2 invoke 桥（`styleCatalog()` / `styleUpgradeDiff()`）；global.d.ts 镜像 §1 DTO 与两桥签名。**零新推送**（检测时机 = 面板打开/项目切换时主动拉取；采纳后本地状态刷新）。

## 3. 谱系 J.3 段格式契约

谱系 md 增设「J.3 谱系变更记录」段（本包落地 = v1.46 空段骨架 + 格式注释；**B-35 演示假数据不写入**）：

```markdown
## J.3 谱系变更记录
<!-- 每版本一节；谱系升级时由维护单回路（§8.3）追写。平台解析 (项目引用版本, 当前版本] 区间内各节。 -->
### v1.46（2026-10-08）
- （本版起设立变更记录段；此前版本无记录）
```

解析规则：`## J.3` 起至下一个 `## ` 或文末；`### vX.Y（date）` 分节（date 括号可缺省）；节内 `- ` 行 = 条目。版本串逐字匹配（同 §1 版本比较）。

## 4. renderer 契约

### 4.1 VisualCatalog 真实化（局部）

| # | 元素 | 规则 |
|---|---|---|
| V1 | 头部徽章 | 删硬编码 `STYLE_CATALOG_VERSION` 常量；挂载时 `style:catalog` 拉取显真实版本；加载失败显「谱系不可用」降级态 |
| V2 | 升级提示入口 | `hasUpgrade:true` → 显升级提示钮（替代现硬编码演示钮）；`false` → 不显（或置灰显「当前已是最新」，组件内取其一并落测试凭据） |
| V3 | 差异面板 | 真实数据：版本对（registered → current）+ 引用条目现况行（含 removed 标「已移除」）+ J.3 变更条目；`changelogUnavailable` → 显「谱系未提供变更明细」；文案明示「差异 = 引用条目现况 + 谱系变更记录，非逐字段 diff」 |
| V4 | 采纳钮 | `blocking` 或未立项（`noBrief`）→ 禁用 + 原因提示；可用 → 调 `updateBrief({style:{catalogVersion: currentVersion}})`（先按 §2.3 前置校验），成功后刷新 diff（应转 `hasUpgrade:false`） |
| V5 | 忽略钮 | 仅关闭面板，零调用零写入 |
| V6 | 排除项 | TABS 六家族计数、18 条目卡片维持硬编码（B-41 另立包）；演示硬编码数据与 `data-catalog-upg/adopt/ignore` 旧凭据随真实化替换（新凭据 §4.2） |

### 4.2 data-testid 凭据（新增/替换）

| testid | 元素 |
|---|---|
| `style-catalog-version` | 头部版本徽章（真实版） |
| `style-upgrade-entry` | 升级提示入口钮 |
| `style-upgrade-panel` | 差异面板容器 |
| `style-upgrade-versions` | 版本对文案 |
| `style-upgrade-ref` | 引用条目现况行（带 `data-style-id`） |
| `style-upgrade-changelog` | 变更记录列表 |
| `style-upgrade-changelog-empty` | 「谱系未提供变更明细」态 |
| `style-upgrade-adopt` / `style-upgrade-ignore` | 采纳 / 忽略钮 |

## 5. 最小 diff 描述

- **新增（3）**：`electron/style/upgrade.ts`、`src/test/style-upgrade.test.ts`、`src/studio/visual-catalog.test.tsx`；
- **修改（≤7）**：`electron/style/types.ts`（+DTO）、`electron/main.ts`（+2 handle + 白名单 +1 键）、`electron/preload.ts`（+2 桥）、`src/global.d.ts`（DTO 镜像 + 桥声明）、`src/studio/VisualCatalog.tsx`（V1–V6）、`src/dev-mock-api.ts`（style mock）、`src/test/brief-update.test.ts`（增 `catalogVersion` 键用例，不改既有断言）、`resources/H3-Style/AI短剧制作视觉风格谱系.md`（J.3 空段骨架）；
- **文档（4）**：本包 5 文件、`docs/features/README.md`（增 810 行）、`docs/设计现状与偏差清单.md`（B-40 登记 + B-41 另立包登记）、`版本记录.md`（增行）；
- **零 diff 红线**：`shared/types.ts`、`electron/brief/*`（updateBriefFields 机制零改动）、`electron/gate/*`、`electron/canvas/*`、`electron/style/loader.ts`、`electron/style/parse-md.ts`、`electron/style/catalog.ts`、`electron/mcp/tools.ts`、`resources/opencode/agents/*.md`、`tailwind.config.js`、`package.json`、其余既有测试文件。

## 6. 测试契约

- 主进程（`src/test/style-upgrade.test.ts`，内存 tmpdir 造立项单 + mock 谱系 md 多版本 J.3）：AC1–AC4 全覆盖——版本一致/不一致、引用条目现况（主+辅/无辅）、removed→blocking、J.3 区间过滤与缺失两态、解析失败降级、`style:catalog` 形状、未立项空态、`catalogVersion` 键合法/非法/恒 mark；
- 组件（`src/studio/visual-catalog.test.tsx`，window.api 内存 mock）：AC5 全覆盖——徽章真实版本、四态入口、面板真实渲染、采纳禁用两因（blocking/noBrief）、采纳调用参数、忽略零调用；
- **回归红线**：typecheck 仅 3 条历史基线零新增；全量以 T1 实测基线（上包收尾 53 文件 586 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、测试文件净增恰 2。

## 7. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| 发现差异必须含「旧值→新值」逐字段 diff（要求平台存旧版谱系快照） | 超契约口径（§1「旧版内容不可得」）→ 停手呈报（现状评估：不做，现况+变更记录双来源已覆盖 §8.3「提示差异」语义） |
| 需要采纳即触发提示词重出评估 | 越出采纳语义 → 停手呈报（现状评估：不做，属改风格流程另域） |
| 需要忽略持久化（项目级「已忽略到 vX」状态文件） | 新状态面 → 停手呈报（现状评估：不做，持续提示即 §8.3 语义） |
| 需要给 showrunner 增 MCP 差异查询工具 | K8 工具面扩项 → 停手呈报（现状评估：不做，提示差异是平台系统行为） |
| TABS/卡片真实化顺手做掉 | 越出白名单 → 停手；登记 B-41 另立包 |
| 需要新依赖 / 新动画 token | 触发 K9 或配置红线 → 停手呈报（现状评估：不需要） |
