# feature-803：局域网 ComfyUI 设置与 qwen-image 生成底座

## Context

当前仓库已有 ComfyUI 占位骨架，但尚未形成可用闭环：

- `electron/comfy/client.ts` 只有接口和 holder，没有真实 HTTP 实现，主进程也未注入。
- 实例配置保存在当前项目 `project.json`，未打开项目时无法维护；renderer 没有设置界面。
- `comfyui.queue/status` 仍是占位工具，连接测试存在无响应时长期等待的问题。
- 现有官方资源是 ComfyUI UI 工作流，不是可直接提交 `/prompt` 的 API Format。
- `asset.register` 可复用来登记已有文件，但不负责下载或复制。

用户已确认：本期先通 qwen-image；实例改为应用级共享；先完成实现和自动化，真实 API Format 工作流与实例地址后补。目标是让设置、提交、状态查询、下载和资产登记使用同一主进程引擎，renderer 永不直连 ComfyUI。

## 本期边界

本期交付：

1. 应用级多实例设置界面、CRUD、启停和真实连接测试。
2. 真实 ComfyUI HTTP 客户端与主进程注入。
3. 受控的 qwen-image 工作流加载、参数映射、提交、轮询、图片下载和资产登记。
4. 可恢复的本地作业记录、幂等收片、明确错误与自动化测试。

本期不交付：H3/Music3 生产工作流、通用 UI→API 工作流转换、WebSocket 百分比进度、自动负载均衡、通用 DAG、取消/自动重试、新生成操作页。真机 qwen-image 验收在用户提供 API Format JSON 与实例地址后完成，不以 mock 结果冒充真机通过。

## 决策与卡口

- **K1**：复用 `ComfyInstance`、`AssetIndexItem`，`shared/types.ts` 零修改；新增 DTO 仅放引擎层及既有 IPC 声明镜像。
- **K8**：随本计划申请批准：
  - 新增 `settings:comfy:test`，支持测试编辑器内尚未保存的 `baseUrl`。
  - 实装并收紧既有 `comfyui.queue/status`：`queue` 使用 `instanceId + workflowId + inputs + requestId`，不开放任意模型/任意工作流直传；`status` 返回统一作业状态和标准资产输出。
  - 实例存储由项目级迁移为应用级，任务仅引用 `instanceId`。
- **K2/K9**：不新增依赖，继续使用 Electron/Node 与现有技术栈。
- **K3**：以已批准规格补全或替换空 holder、占位工具，不扩展成新架构。
- 不覆盖工作树中已有的文档修改；特性索引和治理记录只做本包相关的定点更新。

## 实施步骤

### 1. 建立规格与追溯链

- 新建 `docs/features/feature-803-ComfyUI统一媒体引擎/` 标准任务包：需求规格、契约、任务清单、设计说明、变更记录。
- 明确应用级配置、作业状态机、API 请求/响应、文件安全、错误码、验收与真机挂起项。
- 更新 `docs/features/README.md` 的建包/实施状态；按批准结果登记决策台账。根设计与偏差清单仅在口径确有问题时定点同步。

### 2. 应用级实例设置

- 重构 `electron/comfy/settings.ts`：实例保存到 `app.getPath('userData')` 下的 ComfyUI 配置 JSON，采用序列化写入和原子替换，不再依赖 `requireCurrentProject()`。
- 保留并校验现有字段 `id/name/baseUrl/enabled/gpus/vramGB/addedAt`；URL 仅允许 HTTP(S)、禁止凭据和公网目标，支持 localhost 与私网地址。
- 对既有项目级 `comfyInstances` 做一次迁移，避免已有配置静默丢失；迁移后全局配置为唯一事实源。
- 修正更新实例时错误校验旧数据的问题；禁用实例不允许提交新任务，进行中的任务仍可按作业快照查询和收片。

### 3. 设置界面与双端桥接

- 在现有“AI 服务设置”入口内增加“文本服务 / ComfyUI”页签，复用 `StudioApp.tsx` 菜单，不新增生成页。
- 新增 `src/studio/shell/ComfyServicePanel.tsx`，提供实例列表、新增、编辑、启停、删除确认、逐项连接测试、保存中/测试中和可读错误状态。
- 复用 `AiServicePanel.tsx` 的表单、弹窗、Tailwind 样式与 `ipcErrorMessage`，避免复制一套错误解析。
- 同步 `electron/preload.ts`、`src/global.d.ts` 的 `test` 桥接；将 `src/dev-mock-api.ts` 改为确定性的内存 CRUD 和连接测试，不发真实网络请求。

