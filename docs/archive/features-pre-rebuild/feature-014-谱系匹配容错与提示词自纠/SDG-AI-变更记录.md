# SDG-AI 变更记录 · feature-014 谱系匹配容错与提示词自纠

> 版本：v1.1（规格已签字 K8 授权；编码 + 自动化回归 + 手动回归全部完成，Feature 收尾）
> 日期：2026-10-07

## 决策记录（K 卡口触发，永久保留）

### D-014-1 · K8 谱系校验归一化与错误反馈值域（已签字 · 已实施）

- 触发：K8（变更既有接口契约语义——`validateVisualStyle` 名称匹配由严格等值改为归一比对；`assertInCatalog` 错误消息文本变更附值域。签名不变、导出只增不改）。
- 背景：feature-013 T3-4 手动回归实证三类缺陷——① 表示噪音误拒（`2D漫` vs `2D 漫`）；② 必填字段缺失时错误文案为「undefined」；③ 画风错误消息不带 18 项名单，模型/用户无法自纠。
- 用户拍板范围（2026-10-07）：**B1 机械规范化 + 缺失文案修 + C1 提示词强化 + C2 错误回传值域**；明确不做 B2 别名表、B3 就近吸附、C3 工具内部自愈重试。
- 内容：
  1. `electron/style-catalog.ts`：新增导出 `normalizeStyleName` / `matchForm` / `matchStyle` / `canonicalizeVisualStyle`；`validateVisualStyle` 改归一比对 + 缺失文案 + 动态名单；`assertInCatalog` 承接新 reason（错误码与前缀不变）。
  2. `electron/mcp/tools.ts`：visual_style 工具先 canonicalize 回写规范名再校验，产物携带目录规范名。
  3. `electron/prompts.ts`：`VISUAL_SYSTEM` 只增不改追加必填强调、错例对照、目录外诉求披露三条。
  4. 反向同步：feature-005 契约 L311/L313 与 feature-012 需求规格 L66 加修订标注指向本 Feature。
- 边界：谱系目录仍是硬选择域——归一只消除表示噪音，真目录外名称仍拒绝；不做语义别名、不做模糊吸附、不做内部重试；不动 shared/types.ts、零依赖、无 IPC/UI/持久化变化。
- 证据/反向同步：
  - `electron/style-catalog.ts`：新增导出 `normalizeStyleName`（NFKC → •/・→· → 去空白 → 小写）、`matchForm`/`matchStyle`、`canonicalizeVisualStyle`（浅拷贝回写规范名，未命中/缺失留原值）；`validateVisualStyle` 改归一比对，缺失报「未输出」附值域，主/辅画风错误附动态名单（`STYLE_CATALOG` 实时生成，禁硬编码）；`assertInCatalog` 错误码与前缀不变。
  - `electron/mcp/tools.ts`：visual_style 工具先 canonicalize 再 assert，产物携带规范名；mock/failed 分支与其余 7 工具零改动。
  - `electron/prompts.ts`：`VISUAL_SYSTEM` 选型规则追加 6/7/8（必填强调、错例对照 ❌2D漫 ✅2D 漫 等、目录外诉求选最接近项并在 rationale 披露）；既有语句逐字保留。
  - 反向同步：feature-005 契约 L311/L313、feature-012 需求规格 L66 已加修订标注指向本 Feature。
  - 测试：style-catalog.test.ts 新增 5 describe 10 用例（归一规则/零碰撞守护/match 命中与不命中/canonical 回写与原文保留/缺失文案/值域名单/真目录外拒绝）；revise-text.test.ts 新增 1 用例（C1 三要素断言）；既有断言全部保留。
  - 回归：`typecheck` 通过；`test` 42 文件 470 passed（458→+12）/ 1 既有 skipped，只增不减；`build` 通过。
  - 手动回归（2026-10-07，dev 5173 真实运行时，CDP 驱动）：①「2D漫」变体 → 工具成功、产物卡规范名「2D 漫」；② 子模型漏 form → 气泡「形态未输出（必填字段：…4 形态名单）」不再 undefined；③ 主画风「水彩绘本」→ 气泡含 11 主 + 7 备完整名单。
  - 实施期记录：① typecheck 需先 `tsc -p tsconfig.node.json` 刷新 dist-electron 声明（project references 指向编译产物），否则新导出报 TS2305——非代码问题，构建顺序使然；② 本会话 computer-use 工具不可用，手动回归改用 Electron `--remote-debugging-port=9222` + CDP（Runtime.evaluate / Input.dispatch*）驱动渲染层，等效于 UI 操作。
- 签字：✅ 用户已签字（K8 授权）；编码 + 自动化回归 + T5-5 手动回归全部完成，Feature 收尾。

---

## 实施记录（落地后可清理）

（实施期填写）

## 修订记录（决策稳定后可清理）

（实施期填写）
