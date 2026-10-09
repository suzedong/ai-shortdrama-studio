# SDG-OD 设计说明 · feature-007 数据治理

> 版本：v1.0（2026-10-04）
> 范围：业务事实源 / 工作流状态 / 对话展示三层分离的架构设计，以及「清空对话」入口 UI。
> 视觉验收：本包 UI 变化仅一处——对话面板头部新增「清空对话」入口；其余为底层重构，界面表现须与现状一致（无视觉回归）。

## 1. 目标架构：三层分离

```
┌───────────────────────────────────────────────────────────────┐
│                        渲染层（React）                          │
│                                                                │
│   画布节点        确认门/变更链          对话面板                │
└───────┬────────────────┬───────────────────────┬──────────────┘
        │ 业务产物取数      │ 工作流状态取/写          │ 气泡/卡片展示
        ▼                ▼                       ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│ ① 业务产物层      │ │ ② 工作流状态层     │ │ ③ 对话展示层          │
│ （唯一事实源）    │ │                  │ │ （可清空/可丢失）     │
│                  │ │ manifest.json    │ │                      │
│ idea.json  (新)  │ │  workflowVersion │ │ chat.messages.json   │
│ diagnosis.json新 │ │  phase           │ │  text/进度/门/动作     │
│ brief.json       │ │  nodes[10]       │ │  产物卡片(展示副本)   │
│ 故事背景档案.md   │ │  pendingGate...  │ │                      │
│ 剧本/*.json      │ │  activeUnlock    │ │                      │
│ 分镜/shotlist    │ │  activeDraft     │ │                      │
└──────────────────┘  └──────────────────┘ └──────────────────────┘
        │                  │                       │
        └──── 单写队列 enqueue（全部写操作串行化）─────┘
```

三条边界：

1. **业务产物只认文件**：② 工作流态引用节点，但节点 detail、产物字段一律从 ① 读；
2. **消息流降级为展示副本**：③ 中即便含完整产物，也不被恢复逻辑读取（迁移除外）；
3. **三层写入同队列**：杜绝跨文件读-改-写交错覆盖。

## 2. 与旧架构对比

| 维度 | 旧（feature-006 现状） | 新（feature-007） |
| :-- | :-- | :-- |
| 业务产物事实源 | 消息流优先、定稿文件兜底（双源） | 定稿文件唯一事实源（单源） |
| 工作流运行态 | 仅靠 replayMessages 折叠消息 | manifest WorkflowState 快照 |
| idea / diagnosis | 无独立文件（清空即失，D-007 硬边界） | idea.json / diagnosis.json |
| replayMessages | 每次 hydrate 必调 | 仅存量迁移调用一次 |
| 清空对话 | 不支持 | 支持，业务无损 |

## 3. hydrate 数据流

```
currentSession()
      │ 有会话
      ▼
 Promise.all([loadWorkflow(), readFinalized()])
      │
      ├─ workflow != null ──► 正常路径：WorkflowState + Snapshot 装配
      │
      └─ workflow == null ──► 迁移路径：
              loadMessages → replayMessages（唯一一次）
              → saveIdea / saveDiagnosis 补文件
              → 装配首屏
              → saveWorkflow(workflowVersion:1) 落地
```

## 4. 「清空对话」UI 设计

### 4.1 入口

- 位置：对话面板头部（[ChatPanel.tsx](../../../src/components/ChatPanel.tsx) 现有「主控 Agent」标题行，`px-4 py-3 border-b` 容器内）；
- 形式：标题右侧一个低强调的文字/小图标按钮「清空对话」（`text-xs text-muted hover:text-bad`，垃圾桶图标 + 文案），与标题行同一基线、右对齐；
- `data-testid="chat-clear-btn"`。

### 4.2 可用性

- 满足契约 §7.4 前置（无 loading/门/修改/重做等待）时可点，否则 `disabled`（`opacity-40 cursor-not-allowed`），`title` 提示「请先处理进行中的门/生成/修改」。

### 4.3 二次确认

- 点击弹确认框：标题「清空对话」，正文「将删除全部对话气泡与未落定的门/修改，已定稿的创意、诊断、立项单及各产物不受影响。此操作不可撤销。」；按钮「取消」/「清空」（危险态主按钮）；
- `data-testid="chat-clear-confirm"`。

### 4.4 清空后

- 对话区回到空态占位文案（沿用现有空态）；
- 业务产物、节点 done/invalidated、已提交变更链保留；待处理门/重做/activeDraft 消失。

## 5. 视觉验收标准

1. 「清空对话」入口在对话头部右对齐、低强调，不抢夺主视觉；不可用时明显置灰；
2. 正常使用过程中（有产物、过门、阶段切换）画布与对话的视觉表现与 feature-006 完全一致——重构零视觉回归；
3. 清空对话后界面干净、无残留门卡/草稿 chip，节点 detail 正常显示定稿内容；
4. 查看器（feature-006）任意时点来源标签均显示独立定稿文件名，与对话是否清空无关。

## 6. 影响面与兼容性

- **改造（🟡）**：`replayMessages`（降为迁移用）、App hydrate（分层取数）、`session:read-finalized`（扩字段）、各状态变化点（追加 workflow 落盘）；
- **新增**：`src/lib/workflow.ts`（WorkflowState 镜像与 ReplayResult→WorkflowState 映射）、idea/diagnosis 读写、4 条 IPC；
- **沿用（🟢）**：单写队列、版本归档、各产物生产与 Agent 提示词、门禁判定；
- **兼容**：旧会话首次打开自动迁移；定稿文件与 manifest 均向后兼容（缺 workflowVersion 即按旧会话处理）。
