# SDG-RE · 契约 · feature-019 垂直切片·立项（第 0 步）

> 版本：v1.0（待用户签字）
> 日期：2026-10-07
> 本契约只规定第 0 步垂直切片的**新增约束**；未覆盖事项一律遵守 [feature-016 SDG-RE-契约.md](../feature-016-架构重建总纲/SDG-RE-契约.md)（五层架构、工具结果、数据模型、门阻塞、错误、安全、测试）。

---

## 1. 适用范围与层级铁律（细化 016 §1）

1. 本切片链路：
   `L5 新立项工作台 → L4 现有 IPC（runtime / canvas / gate）→ L3 showrunner(opencode) → L1 MCP 纯工具 → L0 JSON/MD`。
2. 第 0 步**不经过 L2 引擎媒体**：showrunner 不得调用 `comfyui.* / asset.*`；0-c 门仅呈现视觉风格文本。
3. renderer 只允许使用以下既有 `window.api` 面，不新增 IPC：
   - `runtime.start/status/promptAsync/createSession/subscribe/onEvent/onStatusChange/listAgents`
   - `canvas.get/subscribe/onChange`
   - `gate.decide/onChanged`
   - 项目切换仍用 `project.openProject`（主进程成功链 settleAll→reset→recoverPending 沿用）。
4. 静态断言：renderer 新代码不得 import opencode SDK / ark / ComfyUI 相关模块，不读取任何 URL、口令、Key。

## 2. showrunner 第 0 步编排契约

1. **唯一执行者**：第 0 步全部文本由 showrunner 自身推理产出；第 0 步 `task` 不使用，专职 agent 不参与。
2. **固定门序**（确认点不减少）：

   | 顺序 | gateId | 门前置产物 | 落盘动作（门请求前） |
   |---|---|---|---|
   | 1 | `0-a` | 选题诊断 TopicDiagnosis | `file.write('立项/diagnosis.json')`（可附 md） |
   | 2 | `0-b` | 六要素 FiveElements（含画幅） | 更新/写入立项草稿 |
   | 3 | `0-c` | 视觉风格 VisualStyle + rationale | `file.write('立项/视觉风格.json')`（可附 md），**不出图** |
   | 4 | `0-d` | 生产预检 PreflightCheck[6] | 更新/写入预检草稿 |
   | 5 | 0-d approved 后 | 立项单 ProjectBrief | `file.write('立项/brief.json')` + `brief.md` |

3. **门请求**：每门经 `gate.request({ gateId, question, options, payload? })`；payload 可携带该门产物的 ref（path）。工具写 pending 门 → 推 `gate:changed` → Promise 挂起（沿用 016 §6）。
4. **裁决分支**：
   - `approved` → 进入下一阶段；
   - `rejected` → 读取 `note`，重做本门产物后以**同一 gateId** 再次 `gate.request`；禁止新增门编号 / 跳门 / 并门。
5. **回合开始恢复**：先 `canvas.get`；存在第 0 步相关 `status:'pending'` 门时，用同一 gateId 重新 `gate.request`（重挂既有门，不重复建门）。
6. 产物内容零工具生成：不存在"让工具写内容"的原语；file.write 的 text 由 showrunner 自身提供。

## 3. 画布节点契约（016 §4 的第 0 步取值）

1. 立项节点 `step: '0'`；`kind` 语义取值（如 `'diagnosis' | 'visual-style' | 'brief'`）；`status` 仅取 `pending|active|done|invalidated`。
2. `ref`：`{ path: '立项/<file>.json', format: 'json' }`（md 附件可在 meta 标注，不另占主 ref）。
3. 节点经 `canvas.update({ mode:'merge', nodes, edges })` 幂等 upsert；brief 节点在 0-d approved 后置 `done`。
4. 立项节点间依赖边以 `auto: true` 表达，由 `deriveAutoEdges` 产生；renderer 不推导、不手画业务连线。
5. renderer 以 canvas 为唯一工作态：不据消息自行维护节点/门状态。

## 4. Renderer 并存契约

1. 新增工作台为独立视图；旧 App（feature-022 前）保留且可经"返回旧版"进入。
2. 新/旧切换为前端内存视图开关，不引入新 IPC、不改 manifest。
3. 新工作台必须包 **ErrorBoundary**：渲染期异常显示可展示文案（不暴露凭证/堆栈细节），不得整窗白屏。
4. GateCard 的标题/问题/选项/按钮渲染自 CanvasGate；renderer 不硬编码业务合格判定（harness 由 Agent 在 payload/产物中给出，或仅展示不判定）。
5. 流式文本经 runtime 事件投影；发送必须指定 `agent: 'showrunner'`（client.ts 已按 showrunner 白名单校验 6 物理工具）。

## 5. 错误契约（沿用 016 §7，不新增码）

- 门相关：`INVALID_ARGUMENT`（未知/已决门）、`GATE_TIMEOUT`（异常）；
- 运行时：`RUNTIME_NOT_READY / PROMPT_FAILED / PROMPT_ABORTED / UPSTREAM_AUTH_MISSING / SESSION_NOT_FOUND`；
- 文件：`PATH_ESCAPE_DENIED`；兜底 `INTERNAL`。
- renderer 一律展示可展示文案，不出现凭证、端口、口令。

## 6. 清理契约（K8，用户预批，验收后门控）

1. 触发条件：需求规格 AC-1~AC-8（含真机验收）全部通过。
2. 删除白名单（仅此四项）：
   - handle `idea:save`、`diagnosis:save`；
   - preload/global.d.ts 键 `saveIdea`、`saveDiagnosis`；
   - 旧 App 中仅服务这两个调用的立项引用。
3. 显式保留：`project:*`、`workflow:*`、`chat:*`、`session:*`、`story:*`、`script:*`、`template:*` 及全部 runtime/canvas/gate/asset/settings 通道。
4. 清理后重跑 `typecheck` + `test:run`，结果登记变更记录。

## 7. 测试契约（补充 016 §9）

| 层 | 新增要求 |
|---|---|
| 编排 | 断言四门 gateId、调用顺序、rejected 同 id 重试、0-c 不触媒体、brief 0-d 后落盘 + 节点 done/auto 边 |
| renderer | 发送→流式→GateCard 挂载→裁决推进→画布更新；ErrorBoundary 兜底；新旧壳切换 |
| 架构断言 | renderer 新代码无 runtime 引擎/opencode import；showrunner 第 0 步无 task/comfyui/asset 调用（以编排测试/mock 断言） |
| 恢复 | pending 门 + recoverPending 链路级用例 |
