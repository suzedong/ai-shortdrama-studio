# SDG-RE-任务清单 · feature-001-立项

> **[反向补录]** 全部任务为已实现代码的反向拆分，状态均为「已完成 · 反向补录」。本补录基于 2026-10-03 工作区代码状态（非 git 提交，当前工作区未做版本提交）。

## 上下文加载清单

开始与本 Feature 相关工作前，逐项读取：

- [ ] [AGENTS.md](../../../AGENTS.md) — 铁律、卡口、工作围栏
- [ ] [短剧Agent平台设计.md](../../../短剧Agent平台设计.md) §2.6 — 立项阶段设计（架构真相）
- [ ] [SDG-RE-需求规格.md](./SDG-RE-需求规格.md)
- [ ] [SDG-RE-契约.md](./SDG-RE-契约.md) — **最高优先级**
- [ ] [SDG-OD-设计说明.md](./SDG-OD-设计说明.md)
- [ ] [package.json](../../../package.json) — 实际依赖版本

## 原子任务

### T1 工程骨架
- [x] **[已完成 · 反向补录]** T1-1 Vite + React + TS + Tailwind 工程配置（vite.config / tsconfig / tailwind.config）
- [x] **[已完成 · 反向补录]** T1-2 Electron 主进程窗口（1440×900，hiddenInset，预加载脚本）
- [x] **[已完成 · 反向补录]** T1-3 dev 脚本（concurrently + wait-on + cross-env VITE_DEV_SERVER_URL）

### T2 三栏框架
- [x] **[已完成 · 反向补录]** T2-1 App 布局：顶栏/三栏/底栏
- [x] **[已完成 · 反向补录]** T2-2 ProjectSidebar：硬编码项目列表 + 高亮态
- [x] **[已完成 · 反向补录]** T2-3 ChatPanel：硬编码首屏消息 + 输入框
- [x] **[已完成 · 反向补录]** T2-4 StageCanvas：节点链 + 三态样式 + 自适应缩放

### T3 火山方舟通道
- [x] **[已完成 · 反向补录]** T3-1 ark.ts：chat / maskKey / isConfigured，dotenv 加载
- [x] **[已完成 · 反向补录]** T3-2 prompts.ts：诊断 prompt + JSON 解析
- [x] **[已完成 · 反向补录]** T3-3 `agent:diagnose` IPC（真实调用 + mock 兜底）
- [x] **[已完成 · 反向补录]** T3-4 `.env` / `.env.example`（.env 不入库）

### T4 立项状态机
- [x] **[已完成 · 反向补录]** T4-1 handleIdea：诊断返回后更新三节点 + 弹 0-a
- [x] **[已完成 · 反向补录]** T4-2 deriveFiveElements 五条推导规则
- [x] **[已完成 · 反向补录]** T4-3 确认门 0-a / 0-b / 0-c 状态推进
- [x] **[已完成 · 反向补录]** T4-4 GateCard：校验列表 + 确认/否决

### T5 视觉风格推荐
- [x] **[已完成 · 反向补录]** T5-1 视觉风格 prompt + parseVisualStyle
- [x] **[已完成 · 反向补录]** T5-2 `agent:visual-style` IPC（mock 兜底）
- [x] **[已完成 · 反向补录]** T5-3 0-b 确认后异步调用并生成 0-c

### T6 持久化与背景档案
- [x] **[已完成 · 反向补录]** T6-1 `project:save` IPC：manifest.json + brief.json 落盘
- [x] **[已完成 · 反向补录]** T6-2 0-c 确认后调用保存并显示保存状态
- [x] **[已完成 · 反向补录]** T6-3 BackgroundArchive：字段模板 + 不可篡改标记 + 锁定

### T7 MCP 骨架
- [x] **[已完成 · 反向补录]** T7-1 mcp/server.ts：6 个占位工具，stdio 服务

## 验收标准（AC）

- [x] AC-1 应用可启动（`npm run dev`），三栏完整渲染
- [x] AC-2 对话区输入创意回车，经火山方舟返回真实 TopicDiagnosis（无密钥时 mock）
- [x] AC-3 诊断返回后画布三节点更新，确认门 0-a 弹出，可展开完整详情
- [x] AC-4 0-a → 0-b → 0-c 顺序推进；0-c 内容含真实视觉风格字段
- [x] AC-5 0-c 确认后两个 JSON 文件实际写入 Documents 目录，界面显示已保存
- [x] AC-6 档案录入可锁定，背景节点变 done
- [x] AC-7 `tsc -p tsconfig.node.json`、`tsc --noEmit`、`vite build` 均通过

## 遗留（后续 Feature 处理，不在本包 AC）

单元测试、对话消息动态化、项目库交互、0-d 反补门、MCP 工具真实实现——详见需求规格 §4。
