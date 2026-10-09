# SDG-RE-任务清单 · feature-002-对话消息动态化

> **版本**：v1.1（2026-10-03，v1.0 交付后缺陷修复，已实现并闭环）。

## 上下文加载清单

- [x] [AGENTS.md](../../../AGENTS.md)
- [x] [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §3.4、§7、§10
- [x] [SDG-RE-需求规格.md](./SDG-RE-需求规格.md)
- [x] [SDG-RE-契约.md](./SDG-RE-契约.md) — **最高优先级**
- [x] [SDG-OD-设计说明.md](./SDG-OD-设计说明.md)
- [x] feature-001 现状：App.tsx / ChatPanel.tsx / main.ts / preload.ts / types.ts
- [x] v1.1 增量：electron/session.ts、electron/prompts.ts、electron/main.ts、src/global.d.ts、src/lib/replay.ts

## 原子任务

### T1 测试框架落地（K9）
- [x] T1-1 安装 dev 依赖（vitest@^3.2 / @testing-library/react / jest-dom / user-event / jsdom）
- [x] T1-2 新增 vitest.config.ts + src/test/setup.ts
- [x] T1-3 package.json 增加 test / test:run 脚本

### T2 共享类型扩展（K1）
- [x] T2-1 shared/types.ts：MessageKind / MessageStatus / ChatMessage 扩展
- [x] T2-2 shared/types.ts：ProjectSession / SessionStateFile
- [x] T2-3 更新 src/global.d.ts 的 window.api 类型

### T3 纯逻辑模块
- [x] T3-1 抽出 src/lib/deriveFiveElements.ts（逻辑不变，App 改为引用）
- [x] T3-2 新增 src/lib/messages.ts 消息工厂
- [x] T3-3 新增 src/lib/replay.ts 重放函数

### T4 主进程会话与 IPC（K8）
- [x] T4-1 session-state.json 读写（userData）
- [x] T4-2 session:start / session:current
- [x] T4-3 chat:append（upsert）/ chat:load（chat.messages.json）
- [x] T4-4 project:save 改为更新当前会话
- [x] T4-5 preload 暴露新 API

### T5 对话 UI
- [x] T5-1 BriefCard / ProgressBubble / ErrorBubble 子组件
- [x] T5-2 ChatPanel 改为消息驱动渲染 + 自动滚动 + 重试回调
- [x] T5-3 删除硬编码消息

### T6 App 编排
- [x] T6-1 启动恢复流程（currentSession → loadMessages → replay → 初始化状态）
- [x] T6-2 handleIdea 消息化（start→用户消息→进度→诊断→结果/错误重试）
- [x] T6-3 确认门弹出/确认/否决追加消息；视觉风格请求进度
- [x] T6-4 0-c 保存与档案锁定消息化

### T7 测试编写
- [x] T7-1 deriveFiveElements 单测（7）
- [x] T7-2 messages 工厂单测（6）
- [x] T7-3 replayMessages 单测（5：全流程/否决/空）
- [x] T7-4 ChatPanel 组件测试（6）
- [x] T7-5 App 恢复集成测试（2：有会话重放/无会话空态）

### T8 v1.1 缺陷修复（K8：archive:save + 可选 instruction）

**缺陷 C · 落盘串行化**
- [x] T8-1 session.ts 增加单写队列（Promise 链），appendMessage 走队列；失败不中断队列
- [x] T8-2 saveToCurrent 等会话写纳入同一队列（避免与消息写交错）

**缺陷 A · 否决重做路径**
- [x] T8-3 main.ts：`agent:diagnose` / `agent:visual-style` 透传可选 instruction；prompts 追加「用户修改要求」
- [x] T8-4 新增 `archive:save` 通道 + preload saveArchive（缺陷 B）
- [x] T8-5 App 增加 redoGate 状态；handleReject：0-a/0-c 置 redoGate，0-b 直接重开门
- [x] T8-6 统一发送路由：未首交→handleIdea；redoGate 0-a→带 instruction 重诊断+重弹 0-a；redoGate 0-c→带 instruction 重生成风格+重弹 0-c
- [x] T8-7 handleArchiveSave 改为先 saveArchive 落盘，成功再锁定；失败保持录入区并提示
- [x] T8-8 replay 扩展 redoGate（0-a/0-c 否决、0-b 回置 pendingGate、新 gate 清除）；App 恢复 redoGate

**测试**
- [x] T8-9 replay 重做状态测试
- [x] T8-10 App 否决重做集成测试（含 instruction 传参、不新建会话、档案成败两路径）

## 验收标准（AC）

- [x] AC-1 输入创意后用户气泡立即上屏；硬编码消息已删除
- [x] AC-2 等待期显示进度，成功转 ✓；API 失败显示错误卡，「重试」可重新发起
- [x] AC-3 简报卡/诊断消息真实渲染；新消息自动滚底
- [x] AC-4 确认门弹出/确认/否决均产生消息；确认链路 0-a→0-b→0-c 行为与 feature-001 一致
- [x] AC-5 会话目录在首次提交时创建；0-c 保存更新该目录，重复确认不产生新目录
- [x] AC-6 chat.messages.json 实时落盘（upsert），写入失败有错误消息提示
- [x] AC-7 dev 刷新页面后，对话、节点状态、未处理确认门完整重建（App.restore 集成测试覆盖）
- [x] AC-8 应用重启后自动恢复最近会话；无会话显示初始空态不报错
- [x] AC-9 `npm run test:run` 全部通过（5 文件，27 测试）
- [x] AC-10 feature-001 七条 AC 无回归；tsc 两套配置与 vite build 通过
- [x] AC-11（v1.1 缺陷 A）否决 0-a/0-c 后输入意见，意见作为 instruction 重调对应 Agent 并重弹该门；不新建会话、不重启整套立项；0-b 否决后直接重开门
- [x] AC-12（v1.1 缺陷 B）锁定档案时全文写入 `故事背景档案.md`；成功才标记完成，失败保持录入区并提示
- [x] AC-13（v1.1 缺陷 C）连续/并发消息落盘串行，无覆盖、无丢失，顺序与调用一致
- [x] AC-14（v1.1）刷新/重启后 redoGate 恢复；`npm run test:run` 全过且既有 AC-1~10 无回归
