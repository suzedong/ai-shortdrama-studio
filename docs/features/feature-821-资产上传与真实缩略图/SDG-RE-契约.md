# feature-821 · 契约

> 2026-11-16 用户通过实施计划，明确批准本文件 K8 范围。

## 1. 卡口与写权

- **K1 零触发**：不改 `shared/types.ts`，不新增索引字段。
- **K8 已批准**：仅新增 `asset:import`、`asset:thumbnail`，同步 main / preload / `global.d.ts` / dev-mock。
- **K9 零触发**：复用已有 `sharp@0.33.5`，不改依赖清单或 lockfile。
- 资产索引继续只经 `registerAsset()` / `listAssets()` 业务入口；不改 MCP 工具和画布绑定命令。

## 2. 物理布局与元数据

```text
原图：资产/上传/{内容 SHA-256}.{png|jpg|webp}
缩略图：资产/缩略图/{资产相对 path 的 SHA-256}.webp
```

缩略图路径由资产记录确定性派生，不入索引。上传项使用现有 `meta`：

```ts
{
  origin: 'upload',
  originalName: string, // 仅源文件 basename
  mime: 'image/png' | 'image/jpeg' | 'image/webp',
  sizeBytes: number,
  sha256: string
}
```

不保存源绝对路径、原图/缩略图 Data URL。重复上传保留首次 `createdAt` 和既有来源字段。

## 3. K8 IPC

```ts
window.api.asset.import(): Promise<
  | { status: 'imported'; asset: AssetIndexItem }
  | { status: 'cancelled' }
>

window.api.asset.thumbnail(assetId: string): Promise<{
  dataUrl: string | null
}>
```

### `asset:import`

- 输入为空；renderer 不传源路径、项目路径或窗口句柄。
- main 以 `BrowserWindow.fromWebContents(event.sender)` 打开单文件选择器。
- 选择前捕获项目根目录和画布 `projectId`，选择后复核；不同则报 `PROJECT_CHANGED`。
- 取消返回 `{ status: 'cancelled' }`，零写入。
- 成功完成校验、原图/缩略图落盘和 `registerAsset()` 后返回 `{ status: 'imported', asset }`。

### `asset:thumbnail`

- preload 仅传 `{ assetId }`，main 不接受任何路径或项目根参数。
- 仅在调用时活动项目的索引中解析图片；其他项目 ID、非图片、缺失或不安全媒体返回 `{ dataUrl: null }`。
- 已有缩略图直接读取；旧 ComfyUI 图片按需从原图生成。
- 成功只返回最长边不超过 320 的 `data:image/webp;base64,...`，不返回原图。

## 4. 错误语义

预期失败抛出带稳定 `code` 和安全中文消息的 Error；Electron 去壳后由 renderer 展示，不包含源绝对路径。

| 代码 | 含义 |
| --- | --- |
| `NO_ACTIVE_PROJECT` | 无活动项目 |
| `PROJECT_CHANGED` | 原生选择器返回时项目已切换 |
| `INVALID_ARGUMENT` | 缩略图参数非法 |
| `SOURCE_NOT_REGULAR_FILE` | 源不存在、目录或符号链接 |
| `IMAGE_TOO_LARGE` | 超过 64 MiB |
| `IMAGE_UNSUPPORTED` | 非 PNG/JPEG/WebP、空、损坏或截断 |
| `IMAGE_TOO_MANY_PIXELS` | 超过 4000 万像素或尺寸无效 |
| `PATH_ESCAPE_DENIED` | 项目真实路径或符号链接逃逸 |
| `ASSET_INDEX_CORRUPT` | 索引损坏，禁止覆盖为空数组 |
| `ASSET_IMPORT_FAILED` | 其他导入/落盘失败 |
| `ASSET_THUMBNAIL_FAILED` | 缩略图读取、索引或编码异常 |
| `ASSET_IMPORT_UNAVAILABLE` | 仅 dev-mock：浏览器不支持真实上传 |

## 5. dev-mock 与 UI 契约

- dev-mock `asset.import()` 明确报 `ASSET_IMPORT_UNAVAILABLE`，`asset.thumbnail()` 返回 `{ dataUrl: null }`，不写假资产。
- 上传成功只刷新图片列表并 Toast；取消静默；上传中防重入。
- `meta.originalName` 为合法非空字符串时作为显示名，同时参与搜索；否则回退路径 basename。
- 缩略图 `null`、请求失败、图片解码失败均回退首字母；非图片不请求缩略图。
- 无项目禁用上传且不请求资产列表；项目切换使全部旧异步结果失效。

## 6. D-037 现行归并契约：可信资产来源（2026-11-19）

本节收编归档包 814 已存在的来源契约，不新增 IPC、MCP 工具或共享类型。`asset:import` / `asset:thumbnail`、上传 meta 与缩略图派生路径保持 §1—§5；上传路径本身不自动获得 Agent 会话来源。

### 6.1 资产与作业来源

```ts
interface AssetSourceSession {
  sessionId: string
  messageId: string
  callId: string
}

// AssetIndexItem 的可选扩展；历史记录无需回填
sourceJobId?: string
sourceSession?: AssetSourceSession

// asset.register 仅追加的可选入参
sourceJobId?: string
```

`sourceJobId` 只能取成功作业工具参数中的真实 `jobId`；Agent 不得通过 register 入参提交 sourceSession。`asset.register` 其余入参、返回与物理工具 ID 不变。重复 `path + kind` 登记保留首次 `createdAt` 与既有来源；请求省略 sourceJobId / meta / sourceSession 时不得清空旧值。

### 6.2 运行时事件契约

- 在调用过滤 / 分类前取得 `tool.call`，仅当 `event.name === 'shortdrama_asset_register'` 且其结果为成功 JSON 时继续。
- 支持 `{ assetId, jobId }` 与 `{ text: '<json>' }` 两种 resultPreview；解析后必须存在真实资产 ID。任务来源取 `jobId`，会话来源取真实事件 `{ sessionId, messageId, callId }`。
- 任一元组缺失、结果非 JSON、工具名不符或资产不存在时跳过；严禁以 `activeSessionId` 代替事件 sessionId，严禁创建空资产记录。
- 主进程内部以既有资产 ID 调用 `updateAssetSource()`，在资产索引现有串行队列内完成读改写；坏索引 / 写入失败仅安全日志，不回滚媒体、不阻断 SSE。

### 6.3 冲突与边界

§1 的 K1/K8 零触发是 2026-11-16 上传切片当时范围；上述来源字段及 register 入参是 814 后续已批准并实施的契约，本次仅迁移负责包，不构成新的 K1/K8 授权。821 不拥有 `canvas.command`、CanvasNode.assetIds 或绑定 UI；823 不拥有资产来源事件判定；822 的对话引用 DTO 不并入本包。
