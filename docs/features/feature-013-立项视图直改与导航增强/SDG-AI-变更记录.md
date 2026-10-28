# SDG-AI-变更记录 — feature-013 立项视图直改与导航增强

## D 节 · 决策记录

### D-001 建包登记（2026-10-28，规格待批准，未动代码）

**背景**：设计书 §2.6.6（L258-308）明文「立项单全字段可编辑 · 任何版本可再版」——L0 项目名/标签/备注、L1 集数/时长/受众/基调/画幅、L2 故事前提/主风格「全部可改，无 disabled 无锁形 icon」，且 §2.6.6 视觉表与 §2.6.8 L392 要求 STAGE 0 导航增强（左栏 hover 版本历史 + titlebar tooltip「立项 vN · X 产物已对齐 · Y 待处理」）。现状三缺口：①立项视图直改仅 6 字段（L1 三键 + L2 风格两 Id + kind），题材/平台/基调/故事前提/诊断结论只读；②L0 标签/备注**无模型**（ProjectBrief 十字段无 L0，项目名在 `.session.json`）；③左栏 brief 节点仅 `✓ vN`/`vN ⚠k` 徽标无 hover 历史、titlebar 无统计 tooltip。另 002 需求规格 L48 明示「立项单模型无 L0 字段……备未来 L0 落地」——本包即该预留路径的落地。2026-10-28 用户拍板分包方案，批准启动建包（Spec 先行，不动代码；包号 013 经目录复核空闲无冲突，0xx 立项阶段段）。

**侦察实证（建包期已核原文/实测）**：
- [Stage0View.tsx](../../../src/studio/stage0/Stage0View.tsx)：BriefEditPanel（L264 起，B-24/D-017 注释）六控件——kind L392、episodeDuration L400、episodeCount L403、aspectRatio L407、mainStyleId L414、auxiliaryStyleId L419；只读——genre L398、platforms L399、tone L406（FieldRow）、diagnosisSummary L426-431、diagnosisDetail L432-438（「恒只读」注释）；待清理文案三处——L376 注释「题材/平台/基调/诊断结论等开放式字段保持只读」、L453「题材、故事前提等开放式修改在右侧对话中提出」、L588「故事前提为开放式文本……重进项目后反映」；
- [types.ts](../../../shared/types.ts)：FiveElements L44-51（genre/platforms[]/episodeDuration/episodeCount/tone/aspectRatio）；StoryPremise L81-87 五键；BriefStyle L90-94；ProjectBrief L112-124 十字段**无 L0**；BriefDraft L149-156；ProjectSession L332-339（title 存 `.session.json`）；CanvasParentReference L352-355；CanvasDirty L358-366（含 markedAt? L365，806 落）；
- [main.ts](../../../electron/main.ts)：`brief:update` L218-266（白名单 kind 枚举 + fiveElements 三键 + style 三键含 810 catalogVersion；空判 L262-264）；`project:rename` L182；feature-004 三 IPC——`brief:history` L270 / `brief:version-read` L273 / `brief:rollback` L279；
- [update.ts](../../../electron/brief/update.ts)：BriefUpdatePatch L19-32；updateBriefFields L48-181 骨架（合并 patch L69-95 → diffBrief L97 → 就绪闸 evaluateDraft L103 → assessImpact L114 → publishBriefFiles 双写 approve.by='ui' L117 → 影响清单 decisions 恒 'mark' L119-133 → manifest 推进 L136-142 → 画布单次写挂脏含 markedAt L144-169）；
- [history.ts](../../../electron/brief/history.ts)：BriefHistoryItem L9-17（version/path/publishedAt/kind/approveBy/changeCount/note）；readBriefHistory L26-45；preload L21-29 / global.d.ts L76/L98/L111/L115 / dev-mock L573/L592 三端桥已备；
- [StageNavPanel.tsx](../../../src/studio/canvas/StageNavPanel.tsx)：briefVersion 派生 L45-49（brief 节点 meta.version 与 dirty latestBriefVersion 取大）；徽标 L120-123（`✓ vN`/`vN ⚠k`）；title 仅 dirty 文案 L116-118，无 hover 历史；
- [StudioApp.tsx](../../../src/studio/shell/StudioApp.tsx)：stage-track L508；点击 STAGE 0 切 stage0 视图 L514-516；L529 `title={\`STAGE ${s.step} · ${STEP_LABELS[s.step]}\`}` 无统计；
- [feature-002 需求规格](../feature-002-立项后变更与影响评估/SDG-RE-需求规格.md)：L42 Δ 命名空间；L46-47 分级表；**L48**「低（不入清单）：仅元数据。现状立项单模型无 L0 字段……本包低级别无字段可命中，分级表保留级别定义备未来 L0 落地」；
- 计数基线（承 806 T7 同日实测，T1 须复核）：全量 66 文件 761 passed / 0 failed / 1 skipped；tsc 恰 3 条（scripts/electron-smoke.mjs 1 + Stage3AssetHub 2）；MCP 工具 28（[tools.ts](../../../electron/mcp/tools.ts) 注册计数）；showrunner 白名单 23（[showrunner.md](../../../resources/opencode/agents/showrunner.md) L16-38 恰 23 键）；feature-012 不存在、013 包号空闲。

