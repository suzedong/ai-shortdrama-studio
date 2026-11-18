# feature-822 · 任务清单

> 状态：**已实施，切片 D 已验收**（2026-11-17）。本状态不代表切片 E、P1 全阶段或 P1-验收整体通过。

| ID | 任务 | 状态 | 证据 |
| --- | --- | --- | --- |
| T1 | 输入区资产选择器、四类搜索、结构化 chip 与项目/会话重置 | 完成 | `chat-minimax.test.tsx`：四类检索、去重、顺序、删除、缩略图及 resetKey 测试通过 |
| T2 | main 当前项目引用解析、MIME/文件安全复核与失败零接受测试 | 完成 | `asset-index.test.ts`：12 项通过；未知 ID、跨项目、符号链接、MIME 与项目切换均拒绝 |
| T3 | `runtime:prompt` 结构化引用、内部清单与原生文件 parts；三端及 dev-mock 同步 | 完成 | `runtime-client.test.ts`、`dev-mock-api.test.ts` 通过；空引用保持旧纯文本路径 |
| T4 | `runtime:session:messages` 安全资产投影、伪造清单防护及历史回放 | 完成 | `runtime-session-messages.test.ts`、`history-replay.test.ts` 通过；覆盖 file URL 与 opencode data URL + synthetic Read |
| T5 | renderer 发送、竞态、缺失降级与旧文本/SSE/工具/上传/绑定回归 | 完成 | 切片 D 专项 `7 files / 122 tests` 通过；旧对话、上传、缩略图、画布绑定回归 `4 files / 62 tests` 通过 |
| T6 | typecheck、Renderer/Electron 构建、专项和全量测试，单列既有失败基线 | 完成 | typecheck 与两端构建通过；全量 `84/94 files`、`1170 passed / 75 failed / 1 skipped`，失败均属既有 B-70 |
| T7 | 隔离项目真实 Electron 资产 chip → opencode 文件 parts → 重开回放验收 | 完成 | [p1-after-822-electron.json](../../verification/p1-2026-11-15/p1-after-822-electron.json)：SQLite native parts、真实桩输入、完整重启 chip 恢复均通过 |
| T8 | 更新 P1 调查记录、Parity 矩阵、总体规划及本包闭环证据 | 完成 | 本包、P1 调查记录 §10、Parity 矩阵与总体规划已同步；未宣称 P1 整体通过 |

## 验收补充

- 真实 opencode + loopback 集成：`8 tests` 全部通过。
- 隔离 Electron 使用真实 preload IPC、opencode 1.18.34 serve 与本机 OpenAI 兼容桩；安全 DTO 不含 file URL、绝对路径或媒体字节。
- opencode 会将图片 file URL 转为 data URL 并插入 synthetic Read；回放仅在路径后缀、MIME、清单顺序完全匹配时恢复 chip，辅助 Read 永不进入 DTO，旧 file URL 回放继续支持。
- 模型桩只证明媒体输入进入真实链路，不证明生产模型已理解媒体语义。

## 实施前冻结边界

- K8 仅两个既有 DTO，0 新路由；K1/K9 零触发。
- 不以路径文本代替原生文件 parts，不向 renderer 暴露文件 URL 或媒体内容。
- 不自动绑定画布、不改资产索引/生成来源，不宣称所有模型具备多模态理解。
- 任一新增共享类型、持久化格式、IPC 路由或依赖需求出现时，停止实施并重新过对应卡口。
