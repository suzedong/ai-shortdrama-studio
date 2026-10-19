# feature-001 立项模型重建 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · K1 批准修改共享层 `shared/types.ts`（2026-10-13）

- **触发**：立项模型重建必须替换 `ProjectBrief` schema、改 `GateId` 门 id 联合类型，命中 K1（共享层修改须用户批准）。
- **批准方式**：AskUserQuestion 明确选项「P0 任务包 + 直接开始编码」，用户选定即视为对本包 K1 范围的显式批准（含同轮编码）。
- **批准范围**（以 [契约 §6](./SDG-RE-契约.md) 为准）：
  1. 新增 `ProjectKind / StoryPremise / BriefStyle / BriefApprove / BriefChange / BriefMissingCode / BriefMissing / BriefPlan`；
  2. `ProjectBrief` 旧 6 字段整体替换为 v2（schemaVersion:2）；删除 `PreflightCheck`；
  3. `GateId` 由 `0-a/0-b/0-c/0-d/1-a/1-b/2-a/2-b/2-c` 改为 `0-final/1-a/1-b/2-a/2-b/2-c`；
  4. `RevisionSource` 删除 `0-c/0-d`（不新增 `0-final`，立项后变更解锁属 B-03/P1）；
  5. 删除旧消息门模型 `GateCard` 与 `ChatMessage.gate?`（生产零消费，门渲染走 CanvasGate）。
- **不在批准范围**：`CanvasGate.gateId` 保持动态 `string`（机制层零改动）；`StepId / Canvas / CanvasNode` 不动；`Stage` 保留仅供历史 manifest.nodes 骨架，待 B-04 清退。

### D-002 · 立项定案门唯一 id 拍板为 `0-final`（2026-10-13）

- **候选**：`0-final` / `0-gate` / `stage0-final`。选定 `0-final`：与既有 `1-a/2-a` 编号风格同族，`final` 明示「一道定案门、非逐产物审批」。
- **影响**：rejected 后同 id 重开（既有 bridge 语义），不做版本后缀。

### D-003 · 立项工具族与落盘边界拍板（2026-10-13）

- 新增三个零 LLM MCP 工具：`brief.plan`（只读校验）/ `brief.publish`（版本化落盘 + 画布节点）/ `brief.list`（历史版本）。
- 立项单落**项目根目录** `立项单.vN.json/.md`（对齐设计书 §7.1 L555），**不进** `版本/` 归档区、**不调** archiveExisting；版本号只由磁盘扫描分配（max+1），不信任何入参。
- publish **不**推进 manifest.status（B-04 排除）、**不**经 gateBridge（门由 Agent 用 gate.request 发起，publish 只落定案事实）。
- 画布 STAGE 0 唯一产物节点 `step-0-brief`，由 publish 内部 upsert，Agent 不手拼。
- 口头拍板与门内拍板的等价性由 Agent 携 `approve.verbal.quote` 落痕保证；平台不做 NLP（需求 §4.2）。

## 二、实施记录（过渡）

