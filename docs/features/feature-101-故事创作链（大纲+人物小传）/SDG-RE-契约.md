# feature-101 故事创作链 · 契约 [反向补录]

> 配套：[需求规格](./SDG-RE-需求规格.md) / [任务清单](./SDG-RE-任务清单.md)。
>
> **事实源（逐字段核对依据）**：[shared/types.ts](../../../shared/types.ts) L156–182（数据形状）、[writer.md](../../../resources/opencode/agents/writer.md) L48–59（字段纪律）、[showrunner.md](../../../resources/opencode/agents/showrunner.md) L121–155（血缘/门/manifest）、[electron/mcp/tools.ts](../../../electron/mcp/tools.ts)（通用工具）。
>
> **形态声明**：本契约描述的是**提示词驱动实现**——除共享类型与通用 MCP 工具外，没有面向故事内容的代码层 schema 校验。字段约束的执行主体是 Agent（按 prompt 自律），不是程序。

## 1. 数据 schema（shared/types.ts，只读复用，本包零改动）

### 1.1 StoryOutline（故事大纲；[types.ts L157–168](../../../shared/types.ts#L157-L168)）

```ts
interface StoryOutline {
  logline: string        // 一句话故事
  seasonArc: string      // 本季主线
  themes: string[]       // 主题/情绪关键词
  conflicts: string[]    // 核心冲突/钩子设计
  episodes: { ep: number; title: string; synopsis: string; hook: string }[] // 至少含 E01
}
```

- **S1**：落盘顶层即 `StoryOutline` 对象本身，禁止 `{schema, version, projectId, title, outline:{...}}` 等包裹；禁止 `fourActs / keyPlotPoints / characterSeeds` 等平行结构（writer.md L54，幕结构须融入 `seasonArc`/`conflicts`/`synopsis` 文本）。
- **S2**：`episodes` 至少 1 项且含 E01；集数与立项单集数大体一致（prompt 约束，无程序校验）。
- 该类型无 `id` / `version` / `status` 字段——业务身份由文件路径与画布节点承载。

### 1.2 CharacterProfile（人物小传单角色；[types.ts L171–182](../../../shared/types.ts#L171-L182)）

```ts
interface CharacterProfile {
  id: string             // 稳定主键，如 c-linxia
  name: string
  age: string            // 注意：string，非 number
  role: string           // 身份/职业
  personality: string
  background: string     // 须与故事背景档案一致
  motivation: string
  arc: string            // 人物弧光
  relationships: string
  voice: string          // 台词风格/音色提示
}
// 产物文件形状：CharacterProfile[] 裸数组
```

- **S3**：`故事/人物小传.json` 顶层是 `CharacterProfile[]` 裸数组，**≥2 个主要角色**；禁止对象包裹。
- **S4**：`id` 是跨产物主键的诞生点（建议 `c-<拼音/英文>`），向下贯穿 `Scene.characterIds` / `DialogueLine.speakerId` / `Shot.characterIds`，下游不得重生（showrunner.md L148）。
- **S5**：全部 10 字段恰好如下，不多不少（writer.md L55–59 枚举）；`age` 类型为 string。

## 2. 落盘与版本约定

| 产物 | JSON 路径 | MD 镜像 | 画布节点 |
|---|---|---|---|
| 故事大纲 | `故事/故事大纲.json` | `故事/故事大纲.md` | `step-1-outline`（step `'1'`、kind `outline`） |
| 人物小传 | `故事/人物小传.json` | `故事/人物小传.md` | `step-1-profiles`（kind `profiles`） |

- **S6 双写**：JSON 为事实源，MD 是给人读的同内容排版，**不得引入 JSON 中没有的事实性新设定**（writer.md L79）。
- **S7 非原子**：双写是 Agent 连续调用两次 `file.write`（prompt 契约），平台不提供跨两文件的事务保证；单次 `file.write` 经写队列串行入队。
- **S8 写前归档（与立项单不同）**：故事/剧本产物是「单最新版 + 覆盖前归档」——旧文件由 [electron/fs/archive.ts](../../../electron/fs/archive.ts) L14–35 移到同目录 `版本/<base>.<YYYYMMDD-HHmmss><ext>`（同秒冲突追加 `.N`），归档失败抛错阻断写入。**不采用**立项单的 `立项单.vN.json` 全量版本化命名。
- **S9 目录固定**「故事/」；禁止写旧路径 `剧本/故事大纲.json`、`剧本/人物小传.json`（showrunner.md L154）。

## 3. 复用的通用 MCP 工具（本包不新增工具）

