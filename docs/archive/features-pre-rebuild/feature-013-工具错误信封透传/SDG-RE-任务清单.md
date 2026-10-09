# SDG-RE 任务清单 · feature-013 工具错误信封透传

> 版本：v1.0（待用户签字）
> 日期：2026-10-06
> 前置：feature-008/009/010/011 已落地；业务工具 `failed()` 信封与 `parseToolEnvelope` 已存在。本 Feature **不新增 npm 依赖**。
> 卡口状态：触发 **K8**（修改内部 `tool.call` 事件 error 态 `result` 语义；finalizeDoneTurn 补非信封 error 消费）。**不触发 K1/K3/K6/K9**（不新增模块、不改 shared、零依赖）。用户对本任务包签字即视为授权；实施时在变更记录逐条追加永久决策。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`、`docs/governance/AI-SDG-AI工具执行指令.md`
- [x] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`
- [x] `electron/runtime/types.ts`（RuntimeEvent `tool.call` L108–129）
- [x] `electron/runtime/projection.ts`（tool 分支 L241–270、parseToolEnvelope L385–393、isObject、打码点）
- [x] `src/App.tsx`（finalizeDoneTurn L516–550、定稿 effect、handlePartial/sendRuntimePrompt 门态）
- [x] `src/lib/chat-runtime.ts`（tool.call 归约、ToolView）
- [x] `src/lib/messages.ts`（makeError）
- [x] `electron/mcp/tools.ts`（ok/failed 信封结构）
- [x] `src/test/runtime-projection.test.ts`、`src/lib/chat-runtime.test.ts`
- [x] `package.json`（零依赖确认）

> 禁止读取与修改清单以外文件，除非实施中明确需要（如新增定稿测试、接线验证处）。

## 1. 签字前置

- [x] T0-1 用户对需求规格 v1.0 / 契约 v1.0 / 任务清单 v1.0 逐项签字（K8 随签字授权；本 Feature 无 UI 视觉变化，不建 OD）
- [x] T0-2 用户确认 K8 卡口授权（本文件头部已列明，签字即确认）
- [x] T0-3 确认本 Feature **不动 shared/types.ts**（无 K1）、不做 B/C

## 2. 原子任务

### T1 · 投影层透传（契约 §2）

- [x] T1-1 改 `electron/runtime/projection.ts` error 分支：对 `state.error` 字符串化后调 `parseToolEnvelope`，`isObject(parsed)` 时挂 `result`；保留 `errorText` 原文与 `resultPreview` 截断
- [x] T1-2 确认 error 信封经与 completed 同一凭证打码（`project()` 末尾统一 `redactEvent`）；completed 路径零改动
- [x] T1-3 新增投影测试：`state.error` 为 `failed()` 信封 JSON → `result` 为信封对象、`errorText` 为原文、打码生效；保留既有 'boom' 非信封 `result undefined` 断言；非字符串 error 对象 safeStringify 不抛错

### T2 · 定稿层消费（契约 §3）

- [x] T2-1 验证可识别 error 信封自动走现有 L527–548 路径（firstError + makeError，重试 token=工具名）
- [x] T2-2 补非信封 error：`status:'error'` + 有 `errorText` 但无信封时，以 errorText 记 firstError；放宽 failedView 查找（信封 error 或 errorText），token 优先取工具名、找不到才兜底 'diagnose'
- [x] T2-3 新增定稿测试 `src/App.error-envelope.test.tsx`（4 用例）：仅 error 信封→气泡文案/重试 token 正确；非信封 errorText 不静默；成功+失败混合不回归；partial 门开态错误上屏且 gate/gateKey 不变

### T3 · 回归与自检

- [x] T3-1 `npm run typecheck`（tsc 无错）
- [x] T3-2 `npm run test`（42 文件 458 passed / 1 既有 skipped，只增不减）
- [x] T3-3 `npm run build` 通过（vite + electron/preload tsc）
- [x] T3-4 手动回归（2026-10-07，dev 5173 真实运行时，Computer Use 操作）：新建项目推进到 0-c 门 → 点「改部分」门不关闭（出现「部分通过 0-c，进入修改」chip）→ 发谱系外形态（二次元水墨风/赛博朋克工笔画），visual_style 返回 failed() 信封 `RUNTIME_UPSTREAM_ERROR`「视觉风格不在谱系目录（v1.45）：形态「undefined」…」→ 流式工具视图显示 error + 重试，定稿层落错误气泡「处理失败」+ 完整 envelope.error.message，gate 三按钮（确认拍板/改部分/否决重做）全部仍在、门态不变 → 发恢复 prompt「改回仿真人形态、清新生活流画风」，visual_style 重新运行并成功定稿（成功产物卡「视觉风格设定」上屏，无新增错误气泡）。结论：失败信封不再静默、错误上屏且门保持可改、成功路径不回归。

## 3. AC 自检表

| AC | 自检方式 | 任务 |
| :-- | :-- | :-- |
| AC-1 | 投影单测：error 信封同时挂 result + errorText | T1 |
| AC-2 | 投影单测：非信封不抛错；定稿测试：errorText 不静默 | T1/T2 |
| AC-3 | 定稿测试：仅 error 轮落气泡、文案/重试 token 正确 | T2 |
| AC-4 | 手动 + 测试：partial 门开态错误上屏且门不关闭 | T2/T3 |
| AC-5 | 定稿测试：成功+失败混合不回归 | T2 |
| AC-6 | 投影测试：error 信封凭证打码 | T1 |
| AC-7 | typecheck/test/build | T3 |
