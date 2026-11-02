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

**偏差登记**：B-39（选题诊断无公开数据检索通道，盘点缺口 #1，本包登记，T7 落入偏差清单）。

**溯源标签**：[Design 原有]（§2.6.2 明示的 Agent 行为形态对齐）。

**技术决策指针**：SDG-OD-设计说明.md D1-D7（探测前置 / 仅 showrunner / 检索词脱敏 / 纪念类默认不检索 / 附录承载来源 / 零 Key 优先 / 失败诚实降级）。

### D-002 国内搜索源与全系统代理治理（2026-11-01）

**用户拍板**：按「`web.search` 改国内地址；整个系统跟随操作系统代理；境外服务无法直连时系统提示；本地/局域网 ComfyUI 不受代理破坏」更新规格并实施。

**实测依据**：DuckDuckGo 直连同时存在 DNS 污染、TCP 超时和指定真实 IP 后 TLS reset；经现有局域网代理可返回正常结果。`cn.bing.com` 直连返回正常搜索页及 `b_algo` 结果，零 Key；Playwright 不能修复底层直连路径，不引入浏览器依赖。

**决策**：① 默认搜索源改为 Bing 国内站并同步替换解析器，工具 DTO/白名单不变；② 主进程公网请求使用 Electron `net.fetch`，私网/loopback 使用原生 fetch 强制直连；③ opencode 启动时按 `session.resolveProxy` 注入标准代理环境和 NO_PROXY；④ 连接失败用主进程原生弹窗提示并保留 MCP 错误信封，不新增 IPC；⑤ 任意 URL 不做物理国家识别，仅已知境外域名提供针对性提示。

**卡口**：K1/K9 零触发；K8 不扩面（零新 IPC/DTO/工具）；feature-014 的 ark/manager 零 diff 旧红线由本决策联动修订，feature-808 会话与 SSE 契约零 diff。

---

## T（任务执行）

### T0 探测定案（2026-10-19）——**定案 B**

| 探测项 | 方法 | 证据 |
|---|---|---|
| P1 | 查包内源码 | `node_modules/opencode-ai` 仅 `bin/opencode.exe` 编译产物（无 JS 源码可 grep）；`@opencode-ai/sdk` 1.18.34 dist 类型层 grep `webfetch\|websearch` 零匹配——客户端类型未内置 |
| P2 | 起 serve 列工具 | `opencode.exe serve --port 4599` → `GET /experimental/tool/ids` 返回 `["invalid","question","bash","read","glob","grep","edit","write","task","webfetch","todowrite","websearch","skill","apply_patch"]`——**webfetch/websearch 在内置 ID 清单**（与占位名一致） |
| P3 | 试跑会话 | 复刻运行时环境（XDG_CONFIG_HOME 探针目录 + 生成的 opencode.json ark provider + showrunner profile 渲染安装 + Basic 口令，cwd=仓库根；探针结束即销毁含 Key 临时目录）：POST /session → POST /session/{id}/message（agent=showrunner，model=ark/ARK_MODEL，`tools:{webfetch:true,websearch:true}`）→ 消息 parts 实证 `part.type=tool tool=webfetch state=completed`（抓取 https://example.com 返回真实 title「Example Domain」）；**websearch 无任何工具调用 part**，模型自述可用工具仅 webfetch/task/skill |

**补充取证**：opencode 官方文档（opencode.ai/docs/tools）——websearch 仅当使用 OpenCode/OpenCode Go provider、或设 `OPENCODE_ENABLE_EXA` / `OPENCODE_ENABLE_PARALLEL` 真值时可用；Exa/Parallel 均须外部 API Key。**结论**：方案 A 完整形态须外部 Key，违反契约 §2.2「零 Key 优先」边界 → **定案 B**（自建 `shortdrama_web.search/fetch`，MCP 25→27，主进程原生 fetch 零新依赖，K9 零触发）。契约 §2.2 已补登填实。

**附带发现**：请求级 `tools:{webfetch:true}` 可覆盖 profile frontmatter `webfetch: false`（P3 实证调用 completed）——本机制留痕备查，本包不使用（定案 B 不经内置工具）。

### T1 基线实测冻结（2026-10-19）

- `npx tsc --noEmit`：**恰 3 条历史基线**（canvas-zoom.test.tsx ×2 + runtime-client.test.ts ×1），零新增。
- `npm run test:run`：**53 文件 586 passed / 0 failed / 1 skipped**（587 总），Duration 56.76s。
- 本基线供 feature-006 与 feature-810 两包共用（同日同刻实测）。

### T2 通道落地（2026-10-20）——方案 B

按 T0 定案 B 与契约 §2.2（已补登填实）落地，最小 diff 4 文件：

