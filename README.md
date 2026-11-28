# 短剧 Agent 平台（ai-shortdrama-studio）

> AI Agent 驱动的短剧内容生产桌面应用 —— 全面复刻 MiniMax Design、短剧生产闭环优先，并保留本地 / 局域网 ComfyUI 与完整八步生产体系。**一块画布 = 一条连续生产线；一个指令 = 一支虚拟摄制组。**

当前版本：v0.1.0（原型期）｜设计基线：v1.34（2026-11-28）

## 它是什么

用户只表达创作目标（一句话或一份策划案），**主控 Agent 像导演一样把任务拆给一支虚拟摄制组**——编剧、美术、镜头、声音、引擎、剪辑各有专职 Agent，在同一块画布上并行作业，自动产出剧本、定妆、分镜、镜头、配音、剪辑，直到成片交付。

不是"聊天框 + 几个模型按钮"，而是完整的短剧生产工作台。

## 核心能力

- **八步生产闭环**（业务验收基线，不允许合并或裁剪）：

  | # | 阶段 | 产物 |
  |---|---|---|
  | 0 | 立项 | 选题诊断 / 故事背景档案 / 立项定案卡 |
  | 1 | 故事 | 故事大纲 / 人物小传 |
  | 2 | 剧本分场 | 分场表 / 台词 |
  | 3 | 资产 | 角色 / 场景 / 道具资产 |
  | 4 | 分镜 | 分镜表（镜号/景别/运镜/资产引用） |
  | 5 | 镜头 | 逐镜生成与收片 |
  | 6 | 后期 | 剪辑 / 字幕 / 合流 / 混音 |
  | 7 | 发布 | 成片 / 切片 / 渠道交付 |

- **多 Agent 摄制组**：showrunner 唯一主控，经 `task` 统一委派 writer / media-director / comfyui-operator 三个 subagent；subagent 禁止嵌套委派，工具经 MCP 网关与 opencode 运行时协作（仅本机）。
- **确认门（人是导演）**：关键节点 Agent 暂停下游、发起确认门卡片，人工是唯一阻塞点，无隐藏自动放行。
- **ComfyUI 统一媒体引擎（硬边界）**：图像（MiniMax H3 Image）/ 视频（MiniMax H3）/ 音乐（MiniMax Music3）三类媒体**全部经本地 / 局域网 ComfyUI 权重 / 工作流推理**——媒体生成零公网、无媒体云端 Key；文本 Provider 为火山方舟 / LM Studio 二选一，仅选择火山方舟时文本调用出公网。当前生产仅 H3 Image 文生图链已接入。
- **画布即真相**：全部产物与过程在一块画布上可见，节点自动连线，数据流即视觉。
- **纯 JSON 文件持久化**：无数据库；文本产物 JSON 事实源 + MD 镜像双写、覆盖前自动归档到 `版本/`；消息流由 opencode 会话库 + `.session.json` 绑定回放（`events.log` 已按 R-001 取消）。
- **Skill 沉淀**：一次跑通的过程可沉淀为可复用 Skill。

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron 33 |
| 渲染器 | React 18 + TypeScript + Vite + Tailwind CSS |
| Agent 运行时 | opencode（@opencode-ai/sdk 1.18） |
| 工具协议 | MCP（@modelcontextprotocol/sdk，仅 127.0.0.1 本地网关） |
| 文本模型 | 火山方舟 / LM Studio 二选一（OpenAI 兼容接口，D-021 / D-022） |
| 媒体引擎 | 本地 / 局域网 ComfyUI（MiniMax H3 Image / H3 / Music3 权重 / 工作流） |
| 持久化 | 纯 JSON 文件（项目目录 + 版本归档目录），无数据库 |
| 测试 | Vitest + Testing Library |

## 快速开始

### 前置要求

- Node.js 18+（建议 20 LTS）
- npm
- 可选（媒体生成必需）：本地或局域网 ComfyUI 实例；当前 H3 Image 生产链须具备对应权重 / 工作流，H3 视频与 Music3 参考能力尚未正式接入生产（地址在应用内配置，支持多实例）

### 安装与运行

```bash
npm install
```

**首选应用内配置**：启动后在「AI 服务设置」选择服务商（火山方舟 / LM Studio）并填写 Key 与接入点。火山方舟 Key 经系统安全存储（`safeStorage`）加密后落到 `<userData>/ai-service.json`，界面只显示脱敏值，不可加密即拒绝保存；LM Studio 走本地 / 局域网，无需云端 Key。环境变量仅作开发态回退（优先级低于应用内配置），见下表。

启动开发环境（同时拉起 Vite 渲染器与 Electron 主进程）：

```bash
npm run dev
```

### 环境变量

| 变量 | 说明 | 获取方式 |
|---|---|---|
| `ARK_API_KEY` | 火山方舟 API Key | 火山方舟控制台 → API Key 管理 |
| `ARK_MODEL` | 模型接入点 endpoint ID | 火山方舟 → 在线推理 → 创建推理接入点（如 doubao-seed-1.6） |
| `ARK_BASE_URL` | API Base URL | 默认 `https://ark.cn-beijing.volces.com/api/coding/v3` |

`.env` 已加入 `.gitignore`，不入库、不写入文档。按 [D-021](./docs/governance/SDG-AI-决策台账-2026.md) 第 6 条，应用级配置一律 `safeStorage` 加密落盘；store 字段缺席时允许回退到环境变量（开发态 `.env` 工作流保留），明文 Key 不出主进程内存。未配置 Key 时应用显式报 `UPSTREAM_AUTH_MISSING`，不会静默降级。

