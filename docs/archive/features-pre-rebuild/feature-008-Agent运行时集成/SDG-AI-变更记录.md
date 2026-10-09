# SDG-AI 变更记录 · feature-008 Agent 运行时集成（opencode）与开发原则确立

> 三分类：决策记录（永久）/ 实施记录（落地清理）/ 修订记录（闭环清理）。
> 说明：本任务包的需求规格 / 契约 / 任务清单尚未编制；本文件先登记 2026-10-04 已拍板的立项级决策。

## 一、决策记录（永久保留）

### D-001 · K6 新增业务包 feature-008「Agent 运行时集成」

- 日期：2026-10-04
- 卡口：**K6（新增业务包/顶层目录）**
- 触发：用户确认 opencode 集成需求——定位「完全对标 Design」、形态「打包 opencode 二进制」、时机「近期纳入架构」。
- 决策：新建任务包 `docs/features/feature-008-Agent运行时集成/`，承载：① opencode 运行时打包与生命周期；② 自建运行时（electron/session.ts、electron/ark.ts）的绞杀者式替换；③ 事件流事实源与 IPC 适配层。
- 用户签字：**方向已批准（2026-10-04，AskUserQuestion）；三份规格待编制后另行报批**。
- 范围边界：本任务包遵循已拍板开发原则（见 D-002），不得使局域网 ComfyUI 能力失效。

### D-002 · K7 新增「本项目开发原则」并写入 AGENTS.md

- 日期：2026-10-04
- 卡口：**K7（修改 AGENTS.md 核心规则）**
- 触发：用户提出制定项目开发原则与边界条件，明确要求「两处都写」（平台设计文档 + AGENTS.md）。
- 决策：
  1. 《短剧Agent平台设计.md》新增 §0.1「开发原则与边界条件」，版本升 v1.3（§13 登记）；
  2. AGENTS.md 新增 §0.1「本项目开发原则」，与平台设计 §0.1 同源一致。
- 原则内容（四条，用户拍板原文口径）：
  1. **项目必要性**：只填补 MiniMax Design 两类缺口——无法调用本地/局域网 ComfyUI、不具备旧工作体系完整闭环；不做超出缺口的功能扩张；
  2. **局域网 ComfyUI 硬边界**：必须支持本地及局域网 ComfyUI（地址可配置、多实例），使该能力失效的设计视为破坏边界；
  3. **八步闭环完整性**：0 立项 → 1 故事 → 2 剧本分场 → 3 资产 → 4 分镜 → 5 镜头 → 6 后期 → 7 发布，每步有明确产物，不得合并或裁剪；
  4. **继承 + 扩展**：Design 已有功能做形态对齐（交互/流程/数据表现一致，底层用 opencode、MCP、Skill 等开源同源组件自行实现，不复用其闭源代码）；缺失功能自研扩展，以 [Design 原有]/[改编]/[自研新增] 标签标明来源。
- 八步内容来源：用户 2026-10-04 通过 AskUserQuestion 明确给出（此前仓库无定义）。
- 现状标注：八步中 0/1/2 及 4 的文本部分已随 feature-001~007 落地；3 资产、5 镜头、6 后期、7 发布为待建。
- 用户签字：**已批准（2026-10-04，AskUserQuestion：两处都写 + 形态对齐）**。
- 落地位置：《短剧Agent平台设计.md》§0.1 / §13；AGENTS.md §0.1。

### D-003 · K9 opencode 作为统一 Agent 运行时（二进制打包分发）

