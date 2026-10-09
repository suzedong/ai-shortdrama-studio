# SDG-RE 任务清单 · feature-017 画布基座与纯工具层

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 实现严格按 [SDG-RE-契约](./SDG-RE-契约.md) 推进；任务顺序 = 自底向上（写原语 → 存储 → 工具 → IPC → 测试闸）。

---

## A. 上下文加载清单（开始本任务前已逐项读取）

- [x] [AGENTS.md](file:///Users/szd/Documents/Code/ai-shortdrama-studio/AGENTS.md) 项目特化条款
- [x] [AI-SDG-AI工具执行指令.md](file:///Users/szd/Documents/Code/ai-shortdrama-studio/docs/governance/AI-SDG-AI工具执行指令.md) 全部条款
- [x] [feature-016 总纲五文件](file:///Users/szd/Documents/Code/ai-shortdrama-studio/docs/features/feature-016-架构重建总纲/SDG-RE-契约.md)（已批准，上游事实源）
- [x] [shared/types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/shared/types.ts)
- [x] [electron/session.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/session.ts)（写队列 / 归档 / 当前会话）
- [x] [electron/mcp/tools.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/tools.ts) + [server.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/mcp/server.ts)
- [x] [electron/main.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/main.ts) + [preload.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/preload.ts)
- [x] [electron/runtime/types.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/runtime/types.ts)（错误码）
- [x] [src/global.d.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/global.d.ts) + [vitest.config.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/vitest.config.ts)

## B. 原子任务

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| B1 | shared/types.ts 追加 7 新类型（逐字采用 016 §4.1） | types.ts 新增导出 | [x] |
| B2 | runtime/types.ts 追加 `PATH_ESCAPE_DENIED` `GATE_TIMEOUT` | RuntimeErrorCode 扩展 | [x] |
| B3 | 新建 fs/write-queue.ts（enqueue 单例）、fs/archive.ts（archiveExisting/archiveStamp）、fs/sandbox.ts（resolveInside） | electron/fs/* | [x] |
| B4 | session.ts 改为引用 fs/ 模块，删除内部私有 enqueue/archive 实现；对外导出与行为不变 | session.ts 重构 | [x] |
| B5 | 新建 project/current.ts（getActiveProjectDir） | electron/project/current.ts | [x] |
| B6 | 新建 canvas/edges.ts（deriveAutoEdges 纯函数） | electron/canvas/edges.ts | [x] |
| B7 | 新建 canvas/store.ts（CanvasStore + 单例：get/update/subscribe/reset） | electron/canvas/store.ts | [x] |
| B8 | 新建 gate/bridge.ts（request/decide/settleAll） | electron/gate/bridge.ts | [x] |
| B9 | 新建 asset/index.ts（register/list，asset-index.json） | electron/asset/index.ts | [x] |
| B10 | 新建 comfy/settings.ts（project.json 持久化 CRUD）、comfy/client.ts（接口 + holder） | electron/comfy/* | [x] |
| B11 | 重写 mcp/tools.ts 为 11 纯工具；改名 registerPureTools；server.ts 同步调用 | mcp/tools.ts、server.ts | [x] |
| B12 | main.ts 注册 8 新 handle + 订阅者集合 + canvas/gate 广播桥接；openProject 后 reset/settle | main.ts | [x] |
| B13 | preload.ts 暴露 canvas/gate/asset/settings；src/global.d.ts 补类型 | preload.ts、global.d.ts | [x] |
| B14 | 补齐 T1–T8 测试 | src/test/*、*.test.ts | [x] |
| B15 | 全量自检：`typecheck` / `test:run` 已通过；现有应用真机启动待验收 | 验证记录 | [~] |

## C. 关键检查点（实施中必须满足）

1. B4 抽取后，旧 session 相关测试（session-archive / session-workflow / session-finalized / background-archive）必须仍全绿——证明抽取是等价重构。
2. B11 完成后，tools.ts 不得 import ark/prompts/style-catalog/session（T8 静态断言兜底）。
3. B7/B8 的写入与门裁决全部走共享 enqueue；广播时机在落盘成功之后。
4. B12 不得删除 / 改名任何既有 handle 或 preload 键。
5. B1 shared 改动仅追加；不修改既有导出（K1 最小化，见契约 §6）。

## D. 验收（DoD，对齐 016 总纲 §D 地基适配版）

1. 工具层零 LLM（静态断言通过）。
2. 路径沙箱对越界一律 `PATH_ESCAPE_DENIED`；结果统一 {ok}。
3. Canvas 节点 / 边 upsert 幂等、自动边正确；`canvas:changed` 按写入完成顺序投递。
4. gate 单次运行内：request 挂起 ↔ decide 解除；关闭时 settleAll 无悬挂 Promise。
5. renderer 仍只经 window.api；无任何网络直连新增。
6. `npm run typecheck`、`npm run test:run` 全绿；现有应用旧功能无回归。
7. 未实现 018+ 范围内容（无 profile / 无业务 / 无 Comfy 真实网络）。

## E. 结束前自检

- [ ] 五文件齐备且与 016 契约无矛盾。
- [ ] 旧 IPC / 旧类型 / 旧 UI 全部保留并存。
- [ ] 新模块仅主进程可见，未在 renderer 被 import。
- [ ] 硬边界（八步 / 局域网 ComfyUI / 通道红线 / 零公网）逐条未被触碰。
