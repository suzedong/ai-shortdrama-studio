# MiniMax Design 功能与架构参考

> **定位**：文档族参考文档（源 · 权威）。收录 MiniMax Design（MiniMax 官方内容生产 Agent 平台）的功能全景、架构实测与对我们体系的对照结论，供《短剧Agent平台设计》与后续开发逐条参照。**非规范成员**：本文件不定义流程规则，仅提供外部产品情报。
> 生成自：v1.0（2026-10-02）；v1.1（2026-10-09）补充 SKILL.md、画布节点、ComfyUI 工作流、Agent 驱动工作流与 H3 规范；v1.2（2026-10-10）补充 H3 Max / Max Turbo、ComfyUI H3 节点演进与 FastH3 硬件门限；v1.3（2026-11-10）基于 MiniMax Design 4.0.8 macOS 客户端解包与独立创作页实测，补充 V3 画布渲染、文档命令协议、撤销重做、视口交互、Dagre 自动整理、自研小地图、SQLite 持久化及节点—正文—Agent 关联；v1.4（2026-11-15）基于 Windows 4.0.10.158 安装包选择性解包和运行界面只读观察，补充完整产品功能域、Agent 与短剧工作流、Gateway/MCP、插件、本地模型、全面复刻矩阵及 ComfyUI 改编边界。来源：官方手册《MiniMax Design - 手册与指南》（飞书，revision 11360）+ 官方页面与 GitHub + ComfyUI 官方 changelog + 社区实测博客（Je，2026-08-23）+ 用户实测截图（2026-10-02）+ macOS 本机解包与运行时实测（2026-11-10）+ Windows 本机解包与界面只读观察（2026-11-15）。本文区分「官方口径」「静态代码证据」「运行时实测」「界面观察」「推断」「未验证」；html 为人读镜像（只改 md 源，同步 html）。

## 0. 定位

**MiniMax Design = AI Agent 驱动的商业内容生产平台**。不是"生成视频的工具"，而是"理解 → 拆解 → 执行 → 交付"的内容生产 Agent：用户表达创作目标 → Agent 规划任务、扩展 Prompt、选择 Skill 与工具、调用适配模型、组织素材、持续修改，把想法做到最终交付。

覆盖内容形态：文本脚本、图文、视频、Motion Graphic、3D 建模、网页 UI/UX、专业设计与影视后期。优势场景：广告投放、电商素材、品牌宣传、KOC 内容、短视频、Motion Graphic、3D 资产、网页 UI/UX、影视后期（短、快、模板化、批量化）。

### 0.1 需求基线变更：从“补缺口”转为“全面复刻”（2026-11-15）

用户本轮明确：目标由“只补 MiniMax Design 的局域网 ComfyUI 与生产闭环缺口”调整为**全面复刻 MiniMax Design**，其中图片和视频生成改走局域网 ComfyUI。本报告因此从“差异参考”升级为“复刻能力基线”，但它仍是研究文档，不自动替代《短剧Agent平台设计》、项目特化规则或决策台账。

复刻口径必须同时满足：

1. **复刻能力与体验，不复制专有实现**：覆盖用户可见功能、交互、工作流、数据语义与可追溯机制，采用自研或开源等价实现；不复制闭源代码、商标、私有素材、账号权限或云端服务。
2. **图片 / 视频明确改编**：统一调用可配置的本地 / 局域网 ComfyUI，Renderer 不直连，媒体执行收敛到主进程 / MCP 引擎工具；原产品界面出现的云端模型条目不等于本项目可用通道。
3. **未被明确变更的约束不擅自扩大解释**：音乐、文本 Provider、纯 JSON 持久化、账号 / 社区 / 团队 / 积分等仍按现行规格执行或另立决策；“全面复刻”不授权 Agent 自行改模型、引入数据库或接入云端媒体 Key。
4. **保留本项目八步闭环**：MiniMax 短剧七阶段作为工作流机制参考，映射到现有 0 立项 → 1 故事 → 2 剧本分场 → 3 资产 → 4 分镜 → 5 镜头 → 6 后期 → 7 发布，不合并或裁剪立项与发布。

## 1. 功能全景

### 1.1 画布式创作界面（官方口径）

| 区域 | 功能 |
|---|---|
| 中间 · 画布 | 所有由 Agent 和用户共同制作的内容（含上传文件）在画布显示，**自动按流程连线、展示步骤节点**；新增对齐参考线与自动吸附；剪辑完成后可导出视频/音频到画布或本地，也可直接让 Agent 导出 |
| 右侧 · Agent 对话与任务区 | 与 Agent 对话、在画布上创作；已接入十多款顶尖模型，Agent 按任务自动匹配最优选项，可手动切换 |
| 左侧 · Skill 广场 + 模板中心 + 专业插件 | 官方精选 + 创作者分享的技能与工作流 |
| 左侧 · 项目管理 + 本地资产库 | 资产中心上传本地文件，沉淀可复用的角色、场景、风格包、道具等素材，新项目快速调用 |

### 1.2 四种创作入口（官方口径）

1. **直接描述目标**：如"为一款无线耳机制作一条 15 秒竖屏广告，突出轻便和降噪，风格简洁、有科技感"。
2. **从 Skill 开始**：`/` 快捷键调用；或直接与 Agent 询问匹配（"我要做 KOC 带货视频，请调用相应 skill"）；已开启的 Skill 按对话内容自动调用。
3. **从提示词模板开始**：模板广场选模板 → 点击「使用提示词」→ 按产品/场景/风格修改 → 生成后与 Agent 对话继续调整。
4. **导入已有素材或项目**：本地图片/视频/音频/3D 资产/历史项目继续编辑；资产中心素材可直接调入新对话。

### 1.3 生成能力（官方口径）

**云端模型矩阵**：
- 视频：海螺 v1/v3、可灵（+ 唇同步/虚拟人/动作控制）、Veo3、Wan 3.0、Seedance、即梦
- 图像：nano_banana、OpenAI、kontext、Qwen、seedream、Kling、Midjourney
- 语音：TTS/批量/音色/克隆/design/人声隔离/音频续写
- 音乐：生成/翻唱/歌词
- 其他：媒体分析、超分

**H3 本地部署（开源权重）**：
- 两个变体：FL2VA（文生视频 + 可选首/尾帧）、Ref2VA（全参照：最多 9 图 + 3 段视频 + 3 段音频，角色一致性/视频编辑/动作参照/镜头续写）
- ComfyUI day-0 原生支持（自带工作流模板；三组件：扩散模型 + 文本编码器 + 双 VAE；768p 短边；12GB 显存可出 480p，社区最低 5–8GB）
- 官方精选工作流：轻量版 / 满血版 / 超清 / 扩写（部分可完全本地运行，云端增强消耗积分）
- 服务器部署：vLLM-Omni（OpenAI 兼容视频端点）/ SGLang Diffusion

### 1.4 Skill 生态（官方口径）

- **沉淀四种方式**：① 直接说需求让 Agent 生成 Skill；② 先创作、再把过程存成 Skill（`/skill-creator` 或"把当前对话总结成 Skill"）；③ 修改已有 Skill 后"保存为我自己的 Skill"；④ 上传已有资料（经验文档/SKILL.md）让 Agent 生成。
- **分享**：投稿到社区 → 官方审核 → 审核通过获积分奖励 + 可能展示「用户精选」。
- 内置 skill（实测）：h3-visual-design、cool-music-video、brand-ad 等 9 个，位于 `resources/agent-profiles/v2/config/skills/`（可复制复用）。

#### 1.4.1 SKILL.md 官方格式（实测 9 个 Hub 官方 Skill 之一 · h3-prompt-writing · github.com/MiniMax-AI/MiniMax-H3）

`SKILL.md` 必需 YAML frontmatter + Markdown 正文：

