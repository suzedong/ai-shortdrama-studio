# feature-802 视觉风格谱系接入 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · K8 批准新增 3 个 MCP 工具与 brief 就绪校验联动（已批准 2026-10-13）

- **触发**：新增 `style.catalog` / `style.get` / `style.validate` 三个零 LLM 工具（16 → 19），provider showrunner 白名单 11 → 14；brief.plan 返回在 BriefPlan 既有键之外内联追加 `styleIssues`、brief.publish 未就绪判定扩展到谱系问题。命中 K8（MCP 工具登记 / 编排放行须用户批准）。**无 K1**：shared/types.ts 零改动，谱系类型全部落在 electron 侧。
- **批准方式**：任务包 5 文件建齐后在 K8 卡口呈报契约 §5/§6/§7 与 D-002~D-005 四项包级选型，AskUserQuestion 用户选定「批准，开始编码」，即视为对本包 K8 范围（含同轮 T1→T9 编码）的显式批准。
- **批准范围**（以 [契约](./SDG-RE-契约.md) 为准）：
  1. 新增 `electron/style/` 五文件（types/catalog/parse-md/loader/validate）；
  2. tools.ts 注册 style.* 三工具（17–19），头注释 16 → 19；
  3. provider 白名单 +3（仅 showrunner）；
  4. plan.ts evaluateDraft 新增可选注入参与 `styleIssues` 返回键；brief.plan/publish handler 装载注入；
  5. showrunner.md 第 0 步第 5/6 点动作化；
  6. 六个谱系错误/问题码：`STYLE_CATALOG_MISSING/PARSE_ERROR/DRIFT`（错误信封）、`STYLE_ID_UNKNOWN/VERSION_MISMATCH/AUX_NOT_CANDIDATE`（issue；get 未知 ID 走信封）。
- **不在批准范围**：shared/types.ts、renderer、preload、IPC、立项单写盘形状、谱系 md/html/预览资产、提示词链与 ComfyUI、外部路径配置、打包配置改动。
- **状态**：✅ 已批准并落地（2026-10-13 K8 卡口 AskUserQuestion 用户选定「批准，开始编码（推荐）」，T1→T9 同轮执行完毕）。

### D-002 · 谱系数据方案拍板：代码内 ID 注册表 + md 解析 + 交叉核对（2026-10-13）

- **候选**：① 纯 md 解析动态还原全部信息；② 代码内全量固化（含锚点词/配方），md 仅作版本核对；③ **注册表固化 ID↔名称映射，运行时解析 md 长文本，两者交叉核对**。
- **选定 ③**。理由：
  1. md 的 J.2 明细表**无 ID 列**，ID 仅出现在 J.4 参数表（仅 11 主风格，名称还有省略写法如「拟真人仿真人动漫」无间隔号）与 `_style_preview/` 文件名，纯解析无法可靠还原 18 个 ID（候选①否决）；
  2. 锚点词/质感配方等长文本若固化进代码会与 md 形成双份事实，违背 §8.3「md 唯一数据源」且每次谱系改措辞都要改代码（候选②否决）；
  3. ③ 下两份事实分工明确——注册表守 ID 闭集/主备/可行度/辅助候选，md 守版本号与明细文本，loader 交叉核对作为运行时漂移闸门，测试再对真实 v1.46 核对一次（AC7）；
  4. 版本号从 md 正则读出、不硬编码；谱系升级的改动面被收敛为「md + 注册表两处」，真实 md 版本断言让漏改在测试中点名。
- 备画风 ID（A3/A4/A5/C5/C6/D3/D4）以 `_style_preview/` 文件名（A3_年代胶片.png 等）为人工核对依据固化，无运行时目录扫描。

### D-003 · plan.ts 接入方式拍板：依赖注入，默认行为逐字不变（2026-10-13）

