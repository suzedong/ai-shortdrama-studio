# SDG-RE-需求规格 · feature-004 立项单历史与回滚

> **包号**：feature-004（0xx STAGE 0 立项段）
> **业务名**：立项单历史与回滚（「查看历史」）
> **性质**：renderer 新视图 + 主进程薄桥（复用既有扫描/diff/发布主体）；**K8 触发**（新增 3 条 IPC，建包登记）；**K1 / K9 零触发**（不改 `shared/types.ts`、零新依赖）
> **事实源**：《短剧Agent平台设计.md》§2.6.5 末条（历史回溯）、§2.6.6/§2.6.7（「历史版本与回滚」）；[plan.ts](../../../electron/brief/plan.ts) `listBriefVersions`、[diff.ts](../../../electron/brief/diff.ts) `diffBrief`、[publish.ts](../../../electron/brief/publish.ts) `publishBriefFiles`
> **前置**：feature-001（ProjectBrief v2 版本化落盘 + brief.list）、feature-002（立项后变更 + 下游脏读）、feature-003（Stage0View / StudioViewer 接线）、feature-807（门态防护，本包不经 Agent 发布通道不受影响）
> **溯源标签**：[自研新增]（设计书明示交互，MiniMax Design 无对应物）
> **偏差登记**：B-37（盘点发现，本包登记并关闭）
> **日期**：2026-10-18

## 1. 背景

设计书两处明示、至今未落地：

- §2.6.5 定案卡三按钮 `[发布立项 v(N+1)] [再改改] [查看历史]`，末条「**历史回溯：所有历史版本（v1..vN）永久保留，支持 diff 视图与任意版本回滚（回滚 = 当前版本再发一版，内容 = 选中历史版）**」；
- §2.6.6/§2.6.7「历史版本与回滚：**"查看历史"按钮：左右两栏 diff 视图（vN vs v(N+1)）+ 任选历史版回滚**。回滚 = 新发一版 `立项单.v(N+1) = 立项单.vK 的内容`；保留全部历史」。

代码实证（2026-10-18 盘点）：

| # | 缺口 | 实证 |
|---|---|---|
| ① | `brief.list` 工具只暴露到 Agent（MCP）层，**UI 零消费**——用户无任何历史版本入口 | 全仓 grep：消费方仅测试与编排脚本 |
| ② | [StudioViewer](../../../src/studio/StudioViewer.tsx) 仅展示「相对上一版改动 · N 项」（相邻两版 `changesFromPrevious`），无历史列表、无任意版对比、无回滚 | StudioViewer.tsx L106/L188 |
| ③ | 「查看历史 / 版本回滚 / 已捕获口径」等字样 renderer 零匹配 | 全仓 grep |

**既有能力（已齐备，本包只接线不重建）**：版本化落盘 `立项单.vN.json/.md` 永不覆盖（feature-001）；`listBriefVersions` 磁盘扫描（升序 + 损坏跳过 warnings）；`diffBrief` 字段级 diff 纯函数；`publishBriefFiles` 发布主体（版本号分配 + 防覆盖 + 双写 + 画布节点 upsert 体）；回滚后发新版的下游脏读黄条机制（feature-002，`parentReference.briefVersion` 自动生效）。

**原则对齐（D-016 系统优先）**：列历史、读版本、字段 diff、回滚发新版均为**规则可枚举的确定性操作**——一律系统直做，不经 AI 对话。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 立项已定案 ≥1 版，想看历次定案 | 立项单查看器有「查看历史」入口；历史列表升序展示 v1..vN（版本 / 定案方式 / 定案时间 / 相对上一版变更数 / 当前徽标） |
| R2 | 创作者 | 想知道历史版 vK 与当前最新版差在哪 | 选中 vK → 左右两栏（vK 全文 / 最新 vN 全文）+ 差异字段高亮 + 顶部差异摘要（字段 旧值→新值） |
| R3 | 创作者 | 确认要回到 vK 的口径 | 回滚按钮（仅 vK≠最新可用）→ 二次确认 → 系统发布 v(N+1)，内容 = vK，approve.by='ui'、note 记「回滚自 vK」，全部历史保留 |
| R4 | 创作者 | 回滚后关心下游 | 画布 `step-0-brief` 指向 v(N+1)、manifest.briefVersion 推进、基于旧版的下游产物按 002 既有机制出脏读黄条 |

## 3. 核心机制

### 3.1 历史列表（brief:history）

磁盘扫描项目根 `立项单.vN.json`（复用 `listBriefVersions` 同一命名正则），逐版读全文提取元数据：version / path / publishedAt / kind / approveBy / changeCount（=`changesFromPrevious.length`，首版 0）/ note（回滚版标注）。损坏文件跳过并 warnings 注明。升序返回。

### 3.2 两栏 diff 视图（brief:version-read）

选中 vK：返回 vK 全文 + `diffToLatest = diffBrief(vK 内容, 最新版内容)`（from=vK 值，to=最新值）。renderer 左右两栏分节渲染两版全文，命中 diffToLatest 字段路径的分节/字段行高亮；顶部差异摘要条逐行列「字段中文名：旧值 → 新值」。vK=最新版时 diffToLatest 为空，显示「该版本即当前最新」。

