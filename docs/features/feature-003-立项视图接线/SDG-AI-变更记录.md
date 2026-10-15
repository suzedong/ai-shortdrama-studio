# feature-003 立项视图接线（Stage0View 真实化）· 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · 零卡口声明 + 任务包评审报批（待批准）

- **触发背景**：2026-10-15 STAGE 0 缺口盘点发现三处事实——① [Stage0View.tsx](../../../src/studio/Stage0View.tsx) 是 feature-025 留下的静态原型壳（「安妮的夏天」假数据 + 演示控制条：随机假数据/模拟定案/强制门/模拟推进）；② [StudioApp.tsx](../../../src/studio/StudioApp.tsx) 调用点以 `n-brief` 为 id 取版本，而真实发布链 upsert 的节点 id 是 `step-0-brief`（[publish.ts](../../../electron/brief/publish.ts) L89–98），真机恒 fallback `'v1'`；③ 立项单 JSON 自立项链路落地以来从未在中栏被真实渲染。
- **卡口自查（K1/K8/K9 均不触发）**：
  - **K1（shared/types.ts）不触发**：本包只读消费既有 `ProjectBrief / CanvasNode / CanvasGate / Canvas` 形状，[shared/types.ts](../../../shared/types.ts) 零 diff；视图模型 `Stage0State` 是 renderer 内部派生类型，落在 `src/studio/stage0/select.ts`，不进共享层。
  - **K8（新增 MCP 工具/通道）不触发**：数据面全部既有——canvas 经 StudioApp 既有订阅 props 下传（不开第二订阅）；立项单与背景档案经既有沙箱通道 `fileRead({path})` 读取；审批仍走既有 `gate.decide`（右栏 GateCardView 持有，中栏不调用）。preload/main/global.d.ts 零 diff。
  - **K9（新依赖）不触发**：不引 zod（parseBriefJson 走最小形状校验）、不引 markdown 渲染器（背景档案 `<pre>` 原文陈列）；package.json/lock 零 diff。
- **批准方式**：任务包 5 文件建齐后呈报用户评审；用户明确「批准/开始编码」即视为对 D-001 零卡口结论与 D-002~D-005 包级口径的显式批准，T1→T6 一次授权。**批准前不触碰任何代码。**
- **批准范围**（以[契约](./SDG-RE-契约.md)为准）：§1 既有数据面零改动；§2 selectStage0State 形状与六规则；§3 parseBriefJson；§4 新 Props 与 data-stage0-* 凭据；§5 StudioApp 调用点；§6 测试契约；§7 越界即停红线（shared/electron/preload/global.d.ts/resources/package 零 diff）。
- **不在批准范围**：需求规格 §4.2 十项显式不做——「已捕获口径」常驻区、版本历史/diff/回滚 UI、影响评估弹窗与一键对齐、中栏门按钮、字段编辑、新 IPC/依赖、风格 ID→名称解析、诊断明细回填、删 dev-mock-api 的 n-brief 夹具、B-10/B-11 遗留。
- **状态**：✅ 已批准（2026-10-15 AskUserQuestion 选定「批准，开始编码」，零卡口结论与 D-002~D-005 同轮获批，T1→T6 一次授权）。

### D-002 · 门 pending 但 brief 节点未 upsert 的窗口态口径（2026-10-15 拟定，✅ 随 D-001 同轮获批）

- **事实**：0-final 门由立项对话提交即 pending，而 brief 节点（step-0-brief）由发布链在拍板后 upsert——存在「门已提交待批、节点尚不存在」的真实窗口；旧档也可能「有立项单文件、画布无节点」（feature-002 R-002 已记名同类边界）。
- **裁决**：phase 仍为 `empty`，但 gate0 pending 时空态主文案切换为「立项单已定稿待你批准，在右栏完成定案」并渲染门镜像条（无按钮）；gate0 不存在或已终结时显示常规空态引导。旧档「有文件无节点」仍显 empty——renderer 只读画布、不扫目录、不修旧档、不新增列举 IPC。
- **理由**：视图只投影画布已落盘事实（OD §4 决策 1），窗口态用门对象镜像补足「发生了什么」，不猜测文件系统。

### D-003 · 背景档案读取口径：项目根固定名 + NOT_FOUND 静默（2026-10-15 拟定，✅ 随 D-001 同轮获批）

