# feature-821 · 变更记录

## 2026-11-16 · 建包与卡口批准

- 分类：新增功能 + 结构性接口契约。
- 用户批准 P1 切片 C 实施计划，授权新增 `asset:import`、`asset:thumbnail` 两个 IPC。
- 最终方案不修改共享类型，缩略图路径由资产相对路径派生，**K1 零触发**。
- 复用已有 `sharp@0.33.5`，不新增依赖，**K9 零触发**。
- 建立标准 5 文件任务包并登记 Feature 索引；代码与验收证据待后续记录。

## 2026-11-16 · 实施与切片 C 验收闭环

- 分类：新增功能 + 结构性接口契约 + 局部持久化加固。
- 主进程新增单张 PNG/JPEG/WebP 导入与真实 WebP 缩略图服务；复用 `sharp@0.33.5`、项目资产索引和派生缩略图路径，不保存源绝对路径。
- 资产索引改为同目录临时文件、fsync、既有文件归档和 rename；坏 JSON 明确报 `ASSET_INDEX_CORRUPT`，不得按空数组覆盖。
- main / preload / `global.d.ts` / dev-mock 同步接入恰两个 IPC；renderer 完成上传状态、原显示名与路径搜索、真实缩略图、首字母降级、绑定回归和项目切换竞态防护。
- **K1/K9 零触发**；未修改 `shared/types.ts`、依赖清单或 lockfile。未新增 MCP 工具、媒体协议或通用二进制 IPC。

### 自动化与构建

| 项 | 结果 |
| --- | --- |
| 图片服务 | `src/test/asset/asset-image.test.ts` 22/22，通过真实格式、超限/坏图、符号链接/路径逃逸、幂等、故障清理及旧 ComfyUI 图片按需缩略图测试 |
| Renderer | `studio-flow.test.tsx` 29/29、`studio-theme.test.tsx` 10/10，合计 39/39 |
| dev-mock | 12/12；上传明确不可用，缩略图返回 `null`，不写假资产 |
| 静态检查与构建 | `npm run typecheck`、`npm run build`、`npm run build:electron` 均通过 |
| 全量 Vitest | 82/94 文件通过；1,203 通过、85 失败、1 跳过。失败文件集合仍为既有 12 个，未新增失败文件，不记为全绿 |

### 真实 Electron 验收

在显式隔离 `home` / `documents` / `userData` 的 macOS Electron 中，经原生文件选择器完成 PNG、JPEG、WebP 上传；取消静默，坏图显示安全中文错误。两个项目的列表相互隔离，进程重启及项目重开后索引和 WebP Data URL 均恢复，三张项目 A 图片的 DOM 均为 `complete=true`、`naturalWidth=96`、`naturalHeight=64`，无 `file://`。

跨项目上传同内容图片得到相同项目内 ID，符合既有 `path + kind` 派生契约；缩略图仅在当前活动项目索引解析，renderer 继续以 `projectId` 隔离旧响应，不因此修改 ID 或共享类型。详细证据见 [P1 调查记录 §8](../../verification/p1-2026-11-15/P1调查记录.md)。

**边界**：仅声明 P1 切片 C 的 AC-1—AC-10 闭环；切片 D/E、P1 阶段门及既有全量失败不因本包通过。未创建 Git commit。
