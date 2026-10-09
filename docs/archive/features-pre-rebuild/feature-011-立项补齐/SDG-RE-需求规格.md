# SDG-RE · 需求规格 · feature-011 立项补齐（0-d 生产预检门 + 门禁真实化 + 立项单三 tab）

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 来源标签：[改编]（立项单三 tab / 参考图 / 画布形态对齐 MiniMax Design 与《短剧Agent平台设计》§2.6；底层自研实现）+ [自研新增]（门禁 critical 阻断语义、预检纯函数）
> 上游：feature-001（立项）、feature-005（产物解锁重做）、feature-006（通用产物查看）、feature-010（对话通道全量接入）
> 规格事实源：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §2.6（L116–255）；[MiniMax Design功能与架构参考.md](../../research/MiniMax%20Design功能与架构参考.md)

---

## 1. 背景与问题

Stage 0（立项）全面审查发现 19 项问题。本 Feature 承接用户 2026-10-05 裁决「P0/P1/P2 全做」，一次性修复。问题分组：

### 1.1 P0 · 破坏规格闭环

| # | 问题 | 影响 |
| :-- | :-- | :-- |
| 1 | **缺 0-d 生产预检门**：规格四门只实现三门（0-a/0-b/0-c），0-c confirm 后 brief 直接 done；`PreflightCheck` / `ProjectBrief.preflight` 类型已存在但**无 UI、无编排、不落盘** | 八步闭环口径断链；生产级口径（画幅/视角/背景口径）无处拍板 |
| 7 | **门禁 harness 硬编码通过**：[gates.tsx](../../../src/lib/gates.tsx) 0-b 三项全 `pass:true`、0-c「形态匹配」、1-a「档案一致」、1-b「与大纲一致」均为假通过 | 门禁不反映真实质量 |
| 8 | **门禁无失败阻断**：[GateCard.tsx](../../../src/components/GateCard.tsx) 只有「确认放行/否决重做」，harness 全 ✗ 也能一键放行，无任何警示 | 门禁可被无视，形同虚设 |
| 9 | mock 通道下 0-a 必挂（mockDiagnosis 仅 2 个对标案例，「对标≥3」永远 ✗），且无通道真实状态感知 | 无 Key 用户走不通立项 |
| 11 | **画幅口径不统一**：0-a 后简报画幅写死 `'9:16 竖屏 · 768P–2K'`，与 `fe.aspectRatio` 无关；横屏项目同样显示竖屏 | 立项宪法口径错误，下游取错 |

### 1.2 P1 · 核心体验不符

| # | 问题 |
| :-- | :-- |
| 2 | 立项单无三 tab（规格：六要素 / 视觉风格 / 生产预检）；字段不可编辑、无锁图标 |
| 3 | 0-c 无 2–3 张视觉参考缩略图 |
| 4 | 门禁无「改部分」按钮（规格按钮组：确认拍板 / 改部分 / 否决重做） |
| 12 | 立项单版本写死 `version:1`，反补 / 重拍板不自增 |
| 15 | 应用启动 / 进入立项时无预检项缺失判定（旧会话 brief done 但无 preflight 无提示） |

### 1.3 P2 · 诚实度与打磨

| # | 问题 |
| :-- | :-- |
| 5 | 产物卡缺「来源」角标（Agent 自动产出 / 基于公开数据 / Mock） |
| 6 | 成功立项单未提供「沉淀为 Skill / 模板」入口 |
| 10 | 底栏不诚实：无论有无 Key 一律显示「火山方舟 已连接」绿点 |
| 13 | 背景档案存在**双保存路径**（0-c confirm 保存 + handleArchiveSave 独立保存直推 background done，不走 unlock），行为分叉 |
| 14 | 背景档案无最小字数 / 必填段校验，空模板可锁定 |
| 16 | 项目库（ProjectSidebar）三条硬编码假项目、假搜索、新建无功能 |
| 17 | ChatPanel 输入区三个假入口（✦ Skill / ↥ 上传 / ● H3 自动选配）无交互 |
| 18 | 否决重做无「保留什么 + 修改什么 + 为什么 + 期望结果」反馈结构引导 |
| 19 | 画布无点阵背景 / 节点自动连线（现为 32px 灰条），无对齐参考线 |