- 日期：2026-10-04
- 卡口：**K9（引入新核心依赖）**
- 决策：引入开源 opencode（https://opencode.ai）作为平台统一 Agent 运行时，对标 Design 实测架构（标准 opencode + MCP 网关）：
  1. opencode 二进制随 Electron 应用打包（extraResources），安装即用；需覆盖 macOS / Windows 双平台与签名；
  2. 主进程拉起 `opencode serve`（仅 127.0.0.1，启用 OPENCODE_SERVER_PASSWORD），renderer 不直连，经 IPC 适配访问；
  3. 主控与各专职 Agent 以 opencode agent-profiles 实现；本平台 mcp/server.ts 作为 opencode 挂载的 MCP 网关保留；
  4. 火山方舟作为 opencode 的 OpenAI 兼容自定义 provider 注入，ARK_API_KEY 仍走 .env。
- 调研依据：opencode 提供无头 serve（HTTP + OpenAPI）与官方 SDK，Design 的 router/planner/executor/media-agent/comfyui-agent 即基于 agent-profiles 实现（《docs/research/MiniMax Design功能与架构参考.md》§2.1）。
- 用户签字：**已正式签字（2026-10-04，AskUserQuestion D-SCOPE-2 批准引入 npm 包方案；规格三件套经 NotifyUser 批准）**。
- 关联：精确版本、二进制解析方式、SDK 引入见 **D-006**；打包细节（extraResources）本期仅出方案，随打包 Feature 落地。

### D-004 · K3/K8 自建运行时替换（绞杀者策略已签字）

- 日期：2026-10-04
- 卡口：**K3（旧系统改造/弃用/替换）、K8（新增 runtime:* IPC 命名空间；旧通道签名不动）**
- 背景：替换对象为 electron/session.ts（会话/消息持久化）、electron/ark.ts（模型直连）、现有 agent:*/session:*/chat:* 通道；feature-001~007 影响评估已完成（2026-10-04 对话结论）。
- 采用方向（**已随 feature-008 规格三件套 2026-10-04 批准签字**）：
  1. **绞杀者模式**：先落二进制 + 生命周期 + `runtime:*` 适配 IPC（命名空间最终定为 `runtime:*`，非早期草案的 opencode:*；见契约 §3），旧 27 个通道全部保留零回归；以立项流为首个垂直切片，再迁故事/剧本，最后删除旧通道；
  2. **确定性规则下沉**：feature-005/007 的变更传播、解锁顺序、谱系硬校验下沉为 MCP 工具硬约束，不依赖提示词；
  3. **事件流为事实源**：events 事件模型取代「renderer 多 useState + workflow 整包快照」的三处存储；renderer 降级为投影；
  4. 无 Key 开发链路改为 opencode mock provider，替代散落的 mockXxx。
- 存量迁移：现有 v1.x 项目按 AGENTS.md 存量迁移四步法处理，快照补到 docs/SDG-OD-legacy/。
- 用户签字：**已正式签字（2026-10-04，规格三件套经 NotifyUser 批准；D-SCOPE-1~5 经 AskUserQuestion 逐项拍板）**。本期 feature-008 只落基座 + director profile；旧通道删除、规则下沉、events.log 等均为后续独立 Feature。

### D-005 · K7 新增「原则五 · 生成通道红线」

- 日期：2026-10-04
- 卡口：**K7（修改 AGENTS.md 核心规则）**
- 触发：用户拍板固定生成通道——「图像我们只用 qwen-image，视频只用 MiniMax H3」。
- 决策：AGENTS.md §0.1 与《短剧Agent平台设计.md》§0.1 同步新增原则五：
  1. **图像：仅 qwen-image**；
  2. **视频：仅 MiniMax H3**（本地 / 局域网 ComfyUI 工作流）；
  3. **音乐：仅 MiniMax Music3**；
  4. Agent 不得自行选择或切换其他图像 / 视频 / 音乐模型；
  5. Design 云端多模型矩阵（海螺 / 可灵 / Veo3 / Wan / seedream / Midjourney 等）本项目**不沿用**；
  6. 语音（TTS / 声音克隆）通道暂未限定，待后续决策。