**设计抉择（随包呈报，批准即生效）**：
1. **事一全字段直改**：BriefEditPanel 扩至 L1/L2 全字段——五要素补题材/基调/平台三控件、故事前提卡①五键改控件、风格补 *Name 两键、diagnosisSummary 直改；诊断依据（diagnosisDetail）推荐保持只读（设计 D2-a，待拍板）；009 premise 确认色/「不可篡改」徽标零 diff（人经面板直改即 human 语义，D5）；
2. **事二 L0 入模**：推荐方案 A——`BriefL0 { tags?: string[]; notes?: string }` 入立项单 v2 模型（ProjectBrief/BriefDraft 增 `l0?`，**触 K1**），随版本化/历史/diff/回滚自动留痕；diff 命名空间 `l0.tags`/`l0.notes` 命中低级「直接落盘」（002 L48 预留路径启用）；项目名例外留 `.session.json`（project:rename 通道不搬家）；备选 B（manifest.json）/C（sidecar `立项元数据.json`）代价 = L0 失去版本化追溯，与 §2.6.6 冲突（D1，待拍板）；
3. **事三导航增强**：左栏 brief 节点 hover 版本历史卡复用 004 `brief:history`（懒加载+会话缓存，自定义卡非原生 title，三态降级，D6）；titlebar STAGE 0 tooltip「立项 vN · X 产物已对齐 · Y 待处理」——Y=dirty 节点数与左栏 ⚠k 同数同源，X=done+parentReference 非 dirty 非 brief 节点数，vN 由 `deriveBriefDisplay` 纯函数与左栏同源派生，Y=0 显「全对齐」变体，未发布降级现状文案，**零新 IPC**（D4）；
4. **通道**：`brief:update` 白名单扩键（fiveElements +genre/tone/platforms、premise 五键组、+diagnosisSummary、拍板 A 时 +l0 键组），循 D-017/810 catalogVersion 先例；**零新 IPC、MCP 工具 28 不动、showrunner 白名单 23 不动**；数组字段仅逐元素非空校验，枚举闭集交 806 harness 兜底（D7）；
5. **评估衔接零新机制**：面板批量 diff 一次提交 = 一次 updateBriefFields = 一次再版 + 一次复算 + 恒 mark（D3）；主流程骨架零改动。

**卡口登记**：**K1 条件触发**——仅当决策点 1 拍板 A 时改 `shared/types.ts`（BriefL0 字段方案见契约 §1.1，批准后方可动 shared）；拍板 B/C 则 K1 不触发。**K8 触发**——`brief:update` 系统通道白名单扩键（契约置顶声明，循 810 先例）。**K9 零触发**（无发布/部署/外发动作）。实施中触碰未登记卡口立即停手呈报（K10）。

**偏差登记**：建包期零偏差。feature-012 不存在、013 空闲已核；若实施前 012/813 等先行落地致基线漂移，T1 实测冻结并停手报用户。

**溯源标签**：[Design 原有]（§2.6.6 全字段可编辑 + STAGE 0 hover 历史、§2.6.7 低级直接落盘、§2.6.8 titlebar tooltip——设计内功能补全，非新发明）。

**依据**：2026-10-28 用户拍板分包方案（三件事归一包、包号 013、Spec 先行）。

**技术决策指针**：SDG-OD-设计说明.md §2 D1-D8 + §2.1 字段分层直改控件明细。

### D-002 实施放行（2026-10-28）

用户批准本包规格，决策点按推荐方案裁决：**1=A**（L0 入立项单 v2 模型，K1 触发）/ **2=b**（仅 diagnosisSummary 直改，diagnosisDetail 保持只读）/ **3=A**（批量一次提交一次再版）/ **4=a**（X = done 且带 parentReference 且非 dirty 的下游产物节点数）/ **5=a**（自定义 hover 卡）。拍板结论已回填需求规格 §3.4；三项包落地值同批登记决策台账 **D-020**。

## T 节 · 任务执行记录

