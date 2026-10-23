# SDG-OD-设计说明 — feature-007 产物重开对齐二次确认

## 1. 落点架构

```
设计书 §2.6.6 L291 / §2.6.7 L354·357-361（重开二次确认 + 脏读黄条）
        │
        ▼
CanvasBoard 四处打开调用（L750 点击 / L752 Enter / L799 行内 view / L876 右键 view）
        │  全部汇聚 onOpenNode（L695 下传）
        ▼
StudioApp handleOpenNode（L377）  ★ 唯一拦截点，无旁路
        │  node.dirty 非空 ──→ confirmNode（新 state，L105 旁）
        │  否则 ──→ setViewerNode 直通（零回归）
        ▼
┌─────────────────────────────────────────────┐
│ RealignConfirm.tsx  [新建]                   │
│  buildRealignPrompt 纯函数（固定模板）        │
│  role=dialog 三选一确认卡片                  │
└─────────────────────────────────────────────┘
        │ 三动作分叉
        ├─ 按 vM 重新对齐 → 关确认+关查看器 → handleSend(模板消息)
        │                    → 808 promptAsync 链路 → showrunner R-008 纪律
        │                    → 串行委派重生成 → canvas.align 清脏推进血缘（002 既有）
        ├─ 保持现状查看 → 关确认 → 查看器开 + 脏读黄条（StudioViewer L613 后插）
        │                    └─ [一键对齐] → onRequestAlign → 再唤起同一确认
        └─ 取消 → 仅关确认

项目切换复位点（L274）：viewerNode / confirmNode 同点复位
复用零 diff：CanvasBoard dirtyFieldLabel / kindLabel / dirtyTitle 同源口径
```

## 2. 关键决策

| # | 决策 | 理由 |
| :-- | :-- | :-- |
| D1 | **触发点映射 = 打开 dirty 节点的只读查看器** | 设计原文「重新打开产物编辑」在现状唯一对应物即此（平台无产物编辑器）；查看器只读语义不变，映射在此留痕；后续若建产物编辑器，同一确认组件复用 |
| D2 | **拦截在 StudioApp.handleOpenNode 而非 CanvasBoard** | 四处打开调用全部汇聚该单点（L695 下传），拦截一处即全覆盖、无旁路；CanvasBoard 本体零 diff，dirty 三件套纯 export 消费 |
| D3 | **对齐走 Agent 对话通道，UI 不直调 align** | D-016 边界：触发 / 呈现是确定性操作（系统直做），内容重生成是 AI 文本生成（Agent 执行）；renderer 直调 canvas.align 需新 IPC = K8 越界；双通道落同一数据模型（CanvasDirty）与同一追溯机制（align 清脏推进血缘） |
| D4 | **黄条简版，无 [查看影响评估] 钮** | feature-002 §4.2 L82 将弹窗面板全量 UI 明示排除不翻案；impactReport 仅文件名纯文本提示；确认 = 单产物三选一（§2.6.6 L291 独立语义），非面板 |
| D5 | **指令层小补 R-008 双保险** | showrunner 脏读纪律原两条无「用户点名重对齐单个脏产物」专条；补第三条使模板消息有明确纪律承接（核实脏态 → 串行委派 → align），防 Agent 自由发挥 |
| D6 | **dev-mock 零 diff 目验** | n-outline 脏节点（dev-mock-api.ts L15-17，feature-004 AC9 夹具）素材现成，三路径 + 直通回归均可真机目验 |
| D7 | **零新 testid + 无 Esc / 背景点击** | 断言走 role（dialog / button）与文本钩子（K9 零）；取消钮与 Esc 等价，防误触（需求规格 §4.2 明示） |

## 3. 文件白名单

| 类别 | 文件 |
| :-- | :-- |
| 新增（2） | `src/studio/RealignConfirm.tsx`；`src/studio/realign-confirm.test.tsx` |
| 修改（3） | `src/studio/StudioApp.tsx`；`src/studio/StudioViewer.tsx`；`resources/opencode/agents/showrunner.md` |
| 文档（4） | `docs/设计现状与偏差清单.md`（B-42 行）；`docs/features/README.md`（总表 007 行）；`docs/features/feature-001-立项模型重建/SDG-AI-变更记录.md`（R-008 节）；本包变更记录 |
| **零 diff 红线** | `shared/types.ts`；`electron/**` 全部；`src/global.d.ts`；preload；`src/dev-mock-api.ts`；`src/studio/CanvasBoard.tsx`；Stage0View / BriefHistoryView / ChatComposer / VisualCatalog；既有 57 个测试文件；`tailwind.config.*`；`package.json`；`vite.config.*` |

## 4. 风险与边界

| 风险 | 边界 / 缓解 |
| :-- | :-- |
| viewerNode 是打开时快照，Agent align 后已开查看器内黄条不自动消失 | 可接受：查看器只读快照语义一贯如此（版本徽章同理）；重开即刷新；不引入推送 / 订阅（K8 零红线） |
| 重生成异步，清脏时机 = 重生成定稿后 align | R-008 纪律明示「重生成定稿后调 align」；期间黄条 / 角标仍在 = 正确提示（不阻断创作，§2.6.7 L361） |
| confirmNode 单例覆盖，无队列 | 交互上一次只能打开一个节点查看器，confirmNode 同构；连点两脏节点 = 后者覆盖前者，与 viewerNode 现状语义一致 |
| jsdom 无 `window.api` | 组件与模板函数纯渲染 / 纯函数，零 IPC 依赖；StudioApp 集成例 mock onSend 即可断言注入文本 |
| 模板前缀与 B-34 标签体系关系误读 | 前缀 `【产物重新对齐】` 是 user 消息行首协议标记，不经 B-34 标签解析剥离，固定落「用户」标签上屏；Agent 与用户均可读 |
| 既有测试零 dirty 夹具被误判回归 | 已 grep 坐实 studio-flow / studio-viewer 等既有 57 文件均无 dirty 夹具与打开断言冲突；本包既有测试文件全零 diff 是红线（契约 §4） |
