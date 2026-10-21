# SDG-RE-任务清单 — feature-811 谱系面板全量真实化（B-41 收尾）

> **批准前不触碰任何代码（铁律 1）**。2026-10-20 用户批准全部，T1-T9 已按序实施完毕；执行记录见 SDG-AI-变更记录 T/X 节。

## T1 基线冻结
- [x] 跑全量测试，确认基线 = **56 文件 638 passed / 0 failed / 1 skipped**；typecheck 恰 3 条历史基线（canvas-zoom.test.tsx×2 + runtime-client.test.ts×1）（2026-10-20 完成：实测与批准冻结值一致）
- [x] 基线数字记入变更记录 T1 行

## T2 store 新建
- [x] 新建 `src/studio/style-catalog-store.ts`：模块级快照 + `ensureStyleCatalog(force?)`（单 flight 去重 / ok 态 no-op / window.api 缺失 → unavailable 不抛）+ `useStyleCatalog()`（首订阅懒 ensure）+ `getStyleEntry` / `getStyleName`（同步快照读，null 回退）+ `_setStyleCatalogSnapshotForTest`（2026-10-20 完成）
- [x] 零 import 副作用（jsdom 安全）

## T3 VisualCatalog 改造
- [x] 删除三件套：`STYLES`（L33-57）/ `StyleEntry` 接口（L7-16）/ `FAMILIES`（L18-24）、`STYLE_CATALOG_VERSION`（L26-30 含 810 L1 自决留痕三注释块）、`styleNameOf`（L59-62）（2026-10-20 完成：物理删除，Grep 零活引用）
- [x] `useStyleCatalog()` 接入；TABS / 条目卡片 / 弹层按契约 §3.1 十二行映射数据驱动（TABS label = `` `${id}系 ${familyLabel}` ``）
- [x] `onAdopt` payload `family` 改传 `entry.familyLabel`（StudioApp toast split 天然降级，StudioApp 零 diff）
- [x] 保留 FAMILY_GRAD / PREVIEW_URL / VIDEO_URL / VID_TABS 静态资源映射；加载态占位行；文件头注释刷新

## T4 三组件切换
- [x] ChatComposer.tsx：L165 `STYLES.some` 校验、L215 `STYLES.find`、L245 `STYLE_CATALOG_VERSION` 三处切 store；删常量 import；version 空 → `@` 与版本段不渲染（2026-10-20 完成）
- [x] Stage0View.tsx：L19-22 `styleRefLabel` 内 `styleNameOf` → `getStyleName`；known 集合数据源切换；extra 前置兜底保留
- [x] StudioViewer.tsx：L21-24 同上切换

## T5 dev-mock 自具化
- [x] `DEMO_STYLE_CATALOG_ENTRIES` 摆脱对 VisualCatalog STYLES 的 import，自具 18 条十键演示表（2026-10-20 完成：条目口径对齐 STYLE_REGISTRY role/feasibility/辅助候选 + J.2 锚点词）
- [x] `DEMO_STYLE_CATALOG_VERSION='v1.47'` 保留；`demoStyleUpgradeDiff` 闭环零 diff

## T6 单测
- [x] 新建 `src/studio/style-catalog-store.test.ts`（契约 §5 六断言点）（2026-10-20 完成：6 例）
- [x] visual-catalog.test.tsx：catalogSpy 夹具补十键；TABS / 卡片 / 弹层断言改写（走真实拉取路径）
- [x] chat-markdown.test.tsx：beforeEach prime 快照 + L184-195 断言改写（版本号来自 prime 值非常量）；E99 纯文本兜底
- [x] studio-viewer.test.tsx / stage0-view.test.tsx：beforeEach prime 快照；既有断言保持绿（版本来自 brief 夹具 catalogVersion）
- [x] **测试文件净增恰 1：56 → 57**

## T7 全量回归
- [x] 全量测试：passed 不减（≥638）、failed = 0、skipped 不增（=1）、文件数 = 57（2026-10-20 完成：**57 文件 648 passed / 0 failed / 1 skipped（649 total）**，638→648，+10 = store 6 + 811 describe 4）
- [x] typecheck：恰 3 条历史基线，零新增
- [x] Grep 静态验证：src 下 `STYLE_CATALOG_VERSION` / `STYLES` / `styleNameOf` / `FAMILIES`（VisualCatalog 内部）零引用
- [x] 结果记入变更记录 T7 行

## T8 真机目验（真实化证明）
- [x] 备份 `resources/style/短剧视觉谱系.md`（2026-10-20 完成：谱系真实路径 = `resources/H3-Style/AI短剧制作视觉风格谱系.md`（loader.ts `STYLE_DIR_NAME` / `STYLE_FILE_NAME` 权威，本行原文为旧称）；备份落 `%TEMP%\AI短剧制作视觉风格谱系.md.t8bak`）
- [x] 临时改 md：**J.0 版本号 + 某条目锚点词**（**不改条目名称**——md 条目按名称关联注册表，改名称会破坏装载）（完成：v1.46→v1.47（`VERSION_RE` 仅捕获 `vX.YY` 格式，版本号合规递增）+ A7 锚点词列追加 `T8VERIFY`）
- [x] **重启应用**（loader 主进程缓存随进程失效）→ 打开 VisualCatalog 面板与对话选项卡，目验版本号 / 锚点词与 md 同步（完成：面板头部 v1.47 ✅ / TABS 实算（全部 18 · A 6 · B 1 · C 5 · D 5 · E 1）✅ / A7 弹层锚点词含 `T8VERIFY` ✅ / 质感配方块 ✅；对话选项卡真机无有机样本，替代三点闭环取证——详见变更记录 T8 行）
- [x] 恢复 md 原样 → 重启 → 目验复原（完成：版本行回 v1.46；面板头部 v1.46 ✅ / A7 弹层锚点词无 `T8VERIFY` ✅）
- [x] 目验记录（改动内容 / 截图或文字描述 / 复原确认）记入变更记录 T8 行

## T9 治理收尾
- [x] 变更记录 T 节全量回填 + X 节（零修复则明示）（2026-10-20 完成）
- [x] 偏差清单 B-41 行翻 ✅ 已闭环
- [x] README 总表 811 行翻 ✅
- [x] 呈报用户验收
