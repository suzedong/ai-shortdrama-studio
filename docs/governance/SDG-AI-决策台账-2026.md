# SDG-AI 决策台账 · 2026 年分卷

> 本文件是[总索引](./SDG-AI-决策台账.md)的 2026 年正文分卷，按 D-030 从原主文件同目录整体迁移。
>
> 共 42 条；本项目年度分卷连续编号 D-001—D-042。D-006—D-010 是 D-038 批准的一次性历史恢复副本，原归属仍为 feature-008，不形成后续双写。
>
> 决策本体、日期、卡口、触发背景、当时用户决策、决策理由及历史执行叙述继续按 D-028 冻结；终局状态只在原条目下按规则更新。分卷保留原条目顺序与相对链接层级，不删除、不压缩、不双写历史。

---

## D-001 ｜ K7 ｜ AI-SDG 源规范升 v1.3：三层文档模型入规

- **日期**：2026-10-05
- **卡口**：K7（修改 AGENTS.md 核心规则；同源修改 AI-SDG 源规范）
- **触发背景**：[平台全景图.html](../design/平台全景图.html) 已在页面固化"人看 HTML、AI 读 md、事实可回溯"的约定，但 AI-SDG 源规范（v1.2）只承认 Markdown 为唯一文档形态，可视化 HTML 无合法身份，关联与同步规则缺失。
- **用户决策**（2026-10-05 拍板，三项）：
  1. 将三层文档模型正式写入 AI-SDG 源规范并升版 **v1.3**；
  2. B 类可视化文档采用**集中可视化目录**组织形式（统一放 `docs/design/`）；
  3. **项目级总览（平台全景图）为必需**，其余可视化文档按需制作。
- **落地内容**：
  - **A 类事实源文档**：`.md`，AI 读，入仓库；任务包 5 文件必需。
  - **B 类可视化文档**：自包含单文件 `.html`，人读，入仓库；集中放 `docs/design/`；顶部须声明"可视化呈现，事实以 md 为准"并附事实来源索引；无构建、无外部依赖、只含展示脚本、禁业务逻辑；项目级总览必需，其余按需。
  - **C 类临时沟通件**：内联 widget，不落盘、不入仓库、会话后失效，禁止当事实源引用。
  - **A-B 关联四规则**：同主题配对；单向引用（仅 B 引用 A）；单一事实源（冲突以 A 为准，L1 修 B）；先改 A（.md）再重渲染 B（.html）——铁律 3 的呈现层延伸。
- **波及文件**：
  - 源规范（WPS）：`AI-SDG-Trae-Vibe-Coding-团队架构与流程方案.md` v1.3（§3.3 / §F.1 / §F.3 / §F.4 / 附录A / §3.4.2）
  - 源规范（WPS）：`AI-SDG-AI工具执行指令.md` v1.3（§2.1）
  - 项目内副本：[AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) v1.3（§2.1）
  - 项目工作区规则：[AGENTS.md](../../AGENTS.md) v1.3（§2.1）

---

## D-002 ｜ K7 ｜ AI-SDG 源规范升 v1.4：项目画像配置矩阵 + AI 主动产出时机

- **日期**：2026-10-05
- **卡口**：K7（修改 AI-SDG 源规范核心规则；同源修改 AGENTS.md）
- **触发背景**：v1.3 的三层文档模型只回答了"什么信息内容值得做成 B 类"（三条内容判据），但未规定"什么项目该配哪些 B 类"与"AI 到什么节点必须主动产出"，导致 B 类配置全凭临场、AI 不主动也无据可依。
- **用户决策**（2026-10-05 拍板，四项）：
  1. 项目画像采用 **4 级 P0–P3**（协作人数 / 生命周期 / 系统复杂度 / 干系人，取命中最高级）；
  2. **允许 P0 豁免项目级总览，P1 及以上必需**——修订 v1.3"项目级总览必需"的表述；
  3. AI 授权边界为 **"重渲染直接、新增先问"**；
  4. 本次补强升版 **v1.4**。
- **落地内容**：
  - **项目画像分级**：P0 一次性单脚本 / P1 单人长期 / P2 小团队多模块 / P3 组织级强干系人；每级列明 B 类必需（✅）/按需（○）配置矩阵。
  - **画像升级规则**：维度命中更高等级时，AI 必须提示升级并补齐新等级 ✅ 项。
  - **AI 主动触发时机（8 条）**：0→1 跑通 / 每个 Feature 闭环 / ≥3 模块或首次跨模块交互 / K 卡口架构落地 / 版本里程碑 / 汇报评审 / 画像升级 / 总览过时。
  - **授权边界**：已存在 B 类的重渲染直接做；新增任何 B 类一律先提议、用户确认后产出；禁止无触发批量产 HTML、禁止 C 类落盘冒充 B 类；附统一提议话术。
- **本项目画像判定**：正式产品、长期演进、多模块 → **P2**（必需：项目级总览、架构图、看板/路线图；按需：流程血缘、汇报页）。
- **波及文件**：
  - 源规范（WPS）：`AI-SDG-Trae-Vibe-Coding-团队架构与流程方案.md` v1.4（§3.3 / §F.1 / §F.3 / §F.4 / 附录A / §3.4.2）
  - 源规范（WPS）：`AI-SDG-AI工具执行指令.md` v1.4（§2.1）
  - 项目内副本：[AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) v1.4（§2.1）
  - 项目工作区规则：[AGENTS.md](../../AGENTS.md) v1.4（§2.1）
- **P2 必需项补齐（2026-10-05，用户"新增先问"确认后产出）**：
  - [架构模块关系图.html](../../docs/design/架构模块关系图.html)（B 类：四层架构 / 模块清单 / 通道双轨 / 数据血缘 / 引擎边界）
  - [进度看板与路线图.html](../../docs/design/进度看板与路线图.html)（B 类：Feature 看板 / 八步覆盖 / 质量实况 / 三期路线；快照 2026-10-05）
  - 均含顶部"可视化呈现，事实以 md 为准"声明与事实来源索引；无构建、无外部依赖（Google Fonts 除外）。
  > ⚠️ **现状注记（2026-10-09）**：两文件已随设计 v1.11 重渲染——架构模块关系图通道口径由「双轨」收敛为「runtime 单轨终态（D-012）」（11 纯工具 / 25 IPC / 画布 Stage 10 态）；进度看板数据快照已更新至 2026-10-09 复核（197 通过 / 1 跳过，与 10-08 首测一致）。本行为 2026-10-05 创建时描述，保留历史。

---

## D-003 ｜ K7 ｜ 规则单点化：通用主方案为唯一来源，项目 AGENTS.md 改为「特化 + 引用」

- **日期**：2026-10-05
- **卡口**：K7（修改 AGENTS.md 核心规则与结构）
- **触发背景**：对《AI-SDG-Trae-Vibe-Coding-团队架构与流程方案.md》（WPS，通用主方案）做文档评审时发现：通用规则在三处重复维护——① WPS 通用主方案（2000+ 行）；② 项目内 [AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md)（其精简提取）；③ 项目根 [AGENTS.md](../../AGENTS.md)（再次复制）。规则一旦变更需三处同步，极易产生口径漂移（历史上已出现 v1.3/v1.4 多次残留修复）。
- **用户决策**（2026-10-05 拍板，授权范围"硬错误 + 去冗瘦身"，跨文件冗余"一并梳理"）：
  1. 通用主方案为通用治理规则的**唯一事实源**；项目内以 [AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) 为**仓库内唯一规则载体**；
  2. 项目根 [AGENTS.md](../../AGENTS.md) 不再复制通用规则，只保留**项目特化条款**（身份 / 关键事实 / 开发原则 / 项目路径）+ 通用规则章节索引，并要求 AI 先读 AGENTS.md 再通读指令文件；
  3. 特化条款与通用规则冲突时以特化条款为准（铁律 2 的项目层例外，仅限 AGENTS.md 明示条款）；未覆盖事项按通用规则执行；
  4. 通用主方案同步升版 **v1.5**（一致性修复 + 去冗瘦身，规则本身无增减）。
- **落地内容**：
  - 通用主方案 v1.5：原版方法论口径统一为 **AI-SDD**（§0.2 命名说明）；修正 FAQ Q15 KMI 数量（6→8）与回顾周期（每周→双周）等硬错误；简单表格统一 pipe table；篇幅由约 2090 行压缩至约 1830 行（合并跨章重复 + 删除标题前后非必要空行，渲染结果不变）。
  - 项目 AGENTS.md v1.5：由 175 行瘦身至约 50 行，仅保留 §0 身份 / §0.1 五条项目开发原则 / 通用规则索引表。
  - [AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) 内容不变（**仍为 v1.4**：v1.5 不涉及规则增减，仅口径命名与瘦身，指令文件无 AI-SDD 口径残留、无需升版）。
- **波及文件**：
  - 源规范（WPS）：`AI-SDG-Trae-Vibe-Coding-团队架构与流程方案.md` v1.4 → **v1.5**
  - 项目工作区规则：[AGENTS.md](../../AGENTS.md) v1.4 → **v1.5**
  - 项目内规则载体：[AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) v1.4（内容不变）
- **后续约束**：今后通用规则变更的标准路径为「改 WPS 主方案 → 同步项目内指令文件（如涉及规则变化才升版）→ 重渲染受影响 B 类」；禁止再把通用规则正文复制回 AGENTS.md。

---

## D-004 ｜ K8 ｜ 裁决门语义修订：rejected 门可同 gateId 重开

- **日期**：2026-10-07
- **卡口**：K8（跨任务包契约语义冲突；修改 GateBridge 门生命周期行为）
- **触发背景**：真机验收发现两份已批准契约对"rejected 后如何重试"规定互相矛盾：一份规定门一旦 `approved/rejected` 即终态、同 gateId 再请求 → `INVALID_ARGUMENT`；另一份规定 rejected 后须重做产物并以**同一 gateId** 再次请求，禁止新增门编号。真机上 showrunner 按终态语义重试确认门被拒，为不丢确认点改用后缀门；同时查明编排测试用脚本化 fake（假设可同 id 重试）故未暴露，真实 GateBridge 未实现同 id 重开。
- **用户决策**（2026-10-07 拍板）：
  1. **rejected 不是终态**：允许以同一 gateId 重开，门状态回退 `pending`、用本次请求内容覆盖旧 question/options/payload，门记录仍只一条、不新增编号；
  2. **approved 保持终态**：同 gateId 再请求仍 → `INVALID_ARGUMENT`；
  3. 0-d 预检是否允许只读实例/资产探测（comfyui.instances / asset.list）的议题本次**暂不裁决、挂起**；维持 §1.2 整个命名空间禁令（真机中模型的尝试已被 client/provider 白名单拦截，未实际执行）。
- **落地内容**：
  - [bridge.ts](../../electron/gate/bridge.ts) `initializeEntry`：仅 `approved` 拒绝重开；`rejected` 走同 gateId 重开分支；
  - [gate-bridge.test.ts](../../src/test/gate/gate-bridge.test.ts)：新增 rejected 同 id 重开 → pending → 再裁决 → approved 后锁定的真实用例（8 项全绿）；
  - 契约与实现同步：门生命周期按本裁决实现（见 bridge.ts），相关测试覆盖 rejected 同 id 重开 → pending → 再裁决 → approved 后锁定。
- **波及文件**：
  - 代码：`electron/gate/bridge.ts`；测试：`src/test/gate/gate-bridge.test.ts`
- **遗留项（2026-10-27 裁决关闭）**：只读探测开口子议题——用户裁决**维持 §1.2 命名空间禁令**，放行与否随 [feature-803-ComfyUI统一媒体引擎](../features/README.md)（⬜ 未建包）建包时一并评估；新立项体系（D-005 后）已无 0-d 预检门，本挂起态终结。

---

## D-005 ｜ K8 ｜ 立项模型重建 + 视觉风格谱系定位为系统级外部数据源

- **日期**：2026-10-08
- **卡口**：K8（事实源与存量任务包体系性冲突；重建立项业务模型与文档结构）
- **触发背景**：以《2002 相识》（「我想做一个我和我老婆认识的故事，发生在 2002 年」）为真实案例，用「用户说一步、AI 分析后续」的对话推演复核立项流程，确认旧模型基于错误假设：
  - 旧设计为「**4 节点**（创意输入→选题诊断→立项单→故事背景档案）+ **4 确认门**（0-a~0-d）+ 立项单多 tab」，实际立项是一段对话收敛，不是逐产物审批的表单流；
  - 视觉风格谱系的「主 / 备」（验证状态轴）与「主风格 / 辅助风格」（使用角色轴）被旧文档压成两条，产生自相矛盾（如把「备」定义成闪回辅助画风、又规定辅助仅 B/D）。
- **用户决策**（2026-10-08 拍板）：
  1. **任务包重新建立**：新任务包按八步模块分段编号（0xx–7xx 业务段 + 8xx 平台基础段），从头建包；
  2. **立项新模型**：1 个入口动作（一句话创意）+ **2 节点**（① 选题诊断，含六要素口径草案；② 故事前提，即故事背景档案的对话式形成）+ **1 道定案门**（就绪条件客观判定：六要素有值＋故事前提达最低门槛＋有 1 主风格 → Agent 发立项定案卡；一键拍板或口头拍板等价，记录用户原话与立项单版本）；
  3. **反问机制 / 已捕获口径**：创意后 Agent 先反问关键分叉（商业短剧 / 个人纪念）；能提取的事实不等回答先记录；「已捕获口径」区从第一句话起持续可见、随时可改；
  4. **故事前提最低门槛（暂定）**：人物（主角身份/年龄）、时间、地点、核心事件（相遇方式一句话）、边界（本季讲到哪）；开发中不够再议；
  5. **视觉风格选型**：主风格全片唯一（家族+具体风格，候选含谱系全部「主」「备」条目，选备风险自担）；辅助风格按剧情需要挂 0–1 个「气氛」，**候选域封闭 = B 青春治愈系（1 项）+ D 类型氛围系（5 项）**；谱系只管画风，年代等事实进入提示词内容、不决定画风 ID；
  6. **谱系定位**：视觉风格谱系是**系统级外部数据库**，与 ComfyUI 接入同级——路径注册、版本跟踪、可查阅可维护、平台只消费不私改；项目引用记录「风格 ID + 谱系版本」（如 `A7 @ v1.46`，谱系经本次措辞修订由 v1.45 升至 v1.46）；
  7. **立项后变更**走变更 + 下游同步（反补机制）；改主风格 → 全链路提示词重出；
  8. Dufs 仓库外两份文档（视觉风格谱系、制作流程规范）一并修正；docs/design/ 下 B 类文档同步重渲染（原型保持不动）。
- **落地内容**：
  - [短剧Agent平台设计.md](../../短剧Agent平台设计.md)：§2.6 整体重写（2.6.1~2.6.7）、新增 §8.3、§0.1 八步表立项行与现状说明更新、§7.1 重新定性为「现存代码数据血缘（待对齐）」、§13 加 v1.9 记录；
  - Dufs：`AI短剧制作视觉风格谱系.html`（修正「备」定义与辅助候选域）、`AI短剧制作流程规范.html` J.3（修正「形态内」措辞，补辅助仅 B/D）；
  - B 类文档重渲染：平台全景图 / 架构模块关系图 / 进度看板与路线图 / 设计镜像。
- **波及文件**：见上「落地内容」；代码本次未删未改。
- **后续约束**：
  - 现存代码（含按旧模型实现的立项门、style-catalog 固化谱系等）按《AI-SDG-AI工具执行指令》§7 存量功能对齐流程，对照新设计按现行任务包重建，No Spec No Code；
  - 谱系升级走源文件维护 + 版本号 + 项目记录引用版本，不得把条目私改进代码。
- **延伸决策（2026-11-04 拍板）**：旧任务包相关叙述从全部现行文档清除，仅存 git 历史，不重建归档说明。清理范围含：
  - B 类展示层 4 个 HTML（旧包统计、旧包卡片、旧对比框、旧时间线条目）；
  - A 类事实源（过时编号引用、旧体系叙述、旧路径）；
  - 治理台账执行结果叙述（改写为终局口径，审计链核心原样保留）；
  - 代码层注释里的旧包编号血缘标签；
  - 归档 README + 空目录一并删除。
  清零后全仓库 grep 旧词 0 命中（git 历史除外）。纪律见 AI-SDG-AI工具执行指令 §7.2 过程产物清零。

---

## D-006 ｜ K9 ｜ opencode 精确版本锁定与二进制解析方式

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
- **终局状态**（2026-11-19 更新）：**部分取代，其余现行**；opencode 与 SDK 精确同版锁定、升级重新走 K9、manager 不自行下载二进制及 client-only SDK 边界不变。历史单一 ark profile／`ARK_MODEL` 环境变量表述由 D-021／D-022 的文本双服务商与用户模型配置扩展，不限制 LM Studio；模型与密钥不硬编码、不落盘的安全边界不变。2026-11-19 经 D-038 从原 feature-008 归档记录恢复；后续决策：D-021、D-022、D-038。

