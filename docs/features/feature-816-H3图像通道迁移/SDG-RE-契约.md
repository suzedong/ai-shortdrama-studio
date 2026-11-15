# feature-816 · H3 图像通道迁移 · 契约

> 版本：v1.4（2026-11-15，C3 删除 Qwen 生产归档）
> 写权：feature-816；关联全局决策 D-033
> 兼容级别：工作流注册与输入破坏性迁移；不新增 IPC / 工具 / 依赖
> 履历：v1.0 完成 H3 生产迁移与真机验收；v1.1 仅追加用户授权的参考库删除、重排与文档同步契约，不重开生产执行契约；v1.2 按用户新增授权删除 P-H3、FastH3/FastVideo、Pika H3 共 8 份 UI 参考件，生产契约不变；v1.3 仅登记用户新增的 H3 API 文生图参考件，生产契约不变；v1.4 按用户明确选择删除唯一 Qwen 生产归档及空目录，生产 loader、manifest、H3 graph 与历史兼容契约不变

## 一、生产 manifest 契约

文件：`resources/comfyui/workflows/manifest.json`

现行唯一条目：

| 字段 | 值 |
| --- | --- |
| `schemaVersion` | `1` |
| `id` | `minimax-h3-image-t2i` |
| `version` | `h3-image-local-compat-v1.0` |
| `kind` | `image` |
| `model` | `MiniMax-H3` |
| `file` | `minimax-h3-image-t2i.json` |

loader 仅接受 `kind=image / model=MiniMax-H3`。其他模型、其他 kind、重复 ID、非 API Format、目录逃逸和未声明输入继续拒绝。

旧 `qwen-image-2512-text` 不注册、不设置别名；新提交返回 `WORKFLOW_NOT_AVAILABLE`。原阶段归档文件曾位于 `resources/comfyui/workflows/_archive/qwen-image-2512-text.json`；C3 经用户明确授权删除该文件并移除空 `_archive` 目录。loader 始终只读取显式 manifest，不自动扫描目录。

## 二、comfyui.queue 输入契约

工具形状保持：

```json
{
  "instanceId": "lan-4090",
  "workflowId": "minimax-h3-image-t2i",
  "requestId": "feature-816-minimax-h3-real-acceptance-001",
  "inputs": {
    "prompt": "雨夜老城巷口，女主撑透明雨伞回头，电影感，竖屏短剧剧照",
    "seed": 20261114,
    "aspectRatio": "9:16",
    "megapixels": 4
  }
}
```

| 输入 | 类型与约束 | 缺省 | graph 目标 |
| --- | --- | --- | --- |
| `prompt` | string，去首尾空白后 1–8000 字符，必填 | 无 | `23:5.inputs.prompt` |
| `seed` | integer，0–9007199254740991 | `0` | `23:7.inputs.seed` |
| `aspectRatio` | 下表 8 个稳定枚举之一 | `16:9` | `14.inputs.aspect_ratio` |
| `megapixels` | finite number，0.1–16 | `4` | `14.inputs.megapixels` |

画幅映射只允许 manifest 声明的受控值：

| 对外值 | 实例节点值 |
| --- | --- |
| `1:1` | `1:1 (Square)` |
| `2:3` | `2:3 (Portrait Photo)` |
| `3:2` | `3:2 (Photo)` |
| `3:4` | `3:4 (Portrait Standard)` |
| `4:3` | `4:3 (Standard)` |
| `9:16` | `9:16 (Portrait Widescreen)` |
| `16:9` | `16:9 (Widescreen)` |
| `21:9` | `21:9 (Ultrawide)` |

manifest 字符串输入可增加 `values: { 稳定值: 实际节点值 }`；提供该表时仅接受表内键，写入对应字符串。未提供 `values` 的字符串仍按原有长度规则处理。

旧字段 `width / height / negativePrompt / lightning4Steps` 与所有未知字段返回 `INVALID_ARGUMENT`。不把 `negativePrompt` 映射到 `ConditioningZeroOut`，不自动换算旧像素尺寸，不开放 steps / cfg / sampler / scheduler。

## 三、H3 API graph 固定结构

文件：`resources/comfyui/workflows/minimax-h3-image-t2i.json`