- 用户签字：**已批准（2026-10-04 用户直接拍板；音乐通道为同日追加）**。
- 落地位置：《短剧Agent平台设计.md》§0.1（版本升 v1.4）/ AGENTS.md §0.1。
- 工程影响（待 feature-008 规格细化）：① Agent profile 的模型选择约束需写死该通道；② MCP 媒体工具仅暴露 qwen-image、H3 ComfyUI、Music3 三类生成执行能力；③ 与原则二（局域网 ComfyUI）共同决定 MCP 工具必须支持可配置地址。

### D-006 · K9 opencode 精确版本锁定与二进制解析方式

- 日期：2026-10-04
- 卡口：**K9（引入新核心依赖及精确版本）**——D-003 的落地签字条目。
- 触发：用户在 D-SCOPE-2 批准经 npm 包获取 opencode 二进制，并指示「先只落 D-006，暂不写码」。
- npm 事实（2026-10-04 经 `npm view` 核实，registry.npmjs.org）：
  1. **`opencode-ai@1.18.34`**（dist-tag `latest`）：`bin.opencode = bin/opencode.exe`（平台无关 launcher），`os` 声明 darwin/linux/win32；
  2. 平台真二进制经 `optionalDependencies` 同版本下发：`opencode-darwin-arm64/x64`、`opencode-windows-x64/arm64`、`opencode-linux-x64/arm64`（含 musl / baseline 变体），均锁定 **1.18.34**；
  3. **`@opencode-ai/sdk@1.18.34`**（dist-tag `latest`，ESM `module` 入口）。
- 决策：
  1. `package.json` 加入两依赖，版本**精确写死 `1.18.34`**，禁止 `^` / `~` / `latest` 等任何浮动形式；升级必须重新走 K9 并新增决策条目；
  2. manager 不自行下载二进制：经 `opencode-ai` 包与其平台 optionalDependency 解析可执行文件路径（T1-2 封装单一解析函数，按 process.platform/arch 选择），无网络安装假设；
  3. 主进程只用 SDK 的 **client-only** `createOpencodeClient({ baseUrl })`，禁用 `createOpencode()` 自启（契约 §1）；
  4. 打包期经 electron-builder `extraResources` 携带平台二进制——**本期仅出方案、不配置 builder**，随打包 Feature 落地（需求规格 §4.2）；
  5. director profile 的 `model` 为 `ark/<modelID>`，**modelID 不硬编码入库**：沿用 `electron/ark.ts` 既有 `ARK_MODEL` 环境变量（方舟 endpoint/model 属用户侧资源），provider.ts 启动生成配置时从环境读取并写入生成态 frontmatter；`ARK_API_KEY` 同理只经环境变量透传，不落盘。
- 用户签字：**已批准（2026-10-04 AskUserQuestion D-SCOPE-2 + 「按这个方案来」）**。
- 动工约束：本条目落账后方可执行任务清单 T1（安装依赖）；当前轮次不安装、不写业务代码。

### D-007 · 生成通道文档冲突裁决（D-SCOPE-1）：图像 qwen-image 云端、视频 H3 经 ComfyUI、音乐 Music3 云端

- 日期：2026-10-04
- 卡口：**K7 相关（修订《设计.md》核心架构表述，Reverse Sync）**；同时是对 2026-10-03 v1.1「画面与配乐统一经 ComfyUI」收窄决策的**部分反转**。
- 冲突：《设计.md》v1.4 内部矛盾——§0.1 原则五（D-005）规定图像仅 qwen-image、音乐仅 Music3；而 §5 MCP 工具表、§8 引擎与生成通道表仍写「B0 概念图/定妆、B9 配乐统一经 ComfyUI 工作流」。按 L1 冲突裁决原则，以用户最新拍板的原则五为准。
- 决策（用户 2026-10-04 AskUserQuestion D-SCOPE-1 拍板）：
  1. **图像 = qwen-image 云端 OpenAPI**（B0 概念图 / 定妆等全部图像产物），不经 ComfyUI；
  2. **视频 = MiniMax H3，经本地 / 局域网 ComfyUI 工作流**（B5 参考生视频、B8 文生视频），与原则二（局域网 ComfyUI 硬边界）一致；
  3. **音乐 = MiniMax Music3 云端 OpenAPI**（B9 配乐），不经 ComfyUI；
  4. ComfyUI 在本项目的唯一生产角色收敛为 **H3 视频引擎**（工作流装载 / 队列 / 收片 / WS 进度 / 多实例）；
  5. renderer 不直连三家服务，调用全部收敛于 MCP / 主进程工具内（契约 §8.5）。
