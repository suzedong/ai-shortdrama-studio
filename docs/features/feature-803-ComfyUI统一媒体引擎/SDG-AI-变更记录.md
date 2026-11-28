# feature-803 · ComfyUI 统一媒体引擎 — 变更记录

> **版本**：v1.3（2026-11-15）｜**状态**：历史 qwen-image 真机生成链路已验收；三端口 H3 API 级串行落卡已验，应用内其余真机项待办
>
> **现行指引（2026-11-27 校准）**：本文件保留 2026-11-14 的 Qwen 实施与真机历史，不作为现行图像通道依据。生产图像已由 feature-816 / D-033 迁移为 MiniMax H3 Image；后续统一任务与多实例验收按 Parity 矩阵 P2 执行，不得据此恢复 Qwen。
> 分类按通用规则 §2.4：A 文档修正 / B 行为补全 / C 决策变更。

## 2026-11-14 · 初始化任务包（A）

- 依据当时已批准的工具侧实施计划建立五件标准任务包；批准结论已固化于本包，重复计划现已清理，不再保留外置路径依赖。
- 固定应用级实例存储、`settings:comfy:test`、受控 queue/status、API Format 工作流、作业幂等与安全收片契约。
- K1：`shared/types.ts` 零修改；K2/K9：零新依赖；K8 仅登记本包 IPC/MCP/存储变更。
- 生产 qwen-image 工作流与真机地址待用户补充，真机验收挂起。

## 2026-11-14 · 设置界面与 qwen-image 生成链路实施（B）

### 行为与迁移

- 新增应用级 ComfyUI 多实例设置：列表、新增、编辑、启停、删除二次确认、已保存实例及编辑器未保存地址的真实连接测试；文本服务与 ComfyUI 共用设置入口。
- 实例事实源迁至 `userData/comfyui/instances.json`。仅当全局文件不存在时读取当前项目旧配置并迁移；旧项目文件不删除、不改写，全局文件建立后不再读取旧值。损坏配置不被覆盖。
- 主进程实现 ComfyUI 五端点 HTTP 客户端，限制本机/私网地址、禁止自动重定向，并统一超时和协议错误；renderer 只经 IPC 操作，dev mock 不发起网络。
- 主进程创建并注入唯一 `ComfyEngine`，连接测试与 MCP queue/status 共用。queue 仅接受受控 `workflowId + inputs + requestId`，不开放任意 graph/UI Format；本期工作流类型仅限 qwen-image。
- 项目级 `comfy-jobs.json` 持久化作业，支持 requestId 幂等、每项目串行锁、实例 URL 快照、禁用实例仅拒绝新任务、重启续查和轮询失败后续查。缺 promptId 的提交中断返回 `COMFY_SUBMISSION_UNKNOWN`，不自动重提。
- completed 后执行安全收片：限制数量、大小、格式、扩展名、content-type 与安全文件名，使用 `.part` 原子替换；按输出路径幂等恢复并复用 `registerAsset` 登记来源 meta，避免重复资产。
- 本阶段实施时生产工作流清单为空；缺真实 qwen-image Save API Format 工作流时明确返回 `WORKFLOW_NOT_AVAILABLE`。用户当日晚些时候提供的真实工作流见下节。

### 受影响文件

- 主进程与引擎：`electron/comfy/settings.ts`、`url.ts`、`client.ts`、`workflow.ts`、`engine.ts`，以及 `electron/main.ts`、`electron/preload.ts`、`electron/mcp/tools.ts`、`electron/asset/index.ts`。
- 设置界面与桥接：`src/studio/shell/AiServicePanel.tsx`、`ComfyServicePanel.tsx`、`ipc-error.ts`，以及 `src/global.d.ts`、`src/dev-mock-api.ts`。
- 生产资源：`resources/comfyui/workflows/manifest.json`（本阶段实施时为空清单，未伪造生产工作流）。
- 自动化：`src/test/comfy/comfy-settings.test.ts`、`comfy-url.test.ts`、`comfy-client.test.ts`、`comfy-workflow.test.ts`、`comfy-engine.test.ts`、`comfy-dev-mock.test.ts`，`src/studio/shell/comfy-service-panel.test.tsx`，`src/test/mcp/mcp-comfy-tools.test.ts`。
- `shared/types.ts`、`package.json`、`package-lock.json` 零修改；K1/K2/K9 未触发新增变更，K8 变更已在本包契约登记。

