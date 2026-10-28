# SDG-RE-需求规格 ｜ feature-011 影响评估面板与批量重生成

> **包号**：feature-011 ｜ **业务名**：影响评估面板与批量重生成 ｜ **日期**：2026-10-28
> **性质**：renderer 新建组件 + 既有脏读黄条入口增强 + StudioApp 接线（**K8 卡口声明：批量重生成编排通道的默认方案复用既有链路零触发；若用户拍板新增批量工具方案则触发 K8，须先呈报后实施**；K1 / K9 默认零触发，详见 §7）
> **事实源**：《短剧Agent平台设计.md》§2.6.6（L258-289）/ §2.6.7（L310-366）；通用规则 [AI-SDG-AI工具执行指令.md](../../governance/AI-SDG-AI工具执行指令.md)
> **前置包**：[feature-002-立项后变更与影响评估](../feature-002-立项后变更与影响评估/)（影响清单 / 脏读 / 三选一数据底座）、[feature-007-产物重开对齐二次确认](../feature-007-产物重开对齐二次确认/)（单产物重对齐链路 + 查看器脏读黄条）、[feature-806-Harness基础校验与确认门全链路](../feature-806-Harness基础校验与确认门全链路/)（`CanvasDirty.markedAt` 漂移提醒）
> **溯源标签**：[Design 原有]（§2.6.7 设计内功能补全，非形态扩张）
> **偏差登记**：本包属**明示排除翻案**——feature-002 需求规格 §4.2 L82「不做影响评估弹窗面板 UI……弹窗、勾选列表、『一键对齐』按钮留待 renderer↔主进程通道包」与 feature-007 契约 L115「想在黄条加『查看影响评估』按钮 / 在确认内做勾选列表、批量对齐 → 越界：feature-002 §4.2 L82 面板排除不翻案」两项排除，经 **2026-10-28 用户拍板分包方案**正式翻案建包（本包为该方案三包之一）

---

## 1. 背景与问题陈述（代码实证：2026-10-28 侦察）

### 1.1 设计承诺与长期排除史

设计书 §2.6.7（L310-366）承诺立项变更后弹出**影响评估面板**——L331-349 给出 ASCII 草图：顶部改动字段区 + 中部「影响下游产物（4）」分组勾选列表（☑/☐）+ 底部三按钮 `[一键重生成选中 (4)] [仅标记脏] [取消]`；L340-346 分级表：高（premise / 主风格 / 画幅，红色，必重生成，默认勾选）、中（集数 / 时长 / 受众 / 基调，黄色，建议重生成，需勾选）、低（元数据，不入清单）。

但设计书同节 L312 明示现状：「**影响评估面板 UI 尚未建包**（现状为对话态呈报 + 系统直改恒 mark，D-017）」。该缺口有连续排除史：

| 时间 | 出处 | 排除内容 |
| :-- | :-- | :-- |
| 2026-10-14 | feature-002 需求规格 §4.2 L82 | 不做影响评估弹窗面板 UI（弹窗 / 勾选列表 / 按钮），留待 renderer↔主进程通道包 |
| 2026-10-14 | feature-002 需求规格 §4.2 L85 | 不做 STAGE 1–2 的自动一键重生成，不内置编排器 |
| 2026-10-16 | D-017（[决策台账](../../governance/SDG-AI-决策台账.md)） | 系统直改通道受影响节点**一律仅挂脏**（decisions 恒 `'mark'`），不自动重生成 |
| 2026-10-21 | feature-007 契约 L78 / L115 | 查看器黄条为 §2.6.7 L359 简版，无「查看影响评估」钮；勾选列表 / 批量对齐维持排除不翻案 |

结果：影响评估的**数据底座与执行链路均已落地**，唯独**用户决策的面板 UI 层缺失**——用户保存立项修改后看不到完整影响清单、无法按产物勾选决策、无法批量发起重生成；脏读黄条只有「一键对齐」（单产物）入口，无「查看影响评估」入口。

