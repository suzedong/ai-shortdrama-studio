# SDG-RE · 契约 · feature-014 谱系匹配容错与提示词自纠

> 版本：v1.0（待用户签字）
> 日期：2026-10-07
> 卡口：本契约触发 **K8**——变更既有接口契约语义：`validateVisualStyle` 的名称匹配由「严格等值」改为「归一比对」，`assertInCatalog` 错误消息文本变更（附值域）。函数签名不变、导出只增不改。**不触发 K1**（不改 `shared/types.ts`）、**不触发 K6**（不新增模块/文件，全部落在既有 `style-catalog.ts` / `tools.ts` / `prompts.ts`）、**不触发 K9**（零新依赖）。用户签字即视为对 K8 的授权，实施时须在变更记录追加永久决策条目。
> 兼容：归一为加性放宽（原通过的值仍通过、判定结果不变；原误拒的表示变体新通过）；产物值回写规范名对下游（UI/manifest/风格资产）为收敛而非破坏。
> 既有契约反向同步对象：feature-005 契约 §style-catalog 导出语义行（`docs/features/feature-005-产物解锁重做/SDG-RE-契约.md` L311/L313）；feature-012 需求规格边界条款「不改 validateVisualStyle / assertInCatalog 校验规则」（`docs/features/feature-012-视觉风格谱系资产/SDG-RE-需求规格.md` L66）——两处加修订标注指向本 Feature。

---

## 1. 归一函数契约（style-catalog.ts 新增导出）

```ts
export function normalizeStyleName(input: unknown): string
```

确定性纯函数，依次执行：

1. 非字符串输入 → 返回 `''`（不抛错）。
2. Unicode **NFKC** 归一（全角 ASCII/全角括号→半角；`・`(U+30FB)→`·`(U+00B7) 由 NFKC 覆盖）。
3. 间隔号统一：显式将 `•`(U+2022) 替换为 `·`(U+00B7)（不依赖 NFKC 行为记忆，双保险）。
4. 去除全部空白字符（`\s+`，含空格/制表/换行/全角空格——全角空格经 NFKC 已为半角空格，再由本步去除）。
5. `toLowerCase()` 小写化（仅影响 ASCII 段，中文无影响）。

性质：幂等；对目录 4 形态 + 18 画风名两两归一后**必须互不相同**（零碰撞，测试固化）。

---

## 2. style-catalog.ts 契约变更

### 2.1 新增导出

```ts
// 归一匹配 FORMS，命中返回目录规范形态名，否则 undefined
export function matchForm(input: unknown): (typeof FORMS)[number] | undefined

// 归一匹配 STYLE_CATALOG.name，命中返回该目录项，否则 undefined
export function matchStyle(input: unknown): CatalogEntry | undefined

// 浅拷贝输入，form/mainStyle/auxiliaryStyle 经 match* 命中时回写规范名；
// 未命中或缺失的字段保持原值（供校验报错引用原文）；其余字段原样保留
export function canonicalizeVisualStyle<T extends Record<string, unknown>>(v: T): T
```

### 2.2 `validateVisualStyle` 语义变更（K8）

签名不变：`validateVisualStyle(v): { ok: true } | { ok: false; reason: string }`。匹配规则由等值改为归一比对（内部经 `matchForm`/`matchStyle`），判定分支与原因文案：

| 条件 | reason（精确文案契约） |
| :-- | :-- |
| form 缺失（非字符串或归一后为空） | `形态未输出（必填字段：form 须逐字取 4 形态之一：仿真人 / 2D 漫 / 3D 漫 / 沙雕漫）` |
| form 有值未命中 | `形态「原文」不在谱系目录（4 形态：仿真人 / 2D 漫 / 3D 漫 / 沙雕漫）`（同现状） |
| mainStyle 缺失 | `主画风未输出（必填字段：mainStyle 须逐字取目录画风名；主档：<11 主名顿号分隔>；备档：<7 备名顿号分隔>）` |
| mainStyle 未命中 | `主画风「原文」不在谱系目录（18 画风；主档：<11 主>；备档：<7 备>）` |
| auxiliaryStyle 有值未命中 | `辅助画风「原文」不在谱系目录（备档可选：<7 备名顿号分隔>）` |
| auxiliaryStyle 命中但 tier≠备 | `辅助画风「原文」不是「备」档（仅备档可作辅助；备档：<7 备>）` |
| anchorWords 空 | `锚点词为空`（不变） |
| qualityRecipe 空 | `质感配方为空`（不变） |

约束：

