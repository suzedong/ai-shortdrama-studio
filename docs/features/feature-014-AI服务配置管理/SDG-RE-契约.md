# SDG-RE-契约 · feature-014 AI 服务配置管理

> **卡口声明**：本包 **K8 触发**——新增恰 2 个 IPC（`settings:ai:get` / `settings:ai:update`，§2.1），preload / global.d.ts / dev-mock 三端镜像同步属本次登记范围；**K1 零触发**（`shared/types.ts` 零 diff，DTO 定义于 electron 侧并三端镜像）；**K9 零触发**（safeStorage 为 Electron 内置，零新依赖）。**MCP 恰 28 工具、四 Agent 白名单、spawn 参数契约、`shared/types.ts`、`package.json` 为零 diff 红线。实施中一旦触碰未登记卡口 → 立即停手呈报。**

## 0. LM Studio 扩展契约（D-022 · 终局口径）

> 本节取代本文与新范围冲突的「仅 ark+mock provider」「provider.ts 零 diff」「对话通道零改动」旧约束；IPC 总数仍为恰 2，`shared/types.ts`、依赖、MCP 工具数与 Agent 工具白名单零 diff。

### 0.1 存储、视图与 patch

`AiServiceFile` 在 version:1 内新增可选字段，旧文件无需迁移：

```ts
type AiProviderId = 'ark' | 'lmstudio'
interface AiServiceFile {
  activeProvider?: AiProviderId // 缺席=ark
  lmstudio?: { baseUrl?: string; model?: string }
  // ark/runtime/updatedAt 沿用 §1.1
}
```

`AiServiceSettingsView` 新增 `activeProvider: AiProviderId` 与 `lmstudio: { baseUrl:string; model:string; sources:{baseUrl:AiFieldSource; model:AiFieldSource} }`。`AiServiceUpdatePatch` 新增 `activeProvider?: AiProviderId` 与 `lmstudio?: { baseUrl?:string; model?:string }`；字符串空串=清除并回退 env/default，键缺席=不动。`activeProvider` 只接受两个枚举值，其他值 `INVALID_ARGUMENT` 零写盘。

LM Studio 合并顺序：store → `LMSTUDIO_BASE_URL` / `LMSTUDIO_MODEL` → 内置默认；Base URL 默认 `http://127.0.0.1:1234/v1`，模型无默认。Base URL 校验沿用 `^https?://`，允许 http 局域网地址；无 LM Studio API Key 字段。

### 0.2 opencode 与 Agent profile 生成态

- 固定内部 provider 白名单变为 `ark / lmstudio / mock`；面板只暴露前两者，mock 仍为内部测试桩，不构成用户可新增服务商能力。
- `generateRuntimeConfig` 接收 `lmStudioBaseUrl/lmStudioModel`，生成 `lmstudio` OpenAI 兼容 provider；无真实凭证，固定非秘密占位值仅用于 SDK 必填项。
- `setupRuntimeFiles` 接收 `activeProvider`；当前模型取对应服务商配置，四 profile 统一渲染完整 `provider/model` 引用。缺当前模型时维持 `UPSTREAM_AUTH_MISSING`，不得回退另一服务商或 mock。
- `StartRuntimeOptions` 与 `ensureRuntime()` 贯通当前服务商及 LM Studio 两项；`OpencodeRuntimeClient` 的模型覆盖白名单增加当前 LM Studio 模型。
- `app:config-status` 返回形状不变，既有 `arkConfigured` 键改表示「当前文本服务商已具备所需配置」，避免新增 IPC/DTO 键。

### 0.3 renderer 与生效

面板顶部为仅含「火山方舟 / LM Studio」的服务商单选控件，条件呈现对应字段；LM Studio 仅 Base URL 与模型 ID。任何 `activeProvider` 或 `lmstudio` patch 保存成功后均按 runtime 变更处理：驻留、提示手动重连，操作行提供「重连运行时」与「关闭」。仅用户点击重连后调用既有 `runtime.stop()` → `runtime.start()`；成功后提示已生效并再次复检，失败驻留报错，保存动作本身不自动重连。两个服务商配置独立保存，切换不清空；禁止出现新增/删除服务商控件。