```yaml
---
name: h3-prompt-writing           # 小写字母+数字+`-`，≤64 字符，不以 `-` 开头结尾
description: Write MiniMax H3 video generation prompts for T2VA, I2VA, FL2VA, L2VA, and Ref2VA. Use when rewriting multimodal requests into H3 prompt structures, composing integrated_multimodal_description, overall_soundscape, and non_diegetic_music...
compatibility: Portable to any agent that can read local files — no external API calls, MiniMax Hub tools, or proprietary runtime required. The agents/openai.yaml file only adds optional ChatGPT/Codex UI metadata...
---
# H3 Prompt Writing
## Workflow
1. Identify the input mode: T2VA, I2VA, FL2VA, L2VA, or full-reference Ref2VA.
## Output Rules
- Write rewrite sections in English; preserve dialogue, lyrics, and visible scene text in their original language.
```

- `name`：Hub/Agent 通过它**路由**到该 Skill。
- `description`：Agent **发现与调用** 的核心依据（必须含"何时用 + 触发场景"）。
- `compatibility`：可选，声明可移植性。
- `references/` 子目录：放详细指南（如 `base-en.txt` / `ref-en.txt`）。
- 可选 `agents/openai.yaml`：UI 元数据层（display_name / short_description / default_prompt），仅给 ChatGPT/Codex skills UI 用，不限制可移植性。

```yaml
# agents/openai.yaml
interface:
  display_name: "MiniMax H3 Prompt Writing"
  short_description: "Write H3 base and full-reference video prompts"
  default_prompt: "Use $h3-prompt-writing to rewrite this multimodal request into a MiniMax H3 generation prompt."
```

**安装命令**：`npx skills add <repo-url> --skill <skill-name>`

**9 个官方 Skill 的分类**（实测 GitHub README）：
- **1 个 portable**（h3-prompt-writing）—— 不依赖 Hub 运行时，可移植到 Claude Code / Claude Agent SDK / Cursor / Windsurf / Codex / LangChain 等任何能读 `SKILL.md` 的 harness。
- **8 个 Hub-specific**（风格化专用视频生成）—— 强依赖 Hub canvas workspace / choice cards / `hub_generate_image` / `hub_generate_video` 工具，不可移植。

→ **对我们的应用**：设计 §6 Skill 内容只模糊提到"触发条件 / 任务地图模板 / Agent 提示词"，缺文件级契约；SKILL.md 格式是**直接可采纳**的工程规范。

### 1.5 专业插件与工具（官方口径）

- **3D 导演台**：自然语言在 3D 场景摆放角色素体、调度机位与姿态，可多人，快速搭建分镜参考。
- **视频剪辑**：自然语言添加/修改字幕（内容/时间/位置）、添加转场/滤镜/贴纸、裁剪/拼接/顺序调整、画面比例与布局调整。
- **精品工具**：360° 全景图预览（世界模型固定场景）、重打光（电影级灯光氛围）、多角度（同一主体多机位）、多宫格分镜、批量水印/Logo/版权信息。

### 1.6 商用、协作与会员（官方口径）

- H3 社区许可：免版税商用（年收入 ≤ 2000 万美元 + 界面标注"MiniMax H3" + 遵守 AUP；产出与权重不得用于训练/改进其他非 H3 系模型）。
- 团队版：创建团队、管理成员、积分池共享（成员可单独配置额度）、团队项目资源共享（开发中）。
- 会员/积分：国内 design.minimaxi.com/media-plan/subscribe；年卡会员享 8 折生成优惠。
- 协作规范：需求写法 = 表达商业目标（非描述画面）；修改反馈公式 = **保留什么 + 修改什么 + 为什么 + 期望结果**；商业内容质量检查 8 条（商业目标明确/前三秒有效/卖点突出/产品信息准确/品牌视觉统一/文字字幕正确/节奏适配渠道/输出规格符合）。

#### 1.6.1 修改反馈公式 + 8 条商业内容质量检查（实测 官方手册原文）

**修改反馈公式**（官方原文，作为人机协作话术硬模板）：

> **保留什么 + 修改什么 + 为什么 + 期望结果**

**8 条商业内容质量检查**（设计 §9 Harness 质量层已采纳为改编基础）：

| # | 检查项 | 说明 |
|---|---|---|
| 1 | 商业目标明确 | 表达商业目标而非描述画面 |
| 2 | 前三秒有效 | 钩子工程，前 3 秒抓注意力 |
| 3 | 卖点突出 | 卖点/钩子模式可视 |
| 4 | 产品信息准确 | 品牌/产品信息不漂移 |
| 5 | 品牌视觉统一 | 风格、字体、色调一致 |
| 6 | 文字字幕正确 | 字幕内容/时间/位置 |
| 7 | 节奏适配渠道 | 节奏与平台用户习惯对齐 |
| 8 | 输出规格符合 | 画幅/时长/分辨率匹配渠道 |

→ **对我们的应用**：设计 §9 已采纳为改编基础；本节作为**官方原文**索引，便于后续 Harness 规则编写时溯源。

## 2. 架构实测

> 本节包含不同版本与证据等级：§2.1 的 v43.1.0 为社区实测及官方资料反推；§2.2 为 v4.0.8 本机解包与 macOS 运行时实测；§2.3 为用户实测截图；§2.4–§2.5 为官方 GitHub 与 ComfyUI 资料。各版本结论不互相覆盖，静态代码结论不冒充运行时实测，版本更新后需重新验证。

### 2.1 应用架构（实测 v43.1.0，内部名 @hilo/hub）

| 层 | 内容 |
|---|---|
| 应用本体 | Electron 应用（`com.minimax.hub`），内部代号 @hilo/hub |
| Agent 运行时 | 标准 opencode（`opencode.exe`），MCP 服务指向网关 `http://localhost:8001` |
| MCP 工具集 | `mcp-tools/hub_*` 系列：画布读写、媒体生成、ComfyUI 工作流管理等 |
| 多 Agent 角色 | router / planner / executor / media-agent / **comfyui-agent**（agent-profiles/v2/config/agents/） |
| 技能库 | agent-profiles/v2/config/skills/（9 个官方 skill，可复制） |
| ComfyUI 插件 | `bundled-plugins/comfyui/`（内嵌完整 ComfyUI 前端，画布上的 ComfyUI 节点由此渲染） |
| 用户数据 | `%APPDATA%/@hilo/desktop/`（hub-config.json：账号/项目/设置，登录态 accessToken 以 v2enc: 加密） |
| 工作区 | 数据目录（Projects / asset-center / output_files），画布素材默认本地储存 |
| 本地端口 | 8001 网关（仅 127.0.0.1）、8002 工作区运行时（仅 127.0.0.1）、10268 内部（仅 127.0.0.1） |

**云端能力清单**（external_api_conf.yaml 实测）：视频（海螺 v1/v3、可灵+唇同步+虚拟人+动作控制、Veo3、Wan、Seedance、即梦）、图像（nano_banana/OpenAI/kontext/qwen/seedream/kling/midjourney）、语音（TTS/批量/音色/克隆/design/人声隔离/音频续写）、音乐（生成/翻唱/歌词）、媒体分析、超分。

![MiniMax Design 架构逆向：Electron 壳 → opencode Agent 运行时 → MCP 网关 → 本地资源与外部执行端](./MiniMax%20Design-架构逆向图.svg)

**等效链路（实测）**：外部 agent 写 H3 格式提示词 → 改模板工作流 → POST `/prompt` → `/view` 收片——与 Design 内部 comfyui-agent 的 `hub_run_comfyui_workflow` 干的是同一件事（全本地免费；Design 云端 Context-IR 提示精修、Regenerate-2K 本地替代不了，可用 SEEDVR2 近似 2K）。

#### 2.1.1 画布节点类型与 Choice Cards（实测 9 个 Hub Skill 反推 + 官方 README）

**节点按产物形态切分**（而非按阶段），从 `3d-animation-short-generator` 等 Hub-Style Skill 反推：

| 节点类型 | 典型产物 | 对应形态 |
|---|---|---|
| 文本节点 | 剧本 / 台词 / 创意简报 | markdown / text |
| 表格节点 | 分场表 / 分镜表 | 表格 / JSON |
| 图片节点 | 概念图 / 定妆 / 关键帧 | png / jpg |
| 视频节点 | 单镜头 / 成片 | mp4 |
| 音频节点 | 配音 / 配乐 | static / wav / mp3 |
| 时间线节点 | 粗剪 / 精剪 | timeline JSON |
| 插件节点 | 3D 导演台 / 智能剪辑台 / 多角度 | 专属交互卡 |

