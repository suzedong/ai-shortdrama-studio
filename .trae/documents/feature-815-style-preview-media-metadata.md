# feature-815 · 风格预览双媒体与内嵌元数据

## Context

用户目验“数字电影写实”风格详情时发现：弹窗只有视频，参考图未同时出现；当前“锚点词示例 / 质感配方”来自谱系 Markdown，不是当前图片或视频的生成提示词与参数。

代码根因在 `src/studio/style/VisualCatalog.tsx`：存在视频时直接返回 `<video>`，`<img>` 仅作为无视频时的后备。资源目录实际同时存在 PNG 与三档 MP4。抽查确认 PNG 的 `tEXt.prompt`、MP4 的 QuickTime `mdta.prompt` 均内嵌 ComfyUI API graph，可确定性提取提示词和实际生成参数，无需 AI、无需调用 ComfyUI。

目标：图片与当前档视频同屏展示；每个媒体独立展示从自身文件读取的完整提示词和实际参数。未记录、缺失或无法解析时明确降级，不用档名、谱系配方或模型经验补猜。

## 已批准的边界（随本计划请求确认）

- 新建 `feature-815-风格预览媒体元数据`，关联 811 的 UI 落点，不改写已封闭的 811 契约。
- **K1**：`shared/types.ts` 零修改；新 DTO 仅在主进程与 `src/global.d.ts` 镜像。
- **K8**：仅新增一个 IPC：`style:preview-metadata`，及对应 preload 方法和 renderer DTO。
- **K9**：零新增依赖，只使用 Node `fs/path/buffer` 与浏览器既有能力。
- 不读取 renderer 提交的任意路径，不连接 ComfyUI，不生成/修改媒体，不引入 ffmpeg、转码或通用视频分析。

## 实施步骤

### 1. 建立规格与封闭契约

创建 feature-815 五件任务包，登记：

- 请求：`{ styleId, mediaKind: 'image' }` 或 `{ styleId, mediaKind: 'video', tier: 'std' | 'turbo' | 'fast' }`。
- 响应：请求标识、`ok | missing | no-metadata | unsupported | invalid` 状态、提示词列表、参数列表。
- 提示词保留完整原文；参数只来自当前文件 graph，值允许字符串或有限数值。
- 不向 renderer 返回绝对路径或整张工作流；错误文案不泄露本机路径。
- 同步功能索引与必要治理记录；811/802/803 仅作为上游引用。

### 2. 主进程有限元数据解析器

新增 `electron/style/metadata-parser.ts`，纯函数、无 Electron 依赖：

- **PNG**：验证签名，顺序扫描 chunk 边界，只读取 keyword 为 `prompt` 的 `tEXt`；不解析像素，不猜测 `zTXt/iTXt`。
- **MP4**：按 ISO-BMFF box 结构读取目标 `moov`，支持 32/64 位 box size；只走 `moov → udta → meta → keys/ilst`，按 `mdta` 的 `prompt` 键匹配 `data` payload。禁止全文件搜索 `"prompt"` 猜 JSON，避免把整部视频读入内存。
- 对截断、非法长度、越界、超限元数据、坏 JSON、UI Format graph 返回明确状态。
- 按 `class_type` 和节点连接解析 API graph，不硬编码 A1 节点编号：
  - 图片：正/负提示词、seed、steps、CFG、sampler、scheduler、denoise、画幅、实际模型文件。
  - 视频：运动提示词、首帧文件名、seed、steps、sampler、scheduler、画幅、帧数、fps、实际模型文件。
  - CFG 等 graph 未显式记录的字段标为“未记录”或省略并说明，不从“标准20步 / turbo8步 / FastH3”等名称反推。

### 3. 主进程资源定位与 IPC

新增 `electron/style/preview-metadata.ts`：

- 复用 `loadStyleCatalog()` 的 `sourcePath`，将媒体根目录限定在同目录 `_style_preview`。
- 复用风格注册表和封闭文件名/档位映射；renderer 只能传 ID、媒体类型和档位，不能传路径。
- `resolve + relative + realpath` 双重检查根目录与目标文件，拒绝目录、错误扩展名、符号链接和路径逃逸。
- 使用异步文件句柄和元数据大小上限；文件缺失、无元数据、格式不支持、损坏分别映射为契约状态。
- 在 `electron/main.ts` 注册 `style:preview-metadata`；接通 `electron/preload.ts`、`src/global.d.ts` 与 `src/dev-mock-api.ts`。dev mock 只提供确定性 DTO，不假装执行二进制解析。

### 4. 弹窗双媒体与分源展示

修改 `src/studio/style/VisualCatalog.tsx`：

- 移除“有视频就不再渲染图片”的提前返回。
- 弹窗加宽并可滚动；宽窗口双列、窄窗口单列：
  - 左卡“参考图 · PNG”：始终展示当前风格图片及其元数据。
  - 右卡“动态预览 · MP4”：展示当前档视频及其元数据；保留标准、turbo、FastH3 按钮，切档只改变视频。
- 两个媒体均 `object-contain`，避免竖屏内容被裁切；缺图、缺视频或某档缺失仅局部降级。
- 每个媒体下方独立显示完整提示词（保留换行、局部滚动、可复制）和参数表；图片与视频分别维护加载/成功/失败状态。
- 切档请求带当前 `styleId/tier` 校验，避免快速切换时旧响应覆盖新档；图片不因视频切档重复加载。
- 保留“锚点词示例 / 质感配方”，明确标为“谱系信息”，与“文件内嵌元数据”分源，禁止互相填充。
- 不增加生成、采用参数或自动回填立项等额外功能。

### 5. 测试与文档回写

新增 `src/test/style/style-preview-metadata.test.ts`，扩充 `visual-catalog.test.tsx`：

- 使用真实 A1 PNG 与三档 MP4 精确验证提示词和关键参数；扫描全部现有预览素材，实际未内嵌的媒体必须明确降级。
- 合成 buffer 覆盖无元数据、坏 JSON、截断 chunk/box、非法/64 位长度、超限、UI Format。
- 覆盖非法 ID/档位、路径逃逸、绝对路径不泄露、缺失文件互不影响。
- UI 验证图片与视频同时存在、三档只切视频、两媒体参数不串源、完整提示词复制、stale response 防护和各降级态。
- 保持现有十键 `StyleCatalogEntryDto`、目录 IPC、谱系采纳/升级测试不变。
- 回写 feature-815 变更记录、任务清单、功能索引和必要版本记录；只记录真实执行结果。

## 验证

1. 运行新增解析测试、谱系 UI 测试及现有 style 回归。
2. 运行 Comfy 架构红线，确认 renderer 无文件/ComfyUI 直连。
3. 运行 `npm run typecheck`、`npm run build:electron`、`npm run test:run`；既有非本包基线问题单独记录，不顺带修改。
4. 启动真实 Electron，目验 A1：参考图和当前档视频同屏、三档可切换、各自提示词与参数和文件内 graph 一致；再抽查有图无视频及元数据缺失的降级态。

## 明确排除

- 任意本地媒体路径导入、MKV/WebM、XMP/ID3、压缩 `moov`、转码与码流分析。
- 从画面内容反向推测提示词或参数。
- 修改生成通道、共享类型、媒体文件、谱系 Markdown 或安装器资源配置。
