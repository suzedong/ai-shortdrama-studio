# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 契约 [反向补录]

> 配套：[需求规格](./SDG-RE-需求规格.md) / [任务清单](./SDG-RE-任务清单.md)。
>
> **事实源（逐字段核对依据）**：[shared/types.ts](../../../shared/types.ts)（数据形状）、[writer.md](../../../resources/opencode/agents/writer.md)（字段纪律）、[showrunner.md](../../../resources/opencode/agents/showrunner.md)（第 2 步编排）、[execute.ts](../../../electron/gate/execute.ts)（系统门后置）、[tools.ts](../../../electron/mcp/tools.ts)（通用工具）。
>
> **形态声明**：与 feature-101 同构——本契约描述**提示词驱动实现**，没有面向分场/台词内容的代码层 schema 校验。结构校验清单的执行主体是 showrunner（按 prompt 读回 JSON 逐项核对），不是程序。
>
> **落地范围**：2-a 分场、2-b 台词各节约束**已落地**；2-c 分镜文字稿于 2026-11-11 经用户批准按本契约实施。共享类型、GateId 与 ManifestEvent 复用既有定义；门后置推进遵循 feature-015，由系统直做。

## 1. 数据 schema（shared/types.ts，只读复用，本包零改动）

### 1.1 Scene / SceneBreakdown（分场；[types.ts L184–198](../../../shared/types.ts#L184-L198)）

```ts
interface Scene {
  ep: number                    // 集号，一期恒为 1
  sceneNo: number               // 场号 1..N（台词、分镜引用键）
  slug: string                  // 场次标题，如「公司·开放办公区」
  interiorExterior: '内' | '外' | '内外'
  dayNight: '日' | '夜' | '晨' | '昏'
  location: string              // 具体地点
  characterIds: string[]        // 出场角色 id（引用 CharacterProfile.id）
  beats: string[]               // 本场节拍 / 动作事件序列
  emotion: string               // 本场情绪基调
  estSeconds: number            // 预估时长（秒），正整数
  summary: string               // 一句话场次梗概
}
type SceneBreakdown = Scene[]   // 产物文件形状：裸数组
```

- **S1**：`剧本/分场.json` 顶层是 `Scene[]` **裸数组**，禁止 `{scenes:[...]}` 包裹（showrunner.md L174 ①）。
- **S2**：每场字段**恰好 11 个**（L174 ②），不多不少；`ep` 恒 1，`sceneNo` 1..N 连续，枚举合法，`estSeconds` 正整数，`beats` 非空，`characterIds` 全部存在于人物小传；**≥3 场**（L174 ③④、writer.md L60–69）。
- **S3 主键血缘**：`Scene.characterIds[]` 引用 feature-101 诞生的 `CharacterProfile.id`，不得新造；无台词的出场角色也要列出（writer.md L66）。
- **S4**：`Scene.sceneNo` 是下游引用键，贯穿 `DialogueScene.sceneNo`（2-b）与未来 `Shot.sceneNo`（2-c/401）。

### 1.2 DialogueLine / DialogueScene / DialogueScript（台词；[types.ts L200–214](../../../shared/types.ts#L200-L214)）

```ts
interface DialogueLine {
  speakerId: string             // 引用 CharacterProfile.id；功能性无小传角色用 '' 兜底
  speakerName?: string          // speakerId 为空时的显示名（路人 / 画外音）
  kind: '对白' | '旁白' | '独白'
  text: string
  emotion: string
  action?: string               // 括号动作提示（舞台指示）
}
interface DialogueScene {
  ep: number
  sceneNo: number               // 引用 Scene.sceneNo
  lines: DialogueLine[]
}
type DialogueScript = DialogueScene[]  // 产物文件形状：裸数组
```

- **S5**：`剧本/台词.json` 顶层是 `DialogueScene[]` **裸数组**；每 scene 字段恰好 `ep / sceneNo / lines`，`sceneNo` **覆盖分场全部场号**（showrunner.md L175 ①②）。
- **S6**：每行字段恰好 `speakerId / speakerName? / kind / text / emotion / action?`，**不得用 `type / note` 等自造名**；`kind ∈ {'对白','旁白','独白'}`（L175 ③）。
- **S7**：有名角色 `speakerId` 必须取自小传 id；无小传功能角色 `speakerId:''` 且必须给 `speakerName`；`lines` 非空（writer.md L72–73）。

### 1.3 Shot / ShotDialogue / ShotList（2-c 分镜文字稿；[types.ts](../../../shared/types.ts)）

