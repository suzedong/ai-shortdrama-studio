> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：`feature-802-视觉风格谱系接入`。
> **迁移覆盖**：见 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md)「D-037 归档与迁移覆盖」。
> **历史边界**：本包仅保留历史规格、实施与验收证据；现行职责以负责包为准，不据此新增开发或改写历史结论。

# feature-815 · 契约（唯一事实源）

> 版本：v1（2026-11-14）。K1 零触发：`shared/types.ts` 不修改；K8 已批准：恰新增 1 IPC；K9 零触发。

## 1. 文件所有权与接口形态

| 文件 / 接口 | 形态 | 写权 |
|---|---|---|
| `electron/style/metadata-parser.ts` | 新增：纯 Buffer / JSON 解析，无 Electron / fs 依赖 | 本包独占 |
| `electron/style/preview-metadata.ts` | 新增：封闭校验、资源定位、安全读取、DTO 映射 | 本包独占 |
| `electron/style/types.ts` | 既有纯类型模块：新增 feature-815 DTO，供 main / preload type-only 复用 | 本包指定段 |
| `electron/main.ts` | 既有文件：仅新增 `style:preview-metadata` handler 与 import | 本包指定段 |
| `electron/preload.ts` | 既有文件：仅新增 `stylePreviewMetadata` 桥 | 本包指定段 |
| `src/global.d.ts` | 既有文件：新增独立 DTO 镜像与桥签名；十键目录 DTO 不改 | 本包指定段 |
| `src/dev-mock-api.ts` | 既有文件：新增固定 DTO mock，不读真实文件 | 本包指定段 |
| `src/studio/style/VisualCatalog.tsx` | 既有文件：双媒体、元数据面板、异步状态 | 本包指定段 |
| `src/studio/style/visual-catalog.test.tsx` | 既有文件：扩 UI 测试 | 本包指定段 |
| `src/test/style/style-preview-metadata.test.ts` | 新增：node 环境真实样本与合成二进制测试 | 本包独占 |
| `shared/types.ts` / `package.json` / 谱系与媒体 | 只读，零 diff | 禁止 |

兼容关系：不扩展 `style:catalog`，不改变 `styleCatalog` / `styleUpgradeDiff`，不新增 MCP 工具或 ComfyUI 通道。

## 2. `style:preview-metadata`

### 2.1 请求

```ts
type StylePreviewMetadataRequest =
  | { styleId: string; mediaKind: 'image' }
  | {
      styleId: string
      mediaKind: 'video'
      tier: 'std' | 'turbo' | 'fast'
    }
```

运行时校验：只接受普通对象与上述键 / 值；`styleId` 必须命中 `STYLE_REGISTRY`。图片不接受 tier，视频必须给合法 tier。畸形请求拒绝为 `INVALID_REQUEST`，不拼路径、不读文件。

### 2.2 响应

```ts
type StylePreviewMetadataStatus =
  | 'ok' | 'missing' | 'no-metadata' | 'unsupported' | 'invalid'

interface StylePreviewPromptDto {
  key: 'positive' | 'negative' | 'motion'
  label: string
  text: string
}

interface StylePreviewParameterDto {
  key: string
  label: string
  value: string | number
}

interface StylePreviewMetadataDto {
  request: StylePreviewMetadataRequest
  status: StylePreviewMetadataStatus
  prompts: StylePreviewPromptDto[]
  params: StylePreviewParameterDto[]
  message?: string
}
```

- `ok`：容器及内嵌 JSON 有效，且为可识别 ComfyUI API graph；`prompts` / `params` 只含文件实际记录且可确定的值，可以为空数组。数字须 finite；模型仅 basename，不含路径。
- `missing`：白名单对应文件不存在；数组为空，message「预览文件缺失」。
- `no-metadata`：PNG / MP4 容器有效但无目标 `prompt` 元数据；数组为空。
- `unsupported`：元数据 JSON 不是受支持 API graph（含 UI Format）或节点结构不支持；数组为空。
- `invalid`：容器损坏、非法长度、JSON 损坏、超限或安全校验失败；数组为空，message 为通用文案。
- 可预期媒体错误均返回 DTO，不向 renderer 抛原始 fs / parser 异常；DTO 不含绝对路径、完整 graph、堆栈或任意文件内容。

