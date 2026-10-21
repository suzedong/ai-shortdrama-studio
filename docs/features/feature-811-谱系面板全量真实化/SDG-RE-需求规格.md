# SDG-RE-需求规格 · feature-811 谱系面板全量真实化

> **包号**：feature-811（8xx 跨阶段平台基础段，谱系同 feature-802/810 域）
> **业务名**：谱系面板全量真实化（VisualCatalog TABS/条目卡片数据驱动 + 对话内风格选项卡版本号真实化 + 硬编码三件套退役）
> **性质**：纯 renderer 消费切换（新建单点缓存 store + 四组件改造 + dev-mock 自具化）；**K1 零触发**（零类型面变更，store 条目形状引用既有 `global.d.ts` `StyleCatalogEntryDto` 镜像，不进 shared）；**K8 零触发**（`style:catalog` IPC 已随 feature-810 登记落地且 entries 十键全返，该包契约 §2.1 明示「后续 B-41 全量面板真实化复用同一通道」；本包纯消费——零新 IPC/零新 MCP/零新推送/零白名单变更）；**K9 零触发**（零新依赖）
> **事实源**：《短剧Agent平台设计.md》§2.6.4（风格引用 = 风格 ID + 谱系版本成对）、§8.3（谱系版本跟踪）；feature-802 既定口径「谱系版本号运行时读 md 不硬编码」（B-05）
> **前置**：feature-802（谱系装载：注册表骨架 + md J.2 明细关联，entries 十键形状）、feature-810（`style:catalog` IPC 返回 `{version,count,entries}`；头部徽章与升级差异面板已真实化；契 D2 将 TABS/条目卡片排除登记 B-41；L1 自决留痕三将 `STYLE_CATALOG_VERSION` 常量真实化与退役归本包）
> **溯源标签**：[Design 原有·形态对齐]（谱系面板数据驱动自 style:catalog 真实谱系，feature-802 既定消费口径）
> **偏差登记**：B-41（本包登记并实施收尾关闭）
> **日期**：2026-10-20

## 1. 背景

feature-810 落地谱系升级差异工作流时，将面板真实化限定于头部徽章与差异面板（契 D2），TABS 六家族计数与 18 条目卡片维持硬编码排除在外，登记 B-41 另立包；同包 L1 自决留痕三：`STYLE_CATALOG_VERSION` 常量因 ChatComposer 与 chat-markdown.test 引用方不在 810 白名单内而物理保留，其真实化与退役一并归本包。

代码实证（2026-10-20 侦察）：

- **TABS 计数硬编码**：[VisualCatalog.tsx](../../../src/studio/VisualCatalog.tsx) L125-132——`全部 18 / A 6 / B 1 / C 5 / D 5 / E 1` 写死；
- **18 条目卡片硬编码**：L33-57 `STYLES` 表（name/st/feat/family/anchor 五字段）是谱系 md J.1/J.2 明细的**代码副本**——谱系升级改 md 后面板仍显旧数据，直接违背 feature-802「运行时读 md 不硬编码」既定口径；
- **弹层明细硬编码**：锚点词显 STYLES 单条 anchor（谱系 J.2 每条多示例被裁剪）；质感配方显通用硬编码文案（「Qwen-Image 系：预览档 Lightning 4 步…」），非谱系真实配方；
- **对话内选项卡版本号硬编码**：[ChatComposer.tsx](../../../src/studio/ChatComposer.tsx) L245 `{entry.name} · {entry.id} @ {STYLE_CATALOG_VERSION}` 消费 VisualCatalog L30 硬编码常量 `'v1.46'`；L165 选项 ID 校验、L215 entry 查找同消费 STYLES；
- **名称查询副本**：[Stage0View.tsx](../../../src/studio/Stage0View.tsx) L19-22 styleRefLabel、[StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) L21-24 同名函数，均经 VisualCatalog L60-62 `styleNameOf` 查 STYLES；
- **数据面已备**：`style:catalog` IPC（feature-810，[main.ts](../../../electron/main.ts) L336-339）返回 `{version, count, entries}`，entries 十键全返（注册表 7 键 id/name/familyCode/familyLabel/role/feasibility/auxiliaryCandidate + md J.2 明细 visualTraits/anchorWords/textureRecipe），renderer 直接可消费——**本包零新 IPC**。