```ts
interface ShotDialogue { speakerId: string; speakerName?: string; text: string; emotion: string }
interface Shot {
  ep: number
  shotNo: number                // 镜号 1..N
  rowOrder: number              // 行序（表格排序）
  shotSize: string              // 景别：特写/近景/中景/全景/远景
  sceneNo: number               // 一期以分场场号引用
  characterIds: string[]
  action: string
  dialogue: ShotDialogue | null // 本镜主要台词；空镜为 null
  durationSec: number
  camera: string                // 运镜
  refs: string[]                // 参考资产，一期恒为 []
}
type ShotList = Shot[]
```

- **S8**：2-c 产 `分镜/shotlist.json` **文字草案**，顶层为 `Shot[]` 裸数组且非空；每镜字段恰好 11 个。`ep` 恒 1；`shotNo` 与 `rowOrder` 均为 1..N 连续整数；`sceneNo` 取自分场且覆盖分场全部场号；`characterIds` 取自该场 `Scene.characterIds`；`action` 非空。
- **S16（文字草案边界，2026-11-11 用户拍板）**：`shotSize ∈ {'特写','近景','中景','全景','远景'}`，`camera` 为非空文字，`durationSec` 为正整数，三者是供用户确认的草案而非生产定稿；`refs` 每镜恒为 `[]`，不绑定资产、不调用媒体。feature-401 在**同一文件**内做生产化细化，不另设第二产物（裁决① D-013）。
- **S17（dialogue 血缘）**：有本镜主要台词时，`dialogue` 字段恰好 `speakerId / speakerName? / text / emotion`，内容取自 `剧本/台词.json`，speakerId 沿用原行的小传 id 或 `''+speakerName` 兜底；无本镜台词时为 `null`。2-c 不做 401 的生产化 dialogue 回填。

## 2. 落盘与版本约定

| 产物 | JSON 路径 | MD 镜像 | 画布节点 | 状态 |
|---|---|---|---|---|
| 分场 | `剧本/分场.json` | `剧本/分场.md` | `step-2-scenes`（step `'2'`、kind `scenes`） | 已落地 |
| 台词 | `剧本/台词.json` | `剧本/台词.md` | `step-2-dialogue`（kind `dialogue`） | 已落地 |
| 分镜文字稿 | `分镜/shotlist.json` | `分镜/shotlist.md` | `step-2-storyboard`（step `'2'`、kind `storyboard`） | 本次实施 |

- **S9 双写**：JSON 事实源 + MD 镜像，MD 不引入 JSON 中没有的事实性新设定（writer.md L79）；双写是 Agent 连续两次 `file.write` 的 prompt 契约，**非原子**。
- **S10 写前归档**：与故事产物同形——覆盖前由 [archive.ts](../../../electron/fs/archive.ts) L14–35 移入同目录 `版本/<base>.<YYYYMMDD-HHmmss><ext>`，归档失败抛错阻断；非立项单 `立项单.vN.json` 版本化。
- **S11 目录固定**：分场/台词落「剧本/」；仅 2-c 写「分镜/shotlist.*」，且必须在 2-b approved 后启动。

## 3. 复用的通用 MCP 工具（本包不新增工具）

| 工具 | 本步用途 | 关键约束 |
|---|---|---|
| `brief.list` / `file.read` | 读最新版立项单；读大纲、小传（前置输入） | 缺大纲/小传则不启动 |
| `file.list` / `file.read` | showrunner 回收委派后**读回产物做结构校验** | 校验是 prompt 行为，非 zod |
| `file.write` | 分场/台词/分镜 JSON+MD 双写 | zod 仅校验 `{path:string.min(1), content:string}`，不校验内容结构 |
| `canvas.get` / `canvas.update` | 恢复、writer active upsert、approved 后 done + auto 边 | 第 2 步 writer **不带 linksTo**；done 必须带 parentReference |
| `gate.request` | 发 2-a / 2-b / 2-c | 仅 showrunner 可调 |
| `manifest.get` / `manifest.advance` | 状态读取；未映射事件的例外推进 | 0-final～2-c 均由系统直做，Agent 不重复 advance；见 §4 |

