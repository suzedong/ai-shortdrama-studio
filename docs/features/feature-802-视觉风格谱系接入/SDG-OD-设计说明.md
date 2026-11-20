# feature-802 视觉风格谱系接入 · 设计说明

> 本包是**主进程数据/工具包**：新增谱系装载/解析/校验模块（`electron/style/` 五文件）、3 个零 LLM MCP 工具、brief 就绪校验的注入式增补与 showrunner 提示词纪律。**无新页面、无新视觉资产、无新 IPC、无新交互、无 renderer/preload/shared 改动**。

## 1. UI 改动面

无。renderer（`src/` 全部 studio/components）与 preload 零改动；谱系消费方是 Agent（MCP），不是界面。人读预览仍走既有 html / 文件方式，本包不建风格选择器或预览墙浏览器（需求 §4.2 显式排除）。

## 2. 不新增视觉资产

- 不新增图标/配色/弹窗；不读取、不处理 `_style_preview/` 的 PNG/MP4。
- 谱系 md 是**入边数据**而非本包产物：`resources/H3-Style/AI短剧制作视觉风格谱系.md`（v1.46，18 画风）已在仓，本包只读消费；html 镜像不读。

## 3. 不新增 IPC / preload

三工具只经 MCP 对 showrunner 可达；不经 main.ts 注册 IPC、不改 preload 暴露面，与 brief.* / manifest.* 同轨。renderer 不直连谱系文件。

## 4. 模块架构

```
resources/H3-Style/AI短剧制作视觉风格谱系.md（外部唯一数据源，v1.46）
            │ 读盘（路径解析：isPackaged 双候选）
            ▼
electron/style/loader.ts ── parse-md.ts（纯解析）── ParsedStyleEntry[18]
            │ 交叉核对（名称集合/主备/可行度）
            │ 合并注册表骨架 ⊙ md 明细
            ├── catalog.ts（ID 注册表 18 条 + 纯谓词，代码事实）
            ▼
      LoadedStyleCatalog（进程内缓存，版本从 md 读出）
            │
            ├── validate.ts · validateStyleRefs（纯）── StyleIssue[]
            │         ▲
            │         │ 依赖注入（可选第二参，缺省行为逐字不变）
            └── brief/plan.ts · evaluateDraft(draft, catalog?)
                      ▲
                      │ MCP handler 负责装载传入
        mcp/tools.ts：style.catalog / style.get / style.validate（17–19）
                      brief.plan / brief.publish（注入联动）
```

设计要点：

1. **两份事实分工**：catalog.ts 固化「ID ↔ 名称 ↔ 家族 ↔ 主备 ↔ 可行度 ↔ 辅助候选」（md 的 J.2 表无 ID 列，ID 仅散见于 J.4 与预览文件名，无法纯解析还原）；md 提供版本号与长文本明细（视觉特征/锚点词/质感配方）。loader 的交叉核对是两者一致性的运行时闸门，测试再做一次真实资产核对（AC7）。
2. **版本不硬编码**：代码任何位置不写 `'v1.46'`；版本从 J.0 正则读出。升级谱系 = 改 md + 改注册表两处，测试中「真实 md 版本断言」与漂移用例负责点名遗漏。
3. **纯函数/有状态分离**：parse-md、catalog 谓词、validate、evaluateDraft 全纯；仅 loader 触盘并持缓存。与 [manifest.ts](../../../electron/project/manifest.ts)「纯函数跃迁 + 有状态读改写」同构，单测无需 mock fs 即可覆盖核心逻辑。
4. **依赖注入保纯函数**：evaluateDraft 新增可选参 `catalog?`；无注入返回 `styleIssues: []`，planBrief 不装载（IO 边界不变），装载只在 MCP handler 发生。既有 264 基线测试中对 evaluateDraft 的调用逐字不变即仍绿（AC5）。

## 5. 关键算法

### 5.1 md 解析

- 版本锚点：`/本文版本：谱系\s*(v\d+\.\d+)/` 限定在全文首段（J.0），避免误匹配历史版本叙述（L7 中「v1.45 见下」不含该前缀）。
- J.2 区段截取 `## J.2` 至 `## J.3` 之间；5 个家族以粗体表头前缀定位（`**A 写实影像系` 等），家族→代码映射不依赖括号内形态描述措辞。
- 表行按 `|` split 后去首尾空栏，要求恰 5 非空单元；名称尾标注 `「主」`/`「备」`（兼容 `）「备」|` 无空格写法，L45）；可行度只认 `●高/●中/●低`。任何结构性异常 → PARSE_ERROR，宁拒不猜。
- J.1 总览表（单元格内多画风用 `/` 串联）与 J.4 参数表（仅 11 主风格且名称有省略写法如「拟真人仿真人动漫」无间隔号）**不参与解析**——两处名称不规范化，强行解析会引入脆弱匹配。

### 5.2 交叉核对（漂移检测）

