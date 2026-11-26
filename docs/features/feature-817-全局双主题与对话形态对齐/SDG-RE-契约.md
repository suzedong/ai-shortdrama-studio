# feature-817 契约：全局双主题与对话形态对齐

> **版本**：v1.0（2026-11-15）｜**上游**：需求规格 v1.0 / OD v1.0

## 1. 可写范围与硬边界

可写：本任务包；根设计 §3.4 及人读镜像；feature-010 的 OptionCard C1；`index.html`、`tailwind.config.js`、`src/index.css`、`src/studio/{shell,canvas,stage0,chat,viewer,impact,style}` 必要生产/测试文件、`resources/opencode/agents/showrunner.md`、功能索引。

零 diff：`shared/types.ts`、`electron/preload.ts`、全部 IPC channel、runtime/history-replay 事件模型、`package.json` 依赖、项目 JSON。禁止新增 `chat.messages.json` 或任何消息持久化。

## 2. 主题契约

- 存储键逐字 `studio.theme`，值域 `light | dark`；默认/非法回退 `light`。
- `index.html` 在 stylesheet 前执行小脚本，只读取存储并切换 `<html>.dark`，不访问业务 API。
- `StudioApp` 顶栏按钮位于 `WindowControls` 前，二态图标，具 `aria-pressed` 和随目标动作变化的 `aria-label`。
- Tailwind `darkMode:'class'`；语义颜色必须读取 CSS 变量并支持 `/opacity`。
- 暗色通过根类与变量生效，portal 不需要额外状态；不得将主题写入项目数据或 Agent 指令。

## 3. 对话数据与组件契约

### 3.1 解析返回

```ts
interface ChatOption {
  num: string
  text: string
  styleId?: string
  recommended?: boolean
}
interface ChatOptionStep { current: number; total: number }
function parseChatOptions(text: string): {
  rest: string
  options?: ChatOption[]
  style?: boolean
  chips?: string[]
  step?: ChatOptionStep
  pending?: boolean
}
```

步骤行逐字匹配 `步骤：N/M`；推荐后缀逐字 `【推荐】`。仅纯文本 `【选项】` 开启。N/M 十进制正整数、N≤M；剥离元数据后选项文字非空。任何非法保持原有“整块不识别/原文”降级。

### 3.2 TaskDetails

- 输入只能是实际 `ToolView[]`；无工具不渲染。
- 连续工具段聚合，不跨 text/reasoning 段重排。
- summary 至少含“任务详情”、工具数及派生状态；运行中有 `animate-spin` 活跃图标。
- 原 `data-chat-tool`、`data-chat-tool-step`、`data-chat-tool-error`、`data-chat-tool-duration` 保留。

### 3.3 OptionCard

- props 沿用 `options/onPick/disabled/pickedNum`，新增可选 `step`；风格谱系继续经 `useStyleCatalog` 订阅，不新增 catalog prop。
- 单击选项仅更新本地 selected，不调用 `onPick`；下一步对所选调用 `onPick(num)`。
- 自定义输入与 selected 互斥；自定义下一步调用 `onPick(custom.trim())`。
- 仅 `!disabled` 显示活跃 footer；按钮 disabled 条件含 `disabled || submitting || !answer`。
- `onPick` 前同步置 submitting，父级 disabled 从 true 回 false 时释放，允许失败重试。
- `data-chat-option` 与 `data-picked` 保留；步骤容器使用 `data-chat-option-step`，推荐使用 `data-chat-option-recommended`。
- `ChipRow` props/单击发送不变；`GateCardView` 门接口不变。

### 3.4 流式与回放

只调整展示，不改 `useStudioStream`、`useStudioHistoryReplay`、turn id、sendRaw、quote/capture、gate pending/recovery。运行中至少一个 `animate-spin` 的既有 AC 继续成立。

## 4. showrunner 契约

第 0 步入口仍先问项目性质。新增开场只能说明“先确认项目性质与制作口径，再按既有阶段推进”，不得把未执行工作写为已完成。选项块仍位于消息末尾且至多一个；步骤/推荐只在有真实依据时输出。

## 5. 测试契约

