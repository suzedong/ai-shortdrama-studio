# SDG-RE 需求规格 · feature-022 Renderer 重建与旧壳下线

> 状态：**v1.1 已验收**
> 日期：2026-10-08
> 验收日期：2026-10-08（C9 真机验收通过，见变更记录 E-022-02）
> 上游依赖：feature-019/020/021（三个垂直切片已验收闭环）；架构基线：feature-016 总纲任务清单第 022 行、OD §1–§3。

---

## 1. 背景与定位

新壳（`src/studio/`，feature-019 起随切片随建）已承载第 0/1/2 步全链路：canvas 订阅、runtime 事件归约、门裁决、多步分组画布。旧壳（`src/App.tsx` 1542 行重状态机 + 旧组件 + 旧 lib + 旧 IPC）经 RootSwitch 并存至今，仅作逃生舱。

按总纲，"删旧壳"必须在 019-021 全部验收后——条件已满足。本切片做两件事：**新壳补齐三块短板后转正**（项目导航、产物查看、三栏布局），**旧壳整体下线**（App 状态机、旧组件、旧 lib、旧 IPC、旧测试）。

### 1.1 范围决策（2026-10-08 待用户确认，见变更记录 D-022-01~05）

- 新壳转正后**无任何逃生舱**；RootSwitch 与"返回旧版"按钮删除。
- 旧壳独占功能（背景档案、风格谱系页、模板、参考图、旧门卡编辑）**不迁移**，随旧壳删除；后续如需按新架构重做，另立切片。
- 对话历史**不持久化**（重启后对话区清空；画布与门经 canvas.json 恢复）。

## 2. 用户与场景

| 用户 | 场景 | 期望 |
| :-- | :-- | :-- |
| 创作者 | 启动应用 | 直接进入新壳工作台；左栏可切换/新建项目 |
| 创作者 | 点击画布节点 | 只读查看该节点产物（读 `ref.path` 落盘文件渲染 JSON/MD） |
| 创作者 | 重启应用 | 画布节点/边/门状态完整恢复（含 pending 门可继续裁决）；对话区清空可接受 |
| 维护者 | 全仓检索 | 不存在旧壳代码、旧 IPC、旧 lib；renderer 无流程编排 |

## 3. 需求描述

### 3.1 功能性需求

- FR-1 **新壳转正**：`main.tsx` 直挂 `StudioApp`（保留 ErrorBoundary，去 `onBackLegacy`）；删除 `RootSwitch.tsx`。
- FR-2 **三栏布局**（对齐 016 OD §1）：左栏项目导航（固定宽，可折叠不做）；中栏 `CanvasBoard`；右栏 `ChatComposer` + 内联 `GateCardView`。窄屏（<lg）允许单列堆叠。
- FR-3 **项目导航**（左栏，新组件 `src/studio/ProjectNav.tsx`）：项目列表（`project:list`）、新建（`project:create`）、打开（`project:open`）；当前项目高亮；不增删 IPC。
- FR-4 **产物查看**（新组件 `src/studio/StudioViewer.tsx`）：画布节点点击 → 打开只读查看器；经新增 `file:read` IPC 按 `node.ref.path` 读落盘文件，JSON 美化 / MD 渲染；无 `ref.path` 或读失败给提示态；无编辑能力。
- FR-5 **旧壳下线（代码）**：删除 §4 白名单全部文件；`shared/types.ts`、`src/lib/chat-runtime.ts`、`src/lib/runtime-types.ts` 不动。
- FR-6 **旧 IPC 下线**：删除契约 §5 白名单 handle；`electron/preload.ts`、`src/global.d.ts` 同步裁剪；保留 handle 签名不变。
- FR-7 **门体验不变**：门呈现/裁决/恢复语义与 019-021 验收态一致（本切片只搬布局，不改门行为）。

### 3.2 输入 / 输出

- 输入：既有 `runtime:* / canvas:* / gate:decide / project:list/create/open` IPC；新增 `file:read`。
- 输出：三栏工作台 UI；只读产物查看器；删除后代码库不含旧壳残留。

### 3.3 非功能 / 边界

- renderer 架构铁律不变：studio 新代码无 opencode/ark/comfyui/引擎 import、无 URL/凭证（`architecture.test.ts` 自动覆盖新增文件）。
- 不改 `shared/types.ts`（无 K1）；不改 MCP 工具、runtime、agent profiles。
- `file:read` 安全边界：仅当前项目目录内、仅 `.json`/`.md`、≤1MB、路径逃逸拒绝。
- 自检三件套全绿：`typecheck` / `test:run` / `build:electron`。

## 4. 不做什么（Out of Scope）

- 第 3 步（资产）及以后步骤接入（feature-023/024/025）。
- AssetLibrary / SkillPanel（016 OD 提及，后续切片）。
- 对话历史持久化（明示不做，见 D-022-02）。
- 旧壳功能迁移（背景档案/风格谱系/模板等，见 D-022-03）。
- ComfyUI 实例管理 UI 改动（`settings:comfy:*` 保留原样）。

## 5. 验收标准（AC）

- AC-1 新壳转正：`main.tsx` 渲染链为 `ErrorBoundary → StudioApp`；全仓 grep 无 `RootSwitch`、`from './App'`、`onBackLegacy`。
- AC-2 三栏与导航：桌面宽度下三栏可见；项目列表/新建/打开经既有 IPC 生效，打开后 canvas 刷新为新项目画布。
- AC-3 产物查看：点击有 `ref.path` 的节点打开查看器，内容与磁盘文件一致；无 `ref.path` 节点给提示不报错。
- AC-4 `file:read` 安全：路径逃逸（`../`、绝对路径越界）、非 `.json/.md`、>1MB 均被拒绝并返回结构化错误。
- AC-5 旧壳清零：grep 无 `App.tsx` 旧状态机符号（`finalizeDoneTurn`/`runInternalPrompt`/`replayToWorkflow`/`annotateSuperseded` 等）；契约 §5 白名单 IPC handle 在 `main.ts`/`preload.ts`/`global.d.ts` 三处均无残留。
- AC-6 门与恢复不变：真机跑 0→2 步，门 0-a~2-b 正常发/裁/恢复；重启应用后画布与 pending 门恢复。
- AC-7 自检三件套全绿；`architecture.test.ts` 通过且覆盖新增 studio 文件。
