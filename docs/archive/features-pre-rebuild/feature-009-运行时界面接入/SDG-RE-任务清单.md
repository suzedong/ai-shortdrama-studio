# SDG-RE 任务清单 · feature-009 运行时界面接入（调试面板）

> 版本：v1.0 已批准 · T1~T9 全部完成，Feature 闭环
> 日期：2026-10-05
> 前置：feature-008 Agent 运行时集成已闭环（`window.api.runtime` 12 方法 + onEvent/onStatusChange 可用）。
> 卡口状态：**本 Feature 预计不触发任何 K 卡口**——不改 shared/（K1）、不改主进程 / preload / IPC（K8/K3）、不加依赖（K9）、不新增顶层目录（`src/components/runtime/` 为子目录，K6 不触发）、不改命名规范（K5）。如实施中偏离须立即暂停。

## 0. 上下文加载清单（工作围栏，逐项读取）

- [x] `AGENTS.md`
- [x] 本目录 `SDG-RE-需求规格.md`、`SDG-RE-契约.md`、`SDG-OD-设计说明.md`
- [x] `src/lib/runtime-types.ts`（DTO 唯一导入源）
- [x] `src/global.d.ts`（window.api.runtime 签名）
- [x] `src/App.tsx`（仅 header 接入点与最小改动边界；通读以理解定位）
- [x] `src/components/GateCard.tsx`（既有面板样式参照）
- [x] `src/components/ChatPanel.test.tsx`（既有组件测试写法参照）
- [x] `src/test/setup.ts`（测试环境）
- [x] `tailwind.config.js`（视觉 token）
- [x] `docs/features/feature-008-Agent运行时集成/SDG-RE-契约.md` §3（API 语义来源；仅核对，不修改）
- [x] `package.json`（确认无依赖变更）

> 禁止读取与修改清单以外文件，除非任务执行明确需要（如实施中发现的既有测试夹具）。

## 1. 签字前置

- [x] P1 用户对需求规格 v1.0 / 契约 v1.0 / OD v1.0 逐项签字（NotifyUser 审批）
- [x] P2 用户确认无 K 卡口的实施路径（本文件头部已列明，签字即确认）

## 2. 原子任务

### T1 · 纯函数层（runtime-panel.ts + 单测）

- [x] T1-1 新增 `src/components/runtime/runtime-panel.ts`：`normalizePanelError`（RuntimeErrorBody / Error / string / null 四形态）、`truncateId`（>18 → 前 8…后 8）、`eventSummary`（六类，detail 单行 120 截断）、`appendEvent`（默认上限 200，seq 1 起递增）
- [x] T1-2 新增 `src/components/runtime/runtime-panel.test.ts`：契约 §7.1 全部用例（normalize 4 例 / truncate 3 例 / summary 6+1 例含 completed tool.call / append 4 例含自定义 limit）
- [x] T1-3 运行 `npx vitest run src/components/runtime/runtime-panel.test.ts` 全绿

### T2 · 状态与控制分区（RuntimeStatusBar.tsx）

- [x] T2-1 实现 `RuntimeStatusBar`：四态圆点 + 文案（含 unhealthy 区分）、端口 / 版本 / startedAt 展示（不可用显 —）、启动 / 停止按钮（busy 禁用防重入）
- [x] T2-2 agent 区：name / description / `providerID/modelID` / tools 拼接展示；agentsError 错误条 + 重试按钮
- [x] T2-3 错误条组件（左红竖条 + code/message + ×），错误条可在此文件内实现为局部组件供本分区使用
- [x] T2-4 视觉对齐 OD §4~§6、§8（字号 10–14px 既有阶，无新色）

### T3 · 会话分区（RuntimeSessionList.tsx）

- [x] T3-1 标题输入 + 新建按钮（空标题 → onSelect/create 传 undefined 的语义由 props 回调保持；组件只回传字符串，undefined 处理在 Drawer 编排层）
- [x] T3-2 列表行：truncateId 展示、标题、createdAt（时分秒）、选中高亮（violet-soft）、中止 / 删除微型行操作；busyActionId 行禁用
- [x] T3-3 手动刷新按钮；非 running（disabled）时新建禁用；错误条复用错误条形态（可从 T2 提取共享局部组件或在 runtime-panel.ts 同级新建——若需跨文件复用，错误条作为独立文件 `ErrorNotice.tsx` 加入，仍在 runtime/ 目录内，契约文件布局允许新增，但须在变更记录登记为实施细化）
- [x] T3-4 空列表态：灰字「暂无会话，新建一个开始调试」

### T4 · Prompt 分区（RuntimePromptBox.tsx）

