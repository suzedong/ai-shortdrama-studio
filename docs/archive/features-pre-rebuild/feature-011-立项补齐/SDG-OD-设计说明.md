# SDG-OD · 设计说明 · feature-011 立项补齐

> 版本：v1.0（待用户签字）
> 日期：2026-10-05
> 上游：SDG-RE-需求规格 v1.0 / SDG-RE-契约 v1.0

---

## 1. 模块总览

```
shared/types.ts                     K1：GateId/RevisionSource +'0-d'；harness +critical?
src/lib/preflight.ts          (新)  buildInitialPreflight / evaluatePreflight
src/components/PreflightCard.tsx (新) 6 项可编辑+锁
src/lib/gates.tsx                   0b/0c/1a/1b 真实化；新增 0d
src/components/GateCard.tsx         三按钮 + critical 两步放行 + 否决四要素
src/components/ProductViewer.tsx    brief 三 tab（六要素/视觉风格/生产预检）+编辑+锁
src/App.tsx                         0-d 编排、preflight state、版本逻辑、来源角标接线
src/lib/messages.ts                 makePreflight；makeGateAction 加 partial
src/lib/revision.ts / replay.ts / workflow.ts / candidates.ts / viewer.ts
electron/session.ts                 WORKFLOW_FIELDS +preflight；readFinalized 透出
electron/main.ts / preload.ts       project:list/create、template:save/list
src/components/ProjectSidebar.tsx   真实项目库
src/components/BackgroundArchive.tsx 最小校验（App 删除旁路）
src/components/ChatPanel.tsx        输入区入口诚实化
src/components/StageCanvas.tsx      点阵背景 + SVG 连线
```

设计原则：全部新增能力为**纯函数 + 受控组件**，副作用（落盘 / IPC）只在 App 层；不新增状态库、不新增依赖。

---

## 2. 状态流（立项四门）

```
idea ──0-a──> diagnosis ──0-b──> brief(六要素)
                                   │ 0-c confirm：visualStyle 定稿
                                   ▼
                          brief(active) + 预检初始 6 项 + 门 0-d
                                   │ 0-d confirm：saveProject(含 preflight, version)
                                   ▼
                            brief done ─> background active
```

关键：0-c 与 0-d 之间 brief 恒为 `active`；崩溃 / 重启可经 workflow（preflight 平铺）+ pendingGate=0-d 完整恢复。

### 2.1 App 新增 state

```ts
const [preflight, setPreflight] = useState<PreflightCheck[] | null>(null)
```

- 来源：0-c confirm 时 buildInitialPreflight；编辑 PreflightCard / 三 tab 时 setPreflight 并落盘；replay 恢复。
- 每次 preflight 变化，若当前 gate 为 0-d，以最新 evaluate 结果刷新门（重建 gate 对象并替换消息中的 gate 快照；复用既有 patchMessage）。

---

## 3. 判据细化

### 3.1 画幅 token 提取

```ts
function aspectToken(s: string): string | null {
  const m = s.match(/(\d{1,2})\s*[:：xX×]\s*(\d{1,2})/)
  return m ? `${m[1]}:${m[2]}` : null
}
```

- deriveFiveElements 产物形如「竖屏 9:16」可命中。
- aspectAligned：`const t = aspectToken(fe.aspectRatio); !!t && item4.value.includes(t)`。

### 3.2 dualRecipe

```ts
/(标准|standard|normal)/i.test(v6) && /(预览|preview|lightning)/i.test(v6)
```

qualityRecipe 初始文案含「标准档（euler/normal 20 步 CFG 2.5）+ 预览档（Lightning 4 步）」，天然通过。

### 3.3 1-a / 1-b 弱一致性

- 1-a 签名 `buildGate1a(o, background: string)`：
  - background trim 为空 → 「事实与背景档案一致」false。
  - 取主要角色名集合（优先由调用方传入 profiles；无则用 outline 中 `o.characters`（若有）；都无 → 该项 false，label 注「角色信息缺失」）。
  - 命中率 = 命中档案的角色名数 / 角色名总数；≥0.6 通过。
- 1-b 签名 `buildGate1b(ps, o)`：标记主角（profile 字段中 role/类型含「主」）的名称至少 1 个出现在 `o.logline + (o.mainPlot ?? '')`；无主角标记则取第 1 位。

### 3.4 背景档案最小校验

- 以 `【...】` 切段；统计「段正文去空白/去模板占位斜杠提示后长度 > 0」的段数 ≥3；`text.trim().length ≥ 80`。
- 校验函数放在 BackgroundArchive 内部（小组件无需抽公共模块）；不满足时按钮 disabled，下方红字列缺失段。

---

## 4. UI 设计要点

### 4.1 GateCard

- 三按钮 flex 布局：确认（黑底白字）/ 改部分（描边紫字，仅 partial 存在）/ 否决（描边）。
- critical ✗：harness 行 ✗ 用红字并在 label 后加「关键」小标签；确认区下方红字条；按钮二次转「仍要强制放行」。
- 否决反馈：内联 textarea，占位文本：

