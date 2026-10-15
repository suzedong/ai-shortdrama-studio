# feature-002 立项后变更与影响评估 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · K1 + K8 联合报批：三字段 + 三工具（待批准）

- **触发**：
  - **K1**：[shared/types.ts](../../../shared/types.ts) 三处改动——`ProjectManifest.briefVersion: number | null`；`CanvasNode.parentReference?: { briefVersion; fields[] }`（新增 `CanvasParentReference`）；`CanvasNode.dirty?: { sinceBriefVersion; latestBriefVersion; fields; severity; impactReport }`（新增 `CanvasDirty`）；另更新两条 002 待办注释（不改 RevisionSource/UnlockData 形状）。D-013-4 明示该 K1 字段方案须先行报批。
  - **K8**：新增 3 个零 LLM MCP 工具（19 → 22）：`brief.impact.assess`（20，只读预评估）、`brief.impact.commit`（21，v2+ 发布+影响清单+挂脏）、`canvas.align`（22，对齐清脏）；provider showrunner 白名单 14 → 17；canvas.update（既有工具）zod 开放 parentReference 入参、store 增血缘/脏字段保留语义。
- **批准方式**：任务包 5 文件建齐后，以 AskUserQuestion 呈报本 D-001 与 D-002~D-007 包级选型；用户选定「批准，开始编码」即视为对 K1 字段形状 + K8 工具范围（含同轮 T1→T9）的显式批准。批准前不触碰任何代码。
- **批准范围**（以 [契约](./SDG-RE-契约.md) 为准）：契约 §1 全部 K1 字段；§2 纯函数；§3 落盘形状（`影响清单.vN-vM.json`）；§4 三工具与 canvas.update 微调；§5 字段表纪律；§6 renderer 三标识；§7 登记面；§8 三个新错误码。
- **不在批准范围**：弹窗面板与交互按钮、产物内部 parentReference 强制、STAGE 1–7 自动重生成编排、RevisionSource 扩 0-final、30 天漂移提醒、清单 md、立项单 schema/diff 变更、IPC/preload、打包配置、其他 agent 文件。
- **状态**：✅ 已批准（2026-10-14 K1+K8 卡口 AskUserQuestion 四项全部选定推荐项；D-002~D-007 同轮获批，T1→T9 开始执行）。

### D-002 · parentReference 挂载位置拍板：CanvasNode，不强制产物内部（2026-10-14 批准）

- **冲突**：设计书 §2.6.7 追溯算法写「从 `project.manifest.json` 的 `nodes[*].parentReference` 出发」，脏读又写「产物内部 `parentReference`」；但 B-09 后事实是 manifest 无 nodes（7 态状态指针），节点在 canvas.json；产物 JSON 由 writer 经 file.write 自由写、平台不解析。
- **裁决**：血缘挂 `CanvasNode.parentReference`（契约 §1.2），由 showrunner 定稿时按字段表（契约 §5）声明；manifest.nodes 旧表述以 §7.1「字段契约以 shared/types.ts 为准」收口；产物内部 parentReference **不要求、不校验、不读取**。理由：平台唯一可强制的写点是 canvas 工具链；解析各产物内部会让平台与 STAGE 1–7 自由 JSON 形态强耦合。
- 差异记名：偏差清单 B-03 处理备注 + 本记录；不回改设计书。

### D-003 · 影响清单路径拍板：项目根 + ASCII 连字符（2026-10-14 批准）

- 设计书写 `立项/影响清单.vN→v(N+1).json`。实况：立项单自 feature-001 起即在项目根（`立项单.vN.json`，§7.1 L555 目录树同口径），「立项/」子目录从未存在。
- 裁决：落项目根 `影响清单.vN-vM.json`（如 `影响清单.v2-v3.json`）：① 与立项单同目录，列举/回溯简单；② 箭头 `→` 换 ASCII `-`，规避 Windows 文件系统与 resolveInside 沙箱/opencode 工具链 Unicode 文件名风险。不建 `立项/` 子目录（避免为单一文件造目录且与立项单分离）。形态差异记名，不回改设计书。

