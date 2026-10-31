# SDG-RE-需求规格 · feature-014 AI 服务配置管理

> **包号**：feature-014（0xx 平台基础段）
> **业务名**：AI 服务配置管理——① 火山方舟文本接口（API Key / Base URL / 模型名）面板可配；② opencode 运行时可配项（端口探测起点 / 健康检查超时 / mock 引擎地址，收「高级」折叠区）；③ API Key 经 Electron safeStorage 加密落盘
> **性质**：**K8 触发**（新增恰 2 个 IPC：`settings:ai:get` 脱敏返回 / `settings:ai:update`；preload / global.d.ts / dev-mock 三端镜像同步属本次登记范围）；**K1 零触发**（不动 `shared/types.ts`）；**K9 零触发**（safeStorage 为 Electron 内置，零新依赖）
> **事实源**：AGENTS.md §0.1 原则五（平台出公网仅余文本侧火山方舟）与原则六（D-016 系统优先：配置读写为规则可枚举的确定性操作，系统直做，零 AI 对话介入）；feature-808 包内决策 D-013（AI 不可用对话区横幅——本包为其补齐「不可用时去哪修」的配置入口）
> **前置**：feature-808（runtime 客户端与健康检查）；feature-017（ComfyUI 实例 CRUD 已承载媒体侧实例配置，本包不重复）；feature-017 同模式仿形蓝本 [settings.ts](../../../electron/comfy/settings.ts)（enqueue 写队列 + archiveExisting 归档）
> **溯源标签**：[自研新增]（MiniMax Design 为云端托管无此需求；本平台本地/局域网引擎形态要求用户可自配文本接口与运行时参数）
> **偏差登记**：无
> **日期**：2026-10-31

## 0. LM Studio 固定服务商扩展（D-022 · 终局口径）

> 本节是 2026-10-31 用户追加需求后的终局口径，取代本文中「仅火山方舟」「对话通道零改动」「provider.ts 零 diff」等与新范围冲突的旧表述；未冲突部分继续有效。

1. **固定服务商，不做 CRUD**：面板仅提供 `火山方舟` 与 `LM Studio` 两个内置服务商的单选切换；没有新增、删除、自定义服务商入口，不扩展多配置档案。
2. **LM Studio 配置**：仅 `Base URL` 与 `模型 ID`，默认地址 `http://127.0.0.1:1234/v1`，可改局域网地址；无需 API Key，不新增加密字段。开发态分别回退 `LMSTUDIO_BASE_URL` / `LMSTUDIO_MODEL`。
3. **当前服务商**：store 新增 `activeProvider: 'ark' | 'lmstudio'`，缺席默认 `ark`，兼容既有配置文件；两个服务商各自保留配置，切换不清空另一方。
4. **生效方式**：切换当前服务商或修改 LM Studio 地址/模型会改变 opencode provider 与 Agent profile 的生成态；保存成功后面板驻留并提示**手动重连运行时后生效**，不得自动重连或承诺下一条消息生效。
5. **架构边界**：Agent 仍只经 opencode 调用文本模型；renderer 不直连 LM Studio；不新增 IPC、MCP 工具或依赖，不改 `shared/types.ts` 与四 Agent 工具白名单。LM Studio 走 OpenAI 兼容 `/chat/completions` 通道，生成态仅使用固定非秘密占位 Key，真实方舟 Key 仍只经 env 注入。
6. **验收补充**：固定两项且无 CRUD；LM Studio 地址/模型保存、env 回退与持久化正确；重连后 opencode.json 含 `lmstudio` provider、四个安装后 profile 的 `model: lmstudio/<模型ID>`；切回方舟可恢复 `ark/<模型ID>`；缺失当前服务商模型时不静默回退另一服务商或 mock。

## 0A. 对话内逐消息模型切换（2026-10-31 用户拍板）

