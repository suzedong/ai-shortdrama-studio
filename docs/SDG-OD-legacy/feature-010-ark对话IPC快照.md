# feature-010 存量快照 · ark 对话 IPC

> 快照日期：2026-10-05
> 代码基线：feature-009 闭环后（357 passed / 1 skipped），工作区未提交业务改动
> 快照方法：逐行读取 [main.ts](../../electron/main.ts)、[preload.ts](../../electron/preload.ts)、[global.d.ts](../../src/global.d.ts)，Grep 全 `src/` 调用点（存量迁移四步法第 ①② 步，禁凭印象）
> 用途：feature-010「对话通道全量接入」旧通道退役依据。本快照中的迁移决策表须经用户二次签字（P3）后方可执行删除。

## 1. 通道清单（9 个待处置 IPC）

| # | IPC 通道 | preload 方法 | 注册位置 |
| :- | :-- | :-- | :-- |
| 1 | `agent:diagnose` | `diagnose(idea, instruction?)` | main.ts L86-103 |
| 2 | `agent:visual-style` | `recommendVisualStyle(fe, instruction?)` | main.ts L121-139 |
| 3 | `agent:revise-text` | `reviseText(kind, current, instruction, turns?)` | main.ts L167-205 |
| 4 | `agent:story-outline` | `generateOutline(instruction?)` | main.ts L230-254 |
| 5 | `agent:character-profiles` | `generateProfiles(instruction?)` | main.ts L256-281 |
| 6 | `agent:scenes` | `generateScenes(instruction?)` | main.ts L297-323 |
| 7 | `agent:dialogue` | `generateDialogue(instruction?)` | main.ts L325-353 |
| 8 | `agent:storyboard` | `generateStoryboard(instruction?)` | main.ts L355-384 |
| 9 | `app:ark-status` | `arkStatus()` | main.ts L386-390 |

## 2. 逐 handler 行为快照（T2 工具层必须逐一同构）

### 2.1 `agent:diagnose` → 工具 `shortdrama_diagnose`
- 入参：`(idea: string, instruction?: string)`
- 无 Key（`!isConfigured()`）：返回本地 `mockDiagnosis(idea)`
- 有 Key：`buildDiagnosisPrompt(idea, instruction)` → `chat(messages)`（默认温度）→ `parseDiagnosis(raw)`
- 异常：**全部 catch 降级** `mockDiagnosis(idea)`，不抛错
- 本地 mock 结构 `TopicDiagnosis`：benchmarkCases 两条（盛夏芬德拉/红果/30亿+；一见钟情/红果/8234万）、userInsight、hookPatterns A-D、compliance 两条、conclusion 含 `[mock]` 前缀与 `idea.slice(0,20)`

### 2.2 `agent:visual-style` → 工具 `shortdrama_visual_style`
- 入参：`(fe: FiveElements, instruction?: string)`
- 无 Key：返回 `mockVisualStyle(fe)`
- 有 Key：`buildVisualStylePrompt` → `chat(messages, 0.6)` → `parseVisualStyle` → **`assertInCatalog(parsed)`**
- 异常分流：`err.code === 'STYLE_NOT_IN_CATALOG'` → **rethrow 不降级**；其余降级 `mockVisualStyle(fe)`
- mock：form 仿真人 / family A 写实影像系 / feasibility ●高 / qualityRecipe 两档 / rationale 含 `[mock]` 与 `CATALOG_VERSION`

### 2.3 `agent:revise-text` → 工具 `shortdrama_revise_text`
- 入参：`(kind: 'idea'|'background', current: string, instruction: string, turns?: {instruction,draft}[])`
- 前置校验（在 isConfigured 之前）：
  - kind 非法 → `code: 'REVISE_KIND_INVALID'`（message「不支持的改写对象：…」）
  - `instruction.trim()` 空 → `code: 'REVISE_INSTRUCTION_EMPTY'`（message「修改意见为空」）
