# SDG-RE 需求规格 · feature-020 垂直切片·故事（第 1 步）

> 状态：**v1.1 已闭环**（C1-C10 完成；v1.1 为完成态版本，需求条款未变）
> 日期：2026-10-07
> 上游依赖：feature-019（立项切片，已闭环）；架构基线：feature-016/017/018。

---

## 1. 背景与定位

八步闭环第 1 步「故事」承接第 0 步立项定稿，把立项单转化为可执行的**故事大纲**与**人物小传**：

- 架构真相：《短剧Agent平台设计.md》§原则三（第 43 行：`1 | 故事 | 大纲 / 人物小传`）、§7.1 数据血缘（第 403-418 行）。
- feature-019 已交付新立项工作台与 `立项/brief.json`，但新链路在第 0 步后即停止；本切片把链路从第 0 步延伸到第 1 步。
- 本切片**只做第 1 步**，不实现第 2 步（剧本分场）；第 2 步仅在结尾预留交接。

## 2. 用户与场景

- **用户**：短剧创作者（项目主创本人），已在新 Studio 工作台完成第 0 步立项并通过 0-d。
- **场景**：立项定稿后，用户希望由编剧（writer）基于立项单产出整季故事骨架与角色设定，并在两个确认点上逐一裁决，否决可要求按意见重做。

## 3. 需求描述

### 3.1 功能性需求

| 编号 | 需求 |
|---|---|
| FR-1 | 立项定稿（brief 节点 done）后，用户发送"进入故事 / 生成大纲"类指令，showrunner 启动第 1 步。 |
| FR-2 | showrunner 必须经 `task` 委派 `writer` 撰写**故事大纲**；writer 自身推理产出内容，经 `shortdrama_file_write` 落盘为 `故事/故事大纲.json`（附 `故事/故事大纲.md`）。 |
| FR-3 | 大纲落盘后由 **showrunner**（非 writer）发起门 **1-a** 请用户裁决；门 payload 引用大纲产物路径，不内联全文。 |
| FR-4 | 1-a `approved`：大纲定稿，节点 `step-1-outline` 置 done，并以 auto 边衔接上游 `step-0-brief`；随后进入人物小传。 |
| FR-5 | 1-a `rejected`：showrunner 读取门 note，带意见重新委派 writer 修订，以**同一 gateId `1-a`** 重开门；不新增门编号。 |
| FR-6 | showrunner 经 `task` 委派 writer 撰写**人物小传**（≥2 个主要角色，`CharacterProfile.id` 在此诞生），落盘为 `故事/人物小传.json`（附 `.md`）。 |
| FR-7 | 小传落盘后由 showrunner 发起门 **1-b**；`approved` 则 `step-1-profiles` 置 done、auto 边衔接 outline；`rejected` 同 gateId 重开。 |
| FR-8 | 两门全 approved 后，showrunner 向用户汇报"故事阶段定稿、可进入第 2 步剧本分场"，并给出大纲/小传路径；本切片不自动执行第 2 步。 |
| FR-9 | 画布呈现第 0、1 两步节点与跨步骤衔接（数据驱动）；门卡、聊天、裁决交互沿用 feature-019 组件。 |
| FR-10 | 回合开始先 `canvas_get` 恢复：若存在第 1 步 `status:'pending'` 门，用同一 gateId 重挂等待，不重做已挂起产物；支持跨重启续跑。 |

### 3.2 输入 / 输出

- **输入**：`立项/brief.json`（ProjectBrief：六要素 / 视觉风格 / 预检 / 结论）。
  - 决策（2026-10-07）：第 1 步**直接以 brief.json 为输入**；不强制旧设计中的 `故事背景档案.md`，缺档案不报错、不补造。
- **输出**：
  - `故事/故事大纲.json` + `故事/故事大纲.md`（StoryOutline）——1-a 定稿。
  - `故事/人物小传.json` + `故事/人物小传.md`（CharacterProfile[]）——1-b 定稿，角色 id 诞生地。
  - canvas.json：新增 2 节点 + auto 边（含 0→1 跨步骤边）+ 2 门记录。

### 3.3 非功能 / 边界

- **纯文本**：第 1 步全部为文本产物，**不调用任何 `comfyui.*` / `asset.*` 工具，不生成图像/视频/音乐**。
- **职责边界**：写作强制经 `task` 委派 writer；门只能由 showrunner 发起；writer 不发门、不派 task。
- **单向依赖**：renderer 不直连 opencode / ComfyUI；不新增 IPC、不新增 MCP 工具；不改 `shared/types.ts`（无 K1）。
- **新旧并存**：旧 App 整体壳保留至 feature-022；本切片验收后拆除旧"故事"链路（见 FR-11）。
- FR-11（门控清理）：C 阶段验收通过后，删除 `story:enter` / `story:save` IPC 及其 preload/类型键、旧 App 故事状态机与 buildGate1a/1b 前端编排（严格白名单）；清理后再自检。

## 4. 不做什么（Out of Scope）

- 不实现第 2 步分场/台词，不读取或校验下游产物。
- 不生成、不提交任何媒体；不配置 ComfyUI。
- 不修改共享层 schema，不新增门机制或工具。
- 不下线旧 App 整体壳（feature-022）。

## 5. 验收标准（AC）

| AC | 标准 |
|---|---|
| AC-1 | 立项定稿后能进入第 1 步，showrunner 经 task 委派 writer 产出大纲并落 `故事/故事大纲.json/.md`。 |
| AC-2 | 门 1-a 由 showrunner 发起；approved 后 outline 节点 done 且 auto 边衔接 brief 节点。 |
| AC-3 | 1-a rejected 后以同一 gateId 重开，大纲按 note 修订，不新增门编号。 |
| AC-4 | writer 产出人物小传（角色带稳定 id），落 `故事/人物小传.json/.md`；门 1-b 流程同 1-a。 |
| AC-5 | 两门全过后汇报可进入第 2 步，且不自动执行第 2 步。 |
| AC-6 | 第 1 步全程不调用 comfyui/asset，不产生媒体。 |
| AC-7 | 画布同时呈现第 0、1 步节点与跨步骤衔接，数据驱动、无硬编码单步。 |
| AC-8 | 跨重启 / 回合恢复：pending 门同 id 重挂，已挂起产物不重做。 |
| AC-9 | typecheck / test:run / build:electron 全绿；renderer 无引擎/opencode import。 |
| AC-10 | 真机（dev）完整跑通 1-a/1-b（含一次 rejected 重开），人造数据已清理。 |
| AC-11 | 门控清理后旧故事链路被拆除，typecheck/test 再绿，旧壳其余功能不回归。 |
