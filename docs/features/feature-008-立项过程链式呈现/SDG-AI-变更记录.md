# SDG-AI-变更记录 — feature-008 立项过程链式呈现

## D 节 · 决策记录

### D-001 建包登记（2026-10-21，已批准）

**背景**：「新建→立项」链路盘点缺口 #4（《设计现状与偏差清单.md》B-43 行登记）。设计书 §2.6.8 L370-375 规定立项画布是线性收敛链「[① 选题诊断] → [② 故事前提] → 🚪 定案卡」，过程链式呈现；现状 Stage0View 四态（empty / loading / brief-error / published）全程无任何链式过程呈现——用户在对话进行中看不到六要素与前提的收敛进度，也看不到定案门在链中的位置。本包在三布局 Header 下恒显顶部链态条，纯订阅零写入，将设计书既定线性收敛链落到 UI。

**用户方案拍板（2026-10-21，三选全推荐项）**：
1. 呈现形态 = **顶部链态条**（STAGE 0 视图顶部恒显三节点+箭头+状态徽标+进度，empty / in-progress / published 三态共用，published 双卡主体零改动）
2. 进度口径 = **x/6、x/5 精确进度**（topic 按推荐词表含中英文别名精确匹配，匹配不上计总数不算进度）
3. 定案卡节点 = **状态镜像 + 只读摘要**（门态徽标 + 点击展开只读摘要，批准/驳回仍单点在右栏门卡）

**侦察实证（建包期已核原文）**：
- `短剧Agent平台设计.md` §2.6.8 L370-375：线性收敛链两节点 + 🚪 定案卡 ASCII 原文；L377 常驻元素不画成节点；L378-381 卡片形态与 Agent 主动行为
- `select.ts`（全 141 行）：`Stage0State` 七字段已含 published 态 `version`（briefNode.meta.version 解析）；`FIVE_ELEMENT_FIELDS` / `PREMISE_FIELDS` 中文别名与 showrunner 推荐词表同源——词表契约直接复用口径，select.ts 本体零 diff
- `Stage0View.tsx`：EmptyStage0 Header L170 + 滚动容器 L171 `top-[38px]`；BriefError Header L658 + 容器 L659；默认导出 Header L682 + 容器 L683 `top-[38px]`——三布局 Header/容器同构，挂载点与顶距改点各 3 处；PublishedBody 双卡 grid-cols-2 L465 主体零 diff
- `CaptureBar.tsx` L33-41：captureList 首拉（alive 标志）+ onCaptureChanged 全量替换订阅 + 退订——`useCaptureFacts` 直接复用该消费模式
- `showrunner.md` L101：推荐词表原文（六要素 genre/platforms/episodeDuration/episodeCount/tone/aspectRatio + 中文别名；前提 leads/time/place/coreEvent/seasonBoundary + 中文别名）；L125 gate_request payload 形状 `{version, pendingMarks, changesFromPrevious}` + question = 人读定案卡
- `stage0-view.test.tsx` L134-138：`installFileRead` 整体替换 `window.api = { fileRead: spy }` 无 capture 两桥——Stage0Chain 挂载后既有用例必崩，唯一既有测试 diff = 叠加恰 2 行空桩；L155-163 StrictMode 包裹渲染；断言碰撞点经全文 getByText 排查锁定 6 条禁用串（契约 §3.3）
- `src/test/setup.ts`（全 33 行）：无全局 window.api 桩；capture 空桩已有四测试文件先例（capture-bar / realign-confirm / session-continue / studio-flow / window-titlebar-integration）
- `dev-mock-api.ts` L46 demoCanvas `gates=[]`（🚪 未就绪）+ L65-77 预置 5 条演示事实（genre/platforms/episodeCount/seasonBoundary/tone → 六要素 4/6、前提 1/5）——dev-mock 零 diff 可目验 empty 态链 + 进度联动
- K9 官方定义复核（AI-SDG-AI工具执行指令.md L150-166）：K9 = 引入新核心依赖或版本变更；新增 `data-stage0-chain-*` 凭据为 feature-003 既定组件凭据惯例（非 data-testid），不触发任何卡口