| 节点 | 类型 | 固定职责 |
| --- | --- | --- |
| `23:1` | `UNETLoader` | `minimax_h3_image_pruned_int8_convrot.safetensors`，`weight_dtype=default` |
| `23:2` | `CLIPLoader` | `qwen3vl_32b_minimax_h3_int8_convrot.safetensors`，`type=minimax`，`device=default` |
| `23:3` | `VAELoader` | `minimax_h3_image_vae_fp16.safetensors` |
| `14` | `ResolutionSelector` | 默认 `16:9 (Widescreen)`、4 MP、`multiple=32` |
| `23:5` | `MiniMaxH3ImageConditioning` | 受控 prompt + 节点 14 宽高 + CLIP + VAE |
| `23:6` | `ConditioningZeroOut` | 对 `23:5` 条件零化，只连接 sampler negative |
| `23:7` | `KSampler` | seed 0、6 steps、CFG 1、euler、simple、denoise 1 |
| `23:8` | `VAEDecode` | 解码 `23:7` latent，使用 `23:3` VAE |
| `9` | `SaveImage` | 保存 `23:8` 图像，prefix `minimax_h3_image_t2i` |

生产 prompt 直接进入 `23:5`；移除自动提示词扩写支路及其 LLM/JSON 节点。`qwen3vl_32b_minimax_h3_int8_convrot.safetensors` 是 H3 官方文本编码器组件，不构成 Qwen-Image 生成通道回退。

禁止出现：`MinimaxH3ImageNode`、H3 视频 UNet/VAE、Qwen-Image 生成 UNet/LoRA、任意云端媒体调用。

## 四、历史兼容契约

- 历史作业、资产和风格媒体 JSON 不改模型名、工作流 ID、文件路径或元数据。
- 旧 pending 作业只根据已持久化 `instanceId + promptId` 查询 history、下载和登记；不得重新加载或提交归档 Qwen graph。
- 旧 workflowId 的新 queue 请求即使带合法 H3 inputs 也返回 `WORKFLOW_NOT_AVAILABLE`，不自动改投。
- feature-815 继续按真实文件内嵌元数据展示历史 Qwen 图片和视频，不重生成、不伪造 H3 参数。

## 五、参考方案三态契约

| 状态 | 范围 |
| --- | --- |
| `生产已启用` | 仅 H3 Image 文生图生产兼容图 |
| `参考保留 / 生产未接入` | H3 编辑、T2V/I2V/R2V、视频控制、Music3 等原始参考模板 |
| `删除禁用` | 全部 Qwen-Image 及其编辑、ControlNet、分层、多角度、透明底等专用链，以及 P-H3、FastH3/FastVideo、Pika H3 对照线已从本参考库删除，禁止现行路由与回退 |

C1 后 UI Format 位于 `H3/UI/<用途域>/` 与 `Music3/UI/`；API Format 参考件位于 `H3/API/` 与 `Music3/API/`。生产执行件仅以 `resources/comfyui/workflows/manifest.json` 显式注册为准。生产 `_archive` 不属于参考库清理范围，但已由 C3 的独立明确授权删除；历史资产、生成元数据与风格媒体仍不属于任何删除范围。

## 六、真实验收契约

- 实例：`lan-4090 → http://10.203.3.52:8000`，仅 LAN，无云 Key。
- 提交前通过 `/system_stats` 与 `/object_info` 核验执行节点、三项权重、8 个画幅和 MP 范围；缺项即停止。
- 固定 `requestId=feature-816-minimax-h3-real-acceptance-001`、中文场景 prompt、固定 seed、`aspectRatio=9:16`、`megapixels=4`。
- 必须复用生产 manifest、loader 和 ComfyEngine；记录 workflowId/version、requestId/jobId/promptId、实际映射、状态与错误。
- 通过条件：作业 `completed`，至少一个有效 PNG/JPG 非空且内容可辨识，尺寸符合 9:16 与约 4 MP 的节点取整结果，资产登记可读。
- 另验旧 Qwen ID 新提交被拒绝、历史 Qwen 资产与 feature-815 元数据仍可读；保存证据并清理一次性 runner。

## 七、真实验收实测记录（2026-11-14）

验收项目目录：`C:\Users\SZD\Documents\ai-shortdrama-studio\project-20261101-184536-ly8v`。以下结果由正式生产 manifest、loader 与 ComfyEngine 产生，未使用云节点、Qwen 回退或视频权重。