**Choice Cards**：画布上的**内嵌选择交互卡**（来自 SKILL.md 兼容性声明 "canvas workspace, choice cards, and hub_generate_image/hub_generate_video tools"）—— Agent 主动发起（参数确认、方案选项），形态与我们设计 §3.3 确认门卡片**对位**。

→ **对我们的应用**：`shared/types.ts CanvasNode.kind` 当前枚举只覆盖部分形态（brief/outline/profiles/scenes/dialogue/storyboard/asset-image），缺**音频节点 / 时间线节点 / 插件节点**；这是补强型而非破坏边界的扩展。

#### 2.1.2 ComfyUI 工作流侧栏（实测 design.minimaxi.com/campaign 官方流程）

侧栏入口「**ComfyUI Workflows**」是 Hub 的**一等公民面板**，不是二级菜单：

```
1. 打开 ComfyUI Workflows 页（左栏入口）
   ↓
2. 选模板
   ├── Official Picks（H3 模板，含 VRAM/内存/磁盘需求说明）
   ├── My Workflows（用户保存）
   └── Import Workflow（拖入 JSON）
   ↓ Download and Deploy → Add to Canvas
3. 加输入（提示词 + 参考资产）
4. 跑 + 保存（参数、版本、日志全存）
```

**复现性保证（官方原文）**：

> "A workflow JSON records only the workflow structure and cannot guarantee identical results. Results can be affected by model and node versions, seed and sampler settings, input files, GPU drivers and runtime environment. **For reliable reproduction, save the workflow, model and node versions, sample inputs, and generation parameters together. For important tasks, also keep the generation logs.**"

→ **对我们的应用**：每个媒体产物 JSON 当前缺 `workflow_id` / `workflow_version` / `model_revision` / `generation_log` 字段（设计 §7 数据模型只有 `model/seed/prompt/参考`），需补；这与设计 §0.1 原则五（媒体三类经 ComfyUI）天然对齐。

#### 2.1.3 Agent 驱动工作流（实测 官方核心交互特性）

官方原文：

> "The Agent on the right side of MiniMax Design can fill workflow inputs from your conversation and start the current workflow for you. For example, choose a workflow and tell the Agent: 'Use this workflow, use Picture 1 as the first frame, and generate a five-second video with a slow push-in.' More advanced operations can also be completed through conversation, such as **having the Agent edit workflow nodes or adjust generation parameters** for more precise, higher-quality results."

即 Hub 的核心交互模式是 **「Agent 通过对话填充工作流输入并启动」**，高级操作支持 Agent 通过对话**编辑节点 / 调整参数**。

→ **对我们的应用**：我们设计 §4.3「专职 Agent 内部循环：接收任务 → 检索上下文与知识 → 规划步骤 → 调用 MCP 工具 → 自校验 → 回报」与此形态一致；建议在 `agents/camera.md` 等 Agent 配置里**显式采纳** "对话驱动工作流调用" 模式作为 Agent 提示词的标准段。

### 2.2 画布 V3 实现（v4.0.8 解包 + macOS 实测，2026-11-10）

> **证据边界**：本小节技术栈、配置、数据结构和关联字段来自客户端解包代码；交互结果来自独立创作页的实际操作；落盘结构来自只读 SQLite 查询与 Markdown 文件读取。未操作项目代码，未触发 AI 内容生成或付费功能。
>
> **核心结论**：主画布不是用一个 `<canvas>` 自绘整个场景，而是 **React Flow / XYFlow 负责节点、连线与视口，自研 `CanvasV3Editor` 负责文档、命令、撤销重做与订阅，自研 HTML `<canvas>` 主要负责小地图**。画布图文档、正文资产和正文版本分开保存。

#### 2.2.1 技术栈与渲染分工（静态代码证据）

| 层 | 版本 / 组件 | 职责与结论 |
|---|---|---|
| 桌面壳 | MiniMax Design **4.0.8**；Electron **39.9.0**；electron-vite **5.1.0**；Vite **7.3.1** | macOS ARM64 客户端，bundle ID 为 `com.minimax.hub` |
| UI | React **19.2.4**；Zustand **5.0.12** | Zustand 是客户端依赖，但不能据此认定画布文档与命令栈由它管理 |
| 主画布 | `@xyflow/react ^12.11.2` | 真实 `ReactFlow` 导出链、节点渲染、Handle、连线、选择与视口交互 |
| 画布编辑器 | 自研 `CanvasV3Editor` + React `useSyncExternalStore` | 保存文档快照、提交命令、维护撤销/重做栈并向 React 发布状态 |
| 自动整理 | Dagre + 自研后处理 | `network-simplex` 布局，另有连通分量、孤立节点、簇排列和叶节点扇出处理 |
| 小地图 | 自研 `CanvasMiniMap` / HTML `<canvas>` | 不是直接使用 XYFlow 默认 `MiniMap` |
| 本地服务与存储 | NestJS Gateway + better-sqlite3 | 提供 V3 画布 API；每个画布独立保存 `state.sqlite` |
| 进程桥接 | 专用 `v3-workbench.cjs` preload + `MessageChannelMain` / `MessagePort` | `contextIsolation: true`、`nodeIntegration: false`、`sandbox: false` |

注册的持久化/渲染节点类型包括：

```text
placeholder
frame
subject-frame
subject-type
sticker
composition
director-stage
previs-stage
clip-studio
```

#### 2.2.2 文档模型、修改协议与编辑状态（静态代码证据）

V3 文档根结构：

```text
schemaVersion: 1
revision
nodes: 按 id 索引的对象
edges: 按 id 索引的对象
```

- 持久化节点公共字段：`id`、`parentId`、`position`、`size`、`zIndex`、`hidden`、`kind`，不同 `kind` 再携带业务字段。
- 边字段：`id`、`source`、`target`，可选 `sourceResourceId`；静态校验禁止自环并要求两端节点存在。
- 展示层另有 `selected`、`label`、`color`、`lineStyle` 等边表现数据，不应与持久化图文档混为一层。

修改通过命令补丁提交：

```text
type: "canvas.patch"
commandId
expectedRevision
nodes / edges: id、before、after
```

回执及编辑状态包含：

```text
appliedRevision
undoStack / redoStack
selection
busy / error
canUndo / canRedo
```

渲染进程 API 为 `GET /api/v3/canvas` 与 `POST /api/v3/canvas/commands`。视图偏好与活动画布映射分别使用：

```text
localStorage: hilo:canvas-v3:view:${workspaceId}
localStorage: hilo.workspace.activeCanvas.v1
```

#### 2.2.3 视口、选择、连线、布局与小地图（静态代码证据）

| 能力 | 代码配置 / 实现 |
|---|---|
| 缩放范围 | `minZoom: 0.01`、`maxZoom: 2`、`zoomStep: 0.4`；支持触控板捏合，禁止双击缩放 |
| 滚轮 | `zoomOnScroll: false`、`panOnScroll: true`，普通滚轮用于平移 |
| 选择与拖拽 | 支持节点拖拽、框选、Shift 多选 |
| 连线 | `connectionRadius: 34`；存在 `onConnectStart / onConnectEnd`、`isValidConnection` |
| 删除 | 存在 `onBeforeDelete`，具体确认交互需另行实测 |
| 视口保存 | 通过 `onMoveEnd` 等机制保存 |
| 自动整理 | Dagre `ranker: "network-simplex"`，方向支持 `LR / RL / TB / BT`，再接自研后处理 |
| 小地图 | 自研 `<canvas>` 绘制节点与视口，不是简单套用 XYFlow 默认组件 |

#### 2.2.4 本地持久化、正文资产与 Agent 关联

**静态结构**：每个画布有 `.hilo/canvas-v3/state.sqlite`。`document` 表用单行完整 JSON 保存图文档，`receipts` 表用于命令去重与结果恢复：

```sql
CREATE TABLE document (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL
);
```

**只读实测样本**：测试画布实际文档为 `schemaVersion: 1`、`revision: 8`，含两个节点和一条边：

