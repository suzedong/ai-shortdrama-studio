# SDG-RE · 契约 · feature-012 视觉风格谱系系统资产

> 版本：v1.0（待用户签字）
> 日期：2026-10-06
> 卡口：本契约触发 **K6**（新增 renderer 页面/纯函数模块）、**K8**（renderer 内部新增页面开关状态与组件 props 接线；不新增 IPC）。**不触发 K1**（不改 `shared/types.ts`）、**不触发 K3**、**不触发 K9**（零新依赖）。用户签字即视为对 K6/K8 的授权，实施时仍须在变更记录追加永久决策条目。
> 兼容：不新增 npm 依赖；不改变任何持久化数据结构与工作流语义。

---

## 1. 数据事实源契约（单一事实源，禁止复制）

- 谱系数据唯一来源：[style-catalog.ts](../../../electron/style-catalog.ts) 导出的：

```ts
export const CATALOG_VERSION: string                 // 'v1.45'
export const FORMS: readonly ['仿真人','2D 漫','3D 漫','沙雕漫']
export interface CatalogEntry {
  family: string
  name: string
  tier: '主' | '备'
  visualFeatures: string
  anchorWords: string
  qualityRecipe: string
  feasibility: string
}
export const STYLE_CATALOG: CatalogEntry[]            // 18 项
```

