# SDG-OD-设计说明 · feature-006 选题诊断公开数据检索

## 1. 落点架构

```
创作者（立项对话）
  └ showrunner 第 0 步 step 3（选题诊断）
      ├ 读口径：capture.list（feature-005 已落盘的事实源）
      ├ 组检索词：仅题材类型维度 + 泛化赛道词（S2 脱敏纪律）
      ├ 检索通道（K8，二选一，T0 定案）：
      │   方案 A ─ opencode 服务端内置 web 工具
      │             （SHOWRUNNER_DECLARED_TOOLS 白名单放行，仅 showrunner 一组）
      │   方案 B ─ shortdrama_web.search/fetch（自建 MCP 工具 25→27，主进程原生 fetch）
      ├ 产出诊断卡：五区块（§2.6.2 结构不变）+ 卡尾「检索来源」附录（S3）
      └ 落盘：随既有 diagnosisDetail 机制入立项单（D-018，零新代码）

公网边界（§12）：检索词带题材关键词出公网——脱敏纪律兜底；文本侧火山方舟通道不变；媒体侧零公网红线不触及。
```

- **纯 Agent 面变更**：零 renderer、零 IPC、零 shared/types.ts、零 brief/gate/canvas diff；平台侧唯一代码改动是白名单（方案 A）或工具注册（方案 B）。
- **隐私三道闸**：①检索词脱敏（S2，构造层）；②纪念类默认不检索（S1，触发层）；③来源标注可审计（S3，产物层）。

## 2. 关键决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | 探测前置双方案，T0 定案 | `@opencode-ai/sdk` 客户端类型层无 webfetch/websearch 定义，服务端内置工具可用性未证实——不臆造；D-001 双方案预登 K8，定案 B 不停手重报，契约定补登节 |
| D2 | 仅 showrunner 放行 | 选题诊断是主控 Agent 第 0 步专属职责（§2.6.2）；writer/media-director/comfyui-operator 无检索场景，最小工具面 |
| D3 | 检索词仅题材类型维度，禁 leads/coreEvent 原文 | §12 隐私边界：现平台出公网仅火山方舟；检索外扩必须最小化带出信息。题材类型（甜宠/抖音/竖屏）是公开泛化词，leads/coreEvent 是用户私密创作内容 |
| D4 | 纪念类默认不检索 | 设计书 §2.6.2 原口径「纪念：弱化…直接判可做」+ 纪念类涉私人记忆，私密性最强；用户明示要求才检索 |
| D5 | 来源标注为卡尾附录，五区块结构不动 | 设计书五区块是产物结构，来源是追溯元数据——附录承载可追溯（可证伪、可审计），不侵入结构；随 diagnosisDetail 既有机制落盘（D-018），零新代码 |
| D6 | 方案 B 零 Key 优先 | 媒体零公网、无 Key、无按次云费是 v1.7 终局红线精神；搜索源须 Key/新依赖即停手补登 K9 |
| D7 | 检索失败能力诚实降级，不编造 URL | showrunner 纪律 6 能力诚实的检索场景具体化；「未联网检索」附录标注保证产物可审计 |

## 3. 文件白名单

**新增（0 / 方案 B 恰 1）**：方案 B 时 `src/test/web-tools.test.ts`
**修改（方案 A ≤3 / 方案 B ≤5）**：`electron/runtime/provider.ts`、`resources/opencode/agents/showrunner.md`、`src/test/agent-profiles.test.ts`；方案 B 追加 `electron/mcp/tools.ts`、`src/test/agent-profiles.test.ts`（同文件不重复计）
**文档（5）**：本包 5 文件、`docs/features/README.md`、`docs/设计现状与偏差清单.md`（B-39）、`docs/features/feature-001-立项模型重建/SDG-AI-变更记录.md`（R-007）、`版本记录.md`
**零 diff 红线**：`shared/types.ts`、`electron/brief/*`、`electron/gate/*`、`electron/canvas/*`、`electron/main.ts`、`electron/preload.ts`、`src/**`（测试与静态契约测试扩表除外）、`package.json`（方案 A）

## 4. 风险与边界

| 风险 | 缓解 |
|---|---|
| opencode 内置工具不可用/行为不符 | T0 三步探测前置定案，降级方案 B 预登；试跑会话（P3）为最终判据 |
| 检索结果质量不可控（SEO 垃圾/营销号） | 诊断卡是 Agent 综合判断产物非数据直贴；来源 URL 标注使低质来源可被发现与追问 |
| 检索词脱敏靠提示词纪律，无代码强制 | 同既有「能力诚实/模型纪律」同级——指令层约束 + 产物附录可审计（检索词显式列出，违规可见）；代码层强制过滤属过度设计（检索词构造是开放语义） |
| 公网检索引入新合规面 | 仅 GET 公开页面/搜索结果，无账号无 Cookie；检索词脱敏；纪念类默认关闭 |
