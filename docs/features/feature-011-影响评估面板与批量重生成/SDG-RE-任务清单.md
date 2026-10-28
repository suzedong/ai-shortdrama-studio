# SDG-RE-任务清单 ｜ feature-011 影响评估面板与批量重生成

> **状态：已批准实施并完成（2026-10-28，按推荐方案 D1-A / D2-C / D3 单条聚合 / D4 全系统 / D5-A）；T1-T10 回填见包内变更记录 T 节。**
> **基线参照（2026-10-28 实测）**：66 文件 761 passed / 0 failed / 1 skipped；tsc 恰 3 条历史基线（canvas-zoom.test.tsx 2 + runtime-client.test.ts 1）；MCP 11 族 28 工具；showrunner 白名单 23；K1 / K8 / K9 默认零触发。

---

## 任务表

| # | 任务 | 落点文件 | 验收口径 |
| :-- | :-- | :-- | :-- |
| T1 | **基线冻结**：复测并留痕 tsc（恰 3 条）/ 全量测试（66/761/0/1）/ 工具数（28）/ 白名单数（23）/ `git status` 干净度 | 变更记录 T1 行 | 实测数字与本文基线一致；不一致 → 停手呈报 |
| T2 | 纯函数层：数据归一（两入口→视图模型）/ 分组 / 默认勾选 / 计数 / 批量模板消息构建 | 新建 `src/studio/impact/impact-select.ts` | 契约 T-①②③ 对应用例先写或同写；纯函数零副作用 |
| T3 | 面板组件：改动字段摘要区 + 高/中分组勾选列表 + 三动作行（N 计数 / N=0 禁用）+ 降级态（空清单 / 读取失败） | 新建 `src/studio/impact/ImpactPanel.tsx` | 契约 T-③④⑤；形态对齐设计书 §2.6.7 L331-349 |
| T4 | 面板组件与纯函数单测 | 新建 `src/studio/impact/impact-panel.test.tsx` | 契约 T-①~⑤ 全绿 |
| T5 | StudioApp 接线：面板 state + 打开/关闭回调 + 勾选集 → 批量模板消息经 handleSend 注入 + 面板挂载（RealignConfirm 同级） | `src/studio/shell/StudioApp.tsx` | 既有用例零回归；契约 T-④ 消息体断言 |
| T6 | Stage0View 上报：submitBriefEdit 成功后 items>0 才上报（消费 updateBrief 返回值）；StudioViewer 黄条追加「查看影响评估」钮 + fileRead 回读重开 + 降级 | `src/studio/stage0/Stage0View.tsx`、`src/studio/viewer/StudioViewer.tsx` | 契约 T-⑥⑦⑧；L620 注释同步更新 |
| T7 | dev-mock 增补：updateBrief 演示返回 + 影响清单演示桩 | `src/dev-mock-api.ts` | 既有演示路径零回归 |
| T8 | 全量回归 + typecheck + 卡口实测 | — | 契约 T-⑨⑩ + AC9：66 基线上净增恰 2 测试文件全绿；tsc 恰 3 条零新增；28 工具 / 23 白名单 / package.json / shared 零 diff |
| T9 | 真机目验（dev-mock / Playwright 或 CDP）：编辑保存自动弹面板 → 勾选 → 批量消息上屏 → 黄条新钮重开面板 → 降级路径 | 变更记录 T9 行 + 截图留证 | AC1/AC4/AC6/AC7/AC11 逐步过 |
| T10 | **治理收尾**：README 总表追加本包行（同步修正 §2「10 族共 27 个」过时计数为实测 11 族 28 个）+ 设计现状与偏差清单登记行 + 变更记录 T 节逐条回填 + X 节明示（零修复则写「零修复」） | docs/features/README.md、docs/设计现状与偏差清单.md、本包变更记录 | 文档与磁盘实况一致；反向同步闭环（铁律 3） |

## 实施纪律

1. 严格按 T1→T10 序执行；T1 基线不一致立即停手呈报。
2. 每步 diff 不出契约 §4 白名单；触碰未登记卡口（含条件触发型）→ 停手 → 呈报 → 确认 → 变更记录追加决策。
3. 每任务完成即在变更记录 T 节回填：日期 + 实测数字 + 偏差留痕（如有）。
4. 测试先行或同行：T2/T3 实现与 T4 用例同批提交语义，禁止先实现后补测跨过 T8 才发现回归。
