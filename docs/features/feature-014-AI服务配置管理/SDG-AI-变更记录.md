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

## T 节 · 实施记录（过渡）

> T1-T15 实施与自动验证完成（2026-10-31 收尾）。实测数据以本节为准；真实 LM Studio 服务验收遗留项见 T15。

### T1 · 基线冻结（实测复核）

- **实测基线**（不承旧数）：vitest **71 文件 / 851 passed / 0 failed / 1 skipped**；`npx tsc -b tsconfig.node.json` 退出 **0**；`npm run typecheck` 恰 **3 条**（`src/studio/canvas/canvas-zoom.test.tsx` 2 条 + `src/test/runtime/runtime-client.test.ts` 1 条）；`ipcMain.handle` 计数 **42**；MCP 工具 28；四 Agent 白名单 23/5/9/9；无 harness 脚本。
- **📝 偏差（基线口径修订，用户裁决「以实测为准更新基线继续」）**：任务清单承 feature-013/806 的旧 typecheck 基线描述为「scripts/electron-smoke.mjs 1 + Stage3AssetHub.tsx 2」，实测为 canvas-zoom.test.tsx 2 + runtime-client.test.ts 1；基线**条数同为 3**，仅位置描述不同，按实测登记，代码零改动。
- **产出**：基线数字落入本节；漂移经用户裁决后放行。

### T2 · ai-service store（主进程）

- **产出**：`electron/settings/ai-service.ts`（新建）——导出 `getSettingsView` / `updateSettings` / `getArkConfig` / `getRuntimePrefs` / `maskKeyString` / `__resetAiServiceCacheForTests`；内存副本 + 同步惰性读盘；三级合并 store → env → 内置默认，逐字段来源标记；safeStorage 加密（`apiKeyEnc` = encryptString → base64）；写路径仿 feature-017（enqueue 串行 + archiveExisting 归档）。
- **测试**：`src/test/settings/ai-service.test.ts` **12 测全绿**（CRUD 往返 / 密文落盘 / 解密往返 / 归档 / 三级合并来源标记 / mask 口径 / 降级拒绝零写盘 / patch 语义 / 校验分支）。
- **降级口径落实**：`isEncryptionAvailable()=false` 且 patch 含非空 Key → 抛 `INVALID_ARGUMENT`，**零写盘**，**不回退明文**（D-021 红线）。

### T3 · ark 动态化 + main 挂点

- **产出**：`electron/ark.ts` 废模块级 const，`chat()` / `maskKey()` / `isConfigured()` 改动态读 store（下一条消息即生效）；`electron/main.ts` 三挂点改读合并值（`app:config-status` / `OpencodeRuntimeClient.allowedArkModel` 改 getter / `ensureRuntime`）；`electron/runtime/manager.ts` 增 `portRangeStart?` 贯通 `findFreePort`。
- **测试**：`src/test/ark.test.ts` + `src/test/runtime/runtime-manager.test.ts` 全绿。
- **📝 偏离登记（口径修订，不改代码语义）**：
  1. **读侧同步化**：需求规格 §3.1 表述为「内存副本，`update` 成功后同步刷新」；落地为 `getSettingsView()` 内**同步惰性读盘 + 内存副本优先**（主进程内同步调用无 await 语义差异），行为等价。
  2. **healthTimeoutMs 注入通道**：需求规格 §3.4 表述为「沿用 `ManagerDeps.healthTimeoutMs` 注入通道」；落地为经 `StartRuntimeOptions` **逐次传入**（`manager.ts` 不依赖 electron 边界，可测性与边界洁净度更优），生效口径与「重连后生效」一致。
  3. **spawn 参数与端口区间长度 25**：按 D-021 保持常量不可配，未进面板。

### T4 · IPC + preload 三端镜像（K8 登记范围）

- **产出**：`electron/main.ts` 恰 **2** 个 `ipcMain.handle`（`settings:ai:get` / `settings:ai:update`，L861-864）；`electron/preload.ts` 增 `settings.ai` 两桥；`src/global.d.ts` `declare global` 内增 `AiFieldSource` / `AiServiceUpdatePatch` / `AiServiceSettingsView` 镜像；`src/dev-mock-api.ts` 增 `settings.ai` 演示桩。
- **测试**：`src/test/settings/ai-service-ipc.test.ts` **4 测全绿**（脱敏视图递归无明文 Key / INVALID_ARGUMENT 透传零写盘 / undefined patch → INVALID_ARGUMENT / 清除 Key 后 keyConfigured=false）。
- **静态红线**：`ipcMain.handle` 计数 42 → **44**，净增恰 2。

### T5 · 设置面板（renderer）