---

## 2. 角色与场景

| 角色 | 场景 | 期望效果 |
| :-- | :-- | :-- |
| 创作者（唯一用户） | 0-c 拍板视觉风格后 | 进入生产预检卡，6 项口径可逐项编辑/锁定，过 0-d 门才进入背景档案 |
| 创作者 | harness 有 ✗（尤其 critical）时点确认 | 首次点出红字警示并拦截，二次显式确认才可强制放行 |
| 创作者（无 Key，mock 通道） | 立项诊断 | 0-a 正常可过（mock 补齐 3 案例）；角标与底栏诚实标注 Mock |
| 创作者 | 打开立项单 | 三 tab 切换；字段可就地编辑；锁定字段带锁；视觉风格 tab 含参考图 |
| 创作者 | 想局部调整方案 | 点「改部分」进入修改流，不必整版否决 |
| 创作者 | 重开旧项目（无 preflight） | 立项单 / 门诚实提示预检缺失，可补录；不静默当作合格 |
| 创作者 | 查看项目库 | 只列磁盘真实项目，搜索可用，新建可用 |
| 创作者 | 立项单定稿后 | 可一键沉淀为赛道立项模板（Skill） |

---

## 3. 功能需求

### F1 · 0-d 生产预检门（P0-1）`[自研新增]`

- F1-1 新增纯函数模块 `src/lib/preflight.ts`，导出：

```ts
export function buildInitialPreflight(fe: FiveElements, vs: VisualStyle): PreflightCheck[]
export interface PreflightGuard {
  complete: boolean            // 6 项无缺项（value 去空白非空）
  aspectAligned: boolean       // 预检第 4 项口径与 fe.aspectRatio 一致
  dualRecipe: boolean          // 第 6 项含标准档+预览档（两个档关键词）
}
export function evaluatePreflight(list: PreflightCheck[], fe: FiveElements): PreflightGuard
```

6 项口径与取值初始来源（id 1–6，对应规格 §2.6 表 C）：

| id | name | 初始 value 来源 |
| :-- | :-- | :-- |
| 1 | L1 世界观锚 | `vs.l1World` |
| 2 | L2 锚词表 | `vs.l2Anchor` |
| 3 | 定妆背景口径 | 常量 `'纯色墙面 / 禁具体场景词'` |
| 4 | 画幅口径 | `fe.aspectRatio`（拼成「成片画幅 + 定妆竖版/全身横版尺寸」） |
| 5 | 定妆视角清单 | 常量「六型：胸像/正面表情/3-4 侧/纯侧/全身正/全身背」 |
| 6 | 质感配方双档 | `vs.qualityRecipe` |

初始 `locked:false`。

- F1-2 新增**预检编辑卡**组件 `src/components/PreflightCard.tsx`：渲染 6 行（名称 + 可编辑 value 输入框 + 锁切换）；支持 `viewOnly`；产出变更通过回调上送。
- F1-3 新增 `buildGate0d(list, fe)`（[gates.tsx](../../../src/lib/gates.tsx)），harness：
  - 「预检 6 项无缺项」= `guard.complete`，**critical**
  - 「画幅口径与立项六要素一致」= `guard.aspectAligned`，**critical**
  - 「质感配方双档完整」= `guard.dualRecipe`（非 critical）
  - actions `['confirm','partial','reject']`。
- F1-4 App 编排（详见契约 §4）：0-c confirm 后 **brief 不立即 done**，生成 initialPreflight → push 预检卡 + openGate(0-d)；0-d confirm 时才 `saveProject`（brief 含 preflight、版本号），brief done、background active。
- F1-5 持久化：brief.json 写入 `preflight`；manifest 平铺；`readFinalized` 对 preflight 的处理见契约 §5（无 preflight 的旧 brief 仍可读，但 viewer 标注）。
- F1-6 0-d 纳入 RevisionSource / GateId / replay / revision 映射（K1 + 受控联动）。

### F2 · 门禁真实化（P0-7）`[自研新增]`

替换全部硬编码 pass，规则（详见 OD §3）：

