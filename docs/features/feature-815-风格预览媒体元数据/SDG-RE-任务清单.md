# feature-815 · 任务清单

> 状态：✅ 已完成（2026-11-14）

- [x] T0 探查双媒体互斥根因、真实 PNG / MP4 内嵌元数据与既有谱系边界。
- [x] T1 用户批准 feature-815 计划：双媒体、恰 1 IPC、K1/K9 零触发、有限 PNG / MP4 解析。
- [x] T2 建立标准 5 文件，锁定 DTO、资源定位、安全与降级契约。
- [x] T3 实现 `metadata-parser.ts`：PNG tEXt.prompt、MP4 mdta.prompt、API graph 分媒体提取。
- [x] T4 实现 `preview-metadata.ts`：注册 ID / 档位白名单、路径安全、状态映射。
- [x] T5 接通 main / preload / global.d.ts / dev mock，保持其他桥零回归。
- [x] T6 改造 VisualCatalog：双列 / 单列、自适应媒体、分源元数据、复制与 stale response 防护。
- [x] T7 新增真实样本 / 合成二进制 / 安全测试，扩 UI 测试。
- [x] T8 执行 typecheck、Electron build、style/Comfy 专项及全量测试；真实 Electron 目验 AC-1~AC-7。
- [x] T9 回写变更记录、任务清单、features README 与必要版本记录；核对媒体 / shared / package 零 diff。

## 验收记录

- **自动化**：真实样本 / 合成二进制 / 安全测试 16/16；VisualCatalog 28/28；style/Comfy 专项 13 文件 155/155 通过。
- **构建**：`npx vite build`、`npm run build:electron` 通过；`npx tsc --noEmit` 仅余包前 3 条既有基线错误。
- **全量基线**：91 文件 89 通过 / 2 失败，1141 项 1130 通过 / 10 失败 / 1 跳过；失败均为非本包 agent-profile 用例，本包未修改相关文件。
- **真实 Electron**：使用生产 `dist/index.html`、真实 preload/main IPC 目验 A1；PNG 与 MP4 同屏，标准 / turbo / FastH3 分别读出 20 / 8 / 8 steps 及各自真实 seed、sampler、CFG、模型，图片 src 与图片参数不随切档变化；复制反馈及 OS 剪贴板完整文本一致；谱系信息独立分区。AC-1~AC-7 通过。
- **真机布局修复**：首次截图发现 replaced grid item 的自动最小高度使媒体约 973px 高并覆盖元数据；加 `min-h-0 / min-w-0 / overflow-hidden` 后复测媒体高度 280px、媒体底边与元数据顶边重合、无重叠。
- **独立降级**：A3 无视频时，图片与图片元数据仍为 `ok`，视频区单独显示缺失提示。无元数据、不支持、损坏、缺档与竞态由合成样本及组件测试覆盖，未改动真实媒体制造异常。
- **边界核对**：`shared/types.ts`、`package.json`、lockfile、谱系 Markdown 与 H3 媒体零 diff。单 Feature 实施按治理 §7.4 不登记根版本记录。
- **非本包运行基线**：真机另出现既有 showrunner 模板缺少 `__MODEL_REF__` 的 Agent runtime 错误；不影响本包 style IPC 与媒体目验，未越权修改。
