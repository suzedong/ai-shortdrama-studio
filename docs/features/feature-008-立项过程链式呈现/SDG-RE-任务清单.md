# SDG-RE-任务清单 — feature-008 立项过程链式呈现

> **批准前不触碰任何代码（铁律 1）**。待用户批准后按 T1-T9 顺序实施；执行记录回填 SDG-AI-变更记录 T/X 节。

## T1 基线冻结
- [x] 跑全量测试，确认基线 = **58 文件 662 passed / 0 failed / 1 skipped（663 total）**；typecheck 恰 3 条历史基线（canvas-zoom.test.tsx×2 + runtime-client.test.ts×1）
- [x] 基线数字记入变更记录 T1 行

## T2 chain.ts 纯函数层新建
- [x] 新建 `src/studio/stage0/chain.ts`（契约 §1 词表 + §2 签名）：`matchChainTopic`（trim+英文小写化精确匹配、中文别名、同 canonical 去重）/ `selectChainProgress`（六要素 x/6 + 前提 x/5 + unmatchedCount/totalFacts）/ `selectChainNodes`（三节点状态 + 🚪 优先级 published > pending > rejected > idle）/ `gatePayloadVersion`（payload unknown 守卫取 version）
- [x] 禁 fs / window.api / Date / 随机；独立模块不并入 select.ts（D6：facts 非 canvas 事实）
- [x] 零 import 副作用（jsdom 安全）

## T3 Stage0Chain.tsx 组件新建
- [x] 新建 `src/studio/Stage0Chain.tsx`：Props `{ state: Stage0State }`；内部 `useCaptureFacts()`（captureList 首拉 + onCaptureChanged 全量替换订阅，CaptureBar L33-41 同模式）；纯订阅零写入
- [x] 三节点链态条（h-[46px]）：`[① 选题诊断 x/6] → [② 故事前提 x/5] → [🚪 定案卡]`；状态徽标 + 文案契约 §3.3 逐字（禁用串零碰撞）
- [x] 🚪 节点点击展开只读摘要浮层（gate0.question 全文 pre-wrap + 「批准 / 驳回在右栏门卡操作」提示；点击切换非悬停、无外点/Esc 关闭；浮层不推布局）；published 态版本取 state.version，pending 态取 gatePayloadVersion
- [x] 凭据族上屏：`data-stage0-chain` / `-diag` / `-premise` / `-gate` / `-gate-summary` / `-error`

## T4 Stage0View 三布局挂载 + 顶距
- [x] EmptyStage0 / PublishedLoaded / BriefError 三布局 Header 后各挂 `<Stage0Chain state={state} />`（行级 diff 边界见契约 §4）
- [x] 三处滚动容器 `top-[38px]` → `top-[84px]`（38+46=84）；published 双卡主体零 diff

## T5 既有测试 installFileRead 叠加（唯一既有测试 diff）
- [x] `stage0-view.test.tsx` L134-138 `installFileRead` 叠加恰 2 行 capture 空桩（captureList 空 facts + onCaptureChanged 空退订），逐字按契约 §5；否决生产代码可选链守卫（D5）（实施实记：+3 行 = 注释 1 行 + 桩 2 行，注释与 installUpdateBrief 先例同款，见变更记录 T5）

## T6 单测 stage0-chain.test.tsx
- [x] 新建测试文件（契约 §5 四组：matchChainTopic 词表 / selectChainProgress 进度 / selectChainNodes 三节点+门优先级 / Stage0Chain 组件订阅+摘要交互）
- [x] **测试文件净增恰 1：58 → 59**；既有测试除 T5 恰 2 行外零 diff

## T7 全量回归 + 静态验证
- [x] 全量测试：passed 不减（≥662）、failed = 0、skipped 不增（=1）、文件数 = 59
- [x] typecheck：恰 3 条历史基线，零新增
- [x] Grep 静态验证：链态条文案无 §3.3 禁用串；Stage0View 主体（双卡）零 diff
- [x] 结果记入变更记录 T7 行

## T8 真机目验（dev-mock 浏览器预览）
- [x] empty 态链态条上屏：预置 5 条演示事实 → ① 4/6 · ② 1/5 · 🚪 未就绪（dev-mock 零 diff）
- [x] CaptureBar 直增 episodeDuration 事实 → ① 进度联动 5/6
- [x] 🚪 待批准/已发布态摘要交互走单测覆盖（目验记录记入变更记录 T8 行）

## T9 治理收尾
- [x] 变更记录 T 节全量回填 + X 节（零修复则明示）
- [x] 偏差清单 B-43 行翻 ✅ 已闭环
- [x] README 总表 0xx 段增 008 行
- [x] 呈报用户验收
