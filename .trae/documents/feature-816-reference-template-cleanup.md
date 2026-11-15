# feature-816 C1 · 官方模板参考库 Qwen 清理与 H3/Music3 重排计划

## 一、摘要

依据用户最新授权：“`d:\Code\ai-shortdrama-studio\resources\_ref_官方模板`目录和文件可以重新整理，qwen可以删除了”，将本次工作作为 **feature-816 的 C1 用户授权后续清理**实施，不新建 feature-817，不新增 D-034。

本次仅整理 `resources/_ref_官方模板` 及同步其现行事实源、B 类镜像和 feature-816 治理记录：

- 删除参考库内 **27 份 Qwen 专用 JSON**。
- 将保留的 **27 份 H3/Music3 JSON** 按模型、UI/API 格式和用途重排。
- 保留文件只移动，**不改文件名、不改 JSON 字节**；先移动并核验 SHA256，再执行删除。
- 清理后参考库为 **18 份 UI + 9 份 API，共 27 份 JSON、7 个用途域**。
- 同步 Markdown 总览、HTML 镜像、feature-816 五文件、D-033 终局状态、features README 和版本编年。

不扩展删除到生产 `_archive`、历史项目作业/图片/资产索引、feature-815 风格媒体及元数据，也不回改冻结的决策正文或既有编年条目。

## 二、现状与依据

### 2.1 已核实的现状

- 参考库当前共有 **54 份 JSON = 45 份分类 UI + 9 份根目录 API**。
- 其中 Qwen 专用文件 27 份；H3/Music3 保留文件 27 份。
- 生产 loader 只读取 `resources/comfyui/workflows/manifest.json` 显式注册的工作流，不扫描 `_ref_官方模板`，因此本次参考文件移动和删除不改变现行 H3 生产路由。
- `templates-image_to_real.json`、`templates-portrait_light_migration.json` 以及两份多角度模板虽不全以 Qwen 命名，但内容属于 Qwen 专用链，纳入明确删除清单。
- H3 JSON 中的 `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` 是 H3 官方文本编码器，不能按 `qwen` 字符串批量删除文件或清除合法模型组件引用。
- feature-816 原阶段“保留 45 份分类模板和根目录原始参考 JSON，不删除、不改写”是当时的真实约束；本次用户授权只在 `_ref_官方模板` 内局部取代它，不能伪写为最初已有删除授权。

### 2.2 目标结构

```text
resources/_ref_官方模板/
  H3/
    UI/
      01_文生图/       3 份
      02_图像编辑/     2 份
      03_文生视频/     3 份
      04_图生视频/     4 份
      05_参考生视频/   4 份
      06_视频控制/     1 份
    API/               8 份
  Music3/
    UI/                1 份
    API/               1 份
  官方模板基准库总览.md
  官方模板基准库总览.html
```

旧 `01_文生图` 至 `11_抠图与透明底` 目录只在保留件迁出、Qwen 件删除并确认为空后移除；不保留空目录壳、兼容别名或副本。根目录不再散落 `api_*.json`。

## 三、实施顺序

### 阶段 A：先登记 C1 规格，不写完成结论

在 `docs/features/feature-816-H3图像通道迁移/` 五文件中先登记本次用户授权、范围、执行契约和未完成任务，再动参考文件：

1. `SDG-RE-需求规格.md`
   - 实施期间将状态改为“已闭环生产迁移；参考库 C1 清理实施中”，完成后再封闭。
   - 保留原 AC1–AC8 和真机记录；把“原始官方模板不删除”标为原阶段约束及本次局部取代关系。
   - 追加 C1 验收项：27 删除 / 27 保留、18 UI + 9 API、7 用途域、27/27 SHA256 一致、JSON 可解析、双总览与磁盘一致、边界目录未触碰。
   - 明确历史资产、元数据和生产归档的保留要求没有被本次授权取代。
2. `SDG-RE-契约.md`
   - 升至 v1.1 并登记履历，新增目标目录、明确删除/移动清单、哈希门槛、失败停止条件和文档同步契约。
   - 将现行 `api_image_minimax_h3_image_t2i.json` 等路径更新到 `H3/API/`；既有生产 manifest、输入映射及真实验收契约不改。
3. `SDG-OD-设计说明.md`
   - 保留授权沿革，更新“Qwen 文件仍保留于参考库”的旧现行口径。
   - 写明 H3/Music3 分模型、UI/API 分格式设计，以及“预检 → 移动 → 验哈希 → 删除 → 文档同步 → 校验”的两阶段文件操作。
   - 写明工作区外临时清单、失败停止与反向恢复方式；更新参考件现行路径。
