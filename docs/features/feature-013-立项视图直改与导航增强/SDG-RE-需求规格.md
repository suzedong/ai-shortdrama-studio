# SDG-RE-需求规格 · feature-013 立项视图直改与导航增强

> **包号**：feature-013（0xx 立项阶段段）
> **业务名**：立项视图直改与导航增强——**①立项视图 L0/L1/L2 全字段可编辑；②L0 标签/备注进入立项数据模型；③STAGE 0 导航增强提示（左栏 hover 版本历史 + titlebar tooltip 对齐统计）**
> **性质**：**K1 已批并落地**（2026-10-28 决策点 1 拍板 A：L0 标签/备注入立项单 v2 模型，`shared/types.ts` `ProjectBrief`/`BriefDraft` 已增 `l0?: BriefL0`）；**K8 触发**（`brief:update` 白名单扩键——genre/platforms/tone/premise.*/diagnosisSummary 等，循 feature-810 `catalogVersion` 扩键先例；目标零新 IPC、零新 MCP 工具）；**K9 零触发**（零新依赖）
> **事实源**：《短剧Agent平台设计.md》§2.6.6 L258-308（立项后变更：全字段可改 + 影响评估 + 用户决策，v1.10 拍板 D-011）、§2.6.7 L319-327（影响分级表低级=仅元数据不入清单直接落盘）、§2.6.8 L392（titlebar STAGE 0 hover tooltip「立项 vN · X 产物已对齐 · Y 待处理」）、§0.1 原则六 L68-73（D-016 系统优先）
> **前置**：feature-001（立项单 v2 模型）、feature-002（影响评估 + 分级表 + 脏读）、feature-003（立项视图接线）、feature-004（立项单历史与回滚三 IPC）、feature-005（已捕获口径）、feature-009（前提卡分色与不可篡改水印）、feature-806（Harness 基础校验 + B-46）、feature-807（门态防护）、feature-810（谱系升级差异工作流，`brief:update` 白名单扩键先例）
> **溯源标签**：[Design 原有]（§2.6.6/§2.6.8 设计内功能补全——全字段可改与导航提示均为设计书明文，本包补齐落地）
> **偏差登记**：无新偏差；本包关闭「立项视图全字段可改未落地」设计欠账（D-017 仅落六控件，设计 §2.6.6 要求 L0/L1/L2 全字段）
> **日期**：2026-10-28

## 1. 背景

设计书 §2.6.6（v1.10 用户拍板 D-011）确立「立项不再有灵魂边界，L0（项目名/标签/备注）、L1（集数/时长/受众/基调/画幅）、L2（故事前提/主风格）任何字段在 STAGE 0-6 任何阶段都可改，无 disabled、无锁形 icon」，触发入口明示「v1.9 立项视图：所有 L0/L1/L2 字段可编辑」。§2.6.8 L392 明示 titlebar STAGE 0 步骤「hover tooltip 显示『立项 vN · X 产物已对齐 · Y 待处理』」，§2.6.6 L299-306 视觉表明示左栏「✓ v3 绿色 + hover 历史 v1→v2→v3」。现状三处均只落了一半，2026-10-28 用户拍板三件事归本包一并补全（纯系统直做，D-016，零 AI 对话介入）。

代码实证（2026-10-28 侦察，行号以现状文件为准）：

