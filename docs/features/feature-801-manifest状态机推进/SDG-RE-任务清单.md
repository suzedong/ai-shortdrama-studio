# feature-801 manifest 状态机推进 · 任务清单

> 执行依据：[需求规格](./SDG-RE-需求规格.md) + [契约](./SDG-RE-契约.md)。任务按顺序执行；每项给出改动面与自验方式。
>
> 卡口：本包修改 `shared/types.ts`（K1 共享层：新增 manifest 4 类型、删除 `Stage`、改 `UnlockData.downstream`）。**字段方案见契约 §6，须用户在 K1 卡口显式批准后方可执行 T1 及任何代码改动；批准留痕填入 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md) D-001。**

## 0. 上下文加载清单（工作围栏）

- [x] `AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`
- [x] `短剧Agent平台设计.md` §7.1（L546–596）
- [x] 本包 `SDG-RE-需求规格.md` / `SDG-RE-契约.md`
- [x] `shared/types.ts`（全文，重点 L1–9 Stage、L205–259 GateId/RevisionSource/UnlockData、L286–329 画布模型）
- [x] `electron/project/library.ts`（createProject / initialNodes / listProjects 对 manifest 的读法）
- [x] `electron/project/current.ts`（getActiveProjectDir / NO_ACTIVE_PROJECT）
- [x] `electron/mcp/tools.ts`（工具注册骨架、fail/normalize/respond、brief 工具的 enqueue 写法）
- [x] `electron/fs/write-queue.ts`、`electron/fs/archive.ts`、`electron/fs/sandbox.ts`（只读参照：enqueue 复用；不归档）
- [x] `electron/runtime/provider.ts`（SHOWRUNNER_DECLARED_TOOLS 白名单机制）
- [x] `resources/opencode/agents/showrunner.md`（4 道门位置 + publish 收尾 + 各步恢复段）
- [x] feature-001 五文件（模板与先例：provider 白名单补登 D 记录、契约 §3.2 第 7 条）
- [x] 现有测试布局：`src/test/`、`src/studio/*-orchestration.test.ts`、agent-profiles / runtime-client / runtime-integration 静态与白名单测试

围栏外文件不动（gate/bridge、canvas/store、runtime 投影 projection.ts、main.ts、preload、renderer 全部 studio/components 组件——除删除 StageCanvas 外——均零改动）。

## 1. 原子任务

### T1 · 共享层类型落地（K1，批准后执行）✅ 2026-10-13
- 改 [shared/types.ts](../../../shared/types.ts)：
  - 新增 `ManifestStatus` / `ManifestEvent` / `ManifestTick` / `ProjectManifest`（契约 §1）。
  - 删除 `Stage` 联合及其 L3–4 历史注释。
  - `UnlockData.downstream: Stage[]` → `string[]`，注释按契约 §6 改写。
- 自验：`npm run typecheck` + `npx tsc -b tsconfig.node.json`；按报错清单只处理 initialNodes（T2 联动）与 StageCanvas（T5）两个断点，不扩散修改。
- AC：契约 §6 表逐行落实；全仓无 `Stage` 类型引用。

### T2 · manifest 读写与状态机模块 ✅ 2026-10-13
- 新增 `electron/project/manifest.ts`：`MANIFEST_TRANSITIONS`、`advanceStatus()`（契约 §2）、`parseManifest()`（§5）、`readManifest()` / `writeManifest()` / `advanceManifest()`（§4）。
- 改 [library.ts](../../../electron/project/library.ts)：删 `initialNodes()` 与 `Stage/NodeStatus` import；createProject 的 manifest 字面量改为 `ProjectManifest` 形状（`status:'initiating' / createdAt / workflowVersion:1 / updatedAt:同 createdAt / statusHistory:[]`），删除 phase/nodes/pendingGate/redoGate/storyRedo/scriptRedo/activeUnlock/activeDraft/feOverride/preflight/saved 11 个骨架字段。listProjects 的 `Record<string,unknown>` 读法不动（仍只取 createdAt）。
- 自验：新增 `src/test/manifest-state.test.ts`：跃迁表 6 正向、6 幂等、乱序 ≥6 例、terminal、全链顺序；parseManifest 容错 4 例（新形状直读 / 旧骨架补默认+留未知字段 / 非法 status / history 脏项过滤）。
- AC：AC1、AC4、AC6、AC7。

