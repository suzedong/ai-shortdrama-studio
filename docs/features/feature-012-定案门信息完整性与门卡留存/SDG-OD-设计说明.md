# SDG-OD-设计说明 — feature-012 定案门信息完整性与门卡留存

> 本文件记录 012 的关键设计推演：再版新顺序时序、门卡三区信息架构、留存挂载方案对比。结论与契约.md 一致；若用户裁决偏离推荐方案，本文件随契约同步修订。

## 1. 再版定案流程新顺序（时序）

### 1.1 现状（顺序倒置，实证 showrunner.md L153-155）

```
agent 完成改动
  → ③ 调用 定案门，payload={before,after,rationale}，口头拍板   ← 用户拍板时不知影响
  → 门自动卸载（批准即卸卡，唯一挂载点消失）
  → ④ brief.impact.assess 呈报影响清单                       ← 呈报对象已不存在
  → ⑤ brief.impact.commit
```

用户「拍板」发生在影响信息呈报**之前**，与设计 §2.6.5 L255「改动摘要和影响清单同列展示供拍板」相悖。

### 1.2 目标（方案 B1）

```
agent 完成改动
  → ① brief.impact.assess（零写盘试算，产出影响清单）
  → ② 调用 定案门，payload={before,after,rationale,impactSummary}   ← 清单快照入门
  → ③ GateCardView pending 态同列渲染：改动区 | 影响清单区 |（findings 区按需）
  → ④ 用户看到完整信息 → 拍板
        批准 → ⑤ brief.impact.commit（服务端复算兜底，与快照比对）
        驳回 → 流程终止，门卡转 rejected 留存（806 既有语义）
  → ⑥ 批准后经 807 assertBriefPublishable 四信封码校验放行发布
```

### 1.3 时序设计要点

- **assess 先行不写入**：`brief.impact.assess` 纯试算（002 既有语义），先于门调用执行，无副作用；门 payload 中的 `impactSummary` 是该次试算结果的**快照**（含 `assessedAt`），commit 时服务端复算并与快照比对——双保险：展示快（拍板时无需等待）、落盘真（以复算为准）。
- **门即停顿点**：挂门后 agent 停手等用户（806 L107-108 纪律对再版同样适用）；commit 只在拍板批准后执行，保证「影响清单留底」（§2.6.7）只记录已确认结果。
- **首版兼容**：首版定案门不携带 `impactSummary`，渲染层缺键静默不渲染该区；流程上首版无 assess 环节，顺序不变。

## 2. 门卡信息架构（改动区 + 影响清单区 + findings 区）

### 2.1 三区布局（pending 与 approved 两态同构）

```
┌─ GateCardView ─────────────────────────────┐
│ 头部：门名 · 状态徽标（待拍板/已拍板·批准） │
├─ 改动区（既有）──────────────────────────  │
│ before → after + rationale                  │
├─ 影响清单区（012 新增，可缺省）──────────  │
│ data-gate-impact-summary                    │
│  ▸ {label} {action} ×{count}                │
│  ▸ …                                        │
│  assessedAt · 来源：brief.impact.assess     │
├─ findings 区（806 既有，可缺省）──────────  │
│ data-gate-harness-findings                  │
│  ▸ [code] message                           │
└─────────────────────────────────────────────┘
```

- **同列原则**：三区同属一张门卡，用户在拍板按钮同一视野内看到「改了什么（改动区）+ 牵连什么（影响清单区）+ 校验为何拦（findings 区）」，落实 §2.6.5「同列展示」。
- **条件渲染**：影响清单区与 findings 区均为「有数据才渲染」，三区互不耦合；首版门卡（无 impactSummary）与 806 前旧卡（无 harnessValidation）渲染形态不变。
- **两态同构**：approved 留存卡与 pending 确认卡同一组件同一布局，差异仅在头部状态徽标与无操作按钮——留存卡即「当时拍板所见」的忠实留底。

### 2.2 取数路径

