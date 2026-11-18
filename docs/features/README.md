# docs/features — 现行任务包目录

> 每个任务包一个子目录：`feature-{三位数字}-{业务名}/`。标准档内含 5 文件（需求规格 / 契约 / 任务清单 / 设计说明 / 变更记录）；同时满足四项条件的小改动采用 3 文件精简档（需求规格含简化契约段 / 任务清单 / 变更记录），不得自创其他文件档。规范见 [AI-SDG-AI工具执行指令.md](../governance/AI-SDG-AI工具执行指令.md) §2。
>
> P0—P7 总体路线与当前阶段门见 [MiniMax Design全面复刻开发计划](../research/MiniMax%20Design全面复刻开发计划.md)；本索引只维护 Feature 路线、边界和落地状态，不复制总计划的阶段视图。

## 0. 划分规则（2026-10-13 起 · 按项目模块重新划分）

任务包**以《短剧Agent平台设计.md》§0.1 八步业务闭环为模块边界**，编号百位 = 业务阶段段；跨阶段的横切机制归入 8xx 平台基础段。每段保留 99 个序号（x01–x99）。业务可感知阶段产物必须齐备，禁止合并或裁剪步骤（原则三）；同一技术组件可被多阶段复用，但不据此分包。

| 段 | 模块（八步） | 阶段产物（§0.1） |
|---|---|---|
| **0xx** | STAGE 0 立项 | 选题诊断（含六要素草案）/ 故事前提 / 立项定案卡 |
| **1xx** | STAGE 1 故事 | 故事大纲 / 人物小传 |
| **2xx** | STAGE 2 剧本分场 | 分场表 / 台词 / 分镜文字稿 |
| **3xx** | STAGE 3 资产 | 角色 / 场景 / 道具资产（资产中心） |
| **4xx** | STAGE 4 分镜 | 生产分镜表（镜号 / 景别 / 运镜 / 资产引用） |
| **5xx** | STAGE 5 镜头 | 逐镜生成与收片 |
| **6xx** | STAGE 6 后期 | 配音 / 配乐 / 时间线 / 剪辑 / 混音 |
| **7xx** | STAGE 7 发布 | 成片 / 切片 / 渠道交付 |
| **8xx** | 跨阶段平台基础 | 状态机 / 风格谱系 / 统一媒体引擎 / Harness / Skill 等横切机制 |

> 溯源标签沿用设计书：**[Design 原有] / [改编] / [自研新增]**，各包在需求规格首页标注。

## 1. 任务包总表（按模块）

