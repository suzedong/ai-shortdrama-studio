# SDG-OD · 设计说明 · feature-010 对话通道全量接入

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 形态来源：[改编] 对齐 MiniMax Design 对话内 Agent 过程可见；不改既有三栏骨架与视觉 token。

---

## 1. 范围

仅改右侧对话栏 [ChatPanel.tsx](../../../src/components/ChatPanel.tsx) 内部的"进行中轮"区域与主进程对话通道；不改三栏布局、不新增页面 / 路由、不引入新视觉风格。

## 2. 视觉 token（沿用，不新增色板）

| token | 值 | 用途 |
| :-- | :-- | :-- |
| violet | #6C5CE7 | 主强调、流式光标、进行中状态 |
| ink | #1A1A2E | 正文 |
| muted | #8A8FA3 | 次要文本、时间、提示 |
| line | #E8E9F0 | 1px 分隔线、卡片描边 |
| canvas | #FAFAFE | 卡片底 |
| ok | #2BB673 | 工具 completed |
| warn | #E8A93C | 注意 / reasoning 标记 |
| bad | #E8A952 | 错误 / 停止 / 工具 error |

字号阶仅允许 10 / 11 / 12 / 14 px；圆角沿用现有卡片；不引入渐变块、阴影堆叠。

## 3. 布局：进行中轮（StreamingTurn）区

消息流中，agent 一轮在 `session.idle` 前以一张「进行中卡」承载，自上而下：

```
┌─ 进行中卡（canvas 底，1px line，无阴影） ────────────┐
| [● 正在生成…]  工具 N · 用时 mm:ss        [■ 停止生成] │  header 行 12px
├─────────────────────────────────────────────────── │
| 正文流式区（ink 14px，行高 1.7）                       │
| ……逐字文本，末尾 8x16 violet 闪烁光标                  │
├─────────────────────────────────────────────────── │
| ▸ 推理过程（warn 11px，默认折叠，点击展开/收起）        │
| ▸ 工具调用（N）（muted 11px，默认展开首个 running）     │
│   ├ ✓ shortdrama_diagnose · 1.2s            [参数][结果]│
│   ├ ⠋ shortdrama_scenes · running…                     │
│   └ ✕ shortdrama_xxx · 错误：<errorText>      [重试]    │
└───────────────────────────────────────────────────┘
```

约束：
- 不使用 alert / 弹窗承载工具错误；错误就地显示于工具行。
- 「停止生成」仅在 `streaming.status==='running'` 可点；点击后变禁用态「停止中」。
- 长参数 / 结果 `break-all`，不撑破 360px 侧栏。

## 4. 流式正文

- delta 到达即追加；自动滚底（沿用 bottomRef），用户上滚后不强制抢滚（沿用现有滚动行为；本 Feature 不新增滚动开关）。
- 光标：正文末尾 2px violet 竖块，1s 间隔闪烁；idle / error 后消失。
- 无 delta、仅有 reasoning / tool 的轮：正文区显示单行 muted「（本轮无文本输出）」。

## 5. 推理过程折叠区

- 默认折叠；header：`▸ 推理过程` + 累计字符数；展开内为 muted 11px，行高 1.7，保留换行。
- reasoning 到达时若折叠，header 出现 warn 小圆点提示「有更新」，不自动展开（避免打扰）。
- 与正文严格分轨：reasoning 永不进入正文区。

## 6. 工具调用行

| 状态 | 图标（色） | 内容 |
| :-- | :-- | :-- |
| running | 旋转圆点（violet） | `工具名 · running…` + 已用时（实时秒数） |
| completed | ✓（ok） | `工具名 · X.Xs` + `[参数] [结果]` 文字按钮 |
| error | ✕（bad） | `工具名 · 错误：errorText（截断一行）` + `[重试]` |

- 工具名：去掉 `shortdrama_` 前缀显示业务名（如 diagnose / scenes），title 悬停显示完整 ID。
- `[参数]`：展开行内 JSON 视图（10px 等宽，line 底，最多 6 行，超出滚动）。
- `[结果]`：展开结构化 `result`（ToolResultEnvelope / product）JSON 视图；可折叠。
- 多个工具按 `startedAt` 排序；running 工具置顶。

## 7. 定稿轮（idle 后）

- 进行中卡 → 正式消息：正文成为 ChatMessage.content；工具过程默认全部折叠保留（不丢失）；产物 kind 走既有产物卡（diagnosis/outline/…）渲染，不重复显示流式正文与产物卡两套正文（产物类 kind 以产物卡为准，正文仅作引导语）。
- appendMessage 落盘时机与字段沿用现有逻辑。

## 8. 错误与空态

- 整轮 error：错误气泡（现有 error kind）+ 重试；reasoning/工具过程保留在折叠区。
- 部分工具 error 但轮继续：仅工具行标 error，不整轮失败。
- 停止生成：正文保留，header 变 muted「已停止」；不作为 error。

## 9. 不变项（回归保护）

- @人物 chip、修改 draft chip、候选卡 adopt/discard/reroll、superseded 角标、清空入口、底部装饰行、输入锁定态：全部不改。
- gate 卡与定稿流程不改。

## 10. 视觉验收条目（真机）

- V-1 三栏无 reflow；进行中卡不超出右栏宽度，长 JSON `break-all` 无横向溢出。
- V-2 仅使用 §2 token；无新增色块 / 渐变 / 阴影；分隔仅 1px line。
- V-3 流式正文逐字、光标 violet 闪烁、自动滚底；idle 后光标消失。
- V-4 reasoning 默认折叠、warn 更新提示、展开后与正文分轨。
- V-5 工具三态图标配色正确；running 实时计时；completed 参数 / 结果可展开 JSON。
- V-6 停止生成就地可用，停止后 header「已停止」，无弹窗。
- V-7 错误就地（工具行 / 错误气泡），无 alert；可重试。
- V-8 字号仅 10/11/12/14。
