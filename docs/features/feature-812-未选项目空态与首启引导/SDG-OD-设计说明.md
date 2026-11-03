# feature-812 未选项目空态与首启引导 · 设计说明

> 本包有 UI 变化，故设此文件。所有样式沿用现有设计 token（`text-ink` / `text-muted` / `border-line` / `bg-violet` / `bg-violet-soft` / `rounded-[14px]`），不引入新色板、新字体、新阴影语汇。

## 1. 设计意图

无项目态是**入口**，不是"空掉的工作台"。当前界面把 5 个区域各自的"没有数据"暴露给用户，且文案指向一条走不通的路（去对话）。本包把它收敛成**一个可执行的首屏**：

> 你还没有开始任何一部短剧 —— 两条路：新建，或打开已有的。

参考 MiniMax Design 的"项目即入口"心智（feature-808 已对齐"项目即会话入口"），本页是同一心智的**上游一环**：先有项目，才有会话。

## 2. 版面规格

### 2.1 容器

| 项 | 值 |
|---|---|
| 挂载 | 中栏 `main` 内，占满（`h-full w-full`） |
| 底色 | 沿用 `bg-canvas`（父层已有） |
| 内容 | 垂直居中，`max-w-[560px]`，`px-[26px] py-[26px]` |
| 卡片 | `rounded-[14px] border border-line bg-white p-7 shadow-[0_10px_30px_rgba(40,42,80,0.06)]`（与 `Stage0View` empty 卡同款） |
| 标识 | `data-view="welcome"`（测试锚点） |

### 2.2 元素与字号

| # | 元素 | 规格 |
|---|---|---|
| 1 | 图标 | `h-12 w-12 rounded-2xl bg-violet-soft` + 居中 `0` 字（复用 STAGE 0 的序号语汇，暗示"从这里开始第 0 步"） |
| 2 | 标题 | `text-[15px] font-extrabold text-ink`：`开始一部短剧` |
| 3 | 说明 | `text-[11.5px] leading-[1.8] text-muted`，两行内：一句话说清题材 → 主控 Agent 带编剧 / 美术 / 镜头依次产出，直到成片 |
| 4 | 主 CTA | 全宽 `bg-[#1E2233]`（与左栏「＋ 新建项目」同款），`py-2`，`text-[12.5px] font-semibold text-white`，文案 `＋ 新建项目` |
| 5 | 分隔 | `text-[10.5px] text-[#9AA0B5]` 居中：`或打开已有项目`，左右各一条 `border-line` 细线 |
| 6 | 列表项 | 高 `44px`，`rounded-[10px] border border-transparent hover:bg-[#F5F6FB]`；首字块 `h-8 w-8 rounded-lg` + 名称 `text-[12px] font-bold` + 时间 `text-[10px] text-[#9AA0B5]` |
| 7 | 空库态 | `text-[11px] leading-5 text-muted`：`还没有项目，点上方「新建项目」开始。` |
| 8 | 错误条 | `rounded-lg border border-bad/40 bg-bad/10 px-2 py-1.5 text-[11px] text-bad`（与 `ProjectNav` 同款） |
| 9 | 底部提示 | `text-[10px] text-[#9AA0B5]`：`0 立项 → 1 故事 → 2 分场 → 3 资产 → 4 分镜 → 5 镜头 → 6 后期 → 7 发布` |

### 2.3 交互态

| 态 | 表现 |
|---|---|
| 默认 | 主 CTA 深色实底；列表项无边框，hover 浅灰底 |
| `busy`（创建/打开中） | 相关按钮 `disabled` + `opacity-50` + 文案切「创建中…」/「打开中…」；列表项整体 `pointer-events-none` |
| 错误 | 卡片顶部插入错误条，**不**关闭本页、**不**重置已填内容 |

## 3. 与既有界面的关系

| 区域 | 无项目时 | 有项目时 |
|---|---|---|
| 顶栏 | 标题「短剧 Agent · 未打开项目」；stage-track 八格灰点，点击无响应；谱系入口与 AI 设置**可用** | 与现状一致 |
| 左栏 | 不变（项目库列出全部项目，可点选打开；底部「＋ 新建项目」可用） | 不变 |
| 中栏 | `WelcomeView` | `CanvasBoard` / `Stage0View` |
| 右栏 | 保留：口径条不渲染、对话输入锁定并说明原因、模型选择器可用 | 不变 |
| 底栏 | 不渲染 | 与现状一致 |

## 4. 视觉验收标准

| # | 标准 |
|---|---|
| V1 | 首屏 3 秒内可判断"下一步做什么"：主 CTA 是唯一深色块，视觉权重最高 |
| V2 | 无任何"假数据"：不出现 ComfyUI 地址、进度条、Harness 计数、自动保存时间 |
| V3 | 文案不指向不可用路径：不再出现"在下方输入你的想法"类引导 |
| V4 | 空库 / 有库 / 失败三种态均不出现布局跳动（卡片宽度恒定 560，列表区最小高 0） |
| V5 | 深浅色均按现有 token 呈现，不新增硬编码主题色 |
