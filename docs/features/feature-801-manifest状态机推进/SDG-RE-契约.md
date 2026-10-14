# feature-801 manifest 状态机推进 · 接口与数据契约

> 配套文件：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)（场景 / 范围 / 验收）。本文件固化**字段、入参、返回、错误码、类型增删改、迁移规则**，是 K1 共享层变更与主进程实现的直接依据。
>
> 事实源：设计书 §7.1（L546–596）：L554 manifest 定位「阶段状态指针 { status, createdAt, ... }；读-改-写保留既有字段」、L578–583 状态机、L589「manifest.json 永不归档」。字段命名沿用 [shared/types.ts](../../../shared/types.ts) 既有 camelCase 约定。

## 1. manifest.json 数据 schema（`ProjectManifest`）

项目根 `manifest.json` 是**阶段状态指针**，不是业务产物容器；画布事实在 `canvas.json`，产物在各产物文件。新 schema：

```ts
// manifest.status 7 态（设计书 §7.1 L581-582 原文，逐字）
export type ManifestStatus =
  | 'initiating'
  | 'story-outline'
  | 'story-profiles'
  | 'script-scenes'
  | 'script-dialogue'
  | 'script-storyboard'
  | 'storyboard-done'

// 推进事件（每次定稿对应一个事件；工具入参只接受事件名，不接受任意目标态）
export type ManifestEvent =
  | 'brief-published'      // 立项单首版定稿（initiating → story-outline）
  | 'outline-approved'     // 1-a 大纲门 approved
  | 'profiles-approved'    // 1-b 小传门 approved
  | 'scenes-approved'      // 2-a 分场门 approved
  | 'dialogue-approved'    // 2-b 台词门 approved
  | 'storyboard-finalized' // 2-c 分镜文字稿定稿（随 feature-201 激活）

// 状态机推进留痕（只追加，不修改/不删除）
export interface ManifestTick {
  event: ManifestEvent
  from: ManifestStatus
  to: ManifestStatus
  at: string              // ISO 时间戳
}

// manifest.json 文件形状（项目根，永不归档）
export interface ProjectManifest {
  status: ManifestStatus
  createdAt: string            // ISO；createProject 时写入，与 .session.json 同源
  workflowVersion: 1           // 固定 1（历史字段保留，唯一既有版本位）
  updatedAt: string            // ISO；每次 advance 更新；createProject 时等于 createdAt
  statusHistory: ManifestTick[] // 从 [] 起单调追加，长度 = 已完成推进格数
}
```

约束：

1. 工具入参只传 `event`，**禁止直接传目标 status**——目标态由纯函数按跃迁表计算，Agent 无法指定任意状态。
2. `statusHistory` 只追加；读-改-写时保留文件中其余未知字段（旧骨架字段原样透传，见 §6 兼容）。
3. 不设 `schemaVersion`：该文件首次类型化即本形状；新旧区分靠「是否存在 `statusHistory` 数组」运行时判定（见 §5）。

## 2. 状态机纯函数（`electron/project/manifest.ts`，可单测）

跃迁表（唯一事实，工具与测试共用）：

```ts
// 顺序即设计书 L581-582 链；index 差恒为 1
export const MANIFEST_TRANSITIONS: Record<
  ManifestEvent,
  { from: ManifestStatus; to: ManifestStatus }
> = {
  'brief-published':      { from: 'initiating',       to: 'story-outline' },
  'outline-approved':     { from: 'story-outline',    to: 'story-profiles' },
  'profiles-approved':    { from: 'story-profiles',   to: 'script-scenes' },
  'scenes-approved':      { from: 'script-scenes',    to: 'script-dialogue' },
  'dialogue-approved':    { from: 'script-dialogue',  to: 'script-storyboard' },
  'storyboard-finalized': { from: 'script-storyboard',to: 'storyboard-done' },
}
```

纯函数签名与判定：

```ts
// 返回推进结果；不触盘
export function advanceStatus(
  current: ManifestStatus,
  event: ManifestEvent,
): { advanced: true; next: ManifestStatus }
  | { advanced: false; reason: 'already-there' | 'bad-transition' | 'terminal' }
```

