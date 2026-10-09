# SDG-RE-任务清单 · feature-003-编剧Agent

> **版本**：v1.1（2026-10-03，反向补录 + 测试补齐闭环）。
>
> 本补录基于 2026-10-03 工作区代码状态：feature-003 的 T1–T7 代码已散落实现并与契约逐字段吻合；T8-1/T8-2 测试已存在；T8-3/T8-4/T8-5 于本次补齐。全量测试 63/63 通过，tsc 两层配置零错误，vite build 成功。

## 上下文加载清单

- [x] [AGENTS.md](../../../AGENTS.md)
- [x] [短剧Agent平台设计.md](../../../短剧Agent平台设计.md)（v1.1）§2、§3.2、§3.3、§4、§7、§11
- [x] [SDG-RE-需求规格.md](./SDG-RE-需求规格.md)
- [x] [SDG-RE-契约.md](./SDG-RE-契约.md) — **最高优先级**
- [x] [SDG-OD-设计说明.md](./SDG-OD-设计说明.md)
- [x] 现状代码：
  - [shared/types.ts](../../../shared/types.ts)
  - [electron/main.ts](../../../electron/main.ts)、[session.ts](../../../electron/session.ts)、[prompts.ts](../../../electron/prompts.ts)、[ark.ts](../../../electron/ark.ts)、[preload.ts](../../../electron/preload.ts)
  - [src/App.tsx](../../../src/App.tsx)、[global.d.ts](../../../src/global.d.ts)
  - [src/components/StageCanvas.tsx](../../../src/components/StageCanvas.tsx)、[ChatPanel.tsx](../../../src/components/ChatPanel.tsx)、[BackgroundArchive.tsx](../../../src/components/BackgroundArchive.tsx)
  - [src/lib/messages.ts](../../../src/lib/messages.ts)、[replay.ts](../../../src/lib/replay.ts)、[gates.tsx](../../../src/lib/gates.tsx)

> 前置已交付（feature-002 v1.1）：`故事背景档案.md` 落盘（`archive:save`）、消息单写队列、redoGate 重做机制——本 Feature 直接复用，不重复实现。

## 原子任务

