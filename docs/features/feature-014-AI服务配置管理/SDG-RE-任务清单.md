# feature-014 AI 服务配置管理 · SDG-RE-任务清单

> **任务包**：`docs/features/feature-014-AI服务配置管理/`
> **状态**：✅ 对话内逐消息模型切换已落地并通过全量回归（固定双服务商 D-022 已落地；真实 Electron + 双服务推理验收遗留项继续保留）
> **上游**：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md) · [SDG-RE-契约.md](./SDG-RE-契约.md) · [SDG-OD-设计说明.md](./SDG-OD-设计说明.md)
> **基线参照行**（承 feature-013/806 T7，须 T1 复核实测）：vitest **71 文件 / 851 passed / 0 failed / 1 skipped**；`tsc --noEmit` 恰 3 条已知（scripts/electron-smoke.mjs 1 + Stage3AssetHub.tsx 2）；MCP 工具 **28**；四 Agent 白名单 **23/5/9/9**。**T1 必须复核实测，不承旧数**。

---

## T1 · 基线冻结与拍板确认

- **做什么**：
  1. 确认五项拍板与 env 回退定夺已回填需求规格 §1 与契约（D-021 决策卡已登记变更记录）。
  2. 复核实测基线：`pnpm vitest run`（期待 71 文件 851 passed / 0 failed / 1 skipped）、`npx tsc -b tsconfig.node.json`（退出 0）、`npm run typecheck`（恰 3 条已知）、`pnpm harness` 全绿、MCP 工具 28 / 白名单 23/5/9/9。基线漂移 → 停手报用户。
  3. 复核契约 §5 白名单文件清单与现状一致（main.ts 挂点行号 L436/L444-448/L493-504 若漂移以实测为准登记）。
- **验收**：基线数字实测落入变更记录 T 节；漂移有用户裁决。

## T2 · ai-service store（主进程）

- **做什么**：
  1. 新建 `electron/settings/ai-service.ts`：导出 `getSettingsView` / `updateSettings` / `getArkConfig` / `getRuntimePrefs` / `maskKeyString`；内存副本 + 进程内单例；存储形状 `AiServiceFile{version:1, ark:{apiKeyEnc?,baseUrl?,model?}, runtime:{portRangeStart?,healthTimeoutMs?,mockBaseUrl?}, updatedAt}`。
  2. 三级合并：store → `process.env` → 内置默认；缺省默认 `baseUrl=https://ark.cn-beijing.volces.com/api/v3`、`portRangeStart=4096`、`healthTimeoutMs=10000`、模型名默认沿用现状 env 口径。
  3. safeStorage：`encryptString` 加密后 base64 落 userData JSON；`isEncryptionAvailable()=false` 且 patch 含 Key → 抛 `{code:'INVALID_ARGUMENT', message:'当前系统不支持安全存储，Key 未保存'}`，**零写盘**。
  4. patch 语义：`apiKey` 空串 = 清除、键缺席 = 不动；runtime 字段 `null` = 清除回默认；校验（baseUrl `^https?://`、portRangeStart 整数 1024-65535、healthTimeoutMs 1000-60000、未知键忽略）。
  5. 写测试：读写往返、加密降级拒绝零写盘、合并三级来源、mask 口径（前6+••••+后4，不足 10 位显「已配置」）、非法值拒绝。
- **验收**：单测绿；tsc 零新增。

## T3 · ark 动态化 + main 挂点改造

- **做什么**：
  1. `electron/ark.ts`：废模块级 `const BASE_URL/API_KEY/MODEL`，chat/maskKey/isConfigured 改动态读 `getArkConfig()`（下一条消息即生效）；dotenv 保留；错误文案同步。
  2. `electron/main.ts` 三挂点：`app:config-status`（L436）、`new OpencodeRuntimeClient({allowedArkModel: …})`（L444-448 改 getter）、`ensureRuntime`（L493-504）改读 store 合并值。
  3. `electron/runtime/manager.ts`：`StartRuntimeOptions` 增 `portRangeStart?`；`findFreePort(opts.portRangeStart)` 接线（常量 `PORT_RANGE_START` 保持默认）；`healthTimeoutMs` 复用 `ManagerDeps` 既有注入先例。
  4. 写测试：store 更新后 ark 读取值随之变化（无需重启）；ensureRuntime 传参来源正确。