---

## D-007 ｜ K7 ｜ 生成通道文档冲突裁决（D-SCOPE-1）：图像 qwen-image 云端、视频 H3 经 ComfyUI、音乐 Music3 云端

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
- **终局状态**（2026-11-19 更新）：**部分取代，其余现行**；图像云端 OpenAPI 已由 D-009 反转为本地／局域网权重工作流，音乐云端 OpenAPI 已由 D-010 反转为 B9 本地／局域网权重工作流，Qwen-Image 模型及其专用路径再由 D-033 取代为 MiniMax H3 Image。视频仅 H3 并经本地／局域网 ComfyUI、renderer 不直连生成后端的边界不变；ComfyUI 不再是“唯一生产角色仅为 H3 视频引擎”，而是 D-010 确定的图像／视频／音乐统一媒体引擎。2026-11-19 经 D-038 从原 feature-008 归档记录恢复；后续决策：D-009、D-010、D-033、D-038。

---

## D-008 ｜ 运行时安全三决策（D-SCOPE-3 / D-SCOPE-4 / D-SCOPE-5）

- 日期：2026-10-04
- 卡口：无新卡口（契约 §1/§6/§7/§8 的方案拍板，K9 已随 D-006 单独签字）。
- 决策（用户 2026-10-04 AskUserQuestion 三项一并批准）：
  1. **D-SCOPE-3 端口**：仅绑定 127.0.0.1，从 4096 起顺序探测空闲端口；禁 mDNS、不传 CORS、不监听外网 / 局域网；端口号经 `runtime:status` 暴露仅供显示，不构成凭证；
  2. **D-SCOPE-4 口令**：每次启动由主进程随机生成 HTTP Basic 口令，经 `OPENCODE_SERVER_PASSWORD` 注入子进程，**仅存主进程内存、不落盘、不进日志、不经 IPC 返回**；renderer 永远只走 IPC；
  3. **D-SCOPE-5 mock provider**：opencode 配置内置 `mock` provider（脚本化响应）供无 Key 开发与集成测试；生产构建保留但显式标注测试用途，director profile 默认只选 ark；mock 替代现散落 `mockXxx` 属后续 Feature，不在本期。
- 用户签字：**已批准（2026-10-04 AskUserQuestion：三项全批准）**。
- **终局状态**（2026-11-19 更新）：现行；127.0.0.1 回环绑定、4096 起顺序探测、每次启动随机口令、口令不落盘／不进日志／不经 IPC 返回、renderer 不持有口令及 mock provider 测试用途边界不变。2026-11-19 经 D-038 从原 feature-008 归档记录恢复；后续决策：D-038（历史恢复）。

---

## D-009 ｜ K7 ｜ 图像执行路径二次裁决：qwen-image 经本地 / 局域网 ComfyUI 权重推理（反转 D-007 图像部分）

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
- **终局状态**（2026-11-19 更新）：**部分取代，其余现行**；Qwen-Image 模型及其专用生产路径由 D-033 及 feature-816 的 H3 Image 生产链取代，不作为主用、备选或故障回退；音乐云端与“ComfyUI 仅为统一视觉引擎”同日由 D-010 反转。本地／局域网 ComfyUI、媒体调用收敛于主进程／MCP、renderer 不直连生成后端的边界不变。2026-11-19 经 D-038 从原 feature-008 归档记录恢复；后续决策：D-010、D-033、D-038。

---

## D-010 ｜ K7 ｜ 音乐执行路径三次裁决：Music3 本地 / 局域网权重经 ComfyUI——ComfyUI 统一媒体引擎、媒体生成零公网（反转 D-009 音乐部分）

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
- **终局状态**（2026-11-19 更新）：**部分取代，其余现行**；图像 Qwen-Image 由 D-033 取代为 MiniMax H3 Image，文本出公网通道由 D-021／D-022 固定为火山方舟／LM Studio 二选一且仅火山方舟出公网。音乐仅 MiniMax Music3、三类媒体全部经本地／局域网 ComfyUI 权重工作流、媒体生成零公网、无媒体云端 Key、renderer 不直连与统一主进程／MCP 引擎边界不变；语音通道仍待定。2026-11-19 经 D-038 从原 feature-008 归档记录恢复；后续决策：D-021、D-022、D-033、D-038。

---

## D-011 ｜ K8 ｜ 立项后变更规则升级：全字段可改 + 影响评估 + 用户决策

- **日期**：2026-10-09
- **卡口**：K8（修改设计文档核心业务规则 §2.6；与 D-005 同源迭代）
- **触发背景**：D-005（v1.9，2026-10-08）将旧 4 节点 + 4 确认门立项模型作废，改为"1 入口 + 2 节点 + 1 定案门"；同期 §2.6.6 立"反补机制"——即"改六要素 / 换主风格 → 变更提案 + 下游同步"，隐含 premise 不可改的半锁定语义。在将 v1.9 立项视图通过方案 A 融入主原型 [短剧Agent平台-原型.html](../design/短剧Agent平台-原型.html) 三栏骨架的过程中，用户对"STAGE 1 后是否还能改立项"明确表达："L0/L1/L2 我认为都可以改，但是后面要标记影响点，用户可以判断是否需要重新生成"（2026-10-09）——即推翻 v1.9 的半锁定假设，要求全字段开放 + 影响必标 + 决策权回到用户。
> **v1.10 第五轮注记（2026-10-09）**：v1.9 与 STAGE0 两个原型 HTML 已删除，本段引用的"v1.9 立项视图"= 现行主原型 [短剧Agent平台-原型.html](../design/短剧Agent平台-原型.html) view-stage0（已内嵌全部细节）。删除详情与历史定位见 [版本记录.md](../../版本记录.md)「2026-10-09 · 立项原型去重」条目（原「立项原型归档说明.md」已随本轮清理删除，指引并入本注记与版本记录）。
- **用户决策**（2026-10-09 拍板，三项）：
  1. **全字段可改**：L0（项目名 / 标签 / 备注）、L1（集数 / 时长 / 受众 / 基调 / 画幅）、L2（故事前提 / 主风格）任何字段在 STAGE 0/1/2/3/4/5/6 任何阶段都可改；无 disabled、无锁形 icon；取代 v1.9"premise 不可改"的隐含锁定语义。
  2. **影响必标记**：每次保存（落盘新版本 v(N+1)）时，按 `project.manifest.json` 依赖图反向追溯所有 `parentReference.briefVersion == vN` 的下游产物，列入"待对齐清单"（分级：高 = premise 核心/主风格/画幅 改 / 中 = 集数/时长/受众/基调 改 / 低 = 仅元数据 改）。
  3. **决策归用户**：受影响产物**不自动重生成**；用户从"一键重生成选中 / 仅标记脏 / 取消"三选一；选"仅标记脏"时产物走脏读（`parentReference.briefVersion` 仍为 vN，节点挂 ⚠️ 角标，Agent 提示词追加"基于 vN"标记），不阻塞下游创作。
- **落地内容**（v1.10 一次性同步）：
  - [短剧Agent平台设计.md](../../短剧Agent平台设计.md)：
    - §2.6.5 定案门语义修订（去"灵魂边界"措辞；按钮"立项完成，进入故事"→"发布立项 v(N+1)"；新增"相对 vN 改动"提示 + "查看历史"按钮）
    - §2.6.6 重写立项后变更规则（核心三原则 + 触发入口 4 类 + 字段→影响范围映射表 + 待对齐角标 + 脏读运行时表现 + 历史版本与回滚 + STAGE 0 步骤视觉）
    - **新增 §2.6.7 影响评估机制**（追溯算法 4 步 + 影响分级表 + 评估面板 UI 草图 + 三个动作语义 + Harness 校验补充）
    - 原 §2.6.7 → §2.6.8 画布布局（数据模型段补"立项单 v1..vN 全量保留 + 影响清单 + parentReference 字段"；新增与方案 A 左栏融合 + titlebar STAGE 进度轨联动两条）
    - §13 加 v1.10 记录
  - 镜像 [短剧Agent平台设计.html](../design/短剧Agent平台设计.html) 同步更新（按 AGENTS.md §10 镜像纪律先改 md 再重渲染 B）。
  - 原型 [短剧Agent平台-原型.html](../design/短剧Agent平台-原型.html)：当前已具备 titlebar STAGE 进度轨（来自前次借鉴落地）；STAGE 0 步骤 hover tooltip（`立项 vN · X 产物已对齐 · Y 待处理`）当时不在 v1.10 落地范围，后由 feature-013 完成并接入真实统计（见 D-020）。
  - v1.9 主体（1 入口 + 2 节点 + 1 定案门）保持不变；本次仅升级"立项后"行为；其他八步阶段不受波及。
- **波及文件**：见上「落地内容」；代码本次未删未改（与 D-005 同模式——文档先行，代码按存量对齐六步法重建）。
- **后续约束**：
  - `立项/立项单.vN.json` 必须全量保留 v1..vN，不覆盖；`立项/影响清单.vN→v(N+1).json` 与`project.manifest.json.briefVersion` 字段在 feature-005/006 任务包中落实。
  - 存量对齐阶段如发现旧代码含 premise 锁定逻辑，按本决策反转。
  - feature-003（画布节点 / 状态机）需在 `CanvasNode.parentReference` 与 `CanvasNode.dirty` 字段落地本规则。
- **编号说明**：本条 D-011 为治理台账全局编号；与 D-005 同源（均修改 §2.6），不共用编号但同属 K8 立项模型族。
- **落地注记（2026-10-14，feature-002）**：本条经 feature-002（Git 历史） 全部落地（偏差 B-03 关闭）：K1 三字段（`ProjectManifest.briefVersion`、`CanvasNode.parentReference/dirty`）+ K8 三工具（`brief.impact.assess/commit`、`canvas.align`，全仓 22 工具）+ showrunner 再版六步剧本 + renderer 脏读黄条/角标/`vN ⚠k` 徽标；三选一走对话（D-005），不做弹窗。两处形态差异经包级 D-002/D-003 拍板记名、设计书不回改：①血缘挂 `CanvasNode.parentReference`（非设计书所写 manifest.nodes，B-09 后 manifest 无 nodes）；②影响清单落项目根 `影响清单.vN-vM.json`（非 `立项/` 前缀，`→` 换 ASCII `-`）。原后续约束中的 feature-003/005/006 编号已被 D-013 路线图重编（801/002）取代。

---

## D-012 ｜ K8 ｜ 对话通道定稿：runtime 单轨为终态，旧 IPC 快照并入设计后删除

- **日期**：2026-10-09
- **卡口**：K8（修改设计文档核心章节 §5 / §7.1，对话与生成通道规则定稿）
- **触发背景**：feature-010 存量快照（docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md）记录了旧 8 个 `agent:*` IPC + `app:ark-status` 的逐 handler 行为与迁移决策表；迁移已执行完成（归档 AC-9 ✅：旧 IPC / preload 方法 / global.d.ts 类型全删、对话链路零引用）。用户问"这个还有用吗"，随即拍板"**不会回退了，有用的放以设计里，所有设计要最后状态，如果有不确定的设计，可以讨论**"——旧链路不回退、快照有用内容并入设计、设计文档定稿为最终状态。
- **用户决策**（2026-10-09 拍板，三项）：
  1. **旧对话链路不回退**：对话 / 生成通道以磁盘实况为终态——**Agent 运行时单轨（runtime:\*）+ 11 个纯 MCP 工具（canvas / file / asset / comfyui / gate）**；不重建旧 8 个 `agent:*` IPC 与 `shortdrama_*` 生成工具；快照文件删除。
  2. **快照处置**：有用内容（runtime 通道机制、上下文依赖原则、错误码语义）并入设计文档 §5.1 / §7.1 后，`docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md` 删除。
  3. **§7.1 定稿**：按新模型整体改写为最终数据模型描述，删除"旧代码现状 / 待对齐 / 不代表目标设计"框架。
- **落地内容**（设计 v1.11 一次性同步）：
  - [短剧Agent平台设计.md](../../短剧Agent平台设计.md)：
    - §5 改写为「**MCP 工具层与对话生成网关**」——新增 §5.1 对话生成网关（runtime 单轨通道表；诊断 / 大纲 / 小传 / 分场 / 台词 / 分镜 / 改写等生成动作由会话内 Agent 规划完成；统一 runtime 错误码 14 个，旧 `STORY_CTX_MISSING` / `REVISE_*` / `STYLE_NOT_IN_CATALOG` 退役；无 Key 显式报 `UPSTREAM_AUTH_MISSING`，不 mock 降级）；§5.2 工具族按磁盘实况定稿（已落地 11 个纯工具 + 目标族 project / media / engine / 资产扩展 / edit / harness / skill）
    - §7.1「现存代码数据血缘（待反向补录重建）」改写为「**数据血缘、状态机与版本归档（最终设计）**」——brief.json 由立项单.vN.json 取代；谱系小节并入 §8.3 口径；补 §2.6.6 / §2.6.7 影响评估字段落点（manifest.briefVersion + parentReference + 影响清单）
    - §8.3 注记改中性事实（去"过渡实现 / 后续重建"措辞）；§13 加 v1.11 记录
  - B 类同步：镜像 [短剧Agent平台设计.html](../design/短剧Agent平台设计.html)（§5 / §7.1 / 版本记录 v1.11）；[平台全景图.html](../design/平台全景图.html) 05 问题区块快照链接改指「设计 §5.1 对话网关（终态）」；`三阶段数据血缘.svg` 清理"旧 / 待反补 / D-005"过渡标注。
  > ⚠️ **现状注记（2026-10-09，同日后续）**：平台全景图于当日完成全量 v1.11 同步 + 瘦身（B 类三文件一致性审计：8 处冲突修正、5 处复刻改要点卡+跳转链接，见 [版本记录.md](../../版本记录.md)「B 类三文件一致性审计与修复」条目）；本行"仅改 05 链接"为 D-012 定稿时的即时记录，全景图现行状态以版本记录该条目为准。
  - 删除 `docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md`；归档包 feature-010 两处提及（变更记录 / 任务清单）随包冻结保留。
- **波及文件**：短剧Agent平台设计.md / 短剧Agent平台设计.html / 平台全景图.html / 三阶段数据血缘.svg / 版本记录.md；**代码未改**（以磁盘实况为终态，反向同步）。
- **后续约束**：
  - 错误码以 runtime 14 个为唯一口径（`electron/runtime/types.ts`），旧业务错误码不再引入；
  - 无 Key 场景显式报 `UPSTREAM_AUTH_MISSING` 提示配置，不恢复 mock 降级；
  - 新增生成 / 工具能力须走 §5.2 目标族与 feature 包流程，不得绕过 runtime 单轨另立通道。

---

## D-013 ｜ K8 ｜ 任务包按八步业务模块重新划分 + 三项建包前裁决

- **日期**：2026-10-13
- **卡口**：K8（任务包体系性规划 + 跨包契约歧义裁决；不落代码）
- **触发背景**：D-005 立项模型重建后仅重建了 feature-001，后续包无成体系编号规划；偏差 B-03/B-04/B-05/B-06 需归位到具体任务包，且 shotlist 阶段边界、style-catalog.ts 去向、共享层改动存在建包前必须拍板的歧义。
- **用户决策**（2026-10-13 拍板，四项）：
  1. **划分维度：以 §0.1 八步业务闭环为模块边界**。编号百位 = 业务阶段：0xx–7xx 对应 STAGE 0–7，每段 99 序号；跨阶段横切机制归入 8xx 平台基础（状态机 / 风格谱系 / 统一媒体引擎 / Harness / Skill）。共规划 15 包：001（已落地）、002、101、201、301、302、401、501、601、602、701、801–805（805 二期暂不建包）。
  2. **shotlist 同一文件两阶段演进**：201 产出 `分镜/shotlist.json` 文字稿（一期空镜 `dialogue=null`、`refs=[]`）；401 在**同一文件**上启用 `refs[]` / 景别 / 运镜 / 时长，升级为生产分镜——不设两个产物文件。
  3. **B-05 取重建方案（终局口径）**：feature-802 已落地 `electron/style/` 五文件模块（types/catalog/parse-md/loader/validate）；代码内 ID 注册表与 `resources/H3-Style/` 谱系 md 运行时交叉核对，版本号从 md 解析、**不硬编码 `CATALOG_VERSION`**；平台只消费不私改谱系（D-005 第 6 条；包级 D-001/D-002 已批准）。
  4. **K1 共享层扩展知情**：002 与 801 改 `shared/types.ts`（`manifest.briefVersion` / 产物 `parentReference` / `CanvasNode.dirty` / 7 态 status / 清退历史 `Stage` 10 态），各包建包时正式走 K1：先出字段方案、用户确认后记包内变更记录，再动代码。