- **冲突**：设计书 §2.6.8 曾写 `立项/故事背景档案.md` 子目录路径；showrunner 实际在第 0 步把背景档案写在**项目根** `故事背景档案.md`，`立项/` 子目录从未存在（与 feature-002 D-003 同型的历史路径漂移）。
- **裁决**：只读项目根固定文件名（常量带注释指向 showrunner 第 0 步）；NOT_FOUND 静默不渲染折叠区；其他读取错误在折叠区内弱化提示，不影响立项单主区。**不做多路径探测**（探测即猜测，超出接线范围）。立项单文件名不硬编码——读节点 `ref.path`，随版本走。形态差异由 T6 记名偏差清单，不回改设计书。

### D-004 · 版本显示以文件内 brief.version 为准（2026-10-15 拟定，✅ 随 D-001 同轮获批）

- 节点 `meta.version`（`vN`）只供 select 派生徽标初值；立项单 JSON 读取成功后，视图版本号以**文件内 `brief.version`** 覆盖显示。meta 与文件短暂不一致（如手工造档/未来写点调整）时以文件事实为准，避免显示旧号。解析失败（meta 不符 `^v\d+$`）置 null，徽标退化不报错。

### D-005 · 审批单点保留右栏 GateCardView，中栏只镜像（2026-10-15 拟定，✅ 随 D-001 同轮获批）

- 中栏 STAGE 0 视图**不放置任何裁决按钮**（批准/驳回/再版/对齐/回滚等写动作一律不进中栏）；门状态以镜像条呈现，点击/操作仍在右栏 GateCardView（stage0 布局下持续挂载可见）。
- **理由**：gate.decide 写通道已由 GateCardView 单点持有，复制按钮会产生双入口的状态/快捷键/埋点分叉；设计书「就绪时给出一键定案」的要求由右栏持续可见的门卡满足。这与 feature-002 D-005「交互走对话、renderer 只被动标识」同一承载原则。

## 二、实施记录（过渡）

