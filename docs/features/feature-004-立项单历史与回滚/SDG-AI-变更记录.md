# SDG-AI-变更记录 · feature-004 立项单历史与回滚

> 三分类：D 决策 / T 实施 / X 修订。新条目追加在对应分节末尾。

## 一、决策记录（D）

### D-001 · 建包与 K8 登记（2026-10-18）

- **背景**：用户盘点「新建→立项」链路缺口，确认缺口 1 = 设计 §2.6.5 末条 / §2.6.6-2.6.7 明示的「查看历史（历史列表 + diff 视图 + 任意版本回滚）」UI 零落地（brief.list 仅 Agent 层消费）。用户拍板优先切本缺口。
- **决策**：建 feature-004（0xx STAGE 0 段）；偏差登记 B-37（盘点发现，本包登记并关闭，先例 feature-003/B-16）。
- **K8 登记**：新增 3 条 IPC——`brief:history` / `brief:version-read` / `brief:rollback`（契约 §2）。K1/K9 零触发（不动 shared/types.ts、零新依赖）。
- **关键取舍**：见设计说明 §2 D1–D6（入口落查看器、右栏恒最新、回滚复用 publishBriefFiles、不做影响清单面板、DTO 镜像不进 shared）。

## 二、实施记录（T）

- **2026-10-18：T1 基线冻结**：`npx tsc --noEmit` 恰 3 条历史基线（[canvas-zoom.test.tsx](../../../src/studio/canvas-zoom.test.tsx) L13/L90 等既有非本包错误，T1 时点冻结）；全量 `npm run test:run` **49 文件 550 passed / 0 failed / 1 skipped**（skip = 需 ARK Key 的 T8-4）。数字冻结为回归基线。
- **2026-10-18：T2 主进程完成**：[history.ts](../../../electron/brief/history.ts) 新建（`getBriefHistory` = listBriefVersions 元数据映射 + note 条件展开；`readBriefVersion` = 读指定版 + diffBrief 实算 diffToLatest）；[rollback.ts](../../../electron/brief/rollback.ts) 新建（`rollbackBrief` R1–R5：拒回滚最新版 / 以 vK 内容经 publishBriefFiles 发 v(N+1) / approve.by='ui' + md 落款「回滚自 vK」 / 全历史保留 / manifest briefVersion 推进）；[main.ts](../../../electron/main.ts) +3 handle（brief:history / version-read / rollback）；[preload.ts](../../../electron/preload.ts) +3 桥；[global.d.ts](../../../src/global.d.ts) L52-75 DTO 镜像（不进 shared/types.ts，K1 零触发）。listBriefVersions / diffBrief / publishBriefFiles 复用零 diff。
- **2026-10-18：T3 renderer 完成**：[BriefHistoryView.tsx](../../../src/studio/BriefHistoryView.tsx) 新建（336 行，V1–V6：版本列表 / 两栏 diff 选中版 vs 最新版字段黄底高亮 / 差异摘要条 / 回滚确认框 / 成功绿条 / 加载与错误态）；[StudioViewer.tsx](../../../src/studio/StudioViewer.tsx) 「查看历史」入口按钮（L585-594）+ 视图挂载（L631-633）；[dev-mock-api.ts](../../../src/dev-mock-api.ts) +3 mock（briefHistory / briefVersionRead / briefRollback，demoBrief v1/v2/v3 三版内存库）。
- **2026-10-18：T4 单测完成（净增恰 2 测试文件 14 例）**：[brief-rollback.test.ts](../../../src/test/brief-rollback.test.ts) 8 例（AC1–AC5：历史列表元数据 / 版本读取含 diffToLatest / 回滚再版全字段 = vK / 拒回滚最新版 / 回滚后全历史保留）；[brief-history.test.tsx](../../../src/studio/brief-history.test.tsx) 6 例（AC6–AC7：列表渲染 / diff 高亮与摘要条 / 回滚确认与禁用态）。
- **2026-10-18：T5 全量回归达标**：typecheck 恰 3 条历史基线零新增；全量 **51 文件 564 passed / 0 failed / 1 skipped**——文件净增恰 2（49→51）、passed 净增 14（550→564）不减少、skip 不增（AC8 达标）。
- **2026-10-18：T6 目验通过（AC9 七项全过）**：Chrome DevTools MCP 浏览器通道（localhost:5173，dev-mock 三版内存库 v1/v2/v3；目验前置：dev-mock-api.ts `demoCanvas()` n-outline 注入 parentReference + dirty 预置 feature-002 脏读演示态，白名单内文件）。①多版本项目；②画布立项单节点「查看产物」→ StudioViewer「查看历史」→ BriefHistoryView 打开；③默认选中 v2，diff 摘要「与最新版 v3 的差异 · 4 项（左 v2 → 右 v3）」，集数 / 季边界 / 诊断摘要 / 诊断明细四字段黄底行高亮；④回滚确认框文案齐备（「将以 v2 的内容发布新立项单 v4，当前最新 v3 不会丢失。基于旧版的下游产物将按既有机制提示脏读。」）；⑤确认回滚 → 绿条「已发布 v4（内容 = v2）」，列表 v4/v3/v2/v1，v4 记「面板直改 · 变更 4 项 / 回滚自 v2」，选中 v4 显示「该版本即当前最新」回滚钮禁用，v4 内容 = v2（集数「第一季 12 集」、季边界空）；⑥画布 n-brief 徽标 v4 + ref 立项单.v4.json，流程导航 STAGE 0 徽标「v4 ⚠1」；⑦下游脏读黄条持续显示（「有 1 个产物基于旧版立项（最新 v3），内容可能与最新立项不一致。」+ 大纲 ⚠ 角标「基于 v2，与最新 v3 不一致：季边界、集数」，回滚前后不变，符合 §4.2 回滚不触碰 dirty 设计）。截图为 MCP 内联返回，未落盘文件。
- **2026-10-18：T7 治理收尾**：features/README.md feature-004 行翻 ✅（`✅ 已落地（2026-10-18，真机目验 + 51 文件 564 passed）`）；偏差清单 B-37 登记并翻 ✅（本包登记并关闭，先例 B-16/feature-003）；版本记录 2026-10-18 条目增行；任务清单 T1–T7 全勾记；本记录闭环。

## 三、修订记录（X）

（暂无）
