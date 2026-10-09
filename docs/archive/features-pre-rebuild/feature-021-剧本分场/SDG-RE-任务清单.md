# SDG-RE 任务清单 · feature-021 垂直切片·剧本分场（第 2 步）

> 状态：**v1.1 已验收**
> 日期：2026-10-07
> 实施事实源：[SDG-RE-契约.md](./SDG-RE-契约.md)；条款编号与契约一致。

---

## A. 任务总览

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| C1 | showrunner.md 正文增补「第 2 步剧本分场剧本」（恢复/前置校验/task 委派 writer/2-a·2-b 门序/落 `剧本/`/同 id 重开/不触媒体/不自动进第 3 步）；frontmatter 不动 | showrunner.md 修改 | [x] |
| C2 | writer.md「产物结构」节内嵌 Scene / DialogueScene / DialogueLine 完整 schema 字段明细（ep/sceneNo/slug/interiorExterior/dayNight/location/characterIds/beats/emotion/estSeconds/summary；speakerId/speakerName/kind/text/emotion/action），要求字段恰好、id 引用小传、场号引用分场 | writer.md 修改 | [x] |
| C3 | CanvasBoard 增量：KIND_LABEL 补 scenes/dialogue，STEP_LABEL 补 `'2'→剧本分场`；分组/跨组箭头逻辑不动 | src/studio/CanvasBoard.tsx | [x] |
| C4 | 编排测试：故事定稿→进入第 2 步→2-a（approved/rejected 同 id 重开）→2-b→汇报可入第 3 步；断言经 task 委派 writer、落 `剧本/`、角色/场号主键引用、不触媒体、1→2 跨步骤 auto 边 | src/studio 测试 | [x] |
| C5 | renderer 测试：第 2 步节点归入第 3 分组、1/2 组间竖箭头、门卡 2-a/2-b、无单步硬编码、无引擎 import | src/studio 测试 | [x] |
| C6 | 自检：typecheck / test:run / build:electron 全绿 | 验证记录 | [x] |
| C7 | 真机验收（dev）：完整 2-a/2-b（含一次 rejected 同 id 重开），分场/台词落盘、节点 done、1→2 连线 | 验收记录（变更记录） | [x] |
| C8 | 清理真机人造数据 | 工作区 | [x] |
| C9 | **门控清理（C6/C7 通过后）**：严格按契约 §8 白名单拆除 script:* IPC + 旧 App 剧本编排（含 2-c）+ buildGate2a/2b/2c；保留只读展示与 scriptRedo 底层字段；再自检 | 代码 + 变更记录 | [x] |
| C10 | 回写变更记录与任务勾选（v1.1） | SDG 文档 | [x] |

## B. 关键检查点（实施中必须满足）

1. C1 只改正文，frontmatter 与既有静态断言保持一致。
2. renderer 改动只落在 src/studio（C9 拆除旧壳除外）；不新增 IPC、不新增 MCP 工具。
3. 发送固定 `agent:'showrunner'`；renderer 不传 tools、不做业务 harness 判定。
4. 不修改 shared/types.ts（无 K1）；产物复用 SceneBreakdown / DialogueScript。
5. 分场/台词写作必须经 `task` 委派 writer；门只能由 showrunner 发起。
6. 落盘目录固定「剧本/」；本切片只做 ep=1；第 2 步不调用 comfyui/asset，不产生媒体、不产出分镜。
7. C9 严格按白名单、只删剧本链路（含 2-c），不触碰旧 App 第 0/1 步；清理前后各跑一次自检。

## C. 验收门槛

| 门槛 | 标准 |
|---|---|
| 编译 | `npm run typecheck` exit 0 |
| 单测/集成 | `npm run test:run` 全绿（测试只增不减；C9 删除的废弃编排用例除外，需登记） |
| 构建 | `npm run build:electron` 通过 |
| 架构 | renderer 无引擎/opencode import；编排测试确认 task 委派、门序、主键引用与不触媒体 |
| 真机 | dev 应用完整 2-a/2-b（AC-10），人造数据已清理 |
| 清理 | 门控拆除后 typecheck/test/build 再绿，旧壳其余不回归（AC-11） |

## D. 验收标准与 AC 映射

| AC（需求 §5） | 覆盖任务 / 测试 |
|---|---|
| AC-1 进入第 2 步 + task 委派分场落盘 | C1、C4 |
| AC-2 2-a approved + 1→2 auto 边 | C4、C5 |
| AC-3 2-a rejected 同 id 重开 | C4 |
| AC-4 台词 + 2-b | C2、C4、C5 |
| AC-5 两门过后可入第 3 步、不自动执行 | C4 |
| AC-6 全程不触媒体 | C4 |
| AC-7 画布三步呈现 + 跨步骤衔接 | C3、C5 |
| AC-8 跨重启/回合恢复 | C4 |
| AC-9 编译/测试/构建 + 无引擎 import | C5、C6 |
| AC-10 真机两门 + 数据清理 | C7、C8 |
| AC-11 门控拆除 + 不回归 | C9 |

## E. 上下文加载清单（工作围栏）

- 必读：`AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`。
- 架构：feature-016 契约（§4.2/§5）；feature-019 契约 / OD / 任务清单；feature-020 契约 / OD / 任务清单。
- 既有：`electron/mcp/tools.ts`、`electron/runtime/provider.ts`、`electron/runtime/client.ts`、`electron/canvas/store.ts`、`electron/canvas/edges.ts`、`electron/gate/bridge.ts`、`resources/opencode/agents/showrunner.md`、`writer.md`、`shared/types.ts`（只读）。
- renderer：`src/studio/StudioApp.tsx`、`CanvasBoard.tsx`、`ChatComposer.tsx`、`GateCardView.tsx`；`src/App.tsx`、`src/lib/gates.tsx`（仅 C9 拆除时改）。

## F. 暂停 / 卡口

- 规格未签字 → 不实施（铁律 1）。
- C9 拆除旧剧本链路触发 **K3**（旧系统弃用）→ 执行前在变更记录登记用户确认（本规格签字即视为授权该白名单）。
- 真机若发现 Agent 不按门序/不经 task 委派且 profile 正文强化无效 → 暂停升级，不在工具侧加业务逻辑。
- C9 任一删除导致旧壳其他阶段测试失败 → 回滚该删除并登记，不带病推进。
