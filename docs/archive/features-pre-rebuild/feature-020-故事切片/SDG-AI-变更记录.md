# SDG-AI 变更记录 · feature-020 垂直切片·故事（第 1 步）

> 本记录按三分类维护：**决策记录**（K 卡口，永久保留）/ 实施记录（落地后可清理）/ 修订记录（决策稳定后可清理）。

---

## 一、决策记录（永久保留）

### D-020-01 ｜ 规格阶段三项关键选择 ｜ 2026-10-07

用户在规格起草前就三个分歧点拍板（AskUserQuestion）：

1. **落盘目录 = 新「故事/」目录**：大纲/小传写 `故事/故事大纲.json/.md`、`故事/人物小传.json/.md`，采用 feature-016 契约 §4.2 目标布局；不沿用旧 `剧本/` 路径。
2. **验收后拆除旧故事链路**：本切片 C9 删除 `story:enter`/`story:save` IPC 与旧 App 故事编排（触发 K3），旧 App 整体壳保留至 feature-022。
3. **以 brief.json 为第 1 步输入**：不强制旧设计的「故事背景档案.md」，缺档案不报错、不补造。

依据：《短剧Agent平台设计.md》第 43、403-418 行；feature-016 契约 §4.2；feature-019 已交付 `立项/brief.json`。

## 二、实施记录（落地后清理）

### E-020-01 ｜ C7 真机验收（dev）通过 ｜ 2026-10-07

环境：dev job（Electron + opencode serve 127.0.0.1:4096），验收项目 `project-20261007-173000-k7p9`，输入 `立项/brief.json`。

验收事实（对应任务清单 C7「完整 1-a/1-b（含一次 rejected 同 id 重开），大纲/小传落盘、节点 done、0→1 连线」）：

1. **门流程**：两门均由 showrunner 发起、正文均经 `task` 委派 writer（showrunner 未自撰正文）。
   - 1-a：pending → rejected（note 指出大纲不符合 StoryOutline schema）→ **同一 gateId 重开 pending** → approved。
   - 1-b：pending → rejected（note 指出字段名 roleType/identity/speechStyle 等不合规）→ **同一 gateId 重开 pending** → approved。
   - rejected 非终态、同 id 重开与 feature-019 D-004 门语义一致；approved 为终态。
2. **落盘**：`故事/故事大纲.json/.md`、`故事/人物小传.json/.md` 四文件齐备；file_write 对旧版自动归档至 `故事/版本/`。
3. **产物合规性**：
   - 大纲：logline/seasonArc（string）、themes[5]、conflicts[5]、episodes 80 集（元素含 ep/title/synopsis/hook），集数与 brief 一致。
   - 小传：CharacterProfile 数组 9 个角色，逐角色严格校验字段恰好为 `id,name,age,role,personality,background,motivation,arc,relationships,voice`（STRICT: true）。
4. **画布**：`step-1-outline`、`step-1-profiles` 均 status=done 且 ref 指向故事产物；边含 `step-1-outline → step-0-brief (auto)`、`step-1-profiles → step-1-outline (auto)`。
5. **收尾**：1-b approved 后 showrunner 汇报两份产物路径与 9 个角色 id，声明「可进入第 2 步剧本分场……不会自动执行」，未实现也未触发第 2 步；全程纯文本，无媒体、无 comfyui/asset 调用、未新增 IPC/MCP、未改 shared/types.ts。

### E-020-02 ｜ C9 门控清理（K3）执行登记 ｜ 2026-10-07

C6/C7 已通过，按 D-020-01 第 2 条与任务清单 F 节，**规格 v1.0 签字即视为用户授权**契约 §8 白名单。现启动 K3（旧系统弃用）：拆除 `story:enter`/`story:save` IPC、旧 App 故事编排、buildGate1a/1b 及其废弃用例；旧 App 整体壳与第 0 步只读展示保留。清理前后各跑一次自检（typecheck / test:run / build:electron），删除的废弃测试用例在本记录登记。

**已放行偏差（E-020-01）**：`故事大纲.json` 含 4 个 schema 外包裹字段 `schema/version/projectId/title`（writer 自行添加）；StoryOutline 核心字段全部合规，下游按字段读取不受影响。验收放行，下游步骤不依赖这 4 个字段；如需收紧，在后续 feature 的 profile 正文中继续强化，不在工具侧加业务校验。

