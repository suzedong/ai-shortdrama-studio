# SDG-RE-需求规格 · feature-008 立项过程链式呈现

> **包号**：feature-008（0xx STAGE 0 立项段，承接 feature-003「立项视图」与 feature-005「已捕获口径」）
> **业务名**：立项过程链式呈现（STAGE 0 立项视图顶部恒显「① 选题诊断 → ② 故事前提 → 🚪 定案卡」链态条：三节点 + 连接箭头 + 状态徽标 + x/6、x/5 精确进度 + 待拍板只读定案卡摘要）
> **性质**：纯 renderer 呈现层新增 + 纯函数层新增；**K1 零触发**（纯消费 `CapturedFact` / `CanvasGate` / `CanvasNode` / `Stage0State` 既有类型，`shared/types.ts` / `src/global.d.ts` / `electron/preload.ts` 零 diff，不新增任何跨进程类型）；**K8 零触发**（`window.api.captureList` / `window.api.onCaptureChanged` 为 feature-005 既有桥，零新 IPC / 零新 MCP / 零新推送 / 零白名单变更；链态条纯订阅零写入）；**K9 零触发**（零新依赖、零配置变更、`package.json` 零 diff；新增 `data-stage0-chain-*` 为 feature-003 既定组件凭据族、非 data-testid，不触发任何卡口）
> **事实源**：《短剧Agent平台设计.md》§2.6.8 L368-381（「立项画布是一条线性收敛链（非 DAG），两个节点：`[① 选题诊断] → [② 故事前提] → 🚪 定案卡`」；创意输入框与已捕获口径区为常驻元素不画成节点）、§2.6.1 L150（「已捕获口径」区是两个节点与定案卡的共同数据源）、§2.6.5 L226-234（就绪条件三条）与 L239-249（定案卡内容）
> **前置**：feature-003（Stage0View 四态 + `stage0/select.ts` 纯函数层 + `FIVE_ELEMENT_FIELDS` / `PREMISE_FIELDS` 标签同源表）、feature-005（capture 桥与 `CapturedFact` 模型 + CaptureBar 消费模式）
> **溯源标签**：[Design 原有·形态对齐]（§2.6.8 既定链式呈现，底层以既有 capture / canvas 通道自研实现）
> **偏差登记**：B-43（本包登记并实施收尾关闭）
> **方案拍板**（2026-10-21 用户三选，全按推荐项）：① 呈现形态 = **顶部链态条**（恒显，双卡主体零改动）；② 进度口径 = **x/6、x/5 精确进度**（topic 按推荐词表含中英文别名精确匹配，匹配不上计总数不算进度）；③ 定案卡节点 = **状态镜像 + 只读摘要**（批准 / 驳回仍单点在右栏）
> **日期**：2026-10-21

## 1. 背景

「新建→立项」链路盘点缺口 #4：设计书 §2.6.8 L370-375 规定立项画布是一条**线性收敛链**——`[① 选题诊断] → [② 故事前提] → 🚪 定案卡`；L377 规定创意输入框与「已捕获口径」区为常驻元素、不画成节点。现状 Stage0View 只有 empty（静态文案「立项尚未定案」）/ published（双卡）等四态，**立项对话全程中栏无任何过程链式呈现**——用户看不到「两节点一卡」的收敛进度，只有发布后才能看到双卡结果。缺口不在 published 双卡（feature-003 已落地），而在**全周期（尤其对话进行中的 empty 态）的收敛链可视**。

代码实证（2026-10-21 侦察）：

