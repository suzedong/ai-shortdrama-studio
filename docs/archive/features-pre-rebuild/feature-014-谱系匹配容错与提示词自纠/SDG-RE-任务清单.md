# SDG-RE 任务清单 · feature-014 谱系匹配容错与提示词自纠

> 版本：v1.0（待用户签字）
> 日期：2026-10-07
> 前置：feature-005/012/013 已落地；用户已拍板范围 = **B1 归一 + 缺失文案 + C1 提示词强化 + C2 错误回传值域**（不做 B2 别名 / B3 吸附 / C3 内部重试）。本 Feature **不新增 npm 依赖、不新增文件**（测试用例加在既有测试文件内）。
> 卡口状态：触发 **K8**（`validateVisualStyle` 匹配语义与 `assertInCatalog` 错误消息文本变更）。**不触发 K1/K6/K9**。用户对本任务包签字即视为授权；实施时在变更记录逐条追加永久决策。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`、`docs/governance/AI-SDG-AI工具执行指令.md`
- [x] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`
- [x] `electron/style-catalog.ts`（全文：FORMS/STYLE_CATALOG/validateVisualStyle/assertInCatalog）
- [x] `electron/prompts.ts`（VISUAL_SYSTEM L54–79、buildVisualStylePrompt L81–87、parseVisualStyle L89–95）
- [x] `electron/mcp/tools.ts`（visual_style 工具 L155–189；ok/failed 信封）
- [x] `src/test/style-catalog.test.ts`（既有 8 用例，全部保留）
- [x] `src/test/revise-text.test.ts`（L80–110 system/user 断言，全部保留）
- [x] `docs/features/feature-005-产物解锁重做/SDG-RE-契约.md` L311–313（反向同步对象）
- [x] `docs/features/feature-012-视觉风格谱系资产/SDG-RE-需求规格.md` L66（反向同步对象）
- [x] `package.json`（零依赖确认）

> 禁止读取与修改清单以外文件，除非实施中明确需要。

## 1. 签字前置

- [x] T0-1 用户对需求规格 v1.0 / 契约 v1.0 / 任务清单 v1.0 逐项签字（K8 随签字授权）
- [x] T0-2 用户确认 K8 卡口授权（本文件头部已列明，签字即确认）
- [x] T0-3 确认范围边界：不做 B2/B3/C3；不动 shared/types.ts；零依赖

## 2. 原子任务

### T1 · style-catalog.ts 归一与校验语义（契约 §1–§2）

- [x] T1-1 新增导出 `normalizeStyleName`（NFKC → `•`→`·` → 去空白 → 小写；非字符串返回 `''`）
- [x] T1-2 新增导出 `matchForm` / `matchStyle`（归一比对，命中返回目录规范值）
- [x] T1-3 新增导出 `canonicalizeVisualStyle`（浅拷贝回写规范名；未命中/缺失误留原值）
- [x] T1-4 `validateVisualStyle` 改归一比对；缺失文案「未输出」（不含 `undefined`）；主/辅画风错误消息附动态名单（11 主 7 备 / 备档 7 项）
- [x] T1-5 `assertInCatalog` 仅承接新 reason 文本；错误码与前缀不变

### T2 · tools.ts 接线（契约 §3）

- [x] T2-1 visual_style 工具：`parseVisualStyle` 后先 `canonicalizeVisualStyle` 再 `assertInCatalog`，产物用 canonical；mock/failed 分支不变；其余工具零改动

### T3 · prompts.ts 提示词强化（契约 §4）

- [x] T3-1 `VISUAL_SYSTEM` 追加必填强调 + 错例对照 + 目录外诉求处理三条；既有语句逐字保留；`buildVisualStylePrompt` 签名与 user 段不变

### T4 · 测试（只增不减）

- [x] T4-1 `style-catalog.test.ts` 新增：`normalizeStyleName`（全角/间隔号/空白/大小写/非字符串）；`matchForm`/`matchStyle` 命中与不命中；`canonicalizeVisualStyle` 回写与原文保留；归一零碰撞守护（4+18 归一后唯一）
- [x] T4-2 `style-catalog.test.ts` 新增：缺失字段文案含「未输出」不含 `undefined`；主画风错误消息含 11 主 + 7 备全名；辅画风错误消息含备档名单；真目录外（`二次元水墨风`/`水彩绘本`）仍拒绝
- [x] T4-3 `revise-text.test.ts` 新增：system 含必填约束 / 错例对照（`2D 漫` 对照）/ 目录外诉求披露要求；既有断言不删不改

### T5 · 反向同步与回归

- [x] T5-1 feature-005 契约 L311/L313、feature-012 需求规格 L66 加修订标注（措辞见契约 §5）
- [x] T5-2 `npm run typecheck` 通过
- [x] T5-3 `npm run test` 全绿，测试只增不减
- [x] T5-4 `npm run build` 通过
- [x] T5-5 手动回归（2026-10-07，dev 5173 真实运行时，CDP 驱动 Electron 渲染层）：① 发「形态 2D漫（无空格），主画风清新生活流」→ visual_style 成功（108.8s），产物卡显示规范名「视觉风格：2D 漫｜清新生活流」（归一 + 规范名回写生效，无错误气泡）；② 强令主画风原文输出「水彩绘本」且首轮子模型漏输出 form → 错误气泡「形态未输出（必填字段：form 须逐字取 4 形态之一：仿真人 / 2D 漫 / 3D 漫 / 沙雕漫）」（不再 undefined）；③ 补令两字段必填后重发 → 错误气泡「主画风「水彩绘本」不在谱系目录（18 画风；主档：<11 项全名>；备档：<7 项全名>）」（值域完整上屏）。结论：变体成功、真目录外拒绝且名单可自纠、缺失文案有信息量，feature-013 错误上屏链路不回归。
- [x] T5-6 变更记录升版收尾（实施记录 + 证据）

## 3. AC 自检表

| AC | 自检方式 | 任务 |
| :-- | :-- | :-- |
| AC-1 表示变体命中并回写规范名 | T4-1 单测（`2D漫`/全角/含空格 → `2D 漫`）+ T5-5 手动 | T1/T4/T5 |
| AC-2 画风名变体命中 | T4-1 单测（半角括号年代胶片 / `DV•CCD` 无空格） | T1/T4 |
| AC-3 真目录外不误吸 | T4-2 单测 + T5-5 手动 | T1/T4/T5 |
| AC-4 缺失文案不含 undefined | T4-2 单测 | T1 |
| AC-5 值域回传（主 11+备 7 / 备档名单） | T4-2 单测 + T5-5 手动 | T1 |
| AC-6 提示词强化且既有断言保留 | T4-3 单测 | T3/T4 |
| AC-7 归一零碰撞 | T4-1 守护用例 | T4 |
| AC-8 typecheck/test/build + 手动回归 | T5-2~T5-5 | T5 |
