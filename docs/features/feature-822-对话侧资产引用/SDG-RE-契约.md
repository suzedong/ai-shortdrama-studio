# feature-822 · 契约

> 2026-11-17 用户通过最小 K8 方案；契约已按本文件实施并完成切片 D 验收，不代表 P1 整体通过。

## 1. 卡口与写权

- **K1 零触发**：不修改 `shared/types.ts`、资产索引或其他 Feature 独有共享持久化格式。main / renderer 镜像 DTO 分别落在 `electron/runtime/types.ts` 与 `src/lib/runtime-types.ts`。
- **K8 已批准**：仅扩展两个既有 IPC 的 DTO，**0 条新增 IPC 路由**；同步 main / preload / `src/global.d.ts` / dev-mock。
- **K9 零触发**：不新增依赖，不修改 package/lockfile。
- 资产读取复用 `listAssets()` 及项目沙箱；不改 `AssetIndexItem`、`sourceSession`、MCP 工具、画布命令或 ComfyUI 通道。

## 2. renderer / main 镜像类型

```ts
type RuntimeAssetKind = 'image' | 'video' | 'music' | 'workflow'

interface RuntimePromptAssetRef {
  assetId: string
}

interface RuntimeAssetRef {
  assetId: string
  kind: RuntimeAssetKind
  path: string       // main 从当前项目索引取得的项目相对路径
  name: string       // 合法 meta.originalName，否则 path basename
}

interface RuntimePromptRequest {
  // 既有字段不变
  assetRefs?: RuntimePromptAssetRef[]
}

type RuntimeSessionMessagePart =
  | { type: 'text'; text: string; /* 既有可选字段不变 */ }
  | { type: 'reasoning'; text: string; /* 既有可选字段不变 */ }
  | { type: 'tool'; text: ''; /* 既有可选字段不变 */ }
  | { type: 'asset'; text: ''; asset: RuntimeAssetRef }
```

本地 `ChatItem` / composer 可复用 `RuntimeAssetRef` 作为乐观显示与项目切换重置数据；不得新增绝对路径、文件 URL、Data URL 或文件内容字段。

## 3. K8 IPC

### `runtime:prompt`

- 路由不变；preload 继续传同一请求对象，新增唯一可选输入 `assetRefs: [{ assetId }]`。
- `undefined` / `[]` 必须走既有纯文本请求路径，请求体不新增清单或文件 part。
- renderer 不传 kind、path、name、mime、项目根或 URL；main 不信任 renderer 提供的显示数据。
- main 捕获发送时项目根与画布 `projectId`，解析后复核；项目改变则报 `PROJECT_CHANGED`，不得写入其他项目上下文。
- 同一 ID 去重并保持首次顺序；每个 ID 必须在捕获项目索引中存在，目标通过 `resolveInside + lstat + realpath + path.relative` 复核为项目内普通文件。
- main 按资产类型和白名单真实扩展/元数据确定 MIME：图片 PNG/JPEG/WebP、视频 MP4、音乐 MP3/WAV、工作流 JSON；不支持则报 `ASSET_REF_UNSUPPORTED`。
- main 以项目内真实路径构造 `pathToFileURL()`，仅用于 main → opencode 的原生 `file` part；不得经 preload 返回。
- 为保留稳定资产 ID，main 在原生文件 parts 前加入 `synthetic` 的内部引用清单 text part，记录版本及上述安全 `RuntimeAssetRef[]`。该清单是运行时持久化协议，不以“仅路径文本”替代真实文件 part。

### `runtime:session:messages`

- 路由和 `{ sessionId }` 输入不变；输出 parts 新增上述 `asset` 分支。
- 仅把用户消息中结构完全合法、与对应原生文件 parts 匹配的内部清单投影为资产引用；普通用户文本即使相似也不得被误删或误判。
- 内部清单及原生 `file` 的 `url` / `source` / 文件内容不得直接透传；正文 text、reasoning、tool 白名单语义保持现状。
- 回放输出只含 `assetId/kind/path/name`，不包含绝对路径、文件 URL、Data URL、口令或媒体字节。
- 当前索引已缺失的历史引用仍按清单安全回放，由 UI 标记不可用；不得为回放重新创建索引项或读取已缺失文件。
- 主进程提交原生 `file://` part；opencode 1.18.34 可将图片持久化为 `data:` file part 并前置 synthetic Read。回放仅在 Read 的绝对路径后缀、MIME、清单顺序完全匹配时恢复 chip；辅助 Read、data URL 与媒体字节不得进入安全 DTO。旧 file URL 回放继续支持。

### 三端同步与 dev-mock

- `electron/main.ts`：项目复核、资产解析、真实文件 parts 构造及安全错误。
- `electron/preload.ts`：既有路由不变，仅镜像扩展 DTO；不增加路径参数或文件读取能力。
- `src/global.d.ts`：同步请求与回放类型。
- `src/dev-mock-api.ts`：接受扩展 DTO 并提供明确 mock 回放；不读取真实文件、不宣称真实模型已理解资产。

## 4. 错误语义

预期失败使用稳定 `code` 和不含绝对路径的安全中文消息；发送前失败不得返回 `{ accepted:true }`。

| 代码 | 含义 |
| --- | --- |
| `NO_ACTIVE_PROJECT` | 无活动项目 |
| `PROJECT_CHANGED` | 解析期间项目已切换 |
| `ASSET_REF_INVALID` | 引用数组或资产 ID 非法 |
| `ASSET_REF_NOT_FOUND` | 当前项目索引不存在对应资产 |
| `ASSET_REF_NOT_REGULAR_FILE` | 目标缺失、目录或符号链接 |
| `ASSET_REF_UNSUPPORTED` | 类型或 MIME 不在白名单 |
| `PATH_ESCAPE_DENIED` | 项目真实路径或符号链接逃逸 |
| `ASSET_INDEX_CORRUPT` | 索引损坏，禁止按空索引继续 |

provider 不支持文件 part 时沿用运行时真实错误通道；不得改写为成功。渲染器可保留引用和正文供修正，但不得重复自动发送。