- **产出**：`src/studio/shell/AiServicePanel.tsx`（新建，520px 模态，形态冻结于设计说明 §2）；`src/studio/shell/StudioApp.tsx` 四处接线（import / `aiPanelOpen` state / 菜单项 `data-sys-menu-item="ai-settings"` / 面板挂载）。
- **测试**：`src/studio/shell/ai-service-panel.test.tsx`（新建）**9 测全绿**——面板级 8 测（来源标记三态 / 明文不回显 / 高级区默认折叠 / 状态行三态 / 保存 patch 组装 / runtime 驻留提示 / 空串清除与 null 回默认 / 零变更不发 IPC / 错误条剥壳上屏 / 清除 Key 与撤销）+ StudioApp 级 1 测（菜单开合）。
- **关键实现口径**：保存时与生效值 diff 组装 patch（键缺席=不动、空串=清除、runtime 空=null 回默认）；**零变更不发 IPC**（规避主进程空 patch INVALID_ARGUMENT）直接关闭；保存成功必调 `onSaved` → `checkAiHealth` 复检（D-013 链路）；含 runtime 项 → 驻留并提示「需手动重连运行时后生效」，操作行切换为仅「关闭」；明文 Key 永不回显（password 框初始空，占位仅显脱敏值或「未配置」）。

### T6 · 测试补强

- **清点结论**：契约 §6 九条测试契约**全部覆盖**——1/2/3 store 单测（T2）、4 IPC 单测（T4）、5 ark 动态化（T3）、6 manager `portRangeStart`（T3）、7 面板组件单测（T5）、8 全量回归（T7）、9 静态验证（T7）。无需额外补测。
- **测试文件净增**：`src/test/settings/ai-service.test.ts`、`src/test/settings/ai-service-ipc.test.ts`、`src/test/ark.test.ts`、`src/studio/shell/ai-service-panel.test.tsx`（+4 文件；`src/test/runtime/runtime-manager.test.ts` 为既有文件增补）。

### T7 · 全量回归（全部通过）

- **vitest**：**75 文件 / 884 passed / 0 failed / 1 skipped**（T1 基线 851 → +33 测，+4 文件；skipped 仍为 1 不增；failed = 0）。
- **`npx tsc -b tsconfig.node.json`**：退出 **0**。
- **`npm run typecheck`**：恰 **3 条**存量（canvas-zoom.test.tsx ×2 + runtime-client.test.ts ×1），零新增。
- **静态红线复核**：`ipcMain.handle` = **44**（净增恰 2）；MCP 工具 **28**（`src/test/mcp/mcp-pure-tools.test.ts` 绿）；四 Agent 白名单 **23/5/9/9** 零 diff；`package.json` 与 `shared/types.ts` **零 diff**（`git status --porcelain` 空）。
- **📝 冲突处置（用户拍板）**：全量回归暴露 **C7 架构铁律静态扫描冲突**——`src/studio/architecture.test.ts` 对 `src/studio/**` 做全文本扫描，禁 `/\bark\b/i`、`/https?:\/\//`、`/api[_-]?key/i`、`/password/i` 四条；而 feature-014 契约 §2.1 冻结的 DTO 命名空间即 `view.ark.*`，面板必含「API Key」标签、`type="password"`、Base URL 占位符，**无法以改名规避**（改名即破契约与三端镜像）。红线意图（renderer 不直连引擎、不持凭证发请求）不破——本面板仅经 IPC 管理配置，校验/加密/落盘全在主进程。**用户 2026-10-31 拍板：豁免面板文件**——`architecture.test.ts` 增 `EXEMPT_FILES = new Set(['shell/AiServicePanel.tsx'])`，注释载明例外理由，其余文件扫描行为不变。

### T8 · 真机目验（浏览器预览模式，dev-mock）

