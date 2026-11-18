# feature-821 · 任务清单

| 编号 | 任务 | 状态 | 证据 |
| --- | --- | --- | --- |
| T0 | 建立标准 5 文件包，登记用户 K8 批准及 K1/K9 零触发 | ✅ | 本包与 Feature 索引，2026-11-16 |
| T1 | 资产索引原子写局部加固与回归测试 | ✅ | `src/test/asset/asset-index.test.ts`；同目录临时文件、fsync、归档、rename 与坏索引保护 |
| T2 | 主进程图片校验、导入、缩略图服务及安全/故障测试 | ✅ | `src/test/asset/asset-image.test.ts` 22/22；真实格式、限制、路径安全、幂等及旧图缩略图 |
| T3 | 两个 IPC 的 main / preload / global.d.ts / dev-mock 三端镜像 | ✅ | 恰 `asset:import` / `asset:thumbnail`；typecheck、Electron 构建通过 |
| T4 | AssetsPanel 上传、项目竞态防护、真实缩略图与原文件名搜索 | ✅ | `studio-flow.test.tsx` 29/29、`studio-theme.test.tsx` 10/10 |
| T5 | renderer 上传/降级/绑定回归及 dev-mock 测试 | ✅ | 上传成功/取消/失败、防重入、跨项目竞态、搜索、降级、绑定回归；dev-mock 12/12 |
| T6 | typecheck、build、专项和全量测试，记录既有基线 | ✅ | typecheck、Renderer/Electron 构建通过；全量 82/94 文件、1,203 通过 / 85 失败 / 1 跳过，失败仍为既有 12 文件 |
| T7 | 隔离项目真实 Electron 上传、图片解码、重开恢复与安全验收 | ✅ | 三种格式原生上传、取消、坏图、项目隔离与重启恢复通过；见 [P1 调查记录 §8](../../verification/p1-2026-11-15/P1调查记录.md) |
| T8 | 更新 P1 调查记录、总体计划和本包闭环证据 | ✅ | 本包、Feature 索引、P1 调查记录、总体规划与文档地图，2026-11-16 |

## 阶段边界

- T0 完成前禁止代码改动。
- T1—T2 不改共享类型、不新增依赖、不新增 MCP 工具。
- T3 不得暴露源路径导入、通用文件读取或自定义协议。
- T4 不自动绑定画布，不扩大到其他资产类型上传。
- T7 无真实原生选择与 DOM 解码证据不得标记切片 C 通过。