### D-004 · 三选一中「一键重生成」的本包语义拍板（2026-10-14 批准）

- 冲突：设计书语义是 commit 后平台执行重生成；但 STAGE 3–7 无代码（B-06），STAGE 1–2 亦无编排器，本包无法真正“一键”。
- 裁决：regenerate 与 mark 两类决策在 commit 中**都先挂脏**；commit 返回 `regenerate[]` 工作队列，showrunner 串行委派重生成、每个定稿后调 canvas.align 清脏推进版本。即“一键”=一次决策 + Agent 队列执行，平台不内置编排器。未生成节点不在清单（其首次定稿直接挂新版血缘）。自动编排器留待 STAGE 1–2 包或后续编排包。

### D-005 · 交互承载拍板：三选一走对话，不做 renderer 弹窗（2026-10-14 批准）

- 裁决：影响评估呈现与三选一由 showrunner 在对话中完成（与 feature-001 定案门同一承载模式）；renderer 本包只做被动标识（脏角标 / `vN ⚠️k` / 纯文本黄条），无按钮无 IPC。设计书面板草图待 renderer↔主进程通道包承接。理由：renderer 无 MCP 调用通道，弹窗需要新增整条 IPC 链，超出 B-03 缺口。

### D-006 · 分级映射与 kind/diagnosisSummary 归类拍板（2026-10-14 批准）

- high = premise.* / style.mainStyleId / style.catalogVersion / fiveElements.aspectRatio（默认 regenerate）；medium = episodeCount / episodeDuration / genre / tone / platforms / auxiliaryStyleId / **kind** / **diagnosisSummary**（默认 mark）；low 级别保留但现状零字段命中（立项模型无 L0；项目名在 .session.json）。
- catalogVersion 归 high：与 mainStyleId 成对，版本漂移即风格基线漂移（802 语义）。kind 归 medium：商业/纪念影响受众与基调表达但非叙事核心。diagnosisSummary 归 medium：诊断案例与提示词参考，不影响已生成叙事结构。

### D-007 · 脏态与既有 invalidated 正交、commit 画布单次写盘（2026-10-14 批准）

- dirty 不改 status（恒保持 done）、不灰显；invalidated（红/opacity-60/硬失效）语义不动，两态可共存于不同节点、互不转换。
- commit 内多节点挂脏 + brief 节点 upsert 合并为**一次** canvasStore persist（一次 canvas.json 归档），通过新增的画布批量变更入口实现；publish 共享主体改为返回节点 patch 由外层统一落画布。
- manifest 再版只推进 briefVersion/updatedAt，不追加 statusHistory（再版不是阶段推进事件）；v1 publish 同机制写 briefVersion=1，状态机推进仍只由 Agent 在 v1 调 manifest.advance。

## 二、实施记录（过渡）

