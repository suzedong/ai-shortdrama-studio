> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# SDG-RE-契约 · feature-824 项目库真机补验

> 日期：2026-11-17 ｜ 状态：TL 已审定，允许执行 ｜ 上游：[需求规格](./SDG-RE-需求规格.md)、[已批准实施计划](../../../.trae/documents/切片F-项目库真机补验实施计划.md)
> 审定方式：用户批准实施计划即审定本验收契约 v1.0；自审无第二人复核。
> 写权：仅任务包、验证证据、闭环文档及隔离 fixture；产品代码零写权。

## 1. 既有接口冻结

本包只消费既有接口，不新增或修改 IPC/MCP/DTO：

- `project:list()`、`project:create(...)`、`project:open(dir)`。
- `project:rename({ dir, title })`、`project:delete(dir)`，既有授权来自 D-015。
- `canvas.get()`、`canvas:changed`、`settings.workspace.get` 及验收所需的既有只读状态接口。
- 当前项目保护错误 `PROJECT_ACTIVE`；目录边界错误 `INVALID_PROJECT_DIR`；坏画布错误 `CANVAS_CORRUPT`。

改名只写 `.session.json.title`；删除只调用系统 `shell.trashItem`。新增应用内恢复会改变 IPC/UI 面，属于另一 Feature 且须重新过 K8。

## 2. 状态一致性契约

每个打开/异常用例至少采集：

- 真实 IPC 返回值或错误原文；
- 主进程 `currentDir` 的可证磁盘状态（`session-state.json`）；
- Renderer 当前项目标题、画布 `projectId`/标题及可见错误；
- 相关 JSON 文件前后内容或 SHA-256；
- renderer console exception 与主进程日志。

判定区别：

- 打开失败，`currentDir` 和 Renderer 均保持 A：可作为错误遏制证据。
- 打开返回成功，`currentDir` 已切到 B 而 Renderer 仍显示 A：串项目缺陷，停止整轮，不再发送写命令。
- 坏档被降级初始化：只记录实际初始化结果，不宣称恢复原数据。

## 3. 一次性 fixture 与操作授权

- 根目录、userData、HOME/Documents、workspace、临时目录和端口全部独立；启动后通过设置 IPC 与磁盘路径双重确认。
- 项目目录仅以 `project-f824-` 为前缀；备份位于 workspace 外且不以 `project-` 开头。
- 删除授权仅限指定 C fixture 的一次 UI 删除及 Finder“放回原处”。禁止 Empty Trash、`rm -rf` 项目、批量 Trash 操作或真实用户项目操作。
- 坏 manifest/session/canvas 与 EACCES 仅在 Electron 完全停止后注入；EACCES 结束后恢复权限。
- 异常用例只读探测，不做 Agent 发送、画布命令、门推进或修复性写入。

## 4. 证据契约

证据写入 `docs/verification/p1-2026-11-15/`：

- `p1-after-824-electron.json`
- `p1-after-824-electron.log`
- 当前改名、删除确认、Finder 精确恢复项、恢复后重开及缺陷现场截图。

JSON 采用以下最小形状，可按 AC 增加事实字段，不得省略状态：

```json
{
  "feature": "feature-824",
  "schema": "sdg-p1-project-library-acceptance/v1",
  "runCompleted": false,
  "ok": false,
  "environment": {
    "mode": "production Electron + Vite preview + CDP",
    "userData": "",
    "workspace": ""
  },
  "checks": {
    "AC-F1": {
      "status": "inconclusive",
      "actual": "",
      "evidence": []
    }
  },
  "defects": [],
  "limitations": [],
  "rendererExceptions": []
}
```

- `runCompleted=true` 仅表示计划矩阵已执行完毕。
- `ok=true` 仅在全部适用 AC 为 `pass`、无 defect、无未决 inconclusive 时允许。
- 截图缺失时相关视觉项不得猜通过；DOM/IPC/文件可独立证明的事实可单独记录。

## 5. 写权与停止条件

允许：本任务包、P1 证据、Feature 索引、P1 调查补记及按最终结果需要的当前状态文档。

禁止：`electron/`、产品 Renderer、`shared/types.ts`、preload、dev-mock、MCP、IPC/DTO、`package.json`、lockfile、生产资源；不新增测试依赖或产品测试来固化有争议现状。

以下情况立即停止相关操作并保存复现：

1. 隔离不能证明或路径指向真实项目。
2. 跨项目状态、非预期写入/移动、Trash/Put Back 目标不唯一。
3. 需要产品修复、共享类型、IPC/DTO、依赖或应用内恢复才能继续。
4. 全量测试出现 B-70 既有 75 项之外的新失败。
5. 证据无法区分原项目保持与新旧项目串台。
6. 降级行为是否可接受存在规格歧义，需要 L2 裁决。

轻微独立缺陷取证后，仅可用全新隔离副本继续互不影响的用例；数据安全或串项目问题终止整轮。

## 6. 卡口

| 卡口 | 结论 | 理由 |
| --- | --- | --- |
| K1 | 零触发 | 不改共享类型或共享写协议。 |
| K7 | 零触发 | 不改核心规则、项目原则或既有决策。 |
| K8 | 零触发 | 不新增/修改 IPC、MCP、preload、dev-mock 或 DTO。 |
| K9 | 零触发 | 不新增/升级依赖，不改 package/lockfile。 |

任一预判失效时暂停，重新报批后方可继续。
