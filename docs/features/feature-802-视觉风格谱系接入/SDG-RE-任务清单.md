# feature-802 视觉风格谱系接入 · 任务清单

> 执行依据：[需求规格](./SDG-RE-需求规格.md) + [契约](./SDG-RE-契约.md)。任务按顺序执行；每项给出改动面与自验方式。
>
> 卡口：**K8（无 K1）**——新增 3 个 MCP 工具（16 → 19）、provider 白名单 +3、brief.plan/publish 行为增补（注入式谱系校验）。**方案见契约 §5/§6/§7，须用户在 K8 卡口显式批准后方可执行 T1 及任何代码改动；批准留痕填入 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md) D-001。**

## 0. 上下文加载清单（工作围栏）

- [x] `AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`
- [x] `短剧Agent平台设计.md` §2.6.4（L195–215）、§7.1（L594–596）、§8.3（L613–627）
- [x] 本包 `SDG-RE-需求规格.md` / `SDG-RE-契约.md`
- [x] `resources/H3-Style/AI短剧制作视觉风格谱系.md`（全文 116 行：J.0 版本行 L7、J.1 L16–36、J.2 五表 L38–75、J.4 L81–104）
- [x] `resources/H3-Style/_style_preview/` 目录实况（18 个 ID 文件名交叉核对依据；A 系目录含 A3/A4/A5 备画风 PNG）
- [x] `shared/types.ts`（BriefStyle L87–92、BriefMissingCode L124–128、BriefPlan L136–143、BriefDraft L146–152——只读不改）
- [x] `electron/brief/plan.ts`（evaluateDraft L39–72、planBrief L125–140）
- [x] `electron/brief/diff.ts`、`electron/brief/render-md.ts`（消费形状参照，不改）
- [x] `electron/mcp/tools.ts`（信封 fail/normalize/respond L27–50；brief.plan L301–343；brief.publish L345–453；注册尾 L505）
- [x] `electron/runtime/provider.ts`（SHOWRUNNER_DECLARED_TOOLS L57–69；resolveAgentTemplatePath L153–177 路径模式）
- [x] `resources/opencode/agents/showrunner.md`（第 0 步第 5 点 L83、第 6 点 L84–86；frontmatter 实况）
- [x] feature-801 / feature-804 五文件（任务粒度、测试夹具、治理收尾先例）
- [x] 现有测试：`src/test/brief.test.ts`、`src/test/mcp-brief-tools.test.ts`（既有夹具 A7@v1.46 合法、B2/C1 仅在 diff 用例）、白名单静态测试位置

围栏外文件不动：shared/types.ts、preload、renderer 全部组件、main.ts、gate、canvas、asset、comfy、project 模块、brief/diff.ts、brief/render-md.ts、谱系 md/html/预览资产、electron-builder/打包配置（extraResources 已覆盖 H3-Style 时核实但不改——见 T3 自验）。

## 1. 原子任务

### T1 · electron/style 类型与 ID 注册表（✅ 2026-10-13 完成）
- 新增 `electron/style/types.ts`：契约 §1 全部类型（StyleFamilyCode / StyleRole / StyleFeasibility / RegisteredStyleEntry / ParsedStyleEntry / LoadedStyleCatalog / StyleIssueCode / StyleIssue）。
- 新增 `electron/style/catalog.ts`：契约 §2 全表 18 条（逐字名称，A3 含全角括号与间隔号）、`STYLE_REGISTRY` / `CATALOG_IDS` / `AUXILIARY_CANDIDATE_IDS`、`isKnownStyleId` / `isAuxiliaryCandidate` / `getRegisteredEntry`；模块顶部注释注明「ID↔名称事实，版本不固化；升级改本表 + md 两处」。
- 自验：注册表计数纯函数断言（T5 测试文件先行可挂）；typecheck 通过。
- AC：AC7 的注册表半边；契约 §2 表逐行。

### T2 · md 纯解析器（✅ 2026-10-13 完成）
- 新增 `electron/style/parse-md.ts`：`parseStyleCatalogMd(text)`，实现契约 §3 八条规则（版本正则、五家族表头定位、行分列、`「主」/「备」` 尾标注兼容无空格写法 L45、可行度映射、计数 6/1/5/5/1）；解析失败统一抛带 `code:'STYLE_CATALOG_PARSE_ERROR'` 的 Error。
- 自验：真实 v1.46 文本解析出 18 条、版本 `v1.46`、E1=medium、A3 名称去标注正确；构造 5 类坏 md 各抛对应码（T5 测试）。
- AC：AC6（parse 半边）、AC7。