| # | 日期 | 实测与结果 |
| :-- | :-- | :-- |
| T1 | 2026-10-28 | 决策点 1-5 按推荐值确认并回填需求规格 §3.4；基线冻结：66 文件 **761 passed / 0 failed / 1 skipped**；tsc 恰 3 条；MCP **28** 工具、白名单 **23**；feature-012 当时不存在，013 包号无冲突。 |
| T2 | 2026-10-28 | **K1 触顶已过**：`shared/types.ts` 新增 `BriefL0 { tags?; notes? }`，`ProjectBrief` / `BriefDraft` 各增 `l0?: BriefL0`（可选，存量兼容）；`electron/brief/diff.ts` 命名空间增 `l0.tags` / `l0.notes` → 低级（直接落盘不入清单）；`publish.ts` / `render-md.ts` 再版正文与 md 头部贯通 L0（有值才渲染）。`brief.test.ts` 增 2 例（l0 diff 低级命中 / 旧版无 l0 读取再版不炸）全绿。 |
| T3 | 2026-10-28 | **K8 触顶已过**：`electron/brief/update.ts` `BriefUpdatePatch` 扩键（fiveElements + genre/tone/platforms、premise 五键、diagnosisSummary、l0）；`electron/main.ts` `brief:update` 白名单同步扩键 + 字符串/数组逐元素非空校验；preload / global.d.ts / dev-mock 三端镜像同步（签名不变，零新 IPC）。`brief-update.test.ts` 增 6 例（新键合法/非法/空 patch/多键混合单次再版）全绿。 |
| T4 | 2026-10-28 | `src/studio/stage0/Stage0View.tsx` `BriefEditPanel` 扩至 L1/L2 全字段：五要素补题材/基调/平台控件、故事前提卡①五键改控件（保留 009 分色与「不可篡改」徽标零 diff）、风格卡补 `*Name` 两键、卡③ `diagnosisSummary` 文本域（诊断依据保持只读）；保存后复用 loadBrief 刷新；删除「题材/故事前提请在右侧对话提出」「重进项目后反映」旧引导文案；`stage0-view.test.tsx` 补面板渲染/提交键集/刷新断言全绿。 |
| T5 | 2026-10-28 | 卡④「标签」FieldRow → 多文本 chip 编辑器、新增「备注」多行文本域，初值取 `brief.l0`；patch 增 `l0` 键随面板一次提交；未发布项目两控件禁用并提示「立项发布后可直接修改」；再版后历史面板可见 l0 差异、影响清单零新增条目。 |
| T6 | 2026-10-28 | `src/studio/canvas/brief-display.ts`（新纯函数：`deriveBriefDisplay` / tooltip 三态格式化，vN 取大逻辑自 StageNavPanel 迁入）；`StageNavPanel.tsx` brief 节点 hover 版本历史卡（`brief:history` 懒加载 + 会话缓存 + 加载中/空/未发布降级 + 自定义定位）；`StudioApp.tsx` STAGE 0 `title` 改「立项 vN · X 产物已对齐 · Y 待处理」（Y=0「全对齐」变体，未发布降级）；`brief-display.test.tsx` 9 例 + `window-titlebar-integration.test.tsx` 2 例全绿；零新 IPC。 |
| T7 | 2026-10-28 | 全量回归：**70 文件 821 passed / 0 failed / 1 skipped**；tsc 恰 3 条（构成不变）；MCP 工具 28 / 白名单 23 / `package.json` 零 diff；契约三件套全绿。 |
| T8 | 2026-10-28 | 真机目验**受限降级**：本包验收面（桌面端全字段直改 → 再版 → 历史/徽标/tooltip）需 Electron 桌面环境，本环境未执行，不臆造通过；以 T4/T5/T6 组件与纯函数单测 + 代码走读替代留证。桌面端目验列入遗留项，与 011 / 012 一并待用户真机验收。 |
| T9 | 2026-10-28 | 治理收尾：本记录 T/X 回填；`docs/features/README.md` 013 行翻态；`docs/设计现状与偏差清单.md` 登记 013 行；五文件交叉引用复核（包号、决策落地值、基线）；806 五文件无需联动（未改其机制）。 |

## X 节 · 修复记录

- 2026-10-28：【提交归属留痕】本包 K1/K8 主进程侧（`shared/types.ts`、`electron/brief/diff.ts`、`publish.ts`、`render-md.ts`、`update.ts`、`main.ts`、`preload.ts`）与导航侧（`StageNavPanel.tsx`、`brief-display.ts`、`StudioApp.tsx` 部分、`Stage0View.tsx` 主体）已随提交 **7058a41**（提交信息为 806）入库；renderer 余量与测试仍在未提交工作区。提交信息未体现 013，留痕备查，不追溯改写历史。
- 2026-10-28：【行号漂移】建包侦察所记 `Stage0View.tsx` L376 / L392-438 / L453 / L588 与 `StudioApp.tsx` L529 在实施时已漂移，均以实施时实际位置为准；功能验收口径不变。
- 2026-10-28：【目验受限】T8 降级为组件/纯函数单测 + 代码走读，原因见 T8 行；不列功能偏差，遗留项随三包统一真机验收关闭。
- 2026-10-28：【决策点 2 落地范围】仅 `diagnosisSummary` 提供文本域直改，`diagnosisDetail` 保持只读（D-018 诊断过程留痕语义），与拍板 2=b 一致。
