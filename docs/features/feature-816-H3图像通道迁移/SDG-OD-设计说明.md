# feature-816 · H3 图像通道迁移 · 设计说明

## 1. 适配策略

以 `resources/_ref_官方模板/H3/API/api_image_minimax_h3_image_t2i.json` 的 H3 Image 核心拓扑和采样参数为依据，保留三项专用权重、ResolutionSelector、MiniMaxH3ImageConditioning、ConditioningZeroOut、KSampler、VAEDecode 与 SaveImage。官方参考件中的扩写支路不作为生产依赖，避免引入当前实例未注册的 LLM/JSON 节点，也避免额外文本模型和不可控改写。

生产图与官方参考件只有两类确定性差异：

1. 用户 prompt 直接连接 Conditioning，不再经过自动扩写。
2. 仅保留实际出图所需节点；采样继续使用官方参考件的 `KSampler / euler / simple / 6 steps / CFG 1 / denoise 1`。

该适配不更换模型，不使用视频权重或云节点。

## 2. 受控映射

沿用深拷贝 API graph、仅修改 manifest 白名单节点字段的 loader。字符串映射表属于 manifest 数据，不允许调用方提交实例 UI 文本或节点路径；loader 在写入前校验稳定枚举并翻译为实例标签。数值和整数沿用 finite / safe integer 与 min/max 校验。

未提供可选输入时不写节点，因此 graph 内固定默认 seed、画幅、MP、采样参数保持不变。旧像素尺寸不推导画幅，避免静默改变历史调用语义。

## 3. 停用与历史作业

Qwen graph 以文件移动方式原字节归档，manifest 删除注册。生产 loader 只读取显式 manifest，不扫描目录，因此归档件不可执行。旧 ID 不设 H3 别名，防止历史请求被静默改成另一模型。

新提交在 `loadAndMapWorkflow` 阶段失败；已持久化 pending 作业的恢复路径只使用实例 ID 与 promptId 查询远端 history，不需要旧 graph，故保留只读续查和收片能力。

## 4. 文档与运行时分层

官方模板总览是参考基准和制作选型事实源，不代表生产注册表。三态文案统一区分“参考文件存在”和“生产已接入”。只有 H3 Image 文生图在本 Feature 后进入生产；其他 H3 与 Music3 模板仍待各自 Feature 契约、实例核验和验收。

原阶段采用“原始官方 JSON 不改写、Qwen 文件作为禁用基准保留”的设计。后续 C1 用户授权仅在 `_ref_官方模板` 内取代该文件保留策略：Qwen 专用参考件删除，H3/Music3 保留件重排且不改字节；历史资产来源和生产归档仍不篡改。

## 5. 验证层次

- 单元：manifest 白名单、四项映射、8 画幅、默认参数、非法输入、固定权重和拓扑。
- 回归：ComfyEngine 提交/幂等/收片/资产登记、旧 pending 续查、MCP 工具数量、feature-815 元数据与 UI。
- 真机：只读预检后，经生产引擎完成一次固定输入的 LAN H3 出图，并保留 job/prompt/资产证据。
- 构建：typecheck、全量测试、Electron/Vite build 与 `git diff --check`；既有失败单列，不越权修复。

## 6. 真机设计确认

2026-11-14 的真实 LAN 作业证明该精简兼容图可在目标实例完成出图：`MiniMaxH3ImageConditioning` 接受当前 CLIP、宽高与可选 VAE 连接，核心链无需恢复官方扩写支路，也未替换任何模型或权重。9:16 / 4 MP 经 `ResolutionSelector` 的 multiple 32 取整后输出 1536×2720，符合设计预期。作业、产物和资产证据集中记录于契约第七节，本设计无需因实测调整。

## 7. C1 参考库重排设计

参考库按模型与格式分两层：H3 的 17 份 UI 文件再按文生图、图像编辑、文生视频、图生视频、参考生视频、视频控制分为 6 个用途域，8 份 H3 API 文件集中于 `H3/API`；Music3 的 UI/API 各 1 份分别集中于 `Music3/UI` 与 `Music3/API`。合计 18 UI + 9 API、7 个用途域。该布局只改善人工查阅和索引，不被生产 loader 扫描，不形成新的生产注册或执行资格。

文件操作分为两个受控阶段：第一阶段在工作区外形成 27 删除、27 移动及移动前 SHA256 清单，校验两集合互斥、并集覆盖原 54 份、源存在、目标不存在、无大小写冲突和目录逃逸；随后仅移动保留件，复核 27/27 SHA256 与 JSON 解析。第二阶段只有在前述门槛全部通过后才按明确路径删除 27 份 Qwen 文件，并移除已确认为空的旧目录。任一失败均停止删除，按移动清单反向恢复。

删除不使用文件名通配或 `qwen` 内容匹配，避免误删 H3 的 `qwen3vl` 合法组件引用。生产 `_archive`、历史作业/图片/资产索引和 feature-815 内嵌元数据均不在移动或删除集合内。

文档按 A → B 顺序同步：先更新 Markdown 总览，再重渲染既有 HTML；索引只列当前 27 份文件，Qwen 仅保留“已从参考库删除、禁用且不可回退”的决策说明。完成后逐项验证数量、哈希、JSON、路径、链接、锚点和语义，再回写 Feature、D-033 终局状态及编年；既有生产测试与真机结果作为历史证据保留，不在本次静态清理中重跑。

