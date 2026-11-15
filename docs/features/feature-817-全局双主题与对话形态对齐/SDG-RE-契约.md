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