- **环境说明**：当前环境无可用 Electron 桌面会话，改以 **浏览器预览模式**（vite + `src/dev-mock-api.ts` 演示桩）目验 renderer 侧交互；主进程行为（safeStorage 加密 / 落盘 / ark 动态读取）由 T2-T4 单测覆盖。**AC9 桌面端真机项（真实 Key 保存 → 发消息生效 / 重启后配置仍在）留待用户桌面端验收**（已在本节登记为遗留项）。
- **目验结果（全部通过）**：
  1. **菜单开合**：系统菜单 AI 圆标 → 弹「使用指南/导出/AI 服务设置」三项 → 点「AI 服务设置」开模态面板且菜单自动关闭 → 「取消」关闭面板；
  2. **字段渲染与来源标记**：API Key（占位「未配置」）/ Base URL（生效值 `https://ark.cn-beijing.volces.com/api/v3`）/ 模型名 / 高级区三项（4096 / 10000 / `http://127.0.0.1:4099/v1`），来源标记逐字段显示「默认」；
  3. **高级折叠区**：默认收起，展开后三项可见，标题右注「改动需手动重连运行时生效」；
  4. **保存与来源迁移**：填 Key + 改端口 → 保存 → 来源标记由「默认」转「自定义」、API Key 占位显脱敏 `sk-moc••••1234`（明文不回显）、runtime 驻留提示「运行时参数已保存，需手动重连运行时后生效」上屏、操作行切换为仅「关闭」；
  5. **错误条上屏**：模拟主进程返回 `INVALID_ARGUMENT: 端口探测起点必须在 1024-65535 之间` → 红条原样上屏（Electron invoke 包装已剥壳取原文）、**面板保持打开**、无驻留提示；对话区同步出现「AI 服务不可用，恢复后可继续对话」横幅（D-013 复检链路联动）；
  6. **清除 Key**：已配置态「清除 Key」可点 → 输入框禁用 + 占位转「保存后清除当前 Key」+ 按钮转「撤销清除」→ 撤销恢复可编辑与脱敏占位 → 保存送 `{ark:{apiKey:''}}` → 面板关闭；未配置态「清除 Key」正确禁用。

### T9 · 治理收尾

- 五文件齐备；本 T 节补全各任务实测与产出；偏差逐条 📝 登记于 T1 / T3 / T7；D 节落地回填已更新；台账 D-021 已登记（`docs/governance/SDG-AI-决策台账.md`）；[features/README.md](../README.md) 增 feature-014 行。
- **遗留项（待用户桌面端验收）**：AC9 真实 Key 保存 → 发消息即时生效 / runtime 重连新端口段生效 / 重启应用配置仍在 —— 三项需真实 Electron 桌面会话与真实方舟 Key，当前环境不可执行。

### T10 · 固定双服务商 store 与 DTO

- **产出**：`AiServiceFile` 增可选 `activeProvider` / `lmstudio`，旧配置缺席默认 ark；LM Studio 按 store → `LMSTUDIO_BASE_URL/LMSTUDIO_MODEL` env → 内置默认合并，双方配置独立保存；补枚举、URL、模型校验与空串清除。
- **测试**：store 13 测全绿，覆盖默认值、env 来源、局域网地址、切换与重启持久化、非法值零写盘。

### T11 · opencode provider 与 Agent profile 生成

- **产出**：内部 provider 固定为 ark / lmstudio / mock；LM Studio 使用 `@ai-sdk/openai-compatible`，无 API Key 配置项，仅以固定非秘密占位满足 SDK；四个 profile 按当前服务商渲染完整 `provider/model`，当前模型缺失删除旧 profile，禁止跨服务商或 mock 回退。
- **测试**：provider 18 测 + profile 安装 3 测全绿；真实 Ark Key 不进 opencode.json；Agent 工具白名单零 diff。

### T12 · runtime 启动与模型覆盖贯通

- **产出**：manager/client/main 贯通当前服务商、LM Studio Base URL 与模型 ID；模型覆盖仅允许当前已配置模型；`app:config-status` 形状不变并反映当前服务商配置完整度。
- **测试**：manager 18 测 + client 26 测全绿；保存后仍需手动重连，IPC 总数不变。

### T13 · 固定服务商设置面板与三端镜像

- **产出**：global.d.ts 与 dev-mock 同步 DTO；面板只有火山方舟 / LM Studio 两项单选，无新增、删除或自定义服务商；LM Studio 仅 Base URL 与模型 ID，无 API Key，切换或 LM 配置保存后驻留并提示手动重连。
- **测试**：面板 12 测全绿，覆盖固定两项、无 CRUD、条件字段、patch 组装、状态判断与重连提示。

### T14 · 扩展测试与全量回归

- **聚焦测试**：**7 文件 / 94 passed / 0 failed**（store 13 + provider 18 + profile 3 + manager 18 + client 26 + panel 12 + IPC 4）。
- **全量 Vitest**：**75 文件 / 893 passed / 0 failed / 1 skipped**，较 D-021 收尾 884 passed 净增 9 例，skip 不增。
- **类型检查**：`npx tsc -b tsconfig.node.json --force` 通过；`npm run typecheck` 恰 3 条存量（canvas-zoom.test.tsx ×2 + runtime-client.test.ts ×1），零新增。
- **静态红线**：IPC **44**；MCP **28**；四 Agent 白名单 **23/5/9/9**；`package.json` 与 `shared/types.ts` 零 diff。

### T15 · 治理收尾与真机验收

- **文档闭环**：本包任务清单与变更记录、features/README、设计现状与偏差清单、版本记录、决策台账 D-022 已同步。
- **真实服务探测**：`http://127.0.0.1:1234/v1/models` 实测连接被拒绝；未提供可用局域网 LM Studio 实例。
- **遗留项**：真实 Electron 会话中的 LM Studio 切换保存 → 手动重连 → 实际推理 → 重启持久化待具备真实本机/局域网服务后验收；不以 dev-mock 或单测冒充真实服务通过。

