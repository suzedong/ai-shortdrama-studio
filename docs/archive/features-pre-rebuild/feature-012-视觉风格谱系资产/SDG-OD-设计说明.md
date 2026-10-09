# SDG-OD · 设计说明 · feature-012 视觉风格谱系系统资产

> 版本：v1.0（待用户签字）
> 日期：2026-10-06
> 上游：SDG-RE-需求规格 v1.0 / SDG-RE-契约 v1.0

---

## 1. 模块总览

```
electron/style-catalog.ts            （既有，不改）谱系唯一事实源
src/lib/styleCatalogView.ts     (新) filterCatalog / groupByFamily 纯函数
src/components/StyleCatalogPage.tsx (新) 只读页：头部+搜索+家族分组卡+空态+Esc
src/components/messages/CandidateCards.tsx  视觉风格块加「查看谱系」链接
src/App.tsx                          catalogOpen state、顶栏「系统资产」按钮、页面挂载
electron/prompts.ts                  目录注入补 visualFeatures/anchorWords/qualityRecipe
```

设计原则：新增能力为**纯函数 + 只读受控组件**；无副作用、无 IPC、无状态库、无新依赖。谱系数据单一事实源，查看页与 prompt 共用。

---

## 2. 交互/状态流

```
                     ┌──────────────────────────────┐
 顶栏「系统资产」──▶  │                              │
                     │  catalogOpen = true          │
 0-c「查看谱系」──▶  │  StyleCatalogPage 全屏覆盖   │
                     │  （不影响 nodes/gate/消息）   │
                     │                              │
 Esc / 关闭按钮 ──▶  │  catalogOpen = false         │
                     └──────────────────────────────┘
```

- 页面内搜索为组件局部 state，不提升、不持久化。
- `catalogOpen` 是 App 层唯一新增状态；开关不触发 autosave（不改变任何运行态依赖项）。

---

## 3. 判据细化

### 3.1 搜索匹配

```ts
export function filterCatalog(list: CatalogEntry[], keyword: string): CatalogEntry[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return list
  return list.filter(s =>
    s.name.toLowerCase().includes(kw) ||
    s.anchorWords.toLowerCase().includes(kw),
  )
}
```

- 仅匹配 `name` / `anchorWords`（契约 §2.2）；不匹配 visualFields，避免命中面过宽难定位。
- 中文无大小写概念，`toLowerCase()` 不影响中文匹配。

### 3.2 家族分组

```ts
export function groupByFamily(list: CatalogEntry[]): { family: string; entries: CatalogEntry[] }[] {
  const order: string[] = []
  const map = new Map<string, CatalogEntry[]>()
  for (const s of list) {
    if (!map.has(s.family)) { map.set(s.family, []); order.push(s.family) }
    map.get(s.family)!.push(s)
  }
  return order.map(family => ({ family, entries: map.get(family)! }))
}
```

- 家族顺序按数据中首次出现（A→E）；搜索过滤后空家族自然不出现。

### 3.3 prompt 注入块

```ts
const CATALOG_BLOCKS = STYLE_CATALOG.map(s =>
  `- 【${s.family}】${s.name}（${s.tier} · ${s.feasibility}）\n` +
  `  视觉特征：${s.visualFeatures}\n` +
  `  锚点词：${s.anchorWords}\n` +
  `  质感配方：${s.qualityRecipe.split('\n').join('\n  ')}`,
).join('\n')
```

- `qualityRecipe` 两行（预览档/标准档），续行缩进两空格保持块结构。
- 体量：较旧四列版约增加 1.5–2K 字符，对 system prompt token 无压力（feature-011 走查已确认可接受）。

---

## 4. UI 设计要点

### 4.1 页面布局

- 遮罩层：`fixed inset-0 z-50 bg-canvas flex flex-col`。
- 头部（`h-12`，下边框）：左侧标题「系统资产 · 视觉风格谱系」；中部/右侧版本徽标（紫底淡色 `v1.45`）+ 形态文案（muted）；右侧「关闭」描边按钮。
- 工具条：搜索框（`w-72`，placeholder「搜索画风名 / 锚点词…」，focus 紫边）。
- 正文：可滚动区，家族为单位纵向堆叠。

### 4.2 家族分组

- 家族标题：`text-xs font-semibold` + 家族下画风计数 muted（如「6 项」）；标题下细分割线。

### 4.3 画风卡片

- 卡片：`rounded-xl border border-line bg-white p-3 space-y-1.5`。
- 标题行：画风名（`text-sm font-medium`）+ tier 徽标（主=紫底 / 备=灰底）+ 可行度（muted）。
- 字段行：label（`text-muted`）+ 内容（`text-xs`）；视觉特征可多句；锚点词等宽字体；质感配方 `whitespace-pre-wrap`。
- 家族内卡片可用单列或双列网格（18 项、含长文本，建议**单列或双列**，OD 倾向双列 `grid-cols-2`，超长卡片高度自适应）。

### 4.4 空态

- 居中 muted 文案「未找到匹配的画风」，testid `catalog-empty`。

### 4.5 入口

- 顶栏「系统资产」与「运行时」同尺寸描边按钮，置于其前。
- 候选卡「查看谱系」为紫色小号文字按钮，放谱系徽标右侧。

---

## 5. 无 IPC / 无持久化

- 全部数据经 import 获得；不新增 preload/main 通道。
- 页面不访问 `window.api`；`catalogOpen` 不入 WorkflowState、不写盘。

---

## 6. 测试设计（只增不减）

| 新文件 / 改动 | 覆盖 |
| :-- | :-- |
| `src/test/styleCatalogView.test.ts`（新） | filter：空串全量、按画风名命中、按锚点词命中、大小写不敏感、无命中空数组；group：家族次序 A→E、组内顺序、过滤后空家族消失 |
| `StyleCatalogPage` 组件测试（新增，testing-library） | 渲染 18 卡/版本/形态、搜索输入实时过滤、空态出现、Esc 触发 onClose、关闭按钮触发 onClose、字段与换行渲染 |
| App 接线测试（新增或扩展） | 顶栏按钮打开页面、候选卡链接打开同一页面、关闭后工作态不变 |
| `revise-text.test.ts`（适配） | 见契约 §4.3：18 画风名/锚点词全量注入、主备计数新标记，实质约束不放松 |

---

## 7. 验收条目（视觉 / 手动走查）

1. 顶栏点「系统资产」：页面打开，显示版本 v1.45、4 形态、A–E 五家族 18 卡。
2. 搜索「胶片」→ 仅余相关画风；搜索英文「cyberpunk」→ 命中「赛博·科幻」；清空恢复。
3. 无意义关键词 → 空态。
4. 0-c 候选卡点「查看谱系」→ 打开同一页面。
5. Esc 与关闭按钮均可关闭；关闭后节点/门/消息无变化。
6. 触发一次真实 0-c：返回的 anchorWords / qualityRecipe 与目录条目逐字一致（验证 prompt 对齐生效；若仍不一致则属模型遵循，另行记录，非平台缺陷）。

---

## 8. 风险与对策

| 风险 | 对策 |
| :-- | :-- |
| 注入全字段后 prompt 变长 | 增量约 2K 字符，文本侧无压力；不改输出 schema |
| 旧单行正则测试失败 | 契约 §4.3 预置等价/更强断言适配，不删约束 |
| 误做成"资产中心"空框架 | 仅标题区留"系统资产"语义，唯一分区为谱系，不实现多资产框架 |
| 页面遮罩阻断/误改工作态 | 仅切换 catalogOpen；不接任何运行态与 IPC，回归手动确认 |