**设计抉择（随包呈报，批准即生效）**：
1. 顶部链态条三布局恒显（D1：过程链价值在对话进行中的 empty 态；brief-error 态立项已发布仅文件不可读，链依旧成立）
2. 词表口径 = trim + 英文小写化精确匹配 + 中文别名 + 同 canonical 去重；未命中计 unmatchedCount/totalFacts 不计 x；pending/confirmed 均计入（D2：进度 = 已捕获非已确认）
3. 🚪 状态优先级 published > pending > rejected > idle；版本双源（published→state.version，pending→gatePayloadVersion 守卫）（D3；「🚪 定案卡 → gates 中 0-final 最后对象」映射留痕）
4. 🚪 镜像不审批：摘要 = question 全文 pre-wrap + 右栏操作提示，零按钮；点击切换非悬停、无外点/Esc 关闭、浮层不推布局（D4，feature-007 防误触同哲学）
5. 测试桩例外 = installFileRead 叠加恰 2 行（D5；否决生产代码可选链守卫——preload/dev-mock 必有桥，守卫只为历史桩服务属坏味道）
6. chain.ts 独立模块不并入 select.ts（D6：select.ts 只投影 canvas 事实，capture facts 非 canvas 事实）
7. 布局参数 38+46=84；文案体系规避既有断言 6 禁用串（D7）

**卡口登记**：K1 / K8 / K9 **全零触发**（依据见 SDG-RE-契约.md 置顶卡口声明）。

**偏差登记**：B-43（盘点缺口 #4，本包登记并实施收尾关闭）。

**溯源标签**：[Design 原有·形态对齐]（§2.6.8 既定线性收敛链，底层以既有 capture 桥 + canvas 投影自研实现）。

**技术决策指针**：SDG-OD-设计说明.md §2 D1-D7。

## T 节 · 任务执行记录

### T1 基线冻结（2026-10-21）

全量基线 = **58 文件 662 passed / 0 failed / 1 skipped（663 total）**，与任务清单预期一致；typecheck 恰 3 条历史基线（canvas-zoom.test.tsx TS2322 L13 + TS6133 L90、runtime-client.test.ts TS2741 L45，exit code 2 预期）。

### T2 chain.ts 纯函数层（2026-10-21）

新建 `src/studio/stage0/chain.ts`（139 行）：SIX_GLOSSARY 6 条 / PREMISE_GLOSSARY 5 条（中英文别名逐字按契约 §1）；`matchChainTopic`（trim + 英文小写化精确匹配 + 同 canonical 去重）/ `selectChainProgress`（sixCovered/premiseCovered 按表序 string[] + unmatchedCount/totalFacts）/ `selectChainNodes`（diag total:6、premise total:5；🚪 优先级 published > pending > rejected > idle）/ `gatePayloadVersion`（isObject + Number.isInteger + ≥1 守卫）。零 fs / window.api / Date / 随机，零 import 副作用（jsdom 安全）；独立模块不并入 select.ts（D6：facts 非 canvas 事实）。

### T3 Stage0Chain.tsx 组件（2026-10-21）

新建 `src/studio/Stage0Chain.tsx`（119 行）：Props `{ state: Stage0State }`；`useCaptureFacts`（captureList 首拉 + onCaptureChanged 全量替换订阅 + 退订，CaptureBar L33-41 同模式）纯订阅零写入；三节点链态条 h-[46px]，徽标文案逐字按契约 §3.3（未开始 / 收敛中 x/N / 已定稿 / 未就绪 / 待拍板 vN / 被驳回 / 已发布 vN）；🚪 节点点击展开只读摘要浮层（gate0.question 全文 pre-wrap + 「批准 / 驳回在右栏门卡操作」提示，零按钮，点击切换非悬停、无外点/Esc 关闭、浮层不推布局）；凭据族 `data-stage0-chain`（容器无值）/ `="diag"` / `="premise"` / `-gate` / `-gate-summary` / `-error` 全上屏。

### T4 Stage0View 三布局挂载 + 顶距（2026-10-21）

EmptyStage0 / PublishedLoaded / BriefError 三布局 Header 后各挂 `<Stage0Chain state={state} />`；三处滚动容器 `top-[38px]` → `top-[84px]`（38+46=84）。git diff 恰 +17/-8 全为本包挂载区与顶距改点，published 双卡主体零 diff。

### T5 既有测试 installFileRead 叠加（2026-10-21）

`stage0-view.test.tsx` installFileRead 叠加 **+3 行 = 注释 1 行 + capture 空桩 2 行**（captureList 空 facts + onCaptureChanged 空退订），桩本体逐字按契约 §5、注释与 installUpdateBrief 叠加模式先例同款；系唯一既有测试 diff，否决生产代码可选链守卫（D5）。

### T6 单测 stage0-chain.test.tsx（2026-10-21）