| 节点 / 边 | 实际数据要点 | 结论 |
|---|---|---|
| 已写内容的文本节点 | `kind: "composition"`，含 `compositionId: "cmp_e570ac46087c"`；`size: 350 × 500` | 节点壳通过 `compositionId` 关联正文资产 |
| 空白文本节点 | `kind: "placeholder"`，`expectedKind: "text"` | 占位节点与已写内容节点在图文档中形态不同 |
| 节点间边 | `source` 为 placeholder，`target` 为 composition | 连线只保存节点引用，不内嵌正文 |

正文另存为 `assets/Untitled.md`，实测内容为「画布交互调研：第一段测试文本。」；`store/` 下另有两个 `ver_*.md` 版本文件。因此可以确认**节点壳、正文和正文版本分离**，但不能仅凭这一组样本断言所有节点类型都沿同一路径转换。

Agent 与画布的静态关联字段包括：

- 任务：`canvasId`、`compositionId`、`taskIds`、`placements`、`origin`、`handoff.target = "canvas"`。
- 会话：`runtimeSessionId → canvasId` 映射；任务 `origin` 保存会话与对话轮次溯源。
- ComfyUI 工具：通过 `source_node_id` 关联画布节点。
- Agent 任务可按 `canvasId` 过滤，并通过 `compositionId` 创建或复用 composition 节点。

#### 2.2.5 运行时实测通过项与未验证边界

| 实测项 | 结果 |
|---|---|
| 添加与编辑节点 | 双击画布打开添加菜单；创建两个文本节点；直接编辑正文并同步回节点 |
| 拖拽与小地图 | 拖动选中节点标题区域可改变世界坐标；小地图同步节点变化 |
| 连线 | 从第二节点右侧 `+` 拖到第一节点，生成曲线连线 |
| 撤销 / 重做 | `Cmd+Z` 撤销连线，`Cmd+Shift+Z` 重做连线，均通过 |
| 缩放 | 菜单 50% 与 100% 生效；单节点“适应视图”为 187%，两个重叠节点时为 153% |
| 普通滚轮 | 实测为平移，节点比例保持 100%，与 `panOnScroll: true` 一致 |
| 创作页切换恢复 | 切到示例页再返回后，两个节点、正文、位置、连线和 50% 视口均恢复 |

**未验证或不能外推的事项**：

- 未做“完全退出应用并重启”后的恢复实验；创作页切换恢复不等于重启恢复。
- 自动整理、小地图点击定位、空格拖动画布仅有静态代码证据，未逐项实测。
- 未继续测试删除、框选、多选及更多连线规则。
- 菜单显示 300% / 400% 预设，但 Surface 静态配置为 `maxZoom: 2`；未点击高档位，不断言实际可超过 200%。
- 单组文本样本不能外推为所有节点类型的正文转换规则。

→ **对我们的应用**：可借鉴“渲染图层 / 图文档与命令层 / 正文资产层”分离，以及 `commandId + expectedRevision + receipts` 的可追溯修改思路；React Flow、Dagre 是否采用需另立规格评估。**对方的 SQLite 方案不直接照搬**，本项目“纯 JSON 文件持久化、无数据库”的既定约束不变。

### 2.3 ComfyUI 接入实测（重要结论 · 用户截图 2026-10-02）

用户实测 **设置 → ComfyUI** 界面：仅「**启动参数**」输入框（追加到 ComfyUI 后端启动命令的额外参数，如 `--lowvram`、`--preview-method auto`），界面明文：**「端口、数据目录等由 Hub 托管的参数无法覆盖」**；参数下次启动后端时生效。

**结论（仅适用于该次实测版本）**：当时 MiniMax Design 的 ComfyUI 后端为 **Hub 内置托管**（随应用启动），设置只允许追加性能类参数，**端口/监听地址/服务地址不可配置 → 无法连接局域网内非本机 ComfyUI 实例**。此结论以用户实测为准；社区抖音教程曾演示"系统设置填 ComfyUI 服务地址"（疑似旧版本/不同版本界面）。Windows 4.0.10.158 的新证据与未验证边界见 §2.6.7，不用本条旧结论覆盖新版本。

### 2.4 提示词工程规范（实测 GitHub README + SKILL.md）

**5 段式基础模式（官方 FAQ 推荐）**：

1. **Subject** — 谁/什么在场
2. **Action** — 在做什么
3. **Setting** — 时间、地点、环境
4. **Camera** — 景别、机位、运镜
5. **Lighting & Sound** — 光线、声音源、节奏

**否定约束**（官方原文）：

> "Also specify what must not change."

即在提示词中**显式标注不可变项**（角色形象、品牌色调、字幕内容等），对应角色一致性配方。

**多模态引用标签**：`<Picture 1>` / `<Video 1>` / `<Audio 1>` —— 用于 Ref2VA 模式的多模态参照，必须在所有段落保持标签一致。

**全参照模式 Ref2VA 6 段式**（来自 h3-prompt-writing SKILL.md，顺序严格）：

1. `subject_definitions` — 主体定义（含 `<Picture 1>` 等引用标签）
2. `summary` — 视频/音频总述
3. `retention_analysis` — 保留分析（哪些元素完全保留 / 部分保留 / 参考）
4. `detailed_description` — 镜头级详细描述（构图、主体、环境、动作、相机、声音）
5. `overall_soundscape` — 整体音景
6. `non_diegetic_music` — 非叙事性音乐

→ **对我们的应用**：编剧 Agent / 镜头 Agent 的提示词模板应采纳 5 段式 + 否定约束；分镜文字稿可参考 Ref2VA 6 段式做长 prompt 的章节化组织。

### 2.5 H3 技术规格与部署（实测 GitHub README · 本地部署参考）

**输入输出规格**：

| 维度 | 规格 |
|---|---|
| 输出时长 | 4–15 秒 |
| 输出画幅 | 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 等 |
| 输出分辨率 | 默认 768p 短边；H3-Regenerate-2K 可上 2K |
| 输出帧率 | 24 FPS |
| 输出音频 | 32 kHz 立体声 |
| 对话语言 | 11 种稳定支持（阿/中/英/法/德/意/日/韩/葡/俄/西） |

**两变体**：

| 变体 | 输入模式 | 适用 |
|---|---|---|
| H3-Base-FL2VA | 首末帧模式（0/1/2 输入图） | 文生视频 + 首/尾帧控制 |
| H3-Base-Ref2VA | 全参照模式（≤9 图 + ≤3 视频 + ≤3 音频，合计 ≤12 文件） | 角色一致性 / 视频编辑 / 动作参照 / 镜头续写 |

**云端高速变体**（fal post-train，ComfyUI 0.34.x 起接入 API 节点，v1.2 新增）：

| 变体 | 接入版本 | 能力 |
|---|---|---|
| H3 Max | ComfyUI v0.34.3（2026-09-02） | 实时生成速度；prompt 上限 50,000 字符；480P / 768P 输出；T2V / I2V / 参考三入口；原生同步音频 |
| H3 Max Turbo | ComfyUI v0.34.4（2026-09-07） | T2V 与首尾帧节点的 Turbo 加速选项；MiniMax 桌面端 2026-09-30 同步接入 |

**完整系统 = 三模块**：

| 模块 | 位置 | 职责 |
|---|---|---|
| H3-Context-IR | 云端 API | 多模态上下文 → Context Intermediate Representation（提示精修） |
| H3-Base | 本地 | 768p 视频 + 音频生成（开源权重） |
| H3-Regenerate-2K | 云端 API | 2K 重生（将 768p + 原始上下文回送 H3 重生） |

**部署方式**：

- **SGLang / vLLM-Omni**（生产服务，OpenAI 兼容视频端点；4×B300 上 8.7 秒片端到端约 87 秒）
- **Diffusers**（Python 管线）
- **ComfyUI**（day-0 原生支持，自带工作流模板；v1.2 补充：v0.30.0 合并 H3 原生支持，至 v0.39.1 已覆盖 H3 Max / Max Turbo / Fun ControlNet Union 2.0 / FastH3 8 步蒸馏）
- **WanGP**（低显存）

**ComfyUI H3 节点演进时间线**（v1.2 新增，作为工作流模板版本门限依据）：