对话输入区模型选择器复用 `settings:ai:get` 与既有 `RuntimePromptRequest.model`，不新增 IPC 或 DTO 字段。选项仅由 `ark.model` / `lmstudio.model` 非空值生成；默认优先 `activeProvider`，当前选择仍有效时跨设置刷新保持。每次 `promptAsync` 必须显式传入 `{ model: { providerID: 'ark' | 'lmstudio', modelID: string } }`；旧会话只复用 `sessionId`，不冻结首次消息的模型。无可用模型时禁止发送。选择器不写 store、不自动重连；运行时仍按 §0.2 白名单校验。

### 0.4 测试补充

覆盖：旧配置默认 ark、activeProvider 枚举校验、LM Studio 三级合并与非法 URL、双服务商配置独立保留、opencode 三 provider 生成与秘密边界、LM profile 模型引用、缺模型不回退、runtime 参数贯通、模型覆盖白名单、面板固定两项/无 CRUD/切换保存重连提示、手动 stop → start 成功与失败反馈、模型未注册及其 UnknownError 包装形态的可读提示。全量回归与既有安全红线不变。

## 1. 数据面契约

### 1.1 存储文件

- 路径：`app.getPath('userData')/ai-service.json`（应用级，单文件）；
- 写入：仿 feature-017——`enqueue` 写队列串行 + `archiveExisting` 归档旧版后覆写；
- 形状：

```ts
interface AiServiceFile {
  version: 1
  ark?: {
    apiKeyEnc?: string   // safeStorage.encryptString → base64；唯一允许的 Key 落盘形态
    baseUrl?: string     // trim 后 http(s):// 开头；空串视为缺席
    model?: string       // trim 非空；空串视为缺席
  }
  runtime?: {
    portRangeStart?: number   // 整数 1024-65535；探测区间长度恒 25（常量不可配）
    healthTimeoutMs?: number  // 整数 1000-60000
    mockBaseUrl?: string      // trim 后 http(s):// 开头
  }
  updatedAt: string
}
```

### 1.2 生效值合并口径（store → env → default）

| 字段 | store | env 回退 | 内置默认 |
|---|---|---|---|
| ark.apiKey | `apiKeyEnc` 解密 | `ARK_API_KEY` | 无 |
| ark.baseUrl | `ark.baseUrl` | `ARK_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3` |
| ark.model | `ark.model` | `ARK_MODEL` | 无 |
| runtime.portRangeStart | `runtime.portRangeStart` | 无 | `4096` |
| runtime.healthTimeoutMs | `runtime.healthTimeoutMs` | 无 | `10000` |
| runtime.mockBaseUrl | `runtime.mockBaseUrl` | 无 | `http://127.0.0.1:4099/v1` |

- 缺席/空串 = 未设置，进入下一级回退；逐字段来源标记 `'store' | 'env' | 'default'` 供面板显示；
- **明文 Key 边界**：仅 `electron/settings/ai-service.ts` 的解密函数与 `ark.ts`/`main.ts ensureRuntime` 消费明文；IPC 返回体、日志、错误消息一律脱敏（`maskKey` 口径：前6+`••••`+后4，不足 10 位仅显「已配置」）。

### 1.3 safeStorage 降级

`safeStorage.isEncryptionAvailable()=false`：凡 patch 含 `apiKey`（非空）→ 抛 `{code:'INVALID_ARGUMENT', message:'当前系统不支持安全存储，Key 未保存'}` **零写盘**；其余字段照常保存。**禁止明文回退**（D-021 拍板）。

## 2. 通道契约

### 2.1 新增恰 2 个 IPC（K8 登记）