writer 白名单仍恰为 5 个（file.read/list/write + canvas.get/update，[writer.md L14–31](../../../resources/opencode/agents/writer.md#L14-L31)）；`task / bash / gate / comfyui / asset` 均在白名单外。

## 4. 确认门与 manifest 事件

| 门 | 时点 | payload（只放引用与摘要） | approved 后动作 | 状态 |
|---|---|---|---|---|
| `2-a` | 分场落盘 + 结构校验通过 | `{ ref:'剧本/分场.json', sceneCount, totalSeconds }` | 系统推进 `scenes-approved`；Agent 置 done（parentReference fields=血缘表 scenes 行）+ 边 profiles→scenes | 已落地 |
| `2-b` | 台词落盘 + 结构校验通过 | `{ ref:'剧本/台词.json', sceneCount, lineCount }` | 系统推进 `dialogue-approved`；Agent 置 done（fields=dialogue 行）+ 边 scenes→dialogue | 已落地 |
| `2-c` | 分镜文字稿落盘 + 结构校验通过 | `{ ref:'分镜/shotlist.json', shotCount, sceneCount, totalSeconds }` | 系统推进 `storyboard-finalized`；Agent 置 done（fields=storyboard 行）+ 边 dialogue→storyboard | 已实施 |

- **S12 门序固定**：2-a→2-b→2-c，前一门 approved 前不得发后一门；rejected 读 `note`、委派 writer 重做（节点保持/重开 active）、重新结构校验后以**同一 gateId** 重开；approved 为终态，同 id 再请求报错。pending 恢复只提示既有门卡，不重挂门、不重做产物。
- **S13 状态机**（[manifest.ts](../../../electron/project/manifest.ts)）：`scenes-approved`: script-scenes→script-dialogue；`dialogue-approved`: script-dialogue→script-storyboard；`storyboard-finalized`: script-storyboard→storyboard-done。0-final～2-c 的映射由 feature-015 后置执行器负责，2-c 在 `GATE_MANIFEST_EVENTS` 登记；Agent 不重复 advance，already-there 视为幂等成功，执行失败保留门已批准现场并分类上报。
- **S14 parentReference.fields 固定取值**（showrunner.md L127–129 血缘表）：
  - scenes 行（L127）：小传全集 + `fiveElements.episodeCount` `fiveElements.episodeDuration`；
  - dialogue 行（L128）：同 scenes，但去掉 `fiveElements.episodeDuration`、加 `fiveElements.platforms`；
  - storyboard 行：scenes 全集 + `fiveElements.aspectRatio`（与 feature-002 §5 的立项叶子字段口径一致）。
  - 平台不校验字段名合法性（少声明 = 后续改立项时漏标影响），责任在 showrunner prompt。
- **S15 建边铁律**：第 2 步依赖边一律 showrunner 在 approved 后用 `canvas.update({edges:[{from,to,auto:true}]})` 建**正确方向**（profiles→scenes、scenes→dialogue、dialogue→storyboard）；禁止 writer 用 `linksTo`——其派生语义为「从本节点指向目标」，本步会产出反向边。

## 5. 错误码与边界（无剧本专属错误码）

- 不定义分场/台词内容错误码；工具层失败统一走通用错误信封（[tools.ts](../../../electron/mcp/tools.ts) fail/normalize/respond）。
- 缺故事产物、门序违例、结构校验不符由 **Agent 对话层处理**（停止/打回重做），不产生程序化错误码；manifest 乱序推进抛 `MANIFEST_BAD_TRANSITION`（feature-801 既有）。
- 零媒体、零资产：不调 `comfyui.*` / `asset.*`；仅 2-c 可写「分镜/shotlist.*」；writer 请求越权工具被运行时按白名单拒绝。

## 6. 契约证据（测试映射）

- [script-orchestration.test.ts](../../../src/studio/contracts/script-orchestration.test.ts)：覆盖 2-a→2-b→2-c 三门顺序、writer 委派与双写、active/done、linksTo 防回归、正确方向 auto 边、parentReference、结构打回、rejected 同 id 重开、交接物、零媒体、缺故事不启动，以及 2-a/2-b/2-c pending 只提示不重挂。
- [gate-execute.test.ts](../../../src/test/gate/gate-execute.test.ts)：覆盖 1-a→1-b→2-a→2-b→2-c 系统推进至 `storyboard-done`、事件序含 `storyboard-finalized`，以及未登记门无后置动作。
- 2026-11-11 聚焦验证：2 文件 27 项通过；全量验证：83 文件，1058 passed / 0 failed / 1 skipped。
- `npm run build:electron` 通过；`npm run typecheck` 与 `npm run build:renderer` 仅余基线 3 条历史错误（`canvas-zoom.test.tsx` 2 条、`runtime-client.test.ts` 1 条），本包零新增。
