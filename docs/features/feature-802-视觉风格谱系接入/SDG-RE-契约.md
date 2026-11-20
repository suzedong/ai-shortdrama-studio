# feature-802 视觉风格谱系接入 · 接口与数据契约

> 配套文件：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)（背景 / 场景 / 范围 / 验收）。本文件固化**模块形状、函数签名、入参、返回、错误码、测试约束**，是编码的直接依据。
>
> 事实源：设计书 §2.6.4（L195–215）、§7.1（L594–596）、§8.3（L613–627）；数据源 [AI短剧制作视觉风格谱系.md](../../../resources/H3-Style/AI短剧制作视觉风格谱系.md)（现行示例 v1.47，运行时以 md 实际版本为准）。
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

// 可行度（J.0 图例三档；v1.47 实际仅出现 high/medium）
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
  version: string               // 从 md J.0 读出，如 'v1.47'；不硬编码
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

1. **版本**：在 J.0 段以正则 `/本文版本：谱系\s*(v\d+\.\d+)/` 提取（现行 L7 示例「本文版本：谱系 v1.47（…）」）；未命中 → 抛 `STYLE_CATALOG_PARSE_ERROR`。
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
6. 版本取自解析结果（`catalog.version`），代码任何位置不硬编码 `'v1.47'` 或其他具体版本。

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
  version: 'v1.47',
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
{ ok: true, valid: boolean, version: 'v1.47', issues: StyleIssue[] }
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
  - 解析真实 `resources/H3-Style/AI短剧制作视觉风格谱系.md`：版本以文件实况断言（现行示例 `v1.47`，升级时同步校准测试与注册表）；18 条；A3 无空格尾标命中；E1 feasibility=medium，其余 high；抽查锚点词/质感配方非空。
  - 构造 md：缺版本行、缺某家族表头、坏行（列数不符）、未知可行度标记、行数 ≠18 → 均抛 `STYLE_CATALOG_PARSE_ERROR`。
  - 交叉核对：构造与注册表名称/主备/可行度不一致的解析结果（可对 loader 内部核对逻辑以注入文本方式触发）→ `STYLE_CATALOG_DRIFT` 且消息含差异 ID。
  - loader：开发态路径命中真实文件并返回 18 条；二次调用命中缓存（spy fsp.readFile 次数）；`clearStyleCatalogCache`/`force` 后重读；指向缺失路径 → `STYLE_CATALOG_MISSING`。
- `src/test/mcp-style-tools.test.ts`（fake server 注册，同 mcp-brief-tools 夹具模式）：
  - style.catalog：信封 `ok/version/count/entries`，条目字段齐全。
  - style.get：A7 命中（name=拟真人·仿真人动漫、auxiliaryCandidate=false）；ZZ9 → `STYLE_ID_UNKNOWN`。
  - style.validate：A7@当前版本 valid:true；v1.45 → STYLE_VERSION_MISMATCH；ZZ9 → STYLE_ID_UNKNOWN；辅助 A1 → STYLE_AUX_NOT_CANDIDATE；辅助 D1 → 通过；空参 → valid:true。
  - brief.plan 注入联动（也可追加到 mcp-brief-tools）的现行示例：`A7@v1.47` 草案 ready:true 且 styleIssues=[]；`ZZ9@v1.47` → ready:false、styleIssues 含 STYLE_ID_UNKNOWN；错版本 / 辅助越域各一例。首次实施的 v1.46 夹具与结果属历史证据，本次仅校准文档示例，不改写、不重跑。
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
| AC7 | §4 交叉核对 + §9 真实当前版本用例与计数断言 |
| AC8 | §7 白名单与 showrunner 两处动作 |
| AC9 | §9 回归红线 |
| AC10 | §6 工具数 19、头注释；§12 设计书表述差异留痕 |

## 14. D-037 现行归并约束（2026-11-19）

本节汇总归档包 810 / 811 / 815 已存在的现行契约，统一由 802 维护；不是新增 K1/K8/K9 授权。与 §11 的旧排除冲突时，仅本节列明的升级、真实 Store / 谱系面板和预览媒体能力优先，其余非目标不变。

### 14.1 当前目录与全量 Store

当前 md 示例版本为 `v1.47`，条目数仍为 18；版本运行时从 J.0 提取。前文章节中的 v1.46 实施背景和历史断言不得解释为永久版本锁。

既有 `style:catalog` IPC 无入参，返回 `{ version, count, entries }`，与 MCP `style.catalog` 共用 `loadStyleCatalog()`；entries 复用十键 `StyleCatalogEntryDto`，不为面板扩字段。

```ts
interface StyleCatalogState {
  status: 'idle' | 'loading' | 'ok' | 'failed' | 'unavailable'
  version: string | null
  entries: StyleCatalogEntryDto[]
}

function ensureStyleCatalog(force?: boolean): void
function useStyleCatalog(): StyleCatalogState
function getStyleEntry(id: string): StyleCatalogEntryDto | null
function getStyleName(id: string): string
```

