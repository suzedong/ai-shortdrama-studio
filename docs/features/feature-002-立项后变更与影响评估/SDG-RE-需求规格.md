# feature-002 立项后变更与影响评估 · 需求规格

> 任务包性质：**设计书机制完整、代码零落地的新建包**（偏差 B-03；D-011 2026-09 用户拍板三原则，D-013-4 要求 K1 字段方案先行报批）。
>
> 事实源：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §2.6.6（L249–299，全字段可改 + 影响必标记 + 用户决策三原则、字段→影响映射、脏读语义、回滚、STAGE 0 视觉）、§2.6.7（L301–357，追溯算法五步、分级表、面板与三动作、脏读运行时、Harness 30 天）、§7.1（L585：`manifest.briefVersion` + `parentReference` + 影响清单）。
>
> 决策依据：[SDG-AI-决策台账.md](../../governance/SDG-AI-决策台账.md) **D-011**（全字段可改三决策，L140–165）、**D-013-4**（K1 知情项三字段，L203）。
>
> 解决偏差：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) **B-03**（manifest 初始化无 briefVersion；产物无 parentReference；无影响清单与追溯逻辑）。
>
> 溯源标签：**[自研新增]**。

## 1. 背景

feature-001 已落地版本化立项：`立项单.vN.json/.md` 全量保留、`diffBrief` 提供字段级 Δ、brief.publish 每次发布一版且永不覆盖。但 v1 之后的再版链路只有"能发新版"的骨架：

- [library.ts](../../../electron/project/library.ts) `createProject` 写初始 manifest 仅 5 字段，**无 `briefVersion` 指针**；任何代码无法回答"项目当前对齐第几版立项"。
- 画布节点（[shared/types.ts](../../../shared/types.ts) L324–333 `CanvasNode`）**无 `parentReference`、无 `dirty`**；产物节点不声明"基于哪版立项、引用了哪些字段"，追溯算法第 2/3 步无数据可遍历。
- 19 个 MCP 工具中**无影响评估 / 决策落盘 / 对齐工具**；§2.6.7 的五步算法、影响清单落盘、三选一动作均无实现。
- renderer 版本显示仅有节点 `meta.version` 静态文本与流程导航 badge，**无脏角标、无 `vN ⚠️k` 计数、无脏读黄条**。
- `RevisionSource` 注释明示「立项后变更解锁（0-final）属 B-03/P1，暂不加入」（types.ts L280）；`UnlockData.downstream` 注释指向 feature-002 重构（L288）。

本包在 feature-001（版本化立项）/ feature-801（manifest 状态机）/ feature-802（谱系注入的就绪判定）之上，补齐"立项再版 → 影响评估 → 用户决策 → 脏读/对齐"的数据模型、纯函数、MCP 工具链、Agent 纪律与最小 renderer 标识。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 要做什么 | 达成效果 |
|---|---|---|---|---|
| R1 | 主控 Agent（showrunner） | STAGE 1+ 任何阶段用户要求改立项字段（"集数改 12 集"） | 走再版流程：brief.plan 校验 → 用户拍板 → 影响预评估 → 向用户呈报 Δ 与受影响产物 → 用户三选一后提交再版 | 全字段可改（含 premise/主风格），无 disabled、无锁；改动先评估后落盘 |
| R2 | 系统（影响评估纯函数） | 用户拍板再版后、落盘前 | 输入 Δ + canvas 现状，按 `parentReference.briefVersion==vN` 与 `fields ∩ Δ` 反向遍历全部产物节点，输出分级影响清单（高/中） | 评估只读、可重放、可单测；不依赖 Agent 自觉 |
| R3 | 主控 Agent | 用户三选一 | 「一键重生成选中」→ commit 后对选中节点串行委派重生成，逐个对齐；「仅标记脏」→ 全部挂脏保留旧内容；「取消」→ 不调 commit，新版永不落盘 | 决策归用户；受影响产物不自动重生成 |
| R4 | 系统（commit） | 三选一确认后 | 与 v1 同一把写队列：双写 `立项单.v(N+1)`、推进 `manifest.briefVersion`、落盘影响清单 JSON、按决策给节点挂 `dirty` | 一次落盘五件事原子排队；v1..vN 永不覆盖 |
| R5 | 系统（画布/渲染） | 节点处于脏态 | 节点挂黄色 ⚠️ 角标（hover 显示基于 vN/最新 vM/命中字段），**不灰显、不阻断、status 仍 done**；STAGE 0 导航显示 `vN ⚠️k`；顶部纯文本黄条提示 | 脏读运行时：照常使用，差异可见 |
| R6 | 主控 Agent | 脏产物被打开或被下游引用 | 向用户明示版本警告；下游生成提示词追加"此产物基于 vN，与最新 vM 不一致"；重新生成定稿后调对齐工具清脏 | 脏信息进入 Agent 上下文，不静默扩散 |
| R7 | 系统（对齐工具） | 产物按新版重生成定稿 | 清 `dirty`、`parentReference.briefVersion` 推进到最新版 | 节点恢复全对齐；导航计数回落 |
| R8 | 主控 Agent | 任一产物首次定稿挂 done 节点 | 节点带 `parentReference { briefVersion, fields[] }`（版本取当前 manifest 指针，fields 按产物类型字段表声明） | 为此后每次再版积累追溯依据；无引用的节点不进影响清单 |