4. `SDG-RE-任务清单.md`
   - 保留 A–E 历史勾选；B2 加注后续 C1 的局部取代，不改写历史事实。
   - 新增 F 组未完成任务：规格预检、清单与哈希、移动、删除、双总览、语义/链接检查、治理同步、临时文件清理。
5. `SDG-AI-变更记录.md`
   - 先追加独立的“C1 用户授权扩展”实施条目和授权原文；完成证据在实际验证后回写。
   - 原 C0/C2 中“未修改原始参考 JSON”等历史事实保持不变。

### 阶段 B：预检并生成工作区外清单

在 `$env:TEMP/feature-816-reference-cleanup/` 生成临时 `delete.json`、`move.json`、`hashes-before.json` 和后续 `hashes-after.json`，不把脚本、清单或校验缓存留进仓库。

预检必须全部通过才能移动：

- 删除清单恰为下列 27 份，移动清单恰为后文 27 份。
- 两清单互斥，并集覆盖参考库全部 54 份 JSON，无遗漏、无重复。
- 所有源文件存在，所有目标文件不存在；无目标覆盖、大小写冲突或目录逃逸。
- 保留文件逐个计算并记录移动前 SHA256。
- 任何数量、分类、路径或哈希预检不符，立即停止，不删除任何文件。

### 阶段 C：移动保留件并验哈希，之后才删除 Qwen 件

#### C.1 移动 27 份 H3/Music3 文件

所有移动均保留原文件名和原字节：

| 源路径（相对 `_ref_官方模板`） | 目标路径（相对 `_ref_官方模板`） |
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

移动后逐份计算 SHA256，必须与移动前 **27/27 完全一致**，并逐份解析 JSON。若任一文件不一致、无法解析或目标数量不符，停止后续删除，按 `move.json` 将已移动文件反向移回原路径并复核。

#### C.2 哈希门槛通过后，删除以下 27 份 Qwen 专用文件

- `01_文生图/`（6 份）：
  - `image_qwen_image.json`
  - `image_qwen_Image_2512.json`
  - `image_qwen_image_2512_with_2steps_lora.json`
  - `template_qwen_Image_2512_360_lora.json`
  - `image_qwen_image_2_1_t2i.json`
  - `image_qwen_image_2_1_turbo_t2i.json`
- `02_图像编辑/`（11 份）：
  - `image-qwen_image_edit_2511_lora_inflation.json`
  - `image_qwen_image_2_1_image_edit.json`
  - `image_qwen_image_2_1_turbo_image_edit.json`
  - `image_qwen_image_edit.json`
  - `image_qwen_image_edit_2509.json`
  - `image_qwen_image_edit_2509_relight.json`
  - `image_qwen_image_edit_2511.json`
  - `image_qwen_image_edit_2511_int8.json`
  - `template_qwen_image_edit_2511_systms_action.json`
  - `templates-image_to_real.json`
  - `templates-portrait_light_migration.json`
- `03_图像分层/`（2 份）：
  - `image_qwen_image_layered.json`
  - `image_qwen_image_layered_control.json`
- `04_控制网与构图约束/`（5 份）：
  - `image_qwen_image_controlnet_patch.json`
  - `image_qwen_image_union_control_lora.json`
  - `image_qwen_image_instantx_inpainting_controlnet.json`
  - `image_qwen_image_instantx_controlnet.json`
  - `image_qwen_Image_2512_controlnet.json`
- `05_多角度批量/`（2 份）：
  - `templates-1_click_multiple_character_angles-v1.0.json`
  - `templates-1_click_multiple_scene_angles-v1.0.json`
- `11_抠图与透明底/`（1 份）：
  - `image_qwen_image_2_1_background_removal.json`

只按上述明确相对路径删除，不使用 `qwen` 通配符或全库内容匹配。删除后确认旧 `01`–`11` 目录均为空再移除目录。

### 阶段 D：同步参考库事实源与 HTML 镜像

先修改 `resources/_ref_官方模板/官方模板基准库总览.md`，再由其同步 `官方模板基准库总览.html`：

- 头部和统计改为 **18 UI + 9 API、27 JSON、7 用途域**，移除“45 + 9、11 用途域、根目录 API”的现行描述。
- 三态中的 Qwen 状态改为“**已从本参考库删除，现行方案与生产回退均禁用**”；不再写成“文件仍仅作历史基准保留于本参考库”。
- 第三节只索引现存的 18 份 UI 文件，第四节只索引新位置的 9 份 API 文件；所有视频、编辑和 Music3 链接更新到 H3/Music3 新目录。
- 删除 Qwen 文件现行索引，保留“Qwen 专用能力停用且不可回退”的决策说明。
- 明确区分：`resources/comfyui/workflows/_archive` 的生产 graph、历史项目资产和元数据仍保留，不属于本次参考库删除范围。
- 保留第九节已有真实 H3 迁移、110/110 专项和真机证据，另追加本次清理的实际数量、SHA256、JSON、路径及边界验证记录；不得把此前测试写成本次重新执行。
- HTML 同步导航、章节标题、统计、内嵌数据、状态和链接；保留已有真实证据，检查标签配对、ID 唯一和页内锚点。

