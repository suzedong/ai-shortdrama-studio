# SDG-RE-契约 · feature-006 选题诊断公开数据检索

> **卡口声明（置顶）**：本包 **K1 零触发**（不动 `shared/types.ts`）、**K8 触发**（方案 A：showrunner 请求级工具白名单放行 opencode 内置 web 工具，§2.1；方案 B：自建 `shortdrama_web.*` MCP 工具 25→27，§2.2 探测后补登）、**K9 方案 A 零触发 / 方案 B 须引依赖则停手补登**。T0 探测定案 A/B（D-001 双方案预登，不再重复停手）；除此之外实施中一旦发现必须越界，**立即停手**、回写变更记录并呈报用户裁决。

## 1. 探测契约（T0）

| # | 探测项 | 方法 | 判定 |
|---|---|---|---|
| P1 | opencode-ai 1.18.34 服务端内置工具清单 | 查 node_modules 包内源码/文档（工具注册处） | 存在 web 类工具 → 记实际工具 ID |
| P2 | serve 工具列表 | 起 `opencode serve`，经 SDK/HTTP 列工具 | 内置 web 工具出现在可用列表 |
| P3 | 试跑会话 | 白名单加探测到的工具 ID，起一次 showrunner 会话让其检索 | 可调用且返回真实网页内容/搜索结果 → **定案 A**；任一环节不可用 → **定案 B** |

证据（命令、输出摘要、工具实际 ID）回写变更记录 T0 节。

## 2. 通道契约（K8 登记）

### 2.1 方案 A（主）：白名单放行内置 web 工具

`electron/runtime/provider.ts` `SHOWRUNNER_DECLARED_TOOLS` +N 个内置工具实际 ID（占位名 `webfetch`/`websearch`，以 T0 为准），仅 showrunner 一组放行；`writer`/`media-director`/`comfyui-operator` 三组零 diff。注释按既有格式记 feature-006 沿革。非新 MCP 工具——Agent 请求级工具面变更，按 K8 登记（本节约束即工具契约）。

### 2.2 方案 B（现行）：自建 MCP 工具 + 国内搜索源

- **工具 26 `web.search`**：DTO 保持 `{ query } → { results: [{ title, url, snippet }] }`。搜索源改为 Bing 国内站 `https://cn.bing.com/search?q=`（零 Key，K9 零触发）；解析 `b_algo` 区块内 h2/a 标题与直链、配对同区块摘要，仅放行 http/https，至多 8 条；网络/HTTP/验证页失败报 `WEB_SEARCH_FAILED`；`query` 空报 `INVALID_ARGUMENT`；正常无结果页允许返回空数组。
- **工具 27 `web.fetch`**：DTO 与正文提取规则不变；仅 http/https，超 `WEB_FETCH_MAX_CHARS=20000` 截断；失败报 `WEB_FETCH_FAILED`；非 http/https 报 `INVALID_ARGUMENT`。
- **实现**：`electron/mcp/tools.ts` 保留 `fetchImpl` 注入与 handler 薄壳，`parseDdgResults` 更名为 `parseBingResults`；生产默认请求改走 `electron/network.ts` 的代理感知 `publicFetch`，测试仍全 mock 零外网。工具数、DTO、showrunner 白名单均零 diff。

### 2.3 系统代理、直连与失败提示（2026-11-01 用户批准）

1. **主进程公网请求**：`web.search`、`web.fetch` 与 `electron/ark.ts` 统一走 `publicFetch`。公网地址使用 Electron `net.fetch`，由 Chromium 网络栈遵循操作系统代理/PAC/绕过规则；不得用 renderer 请求替代。
2. **强制直连**：loopback、localhost、私有/链路本地 IP、`.local` 与单标签主机名使用 Node 原生 fetch，不经代理。该判定覆盖 ComfyUI、LM Studio、opencode/MCP 等本地或局域网地址；运行时健康检查、SDK 与 SSE 保持原生直连零 diff。
3. **opencode 子进程**：启动前经 `session.defaultSession.resolveProxy(当前公网 provider URL)` 取操作系统判定；`DIRECT` 时清除继承的代理变量，代理时注入 `HTTP_PROXY`/`HTTPS_PROXY`；始终覆写 `NO_PROXY`，包含 loopback、常见私网网段和当前本地 provider 主机。spawn 参数不变。
4. **失败提示**：公网连接异常由主进程原生 `dialog.showMessageBox` 提示，零新 IPC。已知境外服务直连失败时提示启用操作系统代理；代理解析非 DIRECT 仍失败时提示检查代理节点/绕过规则。任意 URL 只报告实际网络错误和代理解析状态，不声称识别物理国家。
5. **错误可审计**：原生提示不替代 MCP 既有错误信封；Agent 仍按 S4 诚实降级。提示不得含 API Key、口令或完整敏感响应。

