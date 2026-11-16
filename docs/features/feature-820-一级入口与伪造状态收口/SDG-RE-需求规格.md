# SDG-RE-需求规格 · feature-820 一级入口与伪造状态收口

> 档案类型：标准 5 文件档（实施中触达第 4 个代码文件 `shell/AiServicePanel.tsx`，由 3 文件精简档升级；K1/K8/K9 仍零触发）
> 溯源标签：**[自研新增]**
> 上游证据：[P1 调查记录](../../verification/p1-2026-11-15/P1调查记录.md) §3-⑧⑨、§2 阶段门「所有可见一级入口都有真实行为、明确的未开放状态或已批准的不纳入说明」
> 关联决策：D-016（系统优先、AI 归位；不伪造未接通的在线成功）

## 1. 背景与问题

P1 调查确认工作台存在三类「可见但不可用、且不声明」的状态：

| 位置 | 现状 | 问题 |
| --- | --- | --- |
| 底栏状态条 `src/studio/shell/StudioApp.tsx` | 整条硬编码：`火山方舟（文本）`、`10.203.3.52:8000 / :8001 / :8002`、`镜头批量 12 / 18`、`✓ Harness 校验 30 项`、`2 分钟前自动保存` | 全部与真实状态无关；绿色圆点表示「在线」，但从未探测；进度与校验项数为虚构 |
| 左栏 Skill 广场 `src/studio/shell/LeftPanels.tsx` | 4 条内置卡片；类目按钮（全部 / 短剧 / 情绪 / 校园）只高亮不筛选；「在对话中试用 →」无 `onClick` | 假筛选 + 死按钮，用户以为可执行 |
| 左栏专业插件 `src/studio/shell/LeftPanels.tsx` | 4 条内置插件；开关只改组件 `useState`，不落盘、不生效 | 假开关，重启即复原且对系统无影响 |
| 资源库一级入口 | 无「本地模型」入口 | 本地模型能力边界无处可查 |

## 2. 目标

1. 底栏只呈现**可从真实数据源读取**的状态；读不到就明确显示「未读取 / 未配置」，不得用演示值冒充。
2. 移除虚构的端口、批量进度与 Harness 校验计数；保留的能力状态全部有数据源。
3. Skill 广场：类目按钮**真实筛选**；删除无行为的「在对话中试用 →」，以明确的未开放说明替代。
4. 专业插件：删除假开关，标注「未开放」。
5. 资源库新增「本地模型」一级入口，展示未开放范围与现有替代路径（AI 服务设置 / ComfyUI）。

## 3. 契约摘要（完整契约见 [SDG-RE-契约.md](./SDG-RE-契约.md)）

| 项 | 约定 |
| --- | --- |
| 数据源 · 文本服务 | `window.api.settings.ai.get()` → `AiServiceSettingsView`：`activeProvider`、`ark.model`、`ark.keyConfigured`、`lmstudio.model` |
| 数据源 · 运行时 | `window.api.runtime.status()` → `RuntimeStatus`：`state: 'stopped' \| 'starting' \| 'running' \| 'error'`、`healthy` |
| 数据源 · ComfyUI | `window.api.settings.comfy.list()` → `ComfyInstance[]`：只取 `length` 与 `enabled` 计数，**不做连通性断言**（本包不发起网络探测） |
| 数据源 · 画布更新时间 | `canvas.updatedAt` → 底栏显示「画布更新于 HH:MM」 |
| 读取失败 | 任一数据源抛错 → 该槽位显示中性文案（`未读取` / `未配置`），不得显示绿色在线点 |
| 复用约束 | 仅消费既有 IPC；**零新增 IPC、零 preload / global.d.ts 变更**（K8 零触发） |
| 组件边界 | 底栏逻辑内联在 `StudioApp.tsx`；左栏面板仍在 `LeftPanels.tsx`，不新增模块 / 目录 |
| 底栏生命周期 | 仅 `hasProject === true` 时渲染并读取状态；无项目态保持整块不渲染（feature-812 既有契约） |

## 4. 非目标

- 不接入 Skill 市场、插件注册表，不给 Skill / 插件补真实执行通道（属 P5 范围，逐包裁决）。
- 不在底栏做 ComfyUI 实例健康探测（`settings:comfy:test` 是主动网络请求，交互成本高，留待需要时单独设计）。
- 不改 `shared/types.ts`、IPC/MCP 契约、依赖。
- 不改动 ChatComposer 的 dev-mock 演示消息注入逻辑。

## 5. 验收口径

见 [SDG-RE-任务清单.md](./SDG-RE-任务清单.md) AC-1—AC-7。
