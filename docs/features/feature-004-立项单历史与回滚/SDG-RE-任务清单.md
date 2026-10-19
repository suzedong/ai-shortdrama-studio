# SDG-RE-任务清单 · feature-004 立项单历史与回滚

> 执行顺序自上而下；每步完成立即勾记并回写变更记录。卡口预案见契约 §6。

- [x] **T1 基线实测冻结**：`npx tsc --noEmit`（预期仅 3 条历史基线）+ 全量测试（预期 49 文件 550 passed / 0 failed / 1 skipped），数字记入变更记录 T 实施
- [x] **T2 主进程**：新建 `electron/brief/history.ts`（getBriefHistory / readBriefVersion 含 diffToLatest）、`electron/brief/rollback.ts`（rollbackBrief，R1–R5）；`electron/main.ts` +3 handle；`electron/preload.ts` +3 桥；window.api 类型镜像
- [x] **T3 renderer**：新建 `src/studio/BriefHistoryView.tsx`（V1–V6）；`StudioViewer.tsx` 入口按钮 + 挂载；`src/dev-mock-api.ts` +3 mock；（如需）`dirtyFieldLabel` 抽共享位置
- [x] **T4 单测**：`src/test/brief-rollback.test.ts`（AC1–AC5）、`src/studio/brief-history.test.tsx`（AC6–AC7）
- [x] **T5 全量回归**：typecheck 零新增；全量 passed 不减少、skip 不增、文件净增恰 2（AC8）
- [x] **T6 真机目验**（AC9）：多版本项目 → 查看历史 → diff 高亮 → 回滚 → 新版落盘 + 画布/导航刷新 + 下游脏读黄条；截图存证
- [x] **T7 治理收尾**：README 总表增行并翻 ✅；偏差清单 B-37 登记并翻 ✅；版本记录增行；变更记录闭环
