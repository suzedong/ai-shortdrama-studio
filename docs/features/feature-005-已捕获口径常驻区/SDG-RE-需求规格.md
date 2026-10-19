# SDG-RE-需求规格 · feature-005 「已捕获口径」常驻区

> **包号**：feature-005（0xx STAGE 0 立项段）
> **业务名**：「已捕获口径」常驻区（候选口径落盘持久化 + 双通道写入 + 右栏对话区顶部常驻条）
> **性质**：数据面新增（候选口径独立文件）+ 主进程读写与广播 + renderer 常驻条 + showrunner 铁律收窄修订；**K1 触发**（`CapturedFact`/`CaptureFile` 进 `shared/types.ts`，建包登记）；**K8 触发**（3 新 MCP 工具 + 3 新 IPC + 1 推送，建包登记）；**K9 零触发**（零新依赖）
> **事实源**：《短剧Agent平台设计.md》§2.6.1（L136/L146/L149）、§2.6.8（常驻元素不画成节点）
> **前置**：feature-001（立项模型 + showrunner 第 0 步）、feature-002（`updateBrief` 系统直写双通道先例）、feature-003（§4.2 L94 登记本缺口「另立包」）、feature-004（`立项单.vN` 版本化体系，口径区为其上游草案源）、B-34（LabelTag 三色标签渲染基础）、B-26④（右栏 300–640px 可调体系）
> **溯源标签**：[Design 原有]（设计书明示的常驻区形态，MiniMax Design 有对应物，形态对齐）
> **偏差登记**：B-38（feature-003 §4.2 登记的缺口，本包登记并关闭）
> **日期**：2026-10-19

## 1. 背景

设计书三处明示、至今零落地：

- §2.6.1 总体模型图（L136）：「**『已捕获口径』区从第一句话起持续可见、随时可改**」；
- §2.6.1（L146）：「**未回答前，能记录的先记录**。从创意中可直接提取的事实（时间=2002、核心事件=相识、人物关系=夫妻）**立即写入『已捕获口径』区，不等用户回答反问**」；
- §2.6.1（L149）：「**『已捕获口径』区：立项界面的常驻区域（对话区旁 / 画布侧栏），从第一句话起持续累积；每条口径标注来源（用户原话 / Agent 推断待确认），用户随时可直接修改或在对话中纠正。它是两个节点与定案卡的共同数据源，不是某个节点的专属产物。**」
- §2.6.8（L377）：创意输入框与「已捕获口径」区为**常驻元素，不画成节点**。

代码实证（2026-10-18 盘点）：renderer 全仓无「已捕获口径」任何对应物；候选态只存在于 Agent 会话内存，重开项目即丢失；feature-003 §4.2 L94 正式登记「不做『已捕获口径』常驻区……另立包」——本包即该「另立包」。

**L2 三方冲突（建包前已裁决）**：冻结基线时发现三方互斥——①设计书 §2.6.1「常驻区 + 随时可改 + 持续累积」（隐含持久化与 renderer 通道）；②showrunner.md L73/L95 铁律「候选态不落盘、不建门、不建画布节点」（无落盘则常驻区重开即空）；③原型 rightCapture 实际为「气泡融合」形态（口径并入消息气泡而非独立常驻区）。按治理 §8 定性 L2 跨文件冲突，暂停编码呈报，用户三裁决（2026-10-18）：

| # | 裁决点 | 拍板 |
|---|---|---|
| ① | **形态** | **常驻区全量对齐设计书**：候选口径落盘持久化（新文件 + Agent 写入工具 + renderer 通道），常驻面板持续累积、标来源色，面板可直接编辑（系统直写 D-016）+ 对话纠正双通道；**推翻 showrunner「候选态不落盘」铁律中「口径」部分**（收窄修订，其余候选态仍对话流） |
| ② | **修改通道** | **面板直改 + 对话纠正双通道**：面板字段直接编辑 → 系统直写候选口径文件（对齐 feature-002 updateBrief 模式）；对话中 Agent 纠正 → 同写同一文件；双通道落同一数据模型、同一追溯机制 |
| ③ | **挂点** | **右栏对话区顶部常驻条**：对齐原型 ct「对话中 · N 口径已落库」位置语义，在右栏栏宽 300–640 可调体系内，不挤占中栏 |