### 0xx · STAGE 0 立项

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| [feature-001-立项模型重建](./feature-001-立项模型重建/) | 单定案门 `0-final` + ProjectBrief v2 版本化落盘 + brief.plan/publish/list 三工具 + showrunner 第 0 步重写 | B-01 / B-02 | `electron/brief/*`、`electron/gate/bridge.ts`、`shared/types.ts`、showrunner.md | 自研新增 | ✅ 已落地（2026-10-13） |
| [feature-002-立项后变更与影响评估](./feature-002-立项后变更与影响评估/) | 全字段可改 + diff + 依赖图反向追溯 + `影响清单.vN-vM.json` + 三选一动作 + 脏读 + 历史回滚（§2.6.6/2.6.7） | B-03 | `manifest.briefVersion`、产物 `parentReference{briefVersion,fields[]}`、`CanvasNode.dirty`（**K1**：扩 `shared/types.ts`）、`brief.impact.assess/commit` + `canvas.align` 三工具（共 22 工具，**K8**）、CanvasBoard 脏读黄条/角标 + StageNavPanel STAGE 0 徽标 | 自研新增 | ✅ 已落地（2026-10-14） |
| [feature-003-立项视图接线](./feature-003-立项视图接线/) | STAGE 0 中栏静态原型壳（「安妮的夏天」假数据 + 演示控制条）替换为真实立项单只读视图；修复 StudioApp `n-brief` id 错配（真实节点 `step-0-brief`）；四态视图 + 门镜像条 + 脏读黄条 + 背景档案折叠 | B-16（盘点发现，本包登记并关闭） | `src/studio/Stage0View.tsx`（重写）、`StudioApp.tsx`（仅调用点）、`stage0/select.ts`（新纯函数）、`stage0-view.test.tsx`（26 例）；**纯 renderer，无 K1/K8/K9，shared/electron/preload/package 零 diff** | 改编 | ✅ 已落地（2026-10-15，真机目验 + 40 文件 431 passed） |
| [feature-004-立项单历史与回滚](./feature-004-立项单历史与回滚/) | 「查看历史」落地：历史版本列表（v1..vN 元数据）+ 左右两栏 diff 视图（选中版 vs 最新版，字段高亮 + 差异摘要）+ 任选历史版回滚（= 以 vK 内容发 v(N+1)，approve.by='ui' 记 note，全历史保留）；系统直做不经 AI（D-016） | B-37（盘点发现，本包登记并关闭） | `electron/brief/history.ts` / `rollback.ts`（新，复用 listBriefVersions/diffBrief/publishBriefFiles 零 diff）、**K8**：3 新 IPC（brief:history / version-read / rollback）、`BriefHistoryView.tsx`（新）+ StudioViewer 入口；K1/K9 零触发 | 自研新增 | ✅ 已落地（2026-10-18，真机目验 + 51 文件 564 passed） |
| [feature-005-已捕获口径常驻区](./feature-005-已捕获口径常驻区/) | 「已捕获口径」常驻区落地（§2.6.1/§2.6.8）：项目根 `已捕获口径.json` 落盘持久化 + 右栏对话区顶部常驻条（收起计数/展开条目/三色来源标签/行内编辑确认删除）+ 面板直改与对话纠正双通道同库同追溯（D-016）；推翻 showrunner「候选态不落盘」铁律中「口径」部分（收窄修订归 feature-001 R-006） | B-38（盘点发现，本包登记并关闭） | `electron/capture/store.ts`（新，唯一读写点）、**K1**：shared/types.ts 增 CaptureSource/CaptureStatus/CapturedFact/CaptureFile 4 类型、**K8**：MCP +3 工具（shortdrama_capture.list/upsert/remove，22→25）+ 3 IPC + capture:changed 推送、`src/studio/CaptureBar.tsx`（新）+ StudioApp 挂载、showrunner.md 收窄修订；K9 零触发 | Design 原有 | ✅ 已落地（2026-10-19，真机目验 + 53 文件 586 passed） |
| [feature-006-选题诊断公开数据检索](./feature-006-选题诊断公开数据检索/) | 选题诊断联网检索通道（§2.6.2「基于已捕获口径检索同赛道公开数据」）：T0 探测定案 B（opencode 内置 websearch 须外部 Key 弃用）→ 自建 `shortdrama_web.search/fetch`（DuckDuckGo html 端点零 Key）+ 检索词脱敏纪律（仅题材类型维度，禁 leads/coreEvent 原文）+ 诊断卡尾「检索来源」附录 + 纪念类默认不检索 + 失败诚实降级不编造 URL；纯 Agent 面 + 指令层，零 renderer/IPC | B-39（盘点缺口 #1，本包登记并关闭） | `electron/mcp/tools.ts` +2 工具（25→27，**K8**）、`electron/runtime/provider.ts` 白名单 +2、showrunner.md frontmatter +2 + step 3 四条规则（归 feature-001 R-007）、web-tools.test.ts 新增 14 例 + agent-profiles/runtime-client/runtime-integration 扩表；K1/K9 零触发 | Design 原有 | ✅ 已落地（2026-10-20，真机目验四道闸全验 + 54 文件 600 passed；DDG 本机不可达致检索成功路径真机不可验、由单测覆盖） |
| [feature-007-产物重开对齐二次确认](./feature-007-产物重开对齐二次确认/) | 打开 dirty 产物节点 →「是否按 v(N+1) 重新对齐」三选一确认（§2.6.6/§2.6.7）+ 只读查看器脏读黄条（含「一键对齐」再唤起同一确认）+ showrunner 单产物重对齐纪律小补（归 feature-001 R-008）；承接 feature-002 §4.2 留待通道包切片，影响评估面板全量 UI 不翻案 | B-42（盘点缺口 #3，本包登记并关闭） | `src/studio/RealignConfirm.tsx`（新，buildRealignPrompt 固定模板 + 三选一组件）+ StudioApp handleOpenNode 单点拦截（confirmNode state）+ StudioViewer 脏读黄条 + showrunner.md 脏读纪律第三条；重对齐经既有 handleSend→808 promptAsync 链路、清脏经 Agent 侧 002 既有 canvas.align；**K1/K8/K9 全零** | Design 原有 | ✅ 已落地（2026-10-21，dev-mock 真机目验四径全过 + 58 文件 662 passed） |
| [feature-008-立项过程链式呈现](./feature-008-立项过程链式呈现/) | 立项过程链式呈现（§2.6.8 线性收敛链）：STAGE 0 三布局 Header 后恒显顶部链态条「[① 选题诊断 x/6] → [② 故事前提 x/5] → [🚪 定案卡]」——词表精确匹配进度（中英文别名、同 canonical 去重、未命中计 unmatchedCount/totalFacts）+ 三节点状态徽标 + 🚪 状态镜像与点击展开只读摘要（批准/驳回仍单点右栏门卡）；纯订阅零写入，published 双卡主体零改动 | B-43（盘点缺口 #4，本包登记并关闭） | `src/studio/stage0/chain.ts`（新纯函数层：词表/进度/节点状态/payload 守卫）+ `src/studio/Stage0Chain.tsx`（新组件，useCaptureFacts 纯订阅）+ Stage0View 三布局挂载与顶距 38→84 + stage0-view.test.tsx installFileRead 叠加 +3 行（唯一既有测试 diff）+ stage0-chain.test.tsx（四组 27 例）；**K1/K8/K9 全零** | Design 原有·形态对齐 | ✅ 已落地（2026-10-21，dev-mock 真机目验进度联动 + 59 文件 689 passed） |
| [feature-009-前提卡分色与不可篡改水印](./feature-009-前提卡分色与不可篡改水印/) | 前提卡分色 + 不可篡改水印（§2.6.8 L379）：published 卡②故事前提五键按已捕获口径词表匹配逐键分色——人确认（confirmed）淡绿底 + 「不可篡改」绿徽标 / AI 拟稿（仅 infer+pending）淡琥珀底 + 「AI 拟稿」琥珀徽标 / 无记录中性零追加；背景档案折叠区标题行整体「不可篡改」徽标；纯订阅呈现零写入，卡①编辑态与 empty 三态零 diff | B-44（盘点缺口 #5，本包登记并关闭） | `src/studio/stage0/premise-facts.ts`（新纯函数层，复用 008 matchChainTopic 词表 + PREMISE_FIELDS）+ Stage0Chain.tsx 一词 export（useCaptureFacts）+ Stage0View PublishedBody 订阅与五键行分色/双徽标 + stage0-premise-facts.test.tsx（两组 15 例）；**K1/K8/K9 全零** | Design 原有·形态对齐 | ✅ 已落地（2026-10-21，dev-mock 零回归目验 + 60 文件 704 passed） |
| [feature-010-对话内缺口追问与拍板提示](./feature-010-对话内缺口追问与拍板提示/) | 对话内缺口追问快捷答复 chip（【追问选项】块协议 → ChipRow 横向胶囊：纯文本候选行 ≥2 条末尾块，picked 紫底白字不压暗 / consumed 置灰，点击代发原文与手打同路径）+ 发卡拍板提示 qh（`pendingGate.gateId==='0-final'` 系统直做自动追加 GateHint 琥珀条，合 D-016；文案 [改编] 自原型 → 纪律 8 真实口令「行，就按这版发布」） | B-45（盘点缺口 #7，本包登记并关闭；B-35 遗留切片，卡①折叠差异仅备案） | `src/studio/ChatComposer.tsx`（parseChatOptions 五处扩展 + ChipRow/GateHint 两组件四挂载点 + demo d9）+ showrunner.md 纪律 10 增补（纪律 9 词表零改）+ chat-chips.test.tsx（两组 17 例）；**K1/K8/K9 全零** | 改编 | ✅ 已落地（2026-10-23，dev-mock 目验上屏/代发/picked/disabled/hover 全过 + 61 文件 721 passed） |