### 1.2 数据底座已就绪（feature-002 / D-017）

主进程影响评估与脏读机制已完整落地，面板所需的**全部数据字段均已存在**：

- [electron/brief/impact.ts](../../../electron/brief/impact.ts)：`ImpactItem { nodeId, step, title, severity, fields, defaultAction }`（L9）——severity 分级 / defaultAction 预勾选语义天然匹配设计书分级勾选表；`ImpactAssessment { fromVersion, toVersion, changes, items, counts{high,medium,total} }`（L18）；`ImpactReportFile { schemaVersion:1, kind:'brief-impact-report', fromVersion, toVersion, committedAt, changes, items: Array<ImpactItem & {decision}> }`（L27）；`classifyField`（L65）内置 HIGH_FIELDS（premise.* 五键 / style.mainStyleId / style.catalogVersion / fiveElements.aspectRatio）与 MEDIUM_FIELDS（episodeCount / episodeDuration / genre / tone / platforms / auxiliaryStyleId / kind / diagnosisSummary / diagnosisDetail）词表，低级别字段不入清单。
- [electron/brief/update.ts](../../../electron/brief/update.ts)（D-017 系统直改通道）：`updateBriefFields`（L48）返回 `BriefUpdateResult`（L34）= `{ version, jsonPath, mdPath, impactReportPath, changes, items, markedDirty }`——**changes 与 items 已随返回值到达 renderer**（L112-127：复算影响 → decisions 恒 `'mark'` 全挂脏 → 再版四落盘）。
- 影响清单落盘：项目根 `影响清单.vN-vM.json`（tools.ts L760 `kind:'brief-impact-report'`；B-03 形态差异留痕：落项目根、ASCII 连字符），文件名经 `CanvasDirty.impactReport` 字段挂到每个脏节点（tools.ts L802）。
- `shared/types.ts` L351-374：`CanvasParentReference` / `CanvasDirty` 六字段（sinceBriefVersion / latestBriefVersion / fields / severity / impactReport / markedAt?——markedAt 为 806 B-46 新增）。

### 1.3 执行链路已就绪（feature-007）

单产物「重新对齐」链路已闭环，可直接作为批量重生成的逐产物执行单元：

- [src/studio/canvas/RealignConfirm.tsx](../../../src/studio/canvas/RealignConfirm.tsx)：L12 `RealignPromptInput` / L21 `buildRealignPrompt` 固定模板（【产物重新对齐】前缀，showrunner R-008 纪律识别）/ L34 三选一组件。
- [src/studio/shell/StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx)：L387-400 确认动作 = 关弹层 + `handleSend(buildRealignPrompt(input))`（L318 handleSend → feature-808 promptAsync 链路）；Agent 侧经 showrunner R-008 纪律（【产物重新对齐】前缀 → 核实脏态 → 串行委派重生成 → `canvas.align` 清脏推进血缘）。
- MCP 工具面：[electron/mcp/tools.ts](../../../electron/mcp/tools.ts) L633-635 `brief.impact.assess`（20 号，只读预评估）、L675-678 `brief.impact.commit`（21 号，Agent 对话通道，decisions 恰好覆盖校验）、L833-835 `canvas.align`（22 号，重生成定稿后清脏，无 dirty 幂等）。

### 1.4 缺口本身（2026-10-28 实证）

| # | 缺口 | 代码实证 |
| :-- | :-- | :-- |
| ① | 保存立项修改后影响清单被丢弃 | [Stage0View.tsx](../../../src/studio/stage0/Stage0View.tsx) L349-372 `submitBriefEdit`：`await window.api.updateBrief(patch)` 成功后直接 `onClose()`，返回的 `changes / items / markedDirty` **未消费** |
| ② | 无影响评估面板 | 全仓无面板组件；StudioViewer.tsx L620 注释实锤「feature-007：脏读黄条（§2.6.7 L359 简版，**无 [查看影响评估] 钮**）」 |
| ③ | 无分组勾选列表 / 批量重生成 | 全仓零实现（007 契约 L115 明示排除） |
| ④ | 四处脏读黄条均无「查看影响评估」入口 | StudioViewer.tsx L620-638（有一键对齐钮无查看钮）；CanvasBoard.tsx L620-629（`data-dirty-banner` 纯文本、pointer-events-none 不阻断）；Stage0View.tsx L232-245 DirtyBar（`data-stage0-dirty-bar` 纯文本）；RealignConfirm.tsx（确认弹层无清单入口） |