Store 位于 `src/studio/style-catalog-store.ts`：loading 单 flight；仅 force 或 idle / failed 真发 IPC；ok / unavailable 下普通 ensure 不覆盖快照；同步查询不触发拉取；无 `window.api.styleCatalog` 为 unavailable，reject 为 failed。VisualCatalog / ChatComposer / Stage0View / StudioViewer 全部消费该快照，dev-mock 自具同 DTO 的 18 条演示数据。沿用既有 testid，不新增跨进程类型、推送或监听。

### 14.2 升级差异 DTO

```ts
interface StyleUpgradeRefEntry {
  id: string
  role: 'main' | 'auxiliary'
  removed: boolean
  current?: {
    role: 'main' | 'backup'
    auxiliaryCandidate: boolean
    feasibility: 'high' | 'medium' | 'low'
    anchorWords: string[]
  }
}

interface StyleChangelogEntry {
  version: string
  date?: string
  items: string[]
}

interface StyleUpgradeDiff {
  hasUpgrade: boolean
  registeredVersion?: string
  currentVersion: string
  referenced: StyleUpgradeRefEntry[]
  blocking: boolean
  changelog: StyleChangelogEntry[]
  changelogUnavailable: boolean
}
```

版本只做逐字相等比较，`catalogVersion !== 当前 version` 即 hasUpgrade；旧版内容不可得，不伪造逐字段旧值→新值。`removed:true` 令 blocking。未立项 / 无 style 返回 `{ hasUpgrade:false, currentVersion, referenced:[], blocking:false, changelog:[], changelogUnavailable:false, noBrief:true }` 空态。

J.3 使用 `## J.3 谱系变更记录` 至下一二级标题；`### vX.Y（可选日期）` 分节，`- ` 为条目，按 `(registered, current]` 过滤。J.3 缺失 / 解析失败仅置 `changelogUnavailable:true`，不影响目录 loader。

### 14.3 升级通道与采纳写权

| 通道 | 现行职责 |
|---|---|
| `style:catalog` | 无入参；返回真实全量目录与版本 |
| `style:upgrade-diff` | 无入参；读取当前激活项目 Brief，返回 §14.2 DTO |
| `brief:update` | 既有 style 白名单允许 `mainStyleId / auxiliaryStyleId / catalogVersion`；本升级流程只写 `catalogVersion` |

采纳前面板重取 `style:catalog`，其 version 与差异快照 currentVersion 不同则拒绝旧快照并要求刷新。可用时 `updateBrief({style:{catalogVersion: currentVersion}})`，沿用 updateBriefFields 恒 mark、立项单版本 +1 和 diff 追溯；blocking / noBrief 禁用，忽略只关闭面板。不得借升级修改主辅 ID、重出提示词、重生成媒体或新增忽略持久化。

### 14.4 预览元数据 IPC 与 DTO

沿用恰一个 `style:preview-metadata` IPC；renderer 只传白名单标识，不传路径：

```ts
type StylePreviewMetadataRequest =
  | { styleId: string; mediaKind: 'image' }
  | { styleId: string; mediaKind: 'video'; tier: 'std' | 'turbo' | 'fast' }

type StylePreviewMetadataStatus =
  | 'ok' | 'missing' | 'no-metadata' | 'unsupported' | 'invalid'

interface StylePreviewPromptDto {
  key: 'positive' | 'negative' | 'motion'
  label: string
  text: string
}

interface StylePreviewParameterDto {
  key: string
  label: string
  value: string | number
}

interface StylePreviewMetadataDto {
  request: StylePreviewMetadataRequest
  status: StylePreviewMetadataStatus
  prompts: StylePreviewPromptDto[]
  params: StylePreviewParameterDto[]
  message?: string
}
```

`ok` 只表示容器和内嵌 JSON 有效且为可识别 API graph，prompts / params 可以为空数组；`missing` 为文件不存在，`no-metadata` 为无 prompt，`unsupported` 为 UI Format / 非受支持 graph，`invalid` 为坏档、超限或安全校验失败。可预期错误均返 DTO，不抛原始 fs / parser 异常，不泄漏路径、graph 或堆栈。

### 14.5 二进制解析、UI 与安全不变量