- **建设顺序**：P1 = 801 状态机推进（B-04）→ 002 立项后变更（B-03）；802 风格谱系（B-05）；101/201 存量对齐（代码已落地）。P2 建包顺序 = 806 Harness 基础校验 + 确认门全链路 → 803 ComfyUI 统一媒体引擎（Harness 原规划 804，D-014 改号，D-019 调整顺序）。P3 = 301 → 302 → 401 → 501 → 601 → 602 → 701。
- **落地内容**（本次仅文档）：
  - [features/README.md](../../docs/features/README.md) 整体重写：§0 编号规则、§1 九张模块包表（边界 / 解决偏差 / 技术落点 / 溯源 / 状态）、§2 已落地无包骨架、§3 裁决（本决策第 2–4 项）、§4 建设顺序、§5 归档说明；
  - [设计现状与偏差清单.md](../../docs/设计现状与偏差清单.md) §3 路线表改为新模块编号并与 README 互链。
- **波及文件**：features/README.md、设计现状与偏差清单.md；**代码未改**。后续包内 K1 决策记入各包变更记录，不进本台账（§3 台账规则）。

---

## D-014 ｜ K8 ｜ 804 编号让位 Windows 窗口标题栏缺陷修复，Harness 顺延 806

- **日期**：2026-10-13
- **卡口**：K8（任务包编号体系调整；十五包规划外新增窗口外壳包）
- **触发背景**：真机盘点发现 `electron/main.ts` 的 `BrowserWindow` 使用 macOS 专用 `titleBarStyle:'hiddenInset'`，Windows 下退化为无最小化/最大化/关闭按钮的无边框窗口（只能 Alt+F4），定为新偏差 **B-10**。用户提供 MiniMax Design Windows 版截图并指示建包修复时，发现 804 编号已在 D-013 十五包方案中分配给「Harness 基础校验与确认门全链路」（未建包），产生编号冲突。
- **用户决策**（2026-10-13 拍板）：
  1. **804 让给窗口标题栏**：feature-804 = Windows 窗口标题栏缺陷修复包（真机缺陷优先，不占 P1/P2 媒体链顺序）；
  2. **Harness 包顺延 806**：原 D-013 规划的 feature-804-Harness 改编号 feature-806，P2 优先级与"可随阶段分批"策略不变；805 Skill 体系编号不动；
  3. 窗口外壳选型与视觉方案属包级选型，在 feature-804 包内 D-002/D-003/D-005 固化，随 K8 卡口（新增 4 invoke + 1 推送 IPC 登记）一并报批后才准编码。
- **包级选型（随建包登记，K8 已于 2026-10-13 经 AskUserQuestion 批准）**：
  - 外壳：win32/linux 取 `frame:false` 全自绘（darwin 保留 `hiddenInset` 零变化），放弃 `titleBarOverlay` 混合方案；已知代价为失去 Win11 最大化钮悬停 Snap Layouts 菜单（Win+方向键/拖边吸附/双击最大化保留）；
  - 视觉：沿用现有浅色 44px 自绘顶栏（设计书 L289-298/L383 规定 titlebar 承载八步进度轨），仅右侧补三按钮（46×32、关闭红 `#C42B1C`），不做截图深色 32px 薄栏改版。
- **落地内容**（本次仅文档）：
  - 新建任务包 feature-804-Windows窗口标题栏（Git 历史） 5 文件（需求规格 / 契约 / 任务清单 / 设计说明 / 变更记录），溯源 [改编]，无 K1（平台类型落 `src/global.d.ts`，不碰 `shared/types.ts`）；
  - [features/README.md](../../docs/features/README.md)：8xx 表 804 行改窗口标题栏、新增 806 Harness 行、§4 P2 顺序 804→806；
  - [设计现状与偏差清单.md](../../docs/设计现状与偏差清单.md)：§2 新增 B-10，§3 路线表 804 改窗口标题栏、Harness 改 806。
- **波及文件**：feature-804 任务包 5 文件、features/README.md、设计现状与偏差清单.md。交叉指针：feature-804 变更记录 D-006。
- **落地回填（2026-10-13）**：K8 批准后 T1→T6 已全部完成——`electron/window/chrome.ts` 平台分支纯函数、main.ts 四 invoke 一推送、preload/global.d.ts/dev-mock 三处契约同步、`src/studio/WindowControls.tsx` 三按钮、StudioApp 顶栏集成；新增测试 15 例全绿，全量回归 264 passed / 7 skipped / 12 failed（与基线同分布、零扩大）。README 已同步终局状态：Windows 真机人工验收于 2026-10-29 通过（见 D-025）；macOS 零变化回归仍按原约束挂起，B-10 闭环后不再常驻开放偏差清单。
- **编号规则补充**：D-013 的十五包为规划基线而非编号锁定；遇真机缺陷等紧急包时，未建包的规划包可顺延编号，以本台账决策为凭，并在 README/偏差清单同步改号。

---

## D-015 ｜ K8 ｜ 项目改名/删除：恰 2 个新 IPC 批准（B-19 无包直接修的 K8 留痕）

- **日期**：2026-10-16
- **卡口**：K8（新增 IPC 面：恰 2 个 invoke `project:rename` / `project:delete`）
- **触发背景**：左栏项目行无改名/删除入口、`electron/project/library.ts` 无 mutation 函数、IPC 面仅 `project:list/create/open`；MiniMax Design 具备项目改名/删除能力，属 [自研新增] 缺口。用户拍板**不建包直接修 + 登记偏差 B-19**（B-18/B-20 同模式）；因涉及新增 IPC 的 K8 卡口且无任务包变更记录可记，按台账规则（仅收不属于任何 Feature 任务包的项目级 K 卡口决策）补登本条。
- **用户决策**（2026-10-16 拍板，四项）：
  1. **禁止删除当前打开项目**：主进程以 `PROJECT_ACTIVE` 拒删，UI 删除入口 disabled 并提示「请先切换到其他项目」；
  2. **删除 = 回收站**：`shell.trashItem` 可恢复，不做物理删除；
  3. **UI = 悬停「···」菜单**：改名行内输入（Enter 提交 / Esc 取消）、删除二次确认条（明示「将移入回收站」）；
  4. **K8 一并批准恰 2 个新 IPC**：`project:rename` / `project:delete`，不超出此范围；preload / global.d.ts / dev-mock-api 三处镜像同步。
- **落地内容**（当日闭环，细节见 [设计现状与偏差清单.md](../../docs/设计现状与偏差清单.md) B-19 行与 [版本记录.md](../../版本记录.md) B-19 条目）：`library.ts` 新增 renameProject（assertProjectDir 白名单 → trim、空名 `INVALID_ARGUMENT` 零写盘 → manifest 存在性 → enqueue 读-改-写 `.session.json` 仅换 title）与 deleteProject（白名单 → 当前项拒删 → trashItem）；`main.ts` rename handler 对当前项顺带 `canvasStore.withCanvas` 同步 `canvas.title` 使顶栏即时刷新；`ProjectNav.tsx` 三态行；新增测试 10 例（project-nav 4 + project-library-mutation 6），全量 46 文件 475 passed / 1 skipped，typecheck 仅 3 条历史基线，无 K1/K9；CDP 真机目验全过（改名顶栏即时同步且磁盘一致、删除入回收站确证可恢复、当前项删除入口 disabled）。
- **波及文件**：electron/project/library.ts、electron/main.ts、electron/preload.ts、src/global.d.ts、src/studio/ProjectNav.tsx、dev-mock-api、测试 2 文件（project-nav.test.tsx、project-library-mutation.test.ts）；文档双写：偏差清单 B-19、版本记录 B-19 条目。
- **后续约束**：项目 mutation IPC 面以恰 2 个为限，新增项目级 IPC 须重新过 K8；无 K 卡口的「直接修 + 登记偏差」事项（B-18/B-20/B-21）不进本台账，以偏差清单 + 版本记录为留痕。

---

## D-016 ｜ K7 ｜ 原则六立项：系统优先，AI 归位（总体原则 5 条 → 6 条）

- **日期**：2026-10-16
- **卡口**：K7（项目总体原则 / 边界条件变更）
- **触发背景**：B-23/B-24 修复后用户提出新原则动议，原话：「现在开发的是一个系统，AI(skill)只是一个工具，主要是为了处理文本内容，所以系统已经能用操作完成的，就不需要用AI对话了，这样也快，也剩Token，AI擅长处理文本」。彼时总体原则 5 条（设计 §0.1 / AGENTS.md §0.1 同源）。查证原则与现状自洽：① D-010 终局已将公网 AI 收敛到纯文本侧火山方舟，媒体全走局域网 ComfyUI 权重推理，AI 成本本就集中于文本；② §2.6.7 影响评估是确定性追溯算法，已实现为系统 MCP 工具（brief.impact.assess / commit）——连「改字段影响谁」都无需 AI 推算。
- **用户决策**（2026-10-16 拍板，两项）：
  1. **立项为「原则六 · 系统优先，AI 归位」**，写入设计 §0.1 + AGENTS.md §0.1 同源，判定标尺「能否写成枚举规则 / 表单校验：能 → 系统直做（不经 AI 对话）；不能 → AI 做」；
  2. **B-24（定案立项修改入口）立即返工为系统直改**——原则六的最大冲击面恰是当日上线的「面板编辑 → 结构化指令走 Agent 对话」方案，返工卡口批准见 D-017。