```
保留什么：
修改什么：
为什么：
期望结果：
```

提交拼接为结构化文本随重做发出。

### 4.2 立项单三 tab

- tab 头：下边框 + 激活态紫字下划线；三 tab 等宽。
- 编辑行：label（xs muted）+ input（focus 紫边）；锁图标按钮在 input 右侧，锁定时 input disabled、灰底。
- 预检 tab 直接嵌 PreflightCard。
- 顶部状态区：版本徽标（vN）+ 预检缺失黄条（旧会话）。

### 4.3 参考图

- 缩略图横排（3 张，96–120px 高，rounded-lg，object-cover）；失败渲染灰底 + 「参考图加载失败」。

### 4.4 来源角标

- 卡片右上小徽标：Mock = 灰底「Mock 演示」；ark = 紫底淡色「Agent · 火山方舟」。消息产物组件按 envelope meta.source 渲染（无 meta 时不显示，不猜）。

### 4.5 底栏

- 三态：ark 配置且通（绿点 火山方舟 已连接）/ ark 未配置（黄点 火山方舟 未配置·Mock 演示）/ 显式连接失败（红点 + 原因短文案）。媒体引擎恒为「ComfyUI（待接入）」。

### 4.6 画布

- 点阵：容器 `background-image: radial-gradient(circle, <line> 1px, transparent 1px); background-size: 16px 16px;`，background-size 随 scale 换算（16*scale）。
- 连线：节点行内用一个 SVG（高度 2px 不够承载路径——改为容器内绝对定位 SVG 覆盖整行，画节点右缘→下一节点左缘的水平直线/端点小圆；颜色复用 done=ok/40、invalidated=bad/50、否则 line）。
- 不做拖拽；等距由现有自动布局保证，行内节点垂直居中即「对齐」。

---

## 5. IPC 实现要点（main.ts）

- project:list：`fs.readdir` 会话根目录，筛 `project-*` 前缀目录；逐个尝试读 manifest（createdAt）+ 目 录 stat.mtime；任何异常跳过。返回数组按 mtime 倒序。
- project:create：`project-<YYYYMMDD-HHmmss>-<rand>`，写空 manifest 骨架（workflowVersion:1、nodes 初始、saved:true）；返回 dir。
- template:save：slug 由 name（时间戳兜底）；写 `templates/<slug>.json`，内容 `{ name, savedAt, brief }`；同名覆盖前归档旧文件（复用版本归档思路，简单 .bak 亦可——契约未要求归档，直接覆盖）。
- template:list：扫描 templates 目录，校验含 brief 字段，损坏跳过。

会话根目录常量复用 session.ts 既有解析（不重复定义路径）。

---

## 6. 测试设计（只增不减）

| 新文件 / 改动 | 覆盖 |
| :-- | :-- |
| preflight.test.ts（新） | 构造 / complete / aspectAligned / dualRecipe / token 缺失 |
| gates 既有测试扩展 | 0b(fe,d)、0c 形态、0d、1a/1b 数据缺失 |
| GateCard 测试（新增或扩展） | critical 两步、非 critical、partial、否决反馈 |
| messages 测试 | makePreflight、partial action |
| viewer/workflow/replay/candidates/revision 测试 | preflight 透出与恢复、0-d 映射 |
| ProjectSidebar 测试 | 列表渲染 / 搜索过滤 / 空态（mock window.api） |
| BackgroundArchive 测试 | 空模板禁锁、有效文本可锁 |

---

## 7. 验收条目（视觉 / 手动走查）

1. 新项目：一句话 → 0-a → 0-b → 0-c（含参考图）→ 预检卡 → 0-d → 背景档案，节点状态逐节点正确。
2. 0-d 缺项（清空某 value）：harness ✗ + 确认拦截 + 二次放行后可继续（用户显式自担）。
3. 横屏（平台「快手/B站 横屏」关键词）：brief、预检画幅显示 16:9。
4. 无 Key 启动：底栏「未配置·Mock 演示」、诊断角标「Mock 演示」、0-a 可过。
5. 旧项目（feature-010 之前会话）：打开正常，立项单顶部黄条，补录后黄条消失。
6. 项目库：删改磁盘目录后列表同步；搜索过滤；新建后自动切换。
7. 沉淀模板 → 新建立项 → 唤起模板 → 六要素/风格/预检预填。
8. 画布点阵随窗口缩放、连线状态颜色正确。

---

## 8. 风险与对策

| 风险 | 对策 |
| :-- | :-- |
| 替换门判据导致既有用例/流程大面积失败 | 判据仅在数据不可得时转 ✗；mock 同步补齐；按门逐个提交 |
| 0-d 中间态落盘引入恢复复杂度 | preflight 平铺进 manifest + pendingGate=0-d，复用既有 replay，不新机制 |
| 参考图服务不可达 | 懒加载 + 失败占位，零阻断 |
| 删 handleArchiveSave 影响现存保存行为 | 统一到 saveArchive → 节点推进；手动回归确认只有一条路径 |
