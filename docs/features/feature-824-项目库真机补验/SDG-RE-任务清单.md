> **归档状态**：已归档（D-037，2026-11-19）。本包已退出当前负责入口，仅作历史追溯。
> **当前负责包**：按本文件迁移覆盖表执行。
> **迁移覆盖**：见本包《SDG-AI-变更记录》“D-037 归档与迁移覆盖”。
> **历史边界**：以下正文为历史快照；原任务、AC、验证证据与决策记录均保留，不因归档改写其历史结论。

# SDG-RE-任务清单 — feature-824 项目库真机补验

> 对应设计说明：SDG-OD-设计说明.md  
> 对应变更记录：SDG-AI-变更记录.md  
> 基线 HEAD：`b617772f18155ac00cf9214fc2a1dd839721db79`  
> 实测结论：**矩阵执行完成，但整体不通过**。AC-F1—F9 通过；AC-F10 复现 F824-01，主进程与 Renderer 项目不一致。本切片只记录，不修复。

### T0 · 建立验收包并冻结基线
- [x] 入口核对：读取根 AGENTS、治理全文、D-015 与 feature-812 契约，明确 P1 切片 F 只验收不修复；基线 HEAD 为 `b617772f18155ac00cf9214fc2a1dd839721db79`。
- [x] 包边界：建立标准五文件包，零产品代码写权、不新增 Git 提交；冻结 AC-F1—F10、既有 IPC 白名单、隔离与停止条件。
- [x] 门禁：无共享类型、新 IPC、新依赖或新 UI 改动，K1/K8/K9 不触发。

### T1 · 定向测试与基线验证
- [x] 定向 Vitest：`project-library`、`project-nav`、`studio-shell`、`canvas-version-store`、`preload-canvas-workbench` 共 **5 文件 / 56 测试通过**。
- [x] `npm run typecheck` 与 `npm run build` 通过。
- [x] 全量 Vitest：**95 文件 = 85 通过 / 10 失败；1,272 测试 = 1,196 通过 / 75 失败 / 1 跳过**，失败均归入既有 B-70，本切片不修复。
- [x] 原始输出保存在 [p1-after-824-electron.log](../../verification/p1-2026-11-15/p1-after-824-electron.log)。

### T2 · 隔离真机环境
- [x] 隔离根为 `/tmp/ai-shortdrama-f824.1OsFCc`，使用独立 `user-data/`、`workspace/`、`home/`、`tmp/`、`npm-cache/`、`backups/`。
- [x] production Electron + Vite preview（5186）+ 动态 CDP；dev-mock 关闭；启动后以 `settings.workspace.get` 和磁盘 `workspace.json` 双重核验。
- [x] A/B/C 及 D—H 异常 fixture 均限批准名称；坏 manifest/session/canvas 在 Electron 停止时注入并冷启动复验，保留原目录备份与前后 SHA-256。

### T3 · 改名、取消与完整重启
- [x] **AC-F1 通过**：当前项目 A 行内 Enter 改为 `F824 项目 A 终验`，`.session.json.title`、`canvas.title`、列表、顶栏与立项单同步，物理目录不变；完整进程重启后保持。
- [x] **AC-F2 通过**：非当前 B 改为 `F824 项目 B 已改名`，不影响 A；C 的 Esc 前后 session SHA-256 相同，标题保持 `F824 项目 C 原始`；重启后标题正确。
- [x] 重启后核对主进程 `session-state.json.currentDir`、Renderer 可见标题与 `canvas.projectId` 一致。
- [x] 首轮标题断言超时确认为验收脚本选择器与实际 DOM 不符；诊断确认 `canvas:changed` 和可见文本均正确，不作为产品缺陷。

### T4 · 删除保护、真实废纸篓与 Finder 恢复
- [x] **AC-F3 通过**：删除可取消；当前项 UI disabled；直接 IPC 拒删并保留目录和画布。
- [x] **AC-F4 通过**：B 原目录消失并真实进入 `/Users/szd/.Trash/project-f824-b-restore`，列表移除 B；未清倒废纸篓。
- [x] **AC-F5 通过**：通过 Finder **文件 > 放回原处** 恢复 B，原路径、列表和重新打开均验证成功；未用 `mv` 冒充。
- [x] 删除确认、删除后及恢复后的截图和 Finder 菜单动作日志均已归档。