- 跃迁表 `from === current` → `{advanced:true, next:to}`。
- 跃迁表 `to === current`（同事件重复，如立项 v2 后再调 `brief-published`）→ `{advanced:false, reason:'already-there'}`（幂等）。
- `current === 'storyboard-done'` 且非上述 → `{advanced:false, reason:'terminal'}`。
- 其余（from/to 均不等于 current，即跳格/乱序）→ `{advanced:false, reason:'bad-transition'}`。

## 3. MCP 工具契约（注册于 [tools.ts](../../../electron/mcp/tools.ts)，14 → 16 个）

统一信封沿用 `{ ok:true, ... } | { ok:false, error:{code,message} }`，`respond()` 包 `content[0].text=JSON`。两工具均**零 LLM**、只操作当前激活项目（`getActiveProjectDir()`）。

### 3.1 `manifest.get`（只读）

- 入参：`{}`。
- 行为：读当前项目根 `manifest.json` → `parseManifest()` 容错解析（§5）→ 返回。**不写文件**。
- 返回：

```ts
{ ok: true, manifest: ProjectManifest }
```

- 错误：`NO_ACTIVE_PROJECT`（无激活项目，沿用 current.ts 既有错误码）；`PROJECT_NOT_FOUND`（文件缺失，理论上 createProject 必写）。

### 3.2 `manifest.advance`（读-改-写推进一格）

- 入参：

```ts
{ event: ManifestEvent }
```

zod 枚举严格限定 6 事件；非法值由 zod 挡下（既有 `INVALID_ARGUMENT` 路径）。

- 行为（全部在 `enqueue` 串行写队列内）：
  1. `getActiveProjectDir()` → 读 `manifest.json`（容错解析）。
  2. `advanceStatus(manifest.status, event)`：
     - `advanced:true` → 深拷贝当前对象，`status=next`、`updatedAt=now`、`statusHistory.push({event, from:current, to:next, at:now})`，**原样保留所有未知/历史字段**；整文件 `JSON.stringify(obj, null, 2)` 写回（**不调 archiveExisting、不进 `版本/`**，L589 永不归档）。
     - `advanced:false` → **不写文件**，按 reason 返回（见下）。
  3. 写与 `canvas.json` 无任何交互（两套文件继续解耦）。
- 返回：

```ts
// 成功推进
{ ok: true, advanced: true, status: ManifestStatus, manifest: ProjectManifest }
// 幂等命中（已是目标态）
{ ok: true, advanced: false, status: ManifestStatus, reason: 'already-there' }
```

- 错误信封：

| code | 触发 |
|---|---|
| `MANIFEST_BAD_TRANSITION` | 事件 from/to 均不等于当前态（跳格/乱序/阶段未到） |
| `MANIFEST_TERMINAL` | 当前 `storyboard-done` 且事件非幂等 |
| `NO_ACTIVE_PROJECT` | 无激活项目 |
| `PROJECT_NOT_FOUND` | manifest.json 缺失 |
| `INVALID_ARGUMENT` | event 非 6 枚举之一（zod） |

> 与 feature-001 brief.publish 同款边界：工具**不校验门是否 approved、不读 gateBridge**；调用时机由 showrunner 纪律与编排测试约束。

## 4. 磁盘读写模块（`electron/project/manifest.ts`，新增）

| 导出 | 职责 |
|---|---|
| `MANIFEST_FILE = 'manifest.json'` | 固定文件名 |
| `parseManifest(raw: unknown, fallbackNow: string): ProjectManifest` | 容错解析（§5），纯函数 |
| `readManifest(): Promise<ProjectManifest>` | 读激活项目 manifest.json；缺失抛 `PROJECT_NOT_FOUND` |
| `writeManifest(obj): Promise<void>` | 在 `enqueue` 内整文件写回（**不归档**）；调用方负责保留未知字段 |
| `advanceManifest(event): Promise<{advanced; status; manifest; reason?}>` | 读 → advanceStatus → 条件写，错误以 `{code}` throw（由 tools.ts `normalize` 包信封） |

写队列复用 [write-queue.ts](../../../electron/fs/write-queue.ts) `enqueue`（与 createProject / file.write 同轨），保证「读-判-写」串行。

## 5. 容错解析与兼容（旧 manifest 不迁移）

`parseManifest` 规则（输入为 `JSON.parse` 结果或 `{}`）：