- **四态无链**：[Stage0View.tsx](../../../src/studio/Stage0View.tsx) EmptyStage0 L162-196 仅 EntryQuoteCard + GatePendingStrip + 静态文案卡；PublishedBody L447-603 双卡为**结果呈现**非过程链；BriefError L645-669 错误卡——三布局全文无链式元素；
- **纯函数层可复用**：[stage0/select.ts](../../../src/studio/stage0/select.ts) `selectStage0State` 七字段（phase / briefNode / gate0 / gatePending / dirtyCount / dirtyFields / version）——🚪 节点状态与版本判定的输入全现成；`FIVE_ELEMENT_FIELDS`（6 键中文标签）/ `PREMISE_FIELDS`（5 键中文标签）为词表别名同源基准；
- **进度数据源现成**：feature-005 桥 `window.api.captureList()` + `window.api.onCaptureChanged(cb)`（`CapturedFact[]`：id / topic / value / source / status / quote? / updatedAt）；消费模式有 CaptureBar L33-41 样板（首拉 + 全量替换订阅）；showrunner.md L101 推荐词表——六要素 `genre` / `platforms` / `episodeDuration` / `episodeCount` / `tone` / `aspectRatio`，前提 `leads` / `time` / `place` / `coreEvent` / `seasonBoundary`（开放词表不闭集）；
- **🚪 摘要数据源现成**：showrunner.md L125 规定 `shortdrama_gate_request({ gateId:'0-final', question, options, payload:{ version, pendingMarks, changesFromPrevious } })`——question 即人读定案卡全文，payload.version 即待拍版本；`CanvasGate` 类型（types.ts L391-397）payload 自由态；
- **审批单点已在右栏**：[GateCardView.tsx](../../../src/studio/GateCardView.tsx) 承载批准 / 驳回；Stage0View GatePendingStrip L199-211 既有「镜像不审批」先例——中栏 🚪 节点同哲学：只镜像 + 只读摘要，零按钮；
- **布局锚点现成**：三布局均为 `Header`（h-[38px]，Stage0View L228-242）+ 滚动容器（`absolute inset-0 top-[38px]`，L171 / L659 / L683）——链态条插 Header 之下、滚动区顶距 38→84 即恒显；
- **测试影响面锁定**：仅 stage0-view.test.tsx 渲染 Stage0View，其 `installFileRead`（L134-138）整体替换 `window.api = { fileRead }` 无 capture 两桥——叠加 2 行空桩即兼容（studio-flow / session-continue / window-titlebar-integration / realign-confirm 四文件已自带 capture 空桩）；文本碰撞排查：既有断言未用「选题诊断 / 故事前提 / 定案卡」做 getByText（L354 为 `queryByText('选题诊断结论')` 精确否定、L370 为 `getAllByText('立项单 v1')` 计数 1）——链态条文案避开「选题诊断结论」「立项单 vN」「待定」「立项定案门被驳回」逐字串即零碰撞；
- **目验素材现成**：[dev-mock-api.ts](../../../src/dev-mock-api.ts) L65-77 预置 5 条演示事实（genre / platforms / episodeCount / seasonBoundary / tone——命中词表后六要素 4/6、前提 1/5），demoCanvas gates 为空（🚪 未就绪态）——dev-mock 零 diff 即可目验 empty 态链与进度联动。

**原则对齐（D-016 系统优先）**：进度统计、状态镜像、摘要呈现均为规则可枚举的确定性操作——系统直做零 Token；批准 / 驳回、口径内容生成交由既有通道（右栏 GateCardView / 对话 Agent）。链态条纯订阅零写入，与 CaptureBar 面板直改共用同一数据模型（`已捕获口径.json`）与同一推送（`capture:changed`）。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 进入 STAGE 0 立项视图（未定案，对话进行中） | 顶部恒显链态条：左标「立项过程」+ ① 选题诊断 / ② 故事前提 / 🚪 定案卡三节点以 → 连接；①② 按已捕获口径显「未开始」或「收敛中 x/6、x/5」，🚪 显「未就绪」 |
| R2 | 创作者 | 对话中 Agent upsert 口径条目，或在 CaptureBar 面板直改 / 删除条目 | 链态条进度随 capture:changed 推送即时联动（如同名 topic 覆盖更新，x 按 canonical 键去重不重复计） |
| R3 | 创作者 | Agent 发出 0-final 定案门（pending） | 🚪 转「待拍板 vN」（N 取 payload.version）；点击 🚪 节点展开只读摘要浮层（立项定案卡 question 全文 + 「批准 / 驳回在右栏门卡操作」提示），再点收起；中栏零审批按钮 |
| R4 | 创作者 | 定案门被驳回（rejected，未定稿） | 🚪 转「被驳回」；①② 进度保持镜像不受影响 |
| R5 | 创作者 | 立项发布后再进 STAGE 0（published） | ①② 显「已定稿」（不再显进度分母），🚪 显「已发布 vN」（N 取 briefNode.meta.version）；双卡主体与既有叠加条（门镜像 / 脏读黄条）零改动 |
| R6 | 创作者 | 立项单读取失败（brief-error 态） | 链态条同构恒显（①② 已定稿 / 🚪 已发布），错误卡依旧 |
| R7 | 创作者 | capture 桥读取失败 | ①② 按空口径降级呈现 + 链态条右侧小字「口径读取失败」，不阻断页面 |