- 2026-10-13：任务包 5 文件建立（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录），需求与契约先行，代码随后按 T1→T8 落地。
- 2026-10-13：T1 shared/types.ts 落地；T2/T3 `electron/brief/`（diff/plan/render-md）落地，13 单测过；T4 三 MCP 工具落地（24 测试过）。
- 2026-10-13 T5 配套（围栏外最小必要改动）：[provider.ts](../../../electron/runtime/provider.ts) `SHOWRUNNER_DECLARED_TOOLS` 由 6 扩到 9，追加 `shortdrama_brief.plan/publish/list` 三个物理 ID——否则 showrunner 调立项工具会被 [client.ts](../../../electron/runtime/client.ts) 请求级白名单拦截。任务清单 §0 围栏列举时未含 runtime/，此处按「T4 工具必须对 showrunner 可达」的契约本意补登，不改判定函数签名、不扩 director 集合；runtime-client.test.ts 同步加一条放行用例（23 测试过）。
- 2026-10-13：T5 `showrunner.md` 重写——STAGE 0 收敛为「入口反问 → 诊断+六要素对话态 → 故事前提对话收敛（落 `故事背景档案.md`）→ 风格只引用 ID@版本 → brief.plan 自检 → 唯一门 0-final → publish」，口头拍板携 verbal.quote；第 1/2 步输入改 brief.list + file.read `立项单.vN.json`；旧 `立项/diagnosis.json`、`立项/视觉风格.json`、`立项/brief.json` 仅在禁令语境保留。frontmatter tools/permission 同步声明三工具。
- 2026-10-13：T6 渲染端适配落地——StudioViewer `BriefView` 按 v2 六段重写；CanvasBoard KIND_LABEL「创意简报→立项单」并补 STEP_LABEL `'7'`；StageNavPanel / ChatComposer / Stage0View 静态文案对齐；dev-mock-api 删除旧 gates 假数组、demo brief 换 v2（节点 ref 改 `立项单.v3.json`）。grep「创意简报」生产/渲染代码零残留。
- 2026-10-13：T7 测试同步闭环——`orchestration.test.ts` 全文重写为单门 0-final 编排契约（6 用例：未就绪零门/就绪唯一门 approved→brief.publish/口头拍板等价/多次 rejected 同 id 重开/不触媒体资产任务/pending 恢复续跑）；story/script-orchestration 的 STAGE 0 输入路径改 `立项单.v1.json`（1-a/1-b、2-a 用例不动）；studio-flow 门卡挂载两例 `0-a`→`0-final`（含 gate helper 重命名、卡文与两处 decide 断言）；canvas-board 已用新 id/「立项单」核对无需改（18 测过）。
  - 本包新引入并已修复的 3 处静态契约测试：① agent-profiles 的「frontmatter 无点号工具键」旧断言与契约 §3「物理 ID 保留点号」冲突，改写为白名单断言（仅 `shortdrama_brief.plan/publish/list`、仅 showrunner），showrunner 物理工具期望由 6 升 9；② runtime-integration `listAgents` 期望工具清单补三工具（真 opencode serve 端到端验证点号键被正确解析）；③ mcp-brief-tools 入参类型修复（BriefDraft 无索引签名，调用处改对象展开 `{ ...draft }`）。
  - **全量验证结论**：`npm run test:run` 222 passed / 1 skipped / 11 failed；11 个失败全部为 HEAD 基线既有——studio-flow.test.tsx 10 例与 architecture.test.tsx「无 comfyui 字样」1 例，经 `git stash -u` 基线对照复现确认非本包引入（故障单待后续包处理），本包改动未扩大失败面。`npx tsc -b tsconfig.node.json` + `npm run typecheck` 本包零错误，仅剩 7 条基线白名单（dev-mock-api L217 glob ×1、CanvasBoard L789 null ×2、VisualCatalog ×4）。全仓 grep 确认生产代码与提示词无旧门 id 与旧路径（仅禁令/历史文档语境保留）。
- 2026-10-13：T8 治理收尾——偏差清单 B-01/B-02 标 ✅（§1.2 工具数 11→14、5 族→6 族）；docs/features/README 登记 feature-001 已落地；本包闭环。

## 三、修订记录

### R-001 · brief.publish 与 manifest 推进的边界补注（2026-10-13，feature-801 联动）

- 原文口径：D-003「publish **不**推进 manifest.status（B-04 排除）」。
- [feature-801](../feature-801-manifest状态机推进/) 契约 §11 联动修订：**publish 工具自身仍不写 manifest（工具边界不变）**；立项首版定稿后的状态推进由 showrunner 在 publish 返回后**显式调用** `shortdrama_manifest.advance({ event: 'brief-published' })` 完成，且**仅当 `version === 1`**；再版（v2+，立项后变更，feature-002 范围）不推此事件。
- 同步修订：本包 D-001「不在批准范围」第 5 条所述「`Stage` 保留仅供历史 manifest.nodes 骨架，待 B-04 清退」已由 feature-801 执行完毕（K1：删 `Stage` 联合与 `StageCanvas.tsx`，manifest 改 7 态形状）。
- 交叉指针：[feature-801 契约 §11](../feature-801-manifest状态机推进/SDG-RE-契约.md)、[showrunner.md](../../../resources/opencode/agents/showrunner.md) 第 0 步第 8 条。

### R-002 · plan.ts「style 仅非空校验（B-05）」被 feature-802 注入式增补（2026-10-13，feature-802 联动）

- 原文口径：本包契约中 brief.plan 的 `style.mainStyleId` / `style.catalogVersion` 只做非空校验，B-05 遗留「风格 ID 是否在谱系内」无实现。
- [feature-802](../feature-802-视觉风格谱系接入/) 契约 §12 联动修订：`evaluateDraft(draft, catalog?)` 新增**可选第二参注入**，注入后返回对象追加 `styleIssues`（未知 ID / 版本不符 / 辅助越域三码），brief.plan/publish handler 成为唯一装载注入点。**纯函数默认行为（无注入 styleIssues=[]）、planBrief 签名与 BriefPlan/BriefMissingCode 形状逐字不变**，本包既有全部断言逐字未动——属行为增补而非契约破坏，不回改本包文档原句。
- 交叉指针：[feature-802 契约 §12](../feature-802-视觉风格谱系接入/SDG-RE-契约.md)、[偏差清单 B-05/B-11](../../设计现状与偏差清单.md)。

