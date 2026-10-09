# SDG-RE 需求规格 · feature-017 画布基座与纯工具层

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 上游：[feature-016 架构重建总纲](../feature-016-架构重建总纲/SDG-RE-契约.md)（已批准）
> 本 Feature 是重建路线的**第一块地基**：落地新数据模型、纯工具层、主进程 CanvasStore 与配套 IPC。不含 Agent profile（018）、不含任何垂直切片业务（019+）、不做 Renderer 重建（022）。

---

## 1. 背景与问题

feature-016 已锁定四病灶与五层目标架构，但那是总纲（仅文档）。当前代码仍是旧形态：

1. **MCP 工具层越界**：[tools.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/tools.ts) 的 8 个工具内部 `import { chat } from '../ark.js'` 并拼装 [prompts.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/prompts.ts)，工具既做生成又做解析，返回 `ToolResultEnvelope {kind, product}`。这违背新契约 §1.2-3「MCP 禁止反向调 LLM」。
2. **无画布单一工作态**：现状工作态分散在 `workflow.json`（WorkflowState 三阶段）、各产物文件、renderer 节点状态三处（feature-016 需求规格 §1-P4），缺少 `Canvas` 整图。
3. **写队列/归档原语耦合在 session.ts**：[session.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/session.ts#L339-L415) 已有成熟的 `enqueue`（单写队列）与 `archiveExisting`（写前归档），但是模块私有、且与旧会话流程绑死，无法被新工具直接复用。
4. **缺少 canvas/gate/asset/settings 通道**：[main.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/main.ts) 目前只有 runtime 12 handle + 旧业务 handle，新契约 §5.2 的通道一个都不存在。

## 2. 目标

| 编号 | 目标 | 验收指向 |
|---|---|---|
| G1 | shared 层落地新数据模型（StepId / CanvasNode / CanvasEdge / CanvasGate / Canvas / ComfyInstance / AssetIndexItem），并按 K1 最小化处理旧类型 | 契约 §3、§6 |
| G2 | MCP 工具重写为 **11 个零 LLM 纯工具**（file.*/canvas.*/gate.*/asset.*/comfyui.*），静态扫描无 ark/prompts/chat 依赖 | 契约 §4 |
| G3 | 主进程新建 **CanvasStore**：画布读写、节点/边幂等 upsert、单写队列、写前归档、订阅广播 | 契约 §5 |
| G4 | 新增 **canvas/gate/asset/settings IPC** 并经 preload 白名单暴露；renderer 仍只能经 `window.api` | 契约 §7 |
| G5 | 路径沙箱：所有文件工具限定在当前项目目录（含资产目录），越界 → `PATH_ESCAPE_DENIED` | 契约 §4.4 |
| G6 | 统一结果结构 `{ok:true,...}` / `{ok:false,error:{code,message}}`，删除 ToolResultEnvelope | 契约 §4.3 |

## 3. 范围

### 3.1 本 Feature 做

1. 修改 [shared/types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/shared/types.ts)：新增 7 类型；按 feature-016 契约 §4.3 标记/处理旧类型（见本包契约 §6 的 K1 处置时序）。
2. 重写 [electron/mcp/tools.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/tools.ts)：11 个纯工具；删除 ark/prompts/style-catalog/session 耦合。
3. 抽出可复用写原语：将单写队列 / 写前归档从 session.ts 抽为独立模块（不改其行为），供 CanvasStore 与 file.write 复用。
4. 新建 `electron/canvas/store.ts`（CanvasStore）：内存投影 + 落盘 `canvas.json`、upsert 节点/边/门、订阅者广播。
5. 新建 gate 等待注册表（主进程侧）：维护 pending gate 的 resolve 回调，供 gate.request 挂起 / gate:decide 解除（**不含跨重启恢复**，恢复在 018 随 Agent 链路做，见 §3.3）。
6. 新建资产索引模块：`asset-index.json` 的读 / register。
7. 新建 ComfyUI 设置模块：实例配置持久化于 `project.json`（或独立 settings 文件，契约锁定），本 Feature 仅做配置 CRUD 与内存读取，**不含真实探活/工作流提交的网络实现**（023 做）。
8. [main.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/main.ts) 注册新 IPC handle；[preload.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/preload.ts) 暴露 `canvas/gate/asset/settings` 命名空间。
9. 单元测试：路径沙箱、写前归档、{ok} 结构、节点 upsert 幂等、自动连线、门挂起/解除。

### 3.2 本 Feature 不做（边界）

- 不写 / 不安装任何 Agent profile（showrunner/writer/... 在 018）。
- 不实现任何八步业务内容（立项/故事/剧本在 019-021）。
- 不做 Renderer 组件重建；现有 UI **保持可运行**，本包以"新增并存"为主，旧 IPC 与旧 handle **本包不删**（删除在切片验收后，见 feature-016 §C）。
- 不做 ComfyUI 真实网络探活 / 工作流提交 / 轮询（023）；本包 `comfyui.instances/queue/status` 工具只做**参数校验 + 转发占位接口**，底层网络客户端在 023 注入。
- 不做 gate 跨重启恢复（018）。
- 不引入新的核心第三方依赖（沿用 feature-016 D016-06）。

### 3.3 关于 gate 阻塞的本包交付深度

本包只交付**单次运行内**的 gate 阻塞闭环：`gate.request` 挂 Promise ↔ `gate:decide` 解除。理由：MCP 工具必须在 017 就能被调用并返回结构正确的结果，018 才能把它接入 Agent。跨重启的 pending 门恢复依赖 opencode 会话恢复时机，属 018 链路。本包须保证：应用关闭时不残留悬挂的未结算 Promise（store 关闭时统一 reject 为 `GATE_TIMEOUT`）。

## 4. 硬边界符合性（AGENTS.md §0.1 / feature-016 §5）

1. **八步闭环不被破坏**：StepId 八字面量齐全，本包不实现业务但类型层保证后续每步可挂节点。
2. **局域网 ComfyUI 硬边界**：ComfyInstance.baseUrl 允许任意本地/局域网地址（不写死 loopback、不多实例限制）；仅 MCP 控制面保持 loopback。
3. **生成通道红线**：本包无任何媒体生成代码；comfyui.queue 是纯转发占位，不生成内容。
4. **renderer 不直连**：本包不改 renderer 网络面，新能力一律经 IPC。
5. **媒体零公网**：本包不出公网；唯一可能的公网侧（ark）在工具层被**删除**而非新增。

## 5. 用户可观察结果

本 Feature 面向后续开发，终端用户无可视化新页面。可观察的间接结果：

- `window.api.canvas / gate / asset / settings` 可用（DevTools 可验证）。
- 项目目录新增 `canvas.json`、`资产/asset-index.json`，写入时旧版进入 `版本/`。
- 现有应用启动、旧功能不受影响（并存，不回归）。

## 6. 溯源标注（feature-016 需求规格 §6）

- 画布整图 / 节点编排：**[改编]** 自 MiniMax Design Canvas Flow（形态对齐，底层自研、JSON 落盘）。
- 确认门阻塞：**[自研新增]**（Design 的 OUTPUT SYNC 是审核节点，本平台做成对话内阻塞门）。
- ComfyUI 多实例 / 本地局域网：**[自研新增]**（补 Design 缺口）。
- 单写队列 / 写前归档：**[自研新增]** 既有基建（feature-005）的复用抽取。

## 7. 总体验收（需求层）

1. shared 新类型就位，typecheck 全绿；旧类型处置符合契约 §6 时序，无破坏性引用。
2. mcp/tools 层 11 工具全部零 LLM，静态扫描不含 `ark`/`prompts`/`chat`。
3. CanvasStore 支持节点/边/门 upsert 幂等、自动连线、单写队列、写前归档、变更广播。
4. 新 IPC 经参数边界校验，越权/越界路径返回 `PATH_ESCAPE_DENIED`，错误不携带凭证。
5. 单元测试全绿；现有应用与旧功能无回归。
6. 未实现任何 018+ 的内容（范围纪律）。
