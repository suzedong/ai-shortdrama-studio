# 任务包索引（Feature → Change）

> 更新：2026-11-20（D-039 历史归档清理后的现行入口）。本索引只回答“模块由谁负责、历史来自哪里、当前状态是什么、从哪里进入代码与任务包”。
>
> **共 25 个目录：24 个现行负责包 + 1 个历史归档包（826）。**D-039 已删除其余 21 个历史归档目录，其原始规格、FAIL、测试证据与验收结论仅从 Git 历史追溯；保留的 826 不改写历史记录。
>
> 开发前先按模块定位现行负责包，再在该包内登记 Change；归档包不再承接新需求。P0 已完成、P1 尚未通过；目录清理不删除产品能力，也不使任何 Parity 项或真机验收自动通过。

## 1. 现行负责包（24）

| 模块 | 当前负责包 | 历史来源（仅作血缘） | 当前状态 / 开放边界 | 路径 / 代码入口 |
| :-- | :-- | :-- | :-- | :-- |
| 立项数据与定案 | [feature-001 · 立项模型重建](./feature-001-立项模型重建/) | 002；007 / 010 / 012 / 015 中的立项数据、定案与 Agent 协议 | ✅ 既有实施完成；与 005 独立，不合并 | `electron/brief/`；`resources/opencode/agents/showrunner.md`；`src/studio/` |
| 立项历史与回滚 | [feature-004 · 立项单历史与回滚](./feature-004-立项单历史与回滚/) | — | ✅ 已完成；不承接 007 | `electron/brief/history.ts`；`electron/brief/rollback.ts`；`src/studio/viewer/BriefHistoryView.tsx` |
| 捕获口径与匹配 | [feature-005 · 已捕获口径常驻区](./feature-005-已捕获口径常驻区/) | 008 的 canonical 词表、精确匹配 / 去重与口径分组 | ⚠️ 自动回归已有记录；真机目验待用户。独立负责词表 / 匹配 / 分组，不归 013 | `electron/capture/`；`src/studio/stage0/CaptureBar.tsx` |
| 公开检索与选题诊断 | [feature-006 · 选题诊断公开数据检索](./feature-006-选题诊断公开数据检索/) | — | ⚠️ 公开检索成功与商业短剧诊断仍有真机确认项 | `electron/mcp/tools.ts`；`electron/network.ts` |
| 立项视图与影响呈现 | [feature-013 · 立项视图直改与导航增强](./feature-013-立项视图直改与导航增强/) | 003 / 007 / 008 / 009 / 010 / 011 / 012 的立项视图、链态、分色、影响面板与留存卡 | ⚠️ 既有实施完成；T8 及后续真机目验仍待用户，呈现层不复制 005 的词表事实源 | `src/studio/`；`electron/brief/` |
| 文本服务配置 | [feature-014 · AI 服务配置管理](./feature-014-AI服务配置管理/) | — | ⚠️ LM Studio 注册 / 推理 / 重连 / 重启持久化仍有开放项 | `electron/settings/ai-service.ts`；`src/studio/shell/AiServicePanel.tsx` |
| 故事创作 | [feature-101 · 故事创作链](./feature-101-故事创作链（大纲+人物小传）/) | — | ✅ 反向补录完成 | `resources/opencode/agents/writer.md`；`src/studio/viewer/StudioViewer.tsx` |
| 剧本创作 | [feature-201 · 剧本创作链](./feature-201-剧本创作链（分场+台词+分镜文字稿）/) | — | ⚠️ 2-a / 2-b 已完成；2-c 真机人工验收开放 | `resources/opencode/agents/writer.md`；`electron/gate/execute.ts`；`src/studio/viewer/StudioViewer.tsx` |
| 项目状态与确认门 | [feature-801 · manifest 状态机推进](./feature-801-manifest状态机推进/) | 807 / 015；010 / 012 的通用确认门 pending / execute / execution / reopen | ✅ 现行负责入口；015 主归本包。与 806 独立，不合并 | `electron/project/manifest.ts`；`electron/gate/` |
| 视觉风格谱系 | [feature-802 · 视觉风格谱系接入](./feature-802-视觉风格谱系接入/) | 810 / 811 / 815 / 826 的谱系升级、真实 store、媒体元数据与 v1.47 基线 | ✅ 谱系接入已落地；历史 B-70 已闭环，不据此宣称 P1 / Parity 通过 | `electron/style/`；`resources/H3-Style/`；`src/studio/style/VisualCatalog.tsx` |
| ComfyUI 统一媒体引擎 | [feature-803 · ComfyUI 统一媒体引擎](./feature-803-ComfyUI统一媒体引擎/) | — | ⚠️ H3 API 级链路已验；应用内第二实例、禁用拒绝、恢复、资产 UI 与并发隔离仍待应用内验收，直连 API 证据不替代 | `electron/comfy/`；`src/studio/shell/AiServicePanel.tsx` |
| Harness 与门联动 | [feature-806 · Harness 基础校验与确认门全链路](./feature-806-Harness基础校验与确认门全链路/) | — | ✅ 批一完成；后续批次另批。与 801 独立，不合并 | `electron/harness/`；`src/studio/chat/GateCardView.tsx` |
| 会话续聊与运行时数据 | [feature-808 · 会话续聊](./feature-808-会话续聊（项目会话绑定与历史回放）/) | 819 的 runtime 模板路径；010 的 reasoning / 历史回放数据 | ✅ 既有专项完成；与 817 的数据 / 视觉边界独立，不合并 | `electron/runtime/`；`electron/project/library.ts`；`src/studio/` |
| 工作目录 | [feature-813 · 工作目录更换](./feature-813-工作目录更换/) | — | ✅ 独立负责；不承接 812 的无项目入口 | `electron/settings/workspace.ts`；`src/studio/shell/WorkspacePanel.tsx` |
| H3 Image 生产迁移 | [feature-816 · H3 图像通道迁移](./feature-816-H3图像通道迁移/) | — | ✅ H3 Image 迁移已完成；不等于 803 的统一媒体引擎全部验收，两包不合并 | `electron/comfy/`；`resources/ComfyUI/` |
| 主题与对话视觉 | [feature-817 · 全局双主题与对话形态对齐](./feature-817-全局双主题与对话形态对齐/) | 809 的活跃动画 / 120px 滚动 / 交错展示；010 的视觉形态 | ⚠️ 真实 AI runtime、OptionCard、任务详情与 Gate 现场尚未全闭环 | `src/studio/chat/ChatComposer.tsx`；`src/studio/shell/StudioApp.tsx`；`src/index.css` |
| 一级入口与窗口外壳 | [feature-820 · 一级入口与伪造状态收口](./feature-820-一级入口与伪造状态收口/) | 804 的窗口外壳 | ⚠️ 一级入口已验；窗口外壳保留 macOS 既有挂起项 | `electron/main.ts`；`electron/window/chrome.ts`；`src/studio/shell/` |
| 资产上传与来源 | [feature-821 · 资产上传与真实缩略图](./feature-821-资产上传与真实缩略图/) | 814 的可信资产来源 | ✅ 切片 C 专项已验；与 822 独立，不合并 | `electron/asset/`；`src/studio/shell/LeftPanels.tsx` |
| 对话侧资产引用 | [feature-822 · 对话侧资产引用](./feature-822-对话侧资产引用/) | — | ✅ 切片 D 专项已验；与 821 独立，不合并 | `electron/runtime/`；`src/studio/chat/ChatComposer.tsx` |
| 多创作页与画布持久化 | [feature-823 · 多创作页与自由画布持久化](./feature-823-多创作页与自由画布持久化/) | 814 的画布命令 / revision / receipt / 资产绑定；825 的 Canvas 只读预检 | ✅ 切片 E 与本包专项已验；不代表 P1 整体通过 | `electron/canvas/`；`src/studio/canvas/`；`src/studio/shell/` |
| 项目 JSON 写安全 | [feature-827 · 项目 JSON 原子写与异常终止验收](./feature-827-项目JSON原子写与异常终止验收/) | 825 的 openProject guard / session、同单项目写队列与错误优先级 | ✅ 本包专项完成；不扩写为跨文件 / 跨项目事务 | `electron/fs/`；`electron/project/`；`electron/canvas/` |
| 项目库与打开事务 | [feature-828 · 项目库 P1 能力补齐](./feature-828-项目库P1能力补齐/) | 812 的无项目入口；824 的项目库 F1—F10；825 的项目打开提交事务 | ✅ 本包专项完成；824 原始 FAIL 仅在 Git 历史保留，不倒写 | `electron/project/`；`src/studio/shell/` |
| 页历史与跨页正式引用 | [feature-829 · 创作页历史与跨页正式引用](./feature-829-创作页历史与跨页正式引用/) | — | 🚧 继续实施中；真实 Electron 未验收前不得闭环 | `electron/canvas/`；`src/studio/canvas/`；`src/studio/shell/` |
| 测试与验收数据落点 | [feature-830 · 测试与验收数据落点统一](./feature-830-测试与验收数据落点统一/) | 818 / 826 的通用测试门禁与测试数据原则 | ✅ 已完成；X-001 / X-002 作为历史记录保留 | `src/test/setup.ts`；`scripts/acceptance-env.cjs`；`electron/main.ts` |

