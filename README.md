# 短剧 Agent 平台（ai-shortdrama-studio）

> AI Agent 驱动的短剧内容生产桌面应用 —— 模仿 MiniMax Design 的交互形态，为 AI 短剧从零设计。**一块画布 = 一条连续生产线；一个指令 = 一支虚拟摄制组。**

当前版本：v0.1.0（原型期）｜设计基线：v1.11（2026-10-09 定稿）

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

- **多 Agent 摄制组**：主控 + 专职 Agent 并行，经 MCP 网关 + Agent 运行时协作（opencode 运行时，仅本机）。
- **确认门（人是导演）**：关键节点 Agent 暂停下游、发起确认门卡片，人工是唯一阻塞点，无隐藏自动放行。
- **ComfyUI 统一媒体引擎（硬边界）**：图像（qwen-image）/ 视频（MiniMax H3）/ 音乐（Music3）三类媒体**全部经本地 / 局域网 ComfyUI 权重 / 工作流推理**——媒体生成零公网、无媒体云端 Key；平台出公网仅余文本侧火山方舟。
- **画布即真相**：全部产物与过程在一块画布上可见，节点自动连线，数据流即视觉。
- **纯 JSON 文件持久化**：无数据库；事件流可重放；产物版本自动归档。
- **Skill 沉淀**：一次跑通的过程可沉淀为可复用 Skill。

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron 33 |
| 渲染器 | React 18 + TypeScript + Vite + Tailwind CSS |
| Agent 运行时 | opencode（@opencode-ai/sdk 1.18） |
| 工具协议 | MCP（@modelcontextprotocol/sdk，仅 127.0.0.1 本地网关） |
| 文本模型 | 火山方舟（OpenAI 兼容接口） |
| 媒体引擎 | 本地 / 局域网 ComfyUI（qwen-image / H3 / Music3 权重 / 工作流） |
| 持久化 | 纯 JSON 文件（项目目录 + 版本归档目录），无数据库 |
| 测试 | Vitest + Testing Library |

## 快速开始

### 前置要求

- Node.js 18+（建议 20 LTS）
- npm
- 可选（媒体生成必需）：本地或局域网 ComfyUI 实例，且已就位 qwen-image / H3 / Music3 三类权重 / 工作流（地址在应用内配置，支持多实例）

### 安装与运行

```bash
npm install
```

配置环境变量（文本通道必需）：

```bash
cp .env.example .env
# 编辑 .env，填入火山方舟 API Key 与模型接入点
```

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

`.env` 已加入 `.gitignore`，不入库。未配置 Key 时应用显式报 `UPSTREAM_AUTH_MISSING`，不会静默降级。

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
│   ├── studio/          #   画布 / 对话 / 确认门 / 项目导航组件 + 编排测试
│   ├── components/  lib/
│   └── test/            # 主进程工具与运行时单测
├── shared/types.ts      # 前后端共享类型契约（只读，修改触发 K1 卡口）
├── resources/opencode/agents/  # 摄制组 Agent 提示词（主控/编剧/导演/美术/引擎）
├── docs/                # 文档体系（入口见 docs/README.md）
├── 短剧Agent平台设计.md    # 架构事实源（根目录）
├── 版本记录.md            # 项目级变更编年史
└── AGENTS.md            # AI 工具执行指令（项目特化版）
```

## 文档地图

文档体系较完整，**入口与阅读顺序见 [docs/README.md](./docs/README.md)**。快速索引：

- [短剧Agent平台设计.md](./短剧Agent平台设计.md) —— 产品与架构事实源（含 §7.1 数据血缘 / §5 运行时与工具族）
- [docs/design/短剧Agent平台设计.html](./docs/design/短剧Agent平台设计.html) —— 设计书人读镜像（信息图版）
- [docs/design/平台全景图.html](./docs/design/平台全景图.html) —— 唯一人读入口（概览）
- [docs/design/短剧Agent平台-原型.html](./docs/design/短剧Agent平台-原型.html) —— 高保真界面原型
- [docs/设计现状与偏差清单.md](./docs/设计现状与偏差清单.md) —— 磁盘实况 ↔ 设计的偏差与反向补录路线（开发导航）
- [docs/governance/SDG-AI-决策台账.md](./docs/governance/SDG-AI-决策台账.md) —— 立项级决策（永久保留）

## 当前状态与路线

- **已落地（磁盘实况）**：runtime 对话单轨、11 个纯 MCP 工具、三阶段数据血缘（STAGE 0→1→2 产物链）、版本归档、确认门桥、画布基座。
- **进行中**：`docs/features/` 任务包重建（旧 22 包已作废归档，按六步法反向补录，见 [docs/设计现状与偏差清单.md](./docs/设计现状与偏差清单.md)）。
- **未落地**：STAGE 3-7（资产 / 分镜 / 镜头 / 后期 / 发布）逐阶段扩展；ComfyUI 媒体引擎适配；T2A 人机通道；语音通道。

一期 MVP 目标：单集全闭环（立项 → 故事 → 分场 → 资产 → 分镜 → 镜头 → 后期 → 成片），详见设计书 §11。

## 安全与隐私

- 密钥（火山方舟 Key）只存本机 `.env`，不入库、不写入文档；首启引导填写。
- 项目数据默认纯本地（`~/Documents/ai-shortdrama-studio/project-*/`）；媒体生成不出公网。
- Agent 不持有删除 / 不可逆操作权限；所有变更经事件流留痕、可重放。
