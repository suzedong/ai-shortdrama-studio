# SDG-AI 决策台账（项目级 · 永久保留）

> 本台账记录**不属于任何 Feature 任务包**的项目级 K 卡口决策（治理规则、架构总纲等）。Feature 内的 K 卡口决策仍记入各任务包的 `SDG-AI-变更记录.md`。
>
> 规则：决策条目持续登记；**现状型内容只留最新状态**——决策被后续决策取代时，过时条目可直接删除或改写为终局口径，不保留反转注记（2026-10-14 起；取代原"只增不删、反转时加标记块"的规则）。

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

## D-004 ｜ K8 ｜ 裁决门语义修订：rejected 门可同 gateId 重开（019 §2.4 取代 018 §5.1 相应部分）

- **日期**：2026-10-07
- **卡口**：K8（跨任务包契约语义冲突；修改 GateBridge 门生命周期行为）
- **触发背景**：feature-019 C9 真机验收时发现两份已批准契约对"rejected 后如何重试"规定互相矛盾：
  - feature-018 契约 §5.1 第 4 条：门一旦 `approved/rejected` 即终态，同 gateId 再请求 → `INVALID_ARGUMENT`；
  - feature-019 契约 §2.4：rejected 后须重做产物并以**同一 gateId** 再次请求，禁止新增门编号。
  真机上 showrunner 按 018 的工具行为重试 0-b 被拒，为不丢确认点改用后缀门 0-a2 / 0-b2（确认点未减少，但 gateId 改变）。同时查明：编排测试用脚本化 fake（假设可同 id 重试）故未暴露，真实 GateBridge 未实现 019 §2.4。
- **用户决策**（2026-10-07 拍板）：
  1. **rejected 不是终态**：允许以同一 gateId 重开，门状态回退 `pending`、用本次请求内容覆盖旧 question/options/payload，门记录仍只一条、不新增编号；
  2. **approved 保持终态**：同 gateId 再请求仍 → `INVALID_ARGUMENT`；
  3. 0-d 预检是否允许只读实例/资产探测（comfyui.instances / asset.list）的议题本次**暂不裁决、挂起**；维持 §1.2 整个命名空间禁令（真机中模型的尝试已被 client/provider 白名单拦截，未实际执行）。
- **落地内容**：
  - [bridge.ts](../../electron/gate/bridge.ts) `initializeEntry`：仅 `approved` 拒绝重开；`rejected` 走同 gateId 重开分支；
  - [gate-bridge.test.ts](../../src/test/gate-bridge.test.ts)：新增 rejected 同 id 重开 → pending → 再裁决 → approved 后锁定的真实用例（8 项全绿）；
  - feature-018 契约 §5.1 加修订标注，标明 rejected 部分被 019 §2.4 取代。
- **波及文件**：
  - feature-018：[SDG-RE-契约.md](../features/feature-018-摄制组profiles与主控链路/SDG-RE-契约.md) §5.1（修订标注，不改 frontmatter/物理工具映射）
  - feature-019：[SDG-RE-契约.md](../features/feature-019-立项切片/SDG-RE-契约.md) §2.4（语义不变，现由工具层真正实现）
    - > 📌 **路径注记（2026-10-09，D-005 后）**：上述两个 feature 包已于 2026-10-08 整体移入归档区，现行路径为 [../archive/features-pre-rebuild/feature-018-摄制组profiles与主控链路/SDG-RE-契约.md](../archive/features-pre-rebuild/feature-018-摄制组profiles与主控链路/SDG-RE-契约.md) 与 [../archive/features-pre-rebuild/feature-019-立项切片/SDG-RE-契约.md](../archive/features-pre-rebuild/feature-019-立项切片/SDG-RE-契约.md)；原 `docs/features/` 路径失效，内容随包冻结。
    - > 📌 **路径注记（2026-10-10）**：归档区 `docs/archive/features-pre-rebuild/` 已按用户拍板删除（"已有最新整体的设计，旧的可删除"）；上述两包历史内容见 git 提交 `ef4a175`（init），上述归档路径不再有效。
  - 代码：`electron/gate/bridge.ts`；测试：`src/test/gate-bridge.test.ts`
- **遗留项（2026-10-27 裁决关闭）**：只读探测开口子议题——用户裁决**维持 §1.2 命名空间禁令**，放行与否随 [feature-803-ComfyUI统一媒体引擎](../features/README.md)（⬜ 未建包）建包时一并评估；新立项体系（D-005 后）已无 0-d 预检门，本挂起态终结。

---

