# MiniMax Design 功能与架构参考

> **定位**：文档族参考文档（源 · 权威）。收录 MiniMax Design（MiniMax 官方内容生产 Agent 平台）的功能全景、架构实测与对我们体系的对照结论，供《短剧Agent平台设计》与后续开发逐条参照。**非规范成员**：本文件不定义流程规则，仅提供外部产品情报。
> 生成自：v1.0（2026-10-02）。来源：官方手册《MiniMax Design - 手册与指南》（飞书，revision 11360）+ 官方页面 design.minimaxi.com/h3 + 社区实测博客（Je，2026-08-23）+ 用户实测截图（2026-10-02）。本文区分「官方口径」与「实测」；html 为人读镜像（只改 md 源，同步 html）。

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

### 1.5 专业插件与工具（官方口径）

- **3D 导演台**：自然语言在 3D 场景摆放角色素体、调度机位与姿态，可多人，快速搭建分镜参考。
- **视频剪辑**：自然语言添加/修改字幕（内容/时间/位置）、添加转场/滤镜/贴纸、裁剪/拼接/顺序调整、画面比例与布局调整。
- **精品工具**：360° 全景图预览（世界模型固定场景）、重打光（电影级灯光氛围）、多角度（同一主体多机位）、多宫格分镜、批量水印/Logo/版权信息。

### 1.6 商用、协作与会员（官方口径）

- H3 社区许可：免版税商用（年收入 ≤ 2000 万美元 + 界面标注"MiniMax H3" + 遵守 AUP；产出与权重不得用于训练/改进其他非 H3 系模型）。
- 团队版：创建团队、管理成员、积分池共享（成员可单独配置额度）、团队项目资源共享（开发中）。
- 会员/积分：国内 design.minimaxi.com/media-plan/subscribe；年卡会员享 8 折生成优惠。
- 协作规范：需求写法 = 表达商业目标（非描述画面）；修改反馈公式 = **保留什么 + 修改什么 + 为什么 + 期望结果**；商业内容质量检查 8 条（商业目标明确/前三秒有效/卖点突出/产品信息准确/品牌视觉统一/文字字幕正确/节奏适配渠道/输出规格符合）。

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

### 2.2 ComfyUI 接入实测（重要结论 · 用户截图 2026-10-02）

用户实测 **设置 → ComfyUI** 界面：仅「**启动参数**」输入框（追加到 ComfyUI 后端启动命令的额外参数，如 `--lowvram`、`--preview-method auto`），界面明文：**「端口、数据目录等由 Hub 托管的参数无法覆盖」**；参数下次启动后端时生效。

**结论**：当前版本 MiniMax Design 的 ComfyUI 后端为 **Hub 内置托管**（随应用启动），设置只允许追加性能类参数，**端口/监听地址/服务地址不可配置 → 无法连接局域网内非本机 ComfyUI 实例**。此结论以用户实测为准；社区抖音教程曾演示"系统设置填 ComfyUI 服务地址"（疑似旧版本/不同版本界面），已不适用于当前版本。

## 3. 与我们体系的对照（可借鉴 / 不可替代 / 不可连）

| 维度 | MiniMax Design | 我们的体系 | 结论 |
|---|---|---|---|
| 画布自动连线 | 内容自动按流程连线、步骤节点 | 已升级为画布式界面（见《短剧Agent平台设计》） | **借鉴**：画布 + 状态着色 + 预览跳转 |
| Agent 任务确认 | 生成前确认参数、产出制作简报 | R4 确认门：check 全过 + 人点 advance | **同源**：都是"执行前人工把关"，Design 是软确认、我们是硬门禁 |
| Skill 沉淀 | 对话流程存 Skill、投稿分享 | skill 目录 + doubao-drama-pipeline 路由 | **借鉴**：创作过程沉淀为可复用 Skill 的思路 |
| 修改反馈公式 | 保留什么+修改什么+为什么+期望结果 | flag 反向回流（归因通道 + 受影响传导） | **互补**：公式可并入人机协作话术 |
| 质量检查 | 8 条商业内容检查 | 验收规则.json 30 种检查类型 | **互补**：Design 偏审美/商业口径，我们偏文件/内容级机器校验 |
| 生成通道 | 云端多模型矩阵（海螺/可灵/Veo3/Wan…） | R8 红线：固定 2512 + H3 + 豆包 T2A | **不可替代**：红线通道我们不改 |
| ComfyUI 接入 | Hub 托管，端口不可覆盖（实测） | 执行适配层可配置地址 + ComfyUI `--listen 0.0.0.0` | **不可连**：Design 连不了局域网实例，我们自研工作台可以 |
| 状态机/溯源 | 无流程状态机、无镜头 json 溯源 | proj.py 状态机 + 30 种校验 + prompt_id 溯源 | **不可替代**：Design 无此层 |
| 部署 | 本地部署 Beta（H3 工作流） | venv 无 docker 一键启动 | **参考**：本地优先一致 |

**结论**：MiniMax Design 适合做"创意发散 / 云端多模型内容生产"的参考形态与对照物；我们的工作台定位（画布 + 内嵌 Agent + 规范门禁 + 可配置 ComfyUI）在当前版本 Design 上无法实现，需自研（见《短剧Agent平台设计》）。

## 4. 来源与版本

- 官方手册：《MiniMax Design - 手册与指南》（飞书 wiki VEoVwpfCKiTHvHkAGQ7cQJxCncf，docx RC33dT20ooJnBUxhoJpcU5GDnsc，revision 11360）——功能全景/创作方式/Skill 生态/插件/商用/质量检查（官方口径）
- 官方页面：design.minimaxi.com/h3（H3 本地部署/硬件/商用 FAQ，官方口径）；design.minimaxi.com/campaign（开源与部署教程入口）
- 社区实测：Je《本机 ComfyUI 与 MiniMax Design 接管指南》（je-qljx.github.io，2026-08-23）——架构/端口/ComfyUI API/云端能力清单（实测，注意时效）
- 用户实测：MiniMax Design 设置 → ComfyUI 截图（2026-10-02）——启动参数界面 / Hub 托管结论（以用户实测为准）
- 时效声明：Design 版本迭代快（手册含 v3.0.16 更新：Wan 3.0、Agent 自定义模型接入、画布对齐吸附），本节内容基于 2026-10-02 时点

## 5. 版本记录（入口）

- 本文件版本：v1.0（2026-10-02）；变更史记入《版本记录.md》（AI 可读）。
- 镜像纪律：改本文 md 必须同步 .html（人读镜像），两版标题/正文/数字逐一对齐；html 非独立事实源。
