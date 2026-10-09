# SDG-RE 需求规格 · feature-009 运行时界面接入（调试面板）

> 状态：**v1.0 待批准**
> 日期：2026-10-05
> 上游依赖：feature-008 Agent 运行时集成（已闭环；本 Feature 仅消费其 preload 暴露的 `window.api.runtime`，不改主进程 / IPC / DTO）

---

## 1. 背景

feature-008 落地了 opencode 运行时的进程生命周期、client 封装、SSE 事件投影与 12+2 个 IPC 通道，但界面侧零接入：renderer 无法在界面内启动 / 停止运行时，也无法观察会话与事件流。运行时目前对用户是"黑盒"，故障排查只能看主进程日志。

本 Feature 以**运行时调试面板**形态填补该缺口：面向开发 / 调试场景，提供运行时手动控制、会话管理、prompt 发送、事件流实时观察与 agent 信息展示。

## 2. 用户与场景

| # | 角色 | 场景 | 期望效果 |
|---|---|---|---|
| S1 | 开发者 | 应用启动后想确认 opencode 运行时是否就绪 | 打开调试面板即可看到四态（stopped/starting/running/error）、端口、版本、healthy；不打开面板时运行时不被订阅行为改变 |
| S2 | 开发者 | 运行时未启动，想手动拉起 | 点击「启动」，状态实时经 `runtime:status-changed` 推进 starting → running；拉起失败显示结构化错误（code + message） |
| S3 | 开发者 | 调试结束想释放进程 | 点击「停止」，状态回到 stopped；停止后再次业务操作不被静默惰性拉起（面板显式提示需重新启动） |
| S4 | 开发者 | 想验证某会话的 prompt 链路 | 创建会话（可带标题）→ 在会话内输入 prompt 异步发送 → 实时看到 `message.delta` / `message.part` / `tool.call` / `session.idle` / `runtime.error` 事件按序进入事件流 |
| S5 | 开发者 | prompt 跑飞或挂起 | 选中会话点击「中止」（abort），收到相应事件 / 错误；确认无用后点击「删除」移除会话 |
| S6 | 开发者 | 想核对安装的 agent 与工具集 | 面板展示 agent 列表（name/description/model/tools），确认 director 及其只读工具集 |

## 3. 功能需求

### F1 面板入口与承载

- F1.1 顶部 header 右侧（「自动」徽标所在区域）新增「运行时」入口按钮，点击切换调试面板的显隐。
- F1.2 调试面板为**右侧抽屉**：从窗口右缘滑入，覆盖于主界面之上（不挤压现有三栏布局），宽度固定，高度为 header 以下至 footer 以上的全部区域。
- F1.3 面板打开时显示四个分区（自上而下）：① 状态与控制；② 会话列表；③ Prompt 区；④ 事件流。agent 信息并入状态分区展示。
- F1.4 面板可关闭；关闭即**取消事件订阅**（`runtime.unsubscribe()`）并停止面板内一切轮询；面板的显隐状态在重渲染间保持，不要求跨重启持久化。

### F2 状态与控制（对应 S1~S3、S6）

- F2.1 挂载时（面板打开）调用 `runtime.status()` 获取当前状态一次，并通过 `runtime.onStatusChange` 订阅后续迁移；状态以徽标 + 文案展示四态。
- F2.2 running 时展示：端口、版本、healthy（健康 / 不健康）、startedAt；stopped / starting 时不可用字段显示「—」。
- F2.3 「启动」按钮调用 `runtime.start()`；「停止」按钮调用 `runtime.stop()`；请求进行中按钮禁用并显示忙碌态，防重复点击。
- F2.4 error 态展示错误体 `code` 与 `message`；任意 invoke 失败（promise reject 的 RuntimeErrorBody）均在状态分区内以错误条展示，不弹 alert、不写全局阻塞 UI。
- F2.5 running 时调用 `runtime.listAgents()` 展示 agent：name、description、model（`providerID/modelID`）、tools（逗号拼接）。调用失败显示「agent 列表加载失败」与重试，不影响其他分区。

### F3 会话列表（对应 S4、S5）