### E-020-03 ｜ C9 门控清理实施结果 ｜ 2026-10-07

严格按契约 §8 白名单执行，未触碰第 0 步与第 2 步链路，未新增 IPC/MCP、未改 shared/types.ts。

**代码删除/修改**：
1. IPC/类型层：[session.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/session.ts) 删 `enterStory`、`saveStory` 及仅被其使用的 `renderOutlineMd`/`renderProfilesMd`（删前 grep 确认无其他引用）；[main.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/main.ts) 删 `story:enter`/`story:save` handler 及仅其使用的类型 import；[preload.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/electron/preload.ts) 删两键；[global.d.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/global.d.ts) 删对应类型键。
2. 门构建器：[gates.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/lib/gates.tsx) 删 `buildGate1a`/`buildGate1b` 及类型 import。
3. [App.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/App.tsx)：删 handleEnterStory、1-a/1-b confirm/reject 编排、StoryEntryCta 引用、自动连跑与 restore 中两门重开分支；另删只写不读的死 state `storyOutline` 及其全部 setter（清理后 typecheck 暴露，其只读详情在 restore 中由局部变量 `storyOutlineV` 装配）。故事节点只读展示（节点卡、失效态、STAGE 1 分组标题、outlineDetail/profilesDetail）保留；storyRedo 底层 state 与 workflow/replay 字段不属白名单，保留。

**删除/改写的废弃测试**：
- [gates.test.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/test/gates.test.tsx)：删 buildGate1a（3 例）/buildGate1b（2 例）及 fixtures。
- [session-archive.test.ts](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/test/session-archive.test.ts)：删 saveStory 用例。
- [App.restore.test.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/App.restore.test.tsx)：删「故事创作集成（feature-003）」5 例；删「1-a 首审待定」门恢复用例。
- [App.revision.test.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/App.revision.test.tsx)：删「② AI 对话（1-a）」与「⑥ 链上 0-c confirm 后 CTA」两个 describe 及 outlineB/C fixtures。
- [feature006-ui.test.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/feature006-ui.test.tsx)：「门控期间去修改置灰」用例由 1-a 场景改为 0-a（诊断门，wf 提供 idea done 状态），通用行为断言不变。
- 4 个测试文件（上述 + App.catalog/App.error-envelope）的 window.api mock 同步删 enterStory/saveStory 键。

**白名单外保留项**：组件文件 [StoryEntryCta.tsx](file:///Users/szd/Documents/Code/ai-shortdrama-studio/src/components/messages/StoryEntryCta.tsx) 契约未列删除，保留（已无引用），留待 feature-022 旧壳下线处理。

**清理后自检**：typecheck exit 0；test:run 57 files 全过（529 passed / 1 skipped）；build:electron exit 0。

## 三、修订记录（决策稳定后清理）

### R-020-01 ｜ writer.md 内嵌 StoryOutline / CharacterProfile 字段明细 ｜ 2026-10-07

真机首轮发现 writer 产出错 schema（大纲出现 fourActs/keyPlotPoints/characterSeeds 等平行结构、缺 seasonArc/themes/conflicts/episodes；小传用 roleType/identity/speechStyle 替代 role/voice 并多 appearance）。

根因：writer 为 subagent，工具域仅 file_read/list/write + canvas（无 read 内置工具），无法读仓库 `shared/types.ts`；原 writer.md 只按名称引用 schema。

修订：writer.md「## 产物结构」节内嵌两类 schema 的完整字段名、类型与中文注释，要求「字段恰好如下，不多不少」「不自行发明平行结构，丰富设计融入 seasonArc/conflicts/synopsis 文本」「MD 镜像不引入 JSON 中没有的事实性新设定」。frontmatter（mode/temperature 0.3/工具白名单）未动。安装态 profile（`~/Library/Application Support/ai-shortdrama-studio/opencode/agents/writer.md`）已同步（占位符替换为 ark-code-latest）。修订后 writer 两轮重做产物合规。

属任务清单 F 节卡口所述「profile 正文强化」路径，未在工具侧添加任何业务逻辑。