### T3 · 装载层：路径解析 + 交叉核对 + 缓存（✅ 2026-10-13 完成；打包未覆盖 → 偏差清单 B-11）
- 新增 `electron/style/loader.ts`：`STYLE_DIR_NAME` / `STYLE_FILE_NAME` 常量、`resolveStyleCatalogPath()`（app.isPackaged 判据 + 开发态双候选，契约 §4.1）、`loadStyleCatalog(force?)`（读盘 → 解析 → 注册表按家族名称集合/主备/可行度交叉核对 → 合并产出 → 模块级缓存）、`clearStyleCatalogCache()`；三码 `STYLE_CATALOG_MISSING/PARSE_ERROR/DRIFT` 以带 code 的 Error 抛出，DRIFT 消息含差异明细；失败不写缓存。
- 核实（不改）打包配置中 H3-Style 是否已随 extraResources 分发；若未覆盖，本包**不**扩范围改打包，只在变更记录登记遗留并提示 803/打包包处理。
- 自验：开发态命中真实 md；缓存 spy（二次调用不读盘）；force/clear 重读；缺失路径 → MISSING；构造漂移文本 → DRIFT 消息点名 ID。
- AC：AC6 全、AC7。

### T4 · 校验纯函数与 plan.ts 注入（✅ 2026-10-13 完成）
- 新增 `electron/style/validate.ts`：`validateStyleRefs(ids, catalog)` 契约 §5.1 四规则（未知 ID / 版本非逐字相等 / 辅助未知或越域；空值不查、同 ID 不阻、备不阻），message 文案按契约逐字落实。
- 改 [plan.ts](../../../electron/brief/plan.ts)：import 类型 `LoadedStyleCatalog` / `StyleIssue`（electron 侧类型，非 shared）；`evaluateDraft(draft, catalog?)` 返回追加 `styleIssues`，末尾按契约 §5.2 计算；更新 L37 注释（B-05 已补：注入时校验）；**planBrief 与四类既有校验逻辑一行不动**。
- 自验：brief.test.ts 既有断言全绿（验证 AC5）；追加注入用例（未知 ID / 错版本 / 辅助越域 / 合法含 D1 辅助）。
- AC：AC3（纯函数半边）、AC4、AC5。

### T5 · MCP 三工具注册与 brief 工具联动（16 → 19，K8）（✅ 2026-10-13 完成）
- 改 [tools.ts](../../../electron/mcp/tools.ts)：头注释 16 → 19 并补 style 族说明；注册 `style.catalog`（17，无参）、`style.get`（18，`{id}` 最小长度 1，未知 → fail STYLE_ID_UNKNOWN）、`style.validate`（19，三可选字符串，业务问题走 issues 不 fail）；装载异常经 normalize 出三码信封。
- brief.plan handler：装载 catalog（失败直接错误信封）→ `evaluateDraft(draft, catalog)` → 内联 plan 追加 `styleIssues`、`ready` 加合取；brief.publish handler：同样注入，未就绪判定含 styleIssues，仍返 `BRIEF_NOT_READY`（消息合并），装载失败返三码不写盘。
- 新增 `src/test/style-catalog.test.ts`（T1–T3 单元面：注册表计数与闭集、解析真实 md、构造坏 md、漂移检出、路径/缓存）。
- 新增 `src/test/mcp-style-tools.test.ts`（fake server 夹具同 mcp-brief-tools：catalog/get/validate 信封与分支；注意 electron mock 仅需 app.isPackaged/getPath，按 loader 实际 import 补 hoisted mock）。
- 扩展 `src/test/mcp-brief-tools.test.ts`：合法 A7@v1.46 的 plan 返回 styleIssues=[] 且 ready 不变；非法 ID / 错版本 / 辅助越域 ready:false；publish 非法风格 BRIEF_NOT_READY 不落盘。
- AC：AC1、AC2、AC3、AC4、AC6、AC7、AC10。

### T6 · provider 白名单与静态测试（✅ 2026-10-13 完成）
- 改 [provider.ts](../../../electron/runtime/provider.ts)：`SHOWRUNNER_DECLARED_TOOLS` 追加 `shortdrama_style.catalog/get/validate`（11 → 14），注释计数与 feature 沿革补 feature-802 一行；判定函数与其他 profile 不动。
- 同步白名单静态测试（agent-profiles / runtime-client / runtime-integration 中 showrunner 工具清单期望，按 grep 实况逐处更新，不断言 writer/media-director 含 style.*）。
- 自验：相关测试绿；全仓 grep 三物理键仅出现在白名单、tools 注册与测试。
- AC：AC8、AC9 前置。