| ComfyUI 版本 | 日期 | H3 关键能力 |
|---|---|---|
| v0.30.0 | 2026-08-03 | MiniMax-H3 原生合并（CORE-375），768P 伴侣节点 |
| v0.33.4 | 2026-08-24 | Context IR prompt enhancer + Regenerate to 2K 节点 |
| v0.34.0 | 2026-08-26 | TAESD H3 轻量 VAE 快速预览；`embedding:` prompt 语法 |
| v0.34.3 | 2026-09-02 | H3 Max 节点（T2V / 首尾帧 / 参考三入口） |
| v0.34.4 | 2026-09-07 | H3 Max Turbo 加速选项 |
| v0.35.0 | 2026-09-09 | PDD LoRA 并行解码蒸馏；Fun Union ControlNet；text-encoder-only 参考 |
| v0.36.0 | 2026-09-15 | FastVideo FastH3 8 步蒸馏（T2V / I2V + 原生音频） |
| v0.39.1 | 2026-10-07 | Fun ControlNet Union 2.0；VRAM 峰值优化；LynnReal 轻量 VAE |

**硬件需求**：

- **12 GB 显存**（RTX 3060 级）出 480p
- **16–24 GB 显存** 从容，可跑满血 Ref2VA
- **8 GB 显存**（v1.2 新增）：FastH3 Trim 8 步蒸馏可出带原生音频的视频；Veda Sparse Attention 再提速 3×
- **5–8 GB 显存**（社区 FP8/INT4 量化方案）
- 系统内存 32–64 GB
- 无 GPU 可用 Colab / Comfy Cloud API 节点

→ **对我们的应用**：H3 在我们媒体通道中（B5 参考生视频 / B8 文生视频）的工作流模板参数（分辨率、时长、画幅、显存门限）可参考本节对齐；Context-IR 与 Regenerate-2K 若依赖公网云端，不进入“媒体生成零公网”的执行链路。图像仅 H3 Image、视频仅 H3、音乐仅 Music3，均按现行规则经 ComfyUI 执行。

### 2.6 Windows 4.0.10.158 全面复刻调研（2026-11-15）

> **调研方式**：只读分析 `C:\Users\SZD\AppData\Local\Programs\MiniMax Design\current`，选择性解析 ASAR，检查 Agent 配置、Gateway、MCP、内置插件，并观察正在运行的 Windows 界面。未完整解包到项目，未复制专有代码，未修改账号、模型选择或用户项目，未触发付费生成，未做真实剪映导入。
>
> **证据标记**：「静态」= 安装包文件或代码可见；「界面」= 当前运行 UI 可见；「推断」= 由多组证据归纳；「未验证」= 不能据此声称真实运行通过。UI 中出现模型或功能入口，不等于当前账号已开通，也不等于本项目允许使用。

#### 2.6.1 版本、安装与进程结构

| 项目 | 证据与结论 |
|---|---|
| 产品版本 | 对外可执行文件版本 **4.0.10.158**；ASAR `package.json` 为 **4.0.10**；安装目录 `version` 文件为 **45.2.1**。三个字段用途不同，不混写为同一版本号 |
| 桌面壳与更新 | 「静态」Electron 主进程、Preload、Renderer；Velopack 更新与 Windows managed junction 启动机制；主入口负责更新引导后动态加载主进程 chunk |
| 双 Renderer | 「静态」旧版 `out/renderer/index.html` 与 V3 `out/renderer/v3/index.html` 并存，V3 标题为 `MiniMax Design V3`，有独立 preload 与画布、项目、文档、结果导航模块 |
| 双项目架构 | 「静态」新建项目逻辑同时识别 `legacy` 与 `resource_v3`。这是兼容性事实，不表示复刻时必须保留两套历史实现 |
| 本地运行时 | 「静态」NestJS Gateway、`better-sqlite3`、gRPC 健康检查、OpenCode、MCP stdio 与 Streamable HTTP 共同构成桌面端运行底座 |

#### 2.6.2 一级导航、工作区与全局路由

「界面」当前一级导航为 **开始创作 / 项目库 / 技能·插件 / 本地模型**。工作区由左侧项目与创作页树、中央无限画布、对话面板组成，支持画布 / 浏览器切换、对话与画布左右互换、独立聚焦。

「静态」布局模式明确包含：

```text
workspace.displayMode.chatLeftCanvasRight
workspace.displayMode.canvasLeftChatRight
workspace.displayMode.canvasFocus
workspace.displayMode.chatFocus
```

「静态」已识别的主要路由如下；它们证明页面组织方式，不证明每个子流程均已运行时验收：

```text
/workspace
/projects
/skills
/skill-community/
/asset-center
/changelog
/workflows/
/guided-practice/
/creations/
/debug/remote-tool
/debug/chat-case
```

「界面」画布工具覆盖添加节点、移动 / 小手、标签、贴纸、资产目录、帮助、缩放、自动整理、画布设置、节点连线、吸附对齐与小地图。对话输入区覆盖 `@` 选择素材或插件、`/` 使用 Skill、添加文件、模型选择、Skill 入口与自动模式。

#### 2.6.3 项目、画布、对话、资产与任务闭环

| 功能域 | Windows 证据 | 复刻时应保留的行为 |
|---|---|---|
| 新建工作区 / 项目 | 「静态」可选择已有项目或自动创建，支持自定义目录、初始画布、用户记忆开关；存储不可用时存在临时默认目录与迁移 / 重启状态 | 项目选择、自动创建、目录状态与失败恢复必须可见，不能只做一个静默“新建”按钮 |
| 项目库 | 「静态」`/projects`、项目历史、编辑、导出与项目选择逻辑 | 项目作为创作页、画布、会话和资产的容器，支持历史与导出 |
| 多画布工作区 | 「静态」多画布标签、结构列表 / 视图、活动画布恢复、独立工作台、旧版与 V3 资源关联 | 页面切换后恢复创作页、活动画布、节点与视口；复刻用户结果，不必照搬双栈 |
| 画布修改与审查 | 「静态」Diff Review、命令协议、revision、撤销重做；macOS 实测见 §2.2 | 所有系统直改与 Agent 修改进入同一图文档、同一撤销与追溯机制 |
| 对话驱动 | 「界面 + 静态」`@`、`/`、附件、模型与 Skill 选择；任务通知含 `needs-answer`、`needs-confirmation` 和完成状态 | 对话不仅发消息，还要能引用资产 / 插件、触发技能、回答澄清、确认执行并定位结果 |
| 资产中心 | 「静态」`/asset-center` 与旧 API `/api/v1/asset-center`；「界面」画布可打开资产目录 | 上传、复用、引用到对话 / 画布 / 工作流，保留资产来源与产物关联 |
| 浏览器与结果导航 | 「静态」画布 / 浏览器切换、浏览器图片编辑上下文、V3 `result-navigation` 与任务结果位置 | 任务完成后能回到对应画布节点或资产，不停留在泛化通知 |

#### 2.6.4 Skill、插件、本地模型、3D 与后期导出

- **Skill**：「界面」官方 / 我的 Skill，支持导入、创建、投稿；可见分类包括短剧漫剧、专业影视、动画、商业广告、电商、教育、创意实验、音频音乐、平台工具。分类与条目是当前可见样本，不声称完整总数。
- **专业插件**：「界面」官方 / 我的插件 / 自定义插件；可见 Blender、Unreal Engine、Unity、Houdini、TouchDesigner、Spine、Photoshop、Figma、Canva、Illustrator、稿定、创客贴、MeituHub、美图设计室等。复刻重点是插件清单、权限、配置、调用与结果回写，不是伪造未接通的外部应用。
- **本地模型 / Workflow**：「界面」“本地模型”实际进入 `app://./workflows`，分精选与我的本地模型。「静态」支持官方 / 我的模型、导入、下载、继续、取消、Workflow 与模型目录、本地资源扫描、许可证确认，以及 GPU / 内存 / 操作系统 / 存储兼容性检查；删除前检查共享模型引用。
- **3D 导演台**：「静态」插件 manifest 覆盖场景读写、快照、诊断、模型生成 / 截图 / 比较、运动与机位路径。它是独立专业能力，不应退化为普通图片节点。
- **剪辑与交付**：「静态」`export-to-jianying.py` 支持剪映 / CapCut 草稿路径重写、草稿信息写入与注册；未安装客户端时可降级 ZIP。真实客户端导入与媒体完整性仍「未验证」。
- **项目模板**：「静态」示例项目包同时包含 `canvas.json`、`storage.json`、`index.sqlite`、htable、manifest 与示例媒体，说明项目交付不只是单个画布文件。