| 门 | 项 | 真实判据 |
| :-- | :-- | :-- |
| 0-b | 六要素完整 | fe 六字段去空白均非空（平台数组长度≥1） |
| 0-b | 平台定位清晰 | `fe.platforms.length ≥ 1` |
| 0-b | 题材有对标验证 | 由诊断结论携带的对标数 ≥3（0-b 接收 diagnosis 参数） |
| 0-c | 形态与题材匹配 | `vs.form` 非空且在 4 选 1 集合内 |
| 1-a | 事实与背景档案一致 | 读取 background archive，校验大纲关键人名/地名在档案中出现（弱校验：主要角色名命中率） |
| 1-b | 与大纲一致 | 小传角色名集合 ⊆ 大纲出现的角色名（反向至少主角名在大纲 logline/主线文本出现） |

> 校验只能基于真实可得数据；数据不可得时该 harness 判 ✗ 并在 label 说明，不得回退为 true。

### F3 · critical 阻断与两步强制放行（P0-8）`[自研新增]`

- F3-1 共享层 `GateCard.harness` 项新增可选 `critical?: boolean`（K1，加性）。
- F3-2 [GateCard.tsx](../../../src/components/GateCard.tsx) 行为：
  - 存在任一 `critical && !pass` 时，点「确认放行」**不执行 onConfirm**：按钮旁/下方出现红字「N 项关键校验未通过，强制放行可能导致返工。再次点击确认强制放行」，按钮文案转「仍要强制放行」；**第二次点击**才真正 onConfirm。
  - 非 critical 的 ✗ 不触发拦截（常规放行）。
  - Agent / runtime 侧不提供自动跳过 0-d 的入口。
- F3-3 阻断状态为组件内 state，切换门 / 卸载时复位。

### F4 · Mock 补齐与通道诚实（P0-9 / P2-10）`[改编]`

- F4-1 [mcp/tools.ts](../../../electron/mcp/tools.ts) `mockDiagnosis` 补齐第 3 个对标案例（保证「对标≥3」成立）。
- F4-2 底栏改为真实状态：根据 ark 是否配置 / runtime 通道状态显示「火山方舟 已连接/未配置」或「Mock 演示数据」；不再无条件绿点。媒体引擎文案保持「待接入」。
- F4-3 产物来源角标（F8）与底栏共用同一通道判定来源。

### F5 · 画幅口径统一（P0-11）`[自研新增]`

- F5-1 0-a 后简报第 4 行画幅由写死改为 `fe.aspectRatio`（经 `effectiveFe`），文案形如 `${fe.aspectRatio} · 768P–2K`。
- F5-2 全应用画幅唯一口径为 `FiveElements.aspectRatio`（deriveFiveElements 已保证派生）；预检第 4 项与 0-d「画幅一致」校验均以此为准。

### F6 · 立项单三 tab + 字段可编辑 + 锁（P1-2）`[改编]`

- F6-1 [ProductViewer.tsx](../../../src/components/ProductViewer.tsx) brief 视图重构为三 tab：「六要素」「视觉风格」「生产预检」。
- F6-2 六要素 tab：字段就地可编辑（题材/平台/时长/集数/基调/画幅；平台为逗号分隔或 tag 输入）；每字段带锁图标，锁定后不可编辑。视觉风格 tab：同构（字段编辑 + 锁）。生产预检 tab：复用 PreflightCard。
- F6-3 编辑结果通过回调上送 App，更新 `fiveElements / feOverride / visualStyle / preflight` 并持久化（manifest + brief）；已锁定字段编辑控件禁用。
- F6-4 锁状态为前端视图态：初始遵循「已过对应门即锁定」（0-b 锁六要素、0-c 锁视觉风格、0-d 锁预检）；用户可手动解锁再改（改动触发既有 unlock/重做链路，不新增旁路）。

### F7 · 视觉参考图（P1-3）`[改编]`

