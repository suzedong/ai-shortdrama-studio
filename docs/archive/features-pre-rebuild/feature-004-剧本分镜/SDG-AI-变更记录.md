# SDG-AI-变更记录 · feature-004-剧本分镜

> 三分类管理：决策记录（永久）/ 实施记录（落地清理）/ 修订记录（闭环清理）。
>
> 决策全局续号：feature-003 已占用 D-009~D-011，本 Feature 自 **D-012** 起。

## 一、决策记录（永久保留）

---

> #D-012 · 2026-10-03 · 卡口 K1 · 已批准（用户 2026-10-03 审批任务包）
>
> **扩展共享层 `shared/types.ts`**：
>
> - `Stage` 联合新增 `'scenes' | 'dialogue' | 'storyboard'`（STAGE 2 剧本分镜行三个画布节点 id）
> - `MessageKind` 新增 `'scenes' | 'dialogue' | 'storyboard'`
> - 阶段 phase 由 `'initiating' | 'story'` 扩展为含 `'script'`；`stage` 消息的 `data.phase` 同步扩为 `'story' | 'script'`
>
> 理由：剧本分镜阶段需要三类剧本产物消息与画布节点，且需要独立于故事创作的阶段标记用于重放恢复。规格 v1.0 审批生效。

---

> #D-013 · 2026-10-03 · 卡口 K4 · 已批准（用户 2026-10-03 审批任务包）
>
> **新增顶层业务实体（数据模型）**：
>
> - 分场：`Scene`（含 `SceneBreakdown = Scene[]`）—— ep/sceneNo/slug/内外日夜/location/characterIds/beats/emotion/estSeconds/summary
> - 台词：`DialogueLine`、`DialogueScene`（含 `DialogueScript = DialogueScene[]`）——按场组织，speakerId 引用人物小传
> - 分镜：`ShotDialogue`、`Shot`（含 `ShotList = Shot[]`）——字段对齐架构 §7 分镜条目
>
> 引用键：`sceneNo` 为本集稳定主键（台词/分镜引用），角色统一引用 `CharacterProfile.id`。
>
> 理由：这三个实体是架构 §7 数据模型中 `剧本/分场`、`剧本/台词`、`分镜/shotlist.json` 的结构化契约，也是下游美术定妆、逐镜生成、T2A 配音的口径来源。

---

> #D-014 · 2026-10-03 · 卡口 K8 · 已批准（用户 2026-10-03 审批任务包）
>
> **新增 IPC 通道（均为新增，不改既有通道签名）**：
>
> - `script:enter`（manifest 阶段读-改-写 → `script-scenes`）
> - `script:save`（kind=scenes/dialogue/storyboard，分流写 `剧本/` 或 `分镜/` JSON+MD 并推进阶段）
> - `agent:scenes` / `agent:dialogue` / `agent:storyboard`（分级组装上下文 / 调方舟 / 解析 / 可选 instruction / mock 降级）
>
> 复用错误码 `NO_SESSION`、`STORY_CTX_MISSING`（后者语义覆盖"缺 brief 或缺直接上游产物"）。
>
> 理由：支撑 STAGE 2 的阶段切换、三产物分级定稿与真实生成，且严格不触碰 feature-001~003 既有通道。

---

> #D-015 · 2026-10-03 · 数据结构决策（非卡口，用户拍板）· 已批准（用户 2026-10-03 审批任务包）
>
> **STAGE 2 产物存储结构**（用户 2026-10-03 专项拍板"好好设计数据结构"）：
>
> 1. **存储范式沿用 JSON 源 + MD 镜像双写**：JSON 是唯一结构化源（机器读、下游 Agent 消费、重放之外的上下文数据源）；MD 由主进程从 JSON 单向渲染，只给人看、不回读。不引入新范式。
> 2. **三产物、三文件、三次定稿**：分场、台词、分镜因各有独立确认门与独立否决重做路径，必须物理分开——台词重做不得改写已锁定分场。
> 3. **按消费者分目录**：分场/台词是剧本文本，落 `剧本/`；分镜表消费者是未来镜头/声音/时间线，落架构 §7 规定的新建顶层产物目录 `分镜/shotlist.json/.md`。文件名不带集号（一期 E01），多集命名演进留待后续。
>
> **同时登记 feature-001~003 三项 manifest 历史债务，本包只登记不治理**（用户选择"选项 A"）：
>
> - 债务 1：0-c `project:save` 整体覆盖写冲掉 `status`，靠后续读-改-写补回；
> - 债务 2：五要素/视觉风格在 manifest 与 brief.json 双份存储，无单一事实源；
> - 债务 3：`ProjectBrief.preflight` 从未落盘，架构 §7 manifest 的集列表/采用决定/门状态字段尚未建立。
>
> 治理另立数据治理包，届时触发 **K3（旧系统改造）** 由用户签字。本包所有新写操作一律读-改-写，不新添同类债务。
>
> 理由：编剧功能与数据治理混做会扩大回归面、违背单一职责；先把决策与债务落档，保证可追溯。

## 二、实施记录

- 2026-10-03 T9-4 真机核对（火山方舟真实模型，会话 project-1790989879665「安妮的夏天」）：STAGE 0→1→2 共 8 个确认门全程走通；6 个产物文件落盘并逐字段核对符合契约；manifest 终态 storyboard-done 且既有字段保留；Cmd+R 重放恢复完整。详见任务清单 T9-4。

## 三、修订记录

> 📝 2026-10-03 T9-4 真机缺陷修复（L1：代码与契约不符，契约正确）：
> [现象]：2-a/2-b/2-c 确认门卡片右上角标恒显「STAGE · 立项」（feature-002 时期 GateCard 硬编码，feature-004 扩 Stage 后漏改）。
> [修正]：[src/components/GateCard.tsx] 删除硬编码，改为 `STAGE_LABELS: Record<Stage,string>` 按 `gate.stage` 映射（idea/diagnosis/brief/background→立项；story/outline/profiles→故事创作；scenes/dialogue/storyboard→剧本分镜）。
> [回归保护]：新增 src/components/GateCard.test.tsx 5 用例（含三个 STAGE 2 stage 的 it.each）；全量 99/99 通过、tsc 零错误。
> [契约影响]：无。GateCard.stage 联合类型契约本就正确，纯渲染层缺陷，无需反向改文档。