**独立边界**：001 / 005、801 / 806、803 / 816、808 / 817、821 / 822 均不合并；013 只承接呈现职责，不吞并 005；813 保持独立。

## 2. 历史归档包（1）

以下链接仅用于追溯历史血缘、原规格与当时证据，不是现行实施入口。后续变更请进入右列负责包。

| 历史归档包 | 现行负责入口 | 保留说明 |
| :-- | :-- | :-- |
| [feature-826 · 谱系测试基线收口](./feature-826-谱系测试基线收口/) | 802 / 830 | 用户指定保留；谱系业务归 802，通用测试门禁与数据原则归 830，归档不承接新 Change |

D-039 已删除 `002 / 003 / 007 / 008 / 009 / 010 / 011 / 012 / 015 / 804 / 807 / 809 / 810 / 811 / 812 / 814 / 815 / 818 / 819 / 824 / 825` 共 21 个历史目录。其历史归属仍以上表现行负责包的“历史来源”列为准；原始文档只从 Git 历史读取，不新建占位目录或重复副本。

## 3. 使用规则

1. 新能力是否建包、既有能力由谁负责，按通用指令 §2.5 与本索引判断；不要从归档包直接开工。
2. 包内需求 / 契约 / 设计、任务清单与验收证据是唯一细节入口；本索引不复制迁移条款、完整覆盖矩阵、测试计数或验收日志。
3. 历史编号在旧版本记录、旧决策叙述和原始测试证据中继续保留；被删目录的原始证据只从 Git 历史读取，只有现行导航与当前负责入口使用上表的新归属。
4. 跨阶段状态以 [MiniMax Design 全面复刻开发计划](../research/MiniMax%20Design全面复刻开发计划.md) 为准；当前 P0 已完成、P1 未通过，P2—P7 未到验收。
