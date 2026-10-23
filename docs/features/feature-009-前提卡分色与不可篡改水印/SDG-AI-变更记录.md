# feature-009 · 前提卡分色 + 不可篡改水印 · 变更记录

> 三分类：D = 决策登记；T = 任务执行留痕；X = 修复留痕。

## D 节 · 决策登记

### D-001（2026-10-21）建包登记 —— 已批准

- **事项**：新建 feature-009 任务包（「新建→立项」链路盘点缺口 #5：前提卡分色 + 不可篡改水印），需求规格 / 契约 / 设计说明 / 任务清单 / 本记录五文件齐备。
- **用户拍板**（2026-10-21，三项全推荐项）：① 分色数据源 = 已捕获口径词表匹配（confirmed 存在 → 人确认；仅 infer+pending → AI 假版本；无命中 → 中性；K1 零触发）；② 水印形态 = 行内徽标 + 行底色分色（「不可篡改」徽标 + 淡绿底 /「AI 拟稿」徽标 + 淡琥珀底）；③ 覆盖范围 = 卡②五键分色 + 背景档案折叠区标题行整体「不可篡改」徽标。
- **偏差登记**：B-44「前提卡分色与不可篡改水印缺失」（设计书 §2.6.8 L379 vs 现状卡②五键单色零水印），本包登记、T8 随治理收尾落表并翻 ✅（先例 B-43 模式）。
- **卡口预判**：K1 / K8 / K9 全零触发（纯 renderer 呈现 + 纯函数层 + 净增恰 1 测试文件；types.ts / electron / package.json / 配置零 diff）。
- **状态**：已批准（2026-10-21 用户经 NotifyUser 批准五文件）→ T1-T8 已按任务清单实施完毕，实测见 T 节。

## T 节 · 任务执行留痕