- ⛔ **反转块（针对 v1.1 决策，2026-10-03）**：反转其「画面（含 B0）与配乐（B9）统一走 ComfyUI」中**图像 B0 与配乐 B9** 两部分——改为云端 qwen-image / Music3；**视频 B5/B8 经 ComfyUI 维持不变**；「废弃云端多模型矩阵直连」整体仍有效（云端仅保留红线点名的 qwen-image / Music3 两个固定通道，非多模型矩阵）。
- ⛔ **二次反转（2026-10-04 同日，用户指令「qwen-image 也是走 comfyui」，落 D-009）**：本条 D-007 中「**图像 = qwen-image 云端 OpenAPI、不经 ComfyUI**」在落账当天即被反转——图像改为 qwen-image **本地 / 局域网权重，经 ComfyUI 推理（纯局域网不出网）**；本条其余结论（视频 H3 经 ComfyUI、音乐 Music3 云端、renderer 不直连）**维持不变**。本条不删除，保留决策轨迹；现行结论以 D-009 为准。
- 文档动作：Reverse Sync 修订《设计.md》§5 / §8 / §11 相应表述并升 v1.5（§13 登记），同步 docs/design HTML 人读镜像。**不影响 feature-008 基座代码契约（本期无媒体工具）。**（v1.5 当天再被 v1.6 部分修订，见 D-009。）

### D-008 · 运行时安全三决策（D-SCOPE-3 / D-SCOPE-4 / D-SCOPE-5）

- 日期：2026-10-04
- 卡口：无新卡口（契约 §1/§6/§7/§8 的方案拍板，K9 已随 D-006 单独签字）。
- 决策（用户 2026-10-04 AskUserQuestion 三项一并批准）：
  1. **D-SCOPE-3 端口**：仅绑定 127.0.0.1，从 4096 起顺序探测空闲端口；禁 mDNS、不传 CORS、不监听外网 / 局域网；端口号经 `runtime:status` 暴露仅供显示，不构成凭证；
  2. **D-SCOPE-4 口令**：每次启动由主进程随机生成 HTTP Basic 口令，经 `OPENCODE_SERVER_PASSWORD` 注入子进程，**仅存主进程内存、不落盘、不进日志、不经 IPC 返回**；renderer 永远只走 IPC；
  3. **D-SCOPE-5 mock provider**：opencode 配置内置 `mock` provider（脚本化响应）供无 Key 开发与集成测试；生产构建保留但显式标注测试用途，director profile 默认只选 ark；mock 替代现散落 `mockXxx` 属后续 Feature，不在本期。
- 用户签字：**已批准（2026-10-04 AskUserQuestion：三项全批准）**。

### D-009 · 图像执行路径二次裁决：qwen-image 经本地 / 局域网 ComfyUI 权重推理（反转 D-007 图像部分）