| 项目 | 实测证据 |
| --- | --- |
| 预检 | 实例健康检查通过；9 个核心节点、三项 H3 Image 权重、8 个画幅标签与 MP 范围均已核验 |
| 工作流 | `minimax-h3-image-t2i / h3-image-local-compat-v1.0`；固定 requestId 与本契约第二节完全一致 |
| 实际映射 | prompt 原样进入 `23:5`；seed `20261114`；`9:16 → 9:16 (Portrait Widescreen)`；megapixels `4`；其余采样参数保持 graph 固定值 |
| 作业 | jobId `job-192c3766-ba8a-4b31-b523-05d2e5b59870`；promptId `ae93ee5a-cb09-41e7-b003-187e58f6a565`；最终状态 `completed`，error 为 null |
| 输出 | `资产/生成/job-192c3766-ba8a-4b31-b523-05d2e5b59870/minimax_h3_image_t2i_00018_.png`；1536×2720，4,245,149 字节，内容可辨识 |
| 完整性 | SHA256 `e0ca1d1dd9b053c419df5a4fe900675682e6a1de0a9109ec5fd111eaf6462a98` |
| 资产登记 | `资产/asset-index.json` 存在 `a-image-5ab56db7`，sourceJobId、workflowId/version、inputs、promptId 与输出节点 `9` 均可读 |
| 幂等 | 同参数 replay 返回上述同一 jobId 与 promptId，未创建第二份作业或资产 |
| 旧通道拒绝 | 旧 `qwen-image-2512-text` 新提交返回 `WORKFLOW_NOT_AVAILABLE`，未发起 Qwen graph 提交 |
| 历史保留 | 原 Qwen 作业与资产 `a-image-6751e2c9` 仍在索引中且图片实际可读；feature-815 的 55 项媒体、元数据与 UI 回归通过 |

自动化另完成 Comfy / MCP / style 6 文件 110 项测试及 Electron / Vite 构建。全量测试与 typecheck 的既有失败按变更记录单列，不属于本 Feature 新增回归。

## 八、C1 参考库清理执行契约（2026-11-14）

### 8.1 授权与目标布局

用户明确授权重新整理 `resources/_ref_官方模板` 并删除其中 Qwen 文件。本契约只覆盖该目录、双总览及治理编年回写；不改变第一至第七节已经验收的生产与历史兼容契约。

目标为 27 份 JSON、7 个用途域：`H3/UI/01_文生图` 3 份、`02_图像编辑` 2 份、`03_文生视频` 3 份、`04_图生视频` 4 份、`05_参考生视频` 4 份、`06_视频控制` 1 份，`H3/API` 8 份，`Music3/UI` 与 `Music3/API` 各 1 份。旧 `01`–`11` 目录清空后移除，根目录不再保留散落的 `api_*.json`。

### 8.2 明确删除清单

以下相对路径均以 `resources/_ref_官方模板` 为根，共 27 份：

- `01_文生图`：`image_qwen_image.json`、`image_qwen_Image_2512.json`、`image_qwen_image_2512_with_2steps_lora.json`、`template_qwen_Image_2512_360_lora.json`、`image_qwen_image_2_1_t2i.json`、`image_qwen_image_2_1_turbo_t2i.json`。
- `02_图像编辑`：`image-qwen_image_edit_2511_lora_inflation.json`、`image_qwen_image_2_1_image_edit.json`、`image_qwen_image_2_1_turbo_image_edit.json`、`image_qwen_image_edit.json`、`image_qwen_image_edit_2509.json`、`image_qwen_image_edit_2509_relight.json`、`image_qwen_image_edit_2511.json`、`image_qwen_image_edit_2511_int8.json`、`template_qwen_image_edit_2511_systms_action.json`、`templates-image_to_real.json`、`templates-portrait_light_migration.json`。
- `03_图像分层`：`image_qwen_image_layered.json`、`image_qwen_image_layered_control.json`。
- `04_控制网与构图约束`：`image_qwen_image_controlnet_patch.json`、`image_qwen_image_union_control_lora.json`、`image_qwen_image_instantx_inpainting_controlnet.json`、`image_qwen_image_instantx_controlnet.json`、`image_qwen_Image_2512_controlnet.json`。
- `05_多角度批量`：`templates-1_click_multiple_character_angles-v1.0.json`、`templates-1_click_multiple_scene_angles-v1.0.json`。
- `11_抠图与透明底`：`image_qwen_image_2_1_background_removal.json`。

只允许按这些明确路径删除，禁止 `qwen` 通配符或按内容字符串批量处理；H3 的 `qwen3vl` 文本编码器不是删除依据。

### 8.3 保留件移动清单

以下 27 个 `源 → 目标` 均相对参考库根目录，文件名与字节不变：

