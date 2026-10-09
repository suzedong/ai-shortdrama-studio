# SDG-AI-变更记录 · feature-001-立项

> 本文件按 AGENTS.md §2 三分类管理：决策记录（永久）/ 实施记录（落地清理）/ 修订记录（闭环清理）。

## 一、决策记录（永久保留）

> #D-001 · 2026-10-03 · 卡口 K9 · 用户确认
>
> **引入核心技术栈依赖**：Electron、React 18、TypeScript、Vite、Tailwind CSS、concurrently、wait-on、cross-env、dotenv、@modelcontextprotocol/sdk。
>
> 背景：用户在技术选型讨论中先后评估 Electron / Tauri、Node/TS / Python 后，亲自拍板「Electron + Node/TS 全栈，零 Python」。
>
> 补充：`cross-env` 为 dev 脚本跨平台注入 `VITE_DEV_SERVER_URL` 所需，2026-10-03 补录时经用户「按建议 1+3 执行」授权一并确认。

---

> #D-002 · 2026-10-03 · 卡口 K3 · 用户确认
>
> **旧《AI短剧工作台系统设计》md/html 作废归档**，由《短剧Agent平台设计》v1.0 取代；旧文件移至 `_archive/` 并加作废标注。
>
> 属"弃用"决策，由用户「模仿 MiniMax Design 全新设计」指令明确授权。

---

> #D-003 · 2026-10-03 · 卡口 K9 · 用户确认
>
> **接入火山方舟 Coding Plan** 作为主控 Agent 模型通道：模型 `ark-code-latest`，base URL `https://ark.cn-beijing.volces.com/api/coding/v3`；密钥经 `.env` 注入、不入库、日志脱敏。
>
> 由用户提供密钥并指定 Coding Plan 专用路径；连通性实测通过（HTTP 200，选题诊断真实生成）。

---

> #D-004 · 2026-10-03 · 卡口 K7 · 用户确认
>
> **落地 AGENTS.md** 并将既有立项代码按 AI-SDG 六步法反向补录为 feature-001 任务包。
>
> 由用户「按建议 1+3 执行」指令授权。

## 二、实施记录

（本次为反向补录，纯过程条目；落地后可按修订注清理）

## 三、修订记录

（暂无）