- 影响清单区：`gate.payload.impactSummary`（契约 §1.1 形状），经 `impactSummaryOf(payload)` 安全解析（对齐既有 `harnessBlockersOf` 模式），非法形状返回 `null` 整区不渲染。
- findings 区：`gate.payload.harnessValidation`（806 既有，`harnessBlockersOf`，L38-43）。
- 两键共存互不影响；806 剥离逻辑（state 摘要剥离）不触碰 `impactSummary`。

## 3. approved 门卡留存挂载方案对比（D-c）

### 3.1 候选对比表

| 维度 | A. ChatMessage gate 快照 | B. Stage0View 放行（推荐） | C. 独立门历史面板 |
| :-- | :-- | :-- | :-- |
| 挂载位置 | 聊天记录内嵌门卡消息 | Stage 0 视图原确认位 | 新面板/抽屉 |
| 数据源 | ChatMessage 新增 gate 快照字段 | 既有 `state.gate0`（canvas 订阅） | 既有 canvas.gates |
| **shared/types.ts** | **须改 ChatMessage → 触 K1** | 不改 | 不改 |
| electron/ 主进程 | 可能须写消息落盘 | 零改动 | 零改动 |
| renderer diff | ChatMessage 渲染 + 生产者 | Stage0View 两处条件 + 挂载 | 新组件 + 入口 + 布局 |
| 回放链路 | history-replay 须映射新 kind | 无涉（回放本就不渲染门卡） | 无涉 |
| 与「原确认位留存」直觉 | 偏（门本在 Stage0 确认） | **正合** | 偏（另起一处） |
| 工作量 | 大 | **最小** | 中 |

### 3.2 推荐方案 B 的机理

- 现状唯一断点：Stage0View L193、L485 两处 `state.gate0.status !== 'approved'` 显式排除，导致 approved 门卡数据犹在（canvas.json `gates[]` 持久化，bridge.ts L68-70 终态禁重开保护）而无渲染。
- 方案 B 仅移除该排除条件并复用 `<GateCardView gate={state.gate0} />`：approved 态渲染（L71-108，含 findings 区）806 已实装并组件级测绿，012 新增的影响清单区同组件受益——一次放行，「改动+影响清单+findings」三区全部留存上屏。
- StudioApp L84 `pendingGate` 派生（`.find(g => g.status === 'pending')`）天然不含 approved，ChatComposer 确认门交互零影响；批准即卸卡（L367-378）只作用于 pending 挂载点，留存卡不受影响。
- **翻案闭环**：806 X 节 2026-10-28「approved 门卡 findings 上屏真机无挂载点……登记偏差继续」被本方案正面推翻——findings 随 approved 门卡经 Stage0View 上屏，806 组件级所见即真机所见。

### 3.3 方案 A/C 的保留价值

- 方案 A（聊天记录内嵌）适合未来「门历史随对话时间线回放」诉求，但须 K1 审议 ChatMessage 形状并解决回放映射，留待真有该诉求时另立包评估。
- 方案 C（独立面板）适合多门并行后的集中管理诉求，当前 Stage 0 单门场景属过度设计。

## 4. 与既有链路的相容性推演（回归零化的依据）

- **807 发布闸**：`assertBriefPublishable`（guard.ts L35+）只读 `gate0.status` 与 `payload.version`，不枚举 payload 其他键 → 增 `impactSummary` 键零影响；四信封码路径不变。
- **806 拦截链**：`CONSIST_GATE_PAYLOAD_VERSION` 只比版本；tools.ts L435-467 只读写 `harnessValidation` 键 → 增键零影响；approved 门卡上屏不改变拦截触发时机（拦截发生在工具调用期，非渲染期）。
- **002 影响评估**：assess 零写盘、commit 复算兜底既有；012 只是把 assess 结果快照进门 payload 并前置调用时机，服务端逻辑零改动。
- **回放链路**：history-replay 只映射 text parts，门卡本不在回放渲染范围 → 方案 B 零涉回放。

## 5. D-016 归位判定（设计层结论）

影响清单的取数（assess）、快照（payload 增键）、渲染（三区）、留存（放行）均为规则可枚举的确定性操作 → 全部系统直做；AI 侧仅生产 `rationale` 文本与按新纪律调用既有工具。本包无开放式语义理解新场景，不引入任何 AI 新职责。
