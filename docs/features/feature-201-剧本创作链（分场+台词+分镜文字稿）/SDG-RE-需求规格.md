# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 需求规格 [反向补录]

> **任务包性质**：[反向补录]——按《AI-SDG-AI工具执行指令.md》§7 六步法固化既有实现，写「代码实际实现了什么」。补录基线 git 锚点：`c1ee4e9`（2026-10-14）。
>
> **落地状态**：**2-a 分场、2-b 台词、2-c 分镜文字稿均已实施**（2026-11-11；[已完成·反向补录]）。聚焦与全量自动化通过，未做真机人工验收；证据见任务清单与变更记录。
>
> **溯源标签**：[改编]（设计书 §4.1 L435 编剧职责含「分镜文字稿」；分场/台词为短剧编剧链改编）。
>
> **事实源**：[shared/types.ts](../../../shared/types.ts)（数据形状）、[writer.md](../../../resources/opencode/agents/writer.md) 与 [showrunner.md](../../../resources/opencode/agents/showrunner.md)（提示词编排）、[execute.ts](../../../electron/gate/execute.ts)（系统门后置）、[script-orchestration.test.ts](../../../src/studio/contracts/script-orchestration.test.ts) 与 [gate-execute.test.ts](../../../src/test/gate/gate-execute.test.ts)（自动化证据）、[features/README.md](../README.md) §3 裁决①（D-013）。
>
> **解决偏差**：三阶段血缘已落地、缺任务包；不新增 B 编号描述已落地部分。随包登记 B-12（门模型口径）、B-13（画布步骤标签），见变更记录 R-201-2。

## 1. 背景（磁盘实况）

与 feature-101 同构：STAGE 2 无专用业务模块、MCP 工具或 zod 内容校验程序，由 showrunner 编排、writer 经通用工具产出，结构校验是 showrunner 的 prompt 纪律。

- **既有产物**：`剧本/分场.json/.md`、`剧本/台词.json/.md` 与门 `2-a`/`2-b`。
- **本次新增**：`分镜/shotlist.json/.md`、门 `2-c`、done/血缘/依赖边，以及系统 `storyboard-finalized → storyboard-done` 后置。
- **实施前缺口**：2-c 曾只有共享类型、GateId 与事件预留，没有生产链；本次已补齐。UI 继续复用既有 StoryboardView，不改 renderer。

## 2. 谁在什么场景下要做什么

### 2-a 分场 / 2-b 台词（已落地）

| # | 角色 | 场景 | 需求（磁盘实况） |
|---|---|---|---|
| R1 | showrunner | 用户发起「进入剧本分场」 | 必需输入：最新版立项单（brief.list→file.read）、`故事/故事大纲.json`、`故事/人物小传.json`（故事背景档案可选，缺不报错）；缺大纲/小传则不启动，提示「请先完成故事」，不臆造输入。本步只做第一集 `ep=1` |
| R2 | writer（经 task 委派） | 2-a 分场 | 产 `SceneBreakdown`（≥3 场，场号 1..N 连续），双写 `剧本/分场.json/.md`，upsert 节点 `step-2-scenes`（step `'2'`、kind `scenes`）为 **`status:'active'`，不带 `linksTo`、不置 done**；交接物 input 含立项单+大纲+小传、`ep:1` |
| R3 | showrunner | 2-a 发门前 | `file.read('剧本/分场.json')` 逐条过**结构校验清单**（showrunner.md L173：裸数组 / 字段恰好 11 个 / ep 恒 1 / 枚举合法 / estSeconds 正整数 / beats 非空 / characterIds 全在小传 / ≥3 场）；不合格不发门，委派 writer 指明不符点重做后再校验 |
| R4 | showrunner | 2-a 定稿 | 合格后调 `gate.request({ gateId:'2-a', payload:{ ref:'剧本/分场.json', sceneCount, totalSeconds } })`；approved 后一次性 `canvas.update`：节点置 done（带 parentReference，fields=血缘表 scenes 行）+ 边 `{from:'step-1-profiles', to:'step-2-scenes', auto:true}`；系统直推 `scenes-approved`（script-scenes→script-dialogue），Agent 不重复 advance |
| R5 | writer（经委派） | 2-b 台词 | 交接物 input 为小传+分场；产 `DialogueScript`（按场组织，sceneNo 覆盖分场全部场号），双写 `剧本/台词.json/.md`，upsert `step-2-dialogue`（kind `dialogue`）为 active（不带 linksTo、不置 done）；有名角色 speakerId 取小传 id，功能角色用 `''`+`speakerName` 兜底 |
| R6 | showrunner | 2-b 发门前 | `file.read('剧本/台词.json')` 过结构校验清单（L174：裸数组 / scene 字段恰好 `ep,sceneNo,lines` / sceneNo 覆盖分场 / 行字段恰好 `speakerId,speakerName?,kind,text,emotion,action?` / kind 枚举 / speakerId 取自小传或 '' 兜底）；不合格打回 |
| R7 | showrunner | 2-b 定稿与交接 | `gate.request({ gateId:'2-b', payload:{ ref:'剧本/台词.json', sceneCount, lineCount } })`；approved 后置 done（parentReference fields=dialogue 行）+ 边 `{from:'step-2-scenes', to:'step-2-dialogue', auto:true}`；系统直推 `dialogue-approved`（script-dialogue→script-storyboard）。随后汇报并等待用户发起 2-c，不自动执行 2-c 或第 3 步 |
| R8 | showrunner | rejected / 中断 / 边界 | rejected 同 2-c：读 note、委派 writer 重做（节点保持/重开 active）、重新结构校验、以**同一 gateId** 重开；门序固定 2-a approved 前不得发 2-b；目录固定「剧本/」，不写「分镜/」；全程零媒体（不调 comfyui.*/asset.*） |
| R9 | showrunner | 建边铁律 | 第 2 步依赖边一律由 showrunner 在门 approved 后用 `canvas.update({edges:[{from,to,auto:true}]})` 建正确方向；**禁止 writer 用 linksTo**（linksTo 派生语义为「从本节点指向目标」，在本步会产出反向边；script-orchestration.test.ts 有防回归锚点） |