新建 `src/studio/stage0-chain.test.tsx` 四组 27 例——① matchChainTopic/selectChainProgress 7 例（英文词全命中 / 中文别名 16 条 / trim+大小写 / 未命中 null / 去重保序 + unmatchedCount / 跨组不误配）；② selectChainNodes/gatePayloadVersion 9 例（idle 三节点 / collecting / published final+vN / version null / pending vN / payload 非法 6 形状 / rejected / 优先级 / 守卫 10 形状）；③ 组件 7 例（凭据齐全 / 首拉 4/6·1/5 / emit 联动 / 首拉失败「口径读取失败」/ pending 摘要展开收起 + 零按钮 / payload 无版本「待拍板」无 v / 非 pending 三态 SPAN 不可点）；④ 集成 4 例（empty「未开始/未开始/未就绪」/ empty+pending「待拍板 v2」+ 摘要 / published「已定稿/已定稿/已发布 v1」+ card-diagnosis/card-premise 双卡凭据零回归 / brief-error 链恒显）。**测试文件净增恰 1：58 → 59**。首轮 20 passed / 7 failed，经 X-001 修复后 27/27 全绿。

### T7 全量回归 + 静态验证（2026-10-21）

- 全量测试：**59 文件 689 passed / 0 failed / 1 skipped（690 total，Duration 63.33s）**——passed 较基线 662 净增恰 27（= T6 新例数）、failed = 0、skipped 不增（=1）、文件数 58→59 净增恰 1，四项红线全过
- typecheck：恰 3 条历史基线零新增（首轮因 X-002 新增 1 条，修复后回归恰 3）
- Grep 静态验证：§3.3 六条禁用串（「选题诊断结论」/「立项单 v」/「待定」/「立项定案门被驳回」/「立项尚未定案」/「立项单已定稿待你批准」）在链态条文案零匹配；Stage0View diff 经 git 核验全为本包挂载区（T4），published 双卡主体零 diff
- 既有测试 diff 核验：stage0-view.test.tsx 恰 +3 行（T5 契约字面），其余既有测试零 diff

### T8 真机目验（2026-10-21，dev-mock 浏览器预览 + Playwright MCP）

dev-mock 零 diff 目验（localhost:5173，main.tsx L10 自动安装 installDevMockApi；demoCanvas brief 节点 id='n-brief' 不被 select 认作 briefNode → empty 态，stage0-view.test.tsx L197 用例同口径）：

- STAGE 0 进入立项视图：链态条上屏「立项过程 ① 选题诊断 收敛中 4/6 → ② 故事前提 收敛中 1/5 → 🚪 定案卡 未就绪」✓；右栏「已捕获口径 · 5 条」同显 ✓
- `window.api.captureUpsert({ topic:'episodeDuration', value:'90 秒', source:'user', quote:'每集 90 秒左右' })` 直增事实 → ① 进度联动「收敛中 5/6」✓ + CaptureBar 5→6 条（同 capture:changed 广播源）✓
- 🚪 待批准/已发布态摘要交互走 T6 组件组单测覆盖（任务清单 T8 既定分工）
- dev-mock 内存态零持久化，目验后工作树零额外 diff

### T9 治理收尾（2026-10-21）

变更记录 D-001 翻已批准 + T/X 节本行回填；任务清单 checkbox 全勾；偏差清单新增 B-43 行直接 ✅ 已闭环（建包时 D-001 登记「B-43 行」，实施收尾随本行落表，先例 B-37/B-38/B-42）；README 总表 0xx 段增 008 行。

## X 节 · 修复记录

### X-001 选择器双笔误（T6 首轮，2026-10-21）

**现象**：stage0-chain.test.tsx 首轮 20 passed / 7 failed。
**根因**：两处选择器笔误——① byChainSummary 写成 `'[data-stage0-chain-gate-summary"]'`（多一个引号）→ SyntaxError: Invalid selector；② byChainRoot 用 `'[data-stage0-chain=""]'` 匹配无值属性，React 渲染无值 data 属性非空串 → 恒 null。
**修复**：summary 选择器去多余引号；root 改 `[data-stage0-chain]` 存在性匹配（注释「无值 data-stage0-chain 属性（容器）与带值（diag/premise）并存；文档序首匹配即容器」）。测试文件内部修正，生产代码零改动；修复后 27/27 全绿。

### X-002 BG_PATH 未用常量（T7 首轮，2026-10-21）

**现象**：typecheck 新增第 4 条 stage0-chain.test.tsx(93,7) TS6133 'BG_PATH' is declared but never read，违反恰 3 历史基线红线。
**根因**：fileRead 路由桩以 `fail('NOT_FOUND')` 兜底，未显式引用该常量。
**修复**：删除未用常量一行（最小 diff，非改路由引用）；typecheck 回归恰 3 条历史基线。