- 新增 feature-817 主题/任务/选项测试，保留并更新原 chat-chips、chat-markdown、chat-liveness、gate、studio-flow 必要断言。
- 至少覆盖需求 AC1–AC11；使用 `onSend/onPick` 原文断言，不以快照代替行为。
- 最终运行 typecheck、全量 vitest、renderer/electron build；既有基线单独登记。
- 双主题目验覆盖欢迎、DAG、立项、流式/等待/拍板、谱系、设置/弹层、异常与重启恢复。

## 6. 变更登记

契约冻结后如变更主题存储键、元数据语法、发送语义、状态来源或共享边界，必须停止编码并 C1 记录原因、影响和决策。普通样式值修正作为实现细节登记，不改行为契约。

## 7. D-037 现行归并契约（2026-11-19）

### 7.1 活跃与滚动

| 项 | 展示 / 行为契约 |
| :-- | :-- |
| 活跃来源 | 仅使用既有 stream phase、真实 ToolView 状态与有序回合段；推理 → `stream-thinking`，工具 → `stream-tool`。无真实 running / streaming 来源不显示活跃动画。 |
| 非活跃 / 终态 | 非活跃段 `opacity:.45`；完成、失败、取消与恢复后移除活跃类，错误沿用真实错误展示。历史回放 `streaming=false` 时不伪造活跃。 |
| 跟随触发 | 首条工具请求，以及推理 / 正文追加、工具状态和结果变化；读取既有滚动容器，不新建事件。 |
| 跟随算法 | 仅贴底时向上平滑跟随，单次最大 120px；用户上滚 >2px 取消，手动接管期间不强制回底；历史装载不触发。 |
| 任务详情 | 折叠只影响工具明细，不隐藏运行标题的活跃态；连续工具聚合与真实事件顺序保持不变。 |

### 7.2 入场与 010 芯片视觉

1. 助手回合外壳入场 320ms；内部交错最多 4 个真实条目、间隔 40ms，只作用于视觉包装，不修改 `turnSegments`、ToolView、消息 id 或工具数据。
2. `prefers-reduced-motion: reduce` 时禁用呼吸、平滑跟随与交错延迟，内容立即可读；不得通过延迟动画制造假进度。
3. QH-C6 芯片沿用现有 tone / selected / disabled / title 数据；默认、hover、focus-visible、selected、disabled 在浅色和深色均有可区分形态，单行省略不得隐藏选中与禁用语义。
4. 芯片 onPick、ChipRow 单击直发、OptionCard、GateCard、输入清理和发送 payload 不变；013 负责立项视图交互，001 负责业务数据。
5. **无新接口**：不新增组件业务 props 之外的持久化字段，不新增 IPC / runtime event / DTO / shared/types / 消息存储；滚动与动画仅消费既有展示数据。

### 7.3 冲突与开放状态

- 809 早期“最多 48px 自动贴底”的历史正文被后续 120px 用户接管方案取代；当前以 120px、上滚 >2px 取消为准，归档原文不改。
- 817 原有 spinner 与 809 阶段动画并存：前者可作任务摘要图标，后者必须表达 thinking / tool 阶段，二者不得互相冒充数据来源。
- 双主题已通过不变；真实 AI runtime、OptionCard、任务详情与 Gate 现场仍未全闭环。本节为文档契约归并，不新写完成证据。

## 8. 运行中断展示适配（2026-11-26）

- 本包不声明新 IPC；`runtime.runs()` / `runtime.retryRun()` 的 DTO、错误码与写权属 feature-808 契约 §10。preload/global/runtime-types/dev mock 的同步是同一 K8 的镜像改动。
- `ChatItem` 可附 renderer 私有运行展示元数据；`ChatComposer` 增加可选 `onRetryRun` 回调与 Gate/活跃禁用输入。不得修改 `ReplayMessageRecord`、`ToolView.status` 或共享消息。
- interrupted 展示投影：仅 `pending | running → 已中断`；不更改 args/result/errorText，不重排 segments。孤儿运行使用独立 recovery item，不构造虚假用户正文。
- retry 只能来自恢复项显式按钮事件，禁止 mount/effect 自动调用；发送/重试接受后由 StudioApp 用真实 messageID 对账乐观气泡与流式轮次。
- 纯函数与组件测试覆盖中断投影、孤儿卡、OptionCard 零自动选择、Gate 阻断和单击一次；真实 Provider 验收另记，不以 dev-mock 或受控故障服务替代。
