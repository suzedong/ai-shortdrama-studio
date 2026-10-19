# SDG-RE-任务清单 · feature-006 选题诊断公开数据检索

> 执行顺序自上而下；每步完成立即勾记并回写变更记录。卡口预案见契约 §6。**批准前不触碰任何代码（铁律 1）。**

- [ ] **T0 探测定案**：按契约 §1 P1–P3 探测 opencode 内置 web 工具可用性；结论与证据回写变更记录 T0 节，定案 A（白名单放行）或 B（自建工具，契约 §2.2 补登后实施）
- [ ] **T1 基线实测冻结**：`npx tsc --noEmit`（预期仅 3 条历史基线）+ 全量测试（预期 53 文件 586 passed / 0 failed / 1 skipped），数字记入变更记录
- [ ] **T2 通道落地**：方案 A——`provider.ts` `SHOWRUNNER_DECLARED_TOOLS` +N（实际 ID 以 T0 为准）+ 注释沿革；方案 B——`electron/mcp/tools.ts` +2 工具（25→27）+ showrunner 白名单 +2
- [ ] **T3 指令层**：showrunner.md step 3 修订（S1 检索触发 / S2 检索词脱敏 / S3 来源标注 / S4 失败降级）；feature-001 变更记录 R-007 回写
- [ ] **T4 单测**：`agent-profiles.test.ts` 真键表扩表（showrunner 含检索、其余三组不含）；方案 B 增 `web-tools.test.ts`（恰净增 1）
- [ ] **T5 全量回归**：typecheck 零新增；全量 passed 不减少、skip 不增、测试文件净增符合契约 §5（AC5）
- [ ] **T6 真机目验**（AC4/AC6）：商业类立项 → 实际检索 → 诊断卡五区块 + 卡尾检索来源（真实检索词与 URL）；纪念类 → 默认无检索 + 附录标注；截图存证
- [ ] **T7 治理收尾**：README 总表增 006 行；偏差清单 B-39 登记；版本记录增行；变更记录闭环
