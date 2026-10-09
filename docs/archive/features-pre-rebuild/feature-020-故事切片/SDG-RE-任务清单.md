# SDG-RE 任务清单 · feature-020 垂直切片·故事（第 1 步）

> 状态：**v1.1 已完成**（C1-C10 全部完成；v1.1 补 C9 实施结果与任务勾选）
> 日期：2026-10-07
> 实施事实源：[SDG-RE-契约.md](./SDG-RE-契约.md)；条款编号与契约一致。

---

## A. 任务总览

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| C1 | showrunner.md 正文增补「第 1 步故事剧本」（恢复/task 委派 writer/1-a·1-b 门序/落 `故事/`/同 id 重开/不触媒体）；frontmatter 不动 | showrunner.md 修改 | [x] |
| C2 | CanvasBoard 多步分组：按 step 去重分组纵向堆叠、组内横向节点、跨组竖箭头、动态组标题、KIND_LABEL 补 outline/profiles | src/studio/CanvasBoard.tsx | [x] |
| C3 | StudioApp 标题改「短剧创作工作台」；ChatComposer 空态去"四道确认门"硬编码 | src/studio/* | [x] |
| C4 | 编排测试：brief done→进入故事→1-a（approved/rejected 同 id 重开）→1-b→汇报可入第 2 步；断言经 task 委派 writer、落 `故事/`、不触媒体、跨步骤 auto 边 | src/studio 测试 | [x] |
| C5 | renderer 测试：第 1 步节点分组渲染、跨组竖箭头、门卡 1-a/1-b、无单步硬编码、无引擎 import | src/studio 测试 | [x] |
| C6 | 自检：typecheck / test:run / build:electron 全绿 | 验证记录 | [x] |
| C7 | 真机验收（dev）：完整 1-a/1-b（含一次 rejected 同 id 重开），大纲/小传落盘、节点 done、0→1 连线 | 验收记录（变更记录） | [x] |
| C8 | 清理真机人造数据 | 工作区 | [x] |
| C9 | **门控清理（C6/C7 通过后）**：严格按契约 §8 白名单拆除 story:* IPC + 旧 App 故事编排 + buildGate1a/1b；保留只读展示；再自检 | 代码 + 变更记录 | [x] |
| C10 | 回写变更记录与任务勾选（v1.1） | SDG 文档 | [x] |

## B. 关键检查点（实施中必须满足）

1. C1 只改正文，frontmatter 与 feature-018 静态断言保持一致。
2. renderer 改动只落在 src/studio（C9 拆除旧壳除外）；不新增 IPC、不新增 MCP 工具。
3. 发送固定 `agent:'showrunner'`；renderer 不传 tools、不做业务 harness 判定。
4. 不修改 shared/types.ts（无 K1）；产物复用 StoryOutline / CharacterProfile。
5. 大纲/小传写作必须经 `task` 委派 writer；门只能由 showrunner 发起。
6. 落盘目录固定「故事/」；第 1 步不调用 comfyui/asset，不产生媒体。
7. C9 严格按白名单、只删故事链路，不触碰旧 App 第 0/2 步；清理前后各跑一次自检。

## C. 验收门槛

| 门槛 | 标准 |
|---|---|
| 编译 | `npm run typecheck` exit 0 |
| 单测/集成 | `npm run test:run` 全绿（测试只增不减；C9 删除的废弃编排用例除外，需登记） |
| 构建 | `npm run build:electron` 通过 |
| 架构 | renderer 无引擎/opencode import；编排测试确认 task 委派、门序与不触媒体 |
| 真机 | dev 应用完整 1-a/1-b（AC-10），人造数据已清理 |
| 清理 | 门控拆除后 typecheck/test/build 再绿，旧壳其余不回归（AC-11） |

## D. 验收标准与 AC 映射

| AC（需求 §5） | 覆盖任务 / 测试 |
|---|---|
| AC-1 进入故事 + task 委派大纲落盘 | C1、C4 |
| AC-2 1-a approved + auto 边 | C4、C5 |
| AC-3 1-a rejected 同 id 重开 | C4 |
| AC-4 人物小传 + 1-b | C4、C5 |
| AC-5 两门过后可入第 2 步、不自动执行 | C4 |
| AC-6 全程不触媒体 | C4 |
| AC-7 画布多步呈现 + 跨步骤衔接 | C2、C5 |
| AC-8 跨重启/回合恢复 | C4 |
| AC-9 编译/测试/构建 + 无引擎 import | C5、C6 |
| AC-10 真机两门 + 数据清理 | C7、C8 |
| AC-11 门控拆除 + 不回归 | C9 |

## E. 上下文加载清单（工作围栏）

- 必读：`AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`。
- 架构：feature-016 契约（§4.2/§5）；feature-018 契约；feature-019 契约 / OD / 任务清单。
- 既有：`electron/mcp/tools.ts`、`electron/runtime/provider.ts`、`electron/runtime/client.ts`、`electron/canvas/store.ts`、`electron/canvas/edges.ts`、`electron/gate/bridge.ts`、`resources/opencode/agents/showrunner.md`、`writer.md`、`shared/types.ts`（只读）。
- renderer：`src/studio/StudioApp.tsx`、`CanvasBoard.tsx`、`ChatComposer.tsx`、`GateCardView.tsx`；`src/App.tsx`、`src/lib/gates.tsx`（仅 C9 拆除时改）。

## F. 暂停 / 卡口

- 规格未签字 → 不实施（铁律 1）。
- C9 拆除旧故事链路触发 **K3**（旧系统弃用）→ 执行前在变更记录登记用户确认（本规格签字即视为授权该白名单）。
- 真机若发现 Agent 不按门序/不经 task 委派且 profile 正文强化无效 → 暂停升级，不在工具侧加业务逻辑。
- C9 任一删除导致旧壳其他阶段测试失败 → 回滚该删除并登记，不带病推进。
