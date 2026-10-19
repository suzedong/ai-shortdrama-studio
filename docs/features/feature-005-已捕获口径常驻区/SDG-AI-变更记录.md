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

**验证**：方案 A 落地后 typecheck 恰 3 基线零新增、T5 两文件 22/22 全绿（红灯用例转绿），详见 T5 节。

---

## T（任务执行）

### T1 基线实测冻结（2026-10-19）

**动作**：批准开工后先冻结回归基线——`npx tsc --noEmit` + `npx vitest run` 全量，作为 AC8 红线的对照原点。

**实测**：typecheck 恰 3 条历史基线，零其他报错——`src/studio/canvas-zoom.test.tsx(13,9) TS2322`、`src/studio/canvas-zoom.test.tsx(90,13) TS6133`、`src/test/runtime-client.test.ts(45,5) TS2741`；全量测试 **51 文件 564 passed / 0 failed / 1 skipped**。

**产物**：本节节录数字即基线冻结存证，后续 T5/T6 以此为对照（passed 不减少、skip 不增、测试文件净增恰 2）。

**偏差**：无。

**结论**：基线冻结成立，进入 T2。

### T2 数据面与主进程（2026-10-19）

**动作**：按契约 §1/§2 落数据面与主进程全链——① `shared/types.ts` +4 类型（K1：`CaptureSource` / `CaptureStatus` / `CapturedFact` / `CaptureFile`）；② 新建 `electron/capture/store.ts`（唯一读写点：读 / upsert U1–U5 / remove / 写队列 / 广播）；③ `electron/mcp/tools.ts` +3 工具（`shortdrama_capture.list/upsert/remove`，工具总数 22→25，K8）；④ `electron/main.ts` +3 handle（`capture:list/upsert/remove`）+ `capture:changed` 全窗口广播挂点；⑤ `electron/preload.ts` +3 桥 + `onCaptureChanged`；⑥ `src/global.d.ts` DTO 镜像。

**实测**：改后 `npx tsc --noEmit` 仍恰 3 条历史基线、零新增；全量测试仍 51 文件 564 passed / 0 failed / 1 skipped（本步不增测试，单测归 T5）。

**产物**：6 文件落盘如上；`已捕获口径.json` 运行时落项目根（`schemaVersion:1`），覆盖式更新不版本化。

**偏差**：无。

**结论**：数据面与主进程闭环成立（MCP/IPC 双薄壳同落 store 单点），进入 T3。

### T3 指令层（2026-10-19）

**动作**：① `resources/opencode/agents/showrunner.md` 收窄修订 8 处——frontmatter tools/permission 双区各 +3 行（`shortdrama_capture.list/upsert/remove`）；纪律 2 末句收窄（候选态不落盘的唯一例外是已捕获口径）；新增纪律 11「口径落盘纪律」（提取即 upsert / 来源标定 user 必带 quote、infer 缺省 pending / topic 稳定推荐词表 / 不建门不建画布节点）；第 0 步铁律收窄为「除『已捕获口径』外，候选态不落盘、不建门、不建画布节点」；step 2 改「立即经 upsert 落盘」；step 6 就绪自检 + step 7 来源回溯均加 `capture.list` 对照口径文件；L99「诊断与草案只在对话中呈现」按规格 §3.4 保留未动。② feature-001 变更记录 R-006 回写（四段式：铁律收窄的冲突/裁决/六处联动/边界注明/交叉指针）。

**实测**：联动改动后复跑 `npx vitest run src/test/agent-profiles.test.ts src/test/runtime-client.test.ts src/test/runtime-integration.test.ts`——**3 文件 43 passed / 1 skipped 全绿**；`npx tsc --noEmit` 仍恰 3 条历史基线、零新增。

**产物**：showrunner.md（8 处）、feature-001 变更记录 R-006、`electron/runtime/provider.ts`（`SHOWRUNNER_DECLARED_TOOLS` 17→20）、`src/test/agent-profiles.test.ts`（3 处）、`src/test/runtime-client.test.ts`（2 处）、`src/test/runtime-integration.test.ts`（排序清单 +3 物理名）。

