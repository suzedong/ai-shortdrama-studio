# feature-813 工作目录更换 · 任务清单

> 前置：K8（新增 3 条 IPC 通道 + `window.api` 新增 3 键，纯增量）经用户显式批准。未批准不执行 T1。
> K1 零触发：DTO 在 `src/global.d.ts` 镜像（feature-014 先例），不改 `shared/types.ts`。

## 0. 上下文加载清单（工作围栏）

- 事实源：[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)、[设计说明](./SDG-OD-设计说明.md)。
- 既有模式参照（只读）：
  - `electron/settings/ai-service.ts`（store 模式：内存缓存 + enqueue + archiveExisting）
  - `electron/fs/write-queue.ts`、`electron/fs/archive.ts`（复用，不改）
  - `src/studio/shell/AiServicePanel.tsx`（面板形态与 ipcErrorMessage 模式）
  - `src/global.d.ts`（DTO 镜像先例）
  - `src/dev-mock-api.ts`（mock 模式）
- 改动面白名单：
  - `electron/settings/workspace.ts`（新）
  - `electron/project/library.ts`（仅 `workspaceRoot()` 接线，预期 ≤5 行）
  - `electron/main.ts`（`ensureRuntime` cwd 接线 + 3 条 IPC handler）
  - `electron/preload.ts`（`settings.workspace` 3 键）
  - `src/global.d.ts`（2 DTO + api 键）
  - `src/studio/shell/WorkspacePanel.tsx`（新）
  - `src/studio/shell/StudioApp.tsx`（菜单项 + 面板挂载）
  - `src/dev-mock-api.ts`（`settings.workspace` 3 键）
  - 测试：`src/test/settings/workspace-store.test.ts`（新）、`src/studio/shell/workspace-panel.test.tsx`（新）、dev-mock 既有测试文件追加
  - 文档：`短剧Agent平台设计.md`、`README.md`、`docs/设计现状与偏差清单.md`、`docs/features/README.md`、B 类 HTML 现状标注、本包变更记录
- 红线：不新增依赖；不改 `project-*` 命名规则与项目内部结构；不碰 brief / canvas / gate / runtime manager 逻辑；不提交、不推送 Git。

## 1. 原子任务

### T1 · workspace store 与 changeDir 编排（`electron/settings/workspace.ts`，新）

- store：读盘容错（缺失/损坏/空值 → 默认）+ `getSettingsView` + `resolveWorkspaceRoot` + 落盘（enqueue + archiveExisting）+ 内存缓存刷新；
- `changeDir`：契约 §2.3 十步流程（校验 → 冲突预检 → 逐项搬移 + 回滚 → 提交阶段 → 返回）；
- `pickDir`：`dialog.showOpenDialog(openDirectory)` → `{ dir: string | null }`；
- 完成标准：契约 §5.1 全分支单测绿；模块零 renderer import。

### T2 · 消费方接线（2 处硬编码收敛）

- `library.ts` `workspaceRoot()` → `resolveWorkspaceRoot()`；
- `main.ts` `ensureRuntime()` 的 `workspaceRoot` → `resolveWorkspaceRoot()`（`mkdirSync` 不变）；
- 完成标准：grep `documents', 'ai-shortdrama-studio'` 仅余 workspace 模块内部与测试夹具；既有 project library / session binding 套件全绿（store 空 = 默认根，行为不变）。

### T3 · IPC ×3 + preload + global.d.ts

- `main.ts`：`settings:workspace:get` / `pick`（取 sender 所在 window）/ `change`；
- `preload.ts`：`settings.workspace.{ get, pick, change }`；
- `global.d.ts`：`WorkspaceSettingsView` / `WorkspaceChangeResult` + api 键声明；
- 完成标准：`npm run typecheck` 不新增错误（基线 3 条现存测试夹具错误不扩大）。

### T4 · dev-mock 三键（`src/dev-mock-api.ts`）

- 契约 §4 行为：get 静态视图 / pick 恒 null / change 恒 reject INVALID_ARGUMENT；
- 完成标准：dev-mock 测试（含新增三键断言）全绿。

### T5 · WorkspacePanel 与入口

- 新建 `WorkspacePanel.tsx`（设计说明 §2/§3 全形态全文案）；
- `StudioApp.tsx`：系统菜单项「工作目录」+ 面板挂载 + 确认态项目数（`listProjects().length`）；
- 完成标准：`workspace-panel` 测试全绿；`studio-flow` / `session-continue` 等既有 renderer 套件不破坏。

### T6 · 文档同步（反向同步：先 A 后 B）

- `短剧Agent平台设计.md`：§7.1 会话数据目录行补「根目录可更换（feature-813，默认 `~/Documents/ai-shortdrama-studio`）」+ 版本记录 v1.18；
- `README.md` L142、`docs/设计现状与偏差清单.md` L25 补「（可更换，feature-813）」；
- `docs/features/README.md` 新增 feature-813 行；
- B 类 HTML 现状行标注（架构模块关系图 L410、设计 HTML L635）；历史快照不改写；
- 完成标准：全仓现状口径与「根目录可更换」无冲突。

### T7 · 全量回归与收尾

- `npm run test:run` 全量；`npm run typecheck`（renderer 基线 3 不扩大）+ `tsc -p tsconfig.node.json` + `tsc -p tsconfig.preload.json` 零错误；`git diff --check`；
- 本包变更记录追加实施记录与实测数据；AC 逐项自检输出；
- 完成标准：全绿 + 自检通过，包闭环。

## 2. 产出物清单

| 类型 | 路径 |
| :-- | :-- |
| 新模块 | `electron/settings/workspace.ts` |
| 接线 | `electron/project/library.ts`、`electron/main.ts` |
| 桥接 | `electron/preload.ts`、`src/global.d.ts` |
| UI | `src/studio/shell/WorkspacePanel.tsx`、`StudioApp.tsx`（菜单项） |
| mock | `src/dev-mock-api.ts` |
| 测试 | `src/test/settings/workspace-store.test.ts`、`src/studio/shell/workspace-panel.test.tsx`、dev-mock 测试追加 |
| 文档 | 根设计 v1.18、README、偏差清单、features/README、B 类 HTML 标注、本包变更记录 |

## 3. 不做（防止越界）

- 多根目录并存 / 列表聚合多根；
- 跨磁盘卷（EXDEV）搬移（仅同盘 rename；跨盘明确报错）；
- 导入任意外部目录（只搬旧根内 `project-*`，非项目文件不动）；
- 运行时自动重连（仅提示手动重连，同 feature-014 模式）;
- 改 `project-*` 命名规则、项目内部结构、`shared/types.ts`；
- 不提交、不推送 Git。
