# SDG-AI 变更记录 · feature-021 垂直切片·剧本分场（第 2 步）

> 本记录按三分类维护：**决策记录**（K 卡口，永久保留）/ 实施记录（落地后可清理）/ 修订记录（决策稳定后可清理）。

---

## 一、决策记录（永久保留）

### D-021-01 ｜ 规格阶段范围与路径决策 ｜ 2026-10-07

调研发现旧 App（feature-004）把 2-a 分场、2-b 台词、2-c 分镜全归入 STAGE 2，与八步闭环（分镜归第 4 步）及 feature-016 Agent 分工（writer 出分场/台词，media-director 出分镜/镜头）冲突。用户在规格起草前确认以下决策：

1. **第 2 步范围 = 2-a 分场 + 2-b 台词两门**，writer 纯文本；**2-c 分镜移出**，归第 4 步（media-director），门编号在第 4 步切片再定。
2. **落盘目录 = `剧本/`**（feature-016 §4.2 既定）：`剧本/分场.json/.md`、`剧本/台词.json/.md`，与「故事/」并列；不写 `分镜/` 路径。
3. **不经旧 IPC**：沿用 feature-020 模式，writer 直接 `shortdrama_file_write` 落盘；验收后 C9 拆除 `enterScript` / `saveScript` / `readScriptContext`（触发 K3，白名单见契约 §8）。
4. **本切片只做第一集（ep=1）**；多集复用同流程，不验收。
5. **输入**：必需 `立项/brief.json` + `故事/故事大纲.json` + `故事/人物小传.json`；`故事背景档案.md` 可选，缺不报错。

依据：《短剧Agent平台设计.md》第 44、363、406-419 行；feature-016 契约 §4.2/§5；feature-020 D-020-01 与闭环事实。

### D-021-02 ｜ C7 真机验收不通过 · 返工路径决策 ｜ 2026-10-07

C7 方式 A（复用真实 writer 大纲/小传组装夹具 project-20261007-f021-fixture）真机跑通全流程，但取证发现 3 处偏差：① 分场/台词 JSON 均为包裹对象且字段名自造（heading/time/interior/durationSec/goal；type/note）；② 两条 auto 边方向反转（scenes→profiles、dialogue→scenes）；③ dialogue 节点已 done 而 2-b 门仍 pending。用户裁决：

1. **边修法**：showrunner 不再用 linksTo，门 approved 后用 `canvas_update({ edges:[{ from:上游, to:本节点, auto:true }] })` 直建正确方向边；契约 §3.2 同步修订（edges.ts / types.ts 不动，无 K1）。
2. **Schema 加固**：showrunner 发门前必须 file_read 做结构校验（裸数组 + 字段名/枚举），不合格打回 writer、不发门；不新增 IPC/MCP 工具。
3. **重验**：复用同一夹具，重置回第 1 步完成态后重跑，含一次 2-a rejected 同 id 重开。

根因：v1.0 契约 §3.2「linksTo:[上游]」与 edges.ts「from=本节点、to=目标」语义相反，C4 仅断言 linksTo 入参未跑 deriveAutoEdges 故未拦截；writer profile 字段明细虽正确但模型未逐字遵守，缺结构校验闸门。

### D-021-03 ｜ 共享 reducer「messageId 锁」缺陷定性与修复 ｜ 2026-10-07

C7 返工准备阶段定位到旧 App / 新工作台共用的 reducer（feature-010 共享层）存在轮次聚合缺陷：一次用户 prompt 在 showrunner 下产生多个不同 messageId 的 assistant 消息（opencode 每个 LLM step 一条，全部 parentID 指向同一条 user 消息），旧 reducer 以 messageId 为聚合锁，导致跨 step 的 assistant 事件被拆成多个轮次、汇报气泡丢失。裁决：

1. 轮次边界改为 **session.idle**；running 期间跨 messageId 聚合所有 assistant 事件进同一 turn，`turn.messageId` 保留首个消息 id（供定稿幂等）。
2. turnText 取值：有 text 快照 → 按 partId 插入顺序拼接快照全文；无任何 text 快照时才回退 deltaPreview.text。
3. 不新增 IPC；修复落在 `src/lib/chat-runtime.ts`，真机只读轮次验证（见 E-021-04）。

## 二、实施记录（落地后清理）

### E-021-02 ｜ C7 返工编码（C1/C2/C4 增量） ｜ 2026-10-07

