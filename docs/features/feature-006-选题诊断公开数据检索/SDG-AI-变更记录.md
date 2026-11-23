# SDG-AI-变更记录 — feature-006 选题诊断公开数据检索

> 本文件按通用规则 §2 记录本任务包全部变更，三类分节：**D（决策）/ T（任务执行）/ X（修复）**。

---

## D（决策）

### D-001 建包与双方案 K8 卡口登记（2026-10-19）

**背景**：新建→立项链路盘点（2026-10-18/19，版本记录已留痕）缺口 #1——设计书 §2.6.2 明示主控 Agent「基于已捕获口径检索同赛道公开数据」产出选题诊断卡（五区块：同赛道对标案例/用户洞察/爆点钩子模式库/合规风险/结论），现状 showrunner step 3 为「基于已捕获口径自身推理」，无任何检索通道，诊断纯靠模型内置知识（时效与编造风险）。登记偏差 **B-39**。

**关键未知项（不臆造）**：`@opencode-ai/sdk` 1.18.34 客户端类型层 grep 无 webfetch/websearch；opencode 服务端是否内置可用 web 工具未证实——通道选型无法建包时拍死。

**设计抉择（用户指令「#1、#2」推进建包，抉择项以推荐默认值随本登记呈报，批准即生效）**：

1. **通道选型 = 探测前置双方案**：T0 实测定案——方案 A（主）：opencode 服务端内置 web 工具经 `SHOWRUNNER_DECLARED_TOOLS` 白名单放行（仅 showrunner，成本最低）；方案 B（降级）：自建 `shortdrama_web.search/fetch` MCP 工具（25→27，主进程原生 fetch，零 Key 优先）。定案 B 时契约 §2.2 补登后实施，不停手重报。
2. **隐私边界 = 默认启用 + 产物标注 + 纪念类默认不检索**：商业类诊断前先检索；检索词仅题材类型维度字段值 + 泛化赛道词，禁用 leads/coreEvent 原文与用户逐字原话（§12 隐私边界外扩最小化）；诊断卡尾附「检索来源」（检索词 + URL + 日期）可审计；纪念类按设计书弱化口径默认不检索，用户明示才检索。
3. **零平台面变更**：纯 Agent 工具面 + 指令层——K1 零触发，零 renderer/IPC/brief 代码；来源标注随既有 diagnosisDetail 落盘机制（D-018）承载。

**K8 卡口登记**：方案 A——`SHOWRUNNER_DECLARED_TOOLS` +N 内置 web 工具实际 ID（占位 webfetch/websearch，以 T0 为准；非新 MCP 工具，Agent 请求级工具面变更按 K8 登记）；方案 B——MCP 工具 25→27（`shortdrama_web.search/fetch`）。契约 §2。

**K9 卡口**：方案 A 零触发；方案 B 搜索源须 Key 或新依赖即停手补登。

**指令层修订归属**：showrunner.md step 3 修订（S1–S4，契约 §3）按 B-34/B-35/feature-005 先例归 **feature-001 变更记录 R-007**，本包 T3 执行时同步回写。

**偏差登记**：B-39（选题诊断无公开数据检索通道，盘点缺口 #1，本包登记）；网络现状与开放项见偏差清单及 X-001/X-002。

**溯源标签**：[Design 原有]（§2.6.2 明示的 Agent 行为形态对齐）。

**技术决策指针**：SDG-OD-设计说明.md D1-D7（探测前置 / 仅 showrunner / 检索词脱敏 / 纪念类默认不检索 / 附录承载来源 / 零 Key 优先 / 失败诚实降级）。

### D-002 国内搜索源与全系统代理治理（2026-11-01）

**用户拍板**：按「`web.search` 改国内地址；整个系统跟随操作系统代理；境外服务无法直连时系统提示；本地/局域网 ComfyUI 不受代理破坏」更新规格并实施。

**实测依据**：DuckDuckGo 直连同时存在 DNS 污染、TCP 超时和指定真实 IP 后 TLS reset；经现有局域网代理可返回正常结果。`cn.bing.com` 直连返回正常搜索页及 `b_algo` 结果，零 Key；Playwright 不能修复底层直连路径，不引入浏览器依赖。

**决策**：① 默认搜索源改为 Bing 国内站并同步替换解析器，工具 DTO/白名单不变；② 主进程公网请求使用 Electron `net.fetch`，私网/loopback 使用原生 fetch 强制直连；③ opencode 启动时按 `session.resolveProxy` 注入标准代理环境和 NO_PROXY；④ 连接失败用主进程原生弹窗提示并保留 MCP 错误信封，不新增 IPC；⑤ 任意 URL 不做物理国家识别，仅已知境外域名提供针对性提示。

**卡口**：K1/K9 零触发；K8 不扩面（零新 IPC/DTO/工具）；feature-014 的 ark/manager 零 diff 旧红线由本决策联动修订，feature-808 会话与 SSE 契约零 diff。

---

## T（任务执行）

### T0—T12 已落地实施压缩注（2026-11-20）

T0 定案 B（自建公开检索工具）；T1—T12 已按任务清单完成检索与抓取通道、指令约束、Bing 解析、系统代理/私网直连、失败提示、测试及治理同步。过程命令、逐文件改动和当时测试计数不再复制；现行网络与降级口径以本包需求规格、契约、设计说明和任务清单为准。T6 的商业类 S4 降级与纪念类默认不检索路径已目验，当时 DuckDuckGo 成功路径不可验；后续 Bing 真实页面解析已有实测，Electron 弹窗、应用内检索及商业诊断卡复验仍以 X-001/X-002 的开放项为准，不宣称真机通过。

