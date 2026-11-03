# feature-813 工作目录更换 · 契约

> 最高优先级。实现必须严格匹配本契约，不偏离、不脑补（铁律 2）。
> 关联：[需求规格](./SDG-RE-需求规格.md)、[设计说明](./SDG-OD-设计说明.md)、[任务清单](./SDG-RE-任务清单.md)。

## 1. 设置 store（electron/settings/workspace.ts，新模块）

### 1.1 落盘形态（`<userData>/workspace.json`）

```json
{ "version": 1, "rootDir": "<绝对路径>", "updatedAt": "<ISO 字符串>" }
```

- `rootDir` 可选键：缺失 / 空串 / 非字符串 → 视为未配置；
- 文件缺失 / JSON 损坏 → 整体回退默认根，不抛错；
- 写路径与 feature-014 一致：`enqueue` 写队列串行 + `archiveExisting` 覆盖前归档。

### 1.2 生效根解析

```
resolveWorkspaceRoot(): string
  = store.rootDir（非空字符串、trim 后非空、绝对路径）
  ?? defaultRoot
defaultRoot = path.join(app.getPath('documents'), 'ai-shortdrama-studio')
source 标记 = rootDir 有效 ? 'store' : 'default'
```

### 1.3 消费方接线（全仓仅这两处硬编码，改完后 grep 审计）

| 消费方 | 现状 | 改后 |
| :-- | :-- | :-- |
| [library.ts](../../../electron/project/library.ts) `workspaceRoot()` | `path.join(app.getPath('documents'), 'ai-shortdrama-studio')` | `resolveWorkspaceRoot()`（`listProjects` / `createProject` / `assertProjectDir` 自动继承） |
| [main.ts](../../../electron/main.ts) `ensureRuntime()` | 同路径常量 + `mkdirSync` | `resolveWorkspaceRoot()`（`mkdirSync` 逻辑不变） |

接线后 `documents', 'ai-shortdrama-studio'` 字面量仅允许出现在 workspace 模块内部与测试夹具。

## 2. 主进程 API（workspace 模块导出）

### 2.1 `getSettingsView(): WorkspaceSettingsView`（同步，内存缓存）

```ts
interface WorkspaceSettingsView {
  root: string        // 当前生效根（绝对路径）
  defaultRoot: string // 默认根（实际展开路径）
  source: 'store' | 'default'
  updatedAt?: string  // source=default 时缺席
}
```

### 2.2 `pickDir(window: BrowserWindow): Promise<{ dir: string | null }>`

- 主进程 `dialog.showOpenDialog(window, { properties: ['openDirectory'] })`；
- 用户取消 → `{ dir: null }`；取消不是错误；
- 返回的 `dir` 是选择器给出的绝对路径（未做业务校验，校验在 `changeDir`）。

### 2.3 `changeDir(dir: string): Promise<WorkspaceChangeResult>`

```ts
interface WorkspaceChangeResult {
  ok: true
  root: string        // 新根
  moved: string[]     // 本次搬移的项目目录名（project-*）
  movedCount: number
}
```

**流程**（整体 `enqueue` 串行；步骤 1–7 全部零写盘）：

1. 参数校验：`dir` 为非空字符串、`path.isAbsolute` → 否则 `INVALID_ARGUMENT`（message 指明缺参 / 相对路径）；
2. `R0 = resolveWorkspaceRoot()`（当前生效根）；`R1 = path.resolve(dir)`；
3. `R1 === R0` → `INVALID_ARGUMENT`「与当前根目录相同，无需更换」；
4. `R1` 位于 `R0` 之内（`R0` 是 `R1` 的祖先）→ `INVALID_ARGUMENT`「新根目录不能位于当前根目录内」；
5. `R1` 存在且为目录 → 否则 `WORKSPACE_NOT_FOUND`「目标目录不存在或不是目录」；
6. 扫描 `R0` 直接子级中 `project-*` 目录（过滤条件与 `listProjects` 一致）；`R0` 不存在 / 不可读按 0 项处理；
7. 冲突预检：任一 `R1/<项目名>` 已存在（文件或目录）→ `WORKSPACE_TARGET_EXISTS`（message 含冲突名清单），整体中止、零写盘；
8. 逐项 `fsp.rename(R0/p → R1/p)`；任一项失败：
   1. 回滚：已搬移项按原顺序 `fsp.rename` 回 `R0`（best effort，失败收进 `rollbackErrors`）；
   2. 抛 `WORKSPACE_MOVE_FAILED`，message 含失败项名与原始错误；原始错误 code 为 `EXDEV` 时 message 固定为「不支持跨磁盘搬移，请选择与当前根目录同磁盘的目标目录」；
   3. 回滚失败时错误对象附带 `rollbackErrors: unknown[]` 字段；
9. 提交阶段（顺序固定，先 session-state 后 store，保证失败可重试修复）：
   1. session-state 重映射：`readSessionState().currentDir` 父目录 === `R0` → 改写为 `R1/<同名>`；否则不动。写失败 → `WORKSPACE_PERSIST_FAILED`；
   2. `workspace.json` 落盘（`rootDir=R1`、`updatedAt=当前时间`）+ 刷新内存缓存。失败 → `WORKSPACE_PERSIST_FAILED`，message 注明「项目已移至新目录，重新执行同一次更换即可修复设置」；
