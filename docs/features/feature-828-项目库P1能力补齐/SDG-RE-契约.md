# feature-828 · 项目库 P1 能力补齐 — 契约

> 版本：v1.0（2026-11-18 冻结）｜对应：[需求规格](./SDG-RE-需求规格.md)

## 1. K8 IPC / DTO 差异

### 1.1 既有 `project:list`

返回数组每项新增必填 `lastOpenedAt: string`，其余字段不变；排序改为最近打开倒序，其次目录名。

### 1.2 新增 `project:detail`

请求：`{ dir: string }`。仅接受当前工作区内真实存在的项目目录。

成功：

```ts
{
  dir: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  status: string
  current: boolean
  snapshots: Array<{
    sourceProjectId: string
    sourceSessionId: string
    exportedAt: string
    messages: RuntimeSessionMessageRecord[]
  }>
}
```

无快照返回 `[]`。错误沿 IPC 返回真实 code/message，不返回伪详情。

### 1.3 新增 `project:reveal`

请求：`{ dir: string }`；成功 `{ ok: true }`。主进程完成同一项目边界及 manifest 校验后调用 `shell.showItemInFolder(dir)`；dev-mock 明确报不支持，不伪造系统定位成功。

### 1.4 新增 `project:import`

请求无参数，主进程以 `dialog.showOpenDialog({ properties:['openDirectory'] })` 选择源目录。

成功联合返回：

```ts
{ canceled: true } | { canceled: false; dir: string }
```

取消在 staging 创建前返回。导入目录必须是当前工作区内新分配目录；同名及重复 projectId 使用既有 `project-*` 唯一目录分配规则，不接受调用方指定最终目录。

### 1.5 新增 `project:export`

请求：`{ dir: string }`，仅允许当前工作区内项目。主进程以保存路径对话框选择不存在的新目录。

成功联合返回：

```ts
{ canceled: true } | { canceled: false; exportDir: string; sessionSnapshotExported: boolean }
```

`sessionSnapshotExported` 仅表示本轮当前绑定会话已实际写入快照；既有历史快照复制不计入该布尔值。

### 1.6 既有 `project:active-session` 语义扩展

请求保持既有 `{ sessionId }` 形态（当前项目目录由主进程绑定上下文取得，不传 `dir`），原返回 `{ ok:true }` 不变。非空 sessionId 绑定成功后，如果项目存在导入快照，主进程把 `{ sessionId, sourceSessionId, createdAt }` 去重追加到 `session-sources.json`；来源取最新快照。映射失败必须使 IPC 报错，不伪造来源记录成功。

preload、`src/global.d.ts`、`src/dev-mock-api.ts` 同步上述镜像；不改 `shared/types.ts`。

## 2. 静态包文件

### `project-package.json`

```ts
{ schemaVersion: 1, sourceProjectId: string, exportedAt: string }
```

原生项目无此文件时，预期 projectId 为源目录 basename；有此文件时必须与 canvas.projectId 一致。包元数据只用于预检，导入后以新目录 basename 重写 canvas.projectId。

### `.session.json`

导出包保留 title/createdAt/lastOpenedAt，但写入 `dir:''`、`activeSessionId:null`。导入始终生成新绝对 dir、当前 lastOpenedAt 和空 activeSessionId；源 dir 与原活跃 ID 均不恢复。

### `session-snapshots.json`

```ts
{
  schemaVersion: 1
  sessions: Array<{
    sourceProjectId: string
    sourceSessionId: string
    exportedAt: string
    messages: RuntimeSessionMessageRecord[]
  }>
}
```

同一 sourceSessionId 只保留一条；再导出追加当前绑定会话，已有快照原样保留。消息采用现有 runtime 只读 DTO，不声称包含 opencode 私有数据库或已裁剪的原始工具输出。

### `session-sources.json`

```ts
{
  schemaVersion: 1
  sources: Array<{ sessionId: string; sourceSessionId: string; createdAt: string }>
}
```

按 sessionId 去重；只记录来源，不作为活跃会话恢复指针。

## 3. 静态内容与路径边界

- 必须读取并校验 `manifest.json`；canvas 存在时复用现有 canvas v4 解析/结构校验。
- 复制业务文档、画布、资产及 `版本/`；排除 `资产/缩略图/`、`comfy-jobs.json`、`.git/`、`node_modules/`、`.env*`、AI/opencode 配置与密钥文件、staging 目录及 `.tmp/.part` 临时文件。
- 全树拒绝符号链接；只使用 lstat/readDir/copyFile 复制普通文件和目录，不跟随链接。
- 导入源必须在工作区外，目标必须是工作区内不存在的新目录；导出来源在工作区内，目标由用户显式选择且不得与源重叠。任何源内路径字段不得拼成目标绝对路径。
- staging 与最终目标同级，rename 是唯一目录提交点；rename 前失败尽力删除 staging，rename 后不做虚假回滚承诺。

## 4. 文件写权

