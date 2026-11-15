# feature-816 · H3 图像通道迁移 · 需求规格

> Feature：feature-816-H3图像通道迁移
> 关联：D-033（K7）；K2 / K3 / K8 已在获批计划中呈报
> 状态：生产迁移、参考库 C1 清理、C2 新增 H3 API 文生图参考件登记与 C3 Qwen 生产归档删除均已闭环；C3 专项 109/109 通过，全量 10 项既有失败与 typecheck 当前 3 项无关错误单列
> 日期：2026-11-14；后续修订：2026-11-15

## 一、用户拍板与目标

用户要求将 `resources/_ref_官方模板` 工作流方案完全改为 MiniMax H3，并明确：

1. **方案与生产一起改**。
2. H3 不能等价覆盖的 Qwen 图像 ControlNet、分层、透明底、多角度等专有能力**全部停用并归档**。

本 Feature 原阶段将现行参考方案统一为“图像仅 MiniMax H3 Image、视频仅 MiniMax H3、配乐仅独立 MiniMax Music3”，并把现有唯一 Qwen 文生图生产链替换为 H3 Image 文生图。原阶段同时约定保留全部原始官方模板；历史 Qwen 资产与生成元数据始终保留，不改写历史。

2026-11-14 用户追加授权：“`d:\Code\ai-shortdrama-studio\resources\_ref_官方模板`目录和文件可以重新整理，qwen可以删除了”。该 C1 授权仅在参考目录内局部取代原模板保留约束：删除 Qwen 专用参考 JSON、重排 H3/Music3；不扩展到历史资产、生成元数据或生产 `_archive`。

2026-11-15 用户进一步要求“请帮我整理目录并删除 qwen 相关文件”。经盘点，参考库已无 Qwen 文件，全仓唯一 Qwen 命名文件为生产归档 `resources/comfyui/workflows/_archive/qwen-image-2512-text.json`；用户在范围确认中明确选择“删除生产归档”，并接受该未纳入 Git 的文件删除后不可经 Git 恢复。该 C3 授权仅局部取代原 K3 对这一份生产 graph 的只读保留，不扩展到历史图片、资产、生成元数据、H3 官方 `qwen3vl` 文本编码器或无关文本模型配置。

## 二、依赖与现状

- feature-803 已交付生产 manifest、受控 workflow loader、ComfyEngine、实例设置与真实 Qwen 文生图链路；本 Feature 只接管其工作流注册、输入映射与引擎操作说明，不撤销其实例、多实例、幂等、收片和资产登记能力。
- 当前生产没有正式 H3 编辑、视频或音乐链；参考方案中的这些能力不得冒充生产已接入。
- `lan-4090 / http://10.203.3.52:8000` 预检已确认 H3 Image 专用 UNet、CLIP、VAE 与核心节点存在。
- 官方 H3 API 参考件的提示词扩写支路依赖当前实例不具备的节点，生产须使用同模型的本地兼容图。

## 三、范围

### P0 · 参考方案

- 重写 `官方模板基准库总览.md` 并同步 HTML 人读镜像。
- Qwen 全部退出主用、备选、成本档、组合链、迁移顺序和故障回退。
- 每类模板标明 `生产已启用` / `参考保留 / 生产未接入` / `归档禁用`。
- 原阶段约束：保留 45 份分类模板和根目录原始参考 JSON，不删除、不改写；该约束由后续 C1 在参考目录内局部取代。

### C1 · 参考库清理（已完成）

- 按获批明确清单删除 27 份 Qwen 专用参考 JSON，不按 `qwen` 字符串或通配符批量删除。
- 将 27 份 H3/Music3 保留件重排为 `H3/UI`、`H3/API`、`Music3/UI`、`Music3/API`，共 18 份 UI + 9 份 API、7 个用途域。
- 保留件不改文件名、不改字节；先移动并验证 27/27 SHA256 与 JSON 可解析，通过后才删除 Qwen 件。
- 同步双总览、Feature 五文件、D-033 终局状态、features README 和版本编年；不重开生产 loader、manifest 或 graph。

### C1 · 三类参考件后续清理（2026-11-15）

用户新增要求：“p_h3 fast pika_h3都不要”，并在范围追问后明确确认“三类全部删除”。本轮按契约 §9.2 的明确路径删除 2 份 P-H3、3 份 FastH3/FastVideo、3 份 Pika H3 UI Format 参考 JSON，共 8 份。

最终参考库只保留 MiniMax H3 主链与独立 Music3，共 19 份 JSON、10 UI + 9 API、7 个用途域。写权限于参考目录、双总览和本 Feature/关联治理编年文档；其余 19 份参考件保持文件名与 JSON 字节不变。不得删除模型权重、LoRA、历史项目作业/资产、生成元数据或生产 `_archive`，不得修改生产 loader、manifest、graph、IPC/MCP、shared 类型、设置 UI 或依赖。