- 名单由 `STYLE_CATALOG` / `FORMS` 动态生成，禁止硬编码名单字面量（谱系升级时自动跟随）。
- 缺失判定先于匹配判定；「原文」指模型输出原值（未经归一），保证错误可追溯。
- family / feasibility / l2Anchor / l1World 不参与校验（现状不变）。

### 2.3 `assertInCatalog` 变更

- 内部仍调 `validateVisualStyle`；错误码 `STYLE_NOT_IN_CATALOG` 与前缀 `视觉风格不在谱系目录（${CATALOG_VERSION}）：` 不变；变化仅为 reason 文本（§2.2）。

---

## 3. tools.ts 接线契约（visual_style 工具）

[tools.ts L173–178](../../../electron/mcp/tools.ts#L173-L178) 目标形态：

```ts
const parsed = parseVisualStyle(raw)
const canonical = canonicalizeVisualStyle(parsed)
assertInCatalog(canonical)
return ok('visual_style', canonical, 'ark', startedAt)
```

约束：

- `canonicalizeVisualStyle` 必须在 `assertInCatalog` **之前**调用，确保投递产物携带规范名。
- mock 降级路径（`mockVisualStyle`）、`STYLE_NOT_IN_CATALOG` → `failed()` 分支不变。
- 其余 7 个业务工具零改动。

---

## 4. prompts.ts 契约（C1，VISUAL_SYSTEM 只增不改）

[VISUAL_SYSTEM](../../../electron/prompts.ts#L54-L79) 追加以下约束（位置：选型规则 1–5 之后，措辞可微调但三要素必须齐备）：

1. **必填强调**：`form / mainStyle / family / feasibility / anchorWords / qualityRecipe / rationale / fiveElements` 必须全部输出且非空，缺任一字段视为无效输出（auxiliaryStyle 规则不变）。
2. **错例对照**：`❌2D漫 ✅2D 漫`；`❌赛博朋克 ✅赛博·科幻`；`❌仿真人动漫 ✅拟真人·仿真人动漫`（间隔号/空格/括号须逐字照抄目录原文）。
3. **目录外诉求处理**：用户要求目录外风格时禁止自造新名，从目录中选最接近项，并在 rationale 披露「用户原要求 X，目录内最接近为 Y」。

既有语句（`谱系版本：…`、`禁止输出目录外的形态或画风`、`照抄目录`、规则 1–5、JSON 格式段、18 项 CATALOG_BLOCKS 注入）**逐字保留**，不得改写或删除。

---

## 5. 既有契约与测试的反向同步（铁律 3）

| 对象 | 现有内容 | 变更 |
| :-- | :-- | :-- |
| feature-005 契约 L311 | `validateVisualStyle` 语义描述「mainStyle ∈ 18 项名称」等值语义 | 行尾加修订标注：`（2026-10-07 起经 feature-014 修订为归一比对，见 feature-014 契约 §2.2）` |
| feature-005 契约 L313 | 校验路径描述 | 同上标注 |
| feature-012 需求规格 L66 | 「不改 validateVisualStyle / assertInCatalog 校验规则」边界 | 行尾加标注：`（该边界由 feature-014 经用户签字解除，2026-10-07）` |
| [style-catalog.test.ts](../../../src/test/style-catalog.test.ts) 既有 8 用例 | 含 `拟真人·仿真人动漫` 作形态误值、`赛璐璐上色动画`/`水彩绘本` 目录外拒绝等 | **全部保留**（归一后仍不命中，断言不受影响），另新增用例只增不减 |
| [revise-text.test.ts L80–103](../../../src/test/revise-text.test.ts#L80-L103) | system 段断言（含 `照抄目录`、`（主 ·`×11、`（备 ·`×7 等计数） | **全部保留**，新增 C1 追加内容断言 |

---

## 6. 异常规则汇总

1. 非字符串输入进 match/normalize：返回不命中/`''`，不抛错。
2. `canonicalizeVisualStyle` 输入缺字段：缺失字段原样缺席，由 validate 报「未输出」。
3. 归一后空串（如纯空白输入）：按缺失处理。
4. 同轮多字段皆错：`validateVisualStyle` 维持单原因返回（form → mainStyle → auxiliaryStyle → anchorWords → qualityRecipe 顺序，现状不变）。
5. 名单生成时若谱系未来升级导致归一碰撞：零碰撞测试率先变红，阻断合入（设计意图）。
6. 任何实现不得增删/改名契约导出；冲突按 L1/L2/L3 处理。

---

## 7. 验收映射

见任务清单 AC 表（AC-1 ~ AC-8 与需求规格 §5 对齐）。
