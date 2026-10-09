# SDG-RE 契约 · feature-007 数据治理（消息流瘦身与业务事实源分离）

> 版本：v1.0（2026-10-04 起草）
> 实现必须严格匹配本契约；字段/通道/函数签名冲突按 L1 修代码。
> 卡口：本契约新增 IPC 通道（K8）、扩展 manifest.json 承载工作流快照（K4）、改造既有 replay/hydrate 职责（K3），须用户签字后实施。
> 复用：不改 `shared/types.ts`；新增 DTO 按 D-007 镜像约定在 electron 与 renderer 各定义一份结构相同的类型。

## 1. 数据基础：三类事实源划分

| 层 | 载体 | 职责 | 特征 |
| :-- | :-- | :-- | :-- |
| 业务产物层 | `idea.json` / `diagnosis.json` / `brief.json` / `故事背景档案.md` / `剧本/*.json` / `分镜/shotlist.json` | **业务产物唯一事实源** | 下游 Agent、查看器、画布统一从此取数 |
| 工作流状态层 | `manifest.json`（扩展） | 节点/门/阶段/变更链等运行态快照 | 每次状态变化经单写队列写回 |
| 对话展示层 | `chat.messages.json` | 对话气泡与产物卡片的展示 | 可清空、可丢失，不影响业务 |

消息流不再作为任何业务数据或工作流状态的事实源；`replayMessages` 仅在存量迁移时被调用（§7.2）。（2026-10-07 起经 feature-015 修订：正常路径 `pendingGate` 非空时亦调用一次作门重建兜底，见 feature-015 契约 §1）

## 2. DTO：WorkflowState（manifest 工作流快照）

字段结构（electron `electron/session.ts` 与 renderer `src/lib/workflow.ts` 各镜像一份，结构必须完全一致）：

```ts
export interface WorkflowState {
  workflowVersion: 1                       // 工作流快照版本；缺失=旧会话，触发迁移
  phase: 'initiating' | 'story' | 'script'
  nodes: Record<Stage, NodeStatus>         // 10 节点：idea/diagnosis/brief/background/story/outline/profiles/scenes/dialogue/storyboard
  pendingGate: GateId | null
  redoGate: '0-a' | '0-c' | null
  storyRedo: '1-a' | '1-b' | null
  scriptRedo: '2-a' | '2-b' | '2-c' | null
  activeUnlock: UnlockData | null
  activeDraft: RevisionSource | null
  feOverride: FiveElements | null
  saved: boolean
}
```

> 不含 `diagnosis / fiveElements / visualStyle / 各产物 / ideaText / showArchive`：产物类字段从定稿文件读取（§6），`showArchive` 为纯派生（§7.3）。

## 3. manifest.json 扩展契约

1. manifest 在既有 `{ status, createdAt, ... }` 基础上，读-改-写保留既有字段，并平铺承载 `WorkflowState` 的全部字段；
2. `status`（粗粒度状态机指针）与 WorkflowState 共存、互不覆盖：`saveStory/saveScript` 仍只推进 `status`；
3. `manifest.json` 永不归档（沿用现状）；
4. 初始化（`startSession`）时**不写** WorkflowState（`workflowVersion` 缺失）——首个工作流状态由 hydrate 迁移或首次状态变化写入。

## 4. idea.json / diagnosis.json 契约

### 4.1 idea.json

```ts
// 文件内容
{ "text": string }
```

- `idea:save` 写前把旧文件归档到同目录 `版本/idea.<stamp>.json`（复用 `archiveExisting`）；
- 写时机：① 创意提交、会话建立后立即写；② `idea` unlock 通过时以 `newIdea` 覆盖。

### 4.2 diagnosis.json

```ts
// 文件内容 = TopicDiagnosis（shared 类型，整体落盘）
TopicDiagnosis
```

- `diagnosis:save` 写前归档到 `版本/diagnosis.<stamp>.json`；
- 写时机：① 0-a 门通过时写当前诊断；② idea unlock 后的重诊在其 0-a 通过时覆盖。
- 未过门的诊断不落独立文件。

## 5. 新增 IPC 契约

### 5.1 `workflow:save`（renderer → electron）

```ts
window.api.saveWorkflow(state: WorkflowState): Promise<{ ok: true }>
```

- 经单写队列：读 manifest → 覆盖写入 WorkflowState 各字段（保留 `status/createdAt` 等非工作流字段）→ 写回；
- 无会话抛 `NO_SESSION`；载荷为内部可信边界，按结构写入，不做业务校验。

### 5.2 `workflow:load`（electron → renderer）

```ts
window.api.loadWorkflow(): Promise<WorkflowState | null>
```

- 读 manifest；`workflowVersion === 1` 返回完整 WorkflowState；
- `workflowVersion` 缺失或文件损坏 → 返回 `null`（renderer 据此走迁移，§7.2）；
- 无会话抛 `NO_SESSION`。

### 5.3 `idea:save`

```ts
window.api.saveIdea(text: string): Promise<{ ok: true; archived: string[] }>
```

- 经单写队列：归档旧 idea.json → 写新文件；无会话抛 `NO_SESSION`。

### 5.4 `diagnosis:save`

```ts
window.api.saveDiagnosis(data: TopicDiagnosis): Promise<{ ok: true; archived: string[] }>
```

- 经单写队列：归档旧 diagnosis.json → 写新文件；无会话抛 `NO_SESSION`。

### 5.5 `chat:clear`

```ts
window.api.clearChat(): Promise<{ ok: true; cleared: number }>
```