### R-003 · brief 工具族被 feature-002 扩展（2026-10-14，feature-002 联动）

- 原文口径：本包 D-003 立项工具族为 `brief.plan/publish/list` 三件，showrunner 物理 ID 白名单 9 个。
- [feature-002](../feature-002-立项后变更与影响评估/) 联动修订：新增 `shortdrama_brief.impact.assess` / `shortdrama_brief.impact.commit` 两工具（再版 diff + 影响评估 + 影响清单落盘），showrunner 白名单 9→17 物理名（全仓 22 工具）；`publish.ts` 在再版链路上增补 ENOENT 容错（读旧版缺失场景），publish 版本化双写、永不覆盖的工具边界逐字不变。
- 本包 D-001 批准范围第 1 条的 `ProjectBrief` v2 schema 未被修改；feature-002 的 K1 只新增 `ProjectManifest.briefVersion` 与 canvas 侧 `CanvasParentReference/CanvasDirty`，未动 Brief 类型。
- 交叉指针：[feature-002 变更记录](../feature-002-立项后变更与影响评估/SDG-AI-变更记录.md)、[偏差清单 B-03](../../设计现状与偏差清单.md)。

### R-004 · showrunner 职责纪律新增第 9 条「气泡标签前缀约定」（2026-10-17，B-34 联动）

- 原文口径：本包 T5 重写的 [showrunner.md](../../../resources/opencode/agents/showrunner.md)「职责与工作纪律」为 8 条，立项协议消息以纯文本发出，对话呈现无标签约定。
- 联动修订：用户对照原型指出立项对话气泡应有上沿浮动标签（[偏差清单 B-34](../../设计现状与偏差清单.md)），AskUserQuestion 拍板「前缀约定 + 渲染解析」——职责纪律新增第 9 条：发**立项协议性消息**时在消息最开头写 `【标签】`（2–8 字短词标明协议角色：`【AI 提取】`/`【AI 反问】`/`【AI 推断 · 待确认】`（含「待确认」渲染琥珀色）/`【AI 诊断】`/`【风格选型】`/`【故事前提】`/`【缺口追问】`/`【就绪 · 发卡】` 等）；渲染层剥离前缀，用户不见 `【】` 本体；仅消息最开头识别（≤16 字、不含换行），正文中途 `【】` 原样显示；非协议性消息（闲聊、阶段汇报、门后交接等）不加前缀；标签词汇开放但同角色用词前后一致；用户气泡系统固定落「用户」标签，Agent 无需处理。
- 边界注明：本改动为指令层呈现约定，不触及本包 D-001 批准范围与 D-003 工具边界，无 K1、无 runtime 协议改动；渲染实现（ChatComposer `parseChatLabel`/`LabelTag`/`ChatItem.label`）与测试属 renderer 展示层，循 B-18~B-33 先例不建包、登记 B-34。
- 交叉指针：[偏差清单 B-34](../../设计现状与偏差清单.md)、[版本记录](../../../版本记录.md) 2026-10-17 条目、[showrunner.md](../../../resources/opencode/agents/showrunner.md) 职责纪律 9。

### R-005 · showrunner 职责纪律新增第 10 条「选项呈现约定」（2026-10-17，B-35 联动）