### 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发：Vite + Electron 联调 |
| `npm run dev:renderer` | 仅启动 Vite 渲染器 |
| `npm run test:run` | 运行全部单测（Vitest） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 构建渲染器 + 主进程（tsc + vite build） |
| `npm run start` | 以 Electron 运行已构建产物 |

## 项目结构

```
ai-shortdrama-studio/
├── electron/            # 主进程：MCP 网关、Agent 运行时、文件/画布/资产/确认门/ComfyUI 工具
│   ├── mcp/             #   本地 MCP 网关（server.ts / tools.ts）
│   ├── runtime/         #   Agent 运行时（会话、事件投影、provider）
│   ├── fs/              #   文件读 / 路径白名单 / 版本归档 / 写队列
│   ├── canvas/          #   画布节点与连线存储
│   ├── asset/  comfy/  gate/  project/
│   ├── ark.ts           #   火山方舟文本通道
│   ├── main.ts / preload.ts
├── src/                 # 渲染器：画布工作台、对话区、确认门卡、StudioApp
│   ├── studio/          #   画布 / 对话 / 确认门 / 项目导航组件 + 编排/UI 测试
│   ├── lib/             #   渲染器运行时对接（chat-runtime 等）
│   └── test/            # 主进程工具与运行时单测
├── shared/types.ts      # 前后端共享类型契约（只读，修改触发 K1 卡口）
├── resources/opencode/agents/  # 摄制组 Agent 提示词（showrunner 唯一主控 / writer / media-director / comfyui-operator 三个 subagent）
├── docs/                # 文档体系（入口见 docs/README.md）
├── 短剧Agent平台设计.md    # 架构事实源（根目录）
├── 版本记录.md            # 项目级变更编年史
└── AGENTS.md            # AI 工具执行指令（项目特化版）
```

## 文档地图

文档体系较完整，**入口与阅读顺序见 [docs/README.md](./docs/README.md)**。快速索引：

- [短剧Agent平台设计.md](./短剧Agent平台设计.md) —— 产品与架构事实源（含 §7.1 数据血缘 / §5 运行时与工具族）
- [docs/design/短剧Agent平台总览.html](./docs/design/短剧Agent平台总览.html) —— 本项目总览：要做什么、怎么做、做到哪、如何落地
- [docs/design/MiniMax Design总览.html](./docs/design/MiniMax%20Design总览.html) —— 参考端总览：它怎么做、与本项目有什么区别
- [docs/design/短剧Agent平台-原型.html](./docs/design/短剧Agent平台-原型.html) —— 高保真界面原型
- [docs/设计现状与偏差清单.md](./docs/设计现状与偏差清单.md) —— 当前未闭环的设计 ↔ 实现偏差（开发导航）
- [docs/governance/SDG-AI-决策台账.md](./docs/governance/SDG-AI-决策台账.md) —— 立项级决策（永久保留）

## 当前状态与路线

- **已落地（实现证据）**：runtime 对话单轨、29 个纯 MCP 工具（11 族）、STAGE 0 / 1 / 2-a / 2-b / 2-c 产物链、版本归档、确认门桥、画布基座、manifest 7 态状态机、立项再版与影响评估面板、视觉风格谱系、AI 服务配置及未选项目首启引导。
- **任务包入口**：模块、当前负责 Feature 与状态以 [docs/features/README.md](./docs/features/README.md) 为准；普通修改归原负责包，独立新能力才新建 Feature（D-037）。各包实施与验收边界以包内契约、任务清单和证据为准，本页不复制动态计数。
- **未落地**：STAGE 3-7（资产 / 分镜 / 镜头 / 后期 / 发布）完整生产闭环；H3 视频与 Music3 生产链；完整产品面 Parity 验收；语音通道仍待裁决。

现行路线为 P0—P7：先收口基线与桌面工作台，再统一媒体引擎、视觉生产链、后期发布、Agent 生态与完整产品面，最后全量验收；详见设计书 §11、[Parity 影响矩阵](./docs/design/MiniMax%20Design%20Parity影响矩阵.md) 与 [P0 基线报告](./docs/verification/p0-2026-11-15/P0基线报告.md)。

## 安全与隐私

- **密钥**：火山方舟 Key 经 Electron `safeStorage` 加密存 `<userData>/ai-service.json`（不可加密即拒绝保存），preload 只暴露脱敏视图；`.env` 仅作开发态环境变量回退，不入库、不写入文档（[D-021](./docs/governance/SDG-AI-决策台账-2026.md)）。项目导出会排除密钥文件与 `.env*`。
- **项目数据**：默认纯本地 `~/Documents/ai-shortdrama-studio/project-*/`，根目录可在设置面板更换（feature-813）；媒体生成不出公网。**真机验收也用这个真实工作区**（应用级配置由 `ASD_USER_DATA` 隔离，环境准备见 `scripts/acceptance-env.cjs`）；Vitest 单测临时目录收敛在仓库内 `.test-tmp/`（`ASD_TEST_TMP` 可覆盖），不再散落系统临时目录。应用级配置（工作区根、当前项目指针、ComfyUI 实例、opencode 运行时配置）集中在 `<userData>/`，与项目目录分离；完整落点对照见[设计书 §7.2](./短剧Agent平台设计.md)。
- **变更追溯**：`events.log` 已按 R-001 取消；产物覆盖前写入 `版本/` 归档，`manifest.json` 记录状态指针，消息历史由 opencode 会话库经 `.session.json.activeSessionId` 回放。Agent 不持有删除 / 不可逆操作权限。