1. `status` ∈ 7 态白名单 → 采用；否则（含旧值以外的任意串/缺失）→ `'initiating'`。
2. `createdAt` 为非空字符串 → 采用；否则用 `fallbackNow`。
3. `workflowVersion === 1` → 采用；否则归一为 `1`。
4. `updatedAt` 字符串 → 采用；否则 = `createdAt`。
5. `statusHistory` 为数组且每项 `event/from/to/at` 均为字符串 → 过滤合法项采用；否则 `[]`。
6. **未知字段不丢弃**：`readManifest` 返回给写路径时携带原始对象的其余字段（phase/nodes/pendingGate/...），写回时原样保留；`ProjectManifest` 类型上不声明它们（解析层内部以 `...rest` 透传）。

旧项目**不做**离线迁移、不重写文件：旧 manifest 只有在该项目首次发生一次成功 advance 时才被整文件改写（届时旧字段作为未知字段继续保留在文件中，类型层不可见）。createProject 产出的新文件不含任何历史字段。

## 6. shared/types.ts 类型增删改清单（K1，**待用户批准**）

| 动作 | 成员 | 说明 |
|---|---|---|
| 新增 | `ManifestStatus`（7 态联合） | §1，逐字采用设计书 L581-582 |
| 新增 | `ManifestEvent`（6 事件联合） | §1 |
| 新增 | `ManifestTick` | §1，推进留痕 |
| 新增 | `ProjectManifest` | §1，manifest.json 首次类型化 |
| 删除 | `Stage`（10 态联合）及 L3-4 历史注释 | 全仓仅 initialNodes 与 UnlockData.downstream 两个消费点，本包同步清除 |
| 改 | `UnlockData.downstream` | `Stage[]` → `string[]`（画布节点 id 列表）；注释改为「节点 id（step-x-* 形态）；feature-002 立项后变更落地时按 CanvasNode.id 重构语义」。该接口现全仓零消费，改动无编译/行为波及 |
| 不动 | `RevisionSource` | `'2-c'` 已在列；2-c 门随 feature-201 落地，与状态机类型解耦，本包不动 |
| 不动 | `GateId` / `NodeStatus` / `StepId` / `CanvasNode` / `Canvas` / `ProjectSession` | 画布与门机制零改动；NodeStatus 仅在删除 initialNodes 后减少一个 import 点，类型本身不动 |
| 不动 | `MessageKind`（含同名 `'story-outline'`） | 聊天消息种类与状态机态同名无关，不改名 |

代码侧连带清除（非 shared 层，一并列明）：

| 文件 | 动作 |
|---|---|
| [library.ts](../../../electron/project/library.ts) | 删 `initialNodes()` 与其 `Stage/NodeStatus` import；createProject 改写字面量为 `ProjectManifest` 形状（§1），import 新类型 |
| [StageCanvas.tsx](../../../src/components/StageCanvas.tsx) | **整文件删除**（死组件：无任何 import；确认动作 T5 中以全仓 grep 复核） |
| [tools.ts](../../../electron/mcp/tools.ts) | 文件头注释 14 → 16；注册 manifest.get / manifest.advance |
| [provider.ts](../../../electron/runtime/provider.ts) | `SHOWRUNNER_DECLARED_TOOLS` 追加 `shortdrama_manifest.get` / `shortdrama_manifest.advance`（9 → 11），否则被 client.ts 白名单拦截（feature-001 T5 同款补登） |

## 7. showrunner 定稿动作契约（提示词层）

[showrunner.md](../../../resources/opencode/agents/showrunner.md) 在以下位置加入推进纪律（工具名以 `shortdrama_` 前缀出现在 frontmatter/白名单，正文沿用短名）：

