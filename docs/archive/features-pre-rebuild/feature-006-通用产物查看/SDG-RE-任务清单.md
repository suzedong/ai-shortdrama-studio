# SDG-RE 任务清单 · feature-006 通用产物查看

> 版本：v1.4（2026-10-04，随定稿文件回退源同步，见 T6/T7）
> 状态图例：[ ] 未开始 / [~] 进行中 / [x] 完成
> 每个任务完成后更新状态；卡口触发追加永久决策记录，纯实施只勾 AC。

## 上下文加载清单（工作围栏）

开始前逐项读取，禁止读写清单以外文件（用户明确指示除外）：

1. `docs/features/feature-006-通用产物查看/`：需求规格、契约（本目录）
2. `shared/types.ts`（只读，K1）
3. `src/lib/revision.ts`（STAGE_PRODUCT_KINDS / NODE_REVISION / CHAIN_ORDER / isRunnable）
4. `src/App.tsx`（canvasEntries / viewEntries / handleEntry / openArchiveModal / startDraft / nodes / messages）
5. `src/components/StageCanvas.tsx`（节点渲染、viewEntries、onEntry）
6. `src/components/ChatPanel.tsx`（renderProductCard 富卡片路由范式）
7. `src/components/messages/`：BriefCard / OutlineCard / ProfilesCard / ScenesCard / DialogueCard / StoryboardCard
8. `src/components/BackgroundArchive.tsx`、`src/components/IdeaEditDialog.tsx`
9. feature-005 契约 §5（入口）与 `src/components/feature005-ui.test.tsx`（回归基线）
10. `electron/session.ts`（saveToCurrent/saveStory/saveScript 定稿落盘结构、requireDir）
11. `electron/main.ts`、`electron/preload.ts`（IPC 注册与 contextBridge）
12. `src/lib/replay.ts`（ReplayResult / replayMessages）
13. 契约 §10（v1.4 定稿文件回退源）

卡口预判：K6（新增业务包，**已获用户批准 2026-10-04**）；K8（v1.4 新增只读 IPC `session:read-finalized` + FinalizedSnapshot DTO，**已获用户签字批准 2026-10-04，见 D-007**）；不触发 K1（不改 shared）、K9（不引依赖）。

## 原子任务

### T1 · 纯函数库 src/lib/viewer.ts

- [x] 定义 `ViewerContent`、`resolveViewer(stage, ctx)`（契约 §3）
- [x] 定义 `computeEditRoute(stage, ctx)`（契约 §5），复用 `isRunnable`
- [x] 前驱节点名解析（CHAIN_ORDER 索引）
- AC：
  - [x] AC-T1-1 resolveViewer 各 kind 取最后正式产物，忽略 candidate/revision-draft
  - [x] AC-T1-2 无内容/状态不符 → null
  - [x] AC-T1-3 idea 用注入 ideaText；status 正确
  - [x] AC-T1-4 computeEditRoute 全分支（draft/regen/idea-dialog/archive-modal/各类置灰 reason）
  - [x] AC-T1-5 brief 复合立项单（简报 + 视觉风格 + 诊断结论，D-004/D-005）
  - [x] AC-T1-6 ViewerContent.sourceFiles 全部返回（D-006）
- [x] 单测 src/lib/viewer.test.ts（14 测试）

### T2 · StageCanvas 整卡可点

- [x] Props 增 onOpenViewer；canView 时根节点 cursor-pointer + onClick（契约 §2）
- [x] 👁 与 ✎/💬 按钮 stopPropagation
- AC：
  - [x] AC-T2-1 整卡点击 → onOpenViewer(id)
  - [x] AC-T2-2 动作按钮点击不冒泡触发查看
  - [x] AC-T2-3 canView false 不可点；失效节点保留查看
- [x] 更新/新增 StageCanvas 相关测试（feature006-canvas.test.tsx，5 测试）

### T3 · ProductViewer 组件

- [x] 建 src/components/ProductViewer.tsx（契约 §4）
- [x] 复用 6 张富卡片；新增 diagnosis / visual-style 最小只读段
- [x] 状态徽标、去修改按钮（disabled/reason）、Esc/遮罩关闭
- AC：
  - [x] AC-T3-1 各 kind 渲染正确卡片
  - [x] AC-T3-2 done/invalidated 徽标 testid
  - [x] AC-T3-3 去修改 disabled + title；关闭/Esc/onGoEdit
  - [x] AC-T3-4 立项单三段渲染 / 视觉风格占位（D-004/D-005）
  - [x] AC-T3-5 标题右侧 viewer-source 来源标注（D-006）
- [x] 单测 src/components/ProductViewer.test.tsx（8 测试）

### T4 · App 编排

