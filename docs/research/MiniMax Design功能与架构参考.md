# MiniMax Design 功能与架构参考

> **定位**：文档族参考文档（源 · 权威）。收录 MiniMax Design（MiniMax 官方内容生产 Agent 平台）的功能全景、架构实测与对我们体系的对照结论，供《短剧Agent平台设计》与后续开发逐条参照。**非规范成员**：本文件不定义流程规则，仅提供外部产品情报。
> 生成自：v1.0（2026-10-02）；v1.1（2026-10-09）增量：从 MiniMax H3 GitHub 仓库（github.com/MiniMax-AI/MiniMax-H3）与 design.minimaxi.com/campaign 官方页面补充 SKILL.md 官方格式、9 个 Hub 官方 Skill 分类、画布节点按产物形态切分、Choice Cards、ComfyUI 工作流侧栏面板、Agent 驱动工作流、H3 提示词 5 段式 + 否定约束、复现性规范、H3 技术规格与部署。来源：官方手册《MiniMax Design - 手册与指南》（飞书，revision 11360）+ 官方页面 design.minimaxi.com/h3 + design.minimaxi.com/campaign + 官方 GitHub github.com/MiniMax-AI/MiniMax-H3 + 社区实测博客（Je，2026-08-23）+ 用户实测截图（2026-10-02）。本文区分「官方口径」与「实测」；html 为人读镜像（只改 md 源，同步 html）。

## 0. 定位

**MiniMax Design = AI Agent 驱动的商业内容生产平台**。不是"生成视频的工具"，而是"理解 → 拆解 → 执行 → 交付"的内容生产 Agent：用户表达创作目标 → Agent 规划任务、扩展 Prompt、选择 Skill 与工具、调用适配模型、组织素材、持续修改，把想法做到最终交付。

覆盖内容形态：文本脚本、图文、视频、Motion Graphic、3D 建模、网页 UI/UX、专业设计与影视后期。优势场景：广告投放、电商素材、品牌宣传、KOC 内容、短视频、Motion Graphic、3D 资产、网页 UI/UX、影视后期（短、快、模板化、批量化）。

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

> 本节内容来自社区实测（Je《本机 ComfyUI 与 MiniMax Design 接管指南》，2026-08-23，Windows 实测）与用户实测（2026-10-02 截图），非官方文档口径，注意时效（版本更新可能变化）。

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

### 2.2 ComfyUI 接入实测（重要结论 · 用户截图 2026-10-02）

用户实测 **设置 → ComfyUI** 界面：仅「**启动参数**」输入框（追加到 ComfyUI 后端启动命令的额外参数，如 `--lowvram`、`--preview-method auto`），界面明文：**「端口、数据目录等由 Hub 托管的参数无法覆盖」**；参数下次启动后端时生效。

**结论**：当前版本 MiniMax Design 的 ComfyUI 后端为 **Hub 内置托管**（随应用启动），设置只允许追加性能类参数，**端口/监听地址/服务地址不可配置 → 无法连接局域网内非本机 ComfyUI 实例**。此结论以用户实测为准；社区抖音教程曾演示"系统设置填 ComfyUI 服务地址"（疑似旧版本/不同版本界面），已不适用于当前版本。

### 2.3 提示词工程规范（实测 GitHub README + SKILL.md）

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

### 2.4 H3 技术规格与部署（实测 GitHub README · 本地部署参考）

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

**完整系统 = 三模块**：

| 模块 | 位置 | 职责 |
|---|---|---|
| H3-Context-IR | 云端 API | 多模态上下文 → Context Intermediate Representation（提示精修） |
| H3-Base | 本地 | 768p 视频 + 音频生成（开源权重） |
| H3-Regenerate-2K | 云端 API | 2K 重生（将 768p + 原始上下文回送 H3 重生） |

**部署方式**：

- **SGLang / vLLM-Omni**（生产服务，OpenAI 兼容视频端点；4×B300 上 8.7 秒片端到端约 87 秒）
- **Diffusers**（Python 管线）
- **ComfyUI**（day-0 原生支持，自带工作流模板）
- **WanGP**（低显存）

**硬件需求**：

- **12 GB 显存**（RTX 3060 级）出 480p
- **16–24 GB 显存** 从容
- **5–8 GB 显存**（社区 FP8/INT4 量化方案）
- 系统内存 32–64 GB
- 无 GPU 可用 Colab