| 位置 | 追加动作 |
|---|---|
| frontmatter tools/permission | 声明 `shortdrama_manifest.get: true` / `shortdrama_manifest.advance: true`（allow） |
| 职责纪律（§职责与工作纪律） | 新增一条「状态机纪律」：每次定稿（publish v1 / 门 approved）后必须调一次 manifest.advance，事件名固定；门未 approved 不调；不得自造事件名 |
| 第 0 步第 8 条 publish 后 | `brief.publish` 返回 `version===1` 时调 `manifest.advance({event:'brief-published'})`；再版（v2+，立项后变更）**不**调 |
| 第 1 步 1-a approved 收尾 | 置节点 done 后调 `manifest.advance({event:'outline-approved'})` |
| 第 1 步 1-b approved 收尾（第 5 条） | 置 done 后调 `manifest.advance({event:'profiles-approved'})` |
| 第 2 步 2-a approved 收尾（第 4 条） | 置 done + 建边后调 `manifest.advance({event:'scenes-approved'})` |
| 第 2 步 2-b approved 收尾（第 6 条） | 置 done + 建边后调 `manifest.advance({event:'dialogue-approved'})` |
| 第 2 步结尾 | 预留语：「分镜文字稿定稿门 2-c 随 feature-201 启用，approved 后调 `manifest.advance({event:'storyboard-finalized'})` 到达 storyboard-done；当前版本不产分镜、不调此事件」 |
| 各步「回合开始先恢复」 | 在 canvas_get 之外加 `manifest.get`：以 `status` 判断续跑位置（如 `script-dialogue` 表明分场已定稿，直接做台词） |

工具返回 `advanced:false` 时：`already-there` 视为正常（可能是回合重入），继续流程；`MANIFEST_BAD_TRANSITION`/`MANIFEST_TERMINAL` 必须向用户报告状态不一致，不静默继续。

## 8. 时序（立项定稿 → 第一格）

```
用户批准 0-final → Agent: brief.publish({approve:{by:'gate'}})
  → {ok:true, version:1, ...}
Agent: manifest.advance({event:'brief-published'})
  → 读 manifest(status=initiating) → advanceStatus: advanced
  → 写回 status=story-outline, statusHistory:[tick#1]
  → {ok:true, advanced:true, status:'story-outline'}
（version>=2 的 publish 后不调；若误调，工具返回 already-there，无害）
```

门后推进（以 1-a 为例，其余同构）：

```
gate.request('1-a') → 用户 approved
Agent: canvas_update(节点 done + 边)
Agent: manifest.advance({event:'outline-approved'})
  → story-outline → story-profiles
```

## 9. 路径与命名约定

| 项 | 约定 |
|---|---|
| 文件 | `{项目根}/manifest.json`（唯一固定名） |
| 归档 | **永不归档**、不调 archiveExisting、不进 `版本/`（L589） |
| 写方式 | 串行 enqueue；整文件读-改-写（pretty JSON，2 空格） |
| 历史字段 | 读透传、写保留、类型不声明、新文件不写 |
| 工具命名 | `manifest.get` / `manifest.advance`（点号族，与 brief.* 同族；物理键 `shortdrama_manifest.get`） |

## 10. 测试契约

- 纯函数 `advanceStatus`：6 事件正向各一例、每事件的 already-there 幂等一例、跨格乱序（≥6 例）bad-transition、终态 terminal、全链 6 格顺序到达。
- `parseManifest`：合法直读；旧 12 字段骨架（status 合法）→ 补 `statusHistory:[]` 且 unknown 字段保留；非法 status/损坏 JSON 容错；history 含脏项被过滤。
- 工具：get 形状；advance 落盘（读回 status/tick/updatedAt，不归档）；bad-transition/terminal 不写文件（mtime 或写队列 spy）；幂等不追加 tick；NO_ACTIVE_PROJECT。
- createProject：新 manifest 形状、无 nodes/phase 等字段。
- 编排：showrunner STAGE 0→2 脚本中 5 次 advance 的事件名与调用次序（门 approved 之后）；rejected 不产生 advance。
- 静态：全仓 grep 无 `Stage` 类型 import、无 StageCanvas 引用；runtime provider 白名单含两个物理 ID（参照 feature-001 agent-profiles 白名单断言写法）。

## 11. feature-001 契约的联动修订（本包生效后）

feature-001 契约 §3.2 第 7 条「**不**推进 `manifest.status`（B-04 排除）」在本包落地后改为：

> publish 工具自身仍不写 manifest（工具边界不变）；立项首版定稿后的状态推进由 showrunner 随后显式调用 `manifest.advance({event:'brief-published'})` 完成（feature-801）。

该修订属「已落地包因后续包产生的契约补充」，记入本包变更记录修订区与 feature-001 变更记录三、修订记录（交叉指针），不回改 feature-001 已实施代码逻辑（publish 代码零改动）。