### 4. 真实客户端与统一引擎

- 完成 `electron/comfy/client.ts`：URL 规范化、`GET /system_stats`、`POST /prompt`、`GET /history/{promptId}`、必要时 `GET /queue`、`GET /view` 下载。
- 所有请求有明确超时和统一错误；连接测试不再沿用固定 6 秒 AbortController。fetch、时钟和存储路径可注入，便于无网络单测。
- 新增媒体无关的 `electron/comfy/engine.ts`，由主进程创建唯一客户端/引擎并注入 MCP；设置连接测试和 Agent 工具复用同一实现。
- 保留 `electron/mcp/tools.ts` 的统一 Zod 校验和 result/error 形态，将 queue/status 占位分支替换为真实引擎调用；其他工具保持零 diff。

### 5. 受控 qwen-image 工作流

- 新增工作流加载与映射模块，只接受 **API Format** JSON 和显式版本化参数映射；现有 `resources/_ref_官方模板` 保持只读，不猜测 UI 节点编号或 `widgets_values`。
- 工作流清单限定 `kind=image`、`model=qwen-image`；公开参数只能映射到清单声明的节点 ID 与 input 字段，并做类型/范围校验，未声明节点不可被 Agent 修改。
- 本轮用测试夹具验证提示词、负面词、尺寸、seed、steps 等映射及“其他节点不变”快照。
- 用户补充真实导出物后，再加入生产工作流与映射并执行真机验收；资料缺失时返回明确 `WORKFLOW_NOT_AVAILABLE`，不伪造生成成功。

### 6. 作业、下载与资产登记

- 作业记录保存在当前项目的生成任务数据中，记录 `jobId/requestId/instanceId/workflowId/promptId/状态/错误/输出`；相同 `requestId` 不重复提交。
- `queue` 返回 `jobId + promptId`；`status` 查询远端并推进 `queued/running/downloading/completed/error`。本地超时只表示停止等待，不冒称远端已取消，不自动重提。
- 图片写入项目 `资产/生成/{jobId}/`：远端文件名只取净化后的 basename，先写 `.part` 再原子改名，禁止路径逃逸；校验图片类型、数量和大小。
- 成功后复用 `electron/asset/index.ts` 的 `registerAsset`，写入 `sourceJobId` 及实例、promptId、工作流版本和参数等 `meta`；重复状态查询不得重复登记或覆盖既有产物。

### 7. 测试与验证

自动化：

- 设置：应用级 CRUD、迁移、URL 校验、启停、无打开项目可用。
- 客户端：system_stats/prompt/history/queue/view、超时、非 2xx、无效响应和下载失败。
- 引擎：排队/运行/完成/失败、多输出、重复 requestId、幂等收片、重启续查、禁用实例和路径安全。
- 工作流：参数映射、越界参数、未声明节点拒绝、快照不变。
- UI/mock：加载、增改删、校验、测试成功/失败、错误展示、双端类型契约。
- 更新 `src/test/comfy/comfy-settings.test.ts`、`ai-service-panel.test.tsx`、dev-mock 与 MCP 测试，新增 client/engine/workflow 测试。

执行命令：

```powershell
npm run typecheck
npm run test:run
npm run build
```

真机挂起验收：用户提供 localhost/私网实例地址及 qwen-image **Save API Format** JSON 后，验证连接测试、提交一张图片、状态完成、文件存在、资产中心可见、重复查询只有一条资产记录；随后补测第二实例选择和禁用实例拒绝新任务。

## 关键文件

- 规格：`docs/features/feature-803-ComfyUI统一媒体引擎/*`、`docs/features/README.md`
- 设置与客户端：`electron/comfy/settings.ts`、`client.ts`、`engine.ts`、工作流加载模块
- 主进程与工具：`electron/main.ts`、`electron/mcp/tools.ts`
- 桥接：`electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`
- UI：`src/studio/shell/AiServicePanel.tsx`、`ComfyServicePanel.tsx`
- 复用落库：`electron/asset/index.ts`、`electron/project/library.ts`
- 测试：`src/test/comfy/*`、`src/studio/shell/*test.tsx`、MCP/dev-mock 相关测试