### T1 共享类型扩展（K1 + K4）
- [x] **[已完成 · 反向补录]** T1-1 `Stage` 增 `outline`/`profiles`（[shared/types.ts](../../../shared/types.ts#L3-L5)）
- [x] **[已完成 · 反向补录]** T1-2 `MessageKind` 增 `stage`/`story-outline`/`character-profiles`（[shared/types.ts](../../../shared/types.ts#L92-L104)）
- [x] **[已完成 · 反向补录]** T1-3 新增 `StoryOutline`、`CharacterProfile` 接口（[shared/types.ts](../../../shared/types.ts#L53-L79)）
- [x] **[已完成 · 反向补录]** T1-4 更新 [src/global.d.ts](../../../src/global.d.ts) 的 window.api 类型（新增 enterStory/saveStory/generateOutline/generateProfiles）

### T2 故事阶段主进程
- [x] **[已完成 · 反向补录]** T2-1 manifest 读-改-写（enterStory，保留既有字段）（[session.ts](../../../electron/session.ts#L165-L179)）
- [x] **[已完成 · 反向补录]** T2-2 定稿落盘 `story:save`（JSON+MD、mkdir、files 返回、status 推进）（[session.ts](../../../electron/session.ts#L221-L263)）
- [x] **[已完成 · 反向补录]** T2-3 上下文读取：brief.json + `故事背景档案.md` + 已定稿大纲（[session.ts](../../../electron/session.ts#L182-L218)）
- [x] **[已完成 · 反向补录]** T2-4 IPC 注册 `story:enter`、`story:save`、`agent:story-outline`、`agent:character-profiles`（[main.ts](../../../electron/main.ts#L133-L207)）
- [x] **[已完成 · 反向补录]** T2-5 preload 暴露新方法（[preload.ts](../../../electron/preload.ts#L17-L24)）

### T3 编剧 prompt / 解析 / mock
- [x] **[已完成 · 反向补录]** T3-1 buildStoryOutlinePrompt + parseStoryOutline（含形态校验）（[prompts.ts](../../../electron/prompts.ts#L79-L114)）
- [x] **[已完成 · 反向补录]** T3-2 buildCharacterProfilesPrompt + parseCharacterProfiles（数组/{characters}）（[prompts.ts](../../../electron/prompts.ts#L116-L162)）
- [x] **[已完成 · 反向补录]** T3-3 mockStoryOutline / mockCharacterProfiles（[prompts.ts](../../../electron/prompts.ts#L172-L218)）
- [x] **[已完成 · 反向补录]** T3-4 IPC `agent:story-outline`、`agent:character-profiles`（组装上下文/降级 mock/STORY_CTX_MISSING）（[main.ts](../../../electron/main.ts#L156-L207)）

### T4 画布分阶段
- [x] **[已完成 · 反向补录]** T4-1 StageCanvas 改为 groups（两行）、动态行宽与缩放、组标签（[StageCanvas.tsx](../../../src/components/StageCanvas.tsx)）
- [x] **[已完成 · 反向补录]** T4-2 App 组装立项组 + 故事组；故事节点初始灰态（[App.tsx](../../../src/App.tsx#L442-L453)）

### T5 新增对话卡片
- [x] **[已完成 · 反向补录]** T5-1 OutlineCard 组件（logline/主线/主题/冲突/分集）（[OutlineCard.tsx](../../../src/components/messages/OutlineCard.tsx)）
- [x] **[已完成 · 反向补录]** T5-2 ProfilesCard 组件（多角色块）（[ProfilesCard.tsx](../../../src/components/messages/ProfilesCard.tsx)）
- [x] **[已完成 · 反向补录]** T5-3 ChatPanel 接入 story-outline / character-profiles 渲染（[ChatPanel.tsx](../../../src/components/ChatPanel.tsx#L61-L64)）
- [x] **[已完成 · 反向补录]** T5-4 StoryEntryCta 组件（右栏）（[StoryEntryCta.tsx](../../../src/components/messages/StoryEntryCta.tsx)）

### T6 App 故事编排
- [x] **[已完成 · 反向补录]** T6-1 phase 状态；handleEnterStory（story:enter + 阶段胶囊 + 自动大纲）（[App.tsx](../../../src/App.tsx#L235-L248)）
- [x] **[已完成 · 反向补录]** T6-2 runOutline / runProfiles（进度/结果/错误重试/节点）（[App.tsx](../../../src/App.tsx#L251-L292)）
- [x] **[已完成 · 反向补录]** T6-3 handleConfirm 1-a（定稿落盘→小传）/ 1-b（定稿→收尾文本）（[App.tsx](../../../src/App.tsx#L366-L403)）
- [x] **[已完成 · 反向补录]** T6-4 storyRedo 状态：1-a/1-b 否决后，对话文本作为 instruction 重新生成（[App.tsx](../../../src/App.tsx#L406-L419)）
- [x] **[已完成 · 反向补录]** T6-5 扩展统一发送路由：storyRedo 分支（[App.tsx](../../../src/App.tsx#L295-L307)）
- [x] **[已完成 · 反向补录]** T6-6 canEnterStory 派生与 CTA 显隐（[App.tsx](../../../src/App.tsx#L437-L439)）

### T7 重放恢复
- [x] **[已完成 · 反向补录]** T7-1 ReplayResult 扩展 phase/storyOutline/characterProfiles/storyRedo/pendingGate 1-x（[replay.ts](../../../src/lib/replay.ts#L9-L22)）
- [x] **[已完成 · 反向补录]** T7-2 stage/story-outline/character-profiles/gate/gate-action(1-x) 规则（[replay.ts](../../../src/lib/replay.ts#L56-L99)）
- [x] **[已完成 · 反向补录]** T7-3 App 恢复故事阶段：数据/节点/门/CTA/storyRedo（[App.tsx](../../../src/App.tsx#L456-L517)）

### T8 测试
- [x] **[已完成 · 反向补录]** T8-1 prompts 解析测试（[story-prompts.test.ts](../../../src/test/story-prompts.test.ts)，7 tests）
- [x] **[已完成 · 反向补录]** T8-2 gates 1-a/1-b 测试（[gates-story.test.ts](../../../src/lib/gates-story.test.ts)，4 tests）
- [x] **[已完成]** T8-3 replay 故事流程测试（含 storyRedo、canEnterStory）（[replay.test.ts](../../../src/lib/replay.test.ts)，新增 11 tests，共 18 tests）
- [x] **[已完成]** T8-4 ChatPanel 大纲/小传卡渲染测试（[ChatPanel.test.tsx](../../../src/components/ChatPanel.test.tsx)，新增 2 tests，共 8 tests）
- [x] **[已完成]** T8-5 App 故事集成测试（进入→大纲→1-a 确认 story:save 断言→小传→1-b；否决重做）（[App.restore.test.tsx](../../../src/App.restore.test.tsx)，新增 5 tests，共 13 tests）

## 验收标准（AC）

- [x] AC-1 立项全节点完成后出现「进入故事创作」CTA；点击后 CTA 消失、出现阶段胶囊
- [x] AC-2 进入后自动生成大纲：spinner→大纲卡；失败有错误卡且可重试
- [x] AC-3 大纲卡字段完整（logline/主线/主题/冲突/E01），且与 `故事背景档案.md` 事实一致
- [x] AC-4 1-a 确认后写入 `剧本/故事大纲.json/.md`，manifest.status=story-profiles，并自动生成小传
- [x] AC-5 1-a 否决后可在对话输入修改意见，触发大纲按指令重新生成、重弹门（产物卡保留）
- [x] AC-6 小传卡含主要角色完整字段；1-b 确认写入 `剧本/人物小传.json/.md`，status=story-done，出现收尾文本
- [x] AC-7 1-b 否决后对话意见触发小传按指令重生成
- [x] AC-8 画布显示 STAGE 0/1 两组，节点状态与流程一致；未进入故事时故事行灰态
- [x] AC-9 刷新页面/重启应用后阶段、大纲/小传、未处理 1-a/1-b 门、storyRedo 完整恢复；立项完成未进入时 CTA 恢复显示
- [x] AC-10 `npm run test:run` 全部通过（7 文件，63 tests）；feature-001/002 AC 无回归；tsc（node 两配置 + 渲染）与 vite build 通过