1. `electron/mcp/tools.ts`：+2 工具（25→27）——26 `web.search`（DuckDuckGo html 端点零 Key，`uddg` 解码 + `result__snippet` 配对，至多 8 条，失败 `WEB_SEARCH_FAILED`）、27 `web.fetch`（仅 http/https，HTML→正文，超 20000 字符截断，失败 `WEB_FETCH_FAILED`）；尾部导出纯函数 `decodeHtmlEntities`/`htmlToText`/`parseDdgResults`/`webSearch`/`webFetchText`（`fetchImpl` 依赖注入，供 T4 单测零外网）；常量 `WEB_UA`/`WEB_TIMEOUT_MS=15000`/`WEB_FETCH_MAX_CHARS=20000`；头注释 25→27 + feature-006 沿革；主进程原生 fetch（Node 22 全局），**K9 零新依赖**。
2. `electron/runtime/provider.ts`：`SHOWRUNNER_DECLARED_TOOLS` +2（`shortdrama_web.search`/`shortdrama_web.fetch`，20→22）+ feature-006 沿革注释；其余三组 agent 零 diff。
3. `resources/opencode/agents/showrunner.md`：frontmatter tools 段 +2（`shortdrama_web.search: true`/`shortdrama_web.fetch: true`）；step 3 正文修订属 T3。
4. `src/test/mcp-pure-tools.test.ts`：静态护栏 25→27（工具名清单 + 计数 + 测试名），feature-005 22→25 先例的对应更新。

**验证**：`npx tsc --noEmit` 恰 3 条历史基线零新增；`npx vitest run src/test/mcp-pure-tools.test.ts` 3 passed（计数 27 实证）。**预期中间态**：`agent-profiles.test.ts` 点号白名单未扩表，此刻起红——契约 §5 预登的正当扩表由 T4 执行，T5 全量回归收口。

### T3 指令层修订（2026-10-20）

1. `resources/opencode/agents/showrunner.md` step 3（节点① 选题诊断）：段落尾追加「诊断卡须含公开数据检索（feature-006），四条规则」子列表——S1 检索触发（商业类「对标案例」「钩子模式」两块必须先检索，调 `shortdrama_web.search` / 必要时 `shortdrama_web.fetch`；纪念类默认不检索、用户明示才检索）/ S2 检索词脱敏（仅 genre/platforms/tone/episodeDuration/episodeCount/aspectRatio 字段值 + 泛化赛道词；严禁 leads/coreEvent 原文、用户逐字原话、姓名/地名/机构名）/ S3 来源标注（五区块不变，卡尾「检索来源」附录 = 检索词 + URL + 检索日期 YYYY-MM-DD；未检索显式标注原因）/ S4 失败降级（`WEB_SEARCH_FAILED`/`WEB_FETCH_FAILED` → 诚实明示后降级自身推理，严禁编造 URL）。原文「自身推理产出」表述保留（降级路径沿用），「不写文件、不发门」候选态铁律逐字未动。
2. `docs/features/feature-001-立项模型重建/SDG-AI-变更记录.md`：按 D-001 归属约定回写 **R-007**（四段式：原文口径 / 联动修订 / 边界注明 / 交叉指针），边界注明含「附录随既有 diagnosisDetail 机制入立项单（D-018，零新代码）」。

**验证**：showrunner.md 静态锚点自查——纪律 2「自身推理产出」保留、八步行与 feature-802 第 0 步锚点未动、无 `经工具(直接)?(生成|产出)内容` 肯定式表述；`agent-profiles.test.ts` 点号白名单起红仍为 T2 预登中间态（frontmatter 两键），正文提及不构成新断言目标（T4 扩表收口）。

### T4 单测扩表与新增（2026-10-20）

1. `src/test/agent-profiles.test.ts`（契约 §5 预登的正当扩表）：① `TOOLS_TRUE['showrunner.md']` +`shortdrama_web.search`/`shortdrama_web.fetch`（其余三组零 diff）；② 测试名「20 物理工具」→「22 物理工具」；③ 点号白名单 +2 + 测试名追加「feature-006 检索两工具」——T2 预登中间态起红就此收口。
2. `src/test/web-tools.test.ts`（新建，**恰净增 1**）：14 例——parseDdgResults（uddg 解码 / 实体解码 / snippet 配对 / 不可解码剔除 / maxResults 截断 / 空 snippet）、decodeHtmlEntities 与 htmlToText、webSearch（形状 + query 编码 + INVALID_ARGUMENT + WEB_SEARCH_FAILED ×2）、webFetchText（正文抽取 + 截断 + INVALID_ARGUMENT + WEB_FETCH_FAILED ×2）；全部 `fetchImpl` 依赖注入 mock，**零外网、零项目上下文（不依赖激活项目）**。

