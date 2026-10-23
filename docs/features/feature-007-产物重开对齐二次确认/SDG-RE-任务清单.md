# SDG-RE-任务清单 — feature-007 产物重开对齐二次确认

> **批准前不触碰任何代码（铁律 1）**。待用户批准后按 T1-T9 顺序实施；执行记录回填 SDG-AI-变更记录 T/X 节。

## T1 基线冻结
- [x] 跑全量测试，确认基线 = **57 文件 648 passed / 0 failed / 1 skipped（649 total）**；typecheck 恰 3 条历史基线（canvas-zoom.test.tsx×2 + runtime-client.test.ts×1）
- [x] 基线数字记入变更记录 T1 行

## T2 RealignConfirm 新建
- [x] 新建 `src/studio/RealignConfirm.tsx`：`buildRealignPrompt` 纯函数（契约 §1.1 固定模板逐字；fields 经 CanvasBoard 既有 export `dirtyFieldLabel` 中文化、顿号分隔、未收录回退原文）
- [x] 三选一确认组件：`role="dialog"` 居中卡片 + 遮罩；产物行（kindLabel · title）/ 版本对 / 中文字段 / severity 两态提示 / impactReport 纯文本；三按钮（`按 vM 重新对齐` 主钮 / `保持现状查看` / `取消`）→ 三回调；无 Esc / 背景点击关闭
- [x] 零 import 副作用（jsdom 安全）

## T3 StudioApp 拦截接线
- [x] 新增 `confirmNode` state（L105 viewerNode 旁）
- [x] handleOpenNode（L377）拦截：`node.dirty` 非空 → `setConfirmNode(node)`（不开查看器）；否则 `setViewerNode(node)` 直通
- [x] 三 handler：onRealign = 关确认 + 关查看器 + `handleSend(buildRealignPrompt(...))`；onKeepView = `setViewerNode(confirmNode)` + 关确认；onCancel = 仅关确认
- [x] 项目切换复位点（L274）同点 `setConfirmNode(null)`
- [x] StudioViewer 接线处（L700-705）下传 `onRequestAlign = () => setConfirmNode(viewerNode)`；confirmNode 非空时挂载 RealignConfirm

## T4 StudioViewer 黄条
- [x] Props 加可选 `onRequestAlign?: () => void`
- [x] refPath 行（L613）之后、body（L614）之前插黄条：`node.dirty` 非空 → 契约 §3.1 黄条文案 + 「一键对齐」钮（onRequestAlign 未传 → 黄条无钮）
- [x] `import { dirtyFieldLabel } from './CanvasBoard'`（与 BriefHistoryView 同路径复用，无循环依赖）

## T5 指令层小补（showrunner + R-008）
- [x] showrunner.md L168-171 脏读纪律段追加第三条（需求规格 §3.5：【产物重新对齐】前缀核实脏态 → 串行委派 → align 清脏；保持现状不动作）
- [x] feature-001 变更记录登记 R-008

## T6 单测
- [x] 新建 `src/studio/realign-confirm.test.tsx`（契约 §5 四组断言：模板纯函数 / RealignConfirm 组件 / StudioViewer 黄条 / StudioApp 集成七例）
- [x] **测试文件净增恰 1：57 → 58**；既有 57 测试文件零 diff

## T7 全量回归
- [x] 全量测试：passed 不减（≥648）、failed = 0、skipped 不增（=1）、文件数 = 58
- [x] typecheck：恰 3 条历史基线，零新增
- [x] Grep 静态验证：showrunner.md 含 R-008 新增条；feature-001 变更记录含 R-008 节
- [x] 结果记入变更记录 T7 行

## T8 真机目验（dev-mock 浏览器预览）
- [x] 点 n-outline（脏）→ 确认弹：产物行 / 基于 v2 · 最新 v3 / 季边界、集数 / 影响等级：高 · 建议重新生成 / 影响清单：影响清单.v2-v3.json
- [x] 三路径逐一目验：重新对齐 → 对话区注入模板消息且确认关、查看器未开；保持现状 → 查看器开 + 黄条显 + 一键对齐再唤起确认；取消 → 确认关、零消息
- [x] 点 n-scenes（无脏）→ 直通查看器无确认（回归）
- [x] 目验记录（路径 / 截图或文字描述）记入变更记录 T8 行

## T9 治理收尾
- [x] 变更记录 T 节全量回填 + X 节（零修复则明示）
- [x] 偏差清单 B-42 行翻 ✅ 已闭环
- [x] README 总表 007 行翻 ✅
- [x] 呈报用户验收
