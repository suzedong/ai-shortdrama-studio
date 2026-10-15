# feature-003 立项视图接线（Stage0View 真实化）· 任务清单

> 前置：本包 **K1/K8/K9 均不触发**（契约 §7），无卡口前置，用户评审批准任务包后即可从 T1 开工。
>
> 顺序约束：T1 先行（基线冻结 + 纯函数）；T2 重写视图依赖 T1；T3 StudioApp 接线与 T2 可并行；T4 测试与 T2/T3 并行跟进；T5 全量回归 + 真机目验；T6 治理收尾。

## 0. 上下文加载清单（工作围栏）

- 事实源：设计书 §2.6（L116–357）、§2.6.1（L120–143）、§2.6.8（L359–383）、§2.6.6（L249–299）；[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)、[设计说明](./SDG-OD-设计说明.md)。
- 既有事实：[shared/types.ts](../../../shared/types.ts) `ProjectBrief`（L110–153）、`CanvasNode/CanvasGate/Canvas`（L340–382）；[publish.ts](../../../electron/brief/publish.ts) brief 节点 upsert（id=`step-0-brief`、ref.path=`立项单.vN.json`、meta.version=`vN`）；[fs/read.ts](../../../electron/fs/read.ts) fileRead 错误码集；[showrunner.md](../../../resources/opencode/agents/showrunner.md) 第 0 步（背景档案写项目根）。
- 改动面白名单（全在 renderer + 测试 + 治理文档）：
  - `src/studio/Stage0View.tsx`（整体重写）
  - `src/studio/StudioApp.tsx`（**仅** L507–512 调用点；不动路由/订阅/布局）
  - `src/studio/stage0/`（新目录；select.ts + 视情况 useBriefDocuments.ts，最少文件数）
  - `src/studio/stage0-view.test.tsx`（新测试套件）
  - 治理：`docs/features/README.md`、`docs/设计现状与偏差清单.md`、`版本记录.md`
- 红线（契约 §7 越界即停）：
  - `shared/types.ts`、`electron/**`（含 preload/main/fs/brief/canvas）、`src/global.d.ts`、`resources/opencode/**`、`package.json`/lock 零 diff；
  - 不新增 IPC 频道、不新增 npm 依赖、不引入 zod（解析走最小形状校验）；
  - 不动顶栏 pill / StageNavPanel 路由、不动 dev-mock-api.ts 夹具、不碰其他 centerView 分支；
  - 审批/驳回/再版/对齐/回滚等**写动作**不进中栏；
  - 不做需求 §4.2 排除项（常驻口径区/diff 视图/回滚 UI/弹窗/风格名称解析/诊断明细回填）。

### ✅ T1 · 基线实测冻结 + 视图模型纯函数（select.ts）

- **实测冻结（2026-10-15，已回填）**：`npm run typecheck` 退出码 2，仅 2 条历史基线错误 canvas-zoom.test.tsx L13/L90（同日画布缩放修复包存量，非本包文件）；`npm run test:run` = **39 文件 405 passed / 1 skipped / 0 failed**（skip=T8-4 需 ARK Key）；node/preload 双工程 tsc 退出码 0。
- 开工第一件事：实测记录基线（回填本清单与设计说明 §6）——`npm run typecheck` 错误数与明细；`npm run test:run` 的 passed/skipped/failed 与文件数（参考点：2026-10-15 405 passed / 1 skipped / 39 文件，以实测为准）。
- 新建 `src/studio/stage0/select.ts`：`Stage0State` 形状 + `selectStage0State`（契约 §2 六条规则）+ `parseBriefJson`（契约 §3）+ 中文字段标签常量（六要素/premise 五行/dirty 字段中文名，与 feature-002 脏角标既有标签同源，编码时 grep 复用，避免两份翻译）。
- 完成标准：纯文件零 `window`/fs/electron/Date 引用；typecheck 不新增错误；纯函数用例随 T4 落（本步先保证编译）。

### ✅ T2 · 重写 Stage0View（真实只读视图）

- 删除：全部假数据常量（安妮的夏天/选题诊断假文/前提假文）、`demoGate` state、演示控制条（随机假数据/模拟定案/强制门/模拟推进）、旧 `briefVer` props。
- 新签名：`{ canvas, projectTitle, onBackToDag }`（契约 §4.1）。
- 实现：empty / loading / brief-error / published 四态；门镜像条、脏读黄条（无按钮）、双卡字段映射、风格行、定案区、版本区、背景档案折叠（`<pre>` 原文、NOT_FOUND 不渲染）；**门 pending 且 phase=empty 时**（门已提交待批但节点未 upsert 的窗口），空态主文案切换为「立项单已定稿待你批准，在右栏完成定案」并渲染门镜像条（OD §7 风险 1 的定稿口径）。
- 读取 hook：依赖 `[briefNode.ref.path]` 去重；立项单与背景档案分别 catch；序号防陈旧；无新依赖。
- 凭据：按契约 §4.2 表落 `data-stage0-*` 测试凭据（属性名以测试可读性为准，保持表中命名）。
- 完成标准：typecheck 文件自身零错误；不访问白名单外模块。

### ✅ T3 · StudioApp 调用点接线