### 阶段 E：封闭治理与编年记录

实际清理和校验完成后：

1. 回写 feature-816 五文件的 C1 完成证据：54 → 27、删除 27、保留 27、18 UI + 9 API、27/27 SHA256 一致、JSON/路径/链接/语义检查及未触碰边界；任务 F 组按真实结果逐项勾选，需求状态重新封闭。
2. 在 `docs/governance/SDG-AI-决策台账-2026.md` 仅更新 D-033 的“终局状态”：原“原始官方模板保留”在 `_ref_官方模板` 范围被 feature-816 C1 部分取代；H3 通道决策仍现行，历史资产、元数据和生产 `_archive` 保留不变。D-033 决策本体、用户拍板和历史叙述不改，不新增决策编号；`SDG-AI-决策台账.md` 只核对现有链接和决策数。
3. 更新 `docs/features/README.md` 的 feature-816 当前范围：C1 仅扩展到参考目录、双总览及治理记录，不重开生产 loader、manifest、graph 写权；保留原“专项 110/110”为历史验收结果，不冒充本次重跑。
4. 在 `版本记录-2026.md` 新增“官方模板参考库 Qwen 清理与 H3/Music3 重排（feature-816 C1）”条目，不回改此前 H3 迁移启动/完成条目。
5. 在 `版本记录.md` 增加对应索引，并按实际条目数将当前 90 调整为 91；先复核数量，不机械改数。
6. 删除 `$env:TEMP/feature-816-reference-cleanup/` 临时清单和哈希文件，不留下工作区外执行辅助物的仓库引用。

## 四、明确不变边界

- 不修改 `electron/comfy/workflow.ts`、生产 `manifest.json`、H3 生产 graph、MCP/IPC、renderer、实例设置 UI 或任何产品代码。
- 不删除或改写 `resources/comfyui/workflows/_archive/qwen-image-2512-text.json`；其既有 SHA256 `66531AC8918B66D3969CE04088BA147655498E8BFC9D449D32FF0CF19FD42A` 保持不变。
- 不删除历史项目 Qwen 作业、图片、资产索引、feature-815 风格媒体或内嵌元数据。
- 不修改 `shared/types.ts`、依赖、package/lockfile，不新增 H3 编辑、视频或 Music3 生产能力，不创建 Git commit。
- 不把 `qwen3vl` 文本编码器误判为 Qwen-Image 回退，不引入云节点、媒体云端 Key 或按次云调用。
- 默认不重跑生产专项、Electron/Vite 构建或 LAN 生成，因为生产输入与执行代码均未变化；若实施中意外越界修改这些文件，则停止封闭并重新评估验证范围。

## 五、验证与完成标准

1. **磁盘数量与布局**：参考库恰好 27 份 JSON，分布为 H3 UI 17、H3 API 8、Music3 UI 1、Music3 API 1；7 个用途域，旧目录和根目录散落 API 文件均不存在。
2. **删除精确性**：27 个明确 Qwen 源路径全部不存在；27 个保留文件均只出现于各自目标路径，无重复副本。
3. **内容不变**：27/27 保留文件移动前后 SHA256 一致且 JSON 全部可解析；生产归档 graph 哈希保持既有值。
4. **索引一致**：Markdown/HTML 的文件清单、数量、用途域与磁盘一一对应，现行相对链接均指向存在文件；HTML 标签配对、ID 唯一、锚点有效。
5. **语义审查**：逐项检查 `qwen` / `Qwen` 残留，只允许合法的 H3 `qwen3vl` 组件引用、历史/禁用说明及生产归档边界说明；不得存在 Qwen-Image 现行路由、回退建议或“Qwen 文件仍保留于本参考库”的错误口径。
6. **治理一致**：feature-816 五文件、D-033 终局状态、features README 与编年相互一致；历史事实未被回改，版本索引实际条目数为 91。
7. **差异检查**：查看 scoped `git status` / `git diff`，确认仅有计划内文件移动、删除和文档更新；执行 `git diff --check`，无空白错误，无越界产品代码、共享类型、依赖或接口变更。
8. **测试口径**：本次只进行参考文件与文档静态验证；既有 110/110 专项、构建和 LAN 验收继续作为 feature-816 历史证据引用，不宣称本次重新运行。
