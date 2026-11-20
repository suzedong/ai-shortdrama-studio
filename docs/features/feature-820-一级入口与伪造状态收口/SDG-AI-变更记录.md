# SDG-AI-变更记录 · feature-820 一级入口与伪造状态收口

## 1. 变更摘要

| 日期 | 变更 | 触发 | 结果 |
| --- | --- | --- | --- |
| 2026-11-16 | 底栏状态条真实化；Skill / 插件假交互收口；新增「本地模型」未开放入口 | P1 调查记录 §3-⑧⑨（一级入口无真实行为或未开放说明） | ✅ 已闭环（AC-1—AC-7 全过，见 §4） |

## 2. 文件变更（4 个代码文件 + 5 文件任务包）

| 文件 | 变更 |
| --- | --- |
| `src/studio/shell/StudioApp.tsx` | 底栏改为真实状态读取；新增「本地模型」资源库入口 |
| `src/studio/shell/LeftPanels.tsx` | Skill 类目真实筛选、删除死按钮；插件删除假开关；新增本地模型面板 |
| `src/studio/shell/AiServicePanel.tsx` | 新增导出 `summarizeActiveProvider()`（C7 豁免文件内收敛服务商差异） |
| `src/studio/shell/studio-flow.test.tsx` | 底栏断言更新与新增 4 例 |
| `docs/features/feature-820-…`（5 文件） | 需求规格 / 契约 / 设计说明 / 任务清单 / 变更记录；由 3 文件精简档升级为标准档（实施中触达第 4 个代码文件） |

### 实施中修正（如实登记）

初版把 `view.ark.*` 与 `provider === 'ark'` 直接写入 `StudioApp.tsx`，导致 `src/studio/architecture.test.ts` C7 断言失败（shell 非豁免文件禁止服务商字面量）。修正：将服务商差异收敛为 `AiServicePanel.tsx` 的 `summarizeActiveProvider()`，`StudioApp` 只消费返回结构；修正后 `architecture` 断言恢复通过，用户可见结果不变。

## 3. 卡口核对

| 卡口 | 结论 |
| --- | --- |
| K1 `shared/types.ts` | 零触发（无 diff） |
| K8 IPC/MCP | 零触发（只消费既有 IPC，无新增/变更） |
| K9 依赖 | 零触发（`package.json` 无 diff） |
| K7 方向性 | 不涉及（对齐 D-016「不伪造未接通状态」） |

## 4. 验证证据

| 项 | 结果 |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npx vitest run src/studio/architecture.test.ts src/studio/shell/studio-flow.test.tsx` | 29/29 通过（含 C7 架构断言） |
| `npx vitest run src/studio/shell` | 11 个测试文件全绿（既有会话 / 主题 / 标题栏 / 面板套件无回归） |
| 全量 `npx vitest run` | 81 通过 / 12 失败（93 文件）；12 个失败文件均为**既有基线**，无一本包引入：`src/test/{brief,gate,harness,mcp,style,runtime}`——谱系资源已升至 v1.47 而测试夹具仍写 v1.46（`→ 立项草案未就绪：引用谱系版本「v1.46」与注册版本「v1.47」不一致`），`runtime/agent-profiles*` 为 Windows CRLF 下 `缺少 frontmatter 围栏`。原始日志：[p1-after-820-full-vitest.log](../../verification/p1-2026-11-15/p1-after-820-full-vitest.log) |
| 受保护文件 | `shared/types.ts` / `electron/preload.ts` / `src/global.d.ts` / `package.json` 零 diff（`git status` 未列出） |
| 真实 Electron CDP | [p1-after-820-dom.json](../../verification/p1-2026-11-15/p1-after-820-dom.json)：底栏与三个事实源逐项一致，`staleInFooter=[]`、`staleInBody=[]`，Skill 筛选 / 插件 0 开关 / 本地模型入口与 AI 服务设置弹层均实测 |
| 真实对话往返 | [p1-after-820-chat.json](../../verification/p1-2026-11-15/p1-after-820-chat.json)：输入框可用、停止钮与占位气泡出现、SSE `runtime.connected / message.part ×2 / message.delta ×1 / session.idle`、新回合「收到」由 `火山方舟 · ark-code-latest` 渲染 |
| 控制台 / 主进程日志 | [p1-after-820-console.log](../../verification/p1-2026-11-15/p1-after-820-console.log)、[electron-after-820.err.log](../../verification/p1-2026-11-15/electron-after-820.err.log)：无应用级报错，仅有开发态 Vite / CSP 告警与 `[runtime] ignored opencode event` 噪声 |
| 取证限制 | 本环境窗口截图仍只得空白帧，结论以 DOM / IPC 状态原文为证，未以「看不到」替代「通过」 |

## 5. 边界与遗留

- 未新增 IPC / 类型 / 依赖；未改 `shared/types.ts`、preload、`global.d.ts`、`package.json`。
- 插件与 Skill 的真实执行通道、ComfyUI 在线探测、资产上传与真实缩略图不在本包范围，保持 P1 / P5 待办。
- 未创建 Git commit。

## D-037 接收 feature-804 窗口外壳（2026-11-19）

| 来源 | 目标章节 | 处理 |
| --- | --- | --- |
| feature-804 需求 §2/§3、AC2—AC5 | 本包需求「D-037 现行归并约束」 | 迁入平台窗口参数、控件命中区/颜色/no-drag 与验收状态 |
| feature-804 契约 §1—§3/§7 | 本包契约「D-037 现行归并约束」 | 迁入五个既有窗口通道、主进程状态权威与 preload.cjs 构建链 |
| feature-804 设计 §2/§5/§6/§7 | 本包设计「D-037 现行归并设计」 | 迁入事件流、平台适配、Snap Layouts 代价与构建链 |
| feature-804 任务、变更记录、ENV-02 证据 | 保留在 feature-804 | 不回写历史；本包仅新增文档 Change，不复制验收结论 |

- **冲突处理**：「不做深色」已被 feature-817 双主题取代；本包原「零新增 IPC / preload / global.d.ts」仅属原 Change，不能否定既有窗口 IPC。
- **开放项**：macOS AC5 零变化回归仍挂起；Windows ENV-02 仅作为历史已验收事实引用。
- **执行边界**：纯文档，未新增接口，未宣称产品能力或真机验收通过。
- **复核状态**：自审 + 无第二人复核。