- 查看页与 prompt 均直接 import，**禁止**在 renderer/electron 另建谱系 md/JSON 副本。
- renderer 已有 import 先例（[CandidateCards.tsx L2](../../../src/components/messages/CandidateCards.tsx#L2)），不构成新增跨层依赖。

---

## 2. 查看页容器与开关契约（K6/K8）

### 2.1 新增模块

| 模块 | 职责 |
| :-- | :-- |
| `src/lib/styleCatalogView.ts` | 纯函数：搜索过滤 + 家族分组（无 React、可单测） |
| `src/components/StyleCatalogPage.tsx` | 只读页面组件：头部 + 搜索框 + 分组卡片 + 空态 |

### 2.2 纯函数签名

```ts
import type { CatalogEntry } from '../../electron/style-catalog'

export function filterCatalog(list: CatalogEntry[], keyword: string): CatalogEntry[]
export function groupByFamily(list: CatalogEntry[]): { family: string; entries: CatalogEntry[] }[]
```

判据：

- `filterCatalog`：`keyword.trim()` 为空 → 原列表；否则返回 `name` 或 `anchorWords` 中**含关键词（大小写不敏感）**的项（匹配前对字段与关键词均 `trim()`；英文锚点词按 `toLowerCase()` 子串匹配）。
- `groupByFamily`：按 `STYLE_CATALOG` 中家族首次出现顺序分组（保证 A→E 次序），不重新排序家族；组内保持原列表顺序。

### 2.3 页面 Props

```ts
interface Props {
  onClose: () => void
}
```

- 组件内部持有搜索输入 state（`useState('')`）；数据经 `filterCatalog(STYLE_CATALOG, kw)` → `groupByFamily(...)` 派生。
- 头部：标题「系统资产 · 视觉风格谱系」、版本徽标（`CATALOG_VERSION`）、形态（`FORMS.join(' / ')`）、右上角「关闭」按钮（调 `onClose`）。
- 支持 **Esc 键关闭**（`useEffect` 注册 `keydown`，卸载时移除）。
- 卡片 testid 约定（供测试）：
  - 页面根：`style-catalog-page`
  - 搜索框：`style-catalog-search`
  - 家族分组标题：`catalog-family`
  - 单张画风卡：`catalog-card`（含 `data-name=<name>`）
  - 空态：`catalog-empty`

### 2.4 挂载方式（不新增路由库）

- App 新增布尔 state：`const [catalogOpen, setCatalogOpen] = useState(false)`。
- 在 App 主布局中，`catalogOpen` 为真时渲染 `<StyleCatalogPage onClose={...} />` 为**覆盖整个应用主区域的遮罩层**（`fixed inset-0 z-50 bg-canvas`，覆盖 header 与三栏；不引入 react-router）。
- 打开/关闭**仅切换该布尔值**：不触碰 nodes / phase / gate / 消息，不触发任何 IPC 与 autosave。
- 容器留最小扩展位：页面标题区为"系统资产"，当前唯一分区即谱系；**不实现**资产列表/多资产 tab 等空框架。

---

## 3. 双入口契约（K8）

### 3.1 顶栏入口

- [App.tsx header 操作区](../../../src/App.tsx#L1577) 在「运行时」按钮前新增「系统资产」按钮：

```tsx
<button type="button" onClick={() => setCatalogOpen(true)} data-testid="open-system-assets"
  className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-muted hover:text-ink">
  系统资产
</button>
```

- 位于 `WebkitAppRegion: 'no-drag'` 容器内，可点击。

### 3.2 0-c 候选卡快捷链接

- [CandidateCards.tsx](../../../src/components/messages/CandidateCards.tsx) `BriefCandidateCard` 的视觉风格块谱系徽标行，新增「查看谱系」按钮：

```tsx
<button type="button" onClick={onViewCatalog} data-testid="view-catalog-link"
  className="text-[10px] text-violet hover:underline">
  查看谱系
</button>
```

- Props `BriefCandProps` 新增可选 `onViewCatalog?: () => void`；App 在渲染该候选卡处传入 `() => setCatalogOpen(true)`。未传时按钮不渲染（避免无接线场景出现死按钮）。
- 两入口操作同一 `catalogOpen`、打开同一 `StyleCatalogPage`。

---

## 4. 0-c prompt 目录注入契约（F3）

### 4.1 目录拼装改造

[prompts.ts L47](../../../electron/prompts.ts#L47) 将单行四列改为**每条画风一个多行块**，含全部正文字段。形如：

```
- 【A 写实影像系】拟真人·仿真人动漫（主 · ●高）
  视觉特征：<visualFeatures>
  锚点词：<anchorWords>
  质感配方：<qualityRecipe 原样，含换行>
```

实现要点：

- 由 `STYLE_CATALOG.map(...)` 生成；`qualityRecipe` 含 `\n`，注入块对其换行做缩进或直接保留（保证模型可读、可照抄）。
- 分隔线/标题保留「画风目录」引导语。

### 4.2 选型规则与输出不变

- 维持 [prompts.ts L54–L59](../../../electron/prompts.ts#L54-L59) 全部规则文案（含 L56「anchorWords 与 qualityRecipe 照抄目录…不得自造」）；现在目录已提供原文，规则可被执行。
- 输出 JSON schema（form/mainStyle/family/auxiliaryStyle/feasibility/l2Anchor/l1World/qualityRecipe/anchorWords/rationale/fiveElements）字段与含义不变。
- `buildVisualStylePrompt` 签名与 user 段不变。

### 4.3 受影响测试适配（不放松实质约束）

[revise-text.test.ts L79–91](../../../src/test/revise-text.test.ts#L79-L91)：

- 旧断言 L87–88 用 `^- .+｜.+｜主｜●` 单行正则计数 11/7，新格式不再是单行四列，改为断言：
  - `p.system` 中 18 个画风名均出现（可遍历 `STYLE_CATALOG` 逐个 `toContain(s.name)`）；
  - 每条画风的 `anchorWords` 正文被注入（遍历 `toContain(s.anchorWords)`）；
  - 主/备计数按新标记（如 `（主 ·` 出现 11 次、`（备 ·` 出现 7 次）。
- 保留并继续强化 L81–85、L90 的实质断言（版本号、禁止目录外、照抄、备档、六要素）。
- 不得通过删断言使测试变绿；适配后约束等价或更强。

---

## 5. 持久化 / IPC 契约

- **无新增 IPC**，preload / global.d.ts / main.ts / session.ts 不变。
- 查看页不读写任何项目文件，不写入 manifest，不影响 `readFinalized`。
- 页面开关不进入 WorkflowState（纯前端临时态，重启即关，不持久化）。

---

## 6. 异常规则汇总

1. 搜索关键词无命中：渲染 `catalog-empty` 空态，分组区为空，不报错。
2. `qualityRecipe` 等字段换行：以 `whitespace-pre-wrap` 渲染，不压成一行。
3. Esc 与关闭按钮等价：仅触发 `onClose`；关闭后状态完全恢复。
4. 候选卡未接 `onViewCatalog`：不渲染快捷链接（不出现无行为按钮）。
5. 任何实现不得增删/改名契约字段；冲突按 L1/L2/L3 处理。

---

## 7. 验收映射

见任务清单 AC 表（AC-1 ~ AC-8 与需求规格 §5 对齐）。
