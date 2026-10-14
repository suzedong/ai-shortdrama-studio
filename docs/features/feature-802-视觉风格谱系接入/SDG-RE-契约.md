# feature-802 视觉风格谱系接入 · 接口与数据契约

> 配套文件：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)（背景 / 场景 / 范围 / 验收）。本文件固化**模块形状、函数签名、入参、返回、错误码、测试约束**，是编码的直接依据。
>
> 事实源：设计书 §2.6.4（L195–215）、§7.1（L594–596）、§8.3（L613–627）；数据源 [AI短剧制作视觉风格谱系.md](../../../resources/H3-Style/AI短剧制作视觉风格谱系.md) v1.46。
>
> **K1：无**。本包所有类型仅在 `electron/` 侧声明与消费，[shared/types.ts](../../../shared/types.ts) 零改动（BriefStyle / BriefPlan / BriefMissingCode 均不动）。
>
> **K8：有**。新增 3 个 MCP 工具（16 → 19），provider 白名单 +3，须经卡口批准。

## 1. electron 侧类型（新增于 `electron/style/types.ts`，不进 shared）

```ts
// 家族代码（J.1 五家族）
export type StyleFamilyCode = 'A' | 'B' | 'C' | 'D' | 'E'

// 验证状态轴：主 = 已项目验证；备 = 已入谱未验证（均可作主风格，备风险自担）
export type StyleRole = 'main' | 'backup'

// 可行度（J.0 图例三档；v1.46 实际仅出现 high/medium）
export type StyleFeasibility = 'high' | 'medium' | 'low'

// ID 注册表条目（代码固化，§2）
export interface RegisteredStyleEntry {
  id: string                    // 'A1' … 'E1'，18 个
  name: string                  // J.2 表内名称（去掉「主」「备」标注后的逐字名称）
  familyCode: StyleFamilyCode
  familyLabel: string           // 如 '写实影像系'
  role: StyleRole
  feasibility: StyleFeasibility
  auxiliaryCandidate: boolean   // 仅 B1 + D1/D2/D3/D4/D5 为 true
}

// md 解析条目（J.2 单行，无 ID）
export interface ParsedStyleEntry {
  name: string                  // 去标注名称
  familyCode: StyleFamilyCode   // 由所在五张表判定
  role: StyleRole               // 「主」/「备」标注
  visualTraits: string          // J.2「视觉特征」列原文
  anchorWords: string           // J.2「锚点词示例」列原文
  textureRecipe: string         // J.2「质感配方」列原文
  feasibility: StyleFeasibility // J.2「可行度」列：●高→high / ●中→medium / ●低→low
}

// 装载成品（注册表 ⊙ md 解析，loader 缓存对象）
export interface LoadedStyleCatalog {
  version: string               // 从 md J.0 读出，如 'v1.46'；不硬编码
  sourcePath: string            // 实际读取的 md 绝对路径（错误消息/调试用）
  entries: Array<RegisteredStyleEntry & {
    visualTraits: string
    anchorWords: string
    textureRecipe: string
  }>
}

// 谱系类问题（evaluateDraft.styleIssues 与 style.validate 同形）
export type StyleIssueCode =
  | 'STYLE_ID_UNKNOWN'          // 引用 ID 不在 18 个注册 ID 内
  | 'STYLE_VERSION_MISMATCH'    // catalogVersion 与装载版本非逐字相等
  | 'STYLE_AUX_NOT_CANDIDATE'   // 辅助 ID 已知但不属 6 个封闭候选

export interface StyleIssue {
  code: StyleIssueCode
  field: string                 // 'style.mainStyleId' / 'style.catalogVersion' / 'style.auxiliaryStyleId'
  message: string               // 人读可操作原因
}
```

约束：

1. 18 个 ID 闭集：`A1 A2 A3 A4 A5 A7`（无 A6）、`B1`、`C1 C2 C5 C6 C7`（无 C3/C4）、`D1 D2 D3 D4 D5`、`E1`。
2. 辅助候选闭集 6 个：`B1`、`D1`、`D2`、`D3`、`D4`、`D5`。
3. 家族 5 个；计数 18 / 主 11 / 备 7 / 辅助 6（需求规格 §3，自检断言见 §9）。
4. 上述类型一律不 re-export 到 shared；renderer / preload 不可见。

