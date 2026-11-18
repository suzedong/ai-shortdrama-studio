# SDG-OD-设计说明 · 多创作页与自由画布持久化

> 日期：2026-11-17 ｜ 上游：[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)
> 来源标签：[Design 原有·形态对齐] 多创作页、活动状态、自由画布、缩放/小地图/吸附；[自研新增实现] 单 JSON v4、命令事务与项目隔离。

## 1. 设计依据与设计稿地址

本包无独立视觉稿，不凭想象新造风格。用户批准的实施计划已明确允许以以下**参考运行时证据 + 现行设计系统**作为改编设计依据：

| 用途 | 事实源 / 地址 | 采用内容 |
| --- | --- | --- |
| 参考产品行为 | [Parity 影响矩阵 §1.4](../../design/MiniMax%20Design%20Parity影响矩阵.md) | 两个创作页、活动页跨完整重启恢复、页内节点恢复、50% 缩放、小地图、吸附 |
| 当前缺口 | [P1 调查记录 §3-③④](../../verification/p1-2026-11-15/P1调查记录.md) | 单画布、无坐标、视口不持久化、画布视图不恢复 |
| 画布视觉 | [CanvasBoard.tsx](../../../src/studio/canvas/CanvasBoard.tsx) | canvas/surface/line/ink/muted/violet、节点卡、工具条、缩放与小地图 |
| 内联确认 | [ComfyServicePanel.tsx](../../../src/studio/shell/ComfyServicePanel.tsx) | 原位改名输入、确认/取消、删除二次确认、bad 色错误 |
| 导航与焦点 | [ProjectNav.tsx](../../../src/studio/shell/ProjectNav.tsx) | 紧凑列表、选中态、focus-visible ring、键盘可用性 |

不复制参考产品闭源代码、商标、私有素材或云状态。

## 2. 架构设计

### 2.1 单一数据树

```text
Canvas v4（项目）
├─ activePageId / activeView / gates / revision / receipts
└─ pages[]
   ├─ title / activeCanvasId
   └─ canvases[]
      ├─ title
      ├─ nodes[]（node.position?）
      ├─ edges[]
      └─ viewport { x, y, zoom } | null
```

根级不保存活动画布 nodes/edges 副本。 gates 保留项目级，因为 Gate 属于项目共享会话；否则仅增加画布就会悄然改变 gate.decide 的目标语义。

### 2.2 两类写路径

**Revision 命令路径**

```text
UI / MCP
→ 捕获 projectDir + 固定 page/canvas target
→ 全局串行写队列
→ commandId/hash 重放检查
→ expectedRevision 检查
→ 深拷贝 mutate
→ revision + 1 / receipt 截断 100
→ archive + temp/fsync/rename
→ 按项目更新 cache + broadcast
```

适用于页/画布结构、node.move、assets.bind/unbind 和既有 canvas.update。

**ViewState 路径**

```text
active.set / viewport.set
→ 捕获 projectDir + 校验目标
→ 同一全局串行写队列
→ 仅改活动状态或目标 viewport
→ revision/receipts 不变
→ archive + temp/fsync/rename
→ 按项目更新 cache + broadcast
```

相同值请求不写盘。视口不进入 revision，避免缩放平移制造大量回执和 Agent 写冲突；它仍与命令共享队列，保证文件写顺序。

### 2.3 项目与目标隔离

- 入队前捕获解析后的 projectDir；cache 为 `Map<projectRoot, Canvas>`。
- 请求只带 projectId，不带项目绝对路径；主进程校验 projectId 与捕获根目录身份。
- update/withCanvas 在入队前 await get 并固定 page/canvas；后续队列任务不得重新读取活动目标。
- 资产索引读取使用同一 projectRoot；广播 Canvas 自带 projectId，命令/ViewState 结果另带完整 target。
- renderer 为 get/viewState 维护请求序号和联合 key；旧项目、旧页、旧画布响应直接丢弃。
- reset 仅失效指定项目缓存，不用“清全局 cache”掩盖串项目写。

## 3. 迁移设计

1. 新空项目直接创建 v4 一页一画布。
2. v2/v3 读取时固定映射为 legacy-page/legacy-canvas；v2 重置事务字段，v3 保留合法 revision/receipts。
3. 原根 nodes/edges 进入 legacy 文档，gates 留根级；有节点默认 canvas 视图，空档默认 stage0。
4. get 不写旧档；首次实际命令或 viewState 变化成功后将完整 v4 原子替换。
5. v4 严格校验层级、id、活动引用、viewport 和事务字段；坏档抛错，绝不初始化为空图覆盖。
6. `canvas.update` merge 对缺省 position 采用“保留旧值”，与 parentReference/assetIds/dirty 的既有策略一致。

## 4. Renderer 交互设计

### 4.1 管理条布局

管理条位于画布内容顶部，空态与非空态均存在：

```text
[创作页 1] [创作页 2] [＋]  |  [画布选择 ▾] [＋画布] [改名] [删除]
```