**偏差（已呈报裁决）**：契约 §4 修改清单漏列 K8 运行时白名单——`electron/runtime/client.ts` L224 以 `SHOWRUNNER_DECLARED_TOOLS` 为兜底白名单、L308 校验请求级 tools，frontmatter 启用之外不同步补登则新 MCP 工具运行时被拦截（feature-801/802 同款补登先例）；且 `runtime-client.test.ts` 计数断言（17）与 agent-profiles 点号白名单必失败，与契约「既有测试文件不允许改既有断言」红线冲突。按 K-卡口停手呈报，**用户裁决（2026-10-19）：按先例补登（推荐）**——provider.ts 17→20 + 三处既有测试同步扩充，契约修改清单视作 +2 文件（provider.ts + 既有测试联动）。

**结论**：指令层与运行时装配对齐（20 物理工具全链放行），铁律收窄闭环成立，进入 T4 renderer。

### T4 renderer（2026-10-19）

**动作**：① 新建 `src/studio/CaptureBar.tsx`（C1–C7 全覆盖——收起态恒显一行含「N 条」计数 + M>0 琥珀待确认点 + 空库引导文案；展开逐条行；来源三色 user=白底紫边「用户原话」/ infer+pending=琥珀「推断 · 待确认」/ infer+confirmed=紫「推断 · 已确认」，复用 B-34 LabelTag 语义 token；行内编辑三件套单行互斥；仅 pending 条显确认钮；删除行内二次确认；操作失败行底错误条 + list 失败错误态条不重试；契约 §3.3 九个 testid 全落）。② `StudioApp.tsx` 右栏 aside 挂载（aside 改 `flex flex-col` + CaptureBar `shrink-0` + ChatComposer 外包 `min-h-0 flex-1` 分流高度，`canvas.projectId` 非空才渲染，ChatComposer.tsx 零 diff）。③ `src/dev-mock-api.ts` capture 四通道 mock（captureList / captureUpsert / captureRemove / onCaptureChanged）+ 5 条演示事实（genre / platforms / episodeCount / seasonBoundary / tone），upsert/remove 语义与 store.ts U1–U5 逐条对齐（trim 校验 / id 精确 / topic 匹配 / source·status 缺省推导 / user 必带 quote / id max+1 / 写后广播）。

**实测**：改后 `npx tsc --noEmit` 回到**恰 3 条历史基线、零新增**（canvas-zoom L13 TS2322 / L90 TS6133 / runtime-client L45 TS2741）。

**产物**：3 文件——CaptureBar.tsx（新建 255 行）、StudioApp.tsx（import + aside 挂载 2 处）、dev-mock-api.ts（类型导入 + 演示库段 + api 四通道 3 处）。

**偏差（过程排错，已当场处置，不扩散规格）**：① CaptureBar.tsx 行底错误条 `rowError?.id === f.id` 可选链不构成 null 收窄（TS18047），改 `rowError && rowError.id === f.id` 修复。② 首跑 typecheck 报 `shared/types` 无 Capture 导出成员（TS2305，dev-mock-api.ts L3 / CaptureBar.tsx L6）——根因：tsconfig.json `references → tsconfig.node.json`（composite + outDir `dist-electron`），非 -b 模式下 tsc 把 src 对 `shared/types` 的导入重定向到该项目的 declaration 输出，而 `dist-electron/shared/types.d.ts` 是 T2 之前的陈旧构建（grep 无 Capture）；处置：重跑 `npx tsc -p tsconfig.node.json` 刷新声明产物（构建产物非源文件，不改契约）后复跑归零。备查：T2/T3 时未触发是因当时无任何 src 下 .ts 源文件导入 Capture 类型。

**结论**：T4 renderer 闭环成立（组件契约全覆盖 + 零 diff 挂载 + dev-mock 全语义），进入 T5 单测。

### T5 单测（2026-10-19）

**动作**：按契约 §4 修改清单恰净增 2 测试文件——① `src/test/capture-store.test.ts`（12 用例，主进程先例夹具：`vi.hoisted` holder + `vi.mock('electron')` + mkdtemp 项目 + `writeSessionState`，覆盖契约 §5 store 清单：无文件空库 / U3 缺省推导与 id 递增 / user 无 quote 拒写 / U2 topic trim 匹配更新 / U1 id 精确部分覆盖与 NOT_FOUND / U4 静态校验零写盘 / remove 两态 / **id 递增不复用** / 损坏抛错含路径不覆盖 / 结构不符 / 并发三 upsert 同写队列全落盘 / subscribe 广播逐次全量）。② `src/studio/capture-bar.test.tsx`（10 用例，组件先例夹具：`window.api` 四桥内存 mock + 写后广播全量闭环，覆盖契约 §5 组件清单：收起计数与待确认点数 / 展开顺序与三色标签与 quote title / 空库引导 / 行内编辑确认与取消 / pending 确认转态 / 删除二次确认 / 操作失败行底错误条 / list 失败错误态不重试 / onCaptureChanged 推送全量替换）。

