# SDG-RE-任务清单 · feature-004-剧本分镜

> **版本**：v1.2（2026-10-03）：**T1–T9 全部完成、AC-1~AC-13 全部通过，feature-004 收官**。真机全流程核对通过（T9-4），测试 99/99 全绿（10 文件）、tsc 零错误；T9-4 真机发现并修复 GateCard 阶段角标硬编码 L1 缺陷。
> v1.1（2026-10-03）：T1–T9-3 与 AC-1~AC-13 实施完成（`test:run` 94/94 全绿、`tsc -b` 零错误、`vite build` 成功）。T9-4 为真机会话产物人工核对项，待 `npm run dev` 内走完整流程后勾选。

## 上下文加载清单

开始与本 Feature 相关工作前，逐项读取：

- [ ] [AGENTS.md](../../../AGENTS.md) — 铁律、卡口、工作围栏
- [ ] [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §2、§3.2、§3.3、§4.1、§7、§9、§11
- [ ] [SDG-RE-需求规格.md](./SDG-RE-需求规格.md)
- [ ] [SDG-RE-契约.md](./SDG-RE-契约.md) — **最高优先级**
- [ ] [SDG-OD-设计说明.md](./SDG-OD-设计说明.md)
- [ ] 现状代码（feature-003 已交付，本包直接复用模式）：
  - [shared/types.ts](../../../shared/types.ts)
  - [electron/main.ts](../../../electron/main.ts)、[session.ts](../../../electron/session.ts)、[prompts.ts](../../../electron/prompts.ts)、[ark.ts](../../../electron/ark.ts)、[preload.ts](../../../electron/preload.ts)
  - [src/App.tsx](../../../src/App.tsx)、[src/global.d.ts](../../../src/global.d.ts)
  - [src/components/StageCanvas.tsx](../../../src/components/StageCanvas.tsx)、[ChatPanel.tsx](../../../src/components/ChatPanel.tsx)
  - [src/components/messages/OutlineCard.tsx](../../../src/components/messages/OutlineCard.tsx)、[ProfilesCard.tsx](../../../src/components/messages/ProfilesCard.tsx)、[StoryEntryCta.tsx](../../../src/components/messages/StoryEntryCta.tsx)
  - [src/lib/messages.ts](../../../src/lib/messages.ts)、[replay.ts](../../../src/lib/replay.ts)、[gates.tsx](../../../src/lib/gates.tsx)
- [ ] 既有测试参照：[src/test/story-prompts.test.ts](../../../src/test/story-prompts.test.ts)、[gates-story.test.ts](../../../src/lib/gates-story.test.ts)、[replay.test.ts](../../../src/lib/replay.test.ts)、[App.restore.test.tsx](../../../src/App.restore.test.tsx)

> 禁止读取/修改清单以外文件，除非用户明确指示。
>
> 前置已交付（直接复用，不重复实现）：feature-002 v1.1 消息单写队列与 redoGate、feature-003 的故事阶段编排、`剧本/故事大纲`、`剧本/人物小传`、groups 画布、storyRedo 机制。

## 原子任务

### T1 共享类型扩展（K1 + K4）
- [x] T1-1 `Stage` 增 `scenes`/`dialogue`/`storyboard`
- [x] T1-2 `MessageKind` 增 `scenes`/`dialogue`/`storyboard`
- [x] T1-3 新增 `Scene`/`SceneBreakdown`、`DialogueLine`/`DialogueScene`/`DialogueScript`、`ShotDialogue`/`Shot`/`ShotList`（严格按契约 §1.3）
- [x] T1-4 更新 [src/global.d.ts](../../../src/global.d.ts) 的 window.api 类型（enterScript/saveScript/generateScenes/generateDialogue/generateStoryboard 5 方法）

### T2 剧本阶段主进程（electron/session.ts）
- [x] T2-1 `enterScript()`：manifest 读-改-写 `status='script-scenes'`，保留既有字段；走单写队列
- [x] T2-2 `saveScript(kind, data)`：按契约 §4 分流（scenes/dialogue→`剧本/`，storyboard→`分镜/`），写 JSON+MD、mkdir recursive、返回 files、推进 status；走单写队列
- [x] T2-3 MD 渲染：`renderScenesMd` / `renderDialogueMd` / `renderStoryboardMd`（契约 §3.2，字段缺失空串不抛错；角色 id→名字映射的兜底显示 id）
- [x] T2-4 `readScriptContext()`：读取 brief + 五要素 + 背景档案 + 已定稿大纲 + 小传 + 分场 + 台词，返回结构化上下文对象（缺文件返回 null，不抛）
- [x] T2-5 IPC 注册 `script:enter`、`script:save`（main.ts）
- [x] T2-6 preload 暴露 enterScript / saveScript

### T3 编剧 prompt / 解析 / mock（electron/prompts.ts）
- [x] T3-1 `buildScenesPrompt` + `parseScenes`（数组/`{scenes}` 兼容 + 形态校验）
- [x] T3-2 `buildDialoguePrompt` + `parseDialogue`（数组/`{scenes}` 兼容 + 形态校验）
- [x] T3-3 `buildStoryboardPrompt` + `parseStoryboard`（数组/`{shots}` 兼容 + 形态校验）
- [x] T3-4 `mockScenes` / `mockDialogue` / `mockStoryboard`（契约 §5.4，引用自洽：角色 id 与场号互相能对上）
- [x] T3-5 IPC `agent:scenes`/`agent:dialogue`/`agent:storyboard`（main.ts）：按契约 §2 组装分级上下文、缺上游 reject `STORY_CTX_MISSING`、未配置/失败降级 mock；preload 暴露 generateScenes/generateDialogue/generateStoryboard

### T4 画布分阶段
- [x] T4-1 新增 `scriptTemplates`（scenes/dialogue/storyboard 3 节点），App 的 `buildGroups()` 追加 STAGE 2 组；第三行初始灰态
- [x] T4-2 节点详情派生：scenesDetail/dialogueDetail/storyboardDetail（`N 场·约 Xs` / `M 句对白` / `J 镜·Xs`）

### T5 新增对话卡片、CTA、确认门与消息工厂
- [x] T5-1 `ScenesCard.tsx`（场号/slug/内外日夜徽标/地点/出场/情绪/时长/节拍）
- [x] T5-2 `DialogueCard.tsx`（按场分组、角色名+情绪+台词、旁白独白标签、动作提示）
- [x] T5-3 `StoryboardCard.tsx`（逐镜块：镜号/景别/场/时长/动作/台词或空镜/运镜）
- [x] T5-4 `ScriptEntryCta.tsx`（右栏，沿用 StoryEntryCta 视觉）
- [x] T5-5 ChatPanel 接入 scenes/dialogue/storyboard 三种 kind 渲染
- [x] T5-6 [src/lib/gates.tsx](../../../src/lib/gates.tsx) 扩展 `buildGate2a(scenes)` / `buildGate2b(dialogue, scenes)` / `buildGate2c(storyboard, scenes)`（契约 §8：id/标题/stage/摘要/软校验 harness/details）
- [x] T5-7 [src/lib/messages.ts](../../../src/lib/messages.ts) 扩展：`makeStage` 参数扩 `'story' | 'script'`；新增 `makeScenes` / `makeDialogue` / `makeStoryboard`（契约 §9）

### T6 App 剧本编排（src/App.tsx）
- [x] T6-1 新增状态：scenes/dialogue/storyboard、`scriptRedo`；phase 扩 `'script'`
- [x] T6-2 `handleEnterScript`（enterScript + stage('script') 胶囊 + 自动 runScenes）
- [x] T6-3 `runScenes` / `runDialogue` / `runStoryboard`（进度/结果/错误重试 retryToken/节点激活/开门）
- [x] T6-4 `handleConfirm` 2-a（save scenes→runDialogue）/ 2-b（save dialogue→runStoryboard）/ 2-c（save storyboard→收尾文本）
- [x] T6-5 `handleReject` 2-x：置 `scriptRedo`；统一发送路由 `handleSend` 增加 scriptRedo 三分支（用户气泡 + instruction 重生成 + 重弹门）
- [x] T6-6 `canEnterScript` 派生（phase==='story' && profiles done）与 CTA 显隐（gate/archive 互斥规则沿用）

### T7 重放恢复（src/lib/replay.ts + App 恢复）
- [x] T7-1 `GateId` 扩 2-a/2-b/2-c；`ReplayResult` 增 phase `'script'`、scenes/dialogue/storyboard、scriptRedo
- [x] T7-2 initialNodes 增三 pending 节点；stage(`script`)/scenes/dialogue/storyboard/gate 2-x/confirm/reject 规则（契约 §6.2）
- [x] T7-3 App 恢复：phase/三产物/三节点详情/2-x 门重建/scriptRedo/canEnterScript CTA（消息工厂已在 T5-7 完成）

### T8 测试
- [x] T8-1 新建 `src/test/script-prompts.test.ts`：三 parser（纯 JSON/代码块/对象包装/非法抛错）+ 三 mock 字段与引用自洽
- [x] T8-2 新建 `src/lib/gates-script.test.ts`：buildGate2a/2b/2c 的 id/标题/stage/摘要/harness 布尔（含不通过分支）
- [x] T8-3 扩展 `src/lib/replay.test.ts`：STAGE 2 全流程、2-x 否决 scriptRedo、否决后新 gate 清除、canEnterScript 派生
- [x] T8-4 扩展 `src/components/ChatPanel.test.tsx`：scenes/dialogue/storyboard 三卡渲染
- [x] T8-5 扩展 `src/App.restore.test.tsx`：STAGE 2 集成（进入→2-a 断言 saveScript('scenes')→2-b→2-c 断言 'storyboard' 与收尾文本；2-a 否决 instruction 重生成）；mockApi 补 5 个剧本方法

### T9 全量验证
- [x] T9-1 `npm run test:run` 全绿；feature-001/002/003 AC 无回归（94/94 通过，9 个测试文件）
- [x] T9-2 `tsc --noEmit` 与 `tsc -p tsconfig.node.json` 零错误（另：`tsc -b` project references 全量构建 EXIT 0）
- [x] T9-3 `vite build` 成功
- [x] T9-4 人工/会话目录核对（2026-10-03 真机 `npm run dev` 全程 8 门走通，火山方舟真实模型）：6 个产物文件全部生成（`剧本/分场.json/.md`、`剧本/台词.json/.md`、`分镜/shotlist.json/.md`），JSON 逐字段符合契约（Scene 11 字段/DialogueLine/Shot 11 字段，shotNo/rowOrder 连续，空镜 dialogue=null，refs 恒 []，两条主键引用完整，功能性角色 speakerId='' + speakerName 兜底正确落盘）；MD 可读（分场/台词排版、分镜表格转义与空镜「—」）；manifest 读-改-写终态 `storyboard-done` 且保留 fiveElements/visualStyle/createdAt；Cmd+R 重放恢复 9 节点/三卡/无待处理门/收尾文案。真机另发现并修复 1 个 L1 缺陷：GateCard 角标硬编码「STAGE · 立项」，已改为按 `gate.stage` 映射（新增 GateCard.test.tsx 5 用例，99/99 全绿）

## 验收标准（AC）

- [x] AC-1 1-b 人物小传锁定后出现「进入剧本分镜」CTA；点击后 CTA 消失、出现「进入 STAGE 2 · 剧本分镜」胶囊
- [x] AC-2 进入后自动生成分场：spinner→分场卡；失败有错误卡且可重试
- [x] AC-3 分场卡字段完整（场号/内外日夜/地点/出场角色/节拍/情绪/时长），与大纲 E01、背景档案事实一致
- [x] AC-4 2-a 确认后写入 `剧本/分场.json/.md`，manifest.status=script-dialogue，并自动生成台词
- [x] AC-5 2-a 否决后对话输入意见，分场按指令重新生成、重弹门；产物卡保留；台词/分镜不受影响
- [x] AC-6 台词卡按场组织、字段完整（说话人/类型/情绪/台词/动作）；2-b 确认写 `剧本/台词.json/.md`，status=script-storyboard，自动生成分镜
- [x] AC-7 2-b 否决后对话意见触发台词按指令重生成
- [x] AC-8 分镜卡含镜号/景别/场/角色/动作/台词/时长/运镜；空镜正确呈现；2-c 确认写 `分镜/shotlist.json/.md`（新建 `分镜/` 目录），status=storyboard-done，出现收尾文本「第一集剧本与分镜已锁定，下一阶段：美术定妆」
- [x] AC-9 2-c 否决后对话意见触发分镜按指令重生成
- [x] AC-10 画布显示 STAGE 0/1/2 三组共 9 节点，状态与流程一致；未进入 STAGE 2 时第三行灰态
- [x] AC-11 刷新/重启后阶段、分场/台词/分镜、未处理 2-a/2-b/2-c 门、scriptRedo 完整恢复；故事完成未进入时 CTA 恢复显示
- [x] AC-12 `npm run test:run` 全部通过；feature-001/002/003 测试无回归；tsc 两配置与 vite build 通过
- [x] AC-13 不新增运行时依赖；不新增源码顶层目录；既有 IPC 通道签名零改动；manifest 历史债务仅登记未被扩大

> 注：AC-4/6/8 的文件落盘路径、manifest.status 推进与 MD 可读性，其调用链已由集成测试（saveScript 的 kind/data）与主进程类型检查验证；真实磁盘产物以 T9-4 真机会话人工核对为最终凭据。
