# feature-829 · 创作页历史与跨页正式引用 — 变更记录

> 版本：v1.0（2026-11-19 建包，2026-11-25 闭环）｜状态：✅ 已闭环

## 1. 授权与事实源裁决

用户已批准按 feature-826—834 顺序连续完成 P1 收口，当前明确进入 829。Feature 索引和 D-036 附录中“页历史/跨页引用后置”的旧阶段表述不作为取消当前授权的依据；本包完成后回填索引，D-036 决策本体不改写。

只读核查确认：“页历史”指浏览器式前进/后退，不是产物文件版本历史；“跨页正式引用”必须包含产物 ID＋版本，源再版只挂脏实际引用者。通用历史、版本恢复、Diff Review 和撤销重做不在本包。

## 2. 卡口呈报

- **K1 触发**：`shared/types.ts` 新增 `CanvasArtifactReference`，`CanvasNode` 仅增可选 `reference` 字段；不改既有导出签名和运行时字段语义。
- **K8 触发**：既有 `CanvasPageCanvasCommand` 增 `reference.create`，复用 `canvas:command`、revision/receipt 与错误结构；不新增 IPC 通道或 MCP 工具。
- **K6/K9 零触发**：实现收敛于现有 store、CanvasBoard 和 dev-mock，不新增模块/目录/依赖。
- **K7 留待 834**：本包不改 P1 阶段状态。

上述精确方案已在主会话呈报，按用户要求的连续收口授权继续，未重复弹窗，也不虚构新的批准原话。单人项目自审，无第二人复核。

## 3. 实施与验证

### 2026-11-25 · T2 数据与命令底座闭环

- 基线核查确认当前 `65412b1` 已包含 T2 产品实现与 `src/test/canvas/canvas-references.test.ts`；本轮按冻结契约逐项核验，未重复改写或覆盖既有产品实现。
- `shared/types.ts` 已有 `CanvasArtifactReference`、`CanvasNode.reference` 和 `reference.create` 命令联合；沿用既有 `canvas:command`、revision/receipt 与 preload/global 函数签名。
- `electron/canvas/store.ts` 已覆盖跨页来源与目标校验、源字段复制、单 revision、幂等重放、冲突及失败零部分写入；`canvas.update` 仅按固定 source target + artifactId 维护实际引用者的 latestVersion/markedAt，merge 剥离伪造 reference 并保留旧引用。
- `src/dev-mock-api.ts` 已对齐创建校验、引用状态保护与 brief 再版扫描；未新增 IPC 通道、MCP 工具、模块、目录或依赖。
- 验证：`npx vitest run src/test/canvas/canvas-references.test.ts` 为 1 文件 / 7 项通过；`npx vitest run src/test/canvas src/test/mcp` 为 14 文件 / 120 项通过。
- `npm run typecheck` 仍因既有 `src/test/setup-tmpdir.test.ts(20,35) TS2345` 退出 2；输出未报告 T2 文件错误，本轮不静默修复，留待 T4 统一验证。
- 本轮未实施 T3 UI、未执行 T4 真实 Electron 验收，不宣称 feature-829 或 P1 闭环；未创建 Git commit。

### 2026-11-25 · T3 导航与正式引用交互闭环

- 基线核验确认当前 `e787d8c` 已包含 T3 主体实现：内存 `CanvasTarget` 历史栈仅在成功导航后记录，后退/前进复用 `active.set`、失败不提交索引、跳过失效目标且组件完整重建后重置；复制仅形成内存 draft，跨页粘贴复用 `reference.create`，固定引用版本与 `latestVersion` 独立呈现引用黄条和脏徽标，源定位复用目标切换与 `onOpenNode`。
- 本轮未重复改写既有主体实现；补齐源定位项目边界校验，`reference.source.projectId` 与当前项目不一致时直接报错，不再把其他项目引用误定位到本项目同 ID 页/画布/节点。
- `src/studio/canvas/canvas-board.test.tsx` 新增粘贴失败后保留 draft 并显示真实错误、成功粘贴后清除 draft，以及源节点缺失、源版本缺失、来源项目不匹配时不导航且不打开查看器的自动化断言；既有历史、脏态、成功粘贴和源定位用例继续通过。
- 新增跨项目源定位用例先复现 1 项失败，最小校验修复后 `npx vitest run src/studio/canvas/canvas-board.test.tsx` 为 1 文件 / 44 项通过。
- 必要回归 `npx vitest run src/studio/canvas src/test/canvas src/test/mcp` 为 20 文件 / 207 项通过；未新增 IPC 通道、MCP 工具、模块、目录或依赖。
- 本轮仅完成 T3，不提前执行 T4 全量 Vitest、typecheck、build 或真实 Electron 验收；既有 typecheck 失败仍按 T2 记录留待 T4，不宣称 feature-829 或 P1 闭环，未创建 Git commit。

