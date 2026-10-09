# SDG-RE · 需求规格 · feature-019 垂直切片·立项（第 0 步）

> 版本：v1.0（待用户签字）
> 日期：2026-10-07
> 来源标签：[改编]（交互/产物与 MiniMax Design 及旧立项链路形态对齐；底层改由 Agent + 纯工具 + canvas 自主编排）
> 上游事实源：[feature-016 架构重建总纲]（契约 / OD §6）、feature-017（数据模型 + 纯工具）、feature-018（摄制组 profiles 与主控链路）
> 定位：feature-016 任务清单第 42 行——`灵感输入 → Agent 立项诊断/五要素 → 门 0-a~0-d → brief 落盘 → 画布节点`，是新架构首个端到端垂直切片。

---

## 1. 背景与目标

feature-017 已落地 11 个零 LLM 纯工具与 schemaVersion:2 画布模型，feature-018 已让 showrunner（primary）成为唯一主控并打通门跨重启恢复。但**新链路至今没有一次从"用户一句话"到"立项产物 + 画布节点"的完整跑通**：renderer 仍运行旧 App 重状态机（`src/App.tsx`，约 1785 行），新 `window.api.canvas` / `window.api.gate` 在 renderer 侧零接入（已 Grep 证实）。

本切片目标：在**不删除旧壳**（旧壳下线在 feature-022）的前提下，新建一条由 showrunner 自主驱动的立项端到端链路，验证五层架构（Renderer → Main IPC → Agent 运行时 → 引擎媒体 → MCP 纯工具）在真实生产步上可行，并让第 0 步产物、确认门、画布节点全部由 Agent 经纯工具产出。

### 必须满足的硬边界

1. 八步闭环完整、确认点不减少：第 0 步必须保留 **0-a / 0-b / 0-c / 0-d** 四个确认门。
2. 所有立项文本产物（选题诊断 / 六要素 / 视觉风格 / 生产预检 / brief）由 **showrunner 自身推理**产出，经 `shortdrama_file_write` 落盘、`shortdrama_canvas_update` 挂节点；**不存在调用工具生成内容**。
3. renderer 不直连 opencode / ComfyUI，只经 `window.api`；不出现凭证、端口、口令。
4. 第 0 步不调用图像 / 视频 / 音乐生成（视觉风格门只呈现风格设定与锚词，不触发媒体出图）。
5. 并存不删：旧 IPC / 旧 preload 键 / 旧 App 在本切片验收通过前全部保留；本切片**不修改 `shared/types.ts`**（无 K1）。

---

## 2. 角色与场景

| 角色 | 场景 | 期望效果 |
| :-- | :-- | :-- |
| 创作者 | 在新立项工作台输入一句灵感（如"重生复仇都市女频"）并发送 | 对话流出现 showrunner 的理解与拆解；showrunner 经 file 工具自查上下文后产出选题诊断 |
| 创作者 | 0-a 门弹出 | GateCard 展示选题诊断结论/对标/合规，可「确认 / 否决」；确认前流程停在此处 |
| 创作者 | 依次裁决 0-b 六要素、0-c 视觉风格、0-d 生产预检 | 每门在对话流内呈现、可裁决；门未解除不进入下一步 |
| 创作者 | 0-d 确认 | `立项/brief.json`（+ 配套 md）落盘；画布上立项节点 `done`、出现自动连线；具备进入第 1 步的交接状态 |
| 创作者 | 在任一门选择否决 | showrunner 收到 rejected + 否决意见，据此重做后以**同一 gateId** 再次请求该门（不新增门编号、确认点不减少） |
| 创作者 | 立项进行中关闭应用后重开、切回本项目 | pending 门经 feature-018 recoverPending 重挂；showrunner 回合开始 canvas.get 后重新等待同一门，可继续裁决 |
| 创作者 | 想回到旧界面 | 新工作台提供返回旧壳入口；旧 App 功能在 022 前保持可用 |

---

## 3. 功能需求

### F1 · 新立项工作台（renderer，并存新增） `[改编]`

