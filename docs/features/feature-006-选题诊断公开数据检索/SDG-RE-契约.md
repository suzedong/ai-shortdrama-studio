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

### 2.2 方案 B（降级）：自建 MCP 工具（T0 定案 B，本节已补登填实）

- **工具 26 `web.search`**：`{ query } → { results: [{ title, url, snippet }] }`。搜索源 = DuckDuckGo html 端点 `https://html.duckduckgo.com/html/?q=`（零 Key 公开源，K9 零触发）；解析 `result__a` 链接（`uddg` 重定向解码、仅放行 http/https）配对同区块 `result__snippet` 摘要；至多 8 条；网络/HTTP 失败报 `WEB_SEARCH_FAILED`；`query` 空报 `INVALID_ARGUMENT`。
- **工具 27 `web.fetch`**：`{ url } → { text }`。仅 http/https；HTML→正文文本（去脚本/样式/注释/标签 + 实体解码 + 空白折叠）；超 `WEB_FETCH_MAX_CHARS=20000` 截断；失败报 `WEB_FETCH_FAILED`；非 http/https 报 `INVALID_ARGUMENT`。
- **实现**：`electron/mcp/tools.ts` 尾部导出纯函数（`decodeHtmlEntities`/`htmlToText`/`parseDdgResults`/`webSearch`/`webFetchText`，`fetchImpl` 依赖注入供单测零外网）+ handler 薄壳；常量 `WEB_UA`/`WEB_TIMEOUT_MS=15000`/`WEB_FETCH_MAX_CHARS`。主进程原生 fetch（Node 22 全局），**零新依赖**，不依赖激活项目。showrunner 白名单 +2（`shortdrama_web.search`/`shortdrama_web.fetch`），其余三组 agent 零 diff。

## 3. 指令层契约（showrunner.md step 3 修订）

| # | 规则 | 契约 |
|---|---|---|
| S1 | 检索触发 | 商业类：step 3 产出诊断卡前**先检索**（五区块中「对标案例/钩子模式」须基于检索结果）；纪念类：**默认不检索**，用户明示要求才检索 |
| S2 | 检索词构造 | 仅口径题材类型维度字段值（genre/platforms/tone/episodeDuration/episodeCount/aspectRatio）+ 泛化赛道词；**禁用** leads/coreEvent 原文、用户逐字原话、姓名/地名等私密细节 |
| S3 | 来源标注 | 诊断卡五区块结构不变，卡尾附「检索来源」：检索词列表 + 来源 URL 列表 + 检索日期（YYYY-MM-DD）；未检索时显式标注「本次未联网检索（原因：纪念类弱化 / 检索不可用）」 |
| S4 | 失败降级 | 检索工具不存在/调用失败 → 能力诚实（纪律 6）：明示后降级自身推理，附录按 S3 标注未检索，**不编造 URL** |
| S5 | 回写 | 修订属指令层既有文件改动，按先例归 feature-001 变更记录 **R-007** |

## 4. 最小 diff 描述

- **修改（方案 A，≤3）**：`electron/runtime/provider.ts`（白名单 +N）、`resources/opencode/agents/showrunner.md`（step 3 修订）、`src/test/agent-profiles.test.ts`（真键表扩表）；方案 B 追加：`electron/mcp/tools.ts`（+2 工具，25→27）、`src/test/` 增 1 工具测试文件；
- **文档（4）**：本包 5 文件、`docs/features/README.md`（增 006 行）、`docs/设计现状与偏差清单.md`（B-39 登记）、`docs/features/feature-001-立项模型重建/SDG-AI-变更记录.md`（R-007 回写）、`版本记录.md`（增行）；
- **零 diff 红线**：`shared/types.ts`、`electron/brief/*`、`electron/gate/*`、`electron/canvas/*`、`electron/main.ts`、`electron/preload.ts`、`src/**`（除测试与既有静态契约测试扩表）、`package.json`（方案 A）。

## 5. 测试契约

- `src/test/agent-profiles.test.ts`（既有文件）：物理工具真键表随白名单正当扩表（工具面变更的对应更新，同 feature-005 工具数 22→25 时先例），showrunner 含检索工具 ID、其余三组不含；
- 方案 B 追加：`src/test/web-tools.test.ts`（新，恰净增 1）——search/fetch 形状、错误信封、不依赖激活项目；
- **回归红线**：typecheck 仅 3 条历史基线零新增；全量以 T1 实测基线（上包收尾 53 文件 586 passed / 0 failed / 1 skipped）为准——passed 不减少、skip 不增、测试文件净增 0（方案 A）/ 恰 1（方案 B）。

## 6. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| T0 探测发现内置工具 ID 与占位名不同 | 以实际 ID 实施，回写变更记录（已在 D-001 预登范围内，不停手） |
| T0 定案 B，且搜索源须 Key 或新依赖 | K9 触发 → 停手补登，呈报用户 |
| 探测发现需改 opencode provider 配置才能用内置工具（如自定义 provider 屏蔽内置工具） | 配置变更超白名单 → 停手呈报 |
| 需要给其余三组 agent 放行检索 | 越出契约 → 停手呈报（现状评估：不做，诊断是主控专属职责） |
| 需要检索结果结构化落盘 / renderer 展示 | 设计演进项 → 停手呈报（现状评估：不做，诊断卡文本承载） |