---

## X（修复）

### X-001 运行时启动 Illegal invocation（resolveProxy 脱 this）（2026-11-01）

**现象**：T8–T12 落地后用户真机反馈「AI 服务不可用：无法连接运行时」，点击横幅「重新检测」无反应；opencode 子进程始终拉不起来。

**根因**：Electron 原生 `session.defaultSession.resolveProxy` 是 Session 对象方法，[network.ts](../../../electron/network.ts) 中 `resolveRuntimeProxyEnv` 与 `publicFetch` 失败分支以脱离对象的方式引用后调用，`this` 绑定丢失，抛 `TypeError: Illegal invocation: Function must be called on an object of type Session`。该错误经 `runtime:start` IPC handler 上抛（主进程日志实证），前端 catch 后仅置横幅，故「重新检测」每次重走同一失败路径。

**修复**：两处默认代理解析均改为箭头函数包裹、在 `session.defaultSession` 上调用：
`resolver = (url) => session.defaultSession.resolveProxy(url)`；`publicFetch` catch 内同样直接 `await session.defaultSession.resolveProxy(url)`。注入式 `resolveProxy`/`netFetch` 路径与其余行为零 diff。

**测试**：[network.test.ts](../../src/test/network.test.ts) 的 electron mock 增加真实 `this` 绑定校验（脱 Session 调用即抛 Illegal invocation），新增回归用例「公网 provider 不注入 resolver 时默认经 defaultSession.resolveProxy 解析（不脱 this）」，共 20 测全绿；`npx tsc -p tsconfig.node.json` 重建声明 0 退出；typecheck 恰 3 条存量基线零新增；重启 dev 后 electron=5、opencode 子进程正常拉起；全量回归 **76 文件 / 922 passed / 0 failed / 1 skipped**（较 T8–T12 的 921 净增 1 个回归用例）。

**遗留**：应用内 web.search 与横幅消失的真机目验待用户桌面确认；不提交 Git。

### X-002 搜索源 cn.bing.com 失效（JS 壳页）与模型臆造 URL（B-58）（2026-11-01）

**现象**：用户真机走商业短剧立项（都市重生复仇题材），`web.search` 返回的内容与短剧赛道完全不相关（Windows 蓝牙故障、高校师资、招聘网站）；AI 却在诊断卡中声称命中红果 / 七猫 / 爱奇艺短剧 / 黄果 / 野果等平台真实结果，并列出多个平台官网域名；同时把「让我换个词再试」「我按 S4 诚实降级」等内心独白写进正文。

**根因（实测）**：
1. `cn.bing.com` 对非浏览器请求（本工具 UA）仅返回约 15KB 的 JS 壳页（HTTP 200、`LEN=15121`、`b_algo=0`、无 `b_results`，仅 `sb_form` + `location.href` 跳转脚本），解析器自然得到 0 条；旧实现把 0 条当正常空数组返回，不触发 S4 降级。
2. 模型在弱 / 空结果下凭平台名臆造域名——DNS 实证 `hongguoduanju.com`、`duanjuapp.cn`、`yeguodj.com.cn` 均无 A 记录；原 S4 仅禁「编造 URL」但未规定「URL 必须逐字来自工具返回」。
3. 对照实测 `www.bing.com`（`LEN=122334`，`b_algo=10`）、百度、DuckDuckGo html 均可达。

**修复（用户拍板「工具 + 提示词全修」，不建包直接修）**：
1. 工具层 [tools.ts](../../../electron/mcp/tools.ts)：`BING_SEARCH_ENDPOINT` 由 `https://cn.bing.com/search` 改为 `https://www.bing.com/search`（`parseBingResults` 零改动，结构兼容），URL 增 `&setlang=zh-CN`；解析 0 条一律抛 `WEB_SEARCH_FAILED`（不再回空数组冒充成功），确保触发 S4 诚实降级。
2. 提示词层 [showrunner.md](../../../resources/opencode/agents/showrunner.md) S4 扩为四子项：弱 / 不相关结果时对标 / 钩子两块降级并逐块标注「（自身推理，无检索支撑）」；**引用 URL 必须逐字来自工具返回 results，严禁按平台名臆造域名**；严禁虚构检索命中；内心独白只属内部推理、不进正文。
3. 测试联动 [web-tools.test.ts](../../src/test/mcp/web-tools.test.ts)：正常路径端点断言改 `www.bing.com ... &setlang=zh-CN`；新增「解析 0 条（空结果页 / JS 壳页）→ WEB_SEARCH_FAILED」用例。

**验证**：以工具真实 UA 实测新端点 `www.bing.com/search?q=...&setlang=zh-CN` 返回 `LEN=118741`、`b_algo=10`；typecheck 恰 3 条存量基线零新增；全量回归 **76 文件 / 951 passed / 0 failed / 1 skipped**（较 X-001 后 950 净增 1 例）。K1 / K8 / K9 零触发（工具 DTO、白名单、依赖均不变）；规格书 AC7 / 契约原文按治理规则不回改，以本条 X-002 承载。

**遗留**：真机重新走一遍商业短剧立项诊断卡的目验待用户桌面确认；不提交 Git。