- **立项视图仅 6 字段直改**：[Stage0View.tsx](../../../src/studio/stage0/Stage0View.tsx) `BriefEditPanel`（L264 起，B-24/D-017 注释）行内编辑态仅六控件——kind（L392）、episodeDuration（L400）、episodeCount（L403）、aspectRatio（L407）、mainStyleId（L414）、auxiliaryStyleId（L419）；题材赛道 genre（L398）、目标平台 platforms（L399）、风格基调 tone（L406）为只读 `FieldRow`，诊断结论 diagnosisSummary（L426-431）与诊断明细 diagnosisDetail（L432-438，「恒只读」注释）只读；卡②故事前提五子项（premise.\*）只读展示（带 009 human/ai 确认色与「不可篡改」徽标），L588 明示「故事前提为开放式文本，修改请在右侧对话中提出」；L453 提交区提示「题材、故事前提等开放式修改在右侧对话中提出」——L1/L2 其余字段无直改入口；
- **L0 无模型**：[types.ts](../../../shared/types.ts) `ProjectBrief`（L112-124）十字段无 name/tags/备注；项目名存 `.session.json`（`ProjectSession.title`，L332-334，改名走既有 `project:rename` IPC，main.ts L182）；feature-002 需求规格 L48 明示「现状立项单模型**无 L0 字段**（项目名在 `.session.json`，tags/备注不存在）……分级表保留级别定义备未来 L0 落地」；
- **直改通道已备、白名单仅三键组**：[main.ts](../../../electron/main.ts) `brief:update`（L218-266，D-017）白名单 = kind（枚举校验）+ fiveElements{episodeDuration, episodeCount, aspectRatio} + style{mainStyleId, auxiliaryStyleId, catalogVersion}（810 扩键先例）；[update.ts](../../../electron/brief/update.ts) `updateBriefFields`（L48-181）流程骨架 = 合并 patch → diffBrief → 就绪闸 evaluateDraft → assessImpact 复算 → publishBriefFiles 双写（approve.by 恒 'ui'）→ 影响清单落盘（decisions 恒 'mark'）→ manifest 推进 → 画布单次写挂脏（含 806 markedAt）——**直改即触发影响评估 + 恒 mark 挂脏已是既有机制**，扩字段只需扩白名单与 patch 类型，骨架零改动；
- **历史通道已备**：feature-004 三 IPC 已存在——`brief:history`（main.ts L270，[history.ts](../../../electron/brief/history.ts) `readBriefHistory` 返回 versions 升序：version/path/publishedAt/kind/approveBy/changeCount/note）、`brief:version-read`（L273）、`brief:rollback`（L279）；preload 桥 L27-29 与 global.d.ts L98-118 镜像、dev-mock-api.ts L592 桩均已备——hover 版本历史**零新 IPC 可达**；
- **导航现状只有静态文本**：[StageNavPanel.tsx](../../../src/studio/canvas/StageNavPanel.tsx) STAGE 0 徽标 `✓ vN` / `vN ⚠k`（L120-123），title 仅 dirty 文案「N 个产物基于旧版立项，与最新 vN 不一致」（L116-118），**无 hover 版本历史**；briefVersion 由 canvas 派生（brief 节点 meta.version 与 dirty latestBriefVersion 取大，L45-49）；[StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx) titlebar 八步进度轨 STAGE 0 步骤 title = `STAGE ${s.step} · ${STEP_LABELS[s.step]}`（L529），**无对齐统计**；点击已切 v1.9 立项视图（L514-516）；
- **计数基线**（承 feature-806 T7 同日实测）：MCP 28 工具；showrunner 白名单 23（showrunner.md L16-38）；全量 66 文件 761 passed / 0 failed / 1 skipped；`npx tsc --noEmit` 恰 3 条历史基线（scripts/electron-smoke.mjs 1 + Stage3AssetHub 2）。

**原则对齐（D-016 系统优先）**：字段编辑、版本留痕、对齐统计推算均为规则可枚举的确定性操作——系统直做、零 LLM；对话通道保留为大白话开放式修改兜底（原则六「双通道并存」），两通道落同一再版机制（同一 `updateBriefFields` 骨架与同一影响追溯），不发明第二数据面。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 立项发布后想改题材/平台/基调/故事前提等任意 L1/L2 字段 | 立项视图全字段原位可编辑（无 disabled、无锁形 icon），批量改完一次「确认再版」；系统直改再版 v(N+1) 并复算影响、恒 mark 挂脏，不经 AI 对话；空值/非法值被就绪闸与参数校验拦截、零写盘 |
| R2 | 创作者 | 想给项目打标签、写备注（L0） | 立项视图 L0 区提供标签/备注编辑控件；按决策点 1 拍板归属落盘与留痕；项目名沿用既有 `project:rename` 通道，不搬数据面 |
| R3 | 创作者 | 改完字段后想知道下游代价 | 沿用既有机制：再版即复算影响清单并落盘、受影响节点挂脏 ⚠；低级别字段（L0 元数据）按 002 分级表不入清单直接落盘；三选一全量面板 UI 属 002 既定排除，不翻案 |
| R4 | 创作者 | hover 左栏 STAGE 0 步骤 | 弹出立项版本历史卡（v1→…→vN：版本/发布时间/改动数/拍板方式），数据走既有 `brief:history`；未发布立项时保持现状不显示 |
| R5 | 创作者 | 扫一眼 titlebar 进度轨 | STAGE 0 步骤 tooltip 显示「立项 vN · X 产物已对齐 · Y 待处理」（口径见契约 §3.2）；点击切换立项视图行为不变 |
| R6 | 创作者 | premise「不可篡改」徽标字段被本人直改 | 009 分色/徽标语义不破坏——人本人直改属 human 语义范畴，AI 通道仍不得篡改人确认事实（衔接口径见设计说明 §2 D5） |