**原则对齐（D-016 系统优先）**：口径的增删改、确认、读取均为规则可枚举的确定性操作——面板侧一律系统直做不经 AI 对话；仅「从对话提取事实 / 理解纠正语义」属 AI 职责（Agent 通道）。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 说出一句话创意，尚未回答项目性质反问 | 可直接提取的事实（时间/核心事件/人物关系等）已写入口径区（source='user' 记原话），常驻条即时累积显示，不等反问回答（§2.6.1 L146） |
| R2 | 创作者 | 随时扫一眼当前已收敛内容 | 右栏对话区顶部常驻条恒显「已捕获口径 · N 条（· M 待确认）」；展开后逐条列出 topic/value/来源标签——用户原话（白底紫边）/ Agent 推断·待确认（琥珀）/ Agent 推断·已确认（紫） |
| R3 | 创作者 | 发现某条口径写错了，想直接改 | 常驻条内行内编辑 value/topic → 确认后**系统直写** `已捕获口径.json`（不经 AI 对话，D-016）；Agent 下轮读取即见新值 |
| R4 | 创作者 | 在对话中纠正（「不是 2002，是 2003」） | Agent 调 `capture.upsert` 更新同一条目（同一文件、同一写队列、同一广播），常驻条即时刷新 |
| R5 | 创作者 | 对 Agent 推断条目表态「对，就是这样」 | Agent 或面板将该条 status 置 confirmed，琥珀「待确认」转为已确认态 |
| R6 | 创作者 | 重开项目继续立项 | 口径区从 `已捕获口径.json` 完整恢复，不丢任何已累积内容 |
| R7 | Agent | brief.plan 就绪自检 / 定案卡字段来源回溯 | 以口径文件为草案事实源对照（设计「两个节点与定案卡的共同数据源」），本包仅提示词层对齐，plan/publish 代码零 diff |

## 3. 核心机制

### 3.1 数据面：`已捕获口径.json`（K1）

项目根单文件 `已捕获口径.json`（与 `故事背景档案.md` 同级、项目根白名单内），覆盖式更新、不版本化（过程态草稿非定案产物；追溯 = 同一文件 + 写队列 + `capture:changed` 广播 + 每条 `updatedAt`）：

```ts
// shared/types.ts（K1 登记）
type CaptureSource = 'user' | 'infer'
type CaptureStatus = 'pending' | 'confirmed'
interface CapturedFact {
  id: string            // 'f1'/'f2'… 递增，稳定不复用
  topic: string         // 开放主题词（推荐词表：六要素 6 字段 + 前提 5 项 + 自由主题，不闭集校验）
  value: string
  source: CaptureSource // user=用户原话（须带 quote 举证）；infer=Agent 推断（缺省，默认待确认）
  status: CaptureStatus // user→confirmed；infer→pending（缺省推导，可显式覆盖）
  quote?: string        // source='user' 时的用户原句
  updatedAt: string     // ISO
}
interface CaptureFile { schemaVersion: 1; facts: CapturedFact[] }
```

不存在 = 空库（`{schemaVersion:1, facts:[]}`，不报错）；损坏 = 抛错不静默覆盖（对齐 feature-004「不放行猜测」）。

### 3.2 写入双通道（同一 store 模块，D-016）

`electron/capture/store.ts` 单点读写（读 / upsert / remove / 写队列 enqueue / 写后广播 `capture:changed` 全量载荷）：

- **Agent 通道（对话纠正/提取）**：3 新 MCP 工具 `shortdrama_capture.list / .upsert / .remove`（工具总数 22→25，K8）。showrunner 第 0 步纪律修订：提取到事实立即 upsert（§2.6.1 L146），推断标 `source:'infer'`，用户原话标 `source:'user'` 且 quote 逐字。
- **系统通道（面板直改）**：3 新 IPC `capture:list / capture:upsert / capture:remove` + 1 推送 `capture:changed`（K8）。面板编辑/确认/删除 → 系统直写同一文件（对齐 feature-002 updateBrief 模式），不经 AI 对话。
- **upsert 匹配规则**：有 `id` → 精确更新该条（不存在 → `CAPTURE_FACT_NOT_FOUND` 零写盘）；无 `id` → `topic` trim 后与既有条目精确相等则更新该条，否则新建（id 取 max+1）。status 缺省推导：`user→confirmed`、`infer→pending`。
- 双通道写后均广播 `capture:changed`（载荷 = 全量 CaptureFile），renderer 收到即替换刷新——同一数据模型、同一追溯机制（用户裁决②）。

### 3.3 常驻条形态（挂点 = 右栏对话区顶部，用户裁决③）

`src/studio/CaptureBar.tsx` 挂在 StudioApp 右栏 aside 内、ChatComposer 上方（对话区顶部常驻），宽度随 chatWidth 体系（300–640px）：

- **收起态（常驻一行，恒显）**：「已捕获口径 · N 条」+（M>0 时）琥珀点「· M 待确认」+ 展开/收起钮；空态显「从第一句话起持续累积」引导文案（§2.6.1）。
- **展开态**：逐条一行——topic（粗体）+ value + 来源标签（复用 B-34 LabelTag 三色语义：user 白底紫边「用户原话」/ infer+pending 琥珀「推断 · 待确认」/ infer+confirmed 紫「推断 · 已确认」）+ 行内操作（编辑 / pending 时「确认」/ 删除）。
- **行内编辑**：topic/value 变输入框 → 确认调 `capture:upsert`（系统直写）；取消零调用。删除调 `capture:remove`。确认调 `capture:upsert({id, status:'confirmed'})`。
- 初始拉取 `capture:list` + 订阅 `capture:changed` 全量替换；重开项目自文件恢复（R6）。
- **不建门、不建画布节点**（§2.6.8 常驻元素不画成节点；铁律该部分保留）。