## 2. ID 注册表（`electron/style/catalog.ts`，纯数据 + 纯函数）

固化需求规格 §3 全表 18 条。名称逐字采用 J.2 表内去标注名称：

| ID | name | familyCode | role | feasibility | auxiliaryCandidate |
|---|---|---|---|---|---|
| A1 | 数字电影写实 | A | main | high | false |
| A2 | 胶片电影感 | A | main | high | false |
| A3 | 年代胶片（千禧·90s·80s） | A | backup | high | false |
| A4 | DV·CCD 数码复古 | A | backup | high | false |
| A5 | 黑白电影 | A | backup | high | false |
| A7 | 拟真人·仿真人动漫 | A | main | high | false |
| B1 | 清新生活流 | B | main | high | **true** |
| C1 | 日式动漫 | C | main | high | false |
| C2 | 国漫·新中式插画 | C | main | high | false |
| C5 | 美式卡通 | C | backup | high | false |
| C6 | 扁平矢量·低多边形 | C | backup | high | false |
| C7 | 韩漫·精致美型 | C | main | high | false |
| D1 | 冷调悬疑 | D | main | high | **true** |
| D2 | 赛博·科幻 | D | main | high | **true** |
| D3 | 奇幻童话 | D | backup | high | **true** |
| D4 | 暗黑·哥特 | D | backup | high | **true** |
| D5 | 神话国风 | D | main | high | **true** |
| E1 | 3D CG | E | main | medium | false |

导出：

```ts
export const STYLE_REGISTRY: readonly RegisteredStyleEntry[]   // 18 条，顺序按上表
export const CATALOG_IDS: readonly string[]                    // 18 ID
export const AUXILIARY_CANDIDATE_IDS: readonly string[]         // 6 ID

export function isKnownStyleId(id: string): boolean
export function isAuxiliaryCandidate(id: string): boolean
export function getRegisteredEntry(id: string): RegisteredStyleEntry | undefined
```

注册表是「ID ↔ 名称 ↔ 家族 ↔ 主备」的唯一代码事实；版本号**不**在此固化。谱系升级（增删条目/改名）必须同时改本表与 md，并由 §9 漂移测试点名（D-013 裁决②：平台只消费不私改谱系数据）。

## 3. md 解析（`electron/style/parse-md.ts`，纯函数）

```ts
export function parseStyleCatalogMd(text: string): {
  version: string
  entries: ParsedStyleEntry[]   // 18 条，按 J.2 表出现顺序（A→B→C→D→E）
}
```

解析规则：

1. **版本**：在 J.0 段以正则 `/本文版本：谱系\s*(v\d+\.\d+)/` 提取（锚 L7 原文「本文版本：谱系 v1.46（…）」）；未命中 → 抛 `STYLE_CATALOG_PARSE_ERROR`。
2. **明细表定位**：在 `## J.2` 与 `## J.3` 之间，按 5 个家族粗体表头定位五张表，表头到家族代码的映射按前缀逐字匹配：
   - `**A 写实影像系` → A（6 行）、`**B 青春治愈系` → B（1 行）、`**C 动画插画系` → C（5 行）、`**D 类型氛围系` → D（5 行）、`**E 材质工艺系` → E（1 行）。
   - 任一家族表头缺失 → `STYLE_CATALOG_PARSE_ERROR`。
3. **表行解析**：表头行（`| 风格 | 视觉特征 | …`）与分隔行（`|---|`）跳过；数据行按 `|` 分列须恰为 5 个非空单元（首尾空栏不计），否则 `STYLE_CATALOG_PARSE_ERROR`（消息含行号/家族）。
4. **名称与主备**：第 1 列 trim 后必须以 `「主」` 或 `「备」` 结尾 → role 分别为 main/backup，去掉该尾标记得 name（如 `年代胶片（千禧·90s·80s）「备」` 无空格亦须命中，见 md L45 实况）；无标注 → `STYLE_CATALOG_PARSE_ERROR`。
5. **可行度**：第 5 列 `●高` / `●中` / `●低` → high/medium/low；其余 → `STYLE_CATALOG_PARSE_ERROR`。
6. 其余三列（视觉特征/锚点词示例/质感配方）trim 后原文保留，不做 markdown 清洗（含 `**`、中英文混排照常透传）。
7. 五表行数合计须为 18（6/1/5/5/1）；否则 `STYLE_CATALOG_PARSE_ERROR`。
8. **不读** J.1 总览表、J.4 参数表、html、预览目录；J.4 与预览文件名仅为本表人工核对依据。