**electron 侧动作（单写队列内，读-改-写）**：

1. `requireDir()`（无会话抛 `NO_SESSION`）；
2. 耐久前置校验：manifest 中 `pendingGate / redoGate / storyRedo / scriptRedo / activeDraft` 必须全为 null，否则抛 `CHAT_CLEAR_BLOCKED`（`loading` 由 renderer 侧拦截，见 §7.4）；
3. 读取并记录当前消息条数 `cleared`，将 `chat.messages.json` 覆盖写为 `[]`；
4. manifest 工作流态：`pendingGate / redoGate / storyRedo / scriptRedo / activeDraft` 置 null；**保留** `phase / nodes / activeUnlock / feOverride / saved`；写回 manifest；
5. 返回 `{ ok: true, cleared }`。

**不改动**任何独立定稿产物文件（idea/diagnosis/brief/档案/剧本/分镜）。

## 6. `session:read-finalized` 扩展

`FinalizedSnapshot`（feature-006 D-007 双端镜像）新增两字段：

```ts
export interface FinalizedSnapshot {
  idea?: string                          // 新增：idea.json 的 text
  diagnosis?: TopicDiagnosis             // 新增：diagnosis.json 全文
  brief?: { fiveElements; visualStyle; conclusion }
  outline?: StoryOutline
  profiles?: CharacterProfile[]
  scenes?: SceneBreakdown
  dialogue?: DialogueScript
  storyboard?: ShotList
}
```

- 纯只读、零写入、单文件缺失/损坏只跳过该字段（沿用 §readFinalized 容错约定）；
- `diagnosis` 直接读 diagnosis.json 全文（对标案例表/洞察/钩子/合规齐备），不再依赖 brief 的 conclusion 兜底构造；
- 本扩展**反转 feature-006 D-007 的两条「不可回退硬边界」**（idea / 完整 diagnosis），须在 feature-006 变更记录加 ⛔ 反转块、在本包落新决策。

## 7. hydrate 编排契约

### 7.1 正常路径（新会话 / 已迁移会话）

1. `currentSession()`；无会话 → 结束 hydrate；
2. 并行 `loadWorkflow()` 与 `readFinalized()`；
3. workflow 非 null：以 WorkflowState 设置节点/门/阶段/变更链/feOverride/saved/activeDraft；以 FinalizedSnapshot 设置 ideaText/diagnosis/各产物；
4. 节点 done 补 detail、门卡重建等展示装配沿用现有 App 逻辑；产物字段一律以 snapshot 文件为准；（2026-10-07 起经 feature-015 修订：`pendingGate` 非空时六个 AI 产物取 replay 优先兜底，见 feature-015 契约 §2）
5. **查看器（resolveViewer）任意时点均以 FinalizedSnapshot 取数，sourceFiles 始终标独立定稿文件名，与消息流是否存在/是否清空无关**；消息流仅作对话气泡展示，不再作为查看器数据来源。

### 7.2 迁移路径（`loadWorkflow()` 返回 null）

1. `loadMessages()` → `replayMessages(msgs)` 折叠出 `ReplayResult`（**replay 唯一被调用处**）；
2. 持久化补齐：`r.ideaText` 非空 → `saveIdea(r.ideaText)`；`r.diagnosis` 非空 → `saveDiagnosis(r.diagnosis)`；
3. 按 §7.1 并行读 `readFinalized()`，并以 `ReplayResult` 装配首屏；
4. `saveWorkflow(ReplayResult → WorkflowState)`（映射：phase/nodes/pendingGate/redoGate/storyRedo/scriptRedo/activeUnlock/activeDraft/feOverride/saved + `workflowVersion:1`）；
5. 幂等：写入 `workflowVersion:1` 后再次打开走正常路径，不再折叠消息。

### 7.3 showArchive 纯派生

`showArchive` 不持久化，hydrate 与运行时统一按：

```ts
showArchive = nodes.background === 'active'
```

（0-c confirm 置 background active + 面板开；archive 锁定置 done + 面板关。）

### 7.4 「清空对话」入口与前置（renderer）

1. 仅当 `!loading && !gate && !activeDraft && !redoGate && !storyRedo && !scriptRedo && !pendingGate` 时入口可点；
2. 点击 → 二次确认（说明「将清空全部对话气泡，业务产物保留」）→ `clearChat()`；
3. 成功：`setMessages([])`，按 §7.1 以返回后的 workflow/snapshot 重新装配（门/重做/activeDraft 已重置）；
4. `CHAT_CLEAR_BLOCKED` → 提示先处理进行中事项。

## 8. 异常规则汇总

| code | 通道 | 触发 |
| :-- | :-- | :-- |
| `NO_SESSION` | 全部新通道 | 当前无项目会话 |
| `CHAT_CLEAR_BLOCKED` | chat:clear | 存在未落定的耐久交互态（pendingGate/redo/activeDraft） |
| 归档失败 | idea/diagnosis:save | 归档（rename/mkdir）抛错阻断写入，不做无备份覆盖（沿用 feature-005） |

## 9. 一致性不变量

1. 业务产物在任一时点以独立定稿文件为唯一事实，消息流中的同名数据仅为展示副本；
2. WorkflowState 写入与触发它的事件经同一单写队列串行化，不出现跨文件交错覆盖；
3. 清空对话后，系统状态可完全由「定稿文件 + manifest 工作流态」重建，不引用任何消息；
4. 迁移一次性、幂等，迁移结果与对同一消息流执行旧 replay 的首屏状态等价。
