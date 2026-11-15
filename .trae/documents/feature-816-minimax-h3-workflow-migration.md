# feature-816 · MiniMax H3 工作流方案与生产图像通道迁移

## Context

用户要求将 `resources/_ref_官方模板` 的工作流方案完全改为 MiniMax H3，并已明确拍板：

1. **方案与生产一起改**，不是只改文档。
2. H3 不能等价覆盖的 Qwen 图像 ControlNet、分层、透明底、多角度等能力**全部停用并归档**。
3. 音乐继续使用独立的 MiniMax Music3；Music3 不属于 H3，不在本次改名或接入范围。

当前生产只有 `qwen-image-2512-text` 文生图，尚无正式 H3 编辑、视频或音乐生产链。本次以**替换现有文生图生产链**为最小完整范围，不借机扩张其他媒体能力。参考方案则全面退出 Qwen 现行选型、备选、成本档和故障回退。

只读预检 `lan-4090 / http://10.203.3.52:8000` 已确认：H3 Image 专用 UNet、CLIP、VAE 与核心 Conditioning/Resolution 节点存在；但官方 API 文件使用的 `H3PromptSampler`、`LLM_Loader`、`JsonExtractFromString` 不存在，故不能原样注册。生产采用同模型的本地兼容图，不使用 Qwen 回退、H3 视频权重或 `MinimaxH3ImageNode` 云节点。

## 一、治理、卡口与规格

### 1. 登记全局 D-033，保留历史事实

- 在 `docs/governance/SDG-AI-决策台账.md` 与 `SDG-AI-决策台账-2026.md` 登记 **D-033 / K7**：图像生成通道由 Qwen-Image 反转为 MiniMax H3 Image；只取代旧决策中的“图像仅 qwen-image”部分。
- 同步 `AGENTS.md`、`短剧Agent平台设计.md`、`docs/design/短剧Agent平台设计.html`、`版本记录.md`、`版本记录-2026.md`。根设计升为下一版本，历史 Qwen 真机记录保留并注明已由 D-033 停用，不改写历史。
- 保持以下边界不变：本地/局域网 ComfyUI、多实例、媒体生成零公网、无媒体云端 Key、renderer 不直连、统一主进程/MCP 引擎、音乐仅 Music3。
- H3 官方内部所需 `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` 文本编码器是 H3 工作流组件，不等于重新开放 Qwen-Image 生成通道。

### 2. 建立 feature-816 标准五文件任务包

目录：`docs/features/feature-816-H3图像通道迁移/`。

冻结 DTO、生产兼容图、输入映射、归档规则、测试与真机验收标准，并登记：

| 卡口 | 结论 |
| --- | --- |
| K1 | 零触发，不改 `shared/types.ts` |
| K2 | 本计划呈报官方模板节点版本不兼容及本地兼容图适配；不换模型、不增云通道 |
| K3 | 本计划呈报 Qwen 生产链停用、归档、历史资产保留及不可重新提交策略 |
| K7 | 用户已拍板通道反转，以 D-033 固化 |
| K8 | 本计划呈报 `comfyui.queue` 可用 workflowId 与 inputs 的破坏性变更；工具数量和 IPC 不增加 |
| K9 | 零触发，不新增依赖，不改 package/lockfile |

### 3. 划清与 feature-803/815 的写权

- feature-816 独占本次 `workflow.ts`、生产 manifest/graph、工作流测试及 operator 参数说明修改。
- feature-803 保留其实例设置、资产中心 UI、第二实例等未闭环事项和历史 Qwen 证据；后续实跑不得重新注册 Qwen。
- feature-815 不重开，既有 Qwen 风格媒体和元数据继续只读展示，不自动重生成。
- 更新 `docs/features/README.md` 及必要的文档索引/计数。

## 二、重写参考模板基准方案

事实源：`resources/_ref_官方模板/官方模板基准库总览.md`；同步 `官方模板基准库总览.html`。

1. 将现行方案统一为：**图像仅 MiniMax H3 Image，视频仅 MiniMax H3，配乐仅独立 MiniMax Music3**。
2. 删除 Qwen 在决策树、默认主链、主备表、成本档、组合链、迁移顺序和故障回退中的现行路由。
3. 对每份/每组模板明确三态：
   - `生产已启用`：仅本次 H3 Image 文生图。
   - `参考保留 / 生产未接入`：H3 编辑、视频、视频控制及 Music3 等。
   - `归档禁用`：全部 Qwen-Image 及其控制、分层、透明底、多角度、专用编辑链。