解析错误以 `throw Object.assign(new Error(message), { code: 'STYLE_CATALOG_PARSE_ERROR' })` 形状抛出（与 tools.ts `normalize()` 读取 `.code` 的约定对接）。

## 4. 装载层（`electron/style/loader.ts`，路径解析 + 读盘 + 交叉核对 + 缓存）

```ts
export const STYLE_DIR_NAME = 'H3-Style'
export const STYLE_FILE_NAME = 'AI短剧制作视觉风格谱系.md'

export function resolveStyleCatalogPath(): Promise<string>
export function clearStyleCatalogCache(): void
export async function loadStyleCatalog(force = false): Promise<LoadedStyleCatalog>
```

1. **路径解析**（仿 [provider.ts](../../../electron/runtime/provider.ts) L153–177 模式，判据必须用 `app.isPackaged`，不用 `process.resourcesPath` 是否存在）：
   - 打包态：`path.join(process.resourcesPath, 'H3-Style', STYLE_FILE_NAME)`。
   - 开发态双候选：以 `import.meta.url` 所在 `electron/style/` 上溯两级（devRoot = `<root>`）与三级（builtRoot = `dist-electron` 上溯的 `<root>`），各拼 `resources/H3-Style/<file>`，依次 `fsp.access` 取首个存在者；都不存在返回候选 1，交由读盘抛 ENOENT。
2. **读盘**：读不到（ENOENT 等）→ 抛 `STYLE_CATALOG_MISSING`（消息含尝试路径）。
3. **解析 + 交叉核对**：`parseStyleCatalogMd` 成功后，与 `STYLE_REGISTRY` 逐条核对：
   - 按家族比对名称集合：每个家族注册表名称集合须与 md 解析名称集合**逐字相等**；
   - 每个名称的 role（主/备）注册表与 md 标注一致；
   - 每个名称的 feasibility 注册表与 md 标记一致。
   - 任一不符 → 抛 `STYLE_CATALOG_DRIFT`，消息须列出差异类别与涉及 ID/名称（如 `注册表缺失: …; md 多余: …; 主备不符: A3 …`），不静默、不部分装载。
4. **合并产出**：以注册表条目为骨架（id/name/family/role/feasibility/auxiliaryCandidate），按 `familyCode + name` 关联解析行补 visualTraits/anchorWords/textureRecipe；18 条齐全才返回。
5. **缓存**：模块级 `cached: LoadedStyleCatalog | null`；`loadStyleCatalog()` 命中即返回不读盘，`force=true` 与 `clearStyleCatalogCache()` 强制重载。装载失败不写缓存（下次调用重试）。
6. 版本取自解析结果（`catalog.version`），代码任何位置不硬编码 `'v1.46'`。

## 5. 校验纯函数与 evaluateDraft 注入（`electron/style/validate.ts` + [plan.ts](../../../electron/brief/plan.ts)）

### 5.1 validate.ts

```ts
export function validateStyleRefs(
  ids: { mainStyleId?: string; catalogVersion?: string; auxiliaryStyleId?: string },
  catalog: LoadedStyleCatalog,
): StyleIssue[]
```

规则（只校验**已给且非空白**的字段；空/缺省不产 issue——非空由既有 `MAIN_STYLE_MISSING` 负责）：

1. `mainStyleId` trim 后 `!isKnownStyleId` → `{code:'STYLE_ID_UNKNOWN', field:'style.mainStyleId', message:'主视觉风格 ID「X」不在谱系（当前 vX.YY，18 项），请先用 style.catalog 选型'}`。
2. `catalogVersion` trim 后与 `catalog.version` 非逐字相等 → `{code:'STYLE_VERSION_MISMATCH', field:'style.catalogVersion', message:'引用谱系版本「X」与注册版本「vX.YY」不一致，请按当前版本确认'}`。
3. `auxiliaryStyleId` trim 后：
   - 未知 → `STYLE_ID_UNKNOWN`（field `style.auxiliaryStyleId`）；
   - 已知但 `!isAuxiliaryCandidate` → `{code:'STYLE_AUX_NOT_CANDIDATE', field:'style.auxiliaryStyleId', message:'辅助风格「X」不在封闭候选域（仅 B1 清新生活流与 D1–D5 类型氛围系 6 项）'}`。
