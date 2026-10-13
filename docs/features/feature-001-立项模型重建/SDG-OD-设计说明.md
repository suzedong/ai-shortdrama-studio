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
