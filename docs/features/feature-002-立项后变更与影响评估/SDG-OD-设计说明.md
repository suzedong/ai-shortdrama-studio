# feature-002 立项后变更与影响评估 · 设计说明

> 本篇只描述代码层面的结构决策与影响面；业务语义与接口形状以 [契约](./SDG-RE-契约.md) 为准。

## 1. UI 改动面

仅 renderer 三处最小标识，无新页面、无弹窗、无路由：

1. [CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx) 节点卡标题行：`node.dirty` 存在时在 `meta.version` 文本旁渲染黄色 ⚠️（内联 title hover）；不触碰既有 `invalidated → opacity-60` 分支（约 L657），两态样式独立。
2. [StageNavPanel.tsx](../../../src/studio/StageNavPanel.tsx) STAGE 0 badge：从仅显示 `meta.version` 扩展为 `✓ vN`（绿，全对齐）/ `vN ⚠️k`（黄，k=全画布 dirty 计数）；复用既有黄 chip 色值。
3. CanvasBoard 顶部纯文本脏读黄条（条件：画布任一节点 dirty；无按钮）。

不建影响评估弹窗（三选一走对话，见需求 §4.2）；不加 IPC、不动 preload。

## 2. 不新增视觉资产

零图片 / 零图标文件；⚠️ 用 Unicode 字符与现有色值。

## 3. 不新增 IPC / preload

三工具全部是 MCP（主进程 ↔ Agent），renderer 不调用。renderer 所需数据全部已在 canvas 订阅流（StudioApp 既有 canvas IPC 返回 Canvas 全量）；manifest.briefVersion 不新增 renderer 数据源——导航版本号取值优先级：brief 节点 `meta.version`（现状数据源），脏计数直接数 canvas.dirty 节点。设计取舍：`vN` 显示与现状同源不引新通道；dirty 节点内 `latestBriefVersion` 供黄条文案。

## 4. 模块架构

```
shared/types.ts                         [K1]
  + CanvasParentReference / CanvasDirty（CanvasNode 两可选字段）
  + ProjectManifest.briefVersion: number | null
  注释更新：L280 RevisionSource、L288 UnlockData.downstream

electron/brief/impact.ts         [新]   纯函数 + electron 本地类型
  classifyField / classifyChanges / assessImpact
  ImpactSeverity / ImpactItem / ImpactAssessment / ImpactReportFile / ImpactDecision

electron/brief/publish.ts        [新]   从 tools.ts 抽出的立项单发布共享主体
  publishBriefVersion(projectDir, draft, approve, version, prev)
    → 队列内：双写 json/md + 防覆盖 + step-0-brief 节点 upsert
    → 返回 {version, jsonPath, mdPath, changesFromPrevious, canvas}
  （v1 handler 与 impact.commit handler 共用；谱系装载/就绪判定留在 handler 层）

electron/brief/plan.ts            [改]  无行为改动（assess 直接复用 diff/listVersions）
electron/project/library.ts       [改]  createProject 初始 manifest +briefVersion:null
electron/project/manifest.ts      [改]  parseManifest 缺字段默认 null；
                                        新增 setBriefVersion(dir, n)（enqueue 读-改-写，不动 statusHistory）
electron/canvas/store.ts          [改]  update 替换节点时保留旧 dirty/parentReference（契约 §4.4）；
                                        新增 markDirty(nodeId, dirty) / alignNode(nodeId, targetVersion)
                                        两个窄方法（内部读-改-写，供 commit/align handler 调用）
electron/canvas/edges.ts          [改]  CanvasUpsertNode 随 CanvasNode 类型自动获得两字段
electron/mcp/tools.ts             [改]  注册 20–22；canvas.update zod +parentReference；
                                        BriefDraft zod 抽共享常量；头注释 19→22
electron/runtime/provider.ts      [改]  showrunner allow +3
resources/opencode/agents/showrunner.md [改] frontmatter 两处 +3；再版工作流/定稿血缘/脏读纪律段

src/studio/CanvasBoard.tsx        [改]  脏角标 + 黄条
src/studio/StageNavPanel.tsx      [改]  ✓vN / vN⚠️k
```

## 5. 关键算法

### 5.1 assessImpact（纯）

实现即契约 §2.3 五步伪代码的直译；字段级别表在 impact.ts 顶部以常量声明（HIGH_FIELDS:Set、MEDIUM_FIELDS:Set），与 §2.1 表一一对应，测试逐字段锁死。hit 交集输出顺序按 HIGH→MEDIUM 表内顺序（稳定、可快照）。

### 5.2 commit 的队列内编排

一次 `enqueue` 内顺序：listVersions/读 prev → 复算 assess → decisions 校验 → publishBriefVersion（内部不再二次 enqueue：共享主体接受“已在队列中”的调用形式——设计为 publish 主体**不自开 enqueue**，由两个 handler 各自包 enqueue，避免嵌套队列）→ 写影响清单 → setBriefVersion（同队列直接读改写，不再走其公开入队方法；故 setBriefVersion 实现为 `withManifest` 风格的内部 mutate 或接受外部队列上下文——编码取最简：在 commit handler 队列闭包内直接 readManifestRaw/writeManifest，manifest.ts 导出纯 mutate helper `applyBriefVersion(m, n, now)`）→ 逐节点 markDirty（直接操作 canvasStore 缓存 + 一次 persist：commit 内节点挂脏合并为**一次 canvas 写盘**——实现上给 canvasStore 增加 `withCanvas(mutate)` 内部方法，commit 在同一队列闭包中调用；brief 节点 upsert 也并入此次写盘，避免一提交连写多次 canvas.json 产生多份归档）。