### 2026-11-25 · T4 全量检查与真实 Electron 验收闭环

- `src/test/setup-tmpdir.test.ts` 对测试必有的 `TMPDIR` 使用非空断言，消除既有 `TS2345`，运行时行为不变；`src/test/docs-context.test.ts` 改为断言真实包上下文的现行语义，不再写死 T2—T5 完成状态。
- 全量 Vitest 为 104 文件、1339 passed / 1 skipped（共 1340）；`npm run typecheck` 通过；`npm run build` 的 renderer、Electron 主进程与 preload 均构建成功。
- 真实 Electron 33.4.11、真实 preload/IPC、真实主进程与真实 MCP `canvas.update` 全流程通过；使用隔离 userData 和本机真实工作区新建 `project-20261125-151049-m9wk`，未删除或改写既有项目。
- A→B→A、后退 B、前进 A 均通过，前进到末端后按钮禁用，导航前后 Canvas revision 均为 1；跨页复制不改 revision，真实 `canvas:command / reference.create` 粘贴后为 2，引用固定 v1、源完整指向 A 页。
- 真实 MCP 再版后源为 v2，引用仍固定 v1、`latestVersion=v2`，仅实际引用者显示脏徽标和黄色提示条。完整关闭并重启后主进程 PID 13431→13532，活动项目/A 页/A 画布恢复，固定/最新版与 `markedAt` 不变，内存历史按规格重置且后退/前进均禁用。
- “打开源产物”后源节点、查看器、标题与真实 `manifest.json` 路径均可见；重启前后两轮 CDP 诊断均覆盖，`Runtime.exceptionThrown`、`console.error`、renderer Log error 均为 0。
- 证据已刷新：docs/verification/p1-2026-11-15/p1-after-829-electron.json，及同目录 p1-after-829-electron.log、p1-after-829-electron-first.log、p1-after-829-electron-restart.log、p1-after-829-reference.png、p1-after-829-reference-dirty.png、p1-after-829-open-source.png。
- 两轮主进程原始日志仍记录既有 `STYLE_CATALOG_MISSING`（Electron Resources 下 H3 Style 资源路径）及 DevTools 自身协议日志；本包未修改该域，不伪称这些日志不存在。
- 本阶段未修改产品接口或业务实现，未新增模块、依赖或 Git 提交；仅勾选 T4，T5 未执行，不宣称 feature-829 或 P1 闭环。

## 4. T5 闭环收口（2026-11-25）

- 五文件最终复核：需求规格、契约和设计说明维持 v1.0 冻结语义，无需因实施结果反改规范；任务清单与本记录回填实际状态，Feature 索引只更新当前负责包状态，不复制测试计数或验收日志。
- AC-829-1 / AC-829-4 由组件回归和真实 Electron 的 A→B→A、后退/前进、历史末端禁用、重启空栈及源定位结果共同覆盖；源定位额外校验来源项目，失败不伪造导航或查看器。
- AC-829-2 / AC-829-3 由 store/MCP 回归及真实 `canvas:command / reference.create`、`canvas.update` 结果覆盖：独立引用节点、完整 source target、固定版本、单 revision、精确 latestVersion/markedAt 和引用状态保护均已核验。
- AC-829-5 的定向测试、全量 Vitest、typecheck、build 与真实 Electron 结果见 T4；最终结构化证据为 [p1-after-829-electron.json](../../verification/p1-2026-11-15/p1-after-829-electron.json)，原始日志为 [流程日志](../../verification/p1-2026-11-15/p1-after-829-electron.log)、[首轮主进程](../../verification/p1-2026-11-15/p1-after-829-electron-first.log) 和 [重启主进程](../../verification/p1-2026-11-15/p1-after-829-electron-restart.log)。
- 截图证据：[跨页正式引用](../../verification/p1-2026-11-15/p1-after-829-reference.png)、[源再版精确挂脏](../../verification/p1-2026-11-15/p1-after-829-reference-dirty.png)、[打开源产物](../../verification/p1-2026-11-15/p1-after-829-open-source.png)。
- T5 收口验证：`npm run check:docs` 通过；`npx vitest run src/test/docs-context.test.ts` 为 1 文件 / 8 项通过；`git diff --check` 与全部证据文件存在性检查通过。
- K1/K8 沿用已呈报方案；K6/K9 零触发，未新增业务模块或依赖。K7 留待 feature-834，本包不修改 `AGENTS.md`、治理规则、P1 阶段状态或版本记录。
- T5 仅修改文档；禁止路径复核覆盖 `package.json` / lockfile、治理文档、P1 总计划和生成通道，均未变更。未提交、未推送、未发布。
- feature-829 至此闭环；不代表 P1 全阶段、通用历史、通用版本恢复或完整 Parity 已通过。