| 源 | 目标 |
| --- | --- |
| `01_文生图/image_minimax_h3_image_t2i.json` | `H3/UI/01_文生图/image_minimax_h3_image_t2i.json` |
| `01_文生图/image_minimax_h3_t2i.json` | `H3/UI/01_文生图/image_minimax_h3_t2i.json` |
| `01_文生图/image_p_h3_t2i.json` | `H3/UI/01_文生图/image_p_h3_t2i.json` |
| `02_图像编辑/image_minimax_h3_image_edit.json` | `H3/UI/02_图像编辑/image_minimax_h3_image_edit.json` |
| `02_图像编辑/image_p_h3_image_edit.json` | `H3/UI/02_图像编辑/image_p_h3_image_edit.json` |
| `06_文生视频/video_minimax_h3_t2v.json` | `H3/UI/03_文生视频/video_minimax_h3_t2v.json` |
| `06_文生视频/video_fastvideo_fasth3_t2v.json` | `H3/UI/03_文生视频/video_fastvideo_fasth3_t2v.json` |
| `06_文生视频/video_pika_h3_flex_t2v.json` | `H3/UI/03_文生视频/video_pika_h3_flex_t2v.json` |
| `07_图生视频/video_minimax_h3_i2v.json` | `H3/UI/04_图生视频/video_minimax_h3_i2v.json` |
| `07_图生视频/video_minimax_h3_i2v_continuation.json` | `H3/UI/04_图生视频/video_minimax_h3_i2v_continuation.json` |
| `07_图生视频/video_fastvideo_fasth3_i2v.json` | `H3/UI/04_图生视频/video_fastvideo_fasth3_i2v.json` |
| `07_图生视频/video_pika_h3_flex_fl2va.json` | `H3/UI/04_图生视频/video_pika_h3_flex_fl2va.json` |
| `08_参考生视频/video_minimax_h3_r2v.json` | `H3/UI/05_参考生视频/video_minimax_h3_r2v.json` |
| `08_参考生视频/video_minimax_h3_multiframe_reference.json` | `H3/UI/05_参考生视频/video_minimax_h3_multiframe_reference.json` |
| `08_参考生视频/video_fasth3_ominiref_r2v.json` | `H3/UI/05_参考生视频/video_fasth3_ominiref_r2v.json` |
| `08_参考生视频/video_pika_h3_flex_ref2va.json` | `H3/UI/05_参考生视频/video_pika_h3_flex_ref2va.json` |
| `09_视频控制/video_minimax_h3_fun_controlnet_union.json` | `H3/UI/06_视频控制/video_minimax_h3_fun_controlnet_union.json` |
| `10_配乐与音频/audio_minimax_music_3.json` | `Music3/UI/audio_minimax_music_3.json` |
| `api_image_minimax_h3_image_t2i.json` | `H3/API/api_image_minimax_h3_image_t2i.json` |
| `api_image_minimax_h3_image_edit.json` | `H3/API/api_image_minimax_h3_image_edit.json` |
| `api_video_minimax_h3_t2v.json` | `H3/API/api_video_minimax_h3_t2v.json` |
| `api_video_minimax_h3_i2v.json` | `H3/API/api_video_minimax_h3_i2v.json` |
| `api_video_minimax_h3_i2v_continuation.json` | `H3/API/api_video_minimax_h3_i2v_continuation.json` |
| `api_video_minimax_h3_r2v.json` | `H3/API/api_video_minimax_h3_r2v.json` |
| `api_video_minimax_h3_multiframe_reference.json` | `H3/API/api_video_minimax_h3_multiframe_reference.json` |
| `api_video_minimax_h3_fun_controlnet_union.json` | `H3/API/api_video_minimax_h3_fun_controlnet_union.json` |
| `api_audio_minimax_music_3.json` | `Music3/API/api_audio_minimax_music_3.json` |

### 8.4 操作门槛与失败停止