### 1.5 2026-10-28 用户拍板

用户拍板分包方案（三包之一），为 §2.6.7 影响评估面板建包（本包）。建包依据即该拍板；002 §4.2 L82 / 007 契约 L115 两项排除经此拍板正式翻案，登记于本包变更记录 D 节。

**基线实测（2026-10-28，契约 §6 基线以此为准）**：

- MCP 工具面：**11 族 28 个**（tools.ts 逐号注释实锤：1-3 file / 4-5 canvas / 6 gate / 7-8 asset / 9-11 comfyui / 12-14 brief / 15-16 manifest / 17-19 style / 20-22 impact+align / 23-25 capture / 26-27 web / 28 harness.validate；[docs/features/README.md](../README.md) §2 行「10 族共 27 个」已过时未同步，属文档漂移，本包按实测写）
- showrunner 白名单：**23 项**（[electron/runtime/provider.ts](../../../electron/runtime/provider.ts) L47-71 `SHOWRUNNER_DECLARED_TOOLS`）
- `npx tsc --noEmit`：恰 **3 条**历史基线——`src/studio/canvas/canvas-zoom.test.tsx` 2 条（TS2322 StepId / TS6133 unused viewport）+ `src/test/runtime/runtime-client.test.ts` 1 条（TS2741 缺 messages）。⚠️ 与 806 变更记录所载文件（electron-smoke.mjs + Stage3AssetHub）不同——Stage3AssetHub 已不存在（Glob 零命中），本包按实测现状写
- `npm run test:run`：**66 文件 761 passed / 0 failed / 1 skipped（总 762）**
- 依赖基线：无日期库（806 漂移天数用 Date 直算先例）；react-markdown / remark-gfm 为既有依赖

---

## 2. 角色与使用场景

| # | 角色 | 场景 | 现状痛点 | 本包后 |
| :-- | :-- | :-- | :-- | :-- |
| R1 | 创作者 | 在 STAGE 0 卡①行内编辑改了「单集时长」并确认再版 | 保存即关闭编辑态，受影响 4 个产物仅在各处黄条零星提示，看不到完整影响清单 | 保存后面板自动弹出：改动字段摘要 + 受影响产物按高/中分级分组列出，默认勾选高优先级项 |
| R2 | 创作者 | 面板中勾选 2 个产物点「一键重生成选中」 | 只能逐个点开脏产物节点 → 确认弹层 → 重新对齐，4 个产物重复 4 遍 | 勾选即决策，一次点击批量发起：逐产物走既有 007 重对齐链路（模板消息 → showrunner 纪律 → align 清脏） |
| R3 | 创作者 | 暂不处理，稍后从脏读黄条回看影响 | 黄条只有「一键对齐」（单产物），无处回看完整影响清单 | 查看器黄条追加「查看影响评估」钮，按 `dirty.impactReport` 回读落盘清单重开面板 |
| R4 | 创作者 | 面板中点「仅标记脏」或「取消」 | 同（关闭） | 面板关闭，D-017 已落盘的脏标记不变，既有黄条 / 漂移提醒（806）持续提示 |
| R5 | 主控 Agent（showrunner） | 收到批量重生成模板消息 | R-008 纪律仅见单产物模板 | 消息携带勾选产物清单（nodeId/title/版本对/字段），按既有 R-008 纪律逐产物串行重生成并逐一 `canvas.align` 清脏，无需新纪律词表（详见 §6 决策点 D3） |

---

## 3. 核心机制需求

### 3.1 数据源与通道（零新 IPC 基线）

