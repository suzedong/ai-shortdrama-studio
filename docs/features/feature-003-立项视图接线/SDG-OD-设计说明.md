# feature-003 立项视图接线（Stage0View 真实化）· 设计说明

> 本篇只描述代码层面的结构决策与影响面；业务语义以[需求规格](./SDG-RE-需求规格.md)为准、接口形状以[契约](./SDG-RE-契约.md)为准。

## 1. 改动总览

纯 renderer 接线包。两个源文件改动 + 一个新目录：

```
src/studio/Stage0View.tsx              [重写] 静态原型壳 → 真实只读视图（四态）
src/studio/StudioApp.tsx               [小改] 调用点 props 改签名；删除 n-brief 表达式
src/studio/stage0/select.ts            [新]   纯函数 selectStage0State + parseBriefJson
src/studio/stage0-view.test.tsx        [新]   纯函数 + 组件测试（一个套件）
```

- 主进程 / preload / shared / Agent 纪律文件 / package.json：**零 diff**。
- 旧 Stage0View 的演示控制条（随机假数据/模拟定案/强制门/模拟推进）整段删除，不保留 feature flag。
- 视觉骨架沿用原型（顶部标题行 + 返回、双栏卡片区、定案/版本区），仅把写死值换成绑定值、把演示条换成状态区；配色全部复用既有 Tailwind token（ink/muted/line/canvas/ok/bad/warn 等），零新增图片/图标资产。

## 2. 组件内部结构

Stage0View 内部分层（同一文件内的小函数或 stage0/ 下展示子组件，编码取最简，不为一次使用的片段过度抽象）：

```
Stage0View({ canvas, projectTitle, onBackToDag })
  const state = useMemo(selectStage0State(canvas))
  if (state.phase === 'empty')  → <EmptyStage0/>（含返回按钮 + 对话引导）
  published:
    const { brief, bgMd, loadPhase } = useBriefDocuments(state.briefNode.ref.path)
    loading → 骨架
    error   → 诚实错误态（data-stage0-brief-error）
    ok      → <PublishedStage0 .../>
                顶部：项目名 + vN 徽标 + 返回
                门镜像条（gatePending 时）
                脏读黄条（dirtyCount>0 时，无按钮）
                双卡：诊断卡 / 前提卡（含背景档案折叠）
                定案区 + 版本区
```

### 2.1 数据读取 hook（组件内或 stage0/useBriefDocuments.ts）

- 输入：`refPath: string`。
- 两个 `fileRead` 可并行（`Promise.all` 形态，但**两个失败相互独立**：背景档案失败不影响立项单——故不共用一个 Promise.all 的 reject；取 `Promise.allSettled` 或分别 catch）。
- 竞态防护：递增序号 `seqRef`，effect 清理时 `seq += 1`，回包序号不符则丢弃（canvas 订阅高频推送下，refPath 相同**不重复读**：记录上次成功路径/内容，或用 useEffect 依赖 `[refPath]` 天然去重——优先最简的依赖去重，canvas 对象变化但 refPath 不变不触发 effect）。
- 立项单读取状态机：`loading → ok | brief-error`；背景档案读取状态：`absent（不渲染）| shown | failed（折叠区内弱化提示）`。
- fileRead 在测试中整体 mock（不碰真实 fs）；组件不直接 import electron 任何模块。

### 2.2 为何不在视图内订阅 canvas / gate

StudioApp 已订阅 canvas 并驱动 DAG、徽标、黄条等全部中栏内容。Stage0View 作为同一 `canvas` 的第二个消费者，props 下传即可：

- 无第二个 IPC 订阅、无取消订阅泄漏面；
- canvas 推送一次，DAG 与 stage0 视图同源同时更新（门裁决后自动转态靠这条，不需要本地刷新按钮）；
- `gate0` 从 `canvas.gates` 派生，不消费 StudioApp 的 `pendingGate`（该 state 语义是「当前全局待决门」，视图需要的是「0-final 门对象镜像」，两者可能不同，例如 STAGE 1+ 的门 pending 时中栏不应显示立项待决）。

## 3. 与既有代码的接触面（已逐一核实）

| 既有面 | 现状事实 | 本包影响 |
|---|---|---|
| StudioApp L507–512 | 传 `projectTitle/briefVer/onBackToDag`；briefVer 找 `n-brief`，真机恒 fallback `'v1'` | 改为传 `canvas`；删除错配表达式；删 `briefVer` props |
| Stage0View props/主体 | feature-025 假数据壳 + 演示控制条 | 整体重写；返回按钮行为保留 |
| canvas 订阅流 | StudioApp 既有 `canvas.get/onChange`（gate 变更也推 canvas） | 零改动，直接消费 |
| file:read 通道 | 沙箱内 .json/.md ≤1MB；根目录 `故事背景档案.md` 在允许范围 | 零改动，新增调用方 |
| GateCardView（ChatComposer 内） | stage0 布局下右栏照常挂载，pendingGate 照常推送 | 零改动；中栏不复制其按钮 |
| dev-mock-api.ts `n-brief` | 仅演示夹具引用 | **不动**；真实判定只认 step-0-brief（契约 §2） |
| VisualCatalog 18 条硬编码 | 非谱系运行时事实源 | 风格区不解析名称，只显 ID+版本，不引入跨组件依赖 |
| CanvasBoard 脏读黄条/角标 | feature-002 已落 | stage0 黄条独立实现但文案/色值同源；不抽公共组件（单点使用，避免过度设计） |
| 顶栏 pill / StageNavPanel 路由 | step 0 → setCenterView('stage0') | 零改动 |
| typecheck 基线 | T1 实测冻结：仅 2 条历史基线错误（canvas-zoom.test.tsx L13/L90，同日画布缩放修复包存量），2026-10-14 已清零过 dev-mock-api/CanvasBoard/VisualCatalog 存量 | 红线零新增；Stage0View 重写后文件自身零错误 |

