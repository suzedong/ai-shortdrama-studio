# SDG-RE 需求规格 · feature-008 Agent 运行时集成（opencode 基座）

> 状态：**v1.2 已批准（2026-10-04；D-SCOPE-1 经 D-007→D-009→D-010 三次裁决，终局：三类媒体全部经本地/局域网 ComfyUI 权重推理，媒体零公网）**
> 日期：2026-10-04
> 架构依据：《短剧Agent平台设计.md》v1.7 §0.1 / §4 / §5 / §8 / §10 / §11
> 决策依据：本目录《SDG-AI-变更记录.md》D-001 ~ D-010

---

## 1. 背景与必要性

MiniMax Design 的智能内核是**未经魔改的标准 opencode + MCP 网关**（实测证据见《docs/research/MiniMax Design功能与架构参考.md》§2.1）。本项目立项原因是 Design 存在两个缺口：

1. 不能调用本地 / 局域网 ComfyUI（端口与数据目录被托管封闭）；
2. 不具备旧工作体系的完整八步生产闭环。

本项目 feature-001 ~ 007 以「renderer 状态机 + 主进程直连火山方舟」的自建方式跑通了文本侧三阶段，但该方式存在结构性问题（详见 feature-008 D-004 的问题清单）：状态三处存储、无事件流、Agent 会话手写、媒体阶段无法承接。

因此需要在进入媒体类专职 Agent 开发前，先落 **opencode 统一 Agent 运行时基座**，使后续 Agent 以配置（agent-profiles）而非自研编排实现。

## 2. 目标

本 Feature 只做**运行时基座与第一个 Agent profile**，采用绞杀者模式，不破坏现有功能：

| # | 目标 | 验收方向 |
|---|---|---|
| G1 | 应用可在本机拉起 / 关闭 / 健康检查 `opencode serve`（无头 HTTP） | 生命周期可测，崩溃可感知 |
| G2 | renderer 不经任何网络直连，仅经 IPC 适配层使用运行时 | 安全边界成立 |
| G3 | 主进程可经 opencode 完成：会话创建、发送 prompt、中止、订阅 SSE 事件 | 端到端可验证 |
| G4 | 落地**主控 Agent（导演）profile**，且模型通道符合红线（文本经火山方舟自定义 provider；图像/视频/音乐通道写死） | profile 配置 + 契约校验 |
| G5 | SSE 事件经主进程转换为**本平台自有事件 DTO**推送 renderer，不泄露 opencode 原始结构 | 事件投影层可测 |
| G6 | 现有 feature-001 ~ 007 的全部功能与测试**零回归**（旧 IPC 通道全部保留） | 全量测试通过 |

## 3. 用户场景

### 场景 A：启动即就绪（主）
用户启动应用后，应用在后台拉起 opencode 运行时；用户无感知。打开开发者视角的运行时状态时，可见运行时「运行中 / 端口 / 版本 / 健康」。运行时启动失败时，应用仍可正常打开，并给出明确的不可用状态与原因（不白屏、不闪退）。

### 场景 B：Agent 会话与会话流（基座能力，本期无 UI 闭环）
系统（主进程）能为当前项目创建一个 opencode 会话、向会话发送文本、收到流式响应与事件、必要时中止。本 Feature 通过**自动化集成测试**验证该链路，不要求改造现有对话 UI。

### 场景 C：主控 Agent 配置就位
主控 Agent（导演）profile 作为配置文件随应用生效：它能理解任务、产出结构化结果（经 opencode json_schema 结构化输出），且只能使用允许的模型通道。

## 4. 范围

### 4.1 本期 In Scope

1. opencode 二进制获取方案（开发期解析 + 打包期分发方案设计，见 §6 待决策点 D-SCOPE-2）。
2. 主进程运行时管理器：启动 `opencode serve`（固定 127.0.0.1、随机/配置端口、HTTP Basic 认证）、健康检查、端口探测、关闭与退出清理。
3. 主进程 opencode 客户端（client-only 模式连接已启动的 serve，不使用 SDK 的自启动 server 能力，避免双进程）。
4. 新增 `runtime:*` 命名空间 IPC 适配层 + preload 暴露（通道清单见《契约》）。
5. 运行时事件投影：opencode SSE → 本平台 RuntimeEvent DTO → `webContents.send` 推流。
6. 火山方舟作为 opencode **自定义 OpenAI 兼容 provider** 的配置生成（API Key 仍只来自 `.env`）。
7. 主控 Agent（导演）profile 配置（首个 profile；其余六名专职 Agent 不在本期）。
8. 单元测试 + 以 mock provider 跑通的端到端链路测试。

### 4.2 本期 Out of Scope（明确不做）

| 不做 | 归属 |
|---|---|
| feature-001 ~ 007 任一对话/画布 UI 的迁移改造 | 后续独立 Feature（建议立项流为首个垂直切片，另行立项） |
| 编剧 / 美术 / 镜头 / 声音 / 引擎 / 剪辑 6 个专职 profile | 各自 Feature |
| MCP 媒体工具（image.submit / video.submit / music.submit）、引擎工具、剪辑工具的真实实现 | 对应媒体 Feature |
| 005/007 确定性规则（变更传播 / 解锁顺序）下沉 MCP | 后续 Feature（D-004 方向记录） |
| 事件流 events.log 落盘、WorkflowState 归属重定、renderer 状态机退场 | 后续迁移 Feature |
| 现有 `agent:*` `session:*` `chat:*` 等通道的删除或改签名 | 绞杀者后期 |
| 安装包分发（electron-builder 完整配置、签名公证） | 打包 Feature，本期仅出方案 |