- 2026-10-15：建包前调研完成——preload 暴露面核实（有 canvas.*/gate.*/fileRead，**无 brief.\* 通道**）；fs/read.ts 沙箱（.json/.md、≤1MB、错误码集）；publish.ts brief 节点 upsert 形状（id/ref.path/meta.version）；shared/types.ts ProjectBrief/Canvas* 形状；StudioApp L507–512 错配表达式与 L556–567 右栏挂载；ChatComposer GateCardView 单点裁决；VisualCatalog 18 条为硬编码原型数据（据此决定风格区不解析名称）；设计书 §2.6/§2.6.6/§2.6.8 原型口径；feature-002 五文件格式与零 IPC 先例。
- 2026-10-15：任务包 5 文件建立（需求规格 / 契约 / 设计说明 / 任务清单 / 本记录）。D-001 未获用户批准前不触碰任何代码。
- **2026-10-15：T1–T5 编码与回归完成（实施记录，落地后可清理）。**
  - **改动面（与契约 §7/产出物清单一致，2 改 2 新增源码面）**：
    - [Stage0View.tsx](../../../src/studio/Stage0View.tsx)（整体重写）：删除「安妮的夏天」假数据常量、`demoGate` state 与四个演示按钮（随机假数据/模拟定案/强制门/模拟推进）；新签名 `{ canvas, projectTitle, onBackToDag }`；empty/loading/brief-error/published 四态 + 门镜像条（pending/rejected）+ 脏读黄条；双卡字段、风格行、定案区（门批/口头 quote）、版本区（首版/变更条数）、背景档案折叠（`<pre>` 原文，默认收起，NOT_FOUND 整块不渲染）；读取依赖 `[ref.path]` 去重 + 递增序号防陈旧；凭据全部 `data-stage0-*`（empty/back/gate-pending/dirty-bar/brief/version/card-diagnosis/card-premise/style/verbal-quote/background/brief-error/loading，version 同名属性存文件内版本号；来源路径仅纯文本陈列、无凭据）。
    - [StudioApp.tsx](../../../src/studio/StudioApp.tsx)（仅 L507–512 调用点 4 行 diff）：传入 `canvas`，删除 `n-brief` 查找与 `'v1'` fallback 及 `briefVer` props；路由/订阅/布局零改动。
    - [stage0/select.ts](../../../src/studio/stage0/select.ts)（新增，唯一新目录文件；读取 hook 内联于视图，未新增 useBriefDocuments 文件）：`Stage0State` + `selectStage0State`（契约 §2 六规则）、`parseBriefJson`（NOT_JSON/UNSUPPORTED_SHAPE）、`BRIEF_NODE_ID='step-0-brief'`、六要素/premise 五行字段标签常量、`dirtyFieldLabel`（点路径 `fiveElements.platforms` → 末段中文，未知键回退原键；与 feature-002 脏角标语义同源）。
    - [stage0-view.test.tsx](../../../src/studio/stage0-view.test.tsx)（新增，26 例）：select 8 + parse 5 + 组件 13（empty 凭据/门 pending·rejected 叠加/v1 门批逐值/背景档案三态/口头 quote/待定徽标/v2 变更条数+脏条/rerender pending→approved/缺 ref/NOT_FOUND/坏 JSON/loading/返回回调）；含 StrictMode 双调用事实（读取序号防护下不重复出错）。
  - **静态回归（收尾复测实数）**：`npm run typecheck` 退出码 2 但**仅 2 条历史基线错误**，均在非本包文件 [canvas-zoom.test.tsx](../../../src/studio/canvas-zoom.test.tsx) L13（StepId 类型）/L90（未用变量）——T1 冻结时即存在（同日画布缩放修复包产物），本包 4 个源码/测试文件自身零类型错误；`tsc -b tsconfig.node.json`、`tsc -p tsconfig.preload.json` 双工程退出码 0。全量 `npm run test:run`：**40 文件 431 passed / 1 skipped / 0 failed**（T1 冻结基线 39 文件 405/1：skip 仍为需 ARK Key 的 T8-4；本包净增 26 passed 于 1 个新测试文件，收尾 40 文件 431/1，passed 不减少、skipped/failed 不扩大）；静态契约套件（agent-profiles/mcp-pure-tools/runtime-*）无感。
  - **真机目验（T5，2026-10-15）**：任务清单首选「右栏真实 Agent 对话」路径。执行时 ARK Key 虽已配置，但按任务清单明示退路采用**真机 Electron（非浏览器 mock）+ 真实历史项目 + 文件夹具**完成（此退路选择记名于此）。通道事实：Playwright MCP / Chrome DevTools MCP 均启动自有浏览器实例（main.tsx 在无 preload 时装 dev mock，看到的是「安妮的夏天」n-brief 假数据），无法 attach 已运行 Electron；Electron dev 脚本未开 CDP 端口。解法：另起第二实例 `electron . --remote-debugging-port=9223 --user-data-dir=%TEMP%/sdg-stage0-verify`（应用无 requestSingleInstanceLock，与用户既有实例并存），自写一次性 Node CDP 驱动（内置 WebSocket/fetch，脚本留存 `%TEMP%\sdg-stage0-verify/cdp.mjs`，非仓内文件）经真实 IPC 驱动。
    1. **空态（AC1）**：三处交叉验证——浏览器 mock 态假 DAG 含 `n-brief` v3 节点但中栏仍空态（证明 dev 夹具 id 不被采信，「立项单 v3/林屿/海堤」零出现、无演示条）；真机未命名项目空态；真机空项目 `project-20261014-215817-rbp5` 空态。均 `data-stage0-empty=true`、无版本徽标/双卡/演示控件。
    2. **published v1 逐值（AC2）**：真实历史项目 `project-20261015-102352-c3ze`（「T807门防护回归」，当日 feature-807 真机回归经真实 Agent 门批产出的合法 v1）——chip「立项单 v1」+ `data-stage0-version=1`（同名属性为文件内 version）、来源「立项单.v1.json」、「商业短剧」徽标；六要素（都市豪门复仇爽剧/抖音·红果/90 秒/80 集/冷冽凌厉风格语/9:16 竖屏）、premise 两处「（姓名、年龄待定）」中性待定徽标、风格行「主风格 A7 · 谱系 v1.46」+「辅助 D1」、定案方式「门批准入」、定案时间本地化为 2026/10/15 10:35:48、版本区「首版立项」、备注显门批原文；无门条/脏条/loading/error；`故事背景档案.md`（40 行人供事实）默认折叠（aria-expanded=false），点开后 `<pre>` 原文正确渲染。
    3. **STAGE 往返（AC7）**：STAGE 0→1→0 视图正常（回 0 后 version 仍=1，不闪不重读异常）；左上「返回画布」恢复 DAG。
    4. **脏黄条（AC4，文件夹具）**：rbp5 原是空 nodes/gates 的真实「test」项目；目验时注入合法脏 canvas（单 done 节点 step-0-brief v1 + dirty{since:1,latest:2,fields:['fiveElements.platforms','premise.coreEvent'],severity:medium} + approved 门）并从 c3ze 复制 `立项单.v1.json`。经真实 `window.api.openProject` IPC 切项目（主进程 reset 重读磁盘使注入即时生效）后断言：`data-stage0-dirty-bar=true`，文案逐字「有 1 个产物基于旧版立项命中字段：平台、核心事件」，黄条无任何按钮，version 凭据仍=1（v1 主体完整）。**目验后夹具已复原**：canvas.json 还原为空图（备份 `%TEMP%\sdg-stage0-verify/rbp5-canvas.bak.json`，updatedAt 恢复原值 2026-10-14T13:58:17.486Z）、注入的立项单.v1.json 已删除（rbp5 恢复为 manifest/.session/canvas 三文件原状）、第二 Electron 实例已关闭（9223 端口释放）。
    - **截图留存**（均为本地证据，不入库）：`%TEMP%\sdg-stage0-verify\` 下 01-initial.png（真机未命名项目）、02-empty.png（空态①）、03-dag.png、04-rbp5-empty.png（空项目空态②）、05-c3ze-v1.png（published v1 逐值）、06-bg-expanded.png（STAGE 往返）、07-bg-open.png（背景档案展开）、08-dirty.png（脏黄条）；浏览器 mock 侧另有 `%USERPROFILE%\Downloads\dag-initial-2026-10-15T06-53-15-534Z.png`、`stage0-empty-mock-2026-10-15T06-54-56-329Z.png`（证 n-brief 不采信）。
  - **AC 勾选**：AC1 ✅（真机+mock 三空态）｜AC2 ✅（c3ze v1 逐值 + 背景档案）｜AC3 ✅（单测「口头拍板原话引用出现」+待定徽标覆盖；真机历史库无 verbal 立项单，以单测为证）｜AC4 ✅（rbp5 文件夹具黄条逐字断言+截图；真实再版脏态链路已由 feature-002 自身目验）｜AC5 ✅（单测：pending 镜像条无按钮 + rerender 自动转 approved 态）｜AC6 ✅（单测：缺 ref/NOT_FOUND/坏 JSON 三错误态 + 背景 NOT_FOUND 静默，均不假数据回退）｜AC7 ✅（grep 实测 `n-brief` 仅剩 dev-mock-api.ts 夹具 2 处与本包 select.ts 注释/test 断言；StudioApp 零残留；真机 STAGE 往返+返回画布正常）｜AC8 ✅（实数见上）｜AC9 ✅（git diff 实测：shared/types.ts、electron/**（含 preload.ts/main.ts/fs/brief/canvas）、src/global.d.ts、resources/opencode/**、package.json/lock 对本包零 diff——工作树中 electron/main.ts、electron/mcp/tools.ts、electron/gate/guard.ts、package*.json、showrunner.md、CanvasBoard/ChatComposer/index.css 等改动均为同日 feature-807 与画布缩放/Markdown 气泡两个无包修复流的未提交存量，与本包无关；本包 git 可见改动面=Stage0View.tsx、StudioApp.tsx（+4 行精确 diff）、新增 stage0/select.ts、stage0-view.test.tsx 及治理文档）。
  - **与契约/需求的偏差**：无功能性偏差。两点事实记名：① OD §5 提到测试可参考 canvas-zoom 夹具，实际该文件后落地且自带 2 条 typecheck 基线错误（非本包引入），T1 已冻结；② 真机目验未走真实 Agent 对话（走任务清单许可的退路：真机 Electron + 当日真实门批项目 + 最小文件夹具），c3ze 的 v1 本身是当日真实 Agent + 门按钮产物，published 主路径数据为真实链路事实。无 R 修订。

## 三、修订记录

- _（实施期偏离契约/需求的修订记本区，分配 R-001 起编号。当前无。）_