- **验收**：AC3/AC6；单测绿；tsc 恰 3。

## T4 · IPC + preload 三端镜像（K8 登记范围）

- **做什么**：
  1. `electron/main.ts` 新增**恰 2 个** `ipcMain.handle`：`settings:ai:get`（返回脱敏视图 + 逐字段来源标记 store/env/default）/ `settings:ai:update`（受理 `AiServiceUpdatePatch`，返回更新后视图）。
  2. `electron/preload.ts` settings 命名空间增 `settings.ai`（get/update 两桥）；`src/global.d.ts` DTO 镜像；`src/dev-mock-api.ts` 演示桩。
  3. 写测试：两 IPC 入参/出参契约、错误码透传。
- **验收**：IPC 计数净增恰 2（Grep 复核）；三端类型一致；测试绿。

## T5 · 设置面板（renderer）

- **做什么**：
  1. `src/studio/shell/StudioApp.tsx`：rail 底部 AI 圆标系统菜单（`data-sys-menu-root`）增「AI 服务设置」项，开模态面板；复用 sysMenuOpen state 与点击外部关闭 effect。
  2. 新建 `src/studio/shell/AiServicePanel.tsx`（形态冻结于设计说明）：状态行 / API Key password 框（占位显脱敏）+ 清除 Key 按钮 / Base URL / 模型名 / 逐字段来源标记（自定义/环境变量/默认）/ 高级折叠区三项（portRangeStart/healthTimeoutMs/mockBaseUrl）/ 错误条 / 取消+保存。
  3. 保存成功：无 runtime 变更直接关闭；含 runtime 变更提示「运行时参数已保存，需手动重连运行时后生效」；保存后必调既有 `checkAiHealth` 复检（D-013 横幅联动）。
  4. 写测试：面板渲染（来源标记三态）、保存 patch 组装（空串清除/缺席不动/null 回默认）、降级错误上屏。
- **验收**：AC4/AC5/AC7；组件测试绿。

## T6 · 测试补强

- **做什么**：按契约 §6 九条测试契约逐条补齐（store 单测 / ark 动态化 / IPC 契约 / 面板组件 / 合并来源 / mask / 降级 / 校验 / 回归静态验证）；测试文件净增数登记 T 节。
- **验收**：契约 §6 全覆盖；新增测试全绿。

## T7 · 全量回归

- **做什么**：`pnpm vitest run`、`npx tsc -b tsconfig.node.json`、`npm run typecheck`、`pnpm harness`、构建（`pnpm build`）。
- **验收门（全部满足才算过）**：
  - vitest：通过数 ≥ 851 + 本包新增（写入 T 节实测）；**0 failed**；skipped = 1（不动既有 skip，以 T1 冻结基线为准）。
  - `tsc -b tsconfig.node.json` 退出 0；`npm run typecheck` 恰 3 条已知（零新增）。
  - harness：0 错误（WARN 基线 ≤ T1 冻结值）。
  - MCP 工具 = 28；四白名单 = 23/5/9/9；IPC 净增恰 2（`ipcMain.handle` Grep 复核）；`package.json` 零 diff；opencode.json 生成态契约不破（Key 永不进 opencode.json）。

## T8 · 真机目验（桌面端）

- **做什么**（按需求规格 AC1-AC7、AC9 逐项过）：启动桌面端 → 系统菜单开「AI 服务设置」→ 填 Key/Base URL/模型名保存 → 下一条消息即生效（不重启）→ 清除 Key 后对话横幅出现（D-013 联动）→ 高级区改端口起点保存 → 提示手动重连 → 重连后新端口起点生效 → env 回退场景（清 store 留 .env）来源标记为「环境变量」。
- **验收**：AC 全部目验通过；发现偏差 → 登记需求规格头部偏差表 + 修。