### 2.3 preload / renderer

```ts
window.api.stylePreviewMetadata(
  request: StylePreviewMetadataRequest,
): Promise<StylePreviewMetadataDto>
```

`global.d.ts` 为镜像；真实 DTO 定义在主进程风格模块，不进 shared。dev mock 只返回固定、可区分图片 / 视频的 DTO。

## 3. 文件与解析契约

### 3.1 资源定位

媒体根 = `dirname((await loadStyleCatalog()).sourcePath)/_style_preview`，其下仅允许注册家族对应的封闭目录 `A_写实影像 / B_青春治愈 / C_动画插画 / D_类型氛围 / E_材质工艺`。默认文件名沿用 UI：图片 `{id}_{name}.png`；视频 `{id}_{name}_{标准20步|turbo8步|FastH3}.mp4`；`MEDIA_STEM` 特殊文件名干映射保持同名。主进程仅接受「家族目录 + 映射文件名」产物，最后 `resolve` 必须仍在媒体根内，`realpath` 后仍须不逃逸；只允许 `.png` / `.mp4` 常规文件。

### 3.2 PNG

验证 8 字节签名，顺序读取 chunk length/type/data/CRC；只收集合法 `tEXt` 且 keyword 精确为 `prompt` 的文本。拒绝负 / 越界 / 截断长度、超限元数据与坏 JSON；不解析 UI Format 的 `workflow` 代替 `prompt`。

### 3.3 MP4

按 ISO-BMFF box 结构解析 32 / 64 位 size，定位 `moov → udta → meta → keys/ilst`，以 keys 索引匹配 `mdta.prompt` 对应 data。`meta` 为 FullBox，跳过 version/flags；只解码合法 UTF-8 data。拒绝畸形 box、截断、非法 64 位长度、越界与超限；不得全文件搜索 `"prompt"`。

### 3.4 graph 提取

graph 是节点字典，节点含 `class_type` 与 `inputs`。按 `class_type` 和节点连接识别，不硬编码 A1 节点 ID。仅接受 primitive 或确定的连接解析；不对表达式求值、不递归执行节点、不读取 graph 引用的模型 / 首帧文件。提示词保持完整原文；首帧 / 模型只取 basename。未记录字段不补默认值。

## 4. UI 状态

每媒体状态：`idle | loading | ready | error`；ready 保留 DTO status。请求序号 + 当前 `styleId/mediaKind/tier` 双重校验，卸载后忽略结果。视频 tier 改变仅重置视频元数据；styleId 改变才重置两类。失败不清空另一媒体。元数据区标注「来源：当前 PNG / 当前 MP4 内嵌 ComfyUI 元数据」及「未列出的字段未记录」；复制按钮复制完整对应 text。

## 5. 安全 / 性能

renderer 零 fs、零路径、零 ComfyUI 直连；主进程异步句柄并 finally 关闭。单文件及元数据设有限上限，不为解析读取无限 box / chunk；解析纯函数无网络。只读操作零项目写入、零目录 DTO 变化。

## 6. 测试契约

真实样本精确断言 A1 PNG / 三档 MP4，并扫描现有受支持素材记录可用 / 诚实降级；合成 buffer 覆盖正常 chunk/box、无元数据、坏 JSON、截断、64 位、超限、UI Format。资源服务覆盖非法请求、缺文件、路径逃逸 / 符号链接与 DTO 无路径泄漏。UI 覆盖 AC-1/2/3/4/6；运行 typecheck、Electron build、style/Comfy 专项和全量测试。
