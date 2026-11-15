# feature-816 · H3 图像通道迁移 · 变更记录

> 三分类：C0 计划内 / C1 用户授权扩展 / C2 高影响。全局 K7 由 D-033 登记。

## C2 · D-033 通道反转与生产停用

- **日期**：2026-11-14
- **用户拍板**：方案与生产一起改；Qwen ControlNet、分层、透明底、多角度等专有能力全部停用并归档。
- **范围**：图像现行通道由 Qwen-Image 改为 MiniMax H3 Image；仅替换现有文生图生产链。视频仍仅 H3，音乐仍仅独立 Music3。
- **兼容性**：旧 workflowId 与 Qwen 输入字段不再接受；历史资产、元数据与 pending 续查保留。
- **状态**：已完成；生产迁移、真实 H3 出图、收片、资产登记与幂等验收均通过，证据见契约第七节。

## C1 · 已批准计划内的破坏性输入迁移

- `comfyui.queue` 保持工具数量、基本参数形状和 IPC 不变。
- 可用 workflowId 改为 `minimax-h3-image-t2i`；输入改为 `prompt / seed / aspectRatio / megapixels`。
- 旧 `qwen-image-2512-text` 和 `width / height / negativePrompt / lightning4Steps` 明确拒绝，不设置别名或自动回退。

## C0 · 初始规格

- 创建标准五文件，冻结生产兼容图、manifest 值映射、归档规则、测试矩阵、真机验收和失败边界。
- 尚未修改生产代码或执行真实 H3 生成；后续按实际实施与证据追加。

## C0 · 生产实施与验收封闭

- **日期**：2026-11-14
- **生产实施**：参考总览及 HTML 已切换为 H3 三态方案；生产 manifest 仅保留 `minimax-h3-image-t2i`，新增 9 节点 H3 Image 本地兼容 API graph，Qwen graph 原字节移至 `_archive` 且 SHA256 保持不变。loader 仅新增 manifest 声明式 `values` 映射，MCP 工具形状、IPC 与实例设置不变。
- **真实验收**：固定请求在 `lan-4090` 返回 `job-192c3766-ba8a-4b31-b523-05d2e5b59870 / ae93ee5a-cb09-41e7-b003-187e58f6a565` 并 completed；1536×2720、4,245,149 字节 PNG 已下载，SHA256 为 `e0ca1d1dd9b053c419df5a4fe900675682e6a1de0a9109ec5fd111eaf6462a98`，资产 `a-image-5ab56db7` 已登记。同参数 replay 复用同一 jobId / promptId，旧 Qwen ID 返回 `WORKFLOW_NOT_AVAILABLE`；历史 Qwen 资产实际可读。
- **自动化**：Comfy / MCP / style 6 个测试文件 110 项全部通过，其中 feature-815 媒体、元数据和 UI 回归 55 项；Electron 与 Vite 构建通过。
- **既有基线**：全量 86 文件 1170 项中 1160 passed / 10 failed，失败均为既有 agent-profile 问题；typecheck 仅余 `AiServicePanel.test.tsx` 2 项与 `dev-mock-api.ts` 1 项既有错误。未越权修复，未宣称全量全绿。
- **封闭边界**：未修改共享类型、业务接口形状、依赖或原始参考 JSON，未使用云节点、Qwen 回退或 H3 视频权重，未创建 Git commit。一次性真机 runner 与临时结果文件在证据回写后清理。

## C1 · 官方模板参考库 Qwen 清理与 H3/Music3 重排

