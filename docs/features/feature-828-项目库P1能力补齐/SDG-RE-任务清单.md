# feature-828 · 项目库 P1 能力补齐 — 任务清单

> 版本：v1.0（2026-11-18）｜顺序：T0 → T1 → T2 → T3 → T4 → T5

- [x] T0 只读盘点项目库、详情/历史缺口、canvas/asset/runtime 持久结构、D-035、写队列及 F824 验收基线。
- [x] T1 呈报 K6/K8 精确方案并冻结五文件，明确静态包、只读会话、路径边界和负面清单。
- [x] T2 实现 transfer、主进程对话框/runtime/Finder 编排及 preload/global/dev-mock 镜像。
- [x] T3 接入历史、详情、定位、导入导出和只读快照 UI，补齐自动化与定向回归。
- [x] T4 完成全量 Vitest、typecheck、build 和真实 Electron 导入/导出/重启/失败及 F1—F10 验收，保存证据。
- [x] T5 回填五文件、feature 索引和变更记录，复核 K1/K7/K9 零触发及禁止路径，不提交 Git。

完成定义：AC-828-1—5 均有可复核证据；未实现正式会话快照或未完成真机导入/导出，不得标记本包闭环。

## D-037 文档归并 Change：接收 feature-812 / 824 / 825（2026-11-19，✅ 文档完成）

- [x] 需求、契约、设计补入无活动项目入口，并明确 feature-812 归本包而非 feature-820、feature-813 不动。
- [x] 自包含登记项目库 F1—F10 有效需求与既有调用边界，保留 D-025 保存状态语义。
- [x] 自包含登记 openProject 路径/manifest、写队列内 Canvas guard、session/currentDir 提交点、提交后恢复/广播顺序和失败零副作用。
- [x] 冻结 feature-824 原始总体 FAIL、F10 FAIL；未用后续修复倒写历史，未新增产品或真机验收通过声明。
- [x] 仅修改文档，未运行产品测试，未改代码、shared/types.ts、测试、依赖或真实项目数据。

**文档 AC**：本包无需回查归档包即可理解无项目入口、F1—F10 和打开提交事务；guard/错误优先级明确指向 feature-827，Canvas 只读预检明确指向 feature-823，未扩写保证范围。
