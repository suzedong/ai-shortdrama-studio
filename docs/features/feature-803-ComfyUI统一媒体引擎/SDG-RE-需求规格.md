# feature-803 · ComfyUI 统一媒体引擎 — 需求规格

> **版本**：v1.0（2026-11-14）｜**状态**：原范围已实施；三端口 H3 API 级串行落卡已验，资产中心 UI、应用内第二实例与禁用行为待验
>
> **现行指引（2026-11-15 校准）**：本规格是 2026-11-14 Qwen 图像底座的历史契约快照。现行生产图像唯一通道为 feature-816 / D-033 的 MiniMax H3 Image；本文不得用于恢复 Qwen 或推翻后续 H3 迁移。
> **作者**：AI Assistant（AI-SDG）
> **已批准实施计划**：`.trae/documents/feature-803-comfyui-lan-image-foundation.md`
> **上游**：《短剧Agent平台设计.md》§0.1 第 2/5 条、§3.2.3、§3.2.5、§9.2、§10 B-06；feature-017 既有占位骨架。

## 1. 背景与问题

当前 ComfyUI 仅有实例 CRUD、接口 holder 与 MCP 占位分支：配置依附当前项目，renderer 无维护入口，主进程无真实 HTTP 客户端，queue/status 不产生作业或资产。既有官方资源是 UI 工作流，不能直接作为 `/prompt` 的 API Format 提交。

本期建立应用级实例设置与 qwen-image 生成底座，使设置测试、Agent 提交、状态查询、下载和资产登记复用主进程同一引擎。实施初期真实实例地址与生产 API Format 工作流由用户后补，真机验收分步执行。

## 2. 上下文加载清单

**代码写权边界**

- 允许修改：`electron/comfy/settings.ts`、`electron/comfy/client.ts`、`electron/mcp/tools.ts`、`electron/main.ts`、`electron/preload.ts`、`electron/asset/index.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`、`src/studio/shell/AiServicePanel.tsx`、本包新增测试。
- 允许新增：`electron/comfy/url.ts`、`electron/comfy/engine.ts`、`electron/comfy/workflow.ts`、`src/studio/shell/ComfyServicePanel.tsx`、`src/studio/shell/ipc-error.ts`、`resources/comfyui/workflows/manifest.json`、本包测试与测试夹具。
- 只读复用：`shared/types.ts` 的 `ComfyInstance` / `AssetIndexItem`，不修改共享层。
- 只读参考：`resources/_ref_官方模板/**`，不得猜测其 UI 节点映射。

**关键文件**

- 设计：`短剧Agent平台设计.md`；偏差状态：`docs/设计现状与偏差清单.md`（本期无需修改）。
- 主进程：`electron/main.ts`、`electron/mcp/tools.ts`、`electron/asset/index.ts`、`electron/project/current.ts`。
- 设置：`electron/comfy/settings.ts`、`electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`。
- UI：`src/studio/shell/AiServicePanel.tsx`、`src/studio/shell/ComfyServicePanel.tsx`、`src/studio/shell/StudioApp.tsx`（入口已存在，只读核对）。
- 测试：`src/test/comfy/**`、`src/test/mcp/mcp-pure-tools.test.ts`、`src/test/dev-mock-api.test.ts`、`src/studio/shell/ai-service-panel.test.tsx`。
- 构建：`package.json`、`vitest.config.ts`、`tsconfig.json`、`tsconfig.electron.json`。

**相关已存在 Feature 包**

- feature-017：ComfyClient / ComfyInstance 原占位（任务包不纳入本期改动）。
- feature-023：共享资产登记契约，本期复用 `registerAsset`。
- feature-014：AI 服务设置入口与面板形态，本期在其中增加页签。

## 3. 需求条目

### FR-1 应用级多实例配置

- 实例持久化到 `app.getPath('userData')/comfyui/instances.json`，无打开项目时也可 CRUD。
- 字段为 `id/name/baseUrl/enabled/addedAt`，并保留可选 `gpus: string[]`、`vramGB: number`；基础形状继承 `ComfyInstance`。
- 更新必须基于编辑器新值校验，不得误校验旧对象；名称非空，URL 仅允许本机/私网 HTTP(S)，禁止凭据、query/hash 与公网目标。
- 全局文件首次缺失时，从当前项目旧 `project.json.comfyInstances` 迁移；迁移后只读写全局文件，旧项目字段保留为历史备份但不再作为事实源。
- 写入串行、同目录临时文件 fsync 后原子替换，并归档旧版。

### FR-2 设置界面与双端桥接

- 复用系统菜单「AI 服务设置」，增加「文本服务 / ComfyUI」页签，不新增生成页。
- ComfyUI 页提供实例列表、新增、编辑、启停、删除二次确认、逐项测试、编辑器未保存地址测试，以及加载/保存/测试/错误状态。
- 新增 `settings:comfy:test`；preload、renderer DTO 与 dev mock 同步。
- dev mock 提供确定性内存 CRUD 和测试，不发送网络请求。