4. 主辅同 ID 不额外报错（需求规格 §3 规则 3）；「备」作主风格不报错。

### 5.2 evaluateDraft 签名变更（默认行为逐字不变，AC5）

```ts
export function evaluateDraft(
  draft: BriefDraft,
  catalog?: LoadedStyleCatalog,
): { missing: BriefMissing[]; pendingMarks: string[]; styleIssues: StyleIssue[] }
```

- 四类既有校验（KIND/ELEMENT/PREMISE/MAIN_STYLE_MISSING）与 pendingMarks 逻辑**一行不动**。
- 末尾：`styleIssues = catalog ? validateStyleRefs(draft.style ?? {}, catalog) : []`。
- 返回对象恒含 `styleIssues` 键；无注入时为 `[]`，函数不读盘、不 import loader。
- `planBrief(projectDir, draft)` 签名与返回（BriefPlan）**不变**、不装载谱系（保持 IO 边界与既有测试逐字一致）；谱系注入只发生在 MCP 工具层（§6.4）。

## 6. MCP 工具契约（注册于 [tools.ts](../../../electron/mcp/tools.ts)，16 → 19 个）

统一信封沿用 `{ ok:true, ... } | { ok:false, error:{code,message} }` 与 `respond()`；三个工具均**零 LLM、只读、不依赖激活项目**（谱系是全局资源，不读项目目录）。

### 6.1 `style.catalog`（17，无参）

- 入参：`{}`（zod 空对象）。
- 行为：`loadStyleCatalog()` → 返回全量。
- 返回：

```ts
{ ok: true,
  version: 'v1.46',
  count: 18,
  entries: Array<{
    id; name; familyCode; familyLabel; role; feasibility; auxiliaryCandidate;
    visualTraits; anchorWords; textureRecipe;
  }> }
```

- 错误：装载三码 `STYLE_CATALOG_MISSING` / `STYLE_CATALOG_PARSE_ERROR` / `STYLE_CATALOG_DRIFT`（错误信封，`isError:true`）。

### 6.2 `style.get`（18，按 ID 查单条）

- 入参：`{ id: z.string().min(1) }`（trim 后精确匹配，大小写不做自动纠正）。
- 返回：`{ ok:true, version, entry }`（entry 形状同 6.1 单条）。
- 错误：`STYLE_ID_UNKNOWN`（ID 不在 18 闭集；消息回显入参与当前版本）；装载三码。

### 6.3 `style.validate`（19，校验引用，不抛业务错）

- 入参（三者皆可选字符串）：`{ mainStyleId?: string; catalogVersion?: string; auxiliaryStyleId?: string }`。
- 行为：装载 catalog → `validateStyleRefs(args, catalog)`。
- 返回：

```ts
{ ok: true, valid: boolean, version: 'v1.46', issues: StyleIssue[] }
```

- 空/缺省字段不产 issue（故 `{}` → `valid:true`；非空由 brief.plan 的 missing 负责，两工具职责不混）。
- 错误：仅装载三码走错误信封；ID/版本/越域问题一律以 `issues[]` 正常返回（`ok:true, valid:false`）。

### 6.4 既有 brief.plan / brief.publish 工具联动（注入点）

- **brief.plan**：handler 内 `const catalog = await loadStyleCatalog()`，`evaluateDraft(draft, catalog)`；返回的内联 `plan` 对象在既有 6 键之外追加 `styleIssues: StyleIssue[]`，且 `ready = missing.length === 0 && styleIssues.length === 0`。BriefPlan 类型不动（plan 是 handler 内联字面量，新增键无 K1）。装载失败 → 直接返回装载三码错误信封（R6：谱系资产异常显式阻断，不降级为旧行为）。
- **brief.publish**：handler 同样装载并注入；判定改为 `missing.length + styleIssues.length` 任一非空 → 维持既有错误码 `BRIEF_NOT_READY`，消息拼接全部 missing 与 styleIssues 的 message（不新增 publish 错误码；Agent 侧处理路径不变）。装载失败 → 装载三码错误信封，不写盘。
- tools.ts 文件头注释「16 个」改「19 个」，工具序列注释追加 `17–19 style.*`。

