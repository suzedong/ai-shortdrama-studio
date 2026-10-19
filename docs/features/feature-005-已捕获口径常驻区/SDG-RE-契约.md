# SDG-RE-契约 · feature-005 「已捕获口径」常驻区

> **卡口声明（置顶）**：本包 **K1 触发**——`shared/types.ts` 增 4 个类型（§1 字段方案），**K8 触发**——3 新 MCP 工具（`shortdrama_capture.list/upsert/remove`，22→25）+ 3 新 IPC（`capture:list/upsert/remove`）+ 1 推送（`capture:changed`），本契约 §1/§2 即登记方案，经用户批准后实施。**K9 零触发**（零新依赖）。实施中一旦发现必须越界，**立即停手**、回写变更记录并呈报用户裁决。

## 1. 数据面契约（K1 登记：shared/types.ts 增 4 类型）

落盘：项目根 `已捕获口径.json`（与 `故事背景档案.md` 同级、沙箱白名单项目根内），覆盖式更新、不版本化。

```ts
// shared/types.ts 新增（K1）
export type CaptureSource = 'user' | 'infer'
export type CaptureStatus = 'pending' | 'confirmed'
export interface CapturedFact {
  id: string              // 'f1'/'f2'… 全库递增，删除不复用
  topic: string           // 开放主题词，trim 后非空；推荐词表（六要素 6 + 前提 5）不闭集校验
  value: string           // trim 后非空
  source: CaptureSource   // user=用户原话（须 quote 举证）；infer=Agent 推断
  status: CaptureStatus   // 缺省推导：user→confirmed、infer→pending；显式传入优先
  quote?: string          // source='user' 时逐字原句（B-15 来源回溯精神：user 须举证）
  updatedAt: string       // ISO 8601
}
export interface CaptureFile {
  schemaVersion: 1
  nextId?: number         // id 高水位：下一个待分配编号，单调不减；缺省 = facts max+1（D-002 方案 A）
  facts: CapturedFact[]   // 按 id 升序
}
```

| 规则 | 语义 |
|---|---|
| 文件不存在 | = 空库 `{schemaVersion:1, facts:[]}`，读取不报错；首次 upsert 初始化落盘 |
| 文件损坏（JSON parse 失败） | list/upsert/remove 均抛错（含路径），**不静默覆盖、不放行猜测**（对齐 feature-004 先例） |
| id 分配 | 新建取高水位 `nextId`（缺省 = 当前 facts max+1）分配 `f{n}` 并推进为 n+1 随文件持久化；删除的 id 不复用（高水位单调不减，跨重启持久于文件，D-002 方案 A） |
| topic 推荐词表 | 六要素 `genre/platforms/episodeDuration/episodeCount/tone/aspectRatio` + 前提 5 项 `leads/time/place/coreEvent/seasonBoundary` + 自由中文主题（如「人物关系」）；写进 showrunner 纪律与 UI 占位提示，**工具层不校验** |

## 2. 写读通道契约（K8 登记：3 MCP + 3 IPC + 1 推送，同一 store 底座）

`electron/capture/store.ts`（新）为唯一读写点：内存无缓存，读即磁盘；写经既有写队列 `enqueue` 串行；写成功后广播 `capture:changed`（载荷 = 全量 CaptureFile）。MCP 工具与 IPC handler 均为薄壳调 store——双通道同一数据模型同一追溯（用户裁决②、D-016）。

### 2.1 `capture.list`（MCP `shortdrama_capture.list`）/ `capture:list`（IPC）

无入参（当前项目）。返回 `CaptureFile` 全量。文件不存在 → 空库；损坏 → 抛错。

### 2.2 `capture.upsert`（MCP `shortdrama_capture.upsert`）/ `capture:upsert`（IPC）

入参 `{ id?, topic?, value?, source?, status?, quote? }`，返回更新后的 `CapturedFact` 全条：