4. 原始 45 份分类模板和根目录参考 JSON **不删除、不改写**；“归档”是方案状态，不篡改官方基准文件。
5. 修正执行说明：分类目录为 UI Format，根目录 `api_*.json` 为 API 参考件，生产执行件位于 `resources/comfyui/workflows/`；UI JSON 不得直接提交 `/prompt`。
6. 明示参考可用不等于生产已接入，生产白名单只认 manifest；H3 编辑/视频/Music3 不在本次生产范围。
7. 记录生产兼容图与官方件的差异及原因，不把未真机验证的参考模板写成可运行能力。

## 三、迁移生产文生图工作流

### 1. 撤销 Qwen 注册并归档

- 从 `resources/comfyui/workflows/manifest.json` 删除 `qwen-image-2512-text`。
- 将 `resources/comfyui/workflows/qwen-image-2512-text.json` 原字节移至 `resources/comfyui/workflows/_archive/qwen-image-2512-text.json`，不被 loader 自动发现。
- 旧 workflowId 新提交返回 `WORKFLOW_NOT_AVAILABLE`，不设置别名、不自动改投 H3、不自动回退 Qwen。
- 历史作业与资产 JSON 不改写；旧 pending 作业仅可按既有 `promptId` 续查远端 history，不支持重新提交 Qwen graph。

### 2. 新增 H3 Image 生产兼容图

新增 `resources/comfyui/workflows/minimax-h3-image-t2i.json`，以 `resources/_ref_官方模板/api_image_minimax_h3_image_t2i.json` 为拓扑与参数依据，注册：

- `workflowId`: `minimax-h3-image-t2i`
- `kind`: `image`
- `model`: `MiniMax-H3`

兼容图保留 H3 Image 专用 `UNETLoader + CLIPLoader(minimax) + VAELoader + ResolutionSelector + MiniMaxH3ImageConditioning + ConditioningZeroOut + VAEDecode + SaveImage`，并进行两项确定性适配：

- 用实例已注册的标准 `KSampler` 替代缺失的 `H3PromptSampler`，保留官方 `euler / simple / 6 steps / CFG 1 / denoise 1`。
- 生产默认直接将受控 prompt 送入 `MiniMaxH3ImageConditioning`，移除依赖缺失 LLM/JSON 节点的自动提示词扩写支路；不使用云文本或云图像节点。

保留官方 `multiple=32` 与 `4 MP` 默认；画幅默认 `16:9 (Widescreen)`，seed 默认 0。权重必须保持：
`minimax_h3_image_pruned_int8_convrot.safetensors`、`qwen3vl_32b_minimax_h3_int8_convrot.safetensors`、`minimax_h3_image_vae_fp16.safetensors`，不得混入 H3 视频或 Qwen-Image 权重。

### 3. 切换受控输入契约

修改 `electron/comfy/workflow.ts` 的 manifest 白名单与映射校验，仅接受 `kind=image / model=MiniMax-H3`，继续禁止任意节点路径和未声明字段。

| 对外输入 | 规则 | graph 目标 |
| --- | --- | --- |
| `prompt` | 非空字符串、必填 | Conditioning 的 `prompt` |
| `seed` | 可选，非负安全整数 | KSampler 的 `seed` |
| `aspectRatio` | 可选稳定枚举，默认 16:9 | ResolutionSelector 的 `aspect_ratio` |
| `megapixels` | 可选有限数，按实例约束 0.1–16，默认 4 | ResolutionSelector 的 `megapixels` |

画幅稳定值按只读 `/object_info` 已确认的 8 项映射：`1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 9:16 / 16:9 / 21:9`，例如 `9:16 → 9:16 (Portrait Widescreen)`。在 manifest 中声明受控值映射，不开放任意 UI 文本。

删除并明确拒绝旧字段 `width / height / negativePrompt / lightning4Steps`；不要把 `negativePrompt` 错接到 `ConditioningZeroOut`，也不要自动换算旧像素尺寸。未提供 steps/cfg 时保持兼容图官方 6 步、CFG 1，不新增无要求的采样参数面板。