## D-005 ｜ K8 ｜ 立项模型重建 + 旧 22 个 feature 整体作废归档 + 视觉风格谱系定位为系统级外部数据源

- **日期**：2026-10-08
- **卡口**：K8（事实源与存量任务包体系性冲突；重建立项业务模型与文档结构）
- **触发背景**：以《2002 相识》（「我想做一个我和我老婆认识的故事，发生在 2002 年」）为真实案例，用「用户说一步、AI 分析后续」的对话推演复核立项流程，确认旧任务包基于错误假设：
  - 旧设计为「**4 节点**（创意输入→选题诊断→立项单→故事背景档案）+ **4 确认门**（0-a~0-d）+ 立项单多 tab」，实际立项是一段对话收敛，不是逐产物审批的表单流；
  - 视觉风格谱系的「主 / 备」（验证状态轴）与「主风格 / 辅助风格」（使用角色轴）被旧文档压成两条，产生自相矛盾（如把「备」定义成闪回辅助画风、又规定辅助仅 B/D）。
  - 旧 feature-001~022 均建立在该模型之上，22 包整体不可用。
- **用户决策**（2026-10-08 拍板）：
  1. **旧 22 个 feature 任务包整体作废**，移入 `docs/archive/features-pre-rebuild/` 冻结保留追溯；新任务包从 **feature-001 重新编号**，从头来；
  2. **立项新模型**：1 个入口动作（一句话创意）+ **2 节点**（① 选题诊断，含六要素口径草案；② 故事前提，即故事背景档案的对话式形成）+ **1 道定案门**（就绪条件客观判定：六要素有值＋故事前提达最低门槛＋有 1 主风格 → Agent 发立项定案卡；一键拍板或口头拍板等价，记录用户原话与立项单版本）；
  3. **反问机制 / 已捕获口径**：创意后 Agent 先反问关键分叉（商业短剧 / 个人纪念）；能提取的事实不等回答先记录；「已捕获口径」区从第一句话起持续可见、随时可改；
  4. **故事前提最低门槛（暂定）**：人物（主角身份/年龄）、时间、地点、核心事件（相遇方式一句话）、边界（本季讲到哪）；开发中不够再议；
  5. **视觉风格选型**：主风格全片唯一（家族+具体风格，候选含谱系全部「主」「备」条目，选备风险自担）；辅助风格按剧情需要挂 0–1 个「气氛」，**候选域封闭 = B 青春治愈系（1 项）+ D 类型氛围系（5 项）**；谱系只管画风，年代等事实进入提示词内容、不决定画风 ID；
  6. **谱系定位**：视觉风格谱系是**系统级外部数据库**，与 ComfyUI 接入同级——路径注册、版本跟踪、可查阅可维护、平台只消费不私改；项目引用记录「风格 ID + 谱系版本」（如 `A7 @ v1.46`，谱系经本次措辞修订由 v1.45 升至 v1.46）；
  7. **立项后变更**走变更 + 下游同步（反补机制）；改主风格 → 全链路提示词重出；
  8. Dufs 仓库外两份文档（视觉风格谱系、制作流程规范）一并修正；docs/design/ 下 B 类文档同步重渲染（原型保持不动）。
- **落地内容**：
  - 归档：[features-pre-rebuild/](../../archive/features-pre-rebuild/)（feature-001~022）+ [archive/README.md](../../archive/README.md) 作废声明；
  - [短剧Agent平台设计.md](../../短剧Agent平台设计.md)：§2.6 整体重写（2.6.1~2.6.7）、新增 §8.3、§0.1 八步表立项行与现状说明更新、§7.1 重新定性为「现存代码数据血缘（待反向补录重建）」、§13 加 v1.9 记录；
  > ⚠️ **现状注记（2026-10-09）**：§7.1 已于设计 v1.11（D-012）改写为「数据血缘、状态机与版本归档（最终设计）」——brief.json 由立项单.vN.json 取代，"待反向补录重建"框架删除。本条为 D-005（v1.9）当时的落地描述，保留历史。
  > ⚠️ **现状注记（2026-10-10）**：归档区 `docs/archive/features-pre-rebuild/`（feature-001~022）已按用户拍板删除（"已有最新整体的设计，旧的可删除"），历史见 git 提交 `ef4a175`；本条目及 D-004 路径注记中的归档路径不再有效，设计基线以 v1.11 为准。
  - Dufs：`AI短剧制作视觉风格谱系.html`（修正「备」定义与辅助候选域）、`AI短剧制作流程规范.html` J.3（修正「形态内」措辞，补辅助仅 B/D）；
  - B 类文档重渲染：平台全景图 / 架构模块关系图 / 进度看板与路线图 / 设计镜像。