- **候选**：① evaluateDraft 内部直接 `await loadStyleCatalog()`；② catalog 作可选第二参注入，无注入维持旧行为；③ 把谱系问题并入 `BriefMissingCode` 联合。
- **选定 ②，否决 ③**。理由：
  1. evaluateDraft 现是同步纯函数（契约与 264 基线测试依赖），直接读盘破坏纯函数、给全部既有测试引入 fs/electron 依赖（①否决）；
  2. 谱系问题语义不是「字段缺失」而是「引用非法/版本不符/越域」，并入 BriefMissingCode 必须改 shared/types.ts（K1），且与既有四码混淆（③否决）；
  3. ② 下新增的 `styleIssues: StyleIssue[]` 是 electron 侧返回键（类型在 electron/style/types.ts）；planBrief 与 BriefPlan 形状不动；MCP handler 是唯一装载点。无注入时 styleIssues=[]，AC5 由既有 brief.test.ts 逐字不改保证。

### D-004 · 谱系类问题的承载与发布闸门拍板（2026-10-13）

- `style.validate`：业务问题（未知 ID/错版本/辅助越域）以 `{ok:true, valid:false, issues:[]}` 返回，不抛业务错；只有谱系资产装载失败（三码）才返错误信封。
- `style.get`：未知 ID 走错误信封 `STYLE_ID_UNKNOWN`（单条查询语义为「取不到」）。
- `brief.plan`：plan 内联对象追加 styleIssues，`ready = missing=0 && styleIssues=0`；装载失败直接返三码信封（R6：资产异常显式阻断，**不**降级为无校验旧行为）。
- `brief.publish`：谱系问题并入未就绪闸门，沿用既有错误码 `BRIEF_NOT_READY`（消息合并 missing + styleIssues），**不新增 publish 错误码**，Agent 处理路径与前序包一致；装载失败返三码且不写盘。
- 「备」作主风格不拦截（md L10：主备是验证状态轴，与主辅角色轴无关；选备风险自担是 showrunner 提示职责）；主辅同 ID 不额外限制；工具只强制辅助候选 6 项封闭域。

### D-005 · 工具面与路径边界拍板（2026-10-13）

- 工具收敛为只读三件（catalog 全量 / get 单条 / validate 校验），不做写 md、不做 html/预览媒体读取、不做 renderer IPC 与 UI（需求 §4.2）。
- 三工具不依赖激活项目（谱系是全局资源），与 brief.*（依赖 getActiveProjectDir）不同，故无 NO_ACTIVE_PROJECT 分支。
- 路径只做仓库 resources 单路径（开发态双候选 + 打包态 process.resourcesPath），不做外部可配置注册路径——§8.3 提到的外部路径配置留待打包/部署包另立。
- 打包分发：T3 仅核实 H3-Style 是否被 extraResources 覆盖；若未覆盖不改打包配置，登记遗留（可能并入 feature-803 或打包包）。

## 二、实施记录（过渡）

- 2026-10-13：建包前调研完成——设计书 §2.6.4/§7.1/§8.3 条款、谱系 md v1.46 全文与 `_style_preview/` 文件名、electron/ 零实现实况、plan.ts/tools.ts/provider.ts 消费面、shared 类型引用面、既有测试夹具（A7@v1.46 合法、B2/C1 仅 diff 用例）。
- 2026-10-13：任务包 5 文件建立（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录）。K8 未批准前不触碰任何代码。
- 2026-10-13：K8 卡口获批（D-001），T1→T7 编码：
  - T1 `electron/style/types.ts`（StyleIssue/LoadedStyleCatalog 等类型）+ `catalog.ts`（18 条 ID 注册表、主 11/备 7、辅助候选封闭域 6 项 B1/D1–D5、纯查询函数）；
  - T2 `parse-md.ts`（版本正则 + J.2 五家族表解析，PARSE_ERROR 六类畸形）；
  - T3 `loader.ts`（开发态双候选 / 打包态 resourcesPath、缓存、注册表↔md 交叉核对 DRIFT、MISSING 不缓存）；
  - T4 `validate.ts`（三 issue 规则）+ `plan.ts`（evaluateDraft 可选注入，D-003）；
  - T5 `tools.ts` 注册 `style.catalog/get/validate`（17–19，头注释 16→19），brief.plan/publish 装载注入与就绪闸门联动（D-004）；新增 style-catalog.test.ts（21）/ mcp-style-tools.test.ts（11），brief.test.ts 注入用例 +3（既有断言逐字未动）；
  - T6 `provider.ts` showrunner 白名单 11→14；mcp-pure-tools（注册数 19）、runtime-client（放行）、runtime-integration（listAgents）同步；
  - T7 `showrunner.md` 第 0 步第 5/6 点动作化（先查后选、逐字采用 version、辅助封闭域、资产三码停止收敛）；agent-profiles.test.ts +2 用例并扩展白名单静态断言。
