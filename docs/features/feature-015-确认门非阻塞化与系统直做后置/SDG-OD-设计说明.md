# feature-015 确认门非阻塞化与系统直做后置 · 设计说明

## 1. 模块划分

```
electron/
  gate/
    bridge.ts        改：非阻塞 request / decide 异步化 / clearLive / 删 pending Promise
    guard.ts         不动（feature-807 四码防护保留）
    execute.ts       新：applyGateDecision —— 裁决后置动作执行器
  mcp/tools.ts       改：gate.request handler 立即返回 + 0-final draft 入参校验
  brief/publish.ts   不动（publishV1InQueue 直接复用）
  project/manifest.ts 不动（advanceManifest 直接复用）
  main.ts            改：gate:decide handler await；execution 经既有 gate:changed 推送
resources/opencode/agents/showrunner.md  改：门纪律改口
```

`execute.ts` 依赖 `canvasStore` / `publishV1InQueue` / `advanceManifest` / `evaluateDraft` / `loadStyleCatalog` / `runHarnessValidation`，全部既有模块，无新依赖。

## 2. 执行器结构

```ts
export type GateExecution =
  | { ok: true; summary: string }
  | { ok: false; code: string; message: string; revertToPending?: boolean }

export async function applyGateDecision(gate: CanvasGate): Promise<GateExecution>
```

- 入口按 `gate.gateId` 查映射表；无映射直接 `{ok:true, summary:'无后置动作'}`。
- `0-final` → `publishFromGate(gate)`；`1-a~2-b` → `advanceForGate(event)`。
- 返回 `revertToPending:true` 时由 bridge 把门写回 pending（§4.2 草案类失败）。

### 2.1 publishFromGate

```
listBriefVersions 得 publishVersion，与 payload.version 比对（不符 → 回退 pending）
→ publishVersion > 1：仅返回「再版草案已确认」，不发布；Agent 下一轮三选一后 impact.commit
→ 首版读 payload.draft（缺 → GATE_DRAFT_MISSING，保持 approved，走 §4.3）
→ loadStyleCatalog + evaluateDraft（missing/styleIssues → 回退 pending）
→ runHarnessValidation（blocker → 摘要写回 payload，保持 approved）
→ publishV1InQueue(projectDir, draft, { by:'gate', note })
→ canvasStore.update({ nodes:[briefNode] })
→ advanceManifest('brief-published')
```

与 `brief.publish` handler 的差别仅在于**不做 feature-807 门态防护**——此刻门已是 approved，防护无意义；且 approve 固定 `by:'gate'`。

### 2.2 advanceForGate

```
advanceManifest(event)
  advanced:true / already-there → ok
  bad-transition / terminal → { ok:false, code:'MANIFEST_BAD_TRANSITION' }
```

## 3. 并发与幂等

- `decide` 先查门当前状态：非 pending 直接返回 `ignored`，保证连点不重复执行。
- 后置动作内部经 `publishV1InQueue` 的全局写队列串行，与既有发布路径同一队列，不会与 Agent 的 verbal publish 交错。
- 执行期间用户切项目：`getActiveProjectDir` 在执行开始取值，执行中切换会导致写错项目——**缓解**：执行前捕获 projectDir，全程使用该绝对路径；`advanceManifest` 内部自取当前项目，需在执行前校验项目未变，变了则放弃后置并推送提示。

## 4. 测试设计

新建 `src/test/gate/gate-execute.test.ts`：

- 0-final 首版全链路：mock 项目目录 + 谱系，裁决后断言双写文件、节点、manifest。
- 0-final 再版：系统只确认、不双写，保留 Agent 三选一后 impact.commit 唯一发布。
- 草案缺失 / 版本不符 / 缺字段 / harness blocker / 无草案历史首版门 各一例。
- 1-a~2-b：推进映射逐门断言 + rejected 不推进 + already-there 幂等。
- 无映射门（2-c）：无后置。

改写 `src/test/gate/gate-bridge.test.ts`：

- request 立即返回（不等 decide）、重复发门重开、无 pending Map 驻留。
- decide 非 pending 忽略、clearLive 不触发后置。

改写 `src/studio/contracts/orchestration.test.ts`：门请求不再返回 approved，编排脚本改为「发门 → 系统已推进」的断言形态。

## 5. 不做的事

- 不引入「裁决后自动唤起 Agent」的消息泵。渲染器只在门卡显示结果；续跑由用户下一句话触发。
- 不改 `GateCardView` 的排版逻辑（B-63 刚落地）；只加 execution 结果行。