- **波及文件**：见上「落地内容」；代码本次未删未改。
- **后续约束**：
  - 现存代码（含按旧模型实现的立项门、style-catalog 固化谱系等）按《AI-SDG-AI工具执行指令》§7 存量功能反向补录六步法，对照新设计从 feature-001 起重新建包，No Spec No Code；
  - 谱系升级走源文件维护 + 版本号 + 项目记录引用版本，不得把条目私改进代码。
- **编号说明**：旧 feature-008（已归档）内部曾有包级编号 D-005/D-010，仅存于历史文档；本条 D-005 为治理台账全局编号，自本条起台账与旧包级编号不再共用序列。

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
  - 原型 [短剧Agent平台-原型.html](../design/短剧Agent平台-原型.html)：当前已具备 titlebar STAGE 进度轨（来自前次借鉴落地）；v1.10 待办——STAGE 0 步骤 hover tooltip 接入版本号显示（`立项 vN · X 产物已对齐 · Y 待处理`）；不在本次落地范围内，列入后续原型迭代。
  - v1.9 主体（1 入口 + 2 节点 + 1 定案门）保持不变；本次仅升级"立项后"行为；其他八步阶段不受波及。
- **波及文件**：见上「落地内容」；代码本次未删未改（与 D-005 同模式——文档先行，代码按反向补录六步法重建）。
- **后续约束**：
  - `立项/立项单.vN.json` 必须全量保留 v1..vN，不覆盖；`立项/影响清单.vN→v(N+1).json` 与`project.manifest.json.briefVersion` 字段在 feature-005/006 任务包中落实。
  - 反向补录阶段如发现旧代码含 premise 锁定逻辑，按本决策反转。
  - feature-003（画布节点 / 状态机）需在 `CanvasNode.parentReference` 与 `CanvasNode.dirty` 字段落地本规则。
- **编号说明**：本条 D-011 为治理台账全局编号；与 D-005 同源（均修改 §2.6），不共用编号但同属 K8 立项模型族。
- **落地注记（2026-10-14，feature-002）**：本条经 [feature-002](../features/feature-002-立项后变更与影响评估/) 全部落地（偏差 B-03 关闭）：K1 三字段（`ProjectManifest.briefVersion`、`CanvasNode.parentReference/dirty`）+ K8 三工具（`brief.impact.assess/commit`、`canvas.align`，全仓 22 工具）+ showrunner 再版六步剧本 + renderer 脏读黄条/角标/`vN ⚠k` 徽标；三选一走对话（D-005），不做弹窗。两处形态差异经包级 D-002/D-003 拍板记名、设计书不回改：①血缘挂 `CanvasNode.parentReference`（非设计书所写 manifest.nodes，B-09 后 manifest 无 nodes）；②影响清单落项目根 `影响清单.vN-vM.json`（非 `立项/` 前缀，`→` 换 ASCII `-`）。原后续约束中的 feature-003/005/006 编号已被 D-013 路线图重编（801/002）取代。

---

## D-012 ｜ K8 ｜ 对话通道定稿：runtime 单轨为终态，旧 IPC 快照并入设计后删除

- **日期**：2026-10-09
- **卡口**：K8（修改设计文档核心章节 §5 / §7.1，对话与生成通道规则定稿）
- **触发背景**：feature-010 存量快照（docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md）记录了旧 8 个 `agent:*` IPC + `app:ark-status` 的逐 handler 行为与迁移决策表；迁移已执行完成（归档 AC-9 ✅：旧 IPC / preload 方法 / global.d.ts 类型全删、对话链路零引用）。用户问"这个还有用吗"，随即拍板"**不会回退了，有用的放以设计里，所有设计要最后状态，如果有不确定的设计，可以讨论**"——旧链路不回退、快照有用内容并入设计、设计文档定稿为最终状态。
- **用户决策**（2026-10-09 拍板，三项）：
  1. **旧对话链路不回退**：对话 / 生成通道以磁盘实况为终态——**Agent 运行时单轨（runtime:\*）+ 11 个纯 MCP 工具（canvas / file / asset / comfyui / gate）**；不重建旧 8 个 `agent:*` IPC 与 `shortdrama_*` 生成工具；快照文件删除。
  2. **快照处置**：有用内容（runtime 通道机制、上下文依赖原则、错误码语义）并入设计文档 §5.1 / §7.1 后，`docs/SDG-OD-legacy/feature-010-ark对话IPC快照.md` 删除。
  3. **§7.1 定稿**：按新模型整体改写为最终数据模型描述，删除"旧代码现状 / 待反向补录 / 不代表目标设计"框架。