1. **入口与选项**：对话输入区增加模型选择器；选项来自既有 `settings:ai:get` 脱敏视图，仅列出模型 ID 非空的火山方舟与 LM Studio，不自动发现模型，不出现 mock 或自定义服务商。
2. **默认与保持**：初次载入优先选择 `activeProvider` 对应模型，未配置时选第一个可用模型；设置刷新后保留仍有效的当前选择，失效时按同一规则重选。对话选择只保存于当前 renderer 会话，不回写 `activeProvider`，不新增持久化字段。
3. **逐消息生效**：每次 `runtime.promptAsync` 均显式携带当前选择的 `model: { providerID, modelID }`，包括手动输入、选项代发及既有模板消息；既有会话继续复用原 `sessionId`，后续消息使用发送时的最新选择。
4. **无配置与生效边界**：无可用模型时选择器显示未配置提示且禁止发送；模型选择不自动重连运行时。修改 Base URL 或模型 ID 后仍须按 D-022 手动重连，选择器本身不扩大运行时模型白名单。
5. **验收补充**：可在输入区切换两个已配置模型；连续两条消息可分别携带不同 `model` 且复用同一 `sessionId`；无模型配置时不发请求；不新增 IPC、DTO 字段、依赖或共享层改动。

## 0B. 手动重连入口与模型未注册错误（2026-10-31 缺陷修复）

1. **显式手动入口**：需重连的配置保存后，驻留面板提供「重连运行时」按钮；仅用户点击后复用既有 `runtime.stop()` → `runtime.start()`，保存动作与对话模型切换仍不得自动重连，不新增 IPC。
2. **结果反馈**：重连期间禁止重复操作；成功后提示配置已生效并再次复检，失败后面板驻留且显示脱敏错误，可重试或关闭。
3. **可读错误**：opencode 返回 `ProviderModelNotFoundError`（含被 `UnknownError` 包装、真实原因仅在 `data.message` 的形态）时，提示检查模型 ID 并在刚修改配置后手动重连；不得把原始上游消息或凭证透传到 renderer。

## 1. 背景

现状 AI 服务配置全部硬编码于环境变量与模块常量：

- **ark.ts**：模块顶层 `const` 读 `process.env`（dotenv/config），`BASE_URL` 默认 `https://ark.cn-beijing.volces.com/api/v3`；缺 Key/Model 时 `chat()` 抛错；
- **main.ts**：`app:config-status`（L436）返回 `{arkConfigured}`；`OpencodeRuntimeClient`（L444-448）以 `allowedArkModel: process.env.ARK_MODEL` 构造；`ensureRuntime()`（L493-504）把 `process.env.ARK_API_KEY/MODEL/BASE_URL` 传给 `runtimeManager.start`；
- **manager.ts**：端口探测 `PORT_RANGE_START=4096` / `PORT_RANGE_ATTEMPTS=25`、`HEALTH_TIMEOUT_MS=10_000` 为模块常量（`ManagerDeps.healthTimeoutMs` 已有注入先例；`findFreePort(start)` 已支持参数化起点）；
- **provider.ts**：`generateRuntimeConfig` 每次启动按模板重生成 opencode.json，`MOCK_BASE_URL_DEFAULT='http://127.0.0.1:4099/v1'`；`StartRuntimeOptions` 已有 `arkApiKey/arkModel/arkBaseUrl/mockBaseUrl` 字段。

问题：① 普通用户不会改 `.env`，打包分发后 `.env` 路径不复存在；② feature-808 D-013 已落地「AI 不可用对话区横幅 + 重新检测」，但用户看到横幅后**无处修配置**；③ runtime 端口/超时等参数无任何调整通道。

**拍板结论（2026-10-31 经 AskUserQuestion 五项拍板，决策卡 D-021 全文见包内变更记录 D 节与台账）**：

1. **配置内容**：火山方舟三件套（API Key / Base URL / 模型名）+ runtime 三项（端口探测起点默认 4096 起 25 个 / 健康检查超时默认 10s / mock 引擎地址，收「高级」折叠区）；ComfyUI 实例 CRUD 已由 feature-017 承载，不在本包；
2. **Key 存储（契约修订裁决）**：**safeStorage 加密落盘**（Windows DPAPI）——主进程 `safeStorage.encryptString` 加密后 base64 存 userData JSON，内存解密使用；`isEncryptionAvailable()=false` 时**拒绝保存并报错，不回退明文**；旧口径「ark Key 永不落盘」修订为「**opencode.json 生成态契约不变（Key 永不进 opencode.json，仍经子进程 env 注入）；应用级配置仅允许 safeStorage 加密落盘**」；
3. **spawn 参数契约固定**（`serve --hostname 127.0.0.1 --port`，禁 mdns/cors）**不可配**，不进面板；
4. **入口形态**：rail 系统菜单（StudioApp `sysMenu`，rail 底部 AI 圆标弹出菜单，现收「使用指南/导出」）增「AI 服务设置」项开面板；
5. **生效方式**：保存即时生效**不重启**——仅写 JSON 持久化；方舟类配置**下一条消息生效**（ark.ts 废模块级 const 改动态读 store）；端口/超时/mock 地址三项需重启 runtime，保存后提示用户手动重连。

