# SDG-AI 变更记录 · feature-014 AI 服务配置管理

> **三分类**：D 节 = 决策（永久）；T 节 = 实施记录（过渡，收尾后可压缩）；X 节 = 修订注（指向 D 节决策）。

---

## D 节 · 决策（永久）

### D-021 ｜ K8 ｜ AI 服务配置管理：配置范围 / safeStorage 加密落盘 / spawn 契约固定 / 入口形态 / 即时生效 + 「ark Key 永不落盘」口径修订

- **日期**：2026-10-31
- **卡口**：K8（新增恰 2 个 IPC：`settings:ai:get` / `settings:ai:update`；preload/global.d.ts/dev-mock 三端镜像同步属本次登记范围）；K1 零触发（不动 shared/types.ts）；K9 零触发（safeStorage 为 Electron 内置，零新依赖）
- **触发背景**：火山方舟文本接口三件套（API Key / Base URL / 模型名）与 opencode 运行时参数（端口探测起点、健康检查超时、mock 引擎地址）此前硬编码于模块级 const 与 env，用户无法在应用内管理；且旧口径「ark Key 永不落盘」与应用级持久化需求冲突，需裁决。
- **用户决策**（2026-10-31 拍板，五项 + 规格定夺一项）：
  1. **配置内容**：火山方舟文本三件套（API Key / Base URL / 模型名）+ opencode 运行时三项（端口探测起点默认 4096 起 25 个、健康检查超时默认 10s、mock 引擎地址，收「高级」折叠区）；ComfyUI 实例 CRUD 已有 feature-017 承载，**不在本包**。
  2. **Key 存储（契约口径修订）**：safeStorage 加密落盘（Windows DPAPI）——`safeStorage.encryptString` 加密后 base64 存 userData JSON；`isEncryptionAvailable()=false` 时**拒绝保存并报错，不回退明文**。旧口径「ark Key 永不落盘」修订为：**opencode.json 生成态契约不变**（Key 永不进 opencode.json，仍经子进程 env 注入，见 [provider.ts](../../../electron/runtime/provider.ts) 头部注释）；**应用级配置仅允许 safeStorage 加密落盘**。
  3. **spawn 参数契约固定**（`serve --hostname 127.0.0.1 --port`，禁 mdns/cors）**不可配**，不进面板。
  4. **入口形态**：StudioApp rail 底部 AI 圆标系统菜单（`data-sys-menu-root`）增「AI 服务设置」项，开模态面板。
  5. **生效方式**：保存即时生效不重启——方舟类下一条消息生效（ark.ts 废模块级 const 改动态读 store）；runtime 三项提示用户手动重连。
  6. **规格定夺（包内裁决）**：store 字段缺席时回退 `process.env`（保留开发态 .env 工作流，dotenv 保留不废弃），再缺回退内置默认；面板逐字段显示来源标记（store / env / default）。
- **落地回填**（收尾时补）：ai-service store / ark 动态化 / main 三挂点 / 恰 2 IPC / manager `portRangeStart` / 面板。**已实施并回填 T 节（2026-10-31 收尾）**。
- **波及文件**：`electron/settings/ai-service.ts`（新建）、`electron/ark.ts`、`electron/main.ts`、`electron/runtime/manager.ts`、`electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`、`src/studio/shell/StudioApp.tsx`、`src/studio/shell/AiServicePanel.tsx`（新建）+ 新测试文件。
- **后续约束**：图像/视频/音乐生成通道红线不变（仍全经 ComfyUI，D-010）；本包只管文本侧方舟与运行时参数；IPC 净增恰 2 为红线，任何第 3 个 IPC 或新推送须停手复议。

### D-022 ｜ K8 ｜ 固定双服务商：新增 LM Studio 本地/局域网文本模型服务