| [feature-011-影响评估面板与批量重生成](./feature-011-影响评估面板与批量重生成/) | 影响评估完整面板（保存后自动弹出 + 按影响级别分组勾选 + 一键重生成选中 / 仅标记脏两个业务动作 + Esc / 显式关闭）+ 脏读黄条「查看影响评估」入口；关闭不撤销已落盘再版（D-024） | B-03 配套补全 | renderer 新增恰 3 文件 + 修改恰 4 既有文件（零新 IPC/工具/依赖，复用 007 重对齐链路） | Design 原有 | ✅ 已落地（2026-10-28；2026-11-02 按 D-024 修订关闭语义，面板聚焦测试 18/18 通过；面板弹窗真机目验待执行） |
| [feature-012-定案门信息完整性与门卡留存](./feature-012-定案门信息完整性与门卡留存/) | 再版定案门拍板前同列「相对上一版改动 + 影响产物清单」（修正先拍板后评估顺序倒置）+ approved 门卡 findings 真机留存挂载（含 806 拍板翻案呈报） | —（§2.6.5 补全） | showrunner.md 再版纪律改写 + GateCardView 影响清单区 + Stage0View 放行 approved（payload 增键不触 K1）+ bridge.ts 0-final 版本化重开（D-e E1） | Design 原有 | ✅ 已落地闭环（2026-10-31 真机全过：HOLD-01 approved 留存卡 + PK-012-01 未过门拒下游 + PK-012-02 真实 Agent 再版全链路 assess→门 v3 重开→批准→三选一→commit；全量 70 文件 825 passed） |
| [feature-013-立项视图直改与导航增强](./feature-013-立项视图直改与导航增强/) | 立项视图 L0/L1/L2 全字段直改 + L0 标签/备注入模型（K1 条件触发，推荐入立项单 v2）+ STAGE 0 左栏 hover 版本历史与 titlebar「vN · X 已对齐 · Y 待处理」tooltip | —（§2.6.6/2.6.8 补全） | Stage0View / StageNavPanel / StudioApp + brief:update 扩键（K8 呈报） | Design 原有 | ✅ 已落地（2026-10-28，决策 1=A/2=b/3=A/4=a/5=a；真机目验待执行） |
| [feature-014-AI服务配置管理](./feature-014-AI服务配置管理/) | 固定双服务商（火山方舟 / LM Studio，无服务商 CRUD）应用内可配；方舟文本三件套 + LM Studio Base URL/模型 ID（本机或局域网、无 Key）+ opencode 运行时三项；方舟 Key 经 safeStorage 加密落盘，双方配置独立保留，切换后手动重连生效；对话输入区可逐消息切换双方已配置模型并复用原会话 | —（D-021 + D-022 用户拍板） | `electron/settings/ai-service.ts` + ark.ts 动态化 + runtime provider/manager/client/main 贯通 + **K8**：恰 2 IPC（settings:ai:get/update）+ preload/global.d.ts/dev-mock 三端镜像 + `AiServicePanel.tsx` + StudioApp 系统菜单入口 + ChatComposer 对话模型选择器；K1/K9 零触发 | 自研新增 | ✅ 已落地（2026-10-31，75 文件 895 passed / 0 failed / 1 skipped；真实 Electron + 双服务逐消息切换推理与重启持久化待验收） |
| [feature-015-确认门非阻塞化与系统直做后置](./feature-015-确认门非阻塞化与系统直做后置/) | `gate.request` 落盘 pending 后立即返回，消除人工等待与 MCP 180 秒硬超时冲突；0-final 随门携带结构化草案，首版系统直发、再版保留三选一后 commit；1-a~2-b 由系统直推 manifest，保留 verbal 通道 | B-66 | `electron/gate/bridge.ts` + 新建 `execute.ts` + gate.request / gate:decide / 门卡 execution / showrunner 门纪律；**K8**：既有工具返回契约与 payload 增键；工具总数 29、无新 IPC、K1/K9 零触发 | 自研新增 | 🟡 已实施（2026-11-01，全量 78 文件 973 passed / 0 failed / 1 skipped；typecheck 恰 3 条历史基线；真机验收待执行） |

> 立项阶段跨包验收：[立项阶段整体真机测试用例](../立项阶段整体真机测试用例.md)（2026-10-28 建：E2E 主线 15 条 + 单包补验 7 条 + 环境受限/挂起项，用例矩阵与通过判据）。

### 1xx · STAGE 1 故事

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| [feature-101-故事创作链（大纲+人物小传）](./feature-101-故事创作链（大纲+人物小传）/) | 大纲定稿 + 人物小传定稿；`CharacterProfile.id` 主键诞生；JSON 源 + MD 镜像双写；只读已定稿立项单 | 三阶段血缘已落地、**缺任务包**（反向补录） | `故事/故事大纲.json/.md`、`故事/人物小传.json/.md`、writer.md、file 工具 | 改编 | ✅ 已反向补录（2026-10-15，基线 c1ee4e9） |

### 2xx · STAGE 2 剧本分场

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| [feature-201-剧本创作链（分场+台词+分镜文字稿）](./feature-201-剧本创作链（分场+台词+分镜文字稿）/) | 分场（`Scene.sceneNo` 主键诞生）/ 台词（speakerId 归角色、空镜 `''`+speakerName 兜底）/ 分镜文字稿（`dialogue=null`、`refs=[]`） | 2-a/2-b/2-c 三阶段血缘与任务包均已落地；分镜文字稿与 401 同一文件两阶段演进（§3 裁决①）；2-c 真机人工验收待做 | `剧本/分场.json/.md`、`剧本/台词.json/.md`、`分镜/shotlist.json/.md`、writer.md | 改编 | 🟡 已实施；2-c 真机人工验收待（2-c 于 2026-11-11 完成；聚焦 27 项与当次全量 1058 项通过，既有 3 条类型错误单列） |