**env 回退口径（规格定夺）**：store 字段缺席/空串时回退 `process.env`（保留开发态 `.env` 工作流），面板逐字段显示来源标记（设置 / 环境变量 / 默认）；dotenv 保留不废弃。

## 2. 角色与场景

| # | 角色 | 场景 | 期望表现 |
|---|---|---|---|
| R1 | 创作者 | 首次使用或 Key 失效，对话区出现「AI 服务不可用」横幅 | rail 系统菜单 →「AI 服务设置」打开面板，填入 Key/Base URL/模型名保存；保存即触发健康复检，复检通过横幅消失、输入恢复可用；下一条消息即走新配置，不重启应用 |
| R2 | 创作者 | 查看当前配置 | 面板显示各项当前值与来源标记；API Key 永不回显明文，仅显示脱敏（前6+••••+后4）与「已配置/未配置」状态 |
| R3 | 创作者 | 修改 Key | 密码框输入新 Key 保存即替换；留空保存 = 不动既有 Key；提供「清除 Key」显式动作 |
| R4 | 创作者 | 系统不支持加密（isEncryptionAvailable()=false） | 保存 Key 被拒绝并报错「当前系统不支持安全存储，Key 未保存」；其余字段可保存；不回退明文落盘 |
| R5 | 高级用户 | 4096 端口段被占用 / 健康检查偏紧 / 换 mock 桩地址 | 「高级」折叠区改端口起点/超时/mock 地址；保存后提示「运行时参数需手动重连生效」；非法值（越界端口、非 URL）被校验拦截零写盘 |
| R6 | 开发者 | 开发态 `.env` 工作流 | store 未设置的字段回退 env，开发态行为不破坏；面板来源标记显示「环境变量」 |

## 3. 核心机制

### 3.1 应用级配置 store（electron/settings/ai-service.ts）

- 文件：`<userData>/ai-service.json`（应用级，非项目级）；形状见契约 §1；
- 写路径仿 feature-017：`enqueue` 写队列串行 + `archiveExisting` 归档旧版；
- Key 仅经 `safeStorage.encryptString` → base64 落盘字段 `apiKeyEnc`；读取 `safeStorage.decryptString`；**明文 Key 不出主进程内存**；
- 模块持内存副本，`update` 成功后同步刷新——ark.ts 与 main.ts 挂点读内存副本，「下一条消息生效」零磁盘 IO。

### 3.2 ark.ts 动态化

废模块级 `const BASE_URL/API_KEY/MODEL`；`chat()` / `maskKey()` / `isConfigured()` 改为每次调用经 store 取当前生效值（store 值优先，缺省回退 env，再缺省回退内置默认 BASE_URL）；错误文案保持「未配置」语义并指引到「AI 服务设置」。

### 3.3 main.ts 三处挂点改读 store

`app:config-status`（arkConfigured = store/env 合并后 key+model 均存在）；`ensureRuntime()` 的 `arkApiKey/arkModel/arkBaseUrl` 改从 store 取（Key 解密仅此处与 ark.ts 发生）；`OpencodeRuntimeClient` 的 `allowedArkModel` 改 getter 动态取。

### 3.4 manager 可配化

`StartRuntimeOptions` 增 `portRangeStart?: number`；`boot()` 中 `findFreePort()` 改 `findFreePort(opts.portRangeStart)`；健康超时沿用 `ManagerDeps.healthTimeoutMs` 注入通道；mock 地址沿用既有 `mockBaseUrl` 字段。端口数区间长度（25）与 spawn 参数保持常量不可配。

### 3.5 面板（renderer）

rail 系统菜单增「AI 服务设置」→ 模态面板：API Key（password 框，占位显脱敏值）/ Base URL / 模型名 / 高级折叠区（端口起点、健康超时、mock 地址）；逐字段来源标记；保存 = `settings:ai:update` → 成功后调既有 `checkAiHealth` 复检；含 runtime 项变更时提示手动重连。