- F1-1 新建新工作台视图（不改写旧 App 状态机），三栏布局：左侧项目/步骤栏、中央画布、右侧（或中栏内）对话驱动区，视觉遵循 feature-016 OD §7（克制、画布为主、不出现凭证端口）。
- F1-2 对话区承载用户输入与 showrunner 文本流；用户发送时，renderer 经现有 `window.api.runtime` 惰性确保运行时与 opencode session，并调用 `promptAsync({ sessionId, text, agent: 'showrunner' })`；经 `runtime.onEvent` 投影流式文本。
- F1-3 renderer 订阅 `window.api.canvas.onChange` 渲染画布节点/边/门；订阅 `window.api.gate.onChanged` 在对话流内挂载 GateCard。**renderer 不自行推导节点状态，画布是唯一工作态。**
- F1-4 GateCard 裁决调 `window.api.gate.decide({ gateId, decision, note? })`；裁决按钮与文案来自 CanvasGate（question/options），renderer 不硬编码业务判定。
- F1-5 提供"返回旧版"入口；新/旧壳切换为纯前端视图开关，不新增 IPC。
- F1-6 加 ErrorBoundary（feature-016 OD §7 错误可展示）：任一渲染期异常以可展示文案兜底，不整窗白屏（针对既有"项目切换白屏"隐患的最小防线）。

### F2 · showrunner 第 0 步自主编排（Agent profile 增补） `[改编]`

- F2-1 在 `resources/opencode/agents/showrunner.md` **正文**增补"第 0 步立项剧本"小节（不改 frontmatter，避免触发 feature-018 静态断言），明确四门顺序、每门产物与落盘/挂节点动作。
- F2-2 立项剧本固定流程（全部由 Agent 自主执行，前端无隐藏指令）：
  1. 回合开始 `canvas.get`；存在与第 0 步相关的 pending 门 → 用同一 gateId 重新 `gate.request` 等待；
  2. 理解灵感，必要时 `file.read` / `file.list` 自查项目上下文，自身推理产出**选题诊断** → `file.write('立项/diagnosis.json')`（+ md）→ `gate.request('0-a')`；
  3. 0-a approved → 自身推理产出**六要素**（题材/平台/单集时长/集数/风格/画幅），写入诊断或 brief 草稿 → `gate.request('0-b')`；
  4. 0-b approved → 自身推理产出**视觉风格设定**（形态/画风/质感配方/锚词）→ `file.write` → `gate.request('0-c')`；**不生成参考图媒体**；
  5. 0-c approved → 产出**生产预检清单**（沿用 PreflightCheck 六项）→ `gate.request('0-d')`；
  6. 0-d approved → 汇总 `file.write('立项/brief.json')` 与 `立项/brief.md`（ProjectBrief 结构，复用既有产物 schema），并 `canvas.update` 挂立项节点（done）+ 自动连线，向用户汇报交接物与下一步。
- F2-3 任一门 rejected：读取 `note` 作为修改意见，重做该门产物后以**同一 gateId** 再次 `gate.request`；不得跳过、合并或新增确认点。
- F2-4 showrunner 第 0 步不使用 `task`（立项文本属主控自产，不委派专职）；不调用 comfyui.* / asset.*。

### F3 · 画布节点与 brief 落盘约定 `[改编]`

- F3-1 立项产物节点 `step: '0'`，`kind` 用语义字符串（如 `diagnosis` / `brief`），`status` ∈ `pending|active|done|invalidated`；`ref.path` 指向 `立项/*.json`，`ref.format: 'json'`。
- F3-2 brief 节点在 0-d 通过后置 `done`；节点间边由 canvas.update 的 auto 边表达（`deriveAutoEdges` 既有规则），renderer 不手动画业务连线。
- F3-3 `立项/brief.json` 结构沿用 shared 既有 `ProjectBrief`（含 FiveElements / VisualStyle / PreflightCheck 引用），产物 schema 不重写；缺依赖时 showrunner 明确报缺口，不臆造字段。
- F3-4 file.write 写前归档（archiveExisting）与路径沙箱沿用既有工具实现，019 不改工具。

