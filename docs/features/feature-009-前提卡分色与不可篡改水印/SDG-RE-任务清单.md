# feature-009 · 前提卡分色 + 不可篡改水印 · 任务清单

> 版本：v1.0（2026-10-21）
> 实施唯一事实源：[SDG-RE-契约.md](./SDG-RE-契约.md)。每步完成后回填实测结果至 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md) T 节。

## T1 基线冻结

- [x] 全量测试：确认 59 文件 / 689 passed / 0 failed / 1 skipped（feature-008 闭环终态基线）
- [x] typecheck：确认恰 3 条历史基线（canvas-zoom.test.tsx TS2322 L13 + TS6133 L90、runtime-client.test.ts TS2741 L45，exit code 2 预期），零新增
- [x] git status 盘点工作树（007/008 未提交代码在树，本包增量可辨识）

## T2 新建 `src/studio/stage0/premise-facts.ts`（纯函数层）

- [x] 按契约 §2 逐字实现：import type ProjectBrief/CapturedFact + matchChainTopic + PREMISE_FIELDS；禁 fs / window.api / Date / 随机；零 import 副作用
- [x] `selectPremiseConfirmation(facts)` 按契约 §1 真值表逐键判定，返回五键全覆盖（PREMISE_FIELDS 表序）
- [x] chain.ts / select.ts 零 diff 复核

## T3 `src/studio/Stage0Chain.tsx` 一词 export

- [x] L15 `function useCaptureFacts()` → `export function useCaptureFacts()`；hook 本体零改动
- [x] 文件头注释追加一行 feature-009 导出留痕
- [x] stage0-chain.test.tsx 全绿复核（本包与其零交集）

## T4 `src/studio/Stage0View.tsx` PublishedBody 分色 + 双徽标

- [x] import 段：useCaptureFacts（from './Stage0Chain'）+ selectPremiseConfirmation（from './stage0/premise-facts'）+ useMemo 扩 react import
- [x] PublishedBody 顶部：`const { facts } = useCaptureFacts()` + `const confirmMap = useMemo(() => selectPremiseConfirmation(facts), [facts])`（契约 §3.1）
- [x] 五键行容器逐字 diff（底色 class 追加 + data-stage0-premise-row + data-stage0-premise-confirmation + 行尾条件徽标，契约 §3.2）；label span 与 LeafValue 本体零 diff
- [x] 五键字段容器加 overflow-hidden 一词（契约 §3.2 末条）
- [x] 背景档案标题行 button 内追加 background-seal 徽标（契约 §3.3，与 bg.phase 无关）
- [x] 其余全部零 diff 复核：卡① / BriefEditPanel / 定案区 / 版本区 / empty 三态 / Header / 链态条挂载区 / BackgroundMd / LeafValue

## T5 新建 `src/studio/stage0-premise-facts.test.tsx`（净增恰 1）

- [x] 组① 纯函数 9 例（契约 §5 组①：空 facts 全覆盖 / user→human / infer+confirmed→human / infer+pending→ai / 混合 confirmed 优先 / 中文别名 / trim+大小写 / 六要素不打扰 / 未命中不打扰）
- [x] 组② 集成 6 例（契约 §5 组②：全空三零 / human 行 / ai 行 / 混合共存 / 档案 seal+折叠零回归 / emit 联动 ai→human 翻转）
- [x] installViewApi 复刻 stage0-chain.test.tsx 模式 + StrictMode + _setStyleCatalogSnapshotForTest 单条 A7 prime
- [x] 既有测试文件全零 diff（59 → 60 净增恰 1）

## T6 全量回归 + 静态验证

- [x] 全量测试：60 文件、passed 净增恰新例数、0 failed、1 skipped
- [x] typecheck：恰 3 条历史基线零新增
- [x] 禁用串复查：「不可篡改」「AI 拟稿」与凭据族既有断言侧零碰撞（契约 §3.6）
- [x] K1/K8/K9 卡口复核全零触发

## T7 dev-mock 零回归目验

- [x] dev-mock 零 diff 复核
- [x] empty 态链态条 / CaptureBar 呈现不变目验（published 卡② dev-mock 不可达，分色目验已由单测覆盖——需求规格 §3.2）

## T8 治理收尾

- [x] 变更记录回填：D-001 翻「已批准」、T1-T8 实测、X 节（如有）
- [x] 任务清单 checkbox 全勾
- [x] 偏差清单 B-44 行落表并翻 ✅（先例 B-43 模式）
- [x] docs/features/README.md 0xx 段增 feature-009 行
- [x] 呈报用户验收（2026-10-21 用户「批准全部」验收通过；验收后全量复测 60 文件 704 passed / 0 failed / 1 skipped）
