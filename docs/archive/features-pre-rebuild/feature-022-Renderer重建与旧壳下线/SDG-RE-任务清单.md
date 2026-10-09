# SDG-RE 任务清单 · feature-022 Renderer 重建与旧壳下线

> 状态：**v1.1 已验收**
> 日期：2026-10-08
> 验收日期：2026-10-08（C9 真机验收通过，见变更记录 E-022-02）
> 依据：本包需求规格 / 契约 / 设计说明；总纲任务清单第 022 行。

---

## A. 任务总览

| # | 任务 | 交付物 | 验收点 | 状态 |
| :-- | :-- | :-- | :-- | :-- |
| C1 | 规格签字 | 本包 5 文件 v1.0 用户签字 | 变更记录登记 D-022-01~05 裁决结果 | ✓ |
| C2 | `file:read` IPC | `electron/main.ts` handle + preload + `global.d.ts` + 安全单测 | 契约 §2 六类拒绝全过 | ✓ |
| C3 | StudioViewer + 节点点击 | `src/studio/StudioViewer.tsx`（新）、`CanvasBoard.tsx` 增 `onOpenNode` | AC-3/AC-4 | ✓ |
| C4 | ProjectNav + 三栏布局 | `src/studio/ProjectNav.tsx`（新）、`StudioApp.tsx` 三栏化 | AC-2 | ✓ |
| C5 | 新壳转正 | `main.tsx` 直挂 StudioApp；删 `RootSwitch.tsx`；ErrorBoundary 去 `onBackLegacy` | AC-1 | ✓ |
| C6 | 旧壳代码删除 | 契约 §4 白名单全部文件删净（删前 grep 复核引用） | AC-5；typecheck 过 | ✓ |
| C7 | 旧 IPC 删除 | 契约 §5 白名单 handle + preload + global.d.ts 裁剪 | AC-5；build:electron 过 | ✓ |
| C8 | 测试重建 | `studio-flow.test.tsx` 扩展；`file:read` 单测；旧测试随 C6/C7 删除 | test:run 全绿；architecture.test 覆盖新文件 | ✓ |
| C9 | 真机验收 | 0→2 步全链路 + 重启恢复 pending 门 + 项目切换 | AC-2/3/6 | ✓ |
| C10 | 文档回写 | 变更记录 E 系登记；本清单勾选；规格升 v1.1 已验收 | 追溯闭环 | ✓ |

## B. 关键检查点（实施中必须满足）

1. C2 先于 C3：viewer 只能用 `file:read`，不得为 viewer 开后门（禁止 renderer 直读磁盘）。
2. C5 之前 StudioApp 必须功能齐（C2-C4 完成），避免转正后功能缺口。
3. C6/C7 严格执行白名单：每删一批先 `grep` 复核引用，确认零引用再删；白名单外一行不动。
4. `shared/types.ts`、`src/lib/chat-runtime.ts`、`src/lib/runtime-types.ts`、MCP 工具、agent profiles 全程不动。
5. 门行为不变：C4 布局改动不得触碰 `pendingGate`/`handleDecide` 逻辑。
6. 每完成一项跑 `npm run typecheck`；C6/C7 后跑全量三件套。

## C. 验收门槛

1. 自检三件套全绿：`typecheck` / `test:run` / `build:electron`。
2. 架构断言过：studio 新文件无 opencode/ark/comfyui/引擎 import、无 URL/凭证。
3. 全仓 grep 无旧壳符号与旧 IPC 字符串残留（`dist/`、`dist-electron/` 旧构建产物除外，build 后自然消失）。
4. AC-1~7 逐项过。

## D. 验收标准与 AC 映射

| AC | 验证方式 |
| :-- | :-- |
| AC-1 新壳转正 | grep + `main.tsx` 渲染链 |
| AC-2 三栏与导航 | studio-flow 测试 + 真机 |
| AC-3 产物查看 | studio-flow 测试（mock file:read）+ 真机点击节点 |
| AC-4 file:read 安全 | C2 单测六类拒绝 |
| AC-5 旧壳清零 | grep 清单（契约 §4/§5） |
| AC-6 门与恢复 | 真机 0→2 步 + 重启恢复 |
| AC-7 自检 | 三件套 |

## E. 上下文加载清单（工作围栏）

- 必读：`src/studio/*`（全部）、`src/main.tsx`、`electron/main.ts`、`electron/preload.ts`、`src/global.d.ts`、`shared/types.ts`（只读）、feature-016 OD §1–§3。
- 参考：`src/App.tsx`（仅作删除与功能核对依据，不得从中搬逻辑进新壳——新壳逻辑只许来自契约）。
- 不加载：旧 lib 实现细节（删除对象，非迁移对象）。

## F. 暂停 / 卡口

- K1：任何 `shared/types.ts` 改动冲动 → 停，回契约 §2 确认（本切片不应触发）。
- K5：发现白名单外文件引用白名单内符号 → 停，登记变更记录并请示。
- K8：`file:read` 安全边界任何放松（扩扩展名、扩目录、加上限）→ 停，重签字。
- 删除中 grep 出预期外引用（如 runtime-mock 被新链路测试引用）→ 停，先解耦再删。