### T5 · 异常目录容错矩阵
- [x] **AC-F6 通过**：缺 manifest 项可列出；打开返回 `PROJECT_NOT_FOUND` / `项目目录已损坏或不存在`，主进程与 Renderer 均保持 A。
- [x] **AC-F7 通过**：坏 manifest 在停进程注入后的冷启动中可由 IPC 与 Renderer 列出，保留有效 session 标题并可打开；manifest 哈希不变。前次 UI 超时为运行中注入后导航未刷新，冷启动复验排除了该脚本时序问题。
- [x] **AC-F8 通过**：坏 session 列表回退为“新项目”且不改写坏文件；打开后重建合法五字段 session，主进程与 Renderer 同步。
- [x] **AC-F9 通过**：非项目目录和 `project-*` 普通文件被过滤且直接 IPC 拒开；EACCES 项以“新项目”列出，打开显示 `项目目录已损坏或不存在`，当前项目不变，验收后权限已恢复。
- [x] **AC-F10 已执行，判定 defect / F824-01**：坏 canvas 错误可见，原文件哈希不变；但 `session-state.json.currentDir` 切到 G，Renderer 仍显示 A 且无新 canvas 事件，`canvas.get` 返回 `CANVAS_CORRUPT`。已按停止条件保留现场，未回切或修复。
- [x] 最终 [p1-after-824-electron.json](../../verification/p1-2026-11-15/p1-after-824-electron.json)：`runCompleted=true`、`ok=false`；AC-F1—F9 为 pass，AC-F10 为 defect。

### T6 · 证据归档
- [x] [p1-after-824-electron.json](../../verification/p1-2026-11-15/p1-after-824-electron.json) 已包含 `environment/checks/defects/limitations/rendererExceptions/hashes`。
- [x] [p1-after-824-electron.log](../../verification/p1-2026-11-15/p1-after-824-electron.log) 保存基线、各轮 Electron 完整退出、Finder 操作、异常矩阵及 `CANVAS_CORRUPT` 原始日志。
- [x] 截图包括改名、重启、删除确认、删除后、Finder 恢复及 [p1-after-824-bad-canvas.png](../../verification/p1-2026-11-15/p1-after-824-bad-canvas.png)。坏画布截图可见错误，同时项目菜单仍选中 A、顶栏和立项单仍为 A。

### T7 · 文档闭环
- [x] 已回填 P1 调查记录、Parity 影响矩阵、任务包索引、开发计划与文档导航；总计划 v0.11 与 Parity v1.9 的 A 类文档修改已在 K7 暂停中列明旧/新口径并获用户明确批准。切片 F、P1 与完整 Parity 均保持不通过。
- [x] F824-01 已登记为未闭环偏差 B-71，保留最小复现、日志、哈希、截图与备份路径；未在本包修复。

### T8 · 最终自检
- [x] 已复核 `git status --short`、本切片 scoped diff 与 `git diff --check`；本切片只写批准文档和证据，未写产品代码、shared、IPC、preload、dev-mock、MCP、依赖或生产资源。工作树既有产品/资源脏改保持原状，未清理或覆盖。
- [x] 中间诊断截图已从证据目录移除；最终 JSON 可解析且 `runCompleted=true`、`ok=false`，AC-F10 两处错误可见性均为 true；本切片 161 条相对链接零缺失。P1 历史章节 6 个既有缺失日志链接不属于本切片，未顺手改写。
- [x] 验收 Electron/Vite/CDP 进程为零；H 已恢复 `drwxr-xr-x`；B 已放回原处且目录/画布存在；G 的独立备份、注入后哈希及 `session-state.json` 指向 G 的停止现场均保留；系统废纸篓未清空。
- [x] 未创建 commit、未 push、未发布；AC-F1—F9 通过，AC-F10 / F824-01 与既有 B-70 保持未闭环，后续修复须另行授权。