- F3.1 提供标题输入框（可空）与「新建会话」按钮，调用 `runtime.createSession(title)`；成功后刷新列表。
- F3.2 列表展示会话 id（截断显示，保留可辨识前后缀）、标题、createdAt；**当前选中会话**高亮，Prompt 区仅对选中会话可用。
- F3.3 刷新策略：面板打开时拉取一次；以下时机自动刷新——create 成功后、delete 成功后、收到 `session.idle` 事件后不强制刷新（idle 不改列表），`runtime.error` 不刷新。提供手动「刷新」按钮调用 `runtime.listSessions()`。
- F3.4 每个会话提供「中止」（`runtime.abortSession(id)`）与「删除」（`runtime.deleteSession(id)`）操作；操作进行中该行禁用；删除当前选中会话后清空选中态。
- F3.5 会话操作失败在会话分区显示错误条（错误体 message），不清空列表。

### F4 Prompt 区（对应 S4）

- F4.1 仅当存在选中会话且运行时 running 时可编辑；否则输入框禁用并显示占位提示（「请先启动运行时并选择会话」）。
- F4.2 提供 prompt 文本框与「异步发送」按钮，调用 `runtime.promptAsync({ sessionId, text })`；request 固定不传 `agent / model / format / tools`（本面板只做 director 默认链路观察；此约束写入契约）。
- F4.3 发送成功后清空输入框；发送失败（reject 或 result 语义不可用场景）在 Prompt 分区显示错误条。
- F4.4 发送进行中禁用发送按钮；允许连续发送（不做"idle 前禁发"的强约束，由运行时自行排队）。

### F5 事件流（对应 S4、S5）

- F5.1 面板打开时调用 `runtime.subscribe()`（**不传 sessionId**，观察全量），并通过 `runtime.onEvent` 收集事件；面板关闭时 `unsubscribe()` 并取消监听。
- F5.2 事件按到达顺序追加展示，每条显示：序号（本地递增）、时间 ts、事件类型标签、会话 / 消息 id（适用时）与内容摘要：
  - `runtime.connected`：version；
  - `message.delta`：delta 原文；
  - `message.part`：part.kind / tool / status / 文本片段；
  - `tool.call`：tool、status、argsPreview、resultPreview；
  - `session.idle`：sessionId；
  - `runtime.error`：error.code + message。
- F5.3 事件缓冲**上限 200 条**，超出丢弃最旧条目；提供「清空」按钮清除当前缓冲（不退订）。
- F5.4 提供类型筛选：一组复选框（六类），默认全选；取消某类则该类事件不渲染（仍占用缓冲与序号，保证顺序可追溯——实现上筛选只影响渲染）。
- F5.5 新事件到达时事件区自动滚到底部；用户向上滚动后不强制回吸（至少：提供「回到底部」按钮即可，不做复杂滚动探测亦可，验收以按钮存在为准）。
- F5.6 事件内容只做展示，**不做**二次打码（feature-008 投影层已完成打码）；但任何事件渲染前不得把整对象 stringify 到页面之外（不向 console 打印含事件体的日志）。

### F6 非目标（本期明确不做）

- ❌ 不接入现有 ChatPanel / 八步工作流，不改变现有业务消息的生成通道；
- ❌ 不支持在面板内选择 agent / model、结构化输出（format）、自定义 tools；
- ❌ 不做同步 prompt（`runtime.prompt`）入口；
- ❌ 不持久化面板状态、事件缓冲、会话列表到磁盘；
- ❌ 不修改主进程、preload、IPC 通道、runtime DTO、`shared/`；
- ❌ 不引入任何新依赖。

## 4. 验收标准（总览，细目见任务清单）

1. 入口按钮可开 / 关抽屉；抽屉打开不改变现有三栏布局尺寸。
2. 状态四态徽标与 `status()` / `onStatusChange` 数据一致；启动 / 停止按钮驱动状态迁移且有忙碌态。
3. error 态与 invoke 失败均显示结构化错误，页面不崩溃、无未捕获 Promise rejection。
4. 会话创建 / 列表 / 选中 / 中止 / 删除闭环可用，列表在规定时机刷新。
5. 选中会话 + running 时可异步发送 prompt，事件流按序收到六类事件并正确渲染摘要。
6. subscribe / unsubscribe 生命周期与抽屉显隐严格绑定。
7. 事件缓冲 200 上限、清空、类型筛选、回到底部行为可用。
8. 面板关闭后无残留订阅、无残留监听器、无后台轮询。
9. 全量测试通过且无回归；renderer typecheck 通过；build 通过。