### 3.3 回滚 = 发新版（brief:rollback）

设计原文语义：回滚**不是覆盖、不是删版**，而是以 vK 内容发布 v(N+1)。主体流程复刻 [update.ts](../../../electron/brief/update.ts) 的写队列编排：`读 vK 全文 → draft（kind/fiveElements/premise/style/diagnosis*）→ publishBriefFiles(approve={by:'ui', note:'回滚自 vK'}）→ 画布节点 upsert → manifest.briefVersion 写回`，单次 enqueue 内完成。`changesFromPrevious` 由发布主体自动算出（= diff(旧最新 vN, vK 内容)），回滚造成的下游影响由 002 脏读机制自动覆盖，**本包不做影响清单面板**。

边界：目标版不存在 → 拒（`BRIEF_VERSION_NOT_FOUND`）；目标版=最新版 → 拒（`BRIEF_ROLLBACK_LATEST`）；违例零写盘。

### 3.4 入口与确认

- **入口**：StudioViewer brief 视图操作区新增「查看历史」按钮（设计 §2.6.5 三按钮之一的落位）。对话内定案卡形态属门体系（feature-806 范畴），本包不动。
- **二次确认**：回滚为重动作，UI 弹确认框，文案明示「将以 vK 的内容发布新立项单 v(N+1)，当前最新 vN 不会丢失」；取消零调用。
- **回滚后联动**：canvas:changed 既有推送自动刷新画布与 StageNavPanel 徽标；历史视图刷新列表（新版带 note 标注）。

## 4. 范围

### 4.1 做

1. 主进程：`electron/brief/history.ts`（列版本元数据 + 读单版全文与 diffToLatest）、`electron/brief/rollback.ts`（回滚主体）两新文件；main.ts 登记 3 条 IPC；preload 3 桥 + window.api 类型镜像；
2. renderer：新建 `src/studio/BriefHistoryView.tsx`（历史列表 + 两栏 diff + 差异摘要 + 回滚确认流）；StudioViewer brief 视图加入口按钮；dev-mock-api 三 mock；
3. 单测：`src/test/brief-rollback.test.ts`（主进程）、`src/studio/brief-history.test.tsx`（组件）。

### 4.2 不做（显式排除）

- 不改 `shared/types.ts`（ProjectBrief 形状不动；DTO 经 window.api 类型镜像，同 808 先例）；
- 不改 `electron/brief/plan.ts / diff.ts / publish.ts / update.ts / render-md.ts`（只 import 复用）与 `electron/mcp/*`（brief.* 工具契约零变化，Agent 通道不受本包影响）；
- 不做任意两版互比（左栏恒为选中历史版、右栏恒为最新版，即设计「vN vs v(N+1)」语义；任意两版对比列为增强切片）；
- 不做 md 级文本 diff（以 JSON 字段 diff 为准；md 为镜像）；
- 不做影响清单面板与三选一动作（002 已落 brief.impact 工具链与脏读 UI）；
- 不动对话内门卡 / 定案卡形态（属 806 门体系）；
- 无新依赖、无新动画 token。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | `brief:history` 返回 v1..vN 升序元数据（version/path/publishedAt/kind/approveBy/changeCount/note），损坏文件跳过 + warnings | 单测 |
| AC2 | `brief:version-read(vK)` 返回 vK 全文 + diffToLatest（from=vK 值、to=最新值，字段路径与 diffBrief 一致）；vK=最新时 diffToLatest 为空 | 单测 |
| AC3 | `brief:rollback(vK)` 发布 v(N+1)：业务字段逐字段=vK；approve.by='ui' 且 note 含「回滚自 vK」；changesFromPrevious=diff(旧最新, vK 内容)；json+md 双写；v1..vN 文件零改动 | 单测 |
| AC4 | 回滚后 `step-0-brief` 画布节点 ref 指向 v(N+1) 且 meta.version 更新、manifest.briefVersion=N+1 | 单测 |
| AC5 | 边界：vK 不存在 → `BRIEF_VERSION_NOT_FOUND`；vK=最新 → `BRIEF_ROLLBACK_LATEST`；违例零写盘 | 单测 |
| AC6 | StudioViewer brief 视图「查看历史」入口 → 历史视图：列表渲染、选中 diff 高亮 + 差异摘要、选中版=最新时回滚钮禁用 | 组件单测 |
| AC7 | 回滚确认流：点回滚 → 二次确认文案（含「vN 不会丢失」）→ 确认调 IPC 并刷新出新版；取消零调用 | 组件单测 |
| AC8 | 回归红线：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量 **49 文件 550 passed / 0 failed / 1 skipped** 起步，passed 不减少、skip 不增、测试文件净增恰 2 | 全量回归 |
| AC9 | 真机目验：多版本项目 → 查看历史 → diff 高亮 → 回滚 → 新版落盘 + 画布/导航刷新 + 下游脏读黄条 | 真机 |
