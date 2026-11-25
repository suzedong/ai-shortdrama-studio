# feature-829 · 创作页历史与跨页正式引用 — 任务清单

> 版本：v1.0（2026-11-19）｜顺序：T0 → T1 → T2 → T3 → T4 → T5

- [x] T0 只读盘点 P1 总计划、D-035/D-036、Parity 矩阵、Canvas v4、页/画布 CRUD、引用/再版链路及测试基线。
- [x] T1 呈报 K1/K8 精确方案并冻结五文件；确认页历史不是版本历史，K6/K9 零触发。
- [x] T2 扩展共享引用类型、既有命令与主进程/dev-mock，完成正式引用创建、状态保护和精确再版脏标记。
- [x] T3 实现页/画布前进后退、正式引用复制粘贴、脏态呈现与源定位，补齐组件和 store 自动化。
- [x] T4 完成全量 Vitest、typecheck、build 及真实 Electron 导航/引用/再版/重启/定位验收，保存结构化证据。
- [x] T5 回填五文件、Feature 索引和变更记录，复核 K6/K7/K9 边界及禁止路径，不提交 Git。

## 上下文加载清单

- [x] AGENTS.md、docs/governance/AI-SDG-AI工具执行指令.md。
- [x] 短剧Agent平台设计.md §4 P1 收口、docs/research/MiniMax Design全面复刻开发计划.md。
- [x] docs/design/MiniMax Design Parity影响矩阵.md §1.2/§1.3、docs/governance/SDG-AI-决策台账-2026.md D-035/D-036。
- [x] feature-823 五文件中的需求/契约/设计，feature-822 引用附件边界。
- [x] shared/types.ts、electron/canvas/store.ts、src/studio/canvas/CanvasBoard.tsx、src/dev-mock-api.ts 及相关测试。

完成定义：AC-829-1—5 均有可复核证据；正式引用未持久化、源再版未精确挂脏或真实 Electron 未验收，不得标记闭环。