## T9 · 治理收尾

- **做什么**：
  1. 变更记录 T 节补全各任务实测与产出；偏差逐条 📝 修订注。
  2. 反向同步检查（铁律 3）：规格与落地不一致处按 L1/L2 裁决后同步。
  3. [features/README.md](../README.md) 增 feature-014 行。
  4. 收尾清单：五文件齐、测试绿、卡口登记齐（D-021 已入台账）、用户验收。
- **验收**：治理件完整；用户确认收尾。

---

## T10 · 固定双服务商 store 与 DTO（D-022）

- **做什么**：`AiServiceFile` 增可选 `activeProvider` 与 `lmstudio`；缺席默认 ark；实现 LM Studio store → `LMSTUDIO_BASE_URL/LMSTUDIO_MODEL` env → 内置默认合并、来源标记、空串清除、枚举与 URL 校验；双方配置独立保留。
- **验收**：旧配置无需迁移；非法 provider 零写盘；store/IPC 单测覆盖切换、持久化、清除与来源标记。

## T11 · opencode provider 与 Agent profile 生成

- **做什么**：固定内部 provider 为 ark / lmstudio / mock；生成 LM Studio OpenAI 兼容配置；按当前服务商渲染四个 profile 的完整 `provider/model`；当前模型缺失时不跨服务商或 mock 回退。
- **验收**：ark 与 lmstudio 两套生成态单测全绿；真实 Ark Key 不进 opencode.json；Agent 工具白名单零 diff。

## T12 · runtime 启动与模型覆盖贯通

- **做什么**：manager/client/main 贯通当前服务商及 LM Studio Base URL、模型 ID；模型覆盖仅允许当前已配置模型；`app:config-status` 形状不变并反映当前服务商配置状态。
- **验收**：保存后需手动重连；不新增 IPC；相关 runtime 单测全绿。

## T13 · 固定服务商设置面板与三端镜像

- **做什么**：global.d.ts 与 dev-mock 同步 DTO；面板仅提供火山方舟 / LM Studio 两项单选，LM Studio 仅 Base URL 与模型 ID，无 API Key、无服务商 CRUD；切换或 LM Studio 配置保存后驻留并提示手动重连。
- **验收**：组件测试覆盖固定两项、条件字段、patch 组装、独立保留配置与重连提示。

## T14 · 扩展测试与全量回归

- **做什么**：补齐 store、provider、manager、client、panel 测试；执行 node/renderer 类型检查、全量 Vitest 与静态红线复核。
- **验收**：0 failed；类型检查零新增错误；IPC 仍 44、MCP 28、Agent 白名单 23/5/9/9；package.json 与 shared/types.ts 零 diff。
- **实测**：聚焦 **7 文件 / 94 passed / 0 failed**；全量 **75 文件 / 893 passed / 0 failed / 1 skipped**（较 D-021 收尾 884 passed 净增 9 例）；node 类型检查通过，renderer 恰 3 条存量基线、零新增；IPC **44**、MCP **28**、Agent 白名单 **23/5/9/9**；`package.json` 与 `shared/types.ts` 零 diff。

## T15 · 治理收尾与真机验收

- **做什么**：回填变更记录与任务实测，同步 features/README、设计现状与偏差清单、版本记录；在真实 Electron 会话验收 LM Studio 本地/局域网地址、切换保存、手动重连与重启持久化。
- **验收**：文档与实现一致；自动验证完成；需真实服务的项目明确登记验收结果或遗留项。
- **收尾**：包内变更记录、features/README、设计现状与偏差清单、版本记录及 D-022 决策台账已同步。
- **遗留项**：本机 `http://127.0.0.1:1234/v1/models` 实测连接被拒绝，且未提供可用局域网 LM Studio 实例；真实 Electron 会话中的切换保存 → 手动重连 → LM Studio 实际推理 → 重启持久化仍待具备真实服务后验收。

## T16 · 对话内模型选择器与逐消息贯通

