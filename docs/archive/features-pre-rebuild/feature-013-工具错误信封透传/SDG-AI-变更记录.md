# SDG-AI 变更记录 · feature-013 工具错误信封透传

> 版本：v1.2（规格已签字 K8 授权；编码完成，自动化回归 + 手动回归全部通过，Feature 收尾）
> 日期：2026-10-06（手动回归 2026-10-07）

## 决策记录（K 卡口触发，永久保留）

### D-013-1 · K8 工具 error 信封透传与定稿消费（已签字 · 已实施）

- 触发：K8（修改内部 RuntimeEvent `tool.call` 事件 error 态 `result` 字段语义；补 finalizeDoneTurn 非信封 error 消费）。
- 背景：feature-012 T5-4 手动回归暴露——业务工具 `failed()` 信封（isError）在投影层 error 分支不解析、不挂 `result`，定稿层只认 `v.result`，致错误被静默丢弃（delivered=0、firstError=null，仅落 Agent 正文）。opencode.db 实证会话三轮 visual_style tool part 全为 error。
- 内容：
  1. `electron/runtime/projection.ts` error 分支复用 `parseToolEnvelope`，识别为结构化信封（对象含 kind）时挂 `result`，同时保留 `errorText` 原文；completed 路径零改动。
  2. `src/App.tsx` finalizeDoneTurn 现有信封 error 路径透传后自动生效（firstError + makeError 气泡，重试 token=工具名）；补"非信封但有 errorText"不静默。
  3. 门态不变：错误上屏不关闭门、不改 gate/gateKey，partial 门开态可继续操作。
- 边界：**只修编排透传**；不做 B（谱系匹配容错）、不做 C（提示词自纠）；不改信封结构、不新增 IPC、不改持久化、不新增依赖、不动 `shared/types.ts`。
- 证据/反向同步：
  - `electron/runtime/types.ts` L121–127 仅注释更新 `result`/`errorText` 语义，字段不增删。
  - 投影测试：既有 'boom'（非信封）`result undefined` 断言保留；新增 `state.error` 为 `failed()` 信封 JSON → `result` 为信封对象、`errorText` 为原文。
  - 新增 `src/App.error-envelope.test.tsx`（4 用例）：① 仅 error 信封→气泡文案取 `envelope.error.message`、retryToken=`visual-style`；② 非信封 errorText 不静默、retryToken 取该失败工具名；③ 成功+失败混合→成功产物投递、不落 error 气泡；④ partial 门开态错误上屏且 gate/gateKey 不变。
  - 回归：`typecheck` 通过；`test` 42 文件 458 passed / 1 既有 skipped（只增不减）；`build` 通过。
  - 实施期澄清：非信封 error 的重试 token 并非一律 `diagnose`——`failedView` 能找到该错误工具时取工具名（实测 visual_style → `visual-style`），仅在找不到错误视图时才兜底 `diagnose`；与契约 §3.2 一致。
  - 手动回归（2026-10-07，dev 5173 真实运行时）：0-c 门点「改部分」门不关闭；发谱系外形态后 visual_style failed() 信封经流式工具视图（error + 重试）透传，定稿层落「处理失败」错误气泡且文案为完整 `envelope.error.message`，gate 三按钮仍在、门态不变；发恢复 prompt 后 visual_style 成功定稿、成功产物卡上屏、无新增错误气泡。失败不静默、门保持可改、成功路径不回归三点均在真实运行时验证。
- 签字：✅ 用户已签字（K8 授权）；编码 + 自动化回归 + T3-4 手动回归全部完成，Feature 收尾。

---

## 范围外后续事项（非本 Feature 决策，仅备忘）

- B：谱系形态/画风名匹配容错（空格 / 全半角 / 别名）——待用户另行拍板。
- C：提示词逐字照抄强化 + 失败回传标准值供模型自纠——待讨论。
- 待查：manifest `pendingGate:null` 与预期不符的持久化/重载恢复路径。