## 5. 功能溯源标注

| 能力 | 标签 |
|---|---|
| opencode 运行时、SSE、会话/消息、agent profile、结构化输出机制 | **[Design 原有]**（开源同源组件，形态对齐） |
| `runtime:*` IPC 适配层、RuntimeEvent 投影 DTO、renderer 不直连的边界 | **[改编]**（为 Electron 主从安全边界改造） |
| 主控 Agent 与后续八步业务的结合、火山方舟自定义 provider | **[改编]** |
| 局域网 ComfyUI、八步状态层 | **[自研新增]**（不在本 Feature 落地） |

## 6. 待决策点（**已于 2026-10-04 全部拍板，结论见变更记录 D-006 ~ D-008；历史建议方案保留备查**）

**拍板结论：**

| 编号 | 结论 | 落账 |
|---|---|---|
| D-SCOPE-1 | **终局（D-010 三次裁决，v1.7）**：图像 qwen-image 权重（B0）、视频 H3（B5/B8）、音乐 Music3 权重（B9）**三类媒体全部经本地/局域网 ComfyUI 推理，纯局域网、媒体生成零公网、无媒体云端 Key**；ComfyUI = 统一媒体引擎；出公网仅余文本火山方舟。轨迹：D-007（图像/音乐云端）→ D-009（图像回 ComfyUI）→ D-010（音乐回 ComfyUI） | **D-010（现行）**；D-007/D-009 已被部分反转，永久保留轨迹 |
| D-SCOPE-2 | 经 npm 包 `opencode-ai` + 平台 optionalDependency 获取二进制，精确版本 **1.18.34** 锁死；打包 extraResources 本期仅出方案 | D-003 / D-006（K9） |
| D-SCOPE-3 | 仅 127.0.0.1，4096 起动态探测端口，禁 mDNS/CORS | D-008 |
| D-SCOPE-4 | 随机 Basic 口令仅存主进程内存，经环境变量注入，不落盘、不进 IPC | D-008 |
| D-SCOPE-5 | 内置 mock provider 供无 Key 与测试，生产保留但标注测试用途，director 默认 ark | D-008 |

**历史建议方案（备查）：**

| 编号 | 分歧 / 待确认 | 建议方案 |
|---|---|---|
| D-SCOPE-1 | **图像通道在《设计.md》§5/§8 与 §0.1 原则五存在表述冲突**：§5/§8 写图像统一经 ComfyUI 工作流，原则五（v1.4 更新）写图像仅 qwen-image（云端）。视频两章一致（H3 = ComfyUI）。 | ~~以原则五为准：图像 = qwen-image 云端 API、音乐 = Music3 云端~~ **【该建议已失效】** 同日经 D-009（图像回 ComfyUI）、D-010（音乐回 ComfyUI）三次裁决，终局见上方拍板结论表：三类媒体全部本地/局域网 ComfyUI 权重推理。 |
| D-SCOPE-2 | opencode 二进制分发：开发期与打包期如何获取 | 开发期用 npm 包 `opencode-ai` 提供的可执行文件（install 脚本拉取平台二进制，版本锁定）；打包期经 electron-builder `extraResources` 携带 + 按平台选择。引入该 npm 包属 **K9**，需在契约评审签字。 |
| D-SCOPE-3 | 运行时监听端口策略 | 固定 127.0.0.1 + 动态选空闲端口（从 4096 起探测），实际端口经 `runtime:status` 暴露；不对外网/局域网监听。 |
| D-SCOPE-4 | Basic 认证口令存储 | 每次启动由主进程生成随机口令，仅存内存，经环境变量注入子进程；renderer 永远拿不到口令（renderer 只走 IPC）。不落盘。 |
| D-SCOPE-5 | 无 Key 链路 | opencode provider 配置中支持 `mock` provider（脚本/桩响应），使 G3/G4/G5 测试与无 Key 开发可运行；替代现散落的 `mockXxx` 是后续 Feature 的事。 |

## 7. 验收总标准（详细 AC 见《任务清单》）

1. `opencode serve` 可被应用拉起，`GET /global/health` 返回 healthy，应用退出时子进程被正确回收（无残留进程）。
2. renderer 进程不持有 opencode URL / 端口 / 口令，不发起对 opencode 的任何 HTTP 请求。
3. 经 `runtime:*` IPC 可完成「创建会话 → prompt → 流式事件 → 中止」全链路，事件为本平台自有 RuntimeEvent DTO。
4. 主控 profile 生效且通道红线可验证：无法被 prompt 诱导切换到非允许模型。
5. `npm run test:run` 与 `npm run typecheck` 全绿，feature-001~007 零回归。
6. 运行时缺失 / 启动失败时应用可正常启动，状态接口返回结构化错误而非崩溃。