面板两个数据入口均复用既有通道，**零新 IPC / 零新 MCP 工具**：

| 入口场景 | 数据源 | 通道实证 |
| :-- | :-- | :-- |
| 保存后自动弹出 | `window.api.updateBrief(patch)` 返回值 `BriefUpdateResult`（changes / items / markedDirty） | global.d.ts L76-96；update.ts L34 / L153-165 |
| 黄条「查看影响评估」手动重开 | `window.api.fileRead({ path })` 读项目根 `影响清单.vN-vM.json`（`ImpactReportFile` 含同构 changes / items），文件名取 `node.dirty.impactReport` | global.d.ts L177 fileRead；types.ts CanvasDirty.impactReport |

辅助通道：`canvas.get` / `canvas.onChange`（global.d.ts L159-163）既有订阅支撑脏态刷新——重生成清脏后面板 / 黄条经既有订阅自动消退，无新增推送。

### 3.2 面板信息架构与分组勾选

形态对齐设计书 §2.6.7 L331-349 草图（[Design 原有]）：

1. **改动字段摘要区**：列出本次 `changes`（字段路径 + 旧值 → 新值），逐条标注级别（高=红 / 中=黄），对齐 L340-346 分级表着色语义。
2. **影响下游产物分组勾选列表**：按 `severity` 分两组（高优先级组 / 中优先级组），组内逐产物一行（复选框 + 产物标题 + step + 受影响字段标签 + 版本对 vN→vM）。**默认勾选规则** = `ImpactItem.defaultAction`：`'regenerate'` 预勾（对应设计书「高级别默认勾选」L345）、`'mark'` 不勾。低级别字段不入清单（impact.ts 既有语义，面板零新增分级逻辑）。
3. **计数与动作行**：`[一键重生成选中 (N)]`（N = 当前勾选数，N=0 禁用）+ `[仅标记脏]` + `[取消]`，对齐草图三按钮形态。
4. 面板为非阻断弹层（与 RealignConfirm 同级挂 StudioApp，L738-740 先例）；Esc / 背景点击关闭策略与 RealignConfirm 对齐（防误触，实现细节归设计说明）。

### 3.3 触发时机与入口

两个触发时机（候选与推荐见 §6 决策点 D2，本节为需求全集）：

- **A. 保存后自动弹出**：Stage0View 卡①行内编辑确认再版成功（updateBrief 返回）且 `items.length > 0` 时自动弹出；`items` 为空（如仅改低级别元数据字段 / 无下游消费节点）则不弹，维持现状静默。
- **B. 黄条「查看影响评估」手动入口**：脏读黄条追加按钮，按 `dirty.impactReport` 回读清单重开面板（R3 场景）。挂点范围（查看器黄条 / Stage0 DirtyBar / 画布顶栏 banner 的取舍）归设计说明呈报；画布顶栏 banner 为 002 既定的 pointer-events-none 非阻断纯提醒形态，**默认维持不加按钮**。

### 3.4 三动作语义

| 动作 | 语义 | 落点 |
| :-- | :-- | :-- |
| 一键重生成选中 | **勾选即决策**：对勾选产物逐个发起既有重对齐 / 重生成流程（§3.5） | 会话流留痕（模板消息即决策记录，opencode 会话持久化） |
| 仅标记脏 | 关闭面板；维持 D-017 保存时已落盘的 `'mark'` 脏标记（「我已知晓，暂不处理」） | 零写盘；黄条 / 806 漂移提醒持续 |
| 取消 | 关闭面板（D-017 终态下与「仅标记脏」同效——脏标记已于保存时落盘，面板不撤销；撤销走既有回滚通道 feature-004） | 零写盘 |

**留痕边界（如实呈报）**：D-017 终态下影响清单 `items[].decision` 恒 `'mark'`（update.ts L127），面板勾选**不回写** decision 字段——decision 的 `'regenerate'` 语义属 Agent 对话通道（impact.commit，tools.ts L675-678）恰好覆盖校验的专有写路径；面板重生成决策由批量模板消息在会话流中留痕。若用户要求 decision 回写落盘，须新增 IPC（触发 K8），作为 §6 决策点 D3 子项呈报。