**实测**：① 首跑——组件 10/10 一次通过；store 11/12，红灯 1 条「id 递增不复用」（f1/f2 → 删 f2 → 新建实测得 f2，契约要求 f3），触发 D-002 停手呈报。② 用户裁决方案 A 落地后——重跑 `npx tsc -p tsconfig.node.json` 刷新声明（shared/types.ts 变更，T4 已记此纪律）→ `npx tsc --noEmit` **恰 3 条历史基线零新增** → `npx vitest run` 两文件 **22/22 全绿**（红灯转绿）。

**产物**：2 测试文件新建（12+10 用例）+ D-002 联动 4 文件（shared/types.ts / store.ts / dev-mock-api.ts / 契约 §1，明细见 D-002）。

**偏差（已呈报裁决）**：D-002——契约「id 删除不复用」与「无高水位字段」内部张力，测试忠实契约而红灯；停手呈报三方案，用户裁决方案 A（加高水位字段），本步内落地并复跑转绿。

**结论**：T5 闭环（恰净增 2 测试文件、22 用例全绿、契约 §5 清单全覆盖），进入 T6 全量回归。

### T6 全量回归（2026-10-19）

**动作**：`npx tsc --noEmit` + `npx vitest run` 全量，对照 T1 冻结基线验 AC8 红线。

**实测**：① 首跑红灯——53 文件中 4 文件 21 用例 failed（`mcp-pure-tools` 计数 1 + `studio-flow` 9 + `session-continue` 9 + `window-titlebar-integration` 2）。② 按用户裁决补登后复跑——typecheck **恰 3 条历史基线零新增**；全量 **53 文件 586 passed / 0 failed / 1 skipped**。AC8 红线全满足：passed 564→586（+22 = 净增 2 测试文件的 22 用例，未减少）、skip 1 不增、测试文件 51→53 净增恰 2。

**产物**：4 补登文件——`mcp-pure-tools.test.ts`（计数断言 22→25 + names 数组 +capture 三件套名 + 测试名同步）、`studio-flow.test.tsx` / `session-continue.test.tsx` / `window-titlebar-integration.test.tsx`（window.api mock 各 +`captureList` 空库 +`onCaptureChanged` 无推送两桥，既有断言语义零改动）。

**偏差（已呈报裁决）**：K8/T4 联动漏网两类——① T2 工具 22→25 未同步 `mcp-pure-tools` 计数断言（与 T3 白名单 17→20 同款的 K8 联动）；② T4 StudioApp 挂 CaptureBar 后三组件测试 mock 缺 capture 桥（`TypeError: window.api.captureList is not a function`，CaptureBar.tsx:35，真实 Electron 环境 preload 四桥齐全不触发，纯夹具缺口）。停手呈报，**用户裁决（2026-10-19）：按 T3 先例补登**——契约 §4 修改清单视作 +4 文件。

**结论**：T6 闭环（AC8 红线全满足），进入 T7 真机目验。

### T7 真机目验（2026-10-19）

**动作**：Chrome DevTools MCP 浏览器通道 localhost:5173 dev-mock（feature-004 先例），按 AC9 六步目验——对话提取 → 常驻条累积（琥珀待确认）→ 面板直改 → 对话纠正 → 确认转态 → 重开项目恢复。其中「对话纠正」步以 `evaluate_script` 调 `window.api.captureUpsert` 模拟 showrunner 对话提取后纠正（与 showrunner 经 MCP→store→广播同语义：dev-mock upsert 写后调 `broadcastDemoCapture()` 全量推送）。