- **T1（2026-10-21）基线冻结**：全量 `npm run test:run` 实测 **59 文件 / 689 passed / 0 failed / 1 skipped（690 total）**，与 feature-008 闭环终态基线逐字一致；`npm run typecheck` 恰 3 条历史基线（canvas-zoom.test.tsx TS2322 L13 + TS6133 L90、runtime-client.test.ts TS2741 L45，exit code 2 预期）零新增；git status 盘点——feature-007（StudioApp/StudioViewer/RealignConfirm/realign-confirm.test/showrunner.md）与 feature-008（chain.ts/Stage0Chain/Stage0View/两测试文件）未提交代码在树，本包增量可辨识。
- **T2（2026-10-21）新建 [premise-facts.ts](../../../src/studio/stage0/premise-facts.ts)**：22 行，按契约 §2 逐字——import type ProjectBrief/CapturedFact + matchChainTopic（from './chain'）+ PREMISE_FIELDS（from './select'）；禁 fs / window.api / Date / 随机；零 import 副作用（jsdom 安全）。实现：hitKeys / confirmedKeys 双 Set 单遍扫描 facts（matchChainTopic 命中且 group='premise' 才入集，status='confirmed' 入 confirmedKeys），再按 PREMISE_FIELDS 表序输出五键全覆盖（`!hitKeys.has → 'none'` / `confirmedKeys.has → 'human'` / 否则 `'ai'`），与契约 §1 真值表逐条对应。chain.ts / select.ts git diff 复核全空——零 diff ✅。
- **T3（2026-10-21）[Stage0Chain.tsx](../../../src/studio/Stage0Chain.tsx) 一词 export**：恰两笔 diff——①文件头注释追加 `// feature-009：useCaptureFacts 导出供 Stage0View PublishedBody 复用（前提卡分色订阅）`；②L15 `function useCaptureFacts()` → `export function useCaptureFacts()`。hook 本体零改动。stage0-chain.test.tsx 27 例单跑全绿（本包与其零交集）✅。
- **T4（2026-10-21）[Stage0View.tsx](../../../src/studio/Stage0View.tsx) PublishedBody 分色 + 双徽标**：恰四笔 diff——①import 段：`import Stage0Chain, { useCaptureFacts } from './Stage0Chain'` + `import { selectPremiseConfirmation } from './stage0/premise-facts'`（useMemo 为 react 既有 import）；②PublishedBody 函数体顶部（editing useState 之后）：`const { facts } = useCaptureFacts()` + `const confirmMap = useMemo(() => selectPremiseConfirmation(facts), [facts])`；③五键字段容器加 `overflow-hidden` 一词，五键行改带 conf 块体 map——行容器模板串追加 `${conf === 'human' ? ' bg-[#F2FBF6]' : conf === 'ai' ? ' bg-[#FDF8EE]' : ''}` + `data-stage0-premise-row={key}` + `data-stage0-premise-confirmation={conf}`，行尾 `{conf !== 'none' && (<span … data-stage0-premise-seal>{conf === 'human' ? '不可篡改' : 'AI 拟稿'}</span>)}`，label span 与 LeafValue 本体零 diff；④背景档案标题行 button 内「故事背景档案.md」后追加 background-seal 徽标（border-[#B9E8D2] bg-[#E7F8F0] text-[#1E9E66]「不可篡改」，与 bg.phase 无关恒挂）。四次 SearchReplace 全部一次命中；卡① / BriefEditPanel / 定案区 / 版本区 / empty 三态 / Header / 链态条挂载区 / BackgroundMd / LeafValue 零 diff 复核 ✅。
- **T5（2026-10-21）新建 [stage0-premise-facts.test.tsx](../../../src/studio/stage0-premise-facts.test.tsx)**：两组恰 15 例，单跑 15/15 一次全绿。组① 纯函数 9 例——空 facts 五键全 none 且 Object.keys 表序全覆盖 / user confirmed→human / infer+confirmed→human / infer+pending→ai / 同键混合 confirmed 优先 / 中文别名（'人物'/'本季边界'/'季边界'）/ trim+大小写（' Leads '）/ 六要素（'题材'/'集数'）全 none / 未命中（'预算'）全 none。组② Stage0View 集成 6 例——facts 全空五行 "none" 无 seal 无底色 / human 行「不可篡改」+bg-[#F2FBF6]+text-[#1E9E66] / ai 行「AI 拟稿」+bg-[#FDF8EE]+text-[#B07E2A] / 混合共存三态各行其色且 seal 恰 2 枚 / 背景档案 background-seal 上屏+点击展开「背景档案正文」零回归 / emit 联动 leads 行 ai→human 翻转。installViewApi 复刻 stage0-chain.test.tsx 模式（fileRead 路由 + capture 两桥内存 mock + emit 广播）+ StrictMode + beforeEach `_setStyleCatalogSnapshotForTest` 单条 A7 prime + afterEach 复位。既有 59 测试文件全零 diff，净增恰 1 ✅。
- **T6（2026-10-21）全量回归 + 静态验证**：全量 `npm run test:run` 实测 **60 文件 / 704 passed / 0 failed / 1 skipped（705 total）**——净增恰 1 文件、passed 净增恰 15（689→704）；`npm run typecheck` 恰 3 条历史基线零新增；禁用串 Grep——「不可篡改」「AI 拟稿」与凭据族（data-stage0-premise-row / premise-confirmation / premise-seal / background-seal）仅落点本包 3 文件（Stage0View.tsx / premise-facts.ts / stage0-premise-facts.test.tsx），既有测试文件零匹配零碰撞；卡口复核 `git status -- shared electron resources package.json vite.config.ts tsconfig.json` 仅显 showrunner.md 的 M（007 既有未提交，非本包）——**K1 / K8 / K9 全零触发** ✅。
- **T7（2026-10-21）dev-mock 零回归目验**（Playwright MCP，localhost:5173 vite HMR 已载本包改动）：`git status/diff -- src/dev-mock-api.ts` 全空输出——dev-mock 零 diff ✅；点顶部阶段点「0」进 STAGE 0 立项视图 empty 态——链态条 `[data-stage0-chain]` 在屏，innerText 逐字「立项过程 | ① | 选题诊断 | 收敛中 4/6 | → | ② | 故事前提 | 收敛中 1/5 | → | 🚪 | 定案卡 | 未就绪」与 008 契约一致；CaptureBar「已捕获口径 · 5 条 · 2 待确认」+ 展开按钮在屏；卡体「立项尚未定案」+ 说明文案 + 返回画布按钮呈现不变；入口动作 · 用户原话卡 / 左栏项目库 / 右栏 Agent 面板无异常。published 卡② dev-mock 不可达（n-brief id 不匹配 BRIEF_NODE_ID 判定），分色目验已由组② 单测 6 例覆盖——需求规格 §3.2 ✅。
- **T8（2026-10-21）治理收尾**：D-001 翻「已批准」+ T1-T8 本节节回填；任务清单 checkbox 全勾；[设计现状与偏差清单.md](../../设计现状与偏差清单.md) B-44 行落表并翻 ✅（先例 B-43 模式）；[docs/features/README.md](../README.md) 0xx 段增 feature-009 行；呈报用户验收——**2026-10-21 用户「批准全部」验收通过，feature-009 正式闭环**（验收后全量复测 60 文件 704 passed / 0 failed / 1 skipped，与 T6 实测逐字一致）。

## X 节 · 修复留痕

无。T1-T8 全程零错误零返工：T5 新测试 15/15 一次全绿；T6 全量 704 passed / 0 failed 一次通过；typecheck 零新增；T3/T4 六次 SearchReplace 全部一次命中；T7 目验一次通过。