### T7 · showrunner.md 纪律落地（✅ 2026-10-13 完成）
- 改 [showrunner.md](../../../resources/opencode/agents/showrunner.md)：
  - 第 0 步第 5 点：选型前必须调 `shortdrama_style.catalog`（或按题材预选调 `shortdrama_style.get`）→ 基于返回向用户展示主/备、可行度、辅助候选 → 逐字采用返回版本记 `ID @ version`；辅助只能从 6 封闭候选选；不得凭印象自造。
  - 第 6 点：brief.plan `ready:false` 时 `missing[]` 与 `styleIssues[]` 都按 message 追问纠正后重跑；`STYLE_CATALOG_*` 装载错误须报告用户、不绕过立项。
  - frontmatter/permission 若枚举工具则追加三个 `shortdrama_style.*: true`（按文件实况；无枚举块则只改正文，不新造结构）。
- 同步编排测试中 showrunner 工具/纪律断言（若现有 STAGE 0 脚本断言工具集，11→14 与 style.catalog 调用序）。
- 自验：编排测试绿；全文 grep 三工具名仅出现在第 0 步指定位置。
- AC：AC8。

### T8 · 全量回归（✅ 2026-10-13 完成：302 passed / 7 skipped / 12 failed，12 失败均为基线既有）
- `npm run typecheck`、`npx tsc -b tsconfig.node.json`、`npx tsc -p tsconfig.preload.json`：零新增错误（基线既有 7 个 typecheck 错误均在未触碰文件，逐个对照）。
- `npm run test:run` 全量：失败数不扩大（基线 **264 passed / 7 skipped / 12 failed**，2026-10-13 feature-804 后；12 失败逐个 HEAD 对照均为既有）。
- AC：AC9。

### T9 · 治理文档收尾（✅ 2026-10-13 完成）
- [features/README.md](../../README.md)：802 行状态 → ✅ 已落地（日期），技术落点「electron/style/ 五文件、19 工具、谱系 v1.46 校验」。
- [设计现状与偏差清单.md](../../设计现状与偏差清单.md)：B-05 → ✅（附本包链接与落点；注明设计书 `electron/style-catalog.ts` 单文件表述与实际 `electron/style/` 五文件的形态差异）。
- feature-001 变更记录「修订记录」区加交叉指针一条（契约 §12：非空校验行为被注入式增补，纯函数默认行为与 BriefPlan 形状不变）。
- 本包 `SDG-AI-变更记录.md`：回填 D-001 K8 批准方式与 T1→T9 实施记录（含测试统计、三码/六 issue 码登记、工具数 19）。
- 若打包 extraResources 未覆盖 H3-Style（T3 核实结果），在偏差清单登记遗留项。
- AC：导航文档与磁盘实况一致；AC10 留痕。

## 2. 产出物清单

| 产出 | 位置 | 状态 |
|---|---|---|
| 谱系类型 | `electron/style/types.ts`（新增） | ✅ |
| ID 注册表 18 条 + 纯函数 | `electron/style/catalog.ts`（新增） | ✅ |
| md 解析器 | `electron/style/parse-md.ts`（新增） | ✅ |
| 装载/交叉核对/缓存 | `electron/style/loader.ts`（新增） | ✅ |
| 引用校验 + plan 注入 | `electron/style/validate.ts`（新增）；`electron/brief/plan.ts`（改） | ✅ |
| MCP 工具 ×3 + brief 联动 | `electron/mcp/tools.ts`（19 工具） | ✅ |
| runtime 白名单 | `electron/runtime/provider.ts`（11 → 14） | ✅ |
| Agent 提示词 | `resources/opencode/agents/showrunner.md` | ✅ |
| 测试 | style-catalog / mcp-style-tools 新增；brief / 白名单静态（agent-profiles、runtime-client、runtime-integration、mcp-pure-tools）扩展 | ✅ |
| 治理文档 | features/README、偏差清单 B-05（+B-11 遗留）、feature-001 R-002 交叉指针、本包变更记录 | ✅ |

## 3. 不做（防止越界）

- 不动 `shared/types.ts`（无 K1）；谱系类型不 re-export 跨层。
- 不做谱系写回路（改 md/生成 html/版本递增）、版本差异 UI、旧项目升级流程。
- 不做 renderer UI / IPC / 风格选择器 / 预览墙浏览器；不解析 html、不读 `_style_preview/` 媒体（文件名仅人工核对依据）。
- 不接提示词生成链 / ComfyUI（锚点词读出即止，留 301 / 803）；不做外部注册路径可配置。
- 不改立项单 publish 写盘形状（仍只存 ID@version + 可选辅助 ID，不内联明细）；不改 diff.ts / render-md.ts。
- 不修谱系 md 自身表述（「备画风不入墙」与备画风 PNG 实存出入；J.4「A1–A6」措辞等）——交叉核对只认 J.2 的 ID↔名称↔主备↔可行度。
- 不新增 publish 错误码（沿用 BRIEF_NOT_READY）；不改 planBrief 签名与 BriefPlan 形状；不改打包配置（核实结果仅登记）。
