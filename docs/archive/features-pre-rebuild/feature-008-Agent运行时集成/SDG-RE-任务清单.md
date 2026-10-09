# SDG-RE 任务清单 · feature-008 Agent 运行时集成（opencode 基座）

> 版本：v1.2 已批准（2026-10-04；D-SCOPE-1~5 已拍板，D-006~D-010 已落账；媒体通道终局见 D-010——三类媒体全部经本地/局域网 ComfyUI）
> 日期：2026-10-04
> 前置：feature-001 ~ 007 已定稿；本 Feature 采用绞杀者模式，旧通道全部保留。
> 卡口状态：**K9 已签字**（`opencode-ai` / `@opencode-ai/sdk` 精确 `1.18.34`，D-003/D-006）、**K6 已签字**（D-001）、**K8/K3 已签字**（新增 `runtime:*` 12+2 通道、旧签名不动，D-004）、**K7 媒体通道口径已签字**（D-005/D-007/D-009/D-010）。
> **不改 `shared/`（K1 不触发）。**

## 0. 上下文加载清单（工作围栏，逐项读取）

- [ ] `AGENTS.md`
- [ ] `短剧Agent平台设计.md`（§0.1 原则、§4 opencode 运行时、§5 MCP 网关、§10/§11）
- [ ] `docs/research/MiniMax Design功能与架构参考.md`（§2.1 架构事实）
- [ ] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`、`SDG-AI-变更记录.md`（D-001 ~ D-005）
- [ ] `package.json`（K9 核对：当前无 opencode 依赖）
- [ ] `electron/main.ts`（现有 27 个 ipcMain.handle 清单，确保隔离）
- [ ] `electron/preload.ts`（现有 api 暴露，新增 runtime 命名空间）
- [ ] `electron/ark.ts`（ARK_API_KEY 加载方式，复用不重写）
- [ ] `mcp/server.ts`（现有未接入骨架，仅了解边界，本期不改）
- [ ] `shared/types.ts`（只读；确认不新增不改）
- [ ] 运行实例的 `/doc`（OpenAPI 3.1）——T5 实现时作为最终核对源

> 禁止读取与修改清单以外文件，除非任务执行明确需要（如对应测试文件、既有测试夹具）。

## 1. 签字前置（已完成）

- [x] P1 用户对 D-SCOPE-1 ~ D-SCOPE-5 逐项拍板（2026-10-04，AskUserQuestion；结论见需求规格 §6 与 D-006~D-008）
  - D-SCOPE-1 媒体通道终局（D-010 三次裁决）：qwen-image 图像 / H3 视频 / Music3 音乐**全部本地/局域网权重经 ComfyUI 推理（纯局域网、媒体零公网）**；已完成《设计.md》v1.7 与 AGENTS.md Reverse Sync（D-007→D-009→D-010 轨迹保留）
  - D-SCOPE-2 二进制经 npm 包 `opencode-ai` 获取（K9 已签字，D-003/D-006）
  - D-SCOPE-3 动态端口（4096 起探测，仅 loopback；D-008）
  - D-SCOPE-4 随机内存口令（不落盘；D-008）
  - D-SCOPE-5 mock provider（D-008）
- [x] P2 精确版本锁定：`opencode-ai@1.18.34` 与 `@opencode-ai/sdk@1.18.34`，**D-006 已追加**（K9 永久决策）；T1 安装依赖的前置已满足（用户指定本轮不安装，开工另候指令）

## 2. 原子任务

### T1 · 依赖与二进制通道（K9）

- [ ] T1-1 `package.json` 加入 **精确版本 `1.18.34`** 的 `opencode-ai`、`@opencode-ai/sdk`（D-006，禁止 `^`/`~`/浮动）
- [ ] T1-2 安装并确认二进制解析方式：`opencode-ai` launcher（bin/opencode.exe）+ 同版本平台 optionalDependency（opencode-darwin/windows/linux-*）；封装单一解析函数按 process.platform/arch 供 manager 调用
- [ ] T1-3 输出打包期分发方案说明（electron-builder `extraResources` 携带 + 按平台选择），**仅落变更记录实施注，不在本期配置 builder**

### T2 · DTO 与类型镜像（零共享层改动）

- [ ] T2-1 新增 `electron/runtime/types.ts`：RuntimeStatus / RuntimeErrorBody / RuntimeSession / RuntimePromptRequest / RuntimePromptResult / RuntimeAgent / RuntimeEvent（封闭联合六类）/ RuntimeErrorCode，逐字段匹配契约 §4/§5
- [ ] T2-2 新增 `src/lib/runtime-types.ts`：renderer 侧同构镜像，与 types.ts 逐字段一致
- [ ] T2-3 `npm run typecheck` 双端通过；确认 `shared/types.ts` 零改动（git diff 断言）

### T3 · provider 与主控 profile 配置生成（provider.ts）

- [x] T3-1 新增 `electron/runtime/provider.ts`：在 `userData/opencode/` 生成 `opencode.json`（ark 自定义 OpenAI 兼容 provider + mock provider；ark 的 Key 不出现在 json，只经环境变量读）
- [x] T3-2 新增 `resources/opencode/agents/director.md`：frontmatter 最小只读/结构化工具集；描述写明八步闭环职责边界，不声称媒体生成能力；启动时复制到 `userData/opencode/agents/`。model 为 `ark/<modelID>`，**modelID 启动时从 `ARK_MODEL` 环境变量注入生成态 frontmatter（D-006，模板内不写死、不入库）**；ARK_MODEL 缺失报结构化错误，不静默回退 mock
- [x] T3-3 每次启动按模板重生成配置（不做用户态合并、不写项目数据目录）
- [x] T3-4 单测：生成 json 结构契约、不含任何 Key 值；ark 与 mock 以外无其他 provider；director.md 被正确复制（`src/test/runtime-provider.test.ts`，12 用例）

### T4 · 运行时生命周期管理器（manager.ts）

- [x] T4-1 端口探测：从 4096 起顺序找空闲端口（仅 loopback）
- [x] T4-2 启动序列：生成随机口令 → 生成配置 → spawn（固定参数 `serve --hostname 127.0.0.1 --port <port>`，禁 mdns/cors；注入 `OPENCODE_SERVER_PASSWORD` 与从 `.env` 加载的 `ARK_API_KEY` 到子进程环境）→ 轮询 `GET /global/health`（上限约 10s）→ running
- [x] T4-3 状态机迁移 starting/running/error/stopped，每次迁移触发 `runtime:status-changed`
- [x] T4-4 单例幂等：重复 start 返回当前状态；单应用仅一个子进程
- [x] T4-5 子进程 `exit` 监听：code≠0 置 error 带原因，不自动重启
- [x] T4-6 `before-quit` 清理：abort 活跃会话 → 关 SSE → SIGTERM，超时 SIGKILL，回收后放行（beforeStop hook 注册点 + SIGKILL 宽限兜底）
- [x] T4-7 单测：端口探测、状态迁移、超时置 error、重复 start 幂等、异常退出置 error（spawn 全部 mock，不起真进程；`src/test/runtime-manager.test.ts`，13 用例）

### T5 · opencode client 封装（client.ts，client-only）

- [x] T5-1 使用 `createOpencodeClient({ baseUrl })` 连接已启动的 serve；**禁止** `createOpencode()`；以运行实例 `/doc` OpenAPI 核对会话/消息/abort/事件路径与字段（client-only 经 `@opencode-ai/sdk/client`；prompt_async 实测 204 无 body、messageID 本方生成；tools 为 map；format 运行时支持）
- [x] T5-2 封装 createSession / listSessions / abortSession / deleteSession
- [x] T5-3 封装 prompt（同步等待，支持 `format.json_schema` 与 retryCount）与 promptAsync（返回 messageId）
- [x] T5-4 边界参数校验（sessionId/text 非空；`tools` 只能取 profile 已声明集合子集，越界 INVALID_ARGUMENT）
- [x] T5-5 错误映射：上游异常 → RuntimeErrorCode（Key 缺失调 UPSTREAM_AUTH_MISSING；结构化失败 STRUCTURED_OUTPUT_FAILED；中止 PROMPT_ABORTED 等），message 不含口令/Key
- [x] T5-6 单测：以 mock fetch/SDK 验证路径、参数透传、错误映射与 tools 越界拦截（`src/test/runtime-client.test.ts`，18 用例）

### T6 · 事件投影层（projection.ts）

- [x] T6-1 订阅 serve 的 `GET /event`，映射为六类 RuntimeEvent（首事件 → runtime.connected；消息增量 → message.delta；part → message.part；工具 → tool.call；空闲 → session.idle；错误 → runtime.error）
- [x] T6-2 未识别事件不透传：忽略并计数（计数仅日志，不进 IPC；畸形帧/信封一并折叠计 `<malformed>`）
- [x] T6-3 argsPreview/resultPreview 截断 500 字符；key/token/authorization 类字段（大小写不敏感，含 Bearer 形式）打码 `***`
- [x] T6-4 单测：六类映射正确、未识别事件被忽略、截断与打码断言、顺序保持、SSE 分包订阅（`src/test/runtime-projection.test.ts`，17 用例）

### T7 · IPC 适配层与 preload

- [x] T7-1 `electron/main.ts` 注册契约 §3.1 全部 12 个 invoke handle（惰性自启：业务通道首次访问时拉起运行时）
- [x] T7-2 事件推送：仅 subscribe 后向对应 webContents 推 `runtime:event`；unsubscribe / 窗口销毁即停；状态迁移必推 `runtime:status-changed`
- [x] T7-3 `runtime:status` 永不抛错；error 态 / 显式 stop 后会话与 prompt 类通道返回 RUNTIME_NOT_READY
- [x] T7-4 prompt 业务失败经 `RuntimePromptResult.error` 返回（不 reject）；仅通道/运行时级错误 reject（Error.name=code）
- [x] T7-5 `electron/preload.ts` 新增 `runtime` 命名空间（契约 §3.3 全量方法），既有键零改动；onEvent/onStatusChange 返回取消函数
- [x] T7-6 renderer 侧全局 window 类型声明补 runtime 签名（沿用既有镜像约定）

### T8 · mock provider 端到端集成测试

- [x] T8-1 mock provider 跑通：runtime:start（健康）→ session:create → event:subscribe → prompt:async → 收到 message.delta 与 session.idle → session:abort → session:delete → stop（经 manager+client+projection 三层；IPC 为薄封装，T9 真机回归）
- [x] T8-2 安全断言：断言生成的 opencode.json（ark 无 apiKey 字段）、RuntimeStatus、RuntimeEvent、桩收请求（Bearer mock-no-key、仅 /v1/chat/completions）中均不出现 ARK_API_KEY 值与 server 口令
- [x] T8-3 故障路径：启动失败时 status 返回结构化 error（RUNTIME_START_FAILED）且应用不崩；无连接调 prompt 返回 RUNTIME_NOT_READY
- [x] T8-4 真机 ark 链路测试：默认 skip，仅 RUNTIME_E2E_ARK=1 且存在 ARK_API_KEY/ARK_MODEL 时运行（不进必过集）

### T9 · 收尾与验证

- [x] T9-1 `npm run test:run` 全绿（新增测试 + feature-001~007 零回归）— 30 文件 328 passed / 1 skipped（ark 门控）
- [x] T9-2 `npm run typecheck` 双端零错误（renderer tsc + tsconfig.node + tsconfig.preload 三端均绿）
- [x] T9-3 `npm run build` 通过
- [x] T9-4 真机冒烟：启动应用无报错、运行时未提前自启、退出后无残留 opencode 进程（pgrep 0）；UI 内交互启动待后续界面 Feature 承接
- [x] T9-5 变更记录：D-006（精确版本，永久）已在；I-002 登记 T2-T9 实施事实与偏差注记（tools map / app.agents / tsconfig / 测试分层）
- [x] T9-6 AC 逐项自检并输出结果（见 2026-10-04 实施完成汇报，AC-1~AC-11 全部通过；两项范围说明见 I-002）

## 3. 验收标准（AC）

- **AC-1** 应用可拉起 `opencode serve`，`GET /global/health` 返回 healthy 与 version；状态经 `runtime:status` 可读；应用退出后子进程被完全回收，无残留。
- **AC-2** renderer 不持有 opencode 口令 / 凭证 URL，不发起对 opencode 的任何 HTTP 请求；主进程是唯一客户端（client-only，无 createOpencode 自启）。
- **AC-3** 经 IPC 完成「创建会话 → prompt:async → message.delta / session.idle → abort」全链路；事件为本平台封闭六类 RuntimeEvent，未识别事件不透传。
- **AC-4** 投影层截断（500 字符）与密钥打码生效；任何 IPC 返回与生成配置中均不出现 ARK_API_KEY 值与 server 口令。
- **AC-5** 仅 127.0.0.1 监听，无 mDNS / CORS；动态端口 4096 起探测；随机口令仅存内存不落盘。
- **AC-6** 仅 ark + mock 两 provider；ark Key 只经环境变量；本期仅 director profile，模型锁定 `ark/<modelID>`、工具最小集；tools 越界被 INVALID_ARGUMENT 拦截，profile 无法被诱导切换模型或扩张工具。
- **AC-7** 启动失败 / 运行时缺失时应用正常启动，`runtime:status` 返回结构化错误不抛错；业务通道返回 RUNTIME_NOT_READY，不白屏不闪退。
- **AC-8** 生命周期：惰性自启、单例幂等、异常退出置 error 且不自动重启、before-quit 按 SIGTERM→SIGKILL 清理。
- **AC-9** 错误契约匹配：11 个 RuntimeErrorCode 覆盖各失败路径，code 经 Error.name 传递，message 不含凭证；prompt 业务失败走 result.error 而非 reject。
- **AC-10** 现有 27 个旧 IPC 通道与 `shared/` 零改动；`test:run` / typecheck / build 全绿，feature-001~007 零回归。
- **AC-11** K9/K6/K8 经用户签字，D-001/D-003/D-004/D-006 永久落账；D-SCOPE-1 ~ 5 全部有明确结论。
