# SDG-RE 需求规格 · feature-021 垂直切片·剧本分场（第 2 步）

> 状态：**v1.1 已验收**（v1.0 已签字；v1.1 同步建边/结构校验与旧门控清理，2026-10-07 真机验收通过）
> 日期：2026-10-07
> 上游依赖：feature-020（故事切片，已闭环）；架构基线：feature-016/017/018。

---

## 1. 背景与定位

八步闭环第 2 步「剧本分场」承接第 1 步故事定稿，把故事大纲与人物小传转化为可拍摄的**分场表**与**台词本**：

- 架构真相：《短剧Agent平台设计.md》八步闭环表（第 44 行：`2 | 剧本分场 | 分场表`）、§7 目录与数据血缘（第 363、406-419 行）。
- feature-020 已交付 `故事/故事大纲.json` 与 `故事/人物小传.json`，新链路在第 1 步后停止；本切片把链路从第 1 步延伸到第 2 步。
- 本切片**只做第 2 步**，不实现第 3 步（资产）与第 4 步（分镜）；第 3 步仅在结尾预留交接。

### 1.1 范围决策（2026-10-07 用户确认，见变更记录 D-021-01）

1. **第 2 步 = 2-a 分场 + 2-b 台词，两个门**；writer 负责纯文本推理。
2. **2-c 分镜移出第 2 步**：分镜按八步闭环归属第 4 步（media-director，涉结构化镜头设计与后续媒体），门编号在第 4 步切片再定；本切片不保留 2-c。
3. 本切片只做**第一集**（`ep = 1`）的分场与台词；多集生产复用同流程，不在本切片验收。

## 2. 用户与场景

- **用户**：短剧创作者（项目主创本人），已在新 Studio 工作台完成第 1 步并通过 1-b。
- **场景**：故事定稿后，用户希望由编剧（writer）基于大纲与角色产出第一集的分场结构与逐场台词，并在两个确认点上逐一裁决，否决可要求按意见重做。

## 3. 需求描述

### 3.1 功能性需求

| 编号 | 需求 |
|---|---|
| FR-1 | 故事定稿（outline/profiles 节点 done）后，用户发送"进入剧本分场 / 拆分第一集分场"类指令，showrunner 启动第 2 步。 |
| FR-2 | showrunner 必须经 `task` 委派 `writer` 撰写**第一集分场表**；writer 自身推理产出内容，经 `shortdrama_file_write` 落盘为 `剧本/分场.json`（附 `剧本/分场.md`）。 |
| FR-3 | 分场落盘后由 **showrunner**（非 writer）发起门 **2-a** 请用户裁决；门 payload 引用分场产物路径，不内联全文。 |
| FR-4 | 2-a `approved`：分场定稿，节点 `step-2-scenes` 置 done，并以 auto 边衔接上游 `step-1-profiles`（跨步骤 1→2）；随后进入台词。 |
| FR-5 | 2-a `rejected`：showrunner 读取门 note，带意见重新委派 writer 修订，以**同一 gateId `2-a`** 重开门；不新增门编号。 |
| FR-6 | showrunner 经 `task` 委派 writer 撰写**第一集台词**（按场组织、`speakerId` 引用人物小传 id），落盘为 `剧本/台词.json`（附 `.md`）。 |
| FR-7 | 台词落盘后由 showrunner 发起门 **2-b**；`approved` 则 `step-2-dialogue` 置 done、auto 边衔接 scenes；`rejected` 同 gateId 重开。 |
| FR-8 | 两门全 approved 后，showrunner 向用户汇报"剧本分场阶段定稿、可进入第 3 步资产"，并给出分场/台词路径；本切片不自动执行第 3 步。 |
| FR-9 | 画布呈现第 0、1、2 三步节点与跨步骤衔接（数据驱动，分组能力 feature-020 已具备）；门卡、聊天、裁决交互沿用既有组件。 |
| FR-10 | 回合开始先 `canvas_get` 恢复：若存在第 2 步 `status:'pending'` 门，用同一 gateId 重挂等待，不重做已挂起产物；支持跨重启续跑。 |