### 3.5 批量重生成执行链路（复用 007，K8 零触默认方案）

对勾选产物**逐个**走 feature-007 既有单产物链路，不新增编排器、不新增工具：

```
面板勾选 → 构建批量模板消息（buildRealignPrompt 同源扩展，【产物重新对齐】前缀 + 勾选产物清单）
→ StudioApp.handleSend（L318 既有）→ feature-808 promptAsync 链路
→ showrunner R-008 纪律（识别前缀 → 核实脏态 → 逐产物串行委派重生成 → canvas.align 清脏推进血缘）
→ canvas.onChange 既有订阅广播 → 脏读黄条 / 面板自动消退
```

消息聚合形态（单条聚合消息 vs 逐产物多条消息）归 §6 决策点 D3 呈报；两种形态均复用同一会话链路，K8 零触。

### 3.6 D-016 边界（系统优先，AI 归位）

| 动作 | 承担方 | 依据 |
| :-- | :-- | :-- |
| 面板渲染 / 分组 / 默认勾选 / 计数 / 勾选态管理 | **系统直做零 AI** | 规则可枚举（severity 分组 / defaultAction 预勾选为确定性映射） |
| 批量重生成的**发起编排**（勾选集 → 模板消息 → handleSend） | **系统直做零 AI** | 勾选即决策，模板为固定格式 |
| 产物内容重生成本身 | **AI（showrunner 经 R-008 纪律）** | 开放式语义生成，原则六 AI 侧 |
| 清脏 / 血缘推进 | 系统（canvas.align 工具层） | 既有语义不变 |

---

## 4. 范围

### 4.1 做

1. 影响评估面板组件（分组勾选列表 + 改动字段摘要 + 三动作按钮），[Design 原有] 形态对齐 §2.6.7 L331-349
2. 保存后自动弹出接线（Stage0View updateBrief 返回值消费上报 + StudioApp 面板状态管理）
3. 查看器脏读黄条「查看影响评估」入口钮 + 按 `dirty.impactReport` 回读清单重开面板
4. 「一键重生成选中」批量发起（复用 007 模板消息链路，勾选产物清单入消息）
5. 面板纯函数层（分组 / 默认勾选 / 计数 / 批量模板构建）与组件单测；dev-mock 演示数据增补（updateBrief 返回 + 影响清单 fileRead 桩）
6. 全量回归 + typecheck 零新增 + dev-mock 真机目验

### 4.2 不做

1. **不改影响评估算法与分级词表**（impact.ts 零 diff；面板只消费既有 severity / defaultAction）
2. **不动 D-017 系统直改通道语义**（update.ts 恒 mark / 四落盘 / approve.by 'ui' 零 diff；面板不回写 decision）
3. **不新增 MCP 工具 / IPC / 依赖**（K8 / K9 零触为默认方案；用户若拍板新批量工具或 decision 回写，另行呈报后实施）
4. **不动 Agent 对话通道三选一**（impact.commit 的 decisions 恰好覆盖校验语义零 diff）
5. **不动 806 漂移提醒逻辑**（driftReminderLabel / markedAt 零 diff；黄条仅追加按钮，不改动既有文案与漂移行）
6. **不动画布顶栏 banner 的非阻断纯提醒形态**（默认不加按钮；若用户拍板加，归设计说明呈报项）
7. **不做重生成的进度跟踪 / 排队可视化 / 失败重试 UI**（批量发起即交付会话链路，生成进度由既有会话流呈现；编排器维持 002 §4.2 L85 排除不翻案）
8. **不做 STAGE 3-7 产物的影响评估扩展**（影响清单消费节点范围由 impact.ts 依赖图既有覆盖决定，本包零扩展）
9. **不动 shared/types.ts**（面板勾选态为 renderer 内存态，K1 零触；若拍板 decision 回写也不进 shared，走独立 IPC DTO）