| 通道 | 入参 | 返回 | 口径 |
|---|---|---|---|
| `settings:ai:get` | 无 | `AiServiceSettingsView` | 脱敏视图：六项当前生效值 + 逐字段 `source` + `keyConfigured:boolean` + `apiKeyMasked?: string`；**无明文 Key** |
| `settings:ai:update` | `AiServiceUpdatePatch` | `AiServiceSettingsView`（更新后） | 校验（§2.2）→ 加密 Key → enqueue 落盘 → 刷新内存副本 → 返回脱敏视图 |

```ts
interface AiServiceUpdatePatch {
  ark?: {
    apiKey?: string     // 非空=替换；空串=清除 Key；键缺席=不动
    baseUrl?: string    // 空串=清除（回退 env/default）
    model?: string      // 空串=清除
  }
  runtime?: { portRangeStart?: number | null; healthTimeoutMs?: number | null; mockBaseUrl?: string }
  // null/空串 = 清除回默认；键缺席 = 不动
}
```

### 2.2 校验口径（主进程侧，违规 `INVALID_ARGUMENT` 零写盘）

- `baseUrl` / `mockBaseUrl`：trim 后须 `^https?://`；
- `portRangeStart`：`Number.isInteger` 且 1024-65535；
- `healthTimeoutMs`：`Number.isInteger` 且 1000-60000；
- `apiKey` / `model`：`typeof string`；`apiKey` 非空时才走 safeStorage 可用性检查；
- patch 全空（无任何键）→ `INVALID_ARGUMENT`；
- 未知键一律忽略（不报错），防止 preload 与主进程版本漂移炸档。

### 2.3 既有通道改动

| 挂点 | 改动 |
|---|---|
| `app:config-status`（main.ts L436） | `arkConfigured` 改判合并后 key+model 均存在；返回形状不变 |
| `ensureRuntime()`（main.ts L493-504） | `arkApiKey/arkModel/arkBaseUrl` 改从 store 合并值取；新增传 `portRangeStart`、（若 store 提供）`mockBaseUrl`；healthTimeoutMs 经 `ManagerDeps` 注入通道在构造 manager 时传入 |
| `OpencodeRuntimeClient`（main.ts L444-448） | `allowedArkModel` 改 getter（`() => 合并值.model`），面板改模型后下一条消息生效 |

## 3. 模块契约

### 3.1 electron/settings/ai-service.ts（新增）

导出：`getSettingsView()`（脱敏）、`updateSettings(patch)`、`getArkConfig()`（明文，仅主进程内部）、`getRuntimePrefs()`（portRangeStart/healthTimeoutMs/mockBaseUrl 合并值）、`maskKeyString(key)`。模块持内存副本：启动时惰性读盘，`update` 成功同步刷新；`chat()` 等消费方读内存副本零磁盘 IO。

### 3.2 ark.ts（改动）

废模块级 `const BASE_URL/API_KEY/MODEL`；`chat()` 每次调用经 `getArkConfig()` 取当前值；缺 key/model 抛错文案改「未配置火山方舟接口，请在「AI 服务设置」中配置 API Key 与模型名（或设置 ARK_API_KEY/ARK_MODEL 环境变量）」；`maskKey()`/`isConfigured()` 同步动态化；`import 'dotenv/config'` 保留（env 回退源）。

### 3.3 manager.ts（最小改动）

`StartRuntimeOptions` 增 `portRangeStart?: number`；`boot()` 内 `findFreePort()` → `findFreePort(opts.portRangeStart)`；其余（端口数 25、健康间隔、spawn 参数）常量不动。`ManagerDeps.healthTimeoutMs` 既有注入通道复用，不改签名。

## 4. renderer 契约

- **入口**：StudioApp `sysMenu`（`data-sys-menu-root` 既有体系）菜单项增「AI 服务设置」，点击开模态面板、关菜单；既有「使用指南/导出」不动；
- **面板字段**：API Key（`type=password`，占位显 `apiKeyMasked` 或「未配置」；「清除 Key」按钮仅 `keyConfigured` 时可点）/ Base URL / 模型名 / 高级折叠区（端口起点、健康超时 ms、mock 地址）；逐字段来源标记文案（自定义 / 环境变量 / 默认）；
- **保存**：`settings:ai:update` 成功 → 关闭或驻留（形态冻结于设计说明）→ 调既有 `checkAiHealth` 复检（feature-808 D-013 链路复用，横幅随结果消隐）；patch 含 runtime 三项之一 → 面板内提示「运行时参数已保存，需手动重连运行时后生效」；
- **校验提示**：IPC 抛 `INVALID_ARGUMENT` → 面板内错误条上屏，配置零写盘。