- **落地内容**（本条仅文档）：[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §0.1 新增原则六（系统优先，AI 归位，含判定标尺与双通道取舍）+ 头部计数「四条」修正为「六条」（原则五补计）；[AGENTS.md](../../AGENTS.md) §0.1 同源新增第 6 条。
- **波及文件**：短剧Agent平台设计.md、AGENTS.md。
- **后续约束**：凡「系统可做却走 AI 对话」的既有 / 新建功能，按原则六返工或驳回；同一能力双通道并存时系统直改为默认入口、对话为开放式兜底，两者须落同一数据模型与追溯机制。

---

## D-017 ｜ K1+K8 ｜ B-24 返工为系统直改：BriefApprove.by 加 'ui' + 恰 1 个 brief 写 IPC

- **日期**：2026-10-16
- **卡口**：K1（`shared/types.ts` 共享层修改）+ K8（新增 IPC 面：恰 1 个 invoke `brief:update`）
- **触发背景**：B-24（定案后无修改入口）首版按「面板编辑 → 结构化指令走 Agent 对话」落地；原则六（D-016）确立「确定性操作系统直做」，该路径恰在原则另一侧，用户拍板**立即返工为系统直改**（面板 UI 与校验保留，提交改系统直写 brief + 再版落盘 + 影响追溯；对话入口保留为大白话兜底）。返工需两处卡口批准：① 再版 brief 的 `approve.by` 现仅 `'gate' | 'verbal'`，面板直改两者皆不贴语义；② renderer 不直连文件系统，直写 brief 需新增写 IPC。
- **用户决策**（2026-10-16 拍板，三项；批准时点先于编码）：
  1. **K1 批准 `BriefApprove.by` 加 `'ui'`**：语义诚实（UI 通道直改），改动限于 `shared/types.ts` 一个联合成员 + 注释，`electron/brief/publish.ts` 的 `BriefApproveInput` 同步；
  2. **受影响节点全部仅挂脏**：直改再版后 assessImpact 命中的节点一律 `decision: 'mark'`（severity HIGH / MEDIUM 照旧标注），不自动重生成、零意外算力消耗；§2.6.7 三选一面板属 feature-006 未建范围，本通道不做；
  3. **K8 批准恰 1 个新 IPC**：`brief:update`（字段 patch → 主进程读最新立项合并 → 就绪闸 → 单次 enqueue：publishBriefFiles + 影响清单落盘 + manifest 推进 + 画布全量挂脏），preload / global.d.ts / dev-mock-api 三镜像同步。
- **落地回填**（2026-10-16 当日闭环）：
  - **K1 四处**：[shared/types.ts](../../shared/types.ts) `BriefApprove.by` 加 `'ui'`；[publish.ts](../../electron/brief/publish.ts) `BriefApproveInput` 同步；[plan.ts](../../electron/brief/plan.ts) `listBriefVersions` 返回与局部 `found` 的 approveBy 联合类型同步；[render-md.ts](../../electron/brief/render-md.ts) approveLine 三分支（`'ui'` → md 落款「修改立项面板直改」）。[tools.ts](../../electron/mcp/tools.ts) approveSchema 保持 `z.enum(['gate','verbal'])` 不动——`'ui'` 仅供系统通道，Agent 通道语义不变。
  - **K8 恰 1 IPC**：新建 [update.ts](../../electron/brief/update.ts) `updateBriefFields`——基线读取（无已发布立项 BRIEF_NO_BASELINE 零写盘）→ prev+patch 合并 draft → diffBrief 空变更 INVALID_ARGUMENT → evaluateDraft 就绪闸（BRIEF_NOT_READY 携 missing）→ assessImpact 复算 → publishBriefFiles `{by:'ui'}` 再版四落盘 → 影响清单落盘（items decision 恒全 `'mark'`）→ manifest 推进 briefVersion → 单次 enqueue：persistInQueue 受影响节点全量挂脏 + briefNode ref/meta upsert；画布经 canvasStore.subscribe 自动广播 `canvas:changed`，处理器零手动推送。[main.ts](../../electron/main.ts) `brief:update` 处理器白名单校验六控件字段（kind 枚举 `'commercial'|'memorial'`，episodeDuration/episodeCount/aspectRatio + mainStyleId/auxiliaryStyleId 逐键 `typeof string`），空 patch 拒绝；[preload.ts](../../electron/preload.ts) / [global.d.ts](../../src/global.d.ts) / [dev-mock-api.ts](../../src/dev-mock-api.ts) 三镜像同步。
  - **renderer 返工**：[Stage0View.tsx](../../src/studio/stage0/Stage0View.tsx) BriefEditPanel 提交改直调 `window.api.updateBrief`（patch 仅携带变更字段），面板 UI/六控件（项目性质二选 + 时长/集数/画幅/主辅风格）/就绪红线校验/变更计数保留，新增 submitting 态与 `data-stage0-edit-error` 错误条（再版失败面板保持打开、按钮恢复可点）；面板说明文案改「提交后系统直接再版为 v(N+1) 并完成影响追溯（不经 AI 对话）」；onSend 死链全清（Stage0ViewProps → Stage0View → PublishedLoaded → PublishedBody → BriefEditPanel 五层 prop），[StudioApp.tsx](../../src/studio/shell/StudioApp.tsx) `handleSend` 保留供对话区。
  - **当日扩展（用户拍板「项目性质也可手动改」）**：面板五控件扩为六控件——`kind`（商业短剧/个人纪念二选一，D-007 枚举）纳入直改白名单；diffBrief / assessImpact 本已覆盖 `kind`（medium 分级）零改动。
  - **验证**：新建 [brief-update.test.ts](../../src/test/brief/brief-update.test.ts) 6 例（无基线 BRIEF_NO_BASELINE / 值同基线 INVALID_ARGUMENT / 置空 BRIEF_NOT_READY 三零写盘 + 全链路四落盘/changes/挂脏/广播断言 + 辅助风格清除 + 改 kind 命中消费节点挂脏）；[stage0-view.test.tsx](../../src/studio/stage0/stage0-view.test.tsx) B-24 describe 改写 5 例（预填六控件+无变更禁提交 / patch 仅含变更字段直调 / 取消不调 / 空集数红线 / 再版失败错误条）。全量 **48 文件 500 passed / 1 skipped**；typecheck 仅 3 条历史基线（plan.ts L96 局部 `found` 声明漏网补齐后零新增）。

---

## D-018 ｜ K1 ｜ 定案区入口动作恒显 + ProjectBrief 加 diagnosisDetail 诊断明细落盘

- **日期**：2026-10-17
- **卡口**：K1（`shared/types.ts` 共享层修改：`ProjectBrief` / `BriefDraft` 各加 1 个可选字段）
- **触发背景**：用户两问——①「入口动作 · 用户原话」区块在定案区为什么没有显示；②选题诊断 AI 给出的内容与结论为什么没有显示。查证结论两者均非 bug、是设计取舍：①该标签系设计稿（MiniMax Design 形态）标注，实现里仅 verbal 拍板路径渲染用户原话引用，gate / ui 路径无任何入口动作呈现——设计稿区块从未实现；②`diagnosisSummary` 原设计取舍为「摘要落盘、明细留在对话流」（types.ts 原注释），而对话流是 opencode 会话历史（runtime `session.messages`，不落盘到项目目录），完整诊断明细在项目内无从显示。
- **用户决策**（2026-10-17 经 AskUserQuestion 拍板，两项；批准时点先于编码）：
  1. **入口动作块恒显**（纯展示层，零 K1）：verbal 显用户原话引用；gate 显「门批准入 · 一键拍板」；ui 显「修改立项面板 · 系统直改再版」——三种拍板路径都有入口动作留痕；
  2. **K1 批准扩字段落盘 + 卡①显示**：`ProjectBrief.diagnosisDetail?: string` + `BriefDraft.diagnosisDetail?: string`，AI 发布立项时完整诊断明细随立项单落盘，卡①与立项单.md 增加「选题诊断明细」区块。
- **落地回填**（2026-10-17 当日闭环）：
  - **K1**：[types.ts](../../shared/types.ts) `ProjectBrief` / `BriefDraft` 各加 `diagnosisDetail?: string`（可选，存量 v1/v2 立项单读取不破坏）。
  - **electron 全链**：[tools.ts](../../electron/mcp/tools.ts) brief.plan / brief.publish 入参 schema 与透传（briefDraftSchema 同步）；[publish.ts](../../electron/brief/publish.ts) 明细 trim 非空才随立项单落盘；[update.ts](../../electron/brief/update.ts) 面板直改通道沿用 prev 明细（六控件不涉及明细）；[diff.ts](../../electron/brief/diff.ts) 参与字段级 diff；[impact.ts](../../electron/brief/impact.ts) MEDIUM_FIELDS 加 diagnosisDetail（与摘要同缀 medium）；[render-md.ts](../../electron/brief/render-md.ts) 新增「## 选题诊断明细」区块（恒渲染，无明细写（无））。
  - **renderer**：[Stage0View.tsx](../../src/studio/stage0/Stage0View.tsx) ①定案区 verbal-only 原话块改**入口动作恒显块**（`data-stage0-entry-action`；verbal 保留 `data-stage0-verbal-quote` 引用块，gate / ui 显路径文案）；②卡①只读卡与编辑卡各加诊断明细块（`data-stage0-diagnosis-detail`，长文限高滚动、恒只读无控件）。[select.ts](../../src/studio/stage0/select.ts) 与 [CanvasBoard.tsx](../../src/studio/canvas/CanvasBoard.tsx) 脏字段标签表同源补 `diagnosisDetail: '诊断明细'`（明细参与 diff 后若挂脏，脏条显中文标签而非英文 key）。
  - **提示词同步**：[showrunner.md](../../resources/opencode/agents/showrunner.md) 第 0 步门后 publish 入参加 `diagnosisDetail?`（节点①诊断卡完整明细随立项落盘并显示）；parentReference 字段表注改「诊断摘要与明细是立项留痕、下游产物不消费，均不进字段表」。
  - **验证**：新增/改写 7 例——[stage0-view.test.tsx](../../src/studio/stage0/stage0-view.test.tsx) 新 describe 5 例（入口动作 gate / verbal / ui 三路径恒显 + 卡①明细块只读态与编辑态同显恒只读 + 无明细不渲染）；[brief.test.ts](../../src/test/brief/brief.test.ts) diff 捕获 diagnosisDetail + render-md 明细区块两断言；[brief-impact.test.ts](../../src/test/brief/brief-impact.test.ts) it.each 明细 → medium；[brief-update.test.ts](../../src/test/brief/brief-update.test.ts) 面板直改明细原样沿用 + v2 md 渲染明细。全量 **48 文件 507 passed / 1 skipped**；typecheck 仅 3 条历史基线。
- **波及文件**：shared/types.ts；electron（mcp/tools.ts、brief/publish.ts、brief/update.ts、brief/diff.ts、brief/impact.ts、brief/render-md.ts）；renderer（studio/Stage0View.tsx、studio/stage0/select.ts、studio/CanvasBoard.tsx）；resources/opencode/agents/showrunner.md；测试 4 文件（stage0-view.test.tsx、brief.test.ts、brief-impact.test.ts、brief-update.test.ts）；文档三写：本台账、偏差清单 B-25、版本记录 2026-10-17 条目。
- **后续约束**：AI（showrunner 第 0 步）发布立项时应将节点①诊断卡完整明细经 brief.publish `diagnosisDetail` 入参落盘；`diagnosisSummary` 摘要口径不变（仍只写用户参与确认过的判断，B-15 纪律同适用于明细）；明细与摘要同为 medium 分级参与影响追溯，但不进 parentReference 字段表（下游不消费）。

## D-019 ｜ K8 ｜ feature-806 启动建包：806 先于 803 排期调整 + 分批策略 + harness 工具面预案

- **日期**：2026-10-27
- **卡口**：K8（harness.validate 新 MCP 工具面预案，随包呈报批准生效；本次建包仅文档，代码零 diff）；关联 K1 预案（`CanvasDirty.markedAt` 可选字段，见 806 契约 §1.1）
- **触发背景**：2026-10-27 立项阶段真机覆盖度排查确认「确认门全链路 + Harness 校验」为零落地缺口（设计书 §9 / §11 一期·4），B-46（超 30 天漂移提醒缺失）同日登记并经用户拍板归 806；用户同日批准启动 feature-806 建包（Spec 先行，不动代码）。
- **决策与执行口径**：
  1. **排期调整**：features/README §4 P2 原序「803 ComfyUI → 806 Harness」，现 806 先于 803 建包——806 批一仅 STAGE 0 文本侧校验与 0-final 门联动，不依赖媒体引擎；803 仍为 P3 媒体链前置、其相对顺序不变（循 D-014「规划基线而非编号锁定」先例）；
  2. **分批策略**：批一 = STAGE 0 harness 基础校验 + 0-final 门联动 + B-46 漂移提醒；批二 = STAGE 1-2 门序（1-a/1-b、2-a/2-b，2-c 随 feature-201 分镜文字稿收尾）；批三起 = STAGE 3-7 随 P3 各段产物包与 803 节奏；**各批独立呈报批准**，批一批准不视为后续批次放行；
  3. **工具面预案（随包呈报，批准生效）**：新增 `harness.validate` 单工具（MCP 27→28）+ showrunner 白名单 22→23；工具与写盘前拦截共用同一 `runHarnessValidation` 实现，四类七条 checkId 确定性校验、零 LLM（D-016）；**不设 harness.drift 独立工具**——漂移提醒系统直做（markedAt + 黄条/二次确认不阻塞提示，零新 IPC）；
  4. **真机两缺口处置**：web.search 成功路径 = 环境限制登记（本机 DuckDuckGo 不可达，非代码缺陷，不阻塞验收）；capture 跨重启持久化 = 列入 806 批一 T8 真机目验必验项。
- **波及文件**：docs/features/feature-806-Harness基础校验与确认门全链路/（五文件新建）；features/README 806 行；设计现状与偏差清单 B-46 行与 §3 路线表；本台账。代码零 diff。
- **后续约束**：批一实施须待用户批准任务清单（铁律 1）；实施中触碰未登记卡口（新 IPC/推送、其他共享类型、新依赖、其他 Agent 白名单）立即停手呈报；1-a/1-b、2-a~2-c 及 3-7 门未建前不得宣称「确认门全链路」完成。

---

## D-020 ｜ K1+K8 ｜ feature-011/012/013 三包方案批准与落地（011 纯 renderer / 012 门 payload 增键 + 门卡留存 / 013 L0 入模 + 直改扩键）

- **日期**：2026-10-28
- **卡口**：**K1**（仅 013：`shared/types.ts` 增 `BriefL0 { tags?; notes? }`，`ProjectBrief` / `BriefDraft` 各增 `l0?: BriefL0`）；**K8**（仅 013：`brief:update` 白名单扩键——fiveElements + genre/tone/platforms、premise 五键、diagnosisSummary、l0；零新 IPC/推送/MCP 工具、Agent 白名单 23 不动）。011 与 012 **零卡口**：012 门 payload 增 `impactSummary` 走 `CanvasGate.payload`（`unknown` 自由载体）不触 K1，approved 门卡放行仅 renderer 挂载分流不触 K8。
- **触发背景**：设计书 §2.6.5（拍板前同列改动与影响）、§2.6.6（立项单全字段可编辑）、§2.6.7（影响评估面板 L331-349）、§2.6.8（导航 hover 历史 + titlebar tooltip）仍有落地空白；002 §4.2 与 007 契约对面板/批量入口的明示排除、806 X 节「approved 门卡 findings 无挂载点」偏差待处置。2026-10-28 用户拍板三包分包方案，同日批准按推荐方案实施。
- **用户决策与落地值**：
  1. **011**：D1-A 复用 007 单产物重对齐链路（零新工具，维持 002「不内置编排器」）/ D2-C 保存后自动弹出 + 脏读黄条「查看影响评估」手动入口 / D3 勾选即决策、单条聚合消息 + 会话流留痕（decision 不回写）/ D4 面板与编排全系统直做、AI 仅承担产物重生成本身（D-016）/ D5-A 漂移提醒 + 一键对齐 + 查看影响评估三黄条并置（806 逻辑零 diff）。
  2. **012**：D-a=A1 再版门 payload 增第 4 键 `impactSummary`（展示快照，commit 以复算为准）/ D-b=B1 `brief.impact.assess` 前置到发门之前 / D-c=B `Stage0View` 放行 approved 门卡留存 / D-d 全系统直做；**806「approved 门卡 findings 无挂载点·登记偏差继续」经本包方案 B 翻案关闭**。
  3. **013**：1=A（L0 标签/备注入立项单 v2 模型，随版本化/diff/回滚留痕；项目名仍留 `.session.json` + `project:rename`）/ 2=b（仅 `diagnosisSummary` 直改，`diagnosisDetail` 保持只读）/ 3=A（批量一次提交 = 一次再版 + 一次评估）/ 4=a（tooltip X = done 且带 parentReference 且非 dirty 的下游产物节点数，Y 与左栏 ⚠k 同源）/ 5=a（自定义 hover 版本历史卡，复用 `brief:history` 懒加载）。
- **落地内容**：
  - 011：`src/studio/impact/impact-select.ts` + `ImpactPanel.tsx` + 16 例；StudioApp 面板接线（+59 行）、Stage0View 上报、StudioViewer 黄条新钮、dev-mock 演示数据。
  - 012：showrunner.md 再版纪律四处改写（白名单 23 零 diff）+ GateCardView 影响清单区 + `global.d.ts` 镜像类型 + Stage0View `GateRetentionCard` 两挂载点；新增 2 测试文件 12 例。
  - 013：`BriefL0` + diff `l0.tags/l0.notes` 低级命中 + publish/render-md 贯通 + `brief:update` 扩键与校验 + BriefEditPanel 全字段直改 + 标签/备注控件 + `brief-display.ts` / StageNavPanel hover 卡 / titlebar tooltip；新增 11 例。
- **波及文件**：`docs/features/feature-011/012/013-*/`（五文件）；`docs/features/README.md`（三行翻态 + §2「11 族 28 个」）；`docs/设计现状与偏差清单.md` §3 三行；`feature-806` 变更记录 X 节翻案注；本台账。
- **验证基线**：三包合并全量 **70 文件 821 passed / 0 failed / 1 skipped**；`npx tsc --noEmit` 恰 3 条历史基线；MCP **28** 工具 / showrunner 白名单 **23** / `package.json` 零 diff。真机目验受当前环境限制未执行，已在三包 T 节登记为遗留项，待用户桌面端验收。
- **后续约束**：011 不得私增批量编排 MCP 工具；012 的 `impactSummary` 只是门卡展示快照，写盘一律以 `brief.impact.commit` 复算结果为准；013 的 L0 仅 tags/notes 两键，`diagnosisDetail` 直改不开口子，新增其他共享字段须重新走 K1 呈报。

---

## D-021 ｜ K8 ｜ feature-014 AI 服务配置管理：配置范围 / safeStorage 加密落盘 / spawn 契约固定 / 入口形态 / 即时生效 + 「ark Key 永不落盘」口径修订

- **日期**：2026-10-31
- **卡口**：K8（新增恰 2 个 IPC：`settings:ai:get` / `settings:ai:update`；preload / global.d.ts / dev-mock 三端镜像同步属登记范围）；K1 零触发（不动 shared/types.ts）；K9 零触发（safeStorage 为 Electron 内置，零新依赖）
- **触发背景**：火山方舟文本三件套（API Key / Base URL / 模型名）硬编码于 [ark.ts](../../electron/ark.ts) 模块级 const，opencode 运行时参数（端口探测起点 4096、健康检查超时 10s、mock 引擎地址）硬编码于 [manager.ts](../../electron/runtime/manager.ts) 常量与 [provider.ts](../../electron/runtime/provider.ts)，用户无法在应用内管理；且既有口径「ark 的 Key 永不落盘」（provider.ts 头部注释：opencode.json 只声明 `env:["ARK_API_KEY"]`、Key 经子进程 env 注入）与应用级持久化需求冲突，需裁决。
- **用户决策**（2026-10-31 拍板，五项 + 规格定夺一项；批准时点先于编码）：
  1. **配置内容**：方舟文本三件套 + opencode 运行时三项（端口探测起点默认 4096 起 25 个、健康检查超时默认 10s、mock 引擎地址，收「高级」折叠区）；ComfyUI 实例 CRUD 已有 feature-017 承载，**不在本包**；
  2. **Key 存储（口径修订）**：`safeStorage.encryptString` 加密后 base64 落 userData JSON（Windows DPAPI）；`isEncryptionAvailable()=false` 时**拒绝保存并报错，不回退明文**。旧口径修订为：**opencode.json 生成态契约不变**（Key 永不进 opencode.json，仍经子进程 env 注入）；**应用级配置仅允许 safeStorage 加密落盘**；
  3. **spawn 参数契约固定**（`serve --hostname 127.0.0.1 --port`，禁 mdns/cors）**不可配**，不进面板；
  4. **入口形态**：StudioApp rail 底部 AI 圆标系统菜单（`data-sys-menu-root`）增「AI 服务设置」项开模态面板；
  5. **生效方式**：保存即时生效不重启——方舟类下一条消息生效（ark.ts 废模块级 const 改动态读 store）；runtime 三项提示用户手动重连；
  6. **规格定夺（包内裁决）**：store 字段缺席时回退 `process.env`（保留开发态 .env 工作流，dotenv 保留不废弃），再缺回退内置默认；面板逐字段显示来源标记（自定义 / 环境变量 / 默认）。
- **落地回填**：已实施，见 [feature-014 变更记录](../features/feature-014-AI服务配置管理/SDG-AI-变更记录.md) T 节（白名单：`electron/settings/ai-service.ts` 新建、`ark.ts`、`main.ts` 三挂点 + 恰 2 IPC、`manager.ts` `portRangeStart`、`preload.ts`、`global.d.ts`、`dev-mock-api.ts`、`StudioApp.tsx`、`AiServicePanel.tsx` 新建 + 新测试）。
- **波及文件**：docs/features/feature-014-AI服务配置管理/（五文件）；本台账；features/README 增 014 行（收尾）。
- **后续约束**：IPC 净增恰 2 为红线，任何第 3 个 IPC / 新推送 / 新 MCP 工具须停手复议；图像/视频/音乐生成通道红线不变（D-010），本包只管文本侧方舟与运行时参数；spawn 参数面板永不开口子；明文 Key 任何环节不得落盘（含日志）。

---

## D-022 ｜ K8 ｜ feature-014 固定双服务商：新增 LM Studio 本地/局域网文本模型服务

- **日期**：2026-10-31
- **卡口**：K8（扩展既有 `settings:ai` DTO、opencode provider 与 Agent profile 生成契约）；K1/K9 零触发；不新增 IPC、MCP 工具或 Agent 工具。
- **触发背景**：用户明确要求服务商不可新增/删除，并增加 LM Studio 本地/局域网模型服务。
- **用户决策**：①固定火山方舟 / LM Studio 两项单选，无 CRUD；②LM Studio 仅 Base URL + 模型 ID，默认 `http://127.0.0.1:1234/v1`，支持局域网、无 API Key，保留 `LMSTUDIO_BASE_URL/LMSTUDIO_MODEL` env 回退；③保存后手动重连运行时生效，不自动中断当前会话。
- **落地回填**：store/DTO、provider/profile、manager/client/main 与固定两项面板已贯通；旧配置默认 ark、双方配置独立保留，当前模型缺失不跨服务商或 mock 回退，renderer 不直连 LM Studio。
- **验证与遗留**：聚焦 7 文件 94 passed；全量 75 文件 893 passed / 0 failed / 1 skipped；IPC 44、MCP 28、Agent 白名单 23/5/9/9，package.json/shared/types.ts 零 diff。本机默认 LM Studio 端点连接被拒绝，真实 Electron + 本机/局域网 LM Studio 推理及重启持久化待真实服务验收。

---

## D-023 ｜ K7 ｜ 根原则回流 D-016 + Agent 扁平调度权限定界

- **日期**：2026-11-02
- **卡口**：K7（项目总体原则冲突裁决）；K1/K8/K9 零触发——不修改共享类型、不新增或变更 IPC/MCP/工具权限面、不新增依赖。
- **触发背景**：根设计 §1 仍写「Agent 一等公民、所有动作由 Agent 规划与调度」，与 D-016「系统优先，AI 归位」冲突；`media-director` frontmatter 禁用 `task`，正文却要求经 `task` 委派 `comfyui-operator`，同时又声明不派 task。
- **裁决结论**：
  1. **根原则以 D-016 为终态**：系统承载应用与确定性操作，AI 仅承担文本生成与开放式语义理解；系统直改为默认入口，对话为开放式兜底，两者落同一数据模型与追溯机制。删除「所有动作由 Agent 规划与调度」总原则。
  2. **保持扁平最小权限**：showrunner 是唯一 `task` 调度者，writer / media-director / comfyui-operator 均为 `tools.task: false` + `permission.task: deny`；不开放 subagent 嵌套委派。
  3. **媒体链路由 showrunner 合流**：media-director 只整理并回交媒体任务交接物；showrunner 收到后另行委派 comfyui-operator 完成工作流参数化、作业提交与轮询、产物回写。media-director 不持有 queue/status，不直接执行引擎操作。
- **落地内容**：根设计 §1/§4.1/§5.2 与 HTML 镜像同步；media-director 提示词删除自行委派要求，showrunner 明确两段扁平委派；profile 静态契约测试增加「不派 task 与经 task 委派不得并存」回归断言。
- **后续约束**：任何 subagent 如需新增 `task` 或引擎工具权限，必须重新呈报权限边界与调度链，不得仅改提示词绕过 frontmatter。

---

## D-024 ｜ K7/K8 ｜ 影响面板关闭语义 + 事实源按职责分层裁决

- **日期**：2026-11-02
- **卡口**：K7（事实源与治理口径冲突）；K8（立项再版核心业务语义修订）；K1/K9 零触发——不修改共享类型、不新增依赖；本决策不新增 IPC/MCP 工具。
- **触发背景**：根设计 §2.6.7 仍规定「取消则 v(N+1) 不落盘」，与 D-017 已批准的「先完成再版、影响清单、manifest 与画布挂脏，再打开影响面板」及现行代码冲突；同时 `ImpactPanel` 的「取消」与「仅标记脏」同效，形成重复业务动作。`docs/README.md` 又将「磁盘实况 + shared/types.ts」列为全仓终态基准，与「Spec is Truth」及 L1「修代码匹配 Spec」冲突。
- **用户裁决**：
  1. **保留再版，关闭面板**：确认再版成功即表示 v(N+1)、影响清单和脏标记已经落盘；面板只决定「一键重生成选中 / 仅标记脏」，不提供撤销再版的「取消」业务按钮。Esc 或显式关闭控件仅退出面板、暂不处理，不撤销任何已落盘内容；撤销仍走历史版本再发一版的既有回滚语义。
  2. **事实源按职责分层，不做全仓单线代码优先**：项目特化规则与通用治理规则管执行纪律；已批准决策负责裁断冲突并必须回流相关 A 类文档；根设计管全局产品与架构，Feature 契约管包内实施边界且不得越权覆盖全局原则；`shared/types.ts` 只权威约束共享字段形状，Agent profiles 约束对应 Agent 行为与权限声明；磁盘代码是实现证据而非目标事实源，冲突按 L1/L2/L3 处理；README、HTML、版本记录分别只承担导航、镜像与历史职责。
  3. **D-012 适用边界**：其「以磁盘实况为终态」仅用于当时对话链路及 §5/§7.1 的反向同步，不得扩张为「代码永远覆盖规格」的全仓规则。
- **落地范围**：根设计 §2.6.6/§2.6.7 与 docs/README 先行回流；feature-011 五文件同步为「两业务动作 + 关闭语义」，随后移除重复「取消」按钮并补关闭行为测试；HTML 镜像在工程收敛阶段重渲染。
- **后续约束**：若未来要求「取消并撤销本次再版」，须另立决策与任务包，设计立项单、影响清单、manifest、画布的一致性回滚或补偿，不得仅修改按钮文案。

---

## D-025 ｜ K7 ｜ 现状快照退出规范层，偏差清单仅保留开放偏差

- **日期**：2026-11-11
- **卡口**：K7（修改通用治理文档的文档职责与维护规则）；用户在讨论中明确选择“彻底收敛”，随后通过 AskUserQuestion 批准同步治理。K1/K8/K9 零触发。
- **触发背景**：`docs/设计现状与偏差清单.md` 已增长至 139,310 字节，混入模块实况、测试数量演进、路线镜像、已解决偏差和任务包状态，既重复其他事实源，也超过工具单次 64 KiB 读取限制。文件顶部还将 D-012 的局部口径扩张为全仓“以磁盘实况为终态”，与 D-024 冲突。
- **用户裁决**：
  1. **一个事实只有一个规范出处**：按 D-024 的职责分层执行，不把所有信息塞入单一文件；代码与测试是实现及验证证据，不再抄写为“当前实况”规范。
  2. **偏差清单只保留真实开放偏差**：必须有明确规范出处和已核实的当前实现差异；尚未到建设阶段的路线能力不算偏差，已实现但待人工验收的事项留在任务包，不自动算偏差。
  3. **闭环即清理**：设计与实现对齐并完成所需验证后，删除对应条目；B 编号不重排、不复用。实施过程与历史结论由 Feature 变更记录、根版本记录和 Git 追溯。
  4. **移除重复内容**：磁盘模块快照、测试数量演进、路线镜像、任务包落地复表、已解决条目及“以磁盘实况为终态”的越界表述均退出该文件。
- **落地复核**：B-10 的 Windows 真机验收已于 2026-10-29 通过，不再保留；B-06 属路线能力，B-66 属 feature-015 待验收事项，各回原载体。B-47 所引用的 feature-302 任务包不存在，相关字段也不存在于根设计或其他有效契约，因缺乏规范出处而移除；未来如确有需求，须先建规格再判断实现偏差。B-67 原指顶栏谱系版本硬编码，当前 `StudioApp.tsx` 已从 `style-catalog-store` 读取真实版本，按闭环规则移除，不得改指其他硬编码字段来延续旧编号。
- **落地范围**：治理 v1.6 的 §1、§2.1–§2.2、§3、§10–§12、根 AGENTS 索引、`docs/设计现状与偏差清单.md`、根 README、docs README、features README 与本台账同步；不修改产品功能、共享类型、IPC/MCP 或依赖。
- **后续约束**：新偏差只写规范出处、当前差异与闭环条件，详细证据和修复过程放对应 Feature；不得重新追加已解决条目、测试演进或路线镜像。

---

## D-026 ｜ K7 ｜ 分层事实源规则选择性反补 WPS 通用原版

- **日期**：2026-11-11
- **卡口**：K7（修改 AI-SDG 通用主方案、精简指令及既有 B 类镜像）；用户明确选择“选择性反补”。K1/K8/K9 零触发。
- **触发背景**：D-024/D-025 已在短剧项目落实分层事实源与开放偏差生命周期，但 WPS 通用主方案仍为 v1.6、精简指令仍为 v1.5；其他项目若继续继承原版，仍会沿用笼统的代码冲突裁决、Feature 契约越权优先级及重复实况快照。
- **用户裁决**：只回流通用方法论，不用项目版覆盖原版；短剧项目路径、Electron 技术栈、D-024/D-025、B-11/B-68 等项目特化内容不得进入 WPS 通用文件。主方案升级至 v1.7，WPS 精简指令升级至 v1.6，既有主方案 HTML 同步重渲染。
- **落地内容**：通用规则新增分层事实源职责、唯一规范出处与开放偏差闭环生命周期；Spec is Truth 改为先确认规范出处再按 L1/L2/L3 处理；Feature 契约限缩为本包前后端接口契约；上下文只加载真实启用文档；启动模板、自检、附录与 FAQ 同步。HTML 保留既有导航、样式、19 章节及 4 幅 SVG，从主方案 Markdown 重渲染正文与版本元数据。
- **边界与追溯**：项目内治理文件不因本次反补重复复制或升版；WPS 通用模板中的技术宪法、术语表等默认文档继续保留，仅在实际项目启用时加载。本次不修改产品代码、共享类型、IPC/MCP 或依赖，不提交 Git。

---

## D-027 ｜ K7 ｜ Dufs 通用精简指令 v1.11 全量同步与项目化适配

- **日期**：2026-11-13
- **卡口**：K7（修改通用治理核心规则及根 AGENTS.md 规则索引）
- **触发背景**：用户指定 Dufs《AI-SDG-AI工具执行指令.md》已升至 v1.11（对应主方案 v1.13），项目仓库内规则仍为 v1.6。上游 v1.7–v1.11 新增契约形态与写权、3 文件精简档、规则豁免、设计层上下文、卡口时限与提交标注、安全纪律第 9 条等核心规则，不能作为普通文字校对直接覆盖。
- **用户决策**（2026-11-13 拍板）：通过 AskUserQuestion 选择「全量同步（推荐）」；批准同步上游 v1.7–v1.11 全部通用规则，并按本项目适配 TL = 用户 / 项目负责人、0xx–8xx 编号段和实际路径，更新治理文件、AGENTS 索引与关联导航，登记本决策和版本记录。
- **落地内容**：
  1. [AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) 升至 **v1.11 / 对应主方案 v1.13**：三条铁律口诀与执行细则、AI-SDD/AI-SDG 口径、契约 md/yaml/快照职责、契约单点决策与 AI 落笔、契约版本及抖动阈值、5/3 文件档、规则豁免、设计层上下文、卡口提出时间与未确认不放行、共享层例外验证口径、开放清单边界、安全纪律第 9 条及自检项。
  2. **项目特化保留**：`0xx–7xx` 对应 STAGE 0–7、`8xx` 为平台基础；新包取所属段当前最大已用编号 + 1，编号不回收不复用；§2.2 项目文档职责、§7.2 过程产物清零、§7.3 问题卡三级判定及根 AGENTS 开发原则均不套用上游通用示例覆盖。
  3. [AGENTS.md](../../AGENTS.md) 只更新通用规则索引，不复制规则正文；[docs/README.md](../README.md) 与 [docs/features/README.md](../features/README.md) 同步 v1.11、D-027、5/3 文件档和编号导航。
- **波及文件**：[AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md)、[AGENTS.md](../../AGENTS.md)、[docs/README.md](../README.md)、[docs/features/README.md](../features/README.md)、本台账、`版本记录.md`。
- **边界**：纯治理与导航文档变更；未修改产品代码、共享类型、业务接口、依赖、commit-msg 钩子或 CI 配置，K1/K8/K9 零触发，未提交 Git。提交标注与机检条款作为后续执行规则同步，本次不虚构新增机检能力。

---

## D-028 ｜ K7 ｜ 决策台账双层结构：决策本体不可改，终局状态单列

- **日期**：2026-11-13
- **卡口**：K7（修改项目通用治理核心规则与根 AGENTS.md 规则索引）；K1/K8/K9 零触发。
- **触发背景**：项目级决策台账持续累积，既有“现状型内容可直接删除或改写为终局口径”的规则会覆盖当时执行语境，使审计历史与当前状态混在同一正文；台账体积增长与事实漂移也需要分别治理，不能靠删除历史解决。
- **用户决策**（2026-11-13 拍板，原话“好的，按这个方案修改治理规则”）：批准“决策本体不可改、终局状态单列”的双层结构，并将登记入口收紧、单一事实源、同步检查、轻量机检和必要年度分卷策略写入项目治理规则。
- **决策理由**：当时背景、用户拍板与决策理由是审计证据，必须冻结；当前效力与规范出处会变化，应通过可更新的终局状态指针维护。实现、路线和验证事实各有唯一载体，复制进台账只会制造第二事实源。
- **批准方案**：
  1. 决策本体包含 D 编号、卡口、日期、触发背景、当时用户决策与决策理由，登记后永久冻结；既有历史执行叙述也不因状态变化删改。
  2. 后续决策不删除旧条目，只在相关条目末尾追加或更新终局状态，标明当前效力、取代范围、后续 D 编号与规范出处。
  3. 项目级与 Feature 级决策分载体登记；新条目不新增实现文件清单、测试 / 工具 / IPC 统计、路线进度或模块实况。
  4. 触及台账时检查相对链接、Feature 路径、D 编号重复和卡口必填字段；自动化未建立前由等价人工检查兜底。
  5. 体量影响维护时，经用户确认采用主索引 + 年度分卷；条目整体迁移、编号不变、正文不双写，不删除审计历史。
- **实施边界**：仅修改项目内治理规则、台账维护规则与追溯导航；不回写 Dufs / WPS 上游，不批量重写既有条目，不立即分卷，不新增机检脚本，不修改产品代码、共享类型、业务接口或依赖。
- **终局状态**（2026-11-13 更新）：现行；项目级决策台账按双层结构维护；规范出处：[AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) §7.1；后续决策：D-029（将历史冻结与年度分卷原则扩展至版本记录，不取代本决策）、D-030（明确当年过大可分卷并执行首次结构迁移，不取代本决策）。

---

## D-029 ｜ K7 ｜ 版本记录编年史：历史条目冻结，变化另起新条目

- **日期**：2026-11-13
- **卡口**：K7（修改项目通用治理核心规则与根 AGENTS.md 规则索引）；K1/K8/K9 零触发。
- **触发背景**：根版本记录需要长期保留项目级编年史，但既有文件头允许删除或改写过时条目，与治理规则的历史快照保护口径不一致；部分单 Feature 实施、缺陷和验证细节进入根文件，也与包内变更记录形成重复，持续增长后更易产生事实漂移。
- **用户决策**（2026-11-13 拍板，原话“按这个方案修改治理规则”）：批准版本记录采用历史条目冻结、变化另起新条目的编年史模式，并落实登记入口收紧、单一事实源、轻量检查和主索引 + 年度分卷方案。
- **决策理由**：版本记录的价值是保存当时变更与验证快照，而不是持续追踪最新状态。历史回写会破坏编年证据；复制 Feature 实施日志和实时状态会形成第二事实源。与决策台账不同，版本记录通过新增事件表达变化，无需为每条追加终局状态。
- **批准方案**：
  1. 根版本记录只登记跨 Feature、架构 / 治理版本、发布及项目级里程碑；单 Feature 日常实施只记包内，确属项目级里程碑时根文件仅留短摘要与链接。
  2. 新条目包含日期、标题、变更事实与依据、当时验证结论及事实源链接；不复制完整文件清单、全量日志、实时路线、模块实况或待办进度。
  3. 历史条目登记后冻结，后续变化新增条目，不为每条追加终局状态；史实错误通过新勘误条目说明，仅允许无语义变化的链接技术修复。
  4. 触及版本记录时检查登记范围、必填字段、日期倒序、重复条目、相对链接及 Feature / D 引用。
  5. 年度结束或体量影响维护时，经用户确认采用主索引 + 年度分卷；条目整体迁移、正文不双写，不删除历史。
- **实施边界**：新增 §7.4，保留既有 §7.3 问题卡编号与历史引用；只修改项目内治理、追溯和导航文档，不回写 Dufs / WPS，不批量清洗或重写既有条目，不立即分卷，不新增机检脚本，不修改产品代码、共享类型、业务接口或依赖。
- **终局状态**（2026-11-13 更新）：现行；根版本记录按冻结编年史与项目级入口维护；规范出处：[AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) §7.4；后续决策：D-030（明确当年过大可分卷并执行首次结构迁移，不取代本决策）。

---

## D-030 ｜ K7 ｜ 编年文件结构治理：主索引 + 年度分卷，当年过大可分卷

- **日期**：2026-11-13
- **卡口**：K7（修改项目通用治理核心规则及决策、编年文档结构）；K1/K8/K9 零触发。
- **触发背景**：决策台账已达 73,605 字节，超过工具 64 KB 单次读取上限；版本记录已达 191,654 字节、704 行、84 个条目，混入单 Feature 实施长文，并存在大量历史失效相对链接。D-028/D-029 只建立后续维护规则，明确未清理既有历史，文件体积与检索问题仍然存在。
- **用户决策**（2026-11-13 拍板，选择“结构治理（推荐）”）：批准两个文件转为总索引，2026 年条目整体迁入年度分卷；补充当年体量过大也可分卷规则，保留全部历史，仅修复无歧义链接。
- **决策理由**：历史冻结约束的是正文语义与审计证据，不禁止改变存储位置。主索引与年度分卷可以在不删除、不改写历史的前提下恢复可读性；分卷与原文件同目录可保持既有相对链接层级，避免迁移本身制造第二轮链接漂移。
- **批准方案**：
  1. §7.1 与 §7.4 明确当年体量影响维护时也可分卷，无需等待年度结束；年度分卷与原主文件同目录。
  2. 决策台账主文件保留 D 编号、日期、卡口、标题与分卷链接，全部决策正文整体迁至 `SDG-AI-决策台账-2026.md`；不为旧决策批量补写终局状态。
  3. 版本记录主文件保留日期、标题与分卷链接，全部编年正文整体迁至根目录 `版本记录-2026.md`；历史单 Feature 长文作为冻结记录保留，不按新入口规则追溯删除。
  4. 仅修复能依据唯一现存目标无歧义确认的链接路径；目标已删除或无法唯一确认的链接原样保留，并登记数量，不猜测替换。
  5. 同步治理版本、决策指针、docs 导航和编年记录；校验条目完整性、编号、索引覆盖、日期顺序、链接及差异格式。
- **实施边界**：只做项目内治理与追溯文档结构迁移；不删除、压缩或重写历史正文，不回写 Dufs / WPS 上游，不新增持久机检脚本，不修改产品代码、共享类型、业务接口或依赖，不提交 Git。
- **终局状态**（2026-11-14 更新）：现行；决策台账与版本记录采用主索引 + 同目录年度分卷，当年过大亦可分卷；当时 B9 引用的 Qwen 图像通道仅由 D-033 反转为 MiniMax H3 Image，其余执行边界不变；规范出处：[AI-SDG-AI工具执行指令.md](./AI-SDG-AI工具执行指令.md) §7.1 / §7.4；后续决策：D-033。

---

## D-031 ｜ K8 ｜ 八步阶段里程碑化与产物依赖双轨并行

- **日期**：2026-11-13
- **卡口**：K8（修改根设计的生产流程、协作与依赖调度架构）；K1/K7/K9 零触发。
- **触发背景**：根设计部分条款、线性 `manifest.status` 与固定 Agent 编排存在阶段级串行倾向，与真实内容依赖不符，也与画布按产物节点组织、无八阶段式全局流程状态机的参考形态不一致。角色概念 / 定妆实际主要消费人物设定与视觉风格，不应等待完整剧本分场；但简单放开全部并行又会让正式媒体生产引用未确认草稿，扩大返工。
- **用户决策**（2026-11-13 拍板，选择“双轨版本门控（推荐）”，随后指示“按这个方案更新设计文档”）：保留八步完整闭环，将阶段改为产物归属与汇总验收里程碑；具体任务按最小产物依赖 DAG 并行，并采用草稿试产 / 正式生产双轨版本门控。
- **决策理由**：八步保证业务闭环与阶段产物不缺失，产物 DAG 保证任务按真实依赖尽早推进；双轨门控把探索效率与正式生产的版本可靠性分开，精确版本血缘则把上游再版的影响限制在真实引用分支，兼顾并行效率、返工成本与可追溯性。
- **批准方案**：
  1. 0 立项至 7 发布八步不合并、不裁剪，但不再表示“完成一步才能开始下一步”的全局串行启动锁；允许多个 STAGE 同时进行中，各阶段整体完成仍要求所属产物覆盖完整并通过验收。
  2. 任务以角色、场景、场次、镜头、单集为依赖粒度。故事大纲、人物设定与主视觉风格具备后即可开展角色概念 / 定妆；剧本分场、对应场场景 / 道具、分镜、单镜头、后期准备与发布物料按各自最小前置推进。
  3. 草稿 / 打样轨可引用已声明依赖的上游草稿或已确认版本，产物必须标记“试产”，不得冒充正式资产或直接进入正式合成 / 发布；正式生成、批量生产与正式锁定只引用已确认上游版本。试产转正式须重新生成或重放校验并走确认门，不能只改标记。
  4. 任务记录 `artifactId + version + requiredStatus`、生产轨道与产物版本；规划产物的资产逻辑引用与实际媒体文件版本依赖分离，缺料报告具体产物、版本或确认状态。
  5. STAGE 状态改为未开始 / 进行中 / 待验收 / 已完成 / 部分受影响的汇总结果，不作为其他任务的统一启动锁。上游再版只沿真实版本依赖边挂脏直接及传递下游，无关节点继续推进。
  6. 当前线性 `manifest.status`、固定 Agent 编排和 2-c 文字草案快照保留为实现事实，目标 DAG 不冒称已落地；后续由对应 Feature 包对齐任务调度、依赖状态、画布与影响传播。
- **实施边界**：本次只更新根设计、人读镜像及决策 / 编年追溯文档；不修改产品代码、Agent 提示词、共享类型、业务接口或依赖，不运行产品测试，不提交 Git。
- **终局状态**（2026-11-14 更新）：现行，由 D-032 补全八阶段逐阶段基线，不取代本决策的阶段里程碑化与双轨门控；规范出处：[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §0.1 / §1 / §2.1 / §3.2–3.3 / §4.2 / §5.1 / §7.1 / §11；人读镜像：[短剧Agent平台设计.html](../design/短剧Agent平台设计.html)；后续决策：D-032。

---

## D-032 ｜ K8 ｜ 八阶段完整并行基线、单集末端与双轨验收矩阵

- **日期**：2026-11-14
- **卡口**：K8（补全根设计的八阶段生产调度、验收与影响传播架构）；K1/K7/K9 零触发。
- **触发背景**：D-031 已确立阶段里程碑化、最小产物依赖 DAG 与双轨版本门控，并以角色定妆和剧本分场并行为例，但尚未逐阶段定义 STAGE 0–7 的最小调度 / 验收产物、真实硬依赖、可提前准备、草稿试产、正式生成 / 锁定、两级验收和再版影响范围。若只落实单个示例，后期仍可能被“全集镜头齐”锁住，发布仍可能被“全剧后期齐”锁住，后续开发容易重新回到全局串行模型。
- **用户决策**（2026-11-14 拍板）：用户明确“角色定妆可与剧本分场并行，只是我想到的，应该还有别的可以并行，你要全面分析8个阶段。这是重大的设计思路变化，我们先设计好，要不影响后面开发过程。要用图像化的方式展示给我看并方到文档中”。批准先形成完整八阶段设计，再将图稿和可维护图源纳入文档。
- **决策理由**：只有逐阶段拆开产物归属、任务启动、生产轨道和验收条件，才能把 D-031 的原则变成可实施、可检查的调度契约；单产物尽早验收可支持下游局部就绪，阶段整体验收仍保证八步闭环完整。后期与发布必须按单集下沉，跨镜依赖必须来自显式引用，资源排队必须与依赖就绪分离，才能避免隐性全剧串行锁与无效等待。
- **批准方案**：
  1. 保留 0 立项至 7 发布八步完整闭环，为 STAGE 0–7 建立统一七列矩阵：最小调度与验收产物、真实硬依赖、可提前准备 / 并行、草稿试产、正式生成 / 锁定、单产物验收与阶段整体验收、上游再版影响。
  2. STAGE 0 的选题诊断、故事前提与主视觉风格草案可并行收敛，正式下游基线只读用户确认的 `0-final`；STAGE 1 的单集大纲、单角色小传分别校验，基础角色定妆只依赖相关人物设定与主风格，可与 STAGE 2 按集 / 按场分场并行，单场再版只影响显式下游。
  3. STAGE 3 的角色、场景、道具、音频四分支并行，单项候选选定、QC 与人工锁定后形成正式资产版本；STAGE 4 可先绑定资产逻辑 ID、生成模式、提示词与时长，真正生产前才校验实际媒体版本。
  4. STAGE 5 的独立镜头、多候选打样可并行；普通相邻镜头不建依赖边，只有 `continuation`、前段末帧 / 视频引用等显式关系形成跨镜依赖。无对白镜头不挂音色参考，配音一期仍走 T2A 人机通道。
  5. STAGE 6 的配乐草案、字幕模板、片头片尾、剪辑工程和调色测试可提前，最终合成按单集读取本集选版镜头、正式音频和实际时间码；STAGE 7 的封面、标题、简介、渠道文案与发布计划可提前，本集成片验收、合规与物料齐备后可独立发布，复盘才等待真实上线数据。发布排序属于渠道策略，不建立制作依赖边。
  6. 严格区分可提前准备、草稿试产、正式生成、正式锁定、单产物验收与阶段整体验收。草稿轨可读已声明的草稿或已确认版本并标记试产；正式生成 / 批量生产 / 正式锁定只读已确认版本。试产转正式必须重新生成或等价重放校验，形成新正式版本并重新通过 Harness / QC 与用户确认门。
  7. 规划引用与媒体实引分离，精确记录 `artifactId + version + requiredStatus`、生产轨道、本产物版本与实际上游版本列表；上游再版只沿真实版本依赖边挂脏直接与传递下游。阶段保留未开始 / 进行中 / 待验收 / 已完成 / 部分受影响五种汇总状态。
  8. DAG 决定“可以做什么”，ComfyUI 多实例、GPU / 显存、worker 和队列决定“实际同时执行多少”；依赖展开、版本检查、缺料定位、状态汇总和精准挂脏由系统确定性执行，AI 仅承担文本生成与开放式语义理解。图像 qwen-image、视频 MiniMax H3、音乐 MiniMax Music3 全部经本地 / 局域网 ComfyUI 的媒体红线不变。
  9. 文档提供八阶段并行门控全景、单集单镜并行流水线、双轨版本门控与局部影响三张 SVG，并保留自包含可编辑 Whiteboard HTML 与 Excalidraw 源。目标实施先统一 ID / 引用 / 血缘与生产轨道，再实现门控与影响传播，依次打通 STAGE 0–2、3–5、6–7，最后叠加多实例资源调度。
- **实施边界**：本次只更新根设计、人读镜像、图稿及决策 / 编年 / 导航文档；当前线性 `manifest.status` 与固定 Agent 编排仍为实现快照，不冒称目标 DAG、单集后期 / 发布或精确媒体版本血缘已落地。不修改产品代码、Agent 提示词、共享类型、业务接口或依赖，不运行产品测试，不提交 Git。
- **终局状态**（2026-11-19 更新）：**部分取代，其余现行**；八步启动／并行／验收／再版语义继续现行。当时引用的“图像仅 qwen-image”由 D-033 反转为“图像仅 MiniMax H3 Image”，Qwen 专用能力停用归档；当时“配音一期仍走 T2A 人机通道”由 D-038 明确废止，语音通道维持待定，后续正式 K7 裁决前不得绑定豆包／T2A、配置语音云端 Key 或伪造配音闭环，无对白镜头不挂音色参考等其他约束不变。规范出处：[AGENTS.md](../../AGENTS.md) §0.1、[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §0.1／§1／§2.1／§4.2／§7.1／§11；人读镜像：[短剧Agent平台设计.html](../design/短剧Agent平台设计.html)；可编辑图稿：[八阶段并行生产设计图.html](../design/diagrams/八阶段并行生产设计图.html) 与 [Excalidraw 源](../design/diagrams/八阶段并行生产设计图.excalidraw)；后续决策：D-033、D-038。

---

## D-033 ｜ K7 ｜ 图像生成通道反转为 MiniMax H3 Image

- **日期**：2026-11-14。
- **卡口**：K7（反转既有“图像仅 qwen-image”红线）。
- **触发背景**：用户要求将 `resources/_ref_官方模板` 工作流方案完全改为 MiniMax H3。现行原则、根设计与 D-032 引用的图像通道仍为 Qwen-Image，且生产只有 Qwen 文生图链，需先裁决通道冲突与停用边界。
- **用户拍板**：**“方案与生产一起改”**；H3 无法等价覆盖的 Qwen 图像 ControlNet、分层、透明底、多角度等专有能力**“全部停用并归档”**。
- **决策**：现行图像生成通道固定为 **MiniMax H3 Image**，参考方案与现有文生图生产链同步迁移。Qwen-Image 及其专用编辑、控制、分层、多角度、透明底能力退出主用、备选、成本档、组合链与故障回退；原始官方模板、历史资产和生成元数据保留作证据，不作现行能力。
- **理由**：统一图像与视频的 MiniMax H3 工作流方案，同时明确不可用能力不得沿用旧模型兜底；生产只替换已经存在的文生图链，避免把参考模板存在误写为编辑、视频或音乐生产已接入。
- **不变边界**：视频仅 MiniMax H3，音乐仅独立 MiniMax Music3；本地 / 局域网 ComfyUI、多实例、媒体零公网、无媒体云端 Key、renderer 不直连与统一主进程 / MCP 引擎保持不变。H3 官方工作流指定文本编码器是模型组件，不重新开放 Qwen-Image 生成通道。
- **终局状态**（2026-11-15 更新）：H3 Image 通道决策仍现行；仅取代此前决策中的“图像仅 qwen-image”及其 Qwen 专用能力路由，生产唯一文生图链、Qwen 旧 ID 禁止新提交及真实 LAN 验收结论不变。本决策“原始官方模板保留”仅在 `resources/_ref_官方模板/` 范围被 feature-816 C1 用户后续授权部分取代：27 份 Qwen 专用参考 JSON 已删除，H3/Music3 保留件重排后，再按明确清单删除 2 份 P-H3、3 份 FastH3/FastVideo、3 份 Pika H3 UI 参考件；该次清理完成时为 19 份 JSON、10 UI + 9 API、7 用途域，19/19 保留件字节与 SHA256 未变。2026-11-15 用户新增的 `H3/API/api_image_minimax_h3_t2i.json` 已由 C2 原样登记为既有 H3 文生图 UI 参考的 API Format 配套件，当前参考库为 20 份 JSON、10 UI + 10 API、7 用途域；新增件不注册生产 manifest，不改生产 loader/graph，其 FL2VA UNet、视频 VAE 和 Turbo LoRA 不进入生产 H3 Image 链。历史项目资产、生成元数据与 feature-815 风格媒体的保留要求不变。C3 阶段用户进一步明确选择“删除生产归档”，上述 C2 当时的生产归档保留快照仅由该项局部取代：唯一 `resources/comfyui/workflows/_archive/qwen-image-2512-text.json` 已从项目目录删除并由工具移至系统回收站，空 `_archive` 已移除。loader 仍只读 manifest，生产仍仅注册 H3 Image；历史作业/资产、生成元数据、风格媒体和 H3 官方 `qwen3vl` 文本编码器不变，不设置旧 ID 别名或回退。实施与静态验收证据归 [feature-816 任务包](../features/feature-816-H3图像通道迁移/)；既有编年中的 19 份快照不回改，本 C3 不新增项目级编年或决策条目，不回改决策本体和历史执行叙述。

---

## D-034 ｜ K7 ｜ 全面复刻 MiniMax Design、短剧生产闭环优先

- **日期**：2026-11-15。
- **卡口**：K7（修改项目必要性、根设计总体方向与根 AGENTS.md 项目特化原则）。
- **触发背景**：《MiniMax Design 全面复刻开发计划》提出从既有代码库分阶段复刻完整产品面，与根设计和 AGENTS.md 原“只补局域网 ComfyUI、完整生产体系两类缺口 / 部分复刻”的定位冲突；完整专业创作面、在线服务和既有任务包状态不能在旧范围口径下直接扩建。
- **用户拍板**：① 项目目标正式改为“全面复刻、短剧闭环优先”，通过 K7 修订项目必要性与根设计；② 3D、浏览器、代码 / 网页等完整产品面纳入 P5 / P6 路线，但逐包裁决，可不纳入；③ 账号、团队、社区、积分、支付、云同步默认本地替代或经决策不纳入，不伪造在线成功，具体清单在 P0 产出后再确认；④ 后续只有涉及产品取舍或边界变化时再请用户拍板。
- **决策理由**：全面复刻需要统一范围、形态和验收对账，但短剧 0—7 真实生产闭环仍是优先交付目标；完整产品面和在线服务具有不同数据、权限与外部服务边界，不能因总目标一次批准而自动获得实施授权。
- **批准方案**：
  1. 项目必要性升级为“全面复刻 MiniMax Design、短剧生产闭环优先”，保留本地 / 局域网 ComfyUI 与完整八步生产体系两类核心差异，按 P0—P7 交付门推进。
  2. 以《MiniMax Design 功能与架构参考》v1.4 建立首轮 Parity 影响矩阵，逐项标注 [Design 原有] / [改编] / [自研新增]、目标 Feature、当前证据与后续门；范围映射不等于验收通过。
  3. 3D、浏览器、代码 / 网页、外部工具及其他完整产品面只进入候选路线，须逐产品域独立建包并明确“复刻 / 改编 / 不纳入”；禁止建立一个“大复刻包”混装。
  4. 在线账号、团队、社区、积分、支付、云同步等优先评估本地替代；无真实服务时保持未开放或经决策不纳入，具体处理以 P0 待决清单逐项确认为准。
  5. P0 同步校准现有任务包、类型检查、测试、构建与环境基线；历史失败、环境限制和新增失败分别记录，不以静态界面或单次演示冒充完整验收。
- **不变边界**：纯 JSON、八步 0—7、图像仅 H3 Image、视频仅 H3、音乐仅 Music3、全部媒体经本地 / 局域网 ComfyUI、renderer 不直连、系统优先与语音通道待定均不变。文本服务商仍按 D-021 / D-022 固定火山方舟 / LM Studio 二选一，本次只同步过期表述，不新增 Provider。P0 不自动批准 K1 / K8 / K9，不授权修改共享类型或提交 Git。
- **终局状态**（2026-11-19 更新）：现行；取代原 feature-008 D-002 所登记的“部分复刻／只补两类缺口”项目必要性，以及根设计／AGENTS.md 的同名旧定位，不取代其余媒体、依赖、门控和文本服务商决策。原终局状态所写“D-006 的部分复刻”属于指针勘误，经 D-038 校正：恢复至项目台账的 D-006 是 opencode／SDK 版本锁定，与项目范围定位无关，不受本决策取代。规范出处：[AGENTS.md](../../AGENTS.md) §0.1、[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §0.1／§11；范围对账：[MiniMax Design Parity 影响矩阵](../design/MiniMax%20Design%20Parity影响矩阵.md)；历史依据与勘误：D-038。后续细化：D-042 确定 `drama-series` 主 Workflow、自定义文本模型服务配置与无用户管理服务边界，其余全面复刻和逐项裁决原则继续有效。

---

## D-035 ｜ K7 ｜ P1 可信工作台闭环与逐项 Parity 裁决

- **日期**：2026-11-18。
- **卡口**：K7（修订根设计 §11 的 P1 交付门与总体开发计划阶段范围）；本次 K1／K8／K9 零触发，不直接授权具体接口、共享类型或依赖变更。
- **触发背景**：P0／P1 真机调研表明，参考端部分入口无可见效果，自动整理撤回、快捷键、通知与结果定位不能只凭界面推断；项目别名、重复导入副本、版本恢复等行为也需要与本项目统一产物语义和阶段退出门分开裁决。若各 Feature 自行解释，容易形成“形态已复刻、行为不可用”或阶段范围无限扩张。
- **用户拍板**：用户逐项选择“可信工作台闭环”“逐项单独裁决”“轻量统一入口”，并确认自动整理整体快照＋撤销重做、定位＋高亮＋弱化、文本 Diff＋写入前确认、静态完整项目包；随后整体确认按方案执行。
- **决策理由**：P1 应先保证项目、会话、资产、画布、保存恢复、Diff、通知和结果定位形成可信闭环，同时保留后续完整 Parity 的逐包裁决空间；参考端实测行为与本项目目标行为必须逐项记录，不能用统一口号替代产品取舍。
- **批准方案**：
  1. P1 采用“可信工作台闭环”，不扩成 P1 相关功能的全量 Parity。页历史、跨页正式引用、完整快捷键／动画、完整媒体任务中心、项目归档／模板／迁移后置；后置项仍须交付或经决策不纳入。
  2. 参考端差异逐项记录“实测行为、本项目拟采用行为、裁决理由、来源标签、验收证据”，不设一律照抄或一律修正规则。
  3. 手动连线新增／删除纳入 P1。自动整理前保存完整节点坐标与连线快照，整理作为一个组合命令，一次撤销恢复整理前整体布局并可重做；P1 undo/redo 历史不跨应用重启，只持久化当前画布状态。
  4. 聚焦与结果定位须切换正确创作页／画布／视图，保证目标可见、选中并高亮；聚焦时弱化非关联节点。只移动视口或只调暗不满足退出门。
  5. 文本 Diff 支持并排／统一视图；覆盖正式产物前展示基线版本、目标版本与差异，经用户确认后写入，取消确认不覆盖；媒体视觉 Diff 后置。
  6. 静态完整项目包包含项目、创作页／画布、资产、版本和正式会话，排除密钥、运行中执行与临时状态；重复导入默认创建副本。导入会话只读，续聊新建本地会话并记录来源，不伪装原运行时会话无缝恢复。
  7. P1 轻量统一通知覆盖真实本地事件、未读／已读、跨重启保留和结果深链；首批事件为项目导入导出、画布／产物写入结果、Diff 待确认、资产操作和系统异常。P2 在同一入口扩展媒体排队、进度、取消、失败与重试，不伪造未实现的媒体状态。
  8. feature-824 检出的 F824-01／B-71 已由 feature-825 修复并独立复验，P1 切片 A—F 可记为闭环；B-70、feature-817 真实运行时验收、异常终止故障注入及本决策新增退出门仍未关闭，P1 不得宣称通过。
- **实施边界**：本次只更新根设计及 HTML 镜像、总体开发计划、Parity 矩阵、任务导航、决策台账与版本编年；不修改产品代码、测试或真实项目数据，不新增或预占 Feature 编号，不创建“全面复刻”大任务包。后续按具体切片逐包立项并重新检查 K1／K8／K9；D-035 不直接批准 `shared/types.ts`、IPC／preload／MCP、共享画布模块、运行时 schema 或依赖变更。P0／P1 历史证据保持原貌。
- **终局状态**（2026-11-18）：现行；作为 D-034 全面复刻路线下 P1 阶段范围与交付门的补充，不改变八步闭环、媒体通道、本地／局域网 ComfyUI、纯 JSON、项目共享会话及系统优先原则。恢复类细化与后置能力目标由 D-036 补充，不翻案。规范出处：[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §11／§13、[总体开发计划](../design/MiniMax%20Design全面复刻开发计划.md)、[Parity 矩阵 §1.6](../design/MiniMax%20Design%20Parity影响矩阵.md#16-p1-可信工作台需求裁决2026-11-18d-035)；编年入口：[版本记录-2026.md](../../版本记录-2026.md)。

---

## D-036 ｜ K7 ｜ P1 恢复语义与后置项目生命周期裁决

- **日期**：2026-11-18。
- **卡口**：K7（细化根设计 §11 的 P1 恢复退出门，并明确后置项目生命周期能力的目标语义）；本次不直接触发或授权 K1／K8／K9。
- **触发背景**：D-035 将状态恢复纳入可信工作台，并将页历史、跨页正式引用及项目归档／模板／迁移后置，但尚未规定 revision 冲突、异常退出、Agent 中断现场和这些后置能力的统一产品语义。若由实现自行解释，可能出现静默覆盖、自动重跑、代替用户拍板或把浏览历史混同产物版本历史。
- **用户拍板**：用户逐项选择“轻量浏览历史”“产物 ID＋版本”“状态恢复＋人工续跑”“阻止覆盖＋Diff 选择”“可恢复只读归档”“结构＋配置模板”“项目包＋版本预检”“现场恢复＋新运行”，并确认“仅恢复类纳入 P1”，随后整体确认按方案执行。
- **决策理由**：恢复应还原可信现场，而不是替用户继续执行；浏览位置、正式产物版本和项目生命周期属于不同语义。只把恢复类纳入当前 P1 退出门，可补齐可信闭环而不把后置能力暗中扩成当前实施范围。
- **批准方案**：
  1. **revision 冲突**：禁止静默最后写入优先；保留磁盘版与待提交版并展示文本 Diff，由用户选择重载磁盘版、另存副本或显式覆盖，追溯记录对应最终选择。
  2. **异常退出恢复**：恢复最后有效项目、画布和已落盘产物；运行中执行标为“已中断”并保留日志，用户确认后才可重试，不自动重新提交。单文件原子写证据不冒充跨文件事务或完整恢复。
  3. **Agent 现场恢复**：保留消息、OptionCard、Gate 和产物状态；未决 Gate 不代决、未提交选项不代选；重试创建带血缘的新运行记录，不伪装接续原 Token 流。
  4. **页历史（后置）**：应用内轻量前进／后退，只持久化最后位置，不跨重启保留完整浏览栈，不替代产物版本历史。
  5. **跨页正式引用（后置）**：采用“产物 ID＋版本”；源产物再版只挂脏实际引用者，不自动覆盖，不退化为任意节点自由连线。
  6. **归档／模板／迁移（后置）**：归档默认列表隐藏、完整保留、只读且可解除；模板只含结构、配置和说明，实例化生成新项目与新 ID，不带正式会话、运行状态、密钥或项目特定产物；迁移基于静态完整项目包执行 schema 版本、缺失资产和兼容性预检，默认建副本，不静默原地升级。
- **实施边界**：本决策只补产品语义、Parity 映射与阶段退出门，不新增或预占 Feature 编号，不直接批准 `shared/types.ts`、IPC／preload／MCP、运行时 schema、依赖或 UI 实现。既有 feature-827 仅按其包契约承担单文件原子写与真实 SIGKILL 验收，不因本决策自动扩展到 revision 冲突、跨文件事务或 Agent 现场恢复；后续实现须逐 Feature 重新检查 K1／K8／K9。
- **终局状态**（2026-11-18）：现行；作为 D-035 的恢复语义补充，不推翻其可信工作台闭环或逐项 Parity 裁决。规范出处：[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §11／§13、[总体开发计划](../design/MiniMax%20Design全面复刻开发计划.md)、[Parity 矩阵 §1.7](../design/MiniMax%20Design%20Parity影响矩阵.md#17-p1-恢复语义与后置生命周期裁决2026-11-18d-036)；编年入口：[版本记录-2026.md](../../版本记录-2026.md)。本次同步 feature-826 已登记的 96 个测试文件全过、1,276 通过、1 跳过及 B-70 闭环，仅引用既有证据，未重跑产品测试。

---

## D-037 ｜ K7 ｜ 分层上下文与模块—Feature—Change 治理

- **日期**：2026-11-19。
- **卡口**：K7（修改 `AGENTS.md` 默认规则与通用建包／上下文规则）；本次不直接触发或授权 K1／K8／K9。
- **触发背景**：Feature 任务包与文档持续增长，默认通读治理全文、根设计和多份索引使 AI 上下文过重；小缺陷、测试收口与补验也倾向分别建包，同一能力的后续修改难以定位规格。总表同时复制技术细节、测试计数和验收过程，产生重复维护与状态漂移。
- **用户拍板**：用户先确认“按模块定位负责 Feature、普通修改归原包、独立新能力才建包、历史不批量迁移”的方案，随后明确指示“按这个方案开始实施治理规则变更”。
- **决策理由**：文档数量本身不是唯一问题，默认上下文过宽、状态双写和任务包粒度过细才会持续拖慢执行。模块需要稳定导航，但不能变成一个容纳所有修改的巨型 Feature；每次 Change 也不应自动产生一套新规格文件。
- **批准方案**：
  1. **分层上下文**：每次只必读项目 `AGENTS.md` 与治理 §0；随后读取相关模块索引和负责包。根设计、共享类型、其他包与历史记录仅按影响面或触发条件加载，未默认通读的规则仍具约束力。
  2. **三级归属**：模块负责导航与代码归属，Feature 负责一项内聚能力的现行规格，Change 负责一次具体迭代且不新增第六个文件。
  3. **普通修改归原包**：需求／设计修改、纯缺陷修复、测试基线与真机补验优先归原负责 Feature；只有无法归入现有包的独立用户场景、独立产物、独立工作流或独立契约边界才新建 Feature。
  4. **轻索引**：`docs/features/README.md` 只维护模块、当前负责包、状态、路径与代码入口；技术设计、测试计数和验收证据回各包。跨包变更指定主负责包并逐一核对受影响契约，不复制规范。
  5. **历史保持**：不批量改名、重排编号或合并历史包；负责入口调整不自动废止历史约束，只有明确迁移并登记后才退出对应现行入口。
- **实施边界**：修改 `AGENTS.md` v1.8、治理规则 v1.15、Feature 总表、docs／根 README、总体开发计划 v0.14、决策台账与版本编年；不修改产品代码、`shared/types.ts`、IPC／preload／MCP、依赖或真实项目数据，不新增 Feature，不批量迁移历史文档。
- **终局状态**（2026-11-19）：现行。规则落地后，按用户确认的推荐清单完成实体文档深度归并：46 个 Feature 目录与编号原位保留，形成 **24 个现行负责包 + 22 个历史归档包**；归档包的 106 份现存标准文档均有统一归档头，各包变更记录建立逐章节迁移覆盖表，有效需求、契约、设计与开放验收约束已迁入当前负责包。归档不删除、改名或物理合并历史目录，不倒写历史任务、测试计数与 PASS／FAIL。本决策不改变 D-034 全面复刻定位、P0—P7 阶段门或既有产品验收结论；本次纯文档治理不构成任何产品能力、P1、Parity 或真机验收通过声明，具体同步与核验写入同日版本编年。后续决策：D-039（2026-11-20）删除 21 个历史归档目录；D-040（2026-11-20）继续删除 feature-826，22 个历史归档目录均转为仅从 Git 追溯。

---

## D-038 ｜ K7 ｜ 语音通道口径澄清与 D-006—D-010 历史正文恢复

- **日期**：2026-11-19。
- **卡口**：K7（生成通道边界冲突澄清，以及决策登记规则的一次性历史恢复例外）；本次不直接触发或授权 K1／K8／K9。
- **触发背景**：D-032 含有“配音一期仍走 T2A 人机通道”的历史表述，而 D-034、根 AGENTS、根设计与 P0 基线均规定语音通道待定；D-032 的终局状态仍写“其余通道不变”，未关闭冲突。项目台账同时缺少 D-006—D-010 正文，D-034 又将“部分复刻”错误指向 D-006。经 Git 溯源，缺失正文对应原 `feature-008-Agent运行时集成` 的包内决策，其中 D-006 实为 opencode／SDK 版本锁定，“部分复刻”则来自原 feature-008 D-002；归档 D-007 不含 T2A 表述，不纳入本次语音冲突。
- **用户拍板**：用户明确指示“好的，按这个方案修复 D-032 的语音冲突并恢复 D-006 到 D-010 的缺失正文”。
- **决策理由**：语音通道现行产品口径已经明确为待定，不需要借历史修复另选服务商；但必须废止旧 T2A 授权语义，防止后续实现误用。历史正文应从可信来源原样恢复并标明原归属，不能根据摘要重造，也不能借恢复改变现行“Feature 决策不双写”的常规边界。
- **批准方案**：
  1. **语音唯一现行口径**：语音通道待定。D-032 的“配音一期仍走 T2A 人机通道”只保留为历史决策原文，不再构成选型、接入或出公网授权；后续正式 K7 裁决前不得绑定豆包／T2A、配置语音云端 Key 或伪造配音闭环。D-032 的八阶段并行、验收、无对白镜头不挂音色参考等其他语义不变。
  2. **一次性历史恢复例外**：仅从 Git 提交 `ef4a17539938371d852db4d8eb38b0dc6f6de18b` 的 `docs/archive/features-pre-rebuild/feature-008-Agent运行时集成/SDG-AI-变更记录.md` 原样恢复 D-006—D-010 决策正文至本项目 2026 分卷，保留原编号、日期、卡口与原归属说明；仅将标题规范为项目分卷格式并分别追加终局状态，不改写冻结正文。五条原决策正文已与该来源逐字比对一致。该例外不撤销治理 §7.1 的“Feature 内部决策不双写”规则，不形成后续双重维护，也不把这些历史条目包装成新的产品裁决。
  3. **指针勘误**：D-034 所取代的“部分复刻／只补两类缺口”定位改指原 feature-008 D-002 及根设计／AGENTS 旧口径；恢复后的项目台账 D-006 仅为 opencode／SDK 版本锁定，继续现行，不被 D-034 取代。
  4. **同步闭环**：主索引恢复 D-006—D-010 并登记 D-038，更新连续编号、分卷计数、D-032／D-034 终局状态与 P0 开放项；同日版本编年登记来源、实施范围和核验结果。历史编年及 P0 原基线结果不回改，只追加后续闭环状态。
- **实施边界**：本次只修改决策台账主索引与 2026 分卷、P0 基线报告的后续闭环状态及版本编年；不修改产品代码、共享类型、接口、依赖、根设计或 AGENTS，不新增 Feature，不安装或接入语音服务，不提交 Git。
- **终局状态**（2026-11-19）：现行；语音通道继续待定，D-032 的 T2A 历史授权语义废止。D-006—D-010 已按上述唯一来源恢复，五条原决策正文逐字比对一致并分别标注现行效力，D-034 范围指针已勘正。规范出处：[AGENTS.md](../../AGENTS.md) §0.1、[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §0.1；基线闭环：[P0基线报告.md](../verification/p0-2026-11-15/P0基线报告.md)；编年入口：[版本记录-2026.md](../../版本记录-2026.md)。

---

## D-039 ｜ K7 ｜ 历史归档包清理与 Git 追溯边界

- **日期**：2026-11-20。
- **卡口**：K7（调整 D-037 的历史归档目录保留规则与项目文档结构）；本次不直接触发或授权 K1／K8／K9。
- **触发背景**：D-037 实施后为追溯历史血缘保留了 22 个归档目录，但现行负责包已自包含承接有效需求、契约、设计与开放验收约束，多数归档目录不再承担现行导航或实施入口职责。用户要求删除无用 Feature，并在破坏性范围确认中明确选择“保留 826，删除其余 21 个”。
- **用户拍板**：删除 `002 / 003 / 007 / 008 / 009 / 010 / 011 / 012 / 015 / 804 / 807 / 809 / 810 / 811 / 812 / 814 / 815 / 818 / 819 / 824 / 825` 共 21 个历史归档目录；保留 `feature-826-谱系测试基线收口` 及全部 24 个现行负责包。删除对象仅为历史文档副本，不删除、停用或重新裁决对应产品能力。
- **决策理由**：现行职责与验收边界已在负责包内自包含，继续保留重复归档副本增加导航和维护成本；被删目录的原始规格、决策、任务状态、测试计数及 PASS／FAIL 仍可由 Git 历史完整追溯，无需在工作树保留空壳或重写冻结历史。
- **批准方案**：
  1. **精确删除**：以 HEAD `65412b1ef138525d9998852183e29d93b292b379` 为删除基线，删除上述 21 个目录中的 101 份 tracked 标准文档并移除空目录；不得误删 feature-826、24 个现行负责包或任何真实项目数据。
  2. **Git 单点追溯**：被删目录此后只从 Git 历史读取，不重建归档说明、占位目录或第二份副本；历史决策、编年叙述与当时数量保持原样，不倒写为当前事实。保留文档中的失效相对链接改为纯文本历史编号或现行负责包链接。
  3. **现行口径**：`docs/features/` 收敛为 **25 个目录＝24 个现行负责包＋1 个历史归档包（826）**；历史来源编号继续作为血缘保留，归档包不承接新 Change。
  4. **同步闭环**：更新 Feature 索引、根设计、总体开发计划、Parity 矩阵、docs 导航、四份既有 B 类 HTML、决策台账与版本编年；两处源码注释的事实源路径分别由 807→801、810→802，仅修文档引用，不改运行逻辑。
- **实施边界**：不修改 `shared/types.ts`、IPC／preload／MCP、依赖、产品运行逻辑、测试逻辑或真实项目数据，不新增、改名或合并 Feature，不提交 Git。本次不构成任何产品能力、P1、Parity 或真机验收通过声明。
- **终局状态**（2026-11-20，D-040 更新）：**部分取代，其余已执行**。D-039 删除 21 个历史归档目录及其 Git 追溯边界继续有效；“保留 feature-826”由 D-040 取代，826 随后亦删除。历史决策本体、原执行记录、测试数字及验收结论保持原样；后续事实见 D-040。

---

## D-040 ｜ K7 ｜ 删除 feature-826 与历史归档目录全量 Git 化

- **日期**：2026-11-20
- **卡口**：K7（用户明确反转 D-039 的“保留 826”口径，调整历史文档保留边界并同步现行事实源与 B 类镜像）。
- **触发背景**：D-039 已删除 21 个历史归档目录、仅保留 feature-826-谱系测试基线收口。用户随后明确指示“删除 826 并清理相关文档”。826 的谱系业务现行职责已归 feature-802，通用测试门禁与测试数据原则已归 feature-830，保留该目录不再承担现行实施入口职责。
- **用户决策**（2026-11-20 拍板）：
  1. 删除 `docs/features/feature-826-谱系测试基线收口/` 整个历史目录及其 5 份标准文档；
  2. `docs/features/` 收敛为 **24 个目录，全部为现行负责包，不再保留历史归档目录**；D-039 删除的 21 个目录与本次删除的 826，共 22 个历史目录只从 Git 历史追溯；
  3. 清理现行索引、设计、总体规划、Parity、文档导航和既有 B 类镜像中的“保留 826”及“24＋1 / 25 目录”口径；失效相对链接改为纯文本历史编号或现行负责包链接；
  4. 不删除或停用谱系、测试门禁等产品能力，不改产品代码、共享类型、IPC / preload / MCP、依赖或测试逻辑；历史测试数字、PASS／FAIL、任务状态与验收结论不倒写。
- **落地内容**：
  - 删除 826 的 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`、`SDG-RE-任务清单.md`、`SDG-OD-设计说明.md`、`SDG-AI-变更记录.md`；原始文档只从 Git 历史读取，不建立占位目录或副本。
  - 谱系版本、changelog、采纳与升级语义继续由 [feature-802](../features/feature-802-视觉风格谱系接入/) 负责；复现、定向＋全量＋typecheck、真实统计和测试数据分流继续由 [feature-830](../features/feature-830-测试与验收数据落点统一/) 负责。
  - 同步 Feature 索引、根设计、总体规划、Parity、docs 导航、四份既有 B 类 HTML 与项目编年；D-039 仅更新终局状态，原批准方案和执行叙述冻结。
- **追溯与边界**：826 删除基线为执行时 HEAD `c45c6f0d356c31350a37000abe7c047d97fb1821`。删除历史文档不代表重跑或通过任何产品测试，不构成 P1、Parity、八步闭环或真机验收通过；P0 已完成、P1 未通过，feature-829 继续实施中。
- **终局状态**（2026-11-20）：**现行，已执行**。826 的 5 份 tracked 标准文档及空目录已删除；磁盘精确为 24 个现行负责目录、0 个历史归档目录，22 个历史目录仅从 Git 追溯。变更文档 61 个本地相对链接检查无断链，D-001—D-040 连续且两处计数均为 40，2026 编年正文与总索引均为 104 条，`git diff --check` 通过；恰好删除 5 份 tracked 文档且全部为文档变更，未提交 Git。

---

## D-042 ｜ K7 ｜ drama-series 主 Workflow 与四类复刻差异边界

- **日期**：2026-11-26。
- **卡口**：K7（确定首要业务 Workflow、八步映射、自定义模型服务与无用户管理服务的项目级边界）；本次不直接触发或授权 K1／K8／K9。
- **触发背景**：D-041 已确定“4.0.18 对外行为验收、v2 内部编排骨架、选择性吸收 v3 Resource／Version”，但尚未指定首要业务 Workflow；账号、团队等在线产品面仍有待决表述。需要避免把 v2 通用骨架等同于业务 Workflow，或把全面复刻解释为九个 Workflow 与用户管理服务均须无差别建设。
- **用户拍板**：用户明确本项目与 MiniMax Design 的主要偏差为：① 主要实现 `drama-series` 连续剧 Workflow；② 尽量沿用该 Workflow 实现八步闭环；③ 文本 AI 使用自定义模型服务，图片、视频、音乐使用局域网 ComfyUI；④ 没有用户管理服务。其他不违反上述原则的能力尽量复刻；不了解 MiniMax Design 时才做真机调研。
- **批准方案**：
  1. **主 Workflow**：以 `drama-series` 为首要业务 Workflow 和短剧复刻主线，优先吸收其单 Stage／全系列范围、分集分镜、角色一致性、锁项、双确认、稳定 Work Item、依赖、局部重试、Replan 与恢复方法。v2 的 Plan／Stage／Work Item 仅作内部通用编排骨架，不取代 `drama-series` 的业务流程；其他 Workflow 仅在不冲突时参考或另行逐包裁决，不要求九个 Workflow 无差别并行复刻。
  2. **八步映射**：尽量沿用 `drama-series` 的阶段、审核与生产语义实现 STAGE 0—7。八步产物与 Gate 不合并、不裁剪；参考端缺少的立项与发布由本平台显式补齐，不以通用六阶段或参考端阶段数裁剪业务闭环。
  3. **模型服务**：文本 AI 使用用户自定义的模型服务配置，不依赖 MiniMax 账号或其云端文本服务；现有落地 Provider 仍为火山方舟／LM Studio（D-021／D-022），本条不自动授权新增或替换 Provider。图像、视频、音乐继续全部经本地／局域网 ComfyUI，固定 H3 Image／H3／Music3 与媒体零公网边界不变。
  4. **无用户管理服务**：不建设账号、登录、用户、团队、成员或角色权限管理服务，也不以本地资料页变相复制账号体系。单用户本地设置、项目与资产数据、导入导出属于本地应用能力，不属于用户管理服务。社区投稿、积分、支付等既有待定项不因此被自动批准，仍须独立裁决。
  5. **复刻与调研纪律**：除上述差异及既有红线外，其余 MiniMax Design 能力尽量复刻并逐 Feature 对账。已有版本、目录、静态证据和真机结论足够时直接复用；只有证据缺失、版本／行为变化或实现前必须关闭未知项时才真机调研，不重复扫描，不把静态配置冒称运行时事实。
- **证据边界**：`drama-series` 的现有结论来自 4.0.18 静态配置，具体运行时路由与实际行为仍未全部验证；后续实现需要这些未知行为时再按本条补真机调研。本次没有新增真机调研，不改写既有实测记录。
- **文档落地**：根设计升 v1.31，AGENTS 升 v1.9；总体计划、Parity 矩阵、研究报告及各自人读镜像同步。账号／用户管理由待决改为不纳入，其他在线服务不自动放行。
- **实施边界**：本决策细化 D-034／D-041，不推翻 v2 内部编排骨架、v3 Resource／Version 选型、现有技术底座或四个 Agent profile；不授权产品代码、共享类型、接口、依赖或 Agent profile 变更，不新增 Feature，不改变 P0 已完成、P1 未通过及其余阶段状态。
- **终局状态**（2026-11-26）：**现行，已完成原则与设计登记，尚未据此实施**。本次不构成任何 Workflow、八步闭环、Parity 或真机验收通过声明。规范出处：[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §0.1／§2.2／§13；路线与对账见总体开发计划和 Parity 矩阵；编年入口：[版本记录-2026.md](../../版本记录-2026.md)。

---

## D-041 ｜ K7 ｜ MiniMax 4.0.18 复刻基线与 v2 编排＋v3 资源版本选型

- **日期**：2026-11-26。
- **卡口**：K7（确定全面复刻的当前参考版本、内部生产编排骨架与资源版本语义，修订根设计核心架构）；本次不直接触发或授权 K1／K8／K9。
- **触发背景**：MiniMax Design 当前安装版同时保留 v2、v3 profile 静态配置，两者在 Agent 角色、Workflow 编排和对象模型上差异明显。若把目录并存误作运行时双栈，或全量照搬其中一套，将冲击现有 Electron／OpenCode／MCP 底座、八步闭环、纯 JSON、局域网 ComfyUI 与系统优先边界。既有研究还混用了“历史 GitHub 9 个官方 Skill”“v2 的 9 个 Workflow”和“特定连接器目录 2 个 Skill”，需要固定证据口径，避免后续 AI 重复调研或误验收。
- **用户拍板**：用户认可“当前安装版管对外验收、v2 管内部生产编排、选择性吸收 v3 Resource／Version、保留现有底座”的方案，并明确指示“把具体内容写到设计里，后面安排改造开发，相关调研结果也记录到相关文档中，下次AI就不需要再调研了，如果没有变化”。
- **证据边界**：本轮静态实证来自 macOS MiniMax Design **4.0.18（Build 4.0.18.174）**。v2 base profile 为 0.4.91，含 1 个主 Agent、8 个专用 Agent 与 9 个 Workflow；v3 base profile 为 0.4.108，含 3 个 Agent，并提供 Composition／Resource／Version 对象语义；`bundled-connector-skills/clip-studio/` 实测 2 个 Skill。v2／v3 目录并存不证明运行时同时启用，2 个连接器 Skill 不代表运行时总 Skill 数；profile 选择、完整 Skill 加载、真实 Workflow 路由、生成、账号与导出行为仍未由本轮静态取证关闭。4.0.10 等历史运行时证据继续保留，但不外推为 4.0.18 验收通过。
- **批准方案**：
  1. **双层基线**：对外产品 Parity 以当前安装版 **4.0.18 的当前实际产品行为**为验收基线，静态配置只支持架构选型，不替代运行时验收；对内生产编排以 **v2 为骨架**，若必须二选一即选 v2。对象层只选择性吸收 v3 的 **Resource 稳定身份＋Version 不可变快照**，不全量替换为 Composition，不并存两套运行时。
  2. **保留现有底座**：继续使用 Electron＋React、OpenCode HTTP／SSE、主进程 MCP Streamable HTTP、纯 JSON、局域网 ComfyUI 和现有 4 个 Agent profile。根设计的 7 个角色仍是逻辑职责，不构成按 v2 的 9 Agent 或 v3 的 3 Agent 自动扩编／缩编授权；文本服务商、固定媒体模型及媒体零公网红线不变。
  3. **目标执行结构**：采用 `Workflow Definition → Plan → Stage → Work Item → Run / Attempt`，资源采用 `Resource → Version`。showrunner 只能提出／修订 Plan 草案；主进程确定性服务负责结构校验、DAG、依赖就绪、状态迁移、预期状态与 revision CAS、Gate、重试、版本写入、恢复和精准挂脏。Agent 工具调用只是命令请求，不得跳门、修改锁项、绕过依赖或直接写正式版本。
  4. **八步显式映射**：v2 的 `Script → Art Direction → Storyboard → Shots → Assemble → Export` 仅作参考，必须映射到完整 STAGE 0—7，不得合并或裁剪。D-031／D-032 的产物 DAG、双轨门控和阶段验收，D-035／D-036 的可信工作台与恢复语义，以及 D-016 系统优先继续有效。
  5. **重试、重规划与恢复**：Replan 必须产生新的 Plan 修订并经用户确认；稳定 Work Item 支持局部重试，最多三次实质不同尝试。中断运行标为 `interrupted`，保留现场与日志，人工确认后创建有血缘的新 Attempt，不伪装接续旧 Token 流。
  6. **能力边界**：Workflow 管确定性编排，Skill 管可复用方法，二者不得混同。当前程序没有通用 Workflow／Plan／Stage／Work Item 执行层，也没有 Skill 执行器，侧栏 Skill 卡片仍为静态示例。Skill／Agent 方法扩展由 P5 规划中的 feature-805 作为候选负责包，实际建包与授权另行完成；Code Project 仅列为 P6 候选，须独立裁决，不自动纳入短剧主线。
- **改造顺序**：P1 只做规格准备且不增加退出门；通用底座在 P2 媒体入口之上、P3 业务贯通验收前建设；P3／P4 由各业务负责包逐步接入八步；P5 扩 Skill／Agent 方法；P6 再独立裁决 Code Project。具体负责与协同包、依赖和验收边界以[总体开发计划 §4.1](../design/MiniMax%20Design全面复刻开发计划.md#41-d-041-编排与资源版本改造主线规划未授权实施)为准，不建立“巨型复刻包”。
- **研究复用规则**：事实集中记录在[MiniMax Design 功能与架构参考 v1.6 §2.7](../design/MiniMax%20Design功能与架构参考.md#27-macos-4018-agent-profiles-与连接器-skill-只读补测2026-11-26)。应用版本／Build、目录或 profile 版本无变化且不与实际行为冲突时，后续 AI 直接引用，不重复静态调研；只有上述内容变化、实际行为冲突或需要关闭已登记未知项时才重测，并记录新证据边界。
- **非目标**：不引入 SQLite，不照搬参考端账号／团队／社区／积分／支付／云同步，不开放其他图像／视频／音乐模型，不改变火山方舟／LM Studio 文本双服务商，不让 Workflow、Skill、插件或 Plan 成为越权通道，不伪造在线成功、恢复成功或 Parity 通过。
- **文档落地**：[根设计](../../短剧Agent平台设计.md) 升 v1.29 并新增 §2.2，同步[人读镜像](../design/短剧Agent平台设计.html)；[研究报告](../design/MiniMax%20Design功能与架构参考.md) 升 v1.6；原人读镜像已整理为[MiniMax Design 总览](../design/MiniMax%20Design总览.html)；[总体开发计划](../design/MiniMax%20Design全面复刻开发计划.md) 升 v0.17 并新增 §4.1；[Parity 矩阵](../design/MiniMax%20Design%20Parity影响矩阵.md) 升 v2.5；同步决策索引与版本编年。
- **实施边界**：本次只完成研究、设计、路线、对账与治理文档，不修改产品代码、测试、`shared/types.ts`、IPC／preload／MCP、运行时 schema、依赖、Agent profile 或真实项目数据，不新增 Feature，不提交 Git。目标能力族不直接批准物理工具、共享字段、接口或依赖；后续实施须先定位负责 Feature、修订契约与任务清单，并分别检查 K1／K8／K9。
- **终局状态**（2026-11-26）：**现行，已完成设计与路线登记，尚未实施**。P0 已完成、P1 未通过，P2—P7 既有状态不变；本次不构成任何产品能力、八步闭环、Parity 或真机验收通过声明。规范出处：[短剧Agent平台设计.md](../../短剧Agent平台设计.md) §2.2／§11／§13；路线与对账见上述总体开发计划和 Parity 矩阵；编年入口：[版本记录-2026.md](../../版本记录-2026.md)。后续细化：D-042 明确 `drama-series` 为首要业务 Workflow，v2 继续只承担内部通用编排骨架。