→ **对我们的应用**：H3 在我们媒体通道中（B5 参考生视频 / B8 文生视频）的工作流模板参数（分辨率、时长、画幅、显存门限）可参考本节对齐；3 模块拆分（Context-IR 云端 + Base 本地 + Regenerate-2K 云端）的"云端做精修、本地做主力"思路也适用于我们的 qwen-image + Music3 调度。

## 3. 与我们体系的对照（可借鉴 / 不可替代 / 不可连）

| 维度 | MiniMax Design | 我们的体系 | 结论 |
|---|---|---|---|
| 画布自动连线 | 内容自动按流程连线、步骤节点 | 已升级为画布式界面（见《短剧Agent平台设计》） | **借鉴**：画布 + 状态着色 + 预览跳转 |
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
| 生成通道 | 云端多模型矩阵（海螺/可灵/Veo3/Wan…） | R8 红线：固定 2512 + H3 + 豆包 T2A | **不可替代**：红线通道我们不改 |
| ComfyUI 接入 | Hub 托管，端口不可覆盖（实测） | 执行适配层可配置地址 + ComfyUI `--listen 0.0.0.0` | **不可连**：Design 连不了局域网实例，我们自研工作台可以 |
| 状态机/溯源 | 无流程状态机、无镜头 json 溯源 | proj.py 状态机 + 30 种校验 + prompt_id 溯源 | **不可替代**：Design 无此层 |
| 部署 | 本地部署 Beta（H3 工作流） | venv 无 docker 一键启动 | **参考**：本地优先一致 |
| **H3 部署形态**（v1.1 新） | SGLang / vLLM-Omni / Diffusers / ComfyUI 四线部署；12GB 显存可出 480p | ComfyUI 是统一媒体引擎（设计 §0.1 原则五） | **同源**：我们与 Hub 在 ComfyUI 路径一致，硬件门限可对齐 |

**结论**：MiniMax Design 适合做"创意发散 / 云端多模型内容生产"的参考形态与对照物；我们的工作台定位（画布 + 内嵌 Agent + 规范门禁 + 可配置 ComfyUI）在当前版本 Design 上无法实现，需自研（见《短剧Agent平台设计》）。

## 4. 来源与版本

- 官方手册：《MiniMax Design - 手册与指南》（飞书 wiki VEoVwpfCKiTHvHkAGQ7cQJxCncf，docx RC33dT20ooJnBUxhoJpcU5GDnsc，revision 11360）——功能全景/创作方式/Skill 生态/插件/商用/质量检查（官方口径）
- 官方页面：design.minimaxi.com/h3（H3 本地部署/硬件/商用 FAQ，官方口径）；design.minimaxi.com/campaign（开源与部署教程入口）
- **官方 GitHub：github.com/MiniMax-AI/MiniMax-H3（v1.1 新增）**——SKILL.md 官方格式 / 9 个官方 Skill / H3 模型技术规格 / 三模块系统 / SGLang vLLM ComfyUI 部署
- 社区实测：Je《本机 ComfyUI 与 MiniMax Design 接管指南》（je-qljx.github.io，2026-08-23）——架构/端口/ComfyUI API/云端能力清单（实测，注意时效）
- 用户实测：MiniMax Design 设置 → ComfyUI 截图（2026-10-02）——启动参数界面 / Hub 托管结论（以用户实测为准）
- 时效声明：Design 版本迭代快（手册含 v3.0.16 更新：Wan 3.0、Agent 自定义模型接入、画布对齐吸附），本节内容基于 2026-10-09 时点

## 5. 版本记录（入口）

- 本文件版本：v1.0（2026-10-02）；v1.1（2026-10-09）增量：从 MiniMax H3 GitHub 仓库 + design.minimaxi.com/campaign 官方页面补充 SKILL.md 格式、画布节点类型、ComfyUI 工作流侧栏、Agent 驱动工作流、提示词 5 段式、复现性规范、H3 技术规格与部署；变更史记入《版本记录.md》（AI 可读）。
- 镜像纪律：改本文 md 必须同步 .html（人读镜像），两版标题/正文/数字逐一对齐；html 非独立事实源。
