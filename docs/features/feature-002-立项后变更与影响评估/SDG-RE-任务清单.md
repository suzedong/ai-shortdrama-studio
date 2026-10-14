# feature-002 立项后变更与影响评估 · 任务清单

> 前置：K1（契约 §1）+ K8（契约 §4）经用户显式批准。未批准不执行 T1。
>
> 顺序约束：T1 先行（类型）；T2–T5 可在类型上并行；T6 集成依赖 T2–T5；T7/T8 可与 T6 并行；T9 回归收尾最后。

## 0. 上下文加载清单（工作围栏）

- 事实源：设计书 §2.6.6/§2.6.7/§7.1；[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)、[设计说明](./SDG-OD-设计说明.md)。
- 决策：D-011、D-013-4（决策台账）；本包 D-001/D-002 卡口记录。
- 改动面白名单：
  - `shared/types.ts`（仅契约 §1 三处字段 + 两条注释）
  - `electron/brief/impact.ts`（新）、`electron/brief/publish.ts`（新）
  - `electron/brief/plan.ts`（只读复用，预期零改；如需微调仅限导出）
  - `electron/project/library.ts`、`electron/project/manifest.ts`
  - `electron/canvas/store.ts`、`electron/canvas/edges.ts`（仅类型传导）
  - `electron/mcp/tools.ts`、`electron/runtime/provider.ts`
  - `resources/opencode/agents/showrunner.md`
  - `src/studio/CanvasBoard.tsx`、`src/studio/StageNavPanel.tsx`
  - 测试：`src/test/brief-impact.test.ts`（新）、`src/test/mcp-brief-impact-tools.test.ts`（新）、canvas-store.test.ts、agent-profiles.test.ts、mcp-pure-tools*、runtime-client*、runtime-integration*、既有 brief/mcp-brief 测试按 §7 影响面最小增补
- 红线：不碰 writer.md / media-director.md / comfyui-operator.md；不碰 gate、comfy、asset、style 模块逻辑；不新增 IPC/preload；不改立项单 schema 与 diff 比较范围；不升 Canvas schemaVersion。

## 1. 原子任务

### ✅ T1 · K1 类型落地（shared/types.ts）

- `ProjectManifest` + `briefVersion: number | null`（注释）。
- 新增 `CanvasParentReference`、`CanvasDirty` 接口；`CanvasNode` +两可选字段及注释。
- 更新 L280（RevisionSource）、L288（UnlockData.downstream）两条注释为 002 落地后的事实陈述；不改类型形状。
- 完成标准：`tsc -b tsconfig.node.json` 不新增错误；此处先不补 electron 侧实现（编译允许 undefined 可选字段）。

### ✅ T2 · 影响评估纯函数（electron/brief/impact.ts，新）

- 本地类型（契约 §1.3）+ HIGH/MEDIUM 字段常量表 + `classifyField` / `classifyChanges` / `assessImpact`（契约 §2）。
- 新建 `src/test/brief-impact.test.ts`：§9.1 全分支。
- 完成标准：纯函数零 fs/electron import；新套件全绿。

### ✅ T3 · manifest 指针（library.ts / manifest.ts）

- createProject 初始档 +`briefVersion:null`。
- parseManifest 旧档读默认 null（写回带字段）。
- 导出纯 mutate helper `applyBriefVersion(m, n, now): PersistedManifest`（updatedAt 刷新，不动 status/statusHistory）。
- 完成标准：旧档夹具测试（无该字段读取不报错）；createProject 测试同步；801 既有测试不破坏。

### ✅ T4 · 画布血缘与脏态（store.ts / edges.ts / tools.ts canvas.update）

- CanvasUpsertNode 自动继承两可选字段；store.update 字段保留语义（设计 §5.3）。
- canvas.update zod +`parentReference`（不加 dirty）；确认 zod 剥离 dirty 并加测试。
- 给 store 增加供 commit 使用的画布批量变更入口（`withCanvas` 内部方法或等价窄接口），保证 commit 全节点挂脏 + brief 节点 upsert 单次 persist。
- canvas-store.test.ts 增补：保留/覆盖/新节点/剥离 dirty 四用例。
- 完成标准：既有 canvas 测试全绿。

### ✅ T5 · publish 主体抽离（electron/brief/publish.ts，新）

- 从 tools.ts brief.publish handler 抽出共享主体（契约 §3.3 / 设计 §4）：
  - 版本扫描分配、双写防覆盖、立项单对象形状、brief 节点 upsert patch 返回；
  - 主体不自开 enqueue（由外层 handler 包队列）；v1 handler 行为/返回逐字不变，仅在其队列内追加 manifest briefVersion=1 写盘（applyBriefVersion）。