## 3. 核心机制

### 3.1 设计语映射（§2.6.8 链 → 顶部链态条）

设计「线性收敛链两节点 + 定案卡」映射为 STAGE 0 视图顶部恒显链态条的三节点 chip（① 选题诊断 / ② 故事前提 / 🚪 定案卡）+ → 连接符；「常驻元素不画成节点」（L377）——创意输入框与已捕获口径区不进链态条（口径区由 CaptureBar 既有承载，链态条只消费其数据）。映射留痕设计说明 D1。

### 3.2 顶部恒显布局

链态条为绝对定位横条：`absolute inset-x-0 top-[38px] h-[46px]`（Header 高 38px 之下），白底半透明 + 底边线（与 Header 同族）；三布局（EmptyStage0 L171 / BriefError L659 / published 主容器 L683）滚动容器顶距 `top-[38px]` → `top-[84px]`（38+46），容器内主体（静态卡 / 错误卡 / 双卡）零 diff。

### 3.3 纯函数层 `stage0/chain.ts`（新建）

独立新模块（不并入 select.ts——该文件只投影 canvas 落盘事实，facts 非 canvas 事实，分模块守边界，设计说明 D6）。全量签名与匹配规则见契约 §1-§2：

- `matchChainTopic(topic)`：trim + 英文小写化后按词表精确匹配 → `{ group:'six'|'premise', key } | null`；
- `selectChainProgress(facts)`：按 canonical 键去重统计 covered（x），未命中词表条目计 `unmatchedCount` / `totalFacts` 不计 x；
- `selectChainNodes(state, facts)`：①② 三态（未开始 / 收敛中 / 已定稿）+ 🚪 四态（未就绪 / 待拍板 / 被驳回 / 已发布）与版本解析；状态优先级 published > pending > rejected > idle（设计说明 D3）；
- `gatePayloadVersion(payload)`：最小形状守卫（isObject + `Number.isInteger(version)` + ≥1），非法 → null。

### 3.4 数据接入（Stage0Chain 内 useCaptureFacts）

CaptureBar L33-41 同模式：`captureList()` 首拉 + `onCaptureChanged` 全量替换订阅 + alive 标志 + 卸载退订；纯订阅零写入（不调 captureUpsert / captureRemove / 任何 gate 动作）；首拉失败 → facts 置空 + `loadError` 小字（R7），不自动重试刷屏。

### 3.5 🚪 只读摘要（pending 专属）

仅「待拍板」态 🚪 节点可点击（其余态不可点、无展开 affordance）；点击切换摘要浮层（链态条下方绝对定位白卡，z-20 覆盖滚动区之上、不推布局）：标题行「立项定案卡 · 待拍板 v{N}」+ `gate0.question` 全文（whitespace-pre-wrap、限高滚动）+ 提示行「批准 / 驳回在右栏门卡操作」；零按钮；不做悬停触发、不做外点 / Esc 关闭（chip 切换等价，防误触——与 feature-007 同哲学，设计说明 D4）。

### 3.6 口径与文案基准

进度匹配词表（canonical → 匹配词，含中英文别名）与全部上屏文案逐字锁定于契约 §1 / §3.3；pending / confirmed 条目均计入进度（进度 = 已捕获非已确认，口径区确认语义由 CaptureBar 承载）；链态条不显示未命中条目数（总数口径留 CaptureBar「已捕获口径」区）。

## 4. 范围

### 4.1 做