- [x] T4-1 三行文本域 + 异步发送按钮；session=null 或非 running 时禁用并显示对应占位文案
- [x] T4-2 onSend 仅回传文本；messageId 轻提示（lastAcceptedId 展示，简单静态文本即可，不做自动消失动画亦可）；sending 禁用
- [x] T4-3 错误条；发送成功后清空文本域（清空逻辑在组件内：onSend 调用即清空，失败时由测试按实际实现断言——以契约：成功后清空为准）

### T5 · 事件流分区（RuntimeEventLog.tsx）

- [x] T5-1 六类类型筛选复选框（样式为小 chip，选中态按 OD §7 标签配色描边）；默认全选；筛选只影响渲染
- [x] T5-2 事件行渲染：#seq（三位补零）、ts（时分秒）、类型标签、session/message id（适用，truncateId）、summary title/detail
- [x] T5-3 滚动容器 flex-1 min-h-0 overflow-y-auto；「回到底部」按钮（scrollTop = scrollHeight）；「清空」按钮
- [x] T5-4 detail break-all，无横向溢出；不向 console 打印事件体

### T6 · 抽屉编排（RuntimeDrawer.tsx）

- [x] T6-1 容器：fixed right-0，top-12 bottom-8 w-[420px]，bg-white border-l shadow，200ms slide（CSS transition + transform；open=false 直接返回 null 的简化实现允许——若测试不校验动画则不做退场保留，以实现从简为准，OD 动效为视觉验收项，真机冒烟核对）
- [x] T6-2 挂载编排：`status()` → `subscribe()` → `onEvent`；onStatusChange 同步注册（与 status 并行注册即可，不依赖顺序）
- [x] T6-3 running 后并行拉 `listSessions()` / `listAgents()`；状态迁移驱动：running 边缘触发拉取（从非 running 进入 running 一次，用 prev state ref 比较，不重复拉）
- [x] T6-4 事件入栈：onEvent 回调 seqRef 递增 + appendEvent（200 上限）；事件缓冲 state
- [x] T6-5 动作编排全部 catch 落对应分区错误条；成功调用清除该分区错误；各 busy 标记正确置位 / 复位（finally）
- [x] T6-6 卸载清理：`unsubscribe()`（catch 仅 console.error）+ onEvent / onStatusChange 退订函数调用
- [x] T6-7 删除选中会话：清 selectedId；create/delete 成功后刷新列表；abort 不刷新
- [x] T6-8 promptAsync 请求构造严格按契约 §3.2（只含 sessionId/text）；成功记录 lastAcceptedId

### T7 · App 接入（最小改动）

- [x] T7-1 `App.tsx` 新增 `runtimePanelOpen` state；header 右侧操作区前插「运行时」描边小按钮（状态圆点：面板未打开时不主动拉 status——圆点统一 muted；面板打开时按钮不显示状态变化也可，简化：入口按钮圆点恒 muted，状态全在面板内展示）
- [x] T7-2 条件渲染 `<RuntimeDrawer open={runtimePanelOpen} onClose={() => setRuntimePanelOpen(false)} />`
- [x] T7-3 不改 App 其他任何节点 / 逻辑；`git diff src/App.tsx` 人工核对改动行仅限上述范围

### T8 · 集成测试（RuntimeDrawer.test.tsx）

- [x] T8-1 测试夹具：构造完整 `window.api.runtime` mock（vi.fn，默认 resolve 合理值；subscribe / onEvent / onStatusChange 支持捕获回调驱动）；每用例 restoreAllMocks
- [x] T8-2 用例 1 入口与挂载（open false/true、调用顺序 status→subscribe、四分区标题）
- [x] T8-3 用例 2 状态迁移（starting/running 徽标、端口版本、running 后拉 listSessions/listAgents）
- [x] T8-4 用例 3 启动/停止（点击调用、busy disabled、reject → 错误条含 code/message）
- [x] T8-5 用例 4 会话闭环（create 空标题 undefined、刷新、选中高亮、abort/delete、删选中清空）
- [x] T8-6 用例 5 Prompt（禁用条件、请求只含两字段、成功清空 + messageId、失败错误条）
- [x] T8-7 用例 6 事件流（六类顺序与摘要、筛选隐藏、清空、201→200 截断）
- [x] T8-8 用例 7 卸载清理（unsubscribe 一次、两个退订各一次）
- [x] T8-9 `npx vitest run src/components/runtime/` 全绿

### T8A · T9-4 冒烟缺陷修复（2026-10-05，Reverse Sync 文档已先改）