**原则对齐（D-016 系统优先）**：谱系数据拉取、计数实算、字段映射均为规则可枚举的确定性操作——系统直做不经 AI；本包无 Agent 行为变更。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 打开视觉风格谱系面板 | TABS 计数与 18 条目卡片数据驱动自 style:catalog 真实谱系（计数实算、名称/主备/可行度/家族标签与谱系一致）；头部徽章显真实版本（810 已真实化，本包改与条目同源一次拉取） |
| R2 | 创作者 | 打开条目预览弹层 | 锚点词示例显谱系 J.2 原文（多示例全量）；质感配方显谱系 J.2 真实配方（空串 → 该块不显） |
| R3 | 创作者 | 对话内收到风格选项卡 | 选项显「名称 · ID @ 谱系真实版本」+ 主/备徽章；谱系快照未到位或 ID 未收录 → 回退纯文本选项（与既有未收录 ID 同路径） |
| R4 | 谱系维护者 | 谱系升级（改 md 版本号/J.2 明细） | 平台重载后面板计数/条目明细/选项卡版本号同步新值，无任何代码常量需要跟着改 |
| R5 | 创作者 | 谱系不可用（装载失败/无 window.api 环境） | 徽章「谱系不可用」（810 既有口径）；TABS 不显计数、条目区显降级态；选项卡回退纯文本；界面不崩不抛 |

## 3. 核心机制

### 3.1 renderer 单点缓存 store（新建）

`src/studio/style-catalog-store.ts`：模块级快照 `{status, version, entries}` + 订阅——`ensureStyleCatalog(force?)` 幂等拉取（单 flight 去重；`window.api?.styleCatalog` 缺失 → `unavailable` 不抛）；`useStyleCatalog()` hook（订阅 + 首订阅懒 ensure，供组件重渲染）；`getStyleEntry(id)` / `getStyleName(id)` 快照同步查询（快照未到/未收录 → null，调用方回退只显 ID——与 styleNameOf 既有语义兼容）；测试专用快照注入/复位出口。

### 3.2 TABS / 卡片 / 弹层数据驱动

- TABS：key/label 静态保留（五家族为封闭 UI 词汇），count 从 entries 实算（all = entries.length，家族 = familyCode 过滤）；快照未到位/不可用 → 不显计数，条目区显降级态；
- 卡片：name（谱系注册表名）、主/备徽章（role）、可行度浮标（feasibility → ●高/●中/●低）、家族标签（familyLabel 替代 `family.split('·')[0]` 派生口径）；
- 弹层：锚点词 = anchorWords J.2 原文；质感配方 = textureRecipe J.2 原文（空串 → 块不显）；visualTraits 暂不上屏（无既有槽位，entries 已携备用）；
- FAMILY_GRAD / PREVIEW_URL / VIDEO_URL / VID_TABS 静态资源映射保留（非谱系数据副本）。

### 3.3 对话内选项卡真实化

ChatComposer：风格 ID 校验与 entry 查找切换为 store 同步快照查询（快照缺席/未收录 → 纯文本降级，与既有 E99 路径一致）；版本号显快照 version（替代 STYLE_CATALOG_VERSION 常量）；主备徽章判定与 FAMILY_GRAD 兜底键改经 role/familyCode。

### 3.4 三件套退役（物理删除）

`STYLES`（含 `StyleEntry` 接口与 `FAMILIES` 映射，VisualCatalog L7-57）、`STYLE_CATALOG_VERSION`（L26-30 含注释块）、`styleNameOf`（L59-62）全仓物理删除；全部消费方（VisualCatalog/ChatComposer/Stage0View/StudioViewer/dev-mock-api）切换 store；Grep 零引用为验收凭据。

### 3.5 dev-mock 自具化

`src/dev-mock-api.ts` L477 `DEMO_STYLE_CATALOG_ENTRIES = STYLES.map(...)` 去依赖：自具 18 条十键演示表（注释标明浏览器演示数据，不写入真实谱系，同 810 契 D2 口径）；`DEMO_STYLE_CATALOG_VERSION='v1.47'` 与升级演示闭环维持不变。

## 4. 范围

### 4.1 做

