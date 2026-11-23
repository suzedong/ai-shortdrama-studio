# SDG-AI-变更记录 — feature-005 已捕获口径常驻区

> 本文件按通用规则 §2 记录本任务包全部变更，三类分节：**D（决策）/ T（任务执行）/ X（修复）**。

---

## D（决策）

### D-001 建包与字段方案、K1/K8 卡口登记（2026-10-19）

**背景**：新建→立项链路缺口盘点（2026-10-18）确认缺口 2——「已捕获口径」常驻区未实现。设计书 §2.6.1 三处明示（L136 模型图「从第一句话起持续可见、随时可改」；L146 事实立即写入不等反问；L149 常驻区域持续累积、标来源、随时可改、两个节点与定案卡共同数据源）+ §2.6.8 立为常驻元素不画成节点；代码实证无任何对应实现（feature-003 §4.2 L94 明示另立包）。

**L2 冲突（跨文件，已呈报裁决）**：设计书常驻区全量形态 ↔ showrunner.md L73/L95「候选态不落盘」铁律 ↔ feature-003 §4.2 登记排除，三方不一致，依 §8 冲突裁决呈报用户。

**用户裁决（2026-10-18，AskUserQuestion 三问拍板）**：

1. **形态 = 常驻区全量对齐设计书**：候选口径落盘持久化（项目根 `已捕获口径.json`），常驻面板持续累积、标来源色；推翻 showrunner「候选态不落盘」铁律中「口径」部分，触发 K1（shared/types.ts 增类型）+ K8（新 MCP 工具 + 新 IPC）。
2. **修改通道 = 面板直改 + 对话纠正双通道**：面板直改系统直写（D-016）+ 对话纠正开放式兜底，落同一数据模型同一追溯（store.ts 单点 + capture:changed 广播）。
3. **挂点 = 右栏对话区顶部常驻条**：StudioApp 右栏 aside 内、ChatComposer 上方，宽度随 chatWidth 体系（B-26④）。

**K1 卡口登记（shared/types.ts 增 4 类型）**：`CaptureSource`、`CaptureStatus`、`CapturedFact`、`CaptureFile`——字段方案见本包 SDG-RE-契约.md §1，用户裁决 1 即字段方案确认（Approved），登记后方可动代码。

**K8 卡口登记（新通道）**：MCP 工具 3 个（`shortdrama_capture.list/upsert/remove`，工具总数 22→25）+ IPC 3 条（`capture:list/upsert/remove`）+ 推送 1 条（`capture:changed`）——契约见 SDG-RE-契约.md §2。

**K9 卡口**：零触发，无新依赖。

**铁律收窄修订归属**：showrunner.md L73/L95/L98 修订（「候选态不落盘」收窄为「除口径外不落盘」+ 口径经 capture.* 落盘纪律 + brief.plan 对照口径文件纪律）属指令层既有文件修改，按 B-34（R-004）/B-35（R-005）先例归 **feature-001 变更记录 R-006**，本包 T3 执行时同步回写。

**偏差登记**：B-38（「已捕获口径」常驻区缺失，feature-003 §4.2 登记缺口，本包登记并关闭）。

**溯源标签**：[Design 原有]（MiniMax Design 有对应物的形态对齐）。

**技术决策指针**：落点与取舍见 SDG-OD-设计说明.md D1-D9（独立文件非 canvas 扩展 / 覆盖式不版本化 / store 单点双薄壳 / upsert id>topic / K1 三端消费 / source 缺省 infer / brief.plan 仅提示词层 / 右栏挂点 / 铁律收窄归 feature-001 R-006）。

### D-002 id 高水位字段（K1 方案微调，2026-10-19）

**发现（T5 首跑红灯暴露）**：契约 §1 测试清单「id 递增不复用」用例（f1/f2 → remove f2 → 新建应得 f3）实测得 f2——store.ts 新建分配只扫当前 facts max+1，删掉最高 id 条目后该 id 被复用。契约 L14/L32「删除的 id 不复用」与「CaptureFile 仅 facts[] + 覆盖式不版本化」存在内部张力：无高水位字段，跨重启后高水位语义守不住（当前 facts 已不含被删最高 id）。

**停手呈报与裁决**：按契约 §6 卡口「字段方案实施中需调整 → 停手呈报」，AskUserQuestion 呈报三方案（A 加高水位字段 / B 收窄契约对齐实现 / C id 改 uuid 废递增语义），**用户裁决（2026-10-19）：方案 A——CaptureFile 增可选 `nextId?: number` 高水位**。