### F4 · 验收后的旧物清理（门控，用户预批） `[自研新增]`

- F4-1 **仅在本切片 AC 全绿（含真机验收）后**执行清理，范围严格限定为立项专属、且删除后旧壳故事/剧本仍可运行：
  - 删除旧 IPC handle：`idea:save`、`diagnosis:save`（立项专属落盘）；
  - 移除 preload / global.d.ts 中对应键：`saveIdea`、`saveDiagnosis`；
  - 从旧 App 移除仅服务立项的编排引用（saveIdea/saveDiagnosis 调用点），不删旧 App 整体。
- F4-2 以下**本包不删**（016 总纲表称"等"，此处收窄）：`project:list/create/open/save`、`workflow:save/load`、`chat:*`、`session:*`、`story:*`、`script:*` 等——它们仍被旧壳故事/剧本或运行时基建使用，随各自切片及 feature-022 删除。
- F4-3 清理动作与理由逐条登记 SDG-AI-变更记录；清理后须再跑一次 typecheck/test 全绿。

---

## 4. 不做什么（边界）

1. 不删除 / 不重写旧 App 重状态机、不删旧壳（feature-022）；不改 `src/lib` 旧 workflow/gates/replay/revision/candidates/superseded。
2. 不改 `shared/types.ts`（无 K1）；产物结构复用既有 `ProjectBrief / TopicDiagnosis / FiveElements / VisualStyle / PreflightCheck`。
3. 不新增 / 不改写 MCP 纯工具与 IPC 通道（无 K8 新增）；现有 canvas/gate/runtime 通道已够用。
4. 不做第 1 步及之后的任何业务（故事/剧本/资产等）；019 结束只产出"可进入第 1 步"的交接状态。
5. 不在第 0 步生成图像/视频/音乐，不接 ComfyUI 引擎（023）；视觉风格门仅文本设定。
6. 不做 default_agent 切换、不改 opencode 版本（锁 1.18.34）。
7. 不做 F4 范围外的旧 IPC 删除；旧 project/template/session 等保留。

---

## 5. 验收标准（AC，任务清单 AC 表为准）

- AC-1 端到端：mock runtime 下，从一句灵感发送到 0-d 通过，showrunner 依次调用 file.write（diagnosis/brief）、gate.request（0-a~0-d 各一次，rejected 时同 gateId 重试）、canvas.update（brief 节点 done + auto 边）；调用顺序与 §3 F2-2 一致。
- AC-2 renderer：新工作台能发送、流式显示文本、在对话流挂出 GateCard、裁决后推进；画布节点/边随 `canvas.onChange` 更新；不直连 runtime/引擎（静态扫描 renderer 无相关 import）。
- AC-3 门纪律：四个 gateId 恰为 0-a/0-b/0-c/0-d；否决产生同 gateId 二次请求而非新门；0-c 不触发任何媒体工具。
- AC-4 恢复：在 pending 门状态下重启/切项目，recoverPending 后 GateCard 可裁决，showrunner 续跑（复用 feature-018 机制，补一条链路级测试）。
- AC-5 ErrorBoundary：渲染期注入异常时显示可展示错误而非白屏。
- AC-6 旧壳并存：返回旧版入口可用，旧 App 立项/故事/剧本既有测试不回归。
- AC-7 真机：dev 应用真机 ark 完成一次立项四门，`立项/brief.json` 落盘、画布节点 done、自动连线；人造数据验收后清理。
- AC-8 清理门控：AC-1~AC-7 全绿后才执行 F4；清理后 typecheck/test 全绿。

---

## 6. 上下文加载清单（围栏）

见任务清单 §上下文加载清单。

## 7. 后续事项（不在本 Feature）

- 第 1 步故事垂直切片（下一垂直切片）。
- 旧壳与旧 App 整体下线、旧 project/session/chat/workflow IPC 删除（feature-022）。
- ComfyUI 引擎接入（feature-023）。