- `resources/opencode/agents/showrunner.md`：第 2 步改写——建边铁律（禁 linksTo）、writer 只 active、发门前结构校验清单、approved 后同一次 update 置 done + edges。
- `resources/opencode/agents/writer.md`：新增纪律 5（第 2 步只 upsert active、不带 linksTo、不置 done）。
- `src/studio/script-orchestration.test.ts`：重写为 11 用例，新增 patch.edges 方向断言、deriveAutoEdges 防回归锚点、包裹对象/自造字段打回不发门、done 时序；11/11 通过。
- 契约 §3.2 修订、§4.1 新增结构校验条款。

### E-021-03 ｜ C7 重验通过（含 rejected 同 id 重开） ｜ 2026-10-07

- 夹具重置回第 1 步完成态、重装 profile、重启 dev 后重跑第 2 步：2-a 首次 rejected、showrunner 据 note 以**同一 gateId**重开并覆盖内容，随后 2-a/2-b 依次 approved。
- 产物复核：`剧本/分场.json`（4092B，4 场裸数组，字段名/枚举合规）、`剧本/台词.json`（7113B，4 scene 共 31 行），分场总时长 89s；MD 镜像齐备；节点 done、`step-1-profiles→step-2-scenes` 与 `step-2-scenes→step-2-dialogue` 两条 auto 边方向正确。
- 两门过后 showrunner 只汇报"可入第 3 步"，未自动执行，符合门序边界。

### E-021-04 ｜ reducer 修复真机复验（R6，只读轮次） ｜ 2026-10-07

重启后的 Electron 发起一次只读、多 step、不触发门/不改产物的轮次，助手汇报气泡（跨 messageId 聚合文本）完整落盘：分场 4 场（3+4+6+4 拍、总 89s）、出场角色 c-linxia/c-suxiao/c-guyu、台词 31 行（7+8+9+7），结论"可入第 3 步、需用户明确发起"。stat 确认三件产物时间戳早于本轮、未被改动。D-021-03 修复在真机生效。

### E-021-05 ｜ C9 门控拆除 + C8 夹具清理 ｜ 2026-10-07

严格按契约 §8 白名单执行，只删剧本（旧 STAGE 2）链路，未触碰第 0/1 步：

- **IPC / 类型层**：`electron/session.ts` 删除 `enterScript`/`readScriptContext`/`saveScript` 及仅被其使用的 `speakerDisplay`/`namesOf`/`cell`/`renderScenesMd`/`renderDialogueMd`/`renderStoryboardMd`；`electron/main.ts` 删除 `script:enter`/`script:save` handler 及失效类型 import；`electron/preload.ts`、`src/global.d.ts` 删除对应键与 import。
- **前端编排层**：`src/lib/gates.tsx` 删除 `buildGate2a/2b/2c`；`src/App.tsx` 删除 handleEnterScript、canEnterScript、ScriptEntryCta、product dispatch 的 openGate 分支、adoptAiCandidate 的 bundle 映射、handleConfirm/handleReject/restore 的 2-a/2-b/2-c 分支，以及三个只写不读的 `scenes/dialogue/storyboard` state 与全部 setter 调用。
- **保留**：第 2 步节点卡只读 active/done 展示、画布 STAGE 2 分组与失效态；`scriptRedo` 的 App state、workflow 快照、replay 底层字段（沿用 feature-020 storyRedo 先例）。
- **废弃测试**：删除 `src/lib/gates-script.test.ts`（6 用例）；删除 `src/App.restore.test.tsx` 中「feature-004 剧本分镜集成」整块 4 用例（CTA、enterScript 自动分场、三门全链路 saveScript、2-a 否决重做）及 `scriptReadyMessages` 辅助函数；清理 5 个测试文件（catalog/revision/error-envelope/restore/feature006-ui）的 `enterScript`/`saveScript` mock 键。
- **C8**：关闭遗留 dev Electron + opencode serve 进程树，删除人造夹具目录 `project-20261007-f021-fixture`（其它历史项目保留），`session-state.json` currentDir 复位 null。
- **自检（清理后）**：typecheck exit 0；test:run 57 文件 / **533 passed、1 skipped**；build:electron 通过。

## 三、修订记录（决策稳定后清理）

- v1.0 → **v1.1（2026-10-07）**：契约 §3.2（linksTo → approved 后 patch.edges 直建）、§4.1（发门前结构校验）；需求 FR-11 / AC 与本记录同步；本切片验收通过。