### C2 · 新增 H3 API 文生图参考件登记（2026-11-15）

用户补充说明 `resources/_ref_官方模板/H3/API/api_image_minimax_h3_t2i.json`“增加了一个”。本轮仅将该新增文件登记为既有 `H3/UI/01_文生图/image_minimax_h3_t2i.json` 的 API Format 配套参考，不修改其 JSON 字节。

登记后当前参考库为 20 份 JSON、10 UI + 10 API、7 个用途域，其中 H3 UI 9、H3 API 9、Music3 UI/API 各 1。写权限于双总览和本 Feature/关联治理当前状态；不注册生产 manifest，不改生产 loader/graph，不把该参考件的 FL2VA UNet、视频 VAE 或 Turbo LoRA 引入 H3 Image 生产链，不修改既有 19 份参考件、历史资产或归档。

### C3 · Qwen 生产归档删除（2026-11-15，已授权）

- 只删除 `resources/comfyui/workflows/_archive/qwen-image-2512-text.json`，删除前基线为 6762 字节、SHA256 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`；不得使用 Qwen 通配符或按文件内容批量删除。
- 仅在 `_archive` 确认为空后移除该空目录；生产 loader 本来就不扫描归档，删除不改变 manifest、H3 graph、旧 ID 拒绝或 pending 续查语义。
- 参考库继续保持 20 份 JSON、10 UI + 10 API、7 用途域；H3 manifest/graph 与合法 `qwen3vl` 文本编码器不变。
- 历史项目作业、图片、资产索引、feature-815 风格媒体及内嵌元数据全部保留；不删除模型权重、LoRA 或无关 LM Studio Qwen 文本模型测试配置。
- 写权限于上述精确文件与空目录、双总览、本 Feature 五文件、D-033 终局状态及 features README；历史 C1/C2 记录与编年快照不改，不新增 D-034 或项目编年条目。

### P0 · 生产文生图

- 原阶段归档 `qwen-image-2512-text.json` 并撤销旧 workflowId；旧 ID 不设置别名、不改投、不回退。该归档的只读保留由后续 C3 单独授权局部取代。
- 新增 `minimax-h3-image-t2i` 本地兼容 API graph，仅使用 H3 Image 专用权重和 LAN ComfyUI。
- 将受控输入切换为 `prompt / seed / aspectRatio / megapixels`，拒绝旧字段与任意节点路径。
- 同步 MCP 工具描述与 comfyui-operator 操作契约，不新增工具、IPC、依赖或设置 UI。
- 历史 pending 作业可按既有 `promptId` 续查；历史作业、资产与 feature-815 风格媒体元数据不改写。

## 四、明确非目标

- 不新增 H3 图像编辑、视频、视频控制或 Music3 生产入口。
- 不把 Music3 称为 H3 音乐，不改变独立音乐通道。
- 不开放任意工作流、任意节点字段、像素宽高、负提示词或采样参数面板。
- 不使用 `MinimaxH3ImageNode` 云节点、云端媒体 Key、H3 视频权重或 Qwen-Image 回退。
- 不修改 `shared/types.ts`、package/lockfile、preload、实例设置 UI、feature-803/815 历史事实；参考 JSON 仅允许 C1 明确清单内的移动与删除，以及 C2 对用户新增文件的原样登记，既有参考件不得改字节。
- 不重跑无关全量实施，不修复既有 agent-profile / typecheck / showrunner 基线问题，不创建 git commit。

## 五、卡口与写权

| 卡口 | 结论 |
| --- | --- |
| K1 | 零触发：不改 `shared/types.ts` |
| K2 | 已呈报：官方模板节点版本不兼容，以同模型本地兼容图适配，不换模型、不增云通道 |
| K3 | 原阶段已呈报 Qwen 生产图停用归档、历史资产保留及旧 pending 仅续查；C3 已由用户明确选择“删除生产归档”，仅删除这一份未纳入 Git 的 graph，无第二人复核 |
| K7 | 用户已拍板图像通道反转，登记 D-033 |
| K8 | 已呈报：`comfyui.queue` 可用 workflowId 和 inputs 破坏性变更；工具数量与 IPC 不增加 |
| K9 | 零触发：不新增依赖，不改 package/lockfile |

本 Feature 原阶段独占 `electron/comfy/workflow.ts`、`resources/comfyui/workflows/` 现行注册与 graph、Comfy 工作流测试及 operator 参数说明。C1 写权仅扩展至 `resources/_ref_官方模板`、其双总览和本 Feature/关联治理编年文档，不重开生产文件写权。C3 写权仅扩展至精确 Qwen 生产归档及其空目录删除、双总览和本 Feature/关联治理当前状态，不重开 loader、manifest、H3 graph、shared 类型、依赖或 IPC/MCP。feature-803 保留其他未闭环事项；feature-815 不重开。

## 六、验收标准

- [x] AC1：参考方案及 HTML 镜像无 Qwen 现行路由，三态、格式边界与生产接入状态一致。
- [x] AC2：生产 manifest 仅暴露 `minimax-h3-image-t2i`；Qwen graph 原字节归档，旧 ID 返回 `WORKFLOW_NOT_AVAILABLE`。
- [x] AC3：H3 graph 保留指定三项权重与 `SaveImage` 输出链，无云节点、视频权重、Qwen-Image 生成权重或提示词扩写支路。
- [x] AC4：四项输入、8 种画幅、0.1–16 MP、缺省 16:9 / 4 MP / 6 步 / CFG 1 / multiple 32 / seed 0 精确生效；旧字段和非法输入 fail-fast。
- [x] AC5：提交、幂等、轮询、收片、资产登记及旧 pending 续查回归通过；feature-815 历史媒体与元数据可读。
- [x] AC6：在 `lan-4090` 以固定 requestId、9:16、4 MP、固定 seed 和中文 prompt 完成一次真实 H3 生成，下载有效图像并登记资产。
- [x] AC7：专项测试、构建与 diff 检查完成；既有基线单独记录，不冒充全绿。
- [x] AC8：D-033、根设计、AGENTS、Feature 五文件、features README 与版本记录同步。
- [x] AC9（C1）：27 份明确 Qwen 参考文件删除，27 份 H3/Music3 保留件无重复地迁至目标路径，参考库为 18 UI + 9 API、7 用途域。
- [x] AC10（C1）：27/27 保留件移动前后 SHA256 一致且 JSON 可解析；旧目录、根目录散落 API 文件和空目录壳清理完成。
- [x] AC11（C1）：Markdown/HTML 索引、数量、路径、状态和链接与磁盘一致；Qwen 仅为禁用/历史说明或合法 `qwen3vl` 组件，不存在现行路由。
- [x] AC12（C1）：生产 `_archive`、历史项目作业/图片/资产索引、feature-815 媒体及元数据未删除或改写，生产归档 graph 哈希不变。
- [x] AC13（C1）：Feature 五文件、D-033 终局状态、features README 与编年同步，临时清单清理，scoped diff 与 `git diff --check` 通过；既有 110/110 不冒充本次重跑。
- [x] AC14（2026-11-15 后续清理）：8 个明确目标均删除，参考库为 19 份 JSON、10 UI + 9 API、7 用途域；MiniMax H3 主链和 Music3 参考件无额外删除。
- [x] AC15（2026-11-15 后续清理）：19/19 保留件 SHA256 与删除前一致且 JSON 可解析；Markdown/HTML 索引各 19 项并与磁盘一致，链接、锚点、HTML 结构及三类残留语义检查通过。
- [x] AC16（2026-11-15 后续清理）：生产 loader、manifest、graph、生产归档、历史作业/资产、feature-815 媒体及元数据未受影响；不删除任何权重或 LoRA。
- [x] AC17（2026-11-15 后续清理）：Feature 五文件、D-033 终局状态、features README 与新编年同步，临时清单清理，scoped diff 与 `git diff --check` 通过；不重跑生产专项、构建或 LAN 生成，不创建 Git commit。
- [x] AC18（C2）：新增 API 文件保持原字节且 JSON、节点引用有效，与既有 UI 文生图参考模型组件一致；当前参考库为 20 份 JSON、10 UI + 10 API、7 用途域。
- [x] AC19（C2）：Markdown/HTML 双索引各 20 项并与磁盘一致，第四节为 10 份 API；链接、锚点、HTML ID/标签配对和当前数量口径通过。
- [x] AC20（C2）：生产 manifest/loader/graph、既有 19 份参考件、历史资产与归档不变；Feature 五文件、D-033 终局状态和 features README 同步，历史 19 份记录不改，未重跑生产专项、构建或 LAN 生成，未创建 Git commit。
- [x] AC21（C3）：精确 Qwen 生产归档已删除并移至系统回收站，空 `_archive` 已移除；全仓无 Qwen 命名文件，20 份参考 JSON 与 H3 manifest/graph 的删除前后聚合哈希一致，证据见契约 §11.2/§11.4。
- [x] AC22（C3）：生产仍仅注册 `minimax-h3-image-t2i`，旧 Qwen ID 拒绝与历史 pending 续查由专项回归覆盖；合法 `qwen3vl` 组件、历史项目作业/图片/资产、feature-815 媒体及元数据未删除或改写。
- [x] AC23（C3）：Feature 五文件、双总览、D-033 终局状态与 features README 已同步；双索引各 20 项，专项 109/109 通过，全量 10 项失败、typecheck 当前 3 项无关错误已如实记录。scoped diff 已审阅，全量 `git diff --check` 通过，仅既存 LF→CRLF 提示，未创建 Git commit。

## 七、失败边界

节点或权重缺失、OOM、超时、输出异常时如实记录并保持本 Feature 未闭环；不得恢复 Qwen、改用视频 UNet/VAE、调用云节点或宣称迁移完成。