### 3.4 showrunner 铁律收窄修订（归 feature-001 变更记录 R-006）

L73 纪律 2 末句与 L95 铁律收窄：「候选态不落盘」修订为——**「已捕获口径」经 `capture.*` 工具落盘 `已捕获口径.json`（唯一例外）；诊断卡、风格选型等其余候选态仍只留对话流；不建门、不建画布节点**（§2.6.8）。L98 step 2「先记入对话中的『已捕获口径』」改为「立即经 `capture.upsert` 落盘」；L99「诊断与草案只在对话中呈现」保留（诊断卡本身仍对话态，口径区存事实条目非诊断卡）。新增纪律：brief.plan 就绪自检与定案卡字段来源回溯对照口径文件（共同数据源语义，提示词层对齐，不改 plan.ts）。

## 4. 范围

### 4.1 做

1. **K1**：`shared/types.ts` 增 `CaptureSource`/`CaptureStatus`/`CapturedFact`/`CaptureFile`（字段方案见契约 §1，用户批准后实施）；
2. 主进程：`electron/capture/store.ts`（新，读/upsert/remove/广播）；`electron/mcp/tools.ts` +3 工具（22→25，K8）；`electron/main.ts` +3 handle + changed 广播挂点；`preload.ts` +3 桥 + 订阅桥；`global.d.ts` DTO 镜像；
3. 指令层：showrunner.md L73/L95/L98 收窄修订 + 新增「口径落盘纪律」；feature-001 变更记录 R-006 回写；
4. renderer：`src/studio/CaptureBar.tsx`（新，收起/展开/三色标签/行内编辑/确认/删除/空态）；StudioApp 挂载；`dev-mock-api.ts` capture mock + 演示数据；
5. 单测：`src/test/capture-store.test.ts`（主进程）、`src/studio/capture-bar.test.tsx`（组件）——恰净增 2 测试文件。

### 4.2 不做（显式排除）

- 不改 `electron/brief/*` 任何文件（plan/publish/update/diff/history/rollback 零 diff）——口径区是 brief 上游草案源，消费侧仅提示词层对齐；
- 不建画布节点、不建门（§2.6.8）；不动 canvas 节点模型与 gate 体系；
- 不做口径历史版本/回滚（过程态草稿覆盖式更新，立项单版本化体系不适用于草稿）；
- 不做 topic 闭集校验与字段结构化映射（topic 开放词表；口径 → 六要素/前提字段的正式映射属 brief.plan 职责，不在本包）；
- 不做缺口追问 chip 与 qh 拍板提示（缺口 3，B-35 已登记后续切片）；
- 不推翻「候选态不落盘」铁律的其余部分（诊断卡/风格选型仍对话流）；
- 无新依赖、无新动画 token。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | `capture.upsert` 三路径正确：新建（id 递增）/ 按 id 更新 / 按 topic trim 精确匹配更新；status 缺省推导（user→confirmed 记 quote、infer→pending）；updatedAt 刷新；schemaVersion=1 | 单测 |
| AC2 | `capture.remove`：存在则删除；id 不存在 → `CAPTURE_FACT_NOT_FOUND` 零写盘；文件损坏 → 抛错不静默覆盖 | 单测 |
| AC3 | 双通道同一数据模型：MCP `capture.*` 与 IPC `capture:*` 落同一 `已捕获口径.json`、同经 store 单点与写队列；读回形状一致 | 单测 |
| AC4 | 双通道写后均广播 `capture:changed`，载荷 = 全量 CaptureFile | 单测 |
| AC5 | CaptureBar：收起态计数（N 条 · M 待确认）；展开态来源三色标签（user 白紫 / infer+pending 琥珀 / infer+confirmed 紫）；行内编辑确认调 IPC、取消零调用；pending 条「确认」与「删除」动作正确 | 组件单测 |
| AC6 | 重开持久：文件存在 → `capture:list` 返回全量，面板恢复渲染；无文件 → 空态不报错 | 单测 + 组件 |
| AC7 | 不建门不建画布节点：全链路后 canvas.json 无任何 capture 节点、无新增门；showrunner 修订文本落盘且 feature-001 R-006 回写 | 静态核查 |
| AC8 | 回归红线：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量 **51 文件 564 passed / 0 failed / 1 skipped** 起步，passed 不减少、skip 不增、测试文件净增恰 2 | 全量回归 |
| AC9 | 真机目验：对话提取 → 常驻条累积（琥珀待确认）→ 面板直改 → 对话纠正 → 确认转态 → 重开项目恢复 | 真机 |