- L507–512 改为 `<Stage0View canvas={canvas} projectTitle={projectTitle} onBackToDag={…} />`；删除 `n-brief` 查找与 `'v1'` fallback 整段。
- 全仓 grep `n-brief`：确认仅剩 dev-mock-api.ts（及其既有引用测试，如有），本包不动；确认 StudioApp 零残留。
- 完成标准：typecheck 不新增；既有 stage0 进出路由（顶栏/左栏/返回/进入 STAGE 1）行为不变。

### ✅ T4 · 测试套件（stage0-view.test.tsx）

- 按契约 §6.1/§6.2 落用例：
  - select：empty（无节点/仅 active 节点/n-brief 存在但无 step-0-brief）、published、版本解析（v3/非法）、gate0 取最后、gatePending 三态、dirtyCount/字段并集去重保序；
  - parse：合法 v1/v2、NOT_JSON、UNSUPPORTED_SHAPE（坏 schemaVersion/缺 premise/缺 approve）；
  - 组件：empty 凭据与假数据零出现；published v1 门批逐字段；口头拍板 quote；v2 变更条数 + 脏黄条；门 pending 叠加无按钮；rerender 门 approved 自动转定案态；立项单 NOT_FOUND/坏 JSON 错误态；loading 态；背景档案成功折叠 / NOT_FOUND 静默 / 其他错误弱化提示；返回按钮回调一次；StrictMode 双调用不重复出错。
- mock：复用仓内既有 `window.api` 测试桩模式（先 grep `canvas.onChange`/`fileRead` 的测试桩；无现成则在本套件建最小 fileRead 桩，不新建 mock 工具文件）。
- 完成标准：新套件全绿；不修改任何既有测试断言（如 StudioApp 相关快照/流式测试因 props 签名失败，仅做与新签名等价的最小夹具调整，并在变更记录记名）。

### ✅ T5 · 全量回归 + 真机目验

- **收尾实数（2026-10-15）**：全量 40 文件 431 passed / 1 skipped / 0 failed（净增 26 例/1 文件，skip 仍 T8-4）；typecheck 仅 2 条历史基线错误（canvas-zoom.test.tsx），本包 4 文件零错误；node/preload tsc 双 0；静态契约套件无感。真机目验 4 项全过（第二 Electron 实例 CDP 9223 许可退路；三空态/c3ze v1 逐值/STAGE 往返/rbp5 脏黄条），截图与 AC1–AC9 勾选见 SDG-AI-变更记录.md。

- `npm run typecheck`、`tsc -b tsconfig.node.json`、`tsc -p tsconfig.preload.json`（后两项预期零影响，作为越界检测跑一遍）；`npm run test:run` 全量。
- 红线：typecheck 不新增；passed 不减少、skipped/failed 不扩大（静态契约套件 agent-profiles/mcp-pure-tools/runtime-* 必须无感）。
- 真机目验（Playwright MCP，dev 起应用）：
  1. 新建项目 → 点 STAGE 0：空态、无演示条、无假数据；
  2. 右栏对话走一轮真实立项（或用既有测试项目/手造 `立项单.v1.json` + canvas 节点的方式二选一，优先真机对话路径；ARK Key 不可用时退化为文件夹具目验并在记录中说明）；
  3. v1 定案后中栏字段与 JSON 逐值、徽标、门批/口头文案；
  4. 进入 STAGE 1 后再回 STAGE 0：视图正常、返回画布正常；脏态若可构造（feature-002 再版链路）则验黄条。
- 完成标准：截图留存路径写入变更记录；AC1–AC9 逐条勾选。

### ✅ T6 · 治理收尾

- features/README.md：增 feature-003 行（编号/名称/状态/无卡口/纯 renderer/产出物）。
- 偏差清单：在 STAGE 0 相关段落把「Stage0View 静态壳、n-brief 错配」遗留登记为**由本包关闭**（若清单无对应条目，在实施补记/遗留段新增一行，不重写历史结论）。
- 版本记录.md：追加 2026-10 条目（背景=盘点发现静态壳展示假数据 + id 错配；改动面白名单；验证数据；卡口零触发声明）。
- 本包 SDG-AI-变更记录.md：回填实施记录（实际 typecheck/测试基线与结果、真机目验结论、AC 勾选、与契约的任何偏差及 D 编号决策）。
- 完成标准：五个任务包文件齐备且状态闭环；README/清单/版本记录三处留痕一致。

## 2. 产出物清单

| 类型 | 路径 |
|---|---|
| renderer 重写 | src/studio/Stage0View.tsx |
| renderer 小改 | src/studio/StudioApp.tsx（仅调用点） |
| 新纯函数 | src/studio/stage0/select.ts（+ 必要时同目录读取 hook） |
| 新测试 | src/studio/stage0-view.test.tsx |
| 治理 | docs/features/README.md、docs/设计现状与偏差清单.md、版本记录.md、本包 SDG-AI-变更记录.md |

预期总 diff：**2 改 + 2 新增（源码/测试）+ 4 文档**；electron/shared/preload/agent/package 零改动。

## 3. 不做（防止越界）

- 不做「已捕获口径」常驻区（候选态无通道，另立包）；不做版本列表/diff/回滚 UI；不做影响评估弹窗与一键对齐；不做中栏门按钮；不做字段编辑；
- 不新增 IPC/MCP/依赖；不引 zod/react-markdown；不做风格 ID→名称解析、不回填诊断明细；
- 不动 dev-mock-api 的 n-brief 夹具；不修旧档（有文件无节点）兼容；不做多路径探测背景档案；
- 不碰打包（B-11）、不代验 B-10；不做 STAGE 3–7 任何内容。