- 以家族分组，比较两个名称集合：注册表 6/1/5/5/1 vs md 同家族行数集合；差异报「注册表缺失 / md 多余」。
- 名称交集上逐项比对 role 与 feasibility，差异报「主备不符 / 可行度不符」并附 ID（ID 由注册表名称反查）。
- 任一差异 → 抛 DRIFT（消息拼全部差异），不返回部分 catalog。辅助候选闭集是注册表单方事实（md 只在 J.0 叙述封闭域），不参与 md 交叉核对，由注册表计数测试守。

### 5.3 路径解析

照搬 [provider.ts](../../../electron/runtime/provider.ts) L153–177 已验证模式：`app.isPackaged` 为唯一打包判据（开发态 process.resourcesPath 指向 Electron 发行目录不可用）；打包态 `process.resourcesPath/H3-Style/<file>`；开发态由 `import.meta.url`（vitest/ts 直跑在 `electron/style/`、编译产物在 `dist-electron/electron/style/`）推两个仓库根候选，首个 access 成功为准。

### 5.4 缓存

模块级单变量缓存已装载 catalog；失败不缓存（资产修复后下次调用自愈）；`force` / `clearStyleCatalogCache` 供测试与未来手动刷新。进程生命周期内谱系不换版，不做 mtime 监听（外部维护回路换版必然伴随应用重启/升级）。

## 6. 错误流与就绪语义

| 场景 | brief.plan | brief.publish | style.* 工具 |
|---|---|---|---|
| 谱系正常 + 引用合法 | ready 含 styleIssues 合取 | 放行双写 | validate 返回 valid:true |
| 谱系正常 + ID/版本/辅助域问题 | ready:false + styleIssues 逐条 message | BRIEF_NOT_READY（消息合并），不写盘 | validate: ok:true/valid:false/issues[]；get 未知 ID → STYLE_ID_UNKNOWN |
| md 缺失/损坏/漂移 | 错误信封（STYLE_CATALOG_*），不降级 | 错误信封，不写盘 | 同左 |

「失败即拒」（设计书 §7.1 L596）在工具层落实；Agent 是否选「备」作主风格不拦截（风险提示是 showrunner 纪律，工具只给 role 字段与候选闭集强制）。

## 7. 对既有行为的影响面（已逐一核实）

- [brief.test.ts](../../../src/test/brief.test.ts)：evaluateDraft 既有调用走无注入路径；L78 的 `B2/C1` 出现在 diff 用例（不注入不校验）；L121 catalogVersion 缺失用例仍返 MAIN_STYLE_MISSING。全部既有断言不需要改。
- [mcp-brief-tools.test.ts](../../../src/test/mcp-brief-tools.test.ts)：夹具 `A7 @ v1.46` 在注入后合法（A7 是注册 ID、版本与真实 md 一致），v1–v3 publish 与 ready=true 断言保持成立。
- planBrief 的其他调用面（仅 brief.test.ts 与 tools.ts，已 grep 全仓）签名不变。
- provider 11 → 14 为纯追加；writer/media-director/comfyui-operator 白名单不涉及。
- 风险点：测试运行目录下真实 md 必须可达——开发态候选根之一即仓库根，CI/vitest 从仓库运行可命中；测试同时直接以文本 fixture 覆盖解析与漂移，不把真实文件作为唯一依赖。

## 8. 视觉/测试回归基线

- 无视觉回归项；不新增渲染测试依赖。
- 回归红线：typecheck / tsc -b（node）/ tsc -p（preload）零新增错误；全量测试失败数不扩大（基线 264 passed / 7 skipped / 12 failed，2026-10-13）；新增测试只许增加 passed 数。

## 9. D-037 现行归并设计（2026-11-19）

本节统一归档包 810 / 811 / 815 的现行设计归属，不表示本轮重新实施或验收。

### 9.1 单一目录事实与升级读链

```text
谱系 md（当前 v1.47）
  ├─ J.0/J.2 → loader + registry → style:catalog → 全量真实 Store / 面板
  └─ J.3 谱系变更记录 → 独立容错解析 ─┐
当前项目 Brief 主辅引用 → 当前条目现况 / removed ─┴→ style:upgrade-diff
用户采纳前重取 style:catalog 核版 → brief:update({style:{catalogVersion}})
```

版本只做逐字比较。旧版 md 不在仓时，面板组合“引用条目现况 + 变更记录”，不反推逐字段旧值。J.3 失败只影响 changelogUnavailable，不拖垮目录。removed 与 noBrief 阻断采纳；忽略不落持久状态。写路径复用 updateBriefFields，不另建 brief 写接口。

### 9.2 Store 与面板组合

`style-catalog-store.ts` 以 useSyncExternalStore 持全量十键条目和版本，ensure 单 flight 并支持 force；同步 getStyleEntry / getStyleName 供纯展示组件查询。VisualCatalog、ChatComposer、Stage0View、StudioViewer 消费同一快照，删除各自硬编码目录事实，未知 ID 仍纯文本回退。既有 testid 全部沿用，dev-mock 自具同 DTO 演示表，不能 import 已删除的组件表。

原“无 renderer UI / IPC”设计只适用于 802 首次 MCP 落地阶段；现行仅限本节纳入的目录、升级与预览面板例外，其他 renderer 排除不变。