## 4. 范围

### 4.1 做

1. `electron/settings/ai-service.ts` store（CRUD + safeStorage 加解密 + env 回退合并 + 内存副本）；
2. `ark.ts` 动态读 store（废模块级 const，dotenv 保留作 env 回退源）；
3. `main.ts` 三处挂点改读 store + 新增恰 2 个 IPC（`settings:ai:get` 脱敏 / `settings:ai:update` 校验+加密落盘）；
4. `manager.ts`：`StartRuntimeOptions` 增 `portRangeStart?` 并贯通 `findFreePort`；
5. preload `settings.ai` 命名空间 + `src/global.d.ts` 镜像 + `src/dev-mock-api.ts` 演示桩；
6. StudioApp sysMenu 增「AI 服务设置」+ 设置面板组件（含高级折叠区、来源标记、保存后复检、runtime 项变更提示）；
7. 测试：store CRUD/加密往返/降级拒绝/env 回退、IPC 校验、ark 动态读取、面板交互；全量回归 + 双 typecheck；
8. 治理收尾：变更记录 T 节回填、features/README 增 014 行、版本记录增行。

### 4.2 不做（显式排除）

- **ComfyUI 实例配置不做**（feature-017 已承载，项目级）；
- **spawn 参数不可配**（`serve --hostname 127.0.0.1 --port`、禁 mdns/cors 为安全契约常量）；端口区间长度 25 不可配；
- **opencode.json 生成态不做用户态合并**（provider.ts 模板制重生成不变；Key 永不进 opencode.json 不变）；
- **不做配置导入导出、多配置档案、Key 云端同步**；
- **语音通道配置不做**（原则五：语音通道待定）；
- **对话通道（Agent 侧）零改动**：showrunner 等四 profile 与 28 工具零 diff。

## 5. 验收标准（AC）

| # | 验收 | 判定方式 |
|---|---|---|
| AC1 | store 落盘：保存后 `ai-service.json` 存在且 `apiKeyEnc` 为 base64 密文（肉眼不可读回明文）；重读解密往返一致；更新经 enqueue 串行、旧版归档 | 单测 |
| AC2 | 降级拒绝：mock `isEncryptionAvailable()=false` 时保存含 Key 的 patch 抛错零写盘，错误文案明示不支持安全存储；不含 Key 的 patch 正常保存 | 单测 |
| AC3 | env 回退：store 缺字段时生效值取 env，再缺取内置默认；逐字段来源标记正确（store/env/default） | 单测 |
| AC4 | ark 动态化：更新 store 后下一次 `chat()` 用新 Key/Model/BaseURL（不经重启、不重载模块）；`isConfigured()`/`maskKey()` 同步反映 | 单测 |
| AC5 | IPC 校验：非法 baseUrl（非 http(s)）、端口越界（非 1024-65535 整数）、超时时长越界（非 1000-60000）、非字符串 Key → 同码 `INVALID_ARGUMENT` 零写盘；`settings:ai:get` 返回体无明文 Key | 单测 |
| AC6 | 面板：菜单项出现并开合面板；字段渲染与来源标记；保存成功调复检；runtime 项变更显示重连提示；清除 Key 动作生效 | 组件单测 |
| AC7 | 零 diff 红线：MCP 恰 28 工具、四 Agent 白名单零 diff；`ipcMain.handle` 净增恰 2；`package.json` 零 diff；`shared/types.ts` 零 diff | 静态验证 |
| AC8 | 回归红线：全量 vitest 以 T1 实测基线（上一基线 71 文件 851 passed / 1 skipped）为准——passed 不减少、skip 不增、failed=0；`npx tsc -b tsconfig.node.json` 退出 0、`npm run typecheck` 恰 3 条存量基线零新增 | 全量回归 |
| AC9 | 真机（Electron 实机）：① 面板填 Key 保存 → 对话区横幅复检消失、发消息成功；② 改端口起点保存 → 提示重连 → 手动重连后 runtime 用新端口段启动；③ 重启应用配置仍在 | 真机 |
| AC10 | 对话内切换：选择器仅列双方已配置模型；连续消息显式携带各自选择且旧会话 sid 不变；无模型禁发；设置保存后选项刷新且不擅自改 store | 组件单测 + 真机 |