归档副作用注意：canvas.json 每次 persist 归档一次；commit 合并为单次画布写是本包的刻意设计（publish 主体被 commit 复用时，其内部 upsert 改为返回“待应用节点 patch”，由外层统一 persist；v1 handler 维持自己的 persist 调用）。

### 5.3 节点字段保留（store.update）

```ts
const idx = canvas.nodes.findIndex(x => x.id === node.id)
if (idx >= 0) {
  const prev = canvas.nodes[idx]
  if (!('dirty' in node)) node.dirty = prev.dirty
  if (!('parentReference' in node)) node.parentReference = prev.parentReference
  canvas.nodes[idx] = node
}
```

zod 入参不含 dirty 键 → 普通 update 永远走保留分支。

## 6. 错误流与就绪语义

- assess 只有两类信封错误：NO_ACTIVE_PROJECT、BRIEF_NO_BASELINE；草案不完整、谱系非法都不拦（只读干跑，Agent 在 plan 阶段把关）。
- commit 闸门顺序：激活项目 → 基线存在 → 谱系装载（失败三码即停）→ 就绪（BRIEF_NOT_READY）→ verbal quote → 复算+决策覆盖校验（IMPACT_DECISION_MISMATCH）→ 防覆盖（BRIEF_VERSION_EXISTS）。任一失败零写盘（闸门全部在第一次写盘前完成；写盘开始后错误向上抛，由全局串行队列保证无半写并发，已写文件按“宁可失败可见”不回滚——与既有 publish 同策略）。
- align 错误：NO_ACTIVE_PROJECT / CANVAS_NODE_NOT_FOUND / INVALID_ARGUMENT；无 dirty 幂等成功。

## 7. 对既有行为的影响面（已逐一核实）

| 既有面 | 影响 | 兜底 |
|---|---|---|
| brief.publish v1（tools.ts L350–461） | 主体抽离 + 新增 manifest.briefVersion 写；返回形状不变 | mcp-brief-tools.test.ts 既有用例不改；新增 briefVersion===1 断言 |
| canvasStore.update 整体替换语义 | 两字段保留（唯一行为变化） | canvas-store.test.ts 增保留用例；既有 upsert 用例不传两字段，行为等价 |
| canvas.update zod | 仅新增可选 parentReference；dirty 被 zod 默认剥离 | 剥离行为有显式测试 |
| parseManifest 容错 | 增 briefVersion 读默认 | 旧档（feature-001/801 测试夹具）无该字段，读取断言不破坏；写回后带 null |
| createProject | 初始 manifest +1 字段 | library 相关测试断言若按精确对象比对需更新（编码时 grep；属本包合理变更） |
| CanvasBoard invalidated 视觉 | 不改 | dirty 走独立分支，不共用 opacity-60 |
| tools.ts 头注释/工具计数 | 19→22 | 静态测试同步 |
| RevisionSource/UnlockData | 仅注释 | 零消费方，无运行时影响 |

## 8. 视觉/测试回归基线

- typecheck：基线 7 错误（dev-mock-api ×1、CanvasBoard ×2、VisualCatalog ×4），红线零新增；CanvasBoard 改动后两个既有错误不扩大。
- 全量 vitest：基线 **302 passed / 7 skipped / 12 failed**（2026-10-13 feature-802 后）；12 failed 均已定性（fs-sandbox ×1、architecture ×1、studio-flow ×10），本包 renderer 改动以不扩大 studio-flow 失败数为红线。
- 受影响静态契约测试：agent-profiles（白名单 14→17）、mcp-pure-tools（19→22）、runtime-client、runtime-integration——四处必须同轮更新，少一处即失败点名。

## 9. 实施补记（2026-10-14 落地后）

### 9.1 §3 版本号数据源的实现取舍

- §3 原述「取值优先级：brief 节点 meta.version」。实现为更稳健的**取大**：N = max(`parseV(brief 节点 meta.version)`, 全画布 `max(dirty.latestBriefVersion)`)。正常链路下 brief 节点必随 commit upsert 为最新版（meta.version 恒 ≥ 各 dirty 节点的 latestBriefVersion），取大结果与「以 brief 节点为准」完全等价；取大仅在 brief 节点暂时缺失/旧档时提供兜底，不引入新通道、不改变主路径行为。
- 两数据源皆无时 STAGE 0 显示「空」（既有分支不变）。旧档存在已发布立项但画布无 brief 节点时徽标/黄条退化，属「renderer 只读画布」的已知边界，不做旧档修复（详见变更记录 R-002）。

### 9.2 契约 §9.5 测试策略实际落点

- canvas-board.test.tsx 套件包前健康（18/18），故走「挂得住加轻断言」分支：新增 5 例（脏角标 title/⚠ 文案与 brief 节点无角标、黄条逐字文案、干净画布双无标识、StageNavPanel 空/绿/黄三态），套件 23/23 全绿；未新增独立渲染测试文件。
- 最终回归：**353 passed / 7 skipped / 12 failed**（基线 302/7/12，净增 51 passed，failed 零扩大）；typecheck 7 条基线持平，node/preload tsc 零错误；runtime-integration 套件级 AbortSignal 失败经 git stash 对照定性为 HEAD 既有（failed 断言=0），不计入 12。