- 无 Key：`{ text: mockReviseText(kind, current, opinion) }`
- 有 Key：`buildReviseTextPrompt(kind, current, opinion, turns ?? [])` → `chat(messages, 0.7)` → `parseReviseText`
- 空结果：`code: 'REVISE_EMPTY'`（message「改写结果为空」），catch 中 **rethrow 不降级**；其余异常降级 mock

### 2.4 `agent:story-outline` → 工具 `shortdrama_story_outline`
- 上下文：`readStoryContext()`；`ctx.fiveElements` 缺失 → `rejectNoCtx()`（code `STORY_CTX_MISSING`，message「缺少立项六要素，无法生成故事产物」）
- 拼装顺序（`\n\n` 连接，filter Boolean）：`describeFiveElements(fe)` → `describeBrief(brief)` → `ctx.archive ? 故事背景档案 : ''`
- 无 Key：`mockStoryOutline(fe)`；有 Key：温度 **0.8** → `parseStoryOutline`；异常全部降级 mock

### 2.5 `agent:character-profiles` → 工具 `shortdrama_character_profiles`
- 上下文：同上 fe 校验；拼装：五要素 → brief → `ctx.outline`（JSON 定稿大纲）→ archive
- 无 Key：`mockCharacterProfiles()`；有 Key：0.8 → `parseCharacterProfiles`；异常降级 mock

### 2.6 `agent:scenes` → 工具 `shortdrama_scenes`
- 上下文：`readScriptContext()`；fe 缺失 `rejectNoCtx()`
- 拼装：五要素 → brief → outline → `ctx.profiles`（JSON 人物小传）→ archive
- 无 Key：`mockScenes()`；有 Key：0.8 → `parseScenes`；异常降级 mock

### 2.7 `agent:dialogue` → 工具 `shortdrama_dialogue`
- 上下文：`readScriptContext()`；fe 缺失 `rejectNoCtx()`；`!ctx.scenes` → `rejectCtx('缺少已定稿分场，无法生成台词')`（同 code `STORY_CTX_MISSING`）
- 拼装：五要素 → brief → archive → outline → profiles → 分场完整 JSON
- 无 Key：`mockDialogue()`；有 Key：0.8 → `parseDialogue`；异常降级 mock

### 2.8 `agent:storyboard` → 工具 `shortdrama_storyboard`
- 上下文：`readScriptContext()`；fe 缺失 `rejectNoCtx()`；`!ctx.scenes || !ctx.dialogue` → `rejectCtx('缺少已定稿分场或台词，无法生成分镜')`
- 拼装：五要素 → brief → archive → outline → profiles → 分场 JSON → 台词 JSON
- 无 Key：`mockStoryboard()`；有 Key：0.8 → `parseStoryboard`；异常降级 mock

### 2.9 `app:ark-status`（无对应业务工具）
- 返回 `{ configured: isConfigured(), keyMasked: maskKey(), model: process.env.ARK_MODEL || '' }`

## 3. 辅助函数（随 handler 一同迁移到 MCP 工具层）

| 函数 | 行为 |
| :-- | :-- |
| `rejectNoCtx()` | 抛 code `STORY_CTX_MISSING`「缺少立项六要素，无法生成故事产物」 |
| `rejectCtx(message)` | 抛 code `STORY_CTX_MISSING`，自定义 message |
| `describeFiveElements(fe)` | 题材/平台（join('/')）/单集时长/集数/风格基调/画幅（缺省 `竖屏 9:16`） |
| `describeBrief(brief)` | 取 `brief.visualStyle` 的 form/mainStyle/anchorWords；无 visualStyle 返回空串 |
| `mockDiagnosis(idea)` / `mockVisualStyle(fe)` | 见 §2.1/§2.2 |

## 4. Renderer 调用点（Grep 实测）

### 4.1 生产代码：仅 [App.tsx](../../src/App.tsx)