- 创作页使用横向 tabs；活动 tab 用 violet 浅色底/文字和明确边框，非活动项用 surface/muted。
- 页内画布使用原生 select，避免在窄中栏重复堆叠第二行 tabs；新画布与改名/删除按钮沿用紧凑 icon-button。
- 改名原位替换标题控件为 input，Enter/确认保存，Escape/取消恢复；trim 后 1–80 字符。
- 非空删除原位显示“仅删除结构，不删除产物或资产文件”及确认/取消；空对象可直接删。
- 最后一页/画布禁用删除并给出原因；主进程仍独立校验所有边界。
- 管理条不参与 world transform，不随 zoom/pan 移动，不遮挡右下小地图和底部缩放工具。

### 4.2 自由拖动

位置优先级：`dragOverrides[nodeId] → node.position → STAGE 确定性布局`。

- pointer move 仅更新本地 dragOverrides 和吸附参考线，不发 IPC。
- 移除“跨 STAGE = illegal / 回弹”的规则；所有有限世界坐标均可摆放。
- pointer-up 以最终坐标发送一次 node.move，expectedRevision 来自当前 Canvas。
- 等待确认时保留临时位置；成功广播含相同 position 后清 override；冲突/失败清 override 并显示安全错误。
- 联合 key 变化清空 drag、选择、参考线和 pending 状态；同 nodeId 在其他画布不得复用 pending。
- 吸附仍比较所有未拖节点的实际位置；边路径使用新坐标。

### 4.3 自由包围盒与小地图

确定性布局的左上角假设不能继续用于负坐标。layout 输出增加 minX/minY，并计算包含全部节点的 width/height：

- fit 使用 `(minX, minY, width, height)` 计算 zoom/pan。
- 小地图以 minX/minY 归一化节点和视口，不假定世界从 (0,0) 开始。
- 空文档使用既有空态，不计算 NaN/Infinity 缩放。
- 有持久化 viewport 时 resize/广播不自动 fit；无 viewport 时才执行初次 fit 或活动 STAGE 居中。

### 4.4 视口与活动视图

- 进入画布时从活动文档 viewport 初始化 pan/zoom；null 才走初始 fit。
- wheel 立即更新本地视口，短防抖只保存最终值；pan pointer-up 和主动 fit 立即保存。
- 自动 fit 不落盘，避免读取旧项目本身构成写操作。
- 切换页/画布/项目取消旧 timer，旧响应按联合 key 丢弃。
- StudioApp 的立项/画布导航调用 active.set；activeView 与活动页/画布一起跨完整重启恢复。
- 页/画布切换不调用 session.reset，不改变 activeSessionId、对话历史、草稿或资产附件。

## 5. 可访问性与测试锚点

新增稳定语义/锚点：

- 创作页 tablist/tab 与 `aria-selected`。
- 画布 select 的可访问名称“当前画布”。
- “新建创作页”“新建画布”“重命名创作页/画布”“删除创作页/画布”按钮。
- inline 改名 input、删除确认组及状态提示。
- 保留既有 viewport、node、minimap、zoom 锚点，不重复 id。

全部按钮可键盘聚焦，禁用态有原因；颜色不是活动/错误状态的唯一表达。

## 6. 视觉验收标准

| 场景 | 通过标准 |
| --- | --- |
| 空画布 | 管理条仍完整可用；空态说明、管理条和底部工具不重叠 |
| 两页/两画布 | 活动 tab/select 清晰；标题截断不挤压新建与改名按钮；中栏可横向滚动 |
| 改名 | input 宽度受控，Enter/Escape 行为明确，非法标题有错误且不写盘 |
| 删除确认 | 说明只删结构；确认/取消层级清晰，bad 仅用于危险确认和错误 |
| 自由布局 | 节点跨列无回弹提示；参考线、边和小地图跟随，负坐标不裁掉节点 |
| 视口恢复 | 切页/切画布及重启后 zoom/pan 不跳变；广播不造成拖动/缩放抖动 |
| 深/浅主题 | 仅使用既有 canvas/surface/line/ink/muted/violet/bad 令牌，文字与边框可辨 |
| 现有工具 | 底部 zoom/fit/小地图和聊天/资产面板保持原布局与行为 |

证据优先为真实 Electron 截图 + DOM；若本环境截图仍空白，则以 DOM 计算状态、焦点/选中属性、canvas.json 与主进程日志为证，并明确“无可用截图”，不得宣称视觉截图通过。

## 7. 兼容与降级

- 无 position：确定性布局；无 viewport：初始 fit；v2/v3：只读懒迁移。
- viewState 写失败：保留本地可操作视图并提示“视口未保存”，不得显示已持久化成功；后续用户操作可重试。
- node.move 冲突：恢复最新持久化坐标，不跨目标重放。
- 非空删除未确认、最后项删除、坏档、资产缺失和项目不匹配均明确失败，无假 Toast。
- 切片 D 的资产安全 DTO、上传/缩略图、会话和 Gate 通道不变。