## 7. provider 白名单与 showrunner 纪律

1. [provider.ts](../../../electron/runtime/provider.ts) `SHOWRUNNER_DECLARED_TOOLS` 追加三行（11 → 14 物理 ID），注释计数同步：

```ts
'shortdrama_style.catalog',
'shortdrama_style.get',
'shortdrama_style.validate',
```

仅 showrunner profile 放行；writer / media-director / comfyui-operator 不追加（showrunner 按物理 ID 白名单逐工具判定，三工具均在白名单内）。

2. [showrunner.md](../../../resources/opencode/agents/showrunner.md) 第 0 步：
   - 第 5 点（风格只引用谱系 ID）：把纪律口号落地为动作——选型前先调 `shortdrama_style.catalog`（全量）或 `shortdrama_style.get`（按题材预选 ID 取明细），基于返回条目向用户展示主/备、可行度、辅助候选，确认 `ID @ version` 逐字采用返回版本，不得凭印象自造 ID；需要气氛时辅助只能从 6 个封闭候选中选。
   - 第 6 点（brief.plan 就绪自检）：`ready:false` 时除既有 missing 外，`styleIssues[]` 每条都必须按 message 追问/纠正后重跑；谱系装载错误（`STYLE_CATALOG_*`）须向用户报告资产异常，不得绕过。
   - frontmatter/permission 块若以枚举列工具（801 同款），追加三个 `shortdrama_style.*: true`（实施时按文件实况，无枚举块则只改正文）。

## 8. 错误码全表

| code | 层 | 触发 | 形态 |
|---|---|---|---|
| `STYLE_CATALOG_MISSING` | loader | md 在注册路径读不到 | 工具错误信封 |
| `STYLE_CATALOG_PARSE_ERROR` | parse-md | 版本缺失 / 五表缺失 / 行列非法 / 计数 ≠18 | 工具错误信封 |
| `STYLE_CATALOG_DRIFT` | loader | 注册表与 md 名称集合/主备/可行度对不上 | 工具错误信封（含差异明细） |
| `STYLE_ID_UNKNOWN` | validate / style.get | ID 不在 18 闭集 | get：错误信封；validate/plan：issue |
| `STYLE_VERSION_MISMATCH` | validate | catalogVersion ≠ 装载版本 | issue |
| `STYLE_AUX_NOT_CANDIDATE` | validate | 辅助 ID 已知但不属封闭域 6 项 | issue |
| `BRIEF_NOT_READY` | brief.publish（既有） | missing 或 styleIssues 非空（消息合并） | 工具错误信封 |

错误码字符串在 electron 侧定义（validate.ts 联合类型 + loader 抛错处），不进 shared。

## 9. 测试契约

新增测试文件：

- `src/test/style-catalog.test.ts`（纯函数 + 真实资产）：
  - 注册表计数：18 条、ID 闭集逐字相等、主 11 / 备 7 / 辅助 6 / 家族 5；每个 auxiliaryCandidate=true 的恰为 B1/D1–D5；A6/C3/C4 不存在。
  - `isKnownStyleId` / `isAuxiliaryCandidate` / `getRegisteredEntry` 正反例。
  - 解析真实 `resources/H3-Style/AI短剧制作视觉风格谱系.md`：版本为 `v1.46`（以文件实况断言，升级时此断言点名改两处）；18 条；A3 无空格尾标命中；E1 feasibility=medium，其余 high；抽查锚点词/质感配方非空。
  - 构造 md：缺版本行、缺某家族表头、坏行（列数不符）、未知可行度标记、行数 ≠18 → 均抛 `STYLE_CATALOG_PARSE_ERROR`。
  - 交叉核对：构造与注册表名称/主备/可行度不一致的解析结果（可对 loader 内部核对逻辑以注入文本方式触发）→ `STYLE_CATALOG_DRIFT` 且消息含差异 ID。
  - loader：开发态路径命中真实文件并返回 18 条；二次调用命中缓存（spy fsp.readFile 次数）；`clearStyleCatalogCache`/`force` 后重读；指向缺失路径 → `STYLE_CATALOG_MISSING`。