#### 2.6.5 Gateway、MCP、OpenCode 与数据一致性

| 层 | 静态证据 | 复刻学习点 |
|---|---|---|
| Gateway | NestJS；生产端口 8001；gRPC 健康检查；SQLite 保存 assets、canvas_nodes、canvas_edges、坐标、revision、content_hash | 主进程统一承载本地服务、健康检查、资产与图文档事务；Renderer 不绕过服务直写底层资源 |
| 文本与版本 | 文本版本使用独立 CAS；任务支持幂等、恢复与 outbox 终态通知 | 正文、版本、图节点壳分离；任务恢复与通知可追溯，避免重复执行 |
| 旧 MCP API | `/api/v1/canvas/commands`、`/api/v1/asset-center` | 画布修改走命令，不直接拼 UI 状态；资产操作走统一工具边界 |
| V3 MCP | stdio；`external-main.js` 另提供 Streamable HTTP `/mcp` 与 `/health`；增加 capability、resource、composition、execute、deliver 及代码 / 外部项目工具 | 工具按能力、资源、产物、执行、交付分层，支持本地 Agent 与受控外部接入 |
| OpenCode 插件 | config、chat.params、chat.message、system.transform、tool.execute.before / after 钩子；媒体工具权限随模型选择动态裁剪 | 在工具执行前后做权限、审计与上下文控制；模型选择不能让 Agent 越权切换媒体通道 |
| Trace | 默认关闭；原始请求 / 响应可能包含认证头 | 复刻诊断能力时默认关闭敏感采集，脱敏后再落盘，不能复制明文认证信息 |

**持久化差异**：MiniMax 的 SQLite / CAS 是实现事实；本项目现行架构为纯 JSON、无数据库。全面复刻应先对齐 revision、幂等、事务性、版本与恢复语义，是否改用 SQLite 属后续架构决策，不由本报告擅自变更。

#### 2.6.6 Agent 角色与短剧七阶段工作流

「静态」`agent-profiles/v2/config` 中存在五类角色：`media-agent`、`router`、`planner`、`executor`、`comfyui-agent`。配置显示 Skill 优先于 Workflow，Contract 在启动时注入；子 Agent 无状态，通过显式 payload 传递上下文。`canvas-discipline` 与 Stage Execution Plan 共同约束计划、画布登记、结果确认和质量检查。

短剧 Workflow 的七阶段及本项目映射如下。**映射不是替换本项目八步状态机**：

| MiniMax 阶段 | 核心产物 / 行为 | 本项目对应位置 |
|---|---|---|
| 1. Script | 故事与剧本内容 | 1 故事 + 2 剧本分场 |
| 2. Production Plan | 制作拆解、执行计划与依赖 | 0 立项及跨阶段制作计划，不删除现有各步产物 |
| 3. Asset Anchors | 角色、场景等一致性锚点 | 3 资产 |
| 4. Storyboard | 分镜结构、镜头 refs 与画面规划 | 4 分镜 |
| 5. Scene Keyframes | 场景 / 镜头关键帧 | 5 镜头中的关键帧准备，关联 3 资产与 4 分镜 |
| 6. Visual Gen | 按执行计划生成视觉产物 | 5 镜头，经局域网 ComfyUI 执行 |
| 7. Post | 后期组合与交付前处理 | 6 后期；7 发布仍由本项目独立保留 |

每个阶段都有**计划确认 + 结果确认**双门。可见状态包括：

```text
doing
waiting_user(plan_review)
waiting_user(result_review)
blocked
done
```

Stage Execution Plan 的关键不是一段自然语言，而是可执行结构：稳定 `work_items[].id`、有序 refs、最终 Prompt、依赖、锁项和 review 字段。由此纠正旧对照中“无流程状态机”的过度概括：**原产品短剧 Workflow 有显式阶段状态与双确认门；是否具有覆盖所有内容形态的通用硬门禁仍未证实。**

失败纪律也可直接转化为复刻验收规则：

1. 禁止以相同实质参数循环调用。
2. 最多三次具有实质差异的尝试。
3. 按稳定 work item ID 局部重试，不整阶段重跑。
4. 依赖拓扑变化触发 Replan，并重新进入计划确认。
5. 不因失败擅自切换模型或放宽锁项。

「边界」`comfyui-agent` 配置覆盖工作流 / Draft 定位、真实图检查、参数确认卡、显式执行与保存；但静态文件**不能证明短剧 Executor 已完整串起 ComfyUI 图像与视频生成**。本项目应把这条链路作为自研改编与运行时验收项，而不是声称原产品已经验证。

#### 2.6.7 模型条目、本地模型与 ComfyUI 边界

「界面」当前模型选择器仅作能力盘点，未点击生成或改选：

| 类别 | 当前可见条目 |
|---|---|
| Agent | Gamma、Gamma-Op 5.5、Gamma-Astra、ark-code-latest |
| 图片 | MiniMax H3 Image、MiniMax H3 Image Highspeed、Design Image 2.5 Pro / Fast、Design Image 2 |
| 视频 | MiniMax H3、MiniMax H3 Max、Wan 3.0、Wan 3.0 Prime、Kling 3.0 Omni |
| 音频 | Speech-2.8-HD、Seed Audio 1.0、Music-3.0 |

「界面」本地模型页视频首屏可见 H3 轻量版 / 满血版、文生视频、首尾帧、多参考及官方超清 / 扩写组合；图片首屏可见 Qwen Image 2.1 文生图 / 图片编辑、Turbo、BF16 满血版。这里只记录首屏，不反推完整目录，也不把 Qwen Image 等条目纳入本项目通道白名单。

「静态」`conf/external_api_conf.yaml` 还包含更多云端模型适配；它只能证明内置适配代码存在，不能证明账号可用或本项目应接入。

「静态」`bundled-plugins/comfyui/hub-bootstrap.js` 使用动态本机端口 `127.0.0.1:PORT`，探测 `/system_stats`，并涉及安装目录、URL 覆盖、模型下载与文件选择。这证明本机 ComfyUI 集成与一定配置能力，**仍不能证明局域网多实例、实例调度、故障切换或短剧全链路已接通**。因此旧版“端口不可覆盖”结论不能无条件外推到 4.0.10.158，新版本也不能仅凭 `URL override` 字段就宣称支持完整局域网能力。

本项目明确改编为：ComfyUI 地址可配置、多实例；图像 / 视频生成全部经本地 / 局域网 ComfyUI；Renderer 不直连；引擎工具记录实例、工作流、模型 / 节点版本、参数、输入引用、任务与日志；禁止云端媒体 Key 和按次云调用。

#### 2.6.8 本轮未验证清单

- 未执行任何真实图片、视频、语音或音乐生成，未验证账号权限、额度、计费、并发、速度、质量与模型实际路由。
- 未验证局域网 ComfyUI 多实例、远程执行、队列恢复、断线重连与故障切换。
- 未修改项目、存储目录、模型选择或许可证状态，未验证存储迁移和数据库重建的实际结果。
- 未逐项操作 Windows 画布全部交互；Windows 静态结论与 §2.2 macOS 运行时实测不能互相冒充。
- 未做剪映 / CapCut 真实导入、3D 外部应用联动、插件安装、Skill 投稿或本地模型下载。
- 未验证旧版与 V3 的全部数据迁移边界，也未验证团队协作、社区审核、会员积分等服务端流程。

## 3. 全面复刻范围与体系对照

### 3.1 全面复刻能力矩阵（本轮新基线）

下表描述**要复刻什么、如何改编**，不是排期或实施授权。所有条目进入开发前仍需拆入任务包与验收规格。