### FR-3 真实客户端与统一引擎

- 主进程创建唯一引擎并注入既有 `setComfyClient`，设置测试和 MCP 共用该实例。
- HTTP 客户端实现 `GET /system_stats`、`POST /prompt`、`GET /history/{promptId}`、`GET /queue`、`GET /view`。
- 每次请求均有可注入超时；非 2xx、超时、网络错误和无效响应映射为稳定错误码。
- renderer 不直连 ComfyUI；本期不新增依赖。

### FR-4 受控 qwen-image 工作流

- 仅加载版本化清单声明的 API Format JSON，且 `kind=image`、`model=qwen-image`。
- queue 只接受 `workflowId + inputs`，不接收任意工作流对象；仅清单声明的公开输入可写入指定节点 ID 与 input 字段。
- 映射执行类型、必填、长度和数值范围校验；未声明节点与其余字段保持逐值不变。
- 无生产工作流时返回 `WORKFLOW_NOT_AVAILABLE`，不得伪造成功。

### FR-5 作业、收片与资产登记

- `comfyui.queue` 入参固定为 `instanceId/workflowId/inputs/requestId`，返回 `jobId/promptId`。
- `comfyui.status` 保持 `instanceId/jobId`，返回统一状态、标准资产输出及结构化错误。
- 作业落当前项目 `comfy-jobs.json`，保存 requestId、实例与工作流快照、promptId、输入、状态、输出、错误和时间。
- 相同 requestId 同参数幂等返回，不同参数拒绝；禁用实例拒绝新任务，但既有作业可按快照续查。
- 状态推进为 `queued/running/downloading/completed/error`；本地等待失败不冒称远端取消，不自动重提。
- 图片写 `资产/生成/{jobId}/`，远端文件名取安全 basename；先写 `.part` 再原子改名，限制数量/大小并校验图片格式。
- 成功后复用 `registerAsset`，记录 `sourceJobId` 与实例、promptId、workflowId/版本和输入；重复查询不重复登记或覆盖产物。

## 4. 非目标

- H3 / Music3 工作流，语音通道，其他图像/视频/音乐模型。
- 通用 UI→API 工作流转换、任意工作流直传、通用 DAG。
- WebSocket 百分比、自动负载均衡、取消、自动重试、自动调度、新生成操作页。
- 在未提供真实实例与 API Format JSON 时宣称真机 qwen-image 验收通过。

## 5. 验收标准

| ID | 验收标准 | 验证方式 |
| :-- | :-- | :-- |
| AC-1 | 无打开项目可完成应用级实例 CRUD；旧项目配置仅迁移一次，更新校验新值 | 设置自动化 |
| AC-2 | localhost、私网 IP 与本地主机名可用；公网、凭据、非法 URL 被拒绝 | 设置/客户端自动化 |
| AC-3 | 设置页签完成加载、增改删、启停、未保存地址测试及错误展示；浏览器 mock 零网络 | UI/mock 自动化 |
| AC-4 | 五类 HTTP 端点、超时、非 2xx、无效 JSON、下载失败均有确定性结果 | 客户端自动化 |
| AC-5 | qwen-image 清单映射仅改变声明节点；越界参数和未声明输入被拒绝 | 工作流自动化与快照 |
| AC-6 | queue/status 完成排队、运行、下载、完成、失败、多输出、requestId 幂等、禁用实例及重启续查 | 引擎/MCP 自动化 |
| AC-7 | 收片防路径逃逸，重复 status 不覆盖文件且资产索引仅一条对应记录 | 引擎自动化 |
| AC-8 | `npm run typecheck`、`npm run test:run`、`npm run build` 全绿 | 命令输出 |
| AC-9 | 真机连接测试、生成一张图、资产中心可见、重复查询幂等、第二实例与禁用行为 | 真机分步验收；三端口直连 API 串行落卡已过，但不代替应用内第二实例与禁用行为；执行状态见任务清单 |

## 6. Feature 内决策

- **D-803-001（K1）**：共享 `ComfyInstance` / `AssetIndexItem` 不改；可选 GPU 字段以引擎设置 DTO 扩展并镜像到 renderer。
- **D-803-002（K8，已随计划批准）**：新增 `settings:comfy:test`；收紧 `comfyui.queue/status`；实例从项目级迁为应用级。
- **D-803-003（K2/K9）**：零新依赖，使用 Electron/Node 内置能力与现有 React/Tailwind。
- **D-803-004**：旧 `project.json.comfyInstances` 不做破坏性删除；全局文件存在后不再读取旧字段。
- **D-803-005**：生产 qwen-image 工作流缺省是显式不可用状态，不用 UI 模板猜映射。
