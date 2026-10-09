# SDG-RE-任务清单 · feature-005-产物变更传播

> **版本**：v1.4（2026-10-03，取代 v1.3；画幅并入六要素、术语改名与派生规则子任务）
>
> 状态：✅ 已完成（2026-10-04 T1~T10 全部 AC 通过；K1/K3/K5/K8 已批，见变更记录 D-016~D-023）

## 上下文加载清单（围栏，禁止读写清单外文件）

| 文件 | 用途 |
| :-- | :-- |
| shared/types.ts | 追加类型（K1） |
| src/lib/replay.ts | replay 扩展 |
| src/lib/deriveFiveElements.ts | 画幅派生（六要素） |
| src/lib/gates.tsx | 0-b 门标题/六要素展示行 |
| src/lib/messages.ts | 消息工厂 |
| src/lib/revision.ts | 新建：常量+isRunnable |
| src/lib/superseded.ts | 新建：世代标注 |
| src/App.tsx | 编排 |
| src/components/StageCanvas.tsx | 节点入口/失效态 |
| src/components/ChatPanel.tsx | chip/候选卡/历史角标 |
| src/components/InputBar.tsx（或同等输入区组件，实施时以实际文件名为准） | @ chip 草稿态 |
| src/components/GateCard.tsx | 变更链 confirm/reject 衔接 |
| src/components/BackgroundArchive.tsx | 模态变体 |
| src/components/IdeaEditDialog.tsx | 新建：创意编辑弹层 |
| src/components/RevisionDraftCard.tsx | 新建：候选卡（人工事实+AI 壳） |
| src/types/api.d.ts（或 preload 类型声明实际位置） | api 声明 |
| electron/main.ts | revise-text 通道 |
| electron/preload.ts | reviseText/readArchive |
| electron/session.ts | archiveExisting/readArchive/4 写入点 |
| electron/prompts.ts | buildReviseTextPrompt、VISUAL_SYSTEM 重写 |
| electron/style-catalog.ts | 新建：谱系目录快照（源：《视觉风格谱系》HTML v1.45，外部只读参照 `~/Documents/Dufs/AI短剧工作流/AI短剧制作视觉风格谱系.html`） |
| 对应 __tests__/*.test.ts(x) | 单测 |
| docs/features/feature-001~004 的契约（只读参照） | 既有 IPC/消息契约 |

## 原子任务

### T1　共享类型（K1）

- [x] AC-T1-1 shared/types.ts：NodeStatus +invalidated；MessageKind +unlock/revision/revision-draft；ChatMessage +candidate?；导出 RevisionSource/UnlockData/RevisionMessageData/RevisionDraftData；GateId 提升（replay.ts 改从 shared 导入并删除本地定义，语义不变）；FiveElements +aspectRatio（必填）
- [x] AC-T1-1a 术语（K5）：界面与 prompt「立项五要素」→「立项六要素」；0-b 门标题改「立项单 v1 · 六要素」并增画幅行；类型名/函数名不改
- [x] AC-T1-1b deriveFiveElements：画幅平台派生（抖音/红果/快手/视频号→竖屏；B站/YouTube→横屏；混合竖屏优先；未知竖屏）；hydrate/replay 对旧数据无 aspectRatio 回退竖屏
- [x] AC-T1-2 `npm run build` 通过（tsc -b）

### T2　纯函数层

- [x] AC-T2-1 src/lib/revision.ts：RevisionSpec、DOWNSTREAM（契约 §2 8 行逐字一致）、CHAIN_ORDER、NODE_REVISION、STAGE_GATE、STAGE_PRODUCT_KINDS、isRunnable
- [x] AC-T2-2 src/lib/superseded.ts：annotateSuperseded（忽略 candidate/revision-draft；世代规则；创意气泡不由本函数处理）
- [x] AC-T2-3 messages.ts：makeUnlock/makeRevision/makeRevisionDraft + content 文案
- [x] AC-T2-4 单测：isRunnable 真值表（同段/前驱/门/loading/downstream 内外）、DOWNSTREAM 8 行、映射表；superseded 五类用例（candidate 不入集、多次 unlock、未起跑不标、revision-draft 忽略、孤儿候选）

### T3　主进程归档 + 只读档案

- [x] AC-T3-1 session.ts：archiveExisting(filePath, now)；4 个写入点（saveProject/saveStory/saveScript/saveArchive）写前归档；同次同时间戳序号兜底；首次写入不归档；manifest 永不归档
- [x] AC-T3-2 readArchive(): Promise<string|null>；IPC archive:read；preload + api 声明
- [x] AC-T3-3 archive:save/project:save/story:save/script:save 返回 {archived:string[]}（仅追加字段）
- [x] AC-T3-4 单测：归档命名/同秒序号/首次不归档/manifest 不归档/归档失败不阻断写入的行为按实现定稿（以契约 §6.1 为准）；readArchive 不存在返回 null
  > 📝 实施定稿（2026-10-03）：归档失败（rename/mkdir 异常）向上抛错阻断本次写入，与契约 §8「save/归档失败 → 门保持打开可再确认；归档不回滚（副本语义）」一致——宁可写入失败也不做无备份覆盖。测试 src/test/session-archive.test.ts（6 例）。

### T4　revise-text 通道（K8）

- [x] AC-T4-1 prompts.ts：buildReviseTextPrompt(kind,current,instruction,turns)；两角色；输出纯全文约束；档案保留模板结构
- [x] AC-T4-2 main.ts：agent:revise-text；复用 arkClient；空结果 reject REVISE_EMPTY；降级策略对齐既有 agent:* 通道
- [x] AC-T4-3 preload/api 声明：reviseText(kind,current,instruction,turns?)
- [x] AC-T4-4 单测：prompt 构造（含 turns 顺序）、解析、空校验、mock 降级
- [x] AC-T4-5 electron/style-catalog.ts：从谱系 HTML v1.45 固化 4 形态 × 18 画风（11主7备，含 visualFeatures/anchorWords/qualityRecipe/feasibility）；导出 CATALOG_VERSION/FORMS/STYLE_CATALOG/validateVisualStyle；文件头注明来源路径与版本
- [x] AC-T4-6 prompts.ts：VISUAL_SYSTEM 重写（仅目录内选型、锚点词/配方照抄、仅六要素变更时保留风格、输入含画幅、输出带 family/auxiliaryStyle?/feasibility/fiveElements）；大纲/分场/台词/分镜 prompt 显式携带画幅（构图按画幅）；生成返回过 validateVisualStyle，不通过 reject STYLE_NOT_IN_CATALOG（首推与候选同规则）
  > 📝 实施注（2026-10-03）：目录校验入口为 style-catalog.ts 的 assertInCatalog（validateVisualStyle 语义不变，抛错 code=STYLE_NOT_IN_CATALOG 携带目录版本与原因，便于单测覆盖）；mockVisualStyle 同步改为目录内风格（form=仿真人/主画风=拟真人·仿真人动漫）并携带 fiveElements，无 Key 开发链路不受校验影响。REVISE_INSTRUCTION_EMPTY（意见为空）为边界防御，先于 mock 降级短路。
- [x] AC-T4-7 单测：catalog 形状（4/18/11/7、字段非空、辅仅「备」）+ validateVisualStyle 用例（目录外主画风/辅越界/通过）+ prompt 约束文案 + STYLE_NOT_IN_CATALOG 路径

### T5　replay

- [x] AC-T5-1 ReplayResult +ideaText/activeUnlock/activeDraft；revision start/cancel 生命周期；AI 源 confirm 终结、人工源 unlock 终结、reject 不终结
- [x] AC-T5-2 candidate 消息忽略；revision-draft 不推态；采用补发的正式产物+gate 正常处理
- [x] AC-T5-3 unlock 8 源清空表（与 v1.1 表一致，idea 含 ideaText/fiveElements）；invalidated；phase；redo 清零
- [x] AC-T5-4 activeUnlock 消化终扫（STAGE_GATE confirm 在 unlock 之后）；2-c 无 unlock 场景
- [x] AC-T5-5 0-c 档案跳过；损坏 data 忽略；旧会话零差异红线
- [x] AC-T5-6 单测覆盖以上全部分支
- [x] AC-T5-7 feOverride：visual-style data.fiveElements 终值规则；有效五要素回退（override??派生）；idea unlock 清 feOverride、0-c unlock 保留；hydrate 0-b 展示同源

> 📝 2026-10-03 实施定稿：0-c confirm 对 background 加守卫 `if (nodes.background !== 'done')` 才置 active——避免重放「unlock→重新定稿→archive→confirm 0-c」序列时把已 done 的 background 打回 active，破坏 canEnterStory 派生（AC-T9-1 依赖）。v1.1 旧会话首次 0-c confirm 前 background 必为 pending，守卫保持零差异。（[代码 src/lib/replay.ts:170-175](../../../src/lib/replay.ts)）

### T6　UI 组件

- [x] AC-T6-1 StageCanvas：入口表（idea ✎+💬；background 👁+💬；AI 单 💬；diagnosis 无）；门控（loading/gate/activeUnlock/activeDraft/invalidated）；失效视觉（warn 虚线+圆点）+「重新生成」按钮 disabled tooltip
- [x] AC-T6-2 IdeaEditDialog：预填 ideaText、保存/取消、不调模型
- [x] AC-T6-3 BackgroundArchive 模态变体：initialText/busy/viewOnly/onSave/onClose；首次右栏行为零改动；纯查看无副作用；读取失败错误态
- [x] AC-T6-4 输入区 @ chip 草稿态：chip+×、提示行、🎲（AI 源）、draft 路由发送、activeUnlock 禁用态
- [x] AC-T6-5 RevisionDraftCard：人工候选（徽标/全文/三按钮）；AI 候选壳（复用正式卡+warn 虚线条+四按钮）；D5.3 徽标按钮状态矩阵；失败重试
- [x] AC-T6-6 unlock 事实卡（system 渲染）；历史版本角标（superseded + 创意旧气泡）；候选永不标历史
- [x] AC-T6-7 组件测试（契约 §9.6 全部条目）

> 📝 2026-10-03 实施定稿：① 候选状态标注抽纯函数 [src/lib/candidates.ts](../../../src/lib/candidates.ts)（annotateCandidates 正序扫描 → vN/五态，D5.3 矩阵单测覆盖）；② 候选卡组件合入 [src/components/messages/CandidateCards.tsx](../../../src/components/messages/CandidateCards.tsx)（RevisionDraftCard + CandidateShell + BriefCandidateCard 三卡一文件，BriefCandidateCard 从 electron/style-catalog 直取 CATALOG_VERSION）；③ StageCanvas 门控以 `gated` prop 隐藏普通入口、`viewEntries` 保留背景只读查看，「继续修改/继续提意见」在组件内聚焦输入框不产生请求。组件测试集中于 [feature005-ui.test.tsx](../../../src/components/feature005-ui.test.tsx)（11 例）+ [candidates.test.ts](../../../src/lib/candidates.test.ts)（4 例）。

### T7　App 编排

- [x] AC-T7-1 三个入口动作（编辑/对话/档案）与门控；revision/start 落盘
- [x] AC-T7-2 draft 路由：人工源（reviseText+turns 抽取+revision-draft）；AI 源（既有通道、多轮 candidate JSON 前缀、重摇=undefined、candidate 消息、不 setState/不开门）
- [x] AC-T7-3 commitIdea/commitArchive/adoptAiCandidate（0-c：visualStyle+feOverride 一体转正）/cancelDraft（契约 §5.3）
- [x] AC-T7-4 handleConfirm 变更链：AI 源 confirm 才 save（归档）+unlock+下游失效；reject 回 draft；0-a/0-b/0-c 特殊；1-a/2-a/2-b 变更链不自动连跑、首次流程回归；1-b CTA；2-c 无 unlock 收尾
- [x] AC-T7-5 runRevisionStage 七路由 + isRunnable 守卫；hydrate（activeDraft chip/候选按钮、activeUnlock runnable、fiveElements 补派）；互斥
- [x] AC-T7-6 档案文本缓存（readArchive；缺失时采用前再读）；error/REVISE_EMPTY 文案
- [x] AC-T7-7 集成测试（契约 §9.5 五条）

> 📝 2026-10-03 实施定稿（T7）：① applyUnlock 增 AI 源节点置 done（STAGE_GATE 反查源 stage，与 replay confirm 分支对齐，防重启前后 active↔done 翻转）+ 清 pendingGate（setGate/Details/Key null）；② unlock 数据 idea 源必带 newIdea（replay §3.4 缺失即丢弃整条，原实现漏带）；③ adoptAiCandidate 补 1-a~2-c setState（契约 §5.3-2，门 confirm 依赖该 state 执行 save）；④ replay 0-a/0-b confirm 的 brief='active' 加 `!== 'invalidated'` 守卫（链上保持失效，契约 §5.4）；⑤ 集成测试 [src/App.revision.test.tsx](../../../src/App.revision.test.tsx) 4 例覆盖契约 §9.5 ①②③⑤（③前缀断言并入②），④首次自动连跑沿用 restore 基座新增 0-b confirm→runBrief 用例。

### T8　全量验证

- [x] AC-T8-1 `npm test` 全绿（既有 99+新增无回归）
- [x] AC-T8-2 `tsc -b` + `npm run build` 通过
- [x] AC-T8-3 ESLint 无新增告警（项目无 ESLint 配置，以 tsc strict+noUnusedLocals/noUnusedParameters 零告警等效把关）

### T9　真机验证（样本会话 project-1790989879665 复制副本上操作）

- [x] AC-T9-1 S1 直接编辑：保存无请求→7 节点失效→手动 diagnosis→过门→0-b 后不自动视觉→0-c 过门（档案已锁定：跳过面板，CTA 进故事）→手动跑完
- [x] AC-T9-2 S1 对话法：@ 两版候选→采用=编辑效果；中途 ×放弃零副作用；关闭重开 chip+候选恢复
- [x] AC-T9-3 S2：档案查看预填磁盘全文；对话改档案采用→归档目录出现旧档→大纲起失效
- [x] AC-T9-4 S6：分场对话候选 v1/v2，期间台词/分镜仍 done 无文件变化；采用→门→reject 回对话→v3→confirm→归档+失效；speakerId/场景引用指向新小传/新分场
- [x] AC-T9-5 S8：分镜对话采用→confirm→无 unlock、收尾文案；归档分镜.json
- [x] AC-T9-6 三中断：候选中退出/采用未过门退出/失效未起跑退出，重开一致
- [x] AC-T9-7 回归红线：新建会话首次全流程（自动连跑、门内否决重做、CTA、首次右栏档案填写、五要素派生）与现状一致
- [x] AC-T9-8 S3 立项单：@ 立项单改集数→候选含六要素（风格折叠行）；换画风→候选在目录内且徽标版本号；改画幅→候选画幅行高亮、confirm 后下游 prompt 携带新画幅；采用→0-c 门整体展示→confirm→brief.json 六要素+风格更新、归档、大纲起失效；目录外意见→STYLE_NOT_IN_CATALOG 报错可重试

### T10　收尾

- [x] AC-T10-1 AC-1~12 逐项自检输出
- [x] AC-T10-2 短剧Agent平台设计.md §7.1 补「版本归档区」（版本/ 目录约定）与「视觉风格谱系快照」（electron/style-catalog.ts 来源与同步责任）；术语表「立项五要素」→「立项六要素」（K5）
- [x] AC-T10-3 变更记录：D-016~D-023 批准状态更新 + 落地实施记录清理；本文件状态更新
