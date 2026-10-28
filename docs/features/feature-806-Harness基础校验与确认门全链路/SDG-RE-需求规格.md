# SDG-RE-需求规格 · feature-806 Harness 基础校验与确认门全链路

> **包号**：feature-806（8xx 跨阶段平台基础段）
> **业务名**：Harness 基础校验与确认门全链路——**批一：STAGE 0 harness 基础校验 + 0-final 门联动 + B-46 漂移提醒**
> **性质**：**K1 触发**（`shared/types.ts` `CanvasDirty` 拟增 `markedAt?: string` 可选时间戳字段，字段方案随包呈报、批准后动代码）；**K8 触发**（新增 `harness.validate` MCP 工具，27→28；showrunner 白名单 22→23）；**K9 零触发**（零新依赖）
> **事实源**：《短剧Agent平台设计.md》§9（Harness 质量层）、§11 一期·4（确认门全链路 + Harness 基础校验）、§2.6.7 L363-366（Harness 校验补充：影响清单留底 + 超 30 天漂移提醒不阻塞）
> **前置**：feature-001（0-final 单定案门）、feature-002（影响评估 + 三选一 + 脏读）、feature-801（manifest 状态机）、feature-807（门态防护 guard + brief.publish 写盘前拦截）、feature-010（GateHint 拍板提示）
> **溯源标签**：[Design 原有]（§9 Harness 质量层、确认门联动）+ [改编]（确定性校验工具化、按阶段分批落地）
> **偏差登记**：B-46（「仅标记脏」超 30 天漂移提醒缺失，本包实施收尾关闭）；真机两缺口处置见 §3.5
> **日期**：2026-10-27

## 1. 背景

设计书 §9 规划 Harness 质量层（知识库 / 结构·内容·规格·一致性多轮校验 / 确认门联动「校验全过才可确认、否决结构化回流」/ 质量视角 8 条），§11 一期·4 要求「确认门全链路（简报/定妆/分镜/成片）+ Harness 基础校验」。原 D-013 十五包规划列 804，2026-10-13 让位 Windows 标题栏缺陷包（B-10）顺延 806（决策台账 D-014）。2026-10-27 立项阶段遗留排查新检出 B-46，用户拍板归本包；同日批准启动建包，806 先于 803 建包的排期调整与分批策略见决策台账 D-019。

代码实证（2026-10-27 侦察）：

- **校验层零落地**：MCP 27 工具 10 族（file 3 / canvas 3 / gate 1 / asset 2 / comfyui 3 / brief 5 / manifest 2 / style 3 / capture 3 / web 2）**无 harness 族**（features/README §2）；0-final 发布前无系统校验，质量靠人工目验与 Agent 自律；
- **确认门现状 = 0-final 单门**：[bridge.ts](../../../electron/gate/bridge.ts) 三态 + [guard.ts](../../../electron/gate/guard.ts) 门态防护（807），门卡组件 [GateCardView.tsx](../../../src/studio/chat/GateCardView.tsx)；门序 1-a/1-b、2-a~2-c 及 3-7 门未扩；
- **B-46 数据面缺口**：[types.ts](../../../shared/types.ts) `CanvasDirty`（L358-364）仅 sinceBriefVersion / latestBriefVersion / fields / severity / impactReport 五字段、**无时间戳**，漂移天数无从计算；src 全仓「漂移」「30 天」零命中（B-46 已核）；
- **提醒入口已备**：脏读黄条（画布 / Stage0View / StudioViewer）与二次确认卡 [RealignConfirm.tsx](../../../src/studio/canvas/RealignConfirm.tsx)（007 落地），漂移提醒在此二处追加即可，零新 UI 面；
- **计数基线**：showrunner 白名单 22（writer 5 / media-director 9 / comfyui-operator 9 不动）；全量测试 61 文件 722 passed / 0 failed / 1 skipped；`npx tsc --noEmit` 恰 3 条历史基线。