| # | 规则 |
|---|---|
| U1 | 有 `id`：精确更新该条——`topic/value/source/status/quote` 按入参非 undefined 字段覆盖，`updatedAt` 刷新；id 不存在 → `CAPTURE_FACT_NOT_FOUND`，零写盘 |
| U2 | 无 `id`：`topic` 必填（trim 非空，否则 `INVALID_ARGUMENT`）；trim 后与既有条目精确相等 → 更新该条（同 U1 覆盖规则）；否则新建（id=max+1） |
| U3 | 新建缺省：`source` 缺省 = `'infer'`（推断须待确认，安全侧；`user` 必须显式标且带 `quote`，否则 `INVALID_ARGUMENT`）；`status` 缺省推导 `user→confirmed`/`infer→pending`；显式 `status` 优先（面板「确认」= `{id, status:'confirmed'}`） |
| U4 | `value` 新建必填、更新可缺省（不覆盖）；trim 空串 → `INVALID_ARGUMENT` 零写盘 |
| U5 | 任一路径写成功 → 广播 `capture:changed`（全量 CaptureFile） |

### 2.3 `capture.remove`（MCP `shortdrama_capture.remove`）/ `capture:remove`（IPC）

入参 `{ id: string }`，返回 `{ removed: true }`。id 不存在 → `CAPTURE_FACT_NOT_FOUND` 零写盘；成功 → 广播 `capture:changed`。

### 2.4 推送 `capture:changed`

载荷 = `CaptureFile` 全量。MCP 与 IPC 写入均触发（含同进程内双通道互见：面板直改后 Agent 下轮 list 即新值；Agent upsert 后面板即时刷新）。preload 订阅桥 `onCaptureChanged(cb)`，返回退订函数（对齐既有 `canvas:changed` 订阅模式）。

### 2.5 错误码

| 码 | 触发 |
|---|---|
| `CAPTURE_FACT_NOT_FOUND` | upsert/remove 的 id 不存在 |
| `INVALID_ARGUMENT` | topic/value trim 空、source='user' 无 quote（复用既有码） |
| 原始解析错误（含路径） | 文件损坏，不包装、不静默 |

## 3. renderer 契约

### 3.1 CaptureBar（新组件，`src/studio/CaptureBar.tsx`）

挂点：StudioApp 右栏 aside 内、ChatComposer 上方（对话区顶部常驻条，用户裁决③）；宽度随 aside chatWidth 体系。数据自拉（`capture:list`）+ 订阅 `capture:changed` 全量替换。

| # | 状态/动作 | 规则 |
|---|---|---|
| C1 | 收起态（默认，恒显一行） | 「已捕获口径 · N 条」；M>0 追加琥珀点「· M 待确认」；右侧展开/收起钮；空库显引导文案「从第一句话起持续累积」（§2.6.1） |
| C2 | 展开态 | 逐条一行：topic（粗体）+ value + 来源标签 + 操作钮；展开/收起状态组件内 state（默认收起） |
| C3 | 来源三色 | `user` → LabelTag 白底紫边「用户原话」；`infer`+`pending` → 琥珀「推断 · 待确认」；`infer`+`confirmed` → 紫「推断 · 已确认」（复用 B-34 LabelTag 三色语义） |
| C4 | 行内编辑 | 点「编辑」→ topic/value 变输入框 + 确认/取消；确认调 `capture:upsert({id, topic, value})`（系统直写，D-016）；取消零调用、还原只读 |
| C5 | 确认（仅 pending 条） | 调 `capture:upsert({id, status:'confirmed'})` |
| C6 | 删除 | 点「删除」→ 行内二次确认条 → 确认调 `capture:remove({id})`；取消零调用 |
| C7 | 失败 | 操作失败行底错误条显 message，不崩面板；list 失败（含损坏）显错误态条不重试刷屏 |

### 3.2 StudioApp 挂载

右栏 aside 内、ChatComposer 上方挂 `<CaptureBar />`（仅挂点改动；ChatComposer 零 diff）。项目未打开/无当前项目时不渲染（与既有右栏同生命周期）。

