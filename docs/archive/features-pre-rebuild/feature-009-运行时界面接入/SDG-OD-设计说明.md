# SDG-OD 设计说明 · feature-009 运行时界面接入（调试面板）

> 版本：v1.0（2026-10-05）
> 设计依据：MiniMax Design 右侧调试 / 控制台形态；现有视觉 token（tailwind.config.js：violet #6C5CE7 / ink / muted / line / canvas / ok / warn / bad）。
> 无外部设计稿：本说明附文字线框，即视觉验收唯一基准。

## 1. 设计原则

1. **调试工具不是业务界面**：信息密度优先于留白，允许 11–12px 小字与紧凑行高；但不引入新字体 / 新色彩体系。
2. **覆盖不挤压**：抽屉浮于既有三栏之上，关闭后主界面零位移，避免布局抖动。
3. **状态一眼可读**：四态用「圆点 + 文字」，颜色复用 ok / warn / bad / muted，不新造状态色。
4. **操作可防呆**：所有异步操作有禁用态；副作用操作（删除 / 停止）与主操作（启动 / 发送）视觉分级。

## 2. 入口

| 项 | 规格 |
| :-- | :-- |
| 位置 | header 右侧操作区，「自动」徽标之前（不改变既有元素顺序，仅前插） |
| 形态 | 描边小按钮：`运行时` + 状态圆点（圆点颜色实时反映最近一次 status：首次渲染前为 muted） |
| 选中态 | 抽屉打开时按钮为 violet 描边 + violet-soft 底 |
| 拖拽区 | 入口位于 header `no-drag` 区域内，沿用现有容器，无需额外处理 |

## 3. 抽屉线框