- 2026-10-14：建包前调研完成（跨上下文两会话）——版本化立项链路（plan/diff/render-md/publish handler）、manifest 7 态与 parseManifest 容错、canvas upsert 整体替换语义、19 工具注册面、provider 白名单、showrunner/writer 纪律、renderer 版本 badge 与 invalidated 渲染点、静态契约测试（agent-profiles/mcp-pure-tools/runtime-*）、802 包五文件写法先例；测试基线核实 302/7/12 + typecheck 7。
- 2026-10-14：任务包 5 文件建立（需求规格 / 契约 / 设计说明 / 任务清单 / 本记录）。K1/K8 未批准前不触碰任何代码。
- 2026-10-14：K1+K8 联合卡口经 AskUserQuestion 四项全部选定推荐项获批（D-001 状态条即批文），T1→T9 一次授权。
- 2026-10-14：T1 [shared/types.ts](../../../shared/types.ts) 落地——`ProjectManifest.briefVersion: number | null`（未发布立项为 null）、`CanvasParentReference`/`CanvasDirty`、`CanvasNode.parentReference?/dirty?`，并更新两条 002 待办注释；RevisionSource/UnlockData 等未动。
- 2026-10-14：T2 [impact.ts](../../../electron/brief/impact.ts) 纯函数层落地——diffBrief 字段 Δ 提取、反向血缘追溯（parentReference.briefVersion 命中 + fields ∩ Δ）、high/medium 分级（D-006 映射表）、影响清单形状；T3 [store.ts](../../../electron/canvas/store.ts) 增血缘/脏字段保留与批量变更入口（D-007 单次写盘），[manifest.ts](../../../electron/project/manifest.ts)/[library.ts](../../../electron/project/library.ts) 接 briefVersion（新项目 createProject 初始化为 null，随首版 publish 落定为 1，再版只推进 briefVersion/updatedAt、不追加 statusHistory）。
- 2026-10-14：T4 [publish.ts](../../../electron/brief/publish.ts) 重构为共享主体 + 返回节点 patch（commit 复用），立项单 v1..vN 版本化双写边界逐字不变；[plan.ts](../../../electron/brief/plan.ts) 零改动。T5 [tools.ts](../../../electron/mcp/tools.ts) 注册第 20–22 号工具（19→22）：`brief.impact.assess`（只读，返回 changes/items/counts/latestPublishedAt）、`brief.impact.commit`（发布新版 + 影响清单 `影响清单.vN-vM.json` + 一次 canvas 写盘挂脏）、`canvas.align`（清脏/推进血缘版本）；canvas.update zod 开放 parentReference 入参；新增错误码 3 个（契约 §8）。
- 2026-10-14：T6 白名单三层同步——[provider.ts](../../../electron/runtime/provider.ts) showrunner 物理白名单 14→17；agent-profiles 静态白名单、mcp-pure-tools 22 工具枚举、runtime-client 放行用例、runtime-integration listAgents 清单四处静态契约同步；[brief-impact.test.ts](../../../src/test/brief-impact.test.ts) 23 例（纯函数追溯/分级/清单形状）、mcp-brief-impact-tools.test.ts 18 例（三工具信封、落盘、无项目/无旧版错误码）、canvas-store.test.ts 9 例（血缘保留/批量写）全绿；mcp-brief-tools.test.ts 8/8 零改动回归。
- 2026-10-14：T7 [showrunner.md](../../../resources/opencode/agents/showrunner.md) 再版纪律落地——frontmatter tools/permission 各 +3/+3；新增再版六步剧本（读最新版→用户改字段→impact.assess 呈现影响与三选一→按决策 commit/mark/cancel→regenerate 队列串行委派、每定稿 canvas.align）；血缘字段表（契约 §5）与脏读纪律（黄 ⚠️ 不灰显不阻断、旧版可读、v1..vN 永不覆盖、回滚=旧版内容作草案新发一版）；第 1/2 步 parentReference 声明要求；第 0 步括注修正（再版不调 manifest.advance）。
- 2026-10-14：T8 renderer 脏读 UI 落地（契约 §6，无新 IPC）——[CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx)：DIRTY_FIELD_LABELS 16 键中文标签 + dirtyTitle，节点头黄 ⚠ 角标（`data-dirty-badge`，title「基于 vN，与最新 vM 不一致：…」），视口左上黄条（`data-dirty-banner`，纯文本无按钮，避让拖拽气泡）；dirty 节点不灰显、status 保持 done，不与 invalidated 复用 opacity-60。[StageNavPanel.tsx](../../../src/studio/StageNavPanel.tsx)：STAGE 0 徽标三态（空 / `✓ vN` 绿 / `vN ⚠k` 黄，`data-stage-badge`），N 由画布自推导（见 R-002）。
- 2026-10-14：T8 测试走契约 §9.5「挂得住加轻断言」分支——canvas-board.test.tsx 原 18 例健康，新增 5 例（脏角标 title/文案、黄条逐字、干净画布无标识、StageNavPanel 三态），23/23 全绿；studio-flow 基线 10 failed 未扩大。
- 2026-10-14（**T9 全量验证结论**）：`npm run test:run` = **353 passed / 7 skipped / 12 failed**，对照包前基线 302/7/12：净增 51 passed、failed 零扩大（fs-sandbox ×1、architecture ×1、studio-flow ×10 逐文件分布与基线一致）；`npm run typecheck` = 7 条基线错误持平（dev-mock-api ×1、CanvasBoard L840 ×2、VisualCatalog ×4），本包净新增 typecheck 错误为 0（T6 两测试文件各 1 处已修复，见 R-003）；`tsc -b tsconfig.node.json` 与 `tsc -p tsconfig.preload.json` 零错误。runtime-integration.test.ts 套件加载期 `RequestInit ... AbortSignal` 失败系 HEAD 既有（git stash 同机复现，JSON reporter 核实该文件 failed 断言=0），不计入 12。
- 2026-10-14：T9 治理收尾——偏差清单 B-03 标 ✅ 并记名两处形态差异（§2 表行 + §3 路线图行）；features/README 002 行标 ✅（22 工具/三 UI 标识/清单文件名修正）；feature-001 R-003、feature-801 修订区交叉指针回填；本记录闭环。