**方案 A 语义**：`nextId` = 下一个待分配编号，单调不减；schemaVersion 不变、旧文件缺省兼容（缺省 = facts max+1 推导）；新建取 `max(nextId ?? 1, maxFactId(facts)+1)` 分配 `f{n}`，推进 `nextId = n+1` 随文件持久化；remove 不动 nextId——删除的 id 跨重启不复用。

**联动文件（4）**：① `shared/types.ts` CaptureFile + `nextId?: number`（K1 方案微调，本登记即凭据）；② `electron/capture/store.ts`（readFile 归一化带 nextId、`nextId(facts)` 帮手改 `maxFactId(facts)`、upsert 新建分支高水位分配、U2 doc 注释同步）；③ `src/dev-mock-api.ts`（`demoCaptureNextId` 单例 + `allocDemoCaptureId` 帮手 + `demoCaptureFile` 带 nextId，语义对齐主进程）；④ 契约 §1（ts 块 CaptureFile 增 nextId 行 + id 分配行改高水位语义）。

**验证**：方案 A 落地后 typecheck 恰 3 基线零新增、新增两测试文件 22/22 全绿（红灯用例转绿）；历史过程不在实施区重复。

---

## T（任务执行）

### T1—T8 已落地实施压缩注（2026-11-20）

T1—T8 已按任务清单完成：口径数据面、store 单点读写、MCP/IPC 双薄壳、指令与运行时装配、常驻面板、dev-mock、测试及治理索引均已落地。过程命令、逐文件改动和当时测试计数不再复制；现行需求、边界与验收以本包需求规格、契约、设计说明和任务清单为准。D-002 的高水位决策及 X-001—X-005 的真实缺陷、自动测试证据与真机待验状态全部保留。

保留的实施偏差与缺陷闭环：T3/T6 的 K8 联动漏项（运行时白名单与工具计数、既有组件 mock 缺 capture 桥）经用户 2026-10-19 批准按先例补登；T4 的行错误可选链 TS18047 与共享类型声明产物陈旧导致的 TS2305，分别通过显式空值守卫和刷新 node 类型声明修复。T7 的浏览器 dev-mock 六步目验通过结论保留，但其 openProject 桩与模块级内存单例不支持真实切项目，第 6 步实际以 captureList 重读验证恢复渲染；该证据不扩张为真实 Electron 跨项目或跨重启持久化验收。

---

## X（修复）

### X-001 B-51/B-52 · 口径 topic 中文化 + 立项中间区成组呈现（2026-11-01，✅）

**背景**：真机上报（test 项目截图）——①右栏口径列表直显 genre / place / coreEvent / kind / platforms / episodeDuration 英文物理键；②顶部链条已显「选题诊断 收集中 6/6」，但 6 条已捕获诊断口径在中间主区无任何呈现。

**落地（纯函数事实源在本包 chain.ts）**：
- **B-51**：[chain.ts](../../../src/studio/stage0/chain.ts) 新增 `captureTopicLabel(topic)`——由 select.ts 的 FIVE_ELEMENT_FIELDS/PREMISE_FIELDS 动态构表 + 额外 kind=项目性质，空串回空串、未命中回退原 topic（不臆造名称）；[CaptureBar.tsx](../../../src/studio/stage0/CaptureBar.tsx) 只读 topic 经该函数渲染中文名，物理键保留在 `title` 属性供追溯；校验文案改「字段名与内容不能为空」，topic/value 编辑 placeholder 中文化（**输入值与落盘仍持物理原键，只改呈现**）。
- **B-52（分组能力）**：chain.ts 新增 `selectCaptureGroups(facts)` 及 `CaptureGroups`/`CaptureGroupItem` 类型——复用 matchChainTopic 按词表分 `six`（六要素 6 键）/`premise`（前提 5 键）/`unmatched`，同键多条取文件序最后一条（最新），unmatched 保原序；组件消费方归 feature-013 Stage0View（见其 D-004）。

**卡口**：**K1/K8/K9 零触发**——CaptureFile/CapturedFact 形状、capture 三通道、store 单点读写全部零 diff，纯 renderer 纯函数/呈现层。

