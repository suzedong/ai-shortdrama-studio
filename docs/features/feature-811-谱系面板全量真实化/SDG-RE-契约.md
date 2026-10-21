# SDG-RE-契约 — feature-811 谱系面板全量真实化（B-41 收尾）

> **卡口声明（建包登记）**：本包 **K1 / K8 / K9 全零触发**——
> - **K1 零**：不改 `shared/types.ts`、不改 `src/global.d.ts`、不改 `electron/preload.ts`；store 条目形状直接引用既有 `StyleCatalogEntryDto`（global.d.ts L43-54，十键与 main.ts 返回 1:1）；不新增任何跨进程类型。
> - **K8 零**：`style:catalog` 通道已随 feature-810 登记（main.ts L336-339，返回 `{ version, count, entries }`，entries 十键全返）；本包纯消费，主进程 / preload 零 diff；`style:upgrade-diff`、`brief:update` 零 diff。
> - **K9 零**：零新依赖、零配置变更、零 data-testid 新增（沿用既有 `data-cat-*` / `data-preview-*` / `style-catalog-version` / `style-upgrade-*`）、tailwind / 构建脚本零 diff。
>
> 实施中一旦触碰上述任一项 → **立即停手**，按对应卡口流程呈报用户裁决（§6 处置表）。

## 1. 数据面契约

### 1.1 新建 store（`src/studio/style-catalog-store.ts`）

```ts
import { useSyncExternalStore } from 'react'

export interface StyleCatalogState {
  status: 'idle' | 'loading' | 'ok' | 'failed' | 'unavailable'
  version: string | null
  entries: StyleCatalogEntryDto[]  // 引用既有全局类型，零新类型面
}

export function ensureStyleCatalog(force?: boolean): void
export function useStyleCatalog(): StyleCatalogState
export function getStyleEntry(id: string): StyleCatalogEntryDto | null
export function getStyleName(id: string): string   // 未收录 → null 回退（兼容 styleNameOf 语义）
export function _setStyleCatalogSnapshotForTest(s: Partial<StyleCatalogState> | null): void
```

| 规则 | 约定 |
| :-- | :-- |
| 单 flight | `loading` 中重复 `ensure` 直接返回；完成后 `status` 翻 `ok` / `failed` |
| force | 仅 `force === true` 或状态 ∈ `{idle, failed}` 才真发 IPC；`ok` / `unavailable` 下普通 `ensure` 为 no-op（**关键**：防止挂载懒 ensure 覆盖测试 prime 的快照） |
| 同步读 | `getStyleEntry` / `getStyleName` 只读模块级快照、不触发拉取（保 Stage0View / StudioViewer 纯函数语义） |
| 降级 | `window.api?.styleCatalog` 缺失（jsdom）→ `status='unavailable'`，不抛异常、选项回退纯文本（与既有 E99 未收录路径同一形态）；IPC reject → `failed` |
| 测试隔离 | `_setStyleCatalogSnapshotForTest(null)` 复位 `idle`；组件测试 beforeEach prime、afterEach 复位 |

### 1.2 数据来源映射

`LoadedStyleCatalog.entries` = 注册表骨架（7 键，name 来自注册表）& md 明细（J.2 的 `visualTraits / anchorWords / textureRecipe`）；`version` 来自 md J.0。**md 条目按名称关联、无 ID**——面板 ID 集合即注册表 18 条 `style.id`。

## 2. 通道契约

| 通道 | 方向 | 本包动作 |
| :-- | :-- | :-- |
| `style:catalog` | renderer → main invoke | **纯消费**：store 唯一调用点；feature-810 契约 §2.1 已明示「后续 B-41 全量面板真实化复用同一通道」 |
| `style:upgrade-diff` | renderer → main invoke | 零 diff（810 已落地） |
| `brief:update` | renderer → main invoke | 零 diff |
| 新推送 / 新监听 | — | **零新增**（谱系重载以「重启应用」为操作前提，见需求规格 §4.2-9） |

## 3. renderer 契约

### 3.1 字段映射（数据驱动后的唯一口径）

| 面板元素 | 改造前（硬编码） | 改造后（数据驱动） | 来源键 |
| :-- | :-- | :-- | :-- |
| TABS 数量与顺序 | 5 行手写 | `entries.length`、按 `id` 排序 | `id` |
| TABS key / label | `t1..t5` / `'A系 写实影像'` 等 | `id` / `` `${id}系 ${familyLabel}` `` | `id` + `familyLabel` |
| 卡片名称 | `STYLES[].name` | `entry.name` | `name` |
| 主/备徽章 | `entry.st` | `entry.role`（'主'/'备'） | `role` |
| 可行度浮标 | `entry.p` | `entry.feasibility` | `feasibility` |
| 家族标签 | `FAMILIES[entry.fam].split('·')[0]`（'写实影像'） | `entry.familyLabel`（'写实影像系'） | `familyLabel` |
| 弹层锚点词 | STYLES 硬编码五行 | `entry.anchorWords.join(' · ')` 原文 | `anchorWords` |
| 弹层质感配方 | STYLES 硬编码 | `entry.textureRecipe` 原文；空串 → 该块不显示 | `textureRecipe` |
| 弹层视觉特质 | （STYLES 无此字段） | **不上屏**（无对应 UI 槽位，防范围膨胀） | — |
| 对话内选项卡版本号 | `STYLE_CATALOG_VERSION` 常量 | `state.version ?? ''`；version 为空 → `@` 与版本段不渲染 | `version` |
| 选项卡徽章 / 渐变 | `FAMILY_GRAD[entry.fam]` | `FAMILY_GRAD[famKeyOf(entry.family)]` | `family`（映射函数保留） |
| Stage0View / StudioViewer 名称查询 | `styleNameOf`（STYLES 查找） | `getStyleName`（store 快照查找，null 回退） | `name` |