- 日期：2026-10-04
- 卡口：**K7 相关（修订 AGENTS.md §0.1 原则五执行路径表述与《设计.md》核心架构，Reverse Sync）**
- 触发：用户在 D-007 落账当天直接指令「qwen-image 也是走 comfyui」；经 AskUserQuestion 确认形态为**本地 / 局域网权重推理**。
- 现行通道终局（模型红线 + 执行路径两层分离）：
  1. **图像 = qwen-image 唯一模型（原则五红线不变）**，以**开源权重部署于本地 / 局域网 ComfyUI**，经图像工作流（B0 概念图 / 定妆等）推理——**纯局域网、不出公网、无按次云费用、无需图像类云端 API Key**；
  2. **视频 = MiniMax H3**，经本地 / 局域网 ComfyUI 视频工作流（B5 / B8）；
  3. **音乐 = MiniMax Music3 云端 OpenAPI**（B9），是媒体生产中**唯一出公网**的生成通道（语音通道另定）；
  4. **ComfyUI = 统一视觉引擎**（图像 + 视频）：工作流装载 / 队列 / 收片 / WS 进度 / 多实例池，地址可配置；复用 Dufs B0/B5/B8 工作流模板（B9 不在引擎内）；
  5. renderer 不直连任何生成后端：ComfyUI 经 MCP/主进程引擎工具访问，Music3 经 MCP/主进程云端工具访问。
- ⛔ **反转（2026-10-04 同日，用户指令「MiniMax Music3 也是走 comfyui」，落 D-010）**：本条第 3/4/5 项中「音乐 Music3 走云端、是唯一出网媒体通道、B9 不在引擎内」被反转——Music3 改为**本地 / 局域网权重经 ComfyUI 推理**；ComfyUI 升级为图像 / 视频 / 音乐**统一媒体引擎**，媒体生成零公网。本条第 1/2 项（qwen-image 图像、H3 视频经 ComfyUI）维持不变。现行结论以 D-010 为准。
- 与既往决策关系：
  - **反转 D-007** 中「图像 = qwen-image 云端 OpenAPI」部分（D-007 已加二次反转块）；
  - 模型红线本身（D-005 原则五「图像仅 qwen-image」）**从未改变**，本决策是对其**执行路径**的补定；
  - 与 v1.1（2026-10-03）「画面走 ComfyUI」方向回归，但模型被原则五锁定为唯一 qwen-image（非多模型），且明确为**权重推理而非 API 节点**；
  - 「废弃云端多模型矩阵」继续有效；Music3 是云端唯一固定媒体通道，不构成矩阵。
- 文档动作：《设计.md》升 **v1.6**（§5/§8/§11/§13 + §0 对比表）；AGENTS.md §0.1 原则五补执行路径口径；HTML 镜像与《版本记录.md》同步（v1.5 条加反转注记）。
- 对 feature-008 的影响：**无代码契约影响**（本期无媒体工具）；契约 §8.5 安全措辞同步更新。图像/视频引擎工具与 GPU/权重部署属后续媒体 Feature。
- 用户签字：**已批准（2026-10-04，用户直接指令 + AskUserQuestion 确认「本地/局域网权重推理」；音乐部分同日被 D-010 反转）**。

### D-010 · 音乐执行路径三次裁决：Music3 本地 / 局域网权重经 ComfyUI——ComfyUI 统一媒体引擎、媒体生成零公网（反转 D-009 音乐部分）

- 日期：2026-10-04
- 卡口：**K7 相关（修订 AGENTS.md §0.1 原则五执行路径与《设计.md》核心架构，Reverse Sync）**
- 触发：用户直接指令「MiniMax Music3 也是走 comfyui」；经 AskUserQuestion 确认形态为**本地 / 局域网权重推理**。
- 现行通道终局（最终版）：
  1. **图像 = qwen-image 权重**（B0）、**视频 = MiniMax H3**（B5/B8）、**音乐 = MiniMax Music3 权重**（B9）——三类媒体生成**全部经本地 / 局域网 ComfyUI 工作流推理，纯局域网、不出公网、无按次云费用、无媒体类云端 API Key**；
  2. **ComfyUI = 统一媒体引擎**（图像 + 视频 + 音乐）：工作流装载 / 队列 / 收片 / WS 进度 / 多实例池，地址可配置；复用 Dufs **B0/B5/B8/B9** 工作流模板；
  3. 平台出公网通道仅余**文本侧火山方舟**（opencode ark provider）；语音（TTS / 声音克隆）通道仍待后续决策；
  4. renderer 不直连 ComfyUI，所有媒体调用收敛于 MCP / 主进程引擎工具；
  5. 模型红线（D-005 原则五「仅 qwen-image / H3 / Music3，不得切换」）不变，本决策只补执行路径。
