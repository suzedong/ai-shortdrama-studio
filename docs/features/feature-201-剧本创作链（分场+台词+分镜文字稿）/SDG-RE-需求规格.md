# feature-201 剧本创作链（分场 + 台词 + 分镜文字稿）· 需求规格 [反向补录]

> **任务包性质**：[反向补录]——按《AI-SDG-AI工具执行指令.md》§7 六步法固化既有实现，写「代码实际实现了什么」。补录基线 git 锚点：`c1ee4e9`（2026-10-14）。
>
> **落地状态（用户 2026-10-15 拍板）**：**2-a 分场、2-b 台词已落地**（[已完成·反向补录]）；**2-c 分镜文字稿尚未实现，列为本文档内待实施任务（不虚构）**。包状态 = 部分落地。
>
> **溯源标签**：[改编]（设计书 §4.1 L435 编剧职责含「分镜文字稿」；分场/台词为短剧编剧链改编）。
>
> **事实源**：[shared/types.ts](../../../shared/types.ts) L184–236、[writer.md](../../../resources/opencode/agents/writer.md) L60–78、[showrunner.md](../../../resources/opencode/agents/showrunner.md) L157–180（2-a/2-b 落地）与 L169（2-c 预留不执行）、[script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts)（11 it）、[features/README.md](../README.md) §3 裁决①（D-013）。
>
> **解决偏差**：三阶段血缘已落地、缺任务包；不新增 B 编号描述已落地部分。随包登记 B-12（门模型口径）、B-13（画布步骤标签），见变更记录 R-201-2。

## 1. 背景（磁盘实况）

与 feature-101 同构：STAGE 2 **无 electron 业务模块、无专用 MCP 工具、无 zod 内容校验程序**，由 showrunner「第 2 步剧本分场剧本」段（showrunner.md L157–180，提示词内编号 feature-021）编排、writer（writer.md，frontmatter 标 feature-018；分场/台词类型注释标 feature-004）经通用工具产出。

- **已落地**：`剧本/分场.json/.md`（SceneBreakdown）、`剧本/台词.json/.md`（DialogueScript）；门 `2-a`/`2-b`；manifest 事件 `scenes-approved`/`dialogue-approved`。
- **未实现**：showrunner.md L169 明确「**2-c 预留（feature-201，当前不执行）**……当前版本不产分镜文字稿、不发 2-c 门、不调此事件」；writer.md 无任何 Shot/shotlist/分镜段落；`Shot`/`ShotList` 类型与 `storyboard-finalized` 事件、`'2-c'` GateId 已在共享层/状态机预留，但生产链路零写入、零测试、UI 仅 dev-mock 演示。
- 编排契约测试：[script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts) 11 it（含「不写分镜路径」用例，反向锁定 2-c 未启用）。

## 2. 谁在什么场景下要做什么

### 2-a 分场 / 2-b 台词（已落地）

| # | 角色 | 场景 | 需求（磁盘实况） |
|---|---|---|---|
| R1 | showrunner | 用户发起「进入剧本分场」 | 必需输入：最新版立项单（brief.list→file.read）、`故事/故事大纲.json`、`故事/人物小传.json`（故事背景档案可选，缺不报错）；缺大纲/小传则不启动，提示「请先完成故事」，不臆造输入。本步只做第一集 `ep=1` |
| R2 | writer（经 task 委派） | 2-a 分场 | 产 `SceneBreakdown`（≥3 场，场号 1..N 连续），双写 `剧本/分场.json/.md`，upsert 节点 `step-2-scenes`（step `'2'`、kind `scenes`）为 **`status:'active'`，不带 `linksTo`、不置 done**；交接物 input 含立项单+大纲+小传、`ep:1` |
| R3 | showrunner | 2-a 发门前 | `file.read('剧本/分场.json')` 逐条过**结构校验清单**（showrunner.md L173：裸数组 / 字段恰好 11 个 / ep 恒 1 / 枚举合法 / estSeconds 正整数 / beats 非空 / characterIds 全在小传 / ≥3 场）；不合格不发门，委派 writer 指明不符点重做后再校验 |
| R4 | showrunner | 2-a 定稿 | 合格后调 `gate.request({ gateId:'2-a', payload:{ ref:'剧本/分场.json', sceneCount, totalSeconds } })`；approved 后一次性 `canvas.update`：节点置 done（带 parentReference，fields=血缘表 scenes 行）+ 边 `{from:'step-1-profiles', to:'step-2-scenes', auto:true}`，再 `manifest.advance({event:'scenes-approved'})`（script-scenes→script-dialogue） |
| R5 | writer（经委派） | 2-b 台词 | 交接物 input 为小传+分场；产 `DialogueScript`（按场组织，sceneNo 覆盖分场全部场号），双写 `剧本/台词.json/.md`，upsert `step-2-dialogue`（kind `dialogue`）为 active（不带 linksTo、不置 done）；有名角色 speakerId 取小传 id，功能角色用 `''`+`speakerName` 兜底 |
| R6 | showrunner | 2-b 发门前 | `file.read('剧本/台词.json')` 过结构校验清单（L174：裸数组 / scene 字段恰好 `ep,sceneNo,lines` / sceneNo 覆盖分场 / 行字段恰好 `speakerId,speakerName?,kind,text,emotion,action?` / kind 枚举 / speakerId 取自小传或 '' 兜底）；不合格打回 |
| R7 | showrunner | 2-b 定稿与交接 | `gate.request({ gateId:'2-b', payload:{ ref:'剧本/台词.json', sceneCount, lineCount } })`；approved 后置 done（parentReference fields=dialogue 行）+ 边 `{from:'step-2-scenes', to:'step-2-dialogue', auto:true}` + `manifest.advance({event:'dialogue-approved'})`（script-dialogue→script-storyboard）；随后汇报并等待用户发起第 3 步，**不自动执行** |
| R8 | showrunner | rejected / 中断 / 边界 | rejected 同 2-c：读 note、委派 writer 重做（节点保持/重开 active）、重新结构校验、以**同一 gateId** 重开；门序固定 2-a approved 前不得发 2-b；目录固定「剧本/」，不写「分镜/」；全程零媒体（不调 comfyui.*/asset.*） |
| R9 | showrunner | 建边铁律 | 第 2 步依赖边一律由 showrunner 在门 approved 后用 `canvas.update({edges:[{from,to,auto:true}]})` 建正确方向；**禁止 writer 用 linksTo**（linksTo 派生语义为「从本节点指向目标」，在本步会产出反向边；script-orchestration.test.ts 有防回归锚点） |

