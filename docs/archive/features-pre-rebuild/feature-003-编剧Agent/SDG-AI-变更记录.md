# SDG-AI-变更记录 · feature-003-编剧Agent

> 三分类管理：决策记录（永久）/ 实施记录（落地清理）/ 修订记录（闭环清理）。
>
> 决策全局续号：feature-002 v1.1 已占用 D-008，本 Feature 自 **D-009** 起。

## 一、决策记录（永久保留）

---

> #D-009 · 2026-10-03 · 卡口 K1 · 已批准（用户 2026-10-03 确认）
>
> **扩展共享层 `shared/types.ts`**：
>
> - `Stage` 联合新增 `'outline' | 'profiles'`（STAGE 1 故事行画布节点 id）
> - `MessageKind` 新增 `'stage' | 'story-outline' | 'character-profiles'`
>
> 理由：故事创作需要阶段进入标记与两类剧本产物消息；画布需承载故事节点。规格 v1.0（修订重提）审批生效。

---

> #D-010 · 2026-10-03 · 卡口 K4 · 已批准（用户 2026-10-03 确认）
>
> **新增顶层业务实体（数据模型）**：
>
> - `StoryOutline`（logline / seasonArc / themes / conflicts / episodes）
> - `CharacterProfile`（身份/性格/背景/动机/弧光/关系/台词风格）
>
> 理由：架构 §7 数据模型中「剧本」层的首批核心实体；是下游分场/台词/分镜的口径来源。

---

> #D-011 · 2026-10-03 · 卡口 K8 · 已批准（用户 2026-10-03 确认）
>
> **新增 IPC 通道（均为新增，不改既有签名）**：
>
> - `story:enter`（manifest 阶段读-改-写）
> - `story:save`（定稿写 `剧本/` JSON+MD 并推进阶段）
> - `agent:story-outline`、`agent:character-profiles`（组装上下文/调方舟/解析/降级 mock，支持可选 instruction）
>
> 新增错误码 `STORY_CTX_MISSING`；复用 `NO_SESSION`。
>
> 理由：支撑 STAGE 1 故事创作的阶段切换、产物定稿与真实生成。
>
> **修订说明**：本 Feature 初稿曾把 `archive:save`（背景档案落盘）列入，该能力已在 feature-002 v1.1 提前交付（决策 D-008），故从本卡口移除。

## 二、实施记录

> #I-001 · 2026-10-03 · 反向补录 + 测试补齐闭环
>
> 基于 2026-10-03 工作区代码状态盘点确认：T1–T7 代码已散落实现且与 [契约](./SDG-RE-契约.md) 逐字段吻合；T8-1/T8-2 测试已存在。本次补齐 T8-3（replay 故事流程 11 tests）、T8-4（ChatPanel 卡片渲染 2 tests）、T8-5（App 故事集成 5 tests），并清理 replay.test.ts 未使用导入。
>
> 验证结果：全量测试 63/63 通过，tsc（渲染层 + node 层）零错误，vite build 成功。任务清单已全部勾选。
>
> 决策 D-009/D-010/D-011（K1/K4/K8）的代码变更已落地，用户已于 2026-10-03 确认批准。

## 三、修订记录

（暂无）
