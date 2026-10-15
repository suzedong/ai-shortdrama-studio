# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 契约 [反向补录]

> 配套：[需求规格](./SDG-RE-需求规格.md) / [任务清单](./SDG-RE-任务清单.md)。
>
> **事实源（逐字段核对依据）**：[shared/types.ts](../../../shared/types.ts) L184–236（数据形状）、[writer.md](../../../resources/opencode/agents/writer.md) L60–79（字段纪律）、[showrunner.md](../../../resources/opencode/agents/showrunner.md) L158–181（第 2 步编排/结构校验/门/manifest；L170 为 2-c 预留段）、[electron/mcp/tools.ts](../../../electron/mcp/tools.ts)（通用工具）。
>
> **形态声明**：与 feature-101 同构——本契约描述**提示词驱动实现**，没有面向分场/台词内容的代码层 schema 校验。结构校验清单的执行主体是 showrunner（按 prompt 读回 JSON 逐项核对），不是程序。
>
> **落地范围**：2-a 分场、2-b 台词各节约束**已落地**；2-c 分镜文字稿相关类型/门/事件虽已在共享层与状态机**预留**，但生产链路零写入，其约束标注「待实施」。

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

### 1.3 Shot / ShotDialogue / ShotList（分镜，2-c 预留类型；[types.ts L216–236](../../../shared/types.ts#L216-L236)）

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

- **S8（待实施）**：2-c 只产 `分镜/shotlist.json` **文字稿**——一期空镜 `dialogue:null`、`refs:[]`（不排资产、不排生产镜）；生产化（景别/运镜/时长细化、refs 挂资产、dialogue 回填）归 feature-401 在**同一文件**内演进（裁决① D-013，[features/README.md §3](../README.md)）。当前生产链路零写入该类型。

## 2. 落盘与版本约定

| 产物 | JSON 路径 | MD 镜像 | 画布节点 | 状态 |
|---|---|---|---|---|
| 分场 | `剧本/分场.json` | `剧本/分场.md` | `step-2-scenes`（step `'2'`、kind `scenes`） | 已落地 |
| 台词 | `剧本/台词.json` | `剧本/台词.md` | `step-2-dialogue`（kind `dialogue`） | 已落地 |
| 分镜文字稿 | `分镜/shotlist.json` | `分镜/shotlist.md`（2-c 节点，kind `storyboard`） | — | **待实施** |

- **S9 双写**：JSON 事实源 + MD 镜像，MD 不引入 JSON 中没有的事实性新设定（writer.md L79）；双写是 Agent 连续两次 `file.write` 的 prompt 契约，**非原子**。
- **S10 写前归档**：与故事产物同形——覆盖前由 [archive.ts](../../../electron/fs/archive.ts) L14–35 移入同目录 `版本/<base>.<YYYYMMDD-HHmmss><ext>`，归档失败抛错阻断；非立项单 `立项单.vN.json` 版本化。
- **S11 目录固定**：分场/台词落「剧本/」，禁止写「分镜/」（2-a/2-b 阶段，showrunner.md L180–181）；2-c 才写「分镜/shotlist.*」（待实施）。

## 3. 复用的通用 MCP 工具（本包不新增工具）

| 工具 | 本步用途 | 关键约束 |
|---|---|---|
| `brief.list` / `file.read` | 读最新版立项单；读大纲、小传（前置输入） | 缺大纲/小传则不启动 |
| `file.list` / `file.read` | showrunner 回收委派后**读回产物做结构校验** | 校验是 prompt 行为，非 zod |
| `file.write` | 分场/台词 JSON+MD 双写 | zod 仅校验 `{path:string.min(1), content:string}`，不校验内容结构 |
| `canvas.get` / `canvas.update` | 恢复、writer active upsert、approved 后 done + auto 边 | 第 2 步 writer **不带 linksTo**；done 必须带 parentReference |
| `gate.request` | 发 2-a / 2-b（2-c 待实施） | 仅 showrunner 可调 |
| `manifest.get` / `manifest.advance` | 门 approved 后推进 | 见 §4 |