- 2026-10-13：T8 全量回归——`npm run typecheck` 零新增（基线 7 个错误均在 dev-mock-api.ts / CanvasBoard.tsx / VisualCatalog.tsx 未触碰文件；编码中两处测试文件新增 TS 错误已当场修复）；`tsc -b tsconfig.node.json`、`tsc -p tsconfig.preload.json` 零错误；`npm run test:run` 全量 **302 passed / 7 skipped / 12 failed**（基线 264/7/12 + 本特性净增 38 断言；12 失败逐个核对均为既有：fs-sandbox ×1 环境路径、architecture ×1 renderer 注释含 comfyui 字样、studio-flow ×10 环境/渲染，另有 runtime-integration 套件无二进制跳过）。
- 2026-10-13：T9 治理收尾——features/README 802 标已落地；偏差清单 B-05 标 ✅ 并留痕五文件形态差异、新增 B-11 打包资源覆盖遗留、§1 快照工具数 16→19/八族；feature-001 变更记录加 R-002 交叉指针；本记录回填。**shared/types.ts 零改动（无 K1）；谱系 md/html 本体与 `_style_preview/` 零改动。**
- 登记：错误/问题码共六个——错误信封 3 个 `STYLE_CATALOG_MISSING` / `STYLE_CATALOG_PARSE_ERROR` / `STYLE_CATALOG_DRIFT`；业务 issue 3 个 `STYLE_ID_UNKNOWN` / `STYLE_VERSION_MISMATCH` / `STYLE_AUX_NOT_CANDIDATE`（get 未知 ID 走信封，validate 未知 ID 走 issue，D-004）。MCP 工具总数 16→19（物理名 `shortdrama_style.catalog/get/validate`），showrunner 白名单 11→14。
- 打包遗留：仓库无 electron-builder/extraResources 配置，`resources/H3-Style/` 与既有 `resources/opencode/` 均无打包清单保证（非本特性引入），已登记偏差清单 B-11，本包按 D-005 不改打包配置。

## 三、修订记录

### R-001 · 设计书单文件表述与五文件实现的形态差异留痕（2026-10-13）

- 设计书 §7.1（约 L596）/ §8.3（约 L627）称「当前实现 `electron/style-catalog.ts`（CATALOG_VERSION + assertionCatalog 校验）」；本包落地形态为 `electron/style/` 五文件（types/catalog/parse-md/loader/validate），且版本号从 md 运行时解析、不设代码内 CATALOG_VERSION 常量。
- 裁决：职责口径（版本跟踪 + ID 校验）一致，文件拆分与版本读法为 D-002 选型的实现细化；**不回改设计书**（契约 §12 / AC10），差异在偏差清单 B-05 与本留痕双处记名。
- feature-001 契约「style 仅非空校验（B-05）」表述被本包注入式行为增补（evaluateDraft 可选 catalog 参 + styleIssues 返回键，纯函数默认行为与 BriefPlan 形状不变），交叉指针已加：[feature-001 变更记录 R-002](../feature-001-立项模型重建/SDG-AI-变更记录.md)。