### 3xx · STAGE 3 资产

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-301-资产中心与角色定妆 | 资产索引选定/沉淀（query/select/import/export 扩展）；角色卡 + 一致性配方（seed/参考图/提示词）；MiniMax H3 Image B0 概念图/定妆 | B-06（资产） | `electron/asset/*` 扩展、`资产/asset.index.json`、`资产/角色/`、media-director.md、comfyui.queue | 改编 | ⬜ 未建包（P3） |
| feature-302-场景与道具资产 | 场景图 / 道具图流水线；主风格一致性配方复用 | B-06（资产） | `资产/场景/`、`资产/道具/`、image.submit | 改编 | ⬜ 未建包（P3） |

### 4xx · STAGE 4 分镜

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-401-生产分镜表 | 分镜文字稿 → 可生产分镜：启用资产引用 `refs[]`、景别 / 运镜 / 逐镜时长 / 台词对位；在 201 的 shotlist.json 同文件升级（§3 裁决①） | B-06（分镜） | `分镜/shotlist.json` 升级、分镜表 UI、writer/media-director.md | 改编 | ⬜ 未建包（P3） |

### 5xx · STAGE 5 镜头

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-501-逐镜视频生成 | H3 工作流（B5 参考生视频 / B8 文生视频）；参考图编排、逐镜入队、多档位多版本 mp4、收片、断点续跑、单镜失败隔离；一致性 QC | B-06（镜头） | `镜头/<镜号>/`、video.submit、`electron/comfy/*`（依赖 803 引擎）、镜头 Agent | 改编 | ⬜ 未建包（P3） |

### 6xx · STAGE 6 后期

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-601-声音通道（配音+配乐） | 语音通道待定；裁决前仅管理待配文本、任务与既有素材，可维护待配 / 已配清单，不绑定豆包 / T2A 或其他候选；Music3 B9 配乐 / 音效另包接入 | B-06（后期·声音） | `声音/`、音乐任务工具、声音 Agent；具体接口待各 Feature 契约裁决 | 自研新增 | ⬜ 未建包（P4；语音须先作产品 / 通道裁决） |
| feature-602-时间线与程序化剪辑 | timeline.json（采用版本 / 切点 / 字幕 / 音量 / 过渡）；edit.cut/subtitle/concat/mix/slice（MediaKit/FFmpeg）；引擎不剪辑红线 | B-06（后期·剪辑） | `时间线/timeline.json`、edit.* 工具、剪辑 Agent | 改编 | ⬜ 未建包（P4） |

### 7xx · STAGE 7 发布

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-701-成片交付与切片 | 成片 / 封面 / 切片导出；渠道规格校验；成片确认门。渠道在线分发另列 P6 候选，须单独裁决 | B-06（发布） | `成片/`、导出 UI、harness 渠道规格校验 | 改编 | ⬜ 未建包（P4） |