**测试**：[capture-bar.test.tsx](../../../src/studio/stage0/capture-bar.test.tsx) 既有展开用例增 4 条中文标签断言（genre→题材赛道、episodeCount→集数、seasonBoundary→本季边界、tone→风格基调，并断言英文裸词 genre 不再出现），placeholder 引用同步改「内容」；B-52 组件用例落 feature-013 stage0-view 套件。最终全量 **76 文件 937 passed / 0 failed / 1 skipped**，typecheck 恰 3 条历史基线零新增；真机目验待用户执行。

**偏差登记**：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) B-51、B-52（均 ✅ 已解决）。

### X-002 B-57/F2 · capture.upsert_many 批量落盘 + 返回全量（2026-11-01，✅）

**背景**：真机审计（test 项目立项对话，偏差 B-57 第 ⑤ 项）——showrunner 从用户单轮话语中常提取多条口径，既有 `capture.upsert` 单条通道须 N 次「读全量 → 改一条 → 全量写盘 → 全量广播」，磁盘与广播开销随条数线性放大；且 upsert 仅返回单条事实，Agent 落库后无法直接得到全量口径，须再调 `capture.list`。

**落地（store.ts 仍为本包唯一读写点）**：
- [store.ts](../../../electron/capture/store.ts) 新增 `upsertMany(inputs)`——同一写队列内**一次读入**，抽提共用的纯内存 `applyUpsert`（单条 U1–U4 语义原样下沉，upsert 同步改为调用），**同一时间戳顺序套用 N 条**（前条新建/更新对后条可见，topic 可匹配前条产物），**一次写盘、一次广播**；任一条静态校验失败抛错且零写盘。
- 返回形状：upsertMany → `{ facts, file }`（facts 按入参顺序，file 为写后全量 CaptureFile，无需再 list）；既有 upsert 同步扩为 `{ fact, file }` 全量返回（调用方随动，remove 形状不变）。
- [tools.ts](../../../electron/mcp/tools.ts) 注册 `shortdrama_capture.upsert_many`（K8 新增 1 工具：全仓 28→29）；按 D-012 argsPreview 白名单口径，`items` 为批量载荷永不落摘要（空白名单）。
- [provider.ts](../../../electron/runtime/provider.ts) `SHOWRUNNER_DECLARED_TOOLS` 同步 +1；showrunner frontmatter tools + permission 双区授权（提示词层联动登记归 [feature-001 R-009](../feature-001-立项模型重建/SDG-AI-变更记录.md)）。

**卡口**：**K8 触发**（新增 1 MCP 工具，用户已随 B-57 批准；本登记即凭据）；K1/K9 零触发——CaptureFile / CapturedFact / CaptureUpsertInput 形状零 diff，无新 IPC、无新依赖。

**测试**：[capture-store.test.ts](../../../src/test/capture/capture-store.test.ts) 增 upsert_many 用例（多条一次写盘、前条对后条可见、任一失败零写盘、返回全量 file）；[mcp-pure-tools.test.ts](../../../src/test/mcp/mcp-pure-tools.test.ts) 计数 28→29 + names 补项；runtime-client / runtime-integration 白名单计数与排序清单同步。最终全量 **76 文件 950 passed / 0 failed / 1 skipped**，typecheck 恰 3 条历史基线零新增；真机目验待用户执行。

**偏差登记**：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) B-57（✅ 已解决）。

### X-003 B-64 · 「其他口径」英文键名中文化 + topic canonical 约束（2026-11-01，✅）

- **现象**：真机截图「其他口径 · 3 条」出现 `kind` / `revengeTarget` / `style.mainStyleId` 英文键名，与六要素 / 前提区的中文标签不一致。
- **根因**：[chain.ts](../../../src/studio/stage0/chain.ts) `TOPIC_LABELS` 只由六要素 / 前提字段 + `kind` 拼成，缺 `style.*` 映射；[Stage0View.tsx](../../../src/studio/stage0/Stage0View.tsx) unmatched 行直接渲染 `f.topic` 原文，未过 `captureTopicLabel`（CaptureBar 已是正确用法）；提示词侧允许 Agent 自造英文键。
- **修复**：`TOPIC_LABELS` 增补 `style.mainStyleId`（主风格）/ `style.auxiliaryStyleId`（辅助风格）/ `style.catalogVersion`（谱系版本），与 [select.ts](../../../src/studio/stage0/select.ts) 脏字段表同源；unmatched 行改用 `captureTopicLabel`；[showrunner.md](../../../resources/opencode/agents/showrunner.md) 纪律 11 增 canonical 键约束（词表覆盖的事实必须用 canonical 键，词表外事实自取中文短词，禁自造英文键）。
- **卡口**：纯 renderer 映射 + 提示词，**K1/K8/K9 零触发**（`CapturedFact` 形状零 diff）。
- **验证**：[stage0-chain.test.tsx](../../../src/studio/stage0/stage0-chain.test.tsx) 新增 1 例（canonical 中文化、中文 topic 原样、未知英文键不臆造回退）；全量 **77 文件 959 passed**，typecheck 恰 3 条历史基线零新增。
- **遗留**：历史已写入的自造英文键（如 `revengeTarget`）无法离线翻译，原样保留；由 X-004（B-65）存量兼容映射处理。