- `src/test/mcp-style-tools.test.ts`（fake server 注册，同 mcp-brief-tools 夹具模式）：
  - style.catalog：信封 `ok/version/count/entries`，条目字段齐全。
  - style.get：A7 命中（name=拟真人·仿真人动漫、auxiliaryCandidate=false）；ZZ9 → `STYLE_ID_UNKNOWN`。
  - style.validate：A7@当前版本 valid:true；v1.45 → STYLE_VERSION_MISMATCH；ZZ9 → STYLE_ID_UNKNOWN；辅助 A1 → STYLE_AUX_NOT_CANDIDATE；辅助 D1 → 通过；空参 → valid:true。
  - brief.plan 注入联动（也可追加到 mcp-brief-tools）：`A7@v1.46` 草案 ready:true 且 styleIssues=[]（既有夹具零变化）；`ZZ9@v1.46` → ready:false、styleIssues 含 STYLE_ID_UNKNOWN；错版本 / 辅助越域各一例。
- `src/test/brief.test.ts` 追加（纯函数层）：注入构造 catalog 后未知 ID/错版本/辅助越域产出 styleIssues；**既有全部断言逐字不动**（无注入调用返回新增键但不参与既有 toEqual）。
- 编排/静态：provider 白名单数组含三个 `shortdrama_style.*` 物理 ID（参照 801 既有白名单断言文件，实施时定位）；全仓 grep 确认 shared/types.ts 零改动、无 electron/style 之外模块直连谱系 md。

回归红线（AC9）：`npm run typecheck`、`npx tsc -b tsconfig.node.json`、`npx tsc -p tsconfig.preload.json` 不新增错误；全量测试失败数不扩大（基线 264 passed / 7 skipped / 12 failed，2026-10-13）。

## 10. 路径与命名约定

| 项 | 约定 |
|---|---|
| 模块目录 | `electron/style/`（types.ts / catalog.ts / parse-md.ts / loader.ts / validate.ts） |
| 资产路径 | `resources/H3-Style/AI短剧制作视觉风格谱系.md`（开发态仓库 / 打包态 process.resourcesPath） |
| 工具命名 | `style.catalog` / `style.get` / `style.validate`（点号族；物理键 `shortdrama_style.*`） |
| 缓存 | 进程内模块级单例；force/clear 仅测试与未来手动刷新用 |
| 不触碰 | shared/types.ts、立项单写盘形状、html、_style_preview 媒体、renderer、提示词链 |

## 11. 非目标（与需求规格 §4.2 一致，契约层再确认）

不做谱系写回路/版本差异 UI/旧项目升级、renderer UI 与 IPC、html 解析与预览媒体读取、提示词 Base 组装与 ComfyUI 接入（留 301/803）、外部注册路径可配置、publish 写盘内联明细；不修正 md「备画风不入墙」与备画风 PNG 实存的表述出入（交叉核对只认 ID↔名称↔主备↔可行度，不据此报漂移）。

## 12. 对既有包契约的联动说明

- feature-001 契约中 plan.ts「style 只做非空校验（B-05）」的表述在本包落地后被**代码行为**取代（注入路径新增 styleIssues），但纯函数默认行为与 BriefPlan/BriefMissingCode 形状不变；属行为增补而非契约破坏，在本包变更记录与 feature-001 变更记录修订区交叉记指针，不回改 feature-001 文档原句。
- 设计书 §7.1 L596 / §8.3 L627「当前实现 `electron/style-catalog.ts`」在本包落地后成为真实能力，但实际路径是 `electron/style/` 五文件而非单文件；不逆行改设计书措辞，差异在变更记录列明（AC10）。

## 13. 验收映射

| AC | 契约落点 |
|---|---|
| AC1 | §2 注册表 + §4 合并 + §6.1 返回 + §9 计数断言 |
| AC2 | §6.2 + §9 get 正反例 |
| AC3 | §5.1 规则 1–3 + §6.3 + §9 validate 分支 |
| AC4 | §6.4 brief.plan 注入、ready 联动 + §9 |
| AC5 | §5.2 默认不变、planBrief 不动 + §9 既有断言不动 |
| AC6 | §3/§4 三码 + §9 构造异常用例 |
| AC7 | §4 交叉核对 + §9 真实 v1.46 用例与计数断言 |
| AC8 | §7 白名单与 showrunner 两处动作 |
| AC9 | §9 回归红线 |
| AC10 | §6 工具数 19、头注释；§12 设计书表述差异留痕 |