## 5. 最小 diff

| 类别 | 文件 |
|---|---|
| 新增 | `electron/settings/ai-service.ts`；`src/studio/shell/AiServicePanel.tsx`（落点以实施为准，不越本白名单）；对应测试文件（净增数 T 节登记） |
| 修改 | `electron/ark.ts`（动态化）；`electron/main.ts`（三挂点 + 恰 2 个 `ipcMain.handle`）；`electron/runtime/manager.ts`（`StartRuntimeOptions` +1 字段、findFreePort 贯通）；`electron/preload.ts`（settings.ai 命名空间）；`src/global.d.ts`（DTO 镜像）；`src/dev-mock-api.ts`（演示桩）；`src/studio/shell/StudioApp.tsx`（菜单项 + 面板挂载 + 保存后复检 + 对话模型状态）；`src/studio/chat/ChatComposer.tsx`（对话模型选择器） |
| 文档 | 本包五文件；features/README 增 014 行；版本记录（收尾增行）；台账 D-021 |
| 零 diff 红线 | 28 个 MCP 工具实现与注册数；四 Agent 白名单；`shared/types.ts`；`package.json`；provider.ts 生成态模板（mock 地址注入沿用既有 `mockBaseUrl` 通道，模板本身不改）；spawn 参数；既有全部 IPC（除 §2.3 三挂点内逻辑） |

## 6. 测试契约

1. store 单测：CRUD 往返；`apiKeyEnc` 落盘为 base64 密文且文件无明文；解密往返一致；enqueue 串行 + 归档断言（仿 feature-017 测试）；
2. 降级单测：mock `isEncryptionAvailable()=false` → 含 Key patch 抛错零写盘；无 Key patch 正常；
3. 合并口径单测：store/env/default 三级回退逐字段覆盖；来源标记正确；
4. IPC 单测：§2.2 全校验分支 `INVALID_ARGUMENT` 零写盘；`get` 返回体无明文 Key（递归断言无 apiKey 字段）；清除 Key（空串）后 `keyConfigured=false`；
5. ark 动态化单测：update 后下一次 `chat()` 用新配置（fetch mock 断言 URL/header/body）；`isConfigured`/`maskKey` 同步；
6. manager 单测：`portRangeStart` 贯通 `findFreePort`（mock net 断言首探端口）；缺省 4096 回归；
7. 面板组件单测：菜单开合、字段渲染与来源标记、保存调 update 与复检、runtime 变更提示、错误条上屏、清除 Key；
8. 全量回归：T1 冻结基线不恶化（passed 不减少、skip 不增、failed=0）；`npx tsc -b tsconfig.node.json` 退出 0；`npm run typecheck` 恰 3 条存量基线；
9. 静态验证：Grep 复核 `ipcMain.handle` 净增恰 2、MCP 工具 28、白名单 23/5/9/9、`package.json` 与 `shared/types.ts` 零 diff。

## 7. 卡口与越界处置

| 情形 | 处置 |
|---|---|
| 需要第 3 个及以上 IPC / 新推送 | 停手呈报 K8 复议 |
| 需要动 `shared/types.ts` | 停手呈报 K1（本包预期为零） |
| 需要新依赖（如 keytar） | 停手呈报 K9（safeStorage 内置，预期为零） |
| 用户要求明文落盘 / 禁用加密 | 违反 D-021 拍板，停手呈报 |
| ComfyUI 实例配置诉求混入 | 指引 feature-017 既有通道，不在本包扩面 |
| spawn 参数 / 端口区间长度可配化诉求 | 违反安全契约常量，停手呈报 |