## 3. 指令层契约（showrunner.md step 3 修订）

| # | 规则 | 契约 |
|---|---|---|
| S1 | 检索触发 | 商业类：step 3 产出诊断卡前**先检索**（五区块中「对标案例/钩子模式」须基于检索结果）；纪念类：**默认不检索**，用户明示要求才检索 |
| S2 | 检索词构造 | 仅口径题材类型维度字段值（genre/platforms/tone/episodeDuration/episodeCount/aspectRatio）+ 泛化赛道词；**禁用** leads/coreEvent 原文、用户逐字原话、姓名/地名等私密细节 |
| S3 | 来源标注 | 诊断卡五区块结构不变，卡尾附「检索来源」：检索词列表 + 来源 URL 列表 + 检索日期（YYYY-MM-DD）；未检索时显式标注「本次未联网检索（原因：纪念类弱化 / 检索不可用）」 |
| S4 | 失败降级 | 检索工具不存在/调用失败 → 能力诚实（纪律 6）：明示后降级自身推理，附录按 S3 标注未检索，**不编造 URL** |
| S5 | 回写 | 修订属指令层既有文件改动，按先例归 feature-001 变更记录 **R-007** |

## 4. 最小 diff 描述（含 2026-11-01 网络治理）

- **新增**：`electron/network.ts`（系统代理感知公网请求、私网直连、代理解析与原生提示）；`src/test/network.test.ts`（纯策略与 mock 测试）。
- **修改**：`electron/mcp/tools.ts`（Bing + publicFetch）、`electron/ark.ts`（publicFetch）、`electron/main.ts`（启动前解析当前 provider 代理）、`electron/runtime/manager.ts`（子进程代理环境）、`src/test/mcp/web-tools.test.ts`、`src/test/ark.test.ts`、`src/test/runtime/runtime-manager.test.ts`。
- **文档**：本包五文件；feature-014 契约/变更记录联动。feature-808 零 diff。
- **零 diff 红线**：`shared/types.ts`、`electron/preload.ts`、`src/global.d.ts`、renderer 生产代码、Agent 工具 DTO/白名单、spawn 参数、`package.json`/lockfile。

## 5. 测试契约（含网络治理）

- `src/test/mcp/web-tools.test.ts`：Bing fixture 的标题/直链/摘要配对、无效链接剔除、8 条上限、空结果与验证页、endpoint/query、原错误信封；全部 fetch mock 零外网。
- `src/test/network.test.ts`：公网走 Electron net.fetch、私网走原生 fetch、DIRECT/PROXY/SOCKS 解析、NO_PROXY、境外/未知地址失败文案与原生通知；Electron 动态 import 全部 mock。
- `src/test/runtime/runtime-manager.test.ts`：子进程代理变量注入/清除、NO_PROXY 与秘密边界；健康检查仍使用注入的原生 fetch。
- `src/test/ark.test.ts`：保留动态配置断言，公网请求通道可 mock。
- **回归红线**：typecheck 仅 3 条历史基线零新增；全量 failed=0、passed 不减少、skip 不增；node/preload 构建退出 0。

## 6. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| T0 探测发现内置工具 ID 与占位名不同 | 以实际 ID 实施，回写变更记录（已在 D-001 预登范围内，不停手） |
| T0 定案 B，且搜索源须 Key 或新依赖 | K9 触发 → 停手补登，呈报用户 |
| 探测发现需改 opencode provider 配置才能用内置工具（如自定义 provider 屏蔽内置工具） | 配置变更超白名单 → 停手呈报 |
| 需要给其余三组 agent 放行检索 | 越出契约 → 停手呈报（现状评估：不做，诊断是主控专属职责） |
| 需要检索结果结构化落盘 / renderer 展示 | 设计演进项 → 停手呈报（现状评估：不做，诊断卡文本承载） |
