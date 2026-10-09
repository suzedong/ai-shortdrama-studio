# SDG-RE · 契约 · feature-013 工具错误信封透传

> 版本：v1.0（待用户签字）
> 日期：2026-10-06
> 卡口：本契约触发 **K8**（修改内部 RuntimeEvent `tool.call` 事件 `result` 字段在 error 态的语义；定稿层错误消费分支）。**不触发 K1**（不改 `shared/types.ts`）、**不触发 K6**（不新增模块/文件，仅改既有 `projection.ts` 与 `App.tsx`）、**不触发 K3/K9**（零新依赖、无系统替换）。用户签字即视为对 K8 的授权，实施时仍须在变更记录追加永久决策条目。
> 兼容：不新增 npm 依赖；不新增 IPC；不改变持久化数据结构与门禁动作；为加性语义扩展（error 态新增可选 `result`），不破坏既有 completed 路径消费方。

---

## 1. RuntimeEvent `tool.call` 字段契约（K8 加性变更）

文件：[electron/runtime/types.ts L108–129](../../../electron/runtime/types.ts#L108-L129)。仅更新 `result` / `errorText` 的注释语义，字段本身不增删、不改名：

```ts
/**
 * completed：state.output 解析后的 ToolResultEnvelope 对象，无法识别时为原始字符串；
 * error：当 state.error 为可识别 ToolResultEnvelope（含 kind 字段的对象）时，同样挂解析后的信封对象；
 *        state.error 非信封文本时不挂（undefined）或为原始字符串
 */
result?: unknown
/**
 * error：完整错误文本（不截断）。
 * 注意：error 态下 result 与 errorText 可同时存在——result 为结构化信封、errorText 为同一错误的原文串
 */
errorText?: string
```

判据：

- completed 路径行为**完全不变**。
- error 路径由"只填 errorText"改为"errorText +（可识别时）result"，二者来源为同一 `state.error` 文本。

---

## 2. 投影层契约（projection.ts）

### 2.1 复用现有解析

- error 分支调用的信封解析函数**必须复用**既有 [`parseToolEnvelope`](../../../electron/runtime/projection.ts#L385-L393)，禁止另写解析逻辑：

```ts
function parseToolEnvelope(rawOutput: string): unknown
// JSON.parse 成功 且 isObject(parsed) && typeof parsed.kind==='string' → 返回 parsed 对象
// 否则（非 JSON / 无 kind / 标量）→ 返回原始字符串 rawOutput
```

### 2.2 tool 分支 error 处理（目标形态）

[projection.ts L241–253](../../../electron/runtime/projection.ts#L241-L253) 改造后语义：

```ts
let result: unknown
let resultPreview: string | undefined

if (status === 'completed') {
  const rawOutput = typeof state.output === 'string' ? state.output : safeStringify(state.output)
  result = parseToolEnvelope(rawOutput)
  resultPreview = truncatePreview(rawOutput)
}

let errorText: string | undefined
if (status === 'error') {
  const rawError = typeof state.error === 'string' ? state.error : safeStringify(state.error)
  errorText = rawError
  const parsed = parseToolEnvelope(rawError)
  // 仅当解析出结构化信封（对象且含 kind）时挂 result；parseToolEnvelope 回退为原串时不挂
  if (isObject(parsed)) result = parsed
  resultPreview = truncatePreview(rawError)
}
```

约束：

- 判断"是否结构化信封"用 `isObject(parsed)`（`parseToolEnvelope` 回退原串时 parsed 为 string）；不新增布尔字段。
- `resultPreview` 仍取错误原文截断；`argsPreview/args/startedAt/endedAt` 不变。
- 事件组装处 `...(result !== undefined ? { result } : {})` 已能覆盖两条路径，无需新增分支。

### 2.3 打码

error 信封在挂 `result` 前/后须与 completed 输出走**同一凭证打码处理**（现有 output 打码点须覆盖 error 文本）；`errorText` 维持"完整不截断"既有语义，但其打码要求与现状一致。

---

## 3. 定稿层契约（App.tsx finalizeDoneTurn）

文件：[src/App.tsx L516–550](../../../src/App.tsx#L516-L550)。

### 3.1 可识别 error 信封（透传后自动生效）

- 现有循环 L522–532：error 工具经 F1 后 `v.result` 为 `{kind, product:null, error:{...}}`，命中 L527 `'kind' in env`、L528 `env.error` → 记 `firstError`、`continue`，`delivered` 不增。
- L543–548 错误气泡分支：`failedView` 经 `v.result.error` 可命中，重试 token = `v.tool.replace(/^shortdrama_/,'')`。**此路径打通后不需新增代码即可工作**；实施时仅验证。

### 3.2 非信封 error（F2-2，需补消费）

对 `v.status==='error'` 但 `v.result` 非信封对象（undefined 或原始字符串）、而 `v.errorText` 非空的工具，不得静默。处理规则：

- 在现有循环中增加：识别为"error 态 + 有 errorText 但无信封 error"时，以 `errorText` 作为失败文案记入 `firstError`（仅当尚无 firstError）。
- 错误气泡的 `failedView` 查找（L544–547）放宽为：`v.result.error 信封` **或** `v.status==='error' && v.errorText`；重试 token 优先取工具名，取不到沿用既有缺省 `'diagnose'`。
- 实现须保持最小改动，不重构 finalizeDoneTurn 整体结构。

### 3.3 门态不变（F2-3）

- finalizeDoneTurn **不得**调用 `setGate/setGateKey/setActiveUnlock` 等任何门状态变更；错误气泡仅经 `pushMessage(makeError(...))` 上屏。
- partial 门开态下，`gate/gateKey` 由既有 handlePartial/sendRuntimePrompt 保持，本 Feature 不触碰。

---

## 4. 持久化 / IPC 契约

- **无新增 IPC**，preload / global.d.ts / main.ts / session.ts 不变。
- 错误气泡为既有 `makeError` 消息，持久化行为与现状一致；不新增字段、不改 manifest 结构。

---

## 5. 既有测试的契约反向同步（铁律 3）

| 文件 | 现有断言 | 变更 |
| :-- | :-- | :-- |
| [runtime-projection.test.ts L240–264](../../../src/test/runtime-projection.test.ts#L240-L264) | `toolErr`（error='boom'）断言 `result` undefined | 'boom' 非信封，仍应 undefined，**断言保留不变**（验证非信封回退） |
| 同文件 | 无"error 信封"用例 | **新增**：`state.error` 为 `failed()` 信封 JSON 时，断言 `result` 等于信封对象且 `errorText` 为原文 |
| 新增定稿测试 | — | error 信封轮落 makeError 气泡、非信封 errorText 不静默、门态不变 |

> 说明：原总结中"L264 断言需更新"经核对为误判——'boom' 是纯文本、按 §2.2 仍不挂 result，故该断言保留；真正变化的是"信封 error"这一新用例。测试只增不减。

---

## 6. 异常规则汇总

1. `state.error` 非字符串对象：经 `safeStringify` 后再解析，不抛错。
2. error 文本 JSON.parse 失败 / 无 kind：`result` 不挂，保留 `errorText`；定稿按 §3.2 落错误提示。
3. 一轮多工具全 error：`firstError` 取按 `startedAt` 排序的首个失败，只落一条错误气泡（既有语义）。
4. 成功 + 失败混合：成功产物正常投递；是否落气泡以 `delivered===0 && firstError` 既有条件为准（有成功产物时不落 error 气泡，沿用现状，不扩张）。
5. error 信封含凭证：打码后透出。
6. 任何实现不得增删/改名契约字段；冲突按 L1/L2/L3 处理。

---

## 7. 验收映射

见任务清单 AC 表（AC-1 ~ AC-7 与需求规格 §5 对齐）。