- [x] viewerStage 状态 + openViewer（background 走档案，其余走查看器）
- [x] viewEntries 对全部 9 节点按 hasViewContent 计算（替换硬编码）
- [x] StageCanvas 传 onOpenViewer；handleEntry 'view' 统一 openViewer
- [x] useMemo resolveViewer；computeEditRoute；onGoEdit 按 action 路由
- AC：
  - [x] AC-T4-1 9 节点 done/invalidated 可点查看，内容完整
  - [x] AC-T4-2 查看零写入（节点/消息不变）
  - [x] AC-T4-3 去修改四类 action 正确衔接
  - [x] AC-T4-4 门控/加载/变更链中可查看、去修改正确置灰
- [x] 集成测试（src/feature006-ui.test.tsx，4 测试）

### T5 · 全量验证与收尾

- [x] tsc --noEmit 零告警（strict + noUnusedLocals）
- [x] 全量 vitest 通过、无回归（22 文件 226 测试；基线 195 + 本特性及增强 31）
- [x] eslint 等效检查（项目未配置 eslint.config，无 lint 脚本；tsc 严格类型门禁通过）
- [x] build 通过（renderer + electron 双 tsc）
- [ ] 真机验证（Electron）：三阶段逐节点查看、失效看旧版、去修改路由（需用户在桌面端执行）
- [x] AC 逐项自检并输出（见会话总结）
- [x] 变更记录：D-001/D-002/D-003 永久保留；编码全程纯实施以 AC 勾选、无残留实施条目

### T6 · 定稿文件回退（v1.4，需 K8 签字后开工）

- [x] 主进程 `electron/session.ts` 新增 `readFinalized()`：读 `brief.json`、`剧本/{故事大纲,人物小传,分场,台词}.json`、`分镜/shotlist.json`，组装 `FinalizedSnapshot`（契约 §10.2）；任一文件失败只跳过该字段；无会话抛 `NO_SESSION`
- [x] `electron/main.ts` 注册 `session:read-finalized`（无入参，纯只读）
- [x] `electron/preload.ts` 暴露 `readFinalized: () => ipcRenderer.invoke('session:read-finalized')`
- [x] `src/lib/viewer.ts`：ctx 增可选 `finalized?: FinalizedSnapshot | null`；按契约 §10.4/§10.5 实现 6 节点回退（sourceFiles 标定稿文件、status='done'、brief 复合且诊断仅 conclusion）；idea/diagnosis 回退 null
- [x] `src/App.tsx` hydrate：额外 `await window.api.readFinalized()`，按 §10.6 合并——节点状态 replay 优先、snapshot 补 done（idea/diagnosis 不补）；产物 state 空时 snapshot 兜底；phase/gate/activeUnlock/activeDraft 不从 snapshot 恢复
- AC：
  - [x] AC-T6-1 消息流有产物时永不回退（snapshot 被忽略）
  - [x] AC-T6-2 消息流空时 6 节点可查看、sourceFiles 为定稿文件、徽标 done
  - [x] AC-T6-3 brief 回退三段正常且诊断段仅 conclusion 无案例表
  - [x] AC-T6-4 idea/diagnosis 清空后不补 done、无查看入口
  - [x] AC-T6-5 readFinalized 容错：单文件损坏不影响其他字段；零写入
  - [x] AC-T6-6 回退产物「去修改」路由对应 draft
- [x] 单测：viewer 回退分支（src/lib/viewer.test.ts 追加，+5 用例）；session readFinalized（src/test/session-finalized.test.ts，7 用例，参照既有 electron 测试范式）

### T7 · 回退全量验证与收尾

- [x] tsc --noEmit 零告警（strict + noUnusedLocals）
- [x] 全量 vitest 通过、无回归（23 文件 238 测试；T5 基线 226 + 回退 12）
- [x] build 通过（renderer + electron 双 tsc）
- [ ] 真机验证（Electron）：清空对话后 6 节点回退查看、来源标注正确、idea/diagnosis 无入口（需用户在桌面端执行）
- [x] AC 逐项自检并输出
- [x] 变更记录追加 D-007（K8 新增只读 IPC 决策，永久保留）

## 验收总表（对照需求规格 §6）

- [x] AC-1 9 节点 done/invalidated 可查看，pending/active 不可点
- [x] AC-2 整卡/👁 均可打开，字段完整
- [x] AC-3 失效节点显示旧内容 + 失效徽标
- [x] AC-4 只读，不改状态/消息（集成测试断言零 appendMessage）
- [x] AC-5 去修改按契约 §5 路由/置灰
- [x] AC-6 门控/加载/变更链期间可查看
- [x] AC-7 全量测试绿、无回归
- [x] AC-8 立项单与画布摘要内容一致，且含诊断结论摘要（D-004/D-005）
- [x] AC-9 查看器标题显示「来源：chat.messages.json」（US-3b / D-006）
- [x] AC-10 清空对话后 brief/outline/profiles/scenes/dialogue/storyboard 可回退查看（来源标定稿文件、零写入），idea/diagnosis 为硬边界不可回退（US-8 / D-007；真机验证待桌面端执行）