10. 返回成功结果（`moved` 为搬移的项目目录名数组）。

### 2.4 错误码汇总

| 错误码 | 语义 | 磁盘状态 |
| :-- | :-- | :-- |
| `INVALID_ARGUMENT` | 参数非法 / 与当前根相同 / 新根在旧根内 | 零写盘 |
| `WORKSPACE_NOT_FOUND` | 目标目录不存在或不是目录 | 零写盘 |
| `WORKSPACE_TARGET_EXISTS` | 目标根已存在同名项目 | 零写盘 |
| `WORKSPACE_MOVE_FAILED` | 搬移中途失败 | 已搬项已回滚（回滚失败经 `rollbackErrors` 上报） |
| `WORKSPACE_PERSIST_FAILED` | 提交阶段写失败 | 项目已在新根；重新执行同一次更换可修复 |

## 3. IPC 通道（新增 3 条，纯增量；K8）

| 通道 | 载荷 | 返回 |
| :-- | :-- | :-- |
| `settings:workspace:get` | 无 | `WorkspaceSettingsView` |
| `settings:workspace:pick` | 无 | `{ dir: string \| null }` |
| `settings:workspace:change` | `{ dir: string }` | `WorkspaceChangeResult` |

- 错误信封与全仓一致：`Error.code` + 中文 message；面板剥 `Error invoking remote method …` 壳后原样上屏（复用 `AiServicePanel` 的 `ipcErrorMessage` 模式）；
- [preload.ts](../../../electron/preload.ts)：`settings.workspace.{ get, pick, change }`，与 `settings.ai` 同层；
- [global.d.ts](../../../src/global.d.ts)：声明 `WorkspaceSettingsView` / `WorkspaceChangeResult` 两 DTO 与 api 键——**镜像主进程、不进 shared/types.ts**（K1 零触发，同 feature-014 先例）。

## 4. dev-mock（src/dev-mock-api.ts）

`settings.workspace` 三键（浏览器无真实文件系统与原生选择器）：

| 键 | 行为 |
| :-- | :-- |
| `get` | resolve `{ root: '/demo/workspace', defaultRoot: '/demo/workspace', source: 'default' }` |
| `pick` | resolve `{ dir: null }`（一律视为取消） |
| `change` | reject `{ code: 'INVALID_ARGUMENT', message: '浏览器开发环境不支持更换工作目录' }` |

不改动 mock 现有 projects / briefs 等行为。

## 5. 测试（必须，测试未过视为任务未完成）

1. **workspace store 与 changeDir 单测**（新文件 `src/test/settings/workspace-store.test.ts`），覆盖：
   - store 读：文件缺失 / 损坏 / 空 `rootDir` → 默认根 + `source=default`；有效 `rootDir` → `source=store` 且 root 正确；
   - `changeDir` 校验分支：相对路径 / 与当前根相同 / 新根在旧根内 / 目标目录不存在 → 对应错误码且零写盘（旧根内容逐文件不变）；
   - 正常搬移：2 个 `project-*` 目录 + 1 个非项目文件（不动）+ 当前项目 session-state 重映射后指向新根；
   - 冲突预检：目标根已存在同名项目目录 → `WORKSPACE_TARGET_EXISTS`，旧根原样；
   - 搬移失败回滚：第 2 项 rename 注入失败 → 第 1 项回滚、旧根恢复原状、错误码正确；
   - EXDEV 注入 → message 固定文案；
   - 提交阶段：session-state 写失败 / store 写失败 → `WORKSPACE_PERSIST_FAILED`；
   - 空旧根（0 项目）→ 正常更换、`movedCount=0`；
   - 换回旧根（二次 changeDir）→ 项目迁回、列表恢复。
2. **面板测试**（新文件 `src/studio/shell/workspace-panel.test.tsx`）：当前根与来源展示；pick 取消无动作；选目录后确认区含项目数提示；成功后显示新根与移动数；错误时 message 原样上屏且面板保持打开。
3. **dev-mock 测试**：三键行为断言（追加既有 dev-mock 测试文件，沿用模块状态隔离模式）。
4. **回归**：既有 project library / session binding / brief / canvas 等主进程套件全绿（store 为空时生效根 = 默认根，行为逐字节不变）。

## 6. 文档同步（反向同步，先改 A 再改 B）

| 文档 | 动作 |
| :-- | :-- |
| [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) | §7.1 会话数据目录行补「根目录可更换（feature-813，默认 `~/Documents/ai-shortdrama-studio`）」；版本记录追加 v1.18 |
| [README.md](../../../README.md) | L142「默认」表述补「（可更换，feature-813）」 |
| [docs/设计现状与偏差清单.md](../../../docs/设计现状与偏差清单.md) | L25 持久化条目同步 |
| [docs/features/README.md](../../../docs/features/README.md) | 新增 feature-813 行 |
| B 类 HTML（架构模块关系图 L410、设计 HTML L635） | 现状行加「（默认，可更换）」标注；历史快照不改写 |
| 本包 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md) | 追加实施记录与实测数据 |
