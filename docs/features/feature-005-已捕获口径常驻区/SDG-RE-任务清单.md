# SDG-RE-任务清单 · feature-005 「已捕获口径」常驻区

> 执行顺序自上而下；每步完成立即勾记并回写变更记录。卡口预案见契约 §6。**批准前不触碰任何代码（铁律 1）。**

- [x] **T1 基线实测冻结**：`npx tsc --noEmit`（预期仅 3 条历史基线）+ 全量测试（预期 51 文件 564 passed / 0 failed / 1 skipped），数字记入变更记录 T 实施
- [x] **T2 数据面与主进程**：`shared/types.ts` +4 类型（K1，契约 §1）；新建 `electron/capture/store.ts`（读/upsert/remove/写队列/广播）；`electron/mcp/tools.ts` +3 工具（22→25，K8）；`electron/main.ts` +3 handle + changed 广播挂点；`electron/preload.ts` +3 桥 + onCaptureChanged；`src/global.d.ts` DTO 镜像
- [x] **T3 指令层**：showrunner.md L73/L95/L98 收窄修订 + 新增口径落盘纪律（提取即 upsert / infer 标待确认 / user 带 quote / 就绪自检与来源回溯对照口径文件）；feature-001 变更记录 R-006 回写
- [x] **T4 renderer**：新建 `src/studio/CaptureBar.tsx`（C1–C7）；`StudioApp.tsx` 右栏 aside 挂载（ChatComposer 零 diff）；`src/dev-mock-api.ts` capture mock + 演示数据
- [x] **T5 单测**：`src/test/capture-store.test.ts`（AC1–AC4）、`src/studio/capture-bar.test.tsx`（AC5–AC6）——恰净增 2 测试文件
- [x] **T6 全量回归**：typecheck 零新增；全量 passed 不减少、skip 不增、文件净增恰 2（AC8）
- [x] **T7 真机目验**（AC9）：对话提取 → 常驻条累积（琥珀待确认）→ 面板直改 → 对话纠正 → 确认转态 → 重开项目恢复；截图存证
- [x] **T8 治理收尾**：README 总表增 005 行并翻 ✅；偏差清单 B-38 登记并翻 ✅；版本记录增行；变更记录闭环

---

## D-037 文档归并 Change / AC（2026-11-19）

> 仅调整文档事实源归属，005 仍独立负责；上方 T1–T8 与变更记录中的历史结论不改。

- [x] **D037-T1**：将 008 的 11 个 canonical、精确匹配 / 去重规则和 six / premise / unmatched 分组迁入需求 §6、契约 §7。
- [x] **D037-T2**：在设计 §5 写明 005 = 词表 / 匹配 / 分组事实源，013 = 链态与留存卡呈现，禁止双份词表。
- [x] **D037-AC1 文档验收**：来源、目标章节、冲突和自审已登记；未复制历史测试日志，未声称产品能力本轮实施。
- [x] **D037-AC2 开放状态保护**：历史 T7 不回溯翻案；X-001 / X-002 等后续修订的自动测试通过与真机目验待用户执行状态同时保留。
- [x] **D037-AC3 验证边界**：本轮未运行产品测试、未改代码 / shared 类型 / 依赖 / 真实项目数据；无第二人复核。