### T16 · 对话内模型选择器与逐消息贯通

- **产出**：ChatComposer 输入区工具行新增「对话模型」原生选择器；StudioApp 经既有 `settings.ai.get` 载入双方已配置模型、按 activeProvider 默认选择并在设置保存后刷新；手动、选项代发和模板消息统一经 `handleSend` 显式携带当前 `model`；无可用模型禁发且保留草稿。
- **边界**：选择仅存当前 renderer，不回写 activeProvider；既有会话复用原 sid；不新增 IPC/DTO/依赖，不自动重连运行时。
- **C7 冲突处置**：双方 DTO 读取与服务商显示文案集中于既有唯一豁免文件 `AiServicePanel.tsx`，StudioApp/ChatComposer 只消费通用模型引用；未扩大豁免、未绕过扫描。

### T17 · 对话切换测试与全量回归

- **聚焦测试**：业务回归 **9 文件 / 136 passed / 0 failed**；C7 修复后架构与对话关键路径复跑 **6 文件 / 89 passed / 0 failed**。
- **覆盖**：同 sid 连续两条消息从方舟切到 LM Studio且请求各带所选模型；无模型手动/Enter 禁发并保留草稿；设置保存刷新选项并保留有效选择且对话选择不写 store；重新对齐模板消息携带当前模型。
- **全量 Vitest**：**75 文件 / 895 passed / 0 failed / 1 skipped**（较 D-022 收尾 893 passed 净增 2 例）。
- **类型检查**：`npx tsc -b tsconfig.node.json --force` 通过；`npm run typecheck` 恰 3 条存量（canvas-zoom.test.tsx ×2 + runtime-client.test.ts ×1），零新增。
- **静态红线**：IPC **44**；MCP **28**；四 Agent 白名单 **23/5/9/9**；`package.json` 与 `shared/types.ts` 零 diff；C7 架构扫描通过。

### T18 · 治理收尾与真实服务验收

- **文档闭环**：本包任务清单与变更记录、features/README、设计现状与偏差清单、版本记录已同步对话内逐消息模型切换终态。
- **自动验收**：AC10 组件回归及全量自动验证通过。
- **遗留项**：真实 Electron 会话中使用已配置的火山方舟与 LM Studio 连续切换并完成实际推理仍待真实服务可用后验收；不以 dev-mock 或单测冒充真实服务通过。

### T19 · 手动重连入口与模型未注册错误修复

- **根因**：设置与对话模型选项已更新为 `qwen3.8-27b`，但当前 opencode 运行实例仍使用旧生成态，`lmstudio.models` 为空；真实 `ProviderModelNotFoundError` 被包装为 `UnknownError` 后仅显示泛化错误。
- **产出**：设置面板在需重连的配置保存后提供「重连运行时」，仅点击后复用既有 `runtime.stop()` → `runtime.start()`；补重连中防重复、成功复检、失败驻留与重试。事件投影同时识别直接 `ProviderModelNotFoundError` 与 `UnknownError` 包装形态，返回固定可操作提示，不透出上游原文。
- **测试**：聚焦 **2 文件 / 36 passed / 0 failed**（面板 14 + 事件投影 22）；覆盖保存不自动重连、stop → start 顺序、成功/失败反馈、包装错误识别与凭证脱敏。
- **边界**：未新增 IPC/DTO/依赖，保存与对话模型切换仍不自动重连。

### T20 · 缺陷回归与治理收尾

- **全量 Vitest**：**75 文件 / 897 passed / 0 failed / 1 skipped**（较 T17 净增 2 例，skip 不增）。
- **类型检查**：`npx tsc -b tsconfig.node.json --force` 通过；`npm run typecheck` 恰 3 条存量（canvas-zoom.test.tsx ×2 + runtime-client.test.ts ×1），零新增。
- **静态红线**：IPC **44**；MCP **28**；四 Agent 白名单 **23/5/9/9**；`package.json` 与 `shared/types.ts` 零 diff；C7 唯一豁免仍为 `shell/AiServicePanel.tsx`。
- **文档闭环**：需求规格 §0B、契约 §0.3/§0.4、设计说明 §2/§2A、任务清单 T19/T20 与本节已同步。
- **遗留项**：真实 Electron 中执行手动重连、核实 `lmstudio/qwen3.8-27b` 已注册且与 LM Studio 实际加载模型 ID 一致，并完成 qwen3.8 实际推理，仍待真机验收；不以 mock 或单测冒充真实推理通过。

---

## X 节 · 修订注

> 暂无。