---

## 5. 验收标准（AC 表）

| # | 验收点 | 判定口径 | 验证方式 |
| :-- | :-- | :-- | :-- |
| AC1 | 保存后自动弹出 | Stage0View 行内编辑改中 / 高级别字段确认再版成功且 items.length>0 → 面板自动弹出，改动字段摘要与产物分组列表完整 | 单测 + 目验 |
| AC2 | items 为空不弹 | 再版返回 items 空 → 不弹面板，编辑态正常关闭（现状语义零回归） | 单测 |
| AC3 | 分组与默认勾选 | 高 / 中分组正确；defaultAction='regenerate' 预勾、'mark' 不勾；勾选切换计数同步；N=0 时「一键重生成选中 (0)」禁用 | 单测 |
| AC4 | 一键重生成选中 | 勾选 k 个产物点击 → 经 handleSend 注入含 k 产物清单（nodeId/title/版本对/字段）的【产物重新对齐】批量模板消息；面板关闭 | 单测（handleSend 桩断言消息体） |
| AC5 | 仅标记脏 / 取消 | 两动作均零写盘零消息，面板关闭，脏标记与黄条维持 | 单测 |
| AC6 | 黄条「查看影响评估」入口 | 查看器打开脏产物 → 黄条含新钮 → 点击按 dirty.impactReport 经 fileRead 回读清单重开面板；清单缺失 / 读取失败降级（提示并不阻断，黄条其余元素不变） | 单测 + 目验 |
| AC7 | 806 漂移提醒共存 | 黄条既有漂移文案（driftReminderLabel）与「一键对齐」钮零回归，新钮共存不挤压 | 单测 + 目验 |
| AC8 | 重生成后消退 | align 清脏经 canvas.onChange 广播后，面板列表与黄条脏态自动消退（既有订阅链路，无新增推送） | 目验 |
| AC9 | 卡口基线 | tsc 恰 3 条历史基线零新增；MCP 工具 28 / showrunner 白名单 23 / package.json 依赖零 diff（K8 / K9 零触）；shared/types.ts 零 diff（K1 零触） | 命令实测 + git diff |
| AC10 | 全量回归 | 66 文件基线上净增恰为契约 §5 登记的新测试文件，全量 passed / 0 failed / 1 skipped | `npm run test:run` |
| AC11 | 真机目验 | dev-mock 演示路径：编辑保存弹面板 → 勾选 → 批量消息上屏 → 黄条新钮重开面板 全过 | Playwright / CDP 目验截图 |

---

## 6. 设计决策点（方案候选 + 推荐，待用户拍板）

> 本节不替用户拍板。批准规格时请对 D1-D5 逐项圈选；未圈选项按推荐执行。

### D1 批量重生成编排通道

| 候选 | 内容 | 卡口影响 |
| :-- | :-- | :-- |
| A（推荐） | 复用既有链路：面板勾选 → 批量模板消息 → handleSend → showrunner R-008 纪律逐产物重生成 → canvas.align 清脏 | K8 零触 |
| B | 新增批量编排工具（MCP 或 IPC），主进程侧编排逐产物重生成 | 触发 K8（须先呈报工具面变更）；且重生成内容仍需 Agent 产出，主进程编排仅能做调用编排，与 D-016「AI 承担生成」分工无增益 |

**推荐 A**：007 链路已闭环且有 showrunner R-008 纪律承载逐产物语义，新增工具为重复面；002 §4.2 L85「不内置编排器」排除项维持不翻案。

### D2 面板触发时机

| 候选 | 内容 |
| :-- | :-- |
| A | 仅保存后自动弹出 |
| B | 仅黄条「查看影响评估」手动入口 |
| C（推荐） | 两者兼有：保存后自动弹出（items>0 时）+ 查看器黄条手动入口（随时回看重开） |

**推荐 C**：自动弹出覆盖「保存即决策」主路径（R1/R2）；手动入口覆盖「稍后处理再回看」（R3，对齐设计书 L359 黄条含「[查看影响评估]」原文）。两者共用同一面板组件与数据归一纯函数，成本不叠加。