### 3.3 data-testid 凭据

| testid | 元素 |
|---|---|
| `capture-bar` | 常驻条容器 |
| `capture-bar-toggle` | 展开/收起钮 |
| `capture-bar-count` | 计数文案（N 条 · M 待确认） |
| `capture-empty` | 空态引导 |
| `capture-item` | 条目行（带 `data-fact-id`） |
| `capture-item-edit` / `capture-item-edit-save` / `capture-item-edit-cancel` | 编辑三件套 |
| `capture-item-confirm` | 待确认条的「确认」钮 |
| `capture-item-remove` / `capture-item-remove-confirm` | 删除与二次确认 |

## 4. 最小 diff 描述

- **新增（4）**：`electron/capture/store.ts`、`src/studio/CaptureBar.tsx`、`src/test/capture-store.test.ts`、`src/studio/capture-bar.test.tsx`；
- **修改（≤9）**：`shared/types.ts`（K1，+4 类型）、`electron/mcp/tools.ts`（+3 工具注册，22→25）、`electron/main.ts`（+3 handle + changed 广播挂点）、`electron/preload.ts`（+3 invoke 桥 + onCaptureChanged）、`src/global.d.ts`（DTO 镜像 + 订阅声明）、`src/studio/StudioApp.tsx`（CaptureBar 挂载）、`src/dev-mock-api.ts`（capture mock + 演示数据）、`resources/opencode/agents/showrunner.md`（L73/L95/L98 收窄修订 + 口径落盘纪律）、`docs/features/feature-001-立项模型重建/SDG-AI-变更记录.md`（R-006 回写）；
- **文档（4）**：本包 5 文件、`docs/features/README.md`（增 005 行，T8 翻 ✅）、`docs/设计现状与偏差清单.md`（B-38 登记，T8 翻 ✅）、`版本记录.md`（T8 增行）；
- **零 diff 红线**：`electron/brief/*` 全部、`electron/gate/*`、`electron/canvas/*`（节点模型不动）、`src/studio/ChatComposer.tsx`、`tailwind.config.js`、`package.json`、其余一切既有测试文件（只允许新增用例通过，不允许改既有断言）。

## 5. 测试契约

- 主进程（`src/test/capture-store.test.ts`，内存 tmpdir，写法先例 [brief-update.test.ts](../../../src/test/brief-update.test.ts)）：AC1–AC4 全覆盖——upsert 三路径/缺省推导/id 递增不复用、remove 两态、损坏抛错不覆盖、双通道同文件同写队列、changed 广播载荷全量、无文件空库；
- 组件（`src/studio/capture-bar.test.tsx`，@testing-library/react + window.api 内存 mock，写法先例 [brief-history.test.tsx](../../../src/studio/brief-history.test.tsx)）：AC5–AC6 全覆盖——收起计数/待确认点数/三色标签/行内编辑确认与取消/确认钮/删除二次确认/空态/恢复渲染；
- **回归红线**：`npx tsc --noEmit` 仅 3 条历史基线零新增；全量 **51 文件 564 passed / 0 failed / 1 skipped** 起步，passed 不减少、skip 不增、测试文件净增恰 2。

## 6. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| 字段方案实施中需调整（如增删字段、改落盘路径） | K1 方案变更 → 停手，回写变更记录呈报用户确认后再动 |
| 需要口径 → 六要素/前提字段的结构化映射（改 brief.plan） | 越出白名单 → 停手呈报（现状评估：不做，消费侧仅提示词层对齐） |
| 需要画布节点或门承载口径 | 违反 §2.6.8 → 停手呈报（现状评估：不做，用户裁决①已排除） |
| 需要口径历史版本/回滚 | 设计演进项 → 停手呈报（现状评估：不做，草稿覆盖式） |
| 需要新依赖 / 新动画 token | 触发 K9 或配置红线 → 停手呈报（现状评估：不需要） |
