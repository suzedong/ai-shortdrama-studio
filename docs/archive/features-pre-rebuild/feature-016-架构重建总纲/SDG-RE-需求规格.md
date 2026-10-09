# SDG-RE 需求规格 · feature-016 架构重建总纲（MiniMax Design 形态对齐）

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 性质：**架构重建总纲 Feature**——本 Feature 不直接交付业务功能，而是锁定目标架构、契约、数据模型与后续 Feature 分拆；落地由 feature-017 起逐包实施。
> 参照：《短剧Agent平台设计.md》、《docs/research/MiniMax Design功能与架构参考.md》、MiniMax Design 官方五步工作流（https://hub.minimaxi.com/）

---

## 1. 背景：为什么必须重建

feature-001 ~ 015 已跑通文本侧三阶段，底层是「**renderer 重状态机 + MCP 业务工具内部直调火山方舟**」。该架构经实测与评审，存在四处结构性病灶，且与 MiniMax Design 的真实做法相反：

| # | 病灶 | 证据 | 与 MiniMax Design 的差异 |
|---|---|---|---|
| P1 | **工具职责越界**：8 个 `shortdrama_*` 业务工具内部 `ark.chat()` 并内置 prompts 模板，工具既是"读写工具"又是"AI 生成方" | [tools.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/tools.ts) import ark.ts/prompts.ts | Design 的 `hub_*` 工具只做画布读写 / 媒体提交 / 工作流调用，**没有一个工具内部调 LLM** |
| P2 | **生成外包走老通道**：Agent 被强制要求"业务产物必须调用 shortdrama_* 工具产出，不得凭自身知识"，Agent 自身推理能力被废置 | [director.md](file:///Users/szd/Documents/Code/ai-shortdrama-studio/resources/opencode/agents/director.md) 强制外包条款 | Design 由 router/planner/executor **自身推理产出文本**，工具只负责落盘与执行 |
| P3 | **renderer 持有重状态机**：节点状态、确认门、候选/修订、定稿信封解析全部在 App.tsx（76KB），靠 `runInternalPrompt` 注入固定指令串驱动流程 | [App.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/App.tsx) L393/L516/L667 及 8 处固定指令 | Design 的画布是**主进程状态的渲染器**（节点自动连线），对话是唯一驱动入口，前端无流程编排 |
| P4 | **状态三处存储且协议为生成定制**：ToolResultEnvelope / WorkflowState / FinalizedSnapshot 多套模型并存，渲染层承担本该由 Agent + 工具承担的一致性 | [session.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/session.ts)、[types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/shared/types.ts) | Design 以"画布图（节点 + 边）"为单一工作态，产物即节点，状态归属主进程 |

**结论**：这些不是局部坏味道，而是分层方向错误。用户已拍板："之前的所有功能点都完全可以删了重建，或者打乱了重来，不用拘泥原来的设计；只要是影响架构的都要重新设计。"故本 Feature 采用**重建而非绞杀修补**。

## 2. MiniMax Design 是怎么做的（实测 + 官方情报）

### 2.1 官方五步工作流（2026-10 官网现行）

1. **灵感输入 · AGENT MODE**：说想法或丢策划文档，主 Agent 理解意图 → 自动拆解任务分配 → 自动（可手动）适配最优模型。
2. **画布编排 · CANVAS FLOW**：脚本 / 分镜 / 图片 / 视频 / 音乐 / 剪辑全在一块画布，**节点自动连线**。
3. **方法复用 · SKILL READY**：对话生成专属 Skill 或一键调用广场工作流 + 专业插件。
4. **本地衔接 · LOCAL INDEX**：画布资料自动本地化，图片 / 工作流沉淀资产中心；Agent 无缝调本地文件、直连剪辑软件。
5. **审核节点 · OUTPUT SYNC**：关键节点 Agent 主动询问核心方向；Agent + Harness 后台调知识库、多轮校验。

### 2.2 底层架构（本机实测）

`Electron → 标准 opencode（未魔改）→ MCP 网关(localhost:8001) → hub_* 纯执行工具 + 多 agent profile + 官方 skill + 内嵌 ComfyUI 插件`。

- **工具纯执行**：画布读写、媒体生成提交、ComfyUI 工作流调用；工具不做推理。
- **多 Agent profile**：router（路由）/ planner（规划）/ executor（执行）/ media-agent（媒体）/ comfyui-agent（引擎）。
- **全部端口仅 127.0.0.1**；ComfyUI 被 Hub 内置托管，端口/地址不可配 → **连不了局域网**（这正是本项目要补的缺口）。

## 3. 重建目标

| # | 目标 | 验收方向 |
|---|---|---|
| G1 | **Agent 全权驱动**：文本产物由 Agent 自身读上下文 → 自身推理 → 经纯工具落盘；工具内部零 LLM 调用 | 代码中 tools 层无任何模型 SDK / chat 调用 |
| G2 | **工具纯化**：MCP 只暴露文件 / 画布 / 确认门 / 资产 / ComfyUI 纯执行原语 | 契约工具清单逐项无 prompt / 无生成逻辑 |
| G3 | **renderer 瘦身**：删除重状态机与固定指令串，前端只剩"对话流 + 画布渲染器 + 确认门 UI + 查看器" | App.tsx 不再含节点推进 / 信封解析 / runInternalPrompt |
| G4 | **单一工作态**：以画布图（节点 + 自动边）为中心，状态归主进程，renderer 订阅投影 | 只有一份画布状态模型，主进程持有 |
| G5 | **确认门回归对话**：Agent 在关键节点经 `request_gate` 阻塞等用户裁决，与 Design OUTPUT SYNC 形态一致 | 门由 Agent 主动发起，非前端编排 |
| G6 | **硬边界不破坏**：八步闭环完整（每步有产物）、本地/局域网可配置多实例 ComfyUI、媒体零公网、renderer 不直连引擎 | 逐步产物可验证；ComfyUI 地址可配 |
| G7 | **可演进**：本总纲锁定架构，feature-017 起可按层 / 按垂直切片并行实施，旧代码在新链路验证前可并存参照 | 任务清单给出分包与删除/替换清单 |

## 4. 范围

### 4.1 In Scope（本总纲锁定的设计产物）

1. 新分层架构与依赖方向（见《契约》§1）。
2. Agent 摄制组 profile 集合与各自职责 / 模型 / 工具边界（见《契约》§2）。
3. 纯化后的 MCP 工具集契约（文件 / 画布 / 确认门 / 资产 / ComfyUI），**不含任何生成型工具**（见《契约》§3）。
4. 以画布图为中心的数据模型与持久化布局；明确 `shared/types.ts` 的 K1 变更范围（见《契约》§4）。
5. 新 IPC 面规划与旧 IPC / 旧文件删除替换清单（见《契约》§5、《任务清单》）。
6. renderer 目标结构与交互形态（见《设计说明》）。
7. 后续 Feature 分拆、顺序、依赖与验收闸（见《任务清单》）。

### 4.2 Out of Scope（本总纲不做，归后续 Feature）

- 任何具体业务功能的最终代码实现（feature-017 起逐包）。
- ComfyUI 工作流本身的搭建 / 权重适配（媒体切片 Feature）。
- Skill 广场、插件体系、直连剪辑软件（后续独立 Feature，对应 Design 第 3/4 步）。
- 安装包签名公证、自动更新（打包 Feature）。

## 5. 不可破坏的硬边界（架构红线）

1. **八步闭环完整**：0 立项 → 1 故事 → 2 剧本分场 → 3 资产 → 4 分镜 → 5 镜头 → 6 后期 → 7 发布，每步有明确产物，不得合并 / 裁剪。重建可重排实现方式，但必须保留八步语义与产物。
2. **局域网 ComfyUI**：必须支持本地及局域网 ComfyUI，地址可配、多实例；任何使该能力失效的设计视为破坏边界（这是对 Design 缺口的自研补位）。
3. **生成通道**：图像 qwen-image、视频 H3、音乐 Music3 全部经本地/局域网 ComfyUI 权重/工作流推理；出公网仅文本侧火山方舟。
4. **renderer 不直连 ComfyUI / opencode**：媒体与运行时调用一律收敛于主进程 / MCP。

## 6. 功能溯源标注

| 能力 | 标签 |
|---|---|
| Agent 对话驱动、画布节点自动连线、Agent 自配模型、确认门对话化、Skill/资产形态 | **[Design 原有]**（开源同源组件，形态对齐） |
| 标准 opencode 运行时、Electron 主从安全边界、事件投影、文本经火山方舟自定义 provider | **[改编]** |
| 局域网可配多实例 ComfyUI、八步完整闭环、画布图数据模型 | **[自研新增]** |

## 7. 验收总标准（总纲层）

1. 五份总纲文件齐备，目标架构 / 契约 / 数据模型 / IPC / 分包无自相矛盾。
2. 工具集契约中不存在任何含 LLM 调用 / prompt 模板的工具。
3. K1 / K3 / K4 / K6 / K8 卡口均已识别并在《变更记录》中由用户预批，未预批项明确标"实施前再停"。
4. 后续每个 Feature 都能引用本总纲契约直接开工，无需再做架构方向决策。
5. 硬边界（八步 / 局域网 ComfyUI / 通道红线 / 不直连）在契约中逐条有落点。