## 3. 核心机制

### 3.1 事一：立项视图 L0/L1/L2 全字段可编辑

- `BriefEditPanel` 六控件扩为全字段：L1 补 genre（题材）/platforms（平台）/tone（基调），L2 补 premise 五子项（leads/time/place/coreEvent/seasonBoundary）与 diagnosisSummary；诊断明细 diagnosisDetail 是否直改随决策点 2 拍板；
- 面板批量编辑语义不变：多字段改完一次提交 = 一次 `brief:update` = 一次再版 v(N+1) + 一次影响复算 + 恒 mark 挂脏（决策点 3）；
- L588 / L453「请在右侧对话中提出」引导文案按全字段可改后的事实清理；对话兜底入口保留（D-016 双通道）；
- 直改控件形态逐字段冻结于设计说明 §2 字段分层表（决策点 2）；就绪判定红线沿用 evaluateDraft 既有口径（空值拒改），不新增主观校验。

### 3.2 事二：L0 标签/备注进入立项数据模型

- 现状 L0 三字段中项目名已有归宿（`.session.json` + `project:rename`，B-19 已批，本包不搬家）；本包补 **标签 tags + 备注 notes** 两项数据模型与立项视图 L0 区编辑控件；
- 归属方案三候选随决策点 1 呈报（入立项单 v2 模型触 K1 / 入 manifest.json / 独立 sidecar 文件），推荐见 §3.4 与设计说明 §2 D1——用户拍板后才动对应数据面；
- 无论归属何处：L0 字段按 002 分级表归**低**级（仅元数据，不入影响清单直接落盘）；若入立项单模型则随再版留痕入版本历史，若 sidecar 则直写不再版（两路径的留痕差异在决策点 1 候选中明示）。

### 3.3 事三：STAGE 0 导航增强提示

- **左栏 hover 版本历史**：StageNavPanel STAGE 0 徽标 hover 时懒加载 `brief:history`（既有 IPC，零新通道），渲染版本历史卡；未发布/加载失败时降级为现状 title 文案，不报错不阻塞；
- **titlebar tooltip 对齐统计**：StudioApp stage-track STAGE 0 步骤 tooltip 扩展为「立项 vN · X 产物已对齐 · Y 待处理」，取数 = canvas 全量（既有 `canvas:changed` 订阅已达 renderer）纯函数直算，口径与左栏徽标同源（决策点 4），零新 IPC；未发布立项保持现状文案。

### 3.4 决策点呈报（随包呈报，用户拍板后生效；不替用户拍板）