| 工具 | 本步用途 | 关键约束 |
|---|---|---|
| `brief.list` / `file.read` | 取 latestVersion 并读 `立项单.vN.json` | 唯一必需输入；latestVersion 为 null 即不启动 |
| `file.list` / `file.read` | 先读后写、读既有产物 | writer 不臆造项目中不存在的设定 |
| `file.write` | JSON 与 MD 双写 | zod 仅校验入参 `{path:string.min(1), content:string}`（[tools.ts 约 L103–122](../../../electron/mcp/tools.ts)）；**不校验故事内容结构**；返回 `{ok,path,archived:string[]}` |
| `canvas.get` / `canvas.update` | 恢复、节点 upsert、done、血缘 | writer upsert 带 `linksTo`；done 必须带 `parentReference`；`dirty` 无写入入口 |
| `gate.request` | 发 1-a / 1-b 门 | 仅 showrunner 可调；writer 白名单不含 gate |
| `manifest.get` / `manifest.advance` | 读状态、门 approved 后推进 | 见 §4 |

writer 白名单恰为 5 个：file.read / file.list / file.write / canvas.get / canvas.update（[writer.md frontmatter L14–31](../../../resources/opencode/agents/writer.md#L14-L31)）。

## 4. 确认门与 manifest 事件

| 门 | 时点 | payload（只放引用与摘要） | approved 后动作 |
|---|---|---|---|
| `1-a` | 大纲落盘并核对后 | `{ ref:'故事/故事大纲.json', logline, episodeCount }` | 节点 done（带 parentReference，fields=血缘表 outline 行）→ `manifest.advance({event:'outline-approved'})` |
| `1-b` | 小传落盘并核对后 | `{ ref:'故事/人物小传.json', characterIds }` | 节点 done（fields=profiles 行）→ `manifest.advance({event:'profiles-approved'})` |

- **S10 门序固定**：1-a approved 前不得发 1-b；rejected 读 `note`、委派 writer 重做后以**同一 gateId** 重开；approved 为终态，同 id 再请求报错。
- **S11 状态机**（[manifest.ts L24–34](../../../electron/project/manifest.ts#L24-L34)）：`outline-approved`: story-outline→story-profiles；`profiles-approved`: story-profiles→script-scenes。门与状态机解耦——门 approved 不会自动推进，必须由 showrunner 显式调 `manifest.advance`。
- **S12 parentReference.fields 固定取值**（showrunner.md L125–126）：
  - outline 行：`kind`、`premise.leads/time/place/coreEvent/seasonBoundary`、`fiveElements.genre/platforms/tone`、`style.mainStyleId/catalogVersion`；
  - profiles 行：`premise.leads/coreEvent/seasonBoundary`、`fiveElements.genre/tone`、`style.mainStyleId/catalogVersion`。
  - 平台不校验字段名合法性（少声明 = 后续改立项时漏标影响，责任在 showrunner prompt）。

## 5. 错误码与边界（无故事专属错误码）

- 本步不定义任何故事内容错误码；工具层失败统一走通用错误信封（[tools.ts fail/normalize/respond](../../../electron/mcp/tools.ts) 约 L38–58）。
- 缺立项单、门序违例、字段不符等均由 **Agent 对话层处理**（停止/重做/打回），不产生程序化错误码；manifest 乱序推进抛 `MANIFEST_BAD_TRANSITION`（feature-801 既有）。
- 零媒体：不调 `comfyui.*` / `asset.*`；writer 请求越权工具被运行时按白名单拒绝。

## 6. 契约证据（测试映射）

[story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts)（describe「C4 · showrunner 第 1 步编排契约」，6 it）：

1. 两门按序 1-a→1-b；大纲/小传均 task 委派 writer；产物落「故事/」。
2. 1-a rejected：同一 gateId 重开，不新增/跳/并门；1-b 仍在 approved 之后。
3. 节点 upsert 带 linksTo：outline→brief、profiles→outline 表达跨步骤 auto 边。
4. 第 1 步不触媒体：无 comfyui / asset 调用。
5. 缺 brief 不启动：无 task / 门 / 落盘，仅 canvas_get 后告知。
6. 恢复续跑：pending 门重挂同一 gateId，不重做产物。

> 已知测试覆盖缺口（如实记录，不在本包补）：该测试的脚本化 fake showrunner **未模拟 done upsert 的 parentReference、未断言 manifest.advance 调用**；S11/S12 的代码事实由 feature-801/002 的测试与 showrunner.md 文本守护，本包不虚构其在 STAGE 1 测试中的断言。