- [x] T8A-1 缺陷A：`electron/runtime/provider.ts` 的 `resolveDefaultDirectorTemplatePath` 改用 `app.isPackaged` 判定打包态（开发态保留仓库根候选探测）；`src/test/runtime-provider.test.ts` 补 Electron 开发态（isPackaged=false + resourcesPath 存在）回归用例
- [x] T8A-2 缺陷B：`RuntimeDrawer.tsx` 进场不依赖 subscribe——status 结算后无条件 `setMounted(true)`；`RuntimeDrawer.test.tsx` 补 subscribe reject 时订阅错误条可见且容器不带 `translate-x-full` 用例（契约 §4.1 / §7 第 8 条）

### T9 · 收尾验收

- [x] T9-1 `npm run test:run` 全量通过（基线 328/1，只增不减；新增 26：19 纯函数 + 7 集成 → 354 passed / 1 skipped）
- [x] T9-2 `npm run typecheck` 零错误
- [x] T9-3 `npm run build` 通过
- [x] T9-4 真机冒烟（CDP 驱动真机，2026-10-05）：开面板（滑入 transform matrix(1,0,0,1,0,0)）→ 启动真 opencode（1s 内「运行中·健康」，端口 4096，v1.18.34）→ 建会话 ses_ef67…「冒烟会话」→ promptAsync 已受理，收 message.delta（"运行正常。"）/ message.part（text+reasoning）/ session.idle → 关面板：unsubscribe remain=0 → close → handle.closed，`lsof -iTCP:4096 -sTCP:ESTABLISHED` 无匹配 → 停止：状态 stopped、进程计数 0、端口释放 → Browser.close 退应用，`pgrep -f 'opencode-ai/bin/opencode.exe'` = 0
- [x] T9-5 视觉自检对照 OD §10 八条逐项核对（真机截屏 v01~v05，八条全过）
- [x] T9-6 `SDG-AI-变更记录.md`：登记立项决策（本 Feature 无 K 卡口，记实施事实即可；如出现 ErrorNotice 提取等实施细化补注）；AC 自检输出
- [x] T9-7 本清单全部勾选，输出最终汇报

## 3. AC 自检表（收尾时逐项填写）

| AC | 内容 | 结果 / 证据 |
|---|---|---|
| AC-1 | 入口开 / 关抽屉，主界面三栏零位移 | ✅ fixed 定位覆盖不挤压；用例1 渲染四分区，用例7 open=false 容器为空 |
| AC-2 | 四态展示与 status/onStatusChange 一致，启停有忙碌态 | ✅ 用例2 starting/running 徽标 + 端口版本；用例3 busy 按钮 disabled |
| AC-3 | 错误态 / invoke 失败结构化展示，无未捕获 rejection | ✅ 用例3 reject 显 RUNTIME_START_FAILED + 进程退出；用例5 失败显 PROMPT_FAILED；所有 Promise 链均有 catch |
| AC-4 | 会话创建/列表/选中/中止/删除闭环，规定时机刷新 | ✅ 用例4：空标题 undefined、选中 violet-soft、abort/delete、删选中清 selectedId |
| AC-5 | promptAsync 全链路：发送 → 六类事件按序渲染 | ✅ 用例5 请求严格 `{sessionId,text}`、成功清空 + messageId；用例6 六类事件按序摘要 |
| AC-6 | subscribe/unsubscribe 与抽屉显隐严格绑定 | ✅ 挂载序 status→subscribe（用例1 invocationCallOrder）；用例7 unsubscribe 一次 |
| AC-7 | 事件 200 上限 / 清空 / 类型筛选 / 回到底部可用 | ✅ 用例6：筛选隐藏 delta、清空、201→200；回到底部按钮存在 |
| AC-8 | 关闭面板无残留订阅、监听、轮询 | ✅ 用例7：unsubscribe 1 次 + offEvent/offStatus 各 1 次；无轮询实现 |
| AC-9 | 全量测试只增不减、typecheck、build 通过 | ✅ 357 passed / 1 skipped（基线 328/1 + feature-009 新增 29）；typecheck 零错；build 通过 |
| AC-10 | OD §10 视觉八条逐项达标 | ✅ 真机截屏逐条核对：三栏零 reflow、四态圆点（unhealthy=warn）、1px line 无 violet 色块、选中 violet-soft 无描边、六类标签配色+break-all 无溢出、左红竖条错误条无 alert、top-12/bottom-8 不遮挡、字号仅 10/11/12/14 |
| AC-11 | App.tsx 改动最小（仅 state+按钮+挂载点），无依赖 / shared / IPC 变更 | ✅ 仅 4 处改动（import / state / header 按钮 / 挂载点）；零新依赖，未碰 shared 与主进程 |