- `electron/project/transfer.ts`：静态包、详情、导入导出及来源映射唯一写点。
- `electron/project/library.ts`：列表 lastOpenedAt/排序，导出内部目录分配与显式 session 写 helper；既有业务语义不变。
- `electron/main.ts`：仅注册/编排新 IPC、对话框、真实 runtime 会话快照和 Finder；不复制文件算法。
- `electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts`：K8 镜像。
- Renderer：`ProjectNav.tsx`、`WelcomeView.tsx`、`StudioApp.tsx` 及新增 `ProjectDetailPanel.tsx`。
- 测试：仅限 feature-828 新测试及为上述变化适配的既有项目库/导航测试。

## 5. 变更记录三分类

| 类别 | 本包预期 |
| :-- | :-- |
| 外部接口（需呈报） | K8：`project:list` 增 lastOpenedAt；新增 detail/reveal/import/export；active-session 增来源映射副作用；三端镜像 |
| 内部结构（无需呈报） | transfer 模块、静态包 JSON、详情面板、项目历史读取与排序 |
| 负面清单 | shared/types、MCP、package 依赖、401 生产分镜、P2/P5/P7、A 类阶段状态 |

T0：只读盘点项目库、打开预检、canvas/asset/runtime 存储、现有写队列和 F824 验收基线。
T1：冻结五文件与 K6/K8 契约后实现主进程 transfer 和三端 IPC。
T2：接入历史、搜索、详情、Finder、导入导出及只读快照 UI。
T3：完成故障/边界单测和定向回归，再跑全量 Vitest、typecheck、build。
T4：真实 Electron 执行导入/导出/重启/取消/失败及 F1—F10 回归，归档证据。
T5：回填 AC、变更记录和 feature 索引，复核 K1/K7/K9 零触发与负面清单。

## 6. 回滚预案

撤回新增 IPC 与 UI，删除 transfer 和详情组件即可回退；既有项目目录不自动降级或删除。已导入副本和快照属于用户数据，代码回滚不得擅自清除。保留 feature-827 原子写与工作树其他修改。

## D-037 现行归并约束：项目库入口与打开事务（2026-11-19）

本节接收 feature-812、824、825，只归并既有契约，不新增 IPC。

### 1. 无项目与 F1—F10 调用边界

- 无活动项目时 `activeProject/session` 必须为空或保持真实旧值，UI 只能呈现项目库/首启选择态；`project.open/create` 未完整提交前不得返回或渲染「已打开」。
- F1—F10 分别复用既有项目列表、打开、新建、关闭、重命名、复制、删除、导入、导出和保存路径。F6 必须生成新 ID；F8 预检失败不得产生可见项目，重复项目分配新目录并重写身份，不得覆盖；F9 只有真实静态目录产物完成后才算成功；F10 继续使用 D-025 四态、1 秒尾随自动保存及关闭前冲刷。
- feature-820 的 Stage 0 导航不替代无活动项目入口；feature-812 的当前负责包为本包，feature-813 不在归并范围。

### 2. openProject 提交协议

```text
assertProjectDir → manifest access
  → 单项目写队列内 beforeCommit guard
  → feature-823 Canvas assertReadable（缺失可打开，损坏/归属错误拒绝）
  → 写目标 .session.json → 提交 currentDir
  → clearLive → projectAssetsStore.reset → initProjectSettings
  → recoverActiveSession + openProject → window title → 广播
```

- guard reject 时目标 session/currentDir、保存状态、门与广播零副作用；原项目不被覆盖。正常打开的 `{ ok, activeSessionId }`、`lastOpenedAt` 与主进程广播协议不变。
- canvas 缺失允许普通新项目；只有 guard 与提交成功后才按既有路径创建。坏 JSON、非法结构、projectId mismatch 原样报错，不自动恢复覆盖。
- `INVALID_PROJECT_DIR` → `PROJECT_NOT_FOUND` → guard 原始错误及同项目队列详见 feature-827；`assertReadable` 校验与迁移详见 feature-823。
- 本契约不增加通用快照回滚、媒体探测或任意后置 I/O 保证；F10 的 1 秒尾随保存和关闭前冲刷仍按本包既有保存契约执行。

### 3. 历史验收冻结

feature-824 原始总体 **FAIL**、F10 **FAIL** 是永久历史结论；本契约不构成后续修复已通过证明。F1—F9 历史 PASS、F10 历史 FAIL 及原始证据均不得倒写。本次未新增接口，也未执行产品或真机验收。

## 5. 运行档排除与证据补验契约（2026-11-26）

- `STATIC_EXPORT_EXCLUDES` 增加精确文件名 `.agent-runs.json`；现有原子写临时文件排除规则继续覆盖其写入中副本。不得排除正式会话正文、页面/画布、版本或资产。
- 现有 IPC、DTO、manifest、导入新身份、只读快照和来源续聊接口均不变；K1/K8/K9 零触发。
- 测试夹具至少含两个非空页面、两个有向画布、版本目录、实际内容/媒体资产，以及密钥、本地设置、缓存、锁、运行账本、临时文件等逐项排除标记。
- 证据索引按「D-035 条目 → AC → 自动化/真实 Electron 原始结果」记录；历史证据只引用，不改写为本次执行结果。
