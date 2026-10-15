# feature-101 故事创作链（大纲 + 人物小传）· 需求规格 [反向补录]

> **任务包性质**：[反向补录]——代码与 Agent 提示词**先于本包落地**，本包按《AI-SDG-AI工具执行指令.md》§7 六步法固化既有实现，写的是「代码实际实现了什么」，不是新增开发需求。补录基线 git 锚点：`c1ee4e9`（2026-10-14 全量测试基线清零提交）。
>
> **溯源标签**：[改编]（Design 无短剧专属故事创作链，按摄制组编剧 + 主控分工改编；见设计书 §4.1 编剧 Agent 行）。
>
> **事实源**：[shared/types.ts](../../../shared/types.ts) L156–182、[resources/opencode/agents/writer.md](../../../resources/opencode/agents/writer.md)、[resources/opencode/agents/showrunner.md](../../../resources/opencode/agents/showrunner.md) L141–155、[src/studio/story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts)、[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §7.1（L556–590）。
>
> **解决偏差**：三阶段血缘已落地、长期缺任务包（[features/README.md](../README.md) §1 1xx 行）；本包不新增 B 编号，仅将 STAGE 1 既有实现规格化。本包登记的两个文档/代码偏差见变更记录 R-101-1（B-12 门模型口径、B-13 画布步骤标签；两者均已于 2026-10-15 修复，见偏差清单 §2）。

## 1. 背景（磁盘实况）

STAGE 1 在本仓**没有任何 electron 业务模块、没有专用 MCP 工具、没有内容 zod 校验程序**。它完全由两层 Agent 提示词经通用工具实现（提示词驱动形态）：

- **主控 [showrunner.md](../../../resources/opencode/agents/showrunner.md)「第 1 步故事剧本」段（L141–155，提示词内编号 feature-020）**：负责前置校验、`task` 委派、发确认门、门 approved 后置完画布节点、推进 manifest。
- **编剧 [writer.md](../../../resources/opencode/agents/writer.md)（frontmatter 标 feature-018）**：仅持 5 个 MCP 工具（file.read/list/write + canvas.get/update），负责大纲/小传正文推理、JSON+MD 双写、节点 upsert；不发门、不派 task、不碰媒体。

产物：项目目录 `故事/故事大纲.json/.md`、`故事/人物小传.json/.md`（覆盖前由通用 [electron/fs/archive.ts](../../../electron/fs/archive.ts) 归档到同目录 `版本/`，与立项单的 `立项单.vN.json` 版本化模型不同）。编排契约测试：[story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts) 6 例。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 需求（磁盘实况） |
|---|---|---|---|
| R1 | 用户 | 已发布至少一版立项单后，发起「进入故事」 | showrunner 先 `brief.list` 取 latestVersion、`file.read('立项单.vN.json')` 读最新版立项单作为唯一必需输入；无立项单则不启动第 1 步，明确提示「请先完成立项」，不臆造输入、不读旧 `立项/brief.json` |
| R2 | writer（经 showrunner `task` 委派） | 1-a 故事大纲 | 依据交接物产出 `StoryOutline`，JSON+MD 双写 `故事/故事大纲.json/.md`，并 upsert 节点 `step-1-outline`（step `'1'`、kind `outline`，**带 `linksTo:['step-0-brief']`** 生成 0→1 auto 边）；大纲/小传写作必须委派 writer，showrunner 不自行撰写正文 |
| R3 | showrunner | 1-a 定稿 | 回收委派、核对落盘后，调 `gate.request({ gateId:'1-a', payload:{ ref:'故事/故事大纲.json', logline, episodeCount } })`；payload 只放引用与摘要，不内联全文 |
| R4 | writer（经委派） | 1-b 人物小传 | 1-a approved 后产出 `CharacterProfile[]`（≥2 主要角色，每个带稳定 id 如 `c-linxia`），双写 `故事/人物小传.json/.md`，upsert `step-1-profiles`（kind `profiles`，带 `linksTo:['step-1-outline']`）；交接物 input 为立项单 + 故事大纲 |
| R5 | showrunner | 1-b 定稿 | 核对后调 `gate.request({ gateId:'1-b', payload:{ ref:'故事/人物小传.json', characterIds } })`；**门序固定：1-a approved 前不得发起 1-b** |
| R6 | showrunner | 任一门 approved 收尾 | ① 确认对应节点以 `status:'done'` 上屏，done 的 `canvas.update` 必须带 `parentReference:{ briefVersion, fields }`（fields 取 showrunner.md L123–130 血缘表 outline/profiles 行）；② 调 `manifest.advance`：1-a 后 `outline-approved`（story-outline→story-profiles），1-b 后 `profiles-approved`（story-profiles→script-scenes）；③ 1-b 收尾后向用户汇报两产物路径与角色 id，等待用户发起第 2 步，**不自动执行** |
| R7 | showrunner | 任一门 rejected 或会话中断 | rejected：读 `note` 作修改意见，委派 writer 重做后以**同一 gateId** 重开 pending；不新增门编号、不跳门、不合门；已 approved 门为终态。中断恢复：回合开始先 `canvas.get`+`manifest.get`，pending 门用同一 gateId 重挂，已 done 节点不重做 |
| R8 | 用户 | 全流程 | 全程纯文本，零图像/视频/音乐/语音；showrunner 第 1 步不调任何 `comfyui.*`/`asset.*`，writer 越权工具请求被运行时拒绝（writer 白名单仅 5 工具） |

## 3. 就绪条件

- 至少存在一版 `立项单.vN.json`（由 feature-001 的 `brief.list` 报告 latestVersion）。
- feature-801 的 manifest 7 态机与 `manifest.advance` 工具、feature-001 的确认门桥 `gate.request`、通用 `file.*`/`canvas.*` MCP 工具均已落地（本包直接复用，不新增工具）。
- feature-002 的 `parentReference` 血缘纪律已生效（done 节点必须携带）。

## 4. 范围

### 4.1 本做（固化既有实现）

- `StoryOutline` / `CharacterProfile` / `CharacterProfile[]` 三类共享类型形状（[契约](./SDG-RE-契约.md) §1）。
- 两产物的落盘路径、JSON 源 + MD 镜像双写约定、写前归档行为（复用通用 file.write / archive）。
- 1-a / 1-b 两道确认门的固定次序、payload 形状、rejected 同 id 重开规则。
- 两个 manifest 事件（outline-approved / profiles-approved）的推进时点。
- 画布节点 upsert / done / linksTo / parentReference 纪律。
- 提示词驱动形态的事实边界（无专用工具、无 zod 内容校验、双写非原子，见契约 §5）。

### 4.2 不做（显式排除）

- 不新增任何 electron 模块、MCP 工具、IPC、共享类型（本包**无 K1**）。
- 不做故事内容的程序化结构校验（当前由 writer prompt 纪律 + showrunner 回收核对保证；与 STAGE 2 在 showrunner.md 内列出的结构校验清单不同，STAGE 1 prompt 未列逐条校验项）。
- 不实现立项后变更下的故事重生成（重生成/对齐由 feature-002 的 impact.commit + canvas.align 负责）。
- 不做分场、台词、分镜（分属 feature-201）。
- 不做 UI 改造（OutlineView / ProfilesView 已由既有 [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) 渲染，本包仅在设计说明记录）。
- ~~不回改设计书 §7.1 L554 门模型口径冲突（B-12）~~ 已于 2026-10-15 修复（设计书改口，见偏差清单 B-12）；本补录包快照不改。

## 5. 验收标准

- **AC1**：项目目录在 STAGE 1 定稿后恰有 `故事/故事大纲.json`、`故事/故事大纲.md`、`故事/人物小传.json`、`故事/人物小传.md` 四个文件；JSON 分别为 `StoryOutline` 对象与 `CharacterProfile[]` 裸数组，字段以契约 §1 为准；不产生 `剧本/` 下任何写入。
- **AC2**：门序严格 1-a→1-b；1-a 未 approved 时不出现 1-b 门；rejected 以同一 gateId 重开；两 payload 分别只含 `{ref, logline, episodeCount}` 与 `{ref, characterIds}` 摘要。
- **AC3**：1-a approved 后 manifest 经 `outline-approved` 到 `story-profiles`；1-b approved 后经 `profiles-approved` 到 `script-scenes`；每个 done 节点带 `parentReference`。
- **AC4**：无任何立项单时不启动第 1 步（无 task、无门、无落盘）；中断恢复时 pending 门同 id 重挂、done 节点不重做。
- **AC5**：第 1 步全程零 `comfyui.*`/`asset.*` 调用。
- **AC6**：以上 AC 由 [story-orchestration.test.ts](../../../src/studio/story-orchestration.test.ts) 6 例与 369/0/1 全量基线持续守护；本包不新增测试（既有测试即契约证据）。