### T3 · MCP 工具注册（14 → 16）✅ 2026-10-13
- 改 [tools.ts](../../../electron/mcp/tools.ts)：文件头注释 14 → 16、六族→七族（manifest 族）；import `readManifest/advanceManifest` 与 `ManifestEvent` 类型；注册：
  - `manifest.get`：`{}` 入参，返回 `{manifest}`，异常走 normalize。
  - `manifest.advance`：zod `event: z.enum([...6 事件])`；enqueue 内调 `advanceManifest`；按返回 `advanced/reason` 组装成功/幂等返回；`bad-transition` → `MANIFEST_BAD_TRANSITION`、`terminal` → `MANIFEST_TERMINAL`（模块内 throw 带 code 或在工具层映射，二选一，保持与既有 fail 风格一致）；不碰 canvas、不归档。
- 自验：新增/扩展纯工具测试：get 返回形状；advance 五事件落盘（读回 status/tick/updatedAt/statusHistory 长度）；bad-transition 与 terminal 后文件内容不变（写队列调用计数为 0 或直接断言读回相等）；already-there 不追加 tick 不重写；无激活项目 NO_ACTIVE_PROJECT；zod 非法 event 被拒。
- AC：AC2、AC4、AC5、AC6。

### T4 · runtime 白名单补登（围栏外最小必要改动，同 feature-001 T5 先例）✅ 2026-10-13
- 改 [provider.ts](../../../electron/runtime/provider.ts)：`SHOWRUNNER_DECLARED_TOOLS` 追加 `shortdrama_manifest.get`、`shortdrama_manifest.advance`（showrunner 集合 9 → 11）；不改判定函数签名、不扩 director/writer 等其他 agent 集合。
- 同步 agent-profiles 静态测试（点号物理键白名单断言）与 runtime-client/runtime-integration 中 showrunner 工具清单期望（11 个）。
- 自验：相关测试绿；showrunner 调 manifest.* 不被请求级白名单拦截。
- AC：工具对 showrunner 可达；AC9 的前置。

### T5 · 历史 Stage 清退 ✅ 2026-10-13
- 删除 [src/components/StageCanvas.tsx](../../../src/components/StageCanvas.tsx)（删除前最后一次全仓 grep 确认零 import：文件名 + 组件名双查）。
- 全仓 grep 复核：`\bStage\b`（ts/tsx）、`StageCanvas`、`initialNodes` 均无生产残留（文档命中允许）。
- 自验：typecheck / tsc -b 零新增错误；测试运行面无引用缺失。
- AC：AC8。

### T6 · showrunner.md 定稿动作 ✅ 2026-10-13
- 改 [showrunner.md](../../../resources/opencode/agents/showrunner.md)：
  - frontmatter tools + permission 各加两行（`shortdrama_manifest.get/advance`，allow）。
  - 职责纪律新增「状态机纪律」条（契约 §7：定稿才推进、门未 approved 不调、不自造事件名、already-there 正常、bad-transition/terminal 必须报告）。
  - 第 0 步第 8 条：publish 返回 `version===1` 后调 `brief-published`；明示 v2+ 不调。
  - 第 1 步 1-a 收尾、第 5 条 1-b 收尾、第 2 步第 4 条 2-a 收尾、第 6 条 2-b 收尾：各加对应事件 advance 调用（契约 §7 表）。
  - 第 2 步结尾加 2-c / `storyboard-finalized` 预留语（feature-201 激活，当前不产分镜不调用）。
  - 三步「回合开始先恢复」段：canvas_get 之外加 manifest.get，并给出 status → 续跑位置对照（initiating=立项未完；story-outline=待大纲；story-profiles=待小传；script-scenes=待分场；script-dialogue=待台词；script-storyboard=分镜文字稿待 201；storyboard-done=STAGE 0-2 全定稿）。
