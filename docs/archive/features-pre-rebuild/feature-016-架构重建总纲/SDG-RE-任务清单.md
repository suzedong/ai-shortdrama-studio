# SDG-RE 任务清单 · feature-016 架构重建总纲

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 本 Feature 的"实施"= 产出并锁定总纲五文件；业务落地从 feature-017 起按下列分包推进。

---

## A. 上下文加载清单（开始本任务前已逐项读取）

- [x] [AGENTS.md](file:///Users/szd/Documents/Code/ai-shortdrama-studio/AGENTS.md) 项目特化条款
- [x] [AI-SDG-AI工具执行指令.md](file:///Users/szd/Documents/Code/ai-shortdrama-studio/docs/governance/AI-SDG-AI工具执行指令.md) 全部条款
- [x] [短剧Agent平台设计.md](file:///Users/szd/Documents/Code/ai-shortdrama-studio/短剧Agent平台设计.md) 架构真相
- [x] [MiniMax Design功能与架构参考.md](file:///Users/szd/Documents/Code/ai-shortdrama-studio/docs/research/MiniMax%20Design功能与架构参考.md) 仓库情报
- [x] 现有架构源码（main/session/mcp/runtime/shared，详见需求规格 §1 证据）
- [x] feature-008 任务包（契约文风与既锁决策）

## B. 本总纲原子任务

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| B1 | 现状病灶与 Design 情报固化 | SDG-RE-需求规格 §1/§2 | [x] |
| B2 | 目标分层与依赖方向 | 契约 §1 | [x] |
| B3 | 摄制组 Agent 边界 | 契约 §2 | [x] |
| B4 | 纯工具集契约（零 LLM） | 契约 §3 | [x] |
| B5 | 画布数据模型 + K1 范围 | 契约 §4 | [x] |
| B6 | IPC 增删 + gate 阻塞 | 契约 §5/§6 | [x] |
| B7 | 错误/安全/测试契约 | 契约 §7-9 | [x] |
| B8 | 后续 Feature 分拆与验收闸 | 本文件 §C/§D | [x] |
| B9 | 交互设计说明 | SDG-OD | [ ] |
| B10 | 卡口预批决策记录 | SDG-AI | [ ] |
| B11 | 用户审批总纲 | NotifyUser | [ ] |

## C. 后续 Feature 分拆（feature-017 起）

顺序原则：**先换地基（数据模型 + 纯工具），再竖首个垂直切片（立项），再沿八步推进，旧链路验收一个删一个。**

| Feature | 名称 | 主要内容 | 依赖 | 拆除的旧物 |
|---|---|---|---|---|
| 017 | 画布基座与纯工具层 | shared K1 落类型；mcp 重写为 file/canvas/gate/asset/comfyui 纯工具；主进程 CanvasStore（单写队列/归档/订阅广播）；canvas/gate/asset/settings IPC | 016 | ToolResultEnvelope、旧 tools 8 工具、ark/prompts 在 mcp 的耦合 |
| 018 | 摄制组 profiles 与主控链路 | showrunner/writer/media-director/comfyui-operator profile；task 委派；gate 阻塞/恢复；runtime 对接新工具 | 017 | director.md 强制外包条款 |
| 019 | 垂直切片·立项（第 0 步） | 灵感输入→Agent 立项诊断/五要素→门 0-a~0-d→brief 落盘→画布节点 | 017/018 | 立项旧 IPC（project/saveIdea/saveDiagnosis 等）+ App 立项状态 |
| 020 | 切片·故事（第 1 步） | Agent 产出大纲/人物小传，门 1-a/1-b | 019 | story:* 旧 IPC + 候选/修订前端编排 |
| 021 | 切片·剧本分场（第 2 步） | 分场/台词，门 2-a/2-b/2-c | 020 | script:* 旧 IPC |
| 022 | Renderer 重建与旧壳下线 | 新 ChatStream/CanvasView/GateCard/Viewer；删除 App 重状态机、runInternalPrompt、finalizeDoneTurn；删除旧 IPC 与旧 lib | 019-021 | App.tsx 状态机、~27 旧 handle、src/lib 旧 workflow/gates/replay/revision/candidates/superseded |
| 023 | ComfyUI 多实例与资产中心 | 实例 CRUD/探活、工作流提交/轮询、asset-index、本地/局域网打通 | 017 | — |
| 024 | 切片·资产与分镜镜头（3/4/5 步） | qwen-image 出图、分镜表、H3 镜头，全部经 ComfyUI，含确认门 | 023/021 | — |
| 025 | 切片·后期与发布（6/7 步） | 后期合成、发布产物（agent 扩展走 K6） | 024 | — |
| 026 | Skill/插件与方法复用 | Skill 沉淀/广场形态（对齐 Design 第 3 步） | 022 | — |

> 022 的 UI 重建可与 019-021 并行起步（新组件在新切片上随建），但"删旧壳"必须在 019-021 全部验收后。

## D. 每个切片的统一验收闸（DoD）

1. 该步产物由 Agent 自身推理 + 纯工具落盘，工具层无 LLM（静态断言）。
2. 八步该步的确认门齐全且经对话阻塞/裁决/恢复验证。
3. 画布节点状态与自动边正确，`canvas:changed` 顺序投递。
4. renderer 无流程编排、无运行时/引擎直连。
5. 媒体类切片：仅经本地/局域网 ComfyUI，零公网、renderer 不直连。
6. 单测 + 该切片集成测试全绿；`typecheck` 全绿；旧物删除在验收之后。

## E. 结束前自检（总纲）

- [ ] 五文件齐备且无相互矛盾。
- [ ] 契约工具集零生成型工具。
- [ ] K1/K3/K4/K6/K8 已在变更记录预批或标注再停。
- [ ] 硬边界逐条有落点。
- [ ] 未写任何业务代码（本总纲仅文档）。