| 功能域 | 复刻范围 | 本项目改编 / 边界 |
|---|---|---|
| 桌面应用与导航 | Electron 桌面壳、开始创作、项目库、技能·插件、本地模型、更新、异常恢复 | 自研等价实现；不要求复制 Velopack 或 managed junction 的具体机制 |
| 项目与创作页 | 新建 / 自动创建、目录选择、历史、编辑、导出、多创作页、多画布、恢复 | 保留八步项目数据与状态机；`legacy / resource_v3` 双栈不是复刻目标 |
| 无限画布 | 节点、连线、框选、拖拽、缩放、小地图、整理、吸附、标签、贴纸、设置、Diff Review | 对齐交互与命令 / revision / 撤销语义；技术组件另立规格 |
| 对话与任务 | `@`、`/`、附件、Skill、模型入口、自动模式、澄清、确认、通知、结果定位 | 系统确定性操作默认直做；AI 负责文本生成与开放语义，双通道落同一数据与追溯 |
| Agent 编排 | router / planner / executor / media-agent / comfyui-agent、Contract、显式 payload、工具权限 | 可复刻职责划分；不得让模型或 Agent 绕过媒体通道和阶段门禁 |
| 短剧 Workflow | 七阶段、双确认、稳定 work item、依赖、锁项、局部重试、Replan | 映射到八步闭环，保留 0 立项与 7 发布；每阶段产物与验收不可裁剪 |
| Skill 生态 | 官方 / 我的、导入、创建、保存修改、分类、社区入口、SKILL.md 与 references | 本地创建 / 导入 / 使用优先；投稿、审核、积分等服务端能力另行定义，不伪造在线成功 |
| 插件生态 | 插件列表、配置、权限、调用、结果回写、自定义插件、专业工具入口 | 外部应用逐项做适配与运行验收；未接通时明确不可用，不能只复制图标 |
| 资产中心 | 上传、分类、复用、对话 / 画布 / Workflow 引用、产物回流、来源追踪 | 与角色、场景、道具、风格及镜头资产统一关联，避免另一套孤立资产库 |
| 图像 / 视频生成 | 参数确认、参考素材、任务队列、进度、失败重试、结果入画布与资产中心 | **唯一明确生成链路例外：全部改走可配置局域网 ComfyUI，多实例；不照搬云端模型矩阵** |
| 本地模型与 Workflow | 精选 / 我的、导入、下载 / 续传 / 取消、兼容性检查、许可证、共享引用、版本记录 | 仅上架项目允许的模型与工作流；复现记录包含实例、模型 / 节点版本、seed、输入和日志 |
| 音频与音乐 | 原产品具有语音、音乐及音画组合入口 | 当前 Music3 / ComfyUI 与语音待定约束未被本轮明确修改；不得据“全面复刻”自行开放其他云端通道 |
| 3D 与预演 | 场景、角色素体、机位、姿态、运动路径、快照、截图、比较、诊断 | 作为独立插件 / 节点能力复刻，与分镜和镜头双向关联 |
| 剪辑与发布 | 字幕、转场、滤镜、贴纸、裁剪、拼接、比例、时间线、导出、剪映 / CapCut、ZIP 降级 | 对齐 6 后期与 7 发布；真实导出和第三方导入必须逐项验收 |
| 设置与存储 | 项目规则、网络代理、存储目录 / 迁移 / 恢复、Provider、媒体 Adapter、并发 / 轮询 / 超时 | 媒体 Adapter 只开放合规 ComfyUI；文本 Provider 与持久化变化须另行决策 |
| 可靠性与安全 | 健康检查、幂等、任务恢复、outbox、权限钩子、诊断、审计 | 保留纯 JSON 时须用等价机制满足一致性；Trace 默认关闭并脱敏 |
| 团队、社区与商业化 | 团队、共享、投稿、审核、会员、积分等可见产品面 | 客户端复刻不等于服务端已具备；账号、支付、共享与在线运营需独立规格和合规决策 |

### 3.2 需求变更后的待决策项

1. **规范基线**：将《短剧Agent平台设计》与项目特化规则中的“只补两类缺口 / 形态对齐”正式调整为“全面复刻 + 明确改编”，并记录决策；本报告先记录新方向，不代替该动作。
2. **持久化**：继续纯 JSON 并用文件锁、原子写、revision、CAS、操作日志等机制，还是为画布与任务引入 SQLite；不得以“复刻”为由直接换库。
3. **非图像 / 视频通道**：音乐是否仍全部经 ComfyUI、语音采用何通道、文本是否仍仅火山方舟；本轮只明确图片和视频例外。
4. **在线服务边界**：账号、团队、社区投稿、会员积分、云同步和支付是复刻界面、实现自有服务，还是明确不在桌面本地版范围。
5. **模型与插件清单**：从“原产品可见全集”筛选本项目允许交付的模型、Workflow 和插件；可见条目不能直接变成可用承诺。
6. **运行时验收**：需补真实局域网 ComfyUI、多实例故障、七 / 八阶段映射、完整导出、第三方插件与剪映导入测试，才能把静态复刻项标为完成。

### 3.3 历史技术对照（保留旧结论，按新证据修正）

> 下表保留 v1.0–v1.3 的技术对照，供追溯。“借鉴 / 补缺口”不再限制总体复刻范围；与新 Windows 证据冲突处已在 §2.6 修正。

| 维度 | MiniMax Design | 我们的体系 | 结论 |
|---|---|---|---|
| 画布自动连线 | 内容自动按流程连线、步骤节点 | 已升级为画布式界面（见《短剧Agent平台设计》） | **借鉴**：画布 + 状态着色 + 预览跳转 |
| **画布渲染与编辑**（v1.3 新） | React Flow / XYFlow + 自研编辑器；Dagre 整理；自研小地图 | 已确定画布式界面，具体组件与布局选型需另立规格 | **形态对齐**：借鉴渲染、图文档命令、布局和小地图的职责分层 |
| **画布持久化与资产关系**（v1.3 新） | SQLite 图文档 + receipts；正文 Markdown 与版本独立；composition / task / session 关联 | 纯 JSON 文件持久化、无数据库；八步产物与追溯体系列为既定约束 | **改编**：参考 revision、命令去重、资产分离和溯源字段；**不直接引入 SQLite** |
| 画布节点类型 | 按产物形态切分（文本/表格/图片/视频/音频/时间线/插件）+ Choice Cards | shared/types.ts CanvasNode.kind 部分覆盖 | **形态对齐**：补**音频/时间线/插件**枚举；Choice Cards 已是确认门卡片形态 |
| Agent 任务确认 | 生成前确认参数、产出制作简报 | R4 确认门：check 全过 + 人点 advance | **同源**：都是"执行前人工把关"，Design 是软确认、我们是硬门禁 |
| Skill 沉淀 | 对话流程存 Skill、投稿分享 | skill 目录 + doubao-drama-pipeline 路由 | **借鉴**：创作过程沉淀为可复用 Skill 的思路 |
| **SKILL.md 格式**（v1.1 新） | frontmatter（name/description/compatibility）+ references/ + 可选 agents/openai.yaml；安装命令 `npx skills add` | 设计 §6 只模糊提到内容维度，缺文件级契约 | **借鉴**：建 SKILL.md 规范包（**直接可采纳**） |
| **ComfyUI 工作流侧栏**（v1.1 新） | 侧栏一等公民面板：Official Picks / My Workflows / Import Workflow | 设计 §5 engine.workflows.load 有工具无 UI 入口 | **借鉴**：建侧栏面板 + 模板三分类 |
| **Agent 驱动工作流**（v1.1 新） | "Agent 可用对话填充工作流输入并启动"（官方原文） | 设计 §4.3 专职 Agent 内部循环形态一致 | **借鉴**：在 Agent 提示词明示 "对话驱动工作流" 模式 |
| 修改反馈公式 | 保留什么+修改什么+为什么+期望结果 | flag 反向回流（归因通道 + 受影响传导） | **互补**：公式可并入人机协作话术 |
| 质量检查 | 8 条商业内容检查 | 验收规则.json 30 种检查类型 | **互补**：Design 偏审美/商业口径，我们偏文件/内容级机器校验 |
| **提示词 5 段式**（v1.1 新） | Subject/Action/Setting/Camera/Lighting&Sound + 否定约束 | 设计未规定提示词模板 | **借鉴**：补编剧/镜头 Agent 提示词模板 |
| **复现性规范**（v1.1 新） | workflow_id + model/node version + seed + sample inputs + generation logs | manifest 只有 model/seed/prompt/参考，缺 workflow_id/version/log | **借鉴**：补产物 JSON 字段（与设计 §0.1 原则五对齐） |
| 生成通道 | 云端多模型矩阵（海螺/可灵/Veo3/Wan…）与本地 Workflow 并存 | 现行红线：图像 H3 Image、视频 H3、音乐 Music3，全部经 ComfyUI；语音待定 | **改编**：复刻交互与任务能力，不复制云端媒体通道 |
| ComfyUI 接入 | 旧实测为 Hub 托管且端口不可覆盖；4.0.10.158 可见本机动态端口与 URL 覆盖逻辑，局域网能力未验证 | 执行适配层可配置地址、多实例 + ComfyUI `--listen 0.0.0.0` | **扩展**：按本项目要求自研局域网多实例并做运行时验收 |
| 状态机/溯源 | 短剧 Workflow 有七阶段状态、双确认门、稳定 work item 与局部重试；通用硬门禁未证实 | 八步状态机 + 校验 + prompt_id / 工作流日志溯源 | **对齐并保留差异**：吸收短剧执行计划，不裁剪八步闭环 |
| 部署 | 本地部署 Beta（H3 工作流） | venv 无 docker 一键启动 | **参考**：本地优先一致 |
| **H3 部署形态**（v1.1 新） | SGLang / vLLM-Omni / Diffusers / ComfyUI 四线部署；12GB 显存可出 480p | ComfyUI 是统一媒体引擎（设计 §0.1 原则五） | **同源**：我们与 Hub 在 ComfyUI 路径一致，硬件门限可对齐 |
| **H3 变体与版本门限**（v1.2 新） | 开源 FL2VA / Ref2VA + 云端 H3 Max / Max Turbo；ComfyUI v0.30.0→v0.39.1 多次关键升级；Fun ControlNet Union 2.0 支持多控制条件合一 | 设计未定 ComfyUI 最低版本；工作流模板未按版本门限分发 | **补强**：供后续规格评估 ComfyUI 最低版本、镜头控制接口与低显存模板，不在本参考文档直接定规范 |