- **做什么**：StudioApp 经既有 `settings.ai.get` 载入双方已配置模型，管理当前选择并在设置保存后刷新；ChatComposer 输入区增加原生模型选择器；`handleSend` 对每条 `promptAsync` 显式携带所选 `model`，无可用模型禁止发送。
- **验收**：默认优先当前服务商；有效选择跨设置刷新保持；手动、代发和模板消息统一走所选模型；旧会话后续消息使用最新选择；不新增 IPC/DTO/依赖。

## T17 · 对话切换测试与全量回归

- **做什么**：更新 StudioApp 相关 fixtures 与精确请求断言，新增双模型逐消息切换、同 sid 续聊、无模型禁发测试；执行聚焦测试、双类型检查、全量 Vitest 与静态红线复核。
- **验收**：0 failed；类型检查零新增；IPC 44、MCP 28、Agent 白名单 23/5/9/9；package.json 与 shared/types.ts 零 diff。

## T18 · 治理收尾与真实服务验收

- **做什么**：回填任务实测、变更记录、features/README、设计现状与偏差清单、版本记录；真实 Electron + 双服务可用时目验对话内切换与实际推理。
- **验收**：文档与实现一致；自动验证完成；真实服务不可用时明确登记遗留项，不以 mock 代替。

## T19 · 手动重连入口与模型未注册错误修复

- **做什么**：需重连的配置保存后面板提供「重连运行时」，仅点击后复用既有 `runtime.stop/start`；补成功、失败与防重复操作反馈。事件投影识别 `ProviderModelNotFoundError` 及 `UnknownError` 包装形态，输出可操作且不透出上游原文的提示。
- **验收**：保存与模型切换不自动重连；stop → start 顺序正确；不新增 IPC/DTO/依赖；聚焦组件与事件投影测试通过。
- **实测**：聚焦 **2 文件 / 36 passed / 0 failed**（面板 14 + 事件投影 22）；覆盖保存不自动重连、手动 stop → start 顺序、成功复检、失败驻留重试，以及模型未注册直接/包装两种错误形态与上游原文脱敏。

## T20 · 缺陷回归与治理收尾

- **做什么**：执行聚焦测试、双类型检查、全量 Vitest 与静态红线复核，回填任务实测和变更记录；真实 LM Studio 重连及 qwen3.8 推理单独验收。
- **验收**：0 failed；类型检查零新增；IPC 44、MCP 28、Agent 白名单 23/5/9/9；不以 mock 代替真实推理。
- **实测**：全量 **75 文件 / 897 passed / 0 failed / 1 skipped**；node 类型检查通过，renderer 恰 3 条存量基线、零新增；IPC **44**、MCP **28**、Agent 白名单 **23/5/9/9**；`package.json` 与 `shared/types.ts` 零 diff，C7 唯一豁免未扩大。
- **遗留项**：真实 Electron 中点击「重连运行时」后核实 `lmstudio/qwen3.8-27b` 注册、模型 ID 与 LM Studio 已加载模型一致并完成实际推理，仍待真机验收。

---

## 全景依赖

```text
T1（基线）─> T2（store）─> T3（ark 动态化 + main 挂点）─> T4（IPC + 三端）─> T5（面板）─> T6（测试补强）─> T7 回归 ─> T8 目验 ─> T9 收尾
T10（双服务商 store）─> T11（provider/profile）─> T12（runtime 贯通）─> T13（面板与镜像）─> T14（回归）─> T15（收尾与真机验收）
T16（对话模型选择器）─> T17（对话切换回归）─> T18（收尾与真机验收）
```

- T2 是全部下游前置；T3/T4 依赖 T2 导出契约；T5 依赖 T4 桥。
- T10 是 D-022 下游前置；T11/T12/T13 可依据同一契约并行实施，T14 汇总验收。
- 任何任务触发未登记卡口（新增第 3 个 IPC/新推送/新 MCP 工具、动 shared/types.ts、引依赖、动 Agent 白名单）→ 立即停手报用户（铁律 1 / K10）。