### 8xx · 跨阶段平台基础

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| [feature-801-manifest状态机推进](./feature-801-manifest状态机推进/) | 7 态 `initiating→story-outline→story-profiles→script-scenes→script-dialogue→script-storyboard→storyboard-done`，每次定稿读-改-写推进一格；先覆盖 STAGE 0-2，3-7 随各段包扩展；清退历史 10 态 `Stage` 骨架 | B-04 | `electron/project/manifest.ts`（读-改-写 + 纯函数跃迁）、manifest.get/advance 两工具（**共 16 工具**）、`electron/project/library.ts`、showrunner.md 定稿动作（**K1**：`shared/types.ts`）、删 `StageCanvas.tsx` | 自研新增 | ✅ 已落地（2026-10-13） |
| [feature-802-视觉风格谱系接入](./feature-802-视觉风格谱系接入/) | 系统级外部数据源接入：路径注册 / 版本跟踪 / 风格 ID+谱系版本引用 / 主辅选型；平台只消费不私改（§8.3，§3 裁决②重建） | B-05 | ✅ 已落地（2026-10-13）：`electron/style/` 五文件（types/catalog/parse-md/loader/validate）+ `style.catalog/get/validate` 三工具（共 19 工具）；代码内 18 ID 注册表与谱系 md v1.46 运行时交叉核对，版本号不硬编码；根设计 §7.1/§8.3 已同步终局口径，B-05 已闭环 | 自研新增 | ✅ 已落地（2026-10-13） |
| [feature-803-ComfyUI统一媒体引擎](./feature-803-ComfyUI统一媒体引擎/) | 已落地应用级多实例设置、真实 HTTP 客户端、受控 API Format 映射、持久作业与安全收片入库；地址可配置 + 局域网多实例；媒体零公网；renderer 不直连。历史 Qwen 生产事实冻结，现行通道以 feature-816 / D-033 的 H3 Image 为准 | B-06 前置（现行 P2） | **K1/K9 零触发**；**K8 已批**：`settings:comfy:test`、queue/status 收紧、实例项目级迁应用级；`electron/comfy/*`、设置面板页签、preload/global.d.ts/dev-mock | 改编 | 🟡 原范围已实施；历史 Qwen 真机链已通，现行 H3 真机验收见 feature-816。三端口 H3 直连 API 串行落卡已验（[证据](../verification/gpu-placement-2026-11-15/validation.json)）；资产中心 UI、应用内第二实例选择与禁用行为仍待验收，OS 级 GPU UUID / `nvidia-smi` 与三路并发未验 |
| [feature-804-Windows窗口标题栏](./feature-804-Windows窗口标题栏/) | 修复 `hiddenInset` 在 Windows 无窗口控制缺陷：外壳平台分支（darwin hiddenInset / win32·linux frame:false）+ 顶栏右侧自绘最小化/最大化·还原/关闭三按钮（46×32、关闭红 #C42B1C）+ 4 IPC 1 推送；macOS 零变化 | B-10 | `electron/window/chrome.ts`（纯函数）、`electron/main.ts`（window:* IPC）、preload/global.d.ts/dev-mock 三处同步、`src/studio/WindowControls.tsx`、StudioApp 顶栏集成（**K8**：新增 IPC 登记；无 K1） | 改编 | ✅ 已落地（2026-10-29 Windows 真机人工验收通过；macOS 零变化回归本机无 macOS 维持挂起） |
| feature-805-Skill体系 | Skill 检索 / 执行 / 沉淀；在线投稿、公开模板市场另列待决，不以本地文件模拟在线成功 | §6 / §11 P5；在线能力见 Parity 矩阵 §3 | skill.* 工具；具体接口待建包裁决 | Design 原有 | ⬜ P5 候选（逐包裁决后建包） |
| [feature-806-Harness基础校验与确认门全链路](./feature-806-Harness基础校验与确认门全链路/) | 结构 / 内容 / 规格 / 一致性多轮校验；简报 / 定妆 / 分镜 / 整集 / 成片确认门卡片；校验不过不可确认（原 D-013 十五包方案的 804，因真机缺陷让位顺延 806，见决策台账 D-014） | B-06 配套（§9 / 现行 P1）+ B-46 | harness.* 工具、`gate/bridge.ts` 门序扩展（1-a/1-b、2-a~2-c 及 3-7 门）、GateCardView | Design 原有 + 改编 | ✅ 批一已落地（2026-10-28：STAGE 0 harness 基础校验 + 0-final 门联动 + B-46 漂移提醒；T1-T9 全绿，真机目验双腿实证；分批与排期见 D-019） |
| [feature-807-确认门口头拍板约束与门态防护](./feature-807-确认门口头拍板约束与门态防护/) | 修复 STAGE 0 真机走查缺陷：门 pending/rejected 时禁止 verbal 绕过发布（brief.publish 写盘前门态校验 + 版本绑定）；口头拍板两前提；gate 超时只许同 gateId 重挂、禁止回溯旧话；门卡字段来源回溯（platforms 不得凭空扩写） | B-14 / B-15 | `electron/gate/guard.ts`（新纯函数）、tools.ts brief.publish 拒绝分支（工具总数仍 22）、showrunner.md L80/91/100/103/115（**无 K1、无新工具**） | 自研新增 | ✅ 已落地（2026-10-15，T6 真机回归已通过） |
| [feature-808-会话续聊（项目会话绑定与历史回放）](./feature-808-会话续聊（项目会话绑定与历史回放）/) | 与 MiniMax Design 对齐「项目即会话入口」：一项目绑定一条活跃 opencode 会话；重开项目自动回放历史气泡并可续聊；他会话事件过滤、404 自愈清绑定；惰性建会话（首条 prompt 才 createSession 并回写）；停止只 abort 不本地复位 | 设计书 §7.1 修订 R-001（chat.messages.json 终态作废） | 四层：**K1** `shared/types.ts`（ProjectSession.activeSessionId 单字段）+ **K8** 恰 2 新 IPC（`project:active-session` 双态 / `runtime:session:messages`）+ DTO 两端镜像、`electron/project/library.ts` 绑定读写、`electron/runtime/client.ts` getSessionMessages/toMessageRecord、preload/global.d.ts、`src/lib/history-replay.ts`（新纯函数 H1–H8）、StudioApp/ChatComposer/dev-mock；**K9 不触发**（零新依赖，SDK 1.18.34 已含 session.messages）；消息历史全部留 opencode 原生存储 | 改编（Design 形态对齐） | ✅ 已落地闭环（2026-10-15 自动化；2026-10-16 真机目验项 4/5 暴露 D-006/D-007，经批复方案 A 修复后自动化 44 文件 462 passed、真机复测 5/5 全通过、AC1–AC10 10/10 闭环，详见包内变更记录） |
| [feature-809-对话流式活跃指示](./feature-809-对话流式活跃指示/) | 流式回合活跃指示：首事件前占位气泡（TypingDots）+ 行尾闪烁光标（激活既有 `cursor-blink` token）+ 行内工具状态行（spinner / ✓耗时 / ✗错误）+ 空态提示联动；核心原则「活跃不变式：running 全程 ≥1 个动画元素，与 token 到达频率解耦」 | —（体验缺口，用户反馈直建包；无对应 B 条目） | `src/studio/ChatComposer.tsx`（AgentTurn 改造 + TypingDots/ToolRow/toolDurationLabel/showStreamCursor）、`chat-liveness.test.tsx`（新增）；**纯 renderer，K1/K8/K9 零触发**（chat-runtime / StudioApp / tailwind.config / shared 零 diff） | Design 原有·形态对齐 | ✅ 已落地闭环（2026-10-17，单测 22 例 / 全量 49 文件 550 passed / 真机目验 gapPolls=0·polls=1122；X-001 契约 A4 修订经用户裁决，详见包内变更记录） |
| [feature-810-谱系升级差异工作流](./feature-810-谱系升级差异工作流/) | 谱系升级差异工作流（§2.6.4/§8.3「谱系升级后提示差异，由人决定是否采纳」）：主进程差异检测（版本比对 + 引用条目现况 + 谱系 md 新增 J.3 变更记录段解析）+ VisualCatalog 演示面板（B-35 硬编码假数据）替换为真实数据驱动 + 采纳仅升版本号（系统直写恒 mark）/忽略不持久化；TABS/卡片全量真实化排除（B-41 另立包） | B-40（盘点缺口 #2，本包登记并关闭） | `electron/style/upgrade.ts`（新）、**K8**：+2 IPC（style:catalog / style:upgrade-diff）+ `brief:update` style 白名单 +1 键 catalogVersion、VisualCatalog 真实化、谱系 md J.3 空段骨架；K1/K9 零触发 | Design 原有 | ✅ 已落地（2026-10-20，真机目验七步全过 + 56 文件 638 passed） |
| [feature-811-谱系面板全量真实化](./feature-811-谱系面板全量真实化/) | B-41 收尾：VisualCatalog TABS 六家族计数与 18 条目卡片数据驱动（消费 style:catalog entries，STYLES 硬编码表退役）+ 对话内风格选项卡版本号真实化（`STYLE_CATALOG_VERSION` 常量退役）；新建 renderer 单点 store 缓存（懒加载单 flight / 同步查询保纯函数语义 / jsdom 降级不抛）；弹层 anchorWords·textureRecipe 原文上屏 | B-41（本包登记并关闭） | `src/studio/style-catalog-store.ts`（新）+ VisualCatalog/ChatComposer/Stage0View/StudioViewer 四组件切换 + dev-mock 自具演示表；**K1/K8/K9 全零触发**（style:catalog 纯消费 810 既有通道，主进程/preload/shared/global.d.ts/StudioApp 全零 diff） | Design 原有·形态对齐 | ✅ 已落地（2026-10-20，57 文件 648 passed + 真机目验面板双向同步 / 选项卡三点闭环） |
| [feature-812-未选项目空态与首启引导](./feature-812-未选项目空态与首启引导/) | 无项目态从「残缺的工作台」收敛为明确入口：中栏 `WelcomeView`（新建 + 最近 5 个项目）+ 右栏锁定输入并说明原因（模型选择器仍可用）+ 顶栏标题「未打开项目」与八步全 idle + 底栏不渲染 + `handleSend` 无项目守卫；堵住「无项目仍可发送」导致的孤儿 opencode 会话与空跑 token | 本包建包（无既有 B 编号）；顺带登记 B-67 / B-68 另立包 | `src/studio/shell/WelcomeView.tsx`（新）、`StudioApp.tsx`（`canvasLoaded` + `hasProject` 判定 / 中栏三分支 / 顶栏两处 / 底栏条件 / 发送守卫 / `lockedReason` 传值）、`ChatComposer.tsx`（`lockedReason` 六点）、`ProjectNav.tsx`（`relativeTime` 导出）；**K1/K8/K9 全零触发**（零新 IPC / 类型 / 依赖，electron 零 diff） | 自研新增 | ✅ 已落地（2026-11-02，见包内变更记录） |
| [feature-813-工作目录更换](./feature-813-工作目录更换/) | 工作区根目录可更换（单一全局根，默认 `~/Documents/ai-shortdrama-studio`）：设置面板「工作目录」入口 → 目录选择器 → 确认；旧根 `project-*` 整体搬移、失败回滚零半搬态；session-state 同步重映射；系统直做（D-016），跨盘（EXDEV）不支持 | 本包建包（用户 2026-11-03 三项范围裁决） | `electron/settings/workspace.ts`（新 store + changeDir 十步流程）、`library.ts` / `main.ts` 两处硬编码接线（resolveWorkspaceRoot）、**K8 已批**：+3 IPC（settings:workspace:get/pick/change）、`WorkspacePanel.tsx`（新）+ StudioApp 菜单项、preload / global.d.ts / dev-mock 三处同步；**K1/K9 零触发**（DTO 镜像 global.d.ts，零新依赖） | 自研新增 | ✅ 已落地（2026-11-03：T1–T7 全绿，全量 82 文件 1029 passed / 1 skipped，详见包内变更记录） |
| [feature-814-画布命令底座与资产关联](./feature-814-画布命令底座与资产关联/) | Canvas v3 单调 revision + 有界命令回执 + 原子 JSON/坏档保护；节点与四类资产系统直改绑定/解绑，资产完整记录任务及会话来源 | MiniMax 调研最小吸收（本包建包） | **K1 已批**：`shared/types.ts`；**K8 已批**：恰 1 个 `canvas:command` + MCP DTO 扩展 + preload/global.d.ts/dev-mock 三端镜像；CanvasStore 统一命令事务、AssetsPanel 多选交互、冲突刷新；**K9 零触发**（零新依赖，工具总数仍 29） | 自研新增 | ✅ 已落地（2026-11-10：全量 83 文件 1054 passed / 1 skipped；typecheck 仅余包前三条基线；Electron/Vite 构建通过） |
| [feature-815-风格预览媒体元数据](./feature-815-风格预览媒体元数据/) | 风格详情固定 PNG 与当前档 MP4 同屏；三档仅切视频；从各文件内嵌 ComfyUI graph 展示真实提示词 / 参数，支持复制与独立降级 | 用户双媒体反馈（本包建包） | 主进程有限 PNG / MP4 解析 + 路径安全；**K8 已批**恰 1 个 `style:preview-metadata`；VisualCatalog 分源异步展示；**K1/K9 零触发** | 自研新增 | ✅ 已落地（2026-11-14：真实 Electron AC-1~AC-7 通过；专项 155/155、元数据 16/16、组件 28/28；全量仍有非本包 10 项 profile 基线失败） |
| [feature-816-H3图像通道迁移](./feature-816-H3图像通道迁移/) | 参考方案与现有文生图生产链迁移 MiniMax H3 Image；Qwen 专用能力停用；C1 删除 27 份 Qwen 参考件并重排，后续再删除 8 份 P-H3 / FastH3/FastVideo / Pika H3 参考件；C2 原样登记用户新增的 1 份 H3 API 文生图参考件，现为 20 份 H3/Music3 文件（10 UI + 10 API、7 用途域）；C3 删除唯一 Qwen 生产归档及空 `_archive` | D-033（K7，本包建包） | 生产阶段独占 workflow loader、生产 manifest/graph、Comfy 工作流测试与 operator 参数说明；K2/K3/K8 已批，K1/K9 零触发；不改 feature-803/815 历史。C1/C2 写权仅及参考目录、双总览与治理当前状态；C3 仅及精确生产归档、空目录、双总览与治理当前状态，均不重开生产 loader / manifest / graph | 改编 | ✅ 全部闭环：H3 LAN 真机出图、收片、资产登记与幂等通过；C3 文件进入系统回收站，空目录移除，20/20 参考 JSON 与保护边界哈希一致，专项 109/109 通过；AC1—AC23 已封闭，全量既有失败与 3 条类型错误单列 |
| [feature-817-全局双主题与对话形态对齐](./feature-817-全局双主题与对话形态对齐/) | 全局浅色/深色主题 + MiniMax 真实任务详情与分步选项卡 | 用户 2026-11-15 拍板真实形态对齐与全局双主题 | 零 shared/IPC/依赖；OptionCard 发送契约由 feature-010 C1 移交 | 改编 | 🟡 实现已落地、验收中：本包历史对话 18 项与主题 3 项通过，P0 复跑为对话 12 项、主题 3 项通过；Electron 浅色 / 深色 / 最大化截图存在；真实 AI runtime 已由 819 恢复连接，输入、OptionCard、真实任务详情与 Gate 现场验收仍待补 |
| [feature-818-Renderer基线类型修复](./feature-818-Renderer基线类型修复/) | 修复 P0 基线 3 条 Renderer 构建类型错误 | 用户 2026-11-15 明确要求修复 | 仅两份测试文件；K1/K8/K9 零触发，产品代码零改动 | 自研新增·测试基线 | ✅ 已闭环：相关测试 29/29、typecheck 与完整 `build:renderer` 通过；仅保留既有 chunk 大小警告，P0 历史报告与原始日志不改写 |
| [feature-819-Agent运行时模板解析修复](./feature-819-Agent运行时模板解析修复/) | 开发态 agent 模板被误判为打包态，读取 Electron 包内旧副本导致真实 AI 运行时启动失败（缺 `__MODEL_REF__`） | P1 准入调查发现（[P1 调查记录](../verification/p1-2026-11-15/P1调查记录.md) §3-⑤） | `electron/runtime/provider.ts` 判据改 `app.isPackaged && !process.defaultApp` + 1 条回归用例；K1/K8/K9 零触发 | 自研新增·运行时基线 | ✅ 已闭环：`runtime-provider` 19/19、typecheck exit 0；真实 Electron `healthy:true`、showrunner 23 工具、27 会话恢复；真实对话往返已于 feature-820 专项验收（见 P1 调查记录补记二） |
| [feature-820-一级入口与伪造状态收口](./feature-820-一级入口与伪造状态收口/) | P1 切片 B：底栏硬编码假状态（火山方舟/三端口/镜头批量/Harness 30 项/自动保存）改为真实数据源，Skill 死按钮与插件假开关收口，补「本地模型」未开放入口 | [P1 调查记录](../verification/p1-2026-11-15/P1调查记录.md) §3-⑧⑨ | 仅消费既有 `settings.ai.get` / `runtime.status` / `settings.comfy.list`；4 个代码文件（含 C7 豁免的 `AiServicePanel` 纯函数）；K1/K8/K9 全零触发 | 自研新增 | ✅ 已闭环（2026-11-16）：`architecture` + 专项 29/29、shell 套件全绿、typecheck exit 0；真实 Electron CDP 取证底栏与配置源一致、虚构文案 0 命中，Skill 筛选/插件未开放/本地模型入口均实测，真实对话往返（SSE + 停止钮）通过；全量失败 12 文件均为既有谱系 v1.46/1.47 与 CRLF 基线 |
| [feature-821-资产上传与真实缩略图](./feature-821-资产上传与真实缩略图/) | P1 切片 C：单张 PNG/JPEG/WebP 系统直传、项目内安全落盘与索引登记、上传及旧 ComfyUI 图片真实 WebP 缩略图 | [P1 调查记录](../verification/p1-2026-11-15/P1调查记录.md) §3-⑥ / §8 | **K8 已批**：恰 2 IPC（`asset:import` / `asset:thumbnail`）+ main/preload/global.d.ts/dev-mock；复用 `registerAsset` 与已有 sharp，派生缩略图路径，K1/K9 零触发 | Design 原有·形态对齐 / 自研新增实现 | ✅ 已闭环（2026-11-16）：专项、typecheck 与构建通过；真实 Electron 三种格式原生上传、取消/坏图、项目隔离及重开 WebP 恢复通过；全量既有 12 文件失败单列，不代表 D/E 或 P1 通过 |
| [feature-822-对话侧资产引用](./feature-822-对话侧资产引用/) | P1 切片 D：当前项目资产选择、正文结构化 chip、main 项目/沙箱复核、opencode 原生 file parts 与安全历史回放 | [P1 调查记录](../verification/p1-2026-11-15/P1调查记录.md) §3-⑦ / §9；Parity 影响矩阵 §2.2 / §2.3 | **最小 K8 已批**：仅扩 `runtime:prompt` / `runtime:session:messages` DTO，0 新 IPC；main/preload/global.d.ts/dev-mock 同步；K1/K9 零触发 | Design 原有·形态对齐 / 自研新增实现 | **已闭环（2026-11-17）**：T1—T8 完成；专项 122 项、真实 opencode 8 项及真实 Electron 原生文件 parts / 完整重启 chip 回放通过；不代表切片 E 或 P1 通过 |
| [feature-823-多创作页与自由画布持久化](./feature-823-多创作页与自由画布持久化/) | P1 切片 E：Canvas v4 多创作页、页内多画布、自由坐标、逐画布 viewport、活动页/画布/视图完整重启恢复；页/画布 CRUD 与项目隔离 | [P1 调查记录](../verification/p1-2026-11-15/P1调查记录.md) §3-③④ / §11；Parity 影响矩阵 §1.4 / §2.1 | **K1/K8 已批**：`shared/types.ts` Canvas v4、`electron/canvas/*`、恰一个 `canvas:view-state` IPC、main/preload/dev-mock/MCP 与 CanvasBoard/StudioApp；K9 零触发 | Design 原有·形态对齐 / 自研新增实现 | **已闭环（2026-11-17）**：专项、构建及真实 Electron 两次完整重启恢复通过；B-70 75 项未修复，不代表 P1 或完整 Parity 通过 |
| [feature-824-项目库真机补验](./feature-824-项目库真机补验/) | P1 切片 F：真实 Electron 验收项目改名、删除保护、macOS 废纸篓删除与 Finder 恢复，以及异常 manifest/session/目录/权限/canvas 容错 | 登记 F824-01 / B-71；[P1 调查记录](../verification/p1-2026-11-15/P1调查记录.md) §12 | 验收专用：复用既有 project/canvas API，真实 UI + CDP + Finder 取证；产品代码、shared、IPC/preload/dev-mock/MCP、依赖与生产资源零改动，K1/K8/K9 零触发 | 自研新增·既有能力真机补验 | **矩阵执行完成，验收整体不通过（2026-11-17）**：AC-F1—F9 通过；AC-F10 检出坏 canvas 导致主进程与 Renderer 项目状态分裂，F824-01 / B-71 已由 feature-825 修复并闭环；本包历史结论不改写，不代表 P1 或完整 Parity 通过 |
| [feature-825-坏画布打开事务修复](./feature-825-坏画布打开事务修复/) | F824-01 / B-71：目标 canvas 损坏时，打开失败不得提前切换 currentDir、清理原项目门或造成 Renderer/主进程项目分裂 | feature-824 AC-F10；[P1 调查记录](../verification/p1-2026-11-15/P1调查记录.md) §13 | `CanvasStore` 显式根目录只读预检 + `openProject` 写队列内提交前 guard + `project:open` 接入；外部 IPC/DTO 不变，K1/K8/K9 零触发 | 自研新增·缺陷修复 | **已闭环（2026-11-18）**：定向 42 项、typecheck、build 通过；真实 Electron 坏 G 保持 A、零目标广播、坏档哈希/session 不变，正常 B 与异常路径通过；B-70 仍 75 项失败，不代表 P1 或完整 Parity 通过 |

