# feature-817：MiniMax 对话形态对齐与全局双主题

## Context

用户要求按 MiniMax Design 截图开始设计对话界面。现有 `ChatComposer` 已具备真实消息流、流式回合、推理/工具折叠、选项卡、快捷 chips、自定义发送和确认门，但视觉仍偏普通气泡列表，缺少截图中的任务式层次与结构化选择体验；工作台目前也只有浅色样式。

已拍板范围：

- 采用**真实形态对齐**，复用现有消息、运行时和拍板链，不做静态假界面。
- 保留 feature-001 的“商业短剧 / 个人纪念”首问，不改写为截图中的题材首问。
- 深色只是主题之一；提供**整个工作台**浅色/深色切换，默认浅色并记住选择。
- 不伪造“需求分析已完成”“项目规划进行中”或“1/3”；任务状态来自真实流、工具与门态，步骤号和推荐标记仅在外层消息明确提供时显示。

## 1. 先冻结规格与契约

1. 更新 `短剧Agent平台设计.md` §3.4 及 `docs/design/短剧Agent平台设计.html` 镜像：补充全局浅色/深色主题、主题切换入口和 MiniMax 任务式对话形态；保留既有品牌紫与高密度专业工具布局。
2. 新建 `docs/features/feature-817-全局双主题与对话形态对齐/` 标准五文件（需求规格、OD、契约、变更记录、验收），登记截图来源、组件状态、协议扩展、双主题色板和逐项 AC；更新 `docs/features/README.md` 索引。
3. 以 C1 同步 feature-010 中“OptionCard 零 diff”的历史约束：编号选项卡改为“选择暂存 → 下一步发送”，快捷 `ChipRow` 仍保持原单击直发语义。
4. 明确边界：`shared/types.ts`、Electron IPC、消息持久化、运行时事件模型和依赖均不改，预计不触发 K1/K8/K9；新业务包按 K2 留痕。

## 2. 建立整个工作台的浅色/深色主题

1. 在 `StudioApp.tsx` 管理 `light | dark` UI 状态，顶栏右侧、窗口控制按钮前增加太阳/月亮切换按钮，提供 `aria-label`、`aria-pressed` 和可见焦点；默认浅色，使用 `localStorage['studio.theme']` 持久化，非法值回退浅色。
2. 在 `index.html` 首绘前恢复 `<html class="dark">`，避免重启后闪白；React 挂载后由 `StudioApp` 接管切换。主题不进入项目 JSON、Canvas、Agent 上下文或共享业务类型。
3. 在 `tailwind.config.js` 启用 class 暗色模式，将现有 `win/canvas/ink/muted/line/violet-soft` 等语义色改为 CSS 变量，并补充 `surface` 等必要表面令牌；保留品牌色和按钮 `text-white` 的固定语义。
4. 在 `src/index.css` 定义浅/深两套变量、`color-scheme`、背景点阵、滚动条、Markdown、焦点和阴影。深色采用低反射蓝灰表面与清晰层级，不做紫色渐变背景，不改变布局密度。
5. 覆盖 `shell/`、`canvas/`、`stage0/`、`chat/`、`viewer/`、`impact/`、`style/` 的生产组件：表面用途的 `bg-white` 归为 `bg-surface`，清理硬编码浅色文字、边框、菜单、弹层、toast、异常页和状态底色；图片、视频舞台及品牌缩略图可保留固定色。优先修改语义令牌，避免逐组件堆叠 `dark:` 补丁。

## 3. 对齐 MiniMax 任务式对话

1. 在 `ChatComposer.tsx` 内复用并调整现有 `AgentTurn`、`ToolRow`、`OptionCard` 和 `ChipRow`，不另建消息状态层：
   - Agent 开场与正文保持流式 Markdown；用户消息、Agent 身份、模型信息及现有发送/停止逻辑不变。
   - 将真实 `ToolView` 聚合为可折叠“任务详情”，显示真实工具动作、执行中/完成/失败及耗时；保留现有推理折叠与流式活跃指示。
   - 回合状态只由 `stream.status` 和工具终态派生；历史消息只展示已存在的 `segments/tools`，不得虚构阶段名或完成进度。
   - 最新未消费选项或 `pendingGate` 显示“等待回答”；busy、错误和已消费状态分别沿用真实数据。
2. 编号 `OptionCard` 改为截图式分步选择卡：选项单击仅暂存，提供关闭/重新展开、自定义回答和“下一步”；选择选项与输入自定义答案互斥，“下一步”统一调用既有 `onSend`，busy 或无答案时禁用，重复点击不得重复发送。
3. 扩展外层选项协议的可选元数据：当前步骤/总步骤和推荐标记。解析器剥离元数据并渲染步骤指示与“推荐”徽标；未提供时不显示，Agent 不得臆造总步数。普通编号块、风格选项、追问 chips 保持兼容。
4. `GateCardView.tsx` 仅适配双主题和卡片视觉，确认/否决、口头拍板、影响摘要及门态防护不变。
5. 更新 `resources/opencode/agents/showrunner.md`：首轮先简短确认用户目标与当前制作路径，再提出既有首问；只有外层流程确实定义步骤与推荐时才输出对应元数据，不声称未执行的工作已完成。
6. 输入区同步对齐截图的圆角、边框、聚焦与发送层级，但保留现有模型选择、停止、AI 降级及无项目锁定行为。

## 4. 测试与验收

1. 新增 feature-817 组件测试，并更新受影响的 `chat-chips.test.tsx`、`chat-markdown.test.tsx`、`chat-liveness.test.tsx`、门卡及 StudioApp 测试：
   - 主题默认、切换、非法存储回退、重启恢复及 `<html>` 类同步。
   - 任务详情只渲染真实工具/推理，流式状态、等待回答和历史回放正确。
   - 选项暂存、自定义互斥、关闭/重开、下一步原文发送、busy/重复提交、回放 picked/disabled。
   - 步骤/推荐元数据有无两种情况；旧编号块、风格块和 chips 回归。
2. 先记录当前基线，再运行 `npm run typecheck`、`npm run test:run`、`npm run build:renderer`、`npm run build:electron`；区分既有失败与本包新增回归，不借修复名义扩大范围。
3. 启动真实应用做双主题视觉验收：欢迎页、DAG、立项画布、对话流式/等待/拍板、谱系面板、设置弹层和异常态；检查对比度、焦点、残留亮块、布局溢出及主题重启恢复。
4. 验收真实首问仍为“商业短剧 / 个人纪念”，确认选项回答仍进入原 capture/quote、会话回放和确认门链路；将截图与结果回填 feature-817 验收文档。

## 关键文件

- `docs/features/feature-817-全局双主题与对话形态对齐/`（规格与验收）
- `短剧Agent平台设计.md`、`docs/design/短剧Agent平台设计.html`
- `index.html`、`tailwind.config.js`、`src/index.css`
- `src/studio/shell/StudioApp.tsx` 及上述全局生产组件目录
- `src/studio/chat/ChatComposer.tsx`、`src/studio/chat/GateCardView.tsx`
- `resources/opencode/agents/showrunner.md`
- 既有聊天/外壳测试与 feature-817 新测试