**验证**：`npx vitest run src/test/web-tools.test.ts src/test/agent-profiles.test.ts src/test/mcp-pure-tools.test.ts`——3 文件 27 passed / 0 failed。

### T5 全量回归（2026-10-20）

- **typecheck**：首轮 `npx tsc --noEmit` 报 web-tools.test.ts ×6 TS2305——非源码问题：`tsconfig.json` 经 project references 把 `electron/*` 导入重定向到 `dist-electron` 的**过期声明产物**（T2 新导出未入 .d.ts）；`npx tsc -b tsconfig.node.json` 重建声明后复跑——**恰 3 条历史基线零新增**（canvas-zoom ×2 + runtime-client ×1）。
- **首轮全量 2 红**：`runtime-client.test.ts`（兜底声明常量 20 个断言）与 `runtime-integration.test.ts`（listAgents 精确清单 20 条）——同属白名单 20→22 工具面变更的正当扩表（feature-005 先例，T4 仅按契约 §5 字面扩了 agent-profiles，此两处为同类漏网点）：前者 20→22 + `shortdrama_web.search` 断言，后者清单尾 +`shortdrama_web.fetch`/`shortdrama_web.search`。两文件定向复绿。
- **终态全量**：`npm run test:run`——**54 文件 600 passed / 0 failed / 1 skipped（601 总）**，Duration 55.84s。对照 T1 基线（53 文件 586 passed / 1 skipped）：测试文件**恰净增 1**（web-tools.test.ts，契约 §5 方案 B），passed 不减少（586→600，+14 全为新文件用例），skip 不增——**回归红线全守（AC5）**。

### T6 真机目验（2026-10-20）

**环境准备**：昨日残留旧 dev 实例（代码早于 T2/T3，无 web 工具）整树清除后 `npm run dev` 重启（Electron pid 36576，opencode serve 随之拉起）；主窗口曾因后台遮挡 Chromium 不绘制白屏，Ctrl+R 重载渲染进程恢复（操作环境注记，非代码问题）。

**商业类路径（AC4）**：新建项目「T006商业检索」（`project-20261020-085643-22cg`），输入「拍一部抖音商业短剧：外卖员逆袭成首富的都市逆袭爽剧」。Agent 识别 commercial 跳过性质反问；UI 工具链可见 `shortdrama_canvas.get` / `shortdrama_brief.list` / `shortdrama_manifest.get` / `shortdrama_capture.upsert`×5 全绿 + **`shortdrama_web.search` ×3 全部返回 WEB_SEARCH_FAILED**。产出选题诊断卡五区块完整：①对标案例（标注「自身知识参照，非本次检索实据」）②用户洞察 ③钩子模式 ④合规要点 ⑤结论 ✅可做。卡尾「检索来源」附录全文：「本次未联网检索（原因：检索源不可用，WEB_SEARCH_FAILED × 3）。检索词（未成功）：「都市逆袭爽剧 抖音 爆款短剧 对标案例」「外卖员逆袭 短剧 爆款」「逆袭短剧 爽点 钩子 前6集 充值」。日期：2026-10-20。」

**纪念类路径（AC6）**：新建项目「T006纪念不检索」（`project-20261020-090349-tjru`），输入「想给去世的奶奶拍一部个人纪念短片，温暖怀旧风，自己留念用」。Agent 识别 memorial 不反问性质；产出「纪念类初判（弱化诊断）」：结论可做无合规门槛 + 风格参考（明示不做对标检索）；已落库口径 5 条；继续反问 4 个奶奶生平问题。附录：「本次未联网检索（原因：纪念类弱化，按流程默认不检索）」。

**隐私四道闸核验**：

- **S1 触发边界**：商业类真实触发检索（工具链 `shortdrama_web.search` ×3 UI 可见）；纪念类默认不检索——响应全文自证「不做对标检索」+ 附录标注原因，且同环境商业类对照组证明工具可用时必被调用（负面证据补取说明：opencode serve 会话存储物理定位失败——Roaming opencode-data 仅 log/repos、~/.local/share 不存在、Roaming/Local 深搜 ses_* 无果、serve 有随机密码不可直连 API——按 feature-005 先例以正面证据链定稿）。
- **S2 检索词脱敏**：三条检索词全部为题材类型维度 + 泛化赛道词，零 leads/coreEvent 原文、零用户逐字原话、零姓名/地名/机构名。
- **S3 来源标注**：两路径卡尾均有「检索来源」附录，含检索词 + 检索日期（YYYY-MM-DD）；未检索显式标注原因。
- **S4 失败降级**：`WEB_SEARCH_FAILED` ×3 后诚实明示「自身知识参照，非本次检索实据」，零编造 URL。