**原则对齐（D-016 系统优先）**：四类基础校验规则、漂移天数推算均为规则可枚举的确定性操作——系统直做、零 LLM；`harness.validate` 工具化是为让 Agent 在确认门前主动查证与回流，不是把判定交给模型。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 0-final 定案门批准/发布 | 系统先跑 harness 基础校验；校验不过 → 不可确认、零写盘，结构化 findings 回流对话与门卡；全过 → 走既有 807 门态防护与发布路径 |
| R2 | showrunner | 提请 0-final 确认前 | 可调用 `harness.validate` 自查（白名单 +1），按返回的结构/内容/规格/一致性 findings 修复后再发卡 |
| R3 | 创作者 | 画布/查看器打开「仅标记脏」超 30 天未处理的产物 | 脏读黄条与二次确认卡追加「立项基线已漂移 N 天」提醒，**不阻塞**任何既有操作 |
| R4 | 创作者 | 存量 dirty 数据（无 markedAt） | 正常脏读不报错、不提醒（无法推算不臆造），其余脏机制行为不变 |
| R5 | 质量负责人 | 后续阶段扩门 | 批二起按阶段另批呈报（见 §3.1），批一不建 1-a/1-b、2-a~2-c 及 3-7 门 |

## 3. 核心机制

### 3.1 分批策略（README「可随阶段分批」的落地）

- **批一（本包批准范围）**：STAGE 0 harness 基础校验骨架（`electron/harness/`）+ 0-final 门联动 + B-46 漂移提醒 + capture 跨重启真机补验（§3.5）；
- **批二（另批呈报）**：STAGE 1-2 门序扩展（1-a/1-b、2-a/2-b；2-c 随 feature-201 分镜文字稿收尾），产物已落地、门有对象；
- **批三起（另批呈报）**：STAGE 3-7 门随 P3 各段产物包（301/302/401/501/601/602/701）与 803 媒体链节奏扩展；§9 知识库、质量视角 8 条、多轮深度校验同随后续批次，批一不做。

### 3.2 harness.validate 基础校验（批一仅 0-final）

主进程 `electron/harness/` 纯函数规则集，对当前立项单与门上下文执行四类确定性校验，返回结构化 findings（gateId / category / checkId / severity / message），零 LLM、零出网：

- **结构**：六要素、前提五键等必填键齐全；版本链完整（立项单版本 vs manifest.briefVersion）；
- **内容**：诊断摘要、核心事件等关键文本非空（只查空缺，不作主观质量判断）；
- **规格**：字段类型/枚举合规（platforms 来源枚举等）；styleRef 风格 ID 在谱系注册表内（复用 802 style.validate 既有能力，不另造）；
- **一致性**：门卡 payload 版本与当前立项单版本一致（衔接 807 版本绑定）；manifest 状态与发布动作匹配。

规则集为「基础校验」子集，checkId 枚举随契约冻结；后续批次只增规则不改框架。

### 3.3 0-final 门联动

循 807 既有模式：发布/批准写盘前调用同一校验函数——有 blocker 级 finding → 拒绝确认、零写盘、结构化 findings 回流（对话可经 `harness.validate` 复查；门卡经既有 gate 通道呈现校验摘要，若需 payload 字段扩展随 K8 一并登记，**零新 IPC**）。warning 级 finding 只提示不拦截；807 门态防护（pending/rejected 禁 verbal 绕过等）语义不变、校验是其前置增强而非替代。

### 3.4 B-46 漂移提醒（系统直做，不设独立 Agent 工具）

- `CanvasDirty` 增 `markedAt?: string`（ISO 时间戳，K1 可选字段、存量兼容）：「仅标记脏」动作（impact.commit 三选一 mark 路径等挂脏写盘点）写入；align 清脏随 dirty 清除；重复标记刷新；
- 漂移天数 = `now - markedAt` 整天数，**> 30 天**时脏读黄条与 RealignConfirm 追加「立项基线已漂移 N 天（不阻塞）」；无 markedAt → 不提醒不报错；
- 计算为 renderer 纯函数直算（数据随既有 canvas 通道已达），**不设 harness.drift 独立 MCP 工具**（提醒入口是黄条/确认卡系统直显，无 Agent 消费面，避免死面）；主进程如需同规则复用同一纯函数实现。

