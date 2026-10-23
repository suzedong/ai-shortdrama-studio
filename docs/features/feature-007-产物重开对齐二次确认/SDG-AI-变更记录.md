# SDG-AI-变更记录 — feature-007 产物重开对齐二次确认

## D 节 · 决策记录

### D-001 建包登记（2026-10-21，待批准）

**背景**：「新建→立项」链路盘点缺口 #3（《设计现状与偏差清单.md》B-42 行登记）。设计书 §2.6.6 L291 与 §2.6.7 L354 规定脏产物被重新打开编辑时应触发「是否按 v(N+1) 重新对齐」二次确认；§2.6.7 L357-361 规定脏读运行时黄条含「[一键对齐]」入口。feature-002 §4.2 L82 将「影响评估弹窗面板 UI（弹窗 / 勾选列表 /『一键对齐』按钮）」整体排除留待通道包；feature-808（会话绑定）后对话通道已完全承载三选一交互，但「重开脏产物」触发点至今零拦截——用户打开脏产物直接进只读查看器，无任何重新对齐提示与入口。本包承接 002 留待切片中的「重开二次确认」部分，面板全量 UI 不翻案。

**侦察实证（建包期已核原文）**：
- `CanvasBoard.tsx`：L722 `openable` 判定；四处打开调用（L750 节点点击 / L752 Enter 键 / L799 行内 'view' / L876 右键 'view'）全部经 `onOpenNode` 汇聚 StudioApp L377 `handleOpenNode` 单点（L695 下传）——拦截一处即全覆盖，无旁路；`handleNodeAction` 的 'view' 只 toast 不开查看器
- `StudioApp.tsx`：L105 viewerNode state（confirmNode 旁置点）；L274 项目切换复位点；L314 handleSend 消息注入唯一入口（L760 下传）；L700-705 StudioViewer 渲染接线（onRequestAlign 下传点）
- `StudioViewer.tsx`：L565-636 结构（头部 L576-603 → refPath 行 L604-613 → body 三态 L614-630 → BriefHistoryView L631-633），全文无 dirty 引用——黄条落点 = L613 后、L614 前
- `CanvasBoard.tsx` L204-231：dirty 文案三件套（`DIRTY_FIELD_LABELS` 17 键 / `export dirtyFieldLabel` L225 / `dirtyTitle` L229）——确认与黄条文案同源复用，本体零 diff
- `showrunner.md` L136-180：再版六步（L148 step 5 三选一 / L149 step 6 串行委派 + align 清脏）与脏读纪律两条（L170 复读警告 / L171 委派交接物写明脏态），无「用户点名重对齐单个脏产物」专条——补丁落点 = 脏读纪律段追加第三条（归 feature-001 R-008）
- `dev-mock-api.ts` L15-17：预置脏节点 n-outline（基于 v2 / 最新 v3 / 季边界+集数 / high / 影响清单.v2-v3.json）——目验素材现成，dev-mock 零 diff
- `shared/types.ts` L358-364：`CanvasDirty` 五字段（severity 值域仅 high/medium）；L367 `CanvasNode`（经 `@shared/types` 引入）
- feature-002 需求规格 §4.2 L82 排除原文逐字复核：弹窗 / 勾选列表 /「一键对齐」按钮留待通道包——本包承接「重开二次确认」单产物三选一切片，勾选列表 / 批量 / 查看影响评估入口维持排除

**设计抉择（随包呈报，批准即生效）**：
1. 触发点映射 = 打开 dirty 节点的只读查看器（D1，平台无产物编辑器，映射留痕）
2. 拦截在 StudioApp.handleOpenNode 单点而非 CanvasBoard（D2，一处全覆盖无旁路）
3. 对齐走 Agent 对话通道（handleSend + 808 promptAsync 既有链路），UI 不直调 align（D3，D-016 边界 + K8 零）
4. 查看器黄条简版无「查看影响评估」钮，impactReport 仅文件名纯文本（D4，002 排除不翻案）
5. 指令层小补 R-008 双保险（D5，showrunner 脏读纪律第三条承接模板消息）
6. dev-mock 现成脏节点零 diff 目验（D6）
7. 零新 testid（断言走 role / 文本）+ 确认无 Esc / 背景点击关闭（D7，取消钮等价防误触）

