# SDG-OD-设计说明 ｜ feature-011 影响评估面板与批量重生成

> 配套：[需求规格](./SDG-RE-需求规格.md)（背景 / AC / 决策点）· [契约](./SDG-RE-契约.md)（白名单 / 测试契约）· [任务清单](./SDG-RE-任务清单.md)
> 本文回答「怎么摆、怎么流、为什么这么摆」；决策点 D1-D5 以用户圈选为终态，本文按推荐项展开。

---

## 1. 落点架构

```
┌─ STAGE 0 卡①行内编辑（Stage0View，既有 D-017 通道）──────────────┐
│  确认再版 → window.api.updateBrief(patch)                       │
│           → BriefUpdateResult { changes, items, markedDirty }   │  ← 现状被丢弃（L349-372），本包消费
└──────────────┬──────────────────────────────────────────────────┘
               │ items.length > 0 时上报
               ▼
┌─ StudioApp（面板 state，RealignConfirm 同级挂载 L738-740 先例）─┐
│  ┌──────────── ImpactPanel（新建）───────────────────────────┐  │
│  │ ① 改动字段摘要区：changes 逐条（字段 + 旧→新 + 级别色）     │  │
│  │ ② 影响产物分组勾选列表：高优先级组 / 中优先级组             │  │
│  │    行 = ☑ 标题 · step · 受影响字段 · vN→vM                 │  │
│  │    默认勾选 = defaultAction（regenerate 预勾 / mark 不勾） │  │
│  │ ③ [一键重生成选中 (N)] [仅标记脏] [取消]                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────────┘
               │ 一键重生成选中：勾选集 → 批量模板消息（【产物重新对齐】前缀 + 清单）
               ▼
   handleSend（L318 既有）→ 808 promptAsync → showrunner R-008 纪律
               │  逐产物串行重生成 → canvas.align 清脏推进血缘（既有）
               ▼
   canvas.onChange 既有订阅广播 → 面板 / 脏读黄条自动消退（零新增推送）

┌─ 手动入口（查看器脏读黄条，StudioViewer L620-638 块内追加钮）────┐
│  [查看影响评估] → fileRead(dirty.impactReport)                  │
│  → 影响清单.vN-vM.json（ImpactReportFile）→ 归一 → 重开面板     │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 关键决策

| # | 决策 | 理由 |
| :-- | :-- | :-- |
| OD-1 | 面板挂 StudioApp 层而非 Stage0View 内 | 两个触发源（Stage0View 保存 / StudioViewer 黄条）分属不同子树；StudioApp 是两者的最近公共祖先且已有 confirmNode / viewerNode 弹层管理先例（L106-108 / L738-740），状态上提避免双实例 |
| OD-2 | 两入口数据归一纯函数（impact-select.ts） | BriefUpdateResult 与 ImpactReportFile 的 changes/items 同构但来源字段集不同（后者多 decision / committedAt）；归一函数屏蔽差异，组件只认一种视图模型，单测可纯函数覆盖（008/009 纯函数层先例） |
| OD-3 | 默认勾选直接映射 defaultAction，零新增分级逻辑 | impact.ts 的 severity / defaultAction 已由 HIGH_FIELDS / MEDIUM_FIELDS 词表确定性产出，设计书「高级别默认勾选」（L345）语义已被 defaultAction='regenerate' 完整承载；面板再写分级 = 重复面 + 漂移源 |
| OD-4 | 批量 = 单条聚合消息（推荐 D3-A） | 一条消息一次对话回合承载勾选清单，会话流决策留痕集中；showrunner R-008「核实脏态 → 串行委派重生成 → align 清脏」语义天然覆盖清单逐产物处理，纪律词表零扩展（showrunner.md 默认零 diff） |
| OD-5 | 勾选决策不落盘（推荐 D3 留痕-A） | impact.commit 的 decisions「恰好覆盖」校验是 Agent 通道专有写路径（tools.ts L675-678）；renderer 回写需新 IPC（K8）且会破坏该校验边界。模板消息本身在 opencode 会话持久化即为留痕，满足 §2.6.6「决策归用户」的可追溯性 |
| OD-6 | 「仅标记脏」与「取消」收敛为同效关闭 | D-017 终态下脏标记已于保存时落盘（decisions 恒 'mark'），面板无撤销语义（撤销走 feature-004 回滚既有通道）；保留三按钮是对齐设计书 L331-349 草图形态，语义在面板内文案注明，避免用户误以为「取消」能撤回挂脏 |
| OD-7 | 画布顶栏 banner 不加钮 | 002 既定 pointer-events-none 非阻断纯提醒形态（CanvasBoard L620-629）是刻意的创作不阻断设计；Stage0 DirtyBar 默认不加（保存后面板已自动弹，重复入口）。用户可在 D5 圈选推翻 |
| OD-8 | 面板非阻断 + 防误触关闭 | 与 RealignConfirm 对齐（007 契约 §3.2：无 Esc / 背景点击关闭语义按组件内注释先例实现——具体为仅按钮关闭或显式关闭控件）；不锁画布，用户可边对照画布边勾选 |
| OD-9 | 黄条新钮出现条件 = dirty.impactReport 非空 | 影响清单文件名为唯一回读钥匙；缺失（历史脏数据 / 手工改 canvas.json）时按钮不出现，天然降级 |

## 3. 与既有机制的数据流关系

| 机制 | 关系 | 说明 |
| :-- | :-- | :-- |
| 影响清单（002） | **只读消费** | impact.ts / update.ts / tools.ts 零 diff；面板是清单的第一个 renderer 消费者（此前仅 Agent 通道 impact.commit 消费） |
| 脏读黄条（002/007/806） | **共存增强** | 查看器黄条追加一钮；漂移提醒（806 markedAt / driftReminderLabel）与一键对齐钮（007）零回归；画布顶栏 / Stage0 DirtyBar 默认零 diff |
| 定案门机制（001/807） | **无关** | 面板作用于「定案后变更」阶段，不触碰 0-final 门与 gate.decide 通道 |
| 会话链路（808） | **复用** | 批量发起 = handleSend 既有入口（L318 / L798），promptAsync / 会话绑定 / 事件归属语义零 diff |
| 单产物重对齐（007） | **复用不替代** | 黄条「一键对齐」钮保留（单产物即时动作）；面板批量与单产物两入口并存，均收敛于同一 showrunner 纪律与同一 align 清脏工具 |
| 历史回滚（004） | **互补** | 面板不管撤销；回滚触发的再版同样经 updateBrief→影响清单链路，面板机制自然适用（无需特判） |

## 4. 风险与边界

| 风险 / 边界 | 处置 |
| :-- | :-- |
| 批量生成耗时长、用户误以为卡死 | 面板点击即关闭并交付会话流，生成进度由既有会话气泡 / 流式呈现（808）；不做排队可视化（需求规格 §4.2-7 明示排除） |
| 批量消息抵达时部分产物脏态已变（用户并行操作） | showrunner R-008 纪律首步即「核实脏态」，已清脏产物由纪律层幂等跳过；canvas.align 本身无 dirty 幂等（tools.ts L833-835） |
| 影响清单文件被手改 / 删除致回读失败 | 黄条入口降级：面板内提示「影响清单读取失败」不崩溃，黄条其余元素不变（契约 T-⑧） |
| items 为空但 changes 非空（纯低级别字段改动） | 不自动弹面板（AC2）；低级别字段本就不入清单（impact.ts classifyField 既有语义），静默即正确 |
| 勾选态跨重开丢失 | 有意为之：勾选是即时决策非持久状态；重开面板按 defaultAction 重新预勾（语义一致可复现） |
| dev-mock 与主进程 fileRead 格式分支差异 | dev-mock 影响清单桩对齐主进程 read.ts 分支语义（.md→'md' / 其余 json，B-33 先例），mock 增补不触碰既有演示行为 |
| 会话流留痕的检索性弱于落盘 decision | 已在需求规格 §3.4 如实呈报；用户若要求落盘留痕 → D3 留痕-B → 触发 K8 另行呈报 |