- **落地内容**（设计 v1.11 一次性同步）：
  - [短剧Agent平台设计.md](../../短剧Agent平台设计.md)：
    - §5 改写为「**MCP 工具层与对话生成网关**」——新增 §5.1 对话生成网关（runtime 单轨通道表；诊断 / 大纲 / 小传 / 分场 / 台词 / 分镜 / 改写等生成动作由会话内 Agent 规划完成；统一 runtime 错误码 14 个，旧 `STORY_CTX_MISSING` / `REVISE_*` / `STYLE_NOT_IN_CATALOG` 退役；无 Key 显式报 `UPSTREAM_AUTH_MISSING`，不 mock 降级）；§5.2 工具族按磁盘实况定稿（已落地 11 个纯工具 + 目标族 project / media / engine / 资产扩展 / edit / harness / skill）
    - §7.1「现存代码数据血缘（待反向补录重建）」改写为「**数据血缘、状态机与版本归档（最终设计）**」——brief.json 由立项单.vN.json 取代；谱系小节并入 §8.3 口径；补 §2.6.6 / §2.6.7 影响评估字段落点（manifest.briefVersion + parentReference + 影响清单）
    - §8.3 注记改中性事实（去"过渡实现 / 后续重建"措辞）；§13 加 v1.11 记录
  - B 类同步：镜像 [短剧Agent平台设计.html](../design/短剧Agent平台设计.html)（§5 / §7.1 / 版本记录 v1.11）；[平台全景图.html](../design/平台全景图.html) 05 问题区块快照链接改指「设计 §5.1 对话网关（终态）」；[三阶段数据血缘.svg](../design/images/三阶段数据血缘.svg) 清理"旧 / 待反补 / D-005"过渡标注。
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
- **触发背景**：D-005 旧 22 包作废后仅重建了 feature-001，后续包无成体系编号规划；偏差 B-03/B-04/B-05/B-06 需归位到具体任务包，且 shotlist 阶段边界、style-catalog.ts 去向、共享层改动存在建包前必须拍板的歧义。
- **用户决策**（2026-10-13 拍板，四项）：
  1. **划分维度：以 §0.1 八步业务闭环为模块边界**。编号百位 = 业务阶段：0xx–7xx 对应 STAGE 0–7，每段 99 序号；跨阶段横切机制归入 8xx 平台基础（状态机 / 风格谱系 / 统一媒体引擎 / Harness / Skill）。共规划 15 包：001（已落地）、002、101、201、301、302、401、501、601、602、701、801–805（805 二期暂不建包）。
  2. **shotlist 同一文件两阶段演进**：201 产出 `分镜/shotlist.json` 文字稿（一期空镜 `dialogue=null`、`refs=[]`）；401 在**同一文件**上启用 `refs[]` / 景别 / 运镜 / 时长，升级为生产分镜——不设两个产物文件。
  3. **B-05 取重建方案**：重建 `electron/style-catalog.ts`（CATALOG_VERSION + 风格 ID 校验，读 `resources/H3-Style/` 谱系源），feature-802 为落地包；平台只消费不私改谱系（D-005 第 6 条）。
  4. **K1 共享层扩展知情**：002 与 801 改 `shared/types.ts`（`manifest.briefVersion` / 产物 `parentReference` / `CanvasNode.dirty` / 7 态 status / 清退历史 `Stage` 10 态），各包建包时正式走 K1：先出字段方案、用户确认后记包内变更记录，再动代码。
- **建设顺序**：P1 = 801 状态机推进（B-04）→ 002 立项后变更（B-03）；802 风格谱系（B-05）；101/201 反向补录（代码已落地）。P2 = 803 ComfyUI 统一媒体引擎 → 804 Harness + 确认门全链路。P3 = 301 → 302 → 401 → 501 → 601 → 602 → 701。
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
  - 新建任务包 [feature-804-Windows窗口标题栏](../features/feature-804-Windows窗口标题栏/) 5 文件（需求规格 / 契约 / 任务清单 / 设计说明 / 变更记录），溯源 [改编]，无 K1（平台类型落 `src/global.d.ts`，不碰 `shared/types.ts`）；
  - [features/README.md](../../docs/features/README.md)：8xx 表 804 行改窗口标题栏、新增 806 Harness 行、§4 P2 顺序 804→806；
  - [设计现状与偏差清单.md](../../docs/设计现状与偏差清单.md)：§2 新增 B-10，§3 路线表 804 改窗口标题栏、Harness 改 806。
