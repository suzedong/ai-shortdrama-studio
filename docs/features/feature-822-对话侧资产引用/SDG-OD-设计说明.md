# feature-822 · 设计说明

> 状态：已实施并完成切片 D 验收（2026-11-17）；不代表 P1 整体通过。

## 1. 发送数据流

```text
输入区「资产」
  → asset.list / asset.thumbnail（既有 IPC）
  → 当前项目 RuntimeAssetRef chip
  → runtime.promptAsync({ text, assetRefs:[{ assetId }], ... })
  → main 捕获 projectRoot + projectId
  → 当前项目索引解析 + 项目沙箱 / 普通文件 / MIME 复核
  → 项目切换复核
  → RuntimeClient：用户 text + synthetic 引用清单 + 原生 file parts
  → opencode 真实用户消息
  → 既有 SSE / 工具轨迹 / assistant 完成链路
```

引用只改变用户 prompt 的组成，不新增系统直改 Agent 话术，不自动调用生成工具，不写画布绑定。

## 2. 为什么需要结构化 DTO 与原生文件 parts

Parity 影响矩阵 §2.2 / §2.3 要求显式资产引用进入对话，且不得只复制路径文本；本包采用 `@` 资产 chip 形态。仅把项目相对路径拼入正文无法证明资产实际进入模型上下文，也无法可靠回放。`assetRefs` 让 renderer 只表达身份，main 重新取得可信元数据；原生 `file` parts 才是资产进入 opencode 用户消息的事实载体。

## 3. 为什么增加内部引用清单

opencode `FilePart` 持久化字段没有本项目 `assetId`，其 `url` / `source` 又不能安全透传给 renderer。main 写入单一、版本化、`synthetic` 的引用清单，并与原生文件 parts 同序对应：

- 发送时保存稳定 ID、类型、项目相对路径和显示名。
- 回放时严格解析清单及文件 parts，投影成安全 `asset` DTO。
- 清单不替代文件 parts，也不作为可见用户正文。
- 空引用完全不增加清单，保证旧文本请求不变。
- 实际运行中 opencode 1.18.34 会把图片 file URL 转为 data URL，并在 file part 前插入 synthetic Read。回放仅在 Read 路径后缀、MIME 与清单顺序完全匹配时恢复 chip；辅助 Read 与 data URL 不进入安全 DTO，旧 file URL 形态继续兼容。

## 4. composer 与项目边界

- 选择器复用资产面板显示名/搜索规则；图片可复用 WebP 缩略图，非图片保留类型标识。
- chip 是正文流中的结构化原子，不等同于纯文本 `@名称`；退格/删除按钮只移除对应引用。
- `ChatItem` 在同一乐观消息中保存正文与安全引用，SSE 合稿不得丢弃。
- `projectId + sessionId` 是选择器、缩略图、发送预检和回放的共同重置边界；旧响应只能失效，不能回写或 Toast 到新项目。
- main 重新校验是最终边界，renderer 预检只用于及时反馈，不能替代主进程。

## 5. 回放与缺失资产

`getSessionMessages()` 在 main 内完成清单与文件 parts 的安全投影，renderer 不接触文件 URL。历史引用是发送时快照的可追溯元数据，不要求资产至今仍存在，也不反向修改资产索引。当前索引存在时可刷新缩略图；缺失时显示「资产不可用」，其余消息段继续恢复。

## 6. 安全与能力真实性

- renderer 无任意文件路径、URL、MIME 或字节输入；所有媒体定位均在 main 当前项目沙箱完成。
- 文件 URL 仅存在 main → opencode 请求，回放 DTO 永不透传；错误消息去掉绝对路径和 Electron IPC 包装。
- 不对不支持媒体语义的模型伪造理解结果。专项验收分别证明：文件 parts 真实进入 opencode、provider 真实接受或明确报错、历史 chip 可恢复。
- 不改 `shared/types.ts`、资产索引、生成来源 `sourceSession`、MCP 工具或 ComfyUI，不引入新媒体协议和依赖。

## 7. 验证层次

1. 纯映射：引用去重、清单解析、伪造清单拒绝、文件 URL 不透传、旧 text/reasoning/tool 回放回归。
2. main 服务：四类 MIME、缺失/跨项目/符号链接/路径逃逸、项目切换与失败零接受。
3. renderer：选择器、chip、搜索、项目竞态、乐观消息、重开恢复、缺失降级及既有对话/上传/绑定回归。
4. 真实 Electron：在隔离项目上传受控图片，经输入区原生 chip 发送到真实 opencode，读取持久化用户 parts 与重启回放 DOM；不得仅以 mock 成功替代。