## 4. 关键边界决策

1. **只投影已落盘事实**：对话进行中的候选口径（能提取但未拍板）不出现在中栏。这是本包与未来「已捕获口径常驻区」包的分界线，也是不新增会话态 IPC 的前提。
2. **审批单点在右栏**：中栏只镜像门状态。理由：裁决写通道（gate.decide）已由 GateCardView 持有，复制按钮会产生双入口的状态/埋点/快捷键分叉；设计书要求的是「就绪时给出一键定案」，右栏门卡在 stage0 布局下持续可见，满足该要求。
3. **背景档案预格式化、不引 md 渲染**：折叠区是原始事实的只读陈列；K9 零触发，且与 ChatComposer 的 Agent markdown 渲染语义不同（一个是人话原文、一个是模型输出）。
4. **版本事实以文件内 `brief.version` 为准**：节点 meta.version 只用于 select 的徽标初值；读文件成功后以文件值覆盖，避免 meta 与文件短暂不一致时显示旧号。
5. **不硬编码立项单文件名**：读 ref.path；背景档案文件名是 showrunner 固定产物名，允许硬编码常量（带注释指向 showrunner 第 0 步）。
6. **错误可见但不打扰**：立项单失败 = 主区错误态（事实缺失必须可见）；背景档案失败 = 局部降级（辅助产物）。

## 5. 测试落点

- 新套件 `src/studio/stage0-view.test.tsx`：契约 §6 全部用例；mock 策略为 `vi.mock('@/.../global')` 不适用（window.api 是全局），测试内直接 `(window as any).api = { fileRead: vi.fn(), ... }` 最小桩，或复用仓内既有 canvas 组件测试的 mock 方式（编码时先 grep 既有 `window.api` 测试桩并复用，避免新造 mock 体系）。
- StrictMode 下 effect 双调用：读取 hook 的序号防护天然覆盖；测试可包 StrictMode 验证不重复渲染错误内容（参考 [canvas-zoom.test.tsx](../../canvas-zoom.test.tsx) 的夹具写法）。
- 纯函数用例与组件用例同文件 describe 分组。
- 不新增 e2e/Playwright 脚本；真机目验列入任务清单 T6（手动，沿用画布修复包的 MCP 目验方式）。

## 6. 视觉/回归基线

- typecheck：开工实测并记录（任务清单 T1 填实数）；红线零新增，Stage0View 重写后文件自身零错误。
- 全量 vitest：2026-10-15 画布修复包后基线为 **39 文件 405 passed / 1 skipped**（skip=需 ARK Key 的 T8-4）；开工前 T1 复测确认，红线 passed 不减少、skipped/failed 不扩大。
- **收尾实测（2026-10-15，已闭环）**：T1 冻结基线与上一致；本包落地后 = **40 文件 431 passed / 1 skipped / 0 failed**（净增 26 例于 1 个新测试文件）。typecheck 仅余 2 条历史基线错误（canvas-zoom.test.tsx L13/L90，非本包文件），本包 4 文件自身零错误；node/preload 双工程 tsc 退出码 0。
- 静态契约测试（agent-profiles / mcp-pure-tools / runtime-* ）：本包零相关 diff，应全部无感通过；若失败即说明改动越界。

## 7. 风险与备选

| 风险 | 评估 | 处置 |
|---|---|---|
| 画布中 brief 节点在「门已提交待批、但 v1 尚未发布」时不存在/未 done | 事实如此（节点由发布链 upsert） | empty 态 + gatePending 叠加：empty 引导文案在 gatePending 时切换为「立项单已定稿待你批准，在右栏完成定案」——契约 §4.2 凭据增补点，编码按此处理（gate0 pending 优先显示门镜像条） |
| 旧项目有立项单文件但画布无节点（feature-002 §9.1 记录的旧档边界） | renderer 只读画布，不扫目录 | 仍显示 empty；属已知边界，本包不修旧档（不扫文件系统、不新增列举 IPC） |
| 背景档案在 `立项/` 子目录（设计书 §2.6.8 曾写 `立项/故事背景档案.md`）与 showrunner 实际写项目根不一致 | showrunner.md L96 实际写项目根 `故事背景档案.md` | 以 Agent 实际产物为准读根路径；NOT_FOUND 静默，不兼容多路径探测（探测属猜测，超出接线范围） |
| 高频 canvas 推送导致重复读文件 | useEffect 依赖 refPath 去重 | 序号防护双保险；不做缓存层 |