**更新结论**：MiniMax Design 不再只是“补缺口”的对照物，而是本项目的**完整能力与体验复刻基线**。复刻范围覆盖项目、画布、对话、Agent、Skill、插件、资产、本地模型、3D、剪辑与交付；图片 / 视频执行链路明确改为局域网 ComfyUI，本项目八步闭环、系统优先、媒体红线和安全追溯继续保留。存储、在线服务及非图像 / 视频模型通道按 §3.2 另行决策。

## 4. 来源与版本

- 官方手册：《MiniMax Design - 手册与指南》（飞书 wiki VEoVwpfCKiTHvHkAGQ7cQJxCncf，docx RC33dT20ooJnBUxhoJpcU5GDnsc，revision 11360）——功能全景/创作方式/Skill 生态/插件/商用/质量检查（官方口径）
- 官方页面：design.minimaxi.com/h3（H3 本地部署/硬件/商用 FAQ，官方口径）；design.minimaxi.com/campaign（开源与部署教程入口）
- **官方 GitHub：github.com/MiniMax-AI/MiniMax-H3（v1.1 新增）**——SKILL.md 官方格式 / 9 个官方 Skill / H3 模型技术规格 / 三模块系统 / SGLang vLLM ComfyUI 部署
- **ComfyUI 官方 changelog（v1.2 新增）**——截至 v0.39.1（2026-10-07）的 H3 节点演进、H3 Max / Max Turbo、Fun ControlNet Union 2.0 与 FastH3 版本依据
- 社区实测：Je《本机 ComfyUI 与 MiniMax Design 接管指南》（je-qljx.github.io，2026-08-23）——架构/端口/ComfyUI API/云端能力清单（实测，注意时效）
- 用户实测：MiniMax Design 设置 → ComfyUI 截图（2026-10-02）——启动参数界面 / Hub 托管结论（以用户实测为准）
- **本机解包与运行时实测（v1.3 新增，2026-11-10）**：官方 MiniMax Design 4.0.8 macOS ARM64 客户端；静态证据来自解包目录 `/tmp/minimax-design-asar/` 的 `package.json`、renderer 的 `CanvasAreaV3-DJZm1ka6.js` / `workspace-canvases-DVIGxQVT.js` / `connector-reference-Cq2qE7xv.js`、V3 入口的 `CanvasPage-om33MQNA.js` / `project-v3-Dtsev_aR.js`、主进程与 preload，以及客户端 Resources 下的 Gateway、MCP 与 OpenCode 插件代码。
- **运行时落盘样本（v1.3 新增）**：独立创作页 `画布交互调研`，调研时位于 `/Users/szd/Movies/Hub/Projects/.projects/项目新手指引/画布交互调研/`；只读查询 `.hilo/canvas-v3/state.sqlite`，读取 `assets/Untitled.md` 并枚举 `store/ver_*.md`。测试创作页保留，未删除。上述 `/tmp` 与用户数据路径只用于本次证据定位，可能随系统清理、版本更新或工作区迁移失效。
- **Windows 安装包与界面只读调研（v1.4 新增，2026-11-15）**：官方 MiniMax Design **4.0.10.158**，安装目录 `C:\Users\SZD\AppData\Local\Programs\MiniMax Design\current`。选择性解析 `resources/app.asar` 的主进程、preload、旧版 / V3 Renderer 与工作区、项目、Skill、Workflow、设置、模型选择、资产中心模块；读取 `resources/agent-profiles/v2/config` 的 agents、contracts、drama-series Workflow 与 Stage Execution Plan；检查 `gateway`、`mcp-tools`、`mcp-tools-v3`、OpenCode 插件、ComfyUI、3D 导演台、剪辑导出及示例项目。运行界面只读观察一级导航、工作区、模型选择器、Skill / 插件和本地模型页。临时选择性提取目录为 `C:\Users\SZD\AppData\Local\Temp\minimax-design-4.0.10-research`，不是项目交付物，可能随系统清理失效。
- 时效声明：Design 版本迭代快，各节按产品版本和调研日期独立标注；本文件资料覆盖至 **2026-11-15**，旧版本结论不自动代表当前版本，静态证据不自动代表运行时通过。

## 5. 版本记录（入口）

- 本文件版本：v1.0（2026-10-02）→ v1.1（2026-10-09）→ v1.2（2026-10-10）→ v1.3（2026-11-10）→ **v1.4（2026-11-15）**。
- v1.1 增量：SKILL.md 格式、画布节点类型、ComfyUI 工作流侧栏、Agent 驱动工作流、提示词 5 段式、复现性规范、H3 技术规格与部署。
- v1.2 增量：H3 Max / Max Turbo、ComfyUI v0.30.0→v0.39.1 H3 节点演进时间线、FastH3 Trim 8 GB 硬件门限与对照表版本门限行。
- v1.3 增量：新增 §2.2 V3 画布技术栈、文档与命令协议、视口交互、Dagre、自研小地图、SQLite 落盘样本、正文资产与 Agent 关联、运行时通过项和未验证边界；原 §2.2–§2.4 顺延为 §2.3–§2.5；§3 新增画布渲染/持久化对照；同步回补 v1.2 曾只写入 HTML 的源文档漏项。变更史记入根目录《版本记录.md》（AI 可读）。
- **v1.4 增量**：记录“全面复刻 MiniMax Design，图片 / 视频改走局域网 ComfyUI”的需求基线；新增 §2.6 Windows 4.0.10.158 安装包与界面证据、完整功能域、Gateway / MCP / OpenCode、Agent 五角色、短剧七阶段与双确认门、模型条目和未验证清单；新增 §3.1 全面复刻矩阵与 §3.2 待决策项；旧对照移入 §3.3，并修正“无流程状态机”“当前版本 ComfyUI 端口不可覆盖”及旧媒体通道等过度或过时表述。本轮只改研究文档，未改产品代码、架构真相源、共享类型或决策台账。
- 镜像纪律：改本文 md 必须同步 .html（人读镜像），两版标题/正文/数字逐一对齐；html 非独立事实源。