## 2. 已落地平台基础（暂无任务包 · 反向补录可选）

下列骨架已随重建落地、当前无任务包，**不占用业务编号**；如后续需要规格留痕，按《指令》§7 反向补录建包（建议归入 8xx），不在近期路线内：

- **对话生成网关 runtime 单轨**（`electron/runtime/*`，14 错误码，无 Key 报 `UPSTREAM_AUTH_MISSING`）— §5.1
- **MCP 纯工具族**（`electron/mcp/*`：canvas / file / asset / comfyui / gate / brief（含 impact）/ manifest / style / capture / web / harness，当前实测 11 族共 29 个；随各 Feature 演进，实时数量以 `tools.ts` 注册点为准）— §5.2
- **持久化与版本归档**（`electron/fs/*`：sandbox 白名单 / write-queue / archive 版本归档）、**项目库**（`electron/project/*`，含 manifest 7 态状态机，见 feature-801）
- **画布**（`electron/canvas/*`：canvas.json 节点模型）、**确认门桥**（`gate/bridge.ts` 三态）
- **Agent profiles**（`resources/opencode/agents/`：showrunner 唯一 primary / writer / media-director / comfyui-operator，共 4 个；director 已退役）

## 3. 建包前裁决（已于 2026-10-13 拍板，见决策台账 D-013）