1. 在工作区外生成删除、移动与哈希清单；删除和移动集合必须互斥，并集恰好覆盖现有 54 份 JSON。
2. 所有源文件必须存在、目标必须不存在；相对路径规范化后不得逃逸参考库，不得有重复目标或大小写冲突。
3. 先记录 27 份保留件 SHA256，再移动；移动后 27/27 哈希一致且 JSON 全部可解析，才开放删除步骤。
4. 任一预检、移动、哈希或解析失败，禁止删除 Qwen 件；按移动清单反向恢复已移动文件并复核。
5. 删除后核对 27 个目标、目录分布和旧空目录；同步 Markdown 后再同步 HTML，校验索引、相对链接、HTML ID/锚点与 Qwen 残留语义。
6. 生产 `_archive/qwen-image-2512-text.json` 在 C1 预检时经 PowerShell 与 Node 双工具实测，SHA256 均为 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`（6762 字节）；以此实测值作为本次不变基线，历史项目资产与元数据不在操作集合中。
7. 完成证据回写后清理工作区外临时文件。本次静态清理不重跑或重述既有 110/110 专项、构建和 LAN 验收为新结果。

### 8.5 C1 实际执行与静态验收证据

- **文件操作**：27/27 保留件已按 §8.3 映射迁至目标路径，移动前后 SHA256 与字节数全部一致，27/27 JSON 均可解析；27 个原源路径与 §8.2 的 27 个删除路径均不存在。11 个旧用途目录仅在确认空目录后移除，根目录散落 `api_*.json` 为零。
- **最终布局**：参考库共有 27 份 JSON，分布为 H3 UI 17、H3 API 8、Music3 UI 1、Music3 API 1，合计 18 UI + 9 API、7 个用途域；保留件文件名和 JSON 字节未改。
- **双总览**：Markdown 与 HTML 的第三、四节索引各 27 项，与磁盘一一对应，无缺失、额外或重复项；本地链接、9 个页内锚点、HTML ID 唯一性与标签配对检查通过。Qwen 残留逐行复核仅属删除禁用、历史兼容、生产归档边界或 H3 合法 `qwen3vl` 编码器说明，无已删除文件索引、现行路由或回退。
- **历史与生产边界**：`resources/comfyui/workflows/_archive/qwen-image-2512-text.json` 仍为 6762 字节，SHA256 复测保持 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`。历史项目中 Qwen 作业 `job-b44912ba-aeab-401f-aea6-55f61210b48b`、资产 `a-image-6751e2c9` 与 H3 作业 `job-192c3766-ba8a-4b31-b523-05d2e5b59870`、资产 `a-image-5ab56db7` 均保留且图片可读；H3 PNG SHA256 仍为 `e0ca1d1dd9b053c419df5a4fe900675682e6a1de0a9109ec5fd111eaf6462a98`。
- **feature-815 边界**：`resources/H3-Style/_style_preview/` 的 18 份 PNG 与 33 份 MP4 均存在；使用既有 `parseStylePreviewMetadata` 逐份只读解析，51/51 状态为 `ok` 且均取得真实提示词，未改写媒体或元数据。
- **测试口径**：C1 是参考文件与文档清理，未重跑生产专项、全量测试、构建或 LAN 生成；既有 110/110 仅是此前生产迁移验收结果，不作为本轮新跑证据。
- **F8 封闭证据**：C1 scoped status / diff 已核对，参考目录与 feature-816 任务包的未跟踪集合由磁盘清单、哈希和双索引补充验证；工作区前序生产迁移及其他既有改动不归入 C1。工作区外 4 份临时清单及其空目录已删除，2026 编年正文与总索引均复核为 91 项且无重复、日期倒序，D-033 总索引链接有效且未新增 D-034；全量 `git diff --check` 通过。

## 九、C1 三类参考件后续清理契约（2026-11-15）

### 9.1 用户授权与最终基线

用户原话为“p_h3 fast pika_h3都不要”，并明确确认“三类全部删除”。本轮只删除 P-H3、FastH3/FastVideo、Pika H3 的 8 份 UI Format 参考 JSON，保留 MiniMax H3 主链与独立 Music3。

§8.3 是 2026-11-14 已完成移动的历史契约记录，保持不改；本节仅取代其中 8 份文件继续作为现行参考保留的效力。最终参考库为 19 份 JSON、10 UI + 9 API、7 个用途域：H3 UI 9、H3 API 8、Music3 UI 1、Music3 API 1。

### 9.2 明确删除清单

以下相对路径均以 `resources/_ref_官方模板` 为根，只允许逐路径删除，禁止按 `fast`、`p_h3`、`pika_h3` 或文件内容匹配批量处理：

1. `H3/UI/01_文生图/image_p_h3_t2i.json`
2. `H3/UI/02_图像编辑/image_p_h3_image_edit.json`
3. `H3/UI/03_文生视频/video_fastvideo_fasth3_t2v.json`
4. `H3/UI/03_文生视频/video_pika_h3_flex_t2v.json`
5. `H3/UI/04_图生视频/video_fastvideo_fasth3_i2v.json`
6. `H3/UI/04_图生视频/video_pika_h3_flex_fl2va.json`
7. `H3/UI/05_参考生视频/video_fasth3_ominiref_r2v.json`
8. `H3/UI/05_参考生视频/video_pika_h3_flex_ref2va.json`

删除后 UI 分布固定为：`01_文生图` 2 份、`02_图像编辑` 1 份、`03_文生视频` 1 份、`04_图生视频` 2 份、`05_参考生视频` 2 份、`06_视频控制` 1 份、`Music3/UI` 1 份，合计 10 份；API 参考件仍为 9 份。

### 9.3 操作与不变边界