### 3.2 组件改造点

| 组件 | 改造点 |
| :-- | :-- |
| VisualCatalog.tsx | 删 STYLES / StyleEntry / FAMILIES / STYLE_CATALOG_VERSION / styleNameOf；`useStyleCatalog()` + 首订阅懒 ensure；TABS / 卡片 / 弹层按 §3.1 映射；`onAdopt` payload `family` 改传 `entry.familyLabel`；加载态（idle/loading 且 entries 空）渲染占位行；文件头注释刷新（数据源 = style:catalog 实时） |
| ChatComposer.tsx | L165 校验 / L215 查找 / L245 版本号三处切 store；`import { STYLE_CATALOG_VERSION }` 删除；PREVIEW_URL / FAMILY_GRAD 引用改自 VisualCatalog 的保留导出（或就地保留等价映射，以最小 diff 为准） |
| Stage0View.tsx | L19-22 `styleRefLabel` 内 `styleNameOf` → `getStyleName`；known 集合数据源切换；`extra` 前置兜底逻辑保留不变 |
| StudioViewer.tsx | L21-24 同上切换 |
| dev-mock-api.ts | `DEMO_STYLE_CATALOG_ENTRIES` 自具 18 条演示表（摆脱对 VisualCatalog STYLES 的 import）；`DEMO_STYLE_CATALOG_VERSION='v1.47'` 保留；`demoStyleUpgradeDiff` 闭环不变 |

### 3.3 data-testid 零新增凭据

`data-cat-*`（VisualCatalog 卡片）/ `data-preview-*`（ChatComposer 预览）/ `style-catalog-version` / `style-upgrade-*`（810 差异面板）全部沿用，零新增、零改名。

## 4. 最小 diff

| 类别 | 文件 |
| :-- | :-- |
| 新增（2） | `src/studio/style-catalog-store.ts`；`src/studio/style-catalog-store.test.ts` |
| 修改（9） | `src/studio/VisualCatalog.tsx`；`src/studio/ChatComposer.tsx`；`src/studio/Stage0View.tsx`；`src/studio/StudioViewer.tsx`；`src/dev-mock-api.ts`；`src/studio/visual-catalog.test.tsx`；`src/studio/chat-markdown.test.tsx`；`src/studio/studio-viewer.test.tsx`；`src/studio/stage0-view.test.tsx` |
| 文档（4） | 偏差清单 B-41 行翻态；README 总表增行；本包变更记录 T/X 节回填；（T8 真机记录） |
| **零 diff 红线** | `shared/types.ts`；`electron/**` 全部；`src/global.d.ts`；`src/studio/StudioApp.tsx`；`resources/**`；`tailwind.config.*`；`package.json`；`vite.config.*`；其余 47 个测试文件 |

## 5. 测试契约

| 测试 | 断言点 |
| :-- | :-- |
| style-catalog-store.test.ts（新） | ① 懒加载单 flight（并发 ensure 仅一次 IPC）；② ok 后普通 ensure no-op / force 重拉；③ `window.api` 缺失 → unavailable 不抛；④ IPC reject → failed 可 force 重试；⑤ `getStyleName` 命中 / 未收录回退；⑥ `_setStyleCatalogSnapshotForTest` prime 后挂载懒 ensure 不覆盖 |
| visual-catalog.test.tsx | catalogSpy 夹具补十键（含 anchorWords / textureRecipe / familyLabel）；TABS 行数 = entries 数；卡片名称 / 主备 / 可行度真实化；弹层锚点词原文上屏；textureRecipe 空串块不显 |
| chat-markdown.test.tsx | L184-195 改写：选项卡 `A7 · 拟真人·仿真人动漫`；版本行 `` `A7 @ ${prime 的版本}` ``；'主·已验证' 徽章；E99 纯文本兜底（含 store unavailable 路径） |
| studio-viewer.test.tsx | L158-178 保持绿：'A7 · 拟真人·仿真人动漫 @ v1.46'（版本来自 brief 夹具 `catalogVersion`，非面板常量）；未知 Z9 回退 |
| stage0-view.test.tsx | L452-471 保持绿：L458 / L460 标签；L470 `not.toContain('拟真人')`（extra 兜底） |
| 静态验证 | Grep `STYLE_CATALOG_VERSION` / `STYLES` / `styleNameOf` / `FAMILIES` 在 src 下零引用（FAMILY_GRAD 保留除外） |

## 6. 卡口与越界处置表

| 情形 | 处置 |
| :-- | :-- |
| 面板需要的字段不在十键内（如要展示视觉特质以外的 md 明细） | **K8 停手**：呈报用户裁决是否扩通道，不得擅自改 main.ts |
| 任何类型需要进 `shared/types.ts` / `global.d.ts` | **K1 停手**：本包预设零共享层变更，触发即越界 |
| 想把 TABS label 改为 md 内容或加新 UI 槽位 | **越界**：label 仅由 `id` + `familyLabel` 派生；新槽位须另立任务包 |
| 想把 `visualTraits` 上屏 | **越界**：需求规格 §4.2-6 明示不做 |
| 顺手改 StudioApp.tsx toast / 布局 | **停手**：StudioApp 零 diff 是既定口径（split 天然降级已论证） |
| 需要新依赖 / 新 testid / 配置变更 | **K9 停手** |
