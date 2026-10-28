# SDG-RE-契约 ｜ feature-011 影响评估面板与批量重生成

> **本契约是实施边界**。白名单（§4）外的任何文件 diff 一律禁止；实施中一旦触碰未登记卡口（K1/K8/K9 等，含需求规格 §7 条件触发型），立即停手 → 呈报 → 用户确认 → 变更记录追加决策，四步缺一不可。
> **卡口声明**：默认方案 K1 / K8 / K9 **零触发**；条件触发项（D1-B 批量工具 / D3 留痕回写）以用户拍板为准，未拍板前按推荐项（零触发）执行。
> 事实源与行号引用均以 2026-10-28 实测为准（见需求规格 §1.5 基线）。

---

## 1. 数据面契约

### 1.1 消费的数据模型（全部既有，零新增零修改）

| 模型 | 出处 | 面板消费点 |
| :-- | :-- | :-- |
| `ImpactItem { nodeId, step, title, severity, fields, defaultAction }` | electron/brief/impact.ts L9 | 分组（severity）/ 行渲染（title/step/fields）/ 默认勾选（defaultAction）/ 批量模板（nodeId/title/fields） |
| `ImpactAssessment { fromVersion, toVersion, changes, items, counts }` | impact.ts L18 | 自动弹出入口的数据形（经 BriefUpdateResult 子集） |
| `ImpactReportFile { kind:'brief-impact-report', fromVersion, toVersion, changes, items[]&{decision} }` | impact.ts L27；tools.ts L760 | 黄条手动入口 fileRead 回读形 |
| `BriefUpdateResult { version, jsonPath, mdPath, impactReportPath, changes, items, markedDirty }` | electron/brief/update.ts L34 | updateBrief 返回值直接消费（Stage0View L349-372 现丢弃，本包接线消费） |
| `CanvasDirty.impactReport` | shared/types.ts L351-374（**只读消费，零 diff**） | 黄条入口定位影响清单文件名 |

### 1.2 面板内存态（renderer 私有，不进 shared / 不落盘）

```ts
// 面板勾选态：nodeId → 勾选布尔；初值由 defaultAction 映射（'regenerate'→true / 'mark'→false）
// 数据源归一：两个入口（BriefUpdateResult / ImpactReportFile）归一为面板视图模型
//   { changes: BriefChange[]; items: ImpactItem[] }（decision 字段展示为只读留痕，不参与勾选）
```

规则表：

| 规则 | 口径 |
| :-- | :-- |
| 分组 | `severity==='high'` 入高优先级组、`'medium'` 入中优先级组；组内保持 items 原序 |
| 默认勾选 | `defaultAction==='regenerate'` 预勾；`'mark'` 不勾；用户可双向改勾 |
| 计数 | 按钮文案 `一键重生成选中 (N)`，N = 勾选数；N=0 禁用 |
| 空清单 | `items.length===0` 不自动弹出；手动入口遇空清单 / 读取失败 → 面板内降级提示，不阻断不崩溃 |
| decision 展示 | 手动入口回读的 `items[].decision`（恒 `'mark'`，D-017）仅作留痕展示，不可编辑、不回写 |

## 2. 通道契约（零新 IPC / 零新 MCP 工具）

| 通道 | 用途 | 现状实证 |
| :-- | :-- | :-- |
| `window.api.updateBrief(patch)` 返回值 | 自动弹出数据源 | global.d.ts L76-96（既有，零 diff） |
| `window.api.fileRead({ path })` | 黄条入口回读 `影响清单.vN-vM.json`（path = 项目根相对路径，取 `dirty.impactReport`） | global.d.ts L177（既有沙箱只读，零 diff） |
| `canvas.get / canvas.onChange` | 脏态刷新与清脏消退 | global.d.ts L159-163（既有订阅，零 diff） |
| `handleSend(text)` | 批量模板消息注入（StudioApp L318 既有，→ 808 promptAsync） | StudioApp.tsx L318 / L798（既有，调用方接线零语义改动） |