## 三、修订记录

### R-001 · publish.ts ENOENT 容错与成功信封口径（2026-10-14，实施期修订）

- 契约 §3 commit 链路需读「再版基线旧版立项单」；实施发现旧档/手工造档项目存在「manifest.briefVersion 指向但磁盘立项单缺失」场景，publish 共享主体在该场景原直接抛 ENOENT。修订：读旧版缺失按可评估的空基线容错（assess 返回 changes 全集提示、commit 不阻断），错误仅在项目目录本身不可用时经 `activeDir()` 映射既有错误码。契约 §3 落盘形状与版本号磁盘扫描（max+1，永不覆盖）口径不变。
- MCP 信封口径补记：工具成功一律 `isError:false`（含 assess 命中影响的正常情形），仅工具级失败（无激活项目/无旧版不可容错/非法版本）走 `isError:true` + 契约 §8 错误码；测试按此修正（早期用例曾误把带影响返回当失败）。
- 旧档测试用例（无 v1 立项单的历史项目）不经 publish 手工写档构造，避免容错路径与版本分配语义耦合。

### R-002 · renderer 版本号数据源取舍（2026-10-14，契约 §6.2 取舍补记）

- 设计书徽标语义的 N = 最新立项版本；renderer 无 manifest 订阅（无 IPC 通道，D-005 不新增）。取舍：StageNavPanel 从既有 canvas 订阅自推导——`parseV(brief 节点 meta.version)` 与全画布 `max(dirty.latestBriefVersion)` 取大；两者皆无时 STAGE 0 显示「空」。边界：项目存在已发布立项但画布 brief 节点缺失（旧档/损坏画布）时徽标退化，黄条/角标亦无数据源——与「renderer 只读画布」的既有架构一致，不修旧档；正常 publish 必 upsert brief 节点，主路径不受影响。StudioApp 传参面零改动。

### R-003 · T6 两处测试文件 typecheck 修复（2026-10-14）

- brief-impact.test.ts 的 canvasWith() 夹具缺 `Canvas.updatedAt` 必填字段（TS2741）：补固定时间戳常量。
- mcp-brief-impact-tools.test.ts assess medium 用例调用泛型缺 `changes` 键（工具实际返回 changes/items/counts，TS2339）：补泛型字段声明。
- 两处均为测试夹具/类型声明补全，生产代码与契约形状零改动；修复后全仓 typecheck 回到精确基线 7 条。

### R-004 · 交叉指针与形态差异登记位置（2026-10-14）

- feature-001 变更记录 R-003（brief 工具族扩展 + publish ENOENT 容错 + 白名单 9→17）、feature-801 修订区（ProjectManifest 单字段 briefVersion 追加）已回填交叉指针。
- 设计书两处形态差异（影响清单弃用 `立项/` 前缀落项目根、文件名 `→` 换 ASCII `-`）记名于[偏差清单 B-03](../../设计现状与偏差清单.md)与 D-003，设计书原文不回改。