writer 白名单仍恰为 5 个（file.read/list/write + canvas.get/update，[writer.md L14–31](../../../resources/opencode/agents/writer.md#L14-L31)）；`task / bash / gate / comfyui / asset` 均在白名单外。

## 4. 确认门与 manifest 事件

| 门 | 时点 | payload（只放引用与摘要） | approved 后动作 | 状态 |
|---|---|---|---|---|
| `2-a` | 分场落盘 + 结构校验通过 | `{ ref:'剧本/分场.json', sceneCount, totalSeconds }` | 节点 done（parentReference fields=血缘表 scenes 行）+ 边 profiles→scenes → `manifest.advance({event:'scenes-approved'})` | 已落地 |
| `2-b` | 台词落盘 + 结构校验通过 | `{ ref:'剧本/台词.json', sceneCount, lineCount }` | done（fields=dialogue 行）+ 边 scenes→dialogue → `manifest.advance({event:'dialogue-approved'})` | 已落地 |
| `2-c` | 分镜文字稿落盘后 | （随 2-c 启用时定义） | 置完节点 + `manifest.advance({event:'storyboard-finalized'})`（script-storyboard→storyboard-done 终态） | **待实施**（showrunner.md L170 明示当前不发门、不调事件） |

- **S12 门序固定**：2-a approved 前不得发 2-b；rejected 读 `note`、委派 writer 重做（节点保持/重开 active）、重新结构校验后以**同一 gateId** 重开；approved 为终态，同 id 再请求报错（showrunner.md L179）。
- **S13 状态机**（[manifest.ts L24–34](../../../electron/project/manifest.ts#L24-L34)）：`scenes-approved`: script-scenes→script-dialogue；`dialogue-approved`: script-dialogue→script-storyboard；`storyboard-finalized`: script-storyboard→storyboard-done（[types.ts L22 注释](../../../shared/types.ts#L22)「随 feature-201 激活」）。门与状态机解耦，advance 必须由 showrunner 显式调用。
- **S14 parentReference.fields 固定取值**（showrunner.md L127–129 血缘表）：
  - scenes 行（L127）：小传全集 + `fiveElements.episodeCount` `fiveElements.episodeDuration`；
  - dialogue 行（L128）：同 scenes，但去掉 `fiveElements.episodeDuration`、加 `fiveElements.platforms`；
  - storyboard 行（L129，2-c 待实施）：scenes 全集 + `fiveElements.aspectRatio`。
  - 平台不校验字段名合法性（少声明 = 后续改立项时漏标影响），责任在 showrunner prompt。
- **S15 建边铁律**：第 2 步依赖边一律 showrunner 在 approved 后用 `canvas.update({edges:[{from,to,auto:true}]})` 建**正确方向**（profiles→scenes、scenes→dialogue）；禁止 writer 用 `linksTo`——其派生语义为「从本节点指向目标」，本步会产出反向边（showrunner.md L162；script-orchestration.test.ts 有防回归锚点）。

## 5. 错误码与边界（无剧本专属错误码）

- 不定义分场/台词内容错误码；工具层失败统一走通用错误信封（[tools.ts](../../../electron/mcp/tools.ts) fail/normalize/respond）。
- 缺故事产物、门序违例、结构校验不符由 **Agent 对话层处理**（停止/打回重做），不产生程序化错误码；manifest 乱序推进抛 `MANIFEST_BAD_TRANSITION`（feature-801 既有）。
- 零媒体：不调 `comfyui.*` / `asset.*`；2-a/2-b 不写「分镜/」；writer 请求越权工具被运行时按白名单拒绝。

## 6. 契约证据（测试映射）

[script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts)（describe「C4 · showrunner 第 2 步编排契约」L239，11 it）：

1. L240 两门按序 2-a→2-b；分场/台词均 task 委派 writer；产物落「剧本/」。
2. L266 2-a rejected：同一 gateId 重开，不新增/跳/并门；2-b 仍在 approved 之后。
3. L276 writer 只 upsert active、不带 linksTo；门 approved 后 showrunner 才置 done。
4. L296 patch.edges 方向正确：profiles→scenes、scenes→dialogue，auto:true。
5. L314 linksTo 若误带会产出反向边（防回归锚点）：deriveAutoEdges 以本节点为 from。
6. L325 结构校验：分场包裹对象 / 字段名错误时打回 writer，不发门。
7. L355 结构校验：台词用 type/note 自造字段时打回，不发 2-b。
8. L377 委派交接物带 ep=1；分场 input 含小传（id 事实源）、台词 input 含分场（场号事实源）。
9. L391 第 2 步不触媒体：无 comfyui / asset 调用。
10. L401 缺故事产物不启动：无 task / 门 / 落盘，仅 canvas_get 后告知。
11. L410 恢复续跑：pending 门重挂同一 gateId，不重做产物。

> 反向锁定 2-c 未启用：上述 11 例与 showrunner.md L170 共同确认当前**不产分镜文字稿、不发 2-c 门、不调 storyboard-finalized**；2-c 启用时须新增 STAGE 2 分镜编排测试（任务清单 T-2c）。
>
> 已知测试覆盖缺口（如实记录，不在本包补）：脚本化 fake showrunner 未模拟 done upsert 的 parentReference、未断言 manifest.advance 调用；S13/S14 由 feature-801/002 测试与 showrunner.md 文本守护。