1. 媒体根为谱系 md 同目录 `_style_preview`；只允许注册家族封闭目录、固定文件名与 `MEDIA_STEM` 映射。resolve 与 realpath 均须 containment，只读常规 `.png / .mp4`。
2. PNG 验签名并顺序解析 chunk，只收集 keyword 精确为 prompt 的合法 tEXt；MP4 解析 32 / 64 位 box，沿 `moov → udta → meta → keys/ilst` 匹配 mdta.prompt，禁止全文件搜索字符串。
3. graph 为节点字典，按 class_type / inputs 与连接识别，不硬编码某画风节点 ID；只求确定 primitive / 连接，不执行表达式或节点、不读取 graph 引用文件。数字 finite，模型 / 首帧仅 basename，缺字段不补默认值。
4. 每媒体 UI 状态 `idle | loading | ready | error`，ready 保留 DTO 五态；请求序号加 styleId / mediaKind / tier 双重防 stale，卸载忽略结果。切档只重置视频，切风格才重置两类，单媒体失败不清空另一媒体。
5. 主进程异步句柄 finally 关闭，限制文件 / 元数据大小和 box / chunk 长度；renderer 零 fs、零路径、零 ComfyUI 直连。只读操作零项目写入、零目录 DTO 变化。

### 14.6 契约冲突与证据边界

- §9 是首次实施的测试契约；本节对当前版本示例的校准不是测试重跑记录。历史任务、变更记录、PASS/FAIL 与计数原样保留。
- 本归并不改变 MCP 工具总数、showrunner 授权、共享类型、依赖或生成通道，不新增媒体生成、预览重生成、HTML 解析和全局 brief 写接口。

## 15. 谱系版本、changelog 与负向业务约束

本节接收 826 的谱系业务语义，是 §2—§6 与 §14.2—§14.3 的现行补充；不新增函数、IPC、MCP 工具或 DTO。

### 15.1 当前版本注册与真实 changelog

- `LoadedStyleCatalog.version` 始终来自当前正式 md 的 J.0。当前合法引用的 `catalogVersion` 必须与该运行时版本逐字相等，不能固定为历史 v1.46 或当前示例 v1.47；loader 仍须完成注册表与 md 条目、名称、主备、可行度的 DRIFT 交叉核对。
- 当前真实 `## J.3 谱系变更记录` 同时含 `### v1.47` 与 `### v1.46` 两节。`StyleChangelogEntry[]` 按资源中的真实版本节、条目和顺序形成，不以合成区间文本替换真实 changelog，也不删除历史节。
- 后续换版只改变当前事实源及其合法引用基线；历史 v1.45→v1.46 的 diff / decision / mark 采纳语义与故意错版数据不因当前版本变化而改写。

### 15.2 区间过滤与不可用降级

`style:upgrade-diff` 的 changelog 筛选契约补充如下：

1. 两端可解析时采用 **`(fromVersion,toVersion]`**：排除起点、包含终点，位于其间的版本节按序返回。
2. 任一端点不可解析时，不执行不可靠的区间裁剪，保留全部相关 changelog 记录，做到“宁多勿缺”；不得返回伪造空数组冒充“无变更”。
3. `hasUpgrade` 仍只由引用版本与当前版本逐字不等决定，与 changelog 端点是否可解析无关。
4. J.3 缺失、空段、读取失败或解析失败时，`changelogUnavailable:true`，目录快照及引用现况仍可使用；不得升级为 `STYLE_CATALOG_PARSE_ERROR` 或 DRIFT。
5. 独立合成升级输入应明确两个不同版本节及 J.3 边界，以验证上述区间和降级行为，不复制真实当前版本节。该输入的测试数据治理不属于本契约新增写权。

### 15.3 校验与采纳严格性

| 业务输入 | 必须保持的结果 |
| --- | --- |
| 当前合法主 / 备引用及合法辅助候选 | 通过谱系校验，下游发布、Harness、影响评估或门继续执行各自规则 |
| 故意错误 `catalogVersion` | `STYLE_VERSION_MISMATCH`，不因当前版本升级而消失 |
| 未知主 / 辅 ID | `STYLE_ID_UNKNOWN`；`style.get` 与 validate / plan 的既有返回形态不变 |
| 辅助候选越域 | `STYLE_AUX_NOT_CANDIDATE` |
| 非法画幅、门 / Harness 草案谱系版本失配 | 沿原业务错误路径拒绝，错误码与防护不放宽 |
| 引用条目 `removed` 或项目 `noBrief` | 阻断采纳，不写 `catalogVersion` |
| 可采纳升级 | 采纳前重取目录核版，只经 `brief:update` 写 `style.catalogVersion` |

版本注册、真实 changelog、升级与采纳不得只保留其中一部分。历史固定区间继续表达原业务场景，不机械替换为当前版本。

### 15.4 职责边界

830 负责通用测试门禁、测试数据分类、dev-mock 证据原则和临时目录规则；画幅、Harness、发布、影响评估、门态、幂等、零写盘、故障注入及补偿由各业务 Feature 负责。802 只保证其谱系引用与版本语义不在这些链路中被削弱，不承接 Vitest / typecheck / build 门禁或其他业务实现。本次仅归并文档，不授予新的代码或测试写权。