### 2-c 分镜文字稿（已实施）

| # | 角色 | 场景 | 目标需求（引自设计书 §4.1/§7.1 与 README §3 裁决①，2026-11-11 用户拍板） |
|---|---|---|---|
| R10 | writer（经 task 委派） | 2-b approved 后，用户发起 2-c | 交接物 input 含小传+分场+台词、`ep:1`；按分场与台词拆成连续镜头，产 `分镜/shotlist.json/.md`（同一 ShotList 事实源）。`shotSize/camera/durationSec` 是**可修改的文字草案**，不是生产定稿；`refs` 恒 `[]`，无本镜台词时 `dialogue:null`。upsert `step-2-storyboard`（step `'2'`、kind `storyboard`）为 active，不带 linksTo、不置 done。 |
| R11 | showrunner | 2-c 发门前 | 读回 ShotList 做结构校验：裸数组且非空、字段恰好 11 个、ep=1、shotNo/rowOrder 为 1..N 连续整数、sceneNo 覆盖分场全部场号、角色 id 合法、action 非空、景别枚举合法、运镜非空、durationSec 正整数、refs 恒 []、dialogue 形状与说话人血缘合法或 null；不合格打回 writer，不发门。 |
| R12 | showrunner | 2-c 定稿 | 合格后 `gate.request({gateId:'2-c',payload:{ref:'分镜/shotlist.json',shotCount,sceneCount,totalSeconds}})`；approved 后节点置 done（parentReference fields=血缘表 storyboard 行）并建 `{from:'step-2-dialogue',to:'step-2-storyboard',auto:true}`。manifest 由系统在 2-c approved 时直推 `storyboard-finalized` 到 `storyboard-done`，Agent 不重复 advance；汇报后等待用户发起第 3 步。 |
| R13 | showrunner | rejected / 恢复 / 边界 | rejected 读 note、委派 writer 重做、重新校验、以同一 gateId 重开；恢复 pending 门不重做产物。2-c 只能在 2-b approved 后启动；沿用同一 `分镜/shotlist.*`，不另设 201/401 双产物；全程零媒体、零资产绑定。 |

## 3. 就绪条件

- STAGE 1 已完成：`故事/故事大纲.json` + `故事/人物小传.json` 存在且门已 approved（manifest 到达 script-scenes）。
- feature-101 诞生的 `CharacterProfile.id` 可被引用；feature-801 状态机、feature-001 门桥、通用 file/canvas 工具落地。
- 2-c 复用既有共享类型 `Shot/ShotDialogue/ShotList`、事件 `storyboard-finalized` 与 GateId `'2-c'`，无需 K1。