1. **STAGE 2 分镜文字稿 ↔ STAGE 4 生产分镜表 = 同一文件两阶段演进**：201 产出 `分镜/shotlist.json` 文字稿（2-c 文字稿阶段空镜 `dialogue=null`、`refs=[]`，不排镜）；401 在同一文件上启用 `refs[]` / 景别 / 运镜 / 时长，升级为生产分镜。不设两个产物文件。
2. **B-05 取重建方案（终局口径）**：feature-802 已落地 `electron/style/` 五文件模块；代码内 ID 注册表与 `resources/H3-Style/` 谱系 md 运行时交叉核对，版本号从 md 解析、不硬编码，平台只消费不私改谱系（D-005 第 6 条；包级 D-001/D-002 已批准）。[根设计](../../短剧Agent平台设计.md) §7.1/§8.3 已同步该终局口径。
3. **K1 共享层扩展已知情**：002 与 801 改 `shared/types.ts`（`manifest.briefVersion` / 产物 `parentReference` / `CanvasNode.dirty` / 7 态 status、清退历史 `Stage` 10 态），各包建包时正式走 K1——先出字段方案、用户确认后记包内变更记录，再动代码。

## 4. 现行建设顺序（承接根设计 §11 P0—P7 / D-034）

- **P0 基线收口**：D-034、Parity 影响矩阵、现有任务包校准、测试 / 构建 / 环境基线已登记；在线服务与 P6 产品域只形成待决清单，不代替用户拍板。
- **P1 桌面工作台**：002 / 101 / 201 / 801 / 802 / 806 等已有基础，继续完成项目、会话、画布、确认门、diff、对话、双主题、设置与恢复的真机及 Parity 验收。201 的 2-c 已实施但真机人工验收待做；817 实现已落地，真实任务详情与 OptionCard 现场验收待补。P1 切片 A/B/C/D/E 已分别闭环：819 解除运行时阻塞，820 收口伪造状态并验收真实对话往返，821 闭环资产上传与真实缩略图，822 闭环对话侧资产引用，823 闭环多创作页 / 多画布 / 自由坐标 / 视口持久化及完整重启恢复。切片 F / 824 已执行完整项目库真机矩阵，AC-F1—F9 通过，AC-F10 检出 F824-01 / B-71，验收整体不通过且待另包授权修复。B-70、B-71 与其余 P1 缺口未因此关闭，不宣称整阶段通过。
- **P2 统一媒体引擎**：803 继续收口资产中心 UI、应用内第二实例与禁用行为；816 的 H3 Image 文生图链已验收。三端口 H3 任务已完成 API 级串行落卡验证，启动参数声明映射为 8000→0、8001→1、8002→2；仍须主机侧 `nvidia-smi` / GPU UUID、应用内多实例行为与三路并发验收。804 窗口标题栏为既有基础，macOS 零变化回归仍是独立缺陷。
- **P3 视觉生产链**：301 角色 → 302 场景道具 → 401 生产分镜 → 501 逐镜视频；逐包落实 H3 Image / H3、资产引用、按镜实引门与显式 continuation，不把参考工作流当作生产能力。
- **P4 后期与发布**：601 声音 → 602 时间线剪辑 → 701 成片交付；语音通道须先单独裁决，未裁决前只管理待配文本、任务与既有素材。
- **P5 / P6 Agent 生态与完整产品面**：805、3D、浏览器、代码 / 网页、协作 / 移动入口等逐域逐包裁决；在线投稿、市场、账号、团队、社区、支付、积分、云同步等见 Parity 矩阵待决清单，禁止“大复刻包”。
- **P7 全量验收与发布**：按 Parity 矩阵、八步闭环、异常恢复、性能、安装升级和证据总验收，最终只认已复刻 / 改编通过 / 经决策不纳入。

> 依赖原则：P0—P7 不替代 D-031 / D-032 的产物 DAG、双轨门控和精准挂脏。生成动作只读已定稿上游；分镜未定不排镜；301 / 501 及后续音乐媒体调用统一收敛于 803 引擎，renderer 不直连 ComfyUI。

## 5. 归档与重建说明

任务包按八步模块分段编号（0xx–7xx 业务段 + 8xx 平台基础段），新包取所属段内当前最大已用编号 + 1，编号不回收、不复用；现行 40 个包。路线与落地状态以本文件及各任务包为准；未闭环偏差见 [docs/设计现状与偏差清单.md](../设计现状与偏差清单.md)。