- 自验：全文 grep 六事件名各出现且仅出现在指定位置；无自造第七事件；2-c 仅在预留语境。
- AC：AC3、AC9。

### T7 · 编排测试同步 ✅ 2026-10-13（全量 249 passed / 7 skipped / 12 failed；12 失败经 HEAD 对照均为基线既有，本包零扩大，详见本包变更记录二）
- 扩展 `src/studio/orchestration.test.ts`（或 STAGE 0-2 既有编排测试，按现布局）：脚本化 fake 中补 manifest.advance 工具桩，断言顺序——publish(v1) 后 `brief-published`；1-a approved 后 `outline-approved`；依次至 2-b 后 `dialogue-approved`；门 rejected 路径零 advance；publish v2 场景不产生第二次 brief-published（或工具幂等 already-there 断言其一）。
- 若现有测试对 showrunner 工具数/白名单有断言，同步 9→11。
- 自验：`npm run test:run` 全量；与基线对比失败面（基线：222 passed / 1 skipped / 11 failed 均为 HEAD 既有——studio-flow 10 + architecture「无 comfyui 字样」1），本包不得扩大。
- AC：AC2、AC3、AC8。

### T8 · 治理文档收尾 ✅ 2026-10-13
- [features/README.md](../../README.md)：801 行状态改 ✅ 已落地（日期），技术落点补「electron/project/manifest.ts、16 工具、Stage 清退」；§2「画布（…StageCanvas.tsx，Stage 10 态）」一条删 StageCanvas 与 Stage 措辞（改述为 canvas.json 节点模型）。
- [设计现状与偏差清单.md](../../设计现状与偏差清单.md)：B-04 标 ✅（附本包链接）；渲染器清单中 StageCanvas 一项删除。
- feature-001 变更记录「三、修订记录」加一条交叉指针（契约 §11 的联动修订），本包实施记录同步登记。
- 本包 `SDG-AI-变更记录.md`：回填 D-001 批准方式、实施记录闭环。
- AC：导航文档与磁盘实况一致。

## 2. 产出物清单

| 产出 | 位置 | 状态 |
|---|---|---|
| manifest 类型（4 新增 / Stage 删除 / UnlockData 改） | `shared/types.ts` | ✅（K1 已批准，2026-10-13） |
| 状态机读写模块 | `electron/project/manifest.ts`（新增）；`library.ts`（改） | ✅ |
| MCP 工具 ×2 | `electron/mcp/tools.ts`（manifest.get/advance，16 工具） | ✅ |
| runtime 白名单 | `electron/runtime/provider.ts`（9 → 11） | ✅ |
| 历史清退 | 删 `src/components/StageCanvas.tsx` | ✅ |
| Agent 提示词 | `resources/opencode/agents/showrunner.md` | ✅ |
| 测试 | manifest-state 21 例（新增）+ mcp-manifest-tools 8 例 + 编排断言 5 例 + 白名单静态测试同步 | ✅ |
| 治理文档 | features/README、偏差清单 B-04/B-09、本包与 feature-001 两份变更记录 | ✅ |

## 3. 不做（防止越界）

- 不动 gate 机制、canvas store、runtime 事件投影（projection/SSE）、main.ts、preload、IPC、renderer 任何组件（仅删 StageCanvas）。
- 不实现事件订阅自动推进；不做 manifest.status 的任何 UI 消费。
- 不实现 STAGE 3-7 状态、不产分镜文字稿、不建 2-c 门动作（仅机制与提示词预留）。
- 不做 feature-002：不写 briefVersion/parentReference/影响清单/CanvasNode.dirty；不改 brief.publish 代码。
- 不迁移/不重写旧项目 manifest（读兼容、写保留未知字段）；不清理根目录 mcp/server.ts 占位 mock。