1. 新建 `src/studio/stage0/chain.ts`（§3.3 全量纯函数；禁 fs / window.api / Date / 随机）；
2. 新建 `src/studio/Stage0Chain.tsx`（链态条组件 + useCaptureFacts hook + 🚪 摘要浮层；契约 §3 凭据族与文案逐字）；
3. `src/studio/Stage0View.tsx`：三布局各挂 `<Stage0Chain state={state} />`（Header 之后一行）+ 三处滚动容器顶距 38→84；主体零 diff；
4. `src/studio/stage0-view.test.tsx`：`installFileRead` 内叠加 `captureList` / `onCaptureChanged` 空 facts 桩（恰 2 行，既有用例兼容；本包唯一既有测试 diff，设计说明 D5）；
5. 测试：`src/studio/stage0-chain.test.tsx` 新建（**净增恰 1**；其余既有测试文件全零 diff）；
6. 治理收尾：README 总表增 008 行、偏差清单 B-43 翻态关闭、版本记录增行。

### 4.2 不做（显式排除）

- **缺口 #5 前提卡分色 + 「不可篡改」水印不做**（§2.6.8 L379）——另案登记；
- **缺口 #6 中栏定案卡「查看历史」不做**——feature-004 已在 StudioViewer 落地 brief 查看历史，中栏节点不复刻；
- 标题栏 STAGE 进度轨 / 左栏流程导航 / StageNavPanel 零 diff；画布 DAG（CanvasBoard）零 diff——链态条不进画布、画布不画收敛链节点；
- 链态条**零写入**：不调 captureUpsert / captureRemove、不发门、不审批；批准 / 驳回单点仍在右栏 GateCardView（中栏零审批按钮，GatePendingStrip 镜像哲学同）；
- 口径词表闭集校验不做（showrunner L101 开放词表纪律不变；未命中仅不计进度，不告警、不纠正）；
- Agent 指令层（showrunner.md）零 diff——纯呈现层不需要指令配合；feature-001 变更记录无新 R 条；
- 🚪 摘要不渲染 payload.pendingMarks / changesFromPrevious 结构件（question 全文已含，showrunner L125；零重复呈现）；摘要不支持悬停 / 外点 / Esc 关闭；
- dev-mock 零 diff（5 条演示事实已可目验 4/6、1/5 与未就绪态；待拍板 / 已发布态由单测覆盖）；
- `shared/types.ts` / `electron/**` / preload / `global.d.ts` / `package.json` / tailwind / vite 配置零 diff。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | matchChainTopic / selectChainProgress：词表 11 canonical 全命中（英文推荐词 + 中文别名 + trim + 大小写不敏感）；同 canonical 多 fact 去重计 1；未命中计 unmatchedCount / totalFacts 不计 x；六要素与前提跨组不误配 | 单测 |
| AC2 | selectChainNodes / gatePayloadVersion：empty 无 facts → 未开始 + 未就绪；有 facts → 收敛中 x/6、x/5；published → 已定稿 + 已发布 vN（briefNode.meta.version 解析失败 → 仅「已发布」）；pending → 待拍板 vN（payload 非法 → 仅「待拍板」）；rejected → 被驳回；优先级 published > pending > rejected | 单测 |
| AC3 | Stage0Chain 组件：三节点 + 左标 + 箭头凭据齐全；capture 首拉驱动进度上屏；onCaptureChanged 推送全量替换后进度联动；首拉失败 → 空进度 + 「口径读取失败」小字 | 组件单测 |
| AC4 | 🚪 摘要：pending 点击展开（question 全文 + 「批准 / 驳回在右栏门卡操作」+ 零按钮），再点收起；idle / rejected / published 态不可点、无浮层；中栏无「批准 / 驳回」按钮 | 组件单测 |
| AC5 | Stage0View 集成：empty（含 gate pending 叠加）/ published / brief-error 三态链态条恒显且三节点状态正确；published 双卡既有凭据零回归（既有 stage0-view 用例全绿背书）；滚动容器顶距 top-[84px] | 组件单测 |
| AC6 | 回归红线：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量以 T1 实测基线（上包收尾 58 文件 662 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、failed=0、测试文件净增恰 1（58→59）；既有测试文件除 stage0-view.test.tsx installFileRead 恰 2 行叠加外全零 diff | 全量回归 |
| AC7 | 真机（dev-mock 浏览器预览）：STAGE 0 链态条显「收敛中 4/6」「收敛中 1/5」「未就绪」；CaptureBar 面板直增一条 `episodeDuration` 口径 → ① 联动「收敛中 5/6」；三布局切换（STAGE 0 ↔ DAG）链态条行为稳定 | 真机 |