**实测**（pageId=4，六步逐项）：
1. **常驻条累积（收起态）**：快照证常驻条恒显一行「已捕获口径 · 5 条 · 2 待确认」琥珀点 + 「展开 ▾」钮（C1 全覆盖）。
2. **展开三色**：点击展开 → 5 条逐行——genre「用户原话」白底紫边 / platforms「用户原话」/ episodeCount「推断 · 已确认」紫 / seasonBoundary「推断 · 待确认」琥珀 + 确认钮 / tone「推断 · 待确认」+ 确认钮（三色标签 + 确认钮仅 pending 条，C3/C5 符合）。
3. **面板直改**：tone 行点「编辑」→ 行内编辑三件套（topic/value 输入框 + 确认 + 取消）→ value 改「清新治愈 · 轻喜剧节奏 · 淡淡海盐味」→ 确认 → 行值即时更新、徽章仍「推断 · 待确认」、编辑态退出（直改变值不变状态，C4 符合）。
4. **对话纠正**：`captureUpsert({ topic: 'genre', value: '校园 / 悬疑 / 夏日', source: 'user', quote: '其实我想在恋爱里加点悬疑元素' })` → 返回 f1 原地更新（value 换新、status confirmed、updatedAt 2026-10-19T10:52:17Z）→ 快照证条数仍 5 未新增、genre 行即时显示新值（topic trim 匹配命中 + 广播即时刷新，U2 语义符合）。
5. **确认转态**：seasonBoundary 行点「确认」→ 标题「待确认 2→1」、该行徽章转「推断 · 已确认」紫、确认钮消失仅剩编辑/删除（tone 仍待确认带确认钮，C5 符合）。
6. **重开项目恢复**：`captureList()` 重读返回 5 条终态（f1 genre=校园/悬疑/夏日 user+confirmed+新 quote / f2 platforms / f3 episodeCount infer+confirmed / f4 seasonBoundary infer+**confirmed** updatedAt 10:52:37 / f5 tone=海盐味 infer+**pending**）——即 CaptureBar 挂载时 `captureList()` 拉取的精确数据，恢复渲染路径得证（C7 符合）。

**产物**：截图内联存证 ×2（第 2 步展开三色态、第 5 步确认转态后，按 feature-004 先例 MCP 内联返回未落盘）+ 快照 / captureUpsert / captureList 返回 JSON 证据链如上。

**偏差（dev-mock 边界，不扩散规格）**：dev-mock `openProject` 为桩不切项目、capture 库为模块级内存单例不按项目隔离——第 6 步点击「旧港往事」UI 零变化（banner 仍「安妮的夏天」），改以 `captureList()` 重读证恢复渲染路径（CaptureBar 挂载即 captureList 拉取，同源路径）；跨重启文件持久化（含 D-002 nextId 高水位持久）由 T5 store 测试「写→读回环 / id 递增不复用」用例覆盖，真实主进程 store→文件→广播链路不受影响。

**结论**：AC9 六步全绿，T7 闭环，进入 T8 治理收尾。

### T8 治理收尾（2026-10-19）

**动作**：① [features/README.md](../../../features/README.md) feature-005 行翻 ✅——状态 `🟡 在建（2026-10-19 建包）` → `✅ 已落地（2026-10-19，真机目验 + 53 文件 586 passed）`（对齐 feature-004 行格式）；② [设计现状与偏差清单.md](../../../设计现状与偏差清单.md) B-38 翻 ✅——状态 `🟡 处理中` → `✅ 已解决（2026-10-19）`，末列补落地闭环口径（D-002 nextId 高水位 + 22 用例全绿 + 586 passed + AC9 六步全过摘要）；③ [版本记录.md](../../../../版本记录.md) 2026-10 区块顶部增 2026-10-19 条目（背景与授权 / 实现 / D-002 / 验证 / 文档闭环五段，对齐 feature-004 条目格式）；④ 本节入账，变更记录闭环。

**实测**：三份治理文件编辑如上，diff 复核四处改动全部在档、无他处误伤。

**产物**：features/README.md、设计现状与偏差清单.md（B-38 行状态列 + 末列）、版本记录.md（2026-10 区块顶条目）三处联动 + 本节。

**偏差**：无。

**结论**：T8 闭环——feature-005 全包闭环（D-001 建包决策 / D-002 id 高水位 / T1–T8 全入账，X 节零修复；AC1–AC9 全满足）。

---

## X（修复）

（暂无）