### 验证结果

- feature-803 的设置、URL、HTTP 客户端、工作流、引擎、dev mock、设置面板和 MCP 契约测试全部通过；其中引擎 10 项、设置 6 项、面板 5 项、MCP 3 项、dev mock 1 项。
- renderer 架构红线 2 项、原 AI 服务面板 14 项、资产索引回归 3 项通过。
- `npm run test:run` 已执行：90 个测试文件中 88 通过、2 失败；1116 项测试中 1105 通过、10 失败、1 跳过。失败仅为 `agent-profile-install.test.ts` 1 项与 `agent-profiles.test.ts` 9 项既有 CRLF/LF 断言，未修改无关文件。
- `npm run typecheck` 与 `npm run build` 已执行，仅被 3 条既有测试类型错误阻断：`canvas-zoom.test.tsx` 的 StepId/string 与未使用变量各 1 条，`runtime-client.test.ts` 的 mock 缺 `messages` 1 条。
- `npx vite build` 成功（仅现存大 chunk 警告），`npm run build:electron` 成功。
- 该阶段真机连接与 qwen-image 生成未验收，未以 mock 或测试夹具冒充真机通过。
- 首轮局域网实例探测：`10.203.3.52:8000` 可达，`GET /system_stats` 返回 ComfyUI 0.45.3、RTX 4090（24GB）。该实例已保存 4 条 Qwen Image Edit 2511 工作流（人设图 / 场景&道具，bf16 与 int8），但均为 UI Format 且使用 subgraph；探测时尚无 Save API Format 导出件。

## 2026-11-14 · qwen-image 2512 生产工作流与真机验收（B）

- 用户提供 `resources/_ref_官方模板/api_image_qwen_Image_2512.json`，确认是合法 Save API Format。原参考文件未修改，原样复制为 `resources/comfyui/workflows/qwen-image-2512-text.json`。
- 生产 `manifest.json` 注册 `qwen-image-2512-text`，版本 `2512-fp8-lightning-4steps-v1.0`；只公开 `prompt`、`negativePrompt`、`seed`、`width`、`height`、`lightning4Steps`，其余模型、负面提示词和节点拓扑保持官方值。本次真实输入显式启用 Lightning 4 steps，seed 为 `20261114`。
- 应用级实例已实际写入 `userData/comfyui/instances.json`：`lan-4090` / `http://10.203.3.52:8000` / 启用 / RTX 4090 / 24 GB。
- 真实验收通过编译后的生产 `ComfyEngine`、HTTP 客户端、工作流映射、下载与 `registerAsset` 执行；Node 适配器仅提供 Electron `app.getPath('userData')` 及未调用的 `dialog/shell` 导出，未 mock ComfyUI、网络、作业、下载或资产登记。
- 真实请求 `feature-803-qwen2512-real-acceptance-001` 返回 jobId `job-b44912ba-aeab-401f-aea6-55f61210b48b`、promptId `fa465cba-e706-4267-b075-8d06bc736360`，轮询至 `completed`，`error: null`。
- PNG 收片到 `资产/生成/job-b44912ba-aeab-401f-aea6-55f61210b48b/Qwen-Image-2512_00002_.png`，大小 `1,924,844` 字节，PNG 文件头校验通过。目验为完整蓝色陶瓷茶杯、浅色木桌、柔和窗光、无文字，不是空图或错误图。
- 资产登记为 `ast-d7a94419024144f1b2d84c24ed59b004`，`comfyJobId` 与上述 jobId 一致；重复 `status` 后 outputs 不变，相同 requestId 重复 `queue` 返回相同 jobId/promptId/outputs，资产索引仍仅一条对应该 job 的记录。
- 生产工作流专项测试 6/6 通过；Comfy 设置、URL、客户端、工作流、引擎、dev mock、MCP、设置面板与 renderer 架构红线共 9 个文件 64/64 通过。