- **日期**：2026-11-14
- **用户授权原文**：“`d:\Code\ai-shortdrama-studio\resources\_ref_官方模板`目录和文件可以重新整理，qwen可以删除了”。
- **授权关系**：仅在 `resources/_ref_官方模板` 内局部取代原阶段“45 份分类模板与根目录 API 参考件不删除”的约束；历史项目资产、生成元数据和生产 `_archive` 的保留要求不变。
- **执行范围**：按获批计划删除 27 份 Qwen 专用参考 JSON，将 27 份 H3/Music3 保留件重排为 18 份 UI + 9 份 API、7 个用途域；保留文件名与 JSON 字节不变，先移动并核验 27/27 SHA256，再执行删除。
- **实际执行结果**：27/27 保留件已按显式映射移动，SHA256 与字节数全部一致、JSON 全部可解析；27 个 Qwen 删除路径与 27 个原源路径均不存在，11 个旧空目录和根目录散落 API 文件已清理。最终为 18 UI + 9 API、7 用途域；双总览各 27 项与磁盘一致，链接、锚点、HTML ID / 标签及 Qwen 残留语义检查通过。
- **受保护边界实测**：生产归档 graph 仍为 6762 字节，SHA256 保持 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`；历史 Qwen/H3 作业与资产均保留可读，H3 验收 PNG 哈希不变。feature-815 的 18 PNG + 33 MP4 均存在，51/51 内嵌元数据经既有解析器只读解析成功。
- **最终封闭**：F8 已完成。C1 scoped status / diff 已核对；参考目录与 feature-816 任务包当前为未跟踪集合，另以磁盘清单、哈希和双索引补足 Git diff 对未跟踪文件的覆盖。工作区中前序生产迁移及其他既有改动不归入 C1，本次未写生产代码、shared、依赖或 IPC/MCP。工作区外 4 份临时清单及其空目录已删除；2026 编年正文与总索引均为 91 项，日期倒序、无重复，D-033 总索引链接有效且未新增 D-034；全量 `git diff --check` 通过。
- **当前状态**：C1 已封闭（2026-11-14）。既有生产 110/110、构建与真实 LAN 结果仅作历史验收，不冒充本轮重跑；本次未重跑生产专项、构建或 LAN 生成，未创建 Git commit。
- **不变边界**：不修改生产 loader、manifest、H3 graph、shared 类型、依赖、IPC/MCP 工具形状，不删除历史资产或生产归档，不创建 Git commit。

## C1 · P-H3 / FastH3 / Pika H3 参考件后续清理

- **日期**：2026-11-15
- **用户授权原文**：“p_h3 fast pika_h3都不要”；对 FastH3/FastVideo 是否属于 `fast` 的范围追问，用户明确确认“三类全部删除”。
- **范围**：仅删除契约 §9.2 的 8 份 UI Format 参考 JSON，其中 P-H3 2 份、FastH3/FastVideo 3 份、Pika H3 3 份；参考库最终保留 MiniMax H3 主链与独立 Music3，共 19 份 JSON、10 UI + 9 API、7 个用途域。
- **历史关系**：§8.3 的 C1 移动映射保留当时事实；本轮仅取代其中 8 份文件继续作为现行参考保留的效力，不回改历史移动记录或既有编年条目。
- **边界**：不删除模型权重、LoRA、历史项目作业/资产、生成元数据或生产 `_archive`；不修改生产 loader、manifest、graph、IPC/MCP、shared 类型、设置 UI 或依赖，不创建 Git commit。
- **实际执行结果**：8 个明确目标均已删除，其余 19 份参考件无额外删除；19/19 字节数与 SHA256 和删除前一致，JSON 全部可解析。最终为 19 份 JSON、10 UI + 9 API、7 个用途域；双总览各 19 项与磁盘一致，本地链接、9 个页内锚点、HTML ID / 标签配对及三类残留语义检查通过。
- **受保护边界实测**：生产归档 graph 仍为 6762 字节，SHA256 保持 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`；历史 Qwen/H3 作业与资产均保留可读，H3 验收 PNG 哈希不变。feature-815 的 18 PNG + 33 MP4 均存在，51/51 内嵌元数据经既有解析器只读解析成功。
- **最终状态**：AC14–AC17、G1–G7 已封闭。D-033 终局状态、features README 和 2026-11-15 编年已同步，编年正文与总索引均为 92 项，日期倒序、唯一性、索引顺序及新条目链接通过；临时哈希清单与空目录已清理。scoped status / diff 已审阅，全量 `git diff --check` 通过（仅既存 LF→CRLF 提示）。未重跑生产专项、构建或 LAN 生成，未创建 Git commit。

## C2 · 新增 H3 API 文生图参考件登记

- **日期**：2026-11-15
- **用户补充原文**：`resources/_ref_官方模板/H3/API/api_image_minimax_h3_t2i.json`“增加了一个”。
- **范围**：仅原样登记该新增文件为既有 `H3/UI/01_文生图/image_minimax_h3_t2i.json` 的 API Format 配套参考；当前参考库为 20 份 JSON、10 UI + 10 API、7 个用途域。
- **文件基线**：新增文件 4769 字节，SHA256 `4272506B3E2A51C640E4FC2EB121F014285D34B0B997AD2EDE0CA3DED349BDB6`，17 个节点且输入节点引用完整；未修改 JSON 字节。
- **边界**：不注册生产 manifest，不改生产 loader/graph、既有 19 份参考件、历史资产或归档；参考件所用 FL2VA UNet、视频 VAE 和 Turbo LoRA 不进入生产 H3 Image 链。
- **历史关系**：§9.4、前次变更记录和既有编年中的 19 份、10 UI + 9 API 保持 C1 当时事实；本次为单 Feature 参考登记，不新增项目级编年或 D-034。
- **实际执行结果**：双总览已新增该 API 文件并同步为 20 份、10 UI + 10 API、7 用途域；20/20 JSON 可解析，新增文件哈希、17 节点引用及与配套 UI 的 UNet / CLIP / VAE / Turbo LoRA 一致性复测通过。Markdown / HTML 各 20 个文件项且第四节各 10 API，本地链接、9 个页内锚点、HTML ID 唯一性和标签配对通过。
- **受保护边界实测**：生产 manifest 仍只有原 H3 Image 条目，graph 仍为 9 节点专用拓扑，本轮未写生产 loader/graph 或既有 19 份参考 JSON；生产归档仍为 6762 字节且 SHA256 保持 `2A7985CA6A3489F2E864A095B14795DC09413EDD0CE71F624017B99584DC3145`，H3 验收 PNG 与 Qwen/H3 资产索引保留且 PNG 哈希不变。此前 8 份删除件未恢复。
- **最终状态**：AC18–AC20、H1–H4 已封闭。D-033 终局状态和 features README 已同步，第九节与编年保留 19 份历史快照，编年正文与总索引均为 92 项，未新增项目级编年或 D-034。C2 scoped status / diff 已审阅，参考目录与 feature-816 的未跟踪集合由磁盘清单、哈希和双索引补足覆盖；全量 `git diff --check` 通过（仅既存 LF→CRLF 提示）。未重跑生产专项、构建或 LAN 生成，未创建 Git commit。