- 与既往决策关系：**反转 D-009 第 3/4/5 项**（音乐云端 / 唯一出网媒体通道 / B9 不在引擎）；D-009 图像、视频部分维持。至此 D-007→D-009→D-010 三次裁决轨迹完整保留，媒体路径回归 v1.1「统一经 ComfyUI」方向，但模型由原则五锁定为三个唯一模型、形态明确为权重推理。
- 落地要求（后续媒体 Feature，非 feature-008）：① ComfyUI 需具备 Music3 权重加载能力（社区/自研音频节点纳入技术选型，存在 K2/K9 可能，届时另走卡口）；② 首启引导检测三类权重与 GPU/显存（音频可 CPU 兜底）；③ 引擎适配器统一三类工作流，不按通道分裂服务。
- 文档动作：《设计.md》升 **v1.7**（§0/§0.1/§5/§8/§10/§11/§12/§13）；AGENTS.md 原则五同源；HTML 镜像与《版本记录.md》同步。
- 对 feature-008 的影响：**无代码契约影响**（本期无媒体工具）；契约 §8.5 同步为「全部媒体经 ComfyUI、零公网」。
- 用户签字：**已批准（2026-10-04，用户直接指令 + AskUserQuestion 确认「本地/局域网权重推理」）**。

## 二、实施记录（落地后清理）

### I-001 · T1 二进制事实核实与打包期分发方案（2026-10-04）

- 安装事实（npm i -E，3 包）：`opencode-ai@1.18.34` / `@opencode-ai/sdk@1.18.34` / 平台 optionalDependency（本机 `opencode-darwin-arm64@1.18.34`，真二进制 144MB）。
- 解析事实：`opencode-ai/postinstall.mjs` 按 os.platform/arch（含 linux musl / x64 baseline 回退）把平台包 `bin/opencode` **硬链接（失败则复制）**为统一入口 `node_modules/opencode-ai/bin/opencode.exe`（跨平台同名，无需 manager 自行判平台）；实测 `opencode.exe --version` = 1.18.34。
- `opencode serve --help` 实测：`--port`（默认 0 随机）、`--hostname`（默认 127.0.0.1）、`--mdns` 默认 false、`--cors` 默认 []；契约固定传 `serve --hostname 127.0.0.1 --port <port>` 与默认安全值一致。
- manager 解析函数（T4 落地）：`createRequire(import.meta.url).resolve('opencode-ai/package.json')` → 同目录 `bin/opencode.exe`；缺失即 RUNTIME_START_FAILED（不自行下载）。
- **打包期方案（T1-3，不在本期配置 builder）**：electron-builder `npmRebuild:false` + `extraResources` 携带 `node_modules/opencode-ai`（postinstall 产物入口）与目标平台 optionalDependency 包；asar 内需可定位真实文件路径（建议 asarUnpack 该二进制或 extraResources 到 resources/ 后按 process.resourcesPath 解析）；跨平台发版依赖 npm 在目标平台安装对应 optionalDependency（CI matrix：macos-arm64/x64、win-x64、linux-x64）。打包 Feature 立项时据此细化并补真机验收。

### I-002 · T2-T9 落地实施事实与偏差注记（2026-10-04）

> 纯实施记录：T1-T9 全部落地、测试与构建通过后登记；以下事实已固化于代码注释 / AC，后续可按三分类规则清理。

