# feature-010 任务清单：对话内缺口追问 chip 与发卡拍板提示（qh）

> **版本**：v1.0（2026-10-23）
> **上游**：需求规格 v1.0 / 契约 v1.0 / 设计说明 v1.0
> **执行纪律**：逐步实测留痕于变更记录 T 节；任一步实测与预期不符 → 停步登记 X 节待用户裁决，不得自行继续

| # | 任务 | 预期实测 | 状态 |
| :-- | :-- | :-- | :-- |
| T1 | **基线冻结**：全量测试 + typecheck + 禁用串复查 | 60 文件 704 passed / 0 failed / 1 skipped；typecheck 恰 3 条历史基线（canvas-zoom.test.tsx TS2322 L13 + TS6133 L90、runtime-client.test.ts TS2741 L45，exit 2）；禁用串（契约 §3.5）全 src 零匹配 | ✅ |
| T2 | **parseChatOptions 扩展**：契约 §2.2 五处扩展点（闭标签/开标签正则 + tail 半截 + 块体解析分支 + 返回 chips） | diff 仅限五处；既有【选项】【风格选项】路径零行为变化 | ✅ |
| T3 | **ChipRow 组件 + 两渲染挂载点**：契约 §3.1 组件全文 + §4.1 第 2/4/5 行挂载 | items 末条可点、流式只展不点；凭据 data-chat-chips / data-chat-chip / data-picked 齐 | ✅ |
| T4 | **GateHint 组件 + 两挂载点**：契约 §3.2 组件全文 + §4.1 第 3/6/7 行挂载（gateId==='0-final' 条件） | 0-final 挂载 / 其他门不挂 / 无门不挂三态成立；文案逐字 = 契约 §3.2 | ✅ |
| T5 | **指令层 + demo**：showrunner.md 纪律 10 增补段（契约 §4.2 逐字）；demoChatItems 追加 d9（契约 §4.3 逐字） | 纪律 9 词表零改；d9 结构同既有 d6-d8 风格 | ✅ |
| T6 | **新建 chat-chips.test.tsx**：契约 §5 组①7 例 + 组②10 例全实现 | 新文件 17 例全绿；测试文件数 60 → 61（净增恰 1） | ✅ |
| T7 | **全量回归 + 静态验证**：全量测试 + typecheck + 禁用串复查 + K1/K8/K9 复核 | 61 文件全绿（704+17=721 passed / 0 failed / 1 skipped）；typecheck 恰 3 条历史基线零新增；禁用串零扩散（仅契约允许位出现）；shared/types.ts / package.json / ipc 零 diff | ✅ |
| T8 | **dev-mock 目验**：起 dev 服，d9 chips 上屏、点击代发、hover/disabled 态目验；qh 走单测已覆盖（dev-mock 无真实 0-final 门，不强求目验 qh） | 目验结论 + 截图/描述留痕变更记录 T8 | ✅ |
| T9 | **治理收尾**：变更记录 T 序列回填；偏差清单 B-45 落表翻 ✅；docs/features/README.md 0xx 段增行；checkbox 全勾；呈报 | 三处治理文件 diff 就位；变更记录 T/X 节完整 | ✅ |

> **完成后**：向用户呈报 T1-T9 实测摘要 + 全量回归数字 + 治理文件 diff 清单，请求验收。
