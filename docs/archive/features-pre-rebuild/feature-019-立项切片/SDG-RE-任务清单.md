# SDG-RE 任务清单 · feature-019 垂直切片·立项（第 0 步）

> 状态：**v1.1 实施完成**（2026-10-07；门语义 K8 裁决见决策台账 D-004）
> 日期：2026-10-07
> 实施事实源：[SDG-RE-契约.md](./SDG-RE-契约.md)；条款编号与契约一致。

---

## A. 任务总览（自底向上）

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| C1 | showrunner.md 正文增补「第 0 步立项剧本」（门序/落盘/挂节点/重试/不触媒体）；frontmatter 不动 | showrunner.md 修改 | [x] |
| C2 | 新建 src/studio 容器：RootSwitch + StudioApp + 订阅（canvas/gate/runtime）与 ErrorBoundary | src/studio/* | [x] |
| C3 | CanvasBoard：渲染 Canvas nodes/edges（step 0），节点状态数据驱动 | src/studio/* | [x] |
| C4 | ChatComposer：输入 + 流式文本 + GateCard（字段取自 CanvasGate）+ gate.decide | src/studio/* | [x] |
| C5 | main.tsx 挂 RootSwitch（默认 studio，可切 legacy）；旧 App 保持原样 | main.tsx 修改 | [x] |
| C6 | 编排测试：四门顺序 / rejected 同 id 重试 / 0-c 不触媒体 / brief 落盘 + 节点 done+auto 边 / 恢复续跑 | src/studio 测试 | [x] |
| C7 | renderer 测试：发送→流式→GateCard→裁决→画布更新；新旧切换；ErrorBoundary；架构断言（无引擎 import） | src/studio 测试 | [x] |
| C8 | 自检：typecheck / test:run / build:electron 全绿 | 验证记录 | [x] |
| C9 | 真机验收：dev 下跑完整立项四门，brief 落盘、画布 done、自动连线 | 验收记录（见变更记录 §五） | [x] |
| C10 | **门控清理（C8/C9 通过后执行）**：删 idea:save/diagnosis:save + saveIdea/saveDiagnosis 键 + 旧 App 调用点；再自检 | 代码 + 变更记录 | [x] |
| C11 | 回写变更记录与任务勾选（v1.1） | SDG 文档 | [x] |

## B. 关键检查点（实施中必须满足）

1. C1 只改正文，frontmatter 与 feature-018 T1 静态断言保持一致。
2. C2–C5 全部新增落在 src/studio（main.tsx 除外），不改旧 App / 旧 lib / 旧 components。
3. 不新增 IPC、不改 MCP 工具；renderer 只用契约 §1-3 列举的既有 window.api。
4. 发送必须 `agent:'showrunner'`；renderer 不传 tools、不做业务 harness 判定。
5. 不修改 shared/types.ts（本包无 K1）；产物复用既有 schema。
6. C10 严格按清理白名单 4 项，不扩散；清理前后各跑一次自检。
7. 第 0 步不出现 task / comfyui / asset 调用；0-c 不出图。

## C. 验收门槛

| 门槛 | 标准 |
|---|---|
| 编译 | `npm run typecheck` exit 0 |
| 单测/集成 | `npm run test:run` 全绿（测试只增不减） |
| 构建 | `npm run build:electron` 通过 |
| 架构 | renderer 新代码无引擎/opencode import；编排测试确认门序与不触媒体 |
| 真机 | dev 应用完整四门（AC-7），人造数据已清理 |
| 清理 | 门控删除后 typecheck/test 再绿（AC-8） |

## D. 验收标准与 AC 映射

| AC（需求 §5） | 覆盖任务 / 测试 |
|---|---|
| AC-1 端到端编排 | C1、C6 |
| AC-2 renderer 驱动与不直连 | C2–C5、C7 |
| AC-3 门纪律（四门/同 id 重试/不触媒） | C6 |
| AC-4 恢复续跑 | C6 |
| AC-5 ErrorBoundary | C2、C7 |
| AC-6 旧壳并存不回归 | C5、C7、C8 |
| AC-7 真机四门 | C9 |
| AC-8 清理门控 | C10 |

## E. 上下文加载清单（工作围栏）

- 必读：`AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`。
- 架构：feature-016 契约 / OD（§6/§7）/ 任务清单；feature-018 契约 / OD。
- 既有：`electron/mcp/tools.ts`、`electron/runtime/client.ts`、`electron/canvas/store.ts`、`electron/gate/bridge.ts`、`electron/main.ts`、`electron/preload.ts`、`resources/opencode/agents/showrunner.md`、`shared/types.ts`（只读）。
- renderer：`src/App.tsx`（只读参照）、`src/main.tsx`、`src/global.d.ts`、`src/lib/chat-runtime.ts`。

## F. 暂停 / 卡口

- 规格未签字 → 不实施（铁律 1）。
- 真机若发现 Agent 偏离门序且 profile 正文强化无效 → 暂停，升级用户（不在工具侧加业务逻辑）。
- C10 任一删除导致旧壳故事/剧本测试失败 → 回滚删除并登记，不带病推进。