- **波及文件**：feature-804 任务包 5 文件、features/README.md、设计现状与偏差清单.md。交叉指针：feature-804 变更记录 D-006。
- **落地回填（2026-10-13）**：K8 批准后 T1→T6 已全部完成——`electron/window/chrome.ts` 平台分支纯函数、main.ts 四 invoke 一推送、preload/global.d.ts/dev-mock 三处契约同步、`src/studio/WindowControls.tsx` 三按钮、StudioApp 顶栏集成；新增测试 15 例全绿，全量回归 264 passed / 7 skipped / 12 failed（与基线同分布、零扩大）。README 与偏差清单 B-10 已同步为「已落地，待 Windows 真机人工验收」。
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
  - **renderer 返工**：[Stage0View.tsx](../../src/studio/Stage0View.tsx) BriefEditPanel 提交改直调 `window.api.updateBrief`（patch 仅携带变更字段），面板 UI/六控件（项目性质二选 + 时长/集数/画幅/主辅风格）/就绪红线校验/变更计数保留，新增 submitting 态与 `data-stage0-edit-error` 错误条（再版失败面板保持打开、按钮恢复可点）；面板说明文案改「提交后系统直接再版为 v(N+1) 并完成影响追溯（不经 AI 对话）」；onSend 死链全清（Stage0ViewProps → Stage0View → PublishedLoaded → PublishedBody → BriefEditPanel 五层 prop），[StudioApp.tsx](../../src/studio/StudioApp.tsx) `handleSend` 保留供对话区。
  - **当日扩展（用户拍板「项目性质也可手动改」）**：面板五控件扩为六控件——`kind`（商业短剧/个人纪念二选一，D-007 枚举）纳入直改白名单；diffBrief / assessImpact 本已覆盖 `kind`（medium 分级）零改动。
  - **验证**：新建 [brief-update.test.ts](../../src/test/brief-update.test.ts) 6 例（无基线 BRIEF_NO_BASELINE / 值同基线 INVALID_ARGUMENT / 置空 BRIEF_NOT_READY 三零写盘 + 全链路四落盘/changes/挂脏/广播断言 + 辅助风格清除 + 改 kind 命中消费节点挂脏）；[stage0-view.test.tsx](../../src/studio/stage0-view.test.tsx) B-24 describe 改写 5 例（预填六控件+无变更禁提交 / patch 仅含变更字段直调 / 取消不调 / 空集数红线 / 再版失败错误条）。全量 **48 文件 500 passed / 1 skipped**；typecheck 仅 3 条历史基线（plan.ts L96 局部 `found` 声明漏网补齐后零新增）。

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
  - **renderer**：[Stage0View.tsx](../../src/studio/Stage0View.tsx) ①定案区 verbal-only 原话块改**入口动作恒显块**（`data-stage0-entry-action`；verbal 保留 `data-stage0-verbal-quote` 引用块，gate / ui 显路径文案）；②卡①只读卡与编辑卡各加诊断明细块（`data-stage0-diagnosis-detail`，长文限高滚动、恒只读无控件）。[select.ts](../../src/studio/stage0/select.ts) 与 [CanvasBoard.tsx](../../src/studio/CanvasBoard.tsx) 脏字段标签表同源补 `diagnosisDetail: '诊断明细'`（明细参与 diff 后若挂脏，脏条显中文标签而非英文 key）。
  - **提示词同步**：[showrunner.md](../../resources/opencode/agents/showrunner.md) 第 0 步门后 publish 入参加 `diagnosisDetail?`（节点①诊断卡完整明细随立项落盘并显示）；parentReference 字段表注改「诊断摘要与明细是立项留痕、下游产物不消费，均不进字段表」。
  - **验证**：新增/改写 7 例——[stage0-view.test.tsx](../../src/studio/stage0-view.test.tsx) 新 describe 5 例（入口动作 gate / verbal / ui 三路径恒显 + 卡①明细块只读态与编辑态同显恒只读 + 无明细不渲染）；[brief.test.ts](../../src/test/brief.test.ts) diff 捕获 diagnosisDetail + render-md 明细区块两断言；[brief-impact.test.ts](../../src/test/brief-impact.test.ts) it.each 明细 → medium；[brief-update.test.ts](../../src/test/brief-update.test.ts) 面板直改明细原样沿用 + v2 md 渲染明细。全量 **48 文件 507 passed / 1 skipped**；typecheck 仅 3 条历史基线。
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
