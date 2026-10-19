# SDG-RE-契约 · feature-004 立项单历史与回滚

> **卡口声明（置顶）**：本包 **K8 触发**——新增 3 条 IPC（`brief:history` / `brief:version-read` / `brief:rollback`），本契约 §2 即登记方案，经用户批准后实施。**K1 零触发**（不改 `shared/types.ts`；DTO 落 window.api 类型镜像，同 feature-808 先例）；**K9 零触发**（零新依赖）。实施中一旦发现必须越界，**立即停手**、回写变更记录并呈报用户裁决。

## 1. 既有数据面（零改动，只 import 复用）

| 复用物 | 位置 | 本包用法 |
|---|---|---|
| `listBriefVersions(projectDir)` → `{ versions[{version,path,publishedAt,kind,approveBy}], latestVersion, warnings }` | [plan.ts L82-116](../../../electron/brief/plan.ts#L82-L116) | history 扫描底座 |
| `diffBrief(prev: ProjectBrief \| null, draft: BriefDraft)` → `BriefChange[]{field,from,to}` | [diff.ts L22](../../../electron/brief/diff.ts#L22) | diffToLatest 计算；ProjectBrief 结构兼容 BriefDraft（字段子集），整版直接传入 |
| `publishBriefFiles(projectDir, draft, approve)` → `PublishedBrief{version,jsonName,mdName,brief,changesFromPrevious,briefNode}` | [publish.ts L42](../../../electron/brief/publish.ts#L42) | 回滚发新版主体（版本号分配/防覆盖/双写/changesFromPrevious 全复用） |
| 写队列编排（enqueue 内 publish + 画布 upsert + manifest.briefVersion 写回） | [update.ts](../../../electron/brief/update.ts) | rollback.ts 复刻其编排，仅 draft 来源与 approve 不同 |
| 字段中文标签 `dirtyFieldLabel` | [CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx) | diff 摘要条复用（非导出则抽至共享位置，两消费方同 import） |

**零 diff 红线**：上述文件与 `shared/types.ts`、`electron/mcp/*`、`package.json`、`tailwind.config.js` 一律零改动。

## 2. IPC 契约（K8 登记：3 条新增）

### 2.1 `brief:history`（无入参，当前项目）

返回 `BriefHistoryResult`：

```ts
interface BriefHistoryItem {
  version: number
  path: string                          // 立项单.vN.json（项目根相对）
  publishedAt: string
  kind: 'commercial' | 'memorial'
  approveBy: 'gate' | 'verbal' | 'ui'
  changeCount: number                   // changesFromPrevious.length，首版 0
  note?: string                         // approve.note（回滚版含「回滚自 vK」）
}
interface BriefHistoryResult {
  versions: BriefHistoryItem[]          // 按 version 升序
  latestVersion: number | null
  warnings: string[]                    // 损坏文件跳过说明
}
```

无历史（未立项）→ `{ versions: [], latestVersion: null, warnings: [] }`，不报错。

### 2.2 `brief:version-read`（入参 `{ version: number }`）

返回 `{ brief: ProjectBrief, diffToLatest: BriefChange[] }`：

- `brief` = vK 全文（shared/types ProjectBrief 原样透传）；
- `diffToLatest = diffBrief(vK 内容, 最新版内容)`（from=vK 值，to=最新值）；vK 即最新 → `[]`；
- vK 不存在 → throw `{ code: 'BRIEF_VERSION_NOT_FOUND' }`；
- 最新版文件损坏 → throw 原始解析错误（不放行猜测）。

### 2.3 `brief:rollback`（入参 `{ version: number }`）

返回 `{ version: number, rolledBackFrom: number, changesFromPrevious: BriefChange[] }`（version 为新版号 N+1）。

主体行为（单次 enqueue 内）：

| 步骤 | 规则 |
|---|---|
| R1 | `listBriefVersions` 定位 vK；不存在 → throw `BRIEF_VERSION_NOT_FOUND`，零写盘 |
| R2 | vK = latestVersion → throw `BRIEF_ROLLBACK_LATEST`，零写盘 |
| R3 | 读 vK 全文，draft = `{ kind, fiveElements, premise, style, diagnosisSummary?, diagnosisDetail? }`（逐字段取自 vK） |
| R4 | `publishBriefFiles(dir, draft, { by: 'ui', note: \`回滚自 v${K}\` })` → 新版 v(N+1) json+md 双写、防覆盖、changesFromPrevious 自动算 |
| R5 | 画布 `step-0-brief` 节点 upsert（复用返回的 briefNode）、manifest.briefVersion=N+1 写回（编排复刻 update.ts） |

任何一步失败整体抛错，不留半态（写队列既有保证）。

## 3. renderer 契约

### 3.1 BriefHistoryView（新组件，`src/studio/BriefHistoryView.tsx`）

Props：`{ onClose: () => void }`（数据自拉，经 window.api 三桥；项目上下文由既有全局当前项目保证，与 updateBrief 同）。

| # | 状态/动作 | 规则 |
|---|---|---|
| V1 | 打开 | 拉 `brief:history`；≥2 版默认选中次新版 v(N-1)，1 版选中 v1；warnings 非空顶部提示条 |
| V2 | 选中 vK | 拉 `brief:version-read(vK)`；左栏渲染 vK 全文分节、右栏渲染最新版全文分节（分节渲染与 StudioViewer brief 视图同构精简版）；diffToLatest 命中字段行高亮（`data-testid="brief-history-diff-field"`） |
| V3 | 差异摘要条 | 顶部逐行「字段中文名（dirtyFieldLabel）：from → to」；diffToLatest 空 → 「该版本即当前最新」 |
| V4 | 回滚钮 | 仅 vK≠latestVersion 可用，否则禁用；点击 → 二次确认框（`data-testid="brief-history-rollback-confirm"`），文案含「将以 vK 的内容发布新立项单 v(N+1)，当前最新 vN 不会丢失」 |
| V5 | 确认回滚 | 调 `brief:rollback(vK)` → 成功：提示「已发布 v(N+1)（内容 = vK）」+ 重拉 history（新版置顶选中）；失败：错误条展示 message，不关闭视图 |
| V6 | 取消 | 关闭确认框，零 IPC 调用 |

### 3.2 StudioViewer 入口

brief 视图操作区新增「查看历史」按钮（`data-testid="brief-history-entry"`），点击以覆盖层/切换态挂载 BriefHistoryView；仅 kind='brief' 时渲染。

### 3.3 data-testid 凭据

| testid | 元素 |
|---|---|
| `brief-history-entry` | StudioViewer 入口按钮 |
| `brief-history-view` | 历史视图容器 |
| `brief-history-item` | 版本行（带 `data-version`） |
| `brief-history-diff-field` | 高亮差异字段行 |
| `brief-history-rollback` | 回滚按钮 |
| `brief-history-rollback-confirm` | 二次确认框 |

## 4. 最小 diff 描述

- **新增**：`electron/brief/history.ts`、`electron/brief/rollback.ts`、`src/studio/BriefHistoryView.tsx`、`src/test/brief-rollback.test.ts`、`src/studio/brief-history.test.tsx`；
- **修改**：`electron/main.ts`（+3 ipcMain.handle）、`electron/preload.ts`（+3 invoke 桥）、window.api 类型声明文件（+3 方法 + DTO 镜像）、`src/studio/StudioViewer.tsx`（入口按钮 + 视图挂载）、`src/dev-mock-api.ts`（+3 mock）、`dirtyFieldLabel` 若抽共享位置则 CanvasBoard.tsx 同改 import；
- **文档**：本包 5 文件；README 总表增行（T7 翻 ✅）；偏差清单登记 B-37（T7 翻 ✅）；版本记录 T7 增行；
- **零 diff 红线**：§1 所列复用文件、`shared/types.ts`、`electron/mcp/*`、其余一切既有测试文件（只允许新增用例通过，不允许改既有断言）。

## 5. 测试契约

- 主进程（`src/test/brief-rollback.test.ts`，内存 tmpdir，写法先例 [brief-update.test.ts](../../../src/test/brief-update.test.ts) / [brief.test.ts](../../../src/test/brief.test.ts)）：AC1–AC5 全覆盖，含双写校验、旧版文件零改动校验、违例零写盘校验；
- 组件（`src/studio/brief-history.test.tsx`，@testing-library/react + window.api 内存 mock，写法先例 [studio-viewer.test.tsx](../../../src/studio/studio-viewer.test.tsx)）：AC6–AC7 全覆盖；
- **回归红线**：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量 **49 文件 550 passed / 0 failed / 1 skipped** 起步，passed 不减少、skip 不增、测试文件净增恰 2。

## 6. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| DTO 必须落 `shared/types.ts`（如 renderer 与 electron 争用同一新类型且镜像不可行） | 触发 **K1** → 停手，回写变更记录呈报（现状评估：不需要，ProjectBrief/BriefChange 已在 shared 且形状不变） |
| 需要改 brief.* MCP 工具契约或门态防护 | 越出白名单 → 停手呈报（现状评估：不需要，本包走系统 IPC 通道，与 Agent 通道平行） |
| 需要回滚前强制影响评估确认（接 002 assess） | 设计演进项 → 停手呈报（现状评估：不做，脏读黄条已覆盖提示职责） |
| 需要新依赖 / 新动画 token | 触发 K9 或配置红线 → 停手呈报（现状评估：不需要） |