| # | 决策点 | 候选 | 推荐 |
|---|---|---|---|
| 1 | **L0 标签/备注模型归属** | A. 入立项单 v2 模型（`ProjectBrief`/`BriefDraft` 增可选字段，触 K1；随版本化留痕、入 diffBrief 命名空间、入 002 分级表低级命中；002 L48「备未来 L0 落地」即此路径）/ B. 入 manifest.json（状态机指针文件，语义不符，不推荐）/ C. 独立 sidecar 文件（零 K1、直写不再版；变更无版本留痕、与「全字段可改+再版」语义脱节） | **A**——§2.6.6 将 L0 与 L1/L2 并列「全字段可改」且触发入口 = 立项视图「发布立项 v(N+1)」再版语义；§2.6.7 低级「不在清单中（直接落盘）」是相对「进清单等三选一」而言，非绕过版本化；入模后历史/diff/回滚（004 已建）自动覆盖 L0 留痕，零额外机制。项目名例外留 `.session.json`（不破坏 B-19 既有通道） |
| 2 | **全字段直改的字段分层与控件形态** | 逐字段控件表见设计说明 §2 D2；开放分歧点 = 诊断结论类长文字段：a. diagnosisSummary 与 diagnosisDetail 均直改 / b. 仅 diagnosisSummary 直改（textarea），diagnosisDetail 保持只读（明细长文修订面大，对话兜底）/ c. 均保持只读 | **b**——摘要归中级（002 L48）有直改价值；明细为诊断过程留痕（D-018），直改易破坏「诊断明细 = 当时检索与推理实录」语义 |
| 3 | **直改与影响评估衔接节奏** | A. 沿用现状：面板批量 diff 一次提交 = 一次再版 + 一次评估（恒 mark）/ B. 每字段失焦即再版（版本爆炸，不推荐）/ C. 直改后弹三选一全量面板（002 既定排除，不翻案） | **A**——与 D-017 既有机制逐字同构，零新机制零风险 |
| 4 | **titlebar tooltip 统计口径** | Y = dirty 节点数（与左栏 `⚠k` 同数同源）；X 候选：a. done 且带 parentReference 且非 dirty 的下游产物节点数（排除 brief 节点自身）/ b. 全部 done 节点数 | **a**——「已对齐」语义 = 基于最新版立项生成；分母限「引用立项的产物」才与 Y 互补；未发布立项时不显示统计段 |
| 5 | **版本历史 hover 数据源与形态** | 数据：`brief:history` 既有 IPC（feature-004，preload/global.d.ts/dev-mock 三端已备）懒加载+会话内缓存；形态：a. 自定义 hover 卡（承载版本/时间/改动数/拍板方式列表）/ b. 原生 title 纯文本（无法承载列表） | **a**——§2.6.6 L306「hover 历史 v1→v2→v3」为列表语义；零新 IPC、零新依赖 |

**拍板（2026-10-28，用户批准本包并按推荐方案裁决）**：决策点 **1=A / 2=b / 3=A / 4=a / 5=a**；K1（L0 入立项单 v2 模型）与 K8（`brief:update` 白名单扩键）随批准正式生效。

### 3.5 卡口呈报

- **K1（条件触发）**：仅当决策点 1 拍板 A——`shared/types.ts` `ProjectBrief`/`BriefDraft` 增 L0 可选字段 + diffBrief 命名空间扩 `l0.*`（002 L42 命名空间扩键）+ impact 分级表低级字段命中（002 L48 预留落地），字段方案见契约 §1.1，**用户批准后方可动 shared**；拍板 C 则本卡口不触发；
- **K8（触发）**：`brief:update` 白名单扩键（+ genre/platforms/tone + premise.\* + diagnosisSummary，决策点 1 拍板 A 时 + l0.\*）——改 DTO 白名单属契约变更，循 810 `catalogVersion` 扩键先例登记；preload/global.d.ts/dev-mock 三端镜像同步属本次登记范围；**零新 IPC、零新推送、零新 MCP 工具（28 不动）、四 Agent 白名单零 diff（23 不动）**；
- **K9（零触发）**：零新依赖（tooltip/hover 卡用原生 React + Tailwind 现状栈）。

## 4. 范围

### 4.1 做

1. `brief:update` 白名单扩键 + `BriefUpdatePatch` 类型与合并逻辑扩展（K8 登记；L0 键组视决策点 1 拍板结果）；
2. K1 字段落地（若拍板 A）：`shared/types.ts` L0 可选字段 + diffBrief/impact 低级命中 + 存量兼容；
3. 立项视图全字段直改：`BriefEditPanel` 控件扩展（L1/L2 逐字段）+ premise 卡直改衔接 009 徽标语义 + L0 区控件 + L588/L453 文案清理；
4. StageNavPanel STAGE 0 hover 版本历史卡（`brief:history` 复用）；
5. StudioApp titlebar STAGE 0 tooltip 对齐统计（canvas 派生纯函数，契约 §3.2 口径）；
6. 测试：扩键校验/再版留痕/L0 落盘/控件分层/hover 卡/tooltip 口径单测 + 全量回归 + T8 真机目验；
7. 治理收尾：变更记录 T/X 回填、features/README 增 013 行、版本记录增行。

