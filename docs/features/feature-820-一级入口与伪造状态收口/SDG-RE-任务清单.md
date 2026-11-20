# SDG-RE-任务清单 · feature-820 一级入口与伪造状态收口

## 1. 改动清单

| # | 文件 | 动作 | 说明 |
| --- | --- | --- | --- |
| 1 | `src/studio/shell/StudioApp.tsx` | 修改 | 底栏改为真实状态（文本服务 / 运行时 / ComfyUI 配置 / 画布更新时间），删除虚构端口、批量进度、Harness 计数与自动保存文案；资源库新增「本地模型」入口并接线 |
| 2 | `src/studio/shell/LeftPanels.tsx` | 修改 | Skill 广场类目真实筛选、删除死按钮并标注未开放；专业插件删除假开关并标注未开放；新增本地模型面板 |
| 3 | `src/studio/shell/AiServicePanel.tsx` | 修改 | 新增导出纯函数 `summarizeActiveProvider()`：把服务商差异收敛到 C7 豁免文件，供底栏消费 |
| 4 | `src/studio/shell/studio-flow.test.tsx` | 修改 | 更新无项目态底栏断言；新增「有项目底栏只呈现真实状态」等 4 例 |
| 5 | `docs/features/README.md` | 修改 | 8xx 表登记 feature-820 |

> 触发卡口核对：K1（`shared/types.ts`）零触发；K8（IPC/MCP）零触发——只消费既有 `settings.ai.get` / `runtime.status` / `settings.comfy.list`；K9（依赖）零触发。

## 2. 任务与验收

- [x] T1 建立 820 任务包（需求规格 / 契约 / 设计说明 / 任务清单 / 变更记录）。
- [x] T2 底栏真实化：读取文本服务、运行时、ComfyUI 配置与 `canvas.updatedAt`；读取失败显示中性文案。
- [x] T3 删除底栏虚构项：三个端口、`镜头批量 12 / 18`、`✓ Harness 校验 30 项`、`2 分钟前自动保存`。
- [x] T4 Skill 广场：类目按卡片 `cat` 真实筛选；删除「在对话中试用 →」，面板顶部与卡片标注未开放。
- [x] T5 专业插件：删除假开关状态，改为「未开放」标识与说明。
- [x] T6 资源库新增「本地模型」入口：说明未开放范围 + 「打开 AI 服务设置」按钮接线既有面板。
- [x] T7 更新测试与类型检查；真实 Electron 用 CDP 取 DOM 文本证明虚构项消失。
- [x] T8 更新 README 索引、P1 调查记录与总计划阶段视图。

## 3. 验收标准（AC）

| 编号 | 判据 | 结果 |
| --- | --- | --- |
| AC-1 | 有项目时底栏不再出现 `10.203.3.52:8000` / `:8001` / `:8002`、`镜头批量`、`Harness 校验`、`2 分钟前自动保存` | ✅ 单测 + 真机；真机底栏与整页 `staleInFooter=[]` / `staleInBody=[]` |
| AC-2 | 有项目时底栏文本服务名称与模型来自 `settings.ai.get()`；`keyConfigured=false`（ark）时不得显示绿色在线点 | ✅ 单测 2 例；真机 `ark-code-latest` 与事实源一致 |
| AC-3 | 运行时槽位随 `runtime.status().state` 变化（running/starting/error/stopped 文案与色点一致），读取失败显示「未读取」 | ✅ 单测断言 running/healthy；真机 `运行时 · 运行中` 与 `healthy:true` 一致 |
| AC-4 | ComfyUI 槽位仅陈述配置数量，不声明在线；无实例时显示「未配置」 | ✅ 真机 `ComfyUI 已配置 1/1 启用`，在线断言 0 命中 |
| AC-5 | Skill 广场类目按钮真实筛选列表；页面不存在无行为的「在对话中试用 →」；插件面板不存在可切换的假开关 | ✅ 真机点「情绪」后卡片由 2 → 1；`在对话中试用` 0 命中；`role="switch"` 计数 0 |
| AC-6 | 资源库存在「本地模型」一级入口，点击可见未开放说明，且「打开 AI 服务设置」可打开既有面板 | ✅ 真机 `dialog[aria-label="AI 服务设置"]` 已弹出 |
| AC-7 | `npm run typecheck` 通过；本包相关测试通过；`shared/types.ts`、preload、`global.d.ts`、`package.json` 零 diff | ✅ typecheck exit 0；`architecture` + 专项 29/29、shell 套件 11 文件全绿；全量 12 个失败文件均为既有基线（谱系资源 v1.47 与夹具 v1.46 / CRLF frontmatter），无一在 shell / 本包范围；四个受保护文件零 diff |

## D-037 文档归并 Change：接收 feature-804（2026-11-19，✅ 文档完成）

- [x] 读取 feature-804 五份标准文档与本包现行约束，保留原任务、AC、ENV-02 证据及 macOS 挂起项。
- [x] 在本包需求、契约、设计分别补入平台窗口参数、五个既有窗口通道、命中区/颜色/no-drag、主进程状态权威、Snap Layouts 代价及 preload.cjs 构建链。
- [x] 裁决「不做深色」和「零新增 IPC / preload / global.d.ts」的历史适用范围。
- [x] 仅修订文档；未改产品代码、测试、shared/types.ts、依赖或真实项目数据。

**文档 AC**：① 本包无需回查 feature-804 即可理解现行窗口外壳；② Windows 已验收与 macOS AC5 挂起没有混写；③ 历史「不做深色」未变成现行禁令；④ 本次文档 Change 不宣称新增接口、产品能力或真机验收通过。