### 未做项

- 不实现 H3/Music3、通用 UI→API 转换、WebSocket 百分比、自动调度、DAG 或新生成页。
- 不处理上述非本包引入的 3 条类型错误和 10 条换行符断言失败。
- 资产中心 UI 可见性、第二实例选择与禁用实例拒绝新任务尚未单独真机验收，不以自动化覆盖冒称完成。
- 视频、音乐及工作流外部分发安装包不属于本次 qwen-image 真机试用范围。

## 2026-11-27 · 现行生成通道归一

**类别**：修订记录（D-033 已批准决策回流，不新立产品决策）。

- 将历史图像通道退出需求、契约和设计说明的新投实现依据；原实施与真机记录保留为历史，不改写当时事实。
- 803 继续拥有通用 manifest loader、作业与资产边界；H3 Image 生产条目、四项输入、固定 graph 和历史兼容单点引用 feature-816。
- 契约 v1.0 → v1.1：历史模型值改为 `MiniMax-H3`，补 `values?` 受控映射；既有 IPC／preload／MCP 路径和函数签名不变。破坏性通道迁移沿用 D-033 / feature-816 的既有批准，不新增 K1 / K7 / K8。
- 仅修改文档，不触碰代码、`shared/types.ts`、生产 manifest 或历史作业。自审 + 无第二人复核。

## 2026-11-15 · 三实例 H3 API 级落卡验证补记（A）

- 用户指定主机 `10.203.3.52` 的 8000 / 8001 / 8002 为三张 RTX 4090 一端口一卡，并选择仅做 API 级验证。启动参数声明映射为 `8000 → --cuda-device 0`、`8001 → --cuda-device 1`、`8002 → --cuda-device 2`；三实例 API 均只暴露一个名为 `cuda:0` 的设备，该名称不作为 OS 物理编号。
- 预检确认三实例 H3 必需节点、三项权重和空队列齐全。随后通过工作区外脚本直连三个 ComfyUI HTTP API，串行提交 0.1 MP H3 Image 任务，不经过应用内生产 `ComfyEngine`，不写应用实例配置、项目作业或资产索引。
- 三端口 promptId 分别为 `56b21d66-5f14-447d-982d-934b8e71b8c5`、`515fc7ad-11d1-42fe-a3ed-e8d29a4df48e`、`e66a881a-160b-4dbc-927c-10851c2f3673`；requestId / client_id / promptId / 运行队列 / completed 历史均匹配。每次目标实例显存显著下降且两个非目标实例稳定，三个 320×320 PNG 的文件头、字节数、SHA256 与内容目验通过。最终校验 `allPassed: true`，见 [validation.json](../../verification/gpu-placement-2026-11-15/validation.json) 与 [P0 基线报告 §5.3](../../verification/p0-2026-11-15/P0基线报告.md#53-2026-11-15-h3-image-逐端口串行任务实测仅-api-级)。
- 本次结论仅为 **API 级逐端口落卡通过**。未取得 `nvidia-smi`、GPU UUID、端口 → PID 或 OS 物理编号证据；未验证应用内第二实例选择、禁用实例拒绝新任务、资产中心 UI、生产作业恢复 / 资产登记及三路并发，AC-9 不因此封闭。
- 无产品行为变化，未修改产品代码、共享类型、依赖、IPC/MCP 或生产工作流，未新增卡口决策；未重跑 P0 全量测试与构建，未创建 Git commit。

## 偏差与风险

- 缺生产 API Format 工作流时 queue 返回 `WORKFLOW_NOT_AVAILABLE`，这是显式可用性边界，不以测试夹具冒充生产资产。
- 远端提交响应落盘前发生进程崩溃时，为避免重复生成，不自动重提缺 promptId 的作业；需人工核对 ComfyUI 历史。
