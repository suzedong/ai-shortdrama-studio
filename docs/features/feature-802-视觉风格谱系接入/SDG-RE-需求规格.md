# feature-802 视觉风格谱系接入 · 需求规格

> 任务包性质：**设计书已写「当前实现」但代码零落地的重建包**（D-013 裁决②：取重建方案，平台只消费不私改谱系）。
>
> 事实源：[短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §2.6.4（L195–215，双维度 / 三轴 / 辅助候选域封闭）、§7.1「视觉风格谱系」（L594–596）、§8.3（L613–627，系统级外部数据源全部约定）。
>
> 数据源：[AI短剧制作视觉风格谱系.md](../../../resources/H3-Style/AI短剧制作视觉风格谱系.md)（谱系 v1.46，2026-10-08；md 唯一数据源，html 为派生镜像不读）。
>
> 解决偏差：[设计现状与偏差清单.md](../../设计现状与偏差清单.md) **B-05**（设计书引用不存在的 `electron/style-catalog.ts`；谱系 ID 无校验，Agent 可凭印象写入任意画风 ID）。
>
> 溯源标签：**[自研新增]**（谱系数据是外部资产；平台侧装载/校验/工具链为自研）。

## 1. 背景

设计书两处把 `electron/style-catalog.ts` 写作「当前实现」：

- §7.1 L596：「当前实现 `electron/style-catalog.ts` 固化谱系（`CATALOG_VERSION` + `assertInCatalog` 校验，失败即拒），与 §8.3 机制并存。辅助风格仅允许 B/D 候选域（§2.6.4）。」
- §8.3 L627：同义重申。

磁盘实况（2026-10-13 盘点）：

- **零实现**：`electron/` 全目录无 style-catalog.ts；无任何模块装载或解析谱系。
- **零校验**：[plan.ts](../../../electron/brief/plan.ts) L37/L67-69 对 `style.mainStyleId` / `catalogVersion` 只做非空校验（注释明示「不校验谱系 ID 存在性（B-05）」），`auxiliaryStyleId` 连非空约束都没有；任何字符串（如 `'ZZ9'`）都能通过就绪判定并 publish。
- **零查阅**：16 个 MCP 工具中无谱系工具；showrunner 立项第 5 步被要求「主风格必须取自谱系」，但 Agent 运行时没有任何工具可读取谱系内容，只能靠上下文/印象——与 §2.6.4「Agent 不得凭印象自创画风」直接冲突。
- **数据已在仓**：`resources/H3-Style/AI短剧制作视觉风格谱系.md`（v1.46，18 画风）+ html 镜像 + `_style_preview/` 预览墙（11 个「主」画风 PNG/三档视频，备画风不入墙）。
- **类型已就绪**：`BriefStyle { mainStyleId; catalogVersion; auxiliaryStyleId? }` 已在 [shared/types.ts](../../../shared/types.ts) L87-92 落地（feature-001），本包**无 K1**。

谱系 md 的结构事实（解析依据，见 §4）：

- 版本：J.0 正文「本文版本：谱系 **v1.46**（2026-10-08 …）」。
- J.1 总览：4 形态 × 18 画风表 + 家族表，名称带「主」「备」标注。
- J.2 明细表：5 张家族表（A/B/C/D/E），列 = 风格名（含「主」「备」）/ 视觉特征 / 锚点词示例 / 质感配方 / 可行度；**表内无 ID 列**。
- J.4 参数表与 `_style_preview/` 文件名是 ID 的唯一出处：`A1 A2 A3 A4 A5 A7`、`B1`、`C1 C2 C5 C6 C7`、`D1 D2 D3 D4 D5`、`E1`，共 18 个。

## 2. 谁在什么场景下要做什么

| # | 角色 | 场景 | 要做什么 | 达成效果 |
|---|---|---|---|---|
| R1 | 主控 Agent（showrunner） | 立项第 5 步选风格前 | 调只读工具取得谱系版本与全部条目（ID/名称/家族/主备/可行度/辅助候选标记/锚点词/质感配方） | 选型基于工具返回而非印象；可向用户展示可选项 |
| R2 | 主控 Agent | 用户给定或对话收敛出风格 ID | 调校验工具（或 brief.plan 内置校验）确认 ID 存在、版本与注册版本一致、辅助 ID 在 B/D 封闭域 | 非法 ID / 错版本 / 辅助越域在就绪判定阶段被点名，不进定案门 |
| R3 | 主控 Agent | 只需判断单个引用 | 调按 ID 查询工具取得单条明细（含锚点词、质感配方，供下游提示词 Base 使用） | 不必全量装载即可取条目 |
| R4 | 系统（brief.plan） | 立项就绪自检 | mainStyleId 非空之外，再校验：ID 在谱、catalogVersion 与注册版本一致、auxiliaryStyleId 若给则在谱且属辅助候选域 | 就绪判定与「失败即拒」语义（§7.1）一致；既有 4 个 missing 码之外新增谱系类缺失/错误码 |
| R5 | 系统（装载层） | 启动/首次调用时 | 从注册路径读 md（开发态 `resources/H3-Style/`，打包态 `process.resourcesPath/H3-Style/`），解析出版本与条目，进程内缓存 | md 是唯一数据源；html 不读、不解析 |
| R6 | 系统 | md 缺失 / 解析出的条目与 ID 注册表对不上 | 返回结构化错误（谱系不可用 / 谱系漂移），不静默放过、不伪造空谱系 | 谱系资产异常时立项被显式阻断并给出原因 |
| R7 | 维护者 | 谱系升级（md 换版、条目增减） | 代码内 ID 注册表与 md 不一致时，自检/测试失败点名差异；版本号随 md 自动读出 | 「固化」的是 ID↔名称↔家族映射，版本不硬编码；升级只改 md + 注册表两处并留痕 |

## 3. 谱系数据模型（18 条目，v1.46 基线）

| ID | 名称（J.2 表内名） | 家族 | 验证状态 | 可行度 | 辅助候选 |
|---|---|---|---|---|---|
| A1 | 数字电影写实 | A 写实影像系 | 主 | 高 | 否 |
| A2 | 胶片电影感 | A 写实影像系 | 主 | 高 | 否 |
| A3 | 年代胶片（千禧·90s·80s） | A 写实影像系 | 备 | 高 | 否 |
| A4 | DV·CCD 数码复古 | A 写实影像系 | 备 | 高 | 否 |
| A5 | 黑白电影 | A 写实影像系 | 备 | 高 | 否 |
| A7 | 拟真人·仿真人动漫 | A 写实影像系 | 主 | 高 | 否 |
| B1 | 清新生活流 | B 青春治愈系 | 主 | 高 | **是** |
| C1 | 日式动漫 | C 动画插画系 | 主 | 高 | 否 |
| C2 | 国漫·新中式插画 | C 动画插画系 | 主 | 高 | 否 |
| C5 | 美式卡通 | C 动画插画系 | 备 | 高 | 否 |
| C6 | 扁平矢量·低多边形 | C 动画插画系 | 备 | 高 | 否 |
| C7 | 韩漫·精致美型 | C 动画插画系 | 主 | 高 | 否 |
| D1 | 冷调悬疑 | D 类型氛围系 | 主 | 高 | **是** |
| D2 | 赛博·科幻 | D 类型氛围系 | 主 | 高 | **是** |
| D3 | 奇幻童话 | D 类型氛围系 | 备 | 高 | **是** |
| D4 | 暗黑·哥特 | D 类型氛围系 | 备 | 高 | **是** |
| D5 | 神话国风 | D 类型氛围系 | 主 | 高 | **是** |
| E1 | 3D CG | E 材质工艺系 | 主 | 中 | 否 |

计数约束（自检断言，漂移即失败）：18 条；主 11（A1/A2/A7、B1、C1/C2/C7、D1/D2/D5、E1）、备 7（A3/A4/A5、C5/C6、D3/D4）；辅助候选 6（B1、D1/D2/D3/D4/D5）；家族 5。

规则：

1. **主风格**：18 条全部可选（主 + 备都可，选备风险自担——这是 Agent 选型提示职责，工具不阻止选备）。
2. **辅助风格**：仅上表 6 个「辅助候选=是」（§2.6.4 封闭域）；其余 ID 作辅助 → 校验失败。
3. 主与辅助可同 ID 与否不做额外限制（同一画风挂自己无业务意义，交由 Agent 判断；工具只做封闭域检查）。
4. 锚点词 / 质感配方 / 视觉特征 / 可行度为 J.2 明细列，随条目返回；锚点词供下游提示词 Base（本包只提供读取，不接提示词生成链——那是 STAGE 3 包的事）。

## 4. 范围

### 4.1 本包做

- 新建 `electron/style/` 模块：
  - `catalog.ts`：ID 注册表（§3 全表固化：ID/名称/家族/主备/可行度/辅助候选）+ `CATALOG_IDS` 等常量 + 纯函数 `isKnownStyleId` / `isAuxiliaryCandidate` / `getRegisteredEntry`。
  - `parse-md.ts`：md 纯解析（输入 md 文本，输出 `{ version: string, entries: Array<{名称; 主备; 家族; 锚点词; 质感配方; 视觉特征; 可行度}> }`）；版本正则锚定 J.0「本文版本：谱系 vX.YY」；J.2 五张表按行解析（`|` 分列、跳过表头/分隔行）。
  - `loader.ts`：注册路径解析（仿 [provider.ts](../../../electron/runtime/provider.ts) L153-177 的 isPackaged 双候选策略，指向 `resources/H3-Style/AI短剧制作视觉风格谱系.md`）+ 读盘 + 解析 + 注册表交叉核对（ID↔名称 18 条逐一比对、计数约束断言）+ 进程内缓存；错误码 `STYLE_CATALOG_MISSING`（md 读不到）、`STYLE_CATALOG_PARSE_ERROR`（版本/表结构解析失败）、`STYLE_CATALOG_DRIFT`（注册表与 md 名称/条目集对不上，消息含差异明细）。
  - `validate.ts`：纯函数 `validateStyleRefs(ids: {main?, auxiliary?}, catalog)`，产出谱系类问题清单（见契约 §6 错误码）。
- [plan.ts](../../../electron/brief/plan.ts) `evaluateDraft` 接入谱系校验：非空校验保留；新增谱系检查项以**独立错误码**返回（ID 不存在 / 版本不匹配 / 辅助越域 / 谱系不可用）。为保持纯函数与可测性，catalog 以参数注入（默认不读盘；MCP 工具层传入已装载 catalog；无注入时维持旧行为，仅非空校验）。
- MCP 新增 3 个零 LLM 只读/校验工具（**K8**），工具总数 16 → 19：
  1. `style.catalog`（无参）：返回 `{ version, count, entries[] }`（entries 含 §3 全部字段 + J.2 锚点词/质感配方/视觉特征 + `auxiliaryCandidate`）。
  2. `style.get`（入参 `id`）：返回单条；未知 ID 返回 `STYLE_ID_UNKNOWN` 错误信封。
  3. `style.validate`（入参 `mainStyleId?`、`catalogVersion?`、`auxiliaryStyleId?`）：返回 `{ ok:true, valid, issues[] }`，不抛业务错（装载失败才返错误信封）。
- [provider.ts](../../../electron/runtime/provider.ts) 工具放行白名单：新增 3 个 `shortdrama_style.*` 物理工具 ID（showrunner 立项段需要；writer/media-director 不给）。
- [showrunner.md](../../../resources/opencode/agents/showrunner.md) 第 0 步第 5 点：把「风格必须取自谱系」从纪律口号落地为动作——选型前调 `shortdrama_style.catalog`（或按题材 `style.get`），以返回条目与用户确认 ID@version；brief.plan 返回谱系类 issue 时按 message 追问/纠正，不发定案门。
- 测试：注册表/解析纯函数（用真实 v1.46 md 作 fixture + 构造 md 测版本/表异常）、交叉核对漂移检出、validate 全分支、loader 路径与缓存、3 个 MCP 工具信封、evaluateDraft 注入联动（含默认行为不变）、编排（showrunner 白名单含 3 工具）。

### 4.2 本包不做（显式排除）

- **不改 `shared/types.ts`**：BriefStyle 已够用；条目数据结构只在 electron 侧声明，不跨层（无 K1）。
- **不做谱系维护回路**：§8.3「对话驱动改 md → html 镜像同步 → 版本递增」是外部维护流程，本包只读消费；平台不提供写 md / 生成 html 的工具。
- **不做版本差异提示 UI / 旧版本项目升级流程**：本包只做「注册版本 vs 引用版本」的一致性校验并返回不匹配 issue；「已引用旧版本项目的差异展示、人决定是否采纳」留待后续（§8.3 维护回路的平台侧）。
- **不做 renderer UI**：不建风格选择器 / 预览墙浏览器 / IPC；R1-R3 的消费方是 Agent（MCP）。人通道看 html 预览仍走外部浏览器/既有方式。
- **不解析 html、不读 `_style_preview/` 媒体文件**：html 是派生镜像；预览档文件名仅作为 ID 注册表的人工核对依据，不做运行时目录扫描。
- **不接入提示词生成链 / ComfyUI**：锚点词读出即止；概念稿/定妆提示词 Base 组装属 STAGE 3（feature-301）与 803 媒体引擎。
- **不做生产环境外部路径配置**：§8.3 提到「生产环境可配置为外部路径，类似 ComfyUI 实例地址」；本包只做仓库 resources 单路径（开发态 + 打包态），外部可配置注册路径待有打包/部署包时另立。
- **不改立项单 publish 写盘形状**：立项单仍只存 ID@version + 可选辅助 ID，不内联谱系明细。
- **不修正 md 自身的历史表述**：如 J.4「备画风不入墙」与 A3/A4/A5 预览文件实际存在之间的出入，属外部数据源维护事项，只在注册表核对时以「ID↔名称」为准，不据此报错。

## 5. 验收（业务层）

- AC1：`style.catalog` 工具返回 18 条目、`version:'v1.46'`（随 md 实际版本），每条含 id/名称/家族/验证状态（主/备）/可行度/auxiliaryCandidate/锚点词/质感配方；主 11 备 7、辅助候选 6 计数正确。
- AC2：`style.get({id:'A7'})` 返回拟真人·仿真人动漫条目（A 系、主、非辅助候选）；`style.get({id:'ZZ9'})` 返回 `{ok:false,error:{code:'STYLE_ID_UNKNOWN'}}`。
- AC3：`style.validate({mainStyleId:'A7',catalogVersion:'v1.46'})` → `valid:true`；`catalogVersion:'v1.45'` → issues 含版本不匹配；`mainStyleId:'ZZ9'` → 含 ID 未知；`auxiliaryStyleId:'A1'` → 含辅助越域；`auxiliaryStyleId:'D1'` → 通过。
- AC4：brief.plan（MCP 层注入 catalog 后）对 `style:{mainStyleId:'ZZ9',catalogVersion:'v1.46'}` 返回 `ready:false`，missing/issue 中出现谱系错误码与可操作 message；合法风格（含 B1/D1 辅助）不新增任何 issue。
- AC5：catalog 注入缺省（直接调纯函数/旧测试路径）时 evaluateDraft 行为与现状逐字一致——只有四类既有 missing 码，不读盘、不报错。
- AC6：删除/移走 md 后调 `style.catalog` 返回 `STYLE_CATALOG_MISSING` 错误信封；构造缺版本号或缺 J.2 表的 md 文本返回 `STYLE_CATALOG_PARSE_ERROR`；注册表名称与 md 不一致（构造用例）返回 `STYLE_CATALOG_DRIFT` 且消息列出差异 ID；三类异常均不抛未捕获异常。
- AC7：注册表与真实 v1.46 md 的交叉核对在测试中通过（18 ID 全部能按名称对上，无多余/缺失）；计数约束（18/11/7/6/5 家族）有显式断言。
- AC8：showrunner.md 第 0 步出现选型前调 `shortdrama_style.catalog`/`style.get` 的动作与谱系类 issue 处理纪律；provider 白名单含三个 `shortdrama_style.*` 且仅在 showrunner profile。
- AC9：`npm run typecheck`、`npx tsc -b tsconfig.node.json`、`npx tsc -p tsconfig.preload.json` 不新增错误；本包相关测试全绿；全量回归失败数不扩大（基线：264 passed / 7 skipped / 12 failed，2026-10-13 feature-804 后）。
- AC10：工具总数登记更新为 19（tools.ts 头注释、§7.1 设计书表述以代码为准——设计书 L596/L627「当前实现 electron/style-catalog.ts」随本包落地成为真实存在，路径以实际 `electron/style/` 模块为准，表述差异在变更记录列明，不逆行改设计书措辞为另一含义）。

## 6. D-037 现行归并约束（2026-11-19）

本节将归档包 810「谱系升级差异工作流」、811「谱系面板全量真实化」、815「风格预览媒体元数据」的现行职责并入本包；归档包只保留历史实施与验收证据。本次为文档归并，不新增接口或产品授权，不重述历史测试为本次通过。

### 6.1 现行谱系与时效边界

1. 唯一数据源仍为 `resources/H3-Style/AI短剧制作视觉风格谱系.md`，现行版本为 **v1.47**；画风仍为 **18 条**（主 11、备 7、辅助候选 6、家族 5），ID 与 §3 不变。前文的 v1.46 是建包与首次实施基线，不得据此拒绝后续合法版本。
2. 版本号继续从 md J.0 读出，代码不硬编码。v1.47 只新增时效边界：Qwen-Image / Qwen-Image-2512 的配方、可行度和预览样张是历史风格研究与样张生成记录；现行图像 / 视频 / 音乐通道分别仅为 MiniMax H3 Image / H3 / Music3，并全部经本地或局域网 ComfyUI。不得把历史 Qwen 配方当作现行生产指令，也不重写或重生成历史预览资产。
3. R7 的升级职责包含 md、注册表、变更记录与引用升级的协同；`style.catalog` 一次快照选型、必要时 `style.validate` 自检以及 R-002 收回 showrunner `style.get` 授权的现行约束不变。

### 6.2 谱系升级与差异确认

1. md 的 `## J.3 谱系变更记录` 是升级明细事实源，与另一 `## J.3 立项选择规则` 相互独立。每版本以 `### vX.Y（可选日期）` 分节，节内 `- ` 行为一条自由中文变更简述；按 `(项目引用版本, 当前版本]` 逐字版本区间取记录。
2. 升级检测沿用逐字版本相等语义：`catalogVersion !== 当前 version` 即 `hasUpgrade:true`，不做语义化版本大小比较。旧版 md 已被覆盖时，差异由“当前项目引用条目的现况 + J.3 变更记录”组成，不伪造旧值→新值的逐字段 diff。
3. 主、辅引用条目展示当前 role / auxiliaryCandidate / feasibility / anchorWords；已不在当前谱系的引用标 `removed` 并禁止采纳。未立项或无 style 时返回 `noBrief` 空态并禁用采纳。
4. J.3 缺失或解析失败只令 `changelogUnavailable:true`，面板提示“谱系未提供变更明细”；不得影响 loader 的目录装载和 DRIFT 交叉核对。
5. Renderer 通过 `style:catalog` 取得真实版本、通过 `style:upgrade-diff` 取得差异。采纳前重取目录并核对 `currentVersion`，不一致则要求刷新；可用时只经既有 `brief:update` 写入 `style.catalogVersion`，沿用 updateBriefFields 的追溯、立项单版本与 diff 机制。不得顺手改 mainStyleId / auxiliaryStyleId、自动重生成媒体或持久化“忽略”。

### 6.3 全量真实 Store 与谱系面板

1. `src/studio/style-catalog-store.ts` 是 renderer 全量谱系唯一快照，复用 `style:catalog` 既有十键 `StyleCatalogEntryDto`；VisualCatalog、ChatComposer、Stage0View、StudioViewer 不再各自维护 STYLES / FAMILIES / 版本常量。
2. Store 状态为 `idle | loading | ok | failed | unavailable`：懒加载单 flight，成功后普通 ensure 不重取，force 可刷新；`window.api` 缺失为 unavailable，IPC reject 为 failed。同步 `getStyleEntry / getStyleName` 只读快照，未知 ID 保持纯文本回退。
3. 面板家族、卡片、主备、可行度、锚点词、质感配方及对话版本号全部来自真实条目；视觉特质无既有 UI 槽位不上屏。沿用 `data-cat-* / data-preview-* / style-catalog-version / style-upgrade-*`，不新增凭据。
4. dev-mock 自具同 DTO 的 18 条演示数据，不 import 已删除的组件硬编码表；它仍是明确的开发 mock，不冒充主进程真实文件读取。谱系重载以重启应用为前提，不新增推送或监听。

### 6.4 真实预览媒体与内嵌参数

1. 同一画风的 PNG 图片与所选 std / turbo / fast 视频双媒体同屏；每媒体 UI 状态为 `idle | loading | ready | error`，ready 内保留 DTO 五态。图片与视频分别加载、独立降级，任一失败不得清空另一媒体。
2. 元数据 DTO 状态为 `ok | missing | no-metadata | unsupported | invalid`。参数只来自媒体内嵌 ComfyUI API graph 的 `prompt`：PNG 读取合法 tEXt 且 keyword 精确为 `prompt`；MP4 沿 `moov → udta → meta → keys/ilst` 读取 mdta.prompt。UI Format / workflow 不得替代 API graph。
3. 请求只接受注册 `styleId` 与封闭 `mediaKind / tier`；renderer 不提交文件系统路径。主进程按注册家族目录和固定文件名映射定位，复核 resolve / realpath containment，只允许常规 PNG / MP4，并限制文件、box / chunk 和元数据大小。
4. 提示词与实际参数按图片 / 视频各自文件提取，只展示确定值；数字须 finite，模型 / 首帧仅 basename，未记录字段不补默认值。谱系 J.2 / J.4 文本不冒充内嵌参数。DTO 不泄漏绝对路径、完整 graph、堆栈或任意文件内容。

### 6.5 冲突裁决与历史边界

- 原 §4.2 对“版本差异 UI / 旧项目升级”“renderer UI / IPC”“读取 `_style_preview/` 媒体”的排除，仅由本节已明确纳入的三项能力取代；谱系写回路、HTML 解析、提示词生成链接入、外部路径配置等其他排除继续有效。
- 原 AC1—AC10 及任务清单中的 v1.46、工具数、测试计数和验收结果是首次实施基线，不改写。现行验收必须另以当前资源与当前实现取证；本次文档归并本身不构成产品能力、自动化测试或真机验收通过。
- 归档包中的既有例外不得借归并重新开放：不伪造谱系或媒体参数、不恢复第二份全量 Store、不把 J.3 解析失败升级为目录装载失败、不自动重生成媒体。

## 7. 谱系业务校验与升级基线

本节接收归档包 826 中与谱系产品语义有关的现行约束；826 的通用测试门禁、测试数据分类和临时目录规则由 830 负责，不迁入本包。

### 7.1 当前事实源与真实 changelog

1. 代表“当前合法引用”的立项草案及后续发布、Harness、影响评估和门链路，必须读取 `loadStyleCatalog()` 从当前正式 md 的 J.0 得到的版本，不得永久锁死历史 v1.46，也不得把当前示例 v1.47 写成新的代码常量。注册表仍须与当前 md 的条目、名称、主备和可行度交叉核对；合法主 / 备引用、辅助候选和版本一致性校验不因资源升级而跳过。
2. 当前真实 `## J.3 谱系变更记录` 同时保留 **v1.47、v1.46 两节**，各节条目及顺序以正式资源为准。升级展示读取这些真实记录，不用合成文本替代真实 changelog，也不因新增当前版本节而删除历史版本节。
3. 后续正式资源再升级时，当前引用随事实源更新；v1.47 / v1.46 的上述表述是本次归并时的资源事实，历史 v1.46 实施证据及 v1.45→v1.46 采纳场景不机械改写。

### 7.2 升级区间与独立升级输入

1. changelog 继续按 **`(fromVersion,toVersion]`** 过滤：起点 `fromVersion` 排除，终点 `toVersion` 包含；两端均可解析时按版本区间取舍，不得以字符串逐字比较代替区间过滤。
2. 任一端点不可解析时，不得据此丢空变更明细；对相关 changelog 记录采取“宁多勿缺”的放行策略。该降级只针对区间筛选，不改变 `catalogVersion !== 当前 version` 的升级检测和版本失配拒绝语义。
3. 用于验证升级区间的独立合成谱系必须具有明确版本头、两个不同版本的 changelog 节和固定 J.3 边界，不能复制真实当前版本节制造重复版本。该合成输入只证明区间、J.3 降级和采纳业务语义；其测试数据分类与通用工程门禁归 830。
4. J.3 缺失、空段、读取失败或解析失败仍只产生 `changelogUnavailable` 降级，不拖垮目录 loader；`removed`、`noBrief`、采纳前核版及仅写 `style.catalogVersion` 的约束不变。

### 7.3 负向业务校验不得削弱

1. 故意错误版本仍返回 `STYLE_VERSION_MISMATCH`；未知主 / 辅 ID 仍返回 `STYLE_ID_UNKNOWN`；已知但不属封闭候选域的辅助 ID 仍返回 `STYLE_AUX_NOT_CANDIDATE`。当前资源升级不得把这些负向引用一并改成合法值。
2. 非法画幅及门 / Harness 草案的谱系版本失配仍沿原业务错误路径拒绝。正常当前引用应先通过谱系校验，使下游链路进入其自身规则；802 不因此接管画幅、Harness、发布、影响评估或门实现。
3. 谱系版本注册、真实 changelog、升级差异和采纳闭环必须同时保留。历史升级、静态历史版本和既有采纳场景用于验证固定区间时，仍按原版本区间理解，不以“当前版本已变化”为由抹除其业务目的。

### 7.4 归并边界

826 的 Vitest / typecheck / build 通用门禁、测试数据通用原则、dev-mock 证据边界及临时目录规则均由 830 维护；具体故障注入、幂等、零写盘、错误优先级和回滚补偿仍归各业务 Feature。本节只承接上述谱系业务语义，不构成新产品实施、接口授权或测试通过结论。