**环境发现（留痕）**：方案 B 的 DuckDuckGo html 端点在本机网络环境不可达，**检索成功路径真机不可验**——成功路径已由 T4 单测覆盖（web-tools.test.ts 14 例，`fetchImpl` 依赖注入 mock，零外网）；S4 降级路径因此获得真实触发验证（非演练）。

**截图存证**：按 feature-005 先例，截图经 computer-use MCP 内联返回不落盘；证据链对应 temp 目录 `c:\Users\SZD\AppData\Local\Temp\trae\computer-use\20261019\screenshots\` 下 win-sdk-*.jpg（41 张），关键张：win-sdk-ad31b84d（商业类工具链 shortdrama_web ×3 WEB_SEARCH_FAILED）、win-sdk-0d35500a（诊断卡①对标案例诚实标注）、win-sdk-3ae49e22（⑤结论 + 检索来源附录全文）、win-sdk-3ad86529 / win-sdk-96c40aa8（纪念类弱化诊断 + 不检索附录）。

**结论**：AC4/AC6 目验通过。

### T8–T12 国内搜索源与系统代理治理实施（2026-11-01）

按 D-002 实施，最小 diff：

1. **新增 [network.ts](../../../electron/network.ts)**：`publicFetch`（公网 Electron `net.fetch` 走系统代理/PAC/绕过；loopback、RFC1918、链路本地、IPv6 ULA/链路本地、`.local`、单标签主机名走原生 fetch 强制直连）；`shouldDirectFetch` / `proxyUrlFromResolve`（PROXY/HTTPS/SOCKS4/SOCKS5 → 标准代理 URL，DIRECT → null）/ `buildNoProxy` / `resolveRuntimeProxyEnv` / `networkFailureMessage`。Electron 一律动态 import，纯策略函数可在裸 Node/Vitest 运行。
2. **[tools.ts](../../../electron/mcp/tools.ts)**：`parseDdgResults` → `parseBingResults`（`li.b_algo` 区块 h2/a 标题直链 + 同区块首个 `<p>` 摘要，仅 http/https，默认上限 8）；端点改 `https://cn.bing.com/search?q=`；新增人机验证页识别（`b_captcha`/g-recaptcha/hcaptcha/异常流量 → WEB_SEARCH_FAILED）；补 `ensp`/`emsp` 实体；`webSearch`/`webFetchText` 默认 fetch 改 `publicFetch`，注入式测试签名不变；工具 DTO 与白名单零 diff。
3. **[ark.ts](../../../electron/ark.ts)**：原生 fetch → `publicFetch`，鉴权、请求体与错误语义不变。
4. **[main.ts](../../../electron/main.ts)**：`ensureRuntime` 按当前 provider（lmstudio/ark）URL 调 `resolveRuntimeProxyEnv`，结果随 `proxyEnv` 传入 `runtimeManager.start`。
5. **[manager.ts](../../../electron/runtime/manager.ts)**：`StartRuntimeOptions` 增 `proxyEnv`；`buildChildEnv` 先清除继承的大小写 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY，再按解析结果覆写大写变量；NO_PROXY 始终覆盖；loopback 健康检查继续用注入的原生 fetch；spawn 参数零 diff。

**失败提示**：仅公网连接异常（非 HTTP 状态码）触发原生 `dialog.showMessageBox`；文案含实际错误、系统代理状态（未启用 DIRECT / 已启用 + URL）；代理仍失败 → 检查节点/端口/绕过规则；DIRECT 且命中已知境外域名清单（DuckDuckGo/Google/OpenAI/GitHub 等）→ 启用代理指引；任意 URL 不断言物理国家；Bearer/api_key/token/password 脱敏。MCP 工具仍返回原错误信封。

**测试**：新增 [network.test.ts](../../src/test/network.test.ts) 19 测；web-tools 改 Bing fixture 15 测；runtime-manager 增代理环境测试（19 测）；ark 5 测；定向 58/58 绿。全量回归 **76 文件 / 921 passed / 0 failed / 1 skipped**；`tsc -p tsconfig.node.json`、`tsc -p tsconfig.preload.json` 均 0 退出；typecheck 恰 3 条存量基线（canvas-zoom ×2、runtime-client ×1）零新增。

**真机实测**：`cn.bing.com/search?q=短剧` 直连返回 97857 字节 / 10 个 `b_algo` / 无验证页；生产解析器对真实页面得 8 条有效直链（爱奇艺、黄果 AI、七猫等），标题/URL/摘要配对且实体正确解码。境外 DIRECT/代理失败与私网直连文案由 network.test.ts 注入式覆盖；Electron 桌面真机弹窗目验留待用户桌面验收。

**红线复核**：package.json、package-lock.json、shared/types.ts、preload/IPC/DTO、spawn 参数、Agent 白名单零 diff；feature-014 联动登记 D-023。

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