### 3.2 输入 / 输出

- **输入（必需）**：
  - `立项/brief.json`（ProjectBrief：六要素 / 视觉风格 / 预检 / 结论）。
  - `故事/故事大纲.json`（StoryOutline：第 1 步定稿）。
  - `故事/人物小传.json`（CharacterProfile[]：角色 id 事实源）。
- **输入（可选）**：`故事背景档案.md`——沿用 feature-020 决策，缺档案不报错、不补造。
- **输出**：
  - `剧本/分场.json` + `剧本/分场.md`（SceneBreakdown，`ep=1`）——2-a 定稿，`sceneNo` 场号主键诞生地。
  - `剧本/台词.json` + `剧本/台词.md`（DialogueScript，`ep=1`）——2-b 定稿。
  - canvas.json：新增 2 节点 + auto 边（含 1→2 跨步骤边）+ 2 门记录。

### 3.3 非功能 / 边界

- **纯文本**：第 2 步全部为文本产物，**不调用任何 `comfyui.*` / `asset.*` 工具，不生成图像/视频/音乐**。
- **职责边界**：写作强制经 `task` 委派 writer；门只能由 showrunner 发起；writer 不发门、不派 task。
- **主键一致性**：分场 `characterIds[]`、台词 `speakerId` 必须引用 `故事/人物小传.json` 中既有 `CharacterProfile.id`，不得重生；功能性无小传角色用 `speakerId:''` + `speakerName` 兜底；台词 `sceneNo` 必须引用分场既有 `sceneNo`。
- **单向依赖**：renderer 不直连 opencode / ComfyUI；不新增 IPC、不新增 MCP 工具；不改 `shared/types.ts`（无 K1）。
- **新旧并存**：旧 App 整体壳保留至 feature-022；本切片验收后拆除旧"剧本分镜"链路（见 FR-11）。
- FR-11（门控清理）：C 阶段验收通过后，删除 `script:enter` / `script:save` IPC 及其 preload/类型键、旧 App 剧本状态机与 buildGate2a/2b/2c 前端编排（严格白名单，见契约 §8）；清理后再自检。

## 4. 不做什么（Out of Scope）

- 不实现分镜（2-c 已移出，归第 4 步），不生成镜头表。
- 不做第二集及之后的分场/台词（本切片只验收第一集）。
- 不生成、不提交任何媒体；不做角色/场景资产；不配置 ComfyUI。
- 不修改共享层 schema，不新增门机制或工具。
- 不下线旧 App 整体壳（feature-022）。

## 5. 验收标准（AC）

| AC | 标准 |
|---|---|
| AC-1 | 故事定稿后能进入第 2 步，showrunner 经 task 委派 writer 产出第一集分场并落 `剧本/分场.json/.md`。 |
| AC-2 | 门 2-a 由 showrunner 发起；approved 后 scenes 节点 done 且 auto 边衔接 profiles 节点（1→2）。 |
| AC-3 | 2-a rejected 后以同一 gateId 重开，分场按 note 修订，不新增门编号。 |
| AC-4 | writer 产出第一集台词（按场、speakerId 引用小传 id），落 `剧本/台词.json/.md`；门 2-b 流程同 2-a。 |
| AC-5 | 两门全过后汇报可进入第 3 步，且不自动执行第 3 步。 |
| AC-6 | 第 2 步全程不调用 comfyui/asset，不产生媒体。 |
| AC-7 | 画布同时呈现第 0、1、2 步节点与跨步骤衔接，数据驱动、无硬编码单步。 |
| AC-8 | 跨重启 / 回合恢复：pending 门同 id 重挂，已挂起产物不重做。 |
| AC-9 | typecheck / test:run / build:electron 全绿；renderer 无引擎/opencode import。 |
| AC-10 | 真机（dev）完整跑通 2-a/2-b（含一次 rejected 重开），人造数据已清理。 |
| AC-11 | 门控清理后旧剧本链路被拆除（含 2-c 编排），typecheck/test 再绿，旧壳其余功能不回归。 |