1. 新建 `src/studio/style-catalog-store.ts`（§3.1 全量 API + 测试注入）；
2. `src/studio/VisualCatalog.tsx`：TABS 计数实算 + 18 卡片 entries 驱动 + 弹层 anchorWords/textureRecipe 真实化 + 徽章改读 store（与条目同源，抽屉打开 force 刷新，与 810 拉取时机统一）+ 三件套物理删除 + 文件头注释刷新；
3. `src/studio/ChatComposer.tsx`：选项校验/entry 查找/版本号/徽章键切换 store，import 清理（保留 FAMILY_GRAD/PREVIEW_URL）；
4. `src/studio/Stage0View.tsx`：styleRefLabel/styleOptions 切换 store（extra 历史/未来 ID 前置兜底保留）；
5. `src/studio/StudioViewer.tsx`：styleNameOf → getStyleName 平替；
6. `src/dev-mock-api.ts`：DEMO entries 自具化（§3.5）；
7. 测试：`src/studio/style-catalog-store.test.ts` 新建（**净增恰 1**）；`visual-catalog.test.tsx`（catalogSpy entries 补十键夹具 + TABS/卡片/弹层断言增补）、`chat-markdown.test.tsx`（风格选项用例改 prime store 夹具、删常量 import）、`studio-viewer.test.tsx` / `stage0-view.test.tsx`（B-22 名称断言改 prime store 夹具）断言同步；
8. 治理收尾：README 总表增 811 行、偏差清单 B-41 翻态关闭、版本记录增行。

### 4.2 不做（显式排除）

- 主进程 / IPC / preload / `global.d.ts` 零 diff（`style:catalog` 已备且十键全返）；
- 谱系 md / `electron/style/*` 零 diff；`STYLE_REGISTRY` 注册表不动（feature-802 既定「注册表骨架 + md 明细」装载形态不变）；
- 升级差异面板（feature-810 已真实化）字段形状与采纳/忽略流程零 diff；`styleUpgradeDiff` 消费不动；
- FAMILY_GRAD / PREVIEW_URL / VIDEO_URL / VID_TABS 静态资源映射保留；
- TABS key/label 静态文案保留；弹层三档视频区（VIDEO_URL/VID_TABS）形态不动；
- visualTraits 不上屏（无既有槽位，避免新增 UI 面）；
- `StudioApp.tsx` 零 diff（onAdopt toast 的 `family.split('·')[0]` 对 familyLabel 无 '·' 串天然降级为整串，口径变化随真实化，见设计 D3）；
- showrunner / Agent 指令、MCP 工具面、tailwind 配置零 diff；
- 无新依赖、无新推送、无新 data-testid 凭据。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | store：ensure 幂等（重复调用单 flight 去重，ok 后非 force 不再取）；force 刷新重取；成功 → ok + version/entries；失败 → failed；`window.api` 缺失 → unavailable 不抛；getStyleEntry/getStyleName 命中返回条目/名称、未命中/快照缺席 → null；测试注入/复位生效 | 单测 |
| AC2 | VisualCatalog：TABS 计数自 entries 实算（all + 五家族过滤）；卡片名称/主备徽章/可行度浮标/家族标签（familyLabel）与夹具一致；弹层锚点词 = anchorWords 原文、质感配方 = textureRecipe 原文（空串块不显）；徽章与条目同源一次拉取；谱系不可用 → 降级态 | 组件单测 |
| AC3 | ChatComposer：prime 快照后风格选项显「名称 · ID @ 快照版本」+ 主/备徽章；快照缺席或未收录 ID → 纯文本选项；jsdom 无 window.api 渲染不抛 | 组件单测 |
| AC4 | Stage0View / StudioViewer：prime 快照后已知 ID 显「ID · 名称」（查看器主风格带「@ 立项单 catalogVersion」），未知/未来 ID 回退只显 ID；修改立项下拉 = extra 前置兜底 + 快照 entries | 组件单测 |
| AC5 | 三件套物理删除：Grep 全仓零引用（`STYLES` / `STYLE_CATALOG_VERSION` / `styleNameOf` / `StyleEntry` / `FAMILIES`）；dev-mock 零 STYLES 依赖；typecheck 零新增 | 静态验证 |
| AC6 | 回归红线：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量以 T1 实测基线（上包收尾 56 文件 638 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、failed=0、测试文件净增恰 1（56→57） | 全量回归 |
| AC7 | 真机：谱系面板 TABS 计数与谱系 md J.2 各表行数一致、抽查条目卡片字段与谱系一致；弹层锚点词/质感配方 = md 原文；对话内风格选项卡版本号 = md J.0 版本；临时改 md（版本号 + 某条目锚点词，备份先行）→ 重启应用 → 徽章/选项卡/弹层同步新值 → 恢复 md 重启复原（真实化证明） | 真机 |
