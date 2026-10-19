# SDG-OD-设计说明 · feature-005 「已捕获口径」常驻区

## 1. 落点架构

```
renderer                                        electron 主进程
──────────────────────────────────────────────────────────────────────
StudioApp 右栏 aside（chatWidth 300–640 体系）
  ├ CaptureBar（新，常驻条）                     electron/capture/
  │   ├ 收起态：N 条 · M 待确认                   └─ store.ts（新，唯一读写点）
  │   ├ 展开态：条目行 + 三色标签 + 行内操作           ├ 读：磁盘直读（无文件=空库/损坏=抛错）
  │   └ 编辑/确认/删除 ── capture:upsert ───────►   ├ 写：upsert/remove 经写队列 enqueue 串行
  │        （系统直写，D-016，不经 AI）           ◄── ├ 广播：写成功 → capture:changed（全量）
  ├ ChatComposer（零 diff）                       │   └ id 分配 / topic 匹配 / status 推导
  │   └ 对话纠正 ── Agent 提取语义                electron/mcp/tools.ts +3（22→25，K8）
  │        ▼                                      │   └ shortdrama_capture.list/upsert/remove
  │   showrunner（铁律收窄修订）──────────────────► ┘      = 同一 store 薄壳（Agent 通道）
  │        「提取即 upsert / infer 待确认 /
  │          user 带 quote / 就绪自检对照口径」
  └ shared/types.ts（K1）：CaptureSource/CaptureStatus/CapturedFact/CaptureFile
落盘：项目根 `已捕获口径.json`（覆盖式，不版本化）
```

- **双通道同一事实源（用户裁决②）**：MCP 工具与 IPC handler 均调 store 单点，同文件、同写队列、同广播；面板直改后 Agent 下轮 `capture.list` 即新值，Agent upsert 后面板经 `capture:changed` 即时刷新。
- **通道定性（D-016）**：增删改/确认/读取 = 确定性操作系统直做；「从对话提取事实、理解纠正语义」= 开放式语义理解归 AI。面板为默认入口，对话为开放式兜底，两通道落同一数据模型同一追溯。
- **不建节点不建门（§2.6.8）**：口径区为常驻元素，canvas.json 零新增节点、gate 零新增门；与 brief 体系的接合仅在 Agent 提示词层（就绪自检/来源回溯对照），plan/publish 代码零 diff。

## 2. 关键决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | 独立文件 `已捕获口径.json`，非 canvas.json 扩展 | §2.6.8 明示常驻元素不画成节点；独立文件职责单一，与 `故事背景档案.md` 同级同白名单 |
| D2 | 覆盖式更新不版本化 | 口径是过程态草稿（定案前的脚手架），非定案产物；追溯 = 同一文件 + 写队列 + changed 广播 + 每条 updatedAt，对话流留完整语义痕。立项单版本化体系（feature-001/004）不适用于草稿 |
| D3 | store 单点读写、MCP/IPC 双薄壳 | 双通道同一数据模型同一追溯（用户裁决②）；与 feature-002 updateBrief「系统直写与 Agent 工具平行」模式同构 |
| D4 | upsert 匹配：id 精确 > topic trim 精确匹配 | Agent 纠正场景须能命中既有条（避免「2002」改「2003」变两条）；topic 开放词表下 trim 精确相等是唯一可靠键 |
| D5 | 4 类型进 shared/types.ts（K1） | MCP 工具契约 / IPC DTO / renderer 渲染三端消费，镜像不可行；同 feature-002 先例（K1 建包登记、批准后实施） |
| D6 | source 缺省 = infer、user 须 quote 举证 | 安全侧默认「待确认」；user 标定须逐字原句，对齐 B-15 字段来源回溯精神——宁可 pending 待定，不写无来源事实 |
| D7 | brief.plan 消费侧仅提示词层对齐 | 「共同数据源」语义经 showrunner 纪律落地（就绪自检/来源回溯对照口径文件），plan.ts/publish.ts 零 diff；结构化映射属后续演进，不背进本包 |
| D8 | 挂点右栏对话区顶部常驻条 | 用户裁决③：对齐原型 ct「对话中 · N 口径已落库」位置语义；在 chatWidth 300–640 体系内随栏宽伸缩，不挤占中栏 |
| D9 | showrunner 铁律收窄修订，归 feature-001 R-006 | 仅「口径」一条豁免落盘（设计书 §2.6.1 强制），诊断卡/风格选型等其余候选态维持对话流；「不建门、不建画布节点」保留；指令层改动按 R-004/R-005 先例归 feature-001 变更记录 |

## 3. 文件白名单

**新增（4）**：`electron/capture/store.ts`、`src/studio/CaptureBar.tsx`、`src/test/capture-store.test.ts`、`src/studio/capture-bar.test.tsx`
**修改（≤9）**：`shared/types.ts`（K1）、`electron/mcp/tools.ts`（K8，22→25）、`electron/main.ts`、`electron/preload.ts`、`src/global.d.ts`、`src/studio/StudioApp.tsx`、`src/dev-mock-api.ts`、`resources/opencode/agents/showrunner.md`、`docs/features/feature-001-立项模型重建/SDG-AI-变更记录.md`（R-006）
**文档（4）**：本包 5 文件、`docs/features/README.md`、`docs/设计现状与偏差清单.md`（B-38）、`版本记录.md`
**零 diff 红线**：`electron/brief/*`、`electron/gate/*`、`electron/canvas/*`、`ChatComposer.tsx`、`tailwind.config.js`、`package.json`、全部既有测试文件

## 4. 风险与边界

| 风险 | 处置 |
|---|---|
| Agent 不提取得落盘（提示词遵从失效） | 纪律文本收窄改写 + 就绪自检对照要求；T7 真机目验覆盖「对话提取 → 常驻条累积」全链 |
| topic 漂移（同义不同词产生重复条，如「时间」vs「time」） | upsert topic 精确匹配缓解同词更新；showrunner 纪律给推荐词表收敛用词；用户可面板编辑/删除兜底 |
| 面板直改与 Agent 写入并发 | 写队列串行化既有保证；upsert 按 id/topic 幂等，后写覆盖先写（草稿语义可接受） |
| 文件损坏 | list/upsert/remove 均抛错不静默覆盖（对齐 feature-004「不放行猜测」）；面板错误态展示，用户裁决后处理 |
| 口径无限累积刷屏 | 常驻条默认收起一行；展开列表按 id 升序；删除入口常备 |
| 旧项目无文件 | 读取 = 空库不报错，面板空态引导文案；首次提取即初始化 |