## 3. 核心机制（对齐设计书的实现口径）

### 3.1 追溯算法五步（§2.6.7 L305–318）

1. **diff 提取**：复用 [diff.ts](../../../electron/brief/diff.ts) `diffBrief(prev, draft)`，Δ 元素字段路径命名空间不变（`kind` / `fiveElements.*` / `premise.*` / `style.*` / `diagnosisSummary`）。
2. **依赖图反向遍历**：事实源为 **canvas.json 节点**（B-09 后 manifest 无 nodes；设计书写 `project.manifest.json 的 nodes[*].parentReference` 是 v1.11 前旧表述，本包以 §7.1「字段契约以 shared/types.ts 为准」收口为 `CanvasNode.parentReference`）。候选 = `status==='done'` 且 `parentReference.briefVersion===fromVersion` 的节点。
3. **影响字段命中**：`parentReference.fields ∩ Δ字段` 非空即受影响；产物 `fields[]` 由 showrunner 在定稿时按字段表声明（见契约 §7），平台不解析产物文件内部。
4. **影响分级**（消费 Δ 的字段路径，逐字段定级，产物级取命中字段最高级）：
   - **高**（默认勾选重生成）：`fiveElements.aspectRatio`、`style.mainStyleId`、`style.catalogVersion`、`premise.*` 五项。
   - **中**（默认仅标记脏）：`fiveElements.episodeCount`、`fiveElements.episodeDuration`、`fiveElements.genre`、`fiveElements.tone`、`fiveElements.platforms`、`style.auxiliaryStyleId`。
   - **低**（不入清单）：仅元数据。现状立项单模型**无 L0 字段**（项目名在 `.session.json`，tags/备注不存在）；`kind`（商业/纪念）与 `diagnosisSummary` 归**中**。本包低级别无字段可命中，分级表保留级别定义备未来 L0 落地。
5. **清单落盘**：commit 时写影响清单 JSON（形状见契约 §3），含时间戳、Δ、影响产物、分级、每项用户决策。

### 3.2 三选一动作语义（§2.6.7 L342–346）

- **一键重生成选中**：commit 把选中项**同样先挂脏**并在返回值 `regenerate[]` 中作为 Agent 工作队列；Agent 按旧版重生成、定稿后调对齐工具，`parentReference.briefVersion` 改 v(N+1)、清脏。未生成（非 done）节点不在清单中，由 Agent 在后续生产中直接按新版生成（其首次定稿即带新版 parentReference）。
- **仅标记脏**：全部命中项挂脏、旧内容保留；打开编辑时 Agent 触发"是否按 v(N+1) 对齐"征询（R6，对话承载，无平台弹窗）。
- **取消**：Agent 不调 commit；`立项单.v(N+1)` 与影响清单均不落盘，字段改动只留在对话中。