### 7.7 C1 实施结果

实际执行与 §7.1–§7.6 一致：27 份保留件按显式映射移动，27/27 SHA256 与 JSON 解析通过；随后删除 27 份 Qwen 专用参考 JSON，并移除 11 个确认空目录。最终参考库为 18 UI + 9 API、7 个用途域，双总览各 27 个索引项与磁盘完全一致。

生产 loader、manifest、graph 与归档文件未进入本次写权；生产归档 SHA256 复测不变，历史 Qwen/H3 作业与资产仍可读，feature-815 的 18 PNG + 33 MP4 及其 51/51 内嵌元数据只读解析通过。完整实测值与边界证据见契约 §8.5；本次未重跑生产测试、构建或 LAN 生成。

## 8. C1 三类参考件后续清理设计（2026-11-15）

用户进一步要求“p_h3 fast pika_h3都不要”，并确认三类全部删除。现行参考方案收敛为 **MiniMax H3 主链参考件 + 独立 Music3**，不再保留 P-H3、FastH3/FastVideo、Pika H3 对照线。删除对象仅为契约 §9.2 列出的 8 份 UI Format JSON，不扩展到模型权重、LoRA、历史资产或生产归档。

删除前记录其余 19 份保留件的字节数与 SHA256；仅按明确路径删除，删除后复测 19/19 哈希与 JSON 解析，并将双总览索引收敛为 10 UI + 9 API、7 个用途域。`minimax_h3` 标准图像/视频参考路由、H3 Image 生产兼容图与 manifest 均不变；生产 loader 不扫描参考库，因此本清理不触发生产执行变化，也不重跑生产专项、构建或 LAN 生成。

### 8.1 后续清理实施结果

8 个明确目标已删除，19/19 保留件字节数、SHA256 与 JSON 解析复测通过；双总览各 19 项与磁盘一致，链接、锚点、HTML 结构和三类残留语义检查通过。生产归档、历史 Qwen/H3 作业与资产未变，feature-815 的 18 PNG + 33 MP4 共 51 份媒体内嵌元数据全部只读解析成功。完整实测值见契约 §9.4；本轮未改生产执行文件，未重跑生产专项、构建或 LAN 生成。

## 9. C2 新增 H3 API 文生图参考件登记设计（2026-11-15）

用户新增的 `H3/API/api_image_minimax_h3_t2i.json` 与既有 `H3/UI/01_文生图/image_minimax_h3_t2i.json` 使用相同 H3 UNet、视频 VAE 和可选 Turbo LoRA，可作为该 UI 参考的 API Format 配套件原样登记。第四节新增一行后，当前参考库为 20 份 JSON、10 UI + 10 API、7 个用途域。

本设计只改变参考索引与当前数量口径，不改变生产执行：loader 仍只读生产 manifest，manifest 仍只注册 `minimax-h3-image-t2i / h3-image-local-compat-v1.0`，新增参考件中的 FL2VA UNet、视频 VAE 和 Turbo LoRA 不进入生产 H3 Image 兼容图。C1 的 19 份记录和编年保持历史快照，不回改；本次仅做静态验证，不重跑生产专项、构建或 LAN 生成。

### 9.1 C2 实施结果

新增文件保持 4769 字节与原 SHA256，17 节点及输入引用完整，四类模型组件与配套 UI 一致。20/20 JSON 可解析，双总览各 20 个文件项且第四节各 10 API，本地链接、9 个锚点、HTML ID 与标签结构均通过。生产 manifest、9 节点 H3 Image graph、生产归档和历史资产边界复测通过，编年保持 92 项及 19 份历史快照；完整证据见契约 §10.4。

## 10. C3 Qwen 生产归档删除设计（2026-11-15）

生产 loader 只读取 manifest 显式注册项，不扫描 `resources/comfyui/workflows/` 或 `_archive/`。因此删除唯一 Qwen 归档不会改变 H3 工作流发现、输入映射、旧 ID 的 `WORKFLOW_NOT_AVAILABLE` 拒绝，或历史 pending 仅凭 `instanceId + promptId` 续查的路径；无需修改生产代码、测试 fixture、manifest 或 H3 graph。

本次采用单文件精确删除而非名称/内容匹配：删除前冻结归档的 6762 字节与 SHA256、20 份参考件聚合哈希、生产 manifest/graph 聚合哈希、历史项目资产与 51 份风格媒体聚合哈希；删除后仅在 `_archive` 为空时移除目录，并复测全部不变量。H3 graph 中的 `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` 是官方文本编码器，不是 Qwen-Image 生成 graph，必须保留。

用户已在范围确认中明确选择“删除生产归档”，并知悉该文件未纳入 Git、不可经 Git 恢复；本次无第二人复核。授权只局部取代原 K3 对这一份 graph 的只读保留，不取消历史作业、图片、资产索引和元数据保护。文档仍按 A → B 顺序同步，C1/C2 的“归档保留”实测段作为当时快照冻结，C3 只更新现行段落与终局状态，不新增项目级编年或 D-034。