### 4. 同步调用说明，不扩大 UI/IPC

- 更新 `electron/mcp/tools.ts` 中 Qwen 专属描述为 H3；`comfyui.queue` 工具数量、基本参数形状和 IPC 均不变。
- 更新 `resources/opencode/agents/comfyui-operator.md`：唯一生产 workflowId、四项输入、默认值、旧字段拒绝、Qwen 归档及禁止回退规则。
- 不修改 `shared/types.ts`、engine/client 的媒体结构、ComfyUI 实例设置 UI、preload 或 package.json；不新增 H3 编辑/视频/音乐生产入口。

## 四、自动化验证

重点更新 `src/test/comfy/comfy-workflow.test.ts`，并调整受 manifest 白名单影响的 engine/MCP 测试：

1. 生产 manifest 只有 H3 文生图；拒绝 Qwen、其他模型、非 image kind 和旧 workflowId。
2. prompt/seed/aspectRatio/megapixels 精确映射，缺省保留 16:9、4 MP、6 步、CFG 1、multiple 32。
3. 8 种画幅映射及非法画幅、越界/NaN MP、空 prompt、负 seed、非法类型 fail-fast。
4. `width / height / negativePrompt / lightning4Steps` 与未知字段全部拒绝。
5. H3 专用 UNet/CLIP/VAE 保持不变，无视频权重、云节点、Qwen-Image 生成权重；`ConditioningZeroOut` 不被误用为负提示词。
6. SaveImage 输出链、非目标节点不变、源 graph 不被原地修改；缺节点、路径穿越和错误格式继续拒绝。
7. engine 的提交、幂等、轮询、收片、资产登记使用 H3 fixture；另保留旧 Qwen pending 作业只能续查、不能新提交的兼容用例。
8. MCP 示例与断言改用 H3 workflowId，确认无新增工具；设置页与 dev mock 零回归。
9. 回归 feature-815 元数据和 VisualCatalog，历史 Qwen 风格媒体仍可读且不被改写。

执行 Comfy/MCP/style 专项、`npx tsc --noEmit`、`npm run test:run`、`npm run build:electron`、`npx vite build` 和 `git diff --check`。既有 agent-profile/typecheck 基线问题单独列出，不越权修复、不冒充全绿。

## 五、真实局域网验收

目标：`lan-4090 → http://10.203.3.52:8000`。通过一次性验收入口直接复用生产 manifest、workflow loader、`ComfyEngine` 与实例配置，不手拼一份绕过校验的 graph，不新增依赖或永久脚本。

1. 提交前再次核验 `/system_stats` 与 `/object_info`：所有实际执行节点、H3 三项权重、8 个画幅枚举和 MP 范围；缺项即停止，不发 `/prompt`。
2. 使用固定中文场景 prompt、固定 seed、`aspectRatio=9:16`、`megapixels=4`，requestId 为 `feature-816-minimax-h3-real-acceptance-001`。
3. 经生产引擎提交一次，记录 workflowId/version、requestId/jobId/promptId、实际映射字段、实例状态与错误；全程仅访问 LAN，无云 Key。
4. 验证任务 `completed`，下载至少一个有效 PNG/JPG，文件非空且图像内容可辨识，实际尺寸符合 9:16 与约 4 MP 的节点取整结果，资产登记可读。
5. 验证旧 Qwen workflowId 新提交被拒绝，既有 Qwen 资产与 feature-815 风格元数据仍可读。
6. 保存真实产物和验收证据，清理临时 runner/截图；回写 feature-816 五文件、D-033、features README 和版本记录。

若节点/权重缺失、OOM、超时或输出异常，如实记录失败并保持 feature-816 未闭环；不得恢复 Qwen、改用视频 UNet/VAE、调用云节点或宣称迁移完成。

## 六、完成定义与保护项

完成必须同时满足：参考方案无 Qwen 现行路由；Qwen 生产 graph 已归档且不可提交；manifest 仅暴露 H3 文生图；自动化与构建通过或明确区分既有基线；真实 H3 生成、收片和资产登记通过；治理记录同步。

`shared/types.ts`、package/lockfile、原始参考 JSON、H3-Style 媒体及 feature-815 规格保持零非授权修改。不重写 feature-803/815 历史，不自动重生成旧资产，不提交 git commit。