### 3.3 脏读与回滚

- 脏态三不：不丢节点、不灰显（与既有 `invalidated` 红色 opacity-60 硬失效语义严格区分）、不阻断编辑；status 保持 `done`。
- 回滚沿用 feature-001：以历史版内容为草案重新发布一版（vK 内容 → 新发 v(N+1)），v1..vN 永不覆盖；回滚发布走同一评估流程。
- Harness「30 天漂移提醒」（§2.6.7 L354–357）属质量层 feature-806，**不在本包**；影响清单永久留底已为本包职责。

## 4. 范围

### 4.1 本包做

- **K1**：[shared/types.ts](../../../shared/types.ts) 三处字段——`ProjectManifest.briefVersion: number | null`；`CanvasNode.parentReference?: { briefVersion: number; fields: string[] }`；`CanvasNode.dirty?: { sinceBriefVersion; latestBriefVersion; fields; severity; impactReport }`；同步更新 L280/L288 两条 002 待办注释。
- 新建 `electron/brief/impact.ts`：纯函数 `classifyChanges(changes)` / `assessImpact(changes, canvas, fromVersion)`（含分级、过滤、排序、默认动作），全部同步可单测。
- `electron/project/`：`createProject` 初始 manifest 写 `briefVersion: null`；`parseManifest` 对旧文件（无该字段）读默认 `null`（读-改-写不丢字段）。
- `electron/canvas/store.ts`：节点整体替换时，入参未带 `dirty` / `parentReference` 则**保留旧节点同名字段**（防止后续普通节点更新抹掉血缘/脏态）；canvas.update zod 入参开放 `parentReference`（`dirty` 不开放，仅专用工具可写）。
- brief.publish 写盘主体抽为 `electron/brief/publish.ts` 内部可复用流程；v1 路径行为逐字不变，新增发布时 `manifest.briefVersion` 读-改-写（v1 同步为 1）。
- **K8**：MCP 新增 3 个零 LLM 工具（19 → 22，仅挂 showrunner profile）：
  1. `brief.impact.assess`（20，只读干跑）：入参 draft，返 Δ + 分级影响清单（不落盘、不校验就绪之外的副作用）。
  2. `brief.impact.commit`（21）：v2+ 专用发布——就绪闸门 → 复算影响 → 校验 decisions 全覆盖 → 队列内完成五件写盘（立项单双写 / manifest 指针 / 影响清单 / 节点挂脏 / brief 节点 upsert）。
  3. `canvas.align`（22）：清指定节点脏态并推进 parentReference 版本。
- [showrunner.md](../../../resources/opencode/agents/showrunner.md)：frontmatter 工具键 + 权限两处登记（14 → 17）；新增「立项再版工作流」纪律段（plan→拍板→assess→呈报→三选一→commit→重生成队列→align）；定稿挂节点必带 parentReference 的字段表纪律；脏读警告纪律。
- renderer 最小标识：CanvasBoard 节点黄色 ⚠️ 角标 + hover 文案；StageNavPanel STAGE 0 `✓ vN` / `vN ⚠️k`；画布顶部纯文本脏读黄条（无按钮）。
- 测试：impact 纯函数全套件；MCP 三工具信封/错误/落盘 e2e（临时项目夹具）；manifest 旧档兼容；store 字段保留；白名单/注册数静态契约（agent-profiles 14→17、mcp-pure-tools 19→22、runtime-client、runtime-integration）。

### 4.2 本包不做（显式排除）