1. 删除前确认当前 27 份 JSON 与 8 个目标全部存在，在工作区外记录其余 19 份保留件的 SHA256 与字节数，并复测生产归档哈希。
2. 删除后 19/19 保留件 SHA256 与字节数必须不变、JSON 全部可解析，8 个目标路径均不存在；任一不符即停止封闭并报告。
3. 先更新 Markdown 总览，再同步既有 HTML。双索引各 19 项并与磁盘一一对应，三类对照线退出全部现行路由、补充参考与回退说明。
4. 不删除模型权重、LoRA、历史项目作业/资产、生成元数据或生产 `_archive`；不修改生产 loader、manifest、graph、IPC/MCP、shared 类型、设置 UI 或依赖。
5. 本清理仅做静态文件与文档验证，不重跑生产专项、全量测试、构建或 LAN 生成；既有生产验收结果继续作为历史证据，不冒充本轮新跑。
6. 证据回写后清理工作区外临时清单，不创建 Git commit。

### 9.4 后续清理实际执行与静态验收证据

- **文件操作与最终布局**：8/8 明确目标均已删除且路径不存在；其余 19/19 保留件字节数与 SHA256 和删除前一致，JSON 全部可解析。当前 H3 UI 9、H3 API 8、Music3 UI 1、Music3 API 1，合计 19 份 JSON、10 UI + 9 API、7 个用途域。
- **双总览**：Markdown 与 HTML 的第三、四节索引各 19 项，与磁盘一一对应，无缺失、额外或重复项；本地链接、9 个页内锚点、HTML ID 唯一性与标签配对检查通过。三类名称仅存于删除禁用说明和历史记录，不存在已删除文件索引、现行备用或回退路由。
- **历史与生产边界**：`resources/comfyui/workflows/_archive/qwen-image-2512-text.json` 仍为 6762 字节，SHA256 复测保持 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`。历史项目中 Qwen 作业 `job-b44912ba-aeab-401f-aea6-55f61210b48b`、资产 `a-image-6751e2c9` 与 H3 作业 `job-192c3766-ba8a-4b31-b523-05d2e5b59870`、资产 `a-image-5ab56db7` 均保留且图片可读；H3 PNG SHA256 仍为 `e0ca1d1dd9b053c419df5a4fe900675682e6a1de0a9109ec5fd111eaf6462a98`。
- **feature-815 边界**：`resources/H3-Style/_style_preview/` 的 18 份 PNG 与 33 份 MP4 均存在；使用既有 `parseStylePreviewMetadata` 逐份只读解析，51/51 状态为 `ok` 且均取得真实提示词，未改写媒体或元数据。
- **测试口径**：本轮仅做参考文件与文档静态清理，未重跑生产专项、全量测试、构建或 LAN 生成；既有 110/110 仅是此前生产迁移验收结果，不作为本轮新跑证据。
- **封闭检查**：2026 编年正文与总索引均为 92 项，日期倒序、条目唯一性、索引顺序及新条目链接通过；D-033 正文与总索引唯一对应，仅更新终局状态，未新增 D-034。临时哈希清单及空目录已清理；scoped status / diff 已审阅，未跟踪的参考库与 Feature 目录由磁盘清单、SHA256、JSON 解析和双索引补足覆盖。全量 `git diff --check` 通过，仅有既存 LF→CRLF 提示；未创建 Git commit。

## 十、C2 新增 H3 API 文生图参考件登记契约（2026-11-15）

### 10.1 用户补充与当前基线

用户补充说明 `resources/_ref_官方模板/H3/API/api_image_minimax_h3_t2i.json`“增加了一个”。本轮只登记该新增文件，不修改 JSON 字节。当前参考库由 C1 完成时的 19 份变为 **20 份 JSON、10 UI + 10 API、7 个用途域**：H3 UI 9、H3 API 9、Music3 UI/API 各 1。

### 10.2 文件身份与参考边界

- 新增文件为既有 `H3/UI/01_文生图/image_minimax_h3_t2i.json` 的 API Format 配套参考，第四节索引标注 `API Format / 参考保留`；不得据此冒称生产接入。
- 登记基线：4769 字节，SHA256 `4272506B3E2A51C640E4FC2EB121F014285D34B0B997AD2EDE0CA3DED349BDB6`；17 个节点，输入节点引用完整。
- 该参考件与既有 UI 一样使用 `minimax_h3_fl2va_pruned_int8_convrot.safetensors`、`minimax_h3_video_vae_fp16.safetensors` 和可选 Turbo LoRA。上述组件仅描述参考图，不进入生产 H3 Image 兼容图；生产 manifest 仍只注册 `minimax-h3-image-t2i / h3-image-local-compat-v1.0`。

### 10.3 写权、历史与验证

1. 只更新双总览、本 Feature 五文件、D-033 终局状态与 features README 当前口径；不改新增 JSON、既有 19 份参考件、生产 loader/manifest/graph、shared 类型、依赖、IPC/MCP、历史资产或归档。
2. §9.4、变更记录和 2026-11-15 编年中的 19 份、10 UI + 9 API 是 C1 当时验收快照，保持不改；本次为单 Feature 参考件登记，不新增项目级编年或 D-034。
3. 验证 20/20 JSON 可解析、双索引各 20 项且与磁盘一致、第四节 10 项 API、链接/锚点/HTML ID/标签配对有效，并复测生产归档哈希。
4. 仅做静态文件与文档验证，不重跑生产专项、构建或 LAN 生成，不创建 Git commit。

### 10.4 C2 实测封闭记录（2026-11-15）

| 验收面 | 实测结果 |
| --- | --- |
| 文件与参考库 | 磁盘为 20 份 JSON、10 UI + 10 API、7 用途域，20/20 可解析；新增文件仍为 4769 字节、SHA256 `4272506B3E2A51C640E4FC2EB121F014285D34B0B997AD2EDE0CA3DED349BDB6`，17 节点且缺失引用为 `[]`，无 `MinimaxH3ImageNode`。 |
| UI 配套一致性 | 新增 API 与 `H3/UI/01_文生图/image_minimax_h3_t2i.json` 的 UNet、CLIP、VAE、Turbo LoRA 文件名逐项一致。 |
| 双总览 | Markdown / HTML 的 UI + API 文件项各为 10 + 10，合计各 20，均与磁盘清单无缺失、无额外项；第四节均为 10 API。 |
| HTML 与链接 | 本地文件链接全部存在，9 个页内锚点全部有效；9 个 HTML ID 无重复，标签配对无错误；当前口径无 19/9 残留，第九节仍保留 19 份历史快照。 |
| 生产与历史边界 | 生产 manifest 仍只有 `minimax-h3-image-t2i / h3-image-local-compat-v1.0`，生产 graph 仍为 9 节点 H3 Image 专用拓扑且无 FL2VA / 视频 VAE / Turbo LoRA / 云节点；本轮未写 loader、生产 graph 或既有 19 份参考 JSON。生产归档仍为 6762 字节、SHA256 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`；H3 验收 PNG 与 Qwen/H3 资产索引保留，PNG 哈希复测不变。此前 8 份删除件均未恢复。 |
| 治理与编年 | D-033 终局状态和 features README 已同步当前 20 份口径；第九节与 2026 编年保留 19 份历史快照，编年正文及总索引均保持 92 项，未新增项目级编年或 D-034。 |
| 差异与执行边界 | C2 scoped status / diff 已审阅；参考目录与 feature-816 仍为未跟踪集合，以磁盘清单、哈希、JSON 与双索引校验补足覆盖。全量 `git diff --check` 通过，仅既存 LF→CRLF 提示；未重跑生产专项、构建或 LAN 生成，未创建 Git commit。 |