### 2-c 分镜文字稿（待实施，当前不满足）

| # | 角色 | 场景 | 目标需求（未实现，引自设计书 §4.1/§7.1 与 README §3 裁决①） |
|---|---|---|---|
| R10 | writer + showrunner | 2-b approved 后 | 产出 `分镜/shotlist.json/.md` **分镜文字稿**：`ShotList`，一期空镜 `dialogue:null`、`refs:[]`（不排资产、不排生产镜），在同一文件内为 feature-401 预留两阶段演进（裁决① D-013）；发 `2-c` 门；approved 后置完节点并 `manifest.advance({event:'storyboard-finalized'})`（script-storyboard→storyboard-done 终态）。**当前 showrunner L169 显式不执行、writer.md 无分镜段，故列为待实施。** |

## 3. 就绪条件

- STAGE 1 已完成：`故事/故事大纲.json` + `故事/人物小传.json` 存在且门已 approved（manifest 到达 script-scenes）。
- feature-101 诞生的 `CharacterProfile.id` 可被引用；feature-801 状态机、feature-001 门桥、通用 file/canvas 工具落地。
- （2-c 待实施前置）共享类型 `Shot/ShotDialogue/ShotList`、事件 `storyboard-finalized`、GateId `'2-c'` 已预留（均已存在，无需 K1）。

## 4. 范围

### 4.1 本做（2-a/2-b 固化既有实现）

- `Scene / SceneBreakdown / DialogueLine / DialogueScene / DialogueScript` 类型形状（契约 §1）。
- 两产物路径、双写、写前归档；active→done 两阶段节点状态与正确方向 auto 边。
- showrunner prompt 内结构校验清单（prompt 纪律，非程序代码）。
- 2-a/2-b 门、payload、scenes-approved/dialogue-approved 事件、parentReference fields。

### 4.2 2-c 待实施（本包只登记任务，不实现）

- writer.md 补「分镜文字稿（ShotList 文字稿形态）」段落；showrunner.md L169 由「预留不执行」改为激活剧本（交接物、2-c 门、done + storyboard-finalized、建边）；
- 新增 STAGE 2 分镜编排测试（产 `分镜/shotlist.json`、2-c 门序、终态推进）；
- 遵守裁决①：201 只产文字稿（dialogue 可为 null、refs 恒 []、不排镜），生产化（refs/景别/运镜/时长升级）归 feature-401 同文件演进。

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
- **AC5**：缺故事产物不启动；交接物带 `ep=1`，分场 input 含小传、台词 input 含分场；全程零 comfyui/asset；不写 `分镜/` 路径。
- **AC6**：恢复续跑 pending 门同 id 重挂、不重做。以上由 [script-orchestration.test.ts](../../../src/studio/script-orchestration.test.ts) 11 it + 369/0/1 基线守护。

**2-c（待实施，完成后方可勾选）**

- **AC7**：2-b 之后产出 `分镜/shotlist.json/.md` 文字稿（ShotList；一期 refs 恒 []、空镜 dialogue:null），发 2-c 门；approved 后 storyboard-finalized 推进到 storyboard-done；writer/showrunner 提示词与编排测试同步落地；不与 feature-401 设两个产物文件。