- **不做影响评估弹窗面板 UI**：设计书 §2.6.7 面板是草图；renderer 无 MCP/IPC 调用通道（既有定案门亦由 Agent 对话承载），三选一经对话完成。弹窗、勾选列表、「一键对齐」按钮留待 renderer↔主进程通道包。
- **不做产物文件内部 parentReference 强制**：产物 JSON 由 writer 经 file.write 自由书写、平台不解析；追溯只认 canvas 节点字段。
- **不做 STAGE 3–7 产物的实际重生成**：资产/分镜/镜头/后期代码尚不存在（B-06）；assess 对全 step 节点一视同仁，重生成由 Agent 按当时已存在能力执行，平台不假装。
- **不做 STAGE 1–2 的自动一键重生成**：大纲/小传/分场/台词/shotlist 的重生成是 Agent 串行委派动作，本包只给队列与对齐工具，不内置编排器。
- **不做 RevisionSource 扩 `'0-final'`、不重构 UnlockData.downstream 语义**：现有修订传播消息流零消费方；仅更新注释指向。是否启用 0-final 消息随 STAGE 1+ 修订传播包另立。
- **不做 Harness 30 天漂移提醒**（feature-806）。
- **不做影响清单 MD 镜像**：清单是机器/回溯用 JSON（§2.6.7 仅要求 json），不双写 md。
- **不改立项单 v2 schema、不改 diffBrief 比较范围**：Δ 字段集完全沿用 feature-001。
- **不做「查看历史」diff 视图 UI 与回滚按钮**：feature-001 的 brief.list 已供数据，UI 随通道包；回滚能力本身（旧版作草案再发）已由现有工具链支持。

## 5. 验收（业务层）

- AC1：v1 项目（无旧版）调 brief.impact.assess 返回错误信封（无基线版本），v1 发布仍只走 brief.publish，行为与现状逐字一致；发布后 `manifest.json.briefVersion === 1`。
- AC2：已发布 v2 草案场景下，assess 返回 Δ 与影响清单；集数/时长类命中节点 severity=medium、defaultAction=mark；画幅/主风格/premise 类命中 severity=high、defaultAction=regenerate；清单按高在前排序。
- AC3：非 done 节点、parentReference 缺失节点、briefVersion 不等于 vN 的节点、fields 与 Δ 无交集的节点，均不出现在影响清单。
- AC4：commit（仅标记脏）后：`立项单.v(N+1).json/.md` 双写且旧版未覆盖；`manifest.briefVersion` 推进；`影响清单.vN-v(N+1).json` 落盘（含 Δ/节点/分级/每项 decision/时间戳）；命中节点出现 dirty（since/latest/fields/severity/impactReport 五字段齐全），status 仍 done、节点不灰显。
- AC5：commit（含重生成选中）返回 `regenerate[]` 工作队列；选中项在重生成完成前同样挂脏；调 canvas.align 后该节点 dirty 清除、parentReference.briefVersion 推进到最新；STAGE 0 导航计数相应回落。
- AC6：取消路径不调 commit 即无任何新文件、manifest 不变；重复 commit 同版本被既有防覆盖闸门拦截（版本文件已存在错误）。
- AC7：节点带脏后，showrunner 经 canvas.update 普通更新该节点（不带 dirty/parentReference）不丢失两字段；canvas.update 入参无法直接写入 dirty（zod 不接收）。
- AC8：旧项目 manifest（无 briefVersion 字段）读取不报错且 briefVersion 视为 null；createProject 新档含 `briefVersion:null`。
- AC9：CanvasBoard 脏节点显示黄色 ⚠️ + hover「基于 vN，与最新 vM 不一致：<字段>」，视觉与 invalidated 明确区分；StageNavPanel STAGE 0 在全对齐时 `✓ vN` 绿、有脏时 `vN ⚠️k` 黄。
- AC10：showrunner.md 含再版工作流与 parentReference 字段表纪律；工具白名单三处登记一致（tools.ts 22 / provider showrunner 17 / agent-profiles 静态测试 17 键），writer/media-director 不获三工具。
- AC11：`npm run typecheck`、`tsc -b tsconfig.node.json`、`tsc -p tsconfig.preload.json` 不新增错误（基线 7）；本包测试全绿；全量回归不扩大（基线：302 passed / 7 skipped / 12 failed，2026-10-13 feature-802 后）。
