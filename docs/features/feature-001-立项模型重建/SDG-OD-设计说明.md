# feature-001 立项模型重建 · 设计说明

> 本包以**数据/编排重建**为主，UI 变化仅为「既有组件适配新 schema + 术语对齐」，无新页面、无新建视觉稿。STAGE 0 新模型的界面静态壳已由 [Stage0View.tsx](../../../src/studio/Stage0View.tsx) 预置（1 入口 + 2 节点 + 定案门弹层），本包**不接线**（需求 §4.2）。

## 1. UI 改动面

| 位置 | 改动 | 视觉验收 |
|---|---|---|
| [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) `BriefView` | 旧 ProjectBrief 卡（六要素+视觉风格长表+预检 6 项+对标总结）→ v2 卡 | 区块顺序：项目性质 → 立项六要素 → 故事前提（5 行）→ 视觉风格（`A7 @ v1.46` 一行 + 辅助气氛）→ 选题诊断结论 → 拍板信息（方式/时间，口头拍板显示原话引述）→ 相对上一版改动（v1 显示「首版立项」）。无「生产预检」区块；「待定」值原样显示不飘红 |
| [CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx) | 节点 kind 标签 `brief` 文案「创意简报」→「立项单」 | 画布第 0 步 done 节点显示「立项单 vN」（标题来自节点 title，kind 标签显示「立项单」） |
| [StageNavPanel.tsx](../../../src/studio/StageNavPanel.tsx) | 用户可见「创意简报」措辞 →「立项单」 | 左栏流程导航无「创意简报」字样 |
| GateCardView（不改代码，改喂入内容） | STAGE 0 门卡由 `0-final` 载荷驱动 | 门卡问题文本含 v(N+1) 与待定点/改动摘要；选项为「发布立项 v(N+1)」「再改改」 |
| Stage0View（不改代码） | 静态壳文案若残留旧门号（如 GATE_DIFF 中 preflight 字样）做最小措辞清理 | data-s0-* 钩子不变，不新增 IPC 调用 |

## 2. 不新增视觉资产

- 无新图标 / 新配色 / 新弹窗：定案裁决复用既有 GateCardView 视觉；立项详情复用 StudioViewer 卡片容器与 Section 组件（保持与大纲/小传查看器同一套排版）。
- 定案卡弹层的完整版（六要素+diff 双栏+历史回滚）属 Stage0View 接线专项包（P1），本包不做。

## 3. 视觉回归基线

- 画布：`canvas-board.test.tsx` 现有快照/DOM 断言保持通过（其固定文本已为「立项单」）。
- 对话流：`studio-flow.test.tsx` 门卡挂载断言只换门 id，挂载位置与样式类名不变。

---

## 4. D-037 归并职责边界

1. **001 = 数据与执行事实源**：影响字段分级、依赖反查、系统直改恒 mark、Agent 三选一、dirty 版本对、重对齐定稿前提与 `canvas.align` 血缘语义在此维护；002 / 007 只保留当时方案与证据。
2. **013 = renderer 呈现事实源**：影响面板、脏读黄条、重对齐确认和批量勾选只消费本包数据与协议，不复制影响算法，也不把 UI 关闭解释为撤销再版。
3. **冲突裁决**：002 / 007 的“无影响面板”仅是历史范围排除，已被 011 正式翻案并由 013 承接；其底层评估与清脏约束继续有效。005 不参与 dirty realign，004 只负责历史版本再发一版，不接收 007。
4. **010 的协议与视图拆分**：001 维护 `【追问选项】` 块、原文 quote / capture、完整定案卡和 verbal 双前提；013 维护非锚定解析、ChipRow / GateHint 挂载与门卡 Markdown 阅读，817 只负责视觉。chip 是用户输入的快捷形态，不是新的拍板数据通道。
5. **012 的数据与算法拆分**：001 负责完整字段、风格 ID@版本、changesFromPrevious / changeLog / decision 留痕及再版 impactSummary 快照；002 负责 assess，013 负责摘要展示与 approved 留存，806 负责 findings。`runId`、`changelogDecision` 不是来源包已定义字段，不在设计中补造。
6. **015 的业务草案与执行器拆分**：001 负责 payload.draft 的完整 BriefDraft、首版 / 再版 Agent 提示词和禁止双写；801 负责 pending、版本防护、execute / execution、失败门态和 manifest 顺序。草案内容错误与执行故障继续分流，001 不定义 execution 三态或 execution runId。
7. **编号冲突不静默裁决**：010 AC4 与契约 R3 对编号行的要求相反，X-002 只修订闭合块位置；本轮在 001 / 013 同时标为未裁决，不以文档归并代替产品决策。
8. **验证边界**：来源包的测试计数和 PASS / FAIL 不在本包复制；011 / 013 的 Electron 沙箱目验和 015 真机交互验收仍开放。本轮没有架构、接口或代码变更，上述边界只决定后续文档维护与验收归属。