**卡口登记**：K1 / K8 / K9 **全零触发**（依据见 SDG-RE-契约.md 置顶卡口声明）。

**偏差登记**：B-42（盘点缺口 #3，本包登记并实施收尾关闭）。

**溯源标签**：[Design 原有·形态对齐]（§2.6.6/§2.6.7 既定交互，底层以既有 handleSend 对话通道自研实现）。

**技术决策指针**：SDG-OD-设计说明.md §2 D1-D7。

## T 节 · 任务执行记录

### T1 基线冻结（2026-10-21）
- 全量测试 `npm run test:run`：57 文件 648 passed / 0 failed / 1 skipped（649 total，Duration 60.46s）
- `npm run typecheck`：恰 3 条历史基线（canvas-zoom.test.tsx TS2322 L13 + TS6133 L90、runtime-client.test.ts TS2741 L45），exit code 2 为预期
- 与批准冻结值完全一致，红线冻结

### T2 RealignConfirm 新建（2026-10-21）
- 新建 `src/studio/RealignConfirm.tsx`（净增 1 文件，零既有文件 diff）：
  - `RealignPromptInput` 接口 + `buildRealignPrompt` 纯函数（契约 §1.1 固定模板逐字；fields 经 `dirtyFieldLabel` 中文化、顿号分隔、未收录回退原文；零副作用）
  - `RealignConfirmProps` + 默认导出三选一确认组件：`role="dialog"` aria-label="产物重新对齐" 居中卡片 + 遮罩（fixed inset-0 z-[70]，toast z-[60] 之上）；产物行（kindLabel · title）/ 版本对 / 命中字段中文 / severity 两态提示（high→「影响等级：高 · 建议重新生成」、medium→「影响等级：中 · 可按需对齐」）/ impactReport 纯文本；三按钮（`按 v{latest} 重新对齐` 主钮 violet / `保持现状查看` / `取消`）→ 三回调；无 Esc / 背景点击关闭
  - dirty 非空前提守卫（`if (!dirty) return null`）；imports 仅 `@shared/types` 类型 + `./CanvasBoard` 两个既有 export（dirtyFieldLabel / kindLabel），jsdom 安全

### T3 StudioApp 拦截接线（2026-10-21）
- import RealignConfirm + buildRealignPrompt；`confirmNode` state 旁置 viewerNode；项目切换复位加 `setConfirmNode(null)`
- `handleOpenNode` 单点拦截：`node.dirty` → `setConfirmNode(node)`，无脏直通 `setViewerNode(node)`
- 三 handler：`handleRealign`（确认+查看器同关 → `handleSend(buildRealignPrompt(...))` 注入固定模板消息，agent=showrunner 既有链路）；`handleKeepView`（查看器开 + 确认关）；`handleConfirmCancel`（确认关）
- StudioViewer 接线 `onRequestAlign={viewerNode.dirty ? () => setConfirmNode(viewerNode) : undefined}`；确认组件条件挂载
- 实施期自查修正：handleRealign/handleKeepView 初版在 setState updater 内做副作用（handleSend），StrictMode 下 updater 双调致双发隐患 → 改直读 confirmNode（deps [confirmNode, handleSend] / [confirmNode]）

### T4 StudioViewer 脏读黄条（2026-10-21）
- import `dirtyFieldLabel`；Props 加 `onRequestAlign?: () => void`（未传 → 黄条无钮）
- 黄条插 refPath 行后、body 前（§2.6.7 L359 简版）：`bg-[#FFF4DE]` / `text-[#C0841D]` 与画布脏读同源色系；文案「当前基于 v{N} 立项，与最新 v{M} 不一致：{字段中文、顿号分隔}」+ 「一键对齐」钮回挂确认；无「查看影响评估」入口（002 排除不翻案）

