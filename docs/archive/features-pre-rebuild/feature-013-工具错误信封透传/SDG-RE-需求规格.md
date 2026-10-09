# SDG-RE · 需求规格 · feature-013 工具错误信封透传（isError 不再被定稿层静默丢弃）

> 版本：v1.0（待用户签字）
> 日期：2026-10-06
> 来源标签：[自研新增]（修复运行时编排缺陷）
> 上游：feature-008（Agent 运行时集成）、feature-009（运行时界面接入）、feature-010（对话通道全量接入）、feature-011（立项补齐 · 门三动作）
> 直接触发：feature-012 T5-4 手动回归暴露——0-c「改部分」后重发 `shortdrama_visual_style` 业务失败，定稿后错误不上屏、不开门、无错误气泡。

---

## 1. 背景与问题

业务工具（8 个 `shortdrama_*`）失败时，经 [tools.ts `failed()`](../../../electron/mcp/tools.ts) 返回结构化错误信封（`isError:true`，正文为 `{kind, product:null, error:{code,message}}`）。opencode 收到 isError 后将 tool part 置为 `state.status='error'`、`state.error=<信封 JSON 原文串>`（已由 opencode.db 实证）。

但该错误在编排链路被静默丢弃，存在两个断点：

| # | 断点 | 位置 | 后果 |
| :-- | :-- | :-- | :-- |
| 1 | **投影层只在 completed 解析信封**：error 分支仅把 `state.error` 放入 `errorText`，不 `parseToolEnvelope`、不挂 `result` | [projection.ts L249–253](../../../electron/runtime/projection.ts#L249-L253) | 下游拿不到结构化信封 |
| 2 | **定稿层只认 `v.result`**：`v.result===undefined` 的 error 工具被 `continue` 跳过；`firstError` 也只从 `v.result.error` 读 | [App.tsx finalizeDoneTurn L522–548](../../../src/App.tsx#L522-L548) | `delivered=0`、`firstError=null`，错误气泡分支进不去，仅落 Agent 正文 |

**硬证据**：会话 `ses_eee51f5e3ffe3HY1PJUZ38h4f9` 三轮「改部分」重试的三个 visual_style tool part 的 `state.status` 全为 `error`，首个 `state.error` 为：

```json
{"kind":"visual_style","product":null,"error":{"code":"RUNTIME_UPSTREAM_ERROR","message":"视觉风格不在谱系目录（v1.45）：形态「2D漫」不在谱系目录（4 形态：仿真人 / 2D 漫 / 3D 漫 / 沙雕漫）"}}
```

log 三次 `permission ... action=allow`，排除授权阻塞。**业务失败本身（空格不一致）不是本 Feature 范围**（属待讨论的 B 匹配容错 / C 提示词自纠）；本 Feature 只修编排：**让已产生的错误信封不再被静默丢弃**。

> 关键收敛点：[finalizeDoneTurn](../../../src/App.tsx#L528-L548) 本已写好"信封带 error → 记 firstError → 落 makeError 气泡（含重试 token）"的逻辑，只是它读不到 error 工具的信封。因此本 Feature 主体是**打通透传**，而非新写一套错误处理。

---

## 2. 角色与场景

| 角色 | 场景 | 期望效果 |
| :-- | :-- | :-- |
| 创作者 | 任一门（含 0-c partial 不关门态）触发业务工具，工具业务失败 | 定稿后看到明确错误气泡，含失败原因与对应工具的重试入口 |
| 创作者 | 0-c「改部分」后 Agent 重算失败 | 错误如实上屏，**门保持打开、仍可继续「改部分」/编辑后重发**，不进入无反馈卡死 |
| 创作者 | Agent 正文未转述错误 | 即便模型未遵守 director.md「isError 须如实转述」，UI 层仍有兜底错误展示 |

---

## 3. 功能需求

### F1 · error 工具信封透传（投影层）`[自研新增]`

- F1-1 改造 [projection.ts](../../../electron/runtime/projection.ts) tool 分支：`status==='error'` 时，对 `state.error`（字符串化后）同样调用 `parseToolEnvelope`，识别为工具信封（含 `kind` 字段的对象）时挂到事件 `result`，同时保留 `errorText`（=错误原文串）。
- F1-2 `state.error` 不是可识别信封（非 JSON / 无 `kind`）时，`result` 不挂或为原始串，行为与现有 `parseToolEnvelope` 回退一致；不得因此抛错。
- F1-3 error 分支的 `resultPreview` 仍为错误原文的截断预览；凭证打码规则对 error 信封一视同仁。

### F2 · 定稿层消费 error 信封 `[自研新增]`

- F2-1 [finalizeDoneTurn](../../../src/App.tsx#L516-L550) 现有信封处理对 `status:'error'` 且 `result` 为错误信封的工具生效：记入 `firstError`，`delivered` 不自增，轮末落 `makeError` 气泡（重试 token 取该工具名去 `shortdrama_` 前缀）。
- F2-2 修复现有漏网路径：当 error 工具**不是**可识别信封（`v.result` 无信封但有 `errorText`）时，不得被彻底静默——以 `errorText` 作为失败文案来源落错误提示（找不到工具名时重试 token 沿用既有缺省 `'diagnose'`）。
- F2-3 门态语义不变：错误气泡上屏**不关闭当前门、不改 gate/gateKey**；门开态（partial）下用户仍可继续操作。本 Feature 不新增/删除任何门动作。

---

## 4. 不做什么（边界）

1. **不做 B（谱系匹配容错）**：不改 `assertInCatalog / validateVisualStyle`，不做形态名去空格/全半角规范化、不加别名。
2. **不做 C（提示词自纠）**：不改 director.md / prompts.ts 关于形态名逐字照抄或失败回传标准值的内容。
3. 不改 8 个业务工具的 `ok()/failed()` 信封结构与错误码。
4. 不改变 runtime 六类事件种类、不新增 IPC、不改持久化数据结构。
5. **不修改 `shared/types.ts`**（本 Feature 无 K1）。
6. 不新增运行时 npm 依赖（K9）。
7. 不顺带处理 `pendingGate:null` 的 manifest/replay 疑点（列为后续待查，与本根因独立）。

---

## 5. 验收标准（AC，任务清单 AC 表为准）

- AC-1 error 工具 part（`state.error` 为错误信封 JSON）投影后，`tool.call` 事件同时携带 `result`（解析后的信封对象，含 `kind/error`）与 `errorText`（原文串）。
- AC-2 error 工具 part 的 `state.error` 为非信封文本时，不抛错，`errorText` 保留原文；定稿层仍产出错误提示而非静默。
- AC-3 一轮中仅 error 信封、无成功产物：定稿后落错误气泡，文案取 `envelope.error.message`，重试 token 为对应工具名；不只落一条看似正常的正文。
- AC-4 门开态（含 0-c partial）下工具失败：错误气泡上屏且门仍打开、gate/gateKey 不变，用户可继续「改部分」/重发。
- AC-5 同一轮既有成功产物又有 error 工具：成功产物正常投递（`delivered` 计数正确），错误不伪造为成功；既有引导语行为不回归。
- AC-6 error 信封中的凭证字段经打码，不出现在事件/气泡明文。
- AC-7 typecheck、build、既有测试全通过，测试只增不减（新增投影 error 信封透传与定稿消费 error 的测试；既有 L264 `result undefined` 断言按新契约更新为"信封 error 时挂 result"，属契约反向同步，不弱化校验）。

---

## 6. 上下文加载清单（围栏）

见任务清单 §上下文加载清单。

## 7. 后续事项（不在本 Feature）

- B：谱系形态/画风名匹配容错（空格/全半角/别名）——待用户另行拍板。
- C：提示词强化逐字照抄 + 失败回传标准值供模型自纠——待讨论。
- 待查：manifest `pendingGate:null` 与预期不符的持久化/重载恢复路径。