- 完成标准：mcp-brief-tools.test.ts 既有用例零改动通过 + 新增 briefVersion===1 断言；v1 返回形状快照不变。

### ✅ T6 · MCP 三工具注册（tools.ts，20–22）

- BriefDraft zod 抽共享常量供 plan/publish/assess/commit 复用。
- `brief.impact.assess`（契约 §4.1）；`brief.impact.commit`（§4.2，单次 enqueue 内：闸门→复算→决策校验→publish 主体→影响清单写盘→applyBriefVersion→画布单次 persist 挂脏+brief 节点）；`canvas.align`（§4.3）。
- 头注释 19→22；三个新错误码（BRIEF_NO_BASELINE / IMPACT_DECISION_MISMATCH / CANVAS_NODE_NOT_FOUND）。
- provider.ts showrunner allow +3（14→17）。
- 新建 `src/test/mcp-brief-impact-tools.test.ts`：§9.2 全部场景。
- 同步静态契约：agent-profiles.test.ts（17 键）、mcp-pure-tools（22）、runtime-client、runtime-integration 计数与名单。
- 完成标准：相关套件全绿；错误信封/中文 message 可操作。

### ✅ T7 · showrunner 纪律（showrunner.md）

- frontmatter tools true + permissions allow 各 +3（物理名保留点号，键序在 style 三工具后）。
- 正文：再版工作流五步、三选一处理、commit 后 regenerate 队列串行委派 + 定稿 align；定稿 parentReference 字段表（契约 §5）；脏读警告与委派交接物纪律；再版不调 manifest.advance。
- 完成标准：agent-profiles 静态测试通过（与 T6 联动）。

### ✅ T8 · renderer 最小标识（CanvasBoard / StageNavPanel）

- field→中文名常量；脏节点黄 ⚠️ + title hover（不灰显、不加红、不碰 invalidated 分支）。
- StageNavPanel STAGE 0：brief 节点 meta.version + 全画布 dirty 计数 → `✓ vN` / `vN ⚠️k`。
- CanvasBoard 顶部纯文本黄条（无按钮）。
- 完成标准：typecheck 不新增（基线 7 不扩大）；studio-flow 既存失败数不增加；能加轻断言则加（契约 §9.5）。

### ✅ T9 · 全量回归与治理收尾

- `npm run typecheck`、`tsc -b tsconfig.node.json`、`tsc -p tsconfig.preload.json`；`npm run test:run` 全量。
- 红线：typecheck 7 不增；302 passed / 7 skipped / 12 failed 不扩大（本包净增断言计入 passed）。
- 治理：features/README 002 行状态更新（K1/K8/工具数 22/showrunner 17）；偏差清单 B-03 标 ✅ 并记名两处形态差异（影响清单路径/文件名、manifest.nodes→CanvasNode）；feature-001/801 变更记录加交叉指针；本包变更记录回填实施记录与登记（错误码 3 个、工具 19→22、白名单 14→17）。
- **结果（2026-10-14）**：全量 **353 passed / 7 skipped / 12 failed**（对照基线 302/7/12，净增 51 passed、failed 零扩大）；typecheck 7 持平（本包净新增 0，T6 两处测试夹具类型修复后回到基线）；node/preload tsc 零错误；canvas-board 套件 23/23（新增 5 轻断言）。治理五项全部完成（README、偏差清单 B-03、001/801 交叉指针、本包变更记录 R-001~R-004、设计说明 §9 实施补记）。包闭环。

## 2. 产出物清单

| 类型 | 路径 |
|---|---|
| K1 类型 | shared/types.ts |
| 新模块 | electron/brief/impact.ts、electron/brief/publish.ts |
| 改动 | library.ts、manifest.ts、store.ts、edges.ts、tools.ts、provider.ts |
| Agent | resources/opencode/agents/showrunner.md |
| renderer | src/studio/CanvasBoard.tsx、src/studio/StageNavPanel.tsx |
| 新测试 | src/test/brief-impact.test.ts、src/test/mcp-brief-impact-tools.test.ts |
| 测试增补 | canvas-store.test.ts、agent-profiles.test.ts、mcp-pure-tools*、runtime-client*、runtime-integration*、mcp-brief-tools.test.ts、library/manifest 既测 |
| 治理 | docs/features/README.md、docs/设计现状与偏差清单.md、001/801 变更记录、本包 SDG-AI-变更记录.md |

## 3. 不做（防止越界）

- 不做弹窗面板/一键对齐按钮/IPC；不做产物内部 parentReference；不做 STAGE 1–7 重生成编排与执行；不扩 RevisionSource/UnlockData；不做 30 天漂移提醒；不写清单 md；不改立项单 schema/diff 范围；不升 canvas schemaVersion；不动其他 agent 纪律文件；不改打包配置。