| 行 | 调用 | 场景 |
| :- | :-- | :-- |
| L193 | `diagnose(idea)` | 首次提交 `runDiagnosis` |
| L577 | `diagnose(idea, instruction)` | 0-a 门否决后带意见重诊 |
| L604 / L625 | `recommendVisualStyle(fe, instruction)` | 0-c 首次生成 / 否决重生成 |
| L665 / L687 | `generateOutline/Profiles(instruction)` | 1-a / 1-b 生成 |
| L727 / L750 / L773 | `generateScenes/Dialogue/Storyboard(instruction)` | 2-a / 2-b / 2-c 生成 |
| L326-332 | 6 个生成方法 | `generateFor` 变更通道路由 switch |
| L361 | `reviseText(kind, current, instruction, turns)` | 变更草案人工源 |

### 4.2 `arkStatus` 生产调用点：**无**

仅存在于：[global.d.ts](../../src/global.d.ts) L66 类型声明；三个测试文件的 mock 桩（[App.revision.test.tsx](../../src/App.revision.test.tsx)、[App.restore.test.tsx](../../src/App.restore.test.tsx)、[feature006-ui.test.tsx](../../src/feature006-ui.test.tsx)）。

### 4.3 测试引用

- `App.revision.test.tsx`：8 个旧方法 mock 桩 + reviseText/diagnose/generateOutline/recommendVisualStyle 行为断言
- `App.restore.test.tsx`：8 个旧方法 mock 桩 + 各门否决重调断言
- `feature006-ui.test.tsx`：9 个旧方法 mock 桩（仅满足 App 渲染，无直接断言）

## 5. 不受影响、继续沿用的 IPC（不在退役范围）

持久化与上下文通道全部保留：`project:create/save`、`session:start/current`、`chat:append/load/clear`、`archive:save/read`、`session:read-finalized`、`workflow:save/load`、`idea:save`、`diagnosis:save`、`story:enter/save`、`script:enter/save`，以及全部 `runtime:*`（12 个）。

## 6. 迁移决策表（K3 · 存量迁移四步法第 ③ 步）

| 对象 | 决策 | 去向 / 说明 |
| :-- | :-: | :-- |
| 8 个 `agent:*` IPC 注册块（main.ts L86-384 中对应块） | 🟣替换 | 行为逐一同构迁入 `electron/mcp/tools.ts` 8 个 MCP 工具，经 opencode 调用；注册块在 T9 删除 |
| `app:ark-status` IPC | 🔴弃用 | 无生产调用点（§4.2），T9 删除；Key 状态今后由 runtime status 侧承载 |
| preload 8 个旧方法 + `arkStatus` | 🔴删除 | T9 从 [preload.ts](../../electron/preload.ts) 移除 |
| [global.d.ts](../../src/global.d.ts) 9 条旧方法声明 | 🔴删除 | T9 移除 |
| 3 个测试文件中的旧方法 mock 桩/断言 | 🟡改造 | T8 随 App 编排切换改写为 runtime 链路；全量测试只增不减 |
| [ark.ts](../../electron/ark.ts)（chat/isConfigured/maskKey） | 🟢沿用 | 工具层直接调用；不修改 |
| [prompts.ts](../../electron/prompts.ts)（8 组 build/parse/mock） | 🟢沿用 | 工具层直接调用；不修改 |
| [style-catalog.ts](../../electron/style-catalog.ts)（assertInCatalog/CATALOG_VERSION） | 🟢沿用 | 工具层直接调用；不修改 |
| [session.ts](../../electron/session.ts)（readStoryContext/readScriptContext 等） | 🟢沿用 | 工具层经其读取业务上下文；持久化 IPC 不动 |
| §3 五个辅助函数 + mockDiagnosis/mockVisualStyle | 🟣替换 | 随工具层迁入 `electron/mcp/tools.ts`（或 `context.ts`），main.ts 中原件 T9 删除 |
| 错误码 `REVISE_*` / `STYLE_NOT_IN_CATALOG` / `STORY_CTX_MISSING` | 🟢沿用 | 不新增错误码；工具层经 envelope.error 透出，message 保留原文（契约 §5） |

## 7. 签字栏（P3）

- [ ] 用户确认上述决策表（含 🟣替换 8 通道、🔴弃用 `app:ark-status`、🔴删除 preload/global.d.ts 旧面），授权 T9 执行删除。