1. **opencode 1.18.34 运行实例事实（与 SDK d.ts 出入，均以运行实例为准，L1）**：
   - `POST /session/:id/prompt_async` 返回 **204 无 body**：messageID 由本方生成（`msg_<uuid>`，匹配 `^msg`）随 body 上送（client.ts）；
   - prompt body 的 `tools` 在线缆上是 **map `{name:boolean}`** 非数组；契约 §4 `RuntimePromptRequest.tools?: string[]` 是 IPC 边界形态（不变），由 client 去重转 map；
   - body 支持 `format:{type:'json_schema',schema,retryCount?}`（SDK TS 类型缺字段，运行实例支持）；
   - SSE 存在独立 `message.part.delta` 事件（d.ts 仅声明 message.part.updated）；`message.part.updated` 载荷无顶层 messageID（取 part.messageID）；
   - **GET /agent 在 SDK 挂载点为 `sdk.app.agents()`**（gen/sdk.gen.d.ts `App.agents`）；T8 真机核实后由早期推测的 `config.agents()` 修正，T5 测试桩同步。
2. **tsconfig 调整（实施必需，无语义变化）**：preload 以 type-only import 复用 renderer 镜像 DTO（src/lib/runtime-types.ts），`tsconfig.node.json` / `tsconfig.preload.json` 的 include 追加该文件；编译产物 preload.js 经 grep 确认零运行时引用（类型擦除）。
3. **§5.3 与 §6.1 协调口径（main.ts 实现）**：首次业务通道访问惰性自启；运行时处于 **error** 态或经历过**显式 runtime:stop** 后，会话/prompt 类通道直接返回 RUNTIME_NOT_READY（不静默重启，§6.4「显式 start 再拉起」）；子进程 code=0 自然退出（非显式 stop）后业务访问仍可惰性拉起。
4. **T8 集成测试分层（对任务清单 T8-1 措辞的实施注记）**：端到端链路经 **manager + client + projection** 三层（真 opencode serve + 127.0.0.1:4099 OpenAI 兼容桩），未直测 main.ts 的 ipcMain 注册——IPC 为无业务分支的薄封装（参数校验 / 单流分发在 main，逻辑全在三层），其注册正确性由双端 tsc + T9-4 真机冒烟（应用启动 / 优雅退出 / 无残留 / 未提前自启）覆盖。
5. **最终验证**：`npm run test:run` 30 文件 **328 passed / 1 skipped**（skip 仅 RUNTIME_E2E_ARK 门控的真机 ark）；三端 tsc 零错误；`npm run build` 通过；真机冒烟无 opencode 残留。

### I-003 · director 模板解析开发态判定缺陷修复（2026-10-05，由 feature-009 真机冒烟发现）

- 缺陷（L1，代码与本文件/provider.ts 注释矛盾）：`resolveDefaultDirectorTemplatePath()` 以 `process.resourcesPath` 是否存在区分打包 / 开发态，但 Electron 开发态下 `process.resourcesPath` 同样存在（指向 `node_modules/electron/dist/Electron.app/Contents/Resources`），导致开发态拼出 `…/Electron.app/Contents/Resources/opencode/agents/director.md`（不存在），`runtime:start` 以 `RUNTIME_START_FAILED: ENOENT` 失败。vitest 下 `process.resourcesPath` 为 undefined，恰好走开发分支，故原有用例未拦截。
- 修复：改用 Electron 标准环境判定 `app.isPackaged`——仅打包态取 `process.resourcesPath/opencode/...`；开发态维持向上定位仓库根 `resources/opencode/agents/director.md` 的候选探测逻辑。纯开发环境判定修正，不改 IPC / DTO / 签名，不触发卡口；已经用户授权（2026-10-05 AskUserQuestion）。
- 回归：`src/test/runtime-provider.test.ts` 补 Electron 开发态（`app.isPackaged=false` 且 `resourcesPath` 存在）用例。
