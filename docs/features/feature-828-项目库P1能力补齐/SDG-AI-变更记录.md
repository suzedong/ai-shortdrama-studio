# feature-828 · 项目库 P1 能力补齐 — 变更记录

> 版本：v1.0（2026-11-18 建包，2026-11-19 闭环）｜状态：✅ 已闭环

## 1. 授权与范围

用户要求继续完成 P1 未闭环项。本包承接 feature-824/825 的项目库与打开预检、feature-827 的单文件原子写，实施 P1 历史、搜索/详情/定位、静态目录导入导出及 D-035 正式会话只读快照。

K6/K8 已按推荐方案呈报：新增 `electron/project/transfer.ts`、`ProjectDetailPanel.tsx`；`project:list` 增 `lastOpenedAt`，新增 `project:detail/reveal/import/export`，`project:active-session` 增来源映射副作用，并同步 preload/global/dev-mock。K1/K9 零触发；K7 留待 P1 总验收。

## 2. 实际变更

- 主进程：新增 `electron/project/transfer.ts`，实现详情读取、静态包预检与普通文件复制、staging→rename、会话快照及来源映射；`electron/project/library.ts` 增加最近打开时间与排序及内部 helper；`electron/main.ts` 接入原生目录对话框、Finder 和真实 runtime 消息读取。
- 契约镜像：`electron/preload.ts`、`src/global.d.ts`、`src/dev-mock-api.ts` 同步四个新增 IPC、列表字段和来源绑定语义；dev-mock 对 Finder 明确报不支持。
- Renderer：新增 `src/studio/shell/ProjectDetailPanel.tsx`；`ProjectNav.tsx`、`WelcomeView.tsx`、`StudioApp.tsx` 接入最近使用、详情、定位、导入导出和只读快照回放。
- 测试：新增 `src/test/project/project-transfer.test.ts`、`src/test/project/project-transfer-ui.test.tsx`，覆盖静态包、路径/身份边界、故障回滚、历史排序、详情与快照只读。
- `shared/types.ts`、`package.json`、lockfile 与 MCP 工具均无本包差异；feature-827 的原子写及其测试不计入本包变更。

## 3. 验证与证据

### 自动化

- 定向回归：6 个测试文件、74 项通过。
- 全量 Vitest：99 个文件，1296 passed、1 skipped、0 failed。
- `npx tsc -b --force --pretty false` 通过；`npm run build` 通过，仅既有 chunk size warning。

### 真实 Electron

环境为 production build + Vite preview + Electron CDP + macOS 原生对话框。本地 OpenAI 兼容服务只提供可重复模型端，opencode、MCP、IPC 与消息持久化均走真实产品路径。

- AC-828-1：最近使用、详情与 Finder 定位通过；既有搜索及 F1—F10 项目库行为无回归。
- AC-828-2：真实会话导出、取消零写盘、再次导出保留历史并追加当前会话通过。
- AC-828-3：导入、取消、损坏包回滚、重复导入目录隔离通过，无可见污染或 staging 残留。
- AC-828-4：真实 opencode 会话、只读回放、首次续聊新 sessionId 与来源映射、完整重启恢复通过。
- AC-828-5：自动化与真实 Electron 证据齐备；核心检查全部 PASS，Renderer 异常与 console error 均为空。

证据：

- [核心结构化证据](../../verification/p1-2026-11-15/p1-after-828-electron.json)及[最终日志](../../verification/p1-2026-11-15/p1-after-828-electron.log)。
- [只读会话快照截图](../../verification/p1-2026-11-15/p1-after-828-session-snapshot.png)。
- [feature-824 F1—F10 新回归证据](../../verification/p1-2026-11-15/p1-after-828-f824-electron.json)及[最终日志](../../verification/p1-2026-11-15/p1-after-828-f824-electron.log)：F1—F10 全部 pass，`runCompleted=true`、`ok=true`，`defects=[]`、`rendererExceptions=[]`。
- [坏画布保持原项目截图](../../verification/p1-2026-11-15/p1-after-828-f824-bad-canvas.png)。

## 4. 边界与回滚

不复制 opencode 私有数据库，不恢复运行作业，不新增 ZIP、共享类型或依赖，不宣称跨文件事务、跨进程锁、目录 fsync 或断电级目录原子性。代码回滚不得删除已导入用户项目或快照。

本包 K1/K7/K9 均未触发；K7 的 P1 阶段状态呈报及 A 类文档收口留待 feature-834。本包闭环不代表 P1 全阶段或完整 Parity 已通过。未提交、未推送、未发布。

## D-037 接收 feature-812 / 824 / 825（2026-11-19）

| 来源 | 目标章节 | 处理 |
| --- | --- | --- |
| feature-812 需求 §1—§5、契约 §1/§3、设计 §1/§2 | 本包三份文档的「D-037 现行归并」无项目入口 | 迁入无活动项目、最近项目失效和成功提交后进入工作区 |
| feature-824 需求 §2/§3、契约 §1—§3、设计 §1—§4 | 本包三份文档的 F1—F10 | 迁入十项项目库能力；历史 PASS/FAIL 证据留原包 |
| feature-825 需求 §2—§4、契约 §1/§2 成功路径、设计 §1/§3 | 本包三份文档的打开提交事务 | 迁入 Canvas guard、session/currentDir 提交点、提交后恢复/广播及失败零副作用 |
| feature-825 guard/session、同项目队列、错误优先级 | feature-827「D-037 现行归并约束」 | 本包仅引用，不重复承接 |
| feature-825 Canvas 只读预检 | feature-823 需求 §9、契约 §9、设计 §9、任务 T9 | 已迁入；本包不重复承接预检契约 |

- **冲突处理**：feature-812 归本包而非 feature-820；feature-820 的 Stage 0 仅限已打开项目内部导航。feature-825 只保证真实预检—提交顺序，不扩为通用快照回滚、媒体探测或任意后置 I/O 保证。
- **历史冻结**：feature-824 原始总体 FAIL、F10 FAIL 永久保留；F1—F9 历史 PASS 不改写，后续修复不得倒写。本包既有后续证据仍是独立记录，本次归并不新增或改写验收结论。
- **执行边界**：纯文档，未新增接口，未运行产品测试，未宣称新增能力或真机验收通过；不扩展跨文件事务、目录 `fsync`、断电保证。
- **复核状态**：自审 + 无第二人复核。