### D3 「一键重生成选中」执行语义

**已定方向（建包拍板含）**：勾选即决策，逐产物走既有重对齐 / 重生成流程。待拍板子项：

| 子项 | 候选 | 推荐 |
| :-- | :-- | :-- |
| 消息聚合形态 | A. 单条聚合消息（【产物重新对齐】前缀 + 勾选产物清单一次送达，showrunner 按清单串行处理）；B. 逐产物各发一条模板消息（连续 k 条用户消息） | **A**：单条消息一次对话回合承载批量语义，会话流整洁，决策留痕集中于一条；R-008 纪律「串行委派重生成」语义天然覆盖清单处理 |
| 决策留痕方式 | A. 会话消息留痕（模板消息即记录，零写盘零新通道）；B. 新增 IPC 回写影响清单 items[].decision | **A**：零 K8；decision 的 'regenerate' 写路径属 impact.commit 专有校验语义，renderer 回写会破坏「恰好覆盖」校验边界 |

### D4 D-016 判定确认

面板渲染 / 勾选 / 分组 / 计数 / 批量编排发起**全部系统直做零 AI**；AI 仅承担产物内容重生成本身。判定标尺（原则六）：分组与预勾选为 severity / defaultAction 的确定性映射（可枚举 → 系统做）；重生成内容为开放式语义生成（→ AI 做）。**呈报确认**，无候选分歧。

### D5 与 806 漂移黄条的入口共存

| 候选 | 内容 |
| :-- | :-- |
| A（推荐） | 共存：黄条 = 既有漂移提醒文案 + 既有「一键对齐」钮 + 新增「查看影响评估」钮，三者并置；漂移提醒逻辑零 diff |
| B | 合并：新钮取代「一键对齐」钮（对齐动作改由面板承载） |

**推荐 A**：「一键对齐」是单产物即时动作（007 已落地语义），「查看影响评估」是全局清单回看，语义互补不替代；806 漂移提醒为不阻塞提示层，与按钮无冲突。画布顶栏 banner 维持 002 既定非阻断纯提醒形态不加钮（默认项，可一并圈选推翻）。

---

## 7. K 卡口识别

| 卡口 | 识别结论 | 说明 |
| :-- | :-- | :-- |
| **K8 工具面** | **默认零触发** | 推荐方案（D1-A + D3 会话留痕）零新 MCP 工具、零新 IPC；基线 28 工具 11 族 / showrunner 白名单 23 不变。**若用户拍板 D1-B 或 D3 留痕-B 则触发 K8**——实施前必须暂停呈报，经批准并追加变更记录决策后方可动手 |
| **K9 依赖** | **零新增** | 无新依赖需求；面板纯 React + Tailwind 既有栈 |
| **K1 shared/types.ts** | **默认零触发** | 面板数据模型（ImpactItem / ImpactAssessment / ImpactReportFile）已含全部所需字段（severity 分组 / defaultAction 预勾选 / decision 留痕位）；勾选态为 renderer 内存态不进 shared。**若实施中发现确需扩展共享类型，立即停手呈报** |
| **零新 IPC 基线** | **已实证可行** | updateBrief 返回值（保存后弹窗）+ fileRead 读影响清单（黄条重开）+ canvas.get/onChange（脏态刷新）三通道既有；global.d.ts 零 diff |
| K2-K7 / K10 | 不涉及 | 无门模型 / 状态机 / 落盘格式 / 提示词事实源 / 归档 / 删除产物变更（showrunner.md 预计零 diff——批量消息沿用【产物重新对齐】既有前缀，R-008 词表零扩展；若实施中确需提示词增补，归 feature-001 变更记录 R 节并呈报） |

**实施纪律**：实施中一旦触碰未登记卡口（含上表条件触发型），立即停手 → 呈报 → 用户确认 → 变更记录追加决策，四步缺一不可（铁律 1 延伸）。