### T5 showrunner 纪律第三条 + R-008（2026-10-21）
- `resources/opencode/agents/showrunner.md` 脏读纪律段（L171 后）追加第三条「单产物重对齐承接」（需求规格 §3.5 逐字：先 canvas_get 核实脏态 → 再版第 6 步纪律串行委派重生成 → align 清脏推进血缘；保持现状不动作）
- feature-001 变更记录 R-008 节登记（四段式：原文口径 / 联动修订 / 边界注明 / 交叉指针）

### T6 单测 realign-confirm.test.tsx（2026-10-21）
- 新建测试文件（净增恰 1，57→58）：四组 14 例——① buildRealignPrompt 模板逐字 2 例；② RealignConfirm 组件 3 例（全字段上屏+三回调、medium 两态+无 impactReport 行、无 dirty 空渲染）；③ StudioViewer 黄条 3 例；④ StudioApp 集成 6 it 覆盖七径（拦截零 fileRead / 保持现状 / 一键对齐再唤起+重新对齐注入模板 / 取消 / 直通 / 切项目双复位）
- 首跑 7 failed / 7 passed，两处夹具修正：① fileRead 假数据 `'{"a":1}'` 不匹配 StudioViewer kind 路由专属视图 schema（OutlineView 需 `themes` 数组 L226、ScenesView 需 `Scene[]` 数组 L264）→ 改按 path 路由返回匹配 JSON（outline→StoryOutline 形 / scenes→`[]`）；② ⑦ emitCanvas 未包 `act()` 致复位断言抢跑 → 对齐 studio-flow.test.tsx L73 模式 `act()` 包裹。修后单文件 14/14 全绿

### T7 全量回归 + 静态验证（2026-10-21）
- `npm run test:run`：**58 文件 662 passed / 0 failed / 1 skipped**（663 total，Duration 62.33s）——净增恰 1 文件 +14 例，既有 57 文件 648 passed 零减退
- `npm run typecheck`：**恰 3 条历史基线零新增**（canvas-zoom.test.tsx TS2322 L13 + TS6133 L90、runtime-client.test.ts TS2741 L45）
- Grep 静态验证：showrunner.md L172 第三条（【产物重新对齐】承接）在位；feature-001 变更记录 R-008 节在位

### T8 真机目验（2026-10-21，dev-mock 浏览器预览 + Playwright）
- 点 n-outline（脏）→ 确认弹全字段上屏：产物行「故事大纲 · 故事大纲 · 钩子 → 相遇 → 心动」/「当前基于立项 v2 · 最新立项 v3」/「命中字段：季边界、集数」/「影响等级：高 · 建议重新生成」/「影响清单：影响清单.v2-v3.json」（截图 t8-confirm-dialog）
- 取消 → 确认关、查看器未开、零消息
- 保持现状查看 → 查看器开 + 黄条「当前基于 v2 立项，与最新 v3 不一致：季边界、集数」+ 一键对齐钮（截图 t8-viewer-banner）；一键对齐 → 确认再现
- 按 v3 重新对齐 → 对话区注入模板消息「【产物重新对齐】产物「故事大纲 · 钩子 → 相遇 → 心动」（节点 n-outline）当前基于立项 v2…」+ 确认与查看器均关（截图 t8-realign-sent）
- 点 n-scenes（无脏）→ 直通查看器（/demo/anni/scenes.json）零确认零黄条（回归）

### T9 治理收尾（2026-10-21）
- 变更记录 T 节全量回填 + X 节明示
- 偏差清单 B-42 行翻 ✅ 已闭环；README 总表 007 行翻 ✅
- 呈报用户验收

## X 节 · 修复记录

零修复（对既有代码零修复）。实施期内两处**新增代码自查修正**——T3 setState updater 副作用改直读 confirmNode（防 StrictMode 双发）、T6 测试夹具 fileRead 按 path 路由匹配 kind 视图 schema + emitCanvas 补 act() 包裹——均已并入对应 T 行记录，未越批准 diff 白名单。