AC18–AC20 与 H1–H4 均已封闭；本次只完成参考登记与静态验收，不改变此前生产迁移、110/110 历史专项结果或真实 LAN 验收证据。

## 十一、C3 Qwen 生产归档删除契约（2026-11-15）

### 11.1 用户授权与唯一删除目标

用户要求“请帮我整理目录并删除 qwen 相关文件”。盘点确认参考库已经是 20 份 H3/Music3 JSON，全仓唯一 Qwen 命名文件是 `resources/comfyui/workflows/_archive/qwen-image-2512-text.json`；用户在范围确认中明确选择“删除生产归档”。该文件未纳入 Git，用户已接受删除后不可经 Git 恢复；本次无第二人复核。

唯一删除目标冻结为 6762 字节、SHA256 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`。只允许对该绝对路径执行一次精确删除；目录内无其他条目时才可移除空 `_archive`。禁止通配符、递归按名删除或按 `qwen` 内容匹配。

### 11.2 不变量与写权

- 参考库仍为 20 份 JSON、10 UI + 10 API、7 用途域，删除前路径与内容聚合 SHA256 为 `DC42B4F832712C827E06CCD25A89A8B41BE06C1B416C39CA3A87D9D4EB60B5AC`。
- 生产 manifest 仍仅注册 `minimax-h3-image-t2i / h3-image-local-compat-v1.0`，H3 graph 仍为 9 节点；manifest + graph 聚合 SHA256 为 `AA57A07E0C86C01B4356E500506E731B630C37639B002F4AFEFC81701CB4A730`。loader、IPC/MCP、shared 类型、设置 UI、依赖和测试 fixture 不改。
- H3 官方 `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` 文本编码器及其引用保留；无关 LM Studio Qwen 文本模型测试配置不属于本 Feature。
- 验收项目 `资产` 目录 4 个文件的聚合 SHA256 为 `351444E4E7CB0C1BACF2E22A775CAA04DEA392ED23C031D6BCA37A7EDBCF819E`；feature-815 的 18 PNG + 33 MP4 共 51 份风格媒体聚合 SHA256 为 `1CCA1D9D281D92EE0925E6DFD09C6C47C7F9C514AF2A5D0FDEE4EA1D35461405`，历史作业、资产索引和内嵌元数据不得改写。
- 写权只扩展至唯一归档及空目录、双总览、Feature 五文件、D-033 终局状态和 features README。C1/C2 历史实测记录与项目编年保持当时快照，本 C3 不新增项目编年或决策条目，不创建 Git commit。

聚合口径为按完整路径排序，依次写入正斜杠相对路径、NUL、文件字节与 NUL 后计算 SHA256。删除前原始静态检查执行 `4e63beb4e0bd0f3cc8cc840f22681ceb` 已输出上述四项基线，当时归档仍存在且单文件 SHA256 为 §11.1 冻结值。C3 初稿中的另外四项异值经核对属于文档登记笔误，未作为实测证据；本节按删除前原始输出校正，未因此改写任何参考 JSON、生产 graph、历史资产或风格媒体。

### 11.3 验证与封闭

按 A → B 顺序先改规格和 Markdown，再删除文件、同步 HTML。删除后必须复测目标与空目录不存在、全仓无 Qwen 命名文件、20/20 JSON 可解析、上述保护哈希不变、生产注册与旧 ID 拒绝不变，并校验双总览文件项、锚点和 HTML 结构。双总览采用文本文件索引而非 `.json` 超链接，按目录与文件名单元格核对，不另做链接改造。

运行 Comfy 工作流/引擎/MCP 与相关风格元数据专项、项目全量测试和 typecheck；既有 agent-profile 与 typecheck 基线单列，不越权修复、不宣称全量全绿。最后执行 scoped diff 与 `git diff --check`，将实测结果回写本节、需求 AC21–AC23、任务 I、设计和变更记录。

### 11.4 C3 实施结果

- 删除工具报告 `1 recycled, 0 permanently deleted`：唯一 Qwen 生产 graph 已从项目目录删除并移至系统回收站；`_archive` 在确认 0 项后移除。生产目录仅剩 manifest 与 H3 Image graph，全仓无 Qwen/qwen 命名文件。
- 删除后四组聚合 SHA256 与 §11.2 的删除前原始实测完全一致；20/20 参考 JSON 可解析。manifest 单文件 SHA256 为 `3E282E85B74F2834CCFE800FE03177CD2EA85E8DFC5F5A3C16360E71B7BB8A32`，H3 graph 为 `8F4A61B683D8E75BDBEE5B9C018A03DEC3870631EB5DFAB305AFAC2C357FBA0E`，9 节点及合法 `qwen3vl_32b_minimax_h3` 文本编码器保留。
- Markdown 与 HTML 各有 20 个目录/文件名索引项，均与磁盘一一对应；HTML 9 个 section、页内锚点、ID 唯一性和标签配对通过。历史项目 4 份文件、18 PNG + 33 MP4 均保留，历史 H3 PNG 单文件 SHA256 仍为 `E0CA1D1DD9B053C419DF5A4FE900675682E6A1DE0A9109EC5FD111EAF6462A98`。
- Comfy/MCP/feature-815 专项实际执行 8 个测试文件，109/109 通过。全量测试为 91/93 文件通过，1181 passed、10 failed、1 skipped；失败仅为 `agent-profile-install.test.ts` 1 项与 `agent-profiles.test.ts` 9 项，和本轮删除无关。
- `npm run typecheck` 复测仍有 3 项工作区现存错误：`canvas-zoom.test.tsx` 的 TS2322、TS6133，以及 `runtime-client.test.ts` 的 TS2741；本轮未修改这些源码或越权修复。未运行新的 LAN 生成，未修改生产 loader、共享类型、依赖、IPC/MCP 或设置 UI，未创建 Git commit。
- scoped status/diff 已审阅，全量 `git diff --check` 退出码 0，仅既存 LF→CRLF 提示；AC21–AC23、I1–I4、设计、变更记录、D-033 终局状态与 features README 已同步，C3 封闭。