**红线**：preload.ts / global.d.ts / electron/ 全目录零 diff；showrunner.md 默认零 diff（批量消息沿用【产物重新对齐】既有前缀，R-008 词表零扩展；确需增补时归 feature-001 变更记录 R 节并先呈报）。

## 3. renderer 契约

| # | 约定 |
| :-- | :-- |
| 3.1 | 新建 `src/studio/impact/` 目录：纯函数层 + 面板组件（拆分对齐 008/009「纯函数层 + 组件」先例） |
| 3.2 | 面板挂 StudioApp 层（与 RealignConfirm 同级，L738-740 先例）；打开状态由 StudioApp 持有；Stage0View 经 props 回调上报 updateBrief 结果；查看器黄条新钮经 props 回调请求打开（穿透深度 ≤ 现有 onRequestAlign 模式） |
| 3.3 | 查看器黄条仅在既有结构内追加一个按钮（StudioViewer.tsx L620-638 块内），既有漂移文案行（L626）与「一键对齐」钮（L628-635）零回归；按钮出现条件 = `node.dirty.impactReport` 非空 |
| 3.4 | 画布顶栏 banner（CanvasBoard L620-629）与 RealignConfirm 组件**零 diff**（非阻断纯提醒 / 单产物确认语义维持） |
| 3.5 | Stage0View DirtyBar（L232-245）默认零 diff（保存后已自动弹出，不重复入口）；submitBriefEdit 仅在成功后追加上报调用，既有校验 / 错误条 / onClose 语义零回归 |
| 3.6 | 面板非阻断：不锁画布交互；Esc / 背景点击关闭策略与 RealignConfirm 对齐（防误触语义，007 契约 §3.2 先例）；data-testid 锚点前缀 `data-impact-panel-*`（新锚点，不占用既有 testid） |
| 3.7 | dev-mock-api.ts 增补：updateBrief mock 返回携带 items/changes 的演示结果 + DEMO_FILES 增补演示影响清单（string 工厂，format:'md'/json 对齐既有 fileRead 桩模式）；既有演示行为零回归 |

## 4. 最小 diff 白名单

### 4.1 新增（恰 3 个代码文件 + 恰 2 个测试文件）

| 文件 | 内容 |
| :-- | :-- |
| `src/studio/impact/impact-select.ts` | 纯函数层：数据归一（两入口 → 视图模型）/ 分组 / 默认勾选映射 / 计数 / 批量模板消息构建（buildRealignPrompt 同源扩展） |
| `src/studio/impact/ImpactPanel.tsx` | 面板组件（改动字段摘要区 + 分组勾选列表 + 三动作行） |
| `src/studio/impact/impact-panel.test.tsx` | 组件 + 纯函数单测 |
| `src/studio/viewer/studio-viewer.test.tsx` 内新增用例组 | 黄条新钮渲染 / 点击回读重开 / 降级（**修改既有文件见 4.2**） |
| `src/dev-mock-api.ts` 增补 | 见 4.2 |

### 4.2 修改（恰 4 个既有代码文件 + 按需测试文件）

| 文件 | diff 性质 |
| :-- | :-- |
| `src/studio/shell/StudioApp.tsx` | 面板 state + 打开 / 关闭回调 + 批量模板消息经 handleSend 注入 + RealignConfirm 同级挂载；既有 handleOpenNode / 确认三动作 / navBadge 逻辑零回归 |
| `src/studio/stage0/Stage0View.tsx` | submitBriefEdit 成功后上报 updateBrief 结果（items>0 才触发）；其余零回归 |
| `src/studio/viewer/StudioViewer.tsx` | 黄条块内追加「查看影响评估」钮 + 点击回调；L620 注释同步更新（「简版无钮」表述过时） |
| `src/dev-mock-api.ts` | updateBrief mock + 影响清单演示桩增补（B-32/B-33 先例） |
| `src/studio/viewer/studio-viewer.test.tsx` | 追加本包用例组（既有用例零 diff） |
| `src/studio/stage0/stage0-view.test.tsx` | 追加上报调用断言（既有用例零 diff；如零断言需求则零 diff） |

