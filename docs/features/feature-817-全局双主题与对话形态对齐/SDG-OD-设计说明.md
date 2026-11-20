# feature-817 OD：全局双主题与对话形态对齐

> **版本**：v1.0（2026-11-15）

## D1 主题状态流

`index.html 首绘读取 localStorage → <html>.dark`；React 挂载后 `StudioApp.theme` 读取同一存储并通过 effect 同步 DOM/存储。顶栏按钮只更新该本地状态。无需 context：主题经 CSS 变量继承到整个工作台和 portal。

```text
太阳/月亮按钮 → StudioApp setTheme → documentElement.classList + localStorage
                                      ↓
                     Tailwind 语义令牌 / Markdown / 弹层 / 异常页
```

主题类型 `type StudioTheme = 'light' | 'dark'` 仅声明在 `StudioApp.tsx`；非法值集中归一为 `light`。

## D2 色板与迁移

| 令牌 | 浅色 | 深色 |
| :-- | :-- | :-- |
| win | #F7F8FA | #181A20 |
| canvas | #FAFAFB | #14161C |
| surface | #FFFFFF | #20232B |
| ink | #1A1A2E | #EDEFF5 |
| muted | #8E8EA0 | #989EAC |
| line | #E8E8EC | #373B46 |
| violet-soft | #F2EFFC | #332B4C |

Tailwind 使用 `rgb(var(--color-*) / <alpha-value>)` 保留透明度修饰符。表面 `bg-white` 归为 `bg-surface`，按钮 `text-white` 不动；状态色保留语义，只调整暗色表面和边框。图片/视频舞台可固定深色。

## D3 对话结构

保持 `StudioApp → useProjectChat → ChatComposer` 单向数据流。`ChatComposer` 内增加纯展示 `TaskDetails`，把连续 `kind:'tool'` 段打包；text/reasoning 相对顺序不变。历史 `tools` 作为一个真实工具组。

任务状态：

```text
has running → 进行中（标题 spinner）
else has error → 执行失败
else tools.length > 0 → 已完成
else 不渲染任务详情
```

“等待回答”只挂在活跃、未 disabled 的选项卡；pendingGate 沿用 GateCard 自身等待态。没有运行时来源时不显示阶段卡。

## D4 选项状态机

```text
idle → 选编号(selectedNum) / 输自定义(custom) → submitting → onSend
  ↑                    两者互斥                    │
  └──────── 发送失败且仍活跃、disabled true→false ┘
```

- `submitting` 是本地即时锁；父级 busy 继续作为最终禁用来源。
- 活跃卡才显示自定义与 footer；历史卡只显示只读选项和 picked。
- 关闭只切换本地 collapsed，并提供重新展开；不删除消息、不记录业务事实。
- ChipRow 和 GateCardView 不进入该状态机。

## D5 协议解析

纯文本选项块扩展示例：

```text
【选项】
步骤：1/3
1. 都市逆袭【推荐】
2. 都市甜宠
3. 悬疑推理
【/选项】
```

`ParsedOption` 增加 `recommended?: boolean`；解析结果增加 `step?: { current:number; total:number }`。仅开始块后的第一行可声明步骤；推荐标记仅允许在选项文字末尾。编号、连续性和块末尾规则沿用 B-35。风格块、追问块不识别上述元数据。

## D6 视觉方向

采用克制、专业、工具型极简：圆角 12–14px、细边框、低阴影、清晰字重层级。Agent 正文不变成大段聊天气泡；任务详情与回答卡是视觉锚点。深色只改变色板，不改变布局、组件层级、画布操作或动画语义。

## D7 风险与对策

- **全局改色遗漏**：用语义令牌覆盖所有生产目录，双主题逐页截图检查 portal/弹层。
- **选项旧测试假设单击直发**：只更新编号 OptionCard 测试；chips 原断言保留。
- **折叠导致流式动画消失**：运行状态提升到 TaskDetails summary。
- **协议假进度**：元数据可选且严格校验，showrunner 明确禁止臆造。
- **既有 profile CRLF 失败**：作为基线隔离，不顺带修复。

## D8 D-037 展示归并设计（2026-11-19）

### D8.1 活跃与跟随滚动

```text
808 提供有序回放 / 流式数据（streaming / ToolView / turnSegments）
  → 817 纯展示派生：thinking / tool / idle / error
  → 阶段类：stream-thinking（绿） / stream-tool（紫）
  → 非活跃 opacity .45；终态与恢复移除活跃类

首条工具请求或任一段变化
  → 检查贴底与“用户未接管”
  → 向上平滑跟随，delta ≤120px
  → 用户上滚 >2px：取消动画并交还滚动权
```

历史重载 `streaming=false`，只画真实记录，不运行活跃与自动跟随。动画不反写 808 数据，也不作为 Agent 运行成功证据。

### D8.2 入场与芯片形态

- 交错容器只读取真实有序段：外壳 320ms，内部最多 4 项、每项错开 40ms；减少动态偏好下直接呈现。禁止为凑动画缓存或重排工具段。
- QH-C6 芯片视觉令牌复用 D2 色板：surface / line / ink / muted 与 tone 状态共同形成默认、hover、focus-visible、selected、disabled；单行 ellipsis 与 title 提示并存。
- 视觉层不改 ChipRow 点击、013 立项视图行为、001 芯片数据、801 门态或 808 回放 DTO。

### D8.3 冲突和验收边界

- 809 的 48px 是历史快照，现行使用 120px + 用户接管；减少动态偏好的优先级高于所有入场 / 跟随动画。
- 任务详情 spinner 只表示摘要运行态，阶段颜色必须来自真实 phase / ToolView，不能由本地计时器伪造。
- 双主题现场通过保留；真实 AI runtime、OptionCard、真实任务详情与 Gate 现场仍未闭环。本 Change 无新接口，不新增实施或真机完成记录。