- **日期**：2026-10-31
- **卡口**：K8（扩展既有 `settings:ai` DTO、opencode provider 与 Agent profile 生成契约）；K1/K9 零触发（不改 shared/types.ts、不增依赖）；IPC 仍恰 2 个，MCP 与 Agent 工具白名单不变。
- **触发背景**：用户明确要求「AI服务商不能新增和删除，我需要加LM Studio本地局域网的模型服务」。原 D-021 仅覆盖火山方舟，需增加本地/局域网 OpenAI 兼容文本服务，同时禁止演变为自定义服务商 CRUD。
- **用户决策**（2026-10-31 AskUserQuestion 三项拍板）：
  1. **固定两个服务商**：火山方舟 / LM Studio 单选切换，无新增、删除或自定义服务商入口。
  2. **LM Studio 配置**：Base URL + 模型 ID，默认 `http://127.0.0.1:1234/v1`，支持局域网地址，无 API Key；保留 `LMSTUDIO_BASE_URL/LMSTUDIO_MODEL` env 回退。
  3. **K8 与生效**：批准扩展 DTO/provider/profile 契约；保存后**手动重连运行时**生效，不自动中断进行中会话。
- **边界**：当前服务商缺席默认 ark，旧配置兼容；双方配置独立保留；当前模型缺失不跨服务商或 mock 静默回退；renderer 不直连 LM Studio；真实 Ark Key 安全边界不变。
- **落地回填**：固定双服务商 store/DTO、LM Studio OpenAI 兼容 provider、完整 `provider/model` profile 渲染、runtime/client/main 贯通与固定两项面板均已实施；T10-T15 实测见下节。
- **波及文件**：本包五文件、`electron/settings/ai-service.ts`、`electron/main.ts`、`electron/runtime/provider.ts`、`manager.ts`、`client.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`、`src/studio/shell/AiServicePanel.tsx` 及对应测试。

---

### D-023 ｜ K8 ｜ 系统代理与本地服务商直连联动（feature-006）

- **日期**：2026-11-01
- **卡口**：K8 联动登记（opencode 子进程代理环境契约修订）；K1/K9 零触发，IPC、DTO、shared types、spawn 参数与依赖均零 diff。
- **用户决策**：整个系统遵循操作系统代理及绕过规则；公网不可达时明确提示代理状态；loopback、LM Studio 与本地/局域网 ComfyUI 必须直连，不受系统代理影响。
- **技术决策**：主进程 Ark/MCP 公网请求统一走 Electron `net.fetch`；启动 opencode 前按当前 provider URL 解析系统代理并注入 `HTTP_PROXY`/`HTTPS_PROXY`，DIRECT 时清除继承代理，始终覆写 `NO_PROXY`；主进程到 opencode/MCP 的 loopback 请求保持原生直连。
- **生效与提示**：沿用保存后手动重连运行时；公网连接失败使用主进程原生提示并保留原错误语义，不新增 IPC 或 renderer 状态。
- **波及文件**：`electron/network.ts`（新增）、`electron/ark.ts`、`electron/main.ts`、`electron/runtime/manager.ts` 及对应测试；feature-006 任务包同步承载完整验收。

---

## T 节 · 实施记录（过渡）

### T1—T20 已落地实施压缩注（2026-11-20）

T1—T20 已按任务清单完成：基线与全链复核、三端 DTO、主进程设置存储与真实连通诊断、opencode provider 配置生成、IPC/preload 镜像、Ark/LM Studio 互斥切换、独立模型清单、旧配置迁移、设置 UI、运行时和 Agent 消费方收口、自动测试及治理同步均已落地。过程命令、逐文件改动和当时测试计数不再复制；现行需求、边界与验收以本包需求规格、契约、设计说明和任务清单为准。

保留的实施偏差与缺陷闭环：T1 的 typecheck 基线位置与旧文档不一致，经用户批准按实测更新；T3 采用同步惰性读盘加内存副本，并经 StartRuntimeOptions 逐次注入 healthTimeoutMs，spawn 参数与 25 个端口区间仍固定；T7 的 C7 静态扫描与冻结 DTO／面板字段冲突，经用户 2026-10-31 批准仅豁免 `shell/AiServicePanel.tsx`；T19 修复运行时未重连导致 qwen 未注册及 UnknownError 泛化提示，增加手动重连与直接／包装 ProviderModelNotFoundError 的可操作提示。

AC9、AC13、AC15、AC22 的自动化与静态验证结论不以本次清理翻案；其中真实 Ark Key 的保存/即时生效/重启持久化、真实 Electron 中双服务切换与实际推理、手动重连、LM Studio 重启持久化及 qwen 模型注册，连同需求 L4 的真实桌面端服务验收，仍须在具备服务与凭据后执行。当前不得宣称上述真机项已通过。

## X 节 · 修订注

> 暂无。