### 4.3 文档（建包即存在 + 治理收尾）

`docs/features/feature-011-影响评估面板与批量重生成/` 五文件（本包）；治理收尾追加 `docs/features/README.md` 总表行与 `docs/设计现状与偏差清单.md` 登记行（收尾时同步修正 README §2 过时的「10 族共 27 个」计数表述）。

### 4.4 零 diff 红线

`shared/types.ts`（K1）｜ `electron/` 全目录（含 tools.ts / update.ts / impact.ts）｜ `electron/preload.ts` ｜ `src/global.d.ts` ｜ `package.json` / lock（K9）｜ `resources/opencode/agents/showrunner.md`（默认）｜ `CanvasBoard.tsx` ｜ `RealignConfirm.tsx` ｜ 806 漂移提醒链路（dirty-drift.ts 及其四处消费点的漂移逻辑）

## 5. 测试契约

基线（2026-10-28 实测）：66 文件 761 passed / 0 failed / 1 skipped；tsc 恰 3 条历史基线。

| # | 测试 | 文件 |
| :-- | :-- | :-- |
| T-① | 归一：BriefUpdateResult 与 ImpactReportFile 两入口 → 同构视图模型 | impact-panel.test.tsx |
| T-② | 分组：high/medium 分两组、组内原序、低级别不出现（输入构造不含 low，断言无额外分组） | 同上 |
| T-③ | 默认勾选：regenerate 预勾 / mark 不勾；改勾后计数同步；N=0 禁用 | 同上 |
| T-④ | 一键重生成选中：点击 → 恰好一次 handleSend，消息含【产物重新对齐】前缀 + 勾选产物清单（nodeId/title/版本对/字段逐项）；未勾选产物不出现在消息中 | 同上 |
| T-⑤ | 仅标记脏 / 取消：零 handleSend 调用、面板关闭回调触发 | 同上 |
| T-⑥ | 空清单不自动弹（items=0 不上报弹窗） | stage0-view.test.tsx 或 impact-panel.test.tsx |
| T-⑦ | 黄条新钮：dirty.impactReport 非空渲染、为空不渲染；既有漂移文案与一键对齐钮断言零回归 | studio-viewer.test.tsx |
| T-⑧ | 黄条点击回读：fileRead 被以 dirty.impactReport 路径调用；清单解析成功 → 打开回调携带归一视图模型；读取失败 / JSON 损坏 → 降级提示不崩溃 | studio-viewer.test.tsx |
| T-⑨ | 全量回归：66 文件基线 + 净增恰 2 测试文件（impact-panel.test.tsx 新增 + 既有文件内用例组），passed 全绿 / 0 failed / 1 skipped | `npm run test:run` |
| T-⑩ | typecheck 零新增：恰 3 条历史基线（canvas-zoom.test.tsx 2 + runtime-client.test.ts 1） | `npx tsc --noEmit` |

## 6. 卡口与越界处置

| 卡口 | 基线（2026-10-28 实测） | 本包处置 |
| :-- | :-- | :-- |
| K1 shared/types.ts | CanvasDirty 六字段（含 markedAt） | **零 diff**。勾选态 renderer 内存化；实施中若浮现共享类型需求 → 停手呈报 |
| K8 工具面 | MCP 11 族 28 工具；showrunner 白名单 23；IPC 面见 global.d.ts 全表 | **零 diff**（D1-A / D3-A 推荐项）。若用户拍板 D1-B / D3 留痕-B → 先呈报工具 / 通道清单再实施 |
| K9 依赖 | package.json 无日期库等无关依赖 | **零新增** |
| 提示词事实源 | showrunner.md R-008 纪律 | 默认零 diff；确需增补归 feature-001 R 节呈报 |
| 越界处置 | — | 任何白名单外 diff、任何「顺手优化」一律禁止；发现既有缺陷另行登记偏差清单，不在本包顺手修 |