### 9.3 双媒体与元数据解析

```text
VisualCatalog
  ├─ {styleId, mediaKind:'image'} ─────────┐
  └─ {styleId, mediaKind:'video', tier} ───┤
                                          ▼
                         style:preview-metadata（主进程白名单定位）
                                          ├─ PNG tEXt prompt → API graph
                                          └─ MP4 mdta prompt → API graph
                                          ▼
                  DTO ok/missing/no-metadata/unsupported/invalid
```

主进程按注册家族和固定文件名定位，执行 resolve / realpath containment、常规文件、上限与结构校验；renderer 永远不传路径。两个请求以序号和当前身份防 stale，切视频档只重置视频，切风格才重置双媒体。missing、无元数据、UI Format / 不支持 graph、坏档分别降级，互不遮蔽。

graph 按 class_type / inputs 和连接解析，不执行节点、不读引用文件，不用谱系文本补参数。v1.47 的 Qwen 配方与样张均标历史研究，生产通道仍锁 H3 Image / H3 / Music3，经本地或局域网 ComfyUI。

### 9.4 冲突与降级

- 原 §1—§3 的“无 UI / 无 IPC / 不读预览媒体”是首次实施边界，现由 §9.2—§9.3 的有限例外取代；不开放谱系写入、HTML 解析、任意文件读取或媒体生成。
- 目录不可用时纯文本回退，不伪造目录；项目无升级不制造差异；J.3 失败独立降级；媒体参数不可用不影响另一媒体和谱系文本。
- 既有测试数字、真机记录和历史设计均为当时证据。本节只做现行设计归并，自审口径见变更记录，无第二人复核。

## 10. 谱系事实源与业务校验保持设计

本节接收 826 的谱系业务设计约束，与 §4—§6 的 loader / 校验器和 §9.1 的升级读链共同生效，不表示重新实施或运行历史测试。

### 10.1 当前事实与真实记录分流

```text
当前正式 md
  ├─ J.0 当前版本 + J.2 条目 → loader / registry 交叉核对 → 当前合法引用
  └─ J.3 谱系变更记录
       ├─ 真实资源：当前保留 v1.47、v1.46 两节 → 真实 changelog
       └─ 独立升级输入：两个不同版本节 → 区间与降级业务验证
```

当前合法引用从 loader 快照取版本，不在草案、注册表或下游链路中另存“当前版本”常量。资源升级只改变当前事实，不把历史 v1.45→v1.46 采纳场景或故意错版输入改写为合法场景。真实 changelog 的版本节、条目与顺序来自正式资源；独立升级输入不得复制当前版本节造成重复版本，其测试数据管理由 830 负责。

### 10.2 区间筛选与容错顺序

1. 先按 `### vX.Y` 识别 J.3 版本节，再处理 `(fromVersion,toVersion]`：可解析时排除起点、包含终点并保留区间内的记录。
2. 任一端点不可解析时跳过不可靠的区间裁剪，保留全部相关记录，以较多明细避免漏报；此分支不反向改变逐字不等驱动的 `hasUpgrade`，也不把故意错版变成合法引用。
3. J.3 缺失、空段、读取或解析失败只令 changelog 通道不可用，目录 loader、注册交叉核对和引用现况不被拖垮。独立升级输入以固定 J.3 边界和两个不同版本节验证这些分支，而非在真实 v1.47 文本上隐式替换出重复节。
4. 差异仍由“引用条目现况 + changelog”组成；`removed` / `noBrief` 阻断采纳。采纳前核版及 `brief:update` 仅写 `catalogVersion` 的链路保持 §9.1，不新增旁路。

### 10.3 严格性保持矩阵

| 场景 | 设计不变量 |
| --- | --- |
| 当前合法草案 | 使用当前 loader 版本，通过谱系校验后进入下游自身业务规则 |
| 故意错版、未知 ID、辅助越域 | 分别保留 `STYLE_VERSION_MISMATCH`、`STYLE_ID_UNKNOWN`、`STYLE_AUX_NOT_CANDIDATE`，不随基线校准删除 |
| 非法画幅、门 / Harness 草案版本失配 | 原负责链路和错误路径继续拒绝，802 不放宽也不接管其实现 |
| 历史升级 / 采纳 | 固定版本区间和 diff / decision / mark 目的不变，不机械替换为当前版本 |
| 当前真实 changelog | v1.47、v1.46 两节均可读取；新增当前节不覆盖历史节 |

因此，826 所验证的不是“把版本号改绿”，而是当前合法路径与负向 / 历史路径各自保持不同语义。版本注册、真实 changelog、升级差异和采纳闭环任一缺失都视为业务回退。

### 10.4 冲突与归属

本节不把 826 的 Vitest / typecheck / build 门禁、临时目录或通用测试数据原则迁给 802；这些由 830 维护。Harness、发布、影响评估、门、画幅、故障注入及回滚补偿仍由各业务 Feature 所有，802 只维护谱系业务约束。本次仅文档归并，未形成新接口、新产品能力、自动化测试或真机验收结论。