```
┌─ 右侧抽屉（fixed，右缘贴边） ────────────────────────┐
│ top: 48px（header 高）  bottom: 32px（footer 高）      │
│ width: 420px · bg-white · border-l border-line         │
│ shadow: 左侧投阴影（shadow-card 量级，方向 -x）         │
│                                                        │
│ ┌ 标题行（h-11，border-b） ──────────────────────────┐ │
│ │ 运行时调试                                          │ │
│ │                            [运行时状态圆点+文字]  × │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌ ① 状态与控制（p-3，border-b） ─────────────────────┐ │
│ │ ● 运行中 · 健康            端口 4097 · v1.18.34    │ │
│ │ 启动时间 12:00:03                                   │ │
│ │ [ 启动 ]  [ 停止 ]                                   │ │
│ │ ── Agent ──────────────────────────────────────     │ │
│ │ director · 主控 Agent                                │ │
│ │ model: ark/ark-code-latest                           │ │
│ │ tools: glob, grep, read                              │ │
│ │ （错误条：bad 左竖条 + code/message + ×）            │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌ ② 会话（p-3，border-b） ───────────────────────────┐ │
│ │ [标题输入框............] [新建]        [刷新]       │ │
│ │ ┌ 行（选中：violet-soft 底）──────────────────────┐ │ │
│ │ │ ses_8f3a…b21c   t8-e2e        12:00:10  [中止][删]│ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌ ③ Prompt（p-3，border-b） ─────────────────────────┐ │
│ │ [文本域（3 行）.................................]   │ │
│ │ 已受理 msg_a1b2…（轻提示）            [ 异步发送 ]  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌ ④ 事件流（flex-1，min-h-0） ───────────────────────┐ │
│ │ 筛选 [✓connected][✓delta][✓part][✓tool][✓idle][✓err]│ │
│ │                                    [回到底部] [清空] │ │
│ │ ┌ 事件行（monospace 数字与 id）────────────────────┐│ │
│ │ │ #007 12:00:11  [文本增量]                         ││ │
│ │ │       你好，世界                                  ││ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ （溢出纵向滚动；行间距紧凑）                         │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

## 4. 尺寸与间距

| 项 | 值 |
| :-- | :-- |
| 抽屉宽 | 420px（固定；不响应窗口缩放；窗口宽 < 720 时左右留边从简——本期不做，允许超出） |
| 上下定位 | top 48px / bottom 32px（与现有 header h-12、footer h-8 对齐） |
| 分区 padding | 12px；分区之间 border-b border-line，无额外 margin |
| 标题行 | h-11，px-3，text-sm font-semibold |
| 会话行 | h-10，px-2.5，rounded-lg；行内操作按钮 text-xs |
| 事件行 | px-2.5 py-1.5，text-[11px]；偶数行不加斑马纹（保持简洁） |
| 圆角 | 按钮 8px（rounded-lg）；会话行 / 事件行 8px；错误条 8px |

## 5. 状态视觉

| 状态 | 圆点 | 文字 |
| :-- | :-- | :-- |
| stopped | bg-muted | 已停止 |
| starting | bg-warn（可加 animate-pulse） | 启动中 |
| running · healthy | bg-ok | 运行中 · 健康 |
| running · unhealthy | bg-warn | 运行中 · 不健康 |
| error | bg-bad | 错误 |

- 圆点尺寸 6px（w-1.5 h-1.5 rounded-full），入口按钮处同规格。
- 徽标不使用描边色块，仅圆点 + ink 文字；分区标题中的状态文字用 text-xs text-muted。

## 6. 按钮分级

| 级别 | 样式 | 用途 |
| :-- | :-- | :-- | :-- |
| 主操作 | `bg-ink text-white` hover:opacity-90 | 启动、异步发送 |
| 次操作 | `border border-line` hover:bg-canvas | 停止、刷新、清空、回到底部 |
| 危险操作 | text-bad + border-line（不填红底，避免调试面板过"重"） | 删除会话 |
| 微型行操作 | text-xs text-muted hover:text-ink，无边框 | 会话行中止 / 删除（删除项 hover:text-bad） |
| 禁用 | disabled:opacity-50 disabled:cursor-not-allowed | 全部按钮统一 |

## 7. 事件类型标签

| type | 标签文案 | 标签配色（底/字） |
| :-- | :-- | :-- |
| runtime.connected | 连接 | violet-soft / violet |
| message.delta | 文本增量 | ok 10% 底 / ok |
| message.part | 消息片段 | canvas 底 / ink（border-line 描边） |
| tool.call | 工具调用 | warn 12% 底 / warn |
| session.idle | 空闲 | muted 12% 底 / muted |
| runtime.error | 错误 | bad 10% 底 / bad |

- 标签 rounded-md px-1.5 py-0.5 text-[10px]；
- id 与 ts 使用等宽数字（`font-variant-numeric: tabular-nums`，Tailwind `tabular-nums`），不引入 monospace 字体族；
- detail 文本 `break-all`，超长单行截断（120 字符规则由契约纯函数保证）。

## 8. 错误条

- 容器：rounded-lg border-l-[3px] border-bad bg-bad/5 px-3 py-2 text-xs；
- 内容：`<code:code> message`，code 用 font-medium；
- 右侧 × 按钮 text-muted；
- 出现时位于所属分区底部，把分区内容向下撑开（不使用浮层 / toast，避免遮挡）。

## 9. 动效

| 项 | 规格 |
| :-- | :-- |
| 抽屉进场 | transform translateX(100%) → 0，200ms ease-out（不做淡入遮罩：抽屉无全屏遮罩，允许抽屉打开时操作主界面——调试观察场景需要并行操作） |
| 抽屉退场 | 反向 160ms ease-in；退场结束后卸载（open=false → null） |
| starting 圆点 | animate-pulse；其余无动画 |
| 事件行 | 无逐条入场动画（高频流场景避免性能浪费） |
| prefers-reduced-motion | 平滑动效全部取消（Tailwind 默认媒体查询覆盖，实现上使用 transition 类即可） |

说明：抽屉无遮罩、不模态，是有意决策——调试面板须允许用户同时操作画布以制造事件。

## 10. 视觉验收标准

1. 抽屉打开 / 关闭全过程主界面三栏尺寸无任何变化，无 reflow 跳动。
2. 四态圆点颜色与 §5 表一致；running 且 unhealthy 时圆点为 warn 而非 ok。
3. 分区之间只用 1px line 分隔，无卡片套卡片；面板内不出现 violet 实心大色块（仅标签 / 选中行使用 violet-soft）。
4. 会话选中行为 violet-soft 底、无描边；选中切换无残留高亮。
5. 事件类型标签六类配色齐全；200 条事件滚动无明显卡顿，事件行无横向溢出（detail break-all 生效）。
6. 错误条为左红竖条样式，不弹 alert / confirm（删除会话也不需要二次确认——调试场景高频操作，误删仅丢失调试会话，不涉及业务数据）。
7. 抽屉在 header 48px 以下、footer 32px 以上，不遮挡二者。
8. 所有文字使用既有字体族与字号阶（10 / 11 / 12 / 14px），不出现新字号。