### 3.5 真机两缺口处置（2026-10-27 排查遗留）

- **web.search 成功路径**：本机 DuckDuckGo 不可达属环境限制、非代码缺陷，登记留痕；不列批一验收阻塞项，待出网环境可达时补验（不影响本包任何 AC）；
- **capture 跨重启持久化**：列入批一 T8 真机目验——capture.upsert 捕获事实 → 重启应用 → CaptureBar 条数与链态 x/6·x/5 进度保持，跨重启留证闭环。

## 4. 范围

### 4.1 做（批一）

1. `shared/types.ts` `CanvasDirty.markedAt?: string`（K1 批准后实施）+ 挂脏写盘点写入/清脏联动；
2. 新建 `electron/harness/` 校验模块（四类规则 + findings 结构 + 漂移天数纯函数同源）；
3. `electron/mcp/tools.ts` 注册 `harness.validate`（27→28）+ showrunner 白名单 22→23 与校验纪律提示词；
4. 0-final 门联动：写盘前校验、blocker 拦截零写盘、findings 结构化回流；GateCardView 校验摘要呈现（走既有 gate 通道）；
5. 漂移提醒：漂移天数纯函数 + 脏读黄条三处与 RealignConfirm 不阻塞提示；
6. 测试：harness 校验/门联动/漂移边界/提醒上屏单测 + 全量回归 + T8 真机目验（含 capture 跨重启）；
7. 治理收尾：变更记录 T/X 回填、README 与偏差清单 B-46 翻态、版本记录增行。

### 4.2 不做（显式排除）

- 1-a/1-b、2-a~2-c 及 3-7 门序扩展（批二起另批呈报）；§9 知识库、质量视角 8 条、多轮深度校验不做；
- 既有 27 个 MCP 工具实现零行为变化；writer / media-director / comfyui-operator 白名单不动；
- 不设 harness.drift 独立 MCP 工具（§3.4）；零新 IPC、零新推送、零新依赖；
- ComfyUI 媒体链（803）、影响评估面板全量 UI（002 既定排除）不翻案；
- web.search 成功路径不作为本包验收阻塞（§3.5 环境限制登记）。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | harness.validate：四类规则各命中/通过用例；findings 结构（gateId/category/checkId/severity/message）齐全；零 LLM 零出网；checkId 枚举与契约一致 | 单测 |
| AC2 | 0-final 门联动：blocker finding → 确认被拒且零写盘（循 807 断言模式）；全过 → 既有发布路径不变；warning 只提示不拦截；findings 回流可复查 | 单测 |
| AC3 | markedAt：仅标记脏写入、清脏清除、重复标记刷新、存量无 markedAt 数据读取不破坏；漂移天数 29/30/31 天边界正确（>30 才提醒） | 单测 |
| AC4 | 漂移提醒：脏读黄条与 RealignConfirm 超期显「立项基线已漂移 N 天（不阻塞）」；未超期/无 markedAt 不显；既有操作零阻断 | 组件单测 |
| AC5 | 工具面：MCP 注册 27→28、showrunner 白名单 22→23；其余工具与白名单零 diff；零新 IPC | 静态验证 + 单测 |
| AC6 | 回归红线：`npx tsc --noEmit` 恰 3 条历史基线零新增；全量以 T1 实测基线（61 文件 722 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、failed=0 | 全量回归 |
| AC7 | 真机（Electron 实机 + computer-use UIA/CDP）：①0-final 校验拦截与全过放行各走一遍；②沙箱项目构造 markedAt 旧时间戳 → 黄条/确认卡漂移提醒上屏且不阻塞；③capture 跨重启持久化补验（§3.5） | 真机 |