### 4.2 不做（显式排除）

- **项目名数据面不搬家**：`.session.json` + `project:rename` 通道维持现状（B-19 已批）；L0 入模范围仅 tags/notes 两项；
- **三选一影响评估全量面板 UI 不做**（002 既定排除，不翻案）；直改恒 mark 语义不变；
- **不改 009「不可篡改」徽标语义、不改 premise 分色数据面**：本包只在面板侧提供直改控件，human/ai 确认色数据流不动；
- **零新 IPC/推送/MCP 工具**：版本历史走 `brief:history`、统计走 canvas 既有订阅；若实施发现既有通道无法承载 → 停手呈报，不得私开通道；
- **不改 002 追溯算法与分级阈值**（仅按拍板结果在分级表低级区补 L0 字段命中）；
- **不改诊断明细 D-018 落盘语义**（是否直改仅影响面板控件，不影响发布时随立项单落盘）；
- **STAGE 1-7 产物「反补到立项」按钮**（§2.6.6 L273）不属本包，另行建包；
- **对话通道（Agent 侧）零改动**：showrunner 提示词与 `brief.impact.*` 工具链不动。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | 全字段直改：L1（genre/platforms/tone）与 L2（premise 五子项/diagnosisSummary，detail 视拍板）逐字段直改 → 一次提交再版 v(N+1) 落盘（json+md 双写、approve.by='ui'）；Δ 命中对应字段路径；影响清单落盘、命中节点恒 mark 挂脏（含 markedAt）；空值/非法枚举被拦截零写盘 | 单测 + 组件单测 |
| AC2 | L0 标签/备注：按决策点 1 拍板归属落盘并可读回；拍板 A 时改动随再版入版本历史（brief:history changeCount/diff 可见 l0.* 字段）、影响清单零命中低级字段、存量无字段立项单读取不破坏；拍板 C 时 sidecar 直写不再版 | 单测 |
| AC3 | 既有六控件回归：kind/episodeDuration/episodeCount/aspectRatio/mainStyleId/auxiliaryStyleId 直改行为与 D-017 现状逐字一致（同通道同骨架）；catalogVersion 810 路径不破坏 | 单测 |
| AC4 | premise 直改衔接：人直改后 human/ai 分色与「不可篡改」徽标语义不破坏（009 数据流零 diff）；premise 改动归高级入影响清单 | 组件单测 |
| AC5 | 左栏 hover 历史：STAGE 0 徽标 hover 显示 v1→…→vN 历史卡（版本/时间/改动数/拍板方式齐全）；未发布立项不显示；加载失败降级现状 title 不报错 | 组件单测 |
| AC6 | titlebar tooltip：STAGE 0 tooltip =「立项 vN · X 产物已对齐 · Y 待处理」，Y 与左栏 ⚠k 同数、X 按契约 §3.2 口径；未发布/零引用时按契约降级 | 组件单测 |
| AC7 | 工具面：MCP 注册恰 28、showrunner 白名单恰 23 零 diff；零新 IPC/推送（Grep 静态验证）；零新依赖（package.json 零 diff） | 静态验证 + 单测 |
| AC8 | 回归红线：`npx tsc --noEmit` 恰 3 条历史基线零新增；全量以 T1 实测基线（承 806 T7：66 文件 761 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、failed=0 | 全量回归 |
| AC9 | 真机（Electron 实机 + computer-use UIA/CDP）：①立项视图分三类字段各直改一次（枚举/文本/长文）实证再版 +1、历史可查、挂脏 ⚠ 上屏；②L0 标签/备注编辑落盘读回；③左栏 hover 历史卡与 titlebar tooltip 统计上屏 | 真机 |
