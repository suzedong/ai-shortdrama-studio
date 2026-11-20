# feature-821 · 设计说明

## 1. 数据流

```text
AssetsPanel
  → asset.import()（无路径参数）
  → main 捕获 projectRoot + projectId，原生 openFile
  → 复核项目上下文
  → 内部图片服务：lstat/size → sharp metadata → SHA-256 + WebP
  → 项目内原图/缩略图原子落盘
  → registerAsset()
  → renderer 重新 asset.list()
  → AssetThumbnail(assetId) → 小尺寸 WebP Data URL
```

上传一旦进入内部服务即使用捕获的项目根完成；若 renderer 已切项目，面板卸载和请求失效机制丢弃旧回执。原生选择器尚未返回时发生项目切换则报 `PROJECT_CHANGED`，不写文件。

## 2. 为什么不改索引结构

缩略图是派生数据，其路径可由资产相对 `path` 的 SHA-256 唯一确定。上传图片与旧 ComfyUI 图片共用此规则，避免新增 `thumbnailPath`、共享类型 K1、旧 JSON 迁移和索引回填。缩略图丢失可按需重建，原图与索引仍是事实源。

## 3. 安全边界

- 唯一允许的项目外输入路径来自主进程原生选择器，且不跨 preload 暴露。
- 源文件必须经 `lstat` 为普通文件；读取同一 Buffer 完成大小、格式、哈希和缩略图处理。
- 项目内目标先过 `resolveInside()`，再用 `lstat + realpath + path.relative` 防符号链接逃逸。
- 缩略图 IPC 只按当前项目索引 ID 解析；不开放 `file://`、原图 Data URL、文本 `file:read` 扩展或自定义 protocol。
- SVG 不纳入白名单；图片扩展名由 sharp 检出的真实格式决定。

## 4. 原子性与幂等

- 索引用全局 `enqueue()` 串行化，并改为同目录临时文件、fsync、`copyExistingToArchive()`、rename；坏索引不得视为空数组。
- 二进制目标采用内容寻址和原子写；已存在目标复用，不覆盖已有资产。
- 先写媒体、后登记索引；失败只清理由本次新建的媒体，避免索引指向缺失文件或误删旧资产。
- `registerAsset()` 的 `path + kind` 稳定 ID 和 `createdAt` 保留语义不变。

## 5. 图片处理

复用 `sharp@0.33.5`，`limitInputPixels=40_000_000`、`sequentialRead`、截断失败、`.rotate()` 自动定向，最长边 320、不放大、WebP quality 80。选择 sharp 是因为本包直接需要 EXIF、像素限制、截断校验和异步编码；不实现 nativeImage 后备引擎。

## 6. renderer 降级与竞态

- 项目 ID 作为面板重置边界，无项目不加载、不上传。
- 列表与缩略图请求仅允许当前项目/当前组件回写；上传防重入。
- 图片占位始终可回退；请求或解码失败不影响资产存在事实和绑定功能。
- 显示名/搜索兼容旧路径与新 `meta.originalName`；不新增全局缓存或通知系统。

## 7. D-037 现行归并设计：可信来源补写（2026-11-19）

```text
运行时 tool.call（过滤前）
  → 物理名 shortdrama_asset_register 精确匹配
  → 成功 JSON resultPreview：直接对象或 text 内 JSON
  → 真实 assetId + jobId + 事件 sessionId/messageId/callId 齐套
  → updateAssetSource(assetId, { sourceJobId, sourceSession })
  → 资产索引既有串行队列 / 原子写
```

1. 资产文件与媒体作业已经完成后才补写来源，来源是索引元数据而非媒体完成前提。补写失败只记录安全日志，不回滚资产、不阻断 SSE。
2. 只信事件与真实登记 ID；不从 activeSessionId、显示名、当前聊天上下文或 Agent 自报文本反推。缺字段与非 JSON 一律跳过。
3. 重复登记沿用稳定 ID 与 createdAt，缺省来源字段不覆盖旧值；非法 ID 不造记录，坏索引不按空索引恢复。
4. 缩略图仍是由资产相对 path 派生的独立事实，不新增 thumbnailPath。§2“为什么不改索引结构”仅解释缩略图；sourceJobId / sourceSession 是后续 814 已批准的不同职责，现归本包维护。
5. 上传仍走 §1 系统直做流程，不调用 Agent，不自动绑节点。Canvas 绑定归属 823，对话资产引用归属 822，三者只共享同一资产索引，不共享入口或来源猜测逻辑。

本次仅归并文档，不新增运行链路或验收结论；历史实施与测试证据保留在原变更记录。
