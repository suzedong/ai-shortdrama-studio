# SDG-AI 变更记录 · feature-017 画布基座与纯工具层

> 状态：**v1.1 已实施（B1–B9 完成）**
> 日期：2026-10-07
> 上游永久决策：[feature-016 SDG-AI-变更记录](../feature-016-架构重建总纲/SDG-AI-变更记录.md) D016-01 ~ D016-07（已批准）。
> 本记录登记 feature-017 落地所触发的卡口与"实施即过渡"事项。

---

## 一、卡口决策（本 Feature）

### D017-01 · K1 共享类型变更（追加式、最小化）

- **变更**：[shared/types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/shared/types.ts) 追加 `StepId / CanvasNode / CanvasEdge / CanvasGate / Canvas / ComfyInstance / AssetIndexItem`，逐字采用 feature-016 契约 §4.1。
- **边界**：本包对 shared **仅追加**；不删除、不修改任何既有导出（`ChatMessage.kind` 收敛、旧类型删除均移交 feature-022）。
- **依据**：feature-016 D016-01 已对"新增 + 弃用"一次性预批；本包将其拆为"先增（017）后弃（022）"，不扩大范围。

### D017-02 · K3 存量处置（等价抽取 + 旧工具删除）

- **等价抽取**：`enqueue` / `archiveExisting` / `archiveStamp` 自 [session.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/session.ts) 抽至 `electron/fs/`，行为不变；新旧写入共用同一单队列。
- **旧物删除**：删除 mcp/tools.ts 中 8 个生成型工具、`ToolResultEnvelope` / `BusinessToolName`（定义在 tools.ts）、以及 tools.ts 对 `ark.js / prompts.js / style-catalog.js / session.js` 的耦合。
- **安全性论证**：8 旧工具仅被 MCP server 注册引用，不被旧 IPC / renderer 引用，随重写替换无外部破坏；session.ts 抽取由既有测试（session-archive/workflow/finalized、background-archive）兜底证明等价。

### D017-03 · K4 新增技术对象

- 新增：CanvasStore、GateBridge、AssetIndex、Comfy settings/client holder、fs 沙箱、project/current。
- 均为主进程内部对象；持久化新增 `canvas.json`、`project.json`（含 comfyInstances）、`资产/asset-index.json`。
- 依据 feature-016 D016-03/D016-04 预批；本包不新增 Agent（Agent 在 018）。

### D017-04 · K8 IPC 面变更（只增不删）

- **新增** 8 invoke：`canvas:get`、`canvas:subscribe`、`canvas:unsubscribe`、`gate:decide`、`asset:list`、`settings:comfy:list`、`settings:comfy:upsert`、`settings:comfy:remove`。
- **新增推送**：`canvas:changed`、`gate:changed`。
- **不删**：feature-016 D016-05 预批的"删除 ~27 旧 handle"按切片验收后执行；本包旧 handle 全部保留。

### D017-05 · K9 依赖约束

- 不引入任何新的第三方运行时 / 核心依赖；仅使用 Node 内置 `fs/path/crypto` 与既有 zod、MCP SDK。

### D017-06 · 错误码追加

- [electron/runtime/types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/runtime/types.ts) 的 RuntimeErrorCode 仅追加 `PATH_ESCAPE_DENIED`、`GATE_TIMEOUT`。
- 总纲 §7 中 `STRUCTURED_OUTPUT_FAILED / SESSION_CREATE_FAILED` 的移除不在本包（随 022）。

## 二、硬边界确认

1. 八步闭环：StepId 八字面量齐全，仅类型层预留，不实现业务。
2. 局域网 ComfyUI：ComfyInstance.baseUrl 不限制 loopback、支持多实例；仅 MCP 控制面 loopback。
3. 通道红线：本包无媒体生成；comfyui.queue 为纯转发占位，client=null 时返回 INTERNAL。
4. 媒体零公网 / renderer 不直连：本包删除的是工具层 ark 依赖，未新增任何出公网或直连。
5. 单写队列 + 写前归档：新旧共用，版本/ 不被覆盖。

## 三、实施即过渡事项（不作为永久决策）

| 过渡项 | 存在期 | 后续处置 |
|---|---|---|
| canvas 与 workflow 两套工作态并存 | 017 → 022 | 022 删 workflow 及旧状态机 |
| comfy client holder = null | 017 → 023 | 023 注入真实 ComfyClient |
| gate 仅单次运行内阻塞 | 017 → 018 | 018 加跨重启恢复 |
| 旧 IPC / 旧类型保留 | 017 → 对应切片验收 | 按 016 §C 分包删除 |

## 三补、实施结果（2026-10-07）

- B1–B8 产品代码全部落地，文件清单与本记录第一、二节一致；新增/抽取：
  - 新增 [electron/fs/write-queue.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/fs/write-queue.ts)、[archive.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/fs/archive.ts)、[sandbox.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/fs/sandbox.ts)
  - 新增 [electron/project/current.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/project/current.ts)
  - 新增 [canvas/edges.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/canvas/edges.ts)、[canvas/store.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/canvas/store.ts)、[gate/bridge.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/gate/bridge.ts)、[asset/index.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/asset/index.ts)、[comfy/settings.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/comfy/settings.ts)、[comfy/client.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/comfy/client.ts)
  - 重写 [mcp/tools.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/tools.ts)（11 纯工具），同步 [mcp/server.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/server.ts)
  - 改 [main.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/main.ts)、[preload.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/preload.ts)、[global.d.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/global.d.ts)、[session.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/session.ts)
- B9 新增 T1–T8 测试 8 个文件（fs-sandbox / fs-archive / canvas-store / canvas-edges / gate-bridge / asset-index / comfy-settings / mcp-pure-tools）。
- 自检：`npm run typecheck` exit 0；`npm run test:run` 508 passed / 1 skipped。
- 测试基建调整：[vitest.config.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/vitest.config.ts) 设 `fileParallelism:false`——App 集成测试跨用例定时器收尾在并发调度下有竞态（非确定性，串行执行稳定），不属产品缺陷。
- 构建配置补记：[tsconfig.node.json](file:///Users/szd/Documents/Code/ai-shortdrama-studio/tsconfig.node.json) 补 `target: ES2020`（原 composite 项目缺 target，Set/Map 迭代无法编译）。

## 四、历史关系

- 本包实现 feature-016 总纲的第一块地基，不改变其任何已批准结论。
- 复用 feature-005 的写前归档语义、feature-008 的运行时错误 / server 壳机制；不重开既锁决策（opencode 1.18.34、loopback 控制面、随机内存口令、D-010 媒体终局）。
