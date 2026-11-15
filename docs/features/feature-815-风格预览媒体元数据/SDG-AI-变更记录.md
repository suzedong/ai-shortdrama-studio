# feature-815 · 变更记录

> 每会话一节，倒序追加。代码改动必须落到具体文件、测试与未做项。

## 2026-11-14 会话 2 · 双媒体实施与真机闭环

**改动**：

- 新增 `electron/style/metadata-parser.ts`，按 PNG chunk 与 MP4 ISO-BMFF box 读取 `prompt`，从 ComfyUI API graph 分媒体提取提示词与实际参数；拒绝 UI Format、坏 JSON、截断、非法 box 与超限输入。
- 新增 `electron/style/preview-metadata.ts`，以注册 styleId / 媒体 / 档位白名单定位真实文件，落实目录 containment、realpath、lstat、文件上限、句柄关闭和五态 DTO 降级。
- `electron/style/types.ts` 增加纯 DTO；`electron/main.ts`、`electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts` 接通恰 1 个 `style:preview-metadata` IPC。K1/K9 零触发，`shared/types.ts` 与依赖未改。
- `src/studio/style/VisualCatalog.tsx` 删除图片 / 视频互斥分支，改为固定 PNG 与当前档 MP4 双列同屏；图片与视频独立异步读取、完整提示词复制、参数网格、来源说明及 stale response 防护；谱系文本独立标注为非媒体生成参数。
- 新增 `src/test/style/style-preview-metadata.test.ts`，扩展 `src/studio/style/visual-catalog.test.tsx` 覆盖分源、切档、复制、降级与竞态。

**真机修复**：首次真实 Electron 截图发现媒体虽受 280px 父容器约束，grid replaced item 的自动最小高度仍使图片 / 视频约 973px 高并覆盖元数据。为媒体容器加 `overflow-hidden`、为图片和视频加 `min-h-0 / min-w-0`；复测媒体高度均为 280px，媒体底边与元数据顶边重合，无重叠，28 项组件测试与 Vite 构建重跑通过。

**测试**：元数据 16/16、VisualCatalog 28/28、style/Comfy 专项 13 文件 155/155 通过；`npx vite build` 与 `npm run build:electron` 通过。全量 91 文件 89 通过 / 2 失败，1141 项 1130 通过 / 10 失败 / 1 跳过；10 项失败均为非本包 agent-profile 基线。typecheck 仅余既有 3 条（canvas-zoom 2 条、runtime-client 1 条）。

**真实 Electron 验收**：生产构建 + 真实 IPC 下，A1 图片与视频同屏；标准 / turbo / FastH3 的视频 src 与参数同步切换，steps 为 20 / 8 / 8，seed 分别为 1789724923 / 1789730197 / 1789713601，FastH3 为 euler + CFG 1；图片保持 `947870040 / 20 steps`，不随切档变化。完整正向提示词复制后按钮显示已复制，OS 剪贴板与 DOM 全文一致。A3 无视频时图片与元数据保持可用，视频独立降级。验收后已停止本次 Electron 实例。

**边界与未做**：未修改真实媒体制造无元数据 / 损坏等异常，相关路径由合成二进制和组件测试覆盖。真机另见既有 showrunner 模板缺少 `__MODEL_REF__` 的 Agent runtime 错误，与 style IPC 无关，未越权处理。单 Feature 实施按治理 §7.4 不写根版本记录；features README 已登记。

## 2026-11-14 会话 1 · 规格与批准

**改动**：依据用户双媒体与媒体内嵌提示词参数要求，创建本包标准 5 文件；冻结 `style:preview-metadata` 请求 / 响应、PNG / MP4 有限解析、路径安全、五态降级与 UI 异步契约。

**根因**：`VisualCatalog.tsx` 的 PreviewMedia 对视频优先提前 return，导致同风格 PNG 被隐藏；既有目录只有谱系文本，没有读取媒体内嵌 graph 的通道。

**测试**：规格阶段未执行代码测试；真实样本探查已确认 PNG `tEXt.prompt` 与 MP4 `mdta.prompt` 存在，精确值由后续测试锁定。

**未做**：解析器、IPC、UI、真机目验尚未实施；不宣称功能已可用。

### K 卡口决策

| 卡口 | 决策 | 用户依据 / 理由 |
|---|---|---|
| K1 | 零触发 | `shared/types.ts` 不修改；目录十键 DTO 不扩，新增主进程私有 DTO 与 global 镜像。 |
| K8 | 已批准恰新增 `style:preview-metadata` 1 IPC | 用户批准 `.trae/documents/feature-815-style-preview-media-metadata.md`；二进制文件只能由主进程安全读取，renderer 不收路径。既有 catalog 不扩，不新增 MCP 工具。 |
| K9 | 零触发 | 仅用 Node Buffer / fs / path 与现有 React，不新增依赖。 |

以上为单 Feature 包内决策，不新增项目级 D 编号。
