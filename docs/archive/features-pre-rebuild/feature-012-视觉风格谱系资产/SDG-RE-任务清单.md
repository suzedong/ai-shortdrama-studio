# SDG-RE 任务清单 · feature-012 视觉风格谱系系统资产

> 版本：v1.0（待用户签字）
> 日期：2026-10-06
> 前置：feature-005/006/011 已闭环；renderer 已可 import `electron/style-catalog.ts`。本 Feature **不新增 npm 依赖**。
> 卡口状态：触发 **K6**（新增 `src/lib/styleCatalogView.ts`、`src/components/StyleCatalogPage.tsx`）、**K8**（App `catalogOpen` state、顶栏按钮、候选卡 props 接线）。**不触发 K1/K3/K9**。用户对本任务包签字即视为授权；实施时在变更记录逐条追加永久决策。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`、`docs/governance/AI-SDG-AI工具执行指令.md`
- [x] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`、`SDG-OD-设计说明.md`
- [x] `electron/style-catalog.ts`（CATALOG_VERSION / FORMS / CatalogEntry / STYLE_CATALOG；只读事实源）
- [x] `electron/prompts.ts`（CATALOG_LINES、VISUAL_SYSTEM、buildVisualStylePrompt）
- [x] `src/App.tsx`（header 操作区 L1570–1597、主布局挂载点、state 声明区）
- [x] `src/components/messages/CandidateCards.tsx`（BriefCandidateCard、BriefCandProps、谱系徽标行）
- [x] `src/test/revise-text.test.ts`（VISUAL prompt 断言 L69–98）
- [x] `src/test/style-catalog.test.ts`（谱系形状锁定）
- [x] `tailwind.config.js`、`package.json`（零依赖确认）

> 禁止读取与修改清单以外文件，除非实施中明确需要（如新增测试、渲染候选卡的接线处）。

## 1. 签字前置

- [ ] T0-1 用户对需求规格 v1.0 / 契约 v1.0 / OD v1.0 / 任务清单 v1.0 逐项签字（NotifyUser 审批）
- [ ] T0-2 用户确认 K6 / K8 卡口授权（本文件头部已列明，签字即确认）
- [ ] T0-3 确认本 Feature **不动 shared/types.ts**（无 K1）

## 2. 原子任务

### T1 · 纯函数层（K6）

- [ ] T1-1 新建 `src/lib/styleCatalogView.ts`：`filterCatalog`（契约 §2.2 / OD §3.1）、`groupByFamily`（OD §3.2）
- [ ] T1-2 新建 `src/test/styleCatalogView.test.ts`：空串全量 / 画风名命中 / 锚点词命中 / 大小写不敏感 / 无命中空数组；分组家族次序与组内顺序、过滤后空家族消失

### T2 · 查看页组件（K6）

- [ ] T2-1 新建 `src/components/StyleCatalogPage.tsx`：头部（标题/版本/形态/关闭）、搜索框、家族分组卡片、空态；testid 按契约 §2.3
- [ ] T2-2 Esc 键关闭（useEffect 注册/清理）；质感配方 `whitespace-pre-wrap`
- [ ] T2-3 组件测试：渲染 18 卡/版本/形态、搜索实时过滤、空态、Esc 与关闭按钮触发 onClose、字段与换行渲染

### T3 · App 接线与双入口（K8）

- [ ] T3-1 App 新增 `const [catalogOpen, setCatalogOpen] = useState(false)`；挂载全屏遮罩 `<StyleCatalogPage onClose={() => setCatalogOpen(false)} />`
- [ ] T3-2 header 操作区新增「系统资产」按钮（testid `open-system-assets`，onClick 打开）
- [ ] T3-3 `BriefCandProps` 加可选 `onViewCatalog?`；视觉风格块加「查看谱系」按钮（未传不渲染）；App 渲染候选卡处接线
- [ ] T3-4 接线测试：顶栏/候选卡两入口打开同一页面、关闭后工作态不变、开关不触发 IPC/autosave

### T4 · 0-c prompt 目录对齐（F3）

- [ ] T4-1 改 `prompts.ts`：目录由单行四列改为多行块，注入 visualFeatures/anchorWords/qualityRecipe（契约 §4.1 / OD §3.3）
- [ ] T4-2 选型规则文案与输出 JSON schema 保持不变
- [ ] T4-3 适配 `src/test/revise-text.test.ts`（契约 §4.3）：18 画风名/锚点词全量注入、主备计数新标记；不删实质约束

### T5 · 回归与自检

- [ ] T5-1 `npm run typecheck`（tsc 无错）
- [ ] T5-2 `npm run test`（全部既有测试 + 新增测试，只增不减）
- [ ] T5-3 `npm run build` 通过
- [ ] T5-4 手动回归（OD §7）：顶栏/候选卡打开、搜索过滤与空态、Esc/关闭、真实 0-c 照抄核对

## 3. AC 自检表

| AC | 自检方式 | 任务 |
| :-- | :-- | :-- |
| AC-1 | 组件测试 + 手动：顶栏打开、版本/形态/5 家族 18 卡 | T2/T3/T5 |
| AC-2 | 组件测试：卡片六字段、换行 | T2 |
| AC-3 | 组件测试 + 手动：搜索过滤/空态/清空 | T1/T2/T5 |
| AC-4 | 接线测试：候选卡链接与顶栏同一页 | T3 |
| AC-5 | 手动：只读、关闭后状态不变 | T3/T5 |
| AC-6 | prompt 测试：全字段注入、schema 不变 | T4 |
| AC-7 | 单测/实现核对：数据来自常量、无副本 | T1/T4 |
| AC-8 | typecheck/test/build | T5 |