- F7-1 0-c 门卡与视觉风格 tab 展示 2–3 张参考缩略图。图片经文本到图 URL 生成（见契约 §6，使用规定的 text_to_image 接口；prompt 由 `vs` 字段组装、URL 编码；landscape/square 按画幅选尺寸）。
- F7-2 参考图加载失败显示诚实占位（alt + 「参考图加载失败」），不伪造、不隐藏 ✗ 项（0-c 参考图不足 3 张继续按 harness 提示）。
- F7-3 参考图不落入媒体生成红线（此为立项风格示意，非 qwen-image 生产通道；仅在有网络时加载，失败不阻断）。

### F8 · 来源角标（P2-5）`[改编]`

- F8-1 选题诊断卡 / 消息产物区显示来源角标：Mock 通道 = 「Mock 演示」；ark = 「Agent · 火山方舟」；取 ToolResultEnvelope.meta.source（feature-010 已提供）。
- F8-2 角标为纯展示，不改变产物数据。

### F9 · 改部分（P1-4）`[改编]`

- F9-1 门 actions 含 `'partial'` 时，GateCard 显示「改部分」按钮，位于确认与否决之间。
- F9-2 点「改部分」：不关门、不定稿，展开/聚焦输入区并预填引导（进入既有修改流 reviseText / candidate 链路）；消息侧记录 gate-partial（不产生 gate-action confirm）。
- F9-3 makeGateAction 扩展 action 联合 `'confirm'|'partial'|'reject'`（加性，K8 级受控，在变更记录登记）。

### F10 · 版本自增（P1-12）`[自研新增]`

- F10-1 立项单版本不再写死：saveProject 时读取磁盘既有 brief.version，无则 1；任何经门的重拍板 / 反补定稿（0-b/0-c/0-d 再次 confirm）`version + 1`，旧版按既有版本归档规则归档（`版本/<base>.<时间戳><ext>`）。
- F10-2 viewer 显示当前版本号。

### F11 · 入门判定 / 预检缺失提示（P1-15）`[自研新增]`

- F11-1 进入立项 / 打开项目时：brief 已 done 但 preflight 缺失或有空项 → 立项单卡与 viewer 顶部显示黄色提示「生产预检未完成，建议补录」，并提供「去补录 0-d」入口（重开 buildGate0d，不强制阻断旧会话）。
- F11-2 新项目严格：必须过 0-d 才能 brief done（F1-4）。

### F12 · 背景档案：路径合并 + 校验（P2-13 / P2-14）`[自研新增]`

- F12-1 **合并双路径**：删除 handleArchiveSave 独立保存/直推 background done 的旁路；背景档案保存统一经 0-c/0-d 之后的既有锁定流程（saveArchive → makeArchive → 按 unlock/节点规则推进）。
- F12-2 **最小校验**：四个模板段（人物档案/地理关系/时间线/季规划边界）至少保留三段且每段去除模板占位后非空；总字数下限（常量，建议 ≥80 字）。不满足时保存按钮禁用并给出缺段提示。

### F13 · 项目库真实化（P2-16）`[自研新增]`

- F13-1 ProjectSidebar 改为经 IPC 列出磁盘真实项目目录（复用现有列目录/读 manifest 能力；如需新增只读 IPC 在契约 §7 列明，K8）。
- F13-2 搜索框为真实 input，前端按项目名过滤；「新建」创建真实项目（初始化会话目录）并切换；项目点击切换会话。
- F13-3 无项目时显示空态，不放假数据。

### F14 · 输入区入口诚实化（P2-17）`[改编]`

- F14-1 ChatPanel 输入区三个入口：本期「✦ Skill」接到 F15 的模板沉淀/选择（若无可用 Skill 则禁用并 title 说明）；「↥ 上传」本期无能力则**移除或禁用标注「即将支持」**；「● H3 自动选配」改为诚实标注当前文本通道（不谎称 H3）。
- F14-2 不保留纯装饰的假可点击元素。

### F15 · 模板 Skill 沉淀（P2-6）`[改编]`

- F15-1 立项单定稿（0-d confirm）后，提供「沉淀为赛道立项模板」操作：把当前六要素 + 视觉风格 + 预检 6 项取值口径导出为模板（写入用户模板目录的 JSON；具体路径与 IPC 见契约 §7）。
- F15-2 已沉淀模板可在创意输入卡「唤起 Skill / 模板」时选择，预填立项单草案。
- F15-3 仅做本地模板文件，不做 Skill 广场 / 市场 / 分享。