- 原文口径：本包 T5 重写的 [showrunner.md](../../../resources/opencode/agents/showrunner.md) 立项/再版剧本中的二选一、风格选型、三选一等选择题，以纯文本编号列表（「请回复：1. … 2. …」）发出，用户只能手打编号回复，对话呈现无选项交互约定。
- 联动修订：用户真实应用截图指出选择交互未实现（[偏差清单 B-35](../../设计现状与偏差清单.md)），AskUserQuestion 两项拍板「现在直接做 + 含缩略图富选项」——职责纪律新增第 10 条：向用户发出**选项有限的封闭式提问**时，在消息**末尾**输出选项块，渲染层剥离为可点按钮（点击=代发编号，与手打同路径）：①普通选项用 `【选项】…【/选项】`，块内每行一条 `编号. 选项文字`（编号数字或单字母）；②风格选型用 `【风格选项】…【/风格选项】`，块内每行只写裸风格 ID（如 `1. A7`），系统按谱系渲染缩略图、名称、`ID @ 谱系版本` 与主·已验证/备·风险自担徽章，Agent 不自写名称徽章（防与谱系漂移）；③一条消息至多一个选项块且必须在末尾，正文不再重复列编号清单；④开放式提问（题材、故事前提等）不用选项块；⑤可与纪律 9 标签前缀同条并用（标签最开头、选项块最末尾）。三处剧本指针同步：立项剧本 step 2 入口反问（项目性质二选一）、step 5 风格选型（`【风格选项】` 裸 ID 列表）、再版剧本 step 5 用户三选一（`【选项】` 编号对应 ①②③）。
- 边界注明：本改动为指令层呈现约定，不触及本包 D-001 批准范围与 D-003 工具边界，无 K1、无 runtime 协议改动；渲染实现（ChatComposer `parseChatOptions`/`OptionCard`/`pickNumOf`、VisualCatalog 三处 export + `STYLE_CATALOG_VERSION` 单点版本号）与测试属 renderer 展示层，循 B-18~B-34 先例不建包、登记 B-35。
- 交叉指针：[偏差清单 B-35](../../设计现状与偏差清单.md)、[版本记录](../../../版本记录.md) 2026-10-17 条目、[showrunner.md](../../../resources/opencode/agents/showrunner.md) 职责纪律 10。

### R-006 · showrunner「候选态不落盘」铁律收窄——「已捕获口径」豁免落盘（2026-10-19，feature-005 / B-38 联动）

- 原文口径：本包 T5 重写的 [showrunner.md](../../../resources/opencode/agents/showrunner.md) 纪律 2 末句「立项对话中的候选态（诊断卡、六要素草案、故事前提、风格选型）只留在对话流，不落独立文件、不建产物节点」与第 0 步铁律「候选态不落盘、不建门、不建画布节点」——**口径类事实同样不落盘**，只存在于 Agent 会话内存，重开项目即丢失。
- 冲突与裁决：[feature-005](../feature-005-已捕获口径常驻区/) 冻结设计基线时发现 L2 三方冲突（设计书 §2.6.1「常驻区 + 随时可改 + 持续累积」隐含持久化 vs 本包铁律「不落盘」vs 原型 rightCapture 气泡融合形态），按治理 §8 呈报，用户拍板（2026-10-18）：**形态 = 常驻区全量对齐设计书**——候选口径落盘持久化（项目根 `已捕获口径.json` + 3 新 MCP 工具 + renderer 常驻条），**推翻本铁律中「口径」部分**，其余候选态（诊断卡、六要素草案、故事前提、风格选型）维持对话流不变。
- 联动修订（showrunner.md 六处）：① frontmatter tools + permission 各增 `shortdrama_capture.list/upsert/remove`（白名单 17→20 物理名，全仓工具 22→25，K8 归 feature-005 登记）；② 纪律 2 末句收窄——候选态只留对话流，**唯一例外是「已捕获口径」**即时经 `shortdrama_capture.upsert` 落盘；③ 新增纪律 11「口径落盘纪律」——提取即 upsert 不攒批、`source:'user'` 必带逐字 `quote`（工具强校）、`source:'infer'` 缺省待确认、topic 开放词表但同事实用词一致（推荐六要素 6 字段 + 前提 5 项词表）、不建门不建画布节点；④ 第 0 步铁律收窄为「除『已捕获口径』外，候选态不落盘、不建门、不建画布节点」（口径条目同样不建门不建节点，§2.6.8）；⑤ step 2「先记入对话中的『已捕获口径』」改为「立即经 `shortdrama_capture.upsert` 落盘」；⑥ step 6 就绪自检与 step 7 字段来源回溯增加「先 `capture.list` 对照口径文件」纪律（共同数据源语义，提示词层对齐，plan.ts/publish.ts 零 diff）。
- 边界注明：收窄仅限「口径」一类事实条目；诊断卡、风格选型等其余候选态不落盘铁律逐字保留，L99「诊断与草案只在对话中呈现」未动；`已捕获口径.json` 是过程态事实底座（覆盖式更新、不版本化），不是立项单版本化体系的产物，不挂画布节点、不进影响清单血缘。
- 交叉指针：[feature-005 需求规格 §3.4](../feature-005-已捕获口径常驻区/SDG-RE-需求规格.md)、[feature-005 变更记录](../feature-005-已捕获口径常驻区/SDG-AI-变更记录.md)、[偏差清单 B-38](../../设计现状与偏差清单.md)、[showrunner.md](../../../resources/opencode/agents/showrunner.md) 纪律 2/11 与第 0 步铁律。