## 4. 范围

### 4.1 本做（2-a/2-b 固化既有实现）

- `Scene / SceneBreakdown / DialogueLine / DialogueScene / DialogueScript` 类型形状（契约 §1）。
- 两产物路径、双写、写前归档；active→done 两阶段节点状态与正确方向 auto 边。
- showrunner prompt 内结构校验清单（prompt 纪律，非程序代码）。
- 2-a/2-b 门、payload、scenes-approved/dialogue-approved 事件、parentReference fields。

### 4.2 2-c 已实施

- writer.md 补「分镜文字稿（ShotList 文字草案）」段落；showrunner.md 激活 2-c 编排（交接物、读回结构校验、2-c 门、done、正确方向 auto 边）。
- 在既有门后置映射表登记 `2-c → storyboard-finalized`，由系统推进 `storyboard-done`；不改共享事件类型、不新增 IPC/MCP 工具。
- 新增 STAGE 2 分镜编排测试与门后置测试（产物、门序、结构校验、active/done/边、终态推进、零媒体）。
- 遵守裁决①：201 只产文字草案（`dialogue` 可为 null、`refs` 恒 []），生产化细化归 feature-401 同文件演进。

### 4.3 不做（显式排除）

- 2-a/2-b 不新增 electron 模块 / MCP 工具 / IPC / 共享类型（无 K1/K8）。
- 不做台词/分场内容的程序化 zod 校验（当前为 showrunner prompt 校验清单）。
- 不在本包实现 STAGE 3+ 资产、feature-401 生产分镜、任何媒体生成。
- ~~不回改设计书 §7.1 L554（B-12 仅登记）~~ B-12/B-13 均已于 2026-10-15 修复（见偏差清单 §2）；本补录包快照不改。

## 5. 验收标准

**2-a / 2-b（已落地，由既有测试守护）**

- **AC1**：定稿后恰有 `剧本/分场.json/.md`、`剧本/台词.json/.md`；分场为 `Scene[]` 裸数组（≥3 场、11 字段、sceneNo 连续、characterIds 取自小传），台词为 `DialogueScene[]` 裸数组（sceneNo 覆盖分场、行字段固定、speakerId 合法或 '' 兜底）。
- **AC2**：writer 落盘只 upsert active、不带 linksTo；门 approved 后 showrunner 才置 done 并建 from=上游/to=本步 的 auto 边；linksTo 误带的反向边有防回归锚点。
- **AC3**：门序 2-a→2-b；包裹对象 / 自造字段（如 type/note）在发门前被结构校验打回 writer，不发门；rejected 同 gateId 重开。
- **AC4**：2-a approved → scenes-approved（script-scenes→script-dialogue）；2-b approved → dialogue-approved（script-dialogue→script-storyboard）；done 节点带 parentReference（scenes/dialogue 血缘行）。
- **AC5**：缺故事产物不启动；交接物带 `ep=1`，分场 input 含小传、台词 input 含分场；全程零 comfyui/asset；2-c 前不写 `分镜/` 路径。
- **AC6**：恢复续跑只提示既有 pending 门，不重挂、不重做产物。

**2-c（已实施，自动化验收通过）**

- **AC7**：仅 2-b approved 后可启动 2-c；writer 双写 `分镜/shotlist.json/.md`，ShotList 满足 S8/S16 全部字段、血缘与草案约束，upsert active 且无 linksTo；不合格产物被读回校验打回且不发门。
- **AC8**：2-a→2-b→2-c 门序固定；2-c payload 只含 ref 与摘要，rejected 同 id 重开，pending 恢复不重做。
- **AC9**：2-c approved 后 showrunner 置 done（storyboard 血缘 fields）并建 dialogue→storyboard 的 auto 边；系统且仅系统推进 `storyboard-finalized` 到 `storyboard-done`，重复执行为幂等；Agent 不重复 advance。
- **AC10**：全程零媒体、零资产调用，refs 恒 []；复用 StoryboardView，不新增 UI；与 feature-401 共用 `分镜/shotlist.*`，不设第二产物。2026-11-11 聚焦 2 文件 27 项、全量 83 文件 1058 项通过（1 跳过）；主进程 / preload 构建通过，typecheck 与 renderer 构建仅余基线 3 条历史错误；未做真机人工验收。