### F16 · 否决反馈结构（P2-18）`[改编]`

- F16-1 点「否决 / 重做」时（非 activeDraft 同源否决），先展示反馈引导：四要素「保留什么 / 修改什么 / 为什么 / 期望结果」，可直接输入否决意见；结构化文本随重做指令带给 Agent。
- F16-2 用户可跳过结构直接否决（不强制），但占位引导始终可见。

### F17 · 画布打磨（P2-19）`[改编]`

- F17-1 StageCanvas 增加点阵背景（CSS radial/linear gradient，随缩放一致）。
- F17-2 节点间「连线」改为 SVG 连接线（替代 32px 灰条），done/active/pending/invalidated 分状态着色；保持现有自动缩放与行布局。
- F17-3 对齐参考线 / 自动吸附：本期节点为自动布局，加入节点卡之间的等距对齐视觉（不新增自由拖拽，避免过度实现）。

---

## 4. 不做什么（边界）

1. 不改动 0/1/2 之外的 Stage，不新增八步中的其他步骤页。
2. 不接入真实 qwen-image / H3 / Music3 生产媒体通道（F7 参考图仅为风格示意 URL，非生产通道）；ComfyUI 桥由后续 Feature 承接。
3. 不做画布自由拖拽编排 / Skill 广场 / 插件市场 / 远程 IM。
4. 不引入新状态库（K9）；renderer 继续 useState + 纯函数层。
5. 共享层 K1 变更仅限：`GateId` 加 `'0-d'`、`RevisionSource` 加 `'0-d'`、`harness` 项加 `critical?`。不改动其他既有类型与字段。
6. 不新增运行时 npm 依赖（F13/F15 所需能力优先复用主进程 fs / 现有 IPC）。
7. 旧会话的 0-d 缺失只提示不阻断，不做强制数据迁移。

---

## 5. 验收标准（AC，任务清单 AC 表为准）

- AC-1 新项目必须经过 0-d：0-c confirm 后 brief 非 done，0-d confirm 后才 brief done、background active。
- AC-2 预检 6 项可编辑、可锁定；缺项 / 画幅不一致时对应 harness ✗。
- AC-3 brief.json 落盘含 preflight；manifest 与 viewer 一致；重启恢复无重复。
- AC-4 critical 未过时首次确认被拦截并红字警示，二次才可强制放行；非 critical 不拦截。
- AC-5 0-b/0-c/1-a/1-b 不再出现硬编码 pass：数据缺/不可得时如实 ✗。
- AC-6 mock 通道 0-a 可过（3 案例）；底栏与角标如实显示 Mock / ark 连接状态。
- AC-7 横屏项目简报与预检画幅显示真实 aspectRatio，不写死竖屏。
- AC-8 立项单三 tab 可切、字段可编辑、锁定字段带锁且不可编辑。
- AC-9 0-c 门与视觉风格 tab 显示参考缩略图（≥2 张），失败诚实占位。
- AC-10 「改部分」进入修改流且不误定稿；gate-action 记录 partial。
- AC-11 重拍板 / 反补使 brief.version 自增并归档旧版；viewer 显示版本。
- AC-12 旧会话无 preflight 时出现补录提示且不阻断。
- AC-13 背景档案只有单一路径推进；空模板 / 缺段不可锁定。
- AC-14 项目库只列真实项目、搜索与新建可用、无项目空态。
- AC-15 输入区无假入口（禁用标注或接真实行为）；通道标注诚实。
- AC-16 立项单可沉淀本地模板并可在创意入口唤起预填。
- AC-17 否决时可见四要素反馈引导。
- AC-18 画布有点阵背景与 SVG 状态连线。
- AC-19 typecheck、build、既有测试全通过且测试只增不减（含新增 preflight / gates / 版本逻辑测试）。

---

## 6. 上下文加载清单（围栏）

见任务清单 §上下文加载清单。

## 7. 后续 Feature（不在本 Feature）

- ComfyUI 媒体引擎桥（生产级图像/视频/音乐）。
- 八步其余 Stage（资产 / 镜头 / 后期 / 发布）。
- Skill 广场 / 模板跨项目管理界面。