### X-004 B-65 · 存量自造英文键 `revengeTarget` 中文化（2026-11-01，✅）

- **现象**：X-003 修复后，右栏「其他口径」仍有一条 `revengeTarget` 显示英文键名——它是早期 Agent 自造并已落盘 `已捕获口径.json` 的历史事实，不在 canonical 词表内。
- **根因**：[chain.ts](../../../src/studio/stage0/chain.ts) `captureTopicLabel` 未命中 `TOPIC_LABELS` 即回退原 topic（「不臆造名称」的保守策略），对存量英文键没有兜底；数据已落盘无法离线改写。
- **修复**：新增 `LEGACY_TOPIC_LABELS` 存量兼容表（`revengeTarget` → 复仇对象），仅做旧数据映射、不随新字段扩张（新口径由 X-003 的提示词 canonical 约束禁止自造英文键）；[Stage0View.tsx](../../../src/studio/stage0/Stage0View.tsx) unmatched 行补 `title`（`字段：<原键>`），与 [CaptureBar.tsx](../../../src/studio/stage0/CaptureBar.tsx) 同约定，保留原始键可追溯。
- **卡口**：纯 renderer 映射，**K1/K8/K9 零触发**（`CapturedFact` 形状与落盘格式零 diff）。
- **验证**：[stage0-chain.test.tsx](../../../src/studio/stage0/stage0-chain.test.tsx) 该用例改为断言 `revengeTarget → 复仇对象`，另以 `budget` 断言未登记 topic 仍原样回退；stage0 五文件 **109 passed**，typecheck 恰 3 条历史基线零新增。

### X-005 B-69 · 存量自造英文键 `audience` 中文化（2026-11-03，✅）

- **现象**：真机「其他口径」/ 口径条出现 `audience` 英文键名，与同区中文标签不一致（与 B-65 同类）。
- **根因**：`audience` 是早期 Agent 自造并已落盘 `已捕获口径.json` 的存量键，不在 canonical 词表，[chain.ts](../../../src/studio/stage0/chain.ts) `captureTopicLabel` 按「不臆造名称」回退原文。
- **修复**：`LEGACY_TOPIC_LABELS` 追加 `audience → 目标受众`，仍只做旧数据映射，不随新字段扩张。
- **卡口**：纯 renderer 映射，**K1/K8/K9 零触发**。
- **验证**：[stage0-chain.test.tsx](../../../src/studio/stage0/stage0-chain.test.tsx) 增 `audience → 目标受众` 断言；stage0 三文件 **88 passed / 0 failed**。

### X-D037 A 组文档归并（2026-11-19，文档 Change）

- **来源**：feature-008《立项过程链式呈现》需求 §3.1–§3.2、契约 §1 / §2.1–§2.2、设计 §2 D2，以及本包 X-001 已登记的 `selectCaptureGroups` / 中文标签职责。008 的 gate / canvas 状态与组件呈现不迁入本包。
- **目标章节**：需求规格 §6「D-037 现行归并约束」；契约 §7「D-037 归并契约」；设计说明 §5「归并职责边界」；任务清单「D-037 文档归并 Change / AC」。
- **冲突处理**：005 保持独立，不并入 013；013 仅消费统一词表 / 匹配 / 分组结果。`kind / style.*` 属显示词表后续扩展，不自动扩张 008 的 x/6、x/5；legacy 英文键只读映射，不回写历史数据。
- **开放状态**：历史 T7 的真机通过结论保留；X-001 / X-002 等后续修订的自动测试通过记录与“真机目验待用户执行”开放状态并列保留，本轮不翻案。
- **验证**：逐文件自审来源映射、函数名、词表与写权边界；未运行产品测试，未改产品代码、shared/types.ts、依赖或真实项目数据。**无第二人复核**。
